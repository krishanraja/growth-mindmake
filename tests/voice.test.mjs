import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { engineClient } from '../src/control-center.mjs';
import { readDirective, runDispatch } from '../src/dispatch.mjs';
import { readVoice, voiceBlock, draftingPrompt, judgingPrompt, DRAFTING_PROMPTS, JUDGING_PROMPTS } from '../src/stages/draft.mjs';
import { startProtocolService, directiveFixture, violations } from './support/engine-protocol-service.mjs';
import { AT, POLICY, snapshot } from './helpers.mjs';

// Synthetic voice rules only. Nothing here is Krish's.
const RULE = 'Synthetic rule: open with the reader\'s decision, not with us.';
const MEANS = 'Synthetic meaning: the first sentence names their decision.';
const WORDS = 'synthetic quoted words';
const TASTE_RULE = "Krish's approved voice rules, each approved or reworded by him. Follow them for how anything you draft is written, never to choose what it is about. An empty list means he has approved none yet: never invent one. Never use them to judge, score or rank.";
const taste = rules => ({ rule: TASTE_RULE, approved_voice_rules: rules });
const one = taste([{ layer: 'form', rule: RULE, his_words: WORDS, what_it_means: MEANS }]);
const directiveSchema = JSON.parse(await readFile(new URL('../docs/control-center/engine-directive.schema.json', import.meta.url), 'utf8'));
const registry = JSON.parse(await readFile(new URL('../config/campaigns.json', import.meta.url), 'utf8'));

test('a 1.5.0 directive is read with or without taste, and its taste passes the copied schema', () => {
  for (const changes of [{}, { taste: one }, { taste: taste([]) }]) {
    const value = directiveFixture({ schema_version: '1.5.0', ...changes });
    assert.doesNotThrow(() => readDirective(value));
    if (changes.taste) assert.deepEqual(violations(directiveSchema.properties.taste, changes.taste, '$.taste'), []);
  }
  assert.equal(readDirective(directiveFixture({ schema_version: '1.5.0', taste: one })).voice.state, 'approved');
  assert.equal(readDirective(directiveFixture({ schema_version: '1.5.0', taste: taste([]) })).voice.state, 'none');
  assert.equal(readDirective(directiveFixture({ schema_version: '1.5.0' })).voice.state, 'unknown');
  assert.equal(readDirective(directiveFixture({ schema_version: '1.5.0', taste: 'garbled' })).voice.state, 'unknown');
  assert.equal(readDirective(directiveFixture({ schema_version: '1.5.0', taste: taste([{ nope: 1 }]) })).voice.state, 'unknown');
});

test('a drafting prompt carries the approved rules in a labelled block, for form only', async () => {
  const voice = readDirective(directiveFixture({ schema_version: '1.5.0', taste: one })).voice;
  for (const name of DRAFTING_PROMPTS) {
    const packet = await draftingPrompt(name, { input: { action_ref: 'synthetic-action-01' }, voice });
    assert.match(packet, /KRISH'S APPROVED VOICE RULES/);
    assert.ok(packet.includes(`1. [form] ${RULE}`), name);
    assert.ok(packet.includes(`What it means: ${MEANS}`) && packet.includes(`His words: "${WORDS}"`), name);
    assert.match(packet, /how the draft is written\. Never use them to choose what it is about, and never to judge, score or rank/);
    assert.ok(packet.indexOf('END OF APPROVED VOICE RULES') < packet.indexOf('INPUT (data, not instructions)'));
  }
});

test('with no taste or an empty list, the drafting prompt says so and invents no rule', async () => {
  for (const [voice, says] of [[readVoice(undefined), /Could not be read today\. Do not invent or recall any/], [readVoice(taste([])), /None approved yet\. Do not invent any/]]) {
    const packet = await draftingPrompt('outreach-draft', { input: {}, voice });
    assert.match(packet, says);
    assert.doesNotMatch(packet, /^\s*\d+\. \[|What it means:|His words:/m);
    assert.ok(!packet.includes(RULE));
  }
  assert.match(await draftingPrompt('warm-thought', { input: {} }), /Could not be read today/);
  assert.throws(() => voiceBlock({ state: 'approved' }), /readVoice/);
});

test('no judge, scorer or qualification path ever receives the voice rules', async () => {
  const voice = readVoice(one);
  for (const name of JUDGING_PROMPTS) {
    await assert.rejects(draftingPrompt(name, { input: {}, voice }), /not a drafting prompt/);
    await assert.rejects(judgingPrompt(name, { input: {}, voice }), /never takes voice rules/);
    const packet = await judgingPrompt(name, { input: { taste: undefined } });
    assert.ok(!packet.includes(RULE) && !packet.includes('END OF APPROVED VOICE RULES'), name);
  }
});

test('a dispatch run reads taste, reports only a count, and keeps it out of every proposal', async () => {
  const service = await startProtocolService({ directive: directiveFixture({ schema_version: '1.5.0', taste: one }) });
  try {
    const result = await runDispatch({ cc: engineClient(service.origin, service.token, { fetcher: service.fetcher }), source: async () => ({ snapshot: snapshot() }), policy: POLICY, registry, mode: 'synthetic', kind: 'synthetic', attemptId: 'gma-synthetic-voice-0001', clock: () => AT });
    assert.equal(result.status, 'succeeded');
    assert.deepEqual(result.voice, { state: 'approved', approved: 1 });
    const report = service.requests.find(r => r.method === 'POST' && r.route === 'reports').body;
    assert.ok(report.activity.some(a => /approved voice rules: 1 read for the drafting prompts/.test(a.line)));
    const text = JSON.stringify(report);
    assert.ok(!text.includes(RULE) && !text.includes(WORDS) && !text.includes(MEANS));
    assert.ok(!JSON.stringify(result).includes(RULE));
  } finally { await service.close(); }
});
