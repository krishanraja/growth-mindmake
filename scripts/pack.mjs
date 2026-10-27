/**
 * The session pack (plan Phase 4; docs/briefs/2026-10-27-bulletproof-growth-engine.md, section 5).
 *
 * One file a session reads first, holding every mandatory load, including the
 * ones loaded anyway: AGENTS.md, NOW.md, docs/NORTH_STAR.md, the week spec in
 * force (or the default spec from src/crew/compile.mjs), the cards of up to
 * three specialists in play, open lint findings and holds as counts and codes
 * only, and gate status. It is 36 KB or less, or the command fails.
 *
 *   npm run pack
 *   npm run pack -- --cards visibility-producer,stages-producer --report runtime/report.json
 *   npm run pack -- --spec specs/weeks/2026-11-09.json --at 2026-11-10T07:00:00Z
 *
 * It writes runtime/pack.md (git-ignored) and prints its bytes and each part's.
 * It reads only files in this repository and a report file passed in; it calls
 * nothing and stores nothing else. A report's detail sentences never reach the
 * pack: only codes and counts.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { defaultSpec, FIRST_SPEC_WEEK } from '../src/crew/compile.mjs';

/** The limit: 36 KB, counted in bytes of UTF-8. */
export const PACK_MAX = 36 * 1024;
/** Cards of up to three specialists in play. */
export const MAX_CARDS = 3;
/** The files every session loads, in the order the pack holds them. */
export const ALWAYS = ['AGENTS.md', 'NOW.md', 'docs/NORTH_STAR.md'];
/** Read only when a task needs them; the pack names them and never holds them. */
export const REFERENCES = ['docs/BRIEF.md', 'docs/history/2026-10-27-growth-session-handoff.md', 'docs/CONTROL-CENTER-BRIEF.md', 'docs/control-center/ENGINE-PROTOCOL.md', 'docs/OWNERS.md', 'docs/RULINGS.md', 'docs/GET-GOING.md'];
/** The pack's part markers. A test checks every mandatory part is named. */
export const MARK = name => `=== pack part: ${name} ===`;
export const MANDATORY_PARTS = [...ALWAYS, 'week spec', 'cards', 'findings and holds', 'gate status'];

const CODE = /^[a-z][a-z0-9_.:-]{0,63}$/;
const bytes = s => Buffer.byteLength(s, 'utf8');

/** The London calendar date of an instant, `YYYY-MM-DD`. Pure. */
export function londonDate(at) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = day => new Date(`${day}T12:00:00Z`).getUTCDay();
/** The Monday of the London week holding `day`. Pure. */
export const mondayOf = day => addDays(day, -((weekday(day) + 6) % 7));
/** The next date on or after `day` that falls on weekday `n` (0 Sunday). Pure. */
const nextOn = (day, n) => addDays(day, (n - weekday(day) + 7) % 7);

/**
 * Codes and counts from a report, never its words: holds by reason, lint
 * findings from the crew's shadow line (or a findings array), and the status.
 * A code that is not a plain code is counted as `unrecognised`. Pure.
 */
