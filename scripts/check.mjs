import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(dir) { const files = []; for (const entry of await readdir(dir, { withFileTypes: true })) { if (['.git','node_modules','runtime','work'].includes(entry.name)) continue; const file = resolve(dir, entry.name); if (entry.isDirectory()) files.push(...await walk(file)); else files.push(file); } return files; }
const failures = [];
const corpus = JSON.parse(await readFile(resolve(root, '_corpus/manifest.json'), 'utf8'));
const originals = new Set();
if (corpus.version !== 1 || !Array.isArray(corpus.sources) || !corpus.sources.length) throw new Error('Invalid source archive manifest');
for (const source of corpus.sources) {
  if (!source || typeof source.file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 ._-]*\.md$/.test(source.file) || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Invalid source archive entry');
  const file = resolve(root, '_corpus', source.file), body = await readFile(file);
  if (originals.has(file)) throw new Error('Duplicate source archive entry');
  originals.add(file);
  if (body.length !== source.bytes || createHash('sha256').update(body).digest('hex') !== source.sha256) failures.push(`_corpus/${source.file}: archived source integrity mismatch`);
}
for (const file of await walk(root)) {
  if (!/\.(mjs|ts|json|md|yml)$/.test(file)) continue;
  const body = await readFile(file, 'utf8');
  // Preserve imported originals exactly; authored material still follows source style.
  if (!originals.has(file) && body.includes(String.fromCharCode(8212))) failures.push(`${relative(root,file)}: em dash`);
  const patterns = [/gh[pousr]_[A-Za-z0-9]{30,}/, /sk-(?:live|test)_[A-Za-z0-9]{16,}/, /eyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/];
  if (patterns.some(p => p.test(body))) failures.push(`${relative(root,file)}: possible credential (value withheld)`);
  if (file.endsWith('.json')) { try { JSON.parse(body); } catch { failures.push(`${relative(root,file)}: invalid JSON`); } }
  if (file.endsWith('.mjs') || file.endsWith('.ts')) { const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (r.status !== 0) failures.push(`${relative(root,file)}: syntax check failed`); }
}
// The fast gates of plan Phase 3, each its own script so it can run alone: the crew's cards against their
// sources, no per-run bespoke code, the local link check, the docs drift check, and the library check on its synthetic listing;
// and Phase 5's: the old route stays in code for 30 days after the switch;
// and, since plan section 12 (M3, M4), the visibility and guest standards ported from Control Center's own guard.
const gates = [['scripts/check-crew.mjs'], ['scripts/check-bespoke.mjs'], ['scripts/check-links.mjs'], ['scripts/check-drift.mjs'], ['scripts/check-library.mjs', '--listing', 'tests/fixtures/library/listing.synthetic.json', '--fixture'], ['scripts/check-switch.mjs'], ['scripts/check-visibility-standard.mjs']];
for (const [script, ...args] of gates) {
  const r = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) failures.push(`${script}: ${(r.stderr || r.stdout).trim()}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; } else console.log('PASS: syntax, JSON, source style, archive integrity and value-redacted secret checks; the crew cards, bespoke code, links, docs drift, the library check, the old route kept until 30 days after the switch, and the visibility standard');
