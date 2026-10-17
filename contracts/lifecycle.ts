/** Canonical private lifecycle inputs. Preparing an artifact changes no lifecycle state. */
export type LifecycleKind = 'introduction'|'inbound'|'qualification'|'proof_scope'|'delivery';
export type OptIn = { status:'pending'|'granted'|'declined'|'revoked'; source_id:string|null; confirmed_at:string|null };
export type IntroductionDetails = { connector_contact_id:string; context:string; channel:'email'|'linkedin'; connector_opt_in:OptIn; recipient_opt_in:OptIn };
export type InboundDetails = { request_id:string; request_kind:'free_brief'|'commercial'|'reply'; received_at:string; request_status:'new'|'acknowledged'|'answered'|'withdrawn'; service_status:'not_started'|'queued'|'delivered'|'failed'|'not_applicable'; response_status:'not_prepared'|'drafted'|'sent'; request_summary:string; channel:'email'|'linkedin'; offer:'brain'|'revenue_engine'|'unknown' };
export type QualificationAnswer = { answer:'yes'|'no'|'unknown'; evidence_ids:string[] };
export type QualificationDetails = { conversation_id:string; held_at:string|null; held_source_id:string|null; checks:{decision_authority:QualificationAnswer;owned_problem:QualificationAnswer;active_need:QualificationAnswer;offer_fit:QualificationAnswer;next_step_agreed:QualificationAnswer}; human_confirmation:{confirmed_by:'krish'|null;confirmed_at:string|null} };
export type ProofScopeDetails = { proof_id:string; qualified_deal_id:string; decision:string; first_version:string; exclusions:string[]; owner_contact_id:string; inputs:string[]; acceptance_criteria:string[]; judge_contact_id:string; client_retained_control:boolean; commercial_terms_ref:string; agreed_next_step:{owner_contact_id:string;due_at:string|null;source_id:string|null} };
export type DeliveryDetails = { proof_id:string; scope:{proof_id:string;status:'accepted'|'draft'|'revoked';signed_at:string|null;source_id:string}; payment:{proof_id:string;status:'verified'|'pending'|'refunded'|'revoked';verified_at:string|null;source_id:string}; delivery_status:'not_started'|'in_progress'|'delivered'|'cancelled'; owner_contact_id:string };
export type LifecycleJob = { id:string;contact_id:string;source_id:string;due_at:string|null } & (
  {kind:'introduction';details:IntroductionDetails}|{kind:'inbound';details:InboundDetails}|{kind:'qualification';details:QualificationDetails}|{kind:'proof_scope';details:ProofScopeDetails}|{kind:'delivery';details:DeliveryDetails}
);

