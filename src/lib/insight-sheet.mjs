// The insight desk's sheet, read by fixed rules (Ruling, Krish, 2026-11-24:
// the method is the ai-harness `insight-desk` skill, read live; this engine
// keeps only a thin adapter, config/insight-desk.json). A sheet holds up to
// three ideas behind Mindmake's number, each with its claim, mechanic, idea
// level, conversion path and screen. It lives in runtime/ and is never
// committed.
//
// This file is the Node copy of the skill's taste-free checks
// (`scripts/validate_sheet.py` in ai-harness), plus this engine's own rules:
// the chosen insight argues the mission thesis from docs/EVIDENCE.md, and no
// humour engine is consulted unless Krish's approved taste allows it. It reads
// and judges; it writes nothing, asks nothing and sends nothing.
//
// `angleFromSheet` is the one way an idea reaches a draft: the claim of the
// idea Krish approved, as an optional angle for the research desk's opening
// sentence (src/stages/openings.mjs). Without a sheet nothing changes. Pure.
import { createHash } from 'node:crypto';
import { stable, clean } from '../guards.mjs';
import { namesUnnamed } from '../stages/unnamed.mjs';

export const SHEET_SCHEMA = 'insight-sheet/1';
/** The most characters of an idea's claim an opening's angle carries. */
export const ANGLE_MAX = 120;

const TOP_KEYS = ['schema', 'venture', 'repo', 'harness_skill_sha', 'made_at', 'north_star', 'stall_check', 'insights', 'chosen_insight', 'discarded_obvious', 'ideas', 'consults', 'lead', 'blind_passes', 'sheet_sha256'];
const DIAGNOSES = ['idea', 'distribution', 'offer', 'attribution', 'measurement'];
const LEVELS = ['execution', 'campaign', 'platform', 'business', 'measurement'];
const TEST_KEYS = ['specificity', 'share', 'analogue', 'floor', 'kill_the_favourite'];
const RESULTS = ['pass', 'fail', 'unavailable'];
const CONSULT_RESULTS = ['pass', 'flagged', 'unavailable'];
const ENGINES = ['divergent-thinker', 'humour-engine'];
const IDEA_KEYS = ['id', 'claim', 'mechanic', 'idea_level', 'method', 'channel_role', 'conversion_path', 'kill_condition', 'tests'];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA1_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SCORE_KEY = /^(?:score|scores|rating|points|weight|weighted_total|total)$/i;
const EM_DASH = String.fromCharCode(8212);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const filled = v => typeof v === 'string' && v.trim() !== '';
const isDate = v => typeof v === 'string' && DATE_RE.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`));
const isDateTime = v => typeof v === 'string' && v.includes('T') && Number.isFinite(Date.parse(v));
const isInt = v => Number.isInteger(v) && typeof v === 'number';
const keysOf = o => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o) : []);
const sameKeys = (o, want) => { const k = keysOf(o).sort(); return k.length === want.length && [...want].sort().every((x, i) => x === k[i]); };
const words = v => String(v ?? '').toLowerCase().split(/\s+/).filter(Boolean).join(' ');

/** The SHA-256 of the sheet without its own `sheet_sha256`, keys sorted, no spaces: the skill's hash. Pure. */
export function sheetSha(sheet) {
  const body = Object.fromEntries(Object.entries(sheet ?? {}).filter(([k]) => k !== 'sheet_sha256'));
  return createHash('sha256').update(stable(body)).digest('hex');
}

function walkForScores(node, where, errors) {
  if (Array.isArray(node)) node.forEach((v, i) => walkForScores(v, `${where}[${i}]`, errors));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { if (SCORE_KEY.test(k)) errors.push(`${where}.${k}: no scores; the sheet carries results and reasons only`); walkForScores(v, `${where}.${k}`, errors); }
  else if (typeof node === 'string' && node.includes(EM_DASH)) errors.push(`${where}: carries an em dash`);
}

function checkTest(label, t, errors, analogue = false) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) { errors.push(`${label}: missing`); return; }
  const allowed = new Set(['result', 'reason', ...(analogue ? ['url', 'read_at'] : [])]);
  const extra = keysOf(t).filter(k => !allowed.has(k));
  if (extra.length) errors.push(`${label}: unexpected fields ${extra.sort().join(', ')}`);
  if (!RESULTS.includes(t.result)) errors.push(`${label}: result must be pass, fail or unavailable`);
  if (!filled(t.reason)) errors.push(`${label}: needs a reason`);
  if (analogue) {
    for (const k of ['url', 'read_at']) if (!(k in t)) errors.push(`${label}: needs ${k} (null when none was found)`);
    if (t.result === 'pass') {
      if (!filled(t.url)) errors.push(`${label}: a passing analogue is linked`);
      if (!isDate(t.read_at)) errors.push(`${label}: a passing analogue records the date it was read`);
    }
  }
}

function checkIdea(i, idea, methods, errors) {
  const label = `ideas[${i}]`;
  if (!idea || typeof idea !== 'object' || Array.isArray(idea)) { errors.push(`${label}: not an object`); return; }
  const missing = IDEA_KEYS.filter(k => !(k in idea));
  if (missing.length) errors.push(`${label}: missing ${missing.join(', ')}`);
  const extra = keysOf(idea).filter(k => !IDEA_KEYS.includes(k));
  if (extra.length) errors.push(`${label}: unexpected fields ${extra.sort().join(', ')}`);
  if (!(typeof idea.id === 'string' && ID_RE.test(idea.id))) errors.push(`${label}: id must be lower-case letters, digits and hyphens`);
  for (const k of ['claim', 'mechanic', 'channel_role', 'kill_condition']) if (k in idea && !filled(idea[k])) errors.push(`${label}: ${k} is empty`);
  if (!LEVELS.includes(idea.idea_level)) errors.push(`${label}: idea_level must be one of ${LEVELS.join(', ')}`);
  if (!filled(idea.method)) errors.push(`${label}: method is empty`);
  else if (methods && !methods.has(idea.method)) errors.push(`${label}: method ${JSON.stringify(idea.method)} is not in the skill's methods-by-category`);
  const path = idea.conversion_path;
  if (!path || typeof path !== 'object' || !['offer', 'link', 'why_act'].every(k => filled(path[k]))) errors.push(`${label}: an idea with no full conversion path (offer, link, why_act) is held off the sheet`);
  else if (keysOf(path).some(k => !['offer', 'link', 'why_act'].includes(k))) errors.push(`${label}: conversion_path has unexpected fields`);
  const tests = idea.tests;
  if (!tests || typeof tests !== 'object' || Array.isArray(tests)) { errors.push(`${label}: tests missing`); return; }
  const extraTests = keysOf(tests).filter(k => !TEST_KEYS.includes(k));
  if (extraTests.length) errors.push(`${label}: unexpected tests ${extraTests.sort().join(', ')}`);
  for (const k of TEST_KEYS) checkTest(`${label}.tests.${k}`, tests[k], errors, k === 'analogue');
}

