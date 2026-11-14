import test from 'node:test';
import assert from 'node:assert/strict';
import { readDeals, dealsLine, writtenTo } from '../src/stages/pilots.mjs';

const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c';
const on = { deals_detail: true };

test('without the flag the detail is not read and no line is said', () => {
  assert.deepEqual(readDeals({ records: { deals: [{ contact_id: A }] } }, {}), { served: false });
  assert.equal(dealsLine(readDeals({}, {})), null);
});

test('open and gone-quiet deals are counted, never named', () => {
  const ctx = { records: {
    deals: [{ contact_id: A, stage: 'Proposal', closed_at: null, next_date: '2026-11-20' }, { contact_id: A, stage: 'New', closed_at: null }, { stage: 'New' }],
    stale_deals: [{ contact_id: B, stage: 'Parked', closed_at: null }, { contact_id: C, stage: 'Closed Lost', closed_reason: 'Timing', closed_at: '2026-10-01' }]
  } };
  const r = readDeals(ctx, on);
  assert.deepEqual(r.open, { deals: 2, people: 1, dropped: 1, dated: 1 });
  assert.equal(r.quiet.parked, 1); assert.equal(r.quiet.lost, 1);
  const line = dealsLine(r);
  assert.match(line, /^Deals, in shadow: 2 open with 1 person, 1 with a next date, 1 did not parse and is left out; 2 gone quiet \(1 parked, 1 closed for timing or gone quiet\)\./);
  for (const id of [A, B, C]) assert.ok(!line.includes(id));
});

test('null stale_deals is unknown, never none', () => {
  const r = readDeals({ records: { deals: [], stale_deals: null }, coverage: [{ source: 'deals', available: false, reason: 'pipeline_unread', complete: false }] }, on);
  assert.equal(r.quiet, null);
  assert.match(dealsLine(r), /deals gone quiet not read \(pipeline_unread\), so none are assumed/);
  assert.match(dealsLine(r), /read only part of the Pipeline/);
  assert.equal(dealsLine(readDeals({ records: {} }, on)), 'Deals: not read this run (deals_unread), so none are assumed.');
});

test('a gone-quiet deal never counts as open for the morning lane', () => {
  const w = writtenTo({ records: { deals: [{ contact_id: A, stage: 'New', closed_at: null }], stale_deals: [{ contact_id: B, stage: 'Parked', closed_at: null }] } }, '2026-11-14T08:00:00Z');
  assert.ok(w.deals.has(A)); assert.ok(!w.deals.has(B));
});
