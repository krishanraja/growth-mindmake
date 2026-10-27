import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/operate.yml', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/OPERATIONS.md', import.meta.url), 'utf8');

test('each Control Center wake reports under its own run id, and a re-run of it keeps that id (N01)', () => {
  assert.match(workflow, /if: \$\{\{ github\.event_name == 'repository_dispatch' \}\}\n(?:\s*#.*\n)?\s*run: node src\/cli\.mjs dispatch --kind dispatch-\$\{\{ github\.run_number \}\}\n/);
  assert.match(workflow, /run: node src\/cli\.mjs dispatch --kind manual-\$\{\{ github\.run_number \}\}/);
  assert.equal(/run_attempt/.test(workflow), false);
});

test("OPERATIONS.md states the dispatch job's real timeout and run id (F22)", () => {
  const job = /\n  dispatch:\n([\s\S]*?)(?=\n  [a-z-]+:\n|$)/.exec(workflow)?.[1] ?? '';
  const minutes = Number(/timeout-minutes: (\d+)/.exec(job)?.[1]);
  const words = { 5: 'five', 10: 'ten', 15: 'fifteen' }[minutes];
  assert.ok(words, 'the dispatch job has a timeout');
  assert.match(operations, new RegExp(`runs with a ${words}-minute timeout`));
  assert.match(operations, /mindmake:<London date>:dispatch-<run number>/);
});