function checkInsight(i, ins, errors) {
  const label = `insights[${i}]`;
  if (!ins || typeof ins !== 'object' || Array.isArray(ins)) { errors.push(`${label}: not an object`); return; }
  for (const k of ['audience', 'wants', 'but', 'because']) if (!filled(ins[k])) errors.push(`${label}: ${k} is empty`);
  const extra = keysOf(ins).filter(k => !['audience', 'wants', 'but', 'because', 'source', 'read_at', 'assumption'].includes(k));
  if (extra.length) errors.push(`${label}: unexpected fields ${extra.sort().join(', ')}`);
  const sourced = 'source' in ins || 'read_at' in ins;
  const assumed = 'assumption' in ins;
  if (sourced && assumed) errors.push(`${label}: either a source and read_at, or assumption: true, never both`);
  else if (assumed) { if (ins.assumption !== true) errors.push(`${label}: assumption must be true when present`); }
  else if (!(filled(ins.source) && isDate(ins.read_at))) errors.push(`${label}: needs a source and the date it was read, or assumption: true`);
}

/**
 * The skill's taste-free rules, by hand: the shape, the stall is the idea or
 * measurement, at U4 with nothing measured every idea is a measurement idea,
 * a lead only when both blind passes pick it and every one of its tests
 * passed, no scores, and the hash matches. `methods` (a Set of the skill's
 * method ids) is checked when given; without it the method is `unchecked`.
 * Returns { ok, errors, unchecked }. Pure.
 */
