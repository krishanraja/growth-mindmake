/**
 * What the crew's measured checks share (plan section 3, "Measured check"):
 * pure reads of Control Center's readback, each a measurement `{ check,
 * value, reason }`. A value is a count that was measured, or null with the
 * reason it was not: never a zero nobody measured. Reported as activity
 * lines only, never an objective and never in the printed run result.
 */
import { countGood } from '../../stages/meetings.mjs';
import { stageKind } from '../../stages/pitches.mjs';

const DAY = 86400000;
export const measured = (check, value) => ({ check, value, reason: null });
export const unknown = (check, reason) => ({ check, value: null, reason });

/**
 * Replies within 7 days to what he carried out on these rows in the last 30:
 * the person's last email is after his press and within the week. Null when
 * he carried out nothing there, or the email dates are not served.
 */
export function replies(check, { context, at }, onRow) {
  const people = new Map([...(context?.network ?? []), ...(context?.quiet_ties ?? []), ...(context?.amplifier_candidates ?? [])].filter(c => typeof c?.contact_id === 'string').map(c => [`contact:${c.contact_id.toLowerCase()}`, c]));
  const now = Date.parse(at);
  const done = (Array.isArray(context?.feedback) ? context.feedback : []).filter(f => f?.carried_out && onRow(f) && Number.isFinite(Date.parse(f.decided_at ?? '')) && now - Date.parse(f.decided_at) <= 30 * DAY);
  if (!done.length) return unknown(check, 'nothing carried out on these rows in 30 days');
  let dated = 0, n = 0;
  for (const f of done) {
    const last = Date.parse(people.get(String(f.subject_ref ?? '').toLowerCase())?.email_last ?? '');
    if (!Number.isFinite(last)) continue;
    dated++;
    const t = Date.parse(f.decided_at);
    if (last > t && last - t <= 7 * DAY) n++;
  }
  return dated ? measured(check, n) : unknown(check, 'no email dates served for the people pressed');
}

/** Good meetings last week on one path, from his taps; null while taps are not served. */
export function goodOn(check, { taps, lastWeek, londonDate }, path) {
  if (!taps || taps.state !== 'served') return unknown(check, 'his taps after each meeting are not served yet');
  if (!taps.complete) return unknown(check, 'not every meeting was read');
  return measured(check, countGood(taps.meetings, lastWeek, londonDate).by_path[path] ?? 0);
}

/** What became of Jonny's pitches to one kind of stage, from the 1.9.0 outcomes: sent, replied, booked, recorded, published. */
export function outcomes(prefix, { context }, kind) {
  const drafts = context?.records?.drafts;
  const keys = ['sent', 'replied', 'booked', 'recorded', 'published'];
  if (!Array.isArray(drafts)) return keys.map(k => unknown(`${prefix}.${k}`, 'pitch outcomes are not served'));
  const targets = new Map((Array.isArray(context?.records?.visibility) ? context.records.visibility : []).filter(t => typeof t?.id === 'string').map(t => [t.id.toLowerCase(), t]));
  const mine = drafts.filter(d => d?.mailbox === 'jonny' && typeof d.visibility_target_id === 'string' && stageKind(targets.get(d.visibility_target_id.toLowerCase())) === kind);
  return keys.map(k => measured(`${prefix}.${k}`, mine.filter(d => typeof d[`${k}_at`] === 'string' && Number.isFinite(Date.parse(d[`${k}_at`]))).length));
}
