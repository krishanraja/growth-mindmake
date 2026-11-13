import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answersLine, answersRequest, answersStep, readAiAnswers } from '../src/stages/answers.mjs';
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
