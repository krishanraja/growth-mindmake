import { createHash } from 'node:crypto';
import { clean } from '../guards.mjs';
import { lessons, refusedBy, channelOf, servesOf, seniorityOf, actionFor, rowProposal, fitTitleWithin, clause, wholeRole, titleCase, cleanName, cutClean, monthYear, firstName, hasFullName, leadSentences, gainLines, angleLines, sourceLinks, BECAUSE_MAX, BRIEF_LINE_MAX, TITLE_MAX, CARD_WHO_MAX, CARD_LINE_MAX } from './rows.mjs';

/**
 * Signals from his buyers (playbook 11, "Signals").
 *
 * Krish, 2026-10-26, shown a LinkedIn post, "AI's next job casualty could be
 * your boss": people who engage with posts like this "could be really
 * valuable to reach out to but only if they're the right types of ICP:
 * worried executives, as opposed to AI people". The voices he follows "are
 * talking to the people I want to talk to".
 * And: "The growth engine needs to think about those types of signals and
 * relevant signals from the ICPs I want, and bring them to me for action."
 *
 * So the engine decides where to look and who counts. Control Center only
 * collects (research kinds posts, post_engagers, person_route) and carries out
 * his press. The pipeline, a little each run and inside Control Center's caps:
 *   1. read this week's posts by the voices he follows and on a few topics;
 *   2. read who commented on the posts where most people argued;
 *   3. keep the commenters who are executives, worried, and not AI people;
 *   4. ask for a way to reach the ones he does not have;
 *   5. bring each as a REACH OUT row whose opener is what they said.
 */

/** Topics where worried executives argue in public. Two a week, in turn. */
export const TOPICS = [
  'AI replacing managers',
  'AI and the future of the CEO role',
  'board asking CEO about AI strategy',
  'leaders worried about AI and their jobs',
  'AI and middle management layoffs',
  'what AI means for my team',
];

// The same shapes Control Center refuses, so one bad request never fails the batch.
const PROFILE = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9%_-]{2,100}\/?$/;
const POST = /^https:\/\/(www\.)?linkedin\.com\/(posts\/[A-Za-z0-9%_.-]{3,300}|feed\/update\/urn:li:(activity|ugcPost|share):\d{6,25})\/?(\?[^\s@]*)?$/;
const HANDLE = /^[A-Za-z0-9%_-]{2,100}$/;

