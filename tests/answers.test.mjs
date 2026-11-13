import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { aiAnswersReadable, answersLine, answersRequest, answersStep, askedMarks, askFor, byCodePoint, kitsFor, questionsDigest, questionsMark, readAiAnswers, readFeatures, readKits, validQuestion, KITS_PER_STANDING, MAX_REQUEST_QUESTIONS } from '../src/stages/answers.mjs';
import { weeklyAnswerKits, weeklyKitsLine, WEEKLY_KITS } from '../src/weekly-review.mjs';
import { enginePlan, MAX_PROBES_PER_RUN } from '../src/stages/places.mjs';
import { readFile } from 'node:fs/promises';
import { readDirective, runDispatch } from '../src/dispatch.mjs';
import { capsContext } from './support/caps-scenario.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { canon as section12Canon, AT as section12AT } from './support/section12.mjs';

// Protocol 1.22.0 (Ruling, Krish, 2026-11-12): AEO-Engine is the one AI-answers specialist every venture's engine
// calls. Every question, host and id here is invented.

const canon = { ask: { url: 'https://mindmake.example/start' }, publication: { url: 'https://letters.example/' }, offer: '' };
const tp = (id, score, icp_trigger) => ({ id, product_slug: 'mindmake', icp_trigger, coverage_status: 'open', cost_efficiency_score: score, channel: 'geo' });
const context = { records: { touchpoints: [tp('t1', 9, 'How do I get my leadership team ready for AI agents / what should a media CEO do about AI first'), tp('t2', 5, 'Who helps a publisher price its archive for AI licensing')] } };
const standing = over => ({ product_slug: 'mindmake', tracked: true, latest: null, misses: [], moves: [], history: [], request: null, ...over });

test('the standing is read loosely from the directive and said in the words the tile uses', () => {
  assert.equal(readAiAnswers(undefined), null);
  assert.equal(readAiAnswers({ standing: 'nope' }), null);
  assert.equal(answersLine(null), 'AI answers: not tracked yet.');
  assert.equal(answersLine(standing({ latest: { as_of: '2026-11-08', asked: 20, cited_first: 1, share: 5 } })), 'AI answers: cited first on 1 of 20 questions, 8 Nov.');
  assert.equal(answersLine(standing({ request: { id: 'x', state: 'open', questions: 3 } })), 'AI answers: AEO tracks 3 questions from its next research run.');
});

test("the request is the weekly review's planned questions and the canon's hosts, at most 25", () => {
  const body = answersRequest({ context, canon });
  assert.deepEqual(body.domains, ['letters.example', 'mindmake.example']);
  assert.ok(body.questions.length > 0 && body.questions.length <= 25);
  assert.ok(body.questions[0].startsWith('How do I get my leadership team ready'), 'the best-rated place first');
  assert.equal(answersRequest({ context: {}, canon }), null, 'no touchpoints served: nothing to ask');
});

