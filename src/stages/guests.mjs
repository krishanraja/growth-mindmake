import { lessons } from './rows.mjs';
// pitches.mjs reads this file's verdict too, so nothing from it is read while this module loads: SHOW_ORDER lives there.
import { SHOW_ORDER, SHOW_SHARES, inviteShow, inviteHold, invitedGuests } from './pitches.mjs';
import { shadowLine } from './visibility.mjs';

/**
 * Who is worth a seat on Krish's own shows (plan section 12, M3; Ruling,
 * Krish, 2026-10-27: Control Center "does not own the strategy for how to
 * grow mindmake as a business").
 *
 * Ported from Control Center, rule for rule:
 *   api/_guestStandard.ts          the guest standard: senior, seen online,
 *                                  worth hearing, as a conjunction (Ruling,
 *                                  Krish, 2026-10-20), and thin evidence as
 *                                  unjudged, never a zero
 *   api/discover-guest-scout.ts    standingFor (a past Signal & Noise guest is
 *                                  never the wrong show for Make Your Mind
 *                                  Up), the scout's per-show terms and
 *                                  queries, its candidate score, evidence
 *                                  first, and its slot and call budgets
 *   api/_judgmentLens.ts           lensFitScore and the lens's search queries
 *   api/_guestPath.ts              how Krish could reach a guest: warm, rich or
 *                                  none (KRISH.md Rule 2 as revised 2026-10-14)
 *   src/lib/shows.ts               quotaByShare and interleaveByShare: the
 *                                  70/30 split (Ruling, Krish, 2026-10-20)
 *   src/lib/approaches.ts          byStrength and rankApproaches: the order
 *                                  guests come forward in
 *   api/_approaches.ts             readGuests' gate (who is ready) and its
 *                                  counts, and guestApproach's path rule
 *
 * Reused from src/stages/pitches.mjs rather than restated: the two shows and
 * their shares (INVITE_SHOWS, SHOW_SHARES), the show's name as the canon
 * gives it (inviteShow), and the invite stage's own holds (inviteHold). Where
 * pitches.mjs already holds a rule Control Center also holds: the 70/30
 * shares (src/lib/shows.ts SHOWS), the verdicts that may be invited (take or
 * stretch, readGuests), a guest already invited (invite_state), and the
 * order within a show (take before stretch). Three differ, decided for
 * volume (Ruling, Krish, 2026-10-28: "I'd prefer volume right now"):
 * weeklyInvites rounds Make Your Mind Up's share up, where quotaByShare takes
 * the largest remainder (they part at 3 and 6 a week), and a show with no one
 * left to invite gives its room to the other inside the week's total;
 * the invite order breaks a tie on the guest score, then the contact id,
 * never a name; and a past Signal & Noise guest proposed onto Make Your Mind
 * Up (Control Center's first source for that show) may be invited, while
 * anyone recorded on the show he would be invited to is not.
 *
 * What stays in Control Center: collection (the scout's searches, its
 * research, the past-guest catalogue, the guests table) and the one model call
 * that judges a person (GUEST_JUDGMENT_FIELDS, GUEST_JUDGMENT_RULES, the
 * scout's system prompt and each show's mandate, which restate Mindmake's
 * shows in Control Center's own words and are not ported). The engine reads
 * each guest and its three axes from the context (records.guests) instead,
 * judges again here only from what is served, and the invite stage acts on
 * that verdict (guestVerdictOf); guestsShadow still counts it beside Control
 * Center's stored one while Control Center writes it.
 *
 * Pure: no model, no network, no clock but the run's.
 */

// ── The standard (api/_guestStandard.ts) ───────────────────────────────────

