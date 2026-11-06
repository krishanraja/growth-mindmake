// The opening sentence of a catch-up or an invite, written by Control Center's
// research desk (`write`, Claude with no web search, about $0.0015 each, where
// Control Center serves it, krishanraja/control-center#659; else `question`) from one sourced
// fact on the card, then read by fixed rules before any email carries it
// (Krish, 2026-11-06: "make those still open decisions yourself for the best
// quality"). A sentence that fails, or one not yet answered where the desk is
// open, holds the email: no frame is used in its place.
import { seal, clean } from '../guards.mjs';
import { sentences, quotesClosed, brokenSentence, givenParts } from './rows.mjs';

/** The words a prompt may carry, under the desk's 400 characters. */
export const QUERY_MAX = 400;
/** Lines on a card that are about the research or about Krish, never about them. */
const NOT_THEIRS = /\b(?:already (?:engaged|invited|booked|pitched|contacted)|Krish|role unknown|title unknown|named contact|already replied|suppress|score|fit \d|guest standard|close tie|nothing between you|where you also worked|Seen online|on record|our record|the record|card|research|ICP|buyer|Mindmake)\b/i;
/** Words a model reaches for that Krish does not write. */
const PRAISE = /\b(?:making you|which makes you|worth (?:hearing|listening to|a listen)|useful perspective|valuable perspective|(?:great|good|perfect|natural) fit|impressive|amazing|incredible|inspiring|fantastic|awesome|brilliant|remarkable|stellar|exciting|thrilled|delighted|kudos|congrat\w*|hope this finds)\b/i;
/** Words that tie the sentence to the research or another venture, never said to the person. */
const BANNED = /\b(?:suggests|role unknown|named contact|already replied|suppress|Krish|card|score|record|research|profile|database|ICP|our data|venture)\b/i;
const VERB = /\b(?:[Yy]ou|I)(?:'ve|'d|'re)?\s+(?:\p{Ll}+ly\s+)?\p{Ll}{2,}|\b\p{Ll}{3,}ed\b|\b(?:is|are|was|were|has|have|had|caught|took|built|led|ran|made|wrote|said|grew|left|joined|moved|went)\b/u;

/** A fact cut at a word, at most `max` characters. Pure. */
function cut(text, max) {
  const t = clean(String(text ?? '')).replace(/[\u2013\u2014]/g, ',');
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '');
}

/**
 * The one fact an opening is written from: their post, a move, then the why
 * lines, the hook and who they are, skipping any line about the research or
 * about Krish and any post that is a placeholder or under six words. '' when
 * the card holds none. Pure.
 */
export function openingFact(c, why = []) {
  const facts = Array.isArray(c?.facts) ? c.facts : [];
  const post = facts.map(f => (f?.kind === 'post' ? String(f?.text ?? f?.value ?? '') : '')).map(t => /^Posted: "(.+)"$/.exec(t)?.[1] ?? '')
    .map(q => q.replace(/[\p{Extended_Pictographic}\u2100-\u214f\ufe0f\u200d]/gu, '').replace(/\s+/g, ' ').trim())
    .find(q => q && q.split(/\s+/).length >= 8 && !PRAISE.test(q) && !/\b(?:proud|congrat\w*|lineup|thrilled)\b/i.test(q) && !/\b(?:suppress|ignore|delete|test)\b[^.]*\bpost\b/i.test(q));
  if (post) return `They posted: "${cut(post, 150)}"`;
  const move = facts.map(f => (f?.kind === 'role_change' ? String(f?.text ?? f?.value ?? '') : '')).find(Boolean);
  if (move && !NOT_THEIRS.test(move)) return cut(move, 180);
  const lines = [...why, c?.hook, c?.why_them, c?.who].filter(x => typeof x === 'string' && x.trim());
  for (const l of lines) {
    if (NOT_THEIRS.test(l) || /^They posted\b/i.test(l)) continue;
    const t = cut(l, 180);
    if (t.split(/\s+/).length >= 5) return t;
  }
  return '';
}

/** The question the desk answers: one opening sentence from one fact, in plain words. Pure. */
export function openingQuery({ name, fact, purpose = 'catchup', show = '' }) {
  const first = givenParts(name)[0] ?? 'them';
  const what = purpose === 'invite' ? `why ${first} would make a good conversation for ${show || 'the show'}` : `the opening line of a catch-up email to ${first}`;
  const frame = f => `Write one sentence for ${what}, from only this fact: ${f}. Say to them, as "you", one thing they did or said. Plain words, under 25 words, no dashes, praise, question, sources or new names. Reply with the sentence only.`;
  // The fact is cut at a word to what the desk's 400 characters leave it.
  const room = QUERY_MAX - frame('').length;
  const q = room >= 40 ? frame(cut(String(fact ?? '').replace(/[.!?\s]+$/, ''), room)) : '';
  return q && q.length <= QUERY_MAX ? q : null;
}

/** The London day of an ISO time, as YYYY-MM-DD. Pure. */
const londonDay = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
/**
 * The desk request for one opening, keyed by its own words so a card asked
 * before replays its answer at no cost. After a failed attempt (the desk
 * answered nothing and charged nothing), the same words are asked again under
 * the London day, at most once a day. Pure.
 */