test('a live run asks AEO once when no request is on file, and never when one is, in a dry run, or unserved', async () => {
  const posted = [];
  const cc = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r', questions: body.questions.length }; } };
  const capabilities = { features: { ai_answers: true } };
  const lines = await answersStep({ cc, standing: standing(), served: true, capabilities, mode: 'live', context, canon });
  assert.equal(posted.length, 1);
  assert.match(lines[1], /^Asked AEO-Engine to track \d+ of Mindmake's planned questions from its next research run\.$/);
  await answersStep({ cc, standing: standing({ request: { id: 'x', state: 'open', questions: 3 } }), served: true, capabilities, mode: 'live', context, canon });
  await answersStep({ cc, standing: standing(), served: true, capabilities, mode: 'synthetic', context, canon });
  await answersStep({ cc, standing: standing(), served: true, capabilities: { features: {} }, mode: 'live', context, canon });
  assert.deepEqual(await answersStep({ cc, standing: null, served: false, capabilities, mode: 'live', context, canon }), []);
  assert.equal(posted.length, 1);
  const failing = { async answers() { throw new Error('down'); } };
  const out = await answersStep({ cc: failing, standing: standing(), served: true, capabilities, mode: 'live', context, canon });
  assert.match(out.at(-1), /^Could not ask AEO-Engine/);
});

test('readDirective keeps the standing and whether AI answers are served', () => {
  const value = { ok: true, chosen_by: 'rule', directive: { schema_version: '1.22.0', engine_id: 'growth-mindmake', directive_id: 'mindmake:2026-11-13', next_action: { proposal_id: null, instruction: 'x', why: 'y', close_condition: null }, decisions_since: [], objectives: [], features: { engine_state: true, krish_instruction: true, ai_answers: true }, ai_answers: { standing: standing({ tracked: true }), rule: 'r' } } };
  const d = readDirective(value);
  assert.equal(d.ai_answers_served, true);
  assert.equal(d.ai_answers.product_slug, 'mindmake');
});

test('a standing Control Center could not read is never taken as no request on file', async () => {
  // Protocol 1.22.0 leaves the ai_answers block out when the standing could not be read, while features.ai_answers stays true.
  assert.equal(aiAnswersReadable(undefined), false);
  assert.equal(aiAnswersReadable({ rule: 'r' }), false);
  assert.equal(aiAnswersReadable({ standing: [] }), false);
  assert.equal(aiAnswersReadable({ standing: null }), true);
  assert.equal(aiAnswersReadable({ standing: standing() }), true);
  const unread = readDirective({ ok: true, chosen_by: 'rule', directive: { schema_version: '1.22.0', engine_id: 'growth-mindmake', directive_id: 'mindmake:2026-11-13', next_action: { proposal_id: null, instruction: 'x', why: 'y', close_condition: null }, decisions_since: [], objectives: [], features: { ai_answers: true } } });
  assert.equal(unread.ai_answers_served, true);
  assert.equal(unread.ai_answers_readable, false);
  const posted = [];
  const cc = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r', questions: body.questions.length }; } };
  const lines = await answersStep({ cc, standing: unread.ai_answers, served: unread.ai_answers_served, readable: unread.ai_answers_readable, capabilities: { features: { ai_answers: true } }, mode: 'live', context, canon });
  assert.equal(posted.length, 0);
  assert.deepEqual(lines, ['AI answers: Control Center could not read the standing this run, so AEO-Engine was not asked.']);
});

// A request has its own cap, the protocol's 25, and is filtered as Control Center filters it (CONTACT in its
// src/lib/aiAnswers.ts), so the count it records is the count compared and a run never asks again for nothing.
// A canon read with its offer parsed (parseOffer's shape), with one invented retired offer the plan holds.
const offered = { ...canon, offer: { noun: 'readiness conversation', public_days: null, price_private: true, retired: ['Founder Bootcamp'], revenue_line: null } };
const many = (n, start = 0) => Array.from({ length: n }, (_, i) => tp(`m${i + start}`, 50 - i - start, Array.from({ length: 4 }, (_, j) => `what does buyer group ${i + start} ask about AI readiness, part ${'abcd'[j]}`).join(' / ')));
const wide = { records: { touchpoints: many(10) } };

test('validQuestion: 8 to 300 characters, never an address, a link or a number', () => {
  assert.equal(validQuestion('How do I start with AI?'), true);
  assert.equal(validQuestion('Too few?'), true, 'eight characters is enough');
  assert.equal(validQuestion('Short?'), false);
  assert.equal(validQuestion(`${'a'.repeat(299)}?`), true);
  assert.equal(validQuestion(`${'a'.repeat(300)}?`), false);
  assert.equal(validQuestion('Who answers at hello@mindmake.example about AI?'), false, 'an address');
  assert.equal(validQuestion('Is www.mindmake.example the place to start?'), false, 'a link');
  assert.equal(validQuestion('What does https://mindmake.example offer?'), false, 'a link');
  assert.equal(validQuestion('Can I call +1 555 010 0199 about AI readiness?'), false, 'a number');
  assert.equal(validQuestion('What changes for media in 2027?'), true, 'a year is not a number to refuse');
  assert.equal(validQuestion(null), false);
  assert.equal(validQuestion(42), false);
});

test("a request takes up to 25 of the plan, its own cap, not the weekly review's twelve", () => {
  assert.equal(MAX_REQUEST_QUESTIONS, 25);
  assert.equal(MAX_PROBES_PER_RUN, 12, 'the weekly review and the shadow keep twelve');
  assert.equal(enginePlan(wide.records.touchpoints, canon).planned.length, MAX_PROBES_PER_RUN);
  const body = answersRequest({ context: wide, canon });
  assert.equal(body.questions.length, MAX_REQUEST_QUESTIONS);
  assert.deepEqual(body.questions, enginePlan(wide.records.touchpoints, canon, Infinity).planned.slice(0, 25).map(p => p.question), 'the best-rated places first, in the plan\'s order');
  assert.ok(body.questions.every(validQuestion));
});

test('a question AEO would refuse is dropped before the cap, so it never takes a place', () => {
  const bad = [tp('b1', 99, 'who answers at hello@mindmake.example about AI readiness'), tp('b2', 98, 'can I call +1 555 010 0199 about AI readiness'), tp('b3', 97, 'is www.mindmake.example the right place to start'), tp('b4', 96, 'tiny'), tp('b5', 95, `why ${'so '.repeat(110)}long`)];
  const body = answersRequest({ context: { records: { touchpoints: [...bad, ...many(10)] } }, canon });
  assert.equal(body.questions.length, MAX_REQUEST_QUESTIONS);
  assert.ok(body.questions.every(q => q.startsWith('What does buyer group')), 'none of the refused questions, and the cap filled from the rest');
  assert.equal(answersRequest({ context: { records: { touchpoints: bad } }, canon }), null, 'only refused questions: nothing to ask');
});

test('askFor: first with nothing on file, again only when the plan holds more than the request on file', () => {
  const body = { questions: ['a question one?', 'a question two?', 'a question three?'] };
  assert.equal(askFor(null, body), 'first');
  assert.equal(askFor(null, null), null);
  assert.equal(askFor({ id: 'x', state: 'open', questions: 2 }, body), 'more');
  assert.equal(askFor({ id: 'x', state: 'served', questions: 2 }, body), 'more', 'a served request is replaced by a newer one too');
  assert.equal(askFor({ id: 'x', state: 'open', questions: 3 }, body), null);
  assert.equal(askFor({ id: 'x', state: 'open', questions: 9 }, body), null, 'fewer now: never asked for less');
  assert.equal(askFor({ id: 'x', state: 'open', questions: '2' }, body), null, 'a count that is not a whole number is never compared');
  assert.equal(askFor({ id: 'x', state: 'open' }, body), null);
  assert.equal(askFor({ id: 'x', state: 'open', questions: 2 }, null), null);
});

test('a live run asks AEO again when the plan has grown past the request on file, and only then', async () => {
  const posted = [];
  const cc = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r2', questions: body.questions.length, replaced: true }; } };
  const capabilities = { features: { ai_answers: true } };
  const onFile = n => standing({ request: { id: 'x', state: 'open', questions: n, requested_at: '2026-11-12T10:00:00Z', served_at: null } });
  const lines = await answersStep({ cc, standing: onFile(12), served: true, capabilities, mode: 'live', context: wide, canon: offered });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].questions.length, MAX_REQUEST_QUESTIONS);
  assert.deepEqual(posted[0].domains, ['letters.example', 'mindmake.example'], 'the hosts go with every request');
  assert.deepEqual(lines, ['AI answers: AEO tracks 12 questions from its next research run.', "Asked AEO-Engine again to track 25 of Mindmake's planned questions from its next research run, up from 12 on file."]);
  // The request Control Center now holds counts 25: the next run finds nothing more and asks nothing.
  assert.deepEqual(await answersStep({ cc, standing: onFile(25), served: true, capabilities, mode: 'live', context: wide, canon: offered }), ['AI answers: AEO tracks 25 questions from its next research run.']);
  assert.deepEqual(await answersStep({ cc, standing: onFile(12), served: true, capabilities, mode: 'live', context: {}, canon: offered }), ['AI answers: AEO tracks 12 questions from its next research run.'], 'no touchpoints served: nothing compared, nothing asked');
  await answersStep({ cc, standing: onFile(12), served: true, capabilities, mode: 'synthetic', context: wide, canon: offered });
  await answersStep({ cc, standing: onFile(12), served: true, capabilities: { features: {} }, mode: 'live', context: wide, canon: offered });
  assert.equal(posted.length, 1, 'never in a dry run or where Control Center takes no request');
  const failing = { async answers() { throw new Error('down'); } };
  const out = await answersStep({ cc: failing, standing: onFile(12), served: true, capabilities, mode: 'live', context: wide, canon: offered });
  assert.match(out.at(-1), /^Could not ask AEO-Engine/);
});

