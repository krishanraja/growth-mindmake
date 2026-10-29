import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lanesLine, readLanesLine, laneHistory, starvedLanes, poolFlat, poolOf, starvedProposal, sourcingRequests, openPlans, checkIn, checkInWindow, LANE_KEYS, STARVED_RUNS, CHECK_IN_PREFIX, STARVED_PREFIX } from '../src/stages/momentum.mjs';
import { wins, winsLine, LIFT_MAX } from '../src/stages/wins.mjs';
import { pitchScore, speakScore, showTopic } from '../src/stages/pitches.mjs';
import { runDispatch, payloadDigest } from '../src/dispatch.mjs';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { capsReport, capsContext, AT } from './support/caps-scenario.mjs';

// Momentum and wins (C4): a lane at 0 for three runs asks him, a pool that stands
// still asks the research desk, an open plan gets a check-in every other day, and
// a reply, a booking or a good meeting lifts what is like it. History is read from
// Control Center's list of this engine's own reports, never kept here.
const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
const zero = Object.fromEntries(LANE_KEYS.map(k => [k, 0]));
const fed = { ...zero, reach_out: 3, network: 2, visibility: 4, podcasts: 3 };
const report = (lanes, pool) => ({ status: 'held', activity: [{ line: 'Gap: good meetings unknown of 2 this week, U4, short by unknown.' }, { line: lanesLine(lanes, pool) }] });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('the lane line reads back exactly, and unknown stays unknown', () => {
  const line = lanesLine(fed, 259);
  assert.equal(line, 'Lanes: reach_out 3, network 2, visibility 4, events 0, partners 0, invites 0, podcasts 3, stages 0; pool 259.');
  assert.deepEqual(readLanesLine(line), { lanes: fed, pool: 259 });
  assert.deepEqual(readLanesLine(lanesLine({}, null)), { lanes: Object.fromEntries(LANE_KEYS.map(k => [k, null])), pool: null });
  assert.equal(readLanesLine('Rows from the canon: 3 network'), null);
  assert.deepEqual(laneHistory([report(fed, 259), { activity: ['no lane line'] }, report(zero, 250)]).map(h => h.pool), [259, 250]);
  assert.equal(laneHistory(null), null);
});

test('a lane is starved only at 0 on this run and the two before it, and only while it is on', () => {
  const history = laneHistory([report(fed, 259), report(fed, 259)]);
  const holds = [{ reason: 'invite_no_email' }, { reason: 'invite_no_email' }, { reason: 'speak_no_booking_address' }, { reason: 'pitch_quiet_show' }];
  const s = starvedLanes({ lanes: fed, history, holds, on: { partners: false } });
  assert.deepEqual(s.map(x => x.lane), ['events', 'invites', 'stages']);
  assert.deepEqual(s.find(x => x.lane === 'invites').starved_by, ['invite_no_email']);
  assert.deepEqual(s.find(x => x.lane === 'stages').starved_by, ['speak_no_booking_address']);
  assert.equal(s[0].runs_at_zero, STARVED_RUNS);
  // One run before is not enough history, a lane that made something once is fed, and unknown history starves nothing.
  assert.deepEqual(starvedLanes({ lanes: fed, history: history.slice(0, 1), holds }), []);
  assert.ok(!starvedLanes({ lanes: fed, history: laneHistory([report(fed, 1), report({ ...fed, stages: 1 }, 1)]) }).some(x => x.lane === 'stages'));
  assert.deepEqual(starvedLanes({ lanes: fed, history: null }), []);
});