/** api/_guestStandard.ts GUEST_SCORE_VERSION. */
export const GUEST_SCORE_VERSION = 1;
/** api/_guestStandard.ts GUEST_WEIGHTS: the mix inside each axis. */
export const GUEST_WEIGHTS = Object.freeze({
  senior: Object.freeze({ authority: 0.6, building: 0.4 }),
  seen: Object.freeze({ presence: 0.65, appearances: 0.35 }),
  spark: Object.freeze({ positivity: 0.45, memorability: 0.55, vendorPenalty: -30 }),
});
/** api/_guestStandard.ts GUEST_FLOORS: all three at 60 is a take; senior and spark at 60 with seen at 40 is a stretch. */
export const GUEST_FLOORS = Object.freeze({ take: 60, stretchSeen: 40 });
/** api/_guestStandard.ts GuestRejectReason: the one taxonomy (src/lib/servedSurfaces.ts, guests). */
export const GUEST_REASONS = Object.freeze(['guest_not_senior', 'guest_not_visible', 'guest_boring', 'guest_wrong_show']);
/** The two shows a guest is judged for (src/lib/shows.ts SHOW_ORDER), from the invite stage's own registry (pitches.mjs). */
export { SHOW_ORDER };

/** api/_guestStandard.ts clamp. */
const clamp = n => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0);

/** api/_guestStandard.ts computeGuestAxes: the three axes and their minimum. Pure. */
export function computeGuestAxes(j) {
  const w = GUEST_WEIGHTS;
  const senior = clamp(clamp(j.decision_authority) * w.senior.authority + clamp(j.ai_building) * w.senior.building);
  const seen = clamp(clamp(j.online_presence) * w.seen.presence + clamp(j.appearances) * w.seen.appearances);
  const spark = clamp(clamp(j.positivity) * w.spark.positivity + clamp(j.memorability) * w.spark.memorability + (j.vendor_voice ? w.spark.vendorPenalty : 0));
  // The conjunction, never a mean.
  return { senior_score: senior, seen_score: seen, spark_score: spark, guest_score: Math.min(senior, seen, spark) };
}

/** The verdict on three axes: take, stretch, or a refusal named by the lowest axis (ties go senior, then seen, then spark). Pure. */
function verdictOnAxes(a) {
  if (a.guest_score >= GUEST_FLOORS.take) return { guest_verdict: 'take', guest_reason: null };
  if (a.senior_score >= GUEST_FLOORS.take && a.spark_score >= GUEST_FLOORS.take && a.seen_score >= GUEST_FLOORS.stretchSeen) return { guest_verdict: 'stretch', guest_reason: null };
  const lowest = Math.min(a.senior_score, a.seen_score, a.spark_score);
  return { guest_verdict: 'rejected', guest_reason: a.senior_score === lowest ? 'guest_not_senior' : a.seen_score === lowest ? 'guest_not_visible' : 'guest_boring' };
}

const UNJUDGED = Object.freeze({ senior_score: null, seen_score: null, spark_score: null, guest_score: null, guest_verdict: 'unjudged', guest_reason: null });

/** api/_guestStandard.ts guestStanding: thin is unjudged with no numbers; the wrong show is its own refusal; else the axes decide. Pure. */
export function guestStanding(j) {
  if (!j || j.evidence_thin) return { ...UNJUDGED };
  const a = computeGuestAxes(j);
  if (j.show_fit === 'neither') return { ...a, guest_verdict: 'rejected', guest_reason: 'guest_wrong_show' };
  return { ...a, ...verdictOnAxes(a) };
}

const IDENTITY_KEYS = ['decision_authority', 'ai_building', 'positivity', 'memorability'];
const SEEN_KEYS = ['online_presence', 'appearances'];
const numOf = (r, k) => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? r[k] : null);

/** api/_guestStandard.ts thinCause: why a reply is thin (the judge said so, or a number it needs is missing), or null. Pure. */
export function thinCause(raw) {
  if (!raw || typeof raw !== 'object') return 'no_reply';
  if (raw.evidence_thin === true) return 'model';
  const missing = IDENTITY_KEYS.find(k => numOf(raw, k) === null);
  return missing ? `missing:${missing}` : null;
}

