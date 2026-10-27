import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

// invariants/register.json: every past fix and open finding, with its guard
// or the reason it has none, and the phase that closes it (plan Phase 0).
const root = new URL('../', import.meta.url);
const register = JSON.parse(await readFile(new URL('invariants/register.json', root), 'utf8'));
const PHASE = /^(done|[0-9]|C[0-9]|krish-review)$/;
const SOURCE = /^(PR #\d+|[0-9a-f]{7})(, (PR #\d+|[0-9a-f]{7}))*$/;
const PR = /^PR #\d+$/;

// The names of the tests a file declares, unescaped, so a guard must quote a
// test's own name and not an assertion message or a comment.
const names = new Map();
async function testNames(file) {
  if (!names.has(file)) {
    const text = await readFile(new URL(file, root), 'utf8');
    const found = [];
    for (const m of text.matchAll(/\btest\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) found.push(m[2].replace(/\\(.)/g, '$1'));
    names.set(file, found);
  }
  return names.get(file);
}

test('the register is version 1, dated, and says how it was compiled', () => {
  assert.equal(register.version, 1);
  assert.match(register.as_of, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(typeof register.note === 'string' && register.note.length > 40);
  assert.ok(Array.isArray(register.fixes) && register.fixes.length > 0);
  assert.ok(Array.isArray(register.findings));
});

test('every fix id is unique and well formed, with a sentence, a source and a phase', () => {
  const seen = new Set();
  for (const f of register.fixes) {
    assert.match(f.id, /^F\d{2}$/, f.id);
    assert.ok(!seen.has(f.id), `duplicate ${f.id}`);
    seen.add(f.id);
    assert.ok(typeof f.what === 'string' && f.what.length > 10, f.id);
    assert.match(f.source, SOURCE, f.id);
    assert.match(f.phase, PHASE, f.id);
  }
  const numbers = register.fixes.map(f => Number(f.id.slice(1)));
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1), 'fixes run F01 upwards with no gap');
});

test('a fix guarded by a test names a file in tests/ that declares a test with that name', async () => {
  for (const f of register.fixes) {
    const g = f.guard;
    assert.ok(['test', 'partial', 'none', 'accepted'].includes(g?.kind), f.id);
    if (g.kind !== 'test' && g.kind !== 'partial') continue;
    const m = /^(tests\/(?:regression\/)?[a-z0-9-]+\.test\.mjs): (.+)$/.exec(g.where ?? '');
    assert.ok(m, `${f.id}: where is "tests/<file>.test.mjs: <test name>" (or tests/regression/)`);
    await access(new URL(m[1], root));
    const declared = await testNames(m[1]);
    assert.ok(declared.some(n => n.includes(m[2])), `${f.id}: no test in ${m[1]} is named with "${m[2]}"`);
    if (g.kind === 'test') assert.equal(g.reason, null, `${f.id}: a full guard needs no reason`);
    else assert.ok(typeof g.reason === 'string' && g.reason.length > 10, `${f.id}: a partial guard says what is missing`);
  }
});

test('a fix with no guard, or an accepted one, says why, and only a guarded fix is done', () => {
  for (const f of register.fixes) {
    if (f.guard.kind === 'none' || f.guard.kind === 'accepted') {
      assert.equal(f.guard.where, null, f.id);
      assert.ok(typeof f.guard.reason === 'string' && f.guard.reason.length > 10, `${f.id}: a reason`);
    }
    if (f.guard.kind !== 'test' && f.guard.kind !== 'accepted') assert.notEqual(f.phase, 'done', `${f.id}: unguarded work has a phase`);
  }
});

test('every finding from N01 on is present exactly once, numbered without gaps, and a closed one names what closed it', () => {
  const ids = register.findings.map(n => n.id);
  assert.ok(ids.length >= 19, 'the plan names N01 to N19');
  assert.deepEqual([...ids].sort(), Array.from({ length: ids.length }, (_, i) => `N${String(i + 1).padStart(2, '0')}`));
  for (const n of register.findings) {
    assert.ok(typeof n.what === 'string' && n.what.length > 10, n.id);
    assert.match(n.phase, PHASE, n.id);
    assert.ok(['open', 'closed'].includes(n.state), n.id);
    if (n.state === 'closed') {
      assert.match(n.closed_by ?? '', PR, `${n.id}: closed_by`);
      assert.equal(n.phase, 'done', n.id);
    } else {
      assert.equal(n.closed_by, null, n.id);
      assert.notEqual(n.phase, 'done', n.id);
    }
    if ('partly_closed_by' in n) {
      assert.equal(n.state, 'open', `${n.id}: partly closed is still open`);
      assert.match(n.partly_closed_by, PR, n.id);
    }
  }
});
