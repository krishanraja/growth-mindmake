import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { guard, cardErrors, cardDigest, parseApproval, commandLines, CARD_MAX, USAGE_MAX, NEVER_REQUIRED } from '../scripts/dispatch-card.mjs';
import { verifyCard, globRegex, outside, REPO_CHECKS } from '../scripts/verify-card.mjs';

// Codex task cards (plan Phase 4, section 6): the allowance guard and the
// verification outside the sandbox. A synthetic card, synthetic decision ids
// and temporary git repositories only; nothing is dispatched.
const root = fileURLToPath(new URL('../', import.meta.url));
const CARD_FILE = 'specs/examples/task-card.synthetic.json';
const TEXT = await readFile(join(root, CARD_FILE), 'utf8');
const CARD = JSON.parse(TEXT);
const DIGEST = cardDigest(CARD);
const NOW = '2026-11-16T10:00:00Z';
const USAGE = { read_at: '2026-11-16T09:30:00Z', source: 'Codex usage page, read in his local session', used_percent: 42 };
const YES = { decision_id: 'dec-synthetic-0001', payload_sha256: DIGEST };
const ok = (over = {}) => guard({ card: CARD, text: TEXT, usage: USAGE, approval: YES, ledger: [], now: NOW, cardPath: CARD_FILE, ...over });
const clone = v => JSON.parse(JSON.stringify(v));

test('the synthetic card fits the schema, its own rules and 6 KB', () => {
  assert.deepEqual(cardErrors(CARD, TEXT), []);
  assert.ok(Buffer.byteLength(TEXT) <= CARD_MAX);
  assert.ok(CARD.read.length <= 5);
  for (const n of NEVER_REQUIRED) assert.ok(CARD.never.includes(n));
  assert.match(DIGEST, /^[a-f0-9]{64}$/);
});

test('the guard passes a valid card with a fresh reading at or under 80% and his yes on its digest', () => {
  const r = ok();
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.digest, DIGEST);
  assert.deepEqual(r.entry, { card_id: CARD.id, card_sha256: DIGEST, decision_id: YES.decision_id, usage: USAGE, dispatched_at: '2026-11-16T10:00:00.000Z' });
  const task = r.lines.find(l => l.includes(' task '));
  assert.equal(task, `node <plugin>/scripts/codex-companion.mjs task --background --fresh --write --model ${CARD.model.name} --effort ${CARD.model.effort} --cwd ../growth-mindmake-codex-${CARD.id} --prompt-file ${CARD_FILE}`);
  assert.equal(r.lines[0], `git worktree add -b codex/${CARD.id} ../growth-mindmake-codex-${CARD.id} main`);
  assert.ok(r.lines.some(l => /codex-companion\.mjs status --wait$/.test(l)) && r.lines.some(l => /codex-companion\.mjs result$/.test(l)));
  assert.ok(r.lines.at(-1).startsWith('node scripts/verify-card.mjs --card '));
  assert.ok(!r.lines.join('\n').includes('rescue'));
  assert.equal(ok({ usage: { ...USAGE, used_percent: USAGE_MAX } }).ok, true, 'exactly 80% passes');
  assert.match(commandLines(CARD, { cardPath: 'c.json', plugin: '/x' })[1], /^node \/x\/scripts\/codex-companion\.mjs task /);
});

test('the guard refuses an unknown reading, with its name', () => {
  for (const usage of [null, undefined, {}, { ...USAGE, read_at: 'yesterday' }, { ...USAGE, source: '' }, { ...USAGE, source: undefined }, { ...USAGE, used_percent: null }, { ...USAGE, used_percent: '42' }, { ...USAGE, used_percent: 140 }, { ...USAGE, read_at: '2026-11-16T11:00:00Z' }]) {
    const r = ok({ usage });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'usage_unknown', JSON.stringify(usage));
  }
});

