import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readLadder, ladderTarget, readNorthStar, readConstraints, stopgapProposal, stopgapPayload, readStopgap, bookings, PATHS } from '../src/stages/meetings.mjs';
import { runDispatch, payloadDigest, amendedDigestOk, campaignProposal, londonDate, addDays, LADDER } from '../src/dispatch.mjs';
import { OBJECTIVE } from '../src/stages/rows.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { golden } from './support/golden.mjs';

// A Tuesday: this London week starts 2026-11-02, so last week (2026-10-26) is the first counted rung.
const NOW = '2026-11-03T12:00:00Z';
const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
const amended = (proposal_id, exact_payload, extra = {}) => ({ proposal_id, decision: 'approved', decided_at: '2026-11-02T09:00:00Z', payload_sha256: 'a'.repeat(64), stage: 'plan', amended: true, exact_payload, amount_usd: null, amended_sha256: payloadDigest({ amount_usd: null, exact_payload }), ...extra });
const answer = (total, by_path = {}, week = '2026-10-26') => JSON.stringify({ week_of: week, total, by_path, how: 'typed' });

function harness({ decisions = [], capabilities = { activation: { activated_on: '2026-10-18' }, features: {} }, context = null, directive = directiveFixture(), prepareAction } = {}) {
  const reports = [], prepared = [];
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directive, capabilities: async () => capabilities,
    decisions: async () => decisions, readReport: async () => { const r = reports.at(-1); if (!r) throw Object.assign(new Error('none'), { status: 404 }); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, report: r }; },
    postReport: async r => { reports.push(golden(r)); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
    context: async () => ({ ok: true, context }), outcomes: async () => { throw new Error('not served'); },
    prepareAction: async id => { prepared.push(id); if (prepareAction) return prepareAction(id); throw new Error('no route'); },
    actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); }, executeAction: async () => { throw new Error('no executor'); }
  };
  return { cc, reports, prepared };
}
const run = (h, extra = {}) => runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode: 'synthetic', attemptId: 'gma-synthetic-12345678', clock: () => NOW, ...extra });

test('the ladder is read from docs/NORTH_STAR.md itself, and a week takes its own rung', () => {
  assert.deepEqual(LADDER[0], ['2026-10-26', 2]);
  assert.deepEqual(LADDER.at(-1), ['2026-11-30', 20]);
  assert.equal(ladderTarget(LADDER, '2026-10-26'), 2);
  assert.equal(ladderTarget(LADDER, '2026-11-17'), 11);
  assert.equal(ladderTarget(LADDER, '2026-10-12'), 2);
  assert.equal(ladderTarget([], '2026-11-02'), null);
  assert.deepEqual(readLadder('no block'), []);
});

test("the directive's private figures stay unknown, and its constraints are read as data", () => {
  assert.deepEqual(readNorthStar({ north_star: { own: { week_target: 'private', urgency: 4, urgency_reason: 'not measured' }, intensity: { urgency: 4 } } }), { week_target: null, current: null, urgency: 4, reason: 'not measured' });
  assert.deepEqual(readNorthStar({}), { week_target: null, current: null, urgency: null, reason: null });
  assert.equal(readNorthStar({ north_star: { own: { current: 3 } } }).current, 3);
  assert.deepEqual(readConstraints({ constraints: { spend_cap_usd: 0, max_actions: 5 } }), { max_actions: 5, spend_cap_usd: 0 });
  assert.equal(readConstraints({}), null);
});

test('the Monday ask is a stable strategy plan with every path null, inside the length limit', () => {
  const p = stopgapProposal({ weekOf: '2026-10-26', expiresAt: '2026-11-09T00:00:00+00:00', target: 2 });
  assert.equal(p.proposal_id, 'gmg-2026-10-26'); assert.equal(p.stage, 'plan'); assert.equal(p.wall, 'strategy'); assert.equal(p.objective_key, 'good_meetings');
  const payload = JSON.parse(p.exact_payload);
  assert.equal(payload.total, null); assert.deepEqual(Object.keys(payload.by_path), PATHS); assert.ok(Object.values(payload.by_path).every(v => v === null));
  assert.ok(p.exact_payload.length < 8000);
  assert.equal(stopgapPayload('2026-10-26'), p.exact_payload);
});

