import { parseReviewContext, parseWeeklyReview } from '../contracts/operations.ts';
import { chooseImprovement } from './stages/report.mjs';
import { ageDays, seal } from './guards.mjs';

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
  const recommendations = chooseImprovement(facts).filter(r => {
    const prior = semantic.feedback.filter(f => f.recommendation_id === r.id).at(-1);
    if (!prior) return true;
    const priorDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(prior.recorded_at));
    if ((prior.decision === 'declined' && priorDay >= context.week_starts) || (prior.decision === 'completed' && prior.outcome === 'verified')) return false;
    if (prior.decision === 'bumped' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(prior.recorded_at)) === today) return false;
    return true;
  });
  return parseWeeklyReview({ version: 1, review_id: `gmr-${seal({ context_seal, recommendations, first_month_status, policy: policy.targets }).slice(0,40)}`, generated_at: at, week_starts: context.week_starts, source_revision: context.source_revision, context_seal, coverage: 'global_review', activation: context.activation, first_month_status, metrics: context.metrics, targets: { qualified_conversations: 5, paid_proofs_first_30_days: 1 }, runs: context.runs, feedback_summary, recommendations, decision_rule: 'Use complete current global outcomes and recorded feedback. Refresh evidence first; one grounded improvement, with no assumed conversion rate. A decision is distinct from a verified outcome.' });
}
