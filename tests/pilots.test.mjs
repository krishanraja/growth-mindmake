import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuyer, parseOffer, canonBuyerTitle, offerFindings } from '../src/stages/canon.mjs';
import { triggerFromIntent, triggerFromResearch, triggerKinds, isHunterCard, mondayBatch, dropSelfReference, whyFace, askKindOf, collaboratorsLast, canonSector, pilotBrief, pilotsShadow, firstSentence, plainCopy,
  MONDAY_BATCH, PIPELINE_ASK_KINDS, SEED_TIERS, NO_TRIGGER_LINE } from '../src/stages/pilots.mjs';
import { NORTH_STAR, CANON, canon, AT, id, daysAgo, CC_DOOR, CC_MINDMAKE_ANGLE, CC_INDUSTRY } from './support/section12.mjs';

// The pilot machine, ported from Control Center (plan section 12, M6).
// Every person, company and id below is invented.
//
// Parity table (Control Center source or test: engine test):
//   tests/api/pilotDealsHunter.test.ts, a hunter card by its notes tag:        the same (isHunterCard)
//   tests/api/pilotDealsHunter.test.ts, his own rows, no notes, are not:      the same
//   tests/api/pilotDealsHunter.test.ts, the filter keeps rows with no notes:  the same, in mondayBatch (no query)
//   tests/api/pilotDealsHunter.test.ts, Monday filters hunter cards:          the same, in mondayBatch
//   api/pilot-deals/monday.ts, five, freshest trigger, then longest listed:   the same (mondayBatch)
//   api/_pilotDeals.ts findTrigger on a stored quote (run against Control
//     Center's code with the network off, 27 Oct): 10 and 89 days a trigger,
//     91 days, no source, no sentence and no date none, a dash a comma:       the same (triggerFromIntent)
//   api/_pilotDeals.ts findTrigger on research (read from its code):          the same, but a lead outside 40 to 240 characters
//                                                                              is needs_compression: the model call stays in Control Center
//   api/pilot-deals/seed.ts whyFace, dropSelfReference, collaboratorsLast,
//     the classifier's fallback to intro, TIERS:                               the same
//   api/pilot-deals/seed.ts INDUSTRY:                                         replaced by the canon's sectors (differences below)
//   api/_mission.ts FACE and DOOR:                                            replaced by the canon's buyer and offer; DOOR fails offerFindings
//   src/lib/surfaceMoves.ts PILOT_PLAN_ASKS (tests/api/surfaceMoves.test.ts,
//     "6 of the 25 asks the plan needs"):                                      not ported: the number is docs/NORTH_STAR.md's
//   tests/api/pilotListeners.test.ts, the mission block and Full Time's job:  left in Control Center (its prompts and job model)

test('the buyer is read from the canon: its groups, who it is for, the gate, the moments, and its two kinds of sector', () => {
  const b = parseBuyer({ northStar: NORTH_STAR, canon: CANON });
  assert.deepEqual(b.groups.map(g => g.label), ['Founder', 'CEO', 'CRO, or whoever owns revenue', 'Strategy leader', 'founder', 'principal', 'portfolio owner', 'senior commercial leader']);
  assert.deepEqual(b.groups[2].alternatives, [['cro'], ['revenue']]);
  assert.equal(b.gate, 'The person must own, or be able to move, the decision.');
  assert.equal(b.moments.length, 3);
  assert.equal(b.moments[2], 'The leader knows something is wrong but cannot yet name the real problem.', 'a bullet carried onto a second line is read whole');
  assert.deepEqual(b.sectors, { public: ['media', 'adtech', 'data'], internal: ['media', 'data', 'publishing', 'coaching'] });
  assert.equal(parseBuyer({ northStar: '# North Star\n', canon: '# Canon\n' }), null, 'a canon without a buyer reads null, never a default');
  assert.equal(canon.buyer.groups.length, 8, 'parseCanon carries it');
});

test('a title is a buyer when every word of one alternative is in it; the long form of a short title counts', () => {
  const b = canon.buyer;
  const cases = [['Co-founder', true], ['Chief Executive Officer', true], ['VP Revenue', true], ['Head of Strategy', true], ['Principal', true], ['Portfolio Owner', true], ['Portfolio Analyst', false], ['Software Engineer', false], ['Managing Partner', false]];
  for (const [title, want] of cases) assert.equal(canonBuyerTitle(title, b), want, title);
  assert.equal(canonBuyerTitle('', b), null);
  assert.equal(canonBuyerTitle('Founder', null), null, 'no buyer read, no verdict');
});

test("Control Center's seed sectors against the canon's: three it names, three it does not, four it misses", () => {
  const b = canon.buyer;
  assert.deepEqual(CC_INDUSTRY.map(w => [w, canonSector(w, b)]), [['media', 'public'], ['advertising', false], ['adtech', 'public'], ['publishing', 'internal'], ['broadcast', false], ['data', 'public'], ['martech', false]]);
  assert.deepEqual(b.sectors.internal.filter(w => !CC_INDUSTRY.includes(w)), ['coaching'], 'in this synthetic canon; the live canon also names creative, content and consulting');
});

test("the offer is the canon's: its noun, its one public length and where, a private price and the retired offers", () => {
  const o = parseOffer({ northStar: NORTH_STAR, canon: CANON });
  assert.deepEqual(o, { noun: 'paid proof', public_days: 30, price_private: true, retired: ['Example Audit', 'Example Handover', '14-day Sprint'], revenue_line: 'their example pricing and team rebuilt for AI, then tested with real buyers.' });
  assert.equal(parseOffer({ northStar: '', canon: CANON }), null);
});

test("Control Center's DOOR and Mindmake angle say what the canon does not; a line in the canon's own terms passes", () => {
  assert.deepEqual(offerFindings(CC_DOOR, canon.offer), ['duration_promise', 'price_terms', 'offer_named_otherwise']);
  assert.deepEqual(offerFindings(CC_MINDMAKE_ANGLE, canon.offer), ['retired_offer', 'duration_promise', 'offer_named_otherwise']);
  assert.deepEqual(offerFindings('It starts with one paid proof: one decision, built as a working first version.', canon.offer), []);
  assert.deepEqual(offerFindings('Krish could show you the CTRL pilot in person.', canon.offer), [], "the canon's own pilot is a CTRL pilot conversation");
  assert.deepEqual(offerFindings('Worth a short call next week?', canon.offer), [], 'a note that names no offer says nothing wrong about it');
  assert.deepEqual(offerFindings(CC_DOOR, null), [], 'no offer read, nothing to check against');
});

test('a stored quote is a trigger only with its sentence, an http source and a date inside 90 days of the run (Control Center\'s answers)', () => {
  const q = { intent_evidence: 'We are rebuilding our pricing for AI this quarter.', intent_evidence_url: 'https://example.org/post/1' };
  assert.deepEqual(triggerFromIntent({ ...q, last_post_at: daysAgo(10) }, AT), { signal: q.intent_evidence, url: q.intent_evidence_url, found_at: daysAgo(10) });
  assert.ok(triggerFromIntent({ ...q, last_post_at: daysAgo(89) }, AT));
  assert.equal(triggerFromIntent({ ...q, last_post_at: daysAgo(91) }, AT), null);
  assert.equal(triggerFromIntent({ ...q, intent_evidence_url: 'not a link', last_post_at: daysAgo(10) }, AT), null);
  assert.equal(triggerFromIntent({ ...q, intent_evidence: '   ', last_post_at: daysAgo(10) }, AT), null);
  assert.equal(triggerFromIntent({ ...q, last_post_at: null }, AT), null);
  assert.equal(triggerFromIntent({ intent_evidence: 'We are rebuilding pricing \u2014 for AI.', intent_evidence_url: 'http://example.org/post/6', last_post_at: daysAgo(5) }, AT).signal, 'We are rebuilding pricing, for AI.');
});

test('a research answer is cited or silent, led by one sentence; a lead that needs a model stays in Control Center', () => {
  const sources = ['https://example.org/a', 'https://example.org/b'];
  assert.deepEqual(triggerFromResearch({ text: 'In October Example Works rebuilt its pricing around AI agents [2]. More notes follow.', sources }, AT),
    { trigger: { signal: 'In October Example Works rebuilt its pricing around AI agents .', url: 'https://example.org/b', found_at: AT }, code: null }, 'the [2] mark picks the second source, and its space stays, as in Control Center');
  assert.equal(triggerFromResearch({ text: 'Nothing found in the last 60 days.', sources }, AT).code, 'nothing_found');
  assert.equal(triggerFromResearch({ text: 'In October Example Works rebuilt its pricing.', sources: ['ftp://x'] }, AT).code, 'no_source');
  assert.equal(triggerFromResearch({ text: `${'A very long lead about the business without a stop '.repeat(6)}.`, sources }, AT).code, 'needs_compression');
  assert.equal(firstSentence('## [1] One fact. Two.'), 'One fact.');
  assert.equal(plainCopy('a \u2013 b'), 'a, b');
});

test("what makes now the time to write is the canon's moments; Control Center's research kinds mostly are not among them", () => {
  assert.deepEqual(triggerKinds(canon.buyer), { moments: canon.buyer.moments, supported: ['ai_move'], unsupported: ['funding', 'leadership_change', 'restructuring', 'results'] });
  assert.deepEqual(triggerKinds(null).supported, []);
});

test('the Monday five: listed pipeline rows, never a hunter card, freshest trigger first, then the longest listed (Control Center\'s rule)', () => {
  assert.equal(isHunterCard('hunter door-in: Example Co. Route: x'), true);
  assert.equal(isHunterCard('  Hunter Door-In: Example.'), true);
  for (const n of ['met at the summit', '', null, undefined]) assert.equal(isHunterCard(n), false);
  const row = (n, extra = {}) => ({ id: id(n), contact_id: id(100 + n), state: 'listed', ask_kind: 'buyer', notes: null, trigger_found_at: null, listed_at: daysAgo(30 - n), ...extra });
  const rows = [row(1), row(2, { trigger_found_at: daysAgo(3) }), row(3, { trigger_found_at: daysAgo(1) }), row(4, { notes: 'hunter door-in: Example.' , trigger_found_at: daysAgo(0) }),
    row(5, { state: 'drafted' }), row(6, { ask_kind: 'podcast_pitch' }), row(7), row(8), row(9), row(10, { ask_kind: 'intro' })];
  assert.deepEqual(mondayBatch(rows).map(r => r.id), [id(3), id(2), id(1), id(7), id(8)]);
  assert.equal(mondayBatch(rows).length, MONDAY_BATCH);
  assert.deepEqual(PIPELINE_ASK_KINDS, ['buyer', 'intro', 'collaborator']);
  assert.deepEqual(SEED_TIERS, ['1_reciprocated', '2_core_network']);
});

