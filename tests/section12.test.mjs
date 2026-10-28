import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDispatch } from '../src/dispatch.mjs';
import { capsContext } from './support/caps-scenario.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { canon, AT, id } from './support/section12.mjs';
import { withoutCrew } from './support/golden.mjs';

// Plan section 12, M6, M9 and M12, then M7, M10 and M13, on the protocol
// stand-in: each ported piece reports one counted line beside Control Center's
// own answers, after the M3 to M5 lines, and holds, hides or changes nothing.
// Synthetic throughout.

const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
const HEADS = ['Guest standard, in shadow: ', 'Visibility standard, in shadow: ', 'Room scoring, in shadow: ', 'Pilot machine, in shadow: ', 'Outreach briefs, in shadow: ', 'Ingest gate, in shadow: ',
  'Focus playbooks, in shadow: ', 'Suppression, in shadow: ', 'Places and questions, in shadow: '];

function context() {
  const base = capsContext();
  return {
    ...base,
    network: [{ contact_id: id(101), current_title: 'Founder', contacts: { title: 'Founder' } }, { contact_id: id(102), current_title: 'Managing Partner', contacts: { title: 'Managing Partner' } }],
    records: { ...base.records, advisory: [
      { id: id(1), contact_id: id(101), state: 'listed', ask_kind: 'buyer', notes: null },
      { id: id(2), contact_id: id(102), state: 'drafted', ask_kind: 'buyer', draft_subject: 'A thought', draft_body: 'Would a paid three week pilot help? Worth a short call?' },
    ] },
  };
}

async function run(ctx) {
  const reports = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: ctx }),
    decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1),
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-section12-1234', clock: () => AT,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null });
  return { result, report: reports[0] ?? null };
}

