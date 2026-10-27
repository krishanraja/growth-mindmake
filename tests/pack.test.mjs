import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPack, reportCounts, buildSteps, PACK_MAX, MARK, MANDATORY_PARTS, ALWAYS, MAX_CARDS, londonDate, mondayOf } from '../scripts/pack.mjs';

// The session pack (plan Phase 4, section 5): every mandatory load in 36 KB
// or less, or the command fails. Synthetic reports only.
const root = fileURLToPath(new URL('../', import.meta.url));
const index = JSON.parse(await readFile(join(root, 'crew/index.json'), 'utf8'));
const AT = '2026-10-27T20:00:00Z';
const bytes = s => Buffer.byteLength(s, 'utf8');
// The three largest cards: the heaviest pack a session can ask for.
const cardBytes = await Promise.all(index.specialists.map(async s => [s.slug, bytes(await readFile(join(root, `crew/${s.slug}/card.md`), 'utf8'))]));
const HEAVIEST = cardBytes.sort((a, b) => b[1] - a[1]).slice(0, MAX_CARDS).map(([s]) => s);

test('this repository\'s pack with the three largest cards fits in 36 KB and names every mandatory part', async () => {
  const pack = await buildPack({ root, cards: HEAVIEST, at: AT });
  assert.ok(pack.fits, `the pack is ${pack.total} bytes`);
  assert.ok(pack.total <= PACK_MAX);
  assert.equal(pack.total, bytes(pack.text));
  assert.equal(pack.parts.reduce((n, p) => n + p.bytes, 0), pack.total, 'the parts add up to the whole');
  for (const part of MANDATORY_PARTS) assert.ok(pack.text.includes(MARK(part)), `the pack does not name ${part}`);
  for (const c of HEAVIEST) assert.ok(pack.text.includes(MARK(`card: ${c}`)));
  // Each always-on file is held whole, not summarised.
  for (const f of ALWAYS) assert.ok(pack.text.includes(await readFile(join(root, f), 'utf8')), `${f} is not in the pack whole`);
  for (const c of HEAVIEST) assert.ok(pack.text.includes(await readFile(join(root, `crew/${c}/card.md`), 'utf8')));
  // With no report, findings and holds are unknown, never zero.
  assert.match(pack.text, /=== pack part: findings and holds ===\n\nUnknown: no report file was passed/);
  // Before 9 November the spec in force is the default spec, today's settings.
  assert.match(pack.text, /"spec":"growth-week\/1","week_of":"2026-10-26"/);
  assert.match(pack.text, /- North Star: U4, not measured yet/);
});

