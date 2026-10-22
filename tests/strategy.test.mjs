import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strategicPlan, outcomeScorecard, validateStrategicRead } from '../src/strategy.mjs';
import { runDispatch, payloadDigest } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { readFile } from 'node:fs/promises';

const NOW = '2026-10-25T12:00:00Z';
const campaign = (id, motion='multiplier', extra={}) => ({ id, contact_id:id, growth_context:{ campaign:{ title:'A useful founder decision', motion, reviewed_at:NOW, state:'prepared', access:4,authority:4,distribution:5,proof_strength:3,timing:3,effort:2,argument:'AI that can apply a leader\'s judgement to a live commercial decision.',commitment:'A 30-minute demonstration',preparation:'An anonymised worked example.',follow_through:'Agree a two-week pilot on one workflow, only if useful.',success_measure:'A held intro and an agreed decision.',sources:[{url:'https://example.org/research',observed_at:NOW}],proof:[{id:'cleared',permission:'approved',source_url:'https://example.org/proof',allowed_use:'Anonymised private example'}],route:{kind:'rich',evidence:'A sourced founder programme, no assumed relationship.'},first_action:{recipient_contact_id:id,channel:'email',subject:'A founder decision',body:'Would a short demonstration be useful?'},...extra } } });
const context = records => ({schema_version:'1.3.0',engine_id:'growth-mindmake',product_slug:'mindmake',observed_at:NOW,coverage:[{source:'advisory',available:true,complete:true}],proof_permissions:{value:{assets:[{id:'cleared',permission:'approved',source_url:'https://example.org/proof',allowed_use:'Anonymised private example'}]}},records});
const outcomes = (rows=[], complete=true) => ({...context({advisory:rows}),timezone:'Europe/London',activated_on:'2026-10-18',windows:{week:{start:'2026-10-18T23:00:00Z',end:'2026-10-26T00:00:00Z'},first_30_days:{start:'2026-10-17T23:00:00Z',end:'2026-11-17T00:00:00Z'}},coverage:[{source:'advisory',available:true,complete}],unavailable:['free_pilots_completed']});

