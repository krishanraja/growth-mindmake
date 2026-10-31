/**
 * Podcasts on Podchaser's prepaid points (Krish, 2026-10-31: "yes on the
 * podcast lookup"). Control Center's research desk answers a `podcasts`
 * request with up to ten shows from one Podchaser search: each show's own
 * page, host, episode count, latest episode and last three episode titles.
 * It spends the API points Mindmake holds the main share of (protocol
 * 1.16.0), never dollars, so each run asks for what is left of the desk's
 * daily cap, on topics his buyer listens to, rotated so every topic comes
 * round and none is asked again inside THIRTY days.
 *
 * What comes back are shows, not people: a show is a candidate for the
 * visibility row, deduplicated against the stages Control Center already
 * holds, and never given a contact. Control Center has no intake for a new
 * show from this engine yet, so the finds stay in its research store and the
 * report counts them; a show on the visibility list gets its pitch through
 * the existing path (src/stages/pitches.mjs). All functions here are pure.
 */
import { seal } from '../guards.mjs';

/** The rooms his buyer sits in, the same ones Nova's weekly Podchaser search rotates through. */
export const ROOMS = ['AI strategy for CEOs', 'private equity operators', 'media business leaders', 'advertising technology executives', 'data business founders', 'future of media', 'executive decision making', 'venture capital portfolio leadership', 'founder led business growth'];
/** How each room is asked, so one room gives several searches before it comes round again. */
export const ANGLES = ['podcast', 'interviews', 'AI', 'leadership', 'strategy', 'growth'];
/** A topic asked in the last this-many days is not asked again. */
export const REPEAT_DAYS = 30;
/** The desk's daily cap when its capabilities do not say. */
export const PODCASTS_PER_DAY = 20;

const londonDay = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = s => String(s ?? '').toLowerCase().split(/,\s*hosted by /)[0].split(':')[0].replace(/\b(the|podcast|show)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const pageKey = u => { try { const x = new URL(u); return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '')}`.toLowerCase(); } catch { return null; } };

/** Every topic, in the order a day starts from: room by room, each angle in turn. */
export function topics() {
  return ANGLES.flatMap(a => ROOMS.map(r => ({ base: `podcasts:${slug(`${r} ${a}`)}`, query: `${r} ${a}` })));
}

/**
 * The `podcasts` requests for this run: none unless the desk serves the kind
 * and the visibility lane is on; at most what is left of today's cap (a
 * request the desk refused over its cap ran nothing and is not counted);
 * topics asked in the last REPEAT_DAYS skipped; the day's starting topic
 * moves on one a day so every topic comes round. Pure.
 */
export function podcastRequests({ capabilities, research = [], at, visibilityOn = true }) {
  const desk = capabilities?.research;
  if (!visibilityOn || !Array.isArray(desk?.kinds) || !desk.kinds.includes('podcasts')) return [];
  const cap = desk?.per_day?.podcasts;
  const perDay = Number.isInteger(cap) && cap >= 0 ? cap : PODCASTS_PER_DAY;
  const day = londonDay(at);
  const mine = (Array.isArray(research) ? research : []).filter(r => r?.kind === 'podcasts' && r?.status !== 'over_cap' && typeof r?.request_id === 'string');
  const usedToday = mine.filter(r => r.request_id.includes(`:${day}:`)).length;
  let left = Math.max(0, perDay - usedToday);
  if (!left) return [];
  const since = new Date(new Date(at).getTime() - REPEAT_DAYS * 86_400_000).toISOString();
  const recent = new Set(mine.filter(r => String(r.requested_at ?? r.answered_at ?? '') >= since || r.request_id.includes(`:${day}:`)).map(r => r.request_id.split(':').slice(0, 2).join(':')));
  const all = topics();
  const start = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000) % all.length;
  const out = [];
  for (let i = 0; i < all.length && left > 0; i++) {
    const t = all[(start + i) % all.length];
    if (recent.has(t.base)) continue;
    out.push({ request_id: `${t.base}:${day}:${seal({ query: t.query }).slice(0, 8)}`, kind: 'podcasts', subject_ref: null, query: t.query, why: 'Shows whose listeners are his buyer, for the visibility row (two podcasts a week).' });
    left--;
  }
  return out;
}

/**
 * The shows answered `podcasts` lookups found that Control Center does not
 * already hold on the visibility list (by the show's own page or its name),
 * each once, newest answer first: title, page and what the search said. No
 * contact, no address. Pure.
 */
export function podcastFinds({ research = [], context = null }) {
  const held = Array.isArray(context?.records?.visibility) ? context.records.visibility : [];
  const names = new Set(held.map(t => norm(t?.title)).filter(Boolean));
  const pages = new Set(held.flatMap(t => [t?.event_url, t?.source_url]).map(pageKey).filter(Boolean));
  const out = [];
  const answered = (Array.isArray(research) ? research : []).filter(r => r?.kind === 'podcasts' && r?.status === 'answered')
    .sort((a, b) => String(b.answered_at ?? '').localeCompare(String(a.answered_at ?? '')));
  for (const r of answered) {
    for (const e of Array.isArray(r.evidence) ? r.evidence : []) {
      const page = pageKey(e?.url), name = norm(e?.title);
      if (!page || !name || !/^https:\/\//.test(e.url) || pages.has(page) || names.has(name)) continue;
      pages.add(page); names.add(name);
      out.push({ title: String(e.title).slice(0, 200), url: e.url, snippet: String(e.snippet ?? '').slice(0, 600), latest: e.published ?? null, request_id: r.request_id });
    }
  }
  return out;
}
