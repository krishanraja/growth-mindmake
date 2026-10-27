/**
 * The mutation runner (N07; plan section 4, "Self-certification"): a kill
 * claim is re-run, never asserted. It copies the repository once, applies
 * each mutation declared in invariants/mutations.json to the copy (one at a
 * time, restoring the file after), runs the tests the mutation names, and
 * reports each one killed (a test failed) or survived. Any survivor, or a
 * mutation whose text is no longer in its file, fails the run.
 *
 *   npm run mutate                     every declared mutation
 *   node scripts/mutate.mjs --only <id>  one of them
 *
 * Zero dependencies; nothing outside the copy is touched. Not part of
 * `npm test`: it runs the suite once per mutation.
 */
import { readFile, writeFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const declared = JSON.parse(await readFile(resolve(root, 'invariants/mutations.json'), 'utf8'));
const only = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null; })();
const list = declared.mutations.filter(m => !only || m.id === only);
if (!list.length) { console.error('No mutation matches.'); process.exit(1); }

const copy = await mkdtemp(join(tmpdir(), 'growth-mutate-'));
const SKIP = new Set(['.git', 'node_modules', 'runtime', 'work']);
await cp(root, copy, { recursive: true, filter: src => !SKIP.has(relative(root, src).split(/[\\/]/)[0]) });
const results = [];
try {
  for (const m of list) {
    const file = join(copy, m.file);
    const original = await readFile(file, 'utf8');
    if (original.split(m.find).length !== 2) { results.push({ id: m.id, state: 'stale', why: 'its text is not in the file exactly once' }); continue; }
    await writeFile(file, original.replace(m.find, m.replace));
    const run = spawnSync(process.execPath, ['--test', ...m.tests], { cwd: copy, encoding: 'utf8', timeout: 300000 });
    await writeFile(file, original);
    results.push({ id: m.id, state: run.status === 0 ? 'survived' : 'killed', what: m.what });
  }
} finally { await rm(copy, { recursive: true, force: true }); }
for (const r of results) console.log(`${r.state.padEnd(8)} ${r.id}: ${r.what ?? r.why}`);
const bad = results.filter(r => r.state !== 'killed');
console.log(`${results.length - bad.length} of ${results.length} mutations killed.`);
if (bad.length) process.exitCode = 1;