test('the starved ask is one strategy call a week, says what feeds each lane, and is not asked again once answered', () => {
  const starved = starvedLanes({ lanes: fed, history: laneHistory([report(fed, 1), report(fed, 1)]), holds: [] });
  const p = starvedProposal({ starved, weekOf: '2026-10-26', expiresAt: '2026-11-02T00:00:00+00:00', gap: 'Gap: x' });
  assert.equal(p.proposal_id, `${STARVED_PREFIX}2026-10-26`);
  assert.equal(p.wall, 'strategy');
  assert.equal(p.objective_key, 'good_meetings');
  const words = JSON.parse(p.exact_payload);
  assert.deepEqual(words.starved.map(s => s.lane), starved.map(s => s.lane));
  assert.ok(words.starved.every(s => typeof s.feeds_it === 'string' && s.feeds_it));
  assert.ok(p.title.length <= 160 && p.why.length <= 1000);
  assert.equal(starvedProposal({ starved, weekOf: '2026-10-26', expiresAt: 'x', decisions: [{ proposal_id: p.proposal_id, decision: 'approved' }] }), null);
  assert.equal(starvedProposal({ starved: [], weekOf: '2026-10-26', expiresAt: 'x' }), null);
});

test('a pool that stands still for three runs asks for new shows and stages, never a person, once a day', () => {
  const history = laneHistory([report(fed, 259), report(fed, 259)]);
  assert.equal(poolFlat({ pool: 259, history }), true);
  assert.equal(poolFlat({ pool: 260, history }), false, 'a pool that grew is not flat');
  assert.equal(poolFlat({ pool: null, history }), false, 'unknown is never flat');
  assert.equal(poolFlat({ pool: 259, history: history.slice(0, 1) }), false);
  assert.equal(poolOf({ amplifier_candidates: [1, 2], quiet_ties: [1], records: { visibility: [1, 2, 3], guests: [1] } }), 7);
  assert.equal(poolOf(null), null);
  const asks = sourcingRequests({ flat: true, research: [], at: AT });
  assert.equal(asks.length, 2);
  for (const a of asks) {
    assert.equal(a.kind, 'search');
    assert.equal(a.subject_ref, null);
    assert.ok(a.query.length <= 400 && a.why.length <= 300 && !/@|https?:/.test(a.query));
    assert.match(a.request_id, /^source:(podcasts|stages):2026-10-27:[0-9a-f]{8}$/);
  }
  // Waiting or answered: not asked again; over the cap: asked again the next day only.
  assert.equal(sourcingRequests({ flat: true, research: asks.map(a => ({ request_id: a.request_id, status: 'answered' })), at: AT }).length, 0);
  assert.equal(sourcingRequests({ flat: true, research: asks.map(a => ({ request_id: a.request_id, status: 'over_cap' })), at: AT }).length, 0);
  assert.equal(sourcingRequests({ flat: true, research: asks.map(a => ({ request_id: a.request_id, status: 'over_cap' })), at: '2026-10-28T09:00:00Z' }).length, 2);
  assert.deepEqual(sourcingRequests({ flat: true, at: AT, lanesOn: { visibility: false, events: true } }).map(a => a.request_id.split(':')[1]), ['stages']);
  assert.deepEqual(sourcingRequests({ flat: false, at: AT }), []);
});

