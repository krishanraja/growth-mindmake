/**
 * The North Star number: good meetings a week, each traced to where it came
 * from (docs/NORTH_STAR.md, Ruling, Krish, 2026-10-27), and the visibility
 * bookings that feed it. Pure.
 *
 * Until Control Center serves each held meeting with Krish's one tap after it
 * (protocol 1.10.0), the number comes from one Monday ask: a `gmg-` plan for
 * last week's count, which he answers with "Change it first" and his typed
 * totals. An unanswered or unamended ask is never read as zero.
 */
import { stageKind } from './pitches.mjs';

/** Where a good meeting came from. The engine pre-fills one; Krish confirms it. */
export const PATHS = ['existing-relationship', 'multiplier-intro', 'partner', 'guest-seat', 'podcast', 'own-show-guest', 'public-signal', 'inbound', 'referral', 'unknown'];
export const STOPGAP_PREFIX = 'gmg-';
/** His visibility targets (Ruling, Krish, 2026-10-27). */
export const PODCASTS_A_WEEK = 2;
export const STAGES_A_FORTNIGHT = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_A_WEEK = 500;

/** The weekly ladder from docs/NORTH_STAR.md's north-star-metric block, as [[monday, target]] in date order. */
export function readLadder(markdown) {
  const block = /```yaml north-star-metric\n([\s\S]*?)```/.exec(String(markdown ?? ''))?.[1] ?? '';
  const ladder = [...block.matchAll(/^\s*-\s*\[(\d{4}-\d{2}-\d{2}),\s*(\d+)\]\s*$/gm)].map(m => [m[1], Number(m[2])]);
  return ladder.sort((a, b) => a[0].localeCompare(b[0]));
}

/** The target for the London week starting `weekStart`: the latest rung on or before it, else the first. */
export function ladderTarget(ladder, weekStart) {
  if (!ladder.length) return null;
  const on = ladder.filter(([d]) => d <= weekStart);
  return (on.length ? on[on.length - 1] : ladder[0])[1];
}

/**
 * What the directive says about the number (1.4.0). Mindmake's figures read
 * "private", so a target or reading that is not a number is unknown, never 0.
 */
export function readNorthStar(directive) {
  const ns = directive && typeof directive === 'object' ? directive.north_star : null;
  const own = ns && typeof ns.own === 'object' ? ns.own : null;
  const num = v => Number.isInteger(v) && v >= 0 ? v : null;
  const u = v => Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;
  return {
    week_target: num(own?.week_target),
    urgency: u(ns?.intensity?.urgency) ?? u(own?.urgency) ?? u(directive?.urgency),
    reason: typeof (own?.urgency_reason ?? directive?.urgency_reason) === 'string' ? String(own?.urgency_reason ?? directive?.urgency_reason).slice(0, 300) : null
  };
}

/** The directive's constraints, read as data. They never widen authority. */
export function readConstraints(directive) {
  const c = directive?.constraints;
  if (!c || typeof c !== 'object') return null;
  return {
    max_actions: Number.isInteger(c.max_actions) && c.max_actions >= 0 ? c.max_actions : null,
    spend_cap_usd: typeof c.spend_cap_usd === 'number' && c.spend_cap_usd >= 0 ? c.spend_cap_usd : null
  };
}

/** The exact words of the Monday ask for the London week starting `weekOf`. */
export function stopgapPayload(weekOf) {
  return JSON.stringify({
    week_of: weekOf,
    total: null,
    by_path: Object.fromEntries(PATHS.map(p => [p, null])),
    how: 'Press "Change it first" and type how many good meetings you had that week as total, and by path where you know it. Leave a path you do not know as null. A Clear without your numbers counts nothing.'
  }, null, 2);
}

