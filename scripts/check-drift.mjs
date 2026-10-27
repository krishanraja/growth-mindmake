/**
 * The docs drift check (N08; plan section 4, "Claims in docs"): status is
 * evidenced, never asserted.
 *
 *   - every path NOW.md's front matter names exists;
 *   - NOW.md's head is a commit on this branch and not far behind it (only
 *     where git holds the history; a shallow checkout says NOT CHECKED);
 *   - the copied protocol's header names the newest version it documents.
 *
 * The crew's cards and the library's taxonomy have their own drift checks
 * (scripts/check-crew.mjs, scripts/check-library.mjs).
 *
 *   node scripts/check-drift.mjs
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** How many commits NOW.md's head may trail this branch: a pull request's own commits and its merge. */
export const HEAD_LAG_MAX = 15;

/** NOW.md's front matter as keys and values. Pure. */
export function frontMatter(markdown) {
  const m = /^---\n([\s\S]*?)\n---/.exec(String(markdown));
  if (!m) return null;
  return Object.fromEntries(m[1].split('\n').map(l => /^([a-z_]+):\s*(.*)$/.exec(l)).filter(Boolean).map(x => [x[1], x[2].trim()]));
}
/** The repository paths the front matter names: single paths and bracketed lists. Pure. */
export function namedPaths(fm) {
  const out = [];
  for (const k of ['state_doc', 'history_log', 'truth_files', 'authority_order']) {
    const v = fm?.[k];
    if (!v) continue;
    for (const p of v.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean)) out.push(p);
  }
  return out;
}
/** The protocol header's version against the newest version the document names. Pure. */
export function protocolDrift(markdown) {
  const header = /^# .*?version (\d+\.\d+\.\d+)/m.exec(String(markdown))?.[1] ?? null;
  const versions = [...String(markdown).matchAll(/\b1\.(\d+)\.(\d+)\b/g)].map(m => [Number(m[1]), Number(m[2])]);
  const top = versions.sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
  const newest = top ? `1.${top[0]}.${top[1]}` : null;
  return header === newest ? null : `the header says ${header ?? 'no version'} but the document reaches ${newest}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const failures = [], notes = [];
  const fm = frontMatter(await readFile(resolve(root, 'NOW.md'), 'utf8'));
  if (!fm) failures.push('NOW.md has no front matter');
  for (const p of namedPaths(fm)) if (!existsSync(resolve(root, p))) failures.push(`NOW.md names ${p}, which does not exist`);
  const head = fm?.head ?? '';
  if (!/^[0-9a-f]{7,40}$/.test(head)) failures.push('NOW.md head is not a commit id');
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  const shallow = git('rev-parse', '--is-shallow-repository');
  if (shallow.status !== 0 || shallow.stdout.trim() !== 'false') notes.push('NOW.md head: NOT CHECKED (no full git history here)');
  else if (/^[0-9a-f]{7,40}$/.test(head)) {
    if (git('merge-base', '--is-ancestor', head, 'HEAD').status !== 0) failures.push(`NOW.md head ${head} is not a commit on this branch`);
    else { const lag = Number(git('rev-list', '--count', `${head}..HEAD`).stdout.trim()); if (lag > HEAD_LAG_MAX) failures.push(`NOW.md head ${head} is ${lag} commits behind; at most ${HEAD_LAG_MAX}`); }
  }
  const protocol = protocolDrift(await readFile(resolve(root, 'docs/control-center/ENGINE-PROTOCOL.md'), 'utf8'));
  if (protocol) failures.push(`docs/control-center/ENGINE-PROTOCOL.md: ${protocol}`);
  for (const n of notes) console.log(n);
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('PASS: NOW.md names only files that exist, its head is on this branch, and the protocol header names its newest version');
}
