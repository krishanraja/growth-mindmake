import { DAY } from '../guards.mjs';

/**
 * The visibility standard: which stage, podcast or press slot is worth Krish
 * standing on (plan section 12, M4; Ruling, Krish, 2026-10-27: "Control
 * center should just be where you read from and where you report to, it does
 * not own the strategy for how to grow mindmake as a business").
 *
 * Ported from Control Center's Nova standard, rule for rule:
 *   api/_visibilityScore.ts          the weights, the floors, the three axes,
 *                                    the conjunction, the gate order, the
 *                                    dead-date rule and the judgment clean-up
 *   api/visibility-targets/score.ts  what is written when a date has passed,
 *                                    when the evidence is thin, and which rows
 *                                    are judged next
 *   src/lib/visibilityScale.ts       the score version gate, the axes and
 *                                    verdict of a stored row, the legacy scale
 *   src/lib/visibilityStandard.ts    the view: take, a capped stretch lane,
 *                                    refused, unjudged and awaiting
 *
 * The standard is a conjunction, never a mean: the audience must hold the
 * buyer, the platform must carry authority, and the angle must be one only
 * Krish can give. Who the buyer is belongs to Mindmake's canon (the Horizon in
 * 00_NORTH_STAR.md and the buyer gate in 01_CANON.md, read live by canon.mjs);
 * the deterministic rules below only weigh the densities a judge read against
 * it, so no line here restates the offer or the buyer.
 *
 * What stays in Control Center: collection (the stages, their pages, their
 * podcast feeds and forms) and the one model call that reads a stage's page
 * and returns the densities (scoreVisibilityTarget's prompt, PUBLIC_SAFE_NOTE,
 * roomsHeWants, podcastContext). Its prompt restates Mindmake's offer from
 * Control Center's own mission block; that copy is not ported. The engine
 * instead reads each stage, its three stored axes and its verdict from the
 * context (records.visibility) and judges them again here: the pitch and
 * form stages act on that verdict (stageVerdict), and visibilityShadow
 * still counts it beside Control Center's while Control Center writes its
 * own.
 *
 * Where src/stages/pitches.mjs already holds the same rule: VERDICT_WEIGHT
 * reads only take and stretch and pitchHold and speakHold hold a rejected
 * stage (visibility_recommendable's verdict gate); speakScore ranks by the
 * minimum of the three axes (the conjunction); speakHold's deadline_passed and
 * event_passed are isDeadDate. Since "the engine's version acts" (plan
 * section 12, M4), every one of them reads the engine's own verdict
 * (stageVerdict) and axes (stageStrength), under the current score version,
 * and never Control Center's stored verdict.
 *
 * Pure: no model, no network, no clock but the run's.
 */

/** api/_visibilityScore.ts VISIBILITY_SCORE_VERSION: the standard this file ports. */
export const VISIBILITY_SCORE_VERSION = 1;
/** api/_visibilityScore.ts LEGACY_SCORE_VERSION: the old relevance column, never compared with the standard. */
export const LEGACY_SCORE_VERSION = 0;

/** api/_visibilityScore.ts VISIBILITY_WEIGHTS: the room is mostly who can move a decision, minus practitioners, sellers and commentators. */
export const VISIBILITY_WEIGHTS = Object.freeze({
  room: Object.freeze({ decider: 0.70, seniority: 0.30, practitioner: -0.40, vendor: -0.25, press: -0.35 }),
  standing: Object.freeze({ platform: 0.55, reach: 0.25, seniority: 0.20 }),
});

/** api/_visibilityScore.ts VISIBILITY_FLOORS: all three clear for take; a real room and angle on a small platform is a marked stretch. */
export const VISIBILITY_FLOORS = Object.freeze({ room: 60, standing: 55, onlyHim: 60, stretchStanding: 35, stretchCap: 2 });
/** src/lib/visibilityStandard.ts STRETCH_CAP: at most this many stretch rows ever surface. */
export const STRETCH_CAP = VISIBILITY_FLOORS.stretchCap;

