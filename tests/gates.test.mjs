import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { literals, findings, ALLOW } from '../scripts/check-bespoke.mjs';
import { linkTargets, brokenLinks } from '../scripts/check-links.mjs';
import { frontMatter, namedPaths, protocolDrift } from '../scripts/check-drift.mjs';
import { cardFor, lensFor, section, CARD_MAX, LENS_MAX } from '../src/crew/cards.mjs';

// The fast gates of plan Phase 3: no per-run bespoke code, the local link
// check, the docs drift check and the crew's generated cards (N07, N08).
const root = new URL('../', import.meta.url);

test('check-bespoke reads string literals only, past comments, regular expressions and template code', () => {
  const src = "// mindmake:2026-10-27:manual-24 in a comment\nconst re = /\"2026-10-27\"/;\nconst a = `run ${x ? `manual-24` : 'b'} done`;\nconst ok = 'Ruling, Krish, 2026-10-27: a citation';\nconst bad = \"dispatch-31\";";
  assert.deepEqual(literals(src), ['run ', 'manual-24', 'b', ' done', 'Ruling, Krish, 2026-10-27: a citation', 'dispatch-31']);
  assert.deepEqual(findings('src/x.mjs', src).map(f => f.rule), ['run id', 'run id']);
  assert.deepEqual(findings('src/x.mjs', "const d = '2026-11-09'; const m = 'someone@example.org'; const u = '00000000-0000-4000-8000-000000000001';").map(f => f.rule), ['dated value', 'address', 'id']);
  // An allowed constant is allowed only in its own file.
  const allowed = ALLOW.find(a => a.literal === '2026-11-09');
  assert.deepEqual(findings(allowed.file, "export const FIRST_SPEC_WEEK = '2026-11-09';"), []);
  assert.equal(findings('src/other.mjs', "export const FIRST_SPEC_WEEK = '2026-11-09';").length, 1);
});

test('the link check finds a link out of the repository and a missing file, and passes this repository', async () => {
  assert.deepEqual(linkTargets('[a](b.md) [c](https://x.example) [d](#here) `[e](f.md)` [g](h.md#part)'), ['b.md', 'h.md']);
  const dir = await mkdtemp(join(tmpdir(), 'links-'));
  try {
    await mkdir(join(dir, 'docs'));
    await writeFile(join(dir, 'docs', 'a.md'), '[ok](b.md) [gone](c.md) [out](../../DECISIONS/038.md)');
    await writeFile(join(dir, 'docs', 'b.md'), 'b');
    assert.deepEqual((await brokenLinks(dir)).map(b => [b.target, b.reason]), [['c.md', 'missing'], ['../../DECISIONS/038.md', 'outside the repository']]);
  } finally { await rm(dir, { recursive: true, force: true }); }
  assert.deepEqual(await brokenLinks(new URL('.', root).pathname.replace(/\/$/, '')), []);
});

test('the drift check reads NOW.md\'s named files and the protocol header against its newest version', async () => {
  const fm = frontMatter(await readFile(new URL('NOW.md', root), 'utf8'));
  assert.match(fm.head, /^[0-9a-f]{7,40}$/);
  assert.ok(namedPaths(fm).includes('docs/history/LOG.md'));
  assert.equal(protocolDrift('# The growth engine protocol, version 1.9.0\n\n1.9.0 adds pitches.'), null);
  assert.equal(protocolDrift('# The growth engine protocol, version 1.8.0\n\n1.9.0 adds pitches.'), 'the header says 1.8.0 but the document reaches 1.9.0');
  assert.equal(protocolDrift(await readFile(new URL('docs/control-center/ENGINE-PROTOCOL.md', root), 'utf8')), null);
});

test('every card and lens is generated from its sources, within its size, and a changed playbook is drift', async () => {
  const index = JSON.parse(await readFile(new URL('crew/index.json', root), 'utf8'));
  const texts = {};
  for (const s of index.specialists) for (const x of s.sources) texts[x.file] ??= await readFile(new URL(x.file, root), 'utf8');
  for (const s of index.specialists) {
    const card = cardFor(s, texts), lens = lensFor(s);
    assert.equal(await readFile(new URL(`crew/${s.slug}/card.md`, root), 'utf8'), card, `${s.slug} card`);
    assert.equal(await readFile(new URL(`crew/${s.slug}/lens.md`, root), 'utf8'), lens, `${s.slug} lens`);
    assert.ok(Buffer.byteLength(card) <= CARD_MAX && Buffer.byteLength(lens) <= LENS_MAX, s.slug);
    for (const x of s.sources) assert.ok(card.includes(x.heading), `${s.slug} names ${x.heading}`);
  }
  // A playbook edit changes the recorded hash, so the committed card no longer matches.
  const s = index.specialists[0], file = s.sources[0].file;
  assert.notEqual(cardFor(s, { ...texts, [file]: `${texts[file]}\nOne more line.\n` }), cardFor(s, texts));
  assert.throws(() => cardFor(s, { ...texts, [file]: texts[file].replace(`## ${s.sources[0].heading}`, '## Renamed') }), /has no section/);
  assert.equal(section('# T\n\n## A\n\nx\n\n### A.1\n\ny\n\n## B\n\nz', 'A'), '\nx\n\n### A.1\n\ny\n');
});

test('the declared mutations name real files, text that is there once, and tests that exist', async () => {
  const { mutations } = JSON.parse(await readFile(new URL('invariants/mutations.json', root), 'utf8'));
  assert.ok(mutations.length >= 8);
  const ids = new Set();
  for (const m of mutations) {
    assert.ok(!ids.has(m.id), m.id); ids.add(m.id);
    const text = await readFile(new URL(m.file, root), 'utf8');
    assert.equal(text.split(m.find).length, 2, `${m.id}: its text is in ${m.file} exactly once`);
    assert.notEqual(m.find, m.replace, m.id);
    for (const t of m.tests) await readFile(new URL(t, root));
  }
  assert.ok((await readdir(new URL('scripts/', root))).includes('mutate.mjs'));
});
