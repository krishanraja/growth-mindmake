import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { engineClient } from '../src/control-center.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { startProtocolService, directiveFixture } from './support/engine-protocol-service.mjs';
import { recoveryStep, consensusStep, divergeBody, sparkFindings, regexWords, readSparks, draftOpenings, openingOf, guardCounts, guardLine, scoreBody, genericOpeners, CLICHES, NAMESPACE, PITCH_NAMESPACE, RECOVERY_PREFIX } from '../src/stages/divergent.mjs';
import { BANNED } from '../src/stages/openings.mjs';

// Consulting divergent-thinker through Control Center's divergent route. Every spark, opener and draft here is invented.

const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
const WEEK = '2026-11-16';
const SERVED = { features: { divergent: true } };
const spark = (rank, title, over = {}) => ({ rank, title, mechanism: 'A plain mechanism.', whyNonObvious: 'Few teams would try it.', firstStep: 'Write the first list of five.', lens: 'inversion', kind: `kind${rank}`, conventionalTwin: 'Post more.', survivedAttack: true, score: 0.8, remoteness: 0.6, judge: null, prompt: 'p', ...over });
const SPARKS = [
  spark(1, 'Buy a list of chief executives and email them all at once', { mechanism: 'Bulk email a purchased list.' }),
  spark(2, 'Ask three podcast hosts he already knows to swap one question each'),
  spark(3, 'Turn one good meeting into a written case the leader forwards himself')
];
const diverging = (status = 200, value = { ok: true, runId: 'dt-run-1', consensus: ['Post more'], sparks: SPARKS }) => body => (body.op === 'diverge' ? { status, value } : { status: 200, value: { ok: true, consensus: ['Post more on LinkedIn', 'Host a webinar'], results: [{ title: 'x', status: 'accepted', outsideConsensus: true }] } });

async function withService(options, fn) {
  const service = await startProtocolService({ recorded: false, ...options });
  try { return await fn(engineClient(service.origin, service.token, { fetcher: service.fetcher }), service); } finally { await service.close(); }
}
const step = (cc, over = {}) => recoveryStep({ cc, capabilities: SERVED, mode: 'live', held: false, urgency: 5, proposals: [], decisions: [], recent: [], weekOf: WEEK, gap: 'Gap: good meetings 0 of 11 this week, U5, short by 11.', expiresAt: '2026-11-23T00:00:00.000Z', ...over });
const divergentCalls = service => service.requests.filter(r => r.route === 'divergent');

test('the banned words are read from the engine own lists, and the diverge ask carries them with the cliches', () => {
  const words = regexWords(BANNED);
  assert.ok(words.includes('role unknown') && words.includes('our data'));
  const body = divergeBody({ gap: 'Gap: x.' });
  assert.equal(body.op, 'diverge'); assert.equal(body.count, 3); assert.equal(body.target, 'strategy'); assert.equal(body.namespace, NAMESPACE);
  assert.deepEqual(body.cliches, [...CLICHES]);
  for (const w of ['great fit', 'worth hearing', 'congrat']) assert.ok(body.bannedWords.includes(w), w);
  for (const w of ['Krish', 'research', 'new', 'final', 'copy of']) assert.ok(!body.bannedWords.includes(w), `${w} would reject almost every idea at the gate`);
  assert.match(body.problem, /AI makes strong judgement stronger/);
  assert.doesNotMatch(body.problem, /[\u2013\u2014]/);
});

test('every spark is read against the walls and lint before it can become a proposal', () => {
  assert.deepEqual(sparkFindings(spark(1, 'Scrape attendee lists and email them')), ['wall_consent']);
  assert.ok(sparkFindings(spark(1, 'Post the audit in five founder Slack communities')).includes('wall_community'));
  assert.ok(sparkFindings(spark(1, 'Host a small private dinner for ten operating chiefs')).includes('wall_hosted_room'));
  assert.ok(sparkFindings(spark(1, 'Boost the post with paid ads')).includes('wall_paid_media'));
  assert.ok(sparkFindings(spark(1, 'Only 5 spots left this month')).includes('wall_scarcity'));
  assert.ok(sparkFindings(spark(1, 'A good play', { survivedAttack: false })).includes('attack_failed'));
  assert.ok(sparkFindings(spark(1, 'A play \u2014 with a dash')).includes('lint_dash'));
  assert.deepEqual(sparkFindings(SPARKS[1]), []);
});