test("the seed's rules: a judgment without his records cited, the classifier's safe fallback, collaborators last", () => {
  assert.equal(dropSelfReference('Runs a media business. Already in Krish\'s contacts.'), 'Runs a media business.');
  assert.equal(whyFace({ title: 'Founder', company: 'Example Works', why_them: 'Sold a data company \u2014 twice. Already in his contacts.' }), 'Sold a data company, twice.');
  assert.equal(whyFace({ title: 'Founder', company: 'Example Works' }), 'Founder at Example Works.');
  assert.equal(whyFace({}), 'In your network, no stored judgment yet.');
  assert.deepEqual(['buyer', 'collaborator', 'intro', 'unsure', undefined].map(askKindOf), ['buyer', 'collaborator', 'intro', 'intro', 'intro']);
  assert.deepEqual(collaboratorsLast([{ n: 1, ask_kind: 'collaborator' }, { n: 2, ask_kind: 'buyer' }, { n: 3, ask_kind: 'intro' }, { n: 4, ask_kind: 'collaborator' }]).map(p => p.n), [2, 3, 1, 4]);
});

test('the brief a pilot note is written from carries the canon\'s ask and offer, and the honest line with no trigger', () => {
  const brief = pilotBrief({ whyFace: 'Runs a data business.', trigger: null, canon });
  assert.ok(brief.includes(NO_TRIGGER_LINE));
  assert.ok(brief.some(l => l.includes('Start building your AI brain') && l.includes('https://mindmake.example.org/?start=1')));
  assert.ok(brief.some(l => l.includes('one paid proof')));
  assert.deepEqual(offerFindings(brief.join(' '), canon.offer), [], 'the brief itself passes the canon');
  assert.doesNotMatch(brief.join(' '), /coaching|publishing|will not admit/i, 'the internal wedge and the buyer psychology never enter it');
  assert.equal(pilotBrief({ whyFace: 'x', trigger: null, canon: { ...canon, offer: null } }), null);
});

