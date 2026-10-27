import { createHash } from 'node:crypto';

/**
 * Mindmake's canon, read live from its own repository on every run.
 *
 * Ruling (Krish, 2026-10-26): never send a stale pitch; fetch or cross-check
 * the latest from the venture's own repository. The pinned APPROVED_CANON in
 * contracts/growth.ts went stale within days: on 24 October the main ask
 * changed from "Get your free AI brief" to "Start building your AI brain". So
 * every row action is written from the files as they are this run, and names
 * them by git blob SHA (source_revision); Control Center reads each SHA again
 * before he acts and holds the action when a file has moved.
 *
 * Only what the canon already says publicly is read: the main ask and its
 * link, the two doors in their own words, the publication and its link, and
 * the Horizon's buyer. A file that no longer parses holds every row; nothing
 * falls back to an older copy.
 */

export const CANON_REPO = 'krishanraja/mindmake';
export const CANON_PATHS = { north_star: 'project-documentation/00_NORTH_STAR.md', canon: 'project-documentation/01_CANON.md' };
const RAW = 'https://raw.githubusercontent.com/krishanraja/mindmake/main/';

/** The git blob SHA of a file, as `git hash-object` gives it: of its raw bytes when given bytes (a PDF), else of the text's UTF-8. */
export function blobSha(content) {
  const bytes = content instanceof Uint8Array ? Buffer.from(content.buffer, content.byteOffset, content.byteLength) : Buffer.from(String(content), 'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
}

export class CanonError extends Error { constructor(code) { super(code); this.code = code; } }

const one = (text, re, code) => { const m = re.exec(text); if (!m) throw new CanonError(code); return m; };
const flat = s => s.replace(/\s+/g, ' ').trim();

/** What a message may say about Mindmake, from the two files' text. Throws CanonError when a part is missing. */
export function parseCanon({ northStar, canon }) {
  // "1. **Start building your AI brain**, at `https://mindmake.co/?start=1`. The main ask,"
  const ask = one(canon, /^1\. \*\*([^*]{3,80})\*\*, at `(https:\/\/[^`\s]+)`\. The main ask/m, 'main_ask_unreadable');
  // "2. **Subscribe to Make Your Mind Up**, at `https://makeyourmindup.ai`"
  const pub = one(canon, /^2\. \*\*([^*]{3,80})\*\*, at `(https:\/\/[^`\s]+)`/m, 'publication_unreadable');
  // "Describe it as the site does: answer a few questions, keep the brief, then a free consultation."
  const describe = one(canon, /Describe\s+it\s+as\s+the\s+site\s+does:\s+([^.]{10,200})\./, 'main_ask_description_unreadable');
  // "- **Build your AI brain.** Your taste, standards and judgement, running as a system you own."
  const brain = one(northStar, /^- \*\*Build your AI brain\.\*\* ([\s\S]{10,200}?\.)\s*$/m, 'brain_door_unreadable');
  const horizon = one(northStar, /^## Horizon\s+> ([^\n]{20,400})/m, 'horizon_unreadable');
  const publicationName = one(pub[1], /Subscribe to (.+)$/, 'publication_unreadable')[1];
  // Protocol 1.8.0, the angles on the full card: the locked site copy in the
  // canon's own table. Each is optional; a line the canon no longer carries is
  // simply not offered as an angle, never written from memory.
  const cell = label => { const m = new RegExp(`^\\| ${label} \\| ([^|\\n]{3,200}) \\|\\s*$`, 'm').exec(canon); return m ? flat(m[1]) : null; };
  const revenueLabel = cell('Revenue engine door'), revenueLine = cell('Revenue engine door explanation');
  const problem = cell('Homepage section 1 \\(the problem\\)'), answer = cell('Homepage section 2 \\(how it works\\)');
  const headline = cell('Homepage headline \\(first, and the h1\\)');
  return {
    ask: { label: flat(ask[1]), url: ask[2], description: flat(describe[1]) },
    publication: { name: flat(publicationName), url: pub[2] },
    brain: flat(brain[1]),
    horizon: flat(horizon[1]),
    site: {
      headline,
      problem,
      answer,
      revenue: revenueLabel && revenueLine ? { label: revenueLabel, line: revenueLine } : null,
    },
    // Plan section 12, M6 and M12: who buys and what is offered, read here so no
    // stage restates them. Each is null when the canon no longer carries it; a
    // null is never a reason to hold a row, only a reason the shadow says so.
    buyer: parseBuyer({ northStar, canon }),
    offer: parseOffer({ northStar, canon }),
  };
}

// ── Who buys and what is offered (plan section 12, M6, M9 and M12) ─────────
// Control Center wrote its own buyer and offer into code: FACE and DOOR in
// api/_mission.ts, the seed's INDUSTRY list in api/pilot-deals/seed.ts, the
// Mindmake angle in api/_venturePositioning.ts and the pinned offer copy in
// api/_mindmakeGrowthContract.ts. Here they are read from Mindmake's canon as
// it is this run, in its own words, and nothing is kept from memory.

const STOP = new Set(['or', 'whoever', 'owns', 'leader', 'leaders', 'the', 'a', 'an', 'of', 'who', 'and']);
/** A title's usual long form, used only when the canon names the short one. Language, not strategy: it adds no buyer the canon does not name. */
export const TITLE_LONG_FORMS = Object.freeze({ ceo: 'chief executive', cro: 'chief revenue', cfo: 'chief financial', coo: 'chief operating', cmo: 'chief marketing' });
const sentences = s => flat(s).split(/(?<=[.!?])\s+/).map(x => x.replace(/[.!?]+$/, '').trim()).filter(Boolean);
const section = (text, heading) => {
  const m = new RegExp(`^## ${heading}\\s*$`, 'm').exec(text);
  if (!m) return '';
  const rest = text.slice(m.index + m[0].length);
  const end = /^##\s/m.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
};
const bullets = (text, label) => {
  const at = text.indexOf(label);
  if (at < 0) return [];
  const out = [];
  for (const line of text.slice(at + label.length).split('\n').slice(1)) {
    if (/^- /.test(line)) out.push(line.slice(2));
    else if (/^\s{2,}\S/.test(line) && out.length) out[out.length - 1] += ` ${line.trim()}`;
    else if (out.length) break;
  }
  return out.map(flat).filter(Boolean);
};
const listWords = s => s.split(/,\s*|\s+(?:and|or)\s+/).map(w => w.trim().toLowerCase()).filter(w => /^[a-z][a-z-]{1,30}$/.test(w));

