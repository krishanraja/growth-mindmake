import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAIN_SHA256, PLAIN_SYSTEM, analysisSchema, findings, guard, humourCall, sha256 } from '../src/lib/humour.mjs';
import { parseArgs, run } from '../scripts/humour.mjs';

const served = { features: { humour: true } };
const client = payload => ({ calls: [], async humour(c) { this.calls.push(c); return { ok: true, payload }; }, async capabilities() { return served; } });

test('the prompt is the published comprehension-v1:plain, and the tool is submit_analysis', () => {
  assert.equal(sha256(PLAIN_SYSTEM), PLAIN_SHA256);
  const call = humourCall(['A synthetic opening line.'], 'opener');
  assert.equal(call.system, PLAIN_SYSTEM);
  assert.equal(call.tool.name, 'submit_analysis');
  assert.deepEqual(analysisSchema().required, ['comic_reading', 'humour_attempt']);
  assert.ok(JSON.stringify(call.tool.input_schema).length < 30000);
  assert.ok(!call.user.includes('<b>'));
});

test('a joke on Mindmake is flagged, a forced one noted, a plain line passes', async () => {
  assert.deepEqual(findings({ comic_reading: 'supported', humour_attempt: { status: 'reported' } }).rules.length, 1);
  assert.equal(findings({ comic_reading: 'not_supported', humour_attempt: { status: 'supported_inference' } }).notes.length, 1);
  const plain = await guard(['A synthetic line.'], { cc: client({ comic_reading: 'not_supported', humour_attempt: { status: 'none' } }), capabilities: served });
  assert.equal(plain.status, 'pass');
  assert.ok(!JSON.stringify(plain).includes('synthetic line'));
  const joke = await guard(['A synthetic joke.'], { cc: client({ comic_reading: 'supported', humour_attempt: { status: 'reported' } }), capabilities: served });
  assert.equal(joke.status, 'flagged');
});

test('unserved, capped or empty is unavailable, never a pass, and unserved makes no call', async () => {
  const cc = client({ comic_reading: 'not_supported' });
  assert.equal((await guard(['x'], { cc, capabilities: { features: {} } })).status, 'unavailable');
  assert.equal(cc.calls.length, 0);
  const capped = { async humour() { throw Object.assign(new Error('cap'), { status: 429, code: 'daily_humour_cap_reached' }); } };
  const r = await guard(['x'], { cc: capped, capabilities: served });
  assert.equal(r.status, 'unavailable');
  assert.match(r.reason, /cap of 200/);
  assert.equal((await guard(['  '], { cc, capabilities: served })).status, 'unavailable');
});

test('the CLI exits 2 with no bearer and 1 when flagged', async () => {
  assert.equal(parseArgs([]), null);
  const quiet = { out: () => {}, err: () => {}, read: async () => 'A synthetic joke.' };
  assert.equal(await run(['--file', 'x'], { ...quiet, env: {}, makeClient: () => { throw new Error('no bearer'); } }), 2);
  assert.equal(await run(['--file', 'x', '--surface', 'post'], { ...quiet, env: {}, makeClient: () => client({ comic_reading: 'supported', humour_attempt: { status: 'reported' } }) }), 1);
});
