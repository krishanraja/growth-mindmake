import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { sheetSha, validateSheet, thesisEvidenceIds, adapterErrors, angleFromSheet, ANGLE_MAX } from '../src/lib/insight-sheet.mjs';
import { openingQuery, openingRequest, opening, angleLean, QUERY_MAX } from '../src/stages/openings.mjs';

// The insight desk adapter (Ruling, Krish, 2026-11-24): the method is the ai-harness
// skill; this engine keeps a thin adapter, a Node copy of the sheet's fixed rules and
// one optional angle for the research desk's openings. Without a sheet nothing changes.
const read = p => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const adapter = JSON.parse(await read('config/insight-desk.json'));
const evidence = await read('docs/EVIDENCE.md');
const fixture = JSON.parse(await read('tests/fixtures/insight/sheet.synthetic.json'));
const copy = () => structuredClone(fixture);
const reseal = s => ({ ...s, sheet_sha256: sheetSha(s) });

test('the adapter names this engine, its own namespace, the thesis and never assumes humour', () => {
  assert.equal(adapter.skill, 'insight-desk');
  assert.equal(adapter.venture, 'mindmake');
  assert.equal(adapter.repo, 'krishanraja/growth-mindmake');
  assert.equal(adapter.humour.allowed, false);
  assert.equal(adapter.humour.source, 'get_approved_taste');
  assert.equal(adapter.divergent.namespace, 'growth-mindmake:ideas');
  assert.equal(adapter.thesis.required, true);
  assert.ok(existsSync(new URL(`../${adapter.thesis.evidence}`, import.meta.url)));
  for (const f of adapter.floor) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
  assert.match(adapter.sheets, /^runtime\//, 'sheets stay in the private runtime spool, never committed');
});

test('the synthetic sheet passes the fixed rules, and its hash is the skill\'s hash', () => {
  assert.equal(sheetSha(fixture), fixture.sheet_sha256);
  const v = validateSheet(fixture);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.unchecked, ['method'], 'without the skill\'s method list the method is said to be unchecked');
  assert.deepEqual(validateSheet(fixture, { methods: new Set(['rename-the-problem', 'instrument-first']) }).unchecked, []);
  assert.ok(validateSheet(fixture, { methods: new Set(['ask-directly']) }).errors.some(e => /method/.test(e)));
});

test('the fixed rules refuse what the skill refuses', () => {
  const bad = (mutate, re) => { const s = copy(); mutate(s); const v = validateSheet(reseal(s)); assert.ok(v.errors.some(e => re.test(e)), `${re}: ${v.errors.join('; ')}`); };
  bad(s => { s.stall_check.diagnosis = 'distribution'; }, /not the idea/);
  bad(s => { s.ideas[0].tests.score = 9; }, /no scores|unexpected tests/);
  bad(s => { s.blind_passes[1].lead = 'judgement-gap'; }, /both blind passes/);
  bad(s => { s.blind_passes[1].order = [...s.blind_passes[0].order]; }, /shuffled/);
  bad(s => { s.ideas[0].tests.analogue = { result: 'unavailable', reason: 'none', url: null, read_at: null }; }, /every test passed/);
  bad(s => { delete s.ideas[0].conversion_path.link; }, /conversion path/);
  bad(s => { s.ideas[0].claim = 'A webinar on AI for leaders'; }, /discarded obvious/);
  bad(s => { s.north_star.urgency = 4; s.north_star.current = null; }, /measurement idea/);
  bad(s => { s.ideas[0].claim = `One ${String.fromCharCode(8212)} two`; }, /em dash/);
  const s = copy(); s.lead = 'judgement-gap';
  assert.ok(validateSheet(s).errors.some(e => /does not match/.test(e)), 'an edited sheet must be resealed');
});

