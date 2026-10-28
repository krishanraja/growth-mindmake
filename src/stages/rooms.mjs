import { DAY } from '../guards.mjs';
import { shadowLine } from './visibility.mjs';

/**
 * Which room is worth an evening of Krish's time, anchored to the buyer
 * (plan section 12, M5; Ruling, Krish, 2026-10-27: Control Center "does not
 * own the strategy for how to grow mindmake as a business").
 *
 * Ported from Control Center, rule for rule:
 *   api/_eventScore.ts    the two axes (Draw: peers who run real businesses;
 *                         Demand: people who could buy), their weights, the
 *                         named-attendee bonus and its bar (docs/DECISIONS/024,
 *                         Krish, 2026-09-24: "successful entrepreneurs and
 *                         those running successful businesses, not AI
 *                         developers or adtech people"), and the clean-up of a
 *                         judge's reply
 *   api/events/score.ts   which rooms are judged next, and the host kind a
 *                         judgment sets
 *
 * Read with them, because a verdict on a room is its rank and whether it may
 * be shown at all: the rank (Draw 55, Demand 45) and the actionability of
 * events_for() in supabase/migrations/20260924120000_events_attend_lane.sql
 * (also src/hooks/useEvents.ts and api/_focus.ts roomRank, which plan item M7
 * moves), the gate of events_recommendable in
 * supabase/migrations/20261101110000_events_never_stale.sql (a room is over
 * when it ends, or twelve hours after it starts), and api/_focus.ts's buyer
 * room (some buyers in it, by density or by Demand).
 *
 * Demand is "who in the room could buy". Who that buyer is belongs to
 * Mindmake's canon (the Horizon in 00_NORTH_STAR.md, read live by
 * canon.mjs), not to this file: the rules weigh only the densities a judge
 * read against it, and every verdict names the canon files it rests on.
 * Control Center's judge reads the buyer from its own mission block
 * (api/_mission.ts FACE and DOOR), which plan item M6 retires; that copy is
 * not ported.
 *
 * What stays in Control Center: collection (api/events/discover.ts, the
 * scrub that archives dead rooms, the named attendees he knows from the
 * warm-path index) and the one model call that reads a room's page and
 * returns its five densities (scoreEvent's prompt). The engine reads each
 * room from the context (records.events) instead. Control Center does not
 * serve a room's densities or scores yet, so the shadow says so in counts.
 *
 * Pure: no model, no network, no clock but the run's.
 */

/** api/_eventScore.ts SCORE_VERSION: the room standard this file ports. */
export const ROOM_SCORE_VERSION = 1;
/** api/_eventScore.ts WEIGHTS: Draw is mostly peers, Demand mostly buyers; practitioners cost Draw more than Demand. */
export const ROOM_WEIGHTS = Object.freeze({
  draw: Object.freeze({ peer: 0.70, seniority: 0.30, practitioner: -0.40, vendor: -0.20 }),
  demand: Object.freeze({ buyer: 0.70, seniority: 0.30, practitioner: -0.25, vendor: -0.10 }),
});
/** api/_eventScore.ts NAMED_ATTENDEE_BONUS, NAMED_ATTENDEE_BONUS_CAP and PEER_BAR_FOR_BONUS. */
export const NAMED_ATTENDEE_BONUS = 6;
export const NAMED_ATTENDEE_BONUS_CAP = 12;
export const PEER_BAR_FOR_BONUS = 50;
/** api/events/score.ts RESCORE_AFTER_DAYS: a score older than this is judged again. */
export const RESCORE_AFTER_DAYS = 30;
/** events_for(): Draw's and Demand's shares of a room's rank. */
export const RANK_DRAW = 0.55;
export const RANK_DEMAND = 0.45;
/** events_recommendable: with no end on record, a room is over this long after it starts. */
export const OVER_AFTER_HOURS = 12;
/** events_for(): an away room further off than this can still be booked. */
export const BOOKABLE_AFTER_DAYS = 21;
/** The five densities a judge reads off a room. */
export const DENSITIES = Object.freeze(['peer_density', 'buyer_density', 'practitioner_density', 'vendor_density', 'seniority']);

