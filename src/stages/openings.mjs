// The opening sentence of a catch-up or an invite, written by Control Center's
// research desk (`write`, Claude with no web search, about $0.0015 each, where
// Control Center serves it, krishanraja/control-center#659; else `question`) from one sourced
// fact on the card, then read by fixed rules before any email carries it
// (Krish, 2026-11-06: "make those still open decisions yourself for the best
// quality"). A sentence that fails, or one not yet answered where the desk is
// open, holds the email: no frame is used in its place.
import { seal, clean } from '../guards.mjs';
import { sentences, quotesClosed, brokenSentence, givenParts, JOINERS } from './rows.mjs';
import { offerFindings } from './canon.mjs';

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
export function openingQuery({ name, fact, purpose = 'catchup', show = '', last = null }) {
  const first = givenParts(name)[0] ?? 'them';
  if (purpose === 'catchup') return catchUpQuery({ first, fact, last });
  const what = purpose === 'invite' ? `why ${first} would make a good conversation for ${show || 'the show'}` : `the opening line of a catch-up email to ${first}`;
  const frame = f => `Write one sentence for ${what}, from only this fact: ${f}. Say to them, as "you", one thing they did or said. Plain words, under 25 words, no dashes, praise, question, sources or new names. Reply with the sentence only.`;
  // The fact is cut at a word to what the desk's 400 characters leave it.
  const room = QUERY_MAX - frame('').length;
  const q = room >= 40 ? frame(cut(String(fact ?? '').replace(/[.!?\s]+$/, ''), room)) : '';
  return q && q.length <= QUERY_MAX ? q : null;
}

/** The line on what he is building, said the same to everyone: a catch-up asks the desk to carry it, and a warm buyer's note carries it as fixed text (warmNote). Its one home. */
export const BUILDING_LINE = "I'm building Mindmake, AI that works the way a leader thinks.";

/**
 * A catch-up as a person writes one (Krish, 2026-11-06: "I'd sincerely reach
 * out and say, 'It's been a long time. Here's why I'm reaching out. Here's why
 * I thought of you. Would you be open to a quick chat?'"): the whole note in
 * that order, from one fact, never their career told back to them. Pure.
 */
export function catchUpQuery({ first, fact, last = null }) {
  const frame = f => `Catch-up email from Krish to ${first}${last ? `, last in touch ${last}` : ''}. Four short sentences: it's been a while. I'm reaching out because ${BUILDING_LINE.replace(/\.$/, '')}, and want views from people I rate. Why I thought of you, in my words, from only this: ${f}. Would you be open to a quick chat? Warm, plain, no quotes, no career recap.`;
  const room = QUERY_MAX - frame('').length;
  const q = room >= 40 ? frame(cut(String(fact ?? '').replace(/[.!?\s]+$/, ''), room)) : '';
  return q && q.length <= QUERY_MAX ? q : null;
}

/** Months as a person writes them, so "June 2026" for a record's "Jun 2026" is no new name. */
const MONTH_NAMES = 'January February March April May June July August September October November December';
/** A sentence that tells someone their own career back to them (Krish, 2026-11-06: "Who would do that in real life?"). */
const RECITES = /^(?:you|you've|you have|you're|your)\s+(?:went|moved|shifted|joined|left|lead|led|run|ran|built|founded|started|spent|took|bring|have been|been|are now|now)\b/i;

/**
 * The model's catch-up, read by fixed rules: three to five sentences, at most
 * 85 words, says it has been a while, says why he is writing, says why he
 * thought of them, ends asking for a quick chat, no sentence that tells them
 * their career, no dash, link, praise or research word, and no name or number
 * the fact, their name, Mindmake or the month last in touch do not hold.
 * { ok: true, sentence } (the whole body) or { ok: false, reason }. Pure.
 */
