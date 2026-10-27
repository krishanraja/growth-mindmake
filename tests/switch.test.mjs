import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readiness, readinessLine, route, enforce, proofRunsFrom, isProofRun, proofRevision, oldRouteErrors, oldRouteRemovableFrom, readProofRuns, PROOF_RUNS_NEEDED, OLD_ROUTE_DAYS, SWITCHED_ON, SWITCH_LINE, PROOF_MARK, PROOF_RUNS_UNREADABLE } from '../src/crew/switch.mjs';
import { crewShadow, lintLineFor } from '../src/crew/shadow.mjs';
import { compile, WEEK_SCHEMA } from '../src/crew/compile.mjs';
import { runDispatch, payloadDigest, schemaErrors } from '../src/dispatch.mjs';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { capsContext, capsReport } from './support/caps-scenario.mjs';

// The Phase 5 switch (plan section 8): readiness every run, the new route
// behind the signed spec's `enabled`, and the old route kept 30 days after.
// Synthetic people, shows and ids only.
const root = new URL('../', import.meta.url);
const policy = JSON.parse(await readFile(new URL('config/policy.json', root), 'utf8'));
const WEEK = '2026-11-09';
const AT = '2026-11-10T09:00:00.000Z';
const REV = 'c'.repeat(40);
const lines = report => report.activity.map(a => a.line);
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you'll need. |\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };

// One live dispatch run of the caps fixture (every row, pitches and forms) in the week of 9 November.
let runs = 0;
async function run({ decisions = [], proofReader, revision = REV, at = AT, specReader = async () => null } = {}) {
  const reports = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { ...capsContext(), observed_at: at } }),
    decisions: async () => decisions, postReport: async rep => { reports.push(rep); return { replayed: false }; },
    readReport: async id => { const r = reports.find(x => x.run_id === id); if (!r) { const e = new Error('not found'); e.status = 404; throw e; } return { accepted: true, run_id: id, payload_sha256: r.payload_sha256, mode: r.mode, report: r }; }
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, kind: `switch-${++runs}`, attemptId: `gma-switch-run-${String(runs).padStart(4, '0')}`, clock: () => at, revision, specReader,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null, ...(proofReader ? { proofReader } : {}) });
  return { result, report: reports[0] ?? null };
}

// His version of this week's spec: the route enabled, and last week's good meetings typed in, so the number is measured.
async function hisVersion({ enabled = true, total = 2, at = AT } = {}) {
  const { report } = await run({ at });
  const ask = report.proposals.find(p => p.proposal_id === `gms-${WEEK}`);
  assert.ok(ask, 'the spec is on his list');
  const spec = JSON.parse(ask.exact_payload);
  if (enabled !== undefined) spec.enabled = enabled;
  spec.last_week.good_meetings_total = total;
  const exact_payload = JSON.stringify(spec);
  return { proposal_id: ask.proposal_id, decision: 'approved', decided_at: '2026-11-10T08:00:00Z', payload_sha256: ask.payload_sha256, stage: 'plan', amended: true, exact_payload, amount_usd: null, amended_sha256: payloadDigest({ amount_usd: null, exact_payload }) };
}
const five = async () => ({ count: PROOF_RUNS_NEEDED, reason: null });

test('the default spec reports one readiness line and nothing else changes: no route line, no hold, no proposal left out', async () => {
  const policyRun = await capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy });
  const switchLines = lines(policyRun.report).filter(l => SWITCH_LINE.test(l));
  assert.deepEqual(switchLines, [`Switch readiness: signed spec no; proof runs unknown of 5 (${PROOF_RUNS_UNREADABLE}); shadow reported yes; number measured no.`]);
  assert.match(lines(policyRun.report).find(l => l.startsWith('Crew lints')), /Nothing is held by them until the switch/);
  assert.equal(policyRun.report.proposals.length, 22, 'every proposal the crew read is still reported');
  assert.equal(policyRun.report.holds.some(h => h.reason.includes('.') || h.reason === 'card_grammar'), false, 'no crew hold');
  // The readiness line is the last line but one, before the closing line, so the golden test leaves it out and nothing else.
  assert.equal(lines(policyRun.report).at(-2), switchLines[0]);
  assert.doesNotMatch(JSON.stringify(policyRun.result), /Switch|readiness/, 'the printed result carries no line');
});

