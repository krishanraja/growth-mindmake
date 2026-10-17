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
console.log(`PASS: ${names.length} frozen version-1 wire contracts match producer ${pkg.version}`);