export function validCatchUp(text, { name = '', fact = '', last = '' } = {}) {
  if (/[\u2013\u2014]|\s-\s/.test(String(text ?? ''))) return { ok: false, reason: 'dash_question_or_link' };
  const s = clean(String(text ?? '')).replace(/^(?:hi|hello|hey|dear)\s+[^,\n]*,\s*/i, '').replace(/\s*(?:best|cheers|thanks|warmly)?,?\s*krish\.?\s*$/i, '').replace(/^["'“]+|["'”]+$/g, '').trim();
  if (!s) return { ok: false, reason: 'empty' };
  const parts = sentences(s);
  if (parts.length < 3 || parts.length > 5) return { ok: false, reason: 'not_four_sentences' };
  if (s.split(/\s+/).length > 85) return { ok: false, reason: 'length' };
  if (/https?:|www\./.test(s)) return { ok: false, reason: 'dash_question_or_link' };
  if (!/\b(?:been a while|long time|been too long|while since|ages)\b/i.test(s)) return { ok: false, reason: 'no_while' };
  if (!/\bthought of you\b|\byou came to mind\b|\bmade me think of you\b/i.test(s)) return { ok: false, reason: 'no_why_you' };
  if (!/\b(?:reaching out|writing|getting in touch|the reason)\b/i.test(s)) return { ok: false, reason: 'no_why_now' };
  if (!/\b(?:quick|short)\s+(?:chat|call)\b[^.]*\?\s*$/i.test(s)) return { ok: false, reason: 'no_ask' };
  if (parts.some(x => RECITES.test(x.trim()))) return { ok: false, reason: 'recites_career' };
  if (PRAISE.test(s)) return { ok: false, reason: 'praise' };
  if (/\b(?:suggests|role unknown|named contact|already replied|suppress|card|score|record|research|profile|database|ICP|our data|venture)\b/i.test(s)) return { ok: false, reason: 'research_words' };
  if (!quotesClosed(s.replace(/\b\p{L}+'\p{L}+\b/gu, 'x'))) return { ok: false, reason: 'open_quote' };
  if (/["“”]/.test(s)) return { ok: false, reason: 'quotes_them' };
  const known = `${fact} ${name} ${last} ${MONTH_NAMES} Mindmake AI I`.toLowerCase();
  const names = parts.flatMap(x => x.trim().slice(1).match(/\b\p{Lu}[\p{L}\d&'.-]*/gu) ?? []);
  if (names.some(n => n !== 'I' && !/^I'/.test(n) && !known.includes(n.toLowerCase().replace(/['.,]+$/, '').replace(/'s$/, '')))) return { ok: false, reason: 'new_name' };
  if ((s.match(/\d[\d,.]*/g) ?? []).some(n => !known.includes(n.replace(/[.,]+$/, '')))) return { ok: false, reason: 'new_number' };
  for (const x of parts) { const b = brokenSentence(x.trim()); if (b) return { ok: false, reason: b }; }
  // After the greeting is taken off, the note still starts as a sentence does.
  return { ok: true, sentence: s.charAt(0).toUpperCase() + s.slice(1) };
}

/** The London day of an ISO time, as YYYY-MM-DD. Pure. */
const londonDay = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
/**
 * The desk request for one opening, keyed by its own words so a card asked
 * before replays its answer at no cost. After a failed attempt (the desk
 * answered nothing and charged nothing), the same words are asked again under
 * the London day, at most once a day. Pure.
 */
export function openingRequest({ id, name, fact, purpose = 'catchup', show = '', research = [], at = null, kind = 'question', last = null, query: given = null }) {
  // A warm buyer's note (purpose buyer or intro) brings its own words (buyerQuery); every other purpose is built here.
  const query = given ?? openingQuery({ name, fact, purpose, show, last });
  if (!query) return null;
  // A write is keyed apart from a question with the same words: the desk refuses one id asked two ways.
  const base = `open:${id}:${seal(kind === 'write' ? { query, kind } : { query }).slice(0, 12)}`;
  const tried = (Array.isArray(research) ? research : []).filter(r => typeof r?.request_id === 'string' && (r.request_id === base || r.request_id.startsWith(`${base}:`)));
  const day = at ? londonDay(at) : null;
  // A try the desk refused over its daily cap ran nothing and cost nothing: like a failed one, it is asked again under the next London day.
  const RETRY = ['failed', 'empty', 'over_cap'];
  const request_id = !tried.length || !day || tried.some(r => !RETRY.includes(r.status)) ? (tried.find(r => !RETRY.includes(r.status))?.request_id ?? base) : `${base}:${day}`;
  const why = purpose === 'buyer' ? 'Writes a warm note to a buyer from one cited reason to write now.'
    : purpose === 'intro' ? 'Writes a warm ask for one introduction from one cited reason to write now.'
      : `Writes the opening sentence of ${purpose === 'invite' ? 'an invite' : 'a catch-up'} from one fact on the card.`;
  return { request_id, kind, subject_ref: `contact:${id}`, query, why: clean(why).slice(0, 300) };
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
  // Asked again after the desk refused these words over its cap: still waiting on its cap, not on a write in hand.
  if (!r) return list.some(x => typeof x?.request_id === 'string' && (x.request_id === base || x.request_id.startsWith(`${base}:`)) && x.status === 'over_cap') ? { state: 'waiting', over_cap: true } : { state: 'waiting' };
  if (r.status === 'answered' && typeof r.answer === 'string' && r.answer.trim()) return { state: 'answered', text: r.answer };
  if (r.status === 'over_cap') return { state: 'waiting', over_cap: true };
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
export function opening({ id, name, card, why = [], research, required = false, purpose = 'catchup', show = '', at = null, kind = 'question', last = null }) {
  const fact = openingFact(card, why);
  if (!fact) return { request: null, sentence: null, hold: required ? 'opening_no_fact' : null };
  const request = openingRequest({ id, name, fact, purpose, show, research, at, kind, last });
  const got = openingAnswer(research, request);
  if (got.state === 'answered') {
    const v = purpose === 'catchup' ? validCatchUp(got.text, { name, fact, last: last ?? '' }) : validOpening(got.text, { name, fact, show });
    return v.ok ? { request: null, sentence: v.sentence, hold: null } : { request: null, sentence: null, hold: required ? 'opening_failed' : null, reason: v.reason };
  }
  return { request: got.state === 'waiting' && required ? request : null, sentence: null, hold: required ? (got.state === 'waiting' ? 'opening_waiting' : 'opening_failed') : null };
}

// ── A warm buyer's note (Ruling, Krish, 2026-11-13: the full-funnel engine) ──
// The Monday five of Advisory's listed buyers on his two closest tiers
// (src/stages/pilots.mjs). An allowlist, not a denylist: the desk writes one
// sentence only, the reason to write now, from the cited trigger alone, and
// every other word of the note is fixed text. The body is "Hi <first name>,",
// that one sentence, the line on what he is building (BUILDING_LINE, the one
// the catch-up carries), the one ask (the canon's own for a buyer, INTRO_ASK
// for an introduction), the canon's link untagged on its own line, and
// "Krish". The sentence is read by fixed rules (validBuyerNote); one that
// fails, or one not yet answered, holds the email, and no template is ever
// used in its place.

/** The most words the desk's one sentence may carry. */
export const BUYER_SENTENCE_WORDS_MAX = 30;
/** The house ask for an introduction: one fixed sentence, a single question. */
export const INTRO_ASK = 'Do you know one leader I should show it to?';
/** The canon's one ask for a buyer as one fixed question in its own words ("Would you like to start building your AI brain?"), or null with no label read. Pure. */
export function buyerAsk(label) {
  const l = clean(String(label ?? '')).replace(/[.!?]+$/, '');
  return l ? `Would you like to ${l.charAt(0).toLowerCase()}${l.slice(1)}?` : null;
}
/** The fixed sentences a warm note carries around the desk's one: what he is building, then the ask, for a buyer and for an introduction. Pure. */
export function warmFrame(canon) {
  return [BUILDING_LINE, buyerAsk(canon?.ask?.label), INTRO_ASK].filter(Boolean);
}
/** A warm note's paragraph: the desk's one sentence, the building line, then the one ask; null without an ask. Pure. */
export function warmNote(sentence, { label, ask = 'buyer' } = {}) {
  const line = ask === 'intro' ? INTRO_ASK : buyerAsk(label);
  return sentence && line ? `${sentence} ${BUILDING_LINE} ${line}` : null;
}

/**
 * Words of an offer the desk's sentence never carries, whatever the trigger
 * says: an offer, a price, a fee, a discount, a pilot, a workshop, a sprint, a
 * programme, a guarantee, a result, anything free, a trial, a promise, or
 * any length of time. The trigger
 * licenses nothing here: news about their own prices is said by the trigger's
 * page, never by a note in his name. One list, read the same by the rules and
 * by a test.
 */
export const OFFER_WORDS = new RegExp([
  String.raw`\b(?:offer(?:s|ed|ing)?|price[sd]?|fees?|discount(?:s|ed)?|pilots?|workshops?|sprints?|programmes?|programs?|guarantee[sd]?|results?|free|trials?|promise[sd]?|consult(?:s|ed|ing|ancy|ancies|ants?)?|services?|packages?|proposals?|audits?|assessments?|demos?|solutions?|retainers?|engagements?|deliverables?|roadmaps?|blueprints?|frameworks?|playbooks?|templates?|toolkits?|courses?|training|coaching)\b`,
  String.raw`\b(?:\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|sixty|ninety|few|couple of|several)[- ](?:hours?|days?|weeks?|months?|years?|quarters?)\b`,
  String.raw`\b(?:matter of|within|inside|in under|takes?|took|lasting)\s+(?:a\s+|an\s+|the\s+)?(?:few\s+)?(?:hours?|days?|weeks?|months?)\b`,
  String.raw`\b(?:hours?|days?|weeks?|months?)[- ]long\b|\bovernight\b`,
].join('|'), 'i');

/** Number words: none may stand in the desk's sentence unless the trigger holds that exact word. */
const NUMBER_WORDS = new Set(('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen '
  + 'twenty thirty forty fifty sixty seventy eighty ninety hundred hundreds thousand thousands million millions billion billions trillion '
  + 'dozen dozens half halve halved halves twice double doubled triple tripled quadruple quadrupled percent '
  + 'first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth twentieth thirtieth fiftieth hundredth thousandth millionth').split(' '));
/** The first word of the sentence when it is not a word the note may hold: "I" (the desk is asked to begin with it) or an ordinary opener that names no one. */
const FIRST_WORDS = new Set(["i", "i'm", "i've", 'your', 'you', "you're", "you've", 'saw', 'seeing', 'read', 'reading', 'noticed', 'spotted', 'just', 'lately', 'recently', 'this', 'that', 'the', 'it', 'its', "it's", 'glad', 'good', 'looks', 'sounds', 'seems']);
/** What Krish may say he did before the reason: saw it, read it, noticed it. Anything else said of "I" is a claim about him. */
const PERCEIVE = new Set(['saw', 'see', 'seen', 'seeing', 'read', 'reading', 'noticed', 'notice', 'noticing', 'spotted', 'spot', 'spotting', 'heard', 'hear', 'hearing', 'caught', 'catch', 'came', 'come', 'liked', 'loved', 'enjoyed', 'followed', 'following', 'watched', 'watching', 'found', 'thought', 'think']);
const AUXILIARY = new Set(['just', 'recently', 'also', 'really', 'only', 'lately', 'have', 'had', 'was', 'am', 'been']);
/** How Krish may say a thing struck him, which says nothing he did: these hold "me" and "my" and nothing else may. */
const STRUCK = /\b(?:caught my (?:eye|attention)|got my attention|made me (?:think|wonder)(?: of you)?|got me thinking|reminded me(?: of you)?|struck me)\b/gi;
/** The words that name how he came across the trigger, never a claim of their own: they are not counted as new. */
const FRAME_WORDS = new Set(['saw', 'seen', 'seeing', 'read', 'reading', 'noticed', 'noticing', 'spotted', 'caught', 'catch', 'eye', 'attention', 'think', 'thinking', 'thought', 'made', 'reminded', 'struck', 'heard', 'came', 'across', 'post', 'posts', 'news', 'piece', 'article', 'update', 'announcement', 'interview', 'podcast', 'episode', 'wonder', 'wondering']);
/** A verb said after "and", "then" or "so" with no subject of its own is said of "I": a second thing Krish did. Read as a past form, or a common doing word. */
const DOING = new Set(['built', 'made', 'wrote', 'ran', 'took', 'sent', 'put', 'set', 'got', 'led', 'drew', 'gave', 'found', 'brought', 'began', 'won', 'did', 'done', 'went', 'spent', 'kept', 'sold', 'bought', 'paid', 'met', 'told', 'taught', 'shared', 'build', 'make', 'write', 'run', 'help', 'work', 'send', 'share', 'show', 'sketch', 'draft', 'map', 'pull', 'start', 'started']);
/** Words too common to show the sentence took its reason from the trigger. */
const COMMON = new Set(['about', 'after', 'again', 'also', 'been', 'before', 'being', 'from', 'have', 'here', 'into', 'just', 'lately', 'like', 'more', 'most', 'much', 'over', 'recently', 'really', 'same', 'saw', 'seen', 'some', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'would', 'could', 'should', 'your', 'yours', 'other', 'every', 'still', 'since', 'today', 'thing', 'things', 'think', 'thought', 'noticed', 'reading', 'read', 'spotted', 'year', 'years', 'quarter', 'month', 'months', 'week', 'weeks', 'news', 'post']);
/** A run of nine digits or an address never reaches the desk. */
const CONTACT_LIKE = text => /@/.test(text) || (String(text).match(/\+?\d[\d\s().-]{7,}\d/g) ?? []).some(run => (run.match(/\d/g) ?? []).length >= 9);
/** "rebuilt ... pricing ." as a sentence is read: no space before a stop or a comma. Pure. */
export const tidySignal = text => clean(String(text ?? '')).replace(/\s+([.,!?;:])/g, '$1');
/** A word as its meaning is compared: price, prices, priced and pricing meet. Pure. */
export function stemOf(word) {
  let w = String(word ?? '').toLowerCase().replace(/['\u2019]s$/, '');
  const bare = w.replace(/(?:ings?|ed|es|ers?|s|ly)$/, '');
  if (bare.length >= 3) w = bare;
  return w.replace(/e$/, '').slice(0, 5);
}
/** The words of a text that carry its meaning, four letters or more and never a common one, each by its stem. Pure. */
export function contentStems(text) {
  return [...new Set((String(text ?? '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter(w => !COMMON.has(w)).map(stemOf))];
}
/** The words of a text as whole tokens, lower case, a possessive taken off. Pure. */
const tokensOf = text => (String(text ?? '').match(/[\p{L}\p{N}]+(?:['\u2019&.-][\p{L}\p{N}]+)*/gu) ?? []).map(t => t.toLowerCase().replace(/['\u2019]s?$/, ''));
/** The numbers of a text as whole tokens: 40 is not inside 2026, nor 20. Pure. */
const numbersOf = text => (String(text ?? '').match(/\d+(?:[.,]\d+)*/g) ?? []).map(n => n.replace(/[.,]+$/, ''));

/**
 * The instruction the desk writes a warm note's one sentence from, at most
 * QUERY_MAX characters: the reason Krish is writing now, from only the cited
 * trigger, said to them, beginning "I". The trigger is kept whole where it
 * fits, else cut at a word (60 characters or more kept, never ending on a
 * joiner). Null when it cannot be asked: no name or trigger, or a run of
 * digits or an address in it. Pure.
 */
export function buyerQuery({ first, trigger }) {
  const f0 = String(first ?? '').trim(), t = tidySignal(trigger).replace(/[.!?\s]+$/, '');
  if (!f0 || !t) return null;
  // The greeting, what he is building, the ask and the sign-off are fixed text added after (warmNote, rows.mjs actionFor).
  const frame = fact => `Krish's reason for writing to ${f0} now, as one sentence to them, from only this: ${fact}. Begin with "I". Plain words, under ${BUYER_SENTENCE_WORDS_MAX}. No question, link, offer, price, sum of money, time span, praise, or name or number the fact does not hold. The sentence only.`;
  let q = frame(t).length <= QUERY_MAX ? frame(t) : null;
  if (!q) {
    const room = QUERY_MAX - frame('').length;
    const words = cut(t, room).split(' ');
    while (words.length && JOINERS.has(words.at(-1).toLowerCase())) words.pop();
    const kept = words.join(' ').replace(/[,;:\s]+$/, '');
    q = room >= 60 && kept.length >= 60 ? frame(kept) : null;
  }
  return q && q.length <= QUERY_MAX && !CONTACT_LIKE(q) ? q : null;
}

/**
 * The desk's one sentence, read by fixed rules before any note carries it:
 * one sentence of at most BUYER_SENTENCE_WORDS_MAX words, no question, and no
 * link, domain, address or handle of any kind; no word of OFFER_WORDS,
 * whatever the trigger says; no digit or number word that is not that exact
 * token in the trigger; no capitalised word but the recipient's first name or
 * company, a word of the trigger, Mindmake, AI or I (the first word too, or
 * "I" and a few openers that name no one); at least one word of the trigger's
 * own meaning; nothing said of Krish or Mindmake (no "we", "our" or "us", no
 * Mindmake, and "I" only seeing or reading something), no one else's
 * telling and no ask of its own (a call, a time, a chat: the one ask follows
 * as fixed text); and no dash, praise, quotation, research word or broken
 * shape.
 * { ok: true, sentence } or { ok: false, reason }. Pure.
 */
export function validBuyerNote(text, { name = '', company = '', trigger = '', offer = null } = {}) {
  const raw = String(text ?? '');
  // A dash is read before anything is cleaned: the cleaner would turn it into a comma.
  if (/[\u2013\u2014]|\s-\s/.test(raw)) return { ok: false, reason: 'dash' };
  // A greeting of a few words, and a sign-off, are taken off before the words are read.
  let s = raw.replace(/^\s*(?:hi|hello|hey|dear)(?:\s+[\p{L}'\u2019.-]+){0,3}\s*[,!.:\n]\s*/iu, '')
    .replace(/[\s,]*(?:best|cheers|thanks|thank you|warmly|best wishes|kind regards|warm regards|all the best|regards|speak soon)?,?\s*\n*\s*krish\.?\s*$/i, '');
  s = clean(s).replace(/^["'“]+|["'”]+$/g, '').trim();
  if (!s) return { ok: false, reason: 'empty' };
  // Any link, domain, address or handle: the canon's one link follows the note, untagged, and nothing else may.
  if (/https?:|www\.|@|#\p{L}|\b[\p{L}\d-]+\.[a-z]{2,}\b|\S\/\S/u.test(s)) return { ok: false, reason: 'link' };
  if (!/[.!]$/.test(s)) s = `${s}.`;
  if (sentences(s).length !== 1 || /[.!?]\s+\p{Lu}/u.test(s.slice(0, -1))) return { ok: false, reason: 'not_one_sentence' };
  if (s.includes('?')) return { ok: false, reason: 'question' };
  const words = s.split(/\s+/).length;
  if (words < 5 || words > BUYER_SENTENCE_WORDS_MAX) return { ok: false, reason: 'length' };
  if (OFFER_WORDS.test(s) || offerFindings(s, offer).length || (offer?.noun && new RegExp(`\\b${offer.noun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s))) return { ok: false, reason: 'offer_words' };
  // The trigger licenses its own exact names and numbers, nothing more.
  const fact = tidySignal(trigger);
  // A company's own name may hold a number (a channel, a fund): it is theirs, as the trigger's are.
  const factTokens = new Set(tokensOf(fact)), factNumbers = new Set([...numbersOf(fact), ...numbersOf(company)]);
  if (numbersOf(s).some(n => !factNumbers.has(n))) return { ok: false, reason: 'new_number' };
  const toks = tokensOf(s);
  const licensed = new Set([...factTokens, ...tokensOf(company)]);
  // A joined number (twenty-five, a third-quarter) is read part by part.
  if (toks.flatMap(t => [t, ...t.split('-')]).some(t => (NUMBER_WORDS.has(t) || /^\p{L}+fold$/u.test(t)) && !licensed.has(t))) return { ok: false, reason: 'new_number' };
  const allowed = new Set([...tokensOf(givenParts(name)[0] ?? ''), ...tokensOf(company), ...factTokens, 'mindmake', 'ai', 'i', "i'm", "i've", "i'd", "i'll"]);
  const capped = (String(s).match(/[\p{L}\p{N}]+(?:['\u2019&.-][\p{L}\p{N}]+)*/gu) ?? []);
  for (const [i, w] of capped.entries()) {
    // Every part of a word with a capital in it, "eBay" and "AI-native" too, is one the note may hold.
    const parts = w.split('-').filter(x => /\p{Lu}/u.test(x)).map(x => x.toLowerCase().replace(/['\u2019]s?$/, ''));
    if (!parts.length) continue;
    if (parts.every(x => allowed.has(x))) continue;
    if (i === 0 && FIRST_WORDS.has(w.toLowerCase().replace(/\u2019/g, "'"))) continue;
    return { ok: false, reason: 'new_name' };
  }
  // Nothing said of Krish or Mindmake: the building line and the ask say all of that, as fixed text.
  if (/\b(?:we|we're|we've|we'll|we'd|our|ours)\b/i.test(s) || /\bus\b|^Us\b/.test(s) || /\bMindmake\b/i.test(s)) return { ok: false, reason: 'claims_about_us' };
  // "I" may only see, read or notice something: past the helping words, the first word after it is one of those. "I'd" and "I'll" offer something.
  for (const m of s.matchAll(/\bI(?:['\u2019](m|ve|d|ll))?\b/gu)) {
    if (m[1] === 'd' || m[1] === 'll') return { ok: false, reason: 'claims_about_us' };
    const verb = (s.slice(m.index + m[0].length).match(/\p{L}+/gu) ?? []).map(x => x.toLowerCase()).find(x => !AUXILIARY.has(x));
    if (verb && !PERCEIVE.has(verb)) return { ok: false, reason: 'claims_about_us' };
  }
  // "Me" and "my" only where something struck him (caught my eye, made me think): anything else of his is a claim.
  if (/\b(?:me|my|mine|myself)\b/i.test(s.replace(STRUCK, ' '))) return { ok: false, reason: /\b(?:told me|tells me)\b/i.test(s) ? 'hearsay' : 'claims_about_us' };
  // A second doing word after "and", "then" or "so", with no subject of its own, is a second thing he did; the trigger's own words are theirs.
  for (const m of s.matchAll(/\b(?:and|then|so|but)\s+(?:also\s+|then\s+|just\s+|quickly\s+)?(\p{L}+)/giu)) {
    const w = m[1].toLowerCase();
    // Seeing, reading or thinking of them again is not a second thing he did.
    if (factTokens.has(w) || PERCEIVE.has(w)) continue;
    if (DOING.has(w) || (/^\p{Ll}{3,}ed$/u.test(w) && !['need', 'speed', 'seed', 'feed', 'bed', 'red', 'shed'].includes(w))) return { ok: false, reason: 'claims_about_us' };
  }
  if (/\b(?:told me|tells me|mentioned|according to|heard from|said that|says that)\b/i.test(s)) return { ok: false, reason: 'hearsay' };
  // The one ask is fixed text after the sentence: the sentence itself asks for nothing, a call, a time or a chat (a word the trigger itself holds aside).
  const asks = s.match(/\b(?:let['\u2019]?s|let me|book|grab|a call|on a call|quick call|short call|a chat|quick chat|catch up|meet|meeting|coffee|lunch|calendar|a time|a slot|minutes|hop on|jump on|would love|keen to|happy to|reach out|connect|talk|speak|discuss|explore|compar(?:e|ing) notes|pick your brain|hear more|share more|show you|walk you through|introduce|intro|get together|touch base|drop me|send you|open to|interested in|love to|worth a)\b/gi) ?? [];
  if (asks.some(a => !a.split(/\s+/).every(w => factTokens.has(w.toLowerCase())))) return { ok: false, reason: 'second_ask' };
  const stems = contentStems(fact);
  const own = contentStems(s), shared = own.filter(w => stems.includes(w));
  if (!shared.length) return { ok: false, reason: 'no_why_now' };
  // Every other word of meaning is new: no more of them than of the trigger's own, so a claim about them never rides on one shared word.
  const theirs = new Set([...contentStems(givenParts(name)[0] ?? ''), ...contentStems(company), ...[...FRAME_WORDS].map(stemOf)]);
  if (own.filter(w => !stems.includes(w) && !theirs.has(w)).length > Math.max(1, shared.length)) return { ok: false, reason: 'beyond_trigger' };
  if (PRAISE.test(s)) return { ok: false, reason: 'praise' };
  const research = s.match(/\b(?:suggests|role unknown|named contact|already replied|suppress|card|score|record|research|profile|database|ICP|our data|venture)\b/gi) ?? [];
  if (research.some(w => !factTokens.has(w.toLowerCase()))) return { ok: false, reason: 'research_words' };
  if (!quotesClosed(s.replace(/\b\p{L}+'\p{L}+\b/gu, 'x'))) return { ok: false, reason: 'open_quote' };
  if (/["“”]/.test(s)) return { ok: false, reason: 'quotes_them' };
  const broken = brokenSentence(s);
  if (broken) return { ok: false, reason: broken };
  return { ok: true, sentence: s.charAt(0).toUpperCase() + s.slice(1) };
}

/**
 * A warm buyer's note, end to end: the desk request to send and the note the
 * email carries, the desk's one sentence inside the fixed frame (warmNote).
 * `required` is true where the desk is open this run: then a sentence not yet
 * answered holds `note_waiting` with its request, and one that fails the rules
 * holds `note_failed`. Where the desk is closed nothing can be written, so
 * the email is held (`desk_closed`), never written from a frame alone. `ask`
 * is `buyer` or `intro`. Pure.
 */
export function buyerNote({ id, name, company = '', trigger, canon, research = [], required = false, at = null, kind = 'question', ask = 'buyer' }) {
  if (!(ask === 'intro' ? INTRO_ASK : buyerAsk(canon?.ask?.label))) return { request: null, note: null, hold: 'note_failed', reason: 'no_ask' };
  const query = buyerQuery({ first: givenParts(name)[0], trigger: trigger?.signal });
  if (!query) return { request: null, note: null, hold: 'note_failed', reason: 'unaskable' };
  const request = openingRequest({ id, research, at, kind, purpose: ask === 'intro' ? 'intro' : 'buyer', query });
  const got = openingAnswer(research, request);
  if (got.state === 'answered') {
    const v = validBuyerNote(got.text, { name, company, trigger: trigger?.signal ?? '', offer: canon?.offer ?? null });
    return v.ok ? { request: null, note: warmNote(v.sentence, { label: canon?.ask?.label, ask }), sentence: v.sentence, hold: null } : { request: null, note: null, hold: 'note_failed', reason: v.reason };
  }
  if (!required) return { request: null, note: null, hold: 'desk_closed' };
  // A note the desk refused over its cap waits for the next day's ask and holds no place in the batch meanwhile.
  return got.state === 'waiting' ? { request, note: null, hold: 'note_waiting', ...(got.over_cap ? { over_cap: true } : {}) } : { request: null, note: null, hold: 'note_failed', reason: 'desk_failed' };
}
