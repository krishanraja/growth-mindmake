import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVisibilityAxes, visibilityVerdict, isDeadDate, judgmentFrom, judgeStage, needsJudging, legacyRelevanceOutOfTen, axesOf, verdictOf, standardView, verdictFromAxes, visibilityShadow, shadowLine,
  VISIBILITY_WEIGHTS, VISIBILITY_FLOORS, VISIBILITY_SCORE_VERSION, STRETCH_CAP, REJECT_REASONS, clamp } from '../src/stages/visibility.mjs';

// The visibility standard, ported from Control Center (plan section 12, M4).
// Every stage and id below is invented. Each test names the Control Center
// test or guard rule it ports; the expected values are Control Center's own
// answers for the same input (read with its functions on 27 October 2026).
//
// Parity table (Control Center source: engine test):
//   check-visibility-standard rule 1, trade title refused:         a mean would pass a trade title; the minimum refuses it
//   check-visibility-standard rule 1, founders' dinner stretch:     a small room of owners with his angle is a marked stretch
//   check-visibility-standard rule 1, generic angle refused:        an angle anyone could give is refused whatever the room
//   check-visibility-standard rule 2, gate order:                   the first gate that matches names the reason
//   check-visibility-standard rule 3, generic by construction:      an empty angle or one feeding neither channel is generic
//   check-visibility-standard rule 4, thin is not a zero:           a thin reply is unjudged with no axes; a passed date has no axes
//   check-visibility-standard rule 5, one taxonomy:                 every refusal the gates emit is in REJECT_REASONS
//   check-visibility-standard rule 6, the legacy scale:             9 is 9, 88 is 8.8, nothing is null
//   check-visibility-standard rules 7 and 8, cap and version:       the stretch lane is capped at 2, the view reads only version 1
//   check-visibility-standard rule 11, dates are arithmetic:        2020 is dead, 2099 and rubbish are not
//   check-visibility-standard rule 12, the weights' sentences:      deciders reward, the rest cost the room
//   visibilityStandard.ts applyStandard:                            the view partitions by verdict and drops a passed date
//   visibility-targets/score.ts, its queue:                         never judged, older version, or 45 days old

const AT = '2026-10-27T09:00:00.000Z';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const TRADE_TITLE = { decider_density: 20, practitioner_density: 10, vendor_density: 10, press_density: 85, seniority: 60, platform_standing: 92, platform_reach_quality: 70, angle_ownership: 35 };
const FOUNDERS_DINNER = { decider_density: 90, practitioner_density: 5, vendor_density: 10, press_density: 0, seniority: 80, platform_standing: 42, platform_reach_quality: 45, angle_ownership: 88, feeds_channel: 'built with ai' };

test('the standard is the minimum of the three axes, never a mean (rule 1)', () => {
  const a = computeVisibilityAxes(TRADE_TITLE);
  assert.deepEqual(a, { room_score: 0, standing_score: 80, only_him_score: 35, visibility_score: 0 }, "Control Center's answer for the same room");
  assert.equal(a.visibility_score, Math.min(a.room_score, a.standing_score, a.only_him_score));
  assert.ok(a.room_score < VISIBILITY_FLOORS.room, 'a room of journalists is not a room of buyers');
  assert.deepEqual(visibilityVerdict(TRADE_TITLE), { verdict: 'rejected', reject_reason: 'visibility_no_relevant_talk' });
  const b = computeVisibilityAxes(FOUNDERS_DINNER);
  assert.deepEqual(b, { room_score: 83, standing_score: 50, only_him_score: 88, visibility_score: 50 });
  assert.deepEqual(visibilityVerdict(FOUNDERS_DINNER), { verdict: 'stretch', reject_reason: null }, "the marked stretch slot is Krish's own refinement");
  const generic = { ...FOUNDERS_DINNER, platform_standing: 80, platform_reach_quality: 80, angle_ownership: 30 };
  assert.deepEqual(visibilityVerdict(generic), { verdict: 'rejected', reject_reason: 'visibility_no_relevant_talk' });
});