test('the guard refuses a reading older than the last dispatched card, or more than a day old', () => {
  const ledger = [{ card_id: 'earlier-card', card_sha256: 'a'.repeat(64), decision_id: 'dec-synthetic-0000', usage: USAGE, dispatched_at: '2026-11-16T09:45:00.000Z' }];
  const r = ok({ ledger });
  assert.equal(r.reason, 'usage_stale');
  assert.match(r.detail, /earlier-card/);
  assert.equal(ok({ ledger: [{ ...ledger[0], dispatched_at: USAGE.read_at }] }).reason, 'usage_stale', 'a reading taken at the moment of the last dispatch does not count it');
  assert.equal(ok({ ledger: [{ ...ledger[0], dispatched_at: '2026-11-16T09:00:00.000Z' }] }).ok, true);
  assert.equal(ok({ usage: { ...USAGE, read_at: '2026-11-15T09:59:00Z' } }).reason, 'usage_stale');
});

test('the guard refuses usage above 80%', () => {
  const r = ok({ usage: { ...USAGE, used_percent: 80.5 } });
  assert.equal(r.reason, 'usage_above_80');
  assert.equal(ok({ usage: { ...USAGE, used_percent: 100 } }).reason, 'usage_above_80');
});

test('the guard refuses a card with no yes, a yes on another digest, or a yes already used', () => {
  const none = ok({ approval: null });
  assert.equal(none.reason, 'no_approval');
  assert.ok(none.detail.includes(DIGEST), 'the refusal names the digest to ask his yes on');
  assert.equal(ok({ approval: { ...YES, payload_sha256: 'b'.repeat(64) } }).reason, 'approval_mismatch');
  const changed = clone(CARD); changed.limits.max_minutes = 25;
  assert.equal(guard({ card: changed, text: JSON.stringify(changed), usage: USAGE, approval: YES, ledger: [], now: NOW, cardPath: 'x' }).reason, 'approval_mismatch', 'a changed card needs a new yes');
  const ledger = [{ card_id: 'earlier-card', card_sha256: 'a'.repeat(64), decision_id: YES.decision_id, usage: USAGE, dispatched_at: '2026-11-16T09:00:00.000Z' }];
  assert.equal(ok({ ledger }).reason, 'approval_used');
  assert.deepEqual(parseApproval(`dec-synthetic-0001:${DIGEST}`), YES);
  for (const bad of [undefined, '', DIGEST, 'dec:short', `has space:${DIGEST}`]) assert.equal(parseApproval(bad), null);
});

test('the guard refuses a card over 6 KB or outside its rules before anything else', () => {
  assert.equal(ok({ text: TEXT + ' '.repeat(CARD_MAX) }).reason, 'card_too_large');
  const cases = [
    c => { c.never = c.never.filter(n => n !== 'network'); },
    c => { c.worktree.branch = 'codex/another-card'; },
    c => { c.worktree.dir = '../growth-mindmake'; },
    c => { c.model.name = 'default'; },
    c => { c.read = ['a', 'b', 'c', 'd', 'e', 'f']; },
    c => { c.write_allow = ['../outside/**']; },
    c => { c.write_allow = ['/etc/passwd']; },
    c => { c.acceptance = ['npm test; curl example.com']; },
    c => { c.acceptance = ['rm -rf /']; },
    c => { delete c.interface; },
    c => { c.returns.required = ['missing']; },
    c => { c.extra = true; }
  ];
  for (const change of cases) {
    const c = clone(CARD); change(c);
    const r = guard({ card: c, text: JSON.stringify(c), usage: USAGE, approval: { ...YES, payload_sha256: cardDigest(c) }, ledger: [], now: NOW, cardPath: 'x' });
    assert.equal(r.reason, 'card_invalid', change.toString());
  }
  assert.equal(guard({ card: null, text: 'null', usage: USAGE, approval: YES, now: NOW }).reason, 'card_invalid');
});

