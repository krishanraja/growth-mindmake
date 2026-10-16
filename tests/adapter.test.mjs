import test from 'node:test';
import assert from 'node:assert/strict';
import { client, validateReceipt } from '../src/control-center.mjs';
import { plan } from '../src/orchestrator.mjs';
import { AT, POLICY, copy, snapshot, response } from './helpers.mjs';

const ORIGIN = 'https://example.com';
const CREDENTIAL = 'synthetic-test-credential';
function receipt(batch, changes = {}) {
  return { ok: true, run_id: batch.run_id, replayed: false, created: batch.recommendations.map((r, i) => ({ recommendation_id: r.recommendation_id, deal_id: `deal-${i}` })), held: [], report: copy(batch.report), ...changes };
}

test('the authenticated adapter requires one HTTPS origin and disables redirects', async () => {
  for (const origin of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?query=1']) {
    assert.throws(() => client(origin, CREDENTIAL));
  }
  assert.throws(() => client(ORIGIN, ''));
  assert.throws(() => client(ORIGIN, 'invalid\r\nheader'));
  let observed;
  const remote = client(ORIGIN, CREDENTIAL, { fetcher: async (url, options) => { observed = { url, options }; return response(snapshot()); } });
  await remote.snapshot('next page&value');
  assert.equal(observed.url.origin, ORIGIN);
  assert.equal(observed.url.pathname, '/api/growth/mindmake');
  assert.equal(observed.url.searchParams.get('cursor'), 'next page&value');
  assert.equal(observed.options.redirect, 'error');
  assert.equal(observed.options.method, 'GET');
  assert.equal(observed.options.headers.authorization, `Bearer ${CREDENTIAL}`);
  assert.ok(observed.options.signal instanceof AbortSignal);
});

test('false-200 HTML, malformed JSON, error envelopes and oversized responses cannot become success', async () => {
  for (const createResponse of [
    () => response('<html>Error</html>', { headers: { 'content-type': 'text/html' } }),
    () => response('<html>Error</html>'),
    () => response({ ok: false, error: 'Unavailable' }),
    () => response('x'.repeat(2_000_001)),
    () => response({ error: 'Unavailable' }, { status: 503 })
  ]) {
    let calls = 0;
    const remote = client(ORIGIN, CREDENTIAL, { fetcher: async () => { calls++; return createResponse(); } });
    await assert.rejects(remote.snapshot());
    assert.equal(calls, 1, 'read failures are bounded to the one requested call');
  }
});

test('a persisted batch requires a durable receipt, authoritative readback and full item accounting', async () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  const expected = receipt(batch);
  const calls = [];
  const remote = client(ORIGIN, CREDENTIAL, { fetcher: async (url, options) => { calls.push({ url, options }); return response(expected); } });
  assert.deepEqual(await remote.commit(batch), expected);
  assert.deepEqual(calls.map(c => c.options.method), ['POST', 'GET']);
  assert.equal(calls[1].url.searchParams.get('run_id'), batch.run_id);
  assert.equal(JSON.parse(calls[0].options.body).run_id, batch.run_id);
  for (const badReceipt of [
    receipt(batch, { ok: false }),
    receipt(batch, { run_id: 'a-different-run' }),
    receipt(batch, { created: [], held: [] }),
    receipt(batch, { created: undefined }),
    receipt(batch, { created: [{ recommendation_id: batch.recommendations[0].recommendation_id, deal_id: 'a' }, { recommendation_id: batch.recommendations[0].recommendation_id, deal_id: 'b' }] })
  ]) {
    const bad = client(ORIGIN, CREDENTIAL, { fetcher: async () => response(badReceipt) });
    await assert.rejects(bad.commit(batch));
  }
});

test('destination holds are accounted for, and changed write/readback receipts fail', async () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  const held = receipt(batch, { created: [], held: [{ recommendation_id: batch.recommendations[0].recommendation_id, reason: 'suppressed_since_snapshot' }] });
  assert.deepEqual(await client(ORIGIN, CREDENTIAL, { fetcher: async () => response(held) }).commit(batch), held);
  let count = 0;
  const mismatch = client(ORIGIN, CREDENTIAL, { fetcher: async () => response(++count === 1 ? receipt(batch) : held) });
  await assert.rejects(mismatch.commit(batch), /readback disagrees/);
  assert.equal(count, 2);
});

test('an uncertain POST result is never automatically retried, and resume only reads a receipt', async () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  let posts = 0;
  const remote = client(ORIGIN, CREDENTIAL, { fetcher: async () => { posts++; throw new Error('Synthetic lost response'); } });
  await assert.rejects(remote.commit(batch), /Synthetic lost response/);
  assert.equal(posts, 1);
  let method;
  const resumed = client(ORIGIN, CREDENTIAL, { fetcher: async (_url, options) => { method = options.method; return response(receipt(batch)); } });
  await resumed.receipt(batch.run_id);
  assert.equal(method, 'GET');
});

test('blank recommendation and deal identities are not durable receipt evidence', () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  for (const item of [{ recommendation_id: '', deal_id: 'deal-a' }, { recommendation_id: batch.recommendations[0].recommendation_id, deal_id: '' }]) {
    assert.throws(() => validateReceipt(receipt(batch, { created: [item] }), batch.run_id));
  }
  const invalid = copy(receipt(batch)); invalid.held.push({ recommendation_id: batch.recommendations[0].recommendation_id, reason: 'held' });
  assert.throws(() => validateReceipt(invalid, batch.run_id), /Duplicate/);
});

test('success requires the consumed run report to survive authoritative readback without semantic changes', async () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  for (const change of [
    r => { delete r.report; },
    r => { r.report = []; },
    r => { r.report.scorecard.qualified_conversations = 99; },
    r => { r.report.research.push({ contact_id: 'unexpected', need: 'A different consumed report' }); }
  ]) {
    const changed = receipt(batch); change(changed);
    let count = 0;
    const remote = client(ORIGIN, CREDENTIAL, { fetcher: async () => response(++count === 1 ? receipt(batch) : changed) });
    await assert.rejects(remote.commit(batch), /consumed run report/);
    assert.equal(count, 2);
  }
  const refreshedClock = receipt(batch); refreshedClock.report.scorecard.as_of = '2026-10-16T14:00:00Z';
  const clockOnly = client(ORIGIN, CREDENTIAL, { fetcher: async () => response(refreshedClock) });
  assert.equal((await clockOnly.commit(batch)).report.scorecard.qualified_conversations, 0);
});

test('readback confirms persistence while the POST receipt determines whether this handoff was replayed', async () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  for (const replayed of [false, true]) {
    let count = 0;
    const remote = client(ORIGIN, CREDENTIAL, { fetcher: async () => response(receipt(batch, { replayed: ++count === 1 ? replayed : true })) });
    assert.equal((await remote.commit(batch)).replayed, replayed);
  }
});
