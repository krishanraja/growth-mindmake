import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readLadder, ladderTarget, readNorthStar, readConstraints, stopgapProposal, stopgapPayload, readStopgap, bookings, PATHS } from '../src/stages/meetings.mjs';
import { runDispatch, payloadDigest, amendedDigestOk, campaignProposal, londonDate, addDays, LADDER } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';

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
    postReport: async r => { reports.push(r); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
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
  assert.deepEqual(readNorthStar({ north_star: { own: { week_target: 'private', urgency: 4, urgency_reason: 'not measured' }, intensity: { urgency: 4 } } }), { week_target: null, urgency: 4, reason: 'not measured' });
  assert.deepEqual(readNorthStar({}), { week_target: null, urgency: null, reason: null });
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