test("a re-ask needs the canon's offer read: without it the plan carries a retired offer's question", async () => {
  const posted = [];
  const cc = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r2', questions: body.questions.length, replaced: true }; } };
  const capabilities = { features: { ai_answers: true } };
  const ctx = { records: { touchpoints: [tp('r1', 99, 'is the Founder Bootcamp worth it for a media CEO'), ...context.records.touchpoints] } };
  const read = answersRequest({ context: ctx, canon: offered });
  assert.ok(read.questions.every(q => !/Bootcamp/.test(q)), 'with the offer read, the retired offer\'s question is held');
  const unread = answersRequest({ context: ctx, canon: null });
  assert.equal(unread.questions.length, read.questions.length + 1, 'without it, the plan counts one more');
  const onFile = standing({ request: { id: 'x', state: 'served', questions: read.questions.length, requested_at: '2026-11-12T10:00:00Z', served_at: '2026-11-13T10:00:00Z' } });
  const lines = await answersStep({ cc, standing: onFile, served: true, capabilities, mode: 'live', context: ctx, canon: offered });
  assert.equal(lines.length, 1, 'the canon read: the plan matches the request on file, nothing asked');
  for (const unreadCanon of [null, { ...offered, offer: null }, { ...offered, offer: '' }]) {
    const out = await answersStep({ cc, standing: onFile, served: true, capabilities, mode: 'live', context: ctx, canon: unreadCanon });
    assert.equal(out.at(-1), "Mindmake's canon was not read this run, so the plan was not compared with the request on file and AEO-Engine was not asked again.");
  }
  assert.equal(posted.length, 0, 'a run without the canon\'s offer never replaces the request on file');
  const grown = standing({ request: { id: 'x', state: 'open', questions: read.questions.length - 1, requested_at: '2026-11-12T10:00:00Z', served_at: null } });
  await answersStep({ cc, standing: grown, served: true, capabilities, mode: 'live', context: ctx, canon: offered });
  assert.equal(posted.length, 1, 'with the offer read, a grown plan asks again');
  assert.ok(posted[0].questions.every(q => !/Bootcamp/.test(q)), 'and never with the retired offer\'s question');
});

