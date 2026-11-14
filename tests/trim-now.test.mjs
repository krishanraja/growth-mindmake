import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { movable, logSection, trimNow, HEADROOM } from '../scripts/trim-now.mjs';
import { PACK_MAX } from '../scripts/pack.mjs';

// The fold job's guard (audit gm-1): NOW.md's oldest dated lines move to the
// history log word for word until the heaviest pack fits with headroom.
const root = fileURLToPath(new URL('../', import.meta.url));
const AT = '2026-11-14T12:00:00Z';

const NOW = [
  '# x', '## Where it is right now (as of 2026-11-13)', 'state line',
  '- standing line with no date',
  '- newer where line. (2026-11-13)',
  '- older where line. (2026-11-10)',
  '## What changed recently',
  '- 2026-11-12 newer change',
  '- 2026-11-09 oldest change',
  '- Older changes are in the log.',
  '## Next', '- 2026-11-01 not movable here'
].join('\n');

test('only dated lines in the two sections move, oldest first', () => {
  assert.deepEqual(movable(NOW).map(c => c.date), ['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13']);
});

test('the log gets a dated section above the older ones, newest first', () => {
  const log = '# History log\n\nIntro.\n\n## 2026-11-13: older\n\n- a\n';
  const out = logSection(log, ['- old', '- newer'], '2026-11-14');
  assert.match(out, /Intro\.\n\n## 2026-11-14: older NOW\.md lines\n\n[^\n]+\n\n- newer\n- old\n\n## 2026-11-13: older/);
  assert.equal(logSection(log, [], '2026-11-14'), log);
});

test('an over-budget NOW.md is trimmed to fit with headroom, every moved line kept word for word', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'trim-'));
  for (const p of ['AGENTS.md', 'NOW.md', 'docs', 'crew', 'specs', 'src', 'contracts', 'config']) await cp(join(root, p), join(dir, p), { recursive: true }).catch(() => {});
  const now = await readFile(join(dir, 'NOW.md'), 'utf8');
  const pad = Array.from({ length: 12 }, (_, k) => `- 2026-01-${String(k + 10).padStart(2, '0')} ${'padding '.repeat(60)}`).join('\n');
  const fat = now.replace(/(## What changed recently\n+)/, `$1${pad}\n`);
  await writeFile(join(dir, 'NOW.md'), fat);
  const { moved, total } = await trimNow({ root: dir, at: AT });
  assert.ok(moved.length > 0);
  assert.ok(total <= PACK_MAX - HEADROOM, `the pack is ${total}`);
  assert.ok(moved[0].startsWith('- 2026-01-10 '), 'the oldest goes first');
  const after = await readFile(join(dir, 'NOW.md'), 'utf8'), log = await readFile(join(dir, 'docs/history/LOG.md'), 'utf8');
  for (const l of moved) { assert.ok(!after.includes(l)); assert.ok(log.includes(l)); }
  const again = await trimNow({ root: dir, at: AT });
  assert.equal(again.moved.length, 0, 'a second run moves nothing');
});