test('only his amended, digest-verified answer is counted; anything else is unknown, never zero', () => {
  const d = payloadDigest;
  assert.equal(readStopgap([], '2026-10-26', d).state, 'unanswered');
  assert.equal(readStopgap([{ proposal_id: 'gmg-2026-10-26', decision: 'declined', decided_at: NOW }], '2026-10-26', d).state, 'declined');
  assert.equal(readStopgap([{ proposal_id: 'gmg-2026-10-26', decision: 'approved', decided_at: NOW, amended: false }], '2026-10-26', d).state, 'cleared_without_counts');
  assert.equal(readStopgap([amended('gmg-2026-10-26', answer(3), { amended_sha256: 'b'.repeat(64) })], '2026-10-26', d).state, 'digest_mismatch');
  assert.equal(readStopgap([amended('gmg-2026-10-26', answer(null))], '2026-10-26', d).state, 'unreadable');
  assert.equal(readStopgap([amended('gmg-2026-10-26', answer(3, {}, '2026-10-19'))], '2026-10-26', d).state, 'unreadable');
  assert.equal(readStopgap([amended('gmg-2026-10-26', answer(1, { podcast: 2 }))], '2026-10-26', d).state, 'unreadable');
  assert.equal(readStopgap([amended('gmg-2026-10-26', answer(2, { 'a-list': 1 }))], '2026-10-26', d).state, 'unreadable');
  assert.deepEqual(readStopgap([amended('gmg-2026-10-26', answer(3, { podcast: 1, 'existing-relationship': 1, inbound: null }))], '2026-10-26', d), { state: 'counted', total: 3, by_path: { podcast: 1, 'existing-relationship': 1 } });
});

test('an amended digest is recomputed over exactly amount_usd and exact_payload', () => {
  const ok = amended('gmc-x', 'words');
  assert.equal(amendedDigestOk(ok), true);
  assert.equal(amendedDigestOk({ ...ok, exact_payload: 'other words' }), false);
  assert.equal(amendedDigestOk({ ...ok, amended_sha256: undefined }), false);
  const { amount_usd, ...noAmount } = ok;
  assert.equal(amendedDigestOk(noAmount), true);
});

test('an unanswered week posts the Monday ask and reports the number as missing with its reason', async () => {
  const h = harness();
  const result = await run(h);
  assert.equal(result.status, 'succeeded');
  const [report] = h.reports;
  const ask = report.proposals.find(p => p.proposal_id === 'gmg-2026-10-26');
  assert.ok(ask); assert.equal(ask.stage, 'plan'); assert.equal(ask.expires_at, '2026-11-09T00:00:00+00:00');
  const gm = report.objectives.find(o => o.key === 'good_meetings');
  assert.equal(gm.value, null); assert.equal(gm.availability, 'missing'); assert.match(gm.reason, /not answered yet/);
  assert.ok(report.activity.some(a => /This week's target is 5 \(the ladder/.test(a.line)));
  assert.equal(report.objectives[0].key, 'good_meetings');
});

test("his typed answer is the week's number, and the ask is not posted again", async () => {
  const h = harness({ decisions: [amended('gmg-2026-10-26', answer(3, { podcast: 2, inbound: 1 }))] });
  await run(h);
  const [report] = h.reports;
  assert.equal(report.proposals.some(p => p.proposal_id.startsWith('gmg-')), false);
  const gm = report.objectives.find(o => o.key === 'good_meetings');
  assert.equal(gm.value, 3); assert.equal(gm.availability, 'measured'); assert.equal(gm.window_start, '2026-10-26T00:00:00+00:00');
  assert.ok(report.activity.some(a => /Good meetings in the week of 2026-10-26: 3 against a target of 2/.test(a.line)));
});

test('before the first counted week ends, nothing is asked and nothing is claimed', async () => {
  const h = harness();
  await runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'x', detail: 'y' } }), policy, registry: {}, mode: 'synthetic', attemptId: 'gma-synthetic-12345678', clock: () => '2026-10-28T12:00:00Z' });
  const [report] = h.reports;
  assert.equal(report.proposals.some(p => p.proposal_id.startsWith('gmg-')), false);
  assert.match(report.objectives.find(o => o.key === 'good_meetings').reason, /first counted week/);
});