test('the limit is exact: 36,864 bytes fits, one byte more fails, and the command exits 1', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pack-'));
  for (const f of [...ALWAYS, 'docs/GET-GOING.md', 'crew/index.json']) { await mkdir(join(dir, f, '..'), { recursive: true }); await cp(join(root, f), join(dir, f)); }
  const base = await buildPack({ root: dir, at: AT });
  const agents = await readFile(join(dir, 'AGENTS.md'), 'utf8');
  await writeFile(join(dir, 'AGENTS.md'), agents.trimEnd() + 'x'.repeat(PACK_MAX - base.total) + '\n');
  const exact = await buildPack({ root: dir, at: AT });
  assert.equal(exact.total, PACK_MAX);
  assert.equal(exact.fits, true);
  await writeFile(join(dir, 'AGENTS.md'), agents.trimEnd() + 'x'.repeat(PACK_MAX - base.total + 1) + '\n');
  const over = await buildPack({ root: dir, at: AT });
  assert.equal(over.total, PACK_MAX + 1);
  assert.equal(over.fits, false);
  const run = spawnSync(process.execPath, [join(root, 'scripts/pack.mjs'), '--at', AT], { cwd: dir, encoding: 'utf8', env: { ...process.env, PACK_ROOT: dir } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /1 bytes over 36 KB/);
  assert.match(run.stdout, /runtime\/pack\.md: 36865 bytes of 36864/);
  assert.match(run.stdout, /  AGENTS\.md: \d+ bytes/);
  // And this repository's own run passes, printing every part's bytes.
  const ok = spawnSync(process.execPath, [join(root, 'scripts/pack.mjs'), '--at', AT, '--out', join(dir, 'ok.md'), '--cards', HEAVIEST.join(',')], { cwd: root, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  for (const p of ['header', ...ALWAYS, 'week spec', 'cards', 'findings and holds', 'gate status']) assert.match(ok.stdout, new RegExp(`\\n  ${p.replace(/\./g, '\\.')}: \\d+ bytes`));
});

test('cards: at most three, each a specialist crew/index.json names, never twice', async () => {
  const slugs = index.specialists.map(s => s.slug);
  await assert.rejects(buildPack({ root, cards: slugs.slice(0, 4), at: AT }), /up to 3/);
  await assert.rejects(buildPack({ root, cards: ['nobody'], at: AT }), /No specialist/);
  await assert.rejects(buildPack({ root, cards: [slugs[0], slugs[0]], at: AT }), /twice/);
  const none = await buildPack({ root, at: AT });
  assert.match(none.text, /=== pack part: cards ===\n\nNone named/);
});

test('a report gives counts and codes only: holds by reason, lint findings from the shadow line, never a detail', async () => {
  const report = { status: 'held', holds: [
    { reason: 'spec_unsigned', detail: 'Synthetic Person at Example Co was held for a private reason.' },
    { reason: 'founder_visibility_open', detail: 'x' },
    { reason: 'pitch_not_live', detail: 'y' },
    { reason: 'pitch_not_live', detail: 'z' },
    { reason: 'Not A Code', detail: 'w' }
  ], activity: [
    { line: 'Week spec for the week of 2026-11-09: not signed, so today\'s settings apply.' },
    { line: 'Crew lints, in shadow: read 4 proposals; 3 findings (card_grammar 2, visibility.one_link 1). Nothing is held by them until the switch (plan Phase 5).' }
  ] };
  const c = reportCounts(report);
  assert.deepEqual(c.holds, [['pitch_not_live', 2], ['founder_visibility_open', 1], ['spec_unsigned', 1], ['unrecognised', 1]]);
  assert.deepEqual(c.findings, [['card_grammar', 2], ['visibility.one_link', 1]]);
  assert.equal(c.specState, 'not signed');
  const pack = await buildPack({ root, report: { report }, at: '2026-11-10T08:00:00Z' });
  assert.match(pack.text, /Report status: held\.\nOpen lint findings, in shadow: 3 \(card_grammar 2, visibility\.one_link 1\)\.\nHolds: 5 \(pitch_not_live 2, founder_visibility_open 1, spec_unsigned 1, unrecognised 1\)\./);
  assert.ok(!pack.text.includes('Synthetic Person') && !pack.text.includes('Not A Code'), 'a detail or a raw reason reached the pack');
  assert.match(pack.text, /- Week spec: not signed for the week of 2026-11-09, per the report\./);
  assert.deepEqual(reportCounts({ activity: [{ line: 'Crew lints, in shadow: read 1 proposal; no findings. Nothing is held.' }], holds: [] }).findings, []);
  assert.equal(reportCounts({ status: 'ready' }).holds, null, 'no holds array is unknown, not none');
  assert.equal(reportCounts('not a report'), null);
});

test('gate status reads the build\'s open steps and the London week', () => {
  assert.deepEqual(buildSteps('- [x] **Phase 1.** a\n- [ ] **Phase 4.** b\n- [ ] **Canva C1.** c\n'), { done: 1, open: ['Phase 4', 'Canva C1'] });
  assert.equal(londonDate('2026-10-25T23:30:00Z'), '2026-10-25');
  assert.equal(londonDate('2026-07-01T23:30:00Z'), '2026-07-02');
  assert.equal(mondayOf('2026-11-15'), '2026-11-09');
  assert.equal(mondayOf('2026-11-09'), '2026-11-09');
});
