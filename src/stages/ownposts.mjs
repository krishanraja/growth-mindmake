import { createHash } from 'node:crypto';
import { clean } from '../guards.mjs';

/**
 * Who answered his own posts (docs/GET-GOING.md 1.4, `own-post-engagers`).
 *
 * His 13 November ruling: reply to every substantive commenter, and message
 * anyone relevant who engages. A post is how a stranger meets his judgement;
 * the reply is where a post becomes a meeting (path `post-engager`).
 *
 * The engine decides what to read; Control Center only collects, through the
 * research desk kinds the signals stage already uses (ENGINE-PROTOCOL.md, "The
 * research desk"): `posts` on his own profile once a London day, then
 * `post_engagers` on each of his posts from the last seven days, once a day
 * each, so a comment left on day three is still read. Both count against
 * Mindmake's daily caps (6 posts, 3 post_engagers); his own posts take at most
 * two of the three engager reads, leaving one for the signals stage.
 *
 * A commenter his own words show to be his buyer also reaches the REACH OUT row
 * through src/stages/signals.mjs, which reads every answered post_engagers row.
 * The full list of who to reply to has no Control Center field yet: until one is
 * served it stays in memory, and the report carries counts only (never a name,
 * a handle, a comment or a post link). Consumer-pending.
 */

/** How long a post keeps being read for new comments. */
export const OWN_POST_DAYS = 7;
/** His own posts' share of the desk's three post_engagers reads a day. */
export const OWN_ENGAGER_READS = 2;

/** His own profile comes from config/policy.json (`linkedin.own_profile`), never from a string here. */
const PROFILE = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9%_-]{2,100}\/?$/;
const POST = /^https:\/\/(www\.)?linkedin\.com\/(posts\/[A-Za-z0-9%_.-]{3,300}|feed\/update\/urn:li:(activity|ugcPost|share):\d{6,25})\/?(\?[^\s@]*)?$/;
const h = s => createHash('sha256').update(s).digest('hex').slice(0, 24);
const londonDay = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const answered = r => r && (r.status === 'answered' || r.status === 'empty');
const list = x => (Array.isArray(x) ? x : []);
const DAY = 86400000;

/**
 * The profile to read, or null: only on a live run where the research desk is
 * served and advertises both kinds this needs (`posts`, `post_engagers`), and
 * only a profile link of the right shape. Consumer-pending otherwise. Pure.
 */
export function ownPostsProfile({ mode, capabilities, profile }) {
  const kinds = Array.isArray(capabilities?.research?.kinds) ? capabilities.research.kinds : [];
  const on = mode === 'live' && capabilities?.features?.research === true && kinds.includes('posts') && kinds.includes('post_engagers');
  return on && PROFILE.test(profile ?? '') ? profile : null;
}

/** Whether a research row is the read of his own profile's posts. Pure. */
export const isOwnPostsRead = r => r?.kind === 'posts' && String(r.request_id ?? '').startsWith('posts:own:');
/** Whether a research row is a read of who commented on one of his own posts. Pure. */
export const isOwnEngagersRead = r => r?.kind === 'post_engagers' && String(r.request_id ?? '').startsWith('engagers:own:');

/**
 * His own posts from the last OWN_POST_DAYS days, newest first, from every
 * answered read of his profile. A post with no readable date is kept only while
 * the read that found it is that young. Pure.
 */
export function ownPosts({ research, at }) {
  const now = Date.parse(at), seen = new Map();
  for (const r of list(research).filter(x => isOwnPostsRead(x) && answered(x))) {
    const readAt = Date.parse(r.answered_at ?? r.requested_at ?? '');
    for (const e of list(r.evidence)) {
      const url = String(e?.url ?? '');
      if (!POST.test(url)) continue;
      const published = Date.parse(e.published ?? '');
      const when = Number.isFinite(published) ? published : readAt;
      if (!Number.isFinite(when) || now - when > OWN_POST_DAYS * DAY || when - now > DAY) continue;
      const prev = seen.get(url);
      if (!prev || when > prev.when) seen.set(url, { url, when, comments: e.engagement?.comments ?? null });
    }
  }
  return [...seen.values()].sort((a, b) => b.when - a.when);
}

