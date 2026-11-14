import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { noteContact, noteActionOk, runDispatch, payloadDigest } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';

// Integration I-03, contact_notes (Control Center #825): an approved plan that is a note to one person. Synthetic only.
const ID = '00000000-0000-4000-8000-0000000000aa';
const plan = ref => ({ proposal_id: 'gmc-note-1', decision: 'approved', stage: 'plan', exact_payload: JSON.stringify({ ref, first_action: { subject: 'S', body: 'B' } }) });
const action = (o = {}) => ({ version: 1, channel: 'email', recipient_contact_id: ID, subject: 'S', body: 'B', assets: [], cost_usd: 0, source_ref: `contact:${ID}`, expires_at: '2026-11-05T00:00:00Z', ...o });

test('a note plan names its one person; any other plan is not a note', () => {
  assert.equal(noteContact(plan(`contact:${ID}`)), ID);
  assert.equal(noteContact(plan('pilot:abc')), null);
  assert.equal(noteContact({ exact_payload: '{' }), null);
});

test('the prepared action must be the note to that person, with no asset', () => {
  assert.equal(noteActionOk(action(), ID), true);
  assert.equal(noteActionOk(action({ recipient_contact_id: '00000000-0000-4000-8000-0000000000bb' }), ID), false);
  assert.equal(noteActionOk(action({ source_ref: 'pilot:x' }), ID), false);
  assert.equal(noteActionOk(action({ assets: [{}] }), ID), false);
});

async function run(features, prepared) {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [], calls = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture(),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { exact_actions: true, ...features } }),
    decisions: async () => [plan(`contact:${ID}`)],
    prepareAction: async id => { calls.push(id); return prepared; },
    postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1)
  };
  await runDispatch({ cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, attemptId: 'gma-synthetic-12345678', clock: () => '2026-11-03T12:00:00Z' });
  return { report: reports[0], calls };
}

test('without features.contact_notes the note waits and prepare-action is never asked', async () => {
  const { report, calls } = await run({}, null);
  assert.deepEqual(calls, []);
  assert.ok(report.holds.some(h => h.reason === 'contact_notes_not_served'));
});

test('with it, the exact note is filed as go_live under the plan; a mismatched one is held', async () => {
  const a = action();
  const good = await run({ contact_notes: true }, { ok: true, prepared: { parent_proposal_id: 'gmc-note-1', action: a, payload_sha256: payloadDigest(a) } });
  const live = good.report.proposals.find(p => p.stage === 'go_live');
  assert.ok(live, 'filed');
  assert.equal(live.parent_proposal_id, 'gmc-note-1');
  assert.equal(live.subject_ref, `contact:${ID}`);
  assert.equal(live.payload_sha256, payloadDigest(a));
  const b = action({ recipient_contact_id: '00000000-0000-4000-8000-0000000000bb' });
  const bad = await run({ contact_notes: true }, { ok: true, prepared: { parent_proposal_id: 'gmc-note-1', action: b, payload_sha256: payloadDigest(b) } });
  assert.ok(!bad.report.proposals.some(p => p.stage === 'go_live'));
  assert.ok(bad.report.holds.some(h => h.reason === 'approved_plan_preparation_blocked'));
});
