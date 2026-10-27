import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRoomAxes, clamp, roomJudgmentFrom, hostKindOf, roomRank, rankRooms, buyerRoom, roomIsLive, actionability, needsJudging, roomVerdict, roomsShadow,
  ROOM_WEIGHTS, NAMED_ATTENDEE_BONUS_CAP, ROOM_SCORE_VERSION } from '../src/stages/rooms.mjs';

// Room scoring, ported from Control Center (plan section 12, M5). Every room,
// name and id below is invented. The densities are honest reads of the kinds
// of room Control Center's own tests use; what is under test is the maths.
//
// Parity table (Control Center tests/api/eventScore.test.ts: engine test):
//   a room of founders beats a room of developers:                      the same
//   a practitioner room is driven to zero on Draw:                      the same
//   adtech BUYERS keep their Demand score:                              the same, read as "a buyer room keeps Demand"
//   a peer room still outranks a buyer room overall:                    the same, through roomRank (events_for)
//   a paid mixer that advertises founders with no bar does not win:     the same
//   the practitioner penalty is heavier on Draw than on Demand:         the same
//   a vendor HOST with a room of its own customers is not a vendor room: the same
//   a named attendee is worth a bounded bonus, only in a peer room:     the same
//   one name does not make a room: the bonus is capped:                 the same
//   scores stay inside 0-100 whatever the model returns:                the same
//   a missing or junk density reads as zero, never NaN:                 the same
//   the score version is stamped:                                       the same
// Added for the rules the engine reads with them: the host kind a judgment
// sets (api/events/score.ts), the queue (api/events/score.ts), the gate and
// actionability (events_recommendable, events_for) and the shadow.

const AT = '2026-10-27T09:00:00.000Z';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DEV_MEETUP = { peer_density: 5, buyer_density: 5, practitioner_density: 95, vendor_density: 10, seniority: 25 };
const CLOUD_EVENING = { peer_density: 8, buyer_density: 20, practitioner_density: 85, vendor_density: 70, seniority: 30 };
const HACKATHON = { peer_density: 10, buyer_density: 5, practitioner_density: 98, vendor_density: 15, seniority: 20 };
const BUYER_SUMMIT = { peer_density: 30, buyer_density: 80, practitioner_density: 10, vendor_density: 45, seniority: 80 };
const OWNERS_CLUB = { peer_density: 92, buyer_density: 45, practitioner_density: 5, vendor_density: 10, seniority: 85 };
const OPEN_MIXER = { peer_density: 45, buyer_density: 35, practitioner_density: 15, vendor_density: 40, seniority: 40 };
const draw = e => computeRoomAxes(e).draw_score;
const demand = e => computeRoomAxes(e).demand_score;
const rank = e => roomRank(computeRoomAxes(e));

test('a room of founders beats a room of developers', () => {
  assert.ok(draw(OWNERS_CLUB) > draw(DEV_MEETUP));
  assert.ok(draw(OWNERS_CLUB) > draw(HACKATHON));
  assert.ok(draw(OWNERS_CLUB) > draw(CLOUD_EVENING));
  assert.deepEqual(computeRoomAxes(OWNERS_CLUB), { draw_score: 86, demand_score: 55 }, "Control Center's answer for the same room");
});

test('a practitioner room is driven to zero on Draw, not merely ranked lower', () => {
  assert.equal(draw(DEV_MEETUP), 0);
  assert.equal(draw(HACKATHON), 0);
  assert.equal(draw(CLOUD_EVENING), 0);
});

test('a room of buyers keeps its Demand: they are who he sells to, not the problem', () => {
  assert.ok(demand(BUYER_SUMMIT) >= 50);
  assert.ok(demand(BUYER_SUMMIT) > demand(DEV_MEETUP));
  assert.equal(buyerRoom(computeRoomAxes(BUYER_SUMMIT)), true);
  assert.equal(buyerRoom({ buyer_density: 0, demand_score: 0 }), false);
});

test('a peer room still outranks a buyer room overall, because he asked to meet peers first', () => {
  assert.ok(rank(OWNERS_CLUB) > rank(BUYER_SUMMIT));
  assert.equal(roomRank({ draw_score: 86, demand_score: 55 }), 72.1, 'Draw 55, Demand 45, to one decimal place');
  assert.equal(roomRank({ draw_score: null, demand_score: null }), 0);
});

test('a paid mixer that advertises founders with no bar does not beat a real peer room', () => {
  assert.ok(draw(OWNERS_CLUB) > draw(OPEN_MIXER));
});

test('the practitioner penalty is heavier on Draw than on Demand, on purpose', () => {
  assert.ok(Math.abs(ROOM_WEIGHTS.draw.practitioner) > Math.abs(ROOM_WEIGHTS.demand.practitioner));
});