/** api/_visibilityScore.ts NAMED_PERSON_BONUS, NAMED_PERSON_BONUS_CAP and ROOM_BAR_FOR_BONUS. */
export const NAMED_PERSON_BONUS = 5;
export const NAMED_PERSON_BONUS_CAP = 10;
export const ROOM_BAR_FOR_BONUS = 50;

/** api/visibility-targets/score.ts REJUDGE_AFTER_DAYS: a verdict older than this is judged again. */
export const REJUDGE_AFTER_DAYS = 45;

/** api/_visibilityScore.ts VisibilityRejectReason: the one taxonomy a refusal names (src/lib/servedSurfaces.ts, visibility_targets). */
export const REJECT_REASONS = Object.freeze([
  'visibility_wrong_audience', 'visibility_too_low_tier', 'visibility_too_technical', 'visibility_off_vertical',
  'visibility_pay_to_play', 'visibility_no_relevant_talk', 'visibility_bad_timing', 'visibility_unlikely_accepted', 'visibility_other',
]);

/**
 * The two channels a judge may say a stage feeds (api/_visibilityScore.ts
 * VisibilityJudgment.feeds_channel). They are the values Control Center's
 * judge writes and stores, kept here only so "feeds neither" is read the same
 * way; they are the publication's older channel names (Control Center's own
 * channelLabel maps them to the current subchannels), so no message uses them.
 */
export const FEEDS_CHANNELS = Object.freeze(['the money of ai', 'built with ai']);

/** api/_visibilityScore.ts clamp: a whole number from 0 to 100, and 0 for anything not a finite number. */
export function clamp(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** api/_visibilityScore.ts computeVisibilityAxes: the three axes and their minimum. Pure. */
export function computeVisibilityAxes(j) {
  const decider = clamp(j.decider_density), prac = clamp(j.practitioner_density), vend = clamp(j.vendor_density), press = clamp(j.press_density);
  const sen = clamp(j.seniority), plat = clamp(j.platform_standing), reach = clamp(j.platform_reach_quality);
  const w = VISIBILITY_WEIGHTS;
  const room = clamp(decider * w.room.decider + sen * w.room.seniority + prac * w.room.practitioner + vend * w.room.vendor + press * w.room.press);
  let standing = plat * w.standing.platform + reach * w.standing.reach + sen * w.standing.seniority;
  const names = (Array.isArray(j.named_people) ? j.named_people : []).filter(n => typeof n === 'string' && n.trim());
  if (names.length && room >= ROOM_BAR_FOR_BONUS) standing += Math.min(NAMED_PERSON_BONUS_CAP, names.length * NAMED_PERSON_BONUS);
  const standing_score = clamp(standing);
  const only_him_score = clamp(j.angle_ownership);
  // The conjunction. Not a mean: a mean lets one strong axis carry two weak ones.
  return { room_score: room, standing_score, only_him_score, visibility_score: Math.min(room, standing_score, only_him_score) };
}

const refuse = reject_reason => ({ verdict: 'rejected', reject_reason });

/**
 * The gates of api/_visibilityScore.ts visibilityVerdict, in its order: a dead
 * date, then bought attention, then an angle anyone could give, then the room
 * (three different wrongs), then the platform. `densities` is false when only
 * a stored row's axes are known: the room's three reasons need the densities,
 * so the refusal is still a refusal and its reason is null. Pure.
 */
function gate(a, j, { densities = true } = {}) {
  const f = VISIBILITY_FLOORS;
  if (j.dead_date) return refuse('visibility_bad_timing');
  if (j.pay_to_play) return refuse('visibility_pay_to_play');
  if (j.generic_take || a.only_him_score < f.onlyHim) return refuse('visibility_no_relevant_talk');
  if (a.room_score < f.room) {
    if (!densities) return refuse(null);
    if (clamp(j.practitioner_density) >= 60) return refuse('visibility_too_technical');
    if (clamp(j.press_density) >= 60) return refuse('visibility_off_vertical');
    if (clamp(j.seniority) < 50) return refuse('visibility_too_low_tier');
    return refuse('visibility_wrong_audience');
  }
  if (a.standing_score < f.standing) {
    if (a.standing_score >= f.stretchStanding) return { verdict: 'stretch', reject_reason: null };
    return refuse('visibility_too_low_tier');
  }
  return { verdict: 'take', reject_reason: null };
}

/** api/_visibilityScore.ts visibilityVerdict: the verdict, and the reason when it is a refusal. The first gate that matches wins. Pure. */
export function visibilityVerdict(j) {
  return gate(computeVisibilityAxes(j), j);
}

/** api/_visibilityScore.ts isDeadDate: true when the stage's own start or deadline is before the run. An unparseable or missing date is never dead. Pure. */
export function isDeadDate(t, at) {
  const now = Date.parse(at);
  for (const iso of [t?.event_start_at, t?.deadline_at]) {
    if (!iso) continue;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) continue;
    if (ts < now) return true;
  }
  return false;
}