/** api/_guestStandard.ts parseGuestJudgment: a missing presence number is 0, since not found is not visible (Ruling, Krish, 2026-10-21). Pure. */
export function parseGuestJudgment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fit = raw.show_fit === 'makeyourmindup' || raw.show_fit === 'signal_noise' ? raw.show_fit : 'neither';
  const [presence, appearances] = SEEN_KEYS.map(k => numOf(raw, k));
  return {
    decision_authority: numOf(raw, 'decision_authority') ?? 0,
    ai_building: numOf(raw, 'ai_building') ?? 0,
    online_presence: presence ?? 0,
    appearances: appearances ?? 0,
    positivity: numOf(raw, 'positivity') ?? 0,
    memorability: numOf(raw, 'memorability') ?? 0,
    vendor_voice: raw.vendor_voice === true,
    show_fit: fit,
    show_reason: typeof raw.show_reason === 'string' ? raw.show_reason.slice(0, 300) : '',
    evidence_thin: thinCause(raw) !== null,
  };
}

/**
 * api/discover-guest-scout.ts standingFor: a past Signal & Noise guest is put
 * onto the show being judged, whatever the judge thought suits them; anyone
 * else the judge placed on the other show is wrong for this one. Thin stays
 * unjudged. Pure.
 */
export function standingFor(parsed, pastGuest, show) {
  const judgment = parsed && pastGuest ? { ...parsed, show_fit: show } : parsed;
  const base = guestStanding(judgment);
  return judgment && base.guest_verdict !== 'unjudged' && judgment.show_fit !== 'neither' && judgment.show_fit !== show
    ? { ...base, guest_verdict: 'rejected', guest_reason: 'guest_wrong_show' }
    : base;
}

/** The standard on a stored row's three axes, when the context serves them; null when it does not. Wrong show is not derivable from axes. Pure. */
export function standingFromAxes(g) {
  if (!g || !['senior_score', 'seen_score', 'spark_score'].every(k => k in g)) return null;
  const vals = [g.senior_score, g.seen_score, g.spark_score];
  if (vals.every(v => v === null || v === undefined)) return { ...UNJUDGED };
  if (!vals.every(v => typeof v === 'number' && Number.isFinite(v))) return null;
  const a = { senior_score: clamp(g.senior_score), seen_score: clamp(g.seen_score), spark_score: clamp(g.spark_score) };
  a.guest_score = Math.min(a.senior_score, a.seen_score, a.spark_score);
  return { ...a, ...verdictOnAxes(a) };
}

/**
 * The engine's own verdict on a guest, the one the invite stage acts on
 * (plan section 12, M3, "the engine's version acts"): the standard on the
 * three axes Control Center serves (standingFromAxes). Axes not served, or
 * none judged, read as unjudged, which is how a guest Control Center had
 * not judged was treated: never invited. Control Center's own guest_verdict
 * is never read here, so it never decides. The wrong show is not derivable
 * from the axes, so a guest refused only for that reads on its axes. Pure.
 */
export const guestVerdictOf = g => standingFromAxes(g)?.guest_verdict ?? 'unjudged';

/** The engine's own strength for a guest: the least of the three axes it computes, or -1 when they are not served. Pure. */
export const guestStrength = g => standingFromAxes(g)?.guest_score ?? -1;

// ── The shows' shares (src/lib/shows.ts) ────────────────────────────────────

/** src/lib/shows.ts quotaByShare: how many of `total` slots each show gets, by share, largest remainder. Shares are in percent, as the week spec carries them. Pure. */
export function quotaByShare(total, shares = SHOW_SHARES) {
  const n = Math.max(0, Math.floor(total));
  const raw = SHOW_ORDER.map(s => ({ s, exact: n * (shares[s] ?? 0) / 100 }));
  const out = Object.fromEntries(raw.map(r => [r.s, Math.floor(r.exact)]));
  let left = n - raw.reduce((a, r) => a + Math.floor(r.exact), 0);
  const byRemainder = [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1) || (shares[b.s] ?? 0) - (shares[a.s] ?? 0));
  for (const r of byRemainder) { if (left <= 0) break; out[r.s] += 1; left -= 1; }
  return out;
}

