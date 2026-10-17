import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPROVED_CANON } from '../contracts/growth.ts';
import { parseLifecycleJob } from '../contracts/lifecycle.ts';
import { parseWorkArtifact } from '../contracts/engine.ts';
import { prepareLifecycle } from '../src/stages/lifecycle.mjs';

const AT='2026-10-17T12:00:00Z',OBSERVED='2026-10-17T11:00:00Z',HELD='2026-10-16T17:00:00Z';
const policy=JSON.parse(readFileSync(new URL('../config/policy.json',import.meta.url)));
const checks=['decision_authority','owned_problem','active_need','offer_fit','next_step_agreed'];
const evidence=(id,fact,visibility='private')=>({id,kind:'relationship',visibility,fact,url:`https://example.test/evidence/${id}`,observed_at:OBSERVED});
function fixture(kind) {
  const contact={id:'contact-1',full_name:'Alex Example',title:'Founder',company:'Example Studio',relationship:'warm',suppressed:false,closed:false,consent_status:'allowed',evidence:[evidence('main','proof-1 deal-1 conv-1 request-1 pricing decision','public'),evidence('held','conv-1 was a held conversation'),...checks.map(k=>evidence(k,`conv-1 ${k} established with the buyer`)),evidence('scope','proof-1 signed accepted scope'),evidence('payment','proof-1 verified payment'),evidence('terms','proof-1 private canonical commercial terms'),evidence('next','proof-1 contact-1 2026-10-18T12:00:00Z'),evidence('recipient-permission','introduction contact-1 connector-1 explicitly agreed')],offer_fit:'brain',why_fit:'Supplied test fit',decision_authority:'unknown'};
  const connector={...structuredClone(contact),id:'connector-1',full_name:'Sam Example',company:'Example Network',evidence:[evidence('connector-permission','introduction contact-1 connector-1 explicitly agreed')]};
  const snapshot={version:1,generated_at:OBSERVED,source_revision:'synthetic-lifecycle-v1',complete:true,icp:{defined:true,definition:'Founders with an active decision',buyer_titles:['Founder'],industries:[],exclusions:[]},canon:APPROVED_CANON,contacts:[contact,connector],deals:[{id:'deal-1',contact_id:'contact-1',state:'qualified',call_taken_at:HELD,qualified_at:'2026-10-17T10:00:00Z',qualification:{...Object.fromEntries(checks.map(k=>[k,true])),confirmed_by:'krish',confirmed_at:'2026-10-17T10:00:00Z'}}]};
  const granted=source_id=>({status:'granted',source_id,confirmed_at:'2026-10-17T10:00:00Z'}),pending={status:'pending',source_id:null,confirmed_at:null};
  const details={
    introduction:{connector_contact_id:'connector-1',context:'pricing decision',channel:'email',connector_opt_in:granted('connector-permission'),recipient_opt_in:granted('recipient-permission')},
    inbound:{request_id:'request-1',request_kind:'commercial',received_at:HELD,request_status:'new',service_status:'not_applicable',response_status:'not_prepared',request_summary:'pricing decision',channel:'email',offer:'brain'},
    qualification:{conversation_id:'conv-1',held_at:HELD,held_source_id:'held',checks:Object.fromEntries(checks.map(k=>[k,{answer:'yes',evidence_ids:[k]}])),human_confirmation:{confirmed_by:'krish',confirmed_at:'2026-10-17T10:00:00Z'}},
    proof_scope:{proof_id:'proof-1',qualified_deal_id:'deal-1',decision:'Choose whether to change the pricing decision process',first_version:'A decision aid tested against one supplied decision',exclusions:['No organisation-wide rollout'],owner_contact_id:'contact-1',inputs:['One permitted decision record'],acceptance_criteria:['The named judge can compare both options against their own standard'],judge_contact_id:'contact-1',client_retained_control:true,commercial_terms_ref:'terms',agreed_next_step:{owner_contact_id:'contact-1',due_at:'2026-10-18T12:00:00Z',source_id:'next'}},
    delivery:{proof_id:'proof-1',scope:{proof_id:'proof-1',status:'accepted',signed_at:HELD,source_id:'scope'},payment:{proof_id:'proof-1',status:'verified',verified_at:HELD,source_id:'payment'},delivery_status:'not_started',owner_contact_id:'contact-1'}
  };
  return {job:{id:`job-${kind}`,kind,contact_id:'contact-1',source_id:'main',due_at:null,details:structuredClone(details[kind])},snapshot,pending,granted};
}
const run=f=>prepareLifecycle(f.job,f.snapshot,policy,AT);

