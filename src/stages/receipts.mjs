/**
 * What became of the links the notes carried (integration I-06, the engine's
 * half; ENGINE-PROTOCOL.md, "In the context: asset_opens"). Shadow only: one
 * counts line in the run's activity. It writes nothing to Control Center,
 * proposes nothing, drafts nothing and asks for no follow-up. It is the one
 * stage that reads receipts.
 *
 * Today each `asset_opens.links[]` row carries `opened` and `downloaded`,
 * null until SendLinks has been read for it. Where Control Center serves
 * `features.receipts`, a row also says whether its note was sent
 * (`sent_at`) and whether the person opened it (`recipient_opened`), Control
 * Center telling Krish's own click and a mail scanner apart from the person
 * (its classifyOpens). Null is unknown, never zero: a link whose opens are
 * not yet told apart is counted as such, never as not opened.
 *
 * Pure: no network, no clock.
 */

const list = v => (Array.isArray(v) ? v : []);

/** The counts from the context's asset_opens, or null when it is not served or not readable. Pure. */
export function receiptCounts(context, features = {}) {
  const block = context?.asset_opens;
  if (!block || typeof block !== 'object' || !Array.isArray(block.links)) return null;
  const coverage = list(context?.coverage).find(c => c?.source === 'asset_opens') ?? null;
  if (coverage && coverage.available === false) return null;
  const links = block.links.filter(l => l && typeof l === 'object');
  const told = features?.receipts === true;
  const counts = { links: links.length, sent: 0, opened_by_person: 0, not_told_apart: 0, opened: 0, downloaded: 0, unread: 0, told, complete: coverage?.complete !== false };
  for (const l of links) {
    if (l.opened === true) counts.opened++;
    if (l.downloaded === true) counts.downloaded++;
    if (l.opened === null || l.opened === undefined) counts.unread++;
    if (!told) continue;
    if (typeof l.sent_at === 'string' && Number.isFinite(Date.parse(l.sent_at))) counts.sent++;
    if (l.recipient_opened === true) counts.opened_by_person++;
    else if (l.recipient_opened === null || l.recipient_opened === undefined) counts.not_told_apart++;
  }
  return counts;
}

const n = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** The one activity line, counts only, never a name, a contact or a link. Pure. */
export function receiptsLine(counts) {
  if (counts === null) return 'Links: the opens of the links the notes carry could not be read this run, so nothing is said about them.';
  const partial = counts.complete ? '' : ' Control Center read only part of them.';
  if (!counts.told) return `Links: ${n(counts.links, 'link')} drafted, ${counts.opened} opened, ${counts.downloaded} downloaded, ${counts.unread} not read yet; whether each note was sent and who opened it is not served yet, so an open may be his own click or a mail scanner.${partial}`;
  return `Links: ${counts.sent} sent, ${counts.opened_by_person} opened by the person, ${counts.downloaded} downloaded${counts.not_told_apart ? `, ${counts.not_told_apart} not yet told apart` : ''}, of ${n(counts.links, 'link')} drafted.${partial}`;
}
