import { seal } from '../guards.mjs';

/**
 * The circle lane (protocol 1.19.0, features.circle).
 *
 * Ruling (Krish, 2026-11-05): get in front of the very rich and the very
 * influential as the person they talk to about AI, in his own name. Fifty new
 * people outside his network first, of four kinds: exited founders, PE and VC
 * partners, public figures and family office heads. The engine decides who
 * they are; Control Center decides whether each is someone he already has
 * (api/_circleImport.ts) and answers in_network, so someone he knows goes on
 * his own row and only a stranger is ever Jonny's.
 *
 * How they are found: one cited question a kind a day to the research desk
 * (Perplexity through Control Center), asking for five people as lines the
 * engine can read by rule, each line cited. A person needs two different
 * cited sites; anything with an address or a long number is dropped. The
 * circle is sent from every answered circle lookup Control Center still holds,
 * up to CIRCLE_PER_RUN a run: a person sent twice is linked the second time,
 * never filed twice. Asking stops once CIRCLE_TARGET people have been found.
 *
 * The repository is public: no person is ever named here or in a fixture.
 * Pure, no reads.
 */

export const CIRCLE_TARGET = 50;
export const CIRCLE_PER_RUN = 10;
/** The people from his own network sent a run, beside the strangers (Krish, 2026-11-05: "Do all the things that are still open"). */
export const NETWORK_CIRCLE_PER_RUN = 10;
/** A following at or above this makes someone a public figure for the circle. */
export const PUBLIC_FIGURE_FOLLOWERS = 50000;
export const CIRCLE_PREFIX = 'circle:';
export const CIRCLE_VERSION = '1.19.0';
export const CIRCLE_KINDS = ['exited_founder', 'investor_partner', 'public_figure', 'family_office'];
/** Every circle person is invited onto Make Your Mind Up, Krish's own channel in his own name: the lane is his, not the co-hosted show's. */
export const CIRCLE_SHOW = 'makeyourmindup';

/** The sourcing brief, one question a kind: who, and the line shape the engine reads. Sector bias to media, adtech and data, his horizon. */
const LINE_SHAPE = 'Give five people, one per line, exactly as: Full name | Company | Role | One sentence on why they matter now. Cite each line with at least two different sources. Public facts only: no contact details.';
export const CIRCLE_ASKS = {
  exited_founder: { query: `Founders who sold or took public a media, advertising technology, data or internet company in the last eight years and now invest in or advise founders. ${LINE_SHAPE}`, why: 'The circle lane: very rich, very influential people Krish should meet about AI, starting with founders who exited in his sectors.' },
  investor_partner: { query: `General partners and operating partners at private equity or venture capital firms that back media, advertising technology or data companies, who speak in public about AI. ${LINE_SHAPE}`, why: 'The circle lane: the partners whose portfolios Mindmake\'s horizon names, so Krish is the first name they hear about AI.' },
  public_figure: { query: `Widely followed business authors, broadcasters and creators with a large audience of senior leaders, who talk in public about technology changing work. ${LINE_SHAPE}`, why: 'The circle lane: public figures whose word travels, for a guest seat on his shows.' },
  family_office: { query: `Principals and heads of single family offices who are publicly known for investing in technology, media or data businesses. ${LINE_SHAPE}`, why: 'The circle lane: family office principals, whose judgement is the asset an AI brain extends.' }
};

const day = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const CONTACTISH = /@|\+?(?:\d[\s().-]?){9,}/;
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const hostOf = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return null; } };

/** The circle lookups Control Center holds, answered or not. Pure. */
export const circleLookups = research => (Array.isArray(research) ? research : []).filter(r => typeof r?.request_id === 'string' && r.request_id.startsWith(CIRCLE_PREFIX));

/**
 * Read one answered circle lookup into people, by rule: a line of four
 * pipe-separated parts, its [n] markers mapped to the lookup's cited pages.
 * A line needs two cited pages on different sites. Pure.
 */
