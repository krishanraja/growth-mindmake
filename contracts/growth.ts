/** Canonical wire contract. Vendor byte-for-byte with reporting.ts into the consumer. */
import { parseReport } from './reporting.ts';
export type Evidence = { id: string; kind: 'person'|'company'|'trigger'|'relationship'|'new_value'; visibility: 'public'|'private'; fact: string; url: string; observed_at: string };
export type Qualification = { decision_authority: boolean; owned_problem: boolean; active_need: boolean; offer_fit: boolean; next_step_agreed: boolean; confirmed_by: 'krish'; confirmed_at: string };
export type Contact = { id: string; full_name: string; title: string; company: string; relationship: 'warm'|'known'|'cold'; suppressed: boolean; closed: boolean; consent_status: 'allowed'|'unknown'|'blocked'; evidence: Evidence[]; offer_fit: 'brain'|'revenue_engine'|'unknown'; why_fit: string; decision_authority: 'confirmed'|'unknown'; buying_moment?: Evidence; last_touch_at?: string; connector?: { contact_id: string; full_name: string; both_opted_in: boolean } };
export type Deal = { id: string; contact_id: string; state: string; drafted_at?: string; sent_at?: string; replied_at?: string; call_taken_at?: string; pilot_paid_at?: string; qualified_at?: string; qualification?: Qualification; follow_up_count?: number };
export type Canon = { revision: string; approved_at: string; brief_url: string; publication_url: string; brain_description: string; revenue_description: string };
export type Snapshot = { version: 1; generated_at: string; source_revision: string; complete: boolean; next_cursor?: string; icp: { defined: boolean; definition: string; buyer_titles: string[]; industries: string[]; exclusions: string[] }; canon: Canon; contacts: Contact[]; deals: Deal[] };
export type Recommendation = { recommendation_id: string; contact_id: string; recipient_contact_id: string; mode: 'warm'|'cold'|'intro'|'follow_up'; why_fit: string; why_now: string; ask_kind: 'buyer'|'intro'; draft: { subject: string; body: string }; decision_aid: { title: string; body: string }; evidence: Evidence[] };
export type Batch = { version: 1; run_id: string; generated_at: string; canon_revision: string; snapshot_revision: string; recommendations: Recommendation[]; report: Record<string, unknown> };