test('the week spec gains enabled as an optional field: absent in the default, a boolean when set, and it compiles', async () => {
  const props = WEEK_SCHEMA.properties;
  assert.equal(props.enabled.type, 'boolean');
  assert.equal(WEEK_SCHEMA.required.includes('enabled'), false, 'add-only: every earlier spec still fits');
  const example = JSON.parse(await readFile(new URL('specs/examples/week.synthetic.json', root), 'utf8'));
  assert.equal('enabled' in example, false);
  assert.deepEqual(schemaErrors(WEEK_SCHEMA, { ...example, enabled: true }), []);
  assert.ok(schemaErrors(WEEK_SCHEMA, { ...example, enabled: 'yes' }).length > 0, 'only a boolean');
  assert.equal(compile({ ...example, enabled: true }, policy, { weekOf: example.week_of }).ok, true);
  assert.equal(WEEK_SCHEMA.properties.experiment.properties.change.properties.field.enum.includes('enabled'), false, 'no experiment can switch it');
  const { report } = await run();
  const ask = report.proposals.find(p => p.proposal_id === `gms-${WEEK}`);
  assert.equal('enabled' in JSON.parse(ask.exact_payload), false, 'the spec posted for him to sign leaves it out: today\'s route');
});

test('readiness: only this week\'s signed spec counts, never last week\'s carried on, today\'s settings or an unsigned one', () => {
  const objectives = [{ key: 'good_meetings', value: 3, availability: 'measured' }];
  const activity = crewShadow({ proposals: [], at: AT }).lines;
  const proofRuns = { count: 5, reason: null };
  const signed = { era: true, source: 'signed', spec: { enabled: true } };
  assert.equal(readiness({ week: signed, objectives, activity, proofRuns }).ready, true);
  for (const source of ['last_signed', 'default', 'today']) {
    const r = readiness({ week: { ...signed, source }, objectives, activity, proofRuns });
    assert.deepEqual([r.signed, r.enabled, r.ready], [false, false, false], source);
    assert.equal(route(r, { revision: REV }).enforce, false, source);
  }
  assert.equal(readiness({ week: { ...signed, era: false }, objectives, activity, proofRuns }).ready, false, 'before the spec era');
  assert.equal(readiness({ week: { ...signed, spec: { enabled: false } }, objectives, activity, proofRuns }).ready, false);
  assert.equal(readiness({ week: { ...signed, spec: {} }, objectives, activity, proofRuns }).enabled, false, 'absent is off');
  assert.equal(readiness({ week: signed, objectives, activity, proofRuns: { count: 4, reason: null } }).ready, false, 'four proof runs are not five');
  assert.equal(readiness({ week: signed, objectives, activity, proofRuns: { count: null, reason: 'x' } }).ready, false, 'unknown is never ready');
  assert.equal(readiness({ week: signed, objectives: [{ key: 'good_meetings', value: null, availability: 'missing' }], activity, proofRuns }).ready, false, 'the number not measured');
  assert.equal(readiness({ week: signed, objectives, activity: [], proofRuns }).ready, false, 'no shadow lines');
  assert.equal(readinessLine(readiness({ week: signed, objectives, activity, proofRuns })), 'Switch readiness: signed spec yes, route enabled; proof runs 5 of 5; shadow reported yes; number measured yes.');
  assert.equal(readinessLine(readiness({ week: { ...signed, spec: {} }, objectives: [], activity, proofRuns: { count: 0, reason: null } })), 'Switch readiness: signed spec yes, route not enabled; proof runs 0 of 5; shadow reported yes; number measured no.');
});

