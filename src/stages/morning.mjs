/**
 * The morning drafts' QA (session of 15 November 2026). Mindmake's email
 * row actions for Krish's own box are drafted into his Gmail each morning
 * with no press (protocol 1.23.0, the morning lane), so each is read by two
 * fixed rules before it is proposed:
 *
 *   morning_over_80_words   the message, the lines between the greeting and
 *                           the sign-off, runs over MORNING_WORDS_MAX words.
 *                           Counted only, never held, while
 *                           MORNING_LENGTH_HOLDS is false.
 *   morning_claim_untraced  a claim in it is on neither the person's record
 *                           nor their company's, and is not one of this
 *                           engine's own fixed words. Always held: it goes
 *                           out in his name.
 *
 * A claim is what a reader would take as a fact about them: a name or other
 * capitalised word that does not start a sentence, a number, or a quotation.
 * The person's record is every row Control Center serves for them (network,
 * quiet ties, amplifier candidates, an Advisory person row), with its typed
 * facts, the research answered about them, and their Pipeline deals; the
 * company's is the company row and the company read for their company's
 * site. Dates on the record count in the forms the engine writes them ("May
 * 2021"). This engine's own fixed words are the string literals of the files
 * its words are written from, and the canon it reads live. It never reads a
 * model and never sends; it only holds. Pure.
 */

/** At most this many words between the greeting and the sign-off. */
export const MORNING_WORDS_MAX = 80;

/**
 * Whether running over MORNING_WORDS_MAX holds an email. Ruling (Krish,
 * 2026-11-15): an untraced claim holds from the start, and length only
 * reports for a week; it holds once he has read that week's counts and says
 * so. Until then an email over the cap is counted and still proposed.
 */
export const MORNING_LENGTH_HOLDS = false;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const lc = v => String(v ?? '').toLowerCase();

/** The version 2 email action a proposal carries for his own box, or null (another channel, or Jonny's box). Pure. */
export function forHisBox(p) {
  let a = null;
  try { a = JSON.parse(p?.exact_payload ?? 'null'); } catch { a = null; }
  if (!a || a.version !== 2 || a.channel !== 'email' || a.mailbox === 'jonny' || typeof a.body !== 'string') return null;
  return a;
}

/** The message: the body less its greeting ("Hi Robin,") and its sign-off ("Krish"). Pure. */
export function messageOf(body) {
  const parts = String(body ?? '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if (parts.length && /^(?:hi|hello|hey|dear)\b[^\n]{0,60},$/i.test(parts[0])) parts.shift();
  if (parts.length && /^(?:(?:best|thanks|cheers|warmly|regards)[^\n]{0,20},?\s*\n)?krish\.?$/i.test(parts.at(-1))) parts.pop();
  return parts.join('\n\n');
}

/** How many words a piece of text holds. Pure. */
export function wordsIn(text) {
  return (String(text ?? '').match(/\S+/g) ?? []).length;
}

const NAME = /\p{Lu}[\p{L}\d&'’.]*/gu;
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const QUOTE = /"([^"\n]{3,})"|“([^”\n]{3,})”/g;
const bare = w => w.replace(/['’]s$/i, '').replace(/[.'’]+$/, '');

/** A quotation given as their own words: "you wrote", "your post", "you said" and the like just before it. */
const THEIR_WORDS = /\b(?:you (?:wrote|said|posted|put it|called it|argued|asked)|your (?:post|piece|words|line|article|newsletter|talk|episode|book)(?:,| called| titled| on)?)[^.?!"\u201c]{0,30}$/i;

/**
 * The claims in a message: a quotation given as their own words, every
 * number, and every capitalised word that does not start a sentence, a line
 * or a quotation. A quotation that is not given as theirs (an episode the
 * engine proposes) is read as prose. Pure.
 */
export function claimsIn(message) {
  const out = [];
  const text = String(message ?? '');
  for (const m of text.matchAll(QUOTE)) if (THEIR_WORDS.test(text.slice(0, m.index))) out.push({ kind: 'quote', text: (m[1] ?? m[2]).trim() });
  // Every quotation's own words are read as prose, its first word starting a sentence of its own.
  const unquoted = text.replace(QUOTE, (_, a, b) => `\n${a ?? b}\n`);
  for (const m of unquoted.matchAll(NUMBER)) out.push({ kind: 'number', text: m[0].replace(/[,.]+$/, '') });
  for (const sentence of unquoted.split(/(?<=[.?!])\s+|\n+/)) {
    const words = [...sentence.matchAll(NAME)];
    const first = sentence.match(/[\p{L}\d]/u)?.index ?? -1;
    for (const w of words) if (w.index !== first) out.push({ kind: 'name', text: bare(w[0]) });
  }
  return out.filter(c => c.text);
}

/** Every string inside a value, however deep. Pure. */
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'number' && Number.isFinite(v)) out.push(String(v));
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

/** A date on the record in the forms the engine writes it: "May 2021", "May", "2021". Pure. */
function dateForms(text) {
  const out = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})(?:-\d{2})?/g)) {
    const month = MONTHS[Number(m[2]) - 1];
    if (month) out.push(`${month} ${m[1]}`, month, m[1]);
  }
  return out;
}

/**
 * The person's and the company's record, as one lower-cased text the claims
 * are looked up in. Pure.
 */
