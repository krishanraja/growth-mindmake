/**
 * The Reader Check, run from a Claude session (Ruling, Krish, 2026-11-10;
 * src/crew/reader.mjs; docs/playbooks/07-scorecard-and-experiments.md,
 * "The reader check").
 *
 *   npm run reader -- brief --report <file> [--n 10]   one brief per draft, in runtime/reader/briefs/, listed in waves of 10
 *   npm run reader -- check                             which readers have not answered, or answered out of shape
 *   npm run reader -- save <proposal_id> < answer.json  file a reader's own reply when it printed instead of writing; refuses a bad one
 *   npm run reader -- tally                             counts and codes for the run, its shadow lint findings, and the ledger entries
 *   npm run reader -- calibrate --context <file> [--at <iso>]   the ledger's predictions against what happened
 *
 * For each wave the session sends one sub-agent per brief, in one message,
 * with only: "Read <brief path> and follow it exactly. It is your whole
 * brief." A sub-agent is the fresh reader; the session that wrote or ran the
 * drafts never answers for one. Everything stays under ignored runtime/reader/:
 * briefs and answers hold words and are private; the ledger holds keys and
 * verdicts only. Nothing here sends, holds, proposes or reports to Control
 * Center, and nothing it prints is a word of a draft or a card.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { selectDrafts, briefFor, briefSha, validAnswer, tally, tallyLine, ledgerEntry, mergeLedger, calibrate, calibrationLine, DEFAULT_PER_RUN } from '../src/crew/reader.mjs';
import * as readerLint from '../src/crew/lints/reader.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = resolve(root, process.env.READER_DIR ?? 'runtime/reader');
const RUN = resolve(dir, 'run.json');
const LEDGER = resolve(dir, 'ledger.json');
const WAVE = 10;

const args = process.argv.slice(2);
const cmd = args[0];
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (fallback !== undefined && e.code === 'ENOENT') return fallback; throw e; } };
const fileName = (i, ext) => `${String(i + 1).padStart(2, '0')}.${ext}`;
const fail = msg => { console.error(msg); process.exit(1); };

/** A report's proposals, whether the file holds the report or a run's output around it. */
const proposalsOf = r => (Array.isArray(r?.proposals) ? r.proposals : Array.isArray(r?.report?.proposals) ? r.report.proposals : null);

async function loadRun() {
  const run = await readJson(RUN, null);
  if (!run) fail('No reader run here: run `npm run reader -- brief --report <file>` first.');
  return run;
}
async function answersOf(run) {
  const got = new Map(), bad = [];
  for (const [i, item] of run.items.entries()) {
    let raw;
    try { raw = await readFile(resolve(dir, 'answers', fileName(i, 'json')), 'utf8'); } catch { continue; }
    const v = validAnswer(raw, item.proposal_id);
    if (v.ok) got.set(item.proposal_id, v.answer); else bad.push({ i, reason: v.reason });
  }
  return { got, bad };
}
function waves(run, only = null) {
  const list = run.items.map((item, i) => ({ i, path: resolve(dir, 'briefs', fileName(i, 'md')) })).filter(x => !only || only.has(x.i));
  for (let w = 0; w < list.length; w += WAVE) console.log(`Wave ${w / WAVE + 1}:\n${list.slice(w, w + WAVE).map(x => `  reader ${x.i + 1}: ${x.path}`).join('\n')}`);
  console.log(`For each wave, send one sub-agent per brief in one message: "Read <brief path> and follow it exactly. It is your whole brief." Never answer for a reader.`);
}

if (cmd === 'brief') {
  const file = flag('--report');
  if (!file) fail('brief needs --report <file>');
  const proposals = proposalsOf(await readJson(resolve(file)));
  if (!proposals) fail('The file holds no proposals: pass a dispatch report.');
  const n = Number.parseInt(flag('--n') ?? `${DEFAULT_PER_RUN}`, 10);
  const items = selectDrafts(proposals, n);
  if (!items.length) fail('No draft in this report has words and a card that says who its reader is: nothing to read.');
  // A new run replaces the last run's briefs and answers; the ledger is kept.
  for (const d of ['briefs', 'answers']) await rm(resolve(dir, d), { recursive: true, force: true });
  await mkdir(resolve(dir, 'briefs'), { recursive: true });
  await mkdir(resolve(dir, 'answers'), { recursive: true });
  const at = flag('--at') ?? new Date().toISOString();
  for (const [i, item] of items.entries()) await writeFile(resolve(dir, 'briefs', fileName(i, 'md')), briefFor(item, resolve(dir, 'answers', fileName(i, 'json'))));
  await writeFile(RUN, JSON.stringify({ at, items: items.map(item => ({ ...item, brief_sha: briefSha(item) })) }, null, 2));
  console.log(`Wrote ${items.length} reader brief${items.length === 1 ? '' : 's'} (${items.length} sub-agent call${items.length === 1 ? '' : 's'}).`);
  waves({ items });
} else if (cmd === 'check') {
  const run = await loadRun();
  const { got, bad } = await answersOf(run);
  const missing = run.items.map((x, i) => i).filter(i => !got.has(run.items[i].proposal_id));
  console.log(`${got.size} of ${run.items.length} readers answered in shape.${bad.length ? ` Out of shape: ${bad.map(b => `reader ${b.i + 1} (${b.reason})`).join(', ')}.` : ''}`);
  if (missing.length) { console.log('Run these once more:'); waves(run, new Set(missing)); }
} else if (cmd === 'save') {
  const run = await loadRun();
  const id = args[1];
  const i = run.items.findIndex(x => x.proposal_id === id);
  if (i < 0) fail('No reader in this run has that proposal id.');
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  const v = validAnswer(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1), id);
  if (!v.ok) fail(`Refused: the reader's reply is not a valid answer (${v.reason}).`);
  await writeFile(resolve(dir, 'answers', fileName(i, 'json')), JSON.stringify(v.answer, null, 2));
  console.log(`Saved reader ${i + 1}.`);
} else if (cmd === 'tally') {
  const run = await loadRun();
  const { got } = await answersOf(run);
  const t = tally(run.items, got);
  const findings = new Map();
  for (const item of run.items) for (const f of readerLint.lint({ proposal_id: item.proposal_id }, { reader: got })) findings.set(f.lint, (findings.get(f.lint) ?? 0) + 1);
  const entries = run.items.filter(x => got.has(x.proposal_id)).map(x => ledgerEntry(x, got.get(x.proposal_id), run.at));
  const ledger = mergeLedger(await readJson(LEDGER, []), entries);
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2));
  await writeFile(resolve(dir, 'results.json'), JSON.stringify({ at: run.at, tally: t, findings: Object.fromEntries(findings) }, null, 2));
  console.log(tallyLine(t));
  console.log(`Reader lints, in shadow: ${findings.size ? [...findings].map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}. Nothing is held by them.`);
  console.log(`Ledger: ${ledger.length} prediction${ledger.length === 1 ? '' : 's'} kept, keys and verdicts only, in this machine's ignored ${LEDGER.slice(root.length)}.`);
} else if (cmd === 'calibrate') {
  const file = flag('--context');
  if (!file) fail('calibrate needs --context <file>');
  const context = await readJson(resolve(file));
  const ledger = await readJson(LEDGER, []);
  console.log(calibrationLine(calibrate(ledger, context?.context ?? context, flag('--at') ?? new Date().toISOString())));
} else {
  fail('Usage: npm run reader -- brief --report <file> [--n 10] | check | save <proposal_id> | tally | calibrate --context <file> [--at <iso>]');
}
