import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, statusLines, capabilities, tokensOf, insideRuntime, MEASURES } from '../scripts/measure-20x.mjs';

// The 20x measurement (plan Phase 5) on synthetic inputs in the Phase 0
// baseline's own format. Every figure here is invented.
const root = fileURLToPath(new URL('../', import.meta.url));
const tokens = n => ({ input_tokens: n, output_tokens: n, cache_read_input_tokens: n, cache_creation_input_tokens: n });
const pr = (n, over = {}) => ({ pr: n, title: `Synthetic ${n}`, session: 'sA', window_start: '2026-10-20T08:00:00Z', merged_at: '2026-10-20T18:00:00Z', tokens: tokens(1000), ...over });
const baseline = { generated: '2026-10-27', definitions: {}, sessions: { sA: { readable: 'remote', totals: {} }, sX: { readable: 'no', reason: 'synthetic' } }, prs: [pr(1), pr(2), pr(3, { tokens: tokens(3000) }), pr(4, { tokens: null }), pr(5, { merged_at: null })] };
const byKey = r => Object.fromEntries(r.measures.map(m => [m.key, m]));

test('the eight measures are the plan\'s, in its order, and a missing input is unknown, never zero', () => {
  assert.deepEqual(MEASURES.map(m => m.key), ['tokens_per_capability', 'prs_per_capability', 'corrective_share', 'defect_runs', 'review_rounds_per_capability', 'mid_turn_questions', 'recurring_gates', 'ask_to_accepted_hours']);
  for (const r of [measure({ baseline: null, after: null }), measure({ baseline, after: null })]) {
    assert.equal(r.measures.length, 8);
    for (const m of r.measures) { assert.equal(m.state, 'unknown'); assert.equal(m.value, null); assert.ok(m.reason.length > 10); }
  }
});

test('a Phase 0 baseline alone measures only what its format holds; the rest is unknown with its reason', () => {
  const after = { sessions: { sB: { readable: 'remote', totals: {} } }, prs: [pr(10, { session: 'sB', tokens: tokens(100), window_start: '2026-11-20T08:00:00Z', merged_at: '2026-11-20T08:30:00Z' })] };
  const m = byKey(measure({ baseline, after }));
  // Baseline: capabilities #1 to #3 (one PR each; #4 has no tokens, #5 is not merged): 4000, 4000, 12000 tokens, median 4000.
  assert.deepEqual([m.tokens_per_capability.state, m.tokens_per_capability.value, m.tokens_per_capability.baseline, m.tokens_per_capability.met], ['measured', 400, 4000, false], 'one tenth is not one twentieth');
  assert.deepEqual([m.ask_to_accepted_hours.state, m.ask_to_accepted_hours.value, m.ask_to_accepted_hours.baseline, m.ask_to_accepted_hours.met], ['measured', 0.5, 10, true]);
  for (const k of ['prs_per_capability', 'corrective_share', 'defect_runs', 'review_rounds_per_capability', 'mid_turn_questions', 'recurring_gates']) {
    assert.equal(m[k].state, 'unknown', k); assert.equal(m[k].value, null, k);
  }
  assert.match(m.prs_per_capability.reason, /proves nothing/);
  assert.match(m.corrective_share.reason, /1 of 1 merged PRs say nothing/);
});