/**
 * The deterministic half of api/_visibilityScore.ts scoreVisibilityTarget: a
 * judge's reply made into a judgment, or null when the judge said the
 * material is too thin (never a zero). An angle that is empty, or that feeds
 * neither channel, is generic by construction, whatever the judge said.
 * Throws on a reply that is not an object, as Control Center does. Pure.
 */
export function judgmentFrom(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('visibility_score_unparseable');
  if (parsed.evidence_thin === true) return null;
  const names = Array.isArray(parsed.named_people)
    ? parsed.named_people.filter(n => typeof n === 'string' && n.trim()).map(n => n.trim().slice(0, 200)).slice(0, 12)
    : [];
  const channel = String(parsed.feeds_channel || '').toLowerCase().trim();
  const feeds_channel = FEEDS_CHANNELS.includes(channel) ? channel : 'neither';
  return {
    decider_density: clamp(Number(parsed.decider_density)),
    practitioner_density: clamp(Number(parsed.practitioner_density)),
    vendor_density: clamp(Number(parsed.vendor_density)),
    press_density: clamp(Number(parsed.press_density)),
    seniority: clamp(Number(parsed.seniority)),
    platform_standing: clamp(Number(parsed.platform_standing)),
    platform_reach_quality: clamp(Number(parsed.platform_reach_quality)),
    angle_ownership: clamp(Number(parsed.angle_ownership)),
    angle: String(parsed.angle || '').trim().slice(0, 400),
    feeds_channel,
    pay_to_play: parsed.pay_to_play === true,
    generic_take: parsed.generic_take === true || !String(parsed.angle || '').trim() || feeds_channel === 'neither',
    named_people: names,
    evidence_thin: false,
  };
}

const NO_AXES = Object.freeze({ room_score: null, standing_score: null, only_him_score: null, visibility_score: null });

/**
 * What api/visibility-targets/score.ts writes for one stage, given a judge's
 * reply: a passed date is refused with no axes and no model call; a thin
 * reply is unjudged with no axes, never a low score; otherwise the axes and
 * the verdict. A reply that cannot be read writes nothing (`failed`). Pure.
 */
export function judgeStage(t, parsed, at) {
  if (isDeadDate(t, at)) return { ...NO_AXES, verdict: 'rejected', reject_reason: 'visibility_bad_timing', score_version: VISIBILITY_SCORE_VERSION };
  let j;
  try { j = judgmentFrom(parsed); } catch { return { failed: 'visibility_score_unparseable' }; }
  if (!j) return { ...NO_AXES, verdict: 'unjudged', reject_reason: null, score_version: VISIBILITY_SCORE_VERSION };
  return { ...computeVisibilityAxes(j), ...visibilityVerdict({ ...j, dead_date: false }), score_version: VISIBILITY_SCORE_VERSION };
}

/**
 * api/visibility-targets/score.ts, its queue: an open stage, not buried,
 * never judged, judged under an older version, or judged more than
 * REJUDGE_AFTER_DAYS ago. Control Center does not serve scored_at yet, so the
 * engine asks only once it does. Pure.
 */
export function needsJudging(t, at) {
  if (!['sourced', 'queued'].includes(t?.status) || t.buried_at) return false;
  if (!t.scored_at) return true;
  if (Number.isFinite(t.score_version) && t.score_version < VISIBILITY_SCORE_VERSION) return true;
  return Date.parse(t.scored_at) < Date.parse(at) - REJUDGE_AFTER_DAYS * DAY;
}