export function readCircleAnswer(lookup) {
  const kind = String(lookup?.request_id ?? '').split(':')[1];
  if (!CIRCLE_KINDS.includes(kind) || lookup?.status !== 'answered') return [];
  const cited = (Array.isArray(lookup.evidence) ? lookup.evidence : []).map(e => e?.url).filter(u => typeof u === 'string' && /^https:\/\/\S+$/.test(u));
  const out = [];
  for (const raw of String(lookup.answer ?? '').split('\n')) {
    const marks = [...raw.matchAll(/\[(\d{1,2})\]/g)].map(m => cited[Number(m[1]) - 1]).filter(Boolean);
    const line = raw.replace(/\[\d{1,2}\]/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '');
    const parts = line.split('|').map(p => clip(p, 400));
    if (parts.length < 4) continue;
    const [name, company, role, why] = parts;
    if (!name || name.split(' ').length < 2 || name.length > 120 || !why) continue;
    if ([name, company, role, why].some(t => CONTACTISH.test(t))) continue;
    const urls = [];
    for (const u of marks) if (!urls.includes(u) && !urls.some(x => hostOf(x) === hostOf(u))) urls.push(u);
    if (urls.length < 2) continue;
    out.push({ name, company: company ? clip(company, 160) : null, role: role ? clip(role, 160) : null, kind, why: clip(why, 400), source_urls: urls.slice(0, 3), reach: null, show: CIRCLE_SHOW });
  }
  return out;
}

// ── The circle inside his own network ──────────────────────────────────────
//
// The same four kinds, among the people Control Center's context serves from
// his own tiers (network, amplifier_candidates, quiet_ties), read by fixed
// rules from their title, company and typed facts. Each goes by contact_id,
// never by pages; Control Center links them and answers in_network, so their
// invite is his own row in his own box.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FUND = /\b(capital|ventures?|partners|equity|fund|investments?|vc)\b/i;
const INVESTOR_TITLE = /\b(general partner|managing partner|operating partner|venture partner|partner|principal|managing director|investor)\b/i;
const FOUNDER = /\b(co-?founder|founder)\b/i;
const EXITED = /\b(former|ex-|exited|acquired|sold|previously)\b/i;
const FAMILY_OFFICE = /\bfamily office\b/i;
const strOf = v => (typeof v === 'string' ? v : '');

/** The circle kind someone in his network reads as, from their record, or null. Pure. */
export function networkKind(c) {
  const title = [c?.current_title, c?.contacts?.title, c?.headline].map(strOf).filter(Boolean).join(' | ');
  const company = [c?.current_company, c?.contacts?.company].map(strOf).filter(Boolean).join(' | ');
  const facts = Array.isArray(c?.facts) ? c.facts : [];
  const factText = kind => facts.filter(f => f?.kind === kind).map(f => strOf(f?.text)).join(' | ');
  if (FAMILY_OFFICE.test(title) || FAMILY_OFFICE.test(company)) return 'family_office';
  if (INVESTOR_TITLE.test(title) && FUND.test(`${title} | ${company}`)) return 'investor_partner';
  if (FOUNDER.test(title) && EXITED.test(title)) return 'exited_founder';
  if (FOUNDER.test(factText('role_change'))) return 'exited_founder';
  const followers = Number(c?.followers ?? (/(\d[\d,]*)/.exec(factText('reach'))?.[1] ?? '').replace(/,/g, ''));
  if (c?.is_influencer === true || c?.is_creator === true || /influencer|creator/i.test(factText('badge')) || (Number.isFinite(followers) && followers >= PUBLIC_FIGURE_FOLLOWERS)) return 'public_figure';
  return null;
}

const WHY = {
  family_office: 'Runs or works in a family office, so their judgement is the asset an AI brain extends.',
  investor_partner: 'A partner at a fund, so the companies they back are the leaders Mindmake builds for.',
  exited_founder: 'Founded a company and has moved on from it, with the time and the network to back what comes next.',
  public_figure: 'Widely followed, so a conversation with them travels far.',
};

