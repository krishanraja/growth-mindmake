import test from 'node:test';
import assert from 'node:assert/strict';
import { client } from '../src/control-center.mjs';
import { plan } from '../src/orchestrator.mjs';
import { AT, POLICY, copy, snapshot, contact } from './helpers.mjs';
import { startContractService } from './support/contract-service.mjs';

function source() { return snapshot({ contacts: [contact('10000000-0000-4000-8000-000000000001')] }); }

test('actual producer crosses a real HTTP contract boundary and independently reads its consumed report', async () => {
  const service = await startContractService({ sourceSnapshot: source() });
  try {
    const remote = client(service.origin, service.token, { fetcher: service.fetcher });
    const captured = await remote.snapshot();
    const batch = plan(captured, POLICY, { at: AT });
    const written = await remote.commit(batch);
    assert.equal(written.created.length, 1);
    assert.equal(written.replayed, false);
    assert.equal(service.mutations, 1);
    assert.deepEqual(service.recommendations.get(batch.recommendations[0].recommendation_id).recommendation, batch.recommendations[0]);
    assert.deepEqual((await remote.receipt(batch.run_id)).report, batch.report);
    const refreshed = plan(captured, POLICY, { at: '2026-10-16T14:00:00Z' });
    assert.equal(refreshed.run_id, batch.run_id);
    assert.equal((await remote.commit(refreshed)).replayed, true);
    assert.equal(service.mutations, 1);
    const conflict = copy(batch); conflict.report.research.push({ contact_id: 'changed', need: 'Different prepared advice' });
    await assert.rejects(remote.commit(conflict), /409/);
  } finally { await service.close(); }
});

test('a lost real HTTP POST response is not retried and read-only resume discovers the committed result', async () => {
  const service = await startContractService({ sourceSnapshot: source() });
  try {
    const remote = client(service.origin, service.token, { fetcher: service.fetcher });
    const batch = plan(await remote.snapshot(), POLICY, { at: AT });
    service.fault('drop_after_commit', 'POST');
    await assert.rejects(remote.commit(batch));
    assert.equal(service.requests.filter(r => r.method === 'POST').length, 1);
    assert.equal(service.mutations, 1);
    const recovered = await remote.receipt(batch.run_id);
    assert.equal(recovered.created.length, 1);
    assert.deepEqual(recovered.report, batch.report);
  } finally { await service.close(); }
});

test('real HTTP false-200 and missing authorization cannot produce a successful run', async () => {
  const service = await startContractService({ sourceSnapshot: source() });
  try {
    const unauthorized = await fetch(new URL('/api/growth/mindmake', service.localOrigin));
    assert.equal(unauthorized.status, 401);
    const remote = client(service.origin, service.token, { fetcher: service.fetcher });
    service.fault('html', 'GET');
    await assert.rejects(remote.snapshot(), /non-JSON/);
    assert.equal(service.mutations, 0);
    assert.equal(service.runs.size, 0);
  } finally { await service.close(); }
});