export function validateSheet(sheet, { methods = null } = {}) {
  const errors = [];
  const unchecked = methods ? [] : ['method'];
  if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) return { ok: false, errors: ['the sheet is not a JSON object'], unchecked };
  const missing = TOP_KEYS.filter(k => !(k in sheet));
  if (missing.length) errors.push(`missing ${missing.join(', ')}`);
  const extra = keysOf(sheet).filter(k => !TOP_KEYS.includes(k));
  if (extra.length) errors.push(`unexpected fields ${extra.sort().join(', ')}`);
  if (sheet.schema !== SHEET_SCHEMA) errors.push(`schema must be ${SHEET_SCHEMA}`);
  if (!filled(sheet.venture)) errors.push('venture is empty');
  if (!(typeof sheet.repo === 'string' && REPO_RE.test(sheet.repo))) errors.push('repo must be owner/name');
  if (!(typeof sheet.harness_skill_sha === 'string' && SHA1_RE.test(sheet.harness_skill_sha))) errors.push('harness_skill_sha must be the 40-character commit the skill was read at');
  if (!isDateTime(sheet.made_at)) errors.push('made_at must be an ISO date-time');

  const ns = sheet.north_star;
  let urgency = null, current = null;
  if (!sameKeys(ns, ['metric', 'urgency', 'current', 'as_of'])) errors.push('north_star needs exactly metric, urgency, current and as_of');
  else {
    ({ urgency, current } = ns);
    if (!filled(ns.metric)) errors.push('north_star.metric is empty');
    if (!(isInt(urgency) && urgency >= 1 && urgency <= 5)) errors.push('north_star.urgency must be 1 to 5');
    if (current !== null && !(typeof current === 'number' && Number.isFinite(current))) errors.push('north_star.current must be a number or null');
    if (ns.as_of !== null && !isDate(ns.as_of)) errors.push('north_star.as_of must be a date or null');
  }

  const stall = sheet.stall_check;
  let diagnosis = null;
  if (!sameKeys(stall, ['diagnosis', 'evidence'])) errors.push('stall_check needs exactly diagnosis and evidence');
  else {
    diagnosis = stall.diagnosis;
    if (!DIAGNOSES.includes(diagnosis)) errors.push(`stall_check.diagnosis must be one of ${DIAGNOSES.join(', ')}`);
    else if (!['idea', 'measurement'].includes(diagnosis)) errors.push(`the stall is ${diagnosis}, not the idea; the desk stops and makes no sheet`);
    if (!filled(stall.evidence)) errors.push('stall_check.evidence is empty');
  }

  let insights = sheet.insights;
  if (!Array.isArray(insights) || insights.length < 1 || insights.length > 3) { errors.push('insights must hold one to three lines'); if (!Array.isArray(insights)) insights = []; }
  insights.forEach((ins, i) => checkInsight(i, ins, errors));
  if (!(isInt(sheet.chosen_insight) && sheet.chosen_insight >= 0 && sheet.chosen_insight < insights.length)) errors.push('chosen_insight must point at one of the insights');

  let obvious = sheet.discarded_obvious;
  if (!(Array.isArray(obvious) && obvious.length === 3 && obvious.every(filled))) { errors.push('discarded_obvious must hold exactly three ideas'); obvious = []; }

  let ideas = sheet.ideas;
  if (!Array.isArray(ideas) || ideas.length < 1 || ideas.length > 3) { errors.push('ideas must hold one to three ideas'); if (!Array.isArray(ideas)) ideas = []; }
  ideas.forEach((idea, i) => checkIdea(i, idea, methods, errors));
  const byId = new Map(ideas.filter(x => x && typeof x === 'object').map(x => [x.id, x]));
  if (byId.size !== ideas.length) errors.push('idea ids must be unique');
  const plain = new Set(obvious.map(words));
  for (const idea of byId.values()) if (plain.has(words(idea.claim))) errors.push(`idea ${idea.id}: restates a discarded obvious idea`);
  if (diagnosis === 'measurement' || (urgency === 4 && current === null)) {
    for (const idea of byId.values()) if (idea.idea_level !== 'measurement') errors.push(`idea ${idea.id}: nothing is measured, so every idea is a measurement idea`);
  }

  let consults = sheet.consults;
  if (!Array.isArray(consults)) { errors.push('consults must be a list (empty when no engine was called)'); consults = []; }
  consults.forEach((c, i) => {
    if (!sameKeys(c, ['engine', 'op', 'result', 'ref'])) { errors.push(`consults[${i}]: needs exactly engine, op, result and ref`); return; }
    if (!ENGINES.includes(c.engine)) errors.push(`consults[${i}]: engine must be one of ${ENGINES.join(', ')}`);
    if (!CONSULT_RESULTS.includes(c.result)) errors.push(`consults[${i}]: result must be pass, flagged or unavailable; exit 2 is unavailable, never pass`);
    if (!filled(c.op) || !filled(c.ref)) errors.push(`consults[${i}]: op and ref are filled`);
  });

  let passes = sheet.blind_passes;
  if (!Array.isArray(passes) || passes.length !== 2) { errors.push('blind_passes must hold exactly two passes'); passes = []; }
  const ids = [...byId.keys()].sort();
  passes.forEach((b, i) => {
    if (!sameKeys(b, ['reader', 'order', 'lead'])) { errors.push(`blind_passes[${i}]: needs exactly reader, order and lead`); return; }
    if (!filled(b.reader)) errors.push(`blind_passes[${i}]: name the reader`);
    if (!Array.isArray(b.order) || JSON.stringify([...b.order].sort()) !== JSON.stringify(ids)) errors.push(`blind_passes[${i}]: order must list every idea id once`);
    if (b.lead !== null && !byId.has(b.lead)) errors.push(`blind_passes[${i}]: lead is not an idea on the sheet`);
  });
  if (passes.length === 2 && passes.every(p => p && typeof p === 'object')) {
    if (ids.length > 1 && JSON.stringify(passes[0].order) === JSON.stringify(passes[1].order)) errors.push('blind_passes: the two orders must be shuffled differently');
    if (passes.some(p => ['writer', 'author'].includes(p.reader))) errors.push('blind_passes: the reader is never the writer of the ideas');
  }

  const lead = sheet.lead;
  if (lead !== null && lead !== undefined) {
    if (!byId.has(lead)) errors.push('lead is not an idea on the sheet');
    else {
      if (!passes.length || passes.some(p => p && typeof p === 'object' && p.lead !== lead)) errors.push('lead: both blind passes must pick the same lead; otherwise lead is null');
      const tests = byId.get(lead).tests ?? {};
      for (const k of TEST_KEYS) { const r = tests?.[k]?.result; if (r !== 'pass') errors.push(`lead ${lead}: ${k} is ${r}; an idea leads only when every test passed`); }
    }
  }

  walkForScores(sheet, 'sheet', errors);
  if (!(typeof sheet.sheet_sha256 === 'string' && SHA256_RE.test(sheet.sheet_sha256))) errors.push('sheet_sha256 must be 64 lower-case hex characters');
  else if (sheet.sheet_sha256 !== sheetSha(sheet)) errors.push('sheet_sha256 does not match the sheet; recompute it');
  return { ok: errors.length === 0, errors, unchecked };
}

