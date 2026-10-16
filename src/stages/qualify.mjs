import { fresh, ageDays } from '../guards.mjs';

// Evidence makes a prospect relevant. Only a human can qualify a held conversation.
export function analyse(snapshot, policy, at) {
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
    const trigger = contact.buying_moment;
    if (!trigger || trigger.visibility !== 'public' || trigger.kind !== 'trigger' || !fresh(trigger, at, policy.limits.trigger_max_age_days)) {
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
    const required = [trigger, live.find(e => e.kind === 'person'), live.find(e => e.kind === 'company'), newValue].filter(Boolean);
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
