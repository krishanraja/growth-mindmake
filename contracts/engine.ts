/** Canonical full-engine context and private work-batch contract. */
import { parseSnapshot } from './growth.ts';
import type { Snapshot } from './growth.ts';
import { parseMotionJob } from './motions.ts';
import { parseLifecycleJob } from './lifecycle.ts';
import { parseResearchJob } from './research.ts';

export const JOB_KINDS = ['outreach','introduction','inbound','qualification','proof_scope','delivery','trust','speaking','practice','research'] as const;
export type JobKind = typeof JOB_KINDS[number];
export type Job = { id: string; kind: JobKind; contact_id: string|null; source_id: string; due_at: string|null; details: Record<string, unknown> };
export type EngineContext = { version: 1; generated_at: string; source_revision: string; complete: boolean; snapshot: Snapshot; jobs: Job[] };
export type WorkKind = keyof typeof ARTIFACT_ROUTES;
export type ClosureEvent = (typeof ARTIFACT_ROUTES)[WorkKind]['closure'];
export type WorkArtifact = { kind: WorkKind; title: string; body: string; internal_notes: string[]; evidence_ids: string[]; recipient_contact_id: string|null; channel: 'review'|'email'|'linkedin'|'publication'|'delivery'|'intel'; destination: 'growth'|'advisory'|'waiting_list'|'company_intel'|'mindmake_delivery'|'editorial'; closure_event: ClosureEvent };
export type WorkItem = WorkArtifact & { item_id: string; input_id: string; campaign_id: string; contact_id: string|null; requires_human: true; approval_state: 'pending' };
export type WorkBatch = { version: 1; run_id: string; generated_at: string; source_revision: string; canon_revision: string; source_seal: string; jobs_examined: number; items: WorkItem[]; held: { input_id: string; reason: string }[]; report: { scope: 'selected_context'; global: false; prepared: number; held: number; deferred: number; campaign_counts: { campaign_id: string; prepared: number; held: number }[]; outreach_analysis: { eligible: number; held: number; research_needed: number }; capacity: number; authority: string } };
export const CAMPAIGN_IDS = ['warm-relationship','double-opt-in-introduction','named-cold-decision','inbound-next-decision','selected-founder-trust','relevant-room','practice-decision-aid'] as const;
export const ARTIFACT_ROUTES = {
  outreach_draft: { channels:['email','linkedin'],destination:'growth',closure:'outreach_sent',campaigns:['warm-relationship','named-cold-decision'] },
  introduction_connector_permission: { channels:['email','linkedin'],destination:'waiting_list',closure:'connector_opt_in_recorded',campaigns:['double-opt-in-introduction'] },
  introduction_recipient_permission: { channels:['email','linkedin'],destination:'waiting_list',closure:'recipient_opt_in_recorded',campaigns:['double-opt-in-introduction'] },
  introduction_connection: { channels:['email','linkedin'],destination:'waiting_list',closure:'introduction_sent_recorded',campaigns:['double-opt-in-introduction'] },
  inbound_service_review: { channels:['review'],destination:'mindmake_delivery',closure:'brief_service_review_recorded',campaigns:['inbound-next-decision'] },
  inbound_reply: { channels:['email','linkedin'],destination:'waiting_list',closure:'inbound_reply_sent_recorded',campaigns:['inbound-next-decision'] },
  qualification_review: { channels:['review'],destination:'advisory',closure:'human_qualification_decision_recorded',campaigns:['inbound-next-decision'] },
  proof_scope_review: { channels:['review'],destination:'advisory',closure:'proof_scope_accepted_recorded',campaigns:['inbound-next-decision'] },
  paid_proof_delivery_handoff: { channels:['delivery'],destination:'mindmake_delivery',closure:'capability_handoff_acknowledged',campaigns:['inbound-next-decision'] },
  trust_asset: { channels:['publication'],destination:'editorial',closure:'trust_asset_published',campaigns:['selected-founder-trust'] },
  speaking_pitch: { channels:['email'],destination:'growth',closure:'speaking_pitch_submitted',campaigns:['relevant-room'] },
  decision_aid: { channels:['publication'],destination:'editorial',closure:'decision_aid_published',campaigns:['practice-decision-aid'] },
  research_task: { channels:['intel'],destination:'company_intel',closure:'research_reviewed',campaigns:['named-cold-decision'] },
  research_enrichment: { channels:['intel'],destination:'company_intel',closure:'research_reviewed',campaigns:['named-cold-decision'] }
} as const;

