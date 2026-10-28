import { DAY } from '../guards.mjs';
import { offerFindings } from './canon.mjs';
import { shadowLine } from './visibility.mjs';

/**
 * Where Mindmake's buyers already go, and which questions to ask the AI
 * answer engines about Mindmake (plan section 12, M13; Ruling, Krish,
 * 2026-10-27: Control Center "does not own the strategy for how to grow
 * mindmake as a business"). The engine home is the weekly review
 * (src/weekly-review.mjs `weeklyPlaces`); the AEO content itself is the
 * AEO-Engine repository's, and nothing here writes it.
 *
 * Ported from Control Center, rule for rule, for Mindmake only:
 *   api/growth/geo-probe.ts   toQuestion, questionsFrom and planProbes (each
 *                             touchpoint's buyer questions split on " / ",
 *                             fragments under 12 characters dropped, at most
 *                             four a touchpoint, the best-rated touchpoints
 *                             first, at most twelve a run), and ourHits (a
 *                             probe counts as a citation when one of
 *                             Mindmake's domains is in the answer or its
 *                             citations)
 *   src/lib/growthModel.ts    nextMoves's places (a planned account with no
 *                             handle, and the places it opens, the
 *                             best-rated first), the places count of
 *                             productSignals, and missedQuestions (the
 *                             questions where Mindmake was not named in 30
 *                             days, newest first)
 *   growth_touchpoints        the decisions its rows carry (what a place
 *                             is for, whether it is covered or retired, how
 *                             well it pays): read, never written here
 *
 * What changes on the way in, each a code in the shadow:
 *   - Mindmake's domains are read from the canon live (the hosts of the two
 *     links "What the growth engine may say" names), never a list in code:
 *     a domain Control Center counts that the canon does not name is
 *     domain_outside_canon, and a canon host it misses is canon_domain_missing
 *   - a domain is matched as a whole host, never as a substring, so
 *     another site whose name contains Mindmake's is not a citation
 *     (substring_hit)
 *   - Control Center's twelve probes a run are shared by every product, so a
 *     Mindmake question can fall off behind another product's
 *     (cap_shared_with_other_products); the engine plans Mindmake's alone
 *   - a question that names an offer the canon retired is not probed
 *     (question_names_retired_offer)
 *
 * What stays in Control Center: the touchpoint map and its edits (Krish's),
 * the probe runner and its paid calls, the probes it records, the Growth
 * tab and the accounts. Pure: no model, no network, no clock but the run's.
 */

/** api/growth/geo-probe.ts MAX_PROBES_PER_RUN: at most this many questions a run. */
export const MAX_PROBES_PER_RUN = 12;
/** questionsFrom: at most this many questions from one touchpoint, and the shortest fragment kept. */
export const QUESTIONS_PER_PLACE = 4;
export const MIN_FRAGMENT = 12;
/** src/lib/growthModel.ts AI_WINDOW_DAYS: the window every "do AI answers mention you" count uses. */
export const AI_WINDOW_DAYS = 30;
/** api/growth/geo-probe.ts ANSWER_SNAPSHOT_CHARS and MAX_COMPETITORS: what a stored probe keeps of an answer. */
export const SNAPSHOT_CHARS = 1800;
export const SNAPSHOT_CITATIONS = 8;
/** The product this engine plans for, as Control Center's Growth tables spell it. */
export const PRODUCT = 'mindmake';

/** api/growth/geo-probe.ts toQuestion: one clause as the question a buyer would type. Pure. */
export function toQuestion(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const capped = s.charAt(0).toUpperCase() + s.slice(1);
  return /[?]$/.test(capped) ? capped : `${capped}?`;
}

/** api/growth/geo-probe.ts questionsFrom: a touchpoint's buyer questions, split on "/", short fragments dropped, at most four. Pure. */
export function questionsFrom(icpTrigger) {
  const parts = String(icpTrigger || '').split('/').map(p => p.trim()).filter(p => p.length >= MIN_FRAGMENT);
  const source = parts.length ? parts : [String(icpTrigger || '').trim()];
  const out = [];
  for (const p of source) {
    const q = toQuestion(p);
    if (q && !out.includes(q)) out.push(q);
    if (out.length >= QUESTIONS_PER_PLACE) break;
  }
  return out;
}

