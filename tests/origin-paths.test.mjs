import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildReport } from '../src/dispatch.mjs';
import { originCandidates, PATHS, NEXT_PATHS, pathsFor, PATHS_VERSION } from '../src/stages/meetings.mjs';
import { violations } from './support/engine-protocol-service.mjs';

// cc-live-6 / seams-9 (14 November 2026): no held meeting got an origin. The
// network part ranks only a hundred people, so long-standing ties in his
// meetings were never found; and a full-funnel path never raised the report.
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const AT = '2026-11-14T08:00:00Z';
const cid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mtg = (n, o = {}) => ({ meeting_id: `m${n}`, contact_id: cid(n), held_at: '2026-11-10T10:00:00Z', good: null, origin_path: null, ...o });
const report = origin_candidates => buildReport({ run_id: 'gm-paths-1', mode: 'synthetic', observed_at: AT, source: { revision: 'abc', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], holds: [], origin_candidates });

test('a tie he had before, served outside the ranked hundred, is an existing relationship; a contact filed from the meeting is not', () => {
  const context = {
    amplifier_candidates: [{ contact_id: cid(1), network_tier: '1_reciprocated' }],
    quiet_ties: [{ contact_id: cid(2), network_tier: '4_owned_network', known_since: '2024-01-01' }],
    records: { advisory: [{ contact_id: cid(3), person: { network_tier: '2_engaged' } }] },
    network: []
  };
  context.amplifier_candidates.push({ contact_id: cid(4), network_tier: '4_owned_network', known_since: '2026-11-10T10:00:00Z' });
  const by = Object.fromEntries(originCandidates({ meetings: [1, 2, 3, 4, 5].map(n => mtg(n)), context }).map(c => [c.contact_id, c.path]));
  assert.equal(by[cid(1)], 'existing-relationship');
  assert.equal(by[cid(2)], 'existing-relationship', 'known before the meeting');
  assert.equal(by[cid(3)], 'existing-relationship', "Advisory's person row");
  assert.equal(by[cid(4)], undefined, 'filed from the meeting itself: nothing guessed');
  assert.equal(by[cid(5)], undefined, 'nobody serves them: unknown at his tap');
});

test('a path the receiver does not serve is never sent', () => {
  assert.deepEqual(originCandidates({ meetings: [mtg(1)], context: { network: [{ contact_id: cid(1) }] }, paths: ['podcast'] }), []);
  assert.deepEqual(pathsFor({ schema_versions: [PATHS_VERSION], features: { meeting_paths: true } }), [...PATHS, ...NEXT_PATHS]);
});

test('a full-funnel path raises the report to 1.24.0, and the stand-in takes it', () => {
  const plain = report([{ contact_id: cid(1), path: 'existing-relationship', origin_ref: null }]);
  assert.notEqual(plain.schema_version, PATHS_VERSION);
  const r = report([{ contact_id: cid(1), path: 'webinar', origin_ref: null }]);
  assert.equal(r.schema_version, PATHS_VERSION);
  assert.deepEqual(violations(schema, r), []);
});
