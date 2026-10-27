/**
 * The 20x measurement (docs/briefs/2026-10-27-bulletproof-growth-engine.md,
 * section 8, Phase 5): the plan's eight measures, per session, against the
 * Phase 0 baseline.
 *
 *   npm run measure-20x -- --after runtime/<after>.json [--baseline runtime/baseline-2026-10-27.json] [--out runtime/<name>.json] [--show]
 *
 * Both inputs take the Phase 0 baseline's own format (the private file in
 * ignored runtime/): `{ generated, definitions, sessions: { <short>: {
 * readable, totals } }, prs: [{ pr, session, window_start, merged_at,
 * tokens: { input_tokens, output_tokens, cache_read_input_tokens,
 * cache_creation_input_tokens }, ... }] }`. A measure that format does not
 * hold is read from optional fields, and is unknown, with its reason, when
 * they are absent:
 *
 * - on a PR: `capability` (the feature it belongs to; absent, a PR is its own
 *   capability, Phase 0's "work between two merges"), `corrective` (true when
 *   it corrects earlier work) and `review_rounds` (his review rounds on it);
 * - on a session's totals: `mid_turn_questions`;
 * - at the top: `live_runs` ([{ purpose: 'proof' | 'find_defect' | 'dispatch',
 *   outcome }]; a proof run is never a defect-finding run, and a run with no
 *   measured outcome counts as not done) and `gates` ([{ week_of, count }]).
 *
 * Counts stay in runtime/: the readout is written there and nowhere else,
 * and what it prints names each measure's state and whether its target is
 * met, never a figure, unless --show is passed on his own machine. A measure
 * is measured or unknown with a reason, never a zero nobody measured.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, relative, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
/** The plan's eight measures, in its order, with their targets. */
export const MEASURES = [
  { key: 'tokens_per_capability', what: 'Claude tokens per accepted capability', target: 'one twentieth of the baseline or less' },
  { key: 'prs_per_capability', what: 'PRs per accepted capability', target: '1' },
  { key: 'corrective_share', what: 'Corrective share of PRs', target: '1 in 20 or less' },
  { key: 'defect_runs', what: 'Live runs started to find defects', target: '0' },
  { key: 'review_rounds_per_capability', what: 'His review rounds per capability', target: '1 gate' },
  { key: 'mid_turn_questions', what: 'Mid-turn questions', target: '0' },
  { key: 'recurring_gates', what: 'Recurring gates', target: '2 a week' },
  { key: 'ask_to_accepted_hours', what: 'Ask-to-accepted wall clock', target: 'one twentieth of the baseline, wherever the baseline is measurable' }
];
export const RATIO = 20;
const TOKEN_KEYS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
const H = 3600000;

