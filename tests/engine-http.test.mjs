import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { client } from '../src/control-center.mjs';
import { execute } from '../src/runtime.mjs';
import { enginePlan } from '../src/engine.mjs';
import { startContractService } from './support/contract-service.mjs';
import { capabilities } from './support/operations-fixtures.mjs';
import { POLICY } from './helpers.mjs';
const fixture=JSON.parse(await readFile(new URL('../fixtures/engine-context.json',import.meta.url)));
const AT=fixture.generated_at;
const registry=JSON.parse(await readFile(new URL('../config/campaigns.json',import.meta.url)));
const PATH='/api/growth/mindmake/work';
const active=()=>capabilities({activation:{state:'active',launch_date:'2026-10-16'}});
const remote=s=>client(s.origin,s.token,{fetcher:s.fetcher});
test('every whole-engine motion travels through real HTTP capture, planning, persisted artifact and independent readback',async()=>{
  const kinds=new Set(),campaigns=new Set();
  for(const job of fixture.jobs){
    const c=structuredClone(fixture);c.jobs=[structuredClone(job)];
    const s=await startContractService({engineContext:c,capabilities:await active()});
    try{const r=await execute(remote(s),POLICY,{command:'engine',clock:()=>AT});assert.equal(r.artifact.items.length,1,`${job.kind}: ${JSON.stringify(r.artifact.held)}`);const item=r.artifact.items[0];kinds.add(job.kind);campaigns.add(item.campaign_id);assert.ok(item.body.length>80);assert.equal(item.approval_state,'pending');assert.equal(s.workItems.size,1);assert.deepEqual((await remote(s).workReceipt(r.artifact.run_id)).batch,r.artifact);assert.equal((await remote(s).attempt(r.attempt_id)).status,'succeeded');assert.equal(s.requests.filter(q=>q.path===PATH&&q.method==='POST').length,1);}finally{await s.close();}
  }
  assert.equal(kinds.size,10);assert.equal(campaigns.size,7);
});
test('complete engine cycle uses one shared capacity and replays without replacing prior work',async()=>{
  const s=await startContractService({engineContext:fixture,capabilities:await active()});
  try{const a=await execute(remote(s),POLICY,{command:'engine',clock:()=>AT});assert.equal(a.receipt.replayed,false);assert.equal(a.artifact.items.length,5);assert.equal(a.artifact.jobs_examined,a.artifact.items.length+a.artifact.held.length);const before=s.workItems.size;const b=await execute(remote(s),POLICY,{command:'engine',clock:()=>AT});assert.equal(a.artifact.run_id,b.artifact.run_id);assert.equal(b.receipt.replayed,true);assert.equal(s.workItems.size,before);assert.equal(s.workRuns.size,1);}finally{await s.close();}
});
test('lost work response stays unknown and recovery reads the existing durable work without another POST',async()=>{
  const s=await startContractService({engineContext:fixture,capabilities:await active()});
  try{s.fault('drop_after_commit','POST',PATH);let failure;try{await execute(remote(s),POLICY,{command:'engine',clock:()=>AT});assert.fail('expected uncertain delivery');}catch(e){failure=e;}
    assert.equal(failure.attempt.status,'unknown');assert.equal(s.workRuns.size,1);const before=s.requests.filter(q=>q.path===PATH&&q.method==='POST').length;const receipt=await remote(s).workReceipt(failure.attempt.run_id);assert.equal(receipt.batch.run_id,failure.attempt.run_id);assert.equal(s.requests.filter(q=>q.path===PATH&&q.method==='POST').length,before);assert.equal((await remote(s).attempt(failure.attempt.attempt_id)).status,'unknown');
  }finally{await s.close();}
});
test('work persistence rejects a false acknowledgement, missing item and truncated consumed artifact',async()=>{
  const expected=enginePlan(fixture,POLICY,registry,{at:AT});
  for(const corrupt of ['html','missing-item','changed-body','aliased-record']){
    const s=await startContractService({engineContext:fixture,extension:({method,url,body})=>{
      if(method!=='POST'||url.pathname!==PATH||corrupt==='html')return null;
      const batch=structuredClone(body),created=batch.items.map(i=>({item_id:i.item_id,record_id:corrupt==='aliased-record'?'same-private-record':`record-${i.item_id}`}));if(corrupt==='missing-item')created.pop();else if(corrupt==='changed-body')batch.items[0].body='Truncated private artifact';
      return {body:{ok:true,batch,created,held:[],replayed:false}};
    }});
    try{if(corrupt==='html')s.fault('html','POST',PATH);await assert.rejects(remote(s).commitWork(expected));}finally{await s.close();}
  }
});
test('engine source failures are journalled and missing capability blocks before any write',async()=>{
  const c=await active();c.features.work_persistence=false;
  const s=await startContractService({engineContext:fixture,capabilities:c});
  try{await assert.rejects(execute(remote(s),POLICY,{command:'engine',clock:()=>AT}));assert.equal(s.requests.filter(q=>q.method==='POST').length,0);}finally{await s.close();}
  const t=await startContractService({engineContext:fixture,capabilities:await active()});
  try{t.fault('unavailable','GET',PATH);let error;try{await execute(remote(t),POLICY,{command:'engine',clock:()=>AT});}catch(e){error=e;}assert.equal(error.attempt.status,'failed');assert.equal(error.attempt.error_code,'source_unavailable');assert.equal(t.workRuns.size,0);assert.equal((await remote(t).attempt(error.attempt.attempt_id)).status,'failed');}finally{await t.close();}
});
test('oversized valid research is held while an independent inbound artifact persists',async()=>{const c=structuredClone(fixture),research=c.jobs.find(j=>j.kind==='research'),inbound=c.jobs.find(j=>j.kind==='inbound');research.details.sources=Array.from({length:10},(_,i)=>({id:`large-source-${i}`,url:`https://example.com/sources/${i}`,title:'Synthetic source',publisher:'Synthetic Company',event_at:null,retrieved_at:AT,excerpt:'A'.repeat(2000),claim:'A',limitation:'The excerpt cannot establish a need.',classification:'observed',layer:'narrative',primary:true,visibility:'public'}));c.jobs=[research,inbound];const s=await startContractService({engineContext:c,capabilities:await active()});try{const r=await execute(remote(s),POLICY,{command:'engine',clock:()=>AT});assert.equal(r.artifact.items.length,1);assert.equal(r.artifact.items[0].input_id,inbound.id);assert.deepEqual(r.artifact.held,[{input_id:research.id,reason:'research_artifact_budget_exceeded'}]);assert.equal(r.receipt.created.length,1);assert.equal((await remote(s).workReceipt(r.artifact.run_id)).batch.jobs_examined,2);}finally{await s.close();}});
