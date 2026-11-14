import { DAY, clean } from '../guards.mjs';
import { canonBuyerTitle, offerFindings } from './canon.mjs';
import { shadowLine } from './visibility.mjs';
import { rowProposal, actionFor, cardFor, caseFor, cardClash, titleFor, lessons, refusedBy, fitHold, fitOf, cleanName, hasFullName,
  companyAsWritten, titleCase, servesOf, seniorityOf, leadFacts, hostOf, lastContact, NOT_A_SOURCE, CARD_LINE_MAX, TITLE_MAX, PER_ROW } from './rows.mjs';
import { buyerNote, tidySignal } from './openings.mjs';

/**
 * The pilot machine, moved out of Control Center (plan section 12, M6;
 * Ruling, Krish, 2026-10-27: Control Center "does not own the strategy for
 * how to grow mindmake as a business").
 *
 * What it decides: who the buyer is, what is offered, which five people a
 * week, why now, and the words. Ported rule for rule from Control Center:
 *   api/_mission.ts FACE and DOOR      who the buyer is and what is offered.
 *                                      Not ported as words: the buyer and the
 *                                      offer are read live from Mindmake's
 *                                      canon (canon.mjs parseBuyer and
 *                                      parseOffer), and Control Center's copy
 *                                      is checked against it (offerFindings).
 *                                      Krish's MISSION and PURPOSE lines stay
 *                                      canon, never code.
 *   api/pilot-deals/seed.ts INDUSTRY   the sectors a candidate is ranked on:
 *                                      now the canon's own (buyer.sectors),
 *                                      the Horizon's public ones and the sales
 *                                      wedge's internal ones; TIERS (his two
 *                                      closest tiers), whyFace and
 *                                      dropSelfReference, the classifier's
 *                                      fallback (a person it cannot place is
 *                                      asked for a door, never to buy), and
 *                                      collaboratorsLast. Its named list of
 *                                      collaborators is never copied here:
 *                                      the repository is public.
 *   api/_pilotDeals.ts findTrigger     cited or silent: a stored quote is a
 *                                      trigger only with its source and inside
 *                                      90 days (triggerFromIntent), and a
 *                                      research answer only with a source,
 *                                      never "nothing found", led by one clean
 *                                      sentence (triggerFromResearch). What
 *                                      counts as a reason to write now is the
 *                                      canon's best-fit moments
 *                                      (triggerKinds), not Control Center's
 *                                      list.
 *   api/_pilotDeals.ts draftApproach   the brief a note is written from
 *                                      (pilotBrief): why this person, why now
 *                                      or the honest line that there is no
 *                                      trigger, and one ask from the canon.
 *   api/pilot-deals/monday.ts          the Monday five: listed buyer-pipeline
 *                                      rows, never hunter's door-in cards,
 *                                      freshest trigger first, then the
 *                                      longest listed (mondayBatch).
 *   src/lib/surfaceMoves.ts            PILOT_PLAN_ASKS (25 asks for five
 *   PILOT_PLAN_ASKS                    calls and a paid pilot) is not ported:
 *                                      the number is the one in
 *                                      docs/NORTH_STAR.md, good meetings by
 *                                      path.
 *
 * What stays in Control Center: the records (pilot_deals and its ladder of
 * states), the network search and its scorer, the paid research call and the
 * one model call that compresses research into a sentence, the classifier's
 * model call, enrichment, Rule 2's wall (the warm-path index and knowsEnough)
 * and the Gmail draft executor.
 *
 * Live since 13 November 2026 (Ruling, Krish, 2026-11-13: the full-funnel
 * engine; docs/GET-GOING.md, 0.6 Warm buyers): the Monday five leave shadow
 * as REACH OUT rows in his own box (`pilotRows`, the plays warm_ask and
 * intro_ask). Who: listed buyer and intro asks on his two closest tiers, a
 * buyer only where the canon reads the title as one. Why now: a cited trigger
 * inside INTENT_LIVE_DAYS, or the row holds and one research question a
 * person a month asks for one. The words: an allowlist, not a template. The
 * research desk writes one sentence, the reason to write now, from the
 * trigger alone, read by fixed rules; everything else is fixed text, the
 * greeting, the building line, the canon's one ask (or the house ask for an
 * introduction), the canon's link untagged and his name
 * (src/stages/openings.mjs buyerNote). The shadow line (`pilotsShadow`)
 * stays beside it.
 *
 * Pure: no model, no network, no clock but the run's.
 */

/** api/pilot-deals/monday.ts BATCH: five approaches drafted each Monday. */
export const MONDAY_BATCH = 5;
/** api/_focus.ts PIPELINE_ASK_KINDS: the Advisory rows that are a Mindmake approach; a focus row (a podcast pitch, a show invite, press, a catch-up) is not. */
export const PIPELINE_ASK_KINDS = Object.freeze(['buyer', 'intro', 'collaborator']);
/** src/lib/pilotDealsHunter.ts HUNTER_CARD_PREFIX: a listed row whose notes begin with this is a door-in card whose opening line was already checked. */
export const HUNTER_CARD_PREFIX = 'hunter door-in:';
/** His two closest tiers: this engine's own rule for a warm buyer's note (Control Center's seed that once held it is retired, plan section 12, M6). An Advisory row listed before then on another tier is refused here, never written. */
export const SEED_TIERS = Object.freeze(['1_reciprocated', '2_core_network']);
/** api/_pilotDeals.ts INTENT_LIVE_DAYS: a stored quote older than this is no longer a reason to write this week. */
export const INTENT_LIVE_DAYS = 90;
/** api/_pilotDeals.ts NO_TRIGGER_LINE: what a brief says when no live trigger was found. */
export const NO_TRIGGER_LINE = 'NO LIVE TRIGGER FOUND: open on the relationship, do not invent news.';

const HTTP = /^https?:\/\/\S+$/i;
// api/_pilotDeals.ts NOTHING: a research answer that says it found nothing.
const NOTHING = /\b(no (recent|relevant|significant|notable|public)|nothing (found|recent|notable)|could not find|unable to find|did not find|no news|none found)\b/i;