test('served, at U5 with nothing else proposed: one diverge, the best play that passes on his list with its provenance, the rest in the notes', async () => {
  await withService({ divergent: diverging() }, async (cc, service) => {
    const out = await step(cc);
    assert.equal(divergentCalls(service).length, 1);
    const sent = divergentCalls(service)[0].body;
    assert.equal(sent.op, 'diverge'); assert.equal(sent.count, 3);
    const p = out.proposal;
    assert.equal(p.proposal_id, `${RECOVERY_PREFIX}${WEEK}`);
    assert.equal(p.wall, 'strategy'); assert.equal(p.kind, 'advice');
    assert.deepEqual(p.evidence, [{ label: 'divergent-thinker spark 2, run dt-run-1', url: null }]);
    assert.equal(JSON.parse(p.exact_payload).play.title, SPARKS[1].title, 'the list-buying play broke the consent wall and never reached him');
    assert.match(out.lines[0], /^Recovery plays: divergent-thinker run dt-run-1 for the week of 2026-11-16: 3 sparks, 2 passed .*held by wall consent 1/);
    assert.match(out.lines[1], /^Recovery play 2 \(kind3, kept in the notes\): Turn one good meeting/);
    assert.equal(out.lines.length, 2);
  });
});

test('not served: no call, no line, a quiet not-served count', async () => {
  await withService({ divergent: null }, async (cc, service) => {
    const capabilities = await cc.capabilities();
    const out = await step(cc, { capabilities });
    assert.equal(out.proposal, null); assert.deepEqual(out.lines, []); assert.deepEqual(out.outcome, { served: false, not_served: 1 });
    const map = await consensusStep({ cc, capabilities, mode: 'live', held: false, change: 'One change.', recent: [], weekOf: WEEK });
    assert.deepEqual(map, { lines: [], outcome: { served: false, not_served: 1 } });
    assert.equal(divergentCalls(service).length, 0);
  });
});

test('held, below U4, answered, another strategy ask waiting or a dry run: no diverge', async () => {
  await withService({ divergent: diverging() }, async (cc, service) => {
    for (const over of [{ held: true }, { urgency: 3 }, { urgency: null }, { decisions: [{ proposal_id: `${RECOVERY_PREFIX}${WEEK}`, decision: 'declined' }] }, { proposals: [{ proposal_id: 'gml-x', wall: 'strategy' }] }, { mode: 'synthetic' }, { decisions: null }]) {
      const out = await step(cc, over);
      assert.equal(out.proposal, null, JSON.stringify(over));
    }
    const unread = await step(cc, { recent: null });
    assert.match(unread.lines[0], /recent reports could not be read/);
    assert.equal(divergentCalls(service).length, 0);
  });
});

test('a cap reached, an uncalibrated embedder or a held engine is said by its code and fails nothing', async () => {
  for (const [status, error, re] of [[429, 'daily_diverge_cap_reached', /daily cap was reached \(daily_diverge_cap_reached\)/], [503, 'embedder_uncalibrated', /not available this run \(embedder_uncalibrated\)/], [409, 'engine_held', /holds the engine/]]) {
    await withService({ divergent: () => ({ status, value: { error } }) }, async cc => {
      const out = await step(cc);
      assert.equal(out.proposal, null);
      assert.match(out.lines[0], re);
      assert.equal(out.outcome.recovery, `failed_${status}`);
    });
  }
});