test('an open plan gets a check-in every other day, kept current until he answers, and his Purge stops it', () => {
  const NOW = '2026-10-27T09:00:00Z';
  const plan = { proposal_id: 'gmc-route-one', decision: 'approved', decided_at: NOW, stage: 'plan', payload_sha256: 'a'.repeat(64) };
  assert.deepEqual(openPlans([plan], '2026-10-26'), ['gmc-route-one']);
  assert.deepEqual(openPlans([plan, { ...plan, decision: 'done', decided_at: '2026-10-28T09:00:00Z' }], '2026-10-26'), [], 'a plan done is closed');
  assert.deepEqual(openPlans([{ ...plan, proposal_id: 'gmg-2026-10-19' }], '2026-10-26'), [], 'the Monday ask is not a plan');
  assert.deepEqual(openPlans([{ ...plan, proposal_id: 'gms-2026-11-09' }], '2026-11-09'), ['gms-2026-11-09'], 'the spec he signed this week is open');
  assert.deepEqual(openPlans([{ ...plan, proposal_id: 'gms-2026-11-02' }], '2026-11-09'), [], "last week's spec is not this week's plan");
  const a = checkIn({ decisions: [plan], weekOf: '2026-10-26', today: '2026-10-27', expiresAt: 'x', gap: 'Gap: y', lanes: fed });
  assert.equal(a.proposal.stage, 'check_in');
  assert.equal(a.proposal.wall, 'strategy');
  assert.equal(a.proposal.parent_proposal_id, 'gmc-route-one');
  assert.ok(a.proposal.proposal_id.startsWith(CHECK_IN_PREFIX) && a.proposal.proposal_id.length <= 120);
  assert.deepEqual(JSON.parse(a.proposal.exact_payload).lanes, fed);
  // The same two-day window keeps the same id; the next window is a new check-in.
  const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
  const windows = days.map(checkInWindow);
  for (let i = 2; i < windows.length; i++) assert.notEqual(windows[i], windows[i - 2], 'never more than two days without a new check-in');
  const ids = days.map(d => checkIn({ decisions: [plan], weekOf: '2026-10-26', today: d, expiresAt: 'x' }).proposal.proposal_id);
  assert.equal(new Set(ids).size, 3);
  // Answered in this window: nothing more until the next one. Purged: no more check-ins for that plan, said once as a hold.
  assert.equal(checkIn({ decisions: [plan, { proposal_id: a.proposal.proposal_id, decision: 'approved', decided_at: NOW }], weekOf: '2026-10-26', today: '2026-10-27', expiresAt: 'x' }).proposal, null);
  const stopped = checkIn({ decisions: [plan, { proposal_id: a.proposal.proposal_id, decision: 'declined', decided_at: NOW }], weekOf: '2026-10-26', today: '2026-10-29', expiresAt: 'x' });
  assert.equal(stopped.proposal, null);
  assert.deepEqual(stopped.holds.map(h => h.reason), ['check_in_stopped']);
  assert.equal(checkIn({ decisions: [], weekOf: '2026-10-26', today: '2026-10-27', expiresAt: 'x' }).proposal, null, 'no plan open, no check-in');
});

test('a reply, a booking or a good meeting lifts what is like it, capped, never under 1', () => {
  const show = n => ({ id: id(400 + n), title: `The Example Leadership Show ${n}`, type: 'podcast', audience: 'Chief executives at mid-size companies', episodes: 40, latest_episode_at: '2026-10-20T00:00:00Z', verdict: 'take' });
  const none = wins({ context: { records: { visibility: [show(1)], drafts: [] }, feedback: [] }, at: AT });
  assert.equal(none.any, false);
  assert.equal(none.lift({ kind: 'podcast', topic: 'leadership' }), 1);
  assert.match(winsLine(none), /nothing is lifted yet/);
  const context = {
    records: { visibility: [show(1), show(2)], drafts: [{ visibility_target_id: id(401), replied_at: '2026-10-20T00:00:00Z' }, { visibility_target_id: id(402), booked_at: '2026-10-21T00:00:00Z', replied_at: '2026-10-19T00:00:00Z' }, { visibility_target_id: id(402), booked_at: '2026-10-22T00:00:00Z' }] },
    feedback: [{ subject_ref: `contact:${id(9)}`, carried_out: true, amplifier_kind: 'connector', features: { sector: 'media', topic: null } }, { subject_ref: `contact:${id(10)}`, carried_out: false, amplifier_kind: 'investor', features: {} }]
  };
  const meetings = [{ contact_id: id(9), good: true, held_at: '2026-10-23T10:00:00Z' }, { contact_id: id(10), good: true, held_at: '2026-10-23T10:00:00Z' }];
  const w = wins({ context, meetings, at: AT });
  assert.deepEqual(w.counts, { replies: 1, bookings: 1, good_meetings: 1 }, 'one show once; a meeting counts only after a row he carried out');
  assert.equal(w.lift({ kind: 'podcast' }), 1.3);
  assert.equal(w.lift({ kind: 'connector', sector: 'media' }), LIFT_MAX, 'a kind and its sector together, capped');
  assert.equal(w.lift({ kind: 'connector', sector: 'finance' }), 1.3);
  assert.equal(w.lift({ kind: 'investor' }), 1, 'a meeting with no row he carried out lifts nothing');
  assert.match(winsLine(w), /1 pitch answered, 1 booked, 1 good meeting/);
  // Outside the window, or after now, counts nothing.
  assert.equal(wins({ context, meetings: [{ contact_id: id(9), good: true, held_at: '2026-01-01T00:00:00Z' }], at: AT }).counts.good_meetings, 0);
  // The lift reaches the rank: a show of a kind that answered scores higher than the same show without it.
  const t = show(3);
  assert.ok(pitchScore(t, AT, w) > pitchScore(t, AT));
  assert.equal(pitchScore(t, AT, none), pitchScore(t, AT));
  const stage = { ...t, type: 'conference', deadline_at: '2026-12-01T00:00:00Z' };
  // A stage shares the topic's lift, never the podcast kind's.
  assert.ok(Math.abs(speakScore(stage, AT, w) / speakScore(stage, AT) - w.lift({ kind: 'stage', topic: showTopic(stage) })) < 1e-9);
  assert.ok(w.lift({ kind: 'stage', topic: showTopic(stage) }) < w.lift({ kind: 'podcast', topic: showTopic(stage) }));
});