/** The Monday ask for last week's good meetings. A strategy plan; it never reaches prepare-action. */
export function stopgapProposal({ weekOf, expiresAt, target }) {
  return {
    proposal_id: `${STOPGAP_PREFIX}${weekOf}`,
    title: `How many good meetings did you have in the week of ${weekOf}? Type them in`,
    why: `The North Star number is good meetings a week${Number.isInteger(target) ? `, ${target} that week` : ''}, traced to where each came from. Until Control Center asks after each meeting, this one Monday ask measures it: press "Change it first", type the total and the paths you know, then Clear. Counts only, never names.`,
    kind: 'prepared', wall: 'strategy', stage: 'plan', parent_proposal_id: null,
    objective_key: 'good_meetings',
    exact_payload: stopgapPayload(weekOf),
    close_condition: { event: 'good_meetings_counted', reference: `week:${weekOf}` },
    expires_at: expiresAt
  };
}

/**
 * His answer to the Monday ask, read only from his own amended version after
 * its digest is recomputed (ENGINE-PROTOCOL.md: `amended_sha256` is the SHA-256
 * of the canonical JSON of exactly `{ amount_usd, exact_payload }`).
 */
export function readStopgap(decisions, weekOf, digest) {
  const d = (Array.isArray(decisions) ? decisions : []).filter(x => x?.proposal_id === `${STOPGAP_PREFIX}${weekOf}`).sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0];
  if (!d) return { state: 'unanswered' };
  if (d.decision === 'declined') return { state: 'declined' };
  if (d.decision !== 'approved' && d.decision !== 'done') return { state: 'unanswered' };
  if (d.amended !== true || typeof d.exact_payload !== 'string') return { state: 'cleared_without_counts' };
  const amount = d.amount_usd === undefined ? null : d.amount_usd;
  if (typeof d.amended_sha256 !== 'string' || digest({ amount_usd: amount, exact_payload: d.exact_payload }) !== d.amended_sha256) return { state: 'digest_mismatch' };
  let v;
  try { v = JSON.parse(d.exact_payload); } catch { return { state: 'unreadable' }; }
  const count = x => Number.isInteger(x) && x >= 0 && x <= MAX_A_WEEK;
  if (!v || typeof v !== 'object' || v.week_of !== weekOf || !count(v.total)) return { state: 'unreadable' };
  const by_path = {};
  for (const [k, x] of Object.entries(v.by_path ?? {})) {
    if (!PATHS.includes(k) || !(x === null || count(x))) return { state: 'unreadable' };
    if (x !== null) by_path[k] = x;
  }
  if (Object.values(by_path).reduce((a, b) => a + b, 0) > v.total) return { state: 'unreadable' };
  return { state: 'counted', total: v.total, by_path };
}

const STOPGAP_REASON = {
  unanswered: "Last week's Monday ask is not answered yet, so no count is claimed.",
  declined: "Krish declined last week's Monday ask, so no count is claimed.",
  cleared_without_counts: 'Krish cleared the Monday ask without typing his numbers, so nothing is counted.',
  digest_mismatch: "The amended answer's digest did not match its words, so it was not read.",
  unreadable: 'The amended answer did not hold a whole total for the week, so it was not read.',
  not_due: 'The first counted week has not finished yet.',
  unread: "Krish's decisions could not be read this run, so no count is claimed."
};
const SERVED_LATER = ' Control Center does not yet serve each held meeting with his one tap after it (protocol 1.10.0).';

/** The good_meetings objective: last week's count when he typed it, else missing with the reason. Never a zero nobody measured. */
export function goodMeetingsObjective({ answer, lastWeek, thisWeek, midnight, timezone }) {
  if (answer?.state === 'counted') return { key: 'good_meetings', value: answer.total, unit: 'meetings', window_start: midnight(lastWeek.start), window_end: midnight(lastWeek.end), timezone, availability: 'measured', reason: null };
  return { key: 'good_meetings', value: null, unit: 'meetings', window_start: midnight(thisWeek.start), window_end: midnight(thisWeek.end), timezone, availability: 'missing', reason: `${STOPGAP_REASON[answer?.state] ?? STOPGAP_REASON.unread}${SERVED_LATER}` };
}

