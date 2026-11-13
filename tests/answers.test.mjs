import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiAnswersReadable, answersLine, answersRequest, answersStep, askFor, readAiAnswers, validQuestion, MAX_REQUEST_QUESTIONS } from '../src/stages/answers.mjs';
import { enginePlan, MAX_PROBES_PER_RUN } from '../src/stages/places.mjs';
import { readDirective } from '../src/dispatch.mjs';

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