test('a vendor host with a room of its own customers is not a vendor room', () => {
  const vendorRoom = { peer_density: 10, buyer_density: 30, practitioner_density: 20, vendor_density: 85, seniority: 40 };
  const customerRoom = { peer_density: 25, buyer_density: 85, practitioner_density: 15, vendor_density: 15, seniority: 75 };
  assert.ok(demand(customerRoom) > demand(vendorRoom) + 30);
});

test('a named attendee is worth a bounded bonus, and only in a room already reading as peers', () => {
  const base = { peer_density: 70, buyer_density: 40, practitioner_density: 10, vendor_density: 10, seniority: 70 };
  const named = { ...base, named_attendees: ['Ada Example, CEO at Example Co', 'Ben Example, Founder at Example Labs'] };
  assert.ok(draw(named) > draw(base));
  assert.ok(draw(named) - draw(base) <= NAMED_ATTENDEE_BONUS_CAP);
  assert.equal(draw({ ...DEV_MEETUP, named_attendees: ['Cy Example, CTO at Example Corp'] }), draw(DEV_MEETUP));
});

test('one name does not make a room: the bonus is capped', () => {
  const base = { peer_density: 60, buyer_density: 30, practitioner_density: 5, vendor_density: 5, seniority: 60 };
  const many = { ...base, named_attendees: Array.from({ length: 12 }, (_, i) => `Person ${i}, CEO`) };
  assert.ok(draw(many) - draw(base) <= NAMED_ATTENDEE_BONUS_CAP);
});

test('scores stay inside 0 to 100 whatever the judge returns', () => {
  const worst = { peer_density: 0, buyer_density: 0, practitioner_density: 100, vendor_density: 100, seniority: 0 };
  const best = { peer_density: 100, buyer_density: 100, practitioner_density: 0, vendor_density: 0, seniority: 100, named_attendees: ['A, CEO', 'B, CEO'] };
  for (const e of [worst, best]) {
    const { draw_score, demand_score } = computeRoomAxes(e);
    assert.ok(draw_score >= 0 && draw_score <= 100);
    assert.ok(demand_score >= 0 && demand_score <= 100);
  }
});

test('a missing or junk density reads as zero, never as NaN', () => {
  assert.equal(clamp(Number(undefined)), 0);
  assert.equal(clamp(Number('not a number')), 0);
  assert.equal(clamp(Number.POSITIVE_INFINITY), 0);
  assert.ok(Number.isInteger(computeRoomAxes({ peer_density: Number('x'), buyer_density: 50, practitioner_density: 0, vendor_density: 0, seniority: 50 }).draw_score));
  const j = roomJudgmentFrom({ peer_density: 'x', buyer_density: '70', practitioner_density: null, vendor_density: 5, seniority: 60, named_attendees: [' Ada Example, CEO ', '', 4] });
  assert.equal(j.peer_density, 0);
  assert.equal(j.buyer_density, 70);
  assert.deepEqual(j.named_attendees, ['Ada Example, CEO']);
  assert.throws(() => roomJudgmentFrom('not json'), /event_score_unparseable/);
});

test('the score version is stamped, so a mixed corpus is visible', () => {
  assert.ok(Number.isInteger(ROOM_SCORE_VERSION) && ROOM_SCORE_VERSION >= 1);
  assert.equal(roomJudgmentFrom(OWNERS_CLUB).score_version, ROOM_SCORE_VERSION);
});

test('the host kind a judgment sets: who is in the room, else what was recorded', () => {
  assert.equal(hostKindOf({ vendor_density: 70, practitioner_density: 90, peer_density: 90 }), 'vendor');
  assert.equal(hostKindOf({ vendor_density: 10, practitioner_density: 60, peer_density: 90 }), 'community');
  assert.equal(hostKindOf({ vendor_density: 10, practitioner_density: 10, peer_density: 50 }), 'operator');
  assert.equal(hostKindOf({ vendor_density: 10, practitioner_density: 10, peer_density: 40 }, 'member_org'), 'member_org');
  assert.equal(hostKindOf({ vendor_density: 10, practitioner_density: 10, peer_density: 40 }), 'unknown');
});