/** One line on the number for the report: last week's count by path against its rung, or why it is unknown. */
export function goodMeetingsLine({ answer, lastWeekOf, lastTarget, thisTarget, targetSource, northStar }) {
  const urgency = northStar?.urgency ? ` Urgency U${northStar.urgency}${northStar.reason ? `: ${northStar.reason}` : ''}.` : '';
  const target = Number.isInteger(thisTarget) ? ` This week's target is ${thisTarget} (${targetSource}).` : '';
  if (answer?.state === 'counted') {
    const paths = Object.entries(answer.by_path).map(([k, v]) => `${v} ${k.replace(/-/g, ' ')}`).join(', ');
    return `Good meetings in the week of ${lastWeekOf}: ${answer.total}${Number.isInteger(lastTarget) ? ` against a target of ${lastTarget}` : ''}, from Krish's typed weekly totals${paths ? ` (${paths})` : ''}.${target}${urgency}`;
  }
  return `Good meetings: not measured. ${STOPGAP_REASON[answer?.state] ?? STOPGAP_REASON.unread}${target}${urgency}`;
}

const covered = (context, names) => (Array.isArray(context?.coverage) ? context.coverage : []).some(c => names.includes(c?.source) && c.available === true);

/**
 * Bookings against his visibility targets, from each pitch's outcome in the
 * context (1.9.0): podcasts booked this London week, stages confirmed in the
 * last fourteen days. Control Center sets `booked_at` from his calendar.
 */
export function bookings({ context, at, weekStart, londonDate, addDays }) {
  if (!covered(context, ['drafts', 'people_drafts']) || !Array.isArray(context?.records?.drafts)) return null;
  const targets = new Map((Array.isArray(context.records.visibility) ? context.records.visibility : []).filter(t => typeof t?.id === 'string').map(t => [t.id.toLowerCase(), t]));
  const today = londonDate(at), fortnight = addDays(today, -13);
  const seen = new Set(); let podcasts = 0, stages = 0;
  for (const d of context.records.drafts) {
    const id = typeof d?.visibility_target_id === 'string' ? d.visibility_target_id.toLowerCase() : null;
    if (!id || seen.has(id) || typeof d.booked_at !== 'string' || !Number.isFinite(Date.parse(d.booked_at)) || Date.parse(d.booked_at) > Date.parse(at)) continue;
    const day = londonDate(d.booked_at), kind = stageKind(targets.get(id));
    if (kind === 'podcast' && day >= weekStart && day <= today) { podcasts++; seen.add(id); }
    else if (kind === 'stage' && day >= fortnight && day <= today) { stages++; seen.add(id); }
  }
  return { podcasts, stages };
}

export function bookingObjectives({ booked, thisWeek, at, midnight, addDays, londonDate, timezone }) {
  const fortnightStart = addDays(londonDate(at), -13);
  const reason = 'Control Center did not serve complete pitch outcomes this run, so no booking count is claimed.';
  return [
    { key: 'podcasts_booked', value: booked ? booked.podcasts : null, unit: 'podcasts', window_start: midnight(thisWeek.start), window_end: midnight(thisWeek.end), timezone, availability: booked ? 'measured' : 'missing', reason: booked ? null : reason },
    { key: 'stages_confirmed', value: booked ? booked.stages : null, unit: 'stages', window_start: midnight(fortnightStart), window_end: midnight(addDays(londonDate(at), 1)), timezone, availability: booked ? 'measured' : 'missing', reason: booked ? null : reason }
  ];
}

export function bookingLine(booked) {
  if (!booked) return 'Bookings: not measured; pitch outcomes were not served completely this run.';
  return `Bookings: ${booked.podcasts} podcast${booked.podcasts === 1 ? '' : 's'} booked this week against ${PODCASTS_A_WEEK}, ${booked.stages} stage${booked.stages === 1 ? '' : 's'} confirmed in the last fourteen days against ${STAGES_A_FORTNIGHT}.`;
}
