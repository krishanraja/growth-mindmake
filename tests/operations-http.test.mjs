import test from 'node:test';
import assert from 'node:assert/strict';
import { client } from '../src/control-center.mjs';
import { execute, readiness } from '../src/runtime.mjs';
import { weeklyReview } from '../src/weekly-review.mjs';
import { parseAttempt, parseWeeklyReview } from '../contracts/operations.ts';
import { AT, POLICY, contact, copy, snapshot } from './helpers.mjs';
import { startContractService } from './support/contract-service.mjs';
import { capabilities, reviewContext } from './support/operations-fixtures.mjs';

const PATH = '/api/growth/mindmake';
function source() { return snapshot({ contacts: [contact('10000000-0000-4000-8000-000000000001')] }); }
function active() { return capabilities({ activation: { state: 'active', launch_date: '2026-10-16' } }); }
function bridge(service) { return client(service.origin, service.token, { fetcher: service.fetcher }); }

test('live execution requires matching full consumer contracts, every feature, and canonical activation before writes', async () => {
  for (const change of [
    c => { c.contracts.reporting = '0'.repeat(64); },
    c => { c.features.human_actions = false; },
    c => { c.features.feedback = false; },
    c => { c.activation = { state: 'inactive', launch_date: null }; }
  ]) {
    const c = await active(); change(c);
    const service = await startContractService({ sourceSnapshot: source(), capabilities: c });
    try {
      await assert.rejects(execute(bridge(service), POLICY, { clock: () => AT }));
      assert.equal(service.requests.filter(r => r.method === 'POST').length, 0);
      assert.equal(service.mutations, 0);
    } finally { await service.close(); }
  }
});

test('a missing consumer is pending, while rejected authentication, server errors and false-200 remain failures', async () => {
  for (const status of [404, 405, 501, 401, 500]) {
    const service = await startContractService({ sourceSnapshot: source(), extension: ({ url }) => url.pathname.endsWith('/operations') ? { status, body: { ok: false, error: 'synthetic_status' } } : null });
    try {
      if ([404, 405, 501].includes(status)) {
        const result = await readiness(bridge(service));
        assert.equal(result.ready, false);
        assert.equal(result.state, 'consumer_pending');
        assert.ok(result.missing_features.includes('human_reporting'));
      } else await assert.rejects(readiness(bridge(service)));
      assert.equal(service.requests.filter(r => r.method === 'POST').length, 0);
    } finally { await service.close(); }
  }
  const service = await startContractService({ sourceSnapshot: source() });
  try {
    service.fault('html', 'GET', '/api/growth/mindmake/operations');
    await assert.rejects(readiness(bridge(service)), /non-JSON/);
    assert.equal(service.mutations, 0);
  } finally { await service.close(); }
});

test('actual daily execution journals start and success only after report and recommendation readback', async () => {
  const service = await startContractService({ sourceSnapshot: source(), capabilities: await active() });
  try {
    const result = await execute(bridge(service), POLICY, { clock: () => AT });
    assert.equal(result.receipt.created.length, 1);
    assert.deepEqual(result.receipt.report, result.artifact.report);
    const terminal = await bridge(service).attempt(result.attempt_id);
    assert.equal(terminal.status, 'succeeded');
    assert.equal(terminal.phase, 'readback');
    assert.equal(terminal.run_id, result.artifact.run_id);
    const writes = service.requests.filter(r => r.method === 'POST');
    assert.deepEqual(writes.map(r => r.body.kind ?? 'batch'), ['attempt', 'batch', 'attempt']);
    assert.deepEqual(writes.filter(r => r.body.kind === 'attempt').map(r => r.body.attempt.status), ['started', 'succeeded']);
    assert.equal(service.mutations, 1);
  } finally { await service.close(); }
});

test('capture failure is a durable failed attempt with bounded reason and no private error payload', async () => {
  const service = await startContractService({ sourceSnapshot: source(), capabilities: await active(), extension: ({ method, url }) => method === 'GET' && url.pathname === PATH ? { status: 503, body: { ok: false, error: 'PRIVATE_SYNTHETIC_UPSTREAM_PAYLOAD' } } : null });
  try {
    let failure;
    try { await execute(bridge(service), POLICY, { clock: () => AT }); } catch (error) { failure = error; }
    assert.equal(failure.attempt.status, 'failed');
    assert.equal(failure.attempt.error_code, 'source_unavailable');
    assert.deepEqual(await bridge(service).attempt(failure.attempt.attempt_id), failure.attempt);
    assert.doesNotMatch(JSON.stringify(failure.attempt), /PRIVATE_SYNTHETIC/);
    assert.equal(service.runs.size, 0);
    assert.equal(service.mutations, 0);
  } finally { await service.close(); }
});

