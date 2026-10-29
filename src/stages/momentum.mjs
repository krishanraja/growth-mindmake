/**
 * Momentum: the engine pushes when a lane starves, the pool stops growing or
 * a plan runs (C4). A hold that only counts itself every run is a dead end;
 * these turn three of them into a move.
 *
 * - **Lanes.** Every run reports one `Lanes:` line, each lane's output (the
 *   five rows, guest invites, podcast pitches, stage pitches, as posted) and
 *   the pool it drew from. A lane a cap left at 0 reads `capped`, never 0. Later runs read it back from Control Center's own list of this
 *   engine's recent reports (`features.recent_reports`, 1.10.0), so the
 *   history lives in the reports already sent, never in a ledger of ours.
 * - **A lane at 0 for three runs** (this one and the two before it that
 *   reported a `Lanes:` line) puts one strategy ask on his list: which lanes,
 *   for how many runs, what holds starve each, and what would unblock it. One
 *   ask a London week, `gml-<monday>`, kept current until he answers it.
 * - **A pool that has not grown in three runs** asks Control Center's research
 *   desk for new shows and stages to pitch (`search`, at most two, never a
 *   person or an address), at most once a London day, and not while one asked
 *   this London week waits or answered.
 * - **A check-in every other day while a plan is open** (ENGINE-PROTOCOL.md,
 *   "Autonomy", 4; this repository sets how often): `stage: "check_in"` behind
 *   `strategy`, naming the plan, with the gap, each lane's output and what
 *   starves it in its exact words. A plan is open when his latest decision on
 *   it approved it and none says done: a `gmc-` campaign plan, or this week's
 *   `gms-` spec he signed. His Purge on a check-in stops that plan for good
 *   (ENGINE-PROTOCOL.md: "Purge stops the plan"): no more check-ins, no
 *   prepared action from it (src/dispatch.mjs), and a stopped spec is not in
 *   force (src/crew/compile.mjs).
 *
 * Pure: the dispatch passes what it read. Nothing here sends, spends or
 * widens authority; every ask is a proposal for his answer.
 */
import { seal } from '../guards.mjs';
import { lookupId } from './pitches.mjs';

export const LANE_KEYS = Object.freeze(['reach_out', 'network', 'visibility', 'events', 'partners', 'invites', 'podcasts', 'stages']);
/** Runs a lane may read 0, or the pool stand still, before the engine asks. */
export const STARVED_RUNS = 3;
export const LANES_LINE = /^Lanes: /;
export const STARVED_PREFIX = 'gml-';
export const CHECK_IN_PREFIX = 'gmk-';
/** A check-in at least every other day while a plan is open. */
export const CHECK_IN_DAYS = 2;
export const SOURCING_PER_RUN = 2;
/**
 * A lane that made nothing because a cap was full (Jonny's ten a day, a run's
 * or a week's share, or the 40 a report carries), not because nothing could
 * feed it. Never 0, so it never counts toward a starved lane.
 */
export const CAPPED = 'capped';
const DAY = 86400000;
/** The holds that starve each lane, by the prefix the dispatch gives them. */
const STARVED_BY = { invites: 'invite_', podcasts: 'pitch_', stages: 'speak_', reach_out: 'row_', network: 'row_', visibility: 'row_', events: 'row_', partners: 'row_' };
/** What would feed each lane, in his words to choose from. */
const FEEDS = {
  invites: 'more guests judged worth having, with an address on record',
  podcasts: 'more live shows with their own booking address',
  stages: 'more stages with an open call and an organiser who books speakers',
  reach_out: 'more connectors and leaders over the fit floor with a route',
  network: 'more close ties gone quiet with a route',
  visibility: 'more hosts and broadcasters with a named channel',
  events: 'more educators and community leads with a route',
  partners: 'more investors and trainers over the fit floor with a route'
};

/** The pool a run draws from: the people, stages and guests Control Center served. Null when no context was read. Pure. */
export function poolOf(context) {
  if (!context) return null;
  const n = v => Array.isArray(v) ? v.length : 0;
  return n(context.amplifier_candidates) + n(context.quiet_ties) + n(context.records?.visibility) + n(context.records?.guests);
}

/** This run's lane line, the one later runs read back. Pure. */
export function lanesLine(lanes, pool) {
  return `Lanes: ${LANE_KEYS.map(k => `${k} ${Number.isInteger(lanes?.[k]) ? lanes[k] : lanes?.[k] === CAPPED ? CAPPED : 'unknown'}`).join(', ')}; pool ${Number.isInteger(pool) ? pool : 'unknown'}.`;
}

