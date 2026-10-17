import { parseMotionJob } from '../../contracts/motions.ts';
import { analyse } from './qualify.mjs';
import { prepare } from './draft.mjs';
import { clean, fresh, ageDays, stable, validateContext } from '../guards.mjs';

const hold = reason => ({ hold: reason });
function permittedSources(d, at, policy) { return d.sources.every(s => fresh(s, at, policy.limits.evidence_max_age_days)); }
function current(value, at, days = 30) { const age = ageDays(value, at); return Number.isFinite(age) && age >= 0 && age <= days; }
function renderAid(a, sources) {
  const facts = a.evidence_ids.map(id => sources.find(s => s.id === id));
  return `DECISION\n${clean(a.question)}\n\nWHAT CHANGED\n${facts.map(s => clean(s.fact)).join('\n')}\n\nOPTIONS\n${a.options.map(o => `${clean(o.label)}: ${clean(o.benefit)} Cost: ${clean(o.cost)}`).join('\n')}\n\nTRADE-OFF\n${clean(a.tradeoff)}\n\nSMALL TEST\n${clean(a.test)}\n\nWHAT WOULD CHANGE THE CHOICE\n${clean(a.disconfirming)}\n\nBOUNDARY\nThis is an illustrative comparison to test against the real decision. Public sources cannot establish internal priorities, authority or results.\n\nSOURCES\n${facts.map(s => `${s.observed_at.slice(0, 10)} | ${s.url}`).join('\n')}`;
}
function publicAid(d) { return d.decision_aid.evidence_ids.every(id => d.sources.find(s => s.id === id)?.visibility === 'public'); }
function output(kind, title, body, sources, recipient, channel, destination, closure, notes = [], permittedPrivateIds = []) {
  const evidenceIds = [...new Set(sources.map(s => s.id))].sort();
  if (evidenceIds.length > 20) return hold('motion_evidence_budget_exceeded');
  const reviewNotes = ['Draft only. Krish must approve the exact artifact, recipient, channel and action.', ...notes].flatMap(note => note.match(/[\s\S]{1,2000}/g) ?? []);
  if (body.length > 20000 || reviewNotes.length > 20) return hold('motion_artifact_budget_exceeded');
  if (sources.some(s => s.visibility === 'private' && !permittedPrivateIds.includes(s.id) && clean(s.fact).length >= 10 && clean(body).includes(clean(s.fact)))) return hold('private_source_content_not_cleared');
  return { artifact: { kind, title: clean(title).slice(0, 200), body, internal_notes: reviewNotes, evidence_ids: evidenceIds, recipient_contact_id: recipient, channel, destination, closure_event: closure } };
}
function sourceConflict(sources, snapshot) { const canonical = snapshot.contacts.flatMap(c => [...c.evidence, ...(c.buying_moment ? [c.buying_moment] : [])]); return sources.some(s => canonical.some(c => s.id === c.id && stable(s) !== stable(c))); }
function eligibleContact(c) { return c && !c.suppressed && !c.closed && c.consent_status === 'allowed'; }