// ── Proposed protocol 1.23.0 (`features.ai_answers_detail`): the request's digest and AEO's win kits ──
// Ruling (Krish, 2026-11-13): AEO's win kits reach him through each venture's own growth engine. Every kit, question,
// host and id here is invented.

test('questionsDigest: Control Center\'s definition, on a fixed vector Python gives byte for byte', () => {
  // python3: json.dumps(sorted(re.sub(r'\s+',' ',q.strip()) for q in qs), separators=(',',':'), ensure_ascii=False),
  // UTF-8, SHA-256. The vector holds runs of whitespace, a tab, non-ASCII, and a character above U+FFFF beside one
  // below it, where code point order and JavaScript's own UTF-16 sort disagree.
  const qs = ['  What is AEO,   really?  ', 'Café owners: how do\tAI answers work?', 'apple pie for AI?', 'Ａ full-width question?', '\u{1F600} emoji question?'];
  const VECTOR = 'bd64105aabe666c15d56856cb054101e182e75d6cfd4f912883b8f41651c3030';
  assert.equal(questionsDigest(qs), VECTOR);
  assert.equal(questionsDigest([...qs].reverse()), VECTOR, 'the order served never matters');
  assert.equal(questionsDigest(qs.map(q => q.trim().replace(/\s+/g, ' '))), VECTOR, 'trimmed and collapsed first');
  assert.equal(questionsDigest([]), createHash('sha256').update('[]').digest('hex'));
  assert.equal(questionsDigest(['b?', 'a?']), createHash('sha256').update('["a?","b?"]').digest('hex'));
  assert.ok(byCodePoint('Ａ', '\u{1F600}') < 0 && ['\u{1F600}', 'Ａ'].sort()[0] === '\u{1F600}', 'code point order, not UTF-16 order');
  assert.match(questionsDigest(qs), /^[0-9a-f]{64}$/);
});

test('askFor: with a digest on file, the plan is asked again whenever its digest differs, and only then', () => {
  const body = { questions: ['a question one?', 'a question two?', 'a question three?'] };
  const same = questionsDigest(body.questions);
  assert.equal(askFor({ id: 'x', state: 'open', questions: 3, digest: same }, body), null);
  assert.equal(askFor({ id: 'x', state: 'open', questions: 3, digest: questionsDigest([...body.questions].reverse()) }, body), null, 'the same questions in another order');
  assert.equal(askFor({ id: 'x', state: 'open', questions: 3, digest: questionsDigest(['a question one?', 'a question two?', 'another question?']) }, body), 'changed', 'the same count, other questions');
  assert.equal(askFor({ id: 'x', state: 'served', questions: 9, digest: questionsDigest(['a question one?']) }, body), 'changed', 'fewer now: the digest still asks, replacing the request');
  assert.equal(askFor({ id: 'x', state: 'open', questions: 2, digest: same }, body), null, 'the digest wins over the count');
  // A digest that is not 64 lowercase hex characters is never compared: the count rule stands.
  for (const digest of ['', 'nope', same.toUpperCase(), same.slice(1), 42, null]) {
    assert.equal(askFor({ id: 'x', state: 'open', questions: 2, digest }, body), 'more');
    assert.equal(askFor({ id: 'x', state: 'open', questions: 3, digest }, body), null);
  }
  assert.equal(askFor({ id: 'x', state: 'open', questions: 3, digest: same }, null), null, 'nothing planned: nothing asked');
  assert.equal(askFor(null, body), 'first');
});

