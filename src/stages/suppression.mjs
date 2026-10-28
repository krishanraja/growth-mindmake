import { DAY } from '../guards.mjs';
import { ROWS, KINDS, BANDS, ASK_FOR, ROW_FOR, TITLE_MAX, BECAUSE_MAX, TITLE_MAX_BRIEF, CARD_LINES, CARD_SOURCES, CARD_ANGLE_TITLE_MAX, lessons, refusedBy } from './rows.mjs';
import { shadowLine } from './visibility.mjs';

/**
 * The amplifier taxonomy, the row doctrine and the suppression of what Krish
 * said No to, owned here (plan section 12, M10; Ruling, Krish, 2026-10-27:
 * Control Center "does not own the strategy for how to grow mindmake as a
 * business").
 *
 * The engine already holds all three in the rows stage (src/stages/rows.mjs):
 * ROWS, KINDS, BANDS, ASK_FOR and ROW_FOR are the taxonomy, its title, line
 * and card bounds are the doctrine, and `lessons` with `refusedBy` is the
 * suppression of every No and its reason. Control Center keeps copies:
 *   src/lib/growthEngines.ts   REACH_ROWS, AMPLIFIER_KINDS, REACH_BANDS,
 *                              DECLINE_REASONS and CARRIED_OUT (the taxonomy),
 *                              and ROWS_RULE (the doctrine, sent to the engine
 *                              in every directive as `rows_rule`, which the
 *                              dispatch reads as data only: a digest and a
 *                              length, never its words)
 *   src/lib/widgetPlays.ts     answeredLike, its copy of the suppression rules,
 *                              applied to the widget's rows between the
 *                              engine's runs
 *   api/_rowPress.ts           rowAnswers and featuresOf, how it reads his
 *                              answers for answeredLike (the newest 500, a row
 *                              and a date required, a carried out press only
 *                              when it drafted or opened a message)
 * This file gives the engine's side of the move: the taxonomy and doctrine as
 * one object it can send (`taxonomy`), the suppression as a list Control
 * Center can apply with schema checks only (`suppressionList` and
 * `suppressionApplies`), and a shadow that runs Control Center's copy beside
 * the engine's rule on the same answers and names every difference by code.
 *
 * `controlCenterAnsweredLike` and `controlCenterAnswers` are Control Center's
 * rules ported only so the shadow can say where the two disagree. They decide
 * nothing in the engine and go when Control Center's copy is retired.
 *
 * The report schema is frozen here: the list is specified, not sent, in
 * docs/CONTROL-CENTER-BRIEF.md "Still owed".
 *
 * Pure: no model, no network, no clock but the run's.
 */

/** The reasons a No may carry, the engine's own (Control Center's DECLINE_REASONS copies them). */
export const REASONS = Object.freeze(['wrong_person', 'not_now', 'already_in_touch', 'too_small', 'wrong_audience', 'not_my_topic', 'pitch_off', 'other']);
/** How he may carry out a row action on his widget (Control Center's CARRIED_OUT). */
export const CARRIED = Object.freeze(['draft', 'message', 'submit']);
/** The version of the taxonomy and doctrine below; it moves when either does. */
export const TAXONOMY_VERSION = 1;
/** The row doctrine's bounds, from the rows stage's own constants, never restated. */
export const ROW_DOCTRINE = Object.freeze({
  title_max: TITLE_MAX,
  because_max: BECAUSE_MAX,
  title_max_with_because: TITLE_MAX_BRIEF,
  brief_lines: Object.freeze({ min: 2, max: 6 }),
  card_lines: Object.freeze({ min: 1, max: CARD_LINES }),
  card_sources_max: CARD_SOURCES,
  angle_title_max: CARD_ANGLE_TITLE_MAX,
});

/** The taxonomy and the doctrine, as the engine would send them: names and bounds only. Pure. */
export function taxonomy() {
  return {
    version: TAXONOMY_VERSION,
    rows: [...ROWS], kinds: [...KINDS], bands: [...BANDS], reasons: [...REASONS], carried_out: [...CARRIED],
    ask_for: { ...ASK_FOR }, row_for: { ...ROW_FOR }, doctrine: structuredClone(ROW_DOCTRINE),
  };
}

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Where a copy of the taxonomy (Control Center's lists and ROWS_RULE's
 * numbers) differs from the engine's, as codes. `copy` is { rows, kinds,
 * bands, reasons, carried_out, doctrine }; a part it leaves out is not
 * compared. Pure.
 */
