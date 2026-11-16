import { seal, clean } from '../guards.mjs';
import { coldVerdict, coldActionHold, briefTakers, SOURCE_LINE_MAX } from './compliance.mjs';
import { scoreProspect } from './qualify.mjs';
import { lessons, refusedBy, mailOutcomes, actionFor, rowProposal, servesOf, seniorityOf, cleanName, firstName, hasFullName, fitTitleWithin, fitOf, factTest, firstSentence, angleLines, sourceLinks, cutClean, wholeRole, titleCase, BECAUSE_MAX, CARD_WHO_MAX, CARD_LINE_MAX, TITLE_MAX } from './rows.mjs';
import { icpOf } from './signals.mjs';
import { circleFromNetwork } from './circle.mjs';
import { companySites, companyReadOnFile, companyFacts, COMPANY_FACT_LABEL } from './company.mjs';
import { BUILDING_LINE } from './openings.mjs';
import { wordsIn } from './morning.mjs';

/**
 * The daily cold email lane (docs/GET-GOING.md 1.3; Rulings, Krish,
 * 2026-11-13, "The full-funnel engine": cold outbound within the law; Rulings,
 * Krish, 2026-11-15, "Cold email: one click or STOP deletes the address").
 *
 * The named_cold motion, run each day inside the existing dispatch: the same
 * report, the same research desk, the same morning lane in his own Gmail. No
 * sender, scheduler or store of its own. Control Center adds the footer he
 * approved and checks the whole note; Krish sends.
 *
 * Who: only people Control Center places outside his network
 * (routes[id].in_network === false), from what the context serves: the person
 * rows (the cold pool as served), the signals (commenters the desk read) and
 * the answered lookups (a person_route that filed someone). Never a circle
 * person, anyone with an open Jonny pitch, anyone who took the free brief,
 * anyone who opted out or bounced, anyone with an open deal, or anyone
 * another lane writes to this run. Each is `cold_excluded`.
 *
 * In this order, each failing closed:
 *   1. the cold compliance gate (compliance.mjs coldVerdict), read back fresh
 *      this run, with Control Center's footer and records.brief_takers: a
 *      hold keeps its own code, `cold_<hold>`;
 *   2. the prospect score with the lead scorer joined (qualify.mjs
 *      scoreProspect and SCORERS): `cold_score_low`;
 *   3. the lane's own history: what became of earlier cold notes, from the
 *      context's drafts, with a seven-day pause after bounces over 3% of the
 *      last seven days' cold sends, or three opt-outs or negative replies in a
 *      week (`cold_paused`); history that cannot be proved read holds
 *      everyone (`cold_history_unread`), since unknown is never zero;
 *   4. something specific, cited, on their own record or their company's, or
 *      in the research desk's answer about them; else `cold_nothing_specific`
 *      and, inside a bounded round, the desk is asked;
 *   5. at most COLD_SLOTS_PER_DAY a New York day, follow-ups and repeat
 *      dispatches included (`cold_daily_cap`);
 *   6. the note itself: one ask, at most one link, under COLD_WORDS_MAX words,
 *      no footer of its own, and Control Center's source line
 *      (`cold_note_invalid`).
 * The morning QA and the voice check then read it as every email for his box.
 *
 * One follow-up only, after an open Control Center proved, with a fact new
 * since the note was sent, never naming the open, and never a second one.
 *
 * Counts and codes only leave this file for the report; never a name or an
 * address. Pure.
 */

/** The protocol version whose email action may carry `cold` (features.cold_email). */
export const COLD_VERSION = '1.39.0';
/** The protocol version whose email action may be `kind: follow_up` with `follows` (features.follow_up). */
export const FOLLOW_UP_VERSION = '1.38.0';
/** Cold lane slots a New York day, follow-ups and repeat dispatches included. A tighter cap anywhere wins. */
export const COLD_SLOTS_PER_DAY = 3;
/** A cold note's body is under this many words, greeting and sign-off included. */
export const COLD_WORDS_MAX = 90;
/** The pause, and the rolling cohort it is judged on, in days. */
export const COLD_PAUSE_DAYS = 7;
/** Bounces over this share of the last seven days' cold sends pause the lane. */
export const COLD_BOUNCE_RATE = 0.03;
/** This many opt-outs or negative replies in a week pause the lane. */
export const COLD_COMPLAINTS = 3;
/** A follow-up waits at least this many days after the note was sent. */
export const FOLLOW_UP_AFTER_DAYS = 3;
/** Anyone written to from either box this recently gets no first cold note. */
export const COLD_RECENT_DAYS = 14;
/** An open Jonny pitch is one this recent with nothing yet become of it. */
export const JONNY_OPEN_DAYS = 30;
/** Research asks a run, for qualified people with nothing specific on file. */
export const COLD_RESEARCH_PER_RUN = 3;
/** A first cold note's proposal id prefix, and a follow-up's; the drafts are told apart by them. */
export const COLD_PREFIX = 'gmx-';
export const FOLLOW_PREFIX = 'gmy-';
/** The lane's day is New York's. */
export const COLD_TIMEZONE = 'America/New_York';
/** The holds this lane adds; a compliance hold keeps its own code behind `cold_`. */
export const COLD_HOLDS = Object.freeze(['cold_nothing_specific', 'cold_excluded', 'cold_score_low', 'cold_history_unread', 'cold_daily_cap', 'cold_paused', 'cold_note_invalid']);

