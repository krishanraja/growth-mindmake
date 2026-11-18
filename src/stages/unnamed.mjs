/**
 * The company Krish does not name (Ruling, Krish, 2026-11-18, docs/RULINGS.md).
 *
 * No word that leaves in his name or in Jonny's names the media company he
 * worked at before Mindmake: not by itself, not in its group's name and not as
 * one of its outlets. Where his record there is worth keeping, its source
 * writes the company as "a national media group"; here, a clause of his record
 * that still names it is dropped, and a draft that still names it is held
 * (`UNNAMED_HOLD`), never sent. The card to Krish may still say a contact
 * worked there: the card is his, and nothing from it reaches words to them.
 *
 * Its name is also a number word, so it is read by fixed rules, never a model:
 *   - in lower case it is the number ("at nine", "nine of ten");
 *   - with the word its group or an outlet adds after it, as a possessive, or
 *     as one of its outlets' web names, it is the company wherever it stands;
 *   - capitalised anywhere but a sentence's start, it is the company;
 *   - at a sentence's start it is the number only when a quantity follows
 *     ("of", "in", "out of", a plural noun); anything else there is read as
 *     the company, so a doubt holds rather than goes out.
 * Pure.
 */

/** The hold code for a draft that names it. */
export const UNNAMED_HOLD = 'former_employer_named';

/** The word, capitalised or in capitals, whole. */
const WORD = /(?<![\p{L}\d])(?:Nine|NINE)(?![\p{L}\d])/gu;
/** Its outlets' own web and app names, in any case. */
const OUTLETS = /(?<![\p{L}\d])(?:9now|9news|ninemsn|nine\.com\.au|channel\s+(?:nine|9))(?![\p{L}\d])/iu;
/** The words its group's or an outlet's name adds after it. */
const GROUP_WORDS = new Set(['entertainment', 'network', 'networks', 'publishing', 'radio', 'news', 'digital', 'media', 'group', 'now', 'studio', 'studios', 'ventures', 'holdings', 'limited', 'ltd', 'co', 'company', 'corporation', 'corp']);
/** A sentence's start: the text's own, after a full stop, a colon or a line break, or a list mark. */
const BOUNDARY = /(?:^|[.!?:;][”’"')\]]*\s+|\n)[\s\-*•>]*$/u;
/** An opening quotation or bracket: its first word starts a sentence of its own. */
const OPENER = /(?:^|\s)["“‘'([]+$/u;
/** What makes the word at a sentence's start a number: a quantity after it. */
const QUANTITY = /^(?:-\p{Ll}|\s+(?:of|out|in|and|or|to|times|per|percent|hundred|thousand|million|billion|people|men|women|children|\p{Ll}+s|\p{Lu}{2,}s)(?![\p{L}\d]))/u;
/** A verb ending in s, which QUANTITY's plural noun would otherwise take: "is", "has", "says". */
const VERB_S = new Set(['is', 'was', 'has', 'does', 'says', 'makes', 'gets', 'gives', 'runs', 'wants', 'needs', 'thinks', 'knows', 'sells', 'owns', 'buys', 'builds', 'leads', 'hires', 'plans', 'sees', 'works', 'grows', 'keeps', 'puts', 'uses', 'holds', 'tells', 'takes', 'brings', 'reaches', 'launches', 'publishes', 'reports', 'announces', 'employs', 'operates', 'broadcasts', 'airs', 'hosts', 'streams', 'shows', 'acquires', 'appoints', 'names', 'hits', 'wins', 'posts', 'sits', 'stands', 'remains', 'becomes', 'looks', 'seems', 'turns', 'moves', 'opens', 'closes', 'cuts', 'adds', 'calls', 'asks', 'pays', 'spends', 'invests', 'backs', 'partners', 'signs', 'plays', 'covers', 'carries', 'tries', 'continues']);

/** Whether a piece of text names it, by the rules above. Pure. */
export function namesUnnamed(text) {
  const t = String(text ?? '');
  if (!t) return false;
  if (OUTLETS.test(t)) return true;
  for (const m of t.matchAll(WORD)) {
    const after = t.slice(m.index + m[0].length);
    if (/^['’]s(?![\p{L}\d])/u.test(after)) return true;
    const next = /^\s+(\p{L}[\p{L}.&'’-]*)/u.exec(after)?.[1] ?? '';
    if (next && /^\p{Lu}/u.test(next) && GROUP_WORDS.has(next.toLowerCase().replace(/[.]+$/, ''))) return true;
    const before = t.slice(0, m.index);
    if (!BOUNDARY.test(before) && !OPENER.test(before)) return true;
    const word = /^\s+(\p{Ll}+)(?![\p{L}\d])/u.exec(after)?.[1] ?? '';
    if (!QUANTITY.test(after) || VERB_S.has(word)) return true;
  }
  return false;
}

/** Every string inside a value, however deep. Pure. */
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

/**
 * The words a proposal would send in his name or Jonny's: every string of a
 * send or post proposal's exact payload (an email, a message, a form's
 * answers, a post), and of a campaign plan's first action, which is prepared
 * from it once he approves the plan. A payload that is not JSON is read
 * whole. The card, the title and the why are his and are not read. Pure.
 */
export function outboundWords(p) {
  const raw = p?.exact_payload;
  if (typeof raw !== 'string' || !raw) return [];
  let v;
  try { v = JSON.parse(raw); } catch { v = undefined; }
  if (['send', 'post'].includes(p?.wall) || p?.channel) return v === undefined ? [raw] : strings(v);
  return v && typeof v === 'object' && v.first_action ? strings(v.first_action) : [];
}

/** The ids of the proposals whose outbound words name it. Pure. */
export function unnamedHeld(proposals) {
  return new Set((Array.isArray(proposals) ? proposals : []).filter(p => outboundWords(p).some(namesUnnamed)).map(p => p.proposal_id));
}

/** Whether an approved action's exact words name it, so it is not carried out. Pure. */
export function decisionNamesUnnamed(decision) {
  return outboundWords({ wall: 'send', exact_payload: decision?.exact_payload }).some(namesUnnamed);
}

/** The hold line for a run: a count and the rule, never a word of the drafts or the name itself (this repository is public). */
export function unnamedHoldLine(n, { approved = false } = {}) {
  const what = approved ? `${n} approved email${n === 1 ? '' : 's'} not sent` : `${n} proposal${n === 1 ? '' : 's'} held`;
  return { reason: UNNAMED_HOLD, detail: `${what}: the words name the media company Krish worked at before Mindmake, which nothing in his name or Jonny's names (Ruling, Krish, 2026-11-18).` };
}