test('invalid captured context fails before drafting while an all-held page completes without inventing a human task', async () => {
  for (const incomplete of [true, false]) {
    const input = source();
    if (incomplete) input.complete = false;
    else input.contacts[0].suppressed = true;
    const service = await startContractService({ sourceSnapshot: input, capabilities: await active() });
    try {
      if (incomplete) {
        let failure;
        try { await execute(bridge(service), POLICY, { clock: () => AT }); } catch (error) { failure = error; }
        assert.equal(failure.attempt.status, 'failed');
        assert.equal(failure.attempt.error_code, 'context_invalid');
        assert.equal(service.requests.filter(r => r.method === 'POST' && r.path === PATH).length, 0);
      } else {
        const result = await execute(bridge(service), POLICY, { clock: () => AT });
        assert.equal(result.artifact.report.dashboard.pipeline.held, 1);
        assert.equal(result.receipt.created.length, 0);
        assert.deepEqual(result.artifact.report.dashboard.recommendations, []);
        assert.equal(result.artifact.report.dashboard.coverage.global_outcomes, 'consumer_required');
      }
      assert.equal(service.mutations, 0);
    } finally { await service.close(); }
  }
});

test('uncertain initial attempt acknowledgment still yields a valid redacted unknown terminal diagnostic', async () => {
  const service = await startContractService({ sourceSnapshot: source(), capabilities: await active(), extension: ({ method, url }) => method === 'GET' && url.searchParams.has('attempt_id') ? { status: 503, body: { ok: false } } : null });
  try {
    let failure;
    try { await execute(bridge(service), POLICY, { clock: () => AT }); } catch (error) { failure = error; }
    assert.equal(failure.attempt.status, 'unknown');
    assert.deepEqual(parseAttempt(failure.attempt), failure.attempt);
    assert.equal(service.requests.filter(r => r.method === 'POST').length, 1);
    assert.equal(service.mutations, 0);
  } finally { await service.close(); }
});

test('lost batch acknowledgment records unknown once and recovery reads the persisted run without a second mutation', async () => {
  const service = await startContractService({ sourceSnapshot: source(), capabilities: await active() });
  try {
    service.fault('drop_after_commit', 'POST', PATH);
    let failure;
    try { await execute(bridge(service), POLICY, { clock: () => AT }); } catch (error) { failure = error; }
    assert.equal(failure.attempt.status, 'unknown');
    assert.equal(failure.attempt.error_code, 'handoff_unconfirmed');
    assert.equal(service.requests.filter(r => r.method === 'POST' && r.path === PATH).length, 1);
    assert.equal(service.mutations, 1);
    assert.equal((await bridge(service).receipt(failure.attempt.run_id)).created.length, 1);
    assert.equal((await bridge(service).attempt(failure.attempt.attempt_id)).status, 'unknown');
  } finally { await service.close(); }
});

test('lost terminal-attempt readback never overwrites a committed success with unknown', async () => {
  let readbackUnavailable = false;
  const service = await startContractService({ sourceSnapshot: source(), capabilities: await active(), extension: ({ method, url, body }) => {
    if (method === 'POST' && body?.kind === 'attempt' && body.attempt.status === 'succeeded') readbackUnavailable = true;
    if (method === 'GET' && url.searchParams.has('attempt_id') && readbackUnavailable) return { status: 503, body: { ok: false, error: 'synthetic_readback_unavailable' } };
    return null;
  } });
  try {
    let failure;
    try { await execute(bridge(service), POLICY, { clock: () => AT }); } catch (error) { failure = error; }
    assert.equal(failure.attempt.status, 'unknown');
    assert.equal(failure.attempt.phase, 'readback');
    assert.equal(failure.attempt.error_code, 'readback_unconfirmed');
    const attemptWrites = service.requests.filter(r => r.method === 'POST' && r.body?.kind === 'attempt');
    assert.deepEqual(attemptWrites.map(r => r.body.attempt.status), ['started', 'succeeded']);
    assert.equal(service.mutations, 1);
    assert.equal(service.requests.filter(r => r.method === 'POST' && r.path === PATH).length, 1);
    readbackUnavailable = false;
    const recovered = await bridge(service).attempt(failure.attempt.attempt_id);
    assert.equal(recovered.status, 'succeeded');
    assert.equal(recovered.run_id, failure.attempt.run_id);
    assert.equal((await bridge(service).receipt(recovered.run_id)).created.length, 1);
  } finally { await service.close(); }
});

