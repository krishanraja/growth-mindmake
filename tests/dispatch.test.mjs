import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { engineClient } from '../src/control-center.mjs';
import { runDispatch, readDirective, reportDigest, canonicalJson, buildReport, objectiveReadings, proposalsFrom, londonMidnight, londonWeek, payloadDigest, DispatchError } from '../src/dispatch.mjs';
import { plan } from '../src/orchestrator.mjs';
import { enginePlan } from '../src/engine.mjs';
import { startProtocolService, STAND_IN_TOKEN, violations, digest, directiveFixture } from './support/engine-protocol-service.mjs';
import { AT, POLICY, snapshot, contact } from './helpers.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const registry = JSON.parse(await readFile(new URL('../config/campaigns.json', import.meta.url), 'utf8'));
const engineContext = JSON.parse(await readFile(new URL('../fixtures/engine-context.json', import.meta.url), 'utf8'));
const FIXTURE_AT = '2026-10-16T18:00:00Z';
let attempts = 0;
const attemptId = () => `gma-synthetic-${String(++attempts).padStart(8, '0')}`;
const bridge = (service, token = service.token) => engineClient(service.origin, token, { fetcher: service.fetcher });
const fromSnapshot = value => async () => ({ snapshot: structuredClone(value) });
const dispatch = (service, options = {}) => runDispatch({ cc: bridge(service), source: fromSnapshot(snapshot()), policy: POLICY, registry, mode: 'synthetic', kind: 'synthetic', attemptId: attemptId(), clock: () => AT, ...options });
const posts = (service, route) => service.requests.filter(r => r.method === 'POST' && r.route === route);

test('the report digest reproduces the worked example exactly', async () => {
  const example = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.example.json', import.meta.url), 'utf8'));
  assert.equal(reportDigest(example), 'f4351324e84aa1baf6afd1bc4d2ffadb3039ab6399b2309c2717b89a26a0a517');
  assert.equal(reportDigest(example), example.payload_sha256);
  assert.equal(digest(example), example.payload_sha256);
  assert.deepEqual(violations(schema, example), []);
});

test('canonical JSON sorts keys at every depth, keeps array order, writes whole numbers plainly and never normalises text', () => {
  assert.equal(canonicalJson({ b: [3, { z: 1, a: 'x' }], a: { d: null, c: true } }), '{"a":{"c":true,"d":null},"b":[3,{"a":"x","z":1}]}');
  assert.equal(canonicalJson({ n: 1, m: 1.5 }), '{"m":1.5,"n":1}');
  assert.notEqual(canonicalJson('é'), canonicalJson('é'));
  assert.throws(() => canonicalJson({ a: undefined }));
  assert.throws(() => canonicalJson({ a: Number.NaN }));
});

test('London weeks run Monday to Monday and each boundary takes its own offset', () => {
  assert.deepEqual(londonWeek('2026-10-19T05:10:00Z'), { start: '2026-10-19', end: '2026-10-26' });
  assert.deepEqual(londonWeek('2026-10-25T23:30:00Z'), { start: '2026-10-19', end: '2026-10-26' });
  assert.deepEqual(londonWeek('2026-10-18T23:30:00Z'), { start: '2026-10-19', end: '2026-10-26' });
  assert.deepEqual(londonWeek('2026-10-26T00:30:00Z'), { start: '2026-10-26', end: '2026-11-02' });
  assert.equal(londonMidnight('2026-10-19'), '2026-10-19T00:00:00+01:00');
  assert.equal(londonMidnight('2026-10-26'), '2026-10-26T00:00:00+00:00');
  assert.equal(londonMidnight('2026-03-30'), '2026-03-30T00:00:00+01:00');
  const [qualified, paid] = objectiveReadings({ at: '2026-10-19T05:10:00Z', activatedOn: '2026-10-18' });
  assert.deepEqual([qualified.window_start, qualified.window_end], ['2026-10-19T00:00:00+01:00', '2026-10-26T00:00:00+00:00']);
  assert.deepEqual([paid.window_start, paid.window_end], ['2026-10-18T00:00:00+01:00', '2026-11-17T00:00:00+00:00']);
});

test('objectives without complete outcome coverage are missing with a reason, never zero', () => {
  for (const reading of [...objectiveReadings({ at: AT, activatedOn: '2026-10-18' }), ...objectiveReadings({ at: AT, activatedOn: null })]) {
    assert.equal(reading.value, null);
    assert.equal(reading.availability, 'missing');
    assert.ok(reading.reason.length > 20 && reading.reason.length <= 500);
    assert.equal(reading.timezone, 'Europe/London');
  }
  assert.deepEqual(objectiveReadings({ at: AT }).map(o => o.key), ['qualified_conversations', 'paid_proofs']);
  assert.equal(objectiveReadings({ at: AT, activatedOn: 'not-a-date' })[1].window_start, null);
});

