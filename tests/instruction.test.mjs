import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { engineClient } from '../src/control-center.mjs';
import { runDispatch, readDirective, NORTH_STAR_TEXT, acksAnswer } from '../src/dispatch.mjs';
import { readInstruction, takesEngineState, unquotable, rowGoals, instructionSeen, instructionWork, priorities, obsessions, nextSteps, engineState, stateLine, carriesContact, longDate, isoDate, ENGINE_STATE_KEYS } from '../src/stages/instruction.mjs';
import { startProtocolService, directiveFixture, violations } from './support/engine-protocol-service.mjs';
import { AT, POLICY, snapshot } from './helpers.mjs';

// Synthetic only: an invented instruction id and words. The words are a stand-in for his; no test prints them.
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const directiveSchema = JSON.parse(await readFile(new URL('../docs/control-center/engine-directive.schema.json', import.meta.url), 'utf8'));
const registry = JSON.parse(await readFile(new URL('../config/campaigns.json', import.meta.url), 'utf8'));
const KI = `ki_${'a1'.repeat(12)}`;
const KI2 = `ki_${'b2'.repeat(12)}`;
const WORDS = 'Synthetic instruction: get Krish booked onto two podcasts this week.';
const given = (changes = {}) => ({ id: KI, words: WORDS, given_at: '2026-10-19T04:00:00Z', given_by: 'krish', supersedes: null, ...changes });
const FEATURES = { engine_state: true, krish_instruction: true };
const at1_20 = (changes = {}) => directiveFixture({ schema_version: '1.20.0', features: FEATURES, krish_instruction: given(), ...changes });
const FILES = async () => ({
  getGoing: '## The build\n\n- [x] **Step 1.** Done already.\n- [ ] **Phase 9.** Prove the synthetic route on real runs. Progress: more words.\n- [ ] **Phase 10.** Later.\n',
  now: '# Engine\n\n## What is next and what is waiting on Krish\n\n- **Older:** not a next step.\n- **Next:** read the synthetic report; Krish signs the synthetic spec on 2026-10-26; the Codex session finishes the synthetic card. Waiting on Krish: the synthetic setting (a, b and c), and the other synthetic setting.\n\n### Gates\n\n- not read\n'
});

let n = 0;
const attemptId = () => `gma-instruction-${String(++n).padStart(8, '0')}`;
const bridge = service => engineClient(service.origin, service.token, { fetcher: service.fetcher });
const run = (service, options = {}) => runDispatch({ cc: bridge(service), source: async () => ({ snapshot: snapshot() }), policy: POLICY, registry, mode: 'synthetic', kind: 'synthetic', attemptId: attemptId(), clock: () => AT, stateReader: FILES, ...options });
const posted = service => service.requests.filter(r => r.method === 'POST' && r.route === 'reports').map(r => r.body);
const noWords = (value, what) => assert.equal(JSON.stringify(value).includes('get Krish booked'), false, `${what} never carries his words`);

test('the directive schema copied from Control Center carries krish_instruction and features, and the fixture fits it', () => {
  assert.ok(directiveSchema.properties.krish_instruction && directiveSchema.properties.features);
  // The fixture is older than some directive fields; only the 1.20.0 ones are checked here.
  const new120 = d => violations(directiveSchema, d).filter(v => /krish_instruction|features/.test(v));
  assert.deepEqual(new120(at1_20().directive), []);
  assert.deepEqual(new120(at1_20({ krish_instruction: null }).directive), []);
  assert.notDeepEqual(new120(at1_20({ krish_instruction: { ...given(), given_by: 'rule' } }).directive), [], 'the copied schema refuses an instruction not his');
  for (const k of ENGINE_STATE_KEYS) assert.ok(schema.properties[k], `the report schema carries ${k}`);
  assert.ok(schema.properties.schema_version.enum.includes('1.20.0'));
});

test('an instruction is read with its id and a digest; none, absent and malformed are told apart, and any 1.x directive still reads', () => {
  const open = readInstruction(given());
  assert.equal(open.state, 'open');
  assert.equal(open.instruction.id, KI);
  assert.equal(open.instruction.sha256, createHash('sha256').update(WORDS).digest('hex'));
  assert.equal(readInstruction(null).state, 'none');
  assert.equal(readInstruction(undefined).state, 'absent');
  assert.deepEqual(readInstruction(given({ given_by: 'control_center' })), { state: 'unreadable', instruction: null, id: KI }, 'only his own instruction is his');
  assert.deepEqual(readInstruction(given({ words: '' })), { state: 'unreadable', instruction: null, id: KI });
  assert.deepEqual(readInstruction(given({ words: 'x'.repeat(2001) })), { state: 'unreadable', instruction: null, id: KI });
  assert.equal(readInstruction(given({ id: 'ki_short' })).id, null, 'a malformed id is never answered by');
  assert.equal(readInstruction(given({ supersedes: KI2 })).instruction.supersedes, KI2);
  const d = readDirective(at1_20());
  assert.equal(d.engine_state, true);
  assert.equal(d.instruction.state, 'open');
  const older = readDirective(directiveFixture());
  assert.equal(older.engine_state, false, 'a directive before 1.20.0 serves no engine state');
  assert.equal(older.instruction.state, 'absent');
  assert.equal(readDirective(directiveFixture({ schema_version: '1.27.0' })).instruction.state, 'absent', 'a later 1.x still reads');
});

