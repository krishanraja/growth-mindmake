import { DAY, clean } from '../guards.mjs';
import { PERSONAL_MAIL } from './compliance.mjs';

/**
 * Company reads (plan item A2, the engine's side): a company's own website,
 * read for free by Control Center's research desk (`company_read`, 20 a day,
 * a capability with no protocol version: it is asked only once
 * `capabilities.research.kinds` lists it), so an opening that has nothing of
 * the person's own to cite can cite one thing their company says about
 * itself, labelled as read from the company's own site.
 *
 * Who it is asked for: someone this engine is about to write to whose
 * opening has no person fact, a close tie gone quiet held `opening_no_fact`
 * (src/stages/rows.mjs) or a warm buyer held `no_trigger`
 * (src/stages/pilots.mjs). A person fact always comes first; the company's
 * site is the lower-priority source, so it is asked only where it could be
 * used.
 *
 * Which site: only the company domain Control Center serves on a person row
 * (`contacts.company_domain`), never one guessed from a company's name, and
 * only a public host Control Center would read (its own `siteOf` rules,
 * control-center api/_companyRead.ts). The query is the site and nothing
 * else: never an address, a name or any private value.
 *
 * When: at most COMPANY_READS_PER_RUN a run, inside the desk's daily cap
 * (`capabilities.research.per_day.company_read`, else COMPANY_READS_PER_DAY),
 * and never while an answer for that site from the last
 * COMPANY_READ_FRESH_DAYS is on file. The request id is stable per site and
 * month (`company:<site>:<YYYY-MM>`, UTC, as the desk counts), so a site
 * asked before replays its answer at no cost; a read the desk could not run
 * (`failed`) or refused over its cap is asked again the next desk day under
 * that day's id, never twice in one day.
 *
 * email_check, the desk's other free kind, is not asked: no send path uses it
 * while the cold lane is held by the compliance gate (src/stages/compliance.mjs).
 *
 * Pure: no network, no clock but the run's.
 */

/** The most company reads one run asks for. */
export const COMPANY_READS_PER_RUN = 5;
/** The desk's daily cap for company reads when the capabilities do not say (ENGINE-PROTOCOL.md, "The research desk"). */
export const COMPANY_READS_PER_DAY = 20;
/** How long a read of a company's site stands before it is asked again. */
export const COMPANY_READ_FRESH_DAYS = 30;
/** The label every company fact carries, so the desk and the card say where it was read. Short, since a catch-up's ask leaves a fact little room. */
export const COMPANY_FACT_LABEL = "Their company's site:";

const HOST = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const INTERNAL = /(^|\.)(localhost|local|internal|intranet|corp|home|lan|test|example|invalid)$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/** The longest site a request id can carry inside the desk's 120 characters, with its month and a retry day. */
const SITE_MAX = 90;
/** What the desk says when nothing ran: asked again the next desk day. Any other status is the month's answer. */
const NOT_RUN = new Set(['failed', 'over_cap']);
/** A run of nine digits or an address never reaches the desk in a fact. */
const CONTACT_LIKE = text => /@/.test(text) || (String(text).match(/\+?\d[\d\s().-]{7,}\d/g) ?? []).some(run => (run.match(/\d/g) ?? []).length >= 9);
/** The desk's day, UTC, the day its caps count from. */
const deskDay = at => new Date(at).toISOString().slice(0, 10);
const deskMonth = at => new Date(at).toISOString().slice(0, 7);
const key = v => String(v ?? '').toLowerCase();

/** Whether Control Center serves company reads to this engine: its research kinds list `company_read`. Pure. */
export function takesCompanyRead(capabilities) {
  return Array.isArray(capabilities?.research?.kinds) && capabilities.research.kinds.includes('company_read');
}

/**
 * The site a company read asks for, from a served company domain ("acme.com",
 * "www.acme.com" or "https://acme.com/about"), or null: never an address, an
 * IP address, an internal or reserved name, a port, a login or a personal
 * mail service (compliance.mjs PERSONAL_MAIL). Control Center's own siteOf
 * rules, so it never refuses what is sent. Pure.
 */