test('plan section 12, M6, M9, M12, then M7, M10 and M13: each reports one counted line after M3 to M5, carries counts only and holds nothing', async () => {
  const ctx = context();
  const frozen = structuredClone(ctx);
  const { report } = await run(ctx);
  const lines = report.activity.map(a => a.line);
  const at = HEADS.map(h => { const found = lines.filter(l => l.startsWith(h)); assert.equal(found.length, 1, h); return lines.indexOf(found[0]); });
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order, each three after the three before');
  for (const i of at.slice(3)) {
    assert.doesNotMatch(lines[i], /[0-9a-f]{8}-[0-9a-f]{4}-|@|https?:\/\/|Avery|Example|three week|pilot\?/, `${lines[i]} carries counts and codes only, never an id, an address, a link, a name or a word of a note`);
    assert.doesNotMatch(lines[i], /could not be read this run/, 'each read cleanly');
  }
  assert.match(lines[at[3]], /^Pilot machine, in shadow: 2 Advisory rows read; agrees with Control Center on 1, differs on 1 \(buyer_outside_canon_groups 1\)\./);
  assert.match(lines[at[3]], /Words: 1 drafted note read, 0 say only what the canon supports \(duration_promise 1, offer_named_otherwise 1\)\.$/);
  assert.match(lines[at[5]], /^Ingest gate, in shadow: 0 contacts read; .*Pinned offer copy: not compared this run\.$/, 'no legacy snapshot served, so nothing compared and nothing assumed');
  // Plan section 12, M7, M10 and M13: three more lines after those six, counts and codes only, and the switch's line still after them.
  assert.match(lines[at[6]], /^Focus playbooks, in shadow: 3 picks read; agrees with Control Center on 3, differs on 0\. Plays: 15 of Control Center's for Mindmake; .* Rooms: 0 read, not compared \(his city is not served\)\.$/);
  assert.match(lines[at[7]], /^Suppression, in shadow: 0 checks read from 0 answers; agrees with Control Center on 0, differs on 0\. The engine's list: 0 never/);
  assert.match(lines[at[8]], /^Places and questions, in shadow: Control Center's probes are not served this run, so none are compared\. .* Domains: the canon names 2, not compared with Control Center's list this run\.$/);
  for (const i of at.slice(6)) assert.ok(lines[i].length < 500, 'whole inside the report line');
  assert.ok(lines.findIndex(l => /^Switch readiness: /.test(l)) > at[8], "the switch's readiness line is still reported, after every shadow line");
  assert.ok(report.activity.length <= 40, 'inside the report\'s forty lines');
  assert.equal(report.holds.some(h => /pilot|brief|ingest|canon_buyer|offer|focus|suppress|places/i.test(h.reason)), false, 'nothing is held by them');
  assert.deepEqual(ctx, frozen, 'the context is read, never changed');
  // Without the nine shadow lines the report is the one the same run gives with the shadows unable to see anything.
  const blind = await run({ ...context(), records: { ...context().records, advisory: [] }, network: [] });
  assert.equal(blind.report.proposals.length, report.proposals.length, 'the proposals do not depend on what the shadows read');
  assert.notEqual(withoutCrew(report), report.payload_sha256, 'the golden filter leaves the new lines out');
});

test('a shadow that throws says so in one line and never fails the run', async () => {
  const ctx = { ...context(), source_revision: 'synthetic-revision' };
  // A note only the pilot machine reads, whose words cannot be read: a getter that fails.
  Object.defineProperty(ctx.records.advisory[1], 'draft_body', { get() { throw new Error('unreadable'); }, enumerable: false });
  const { result, report } = await run(ctx);
  assert.ok(report, 'the run still reported');
  assert.notEqual(result.status, 'failed');
  const lines = report.activity.map(a => a.line);
  assert.ok(lines.some(l => /^pilotsShadow: could not be read this run, so it says nothing rather than a guess\.$/.test(l)));
});

// ── M3 to M5: the engine's version acts ────────────────────────────────────
//
// The stages act on the engine's own verdicts (visibility.mjs stageVerdict and
// stageStrength, guests.mjs guestVerdictOf, rooms.mjs roomVerdict), never on
// the verdicts and scores Control Center still stores beside them. Only the
// three files that port a standard read those fields, to judge the axes and to
// count Control Center's answers in shadow.

const CC_FIELDS = ['verdict', 'guest_verdict', 'guest_reason', 'reject_reason', 'room_score', 'standing_score', 'only_him_score', 'visibility_score', 'draw_score', 'demand_score', 'guest_score', 'senior_score', 'seen_score', 'spark_score'];
const READERS = new Set(['src/stages/visibility.mjs', 'src/stages/guests.mjs', 'src/stages/rooms.mjs']);
const names = CC_FIELDS.join('|');
const READS = [
  new RegExp(`(?:\\?\\.|\\.)\\s*(?:${names})\\b`),
  new RegExp(`\\[\\s*['"\`](?:${names})['"\`]\\s*\\]`),
  new RegExp(`(?:\\b(?:const|let|var)\\s*|\\(\\s*)\\{[^}]*\\b(?:${names})\\b[^}]*\\}`),
  new RegExp(`['"\`](?:${names})['"\`]\\s+in\\b`),
];
/** Source without its comments, so a line that names a field in prose is not a read. */
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('no stage reads Control Center\'s verdicts or scores: only the three files that port a standard do', async () => {
  const { readdir } = await import('node:fs/promises');
  const src = new URL('../src/', import.meta.url);
  const files = (await readdir(src, { recursive: true })).filter(f => f.endsWith('.mjs')).map(f => `src/${f.replaceAll('\\', '/')}`).sort();
  assert.ok(files.includes('src/stages/pitches.mjs') && files.includes('src/strategy.mjs') && files.length > 20, 'the scan sees the stages');
  const found = [];
  for (const f of files) {
    if (READERS.has(f)) continue;
    const lines = code(await readFile(new URL(`../${f}`, import.meta.url), 'utf8')).split('\n');
    lines.forEach((l, i) => { if (READS.some(re => re.test(l))) found.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(found, [], 'a stage reads a verdict or a score Control Center stores');
  // The scan is proved able to find a read before its silence is trusted.
  for (const l of ['if (t.verdict === "rejected") return;', 'const w = g?.guest_verdict;', "const v = t['room_score'];", 'const { draw_score } = e;', 'const f = ({ verdict }) => verdict;', "if ('spark_score' in g) x();"]) assert.ok(READS.some(re => re.test(code(l))), l);
  for (const l of ['// t.verdict is Control Center\'s', "reason: 'verdict'", 'const v = stageVerdict(t, at);']) assert.equal(READS.some(re => re.test(code(l))), false, l);
});

test('what Control Center stores as its verdict changes nothing a stage does: the axes served decide', async () => {
  const { stageVerdict, stageStrength } = await import('../src/stages/visibility.mjs');
  const { guestVerdictOf } = await import('../src/stages/guests.mjs');
  const { pitchHold, speakHold, pitchScore, speakScore, inviteHold, stageForm } = await import('../src/stages/pitches.mjs');
  const { lessons } = await import('../src/stages/rows.mjs');
  const L = lessons([], AT), pitched = new Set();
  const STORED = [{}, { verdict: 'take' }, { verdict: 'stretch' }, { verdict: 'rejected' }, { verdict: 'unjudged' }, { verdict: null }];
  const AXES = [{}, { score_version: 1, room_score: 70, standing_score: 70, only_him_score: 60 }, { score_version: 1, room_score: 70, standing_score: 45, only_him_score: 60 }, { score_version: 1, room_score: 40, standing_score: 70, only_him_score: 60 }, { score_version: 0, room_score: 90, standing_score: 90, only_him_score: 90 }];
  const field = (label, name) => ({ label, name, type: 'text', required: true, options: [] });
  const pod = { id: id(901), title: 'The Example Show', type: 'podcast', status: 'queued', organizer: 'Avery Example', booking_contact_id: id(902), latest_episode_at: '2026-10-20T00:00:00Z', episodes: 40, audience: 'Marketing leaders' };
  const conf = { id: id(903), title: 'The Example Summit', type: 'conference', status: 'queued', organizer: 'Example Events Ltd', booking_contact_id: id(904), deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-03-10T00:00:00Z', audience: 'Marketing leaders', cfp_url: 'https://summit.example/speak', form_fields: [field('Full name', 'full_name'), field('Email', 'email')] };
  for (const axes of AXES) {
    const seen = STORED.map(cc => {
      const p = { ...pod, ...axes, ...cc }, s = { ...conf, ...axes, ...cc };
      return JSON.stringify([stageVerdict(p, AT), stageStrength(s), pitchHold(p, { L, pitched, at: AT }), speakHold(s, { L, pitched, at: AT }), pitchScore(p, AT), speakScore(s, AT), stageForm(s, { L, pitched, at: AT, canon })?.hold ?? null]);
    });
    assert.equal(new Set(seen).size, 1, `stage axes ${JSON.stringify(axes)}: the same whatever Control Center stored`);
  }
  const GUEST_AXES = [{}, { senior_score: 70, seen_score: 70, spark_score: 70 }, { senior_score: 70, seen_score: 50, spark_score: 70 }, { senior_score: 70, seen_score: 20, spark_score: 70 }, { senior_score: null, seen_score: null, spark_score: null }];
  const person = { contact_id: id(905), name: 'Avery Example', status: 'enriched', invite_show: 'makeyourmindup', invite_state: null };
  for (const axes of GUEST_AXES) {
    const seen = [{}, { guest_verdict: 'take' }, { guest_verdict: 'stretch' }, { guest_verdict: 'rejected' }, { guest_verdict: null }, { guest_reason: 'guest_wrong_show' }].map(cc => {
      const g = { ...person, ...axes, ...cc };
      return JSON.stringify([guestVerdictOf(g), inviteHold(g, { L, invited: new Set(), routes: { [id(905)]: { email: 'verified' } }, at: AT })]);
    });
    assert.equal(new Set(seen).size, 1, `guest axes ${JSON.stringify(axes)}: the same whatever Control Center stored`);
  }
  // And the axes do decide: a refusal on them holds, a take on them pitches.
  assert.equal(pitchHold({ ...pod, ...AXES[3], verdict: 'take' }, { L, pitched, at: AT }), 'rejected');
  assert.equal(guestVerdictOf({ ...person, ...GUEST_AXES[3], guest_verdict: 'take' }), 'rejected');
  assert.equal(stageVerdict({ ...pod, verdict: 'take' }, AT), 'unjudged', 'no axes served: not judged, never Control Center\'s word for it');
});
