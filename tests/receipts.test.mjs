import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptCounts, receiptsLine } from '../src/stages/receipts.mjs';

// Integration I-06: the links the notes carried, counted in one shadow line. Synthetic rows only.
const cov = (extra = {}) => [{ source: 'asset_opens', available: true, complete: true, rows: 1, observed_at: '2026-11-14T12:00:00Z', reason: null, ...extra }];

test('before features.receipts, the line counts opened and downloaded only and says who opened is not served', () => {
  const ctx = { coverage: cov(), asset_opens: { links: [{ link_id: 'l1', opened: true, downloaded: false }, { link_id: 'l2', opened: null, downloaded: null }], assets: [] } };
  const c = receiptCounts(ctx, {});
  assert.deepEqual([c.links, c.opened, c.downloaded, c.unread, c.told], [2, 1, 0, 1, false]);
  assert.equal(receiptsLine(c), 'Links: 2 links drafted, 1 opened, 0 downloaded, 1 not read yet; whether each note was sent and who opened it is not served yet, so an open may be his own click or a mail scanner.');
});

test('with features.receipts, sent and opened by the person are counted, and a null is not yet told apart, never not opened', () => {
  const links = [
    { link_id: 'l1', sent_at: '2026-11-13T09:00:00Z', recipient_opened: true, opened: true, downloaded: true },
    { link_id: 'l2', sent_at: '2026-11-13T09:00:00Z', recipient_opened: false, opened: true, downloaded: false },
    { link_id: 'l3', sent_at: null, recipient_opened: null, opened: null, downloaded: null },
    { link_id: 'l4', sent_at: '2026-11-13T10:00:00Z', recipient_opened: null, opened: null, downloaded: null }
  ];
  const c = receiptCounts({ coverage: cov({ complete: false }), asset_opens: { links, assets: [] } }, { receipts: true });
  assert.deepEqual([c.sent, c.opened_by_person, c.downloaded, c.not_told_apart], [3, 1, 1, 2]);
  assert.equal(receiptsLine(c), 'Links: 3 sent, 1 opened by the person, 1 downloaded, 2 not yet told apart, of 4 links drafted. Control Center read only part of them.');
});

test('an unreadable or absent block says nothing is known, never zero', () => {
  assert.equal(receiptCounts({ coverage: cov({ available: false }), asset_opens: { links: [] } }), null);
  assert.equal(receiptCounts({}), null);
  assert.match(receiptsLine(null), /could not be read this run/);
  const empty = receiptCounts({ coverage: cov(), asset_opens: { links: [], assets: [] } }, { receipts: true });
  assert.equal(receiptsLine(empty), 'Links: 0 sent, 0 opened by the person, 0 downloaded, of 0 links drafted.');
});