test('a live run re-asks on a changed digest, says replace only where the detail is served, and needs the canon read', async () => {
  const posted = [];
  const cc = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r3', questions: body.questions.length, replaced: true }; } };
  const capabilities = { features: { ai_answers: true } };
  const plan = answersRequest({ context: wide, canon: offered });
  const onFile = digest => standing({ request: { id: 'x', state: 'open', questions: plan.questions.length, requested_at: '2026-11-12T10:00:00Z', served_at: null, digest } });
  const stale = questionsDigest(plan.questions.slice(1));
  const lines = await answersStep({ cc, standing: onFile(stale), served: true, detail: true, capabilities, mode: 'live', context: wide, canon: offered });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].mode, 'replace', 'served detail: the request says it replaces the one on file');
  assert.deepEqual(posted[0].questions, plan.questions);
  assert.equal(lines.at(-1), `Asked AEO-Engine again to track 25 of Mindmake's planned questions from its next research run: the plan's questions differ from the request on file (${questionsMark(plan.questions)}).`);
  await answersStep({ cc, standing: onFile(stale), served: true, capabilities, mode: 'live', context: wide, canon: offered });
  assert.equal(posted.length, 2);
  assert.equal('mode' in posted[1], false, 'before the detail is served the request carries nothing new');
  assert.equal(Object.keys(posted[1]).sort().join(','), 'domains,questions');
  // The same questions on file: nothing asked.
  assert.deepEqual(await answersStep({ cc, standing: onFile(questionsDigest(plan.questions)), served: true, detail: true, capabilities, mode: 'live', context: wide, canon: offered }), ['AI answers: AEO tracks 25 questions from its next research run.']);
  // A digest re-ask needs the canon's offer read, like a count re-ask.
  const out = await answersStep({ cc, standing: onFile(stale), served: true, detail: true, capabilities, mode: 'live', context: wide, canon: null });
  assert.equal(out.at(-1), "Mindmake's canon was not read this run, so the plan was not compared with the request on file and AEO-Engine was not asked again.");
  await answersStep({ cc, standing: onFile(stale), served: true, detail: true, capabilities, mode: 'synthetic', context: wide, canon: offered });
  assert.equal(posted.length, 2, 'never with the canon unread, nor in a dry run');
  // The first request carries mode too where the detail is served, and its line the asked list's mark.
  const first = await answersStep({ cc, standing: standing(), served: true, detail: true, capabilities, mode: 'live', context: wide, canon: offered });
  assert.equal(posted.at(-1).mode, 'replace');
  assert.equal(first.at(-1), `Asked AEO-Engine to track 25 of Mindmake's planned questions from its next research run (${questionsMark(plan.questions)}).`);
});

test('a digest that never meets asks once for an exact list, then says so and waits for the plan to change', async () => {
  const posted = [];
  const cc = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r4', questions: body.questions.length, replaced: true }; } };
  const capabilities = { features: { ai_answers: true } };
  const plan = answersRequest({ context: wide, canon: offered });
  const mark = questionsMark(plan.questions);
  assert.match(mark, /^questions [0-9a-f]{12}$/, 'a short digest, never a question\'s words');
  assert.equal(mark, `questions ${questionsDigest(plan.questions).slice(0, 12)}`);
  // Control Center keeps a list that differs from what was sent, so its digest never meets the plan's.
  const kept = standing({ request: { id: 'x', state: 'open', questions: 24, requested_at: '2026-11-12T10:00:00Z', served_at: null, digest: questionsDigest(plan.questions.slice(1)) } });
  const asked = await answersStep({ cc, standing: kept, served: true, detail: true, capabilities, mode: 'live', context: wide, canon: offered, reports: [] });
  assert.equal(posted.length, 1, 'no mark in the recent reports: asked');
  assert.ok(asked.at(-1).endsWith(`(${mark}).`));
  // The next run reads its own report back, as Control Center lists it ({ line } or a string), and asks nothing.
  for (const activity of [[{ line: asked.at(-1) }], [asked.at(-1)]]) {
    const out = await answersStep({ cc, standing: kept, served: true, detail: true, capabilities, mode: 'live', context: wide, canon: offered, reports: [{ activity: [{ line: 'Lanes: 0' }] }, { activity }] });
    assert.deepEqual(out, ['AI answers: AEO tracks 24 questions from its next research run.', `AI answers: the request on file still reads differently from the plan after this engine asked for exactly these questions (${mark}), so AEO-Engine is not asked again until the plan changes.`]);
  }
  assert.equal(posted.length, 1, 'never every day');
  // The line that waits carries the mark too, so it stays in the recent reports until the plan changes.
  const waiting = await answersStep({ cc, standing: kept, served: true, detail: true, capabilities, mode: 'live', context: wide, canon: offered, reports: [{ activity: [asked.at(-1)] }] });
  assert.deepEqual([...askedMarks([{ activity: [waiting.at(-1)] }])], [mark]);
  // A changed plan is a new list, with a new mark: asked again.
  const grown = { records: { touchpoints: many(10, 1) } };
  const next = answersRequest({ context: grown, canon: offered });
  assert.notEqual(questionsMark(next.questions), mark);
  await answersStep({ cc, standing: kept, served: true, detail: true, capabilities, mode: 'live', context: grown, canon: offered, reports: [{ activity: [asked.at(-1)] }] });
  assert.equal(posted.length, 2);
  // askFor's own rule: settled only on a digest that differs and an exact mark; the count rule never settles.
  const body = { questions: ['a question one?', 'a question two?', 'a question three?'] };
  const other = { id: 'x', state: 'open', questions: 3, digest: questionsDigest(['another question?']) };
  assert.equal(askFor(other, body, new Set([questionsMark(body.questions)])), 'settled');
  assert.equal(askFor(other, body, new Set([questionsMark(['another question?'])])), 'changed');
  assert.equal(askFor(other, body, null), 'changed');
  assert.equal(askFor({ ...other, digest: questionsDigest(body.questions) }, body, new Set([questionsMark(body.questions)])), null);
  assert.equal(askFor({ id: 'x', state: 'open', questions: 2 }, body, new Set([questionsMark(body.questions)])), 'more');
  // Marks are read loosely: anything that is not a report's line is ignored.
  assert.deepEqual([...askedMarks(null)], []);
  assert.deepEqual([...askedMarks([null, 'x', { activity: 'x' }, { activity: [null, 7, { line: 7 }, 'questions ABCDEF123456', 'questions abc'] }])], []);
});