/** api/_pilotDeals.ts plainCopy: dashes become commas, and space is single. */
export function plainCopy(s) {
  return String(s ?? '').replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

/** api/_pilotDeals.ts firstSentence: citation marks and leading markup off, then the first whole sentence. */
export function firstSentence(text) {
  const cleaned = plainCopy(String(text ?? '').replace(/\[\d+\]/g, '').replace(/^[#*\s-]+/, ''));
  const m = cleaned.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : cleaned).trim();
}

/** api/_pilotDeals.ts citedIndex: the source a [n] mark names, zero based, or null. */
export function citedIndex(text) {
  const m = String(text ?? '').match(/\[(\d+)\]/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 ? n - 1 : null;
}

/** api/_pilotDeals.ts triggerFromIntent: a stored quote is a trigger only with a sentence, an http source and a date inside INTENT_LIVE_DAYS of the run. Pure. */
export function triggerFromIntent(stored, at) {
  if (!stored) return null;
  const signal = plainCopy(stored.intent_evidence || '');
  const url = String(stored.intent_evidence_url || '').trim();
  const posted = stored.last_post_at;
  if (!signal || !HTTP.test(url) || !posted) return null;
  const age = Date.parse(at) - Date.parse(posted);
  if (!Number.isFinite(age) || age > INTENT_LIVE_DAYS * DAY) return null;
  return { signal: signal.slice(0, 300), url, found_at: posted };
}

/**
 * api/_pilotDeals.ts findTrigger, its deterministic half: a research answer
 * is a trigger only with an http source, never when it says it found
 * nothing, and led by one sentence of 40 to 240 characters; a [n] mark in
 * that sentence picks its source. A longer or shorter lead is compressed by
 * Control Center's one model call, which stays there (code
 * needs_compression). Pure.
 */
export function triggerFromResearch({ text, sources } = {}, at) {
  const body = String(text ?? '').trim();
  const cited = (Array.isArray(sources) ? sources : []).map(s => String(s ?? '').trim()).filter(s => HTTP.test(s));
  if (!body || !cited.length) return { trigger: null, code: 'no_source' };
  if (NOTHING.test(body.slice(0, 200))) return { trigger: null, code: 'nothing_found' };
  const lead = body.split(/\n+/).map(l => l.trim()).find(l => l.length > 20) || body;
  const idx = citedIndex(lead);
  const url = idx !== null && cited[idx] ? cited[idx] : cited[0];
  const signal = firstSentence(lead);
  if (signal.length < 40 || signal.length > 240) return { trigger: null, code: 'needs_compression' };
  return { trigger: { signal: signal.slice(0, 300), url, found_at: at }, code: null };
}

/** The kinds of news Control Center's research asked for (api/_pilotDeals.ts findTrigger), each with the canon moment that would support it, if any. */
const RESEARCH_KINDS = Object.freeze([
  ['funding', /\bfund(?:ing|ed|raise)\b|\binvestment\b/i],
  ['leadership_change', /\bleadership\b|\bnew (?:chief|ceo)\b/i],
  ['restructuring', /\blayoffs?\b|\brestructur/i],
  ['ai_move', /\bAI has changed\b/i],
  ['results', /\bresults?\b|\bearnings\b/i],
]);

/** Which of Control Center's trigger kinds the canon's best-fit moments support today, and the moments themselves, read live. Pure. */
export function triggerKinds(buyer) {
  const moments = Array.isArray(buyer?.moments) ? buyer.moments : [];
  const supported = RESEARCH_KINDS.filter(([, re]) => moments.some(m => re.test(m))).map(([k]) => k);
  return { moments, supported, unsupported: RESEARCH_KINDS.map(([k]) => k).filter(k => !supported.includes(k)) };
}

/** src/lib/pilotDealsHunter.ts isHunterCard. */
export function isHunterCard(notes) {
  return String(notes ?? '').trim().toLowerCase().startsWith(HUNTER_CARD_PREFIX);
}

const stamp = v => { const t = Date.parse(v ?? ''); return Number.isFinite(t) ? t : null; };

/**
 * api/pilot-deals/monday.ts: the Monday five. Listed rows of a pipeline ask
 * kind, never a hunter card, freshest trigger first with no trigger last,
 * then the longest listed, at most MONDAY_BATCH. The id breaks a tie the
 * database left unordered. Pure.
 */
export function mondayBatch(rows, batch = MONDAY_BATCH) {
  return (Array.isArray(rows) ? rows : [])
    .filter(r => r?.state === 'listed' && PIPELINE_ASK_KINDS.includes(r.ask_kind) && !isHunterCard(r.notes))
    .sort((a, b) => {
      const ta = stamp(a.trigger_found_at), tb = stamp(b.trigger_found_at);
      if (ta !== tb) return ta === null ? 1 : tb === null ? -1 : tb - ta;
      const la = stamp(a.listed_at) ?? Infinity, lb = stamp(b.listed_at) ?? Infinity;
      return la - lb || String(a.id).localeCompare(String(b.id));
    })
    .slice(0, batch);
}

const SELF = /(control\s*cent(re|er)|krish'?s (own )?(contacts|network|crm|database)|already in (his|krish'?s) contacts)/i;
/** api/pilot-deals/seed.ts dropSelfReference: a sentence that cites his own records as the reason is no reason. */
export function dropSelfReference(text) {
  if (!text) return '';
  return String(text).split(/(?<=[.!?])\s+/).filter(s => !SELF.test(s)).join(' ').trim();
}

/** api/pilot-deals/seed.ts whyFace: the stored judgment alone, without his records cited as evidence; else the role; else the honest line. */
export function whyFace({ title = null, company = null, who = null, why_them = null } = {}) {
  const judgment = dropSelfReference(String(why_them || who || '').replace(/\s*[\u2014\u2013]\s*/g, ', ').trim());
  if (judgment) return judgment.slice(0, 600);
  const role = [title, company].filter(Boolean).join(' at ');
  return role ? `${role}.` : 'In your network, no stored judgment yet.';
}

/** api/pilot-deals/seed.ts classify, its fallback: a person the classifier cannot place is asked for a door, never asked to buy. */
export function askKindOf(kind) {
  return kind === 'buyer' || kind === 'collaborator' ? kind : 'intro';
}

/** api/pilot-deals/seed.ts collaboratorsLast: the people he works with stay on the list, under everyone who could sign; a stable sort. */
export function collaboratorsLast(proposals) {
  return proposals.map((p, i) => ({ p, i })).sort((a, b) => (a.p.ask_kind === 'collaborator') - (b.p.ask_kind === 'collaborator') || a.i - b.i).map(x => x.p);
}

/** Whether a sector word is one the canon names for Mindmake's buyer: public (the Horizon) or internal (the sales wedge, ranking only). Pure. */
export function canonSector(word, buyer) {
  const w = String(word ?? '').toLowerCase().trim();
  if (!w || !buyer?.sectors) return null;
  return buyer.sectors.public.includes(w) ? 'public' : buyer.sectors.internal.includes(w) ? 'internal' : false;
}

/**
 * The brief a pilot approach is written from (api/_pilotDeals.ts
 * draftApproach), with the buyer, the offer and the one ask read from the
 * canon instead of FACE and DOOR: why this person fits, why now or the
 * honest line, the canon's main ask, and the canon's rules for a message.
 * The internal sales wedge and the buyer's psychology never enter it. Null
 * when the canon's ask or offer is not read. Pure.
 */
export function pilotBrief({ whyFace: why, trigger, canon }) {
  if (!canon?.ask?.label || !canon?.offer?.noun) return null;
  return [
    `WHY THIS PERSON: ${plainCopy(why)}`,
    trigger ? `WHY NOW (refer to it plainly and do not go beyond it): ${trigger.signal} Source: ${trigger.url}` : NO_TRIGGER_LINE,
    `THE ONE ASK: ${canon.ask.label}, at ${canon.ask.url}. Describe it as the site does: ${canon.ask.description}.`,
    `WHAT IT LEADS TO: one ${canon.offer.noun}. Name no figure, no length and no other offer.`,
    'RULES: one ask per message. Only what is already true in public. Nothing is sent by the engine.',
  ];
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const codes = o => Object.entries(o).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(', ');

/** Each contact's title as the context serves it: the network selection first, then the legacy snapshot Control Center builds. */
export function titlesOf(context) {
  const out = new Map();
  for (const n of Array.isArray(context?.network) ? context.network : []) {
    const t = n?.current_title || n?.contacts?.title;
    if (typeof n?.contact_id === 'string' && typeof t === 'string' && t.trim()) out.set(n.contact_id.toLowerCase(), t);
  }
  for (const r of Array.isArray(context?.records?.advisory) ? context.records.advisory : []) {
    const p = advisoryPerson(r), t = p?.current_title || p?.contacts?.title;
    if (p && typeof t === 'string' && t.trim() && !out.has(key(p.contact_id))) out.set(key(p.contact_id), t);
  }
  for (const c of Array.isArray(context?.work_context?.snapshot?.contacts) ? context.work_context.snapshot.contacts : []) {
    if (typeof c?.id === 'string' && typeof c.title === 'string' && c.title.trim() && c.title !== 'Role not recorded' && !out.has(c.id.toLowerCase())) out.set(c.id.toLowerCase(), c.title);
  }
  return out;
}

/**
 * The pilot machine in shadow. For every Advisory row the context serves,
 * the engine's verdict on whether the person is a buyer by the canon's
 * groups, beside Control Center's own ask kind (buyer, or intro and
 * collaborator); the Monday batch Control Center would take; and whether
 * the words of every note it drafted say only what the canon supports.
 * Counts and codes only. Nothing is held, hidden or changed. Pure.
 */
export function pilotsShadow({ context, canon = null, at }) {
  const rows = [], seen = new Set();
  for (const r of Array.isArray(context?.records?.advisory) ? context.records.advisory : []) {
    if (typeof r?.id !== 'string' || seen.has(r.id)) continue;
    seen.add(r.id);
    rows.push(r);
  }
  const titles = titlesOf(context), buyer = canon?.buyer ?? null;
  const verdicts = [], differ = {}, apart = {};
  let agree = 0;
  for (const r of rows) {
    const theirs = PIPELINE_ASK_KINDS.includes(r.ask_kind) ? r.ask_kind === 'buyer' : null;
    const title = typeof r.contact_id === 'string' ? titles.get(r.contact_id.toLowerCase()) ?? null : null;
    const mine = canonBuyerTitle(title, buyer);
    let code = null;
    if (theirs === null) code = 'not_a_pipeline_row';
    else if (!buyer) code = 'buyer_not_in_canon';
    else if (mine === null) code = 'title_not_served';
    if (code) bump(apart, code);
    else if (mine === theirs) agree++;
    else { code = theirs ? 'buyer_outside_canon_groups' : 'canon_buyer_asked_for_a_door'; bump(differ, code); }
    verdicts.push({ subject_ref: `pilot:${r.id}`, canon_buyer: mine, control_center: theirs, agrees: code === null ? true : code in differ ? false : null, code });
  }
  // Control Center's Monday five, as far as the context lets the engine see it.
  const listed = rows.filter(r => r.state === 'listed' && PIPELINE_ASK_KINDS.includes(r.ask_kind) && !isHunterCard(r.notes));
  const ordered = listed.some(r => r.trigger_found_at !== undefined);
  const takes = mondayBatch(rows).filter(r => canonBuyerTitle(titles.get(String(r.contact_id ?? '').toLowerCase()) ?? null, buyer) === true).length;
  const monday = ` Monday: ${listed.length} listed for Control Center's batch of ${MONDAY_BATCH}${ordered ? '' : ', in an order resting on trigger dates it does not serve'}; the canon reads ${takes} of the first ${Math.min(MONDAY_BATCH, listed.length)} it would take as buyers.`;
  // The words Control Center drafted, against the canon's offer.
  const drafted = rows.filter(r => typeof r.draft_body === 'string' && r.draft_body.trim());
  const found = {};
  let clean = 0;
  for (const r of drafted) {
    const f = [...new Set([...offerFindings(r.draft_body, canon?.offer), ...offerFindings(r.draft_subject, canon?.offer)])];
    if (!f.length) clean++;
    for (const c of f) bump(found, c);
  }
  const words = !canon?.offer ? ` Words: the canon's offer was not read, so ${drafted.length} drafted note${drafted.length === 1 ? ' was' : 's were'} not checked.`
    : ` Words: ${drafted.length} drafted note${drafted.length === 1 ? '' : 's'} read, ${clean} say only what the canon supports${codes(found) ? ` (${codes(found)})` : ''}.`;
  const line = shadowLine('Pilot machine', ['Advisory row', 'Advisory rows'], { read: rows.length, agree, differ, apart }) + monday + words;
  return { verdicts, monday: mondayBatch(rows).map(r => `pilot:${r.id}`), line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}

// ── The Monday five, live (Ruling, Krish, 2026-11-13) ──────────────────────

/** The warm buyer's two plays, each its own close reference on REACH OUT (`reach_out:warm_ask`, `reach_out:intro_ask`). */
export const WARM_PLAYS = Object.freeze(['warm_ask', 'intro_ask']);
/** Whether a proposal is a warm buyer's note: by its own close reference, never by its ask, which an amplifier's connector row shares. Pure. */
export const isWarmProposal = p => p?.row === 'reach_out' && WARM_PLAYS.some(play => p?.close_condition?.reference === `reach_out:${play}`);
/** Trigger questions a run, one a person a month: the five a run. */
export const TRIGGER_ASKS_PER_RUN = MONDAY_BATCH;
/** Trigger questions a desk day (UTC, the day its caps count): two full runs, so the day's refills never spend Mindmake's 40 questions on them. */
export const TRIGGER_ASKS_PER_DAY = 2 * MONDAY_BATCH;
/** Profile questions a run for a warm buyer whose card is too thin to show, as the rows stage asks them. */
export const PILOT_PROFILES_PER_RUN = 2;
/**
 * Where a warm buyer ranks on REACH OUT: above the amplifier and signal rows,
 * in Monday order. Someone on his two closest tiers whom the canon reads as a
 * buyer, with a cited reason to write now, is the shortest path this engine
 * has to a good meeting (docs/NORTH_STAR.md, at U5). What he has already seen
 * still goes behind what he has not (rankRows).
 */
export const PILOT_SCORE = 1000;
const HTTPS_SOURCE = /^https:\/\/\S+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = v => String(v ?? '').toLowerCase();
/** The London month of a time, YYYY-MM, for one question a person a month. */
const monthOf = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).format(new Date(at));
/**
 * The research desk's day of a time, YYYY-MM-DD: UTC, the day Control Center's
 * caps count from, so a question refused over the cap is asked again only once
 * the desk has reset (in summer time a London day starts an hour before it).
 */
const deskDay = at => new Date(at).toISOString().slice(0, 10);
/** What the desk says when nothing ran: asked again the next desk day, under a new id. Any other status is the month's answer (`answered`, `empty`) or one still out. */
const NOT_RUN = new Set(['failed', 'over_cap']);
/** The desk day a stored request was asked on, by its time, else by the day in its id. */
const askedOn = r => { const t = Date.parse(r?.requested_at ?? r?.answered_at ?? ''); return Number.isFinite(t) ? deskDay(t) : /:(\d{4}-\d{2}-\d{2})$/.exec(String(r?.request_id ?? ''))?.[1] ?? null; };

/** A trigger the card can show with its page: an https source that is not a profile. Pure. */
export function showable(trigger) {
  return !!trigger && HTTPS_SOURCE.test(trigger.url ?? '') && !NOT_A_SOURCE.test(trigger.url) && trigger.url.length <= 2000;
}

/**
 * The research question that asks for one cited reason to write to a warm
 * buyer now, answered once a person a London month, always under the desk
 * day's own id, `trigger:<id>:<YYYY-MM>:<YYYY-MM-DD>`. The month's answer is
 * one the desk ran (`answered`, a nothing found included, or `empty`); after
 * that, or while one is still out, nothing is asked (null). A question the
 * desk refused over its daily cap or failed stored nothing and replays the
 * same, so it is asked again the next desk day (UTC, when its cap resets)
 * under that day's id, never twice in one day. The month's own id is never
 * sent again: Control Center serves research from 14 days only, so a month's
 * id whose record has left that window would be sent again, with today's
 * words, and refused (409) as an id asked before in other words. Pure.
 */
export function triggerRequest({ id, name, company = '', title = '', at, research = [] }) {
  const base = `trigger:${id}:${monthOf(at)}`;
  const mine = (Array.isArray(research) ? research : []).filter(r => typeof r?.request_id === 'string' && (r.request_id === base || r.request_id.startsWith(`${base}:`)));
  // The month's answer is in, or one is still out: nothing to ask.
  if (mine.some(r => !NOT_RUN.has(r.status))) return null;
  const today = deskDay(at);
  if (mine.some(r => r.request_id === `${base}:${today}` || askedOn(r) === today)) return null;
  const role = [clean(title), clean(company)].filter(Boolean).join(' at ');
  const query = clean(`One recent public fact, from the last 90 days, about ${name}${role ? `, ${role}` : ''}, or their company, that makes AI relevant to them now: funding, a new leader, a restructuring, results, or an AI or product move. Lead with one plain sentence under 200 characters, then its source. If there is none, say nothing found.`).slice(0, 400);
  return { request_id: `${base}:${today}`, kind: 'question', subject_ref: `contact:${id}`, query, why: clean(`Finds a cited reason to write to ${name} now; without one the warm ask is held.`).slice(0, 300) };
}

/** Trigger questions the desk ran or still holds today (a refusal over the cap ran nothing): what is left of TRIGGER_ASKS_PER_DAY is this run's room. Pure. */
export function triggerAsksToday(research, at) {
  const today = deskDay(at);
  return (Array.isArray(research) ? research : []).filter(r => /^trigger:/.test(String(r?.request_id ?? '')) && r.status !== 'over_cap' && askedOn(r) === today).length;
}

/**
 * The freshest cited trigger for one warm buyer, or null: the Advisory row's
 * stored quote or its growth_context's, the person's stored intent or one of
 * their dated posts (triggerFromIntent), or an answer to this engine's own
 * trigger question (triggerFromResearch, dated by when it was answered).
 * Only a source the card can show counts, and only inside INTENT_LIVE_DAYS of
 * the run. Pure.
 */
export function pilotTrigger({ row, person, research = [], at }) {
  const found = [];
  const add = t => { if (t && showable(t)) found.push(t); };
  add(triggerFromIntent(row, at));
  if (row?.growth_context && typeof row.growth_context === 'object') add(triggerFromIntent(row.growth_context, at));
  add(triggerFromIntent(person, at));
  for (const f of Array.isArray(person?.facts) ? person.facts : []) {
    const quote = f?.kind === 'post' ? /^Posted: "(.+)"$/.exec(String(f.text ?? ''))?.[1] : null;
    if (quote && quote.split(/\s+/).length >= 8) add(triggerFromIntent({ intent_evidence: quote, intent_evidence_url: f.source_url, last_post_at: f.observed_at }, at));
  }
  const id = key(row?.contact_id);
  for (const r of Array.isArray(research) ? research : []) {
    if (r?.status !== 'answered' || typeof r.request_id !== 'string' || !r.request_id.toLowerCase().startsWith(`trigger:${id}:`)) continue;
    const when = Number.isFinite(Date.parse(r.answered_at ?? '')) ? r.answered_at : at;
    const { trigger } = triggerFromResearch({ text: r.answer, sources: (Array.isArray(r.evidence) ? r.evidence : []).map(e => e?.url) }, when);
    const age = Date.parse(at) - Date.parse(when);
    if (trigger && age >= 0 && age <= INTENT_LIVE_DAYS * DAY) add(trigger);
  }
  return found.sort((a, b) => Date.parse(b.found_at) - Date.parse(a.found_at) || a.url.localeCompare(b.url))[0] ?? null;
}

/**
 * The people Jonny is already writing to or has written to and not closed: a
 * guest invited onto one of his shows, or the booking contact of a stage one
 * of Jonny's pitches went to, until it is recorded or published. A warm ask
 * never lands beside one. Pure.
 */
export function jonnyOpen(context) {
  const out = new Set();
  for (const g of Array.isArray(context?.records?.guests) ? context.records.guests : []) {
    if (typeof g?.contact_id === 'string' && g.invite_state && g.invite_state !== 'proposed' && !g.recorded_at && !g.published_at) out.add(key(g.contact_id));
  }
  const booking = new Map((Array.isArray(context?.records?.visibility) ? context.records.visibility : []).filter(t => typeof t?.id === 'string' && typeof t.booking_contact_id === 'string').map(t => [key(t.id), key(t.booking_contact_id)]));
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) {
    if (d?.mailbox !== 'jonny' || d.recorded_at || d.published_at) continue;
    const to = booking.get(key(d.visibility_target_id));
    if (to) out.add(to);
  }
  return out;
}

/** How far back a draft from either box, sent, still waiting or binned, keeps a person from a warm note. */
export const WRITTEN_LATELY_DAYS = 90;
/** Control Center's own wall before it drafts anything (written_to_lately): nobody emailed in the last 14 days. */
export const EMAILED_LATELY_DAYS = 14;
/** The decided states of this engine's own proposals: an ask he answered, carried out or declined is made. */
const DECIDED = new Set(['approved', 'declined', 'done']);
/** A warm play's close reference, the day-one `reach_out:buyer` included. */
const WARM_REF = /^reach_out:(?:warm_ask|intro_ask|buyer)$/;
const CONTACT_REF = /^contact:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const CLOSED_DEAL = /^(?:won|lost|closed|closed[_ ]?won|closed[_ ]?lost|dead|parked)$/i;

/**
 * Who has been written to already, so a warm note never lands on them: one
 * ask a person, whatever Advisory's row says.
 *
 * - `drafted`: anyone with a draft from either box, his or Jonny's, any job
 *   (the morning lane's, a press's, a pitch's), made, sent or binned inside
 *   WRITTEN_LATELY_DAYS. A draft names its person by its `contact_id` where
 *   Control Center serves it (docs/GET-GOING.md 1.1b), by the person a room's
 *   press key carries, by the booking contact of the stage a pitch went to,
 *   or through this engine's own proposal it was drafted from (`feedback`, by
 *   its id or proposal id); anything carried out from this engine's proposals
 *   in that time counts too.
 * - `asked`: anyone this engine has made a warm ask of before (a warm play he
 *   answered, carried out or declined): never twice.
 * - `deals`: anyone with an open Pipeline deal, where the context serves deals
 *   (`records.deals`); none is read as none.
 *
 * Read tolerantly: a part the context does not serve adds nobody. Pure.
 */
export function writtenTo(context, at) {
  const now = Date.parse(at), since = now - WRITTEN_LATELY_DAYS * DAY;
  const drafted = new Set(), asked = new Set(), deals = new Set();
  const feedback = Array.isArray(context?.feedback) ? context.feedback : [];
  const subjectOf = new Map();
  for (const f of feedback) {
    const who = CONTACT_REF.exec(String(f?.subject_ref ?? ''))?.[1];
    if (!who) continue;
    for (const k of [f.id, f.proposal_id]) if (typeof k === 'string' && k) subjectOf.set(key(k), key(who));
    if (WARM_REF.test(String(f.reference ?? '')) && (DECIDED.has(f.state) || f.carried_out)) asked.add(key(who));
    const when = Date.parse(f.decided_at ?? '');
    if (f.carried_out && (!Number.isFinite(when) || when >= since)) drafted.add(key(who));
  }
  const booking = new Map((Array.isArray(context?.records?.visibility) ? context.records.visibility : []).filter(t => typeof t?.id === 'string' && typeof t.booking_contact_id === 'string').map(t => [key(t.id), key(t.booking_contact_id)]));
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) {
    const times = ['created_at', 'sent_at', 'binned_at', 'replied_at'].map(k => Date.parse(d?.[k] ?? '')).filter(Number.isFinite);
    if (times.length && Math.max(...times) < since) continue;
    const who = [typeof d?.contact_id === 'string' ? d.contact_id : null,
      /^rooms:[^:]+:([0-9a-f-]{36})$/i.exec(String(d?.approach ?? ''))?.[1] ?? null,
      booking.get(key(d?.visibility_target_id)) ?? null,
      subjectOf.get(key(d?.proposal_id)) ?? null].find(x => typeof x === 'string' && x);
    if (who) drafted.add(key(who));
  }
  for (const d of Array.isArray(context?.records?.deals) ? context.records.deals : []) {
    if (typeof d?.contact_id === 'string' && !d.closed_at && !CLOSED_DEAL.test(String(d.stage ?? d.state ?? ''))) deals.add(key(d.contact_id));
  }
  return { drafted, asked, deals };
}

/**
 * Everyone another row reaches this run, by lower-cased contact id: each row
 * proposal's person, each person another row has asked the desk to write to
 * (a catch-up's or an invite's opening, by its subject), and each recipient of
 * a pitch or invite in Jonny's box or his own. A warm note skips them all
 * before anything is spent on it: one ask a person. Pure.
 */
export function othersThisRun({ rows = [], openings = [], proposals = [] } = {}) {
  const out = new Set();
  for (const e of rows) { const t = e?.proposal?.target ?? e?.target; if (typeof t === 'string' && t) out.add(key(t)); }
  for (const r of openings) { const who = CONTACT_REF.exec(String(r?.subject_ref ?? ''))?.[1]; if (who) out.add(key(who)); }
  for (const p of proposals) {
    let a = null;
    try { a = JSON.parse(p?.exact_payload ?? 'null'); } catch { a = null; }
    const to = a?.recipient_contact_id ?? CONTACT_REF.exec(String(p?.subject_ref ?? ''))?.[1];
    if (typeof to === 'string' && UUID.test(to)) out.add(key(to));
  }
  return out;
}

/**
 * The person row an Advisory row carries for its own contact, or null: read
 * tolerantly from `person` on a records.advisory entry, the shape of a
 * `network` row, which Control Center serves for each listed buyer and intro
 * ask behind `features.advisory_people` (docs/GET-GOING.md 1.1b). A row for
 * another contact is never theirs. Pure.
 */
export function advisoryPerson(row) {
  const p = row?.person;
  if (!p || typeof p !== 'object' || Array.isArray(p) || typeof row.contact_id !== 'string') return null;
  if (p.contact_id !== undefined && key(p.contact_id) !== key(row.contact_id)) return null;
  return { ...p, contact_id: row.contact_id };
}

/** Each served person by contact id: the quiet ties first, then the network, then the amplifier candidates, then a person an Advisory row carries (advisoryPerson). Pure. */
function peopleOf(context) {
  const out = new Map();
  const fromAdvisory = (Array.isArray(context?.records?.advisory) ? context.records.advisory : []).map(advisoryPerson).filter(Boolean);
  for (const list of [context?.quiet_ties, context?.network, context?.amplifier_candidates, fromAdvisory]) for (const n of Array.isArray(list) ? list : []) {
    if (typeof n?.contact_id === 'string' && !out.has(key(n.contact_id))) out.set(key(n.contact_id), n);
  }
  return out;
}

/**
 * The Monday five as REACH OUT rows (plays warm_ask and intro_ask), in
 * mondayBatch order, at most MONDAY_BATCH a run and never past the row's cap.
 *
 * Who: Advisory rows listed as a buyer or intro ask, never a hunter card, whose
 * person is on his two closest tiers (SEED_TIERS), never do not contact or
 * closed, never one with another Advisory row already past listed (a note
 * drafted or sent: never a second), never one this engine asked before, one
 * with a draft from either box, sent or binned, in the last 90 days, one with
 * an open Pipeline deal, or one emailed in the last 14 days (writtenTo,
 * lastContact), never one another row proposes this run (`taken`), one Jonny
 * is writing to (jonnyOpen), or one his answers rule out (refusedBy); a buyer
 * only where the canon reads their title as one (an intro, a door, also passes
 * the fit floor the Multiplier Steward reads); a full name and an address.
 * Why now: a cited trigger (pilotTrigger), else held `no_trigger` with one
 * trigger question a month filed. The words: the desk's one sentence, the
 * reason to write now, inside fixed text (buyerNote), held `note_waiting`
 * with its request or `note_failed`, never a template. The action: a version
 * 2 email to them for his own box (no mailbox): "Hi <first name>,", that
 * sentence, the building line and the one ask, then the canon's one link on
 * its own line, byte for byte, then "Krish": his one-to-one notes are never
 * tagged (Rulings, Krish, 2026-10-27, "Traffic to mindmake.co").
 *
 * Returns { rows: [{ score, proposal }], held: [reason], research: [request],
 * counts }. Pure.
 */
export function pilotRows({ context, canon, research: researchIn = null, at, files = [], titleMax = TITLE_MAX, lane = { on: true, max: PER_ROW }, taken = new Set(), required = false, kind = 'question', weekGoals = [], fitFloor } = {}) {
  const rows = [], held = [], requests = [], profiles = [];
  // This run's research where the dispatch has it, else the context's.
  const research = Array.isArray(researchIn) ? researchIn : Array.isArray(context?.research) ? context.research : [];
  const counts = { read: 0, rows: 0, waiting: 0, no_trigger: 0, asked: 0 };
  const advisory = Array.isArray(context?.records?.advisory) ? context.records.advisory : [];
  const listed = mondayBatch(advisory.filter(r => ['buyer', 'intro'].includes(r?.ask_kind)), Infinity);
  // Never a second note to someone Advisory already holds: a person with any row past listed (drafted, sent, replied, booked, closed) is not written to.
  const inFlight = new Set(advisory.filter(r => typeof r?.contact_id === 'string' && r.state !== 'listed').map(r => key(r.contact_id)));
  counts.read = listed.length;
  const max = Math.min(MONDAY_BATCH, lane?.on === false ? 0 : Number.isInteger(lane?.max) ? lane.max : PER_ROW);
  if (!listed.length || !max || !canon?.ask?.label || !canon?.ask?.url) return { rows, held, research: requests, counts };
  const people = peopleOf(context), titles = titlesOf(context), routes = context?.routes ?? {};
  const L = lessons(context?.feedback, at, context?.records?.drafts), jonny = jonnyOpen(context), takenIds = new Set([...taken].map(key)), written = writtenTo(context, at);
  // A profile question is keyed by the month as the amplifier rows key theirs (UTC), so the two never send one question twice.
  const month = String(at).slice(0, 7), seen = new Set();
  const askRoom = Math.max(0, Math.min(TRIGGER_ASKS_PER_RUN, TRIGGER_ASKS_PER_DAY - triggerAsksToday(research, at)));
  let inHand = 0, asks = 0;
  const hold = reason => held.push(reason);
  for (const row of listed) {
    const id = row.contact_id;
    if (typeof id !== 'string' || !UUID.test(id) || seen.has(key(id))) continue;
    seen.add(key(id));
    const person = people.get(key(id)) ?? null;
    // No person row served at all is Control Center's gap, said apart from a tier that is not one of his two closest.
    if (!person) { hold('person_not_served'); continue; }
    if (!SEED_TIERS.includes(person.network_tier)) { hold('not_close_tier'); continue; }
    if (['do_not_contact', 'closed'].includes(person.contacts?.status)) { hold('not_to_be_contacted'); continue; }
    if (inFlight.has(key(id))) { hold('advisory_in_flight'); continue; }
    // One ask a person, from what Control Center and this engine already hold (writtenTo), before anything is spent on them.
    if (written.asked.has(key(id))) { hold('already_asked'); continue; }
    if (written.drafted.has(key(id))) { hold('written_lately'); continue; }
    if (written.deals.has(key(id))) { hold('open_deal'); continue; }
    const last = lastContact(person);
    if (last !== null && Date.parse(at) - last < EMAILED_LATELY_DAYS * DAY) { hold('emailed_lately'); continue; }
    const ask = row.ask_kind === 'buyer' ? 'buyer' : 'introduce';
    const title = titles.get(key(id)) ?? null;
    if (ask === 'buyer') {
      const verdict = canonBuyerTitle(title, canon.buyer ?? null);
      if (verdict === null) { hold(canon.buyer ? 'title_unknown' : 'buyer_not_in_canon'); continue; }
      if (verdict === false) { hold('not_canon_buyer'); continue; }
      if (person.sells_competing_services === true) { hold('competitor'); continue; }
    } else {
      const unfit = fitHold(person, fitFloor);
      if (unfit) { hold(unfit); continue; }
    }
    if (takenIds.has(key(id))) { hold('on_another_row'); continue; }
    if (jonny.has(key(id))) { hold('jonny_open'); continue; }
    const refused = refusedBy(L, { subject: `contact:${id}`, row: 'reach_out', kind: null, sector: null, topic: null, band: 'unknown' }, at);
    if (refused) { hold(refused); continue; }
    const name = cleanName(person.contacts?.full_name ?? row.name ?? '');
    if (!hasFullName(name)) { hold('no_full_name'); continue; }
    if (!['verified', 'unchecked'].includes(routes[id]?.email)) { hold('no_email'); continue; }
    if (inHand >= max) { hold('batch_full'); continue; }
    const company = companyAsWritten(person.current_company ?? person.contacts?.company ?? '', [person.who, person.hook, person.why_them]);
    const trigger = pilotTrigger({ row, person, research, at });
    if (!trigger) {
      hold('no_trigger'); counts.no_trigger++;
      const q = triggerRequest({ id, name, company, title: title ?? '', at, research });
      if (q && asks < askRoom && !requests.some(r => r.request_id === q.request_id)) { requests.push(q); asks++; counts.asked++; }
      continue;
    }
    const signal = tidySignal(trigger.signal);
    const role = titleCase(cleanName(title ?? person.current_title ?? person.contacts?.title ?? ''));
    // Why now, said with its page, and why this person, in the stored judgment's own words (whyFace).
    const nowLine = [`Why now: ${signal}`, signal].find(l => l.length <= CARD_LINE_MAX) ?? '';
    const face = whyFace({ title: role, company, who: row.who ?? person.who, why_them: row.why_them ?? person.why_them });
    const themLine = face === 'In your network, no stored judgment yet.' ? '' : leadFacts(face, CARD_LINE_MAX);
    const reach = { value: null, band: 'unknown', basis: ask === 'buyer' ? 'a buyer, not an audience' : 'a connector, not an audience', source_url: null, as_of: null };
    const fit = fitOf(person), serves = servesOf('reach_out', weekGoals);
    const card = cardFor({ c: person, id, name, title: role, company, ask, kind: null, reach, fit, serves, canon, research, at, lead: [nowLine, themLine], extraSources: [{ label: `Why now: ${hostOf(trigger.url) || 'source'}`, url: trigger.url }] });
    if (!card) {
      hold('thin_card');
      if (profiles.length < PILOT_PROFILES_PER_RUN) profiles.push({ request_id: `profile:${id}:${month}`, kind: 'question', subject_ref: `contact:${id}`, query: clean(`Who is ${name}${company ? ` of ${company}` : ''}? In two or three sentences: their role, what their organisation does, and one recent public fact about their work, each with its source and date.`).slice(0, 400), why: clean(`Fills the card Krish reads before deciding whether to contact ${name}.`).slice(0, 300) });
      continue;
    }
    if (cardClash(card, company)) { hold('facts_disagree'); continue; }
    const note = buyerNote({ id, name, company, trigger, canon, research, required, at, kind, ask: ask === 'buyer' ? 'buyer' : 'intro' });
    if (note.request) requests.push(note.request);
    if (note.hold) {
      hold(note.hold);
      // Only a note the desk is writing holds a place in the five; one it refused over its cap waits for tomorrow's ask without one.
      if (note.hold === 'note_waiting') { counts.waiting++; if (!note.over_cap) inHand++; }
      continue;
    }
    inHand++;
    counts.rows++;
    const told = caseFor({ c: person, name, company, ask, kind: null, reach, fit, serves, at });
    const subject = ask === 'buyer' ? (company ? `A thought for ${company}` : 'A thought for you') : 'A small ask';
    rows.push({ score: PILOT_SCORE - rows.length, proposal: rowProposal({
      row: 'reach_out', ask, contactId: id, name, at, files,
      // Its own id and close: the play, the person and the month of the reason to write, never an amplifier's ask to the same person.
      play: ask === 'buyer' ? 'warm_ask' : 'intro_ask', month: monthOf(trigger.found_at),
      title: titleFor(ask, null, name, company, titleMax),
      why: `${name}${company ? ` (${company})` : ''} is listed in Advisory as ${ask === 'buyer' ? 'a buyer' : 'someone to ask for one introduction'}, on his two closest tiers. Why now: ${signal} Source: ${trigger.url}. The one ask: ${canon.ask.label}.`,
      because: told.because, brief: told.brief, card,
      // The desk's one sentence in its fixed frame, then the canon's one link as the canon gives it: never tagged in a one-to-one note.
      action: actionFor('email', id, name, { subject, lines: [note.note, canon.ask.url] }),
      reach, kind: null, features: { sector: null, topic: null, seniority: seniorityOf(role) }, serves,
      evidence: [{ label: clean(`Why now: ${signal}`).slice(0, 500), url: trigger.url }],
    }) });
  }
  return { rows, held, research: [...requests, ...profiles.filter(p => !research.some(r => r?.request_id === p.request_id))], counts };
}

/** Why a warm buyer is held, in words, for the codes that each get a line of their own. */
const PILOT_WHY = {
  no_trigger: n => `${n} warm buyer${n === 1 ? '' : 's'} held with no cited reason to write now inside ${INTENT_LIVE_DAYS} days; the research desk is asked for one public, sourced fact, once a person a month and at most ${TRIGGER_ASKS_PER_DAY} a day, and again the next day when it could not run the question.`,
  note_waiting: n => `${n} warm buyer${n === 1 ? '' : 's'} held until the research desk writes the one sentence on why now; asked this run.`,
  note_failed: n => `${n} warm buyer${n === 1 ? '' : 's'} held: the desk's sentence on why now did not pass the fixed rules, so no email, and never a template in its place.`,
  desk_closed: n => `${n} warm buyer${n === 1 ? '' : 's'} held: the research desk is not open this run, so no note could be written.`,
  batch_full: n => `${n} more warm buyer${n === 1 ? '' : 's'} wait${n === 1 ? 's' : ''} for a later run: at most ${MONDAY_BATCH} a run.`,
  person_not_served: n => `${n} listed buyer${n === 1 ? '' : 's'} not written to: Control Center serves no person row or address for ${n === 1 ? 'them' : 'them'} yet (docs/GET-GOING.md 1.1b, \`features.advisory_people\`).`,
};

/**
 * The holds a run's warm buyers leave, counts and codes only: one line each
 * for a missing trigger, a note waiting or failing, a closed desk, a full
 * batch and a person Control Center does not serve yet (codes
 * `pilot_<reason>`), and every other reason someone listed is
 * not written to (a tier, the canon's gate, his answers, another row, Jonny,
 * a name, an address, a thin card) in one `pilot_not_eligible` line, so a
 * report's forty holds keep room for the rest. Pure.
 */
export function pilotHolds(held) {
  const by = new Map();
  for (const r of held) by.set(r, (by.get(r) ?? 0) + 1);
  const own = [...by].filter(([r]) => r in PILOT_WHY).sort(([a], [b]) => a.localeCompare(b)).map(([reason, n]) => ({ reason: `pilot_${reason}`, detail: PILOT_WHY[reason](n) }));
  const rest = [...by].filter(([r]) => !(r in PILOT_WHY)).sort(([a], [b]) => a.localeCompare(b));
  const n = rest.reduce((sum, [, k]) => sum + k, 0);
  return n ? [...own, { reason: 'pilot_not_eligible', detail: `${n} listed buyer and intro ask${n === 1 ? ' was' : 's were'} not written to this run (${rest.map(([r, k]) => `${r} ${k}`).join(', ')}).` }] : own;
}

/** The one activity line a run with listed buyers carries: counts only, never a name or an id. Null with none. Pure. */
export function pilotLine(counts) {
  if (!counts?.read) return null;
  return `Warm buyers (Advisory's listed buyer and intro asks, in Monday order): ${counts.read} read; ${counts.rows} written as REACH OUT notes for his own box, ${counts.waiting} waiting on the desk's note, ${counts.no_trigger} with no cited reason to write now (${counts.asked} asked for one this run).`;
}

/**
 * His Pipeline deals in detail, where Control Center serves them
 * (`features.deals_detail`, protocol 1.30.0; integration I-05): the open
 * deals in `records.deals` and the deals gone quiet in `records.stale_deals`
 * (Parked, or Closed Lost for Timing or Went quiet). Read tolerantly and
 * counted only: no catch-up is proposed from them yet. Null `stale_deals`, or
 * a `deals` part that is not a list, is unknown (coverage `deals`), never
 * none. Never reads a value, a company, notes or words: none is served. Pure.
 */
export function readDeals(context, features = {}) {
  if (features?.deals_detail !== true) return { served: false };
  const cov = (Array.isArray(context?.coverage) ? context.coverage : []).find(c => c?.source === 'deals') ?? null;
  const reason = typeof cov?.reason === 'string' ? cov.reason.slice(0, 60) : 'deals_unread';
  const deals = context?.records?.deals, stale = context?.records?.stale_deals;
  const valid = d => d && typeof d === 'object' && typeof d.contact_id === 'string' && d.contact_id;
  const count = list => {
    const ok = list.filter(valid);
    const people = new Set(ok.map(d => key(d.contact_id)));
    return { deals: ok.length, people: people.size, dropped: list.length - ok.length, dated: ok.filter(d => Number.isFinite(Date.parse(d.next_date ?? ''))).length };
  };
  const open = Array.isArray(deals) ? count(deals) : null;
  let quiet = null;
  if (Array.isArray(stale)) {
    const ok = stale.filter(valid);
    quiet = { ...count(stale), parked: ok.filter(d => /^parked$/i.test(String(d.stage ?? ''))).length };
    quiet.lost = quiet.deals - quiet.parked;
  }
  return { served: true, open, quiet, reason, complete: cov?.complete !== false };
}

/** One shadow line on his Pipeline deals, counts only, or null when the detail is not served. Pure. */
export function dealsLine(r, catchups = null) {
  if (!r?.served) return null;
  if (!r.open && !r.quiet) return `Deals: not read this run (${r.reason}), so none are assumed.`;
  const bad = n => (n ? `, ${n} did not parse and ${n === 1 ? 'is' : 'are'} left out` : '');
  const open = r.open ? `${r.open.deals} open with ${r.open.people} ${r.open.people === 1 ? 'person' : 'people'}, ${r.open.dated} with a next date${bad(r.open.dropped)}` : `open deals not read (${r.reason})`;
  const quiet = r.quiet ? `${r.quiet.deals} gone quiet (${r.quiet.parked} parked, ${r.quiet.lost} closed for timing or gone quiet)${bad(r.quiet.dropped)}` : `deals gone quiet not read (${r.reason}), so none are assumed`;
  // 5.13: the catch-ups this run proposed from the deals gone quiet, counted; a run that built no rows says so as before.
  const told = Number.isInteger(catchups) ? ` ${catchups} catch-up${catchups === 1 ? '' : 's'} proposed from them, each a morning draft for his send.` : ' No catch-up is proposed from them yet.';
  return `Deals, in shadow: ${open}; ${quiet}.${told}${r.complete ? '' : ' Control Center read only part of the Pipeline.'}`;
}
