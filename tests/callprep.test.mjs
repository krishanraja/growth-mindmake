import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuyer } from '../src/stages/canon.mjs';
import { londonDate, addDays } from '../src/dispatch.mjs';
import {
  callPreps, prepFor, personFacts, companyFacts, touchFacts, pipelineFacts, mirrorFact, testKit, discoveryQuestions,
  meetingsTomorrow, callPrepLine, prepText, takesCallPrep, BASES, TEST_KIT, QUESTIONS_MAX
} from '../src/stages/callprep.mjs';

// GET-GOING 1.7, call prep: for every booked meeting, the day before, each fact
// said, inferred or missing, discovery questions, and the test kit for a first
// call. Synthetic only: invented people, companies, ids and dates.

const AT = '2026-11-16T05:10:00Z';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BUYER = parseBuyer({ canon: '## Who buys\n\n**Buyer groups.** Founder. CEO. CRO, or whoever owns revenue. Strategy leader.\n\n**The gate.** The person must own, or be able to move, the decision.\n' });
const cal = { londonDate, addDays };

const person = (n, extra = {}) => ({
  contact_id: id(n), network_tier: '3_known_network', current_title: 'CEO', current_company: `Example Co ${n}`, mindmake_fit: 72,
  who: 'Runs a mid-size media business.', sells_competing_services: false,
  contacts: { full_name: `Robin Sample${n}`, company_domain: `example${n}.test` },
  facts: [
    { kind: 'role', text: `CEO at Example Co ${n}`, source_url: null, observed_at: '2026-09-01T00:00:00Z' },
    { kind: 'post', text: 'Our sales team spends a day a week on reports nobody reads.', source_url: 'https://posts.example/1', observed_at: '2026-10-01T00:00:00Z' },
    { kind: 'email', text: 'Three emails each way, the last in June 2026.', source_url: null, observed_at: '2026-06-01T00:00:00Z' },
  ],
  ...extra,
});
const meeting = (n, extra = {}) => ({ meeting_id: `m-${n}`, starts_at: '2026-11-17T15:00:00Z', contact_id: id(n), contact_ids: [id(n)], organizer: 'them', first_meeting: true, ...extra });

function context(extra = {}) {
  return {
    network: [person(1)],
    companies: [{ domain: 'example1.test', kind: 'publisher' }],
    research: [{ request_id: 'company:example1.test', kind: 'company_read', status: 'answered', query: 'https://example1.test', answer: 'Publishes trade magazines for retailers.' }],
    records: { drafts: [{ contact_id: id(1), job: 'morning', sent_at: '2026-11-02T09:00:00Z', replied_at: '2026-11-03T10:00:00Z' }], deals: [{ contact_id: id(1), stage: 'Meeting to lock', next_date: '2026-11-17' }], stale_deals: [] },
    meetings: [],
    feedback: [],
    upcoming_meetings: [meeting(1), meeting(2, { starts_at: '2026-11-20T15:00:00Z' })],
    coverage: [{ source: 'upcoming_meetings', available: true, complete: true }],
    ...extra,
  };
}

const labelled = (facts, label) => facts.find(f => f.label === label);

test('the prep is made the day before: only the meetings that start tomorrow, London time', () => {
  const ctx = context({ upcoming_meetings: [meeting(1), meeting(3, { starts_at: '2026-11-16T20:00:00Z' }), meeting(4, { starts_at: '2026-11-18T00:30:00Z' }), meeting(5, { contact_id: 'not-an-id' })] });
  assert.deepEqual(meetingsTomorrow(ctx, AT, cal).map(m => m.meeting_id), ['m-1']);
  // 23:30 UTC on the 17th is past midnight in London only in summer; in November it is still the 17th.
  assert.deepEqual(meetingsTomorrow({ upcoming_meetings: [meeting(6, { starts_at: '2026-11-17T23:30:00Z' })] }, AT, cal).map(m => m.meeting_id), ['m-6']);
});

