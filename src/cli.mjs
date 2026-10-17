#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from './orchestrator.mjs';
import { scorecard } from './stages/scorecard.mjs';
import { client } from './control-center.mjs';
import { validateContext } from './guards.mjs';
import { capture } from './capture.mjs';
import { readiness, execute, RunFailure } from './runtime.mjs';
import { weeklyReview } from './weekly-review.mjs';
import { enginePlan } from './engine.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  const options = {};
  const booleans = new Set(['commit','summary']);
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) throw new Error('Expected a named option');
    const key = args[i].slice(2);
    if (!['snapshot','context','at','launch-date','output','cursor','run-id','attempt-id','review-id',...booleans].includes(key) || key in options) throw new Error('Unknown or duplicate option');
    if (booleans.has(key)) options[key] = true;
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Option value missing'); options[key] = args[++i]; }
  }
  const supported = { help: [], engine: ['context','at','output','commit','summary'], 'work-resume': ['run-id'], plan: ['snapshot','at','launch-date','output','summary'], daily: ['snapshot','at','launch-date','output','cursor','commit','summary'], doctor: ['snapshot','at','launch-date','cursor'], scorecard: ['snapshot','at','launch-date','cursor'], readiness: [], resume: ['run-id'], attempt: ['attempt-id'], 'review-resume': ['review-id'], 'weekly-review': ['context','at','output','commit','summary'] };
  if (!supported[command] || Object.keys(options).some(key => !supported[command].includes(key))) throw new Error('Unsupported command or option');
  const policy = JSON.parse(await readFile(resolve(root, 'config/policy.json'), 'utf8'));
  const at = options.at ?? new Date().toISOString();
  const launchDate = options['launch-date'] ?? process.env.GROWTH_LAUNCH_DATE;
  const remote = () => client(process.env.CONTROL_CENTER_URL, process.env.MINDMAKE_GROWTH_TOKEN);
  if (command === 'help') { console.log('engine [--context FILE] [--commit] [--summary]\nwork-resume --run-id ID\nplan --snapshot FILE [--at ISO] [--output runtime/PRIVATE_FILE]\ndaily [--commit] [--cursor ID] [--summary]\nweekly-review [--context FILE] [--commit] [--summary]\nreadiness\ndoctor\nresume --run-id ID\nattempt --attempt-id ID\nreview-resume --review-id ID\nscorecard --snapshot FILE [--launch-date YYYY-MM-DD]\nEngine runs all campaign and lifecycle work. Daily retains the bounded outbound compatibility interface. Live commands default to read only. Commits require reporting readiness and canonical activation. Nothing sends or publishes.'); return; }
  if (options.commit && (!['daily','engine','weekly-review'].includes(command) || options.snapshot || options.context)) throw new Error('Only a live producer operation can commit');
  if (options.commit && (options.at || options.output)) throw new Error('Live writes use the actual clock and no local export');
  if (command === 'readiness') { const result = await readiness(remote()); console.log(JSON.stringify(result)); if (!result.ready) process.exitCode = 2; return; }
  if (command === 'work-resume') {
    if (!options['run-id']) throw new Error('work-resume requires --run-id'); const r=await remote().workReceipt(options['run-id']);
    console.log(JSON.stringify({run_id:r.batch.run_id,durable:true,created:r.created.length,held:r.held.length})); return;
  }
  if (command === 'engine') {
    const registry=JSON.parse(await readFile(resolve(root,'config/campaigns.json'),'utf8'));
    const result=options.commit?await execute(remote(),policy,{command,launchDate,observe:v=>console.error(JSON.stringify(v))}):null;
    const batch=result?.artifact??enginePlan(options.context?JSON.parse(await readFile(resolve(options.context),'utf8')):await remote().engineContext(),policy,registry,{at});
    if(options.output) await savePrivate(batch,options.output);
    console.log(JSON.stringify(options.summary||!options.context?{run_id:batch.run_id,dry_run:!options.commit,durable:Boolean(result),examined:batch.jobs_examined,prepared:batch.items.length,held:batch.held.length,campaigns:batch.report.campaign_counts,scope:'selected_context',global_progress:'consumer_required'}:batch,null,options.summary?0:2));return;
  }
  if (command === 'attempt') {
    if (!options['attempt-id']) throw new Error('attempt requires --attempt-id'); const a = await remote().attempt(options['attempt-id']);
    console.log(JSON.stringify({ attempt_id: a.attempt_id, status: a.status, phase: a.phase, run_id: a.run_id, error_code: a.error_code })); return;
  }
  if (command === 'review-resume') {
    if (!options['review-id']) throw new Error('review-resume requires --review-id'); const r = await remote().review(options['review-id']);
    console.log(JSON.stringify({ review_id: r.review_id, durable: true, recommendations: r.recommendations.length })); return;
  }
  if (command === 'resume') {
    if (!options['run-id']) throw new Error('resume requires --run-id');
    const r = await remote().receipt(options['run-id']);
    console.log(JSON.stringify({ run_id: r.run_id, durable: true, created: r.created.length, held: r.held.length })); return;
  }
  if (command === 'weekly-review') {
    const result = options.commit ? await execute(remote(), policy, { command, launchDate, observe: v => console.error(JSON.stringify(v)) }) : null;
    const review = result?.artifact ?? weeklyReview(options.context ? JSON.parse(await readFile(resolve(options.context), 'utf8')) : await remote().reviewContext(), policy, at);
    if (options.output) await savePrivate(review, options.output);
    console.log(JSON.stringify(options.summary || !options.context ? { review_id: review.review_id, dry_run: !options.commit, durable: Boolean(result), recommendations: review.recommendations.length, scope: review.coverage, feedback_count: Object.entries(review.feedback_summary).filter(([k]) => k !== 'verified').reduce((n,[,v]) => n+v,0) } : review, null, options.summary ? 0 : 2)); return;
  }
  if (!['plan','daily','doctor','scorecard'].includes(command)) throw new Error('Unknown command');
  if (command === 'plan' && !options.snapshot) throw new Error('plan requires --snapshot');
  if (options.commit) {
    const result = await execute(remote(), policy, { cursor: options.cursor, launchDate, observe: v => console.error(JSON.stringify(v)) }); const b = result.artifact;
    console.log(JSON.stringify({ run_id: b.run_id, attempt_id: result.attempt_id, dry_run: false, durable: true, examined: b.report.examined, prepared: b.recommendations.length, created: result.receipt.created.length, held_at_destination: result.receipt.held.length, measurement_scope: 'selected_page', global_progress: 'consumer_required' })); return;
  }
  const snapshot = await capture({ file: options.snapshot, remote: options.snapshot ? null : remote(), cursor: options.cursor });
  if (command === 'scorecard') { validateContext(snapshot, policy, at); console.log(JSON.stringify(scorecard(snapshot, policy, at, launchDate), null, 2)); return; }
  const batch = plan(snapshot, policy, { at, launchDate });
  if (command === 'doctor') { const check = options.snapshot ? null : await readiness(remote()); console.log(JSON.stringify({ connected: true, contract: 1, snapshot_complete: snapshot.complete, canon_current: true, buyer_definition: snapshot.icp.defined, source_rows: snapshot.contacts.length, integration_ready: check?.ready ?? false, activation: check?.activation ?? null, writes: 0 })); if (check && !check.ready) process.exitCode = 2; return; }
  const receipt = null;
  if (options.output) {
    await savePrivate(batch, options.output);
  }
  if (options.summary || command === 'daily') console.log(JSON.stringify({ run_id: batch.run_id, dry_run: true, examined: batch.report.examined, prepared: batch.recommendations.length, created: receipt?.created.length ?? 0, held_at_destination: receipt?.held.length ?? 0, held_before_drafting: batch.report.held.length, qualified_conversations: batch.report.scorecard.qualified_conversations, weekly_target: batch.report.scorecard.target, measurement_scope: 'selected_page', global_progress: 'consumer_required', first_month_active: Boolean(batch.report.scorecard.first_month), more_contacts_available: Boolean(snapshot.next_cursor) }));
  else console.log(JSON.stringify(batch, null, 2));
}
async function savePrivate(value, output) {
  const destination = resolve(output), privateRoot = resolve(root, 'runtime');
  if (!destination.startsWith(privateRoot + '\\') && !destination.startsWith(privateRoot + '/')) throw new Error('Private output must be inside ignored runtime');
  await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
main().catch(error => {
  if (error instanceof RunFailure) console.error(JSON.stringify({ attempt_id: error.attempt.attempt_id, run_id: error.attempt.run_id, status: error.attempt.status, error_code: error.attempt.error_code ?? 'readback_unconfirmed' }));
  console.error('Growth run failed. No completion claimed. Check configuration, contract, freshness and the durable receipt before resuming. Private data and credential values are omitted.'); process.exitCode = 1;
});