test('the route: off says nothing, enabled but not ready stays in shadow and says why, ready enforces', () => {
  const off = route({ signed: true, enabled: false, ready: false }, { revision: REV });
  assert.deepEqual(off, { enforce: false, line: null });
  const notReady = { signed: true, enabled: true, proof: { count: 2, reason: null }, shadow: true, measured: false, ready: false };
  const live = route(notReady, { mode: 'live', revision: REV });
  assert.equal(live.enforce, false);
  assert.equal(live.line, `Switch route: the signed spec enables it, but readiness is not met (2 of 5 proof runs, the number not measured), so the crew stays ${PROOF_MARK}ccccccc.`);
  assert.match(route(notReady, { mode: 'synthetic', revision: REV }).line, /a synthetic run is never a proof run\.$/);
  assert.match(route(notReady, { mode: 'live', revision: 'unrecorded' }).line, /its engine revision is unrecorded, so this run cannot count as a proof run\.$/);
  assert.doesNotMatch(route(notReady, { mode: 'live', revision: 'unrecorded' }).line, new RegExp(PROOF_MARK));
  const on = route({ ...notReady, proof: { count: 5, reason: null }, measured: true, ready: true }, { revision: REV });
  assert.equal(on.enforce, true);
  assert.match(on.line, /^Switch route: enforcing\. .* the old route stays in code for 30 days after the switch\.$/);
  // A forged readiness (ready without a signed, enabled spec) never enforces.
  assert.equal(route({ signed: false, enabled: true, ready: true }).enforce, false);
  assert.equal(route({ signed: true, enabled: false, ready: true }).enforce, false);
});

test('enforce holds each named proposal once, counted by lint and never by id, and never his own signing asks', () => {
  const proposals = ['row-a', 'row-b', 'row-c', 'gms-2026-11-09', 'gmg-2026-11-02'].map(proposal_id => ({ proposal_id }));
  const findings = [
    { lint: 'card_grammar', proposal_id: 'row-a', specialist: 'network-steward' }, { lint: 'network.route', proposal_id: 'row-a', specialist: 'network-steward' },
    { lint: 'card_grammar', proposal_id: 'row-b', specialist: 'visibility-producer' }, { lint: 'guard.constraints', proposal_id: null },
    { lint: 'measurement.link_canon', proposal_id: 'gms-2026-11-09' }, { lint: 'guard.spend_zero', proposal_id: 'gmg-2026-11-02' }, { lint: 'card_grammar', proposal_id: 'not-in-report' }
  ];
  const out = enforce({ proposals, findings, exempt: id => id.startsWith('gms-') || id.startsWith('gmg-') });
  assert.deepEqual(out.kept.map(p => p.proposal_id), ['row-c', 'gms-2026-11-09', 'gmg-2026-11-02']);
  assert.equal(out.held, 2);
  assert.deepEqual(out.holds.map(h => h.reason), ['card_grammar', 'network.route']);
  assert.equal(out.holds[0].detail, "2 proposals held by the crew's card_grammar lint (network-steward) and left out of this report.");
  assert.doesNotMatch(JSON.stringify(out.holds), /row-a|row-b/, 'a hold names no proposal');
});

test('proof runs: consecutive live runs at one engine revision, read from stored reports; unknown until Control Center serves them', async () => {
  const proofLine = rev => `Switch route: the signed spec enables it, but readiness is not met (0 of 5 proof runs), so the crew stays ${PROOF_MARK}${rev}.`;
  const stored = ({ mode = 'live', status = 'held', rev = 'ccccccc', crew = true } = {}) => ({ accepted: true, mode, report: { mode, status, activity: [...(crew ? crewShadow({ proposals: [], at: AT }).lines : []), proofLine(rev)].map(line => ({ line, evidence_url: null })) } });
  assert.equal(isProofRun(stored()), true);
  assert.equal(proofRevision(stored().report), 'ccccccc');
  for (const bad of [stored({ mode: 'synthetic' }), stored({ status: 'degraded' }), stored({ crew: false })]) assert.equal(isProofRun(bad), false);
  assert.deepEqual(proofRunsFrom([stored(), stored(), stored(), stored(), stored(), stored()], { revision: REV }), { count: 6, reason: null });
  assert.deepEqual(proofRunsFrom([stored(), stored(), stored({ rev: 'ddddddd' }), stored(), stored()], { revision: REV }), { count: 2, reason: null }, 'a merge between them ends the count');
  assert.deepEqual(proofRunsFrom([stored(), stored({ status: 'degraded' }), stored()], { revision: REV }), { count: 1, reason: null });
  assert.deepEqual(proofRunsFrom([stored()], { revision: 'unrecorded' }), { count: 0, reason: 'this run has no recorded engine revision' });
  assert.equal(proofRunsFrom(null, { revision: REV }).count, null);
  assert.deepEqual(await readProofRuns(), { count: null, reason: PROOF_RUNS_UNREADABLE });
});