test('all lifecycle kinds produce bounded draft artifacts without changing inputs',()=>{
  for(const kind of ['introduction','inbound','qualification','proof_scope','delivery']) {
    const f=fixture(kind),before=structuredClone({job:f.job,snapshot:f.snapshot}),first=run(f),second=run(f);
    assert.deepEqual({job:f.job,snapshot:f.snapshot},before); assert.deepEqual(first,second); assert.ok(first.artifact); parseWorkArtifact(first.artifact); assert.ok(first.artifact.evidence_ids.includes('main'));
    assert.deepEqual(Object.keys(first.artifact).sort(),['kind','title','body','internal_notes','evidence_ids','recipient_contact_id','channel','destination','closure_event'].sort());
    assert.ok(first.artifact.internal_notes.some(n=>n.includes('Krish must review'))); assert.ok(!JSON.stringify(first).includes('\u2014'));
  }
});

test('maximum scope detail sizes remain inside the shared artifact contract',()=>{
  const f=fixture('proof_scope');
  for(const key of ['exclusions','inputs','acceptance_criteria']) f.job.details[key]=Array.from({length:8},(_,i)=>`${i}${'x'.repeat(399)}`);
  f.job.details.decision='d'.repeat(1500);f.job.details.first_version='v'.repeat(1500);
  const artifact=run(f).artifact;assert.ok(artifact.body.length<20000);parseWorkArtifact(artifact);
});

test('lifecycle parser rejects missing and unknown fields, external actions and false dates',()=>{
  for(const mutate of [f=>{f.job.send=true;},f=>{delete f.job.contact_id;},f=>{f.job.contact_id=null;},f=>{f.job.id='';},f=>{f.job.due_at='2026-02-30T12:00:00Z';},f=>{f.job.due_at='2026-10-17T12:00:00+00:99';},f=>{f.job.details.recipient_email='test@example.test';}]) {
    const f=fixture('inbound');mutate(f);assert.throws(()=>parseLifecycleJob(f.job));
  }
});

test('shared stage gates stop suppression, closed people, blocked permission and missing contacts',()=>{
  for(const mutate of [f=>{f.snapshot.contacts[0].suppressed=true;},f=>{f.snapshot.contacts[0].closed=true;},f=>{f.snapshot.contacts[0].consent_status='blocked';},f=>{f.job.contact_id='absent';}]) {
    const f=fixture('qualification');mutate(f);assert.equal(run(f).hold,'lifecycle_contact_unavailable_or_suppressed');
  }
});

test('source ownership, run freshness, source clock and due time are enforced',()=>{
  const missing=fixture('inbound');missing.job.source_id='connector-permission';assert.equal(run(missing).hold,'lifecycle_source_missing_stale_or_future');
  const future=fixture('inbound');future.snapshot.contacts[0].evidence[0].observed_at='2026-10-17T13:00:00Z';assert.equal(run(future).hold,'lifecycle_source_missing_stale_or_future');
  const stale=fixture('inbound');stale.snapshot.contacts[0].evidence[0].observed_at='2026-01-01T00:00:00Z';assert.equal(run(stale).hold,'lifecycle_source_missing_stale_or_future');
  const due=fixture('inbound');due.job.due_at='2026-10-18T12:00:00Z';assert.equal(run(due).hold,'lifecycle_not_due');
  const context=fixture('inbound');context.snapshot.generated_at='2026-10-15T00:00:00Z';assert.throws(()=>run(context),/stale/);
});