test('every fact is said, inferred or missing, by where it comes from', () => {
  const p = prepFor(meeting(1), { context: context(), buyer: BUYER });
  for (const f of p.facts) assert.ok(BASES.includes(f.basis), f.label);
  assert.equal(labelled(p.facts, 'Name').basis, 'said');
  assert.equal(labelled(p.facts, 'Role').basis, 'said', 'a dated profile read is a fact');
  assert.equal(labelled(p.facts, 'Buyer group').basis, 'inferred');
  assert.match(labelled(p.facts, 'Buyer group').text, /reads as CEO, a buyer group in the canon/);
  assert.equal(labelled(p.facts, 'Mindmake fit').basis, 'inferred', 'a score is a reading, not a fact');
  assert.equal(labelled(p.facts, 'Who, as written').basis, 'inferred', 'prose a model wrote is never said');
  assert.equal(labelled(p.facts, 'Their words').basis, 'said');
  assert.equal(labelled(p.facts, 'Company').basis, 'said');
  assert.equal(labelled(p.facts, 'What the company does').text, 'Publishes trade magazines for retailers.');
  assert.equal(labelled(p.facts, 'The mirror').basis, 'missing', 'the mirror lives in Control Center, never on this record');
  assert.equal(labelled(p.facts, 'A draft').text, 'morning draft: sent 2026-11-02, replied 2026-11-03.');
  assert.equal(labelled(p.facts, 'First meeting').basis, 'said');
  assert.equal(labelled(p.facts, 'Open deal').text, 'stage Meeting to lock, next step due 2026-11-17');
});

test('what the record cannot say is missing, never filled in', () => {
  const bare = person(7, { current_title: 'Head of Things', facts: [], mindmake_fit: null, who: null, contacts: { full_name: null } });
  const facts = personFacts(bare, BUYER);
  assert.equal(labelled(facts, 'Name').basis, 'missing');
  assert.equal(labelled(facts, 'Role').basis, 'inferred', 'an undated title is a reading, not a fact');
  assert.equal(labelled(facts, 'Buyer group').text, "Their title is in none of the canon's buyer groups.");
  assert.equal(labelled(facts, 'Mindmake fit').basis, 'missing');
  assert.equal(labelled(facts, 'Their words').basis, 'missing');
  assert.equal(labelled(personFacts(person(8, { facts: [], current_title: null, contacts: {} }), null), 'Buyer group').basis, 'missing', 'no title or no canon: missing');
  assert.equal(labelled(companyFacts(person(9, { current_company: null, contacts: {} }), {}), 'Company').basis, 'missing');
  assert.equal(touchFacts(null, {}, id(9), { first_meeting: null })[0].basis, 'missing');
  assert.equal(pipelineFacts({ records: { deals: [] } }, id(9))[0].source, 'no deal in his Pipeline');
  assert.equal(pipelineFacts({ records: {} }, id(9))[0].source, 'records.deals not served');
  assert.equal(mirrorFact().basis, 'missing');
  // A person Control Center does not serve at all is said so, whole.
  const none = prepFor(meeting(99), { context: context(), buyer: BUYER });
  assert.equal(labelled(none.facts, 'Person row').basis, 'missing');
});

test('the discovery questions come from what is missing and from their own record, never more than five', () => {
  const facts = [
    { about: 'person', label: 'Role', text: null, basis: 'missing' },
    { about: 'company', label: 'What the company does', text: null, basis: 'missing' },
    { about: 'pipeline', label: 'The Pipeline', text: null, basis: 'missing' },
    { about: 'person', label: 'Their words', text: 'AI should write the first draft.', basis: 'said' },
  ];
  const q = discoveryQuestions(facts);
  assert.deepEqual(q.map(x => x.from), ['missing: Role', 'missing: What the company does', 'missing: The Pipeline', 'said: their words']);
  assert.match(q[3].text, /^You wrote "AI should write the first draft\."/);
  const many = ['Role', 'Buyer group', 'Company', 'What the company does', 'The Pipeline', 'Prior touches'].map(label => ({ about: 'person', label, text: null, basis: 'missing' }));
  assert.equal(discoveryQuestions(many).length, QUESTIONS_MAX);
});

