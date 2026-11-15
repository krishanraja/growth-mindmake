/**
 * The tracking check on mindmake.co, read by the Measurement Specialist
 * (Rulings, Krish, 2026-10-27: traffic is read only through Control Center).
 * Pure: it reads the directive's `web_analytics` block whole (protocol 1.10.0,
 * with `daily` and `health` from 1.13.0), which the traffic lines read only in
 * part, and says where the site's measurement has a gap that hides where a
 * visit came from.
 *
 * Each check ends in one of four states: `fail` (the evidence shows tracking
 * is broken), `watch` (the evidence shows a gap worth fixing), `pass`, or
 * `unknown` (the data to judge it was not served; never read as a pass or a
 * zero). Each carries its evidence as counts and the fix, with who makes it.
 *
 * It never steers the work and never counts as a meeting: the number's path
 * comes from Krish's tap after each meeting (src/stages/meetings.mjs). Its
 * one line reaches only Control Center, in the report's activity: never git,
 * NOW.md, an Actions log or the printed run result. It never keeps the
 * measurement id.
 */
import { SITE, TAG_PATHS } from './traffic.mjs';

export const STATES = ['fail', 'watch', 'unknown', 'pass'];
/**
 * How the one line starts, so the golden reports can leave it out (tests/support/golden.mjs): it holds nothing and is tested in its own file.
 * It never starts with the site's name: it carries no visit figure, so it is not a traffic line (measurement.traffic_consent).
 */
export const TRACKING_LINE = /^Tracking check on mindmake\.co: /;
export const CHECKS = ['tracking.served', 'tracking.health', 'tracking.flags', 'tracking.fresh', 'tracking.days_read', 'tracking.key_event', 'tracking.untraced', 'tracking.placements'];
/** A newest day more than this many days before the run is stale: Control Center's own rule for the block's coverage. */
export const STALE_AFTER_DAYS = 2;
/** The engine's own line for "most visits cannot be traced": a policy choice, not a benchmark. */
export const UNTRACED_LINE = 0.5;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERDICTS = ['no_access', 'api_disabled', 'wrong_stream', 'tag_missing', 'never_received', 'provisional', 'quiet', 'ok'];
const FLAGS = ['consent_gated', 'thresholded', 'admin_unverified', 'undercounting', 'host_filter_off', 'read_failed'];

/** What each health verdict means for tracing, and who fixes it. Broken verdicts fail; thin ones are watched. */
const VERDICT = {
  no_access: { state: 'fail', says: "Control Center's reader has no access to the site's Analytics property", fix: "grant Control Center's reader access to the property in Google Analytics (a permission change: Krish's yes)" },
  api_disabled: { state: 'fail', says: "the Analytics Data API is off for Control Center's reader", fix: "turn the API on for Control Center's reader (a configuration change: Krish's yes)" },
  wrong_stream: { state: 'fail', says: 'the site sends to a different data stream than the one read', fix: 'point the tag on mindmake.co at the stream Control Center reads (the mindmake repository owns the site)' },
  tag_missing: { state: 'fail', says: 'no Analytics tag was found on mindmake.co', fix: 'restore the tag on mindmake.co (the mindmake repository owns the site)' },
  never_received: { state: 'fail', says: 'the property has never received data', fix: 'check the tag fires on mindmake.co after the banner is answered with Allow (the mindmake repository owns the site)' },
  provisional: { state: 'watch', says: "the newest days are still provisional in Google's own processing", fix: 'none: read them again tomorrow' },
  quiet: { state: 'watch', says: 'the site received very few visits', fix: 'none in tracking: too few visits to judge a path' },
  ok: { state: 'pass', says: 'the site is tagged and read', fix: null }
};
const FLAG = {
  consent_gated: null,
  thresholded: { says: 'Google withholds small rows, so a path with few visits can read as none', fix: 'none: read small counts as floors' },
  admin_unverified: { says: "nobody has confirmed admin access to the property", fix: 'confirm an admin on the property in Google Analytics (Krish)' },
  undercounting: { says: 'the property counts fewer visits than the site serves', fix: 'check the tag and the banner on mindmake.co (the mindmake repository owns the site)' },
  host_filter_off: { says: 'visits to other hosts may be counted as mindmake.co', fix: "filter the read to mindmake.co in Control Center's reader" },
  read_failed: { says: "Control Center's newest read of the property failed", fix: "none here: Control Center reads again on its next run" }
};

