/** Optional producer report. The consumer derives authoritative global outcomes. */
export type ReportScope = 'selected_page' | 'global_review';
export type ImprovementKind = 'research_freshness' | 'permissions_review' | 'review_prepared' | 'qualify_held' | 'paid_proof_next_step' | 'more_coverage';
export type SourceCounts = { person: number; company: number; trigger: number; source_ids: string[] };
export type ImprovementFacts = {
  scope: ReportScope; source_revision: string; examined: number; prepared: number;
  research_needed: number; missing_current_buying_moment: number; missing_person_company_evidence: number;
  permission_review_required: number; pending_human_qualification: number; qualified_conversations: number;
  paid_proofs: number | null; paid_proof_gap: number | null; has_more: boolean; context_complete: boolean;
  evidence: SourceCounts;
};
export type Improvement = {
  id: string; kind: ImprovementKind; owner: 'engine' | 'krish' | 'control-center';
  title: string; reason: string; requires_human: boolean;
  destination: 'growth' | 'advisory' | 'waiting_list';
  evidence: { examined: number; affected: number; person: number; company: number; trigger: number; source_ids: string[] };
  close_condition: {
    kind: 'public_research_recorded' | 'permission_review_recorded' | 'prepared_draft_decided' | 'conversation_qualification_recorded' | 'paid_proof_recorded' | 'coverage_expanded';
    proof_required: 'matching_persisted_event';
    reference: { scope: ReportScope; source_revision: string; metric: string; baseline: number; target: number };
  };
};
export type CoverageCount = { fresh_evidence: number; contacts: number };
export type DashboardReport = {
  version: 1; generated_at: string; source_revision: string;
  coverage: { scope: 'selected_page'; provisional: true; contacts: number; context_complete: boolean; has_more: boolean; global_outcomes: 'consumer_required'; source_ids_truncated: boolean };
  pipeline: { examined: number; eligible: number; prepared: number; held: number; deferred_by_budget: number; existing_deals: number; suppressed_or_closed: number; permission_review_required: number };
  source_coverage: { person: CoverageCount; company: CoverageCount; trigger: CoverageCount };
  hold_counts: { reason: string; count: number }[];
  pending_human_qualification: number;
  outcomes: {
    scope: 'selected_page'; provisional: true; timezone: 'Europe/London'; week_starts: string;
    qualified_conversations: number; target: 5; gap: number;
    first_month: { starts: string; ends: string; paid_proofs: number; target: 1; gap: number } | null;
  };
  recommendations: Improvement[]; explanation: string;
};