test('decisions that cannot be read leave the number unknown and the ask posted', async () => {
  const h = harness();
  h.cc.decisions = async () => { throw Object.assign(new Error('down'), { status: 503 }); };
  await run(h);
  const [report] = h.reports;
  assert.ok(report.holds.some(x => x.reason === 'decisions_unavailable'));
  assert.ok(report.proposals.some(p => p.proposal_id === 'gmg-2026-10-26'));
  assert.equal(report.objectives.find(o => o.key === 'good_meetings').value, null);
});

test('only campaign plans reach prepare-action; an amended one is used only after its digest verifies (N18, N15)', async () => {
  const caps = { activation: { activated_on: '2026-10-18' }, features: { exact_actions: true } };
  const decisions = [
    amended('gmg-2026-10-26', answer(1)),
    { proposal_id: 'gms-2026-11-09', decision: 'approved', decided_at: NOW, payload_sha256: 'c'.repeat(64), stage: 'plan', amended: false },
    { proposal_id: 'gmc-plain', decision: 'approved', decided_at: NOW, payload_sha256: 'd'.repeat(64), stage: 'plan', amended: false },
    amended('gmc-tampered', 'his words', { amended_sha256: 'e'.repeat(64) })
  ];
  const h = harness({ decisions, capabilities: caps });
  await runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'x', detail: 'y' } }), policy, registry: {}, mode: 'live', attemptId: 'gma-synthetic-12345678', clock: () => NOW });
  assert.deepEqual(h.prepared, ['gmc-plain']);
  assert.ok(h.reports[0].holds.some(x => x.reason === 'amended_digest_mismatch'));
});

test('a campaign plan longer than the protocol allows is held, and the report still goes (N16)', () => {
  const long = { ref: 'pilot:1', reviewed_at: NOW, title: 'A long plan', argument: 'x', commitment: 'y', preparation: 'z', sources: [], first_action: { recipient_contact_id: 'c1', body: 'b'.repeat(9000) } };
  assert.ok(campaignProposal(long).exact_payload.length > 8000);
});

test('bookings count podcasts booked this week and stages confirmed in the last fourteen days, once each', () => {
  const pod = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pod2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stage = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const context = {
    coverage: [{ source: 'drafts', available: true }],
    records: {
      visibility: [{ id: pod, type: 'podcast' }, { id: pod2, type: 'podcast' }, { id: stage, type: 'cfp' }],
      drafts: [
        { visibility_target_id: pod, booked_at: '2026-11-02T10:00:00Z' },
        { visibility_target_id: pod, booked_at: '2026-11-02T11:00:00Z' },
        { visibility_target_id: pod2, booked_at: '2026-10-30T10:00:00Z' },
        { visibility_target_id: stage, booked_at: '2026-10-25T10:00:00Z' },
        { visibility_target_id: pod2, booked_at: '2026-11-05T10:00:00Z' }
      ]
    }
  };
  assert.deepEqual(bookings({ context, at: NOW, weekStart: '2026-11-02', londonDate, addDays }), { podcasts: 1, stages: 1 });
  assert.equal(bookings({ context: { ...context, coverage: [] }, at: NOW, weekStart: '2026-11-02', londonDate, addDays }), null);
});