test('enabled by his signed version but not ready: the crew stays in shadow, says why, and the report keeps every proposal', async () => {
  const signed = await hisVersion();
  const base = await run({ decisions: [] });
  const { result, report } = await run({ decisions: [signed] });
  assert.equal(result.status, 'succeeded');
  const l = lines(report);
  assert.match(l.find(x => x.startsWith('Week spec')), /signed by his version/);
  assert.equal(l.find(x => x.startsWith('Switch readiness')), `Switch readiness: signed spec yes, route enabled; proof runs unknown of 5 (${PROOF_RUNS_UNREADABLE}); shadow reported yes; number measured yes.`);
  assert.equal(l.find(x => x.startsWith('Switch route')), `Switch route: the signed spec enables it, but readiness is not met (proof runs unknown), so the crew stays ${PROOF_MARK}ccccccc.`);
  assert.match(l.find(x => x.startsWith('Crew lints')), /Nothing is held by them until the switch/);
  const rows = rep => rep.proposals.filter(p => p.row).map(p => p.proposal_id).sort();
  assert.deepEqual(rows(report), rows(base.report), 'every row proposal the run without the spec reports');
  assert.equal(report.holds.some(h => h.reason === 'multiplier.beyond_linkedin'), false);
});

test('enforcing: his signed version enables it, five proof runs read back and the number is measured, so named findings hold their proposals', async () => {
  const signed = await hisVersion();
  const shadow = await run({ decisions: [signed] });
  const { result, report } = await run({ decisions: [signed], proofReader: five });
  assert.equal(result.status, 'succeeded');
  const l = lines(report);
  assert.equal(l.find(x => x.startsWith('Switch readiness')), 'Switch readiness: signed spec yes, route enabled; proof runs 5 of 5; shadow reported yes; number measured yes.');
  assert.match(l.find(x => x.startsWith('Switch route')), /^Switch route: enforcing\./);
  assert.match(l.find(x => x.startsWith('Crew lints')), /^Crew lints, enforcing: read 22 proposals; 5 findings \(multiplier\.beyond_linkedin 4, guard\.constraints 1\)\. Each finding that names a proposal holds it/);
  const hold = report.holds.find(h => h.reason === 'multiplier.beyond_linkedin');
  assert.equal(hold.detail, "4 proposals held by the crew's multiplier.beyond_linkedin lint (multiplier-steward) and left out of this report.");
  assert.equal(report.proposals.length, shadow.report.proposals.length - 4, 'the four named proposals are left out');
  assert.equal(report.holds.some(h => h.reason === 'guard.constraints'), false, 'a finding over the whole run names no proposal and holds nothing');
  assert.equal(report.status, 'held');
  // Every proposal left out is one the crew named; every one kept is in the shadow run too.
  const kept = new Set(report.proposals.map(p => p.proposal_id));
  assert.ok([...kept].every(id => shadow.report.proposals.some(p => p.proposal_id === id)));
});