test('the report builder produces a schema-valid envelope, refuses unknown fields and names no private person', () => {
  const source = snapshot();
  source.contacts[0].full_name = 'PRIVATE_SYNTHETIC_PERSON';
  const batch = plan(source, POLICY, { at: AT });
  const mapped = proposalsFrom({ batch, snapshot: source, policy: POLICY });
  const fields = { run_id: 'mindmake:2026-10-16:synthetic', mode: 'synthetic', observed_at: AT, source: { revision: 'synthetic-revision-1', captured_at: AT }, status: 'ready', objectives: objectiveReadings({ at: AT }), activity: ['Read one synthetic page.', ...mapped.activity], proposals: mapped.proposals, holds: mapped.holds };
  const report = buildReport(fields);
  assert.deepEqual(violations(schema, report), []);
  assert.equal(report.payload_sha256, digest(report));
  // origin_candidates and withdrawn (1.10.0), suppression and taxonomy (features.suppression) and credits_spent (1.16.0) are the optional fields: sent only when there is one.
  assert.deepEqual(Object.keys(report).sort(), Object.keys(schema.properties).filter(k => !['origin_candidates', 'withdrawn', 'suppression', 'taxonomy', 'credits_spent'].includes(k)).sort());
  assert.doesNotMatch(JSON.stringify([report.activity, report.holds]), /PRIVATE_SYNTHETIC/);
  const smuggled = structuredClone(mapped.proposals); smuggled[0].send_now = true;
  assert.throws(() => buildReport({ ...fields, proposals: smuggled }), e => e instanceof DispatchError && e.code === 'report_invalid');
  assert.throws(() => buildReport({ ...fields, objectives: [{ ...fields.objectives[0], extra: 1 }] }), /report_invalid/);
});

test('a prepared note becomes a send proposal bound to its exact words, channel and target, with a stable id', () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  const { proposals } = proposalsFrom({ batch, snapshot: snapshot(), policy: POLICY });
  const send = proposals.find(p => p.wall === 'send');
  assert.equal(send.channel, 'email');
  assert.equal(send.kind, 'prepared');
  assert.match(send.exact_payload, /^Subject: /);
  assert.equal(send.payload_sha256, payloadDigest({ channel: 'email', exact_payload: send.exact_payload, target: 'buyer-a' }));
  assert.equal(send.close_condition.event, 'outreach_sent');
  assert.equal(send.subject_ref, 'contact:buyer-a', 'the note names its person by Control Center id, so his list keeps one copy');
  assert.ok(send.expires_at);
  const improvement = proposals.find(p => p.proposal_id.startsWith('gmi-'));
  assert.ok(['strategy', 'none'].includes(improvement.wall));
  const changed = snapshot(); changed.contacts[0].buying_moment.fact = 'A different pricing decision is being tested this month.';
  const again = proposalsFrom({ batch: plan(changed, POLICY, { at: AT }), snapshot: changed, policy: POLICY }).proposals.find(p => p.wall === 'send');
  assert.equal(again.proposal_id, send.proposal_id);
  assert.notEqual(again.payload_sha256, send.payload_sha256);
});

test('no note is proposed to someone Advisory already holds', () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  const held = snapshot({ deals: [{ id: 'advisory-deal-a', contact_id: 'buyer-a', state: 'drafted', drafted_at: '2026-10-15T10:00:00Z' }] });
  const mapped = proposalsFrom({ batch, snapshot: held, policy: POLICY });
  assert.equal(mapped.proposals.filter(p => p.wall === 'send').length, 0);
  assert.ok(mapped.holds.some(h => h.reason === 'advisory_holds_recipient'));
});