test('his words go before the week goals in memory, only when a row can quote them', () => {
  const goals = ['Goal one about partners', 'Goal two about a warm lead'];
  const ok = readInstruction(given()).instruction;
  assert.deepEqual(rowGoals(ok, goals), [WORDS, ...goals]);
  assert.deepEqual(rowGoals(null, goals), goals);
  for (const [words, why] of [['x'.repeat(301), 'too_long'], ['Line one\nline two', 'not_one_line'], ['Write to someone at someone@example.test', 'carries_contact'], ['Ring 020 7946 0000 today', 'carries_contact']]) {
    const i = readInstruction(given({ words })).instruction;
    assert.equal(unquotable(i), why);
    assert.deepEqual(rowGoals(i, goals), goals, 'a row never quotes what it may not');
  }
  assert.equal(unquotable(ok), null);
});

test('the acks: received once, then started when rows ran with it first, blocked with why otherwise, never done and never his words', () => {
  const read = readInstruction(given());
  const rows = [{ row: 'visibility', serves: WORDS }, { row: 'partners', serves: 'Goal one' }, { proposal_id: 'gms-x' }];
  const first = instructionWork({ read, rowsRan: true, proposals: rows, seen: false, receivedAt: AT, at: AT });
  assert.deepEqual(first.acks.map(a => a.state), ['received', 'started']);
  assert.match(first.acks[1].line, /^Started: this run ranked its rows with it first, and 1 of 2 rows say they serve it\./);
  assert.match(first.activity, new RegExp(`^Received Krish's instruction ${KI} \\(sha256 [0-9a-f]{12}\\) and put it first in this run's work\\.`));
  assert.deepEqual(first.outcome, { id: KI, sha256: read.instruction.sha256, acks: ['received', 'started'], serving: 1 });
  noWords(first, 'the work');
  for (const a of first.acks) { assert.ok(a.line.length <= 280 && !carriesContact(a.line)); assert.equal(a.evidence_url, null); assert.notEqual(a.state, 'done'); }
  const again = instructionWork({ read, rowsRan: true, proposals: rows, seen: true, receivedAt: AT, at: AT });
  assert.deepEqual(again.acks.map(a => a.state), ['started'], 'a later run does not say received again');
  assert.match(again.activity, new RegExp(`^Krish's instruction ${KI} \\(sha256 [0-9a-f]{12}\\) is first again this run\\.`));
  const blocked = (o, re) => { const w = instructionWork({ read, rowsRan: true, proposals: rows, seen: false, receivedAt: AT, at: AT, ...o }); assert.equal(w.acks.at(-1).state, 'blocked'); assert.match(w.acks.at(-1).line, re); return w; };
  blocked({ held: true }, /^Engine held: /);
  blocked({ rowsRan: false }, /served no people or stages/);
  blocked({ read: readInstruction(given({ words: 'x'.repeat(400) })) }, /longer than the 300 characters/);
  const malformed = instructionWork({ read: readInstruction(given({ given_by: 'someone' })), receivedAt: AT, at: AT });
  assert.deepEqual(malformed.acks.map(a => a.state), ['received', 'blocked']);
  const noId = instructionWork({ read: readInstruction({ words: WORDS }), receivedAt: AT, at: AT });
  assert.deepEqual(noId.acks, [], 'nothing to answer by');
  assert.equal(instructionWork({ read: readInstruction(null) }), null);
  assert.equal(instructionWork({ read: readInstruction(undefined) }), null);
});

test('an earlier report names the instruction in its first line, which is how a later run knows it was received', () => {
  assert.equal(instructionSeen([{ activity: [{ line: `Received Krish's instruction ${KI} (sha256 abc) and put it first.` }] }], KI), true);
  assert.equal(instructionSeen([{ activity: [`Krish's instruction ${KI} is first again this run.`] }], KI), true);
  assert.equal(instructionSeen([{ activity: [{ line: `Received Krish's instruction ${KI2}.` }] }], KI), false);
  assert.equal(instructionSeen(null, KI), false, 'unknown history is not seen, so received goes again and Control Center counts it stale');
});

