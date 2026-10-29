import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { pitchRows, lookupId, lookupRequests, LOOKUPS_PER_RUN } from '../src/stages/pitches.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';
import { capsContext, capsKit, AT } from './support/caps-scenario.mjs';

// C2 (2026-10-29): a stage, show or guest held only for want of an address files
// a lookup through the research desk in the same run, and a lookup already asked
// is not asked again while it waits. Synthetic only: invented shows, people and ids.
// These reports are not golden: they are checked here, field by field.
const { canon, RECORD, GOALS } = capsKit({ parseCanon, blobSha, parseRecord });
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));

/** The caps fixture with its addresses taken away: two summits and one show held only for no_booking_address, one guest for no_email, one for no_contact. */
function heldContext({ research = [] } = {}) {
  const c = capsContext();
  const vis = c.records.visibility;
  // Summits 1 and 2 (no form) and show 1 lose their address; summit 3 loses it but is also past its deadline, so no lookup.
  for (const t of vis) if ([id(601), id(602), id(401)].includes(t.id)) t.booking_contact_id = null;
  const late = vis.find(t => t.id === id(603));
  late.booking_contact_id = null; late.deadline_at = '2026-10-01T00:00:00Z';
  // Show 2 has no address and is buried: buried wins, so no lookup.
  const buried = vis.find(t => t.id === id(402));
  buried.booking_contact_id = null; buried.buried_at = '2026-10-01T00:00:00Z';
  // Guest 1 has no address on record; guest 2 has no contact at all but a record id of its own.
  c.routes[id(801)] = { email: null, in_network: false };
  const g2 = c.records.guests.find(g => g.contact_id === id(802));
  g2.contact_id = null; g2.id = id(902);
  c.research = research;
  return c;
}

test('a request id is one a subject a London month, never asked again while it waits or once answered, and asked the next day after the cap', () => {
  assert.equal(lookupId('booking:x', [], AT), 'booking:x:2026-10');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10', status: 'answered' }], AT), null, 'answered: wait for Control Center to record the address');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10' }], AT), null, 'asked with no answer yet: waiting');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10', status: 'empty' }], AT), null, 'nothing found this month is not asked again this month');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10', status: 'over_cap' }], AT), 'booking:x:2026-10-27', 'over the cap: a new id the next day, as the desk requires');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10', status: 'over_cap' }, { request_id: 'booking:x:2026-10-27', status: 'failed' }], AT), null, 'once a day');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:xy:2026-10', status: 'answered' }], AT), 'booking:x:2026-10', 'another subject is not this one');
});