test('the thesis may be argued only from evidence that may be stated as fact', () => {
  const ids = thesisEvidenceIds(evidence);
  for (const id of ['E1', 'E2', 'E3']) assert.ok(ids.has(id));
  assert.ok(!ids.has('E7'), 'verify first is never quoted');
  for (const id of ['E11', 'E12']) assert.ok(!ids.has(id), 'the direction of travel is never stated as fact');
  assert.deepEqual(adapterErrors(fixture, adapter, evidence), []);
  const assumed = copy(); assumed.chosen_insight = 1;
  assert.ok(adapterErrors(assumed, adapter, evidence).some(e => /assumption/.test(e)));
  const travel = copy(); travel.insights[0].source = 'docs/EVIDENCE.md E12';
  assert.ok(adapterErrors(travel, adapter, evidence).some(e => /stated as fact/.test(e)));
  const funny = copy(); funny.consults.push({ engine: 'humour-engine', op: 'check', result: 'pass', ref: 'synthetic' });
  assert.ok(adapterErrors(funny, adapter, evidence).some(e => /humour/.test(e)));
  const other = copy(); other.consults[0].ref = 'growth-heartside:ideas';
  assert.ok(adapterErrors(other, adapter, evidence).some(e => /namespace/.test(e)));
});

test('an angle comes only from the idea Krish approved, by name, on a sheet that holds', () => {
  assert.equal(angleFromSheet(fixture, { adapter, evidence }).angle, null, 'the lead alone approves nothing');
  const got = angleFromSheet(fixture, { idea: 'who-decided', adapter, evidence });
  assert.equal(got.angle, 'The question a leader should ask of every AI answer is who decided');
  assert.equal(got.sheet_sha256, fixture.sheet_sha256);
  assert.equal(got.harness_skill_sha, fixture.harness_skill_sha);
  assert.ok(got.angle.length <= ANGLE_MAX);
  assert.equal(angleFromSheet(fixture, { idea: 'judgement-gap', adapter, evidence }).angle, null, 'a measurement idea is no angle for words');
  assert.equal(angleFromSheet(fixture, { idea: 'who-decided', adapter: null, evidence }).angle, null, 'no adapter, no angle');
  const unnamed = copy(); unnamed.ideas[0].claim = 'What Nine Entertainment taught us about who decided.';
  assert.equal(angleFromSheet(reseal(unnamed), { idea: 'who-decided', adapter, evidence }).angle, null);
});

test('without an angle every opening ask is byte for byte as before', () => {
  const base = { name: 'Sam Example', fact: 'They posted: "We moved our whole planning cycle onto one shared model this quarter and it changed the meetings"', last: 'June 2026' };
  for (const purpose of ['catchup', 'invite', 'other']) {
    const p = { ...base, purpose, show: 'The Synthetic Show' };
    assert.equal(openingQuery({ ...p, angle: '' }), openingQuery(p));
    assert.deepEqual(openingRequest({ ...p, id: 'c1', angle: '' }), openingRequest({ ...p, id: 'c1' }));
  }
  assert.equal(angleLean(''), '');
  const card = { facts: [{ kind: 'post', text: 'Posted: "We moved our whole planning cycle onto one shared model this quarter and it changed the meetings"' }] };
  assert.deepEqual(opening({ id: 'c1', name: 'Sam Example', card, research: [], required: true, angle: '' }), opening({ id: 'c1', name: 'Sam Example', card, research: [], required: true }));
});

test('with an angle the desk is asked to lean on it, adding no fact, inside 400 characters', () => {
  const p = { name: 'Sam Example', fact: 'They run planning for a synthetic retailer', purpose: 'invite', show: 'The Synthetic Show' };
  const q = openingQuery({ ...p, angle: 'Ask who decided' });
  assert.ok(q.includes(' Lean toward this angle, adding no new fact: Ask who decided.'));
  assert.ok(q.length <= QUERY_MAX);
  assert.notEqual(openingRequest({ ...p, id: 'c1', angle: 'Ask who decided' }).request_id, openingRequest({ ...p, id: 'c1' }).request_id);
  // A long angle that leaves the fact too little room is dropped, never the email.
  const long = 'x '.repeat(200);
  assert.equal(openingQuery({ ...p, purpose: 'catchup', angle: long }), openingQuery({ ...p, purpose: 'catchup' }));
});
