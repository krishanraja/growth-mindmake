import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taxonomy, taxonomyFindings, ROW_DOCTRINE, REASONS, CARRIED, controlCenterAnswers, controlCenterAnsweredLike, engineAnsweredLike, suppressionList, suppressionApplies,
  compareSuppression, suppressionShadow, DIFFERENCES, CC_ANSWERS_READ } from '../src/stages/suppression.mjs';
import { ROWS, KINDS, BANDS } from '../src/stages/rows.mjs';
import { canon, AT, id, daysAgo } from './support/section12.mjs';

// The amplifier taxonomy, the row doctrine and the suppression of his Nos,
// owned by the engine (plan section 12, M10). Control Center's answeredLike
// (src/lib/widgetPlays.ts) and rowAnswers (api/_rowPress.ts) are ported in
// src/stages/suppression.mjs only to be compared here. Synthetic throughout.
//
// Parity table (answeredLike's own rules: the engine's lessons and refusedBy):
//   any No: not this person on that row again                         the same
//   wrong_person, already_in_touch: not this person on any row        the same
//   not_now: not this person for 30 days                              the same
//   carried out by a draft or a message: not this person for 30 days  the same
//   too_small: nothing of that kind at that reach or less             the same
//   wrong_audience: not that kind in that sector, or any sector       the same
//   not_my_topic: not that topic                                      the same
//   pitch_off and other: change the words, suppress no one            the same
//   a 500-case sweep of clean answers and candidates                  the same decision on every one
// Every difference, each a code (DIFFERENCES): undated_answer,
// answer_without_row, carried_state, unknown_kind, blank_sector,
// answers_beyond_cap, band_missing; and reason_named_otherwise where both
// suppress and name another reason.

const S = n => `contact:${id(n)}`;
const answer = (n, over = {}) => ({ proposal_id: `gmp-${n}`, state: 'declined', row: 'reach_out', subject_ref: S(n), decided_at: daysAgo(2), carried_out: null, reason_code: 'wrong_person', amplifier_kind: 'connector', features: { sector: 'media', topic: 'leadership', seniority: null }, reach: { band: '1k_10k' }, ...over });
const cand = (n, over = {}) => ({ row: 'reach_out', subject: S(n), kind: 'connector', sector: 'media', topic: 'leadership', band: '1k_10k', ...over });
const both = (c, fb) => [controlCenterAnsweredLike(c, controlCenterAnswers(fb), AT), engineAnsweredLike(c, fb, AT)];

test('the taxonomy and the doctrine: the engine\'s own, and Control Center\'s copy matches them', () => {
  const t = taxonomy();
  assert.deepEqual(t.rows, ROWS);
  assert.deepEqual(t.kinds, KINDS);
  assert.deepEqual(t.bands, BANDS);
  assert.deepEqual(t.reasons, REASONS);
  assert.deepEqual(t.carried_out, CARRIED);
  // Control Center's REACH_ROWS, AMPLIFIER_KINDS, REACH_BANDS, DECLINE_REASONS and CARRIED_OUT (src/lib/growthEngines.ts),
  // the protocol's shared identifiers, and the numbers ROWS_RULE states (a title of at most 72, a because of at most 80,
  // the title at most 56 with one, a brief of 2 to 6 lines, 1 to 3 card lines).
  const copy = {
    rows: ['reach_out', 'network', 'visibility', 'events', 'partners'],
    kinds: ['investor', 'connector', 'ai_capital', 'ai_trainer', 'student_educator', 'ceo_educator', 'broadcaster'],
    bands: ['under_1k', '1k_10k', '10k_100k', '100k_1m', 'over_1m', 'unknown'],
    reasons: ['wrong_person', 'not_now', 'already_in_touch', 'too_small', 'wrong_audience', 'not_my_topic', 'pitch_off', 'other'],
    carried_out: ['draft', 'message', 'submit'],
    doctrine: { title_max: 72, because_max: 80, title_max_with_because: 56, brief_lines: { min: 2, max: 6 }, card_lines: { min: 1, max: 3 } },
  };
  assert.deepEqual(taxonomyFindings(copy), []);
  assert.deepEqual(taxonomyFindings({ ...copy, kinds: [...copy.kinds, 'celebrity'], doctrine: { ...copy.doctrine, title_max: 60 } }), ['kinds_differ', 'title_max_differs'], 'a copy that drifts is named by code');
  assert.deepEqual(taxonomyFindings(null), ['taxonomy_not_served']);
  assert.ok(Object.isFrozen(ROW_DOCTRINE));
  assert.equal(JSON.stringify(t).length < 2000, true, 'small enough to send');
});

