import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readCredits, creditsLine, creditGuard, CREDITS_VERSION } from '../src/stages/credits.mjs';
import { runDispatch, buildReport, readDirective, SCHEMA_VERSION } from '../src/dispatch.mjs';
import { engineClient } from '../src/control-center.mjs';
import { schemaErrors } from '../src/guards.mjs';
import { startProtocolService, violations, directiveFixture } from './support/engine-protocol-service.mjs';
import { AT, POLICY, snapshot } from './helpers.mjs';

// Synthetic pools only: no live share, spend or balance.
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const registry = JSON.parse(await readFile(new URL('../config/campaigns.json', import.meta.url), 'utf8'));
const pool = (over = {}) => ({ pool: 'apify', tool: 'Apify', unit: 'usd', share: 'main', share_amount: 10, spent_this_cycle: 0, remaining_for_you: 10, pool_balance: null, balance_as_of: null, use_by: '2026-11-20', resets_on: '2026-11-21', days_left: 23, unit_costs: [], ...over });
const block = (pools = [pool()]) => ({ rule: 'Spend within remaining_for_you.', pools });
const served = { credits: true };

test('credits are read only where Control Center serves them; absent is unknown, never a share of zero', () => {
  assert.equal(readCredits(block(), {}), null, 'not served: unknown');
  assert.equal(readCredits(undefined, served), null, 'served but not sent today: unknown');
  assert.equal(creditsLine(null), null, 'unknown says nothing rather than a zero');
  const c = readCredits(block([pool(), pool({ pool: 'Bad Key' }), pool({ pool: 'elevenlabs', tool: 'ElevenLabs', unit: 'characters', remaining_for_you: 5000.4, use_by: '2026-11-09' })]), served);
  assert.deepEqual(c.pools.map(p => p.pool), ['apify', 'elevenlabs'], 'a pool that does not name itself is dropped');
  assert.equal(creditsLine(c), 'Prepaid credits: Apify $10.00 left, use by 2026-11-20; ElevenLabs 5000 characters left, use by 2026-11-09. The daily credits session spends them; this run spent none.');
});

test('a spend past what is left of the share is refused before it runs, and unknown credits spend nothing', () => {
  assert.deepEqual(creditGuard(null).reserve({ pool: 'apify', amount: 1, asset: 'host lookups' }), { ok: false, reason: 'credits_unknown' });
  const g = creditGuard(readCredits(block(), served));
  assert.deepEqual(g.reserve({ pool: 'apify', amount: 6, asset: 'booking routes for four podcasts', objective_key: 'good_meetings' }), { ok: true });
  assert.deepEqual(g.reserve({ pool: 'apify', amount: 4.01, asset: 'more routes' }), { ok: false, reason: 'credits_over_share' }, 'counts this run\'s earlier spend');
  assert.deepEqual(g.reserve({ pool: 'apify', amount: 4, asset: 'stage organisers' }), { ok: true });
  assert.deepEqual(g.reserve({ pool: 'runway', amount: 1, asset: 'a clip' }), { ok: false, reason: 'credits_no_pool' });
  assert.deepEqual(g.reserve({ pool: 'apify', amount: 0, asset: 'x' }), { ok: false, reason: 'credits_invalid' });
  assert.equal(g.spent().length, 2);
});

test('credits_spent raises the report to 1.16.0 and passes both checkers; with none the report is unchanged', async () => {
  const base = { run_id: 'mindmake:2026-10-29:synthetic', mode: 'synthetic', observed_at: AT, source: { revision: 'synthetic', captured_at: AT }, status: 'ready', objectives: [], activity: ['x'], proposals: [], holds: [] };
  const plain = buildReport(base);
  assert.equal(plain.schema_version, SCHEMA_VERSION);
  assert.equal('credits_spent' in plain, false);
  const g = creditGuard(readCredits(block(), served));
  g.reserve({ pool: 'apify', amount: 2.5, asset: 'booking routes for four podcasts', objective_key: 'good_meetings' });
  const spent = buildReport({ ...base, credits_spent: g.spent() });
  assert.equal(spent.schema_version, CREDITS_VERSION);
  assert.deepEqual(schemaErrors(schema, spent), []);
  assert.deepEqual(violations(schema, spent), []);
  const service = await startProtocolService({ credits: true, recorded: false });
  const older = await startProtocolService({ recorded: false });
  try {
    const cc = s => engineClient(s.origin, s.token, { fetcher: s.fetcher });
    assert.equal((await cc(service).postReport(spent)).accepted, true);
    await assert.rejects(cc(older).postReport(spent), e => e.status === 400, 'a Control Center that does not serve credits refuses the field');
  } finally { await service.close(); await older.close(); }
});

test('a dispatch with credits served says what is left, spends nothing and keeps its version', async () => {
  const directive = directiveFixture({ credits: block() });
  assert.equal(readDirective(directive).credits_block.pools.length, 1);
  const run = async options => {
    const service = await startProtocolService({ directive, recorded: false, ...options });
    try {
      const result = await runDispatch({ cc: engineClient(service.origin, service.token, { fetcher: service.fetcher }), source: async () => ({ snapshot: snapshot() }), policy: POLICY, registry, mode: 'synthetic', kind: 'synthetic', attemptId: `gma-credits-${String(Math.random()).slice(2, 10)}`, clock: () => AT });
      assert.equal(result.status, 'succeeded', JSON.stringify(result));
      return service.requests.find(r => r.method === 'POST' && r.route === 'reports').body;
    } finally { await service.close(); }
  };
  const withCredits = await run({ credits: true });
  assert.ok(withCredits.activity.some(a => a.line.startsWith('Prepaid credits: Apify $10.00 left, use by 2026-11-20')));
  assert.equal('credits_spent' in withCredits, false, 'the runner spends nothing; the session does');
  assert.notEqual(withCredits.schema_version, CREDITS_VERSION);
  const unserved = await run({});
  assert.equal(unserved.activity.some(a => a.line.startsWith('Prepaid credits')), false, 'not served: no line, never a zero');
});

test('a ceiling pool (Apify, pay as you go) reads as a cap, never a target; a pool with no mode is use_it', () => {
  const served = { credits: true };
  const c = readCredits({ rule: 'r', pools: [
    { pool: 'apify', mode: 'ceiling', tool: 'Apify', unit: 'usd', remaining_for_you: 5.8, use_by: '2026-11-20', days_left: 22 },
    { pool: 'elevenlabs', tool: 'ElevenLabs', unit: 'characters', remaining_for_you: 50000, use_by: '2026-11-09', days_left: 11 },
  ] }, served);
  assert.deepEqual(c.pools.map(p => p.mode), ['ceiling', 'use_it']);
  assert.equal(creditsLine(c), 'Prepaid credits: Apify at most $5.80 more until 2026-11-20, a cap and not a target; ElevenLabs 50000 characters left, use by 2026-11-09. The daily credits session spends them; this run spent none.');
});
