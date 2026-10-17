import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enginePlan } from '../src/engine.mjs';
import { JOB_KINDS, parseEngineContext, parseWorkBatch, semanticWorkBatch } from '../contracts/engine.ts';
import { copy, POLICY } from './helpers.mjs';

const FIXTURE = JSON.parse(await readFile(new URL('../fixtures/engine-context.json',import.meta.url),'utf8'));
const REGISTRY = JSON.parse(await readFile(new URL('../config/campaigns.json',import.meta.url),'utf8'));
const AT = '2026-10-16T18:00:00Z';
function plan(context = copy(FIXTURE), capacity = 5, at = AT, registry = copy(REGISTRY)) {
  const policy = copy(POLICY); policy.limits.recommendations_per_run = capacity;
  if (capacity === 10 && registry.defaults.newRecommendationsPerDailyRun === 5) registry.defaults.newRecommendationsPerDailyRun = 10;
  return enginePlan(context,policy,registry,{at});
}
function only(kind) { const context = copy(FIXTURE); context.jobs = context.jobs.filter(j => j.kind === kind); return context; }

test('the executable registry controls prepared artifact types as well as shared limits',()=>{const registry=copy(REGISTRY);registry.campaigns.find(c=>c.id==='inbound-next-decision').artifactTypes=['qualification_review'];const context=only('inbound');const result=plan(context,5,AT,registry);assert.equal(result.items.length,0);assert.equal(result.held[0].reason,'campaign_artifact_type_disabled');});

test('the full producer can execute each declared commercial and lifecycle kind', () => {
  assert.deepEqual([...new Set(FIXTURE.jobs.map(j => j.kind))].sort(),[...JOB_KINDS].sort());
  const campaignIds = new Set();
  for (const kind of JOB_KINDS) {
    const result = plan(only(kind),10);
    assert.ok(result.items.length > 0,`${kind} did not prepare: ${JSON.stringify(result.held)}`);
    assert.equal(result.items.length + result.held.length,result.jobs_examined);
    for (const item of result.items) { campaignIds.add(item.campaign_id); assert.equal(item.requires_human,true); assert.equal(item.approval_state,'pending'); assert.ok(item.body.trim()); }
  }
  assert.equal(campaignIds.size,7);
});

test('one shared budget prioritises actual requests and lifecycle work over new acquisition and assets', () => {
  const result = plan();
  assert.equal(result.items.length,5);
  assert.deepEqual(result.items.map(i => i.input_id),['job-inbound','job-delivery','job-proof','job-qualification','job-introduction']);
  assert.equal(result.report.capacity,5);
  assert.equal(result.report.scope,'selected_context'); assert.equal(result.report.global,false);
  assert.equal(result.report.deferred,6);
  assert.equal(result.items.length + result.held.length,11);
  assert.equal(new Set([...result.items.map(i => i.input_id),...result.held.map(i => i.input_id)]).size,11);
  const large = plan(copy(FIXTURE),10);
  assert.equal(large.items.length,10); assert.equal(large.report.deferred,1);
  assert.throws(() => plan(copy(FIXTURE),11));
});

test('all-hold contexts retain honest reasons and consume no review capacity', () => {
  const context = only('outreach'); context.snapshot.contacts.forEach(c => { c.suppressed = true; });
  const result = plan(context);
  assert.equal(result.items.length,0); assert.equal(result.report.deferred,0);
  assert.equal(result.held.length,context.jobs.length);
  assert.ok(result.held.every(h => /suppression|suppressed|permission/.test(h.reason)));
  assert.equal(result.report.outreach_analysis.held,context.jobs.length);
});

test('source identity and delivery time support deterministic replay without depending on list order', () => {
  const before = plan(copy(FIXTURE),10);
  const reordered = copy(FIXTURE); reordered.jobs.reverse(); reordered.snapshot.contacts.reverse(); reordered.snapshot.contacts.forEach(c => c.evidence.reverse()); reordered.jobs.forEach(j => j.details.sources?.reverse());
  assert.deepEqual(plan(reordered,10),before);
  const laterContext = copy(FIXTURE); laterContext.generated_at = '2026-10-16T19:00:00Z'; laterContext.snapshot.generated_at = laterContext.generated_at;
  const later = plan(laterContext,10,laterContext.generated_at);
  assert.equal(later.run_id,before.run_id);
  assert.deepEqual(semanticWorkBatch(later),semanticWorkBatch(before));
  const changed = copy(FIXTURE); changed.jobs.find(j => j.kind === 'research').details.question = 'Which first-party statement supports the proposed pricing decision?';
  assert.notEqual(plan(changed,10).run_id,before.run_id);
});