test('the state is read from this repository and this run, never invented, and every line fits the protocol', async () => {
  const p = priorities({ gap: { current: null, target: 8, urgency: 5, short: null }, ladder: [['2026-10-26', 2], ['2026-11-30', 20]], booked: null, targets: { podcasts: 2, stages: 1 }, raised: 2, starved: [{ lane: 'reach_out' }] });
  assert.deepEqual(p.map(x => x.rank), [1, 2, 3, 4]);
  assert.equal(p[0].line, 'Good meetings, each marked good by Krish and traced to its path: unknown of 8 this week (U5); 20 a week by 30 November 2026.', 'unknown stays unknown, never 0');
  assert.equal(p[0].objective_key, 'good_meetings');
  assert.match(p[1].line, /bookings not measured this run/);
  assert.match(p[2].line, /^At U5, volume runs at the top of its policy bounds/);
  assert.equal(p[3].line, 'Feed the lanes at 0 for 3 runs: reach out.');
  assert.equal(priorities({ gap: { current: 1, target: 2, urgency: 2 }, targets: null }).length, 1, 'no urgency line under U3, no visibility line with no targets');
  const o = obsessions(NORTH_STAR_TEXT);
  assert.ok(o.length >= 1 && o.length <= 3);
  for (const x of o) assert.ok(NORTH_STAR_TEXT.includes(x.line), 'each obsession is his line, quoted whole from docs/NORTH_STAR.md');
  assert.deepEqual(obsessions('# Nothing quoted here'), [], 'no source, no obsession');
  assert.deepEqual(obsessions(`> ${'x'.repeat(201)}\n`), [], 'an over-long quote is left out, never cut');
  const s = nextSteps(await FILES());
  assert.deepEqual(s, [
    { line: 'Phase 9: Prove the synthetic route on real runs.', waits_on: 'engine', when: null },
    { line: 'Read the synthetic report.', waits_on: 'engine', when: null },
    { line: 'Krish signs the synthetic spec on 2026-10-26.', waits_on: 'krish', when: '2026-10-26' },
    { line: 'The Codex session finishes the synthetic card.', waits_on: 'other', when: null },
    { line: 'Waiting on Krish: the synthetic setting (a, b and c).', waits_on: 'krish', when: null }
  ], 'the first unticked step, then NOW.md\'s Next clause by clause, at most five');
  assert.deepEqual(nextSteps({}), []);
  // The real files parse to valid lines whatever they say today; nothing is required of their wording.
  const real = { getGoing: await readFile(new URL('../docs/GET-GOING.md', import.meta.url), 'utf8'), now: await readFile(new URL('../NOW.md', import.meta.url), 'utf8') };
  const state = engineState({ priorities: p, obsessions: o, next_steps: nextSteps(real), acks: [] });
  assert.equal('instruction_acks' in state, false, 'a field with no entry is left out');
  for (const k of ['priorities', 'obsessions', 'next_steps']) for (const x of state[k] ?? []) assert.ok(stateLine(x.line) === x.line && x.line.length <= 200, `${k}: ${x.line}`);
  assert.equal(stateLine('Line with a@b.test in it'), null);
  assert.equal(stateLine('**Bold** and `code` and [a link](https://example.test)'), 'Bold and code and a link');
  assert.equal(longDate('2026-11-30'), '30 November 2026');
  assert.equal(isoDate('18 October 2026'), '2026-10-18');
});

test('the fields go out only where the directive says features.engine_state and Control Center lists 1.20.0', () => {
  assert.equal(takesEngineState({ engine_state: true }, schema), true);
  assert.equal(takesEngineState({ engine_state: true }, schema, { schema_versions: ['1.19.0', '1.20.0'] }), true);
  assert.equal(takesEngineState({ engine_state: true }, schema, { schema_versions: ['1.6.0'] }), false, 'a report raised past what Control Center lists could carry rows it refuses');
  assert.equal(takesEngineState({ engine_state: false }, schema), false);
  assert.equal(takesEngineState({ engine_state: true }, { properties: {} }), false, 'never a field the copied schema lacks');
});