const kit = (kit_id, priority, over = {}) => ({
  kit_id, v: 1, query_id: `q-${kit_id}`, question: `Which invented firm helps with question ${kit_id}?`, gap_class: 'no_page', priority,
  target: { kind: 'new_page', url: null, host: 'mindmake.example', suggested_path: `/answers/${kit_id}` }, title: `Invented answer page ${kit_id}`,
  capsule: { rules: ['Answer in the first sentence.'], must_cover: ['an invented point'] }, h2s: ['What it is', 'Who it is for'],
  // `features` as AEO serves them: CitedFeatures (AEO-Engine src/pipeline/45-pages.ts), an object of scalars, null where the page was not read.
  beat: [{ url: 'https://rival.example/page', host: 'rival.example', engine: 'perplexity', position: 1, features: { url: 'https://rival.example/page', host: 'rival.example', source_type: 'vendor', read: true, title_matches_question: true, answer_first_words: 42, words: 1200, h2_count: 6, dated: false, server_rendered: true } },
    { url: 'https://rival.example/other', host: 'rival.example', engine: 'chatgpt', position: 1, features: { url: 'https://rival.example/other', host: 'rival.example', source_type: 'vendor', read: false, title_matches_question: null, answer_first_words: null, words: null, h2_count: null, dated: null, server_rendered: null } }],
  site_fixes: [{ gate: 'indexable', host: 'mindmake.example', url: 'https://mindmake.example/', fix: 'An invented fix.', owner_repo: 'example/site' }],
  off_site: [{ host: 'forum.example', url: 'https://forum.example/thread', source_type: 'forum', engines: ['perplexity'], why: 'Invented.' }, { host: 'pod.example', url: null, source_type: 'podcast', engines: ['claude'], why: 'Invented.' }],
  verify: { engines: ['perplexity'], samples: 3, success: 'cited first', recheck: 'fortnight', baseline: null }, evidence: ['An invented reading.'],
  ...over
});
const withKits = (mine, portfolio = []) => standing({ kits: mine, portfolio: portfolio.map(([product_slug, kits]) => standing({ product_slug, kits })) });

test('kitsFor reads Mindmake\'s and its portfolio\'s kits loosely, best priority first, never throwing', () => {
  for (const s of [null, undefined, 'x', [], standing(), standing({ kits: null }), standing({ kits: 'nope' }), standing({ kits: {} }), standing({ portfolio: 'nope' }), standing({ portfolio: [null, 3, { kits: 'x' }] })]) {
    assert.deepEqual(kitsFor(s), [], 'missing or malformed means no kits');
  }
  const s = withKits([kit('m1', 2), kit('m2', 9)], [['ctrl', [kit('c1', 5)]], ['pulse', [kit('p1', null), kit('p2', 7)]]]);
  const kits = kitsFor(s);
  assert.deepEqual(kits.map(k => k.kit_id), ['m2', 'p2', 'c1', 'm1', 'p1'], 'a higher priority first, none last');
  assert.deepEqual(kits.map(k => k.product), ['mindmake', 'pulse', 'ctrl', 'mindmake', 'pulse']);
  assert.equal(kits[0].target.kind, 'new_page');
  assert.deepEqual(kits[0].h2s, ['What it is', 'Who it is for']);
  // A page to beat keeps AEO's features object, its known fields only; an unread page's features stay null.
  assert.deepEqual(kits[0].beat[0].features, { source_type: 'vendor', read: true, title_matches_question: true, answer_first_words: 42, words: 1200, h2_count: 6, dated: false, server_rendered: true });
  assert.deepEqual(kits[0].beat[1].features, { source_type: 'vendor', read: false, title_matches_question: null, answer_first_words: null, words: null, h2_count: null, dated: null, server_rendered: null });
  for (const f of [null, undefined, 'faq', ['faq'], 7]) assert.equal(readFeatures(f), null, 'a features that is not an object reads as none');
  assert.deepEqual(readFeatures({ source_type: 7, read: 'yes', answer_first_words: -1, words: 1.5, h2_count: '6', dated: 0 }), { source_type: null, read: null, title_matches_question: null, answer_first_words: null, words: null, h2_count: null, dated: null, server_rendered: null });
  // Ties keep the order served: Mindmake's own first.
  assert.deepEqual(kitsFor(withKits([kit('a', 1)], [['ctrl', [kit('b', 1)]]])).map(k => k.kit_id), ['a', 'b']);
  // A kit with no id, or neither question nor title, is left out and counted; a repeated id is kept once.
  const read = readKits(withKits([kit('m1', 1), { question: 'No id at all here?' }, kit('m3', 1, { question: null, title: null }), 'nope', kit('m1', 4)], [['circle', [kit('m1', 9)]]]));
  assert.deepEqual(read.kits.map(k => k.kit_id), ['m1']);
  assert.equal(read.dropped, 3);
  assert.deepEqual([read.mindmake, read.portfolio], [1, 0]);
  // Misshapen fields read as empty, never an error.
  const odd = kitsFor(standing({ kits: [kit('o1', 'high', { target: 'x', capsule: null, h2s: 'x', beat: [null, 'x'], site_fixes: {}, off_site: [{ host: 7 }], verify: [], evidence: [1, 'An invented reading.'] })] }))[0];
  assert.equal(odd.priority, null);
  assert.equal(odd.target, null);
  assert.deepEqual(odd.capsule, { rules: [], must_cover: null });
  assert.deepEqual([odd.h2s, odd.beat, odd.site_fixes, odd.evidence], [[], [], [], ['An invented reading.']]);
  assert.deepEqual(odd.off_site, [{ host: null, url: null, source_type: null, engines: [], why: null }]);
  assert.equal(odd.verify, null);
  // At most five a standing, as Control Center serves them.
  assert.equal(kitsFor(standing({ kits: Array.from({ length: 8 }, (_, i) => kit(`k${i}`, i)) })).length, KITS_PER_STANDING);
});

