import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// F08: the runner once read secret and variable names that did not exist.
// operate.yml is parsed against docs/OPERATIONS.md and the CLI, so a name
// that exists in one and not the others fails here, before a live run does.
const root = new URL('../../', import.meta.url);
const workflow = await readFile(new URL('.github/workflows/operate.yml', root), 'utf8');
const operations = await readFile(new URL('docs/OPERATIONS.md', root), 'utf8');
const cli = await readFile(new URL('src/cli.mjs', root), 'utf8');

/** One job's env block, as `{ NAME: { kind: 'secrets'|'vars'|'literal', ref } }`. */
function jobEnv(name) {
  const job = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`).exec(workflow)?.[1] ?? '';
  const env = /\n    env:\n((?:      .*\n)+)/.exec(`${job}\n`)?.[1] ?? '';
  const out = {};
  for (const m of env.matchAll(/^ {6}([A-Z_]+): (.*)$/gm)) {
    const ref = /\$\{\{\s*(secrets|vars)\.([A-Z_]+)/.exec(m[2]);
    out[m[1]] = ref ? { kind: ref[1], ref: ref[2] } : { kind: 'literal', ref: null };
  }
  return out;
}

test('the dispatch job binds the engine bearer secret and the Control Center origin variable by their real names (F08)', () => {
  const env = jobEnv('dispatch');
  assert.deepEqual(env.CONTROL_CENTER_URL, { kind: 'vars', ref: 'CONTROL_CENTER_URL' });
  assert.deepEqual(env.CONTROL_CENTER_ENGINE_TOKEN, { kind: 'secrets', ref: 'CONTROL_CENTER_ENGINE_TOKEN' });
  assert.deepEqual(env.MINDMAKE_GROWTH_TOKEN, { kind: 'secrets', ref: 'GROWTH_ENGINE_TOKEN' });
});

test('every secret and variable operate.yml reads is named in OPERATIONS.md, and every environment name the CLI reads is bound (F08)', () => {
  const refs = [...workflow.matchAll(/\$\{\{\s*(secrets|vars)\.([A-Z_]+)/g)].map(m => m[2]);
  assert.ok(refs.length >= 4);
  for (const r of new Set(refs)) assert.match(operations, new RegExp(`\\b${r}\\b`), `${r} is documented`);
  const bound = new Set([...workflow.matchAll(/^ {6}([A-Z_]+):/gm)].map(m => m[1]));
  const read = new Set([...cli.matchAll(/process\.env\.([A-Z_]+)/g)].map(m => m[1]).filter(n => n !== 'GITHUB_SHA'));
  for (const n of read) assert.ok(bound.has(n), `${n} is bound in operate.yml`);
});
