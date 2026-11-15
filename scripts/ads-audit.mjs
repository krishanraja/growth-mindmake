/**
 * The paid-accounts audit, run by hand on Krish's own machine on an export
 * file he chooses (src/ads/ingest.mjs, src/ads/audit.mjs). Read only: it
 * contacts no ad platform, changes nothing and spends nothing. It writes the
 * report as JSON and Markdown under runtime/ads/ only, which git ignores, and
 * prints counts and the paths, never a figure or a campaign name, so nothing
 * private reaches a terminal log. It is never run by the daily dispatch or CI.
 *
 *   npm run ads-audit -- --export <file.json|file.csv> [--at <ISO time>] [--out runtime/ads]
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep, basename } from 'node:path';
import { readExport, isExportError, LIMITS } from '../src/ads/ingest.mjs';
import { auditAccounts, renderMarkdown } from '../src/ads/audit.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const RUNTIME = resolve(root, 'runtime');

/** The options, or an error line. Pure. */
export function parseArgs(argv) {
  const o = { export: null, at: null, out: 'runtime/ads' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (!['--export', '--at', '--out'].includes(k) || v === undefined || v.startsWith('--')) return { error: `unknown or empty option ${k}` };
    o[k.slice(2)] = v; i++;
  }
  if (!o.export) return { error: 'name the file with --export' };
  if (o.at !== null && Number.isNaN(Date.parse(o.at))) return { error: '--at is not a time' };
  return o;
}

/** True only for a folder inside runtime/, which git ignores. Pure. */
export function insideRuntime(dir) {
  const d = resolve(root, dir);
  return d === RUNTIME || d.startsWith(RUNTIME + sep);
}

export async function main(argv, { now = () => new Date().toISOString(), log = console.log, err = console.error } = {}) {
  const o = parseArgs(argv);
  if (o.error) { err(`ads-audit: ${o.error}`); return 2; }
  if (!insideRuntime(o.out)) { err('ads-audit: --out must be inside runtime/, which git ignores, so an account never reaches the repository'); return 2; }
  const file = resolve(process.cwd(), o.export);
  let body;
  try {
    if ((await stat(file)).size > LIMITS.bytes) { err(`ads-audit: the file is larger than ${LIMITS.bytes} bytes`); return 2; }
    body = await readFile(file, 'utf8');
  } catch { err('ads-audit: the file could not be read'); return 2; }
  let accounts;
  try { accounts = readExport(body, basename(file)); } catch (e) {
    if (isExportError(e)) { err(`ads-audit: the export was refused whole, nothing audited: ${e.message}`); return 2; }
    throw e;
  }
  const at = o.at ? new Date(o.at).toISOString() : now();
  const report = auditAccounts(accounts, { at });
  const dir = resolve(root, o.out);
  await mkdir(dir, { recursive: true });
  const stamp = at.replace(/[:.]/g, '-');
  const json = resolve(dir, `audit-${stamp}.json`), md = resolve(dir, `audit-${stamp}.md`);
  await writeFile(json, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(md, renderMarkdown(report));
  log(JSON.stringify({ read_only: true, platforms_contacted: 0, changes_made: 0, accounts: report.accounts.length, findings: report.counts, drafts: report.recommendations.length, written: [relative(root, json), relative(root, md)] }));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