test("a later run the same week carries the play forward unchanged and does not diverge again", async () => {
  await withService({ divergent: diverging() }, async (cc, service) => {
    const first = await step(cc);
    const recent = [{ run_id: 'mindmake:earlier', activity: first.lines.map(line => ({ line })) }];
    const stored = { report: { proposals: [first.proposal] } };
    const carry = { ...cc, readReport: async id => { assert.equal(id, 'mindmake:earlier'); return stored; } };
    const again = await step(carry, { recent });
    assert.deepEqual(again.proposal, first.proposal);
    assert.match(again.lines[0], /kept on his list unchanged/);
    assert.equal(again.lines[1], first.lines[1], 'the notes are carried too');
    assert.equal(divergentCalls(service).length, 1);
  });
});

test('the consensus map reads the week change against the consensus once a week, a line only', async () => {
  await withService({ divergent: diverging() }, async (cc, service) => {
    const out = await consensusStep({ cc, capabilities: SERVED, mode: 'live', held: false, change: 'Test one host with no route.', recent: [], weekOf: WEEK });
    assert.deepEqual(divergentCalls(service).map(r => r.body.op), ['map', 'score']);
    const scored = divergentCalls(service)[1].body;
    assert.deepEqual(scored.obvious, ['Post more on LinkedIn', 'Host a webinar']);
    assert.equal(scored.judge, undefined, 'no judge, so the score makes no model call');
    assert.match(out.lines[0], /^Consensus map: for the week of 2026-11-16, the week's one change read against 2 consensus views: outside the consensus\. A note only, never an ask\.$/);
    const again = await consensusStep({ cc, capabilities: SERVED, mode: 'live', held: false, change: 'x', recent: [{ activity: out.lines }], weekOf: WEEK });
    assert.deepEqual(again.lines, []);
    assert.equal(divergentCalls(service).length, 2);
  });
});

test('the score guard reads each email opening by box against the fixed openers, counts only', () => {
  assert.equal(openingOf('Hi Sam,\n\nI hope this email finds you well. More here.\n\nJonny'), 'I hope this email finds you well.');
  const email = (id, mailbox, body) => ({ proposal_id: id, exact_payload: JSON.stringify({ version: 2, channel: 'email', recipient_contact_id: null, subject: 's', body, mailbox }) });
  const openings = draftOpenings([email('a', 'jonny', 'Hi,\nI hope you are keeping well.'), email('b', null, 'Hello,\nYour last essay changed how I price.'), { proposal_id: 'c', exact_payload: 'not json' }]);
  assert.deepEqual(openings.map(o => o.box), ['jonny', 'krish']);
  const body = scoreBody(openings);
  assert.equal(body.namespace, PITCH_NAMESPACE); assert.equal(body.judge, undefined);
  assert.deepEqual(body.obvious, genericOpeners()); assert.ok(body.obvious.length >= 10);
  const counts = guardCounts(openings, { results: [{ status: 'rejected_gravity' }, { status: 'accepted' }] });
  assert.deepEqual(counts, { jonny: { read: 1, generic: 1, other_rejected: 0, accepted: 0, unscored: 0 }, krish: { read: 1, generic: 0, other_rejected: 0, accepted: 1, unscored: 0 } });
  assert.equal(guardLine(counts), "Score guard, in shadow: Jonny's pitches 1 read, 1 generic, 0 accepted; his morning drafts 1 read, 0 generic, 1 accepted. Nothing is held by it.");
});

test('readSparks keeps titled sparks in rank order', () => {
  assert.deepEqual(readSparks({ sparks: [spark(2, 'b'), { rank: 1 }, spark(1, 'a')] }).map(s => s.title), ['a', 'b']);
  assert.deepEqual(readSparks(null), []);
});

// The dispatch end to end with a fake Control Center: unserved means no call, served at U5 means one ask on the report.
async function dispatch({ features, urgency = 5, divergentImpl, decisions = [] }) {
  const reports = [], calls = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ urgency }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18', state: 'active' }, schema_versions: ['1.2.0'], features }),
    decisions: async () => decisions,
    postReport: async rep => { reports.push(rep); return { accepted: true, run_id: rep.run_id, payload_sha256: rep.payload_sha256, replayed: false }; },
    readReport: async () => { if (!reports.length) throw Object.assign(new Error('missing'), { status: 404 }); return { accepted: true, run_id: reports.at(-1).run_id, payload_sha256: reports.at(-1).payload_sha256, report: reports.at(-1) }; },
    divergent: async body => { calls.push(body); return divergentImpl(body); }
  };
  const result = await runDispatch({ cc, source: async () => ({}), policy, registry: {}, mode: 'live', attemptId: 'gma-divergent-1234', clock: () => '2026-11-18T06:00:00.000Z', historyReader: async () => [] });
  return { result, report: reports[0], calls };
}