const ARTIFACT_FIELDS = ['kind','title','body','internal_notes','evidence_ids','recipient_contact_id','channel','destination','closure_event'];
function object(value: unknown, allowed: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || allowed.some(k => !(k in value))) throw new Error(`${path}: invalid fields`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, max = 200) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || value.includes('\u2014')) throw new Error(`${path}: invalid text`); }
function id(value: unknown, path: string) { text(value,path,160); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(String(value)) || /(?:token|secret|password|authorization|signature|api[_-]?key|bearer)[=:]/i.test(String(value))) throw new Error(`${path}: invalid reference`); }
function nullableId(value: unknown, path: string) { if (value !== null) id(value,path); }
function choice(value: unknown, values: readonly string[], path: string) { if (!values.includes(String(value))) throw new Error(`${path}: invalid choice`); }
function count(value: unknown, path: string, max = 100) { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) throw new Error(`${path}: invalid count`); }
function date(value: unknown, path: string) {
  if (typeof value !== 'string') throw new Error(`${path}: invalid timestamp`);
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m || !Number.isFinite(Date.parse(value)) || Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4]) > 59 || Number(m[5] ?? 0) > 23 || Number(m[6] ?? 0) > 59 || new Date(`${m[1]}T12:00:00Z`).toISOString().slice(0,10) !== m[1]) throw new Error(`${path}: invalid timestamp`);
}
function strings(value: unknown, path: string, max: number, length: number, references = false) { if (!Array.isArray(value) || value.length > max) throw new Error(`${path}: invalid list`); value.forEach(v => references ? id(v,path) : text(v,path,length)); if (references && new Set(value).size !== value.length) throw new Error(`${path}: duplicate references`); }

export function parseEngineContext(value: unknown): EngineContext {
  const c = object(value,['version','generated_at','source_revision','complete','snapshot','jobs'],'engine context');
  if (c.version !== 1 || typeof c.complete !== 'boolean') throw new Error('engine context: invalid version or coverage');
  date(c.generated_at,'engine.generated_at'); id(c.source_revision,'engine.source_revision');
  const snapshot = parseSnapshot(c.snapshot);
  if (snapshot.source_revision !== c.source_revision) throw new Error('engine context: source revision mismatch');
  if (!Array.isArray(c.jobs) || c.jobs.length > 100) throw new Error('engine context: invalid jobs');
  c.jobs.forEach(value => {
    const j = object(value,['id','kind','contact_id','source_id','due_at','details'],'job');
    id(j.id,'job.id'); choice(j.kind,JOB_KINDS,'job.kind'); nullableId(j.contact_id,'job.contact_id'); id(j.source_id,'job.source_id');
    if (j.due_at !== null) date(j.due_at,'job.due_at');
    if (!j.details || typeof j.details !== 'object' || Array.isArray(j.details)) throw new Error('job.details: invalid object');
    if (['outreach','trust','speaking','practice'].includes(String(j.kind))) parseMotionJob(j);
    else if (j.kind === 'research') parseResearchJob(j);
    else parseLifecycleJob(j);
  });
  if (new Set(c.jobs.map(j => (j as Record<string, unknown>).id)).size !== c.jobs.length) throw new Error('engine context: duplicate job');
  if (JSON.stringify(c).length > 1_000_000) throw new Error('engine context: payload too large');
  return c as EngineContext;
}

export function parseWorkArtifact(value: unknown): WorkArtifact {
  const a = object(value,ARTIFACT_FIELDS,'work artifact');
  for (const field of ['kind','closure_event']) { id(a[field],`artifact.${field}`); if (!/^[a-z][a-z0-9_]{1,79}$/.test(String(a[field]))) throw new Error(`artifact.${field}: invalid code`); }
  text(a.title,'artifact.title',200); if (/[\r\n]/.test(String(a.title))) throw new Error('artifact.title: header controls');
  text(a.body,'artifact.body',20000); strings(a.internal_notes,'artifact.internal_notes',20,2000); strings(a.evidence_ids,'artifact.evidence_ids',20,160,true); nullableId(a.recipient_contact_id,'artifact.recipient_contact_id');
  choice(a.channel,['review','email','linkedin','publication','delivery','intel'],'artifact.channel');
  choice(a.destination,['growth','advisory','waiting_list','company_intel','mindmake_delivery','editorial'],'artifact.destination');
  const route = ARTIFACT_ROUTES[String(a.kind) as keyof typeof ARTIFACT_ROUTES];
  if (!route || !(route.channels as readonly string[]).includes(String(a.channel)) || route.destination !== a.destination || route.closure !== a.closure_event) throw new Error('artifact: kind, channel, destination or closure mismatch');
  if (['email','linkedin'].includes(String(a.channel)) && a.recipient_contact_id === null) throw new Error('artifact: message recipient required');
  if (!['email','linkedin'].includes(String(a.channel)) && a.recipient_contact_id !== null) throw new Error('artifact: internal or public artifact has no message recipient');
  if (a.channel === 'intel' && a.destination !== 'company_intel') throw new Error('artifact: intelligence destination mismatch');
  if (a.channel === 'delivery' && a.destination !== 'mindmake_delivery') throw new Error('artifact: delivery destination mismatch');
  if (a.channel === 'publication' && a.destination !== 'editorial') throw new Error('artifact: editorial destination mismatch');
  return a as WorkArtifact;
}