test('the printed outcome carries no count of meetings, bookings or traffic', async () => {
  const h = harness({ decisions: [amended('gmg-2026-10-26', answer(7))] });
  const result = await run(h);
  assert.deepEqual(result.report.objectives.find(o => o.key === 'good_meetings'), { key: 'good_meetings', availability: 'measured' });
  assert.equal(JSON.stringify(result).includes('"value"'), false);
});

// ── Held meetings and his good tap (protocol 1.10.0, synthetic shapes) ──────

import { readMeetings, countGood, originCandidates, meetingsServed, MEETINGS_VERSION, ORIGIN_CANDIDATES_MAX } from '../src/stages/meetings.mjs';
import { violations } from './support/engine-protocol-service.mjs';

const cid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mtg = (n, over = {}) => ({ meeting_id: `mtg_${String(n).padStart(32, '0')}`, contact_id: cid(n), held_at: '2026-10-28T10:00:00Z', good: null, good_at: null, origin_path: null, origin_ref: null, assists: [], said_yes_because: null, ...over });
const covered = (over = {}) => ({ source: 'meetings', available: true, complete: true, rows: 0, observed_at: NOW, reason: null, ...over });
const SERVED_ALL = ['1.6.0', '1.7.0', '1.8.0', '1.9.0', MEETINGS_VERSION];

test('held meetings are read only where served and available; a row that does not parse is left out and counted', () => {
  assert.equal(meetingsServed({ schema_versions: SERVED_ALL, features: { meetings: true } }), true);
  assert.equal(meetingsServed({ schema_versions: SERVED_ALL, features: {} }), false, 'the flag, not the version alone');
  assert.equal(meetingsServed({ schema_versions: ['1.9.0'], features: { meetings: true } }), false);
  assert.deepEqual(readMeetings({ coverage: [] }), { state: 'unserved', reason: 'meetings_not_in_context' });
  assert.deepEqual(readMeetings({ coverage: [covered({ available: false, reason: 'calendar_read_stale' })], meetings: [] }), { state: 'unavailable', reason: 'calendar_read_stale' });
  const r = readMeetings({ coverage: [covered()], meetings: [mtg(1), { ...mtg(2), contact_id: 'someone@example.com' }, { ...mtg(3), origin_path: 'made-up' }] });
  assert.equal(r.state, 'served');
  assert.equal(r.meetings.length, 1);
  assert.equal(r.dropped, 2);
  assert.equal(r.complete, false, 'a dropped row means the count is not whole');
  assert.equal(readMeetings({ coverage: [covered({ complete: false, reason: 'calendar_partly_read' })], meetings: [mtg(1)] }).reason, 'calendar_partly_read');
});

test('the number from his taps: good meetings held in the London week, by the path recorded at his tap', () => {
  const week = { start: '2026-10-26', end: '2026-11-02' };
  const ms = [
    mtg(1, { good: true, origin_path: 'podcast' }), mtg(2, { good: true, origin_path: 'podcast' }), mtg(3, { good: true, origin_path: null }),
    mtg(4, { good: false, origin_path: 'partner' }), mtg(5), mtg(6, { good: true, held_at: '2026-11-02T09:00:00Z' }),
    mtg(7, { good: true, held_at: '2026-11-01T23:30:00Z' })
  ];
  const c = countGood(ms, week, londonDate);
  assert.equal(c.total, 4, 'a Sunday-night London meeting is in the week; a Monday one is next week\'s');
  assert.deepEqual(c.by_path, { podcast: 2, unknown: 2 });
  assert.equal(c.unanswered, 1);
  assert.equal(c.held, 6);
});