test('introduction asks the connector first and does not imply either opt-in',()=>{
  const f=fixture('introduction');f.job.details.connector_opt_in=f.pending;f.job.details.recipient_opt_in=f.pending;
  const a=run(f).artifact;assert.equal(a.kind,'introduction_connector_permission');assert.equal(a.recipient_contact_id,'connector-1');assert.equal(a.closure_event,'connector_opt_in_recorded');assert.match(a.body,/check with them separately/);
});

test('one opt-in prepares only a separate recipient permission request through the connector',()=>{
  const f=fixture('introduction');f.job.details.recipient_opt_in=f.pending;
  const a=run(f).artifact;assert.equal(a.kind,'introduction_recipient_permission');assert.equal(a.recipient_contact_id,'connector-1');assert.equal(a.closure_event,'recipient_opt_in_recorded');assert.match(a.body,/explicit yes/);
});

test('connection requires both current opt-ins attached to their actual identities',()=>{
  const f=fixture('introduction');assert.equal(run(f).artifact.recipient_contact_id,'contact-1');
  f.job.details.recipient_opt_in.source_id='connector-permission';assert.equal(run(f).hold,'introduction_recipient_permission_not_evidenced');
  const context=fixture('introduction');context.snapshot.contacts[0].evidence.find(e=>e.id==='recipient-permission').fact='Introduction agreed without the named people';assert.equal(run(context).hold,'introduction_recipient_permission_not_evidenced');
  const consent=fixture('introduction');consent.snapshot.contacts[0].consent_status='unknown';assert.equal(run(consent).hold,'introduction_recipient_permission_not_current');
});

test('introduction honours declined and revoked permission, connector safety and private context',()=>{
  for(const status of ['declined','revoked']) {const f=fixture('introduction');f.job.details.recipient_opt_in.status=status;assert.equal(run(f).hold,`introduction_recipient_permission_${status}`);}
  const privateContext=fixture('introduction');privateContext.snapshot.contacts[0].evidence[0].visibility='private';assert.equal(run(privateContext).hold,'introduction_context_not_public_and_grounded');
  const unknown=fixture('introduction');unknown.snapshot.contacts[1].consent_status='unknown';assert.equal(run(unknown).hold,'introduction_connector_unavailable_or_unapproved');
  const future=fixture('introduction');future.job.details.connector_opt_in.confirmed_at='2026-10-17T13:00:00Z';assert.equal(run(future).hold,'introduction_connector_permission_not_evidenced');
});

test('inbound reply is grounded in the actual request and only addresses its owner',()=>{
  const f=fixture('inbound'),a=run(f).artifact;assert.equal(a.kind,'inbound_reply');assert.equal(a.channel,'email');assert.equal(a.recipient_contact_id,'contact-1');assert.match(a.body,/Which decision are you trying to make\?/);assert.doesNotMatch(a.body,/book|price|\u00a3|paid proof/i);
  f.job.details.request_summary='Unsupported new claim';assert.equal(run(f).hold,'inbound_request_not_evidenced');
  const wrong=fixture('inbound');wrong.job.details.request_id='another-request';assert.equal(run(wrong).hold,'inbound_request_not_evidenced');
});

test('inbound actual response and request statuses prevent duplicate replies',()=>{
  for(const status of ['drafted','sent']) {const f=fixture('inbound');f.job.details.response_status=status;assert.equal(run(f).hold,'inbound_already_handled_or_withdrawn');}
  for(const status of ['answered','withdrawn']) {const f=fixture('inbound');f.job.details.request_status=status;assert.equal(run(f).hold,'inbound_already_handled_or_withdrawn');}
  const unknown=fixture('inbound');unknown.snapshot.contacts[0].consent_status='unknown';assert.equal(run(unknown).hold,'inbound_reply_permission_requires_review');
});

test('brief service never receives a duplicate service email or automatic sales sequence',()=>{
  for(const status of ['not_started','failed','queued','delivered']) {
    const f=fixture('inbound');f.job.details.request_kind='free_brief';f.job.details.service_status=status;
    const result=run(f);
    if(['queued','delivered'].includes(status)) assert.equal(result.hold,'inbound_service_already_queued_or_delivered');
    else {assert.equal(result.artifact.kind,'inbound_service_review');assert.equal(result.artifact.channel,'review');assert.equal(result.artifact.recipient_contact_id,null);assert.equal(result.artifact.destination,'mindmake_delivery');assert.match(result.artifact.body,/No duplicate service reply/);}
  }
});