function object(value:unknown, fields:string[], path:string):Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!fields.includes(k)) || fields.some(k=>!Object.hasOwn(value,k))) throw new Error(`${path}: invalid fields`);
  return value as Record<string,unknown>;
}
function text(value:unknown,path:string,max=1500):asserts value is string {
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max||/[\u0000-\u001f\u007f\u2014]/.test(value)) throw new Error(`${path}: invalid text`);
}
function id(value:unknown,path:string) { text(value,path,160); if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(String(value))) throw new Error(`${path}: invalid identity`); }
function choice(value:unknown,values:string[],path:string) { if(typeof value!=='string'||!values.includes(value)) throw new Error(`${path}: invalid choice`); }
function date(value:unknown,path:string) {
  text(value,path,40); const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if(!m||!Number.isFinite(Date.parse(value))||+m[2]>23||+m[3]>59||+m[4]>59||+(m[5]??0)>23||+(m[6]??0)>59||new Date(m[1]+'T12:00:00Z').toISOString().slice(0,10)!==m[1]) throw new Error(`${path}: invalid timestamp`);
}
function nullableDate(value:unknown,path:string) { if(value!==null) date(value,path); }
function nullableId(value:unknown,path:string) { if(value!==null) id(value,path); }
function list(value:unknown,path:string,minimum=1,identities=false) {
  if(!Array.isArray(value)||value.length<minimum||value.length>(identities?3:8)) throw new Error(`${path}: invalid list`);
  value.forEach(v=>identities?id(v,path):text(v,path,400)); if(new Set(value).size!==value.length) throw new Error(`${path}: duplicate value`);
}
function optIn(value:unknown,path:string) {
  const v=object(value,['status','source_id','confirmed_at'],path); choice(v.status,['pending','granted','declined','revoked'],`${path}.status`); nullableId(v.source_id,`${path}.source_id`); nullableDate(v.confirmed_at,`${path}.confirmed_at`);
  if(v.status==='pending' ? v.source_id!==null||v.confirmed_at!==null : v.source_id===null||v.confirmed_at===null) throw new Error(`${path}: status needs matching provenance`);
}
export function parseLifecycleJob(value:unknown):LifecycleJob {
  const j=object(value,['id','kind','contact_id','source_id','due_at','details'],'lifecycle');
  for(const key of ['id','contact_id','source_id']) id(j[key],`lifecycle.${key}`); nullableDate(j.due_at,'lifecycle.due_at');
  choice(j.kind,['introduction','inbound','qualification','proof_scope','delivery'],'lifecycle.kind');
  if(j.kind==='introduction') {
    const d=object(j.details,['connector_contact_id','context','channel','connector_opt_in','recipient_opt_in'],'introduction'); id(d.connector_contact_id,'introduction.connector_contact_id'); text(d.context,'introduction.context',800); choice(d.channel,['email','linkedin'],'introduction.channel'); optIn(d.connector_opt_in,'connector_opt_in'); optIn(d.recipient_opt_in,'recipient_opt_in');
    if(d.connector_contact_id===j.contact_id) throw new Error('introduction: connector must be another person');
  } else if(j.kind==='inbound') {
    const d=object(j.details,['request_id','request_kind','received_at','request_status','service_status','response_status','request_summary','channel','offer'],'inbound'); id(d.request_id,'inbound.request_id'); date(d.received_at,'inbound.received_at'); text(d.request_summary,'inbound.request_summary',1000); choice(d.request_kind,['free_brief','commercial','reply'],'inbound.request_kind'); choice(d.request_status,['new','acknowledged','answered','withdrawn'],'inbound.request_status'); choice(d.service_status,['not_started','queued','delivered','failed','not_applicable'],'inbound.service_status'); choice(d.response_status,['not_prepared','drafted','sent'],'inbound.response_status'); choice(d.channel,['email','linkedin'],'inbound.channel'); choice(d.offer,['brain','revenue_engine','unknown'],'inbound.offer');
    if((d.request_kind==='free_brief')===(d.service_status==='not_applicable')) throw new Error('inbound: service status does not match request kind');
  } else if(j.kind==='qualification') {
    const d=object(j.details,['conversation_id','held_at','held_source_id','checks','human_confirmation'],'qualification'); id(d.conversation_id,'qualification.conversation_id'); nullableDate(d.held_at,'qualification.held_at'); nullableId(d.held_source_id,'qualification.held_source_id');
    if((d.held_at===null)!==(d.held_source_id===null)) throw new Error('qualification: held call needs matching provenance');
    const checks=object(d.checks,['decision_authority','owned_problem','active_need','offer_fit','next_step_agreed'],'qualification.checks');
    for(const [key,value] of Object.entries(checks)) { const c=object(value,['answer','evidence_ids'],key); choice(c.answer,['yes','no','unknown'],`${key}.answer`); list(c.evidence_ids,`${key}.evidence_ids`,c.answer==='unknown'?0:1,true); if(c.answer==='unknown'&&(c.evidence_ids as unknown[]).length) throw new Error(`${key}: unknown must not imply evidence`); }
    const h=object(d.human_confirmation,['confirmed_by','confirmed_at'],'qualification.human_confirmation'); if(h.confirmed_by!==null&&h.confirmed_by!=='krish') throw new Error('qualification: only Krish confirms'); nullableDate(h.confirmed_at,'qualification.confirmed_at'); if((h.confirmed_by===null)!==(h.confirmed_at===null)) throw new Error('qualification: incomplete human confirmation');
  } else if(j.kind==='proof_scope') {
    const d=object(j.details,['proof_id','qualified_deal_id','decision','first_version','exclusions','owner_contact_id','inputs','acceptance_criteria','judge_contact_id','client_retained_control','commercial_terms_ref','agreed_next_step'],'proof_scope');
    for(const key of ['proof_id','qualified_deal_id','owner_contact_id','judge_contact_id','commercial_terms_ref']) id(d[key],`proof_scope.${key}`); for(const key of ['decision','first_version']) text(d[key],`proof_scope.${key}`); for(const key of ['exclusions','inputs','acceptance_criteria']) list(d[key],`proof_scope.${key}`);
    if(typeof d.client_retained_control!=='boolean') throw new Error('proof_scope: retained control must be explicit');
    const n=object(d.agreed_next_step,['owner_contact_id','due_at','source_id'],'proof_scope.agreed_next_step'); id(n.owner_contact_id,'proof_scope.next_owner'); nullableDate(n.due_at,'proof_scope.next_due'); nullableId(n.source_id,'proof_scope.next_source'); if((n.due_at===null)!==(n.source_id===null)) throw new Error('proof_scope: agreed date needs source');
  } else {
    const d=object(j.details,['proof_id','scope','payment','delivery_status','owner_contact_id'],'delivery'); id(d.proof_id,'delivery.proof_id'); id(d.owner_contact_id,'delivery.owner_contact_id'); choice(d.delivery_status,['not_started','in_progress','delivered','cancelled'],'delivery.delivery_status');
    const s=object(d.scope,['proof_id','status','signed_at','source_id'],'delivery.scope'); for(const key of ['proof_id','source_id']) id(s[key],`scope.${key}`); choice(s.status,['accepted','draft','revoked'],'scope.status'); nullableDate(s.signed_at,'scope.signed_at');
    const p=object(d.payment,['proof_id','status','verified_at','source_id'],'delivery.payment'); for(const key of ['proof_id','source_id']) id(p[key],`payment.${key}`); choice(p.status,['verified','pending','refunded','revoked'],'payment.status'); nullableDate(p.verified_at,'payment.verified_at');
    if(s.proof_id!==d.proof_id||p.proof_id!==d.proof_id) throw new Error('delivery: scope and payment must name the same proof');
  }
  return value as LifecycleJob;
}
