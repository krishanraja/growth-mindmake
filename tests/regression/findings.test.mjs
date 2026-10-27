import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDispatch, payloadDigest, doctrineProposal } from '../../src/dispatch.mjs';
import { pitchOffReviews } from '../../src/stages/rows.mjs';
import { directiveFixture } from '../support/engine-protocol-service.mjs';
import { capsContext } from '../support/caps-scenario.mjs';

// The findings plan Phase 3 closes: N02 (what closed reaches events[]), N06
// (a repeated pitch_off reaches the weekly review) and N09 (the trust-asset
// prompt's formats are the contract's). Synthetic only.
const root = new URL('../../', import.meta.url);
const policy = JSON.parse(await readFile(new URL('config/policy.json', root), 'utf8'));

function harness({ decisions = [], capabilities = { activation: { activated_on: '2026-10-18' }, features: {} }, context = null, receipt = null }) {
  const reports = [];
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directiveFixture(), capabilities: async () => capabilities,
    decisions: async () => decisions, context: async () => ({ ok: true, context }), outcomes: async () => { throw new Error('not served'); },
    postReport: async r => { reports.push(r); return { replayed: false }; },
    readReport: async () => { const r = reports.at(-1); if (!r) throw Object.assign(new Error('none'), { status: 404 }); return { payload_sha256: r.payload_sha256, report: r }; },
    prepareAction: async () => { throw new Error('no route'); },
    actionReceipt: async () => receipt ?? (() => { throw Object.assign(new Error('none'), { status: 404 }); })(),
    executeAction: async () => { throw new Error('no executor'); }
  };
  return { cc, reports };
}
const run = (h, at, mode = 'synthetic') => runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode, kind: 'dispatch', attemptId: 'gma-findings-000001', clock: () => at });
const amended = (proposal_id, exact_payload) => ({ proposal_id, decision: 'approved', decided_at: '2026-11-02T09:00:00Z', payload_sha256: 'a'.repeat(64), stage: 'plan', amended: true, exact_payload, amount_usd: null, amended_sha256: payloadDigest({ amount_usd: null, exact_payload }) });

test('his counted Monday answer closes the Monday ask in events[], naming it and its close event (N02)', async () => {
  const first = harness({});
  await run(first, '2026-11-03T12:00:00Z');
  const ask = first.reports[0].proposals.find(p => p.proposal_id === 'gmg-2026-10-26');
  assert.deepEqual(first.reports[0].events, [], 'nothing closes while it is unanswered');
  const answered = harness({ decisions: [amended('gmg-2026-10-26', JSON.stringify({ week_of: '2026-10-26', total: 2, by_path: { podcast: 1 }, how: 'typed' }))] });
  await run(answered, '2026-11-03T12:00:00Z');
  assert.deepEqual(answered.reports[0].events, [{ event: ask.close_condition.event, proposal_id: ask.proposal_id, at: '2026-11-03T12:00:00Z', evidence_url: null }]);
});

test('his Clear on the week spec closes it in events[] (N02)', async () => {
  const at = '2026-11-10T09:00:00Z';
  const first = harness({});
  await run(first, at);
  const spec = first.reports[0].proposals.find(p => p.proposal_id === 'gms-2026-11-09');
  assert.ok(spec, 'the spec is on his list');
  const signed = harness({ decisions: [{ proposal_id: spec.proposal_id, decision: 'approved', decided_at: '2026-11-10T08:00:00Z', payload_sha256: spec.payload_sha256, stage: 'plan', amended: false }] });
  await run(signed, at);
  assert.ok(signed.reports[0].events.some(e => e.proposal_id === spec.proposal_id && e.event === spec.close_condition.event));
});

test('an approved action with an independently verified receipt closes in events[], an unverified one does not (N02)', async () => {
  const caps = { activation: { activated_on: '2026-10-18' }, features: { exact_actions: true } };
  const go = { proposal_id: 'gma-0123456789abcdef0123456789abcdef', decision: 'approved', decided_at: '2026-11-03T08:00:00Z', payload_sha256: 'c'.repeat(64), stage: 'go_live', amended: false };
  const ok = harness({ capabilities: caps, decisions: [go], receipt: { receipt: { state: 'verified', provider_id: 'synthetic-provider-1', payload_sha256: 'c'.repeat(64) } } });
  await run(ok, '2026-11-03T12:00:00Z', 'live');
  assert.deepEqual(ok.reports[0].events.map(e => [e.event, e.proposal_id]), [['external_action_verified', go.proposal_id]]);
  const unverified = harness({ capabilities: caps, decisions: [go], receipt: { receipt: { state: 'verified', provider_id: 'synthetic-provider-1', payload_sha256: 'd'.repeat(64) } } });
  await run(unverified, '2026-11-03T12:00:00Z', 'live');
  assert.deepEqual(unverified.reports[0].events, []);
  assert.ok(unverified.reports[0].holds.some(h => h.reason === 'external_action_unverified'));
});

test('a row whose words he called off twice in 28 days goes to the weekly review as one strategy proposal (N06)', async () => {
  const at = '2026-11-03T12:00:00Z';
  const no = (row, day) => ({ state: 'declined', decided_at: `2026-${day}T09:00:00Z`, row, subject_ref: `contact:00000000-0000-4000-8000-0000000009${day.slice(-2)}`, reason_code: 'pitch_off' });
  assert.deepEqual(pitchOffReviews([no('partners', '11-01'), no('partners', '10-30'), no('network', '11-01'), no('partners', '09-01')], at), [{ row: 'partners', count: 2, days: 28 }]);
  assert.deepEqual(pitchOffReviews([no('partners', '11-01')], at), []);
  const caps = { activation: { activated_on: '2026-10-18' }, features: { context: true } };
  const h = harness({ capabilities: caps, context: { ...capsContext(), observed_at: at, feedback: [no('partners', '11-01'), no('partners', '10-30')] } });
  await run(h, at);
  const p = h.reports[0].proposals.find(x => x.proposal_id === 'gmd-partners-2026-11-02');
  assert.ok(p, 'the doctrine review is proposed');
  assert.deepEqual([p.kind, p.wall, p.objective_key, p.close_condition.event], ['advice', 'strategy', 'good_meetings', 'doctrine_reviewed']);
  assert.deepEqual(JSON.parse(p.exact_payload), { row: 'partners', pitch_off_nos: 2, window_days: 28, week_of: '2026-11-02' });
  assert.equal(doctrineProposal({ row: 'partners', count: 2, days: 28, weekOf: '2026-11-02', expiresAt: null }).payload_sha256, doctrineProposal({ row: 'partners', count: 2, days: 28, weekOf: '2026-11-02', expiresAt: null }).payload_sha256, 'one stable proposal a row a week');
});

test("the trust-asset prompt's formats are exactly the contract's trust formats (N09)", async () => {
  const prompt = await readFile(new URL('prompts/trust-asset.md', root), 'utf8');
  const contract = await readFile(new URL('contracts/motions.ts', root), 'utf8');
  const promptFormats = /"format": "([^"]+)"/.exec(prompt)[1].split('|').map(s => s.trim());
  const contractFormats = JSON.parse(/one\(d\.format, (\[[^\]]+\]), 'trust\.format'\)/.exec(contract)[1].replace(/'/g, '"'));
  assert.deepEqual(promptFormats, contractFormats);
  assert.match(prompt, /speaking motion/);
});