test('parity table: each of answeredLike\'s rules decides what the engine decides', () => {
  const cases = [
    ['any No: not that person on that row', [answer(1, { reason_code: 'other' })], cand(1), 'declined_on_row'],
    ['any No: that person on another row is still free', [answer(1, { reason_code: 'other' })], cand(1, { row: 'network' }), null],
    ['wrong_person: not on any row', [answer(1)], cand(1, { row: 'events' }), 'declined_person'],
    ['already_in_touch: not on any row', [answer(1, { reason_code: 'already_in_touch' })], cand(1, { row: 'partners' }), 'declined_person'],
    ['not_now: paused 30 days on other rows', [answer(1, { reason_code: 'not_now' })], cand(1, { row: 'network' }), 'snoozed'],
    ['not_now: free after 30 days', [answer(1, { reason_code: 'not_now', decided_at: daysAgo(31) })], cand(1, { row: 'network' }), null],
    ['a draft carried out pauses 30 days', [answer(1, { state: 'done', carried_out: 'draft', reason_code: null })], cand(1), 'snoozed'],
    ['a message carried out pauses 30 days', [answer(1, { state: 'approved', carried_out: 'message', reason_code: null })], cand(1, { row: 'network' }), 'snoozed'],
    ['too_small: that kind at that reach or less', [answer(1, { reason_code: 'too_small' })], cand(2, { band: 'under_1k' }), 'below_reach_floor'],
    ['too_small: that kind at that reach', [answer(1, { reason_code: 'too_small' })], cand(2), 'below_reach_floor'],
    ['too_small: a bigger reach is free', [answer(1, { reason_code: 'too_small' })], cand(2, { band: '10k_100k' }), null],
    ['too_small: another kind is free', [answer(1, { reason_code: 'too_small' })], cand(2, { kind: 'investor' }), null],
    ['wrong_audience: that kind in that sector', [answer(1, { reason_code: 'wrong_audience' })], cand(2), 'wrong_audience'],
    ['wrong_audience: that kind in another sector is free', [answer(1, { reason_code: 'wrong_audience' })], cand(2, { sector: 'finance' }), null],
    ['wrong_audience with no sector: that kind anywhere', [answer(1, { reason_code: 'wrong_audience', features: { sector: null, topic: null } })], cand(2, { sector: 'finance' }), 'wrong_audience'],
    ['not_my_topic: that topic', [answer(1, { reason_code: 'not_my_topic' })], cand(2, { kind: 'investor' }), 'not_my_topic'],
    ['pitch_off suppresses nobody else', [answer(1, { reason_code: 'pitch_off' })], cand(2), null],
  ];
  for (const [what, fb, c, expected] of cases) {
    const [cc, engine] = both(c, fb);
    assert.equal(cc, expected, `Control Center: ${what}`);
    assert.equal(engine, expected, `engine: ${what}`);
  }
});

// A small seeded generator, so the sweep is the same every run.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

test('a sweep of 500 clean cases: the same decision every time, and the list the engine would send decides the same', () => {
  const r = rng(27102026), pick = a => a[Math.floor(r() * a.length)];
  let suppressed = 0;
  for (let i = 0; i < 500; i++) {
    const fb = Array.from({ length: 1 + Math.floor(r() * 5) }, (_, k) => {
      const declined = r() < 0.7;
      return answer(1 + Math.floor(r() * 4), {
        proposal_id: `gmp-${i}-${k}`, state: declined ? 'declined' : pick(['approved', 'done']), row: pick(ROWS), decided_at: daysAgo(Math.floor(r() * 60)),
        carried_out: declined ? null : pick(['draft', 'message']), reason_code: declined ? pick(REASONS) : null,
        amplifier_kind: pick(KINDS), features: { sector: pick(['media', 'finance', null]), topic: pick(['leadership', 'venture', null]), seniority: null }, reach: { band: pick(BANDS) },
      });
    });
    const c = cand(1 + Math.floor(r() * 4), { row: pick(ROWS), kind: pick([...KINDS, null]), sector: pick(['media', 'finance', null]), topic: pick(['leadership', 'venture', null]), band: pick(BANDS) });
    const [cc, engine] = both(c, fb);
    assert.equal(cc === null, engine === null, `case ${i}: ${JSON.stringify({ fb, c })}`);
    assert.equal(compareSuppression(c, fb, AT).agrees, true);
    const list = suppressionList(fb, AT);
    assert.equal(suppressionApplies(list, c, AT), engine, `case ${i}: the list decides what the rule decides, reason and all`);
    if (engine) suppressed++;
  }
  assert.ok(suppressed > 100 && suppressed < 450, `the sweep exercises both answers (${suppressed} suppressed)`);
});