export function reportCounts(input) {
  const report = input?.report && typeof input.report === 'object' ? input.report : input;
  if (!report || typeof report !== 'object') return null;
  const tally = list => { const m = new Map(); for (const c of list) { const k = typeof c === 'string' && CODE.test(c) ? c : 'unrecognised'; m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
  const holds = Array.isArray(report.holds) ? tally(report.holds.map(h => h?.reason)) : null;
  let findings = null;
  if (Array.isArray(report.findings)) findings = tally(report.findings.map(f => f?.lint));
  else if (Array.isArray(report.activity)) {
    const line = report.activity.map(a => typeof a === 'string' ? a : a?.line).find(l => typeof l === 'string' && l.startsWith('Crew lints, in shadow:'));
    if (line) {
      const m = /; (\d+) findings? \((.+?)\)\./.exec(line);
      if (/; no findings\./.test(line)) findings = [];
      else if (m) findings = m[2].split(', ').map(x => /^(\S+) (\d+)$/.exec(x)).map(x => x && CODE.test(x[1]) ? [x[1], Number(x[2])] : ['unrecognised', 1]);
    }
  }
  const status = typeof report.status === 'string' && CODE.test(report.status) ? report.status : null;
  const spec = Array.isArray(report.activity) ? report.activity.map(a => typeof a === 'string' ? a : a?.line).find(l => typeof l === 'string' && /^Week spec for the week of \d{4}-\d{2}-\d{2}: (signed|not signed)/.test(l)) : null;
  const specState = spec ? (/: signed by/.test(spec) ? 'signed' : 'not signed') : null;
  return { status, holds, findings, specState };
}

const line = (label, pairs) => pairs === null ? `${label}: unknown (the report carries none).` : `${label}: ${pairs.reduce((n, [, c]) => n + c, 0)}${pairs.length ? ` (${pairs.map(([k, c]) => `${k} ${c}`).join(', ')})` : ''}.`;

/** The build's steps from docs/GET-GOING.md: ticked and open, by their bold label. Pure. */
export function buildSteps(markdown) {
  const steps = [...String(markdown).matchAll(/^- \[( |x)\] \*\*(.+?)\*\*/gm)].map(m => ({ done: m[1] === 'x', label: m[2].replace(/[.:]$/, '') }));
  return { done: steps.filter(s => s.done).length, open: steps.filter(s => !s.done).map(s => s.label) };
}

/** NOW.md's north-star-state block, parsed, or null. Pure. */
export function northStarState(markdown) {
  const m = /<!-- north-star-state (\{.*?\}) -->/.exec(String(markdown));
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}

/**
 * Build the pack from a repository root. Returns its text, its parts with
 * their bytes, the total and whether it fits. Reads files only.
 */
export async function buildPack({ root, cards = [], report = undefined, specFile = null, at = new Date().toISOString(), ledger = null }) {
  if (!Array.isArray(cards) || cards.length > MAX_CARDS) throw new Error(`A pack holds the cards of up to ${MAX_CARDS} specialists; ${cards.length} were named.`);
  const index = JSON.parse(await readFile(resolve(root, 'crew/index.json'), 'utf8'));
  const slugs = new Set(index.specialists.map(s => s.slug));
  for (const c of cards) if (!slugs.has(c)) throw new Error(`No specialist ${JSON.stringify(c)} in crew/index.json.`);
  if (new Set(cards).size !== cards.length) throw new Error('A specialist is named twice.');
  const read = p => readFile(resolve(root, p), 'utf8');
  const today = londonDate(at), monday = mondayOf(today);
  const parts = [];
  const add = (name, body) => parts.push({ name, text: `${MARK(name)}\n\n${body.trimEnd()}\n\n` });

  const header = `# Session pack\n\nWritten by \`npm run pack\` for ${at} (London ${today}). It holds every mandatory load for a session in ${PACK_MAX} bytes or fewer: ${MANDATORY_PARTS.join(', ')}. Open anything else only when the task needs it: ${REFERENCES.join(', ')}.\n\n`;
  parts.push({ name: 'header', text: header });
  for (const f of ALWAYS) add(f, await read(f));

  // The week spec in force: one passed in, else this week's proposed file, else the default spec.
  let spec, source;
  const weekFile = `specs/weeks/${monday}.json`;
  if (specFile) { spec = JSON.parse(await readFile(resolve(root, specFile), 'utf8')); source = `${specFile}, passed in as the spec in force`; }
  else if (existsSync(resolve(root, weekFile))) { spec = JSON.parse(await read(weekFile)); source = `${weekFile}, proposed for this week; whether he signed it is read from his Control Center decisions at the dispatch, not here`; }
  else { spec = defaultSpec({ weekOf: monday }); source = monday < FIRST_SPEC_WEEK ? `today's settings, the default spec from src/crew/compile.mjs: no spec is posted before the week of ${FIRST_SPEC_WEEK}` : `no spec file for the week of ${monday}, so the default spec from src/crew/compile.mjs (today's settings) unless he signed one`; }
  add('week spec', `Source: ${source}.\n\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\``);

  if (!cards.length) add('cards', `None named. Name up to ${MAX_CARDS} specialists in play: npm run pack -- --cards <slug>,<slug>. The nine are in crew/index.json: ${[...slugs].join(', ')}.`);
  else { add('cards', `${cards.length} in play: ${cards.join(', ')}.`); for (const c of cards) add(`card: ${c}`, await read(`crew/${c}/card.md`)); }

  const counts = report === undefined ? undefined : reportCounts(report);
  add('findings and holds', counts === undefined
    ? 'Unknown: no report file was passed (npm run pack -- --report <file>). Counts and codes only, never details.'
    : counts === null ? 'Unknown: the report file is not a report.'
      : [`Report status: ${counts.status ?? 'unknown'}.`, line('Open lint findings, in shadow', counts.findings), line('Holds', counts.holds), 'Counts and codes only, never details.'].join('\n'));

  const ns = northStarState(await read('NOW.md'));
  const steps = buildSteps(await read('docs/GET-GOING.md'));
  const nextMonday = nextOn(today, 1), nextFriday = nextOn(today, 5);
  const last = Array.isArray(ledger) && ledger.length ? ledger[ledger.length - 1] : null;
  add('gate status', [
    `- North Star: ${ns ? `U${ns.urgency}, ${ns.current === null ? 'not measured yet' : `${ns.current} good meetings`} against ${ns.week_target} for the week of ${ns.week_of} (NOW.md)` : 'unknown: NOW.md has no north-star-state line'}.`,
    `- The build (docs/GET-GOING.md): ${steps.done} ticked, ${steps.open.length} open${steps.open.length ? `: ${steps.open.join('; ')}` : ''}. Do the first open step.`,
    `- Week spec: ${monday < FIRST_SPEC_WEEK ? `none posted before the week of ${FIRST_SPEC_WEEK}; today's settings apply` : counts?.specState ? `${counts.specState} for the week of ${monday}, per the report` : `for the week of ${monday}, signature unknown here`}.`,
    `- Recurring gates: Monday's one ask ${nextMonday}, Friday's review ${nextFriday}. No mid-turn questions: they go into the next spec's questions[].`,
    `- Codex cards: ${last ? `last dispatched ${last.card_id} at ${last.dispatched_at}` : 'none dispatched from this machine'}; each needs a dated usage reading at 80% or less and his yes on its digest (scripts/dispatch-card.mjs).`
  ].join('\n'));

  const text = parts.map(p => p.text).join('');
  const sized = parts.map(p => ({ name: p.name, bytes: bytes(p.text) }));
  const total = bytes(text);
  return { text, parts: sized, total, fits: total <= PACK_MAX };
}

function args(argv) {
  const out = { cards: [], report: undefined, spec: null, at: undefined, out: 'runtime/pack.md' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--cards') { out.cards = String(v ?? '').split(',').map(s => s.trim()).filter(Boolean); i++; }
    else if (a === '--report') { out.report = v; i++; }
    else if (a === '--spec') { out.spec = v; i++; }
    else if (a === '--at') { out.at = v; i++; }
    else if (a === '--out') { out.out = v; i++; }
    else throw new Error(`Unknown argument ${a}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.PACK_ROOT ? resolve(process.env.PACK_ROOT) : fileURLToPath(new URL('../', import.meta.url));
  try {
    const a = args(process.argv.slice(2));
    let report;
    if (a.report) { try { report = JSON.parse(await readFile(resolve(root, a.report), 'utf8')); } catch { report = null; } }
    let ledger = null;
    try { ledger = JSON.parse(await readFile(resolve(root, 'runtime/codex/ledger.json'), 'utf8')); } catch { ledger = null; }
    const pack = await buildPack({ root, cards: a.cards, report, specFile: a.spec, at: a.at ?? new Date().toISOString(), ledger });
    const file = resolve(root, a.out);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, pack.text);
    console.log(`${a.out}: ${pack.total} bytes of ${PACK_MAX} (36 KB)${pack.fits ? '' : ', OVER THE LIMIT'}`);
    for (const p of pack.parts) console.log(`  ${p.name}: ${p.bytes} bytes`);
    if (!pack.fits) { console.error(`FAIL: the pack is ${pack.total - PACK_MAX} bytes over 36 KB. Shorten an always-on file or name fewer cards.`); process.exitCode = 1; }
  } catch (e) { console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