export function companySite(domain) {
  let raw = String(domain ?? '').trim().toLowerCase();
  if (!raw || /\s/.test(raw) || raw.includes('@')) return null;
  if (!/^https?:\/\//.test(raw)) raw = `https://${raw}`;
  let host;
  try {
    const u = new URL(raw);
    if (u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) return null;
    host = u.hostname.replace(/\.$/, '');
  } catch { return null; }
  if (IPV4.test(host) || host.includes(':') || !HOST.test(host) || INTERNAL.test(host)) return null;
  const site = host.replace(/^www\./, '');
  // A personal mail service is nobody's company: its home page would read as a fact about them.
  if ([...PERSONAL_MAIL].some(d => site === d || site.endsWith(`.${d}`))) return null;
  return site.length <= SITE_MAX ? site : null;
}

/**
 * Each served person's company site by lower-cased contact id: the company
 * domain on any row Control Center serves for them (the quiet ties, the
 * network, the amplifier candidates, and a person an Advisory row carries),
 * the first that is a readable site. Nobody's site is worked out from a
 * company's name. Pure.
 */
export function companySites(context) {
  const out = new Map();
  const add = (id, domain) => { const site = companySite(domain); if (typeof id === 'string' && site && !out.has(key(id))) out.set(key(id), site); };
  for (const list of [context?.quiet_ties, context?.network, context?.amplifier_candidates]) {
    for (const p of Array.isArray(list) ? list : []) add(p?.contact_id, p?.contacts?.company_domain);
  }
  for (const r of Array.isArray(context?.records?.advisory) ? context.records.advisory : []) {
    const p = r?.person;
    if (p && typeof p === 'object' && (p.contact_id === undefined || key(p.contact_id) === key(r.contact_id))) add(r.contact_id, p.contacts?.company_domain);
  }
  return out;
}

/** When a stored read ran: its answer, else its asking, as a time. */
const ranAt = r => { const t = Date.parse(r?.answered_at ?? r?.requested_at ?? ''); return Number.isFinite(t) ? t : null; };
/** The desk day a stored request was asked on, by its time, else by the day in its id. */
const askedOn = r => { const t = Date.parse(r?.requested_at ?? r?.answered_at ?? ''); return Number.isFinite(t) ? deskDay(t) : /:(\d{4}-\d{2}-\d{2})$/.exec(String(r?.request_id ?? ''))?.[1] ?? null; };

/**
 * The newest read of this site the desk ran (`answered`, or `empty` when
 * there was nothing to read) inside COMPANY_READ_FRESH_DAYS of the run, or
 * null. A read asked as another company's site never counts. Pure.
 */
export function companyReadOnFile(research, site, at) {
  if (!site) return null;
  const now = Date.parse(at);
  const runs = (Array.isArray(research) ? research : []).filter(r => r?.kind === 'company_read' && ['answered', 'empty'].includes(r.status) && companySite(r.query) === site)
    .map(r => ({ r, t: ranAt(r) })).filter(({ t }) => t !== null && now - t >= 0 && now - t <= COMPANY_READ_FRESH_DAYS * DAY);
  return runs.sort((a, b) => b.t - a.t)[0]?.r ?? null;
}

/**
 * The request that reads one company's site, or null when none is due: an
 * answer from the last COMPANY_READ_FRESH_DAYS is on file, the month's read
 * is in, or one was asked today. The first ask of a month goes under
 * `company:<site>:<YYYY-MM>`; after a read the desk could not run, the next
 * desk day's under `company:<site>:<YYYY-MM>:<YYYY-MM-DD>`. The query is the
 * site alone, and no person is named. Pure.
 */
export function companyReadRequest({ site, research = [], at }) {
  if (!site || companyReadOnFile(research, site, at)) return null;
  const base = `company:${site}:${deskMonth(at)}`;
  const mine = (Array.isArray(research) ? research : []).filter(r => typeof r?.request_id === 'string' && (r.request_id === base || r.request_id.startsWith(`${base}:`)));
  if (mine.some(r => !NOT_RUN.has(r.status))) return null;
  const today = deskDay(at);
  if (mine.some(r => r.request_id === `${base}:${today}` || askedOn(r) === today)) return null;
  return { request_id: mine.length ? `${base}:${today}` : base, kind: 'company_read', subject_ref: null, query: site,
    why: "Reads the company's own website so a held opening can cite one thing it says about itself; no person is named." };
}

/** Company reads already run on this desk day: what is left of the cap is today's room. Pure. */
export function companyReadsToday(research, at) {
  const today = deskDay(at);
  return (Array.isArray(research) ? research : []).filter(r => r?.kind === 'company_read' && ['answered', 'empty'].includes(r.status) && askedOn(r) === today).length;
}

/**
 * This run's company reads: one request a site, for the people the rows and
 * the warm buyers want read (`wants`, each { site, score }), highest score
 * first, at most COMPANY_READS_PER_RUN and never past what is left of the
 * desk's day. None unless Control Center serves the kind. Pure.
 */
export function companyReadRequests({ wants = [], research = [], at, capabilities }) {
  if (!takesCompanyRead(capabilities)) return [];
  const cap = capabilities?.research?.per_day?.company_read;
  const perDay = Number.isInteger(cap) && cap >= 0 ? cap : COMPANY_READS_PER_DAY;
  const room = Math.max(0, Math.min(COMPANY_READS_PER_RUN, perDay - companyReadsToday(research, at)));
  const out = [];
  for (const w of [...(Array.isArray(wants) ? wants : [])].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))) {
    if (out.length >= room) break;
    const site = companySite(w?.site);
    if (!site || out.some(r => r.query === site)) continue;
    const q = companyReadRequest({ site, research, at });
    if (q) out.push(q);
  }
  return out;
}

