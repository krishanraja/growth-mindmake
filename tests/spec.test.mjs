import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compile, defaultSpec, weekSpec, signedSpec, specProposal, withCounts, todaysCaps, policyErrors, compiledDrift, DEFAULT_CAPS, BOUND_KEYS, SPEC_MAX, FIRST_SPEC_WEEK, WEEK_SCHEMA } from '../src/crew/compile.mjs';
import { runDispatch, readDirective, payloadDigest, schemaErrors, londonMidnight, NORTH_STAR_SHA } from '../src/dispatch.mjs';
import { strategicPlan } from '../src/strategy.mjs';
import { PER_ROW, FIT_FLOOR, rankRows, fitHold } from '../src/stages/rows.mjs';
import { PITCHES_PER_RUN, STAGE_SHARE, INVITES_PER_RUN, INVITES_A_WEEK, FORMS_PER_ROW, INVITE_SHOWS, PITCH_CAPS, jonnyDraftsToday, pitchRows, shares } from '../src/stages/pitches.mjs';
import { readSpecCounts, visibilityTargets, PATHS } from '../src/stages/meetings.mjs';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { engineClient } from '../src/control-center.mjs';
import { directiveFixture, startProtocolService } from './support/engine-protocol-service.mjs';
import { STAGE } from './support/standard.mjs';

// The week spec, compiled (plan Phase 2). Synthetic only: invented shows, ids and counts.
// A Tuesday in the first signable week: this London week starts 2026-11-09.
const NOW = '2026-11-10T06:00:00Z';
const WEEK = '2026-11-09';
const root = new URL('../', import.meta.url);
const policy = JSON.parse(await readFile(new URL('config/policy.json', root), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('contracts/manifest.json', root), 'utf8'));
const example = JSON.parse(await readFile(new URL('specs/examples/week.synthetic.json', root), 'utf8'));
const clone = v => structuredClone(v);
const hold = async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } });
const noFiles = async () => null;
const amend = (proposal_id, exact_payload, extra = {}) => ({ proposal_id, decision: 'approved', decided_at: '2026-11-10T08:00:00Z', payload_sha256: 'a'.repeat(64), stage: 'plan', amended: true, exact_payload, amount_usd: null, amended_sha256: payloadDigest({ amount_usd: null, exact_payload }), ...extra });
const clear = (proposal, extra = {}) => ({ proposal_id: proposal.proposal_id, decision: 'approved', decided_at: '2026-11-10T08:00:00Z', payload_sha256: proposal.payload_sha256, stage: 'plan', amended: false, ...extra });

// On the stand-in: one service whose decisions he answers between runs.
let runs = 0;
async function onStandIn(decisions, at = NOW, extra = {}) {
  const service = await startProtocolService({ decisions, recorded: false });
  try {
    const result = await runDispatch({ cc: engineClient(service.origin, service.token, { fetcher: service.fetcher }), source: hold, policy, registry: {}, mode: 'synthetic', kind: `spec-${++runs}`, attemptId: `gma-spec-run-${String(runs).padStart(4, '0')}`, clock: () => at, specReader: noFiles, ...extra });
    return { result, report: service.reports.get(result.run_id)?.report ?? null };
  } finally { await service.close(); }
}
const specAsk = (report, week = WEEK) => report.proposals.find(p => p.proposal_id === `gms-${week}`);
const lines = report => report.activity.map(a => a.line);

