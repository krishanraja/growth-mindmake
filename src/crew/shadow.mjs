/**
 * The crew, run in shadow on every dispatch (plan sections 3 and 8, Phase 3).
 *
 * Every specialist's lint reads the proposals this run is about to report,
 * and every measured check reads what Control Center served. Until the Phase
 * 5 switch nothing they find holds or hides a proposal: the run reports one
 * line of lint counts by lint id, and one line of measurements, and today's
 * route works unchanged. crew/index.json names who owns which lint and check.
 *
 * Pure but for reading library/taxonomy.json once at load.
 */
import { readFile } from 'node:fs/promises';
import { lessons } from '../stages/rows.mjs';
import { pitchedStages, invitedGuests } from '../stages/pitches.mjs';
import { bookedStages } from '../stages/shownotes.mjs';
import * as network from './lints/network.mjs';
import * as multiplier from './lints/multiplier.mjs';
import * as visibility from './lints/visibility.mjs';
import * as stages from './lints/stages.mjs';
import * as signals from './lints/signals.mjs';
import * as trust from './lints/trust.mjs';
import * as measurement from './lints/measurement.mjs';
import * as librarian from './lints/librarian.mjs';
import * as guard from './lints/guard.mjs';
import * as networkChecks from './checks/network.mjs';
import * as multiplierChecks from './checks/multiplier.mjs';
import * as visibilityChecks from './checks/visibility.mjs';
import * as stagesChecks from './checks/stages.mjs';
import * as signalsChecks from './checks/signals.mjs';
import * as trustChecks from './checks/trust.mjs';
import * as measurementChecks from './checks/measurement.mjs';
import * as librarianChecks from './checks/librarian.mjs';
import * as guardChecks from './checks/guard.mjs';

/** Every specialist's lint module, in the order crew/index.json lists them. */
export const LINT_MODULES = [network, multiplier, visibility, stages, signals, trust, measurement, librarian, guard];
/** Every specialist's measured checks. */
export const CHECK_MODULES = [networkChecks, multiplierChecks, visibilityChecks, stagesChecks, signalsChecks, trustChecks, measurementChecks, librarianChecks, guardChecks];
/** The prefix both crew lines start with, so a reader (and the golden test) can tell them apart from today's lines. */
export const CREW_LINE = /^Crew (?:lints|checks), /;
export const TAXONOMY = JSON.parse(await readFile(new URL('../../library/taxonomy.json', import.meta.url), 'utf8'));

const list = v => (Array.isArray(v) ? v : []);
const byId = (rows, key) => { const m = new Map(); for (const r of rows) { const k = typeof r?.[key] === 'string' ? r[key] : null; if (k) { m.set(k, r); m.set(k.toLowerCase(), r); } } return m; };

/** What every lint reads: the context's people, stages and guests by id, his lessons, and what was already pitched, invited or booked. Pure. */
export function crewContext({ context = null, canon = null, research = null, at }) {
  const c = context ?? {};
  const people = byId([...list(c.network), ...list(c.quiet_ties), ...list(c.amplifier_candidates)], 'contact_id');
  const companies = byId(list(c.companies), 'domain');
  const all = research ?? list(c.research);
  return {
    at, canon, research: all, routes: c.routes ?? {}, people,
    stages: byId(list(c.records?.visibility), 'id'), guests: byId(list(c.records?.guests), 'contact_id'),
    L: lessons(c.feedback, at), pitched: pitchedStages(c), invited: invitedGuests(c), booked: bookedStages(c),
    // The other record prose a card may draw on: a profile Control Center answered, and the company's why_now.
    extraRecords: id => {
      if (!id) return [];
      const profile = all.filter(r => r?.kind === 'question' && r.status === 'answered' && typeof r.request_id === 'string' && r.request_id.startsWith(`profile:${id}:`)).map(r => r.answer);
      const company = companies.get(String(people.get(id)?.contacts?.company_domain ?? '').toLowerCase())?.why_now;
      return [...profile, company].filter(x => typeof x === 'string');
    }
  };
}

/** Every lint finding for the proposals of one run, with the specialist that owns it. Pure. */
export function lintAll(proposals, ctx, spec) {
  const out = [];
  for (const p of proposals) for (const m of LINT_MODULES) if (m !== librarian && m.applies(p)) for (const f of m.lint(p, ctx, spec)) out.push({ specialist: m.SPECIALIST, ...f });
  return out;
}

/**
 * The crew's two lines for this run: lint findings counted by lint id, in
 * shadow, and the measured checks. Nothing is held. Pure.
 */
export function crewShadow({ proposals = [], context = null, canon = null, research = null, at, caps = null, constraints = null, objectives = [], activity = [], origin_candidates = null, taps = null, lastWeek = null, londonDate = null }) {
  const ctx = crewContext({ context, canon, research, at });
  const findings = [
    ...lintAll(proposals, ctx, caps),
    ...measurement.lintReport({ objectives, activity, origin_candidates }).map(f => ({ specialist: measurement.SPECIALIST, ...f })),
    ...guard.lintRun({ proposals, constraints }).map(f => ({ specialist: guard.SPECIALIST, ...f }))
  ];
  const counts = new Map();
  for (const f of findings) counts.set(f.lint, (counts.get(f.lint) ?? 0) + 1);
  const tally = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k} ${v}`).join(', ');
  const lintLine = `Crew lints, in shadow: read ${proposals.length} proposal${proposals.length === 1 ? '' : 's'}; ${findings.length ? `${findings.length} finding${findings.length === 1 ? '' : 's'} (${tally})` : 'no findings'}. Nothing is held by them until the switch (plan Phase 5).`;
  const input = { context, at, taps, lastWeek, londonDate, origin_candidates, taxonomy: TAXONOMY, proposals, constraints, findings };
  const measurements = CHECK_MODULES.flatMap(m => m.measure(input).map(x => ({ specialist: m.SPECIALIST, ...x })));
  const known = measurements.filter(m => m.value !== null);
  const checkLine = `Crew checks, measured after acting: ${known.length ? known.map(m => `${m.check} ${m.value}`).join(', ') : 'none measured yet'}; ${measurements.length - known.length} not measured yet, none of them read as zero.`;
  return { findings, measurements, lines: [lintLine, checkLine] };
}