test('the dispatch makes no divergent call when the feature is off, and reports only a quiet count', async () => {
  const { result, report, calls } = await dispatch({ features: {}, divergentImpl: () => { throw new Error('must not be called'); } });
  assert.equal(calls.length, 0);
  assert.equal(result.divergent.not_served, 1);
  assert.ok(!report.activity.some(a => /^(?:Recovery plays|Consensus map)/.test(a.line)));
  assert.ok(!report.proposals.some(p => p.proposal_id.startsWith(RECOVERY_PREFIX)));
});

test('the dispatch at U5 with the feature served: the unsigned week spec, then its check-in, is the one strategy ask, so no diverge until each is answered; then one play with its provenance', async () => {
  const play = body => diverging()(body).value;
  const first = await dispatch({ features: { divergent: true }, divergentImpl: play });
  assert.equal(first.calls.filter(c => c.op === 'diverge').length, 0, 'one ask per engine: the week spec waits on his list');
  assert.equal(first.result.divergent.recovery, 'other_ask');
  const spec = first.report.proposals.find(x => x.proposal_id.startsWith('gms-'));
  const signed = [{ proposal_id: spec.proposal_id, decision: 'approved', decided_at: '2026-11-17T08:00:00Z', payload_sha256: spec.payload_sha256, stage: 'plan', amended: false }];
  const second = await dispatch({ features: { divergent: true }, divergentImpl: play, decisions: signed });
  assert.equal(second.calls.filter(c => c.op === 'diverge').length, 0, 'the signed spec is an open plan, and its check-in is now the one ask');
  const checkIn = second.report.proposals.find(x => x.proposal_id.startsWith('gmk-'));
  signed.push({ proposal_id: checkIn.proposal_id, decision: 'approved', decided_at: '2026-11-18T05:00:00Z', payload_sha256: checkIn.payload_sha256, stage: 'check_in', amended: false });
  const { report, calls, result } = await dispatch({ features: { divergent: true }, divergentImpl: play, decisions: signed });
  assert.equal(calls.filter(c => c.op === 'diverge').length, 1);
  const p = report.proposals.find(x => x.proposal_id === `${RECOVERY_PREFIX}2026-11-16`);
  assert.ok(p, 'the play is in the report');
  assert.deepEqual(p.evidence, [{ label: 'divergent-thinker spark 2, run dt-run-1', url: null }]);
  assert.equal(report.proposals.filter(x => x.wall === 'strategy').length, 1, 'one strategy ask from this engine');
  assert.equal(result.divergent.recovery, 'proposed');
  const low = await dispatch({ features: { divergent: true }, urgency: 3, divergentImpl: play, decisions: signed });
  assert.equal(low.calls.filter(c => c.op === 'diverge').length, 0, 'below U4 there is no diverge');
});

// ── The at-will command, scripts/divergent.mjs, on a stub client: no network, invented words only ──
import { run as consult, parseArgs, listOf, NO_BEARER } from '../scripts/divergent.mjs';
import { PRAISE } from '../src/stages/openings.mjs';