test('strategic selection reserves 70 percent for access, honours replies and deduplicates recipients across native lanes',()=>{
  const rows=[...Array.from({length:7},(_,i)=>campaign(`m${i}`)),...Array.from({length:5},(_,i)=>campaign(`d${i}`,'direct'))];
  rows.push(campaign('reply','direct',{reply_waiting:true}));
  const c=context({advisory:rows,visibility:[{...campaign('m0','institution'),room_score:5,standing_score:4,only_him_score:4,score_version:1,verdict:'take'}]});
  const plan=strategicPlan(c,{at:NOW,capacity:10});
  assert.equal(plan.selected[0].record_id,'reply');
  assert.equal(plan.selected.length,10);
  assert.equal(plan.selected.filter(c=>c.motion!=='direct').length,6);
  assert.ok(plan.held.some(h=>h.reason==='recipient_already_selected'));
  assert.equal(plan.review.id,'mindmake:strategy:2026-10-19');
});
test('a campaign cannot bypass proof, route, full preparation or Visibility gates',()=>{
  const rows=[campaign('a','multiplier',{proof:[]}),campaign('b','multiplier',{route:{kind:'none'}}),campaign('c','direct',{preparation:''})];
  const result=strategicPlan(context({advisory:rows,visibility:[campaign('d','visibility')]}),{at:NOW});
  assert.equal(result.selected.length,0);
  assert.deepEqual(result.held.map(h=>h.reason),['proof_permission_missing','campaign_route_missing','campaign_incomplete','visibility_standard_held']);
});
test('global outcomes distinguish bookings, held people, human qualification and independent payment; partial reads stay unknown',()=>{
  const q={confirmed_by:'krish',confirmed_at:NOW,decision_authority:true,owned_problem:true,active_need:true,offer_fit:true,next_step_agreed:true};
  const rows=[{id:'a',contact_id:'one',call_taken_at:'2026-10-24T10:00:00Z',qualified_at:NOW,qualification:q},{id:'b',contact_id:'one',call_taken_at:NOW},{id:'c',contact_id:'two',call_booked_at:NOW},{id:'d',contact_id:'three',call_taken_at:'2026-10-26T00:00:00Z'},{id:'e',contact_id:'four',pilot_paid_at:NOW}];
  const readings=outcomeScorecard(outcomes(rows),NOW);
  assert.equal(readings[0].value,1); assert.equal(readings[1].value,1); assert.equal(readings[2].value,null);
  rows.at(-1).growth_context={payment:{verified:true,receipt_id:'provider-receipt',verified_at:NOW}};
  assert.equal(outcomeScorecard(outcomes(rows),NOW)[2].value,1);
  assert.ok(outcomeScorecard(outcomes(rows,false),NOW).every(r=>r.value===null));
  rows[0].qualification.confirmed_at='2026-10-23T10:00:00Z';
  assert.equal(outcomeScorecard(outcomes(rows),NOW)[1].value,0);
});
test('a shared read cannot masquerade as another engine, stale context or an empty success',()=>{
  assert.equal(validateStrategicRead({ok:true,context:context({advisory:[]})},'context',NOW).engine_id,'growth-mindmake');
  assert.throws(()=>validateStrategicRead({ok:true,context:{...context({}),engine_id:'other'}},'context',NOW));
  assert.throws(()=>validateStrategicRead({ok:true,context:{...context({}),observed_at:'2026-10-01T00:00:00Z'}},'context',NOW));
});
test('an existing native reply blocks fresh acquisition and a declined campaign stays declined until revised',()=>{
  const c=context({advisory:[campaign('fresh'),{id:'reply',state:'replied'}]});
  assert.equal(strategicPlan(c,{at:NOW}).selected.length,0);
  c.records.advisory.pop();c.feedback=[{reference:'pilot:fresh',stage:'plan',state:'declined',decided_at:NOW}];
  assert.equal(strategicPlan(c,{at:NOW}).held[0].reason,'campaign_declined');
});
test('the shared context runs the existing complete selected-job producer before campaign preparation',async()=>{
  const full=JSON.parse(await readFile(new URL('../fixtures/engine-context.json',import.meta.url)));
  full.generated_at=NOW;full.snapshot.generated_at=NOW;
  const registry=JSON.parse(await readFile(new URL('../config/campaigns.json',import.meta.url)));
  const policy=JSON.parse(await readFile(new URL('../config/policy.json',import.meta.url)));
  const reports=[];
  const cc={recordAttempt:async()=>{},directive:async()=>directiveFixture(),capabilities:async()=>({activation:{activated_on:'2026-10-18'},features:{context:true}}),context:async()=>({ok:true,context:{...context({advisory:[]}),work_context:full}}),decisions:async()=>[],postReport:async r=>{reports.push(r);return{replayed:false}},readReport:async()=>reports.at(-1)};
  const result=await runDispatch({cc,source:async()=>{throw Error('Retired source must not run')},policy,registry,attemptId:'gma-full-cycle-12345678',clock:()=>NOW});
  assert.equal(result.status,'succeeded');
  assert.ok(reports[0].activity.some(a=>a.line.includes(`full engine cycle dry on ${full.jobs.length} supplied jobs`)));
  assert.ok(reports[0].proposals.length>0);
  assert.ok(reports[0].proposals.length<=policy.limits.recommendations_per_run);
});
test('daily dispatch consumes shared context and full outcomes without the retired snapshot credential; an unverified execution stays held',async()=>{
  const reports=[], attempts=[], calls=[];
  const cc={recordAttempt:async a=>attempts.push(a),directive:async()=>directiveFixture(),capabilities:async()=>({activation:{activated_on:'2026-10-18'},features:{context:true,outcomes:true,exact_actions:true}}),context:async()=>({ok:true,context:context({advisory:[campaign('11111111-1111-4111-8111-111111111111')]})}),outcomes:async()=>({ok:true,outcomes:outcomes()}),decisions:async()=>[{proposal_id:'live-1',decision:'approved',stage:'go_live'}],actionReceipt:async()=>({ok:true,receipt:{state:'submitted',provider_id:'sent-but-unverified'}}),executeAction:async()=>calls.push('send'),postReport:async r=>{reports.push(r);return{replayed:false}},readReport:async()=>reports.at(-1)};
  const policy=JSON.parse(await readFile(new URL('../config/policy.json',import.meta.url)));
  const result=await runDispatch({cc,source:async()=>{throw Error('Snapshot must not be used')},policy,registry:{},attemptId:'gma-synthetic-12345678',clock:()=>NOW});
  assert.equal(result.status,'succeeded'); assert.equal(reports.length,1);assert.equal(calls.length,0);
  assert.equal(reports[0].proposals[0].stage,'plan');assert.equal(reports[0].objectives[0].value,0);
  assert.ok(reports[0].holds.some(h=>h.reason==='external_action_unverified'));assert.equal(attempts.at(-1).status,'succeeded');
  assert.equal(reports[0].proposals[0].payload_sha256.length,payloadDigest({}).length);
});