/**
 * src/lib/shows.ts interleaveByShare: a weighted round robin over rows already
 * ranked within each show, the show furthest behind its share next, so any
 * prefix is as near 70/30 as whole rows allow. A show that runs dry is named
 * in `short`; rows with no show go last. Pure.
 */
export function interleaveByShare(rows, showOf, shares = SHOW_SHARES) {
  const queues = Object.fromEntries(SHOW_ORDER.map(s => [s, []]));
  const rest = [];
  for (const r of rows) { const s = showOf(r); if (Object.hasOwn(queues, s)) queues[s].push(r); else rest.push(r); }
  const taken = Object.fromEntries(SHOW_ORDER.map(s => [s, 0]));
  const out = [], short = new Set();
  const total = SHOW_ORDER.reduce((a, s) => a + queues[s].length, 0);
  for (let i = 0; i < total; i++) {
    const step = out.length + 1;
    const ranked = [...SHOW_ORDER].sort((a, b) => (step * (shares[b] ?? 0) / 100 - taken[b]) - (step * (shares[a] ?? 0) / 100 - taken[a]));
    let pick = null;
    for (const s of ranked) { if (taken[s] < queues[s].length) { pick = s; break; } short.add(s); }
    if (!pick) break;
    out.push(queues[pick][taken[pick]]);
    taken[pick] += 1;
  }
  return { rows: [...out, ...rest], short: SHOW_ORDER.filter(s => short.has(s)) };
}

// ── The queue (src/lib/approaches.ts, api/_approaches.ts) ──────────────────

const VERDICT_RANK = { take: 0, stretch: 1 };
/** A guest's score as readGuests ranks it: the guest score, else the older fit score, else 0. */
const scoreOf = g => (typeof g?.guest_score === 'number' ? g.guest_score : typeof g?.fit_score === 'number' ? g.fit_score : 0);

/** src/lib/approaches.ts byStrength: takes before stretches, then the score, then the name. */
export function byStrength(a, b) {
  return (VERDICT_RANK[a.guest_verdict] ?? 2) - (VERDICT_RANK[b.guest_verdict] ?? 2) || scoreOf(b) - scoreOf(a) || String(a.name ?? '').localeCompare(String(b.name ?? ''));
}

/** api/_approaches.ts readGuests: a guest proposed for one of his shows that the standard took or marked a stretch, not buried. Pure. */
export const guestReady = g => g?.invite_state === 'proposed' && (g.guest_verdict === 'take' || g.guest_verdict === 'stretch') && !g.buried_at && SHOW_ORDER.includes(g.invite_show) && typeof g.name === 'string' && g.name.trim() !== '';

/** src/lib/approaches.ts rankApproaches for guests: ranked within each show, then interleaved by the shows' shares. Pure. */
export function rankGuests(list, shares = SHOW_SHARES) {
  return interleaveByShare([...list].sort(byStrength), g => g.invite_show, shares);
}

/** api/_approaches.ts readGuests' counts: ready, not yet judged (an open row with no verdict), and refused. Pure. */
export function guestCounts(guests) {
  const live = (Array.isArray(guests) ? guests : []).filter(g => g && !g.buried_at);
  return {
    ready: live.filter(guestReady).length,
    unjudged: live.filter(g => (g.guest_verdict === null || g.guest_verdict === undefined) && ['scouted', 'enriched'].includes(g.status)).length,
    refused: live.filter(g => g.guest_verdict === 'rejected').length,
  };
}

/** api/_approaches.ts guestApproach: a recorded or published guest proposed onto the other show is a past guest; else warm, rich or none. Pure. */
export function approachPath(g) {
  if (['recorded', 'published'].includes(String(g?.status)) && g.podcast_target !== g.invite_show) return 'past_guest';
  const raw = String(g?.raw_data?.path ?? '');
  return raw === 'rich' ? 'rich' : raw === 'warm' || g?.in_network ? 'warm' : 'none';
}

// ── How Krish could reach them (api/_guestPath.ts) ─────────────────────────

