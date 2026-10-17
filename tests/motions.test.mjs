import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMotionJob } from '../contracts/motions.ts';
import { prepareMotion } from '../src/stages/motions.mjs';
import { AT, POLICY, snapshot, contact, evidence, copy } from './helpers.mjs';

function decisionAid(ids = ['trigger-buyer-a']) {
  return { question: 'Should this leader retain current pricing or test one buyer assumption?', options: [{ label: 'Retain current pricing', benefit: 'Keeps a stable comparison', cost: 'May miss changed buyer expectations' }, { label: 'Test one buyer assumption', benefit: 'Gets evidence before a wider change', cost: 'A small sample can mislead' }], tradeoff: 'Retain current pricing unless a bounded buyer test shows a clear difference.', test: 'Compare five buyer reactions to one changed assumption; stop after five and review the evidence.', disconfirming: 'Inconsistent reactions or a lower-quality buyer sample means retain current pricing.', evidence_ids: ids };
}
function source(id, fact = `Synthetic ${id}`, changes = {}) { return evidence('company', { id, fact, ...changes }); }
function outreach(changes = {}) {
  const c = contact();
  return { id: 'job-outreach', kind: 'outreach', contact_id: c.id, source_id: c.buying_moment.id, due_at: null, details: { mode: 'named_cold', sender: 'founder', channel: 'email', hypothesis: 'A buyer test may help with the announced pricing decision.', alternative: 'The current price may already serve this market well.', decision_aid: decisionAid(), sources: [...c.evidence, c.buying_moment], relationship_context: null }, ...changes };
}
function practice() {
  return { id: 'job-practice', kind: 'practice', contact_id: null, source_id: 'practice-source', due_at: null, details: { title: 'A reversible pricing comparison', decision_aid: decisionAid(['practice-source']), privacy_review: { cleared: true, source_id: 'privacy-review', reviewed_at: '2026-10-16T12:00:00Z' }, rights: { cleared: true, source_id: 'rights-review', cleared_at: '2026-10-16T12:00:00Z', placement: 'practice_asset' }, sources: [source('practice-source', 'A public buyer study compared two pricing approaches.'), source('privacy-review', 'This reusable comparison contains no private case details.', { visibility: 'private' }), source('rights-review', 'This practice placement is cleared.', { visibility: 'private' })] } };
}
function trust() {
  const j = practice();
  return { ...j, id: 'job-trust', kind: 'trust', details: { format: 'commentary', surface: { account_id: 'synthetic-publication', surface: 'publication', source_id: 'surface-source', verified_at: '2026-10-16T12:00:00Z' }, rights: { ...j.details.rights, placement: 'commentary' }, claims: [{ text: j.details.sources[0].fact, source_id: 'practice-source', first_person: false, owned: false }], decision_aid: j.details.decision_aid, sources: [...j.details.sources, source('surface-source', 'The intended publication surface was independently verified.')] } };
}
function speaking() {
  const programme = source('programme', 'Example leadership forum takes place on 2026-11-02 and covers leadership pricing decisions.'); programme.url = 'https://events.example.com/programme';
  const rules = source('rules', 'Example leadership forum accepts individual email pitches before the 2026-10-23 deadline.'); rules.url = 'https://events.example.com/rules';
  const audience = source('audience', 'The programme serves leaders responsible for pricing.'); audience.url = 'https://events.example.com/audience';
  const proof = source('cleared-proof', 'A public worked comparison explains a reversible pricing test.');
  return { id: 'job-speaking', kind: 'speaking', contact_id: 'buyer-a', source_id: 'programme', due_at: null, details: { host: 'Example host', programme: 'Example leadership forum', first_party_origin: 'https://events.example.com', programme_source_id: 'programme', rules_source_id: 'rules', audience_source_id: 'audience', event_at: '2026-11-02T12:00:00Z', deadline_at: '2026-10-23T12:00:00Z', submission: { channel: 'email', allows_pitch: true, contact_scope: 'host_only' }, audience_decision: 'Which pricing assumption deserves a bounded buyer test?', angle: 'Show how to compare a current price with one reversible test without pretending a small sample proves demand.', outline: ['Frame a falsifiable pricing assumption.', 'Compare the trade-off and stop rule.'], proof: { claim: proof.fact, source_id: proof.id, cleared: true, placement: 'host_pitch' }, sources: [programme, rules, audience, proof] } };
}

test('an explicitly selected named cold job produces a bounded hypothesis and fair concrete decision aid', () => {
  const result = prepareMotion(outreach(), snapshot(), POLICY, AT);
  assert.equal(result.artifact.kind, 'outreach_draft'); assert.equal(result.artifact.recipient_contact_id, 'buyer-a');
  assert.match(result.artifact.body, /Outside-in hypothesis/); assert.match(result.artifact.body, /An alternative explanation/);
  assert.match(result.artifact.body, /Retain current pricing/); assert.match(result.artifact.body, /stop after five/); assert.match(result.artifact.body, /Inconsistent reactions/);
  assert.equal(result.artifact.closure_event, 'outreach_sent'); assert.equal(result.artifact.channel, 'email');
  assert.ok(result.artifact.internal_notes.some(s => /Draft only/.test(s)));
});

