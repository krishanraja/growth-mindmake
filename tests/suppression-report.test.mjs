import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDispatch, buildReport } from '../src/dispatch.mjs';
import { suppressionFields, SUPPRESSION_BYTES } from '../src/stages/suppression.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';

// Synthetic shapes only. Plan section 12, M10: the list and the taxonomy go out only where Control Center applies them.
const AT = '2026-10-28T06:00:00Z';
const S = n => `contact:00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const daysAgo = d => new Date(Date.parse(AT) - d * 86400000).toISOString();
const answer = (n, over = {}) => ({ proposal_id: `gmp-${n}`, state: 'declined', row: 'reach_out', subject_ref: S(n), decided_at: daysAgo(2), carried_out: null, reason_code: 'wrong_person', amplifier_kind: 'connector', features: { sector: 'media', topic: 'leadership', seniority: null }, reach: { band: '1k_10k' }, ...over });
const feedback = [answer(1, { reason_code: 'already_in_touch' }), answer(2, { reason_code: 'not_now' }), answer(3, { reason_code: 'too_small' })];

function run(features) {
  const reports = [];
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directiveFixture({ schema_version: '1.9.0' }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features }), decisions: async () => [],
    context: async () => ({ ok: true, context: { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: AT, coverage: [], records: {}, feedback } }),
    outcomes: async () => { throw new Error('not served'); },
    readReport: async () => { const r = reports.at(-1); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, report: r }; },
    postReport: async r => { reports.push(r); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
    prepareAction: async () => { throw new Error('no route'); }, actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); }, executeAction: async () => { throw new Error('none'); }
  };
  return { cc, reports };
}

test('the dispatch sends its suppression list and taxonomy only where Control Center says features.suppression', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const go = h => runDispatch({ cc: h.cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode: 'synthetic', attemptId: 'gma-synthetic-suppress1', clock: () => AT });
  const line = r => r.activity.find(a => a.line.startsWith('Suppression, in shadow')).line;

  const yes = run({ context: true, suppression: true });
  assert.equal((await go(yes)).status, 'succeeded');
  const r = yes.reports[0];
  assert.deepEqual(violations(schema, r), []);
  assert.deepEqual(r.suppression.never, [S(1)]);
  assert.deepEqual(r.suppression.paused.map(p => p.subject_ref), [S(2)]);
  assert.deepEqual(r.suppression.reach_floor, [{ kind: 'connector', at_or_below: '1k_10k' }]);
  assert.equal(r.taxonomy.version, 1);
  assert.equal(r.taxonomy.rows.length, 5);
  assert.match(line(r), /both sent with this report for Control Center to apply\.$/);
  assert.ok(!JSON.stringify(r.suppression).includes('@'), 'references only, never an address');

  const no = run({ context: true });
  assert.equal((await go(no)).status, 'succeeded');
  assert.equal(no.reports[0].suppression, undefined, 'never sent where it is not applied');
  assert.equal(no.reports[0].taxonomy, undefined);
  assert.match(line(no.reports[0]), /not sent until Control Center serves it\.$/);
});

test('the fields are both or neither, within their bounds, and the schema refuses a malformed list', async () => {
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(suppressionFields({ feedback: null }, AT), { fields: null, hold: null }, 'no answers read, nothing sent');
  const { fields } = suppressionFields({ feedback }, AT);
  assert.ok(Buffer.byteLength(JSON.stringify(fields.suppression)) <= SUPPRESSION_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(fields.taxonomy)) <= 2048);
  const base = { run_id: 'gmr-synthetic-suppress2', mode: 'synthetic', observed_at: AT, source: { revision: 'synthetic', captured_at: AT }, status: 'ready', objectives: [], activity: ['x'], proposals: [], holds: [] };
  assert.equal(buildReport({ ...base, suppression: fields.suppression }).suppression, undefined, 'one without the other is not sent');
  const both = buildReport({ ...base, ...fields });
  assert.deepEqual(violations(schema, both), []);
  const bad = structuredClone(both);
  bad.suppression.never = ['Jane Example'];
  assert.ok(violations(schema, bad).length > 0, 'a name is never a reference');
  bad.suppression.never = [];
  bad.suppression.version = 2;
  assert.ok(violations(schema, bad).length > 0);
});