test('the command line refuses, then passes and records the dispatch in its ledger, then refuses the same yes again', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dispatch-'));
  const ledger = join(dir, 'ledger.json'), usageFile = join(dir, 'usage.json');
  await writeFile(usageFile, JSON.stringify(USAGE));
  const run = (...a) => spawnSync(process.execPath, [join(root, 'scripts/dispatch-card.mjs'), '--card', join(root, CARD_FILE), '--ledger', ledger, '--at', NOW, ...a], { encoding: 'utf8' });
  const noUsage = run('--approval', `${YES.decision_id}:${DIGEST}`);
  assert.equal(noUsage.status, 1);
  assert.match(noUsage.stderr, /REFUSED \(usage_unknown\)/);
  const noYes = run('--usage', usageFile);
  assert.equal(noYes.status, 1);
  assert.match(noYes.stderr, /REFUSED \(no_approval\)/);
  const pass = run('--usage', usageFile, '--approval', `${YES.decision_id}:${DIGEST}`, '--plugin', '/synthetic/codex');
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(pass.stdout, new RegExp(`--model ${CARD.model.name} --effort ${CARD.model.effort} `));
  assert.match(pass.stdout, /git worktree add -b codex\/example-week-label /);
  const recorded = JSON.parse(await readFile(ledger, 'utf8'));
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].card_sha256, DIGEST);
  // The same reading is now older than the last dispatch, so it is refused first.
  const again = run('--usage', usageFile, '--approval', `${YES.decision_id}:${DIGEST}`);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /REFUSED \(usage_stale\)/);
  const check = spawnSync(process.execPath, [join(root, 'scripts/dispatch-card.mjs'), '--card', join(root, CARD_FILE), '--check'], { encoding: 'utf8' });
  assert.equal(check.status, 0);
  assert.ok(check.stdout.includes(DIGEST));
  assert.equal(JSON.parse(await readFile(ledger, 'utf8')).length, 1, 'a refusal records nothing');
});

// ── verify-card ─────────────────────────────────────────────────────────────

test('write_allow globs: ** any depth, * inside one segment', () => {
  assert.ok(globRegex('src/crew/**').test('src/crew/lints/a.mjs'));
  assert.ok(globRegex('tests/*.test.mjs').test('tests/a.test.mjs'));
  assert.ok(!globRegex('tests/*.test.mjs').test('tests/sub/a.test.mjs'));
  assert.ok(!globRegex('src/a.mjs').test('src/a.mjsx'));
  assert.deepEqual(outside(['src/a.mjs', 'README.md'], ['src/**']), ['README.md']);
});

test('the seven repository checks are the ones AGENTS.md names', async () => {
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.equal(REPO_CHECKS.length, 7);
  assert.ok(agents.includes('Run npm run contracts, npm run check, npm test, npm run conveyor, npm run demo -- --summary, npm run demo:review and npm run demo:engine.'));
  assert.deepEqual([...REPO_CHECKS], ['npm run contracts', 'npm run check', 'npm test', 'npm run conveyor', 'npm run demo -- --summary', 'npm run demo:review', 'npm run demo:engine']);
});

const git = (cwd, ...a) => { const r = spawnSync('git', ['-c', 'user.email=synthetic@example.invalid', '-c', 'user.name=Synthetic', ...a], { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'verify-'));
  git(dir, 'init', '-q', '-b', 'main');
  await mkdir(join(dir, 'src/crew'), { recursive: true }); await mkdir(join(dir, 'tests'), { recursive: true });
  await writeFile(join(dir, 'README.md'), 'synthetic\n');
  await writeFile(join(dir, 'pass.mjs'), 'process.exit(0);\n');
  await writeFile(join(dir, 'fail.mjs'), 'process.exit(3);\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', `codex/${CARD.id}`);
  return dir;
}
const card = (over = {}) => ({ ...clone(CARD), acceptance: ['node pass.mjs'], ...over });
const CHECKS = ['node pass.mjs', 'node pass.mjs'];
const verify = (dir, c = card(), checks = CHECKS) => verifyCard({ card: c, text: JSON.stringify(c), worktree: dir, checks });