/**
 * Who buys, from 01_CANON.md "Who buys" and the Horizon in 00_NORTH_STAR.md.
 * The groups are the buyer; their words are the terms a title is matched on.
 * The sales wedge is the canon's own "internal only" sectors: they may rank
 * work and are never written in a message. Null when no buyer group is read.
 */
export function parseBuyer({ northStar = '', canon = '' }) {
  const who = section(canon, 'Who buys');
  const groupsText = /\*\*Buyer groups\.\*\*\s+([^\n]+(?:\n(?!\n)[^\n]+)*)/.exec(who)?.[1];
  // 00_NORTH_STAR.md "Who this is for": "A founder, principal, ... or senior commercial leader who can move a decision on their own".
  const forWhom = /^A ([a-z ,]{10,200}?) who can move a decision/.exec(flat(section(northStar, 'Who this is for')))?.[1];
  const terms = s => s.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1 && !STOP.has(w));
  // A group is met by any of its alternatives ("CRO, or whoever owns revenue"), and an alternative by all of its words ("portfolio owner").
  const group = (label, from) => ({ label, from, alternatives: label.split(/,\s*or\s+|\s+or\s+/).map(terms).filter(t => t.length) });
  const groups = [
    ...(groupsText ? sentences(groupsText).map(l => group(l, '01_CANON.md')) : []),
    ...(forWhom ? forWhom.split(/,\s*|\s+or\s+/).map(s => s.trim()).filter(Boolean).map(l => group(l, '00_NORTH_STAR.md')) : []),
  ].filter(g => g.alternatives.length);
  if (!groups.length) return null;
  const gate = /\*\*The gate\.\*\*\s+([\s\S]+?)(?:\n\n|$)/.exec(who)?.[1];
  const poor = /\*\*Poor fit\.\*\*\s+([\s\S]+?)(?:\n\n|$)/.exec(who)?.[1];
  const wedge = /\*\*Sales wedge[^*]*\*\*\s+([\s\S]+?)(?:\n\n|$)/.exec(who)?.[1] ?? '';
  const internal = [...flat(wedge).matchAll(/([A-Z][a-z]+(?:,\s*[a-z]+)*(?:\s+and\s+[a-z]+)?)\s+businesses/g)].flatMap(m => listWords(m[1]));
  const horizon = /^## Horizon\s+> ([^\n]{20,400})/m.exec(northStar)?.[1] ?? '';
  const pub = /backed ([a-z]+(?:,\s*[a-z]+)*(?:\s+(?:or|and)\s+[a-z]+)?)\s+leader/i.exec(horizon);
  return {
    groups,
    gate: gate ? flat(gate) : null,
    moments: bullets(who, '**Best-fit moments.**'),
    poor_fit: poor ? sentences(poor) : [],
    sectors: { public: pub ? listWords(pub[1]) : [], internal: [...new Set(internal)] },
  };
}