test('a live run with three flat runs behind it leads with the gap and its lanes, asks him once, and asks the desk for shows and stages', async () => {
  const flat = { ...fed, events: 0, partners: 0, invites: 0, stages: 0 };
  const pool = (() => { const c = capsContext(); return c.amplifier_candidates.length + c.records.visibility.length + c.records.guests.length; })();
  const asked = [];
  const research = async requests => { asked.push(...requests); return requests.map(r => ({ request_id: r.request_id, status: 'empty', results: [] })); };
  const history = async () => [report(flat, pool), report(flat, pool)];
  const stagesOff = () => { const c = capsContext(); c.records.visibility = c.records.visibility.filter(t => t.type === 'podcast'); c.records.guests = []; return c; };
  const { result, report: rep } = await capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy, context: stagesOff, features: { research: true }, research, run: { historyReader: history } });
  assert.equal(result.status, 'succeeded');
  assert.match(rep.activity[0].line, /^Gap: /);
  assert.match(rep.activity[1].line, /^Lanes: /);
  const lanes = readLanesLine(rep.activity[1].line);
  assert.equal(lanes.lanes.stages, 0);
  const ask = rep.proposals.find(p => p.proposal_id.startsWith(STARVED_PREFIX));
  assert.ok(ask, 'one strategy ask for the starved lanes');
  assert.ok(JSON.parse(ask.exact_payload).starved.some(s => s.lane === 'stages'));
  assert.equal(ask.payload_sha256, payloadDigest((({ payload_sha256, ...b }) => b)(ask)));
  assert.ok(rep.activity.some(a => /^Starved: /.test(a.line)));
  // The pool shrank against three runs ago, so the desk is asked for new shows and stages, after any address lookups.
  assert.ok(asked.some(r => r.request_id.startsWith('source:podcasts:')));
  assert.ok(rep.activity.some(a => /asked the research desk for new shows and stages/.test(a.line)));
  // Without the history (Control Center does not list recent reports), nothing is assumed starved and nothing is sourced.
  asked.length = 0;
  const bare = await capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy, context: stagesOff, features: { research: true }, research });
  assert.ok(!bare.report.proposals.some(p => p.proposal_id.startsWith(STARVED_PREFIX)));
  assert.ok(!asked.some(r => r.request_id.startsWith('source:')));
  assert.ok(bare.report.activity.some(a => /^Starved lanes: not known/.test(a.line)));
});