test("in shadow: the canon's buyer beside Control Center's ask kind, its Monday batch and its words, in counts, nothing changed", () => {
  const net = (n, title) => ({ contact_id: id(100 + n), current_title: title, contacts: { title } });
  const context = {
    network: [net(1, 'Founder'), net(2, 'Managing Partner'), net(3, 'Head of Strategy'), net(4, 'Software Engineer')],
    work_context: { snapshot: { contacts: [{ id: id(105), title: 'Chief Executive Officer' }, { id: id(106), title: 'Role not recorded' }] } },
    records: { advisory: [
      { id: id(1), contact_id: id(101), state: 'listed', ask_kind: 'buyer', notes: null },
      { id: id(2), contact_id: id(102), state: 'drafted', ask_kind: 'buyer', draft_subject: 'A thought', draft_body: 'Would you try a paid three week pilot? Twenty minutes to talk?' },
      { id: id(3), contact_id: id(103), state: 'listed', ask_kind: 'intro', notes: null },
      { id: id(4), contact_id: id(104), state: 'sent', ask_kind: 'collaborator', draft_body: 'Good to see you last week. Worth a short call?' },
      { id: id(5), contact_id: id(105), state: 'listed', ask_kind: 'buyer', notes: 'hunter door-in: Example.' },
      { id: id(6), contact_id: id(106), state: 'listed', ask_kind: 'buyer', notes: null },
      { id: id(7), contact_id: id(107), state: 'listed', ask_kind: 'podcast_pitch' },
      { id: id(1), contact_id: id(101), state: 'listed', ask_kind: 'buyer' },
    ] },
  };
  const frozen = structuredClone(context);
  const out = pilotsShadow({ context, canon, at: AT });
  assert.equal(out.line, "Pilot machine, in shadow: 7 Advisory rows read; agrees with Control Center on 3, differs on 2 (buyer_outside_canon_groups 1, canon_buyer_asked_for_a_door 1); 2 not comparable (not_a_pipeline_row 1, title_not_served 1). Monday: 3 listed for Control Center's batch of 5, in an order resting on trigger dates it does not serve; the canon reads 2 of the first 3 it would take as buyers. Words: 2 drafted notes read, 1 say only what the canon supports (duration_promise 1, offer_named_otherwise 1).");
  assert.deepEqual(context, frozen, 'the context is read, never changed');
  assert.deepEqual(out.monday, [`pilot:${id(1)}`, `pilot:${id(3)}`, `pilot:${id(6)}`]);
  assert.doesNotMatch(out.line, /0000|Founder|pilot\?|Example/, 'no id, title or word of a note in the line');
  assert.equal(out.source_revision.length, 2);
  const blind = pilotsShadow({ context, canon: null, at: AT });
  assert.match(blind.line, /buyer_not_in_canon 6/);
  assert.match(blind.line, /Words: the canon's offer was not read, so 2 drafted notes were not checked\./);
  assert.equal(pilotsShadow({ context: null, at: AT }).line, "Pilot machine, in shadow: 0 Advisory rows read; agrees with Control Center on 0, differs on 0. Monday: 0 listed for Control Center's batch of 5, in an order resting on trigger dates it does not serve; the canon reads 0 of the first 0 it would take as buyers. Words: the canon's offer was not read, so 0 drafted notes were not checked.");
});

// ── The Monday five, live (Ruling, Krish, 2026-11-13; docs/GET-GOING.md, 0.6 Warm buyers) ──
// Every person, company, link and id below is invented.

const ROUTE_OK = { email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false };
const TRIGGER = 'We are rebuilding our pricing for AI this quarter.';
const person = (n, extra = {}) => ({
  contact_id: id(100 + n), network_tier: '1_reciprocated', current_title: 'Founder', current_company: `Example Works ${n}`, mindmake_fit: 70, sells_competing_services: false,
  who: `Founder of Example Works ${n}, a media data business.`, why_them: 'Runs a media data business that sells to publishers.', facts: [],
  // Last written to three weeks ago, so not a quiet tie a catch-up would take first.
  known_since: '2019-03-01T00:00:00Z', email_last: daysAgo(21), email_inbound: 4, email_outbound: 3, source_list: ['gmail_main'],
  contacts: { full_name: `Avery Example${n}`, title: 'Founder', company: `Example Works ${n}`, company_domain: `works${n}.test`, status: 'active' }, ...extra,
});
const listed = (n, extra = {}) => ({ id: id(n), contact_id: id(100 + n), state: 'listed', ask_kind: 'buyer', notes: null, trigger_found_at: null, listed_at: daysAgo(60 - n),
  intent_evidence: TRIGGER, intent_evidence_url: `https://example.org/post/${n}`, last_post_at: daysAgo(10), ...extra });
const warmContext = ({ rows, people, research = [], feedback = [], records = {} }) => ({
  records: { advisory: rows, visibility: [], drafts: [], guests: [], ...records }, network: people, quiet_ties: [], amplifier_candidates: [],
  routes: Object.fromEntries(people.map(p => [p.contact_id, ROUTE_OK])), feedback, research,
});
// The desk writes one sentence only, the reason to write now; the rest of the note is fixed text (src/stages/openings.mjs warmNote).
const good = n => `I saw that you are rebuilding your pricing for AI this quarter at Example Works ${n}.`;
// A second note in the same run, in its own words: two notes whose one sentence differs only by a name are a template and are held.
const other = n => `I read that Example Works ${n} is rebuilding its pricing around AI agents this quarter.`;
const door = () => 'I noticed you are rebuilding your pricing for AI this quarter.';
const ASK = 'Would you like to start building your AI brain?';
const INTRO = 'Do you know one leader I should show it to?';
const BUILD = "I'm building Mindmake, AI that works the way a leader thinks.";
// The desk answers every note it is asked for with `write(n)`, keyed by the contact the request is about.
const answered = (requests, write) => requests.map(r => {
  const n = Number(r.subject_ref.slice(-3)) - 100;
  return { ...r, status: 'answered', answer: write(n), evidence: [], requested_at: AT, answered_at: AT };
});
const live = { required: true, kind: 'write' };

test("the live Monday five: who is chosen, in Monday order, by tier, the canon's buyer gate, his answers and one row a person", async () => {
  const { pilotRows } = await import('../src/stages/pilots.mjs');
  const rows = [
    listed(1), listed(2, { trigger_found_at: daysAgo(2) }), listed(3, { ask_kind: 'intro' }),
    listed(4), listed(5), listed(6), listed(7), listed(8), listed(9, { notes: 'hunter door-in: Example.' }), listed(10, { state: 'drafted' }),
    listed(1, { id: id(11), ask_kind: 'intro' }),
  ];
  const people = [person(1), person(2), person(3, { current_title: 'Software Engineer', contacts: { ...person(3).contacts, title: 'Software Engineer' } }),
    person(4, { network_tier: '3_known_network' }), person(5, { current_title: 'Software Engineer', contacts: { ...person(5).contacts, title: 'Software Engineer' } }),
    person(6, { contacts: { ...person(6).contacts, status: 'do_not_contact' } }), person(7), person(8)];
  const feedback = [{ state: 'declined', decided_at: AT, row: 'reach_out', subject_ref: `contact:${id(107)}`, reason_code: 'wrong_person' }];
  const ctx = warmContext({ rows, people, feedback });
  const first = pilotRows({ context: ctx, canon, at: AT, ...live, taken: new Set([id(108)]) });
  // Nothing written yet: each eligible person's note is asked of the desk, in Monday order.
  assert.deepEqual(first.research.map(r => r.subject_ref), [`contact:${id(102)}`, `contact:${id(101)}`, `contact:${id(103)}`], 'freshest trigger first, then the longest listed; the intro door has no buyer gate');
  assert.ok(first.research.every(r => /^open:[0-9a-f-]{36}:[0-9a-f]{12}$/.test(r.request_id) && r.kind === 'write'), 'written by the desk as a catch-up is');
  assert.deepEqual([...first.held].sort(), ['declined_person', 'not_canon_buyer', 'not_close_tier', 'not_to_be_contacted', 'note_waiting', 'note_waiting', 'note_waiting', 'on_another_row'].sort());
  // The desk answers: three REACH OUT rows, one a person, in Monday order.
  const second = pilotRows({ context: { ...ctx, research: answered(first.research, n => (n === 3 ? door(n) : good(n))) }, canon, at: AT, ...live, taken: new Set([id(108)]) });
  assert.deepEqual(second.rows.map(r => r.proposal.target), [id(102), id(101), id(103)]);
  assert.deepEqual(second.rows.map(r => r.proposal.close_condition.reference), ['reach_out:warm_ask', 'reach_out:warm_ask', 'reach_out:intro_ask']);
  // A buyer is asked the canon's one ask, an introduction the house's: fixed text, never the desk's.
  assert.deepEqual(second.rows.map(r => JSON.parse(r.proposal.exact_payload).body.split('\n\n')[1].endsWith(r.proposal.close_condition.reference === 'reach_out:intro_ask' ? `${BUILD} ${INTRO}` : `${BUILD} ${ASK}`)), [true, true, true]);
  assert.ok(second.rows[0].score > second.rows[1].score && second.rows[1].score > second.rows[2].score);
  assert.equal(new Set(second.rows.map(r => r.proposal.target)).size, second.rows.length, 'one row a person, though two Advisory rows list one of them');
  assert.equal(second.research.length, 0, 'nothing more to ask');
});

test('a buyer with no title read is held, and a canon with no buyer reads no one as a buyer', async () => {
  const { pilotRows } = await import('../src/stages/pilots.mjs');
  const ctx = warmContext({ rows: [listed(1)], people: [person(1, { current_title: null, contacts: { ...person(1).contacts, title: null } })] });
  assert.deepEqual(pilotRows({ context: ctx, canon, at: AT, ...live }).held, ['title_unknown']);
  assert.deepEqual(pilotRows({ context: warmContext({ rows: [listed(1)], people: [person(1)] }), canon: { ...canon, buyer: null }, at: AT, ...live }).held, ['buyer_not_in_canon']);
});

test('no cited trigger holds the row and files one research question a person a month; an answered one becomes the reason', async () => {
  const { pilotRows, pilotTrigger, triggerRequest } = await import('../src/stages/pilots.mjs');
  const bare = listed(1, { intent_evidence: null, intent_evidence_url: null, last_post_at: null });
  const ctx = warmContext({ rows: [bare], people: [person(1)] });
  const out = pilotRows({ context: ctx, canon, at: AT, ...live });
  assert.deepEqual(out.held, ['no_trigger']);
  // Always under the desk day's own id: a month's id, sent again once its record has left the context's research window, would be refused.
  assert.deepEqual(out.research.map(r => [r.request_id, r.kind, r.subject_ref]), [[`trigger:${id(101)}:2026-10:2026-10-27`, 'question', `contact:${id(101)}`]]);
  assert.ok(out.research[0].query.length <= 400 && /one plain sentence/.test(out.research[0].query) && /source/.test(out.research[0].query));
  assert.deepEqual(out.counts, { read: 1, rows: 0, waiting: 0, no_trigger: 1, asked: 1 });
  // Asked already this month and answered with nothing: still held, never asked again this month.
  const nothing = [{ ...out.research[0], status: 'answered', answer: 'Nothing found in the last 90 days.', evidence: [{ url: 'https://example.org/n' }], answered_at: AT }];
  const again = pilotRows({ context: { ...ctx, research: nothing }, canon, at: AT, ...live });
  assert.deepEqual([again.held, again.research], [['no_trigger'], []]);
  // The month's own id, asked on the 2nd and gone from the context's 14 days by the 18th, is never sent again: the day's id is.
  assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-11-18T09:00:00Z', research: [] }).request_id, `trigger:${id(101)}:2026-11:2026-11-18`);
  // A cited answer is the trigger, dated by when it was answered, and it ages out after 90 days.
  const found = { ...out.research[0], status: 'answered', answer: 'In October Example Works 1 rebuilt its pricing around AI agents [1]. More follows.', evidence: [{ url: 'https://example.org/news/1' }], answered_at: daysAgo(3) };
  assert.deepEqual(pilotTrigger({ row: bare, person: person(1), research: [found], at: AT }), { signal: 'In October Example Works 1 rebuilt its pricing around AI agents .', url: 'https://example.org/news/1', found_at: daysAgo(3) });
  assert.equal(pilotTrigger({ row: bare, person: person(1), research: [{ ...found, answered_at: daysAgo(91) }], at: AT }), null);
  assert.equal(pilotTrigger({ row: listed(1, { intent_evidence_url: 'http://example.org/plain' }), person: person(1), research: [], at: AT }), null, 'a source the card cannot show is no reason');
  // A dated post of theirs on record is a stored reason too.
  const post = { kind: 'post', text: 'Posted: "Our whole sales team is learning to work with AI agents this month."', source_url: 'https://example.org/p/9', observed_at: daysAgo(4) };
  assert.equal(pilotTrigger({ row: bare, person: person(1, { facts: [post] }), research: [], at: AT }).url, 'https://example.org/p/9');
  // Five a run at most.
  const many = Array.from({ length: 8 }, (_, i) => listed(i + 1, { intent_evidence: null }));
  const lots = pilotRows({ context: warmContext({ rows: many, people: many.map((_, i) => person(i + 1)) }), canon, at: AT, ...live });
  assert.equal(lots.research.filter(r => r.request_id.startsWith('trigger:')).length, 5);
  // His month is London's: a question asked at 23:30 UTC on 30 June is July's (summer time), and on 30 November November's.
  assert.match(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-06-30T23:30:00Z' }).request_id, new RegExp(`^trigger:${id(101)}:2026-07:`));
  assert.match(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-11-30T23:30:00Z' }).request_id, new RegExp(`^trigger:${id(101)}:2026-11:`));
});

test("one person's reason to write is never another's, and only a reason the card can show, the freshest, already answered, counts", async () => {
  const { pilotTrigger } = await import('../src/stages/pilots.mjs');
  const bare = n => listed(n, { intent_evidence: null, intent_evidence_url: null, last_post_at: null });
  const answer = (n, extra = {}) => ({ request_id: `trigger:${id(100 + n)}:2026-10:2026-10-20`, kind: 'question', status: 'answered', answer: `In October Example Works ${n} rebuilt its pricing around AI agents [1]. More follows.`, evidence: [{ url: `https://example.org/news/${n}` }], answered_at: daysAgo(7), ...extra });
  // Person 2's answer is no reason to write to person 1.
  assert.equal(pilotTrigger({ row: bare(1), person: person(1), research: [answer(2)], at: AT }), null);
  assert.equal(pilotTrigger({ row: bare(2), person: person(2), research: [answer(2)], at: AT }).url, 'https://example.org/news/2');
  // A profile page is no source; the freshest of two is the reason; an answer dated after the run, or one that did not run, is none.
  assert.equal(pilotTrigger({ row: listed(1, { intent_evidence_url: 'https://www.linkedin.com/in/avery-example' }), person: person(1), research: [], at: AT }), null);
  const older = listed(1, { last_post_at: daysAgo(30), intent_evidence_url: 'https://example.org/older' });
  assert.equal(pilotTrigger({ row: older, person: person(1), research: [answer(1, { request_id: `trigger:${id(101)}:2026-10:2026-10-24`, answered_at: daysAgo(3) })], at: AT }).url, 'https://example.org/news/1', 'the newer reason');
  assert.equal(pilotTrigger({ row: bare(1), person: person(1), research: [answer(1, { answered_at: daysAgo(-2) })], at: AT }), null, 'not from the future');
  assert.equal(pilotTrigger({ row: bare(1), person: person(1), research: [answer(1, { status: 'failed' })], at: AT }), null, 'a question that did not run');
  // The row's growth_context, or the person's own stored intent, is a reason by itself.
  const stored = { intent_evidence: TRIGGER, intent_evidence_url: 'https://example.org/ctx', last_post_at: daysAgo(5) };
  assert.equal(pilotTrigger({ row: { ...bare(1), growth_context: stored }, person: person(1), research: [], at: AT }).url, 'https://example.org/ctx');
  assert.equal(pilotTrigger({ row: bare(1), person: person(1, { ...stored, intent_evidence_url: 'https://example.org/own' }), research: [], at: AT }).url, 'https://example.org/own');
});

test('a trigger question the desk refused over its cap or failed is asked again the next desk day under that day\'s id; an answer, or one still out, is the month\'s', async () => {
  const { pilotRows, triggerRequest, TRIGGER_ASKS_PER_DAY } = await import('../src/stages/pilots.mjs');
  const bare = listed(1, { intent_evidence: null, intent_evidence_url: null, last_post_at: null });
  const ctx = warmContext({ rows: [bare], people: [person(1)] });
  const base = `trigger:${id(101)}:2026-10`;
  const asked = pilotRows({ context: ctx, canon, at: AT, ...live }).research[0];
  assert.equal(asked.request_id, `${base}:2026-10-27`);
  const next = new Date(Date.parse(AT) + 86400000).toISOString(), later = new Date(Date.parse(AT) + 2 * 86400000).toISOString();
  for (const status of ['over_cap', 'failed']) {
    const refused = [{ ...asked, status, answer: null, evidence: [], requested_at: AT }];
    // The same day: nothing more, so the desk's day is not spent on a question it just refused.
    assert.deepEqual(pilotRows({ context: { ...ctx, research: refused }, canon, at: AT, ...live }).research, [], `${status}, the same day`);
    // The next day: asked again under the day's id.
    const again = pilotRows({ context: { ...ctx, research: refused }, canon, at: next, ...live });
    assert.deepEqual([again.held, again.research.map(r => r.request_id), again.counts.asked], [['no_trigger'], [`${base}:${next.slice(0, 10)}`], 1], `${status}, the next day`);
    // Refused again that day: once more the day after, and never twice in one day.
    const twice = [...refused, { ...again.research[0], status: 'over_cap', answer: null, evidence: [], requested_at: next }];
    assert.deepEqual(pilotRows({ context: { ...ctx, research: twice }, canon, at: next, ...live }).research, []);
    assert.deepEqual(pilotRows({ context: { ...ctx, research: twice }, canon, at: later, ...live }).research.map(r => r.request_id), [`${base}:${later.slice(0, 10)}`]);
  }
  // The desk's cap resets at midnight UTC. In summer time a run at 23:15 UTC is the next London day but the same desk day: it waits for the reset.
  const june = `trigger:${id(101)}:2026-06`, refusedJune = [{ request_id: `${june}:2026-06-14`, status: 'over_cap', requested_at: '2026-06-14T10:00:00Z' }];
  assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-06-14T23:15:00Z', research: refusedJune }), null, 'British Summer Time, before the desk resets');
  assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-06-15T00:30:00Z', research: refusedJune }).request_id, `${june}:2026-06-15`, 'just after it resets');
  const nov = `trigger:${id(101)}:2026-11`, refusedNov = [{ request_id: `${nov}:2026-11-14`, status: 'over_cap', requested_at: '2026-11-14T10:00:00Z' }];
  assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-11-14T23:30:00Z', research: refusedNov }), null, 'Greenwich Mean Time, the same day');
  assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: '2026-11-15T00:05:00Z', research: refusedNov }).request_id, `${nov}:2026-11-15`);
  // A refusal of the month's old id with no time on it was not asked today as far as the run can tell, so today's id is asked.
  assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: AT, research: [{ request_id: base, status: 'over_cap' }] }).request_id, `${base}:2026-10-27`);
  // An answer, nothing found or empty, or a question still out, is the month's: never asked again this month.
  for (const r of [{ status: 'empty' }, { status: 'answered', answer: 'Nothing found.' }, { status: undefined }]) {
    assert.equal(triggerRequest({ id: id(101), name: 'Avery Example1', at: later, research: [{ request_id: `${base}:${next.slice(0, 10)}`, ...r }] }), null, String(r.status));
  }
  // An answer to the day's question is the trigger, read by the month's prefix.
  const found = { request_id: `${base}:${next.slice(0, 10)}`, kind: 'question', status: 'answered', answer: 'In October Example Works 1 rebuilt its pricing around AI agents [1]. More follows.', evidence: [{ url: 'https://example.org/news/1' }], answered_at: next };
  const out = pilotRows({ context: { ...ctx, research: [{ ...asked, status: 'over_cap', requested_at: AT }, found] }, canon, at: later, ...live });
  assert.deepEqual(out.held, ['note_waiting'], 'the trigger found, the note is asked for');
  // A desk day's questions are capped as well as a run's: refills never spend the desk's 40 on them.
  const bares = Array.from({ length: 3 }, (_, i) => listed(i + 1, { intent_evidence: null, intent_evidence_url: null, last_post_at: null }));
  const three = warmContext({ rows: bares, people: bares.map((_, i) => person(i + 1)) });
  const ranToday = n => Array.from({ length: n }, (_, i) => ({ request_id: `trigger:${id(200 + i)}:2026-10:2026-10-27`, kind: 'question', status: 'answered', answer: 'Nothing found.', requested_at: AT }));
  assert.equal(TRIGGER_ASKS_PER_DAY, 10);
  assert.equal(pilotRows({ context: { ...three, research: ranToday(10) }, canon, at: AT, ...live }).research.length, 0, 'the day is spent');
  assert.equal(pilotRows({ context: { ...three, research: ranToday(8) }, canon, at: AT, ...live }).research.length, 2, 'two left today');
  assert.equal(pilotRows({ context: { ...three, research: ranToday(10).map(r => ({ ...r, status: 'over_cap' })) }, canon, at: AT, ...live }).research.length, 3, 'a refusal over the cap ran nothing and spends nothing');
  assert.equal(pilotRows({ context: { ...three, research: ranToday(10).map(r => ({ ...r, requested_at: daysAgo(1) })) }, canon, at: AT, ...live }).research.length, 3, "yesterday's are yesterday's");
});