test('outreach reuses current suppression, ICP, cooling and existing-deal gates', () => {
  for (const [changes, reason] of [[{ suppressed: true }, 'contact_permission_or_suppression_hold'], [{ consent_status: 'unknown' }, 'contact_permission_or_suppression_hold'], [{ title: 'Unrelated role' }, 'buyer_role_does_not_match_current_definition'], [{ last_touch_at: '2026-10-15T13:00:00Z' }, 'contact_cooldown']]) {
    assert.equal(prepareMotion(outreach(), snapshot({ contacts: [contact('buyer-a', changes)] }), POLICY, AT).hold, reason);
  }
  assert.equal(prepareMotion(outreach(), snapshot({ deals: [{ id: 'existing', contact_id: 'buyer-a', state: 'replied', replied_at: '2026-10-15T12:00:00Z' }] }), POLICY, AT).hold, 'existing_relationship_action_owned_in_control_center');
});

test('a current permitted warm exchange works without a public buying announcement and stays recipient scoped', () => {
  const context = evidence('relationship', { id: 'private-exchange', visibility: 'private', fact: 'You asked which pricing assumption to test next.' });
  const c = contact('buyer-a', { relationship: 'warm', buying_moment: undefined });
  const j = outreach(); j.source_id = context.id; j.details.mode = 'warm'; j.details.sources.push(context); j.details.relationship_context = { summary: context.fact, source_id: context.id, observed_at: context.observed_at, permitted_to_reference: true };
  const result = prepareMotion(j, snapshot({ contacts: [c] }), POLICY, AT);
  assert.ok(result.artifact); assert.match(result.artifact.body, /You asked which pricing assumption/); assert.doesNotMatch(result.artifact.body, /private-exchange/);
  assert.ok(result.artifact.internal_notes.some(s => /Do not forward/.test(s))); assert.equal(result.artifact.recipient_contact_id, c.id);
  j.details.relationship_context.permitted_to_reference = false;
  assert.equal(prepareMotion(j, snapshot({ contacts: [c] }), POLICY, AT).hold, 'warm_relationship_context_not_cleared');
});

test('warm context cannot invent familiarity, change its source fact or leak into cold scope', () => {
  const j = outreach(), context = evidence('relationship', { id: 'relationship', visibility: 'private', fact: 'A private exchange.' });
  j.details.sources.push(context); j.details.mode = 'warm'; j.details.relationship_context = { summary: 'A fabricated familiar exchange.', source_id: context.id, observed_at: context.observed_at, permitted_to_reference: true };
  assert.equal(prepareMotion(j, snapshot({ contacts: [contact('buyer-a', { relationship: 'warm' })] }), POLICY, AT).hold, 'warm_relationship_context_not_cleared');
  j.details.mode = 'named_cold';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'relationship_context_wrong_scope');
});

test('follow-up requires actual prior send, elapsed cooldown and genuinely new sourced value', () => {
  const j = outreach(); j.details.mode = 'follow_up';
  const newValue = evidence('new_value', { id: 'new-value', fact: 'A new public comparison changes the pricing test.', observed_at: '2026-10-15T12:00:00Z' });
  j.details.sources.push(newValue); j.details.decision_aid.evidence_ids = [newValue.id];
  const c = contact('buyer-a', { evidence: [...contact().evidence, newValue] });
  const s = snapshot({ contacts: [c], deals: [{ id: 'sent', contact_id: c.id, state: 'sent', sent_at: '2026-09-29T12:00:00Z', follow_up_count: 0 }] });
  const result = prepareMotion(j, s, POLICY, AT); assert.ok(result.artifact); assert.match(result.artifact.body, /new public comparison/);
  s.deals[0].follow_up_count = 1; assert.equal(prepareMotion(j, s, POLICY, AT).hold, 'existing_deal_or_no_new_follow_up_value');
  s.deals = []; assert.equal(prepareMotion(j, s, POLICY, AT).hold, 'outreach_route_changed');
});

test('motion evidence cannot rebind canonical identities or turn private evidence into a public aid', () => {
  const j = outreach(); j.details.sources[0].fact = 'A different person fact under the same ID.';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'motion_source_identity_conflict');
  const p = practice(); p.details.sources[0].visibility = 'private';
  assert.equal(prepareMotion(p, snapshot(), POLICY, AT).hold, 'decision_aid_requires_public_sources');
});

test('a public practice aid needs current placement rights and privacy clearance, with useful alternatives', () => {
  const j = practice(), result = prepareMotion(j, snapshot(), POLICY, AT);
  assert.equal(result.artifact.destination, 'editorial'); assert.equal(result.artifact.recipient_contact_id, null); assert.match(result.artifact.body, /TRADE-OFF/); assert.doesNotMatch(result.artifact.body, /This practice placement is cleared/);
  j.details.privacy_review.cleared = false; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'practice_rights_or_privacy_review_needed');
  j.details.privacy_review.cleared = true; j.details.rights.cleared_at = '2026-08-01T12:00:00Z'; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'practice_rights_or_privacy_review_needed');
});

