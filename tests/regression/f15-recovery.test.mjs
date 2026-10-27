import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDispatch, reportDigest } from '../../src/dispatch.mjs';
import { directiveFixture } from '../support/engine-protocol-service.mjs';

// F15: a restarted live run could prepare new bytes under an accepted run id.
// It now reuses the accepted report, and stops on recovery_report_mismatch
// when the stored one does not hold together. Both live branches, tested.
const policy = JSON.parse(await readFile(new URL('../../config/policy.json', import.meta.url), 'utf8'));
const AT = '2026-11-03T06:10:00Z';
const RUN = 'mindmake:2026-11-03:dispatch';

function harness(previous) {
  const calls = { posted: 0, attempts: [], context: 0 };
  const cc = {
    recordAttempt: async a => { calls.attempts.push(a); return { ok: true }; },
    directive: async () => directiveFixture(),
    readReport: async id => { assert.equal(id, RUN); if (!previous) throw Object.assign(new Error('none'), { status: 404 }); return previous; },
    capabilities: async () => { calls.context++; return { features: {} }; },
    postReport: async () => { calls.posted++; return { replayed: false }; },
    decisions: async () => []
  };
  return { cc, calls };
}
const run = cc => runDispatch({ cc, source: async () => { throw new Error('a replay reads no source'); }, policy, registry: {}, mode: 'live', kind: 'dispatch', attemptId: 'gma-recovery-0001', clock: () => AT });
function stored(over = {}) {
  const report = { schema_version: '1.2.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', run_id: RUN, mode: 'live', observed_at: AT, source: { revision: 'r', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], events: [], holds: [], ...over };
  return { report, payload_sha256: reportDigest(report) };
}

test('a restarted live run reuses its accepted report: nothing is read, prepared or posted again (F15)', async () => {
  const { cc, calls } = harness(stored());
  const result = await run(cc);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.report.replayed, true);
  assert.equal(result.report.read_back, true);
  assert.equal(calls.posted, 0, 'no new bytes under the accepted run id');
  assert.equal(calls.context, 0, 'nothing is read for planning');
  assert.deepEqual(calls.attempts.map(a => a.status), ['started', 'succeeded']);
});

test('a stored report that does not match its run, its mode or its digest stops the run as recovery_report_mismatch (F15)', async () => {
  for (const bad of [
    { ...stored(), payload_sha256: 'f'.repeat(64) },
    stored({ mode: 'synthetic' }),
    stored({ run_id: 'mindmake:2026-11-02:dispatch' }),
    stored({ engine_id: 'growth-other' })
  ]) {
    const { cc, calls } = harness(bad);
    const result = await run(cc);
    assert.equal(result.status, 'failed');
    assert.equal(result.error_code, 'recovery_report_mismatch');
    assert.equal(calls.posted, 0);
    assert.equal(calls.attempts.at(-1).phase, 'recovery');
  }
});