/** api/_eventScore.ts clamp. */
export function clamp(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** api/_eventScore.ts computeAxes: Draw and Demand from the five densities, the bonus on Draw only and only where the room reads as peers. Pure. */
export function computeRoomAxes(j) {
  const peer = clamp(j.peer_density), buyer = clamp(j.buyer_density), prac = clamp(j.practitioner_density), vend = clamp(j.vendor_density), sen = clamp(j.seniority);
  const w = ROOM_WEIGHTS;
  let draw = peer * w.draw.peer + sen * w.draw.seniority + prac * w.draw.practitioner + vend * w.draw.vendor;
  const demand = buyer * w.demand.buyer + sen * w.demand.seniority + prac * w.demand.practitioner + vend * w.demand.vendor;
  const names = (Array.isArray(j.named_attendees) ? j.named_attendees : []).filter(n => typeof n === 'string' && n.trim());
  if (names.length && peer >= PEER_BAR_FOR_BONUS) draw += Math.min(NAMED_ATTENDEE_BONUS_CAP, names.length * NAMED_ATTENDEE_BONUS);
  return { draw_score: clamp(draw), demand_score: clamp(demand) };
}

/** The deterministic half of api/_eventScore.ts scoreEvent: a judge's reply clamped, its named attendees trimmed. Throws on a reply that is not an object. Pure. */
export function roomJudgmentFrom(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('event_score_unparseable');
  const names = Array.isArray(parsed.named_attendees)
    ? parsed.named_attendees.filter(n => typeof n === 'string' && n.trim()).map(n => n.trim().slice(0, 200)).slice(0, 12)
    : [];
  const j = Object.fromEntries(DENSITIES.map(k => [k, clamp(Number(parsed[k]))]));
  return { ...j, named_attendees: names, ...computeRoomAxes({ ...j, named_attendees: names }), score_version: ROOM_SCORE_VERSION };
}

/** api/events/score.ts: the host kind a judgment sets, from who is in the room; else what was recorded, else unknown. Pure. */
export function hostKindOf(j, recorded = null) {
  if (j.vendor_density >= 60) return 'vendor';
  if (j.practitioner_density >= 60) return 'community';
  if (j.peer_density >= 50) return 'operator';
  return recorded || 'unknown';
}

/** events_for(): a room's rank, Draw 55 and Demand 45, to one decimal place. Pure. */
export function roomRank(e) {
  return Math.round(((e?.draw_score ?? 0) * RANK_DRAW + (e?.demand_score ?? 0) * RANK_DEMAND) * 10) / 10;
}

/** events_for(): a room's Demand axis, the one a buyer room ranks by after its buyer density. Pure. */
export const roomDemand = e => e?.demand_score ?? 0;

/** api/_focus.ts buyerRoom: a room with some buyers in it, by density or by Demand. Pure. */
export const buyerRoom = e => (e?.buyer_density ?? 0) > 0 || (e?.demand_score ?? 0) > 0;

/** When a room ends: its own end, else twelve hours after it starts (events_recommendable). */
const endOf = e => { const end = Date.parse(e?.ends_at ?? ''); return Number.isFinite(end) ? end : Date.parse(e?.starts_at ?? '') + OVER_AFTER_HOURS * 3600000; };

/** events_recommendable: a room that may be shown is not archived, has a verified date and has not ended. Pure. */
export function roomIsLive(e, at) {
  if (!e || e.archived_at || e.date_verified !== true || !e.starts_at || !Number.isFinite(Date.parse(e.starts_at))) return false;
  return endOf(e) > Date.parse(at);
}

/** events_for(): home (his city or virtual), away with someone named, away and bookable, or away and needing a trip. His city is passed in, never written here. Pure. */
export function actionability(e, homeCity, at) {
  if (e?.city && (e.city === homeCity || e.city === 'virtual')) return 'home';
  if (Array.isArray(e?.named_attendees) && e.named_attendees.length > 0) return 'away, named attendee';
  if (Date.parse(e?.starts_at ?? '') > Date.parse(at) + BOOKABLE_AFTER_DAYS * DAY) return 'away, bookable';
  return 'away, needs a trip';
}

/** events_for(): the order rooms come forward in: his city (or virtual) first, then the rank, then the sooner start. Pure. */
export function rankRooms(events, homeCity) {
  const home = e => (e?.city && (e.city === homeCity || e.city === 'virtual') ? 0 : 1);
  return [...(Array.isArray(events) ? events : [])].sort((a, b) => home(a) - home(b) || roomRank(b) - roomRank(a) || Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? ''));
}