test('full-cycle work items map to send, post, strategy or internal prep within the proposal cap', () => {
  const work = enginePlan(engineContext, POLICY, registry, { at: FIXTURE_AT });
  const { proposals } = proposalsFrom({ work, workSnapshot: { deals: [] }, policy: POLICY });
  assert.equal(proposals.length, work.items.length);
  for (const item of work.items) {
    const p = proposals.find(x => x.close_condition.reference === item.item_id);
    const expected = ['email', 'linkedin'].includes(item.channel) ? 'send' : item.channel === 'publication' ? 'post' : ['qualification_review', 'proof_scope_review', 'paid_proof_delivery_handoff'].includes(item.kind) ? 'strategy' : 'none';
    assert.equal(p.wall, expected, item.kind);
    if (['send', 'post'].includes(p.wall)) { assert.equal(p.exact_payload, item.body); assert.equal(p.channel, item.channel); }
    if (p.wall === 'none') assert.equal(p.exact_payload, null);
    assert.equal(p.close_condition.event, item.closure_event);
  }
  const many = { ...work, items: Array.from({ length: 12 }, (_, i) => ({ ...work.items[0], input_id: `job-${i}`, item_id: `gwi-${String(i).padStart(32, '0')}` })) };
  const capped = proposalsFrom({ work: many, workSnapshot: { deals: [] }, policy: POLICY });
  assert.equal(capped.proposals.length, 10);
  assert.ok(capped.holds.some(h => h.reason === 'proposal_cap'));
});

test('one dispatch run journals started then one terminal state, reports, reads back and reads decisions', async () => {
  const service = await startProtocolService();
  try {
    const result = await dispatch(service);
    assert.equal(result.status, 'succeeded', JSON.stringify(result));
    assert.equal(result.error_code, null);
    const [first, ...rest] = service.requests;
    assert.equal(first.method, 'POST'); assert.equal(first.route, 'attempts'); assert.equal(first.body.status, 'started'); assert.ok(!('finished_at' in first.body));
    assert.equal(rest[0].route, 'attempts/' + encodeURIComponent(first.body.attempt_id));
    assert.equal(rest[1].route, 'directive');
    const writes = posts(service, 'attempts');
    assert.equal(writes.length, 2);
    assert.equal(writes[1].body.attempt_id, first.body.attempt_id);
    assert.equal(writes[1].body.status, 'succeeded'); assert.ok(writes[1].body.finished_at);
    assert.equal(service.attempts.get(first.body.attempt_id).status, 'succeeded');
    const [report] = posts(service, 'reports');
    assert.equal(report.idempotency, 'mindmake:2026-10-16:synthetic');
    assert.equal(report.body.mode, 'synthetic');
    assert.deepEqual(violations(schema, report.body), []);
    assert.ok(service.requests.some(r => r.method === 'GET' && r.route === `reports/${encodeURIComponent('mindmake:2026-10-16:synthetic')}`));
    assert.ok(service.requests.some(r => r.route === 'decisions' && r.query.since));
    assert.equal(result.report.read_back, true);
    assert.equal(result.report.replayed, false);
    assert.equal(result.sends + result.gmail_drafts + result.advisory_batches, 0);
    assert.ok(report.body.activity.some(a => /Advisory this week: 2 drafted/.test(a.line)));
    assert.ok(report.body.activity.some(a => /Network counts could not be read/.test(a.line)));
    const replay = await dispatch(service);
    assert.equal(replay.status, 'succeeded');
    assert.equal(replay.report.replayed, true);
    assert.equal(service.reports.size, 1);
  } finally { await service.close(); }
});

test('a changed payload under the same run id is a 409 conflict, read back and never resent', async () => {
  const service = await startProtocolService();
  try {
    assert.equal((await dispatch(service)).status, 'succeeded');
    const before = posts(service, 'reports').length;
    const changed = snapshot(); changed.contacts[0].buying_moment.fact = 'A different pricing decision is being tested this month.';
    const result = await dispatch(service, { source: fromSnapshot(changed) });
    assert.equal(result.status, 'failed');
    assert.equal(result.error_code, 'report_conflict');
    assert.equal(posts(service, 'reports').length - before, 1);
    const terminal = posts(service, 'attempts').at(-1).body;
    assert.equal(terminal.status, 'failed'); assert.equal(terminal.error_code, 'report_conflict');
  } finally { await service.close(); }
});

test('a 401 surfaces as a failed attempt with a lower_snake code', async () => {
  const service = await startProtocolService();
  try {
    service.fault('GET', 'directive', 401, { error: 'unauthorized' });
    const result = await dispatch(service);
    assert.equal(result.status, 'failed'); assert.equal(result.error_code, 'unauthorized'); assert.equal(result.journaled, true);
    const terminal = posts(service, 'attempts').at(-1).body;
    assert.equal(terminal.status, 'failed'); assert.equal(terminal.error_code, 'unauthorized'); assert.equal(terminal.phase, 'directive');
    assert.equal(posts(service, 'reports').length, 0);
    const wrong = await runDispatch({ cc: bridge(service, `gen1_${'W'.repeat(48)}`), source: fromSnapshot(snapshot()), policy: POLICY, registry, mode: 'synthetic', attemptId: attemptId(), clock: () => AT });
    assert.equal(wrong.status, 'failed'); assert.equal(wrong.error_code, 'unauthorized'); assert.equal(wrong.journaled, false);
  } finally { await service.close(); }
});

