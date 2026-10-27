/**
 * The Phase 5 switch (docs/briefs/2026-10-27-bulletproof-growth-engine.md,
 * section 8): from shadow to the crew holding what it finds.
 *
 * Until the switch every crew lint runs in shadow (src/crew/shadow.mjs): it
 * is counted and reported, and nothing it finds is held. The new route runs
 * beside the old one for a London week behind the week spec's `enabled`
 * field, and it switches only when all four hold:
 *
 * - one signed spec: this week's, signed by his Clear or his digest-verified
 *   version, that sets `enabled: true`. Never last week's carried on, never
 *   today's settings, never an unsigned proposal;
 * - five consecutive live proof runs at one engine revision, so no pull
 *   request (corrective or not) merged between them;
 * - the crew's shadow lines reported on this run;
 * - the number measured: the good_meetings objective reads `measured`.
 *
 * Then every crew lint finding that names a proposal holds it: a hold with
 * the lint's code, counted, and the proposal left out of the report. A
 * finding over the whole run (guard.constraints, measurement.null_not_zero)
 * names no proposal and stays a count. His own signing asks (the `gms-` spec
 * and the `gmg-` Monday ask) are never held by the crew: they are how he
 * turns the route off.
 *
 * Every run reports one readiness line. With the route enabled but not
 * ready, one more line says why it stays in shadow. With the route off (the
 * default spec, and every spec before he enables it) nothing else changes:
 * the report is byte for byte what it was, but for the readiness line.
 *
 * Pure: the dispatch passes in what it read. It stores nothing; past proof
 * runs are read from Control Center or reported unknown, never kept in a
 * ledger of the engine's own (AGENTS.md: no parallel state store).
 */

/** Consecutive live proof runs the switch needs (plan section 8). */
export const PROOF_RUNS_NEEDED = 5;
/** The old route stays in code this many days after the switch (plan section 8). scripts/check-switch.mjs refuses its removal earlier. */
export const OLD_ROUTE_DAYS = 30;
/**
 * The London date of the first enforcing live run, read back from its report.
 * Null until then. The pull request that records it sets this constant (and
 * names it in scripts/check-bespoke.mjs's ALLOW list), and from that date the
 * old route may not be removed for OLD_ROUTE_DAYS.
 */
export const SWITCHED_ON = null;

/** The two lines this module writes, so a reader (and the golden test) can tell them apart from today's lines. */
export const SWITCH_LINE = /^Switch (?:readiness|route): /;
/** The words a proof run's route line carries, with the engine revision it ran at. */
export const PROOF_MARK = 'in shadow beside the old route at engine revision ';

/** Why past proof runs are unknown today: what the protocol serves, and what the engine will not do instead. */
export const PROOF_RUNS_UNREADABLE = "Control Center serves no list of this engine's past reports, and each run id ends in a workflow run number a later run cannot know, so past proof runs are not read and no ledger of the engine's own is kept";

/** Why past proof runs are unknown when Control Center does not list them yet. */
export const PROOF_RUNS_NOT_SERVED = "Control Center does not list this engine's recent reports yet (features.recent_reports), and the engine keeps no ledger of its own";

/**
 * The default reader of past proof runs. Where Control Center lists this
 * engine's latest live reports (`GET .../reports?recent=<n>`, 1.10.0,
 * `features.recent_reports`), it reads them, newest first, and counts with
 * proofRunsFrom; otherwise unknown, with its reason. A synthetic run reads
 * nothing. The run in progress is not stored yet, so the list is the runs
 * before it.
 */
export async function readProofRuns({ cc, revision, mode, capabilities } = {}) {
  if (mode !== 'live') return { count: null, reason: 'a synthetic run counts no proof runs' };
  if (capabilities?.features?.recent_reports !== true || typeof cc?.recentReports !== 'function') return { count: null, reason: PROOF_RUNS_NOT_SERVED };
  const listed = await cc.recentReports(Math.min(10, PROOF_RUNS_NEEDED + 1));
  return proofRunsFrom(listed.map(r => ({ mode: 'live', report: { mode: 'live', status: r?.status ?? null, activity: Array.isArray(r?.activity) ? r.activity : [] } })), { revision });
}

const CREW = [/^Crew lints, /, /^Crew checks, /];
const lineOf = a => (typeof a === 'string' ? a : a?.line ?? '');
const shortRev = revision => (typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision) ? revision.slice(0, 7) : null);

/** The engine revision a past report's route line names, or null when it is not a proof run's line. Pure. */
export function proofRevision(report) {
  const lines = Array.isArray(report?.activity) ? report.activity.map(lineOf) : [];
  const route = lines.find(l => l.startsWith('Switch route: ') && l.includes(PROOF_MARK));
  const m = route ? new RegExp(`${PROOF_MARK}([0-9a-f]{7})\\b`).exec(route) : null;
  return m ? m[1] : null;
}

