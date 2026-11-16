/**
 * What became of the drafts (session of 16 November 2026). The number read 0
 * and nothing in the run showed whether the drafts reached anyone, so each
 * run counts, from the context's `drafts` rows (protocol 1.9.0 and 1.23.0),
 * by box (his own and Jonny's): the drafts sent, replied to and booked in
 * this London week, by their own timestamps, and the drafts still waiting
 * unsent in that box now. Counts only, never a name, an address, an id or a
 * word of a draft: this repository and its logs are public. Pure.
 */

/** The activity line's start, which the golden reports leave out: a supporting reading added on top of the report, holding nothing. */
export const SENDS_LINE = /^Sends this (?:London )?week: /;

const STAGES = ['sent', 'replied', 'booked'];
const CLOSED = ['sent_at', 'replied_at', 'booked_at', 'bounced_at', 'opted_out_at', 'binned_at'];
const real = v => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** The box a draft belongs to: Jonny's, or his own. */
export function boxOf(d) {
  return d?.mailbox === 'jonny' ? 'jonny' : 'krish';
}

/**
 * Counts by box for the week [start, end), two ISO times. Returns null when
 * Control Center serves no drafts record, so an unserved record is never read
 * as zero.
 */
export function sendCounts(drafts, { start, end }) {
  if (!Array.isArray(drafts)) return null;
  const from = Date.parse(start), to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const blank = () => ({ sent: 0, replied: 0, booked: 0, waiting: 0 });
  const out = { krish: blank(), jonny: blank() };
  for (const d of drafts) {
    if (!d || typeof d !== 'object') continue;
    const box = out[boxOf(d)];
    for (const s of STAGES) {
      const v = d[`${s}_at`];
      if (real(v) && Date.parse(v) >= from && Date.parse(v) < to) box[s] += 1;
    }
    if (!CLOSED.some(k => d[k] != null)) box.waiting += 1;
  }
  return out;
}

const part = (who, c) => `${who} ${c.sent} sent, ${c.replied} replied, ${c.booked} booked, ${c.waiting} waiting unsent`;

/** The one activity line, or a line saying the drafts are not served. */
export function sendsLine(counts) {
  if (!counts) return 'Sends this week: unknown, Control Center does not serve the drafts record to this run.';
  return `Sends this London week: ${part('his box', counts.krish)}; ${part("Jonny's box", counts.jonny)}.`;
}
