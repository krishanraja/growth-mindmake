import test from 'node:test';
import assert from 'node:assert/strict';
import { scorecard } from '../src/stages/scorecard.mjs';
import { AT, POLICY, snapshot, deal, qualification } from './helpers.mjs';

test('only distinct people with held human-qualified conversations close the weekly gap', () => {
  const deals = Array.from({ length: 5 }, (_, i) => deal(`held-${i}`, { contact_id: `buyer-${i}` }));
  deals.push(deal('repeat-person', { contact_id: 'buyer-0' }));
  deals.push({ id: 'draft', contact_id: 'draft-buyer', state: 'drafted', drafted_at: AT });
  deals.push({ id: 'booking', contact_id: 'booked-buyer', state: 'call_booked', qualified_at: AT, qualification: qualification() });
  const result = scorecard(snapshot({ deals }), POLICY, AT);
  assert.equal(result.qualified_conversations, 5);
  assert.equal(result.gap, 0);
  assert.equal(result.target, 5);
  assert.equal(result.week_starts, '2026-10-12');
});

test('a held conversation stays pending until every qualification condition is confirmed after it', () => {
  const conditions = ['decision_authority', 'owned_problem', 'active_need', 'offer_fit', 'next_step_agreed'];
  const deals = conditions.map((field, i) => deal(`pending-${i}`, { contact_id: `pending-${i}`, qualification: qualification({ [field]: false }) }));
  deals.push(deal('confirmed-before-call', { qualification: qualification({ confirmed_at: '2026-10-16T10:59:59Z' }) }));
  deals.push(deal('future-confirmation', { qualification: qualification({ confirmed_at: '2026-10-16T14:00:00Z' }) }));
  deals.push(deal('missing-human-confirmation', { qualification: undefined }));
  const result = scorecard(snapshot({ deals }), POLICY, AT);
  assert.equal(result.qualified_conversations, 0);
  assert.equal(result.held_conversations_pending_qualification, 8);
  assert.equal(result.gap, 5);
});

test('London Monday boundaries remain correct when British summer time ends', () => {
  const at = '2026-10-26T12:00:00Z';
  const deals = [
    deal('sunday', { contact_id: 'sunday', call_taken_at: '2026-10-25T23:59:59Z', qualified_at: '2026-10-26T00:10:00Z', qualification: qualification({ confirmed_at: '2026-10-26T00:10:00Z' }) }),
    deal('monday', { contact_id: 'monday', call_taken_at: '2026-10-26T00:00:00Z', qualified_at: '2026-10-26T00:10:00Z', qualification: qualification({ confirmed_at: '2026-10-26T00:10:00Z' }) })
  ];
  const result = scorecard(snapshot({ deals }), POLICY, at);
  assert.equal(result.week_starts, '2026-10-26');
  assert.equal(result.qualified_conversations, 1);
});

test('London Monday starts at 23:00 UTC during summer time and shifts when clocks change', () => {
  const at = '2026-10-19T12:00:00Z';
  const deals = [
    deal('before-london-monday', { contact_id: 'before', call_taken_at: '2026-10-18T22:59:59Z', qualified_at: '2026-10-19T00:10:00Z', qualification: qualification({ confirmed_at: '2026-10-19T00:10:00Z' }) }),
    deal('london-monday', { contact_id: 'after', call_taken_at: '2026-10-18T23:00:00Z', qualified_at: '2026-10-19T00:10:00Z', qualification: qualification({ confirmed_at: '2026-10-19T00:10:00Z' }) })
  ];
  assert.equal(scorecard(snapshot({ deals }), POLICY, at).qualified_conversations, 1);
});

test('first month is inactive until activation, then measures exactly 30 London calendar days', () => {
  assert.equal(scorecard(snapshot(), POLICY, AT).first_month, null);
  const result = scorecard(snapshot({ deals: [
    { id: 'before', contact_id: 'a', state: 'pilot_paid', pilot_paid_at: '2026-10-15T22:59:59Z' },
    { id: 'first-day', contact_id: 'b', state: 'pilot_paid', pilot_paid_at: '2026-10-15T23:00:00Z' },
    { id: 'last-day', contact_id: 'c', state: 'pilot_paid', pilot_paid_at: '2026-11-14T23:59:59Z' },
    { id: 'after', contact_id: 'd', state: 'pilot_paid', pilot_paid_at: '2026-11-15T00:00:00Z' }
  ] }), POLICY, '2026-11-16T12:00:00Z', '2026-10-16');
  assert.deepEqual(result.first_month, { starts: '2026-10-16', ends: '2026-11-14', paid_proofs: 2, target: 1, gap: 0 });
  for (const activation of ['2026-10-17', '2026-02-30', '2026-10-16T00:00:00Z', 'yesterday']) {
    assert.throws(() => scorecard(snapshot(), POLICY, AT, activation));
  }
});

test('future payments and bookings never satisfy the first-month paid-proof target', () => {
  const deals = [
    { id: 'future', contact_id: 'a', state: 'pilot_paid', pilot_paid_at: '2026-10-17T00:00:00Z' },
    { id: 'booked', contact_id: 'b', state: 'pilot_booked' }
  ];
  const result = scorecard(snapshot({ deals }), POLICY, AT, '2026-10-16');
  assert.equal(result.first_month.paid_proofs, 0);
  assert.equal(result.first_month.gap, 1);
});