test('a note not yet answered files its write request and holds; a closed desk holds with nothing filed; a failing note holds, never a template', async () => {
  const { pilotRows } = await import('../src/stages/pilots.mjs');
  const ctx = warmContext({ rows: [listed(1)], people: [person(1)] });
  const waiting = pilotRows({ context: ctx, canon, at: AT, ...live });
  assert.deepEqual([waiting.held, waiting.research.length, waiting.research[0].kind, waiting.rows.length], [['note_waiting'], 1, 'write', 0]);
  assert.equal(waiting.research[0].query, 'Krish\'s reason for writing to Avery now, as one sentence to them, from only this: We are rebuilding our pricing for AI this quarter. Begin with "I". Plain words, under 30. No question, link, offer, price, sum of money, time span, praise, or name or number the fact does not hold. The sentence only.', 'one sentence is asked for, from the trigger alone');
  assert.ok(waiting.research[0].query.length <= 400);
  assert.equal(pilotRows({ context: ctx, canon, at: AT, required: false }).research.length, 0);
  assert.deepEqual(pilotRows({ context: ctx, canon, at: AT, required: false }).held, ['desk_closed']);
  const bad = () => 'I saw Northwind Group is rebuilding pricing for AI this quarter.';
  const failed = pilotRows({ context: { ...ctx, research: answered(waiting.research, bad) }, canon, at: AT, ...live });
  assert.deepEqual([failed.held, failed.rows.length, failed.research.length], [['note_failed'], 0, 0], 'a name the trigger does not hold fails the rules');
  // A sentence the desk could not write is asked again once under the day, and failing that too is a failed note, never one still waiting.
  const base = waiting.research[0], day = { ...base, request_id: `${base.request_id}:2026-10-27` };
  const once = pilotRows({ context: { ...ctx, research: [{ ...base, status: 'failed', answer: null, requested_at: AT }] }, canon, at: AT, ...live });
  assert.deepEqual([once.held, once.research.map(r => r.request_id)], [['note_waiting'], [day.request_id]]);
  const twice = [{ ...base, status: 'failed', answer: null, requested_at: AT }, { ...day, status: 'failed', answer: null, requested_at: AT }];
  const deskFailed = pilotRows({ context: { ...ctx, research: twice }, canon, at: AT, ...live });
  assert.deepEqual([deskFailed.held, deskFailed.research.length], [['note_failed'], 0]);
  const { buyerNote } = await import('../src/stages/openings.mjs');
  assert.deepEqual(buyerNote({ id: id(101), name: 'Avery Example1', trigger: { signal: TRIGGER }, canon, research: twice, required: true, at: AT, kind: 'write' }), { request: null, note: null, hold: 'note_failed', reason: 'desk_failed' });
});