test('the weekly review carries the best five kits, to the Trust-Asset Steward and to pitches, only where the detail is served', () => {
  const s = withKits([kit('m1', 1), kit('m2', 6)], [['ctrl', [kit('c1', 5), kit('c2', 2)]], ['circle', [kit('i1', 8)]], ['pulse', [kit('p1', 3)]]]);
  assert.deepEqual(weeklyAnswerKits({ standing: s }), { ai_answer_kits: null, trust_asset_steward: null, pitches: null, read: null }, 'not served: nothing assumed');
  assert.deepEqual(weeklyAnswerKits({ standing: s, detail: 'true' }).ai_answer_kits, null, 'only a served true counts');
  assert.equal(weeklyKitsLine(weeklyAnswerKits({ standing: s })), null, 'a no-op until Control Center ships');
  const review = weeklyAnswerKits({ standing: s, detail: true });
  assert.equal(WEEKLY_KITS, 5);
  assert.deepEqual(review.ai_answer_kits.map(k => k.kit_id), ['i1', 'm2', 'c1', 'p1', 'c2'], 'the top five by priority across Mindmake and the portfolio');
  assert.deepEqual(review.trust_asset_steward.map(a => a.kit_id), review.ai_answer_kits.map(k => k.kit_id));
  const aid = review.trust_asset_steward[1];
  assert.equal(aid.decision, 'Which invented firm helps with question m2?', "the buyer's question is the aid's decision");
  assert.deepEqual(aid.sections, ['What it is', 'Who it is for']);
  assert.deepEqual(aid.beat_hosts, ['rival.example'], 'the pages to beat, by host, once each');
  const angle = review.pitches[1];
  assert.deepEqual(angle, { kit_id: 'm2', product: 'mindmake', angle: 'Which invented firm helps with question m2?', places: ['forum.example', 'pod.example'] });
  assert.equal(weeklyAnswerKits({ standing: withKits([kit('t1', 1, { question: null })]), detail: true }).pitches[0].angle, 'Invented answer page t1', 'the title where no question is served');
  const line = weeklyKitsLine(review);
  assert.equal(line, "AI-answer kits from AEO-Engine: 2 for Mindmake and 4 for its portfolio read, the best 5 kept in this run's memory; no stage uses them yet.");
  assert.doesNotMatch(line, /Trust-Asset|pitch|routed|carries/, 'the line claims no routing that does not happen');
  assert.equal(weeklyKitsLine(weeklyAnswerKits({ standing: withKits([kit('d1', 1), 'x']), detail: true })), "AI-answer kits from AEO-Engine: 1 for Mindmake and 0 for its portfolio read, 1 misshapen and left out, the best 1 kept in this run's memory; no stage uses them yet.");
  assert.doesNotMatch(line, /invented|example|Which|rival|forum|pod\./i, 'counts only, never a kit\'s words');
  assert.equal(weeklyKitsLine(weeklyAnswerKits({ standing: standing({ kits: ['x'] }), detail: true })), 'AI-answer kits from AEO-Engine: none served this run, 1 misshapen and left out.');
  assert.equal(weeklyKitsLine(weeklyAnswerKits({ standing: null, detail: true })), 'AI-answer kits from AEO-Engine: none served this run.');
});

