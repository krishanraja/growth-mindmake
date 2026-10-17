import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, parseAttempt, parseCapabilities, parseReviewContext } from '../contracts/operations.ts';
import { copy } from './helpers.mjs';
import { attempt, reviewContext } from './support/operations-fixtures.mjs';

function capability() {
  return { version: 1, source_revision: 'synthetic-revision-1', contracts: { growth: 'a'.repeat(64), reporting: 'b'.repeat(64), operations: 'c'.repeat(64) },
    features: Object.fromEntries(FEATURES.map(f => [f, true])), activation: { state: 'inactive', launch_date: null } };
}

test('consumer readiness declarations must be complete, versioned and structurally honest', () => {
  assert.equal(parseCapabilities(capability()).version, 1);
  for (const change of [
    c => { delete c.features.feedback; },
    c => { c.contracts.growth = 'not-a-contract-digest'; },
    c => { c.features.snapshot = 'true'; },
    c => { c.activation.state = 'active'; },
    c => { c.activation.launch_date = '2026-02-30'; },
    c => { c.features.send_authority = true; }
  ]) {
    const c = capability(); change(c);
    assert.throws(() => parseCapabilities(c));
  }
});

test('attempt journal distinguishes failed work from uncertain delivery without storing raw errors', () => {
  assert.equal(parseAttempt(attempt()).status, 'started');
  assert.equal(parseAttempt(attempt({ status: 'unknown', finished_at: '2026-10-16T13:01:00Z', phase: 'handoff', error_code: 'handoff_unconfirmed' })).status, 'unknown');
  for (const changes of [
    { status: 'unknown' },
    { status: 'succeeded', finished_at: '2026-10-16T13:01:00Z', error_code: 'handoff_unconfirmed' },
    { status: 'failed', finished_at: '2026-10-16T12:59:59Z', error_code: 'source_unavailable' },
    { status: 'failed', finished_at: '2026-10-16T13:01:00Z', error_code: 'PRIVATE_SYNTHETIC_ERROR' },
    { raw_error: 'PRIVATE_SYNTHETIC_ERROR' }
  ]) assert.throws(() => parseAttempt(attempt(changes)));
});

test('review input cannot invent payment-window measurements or verified outcomes from a mere decision', () => {
  assert.equal(parseReviewContext(reviewContext()).metrics.paid_proofs, null);
  const cases = [
    c => { c.metrics.paid_proofs = 1; c.metrics.paid_proof_gap = 0; },
    c => { c.metrics.qualified_conversations = -1; },
    c => { c.metrics.examined = 0.5; },
    c => { c.feedback.push({ recommendation_id: 'synthetic-improvement', decision: 'accepted', recorded_at: c.generated_at, outcome: 'verified' }); },
    c => { c.coverage.source_ids = ['one-source', 'one-source']; },
    c => { c.feedback.push({ recommendation_id: 'synthetic-improvement', decision: 'completed', recorded_at: '2026-02-30T12:00:00Z', outcome: 'verified' }); },
    c => { c.feedback.push({ recommendation_id: 'synthetic-improvement', decision: 'send', recorded_at: c.generated_at, outcome: 'not_verified' }); }
  ];
  for (const change of cases) { const c = copy(reviewContext()); change(c); assert.throws(() => parseReviewContext(c)); }
});
