import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runDispatch } from '../src/dispatch.mjs';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { capsReport } from './support/caps-scenario.mjs';
import { golden } from './support/golden.mjs';

// The golden test (plan Phase 2, accept): under the default week spec every
// dispatch fixture gives a byte-identical report to the one it gave before the
// spec existed. Each earlier test file checks its own reports against
// tests/golden/<file>.json as it posts them (tests/support/golden.mjs). This
// file adds the one fixture that binds every cap the spec can set, whose digest
// in tests/golden/golden.json was recorded by running it on the code at
// feddec8, before the week spec, with the word files and canon reader pinned.
// It was re-recorded once, when the stages began to act on the engine's own
// verdicts (plan section 12, M3 to M5); with Control Center's verdicts forced
// back in, the same fixture reproduces the report the old code gives it.
// It was re-recorded again on 2026-10-29, when every row and pitch began to
// name good_meetings as its objective: mapping those keys back to
// qualified_conversations reproduced every earlier digest in every file.
const root = new URL('../', import.meta.url);
const policy = JSON.parse(await readFile(new URL('config/policy.json', root), 'utf8'));

test('a fixture that binds every cap gives the report it gave before the week spec, byte for byte', async () => {
  const { result, report } = await capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy, record: golden });
  assert.equal(result.status, 'succeeded');
  // Every cap is reached, so a default spec that moved any of them changes this report.
  const reasons = report.holds.map(h => h.reason);
  for (const cap of ['row_per_row_cap', 'row_low_fit', 'pitch_pitch_per_run_cap', 'speak_pitch_per_run_cap', 'invite_invite_week_or_run_cap', 'form_per_run_cap']) assert.ok(reasons.includes(cap), `${cap} is reached`);
  const jonny = report.proposals.filter(p => { try { return JSON.parse(p.exact_payload).mailbox === 'jonny'; } catch { return false; } });
  // Every row and pitch names the North Star's own objective, good meetings (C1, 2026-10-29), never qualified conversations.
  const aimed = report.proposals.filter(p => /^gm[wp]-/.test(p.proposal_id));
  assert.ok(aimed.length > 0 && aimed.every(p => p.objective_key === policy.north_star.objective && p.objective_key === 'good_meetings'));
  assert.deepEqual([jonny.length, jonny.filter(p => p.close_condition.reference === 'visibility:invite').length, jonny.filter(p => p.row === 'events').length, report.proposals.filter(p => p.channel === 'form').length], [10, 2, 4, 2]);
});

test('every dispatch test file that posts reports has its recorded digests', async () => {
  const files = (await readdir(new URL('tests/golden/', root))).sort();
  assert.deepEqual(files, ['dispatch.json', 'forms.json', 'golden.json', 'meetings.json', 'pitches.json', 'rows.json', 'strategy.json', 'traffic.json', 'voice.json']);
  for (const f of files) {
    const g = JSON.parse(await readFile(new URL(`tests/golden/${f}`, root), 'utf8'));
    assert.ok(g.reports.length > 0 && g.reports.every(d => /^[0-9a-f]{64}$/.test(d)), `${f}: digests only`);
  }
});