export function taxonomyFindings(copy) {
  if (!copy || typeof copy !== 'object') return ['taxonomy_not_served'];
  const mine = taxonomy(), out = [];
  for (const k of ['rows', 'kinds', 'bands', 'reasons', 'carried_out']) if (copy[k] !== undefined && !sameList(copy[k], mine[k])) out.push(`${k}_differ`);
  const d = copy.doctrine;
  if (d && typeof d === 'object') {
    for (const k of ['title_max', 'because_max', 'title_max_with_because', 'card_sources_max', 'angle_title_max']) if (d[k] !== undefined && d[k] !== mine.doctrine[k]) out.push(`${k}_differs`);
    for (const k of ['brief_lines', 'card_lines']) if (d[k] !== undefined && (d[k]?.min !== mine.doctrine[k].min || d[k]?.max !== mine.doctrine[k].max)) out.push(`${k}_differ`);
  }
  return out;
}

// ── Control Center's copy, for the shadow only ─────────────────────────────

/** api/_rowPress.ts ANSWERS_READ: Control Center reads only his newest answers. */
export const CC_ANSWERS_READ = 500;
/** src/lib/widgetPlays.ts PAUSE_MS: a not now, or a press, pauses a person this long. */
export const PAUSE_DAYS = 30;
const CC_BAND_ORDER = Object.freeze({ unknown: 0, under_1k: 1, '1k_10k': 2, '10k_100k': 3, '100k_1m': 4, over_1m: 5 });
const word = x => (typeof x === 'string' && x ? x : null);

/**
 * api/_rowPress.ts rowAnswers and featuresOf, on the context's `feedback`:
 * declined, approved or done only, with a row and a date; a No with its
 * reason, or a press that drafted or opened a message (a form's submit is
 * not); the kind, sector, topic and band read defensively; newest first, at
 * most CC_ANSWERS_READ. Pure.
 */
export function controlCenterAnswers(feedback) {
  const out = [];
  for (const f of Array.isArray(feedback) ? feedback : []) {
    if (!['declined', 'approved', 'done'].includes(f?.state)) continue;
    if (!ROWS.includes(f.row) || typeof f.decided_at !== 'string') continue;
    const declined = f.state === 'declined';
    const carried = !declined && (f.carried_out === 'draft' || f.carried_out === 'message');
    if (!declined && !carried) continue;
    const feats = f.features && typeof f.features === 'object' ? f.features : {};
    out.push({
      row: f.row, subject: word(f.subject_ref), declined, carried,
      reason: REASONS.includes(f.reason_code) ? f.reason_code : null,
      kind: KINDS.includes(f.amplifier_kind) ? f.amplifier_kind : null,
      sector: word(feats.sector), topic: word(feats.topic),
      band: BANDS.includes(f.reach?.band) ? f.reach.band : 'unknown',
      decided_at: f.decided_at,
    });
  }
  return out.sort((a, b) => b.decided_at.localeCompare(a.decided_at)).slice(0, CC_ANSWERS_READ);
}

/** src/lib/widgetPlays.ts answeredLike, rule for rule: why a candidate is like an answer he gave, or null. Pure. */
export function controlCenterAnsweredLike(c, answers, at) {
  let why = null;
  const set = w => { if (why === null) why = w; };
  const now = Date.parse(at);
  for (const a of answers) {
    const same = !!c.subject && a.subject === c.subject;
    const paused = Date.parse(a.decided_at) + PAUSE_DAYS * DAY > now;
    if (a.carried && same && paused) set('snoozed');
    if (!a.declined) continue;
    if (same && (a.reason === 'wrong_person' || a.reason === 'already_in_touch')) return 'declined_person';
    if (same && a.row === c.row) return 'declined_on_row';
    if (same && a.reason === 'not_now' && paused) set('snoozed');
    const kind = c.kind ?? null;
    if (a.reason === 'too_small' && kind && a.kind === kind && CC_BAND_ORDER[c.band ?? 'unknown'] <= CC_BAND_ORDER[a.band]) set('below_reach_floor');
    if (a.reason === 'wrong_audience' && kind && a.kind === kind && (a.sector === null || a.sector === (c.sector ?? null))) set('wrong_audience');
    if (a.reason === 'not_my_topic' && a.topic && a.topic === (c.topic ?? null)) set('not_my_topic');
  }
  return why;
}

// ── The engine's rule, and the list it would send ──────────────────────────

/** The engine's own answer on a candidate { row, subject, kind, sector, topic, band }: rows.mjs refusedBy over lessons. Pure. */
export function engineAnsweredLike(c, feedback, at) {
  return refusedBy(lessons(feedback, at), c, at);
}

/** The most entries in each part of the list, and the longest subject it carries. */
export const SUPPRESSION_MAX = 500;
const SUBJECT = /^[a-z_]{2,20}:[A-Za-z0-9._:-]{1,120}$/;

