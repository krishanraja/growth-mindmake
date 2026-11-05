import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCircleAnswer, circleFound, circleRequests, circlePeople, takesCircle, circleAnswer, CIRCLE_TARGET, CIRCLE_PER_RUN, CIRCLE_KINDS, CIRCLE_SHOW } from '../src/stages/circle.mjs';
import { mirrorPlan, takesMirror, MIRROR_QUESTIONS } from '../src/stages/mirror.mjs';
import { guestVerdictOf } from '../src/stages/guests.mjs';
import { buildReport, REPORT_SCHEMA } from '../src/dispatch.mjs';

// The circle lane and the AI mirror (protocol 1.19.0; Ruling, Krish,
// 2026-11-05). Every person, company and page below is invented (.test
// domains): this repository is public and never names a live person.

const AT = '2026-11-05T05:10:00Z';
const CAPS = { features: { circle: true, mirror: true }, schema_versions: ['1.18.0', '1.19.0'] };

const answered = (kind, answer, urls, day = '2026-11-04') => ({
  request_id: `circle:${kind}:${day}:aa11bb22`, kind: 'question', status: 'answered', answer,
  evidence: urls.map(url => ({ title: '', url, snippet: '', published: null }))
});
const URLS = ['https://news.alpha.test/a', 'https://www.beta.test/b', 'https://gamma.test/c'];

test('an answer becomes people only line by line, each cited on two sites, with no way to reach them', () => {
  const got = readCircleAnswer(answered('exited_founder', [
    'Here are five:',
    '1. **Ada Quill** | Quill Media | Founder | Sold an adtech company in 2021 and backs media founders. [1][2]',
    '2. Bo Marsh | Marsh Data | Chair | Built and sold a data firm. [1]',
    '3. Cy Vane | Vane Labs | CEO | Write to cy@vane.test for more. [1][3]',
    '4. Dee Rowe | Rowe Co | Founder | Sold a publisher. [2][2]',
    '5. Eve Lark | Lark Studio | Founder | Exited a creator platform in 2019-2023. [2][3]'
  ].join('\n'), URLS));
  assert.deepEqual(got.map(p => p.name), ['Ada Quill', 'Eve Lark']);
  assert.deepEqual(got[0], { name: 'Ada Quill', company: 'Quill Media', role: 'Founder', kind: 'exited_founder', why: 'Sold an adtech company in 2021 and backs media founders.', source_urls: [URLS[0], URLS[1]], reach: null, show: CIRCLE_SHOW });
  assert.deepEqual(readCircleAnswer({ ...answered('celebrity', 'X Y | Z | R | W [1][2]', URLS) }), [], 'only the four kinds');
  assert.deepEqual(readCircleAnswer({ ...answered('public_figure', 'X Y | Z | R | W [1][2]', URLS), status: 'empty' }), []);
});

test('one question a kind a day until the fifty are found', () => {
  const asks = circleRequests({ research: [], at: AT });
  assert.equal(asks.length, CIRCLE_KINDS.length);
  assert.ok(asks.every(a => a.kind === 'question' && a.query.length <= 400 && a.why.length <= 300 && !/@/.test(a.query)));
  const today = asks.map(a => ({ ...a, status: 'waiting' }));
  assert.deepEqual(circleRequests({ research: today, at: AT }), [], 'never twice in a day');
  const lines = n => Array.from({ length: n }, (_, i) => `Person ${String.fromCharCode(65 + (i % 26))}${i} Name${i} | Co ${i} | Founder | Sold a firm. [1][2]`).join('\n');
  const full = [answered('exited_founder', lines(CIRCLE_TARGET), URLS)];
  assert.equal(circleFound(full).length, CIRCLE_TARGET);
  assert.deepEqual(circleRequests({ research: full, at: AT }), [], 'asking stops at the target');
});

test('ten a run, the same person once, from every answered lookup', () => {
  const research = [
    answered('exited_founder', 'Ada Quill | Quill Media | Founder | Sold a firm. [1][2]', URLS, '2026-11-03'),
    answered('family_office', ['Ada Quill | Quill Media | Founder | Sold a firm. [1][2]', ...Array.from({ length: 14 }, (_, i) => `Fay Moss${i} | Moss Office ${i} | Principal | Backs media. [2][3]`)].join('\n'), URLS)
  ];
  assert.equal(circleFound(research).length, 15);
  const sent = circlePeople(research, { at: AT });
  assert.equal(sent.length, CIRCLE_PER_RUN);
  assert.equal(new Set(sent.map(p => p.name)).size, CIRCLE_PER_RUN);
});

test('a circle guest nobody has scored stands as a stretch, never a take; anyone else unscored stays unjudged', () => {
  const axes = { senior_score: null, seen_score: null, spark_score: null };
  assert.equal(guestVerdictOf({ ...axes, discovery_source: 'growth_circle' }), 'stretch');
  assert.equal(guestVerdictOf({ ...axes, discovery_source: 'web' }), 'unjudged');
  assert.equal(guestVerdictOf({ senior_score: 80, seen_score: 80, spark_score: 80, discovery_source: 'growth_circle' }), 'take', 'a scored circle guest keeps its score');
});

test('the mirror asks only what a stranger would, naming the person as {name}', () => {
  const plan = mirrorPlan();
  assert.equal(plan.version, 1);
  assert.ok(plan.questions.length >= 3 && plan.questions.length <= 8);
  assert.ok(MIRROR_QUESTIONS.every(q => q.includes('{name}') && !/\{(?!name\}|company\})/.test(q)));
});

test('the circle and the mirror go out only where Control Center serves them, at 1.19.0, inside the copied schema', () => {
  assert.equal(takesCircle(CAPS, REPORT_SCHEMA), true);
  assert.equal(takesMirror(CAPS, REPORT_SCHEMA), true);
  assert.equal(takesCircle({ features: { circle: true }, schema_versions: ['1.18.0'] }, REPORT_SCHEMA), false);
  assert.equal(takesMirror({ features: {}, schema_versions: ['1.19.0'] }, REPORT_SCHEMA), false);
  const people = readCircleAnswer(answered('investor_partner', 'Gil Fenn | Fenn Partners | Partner | Backs adtech. [1][2]', URLS));
  const report = buildReport({ run_id: 'gm-circle-1', mode: 'synthetic', observed_at: AT, source: { revision: 'abc', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], holds: [], circle: people, mirror: mirrorPlan() });
  assert.equal(report.schema_version, '1.19.0');
  assert.equal(report.circle.length, 1);
  assert.equal(report.mirror.questions.length, MIRROR_QUESTIONS.length);
  const without = buildReport({ run_id: 'gm-circle-2', mode: 'synthetic', observed_at: AT, source: { revision: 'abc', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], holds: [] });
  assert.equal('circle' in without || 'mirror' in without, false);
});

test('Control Center\'s answer is counted, never named', () => {
  const line = circleAnswer(3, { dry_run: false, checked: 3, created: 2, linked: 1, asked: 1, refused: { not_to_be_contacted: 1 }, people: [{ index: 0, outcome: 'linked', contact_id: 'x', in_network: true }] });
  assert.equal(line.state, 'answered');
  assert.match(line.line, /2 new, 1 already in his records \(1 in his network, so his own row\); 1 same-name question for him; refused: 1 not to be contacted/);
  assert.equal(circleAnswer(2, { error: 'circle_unrecorded' }).state, 'unrecorded');
  assert.equal(circleAnswer(0, null), null);
});