/**
 * Whether one stored report was a live proof run: accepted live, ready or
 * held (never degraded), with both crew lines and a route line that ran in
 * shadow beside the old route at a recorded revision. Pure.
 */
export function isProofRun(stored) {
  const report = stored?.report ?? null;
  if (!report || stored?.accepted === false) return false;
  if (report.mode !== 'live' || (stored.mode !== undefined && stored.mode !== 'live')) return false;
  if (!['ready', 'held'].includes(report.status)) return false;
  const lines = Array.isArray(report.activity) ? report.activity.map(lineOf) : [];
  if (!CREW.every(r => lines.some(l => r.test(l)))) return false;
  return proofRevision(report) !== null;
}

/**
 * Consecutive live proof runs, newest first, at this run's engine revision:
 * a run at another revision, or one that was not a proof run, ends the count.
 * `reports` is null when they could not be read. Pure.
 */
export function proofRunsFrom(reports, { revision }) {
  if (!Array.isArray(reports)) return { count: null, reason: 'the past reports could not be read' };
  const rev = shortRev(revision);
  if (!rev) return { count: 0, reason: 'this run has no recorded engine revision' };
  let count = 0;
  for (const stored of reports) {
    if (!isProofRun(stored) || proofRevision(stored.report) !== rev) break;
    count++;
  }
  return { count, reason: null };
}

/**
 * What the switch needs, from what this run can prove. `week` is the spec in
 * force (src/crew/compile.mjs weekSpec), `objectives` the report's, `activity`
 * the lines so far, `proofRuns` `{ count, reason }`. Pure.
 */
export function readiness({ week, objectives = [], activity = [], proofRuns = { count: null, reason: PROOF_RUNS_UNREADABLE } }) {
  const signed = week?.source === 'signed' && week?.era === true && week?.spec !== null && typeof week?.spec === 'object';
  const enabled = signed && week.spec.enabled === true;
  const lines = activity.map(lineOf);
  const shadow = CREW.every(r => lines.some(l => r.test(l)));
  const gm = (Array.isArray(objectives) ? objectives : []).find(o => o?.key === 'good_meetings');
  const measured = gm?.availability === 'measured' && Number.isInteger(gm?.value);
  const count = Number.isInteger(proofRuns?.count) && proofRuns.count >= 0 ? proofRuns.count : null;
  const proof = { count, reason: count === null ? (typeof proofRuns?.reason === 'string' && proofRuns.reason ? proofRuns.reason : 'not read') : null };
  const ready = signed && enabled && count !== null && count >= PROOF_RUNS_NEEDED && shadow && measured;
  return { signed, enabled, proof, shadow, measured, ready };
}

const yn = b => (b ? 'yes' : 'no');

/** The readiness line, reported every run. Pure. */
export function readinessLine(r) {
  const spec = r.signed ? `yes, route ${r.enabled ? 'enabled' : 'not enabled'}` : 'no';
  const proof = r.proof.count === null ? `unknown of ${PROOF_RUNS_NEEDED} (${r.proof.reason})` : `${r.proof.count} of ${PROOF_RUNS_NEEDED}`;
  return `Switch readiness: signed spec ${spec}; proof runs ${proof}; shadow reported ${yn(r.shadow)}; number measured ${yn(r.measured)}.`;
}

/** What is still missing, in his words, for the route line. */
function missing(r) {
  const out = [];
  if (r.proof.count === null) out.push('proof runs unknown');
  else if (r.proof.count < PROOF_RUNS_NEEDED) out.push(`${r.proof.count} of ${PROOF_RUNS_NEEDED} proof runs`);
  if (!r.shadow) out.push('no shadow lines this run');
  if (!r.measured) out.push('the number not measured');
  return out;
}