const finite = v => Number.isFinite(v) && v >= 0;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
/** Control Center's plain line, with any measurement id taken out so it can never be repeated. */
const clean = s => String(s ?? '').replace(/\bG-[A-Z0-9]+\b/g, '[id]').replace(/\s+/g, ' ').trim().slice(0, 200);
/** "google / organic" as Analytics writes it: the source and the medium, lower case. */
const split = v => { const i = v.lastIndexOf(' / '); return i < 0 ? { source: v.trim().toLowerCase(), medium: '' } : { source: v.slice(0, i).trim().toLowerCase(), medium: v.slice(i + 3).trim().toLowerCase() }; };

/**
 * The block as this check reads it, or null when it is not served. Keeps the
 * source rows, the daily totals, the health check and the coverage; never the
 * measurement id. A part that is missing or misshapen is null, never empty. Pure.
 */
export function readTracking(block) {
  if (!block || typeof block !== 'object' || !block.coverage || typeof block.coverage !== 'object') return null;
  const rows = Array.isArray(block.rows)
    ? block.rows.filter(r => r && DAY.test(r.date) && r.dim_type === 'source_medium' && typeof r.value === 'string' && finite(r.sessions))
      .map(r => ({ date: r.date, value: r.value, sessions: r.sessions, key_events: finite(r.key_events) ? r.key_events : null }))
    : null;
  const daily = Array.isArray(block.daily)
    ? block.daily.filter(d => d && DAY.test(d.date)).map(d => ({ date: d.date, sessions: finite(d.sessions) ? d.sessions : null, key_events: finite(d.key_events) ? d.key_events : null }))
    : null;
  const h = block.health;
  const health = h && typeof h === 'object' && VERDICTS.includes(h.verdict)
    ? { as_of: DAY.test(h.as_of) ? h.as_of : null, verdict: h.verdict, flags: Array.isArray(h.flags) ? [...new Set(h.flags.filter(f => FLAGS.includes(f)))] : [], line: clean(h.line) }
    : null;
  const dates = block.coverage.dates && typeof block.coverage.dates === 'object' && Array.isArray(block.coverage.dates.source_medium)
    ? block.coverage.dates.source_medium.filter(d => DAY.test(d)) : null;
  return {
    through: typeof block.through === 'string' && DAY.test(block.through) ? block.through : null,
    days: Number.isInteger(block.days) && block.days > 0 ? block.days : 28,
    complete: block.coverage.complete === true,
    reason: typeof block.coverage.reason === 'string' ? clean(block.coverage.reason) : null,
    source_dates: dates,
    rows, daily, health,
    consent_gated: block.consent_gated === true
  };
}

const finding = (id, state, evidence, fix = null) => ({ id, state, evidence, fix });

/**
 * Every check on one read of the block. `today` is the run's date; `hosts` the
 * sites of the shows and stages he was booked on (src/stages/traffic.mjs
 * bookedHosts), or null when the context was not read. Pure and deterministic:
 * the same inputs give the same findings in the same order.
 */