/**
 * The engine's suppression as the list Control Center would apply between
 * runs with schema checks only: whom never to show, whom never on a row, who
 * is paused and until when, the reach floor of each kind, the audiences and
 * the topics ruled out. Subjects are references, never names or addresses;
 * each part is sorted and at most SUPPRESSION_MAX. Pure.
 */
export function suppressionList(feedback, at) {
  const L = lessons(feedback, at), cap = list => list.slice(0, SUPPRESSION_MAX);
  const subj = s => typeof s === 'string' && SUBJECT.test(s);
  return {
    version: 1,
    as_of: new Date(Date.parse(at)).toISOString(),
    never: cap([...L.never].filter(subj).sort()),
    not_on_row: cap([...L.notOnRow].map(k => { const i = k.indexOf('|'); return { row: k.slice(0, i), subject_ref: k.slice(i + 1) }; })
      .filter(x => ROWS.includes(x.row) && subj(x.subject_ref)).sort((a, b) => a.row.localeCompare(b.row) || a.subject_ref.localeCompare(b.subject_ref))),
    paused: cap([...L.until].filter(([s]) => subj(s)).map(([s, t]) => ({ subject_ref: s, until: new Date(t).toISOString() })).sort((a, b) => a.subject_ref.localeCompare(b.subject_ref))),
    // A kind's floor n holds every band whose order is under n: the highest band it holds is the one at n - 1.
    reach_floor: cap([...L.floor].filter(([k, n]) => KINDS.includes(k) && n > 0).map(([kind, n]) => ({ kind, at_or_below: BANDS.find(b => ORDER_OF[b] === Math.min(n, 6) - 1) ?? 'over_1m' })).sort((a, b) => a.kind.localeCompare(b.kind))),
    audiences: cap([...L.audiences].map(k => { const i = k.indexOf('|'); const sector = k.slice(i + 1); return { kind: k.slice(0, i), sector: sector === 'null' ? null : sector }; })
      .filter(x => KINDS.includes(x.kind)).sort((a, b) => a.kind.localeCompare(b.kind) || String(a.sector).localeCompare(String(b.sector)))),
    topics: cap([...L.topics].filter(t => typeof t === 'string' && t).sort()),
  };
}
const ORDER_OF = Object.freeze({ unknown: 0, under_1k: 1, '1k_10k': 2, '10k_100k': 3, '100k_1m': 4, over_1m: 5 });

/**
 * How Control Center would apply the list, with no rule of its own: the
 * engine's refusedBy over the list instead of over his answers. The parity
 * test proves it decides what the engine decides. Pure.
 */
export function suppressionApplies(list, c, at) {
  if (!list || list.version !== 1) return null;
  const s = c?.subject ?? null;
  if (s && list.never.includes(s)) return 'declined_person';
  if (s && list.not_on_row.some(x => x.row === c.row && x.subject_ref === s)) return 'declined_on_row';
  if (s && list.paused.some(x => x.subject_ref === s && Date.parse(x.until) > Date.parse(at))) return 'snoozed';
  const floor = c?.kind ? list.reach_floor.find(x => x.kind === c.kind) : null;
  if (floor && ORDER_OF[c.band] <= ORDER_OF[floor.at_or_below]) return 'below_reach_floor';
  if (c?.kind && list.audiences.some(x => x.kind === c.kind && (x.sector === null || x.sector === (c.sector === undefined ? 'undefined' : c.sector)))) return 'wrong_audience';
  if (c?.topic && list.topics.includes(c.topic)) return 'not_my_topic';
  return null;
}

// ── Every difference, named ────────────────────────────────────────────────

/**
 * The ways Control Center's copy reads his answers differently from the
 * engine, each a step that rewrites the engine's input the way Control
 * Center reads it. Applied in order until the two agree, the first that
 * makes them agree names the difference:
 *   undated_answer       an answer with no date: Control Center drops it; the
 *                        engine applies it, and pauses from the run's time
 *   answer_without_row   an answer whose proposal had no row: Control Center
 *                        drops it; the engine still applies its person and
 *                        kind rules
 *   carried_state        a press Control Center does not count as carried
 *                        out (a submit, or on a row that is not approved or
 *                        done): the engine pauses the person 30 days anyway
 *   unknown_kind         a kind outside the taxonomy: Control Center reads it
 *                        as none, the engine applies its floor and audience
 *   blank_sector         an empty sector: Control Center reads it as none (any
 *                        sector), the engine as the empty sector only
 *   answers_beyond_cap   an answer older than Control Center's newest 500
 *   band_missing         a candidate with no band: Control Center reads it as
 *                        unknown (the lowest), the engine applies no floor
 * The decision can agree while the reason differs, because Control Center
 * takes the first answer that matches and the engine its fixed order:
 * reason_named_otherwise, counted apart, never a disagreement.
 */