test('the default spec is today, field for field: every cap the stages export, inside its bound, spend 0', () => {
  const spec = defaultSpec({ weekOf: WEEK });
  assert.deepEqual(schemaErrors(WEEK_SCHEMA, spec), []);
  const c = compile(spec, policy, { weekOf: WEEK });
  assert.equal(c.ok, true);
  assert.deepEqual(c.changes, []);
  assert.deepEqual(c.caps, {
    rows: { network: { on: true, max: PER_ROW }, partners: { on: true, max: PER_ROW }, reach_out: { on: true, max: PER_ROW }, visibility: { on: true, max: PER_ROW }, events: { on: true, max: PER_ROW } },
    fit_floor: FIT_FLOOR,
    pitches: { per_run: PITCHES_PER_RUN, stage_share: STAGE_SHARE, invites_per_run: INVITES_PER_RUN, invites_per_week: INVITES_A_WEEK, show_shares: { makeyourmindup: INVITE_SHOWS.makeyourmindup.share, signal_noise: INVITE_SHOWS.signal_noise.share }, forms_per_row: FORMS_PER_ROW, jonny_per_day: policy.limits.jonny_drafts_per_day, lanes: { visibility: true, events: true } },
    assets: [], spend_usd: 0
  });
  // Today's values, written out once, so a moved constant is seen here and not only in the golden reports.
  assert.deepEqual([PER_ROW, FIT_FLOOR, PITCHES_PER_RUN, STAGE_SHARE, INVITES_PER_RUN, INVITES_A_WEEK, INVITE_SHOWS.makeyourmindup.share, FORMS_PER_ROW, policy.limits.jonny_drafts_per_day], [6, 40, 10, 4, 2, 4, 70, 2, 10]);
  assert.deepEqual({ ...PITCH_CAPS, lanes: { ...PITCH_CAPS.lanes } }, c.caps.pitches, 'the stages\' own defaults and the compiled default spec are one set of numbers');
  const value = { 'rows.max': PER_ROW, fit_floor: FIT_FLOOR, 'pitches.per_run': PITCHES_PER_RUN, 'pitches.stage_share': STAGE_SHARE, 'pitches.invites_per_run': INVITES_PER_RUN, 'pitches.invites_per_week': INVITES_A_WEEK, 'pitches.show_shares.makeyourmindup': 70, 'pitches.show_shares.signal_noise': 30, 'pitches.forms_per_row': FORMS_PER_ROW };
  for (const key of BOUND_KEYS) {
    const b = policy.bounds[key];
    assert.ok(b.min <= value[key] && value[key] <= b.max, `${key}: today's ${value[key]} sits inside ${b.min} to ${b.max}`);
  }
  assert.deepEqual(policyErrors(policy), []);
  assert.deepEqual(visibilityTargets(policy), { podcasts: 2, stages: 1 }, 'the ruled visibility targets are read from the policy');
});

test('the schema is frozen by its SHA-256, and the synthetic example fits it and compiles with its experiment applied', async () => {
  const { createHash } = await import('node:crypto');
  assert.equal(manifest.schemas.week.sha256, createHash('sha256').update(await readFile(new URL(manifest.schemas.week.file, root))).digest('hex'));
  assert.equal(WEEK_SCHEMA.title, 'growth-week/1');
  assert.deepEqual(schemaErrors(WEEK_SCHEMA, example), []);
  const c = compile(example, policy, { weekOf: example.week_of });
  assert.equal(c.ok, true);
  assert.equal(c.caps.pitches.stage_share, 5, 'the one experiment is the one change');
  assert.deepEqual(c.changes, ['pitches.stage_share 5 (today 4, a wider setting inside its bound)']);
  assert.equal(c.caps.assets[0].url, 'https://mindmake.co/media/synthetic-one-sheet.pdf');
});

