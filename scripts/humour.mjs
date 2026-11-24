/**
 * The humour guard, at will, from any session in this repository: does this
 * Mindmake copy read as a joke? Humour on Mindmake is "Never", so a reading
 * that finds one flags it. Through Control Center's humour route on this
 * engine's own bearer (src/lib/humour.mjs).
 *
 *   npm run humour -- --file PATH [--surface pitch|opener|post|line]
 *
 * The file holds the lines to read, one a line. It prints counts and codes,
 * never the words. Exit 0 pass, 1 flagged, 2 unavailable (no bearer, not
 * served, capped, refused or no reading): 2 is never a pass. It writes nothing
 * to his list, the report or the repository, and sends nothing.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineClient } from '../src/control-center.mjs';
import { EXIT, SURFACES, guard } from '../src/lib/humour.mjs';

export const DEFAULT_URL = 'https://controlcenter.krishraja.com';
export const USAGE = `Usage: npm run humour -- --file PATH [--surface ${Object.keys(SURFACES).join('|')}]`;

/** The options from argv, or null when malformed. Pure. */
export function parseArgs(argv) {
  const o = { surface: 'line' };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    if (argv[i] === '--file' && v) { o.file = v; i++; }
    else if (argv[i] === '--surface' && Object.hasOwn(SURFACES, v ?? '')) { o.surface = v; i++; }
    else return null;
  }
  return o.file ? o : null;
}

export async function run(argv, { env = process.env, makeClient = engineClient, read = p => readFile(resolve(p), 'utf8'), out = s => process.stdout.write(s), err = s => process.stderr.write(s) } = {}) {
  const o = parseArgs(argv);
  if (!o) { err(`${USAGE}\n`); return EXIT.unavailable; }
  let lines;
  try { lines = String(await read(o.file)).split(/\r?\n/); }
  catch (e) { err(`Humour: not read, the file could not be read (${e?.code ?? 'unreadable'}).\n`); return EXIT.unavailable; }
  let cc;
  try { cc = makeClient(env.CONTROL_CENTER_URL || DEFAULT_URL, env.CONTROL_CENTER_ENGINE_TOKEN); }
  catch { err('Humour: not read. This machine has no Control Center engine bearer (CONTROL_CENTER_ENGINE_TOKEN).\n'); return EXIT.unavailable; }
  let capabilities;
  try { capabilities = await cc.capabilities(); }
  catch { err('Humour: Control Center\'s capabilities could not be read, so nothing was asked.\n'); return EXIT.unavailable; }
  const result = await guard(lines, { cc, surface: o.surface, capabilities });
  out(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'unavailable') err(`Humour: unavailable, ${result.reason}. Unavailable is never a pass.\n`);
  return EXIT[result.status];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await run(process.argv.slice(2));
