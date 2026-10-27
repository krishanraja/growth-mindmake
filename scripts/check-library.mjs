/**
 * The Librarian's gate (docs/DRIVE.md, "The check"; plan section 3).
 *
 *   node scripts/check-library.mjs                 library/taxonomy.json matches docs/DRIVE.md (the drift check)
 *   node scripts/check-library.mjs --write         regenerates library/taxonomy.json from docs/DRIVE.md
 *   node scripts/check-library.mjs --listing <f>   also reports the counts for a listing of the folders, each of which should be zero
 *   node scripts/check-library.mjs --listing <f> --fixture   passes only when the counts are exactly the listing's own `expect` (a synthetic fixture)
 *
 * The listing is JSON: titles, folders, mime types and modified dates
 * (src/crew/library.mjs, checkListing). Counts only; it prints no title.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { taxonomyOf, checkListing, nameOf } from '../src/crew/library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const doc = await readFile(resolve(root, 'docs/DRIVE.md'), 'utf8');
const taxonomy = taxonomyOf(doc);
const file = resolve(root, 'library/taxonomy.json');
const text = `${JSON.stringify(taxonomy, null, 2)}\n`;
const failures = [];

if (args.includes('--write')) {
  await mkdir(resolve(root, 'library'), { recursive: true });
  await writeFile(file, text);
  console.log('Wrote library/taxonomy.json from docs/DRIVE.md');
} else {
  let current = null;
  try { current = await readFile(file, 'utf8'); } catch { /* missing is drift */ }
  if (current !== text) failures.push('library/taxonomy.json is not what docs/DRIVE.md gives: run node scripts/check-library.mjs --write');
}
// Every example docs/DRIVE.md gives passes its own naming pattern.
for (const e of taxonomy.examples) if (!nameOf(e, taxonomy)) failures.push(`docs/DRIVE.md example fails the naming pattern: ${e}`);
const listingPath = opt('--listing');
if (listingPath) {
  const listing = JSON.parse(await readFile(resolve(listingPath), 'utf8'));
  const counts = checkListing(listing, taxonomy);
  const expect = args.includes('--fixture') ? JSON.stringify(listing.expect ?? {}) : null;
  console.log(`Library check: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (expect) {
    const want = JSON.parse(expect);
    for (const [k, v] of Object.entries(counts)) if ((want[k] ?? 0) !== v) failures.push(`library check: ${k} is ${v}, expected ${want[k] ?? 0}`);
  } else if (Object.values(counts).some(v => v > 0)) failures.push('library check: a count is not zero');
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else if (!args.includes('--write')) console.log(`PASS: library/taxonomy.json matches docs/DRIVE.md; ${taxonomy.examples.length} naming examples pass${listingPath ? '; the listing check ran' : ''}`);