test('readDirective reads the detail feature only as a served true', () => {
  const base = { schema_version: '1.23.0', engine_id: 'growth-mindmake', directive_id: 'mindmake:2026-11-13', next_action: { proposal_id: null, instruction: 'x', why: 'y', close_condition: null }, decisions_since: [], objectives: [], ai_answers: { standing: standing(), rule: 'r' } };
  assert.equal(readDirective({ ok: true, directive: { ...base, features: { ai_answers: true, ai_answers_detail: true } } }).ai_answers_detail, true);
  assert.equal(readDirective({ ok: true, directive: { ...base, features: { ai_answers: true, ai_answers_detail: 'yes' } } }).ai_answers_detail, false);
  assert.equal(readDirective({ ok: true, directive: { ...base, features: { ai_answers: true } } }).ai_answers_detail, false);
  assert.equal(readDirective({ ok: true, directive: base }).ai_answers_detail, false);
});

test('a dispatch carries the kits as one counted line where the detail is served, and none of a kit\'s words', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
  const s = withKits([kit('m1', 4), kit('m2', 1)], [['ctrl', [kit('c1', 9)]]]);
  const dispatch = async features => {
    const reports = [];
    const cc = {
      recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', features, ai_answers: { standing: s, rule: 'r' } }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true } }),
      context: async () => ({ ok: true, context: capsContext() }),
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1),
    };
    await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-answers-kits-1234', clock: () => section12AT,
      canonReader: async () => section12Canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/answers.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null });
    return reports[0];
  };
  const served = await dispatch({ ai_answers: true, ai_answers_detail: true });
  const lines = served.activity.map(a => a.line);
  const kitLines = lines.filter(l => l.startsWith('AI-answer kits from AEO-Engine: '));
  assert.deepEqual(kitLines, ["AI-answer kits from AEO-Engine: 2 for Mindmake and 1 for its portfolio read, the best 3 kept in this run's memory; no stage uses them yet."]);
  assert.equal(lines.indexOf(kitLines[0]), lines.indexOf('AI answers: tracked, not asked yet.') + 1, 'right after the standing line');
  const sent = JSON.stringify(served);
  for (const words of ['Which invented firm', 'Invented answer page', 'rival.example', 'forum.example', 'pod.example', 'An invented fix', 'Answer in the first sentence']) assert.ok(!sent.includes(words), `the report never carries a kit's words: ${words}`);
  // Before Control Center ships the detail, the run is unchanged: no kits line.
  const before = await dispatch({ ai_answers: true });
  assert.equal(before.activity.filter(a => a.line.startsWith('AI-answer kits')).length, 0);
  assert.ok(before.activity.some(a => a.line === 'AI answers: tracked, not asked yet.'));
});

test('a dispatch reads its own recent reports for the asked list\'s mark, so a digest that never meets is asked once', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
  const ctx = { ...capsContext(), records: { ...capsContext().records, touchpoints: many(10) } };
  const plan = answersRequest({ context: ctx, canon: section12Canon });
  assert.ok(plan, 'the invented places give a plan');
  const kept = standing({ request: { id: 'x', state: 'open', questions: 24, requested_at: '2026-11-12T10:00:00Z', served_at: null, digest: questionsDigest(plan.questions.slice(1)) } });
  const dispatch = async recent => {
    const reports = [], posted = [];
    const cc = {
      recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', features: { ai_answers: true, ai_answers_detail: true }, ai_answers: { standing: kept, rule: 'r' } }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, ai_answers: true } }),
      context: async () => ({ ok: true, context: ctx }), answers: async body => { posted.push(body); return { ok: true, request_id: 'r5', questions: body.questions.length, replaced: true }; },
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1),
    };
    await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-answers-marks-1234', clock: () => section12AT,
      canonReader: async () => section12Canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/answers.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null, historyReader: async () => recent });
    return { lines: reports[0].activity.map(a => a.line), posted };
  };
  const first = await dispatch([]);
  assert.equal(first.posted.length, 1, 'no mark read back: asked, replacing the request');
  assert.equal(first.posted[0].mode, 'replace');
  const askedLine = first.lines.find(l => l.startsWith('Asked AEO-Engine again'));
  assert.ok(askedLine?.endsWith(`(${questionsMark(first.posted[0].questions)}).`), 'the asked line carries the list\'s mark');
  const again = await dispatch([{ activity: [{ line: askedLine }] }]);
  assert.equal(again.posted.length, 0, 'the same exact list is not asked again');
  assert.ok(again.lines.some(l => l.startsWith('AI answers: the request on file still reads differently from the plan')));
  // A report is public: the mark is a digest, never a question's words.
  for (const q of first.posted[0].questions) assert.ok(!JSON.stringify(again.lines).includes(q));
});