test('the test kit asks the cost, what they do today and what a yes needs, each drawn from their record', () => {
  const p = prepFor(meeting(1), { context: context(), buyer: BUYER });
  assert.deepEqual(p.test_kit.map(q => q.kit), [...TEST_KIT]);
  assert.match(p.test_kit[0].text, /^What does the problem in your own words \("Our sales team spends a day a week on reports nobody reads\."\) cost you today/);
  assert.equal(p.test_kit[0].from, 'said: their words');
  assert.equal(p.test_kit[1].text, 'What do you do about it today at Example Co 1, and who does that work?');
  assert.equal(p.test_kit[2].text, 'As CEO, could you say yes to this yourself? If not, who signs, by when, and what would they need to see first?');
  // With less on record, each question falls back to the next thing on it, and says so.
  const thin = testKit([{ about: 'person', label: 'Role', text: 'Head of Things', basis: 'inferred' }, { about: 'person', label: 'Buyer group', text: "Their title is in none of the canon's buyer groups.", basis: 'inferred' }]);
  assert.match(thin[0].text, /your work as Head of Things/);
  assert.equal(thin[0].from, 'inferred: role');
  assert.equal(thin[1].text, 'What do you do about it today as Head of Things, and who does that work?');
  assert.equal(thin[2].from, 'missing: no buyer group on their record');
  const empty = testKit([]);
  assert.ok(empty.every(q => q.from.startsWith('missing') || q.kit === 'yes'));
  // A meeting known not to be a first one gets no test kit.
  assert.deepEqual(prepFor(meeting(1, { first_meeting: false }), { context: context(), buyer: BUYER }).test_kit, []);
});

test('it is made only where Control Center serves the meetings ahead, and says when they were not read', () => {
  assert.deepEqual(callPreps({ context: context(), features: {}, at: AT, ...cal }), { served: false, preps: [] });
  const unread = callPreps({ context: context({ upcoming_meetings: null, coverage: [{ source: 'upcoming_meetings', available: false, reason: 'upcoming_stale' }] }), features: { upcoming_meetings: true }, at: AT, ...cal });
  assert.equal(callPrepLine(unread), 'Call prep: the meetings ahead were not read this run (upcoming_stale), so no prep was made.');
  assert.equal(callPrepLine(callPreps({ context: context({ upcoming_meetings: [] }), features: { upcoming_meetings: true }, at: AT, ...cal })), 'Call prep: no booked meeting tomorrow with someone Control Center holds.');
  assert.equal(callPrepLine(null), null);
});

test('the report line counts, and never carries a name, a company or a word of anyone\'s record', () => {
  const r = callPreps({ context: context(), features: { upcoming_meetings: true }, buyer: BUYER, at: AT, ...cal });
  assert.equal(r.preps.length, 1);
  const line = callPrepLine(r, takesCallPrep({ features: {} }));
  assert.match(line, /^Call prep: 1 booked meeting tomorrow \(1 a first meeting\); \d+ facts said, \d+ inferred and \d+ missing, \d discovery questions? and 3 test-kit questions\. Control Center takes no call prep yet/);
  assert.equal(/Robin|Example|Sample|reports nobody|trade magazines/.test(line), false);
  assert.match(callPrepLine(r, takesCallPrep({ features: { call_prep: true } })), /this engine sends none yet/);
  // The whole prep reads as one plain page for whoever reads it.
  const page = prepText(r.preps[0]);
  assert.match(page, /\[said\] Name: Robin Sample1/);
  assert.match(page, /\[missing\] The mirror: not on record \(Make the mirror on their card in Control Center before the call\)/);
  assert.match(page, /The test kit, does the offer fit:/);
});