export function trackingAudit({ tracking, today, hosts = null }) {
  if (!tracking) return [finding('tracking.served', 'unknown', `Control Center does not put ${SITE} in this engine's directive yet (web_analytics), so no tracking check can run.`, "Control Center serves the block (protocol 1.10.0)")];
  const out = [finding('tracking.served', 'pass', `${SITE}'s Analytics block is served.`)];

  // The site's own daily check (1.13.0).
  const h = tracking.health;
  if (!h) out.push(finding('tracking.health', 'unknown', "Control Center's daily check of the site was not served or has not run.", 'Control Center serves health (protocol 1.13.0)'));
  else {
    const v = VERDICT[h.verdict];
    const age = h.as_of && DAY.test(today) ? daysBetween(h.as_of, today) : null;
    const old = age !== null && age > STALE_AFTER_DAYS ? ` The check is ${age} days old.` : '';
    out.push(finding('tracking.health', v.state, `Verdict ${h.verdict}: ${v.says}.${old}`, v.fix));
    const flagged = h.flags.filter(f => FLAG[f]);
    if (flagged.length) out.push(finding('tracking.flags', 'watch', flagged.map(f => `${f}: ${FLAG[f].says}`).join('; ') + '.', flagged.map(f => FLAG[f].fix).join('; ')));
    else out.push(finding('tracking.flags', 'pass', h.flags.includes('consent_gated') ? 'Only consent_gated: counts are floors, as every traffic line says.' : 'No flag raised.'));
  }

  // How current the read is.
  if (!tracking.through) out.push(finding('tracking.fresh', 'unknown', `Nothing has been captured for the site yet${tracking.reason ? `: ${tracking.reason}` : ''}.`, "Control Center's daily capture"));
  else {
    const lag = DAY.test(today) ? daysBetween(tracking.through, today) : null;
    if (lag === null) out.push(finding('tracking.fresh', 'unknown', 'The run has no date to compare the newest day with.'));
    else if (lag > STALE_AFTER_DAYS) out.push(finding('tracking.fresh', 'watch', `The newest day read is ${tracking.through}, ${lag} days before ${today}.`, "Control Center's daily capture"));
    else out.push(finding('tracking.fresh', 'pass', `The newest day read is ${tracking.through}.`));
  }

  // Days read in the window: a day without rows is unknown, never zero.
  if (!tracking.source_dates) out.push(finding('tracking.days_read', 'unknown', 'Control Center did not say which days carry source rows.'));
  else {
    const n = new Set(tracking.source_dates).size;
    if (n < tracking.days) out.push(finding('tracking.days_read', 'watch', `Source rows on ${n} of ${tracking.days} days; the other ${tracking.days - n} are unknown, not zero.`, "Control Center's daily capture"));
    else out.push(finding('tracking.days_read', 'pass', `Source rows on all ${tracking.days} days.`));
  }

  // Key events: the brief's finish line. Event names are not served for mindmake.co, so which event fires stays unknown.
  const rows = tracking.rows ?? [];
  const sessions = rows.reduce((n, r) => n + r.sessions, 0);
  const keyRows = rows.filter(r => r.key_events !== null);
  const keyDaily = (tracking.daily ?? []).filter(d => d.key_events !== null);
  const read = keyRows.length
    ? { keys: keyRows.reduce((n, r) => n + r.key_events, 0), visits: keyRows.reduce((n, r) => n + r.sessions, 0), from: 'source rows' }
    : keyDaily.length ? { keys: keyDaily.reduce((n, d) => n + d.key_events, 0), visits: keyDaily.reduce((n, d) => n + (d.sessions ?? 0), 0), from: 'daily totals' } : null;
  const named = ' Event names are not served for mindmake.co, so whether the key event is the finished brief (brief_submit) cannot be read here.';
  if (!read || !read.visits) out.push(finding('tracking.key_event', 'unknown', 'No sessions with key events were served, in the source rows or the daily totals.'));
  else if (read.keys === 0) out.push(finding('tracking.key_event', 'watch', `0 key events across ${read.visits} sessions in the ${read.from} of ${tracking.days} days: either nobody finished the brief, or no key event is set.${named}`, 'mark brief_submit as a key event in Google Analytics (waiting on Krish in NOW.md)'));
  else out.push(finding('tracking.key_event', 'pass', `${read.keys} key events across ${read.visits} sessions in the ${read.from} of ${tracking.days} days.${named}`));

  // Visits Analytics cannot trace to a source. Expected in part: his one-to-one notes carry no tag by rule.
  if (!sessions) out.push(finding('tracking.untraced', 'unknown', 'No source rows with sessions were served.'));
  else {
    const untraced = rows.filter(r => { const { source, medium } = split(r.value); return ['(direct)', '(not set)'].includes(source) || medium === '(not set)'; }).reduce((n, r) => n + r.sessions, 0);
    const share = Math.round(untraced / sessions * 100);
    const why = ' Part of this is by rule: his one-to-one notes carry no tag, so their visits read as direct, and a meeting\'s path comes from his tap, never from Analytics.';
    if (untraced / sessions > UNTRACED_LINE) out.push(finding('tracking.untraced', 'watch', `${untraced} of ${sessions} sessions (${share}%) have no traceable source, above the engine's own line of ${UNTRACED_LINE * 100}%.${why}`, 'tag every public placement with its growth tag (src/stages/traffic.mjs, tagged)'));
    else out.push(finding('tracking.untraced', 'pass', `${untraced} of ${sessions} sessions (${share}%) have no traceable source.${why}`));
  }

  // The engine's own placements: does each booked show or stage show up?
  if (hosts === null) out.push(finding('tracking.placements', 'unknown', "The context was not read, so the shows and stages he was booked on are unknown."));
  else if (!hosts.size) out.push(finding('tracking.placements', 'pass', 'No show or stage he was booked on is in the records, so no placement is due a visit yet.'));
  else {
    let tagged = 0, bare = 0;
    for (const r of rows) {
      const { source, medium } = split(r.value);
      const tag = /^growth-([a-z-]+)$/.exec(source);
      if (tag && TAG_PATHS.includes(tag[1])) tagged += r.sessions;
      else if (medium === 'referral' && [...hosts].some(x => source === x || source.endsWith(`.${x}`))) bare += r.sessions;
    }
    const n = hosts.size;
    if (!tagged && !bare) out.push(finding('tracking.placements', 'watch', `Booked on ${n} show${n === 1 ? '' : 's'} or stage${n === 1 ? '' : 's'}; none sent a visit Analytics can trace in ${tracking.days} days. The brief link may be missing from the show notes or event page.`, "check the booked placements carry the tagged brief link (the show-notes note, src/stages/shownotes.mjs)"));
    else if (bare && !tagged) out.push(finding('tracking.placements', 'watch', `${bare} sessions came from the sites of shows or stages he was booked on, none with the growth tag: the link was placed without it, so the path is traced by the host only.`, 'ask for the tagged link in the show notes (src/stages/shownotes.mjs)'));
    else out.push(finding('tracking.placements', 'pass', `${tagged} tagged and ${bare} untagged sessions from his booked placements.`));
  }
  return out;
}

