import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetsHold } from '../src/dispatch.mjs';

// Integration I-07: an exact email may name at most one asset, only where Control Center can mint its link. Synthetic only.
const one = (extra = {}) => ({ placeholder: 'asset:1', title: 'The proposal', purpose: 'proposal', drive_file_id: 'abcDEF1234567890', ...extra });
const email = (assets, body = 'Hi Sam,\n\nHere is [the proposal](asset:1).\n\nKrish') => ({ channel: 'email', body, assets });

test('no asset passes as before; an asset link with no asset does not', () => {
  assert.equal(assetsHold(email([], 'Hi Sam,\n\nKrish')), null);
  assert.equal(assetsHold(email([])), 'asset_named_but_none_attached');
  assert.equal(assetsHold({ body: 'x' }), 'assets_not_a_list');
});

test('one asset only where allowed, in the contract shape, named exactly once', () => {
  assert.equal(assetsHold(email([one()])), 'assets_not_allowed', 'without features.exact_assets no asset goes');
  const on = { allowed: true };
  assert.equal(assetsHold(email([one()]), on), null);
  assert.equal(assetsHold(email([one({ drive_file_id: undefined, library_ref: { library: 'heartside', path: 'a/b.pdf', sha256: 'a'.repeat(64) } })]), on), null);
  assert.equal(assetsHold(email([one({ drive_file_id: undefined, url: 'https://example.com/p.pdf' })]), on), null);
  assert.equal(assetsHold(email([one(), one()]), on), 'more_than_one_asset');
  assert.equal(assetsHold(email([one({ placeholder: 'asset:2' })]), on), 'asset_placeholder');
  assert.equal(assetsHold(email([one({ purpose: 'Big Proposal' })]), on), 'asset_purpose');
  assert.equal(assetsHold(email([one({ url: 'https://example.com' })]), on), 'asset_source', 'exactly one source');
  assert.equal(assetsHold(email([one({ drive_file_id: undefined, url: 'http://example.com' })]), on), 'asset_source');
  assert.equal(assetsHold(email([one({ drive_file_id: undefined, library_ref: { library: 'other', path: 'a', sha256: 'a'.repeat(64) } })]), on), 'asset_source');
  assert.equal(assetsHold(email([one()], 'Hi,\n\nKrish'), on), 'asset_named_not_once');
  assert.equal(assetsHold(email([one()], 'See [the proposal](asset:1) and [it again](asset:1).'), on), 'asset_named_not_once');
  assert.equal(assetsHold(email([one()], 'See [the proposal](asset:1) and (asset:2).'), on), 'asset_named_not_once');
});

test('a send held for its asset link is reported as asset_link_unavailable, never retried', async () => {
  const { runDispatch } = await import('../src/dispatch.mjs');
  const { readFile } = await import('node:fs/promises');
  const { directiveFixture } = await import('./support/engine-protocol-service.mjs');
  const NOW = '2026-11-03T12:00:00Z';
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [], calls = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture(),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { exact_actions: true, exact_assets: true } }),
    decisions: async () => [{ proposal_id: 'live-1', decision: 'approved', stage: 'go_live', payload_sha256: 'a'.repeat(64) }],
    actionReceipt: async () => ({ ok: true, receipt: { state: 'held', reason: 'asset_link_unavailable' } }),
    reconcileAction: async () => { calls.push('reconcile'); }, executeAction: async () => { calls.push('send'); },
    postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1)
  };
  const result = await runDispatch({ cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, attemptId: 'gma-synthetic-12345678', clock: () => NOW });
  // A live run that read no context ends failed as nothing_read (F48); what matters here is the hold it reports.
  assert.ok(reports.length === 1, `no report (${result.status})`);
  assert.deepEqual(calls, [], 'nothing is sent or reconciled again');
  assert.ok(reports[0].holds.some(h => h.reason === 'asset_link_unavailable'));
  assert.ok(!reports[0].holds.some(h => h.reason === 'external_action_unverified'));
});