test('a run whose directive carries his instruction reports received and what it did at 1.20.0, its first line names the id, and nothing prints his words', async () => {
  const service = await startProtocolService({ directive: at1_20(), recorded: false, engineState: true });
  try {
    const result = await run(service);
    assert.equal(result.status, 'succeeded');
    const [report] = posted(service);
    assert.deepEqual(violations(schema, report), []);
    assert.equal(report.schema_version, '1.20.0');
    assert.match(report.activity[0].line, new RegExp(`^Received Krish's instruction ${KI} `), 'his instruction leads the report');
    assert.match(report.activity[1].line, /^Gap: /, 'the gap still leads everything else');
    assert.deepEqual(report.instruction_acks.map(a => [a.instruction_id, a.state]), [[KI, 'received'], [KI, 'blocked']], 'this synthetic run read no context for rows, so it says blocked and why');
    assert.match(report.instruction_acks[1].line, /served no people or stages/);
    assert.equal(report.holds.some(h => /instruction/i.test(`${h.reason} ${h.detail}`)), false, 'an ack never goes in holds');
    assert.ok(report.priorities.length >= 1 && report.priorities[0].objective_key === 'good_meetings');
    assert.ok(report.obsessions.length >= 1);
    assert.equal(report.next_steps[0].line, 'Phase 9: Prove the synthetic route on real runs.');
    noWords(report, 'the report this run sends with no rows');
    noWords(result, 'the printed outcome');
    assert.deepEqual(result.instruction.acks, ['received', 'blocked']);
    assert.match(result.instruction.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(result.engine_state, { priorities: report.priorities.length, obsessions: report.obsessions.length, next_steps: report.next_steps.length, instruction_acks: 2 });
  } finally { await service.close(); }
});

test('with no instruction open the run still reports its state, and before 1.20.0 it sends none of it', async () => {
  const none = await startProtocolService({ directive: at1_20({ krish_instruction: null }), recorded: false, engineState: true });
  try {
    const result = await run(none);
    const [report] = posted(none);
    assert.equal(result.status, 'succeeded');
    assert.equal(report.schema_version, '1.20.0');
    assert.equal('instruction_acks' in report, false);
    assert.equal(report.activity.some(a => /Krish's instruction/.test(a.line)), false);
    assert.ok(report.priorities.length && report.next_steps.length);
    assert.equal('instruction' in result, false);
  } finally { await none.close(); }
  const before = await startProtocolService({ directive: directiveFixture({ krish_instruction: given() }), recorded: false });
  try {
    const result = await run(before);
    const [report] = posted(before);
    assert.equal(result.status, 'succeeded');
    for (const k of ENGINE_STATE_KEYS) assert.equal(k in report, false, `${k} waits for features.engine_state`);
    assert.equal(report.schema_version, '1.2.0');
    assert.match(report.activity[0].line, new RegExp(`Krish's instruction ${KI}`), 'it still acts on his instruction and says so by id');
  } finally { await before.close(); }
});

test('a held engine acts on nothing: with no instruction served it says nothing of one, and with one it answers engine held', async () => {
  const quiet = await startProtocolService({ directive: at1_20({ krish_instruction: null }), recorded: false, engineState: true, activation: 'held' });
  try {
    await run(quiet);
    const [report] = posted(quiet);
    assert.equal('instruction_acks' in report, false);
  } finally { await quiet.close(); }
  const held = await startProtocolService({ directive: at1_20(), recorded: false, engineState: true, activation: 'held' });
  try {
    const result = await run(held);
    const [report] = posted(held);
    assert.deepEqual(report.instruction_acks.map(a => a.state), ['received', 'blocked']);
    assert.match(report.instruction_acks[1].line, /^Engine held: /);
    assert.deepEqual(result.instruction.acks, ['received', 'blocked']);
  } finally { await held.close(); }
});

test('a second wake the same day is its own run: a new run_id, both reports kept, and received is not said twice', async () => {
  const service = await startProtocolService({ directive: at1_20(), recorded: false, engineState: true });
  try {
    const first = await run(service, { kind: 'dispatch-41' });
    const firstReport = posted(service)[0];
    const second = await run(service, { kind: 'dispatch-42', historyReader: async () => [{ run_id: firstReport.run_id, accepted_at: AT, status: firstReport.status, activity: firstReport.activity }] });
    assert.equal(first.status, 'succeeded');
    assert.equal(second.status, 'succeeded');
    assert.notEqual(first.run_id, second.run_id);
    assert.deepEqual([first.run_id, second.run_id], [`mindmake:${AT.slice(0, 10)}:dispatch-41`, `mindmake:${AT.slice(0, 10)}:dispatch-42`]);
    assert.equal(service.reports.size, 2, 'Control Center keeps both, neither refused as a conflict');
    const secondReport = posted(service)[1];
    assert.deepEqual(secondReport.instruction_acks.map(a => a.state), ['blocked']);
    assert.match(secondReport.activity[0].line, /is first again this run/);
  } finally { await service.close(); }
});

test('Control Center\'s answer to the acks is kept as counts only', () => {
  assert.deepEqual(acksAnswer({ applied: 2, unknown: 0, stale: 1 }), { applied: 2, unknown: 0, stale: 1 });
  assert.deepEqual(acksAnswer({ error: 'acks_unrecorded' }), { recorded: false });
  assert.equal(acksAnswer(undefined), null);
});