test('a valid note becomes a REACH OUT email in his own box: the note, then the canon link untagged, with a card that says why this person and why now', async () => {
  const { pilotRows, PILOT_SCORE } = await import('../src/stages/pilots.mjs');
  const ctx = warmContext({ rows: [listed(1)], people: [person(1)] });
  const asked = pilotRows({ context: ctx, canon, at: AT, ...live }).research;
  const out = pilotRows({ context: { ...ctx, research: answered(asked, good) }, canon, at: AT, ...live, weekGoals: ['Send the Mindmake one-pagers and offers to warm leads'], files: canon.files });
  assert.equal(out.rows.length, 1);
  const { score, proposal: p } = out.rows[0];
  assert.equal(score, PILOT_SCORE);
  assert.equal(p.row, 'reach_out');
  assert.equal(p.wall, 'send');
  assert.equal(p.stage, null);
  assert.equal(p.objective_key, 'good_meetings');
  assert.equal(p.title, 'Write to Avery Example1 about Mindmake');
  assert.equal(p.serves, 'Send the Mindmake one-pagers and offers to warm leads');
  const a = JSON.parse(p.exact_payload);
  assert.deepEqual(Object.keys(a).sort(), ['body', 'channel', 'recipient_contact_id', 'subject', 'version'], 'no mailbox: his own box, as every row he presses himself');
  assert.deepEqual([a.version, a.channel, a.recipient_contact_id, a.subject], [2, 'email', id(101), 'A thought for Example Works 1']);
  // Every word but the desk's one sentence is fixed: the greeting, the building line, the canon's ask, its link alone on a line, his name.
  assert.equal(a.body, `Hi Avery,\n\n${good(1)} ${BUILD} ${ASK}\n\n${canon.ask.url}\n\nKrish`);
  assert.doesNotMatch(a.body, /utm_/, 'his one-to-one notes are never tagged (Rulings, Krish, 2026-10-27)');
  assert.equal(p.card.why[0], `Why now: ${TRIGGER}`);
  assert.equal(p.card.why[1], 'Runs a media data business that sells to publishers.', 'why this person, in the stored judgment\'s words');
  assert.ok(p.card.sources.some(s => s.url === 'https://example.org/post/1' && s.label === 'Why now: example.org'));
  assert.deepEqual(p.card.gain, ['One reply could be a first meeting with Avery, a leader who can move the decision.', "It serves this week's goal: Send the Mindmake one-pagers and offers to warm leads."]);
  assert.equal(p.card.angles[0].title, canon.ask.label);
  assert.deepEqual(p.evidence, [{ label: `Why now: ${TRIGGER}`, url: 'https://example.org/post/1' }]);
  assert.ok(p.brief.some(l => /^The ask: the one ask on Mindmake's site, for a leader who can decide\./.test(l)));
  assert.equal(p.brief.some(l => /^Reach:/.test(l)), false, 'a buyer is a relationship, not an audience');
  // A warm buyer's row sits on REACH OUT in the taxonomy Control Center checks rows against, and a fit Control Center has not scored is never said.
  const { taxonomy } = await import('../src/stages/suppression.mjs');
  assert.equal(taxonomy().row_for.buyer, 'reach_out');
  const { caseFor } = await import('../src/stages/rows.mjs');
  const unscored = caseFor({ c: person(1, { mindmake_fit: null }), name: 'Avery Example1', company: 'Example Works 1', ask: 'buyer', kind: null, reach: p.reach, fit: null, serves: null });
  assert.equal(unscored.brief.some(l => /Mindmake fit/.test(l)), false);
  assert.ok(p.brief.some(l => l === 'Mindmake fit 70 of 100, as Control Center scores it.'), 'a scored one is said');
  const { cardGrammar } = await import('../src/crew/lints/grammar.mjs');
  assert.deepEqual(cardGrammar(p.card, { records: [person(1).who, person(1).why_them] }), [], 'the card reads as whole sentences');
});

test('never more than five a run, and never past the row\'s cap or with the row turned off', async () => {
  const { pilotRows, MONDAY_BATCH } = await import('../src/stages/pilots.mjs');
  const rows = Array.from({ length: 7 }, (_, i) => listed(i + 1));
  const ctx = warmContext({ rows, people: rows.map((_, i) => person(i + 1)) });
  const asked = pilotRows({ context: ctx, canon, at: AT, ...live }).research;
  assert.equal(asked.length, MONDAY_BATCH, 'no more notes asked than a run can carry');
  const out = pilotRows({ context: { ...ctx, research: answered(asked, good) }, canon, at: AT, ...live });
  assert.equal(out.rows.length, 5);
  assert.deepEqual(out.held, ['batch_full', 'batch_full']);
  assert.equal(pilotRows({ context: { ...ctx, research: answered(asked, good) }, canon, at: AT, ...live, lane: { on: true, max: 2 } }).rows.length, 2);
  assert.deepEqual(pilotRows({ context: ctx, canon, at: AT, ...live, lane: { on: false, max: 6 } }), { rows: [], held: [], research: [], counts: { read: 7, rows: 0, waiting: 0, no_trigger: 0, asked: 0 } });
});

test('never someone Jonny is writing to, and an intro door passes the fit floor the Multiplier Steward reads', async () => {
  const { pilotRows, jonnyOpen } = await import('../src/stages/pilots.mjs');
  const records = { guests: [{ contact_id: id(101), invite_state: 'invited' }], visibility: [{ id: id(900), booking_contact_id: id(102) }], drafts: [{ visibility_target_id: id(900), mailbox: 'jonny' }] };
  assert.deepEqual([...jonnyOpen({ records })].sort(), [id(101), id(102)]);
  assert.equal(jonnyOpen({ records: { ...records, guests: [{ contact_id: id(101), invite_state: 'invited', recorded_at: AT }], drafts: [{ visibility_target_id: id(900), mailbox: 'jonny', published_at: AT }] } }).size, 0, 'closed once recorded or published');
  const ctx = warmContext({ rows: [listed(1), listed(2), listed(3, { ask_kind: 'intro' })], people: [person(1), person(2), person(3, { mindmake_fit: 20 })], records });
  // The booking contact of a stage Jonny's draft went to has a draft from his box: written to lately, before Jonny's own hold.
  assert.deepEqual(pilotRows({ context: ctx, canon, at: AT, ...live }).held, ['jonny_open', 'written_lately', 'low_fit']);
  // Never a second note to someone Advisory already holds past listed.
  const sent = warmContext({ rows: [listed(1), listed(1, { id: id(21), state: 'sent', ask_kind: 'collaborator' })], people: [person(1)] });
  assert.deepEqual(pilotRows({ context: sent, canon, at: AT, ...live }).held, ['advisory_in_flight']);
});

test("the desk writes one sentence, read by fixed rules: the trigger's own reason, nothing it does not hold, nothing of his, and no offer whatever the trigger says", async () => {
  const { validBuyerNote, buyerQuery, OFFER_WORDS, BUYER_SENTENCE_WORDS_MAX } = await import('../src/stages/openings.mjs');
  const args = { name: 'Avery Example1', company: 'Example Works 1', trigger: TRIGGER, offer: canon.offer };
  assert.deepEqual(validBuyerNote(good(1), args), { ok: true, sentence: good(1) });
  assert.equal(validBuyerNote(`Hi Avery,\n\n${good(1)}\n\nBest, Krish`, args).ok, true, 'a greeting and a sign-off are taken off');
  for (const signOff of ['Best wishes,\nKrish', 'Kind regards,\nKrish', 'Speak soon,\nKrish']) assert.equal(validBuyerNote(`${good(1)}\n\n${signOff}`, args).ok, true, signOff);
  // A greeting is a few words at most: never the note up to its first comma.
  assert.equal(validBuyerNote('Hi Avery! I saw your post, the news that you are rebuilding your pricing for AI this quarter.', args).sentence, 'I saw your post, the news that you are rebuilding your pricing for AI this quarter.');
  const NOW = 'I saw you are rebuilding your pricing for AI this quarter';
  const cases = [
    // Shape: one sentence, no question, at most thirty words.
    ['a dash', `${NOW} \u2014 a big call.`, 'dash'],
    ['a spaced hyphen', `${NOW} - a big call.`, 'dash'],
    ['two sentences: the desk wrote a note', `${NOW}. I'm building Mindmake, AI that works the way a leader thinks.`, 'not_one_sentence'],
    ['a question', `${NOW}, would you like a call?`, 'question'],
    ['a second ask without a question mark', `${NOW}. I'd also love twenty minutes on a call next week.`, 'not_one_sentence'],
    ['too long', `${NOW} ${'and more words '.repeat(8)}today.`, 'length'],
    // No link of any kind: the canon's one link follows the note, untagged.
    ['a link', `${NOW}, see https://example.org/a.`, 'link'],
    ['a bare domain with a path', `${NOW}, so book a slot at cal.com/krish whenever suits.`, 'link'],
    ['a bare domain', `${NOW}, and there is more at mindmake.co for you.`, 'link'],
    ['a tagged path', `${NOW}, see mindmake.co/brain-utm_source-email.`, 'link'],
    ['an address', `${NOW}, so reply to avery.example@example.org directly.`, 'link'],
    ['a handle', `${NOW}, as @averyexample said.`, 'link'],
    // No offer, whatever the trigger says: in the one sentence, before it or anywhere.
    ['an offer in the reason', `${NOW}, and our paid two week pilot was made for that.`, 'offer_words'],
    ['an offer in the same breath', 'I saw you are rebuilding your pricing for AI this quarter, so a fixed fee workshop could help.', 'offer_words'],
    ['a guarantee', `${NOW}, and it pays for itself, guaranteed.`, 'offer_words'],
    ['a length of time', `${NOW}, and it is up and running within weeks.`, 'offer_words'],
    ['a price word, though the trigger is about pricing', 'I saw you are changing how you price for AI this quarter.', 'offer_words'],
    // Names and numbers are whole tokens of the trigger, their first name or company: never a part of one.
    ['a name inside a month', 'I saw Marc say you are rebuilding your pricing for AI this quarter.', 'new_name'],
    ['a name inside another word', `${NOW}, as Art at your board said.`, 'new_name'],
    ['a name opening the sentence', 'Gartner rates your pricing rebuild for AI this quarter highly.', 'new_name'],
    ['hearsay from a name', 'Northwind told me you are rebuilding your pricing for AI this quarter.', 'new_name'],
    ['a lower-case brand', `${NOW}, as eBay did.`, 'new_name'],
    ['a new number', `${NOW} with 40 leaders.`, 'new_number'],
    ['a number word', `${NOW} with forty leaders.`, 'new_number'],
    ['a multiplier', `${NOW} at twice the pace.`, 'new_number'],
    ['half', 'I saw you are cutting half your sales team while you rebuild pricing for AI.', 'new_number'],
    // Nothing said of Krish or Mindmake: the fixed lines say all of that.
    ['we', `${NOW}, and we built for exactly that.`, 'claims_about_us'],
    ['our', `${NOW}, which is our whole focus.`, 'claims_about_us'],
    ['Mindmake', `${NOW}, which Mindmake is made for.`, 'claims_about_us'],
    ['a track record', 'I have helped leaders who are rebuilding their pricing for AI this quarter.', 'claims_about_us'],
    ['an offer of help', 'I can help as you rebuild your pricing for AI this quarter.', 'claims_about_us'],
    ["I'd", "I'd love to help as you rebuild your pricing for AI this quarter.", 'claims_about_us'],
    ["I'll", "I'll gladly help as you rebuild your pricing for AI this quarter.", 'claims_about_us'],
    ['hearsay', `${NOW}, a friend told me.`, 'hearsay'],
    // No ask of its own: the one ask follows it as fixed text.
    ['a second ask in the same breath', `${NOW}, so let's find time for a call.`, 'second_ask'],
    ['a meeting asked for', `${NOW}, and it would be good to grab a coffee.`, 'second_ask'],
    ['something free', `${NOW}, and it is free for your whole team.`, 'offer_words'],
    ['a trial', `${NOW}, so a trial could suit you.`, 'offer_words'],
    // The reason is the trigger's: one of its own words, by its stem.
    ['no reason', 'I saw your news and thought of you today.', 'no_why_now'],
    ['praise', 'I saw your impressive move to rebuild your pricing for AI this quarter.', 'praise'],
    ['quotes', 'I saw you are rebuilding "pricing for AI" this quarter.', 'quotes_them'],
    ['an open quote', "I saw your 'rebuild of pricing for AI this quarter.", 'open_quote'],
    ['a research word', 'I saw your profile says you are rebuilding your pricing for AI this quarter.', 'research_words'],
    ['a broken shape', 'I saw that you spotted the pricing rebuild for AI this quarter.', 'krish_line_turned'],
    ['too short', 'Pricing for AI.', 'length'],
  ];
  for (const [what, text, reason] of cases) assert.deepEqual(validBuyerNote(text, args), { ok: false, reason }, what);
  // A word of the trigger, a stem of one (pricing, price), or the company may start or fill it; an ordinary opener names no one.
  for (const ok of ['I noticed you are rebuilding how you charge for AI this quarter, which caught my eye.', 'Rebuilding your pricing for AI this quarter is a big call.', 'Your rebuild of pricing for AI this quarter caught my eye.',
    'I read that Example Works 1 is rebuilding its pricing around AI this quarter.', 'Seeing Example Works 1 rebuild its pricing for AI this quarter made me think of you.']) assert.equal(validBuyerNote(ok, args).ok, true, ok);
  assert.equal(validBuyerNote('I saw your pricing is now set by AI.', args).ok, true, "a stem of the trigger's own word is its reason");
  assert.equal(validBuyerNote('I saw you plan to scale with AI this year.', { ...args, trigger: 'Example Works is scaling its data team with AI agents.' }).ok, true, 'scale and scaling meet, as no five-letter cut lets them');
  assert.equal(validBuyerNote('I saw your board meeting set a new pricing plan for AI.', { ...args, trigger: 'The board meeting at Example Works set a new pricing plan for AI.' }).ok, true, "a word of the trigger's own is no ask");
  // The trigger licenses its own exact tokens only: its number, its name.
  const raised = 'Example Works raised $40 million in October 2026 to rebuild its pricing for AI.';
  assert.equal(validBuyerNote('I saw Example Works raised money in October to rebuild its pricing for AI.', { ...args, trigger: raised }).ok, true);
  assert.equal(validBuyerNote('I saw Example Works raised $40 million in October to rebuild its pricing for AI.', { ...args, trigger: raised }).reason, 'offer_words', 'a sum of money reads as a price whatever the trigger says: never "$40 a seat"');
  assert.equal(validBuyerNote('I saw Example Works raised money in October 2026 to rebuild its pricing for AI.', { ...args, trigger: raised }).ok, true, "the trigger's own number, whole");
  assert.equal(validBuyerNote('I saw Example Works raised money to rebuild its pricing for AI with 20 leaders.', { ...args, trigger: raised }).reason, 'new_number', '20 is not inside 2026');
  assert.equal(validBuyerNote('I saw Example Works raised money in March to rebuild its pricing for AI.', { ...args, trigger: raised }).reason, 'new_name', 'a month the trigger does not name');
  const prices = 'Example Works 1 raised its prices and cut its fees this quarter as AI took over pricing.';
  assert.equal(validBuyerNote('I saw Example Works 1 raised its prices this quarter as AI took over pricing.', { ...args, trigger: prices }).reason, 'offer_words', 'a price word is never licensed by the trigger');
  assert.ok(OFFER_WORDS.test('a pilot') && OFFER_WORDS.test('two weeks') && !OFFER_WORDS.test('pricing for AI this quarter'));
  assert.equal(BUYER_SENTENCE_WORDS_MAX, 30);
  // The instruction keeps the trigger whole where it fits, else cut at a word, and never carries a run of digits or an address.
  assert.equal(buyerQuery({ first: 'Avery', trigger: 'Call 020 7946 0958 for the new AI plan, please do.' }), null);
  assert.equal(buyerQuery({ first: '', trigger: TRIGGER }), null);
  const long = `${'Example Works is rebuilding the way it sets its pricing for every product line with AI agents, '.repeat(4)}said its chief executive.`;
  const q = buyerQuery({ first: 'Avery', trigger: long });
  assert.ok(q && q.length <= 400, 'a long trigger is cut to fit');
  const kept = /from only this: (.+?)\. Begin with/.exec(q)[1];
  assert.ok(long.startsWith(kept) && kept.length >= 60 && !/\s(?:a|the|with|for|and|of|to)$/.test(kept), 'cut at a whole word, never on a joiner');
});

test("two warm notes sharing only their fixed frame are not a template; the same reason with a name swapped is; the frame is never frame for another row", async () => {
  const { sharedBodies } = await import('../src/stages/rows.mjs');
  const { warmFrame } = await import('../src/stages/openings.mjs');
  const { isWarmProposal } = await import('../src/stages/pilots.mjs');
  const opts = { frame: warmFrame(canon), framed: isWarmProposal };
  const email = (pid, body, reference = 'reach_out:warm_ask') => ({ proposal_id: pid, row: 'reach_out', close_condition: { reference }, exact_payload: JSON.stringify({ version: 2, channel: 'email', body }) });
  const note = (first, sentence) => `Hi ${first},\n\n${sentence} ${BUILD} ${ASK}\n\n${canon.ask.url}\n\nKrish`;
  const a = email('gmw-a', note('Avery', good(1)));
  const b = email('gmw-b', note('Robin', 'I read that your newsroom is moving its archive work to AI agents this month.'));
  assert.deepEqual(sharedBodies([a, b], opts), [], 'the building line and the ask are his own frame');
  const c = email('gmw-c', note('Sam', good(2)));
  assert.deepEqual(sharedBodies([a, c], opts).map(x => x.proposal_id), ['gmw-c'], 'the same reason with a name swapped is still a template');
  // The frame is a warm note's only: two other emails that both carry the canon's ask in a sentence, and one more sentence, are a template.
  const amp = (pid, first, co, own) => email(pid, `Hi ${first},\n\nRead that you run the founders dinner at ${co}. Would you like to start building your AI brain with the leaders you gather? ${own}\n\nKrish`, 'reach_out:introduce');
  const pair = [amp('gmw-x', 'Avery', 'Example One', 'The media leaders there are the ones I most want to meet.'), amp('gmw-y', 'Robin', 'Example Two', 'Your guests this autumn sound like a sharp crowd.')];
  assert.deepEqual(sharedBodies(pair, opts).map(x => x.proposal_id), ['gmw-y'], "the canon's label inside another row's sentence is never frame: two shared sentences are a template");
});

test('on the protocol stand-in: the desk writes the note in the same run, the row reaches the report on REACH OUT first, and the voice check holds a bad one', async () => {
  const { runDispatch } = await import('../src/dispatch.mjs');
  const { directiveFixture } = await import('./support/engine-protocol-service.mjs');
  const { readFile } = await import('node:fs/promises');
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
  const run = async ({ voice = {}, rows = [listed(1), listed(2, { intent_evidence: null })], found = null } = {}) => {
    const reports = [], batches = [], checked = [];
    const ctx = { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: AT, coverage: [{ source: 'advisory', available: true, complete: true }], ...warmContext({ rows, people: [person(1), person(2)] }) };
    const cc = {
      recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, voice_check: true }, research: { kinds: ['search', 'question', 'write'], per_day: { search: 120, question: 40, write: 150 } } }),
      context: async () => ({ ok: true, context: ctx }),
      research: async requests => { batches.push(requests); return requests.map(r => r.kind === 'write' ? answered([r], n => (n === 2 ? other(n) : good(n)))[0] : { ...r, status: 'answered', answer: found ?? 'Nothing found in the last 90 days.', evidence: [{ url: found ? 'https://example.org/news/2' : 'https://example.org/none' }], requested_at: AT, answered_at: AT }); },
      voiceCheck: async ({ text }) => { checked.push(text); return { hard: Object.entries(voice).filter(([k]) => text.includes(k)).map(([, rule]) => ({ rule })) }; },
      decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1),
    };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-pilots-live-1', clock: () => AT,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pilots.mjs', sha: 'c'.repeat(40) }], recordReader: async () => null });
    return { result, report: reports[0], batches, checked };
  };
  const { result, report, batches, checked } = await run();
  assert.equal(result.status, 'succeeded');
  const asked = batches.flat();
  assert.ok(asked.some(r => r.kind === 'write' && r.subject_ref === `contact:${id(101)}`), 'the note asked of the desk');
  assert.ok(asked.some(r => r.request_id === `trigger:${id(102)}:2026-10:2026-10-27`), 'and the trigger question for the one with none');
  const warm = report.proposals.filter(p => p.close_condition?.reference === 'reach_out:warm_ask');
  assert.equal(warm.length, 1);
  assert.deepEqual([warm[0].row, warm[0].rank, warm[0].subject_ref], ['reach_out', 1, `contact:${id(101)}`]);
  assert.ok(warm[0].card && warm[0].because && warm[0].brief, 'the full card at 1.8.0');
  assert.ok(checked.some(t => t.includes('the way a leader thinks')), 'every email in his name passes the voice check');
  assert.ok(report.holds.some(h => h.reason === 'pilot_no_trigger' && /once a person a month/.test(h.detail)));
  const line = report.activity.find(a => a.line.startsWith('Warm buyers'))?.line;
  assert.equal(line, "Warm buyers (Advisory's listed buyer and intro asks, in Monday order): 2 read; 1 written as REACH OUT notes for his own box, 0 waiting on the desk's note, 1 with no cited reason to write now (1 asked for one this run).");
  assert.doesNotMatch(JSON.stringify(result), /Avery|Example Works/, 'the printed outcome carries counts, never a name');
  assert.deepEqual(result.rows.pilots, { read: 2, rows: 1, waiting: 0, no_trigger: 1, asked: 1 });
  // A trigger the desk finds in the first round gets its note in the second: written to in the same run, behind the fresher one.
  const chained = await run({ found: 'Example Works 2 is rebuilding its pricing for AI agents this quarter, its chief executive said [1].' });
  assert.deepEqual(chained.batches.map(b => b.filter(r => r.subject_ref === `contact:${id(102)}`).map(r => r.kind)), [['question'], ['write']]);
  assert.deepEqual(chained.report.proposals.filter(p => p.close_condition?.reference === 'reach_out:warm_ask').map(p => [p.subject_ref, p.rank]), [[`contact:${id(101)}`, 1], [`contact:${id(102)}`, 2]]);
  assert.equal(chained.report.proposals.find(p => p.subject_ref === `contact:${id(102)}`).card.sources.some(s => s.url === 'https://example.org/news/2'), true);
  // Person 2's answer is never person 1's reason: not on their card, not in their evidence.
  const first = chained.report.proposals.find(p => p.subject_ref === `contact:${id(101)}`);
  assert.equal(JSON.stringify([first.card, first.evidence]).includes('https://example.org/news/2'), false);
  // The voice check holds a note that breaks his rules, before it is proposed.
  const held = await run({ voice: { 'rebuilding your pricing for AI this quarter at Example Works': 'banned_phrase' } });
  assert.equal(held.report.proposals.some(p => p.close_condition?.reference === 'reach_out:warm_ask'), false);
  assert.ok(held.report.holds.some(h => h.reason === 'voice_refused'));
});

