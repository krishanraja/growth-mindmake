import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { taxonomyOf, nameOf, checkListing, COUNTS } from '../src/crew/library.mjs';
import * as librarian from '../src/crew/lints/librarian.mjs';
import * as checks from '../src/crew/checks/librarian.mjs';

// The Librarian (plan Phase 3; docs/DRIVE.md "The check"): the taxonomy is
// docs/DRIVE.md read as data, and the check counts a synthetic listing.
const root = new URL('../', import.meta.url);
const doc = await readFile(new URL('docs/DRIVE.md', root), 'utf8');
const taxonomy = taxonomyOf(doc);
const listing = JSON.parse(await readFile(new URL('tests/fixtures/library/listing.synthetic.json', root), 'utf8'));

test('library/taxonomy.json is exactly what docs/DRIVE.md gives', async () => {
  assert.equal(await readFile(new URL('library/taxonomy.json', root), 'utf8'), `${JSON.stringify(taxonomy, null, 2)}\n`);
  assert.equal(taxonomy.root, '03_Growth');
  assert.ok(taxonomy.folders.includes('03_Growth/Growth assets/Speaker and guest one-sheet/Current'));
  assert.deepEqual(taxonomy.top_files, ['Growth library READ ME FIRST', 'Growth index']);
  assert.deepEqual([taxonomy.current.max_pdf, taxonomy.drafts.max], [1, 3]);
  assert.deepEqual(taxonomy.canva.folders, ['Mindmake Growth', 'Mindmake Growth/Brand kit', 'Mindmake Growth/Speaker and guest one-sheet', 'Mindmake Growth/Drafts']);
  assert.throws(() => taxonomyOf(doc.replace('## The map', '## A map')), /the map could not be read/);
});

test('the naming pattern passes every example in docs/DRIVE.md, and refuses the words never in a title', () => {
  assert.ok(taxonomy.examples.length >= 5);
  for (const e of taxonomy.examples) assert.ok(nameOf(e, taxonomy), e);
  assert.deepEqual(nameOf('2026-11-03 One-sheet Speaker and guest v2 (superseded 2026-11-10).pdf', taxonomy), { date: '2026-11-03', kind: 'One-sheet', subject: 'Speaker and guest', version: 2, superseded: '2026-11-10', ext: '.pdf' });
  assert.equal(nameOf('2026-11-03 Brand kit specimen Mindmake v1', taxonomy).kind, 'Brand kit specimen');
  for (const bad of ['One-sheet final.pdf', '2026-11-03 One-sheet Speaker final v2.pdf', '2026-11-03 Plan new v1', '2026-11-03 Plan copy of the plan v1', '2026-11-03 Memo Speaker v1', '03-11-2026 Plan X v1', '2026-11-03 Plan X']) assert.equal(nameOf(bad, taxonomy), null, bad);
});

test('on a synthetic listing the check catches a loose file, a duplicate, a second PDF in a Current and a stale copy, and nothing else', () => {
  assert.deepEqual(checkListing(listing, taxonomy), { outside_map: 0, loose: 1, bad_names: 0, duplicates: 1, current_over_one_pdf: 1, drafts_over_cap: 0, canva_outside: 0, stale_copies: 1, index_mismatch: 0 });
  // Each other count is caught too, one at a time.
  const more = structuredClone(listing);
  more.drive.push({ title: '2026-11-01 Plan Somewhere else v1', folder: '03_Growth/Elsewhere', mime: 'x' }, { title: 'notes.txt', folder: '03_Growth/Growth measurement', mime: 'text/plain' });
  for (let i = 1; i <= 4; i++) more.drive.push({ title: `2026-11-0${i} One-sheet Speaker and guest v${10 + i}.pdf`, folder: '03_Growth/Growth assets/Speaker and guest one-sheet/Drafts', mime: 'application/pdf' });
  more.canva.push({ title: 'Loose design', folder: 'Somewhere', engine_made: true });
  more.index.push({ title: 'Gone', folder: '03_Growth/Growth measurement' });
  const c = checkListing(more, taxonomy);
  assert.deepEqual([c.outside_map, c.bad_names, c.drafts_over_cap, c.canva_outside, c.index_mismatch], [1, 1, 1, 1, 2]);
  assert.deepEqual(Object.keys(c), COUNTS);
});

test('the Librarian lints a filing before it is made', () => {
  const file = (over = {}) => ({ proposal_id: 'file-1', filing: { op: 'file', title: '2026-11-12 One-sheet Speaker and guest v5.pdf', folder: '03_Growth/Growth assets/Speaker and guest one-sheet/Current', mime: 'application/pdf', moves: [], ...over } });
  const ids = p => librarian.lint(p, { taxonomy, listing }).map(f => f.lint);
  // Two older PDFs sit in Current and neither moves to the archive.
  assert.ok(ids(file()).includes('library.superseded_archived'));
  const moves = ['2026-11-10 One-sheet Speaker and guest v3.pdf', '2026-11-11 One-sheet Speaker and guest v4.pdf'].map(t => ({ from_title: t, folder: '03_Growth/Growth archive', title: t.replace('.pdf', ' (superseded 2026-11-12).pdf') }));
  assert.deepEqual(ids(file({ moves })), []);
  assert.ok(ids(file({ op: 'share', moves })).includes('library.never_trash_or_share'));
  assert.ok(ids(file({ folder: '03_Growth/Anywhere', moves })).includes('library.path_in_map'));
  assert.ok(ids(file({ title: 'One-sheet final.pdf', moves })).includes('library.name_pattern'));
  assert.ok(ids(file({ title: '2026-11-11 One-sheet Speaker and guest v4.pdf', folder: '03_Growth/Growth archive' })).includes('library.no_duplicate'));
  assert.ok(ids(file({ folder: '03_Growth/Growth measurement', title: '2026-11-12 Readout Someone at someone@example.org v1' })).includes('library.nothing_private'));
});

test('the Librarian\'s measured check is unknown until the listing is served, then the counts', () => {
  assert.deepEqual(checks.measure({ context: {}, taxonomy }).map(m => [m.check, m.value]), [['library.listing', null]]);
  const served = checks.measure({ context: { library: listing }, taxonomy });
  assert.equal(served.find(m => m.check === 'library.loose').value, 1);
  assert.equal(served.find(m => m.check === 'library.listing').value, listing.drive.length);
});
