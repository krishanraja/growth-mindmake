import { fresh, ageDays, DAY } from '../guards.mjs';
import { canonBuyerTitle } from './canon.mjs';
import { pinnedCanonDrift, templateAskCurrent } from './draft.mjs';
import { shadowLine } from './visibility.mjs';

// Evidence makes a prospect relevant. Only a human can qualify a held conversation.
export function analyse(snapshot, policy, at, { warm_contexts = new Map() } = {}) {
  const eligible = [], held = [], research = [];
  const contacts = [...snapshot.contacts].sort((a, b) => a.id.localeCompare(b.id));
  for (const contact of contacts) {
    const hold = reason => held.push({ contact_id: contact.id, reason });
    if (contact.suppressed || contact.closed || contact.consent_status === 'blocked') { hold('suppressed_or_closed'); continue; }
    if (contact.last_touch_at && ageDays(contact.last_touch_at, at) < policy.limits.cooldown_days) { hold('contact_cooldown'); continue; }
    const buyerText = `${contact.title} ${contact.company}`.toLowerCase();
    if (snapshot.icp.exclusions.some(x => x && buyerText.includes(x.toLowerCase()))) { hold('excluded_by_current_buyer_definition'); continue; }
    if (snapshot.icp.buyer_titles.length && !snapshot.icp.buyer_titles.some(t => t.trim() && contact.title.toLowerCase().includes(t.toLowerCase()))) { hold('buyer_role_does_not_match_current_definition'); continue; }
    const deals = snapshot.deals.filter(d => d.contact_id === contact.id);
    const live = contact.evidence.filter(e => e.visibility === 'public' && fresh(e, at, policy.limits.evidence_max_age_days));
    const relationship = warm_contexts.get(contact.id);
    const publicTrigger = contact.buying_moment;
    const permittedRelationship = contact.relationship === 'warm' && relationship?.permitted_to_reference === true && relationship.kind === 'relationship' && typeof relationship.fact === 'string' && relationship.fact.trim() && fresh(relationship, at, policy.limits.trigger_max_age_days);
    const trigger = publicTrigger?.visibility === 'public' && publicTrigger.kind === 'trigger' && fresh(publicTrigger, at, policy.limits.trigger_max_age_days) ? publicTrigger : permittedRelationship ? relationship : null;
    if (!trigger) {
      hold('no_current_buying_moment'); research.push({ contact_id: contact.id, need: 'A specific current decision, with its original source and date. Enrichment alone is not a reason to approach.' }); continue;
    }
    if (!live.some(e => e.kind === 'person') || !live.some(e => e.kind === 'company')) {
      hold('person_and_company_evidence_needed'); research.push({ contact_id: contact.id, need: 'Verify the right person and company independently, with current sources.' }); continue;
    }
    let offer = contact.offer_fit;
    let fit = contact.why_fit;
    if (offer === 'unknown') {
      const phrase = `${trigger.fact} ${contact.why_fit}`;
      const matchedBuyer = snapshot.icp.buyer_titles.some(title => title.trim() && contact.title.toLowerCase().includes(title.toLowerCase()));
      if (!matchedBuyer || snapshot.icp.exclusions.some(x => x && `${contact.title} ${contact.company}`.toLowerCase().includes(x.toLowerCase()))) { hold('buyer_fit_unresolved'); continue; }
      if (/pricing|positioning|go.to.market|revenue|commercial|product launch/i.test(phrase)) offer = 'revenue_engine';
      else if (/judgement|judgment|decision|chief of staff|AI brain|personal AI/i.test(phrase)) offer = 'brain';
      else { hold('offer_fit_unresolved'); continue; }
      fit = `Working hypothesis from the sourced decision: ${offer === 'brain' ? 'a system for the leader\'s judgement' : 'an AI revenue decision'}. Confirm this with the leader.`;
    }
    if (!fit.trim()) { hold('missing_relevance_explanation'); continue; }
    let mode = contact.connector && !contact.connector.both_opted_in ? 'intro' : contact.relationship === 'warm' ? 'warm' : 'cold';
    if (mode === 'intro') {
      const connector = snapshot.contacts.find(c => c.id === contact.connector.contact_id);
      if (!connector || connector.suppressed || connector.closed || connector.consent_status === 'blocked' || connector.relationship === 'cold' || (connector.last_touch_at && ageDays(connector.last_touch_at, at) < policy.limits.cooldown_days)) { hold('connector_permission_unresolved'); continue; }
      if (connector.full_name !== contact.connector.full_name) { hold('connector_identity_conflict'); continue; }
      if (snapshot.deals.some(d => d.contact_id === connector.id)) { hold('connector_has_existing_action'); continue; }
    }
    const lastSent = deals.filter(d => d.sent_at).sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at))[0];
    let newValue;
    if (deals.length) {
      if (deals.some(d => d.replied_at || d.call_taken_at || d.pilot_paid_at || ['not_now','pilot_booked','pilot_paid'].includes(d.state))) { hold('existing_relationship_action_owned_in_control_center'); continue; }
      newValue = live.find(e => e.kind === 'new_value' && lastSent && Date.parse(e.observed_at) > Date.parse(lastSent.sent_at));
      if (!lastSent || ageDays(lastSent.sent_at, at) < policy.limits.cooldown_days || !newValue || (lastSent.follow_up_count ?? 0) >= policy.limits.max_follow_ups) { hold('existing_deal_or_no_new_follow_up_value'); continue; }
      mode = 'follow_up';
    } else if (contact.last_touch_at && ageDays(contact.last_touch_at, at) < policy.limits.cooldown_days) { hold('contact_cooldown'); continue; }
    if (!policy.motions.includes(mode)) { hold('motion_disabled'); continue; }
    const required = [trigger.visibility === 'public' ? trigger : null, live.find(e => e.kind === 'person'), live.find(e => e.kind === 'company'), newValue].filter(Boolean);
    const evidence = [...new Map([...required, ...live].map(e => [e.id, e])).values()].slice(0, 20);
    eligible.push({ contact, trigger, evidence, newValue, offer, why_fit: fit, mode, permission_review_required: contact.consent_status !== 'allowed' });
  }
  // Warm paths precede cold only after a current buying moment passes the same gate.
  const priority = { intro: 0, warm: 1, follow_up: 2, cold: 3 };
  eligible.sort((a, b) => priority[a.mode] - priority[b.mode] || Date.parse(b.trigger.observed_at) - Date.parse(a.trigger.observed_at) || a.contact.id.localeCompare(b.contact.id));
  const selected = [], recipients = new Set();
  for (const c of eligible) { const recipient = c.mode === 'intro' ? c.contact.connector.contact_id : c.contact.id; if (recipients.has(recipient)) { held.push({ contact_id: c.contact.id, reason: 'recipient_already_selected' }); continue; } recipients.add(recipient); selected.push(c); }
  return { eligible: selected.slice(0, policy.limits.recommendations_per_run), held, research, deferred_by_budget: Math.max(0, selected.length - policy.limits.recommendations_per_run) };
}