test("a warm note's proposal id is its play, the person and the trigger's month: never an amplifier's connector ask to the same person", async () => {
  const { pilotRows, isWarmProposal } = await import('../src/stages/pilots.mjs');
  const { rowProposal, amplifierRows } = await import('../src/stages/rows.mjs');
  // One person, a connector to the amplifier rows and listed in Advisory as an intro ask: the two asks are kept apart.
  const amp = person(1, { who: 'Founder of the Example Founders Club, a networking dinner for media leaders.', plays: ['amplifier'] });
  const ctx = { ...warmContext({ rows: [listed(1, { ask_kind: 'intro' })], people: [person(1)] }), amplifier_candidates: [amp] };
  const asked = pilotRows({ context: ctx, canon, at: AT, ...live }).research;
  const warm = pilotRows({ context: { ...ctx, research: answered(asked, door) }, canon, at: AT, ...live }).rows[0].proposal;
  const connector = rowProposal({ row: 'reach_out', ask: 'introduce', contactId: id(101), name: 'Avery Example1', title: 't', why: 'w', action: { channel: 'email' }, reach: null, kind: 'connector', features: {}, serves: null, files: [], evidence: [], at: AT });
  assert.notEqual(warm.proposal_id, connector.proposal_id, 'two asks to one person never share an id, so neither overwrites the other after a draft is made');
  assert.deepEqual([warm.close_condition.reference, connector.close_condition.reference], ['reach_out:intro_ask', 'reach_out:introduce']);
  assert.deepEqual([isWarmProposal(warm), isWarmProposal(connector)], [true, false]);
  // The amplifier stage's own connector row for them, as the dispatch would rank it beside the warm note.
  const fromAmp = amplifierRows({ context: ctx, weekGoals: [], canon, files: [], at: AT }).rows.find(r => r.proposal.target === id(101))?.proposal;
  assert.equal(fromAmp?.close_condition.reference, 'reach_out:introduce');
  assert.notEqual(fromAmp.proposal_id, warm.proposal_id);
  // The same play, person and month is one proposal run to run; a buyer ask and an intro ask, or a new month's reason, are each their own.
  const again = pilotRows({ context: { ...ctx, research: answered(asked, door) }, canon, at: AT, ...live }).rows[0].proposal;
  assert.equal(again.proposal_id, warm.proposal_id);
  const buyerCtx = warmContext({ rows: [listed(1)], people: [person(1)] });
  const buyer = pilotRows({ context: { ...buyerCtx, research: answered(pilotRows({ context: buyerCtx, canon, at: AT, ...live }).research, good) }, canon, at: AT, ...live }).rows[0].proposal;
  assert.notEqual(buyer.proposal_id, warm.proposal_id);
  const later = listed(1, { last_post_at: daysAgo(-20) });
  const nextAt = new Date(Date.parse(AT) + 40 * 86400000).toISOString();
  const laterCtx = warmContext({ rows: [later], people: [person(1)] });
  const nextMonth = pilotRows({ context: { ...laterCtx, research: answered(pilotRows({ context: laterCtx, canon, at: nextAt, ...live }).research, good) }, canon, at: nextAt, ...live }).rows[0]?.proposal;
  assert.ok(nextMonth && nextMonth.proposal_id !== buyer.proposal_id, "a reason to write from another month is another proposal");
});