const DAY = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTPS = /^https:\/\/\S+$/;
const list = v => (Array.isArray(v) ? v : []);
const lc = v => (typeof v === 'string' && v ? v.toLowerCase() : null);
const time = v => { const t = Date.parse(v ?? ''); return Number.isFinite(t) ? t : null; };
const nyParts = new Intl.DateTimeFormat('en-CA', { timeZone: COLD_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
/** The New York day of a time, as YYYY-MM-DD. Pure. */
export const nyDay = at => nyParts.format(new Date(at));
/** A cold proposal's short id: the first eight hexadecimal characters after its prefix. Pure. */
export const shortOf = id => (/^gm[xy]-([0-9a-f]{8})/.exec(String(id ?? ''))?.[1]) ?? null;
/** Whether a proposal id is the cold lane's: a first note or a follow-up. Pure. */
export const isColdId = id => typeof id === 'string' && (id.startsWith(COLD_PREFIX) || id.startsWith(FOLLOW_PREFIX));
/** Whether a proposal carries a cold email action. Pure. */
export function isColdProposal(p) {
  let a = null;
  try { a = JSON.parse(p?.exact_payload ?? 'null'); } catch { a = null; }
  return !!a && typeof a === 'object' && !!a.cold && typeof a.cold === 'object';
}
/** Whether Control Center serves the cold lane: cold email, at the version that carries it. Pure. */
export function takesCold(capabilities) {
  return capabilities?.features?.cold_email === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes(COLD_VERSION);
}

// ── The note ────────────────────────────────────────────────────────────────

/** The one ask a cold note makes. His frame, said the same to everyone. */
export const COLD_ASK = 'Would you be open to a quick call?';
/** The first line of a follow-up: no word of an open, only that something new was read. */
export const FOLLOW_UP_LINE = 'A short follow-up to my last note, with one thing I have read since.';
export const COLD_SUBJECT = 'A question about AI and your work';
export const FOLLOW_UP_SUBJECT = 'One more thing on AI and your work';
/** The line a signal's note opens with: where we saw them, never their words, which are not on their own record. */
export const SIGNAL_LINE = 'I saw your comment on a public LinkedIn post about AI.';
/** Each source line, one plain line with no link and no address, completing "You're getting this because ...". */
export const SOURCE_LINES = Object.freeze({
  signal: 'I saw your comment on a public LinkedIn post about AI',
  lookup: 'I came across your work in a public search about leaders and AI',
  post: 'I read one of your public posts',
  page: 'I read about your work on a public page',
  company: "I read about your work on your company's website",
});

const LINK = /https?:\/\/\S+|\bwww\.\S+/gi;
const FOOTER = /\bunsubscrib|\bopt[ -]?out\b|getting this because|\breply\s+stop\b|\bstop\s+to\s+(?:unsubscribe|opt|end)|\bregistered\s+(?:office|address)\b/i;
const ASK_PHRASE = /\b(?:let me know|get in touch|book (?:a |some )?(?:time|call|slot)|grab (?:a |some )?time|schedule (?:a|some)|sign up|register (?:here|now)|click (?:here|the link)|reply (?:to|with|here)|hop on|jump on a call)\b/i;
const MENTIONS_OPEN = /\b(?:you )?(?:opened|clicked)\b|\bsaw (?:that )?you (?:read|opened|looked)|\bread my (?:last )?(?:note|email)\b|\bopen(?:ed)? (?:my|the) (?:note|email|link)\b/i;

/** The sentences of a body that ask something: a question, or a request in so many words. Pure. */
export function asksIn(body) {
  return String(body ?? '').split(/(?<=[.?!])\s+|\n+/).map(s => s.trim()).filter(s => s && (s.endsWith('?') || ASK_PHRASE.test(s)));
}

/**
 * Why a cold note may not be proposed, or null. A version 2 email for his own
 * box carrying Control Center's source line (compliance.mjs coldActionHold
 * must pass); a body of one ask, at most one link, under COLD_WORDS_MAX
 * words, with no footer, unsubscribe line or address of its own (Control
 * Center adds the approved footer); a follow-up names the note it follows
 * and never the open that licensed it. Every failure is `cold_note_invalid`. Pure.
 */
export function coldNoteHold(action) {
  const a = action && typeof action === 'object' ? action : {};
  if (a.version !== 2 || coldActionHold(a)) return 'cold_note_invalid';
  const body = typeof a.body === 'string' ? a.body.trim() : '';
  if (!body || wordsIn(body) >= COLD_WORDS_MAX) return 'cold_note_invalid';
  if ((body.match(LINK) ?? []).length > 1) return 'cold_note_invalid';
  if (asksIn(body).length !== 1) return 'cold_note_invalid';
  if (FOOTER.test(body) || /@/.test(body)) return 'cold_note_invalid';
  if (a.kind !== undefined && a.kind !== 'follow_up') return 'cold_note_invalid';
  if (a.kind === 'follow_up' && (typeof a.follows !== 'string' || !a.follows || MENTIONS_OPEN.test(`${a.subject ?? ''}\n${body}`))) return 'cold_note_invalid';
  return null;
}

// ── The lane's history: slots, the pause and the notes sent ────────────────

const COLD_LINE = /^Cold lane: /;
const SLOTS = /\(slots ((?:[0-9a-f]{8})(?: [0-9a-f]{8})*)\)/;

/**
 * What the lane can prove of its own past this run, or `{ read: false, reason }`:
 * the context's drafts with what became of each (features.mail_outcomes), each
 * cold draft naming its person, no drafts coverage line saying they are short,
 * and the recent reports read (features.recent_reports), whose Cold lane line
 * names the slots each run took. `drafts` are the cold drafts; `used` the short
 * ids of every slot taken this New York day, by drafts made today and by
 * proposals earlier reports today posted. Pure.
 */
export function coldHistory({ context, capabilities, history, at }) {
  const drafts = context?.records?.drafts;
  if (capabilities?.features?.mail_outcomes !== true) return { read: false, reason: 'mail_outcomes_not_served' };
  if (!Array.isArray(drafts)) return { read: false, reason: 'drafts_unread' };
  const line = list(context?.coverage).find(c => c?.source === 'drafts');
  if (line && (line.available === false || line.complete === false)) return { read: false, reason: 'drafts_incomplete' };
  if (!Array.isArray(history)) return { read: false, reason: 'reports_unread' };
  const cold = drafts.filter(d => isColdId(d?.proposal_id));
  if (cold.some(d => !UUID.test(String(d?.contact_id ?? '')))) return { read: false, reason: 'draft_without_person' };
  const today = nyDay(at), used = new Set();
  for (const d of cold) {
    const made = time(d.created_at);
    // A draft whose making is unread is counted as today's: unknown is never zero.
    if (made === null || nyDay(made) === today) used.add(shortOf(d.proposal_id));
  }
  for (const r of history) {
    const accepted = time(r?.accepted_at);
    if (accepted !== null && nyDay(accepted) !== today) continue;
    const said = list(r?.activity).map(a => (typeof a === 'string' ? a : a?.line ?? '')).find(l => COLD_LINE.test(l));
    for (const id of (SLOTS.exec(said ?? '')?.[1] ?? '').split(' ').filter(Boolean)) used.add(id);
  }
  used.delete(null);
  return { read: true, drafts: cold, used };
}

/**
 * Whether the lane is paused, from the cold drafts alone. Each bounce, opt-out
 * or reply in the last COLD_PAUSE_DAYS is a moment the rules are read at: the
 * cold notes sent in the seven days before it, and the bounces among them
 * (over COLD_BOUNCE_RATE pauses), and the opt-outs and negative replies in
 * that week (COLD_COMPLAINTS pause). The pause runs seven days from the moment.
 * A reply whose class is not served is unknown, never negative and never
 * none: when it could make the count, the lane cannot prove it may run
 * (`unknown`). `replyClass(draft)` gives 'negative', another class, or null. Pure.
 */
export function coldPause(drafts, at, { replyClass = () => null } = {}) {
  const now = time(at), W = COLD_PAUSE_DAYS * DAY;
  const notes = list(drafts).map(d => ({ sent: time(d?.sent_at) ?? time(d?.bounced_at), bounced: time(d?.bounced_at), out: time(d?.opted_out_at), reply: time(d?.replied_at), cls: replyClass(d) }));
  const moments = [...new Set(notes.flatMap(n => [n.bounced, n.out, n.reply]).filter(t => t !== null && t <= now && t > now - W))];
  let paused = false, unknown = false, bounces = 0, sends = 0, complaints = 0;
  for (const e of moments) {
    const inWeek = t => t !== null && t > e - W && t <= e;
    const cohort = notes.filter(n => inWeek(n.sent));
    const bounced = cohort.filter(n => n.bounced !== null && n.bounced <= e).length;
    const known = notes.filter(n => inWeek(n.out) || (n.out === null && inWeek(n.reply) && n.cls === 'negative')).length;
    const maybe = notes.filter(n => n.out === null && inWeek(n.reply) && n.cls === null).length;
    if (cohort.length && bounced / cohort.length > COLD_BOUNCE_RATE) paused = true;
    if (known >= COLD_COMPLAINTS) paused = true;
    else if (known + maybe >= COLD_COMPLAINTS) unknown = true;
    bounces = Math.max(bounces, bounced); sends = Math.max(sends, cohort.length); complaints = Math.max(complaints, known);
  }
  return { paused, unknown: !paused && unknown, bounces, sends, complaints };
}

// ── Who: the candidates, as served ──────────────────────────────────────────

const answered = r => r && r.status === 'answered';
const PROFILE = /linkedin\.com\/in\/|(?:x|twitter|instagram|facebook|tiktok|threads)\.(?:com|net)\/[^/]+\/?$/i;

/**
 * Every person the lane may consider, by lower-cased contact id, merged across
 * where they were found: the person rows Control Center serves (network,
 * amplifier candidates, quiet ties and Advisory's person rows), the signals
 * (a commenter the desk read who is his buyer, named by Control Center), and
 * the answered lookups (a person_route that filed someone). Nothing is guessed:
 * a field the context does not serve stays empty. Pure.
 */
export function coldCandidates({ context, research = [] }) {
  const out = new Map();
  const at = id => { const k = lc(id); if (!k || !UUID.test(k)) return null; if (!out.has(k)) out.set(k, { id: k, origins: new Set(), facts: [] }); return out.get(k); };
  const rows = [context?.network, context?.amplifier_candidates, context?.quiet_ties].flatMap(list);
  for (const r of list(context?.records?.advisory)) if (r?.person && typeof r.person === 'object' && (r.person.contact_id === undefined || lc(r.person.contact_id) === lc(r.contact_id))) rows.push({ ...r.person, contact_id: r.contact_id });
  for (const r of rows) {
    const c = at(r?.contact_id);
    if (!c) continue;
    c.origins.add('pool');
    c.name ??= cleanName(r?.contacts?.full_name ?? r?.name ?? '') || null;
    c.title ??= cleanName(r?.current_title ?? r?.contacts?.title ?? '') || null;
    c.company ??= cleanName(r?.current_company ?? r?.contacts?.company ?? '') || null;
    c.domain ??= typeof r?.contacts?.company_domain === 'string' ? r.contacts.company_domain : null;
    c.status ??= typeof r?.contacts?.status === 'string' ? r.contacts.status : null;
    c.fit ??= fitOf(r);
    c.competitor = c.competitor === true || r?.sells_competing_services === true;
    for (const f of list(r?.facts)) if (f?.kind === 'post' && typeof f.text === 'string' && HTTPS.test(f.source_url ?? '') && !PROFILE.test(f.source_url)) c.facts.push({ kind: 'post', text: f.text, url: f.source_url, at: time(f.observed_at) });
  }
  const routed = new Map(list(research).filter(r => r?.kind === 'person_route' && answered(r) && /^contact:/.test(String(r.subject_ref ?? ''))).map(r => [String(r.query ?? '').slice(3).toLowerCase(), { id: r.subject_ref.slice(8), request_id: r.request_id }]));
  for (const r of list(research).filter(x => x?.kind === 'post_engagers' && answered(x))) {
    for (const e of list(r.evidence)) {
      const p = e?.person;
      if (!p || !HTTPS.test(e?.url ?? '') || !icpOf(p, e.snippet)) continue;
      const c = at(p.contact_id ?? routed.get(String(p.handle ?? '').toLowerCase())?.id);
      if (!c) continue;
      c.origins.add('signal');
      c.name ??= cleanName(p.name ?? '') || null;
      c.title ??= cleanName(p.headline ?? '') || null;
      c.signal ??= { url: e.url, at: time(e.published) };
    }
  }
  for (const { id, request_id } of routed.values()) {
    const c = at(id);
    if (!c) continue;
    c.origins.add('lookup');
    c.lookup ??= request_id;
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Where a candidate was found, as the compliance gate's source and the footer's
 * source line: their public comment, a public post of theirs, or the lookup
 * that filed them. Null when nothing says where. Pure.
 */
export function provenanceOf(c) {
  if (c.signal) return { source: c.signal.url, line: SOURCE_LINES.signal };
  const post = c.facts.find(f => f.kind === 'post');
  if (post) return { source: post.url, line: SOURCE_LINES.post };
  if (c.lookup && /^[A-Za-z0-9._:/-]{1,180}$/.test(c.lookup)) return { source: `research:${c.lookup}`, line: SOURCE_LINES.lookup };
  return { source: null, line: null };
}

/**
 * What the context serves of who may be written to cold: nothing yet for the
 * country, the United Kingdom subscriber type, the address's domain or whether
 * it was worked out, so each stays unread and the gate holds. A caller with a
 * served record passes its own reader. Pure.
 */
export const servedEligibility = () => ({});

// ── Something specific: a cited fact ────────────────────────────────────────

/** A fact as a cold note may quote it whole: a real sentence, short, with no question, link, address, quotation mark or dash. Pure. */
export function quotable(text) {
  const t = clean(String(text ?? '')).trim();
  if (t.length < 12 || t.length > 160 || /[?@"“”]|https?:|www\./i.test(t)) return null;
  return factTest(t).ok ? t : null;
}

/**
 * The cited facts known of one person, best first: their public comment, their
 * own posts on their record, the research desk's answers about them, and their
 * company's own site. Each `{ kind, text, url, at, label }`, `at` when it was
 * true or read. Pure.
 */
export function specificFacts(c, { research = [], sites = new Map(), at }) {
  const out = [];
  if (c.signal) out.push({ kind: 'signal', text: null, url: c.signal.url, at: c.signal.at, label: 'Their public comment on a LinkedIn post about AI' });
  for (const f of c.facts) { const text = quotable(f.text); if (text) out.push({ kind: 'post', text, url: f.url, at: f.at, label: 'Their own public post' }); }
  for (const r of list(research).filter(x => answered(x) && lc(x.subject_ref) === `contact:${c.id}` && ['search', 'question'].includes(x.kind))) {
    const when = time(r.answered_at ?? r.requested_at);
    const pages = list(r.evidence).filter(e => HTTPS.test(e?.url ?? '') && !PROFILE.test(e.url));
    if (r.kind === 'question') { const text = quotable(firstSentence(r.answer ?? '')); if (text && pages[0]) out.push({ kind: 'research', text, url: pages[0].url, at: when, label: 'The research desk, with its source' }); continue; }
    for (const e of pages) { const text = quotable(firstSentence(e.snippet ?? '')); if (text) { out.push({ kind: 'research', text, url: e.url, at: when, label: clean(e.title ?? '').slice(0, 200) || 'A page about them' }); break; } }
  }
  const site = sites.get(c.id);
  const read = site ? companyReadOnFile(research, site, at) : null;
  for (const f of companyFacts(read)) {
    const text = quotable(f.text.slice(COMPANY_FACT_LABEL.length));
    if (text) { out.push({ kind: 'company', text, url: f.url, at: time(read.answered_at ?? read.requested_at), label: f.label }); break; }
  }
  return out;
}

/** The note's line for one fact: where it came from, and the fact quoted whole, its full stop outside the quotation. Pure. */
export function factLine(f) {
  const q = t => (/[.!]$/.test(t) ? `"${t}"` : `"${t}".`);
  if (f.kind === 'signal') return SIGNAL_LINE;
  if (f.kind === 'post') return `I read your post: ${q(f.text)}`;
  if (f.kind === 'company') return `Your company's site says: ${q(f.text)}`;
  return `I read this about your work: ${q(f.text)}`;
}
/** The card's line for one fact, a whole sentence. Pure. */
function factCardLine(f) {
  const q = t => (/[.!]$/.test(t) ? `"${t}"` : `"${t}".`);
  if (f.kind === 'signal') return 'They commented in public on a LinkedIn post about AI.';
  if (f.kind === 'post') return cutClean(`They wrote in a public post: ${q(f.text)}`, CARD_LINE_MAX);
  if (f.kind === 'company') return cutClean(`Their company's site says: ${q(f.text)}`, CARD_LINE_MAX);
  return cutClean(`A cited source says: ${q(f.text)}`, CARD_LINE_MAX);
}

/** The exact words of one cold note, as his own box takes them. Pure. */
export function coldAction({ c, fact, sourceLine, follows = null }) {
  const lines = follows ? [FOLLOW_UP_LINE, factLine(fact), COLD_ASK] : [factLine(fact), BUILDING_LINE, COLD_ASK];
  const base = actionFor('email', c.id, c.name ?? '', { subject: follows ? FOLLOW_UP_SUBJECT : COLD_SUBJECT, lines });
  return { ...base, mailbox: 'krish', ...(follows ? { kind: 'follow_up', follows } : {}), cold: { source_line: sourceLine } };
}

// ── The proposal ────────────────────────────────────────────────────────────

const REACH = Object.freeze({ value: null, band: 'unknown', basis: 'a cold buyer, not an amplifier', source_url: null, as_of: null });
const KNOWN = 'You do not know them yet. They are outside your network, so this is a cold email from your own box.';
const GAIN = 'One reply could be a first meeting with a leader who has not met Mindmake yet.';
const FOOTER_NOTE = 'Control Center adds the footer you approved, with the one-click link and the STOP reply, and checks the whole note; you send it.';

/** One cold note or follow-up as a REACH OUT row proposal, shaped as the dispatch finishes them. Pure. */
export function coldProposal({ c, fact, action, score = null, follows = null, files, at, titleMax = TITLE_MAX, weekGoals = [], canon, research = [] }) {
  const name = c.name ?? '';
  const named = hasFullName(name);
  const kind = follows ? 'follow-up' : 'email';
  const title = fitTitleWithin(titleMax, ...(named ? [`Cold ${kind} to ${name}`, `Cold ${kind} to ${firstName(name)}`] : []), `Cold ${kind} to someone new`);
  const role = c.title ? wholeRole(titleCase(c.title), c.company ?? '', BECAUSE_MAX - 30) : '';
  const because = `${role ? `${role}. ` : ''}Outside your network: cold.`.slice(0, BECAUSE_MAX);
  const who = cutClean(`${named ? name : 'Someone new'}${c.title ? `, ${titleCase(c.title)}` : ''}${c.company && !(c.title ?? '').toLowerCase().includes(c.company.toLowerCase()) ? `, ${c.company}` : ''}.`, CARD_WHO_MAX);
  const scored = score ? `They clear the cold compliance gate and score ${score.score} against a floor of ${score.floor}.` : 'They cleared the cold compliance gate again for this one follow-up.';
  const serves = servesOf('reach_out', weekGoals);
  const angles = canon ? angleLines({ ask: 'cited', kind: null, name: name || 'them', c: {}, company: c.company ?? '', canon }) : [];
  const card = {
    who, known: KNOWN,
    why: [factCardLine(fact), follows ? 'A follow-up after an open Control Center proved, with a fact new since the note.' : scored].map(l => cutClean(l, CARD_LINE_MAX)),
    gain: [GAIN, ...(serves ? [cutClean(`It serves this week's goal: ${serves.replace(/[.!?]+$/, '')}.`, CARD_LINE_MAX)] : [])],
    angles: angles.length ? angles : [{ title: 'Build your AI brain', line: cutClean(`Open with what you read, then the brain door, in the site's words: "${canon?.brain ?? ''}"`, CARD_LINE_MAX) }],
    sources: sourceLinks({ research, id: c.id, domain: c.domain, company: c.company, extra: [{ label: fact.label, url: fact.url }] }),
  };
  const brief = [who, factCardLine(fact), follows ? 'One follow-up, once, never a chain.' : scored, FOOTER_NOTE];
  const p = rowProposal({
    row: 'reach_out', ask: 'cold', contactId: c.id, name: name || 'them', title,
    why: `${named ? name : 'Someone new'}${c.title ? `, ${c.title},` : ''} is outside his network. ${factCardLine(fact)} ${score ? `Scored ${score.score} (floor ${score.floor}): ${score.reasons.slice(0, 3).join('; ')}.` : ''} ${FOOTER_NOTE}`,
    because, brief, card, action, reach: REACH, kind: null,
    features: { sector: null, topic: 'ai_and_their_job', seniority: seniorityOf(c.title ?? '') }, serves, files,
    evidence: [{ label: clean(fact.label).slice(0, 500), url: fact.url }], at,
  });
  const proposal_id = follows ? `${FOLLOW_PREFIX}${seal({ subject: c.id, follows }).slice(0, 32)}` : `${COLD_PREFIX}${seal({ subject: c.id, lane: 'cold' }).slice(0, 32)}`;
  return { ...p, proposal_id, close_condition: { event: 'outreach_sent', reference: follows ? 'reach_out:cold_follow_up' : 'reach_out:cold' } };
}

// ── The lane ────────────────────────────────────────────────────────────────

/** A compliance hold as the lane reports it: its own code, behind `cold_` once (the footer's holds carry it already). Pure. */
export const gateCode = h => (String(h).startsWith('cold_') ? String(h) : `cold_${h}`);

const CONCLUDED = ['replied_at', 'booked_at', 'recorded_at', 'published_at', 'bounced_at', 'opted_out_at', 'binned_at'];
const toKey = v => { const s = lc(String(v ?? '')); return s ? s.replace(/^contact:/, '') : null; };

/** The people no cold note goes to this run, each a set of lower-cased contact ids. Pure. */
export function coldExclusions({ context, at, taken = new Set() }) {
  const now = time(at);
  const drafts = list(context?.records?.drafts);
  const { optedOut, bounced } = mailOutcomes(drafts);
  const circle = new Set([
    ...list(context?.records?.guests).filter(g => g?.discovery_source === 'growth_circle').map(g => toKey(g.contact_id)),
    ...circleFromNetwork(context).map(p => toKey(p.contact_id)),
  ].filter(Boolean));
  const booking = new Map(list(context?.records?.visibility).map(t => [lc(t?.id), toKey(t?.booking_contact_id)]));
  const jonny = new Set();
  for (const d of drafts) {
    if (d?.mailbox !== 'jonny' || CONCLUDED.some(k => d[k] != null)) continue;
    const made = time(d.created_at ?? d.sent_at);
    if (made !== null && now - made > JONNY_OPEN_DAYS * DAY) continue;
    for (const who of [toKey(d.contact_id), booking.get(lc(d.visibility_target_id))]) if (who) jonny.add(who);
  }
  const deals = new Set(list(context?.records?.deals).map(d => toKey(d?.contact_id)).filter(Boolean));
  const recent = new Set(drafts.filter(d => { const t = time(d?.created_at) ?? time(d?.sent_at); return t !== null && now - t <= COLD_RECENT_DAYS * DAY; }).map(d => toKey(d.contact_id)).filter(Boolean));
  const touched = new Set(drafts.filter(d => String(d?.proposal_id ?? '').startsWith(COLD_PREFIX)).map(d => toKey(d.contact_id)).filter(Boolean));
  const others = new Set([...taken].map(toKey).filter(Boolean));
  return { optedOut: new Set([...optedOut].map(toKey)), bounced, circle, jonny, deals, recent, touched, others };
}

/** Why one person is excluded from a cold note this run, or null. A follow-up skips only the rules a first note alone has. Pure. */
export function excludedBy(c, { ex, routes, takers, L, at, followUp = false }) {
  const route = routes?.[c.id] ?? null;
  if (!route || route.in_network !== false) return 'in_network_or_unplaced';
  if (!['verified', 'unchecked'].includes(route.email) || ex.bounced.has(c.id)) return 'no_address_or_bounced';
  if (ex.optedOut.has(c.id)) return 'opted_out';
  if (takers?.has(`contact:${c.id}`)) return 'brief_taker';
  if (ex.circle.has(c.id)) return 'circle';
  if (ex.jonny.has(c.id)) return 'open_jonny_pitch';
  if (ex.deals.has(c.id)) return 'open_deal';
  if (ex.others.has(c.id)) return 'another_lane';
  if (refusedBy(L, { subject: `contact:${c.id}`, row: 'reach_out', kind: null, sector: null, topic: 'ai_and_their_job', band: 'unknown' }, at)) return 'declined_or_snoozed';
  if (!followUp && ex.touched.has(c.id)) return 'already_written_cold';
  if (!followUp && ex.recent.has(c.id)) return 'written_lately';
  return null;
}

/**
 * The research a qualified person with nothing specific waits on: their
 * company's site where it is served, else one search under
 * `cold:<id>:<YYYY-MM>`, never asked twice in a month. Pure.
 */
function researchFor(c, { research, sites, at }) {
  const site = sites.get(c.id);
  if (site) return { company: { site } };
  if (!hasFullName(c.name ?? '') || !c.company) return {};
  const request_id = `cold:${c.id}:${new Date(at).toISOString().slice(0, 7)}`;
  if (list(research).some(r => r?.request_id === request_id)) return {};
  const query = clean(`${c.name} ${c.company}`).slice(0, 400);
  if (/@|\d{7,}/.test(query)) return {};
  return { request: { request_id, kind: 'search', subject_ref: `contact:${c.id}`, query, why: 'A cold note to them waits for one specific, cited fact; nothing on file says enough yet.' } };
}

/**
 * The daily cold lane: `{ rows, research, company_reads, held, counts, used, cap }`.
 * `rows` are `{ score, proposal }` entries, follow-ups first; `research` the
 * desk requests a bounded round may ask; `company_reads` the sites wanted;
 * `held` one code a held person; `used` the short ids of every slot taken this
 * New York day with this run's; `cap` the slots a day after tighter caps.
 * `gate` is the compliance gate read back this run (readGate); `history` the
 * recent reports, null when unread; `taken` the people other lanes write to
 * this run. `eligibility` reads what the context serves of who may be written
 * to cold (servedEligibility: nothing yet); `replyClass` a draft's reply class
 * (none is served). Pure.
 */
export function coldRows({ context, research = [], gate = null, canon = null, at, taken = new Set(), history = null, capabilities = null, files = [], titleMax = TITLE_MAX, weekGoals = [], cap = COLD_SLOTS_PER_DAY, eligibility = servedEligibility, replyClass = () => null }) {
  const held = [], rows = [], asks = [], wants = [];
  const counts = { read: 0, excluded: 0, held: 0, proposed: 0, follow_ups: 0, research_asked: 0, slots_used: 0, cap: 0, paused: false, history: 'read' };
  const perDay = capabilities?.cold_email?.per_day;
  const room = Math.max(0, Math.min(COLD_SLOTS_PER_DAY, Number.isInteger(cap) ? cap : COLD_SLOTS_PER_DAY, Number.isInteger(perDay) && perDay >= 0 ? perDay : COLD_SLOTS_PER_DAY));
  counts.cap = room;
  const hold = code => { held.push(code); counts.held++; };
  const routes = Object.fromEntries(Object.entries(context?.routes ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const takers = briefTakers(context);
  const drafts = list(context?.records?.drafts);
  const L = lessons(context?.feedback, at, drafts, takers);
  const ex = coldExclusions({ context, at, taken });
  const sites = companySites(context);
  const past = coldHistory({ context, capabilities, history, at });
  const pause = past.read ? coldPause(past.drafts, at, { replyClass }) : null;
  counts.paused = !!pause?.paused;
  counts.history = !past.read ? 'unread' : pause.unknown ? 'unproven' : 'read';
  const used = new Set(past.read ? past.used : []);
  const before = new Set(used);
  const ready = [];
  // The lane's own state holds whoever reaches it: its history not proved, or paused.
  const laneHold = !past.read || pause.unknown ? 'cold_history_unread' : pause.paused ? 'cold_paused' : null;
  const verdictOf = (c, prov) => { const e = eligibility(c, context) ?? {}; return coldVerdict({
    ...e,
    subject_ref: `contact:${c.id}`, source: prov.source, company_domain: c.domain ?? e.company_domain, status: c.status ?? null,
    opted_out: ex.optedOut.has(c.id), brief_taker: takers ? takers.has(`contact:${c.id}`) : undefined,
  }, gate); };

  // One follow-up, after an open Control Center proved (protocol 1.38.0, features.follow_up and its receipts).
  const follows = capabilities?.features?.follow_up === true && capabilities?.features?.receipts === true && list(capabilities?.schema_versions).includes(FOLLOW_UP_VERSION);
  const people = new Map(coldCandidates({ context, research }).map(c => [c.id, c]));
  const followed = new Set();
  if (follows && past.read) {
    const links = list(context?.asset_opens?.links);
    const followUps = new Set(past.drafts.filter(d => d.proposal_id.startsWith(FOLLOW_PREFIX)).map(d => toKey(d.contact_id)));
    for (const d of past.drafts.filter(x => x.proposal_id.startsWith(COLD_PREFIX)).sort((a, b) => (time(a.sent_at) ?? 0) - (time(b.sent_at) ?? 0))) {
      const id = toKey(d.contact_id), sent = time(d.sent_at);
      if (sent === null || time(at) - sent < FOLLOW_UP_AFTER_DAYS * DAY) continue;
      if (['replied_at', 'bounced_at', 'opted_out_at', 'binned_at'].some(k => d[k] != null) || followUps.has(id) || ex.deals.has(id)) continue;
      // A recipient's own open after the send, never his own click or a scanner's (protocol 1.29.0, features.receipts).
      const opened = links.some(l => l?.proposal_id === d.proposal_id && l.recipient_opened === true && (time(l.first_recipient_opened_at) ?? -Infinity) > sent);
      if (!opened) continue;
      const c = people.get(id) ?? { id, origins: new Set(), facts: [] };
      followed.add(id);
      counts.read++;
      if (excludedBy(c, { ex, routes, takers, L, at, followUp: true })) { counts.excluded++; hold('cold_excluded'); continue; }
      const prov = provenanceOf(c);
      const v = verdictOf(c, prov);
      if (!v.allowed) { hold(gateCode(v.holds[0])); continue; }
      if (laneHold) { hold(laneHold); continue; }
      // Only with a fact new since the note was sent.
      const fact = specificFacts(c, { research, sites, at }).find(f => f.at !== null && f.at > sent);
      if (!fact) { hold('cold_nothing_specific'); const r = researchFor(c, { research, sites, at }); if (r.request) asks.push(r.request); if (r.company) wants.push(r.company); continue; }
      ready.push({ c, fact, prov, follows: d.proposal_id, score: null, rank: 0 });
    }
  }

  for (const c of people.values()) {
    if (followed.has(c.id)) continue;
    counts.read++;
    if (excludedBy(c, { ex, routes, takers, L, at })) { counts.excluded++; hold('cold_excluded'); continue; }
    // 1. The cold compliance gate, first.
    const prov = provenanceOf(c);
    const v = verdictOf(c, prov);
    if (!v.allowed) { hold(gateCode(v.holds[0])); continue; }
    // 2. The prospect score, the lead scorer joined; authority is never read from a title.
    const facts = specificFacts(c, { research, sites, at });
    const route = routes[c.id] ?? {};
    const score = scoreProspect({
      title: c.title ?? '', sector: null, decision_authority: 'unknown', moment: null,
      evidence: { person: facts.some(f => f.kind !== 'company'), company: facts.some(f => f.kind === 'company') },
      email_route: route.email ?? 'none', suppressed: false, sells_competing_services: c.competitor === true, status: c.status ?? null,
      signal: !!c.signal, mindmake_fit: c.fit ?? null, in_network: route.in_network,
    }, { buyer: canon?.buyer, at });
    if (!score.qualified) { hold('cold_score_low'); continue; }
    // 3. The lane's own history.
    if (laneHold) { hold(laneHold); continue; }
    // 4. Something specific, cited; else the desk is asked, inside a bounded round.
    const fact = facts[0];
    if (!fact) {
      hold('cold_nothing_specific');
      const r = researchFor(c, { research, sites, at });
      if (r.request) asks.push({ ...r.request, score: score.score });
      if (r.company) wants.push({ ...r.company, score: score.score });
      continue;
    }
    ready.push({ c, fact, prov, follows: null, score, rank: 1 });
  }

  // 5. The day's slots, follow-ups first, then the best scored; a proposal already posted today keeps its slot.
  ready.sort((a, b) => a.rank - b.rank || (b.score?.score ?? 0) - (a.score?.score ?? 0) || a.c.id.localeCompare(b.c.id));
  for (const r of ready) {
    const sourceLine = r.prov.line ?? (r.fact.kind === 'company' ? SOURCE_LINES.company : SOURCE_LINES.page);
    const action = coldAction({ c: r.c, fact: r.fact, sourceLine: sourceLine.slice(0, SOURCE_LINE_MAX), follows: r.follows });
    // 6. The note itself.
    if (coldNoteHold(action)) { hold('cold_note_invalid'); continue; }
    const proposal = coldProposal({ c: r.c, fact: r.fact, action, score: r.score, follows: r.follows, files, at, titleMax, weekGoals, canon, research });
    const sid = shortOf(proposal.proposal_id);
    if (!used.has(sid)) {
      if (used.size >= room) { hold('cold_daily_cap'); continue; }
      used.add(sid);
    }
    rows.push({ score: r.score?.score ?? 0, proposal });
    counts.proposed++;
    if (r.follows) counts.follow_ups++;
  }
  const research_out = asks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, COLD_RESEARCH_PER_RUN).map(({ score, ...r }) => r);
  counts.research_asked = research_out.length;
  counts.slots_used = used.size;
  return { rows, research: research_out, company_reads: wants.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, COLD_RESEARCH_PER_RUN), held, counts, used, before, cap: room };
}

/**
 * The lane's one activity line: counts, and the slots this New York day by
 * short id, so a later run the same day counts them (coldHistory). `before`
 * holds the slots earlier drafts and reports took; `posted` the cold proposals
 * this report carries. Never a name or an address. Pure.
 */
export function coldLine({ counts, before = new Set(), posted = [] }) {
  const ids = [...new Set([...before, ...posted.map(p => shortOf(p.proposal_id)).filter(Boolean)])].sort();
  const follows = posted.filter(p => String(p.proposal_id).startsWith(FOLLOW_PREFIX)).length;
  const state = counts.history === 'unread' ? '; its history could not be read, so nothing cold went'
    : counts.history === 'unproven' ? '; replies of unknown class could pause it, so nothing cold went'
      : counts.paused ? '; paused for seven days by bounces, opt-outs or negative replies' : '';
  return `Cold lane: ${counts.read} ${counts.read === 1 ? 'person' : 'people'} read, ${posted.length} proposed (${follows} follow-up${follows === 1 ? '' : 's'}), ${counts.held} held, ${counts.research_asked} research ask${counts.research_asked === 1 ? '' : 's'}${state}; ${ids.length} of ${counts.cap} slots taken this New York day${ids.length ? ` (slots ${ids.join(' ')})` : ''}.`;
}

/** The hold lines for a run, by code with counts, never a name. Pure. */
export function coldHolds(held) {
  const by = new Map();
  for (const h of held) by.set(h, (by.get(h) ?? 0) + 1);
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([reason, n]) => ({ reason, detail: `${n} possible cold email${n === 1 ? '' : 's'} held: ${reason.replace(/^cold_/, '').replace(/_/g, ' ')}.` }));
}