export function openingRequest({ id, name, fact, purpose = 'catchup', show = '', research = [], at = null, kind = 'question' }) {
  const query = openingQuery({ name, fact, purpose, show });
  if (!query) return null;
  // A write is keyed apart from a question with the same words: the desk refuses one id asked two ways.
  const base = `open:${id}:${seal(kind === 'write' ? { query, kind } : { query }).slice(0, 12)}`;
  const tried = (Array.isArray(research) ? research : []).filter(r => typeof r?.request_id === 'string' && (r.request_id === base || r.request_id.startsWith(`${base}:`)));
  const day = at ? londonDay(at) : null;
  const request_id = !tried.length || !day || tried.some(r => !['failed', 'empty'].includes(r.status)) ? (tried.find(r => !['failed', 'empty'].includes(r.status))?.request_id ?? base) : `${base}:${day}`;
  return { request_id, kind, subject_ref: `contact:${id}`, query, why: clean(`Writes the opening sentence of ${purpose === 'invite' ? 'an invite' : 'a catch-up'} from one fact on the card.`).slice(0, 300) };
}

/** The desk's answer to an opening request: { state: 'answered', text } | { state: 'failed' } | { state: 'waiting' }. Pure. */
export function openingAnswer(research, request) {
  if (!request) return { state: 'failed' };
  const list = Array.isArray(research) ? research : [];
  // Any attempt at these words that was answered is the answer: the words' id, with or without a day after it.
  const base = /^open:[^:]+:[0-9a-f]{12}/.exec(request.request_id)?.[0] ?? request.request_id;
  const done = list.find(x => typeof x?.request_id === 'string' && (x.request_id === base || x.request_id.startsWith(`${base}:`)) && x.status === 'answered' && typeof x.answer === 'string' && x.answer.trim());
  if (done) return { state: 'answered', text: done.answer };
  const r = list.find(x => x?.request_id === request.request_id);
  if (!r) return { state: 'waiting' };
  if (r.status === 'answered' && typeof r.answer === 'string' && r.answer.trim()) return { state: 'answered', text: r.answer };
  if (r.status === 'over_cap') return { state: 'waiting' };
  return { state: 'failed' };
}

/**
 * The model's sentence, read by fixed rules: one sentence, six to thirty
 * words, said to them, with a subject and a verb, no dash, question, link or
 * citation, no praise, no word about the research, Krish or another venture,
 * no name or number the fact and their own name do not hold, and no shape the
 * final guard holds. { ok: true, sentence } or { ok: false, reason }. Pure.
 */
export function validOpening(text, { name = '', fact = '', show = '' } = {}) {
  // A dash is read before anything is cleaned: the cleaner would turn it into a comma.
  if (/[\u2013\u2014]|\s-\s/.test(String(text ?? ''))) return { ok: false, reason: 'dash_question_or_link' };
  let s = clean(String(text ?? '')).replace(/\[\d+\]|\(\d+\)/g, '').replace(/\*+/g, '').replace(/^["'“]+|["'”]+$/g, '').replace(/\s+([.,!])/g, '$1').trim();
  if (!s) return { ok: false, reason: 'empty' };
  if (!/[.!]$/.test(s)) s = `${s}.`;
  if (sentences(s).length !== 1 || /[.!?]\s+\p{Lu}/u.test(s.slice(0, -1))) return { ok: false, reason: 'not_one_sentence' };
  const words = s.split(/\s+/).length;
  if (words < 6 || words > 30) return { ok: false, reason: 'length' };
  if (/[\u2013\u2014]|\s-\s|\?|https?:|www\./.test(s)) return { ok: false, reason: 'dash_question_or_link' };
  if (!/\byou(?:r|rs|'ve|'re|'d)?\b/i.test(s)) return { ok: false, reason: 'not_to_them' };
  if (PRAISE.test(s)) return { ok: false, reason: 'praise' };
  if (BANNED.test(s)) return { ok: false, reason: 'research_words' };
  if (!VERB.test(s)) return { ok: false, reason: 'no_verb' };
  if (!quotesClosed(s.replace(/\b\p{L}+'\p{L}+\b/gu, 'x'))) return { ok: false, reason: 'open_quote' };
  // Every name and number must come from the fact, their name or the show: a model adds none.
  const known = `${fact} ${name} ${show}`.toLowerCase();
  const names = s.slice(1).match(/\b\p{Lu}[\p{L}\d&'.-]*/gu) ?? [];
  if (names.some(n => n !== 'I' && !/^I'/.test(n) && !known.includes(n.toLowerCase().replace(/['.]+$/, '').replace(/'s$/, '')))) return { ok: false, reason: 'new_name' };
  if ((s.match(/\d[\d,.]*/g) ?? []).some(n => !known.includes(n.replace(/[.,]+$/, '')))) return { ok: false, reason: 'new_number' };
  const broken = brokenSentence(s);
  if (broken) return { ok: false, reason: broken };
  return { ok: true, sentence: s };
}

/**
 * One opening, end to end: the request to send, and what the email may carry.
 * `required` is true where the desk is open this run: then an answer not yet
 * in, or one that fails the rules, holds the email. Elsewhere (a dry run, a
 * test, a desk that is closed) the caller's own sentence stands. Pure.
 */
export function opening({ id, name, card, why = [], research, required = false, purpose = 'catchup', show = '', at = null, kind = 'question' }) {
  const fact = openingFact(card, why);
  if (!fact) return { request: null, sentence: null, hold: required ? 'opening_no_fact' : null };
  const request = openingRequest({ id, name, fact, purpose, show, research, at, kind });
  const got = openingAnswer(research, request);
  if (got.state === 'answered') {
    const v = validOpening(got.text, { name, fact, show });
    return v.ok ? { request: null, sentence: v.sentence, hold: null } : { request: null, sentence: null, hold: required ? 'opening_failed' : null, reason: v.reason };
  }
  return { request: got.state === 'waiting' && required ? request : null, sentence: null, hold: required ? (got.state === 'waiting' ? 'opening_waiting' : 'opening_failed') : null };
}