test('consumer-recorded human decisions feed the persisted weekly review while verified completion stays separate', async () => {
  const context = reviewContext({ activation: { launch_date: '2026-10-16' } });
  context.metrics.paid_proofs = 0; context.metrics.paid_proof_gap = 1;
  const service = await startContractService({ sourceSnapshot: source(), capabilities: await active(), reviewContext: context });
  try {
    const remote = bridge(service);
    const daily = await execute(remote, POLICY, { clock: () => AT });
    const recommendation = daily.artifact.report.dashboard.recommendations[0];
    assert.ok(recommendation.id);
    service.recordHumanFeedback({ recommendation_id: recommendation.id, decision: 'accepted', recorded_at: AT, outcome: 'not_verified' });
    const accepted = await execute(remote, POLICY, { command: 'weekly-review', clock: () => AT });
    assert.equal(accepted.artifact.feedback_summary.accepted, 1);
    assert.equal(accepted.artifact.feedback_summary.verified, 0, 'acceptance never fabricates completion evidence');
    service.recordHumanFeedback({ recommendation_id: recommendation.id, decision: 'completed', recorded_at: AT, outcome: 'verified' });
    const reviewed = await execute(remote, POLICY, { command: 'weekly-review', clock: () => AT });
    assert.equal(reviewed.artifact.coverage, 'global_review');
    assert.equal(reviewed.artifact.metrics.qualified_conversations, 2);
    assert.equal(reviewed.artifact.feedback_summary.accepted, 0, 'the consumer supplies the current decision state once per recommendation');
    assert.equal(reviewed.artifact.feedback_summary.completed, 1);
    assert.equal(reviewed.artifact.feedback_summary.verified, 1);
    assert.deepEqual(await remote.review(reviewed.artifact.review_id), reviewed.artifact);
    assert.equal(service.mutations, 1, 'weekly review never invents an outreach, qualification or payment mutation');
  } finally { await service.close(); }
});

test('weekly review replay ignores delivery time but rejects changed persisted recommendations and bad context', async () => {
  const context = reviewContext();
  const first = weeklyReview(context, POLICY, AT);
  const service = await startContractService({ sourceSnapshot: source() });
  try {
    const remote = bridge(service);
    await remote.commitReview(first);
    const refreshed = weeklyReview(context, POLICY, '2026-10-16T14:00:00Z');
    assert.equal(first.review_id, refreshed.review_id);
    assert.equal((await remote.commitReview(refreshed)).review_id, first.review_id);
    const unsafe = copy(first); unsafe.recommendations = [{ send: true }];
    assert.throws(() => parseWeeklyReview(unsafe));
    for (const changed of [
      { ...context, complete: false },
      { ...context, generated_at: '2026-10-14T12:00:00Z' },
      { ...context, week_starts: '2026-10-05' },
      { ...context, feedback: [{ recommendation_id: 'synthetic', decision: 'accepted', recorded_at: '2026-10-17T12:00:00Z', outcome: 'not_verified' }] }
    ]) assert.throws(() => weeklyReview(changed, POLICY, AT));
  } finally { await service.close(); }
});

test('weekly review honors a declined or verified action and does not reopen a closed first-month payment window', () => {
  const context = reviewContext();
  const recommendation = weeklyReview(context, POLICY, AT).recommendations[0];
  for (const feedback of [
    { decision: 'declined', outcome: 'not_verified' },
    { decision: 'completed', outcome: 'verified' },
    { decision: 'bumped', outcome: 'not_verified' }
  ]) {
    const input = copy(context); input.feedback = [{ recommendation_id: recommendation.id, recorded_at: AT, ...feedback }];
    const result = weeklyReview(input, POLICY, AT);
    assert.deepEqual(result.recommendations, []);
    assert.equal(result.feedback_summary.verified, feedback.outcome === 'verified' ? 1 : 0);
  }
  const closed = reviewContext({ generated_at: '2026-11-16T13:00:00Z', week_starts: '2026-11-16', activation: { launch_date: '2026-10-16' } });
  closed.metrics.prepared = 0; closed.metrics.pending_human_qualification = 0; closed.metrics.paid_proofs = 0; closed.metrics.paid_proof_gap = 1;
  const historical = weeklyReview(closed, POLICY, '2026-11-16T13:00:00Z');
  assert.equal(historical.first_month_status, 'closed');
  assert.equal(historical.metrics.paid_proof_gap, 1, 'historical shortfall is retained honestly');
  assert.deepEqual(historical.recommendations, [], 'an expired first-month goal must not create a live human ask');
});