test('qualification is a five-check human review, never a qualified outcome',()=>{
  const f=fixture('qualification'),a=run(f).artifact;assert.equal(a.kind,'qualification_review');assert.equal(a.recipient_contact_id,null);assert.equal(a.channel,'review');assert.equal(a.closure_event,'human_qualification_decision_recorded');assert.match(a.body,/This artifact does not count/);assert.match(a.body,/ready for a human qualification decision/);
  for(const label of ['Decision authority','Owned problem','Active need','Offer fit','Agreed next step']) assert.ok(a.body.includes(`${label}: YES`));
});

test('not-held, incomplete, negative and unconfirmed qualification states remain honest',()=>{
  const notHeld=fixture('qualification');notHeld.job.details.held_at=null;notHeld.job.details.held_source_id=null;notHeld.job.details.human_confirmation={confirmed_by:null,confirmed_at:null};assert.match(run(notHeld).artifact.body,/No evidenced held conversation/);
  const unknown=fixture('qualification');unknown.job.details.checks.active_need={answer:'unknown',evidence_ids:[]};assert.match(run(unknown).artifact.body,/Active need: UNKNOWN/);assert.match(run(unknown).artifact.body,/incomplete or negative/);
  const no=fixture('qualification');no.job.details.checks.offer_fit.answer='no';assert.match(run(no).artifact.body,/Offer fit: NO/);
  const unconfirmed=fixture('qualification');unconfirmed.job.details.human_confirmation={confirmed_by:null,confirmed_at:null};assert.match(run(unconfirmed).artifact.body,/Krish has not confirmed/);
});

test('qualification checks and held call must resolve current same-conversation evidence',()=>{
  const missing=fixture('qualification');missing.job.details.held_source_id='connector-permission';assert.equal(run(missing).hold,'qualification_held_call_not_evidenced');
  const different=fixture('qualification');different.snapshot.contacts[0].evidence.find(e=>e.id==='active_need').fact='another-conversation need';assert.equal(run(different).hold,'qualification_check_not_evidenced');
  const yes=fixture('qualification');yes.job.details.checks.offer_fit.evidence_ids=[];assert.throws(()=>run(yes),/invalid list/);
  const unknown=fixture('qualification');unknown.job.details.checks.offer_fit.answer='unknown';assert.throws(()=>run(unknown),/unknown must not imply evidence/);
  const fakeHuman=fixture('qualification');fakeHuman.job.details.human_confirmation.confirmed_by='agent';assert.throws(()=>run(fakeHuman),/only Krish/);
  const badClock=fixture('qualification');badClock.job.details.human_confirmation.confirmed_at='2026-10-16T16:00:00Z';assert.equal(run(badClock).hold,'qualification_human_confirmation_clock_invalid');
});

test('proof scope includes bounded work, control, private terms and actual agreed next step',()=>{
  const f=fixture('proof_scope'),a=run(f).artifact;assert.equal(a.kind,'proof_scope_review');assert.equal(a.channel,'review');assert.equal(a.recipient_contact_id,null);
  for(const part of ['ONE DECISION','FIRST VERSION','EXCLUDED','CLIENT OWNER','INPUTS NEEDED','ACCEPTANCE CRITERIA','WHO JUDGES','CLIENT CONTROL','COMMERCIAL TERMS','ACTUALLY AGREED NEXT STEP']) assert.ok(a.body.includes(part));
  assert.match(a.body,/2026-10-18T12:00:00Z/);assert.match(a.body,/not signed acceptance/);assert.doesNotMatch(a.body,/[\u00a3$\u20ac]|guarantee/i);
});

