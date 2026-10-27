/**
 * Verify a Codex task card's work outside the sandbox (plan Phase 4; docs/briefs/2026-10-27-bulletproof-growth-engine.md, section 6).
 *
 * Given a card and the worktree Codex worked in, it:
 *   1. checks the card again (scripts/dispatch-card.mjs) and that the worktree is on codex/<id>;
 *   2. lists every changed file against main (`git diff --name-only main`, plus untracked files)
 *      and fails on any file outside the card's write_allow, or on no change at all;
 *   3. re-runs the card's acceptance commands, then the seven repository checks, in the worktree.
 *
 * Exit 0 only when every step passes. Codex's own report is never read: this
 * command takes no report, and its verdict rests only on what it re-runs here.
 * Commands run without a shell (on Windows through one, for npm), split on
 * spaces; the card schema allows no shell character in them.
 *
 *   node scripts/verify-card.mjs --card <file> --worktree <dir> [--base main]
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cardErrors, CARD_MAX } from './dispatch-card.mjs';

/** The seven repository checks (AGENTS.md, "Checks and delivery"), in its order. */
export const REPO_CHECKS = Object.freeze(['npm run contracts', 'npm run check', 'npm test', 'npm run conveyor', 'npm run demo -- --summary', 'npm run demo:review', 'npm run demo:engine']);
const CHECK_TIMEOUT_MS = 10 * 60 * 1000;

/** A write_allow glob as a regular expression: `**` any depth, `*` and `?` inside one segment. Pure. */
export function globRegex(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; out += '(?:.*/)?'; } else out += '.*'; }
    else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${out}$`);
}
/** The changed files no write_allow glob covers. Pure. */
export const outside = (files, globs) => files.filter(f => !globs.some(g => globRegex(g).test(f)));

/** Run one command line in `cwd`, no shell but on Windows. */
export function runLine(line, cwd, timeoutMs) {
  const [cmd, ...rest] = line.split(' ').filter(Boolean);
  const r = spawnSync(cmd, rest, { cwd, encoding: 'utf8', timeout: timeoutMs, shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  return { command: line, exit: r.status ?? 1, timed_out: r.error?.code === 'ETIMEDOUT', tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-5).join('\n') };
}

const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });

/** Every changed path in the worktree against `base`, tracked and untracked. */
export function changedFiles(worktree, base) {
  // --no-renames lists both sides of a move, so a file moved out of bounds is caught.
  const diff = git(worktree, 'diff', '--name-only', '--no-renames', base, '--');
  if (diff.status !== 0) return { error: `git diff against ${base} failed: ${diff.stderr.trim().split('\n')[0]}` };
  const untracked = git(worktree, 'ls-files', '--others', '--exclude-standard');
  if (untracked.status !== 0) return { error: 'git could not list untracked files' };
  const files = [...new Set([...diff.stdout.split('\n'), ...untracked.stdout.split('\n')].map(s => s.trim()).filter(Boolean))].sort();
  return { files };
}

/**
 * The verification. `checks` is the seven repository checks; a test may pass
 * smaller ones, the command line never can. Returns every step's result and
 * `ok` only when all pass.
 */
export function verifyCard({ card, text, worktree, base = 'main', checks = REPO_CHECKS, run = runLine }) {
  const steps = [];
  const stop = (step, detail) => { steps.push({ step, ok: false, detail }); return { ok: false, steps }; };
  const size = Buffer.byteLength(String(text ?? ''), 'utf8');
  const errors = size > CARD_MAX ? [`${size} bytes; a card is ${CARD_MAX} or fewer`] : card && typeof card === 'object' ? cardErrors(card, text) : ['the card is not a JSON object'];
  if (errors.length) return stop('card', errors.slice(0, 5).join('; '));
  steps.push({ step: 'card', ok: true });
  if (!existsSync(worktree) || git(worktree, 'rev-parse', '--is-inside-work-tree').stdout.trim() !== 'true') return stop('worktree', `${worktree} is not a git worktree.`);
  const branch = git(worktree, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
  if (branch !== card.worktree.branch) return stop('worktree', `The worktree is on ${branch || 'no branch'}, not ${card.worktree.branch}.`);
  steps.push({ step: 'worktree', ok: true, detail: branch });
  const changed = changedFiles(worktree, base);
  if (changed.error) return stop('diff', changed.error);
  if (!changed.files.length) return stop('diff', `Nothing changed against ${base}.`);
  const out = outside(changed.files, card.write_allow);
  if (out.length) return stop('diff', `${out.length} changed file${out.length === 1 ? '' : 's'} outside write_allow: ${out.slice(0, 10).join(', ')}.`);
  steps.push({ step: 'diff', ok: true, detail: `${changed.files.length} file${changed.files.length === 1 ? '' : 's'} changed, all inside write_allow` });
  const limit = card.limits.max_minutes * 60 * 1000;
  for (const line of card.acceptance) { const r = run(line, worktree, limit); steps.push({ step: 'acceptance', ok: r.exit === 0 && !r.timed_out, ...r }); }
  for (const line of checks) { const r = run(line, worktree, CHECK_TIMEOUT_MS); steps.push({ step: 'check', ok: r.exit === 0 && !r.timed_out, ...r }); }
  return { ok: steps.every(s => s.ok), steps };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) { if (!['--card', '--worktree', '--base'].includes(argv[i])) { console.error(`FAIL: unknown argument ${argv[i]}`); process.exit(1); } a[argv[i].slice(2)] = argv[++i]; }
  if (!a.card || !a.worktree) { console.error('FAIL: name the card and the worktree: --card <file> --worktree <dir>'); process.exit(1); }
  const text = await readFile(resolve(a.card), 'utf8');
  let card = null; try { card = JSON.parse(text); } catch { card = null; }
  const r = verifyCard({ card, text, worktree: resolve(a.worktree), base: a.base ?? 'main' });
  for (const s of r.steps) console.log(`${s.ok ? 'PASS' : 'FAIL'} ${s.step}${s.command ? `: ${s.command} (exit ${s.exit}${s.timed_out ? ', timed out' : ''})` : ''}${s.detail ? `: ${s.detail}` : ''}${!s.ok && s.tail ? `\n${s.tail.replace(/^/gm, '    ')}` : ''}`);
  console.log(r.ok ? `PASS: card ${card.id} verified outside the sandbox; Codex's own report was not read.` : `FAIL: card ${card?.id ?? '(unreadable)'} is not verified.`);
  if (!r.ok) process.exitCode = 1;
}
