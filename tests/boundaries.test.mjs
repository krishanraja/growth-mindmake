import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBatch, parseSnapshot, semanticBatch } from '../contracts/growth.ts';
import { plan } from '../src/orchestrator.mjs';
import { AT, POLICY, contact, copy, evidence, snapshot } from './helpers.mjs';

test('a private buying moment is held and confidential source evidence never enters the approval draft', () => {
  const privateTrigger = snapshot();
  privateTrigger.contacts[0].buying_moment.visibility = 'private';
  privateTrigger.contacts[0].buying_moment.fact = 'CONFIDENTIAL_TRIGGER';
  const held = plan(privateTrigger, POLICY, { at: AT });
  assert.equal(held.recommendations.length, 0);
  assert.doesNotMatch(JSON.stringify(held), /CONFIDENTIAL_TRIGGER/);
  const mixed = snapshot();
  mixed.contacts[0].evidence.push(evidence('relationship', { id: 'private-context', visibility: 'private', fact: 'CONFIDENTIAL_RELATIONSHIP_NOTE' }));
  const prepared = plan(mixed, POLICY, { at: AT });
  assert.equal(prepared.recommendations.length, 1);
  assert.doesNotMatch(JSON.stringify(prepared), /CONFIDENTIAL_RELATIONSHIP_NOTE/);
  assert.ok(prepared.recommendations[0].evidence.every(e => e.visibility === 'public'));
  const unsafe = copy(prepared); unsafe.recommendations[0].evidence[0].visibility = 'private';
  assert.throws(() => parseBatch(unsafe), /private evidence/);
});

test('public proof cannot be replaced by a private person or company record', () => {
  for (const kind of ['person', 'company']) {
    const input = snapshot(); input.contacts[0].evidence.find(e => e.kind === kind).visibility = 'private';
    assert.equal(plan(input, POLICY, { at: AT }).recommendations.length, 0);
  }
  const input = snapshot(); delete input.contacts[0].buying_moment.visibility;
  assert.throws(() => parseSnapshot(input));
});

test('evidence links reject embedded credentials and token-bearing queries before they can reach a draft', () => {
  const urls = [
    'https://user:synthetic@example.com/source',
    'https://example.com/source?access_token=synthetic',
    'https://example.com/source?api_key=synthetic',
    'https://example.com/source?signature=synthetic',
    'https://example.com/source?auth=synthetic',
    'https://example.com/source#token=synthetic'
  ];
  for (const url of urls) {
    const input = snapshot(); input.contacts[0].buying_moment.url = url;
    assert.throws(() => plan(input, POLICY, { at: AT }));
  }
  const ordinaryLink = snapshot(); ordinaryLink.contacts[0].buying_moment.url = 'https://example.com/source?utm_source=synthetic';
  assert.equal(plan(ordinaryLink, POLICY, { at: AT }).recommendations.length, 1);
});

test('an introduction uses the canonical connector recipient and holds mismatched connector names', () => {
  const connector = contact('connector', { full_name: 'Canonical Connector', relationship: 'warm' });
  const buyer = contact('buyer-a', { connector: { contact_id: connector.id, full_name: connector.full_name, both_opted_in: false } });
  const input = snapshot({ contacts: [buyer, connector] });
  const prepared = plan(input, POLICY, { at: AT });
  const intro = prepared.recommendations.find(r => r.contact_id === buyer.id);
  assert.equal(intro.mode, 'intro');
  assert.equal(intro.recipient_contact_id, connector.id);
  assert.match(intro.draft.body, /^Canonical,/);
  const mismatch = copy(input); mismatch.contacts[0].connector.full_name = 'Mismatched Connector';
  const held = plan(mismatch, POLICY, { at: AT });
  assert.ok(!held.recommendations.some(r => r.contact_id === buyer.id));
  assert.ok(held.report.held.some(r => r.contact_id === buyer.id && r.reason === 'connector_identity_conflict'));
});

test('one recipient receives at most one prepared item across intro requests and their own warm opportunity', () => {
  const connector = contact('connector', { full_name: 'Canonical Connector', relationship: 'warm' });
  const connectorReference = { contact_id: connector.id, full_name: connector.full_name, both_opted_in: false };
  const buyers = ['buyer-a', 'buyer-b'].map(id => contact(id, { connector: copy(connectorReference) }));
  const prepared = plan(snapshot({ contacts: [...buyers, connector] }), POLICY, { at: AT });
  assert.equal(prepared.recommendations.length, 1);
  assert.equal(prepared.recommendations[0].recipient_contact_id, connector.id);
  assert.equal(prepared.recommendations[0].mode, 'intro');
  assert.equal(prepared.report.held.filter(h => h.reason === 'recipient_already_selected').length, 2);
  const duplicate = copy(prepared); duplicate.recommendations.push({ ...copy(duplicate.recommendations[0]), recommendation_id: 'different-recommendation', contact_id: 'different-buyer' });
  assert.throws(() => parseBatch(duplicate), /duplicate identity/);
});

test('missing freshness policy and empty buyer criteria fail closed rather than disabling protection', () => {
  for (const field of ['snapshot_max_age_hours', 'canon_max_age_days', 'trigger_max_age_days', 'evidence_max_age_days']) {
    const policy = copy(POLICY); delete policy.limits[field];
    assert.throws(() => plan(snapshot(), policy, { at: AT }), /Unsafe engine policy/);
  }
  const input = snapshot(); input.icp.buyer_titles = [];
  assert.throws(() => plan(input, POLICY, { at: AT }), /buyer criteria/);
});

test('the wire replay payload preserves authoritative revision and ignores delivery-only clock refreshes', () => {
  const input = snapshot();
  const first = plan(input, POLICY, { at: '2026-10-16T13:05:00Z' });
  input.generated_at = '2026-10-16T13:50:00Z';
  const refresh = plan(input, POLICY, { at: '2026-10-16T13:55:00Z' });
  assert.equal(first.snapshot_revision, input.source_revision);
  assert.equal(refresh.snapshot_revision, input.source_revision);
  assert.equal(refresh.run_id, first.run_id);
  assert.notEqual(refresh.generated_at, first.generated_at);
  assert.deepEqual(semanticBatch(refresh), semanticBatch(first));
  input.contacts[0].buying_moment.fact = 'A changed public pricing decision with the same source revision.';
  assert.notEqual(plan(input, POLICY, { at: '2026-10-16T13:55:00Z' }).run_id, first.run_id);
});

test('a London week change creates a new run even while the UTC date is unchanged', () => {
  const input = snapshot({ generated_at: '2026-10-18T22:00:00Z' });
  const sunday = plan(input, POLICY, { at: '2026-10-18T22:59:59Z' });
  const monday = plan(input, POLICY, { at: '2026-10-18T23:00:00Z' });
  assert.equal(sunday.report.scorecard.week_starts, '2026-10-12');
  assert.equal(monday.report.scorecard.week_starts, '2026-10-19');
  assert.notEqual(sunday.run_id, monday.run_id);
});
