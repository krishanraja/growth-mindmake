import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBatch, parseSnapshot } from '../contracts/growth.ts';
import { plan } from '../src/orchestrator.mjs';
import { AT, POLICY, copy, snapshot } from './helpers.mjs';

test('wire contract rejects normalized invalid dates and ambiguous timestamp formats', () => {
  for (const value of ['2026-02-30T12:00:00Z', '2026-10-16T13:00:00', '2026-10-16T25:00:00Z', 'not-a-time']) {
    const input = snapshot(); input.contacts[0].buying_moment.observed_at = value;
    assert.throws(() => parseSnapshot(input), `Invalid timestamp was accepted: ${value}`);
  }
});

test('wire contract rejects permission/admin fields in prepared drafts and source records', () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  for (const mutate of [
    b => { b.recommendations[0].approved = true; },
    b => { b.recommendations[0].draft.sender_authority = 'automatic'; },
    b => { b.recommendations[0].decision_aid.approved = true; },
    b => { b.recommendations[0].evidence[0].approval_status = 'approved'; }
  ]) {
    const unsafe = copy(batch); mutate(unsafe);
    assert.throws(() => parseBatch(unsafe));
  }
  const input = snapshot(); input.contacts[0].send = true;
  assert.throws(() => parseSnapshot(input));
});

test('negative and noninteger follow-up counts cannot restore an exhausted contact allowance', () => {
  for (const follow_up_count of [-1, 0.5, '0']) {
    const input = snapshot({ deals: [{ id: 'deal-a', contact_id: 'buyer-a', state: 'sent', sent_at: '2026-09-01T12:00:00Z', follow_up_count }] });
    assert.throws(() => parseSnapshot(input));
  }
});

test('conflicting evidence identities cannot erase the person proof from a prepared recommendation', () => {
  const input = snapshot();
  input.contacts[0].buying_moment.id = input.contacts[0].evidence[0].id;
  assert.throws(() => plan(input, POLICY, { at: AT }));
  const duplicate = snapshot();
  duplicate.contacts[0].evidence[1].id = duplicate.contacts[0].evidence[0].id;
  assert.throws(() => parseSnapshot(duplicate));
});
