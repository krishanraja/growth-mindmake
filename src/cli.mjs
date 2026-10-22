#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from './orchestrator.mjs';
import { scorecard } from './stages/scorecard.mjs';
import { client, engineClient } from './control-center.mjs';
import { validateContext } from './guards.mjs';
import { capture } from './capture.mjs';
import { readiness, execute, RunFailure } from './runtime.mjs';
import { weeklyReview } from './weekly-review.mjs';
import { enginePlan } from './engine.mjs';
import { runDispatch } from './dispatch.mjs';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  const options = {};
  const booleans = new Set(['commit','summary','synthetic']);
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) throw new Error('Expected a named option');
    const key = args[i].slice(2);
    if (!['snapshot','context','at','launch-date','output','cursor','run-id','attempt-id','review-id','kind',...booleans].includes(key) || key in options) throw new Error('Unknown or duplicate option');
    if (booleans.has(key)) options[key] = true;
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Option value missing'); options[key] = args[++i]; }
  }
  const supported = { help: [], dispatch: ['synthetic','snapshot','context','at','kind'], engine: ['context','at','output','commit','summary'], 'work-resume': ['run-id'], plan: ['snapshot','at','launch-date','output','summary'], daily: ['snapshot','at','launch-date','output','cursor','commit','summary'], doctor: ['snapshot','at','launch-date','cursor'], scorecard: ['snapshot','at','launch-date','cursor'], readiness: [], resume: ['run-id'], attempt: ['attempt-id'], 'review-resume': ['review-id'], 'weekly-review': ['context','at','output','commit','summary'] };
  if (!supported[command] || Object.keys(options).some(key => !supported[command].includes(key))) throw new Error('Unsupported command or option');
  const policy = JSON.parse(await readFile(resolve(root, 'config/policy.json'), 'utf8'));
  const at = options.at ?? new Date().toISOString();
  const launchDate = options['launch-date'] ?? process.env.GROWTH_LAUNCH_DATE;
  const remote = () => client(process.env.CONTROL_CENTER_URL, process.env.MINDMAKE_GROWTH_TOKEN);
  if (command === 'help') { console.log('engine [--context FILE] [--commit] [--summary]\nwork-resume --run-id ID\nplan --snapshot FILE [--at ISO] [--output runtime/PRIVATE_FILE]\ndaily [--commit] [--cursor ID] [--summary]\nweekly-review [--context FILE] [--commit] [--summary]\nreadiness\ndoctor\nresume --run-id ID\nattempt --attempt-id ID\nreview-resume --review-id ID\nscorecard --snapshot FILE [--launch-date YYYY-MM-DD]\ndispatch [--synthetic [--snapshot FILE] [--context FILE] [--at ISO]] [--kind NAME]\nEngine runs all campaign and lifecycle work. Daily retains the bounded outbound compatibility interface. Legacy producer commands default to read only. Dispatch uses exact approved actions through Control Center and verifies receipts.'); return; }
  if (command === 'dispatch') { await dispatch(options, policy); return; }
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
/**
 * Control Center's daily dispatch (protocol 1.0.0). It reads, prepares, and handles exact approved actions through
 * reports proposals, and never sends, posts, spends, drafts into Gmail or commits an Advisory batch.
 * Only counts, codes and opaque ids are printed; the bearer never is.
 */
async function dispatch(options, policy) {
  const synthetic = Boolean(options.synthetic);
  if (!synthetic && (options.snapshot || options.context || options.at)) throw new Error('A live dispatch reads its own sources on the actual clock');
  if (options.kind !== undefined && !/^[a-z][a-z0-9-]{0,40}$/.test(options.kind)) throw new Error('Invalid run kind');
  const missing = ['CONTROL_CENTER_URL', 'CONTROL_CENTER_ENGINE_TOKEN'].filter(name => !process.env[name]);
  if (missing.length) { console.error(`Dispatch cannot start: ${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set. Nothing was read or written.`); process.exitCode = 1; return; }
  const wakeEngine = process.env.CC_WAKE_ENGINE_ID || null, wakeDirective = process.env.CC_WAKE_DIRECTIVE_ID || null;
  if (wakeEngine && wakeEngine !== 'growth-mindmake') { console.error('Dispatch refused: the wake-up names another engine. Nothing was read or written.'); process.exitCode = 1; return; }
  let cc;
  try { cc = engineClient(process.env.CONTROL_CENTER_URL, process.env.CONTROL_CENTER_ENGINE_TOKEN); }
  catch (error) { console.error(`Dispatch cannot start: ${error.message}. Nothing was read or written.`); process.exitCode = 1; return; }
  const registry = JSON.parse(await readFile(resolve(root, 'config/campaigns.json'), 'utf8'));
  const at = options.at;
  if (at !== undefined && !Number.isFinite(Date.parse(at))) throw new Error('Invalid run clock');
  const readJson = async file => JSON.parse(await readFile(resolve(file), 'utf8'));
  const source = synthetic
    ? async () => options.snapshot ? { snapshot: await capture({ file: options.snapshot }) } : { hold: { reason: 'no_synthetic_snapshot', detail: 'This synthetic run was given no snapshot file.' } }
    : async () => {
      let remote;
      try { remote = client(process.env.CONTROL_CENTER_URL, process.env.MINDMAKE_GROWTH_TOKEN); }
      catch { return { hold: { reason: 'source_credential_unavailable', detail: 'The shared growth credential for the snapshot route is not available to this run, so no prospect page was read.' } }; }
      try { return { snapshot: await remote.snapshot() }; }
      catch (error) {
        const reason = error?.status === 401 || error?.status === 403 ? 'source_unauthorized' : error?.status === 404 ? 'source_route_missing' : error?.status ? 'source_unavailable' : error?.name === 'TimeoutError' ? 'source_timeout' : error instanceof TypeError ? 'source_unavailable' : 'source_contract_mismatch';
        return { hold: { reason, detail: 'The snapshot page could not be read or did not match the frozen growth contract, so no prospect was examined.' } };
      }
    };
  const result = await runDispatch({
    cc, source, policy, registry, mode: synthetic ? 'synthetic' : 'live', kind: options.kind ?? (synthetic ? 'synthetic' : 'dispatch'),
    context: synthetic && options.context ? await readJson(options.context) : null,
    attemptId: `gma-${randomUUID()}`, revision: /^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : 'unrecorded',
    wakeDirectiveId: wakeDirective && /^mindmake:\d{4}-\d{2}-\d{2}$/.test(wakeDirective) ? wakeDirective : null,
    ...(at ? { clock: () => at } : {})
  });
  console.log(JSON.stringify(result));
  if (result.status !== 'succeeded') process.exitCode = 1;
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