test('scope cannot invent agreed dates, private fees, owner identity or client control',()=>{
  const missing=fixture('proof_scope');missing.job.details.agreed_next_step.due_at=null;missing.job.details.agreed_next_step.source_id=null;assert.equal(run(missing).hold,'proof_scope_next_step_not_agreed');
  const mismatch=fixture('proof_scope');mismatch.job.details.agreed_next_step.due_at='2026-10-19T12:00:00Z';assert.equal(run(mismatch).hold,'proof_scope_next_step_not_evidenced');
  const owner=fixture('proof_scope');owner.job.details.owner_contact_id='connector-1';assert.equal(run(owner).hold,'proof_scope_owner_or_judge_not_scoped');
  const control=fixture('proof_scope');control.job.details.client_retained_control=false;assert.equal(run(control).hold,'proof_scope_client_control_not_retained');
  const fee=fixture('proof_scope');fee.job.details.commercial_terms_ref='\u00a31000';assert.throws(()=>run(fee),/invalid identity/);
});

test('proof scope requires an actual human-qualified held deal and private canonical terms',()=>{
  for(const mutate of [f=>{f.snapshot.deals=[];},f=>{f.snapshot.deals[0].qualification.active_need=false;},f=>{delete f.snapshot.deals[0].call_taken_at;},f=>{f.snapshot.deals[0].qualified_at='2026-10-18T00:00:00Z';},f=>{f.snapshot.deals[0].contact_id='connector-1';}]) {
    const f=fixture('proof_scope');mutate(f);assert.equal(run(f).hold,'proof_scope_requires_actual_human_qualified_conversation');
  }
  for(const mutate of [f=>{f.job.details.commercial_terms_ref='not-found';},f=>{f.snapshot.contacts[0].evidence.find(e=>e.id==='terms').visibility='public';},f=>{f.snapshot.contacts[0].evidence.find(e=>e.id==='terms').fact='proof-2 private canonical commercial terms';}]) {
    const f=fixture('proof_scope');mutate(f);assert.equal(run(f).hold,'proof_scope_private_commercial_terms_not_evidenced');
  }
});

test('delivery handoff requires same-proof signed acceptance and distinct verified payment evidence',()=>{
  const f=fixture('delivery'),a=run(f).artifact;assert.equal(a.kind,'paid_proof_delivery_handoff');assert.equal(a.channel,'delivery');assert.equal(a.destination,'mindmake_delivery');assert.equal(a.recipient_contact_id,null);assert.equal(a.closure_event,'capability_handoff_acknowledged');assert.match(a.body,/completion and client acceptance require their own evidence/);assert.doesNotMatch(a.body,/work is complete|delivered successfully/i);
  const wrong=fixture('delivery');wrong.job.details.payment.proof_id='proof-2';assert.throws(()=>run(wrong),/same proof/);
  const reused=fixture('delivery');reused.job.details.payment.source_id='scope';assert.equal(run(reused).hold,'delivery_scope_or_payment_provenance_missing');
  const another=fixture('delivery');another.snapshot.contacts[0].evidence.find(e=>e.id==='payment').fact='proof-2 verified payment';assert.equal(run(another).hold,'delivery_scope_or_payment_provenance_missing');
  const publicPayment=fixture('delivery');publicPayment.snapshot.contacts[0].evidence.find(e=>e.id==='payment').visibility='public';assert.equal(run(publicPayment).hold,'delivery_scope_or_payment_provenance_missing');
});

test('revocation, refunds and already-running delivery cannot create a handoff',()=>{
  for(const status of ['draft','revoked']) {const f=fixture('delivery');f.job.details.scope.status=status;assert.equal(run(f).hold,'delivery_scope_not_signed_and_accepted');}
  for(const status of ['pending','refunded','revoked']) {const f=fixture('delivery');f.job.details.payment.status=status;assert.equal(run(f).hold,'delivery_payment_not_verified_or_reversed');}
  for(const status of ['in_progress','delivered','cancelled']) {const f=fixture('delivery');f.job.details.delivery_status=status;assert.equal(run(f).hold,'delivery_already_started_finished_or_cancelled');}
  const future=fixture('delivery');future.job.details.payment.verified_at='2026-10-17T13:00:00Z';assert.equal(run(future).hold,'delivery_scope_or_payment_provenance_missing');
});