/** One lane line read back: each lane's count and the pool, null where unknown or absent. Pure. */
export function readLanesLine(line) {
  if (typeof line !== 'string' || !LANES_LINE.test(line)) return null;
  const lanes = {};
  for (const k of LANE_KEYS) { const m = new RegExp(`\\b${k} (\\d+|unknown|${CAPPED})\\b`).exec(line); lanes[k] = m && /^\d+$/.test(m[1]) ? Number(m[1]) : null; }
  const p = /; pool (\d+)\./.exec(line);
  return { lanes, pool: p ? Number(p[1]) : null };
}

/** The lane lines of this engine's recent live reports, newest first; null when they could not be read. Pure. */
export function laneHistory(reports) {
  if (!Array.isArray(reports)) return null;
  const out = [];
  for (const r of reports) {
    const lines = Array.isArray(r?.activity) ? r.activity.map(a => typeof a === 'string' ? a : a?.line ?? '') : [];
    const got = lines.map(readLanesLine).find(Boolean);
    if (got) out.push(got);
  }
  return out;
}

/** Lanes at 0 for STARVED_RUNS runs, this one included, with what starves each; only lanes that are on. Pure. */
export function starvedLanes({ lanes, history, holds = [], on = {} }) {
  if (!Array.isArray(history) || history.length < STARVED_RUNS - 1) return [];
  const before = history.slice(0, STARVED_RUNS - 1);
  return LANE_KEYS.filter(k => on[k] !== false && lanes?.[k] === 0 && before.every(h => h.lanes[k] === 0)).map(k => {
    const codes = new Map();
    for (const h of holds) if (typeof h?.reason === 'string' && h.reason.startsWith(STARVED_BY[k])) codes.set(h.reason, (codes.get(h.reason) ?? 0) + 1);
    return { lane: k, runs_at_zero: STARVED_RUNS, starved_by: [...codes.keys()].slice(0, 4), feeds_it: FEEDS[k] };
  });
}

/** Whether the pool has stood still or shrunk over STARVED_RUNS runs, this one included. Unknown is never flat. Pure. */
export function poolFlat({ pool, history }) {
  if (!Number.isInteger(pool) || !Array.isArray(history) || history.length < STARVED_RUNS - 1) return false;
  const oldest = history[STARVED_RUNS - 2].pool;
  return Number.isInteger(oldest) && history.slice(0, STARVED_RUNS - 1).every(h => Number.isInteger(h.pool)) && pool <= oldest;
}

/** The one strategy ask for starved lanes this London week, or null. Not posted again once he has answered it. Pure. */
export function starvedProposal({ starved, weekOf, expiresAt, gap = null, decisions = [] }) {
  if (!starved.length) return null;
  const proposal_id = `${STARVED_PREFIX}${weekOf}`;
  if ((Array.isArray(decisions) ? decisions : []).some(d => d?.proposal_id === proposal_id)) return null;
  const names = starved.map(s => s.lane.replace('_', ' '));
  return {
    proposal_id,
    title: `${names.length === 1 ? `The ${names[0]} lane has` : `${names.length} lanes have`} made nothing for ${STARVED_RUNS} runs: what should feed ${names.length === 1 ? 'it' : 'them'}?`.slice(0, 160),
    why: `${names.join(', ')} read 0 on this run and the ${STARVED_RUNS - 1} before it. Each line in the words says what holds it and what would feed it. Change it first to tell the engine which to chase (a source, a kind of person, a lane to turn off), or Clear to have it keep asking the research desk for more of what feeds each. Nothing is sent or spent by this answer.`.slice(0, 1000),
    kind: 'advice', wall: 'strategy', objective_key: 'good_meetings',
    exact_payload: JSON.stringify({ week_of: weekOf, gap, starved, your_call: null }, null, 2),
    close_condition: { event: 'starved_lanes_answered', reference: `week:${weekOf}` },
    expires_at: expiresAt
  };
}

/**
 * Research requests for new shows and stages when the pool stands still: each
 * at most once a London day, and not while one asked this London week waits
 * or answered (the week is in the base, so last week's answer never blocks a
 * pool that is still flat). Pure.
 */
export function sourcingRequests({ flat, research = [], at, weekOf, lanesOn = { visibility: true, events: true } }) {
  if (!flat) return [];
  const asks = [
    lanesOn.visibility !== false && { base: `source:podcasts:${weekOf}`, query: 'Podcasts that interview senior business leaders (chief executives, operating and marketing chiefs) about how AI changes the way a company works, with an episode in the last 60 days and a public way to pitch a guest. Give each show, its host, and its guest page, with the source and its date.', why: 'The pool of shows and stages has not grown in three runs; new shows give Jonny more to pitch, still only on his yes.' },
    lanesOn.events !== false && { base: `source:stages:${weekOf}`, query: 'Conferences, summits and executive roundtables in London, New York or online in the next six months with an open call for speakers on AI and leadership for senior business leaders. Give each event, its organiser, and its call for speakers page, with the source and its date.', why: 'The pool of stages has not grown in three runs; a new open call gives Krish a stage to apply to, still only on his yes.' }
  ].filter(Boolean);
  const out = [];
  for (const a of asks) {
    const id = lookupId(a.base, research, at, a.query);
    if (id && out.length < SOURCING_PER_RUN) out.push({ request_id: id, kind: 'search', subject_ref: null, query: a.query.slice(0, 400), why: a.why.slice(0, 300) });
  }
  return out;
}