const live = t => t && typeof t.id === 'string' && t.channel === 'geo' && t.coverage_status !== 'retired';

/** api/growth/geo-probe.ts planProbes, as Control Center runs it over every product: best-rated first, then by product, twelve a run. Pure. */
export function controlCenterPlan(touchpoints) {
  const all = [];
  const ordered = [...(Array.isArray(touchpoints) ? touchpoints : [])].filter(live)
    .sort((a, b) => (b.cost_efficiency_score ?? 0) - (a.cost_efficiency_score ?? 0) || String(a.product_slug).localeCompare(String(b.product_slug)));
  for (const t of ordered) for (const question of questionsFrom(t.icp_trigger)) all.push({ touchpoint_id: t.id, product_slug: t.product_slug, question, score: t.cost_efficiency_score ?? 0 });
  return { planned: all.slice(0, MAX_PROBES_PER_RUN), skipped: all.slice(MAX_PROBES_PER_RUN) };
}

/**
 * The engine's plan: Mindmake's live AI-answer touchpoints alone, in Control
 * Center's order and under its caps, with a question that names a retired
 * offer held by code. Pure.
 */
export function enginePlan(touchpoints, canon) {
  const mine = (Array.isArray(touchpoints) ? touchpoints : []).filter(t => live(t) && t.product_slug === PRODUCT);
  const all = [], held = [];
  const ordered = [...mine].sort((a, b) => (b.cost_efficiency_score ?? 0) - (a.cost_efficiency_score ?? 0) || a.id.localeCompare(b.id));
  for (const t of ordered) for (const question of questionsFrom(t.icp_trigger)) {
    if (offerFindings(question, canon?.offer).includes('retired_offer')) { held.push({ touchpoint_id: t.id, question, code: 'question_names_retired_offer' }); continue; }
    all.push({ touchpoint_id: t.id, product_slug: PRODUCT, question, score: t.cost_efficiency_score ?? 0 });
  }
  return { planned: all.slice(0, MAX_PROBES_PER_RUN), skipped: all.slice(MAX_PROBES_PER_RUN), held };
}

const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; } };