test('the first gate that matches names the reason Krish would give (rule 2)', () => {
  const paid = { decider_density: 5, practitioner_density: 95, vendor_density: 40, press_density: 0, seniority: 20, platform_standing: 30, platform_reach_quality: 30, angle_ownership: 90, pay_to_play: true };
  assert.equal(visibilityVerdict(paid).reject_reason, 'visibility_pay_to_play', 'the money is the disqualifier');
  const dead = { decider_density: 95, practitioner_density: 0, vendor_density: 0, press_density: 0, seniority: 90, platform_standing: 95, platform_reach_quality: 90, angle_ownership: 95, dead_date: true };
  assert.equal(visibilityVerdict(dead).reject_reason, 'visibility_bad_timing');
  assert.equal(visibilityVerdict({ ...dead, dead_date: false }).verdict, 'take');
  const technical = { decider_density: 10, practitioner_density: 90, vendor_density: 5, press_density: 0, seniority: 40, platform_standing: 70, platform_reach_quality: 60, angle_ownership: 85 };
  assert.equal(visibilityVerdict(technical).reject_reason, 'visibility_too_technical');
  const press = { decider_density: 15, practitioner_density: 5, vendor_density: 5, press_density: 90, seniority: 65, platform_standing: 70, platform_reach_quality: 60, angle_ownership: 85 };
  assert.equal(visibilityVerdict(press).reject_reason, 'visibility_off_vertical');
  const junior = { decider_density: 50, practitioner_density: 0, vendor_density: 0, press_density: 0, seniority: 30, platform_standing: 80, platform_reach_quality: 80, angle_ownership: 85 };
  assert.equal(visibilityVerdict(junior).reject_reason, 'visibility_too_low_tier');
  const smallPlatform = { ...FOUNDERS_DINNER, platform_standing: 10, platform_reach_quality: 10, seniority: 80 };
  assert.deepEqual(visibilityVerdict(smallPlatform), { verdict: 'rejected', reject_reason: 'visibility_too_low_tier' }, 'below the stretch floor');
});

test('an angle that is empty or feeds neither channel is generic by construction (rule 3)', () => {
  const reply = { ...FOUNDERS_DINNER, angle: 'An angle from his own operating record.', generic_take: false, pay_to_play: false, named_people: [], evidence_thin: false };
  assert.equal(judgmentFrom(reply).generic_take, false);
  assert.equal(judgmentFrom({ ...reply, feeds_channel: 'neither' }).generic_take, true);
  assert.equal(judgmentFrom({ ...reply, feeds_channel: 'something else' }).feeds_channel, 'neither');
  assert.equal(judgmentFrom({ ...reply, angle: '   ' }).generic_take, true);
  assert.equal(judgmentFrom({ ...reply, feeds_channel: 'Built With AI' }).feeds_channel, 'built with ai');
  assert.equal(judgmentFrom({ ...reply, pay_to_play: 'true' }).pay_to_play, false, 'only a true is bought');
  assert.deepEqual(judgmentFrom({ ...reply, named_people: [' Ada Example, CEO at Example Co ', '', 3] }).named_people, ['Ada Example, CEO at Example Co']);
});

test('thin evidence is unjudged with no axes, never a zero; a passed date needs no judge (rule 4)', () => {
  const live = { id: id(1), event_start_at: '2099-01-01T00:00:00Z' };
  assert.equal(judgmentFrom({ evidence_thin: true }), null);
  assert.deepEqual(judgeStage(live, { evidence_thin: true }, AT), { room_score: null, standing_score: null, only_him_score: null, visibility_score: null, verdict: 'unjudged', reject_reason: null, score_version: 1 });
  assert.deepEqual(judgeStage({ ...live, event_start_at: '2020-01-01T00:00:00Z' }, FOUNDERS_DINNER, AT), { room_score: null, standing_score: null, only_him_score: null, visibility_score: null, verdict: 'rejected', reject_reason: 'visibility_bad_timing', score_version: 1 });
  assert.deepEqual(judgeStage(live, 'not an object', AT), { failed: 'visibility_score_unparseable' }, 'an unreadable reply writes nothing');
  assert.throws(() => judgmentFrom(null), /visibility_score_unparseable/);
  const judged = judgeStage(live, { ...FOUNDERS_DINNER, angle: 'His angle.', named_people: [] }, AT);
  assert.equal(judged.verdict, 'stretch');
  assert.equal(judged.visibility_score, 50);
});

test('every refusal the gates can name is in the one taxonomy (rule 5)', () => {
  const seen = new Set();
  let seed = 7;
  const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * 101); };
  for (let i = 0; i < 4000; i++) {
    const d = Array.from({ length: 8 }, next);
    const r = k => d[k - 1];
    const v = visibilityVerdict({ decider_density: r(1), practitioner_density: r(2), vendor_density: r(3), press_density: r(4), seniority: r(5), platform_standing: r(6), platform_reach_quality: r(7), angle_ownership: r(8), pay_to_play: i % 17 === 0, generic_take: i % 13 === 0, dead_date: i % 19 === 0 });
    if (v.verdict === 'rejected') { assert.ok(REJECT_REASONS.includes(v.reject_reason), v.reject_reason); seen.add(v.reject_reason); }
    else assert.equal(v.reject_reason, null);
  }
  assert.ok(seen.size >= 6, 'the gates still tell the ways a stage can be wrong apart');
});

