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
/** His visibility targets (Ruling, Krish, 2026-10-27), as config/policy.json's `recognition` holds them; these are the fallback when a policy has none. */
export const PODCASTS_A_WEEK = 2;
export const STAGES_A_FORTNIGHT = 1;
/** The visibility targets from the policy's `recognition` (N04: read where they belong), else the ruled fallback. */
export function visibilityTargets(policy) {
  const r = policy?.recognition;
  const whole = v => Number.isInteger(v) && v >= 0 ? v : null;
  return { podcasts: whole(r?.podcasts_booked_per_week) ?? PODCASTS_A_WEEK, stages: whole(r?.stages_confirmed_per_fortnight) ?? STAGES_A_FORTNIGHT };
}
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
  if (!v || typeof v !== 'object' || v.week_of !== weekOf) return { state: 'unreadable' };
  return countsOf(v.total, v.by_path);
}

/** A typed total and its paths: counted, or unreadable. Null is unknown, never zero. Pure. */
function countsOf(total, paths) {
  const count = x => Number.isInteger(x) && x >= 0 && x <= MAX_A_WEEK;
  if (!count(total)) return { state: 'unreadable' };
  const by_path = {};
  for (const [k, x] of Object.entries(paths ?? {})) {
    if (!PATHS.includes(k) || !(x === null || count(x))) return { state: 'unreadable' };
    if (x !== null) by_path[k] = x;
  }
  if (Object.values(by_path).reduce((a, b) => a + b, 0) > total) return { state: 'unreadable' };
  return { state: 'counted', total, by_path };
}

/**
 * From the week of 9 November the Monday ask folds into the week spec (plan
 * section 1): the `gms-<week>` proposal carries last week's counts in
 * `last_week`, and his "Change it first" version types them. Read exactly as
 * the `gmg-` answer is: only his amended version, after its digest is
 * recomputed; a Clear without numbers counts nothing. The counts are read
 * whether or not the rest of his version compiles. Pure.
 */
export function readSpecCounts(decisions, specWeekOf, digest, prefix = 'gms-') {
  const d = (Array.isArray(decisions) ? decisions : []).filter(x => x?.proposal_id === `${prefix}${specWeekOf}`).sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0];
  if (!d) return { state: 'unanswered' };
  if (d.decision === 'declined') return { state: 'declined' };
  if (d.decision !== 'approved' && d.decision !== 'done') return { state: 'unanswered' };
  if (d.amended !== true || typeof d.exact_payload !== 'string') return { state: 'cleared_without_counts' };
  const amount = d.amount_usd === undefined ? null : d.amount_usd;
  if (typeof d.amended_sha256 !== 'string' || digest({ amount_usd: amount, exact_payload: d.exact_payload }) !== d.amended_sha256) return { state: 'digest_mismatch' };
  let v;
  try { v = JSON.parse(d.exact_payload); } catch { return { state: 'unreadable' }; }
  if (!v || typeof v !== 'object' || v.week_of !== specWeekOf || !v.last_week || typeof v.last_week !== 'object') return { state: 'unreadable' };
  if (v.last_week.good_meetings_total === null) return { state: 'cleared_without_counts' };
  return countsOf(v.last_week.good_meetings_total, v.last_week.by_path);
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

export function bookingLine(booked, targets = { podcasts: PODCASTS_A_WEEK, stages: STAGES_A_FORTNIGHT }) {
  if (!booked) return 'Bookings: not measured; pitch outcomes were not served completely this run.';
  return `Bookings: ${booked.podcasts} podcast${booked.podcasts === 1 ? '' : 's'} booked this week against ${targets.podcasts}, ${booked.stages} stage${booked.stages === 1 ? '' : 's'} confirmed in the last fourteen days against ${targets.stages}.`;
}

// ── Held meetings and his good tap (protocol 1.10.0) ────────────────────────
// Once Control Center serves each meeting he held (features.meetings), the
// number is counted from his taps: a meeting he marked good, in the London
// week it was held, by the path recorded at his tap. The Monday ask is then
// no longer posted. The engine also says where each unanswered meeting came
// from (origin_candidates), which Control Center records once at his tap.