test('where an unanswered meeting came from is read from the engine\'s own records, one candidate a person, oldest first', () => {
  const context = {
    records: {
      guests: [{ id: 'g1', contact_id: cid(1), invite_show: 'makeyourmindup' }],
      visibility: [{ id: 't1', type: 'podcast', booking_contact_id: cid(2) }, { id: 't2', type: 'conference', booking_contact_id: cid(3) }],
      advisory: [{ id: 'p1', contact_id: cid(6), visibility_target_id: null, guest_id: null }]
    },
    feedback: [
      { proposal_id: 'gm-row-partner', row: 'partners', subject_ref: `contact:${cid(4)}`, state: 'approved', carried_out: 'draft', decided_at: '2026-10-27T09:00:00Z' },
      { proposal_id: 'gm-row-signal', row: 'reach_out', amplifier_kind: 'signal', subject_ref: `contact:${cid(5)}`, state: 'approved', carried_out: 'message', decided_at: '2026-10-27T09:00:00Z' },
      { proposal_id: 'gm-row-declined', row: 'partners', subject_ref: `contact:${cid(8)}`, state: 'declined', carried_out: null, decided_at: '2026-10-27T09:00:00Z' }
    ],
    network: [{ contact_id: cid(7) }, { contact_id: cid(9) }, { contact_id: cid(10) }]
  };
  const meetings = [8, 7, 6, 5, 4, 3, 2, 1].map((n, i) => mtg(n, { held_at: `2026-10-2${i}T10:00:00Z`.replace('2026-10-20', '2026-10-20') }));
  meetings.push(mtg(1, { meeting_id: 'mtg_dup', held_at: '2026-10-29T10:00:00Z' }), mtg(9, { good: true }), mtg(10, { origin_path: 'inbound' }));
  const c = originCandidates({ meetings, context });
  const by = Object.fromEntries(c.map(x => [x.contact_id, x]));
  assert.deepEqual(by[cid(1)], { contact_id: cid(1), path: 'own-show-guest', origin_ref: 'guest:g1' });
  assert.deepEqual(by[cid(2)], { contact_id: cid(2), path: 'podcast', origin_ref: 'target:t1' });
  assert.deepEqual(by[cid(3)], { contact_id: cid(3), path: 'guest-seat', origin_ref: 'target:t2' });
  assert.deepEqual(by[cid(4)], { contact_id: cid(4), path: 'partner', origin_ref: 'proposal:gm-row-partner' });
  assert.deepEqual(by[cid(5)], { contact_id: cid(5), path: 'public-signal', origin_ref: 'proposal:gm-row-signal' });
  assert.deepEqual(by[cid(6)], { contact_id: cid(6), path: 'existing-relationship', origin_ref: 'pilot:p1' });
  assert.deepEqual(by[cid(7)], { contact_id: cid(7), path: 'existing-relationship', origin_ref: null });
  assert.equal(by[cid(8)], undefined, 'a row he declined is no path, and nothing is guessed');
  assert.equal(by[cid(9)], undefined, 'an answered meeting needs none');
  assert.equal(by[cid(10)], undefined, 'a recorded path is never offered again');
  assert.equal(c.filter(x => x.contact_id === cid(1)).length, 1, 'one candidate a person');
  assert.equal(c[0].contact_id, cid(7), 'oldest meeting first, as his list asks');
  const many = Array.from({ length: 50 }, (_, i) => mtg(100 + i));
  assert.equal(originCandidates({ meetings: many, context: { network: many.map(m => ({ contact_id: m.contact_id })) } }).length, ORIGIN_CANDIDATES_MAX);
});

function tapped({ meetings, coverage = covered(), features = { context: true, meetings: true } }) {
  return harness({
    capabilities: { activation: { activated_on: '2026-10-18' }, schema_versions: SERVED_ALL, features },
    context: { schema_version: MEETINGS_VERSION, engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [coverage], records: { guests: [{ id: 'g1', contact_id: cid(1), invite_show: 'makeyourmindup' }] }, meetings, feedback: [], network: [] }
  });
}

