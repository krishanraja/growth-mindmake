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
