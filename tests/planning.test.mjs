import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../src/orchestrator.mjs';
import { parseBatch, parseSnapshot } from '../contracts/growth.ts';
import { AT, POLICY, copy, contact, snapshot, evidence } from './helpers.mjs';

test('a current warm and cold buying moment produces bounded approval drafts, never a conversation', () => {
  const input = snapshot({ contacts: [contact('cold'), contact('warm', { relationship: 'warm' })] });
  const result = plan(input, POLICY, { at: AT });
  assert.deepEqual(result.recommendations.map(r => r.mode), ['warm', 'cold']);
  assert.equal(result.report.scorecard.qualified_conversations, 0);
  assert.equal(result.report.scorecard.target, 5);
  assert.equal(result.report.scorecard.first_month, null);
  assert.match(result.report.authority, /Drafts only/);
  for (const r of result.recommendations) {
    assert.match(r.draft.body, /https:\/\/mindmake\.co\/\?start=1/);
    assert.ok(r.evidence.some(e => e.kind === 'trigger'));
    assert.match(r.decision_aid.body, /illustrative decision aid/);
  }
});

test('the work queue is bounded and permission uncertainty remains an explicit human review', () => {
  const input = snapshot({ contacts: Array.from({ length: 12 }, (_, i) => contact(`buyer-${String(i).padStart(2, '0')}`, { consent_status: 'unknown' })) });
  const result = plan(input, POLICY, { at: AT });
  assert.equal(result.recommendations.length, 5);
  assert.equal(result.report.deferred_by_budget, 7);
  assert.deepEqual(result.report.permission_review_required, result.recommendations.map(r => r.contact_id));
  assert.throws(() => plan(input, { ...POLICY, send_authority: 'automatic' }, { at: AT }), /Unsafe/);
  assert.throws(() => plan(input, { ...POLICY, spend_authority: 'automatic' }, { at: AT }), /Unsafe/);
});

test('unavailable, incomplete, stale, future or unreviewed source context fails closed', () => {
  const cases = [
    s => { s.complete = false; },
    s => { s.generated_at = '2026-10-14T12:00:00Z'; },
    s => { s.generated_at = '2026-10-17T12:00:00Z'; },
    s => { s.icp.defined = false; },
    s => { s.canon.revision = 'unreviewed'; },
    s => { s.canon.brain_description = 'An unapproved commercial promise'; },
    s => { s.canon.brief_url = 'https://example.com/unapproved'; },
    s => { delete s.contacts; }
  ];
  for (const mutate of cases) {
    const input = snapshot(); mutate(input);
    assert.throws(() => plan(input, POLICY, { at: AT }));
  }
  assert.throws(() => plan(snapshot(), POLICY, { at: 'invalid' }));
  assert.throws(() => plan(snapshot({ generated_at: '2026-11-17T13:00:00Z' }), POLICY, { at: '2026-11-17T13:00:00Z' }), /current source review/);
});

test('a marked-defined ICP still needs a concrete definition and buyer criteria', () => {
  for (const icp of [
    { defined: true, definition: '', buyer_titles: [], industries: [], exclusions: [] },
    { defined: true, definition: '   ', buyer_titles: ['Chief Executive Officer'], industries: [], exclusions: [] }
  ]) assert.throws(() => plan(snapshot({ icp }), POLICY, { at: AT }));
});

test('a saved offer hypothesis cannot bypass current ICP buyer titles or exclusions', () => {
  const input = snapshot({ contacts: [
    contact('excluded', { company: 'Excluded Example' }),
    contact('wrong-role', { title: 'Student' })
  ] });
  const result = plan(input, POLICY, { at: AT });
  assert.equal(result.recommendations.length, 0);
  assert.equal(result.report.held.length, 2);
});

test('missing or stale person, company and buying evidence holds cold outreach for research', () => {
  const cases = [
    c => { delete c.buying_moment; },
    c => { c.buying_moment.kind = 'company'; },
    c => { c.buying_moment.observed_at = '2026-09-01T12:00:00Z'; },
    c => { c.buying_moment.observed_at = '2026-10-17T12:00:00Z'; },
    c => { c.evidence = c.evidence.filter(e => e.kind !== 'person'); },
    c => { c.evidence.find(e => e.kind === 'company').observed_at = '2026-01-01T12:00:00Z'; }
  ];
  for (const mutate of cases) {
    const c = contact(); mutate(c);
    const result = plan(snapshot({ contacts: [c] }), POLICY, { at: AT });
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.report.research.length, 1);
  }
});

test('suppression, consent blocks, closed contacts and relationship cooldown prevent drafts', () => {
  const changes = [{ suppressed: true }, { closed: true }, { consent_status: 'blocked' }, { last_touch_at: '2026-10-15T12:00:00Z' }];
  for (const relationship of ['warm', 'known', 'cold']) for (const change of changes) {
    assert.equal(plan(snapshot({ contacts: [contact('a', { relationship, ...change })] }), POLICY, { at: AT }).recommendations.length, 0);
  }
});

test('open drafts, replies, calls, paid proofs and not-now deals remain human owned', () => {
  const changes = [{ state: 'drafted', drafted_at: '2026-10-01T12:00:00Z' }, { state: 'sent', replied_at: '2026-10-01T12:00:00Z' }, { state: 'call_taken', call_taken_at: '2026-10-01T12:00:00Z' }, { state: 'pilot_paid', pilot_paid_at: '2026-10-01T12:00:00Z' }, { state: 'not_now' }];
  for (const change of changes) {
    const result = plan(snapshot({ deals: [{ id: 'deal-a', contact_id: 'buyer-a', ...change }] }), POLICY, { at: AT });
    assert.equal(result.recommendations.length, 0);
  }
});