/** Counts by state, in STATES order. Pure. */
export function trackingCounts(findings) {
  const c = Object.fromEntries(STATES.map(s => [s, 0]));
  for (const f of findings) c[f.state] += 1;
  return c;
}

/**
 * The one activity line a run: counts by state, then each failing and watched
 * check by its short name with its fix, and the unknowns by name. Fits the
 * report's 500 characters by naming fewer fixes, never by dropping a count. Pure.
 */
export function trackingLine(findings) {
  const c = trackingCounts(findings);
  const short = id => id.replace(/^tracking\./, '');
  const head = `Tracking check on ${SITE}: ${c.fail} fail, ${c.watch} to watch, ${c.unknown} unknown, ${c.pass} pass.`;
  const parts = [
    ...findings.filter(f => f.state === 'fail').map(f => `Fail ${short(f.id)}${f.fix ? `: ${f.fix}` : ''}.`),
    ...findings.filter(f => f.state === 'watch').map(f => `Watch ${short(f.id)}${f.fix ? `: ${f.fix}` : ''}.`)
  ];
  const unknown = findings.filter(f => f.state === 'unknown').map(f => short(f.id));
  const tail = unknown.length ? ` Unknown, not passed: ${unknown.join(', ')}.` : '';
  let line = `${head}${parts.length ? ` ${parts.join(' ')}` : ''}${tail}`;
  for (let keep = parts.length - 1; line.length > 500 && keep >= 0; keep--) {
    const left = parts.length - keep;
    line = `${head}${keep ? ` ${parts.slice(0, keep).join(' ')}` : ''} ${left} more left out to fit the line.${tail}`;
  }
  return line.length > 500 ? `${head}${tail}`.slice(0, 500) : line;
}