const h = s => createHash('sha256').update(s).digest('hex').slice(0, 24);
/** ISO week, so a voice or a topic is read once a week. */
export function isoWeek(at) {
  const d = new Date(at); const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4));
  return `${y}-W${String(1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}

// ── Who counts ──────────────────────────────────────────────────────────────

/** An AI person: builds, sells or teaches AI. Never his buyer, however senior. */
const AI_PERSON = /\b(ai|a\.i\.|genai|gen ai|llms?|machine learning|ml engineer|data scien\w*|prompt\w*|automation|agentic|ai agents?|chatgpt|copilot|no-?code|developer|software engineer\w*|engineering)\b/i;
/** Someone selling to the same buyer: a consultant, coach or trainer is a peer, not a lead. */
const SELLER = /\b(consultant|consulting|coach|coaching|trainer|keynote speaker|speaker|fractional|freelance|i help|helping (leaders|ceos|companies|teams|businesses))\b/i;
/** The words of someone who has the problem. */
const WORRY = /\b(worr\w*|concern\w*|anxi\w*|scar\w*|fear\w*|uncertain\w*|unsure|don'?t know|do not know|no idea|not sure|keeps? me up|struggl\w*|how do (we|i|you)|what does (this|it) mean|replac\w*|redundan\w*|los(e|ing)|threat\w*|pressure|my board|our board|my team|our team|my managers|middle managers?|our people|my job|jobs?)\b/gi;
/** The words of someone with an answer to sell. */
const EXPERT = /\b(we built|i built|we have built|our (agents?|platform|tool|product|solution)|dm me|link in|my course|book a call|check out|we help|sign up|webinar|my newsletter|subscribe)\b/i;
/** The Horizon's buyer: PE or VC backed media, adtech or data leaders (00_NORTH_STAR.md). */
const HORIZON = /\b(media|adtech|ad tech|advertising|publish\w*|broadcast\w*|data|marketing|private equity|pe-backed|vc-backed|portfolio company)\b/i;

/** Whether a commenter is his buyer, and how strongly. Null when they are not. */
export function icpOf(person, comment) {
  const headline = clean(person?.headline ?? '');
  const seniority = seniorityOf(headline);
  if (seniority === 'other') return null;
  if (AI_PERSON.test(headline) || SELLER.test(headline)) return null;
  const text = clean(comment ?? '');
  if (!text || EXPERT.test(text)) return null;
  const worries = new Set((text.match(WORRY) ?? []).map(w => w.toLowerCase())).size;
  if (!worries) return null;
  return {
    seniority,
    strength: (seniority === 'c_suite' ? 1.3 : 1) * (worries >= 2 ? 1.3 : 1) * (HORIZON.test(headline) ? 1.2 : 1),
    sector: (HORIZON.exec(headline)?.[1] ?? '').toLowerCase().replace(/[^a-z ]/g, '') || null,
  };
}

// ── What to ask Control Center to collect ───────────────────────────────────

const answered = r => r && (r.status === 'answered' || r.status === 'empty');

/**
 * The next requests, given every research row known so far (the context's
 * fourteen days plus anything answered this run). Stable ids, so nothing is
 * asked twice; at most `max`, the ones that finish a row first.
 */
export function signalRequests({ voices, research, at, max = 10 }) {
  const week = isoWeek(at), asked = new Set(research.map(r => r.request_id));
  const routes = [], engagers = [], posts = [];
  const engaged = research.filter(r => r.kind === 'post_engagers' && answered(r));
  for (const r of engaged) for (const e of r.evidence ?? []) {
    const p = e?.person;
    if (!p || p.contact_id || !HANDLE.test(p.handle ?? '') || !icpOf(p, e.snippet)) continue;
    const id = `route:${p.handle.toLowerCase()}`;
    if (asked.has(id) || routes.some(x => x.request_id === id)) continue;
    routes.push({ request_id: id, kind: 'person_route', subject_ref: null, query: `li:${p.handle.toLowerCase()}`, why: clean(`Commented as a worried executive on a post about AI; a way to reach them`).slice(0, 300) });
  }
  const seenPosts = research.filter(r => r.kind === 'posts' && answered(r) && Date.parse(at) - Date.parse(r.answered_at ?? r.requested_at) < 7 * 86400000)
    .flatMap(r => r.evidence ?? []).filter(e => POST.test(e?.url ?? '') && (e.engagement?.comments ?? 0) >= 20)
    .sort((a, b) => (b.engagement?.comments ?? 0) - (a.engagement?.comments ?? 0));
  for (const e of seenPosts) {
    const id = `engagers:${h(e.url)}`;
    if (asked.has(id) || engagers.some(x => x.request_id === id)) continue;
    engagers.push({ request_id: id, kind: 'post_engagers', subject_ref: null, query: e.url, why: clean(`${e.engagement.comments} people argued under this post about AI; who among them is a worried executive`).slice(0, 300) });
  }
  for (const v of Array.isArray(voices) ? voices : []) {
    if (!PROFILE.test(v?.linkedin_url ?? '') || typeof v.slug !== 'string') continue;
    const id = `posts:voice:${v.slug.replace(/[^A-Za-z0-9_-]/g, '')}:${week}`;
    if (!asked.has(id)) posts.push({ request_id: id, kind: 'posts', subject_ref: null, query: v.linkedin_url.replace(/\/$/, ''), why: clean(`${v.name} talks to the leaders Krish wants to reach; who argued under this week's posts`).slice(0, 300) });
  }
  const n = Number(week.slice(-2));
  for (const i of [n % TOPICS.length, (n + 1) % TOPICS.length]) {
    const id = `posts:topic:${i}:${week}`;
    if (!asked.has(id)) posts.push({ request_id: id, kind: 'posts', subject_ref: null, query: TOPICS[i], why: 'Where worried executives argue about AI this week' });
  }
  return [...routes.slice(0, 4), ...engagers.slice(0, 2), ...posts.slice(0, 4)].slice(0, max);
}