/** Mindmake's domains, from the canon read live: the hosts of the main ask and the publication. Empty when the canon was not read. Pure. */
export function canonDomains(canon) {
  return [...new Set([canon?.ask?.url, canon?.publication?.url].map(hostOf).filter(Boolean))].sort();
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A domain or any host under it, as a whole host: never inside another name. */
const hostPattern = d => new RegExp(`(?:^|[^a-z0-9-])(?:[a-z0-9-]+\\.)*${escape(d)}(?![a-z0-9-]|\\.[a-z0-9])`, 'i');

/** api/growth/geo-probe.ts ourHits, as Control Center counts it: any domain as a substring of the answer or its citations. Pure. */
export function controlCenterHits({ text = '', citations = [] }, domains) {
  const blob = `${text} ${(Array.isArray(citations) ? citations : []).join(' ')}`.toLowerCase();
  return (Array.isArray(domains) ? domains : []).filter(d => blob.includes(d));
}

/** The engine's hits: the canon's domains, each as a whole host in the answer or its citations. Pure. */
export function engineHits({ text = '', citations = [] }, domains) {
  const blob = `${text} ${(Array.isArray(citations) ? citations : []).join(' ')}`;
  return (Array.isArray(domains) ? domains : []).filter(d => hostPattern(d).test(blob));
}

/** Where a list of domains Control Center counts as Mindmake's differs from the canon, as codes with counts. Pure. */
export function domainFindings(ccDomains, canon) {
  const mine = canonDomains(canon);
  if (!mine.length) return { canon_not_read: 1 };
  const out = {}, list = (Array.isArray(ccDomains) ? ccDomains : []).map(d => String(d).toLowerCase());
  const under = (d, c) => d === c || d.endsWith(`.${c}`);
  for (const d of list) if (!mine.some(c => under(d, c))) out.domain_outside_canon = (out.domain_outside_canon ?? 0) + 1;
  for (const c of mine) if (!list.some(d => d === c)) out.canon_domain_missing = (out.canon_domain_missing ?? 0) + 1;
  return out;
}

/** src/lib/growthModel.ts channelFor: the map channel an account opens up. */
const channelFor = platform => (String(platform).toLowerCase() === 'substack' ? 'substack' : 'social_organic');

/**
 * src/lib/growthModel.ts nextMoves, its places tier, for Mindmake: each
 * planned account with no handle yet, the places it opens (Mindmake's, on
 * its channel, neither retired nor covered) and the best rating among them,
 * the account that opens the best-rated places first, ties on its key. Pure.
 */
export function accountMoves(accounts, touchpoints) {
  const places = (Array.isArray(touchpoints) ? touchpoints : []).filter(t => t?.product_slug === PRODUCT && t.coverage_status !== 'retired' && t.coverage_status !== 'covered');
  const out = [];
  for (const a of Array.isArray(accounts) ? accounts : []) {
    if (a?.product_slug !== PRODUCT || a.status !== 'planned' || (typeof a.handle === 'string' && a.handle.trim())) continue;
    const opens = places.filter(t => t.channel === channelFor(a.platform));
    const best = opens.reduce((m, t) => Math.max(m, t.cost_efficiency_score ?? 0), 0);
    out.push({ key: `account:${PRODUCT}:${String(a.platform).toLowerCase()}`, platform: String(a.platform).toLowerCase(), opens: opens.length, best });
  }
  return out.sort((a, b) => b.best - a.best || a.key.localeCompare(b.key));
}

/** src/lib/growthModel.ts productSignals, its places count for Mindmake: not retired, covered, and waiting on an open question. Pure. */
export function placesCount(touchpoints) {
  const tps = (Array.isArray(touchpoints) ? touchpoints : []).filter(t => t?.product_slug === PRODUCT && t.coverage_status !== 'retired');
  return { covered: tps.filter(t => t.coverage_status === 'covered').length, total: tps.length, waiting: tps.filter(t => typeof t.assumption_flag === 'string' && t.assumption_flag.trim()).length };
}

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);

/** src/lib/growthModel.ts missedQuestions, for Mindmake: the questions it was not named on in the last 30 days, one a question, newest first. Pure. */
export function missedQuestions(probes, at) {
  const now = Date.parse(at), since = now - AI_WINDOW_DAYS * DAY, byQ = new Map();
  for (const p of Array.isArray(probes) ? probes : []) {
    const t = Date.parse(p?.run_at ?? '');
    if (!Number.isFinite(t) || t < since || t > now + DAY || p.product_slug !== PRODUCT || (p.subject_kind != null && p.subject_kind !== 'venture')) continue;
    const key = norm(p.question);
    const had = byQ.get(key) ?? { question: String(p.question).trim(), engines: new Set(), last_asked: p.run_at, mentioned: false };
    if (p.we_cited) had.mentioned = true; else had.engines.add(p.engine);
    if (Date.parse(p.run_at) > Date.parse(had.last_asked)) had.last_asked = p.run_at;
    byQ.set(key, had);
  }
  return [...byQ.values()].filter(q => q.engines.size > 0)
    .sort((a, b) => Date.parse(b.last_asked) - Date.parse(a.last_asked) || a.question.localeCompare(b.question))
    .map(q => ({ question: q.question, engines: [...q.engines].sort(), last_asked: q.last_asked }));
}