test('incomplete, stale, conflicting and unbounded contexts fail before producing a batch', () => {
  for (const mutate of [
    c => { c.complete = false; }, c => { c.snapshot.complete = false; },
    c => { c.generated_at = '2026-10-14T12:00:00Z'; }, c => { c.generated_at = '2026-10-17T12:00:00Z'; },
    c => { c.source_revision = 'unrelated-revision'; }, c => { c.jobs.push(copy(c.jobs[0])); },
    c => { c.jobs = Array.from({length:101},(_,i) => ({...copy(c.jobs[0]),id:`job-${i}`})); },
    c => { c.jobs[0].send = true; }, c => { c.jobs[0].details.unreviewed_override = true; },
    c => { c.jobs[0].due_at = '2026-02-30T12:00:00Z'; }, c => { c.jobs[0].source_id = 'https://example.test/private'; }
  ]) { const context = copy(FIXTURE); mutate(context); assert.throws(() => plan(context)); }
  assert.equal(parseEngineContext(copy(FIXTURE)).jobs.length,11);
});

test('registry identity and binding commercial safeguards are executable requirements', () => {
  for (const mutate of [
    r => { r.campaigns.pop(); }, r => { r.campaigns[0].mode = 'named_cold'; },
    r => { r.defaults.automaticFollowUps = true; }, r => { r.defaults.researchCreatesOutreachQueue = true; },
    r => { r.campaigns.find(c => c.mode === 'introduction').bothOptInsRequiredBeforeConnecting = false; },
    r => { r.campaigns.find(c => c.mode === 'inbound').duplicatesLeadDeliverySequence = true; }
  ]) { const registry = copy(REGISTRY); mutate(registry); assert.throws(() => plan(copy(FIXTURE),5,AT,registry)); }
});

test('the strictest configured capacity wins and future work is held centrally', () => {
  const result = plan(copy(FIXTURE),8);
  assert.equal(result.items.length,5); assert.equal(result.report.capacity,5);
  const context = only('research'); context.jobs[0].due_at = '2026-10-17T12:00:00Z';
  assert.deepEqual(plan(context).held,[{input_id:'job-research',reason:'job_not_due'}]);
});

test('batch parser rejects concealed authority, missing dispositions and false reporting', () => {
  const valid = plan();
  for (const mutate of [
    b => { b.send = true; }, b => { b.items[0].approval_state = 'approved'; },
    b => { b.items[0].requires_human = false; }, b => { b.items[0].recipient_email = 'person@example.test'; },
    b => { b.items[0].body += '\u2014'; }, b => { b.held.pop(); },
    b => { b.held[0].input_id = b.items[0].input_id; }, b => { b.report.prepared++; },
    b => { b.report.global = true; }, b => { b.report.deferred++; },
    b => { b.report.campaign_counts[0].prepared++; }, b => { b.items[0].channel = 'intel'; },
    b => { b.items[0].kind = 'fabricated_work'; }, b => { b.items[0].closure_event = 'trust_asset_published'; },
    b => { b.items[0].destination = 'editorial'; }, b => { b.items[0].campaign_id = 'selected-founder-trust'; },
    b => { b.items[0].recipient_contact_id = 'foreign-person'; }
  ]) { const batch = copy(valid); mutate(batch); assert.throws(() => parseWorkBatch(batch)); }
  assert.equal(parseWorkBatch(valid).run_id,valid.run_id);
});

test('missing source contacts are held and a contact cannot receive competing direct actions', () => {
  const missing = only('inbound'); missing.snapshot.contacts = missing.snapshot.contacts.filter(c => c.id !== missing.jobs[0].contact_id);
  assert.deepEqual(plan(missing).held,[{input_id:'job-inbound',reason:'source_contact_missing'}]);
  const context = only('outreach'); const first = context.jobs.find(j => j.details.mode === 'warm'); context.jobs = [first,{...copy(first),id:'job-warm-second'}];
  const result = plan(context);
  assert.equal(result.items.length,1); assert.equal(result.held.length,1); assert.equal(result.held[0].reason,'recipient_already_selected');
});