test('a spec can never loosen a bound or add spend: each is refused, never clamped', () => {
  const base = () => clone(defaultSpec({ weekOf: WEEK }));
  const tryIt = change => { const s = base(); change(s); return compile(s, policy, { weekOf: WEEK }); };
  const refused = (change, reason, why) => { const c = tryIt(change); assert.equal(c.ok, false, why); assert.equal(c.reason, reason, why); assert.equal(c.caps, undefined, `${why}: no caps, so nothing is clamped`); };
  refused(s => { s.fit_floor = 39; }, 'spec_schema', 'the floor is 40 or higher');
  refused(s => { s.fit_floor = 95; }, 'spec_out_of_bounds', 'above the policy bound');
  refused(s => { s.pitches.per_run = 11; }, 'spec_out_of_bounds', 'more Jonny drafts than a day takes');
  refused(s => { s.rows.network.max = 9; }, 'spec_out_of_bounds', 'a row past its bound');
  refused(s => { s.pitches.show_shares = { makeyourmindup: 40, signal_noise: 60 }; }, 'spec_out_of_bounds', 'the shows\' split past its bound');
  refused(s => { s.pitches.show_shares = { makeyourmindup: 70, signal_noise: 20 }; }, 'spec_out_of_bounds', 'shares add up to 100');
  refused(s => { s.pitches.stage_share = 8; s.pitches.per_run = 6; }, 'spec_out_of_bounds', 'stages come out of the run');
  refused(s => { s.experiment = { ...clone(example.experiment), change: { field: 'pitches.per_run', to: 11 } }; }, 'spec_out_of_bounds', 'an experiment is bounded too');
  refused(s => { s.experiment = { ...clone(example.experiment), measure: 'tagged_visits_14d' }; }, 'spec_schema', 'traffic is never the first measure');
  refused(s => { s.bounds = { fit_floor: { min: 0, max: 100 } }; }, 'spec_schema', 'no field can carry a bound');
  refused(s => { s.amount_usd = 50; }, 'spec_spend', 'no amount');
  refused(s => { s.experiment = { ...clone(example.experiment), change: { field: 'pitches.per_run', to: 9, cost_usd: 1 } }; }, 'spec_spend', 'no cost, however deep');
  refused(s => { s.send_authority = 'any'; }, 'spec_spend', 'no authority');
  refused(s => { s.week_of = '2026-11-10'; }, 'spec_week', 'a week starts on its Monday');
  assert.equal(compile(defaultSpec({ weekOf: '2026-11-16' }), policy, { weekOf: WEEK }).reason, 'spec_week', 'a spec is for its own week only');
  // The policy itself must carry no authority and bound every cap, or nothing compiles.
  assert.equal(compile(base(), { ...policy, spend_authority: 'capped' }, { weekOf: WEEK }).reason, 'policy_unsafe');
  assert.equal(compile(base(), { ...policy, bounds: { ...policy.bounds, fit_floor: { min: 30, max: 90, direction: 'up_is_safer' } } }, { weekOf: WEEK }).reason, 'policy_unsafe', 'a bound under the floor is refused');
  const { 'pitches.per_run': gone, ...fewer } = policy.bounds;
  assert.equal(compile(base(), { ...policy, bounds: fewer }, { weekOf: WEEK }).reason, 'policy_unsafe', 'a cap with no bound is refused');
  assert.equal(compile(base(), { ...policy, limits: { ...policy.limits, jonny_drafts_per_day: 20 } }, { weekOf: WEEK }).reason, 'policy_unsafe', 'Control Center takes ten a day');
  // Inside the bounds, his choices compile, each said with its direction.
  const c = tryIt(s => { s.pitches.per_run = 6; s.fit_floor = 50; s.rows.partners.on = false; });
  assert.equal(c.ok, true);
  assert.equal(c.caps.spend_usd, 0);
  assert.deepEqual(c.changes, ['fit_floor 50 (today 40, the safer way)', 'pitches.per_run 6 (today 10, the safer way)', 'partners off']);
});

test('an oversized spec is held as spec_too_long, never thrown', async () => {
  const huge = { ...defaultSpec({ weekOf: WEEK }), notes: 'x'.repeat(SPEC_MAX) };
  assert.equal(compile(huge, policy, { weekOf: WEEK }).reason, 'spec_too_long');
  const tooLong = { ...defaultSpec({ weekOf: WEEK }), questions: Array(5).fill('q'.repeat(300)) };
  assert.ok(specProposal({ spec: { ...tooLong, questions: Array(30).fill('q'.repeat(300)) }, expiresAt: null }).hold, 'a proposal longer than the protocol allows is not built');
  // A proposed spec file that is too long: held, not posted, and the run still reports.
  const { result, report } = await onStandIn([], NOW, { specReader: async w => w === WEEK ? JSON.stringify(huge) : null });
  assert.equal(result.status, 'succeeded');
  assert.ok(report.holds.some(h => h.reason === 'spec_too_long'));
  assert.equal(specAsk(report), undefined);
  // His version too long: held, and today's settings stay.
  const { result: r2, report: rep2 } = await onStandIn([amend(`gms-${WEEK}`, JSON.stringify(huge))]);
  assert.equal(r2.status, 'succeeded');
  assert.ok(rep2.holds.some(h => h.reason === 'spec_too_long'));
  assert.ok(rep2.holds.some(h => h.reason === 'spec_unsigned'));
});

