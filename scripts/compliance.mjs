/**
 * The cold compliance gate's own command (docs/GET-GOING.md 1.2;
 * src/stages/compliance.mjs).
 *
 *   npm run compliance -- status
 *     Reads the gate back and prints whether it is open, and every part still
 *     open by name. Counts and codes only.
 *
 *   npm run compliance -- import --file <export outside this repository>
 *   MINDMAKE_OPT_OUTS_FILE=<path> npm run compliance -- import
 *     Imports one old Instantly or Apollo opt-out export (a CSV, read by its
 *     email and domain or website columns, or a plain list of one address or
 *     host a line; src/stages/compliance.mjs parseOptOuts) into the ignored
 *     runtime/compliance/opt-outs.json, every address and domain kept only as
 *     its SHA-256. The file must sit outside this repository, which is
 *     public; a path inside it is refused. With no file there, it holds
 *     (opt_out_file_absent, exit 2) and writes nothing; a file that gives no
 *     address or host adds nothing (opt_outs_not_added). Run it once per
 *     export; the same file twice changes nothing.
 *
 * It never prints an address, a name or the file's path, and it sends
 * nothing anywhere. Filing the same lists as do-not-contact in Control
 * Center, so every lane honours them by status, is Control Center's step.
 */
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGate, addOptOuts, OPT_OUTS_PATH } from '../src/stages/compliance.mjs';

const root = process.env.COMPLIANCE_ROOT ? resolve(process.env.COMPLIANCE_ROOT) : fileURLToPath(new URL('../', import.meta.url));
const repo = fileURLToPath(new URL('../', import.meta.url));
const at = new Date().toISOString();
const say = v => console.log(JSON.stringify(v));

/** Whether a path is this repository or inside it (where a private export must never be). */
async function insideRepository(path) {
  let real = path;
  try { real = await realpath(path); } catch { /* not there: judged as given */ }
  const repoReal = await realpath(repo).catch(() => repo);
  const rel = relative(repoReal, real);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'status') {
    const gate = await readGate({ at, read: p => readFile(resolve(root, p), 'utf8') });
    say({ gate: gate.open ? 'open' : 'closed', holds: gate.holds, opt_outs: gate.opt_outs ? { files: gate.opt_outs.files, emails: gate.opt_outs.emails.size, domains: gate.opt_outs.domains.size } : null });
    return;
  }
  if (command !== 'import') { console.error('Usage: npm run compliance -- status | import --file <export outside this repository>'); process.exitCode = 1; return; }
  let file = process.env.MINDMAKE_OPT_OUTS_FILE || null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--file' && rest[i + 1]) file = rest[++i];
    else { console.error('Unknown argument. Usage: npm run compliance -- import --file <export outside this repository>'); process.exitCode = 1; return; }
  }
  if (!file || !existsSync(resolve(file))) {
    say({ hold: 'opt_out_file_absent', detail: 'No opt-out export was found at the path given, so nothing was imported and the gate stays closed on opt_outs_not_imported.' });
    process.exitCode = 2;
    return;
  }
  const path = resolve(file);
  if (await insideRepository(path)) {
    say({ hold: 'opt_out_file_inside_repository', detail: 'The export is inside this public repository; move it outside, then import it. Nothing was read.' });
    process.exitCode = 1;
    return;
  }
  const text = await readFile(path, 'utf8');
  const target = resolve(root, OPT_OUTS_PATH);
  let prior = null;
  if (existsSync(target)) {
    try { prior = JSON.parse(await readFile(target, 'utf8')); }
    catch { say({ hold: 'opt_outs_unreadable', detail: 'The opt-out record does not parse, so nothing was added to it.' }); process.exitCode = 1; return; }
  }
  let out;
  try { out = addOptOuts(prior, { text, at }); }
  catch (e) { say({ hold: 'opt_outs_not_added', detail: e.message }); process.exitCode = 1; return; }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(out.record)}\n`, { mode: 0o600 });
  say({ imported: out.counts });
}

main().catch(() => { console.error('The compliance command failed. Nothing private was printed.'); process.exitCode = 1; });