/**
 * The next requests: his profile's posts once a London day, then who commented
 * on each recent post that has comments, once a day each, newest first, at most
 * OWN_ENGAGER_READS. Stable ids, so nothing is asked twice in a day. Pure.
 */
export function ownPostRequests({ research, at, profile = null }) {
  const day = londonDay(at), asked = new Set(list(research).map(r => r.request_id));
  const out = [];
  const postsId = `posts:own:${day}`;
  if (PROFILE.test(profile ?? '') && !asked.has(postsId)) out.push({ request_id: postsId, kind: 'posts', subject_ref: null, query: profile, why: 'His own posts this week, so every substantive commenter gets his reply' });
  for (const p of ownPosts({ research, at })) {
    if (out.filter(r => r.kind === 'post_engagers').length >= OWN_ENGAGER_READS) break;
    if (p.comments === 0) continue;
    const id = `engagers:own:${h(p.url)}:${day}`;
    if (asked.has(id)) continue;
    out.push({ request_id: id, kind: 'post_engagers', subject_ref: null, query: p.url, why: 'Who commented on his own post; he replies to every substantive comment' });
  }
  return out;
}

/** Reactions with no content of their own: praise, thanks, an emoji, a tag. */
const PLEASANTRY = /^(great|good|nice|love|loved|brilliant|fantastic|excellent|amazing|awesome|spot on|so true|well said|congrat\w*|thanks?|thank you|cheers|agreed?|100%?|this|yes|wow|insightful|interesting|bravo|well done|keep it up)\b/i;

/**
 * Whether a comment says something he can answer: eight words or more, or a
 * question, and more than a pleasantry. A comment that is only a tag of other
 * people is not. Pure.
 */
export function substantive(comment) {
  const t = clean(comment ?? '').replace(/@\S+/g, '').trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
  if (words.length < 3) return false;
  if (PLEASANTRY.test(t) && words.length < 12 && !t.includes('?')) return false;
  return words.length >= 8 || t.includes('?');
}

/**
 * Who to reply to: every commenter on his recent posts, once each per post, the
 * newest read winning, marked substantive or not and known (he already holds
 * them) or not. In memory only. Pure.
 */
export function replyList({ research, at }) {
  const posts = new Set(ownPosts({ research, at }).map(p => p.url));
  const byKey = new Map();
  const reads = list(research).filter(r => isOwnEngagersRead(r) && answered(r) && posts.has(r.query))
    .sort((a, b) => Date.parse(a.answered_at ?? 0) - Date.parse(b.answered_at ?? 0));
  for (const r of reads) for (const e of list(r.evidence)) {
    const handle = String(e?.person?.handle ?? '').toLowerCase();
    if (!handle) continue;
    byKey.set(`${r.query}|${handle}`, { post: r.query, handle, contact_id: e.person.contact_id ?? null, comment: clean(e.snippet ?? ''), substantive: substantive(e.snippet) });
  }
  return [...byKey.values()];
}

/**
 * The report's one line: counts only, never a name, a handle, a comment or a
 * link (the repository and its logs are public). Null when nothing was read. Pure.
 */
export function ownPostLine({ research, at, served = false }) {
  const posts = ownPosts({ research, at });
  const readToday = list(research).some(r => isOwnPostsRead(r) && String(r.request_id).endsWith(londonDay(at)));
  if (!posts.length && !readToday) return null;
  const replies = replyList({ research, at });
  const sub = replies.filter(r => r.substantive);
  const tail = served ? '' : ' The list itself waits on a Control Center field to show it on his list; until then he replies from the post.';
  return `Own posts: ${posts.length} from the last ${OWN_POST_DAYS} days read, ${replies.length} commenter${replies.length === 1 ? '' : 's'}, ${sub.length} substantive to reply to (${sub.filter(r => r.contact_id).length} he already knows).${tail}`;
}