const latest = (decisions, id) => (Array.isArray(decisions) ? decisions : []).filter(d => d?.proposal_id === id).sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0] ?? null;

/** A plan's check-in id, before its two-day window. */
const checkInBase = plan => `${CHECK_IN_PREFIX}${seal({ plan }).slice(0, 24)}-`;

/**
 * The plans he stopped: every campaign plan or week spec in his decisions
 * whose check-in he declined (Purge). ENGINE-PROTOCOL.md: "Purge stops the
 * plan (the rule then never pushes it again)". Pure.
 */
export function stoppedPlans(decisions) {
  const all = Array.isArray(decisions) ? decisions : [];
  const declined = all.filter(d => d?.decision === 'declined' && typeof d.proposal_id === 'string' && d.proposal_id.startsWith(CHECK_IN_PREFIX)).map(d => d.proposal_id);
  const plans = new Set();
  for (const d of all) {
    const id = d?.proposal_id;
    if (typeof id === 'string' && (id.startsWith('gmc-') || id.startsWith('gms-')) && declined.some(c => c.startsWith(checkInBase(id)))) plans.add(id);
  }
  return plans;
}

/** The plans approved now, newest approval first: a campaign plan or this week's spec he approved, with no later done, stopped or not. Pure. */
function approvedPlans(decisions, weekOf) {
  const ids = [...new Set((Array.isArray(decisions) ? decisions : []).map(d => d?.proposal_id).filter(id => typeof id === 'string' && (id.startsWith('gmc-') || id === `gms-${weekOf}`)))];
  return ids.map(id => latest(decisions, id)).filter(d => d && d.decision === 'approved' && (d.stage === 'plan' || d.proposal_id.startsWith('gms-'))).sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at))).map(d => d.proposal_id);
}

/** The plans open now, newest approval first: approved and not stopped by his Purge on a check-in. Pure. */
export function openPlans(decisions, weekOf) {
  const stopped = stoppedPlans(decisions);
  return approvedPlans(decisions, weekOf).filter(p => !stopped.has(p));
}

/** Which two-day window a London date is in. Pure. */
export const checkInWindow = day => Math.floor(Date.parse(`${day}T12:00:00Z`) / (CHECK_IN_DAYS * DAY));

/**
 * The check-in for the newest open plan (one ask per engine at a time), or a
 * hold when his Purge stopped it, or nothing. Its id is the plan and the
 * two-day window, so a new one comes every other day and the one waiting is
 * kept current in between; once he answers it, nothing more until the next
 * window. Pure.
 */
export function checkIn({ decisions, weekOf, today, expiresAt, gap = null, lanes = null, starved = [] }) {
  const all = Array.isArray(decisions) ? decisions : [];
  const halted = stoppedPlans(all);
  const stopped = approvedPlans(all, weekOf).filter(p => halted.has(p));
  const plan = openPlans(all, weekOf)[0] ?? null;
  const holds = stopped.length ? [{ reason: 'check_in_stopped', detail: `${stopped.length} plan${stopped.length === 1 ? '' : 's'} he stopped with a Purge on a check-in ${stopped.length === 1 ? 'gets' : 'get'} no more check-ins and no prepared action.` }] : [];
  if (!plan) return { proposal: null, holds, plan: null };
  const proposal_id = `${checkInBase(plan)}${checkInWindow(today)}`;
  if (all.some(d => d?.proposal_id === proposal_id)) return { proposal: null, holds, plan };
  return { plan, holds, proposal: {
    proposal_id,
    title: `On track? How plan ${plan.slice(0, 40)} is going`.slice(0, 160),
    why: `A check-in every other day while a plan is open: the gap, each lane's output and what starves it are in the words. Clear keeps the plan going; change it first to redirect it; Purge stops it for good. Nothing is sent or spent by this answer.`,
    kind: 'prepared', wall: 'strategy', stage: 'check_in', parent_proposal_id: plan, objective_key: 'good_meetings',
    exact_payload: JSON.stringify({ plan, as_of: today, gap, lanes, starved: starved.map(s => ({ lane: s.lane, starved_by: s.starved_by })), next: starved.length ? 'Ask the research desk for more of what feeds each starved lane, and wait on his call.' : 'Keep every lane at its caps; the next check-in in two days.' }, null, 2),
    close_condition: { event: 'check_in_answered', reference: `plan:${plan}`.slice(0, 500) },
    expires_at: expiresAt
  } };
}