test('a lost report response is read back instead of resent and stays unknown when nothing is stored', async () => {
  const service = await startProtocolService();
  try {
    service.drop('POST', 'reports');
    const result = await dispatch(service);
    assert.equal(result.status, 'unknown'); assert.equal(result.error_code, 'readback_unconfirmed');
    assert.equal(posts(service, 'reports').length, 1);
    assert.equal(posts(service, 'attempts').at(-1).body.status, 'unknown');
  } finally { await service.close(); }
});

test('a live run before activation is refused as engine_inactive, and a live run with no source credential reports degraded', async () => {
  const inactive = await startProtocolService({ active: false });
  try {
    const result = await dispatch(inactive, { mode: 'live', kind: 'dispatch' });
    assert.equal(result.status, 'failed'); assert.equal(result.error_code, 'engine_inactive');
  } finally { await inactive.close(); }
  const service = await startProtocolService();
  try {
    const result = await dispatch(service, { mode: 'live', kind: 'dispatch', source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'Not available to this run.' } }) });
    // A live run that read nothing is held by its class, never a quiet success (F48); its report still goes and is read back.
    assert.equal(result.status, 'failed'); assert.equal(result.error_code, 'nothing_read'); assert.equal(result.report.read_back, true);
    const [report] = posts(service, 'reports');
    assert.equal(report.body.status, 'degraded'); assert.equal(report.body.mode, 'live');
    assert.deepEqual(report.body.holds.map(h => h.reason), ['founder_visibility_open', 'source_credential_unavailable', 'engine_context_unavailable']);
    assert.ok(report.body.objectives.every(o => o.value === null && o.availability === 'missing'));
    assert.equal(report.body.proposals.length, 0);
  } finally { await service.close(); }
});

test('an approval counts only when its digest matches the payload in this report', async () => {
  const decisions = [];
  const service = await startProtocolService({ decisions });
  try {
    await dispatch(service);
    const send = [...service.reports.values()][0].report.proposals.find(p => p.wall === 'send');
    decisions.push({ proposal_id: send.proposal_id, decision: 'approved', decided_at: '2026-10-16T12:59:00Z', payload_sha256: send.payload_sha256 });
    decisions.push({ proposal_id: send.proposal_id, decision: 'approved', decided_at: '2026-10-16T12:58:00Z', payload_sha256: 'f'.repeat(64) });
    const result = await dispatch(service);
    assert.deepEqual(result.decisions, { read: 2, approved_matching: 1, approved_changed: 1, declined: 0, done: 0 });
    assert.equal(result.sends, 0);
  } finally { await service.close(); }
});