test('every difference is named by its code', () => {
  const cases = [
    ['undated_answer', [answer(1, { decided_at: undefined })], cand(1)],
    ['answer_without_row', [answer(1, { row: null })], cand(1, { row: 'events' })],
    ['carried_state', [answer(1, { state: 'done', carried_out: 'submit', reason_code: null })], cand(1)],
    ['unknown_kind', [answer(1, { reason_code: 'too_small', amplifier_kind: 'celebrity' })], cand(2, { kind: 'celebrity' })],
    ['blank_sector', [answer(1, { reason_code: 'wrong_audience', features: { sector: '', topic: null } })], cand(2, { sector: 'finance' })],
    ['band_missing', [answer(1, { reason_code: 'too_small' })], cand(2, { band: undefined })],
  ];
  for (const [code, fb, c] of cases) {
    const v = compareSuppression(c, fb, AT);
    assert.equal(v.agrees, false, code);
    assert.equal(v.code, code);
  }
  // Older than Control Center's newest 500: it no longer reads the No.
  const old = [answer(1, { reason_code: 'not_my_topic', decided_at: daysAgo(400), features: { sector: null, topic: 'rare' } }), ...Array.from({ length: CC_ANSWERS_READ }, (_, k) => answer(10, { proposal_id: `gmp-x${k}`, reason_code: 'pitch_off', decided_at: daysAgo(1) }))];
  assert.equal(compareSuppression(cand(3, { topic: 'rare' }), old, AT).code, 'answers_beyond_cap');
  // Both suppress, naming another reason: Control Center takes the first answer that matches.
  const order = compareSuppression(cand(2, { row: 'network' }), [answer(1, { reason_code: 'not_my_topic' }), answer(2, { reason_code: 'not_now' })], AT);
  assert.deepEqual([order.agrees, order.code, order.cc, order.engine], [true, 'reason_named_otherwise', 'not_my_topic', 'snoozed']);
  assert.deepEqual([...DIFFERENCES].sort(), ['answer_without_row', 'answers_beyond_cap', 'band_missing', 'blank_sector', 'carried_state', 'undated_answer', 'unknown_kind']);
});

test('the list holds references and bounds only, never a name or an address', () => {
  const fb = [answer(1), answer(2, { reason_code: 'not_now' }), answer(3, { reason_code: 'too_small' }), answer(4, { reason_code: 'wrong_audience' }), answer(5, { reason_code: 'not_my_topic' }), answer(6, { reason_code: 'other', row: 'events' }), answer(7, { subject_ref: 'Avery Example <avery@example.org>' })];
  const list = suppressionList(fb, AT);
  assert.deepEqual(list.never, [S(1)], 'a subject that is not a reference is never carried');
  assert.equal(list.paused[0].subject_ref, S(2));
  assert.deepEqual(list.reach_floor, [{ kind: 'connector', at_or_below: '1k_10k' }]);
  assert.deepEqual(list.audiences, [{ kind: 'connector', sector: 'media' }]);
  assert.deepEqual(list.topics, ['leadership']);
  assert.deepEqual(list.not_on_row.map(x => x.row), ['events', 'reach_out', 'reach_out', 'reach_out', 'reach_out', 'reach_out']);
  assert.doesNotMatch(JSON.stringify(list), /@|Avery/);
});

test('suppressionShadow: counts and codes, the context unchanged', () => {
  const context = { feedback: [answer(1), answer(2, { reason_code: 'not_now', decided_at: undefined }), answer(3, { state: 'done', carried_out: 'submit', reason_code: null })] };
  const frozen = structuredClone(context);
  const { line, verdicts } = suppressionShadow({ context, canon, at: AT });
  assert.deepEqual(context, frozen);
  assert.equal(verdicts.length, 15, 'each answer offered back on each of the five rows');
  assert.match(line, /^Suppression, in shadow: 15 checks read from 3 answers; agrees with Control Center on 5, differs on 10 \(carried_state 5, undated_answer 5\)\. The engine's list: 1 never, 2 off a row, 2 paused, 0 reach floors, 0 audiences, 0 topics; taxonomy version 1, not sent until Control Center serves it\.$/);
  assert.doesNotMatch(line, /[0-9a-f]{8}-[0-9a-f]{4}-|@|https?:\/\//);
  assert.match(suppressionShadow({ context: {}, canon, at: AT }).line, /^Suppression, in shadow: 0 checks read from 0 answers;/);
});