test('before the week of 9 November nothing changes: no spec is posted, no line, no hold', async () => {
  const pre = weekSpec({ weekOf: '2026-11-02', decisions: [], policy, specFor: () => { throw new Error('never read'); }, finish: p => p, expiresAt: () => null, ask: true });
  assert.deepEqual({ era: pre.era, post: pre.post, holds: pre.holds, lines: pre.lines }, { era: false, post: null, holds: [], lines: [] });
  assert.deepEqual(pre.caps, todaysCaps(policy));
  let read = 0;
  const { report } = await onStandIn([], '2026-11-03T06:00:00Z', { specReader: async () => { read++; return null; } });
  assert.equal(read, 0, 'no spec file is even read');
  assert.ok(report.proposals.some(p => p.proposal_id === 'gmg-2026-10-26'), 'the Monday ask stands as it is');
  assert.equal(report.proposals.some(p => p.proposal_id.startsWith('gms-')), false);
  assert.equal(report.holds.some(h => h.reason.startsWith('spec_')), false);
});

test('approve round trip on the stand-in: one Monday ask carries the spec and last week\'s counts; his Clear signs it', async () => {
  const decisions = [];
  const first = await onStandIn(decisions);
  assert.equal(first.result.status, 'succeeded');
  const ask = specAsk(first.report);
  assert.ok(ask, 'the spec is on his list');
  assert.deepEqual([ask.kind, ask.wall, ask.stage, ask.parent_proposal_id, ask.objective_key], ['prepared', 'strategy', 'plan', null, 'good_meetings']);
  assert.equal(ask.expires_at, londonMidnight('2026-11-16'), 'it expires at the end of its London week');
  assert.equal(first.report.proposals.some(p => p.proposal_id.startsWith('gmg-')), false, 'the counts ask is folded in: one Monday ask');
  const payload = JSON.parse(ask.exact_payload);
  assert.deepEqual(schemaErrors(WEEK_SCHEMA, payload), []);
  assert.deepEqual(Object.keys(payload.last_week.by_path), PATHS);
  assert.ok(Object.values(payload.last_week.by_path).every(v => v === null) && payload.last_week.good_meetings_total === null, 'every count null: unknown, never zero');
  assert.equal(payload.compiled.north_star_sha, NORTH_STAR_SHA);
  assert.equal(payload.compiled.week_target, 8, 'the rung for the week, from the ladder');
  assert.ok(first.report.holds.some(h => h.reason === 'spec_unsigned'), 'until he signs, today\'s settings apply and say so');
  assert.match(lines(first.report).find(l => l.startsWith('Week spec')), /not signed, so today's settings apply\. It is on his list to sign\./);
  // The digest never changes on its own: a later run that week asks the same thing.
  const thursday = await onStandIn(decisions, '2026-11-12T06:00:00Z');
  assert.equal(specAsk(thursday.report).payload_sha256, ask.payload_sha256);
  decisions.push(clear(ask));
  const signed = await onStandIn(decisions);
  assert.equal(specAsk(signed.report), undefined, 'a signed spec is not asked again');
  assert.equal(signed.report.holds.some(h => h.reason === 'spec_unsigned'), false);
  assert.match(lines(signed.report).find(l => l.startsWith('Week spec')), /signed by his Clear, in force: every row on, 6 a row; fit floor 40; up to 10 Jonny drafts a run/);
  const gm = signed.report.objectives.find(o => o.key === 'good_meetings');
  assert.equal(gm.value, null);
  assert.match(gm.reason, /without typing his numbers/, 'a Clear without his numbers counts nothing');
});

test('amend round trip on the stand-in: his version is signed only after its digest is recomputed, and it counts the week', async () => {
  const { report } = await onStandIn([]);
  const ask = specAsk(report);
  const his = JSON.parse(ask.exact_payload);
  his.pitches.per_run = 6; his.fit_floor = 50;
  his.last_week = { good_meetings_total: 3, by_path: { ...his.last_week.by_path, podcast: 2 } };
  const words = JSON.stringify(his);
  const tampered = await onStandIn([amend(ask.proposal_id, words, { amended_sha256: 'b'.repeat(64) })]);
  assert.ok(tampered.report.holds.some(h => h.reason === 'amended_digest_mismatch'));
  assert.ok(tampered.report.holds.some(h => h.reason === 'spec_unsigned'), 'a version whose digest fails is never used');
  assert.equal(tampered.report.objectives.find(o => o.key === 'good_meetings').value, null);
  const signed = await onStandIn([amend(ask.proposal_id, words)]);
  assert.equal(specAsk(signed.report), undefined);
  const line = lines(signed.report).find(l => l.startsWith('Week spec'));
  assert.match(line, /signed by his version/);
  assert.match(line, /fit_floor 50 \(today 40, the safer way\), pitches\.per_run 6 \(today 10, the safer way\)/);
  const gm = signed.report.objectives.find(o => o.key === 'good_meetings');
  assert.deepEqual([gm.value, gm.availability, gm.window_start], [3, 'measured', londonMidnight('2026-11-02')], 'his typed counts are last week\'s number');
  assert.equal(readSpecCounts([amend(ask.proposal_id, words)], WEEK, payloadDigest).state, 'counted');
});

test('an amended spec that fails the schema or loosens a bound is held spec_amended_invalid, and the last valid signed spec stays in force', async () => {
  // Week of 9 November, signed by his Clear.
  const { report } = await onStandIn([]);
  const nine = specAsk(report);
  const signedNine = clear(nine, { decided_at: '2026-11-09T08:00:00Z' });
  // Week of 16 November: his version asks for 20 drafts a run and a floor of 30.
  const at = '2026-11-17T06:00:00Z';
  const first = await onStandIn([signedNine], at);
  const sixteen = specAsk(first.report, '2026-11-16');
  assert.ok(sixteen, 'the new week is asked for');
  assert.match(lines(first.report).find(l => l.startsWith('Week spec')), /the spec he signed for 2026-11-09 stays in force, up to 7 days/);
  assert.equal(first.report.holds.some(h => h.reason === 'spec_unsigned'), false, 'last week\'s signed spec is not unsigned');
  for (const loosen of [s => { s.pitches.per_run = 20; }, s => { s.fit_floor = 30; }, s => { s.spend = 5; }, s => { delete s.rows; }]) {
    const his = JSON.parse(sixteen.exact_payload); loosen(his);
    const { result, report: held } = await onStandIn([signedNine, amend(sixteen.proposal_id, JSON.stringify(his), { decided_at: '2026-11-16T09:00:00Z' })], at);
    assert.equal(result.status, 'succeeded');
    assert.ok(held.holds.some(h => h.reason === 'spec_amended_invalid'), 'his version is held');
    assert.match(lines(held).find(l => l.startsWith('Week spec')), /the spec he signed for 2026-11-09 stays in force/, 'the last valid signed spec stays');
  }
  // No signed spec within 7 days: today's settings, with the hold.
  const late = await onStandIn([signedNine], '2026-11-24T06:00:00Z');
  assert.ok(late.report.holds.some(h => h.reason === 'spec_unsigned'));
  assert.ok(specAsk(late.report, '2026-11-23'));
});

test('a signed spec never reaches prepare-action: only campaign plans do (N18)', async () => {
  const { report } = await onStandIn([]);
  const ask = specAsk(report);
  const prepared = [];
  const reports = [];
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directiveFixture(), capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { exact_actions: true } }),
    decisions: async () => [clear(ask), { proposal_id: 'gmc-plain', decision: 'approved', decided_at: NOW, payload_sha256: 'd'.repeat(64), stage: 'plan', amended: false }],
    readReport: async () => { const r = reports.at(-1); if (!r) throw Object.assign(new Error('none'), { status: 404 }); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, report: r }; },
    postReport: async r => { reports.push(r); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
    prepareAction: async id => { prepared.push(id); throw new Error('no route'); },
    actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); }, executeAction: async () => { throw new Error('no executor'); }
  };
  await runDispatch({ cc, source: hold, policy, registry: {}, mode: 'live', attemptId: 'gma-spec-live-12345678', clock: () => NOW, specReader: noFiles });
  assert.deepEqual(prepared, ['gmc-plain']);
});