export function parseWorkBatch(value: unknown): WorkBatch {
  const b = object(value,['version','run_id','generated_at','source_revision','canon_revision','source_seal','jobs_examined','items','held','report'],'work batch');
  if (b.version !== 1 || typeof b.run_id !== 'string' || !/^gmw-[a-f0-9]{40}$/.test(b.run_id) || typeof b.source_seal !== 'string' || !/^[a-f0-9]{64}$/.test(b.source_seal)) throw new Error('work batch: invalid identity');
  date(b.generated_at,'work.generated_at'); id(b.source_revision,'work.source_revision'); text(b.canon_revision,'work.canon_revision',500); count(b.jobs_examined,'work.jobs_examined');
  if (!Array.isArray(b.items) || b.items.length > 10 || !Array.isArray(b.held) || b.held.length > 100) throw new Error('work batch: invalid dispositions');
  const inputs: unknown[] = [], itemIds: unknown[] = [], recipients: unknown[] = [];
  b.items.forEach(value => {
    const i = object(value,[...ARTIFACT_FIELDS,'item_id','input_id','campaign_id','contact_id','requires_human','approval_state'],'work item');
    const artifact = Object.fromEntries(ARTIFACT_FIELDS.map(k => [k,i[k]])); parseWorkArtifact(artifact);
    if (typeof i.item_id !== 'string' || !/^gwi-[a-f0-9]{32}$/.test(i.item_id) || i.requires_human !== true || i.approval_state !== 'pending') throw new Error('work item: invalid identity or authority');
    id(i.input_id,'item.input_id'); choice(i.campaign_id,CAMPAIGN_IDS,'item.campaign_id'); nullableId(i.contact_id,'item.contact_id');
    const route = ARTIFACT_ROUTES[String(i.kind) as keyof typeof ARTIFACT_ROUTES];
    if (!(route.campaigns as readonly string[]).includes(String(i.campaign_id))) throw new Error('work item: artifact belongs to another campaign');
    if (['trust_asset','decision_aid'].includes(String(i.kind)) ? i.contact_id !== null : !['research_task','research_enrichment'].includes(String(i.kind)) && i.contact_id === null) throw new Error('work item: contact scope mismatch');
    if (['outreach_draft','inbound_reply','speaking_pitch','introduction_connection'].includes(String(i.kind)) && i.recipient_contact_id !== i.contact_id) throw new Error('work item: recipient attribution mismatch');
    if (['introduction_connector_permission','introduction_recipient_permission'].includes(String(i.kind)) && i.recipient_contact_id === i.contact_id) throw new Error('work item: connector must be a separate recipient');
    inputs.push(i.input_id); itemIds.push(i.item_id); if (['email','linkedin'].includes(String(i.channel))) recipients.push(i.recipient_contact_id);
  });
  b.held.forEach(value => { const h = object(value,['input_id','reason'],'work hold'); id(h.input_id,'hold.input_id'); id(h.reason,'hold.reason'); inputs.push(h.input_id); });
  if (inputs.length !== b.jobs_examined || new Set(inputs).size !== inputs.length || new Set(itemIds).size !== itemIds.length || new Set(recipients).size !== recipients.length) throw new Error('work batch: missing, repeated or conflicting disposition');
  const r = object(b.report,['scope','global','prepared','held','deferred','campaign_counts','outreach_analysis','capacity','authority'],'work report');
  if (r.scope !== 'selected_context' || r.global !== false) throw new Error('work report: selected context cannot claim global coverage');
  for (const key of ['prepared','held','deferred','capacity']) count(r[key],`work.report.${key}`);
  if (Number(r.capacity) < 1 || Number(r.capacity) > 10 || b.items.length > Number(r.capacity) || r.prepared !== b.items.length || r.held !== b.held.length || r.deferred !== b.held.filter(h => (h as Record<string, unknown>).reason === 'capacity_deferred').length) throw new Error('work report: inconsistent accounting');
  const analysis = object(r.outreach_analysis,['eligible','held','research_needed'],'outreach analysis'); Object.values(analysis).forEach(v => count(v,'outreach analysis')); if (Number(analysis.research_needed) > Number(analysis.held)) throw new Error('outreach analysis: invalid research count');
  if (!Array.isArray(r.campaign_counts) || r.campaign_counts.length !== CAMPAIGN_IDS.length) throw new Error('work report: campaign coverage missing');
  const campaignIds: unknown[] = []; let prepared = 0, held = 0;
  r.campaign_counts.forEach(value => { const c = object(value,['campaign_id','prepared','held'],'campaign counts'); choice(c.campaign_id,CAMPAIGN_IDS,'campaign.id'); count(c.prepared,'campaign.prepared'); count(c.held,'campaign.held'); campaignIds.push(c.campaign_id); prepared += Number(c.prepared); held += Number(c.held); if (c.prepared !== (b.items as Record<string, unknown>[]).filter(i => i.campaign_id === c.campaign_id).length) throw new Error('work report: campaign prepared mismatch'); });
  if (new Set(campaignIds).size !== CAMPAIGN_IDS.length || prepared !== r.prepared || held !== r.held) throw new Error('work report: inconsistent campaigns');
  text(r.authority,'work.authority',500);
  if (JSON.stringify(b).length > 300000) throw new Error('work batch: payload too large');
  return b as WorkBatch;
}

/** Delivery clocks do not change the persisted work or replay identity. */
export function semanticWorkBatch(batch: WorkBatch): Record<string, unknown> {
  const { generated_at, ...semantic } = batch;
  return semantic;
}
