import { parseReviewContext, parseWeeklyReview, commercialDiagnosis } from '../contracts/operations.ts';
import { chooseImprovement } from './stages/report.mjs';
import { ageDays, seal } from './guards.mjs';
import { parseImprovement } from '../contracts/reporting.ts';
import { placesReview } from './stages/places.mjs';

/**
 * Plan section 12, M13: where Mindmake's buyers already go and which questions
 * to ask the AI answer engines, the weekly review's to decide (src/stages/places.mjs).
 * Control Center serves no touchpoints, probes or accounts to this engine yet,
 * so each part is null until it does, and the review's own output is unchanged.
 */
export function weeklyPlaces({ touchpoints = null, probes = null, accounts = null, canon = null }, at) {
  if (!Number.isFinite(Date.parse(at))) throw new Error('Weekly places need the review time');
  return placesReview({ touchpoints, probes, accounts, canon, at });
}

export function weeklyReview(input, policy, at) {
  const context = parseReviewContext(input), age = ageDays(context.generated_at, at) * 24;
  if (!Number.isFinite(Date.parse(at)) || !context.complete || age < 0 || age > 24) throw new Error('Weekly review requires complete current global context');
  if (policy.targets.qualified_conversations_per_week !== 5 || policy.targets.paid_proofs_first_30_days !== 1) throw new Error('Weekly review target drift');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(at));
  const date = new Date(`${today}T12:00:00Z`), weekday = date.getUTCDay(); date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  if (context.week_starts !== date.toISOString().slice(0,10) || (context.activation.launch_date && context.activation.launch_date > today)) throw new Error('Weekly review window disagrees with London calendar');
  const monthEnd = context.activation.launch_date ? new Date(`${context.activation.launch_date}T12:00:00Z`) : null;
  if (monthEnd) monthEnd.setUTCDate(monthEnd.getUTCDate()+29);
  const first_month_status = !monthEnd ? 'inactive' : today > monthEnd.toISOString().slice(0,10) ? 'closed' : 'open';
  const feedback_summary = { accepted: 0, bumped: 0, declined: 0, completed: 0, verified: 0 };
  for (const feedback of context.feedback) {
    if (Date.parse(feedback.recorded_at) > Date.parse(at)) throw new Error('Weekly review cannot use future feedback');
    feedback_summary[feedback.decision]++; if (feedback.outcome === 'verified') feedback_summary.verified++;
  }
  const { generated_at, ...semantic } = context;
  semantic.feedback = [...context.feedback].sort((a,b) => a.recorded_at.localeCompare(b.recorded_at) || a.recommendation_id.localeCompare(b.recommendation_id) || a.decision.localeCompare(b.decision));
  semantic.coverage = { ...context.coverage, source_ids: [...context.coverage.source_ids].sort() };
  const context_seal = seal(semantic);
  const facts = { scope: 'global_review', source_revision: context.source_revision, ...context.metrics, paid_proofs: first_month_status === 'closed' ? null : context.metrics.paid_proofs, paid_proof_gap: first_month_status === 'closed' ? null : context.metrics.paid_proof_gap, has_more: context.coverage.has_more, context_complete: context.complete, evidence: { person: context.coverage.person, company: context.coverage.company, trigger: context.coverage.trigger, source_ids: context.coverage.source_ids } };
  const c=context.commercial;
  const commercial_diagnosis=commercialDiagnosis(c,context.metrics,today);
  const promiseProposal=c.promises.overdue>0?{kind:'honour_promises',owner:'krish',title:'Honour an overdue promise before adding new outreach',reason:`${c.promises.overdue} recorded promises are overdue. Review the actual request, owner and agreed next step; only a matching fulfilment record closes it.`,requires_human:true,destination:'waiting_list',evidence:{examined:facts.examined,affected:c.promises.overdue,...facts.evidence},close_condition:{kind:'promise_fulfilment_recorded',proof_required:'matching_persisted_event',reference:{scope:'global_review',source_revision:context.source_revision,metric:'overdue_promises',baseline:c.promises.overdue,target:c.promises.overdue-1}}}:null;
  const proofProposal=c.proposals.awaiting_decision>0?{kind:'review_proof_decisions',owner:'krish',title:'Review the next decision on an existing proof proposal',reason:`${c.proposals.awaiting_decision} proof proposals await an actual decision. Read the agreed next step and record the buyer decision before adding new acquisition work. A proposal decision is distinct from payment.`,requires_human:true,destination:'advisory',evidence:{examined:facts.examined,affected:c.proposals.awaiting_decision,...facts.evidence},close_condition:{kind:'proof_decision_recorded',proof_required:'matching_persisted_event',reference:{scope:'global_review',source_revision:context.source_revision,metric:'proposals_awaiting_decision',baseline:c.proposals.awaiting_decision,target:c.proposals.awaiting_decision-1}}}:null;
  const priorityProposal=promiseProposal??proofProposal;
  const candidates=priorityProposal?[parseImprovement({id:`gmi-${seal(priorityProposal).slice(0,32)}`,...priorityProposal})]:context.metrics.pending_human_qualification>0?chooseImprovement({...facts,research_needed:0,missing_current_buying_moment:0,missing_person_company_evidence:0,permission_review_required:0,prepared:0}):chooseImprovement(facts);
  const recommendations = candidates.filter(r => {
    const prior = semantic.feedback.filter(f => f.recommendation_id === r.id).at(-1);
    if (!prior) return true;
    const priorDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(prior.recorded_at));
    if ((prior.decision === 'declined' && priorDay >= context.week_starts) || (prior.decision === 'completed' && prior.outcome === 'verified')) return false;
    if (prior.decision === 'bumped' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(prior.recorded_at)) === today) return false;
    return true;
  });
  return parseWeeklyReview({ version: 1, review_id: `gmr-${seal({ context_seal, recommendations, first_month_status, policy: policy.targets }).slice(0,40)}`, generated_at: at, week_starts: context.week_starts, source_revision: context.source_revision, context_seal, coverage: 'global_review', activation: context.activation, first_month_status, metrics: context.metrics, targets: { qualified_conversations: 5, paid_proofs_first_30_days: 1 }, runs: context.runs, feedback_summary, recommendations, commercial:c,commercial_diagnosis,decision_rule: 'Use complete current global outcomes, attributed channels, promises, proposal decisions, observed effort and recorded feedback. Honour overdue promises first; one grounded improvement, with no assumed conversion rate. A decision or observed experimental metric does not prove causation or a commercial outcome.' });
}