const BEARER = { CONTROL_CENTER_URL: 'https://cc.invalid', CONTROL_CENTER_ENGINE_TOKEN: 'stub' };
function stub({ capabilities = { activation: { state: 'active' }, features: { divergent: true } }, answer = { ok: true, results: [] }, fail = null, capsFail = null } = {}) {
  const calls = { capabilities: 0, divergent: [] };
  const makeClient = (url, token) => { if (token !== 'stub') throw new Error('no bearer'); return { async capabilities() { calls.capabilities++; if (capsFail) throw capsFail; return capabilities; }, async divergent(body) { calls.divergent.push(body); if (fail) throw fail; return answer; } }; };
  return { calls, makeClient };
}
const FILES = { 'ideas.txt': 'Swap one question with a host\n\nWrite the case the leader forwards\n', 'obvious.json': '["Post more on LinkedIn","Host a webinar"]', 'items.json': '[{"title":"Tried one host swap"}]' };
const read = async p => { if (!(p in FILES)) { const e = new Error('missing'); e.code = 'ENOENT'; throw e; } return FILES[p]; };
async function cli(argv, s = stub(), env = BEARER) {
  let out = '', err = '';
  const code = await consult(argv, { env, makeClient: s.makeClient, read, out: t => { out += t; }, err: t => { err += t; } });
  return { code, out, err, calls: s.calls };
}

test('at will: each op sends its own body, with the namespace or its lane, and PRAISE only as banned words', async () => {
  const praise = regexWords(PRAISE);
  let r = await cli(['map', '--problem', 'Get more good meetings', '--context', 'One founder']);
  assert.equal(r.code, 0); assert.deepEqual(r.calls.divergent[0], { op: 'map', problem: 'Get more good meetings', context: 'One founder', namespace: 'growth-mindmake' });
  assert.deepEqual(JSON.parse(r.out), { ok: true, results: [] });
  r = await cli(['provoke', '--problem', 'P', '--cliche', 'Post more', '--cliche', 'Host a webinar', '--count', '4', '--target', 'strategy', '--temperament', 'wild', '--lane', 'rooms']);
  const p = r.calls.divergent[0];
  assert.deepEqual({ ...p, bannedWords: undefined }, { op: 'provoke', problem: 'P', count: 4, cliches: ['Post more', 'Host a webinar'], bannedWords: undefined, target: 'strategy', temperament: 'wild', namespace: 'growth-mindmake:rooms' });
  assert.deepEqual(p.bannedWords, [...new Set(praise)]);
  for (const w of ['Krish', 'research', 'new', 'final']) assert.ok(!p.bannedWords.includes(w), w);
  r = await cli(['diverge', '--problem', 'P']);
  assert.equal(r.calls.divergent[0].op, 'diverge'); assert.equal(r.calls.divergent[0].namespace, 'growth-mindmake');
  r = await cli(['challenge', '--problem', 'P', '--idea', 'An idea']);
  assert.deepEqual(r.calls.divergent[0], { op: 'challenge', problem: 'P', idea: 'An idea', namespace: 'growth-mindmake' });
  r = await cli(['score', '--problem', 'P', '--ideas-file', 'ideas.txt', '--obvious-file', 'obvious.json', '--lane', 'pitches']);
  const s = r.calls.divergent[0];
  assert.deepEqual(s.ideas, ['Swap one question with a host', 'Write the case the leader forwards']);
  assert.deepEqual(s.obvious, ['Post more on LinkedIn', 'Host a webinar']);
  assert.equal(s.judge, undefined, 'no judge unless asked'); assert.equal(s.namespace, 'growth-mindmake:pitches');
  r = await cli(['score', '--problem', 'P', '--ideas-file', 'ideas.txt', '--judge']);
  assert.equal(r.calls.divergent[0].judge, true);
  r = await cli(['record', '--items-file', 'items.json', '--label', 'week']);
  assert.deepEqual(r.calls.divergent[0], { op: 'record', items: [{ title: 'Tried one host swap' }], label: 'week', namespace: 'growth-mindmake' });
  assert.deepEqual(listOf('a\n b \n\n'), ['a', 'b']);
});

