import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { plan } from '../src/orchestrator.mjs';
import { AT, POLICY, snapshot } from './helpers.mjs';
import { capabilities } from './support/operations-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, 'runtime');
await mkdir(runtime, { recursive: true });
const privateDirectory = await mkdtemp(join(runtime, 'synthetic-tests-'));
const input = snapshot();
input.contacts[0].full_name = 'PRIVATE_SYNTHETIC_PERSON';
input.contacts[0].company = 'PRIVATE_SYNTHETIC_COMPANY';
input.contacts[0].buying_moment.fact = 'PRIVATE_SYNTHETIC_DECISION';
const inputPath = join(privateDirectory, 'snapshot.json');
await writeFile(inputPath, JSON.stringify(input));
const preloadPath = join(privateDirectory, 'mock-fetch.mjs');
await writeFile(preloadPath, `globalThis.fetch = async (_url, options) => {
  if (options.method !== 'GET') throw new Error('Unexpected live mutation in a dry run');
  return new Response(${JSON.stringify(JSON.stringify(input))}, { headers: { 'content-type': 'application/json' } });
};\n`);
function run(args, { mocked = false, preload = preloadPath } = {}) {
  return spawnSync(process.execPath, [...(mocked ? ['--import', pathToFileURL(preload).href] : []), 'src/cli.mjs', ...args], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, CONTROL_CENTER_URL: 'https://example.com', MINDMAKE_GROWTH_TOKEN: 'SYNTHETIC_CREDENTIAL_FOR_TEST', GROWTH_LAUNCH_DATE: '' }
  });
}
function assertPrivate(result) {
  assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_SYNTHETIC|SYNTHETIC_CREDENTIAL_FOR_TEST/);
}

test('live daily defaults to a redacted dry run with no external mutation', () => {
  const result = run(['daily', '--at', AT], { mocked: true });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.dry_run, true);
  assert.equal(summary.created, 0);
  assert.equal(summary.prepared, 1);
  assertPrivate(result);
});

test('private plans can be saved only inside ignored runtime and have a safe summary', async () => {
  const output = join(privateDirectory, 'planned-batch.json');
  const result = run(['plan', '--snapshot', inputPath, '--at', AT, '--output', output, '--summary']);
  assert.equal(result.status, 0, result.stderr);
  assertPrivate(result);
  const persisted = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(persisted.recommendations[0].draft.body.includes('PRIVATE_SYNTHETIC'), true);
  const outside = run(['plan', '--snapshot', inputPath, '--at', AT, '--output', join(root, 'unsafe-private-test-output.json'), '--summary']);
  assert.equal(outside.status, 1);
  assertPrivate(outside);
});

test('fixture commits, invented live clocks, duplicate options and unknown commands are refused', () => {
  for (const args of [
    ['plan', '--snapshot', inputPath, '--at', AT, '--commit'],
    ['daily', '--commit', '--at', AT],
    ['daily', '--snapshot', inputPath, '--commit'],
    ['plan', '--snapshot', inputPath, '--snapshot', inputPath],
    ['send'], ['publish'], ['schedule']
  ]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assertPrivate(result);
  }
});

test('scorecard refuses stale and incomplete source context instead of claiming current performance', async () => {
  for (const changes of [{ complete: false }, { generated_at: '2026-10-10T12:00:00Z' }]) {
    const path = join(privateDirectory, `${changes.complete === false ? 'incomplete' : 'stale'}.json`);
    await writeFile(path, JSON.stringify({ ...input, ...changes }));
    const result = run(['scorecard', '--snapshot', path, '--at', AT]);
    assert.equal(result.status, 1);
    assertPrivate(result);
  }
});

test('a private-data parse error reports failure without echoing the offending payload', async () => {
  const path = join(privateDirectory, 'invalid.json');
  const invalid = snapshot(); invalid.contacts[0].full_name = 'PRIVATE_SYNTHETIC_PERSON'.repeat(100);
  await writeFile(path, JSON.stringify(invalid));
  const result = run(['plan', '--snapshot', path, '--at', AT]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No completion claimed/);
  assertPrivate(result);
});

test('a lost handoff response exposes only the run ID needed for read-only recovery', async () => {
  const preload = join(privateDirectory, 'lost-handoff.mjs');
  const ready = await capabilities({ activation: { state: 'active', launch_date: '2026-10-16' } });
  const saved = plan(input, POLICY, { at: AT, launchDate: '2026-10-16' });
  const created = saved.recommendations.map((r, i) => ({ recommendation_id: r.recommendation_id, deal_id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
  await writeFile(preload, `
const OriginalDate = Date;
globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [${JSON.stringify(AT)}])); }
  static now() { return OriginalDate.parse(${JSON.stringify(AT)}); }
};
const attempts = new Map();
globalThis.fetch = async (url, options) => {
  if (url.searchParams.get('capabilities') === '1') return Response.json(${JSON.stringify(ready)});
  if (options.method === 'POST') {
    const body = JSON.parse(options.body);
    if (body.kind === 'attempt') { attempts.set(body.attempt.attempt_id, body.attempt); return Response.json({ ok: true, attempt: body.attempt }); }
    throw new Error('PRIVATE_SYNTHETIC_LOST_RESPONSE');
  }
  if (url.searchParams.has('attempt_id')) return Response.json({ ok: true, attempt: attempts.get(url.searchParams.get('attempt_id')) });
  if (url.searchParams.has('run_id')) return Response.json({ ok: true, run_id: url.searchParams.get('run_id'), created: ${JSON.stringify(created)}, held: [], report: ${JSON.stringify(saved.report)} });
  return Response.json(${JSON.stringify(input)});
};\n`);
  const uncertain = run(['daily', '--commit'], { mocked: true, preload });
  assert.equal(uncertain.status, 1);
  assertPrivate(uncertain);
  assert.match(uncertain.stderr, /No completion claimed/);
  const recovery = uncertain.stderr.split(/\r?\n/).find(line => line.startsWith('{') && JSON.parse(line).state === 'handoff_pending');
  const diagnostic = JSON.parse(recovery);
  assert.match(diagnostic.run_id, /^gm-[a-f0-9]{40}$/);
  assert.equal(diagnostic.state, 'handoff_pending');
  const resumed = run(['resume', '--run-id', diagnostic.run_id], { mocked: true, preload });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).durable, true);
  assertPrivate(resumed);
});