/**
 * The evidence ids an idea may argue the thesis from: every `| E<n> |` row of
 * docs/EVIDENCE.md, except one marked "Verify first" and those under "The
 * direction of travel", which are never stated as fact. Pure.
 */
export function thesisEvidenceIds(evidenceText) {
  const ids = new Set();
  let travel = false;
  for (const line of String(evidenceText ?? '').split('\n')) {
    if (/^##\s/.test(line)) travel = /direction of travel/i.test(line);
    const m = /^\|\s*(E\d+)\s*\|/.exec(line);
    if (m && !travel && !/verify first/i.test(line)) ids.add(m[1]);
  }
  return ids;
}

/**
 * This engine's own rules over a valid sheet (config/insight-desk.json):
 *   - it is Mindmake's sheet, from this repository;
 *   - the chosen insight argues the mission thesis: it is sourced, never an
 *     assumption, and its source names docs/EVIDENCE.md with at least one id
 *     that may be stated as fact (Rulings, Krish, 2026-11-17);
 *   - no humour engine was consulted unless the adapter allows it, and it
 *     allows it only where Krish's approved taste does; it is never assumed;
 *   - divergent-thinker ran in this engine's own namespace only.
 * Returns a list of reasons, empty when it holds. Pure.
 */
export function adapterErrors(sheet, adapter, evidenceText) {
  const errors = [];
  if (!adapter || typeof adapter !== 'object') return ['no adapter: config/insight-desk.json was not read'];
  if (sheet?.venture !== adapter.venture) errors.push(`venture must be ${adapter.venture}`);
  if (sheet?.repo !== adapter.repo) errors.push(`repo must be ${adapter.repo}`);
  const chosen = Array.isArray(sheet?.insights) ? sheet.insights[sheet.chosen_insight] : null;
  const allowed = thesisEvidenceIds(evidenceText);
  if (adapter.thesis?.required) {
    if (!chosen || chosen.assumption === true) errors.push('thesis: the chosen insight is an assumption; it must argue the thesis from docs/EVIDENCE.md');
    else {
      const src = String(chosen.source ?? '');
      const cited = [...src.matchAll(/\bE\d+\b/g)].map(m => m[0]);
      if (!src.includes(adapter.thesis.evidence)) errors.push(`thesis: the chosen insight's source must name ${adapter.thesis.evidence}`);
      else if (!cited.some(id => allowed.has(id))) errors.push('thesis: the chosen insight cites no evidence id that may be stated as fact (not "verify first", not the direction of travel)');
    }
  }
  const consults = Array.isArray(sheet?.consults) ? sheet.consults : [];
  if (adapter.humour?.allowed !== true && consults.some(c => c?.engine === 'humour-engine')) errors.push('humour: the adapter does not allow the humour engine; Mindmake never assumes humour');
  const ns = adapter.divergent?.namespace;
  // A ref may name this engine's root namespace or any of its own lanes; any other growth-* namespace is another venture's.
  const root = ns ? String(ns).split(':')[0] : null;
  const ours = name => name === root || name.startsWith(`${root}:`);
  for (const c of consults.filter(c => c?.engine === 'divergent-thinker')) {
    if (!root || typeof c.ref !== 'string') continue;
    const named = c.ref.match(/growth-[a-z]+(?::[a-z-]+)?/g) ?? [];
    if (named.some(n => !ours(n))) errors.push(`divergent: a consult names another namespace than ${root}`);
  }
  return errors;
}

/**
 * What keeps words from being an angle a draft could carry: a link, a dash
 * (an en or em dash, or a hyphen standing alone between words), an
 * exclamation mark, or the company Krish does not name (Ruling, Krish,
 * 2026-11-18). Returns reasons, empty when the words may be carried. Pure.
 */
export function angleWordErrors(words) {
  const w = clean(String(words ?? ''));
  const errors = [];
  if (/https?:|www\./i.test(w)) errors.push('its claim carries a link');
  if (/[\u2013\u2014!]/.test(w) || /(?:^|\s)-+(?:\s|$)/.test(w)) errors.push('its claim carries a dash or an exclamation mark');
  if (namesUnnamed(w)) errors.push('its claim names the company Krish does not name');
  return errors;
}

/**
 * The angle a draft may lean on: the claim of the one idea Krish approved,
 * named by `idea` (there is no default; the lead alone approves nothing),
 * from a sheet that passes every rule above. Only an idea whose tests all
 * passed and that is not a measurement idea may be an angle, and only words
 * a draft could carry: no link, no dash, no exclamation, and never the company
 * Krish does not name (Ruling, Krish, 2026-11-18). The angle never adds a
 * fact: the desk is told so, and the openings' fixed rules still read every
 * sentence. Returns { angle, idea, sheet_sha256, harness_skill_sha } or
 * { angle: null, reasons }. Pure.
 */
export function angleFromSheet(sheet, { idea = null, adapter = null, evidence = '', methods = null } = {}) {
  if (!filled(idea)) return { angle: null, reasons: ['no approved idea named'] };
  const v = validateSheet(sheet, { methods });
  const reasons = [...v.errors, ...adapterErrors(sheet, adapter, evidence)];
  const chosen = (Array.isArray(sheet?.ideas) ? sheet.ideas : []).find(x => x?.id === idea);
  if (!chosen) reasons.push(`idea ${idea} is not on the sheet`);
  else {
    if (chosen.idea_level === 'measurement') reasons.push(`idea ${idea} is a measurement idea; it is no angle for words`);
    for (const k of TEST_KEYS) if (chosen.tests?.[k]?.result !== 'pass') reasons.push(`idea ${idea}: ${k} did not pass`);
    for (const r of angleWordErrors(chosen.claim)) reasons.push(`idea ${idea}: ${r}`);
  }
  if (reasons.length) return { angle: null, reasons };
  const claim = clean(chosen.claim).replace(/[.\s]+$/, '');
  const angle = claim.length <= ANGLE_MAX ? claim : claim.slice(0, ANGLE_MAX).replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '');
  return { angle, idea, sheet_sha256: sheet.sheet_sha256, harness_skill_sha: sheet.harness_skill_sha };
}