test('at will: score exits 1 when it flags any idea, 0 when all are accepted', async () => {
  const flagged = await cli(['score', '--problem', 'P', '--ideas-file', 'ideas.txt'], stub({ answer: { ok: true, results: [{ status: 'accepted' }, { status: 'rejected_gravity' }] } }));
  assert.equal(flagged.code, 1); assert.match(flagged.err, /flagged 1 idea\./);
  assert.equal(JSON.parse(flagged.out).results.length, 2, 'the answer is still printed');
  const clean = await cli(['score', '--problem', 'P', '--ideas-file', 'ideas.txt'], stub({ answer: { ok: true, results: [{ status: 'accepted' }] } }));
  assert.equal(clean.code, 0);
});

test('at will: no bearer, not served or unreachable exits 2 with no divergent call', async () => {
  const none = await cli(['map', '--problem', 'P'], stub(), {});
  assert.equal(none.code, 2); assert.equal(none.err.trim(), NO_BEARER);
  assert.match(none.err, /divergent_score, divergent_record and divergent_run with namespace growth-mindmake/);
  assert.equal(none.calls.capabilities, 0); assert.equal(none.calls.divergent.length, 0);
  const off = await cli(['score', '--problem', 'P', '--ideas-file', 'ideas.txt'], stub({ capabilities: { features: {} } }));
  assert.equal(off.code, 2); assert.match(off.err, /not served/); assert.equal(off.calls.divergent.length, 0);
  const down = await cli(['map', '--problem', 'P'], stub({ capsFail: new Error('fetch failed') }));
  assert.equal(down.code, 2); assert.match(down.err, /could not be reached/); assert.equal(down.calls.divergent.length, 0);
  assert.doesNotMatch(none.err + off.err + down.err, /stub/, 'the bearer is never printed');
});

test('at will: held refuses every generating op without a call, and score and record still run', async () => {
  const held = stub({ capabilities: { activation: { state: 'held' }, features: { divergent: true } } });
  for (const argv of [['map', '--problem', 'P'], ['provoke', '--problem', 'P'], ['challenge', '--problem', 'P', '--idea', 'I'], ['diverge', '--problem', 'P']]) {
    const r = await cli(argv, held);
    assert.equal(r.code, 2, argv[0]); assert.match(r.err, /holds this engine/);
  }
  assert.equal(held.calls.divergent.length, 0);
  assert.equal((await cli(['record', '--items-file', 'items.json'], held)).code, 0);
  assert.equal((await cli(['score', '--problem', 'P', '--ideas-file', 'ideas.txt'], held)).code, 0);
});

test('at will: a cap, an uncalibrated embedder, a hold or a refusal exits 2 by its code, once, with no retry', async () => {
  for (const [status, code, re] of [[429, 'daily_diverge_cap_reached', /daily cap was reached \(daily_diverge_cap_reached\)/], [503, 'embedder_uncalibrated', /not calibrated \(embedder_uncalibrated\)/], [409, 'held', /holds this engine/], [403, 'feature_off', /refused this engine/], [400, 'bad_request', /malformed/]]) {
    const e = Object.assign(new Error('x'), { status, code });
    const s = stub({ fail: e });
    const r = await cli(['diverge', '--problem', 'P'], s);
    assert.equal(r.code, 2); assert.match(r.err, re); assert.equal(r.out, '');
    assert.equal(s.calls.divergent.length, 1, 'no retry');
  }
});

test('at will: a malformed command exits 2 before any call', async () => {
  for (const argv of [[], ['guess'], ['map'], ['challenge', '--problem', 'P'], ['score', '--problem', 'P'], ['record'], ['map', '--problem', 'P', '--lane', 'Bad Lane'], ['provoke', '--problem', 'P', '--count', '0'], ['map', '--problem', 'P', '--nope', 'x']]) {
    const s = stub();
    const r = await cli(argv, s);
    assert.equal(r.code, 2, argv.join(' ')); assert.match(r.err, /Usage: npm run divergent/);
    assert.equal(s.calls.capabilities + s.calls.divergent.length, 0);
  }
  assert.throws(() => parseArgs(['map', '--problem']), /needs a value/);
});
