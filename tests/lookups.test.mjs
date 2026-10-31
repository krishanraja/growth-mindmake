import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { pitchRows, lookupId, lookupRequests, lookupState, LOOKUPS_PER_RUN, LOOKUP_WORDINGS } from '../src/stages/pitches.mjs';
import { runDispatch, searchesLeft, withinSearches, SEARCHES_PER_DAY } from '../src/dispatch.mjs';
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

const DAY_ID = /^(?:booking|email):(?:guest:)?[0-9a-f-]{36}:2026-10-27:[0-9a-f]{8}$/;

test('every attempt has its own id, never asked again while one waits or found a route, a found-nothing answer asked again in the next wording, and at most once a London day', () => {
  const first = lookupId('booking:x', [], AT, 'where does x take pitches');
  assert.match(first, /^booking:x:2026-10-27:[0-9a-f]{8}$/, 'the subject, the London day and the words');
  assert.equal(lookupId('booking:x', [], AT, 'where does x take pitches'), first, 'the same words on the same day are the same id, which the desk replays');
  assert.notEqual(lookupId('booking:x', [], AT, 'where does the renamed x take pitches'), first, 'other words are another id, never the same id the desk would refuse with a 409');
  assert.match(lookupId('booking:x', [{ request_id: 'booking:x:2026-10-20:abcdef01', status: 'answered', evidence: [] }], AT, 'q2'), /^booking:x:2026-10-27:/, 'answered with nothing usable: asked again, in the next wording, on a later day');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10-20:abcdef01' }], AT), null, 'asked with no answer yet: waiting');
  assert.match(lookupId('booking:x', [{ request_id: 'booking:x:2026-10-20:abcdef01', status: 'empty' }], AT, 'q2'), /^booking:x:2026-10-27:/, 'nothing found: asked again in other words');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10-27:abcdef01', status: 'empty' }], AT, 'q2'), null, 'but never twice a London day');
  const three = ['2026-10-20', '2026-10-21', '2026-10-22'].map(d => ({ request_id: `booking:x:${d}:abcdef01`, status: 'empty' }));
  assert.equal(lookupState('booking:x', three).state, 'exhausted');
  assert.equal(lookupId('booking:x', three, AT, 'q4'), null, `every one of the ${LOOKUP_WORDINGS} wordings answered with nothing: not asked again while the context holds them`);
  assert.match(lookupId('booking:x', [{ request_id: 'booking:x:2026-10-26:abcdef01', status: 'over_cap' }], AT, 'q'), /^booking:x:2026-10-27:/, 'over the cap: a new id the next day, as the desk requires');
  assert.equal(lookupId('booking:x', [{ request_id: 'booking:x:2026-10-26:abcdef01', status: 'over_cap' }, { request_id: 'booking:x:2026-10-27:12345678', status: 'failed' }], AT, 'q'), null, 'once a day');
  assert.match(lookupId('booking:x', [{ request_id: 'booking:xy:2026-10-20:abcdef01', status: 'answered' }], AT, 'q'), /^booking:x:2026-10-27:/, 'another subject is not this one');
});

