import { parseImprovement, parseImprovementFacts, parseReport } from '../../contracts/reporting.ts';
import { fresh, seal, validateContext } from '../guards.mjs';
import { scorecard as measure } from './scorecard.mjs';

const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SECRET_ID = /(?:^|[._:-])(?:token|secret|password|auth|signature|apikey|bearer)(?:[._:-]|$)|^gh[pousr]_[A-Za-z0-9]{30,}$/i;
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(v => v === value).length]));

/** One grounded proposal. This prepares a handoff, never performs its action. */
export function chooseImprovement(input) {
  const f = parseImprovementFacts(input);
  let kind, owner, title, reason, destination, metric, baseline, target, close;
  const research = Math.max(f.research_needed, f.missing_current_buying_moment, f.missing_person_company_evidence);
  if (research > 0) {
    kind = 'research_freshness'; owner = 'engine'; title = 'Refresh the missing public research';
    reason = `${research} examined prospect${research === 1 ? ' needs' : 's need'} current public evidence before more outreach can be prepared. Enrichment alone does not establish a buying moment.`;
    destination = 'growth'; metric = 'research_needed'; baseline = research; target = research - 1; close = 'public_research_recorded';
  } else if (f.context_complete && f.permission_review_required > 0) {
    kind = 'permissions_review'; owner = 'krish'; title = 'Review the permission basis for a prepared draft';
    reason = `${f.permission_review_required} prepared prospect${f.permission_review_required === 1 ? ' has' : 's have'} an unresolved permission basis. A draft is not permission to contact someone.`;
    destination = 'advisory'; metric = 'permission_review_required'; baseline = f.permission_review_required; target = baseline - 1; close = 'permission_review_recorded';
  } else if (f.context_complete && f.prepared > 0) {
    kind = 'review_prepared'; owner = 'krish'; title = 'Review a prepared note on your existing list';
    reason = `${f.prepared} note${f.prepared === 1 ? ' is' : 's are'} prepared for your review. Each exact message remains yours to approve and send.`;
    destination = 'waiting_list'; metric = 'prepared'; baseline = f.prepared; target = baseline - 1; close = 'prepared_draft_decided';
  } else if (f.context_complete && f.pending_human_qualification > 0) {
    kind = 'qualify_held'; owner = 'krish'; title = 'Record the result of a completed conversation';
    reason = `${f.pending_human_qualification} completed conversation${f.pending_human_qualification === 1 ? ' still needs' : 's still need'} your five-criterion qualification. Bookings and drafts do not count.`;
    destination = 'advisory'; metric = 'pending_human_qualification'; baseline = f.pending_human_qualification; target = baseline - 1; close = 'conversation_qualification_recorded';
  } else if (f.context_complete && f.paid_proof_gap !== null && f.paid_proof_gap > 0 && f.qualified_conversations > 0) {
    kind = 'paid_proof_next_step'; owner = 'krish'; title = 'Agree the paid proof next step with a qualified buyer';
    reason = `${f.qualified_conversations} conversation${f.qualified_conversations === 1 ? ' meets' : 's meet'} the recorded criteria, while the activated first-month paid-proof gap is ${f.paid_proof_gap}. Confirm the scope and next step with the buyer.`;
    destination = 'advisory'; metric = 'paid_proof_gap'; baseline = f.paid_proof_gap; target = baseline - 1; close = 'paid_proof_recorded';
  } else if (f.has_more || !f.context_complete || f.examined === 0) {
    kind = 'more_coverage'; owner = f.scope === 'selected_page' ? 'engine' : 'control-center'; title = 'Complete the source coverage before drawing a wider conclusion';
    reason = f.examined === 0 ? 'This read examined no prospects. An empty page is not evidence about the whole network.' : 'This read does not cover the whole relevant source. Continue the bounded read and retain its coverage limits.';
    destination = 'growth'; metric = 'examined'; baseline = f.examined; target = baseline + 1; close = 'coverage_expanded';
  } else return [];
  const evidence = { examined: f.examined, affected: baseline, person: f.evidence.person, company: f.evidence.company, trigger: f.evidence.trigger, source_ids: [...f.evidence.source_ids].sort() };
  const close_condition = { kind: close, proof_required: 'matching_persisted_event', reference: { scope: f.scope, source_revision: f.source_revision, metric, baseline, target } };
  const proposal = { kind, owner, title, reason, requires_human: owner === 'krish', destination, evidence, close_condition };
  return [parseImprovement({ id: `gmi-${seal(proposal).slice(0, 32)}`, ...proposal })];
}