export const MEETINGS_VERSION = '1.10.0';
export const ORIGIN_CANDIDATES_MAX = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;

/** Whether Control Center serves held meetings to this engine: 1.10.0 and its feature flag. */
export const meetingsServed = capabilities => capabilities?.features?.meetings === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes(MEETINGS_VERSION);

/**
 * The held meetings in the context, with their coverage. `served` when the
 * part and its coverage line are there and available; `unavailable` with
 * Control Center's reason otherwise. A meeting that does not parse is left
 * out and counted, never guessed. Pure.
 */
export function readMeetings(context) {
  const cov = (Array.isArray(context?.coverage) ? context.coverage : []).find(c => c?.source === 'meetings');
  if (!cov || !Array.isArray(context?.meetings)) return { state: 'unserved', reason: 'meetings_not_in_context' };
  if (cov.available !== true) return { state: 'unavailable', reason: typeof cov.reason === 'string' ? cov.reason.slice(0, 80) : 'source_unavailable' };
  const meetings = [];
  let dropped = 0;
  for (const m of context.meetings) {
    const ok = m && typeof m.meeting_id === 'string' && typeof m.contact_id === 'string' && UUID.test(m.contact_id)
      && typeof m.held_at === 'string' && Number.isFinite(Date.parse(m.held_at))
      && (m.good === null || typeof m.good === 'boolean')
      && (m.origin_path === null || m.origin_path === undefined || PATHS.includes(m.origin_path));
    if (!ok) { dropped++; continue; }
    meetings.push({ meeting_id: m.meeting_id, contact_id: m.contact_id.toLowerCase(), held_at: m.held_at, good: m.good, origin_path: m.origin_path ?? null });
  }
  return { state: 'served', meetings, complete: cov.complete === true && dropped === 0, reason: dropped ? 'meetings_unreadable' : cov.complete === true ? null : (typeof cov.reason === 'string' ? cov.reason.slice(0, 80) : 'incomplete'), dropped };
}

/** His good meetings held in the London week [start, end), by recorded path, and how many there are still unanswered. Pure. */
export function countGood(meetings, { start, end }, londonDate) {
  const inWeek = meetings.filter(m => { const d = londonDate(m.held_at); return d >= start && d < end; });
  const by_path = {};
  let total = 0;
  for (const m of inWeek.filter(x => x.good === true)) { total++; const p = m.origin_path ?? 'unknown'; by_path[p] = (by_path[p] ?? 0) + 1; }
  return { total, by_path, held: inWeek.length, unanswered: inWeek.filter(x => x.good === null).length };
}

/** The good_meetings objective from his taps: measured only when every meeting was read, else missing with the reason. */
export function tappedObjective({ read, count, lastWeek, midnight, timezone }) {
  const base = { key: 'good_meetings', unit: 'meetings', window_start: midnight(lastWeek.start), window_end: midnight(lastWeek.end), timezone };
  if (read.state === 'served' && read.complete) return { ...base, value: count.total, availability: 'measured', reason: null };
  const why = read.state === 'served' ? `Control Center could not read every meeting he held (${read.reason}), so no count is claimed.` : `Control Center did not serve his held meetings this run (${read.reason}), so no count is claimed.`;
  return { ...base, value: null, availability: 'missing', reason: why };
}