test('trust commentary is labelled, sourced, surface checked and never becomes an invented lived claim', () => {
  const j = trust(), result = prepareMotion(j, snapshot(), POLICY, AT);
  assert.match(result.artifact.body, /^EXTERNAL COMMENTARY/); assert.equal(result.artifact.closure_event, 'trust_asset_published');
  j.details.claims[0].text = 'I built this system for a client.'; j.details.sources[0].fact = j.details.claims[0].text;
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'trust_first_person_claim_unearned');
  j.details.format = 'founder_post'; j.details.rights.placement = 'founder_post'; j.details.claims[0].first_person = true; j.details.claims[0].owned = true;
  assert.ok(prepareMotion(j, snapshot(), POLICY, AT).artifact);
  j.details.surface.verified_at = '2026-08-01T12:00:00Z'; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'trust_surface_or_rights_unverified');
});

test('trust claims require exact sourced wording and explicit proof ownership for first person', () => {
  const j = trust(); j.details.claims[0].text = 'An unsupported outcome.';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'trust_claim_not_publicly_supported');
  j.details.claims[0].text = j.details.sources[0].fact; j.details.claims[0].first_person = true;
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'trust_first_person_claim_unearned');
});

test('speaking prepares a single host pitch from a live first-party programme without audience or payment promises', () => {
  const result = prepareMotion(speaking(), snapshot(), POLICY, AT);
  assert.equal(result.artifact.recipient_contact_id, 'buyer-a'); assert.equal(result.artifact.channel, 'email'); assert.match(result.artifact.body, /Would this argument fit your programme\?/); assert.match(result.artifact.internal_notes.join(' '), /Host-only scope/);
  assert.equal(result.artifact.closure_event, 'speaking_pitch_submitted');
  assert.doesNotMatch(result.artifact.body, /No fee, availability/); assert.match(result.artifact.internal_notes.join(' '), /No fee, availability/);
});

test('a new input date cannot freshen an old or unrelated first-party programme', () => {
  const j = speaking(); j.details.event_at = '2026-11-03T12:00:00Z';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_programme_dates_not_grounded');
  j.details.event_at = '2026-11-02T12:00:00Z'; j.details.deadline_at = '2026-10-24T12:00:00Z';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_programme_dates_not_grounded');
  j.details.deadline_at = '2026-10-23T12:00:00Z'; j.details.sources[0].fact = 'A different forum takes place on 2026-11-02.';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_programme_dates_not_grounded');
  j.details.sources[0].fact = 'Example leadership forum has a programme with no dated event evidence.';
  assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_programme_dates_not_grounded');
});

test('expired, off-domain, forbidden or suppressed host opportunities hold before creating a pitch', () => {
  const j = speaking(); j.details.deadline_at = '2026-10-15T12:00:00Z'; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_opportunity_expired_or_incoherent');
  j.details.deadline_at = '2026-10-23T12:00:00Z'; j.details.sources[1].url = 'https://unrelated.example.com/rules'; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_first_party_programme_rules_needed');
  j.details.sources[1].url = 'https://events.example.com/rules'; j.details.submission.allows_pitch = false; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'speaking_submission_not_permitted');
  assert.equal(prepareMotion(speaking(), snapshot({ contacts: [contact('buyer-a', { suppressed: true })] }), POLICY, AT).hold, 'host_contact_permission_or_suppression_hold');
});

test('strict motion contracts reject hidden actions, missing provenance and unfair or empty alternatives', () => {
  for (const mutate of [j => { j.details.send = true; }, j => { j.details.decision_aid.options = []; }, j => { j.details.decision_aid.options[1].label = j.details.decision_aid.options[0].label; }, j => { j.details.decision_aid.disconfirming = ''; }, j => { j.source_id = 'absent'; }, j => { j.details.sources[0].url = 'https://example.com/source?token=synthetic'; }, j => { j.due_at = '2026-02-30T12:00:00Z'; }]) { const j = outreach(); mutate(j); assert.throws(() => parseMotionJob(j)); }
  const j = speaking(); j.details.availability = 'anytime'; assert.throws(() => parseMotionJob(j), /forbidden/);
});

test('missing or stale canon fails closed and repeated valid jobs produce identical artifacts', () => {
  const j = practice(); assert.deepEqual(prepareMotion(j, snapshot(), POLICY, AT), prepareMotion(copy(j), snapshot(), POLICY, AT));
  assert.throws(() => prepareMotion(j, snapshot({ complete: false }), POLICY, AT), /incomplete/);
  j.details.sources[0].observed_at = '2026-01-01T12:00:00Z'; assert.equal(prepareMotion(j, snapshot(), POLICY, AT).hold, 'motion_source_stale_or_future');
});