test('verify passes only when the diff stays inside write_allow and every acceptance command and check exits 0', async () => {
  const dir = await repo();
  await writeFile(join(dir, 'src/crew/week-label.mjs'), 'export const x = 1;\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'codex work');
  await writeFile(join(dir, 'tests/week-label.test.mjs'), '// untracked but allowed\n');
  const r = verify(dir);
  assert.equal(r.ok, true, JSON.stringify(r.steps));
  assert.deepEqual(r.steps.map(s => s.step), ['card', 'worktree', 'diff', 'acceptance', 'check', 'check']);
  assert.match(r.steps[2].detail, /2 files changed/);
  // A failing acceptance command or a failing repository check fails it.
  assert.equal(verify(dir, card({ acceptance: ['node fail.mjs'] })).ok, false);
  const failingCheck = verify(dir, card(), ['node pass.mjs', 'node fail.mjs']);
  assert.equal(failingCheck.ok, false);
  assert.equal(failingCheck.steps.at(-1).exit, 3);
});

test('verify fails on any file outside write_allow, committed, unstaged, untracked or moved out, and runs nothing', async () => {
  const dir = await repo();
  const ran = [];
  const spy = (line) => { ran.push(line); return { command: line, exit: 0, timed_out: false, tail: '' }; };
  await writeFile(join(dir, 'src/crew/week-label.mjs'), 'export const x = 1;\n');
  await writeFile(join(dir, 'README.md'), 'changed outside\n');
  let r = verifyCard({ card: card(), text: '{}', worktree: dir, checks: CHECKS, run: spy });
  assert.equal(r.ok, false);
  assert.match(r.steps.at(-1).detail, /outside write_allow: README\.md/);
  assert.deepEqual(ran, []);
  git(dir, 'checkout', '-q', '--', 'README.md');
  await writeFile(join(dir, 'new-file.txt'), 'untracked outside\n');
  r = verify(dir);
  assert.equal(r.ok, false);
  assert.match(r.steps.at(-1).detail, /new-file\.txt/);
  await rm(join(dir, 'new-file.txt'));
  git(dir, 'mv', 'pass.mjs', 'src/crew/week-label-moved.mjs');
  r = verify(dir, card({ write_allow: ['src/crew/**'] }));
  assert.equal(r.ok, false, 'moving a file out of bounds into bounds is still a change to the old path');
  assert.match(r.steps.at(-1).detail, /pass\.mjs/);
});

test('verify fails on the wrong branch, no change at all, or a card that is not valid', async () => {
  const dir = await repo();
  assert.match(verify(dir).steps.at(-1).detail, /Nothing changed against main/);
  git(dir, 'checkout', '-q', '-b', 'codex/some-other-card');
  await writeFile(join(dir, 'src/crew/week-label.mjs'), 'x\n');
  assert.match(verify(dir).steps.at(-1).detail, /not codex\/example-week-label/);
  const bad = card({ never: ['git'] });
  assert.equal(verify(dir, bad).steps[0].step, 'card');
  assert.equal(verify(dir, bad).ok, false);
  assert.match(verifyCard({ card: card(), text: 'x'.repeat(CARD_MAX + 1), worktree: dir, checks: CHECKS }).steps[0].detail, /6144 or fewer/);
  assert.match(verify(join(dir, 'missing')).steps.at(-1).detail, /not a git worktree/);
});

test('the verify command line exits 1 outside write_allow and never reads a Codex report', async () => {
  const dir = await repo();
  await writeFile(join(dir, 'README.md'), 'changed outside\n');
  const cardFile = join(dir, '..', `card-${Date.now()}.json`);
  await writeFile(cardFile, JSON.stringify(card()));
  const r = spawnSync(process.execPath, [join(root, 'scripts/verify-card.mjs'), '--card', cardFile, '--worktree', dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL diff: 1 changed file outside write_allow: README\.md/);
  const report = spawnSync(process.execPath, [join(root, 'scripts/verify-card.mjs'), '--card', cardFile, '--worktree', dir, '--report', 'codex.json'], { encoding: 'utf8' });
  assert.equal(report.status, 1);
  assert.match(report.stderr, /unknown argument --report/);
});
