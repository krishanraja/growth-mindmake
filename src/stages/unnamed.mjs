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
 *     ("of", "out of", "in ten", a listed plural noun, a number compound such
 *     as "-figure"); anything else there is read as the company, so a doubt
 *     holds rather than goes out;
 *   - in lower case with its group's own word or as a possessive, and in a web
 *     address whose host or path is it, it is the company too.
 * Pure.
 */

/** The hold code for a draft that names it. */
export const UNNAMED_HOLD = 'former_employer_named';

/** The word, capitalised or in capitals, whole. */
const WORD = /(?<![\p{L}\d])(?:Nine|NINE)(?![\p{L}\d])/gu;
/** Its outlets' own web and app names, and its group's names run together as a web name, in any case. */
const OUTLETS = /(?<![\p{L}\d])(?:9now|9news|ninemsn|nine\.com\.au|channel\s+(?:nine|9)|nine[-_.]?(?:entertainment|networks?|publishing|radio)|nineforbrands|mi9)(?![\p{L}\d])/iu;
/** In lower case it is still the company when its group's own word follows, or as a possessive. */
const LOWER_GROUP = /(?<![\p{L}\d])nine(?:['’]s(?![\p{L}\d])|\s+(?:entertainment|networks?|publishing|radio|co|ltd|limited|holdings|corp|corporation)(?![\p{L}\d]))/iu;
/** A web address. */
const URL = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/giu;
/** The words its group's or an outlet's name adds after it. */
const GROUP_WORDS = new Set(['entertainment', 'network', 'networks', 'publishing', 'radio', 'news', 'digital', 'media', 'group', 'now', 'studio', 'studios', 'ventures', 'holdings', 'limited', 'ltd', 'co', 'company', 'corporation', 'corp']);
/** A sentence's start: the text's own, after a full stop, a colon or a line break, or a list mark. */
const BOUNDARY = /(?:^|[.!?:;][”’"')\]]*\s+|\n)[\s\-*•>]*$/u;
/** An opening quotation or bracket: its first word starts a sentence of its own. */
const OPENER = /(?:^|\s)["“‘'([]+$/u;
/** Number words and small numbers, which make "in", "and", "or" and "to" a quantity ("Nine in ten", "nine or 10"). A year is not one. */
const COUNT = '(?:\\d{1,3}(?!\\d)|ten|eleven|twelve|fifteen|twenty|thirty|fifty|a\\s+hundred|hundred)';
/** The nouns a count names at a sentence's start; any other word ending in s there is read as a verb, so the draft holds. */
const PLURALS = ['leaders', 'boards', 'people', 'years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'times', 'ways', 'steps', 'things', 'ideas', 'questions', 'answers', 'decisions', 'companies', 'businesses', 'clients', 'customers', 'buyers', 'founders', 'executives', 'directors', 'managers', 'teams', 'tools', 'agents', 'parts', 'lessons', 'rules', 'mistakes', 'reasons', 'tips', 'signs', 'skills', 'deals', 'calls', 'meetings', 'posts', 'emails', 'drafts', 'words', 'pages', 'points', 'slides', 'cases', 'stories', 'projects', 'products', 'markets', 'countries', 'cities', 'percent'];
/** The words a number joins with a hyphen ("Nine-figure", "Nine-year-old"). */
const COMPOUNDS = ['figure', 'figures', 'year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'point', 'step', 'part', 'person', 'page', 'fold', 'digit', 'times', 'hole', 'storey', 'story', 'piece', 'man', 'strong'];
/** What makes the word at a sentence's start a number: a quantity after it. */
const QUANTITY = new RegExp(`^(?:-(?:${COMPOUNDS.join('|')})(?![\\p{L}])|\\s+(?:of|out)(?![\\p{L}\\d])|\\s+(?:in|and|or|to)\\s+${COUNT}(?![\\p{L}\\d])|\\s+(?:times|per|percent|hundred|thousand|million|billion|men|women|children|${PLURALS.join('|')}|\\p{Lu}{2,}s)(?![\\p{L}\\d]))`, 'u');

/** Whether a web address points at it: a host label that is the word, or a path segment that is it or starts with it. Pure. */
function urlNamesIt(u) {
  const bare = u.replace(/^https?:\/\//i, '');
  const [host, ...path] = bare.split('/');
  if (host.toLowerCase().split('.').some(l => l === 'nine' || l.startsWith('nine-'))) return true;
  return path.join('/').toLowerCase().split(/[\/?#&=]/).some(seg => seg === 'nine' || seg.startsWith('nine-') || seg.startsWith('nine_'));
}

/** Whether a piece of text names it, by the rules above. Full-width and invisible characters are read as plain text first. Pure. */
export function namesUnnamed(text) {
  const t = String(text ?? '').normalize('NFKC').replace(/\p{Cf}/gu, '');
  if (!t) return false;
  if (OUTLETS.test(t) || LOWER_GROUP.test(t)) return true;
  for (const m of t.matchAll(URL)) if (urlNamesIt(m[0])) return true;
  for (const m of t.matchAll(WORD)) {
    const after = t.slice(m.index + m[0].length);
    if (/^['’]s(?![\p{L}\d])/u.test(after)) return true;
    const next = /^\s+(\p{L}[\p{L}.&'’-]*)/u.exec(after)?.[1] ?? '';
    if (next && /^\p{Lu}/u.test(next) && GROUP_WORDS.has(next.toLowerCase().replace(/[.]+$/, ''))) return true;
    const before = t.slice(0, m.index);
    if (!BOUNDARY.test(before) && !OPENER.test(before)) return true;
    if (!QUANTITY.test(after)) return true;
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