/** Which of a site's pages says most about what the company does, first: the home page, about, news, customers, team, careers, contact, then any other. */
const PAGE_ORDER = [/^\/?$/, /about|who-we-are|company|story/, /news|press|blog|updates|insights/, /customer|client|case|work/, /team|people|leadership/, /career|jobs|join/, /contact/];
const pageRank = url => { let path = ''; try { path = new URL(url).pathname.toLowerCase(); } catch { return PAGE_ORDER.length; } const i = PAGE_ORDER.findIndex(p => p.test(path)); return i < 0 ? PAGE_ORDER.length : i; };
/** A part of a page's text cut at a word, at most `max` characters. Pure. */
function cut(text, max) {
  const t = clean(String(text ?? '')).replace(/[\u2013\u2014]/g, ',');
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '');
}

/** A part of a page that says something: three words or more, two of them ordinary lower-case words (a name alone says nothing), and no address, number run or link. */
const SAYS_SOMETHING = p => p.split(/\s+/).length >= 3 && (p.match(/(?:^|\s)\p{Ll}{3,}/gu) ?? []).length >= 2 && !CONTACT_LIKE(p) && !/https?:|www\.|\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(p);

/**
 * The facts a company read gives, best page first, each { text, url, label }:
 * each part of a page's own words that says something (its description, then
 * its heading, then the parts of its title), labelled as read from the
 * company's own site, with its page as the source. The caller takes one: the
 * first that fits its ask whole. [] for no read, an empty one, or pages that
 * say nothing usable. Pure.
 */
export function companyFacts(read) {
  if (read?.status !== 'answered') return [];
  const pages = (Array.isArray(read.evidence) ? read.evidence : []).map((e, i) => ({ e, i }))
    .filter(({ e }) => typeof e?.url === 'string' && /^https:\/\/\S+$/.test(e.url) && e.url.length <= 2000)
    .sort((a, b) => pageRank(a.e.url) - pageRank(b.e.url) || a.i - b.i);
  const out = [];
  for (const { e } of pages) {
    let host = '';
    try { host = new URL(e.url).hostname.replace(/^www\./, ''); } catch { host = ''; }
    // The snippet is the page's heading, then its own description: the description says most, so it goes first.
    const parts = [...String(e.snippet ?? '').split(/\s+\|\s+/).reverse(), ...String(e.title ?? '').split(/\s+[|\u2013\u2014-]\s+/)];
    for (const part of parts) {
      const text = cut(part, 160).replace(/[.!?\s]+$/, '');
      if (!text || !SAYS_SOMETHING(text)) continue;
      const fact = `${COMPANY_FACT_LABEL} ${text}.`;
      if (!out.some(f => f.text.toLowerCase() === fact.toLowerCase())) out.push({ text: fact, url: e.url, label: `Their own site: ${host || 'company website'}` });
    }
  }
  return out;
}

/** The facts on file for one person's company site this run, best first, or []. Pure. */
export function companyFactsFor({ site, research = [], at }) {
  return companyFacts(companyReadOnFile(research, site, at));
}

/** The one activity line a run that read company sites carries: counts only, never a site or a name. Null with none asked. Pure. */
export function companyReadLine(counts) {
  const asked = counts?.company_reads_asked ?? 0;
  if (!asked) return null;
  const answered = counts?.company_reads_answered ?? 0;
  return `Company sites read for openings with nothing of the person's own to cite: ${asked} asked this run (free), ${answered} answered with pages; an opening cites one thing a site says about itself only where the person's own facts give none.`;
}