// ── A stored row, as src/lib/visibilityScale.ts reads it ──────────────────

const int = v => { const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; };

/** src/lib/visibilityScale.ts legacyRelevanceOutOfTen: the old column, which is two scales, as a number out of ten, or null. Never a gate. Pure. */
export function legacyRelevanceOutOfTen(v) {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return null;
  const out = n > 10 ? n / 10 : n;
  return Math.max(0, Math.min(10, Math.round(out * 10) / 10));
}

/**
 * src/lib/visibilityScale.ts axesOf: a row's axes, or all null when it was not
 * judged under the current version. The context serves the three axes but not
 * visibility_score; since that is their minimum by definition, `overall` is
 * the minimum when the stored figure is not served. Pure.
 */
export function axesOf(row) {
  const none = { room: null, standing: null, onlyHim: null, overall: null };
  if (!row || int(row.score_version) !== VISIBILITY_SCORE_VERSION) return none;
  const room = int(row.room_score), standing = int(row.standing_score), onlyHim = int(row.only_him_score);
  const stored = int(row.visibility_score);
  const overall = stored ?? (room !== null && standing !== null && onlyHim !== null ? Math.min(room, standing, onlyHim) : null);
  return { room, standing, onlyHim, overall };
}

/** src/lib/visibilityScale.ts verdictOf: a row's verdict under the current version, or null. Never inferred from a number. Pure. */
export function verdictOf(row) {
  if (!row || int(row.score_version) !== VISIBILITY_SCORE_VERSION) return null;
  const v = row.verdict;
  return v === 'take' || v === 'stretch' || v === 'rejected' || v === 'unjudged' ? v : null;
}

const isOpen = t => (t.status === 'sourced' || t.status === 'queued') && !t.buried_at;

/** src/lib/visibilityStandard.ts byStrength: the conjunction, then the nearer deadline. */
function byStrength(a, b) {
  const sa = axesOf(a).overall ?? -1, sb = axesOf(b).overall ?? -1;
  if (sb !== sa) return sb - sa;
  const da = a.deadline_at ? Date.parse(a.deadline_at) : Infinity, db = b.deadline_at ? Date.parse(b.deadline_at) : Infinity;
  return da - db;
}

/**
 * src/lib/visibilityStandard.ts applyStandard: what may be shown. A refusal
 * is kept whatever its status; an open row is unjudged, awaiting, take or a
 * stretch capped at STRETCH_CAP; a row whose date has passed is dropped. Pure.
 */
export function standardView(targets, at) {
  const take = [], stretch = [], refused = [], unjudged = [], awaiting = [];
  let judgedAny = false;
  for (const t of Array.isArray(targets) ? targets : []) {
    const verdict = verdictOf(t);
    if (verdict) judgedAny = true;
    if (verdict === 'rejected') { if (!t.buried_at) refused.push(t); continue; }
    if (!isOpen(t)) continue;
    if (verdict === 'unjudged') { unjudged.push(t); continue; }
    if (!verdict) { awaiting.push(t); continue; }
    if (isDeadDate(t, at)) continue;
    if (verdict === 'take') take.push(t);
    else if (verdict === 'stretch') stretch.push(t);
  }
  take.sort(byStrength);
  stretch.sort(byStrength);
  refused.sort((a, b) => Date.parse(b.scored_at || b.updated_at) - Date.parse(a.scored_at || a.updated_at));
  return { take, stretch: stretch.slice(0, STRETCH_CAP), refused, unjudged, awaiting, neverRun: !judgedAny };
}

/**
 * The engine's verdict on a stored row from what the context serves: its
 * dates and its three axes. A passed date is refused; no axes is unjudged;
 * otherwise the same gates as visibilityVerdict. Control Center does not serve
 * pay_to_play, generic_take or feeds_channel, so a stage it refused on one of
 * those reads here on its axes alone. Pure.
 */