test('the counts ask folds in only while his taps are not served; a proposed spec file is posted by its blob SHA', () => {
  const finish = p => ({ ...p, payload_sha256: payloadDigest(p) });
  const base = { weekOf: WEEK, decisions: [], policy, finish, expiresAt: w => londonMidnight(w) };
  const taps = weekSpec({ ...base, specFor: w => ({ spec: defaultSpec({ weekOf: w }) }), ask: false });
  assert.deepEqual(JSON.parse(taps.post.exact_payload).last_week, { good_meetings_total: null, by_path: {} }, 'with his taps served, the spec asks no counts');
  assert.doesNotMatch(taps.post.title, /good meetings/);
  const text = JSON.stringify({ ...defaultSpec({ weekOf: WEEK }), questions: ['Shall the stage share move to five?'] });
  const filed = weekSpec({ ...base, specFor: () => ({ spec: JSON.parse(text), file: { sha: blobSha(text) } }), ask: true });
  assert.match(filed.post.evidence[0].label, new RegExp(`specs/weeks/${WEEK}\\.json, blob ${blobSha(text)}`));
  assert.deepEqual(JSON.parse(filed.post.exact_payload).questions, ['Shall the stage share move to five?']);
  const bad = weekSpec({ ...base, specFor: () => ({ spec: { ...defaultSpec({ weekOf: WEEK }), fit_floor: 95 } }), ask: true });
  assert.equal(bad.post, null, 'a proposed spec outside a bound is never posted');
  assert.ok(bad.holds.some(h => h.reason === 'spec_invalid'));
  assert.ok(bad.holds.some(h => h.reason === 'spec_unsigned'));
  const declined = weekSpec({ ...base, decisions: [{ proposal_id: `gms-${WEEK}`, decision: 'declined', decided_at: NOW }], specFor: w => ({ spec: defaultSpec({ weekOf: w }) }), ask: true });
  assert.equal(declined.post, null, 'a declined spec is not asked again that week');
  const unread = weekSpec({ ...base, decisions: null, specFor: w => ({ spec: defaultSpec({ weekOf: w }) }), ask: true });
  assert.ok(unread.post && unread.holds.some(h => h.reason === 'spec_unsigned'), 'decisions that cannot be read sign nothing');
  const candidates = [true, false].map(a => { const spec = withCounts(defaultSpec({ weekOf: WEEK }), a); return { spec, proposal: finish(specProposal({ spec, expiresAt: null }).proposal) }; });
  assert.equal(signedSpec({ decisions: [clear({ proposal_id: `gms-${WEEK}`, payload_sha256: 'f'.repeat(64) })], weekOf: WEEK, candidates, policy }).state, 'changed', 'a Clear on words no longer proposed signs nothing');
  assert.equal(signedSpec({ decisions: [clear(candidates[1].proposal)], weekOf: WEEK, candidates, policy }).spec, candidates[1].spec, 'a Clear signs exactly the version it was made on');
  assert.deepEqual(compiledDrift(example, { northStarSha: 'c'.repeat(40), weekGoalsSha: example.compiled.week_goals_sha256, canon: [{ path: 'project-documentation/01_CANON.md', sha: 'd'.repeat(40) }] }).length, 2, 'a moved North Star and canon are lines, never a gate');
});