export const DIFFERENCES = Object.freeze(['undated_answer', 'answer_without_row', 'carried_state', 'unknown_kind', 'blank_sector', 'answers_beyond_cap', 'band_missing']);

const STEPS = [
  ['undated_answer', fb => fb.filter(f => typeof f?.decided_at === 'string')],
  ['answer_without_row', fb => fb.filter(f => ROWS.includes(f?.row))],
  ['carried_state', fb => fb.filter(f => f?.state === 'declined' || (['approved', 'done'].includes(f?.state) && (f.carried_out === 'draft' || f.carried_out === 'message'))).map(f => f.state === 'declined' ? { ...f, carried_out: null } : f)],
  ['unknown_kind', fb => fb.map(f => KINDS.includes(f?.amplifier_kind) ? f : { ...f, amplifier_kind: null })],
  ['blank_sector', fb => fb.map(f => (f?.features && typeof f.features === 'object') ? { ...f, features: { ...f.features, sector: word(f.features.sector), topic: word(f.features.topic) } } : f)],
  ['answers_beyond_cap', fb => [...fb].sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at))).slice(0, CC_ANSWERS_READ)],
];

/** One candidate judged both ways: { cc, engine, agrees, code }. code names the difference, or reason_named_otherwise, or null. Pure. */
export function compareSuppression(c, feedback, at) {
  const fb = Array.isArray(feedback) ? feedback.filter(f => f && typeof f === 'object') : [];
  const cc = controlCenterAnsweredLike(c, controlCenterAnswers(fb), at);
  const engine = engineAnsweredLike(c, fb, at);
  if ((cc === null) === (engine === null)) return { cc, engine, agrees: true, code: cc !== engine ? 'reason_named_otherwise' : null };
  let read = fb;
  for (const [code, step] of STEPS) {
    read = step(read);
    if ((engineAnsweredLike(c, read, at) === null) === (cc === null)) return { cc, engine, agrees: false, code };
  }
  if ((engineAnsweredLike({ ...c, band: c.band ?? 'unknown' }, read, at) === null) === (cc === null)) return { cc, engine, agrees: false, code: 'band_missing' };
  return { cc, engine, agrees: false, code: 'rule_differs' };
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * Suppression in shadow. Every answer the context serves is offered back on
 * each of the five rows with its own kind, sector, topic and band, and judged
 * by Control Center's answeredLike and by the engine's rule. The line counts
 * the checks, where the two agree, every difference by code, and the size of
 * the list the engine would send. Nothing is held, hidden or changed. Pure.
 */
export function suppressionShadow({ context, canon = null, at }) {
  const feedback = Array.isArray(context?.feedback) ? context.feedback.filter(f => f && typeof f === 'object') : [];
  const seen = new Set(), checks = [];
  for (const f of feedback) {
    const subject = word(f.subject_ref);
    if (!subject) continue;
    const feats = f.features && typeof f.features === 'object' ? f.features : {};
    for (const row of ROWS) {
      const c = { row, subject, kind: f.amplifier_kind ?? null, sector: feats.sector ?? null, topic: feats.topic ?? null, band: BANDS.includes(f.reach?.band) ? f.reach.band : 'unknown' };
      const key = JSON.stringify(c);
      if (seen.has(key)) continue;
      seen.add(key);
      checks.push(c);
    }
  }
  const differ = {}, named = {};
  let agree = 0;
  const verdicts = checks.map(c => {
    const v = compareSuppression(c, feedback, at);
    if (v.agrees) { agree++; if (v.code) bump(named, v.code); } else bump(differ, v.code);
    return { subject_ref: c.subject, row: c.row, ...v };
  });
  const list = suppressionList(feedback, at);
  const otherwise = named.reason_named_otherwise ? `, ${named.reason_named_otherwise} of them naming another reason` : '';
  const tail = ` The engine's list: ${list.never.length} never, ${list.not_on_row.length} off a row, ${list.paused.length} paused, ${list.reach_floor.length} reach floors, ${list.audiences.length} audiences, ${list.topics.length} topics; taxonomy version ${TAXONOMY_VERSION}, not sent until Control Center serves it.`;
  const line = shadowLine('Suppression', ['check', 'checks'], { read: checks.length, agree, differ, more: ` from ${feedback.length} answer${feedback.length === 1 ? '' : 's'}` }).replace(/\.$/, `${otherwise}.`) + tail;
  return { verdicts, list, line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
