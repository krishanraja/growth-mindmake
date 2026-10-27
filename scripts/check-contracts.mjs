import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CONTRACT_NAMES } from '../contracts/operations.ts';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('contracts/manifest.json', root), 'utf8'));
const names = CONTRACT_NAMES;
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
if (manifest.version !== 1 || manifest.producer_version !== pkg.version || pkg.version !== '2.0.0' || Object.keys(manifest.contracts ?? {}).sort().join(',') !== [...names].sort().join(',')) throw new Error('Contract manifest is invalid');
for (const name of names) {
  const entry = manifest.contracts[name];
  if (entry.version !== 1 || entry.file !== `${name}.ts` || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Contract manifest entry is invalid');
  const observed = createHash('sha256').update(await readFile(new URL(`contracts/${entry.file}`, root))).digest('hex');
  if (observed !== entry.sha256) throw new Error(`Contract digest mismatch: ${name}`);
}
// The week spec's schema (plan Phase 2) is frozen the same way, and its synthetic example must fit it and compile inside the policy's bounds.
const week = manifest.schemas?.week;
if (!week || week.id !== 'growth-week/1' || week.file !== 'specs/schema/week.schema.json' || !/^[a-f0-9]{64}$/.test(week.sha256) || Object.keys(manifest.schemas).join(',') !== 'week') throw new Error('Schema manifest entry is invalid');
if (createHash('sha256').update(await readFile(new URL(week.file, root))).digest('hex') !== week.sha256) throw new Error('Schema digest mismatch: week');
const { compile } = await import('../src/crew/compile.mjs');
const example = JSON.parse(await readFile(new URL('specs/examples/week.synthetic.json', root), 'utf8'));
const policy = JSON.parse(await readFile(new URL('config/policy.json', root), 'utf8'));
const compiled = compile(example, policy, { weekOf: example.week_of });
if (!compiled.ok) throw new Error(`The synthetic week spec does not compile: ${compiled.reason}`);
console.log(`PASS: ${names.length} frozen version-1 wire contracts and the ${week.id} schema match producer ${pkg.version}`);
