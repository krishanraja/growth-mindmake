import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDispatch } from '../../src/dispatch.mjs';
import { parseCanon, blobSha } from '../../src/stages/canon.mjs';
import { directiveFixture } from '../support/engine-protocol-service.mjs';
import { capsContext, AT } from '../support/caps-scenario.mjs';

// F48: live run manual-24 read no context, prepared nothing and journaled
// success. A live run that reads nothing, or reads work and prepares and
// holds nothing, now ends as a held run with a named class: the report still
// goes and is read back, and the terminal attempt says why, never succeeded.
const policy = JSON.parse(await readFile(new URL('../../config/policy.json', import.meta.url), 'utf8'));
const NORTH_STAR = '# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement.\n';
const CANON = "## What the growth engine may say\n\n1. **Start building your AI brain**, at `https://mindmake.example/?start=1`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at `https://publication.example`, free.\n";

function harness({ capabilities, context = null, contextFails = false }) {
  const reports = [], attempts = [];
  const cc = {
    recordAttempt: async a => { attempts.push(a); return { ok: true }; },
    directive: async () => directiveFixture({ schema_version: '1.9.0' }),
    capabilities: async () => capabilities,
    context: async () => { if (contextFails) throw Object.assign(new Error('too big'), { code: 'response_over_budget' }); return { ok: true, context }; },
    decisions: async () => [],
    postReport: async r => { reports.push(r); return { replayed: false }; },
    readReport: async () => { const r = reports.at(-1); if (!r) throw Object.assign(new Error('none'), { status: 404 }); return r; }
  };
  return { cc, reports, attempts };
}
const run = (h, mode = 'live') => runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode, kind: 'dispatch', attemptId: 'gma-silent-000001', clock: () => AT,
  canonReader: async () => ({ ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] }),
  wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null });

test('a live run that reads nothing ends failed as nothing_read, with its report sent and read back (F48)', async () => {
  const h = harness({ capabilities: { activation: { activated_on: '2026-10-18' }, features: {} } });
  const result = await run(h);
  assert.equal(result.status, 'failed');
  assert.equal(result.error_code, 'nothing_read');
  assert.equal(result.report.read_back, true);
  assert.equal(h.reports[0].status, 'degraded');
  assert.deepEqual(h.attempts.map(a => [a.status, a.error_code]), [['started', null], ['failed', 'nothing_read']]);
});

test('a live run whose advertised context cannot be read ends failed as context_unread, the manual-24 shape (F48)', async () => {
  const h = harness({ capabilities: { activation: { activated_on: '2026-10-18' }, features: { context: true } }, contextFails: true });
  const result = await run(h);
  assert.equal(result.error_code, 'context_unread');
  assert.ok(h.reports[0].holds.some(x => x.reason === 'context_read_unavailable'));
});

test('a live run that reads people to work on and neither prepares nor holds one ends failed as nothing_prepared (F48)', async () => {
  const context = { ...capsContext(), amplifier_candidates: [{ contact_id: '00000000-0000-4000-8000-000000000901', network_tier: '2_core_network', current_title: 'Gardener', followers: 10, mindmake_fit: 80, contacts: { full_name: 'Avery Example', status: 'active' } }], records: { advisory: [], visibility: [], drafts: [], guests: [] } };
  const h = harness({ capabilities: { activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true } }, context });
  const result = await run(h);
  assert.equal(result.error_code, 'nothing_prepared');
  assert.ok(h.reports[0].holds.some(x => x.reason === 'nothing_prepared'));
});

test('a synthetic run keeps reporting how the protocol went, and a live run that prepared work succeeds (F48)', async () => {
  const synthetic = await run(harness({ capabilities: { features: {} } }), 'synthetic');
  assert.equal(synthetic.status, 'succeeded');
  const h = harness({ capabilities: { activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true } }, context: capsContext() });
  const live = await run(h);
  assert.equal(live.status, 'succeeded', JSON.stringify(live.report?.holds));
  assert.ok(h.reports[0].proposals.length > 0);
});