test('one ask a person: never someone drafted to from either box in 90 days (waiting, sent or binned), asked before by this engine, in an open deal, or emailed in 14 days, and nothing spent on them', async () => {
  const { pilotRows, writtenTo } = await import('../src/stages/pilots.mjs');
  const rows = Array.from({ length: 9 }, (_, i) => listed(i + 1));
  const people = rows.map((_, i) => person(i + 1, i === 7 ? { email_last: daysAgo(3) } : {}));
  const drafts = [
    // A morning draft he binned, named by the proposal it was drafted from (Control Center's id, mapped through this engine's own feedback).
    { job: 'morning', mailbox: 'krish', proposal_id: 'cc-proposal-1', created_at: daysAgo(6), binned_at: daysAgo(3) },
    // One he sent, where Control Center names its person (docs/GET-GOING.md 1.1b).
    { job: 'morning', mailbox: 'krish', proposal_id: 'cc-proposal-2', contact_id: id(102), created_at: daysAgo(21), sent_at: daysAgo(20) },
    // A press that drafted to someone in a room, by the person its key names.
    { approach: `rooms:${id(950)}:${id(103)}`, job: 'rooms', mailbox: 'krish', created_at: daysAgo(30) },
    // Older than 90 days: no longer a reason to wait.
    { job: 'morning', mailbox: 'krish', contact_id: id(104), created_at: daysAgo(120), sent_at: daysAgo(119) },
  ];
  const feedback = [
    { id: 'cc-proposal-1', proposal_id: 'gmw-other-row', state: 'pending', subject_ref: `contact:${id(101)}`, row: 'network', reference: 'network:relationship' },
    // A warm ask he carried out long ago, though Advisory's row still says listed: never a second.
    { proposal_id: 'gmw-warm-old', state: 'done', decided_at: daysAgo(200), carried_out: 'draft', subject_ref: `contact:${id(105)}`, row: 'reach_out', reference: 'reach_out:warm_ask' },
    // A pending warm proposal of this run's own is no history.
    { proposal_id: 'gmw-warm-now', state: 'pending', subject_ref: `contact:${id(109)}`, row: 'reach_out', reference: 'reach_out:warm_ask' },
  ];
  const deals = [{ contact_id: id(106), stage: 'meeting_to_lock' }, { contact_id: id(107), stage: 'lost' }];
  const ctx = { ...warmContext({ rows, people, feedback, records: { drafts } }), records: { advisory: rows, visibility: [], drafts, guests: [], deals } };
  const w = writtenTo(ctx, AT);
  assert.deepEqual([[...w.drafted].sort(), [...w.asked], [...w.deals]], [[id(101), id(102), id(103)], [id(105)], [id(106)]]);
  const out = pilotRows({ context: ctx, canon, at: AT, ...live });
  assert.deepEqual(out.held, ['written_lately', 'written_lately', 'written_lately', 'note_waiting', 'already_asked', 'open_deal', 'note_waiting', 'emailed_lately', 'note_waiting']);
  assert.deepEqual(out.research.map(r => r.subject_ref), [`contact:${id(104)}`, `contact:${id(107)}`, `contact:${id(109)}`], 'the desk is asked only for those still free');
  // Nothing served, nobody held for it.
  assert.deepEqual(writtenTo({}, AT), { drafted: new Set(), asked: new Set(), deals: new Set() });
});

test("who is listed but not written to: closed, a competitor, no address, one name, Advisory's own draft, a collaborator, a thin card (with its profile question) and facts that disagree", async () => {
  const { pilotRows } = await import('../src/stages/pilots.mjs');
  const thin = person(7, { current_title: null, current_company: null, who: null, why_them: null, contacts: { ...person(7).contacts, title: null, company: null } });
  const people = [
    person(1, { contacts: { ...person(1).contacts, status: 'closed' } }),
    person(2, { sells_competing_services: true }),
    person(3), person(4),
    person(5, { contacts: { ...person(5).contacts, full_name: 'Avery' } }),
    person(6), thin, person(8, { why_them: 'She now works at Northwind Group, leading its data team.' }), person(9),
  ];
  const rows = [listed(1), listed(2), listed(3), listed(4), listed(5), listed(6), listed(6, { id: id(16), state: 'drafted' }), listed(7, { ask_kind: 'intro' }), listed(8), listed(9, { ask_kind: 'collaborator' })];
  const ctx = warmContext({ rows, people });
  ctx.routes[id(103)] = { ...ROUTE_OK, email: 'bounced' };
  delete ctx.routes[id(104)];
  const out = pilotRows({ context: ctx, canon, at: AT, ...live });
  assert.deepEqual(out.held, ['not_to_be_contacted', 'competitor', 'no_email', 'no_email', 'no_full_name', 'advisory_in_flight', 'thin_card', 'facts_disagree']);
  assert.equal(out.counts.read, 8, 'a collaborator is never read for a note');
  assert.deepEqual(out.research.map(r => [r.request_id, r.subject_ref]), [[`profile:${id(107)}:2026-10`, `contact:${id(107)}`]], 'a card too thin to show asks who they are, and nothing else is asked');
  assert.equal(out.rows.length, 0);
});

test('the dispatch keeps one ask a person: a listed buyer another row reaches this run is skipped before the desk writes anything for them', async () => {
  const { runDispatch } = await import('../src/dispatch.mjs');
  const { directiveFixture } = await import('./support/engine-protocol-service.mjs');
  const { readFile } = await import('node:fs/promises');
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
  // Person 1 is also a close tie gone quiet (a catch-up), person 2 the booking contact of a show pitched this run, person 3 only listed.
  const show = { id: id(900), title: 'The Example Show 900', type: 'podcast', status: 'queued', verdict: 'take', organizer: 'Avery Example', buried_at: null, applied_at: null, event_url: 'https://podcasts.example/show-900', feed_url: 'https://feeds.example/900',
    episodes: 80, latest_episode_at: '2026-10-20T00:00:00Z', booking_contact_id: id(102), booking_source: 'feed_owner', audience: 'Marketing leaders at mid-size companies', angle: null, why_him: 'The show interviews operators who changed how a company works.', why_now: null };
  const people = [person(1), person(2), person(3)];
  const ctx = { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: AT, coverage: [{ source: 'advisory', available: true, complete: true }],
    ...warmContext({ rows: [listed(1), listed(2), listed(3)], people }), quiet_ties: [person(1, { email_last: daysAgo(200) })] };
  ctx.records.visibility = [show];
  const catchUp = "It's been a while since we last spoke. I'm reaching out because I'm building Mindmake, AI that works the way a leader thinks, and I want views from people I rate. I thought of you because of the media data business you run. Would you be open to a quick chat?";
  const reports = [], batches = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, voice_check: true }, research: { kinds: ['search', 'question', 'write'], per_day: { search: 120, question: 40, write: 150 } } }),
    context: async () => ({ ok: true, context: ctx }),
    research: async requests => { batches.push(requests); return requests.map(r => ({ ...r, status: 'answered', answer: r.query.startsWith('Catch-up') ? catchUp : r.kind === 'write' ? good(Number(r.subject_ref.slice(-3)) - 100) : 'Nothing found in the last 90 days.', evidence: [{ url: 'https://example.org/none' }], requested_at: AT, answered_at: AT })); },
    voiceCheck: async () => ({ hard: [] }), decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-pilots-others-1', clock: () => AT, canonReader: async () => canon,
    wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pilots.mjs', sha: 'c'.repeat(40) }], recordReader: async () => null });
  assert.equal(result.status, 'succeeded');
  const report = reports[0];
  const to = p => p.subject_ref === `target:${id(900)}` ? `contact:${id(102)}` : p.subject_ref;
  assert.deepEqual(report.proposals.map(p => [to(p), p.close_condition.reference]).sort(), [[`contact:${id(101)}`, 'network:relationship'], [`contact:${id(102)}`, 'visibility:pitch'], [`contact:${id(103)}`, 'reach_out:warm_ask']].sort(), 'one ask a person');
  assert.ok(report.holds.some(h => h.reason === 'pilot_not_eligible' && /on_another_row 2/.test(h.detail)));
  const warmWrites = batches.flat().filter(r => r.kind === 'write' && r.query.startsWith("Krish's reason for writing")).map(r => r.subject_ref);
  assert.deepEqual(warmWrites, [`contact:${id(103)}`], 'the desk never writes a warm sentence for someone another row reaches this run');
  const { othersThisRun } = await import('../src/stages/pilots.mjs');
  const jonnyPitch = { subject_ref: `target:${id(900)}`, exact_payload: JSON.stringify({ version: 2, channel: 'email', mailbox: 'jonny', recipient_contact_id: id(104), subject: 's', body: 'b' }) };
  assert.deepEqual([...othersThisRun({ rows: [{ proposal: { target: id(105) } }], openings: [{ subject_ref: `contact:${id(106)}` }], proposals: [jonnyPitch] })].sort(), [id(104), id(105), id(106)].sort(), "a row's person, a person an opening is asked for, and Jonny's recipient");
});

test("the row's cap and fit floor are the week spec's, and a warm note ranks first on REACH OUT, above an amplifier's", async () => {
  const { fiveRows } = await import('../src/dispatch.mjs');
  const { STAGE_CAPS } = await import('../src/crew/compile.mjs');
  const rows = [listed(1), listed(2), listed(3, { ask_kind: 'intro' })];
  const people = [person(1), person(2), person(3, { mindmake_fit: 70 })];
  // An amplifier on REACH OUT: a connector who gathers founders, not listed in Advisory.
  const amp = person(4, { who: 'Founder of the Example Founders Club, a networking dinner for media leaders.', plays: ['amplifier'] });
  const ctx = { ...warmContext({ rows, people: [...people, amp] }), amplifier_candidates: [amp] };
  const cc = {
    // Each person's own sentence: the same one with a name swapped would be a template, and held.
    research: async requests => requests.map(r => ({ ...r, status: 'answered', answer: r.kind === 'write' ? [good, other, door][(Number(r.subject_ref.slice(-3)) - 101) % 3](Number(r.subject_ref.slice(-3)) - 100) : 'Nothing found in the last 90 days.', evidence: [{ url: 'https://example.org/none' }], requested_at: AT, answered_at: AT })),
    voiceCheck: async () => ({ hard: [] }),
  };
  const capabilities = { features: { research: true, voice_check: true }, research: { kinds: ['search', 'question', 'write'], per_day: { search: 120, question: 40, write: 150 } } };
  const run = caps => fiveRows({ cc, context: ctx, directive: { week_goals: [] }, capabilities, mode: 'live', at: AT, clock: () => AT, canonReader: async () => canon, wordFiles: async () => [], recordReader: async () => null, caps });
  const today = await run(STAGE_CAPS);
  const reach = today.proposals.filter(p => p.row === 'reach_out').sort((a, b) => a.rank - b.rank).map(p => [p.close_condition.reference, p.subject_ref]);
  assert.deepEqual(reach.slice(0, 4), [['reach_out:warm_ask', `contact:${id(101)}`], ['reach_out:warm_ask', `contact:${id(102)}`], ['reach_out:intro_ask', `contact:${id(103)}`], ['reach_out:introduce', `contact:${id(104)}`]], 'the warm notes first, then the amplifier');
  // A signed spec: one on REACH OUT, and a fit floor the intro ask does not pass.
  const signed = await run({ ...STAGE_CAPS, rows: { ...STAGE_CAPS.rows, reach_out: { on: true, max: 1 } }, fit_floor: 80 });
  assert.deepEqual(signed.proposals.filter(p => p.row === 'reach_out').map(p => p.close_condition.reference), ['reach_out:warm_ask']);
  assert.match(signed.holds.find(h => h.reason === 'pilot_not_eligible')?.detail ?? '', /low_fit 1/);
  assert.ok(signed.holds.some(h => h.reason === 'pilot_batch_full'));
});

