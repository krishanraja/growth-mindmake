import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readUpcoming, upcomingLine } from '../src/stages/meetings.mjs';

// Integration I-05: the meetings ahead (protocol 1.28.0), read tolerantly and counted in shadow. Synthetic rows only.
const cid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const m = (n, extra = {}) => ({ meeting_id: `m${n}`, starts_at: '2026-11-18T10:00:00Z', contact_id: cid(n), contact_ids: [cid(n)], organizer: 'them', first_meeting: false, ...extra });
const on = { upcoming_meetings: true };

test('without the flag nothing is read or said', () => {
  assert.deepEqual(readUpcoming({ upcoming_meetings: [m(1)] }, {}), { served: false });
  assert.equal(upcomingLine(readUpcoming({}, {})), null);
});

test('served and read: counted by first meeting and organizer, a malformed row dropped and counted', () => {
  const ctx = { coverage: [{ source: 'upcoming_meetings', available: true, complete: false, reason: 'calendar_not_all_read' }], upcoming_meetings: [m(1, { organizer: 'him', first_meeting: true }), m(2), m(3, { organizer: 'other', first_meeting: null }), m(4, { organizer: 'nobody' }), { meeting_id: 'bad' }] };
  const u = readUpcoming(ctx, on);
  assert.deepEqual([u.meetings, u.dropped, u.first, u.first_unknown, u.by], [4, 1, 1, 1, { him: 1, them: 1, other: 1, unknown: 1 }]);
  assert.equal(upcomingLine(u), 'Meetings ahead, in shadow: 4 in the next 14 days with someone Control Center holds, 1 a first meeting (1 unknown); organised by him 1, by them 1, by someone else 1, unknown 1. Nothing acts on them yet. Control Center could not read every calendar, so this is a floor. 1 did not parse and is left out.');
});

test('served but null says why, never zero', () => {
  const u = readUpcoming({ coverage: [{ source: 'upcoming_meetings', available: false, reason: 'upcoming_stale' }], upcoming_meetings: null }, on);
  assert.deepEqual(u, { served: true, read: false, reason: 'upcoming_stale' });
  assert.equal(upcomingLine(u), 'Meetings ahead: not read this run (upcoming_stale), so none are assumed.');
  assert.equal(readUpcoming({}, on).reason, 'upcoming_unread');
});
