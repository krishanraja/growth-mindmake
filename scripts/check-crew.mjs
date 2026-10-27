/**
 * The crew's gate (plan sections 2 and 3).
 *
 *   node scripts/check-crew.mjs           every card and lens matches what its sources give (the drift check), within its size,
 *                                         and crew/index.json names exactly the lints and checks each specialist's modules export
 *   node scripts/check-crew.mjs --write   regenerates crew/<slug>/card.md and lens.md
 *
 * A playbook that changes without its cards being regenerated fails here.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { cardFor, lensFor, CARD_MAX, LENS_MAX } from '../src/crew/cards.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = JSON.parse(await readFile(resolve(root, 'crew/index.json'), 'utf8'));
const write = process.argv.includes('--write');
const failures = [];
const texts = {};
for (const s of index.specialists) for (const x of s.sources) texts[x.file] ??= await readFile(resolve(root, x.file), 'utf8');

if (index.version !== 1 || index.specialists.length !== 9) failures.push('crew/index.json lists the nine specialists of plan section 3');
const slugs = new Set();
for (const s of index.specialists) {
  if (!/^[a-z][a-z-]+$/.test(s.slug) || slugs.has(s.slug)) failures.push(`${s.slug}: a unique slug`);
  slugs.add(s.slug);
  // The index names what the code exports, exactly: a lint or a check exists in one place.
  const lint = await import(pathToFileURL(resolve(root, s.lint)).href);
  const check = await import(pathToFileURL(resolve(root, s.check)).href);
  if (lint.SPECIALIST !== s.slug || check.SPECIALIST !== s.slug) failures.push(`${s.slug}: its lint and check modules name it`);
  if (JSON.stringify(lint.LINTS) !== JSON.stringify(s.lints)) failures.push(`${s.slug}: crew/index.json lints differ from ${s.lint}`);
  if (JSON.stringify(check.CHECKS) !== JSON.stringify(s.checks)) failures.push(`${s.slug}: crew/index.json checks differ from ${s.check}`);
  let card, lens;
  try { card = cardFor(s, texts); lens = lensFor(s); } catch (e) { failures.push(e.message); continue; }
  if (Buffer.byteLength(card) > CARD_MAX) failures.push(`${s.slug}: card is over ${CARD_MAX} bytes`);
  if (Buffer.byteLength(lens) > LENS_MAX) failures.push(`${s.slug}: lens is over ${LENS_MAX} bytes`);
  const dir = resolve(root, 'crew', s.slug);
  if (write) { await mkdir(dir, { recursive: true }); await writeFile(resolve(dir, 'card.md'), card); await writeFile(resolve(dir, 'lens.md'), lens); continue; }
  for (const [name, want] of [['card.md', card], ['lens.md', lens]]) {
    let have = null;
    try { have = await readFile(resolve(dir, name), 'utf8'); } catch { /* missing is drift */ }
    if (have !== want) failures.push(`crew/${s.slug}/${name} is not what its sources give: run node scripts/check-crew.mjs --write`);
  }
}
// Every module under src/crew/lints and src/crew/checks belongs to a specialist, or is the shared code they import.
const SHARED = new Set(['grammar.mjs', 'common.mjs']);
for (const [dir, key] of [['src/crew/lints', 'lint'], ['src/crew/checks', 'check']]) {
  for (const f of await readdir(resolve(root, dir))) if (!SHARED.has(f) && !index.specialists.some(s => s[key] === `${dir}/${f}`)) failures.push(`${dir}/${f} belongs to no specialist in crew/index.json`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(write ? `Wrote ${index.specialists.length} cards and lenses` : `PASS: ${index.specialists.length} specialists, each card within ${CARD_MAX} bytes and lens within ${LENS_MAX}, generated from their sources with no drift`);