test('a held stage, show and guest each file a bounded lookup, stages first, and nothing held for another reason does', () => {
  const r = pitchRows({ context: heldContext(), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  const { requests, waiting, eligible, by } = r.lookups;
  assert.equal(requests.length, LOOKUPS_PER_RUN, 'at most four a run');
  assert.equal(eligible, 5, 'two summits, one show, two guests: the late summit and the buried show are held for their own reasons');
  assert.equal(waiting, 0);
  assert.deepEqual(requests.map(q => q.subject_ref), [`target:${id(601)}`, `target:${id(401)}`, `contact:${id(801)}`, `target:${id(602)}`], 'round robin: a stage, a show, a guest, then the next stage');
  assert.deepEqual(by, { stages: 2, podcasts: 1, guests: 1 });
  assert.deepEqual(requests.map(q => q.request_id), [`booking:${id(601)}:2026-10`, `booking:${id(401)}:2026-10`, `email:${id(801)}:2026-10`, `booking:${id(602)}:2026-10`]);
  for (const q of requests) {
    assert.equal(q.kind, 'search');
    assert.ok(q.query.length <= 400 && q.why.length <= 300);
    assert.doesNotMatch(`${q.query} ${q.why}`, /@|https?:\/\//, 'a query names the show, the stage or the person, never an address');
  }
  // The holds keep their codes until Control Center records the address.
  assert.ok(r.stageHeld.filter(h => h === 'no_booking_address').length >= 3);
  assert.ok(r.held.includes('no_booking_address'));
  assert.ok(r.inviteHeld.includes('no_email') && r.inviteHeld.includes('no_contact'));
  assert.equal(r.proposals.some(p => [`target:${id(601)}`, `target:${id(401)}`, `contact:${id(801)}`].includes(p.subject_ref)), false, 'a lookup is never a pitch');
  // The guest with no contact is asked about by its own record id, with no subject a contact id could name.
  const more = lookupRequests({ guests: [{ lane: 'guest', key: id(902), base: `email:guest:${id(902)}`, score: 1, subject_ref: null, query: 'q', why: 'w' }], at: AT });
  assert.deepEqual(more.requests.map(q => [q.request_id, q.subject_ref]), [[`email:guest:${id(902)}:2026-10`, null]]);
});

test('a lookup already asked is not asked again while it waits, and is counted as waiting', () => {
  const asked = [`booking:${id(601)}:2026-10`, `booking:${id(401)}:2026-10`, `email:${id(801)}:2026-10`].map(request_id => ({ request_id, kind: 'search', status: 'answered', requested_at: '2026-10-26T05:10:00Z' }));
  const r = pitchRows({ context: heldContext({ research: asked }), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  assert.equal(r.lookups.waiting, 3);
  assert.deepEqual(r.lookups.requests.map(q => q.request_id), [`booking:${id(602)}:2026-10`, `email:guest:${id(902)}:2026-10`], 'only the two never asked');
  assert.equal(r.lookups.requests.some(q => asked.some(a => a.request_id === q.request_id)), false);
});

test('a live dispatch run asks the desk for the lookups first in its round, counts them, and keeps every hold', async () => {
  const run = async research => {
    const reports = [], batches = [];
    const cc = {
      recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, network_routes: true } }),
      context: async () => ({ ok: true, context: heldContext({ research }) }),
      research: async requests => { batches.push(requests); return requests.map(q => ({ ...q, status: 'empty', evidence: [], answer: null, requested_at: AT, answered_at: AT })); },
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1)
    };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-lookups-1234', clock: () => AT,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
    return { result, report: reports[0], batches };
  };
  const first = await run([]);
  assert.equal(first.result.status, 'succeeded');
  assert.ok(first.batches[0].length <= 10, 'inside the round of ten');
  assert.deepEqual(first.batches[0].slice(0, 4).map(q => q.request_id.split(':')[0]), ['booking', 'booking', 'email', 'booking'], 'the lookups lead the first round');
  assert.equal(first.result.rows.lookups_asked, 4);
  assert.ok(first.result.rows.research_asked >= 4);
  assert.ok(first.report.holds.some(h => h.reason === 'speak_no_booking_address') && first.report.holds.some(h => h.reason === 'invite_no_email'), 'the holds keep their codes');
  const line = first.report.activity.find(a => a.line.startsWith('Addresses for held pitches and invites'))?.line;
  assert.match(line, /^Addresses for held pitches and invites: 4 looked up this run \(2 stages, 1 podcasts, 1 guests\), 0 already asked and waiting\./);
  assert.match(line, /still needs his yes, and the network rule decides whose box it goes in/);
  assert.deepEqual(violations(schema, first.report), []);
  // The next run reads those lookups back in its context: none is asked again, and the one never asked is.
  const second = await run(first.batches[0].slice(0, 4).map(q => ({ ...q, status: 'empty', requested_at: AT })));
  const again = second.batches.flat().filter(q => /^(?:booking|email):/.test(q.request_id));
  assert.equal(again.some(q => first.batches[0].slice(0, 4).some(f => f.request_id === q.request_id)), false, 'a pending or answered lookup is not asked again');
  assert.equal(second.result.rows.lookups_asked, 1);
  assert.match(second.report.activity.find(a => a.line.startsWith('Addresses for held'))?.line ?? '', /1 looked up this run .* 4 already asked and waiting/);
  // A synthetic run asks the desk for nothing.
  const synthetic = pitchRows({ context: heldContext(), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  assert.ok(synthetic.lookups.requests.length > 0, 'pure: the requests are built either way; only a live run with the research feature sends them');
});