/** One line on the number from his taps. Counts only, never names. */
export function tappedLine({ read, count, lastWeekOf, lastTarget, thisTarget, targetSource, northStar }) {
  const urgency = northStar?.urgency ? ` Urgency U${northStar.urgency}${northStar.reason ? `: ${northStar.reason}` : ''}.` : '';
  const target = Number.isInteger(thisTarget) ? ` This week's target is ${thisTarget} (${targetSource}).` : '';
  if (read.state !== 'served') return `Good meetings: not measured. Control Center did not serve his held meetings this run (${read.reason}).${target}${urgency}`;
  const paths = Object.entries(count.by_path).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${v} ${k.replace(/-/g, ' ')}`).join(', ');
  const open = count.unanswered ? ` ${count.unanswered} of the ${count.held} held that week ${count.unanswered === 1 ? 'is' : 'are'} not answered yet.` : '';
  const whole = read.complete ? '' : ` Not every meeting was read (${read.reason}), so this is a floor and is not reported as the number.`;
  return `Good meetings in the week of ${lastWeekOf}: ${count.total}${Number.isInteger(lastTarget) ? ` against a target of ${lastTarget}` : ''}, from his taps after each meeting${paths ? ` (${paths})` : ''}.${open}${whole}${target}${urgency}`;
}

const ROW_PATH = { partners: 'partner', network: 'existing-relationship' };

/**
 * Where an unanswered meeting came from, for each person he met: the
 * engine's own records first (a guest on his show, a show or a stage whose
 * booking contact they are, a row he carried out about them, an Advisory
 * pilot), then a warm tie in his network. A person the records say nothing
 * about gets no candidate, so Control Center records `unknown`. Oldest
 * meeting first, as his list asks; at most 40, one a person. Pure.
 */
export function originCandidates({ meetings, context }) {
  const records = context?.records ?? {};
  const list = v => (Array.isArray(v) ? v : []);
  const lc = v => (typeof v === 'string' ? v.toLowerCase() : null);
  const ref = (kind, id) => (typeof id === 'string' && REF.test(`${kind}:${id}`) ? `${kind}:${id}` : null);
  const targets = list(records.visibility);
  const pathOf = c => {
    const guest = list(records.guests).find(g => lc(g?.contact_id) === c && g?.invite_show);
    if (guest) return { path: 'own-show-guest', origin_ref: ref('guest', guest.id) };
    const target = targets.find(t => lc(t?.booking_contact_id) === c);
    if (target) {
      const kind = stageKind(target);
      if (kind) return { path: kind === 'podcast' ? 'podcast' : 'guest-seat', origin_ref: ref('target', target.id) };
    }
    const done = list(context?.feedback).filter(f => lc(f?.subject_ref) === `contact:${c}` && (f?.carried_out || f?.state === 'done' || f?.state === 'approved'))
      .sort((a, b) => String(b.decided_at ?? '').localeCompare(String(a.decided_at ?? '')))[0];
    if (done) {
      const path = ROW_PATH[done.row] ?? (done.amplifier_kind === 'signal' ? 'public-signal' : done.row === 'reach_out' ? 'multiplier-intro' : null);
      if (path) return { path, origin_ref: ref('proposal', done.proposal_id) };
    }
    const pilot = list(records.advisory).find(p => lc(p?.contact_id) === c);
    if (pilot) {
      const t = pilot.visibility_target_id && targets.find(x => x?.id === pilot.visibility_target_id);
      const kind = t ? stageKind(t) : null;
      if (kind) return { path: kind === 'podcast' ? 'podcast' : 'guest-seat', origin_ref: ref('target', t.id) };
      if (pilot.guest_id) return { path: 'own-show-guest', origin_ref: ref('guest', pilot.guest_id) };
      return { path: 'existing-relationship', origin_ref: ref('pilot', pilot.id) };
    }
    if (list(context?.network).some(n => lc(n?.contact_id) === c)) return { path: 'existing-relationship', origin_ref: null };
    return null;
  };
  const out = [], seen = new Set();
  const open = [...meetings].filter(m => m.good === null && m.origin_path === null).sort((a, b) => Date.parse(a.held_at) - Date.parse(b.held_at));
  for (const m of open) {
    if (seen.has(m.contact_id)) continue;
    seen.add(m.contact_id);
    const p = pathOf(m.contact_id);
    if (p) out.push({ contact_id: m.contact_id, path: p.path, origin_ref: p.origin_ref });
    if (out.length >= ORIGIN_CANDIDATES_MAX) break;
  }
  return out;
}
