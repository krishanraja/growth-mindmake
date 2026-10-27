/**
 * The Measurement Specialist's measured checks: good meetings last week from
 * his taps, and meetings with no path to match. Traffic counts stay in the
 * traffic lines (traffic.mjs), never here. Pure.
 */
import { countGood } from '../../stages/meetings.mjs';
import { measured, unknown } from './common.mjs';

export const SPECIALIST = 'measurement-specialist';
export const CHECKS = ['measurement.good_meetings', 'measurement.unmatched'];
export function measure({ taps, lastWeek, londonDate, origin_candidates }) {
  if (!taps || taps.state !== 'served') return CHECKS.map(c => unknown(c, 'his taps after each meeting are not served yet'));
  const open = new Set(taps.meetings.filter(m => m.good === null && m.origin_path === null).map(m => m.contact_id));
  const matched = new Set((origin_candidates ?? []).map(c => c.contact_id));
  return [
    taps.complete ? measured('measurement.good_meetings', countGood(taps.meetings, lastWeek, londonDate).total) : unknown('measurement.good_meetings', 'not every meeting was read'),
    measured('measurement.unmatched', [...open].filter(c => !matched.has(c)).length)
  ];
}