const COUNT_MAX = 100000000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SECRET_ID = /(?:^|[._:-])(?:token|secret|password|auth|signature|apikey|bearer)(?:[._:-]|$)|^gh[pousr]_[A-Za-z0-9]{30,}$/i;
function object(value: unknown, path: string, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !fields.includes(k)) || fields.some(k => !Object.hasOwn(value, k))) throw new Error(`${path}: invalid fields`);
  return value as Record<string, unknown>;
}
function choice(value: unknown, values: readonly unknown[], path: string) { if (!values.includes(value)) throw new Error(`${path}: invalid choice`); }
function count(value: unknown, path: string, max = COUNT_MAX): asserts value is number { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) throw new Error(`${path}: invalid count`); }
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') throw new Error(`${path}: invalid flag`); }
function text(value: unknown, path: string, max = 1000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\r\n\u0000-\u001f\u2014]/.test(value) || /\S+@\S+\.\S+/.test(value)) throw new Error(`${path}: invalid text`);
}
function identity(value: unknown, path: string) { text(value, path, 200); if (!ID.test(value)) throw new Error(`${path}: invalid identity`); }
function day(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error(`${path}: invalid day`);
}
function date(value: unknown, path: string) {
  text(value, path, 40);
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value)) || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59 || (parts[6] && (Number(parts[7]) > 23 || Number(parts[8]) > 59))) throw new Error(`${path}: invalid timestamp`);
  day(parts[1], path);
}
function sourceIds(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length > 20 || new Set(value).size !== value.length || value.some(v => typeof v !== 'string' || !SOURCE_ID.test(v) || SECRET_ID.test(v))) throw new Error(`${path}: invalid source identities`);
}
const COUNT_KEYS = ['examined','prepared','research_needed','missing_current_buying_moment','missing_person_company_evidence','permission_review_required','pending_human_qualification','qualified_conversations'] as const;
export function parseImprovementFacts(value: unknown): ImprovementFacts {
  const f = object(value, 'improvement facts', ['scope','source_revision',...COUNT_KEYS,'paid_proofs','paid_proof_gap','has_more','context_complete','evidence']);
  choice(f.scope, ['selected_page','global_review'], 'facts.scope'); identity(f.source_revision, 'facts.source_revision');
  for (const key of COUNT_KEYS) count(f[key], `facts.${key}`);
  for (const key of ['paid_proofs','paid_proof_gap']) if (f[key] !== null) count(f[key], `facts.${key}`);
  if ((f.paid_proofs === null) !== (f.paid_proof_gap === null)) throw new Error('facts: inconsistent activation');
  bool(f.has_more, 'facts.has_more'); bool(f.context_complete, 'facts.context_complete');
  const e = object(f.evidence, 'facts.evidence', ['person','company','trigger','source_ids']);
  for (const key of ['person','company','trigger']) count(e[key], `facts.evidence.${key}`);
  sourceIds(e.source_ids, 'facts.evidence.source_ids');
  return f as ImprovementFacts;
}
export function parseImprovement(value: unknown): Improvement {
  const r = object(value, 'improvement', ['id','kind','owner','title','reason','requires_human','destination','evidence','close_condition']);
  if (typeof r.id !== 'string' || !/^gmi-[a-f0-9]{32}$/.test(r.id)) throw new Error('improvement: invalid identity');
  const kinds = ['research_freshness','permissions_review','review_prepared','qualify_held','paid_proof_next_step','more_coverage'];
  choice(r.kind, kinds, 'improvement.kind'); choice(r.owner, ['engine','krish','control-center'], 'improvement.owner');
  text(r.title, 'improvement.title', 200); text(r.reason, 'improvement.reason', 600); bool(r.requires_human, 'improvement.requires_human');
  choice(r.destination, ['growth','advisory','waiting_list'], 'improvement.destination');
  const e = object(r.evidence, 'improvement.evidence', ['examined','affected','person','company','trigger','source_ids']);
  for (const key of ['examined','affected','person','company','trigger']) count(e[key], `improvement.evidence.${key}`);
  sourceIds(e.source_ids, 'improvement.evidence.source_ids');
  const close = object(r.close_condition, 'improvement.close_condition', ['kind','proof_required','reference']);
  if (close.proof_required !== 'matching_persisted_event') throw new Error('improvement: completion needs persisted proof');
  const matching = ['public_research_recorded','permission_review_recorded','prepared_draft_decided','conversation_qualification_recorded','paid_proof_recorded','coverage_expanded'];
  const index = kinds.indexOf(String(r.kind));
  if (close.kind !== matching[index]) throw new Error('improvement: mismatched close');
  const ref = object(close.reference, 'improvement.reference', ['scope','source_revision','metric','baseline','target']);
  choice(ref.scope, ['selected_page','global_review'], 'improvement.reference.scope'); identity(ref.source_revision, 'improvement.reference.source_revision');
  choice(ref.metric, ['research_needed','permission_review_required','prepared','pending_human_qualification','paid_proof_gap','examined'], 'improvement.reference.metric');
  count(ref.baseline, 'improvement.reference.baseline'); count(ref.target, 'improvement.reference.target');
  const metrics = ['research_needed','permission_review_required','prepared','pending_human_qualification','paid_proof_gap','examined'];
  const destinations = ['growth','advisory','waiting_list','advisory','advisory','growth'];
  if (ref.metric !== metrics[index] || r.destination !== destinations[index] || e.affected !== ref.baseline || ref.target !== (r.kind === 'more_coverage' ? Number(ref.baseline) + 1 : Number(ref.baseline) - 1)) throw new Error('improvement: inconsistent action reference');
  const human = ['permissions_review','review_prepared','qualify_held','paid_proof_next_step'].includes(String(r.kind));
  if (r.requires_human !== human || (human ? r.owner !== 'krish' : r.owner === 'krish')) throw new Error('improvement: inconsistent ownership');
  return r as Improvement;
}
export function parseReport(value: unknown): DashboardReport {
  const r = object(value, 'report', ['version','generated_at','source_revision','coverage','pipeline','source_coverage','hold_counts','pending_human_qualification','outcomes','recommendations','explanation']);
  if (r.version !== 1) throw new Error('report: invalid version'); date(r.generated_at, 'report.generated_at'); identity(r.source_revision, 'report.source_revision');
  const coverage = object(r.coverage, 'report.coverage', ['scope','provisional','contacts','context_complete','has_more','global_outcomes','source_ids_truncated']);
  if (coverage.scope !== 'selected_page' || coverage.provisional !== true || coverage.global_outcomes !== 'consumer_required') throw new Error('report: global coverage cannot be claimed');
  count(coverage.contacts, 'report.coverage.contacts', 100); for (const key of ['context_complete','has_more','source_ids_truncated']) bool(coverage[key], `report.coverage.${key}`);
  const p = object(r.pipeline, 'report.pipeline', ['examined','eligible','prepared','held','deferred_by_budget','existing_deals','suppressed_or_closed','permission_review_required']);
  for (const key of Object.keys(p)) count(p[key], `report.pipeline.${key}`, key === 'existing_deals' ? 500 : 100);
  if (p.examined !== coverage.contacts || Number(p.prepared) > Number(p.eligible) || Number(p.permission_review_required) > Number(p.eligible) || Number(p.held) + Number(p.eligible) + Number(p.deferred_by_budget) !== Number(p.examined)) throw new Error('report: inconsistent pipeline');
  const sources = object(r.source_coverage, 'report.source_coverage', ['person','company','trigger']);
  for (const key of Object.keys(sources)) { const s = object(sources[key], `report.sources.${key}`, ['fresh_evidence','contacts']); count(s.fresh_evidence, `report.sources.${key}.fresh_evidence`, 2100); count(s.contacts, `report.sources.${key}.contacts`, Number(p.examined)); if (Number(s.contacts) > Number(s.fresh_evidence)) throw new Error('report: inconsistent source count'); }
  if (!Array.isArray(r.hold_counts) || r.hold_counts.length > 100) throw new Error('report: invalid hold counts');
  const held = r.hold_counts.map((value, i) => { const h = object(value, `report.holds.${i}`, ['reason','count']); if (typeof h.reason !== 'string' || !/^[a-z][a-z0-9_]{0,99}$/.test(h.reason)) throw new Error('report: invalid hold reason'); count(h.count, 'report.hold.count', 100); if (h.count === 0) throw new Error('report: empty hold count'); return h; });
  if (new Set(held.map(h => h.reason)).size !== held.length || held.reduce((sum, h) => sum + Number(h.count), 0) !== Number(p.held)) throw new Error('report: inconsistent holds');
  count(r.pending_human_qualification, 'report.pending_human_qualification', 500);
  const o = object(r.outcomes, 'report.outcomes', ['scope','provisional','timezone','week_starts','qualified_conversations','target','gap','first_month']);
  if (o.scope !== 'selected_page' || o.provisional !== true || o.timezone !== 'Europe/London') throw new Error('report: invalid outcome scope');
  day(o.week_starts, 'report.week_starts'); for (const key of ['qualified_conversations','target','gap']) count(o[key], `report.outcomes.${key}`, 500);
  if (o.target !== 5 || o.gap !== Math.max(0, Number(o.target) - Number(o.qualified_conversations))) throw new Error('report: invalid weekly target or gap');
  if (Number(o.qualified_conversations) > Number(p.examined)) throw new Error('report: page outcomes exceed examined contacts');
  if (o.first_month !== null) { const m = object(o.first_month, 'report.first_month', ['starts','ends','paid_proofs','target','gap']); day(m.starts, 'report.first_month.starts'); day(m.ends, 'report.first_month.ends'); if (Date.parse(`${m.ends}T12:00:00Z`) - Date.parse(`${m.starts}T12:00:00Z`) !== 29 * 86400000) throw new Error('report: first month must be 30 calendar days'); for (const key of ['paid_proofs','target','gap']) count(m[key], `report.first_month.${key}`, 500); if (m.target !== 1 || m.gap !== Math.max(0, Number(m.target) - Number(m.paid_proofs)) || Number(m.paid_proofs) > Number(p.existing_deals)) throw new Error('report: invalid paid target or gap'); }
  if (!Array.isArray(r.recommendations) || r.recommendations.length > 1) throw new Error('report: one improvement maximum'); r.recommendations.forEach(parseImprovement);
  for (const recommendation of r.recommendations as Improvement[]) if (recommendation.close_condition.reference.scope !== 'selected_page' || recommendation.close_condition.reference.source_revision !== r.source_revision) throw new Error('report: improvement scope mismatch');
  text(r.explanation, 'report.explanation', 600);
  return r as DashboardReport;
}