test('once Control Center serves his meetings, the number is counted from his taps, the Monday ask is not posted, and the report carries 1.10.0 candidates', async () => {
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const h = tapped({ meetings: [mtg(1), mtg(2, { good: true, origin_path: 'podcast' }), mtg(3, { good: true, origin_path: 'existing-relationship' })] });
  const result = await run(h);
  assert.equal(result.status, 'succeeded');
  const rep = h.reports[0];
  assert.equal(rep.schema_version, MEETINGS_VERSION);
  const o = rep.objectives.find(x => x.key === 'good_meetings');
  assert.equal(o.availability, 'measured');
  assert.equal(o.value, 2);
  assert.equal(rep.proposals.some(p => p.proposal_id.startsWith('gmg-')), false, 'his taps replace the Monday ask');
  assert.deepEqual(rep.origin_candidates, [{ contact_id: cid(1), path: 'own-show-guest', origin_ref: 'guest:g1' }]);
  assert.ok(rep.activity.some(a => a.line.startsWith('Good meetings in the week of 2026-10-26: 2 against a target of 2, from his taps') && a.line.includes('1 of the 3 held that week is not answered yet')));
  assert.deepEqual(violations(schema, rep), []);
  assert.equal(JSON.stringify(rep).includes('@'), false, 'contact ids only, never an address');
});

test('a partial read of his meetings is never the number, and an unavailable one falls back to the Monday ask', async () => {
  const partial = tapped({ meetings: [mtg(2, { good: true, origin_path: 'podcast' })], coverage: covered({ complete: false, reason: 'calendar_partly_read' }) });
  await run(partial);
  const o = partial.reports[0].objectives.find(x => x.key === 'good_meetings');
  assert.equal(o.availability, 'missing');
  assert.equal(o.value, null);
  assert.match(o.reason, /calendar_partly_read/);
  assert.ok(partial.reports[0].activity.some(a => a.line.includes('this is a floor and is not reported as the number')));
  const down = tapped({ meetings: [], coverage: covered({ available: false, reason: 'calendar_not_read' }) });
  await run(down);
  assert.ok(down.reports[0].proposals.some(p => p.proposal_id === 'gmg-2026-10-26'), 'the Monday ask stands in');
  assert.ok(down.reports[0].activity.some(a => a.line.includes('not usable this run (calendar_not_read)')));
  assert.equal(down.reports[0].origin_candidates, undefined);
  const flagless = tapped({ meetings: [mtg(1)], features: { context: true } });
  await run(flagless);
  assert.notEqual(flagless.reports[0].schema_version, MEETINGS_VERSION, 'no flag, no 1.10.0 report');
  assert.ok(flagless.reports[0].proposals.some(p => p.proposal_id === 'gmg-2026-10-26'));
});

test('every row and pitch aims at the number the North Star counts: the policy names it, and its target stays in docs/NORTH_STAR.md alone', async () => {
  const north = await readFile(new URL('../docs/NORTH_STAR.md', import.meta.url), 'utf8');
  const block = /```yaml north-star-metric\n([\s\S]*?)```/.exec(north)[1];
  assert.equal(OBJECTIVE, 'good_meetings');
  assert.equal(policy.north_star.objective, OBJECTIVE);
  assert.match(block, /^metric:\s*"Good meetings a week/m, "the policy's objective is the number the North Star counts");
  for (const copy of ['target', 'deadline', 'week_target']) assert.equal(policy.north_star[copy], undefined, `${copy} lives in docs/NORTH_STAR.md, never a copy in the policy`);
  assert.equal(policy.north_star.ladder, 'docs/NORTH_STAR.md', 'the weekly target is read from the ladder, never copied');
  assert.equal(policy.north_star.subset, 'qualified_conversations', 'qualified conversations stay a reported subset with their 5/1 lock');
  assert.equal(policy.targets.qualified_conversations_per_week, 5);
});