test('never from an unsigned spec: a proposed file that enables it, or last week\'s enabled spec carried on, stays in shadow with five proof runs', async () => {
  // A proposed spec file with enabled: true, not signed: posted for his Clear, never enforced.
  const signed = await hisVersion();
  const file = signed.exact_payload;
  const unsigned = await run({ decisions: [], proofReader: five, specReader: async w => (w === WEEK ? file : null) });
  assert.equal(unsigned.result.status, 'succeeded');
  assert.match(lines(unsigned.report).find(x => x.startsWith('Crew lints')), /multiplier\.beyond_linkedin 4/, 'the crew found what it would hold');
  const l = lines(unsigned.report);
  assert.match(l.find(x => x.startsWith('Switch readiness')), /^Switch readiness: signed spec no; proof runs 5 of 5;/);
  assert.equal(l.some(x => x.startsWith('Switch route')), false);
  assert.match(l.find(x => x.startsWith('Crew lints')), /Nothing is held by them until the switch/);
  assert.equal(unsigned.report.holds.some(h => h.reason === 'multiplier.beyond_linkedin'), false);
  // The next week: his signed enabled spec for 9 November carries on as the fallback, and the fallback never enforces.
  const nextWeek = await run({ decisions: [signed], proofReader: five, at: '2026-11-17T09:00:00.000Z' });
  assert.equal(nextWeek.result.status, 'succeeded');
  const n = lines(nextWeek.report);
  assert.match(n.find(x => x.startsWith('Crew lints')), /multiplier\.beyond_linkedin 4/);
  assert.match(n.find(x => x.startsWith('Week spec')), /stays in force, up to 7 days/);
  assert.match(n.find(x => x.startsWith('Switch readiness')), /^Switch readiness: signed spec no;/);
  assert.equal(nextWeek.report.holds.some(h => h.reason === 'multiplier.beyond_linkedin'), false);
});

test('a reader that fails reads as unknown, never as proof', async () => {
  const signed = await hisVersion();
  const { result, report } = await run({ decisions: [signed], proofReader: async () => { throw new Error('down'); } });
  assert.equal(result.status, 'succeeded');
  assert.match(lines(report).find(x => x.startsWith('Switch readiness')), /proof runs unknown of 5 \(the past reports could not be read\)/);
  assert.equal(report.holds.some(h => h.reason === 'multiplier.beyond_linkedin'), false);
});

test('the old route stays in code for 30 days after the switch, and its check refuses removing it earlier', async () => {
  assert.equal(OLD_ROUTE_DAYS, 30);
  assert.equal(SWITCHED_ON, null, 'not switched: the date is set by the pull request that reads back the first enforcing run');
  assert.equal(oldRouteRemovableFrom('2026-11-30'), '2026-12-30');
  assert.equal(oldRouteRemovableFrom(null), null);
  const dispatchSource = await readFile(new URL('src/dispatch.mjs', root), 'utf8');
  const shadowLine = crewShadow({ proposals: [], at: AT }).lines[0];
  assert.deepEqual(oldRouteErrors({ today: '2026-11-10', shadowLine, dispatchSource }), []);
  // Removing the old route: a route that always enforces, a crew line that holds by default, or a dispatch that holds outside the gate.
  const always = () => ({ enforce: true, line: '' });
  assert.ok(oldRouteErrors({ today: '2026-11-10', routeFn: always, shadowLine, dispatchSource }).length >= 4);
  assert.ok(oldRouteErrors({ today: '2026-12-01', switchedOn: '2026-11-30', routeFn: always, shadowLine, dispatchSource }).some(e => /until 2026-12-30/.test(e)), 'refused inside the 30 days');
  assert.deepEqual(oldRouteErrors({ today: '2026-12-30', switchedOn: '2026-11-30', routeFn: always, shadowLine: lintLineFor({ read: 0, findings: 0, tally: '', enforcing: true }), dispatchSource: '' }), [], 'allowed from day 30');
  assert.ok(oldRouteErrors({ today: '2026-11-10', shadowLine: lintLineFor({ read: 0, findings: 0, tally: '', enforcing: true }), dispatchSource }).length === 1);
  assert.ok(oldRouteErrors({ today: '2026-11-10', shadowLine, dispatchSource: dispatchSource.replace('if (way.enforce) {', 'if (true) {') }).length === 1);
  assert.ok(oldRouteErrors({ today: '2026-11-10', switchedOn: '2026-11-30', shadowLine, dispatchSource }).some(e => /in the future/.test(e)));
});