test('Jonny\'s ten drafts a day: a second wake the same London day writes only what is left', () => {
  const at = '2026-11-10T14:00:00Z';
  const d = (created_at, mailbox = 'jonny') => ({ visibility_target_id: null, mailbox, created_at });
  const drafts = [d('2026-11-10T05:12:00Z'), d('2026-11-10T05:13:00Z'), d('2026-11-09T23:30:00Z'), d('2026-11-10T05:14:00Z', 'krish'), d(null), d('2026-11-10T15:00:00Z')];
  assert.equal(jonnyDraftsToday({ records: { drafts } }, at), 2, 'today\'s Jonny drafts only: not yesterday\'s, not his own box, not undated, not later');
  assert.equal(jonnyDraftsToday({ records: { drafts: [d('2026-06-10T23:30:00Z')] } }, '2026-06-11T08:00:00Z'), 1, 'a summer night past 23:00 UTC is already the next London day');
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const show = n => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', ...STAGE.take, organizer: 'Avery Example', event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, episodes: 80, latest_episode_at: '2026-11-01T00:00:00Z', booking_contact_id: id(100 + n), booking_source: 'feed_owner' });
  const NORTH = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
  const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you'll need. |\n`;
  const canon = { ...parseCanon({ northStar: NORTH, canon: CANON }), files: [] };
  const context = earlier => ({ records: { visibility: Array.from({ length: 12 }, (_, i) => show(i + 1)), drafts: Array.from({ length: earlier }, () => d('2026-11-10T05:12:00Z')) }, feedback: [] });
  const pods = r => r.proposals.filter(p => p.close_condition.reference === 'visibility:pitch').length;
  assert.equal(pods(pitchRows({ context: context(0), weekGoals: [], canon, files: [], at })), 10);
  const second = pitchRows({ context: context(7), weekGoals: [], canon, files: [], at });
  assert.equal(pods(second), 3);
  assert.deepEqual(second.jonny, { used: 7, room: 3 });
  assert.equal(pods(pitchRows({ context: context(10), weekGoals: [], canon, files: [], at })), 0, 'a full day writes none');
  assert.equal(pods(pitchRows({ context: context(0), weekGoals: [], canon, files: [], at, caps: { ...PITCH_CAPS, per_run: 6 } })), 6, 'the spec\'s per_run is read');
  const off = pitchRows({ context: context(0), weekGoals: [], canon, files: [], at, caps: { ...PITCH_CAPS, lanes: { visibility: false, events: true } } });
  assert.equal(pods(off), 0);
  assert.ok(off.held.every(h => h === 'lane_off'), 'a lane the spec turned off writes nothing there');
  assert.deepEqual(shares(9, 4, 2, 4), { podcasts: 0, stages: 2 }, 'a small room never goes negative');
});