export function verdictFromAxes(row, at) {
  if (isDeadDate(row, at)) return refuse('visibility_bad_timing');
  const a = { room_score: int(row?.room_score), standing_score: int(row?.standing_score), only_him_score: int(row?.only_him_score) };
  if (a.room_score === null || a.standing_score === null || a.only_him_score === null) return { verdict: 'unjudged', reject_reason: null };
  return gate(a, {}, { densities: false });
}

// ── The engine's version acts (plan section 12, M4) ───────────────────────

/**
 * The engine's own verdict on a stage, the one every stage acts on: take,
 * stretch, rejected or unjudged. A passed date is refused; otherwise the
 * gates run on the three axes Control Center serves, judged under the
 * current version (axesOf, verdictFromAxes). Axes not served, or judged
 * under another version, read as unjudged, which is how a stage Control
 * Center had not judged was treated: ranked as unjudged and never held for
 * it. Control Center's stored verdict is never read here, so it never
 * decides. Pure.
 */
export function stageVerdict(t, at) {
  if (isDeadDate(t, at)) return 'rejected';
  return axesOf(t).overall === null ? 'unjudged' : verdictFromAxes(t, at).verdict;
}

/** The weakest of a stage's three axes out of 100, under the current version, or null when they are not served (axesOf). Pure. */
export const stageStrength = t => axesOf(t).overall;

/**
 * Control Center's stored verdict on a stage, raw, as its own gates read it
 * (api/_peopleDraft.ts forTarget reads it with no version). For the shadow
 * lines only, which compare the engine's answer with Control Center's while
 * Control Center still writes them; never a decision. Pure.
 */
export const ccStageVerdict = t => (typeof t?.verdict === 'string' ? t.verdict : null);

// ── In shadow, beside Control Center's own verdicts ───────────────────────

/** One counted line for a stage in shadow: how many read, how many agree, and the codes of the rest. Counts only. Pure. */
export function shadowLine(label, [one, many], { read, agree, differ = {}, apart = {}, more = '' }) {
  const codes = o => Object.entries(o).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(', ');
  const total = o => Object.values(o).reduce((s, n) => s + n, 0);
  const d = total(differ), u = total(apart);
  return `${label}, in shadow: ${read} ${read === 1 ? one : many} read${more}; agrees with Control Center on ${agree}, differs on ${d}${d ? ` (${codes(differ)})` : ''}${u ? `; ${u} not comparable (${codes(apart)})` : ''}.`;
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * The visibility standard in shadow. For every stage the context serves, the
 * engine's verdict (verdictFromAxes) beside Control Center's stored one, and
 * one activity line in counts. A stage Control Center has not judged under
 * the current version is not comparable. Where they differ, the code says
 * why: Control Center refused it on a flag it does not serve
 * (flag_not_served), its date passed after Control Center judged it
 * (date_passed_since), or the axes say otherwise (axes_disagree). Nothing is
 * held, hidden or changed. Pure.
 */
export function visibilityShadow({ context, canon = null, at }) {
  const rows = Array.isArray(context?.records?.visibility) ? context.records.visibility : [];
  const seen = new Set(), verdicts = [], differ = {}, apart = {};
  let agree = 0;
  for (const t of rows) {
    if (typeof t?.id !== 'string' || seen.has(t.id)) continue;
    seen.add(t.id);
    const mine = verdictFromAxes(t, at);
    const theirs = verdictOf(t);
    let code = null;
    if (!theirs) { code = 'not_judged'; bump(apart, code); }
    else if (theirs === mine.verdict) agree++;
    else {
      const dead = isDeadDate(t, at);
      code = theirs === 'rejected' && (mine.verdict === 'take' || mine.verdict === 'stretch') ? 'flag_not_served'
        : dead && mine.verdict === 'rejected' ? 'date_passed_since' : 'axes_disagree';
      bump(differ, code);
    }
    verdicts.push({ subject_ref: `target:${t.id}`, verdict: mine.verdict, reject_reason: mine.reject_reason, control_center: theirs, agrees: theirs ? theirs === mine.verdict : null, code });
  }
  const line = shadowLine('Visibility standard', ['stage', 'stages'], { read: seen.size, agree, differ, apart });
  return { verdicts, line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