test('the legacy column is read on its two scales and never as a default (rule 6)', () => {
  assert.equal(legacyRelevanceOutOfTen(9), 9);
  assert.equal(legacyRelevanceOutOfTen(88), 8.8);
  assert.equal(legacyRelevanceOutOfTen('88'), 8.8);
  assert.equal(legacyRelevanceOutOfTen(null), null);
  assert.equal(legacyRelevanceOutOfTen('not a number'), null);
});

test('the stretch lane is capped at two and the view reads only the current version (rules 7 and 8)', () => {
  assert.equal(STRETCH_CAP, VISIBILITY_FLOORS.stretchCap);
  assert.equal(STRETCH_CAP, 2);
  assert.equal(VISIBILITY_SCORE_VERSION, 1);
  const row = (n, over) => ({ id: id(n), status: 'queued', score_version: 1, verdict: 'stretch', room_score: 70, standing_score: 40 + n, only_him_score: 80, updated_at: '2026-10-01T00:00:00Z', ...over });
  const view = standardView([
    row(1), row(2), row(3), row(4, { verdict: 'take', standing_score: 70 }), row(5, { verdict: 'take', standing_score: 80, deadline_at: '2026-10-01T00:00:00Z' }),
    row(6, { verdict: 'rejected', status: 'applied' }), row(7, { verdict: 'rejected', buried_at: '2026-10-02T00:00:00Z' }), row(8, { verdict: 'unjudged' }), row(9, { score_version: 0 }), row(10, { verdict: null }),
  ], AT);
  assert.deepEqual(view.stretch.map(r => r.id), [id(3), id(2)], 'the two strongest stretches, best first');
  assert.deepEqual(view.take.map(r => r.id), [id(4)], 'a take whose deadline passed is dropped');
  assert.deepEqual(view.refused.map(r => r.id), [id(6)], 'a refusal is kept whatever its status, unless buried');
  assert.deepEqual(view.unjudged.map(r => r.id), [id(8)]);
  assert.deepEqual(view.awaiting.map(r => r.id), [id(9), id(10)], 'an older version is awaiting, never mixed in');
  assert.equal(view.neverRun, false);
  assert.equal(standardView([row(1, { score_version: 0 })], AT).neverRun, true);
  assert.deepEqual(axesOf(row(1, { score_version: 0 })), { room: null, standing: null, onlyHim: null, overall: null });
  assert.equal(axesOf(row(1)).overall, 41, 'the minimum, when visibility_score is not served');
  assert.equal(axesOf(row(1, { visibility_score: 12 })).overall, 12, 'the stored figure when it is');
  assert.equal(verdictOf(row(1, { verdict: 'other' })), null);
});

test('a date is arithmetic, not a judgement (rule 11)', () => {
  assert.equal(isDeadDate({ event_start_at: '2020-01-01T00:00:00Z' }, AT), true);
  assert.equal(isDeadDate({ event_start_at: '2099-01-01T00:00:00Z' }, AT), false);
  assert.equal(isDeadDate({ event_start_at: 'not a date' }, AT), false, 'an unknown date is not a passed one');
  assert.equal(isDeadDate({ event_start_at: null, deadline_at: null }, AT), false, 'a podcast has no date and is not dead');
  assert.equal(isDeadDate({ event_start_at: '2099-01-01T00:00:00Z', deadline_at: '2026-10-26T00:00:00Z' }, AT), true, 'a passed deadline is enough');
});

test('the weights still say the sentences their comment claims (rule 12)', () => {
  const w = VISIBILITY_WEIGHTS;
  assert.ok(w.room.decider > 0);
  for (const [k, v] of Object.entries(w.room)) if (k !== 'decider' && k !== 'seniority') assert.ok(v < 0, `${k} is a penalty`);
  assert.ok(Object.values(w.standing).every(v => v > 0));
  assert.ok(VISIBILITY_FLOORS.room > 50 && VISIBILITY_FLOORS.onlyHim > 50);
  assert.ok(VISIBILITY_FLOORS.stretchStanding < VISIBILITY_FLOORS.standing);
  assert.equal(clamp(Number.POSITIVE_INFINITY), 0);
  assert.equal(clamp(-4), 0);
  assert.equal(clamp(140), 100);
});

test('a named person adds a bounded bonus to standing, only in a room that already reads right', () => {
  const base = { decider_density: 80, practitioner_density: 0, vendor_density: 0, press_density: 0, seniority: 70, platform_standing: 50, platform_reach_quality: 50, angle_ownership: 80 };
  const plain = computeVisibilityAxes(base).standing_score;
  assert.equal(computeVisibilityAxes({ ...base, named_people: ['Ada Example, CEO at Example Co'] }).standing_score, plain + 5);
  assert.equal(computeVisibilityAxes({ ...base, named_people: ['A', 'B', 'C', 'D'] }).standing_score, plain + 10, 'capped at ten');
  assert.equal(computeVisibilityAxes({ ...base, decider_density: 20, named_people: ['A'] }).standing_score, computeVisibilityAxes({ ...base, decider_density: 20 }).standing_score, 'no bonus below the room bar');
});