/** Up to NETWORK_CIRCLE_PER_RUN people from his own network, one each, in the order the context serves them. Pure. */
export function circleFromNetwork(context) {
  const lists = [context?.network, context?.amplifier_candidates, context?.quiet_ties].flatMap(l => (Array.isArray(l) ? l : []));
  const seen = new Set(), out = [];
  for (const c of lists) {
    const id = c?.contact_id;
    if (typeof id !== 'string' || !UUID.test(id) || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    if (['do_not_contact', 'closed'].includes(c?.contacts?.status)) continue;
    const name = clip(c?.contacts?.full_name, 120);
    if (name.split(' ').length < 2 || CONTACTISH.test(name)) continue;
    const kind = networkKind(c);
    if (!kind) continue;
    const role = clip(c?.current_title ?? c?.contacts?.title, 160) || null;
    const company = clip(c?.current_company ?? c?.contacts?.company, 160) || null;
    if ([role, company].some(t => t && CONTACTISH.test(t))) continue;
    out.push({ name, company, role, kind, why: WHY[kind], source_urls: [], contact_id: id.toLowerCase(), reach: null, show: CIRCLE_SHOW });
    if (out.length >= NETWORK_CIRCLE_PER_RUN) break;
  }
  return out;
}

const keyOf = p => `${p.name.toLowerCase()}|${String(p.company ?? '').toLowerCase()}`;

/** Every distinct person the circle lookups found, oldest lookup first. Pure. */
export function circleFound(research) {
  const seen = new Set(), out = [];
  const lookups = circleLookups(research).sort((a, b) => String(a.request_id).localeCompare(String(b.request_id)));
  for (const l of lookups) for (const p of readCircleAnswer(l)) { const k = keyOf(p); if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
}

/** Today's circle questions: one a kind, none once the target is found or one was asked today. Pure. */
export function circleRequests({ research = [], at }) {
  if (circleFound(research).length >= CIRCLE_TARGET) return [];
  const today = day(at), asked = circleLookups(research);
  const out = [];
  for (const kind of CIRCLE_KINDS) {
    const base = `${CIRCLE_PREFIX}${kind}:${today}`;
    if (asked.some(r => r.request_id.startsWith(base))) continue;
    const a = CIRCLE_ASKS[kind];
    out.push({ request_id: `${base}:${seal({ query: a.query }).slice(0, 8)}`, kind: 'question', subject_ref: null, query: a.query.slice(0, 400), why: a.why.slice(0, 300) });
  }
  return out;
}

/**
 * The circle this run sends: up to CIRCLE_PER_RUN people, the newest-found
 * first so the 50 fill, then rotating through the older ones Control Center
 * links again. Pure.
 */
export function circlePeople(research, { at } = {}) {
  const all = circleFound(research);
  if (!all.length) return [];
  // Rotate by the day so every found person is sent within a few runs, without a store of who went when.
  const start = at ? Number(seal({ d: day(at) }).slice(0, 6), 16) % all.length : 0;
  const ring = [...all.slice(start), ...all.slice(0, start)];
  return ring.slice(0, CIRCLE_PER_RUN);
}

/** Whether a run may send a circle: Control Center records it, serves 1.19.0, and the schema copied here has it. Pure. */
export function takesCircle(capabilities, schema) {
  return capabilities?.features?.circle === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes(CIRCLE_VERSION) && !!schema?.properties?.circle;
}

/** Control Center's answer to a run's circle, as counts only: never a name. Pure. */
export function circleAnswer(sent, answer) {
  if (!sent) return null;
  if (!answer || typeof answer !== 'object') return { state: 'unanswered', line: `Circle: ${sent} sent; Control Center did not say what it did with them.` };
  if (answer.error === 'circle_unrecorded') return { state: 'unrecorded', line: `Circle: ${sent} sent; Control Center's recorder failed this run, so none was filed.` };
  const n = v => (Number.isInteger(v) && v >= 0 ? v : 0);
  const refused = Object.entries(answer.refused ?? {}).filter(([, v]) => n(v)).map(([k, v]) => `${n(v)} ${k.replace(/_/g, ' ')}`);
  const known = (Array.isArray(answer.people) ? answer.people : []).filter(p => p?.in_network === true).length;
  const asked = n(answer.asked);
  return { state: answer.dry_run ? 'dry_run' : 'answered', line: `Circle: ${sent} sent; ${n(answer.created)} new, ${n(answer.linked)} already in his records (${known} in his network, so his own row)${asked ? `; ${asked} same-name ${asked === 1 ? 'question' : 'questions'} for him` : ''}${refused.length ? `; refused: ${refused.join(', ')}` : ''}.` };
}