/** Whether a title is one of the canon's buyer groups: every word of one of a group's alternatives, each as a whole word or, for a short title, its long form. Null when either is missing. Pure. */
export function canonBuyerTitle(title, buyer) {
  if (!buyer?.groups?.length || typeof title !== 'string' || !title.trim()) return null;
  const t = ` ${title.toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  const has = w => t.includes(` ${w} `) || Boolean(TITLE_LONG_FORMS[w] && t.includes(` ${TITLE_LONG_FORMS[w]} `));
  return buyer.groups.some(g => g.alternatives.some(words => words.every(has)));
}

/**
 * What is offered, from 00_NORTH_STAR.md "What we sell" and 01_CANON.md "Do
 * not reintroduce": the offer's own noun, the one public duration and where
 * it may appear, whether the price is private, the retired offers, and the
 * revenue door's line in the plain account. Null when the offer is not read.
 */
export function parseOffer({ northStar = '', canon = '' }) {
  const noun = /Both lead to \*\*one ([a-z ]{3,40})\*\*/.exec(northStar)?.[1];
  if (!noun) return null;
  const days = /public shape is (\d{1,3}) days/.exec(flat(northStar))?.[1] ?? /the (\d{1,3})-day shape/.exec(flat(canon))?.[1] ?? null;
  const ladder = bullets(section(canon, 'Do not reintroduce'), 'One list, so it does not have to be repeated:').find(b => /offer ladder/i.test(b)) ?? '';
  const retired = ladder.replace(/[.]$/, '').split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.replace(/^(?:the|any other)\s+/i, '').trim()).filter(x => x && !/offer ladder/i.test(x));
  const revenue = /^- \*\*Build your AI revenue engine\*\* \(`[^`]+`\): ([\s\S]+?\.)\s*$/m.exec(northStar)?.[1];
  return {
    noun: flat(noun),
    public_days: days ? Number(days) : null,
    price_private: /\bprice is (?:agreed )?private(?:ly)?\b|Entirely private\. No number appears anywhere public/.test(flat(`${northStar} ${canon}`)),
    retired,
    revenue_line: revenue ? flat(revenue) : null,
  };
}

const NUMBER_WORD = '(?:\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fourteen|twenty|thirty)';
const DURATION = new RegExp(`\\b${NUMBER_WORD}[- ](?:day|week|month)s?\\b|\\bmatter of (?:days|weeks|months)\\b`, 'i');
const PRICE = /[$£€]\s?\d|\b(?:fixed |flat )?fees?\b|\bprice[ds]?\b|\bdiscounts?\b|\brate card\b/i;
const OTHER_OFFER = /\b(?:pilot|sprint|strategy day|workshop|retainer|programme|bootcamp)s?\b/i;

/**
 * What a line about the offer says that the canon does not support, as codes,
 * never the words: a retired offer by name (retired_offer), a delivery length
 * outside the two door pages the canon allows it on (duration_promise), a
 * price or fee (price_terms, the canon keeps every figure private), and the
 * offer called something other than its own noun (offer_named_otherwise; the
 * canon's only pilot is a CTRL pilot conversation Krish offers in person).
 * An empty list is a line the canon supports. Pure.
 */
