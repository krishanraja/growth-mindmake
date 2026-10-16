#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from './orchestrator.mjs';
import { scorecard } from './stages/scorecard.mjs';
import { client } from './control-center.mjs';
import { validateContext } from './guards.mjs';
import { capture } from './capture.mjs';
import { handoff } from './publish.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  const options = {};
  const booleans = new Set(['commit','summary']);
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) throw new Error('Expected a named option');
    const key = args[i].slice(2);
    if (!['snapshot','at','launch-date','output','cursor','run-id',...booleans].includes(key) || key in options) throw new Error('Unknown or duplicate option');
    if (booleans.has(key)) options[key] = true;
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Option value missing'); options[key] = args[++i]; }
  }
  const policy = JSON.parse(await readFile(resolve(root, 'config/policy.json'), 'utf8'));
  const at = options.at ?? new Date().toISOString();
  const launchDate = options['launch-date'] ?? process.env.GROWTH_LAUNCH_DATE;
  const remote = () => client(process.env.CONTROL_CENTER_URL, process.env.MINDMAKE_GROWTH_TOKEN);
  if (command === 'help') { console.log('plan --snapshot FILE [--at ISO] [--output PRIVATE_FILE]\ndaily [--commit] [--cursor ID] [--summary]\nresume --run-id ID\nscorecard --snapshot FILE [--launch-date YYYY-MM-DD]\ndoctor\nDaily is a dry run unless --commit is explicit. Nothing sends or publishes.'); return; }
  if (command === 'resume') {
    if (!options['run-id']) throw new Error('resume requires --run-id');
    const r = await remote().receipt(options['run-id']);
    console.log(JSON.stringify({ run_id: r.run_id, durable: true, created: r.created.length, held: r.held.length })); return;
  }
  if (!['plan','daily','doctor','scorecard'].includes(command)) throw new Error('Unknown command');
  if (command === 'plan' && !options.snapshot) throw new Error('plan requires --snapshot');
  if (options.commit && (command !== 'daily' || options.snapshot)) throw new Error('Only a live daily run can commit');
  if (options.commit && options.at) throw new Error('Live writes must use the actual clock');
  const snapshot = await capture({ file: options.snapshot, remote: options.snapshot ? null : remote(), cursor: options.cursor });
  if (command === 'scorecard') { validateContext(snapshot, policy, at); console.log(JSON.stringify(scorecard(snapshot, policy, at, launchDate), null, 2)); return; }
  const batch = plan(snapshot, policy, { at, launchDate });
  if (command === 'doctor') { console.log(JSON.stringify({ connected: true, contract: 1, snapshot_complete: snapshot.complete, canon_current: true, buyer_definition: snapshot.icp.defined, source_rows: snapshot.contacts.length, writes: 0 })); return; }
  let receipt;
  if (options.commit) { console.error(JSON.stringify({ run_id: batch.run_id, state: 'handoff_pending' })); receipt = await handoff(batch, remote()); }
  if (options.output) {
    const destination = resolve(options.output);
    if (!destination.startsWith(resolve(root, 'runtime') + '\\') && !destination.startsWith(resolve(root, 'runtime') + '/')) throw new Error('Private output must be inside the ignored runtime/ directory');
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, JSON.stringify(batch, null, 2) + '\n', { mode: 0o600 });
  }
  if (options.summary || command === 'daily') console.log(JSON.stringify({ run_id: batch.run_id, dry_run: !options.commit, examined: batch.report.examined, prepared: batch.recommendations.length, created: receipt?.created.length ?? 0, held_at_destination: receipt?.held.length ?? 0, held_before_drafting: batch.report.held.length, qualified_conversations: batch.report.scorecard.qualified_conversations, weekly_target: batch.report.scorecard.target, first_month_active: Boolean(batch.report.scorecard.first_month), more_contacts_available: Boolean(snapshot.next_cursor) }));
  else console.log(JSON.stringify(batch, null, 2));
}
main().catch(error => {
  if (/^(Snapshot |Canon |Buyer |Unsafe engine |Launch date |Only a live |Live writes |Managed runtime |Control Center (GET|POST)|Destination |Invalid run clock)/.test(error.message)) console.error(error.message);
  console.error('Growth run failed. No completion claimed. Check configuration, contract, freshness and the durable receipt before resuming. Private data and credential values are omitted.'); process.exitCode = 1;
});
