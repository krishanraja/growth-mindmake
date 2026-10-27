import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deadPlans, runDispatch } from '../src/dispatch.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';

// Synthetic shapes only.
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plan = (n, over = {}) => ({ proposal_id: `gmc-${String(n).padStart(32, '0')}`, state: 'pending', stage: 'plan', decided_at: null, reference: `pilot:${uid(n)}`, ...over });
const ctx = (over = {}) => ({ coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [{ id: uid(1) }] }, feedback: [plan(1), plan(2), plan(3, { state: 'approved', decided_at: '2026-10-23T09:00:00Z' }), plan(4, { decided_at: '2026-10-23T09:00:00Z' }), { proposal_id: 'gmi-x', state: 'pending', reference: `pilot:${uid(5)}` }], ...over });

test('a pending plan whose Advisory record is gone is taken back; a held, decided, re-proposed or non-plan one is not', () => {
  assert.deepEqual(deadPlans(ctx()), [{ proposal_id: plan(2).proposal_id, reason: 'Its Advisory record is no longer held, so this plan can never run.' }]);
  assert.deepEqual(deadPlans(ctx(), new Set([plan(2).proposal_id])), [], 'one this run proposes again is not taken back');
  assert.deepEqual(deadPlans(ctx({ coverage: [{ source: 'advisory', available: true, complete: false }] })), [], 'a partial read never proves a record is gone');
  assert.deepEqual(deadPlans(ctx({ coverage: [] })), []);
  assert.equal(deadPlans(ctx({ feedback: Array.from({ length: 50 }, (_, i) => plan(100 + i)) })).length, 40);
});

function run({ features, served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0'] }) {
  const reports = [];
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directiveFixture({ schema_version: served.at(-1) }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features }), decisions: async () => [],
    context: async () => ({ ok: true, context: { schema_version: served.at(-1), engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: '2026-10-28T06:00:00Z', ...ctx() } }),
    outcomes: async () => { throw new Error('not served'); },
    readReport: async () => { const r = reports.at(-1); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, report: r }; },
    postReport: async r => { reports.push(r); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
    prepareAction: async () => { throw new Error('no route'); }, actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); }, executeAction: async () => { throw new Error('none'); }
  };
  return { cc, reports };
}

test('the dispatch withdraws dead plans at 1.10.0 only where Control Center says it takes them', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const go = h => runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode: 'synthetic', attemptId: 'gma-synthetic-withdraw1', clock: () => '2026-10-28T06:00:00Z' });
  const yes = run({ features: { context: true, withdrawn: true } });
  assert.equal((await go(yes)).status, 'succeeded');
  assert.equal(yes.reports[0].schema_version, '1.10.0');
  assert.deepEqual(yes.reports[0].withdrawn.map(w => w.proposal_id), [plan(2).proposal_id]);
  assert.ok(yes.reports[0].activity.some(a => a.line.startsWith('Took back 1 pending plan')));
  assert.deepEqual(violations(schema, yes.reports[0]), []);
  const no = run({ features: { context: true } });
  assert.equal((await go(no)).status, 'succeeded');
  assert.equal(no.reports[0].withdrawn, undefined, 'never sent where it is not taken');
  assert.notEqual(no.reports[0].schema_version, '1.10.0');
});