test('a decline suppresses the present London week while a bump expires on the next London day', () => {
  const context = reviewContext();
  const candidate = weeklyReview(context, POLICY, AT).recommendations[0];
  const priorWeek = copy(context);
  priorWeek.feedback = [{ recommendation_id: candidate.id, decision: 'declined', recorded_at: '2026-10-09T13:00:00Z', outcome: 'not_verified' }];
  assert.equal(weeklyReview(priorWeek, POLICY, AT).recommendations[0].id, candidate.id);
  const currentWeek = copy(priorWeek); currentWeek.feedback[0].recorded_at = '2026-10-12T00:00:00Z';
  assert.deepEqual(weeklyReview(currentWeek, POLICY, AT).recommendations, []);
  const bumped = copy(context); bumped.feedback = [{ recommendation_id: candidate.id, decision: 'bumped', recorded_at: AT, outcome: 'not_verified' }];
  assert.deepEqual(weeklyReview(bumped, POLICY, AT).recommendations, []);
  bumped.generated_at = '2026-10-17T13:00:00Z';
  assert.equal(weeklyReview(bumped, POLICY, '2026-10-17T13:00:00Z').recommendations[0].id, candidate.id);
});

test('verified completion remains closed until the evidence-grounded recommendation changes', () => {
  const context = reviewContext();
  context.metrics.pending_human_qualification = 0;
  const candidate = weeklyReview(context, POLICY, AT).recommendations[0];
  context.feedback = [{ recommendation_id: candidate.id, decision: 'completed', recorded_at: '2026-10-09T13:00:00Z', outcome: 'verified' }];
  assert.deepEqual(weeklyReview(context, POLICY, AT).recommendations, []);
  context.metrics.prepared = 2;
  const changed = weeklyReview(context, POLICY, AT);
  assert.equal(changed.recommendations.length, 1);
  assert.notEqual(changed.recommendations[0].id, candidate.id);
});

test('weekly replay handles reversed delivery clocks while input clocks and first-month status stay truthful', async () => {
  const context = reviewContext();
  assert.throws(() => weeklyReview(context, POLICY, '2026-10-16T12:59:59Z'), /current global context/);
  const service = await startContractService({ sourceSnapshot: source() });
  try {
    const remote = bridge(service);
    const later = weeklyReview(context, POLICY, '2026-10-16T14:00:00Z');
    await remote.commitReview(later);
    const earlierDelivery = weeklyReview(context, POLICY, AT);
    assert.equal(earlierDelivery.review_id, later.review_id);
    assert.equal((await remote.commitReview(earlierDelivery)).generated_at, later.generated_at);
  } finally { await service.close(); }
  const month = reviewContext({ generated_at: '2026-11-14T23:00:00Z', week_starts: '2026-11-09', activation: { launch_date: '2026-10-16' } });
  month.metrics.prepared = 0; month.metrics.pending_human_qualification = 0; month.metrics.paid_proofs = 0; month.metrics.paid_proof_gap = 1;
  const open = weeklyReview(month, POLICY, '2026-11-14T23:30:00Z');
  const closed = weeklyReview(month, POLICY, '2026-11-15T00:30:00Z');
  assert.equal(open.first_month_status, 'open');
  assert.equal(open.recommendations[0].kind, 'paid_proof_next_step');
  assert.equal(closed.first_month_status, 'closed');
  assert.deepEqual(closed.recommendations, []);
  assert.notEqual(closed.review_id, open.review_id);
  const forged = copy(open); forged.first_month_status = 'closed';
  assert.throws(() => parseWeeklyReview(forged));
});

test('a weekly recommendation must retain its global scope, exact source revision and examined population', () => {
  const review = weeklyReview(reviewContext(), POLICY, AT);
  assert.equal(review.recommendations.length, 1);
  for (const change of [
    r => { r.recommendations[0].close_condition.reference.scope = 'selected_page'; },
    r => { r.recommendations[0].close_condition.reference.source_revision = 'unrelated-source-revision'; },
    r => { r.recommendations[0].evidence.examined = r.metrics.examined + 1; }
  ]) {
    const forged = copy(review); change(forged);
    assert.throws(() => parseWeeklyReview(forged));
  }
});
