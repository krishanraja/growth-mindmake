import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, chooseImprovement } from '../src/stages/report.mjs';
import { parseImprovement, parseReport } from '../contracts/reporting.ts';
import { analyse } from '../src/stages/qualify.mjs';
import { prepare } from '../src/stages/draft.mjs';
import { scorecard } from '../src/stages/scorecard.mjs';
import { AT, POLICY, contact, copy, deal, snapshot } from './helpers.mjs';

function report(input, launchDate) {
  const analysis = analyse(input, POLICY, AT);
  return buildReport(input, analysis, analysis.eligible.map(c => prepare(c, input.canon)), scorecard(input, POLICY, AT, launchDate), POLICY, AT);
}
function facts(changes = {}) {
  return { scope: 'selected_page', source_revision: 'synthetic-revision-1', examined: 10, prepared: 0, research_needed: 0,
    missing_current_buying_moment: 0, missing_person_company_evidence: 0, permission_review_required: 0, pending_human_qualification: 0,
    qualified_conversations: 0, paid_proofs: null, paid_proof_gap: null, has_more: false, context_complete: true,
    evidence: { person: 3, company: 3, trigger: 3, source_ids: ['source-a', 'source-b'] }, ...changes };
}

test('selected-page dashboard reports two qualified people against five without borrowing unrelated CRM outcomes', () => {
  const contacts = ['a', 'b', 'pending'].map(id => contact(id));
  const input = snapshot({ contacts, deals: [
    deal('a', { contact_id: 'a' }), deal('b', { contact_id: 'b' }),
    deal('pending', { contact_id: 'pending', qualification: undefined, qualified_at: undefined }),
    deal('unrelated', { contact_id: 'outside-page', pilot_paid_at: '2026-10-16T12:30:00Z' })
  ] });
  const result = report(input, '2026-10-16');
  assert.equal(result.outcomes.qualified_conversations, 2);
  assert.equal(result.outcomes.target, 5);
  assert.equal(result.outcomes.gap, 3);
  assert.equal(result.pending_human_qualification, 1);
  assert.equal(result.outcomes.first_month.paid_proofs, 0);
  assert.equal(result.coverage.scope, 'selected_page');
  assert.equal(result.coverage.provisional, true);
  assert.equal(result.coverage.global_outcomes, 'consumer_required');
  assert.equal(result.recommendations[0].kind, 'qualify_held');
  assert.equal(result.recommendations[0].close_condition.reference.source_revision, input.source_revision);
});

test('a page of suppressed contacts produces no random human task despite its provisional outcome gap', () => {
  const result = report(snapshot({ contacts: [contact('a', { suppressed: true }), contact('b', { closed: true })] }));
  assert.equal(result.pipeline.prepared, 0);
  assert.equal(result.pipeline.held, 2);
  assert.equal(result.pipeline.suppressed_or_closed, 2);
  assert.equal(result.outcomes.first_month, null);
  assert.deepEqual(result.recommendations, []);
  assert.match(result.explanation, /No new action is supported/);
});

test('one improvement follows the observed bottleneck, with accountable ownership and a measurable close', () => {
  const cases = [
    [{ research_needed: 2, prepared: 3, permission_review_required: 1 }, 'research_freshness', 'engine', false],
    [{ prepared: 3, permission_review_required: 1 }, 'permissions_review', 'krish', true],
    [{ prepared: 2, pending_human_qualification: 1 }, 'review_prepared', 'krish', true],
    [{ pending_human_qualification: 1 }, 'qualify_held', 'krish', true],
    [{ qualified_conversations: 2, paid_proofs: 0, paid_proof_gap: 1 }, 'paid_proof_next_step', 'krish', true],
    [{ has_more: true }, 'more_coverage', 'engine', false]
  ];
  for (const [changes, kind, owner, human] of cases) {
    const result = chooseImprovement(facts(changes));
    assert.equal(result.length, 1);
    assert.equal(result[0].kind, kind);
    assert.equal(result[0].owner, owner);
    assert.equal(result[0].requires_human, human);
    assert.equal(result[0].destination, ['research_freshness', 'more_coverage'].includes(kind) ? 'growth' : kind === 'review_prepared' ? 'waiting_list' : 'advisory');
    assert.equal(result[0].evidence.affected, result[0].close_condition.reference.baseline);
    assert.match(result[0].close_condition.kind, /recorded|decided|expanded/);
    assert.equal(result[0].close_condition.proof_required, 'matching_persisted_event');
    assert.deepEqual(parseImprovement(result[0]), result[0]);
  }
  assert.deepEqual(chooseImprovement(facts()), []);
  assert.deepEqual(chooseImprovement(facts({ paid_proofs: 0, paid_proof_gap: 1 })), [], 'a payment gap alone does not invent a qualified buyer');
});

test('incomplete context cannot ask a human to approve prepared work', () => {
  const result = chooseImprovement(facts({ context_complete: false, prepared: 1 }));
  assert.ok(result.every(r => !r.requires_human));
  assert.throws(() => report(snapshot({ complete: false })), /incomplete/);
  assert.throws(() => report(snapshot({ generated_at: '2026-10-14T12:00:00Z' })), /stale/);
});

test('dashboard excludes private facts and exports only bounded source identities with revision provenance', () => {
  const input = snapshot({ contacts: Array.from({ length: 8 }, (_, i) => contact(`buyer-${i}`)) });
  input.contacts[0].full_name = 'PRIVATE_SYNTHETIC_NAME';
  input.contacts[0].company = 'PRIVATE_SYNTHETIC_COMPANY';
  input.contacts[0].buying_moment.fact = 'PRIVATE_SYNTHETIC_DECISION';
  input.contacts[0].evidence[0].id = 'https://example.com/source?token=synthetic';
  const result = report(input);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SYNTHETIC|https:\/\/|@|token=/);
  assert.equal(result.coverage.source_ids_truncated, true);
  assert.ok(result.recommendations[0].evidence.source_ids.length <= 20);
  assert.equal(new Set(result.recommendations[0].evidence.source_ids).size, result.recommendations[0].evidence.source_ids.length);
  assert.equal(result.source_revision, input.source_revision);
  const refreshed = copy(input); refreshed.generated_at = '2026-10-16T12:59:00Z';
  assert.equal(report(refreshed).recommendations[0].id, result.recommendations[0].id);
});

test('strict report contract rejects invented coverage, altered targets and executable action fields', () => {
  const base = report(snapshot());
  for (const change of [
    r => { r.coverage.scope = 'global_review'; },
    r => { r.outcomes.target = 99; r.outcomes.gap = 99; },
    r => { r.pipeline.prepared = 10; },
    r => { r.recommendations[0].send = true; },
    r => { r.recommendations[0].close_condition.reference.source_revision = 'unrelated'; },
    r => { r.recommendations[0].evidence.source_ids = ['https://example.com/source']; },
    r => { r.recommendations[0].requires_human = false; }
  ]) {
    const unsafe = copy(base); change(unsafe);
    assert.throws(() => parseReport(unsafe));
  }
  const active = report(snapshot(), '2026-10-16'); active.outcomes.first_month.target = 7; active.outcomes.first_month.gap = 7;
  assert.throws(() => parseReport(active));
});