/** Produces review artifacts; it never sends, publishes or records an outcome. */
export function prepareMotion(value, input, policy, at) {
  const job = parseMotionJob(value), snapshot = validateContext(input, policy, at), d = job.details;
  if (!permittedSources(d, at, policy)) return hold('motion_source_stale_or_future');
  if (sourceConflict(d.sources, snapshot)) return hold('motion_source_identity_conflict');
  if (d.decision_aid && !publicAid(d)) return hold('decision_aid_requires_public_sources');
  if (job.kind === 'outreach') {
    const c = snapshot.contacts.find(c => c.id === job.contact_id);
    if (!c) return hold('contact_not_in_current_snapshot');
    if (!eligibleContact(c)) return hold('contact_permission_or_suppression_hold');
    const contexts = new Map();
    if (d.mode === 'warm') {
      const context = d.relationship_context, source = context && d.sources.find(s => s.id === context.source_id);
      if (c.relationship !== 'warm' || !context?.permitted_to_reference || source?.kind !== 'relationship' || source.fact !== context.summary || source.observed_at !== context.observed_at || !current(context.observed_at, at, policy.limits.trigger_max_age_days)) return hold('warm_relationship_context_not_cleared');
      contexts.set(c.id, { ...source, permitted_to_reference: true });
    } else if (d.relationship_context !== null) return hold('relationship_context_wrong_scope');
    const analysis = analyse({ ...snapshot, contacts: [c, ...snapshot.contacts.filter(x => x.id !== c.id && x.id === c.connector?.contact_id)] }, policy, at, { warm_contexts: contexts });
    const candidate = analysis.eligible.find(x => x.contact.id === c.id);
    if (!candidate) return hold(analysis.held.find(x => x.contact_id === c.id)?.reason ?? 'outreach_not_eligible');
    const expected = d.mode === 'named_cold' ? 'cold' : d.mode;
    if (candidate.mode !== expected) return hold(candidate.mode === 'intro' ? 'introduction_job_required' : 'outreach_route_changed');
    const reasonSource = d.mode === 'named_cold' ? candidate.trigger : d.mode === 'follow_up' ? candidate.newValue : null;
    if (reasonSource && !d.decision_aid.evidence_ids.includes(reasonSource.id)) return hold('decision_aid_missing_current_reason_source');
    const base = prepare(candidate, snapshot.canon), first = clean(c.full_name).split(' ')[0];
    const observation = d.mode === 'warm' ? clean(d.relationship_context.summary) : d.mode === 'follow_up' ? `One useful addition to the earlier note: ${clean(candidate.newValue.fact)}` : clean(candidate.trigger.fact);
    const framing = d.mode === 'named_cold' ? `Outside-in hypothesis: ${clean(d.hypothesis)}\nAn alternative explanation: ${clean(d.alternative)}` : `A possible next decision: ${clean(d.hypothesis)}\nThe alternative worth keeping open: ${clean(d.alternative)}`;
    const body = `${first}, ${observation}\n\n${framing}\n\n${clean(d.decision_aid.question)}\n${d.decision_aid.options.map(o => `${clean(o.label)}: ${clean(o.benefit)} Cost: ${clean(o.cost)}`).join('\n')}\n\nA reversible test: ${clean(d.decision_aid.test)}\nWhat would change the choice: ${clean(d.decision_aid.disconfirming)}\n\nWould a short comparison of these two options be useful?`;
    if (d.mode === 'named_cold' && (body.match(/https?:\/\/\S+/g) ?? []).length > 1) return hold('cold_note_link_budget_exceeded');
    return output('outreach_draft', base.draft.subject, body, [...base.evidence, ...d.sources], c.id, d.channel, 'growth', 'outreach_sent', [`Sender voice: ${d.sender}.`, 'An explicit job selects this individual action. A draft does not establish consent or a completed conversation.', `Decision aid for separate review and permission to share:\n${renderAid(d.decision_aid, d.sources)}`, ...(d.mode === 'warm' ? ['Relationship context is cleared only for this named recipient. Do not forward it or reuse it publicly.'] : [])], d.mode === 'warm' ? [d.relationship_context.source_id] : []);
  }
  if (job.kind === 'trust') {
    const surface = d.sources.find(s => s.id === d.surface.source_id);
    if (!d.rights.cleared || !current(d.rights.cleared_at, at) || !current(d.surface.verified_at, at) || surface.visibility !== 'public' || !current(surface.observed_at, at)) return hold('trust_surface_or_rights_unverified');
    for (const claim of d.claims) {
      const source = d.sources.find(s => s.id === claim.source_id), speaksAsOwner = /\b(I|my|we|our)\b/i.test(claim.text);
      if (source.visibility !== 'public' || source.fact !== claim.text) return hold('trust_claim_not_publicly_supported');
      if ((claim.first_person || speaksAsOwner) && (d.format === 'commentary' || !claim.first_person || !claim.owned)) return hold('trust_first_person_claim_unearned');
      if (d.format === 'practice_post' && /\b(I|my)\b/i.test(claim.text)) return hold('trust_sender_voice_conflict');
    }
    const label = d.format === 'commentary' ? 'EXTERNAL COMMENTARY' : d.format === 'founder_post' ? 'FOUNDER DRAFT' : 'MINDMAKE PRACTICE DRAFT';
    return output('trust_asset', d.decision_aid.question, `${label}\n\n${d.claims.map(c => clean(c.text)).join('\n\n')}\n\n${renderAid(d.decision_aid, d.sources)}`, d.sources, null, 'publication', 'editorial', 'trust_asset_published', [`Verified surface: ${d.surface.account_id} / ${d.surface.surface}. No publication or audience growth is claimed.`]);
  }
  if (job.kind === 'speaking') {
    const contact = snapshot.contacts.find(c => c.id === job.contact_id);
    if (!eligibleContact(contact)) return hold('host_contact_permission_or_suppression_hold');
    if (contact.last_touch_at && ageDays(contact.last_touch_at, at) < policy.limits.cooldown_days) return hold('host_contact_cooldown');
    if (snapshot.deals.some(x => x.contact_id === contact.id)) return hold('host_existing_action_requires_lifecycle');
    if (Date.parse(d.deadline_at) < Date.parse(at) || Date.parse(d.event_at) <= Date.parse(at) || Date.parse(d.deadline_at) > Date.parse(d.event_at)) return hold('speaking_opportunity_expired_or_incoherent');
    if (!d.submission.allows_pitch) return hold('speaking_submission_not_permitted');
    const required = ['programme_source_id','rules_source_id','audience_source_id'].map(k => d.sources.find(s => s.id === d[k]));
    if (required.some(s => s.visibility !== 'public' || new URL(s.url).origin !== d.first_party_origin || !current(s.observed_at, at))) return hold('speaking_first_party_programme_rules_needed');
    const identity = clean(d.programme).toLowerCase();
    if (!required[0].fact.toLowerCase().includes(identity) || !required[0].fact.includes(d.event_at.slice(0, 10)) || !required[1].fact.toLowerCase().includes(identity) || !required[1].fact.includes(d.deadline_at.slice(0, 10))) return hold('speaking_programme_dates_not_grounded');
    const proof = d.sources.find(s => s.id === d.proof.source_id);
    if (!d.proof.cleared || proof.visibility !== 'public' || proof.fact !== d.proof.claim) return hold('speaking_proof_not_cleared');
    const body = `${clean(contact.full_name).split(' ')[0]},\n\nFor ${clean(d.programme)}, one useful audience decision could be: ${clean(d.audience_decision)}\n\n${clean(d.angle)}\n\n${d.outline.map((line, i) => `${i + 1}. ${clean(line)}`).join('\n')}\n\nCleared evidence: ${clean(d.proof.claim)}\n\nWould this argument fit your programme?`;
    return output('speaking_pitch', `${d.programme}: ${d.audience_decision}`, body, d.sources, contact.id, 'email', 'growth', 'speaking_pitch_submitted', ['Host-only scope. An invitation or attendance never consents audience members to outreach.', 'No fee, availability, audience access or recording permission has been approved.']);
  }
  if (!d.rights.cleared || !d.privacy_review.cleared || !current(d.rights.cleared_at, at) || !current(d.privacy_review.reviewed_at, at)) return hold('practice_rights_or_privacy_review_needed');
  return output('decision_aid', d.title, renderAid(d.decision_aid, d.sources), d.sources, null, 'publication', 'editorial', 'decision_aid_published', ['Reusable public comparison. Private facts and recipient context are excluded.']);
}