export function recordText(context, contactId, subjectRef = null) {
  const id = lc(contactId);
  // A show, a stage or a guest the email is about: its own row in the records, by its booking person, its guest or its id.
  const target = /^target:(.+)$/.exec(lc(subjectRef))?.[1] ?? null;
  const shows = (Array.isArray(context?.records?.visibility) ? context.records.visibility : []).filter(t => lc(t?.booking_contact_id) === id || (target && lc(t?.id) === target));
  const guests = (Array.isArray(context?.records?.guests) ? context.records.guests : []).filter(g => lc(g?.contact_id) === id);
  const advisory = (Array.isArray(context?.records?.advisory) ? context.records.advisory : []).filter(r => lc(r?.contact_id) === id);
  const rows = [context?.quiet_ties, context?.network, context?.amplifier_candidates]
    .flatMap(l => (Array.isArray(l) ? l : [])).filter(r => lc(r?.contact_id) === id);
  const research = (Array.isArray(context?.research) ? context.research : [])
    .filter(r => lc(r?.subject_ref) === `contact:${id}` || lc(r?.request_id).includes(id));
  const domains = new Set([...rows, ...advisory.map(a => a.person ?? {})].map(r => lc(r?.contacts?.company_domain ?? r?.company_domain).replace(/^www\./, '')).filter(Boolean));
  const companies = (Array.isArray(context?.companies) ? context.companies : []).filter(c => domains.has(lc(c?.domain).replace(/^www\./, '')));
  const reads = (Array.isArray(context?.research) ? context.research : []).filter(r => r?.kind === 'company_read' && [...domains].some(d => lc(r.query).includes(d)));
  const deals = ['deals', 'stale_deals'].flatMap(k => (Array.isArray(context?.records?.[k]) ? context.records[k] : [])).filter(d => lc(d?.contact_id) === id);
  const all = strings([rows, advisory, research.map(r => [r.answer, r.evidence]), companies, reads.map(r => [r.answer, r.evidence]), deals, shows, guests]);
  const joined = all.join('\n');
  return lc([joined, ...dateForms(joined)].join('\n'));
}

/**
 * This engine's own fixed words: every string literal in the files its
 * words are written from, and the canon's own text. Lower-cased. Pure.
 */
export function engineVocabulary(sources = [], canon = null) {
  const literals = sources.flatMap(src => [...String(src ?? '').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map(m => m[0]));
  return lc([...literals, ...strings(canon), 'I', "I'd", "I'll", "I'm", "I've"].join('\n'));
}

const digits = s => s.replace(/,/g, '');
const wordIn = (w, text) => new RegExp(`(?<![\\p{L}\\d])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`, 'u').test(text);

/** Whether one claim is on the record or one of the engine's own words. Pure. */
export function traced(claim, record, vocabulary) {
  const t = lc(claim.text);
  // A number is matched whole, so 40 is not found inside 4000 or an id.
  if (claim.kind === 'number') { const n = new RegExp(`(?<![\\d.])${digits(t).replace('.', '\\.')}(?![\\d])`); return n.test(digits(record)) || n.test(digits(vocabulary)); }
  if (claim.kind === 'quote') return record.includes(t) || vocabulary.includes(t);
  return wordIn(t, record) || wordIn(t, vocabulary);
}

/**
 * The morning drafts that fail, each with its reason and whether it holds:
 * over the word cap first, then a claim the record does not hold. While
 * length only counts, an email over the cap is still read for claims. Only an
 * email for his own box is read; the rest pass untouched. Pure.
 */
export function morningQa(proposals, { context, vocabulary, lengthHolds = MORNING_LENGTH_HOLDS }) {
  const out = [];
  for (const p of proposals) {
    const a = forHisBox(p);
    if (!a) continue;
    const message = messageOf(a.body);
    const words = wordsIn(message);
    if (words > MORNING_WORDS_MAX) {
      out.push({ proposal_id: p.proposal_id, reason: 'morning_over_80_words', words, held: lengthHolds });
      if (lengthHolds) continue;
    }
    const record = recordText(context, a.recipient_contact_id, p.subject_ref);
    const untraced = claimsIn(`${a.subject ?? ''}\n${message}`).filter(c => !traced(c, record, vocabulary));
    if (untraced.length) out.push({ proposal_id: p.proposal_id, reason: 'morning_claim_untraced', claims: untraced.length, kinds: [...new Set(untraced.map(c => c.kind))], untraced, held: true });
  }
  return out;
}

/** The holds for the report: counts and reasons only, never a word of an email or a name. Pure. */
export function morningHolds(failed) {
  const over = failed.filter(f => f.reason === 'morning_over_80_words' && f.held !== false);
  const untraced = failed.filter(f => f.reason === 'morning_claim_untraced');
  const holds = [];
  if (over.length) holds.push({ reason: 'morning_over_80_words', detail: `${over.length} email${over.length === 1 ? '' : 's'} for his box held: over ${MORNING_WORDS_MAX} words between the greeting and the sign-off.` });
  if (untraced.length) {
    const kinds = [...new Set(untraced.flatMap(f => f.kinds))].sort().map(k => (k === 'name' ? 'a name' : k === 'number' ? 'a number' : 'a quotation'));
    holds.push({ reason: 'morning_claim_untraced', detail: `${untraced.length} email${untraced.length === 1 ? '' : 's'} for his box held: a claim (${kinds.join(', ')}) is on neither the person's nor the company's record.` });
  }
  return holds;
}

/**
 * The activity line for emails over the cap that were counted and not held,
 * or null when there were none. A count only, never a word of an email. Pure.
 */
export function morningLengthLine(failed) {
  const n = new Set(failed.filter(f => f.reason === 'morning_over_80_words' && f.held === false).map(f => f.proposal_id)).size;
  if (!n) return null;
  return `Morning drafts, length counted only: ${n} email${n === 1 ? '' : 's'} for his box ran over ${MORNING_WORDS_MAX} words and ${n === 1 ? 'was' : 'were'} not held (Ruling, Krish, 2026-11-15: length reports for a week before it holds).`;
}
