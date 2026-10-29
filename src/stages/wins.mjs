/**
 * What has worked, so the next run leans toward it (C4). The engine already
 * learns from every No (src/stages/rows.mjs `lessons`); this is the other
 * half: a reply, a booking or a good meeting lifts what is like it.
 *
 * - A pitch Control Center shows answered (`drafts[].replied_at`) lifts its
 *   show's topic and kind by 1; one booked (`booked_at`) by 2.
 * - A meeting he marked good (his tap, protocol 1.10.0) with someone a row
 *   action of this engine reached and he carried out (`feedback[]` with
 *   `carried_out`, naming the same contact) lifts that action's amplifier
 *   kind, kind in its sector, and topic by 3.
 * - Only the last WIN_DAYS count, and only what was recorded by `at`.
 * - The lift is 1 plus LIFT_STEP a point across what matches, at most
 *   LIFT_MAX. It never goes under 1: a kind that has not won yet keeps its
 *   rank, and a No still refuses what it refused.
 *
 * Pure: everything comes from the context and the held meetings Control
 * Center serves this run. Nothing is stored here; no parallel state.
 */
import { showTopic, stageKind } from './pitches.mjs';

export const WIN_DAYS = 90;
export const LIFT_STEP = 0.1;
export const LIFT_MAX = 1.5;
export const POINTS = Object.freeze({ reply: 1, booking: 2, good_meeting: 3 });
const DAY = 86400000;

/** The wins in the context and his held meetings, and the lift they give a candidate. Pure. */
export function wins({ context, meetings = null, at }) {
  const now = Date.parse(at), from = now - WIN_DAYS * DAY;
  const inWindow = v => { const t = Date.parse(v ?? ''); return Number.isFinite(t) && t >= from && t <= now; };
  const points = new Map();
  const add = (key, n) => points.set(key, (points.get(key) ?? 0) + n);
  const counts = { replies: 0, bookings: 0, good_meetings: 0 };
  const targets = new Map((Array.isArray(context?.records?.visibility) ? context.records.visibility : []).filter(t => typeof t?.id === 'string').map(t => [t.id.toLowerCase(), t]));
  const seen = new Set();
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) {
    const id = typeof d?.visibility_target_id === 'string' ? d.visibility_target_id.toLowerCase() : null;
    const t = id ? targets.get(id) : null;
    if (!t || seen.has(id)) continue;
    const booked = inWindow(d.booked_at), replied = inWindow(d.replied_at);
    if (!booked && !replied) continue;
    seen.add(id);
    const n = booked ? POINTS.booking : POINTS.reply;
    booked ? counts.bookings++ : counts.replies++;
    const kind = stageKind(t), topic = showTopic(t);
    if (kind) add(`kind:${kind}`, n);
    if (topic) add(`topic:${topic}`, n);
  }
  const good = new Set((Array.isArray(meetings) ? meetings : []).filter(m => m?.good === true && inWindow(m.held_at) && typeof m.contact_id === 'string').map(m => `contact:${m.contact_id.toLowerCase()}`));
  const met = new Set();
  for (const f of Array.isArray(context?.feedback) ? context.feedback : []) {
    const s = typeof f?.subject_ref === 'string' ? f.subject_ref.toLowerCase() : null;
    if (!s || !f.carried_out || !good.has(s) || met.has(s)) continue;
    met.add(s);
    counts.good_meetings++;
    const kind = f.amplifier_kind ?? null, sector = f.features?.sector ?? null, topic = f.features?.topic ?? null;
    if (kind) { add(`kind:${kind}`, POINTS.good_meeting); if (sector) add(`sector:${kind}|${sector}`, POINTS.good_meeting); }
    if (topic) add(`topic:${topic}`, POINTS.good_meeting);
  }
  const lift = ({ kind = null, sector = null, topic = null } = {}) => {
    const p = (kind ? points.get(`kind:${kind}`) ?? 0 : 0) + (kind && sector ? points.get(`sector:${kind}|${sector}`) ?? 0 : 0) + (topic ? points.get(`topic:${topic}`) ?? 0 : 0);
    return Math.min(LIFT_MAX, 1 + LIFT_STEP * p);
  };
  return { lift, counts, any: points.size > 0 };
}

/** One activity line on what is lifting the rank, counts only, never a name. Pure. */
export function winsLine(w) {
  const { replies, bookings, good_meetings } = w.counts;
  if (!w.any) return `Wins: no reply, booking or good meeting from this engine's work in the last ${WIN_DAYS} days, so nothing is lifted yet; the rank stands on reach, fit and the standards.`;
  return `Wins in the last ${WIN_DAYS} days lift what is like them: ${replies} pitch${replies === 1 ? '' : 'es'} answered, ${bookings} booked, ${good_meetings} good meeting${good_meetings === 1 ? '' : 's'} from a row he carried out. Each lifts its kind, sector and topic, at most ${LIFT_MAX} times; nothing that has not won sinks.`;
}
