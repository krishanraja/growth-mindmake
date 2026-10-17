/** Producer-owned operations contract. The consumer implements this unchanged. */
import { parseImprovement } from './reporting.ts';
export type Attempt = { version: 1; attempt_id: string; command: 'daily'|'weekly-review'; started_at: string; finished_at: string|null; status: 'started'|'succeeded'|'failed'|'unknown'; phase: 'capture'|'plan'|'handoff'|'review_context'|'review'|'readback'; run_id: string|null; error_code: 'source_unavailable'|'context_invalid'|'handoff_unconfirmed'|'readback_unconfirmed'|null };
export const FEATURES = ['snapshot','report_persistence','attempt_journal','weekly_review','human_reporting','human_actions','global_outcomes','feedback'] as const;
export type Capabilities = { version: 1; source_revision: string; contracts: { growth: string; reporting: string; operations: string }; features: Record<typeof FEATURES[number], boolean>; activation: { state: 'inactive'|'active'; launch_date: string|null } };
export type ReviewContext = { version: 1; generated_at: string; source_revision: string; complete: boolean; week_starts: string; activation: { launch_date: string|null }; metrics: { qualified_conversations: number; pending_human_qualification: number; paid_proofs: number|null; paid_proof_gap: number|null; prepared: number; examined: number; research_needed: number; missing_current_buying_moment: number; missing_person_company_evidence: number; permission_review_required: number }; coverage: { has_more: boolean; person: number; company: number; trigger: number; source_ids: string[] }; runs: { succeeded: number; failed: number; unknown: number }; feedback: { recommendation_id: string; decision: 'accepted'|'bumped'|'declined'|'completed'; recorded_at: string; outcome: 'verified'|'not_verified' }[] };
export type WeeklyReview = { version: 1; review_id: string; generated_at: string; week_starts: string; source_revision: string; context_seal: string; coverage: 'global_review'; activation: ReviewContext['activation']; first_month_status: 'inactive'|'open'|'closed'; metrics: ReviewContext['metrics']; targets: { qualified_conversations: 5; paid_proofs_first_30_days: 1 }; runs: ReviewContext['runs']; feedback_summary: { accepted: number; bumped: number; declined: number; completed: number; verified: number }; recommendations: unknown[]; decision_rule: string };

