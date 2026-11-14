// Keep the session pack inside its 36 KB budget after a closeout fold.
//
// ci.yml's fold job appends each closeout note to NOW.md on every push to main,
// and a fold push starts no CI run, so NOW.md can grow past the pack budget
// unseen and fail the next pull request (audit gm-1, 14 November 2026). This
// moves NOW.md's oldest dated lines to docs/history/LOG.md word for word,
// oldest first, until the heaviest pack a session can ask for (the three
// largest cards) fits with HEADROOM bytes to spare. Undated lines are the
// engine's standing state and never move. Nothing is summarised or dropped.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack, PACK_MAX, MAX_CARDS } from './pack.mjs';

export const HEADROOM = 1024;
const LOG = 'docs/history/LOG.md';
const bytes = s => Buffer.byteLength(s, 'utf8');

// The movable lines: "What changed recently" bullets that start with a date,
// and "Where it is right now" bullets that end with one in brackets.
export function movable(now) {
  const lines = now.split('\n');
  let section = '';
  const out = [];
  lines.forEach((l, i) => {
    if (l.startsWith('## ')) { section = l; return; }
    if (!l.startsWith('- ')) return;
    let m;
    if (section.startsWith('## What changed recently') && (m = l.match(/^- (\d{4}-\d{2}-\d{2}) /))) out.push({ i, date: m[1], line: l });
    else if (section.startsWith('## Where it is right now') && (m = l.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/))) out.push({ i, date: m[1], line: l });
  });
  // Oldest first; on the same date the lower line goes first (both sections list newest at the top).
  return out.sort((a, b) => a.date.localeCompare(b.date) || b.i - a.i);
}

export function logSection(log, moved, today) {
  if (!moved.length) return log;
  const head = `## ${today}: older NOW.md lines\n\nMoved here word for word from NOW.md by scripts/trim-now.mjs on ${today}, to keep the session pack under 36 KB; newest first.\n\n${[...moved].reverse().join('\n')}\n\n`;
  const at = log.indexOf('\n## ');
  return at < 0 ? `${log.trimEnd()}\n\n${head}` : `${log.slice(0, at + 1)}${head}${log.slice(at + 1)}`;
}

async function heaviest(root) {
  const index = JSON.parse(await readFile(resolve(root, 'crew/index.json'), 'utf8'));
  const sized = await Promise.all(index.specialists.map(async s => [s.slug, bytes(await readFile(resolve(root, `crew/${s.slug}/card.md`), 'utf8'))]));
  return sized.sort((a, b) => b[1] - a[1]).slice(0, MAX_CARDS).map(([s]) => s);
}

export async function trimNow({ root, at = new Date().toISOString(), headroom = HEADROOM }) {
  const cards = await heaviest(root);
  const nowPath = resolve(root, 'NOW.md'), logPath = resolve(root, LOG);
  const original = await readFile(nowPath, 'utf8');
  const limit = PACK_MAX - headroom;
  const size = async () => (await buildPack({ root, cards, at })).total;
  let total = await size();
  if (total <= limit) return { moved: [], total };
  const candidates = movable(original);
  const gone = new Set();
  const moved = [];
  let now = original;
  for (const c of candidates) {
    if (total <= limit) break;
    gone.add(c.i); moved.push(c.line);
    now = original.split('\n').filter((_, i) => !gone.has(i)).join('\n');
    await writeFile(nowPath, now);
    total = await size();
  }
  if (total > PACK_MAX) { await writeFile(nowPath, original); throw new Error(`NOW.md has no dated line left to move and the pack is still ${total - PACK_MAX} bytes over 36 KB.`); }
  await writeFile(logPath, logSection(await readFile(logPath, 'utf8'), moved, at.slice(0, 10)));
  return { moved, total };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.PACK_ROOT ? resolve(process.env.PACK_ROOT) : fileURLToPath(new URL('../', import.meta.url));
  try {
    const { moved, total } = await trimNow({ root });
    console.log(moved.length ? `Moved ${moved.length} dated NOW.md line(s) to ${LOG}; the heaviest pack is ${total} bytes of ${PACK_MAX}.` : `The heaviest pack is ${total} bytes of ${PACK_MAX}; nothing to move.`);
  } catch (e) { console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