test('a held stage, show and guest each file a bounded lookup, taking turns, and nothing held for another reason does', () => {
  const r = pitchRows({ context: heldContext(), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  const { requests, waiting, eligible, by } = r.lookups;
  assert.equal(LOOKUPS_PER_RUN, 12, 'twelve a run since 2026-10-31 (Ruling, Krish: "Raise the daily lookup")');
  assert.equal(requests.length, 5, 'every eligible subject, inside the twelve');
  assert.equal(eligible, 5, 'two summits, one show, two guests: the late summit and the buried show are held for their own reasons');
  assert.equal(waiting, 0);
  assert.deepEqual(requests.map(q => q.subject_ref), [`target:${id(601)}`, `target:${id(401)}`, `contact:${id(801)}`, `target:${id(602)}`, null], 'round robin: a stage, a show, a guest, then the next stage and the next guest');
  assert.deepEqual(by, { stages: 2, podcasts: 1, guests: 2 });
  assert.deepEqual(requests.map(q => q.request_id.split(':').slice(0, -2).join(':')), [`booking:${id(601)}`, `booking:${id(401)}`, `email:${id(801)}`, `booking:${id(602)}`, `email:guest:${id(902)}`]);
  // Bounded: twenty held stages file twelve, and a smaller cap still takes turns.
  const many = Array.from({ length: 20 }, (_, i) => ({ lane: 'stage', key: `s${String(i).padStart(2, '0')}`, base: `booking:s${i}`, score: 1, subject_ref: null, query: `q${i}`, why: 'w' }));
  assert.equal(lookupRequests({ stages: many, at: AT }).requests.length, LOOKUPS_PER_RUN, 'at most twelve a run');
  assert.equal(lookupRequests({ stages: many, at: AT, max: 4 }).requests.length, 4);
  for (const q of requests) assert.match(q.request_id, DAY_ID);
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
  assert.deepEqual(more.requests.map(q => [q.request_id, q.subject_ref]), [[lookupId(`email:guest:${id(902)}`, [], AT, 'q'), null]]);
  assert.match(more.requests[0].request_id, new RegExp(`^email:guest:${id(902)}:2026-10-27:[0-9a-f]{8}$`));
});

test('a lookup already asked is not asked again while it waits, and is counted as waiting', () => {
  const asked = [`booking:${id(601)}`, `booking:${id(401)}`, `email:${id(801)}`].map(base => ({ request_id: `${base}:2026-10-20:abcdef01`, kind: 'search', requested_at: '2026-10-20T05:10:00Z' }));
  const r = pitchRows({ context: heldContext({ research: asked }), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  assert.equal(r.lookups.waiting, 3);
  assert.deepEqual(r.lookups.requests.map(q => q.request_id.split(':').slice(0, -2).join(':')), [`booking:${id(602)}`, `email:guest:${id(902)}`], 'only the two never asked');
  assert.equal(r.lookups.requests.some(q => asked.some(a => a.request_id === q.request_id)), false);
});

test('a lookup that has left the context, with the show renamed since, is asked as a new lookup under a new id, never the old id with other words', () => {
  // Run one asks on 5 October. By the 27th its rows are past Control Center's 14 days, in the same month, and the show's title has changed.
  const one = pitchRows({ context: heldContext(), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: '2026-10-05T06:00:00Z' }).lookups.requests;
  assert.ok(one.some(q => q.subject_ref === `target:${id(401)}`), 'run one asked about the show');
  const c = heldContext();
  c.records.visibility.find(t => t.id === id(401)).title = 'The Renamed Show';
  const two = pitchRows({ context: c, weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT }).lookups;
  assert.equal(two.waiting, 0, 'nothing in the context: not counted as waiting');
  const show = two.requests.find(q => q.subject_ref === `target:${id(401)}`);
  assert.ok(show, 'the show is asked again');
  assert.match(show.query, /The Renamed Show/);
  assert.match(show.request_id, new RegExp(`^booking:${id(401)}:2026-10-27:[0-9a-f]{8}$`));
  assert.equal(two.requests.some(q => one.some(o => o.request_id === q.request_id)), false, 'no id from run one is sent again, so the desk neither replays it nor refuses the batch');
  // The same words on the same day are the same id, which the desk replays; the old words are another id.
  const renamedAgain = pitchRows({ context: c, weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT }).lookups.requests.find(q => q.subject_ref === `target:${id(401)}`);
  assert.equal(renamedAgain.request_id, show.request_id);
  const oldWords = pitchRows({ context: heldContext(), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT }).lookups.requests.find(q => q.subject_ref === `target:${id(401)}`);
  assert.notEqual(oldWords.request_id, show.request_id);
});

test('a title the desk would read as a phone number loses its digits, and the lookup is still asked', () => {
  const c = heldContext();
  c.records.visibility.find(t => t.id === id(601)).title = 'Future Summit 2026 10-11 12 London';
  const r = pitchRows({ context: c, weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT }).lookups.requests;
  const stage = r.find(q => q.subject_ref === `target:${id(601)}`);
  assert.ok(stage, 'still asked');
  assert.match(stage.query, /Future Summit/);
  for (const q of r) for (const text of [q.query, q.why]) assert.equal((text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []).some(run => (run.match(/\d/g) ?? []).length >= 9), false, 'no run of nine digits reaches the desk');
  // A query built some other way that still carries one is left out on its own; the rest go.
  const kept = lookupRequests({ stages: [{ lane: 'stage', key: 'a', base: 'booking:a', score: 2, subject_ref: null, query: 'call 020 7946 0958 for it', why: 'w' }, { lane: 'stage', key: 'b', base: 'booking:b', score: 1, subject_ref: null, query: 'q', why: 'w' }], at: AT });
  assert.deepEqual(kept.requests.map(q => q.request_id.split(':')[1]), ['b']);
});

test('a live dispatch run asks the desk for the lookups first in its round, counts them, and keeps every hold', async () => {
  const run = async (research, { fail = false } = {}) => {
    const reports = [], batches = [];
    const cc = {
      recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, network_routes: true } }),
      context: async () => ({ ok: true, context: heldContext({ research }) }),
      research: async requests => { batches.push(requests); if (fail) throw Error('desk down'); return requests.map(q => ({ ...q, status: 'empty', evidence: [], answer: null, requested_at: AT, answered_at: AT })); },
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1)
    };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-lookups-1234', clock: () => AT,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
    return { result, report: reports[0], batches };
  };
  const first = await run([]);
  assert.equal(first.result.status, 'succeeded');
  assert.ok(first.batches.every(b => b.length >= 1 && b.length <= 10), 'each call inside the desk\'s ten');
  assert.deepEqual(first.batches[0].slice(0, 5).map(q => q.request_id.split(':')[0]), ['booking', 'booking', 'email', 'booking', 'email'], 'the lookups lead the first round');
  assert.equal(first.result.rows.lookups_asked, 5);
  assert.ok(first.result.rows.research_asked >= 5);
  // The desk answered all five with nothing this run: each is read in the same run and held as found nothing, never as waiting.
  assert.ok(first.report.holds.some(h => h.reason === 'speak_lookup_found_nothing') && first.report.holds.some(h => h.reason === 'invite_lookup_found_nothing'), 'an answered lookup leaves its own hold');
  assert.equal(first.report.holds.some(h => h.reason === 'invite_no_contact'), false, 'inside the twelve every held guest was asked, so none is left on its plain code');
  assert.equal(first.result.rows.lookups_found_nothing, 5);
  const line = first.report.activity.find(a => a.line.startsWith('Addresses for held pitches and invites'))?.line;
  assert.match(line, /^Addresses for held pitches and invites: 5 looked up this run \(2 stages, 1 podcast, 2 guests\), 0 asked and waiting for an answer; answered: 0 with an address on the subject's own site, 0 with its own form page, 5 with nothing usable/);
  assert.match(line, /still needs his yes, and the network rule decides whose box it goes in/);
  assert.deepEqual(violations(schema, first.report), []);
  // The next run reads those lookups back in its context: none is asked again, and the one never asked is.
  const second = await run(first.batches[0].slice(0, 4).map(q => ({ ...q, status: 'empty', requested_at: AT })));
  const again = second.batches.flat().filter(q => /^(?:booking|email):/.test(q.request_id));
  assert.equal(again.some(q => first.batches[0].slice(0, 4).some(f => f.request_id === q.request_id)), false, 'a pending or answered lookup is not asked again');
  assert.equal(second.result.rows.lookups_asked, 1);
  assert.match(second.report.activity.find(a => a.line.startsWith('Addresses for held'))?.line ?? '', /1 looked up this run \(1 guest\), 0 asked and waiting for an answer; answered: 0 with an address on the subject's own site, 0 with its own form page, 5 with nothing usable/, 'answered lookups are never counted as waiting');
  // A round the desk could not run sends nothing: the line counts none and names no kinds.
  const down = await run(first.batches[0].slice(0, 3).map(q => ({ ...q, status: 'empty', requested_at: AT })), { fail: true });
  assert.equal(down.result.rows.lookups_asked, 0);
  assert.ok(down.report.holds.some(h => h.reason === 'research_unavailable'));
  assert.match(down.report.activity.find(a => a.line.startsWith('Addresses for held'))?.line ?? '', /^Addresses for held pitches and invites: 0 looked up this run, 0 asked and waiting for an answer; answered: 0 with an address on the subject's own site, 0 with its own form page, 3 with nothing usable/);
  // A synthetic run asks the desk for nothing.
  const synthetic = pitchRows({ context: heldContext(), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  assert.ok(synthetic.lookups.requests.length > 0, 'pure: the requests are built either way; only a live run with the research feature sends them');
});

test('twelve lookups fit the first round: sent ten a call, the lookups first, every one counted', async () => {
  const c = heldContext();
  const summit = c.records.visibility.find(t => t.id === id(601));
  // Ten more invented summits held only for want of an address: fifteen eligible, twelve asked.
  for (let n = 0; n < 10; n++) c.records.visibility.push({ ...summit, id: id(700 + n), title: `Invented Summit ${String.fromCharCode(65 + n)}`, event_url: `https://summit${n}.example/`, cfp_url: null, form_fields: null });
  const reports = [], batches = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, network_routes: true } }),
    context: async () => ({ ok: true, context: c }),
    research: async requests => { batches.push(requests); return requests.map(q => ({ ...q, status: 'empty', evidence: [], answer: null, requested_at: AT, answered_at: AT })); },
    decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1)
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-lookups-twelve', clock: () => AT,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
  assert.equal(result.status, 'succeeded');
  assert.ok(batches.length >= 2 && batches.every(b => b.length >= 1 && b.length <= 10), 'no call carries more than the desk takes');
  const sent = batches.flat().filter(q => /^(?:booking|email):/.test(q.request_id));
  assert.equal(sent.length, LOOKUPS_PER_RUN);
  assert.deepEqual(batches[0].map(q => q.request_id.split(':')[0]).every(k => k === 'booking' || k === 'email'), true, 'the first call is all lookups');
  assert.equal(result.rows.lookups_asked, LOOKUPS_PER_RUN);
});

test('the round keeps inside the desk\'s daily searches: lookups take at most half of what is left, and nothing past the cap is sent', () => {
  const asked = n => Array.from({ length: n }, (_, i) => ({ request_id: `x:${i}`, kind: 'search', status: 'answered', requested_at: AT }));
  assert.equal(searchesLeft({ capabilities: {}, research: [], at: AT }), SEARCHES_PER_DAY, 'forty a day when the capabilities do not say');
  assert.equal(searchesLeft({ capabilities: { research: { per_day: { search: 40 } } }, research: asked(30), at: AT }), 10);
  assert.equal(searchesLeft({ capabilities: {}, research: [...asked(5), { request_id: 'y', kind: 'search', status: 'over_cap', requested_at: AT }, { request_id: 'z', kind: 'question', requested_at: AT }], at: AT }), 35, 'a refused search and a question do not count');
  assert.equal(searchesLeft({ capabilities: {}, research: [{ request_id: 'old', kind: 'search', status: 'answered', requested_at: '2026-10-20T09:00:00Z' }], at: AT }), 40, "another day's search does not count");
  assert.equal(searchesLeft({ capabilities: {}, research: asked(45), at: AT }), 0);
  const look = Array.from({ length: 12 }, (_, i) => ({ request_id: `booking:${i}`, kind: 'search' }));
  const other = Array.from({ length: 6 }, (_, i) => ({ request_id: `src:${i}`, kind: 'search' }));
  const posts = { request_id: 'p', kind: 'posts' };
  const ids = new Set(look.map(r => r.request_id));
  const first = withinSearches([...look, ...other, posts], ids, 40);
  assert.equal(first.filter(r => ids.has(r.request_id)).length, 12, 'a fresh day sends all twelve');
  const late = withinSearches([...look, ...other, posts], ids, 10);
  assert.equal(late.filter(r => ids.has(r.request_id)).length, 5, 'late in the day the lookups take half of what is left');
  assert.equal(late.filter(r => r.kind === 'search').length, 10, 'the rest goes to sourcing and reach');
  assert.ok(late.includes(posts), 'other kinds keep their place');
  assert.deepEqual(withinSearches([...look, posts], ids, 0), [posts], 'none left: no search is sent');
});