test('the rows read their caps: a lane off, a row\'s cap and a higher fit floor; never a lower one', () => {
  const entry = (row, n) => ({ score: n, proposal: { proposal_id: `p${row}${n}`, row, name: 'x' } });
  const entries = [...Array.from({ length: 8 }, (_, i) => entry('network', i)), entry('partners', 1)];
  assert.deepEqual([rankRows(entries).kept.length, rankRows(entries).dropped, rankRows(entries).off], [7, 2, 0]);
  const lanes = { ...DEFAULT_CAPS.rows, network: { on: true, max: 3 }, partners: { on: false, max: 6 } };
  assert.deepEqual([rankRows(entries, lanes).kept.length, rankRows(entries, lanes).dropped, rankRows(entries, lanes).off], [3, 5, 1]);
  assert.equal(fitHold({ mindmake_fit: 45 }), null);
  assert.equal(fitHold({ mindmake_fit: 45 }, 50), 'low_fit');
  assert.equal(fitHold({ mindmake_fit: 35 }, 30), 'low_fit', 'the floor is never under 40');
});

test('rows_rule is read as data only, and the plan-wide digest nobody read is gone (N03, N14)', async () => {
  const rule = 'Put people in front of him by how far his name travels.';
  assert.deepEqual(readDirective(directiveFixture({ rows_rule: rule })).rows_rule, { sha256: payloadDigest(rule), length: rule.length });
  assert.equal(readDirective(directiveFixture()).rows_rule, null);
  const service = await startProtocolService({ directive: directiveFixture({ rows_rule: rule }), recorded: false });
  try {
    const result = await runDispatch({ cc: engineClient(service.origin, service.token, { fetcher: service.fetcher }), source: hold, policy, registry: {}, mode: 'synthetic', kind: 'spec-rule', attemptId: 'gma-spec-rule-0001', clock: () => NOW, specReader: noFiles });
    const report = service.reports.get(result.run_id).report;
    assert.ok(lines(report).some(l => l.includes(`rows rule was read as data only (sha256 ${payloadDigest(rule).slice(0, 12)}`)));
    assert.equal(JSON.stringify(report).includes(rule), false, 'its words are never copied into the report');
  } finally { await service.close(); }
  const plan = strategicPlan({ observed_at: NOW, coverage: [], records: {} }, { at: NOW });
  assert.equal('digest' in plan, false);
  assert.deepEqual(plan.allocation, { multiplier_institution: 0.7, direct_learning: 0.3, rebalance_every_days: 14 });
  assert.deepEqual(strategicPlan({ observed_at: NOW, coverage: [], records: {} }, { at: NOW, allocation: policy.acquisition }).allocation, plan.allocation, 'the allocation is the policy\'s, unchanged');
  assert.ok(FIRST_SPEC_WEEK === WEEK);
  assert.ok(withCounts(defaultSpec({ weekOf: WEEK }), true).last_week.by_path.podcast === null);
});

