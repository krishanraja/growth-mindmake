/**
 * Consult divergent-thinker at will, from any session in this repository, through
 * Control Center's `divergent` route on this engine's own bearer (the one the
 * daily dispatch uses). The automatic uses stay in src/stages/divergent.mjs; this
 * is the same route, asked when a session needs it.
 *
 *   npm run divergent -- <op> [options]
 *
 *   op           map | provoke | challenge | diverge | score | record
 *   --problem    the problem, in words (every op but record)
 *   --context    more context (map, provoke, challenge, diverge)
 *   --idea       the idea to attack (challenge)
 *   --ideas-file the ideas to score: a JSON list, or one a line (score)
 *   --obvious-file  what most teams would do, the same two shapes (score; free with it)
 *   --items-file the items to record, the same two shapes (record)
 *   --label      a label for what is recorded (record)
 *   --cliche     a move a spark must not repeat; repeat the flag for more (provoke, diverge)
 *   --count N    how many sparks (provoke, diverge)
 *   --target     what the sparks are for (provoke, diverge)
 *   --temperament  how wild (provoke, diverge)
 *   --lane NAME  the namespace growth-mindmake:<lane> instead of growth-mindmake
 *   --judge      ask the judge too (score; it costs a call)
 *
 * It prints Control Center's JSON. Exit 0 when answered; 1 when `score` flags any
 * idea; 2 when nothing was answered: no bearer here, not served, unreachable,
 * capped, uncalibrated, held for a generating op, refused or a malformed command,
 * with the reason on stderr. No retries. It writes nothing to his list, the
 * report or the repository: an answer is for the session to read, and a spark
 * becomes an ask only through the walls and the proposal path the dispatch owns.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineClient } from '../src/control-center.mjs';
import { NAMESPACE, bannedWords, divergentServed } from '../src/stages/divergent.mjs';

export const OPS = Object.freeze(['map', 'provoke', 'challenge', 'diverge', 'score', 'record']);
/** The ops that ask a model, refused while Control Center holds this engine. */
export const GENERATING = new Set(['map', 'provoke', 'challenge', 'diverge']);
/** What each op costs at Control Center, as its route states it. */
export const COST = Object.freeze({ score: 'free with --obvious-file', record: 'free', map: '1 call', provoke: '2 calls, about $0.15', challenge: '3 calls', diverge: 'about 25 calls, about $1.30, one a day' });
export const DEFAULT_URL = 'https://controlcenter.krishraja.com';
const LANE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const VALUED = new Set(['--problem', '--context', '--idea', '--ideas-file', '--obvious-file', '--items-file', '--label', '--cliche', '--count', '--target', '--temperament', '--lane']);
export const USAGE = `Usage: npm run divergent -- <${OPS.join('|')}> --problem TEXT [--context TEXT] [--idea TEXT] [--ideas-file PATH] [--obvious-file PATH] [--items-file PATH] [--label TEXT] [--cliche TEXT]... [--count N] [--target TEXT] [--temperament TEXT] [--lane NAME] [--judge]`;
export const NO_BEARER = "Divergent: not asked. This machine has no Control Center engine bearer (CONTROL_CENTER_ENGINE_TOKEN, the one the daily dispatch uses). From one of Krish's Claude sessions, the Control Center connector tools divergent_score, divergent_record and divergent_run with namespace growth-mindmake are the route instead.";

class Usage extends Error {}