// ── The legacy ingest gate's strategy (plan section 12, M12) ───────────────
// Moved out of Control Center (Ruling, Krish, 2026-10-27). Ported from:
//   api/_mindmakeGrowth.ts contactEvidence: what counts as a buying moment.
//     A published post (a LinkedIn post or update, or an X status) whose
//     stance scores 65 or more in api/_intent.ts STANCE_VALUE, inside 30
//     days; anything else it says about the person or the company inside 90
//     days. The engine keeps the source and the windows, and counts as a
//     buying moment only a stance one of the canon's best-fit moments
//     supports (buyingStances), read live.
//   api/_mindmakeGrowth.ts prepare: the buyer-title rules. Control Center
//     matches a title against product_icp's buyer titles and its "who not"
//     line (ccBuyerTitle, ported for the comparison); the engine's buyer is
//     the canon's own groups (canonBuyerTitle in canon.mjs). analyse() above
//     already holds every other gate prepare() rechecks.
//   api/_mindmakeGrowthContract.ts APPROVED_CANON: the offer copy, checked
//     against the canon in draft.mjs (pinnedCanonDrift).
// What stays in Control Center: the records and their snapshot, the consent
// and suppression walls, the warm-path richness check (knowsEnough), the
// stance classifier that reads each post, product_icp, which Krish edits,
// and the ingest route itself.