export function offerFindings(text, offer) {
  if (typeof text !== 'string' || !text.trim() || !offer) return [];
  const t = flat(text), out = [];
  const heads = offer.retired.flatMap(r => [r, r.split(/\s+/).at(-1)]).filter(w => w && w.length > 3);
  if (heads.some(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t))) out.push('retired_offer');
  if (DURATION.test(t)) out.push('duration_promise');
  if (offer.price_private && PRICE.test(t)) out.push('price_terms');
  const other = OTHER_OFFER.exec(t)?.[0]?.toLowerCase();
  if (other && !(other.startsWith('pilot') && /\bCTRL\b/.test(t)) && !t.toLowerCase().includes(offer.noun.toLowerCase())) out.push('offer_named_otherwise');
  return out;
}

/** Both files from the default branch, their blob SHAs and what they say. */
export async function readCanon({ fetcher = fetch, timeoutMs = 15000 } = {}) {
  const read = async path => {
    const r = await fetcher(`${RAW}${path}`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new CanonError('canon_unavailable');
    return r.text();
  };
  let northStar, canon;
  try { [northStar, canon] = await Promise.all([read(CANON_PATHS.north_star), read(CANON_PATHS.canon)]); }
  catch (error) { throw error instanceof CanonError ? error : new CanonError('canon_unavailable'); }
  return {
    ...parseCanon({ northStar, canon }),
    files: [
      { repo: CANON_REPO, path: CANON_PATHS.north_star, sha: blobSha(northStar) },
      { repo: CANON_REPO, path: CANON_PATHS.canon, sha: blobSha(canon) },
    ],
  };
}

// ── Krish's track record, from krishraja.com's own repository ──────────────
// A podcast pitch says who Krish is in what his own site publishes this run,
// never from memory. krishanraja/krish-raja is krishraja.com; its
// src/content/receipts.ts holds every figure the site may show, each sourced
// in project-documentation/FACTS.md. Only two things are read: the first
// role's first sentence (where he grew what), and the stage he has spoken on.
// A file that does not parse leaves the record out of the pitch; it never
// holds a pitch and nothing is written from an older copy.

export const RECORD_REPO = 'krishanraja/krish-raja';
export const RECORD_PATH = 'src/content/receipts.ts';
const RECORD_RAW = 'https://raw.githubusercontent.com/krishanraja/krish-raja/main/';

/** One plain sentence of his track record from receipts.ts, or null. Pure. */
export function parseRecord(text) {
  const src = String(text ?? '');
  const quoted = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
  const role = new RegExp(String.raw`org:\s*${quoted}[\s\S]*?detail:\s*${quoted}`).exec(src);
  const org = role ? flat(role[1] ?? role[2] ?? '') : '';
  const detail = role ? flat((role[3] ?? role[4] ?? '').replace(/\\(['"])/g, '$1')) : '';
  const grew = /^([a-z][^.]{10,180}?\.)(?=\s|$)/.exec(detail)?.[1] ?? '';
  const venue = /'Public Speaker \(([^)'"]{3,60})\)'/.exec(src)?.[1] ?? '';
  const did = org && grew ? `At ${org} he ${grew.replace(/\.$/, '')}` : '';
  const spoke = venue ? `he has spoken at ${/^the\s/i.test(venue) ? venue : `the ${venue}`}` : '';
  if (did && spoke) return `${did}, and ${spoke}.`;
  if (did) return `${did}.`;
  if (spoke) return `${spoke.charAt(0).toUpperCase()}${spoke.slice(1)}.`;
  return null;
}

/** His track record as krishraja.com publishes it this run, with the file it came from, or null when it cannot be read. */
export async function readRecord({ fetcher = fetch, timeoutMs = 15000 } = {}) {
  try {
    const r = await fetcher(`${RECORD_RAW}${RECORD_PATH}`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const text = await r.text();
    const line = parseRecord(text);
    return line ? { line, file: { repo: RECORD_REPO, path: RECORD_PATH, sha: blobSha(text) } } : null;
  } catch { return null; }
}