test('the dispatch CLI never prints the bearer or private source text, and refuses to start without its secrets', async () => {
  const runtime = join(root, 'runtime'); await mkdir(runtime, { recursive: true });
  const dir = await mkdtemp(join(runtime, 'synthetic-dispatch-'));
  const source = snapshot({ contacts: [contact('buyer-a', { full_name: 'PRIVATE_SYNTHETIC_PERSON', company: 'PRIVATE_SYNTHETIC_COMPANY' })] });
  await writeFile(join(dir, 'snapshot.json'), JSON.stringify(source));
  await writeFile(join(dir, 'route.mjs'), `const real = globalThis.fetch;\nglobalThis.fetch = (input, init) => { const u = new URL(input); if (u.origin !== 'https://controlcenter.example.test') throw new Error('unexpected origin'); return real(new URL(u.pathname + u.search, process.env.STAND_IN_LOCAL_ORIGIN), init); };\n`);
  const run = (args, env) => new Promise(resolve => execFile(process.execPath, ['--import', pathToFileURL(join(dir, 'route.mjs')).href, 'src/cli.mjs', ...args], { cwd: root, timeout: 15000, env: { PATH: process.env.PATH, ...env } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
  const service = await startProtocolService({ recorded: false }); // the real CLI runs on the wall clock, so its report differs each day
  try {
    const env = { CONTROL_CENTER_URL: service.origin, CONTROL_CENTER_ENGINE_TOKEN: STAND_IN_TOKEN, STAND_IN_LOCAL_ORIGIN: service.localOrigin };
    const ok = await run(['dispatch', '--synthetic', '--snapshot', join(dir, 'snapshot.json'), '--at', AT], env);
    assert.equal(ok.code, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).status, 'succeeded');
    const live = await run(['dispatch'], { ...env, CC_WAKE_ENGINE_ID: 'growth-mindmake', CC_WAKE_DIRECTIVE_ID: 'mindmake:2026-10-19' });
    assert.equal(JSON.parse(live.stdout).report.status, 'degraded');
    const denied = await run(['dispatch', '--synthetic', '--snapshot', join(dir, 'snapshot.json'), '--at', AT], { ...env, CONTROL_CENTER_ENGINE_TOKEN: `gen1_${'D'.repeat(44)}` });
    assert.notEqual(denied.code, 0);
    assert.equal(JSON.parse(denied.stdout).error_code, 'unauthorized');
    for (const r of [ok, live, denied]) {
      assert.doesNotMatch(r.stdout + r.stderr, /PRIVATE_SYNTHETIC|synthetic_bearer_value|DDDDDDDDDD|gen1_/);
    }
    const missing = await run(['dispatch'], { CONTROL_CENTER_URL: service.origin });
    assert.notEqual(missing.code, 0); assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /CONTROL_CENTER_ENGINE_TOKEN is not set/);
    const misrouted = await run(['dispatch'], { ...env, CC_WAKE_ENGINE_ID: 'growth-heartside' });
    assert.notEqual(misrouted.code, 0);
    assert.ok(!service.requests.some(r => r.authorization === null));
    for (const args of [['dispatch', '--snapshot', 'fixtures/snapshot.json'], ['dispatch', '--at', AT], ['dispatch', '--kind', 'Bad Kind']]) {
      const refused = await run(args, env);
      assert.notEqual(refused.code, 0); assert.equal(refused.stdout, '');
    }
  } finally { await service.close(); }
});

test('any 1.x directive is read, since Control Center only adds within 1.x; anything else stops the run', () => {
  for (const v of ['1.0.0', '1.1.0', '1.2.0', '1.4.0', '1.5.0']) assert.doesNotThrow(() => readDirective(directiveFixture({ schema_version: v })), v);
  for (const v of ['2.0.0', '1.2', '', null]) assert.throws(() => readDirective(directiveFixture({ schema_version: v })), /directive_invalid/, String(v));
});

test('a report is sent as 1.2.0 and a note\'s subject passes the schema; an unwalled item names no subject', () => {
  const batch = plan(snapshot(), POLICY, { at: AT });
  const { proposals } = proposalsFrom({ batch, snapshot: snapshot(), policy: POLICY });
  const report = buildReport({ run_id: 'gmr-run-1', mode: 'synthetic', observed_at: AT, source: { revision: 'r1', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals, holds: [] });
  assert.equal(report.schema_version, '1.2.0');
  assert.ok(proposals.filter(p => p.wall !== 'send').every(p => p.subject_ref === undefined));
});

test('a context read that fails says why, by class and never by body', async () => {
  const { failureClass } = await import('../src/dispatch.mjs');
  assert.equal(failureClass(Object.assign(new Error('x'), { status: 500, code: 'store_failed' })), 'Control Center answered 500 store_failed');
  assert.equal(failureClass(Object.assign(new Error('x'), { status: 502, code: 'Not A Code' })), 'Control Center answered 502');
  assert.equal(failureClass(Object.assign(new Error('x'), { code: 'response_over_budget' })), 'the answer was larger than the byte budget');
  assert.equal(failureClass(Object.assign(new Error('x'), { name: 'TimeoutError' })), 'Control Center did not answer in time');
  assert.equal(failureClass(new Error('Control Center returned invalid JSON')), 'the answer was not JSON');
  assert.equal(failureClass(new Error('Invalid context read')), 'the answer did not hold together');
  assert.equal(failureClass(new TypeError("Cannot read properties of undefined (reading 'secret')")), 'the engine could not plan from it', 'never the message of an unexpected error');
});

test('the byte budget is Control Center\'s own ceiling: a 2.5 MB context is read, one past the budget is refused', async () => {
  const { RESPONSE_BUDGET } = await import('../src/control-center.mjs');
  const answer = n => async () => new Response(JSON.stringify({ ok: true, context: { pad: 'x'.repeat(n) } }), { status: 200, headers: { 'content-type': 'application/json' } });
  const token = `gen1_${'a'.repeat(43)}`;
  const big = await engineClient('https://cc.example', token, { fetcher: answer(2_500_000) }).context();
  assert.equal(big.context.pad.length, 2_500_000);
  await assert.rejects(engineClient('https://cc.example', token, { fetcher: answer(RESPONSE_BUDGET) }).context(), e => e.code === 'response_over_budget' && /exceeded the 4500000 budget/.test(e.message));
});
