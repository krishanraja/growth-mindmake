import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitActivity, fitHolds, ACTIVITY_MAX, HOLDS_MAX } from '../src/dispatch.mjs';

// Audit gm-2 and gm-9 (14 November 2026): a full report cut its last activity lines, the AI
// answers, the kits and the switch's readiness, and dropped holds past 40 unseen.
const STANDARDS = ['Guest standard', 'Visibility standard', 'Room scoring', 'Pilot machine', 'Outreach briefs', 'Ingest gate', 'Focus playbooks', 'Suppression', 'Places and questions'].map(n => `${n}, in shadow: 3 agree, 0 differ.`);
const TAIL = ['AI answers: AEO tracks 1 question from its next research run.', 'AI-answer kits from AEO-Engine: none served this run.', 'Switch readiness: signed spec no; proof runs 0 of 5; shadow reported yes; number measured no.'];
const filler = n => Array.from({ length: n }, (_, i) => `Line ${i}.`);

test('a report under the cap is untouched', () => {
  const lines = ['Gap: good meetings 0 of 8 this week, U5, short by 8.', ...filler(10)];
  assert.equal(fitActivity(lines), lines);
});

test('over the cap the standards fold into one line and the AI-answer and readiness lines survive', () => {
  const lines = ['Gap: good meetings at least 0 of 8 this week, U5, short by 8; 2 held this week, 2 not tapped yet.', ...filler(28), 'Crew lints, in shadow: 0.', 'Crew checks, in shadow: 0.', ...STANDARDS, ...TAIL];
  assert.ok(lines.length > ACTIVITY_MAX);
  const out = fitActivity(lines);
  assert.ok(out.length <= ACTIVITY_MAX);
  for (const l of [...TAIL, lines[0], 'Crew lints, in shadow: 0.', 'Crew checks, in shadow: 0.']) assert.ok(out.includes(l), `${l} was cut`);
  assert.equal(out.filter(l => l.startsWith('In shadow, folded')).length, 1);
  assert.match(out.find(l => l.startsWith('In shadow, folded')), /Guest standard, .*Places and questions \(9 lines/);
});

test('still over after folding, the latest ordinary lines go, the kept ones stay, and the last line counts what went', () => {
  const lines = ['Gap: good meetings 0 of 8 this week, U5, short by 8.', ...filler(60), ...TAIL];
  const out = fitActivity(lines);
  assert.equal(out.length, ACTIVITY_MAX);
  for (const l of TAIL) assert.ok(out.includes(l));
  assert.equal(out[0], lines[0]);
  assert.match(out.at(-1), /^25 more activity lines did not fit the report's 40 and were left out\.$/);
});

test('holds past the cap leave one hold naming the reasons left out, with counts', () => {
  const holds = [...Array.from({ length: 39 }, () => ({ reason: 'a', detail: null })), { reason: 'b', detail: null }, { reason: 'b', detail: null }, { reason: 'c', detail: null }];
  const out = fitHolds(holds);
  assert.equal(out.length, HOLDS_MAX);
  assert.deepEqual(out.at(-1), { reason: 'holds_truncated', detail: "3 more holds did not fit the report's 40: b 2, c 1." });
  assert.equal(fitHolds(holds.slice(0, 40)).length, 40);
});