test('which stages Control Center judges next: never judged, an older version, or 45 days old', () => {
  const t = { status: 'queued', scored_at: '2026-10-20T00:00:00Z', score_version: 1 };
  assert.equal(needsJudging(t, AT), false);
  assert.equal(needsJudging({ ...t, scored_at: null }, AT), true);
  assert.equal(needsJudging({ ...t, score_version: 0 }, AT), true);
  assert.equal(needsJudging({ ...t, scored_at: '2026-09-01T00:00:00Z' }, AT), true);
  assert.equal(needsJudging({ ...t, status: 'applied', scored_at: null }, AT), false, 'a stage he applied to is left alone');
  assert.equal(needsJudging({ ...t, buried_at: '2026-10-01T00:00:00Z', scored_at: null }, AT), false);
});

test('from stored axes the engine reaches the same verdict, and says when it cannot', () => {
  const r = { room_score: 70, standing_score: 60, only_him_score: 80 };
  assert.deepEqual(verdictFromAxes(r, AT), { verdict: 'take', reject_reason: null });
  assert.deepEqual(verdictFromAxes({ ...r, standing_score: 40 }, AT), { verdict: 'stretch', reject_reason: null });
  assert.deepEqual(verdictFromAxes({ ...r, only_him_score: 50 }, AT), { verdict: 'rejected', reject_reason: 'visibility_no_relevant_talk' });
  assert.deepEqual(verdictFromAxes({ ...r, room_score: 50 }, AT), { verdict: 'rejected', reject_reason: null }, 'which wrong room needs the densities, which are not served');
  assert.deepEqual(verdictFromAxes({ room_score: null, standing_score: null, only_him_score: null }, AT), { verdict: 'unjudged', reject_reason: null });
  assert.deepEqual(verdictFromAxes({ room_score: null, deadline_at: '2026-10-01T00:00:00Z' }, AT), { verdict: 'rejected', reject_reason: 'visibility_bad_timing' });
});

test('in shadow: the engine beside Control Center, in counts only, with nothing changed', () => {
  const st = (n, over) => ({ id: id(n), title: `The Example Stage ${n}`, type: 'podcast', status: 'queued', score_version: 1, room_score: 70, standing_score: 60, only_him_score: 80, verdict: 'take', ...over });
  const context = { records: { visibility: [
    st(1), st(2, { standing_score: 40, verdict: 'stretch' }), st(3, { only_him_score: 40, verdict: 'rejected' }),
    st(4, { verdict: 'rejected' }), st(5, { deadline_at: '2026-10-20T00:00:00Z' }), st(6, { room_score: 20, verdict: 'take' }),
    st(7, { verdict: null }), st(8, { score_version: 0 }), st(1),
    st(9, { room_score: null, standing_score: null, only_him_score: null, verdict: 'unjudged' }),
    st(10, { room_score: null, standing_score: null, only_him_score: null, verdict: 'rejected', event_start_at: '2026-09-01T00:00:00Z' }),
  ] } };
  const frozen = structuredClone(context);
  const out = visibilityShadow({ context, at: AT, canon: { files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: 'b'.repeat(40) }] } });
  assert.equal(out.line, 'Visibility standard, in shadow: 10 stages read; agrees with Control Center on 5, differs on 3 (axes_disagree 1, date_passed_since 1, flag_not_served 1); 2 not comparable (not_judged 2).');
  assert.deepEqual(context, frozen, 'the context is read, never changed');
  assert.equal(out.verdicts.length, 10, 'one verdict a stage, a repeated stage once');
  assert.deepEqual(out.verdicts.find(v => v.subject_ref === `target:${id(4)}`), { subject_ref: `target:${id(4)}`, verdict: 'take', reject_reason: null, control_center: 'rejected', agrees: false, code: 'flag_not_served' });
  assert.equal(out.source_revision.length, 1, 'it names the canon files it rests on');
  assert.doesNotMatch(out.line, /Example Stage|0000/, 'counts only: no title, no id');
  assert.equal(visibilityShadow({ context: null, at: AT }).line, 'Visibility standard, in shadow: 0 stages read; agrees with Control Center on 0, differs on 0.');
  assert.equal(shadowLine('X', ['row', 'rows'], { read: 1, agree: 1 }), 'X, in shadow: 1 row read; agrees with Control Center on 1, differs on 0.');
});