test('a room may be shown until it ends, with a verified date, and his city is passed in', () => {
  const room = { id: id(1), starts_at: '2026-10-27T18:00:00Z', date_verified: true, archived_at: null, city: 'Example City' };
  assert.equal(roomIsLive(room, AT), true);
  assert.equal(roomIsLive({ ...room, starts_at: '2026-10-26T18:00:00Z' }, AT), false, 'over twelve hours after it started');
  assert.equal(roomIsLive({ ...room, starts_at: '2026-10-26T18:00:00Z', ends_at: '2026-10-28T18:00:00Z' }, AT), true, 'a conference still running');
  assert.equal(roomIsLive({ ...room, date_verified: false }, AT), false);
  assert.equal(roomIsLive({ ...room, archived_at: '2026-10-26T00:00:00Z' }, AT), false);
  assert.equal(roomIsLive({ ...room, starts_at: null }, AT), false);
  assert.equal(actionability(room, 'Example City', AT), 'home');
  assert.equal(actionability({ ...room, city: 'virtual' }, 'Example City', AT), 'home');
  assert.equal(actionability({ ...room, city: 'Elsewhere', named_attendees: ['Ada Example'] }, 'Example City', AT), 'away, named attendee');
  assert.equal(actionability({ ...room, city: 'Elsewhere', starts_at: '2026-12-01T18:00:00Z' }, 'Example City', AT), 'away, bookable');
  assert.equal(actionability({ ...room, city: 'Elsewhere' }, 'Example City', AT), 'away, needs a trip');
  const order = rankRooms([
    { id: 'a', city: 'Elsewhere', draw_score: 90, demand_score: 90, starts_at: '2026-11-01T00:00:00Z' },
    { id: 'b', city: 'Example City', draw_score: 40, demand_score: 40, starts_at: '2026-11-03T00:00:00Z' },
    { id: 'c', city: 'Example City', draw_score: 40, demand_score: 40, starts_at: '2026-11-02T00:00:00Z' },
    { id: 'd', city: 'virtual', draw_score: 60, demand_score: 60, starts_at: '2026-11-05T00:00:00Z' },
  ], 'Example City').map(e => e.id);
  assert.deepEqual(order, ['d', 'c', 'b', 'a'], 'his city first, then the rank, then the sooner start');
});

test('which rooms Control Center judges next: never scored, the old Draw, an older version, or 30 days old unless he corrected it', () => {
  const e = { starts_at: '2026-11-20T18:00:00Z', archived_at: null, scored_at: '2026-10-20T00:00:00Z', scored_source: 'cron', score_version: 1 };
  assert.equal(needsJudging(e, AT), false);
  assert.equal(needsJudging({ ...e, scored_at: null }, AT), true);
  assert.equal(needsJudging({ ...e, scored_source: 'vps_legacy' }, AT), true);
  assert.equal(needsJudging({ ...e, score_version: 0 }, AT), true);
  assert.equal(needsJudging({ ...e, scored_at: '2026-09-01T00:00:00Z' }, AT), true);
  assert.equal(needsJudging({ ...e, scored_at: '2026-09-01T00:00:00Z', scored_source: 'manual' }, AT), false, 'his correction is never overwritten for being old');
  assert.equal(needsJudging({ ...e, starts_at: '2026-10-20T00:00:00Z', scored_at: null }, AT), false, 'a finished room is not judged');
});

test('in shadow: every room counted, none comparable until Control Center serves its densities and scores', () => {
  const room = (n, over) => ({ id: id(n), title: `The Example Forum ${n}`, host: 'Example Host', url: `https://forum.example.org/${n}`, starts_at: '2026-11-20T18:00:00Z', city: 'Example City', date_verified: true, named_attendees: null, decision: null, archived_at: null, ...over });
  const today = { records: { events: [room(1), room(2, { date_verified: false }), room(3, { starts_at: '2026-10-01T18:00:00Z' }), room(1)] } };
  const frozen = structuredClone(today);
  const out = roomsShadow({ context: today, at: AT, homeCity: 'Example City' });
  assert.equal(out.line, 'Room scoring, in shadow: 3 rooms read, 1 live by the room gate; agrees with Control Center on 0, differs on 0; 3 not comparable (scores_not_served 3).');
  assert.deepEqual(today, frozen);
  assert.equal(out.verdicts[0].actionability, 'home');
  assert.doesNotMatch(out.line, /Example Forum|Example City|0000/);
  // Once Control Center serves the densities and its stored axes, they are compared.
  const axes = computeRoomAxes(OWNERS_CLUB);
  const served = { records: { events: [
    room(4, { ...OWNERS_CLUB, ...axes, score_version: 1 }),
    room(5, { ...OWNERS_CLUB, draw_score: axes.draw_score - 9, demand_score: axes.demand_score, score_version: 1 }),
    room(6, { ...OWNERS_CLUB, ...axes, score_version: 0 }),
  ] } };
  const next = roomsShadow({ context: served, at: AT });
  assert.equal(next.line, 'Room scoring, in shadow: 3 rooms read, 3 live by the room gate; agrees with Control Center on 1, differs on 1 (axes_disagree 1); 1 not comparable (older_version 1).');
  assert.equal(roomVerdict(room(7, OWNERS_CLUB), { at: AT }).rank, 72.1);
  assert.equal(roomVerdict(room(7, OWNERS_CLUB), { at: AT }).host_kind, 'operator');
});
