import { parseLifecycleJob } from '../../contracts/lifecycle.ts';
import { ageDays, clean, validateContext } from '../guards.mjs';

const CHECKS=['decision_authority','owned_problem','active_need','offer_fit','next_step_agreed'];
const LABELS={decision_authority:'Decision authority',owned_problem:'Owned problem',active_need:'Active need',offer_fit:'Offer fit',next_step_agreed:'Agreed next step'};
const QUESTIONS={decision_authority:'Who owns the decision and can authorise the next step?',owned_problem:'Which problem do they personally own?',active_need:'What makes the need active now?',offer_fit:'Which current Mindmake offer fits the decision, and why?',next_step_agreed:'What next step has the buyer actually agreed?'};
const includes=(fact,value)=>clean(fact).toLowerCase().includes(clean(value).toLowerCase());

/** Pure private preparation. The caller persists approved facts; this stage records none. */
export function prepareLifecycle(value,input,policy,at) {
  const job=parseLifecycleJob(value),snapshot=validateContext(input,policy,at),d=job.details;
  const unavailable=c=>!c||c.suppressed||c.closed||c.consent_status==='blocked';
  const contact=snapshot.contacts.find(c=>c.id===job.contact_id);
  if(unavailable(contact)) return {hold:'lifecycle_contact_unavailable_or_suppressed'};
  if(job.due_at!==null&&Date.parse(job.due_at)>Date.parse(at)) return {hold:'lifecycle_not_due'};
  const evidenceFor=c=>[...c.evidence,...(c.buying_moment?[c.buying_moment]:[])];
  const findSource=(id,c=contact)=>evidenceFor(c).find(e=>e.id===id);
  const current=e=>e&&ageDays(e.observed_at,at)>=0&&ageDays(e.observed_at,at)<=policy.limits.evidence_max_age_days;
  const source=findSource(job.source_id);
  if(!current(source)) return {hold:'lifecycle_source_missing_stale_or_future'};
  const eventSource=(id,eventId,eventAt)=>{ const e=findSource(id); return current(e)&&includes(e.fact,eventId)&&(eventAt===null||Date.parse(eventAt)<=Date.parse(at)&&Date.parse(eventAt)<=Date.parse(e.observed_at))?e:null; };
  const notes=['Private preparation only. Krish must review the exact artifact, recipient and channel before any external action.','No lifecycle status, qualification outcome, payment, send or delivery result is created.'];
  const result=(kind,title,body,evidenceIds,options={})=>({artifact:{kind,title:clean(title).slice(0,200),body,internal_notes:[...notes,...(options.notes??[])],evidence_ids:[...new Set([job.source_id,...evidenceIds])],recipient_contact_id:options.recipient??null,channel:options.channel??'review',destination:options.destination??'advisory',closure_event:options.closure??'human_review_recorded'}});

  if(job.kind==='introduction') {
    const connector=snapshot.contacts.find(c=>c.id===d.connector_contact_id);
    if(unavailable(connector)||connector.consent_status!=='allowed'||!['warm','known'].includes(connector.relationship)) return {hold:'introduction_connector_unavailable_or_unapproved'};
    if(source.visibility!=='public'||!includes(source.fact,d.context)) return {hold:'introduction_context_not_public_and_grounded'};
    const optEvidence=[];
    for(const [which,person,opt] of [['connector',connector,d.connector_opt_in],['recipient',contact,d.recipient_opt_in]]) {
      if(['declined','revoked'].includes(opt.status)) return {hold:`introduction_${which}_permission_${opt.status}`};
      if(opt.status==='granted') {
        const e=findSource(opt.source_id,person);
        if(!current(e)||Date.parse(opt.confirmed_at)>Date.parse(at)||Date.parse(opt.confirmed_at)>Date.parse(e.observed_at)||!includes(e.fact,'introduction')||!includes(e.fact,connector.id)||!includes(e.fact,contact.id)) return {hold:`introduction_${which}_permission_not_evidenced`};
        optEvidence.push(e.id);
      }
    }
    const first=clean(connector.full_name).split(' ')[0],recipient=clean(contact.full_name);
    if(d.connector_opt_in.status==='pending') return result('introduction_connector_permission',`Ask ${connector.full_name} about one introduction`,`${first}, would you be comfortable with a short introduction to ${recipient} about ${clean(d.context)}? We would check with them separately before connecting anyone. Fine to leave it if the timing is wrong.`,optEvidence,{recipient:connector.id,channel:d.channel,destination:'waiting_list',closure:'connector_opt_in_recorded'});
    if(d.recipient_opt_in.status==='pending') return result('introduction_recipient_permission',`Ask ${connector.full_name} to check with ${recipient}`,`${first}, would you check whether ${recipient} would find a short introduction about ${clean(d.context)} useful? Please wait for their explicit yes. No need to share any private brief or commercial detail.`,optEvidence,{recipient:connector.id,channel:d.channel,destination:'waiting_list',closure:'recipient_opt_in_recorded'});
    if(contact.consent_status!=='allowed') return {hold:'introduction_recipient_permission_not_current'};
    return result('introduction_connection',`Prepare the agreed introduction to ${recipient}`,`${clean(contact.full_name).split(' ')[0]}, ${clean(connector.full_name)} has confirmed the introduction is welcome. The context is ${clean(d.context)}. Would a short exchange on the decision be useful?`,optEvidence,{recipient:contact.id,channel:d.channel,destination:'waiting_list',closure:'introduction_sent_recorded',notes:['Both separate, current opt-ins are evidenced. Share no other private context or attachment.']});
  }

  if(job.kind==='inbound') {
    if(!eventSource(job.source_id,d.request_id,d.received_at)||!includes(source.fact,d.request_summary)) return {hold:'inbound_request_not_evidenced'};
    if(['answered','withdrawn'].includes(d.request_status)||d.response_status!=='not_prepared') return {hold:'inbound_already_handled_or_withdrawn'};
    if(d.request_kind==='free_brief') {
      if(['queued','delivered'].includes(d.service_status)) return {hold:'inbound_service_already_queued_or_delivered'};
      return result('inbound_service_review',`Review free brief request ${d.request_id}`,`REQUEST\n${clean(d.request_summary)}\n\nACTUAL SERVICE STATUS\n${d.service_status}\n\nOWNER ACTION\n${d.service_status==='failed'?'Inspect the existing brief service failure and decide whether its own recovery path should run.':'Verify the request in the existing Mindmake brief service and route it through that service.'}\n\nNo duplicate service reply or automatic sales follow-up is prepared. Any service recovery and delivery remain with Mindmake.`,[],{destination:'mindmake_delivery',closure:'brief_service_review_recorded'});
    }
    if(contact.consent_status!=='allowed') return {hold:'inbound_reply_permission_requires_review'};
    const offer=d.offer==='unknown'?'':`\n\n${d.offer==='brain'?snapshot.canon.brain_description:snapshot.canon.revenue_description}`;
    return result('inbound_reply',`Reply to ${contact.full_name}'s request`,`${clean(contact.full_name).split(' ')[0]}, thanks for the note about ${clean(d.request_summary)}.${offer}\n\nWhich decision are you trying to make?`,[],{recipient:contact.id,channel:d.channel,destination:'waiting_list',closure:'inbound_reply_sent_recorded',notes:['Reply only inside the evidenced request thread. This is one clarifying question, with no offer, fee, appointment or result promised.']});
  }

  if(job.kind==='qualification') {
    if(!includes(source.fact,d.conversation_id)) return {hold:'qualification_conversation_not_evidenced'};
    const held=d.held_at!==null?eventSource(d.held_source_id,d.conversation_id,d.held_at):null;
    if(d.held_at!==null&&!held) return {hold:'qualification_held_call_not_evidenced'};
    const ids=[];
    for(const key of CHECKS) for(const id of d.checks[key].evidence_ids) { const e=eventSource(id,d.conversation_id,null); if(!e) return {hold:'qualification_check_not_evidenced'}; ids.push(id); }
    const h=d.human_confirmation;
    if(h.confirmed_at!==null&&(Date.parse(h.confirmed_at)>Date.parse(at)||d.held_at===null||Date.parse(h.confirmed_at)<Date.parse(d.held_at))) return {hold:'qualification_human_confirmation_clock_invalid'};
    const allYes=CHECKS.every(k=>d.checks[k].answer==='yes'),confirmed=h.confirmed_by==='krish'&&h.confirmed_at!==null;
    const state=held&&allYes&&confirmed?'Evidence is ready for a human qualification decision.':!held?'No evidenced held conversation. This is preparation only.':!allYes?'The conversation is held, but qualification is incomplete or negative.':'All five checks have evidence; Krish has not confirmed them.';
    const checks=CHECKS.map(k=>`${LABELS[k]}: ${d.checks[k].answer.toUpperCase()}\nEvidence: ${d.checks[k].evidence_ids.length?d.checks[k].evidence_ids.join(', '):'none'}${d.checks[k].answer==='yes'?'':`\nReview question: ${QUESTIONS[k]}`}`).join('\n\n');
    return result('qualification_review',`Review ${contact.full_name}'s conversation`, `CONVERSATION\n${d.conversation_id}\nHeld: ${d.held_at??'not established'}\n\nFIVE CHECKS\n${checks}\n\nHUMAN CONFIRMATION\n${confirmed?`Krish, ${h.confirmed_at}`:'Not recorded'}\n\nDISPOSITION\n${state}\nOnly a separately persisted human-confirmed qualification event for this held conversation can count towards the weekly target. This artifact does not count.`,[...ids,...(held?[held.id]:[])],{closure:'human_qualification_decision_recorded'});
  }

  const sameClient=id=>{ const c=snapshot.contacts.find(x=>x.id===id); return !unavailable(c)&&c.company===contact.company?c:null; };
  if(job.kind==='proof_scope') {
    if(!includes(source.fact,d.proof_id)||!includes(source.fact,d.qualified_deal_id)) return {hold:'proof_scope_not_evidenced'};
    const deal=snapshot.deals.find(x=>x.id===d.qualified_deal_id&&x.contact_id===contact.id),q=deal?.qualification;
    if(!deal?.call_taken_at||!deal.qualified_at||!q||q.confirmed_by!=='krish'||!CHECKS.every(k=>q[k]===true)||[deal.call_taken_at,deal.qualified_at,q.confirmed_at].some(t=>Date.parse(t)>Date.parse(at))||Date.parse(q.confirmed_at)<Date.parse(deal.call_taken_at)||Date.parse(deal.qualified_at)<Date.parse(deal.call_taken_at)) return {hold:'proof_scope_requires_actual_human_qualified_conversation'};
    const terms=findSource(d.commercial_terms_ref);
    if(!current(terms)||terms.visibility!=='private'||!includes(terms.fact,d.proof_id)||!includes(terms.fact,'commercial terms')) return {hold:'proof_scope_private_commercial_terms_not_evidenced'};
    if(!d.client_retained_control) return {hold:'proof_scope_client_control_not_retained'};
    if(!sameClient(d.owner_contact_id)||!sameClient(d.judge_contact_id)||!sameClient(d.agreed_next_step.owner_contact_id)) return {hold:'proof_scope_owner_or_judge_not_scoped'};
    const next=d.agreed_next_step;
    if(next.due_at===null||next.source_id===null) return {hold:'proof_scope_next_step_not_agreed'};
    const e=eventSource(next.source_id,d.proof_id,null);
    if(!e||!includes(e.fact,next.owner_contact_id)||!includes(e.fact,next.due_at)) return {hold:'proof_scope_next_step_not_evidenced'};
    const body=`PROPOSED PRIVATE PROOF SCOPE\nProof: ${d.proof_id}\nQualified conversation record: ${deal.id}\n\nONE DECISION\n${clean(d.decision)}\n\nFIRST VERSION\n${clean(d.first_version)}\n\nEXCLUDED\n${d.exclusions.map(clean).join('\n')}\n\nCLIENT OWNER\n${sameClient(d.owner_contact_id).full_name}\n\nINPUTS NEEDED\n${d.inputs.map(clean).join('\n')}\n\nACCEPTANCE CRITERIA\n${d.acceptance_criteria.map(clean).join('\n')}\n\nWHO JUDGES\n${sameClient(d.judge_contact_id).full_name}\n\nCLIENT CONTROL\nThe client retains approval, ownership and the decision to accept the work.\n\nCOMMERCIAL TERMS\nPrivate canonical reference: ${terms.id}\n${terms.url}\nRetrieve and review those terms before approval. No fee or terms are created here.\n\nACTUALLY AGREED NEXT STEP\nOwner: ${sameClient(next.owner_contact_id).full_name}\nDue: ${next.due_at}\nEvidence: ${next.source_id}\n\nReview this proposed scope with the client. This artifact is not signed acceptance, a payment request or permission to begin delivery.`;
    return result('proof_scope_review',`${contact.company}: one-decision proof scope`,body,[e.id,terms.id],{closure:'proof_scope_accepted_recorded'});
  }

  if(!includes(source.fact,d.proof_id)) return {hold:'delivery_proof_not_evidenced'};
  if(d.scope.status!=='accepted'||d.scope.signed_at===null) return {hold:'delivery_scope_not_signed_and_accepted'};
  if(d.payment.status!=='verified'||d.payment.verified_at===null) return {hold:'delivery_payment_not_verified_or_reversed'};
  if(d.delivery_status!=='not_started') return {hold:'delivery_already_started_finished_or_cancelled'};
  if(!sameClient(d.owner_contact_id)) return {hold:'delivery_client_owner_not_scoped'};
  const scope=eventSource(d.scope.source_id,d.proof_id,d.scope.signed_at),payment=eventSource(d.payment.source_id,d.proof_id,d.payment.verified_at);
  if(!scope||!payment||scope.id===payment.id||scope.visibility!=='private'||payment.visibility!=='private') return {hold:'delivery_scope_or_payment_provenance_missing'};
  return result('paid_proof_delivery_handoff',`${contact.company}: paid proof handoff`,`PRIVATE CAPABILITY HANDOFF\nProof: ${d.proof_id}\nClient owner: ${sameClient(d.owner_contact_id).full_name}\n\nSIGNED ACCEPTED SCOPE\nCanonical source: ${scope.id}\n${scope.url}\nSigned: ${d.scope.signed_at}\n\nVERIFIED PAYMENT\nCanonical source: ${payment.id}\n${payment.url}\nVerified: ${d.payment.verified_at}\n\nCAPABILITY OWNER ACTION\nRetrieve this proof's accepted scope and private terms using the exact private source references above. The planner has not fetched or reproduced the full accepted scope. No execution may start until the capability owner has read its decision, first version, inputs, exclusions, acceptance criteria, judge and retained client control. Keep all client material in its permitted scope.\n\nThis handoff grants no send, spend or delivery-result authority. Delivery remains with Mindmake. A matching persisted capability acknowledgement closes this handoff; completion and client acceptance require their own evidence.`,[scope.id,payment.id],{channel:'delivery',destination:'mindmake_delivery',closure:'capability_handoff_acknowledged',notes:['Full accepted scope content is not in this handoff. Its canonical retrieval and client-control check remain explicit capability gates.']});
}
