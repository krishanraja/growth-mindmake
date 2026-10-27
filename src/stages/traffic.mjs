/**
 * Traffic to mindmake.co, read by the Measurement Specialist (Rulings, Krish,
 * 2026-10-27). Pure: it reads the directive's `web_analytics` block, which
 * Control Center serves from the Google Analytics store it already keeps
 * (protocol 1.10.0), and writes activity lines. It stores nothing.
 *
 * Traffic is a supporting reading: never a meeting, never part of the number,
 * never an objective (Control Center picks the next action by an objective's
 * gap, and visits must not steer the work). Its counts reach only Control
 * Center, in the report's activity lines: never git, NOW.md, an Actions log
 * or the printed run result.
 */

/** Said on every traffic line: Google sees only visitors who answer the banner with Allow. */
export const CONSENT = 'Counts only visitors who press Allow, so it is a floor and a trend, not a total.';
/** The one site the engine sends people to (Krish, 2026-10-27: "mindmake.co for all mindmake venture things"). */
export const SITE = 'mindmake.co';
/** The fixed list of public placements a link may be tagged for. Never a person, a show or a proposal. */
export const TAG_PATHS = ['podcast', 'guest-seat', 'one-sheet'];
const TAG_KEYS = ['utm_source', 'utm_medium'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A mindmake.co link tagged for one public placement: the canon's URL byte
 * for byte, then exactly `utm_source=growth-<path>&utm_medium=referral`.
 * Null for any other site, any path off the list, or a link already tagged.
 * His one-to-one notes and source citations are never passed here. Pure.
 */
export function tagged(url, path) {
  if (typeof url !== 'string' || !TAG_PATHS.includes(path)) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== SITE || u.hash) return null;
  if (TAG_KEYS.some(k => u.searchParams.has(k))) return null;
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=growth-${path}&utm_medium=referral`;
}

/** The canon URL a tagged link came from: the two keys removed and nothing else. Pure. */
export function untagged(url) {
  const m = /^(.*?)[?&]utm_source=growth-[a-z-]+&utm_medium=referral$/.exec(String(url ?? ''));
  return m ? m[1] : String(url ?? '');
}

/**
 * The directive's web_analytics block for mindmake.co, or null when it is not
 * there. Only the source and landing rows are read; the measurement id is
 * never kept, so it can never be printed. Pure.
 */
export function readWeb(block) {
  if (!block || typeof block !== 'object' || !Array.isArray(block.rows ?? []) || !block.coverage || typeof block.coverage !== 'object') return null;
  const through = typeof block.through === 'string' && DAY.test(block.through) ? block.through : null;
  const rows = (Array.isArray(block.rows) ? block.rows : [])
    .filter(r => r && DAY.test(r.date) && ['source_medium', 'landing_page'].includes(r.dim_type) && typeof r.value === 'string' && Number.isFinite(r.sessions))
    .map(r => ({ date: r.date, dim_type: r.dim_type, value: r.value, sessions: r.sessions, key_events: Number.isFinite(r.key_events) ? r.key_events : 0 }));
  return { through, rows, complete: block.coverage.complete === true, reason: typeof block.coverage.reason === 'string' ? block.coverage.reason.slice(0, 300) : null, consent_gated: block.consent_gated === true };
}

const shift = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const change = (now, before) => (now === before ? 'no change' : before === 0 ? 'up from none' : `${now >= before ? 'up' : 'down'} ${Math.round(Math.abs(now - before) / before * 100)}%`);
/** "google / organic" as GA writes sessionSourceMedium: the source and the medium. */
const split = v => { const i = v.lastIndexOf(' / '); return i < 0 ? { source: v.trim(), medium: '' } : { source: v.slice(0, i).trim().toLowerCase(), medium: v.slice(i + 3).trim().toLowerCase() }; };
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

/** The hosts of the shows and stages he was booked on, from 1.9.0 pitch outcomes: where a referral visit is matched. Pure. */
export function bookedHosts(context) {
  const targets = new Map((Array.isArray(context?.records?.visibility) ? context.records.visibility : []).filter(t => typeof t?.id === 'string').map(t => [t.id.toLowerCase(), t]));
  const hosts = new Set();
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) {
    if (typeof d?.booked_at !== 'string' || typeof d?.visibility_target_id !== 'string') continue;
    const t = targets.get(d.visibility_target_id.toLowerCase());
    for (const u of [t?.event_url, t?.feed_url]) { const h = hostOf(u); if (h && h !== SITE) hosts.add(h); }
  }
  return hosts;
}

/**
 * The two traffic lines a run: the whole site, 7 days against the 7 before,
 * then what the engine's own placements sent (visits tagged growth-<path>,
 * summed by path, and referral visits from the shows and stages he was
 * booked on). Each carries the consent sentence. Unserved is one line that
 * says so, never a zero. Pure.
 */
export function trafficLines({ web, hosts = new Set() }) {
  if (!web) return [`mindmake.co traffic: not served yet. Control Center does not yet put mindmake.co in this engine's directive (web_analytics, protocol 1.10.0), so nothing is claimed. ${CONSENT}`];
  if (!web.through) return [`mindmake.co traffic: unknown. ${web.reason ?? 'Nothing has been captured for the site yet.'} ${CONSENT}`];
  const from = shift(web.through, -6), prevFrom = shift(web.through, -13), prevTo = shift(web.through, -7);
  const src = web.rows.filter(r => r.dim_type === 'source_medium');
  const inRange = (r, a, b) => r.date >= a && r.date <= b;
  const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
  const now = src.filter(r => inRange(r, from, web.through)), before = src.filter(r => inRange(r, prevFrom, prevTo));
  const days = rows => new Set(rows.map(r => r.date)).size;
  const gap = web.complete ? '' : ' Not every day was read, so a day with no rows is unknown.';
  const site = `mindmake.co, the 7 days to ${web.through} against the 7 before: ${sum(now, 'sessions')} sessions (${change(sum(now, 'sessions'), sum(before, 'sessions'))}), ${sum(now, 'key_events')} key events (${change(sum(now, 'key_events'), sum(before, 'key_events'))}), with rows on ${days(now)} and ${days(before)} of 7 days.${gap} ${CONSENT}`;
  const byPath = {};
  let referral = 0;
  for (const r of now) {
    const { source, medium } = split(r.value);
    const tag = /^growth-([a-z-]+)$/.exec(source);
    if (tag && TAG_PATHS.includes(tag[1])) byPath[tag[1]] = (byPath[tag[1]] ?? 0) + r.sessions;
    else if (medium === 'referral' && [...hosts].some(h => source === h || source.endsWith(`.${h}`))) referral += r.sessions;
  }
  const engine = Object.values(byPath).reduce((a, b) => a + b, 0) + referral;
  const total = sum(now, 'sessions');
  const paths = Object.entries(byPath).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p, v]) => `${v} growth-${p}`).join(', ');
  const share = total ? `, ${Math.round(engine / total * 100)}% of the site's` : '';
  const sent = `What the engine's placements sent mindmake.co in those 7 days: ${engine} sessions${share}${paths ? ` (${paths}${referral ? `, ${referral} from shows and stages he was booked on` : ''})` : referral ? ` (${referral} from shows and stages he was booked on)` : ''}. A supporting reading only: it ranks levers, never counts as a meeting. ${CONSENT}`;
  return [site, sent];
}