test('a follow-up needs cooldown, new value since the previous note, and remaining allowance', () => {
  const input = snapshot({ deals: [{ id: 'deal-a', contact_id: 'buyer-a', state: 'sent', sent_at: '2026-09-30T12:00:00Z', follow_up_count: 0 }] });
  input.contacts[0].evidence.push(evidence('new_value', { fact: 'A new public pricing experiment offers a useful comparison.' }));
  const result = plan(input, POLICY, { at: AT });
  assert.equal(result.recommendations[0]?.mode, 'follow_up');
  assert.match(result.recommendations[0].draft.body, /new public pricing experiment/);
  for (const mutate of [
    s => { s.contacts[0].evidence = s.contacts[0].evidence.filter(e => e.kind !== 'new_value'); },
    s => { s.contacts[0].evidence.find(e => e.kind === 'new_value').observed_at = '2026-09-29T12:00:00Z'; },
    s => { s.deals[0].sent_at = '2026-10-15T12:00:00Z'; },
    s => { s.deals[0].follow_up_count = 1; }
  ]) {
    const blocked = copy(input); mutate(blocked);
    assert.equal(plan(blocked, POLICY, { at: AT }).recommendations.length, 0);
  }
});

test('recent human contact still enforces cooldown when the last outbound deal is older', () => {
  const input = snapshot({ deals: [{ id: 'deal-a', contact_id: 'buyer-a', state: 'sent', sent_at: '2026-09-30T12:00:00Z', follow_up_count: 0 }] });
  input.contacts[0].last_touch_at = '2026-10-15T12:00:00Z';
  input.contacts[0].evidence.push(evidence('new_value'));
  assert.equal(plan(input, POLICY, { at: AT }).recommendations.length, 0);
});

test('the follow-up draft uses value discovered after the earlier message, not a stale cached item', () => {
  const input = snapshot({ deals: [{ id: 'deal-a', contact_id: 'buyer-a', state: 'sent', sent_at: '2026-09-30T12:00:00Z', follow_up_count: 0 }] });
  input.contacts[0].evidence.push(
    evidence('new_value', { id: 'already-known', observed_at: '2026-09-29T12:00:00Z', fact: 'ALREADY_KNOWN_VALUE' }),
    evidence('new_value', { id: 'actually-new', observed_at: '2026-10-15T12:00:00Z', fact: 'ACTUALLY_NEW_VALUE' })
  );
  const result = plan(input, POLICY, { at: AT });
  assert.equal(result.recommendations[0]?.mode, 'follow_up');
  assert.match(result.recommendations[0].draft.body, /ACTUALLY_NEW_VALUE/);
  assert.doesNotMatch(result.recommendations[0].draft.body, /ALREADY_KNOWN_VALUE/);
});

test('an introduction request requires a known unsuppressed connector and double opt-in language', () => {
  const connector = contact('connector', { relationship: 'warm', suppressed: false });
  const buyer = contact('buyer-a', { connector: { contact_id: connector.id, full_name: connector.full_name, both_opted_in: false } });
  const result = plan(snapshot({ contacts: [buyer, connector] }), POLICY, { at: AT });
  const intro = result.recommendations.find(r => r.contact_id === buyer.id);
  assert.equal(intro.mode, 'intro');
  assert.match(intro.draft.body, /Please ask them first/);
  for (const change of [{ suppressed: true }, { consent_status: 'blocked' }, { relationship: 'cold' }]) {
    const held = plan(snapshot({ contacts: [buyer, { ...connector, ...change }] }), POLICY, { at: AT });
    assert.ok(!held.recommendations.some(r => r.contact_id === buyer.id));
  }
});

test('repeat runs and refresh-only changes preserve identity while changed advice invalidates it', () => {
  const source = snapshot();
  const first = plan(source, POLICY, { at: AT });
  const replay = plan(copy(source), POLICY, { at: '2026-10-16T14:00:00Z' });
  assert.equal(replay.run_id, first.run_id);
  assert.deepEqual(replay.recommendations, first.recommendations);
  source.generated_at = '2026-10-16T14:00:00Z';
  assert.equal(plan(source, POLICY, { at: '2026-10-16T14:00:00Z' }).run_id, first.run_id);
  source.contacts[0].buying_moment.fact = 'A different current positioning decision needs testing.';
  const changed = plan(source, POLICY, { at: '2026-10-16T14:00:00Z' });
  assert.notEqual(changed.run_id, first.run_id);
  assert.notEqual(changed.recommendations[0].recommendation_id, first.recommendations[0].recommendation_id);
});

test('a prepared batch cannot smuggle send, schedule, publish or recipient fields', () => {
  const prepared = plan(snapshot(), POLICY, { at: AT });
  for (const field of ['send', 'publish', 'schedule', 'auto_send', 'send_at', 'recipient_email', 'to', 'cc', 'bcc']) {
    const batch = copy(prepared); batch.recommendations[0].draft[field] = true;
    assert.throws(() => parseBatch(batch), /forbidden external action/);
  }
  const duplicate = copy(prepared); duplicate.recommendations.push(copy(duplicate.recommendations[0]));
  assert.throws(() => parseBatch(duplicate), /duplicate identity/);
  const duplicateInput = snapshot(); duplicateInput.contacts.push(copy(duplicateInput.contacts[0]));
  assert.throws(() => parseSnapshot(duplicateInput), /duplicate identity/);
});