const list = v => (Array.isArray(v) ? v : []);
const nat = v => Number.isInteger(v) && v >= 0;
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = (v, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** A PR's Claude tokens: the four counters summed, or null when any is missing. */
export function tokensOf(pr) {
  const t = pr?.tokens;
  if (!t || typeof t !== 'object' || !TOKEN_KEYS.every(k => Number.isFinite(t[k]) && t[k] >= 0)) return null;
  return TOKEN_KEYS.reduce((s, k) => s + t[k], 0);
}

/** The accepted capabilities of a measurement: PRs grouped by `capability`, else one each; only merged PRs. Pure. */
export function capabilities(input) {
  const groups = new Map();
  for (const pr of list(input?.prs)) {
    if (!Number.isInteger(pr?.pr) || typeof pr.merged_at !== 'string' || !Number.isFinite(Date.parse(pr.merged_at))) continue;
    const key = typeof pr.capability === 'string' && pr.capability ? `c:${pr.capability}` : `pr:${pr.pr}`;
    if (!groups.has(key)) groups.set(key, { key, named: key.startsWith('c:'), prs: [] });
    groups.get(key).prs.push(pr);
  }
  return [...groups.values()];
}

const capTokens = c => { const ts = c.prs.map(tokensOf); return ts.every(t => t !== null) ? ts.reduce((a, b) => a + b, 0) : null; };
const capHours = c => {
  const starts = c.prs.map(p => Date.parse(p.window_start)), ends = c.prs.map(p => Date.parse(p.merged_at));
  if (![...starts, ...ends].every(Number.isFinite)) return null;
  const h = (Math.max(...ends) - Math.min(...starts)) / H;
  return h >= 0 ? h : null;
};
const unknown = (m, reason, extra = {}) => ({ ...m, state: 'unknown', value: null, baseline: null, met: null, reason, ...extra });
const measured = (m, value, baseline, met, extra = {}) => ({ ...m, state: 'measured', value, baseline, met, reason: null, ...extra });

/** A ratio measure: median per capability, against one twentieth of the baseline's median. */
function ratio(m, after, base, per) {
  const a = capabilities(after).map(per).filter(v => v !== null), b = capabilities(base).map(per).filter(v => v !== null);
  if (!b.length) return unknown(m, 'the Phase 0 baseline holds no measurable capability for it');
  if (!a.length) return unknown(m, 'no accepted capability since the baseline is measurable for it yet');
  const value = median(a), baseline = median(b);
  return measured(m, round(value), round(baseline), value <= baseline / RATIO, { capabilities: a.length });
}

/**
 * The eight measures, each measured or unknown with its reason, and the
 * token and wall-clock measures per session. Pure.
 */
export function measure({ baseline, after }) {
  const [tok, prs, corr, runs, rounds, questions, gates, clock] = MEASURES;
  const out = [];
  if (!baseline || !Array.isArray(baseline.prs)) return { measures: MEASURES.map(m => unknown(m, 'no Phase 0 baseline was given')), by_session: {} };
  if (!after || !Array.isArray(after.prs)) return { measures: MEASURES.map(m => unknown(m, 'no measurement since the baseline was given')), by_session: {} };
  out.push(ratio(tok, after, baseline, capTokens));
  const caps = capabilities(after);
  if (!caps.length) out.push(unknown(prs, 'no merged PR since the baseline'));
  else if (!caps.some(c => c.named)) out.push(unknown(prs, 'no PR names its capability; one PR per merge is 1 by definition and proves nothing'));
  else {
    const named = caps.filter(c => c.named), sizes = named.map(c => c.prs.length);
    const bnamed = capabilities(baseline).filter(c => c.named);
    out.push(measured(prs, round(sizes.reduce((a, b) => a + b, 0) / sizes.length), bnamed.length ? round(bnamed.reduce((a, c) => a + c.prs.length, 0) / bnamed.length) : null, Math.max(...sizes) <= 1, { capabilities: named.length }));
  }
  const merged = caps.flatMap(c => c.prs);
  if (!merged.length) out.push(unknown(corr, 'no merged PR since the baseline'));
  else if (!merged.every(p => typeof p.corrective === 'boolean')) out.push(unknown(corr, `${merged.filter(p => typeof p.corrective !== 'boolean').length} of ${merged.length} merged PRs say nothing of whether they correct earlier work`));
  else {
    const share = merged.filter(p => p.corrective).length / merged.length;
    const bprs = capabilities(baseline).flatMap(c => c.prs);
    const bshare = bprs.length && bprs.every(p => typeof p.corrective === 'boolean') ? bprs.filter(p => p.corrective).length / bprs.length : null;
    out.push(measured(corr, round(share, 3), round(bshare, 3), share <= 1 / RATIO, { prs: merged.length }));
  }
  if (!Array.isArray(after.live_runs)) out.push(unknown(runs, 'the measurement lists no live runs'));
  else {
    const live = after.live_runs.filter(r => r && typeof r === 'object');
    const defect = live.filter(r => r.purpose === 'find_defect').length;
    const notDone = live.filter(r => r.outcome === null || r.outcome === undefined).length;
    out.push(measured(runs, defect, Array.isArray(baseline.live_runs) ? baseline.live_runs.filter(r => r?.purpose === 'find_defect').length : null, defect === 0, { proof_runs: live.filter(r => r.purpose === 'proof').length, not_done: notDone }));
  }
  if (!caps.length) out.push(unknown(rounds, 'no merged PR since the baseline'));
  else if (!merged.every(p => nat(p.review_rounds))) out.push(unknown(rounds, `${merged.filter(p => !nat(p.review_rounds)).length} of ${merged.length} merged PRs do not count his review rounds`));
  else {
    const per = caps.map(c => c.prs.reduce((s, p) => s + p.review_rounds, 0));
    out.push(measured(rounds, Math.max(...per), null, Math.max(...per) <= 1, { capabilities: per.length }));
  }
  const sessions = Object.values(after.sessions ?? {}).filter(s => s && s.readable !== 'no');
  const q = nat(after.mid_turn_questions) ? after.mid_turn_questions : sessions.length && sessions.every(s => nat(s.totals?.mid_turn_questions)) ? sessions.reduce((a, s) => a + s.totals.mid_turn_questions, 0) : null;
  out.push(q === null ? unknown(questions, 'no readable session counts its mid-turn questions') : measured(questions, q, null, q === 0));
  const weeks = list(after.gates).filter(g => typeof g?.week_of === 'string' && nat(g.count));
  out.push(!weeks.length ? unknown(gates, 'the measurement counts no gates by week') : measured(gates, Math.max(...weeks.map(g => g.count)), null, weeks.every(g => g.count <= 2), { weeks: weeks.length }));
  out.push(ratio(clock, after, baseline, capHours));
  // Per session: the same two ratio measures over each session's own capabilities.
  const by_session = {};
  for (const short of new Set(list(after.prs).map(p => p?.session).filter(s => typeof s === 'string'))) {
    const mine = { prs: after.prs.filter(p => p?.session === short) };
    by_session[short] = { tokens_per_capability: ratio(tok, mine, baseline, capTokens), ask_to_accepted_hours: ratio(clock, mine, baseline, capHours) };
  }
  return { measures: out, by_session };
}

/** What may be printed: each measure's state and whether it met its target, never a figure. Pure. */
export function statusLines(result, { show = false } = {}) {
  return result.measures.map(m => {
    const fig = show && m.state === 'measured' ? ` (${m.value}${m.baseline !== null ? ` against ${m.baseline}` : ''})` : '';
    return m.state === 'measured' ? `${m.what}: measured${fig}; ${m.met ? 'meets' : 'misses'} its target, ${m.target}.` : `${m.what}: unknown, ${m.reason}.`;
  });
}

/** The output path must sit inside ignored runtime/. */
export function insideRuntime(path) {
  const rel = relative(resolve(root, 'runtime'), resolve(root, path));
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith('/');
}

async function main(argv) {
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const show = argv.includes('--show');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const basePath = opt('--baseline') ?? 'runtime/baseline-2026-10-27.json';
  const afterPath = opt('--after');
  const outPath = opt('--out') ?? `runtime/measure-20x-${today}.json`;
  if (!insideRuntime(outPath)) { console.error('measure-20x: the readout stays in ignored runtime/; --out must be a file inside it.'); process.exit(1); }
  const read = async p => { try { return JSON.parse(await readFile(resolve(root, p), 'utf8')); } catch { return null; } };
  const baseline = await read(basePath), after = afterPath ? await read(afterPath) : null;
  const result = { generated: new Date().toISOString(), baseline_file: basePath, after_file: afterPath ?? null, ...measure({ baseline, after }) };
  await mkdir(dirname(resolve(root, outPath)), { recursive: true });
  await writeFile(resolve(root, outPath), `${JSON.stringify(result, null, 2)}\n`);
  for (const line of statusLines(result, { show })) console.log(line);
  console.log(`Counts written to ${outPath} (ignored runtime/; never committed).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2));