/** The date the old route may be removed: OLD_ROUTE_DAYS after the switch, or null before it. Pure. */
export function oldRouteRemovableFrom(switchedOn = SWITCHED_ON) {
  if (typeof switchedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(switchedOn)) return null;
  const d = new Date(`${switchedOn}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== switchedOn) return null;
  d.setUTCDate(d.getUTCDate() + OLD_ROUTE_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * The route this run takes. Enforce only when the readiness is met, which
 * needs this week's signed spec with `enabled: true`; otherwise the old route
 * (shadow). `line` is null when the route is not enabled, so the default
 * report gains only the readiness line. `revision` is the engine's git
 * commit, or 'unrecorded'. Pure.
 */
export function route(r, { mode = 'live', revision = 'unrecorded' } = {}) {
  if (!r?.signed || !r.enabled) return { enforce: false, line: null };
  if (r.ready === true && r.signed === true && r.enabled === true) {
    const until = oldRouteRemovableFrom();
    return { enforce: true, line: `Switch route: enforcing. Every crew lint finding that names a proposal holds it, and the held proposal is left out of this report; the old route stays in code ${until ? `until ${until}` : `for ${OLD_ROUTE_DAYS} days after the switch`}.` };
  }
  const rev = shortRev(revision);
  const why = missing(r).join(', ');
  const tail = mode !== 'live' ? 'in shadow beside the old route; a synthetic run is never a proof run'
    : rev ? `${PROOF_MARK}${rev}` : 'in shadow beside the old route; its engine revision is unrecorded, so this run cannot count as a proof run';
  return { enforce: false, line: `Switch route: the signed spec enables it, but readiness is not met (${why}), so the crew stays ${tail}.` };
}

/**
 * The crew's findings, enforced: each proposal a finding names is held
 * (counted by lint, never by id or name) and left out, except his own
 * signing asks (`exempt`). Pure.
 */
export function enforce({ proposals, findings, exempt = () => false }) {
  const ids = new Set(proposals.map(p => p.proposal_id));
  const byLint = new Map(), held = new Set();
  for (const f of findings) {
    if (typeof f?.proposal_id !== 'string' || !ids.has(f.proposal_id) || exempt(f.proposal_id)) continue;
    held.add(f.proposal_id);
    if (!byLint.has(f.lint)) byLint.set(f.lint, { specialist: f.specialist ?? null, ids: new Set() });
    byLint.get(f.lint).ids.add(f.proposal_id);
  }
  const holds = [...byLint].sort((a, b) => b[1].ids.size - a[1].ids.size || a[0].localeCompare(b[0])).map(([lint, { specialist, ids: s }]) => ({
    reason: lint,
    detail: `${s.size} proposal${s.size === 1 ? '' : 's'} held by the crew's ${lint} lint${specialist ? ` (${specialist})` : ''} and left out of this report.`
  }));
  return { kept: proposals.filter(p => !held.has(p.proposal_id)), holds, held: held.size };
}

/**
 * Why the old route may not be removed yet, as a list of problems; empty when
 * it is still in place or its 30 days are over. `today` is a London date,
 * `shadowLine` the crew lint line crewShadow writes by default. Pure: the
 * check script passes in the modules it read.
 */
export function oldRouteErrors({ today, switchedOn = SWITCHED_ON, routeFn = route, shadowLine, dispatchSource = null }) {
  const errors = [];
  if (OLD_ROUTE_DAYS !== 30) errors.push('OLD_ROUTE_DAYS is not 30 (plan section 8)');
  if (PROOF_RUNS_NEEDED !== 5) errors.push('PROOF_RUNS_NEEDED is not 5 (plan section 8)');
  if (switchedOn !== null && oldRouteRemovableFrom(switchedOn) === null) errors.push('SWITCHED_ON is not a London date');
  if (switchedOn !== null && typeof today === 'string' && switchedOn > today) errors.push('SWITCHED_ON is in the future: it is the date the first enforcing run read back');
  const until = oldRouteRemovableFrom(switchedOn);
  if (until && typeof today === 'string' && today >= until) return errors;
  const where = until ? `until ${until}` : `until ${OLD_ROUTE_DAYS} days after the switch`;
  const ok = { era: true, source: 'signed', spec: { enabled: true } };
  const notReady = { signed: true, enabled: true, proof: { count: 0, reason: null }, shadow: true, measured: false, ready: false };
  const cases = [
    ['an unsigned spec', readiness({ week: { era: true, source: 'default', spec: null }, proofRuns: { count: PROOF_RUNS_NEEDED } })],
    ["last week's spec carried on", readiness({ week: { ...ok, source: 'last_signed' }, proofRuns: { count: PROOF_RUNS_NEEDED } })],
    ['a signed spec that does not enable it', readiness({ week: { ...ok, spec: { enabled: false } }, proofRuns: { count: PROOF_RUNS_NEEDED } })],
    ['a readiness not met', notReady]
  ];
  for (const [name, r] of cases) if (routeFn(r, { mode: 'live', revision: 'a'.repeat(40) }).enforce !== false) errors.push(`the old route stays in code ${where}: ${name} must still run in shadow`);
  if (typeof shadowLine !== 'string' || !shadowLine.includes('Nothing is held by them until the switch')) errors.push(`the old route stays in code ${where}: the crew's default lint line must still say nothing is held`);
  // The dispatch holds a proposal only through the route's decision: one call to enforce, inside `if (way.enforce)`.
  if (dispatchSource !== null) {
    const gate = dispatchSource.indexOf('if (way.enforce) {'), call = dispatchSource.indexOf('enforce({');
    if (!/const way = route\(/.test(dispatchSource) || gate < 0 || dispatchSource.split('enforce({').length !== 2 || call < gate) errors.push(`the old route stays in code ${where}: src/dispatch.mjs must hold proposals only inside \`if (way.enforce)\`, from route()`);
  }
  return errors;
}