test("on the stand-in's research desk: a refused request holds only its own row, one person's question is sent once, and a busy round still asks the warm buyers' reasons first", async () => {
  const { runDispatch } = await import('../src/dispatch.mjs');
  const { directiveFixture, startProtocolService } = await import('./support/engine-protocol-service.mjs');
  const { engineClient } = await import('../src/control-center.mjs');
  const { readFile } = await import('node:fs/promises');
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
  const catchUp = "It's been a while since we last spoke. I'm reaching out because I'm building Mindmake, AI that works the way a leader thinks, and I want views from people I rate. I thought of you because of the media data business you run. Would you be open to a quick chat?";
  const FOUND = 'Example Works is rebuilding its pricing for AI agents this quarter, its chief executive said [1].';
  // The desk answers a catch-up with a catch-up, a warm buyer's request with one sentence, and a trigger question with a cited reason.
  const desk = r => ({ status: 'answered', evidence: [{ url: 'https://example.org/news/9' }],
    answer: r.query.startsWith('Catch-up') ? catchUp : r.kind === 'write' ? good(Number(r.subject_ref.slice(-3)) - 100) : /^trigger:/.test(r.request_id) ? FOUND : 'Nothing found in the last 90 days.' });
  const run = async ({ ctx, seed = [] }) => {
    const service = await startProtocolService({ research: desk, now: AT });
    for (const r of seed) service.researchStore.set(r.request_id, r);
    const client = engineClient(service.origin, service.token, { fetcher: service.fetcher });
    const reports = [], batches = [];
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, voice_check: true }, research: { kinds: ['search', 'question', 'write'], per_day: { search: 120, question: 40, write: 150 } } }),
      context: async () => ({ ok: true, context: { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: AT, coverage: [{ source: 'advisory', available: true, complete: true }], ...ctx } }),
      research: async requests => { batches.push(requests.map(r => r.request_id)); return client.research(requests); },
      voiceCheck: async () => ({ hard: [] }), decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    try {
      const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-pilots-desk-1', clock: () => AT, canonReader: async () => canon,
        wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pilots.mjs', sha: 'c'.repeat(40) }], recordReader: async () => null });
      return { result, report: reports[0], batches, statuses: service.requests.filter(q => q.route === 'research').length };
    } finally { await service.close(); }
  };
  const bare = n => listed(n, { intent_evidence: null, intent_evidence_url: null, last_post_at: null });
  const warm = r => r.proposals.filter(p => p.close_condition?.reference === 'reach_out:warm_ask').map(p => p.subject_ref);
  // 1. Control Center already holds today's trigger question for person 1 in other words (their title changed): it refuses that one (409).
  //    Person 2's note, in the same call, is still written, and the round goes on.
  const ctx1 = warmContext({ rows: [bare(1), listed(2)], people: [person(1), person(2)] });
  const seed = [`trigger:${id(101)}:2026-10`, `trigger:${id(101)}:2026-10:2026-10-27`].map(request_id => ({ request_id, kind: 'question', subject_ref: `contact:${id(101)}`, query: 'Asked before in other words.', status: 'answered', answer: 'Nothing found.', requested_at: daysAgo(1) }));
  const one = await run({ ctx: ctx1, seed });
  assert.equal(one.result.status, 'succeeded');
  assert.deepEqual(warm(one.report), [`contact:${id(102)}`], "one refusal holds only its own row");
  assert.equal(one.report.holds.some(h => h.reason === 'research_unavailable'), false, 'the round is never taken down by one request');
  assert.match(one.report.holds.find(h => h.reason === 'research_refused')?.detail ?? '', /^1 research request Control Center refused was left out/);
  assert.match(one.report.activity.find(a => a.line.startsWith('Warm buyers')).line, /\(0 asked for one this run\)/, 'a refused question is not counted as asked');
  // 2. A close tie whose card is too thin to show, listed as an intro ask too: the amplifier rows and the warm buyers both want to know who they are. One question is sent, never the same id twice (400).
  const thin = person(3, { current_title: null, current_company: null, who: null, why_them: null, mindmake_fit: 70, plays: ['amplifier'], contacts: { ...person(3).contacts, title: null, company: null } });
  const ctx2 = { ...warmContext({ rows: [listed(3, { ask_kind: 'intro' })], people: [thin] }), amplifier_candidates: [{ ...thin, who: null, roles: ['networking'] }] };
  const two = await run({ ctx: ctx2 });
  const profileIds = two.batches.flat().filter(x => x.startsWith('profile:'));
  assert.deepEqual(profileIds, [`profile:${id(103)}:2026-10`], 'asked once');
  assert.equal(two.report.holds.some(h => h.reason === 'research_unavailable' || h.reason === 'research_refused'), false);
  // 3. A busy round: 25 close ties gone quiet each need a catch-up written, more than a round carries. The warm buyer's reason is asked in the first round, ahead of them,
  //    and the reason found there gets its sentence in the second.
  const ties = Array.from({ length: 25 }, (_, i) => person(10 + i, { email_last: daysAgo(200) }));
  const ctx3 = { ...warmContext({ rows: [bare(1)], people: [person(1), ...ties] }), quiet_ties: ties };
  const three = await run({ ctx: ctx3 });
  const roundOf = idPrefix => three.batches.findIndex(b => b.some(x => x.startsWith(idPrefix)));
  assert.ok(roundOf(`trigger:${id(101)}:`) === 0, 'the reason is asked in the first call of the first round');
  const firstRound = three.batches.slice(0, 2).flat();
  assert.ok(firstRound.indexOf(firstRound.find(x => x.startsWith('trigger:'))) < firstRound.findIndex(x => x.startsWith('open:')), 'ahead of the openings');
  assert.deepEqual(warm(three.report), [`contact:${id(101)}`], 'found in the first round, written in the second: a row in the same run');
  // 4. A question Control Center already ran today in the same words, which this run's context no longer carries: it replays its answer, and that is no new question.
  const { triggerRequest } = await import('../src/stages/pilots.mjs');
  const q = triggerRequest({ id: id(104), name: 'Avery Example4', company: 'Example Works 4', title: 'Founder', at: AT });
  const four = await run({ ctx: warmContext({ rows: [bare(4)], people: [person(4)] }), seed: [{ ...q, status: 'answered', answer: 'Nothing found in the last 90 days.', evidence: [], requested_at: new Date(Date.parse(AT) - 3600000).toISOString() }] });
  assert.ok(four.batches.flat().includes(q.request_id), 'sent, and replayed as stored');
  assert.match(four.report.activity.find(a => a.line.startsWith('Warm buyers')).line, /\(0 asked for one this run\)/, 'a replay is not counted as asked');
});

// The columns Control Center's context reads for an Advisory row today (control-center api/_growthContext.ts, SOURCES.advisory, read 13 November 2026):
// no stored trigger (intent_evidence, intent_evidence_url, last_post_at) and no person. docs/GET-GOING.md 1.1b asks for both.
const ADVISORY_COLUMNS_SERVED = 'id,contact_id,state,ask_kind,ask_line,why_face,draft_subject,draft_body,drafted_at,sent_at,replied_at,call_booked_at,call_taken_at,pilot_booked_at,pilot_paid_at,qualified_at,qualification,cash_gbp,notes,growth_context,visibility_target_id,guest_id,updated_at,trigger_found_at,listed_at'.split(',');

test("what Control Center serves for an Advisory buyer is read as it comes: today's columns, and the person row and stored trigger 1.1b adds", async () => {
  const { pilotRows, pilotHolds, advisoryPerson } = await import('../src/stages/pilots.mjs');
  const asServed = row => Object.fromEntries(Object.entries(row).filter(([k]) => ADVISORY_COLUMNS_SERVED.includes(k)));
  // Today: the row as Control Center selects it, and nobody in the network lists for person 1. They are not served, said as such; person 2 is served and has no stored reason, so the desk is asked.
  const today = warmContext({ rows: [asServed(listed(1)), asServed(listed(2))], people: [person(2)] });
  const out = pilotRows({ context: today, canon, at: AT, ...live });
  assert.deepEqual(out.held, ['person_not_served', 'no_trigger']);
  assert.deepEqual(out.research.map(r => r.request_id), [`trigger:${id(102)}:2026-10:2026-10-27`]);
  assert.deepEqual(pilotHolds(out.held).map(h => h.reason), ['pilot_no_trigger', 'pilot_person_not_served']);
  assert.match(pilotHolds(['person_not_served']).at(-1).detail, /^1 listed buyer not written to: Control Center serves no person row or address for them yet \(docs\/GET-GOING\.md 1\.1b/);
  // Once 1.1b is served: the person row on the Advisory row, its address in routes, and the stored trigger, with nothing in the network lists.
  const served = { ...listed(1), person: { ...person(1), contact_id: undefined } };
  const ctx = { ...warmContext({ rows: [served], people: [] }), routes: { [id(101)]: ROUTE_OK } };
  const asked = pilotRows({ context: ctx, canon, at: AT, ...live });
  assert.deepEqual([asked.held, asked.research.map(r => r.kind)], [['note_waiting'], ['write']], 'their own row, and the reason Advisory stored');
  const written = pilotRows({ context: { ...ctx, research: answered(asked.research, good) }, canon, at: AT, ...live });
  assert.deepEqual(written.rows.map(r => [r.proposal.target, r.proposal.card.sources.some(x => x.url === 'https://example.org/post/1')]), [[id(101), true]]);
  // A person row for another contact is never theirs, and a buyer still needs a title the canon reads.
  assert.equal(advisoryPerson({ contact_id: id(101), person: { ...person(2) } }), null);
  assert.equal(advisoryPerson({ contact_id: id(101), person: null }), null);
  // The network rule reads it too: a show whose booking address is that person is never Jonny's to write to.
  const { networkListed, networkLane } = await import('../src/stages/pitches.mjs');
  assert.equal(networkLane(id(101), { routes: {}, listed: networkListed(ctx), served: false, booking: true }), 'krish');
});

test('a run\'s warm-buyer holds: a line each for the trigger, the note, the desk and the batch, and one line for everyone else, counts and codes only', async () => {
  const { pilotHolds, pilotLine } = await import('../src/stages/pilots.mjs');
  const held = ['no_trigger', 'not_close_tier', 'note_waiting', 'no_email', 'not_close_tier', 'note_failed', 'batch_full', 'no_trigger'];
  assert.deepEqual(pilotHolds(held).map(h => h.reason), ['pilot_batch_full', 'pilot_no_trigger', 'pilot_note_failed', 'pilot_note_waiting', 'pilot_not_eligible']);
  assert.equal(pilotHolds(held).at(-1).detail, '3 listed buyer and intro asks were not written to this run (no_email 1, not_close_tier 2).');
  assert.match(pilotHolds(held)[1].detail, /^2 warm buyers held with no cited reason to write now inside 90 days/);
  assert.deepEqual(pilotHolds([]), []);
  assert.equal(pilotLine({ read: 0 }), null, 'no listed buyers, no line: every earlier report is unchanged');
});