/** Counts and outcomes cover this selected contact page, never the whole CRM. */
export function buildReport(input, analysis, prepared, scorecard, policy, at) {
  const snapshot = validateContext(input, policy, at);
  if (!analysis || !Array.isArray(analysis.eligible) || !Array.isArray(analysis.held) || !Array.isArray(analysis.research) || !Array.isArray(prepared)) throw new Error('Report needs the actual analysis and prepared recommendations');
  const ids = new Set(snapshot.contacts.map(c => c.id));
  if (analysis.held.some(h => !ids.has(h.contact_id)) || analysis.research.some(r => !ids.has(r.contact_id)) || analysis.eligible.some(e => !ids.has(e.contact.id)) || prepared.some(r => !ids.has(r.contact_id))) throw new Error('Report inputs do not describe the selected page');
  const heldIds = analysis.held.map(h => h.contact_id), eligibleIds = analysis.eligible.map(e => e.contact.id);
  if (new Set([...heldIds, ...eligibleIds]).size !== heldIds.length + eligibleIds.length || new Set(prepared.map(r => r.contact_id)).size !== prepared.length || prepared.some(r => !eligibleIds.includes(r.contact_id))) throw new Error('Report analysis has conflicting or duplicate dispositions');
  const selectedDeals = snapshot.deals.filter(d => ids.has(d.contact_id));
  // Never copy outcome totals supplied by a partial or unrelated read. Reuse
  // the scorecard's rules on this page; only its activation date is carried.
  const measured = measure({ ...snapshot, deals: selectedDeals }, policy, at, scorecard?.first_month?.starts);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at)).map(p => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const firstMonthActive = measured.first_month && today <= measured.first_month.ends;
  const rows = snapshot.contacts.map(contact => {
    const publicFacts = [...contact.evidence, ...(contact.buying_moment ? [contact.buying_moment] : [])].filter(e => e.visibility === 'public');
    const unique = [...new Map(publicFacts.map(e => [e.id, e])).values()];
    return Object.fromEntries(['person','company','trigger'].map(kind => [kind, unique.filter(e => e.kind === kind && fresh(e, at, kind === 'trigger' ? policy.limits.trigger_max_age_days : policy.limits.evidence_max_age_days))]));
  });
  const source_coverage = Object.fromEntries(['person','company','trigger'].map(kind => [kind, { fresh_evidence: rows.reduce((n, r) => n + r[kind].length, 0), contacts: rows.filter(r => r[kind].length > 0).length }]));
  const allSources = [...new Set(rows.flatMap(r => [...r.person, ...r.company, ...r.trigger].map(e => e.id)))].sort();
  const safeSources = allSources.filter(id => SOURCE_ID.test(id) && !SECRET_ID.test(id));
  const source_ids = safeSources.slice(0, 20);
  const hold_counts = Object.entries(counts(analysis.held.map(h => h.reason))).map(([reason, count]) => ({ reason, count }));
  const permission_review_required = analysis.eligible.filter(e => e.permission_review_required === true).length;
  const facts = {
    scope: 'selected_page', source_revision: snapshot.source_revision, examined: snapshot.contacts.length, prepared: prepared.length,
    research_needed: new Set(analysis.research.map(r => r.contact_id)).size,
    missing_current_buying_moment: analysis.held.filter(h => h.reason === 'no_current_buying_moment').length,
    missing_person_company_evidence: analysis.held.filter(h => h.reason === 'person_and_company_evidence_needed').length,
    permission_review_required, pending_human_qualification: measured.held_conversations_pending_qualification,
    qualified_conversations: measured.qualified_conversations, paid_proofs: firstMonthActive ? measured.first_month.paid_proofs : null,
    paid_proof_gap: firstMonthActive ? measured.first_month.gap : null, has_more: Boolean(snapshot.next_cursor), context_complete: snapshot.complete,
    evidence: { person: source_coverage.person.fresh_evidence, company: source_coverage.company.fresh_evidence, trigger: source_coverage.trigger.fresh_evidence, source_ids },
  };
  const recommendations = chooseImprovement(facts);
  return parseReport({
    version: 1, generated_at: at, source_revision: snapshot.source_revision,
    coverage: { scope: 'selected_page', provisional: true, contacts: snapshot.contacts.length, context_complete: snapshot.complete, has_more: Boolean(snapshot.next_cursor), global_outcomes: 'consumer_required', source_ids_truncated: source_ids.length !== allSources.length },
    pipeline: { examined: snapshot.contacts.length, eligible: analysis.eligible.length, prepared: prepared.length, held: analysis.held.length, deferred_by_budget: analysis.deferred_by_budget, existing_deals: selectedDeals.length, suppressed_or_closed: snapshot.contacts.filter(c => c.suppressed || c.closed || c.consent_status === 'blocked').length, permission_review_required },
    source_coverage, hold_counts, pending_human_qualification: measured.held_conversations_pending_qualification,
    outcomes: { scope: 'selected_page', provisional: true, timezone: measured.timezone, week_starts: measured.week_starts, qualified_conversations: measured.qualified_conversations, target: measured.target, gap: measured.gap, first_month: measured.first_month },
    recommendations,
    explanation: recommendations.length ? 'One improvement is supported by this selected page. Outcome counts remain provisional; the consumer must derive complete global totals.' : 'No new action is supported by this selected page. Keep the existing lifecycle and refresh when source evidence changes; global target achievement is not established here.',
  });
}