// ── Rows ────────────────────────────────────────────────────────────────────

const first = firstName;
const quoteOf = text => { const t = clean(text).replace(/"/g, "'"); if (t.length <= 160) return t; const c = t.slice(0, 157); return `${c.slice(0, Math.max(60, c.lastIndexOf(' ')))}...`; };
const lower1 = s => s.charAt(0).toLowerCase() + s.slice(1);

/** The words to someone who said it in public: their own comment first, then
 *  what we do in the canon's words, then the canon's main ask with its one link
 *  (playbook 03, cold first contact; krish-voice, cold mode). */
export const SIGNAL_WORDS = [
  (s, canon) => ({ subject: s.author ? `Your comment on ${s.author}'s post` : 'Your comment on AI and your team', lines: [
    `Saw your comment under ${s.author ? `${s.author}'s post` : 'a post on LinkedIn'}: "${s.quote}"`,
    `That question is the work we do at Mindmake. The short version: ${lower1(canon.brain)}`,
    `If it's live for you, start here: ${canon.ask.description}. ${canon.ask.url}`,
  ] }),
  (s, canon) => ({ subject: 'Your comment about AI', lines: [
    `Saw your comment: "${s.quote}"`,
    `If working out what AI should do for you is live, start here: ${canon.ask.description}. ${canon.ask.url}`,
  ] }),
];

/**
 * REACH OUT rows from commenters who are his buyer and whom Control Center can
 * name: someone he already has (contact_id on the comment), or someone a
 * person_route filed. Ranked by how clearly they are his buyer.
 */
/** What he reads before he decides on a signal (protocol 1.7.0): who they are, what they said in public and why that makes them his buyer. */
export function signalCase({ name, headline, author, quote, published, serves, known = false, url = null, canon = null }) {
  // Where they said it is in the brief; the card line has room for who and what.
  const where = 'Worried in public about AI and their job.';
  const who = headline ? wholeRole(titleCase(headline), '', BECAUSE_MAX - where.length - 1) : '';
  const seen = monthYear(published);
  // 1.8.0: the full card. Who they are is their own headline, whole; a signal with none is too thin to show.
  const said = `They wrote${author ? ` on ${author}'s post` : ''}${seen ? ` in ${seen}` : ''}: "${quote}"`;
  const whoCard = headline ? leadSentences(titleCase(headline), CARD_WHO_MAX, 2) || wholeRole(titleCase(headline), '', CARD_WHO_MAX) : '';
  const card = canon && whoCard ? {
    who: whoCard,
    known: known ? 'Already in your contacts. Control Center found them again through their public comment.' : 'You do not know them yet. Control Center found them through their public comment.',
    why: [said.length <= CARD_LINE_MAX ? said : `They wrote${author ? ` on ${author}'s post` : ''}${seen ? ` in ${seen}` : ''} about AI and their job.`, 'An executive with the problem, not an AI person or someone selling an answer.'],
    gain: gainLines({ ask: 'signal', kind: null, name, reach: null, fit: null, serves }),
    angles: angleLines({ ask: 'signal', kind: null, name, c: {}, company: '', canon }),
    sources: sourceLinks({ extra: url ? [{ label: `Their comment${author ? ` on ${author}'s post` : ''}`, url }] : [] }),
  } : null;
  return {
    card,
    because: who ? `${who} ${where}` : where,
    brief: [
      clause(`${name}${headline ? `, ${headline}` : ''}`, BRIEF_LINE_MAX),
      cutClean(`They wrote${author ? ` on ${author}'s post` : ''}${seen ? ` in ${seen}` : ''}: "${quote}"`, BRIEF_LINE_MAX),
      'An executive with the problem, not an AI person or someone selling an answer.',
      `The ask: a reply to their comment, with the one Mindmake link.${serves ? ` It serves this week's goal: ${serves.replace(/[.!?]+$/, '')}.` : ''}`,
    ],
  };
}

export function signalRows({ context, research, weekGoals, canon, files, at, titleMax = TITLE_MAX }) {
  const L = lessons(context.feedback, at);
  const routes = context.routes ?? {};
  const authorOf = new Map(research.filter(r => r.kind === 'posts').flatMap(r => r.evidence ?? []).map(e => [e.url, clean(String(e.title ?? '').split(':')[0])]));
  const routed = new Map(research.filter(r => r.kind === 'person_route' && r.status === 'answered' && typeof r.subject_ref === 'string').map(r => [String(r.query).slice(3).toLowerCase(), r.subject_ref.slice(8)]));
  const out = [], held = [], seen = new Set();
  for (const r of research.filter(x => x.kind === 'post_engagers' && answered(x))) {
    for (const e of r.evidence ?? []) {
      const p = e?.person;
      const icp = p ? icpOf(p, e.snippet) : null;
      if (!icp) continue;
      const id = p.contact_id ?? routed.get(String(p.handle).toLowerCase()) ?? null;
      if (!id) { held.push('signal_awaiting_route'); continue; }
      if (seen.has(id)) continue;
      seen.add(id);
      const subject = `contact:${id}`;
      const features = { sector: icp.sector, topic: 'ai_and_their_job', seniority: icp.seniority };
      const refused = refusedBy(L, { subject, row: 'reach_out', kind: null, sector: icp.sector, topic: features.topic, band: 'unknown' }, at);
      const ch = channelOf(routes[id], 'reach_out');
      if (refused || !ch) { held.push(refused ?? 'signal_no_route'); continue; }
      const name = cleanName(p.name);
      if (!hasFullName(name)) { held.push('no_full_name'); continue; }
      const author = authorOf.get(e.url) || null;
      const quote = quoteOf(e.snippet);
      const variant = (L.pitchOff.get('reach_out') ?? 0) % SIGNAL_WORDS.length;
      const serves = servesOf('reach_out', weekGoals);
      const told = signalCase({ name, headline: cleanName(p.headline), author, quote, published: e.published, serves, known: !!p.contact_id, url: e.url, canon });
      // A card that cannot say who they are is held, not shown (protocol 1.8.0).
      if (!told.card) { held.push('thin_card'); continue; }
      out.push({ score: 4 * icp.strength * ch.weight * (serves ? 1.25 : 1), proposal: rowProposal({
        row: 'reach_out', ask: 'signal', contactId: id, name, at, files,
        title: fitTitleWithin(titleMax, ...(author ? [`${name} worried about AI on ${author}'s post`, `${first(name)} worried about AI on ${author}'s post`] : []), `${name} worried about AI in public`, `${first(name)} worried about AI in public`),
        why: `${name}, ${clean(p.headline)}, commented${author ? ` on ${author}'s post` : ''}: "${quote}" An executive with the problem, not an AI person.`,
        ...told,
        action: actionFor(ch.channel, id, name, SIGNAL_WORDS[variant]({ author, quote }, canon)),
        reach: { value: null, band: 'unknown', basis: 'a buyer showing a signal, not an amplifier', source_url: null, as_of: null },
        kind: null, features, serves,
        evidence: [{ label: clean(`Their comment${author ? ` on ${author}'s post` : ''}${e.published ? `, ${e.published.slice(0, 10)}` : ''}`).slice(0, 500), url: e.url }],
      }) });
    }
  }
  return { rows: out, held };
}