test('a full measurement since the baseline: capabilities, corrections, runs, rounds, questions and gates', () => {
  const after = {
    sessions: { sB: { readable: 'remote', totals: { mid_turn_questions: 0 } }, sC: { readable: 'local', totals: { mid_turn_questions: 1 } } },
    prs: [
      pr(10, { session: 'sB', capability: 'switch', corrective: false, review_rounds: 1, tokens: tokens(50) }),
      pr(11, { session: 'sC', capability: 'measure', corrective: false, review_rounds: 1, tokens: tokens(40) }),
      pr(12, { session: 'sC', capability: 'measure', corrective: true, review_rounds: 1, tokens: tokens(40) })
    ],
    live_runs: [{ purpose: 'proof', outcome: 'ready' }, { purpose: 'proof', outcome: 'ready' }, { purpose: 'find_defect', outcome: null }],
    gates: [{ week_of: '2026-11-09', count: 2 }, { week_of: '2026-11-16', count: 3 }]
  };
  const r = measure({ baseline, after });
  const m = byKey(r);
  assert.deepEqual([m.tokens_per_capability.value, m.tokens_per_capability.met, m.tokens_per_capability.capabilities], [260, false, 2], 'capabilities of 200 and 320 tokens, median 260');
  assert.deepEqual([m.prs_per_capability.value, m.prs_per_capability.met], [1.5, false], 'a capability that took two PRs misses 1');
  assert.deepEqual([m.corrective_share.value, m.corrective_share.met], [0.333, false]);
  assert.deepEqual([m.defect_runs.value, m.defect_runs.met, m.defect_runs.proof_runs, m.defect_runs.not_done], [1, false, 2, 1], 'proof runs never count as defect-finding, and a run with no outcome is not done');
  assert.deepEqual([m.review_rounds_per_capability.value, m.review_rounds_per_capability.met], [2, false]);
  assert.deepEqual([m.mid_turn_questions.value, m.mid_turn_questions.met], [1, false]);
  assert.deepEqual([m.recurring_gates.value, m.recurring_gates.met], [3, false]);
  assert.deepEqual(Object.keys(r.by_session).sort(), ['sB', 'sC'], 'measured per session');
  assert.equal(r.by_session.sB.tokens_per_capability.value, 200);
  // Met: one PR a capability, none corrective, no defect runs, one round, no questions, two gates a week.
  const good = { ...after, prs: after.prs.slice(0, 2).map(p => ({ ...p, tokens: tokens(10), window_start: '2026-11-20T08:00:00Z', merged_at: '2026-11-20T08:20:00Z' })), sessions: { sB: { readable: 'remote', totals: { mid_turn_questions: 0 } } }, live_runs: [{ purpose: 'proof', outcome: 'ready' }], gates: [{ week_of: '2026-11-09', count: 2 }] };
  assert.ok(measure({ baseline, after: good }).measures.every(x => x.state === 'measured' ? x.met === true : true));
  assert.equal(measure({ baseline, after: good }).measures.filter(x => x.state === 'measured').length, 8);
});

test('capabilities and tokens follow Phase 0\'s definitions', () => {
  assert.equal(tokensOf(pr(1)), 4000);
  assert.equal(tokensOf(pr(1, { tokens: { output_tokens: 5 } })), null, 'a missing counter is unknown, never zero');
  assert.deepEqual(capabilities(baseline).map(c => c.key), ['pr:1', 'pr:2', 'pr:3', 'pr:4'], 'an unmerged PR is not accepted');
});

test('what it prints names no figure unless asked, and the readout stays in ignored runtime/', async () => {
  const after = { prs: [pr(10, { tokens: tokens(100) })] };
  const lines = statusLines({ measures: measure({ baseline, after }).measures });
  assert.equal(lines.length, 8);
  assert.doesNotMatch(lines.join('\n'), /\d{2,}/, 'no figure is printed');
  assert.match(statusLines({ measures: measure({ baseline, after }).measures }, { show: true })[0], /\(400 against 4000\)/);
  assert.equal(insideRuntime('runtime/measure.json'), true);
  for (const p of ['docs/measure.json', 'runtime', '../runtime/x.json', 'runtime/../docs/x.json']) assert.equal(insideRuntime(p), false, p);
  // End to end, on files in runtime/ only.
  const dir = join(root, 'runtime', 'test-measure-20x');
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(join(dir, 'baseline.json'), JSON.stringify(baseline));
    await writeFile(join(dir, 'after.json'), JSON.stringify(after));
    const run = spawnSync(process.execPath, ['scripts/measure-20x.mjs', '--baseline', 'runtime/test-measure-20x/baseline.json', '--after', 'runtime/test-measure-20x/after.json', '--out', 'runtime/test-measure-20x/out.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /\b4000\b|\b400\b/, 'no figure in what it prints');
    const out = JSON.parse(await readFile(join(dir, 'out.json'), 'utf8'));
    assert.equal(out.measures.find(m => m.key === 'tokens_per_capability').value, 400);
    const refused = spawnSync(process.execPath, ['scripts/measure-20x.mjs', '--after', 'runtime/test-measure-20x/after.json', '--out', 'docs/out.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(refused.status, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
