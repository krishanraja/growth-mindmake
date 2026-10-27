import { DAY } from '../guards.mjs';
import { canonBuyerTitle, offerFindings } from './canon.mjs';
import { shadowLine } from './visibility.mjs';

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
 * model call, enrichment, Rule 2's wall (the warm-path index and knowsEnough),
 * the Gmail draft executor and the Monday cron that runs it.
 *
 * Pure: no model, no network, no clock but the run's.
 */

/** api/pilot-deals/monday.ts BATCH: five approaches drafted each Monday. */
export const MONDAY_BATCH = 5;
/** api/_focus.ts PIPELINE_ASK_KINDS: the Advisory rows that are a Mindmake approach; a focus row (a podcast pitch, a show invite, press, a catch-up) is not. */
export const PIPELINE_ASK_KINDS = Object.freeze(['buyer', 'intro', 'collaborator']);
/** src/lib/pilotDealsHunter.ts HUNTER_CARD_PREFIX: a listed row whose notes begin with this is a door-in card whose opening line was already checked. */
export const HUNTER_CARD_PREFIX = 'hunter door-in:';
/** api/pilot-deals/seed.ts TIERS: candidates come from his two closest tiers only. */
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