/**
 * api/events/score.ts, its queue: an upcoming room not archived, never
 * scored, scored under the old Draw (vps_legacy) or an older version, or
 * scored more than RESCORE_AFTER_DAYS ago unless Krish corrected it by hand
 * (manual). A missing version is not older, as in the query. Pure.
 */
export function needsJudging(e, at) {
  if (!e || e.archived_at || !(Date.parse(e.starts_at ?? '') > Date.parse(at))) return false;
  if (!e.scored_at) return true;
  if (e.scored_source === 'vps_legacy') return true;
  if (Number.isFinite(e.score_version) && e.score_version < ROOM_SCORE_VERSION) return true;
  return Date.parse(e.scored_at) < Date.parse(at) - RESCORE_AFTER_DAYS * DAY && e.scored_source !== 'manual';
}

const served = e => DENSITIES.every(k => typeof e?.[k] === 'number' && Number.isFinite(e[k]));

/** The engine's verdict on one room from what the context serves: whether it may be shown, and, when its densities are served, its axes, rank, buyer room and host kind. Pure. */
export function roomVerdict(e, { at, homeCity = null } = {}) {
  const axes = served(e) ? computeRoomAxes(e) : null;
  return {
    subject_ref: `event:${e.id}`,
    live: roomIsLive(e, at),
    draw_score: axes?.draw_score ?? null,
    demand_score: axes?.demand_score ?? null,
    rank: axes ? roomRank(axes) : null,
    buyer_room: axes ? buyerRoom({ buyer_density: e.buyer_density, demand_score: axes.demand_score }) : null,
    host_kind: axes ? hostKindOf(e, e.host_kind ?? null) : null,
    actionability: homeCity ? actionability(e, homeCity, at) : null,
  };
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * Room scoring in shadow. For every room the context serves, the engine's
 * verdict (roomVerdict) and, where Control Center serves both a room's
 * densities and its stored Draw and Demand under the current version, whether
 * the engine's axes agree. Today it serves neither, so every room is counted
 * not comparable (scores_not_served); one judged under another version is
 * older_version. The line also says how many rooms the engine's own gate
 * holds live. Nothing is held, hidden or changed. Pure.
 */
export function roomsShadow({ context, canon = null, at, homeCity = null }) {
  const events = Array.isArray(context?.records?.events) ? context.records.events : [];
  const seen = new Set(), verdicts = [], differ = {}, apart = {};
  let agree = 0, live = 0;
  for (const e of events) {
    if (typeof e?.id !== 'string' || seen.has(e.id)) continue;
    seen.add(e.id);
    const v = roomVerdict(e, { at, homeCity });
    if (v.live) live++;
    let code = null;
    const stored = Number.isFinite(e.draw_score) && Number.isFinite(e.demand_score);
    if (!stored || v.draw_score === null) { code = 'scores_not_served'; bump(apart, code); }
    else if (Number.isFinite(e.score_version) && e.score_version !== ROOM_SCORE_VERSION) { code = 'older_version'; bump(apart, code); }
    else if (clamp(e.draw_score) === v.draw_score && clamp(e.demand_score) === v.demand_score) agree++;
    else { code = 'axes_disagree'; bump(differ, code); }
    verdicts.push({ ...v, control_center: stored ? { draw_score: e.draw_score, demand_score: e.demand_score } : null, agrees: code === null ? true : code === 'axes_disagree' ? false : null, code });
  }
  const line = shadowLine('Room scoring', ['room', 'rooms'], { read: seen.size, agree, differ, apart, more: `, ${live} live by the room gate` });
  return { verdicts, line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
