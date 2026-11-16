import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendCounts, sendsLine, boxOf } from '../src/stages/sends.mjs';

// What became of the drafts this week, by box (session of 16 November 2026).
// Synthetic only: no people, ids or words.

const WEEK = { start: '2026-11-16T00:00:00+00:00', end: '2026-11-23T00:00:00+00:00' };

test('an unserved drafts record is unknown, never zero', () => {
  assert.equal(sendCounts(undefined, WEEK), null);
  assert.equal(sendCounts(null, WEEK), null);
  assert.match(sendsLine(null), /unknown/);
});

test('counts each stage in the week by its own timestamp, by box', () => {
  const drafts = [
    { mailbox: 'krish', job: 'morning', sent_at: '2026-11-16T09:00:00Z', replied_at: '2026-11-17T09:00:00Z', booked_at: '2026-11-18T09:00:00Z' },
    { mailbox: 'krish', job: 'morning', sent_at: '2026-11-10T09:00:00Z', replied_at: '2026-11-16T10:00:00Z' },
    { job: 'morning' },
    { mailbox: 'krish', job: 'morning', binned_at: '2026-11-16T09:00:00Z' },
    { mailbox: 'jonny', job: 'booked', sent_at: '2026-11-16T12:00:00Z' },
    { mailbox: 'jonny', job: 'booked' },
    { mailbox: 'jonny', job: 'guests', sent_at: '2026-11-23T00:00:00Z' },
    { mailbox: 'jonny', job: 'booked', sent_at: 'not a time' },
  ];
  const c = sendCounts(drafts, WEEK);
  assert.deepEqual(c.krish, { sent: 1, replied: 2, booked: 1, waiting: 1 });
  assert.deepEqual(c.jonny, { sent: 1, replied: 0, booked: 0, waiting: 1 });
});

test('a draft with no mailbox is his own box', () => {
  assert.equal(boxOf({}), 'krish');
  assert.equal(boxOf({ mailbox: 'jonny' }), 'jonny');
});

test('the line carries counts only', () => {
  const line = sendsLine({ krish: { sent: 3, replied: 1, booked: 0, waiting: 7 }, jonny: { sent: 10, replied: 2, booked: 1, waiting: 0 } });
  assert.equal(line, "Sends this London week: his box 3 sent, 1 replied, 0 booked, 7 waiting unsent; Jonny's box 10 sent, 2 replied, 1 booked, 0 waiting unsent.");
});

test('the golden reports know the line by its start', async () => {
  const { SENDS_LINE } = await import('../src/stages/sends.mjs');
  assert.ok(SENDS_LINE.test(sendsLine(null)));
  assert.ok(SENDS_LINE.test(sendsLine({ krish: { sent: 0, replied: 0, booked: 0, waiting: 0 }, jonny: { sent: 0, replied: 0, booked: 0, waiting: 0 } })));
});