function record(value: unknown, path: string, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || allowed.some(k => !(k in value))) throw new Error(`${path}: invalid fields`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, max = 200) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\r\n]/.test(value)) throw new Error(`${path}: invalid text`); }
function choice(value: unknown, options: unknown[], path: string) { if (!options.includes(value)) throw new Error(`${path}: invalid choice`); }
function count(value: unknown, path: string) { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 100000000) throw new Error(`${path}: invalid count`); }
function boolean(value: unknown, path: string) { if (typeof value !== 'boolean') throw new Error(`${path}: invalid flag`); }
function day(value: unknown, path: string) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) !== value) throw new Error(`${path}: invalid date`); }
function date(value: unknown, path: string) { if (typeof value !== 'string') throw new Error(`${path}: invalid timestamp`); const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value); if (!m || !Number.isFinite(Date.parse(value)) || Number(m[2])>23 || Number(m[3])>59 || Number(m[4])>59 || Number(m[5]??0)>23 || Number(m[6]??0)>59) throw new Error(`${path}: invalid timestamp`); day(m[1],path); }
export function parseAttempt(value: unknown): Attempt {
  const a = record(value,'attempt',['version','attempt_id','command','started_at','finished_at','status','phase','run_id','error_code']);
  if (a.version !== 1 || typeof a.attempt_id !== 'string' || !/^gma-[a-f0-9-]{36}$/.test(a.attempt_id)) throw new Error('attempt: invalid identity');
  choice(a.command,['daily','weekly-review'],'attempt.command'); date(a.started_at,'attempt.started_at');
  choice(a.status,['started','succeeded','failed','unknown'],'attempt.status'); choice(a.phase,['capture','plan','handoff','review_context','review','readback'],'attempt.phase');
  if (a.finished_at !== null) { date(a.finished_at,'attempt.finished_at'); if (Date.parse(String(a.finished_at)) < Date.parse(String(a.started_at))) throw new Error('attempt: reversed clock'); }
  if (a.run_id !== null) { text(a.run_id,'attempt.run_id'); if (!/^(gm|gmr)-[a-f0-9]{40}$/.test(String(a.run_id))) throw new Error('attempt: invalid run id'); }
  choice(a.error_code,[null,'source_unavailable','context_invalid','handoff_unconfirmed','readback_unconfirmed'],'attempt.error_code');
  if ((a.status === 'started') !== (a.finished_at === null) || (['started','succeeded'].includes(String(a.status))) !== (a.error_code === null)) throw new Error('attempt: inconsistent state');
  return a as Attempt;
}
export function parseCapabilities(value: unknown): Capabilities {
  const c = record(value,'capabilities',['version','source_revision','contracts','features','activation']); if (c.version !== 1) throw new Error('capabilities: invalid version'); text(c.source_revision,'capabilities.source_revision');
  const hashes = record(c.contracts,'capabilities.contracts',['growth','reporting','operations']); for (const hash of Object.values(hashes)) if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('capabilities: invalid contract digest');
  const flags = record(c.features,'capabilities.features',[...FEATURES]); for (const flag of Object.values(flags)) boolean(flag,'capabilities.feature');
  const activation = record(c.activation,'capabilities.activation',['state','launch_date']); choice(activation.state,['active','inactive'],'activation.state'); if (activation.launch_date !== null) day(activation.launch_date,'activation.launch_date');
  if ((activation.state === 'active') !== (activation.launch_date !== null)) throw new Error('activation: inconsistent state'); return c as Capabilities;
}
const METRICS = ['qualified_conversations','pending_human_qualification','paid_proofs','paid_proof_gap','prepared','examined','research_needed','missing_current_buying_moment','missing_person_company_evidence','permission_review_required'];
function metrics(value: unknown) { const m = record(value,'review.metrics',METRICS); for (const [key, value] of Object.entries(m)) if (!(value === null && ['paid_proofs','paid_proof_gap'].includes(key))) count(value,`review.metrics.${key}`); if ((m.paid_proofs === null) !== (m.paid_proof_gap === null) || (m.paid_proofs !== null && m.paid_proof_gap !== Math.max(0,1-Number(m.paid_proofs)))) throw new Error('review: inconsistent paid proof gap'); return m; }
function runs(value: unknown) { const r = record(value,'review.runs',['succeeded','failed','unknown']); Object.values(r).forEach(v => count(v,'review.runs')); return r; }
export function parseReviewContext(value: unknown): ReviewContext {
  const c = record(value,'review context',['version','generated_at','source_revision','complete','week_starts','activation','metrics','coverage','runs','feedback']); if (c.version !== 1) throw new Error('review context: invalid version'); date(c.generated_at,'review.generated_at'); text(c.source_revision,'review.source_revision'); boolean(c.complete,'review.complete'); day(c.week_starts,'review.week_starts');
  const activation = record(c.activation,'review.activation',['launch_date']); if (activation.launch_date !== null) day(activation.launch_date,'review.activation.launch_date');
  const m = metrics(c.metrics); if ((activation.launch_date === null) !== (m.paid_proofs === null)) throw new Error('review: activation and payment window disagree');
  const cov = record(c.coverage,'review.coverage',['has_more','person','company','trigger','source_ids']); boolean(cov.has_more,'review.coverage.has_more'); for (const k of ['person','company','trigger']) count(cov[k],`review.coverage.${k}`);
  if (!Array.isArray(cov.source_ids) || cov.source_ids.length > 20 || new Set(cov.source_ids).size !== cov.source_ids.length) throw new Error('review: invalid evidence ids'); cov.source_ids.forEach(v => text(v,'review.evidence_id'));
  runs(c.runs); if (!Array.isArray(c.feedback) || c.feedback.length > 100) throw new Error('review: invalid feedback');
  c.feedback.forEach(value => { const f = record(value,'feedback',['recommendation_id','decision','recorded_at','outcome']); text(f.recommendation_id,'feedback.recommendation_id'); choice(f.decision,['accepted','bumped','declined','completed'],'feedback.decision'); date(f.recorded_at,'feedback.recorded_at'); choice(f.outcome,['verified','not_verified'],'feedback.outcome'); if (f.outcome === 'verified' && f.decision !== 'completed') throw new Error('feedback: only completed can be verified'); });
  const identities = c.feedback.map(value => (value as Record<string,unknown>).recommendation_id); if (new Set(identities).size !== identities.length) throw new Error('review: duplicate feedback state');
  return c as ReviewContext;
}
export function parseWeeklyReview(value: unknown): WeeklyReview {
  const r = record(value,'weekly review',['version','review_id','generated_at','week_starts','source_revision','context_seal','coverage','activation','first_month_status','metrics','targets','runs','feedback_summary','recommendations','decision_rule']);
  if (r.version !== 1 || typeof r.review_id !== 'string' || !/^gmr-[a-f0-9]{40}$/.test(r.review_id)) throw new Error('weekly review: invalid identity'); date(r.generated_at,'weekly.generated_at'); day(r.week_starts,'weekly.week_starts'); text(r.source_revision,'weekly.source_revision');
  if (typeof r.context_seal !== 'string' || !/^[a-f0-9]{64}$/.test(r.context_seal) || r.coverage !== 'global_review') throw new Error('weekly review: invalid provenance'); metrics(r.metrics); runs(r.runs);
  const activation = record(r.activation,'weekly.activation',['launch_date']); if (activation.launch_date !== null) day(activation.launch_date,'weekly.activation.launch_date'); choice(r.first_month_status,['inactive','open','closed'],'weekly.first_month_status');
  if ((activation.launch_date === null) !== (r.first_month_status === 'inactive') || (activation.launch_date === null) !== ((r.metrics as Record<string,unknown>).paid_proofs === null)) throw new Error('weekly review: inconsistent activation');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(String(r.generated_at)));
  if (activation.launch_date !== null) {
    const launch=String(activation.launch_date); const end=new Date(`${launch}T12:00:00Z`); end.setUTCDate(end.getUTCDate()+29);
    if (launch>today || r.first_month_status !== (today>end.toISOString().slice(0,10)?'closed':'open')) throw new Error('weekly review: invalid activation window');
  }
  const target = record(r.targets,'weekly.targets',['qualified_conversations','paid_proofs_first_30_days']); if (target.qualified_conversations !== 5 || target.paid_proofs_first_30_days !== 1) throw new Error('weekly review: target drift');
  const feedback = record(r.feedback_summary,'weekly.feedback',['accepted','bumped','declined','completed','verified']); Object.values(feedback).forEach(v => count(v,'weekly.feedback')); if (Number(feedback.verified) > Number(feedback.completed)) throw new Error('weekly feedback: invalid verified count');
  if (!Array.isArray(r.recommendations) || r.recommendations.length > 1) throw new Error('weekly review: one recommendation maximum');
  for (const value of r.recommendations) {
    const improvement = parseImprovement(value);
    if (improvement.close_condition.reference.scope !== 'global_review' || improvement.close_condition.reference.source_revision !== r.source_revision || improvement.evidence.examined !== (r.metrics as Record<string,unknown>).examined) throw new Error('weekly review: recommendation provenance mismatch');
  }
  text(r.decision_rule,'weekly.decision_rule',1000); return r as WeeklyReview;
}