/** api/_intent.ts STANCE_VALUE: how much each published stance says about a live need. */
export const CC_STANCE_VALUE = Object.freeze({ asking: 90, struggling: 85, hiring: 70, evaluating: 65, building: 55, teaching: 35, commenting: 12, selling: 8 });
/** api/_mindmakeGrowth.ts contactEvidence: a stance at or above this is a buying moment. */
export const CC_TRIGGER_FLOOR = 65;
/** api/_mindmakeGrowth.ts contactEvidence: a published post, as its source must look. */
export const PUBLIC_POST = /^https:\/\/(?:www\.)?(?:linkedin\.com\/(?:posts|feed\/update)|(?:x|twitter)\.com\/[^/]+\/status)\//i;
/** api/_mindmakeGrowth.ts recent: a buying moment is current for 30 days, other evidence for 90. */
export const MOMENT_DAYS = 30;
export const EVIDENCE_DAYS = 90;
/** Each stance, and the canon best-fit moment that would make it a reason to write now. A stance with none is never a buying moment for the engine. */
const STANCE_MOMENT = Object.freeze({
  asking: /\bknows something is wrong\b|\bholding it back\b/i,
  struggling: /\bknows something is wrong\b/i,
  evaluating: /\bAI has changed\b/i,
});

/** api/_mindmakeGrowth.ts recent: inside the window and not in the future. Pure. */
export function recentEnough(posted, at, days) {
  const t = Date.parse(posted ?? ''), now = Date.parse(at);
  return Number.isFinite(t) && t <= now && now - t <= days * DAY;
}

/** Control Center's rule as it is (api/_mindmakeGrowth.ts contactEvidence): a post's stance at the floor or above, from a published post, inside 30 days. Pure. */
export function ccBuyingMoment({ stance, url, posted }, at) {
  return typeof url === 'string' && PUBLIC_POST.test(url) && recentEnough(posted, at, MOMENT_DAYS) && (CC_STANCE_VALUE[stance] ?? 0) >= CC_TRIGGER_FLOOR;
}

/** The stances the canon's best-fit moments support today, read live. Pure. */
export function buyingStances(buyer) {
  const moments = Array.isArray(buyer?.moments) ? buyer.moments : [];
  return Object.keys(STANCE_MOMENT).filter(s => moments.some(m => STANCE_MOMENT[s].test(m)));
}

/** The engine's rule: Control Center's source and window, and a stance one of the canon's moments supports. Null when the canon's buyer is not read. Pure. */
export function buyingMoment({ stance, url, posted }, { at, buyer }) {
  if (!buyer) return null;
  return typeof url === 'string' && PUBLIC_POST.test(url) && recentEnough(posted, at, MOMENT_DAYS) && buyingStances(buyer).includes(stance);
}

/**
 * api/_mindmakeGrowth.ts prepare, its buyer rules: with no buyer defined (no
 * "who" line or no titles) nothing passes; a title must contain one of the
 * defined titles; a title or company containing the "who not" line is
 * excluded. Returns Control Center's hold code, or null when it passes. Pure.
 */