test('the signed caps reach the stages in a dispatch run, and a second wake the same day writes only Jonny\'s room', async () => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const show = n => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', ...STAGE.take, organizer: 'Avery Example', event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, episodes: 80, latest_episode_at: '2026-11-01T00:00:00Z', booking_contact_id: id(100 + n), booking_source: 'feed_owner' });
  const NORTH = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
  const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you'll need. |\n`;
  const canon = { ...parseCanon({ northStar: NORTH, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
  const served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0'];
  const { report: asked } = await onStandIn([]);
  const his = JSON.parse(specAsk(asked).exact_payload);
  his.pitches.per_run = 6;
  const signed = amend(specAsk(asked).proposal_id, JSON.stringify(his));
  const runWith = async (decisions, earlier) => {
    const reports = [];
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
      context: async () => ({ ok: true, context: { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [], visibility: Array.from({ length: 12 }, (_, i) => show(i + 1)), drafts: Array.from({ length: earlier }, (_, i) => ({ visibility_target_id: null, mailbox: 'jonny', created_at: '2026-11-10T05:12:00Z' })) }, amplifier_candidates: [], routes: {}, feedback: [], research: [] } }),
      decisions: async () => decisions, postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: `gma-spec-caps-${earlier}-${decisions.length}-1234`, clock: () => '2026-11-10T14:00:00Z', specReader: noFiles,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null });
    assert.equal(result.status, 'succeeded');
    const rep = reports[0];
    return { rep, jonny: rep.proposals.filter(p => { try { return JSON.parse(p.exact_payload).mailbox === 'jonny'; } catch { return false; } }).length };
  };
  assert.equal((await runWith([], 0)).jonny, 10, 'unsigned: today\'s ten');
  assert.equal((await runWith([signed], 0)).jonny, 6, 'his signed per_run of six is what the stage writes');
  const second = await runWith([], 8);
  assert.equal(second.jonny, 2, 'a wake later the same day writes only the two left of Jonny\'s ten');
  assert.ok(lines(second.rep).some(l => l === "Jonny's Gmail already holds 8 drafts made today, so this run writes at most 2 more."));
});