/** api/_strategist.ts WARM_TIERS, the tiers the context names as relationship_warm (network_definitions); read from the context when it serves them. */
export const WARM_TIERS = Object.freeze(['1_reciprocated', '2_core_network', '3_known_network']);
/** api/_guestPath.ts RICH_MIN_SOURCES: a stranger with two sourced pages and a known company is rich. */
export const RICH_MIN_SOURCES = 2;

/** api/_guestPath.ts guestPath: a past guest is warm; a contact on a warm tier is warm; two sourced pages and a company is rich; else none. Pure. */
export function guestPath(c, warmTiers = WARM_TIERS) {
  if (c?.pastGuest === true) return 'warm';
  const hasContact = typeof c?.contactId === 'string' && c.contactId.trim() !== '';
  const warmTier = typeof c?.networkTier === 'string' && warmTiers.includes(c.networkTier);
  if (hasContact && warmTier) return 'warm';
  const sourced = new Set((c?.evidence ?? []).map(e => (e?.url || '').trim()).filter(Boolean));
  const company = typeof c?.company === 'string' && c.company.trim() !== '';
  return company && sourced.size >= RICH_MIN_SOURCES ? 'rich' : 'none';
}
/** api/_guestPath.ts mayDraftPitch and mayStoreGuest: warm or rich only. */
export const mayDraftPitch = path => path === 'warm' || path === 'rich';
export const mayStoreGuest = path => path === 'warm' || path === 'rich';
/** api/_guestPath.ts mayStoreRow: a rich stranger is stored only with its drafted note. */
export const mayStoreRow = (path, pitch) => path === 'warm' || (path === 'rich' && typeof pitch === 'string' && pitch.trim() !== '');

// ── The scout's ranking and search terms (api/discover-guest-scout.ts, api/_judgmentLens.ts) ──

/** api/discover-guest-scout.ts MAX_WRITE_PER_RUN, RANKED_PER_SLOT and MAX_JUDGE_CALLS. */
export const MAX_WRITE_PER_RUN = 10;
export const RANKED_PER_SLOT = 4;
export const MAX_JUDGE_CALLS = 40;

/** api/_judgmentLens.ts CORE_TERMS (counted twice) and SUPPORT_TERMS: the on-direction words. */
export const LENS_CORE_TERMS = Object.freeze([
  'judgment', 'judgement', 'taste', 'moat', 'clone', 'cloned', 'commoditi',
  'execution', 'orchestrat', 'model routing', 'evals', 'eval ', 'verification',
  'credibility', 'coordination', 'non-linear', 'nonlinear', 'say-do', 'say/do',
  'context layer', 'agentic', 'leverage',
]);
export const LENS_SUPPORT_TERMS = Object.freeze([
  'easy button', 'one prompt', 'hype', 'proof', 'shipped', 'deployment', 'in production',
  'tradeoff', 'trade-off', 'distribution', 'headcount', 'reskill', 'adoption', 'autonomy',
  'friction', 'workflow', 'fractional', 'reinvent', 'portfolio', 'community', 'attention',
  'wetware', 'expertise', 'middle managers', 'real deployment', 'roi', 'switching cost',
]);
const LENS_SATURATION = 5;

/** api/_judgmentLens.ts lensFitScore: how squarely a text sits in the lens's direction, 0 to 1. Pure. */
export function lensFitScore(text) {
  if (!text) return 0;
  const t = String(text).toLowerCase();
  let hits = 0;
  for (const term of LENS_CORE_TERMS) if (t.includes(term)) hits += 2;
  for (const term of LENS_SUPPORT_TERMS) if (t.includes(term)) hits += 1;
  return hits >= LENS_SATURATION ? 1 : hits / LENS_SATURATION;
}

/** api/_judgmentLens.ts isOnDirection: clears 0.4, about two core terms. Pure. */
export const isOnDirection = (text, threshold = 0.4) => lensFitScore(text) >= threshold;