export const APPROVED_CANON: Canon = {
  revision: 'mindmake:00:e3c459d75e68365a5188fc745b60841156e33538:01:d2a61cdbf4e6bbf78e8ce3c8f2378380a095bb62',
  approved_at: '2026-10-16T12:54:28Z',
  brief_url: 'https://mindmake.co/?start=1',
  publication_url: 'https://makeyourmindup.ai',
  brain_description: 'Your taste, standards and judgement, running as a system you own.',
  revenue_description: 'Your pricing, positioning and team rebuilt for AI, then tested with real buyers.'
};

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected object`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, max = 2000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${path}: invalid text`);
}
function one(value: unknown, values: readonly string[], path: string) { if (!values.includes(String(value))) throw new Error(`${path}: invalid choice`); }
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') throw new Error(`${path}: expected boolean`); }
function date(value: unknown, path: string) {
  text(value, path, 40);
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m || !Number.isFinite(Date.parse(value)) || Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4]) > 59 || new Date(`${m[1]}T12:00:00Z`).toISOString().slice(0, 10) !== m[1]) throw new Error(`${path}: invalid timestamp`);
}
function url(value: unknown, path: string) { text(value, path); const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || [...u.searchParams.keys()].some(k => /token|secret|password|auth|signature|(^|[-_])(key|sig|code)([-_]|$)/i.test(k)) || /token|secret|auth/i.test(u.hash)) throw new Error(`${path}: expected credential-free HTTPS URL`); }
function list(value: unknown, path: string, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) throw new Error(`${path}: invalid array`); return value; }
function unique(values: unknown[], path: string) { if (new Set(values).size !== values.length) throw new Error(`${path}: duplicate identity`); }
function keys(value: Record<string, unknown>, allowed: string[], path: string) { if (Object.keys(value).some(k => !allowed.includes(k))) throw new Error(`${path}: unknown field`); }
function noActions(value: unknown, path = 'payload') {
  if (Array.isArray(value)) { value.forEach((v, i) => noActions(v, `${path}[${i}]`)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(send|publish|schedule|auto_send|send_at|recipient_email|to|cc|bcc)$/i.test(key)) throw new Error(`${path}: forbidden external action field`);
    noActions(child, `${path}.${key}`);
  }
}
export function parseEvidence(value: unknown): Evidence {
  const e = object(value, 'evidence'); keys(e, ['id','kind','visibility','fact','url','observed_at'], 'evidence'); text(e.id, 'evidence.id', 200); one(e.kind, ['person','company','trigger','relationship','new_value'], 'evidence.kind'); one(e.visibility, ['public','private'], 'evidence.visibility');
  text(e.fact, 'evidence.fact', 1000); url(e.url, 'evidence.url'); date(e.observed_at, 'evidence.observed_at'); return e as Evidence;
}
export function parseQualification(value: unknown): Qualification {
  const q = object(value, 'qualification'); keys(q, ['decision_authority','owned_problem','active_need','offer_fit','next_step_agreed','confirmed_by','confirmed_at'], 'qualification'); for (const k of ['decision_authority','owned_problem','active_need','offer_fit','next_step_agreed']) bool(q[k], `qualification.${k}`);
  one(q.confirmed_by, ['krish'], 'qualification.confirmed_by'); date(q.confirmed_at, 'qualification.confirmed_at'); return q as Qualification;
}
export function parseSnapshot(value: unknown): Snapshot {
  noActions(value); const s = object(value, 'snapshot'); keys(s, ['version','generated_at','source_revision','complete','next_cursor','icp','canon','contacts','deals'], 'snapshot'); if (s.version !== 1) throw new Error('snapshot: unsupported version'); date(s.generated_at, 'snapshot.generated_at'); text(s.source_revision, 'snapshot.source_revision'); bool(s.complete, 'snapshot.complete');
  if (s.next_cursor !== undefined) text(s.next_cursor, 'snapshot.next_cursor', 200);
  const icp = object(s.icp, 'icp'); keys(icp, ['defined','definition','buyer_titles','industries','exclusions'], 'icp'); bool(icp.defined, 'icp.defined'); if (typeof icp.definition !== 'string' || icp.definition.length > 4000 || (icp.defined && !icp.definition.trim())) throw new Error('icp.definition: invalid');
  for (const k of ['buyer_titles','industries','exclusions']) list(icp[k], `icp.${k}`, 100).forEach(v => text(v, `icp.${k}`, 300));
  const canon = object(s.canon, 'canon'); keys(canon, ['revision','approved_at','brief_url','publication_url','brain_description','revenue_description'], 'canon'); for (const k of ['revision','brain_description','revenue_description']) text(canon[k], `canon.${k}`);
  date(canon.approved_at, 'canon.approved_at'); url(canon.brief_url, 'canon.brief_url'); url(canon.publication_url, 'canon.publication_url');
  if (canon.brief_url !== 'https://mindmake.co/?start=1' || canon.publication_url !== 'https://makeyourmindup.ai') throw new Error('canon: unapproved destination');
  const contacts = list(s.contacts, 'contacts', 100);
  contacts.forEach(value => {
    const c = object(value, 'contact'); keys(c, ['id','full_name','title','company','relationship','suppressed','closed','consent_status','evidence','offer_fit','why_fit','decision_authority','buying_moment','last_touch_at','connector'], 'contact'); for (const k of ['id','full_name','title','company']) text(c[k], `contact.${k}`, 300);
    if (typeof c.why_fit !== 'string' || c.why_fit.length > 1000) throw new Error('contact.why_fit: invalid text');
    one(c.relationship, ['warm','known','cold'], 'contact.relationship'); one(c.consent_status, ['allowed','unknown','blocked'], 'contact.consent_status'); one(c.offer_fit, ['brain','revenue_engine','unknown'], 'contact.offer_fit'); one(c.decision_authority, ['confirmed','unknown'], 'contact.decision_authority');
    bool(c.suppressed, 'contact.suppressed'); bool(c.closed, 'contact.closed'); const evidence = list(c.evidence, 'contact.evidence', 20).map(parseEvidence); unique(evidence.map(e => e.id), 'contact.evidence');
    if (c.buying_moment !== undefined) { const trigger = parseEvidence(c.buying_moment); const sameId = evidence.find(e => e.id === trigger.id); if (sameId && ['kind','visibility','fact','url','observed_at'].some(k => sameId[k as keyof Evidence] !== trigger[k as keyof Evidence])) throw new Error('contact.buying_moment: conflicting evidence identity'); }
    if (c.last_touch_at !== undefined) date(c.last_touch_at, 'contact.last_touch_at');
    if (c.connector !== undefined) { const t = object(c.connector, 'connector'); keys(t, ['contact_id','full_name','both_opted_in'], 'connector'); text(t.contact_id, 'connector.contact_id'); text(t.full_name, 'connector.full_name'); bool(t.both_opted_in, 'connector.both_opted_in'); }
  });
  unique(contacts.map(c => object(c, 'contact').id), 'contacts');
  const deals = list(s.deals, 'deals', 500);
  deals.forEach(value => { const d = object(value, 'deal'); for (const k of ['id','contact_id','state']) text(d[k], `deal.${k}`); for (const k of ['drafted_at','sent_at','replied_at','call_taken_at','pilot_paid_at','qualified_at']) if (d[k] !== undefined) date(d[k], `deal.${k}`); if (d.qualification !== undefined) parseQualification(d.qualification); if (d.follow_up_count !== undefined && (!Number.isInteger(d.follow_up_count) || Number(d.follow_up_count) < 0)) throw new Error('deal.follow_up_count: invalid'); });
  unique(deals.map(d => object(d, 'deal').id), 'deals'); return s as Snapshot;
}
export function parseBatch(value: unknown): Batch {
  noActions(value); const b = object(value, 'batch');
  const allowed = ['version','run_id','generated_at','canon_revision','snapshot_revision','recommendations','report'];
  if (Object.keys(b).some(k => !allowed.includes(k))) throw new Error('batch: unknown field');
  if (b.version !== 1) throw new Error('batch: unsupported version');
  for (const k of ['run_id','canon_revision','snapshot_revision']) text(b[k], `batch.${k}`, 200);
  date(b.generated_at, 'batch.generated_at'); const report = object(b.report, 'batch.report'); if (report.dashboard !== undefined) parseReport(report.dashboard);
  const recommendations = list(b.recommendations, 'recommendations', 10);
  recommendations.forEach(value => {
    const r = object(value, 'recommendation'); keys(r, ['recommendation_id','contact_id','recipient_contact_id','mode','why_fit','why_now','ask_kind','draft','decision_aid','evidence'], 'recommendation'); for (const k of ['recommendation_id','contact_id','recipient_contact_id','why_fit','why_now']) text(r[k], `recommendation.${k}`);
    one(r.mode, ['warm','cold','intro','follow_up'], 'recommendation.mode'); one(r.ask_kind, ['buyer','intro'], 'recommendation.ask_kind');
    if ((r.mode === 'intro') === (r.contact_id === r.recipient_contact_id)) throw new Error('recommendation: recipient identity does not match route');
    const d = object(r.draft, 'draft'); keys(d, ['subject','body'], 'draft'); text(d.subject, 'draft.subject', 120); text(d.body, 'draft.body', 4000); if (/[\r\n]/.test(String(d.subject))) throw new Error('draft.subject: header controls');
    const a = object(r.decision_aid, 'decision_aid'); keys(a, ['title','body'], 'decision_aid'); text(a.title, 'decision_aid.title', 200); text(a.body, 'decision_aid.body', 6000);
    const evidence = list(r.evidence, 'recommendation.evidence', 20).map(parseEvidence); unique(evidence.map(e => e.id), 'recommendation.evidence');
    if (evidence.some(e => e.visibility !== 'public')) throw new Error('recommendation: private evidence cannot leave its source scope');
    if (JSON.stringify([d,a]).includes('\u2014')) throw new Error('recommendation: em dash is not allowed');
  });
  unique(recommendations.map(r => object(r, 'recommendation').recommendation_id), 'recommendations');
  unique(recommendations.map(r => object(r, 'recommendation').contact_id), 'recommendation contacts');
  unique(recommendations.map(r => object(r, 'recommendation').recipient_contact_id), 'recommendation recipients');
  if (JSON.stringify(b).length > 100000) throw new Error('batch: payload too large'); return b as Batch;
}

/** Wire replay identity excludes observation-only delivery clocks. */
export function semanticBatch(batch: Batch): Record<string, unknown> {
  const { generated_at, ...rest } = batch;
  if (!rest.report.scorecard || typeof rest.report.scorecard !== 'object' || Array.isArray(rest.report.scorecard)) return rest;
  const scorecard = object(rest.report.scorecard, 'report.scorecard');
  const { as_of, ...measures } = scorecard;
  if (!rest.report.dashboard) return { ...rest, report: { ...rest.report, scorecard: measures } };
  const { generated_at: reportClock, ...dashboard } = object(rest.report.dashboard, 'report.dashboard');
  return { ...rest, report: { ...rest.report, scorecard: measures, dashboard } };
}