/** The weekly review's read of places and questions, from what Control Center serves: the plan, the moves, the count and the misses. Pure. */
export function placesReview({ touchpoints = null, probes = null, accounts = null, canon = null, at }) {
  return {
    questions: Array.isArray(touchpoints) ? enginePlan(touchpoints, canon) : null,
    accounts: Array.isArray(accounts) && Array.isArray(touchpoints) ? accountMoves(accounts, touchpoints) : null,
    places: Array.isArray(touchpoints) ? placesCount(touchpoints) : null,
    missed: Array.isArray(probes) ? missedQuestions(probes, at) : null,
    domains: canonDomains(canon),
  };
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const codes = o => Object.entries(o).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(', ');

/**
 * Places and questions in shadow. For every Mindmake probe the context
 * serves, the engine's own hit test on its stored answer and citations
 * beside Control Center's recorded we_cited; for Mindmake's touchpoints, the
 * questions the engine would probe beside the ones Control Center's shared
 * plan reaches; and, when Control Center's list of domains is passed in, how
 * it differs from the canon. Control Center serves none of these to this
 * engine yet, so today the line says so in counts. Nothing is held, written
 * or changed. Pure.
 */
export function placesShadow({ context, canon = null, at, ccDomains = null }) {
  const records = context?.records ?? {};
  const probes = Array.isArray(records.geo_probes) ? records.geo_probes.filter(p => p && p.product_slug === PRODUCT) : null;
  const touchpoints = Array.isArray(records.touchpoints) ? records.touchpoints : null;
  const domains = canonDomains(canon);
  const differ = {}, apart = {}, verdicts = [];
  let agree = 0;
  for (const p of probes ?? []) {
    const answer = { text: p.answer_snapshot ?? '', citations: Array.isArray(p.competitors_cited) ? p.competitors_cited : [] };
    let code = null;
    if (!domains.length) { code = 'canon_not_read'; bump(apart, code); }
    else if (typeof p.we_cited !== 'boolean') { code = 'not_recorded'; bump(apart, code); }
    else {
      const mine = engineHits(answer, domains).length > 0;
      // A stored answer is cut at 1,800 characters and eight citations, so a hit past the cut reads as missing: answer_cut, never a guess.
      const cut = String(answer.text).length >= SNAPSHOT_CHARS || answer.citations.length >= SNAPSHOT_CITATIONS;
      if (mine === p.we_cited) agree++;
      else { code = p.we_cited ? (controlCenterHits(answer, domains).length ? 'substring_hit' : cut ? 'answer_cut' : 'cited_outside_canon') : 'missed_by_control_center'; bump(differ, code); }
    }
    verdicts.push({ question: norm(p.question), engine_cited: domains.length ? engineHits(answer, domains).length > 0 : null, control_center: p.we_cited ?? null, agrees: code === null ? true : code in differ ? false : null, code });
  }
  let questions;
  if (!touchpoints) questions = ' Questions: Mindmake\'s touchpoints are not served this run, so none are planned.';
  else {
    const mine = enginePlan(touchpoints, canon), theirs = controlCenterPlan(touchpoints);
    const reached = new Set(theirs.planned.filter(p => p.product_slug === PRODUCT).map(p => p.question));
    const fell = mine.planned.filter(p => !reached.has(p.question)).length;
    const held = {};
    for (const h of mine.held) bump(held, h.code);
    if (fell) held.cap_shared_with_other_products = fell;
    questions = ` Questions: the engine would probe ${mine.planned.length} for Mindmake, Control Center's shared plan reaches ${reached.size}${codes(held) ? ` (${codes(held)})` : ''}.`;
  }
  const found = ccDomains ? domainFindings(ccDomains, canon) : null;
  const named = ` Domains: the canon names ${domains.length}${found === null ? ", not compared with Control Center's list this run" : codes(found) ? `; Control Center's list differs (${codes(found)})` : "; Control Center's list matches"}.`;
  const label = probes ? shadowLine('Places and questions', ['probe', 'probes'], { read: probes.length, agree, differ, apart })
    : "Places and questions, in shadow: Control Center's probes are not served this run, so none are compared.";
  return { verdicts, line: label + questions + named, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
