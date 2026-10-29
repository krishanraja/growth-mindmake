import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { derive, sections, sha, RULING, controlCenterStateLine } from './support/rulings.mjs';

// Plan Phase 4 shortened AGENTS.md and NOW.md so the session pack fits in
// 36 KB. Nothing Krish ruled may be lost or reworded on the way: every ruling
// section moved verbatim to docs/RULINGS.md, every quote of his is still in
// AGENTS.md or there, the standing rules stay in AGENTS.md word for word, the
// owner list moved verbatim to docs/OWNERS.md, and NOW.md's older changes
// moved verbatim to docs/history/LOG.md with its state line untouched.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFile(new URL(p, new URL('../', import.meta.url)), 'utf8');
const fixture = JSON.parse(await read('tests/fixtures/rulings/at-main.json'));
const [agents, rulings, owners, now, log] = await Promise.all(['AGENTS.md', 'docs/RULINGS.md', 'docs/OWNERS.md', 'NOW.md', 'docs/history/LOG.md'].map(read));

test('the fixture is what main held at its source commit, wherever git still has that commit', t => {
  const show = path => spawnSync('git', ['show', `${fixture.source_commit}:${path}`], { cwd: root, encoding: 'utf8' });
  const a = show('AGENTS.md'), n = show('NOW.md');
  if (a.status !== 0 || n.status !== 0) { t.skip('the source commit is not in this checkout (a shallow clone); the fixture stands as recorded'); return; }
  const { note, source_commit, ...recorded } = fixture;
  assert.deepEqual(recorded, derive({ agents: a.stdout, now: n.stdout }));
});

test('every quote of his that AGENTS.md held is still in AGENTS.md or docs/RULINGS.md, word for word', () => {
  assert.ok(fixture.quotes.length >= 8);
  for (const q of fixture.quotes) assert.ok(agents.includes(`"${q}"`) || rulings.includes(`"${q}"`), `lost: "${q}"`);
});

test('every ruling section moved to docs/RULINGS.md verbatim, and AGENTS.md keeps one line naming each', () => {
  const kept = new Map(sections(rulings).map(s => [s.heading, s.body]));
  const pointers = sections(agents).find(s => s.heading === 'Rulings')?.body ?? '';
  for (const r of fixture.ruling_sections) {
    assert.ok(kept.has(r.heading), `docs/RULINGS.md has no section "${r.heading}"`);
    assert.equal(sha(kept.get(r.heading)), r.sha256, `"${r.heading}" was changed on the way`);
    assert.ok(pointers.split('\n').some(l => l.startsWith(`- ${r.heading}: `)), `AGENTS.md has no pointer line for "${r.heading}"`);
  }
  // Every ruling in docs/RULINGS.md has its pointer, including any added since.
  for (const s of sections(rulings).filter(x => RULING.test(x.heading))) assert.ok(pointers.includes(`- ${s.heading}: `), `no pointer for "${s.heading}"`);
  // No ruling section is left behind in AGENTS.md to drift from its record.
  assert.equal(sections(agents).filter(s => RULING.test(s.heading)).length, 0);
});

test('the standing rules every session needs stay in AGENTS.md word for word, the north-star block included', () => {
  const kept = new Map(sections(agents).map(s => [s.heading, s.body]));
  for (const s of fixture.standing_sections) assert.equal(sha(kept.get(s.heading) ?? ''), s.sha256, `"${s.heading}" changed or went`);
  assert.match(agents, /<!-- north-star:start -->\n## North Star: read it first, every session\n[\s\S]*?<!-- north-star:end -->/);
});

test('the owner list moved to docs/OWNERS.md line for line, and AGENTS.md names it', () => {
  const lines = new Set(owners.split('\n').map(sha));
  for (const h of fixture.owner_lines) assert.ok(lines.has(h), 'an owner line from AGENTS.md is missing from docs/OWNERS.md');
  assert.match(agents, /docs\/OWNERS\.md names the one owner of every responsibility/);
  for (const f of ['scripts/pack.mjs', 'scripts/dispatch-card.mjs', 'scripts/verify-card.mjs']) assert.ok(owners.includes(f), `docs/OWNERS.md names no owner for ${f}`);
});

test('NOW.md keeps its front matter keys, its state line byte for byte and its headings; older changes are in the log verbatim', () => {
  const keys = [...(/^---\n([\s\S]*?)\n---/.exec(now)?.[1] ?? '').matchAll(/^([a-z_]+):/gm)].map(m => m[1]);
  assert.deepEqual(keys, fixture.now.front_matter_keys);
  // The state line stays as main held it, unless Control Center's North Star reader rewrote it with the
  // good-meetings count, which may stay public (Ruling, Krish, 2026-10-29).
  const state = now.split('\n').find(l => l.includes('<!-- north-star-state'));
  assert.ok(sha(state) === fixture.now.state_line_sha256 || controlCenterStateLine(state), 'the North Star state line changed in a way Control Center\'s reader would not write');
  // The close-out re-dates "Where it is right now (as of ...)" each session, so a heading is compared without its date.
  const undated = h => h.replace(/ \(as of \d{4}-\d{2}-\d{2}\)$/, '');
  const headings = new Set(now.split('\n').filter(l => /^#{1,6} /.test(l)).map(undated));
  for (const h of fixture.now.headings) assert.ok(headings.has(undated(h)), `NOW.md lost the heading ${h}`);
  const lines = new Set([...now.split('\n'), ...log.split('\n')].map(sha));
  for (const b of fixture.now.changed_bullets) assert.ok(lines.has(b), 'a "What changed recently" bullet is in neither NOW.md nor docs/history/LOG.md');
  assert.match(log, /Moved here verbatim from NOW\.md's "What changed recently"/);
});

test('the good-meetings count may stand on the state line, and nothing else may (Ruling, Krish, 2026-10-29)', () => {
  const line = (state, sentence = 'Good meetings a week: 3 good meetings, against 2 this week, on the way to 20 by 30 November 2026. Push.') =>
    `<!-- north-star-state ${JSON.stringify(state)} --> **North Star number: U2, behind.** ${sentence}`;
  const counted = { week_of: '2026-10-26', week_target: 2, current: 3, current_as_of: '2026-10-29', current_source: 'Control Center calendar', urgency: 2, urgency_reason: 'behind' };
  assert.equal(controlCenterStateLine(now.split('\n').find(l => l.includes('<!-- north-star-state'))), true, 'today\'s line has the reader\'s shape');
  assert.equal(controlCenterStateLine(line(counted)), true);
  assert.equal(controlCenterStateLine(line({ ...counted, current: null })), true);
  assert.equal(controlCenterStateLine(line({ ...counted, current: 'private' })), false);
  assert.equal(controlCenterStateLine(line({ ...counted, current: 2.5 })), false);
  assert.equal(controlCenterStateLine(line({ ...counted, revenue: 5000 })), false, 'no other figure rides on the line');
  assert.equal(controlCenterStateLine(line(counted, 'Good meetings a week: 3, and $5,000 in proofs.')), false);
  assert.equal(controlCenterStateLine(line(counted, 'Good meetings a week: at 40% of this week.')), false);
  assert.equal(controlCenterStateLine('a line with no state'), false);
});
