import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDispatch } from '../src/dispatch.mjs';
import { capsContext } from './support/caps-scenario.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { canon, AT, id } from './support/section12.mjs';
import { withoutCrew } from './support/golden.mjs';

// Plan section 12, M6, M9 and M12 on the protocol stand-in: each ported piece
// reports one counted line beside Control Center's own answers, after the M3
// to M5 lines, and holds, hides or changes nothing. Synthetic throughout.

const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
const HEADS = ['Guest standard, in shadow: ', 'Visibility standard, in shadow: ', 'Room scoring, in shadow: ', 'Pilot machine, in shadow: ', 'Outreach briefs, in shadow: ', 'Ingest gate, in shadow: '];

function context() {
  const base = capsContext();
  return {
    ...base,
    network: [{ contact_id: id(101), current_title: 'Founder', contacts: { title: 'Founder' } }, { contact_id: id(102), current_title: 'Managing Partner', contacts: { title: 'Managing Partner' } }],
    records: { ...base.records, advisory: [
      { id: id(1), contact_id: id(101), state: 'listed', ask_kind: 'buyer', notes: null },
      { id: id(2), contact_id: id(102), state: 'drafted', ask_kind: 'buyer', draft_subject: 'A thought', draft_body: 'Would a paid three week pilot help? Worth a short call?' },
    ] },
  };
}

async function run(ctx) {
  const reports = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: ctx }),
    decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1),
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-section12-1234', clock: () => AT,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null });
  return { result, report: reports[0] ?? null };
}

test('plan section 12, M6, M9 and M12: each reports one counted line after M3 to M5, carries counts only and holds nothing', async () => {
  const ctx = context();
  const frozen = structuredClone(ctx);
  const { report } = await run(ctx);
  const lines = report.activity.map(a => a.line);
  const at = HEADS.map(h => { const found = lines.filter(l => l.startsWith(h)); assert.equal(found.length, 1, h); return lines.indexOf(found[0]); });
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order, the new three after the first three');
  for (const i of at.slice(3)) {
    assert.doesNotMatch(lines[i], /[0-9a-f]{8}-[0-9a-f]{4}-|@|https?:\/\/|Avery|Example|three week|pilot\?/, `${lines[i]} carries counts and codes only, never an id, an address, a link, a name or a word of a note`);
    assert.doesNotMatch(lines[i], /could not be read this run/, 'each read cleanly');
  }
  assert.match(lines[at[3]], /^Pilot machine, in shadow: 2 Advisory rows read; agrees with Control Center on 1, differs on 1 \(buyer_outside_canon_groups 1\)\./);
  assert.match(lines[at[3]], /Words: 1 drafted note read, 0 say only what the canon supports \(duration_promise 1, offer_named_otherwise 1\)\.$/);
  assert.match(lines[at[5]], /^Ingest gate, in shadow: 0 contacts read; .*Pinned offer copy: not compared this run\.$/, 'no legacy snapshot served, so nothing compared and nothing assumed');
  assert.equal(report.holds.some(h => /pilot|brief|ingest|canon_buyer|offer/i.test(h.reason)), false, 'nothing is held by them');
  assert.deepEqual(ctx, frozen, 'the context is read, never changed');
  // Without the six shadow lines the report is the one the same run gives with the shadows unable to see anything.
  const blind = await run({ ...context(), records: { ...context().records, advisory: [] }, network: [] });
  assert.equal(blind.report.proposals.length, report.proposals.length, 'the proposals do not depend on what the shadows read');
  assert.notEqual(withoutCrew(report), report.payload_sha256, 'the golden filter leaves the new lines out');
});

test('a shadow that throws says so in one line and never fails the run', async () => {
  const ctx = { ...context(), source_revision: 'synthetic-revision' };
  // A note only the pilot machine reads, whose words cannot be read: a getter that fails.
  Object.defineProperty(ctx.records.advisory[1], 'draft_body', { get() { throw new Error('unreadable'); }, enumerable: false });
  const { result, report } = await run(ctx);
  assert.ok(report, 'the run still reported');
  assert.notEqual(result.status, 'failed');
  const lines = report.activity.map(a => a.line);
  assert.ok(lines.some(l => /^pilotsShadow: could not be read this run, so it says nothing rather than a guess\.$/.test(l)));
});