/** The op and options from argv. Throws Usage on anything malformed. Pure. */
export function parseArgs(argv) {
  const [op, ...rest] = argv;
  if (!OPS.includes(op)) throw new Usage(`Divergent: unknown op ${op ? `"${op}"` : '(none)'}.`);
  const o = { cliches: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--judge') { o.judge = true; continue; }
    if (!VALUED.has(a)) throw new Usage(`Divergent: unknown option ${a}.`);
    const v = rest[++i];
    if (typeof v !== 'string' || v.startsWith('--')) throw new Usage(`Divergent: ${a} needs a value.`);
    if (a === '--cliche') o.cliches.push(v);
    else o[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  if (op !== 'record' && !o.problem?.trim()) throw new Usage(`Divergent: ${op} needs --problem.`);
  if (op === 'challenge' && !o.idea?.trim()) throw new Usage('Divergent: challenge needs --idea.');
  if (op === 'score' && !o.ideasFile) throw new Usage('Divergent: score needs --ideas-file.');
  if (op === 'record' && !o.itemsFile) throw new Usage('Divergent: record needs --items-file.');
  if (o.count !== undefined && !/^[1-9]\d?$/.test(o.count)) throw new Usage('Divergent: --count takes a whole number from 1 to 99.');
  if (o.lane !== undefined && !LANE.test(o.lane)) throw new Usage('Divergent: --lane takes lower-case letters, digits and hyphens.');
  return { op, o };
}

/** A file's list: a JSON array, or one entry a non-empty line. Pure. */
export function listOf(text) {
  const t = String(text ?? '').trim();
  if (t.startsWith('[')) { const v = JSON.parse(t); if (Array.isArray(v)) return v; }
  return t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

/** The namespace: growth-mindmake, or growth-mindmake:<lane>. Pure. */
export const namespaceOf = lane => (lane ? `${NAMESPACE}:${lane}` : NAMESPACE);

/** The body Control Center's divergent route is sent, with the files read by `read`. */
export async function bodyOf(op, o, read) {
  const namespace = namespaceOf(o.lane);
  const sparks = () => ({ ...(o.context ? { context: o.context } : {}), ...(o.count ? { count: Number(o.count) } : {}), ...(o.cliches.length ? { cliches: [...o.cliches] } : {}), bannedWords: bannedWords(), ...(o.target ? { target: o.target } : {}), ...(o.temperament ? { temperament: o.temperament } : {}) });
  switch (op) {
    case 'map': return { op, problem: o.problem, ...(o.context ? { context: o.context } : {}), namespace };
    case 'challenge': return { op, problem: o.problem, idea: o.idea, ...(o.context ? { context: o.context } : {}), namespace };
    case 'provoke': case 'diverge': return { op, problem: o.problem, ...sparks(), namespace };
    case 'score': return { op, problem: o.problem, ideas: listOf(await read(o.ideasFile)), ...(o.obviousFile ? { obvious: listOf(await read(o.obviousFile)) } : {}), ...(o.judge ? { judge: true } : {}), bannedWords: bannedWords(), namespace };
    case 'record': return { op, items: listOf(await read(o.itemsFile)), ...(o.label ? { label: o.label } : {}), namespace };
  }
  throw new Usage(`Divergent: unknown op "${op}".`);
}

/** How many scored ideas came back as anything but accepted. Pure. */
export const flaggedCount = value => (Array.isArray(value?.results) ? value.results.filter(r => typeof r?.status === 'string' && r.status !== 'accepted').length : 0);

/** A failed consult as one line, by status and code only: never a body, a URL or a credential. Pure. */
export function failureReason(e) {
  const code = typeof e?.code === 'string' ? e.code : null;
  const c = code ? ` (${code})` : '';
  if (e?.status === 429) return `Divergent: Control Center's daily cap was reached${c}.`;
  if (e?.status === 503) return `Divergent: not available or not calibrated${c}.`;
  if (e?.status === 409) return `Divergent: Control Center holds this engine${c}.`;
  if (e?.status === 403) return `Divergent: Control Center refused this engine${c}.`;
  if (e?.status === 400) return `Divergent: Control Center refused the request as malformed${c}.`;
  if (Number.isInteger(e?.status)) return `Divergent: Control Center answered ${e.status}${c}.`;
  return `Divergent: Control Center could not be reached or did not answer${c}.`;
}

/**
 * One consult. Returns the exit code; writes the answer to `out` and every reason to `err`.
 * `makeClient` and `read` are injectable so a test can stub Control Center and the files.
 */
export async function run(argv, { env = process.env, makeClient = engineClient, read = p => readFile(resolve(p), 'utf8'), out = s => process.stdout.write(s), err = s => process.stderr.write(s) } = {}) {
  let op, o, body;
  try { ({ op, o } = parseArgs(argv)); }
  catch (e) { if (!(e instanceof Usage)) throw e; err(`${e.message}\n${USAGE}\n`); return 2; }
  let cc;
  try { cc = makeClient(env.CONTROL_CENTER_URL || DEFAULT_URL, env.CONTROL_CENTER_ENGINE_TOKEN); }
  catch { err(`${NO_BEARER}\n`); return 2; }
  try { body = await bodyOf(op, o, read); }
  catch (e) { err(`Divergent: not asked, a file could not be read as a list (${e?.code ?? 'unreadable'}).\n`); return 2; }
  let capabilities;
  try { capabilities = await cc.capabilities(); }
  catch (e) { err(`${failureReason(e)} Its capabilities could not be read, so nothing was asked.\n`); return 2; }
  if (!divergentServed(capabilities)) { err('Divergent: not served. Control Center does not say features.divergent, so no call was made.\n'); return 2; }
  if (GENERATING.has(op) && ['held', 'paused'].includes(capabilities?.activation?.state)) { err(`Divergent: not asked. Control Center holds this engine, and ${op} asks a model.\n`); return 2; }
  let value;
  try { value = await cc.divergent(body); }
  catch (e) { err(`${failureReason(e)} Nothing is retried.\n`); return 2; }
  out(`${JSON.stringify(value, null, 2)}\n`);
  if (op === 'score') { const n = flaggedCount(value); if (n) { err(`Divergent: score flagged ${n} idea${n === 1 ? '' : 's'}.\n`); return 1; } }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await run(process.argv.slice(2));