/** api/discover-guest-scout.ts MYMU_TERMS and SN_TERMS: the words that mark a candidate as right for each show. */
export const SHOW_TERMS = Object.freeze({
  makeyourmindup: Object.freeze([
    'ceo', 'founder', 'chief', 'president', 'board', 'decided', 'decision', 'strategy', 'transformation',
    'built', 'shipped', 'launched', 'scaled', 'agents', 'ai-native', 'rebuilt', 'operating model',
    'keynote', 'podcast', 'interview', 'newsletter', 'followers', 'author',
  ]),
  signal_noise: Object.freeze([
    'media', 'advertising', 'adtech', 'publisher', 'publishing', 'agency', 'brand', 'marketing',
    'go-to-market', 'gtm', 'revenue', 'sales', 'growth', 'audience', 'measurement', 'ctv', 'creator',
    'cmo', 'cro', 'chief growth', 'commercial',
  ]),
});

/** api/discover-guest-scout.ts showFit: 60 percent the show's own words (four hits saturate), 40 percent the lens. Pure. */
export function showFit(text, show) {
  const t = String(text || '').toLowerCase();
  let hits = 0;
  for (const term of SHOW_TERMS[show] ?? []) if (t.includes(term)) hits += 1;
  return 0.6 * Math.min(1, hits / 4) + 0.4 * lensFitScore(text);
}

/**
 * api/discover-guest-scout.ts, its ranking: 55 percent show fit, 33 percent
 * the source's own score, and a bounded advantage for a past guest (0.2) or
 * someone in his network (0.12), capped at 1. Pure.
 */
export function scoutScore(c, show) {
  const fit = showFit(`${c.name} ${c.title || ''} ${c.company || ''} ${c.context || ''}`, show);
  const reach = c.pastGuestId ? 0.2 : c.inNetwork ? 0.12 : 0;
  return Math.min(1, 0.55 * fit + 0.33 * (Number.isFinite(c.sourceScore) ? c.sourceScore : 0) + reach);
}

/** api/discover-guest-scout.ts evidenceFirst: people with something on record first, then by score. Pure. */
export function evidenceFirst(rows, evidenced) {
  return [...rows].sort((a, b) => Number(evidenced(b.c)) - Number(evidenced(a.c)) || b.score - a.score);
}

/** api/discover-guest-scout.ts, a show's share of the run's model calls: 28 and 12 of 40. Pure. */
export const callBudget = slots => Math.max(1, Math.round((MAX_JUDGE_CALLS * slots) / MAX_WRITE_PER_RUN));

/**
 * The scout's search terms for each show, as research the engine can ask
 * Control Center to run (api/discover-guest-scout.ts loadBriefs, and
 * api/_judgmentLens.ts lensThemeQueries). The show's name is the canon's
 * (inviteShow). `current` is the titles of the shifts Control Center holds
 * now, passed in when it serves them, never written here. The question and
 * the mandate each show's prompt carries stay with Control Center's judge.
 * Pure.
 */
export function scoutTerms(canon, current = []) {
  const now = (Array.isArray(current) ? current : []).filter(t => typeof t === 'string' && t.trim()).slice(0, 2);
  return [
    {
      show: 'makeyourmindup', label: canon ? inviteShow('makeyourmindup', canon).name : null, past_guests: true,
      web_queries: [
        'senior executives publicly explaining a major AI decision they made for their company, named with company and date',
        'founders building AI-native companies who post widely read, positive, specific takes on what AI changes',
        ...now.map(t => `the senior leaders making the decisions in this shift: ${t}. Name the people, not the analysts.`),
      ],
      keywords: ['AI strategy CEO', 'building with AI founder', 'AI transformation decision', 'AI native company'],
      terms: [...SHOW_TERMS.makeyourmindup],
    },
    {
      show: 'signal_noise', label: inviteShow('signal_noise', canon).name, past_guests: false,
      web_queries: [
        'media and advertising executives describing how AI changed their go-to-market, named with company',
        'chief marketing or revenue officers with specific public results from using AI, named',
      ],
      keywords: ['AI advertising', 'AI media', 'AI go-to-market', 'AI marketing leader'],
      terms: [...SHOW_TERMS.signal_noise],
    },
    {
      show: null, label: null, past_guests: false,
      web_queries: [
        'AI killed the software moat - judgment and taste as the new advantage',
        'leaders monetizing judgment and expertise in the AI economy',
        'most of AI transformation is human: process, adoption, orchestration, evals',
        'when coordination gets cheap the moat moves to owning the context layer',
        'non-linear careers reinventing around AI - operators who capitalise on judgment',
        'model routing and token cost as the applied-AI differentiator',
      ],
      keywords: [], terms: [],
    },
  ];
}