export function ccBuyerTitle(contact, icp) {
  const titles = Array.isArray(icp?.buyer_titles) ? icp.buyer_titles.filter(t => typeof t === 'string' && t.trim()) : [];
  const who = icp?.definition ?? icp?.who;
  if (icp?.defined !== true || typeof who !== 'string' || !who.trim() || !titles.length) return 'buyer_definition_or_context_unavailable';
  const title = String(contact?.title ?? '').toLowerCase();
  if (!titles.some(t => title.includes(t.toLowerCase()))) return 'buyer_title_outside_current_definition';
  const not = (Array.isArray(icp.exclusions) ? icp.exclusions : [icp.who_not]).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().toLowerCase());
  if (not.some(x => `${contact?.title ?? ''} ${contact?.company ?? ''}`.toLowerCase().includes(x))) return 'buyer_excluded_by_current_definition';
  return null;
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * The legacy ingest gate in shadow, over the snapshot Control Center builds
 * for it (the context's work_context): for every contact, whether the canon's
 * buyer groups agree with Control Center's buyer titles; how many buying
 * moments Control Center calls current and how many of those keep their
 * source and window this run (the stance itself is not served); and how
 * many pinned offer fields the canon still supports. Counts and codes only.
 * Nothing is held, hidden or changed. Pure.
 */
export function qualifyShadow({ context, canon = null, at }) {
  const snap = context?.work_context?.snapshot ?? null;
  const contacts = [], seen = new Set();
  for (const c of Array.isArray(snap?.contacts) ? snap.contacts : []) {
    if (typeof c?.id !== 'string' || seen.has(c.id)) continue;
    seen.add(c.id);
    contacts.push(c);
  }
  const buyer = canon?.buyer ?? null, differ = {}, apart = {}, verdicts = [];
  let agree = 0, moments = 0, kept = 0;
  for (const c of contacts) {
    const reason = ccBuyerTitle(c, snap.icp);
    const mine = c.title && c.title !== 'Role not recorded' ? canonBuyerTitle(c.title, buyer) : null;
    let code = null;
    if (reason === 'buyer_definition_or_context_unavailable') code = 'icp_not_defined';
    else if (!buyer) code = 'buyer_not_in_canon';
    else if (mine === null) code = 'title_not_served';
    if (code) bump(apart, code);
    else if (mine === (reason === null)) agree++;
    else { code = mine ? (reason === 'buyer_excluded_by_current_definition' ? 'canon_buyer_excluded_by_icp' : 'canon_buyer_outside_icp_titles') : 'icp_title_outside_canon_groups'; bump(differ, code); }
    const m = c.buying_moment;
    if (m) { moments++; if (typeof m.url === 'string' && PUBLIC_POST.test(m.url) && recentEnough(m.observed_at, at, MOMENT_DAYS)) kept++; }
    verdicts.push({ subject_ref: `contact:${c.id}`, canon_buyer: mine, control_center: reason === null, agrees: code === null ? true : code in differ ? false : null, code });
  }
  const stances = buyer ? buyingStances(buyer) : null;
  const drift = pinnedCanonDrift(snap?.canon ?? null, canon);
  const ask = templateAskCurrent(canon);
  const tail = ` Buying moments: Control Center calls ${moments} current, ${kept} keep their source and window this run (the stance is not served)${stances ? `; the canon supports ${stances.length} of the ${Object.keys(CC_STANCE_VALUE).filter(s => CC_STANCE_VALUE[s] >= CC_TRIGGER_FLOOR).length} stances it counts` : ''}.`
    + (drift === null ? ' Pinned offer copy: not compared this run.' : ` Pinned offer copy: ${4 - drift.length} of 4 fields match the canon read live${drift.length ? ` (${drift.join(', ')})` : ''}${ask === false ? "; the outreach template's ask is not the canon's" : ''}.`);
  const line = shadowLine('Ingest gate', ['contact', 'contacts'], { read: contacts.length, agree, differ, apart }) + tail;
  return { verdicts, line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