// ── In shadow, beside Control Center's own verdicts ───────────────────────

const VERDICTS = new Set(['take', 'stretch', 'rejected', 'unjudged']);
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * The guest standard in shadow. For every guest the context serves, the
 * engine's verdict on the three axes when Control Center serves them
 * (standingFromAxes) beside its stored guest_verdict, and one activity line
 * in counts. Control Center serves the verdict but not the axes today, so
 * those are counted not comparable (axes_not_served). Where they differ: a
 * refusal the axes would take is the show fit, which is not served
 * (show_fit_not_served); anything else is axes_disagree. The line also
 * counts Control Center's queue (readGuests' gate, by show) and how many of
 * those the invite stage would hold today, by inviteHold's code. Nothing is
 * held, hidden or changed. Pure.
 */
export function guestsShadow({ context, canon = null, at }) {
  const guests = Array.isArray(context?.records?.guests) ? context.records.guests : [];
  const seen = new Set(), rows = [];
  for (const g of guests) {
    const key = typeof g?.contact_id === 'string' ? `contact:${g.contact_id}` : typeof g?.id === 'string' ? `guest:${g.id}` : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ g, key });
  }
  const verdicts = [], differ = {}, apart = {};
  let agree = 0;
  for (const { g, key } of rows) {
    const theirs = VERDICTS.has(g.guest_verdict) ? g.guest_verdict : null;
    const mine = standingFromAxes(g);
    let code = null;
    if (!theirs) { code = 'not_judged'; bump(apart, code); }
    else if (!mine) { code = 'axes_not_served'; bump(apart, code); }
    else if (mine.guest_verdict === theirs) agree++;
    else { code = theirs === 'rejected' && (mine.guest_verdict === 'take' || mine.guest_verdict === 'stretch') ? 'show_fit_not_served' : 'axes_disagree'; bump(differ, code); }
    verdicts.push({ subject_ref: key, verdict: mine?.guest_verdict ?? null, guest_reason: mine?.guest_reason ?? null, control_center: theirs, agrees: theirs && mine ? mine.guest_verdict === theirs : null, code });
  }
  // Control Center's queue, and what the invite stage would do with it today.
  const ready = rows.map(r => r.g).filter(guestReady);
  const queue = rankGuests(ready).rows;
  const L = lessons(context?.feedback, at), invited = invitedGuests(context), routes = context?.routes ?? {};
  const held = {};
  for (const g of ready) { const why = inviteHold(g, { L, invited, routes, at }); if (why) bump(held, why); }
  const byShow = Object.fromEntries(SHOW_ORDER.map(s => [s, ready.filter(g => g.invite_show === s).length]));
  const heldN = Object.values(held).reduce((s, n) => s + n, 0);
  const codes = o => Object.entries(o).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(', ');
  const tail = ` Control Center's queue: ${ready.length} ready${ready.length ? ` (${codes(byShow)})` : ''}; the invite stage would hold ${heldN} of them${heldN ? ` (${codes(held)})` : ''}.`;
  const line = shadowLine('Guest standard', ['guest', 'guests'], { read: rows.length, agree, differ, apart }) + tail;
  return { verdicts, queue: queue.map(g => (typeof g.contact_id === 'string' ? `contact:${g.contact_id}` : `guest:${g.id}`)), counts: guestCounts(rows.map(r => r.g)), line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
