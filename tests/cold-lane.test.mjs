import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  coldRows, coldNoteHold, coldLine, coldHolds, coldPause, coldHistory, coldCandidates, coldAction, asksIn, isColdProposal, takesCold, gateCode,
  COLD_SLOTS_PER_DAY, COLD_WORDS_MAX, COLD_PREFIX, FOLLOW_PREFIX, COLD_HOLDS, COLD_VERSION, SOURCE_LINES, servedEligibility, nyDay,
} from '../src/stages/cold.mjs';
import { gateState, footerOf, SOURCE_LINE_MAX } from '../src/stages/compliance.mjs';
import { scoreProspect, SCORERS, POINTS } from '../src/stages/qualify.mjs';
import { signalRows } from '../src/stages/signals.mjs';
import { runDispatch, buildReport } from '../src/dispatch.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';
import { canon } from './support/section12.mjs';

// The daily cold email lane (GET-GOING 1.3). Synthetic only: every person,
// company, domain and id below is invented, under reserved test names, and
// no figure is a real one.

const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
const DAY = '2026-11-10';
const NOW = '2026-11-16T15:00:00.000Z';
const H = 3600000, D = 24 * H;
const ago = ms => new Date(Date.parse(NOW) - ms).toISOString();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ap = n => ({ approved_on: DAY, sha256: sha(`synthetic approval ${n}`) });
const CONFIG = { version: 1, krish: { footer_words: ap(1), privacy_section: ap(2), legitimate_interests: ap(3), reviewer: ap(4), old_opt_outs: { none_on: DAY, by: 'krish' } } };
const CAPS = (over = {}, features = {}) => ({
  schema_versions: ['1.38.0', '1.39.0'], features: { cold_email: true, mail_outcomes: true, network_routes: true, follow_up: true, receipts: true, ...features },
  cold_email: { footer_sha256: ap(1).sha256, one_click: true, stop_reply: true }, ...over,
});
const gateFor = caps => gateState({ config: CONFIG, optOuts: null, at: NOW, footer: footerOf(caps) });
const OPEN = gateFor(CAPS());
/** A served record of who may be written to cold, which Control Center does not serve yet: the United States, an address on the company's domain. */
const ELIGIBLE = c => ({ country: 'US', email_domain: c.domain });
const row = (n, over = {}) => ({
  contact_id: id(n), current_title: 'Chief Executive Officer', current_company: `Northwind ${n}`, mindmake_fit: 80,
  contacts: { full_name: `Dana Example${n}`, company_domain: `northwind${n}.example.net`, status: null },
  facts: [{ kind: 'post', text: `Most AI pilots stall in procurement, part ${n}.`, source_url: `https://posts.example.test/${n}`, observed_at: '2026-11-01T00:00:00Z' }],
  ...over,
});
const route = (over = {}) => ({ email: 'verified', in_network: false, ...over });
const ctx = (rows = [row(1)], over = {}, records = {}) => ({
  network: rows, routes: Object.fromEntries(rows.map(r => [r.contact_id, route()])), feedback: [],
  records: { drafts: [], brief_takers: [], deals: [], guests: [], visibility: [], ...records }, ...over,
});
const run = (context, over = {}) => coldRows({ context, research: [], gate: OPEN, canon, at: NOW, history: [], capabilities: CAPS(), files: canon.files, eligibility: ELIGIBLE, ...over });
const action = p => JSON.parse(p.exact_payload);

// ── The way in: the compliance gate first ───────────────────────────────────

test('a qualified person outside his network gets one cold note in his own box, with the source line and nothing of a footer', () => {
  const out = run(ctx());
  assert.deepEqual([out.held, out.rows.length, out.counts.proposed], [[], 1, 1]);
  const p = out.rows[0].proposal, a = action(p);
  assert.ok(p.proposal_id.startsWith(COLD_PREFIX));
  assert.deepEqual([a.version, a.channel, a.mailbox, a.recipient_contact_id, a.kind], [2, 'email', 'krish', id(1), undefined]);
  assert.deepEqual(a.cold, { source_line: SOURCE_LINES.post });
  assert.equal(p.row, 'reach_out');
  assert.equal(coldNoteHold(a), null);
  assert.match(a.body, /^Hi Dana,\n\nI read your post: "Most AI pilots stall in procurement, part 1\."\n\n/);
  assert.equal(asksIn(a.body).length, 1);
  assert.ok(p.card && p.card.sources.some(s => s.url === 'https://posts.example.test/1'));
  assert.equal(isColdProposal(p), true);
});

test("with no gate read, a footer that is not the approved one or not served, or brief takers unread, every cold note is held by the gate's own code", () => {
  assert.deepEqual(run(ctx(), { gate: null }).held, ['cold_compliance_config_unreadable']);
  const wrong = CAPS({ cold_email: { footer_sha256: sha('another footer'), one_click: true, stop_reply: true } });
  assert.deepEqual(run(ctx(), { gate: gateFor(wrong), capabilities: wrong }).held, ['cold_footer_not_approved']);
  const unserved = CAPS({}, { cold_email: false });
  assert.deepEqual(run(ctx(), { gate: gateFor(unserved), capabilities: unserved }).held, ['cold_footer_not_served']);
  const noTakers = ctx(); delete noTakers.records.brief_takers;
  assert.deepEqual(run(noTakers).held, ['cold_brief_takers_unread']);
  assert.equal(gateCode('country_unknown'), 'cold_country_unknown');
  assert.equal(gateCode('cold_opt_out_missing'), 'cold_opt_out_missing');
});

test('what the context serves today says nothing of country or address domain, so every cold note holds until it does', () => {
  assert.deepEqual(servedEligibility(), {});
  assert.deepEqual(run(ctx(), { eligibility: servedEligibility }).held, ['cold_country_unknown']);
  assert.deepEqual(run(ctx(), { eligibility: c => ({ country: 'FR', email_domain: c.domain }) }).held, ['cold_country_not_allowed']);
  assert.deepEqual(run(ctx(), { eligibility: c => ({ country: 'GB', email_domain: c.domain }) }).held, ['cold_subscriber_unknown']);
  assert.deepEqual(run(ctx(), { eligibility: () => ({ country: 'US', email_domain: 'gmail.com' }) }).held, ['cold_not_a_business_address']);
  // A person with nothing that says where they were found has no source for the footer.
  assert.deepEqual(run(ctx([row(1, { facts: [] })])).held, ['cold_source_missing']);
});

// ── Who is never written to cold ────────────────────────────────────────────

test('each exclusion holds as cold_excluded: his network, the unplaced, no address, a bounce, an opt-out, a brief taker, the circle, a Jonny pitch, a deal, another lane, a No, an earlier cold note, a recent note', () => {
  const one = (context, over = {}) => run(context, over).held;
  const base = () => ctx();
  const cases = {
    in_network: c => { c.routes[id(1)].in_network = true; },
    unplaced: c => { c.routes[id(1)].in_network = null; },
    no_route: c => { delete c.routes[id(1)]; },
    no_address: c => { c.routes[id(1)].email = 'none'; },
    bounced: c => { c.records.drafts.push({ contact_id: id(1), job: 'morning', mailbox: 'krish', proposal_id: 'gmw-x', sent_at: ago(40 * D), bounced_at: ago(39 * D) }); },
    opted_out: c => { c.records.drafts.push({ contact_id: id(1), job: 'morning', mailbox: 'krish', proposal_id: 'gmw-x', sent_at: ago(40 * D), opted_out_at: ago(39 * D) }); },
    brief_taker: c => { c.records.brief_takers.push({ contact_id: id(1) }); },
    circle: c => { c.records.guests.push({ contact_id: id(1), discovery_source: 'growth_circle' }); },
    jonny_pitch: c => { c.records.drafts.push({ contact_id: id(1), mailbox: 'jonny', job: 'booked', proposal_id: 'gmp-x', created_at: ago(20 * D) }); },
    jonny_booker: c => { c.records.visibility.push({ id: id(900), booking_contact_id: id(1) }); c.records.drafts.push({ visibility_target_id: id(900), mailbox: 'jonny', job: 'booked', created_at: ago(20 * D) }); },
    open_deal: c => { c.records.deals.push({ contact_id: id(1) }); },
    declined: c => { c.feedback.push({ subject_ref: `contact:${id(1)}`, state: 'declined', reason_code: 'wrong_person', row: 'reach_out', decided_at: ago(5 * D) }); },
    cold_before: c => { c.records.drafts.push({ contact_id: id(1), mailbox: 'krish', job: 'morning', proposal_id: `${COLD_PREFIX}${'a'.repeat(32)}`, created_at: ago(60 * D), sent_at: ago(60 * D) }); },
    written_lately: c => { c.records.drafts.push({ contact_id: id(1), mailbox: 'krish', job: 'morning', proposal_id: 'gmw-y', created_at: ago(10 * D) }); },
  };
  for (const [name, change] of Object.entries(cases)) { const c = base(); change(c); assert.deepEqual(one(c), ['cold_excluded'], name); }
  assert.deepEqual(one(base(), { taken: new Set([id(1)]) }), ['cold_excluded'], 'another lane writes to them this run');
  assert.deepEqual(one(base(), { taken: new Set([`contact:${id(1).toUpperCase()}`]) }), ['cold_excluded'], 'a subject reference in any case');
  // A Jonny pitch long gone quiet, or one already answered, is no longer open.
  const quiet = base(); quiet.records.drafts.push({ contact_id: id(1), mailbox: 'jonny', job: 'booked', created_at: ago(45 * D) });
  assert.deepEqual(one(quiet), []);
  const answered = base(); answered.records.drafts.push({ contact_id: id(1), mailbox: 'jonny', job: 'booked', created_at: ago(20 * D), replied_at: ago(10 * D) });
  assert.deepEqual(one(answered), []);
});

test('candidates are only what the context serves: the person rows, the signals and the answered lookups, deduped across them', () => {
  const engagers = { request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', evidence: [
    { url: 'https://www.linkedin.com/posts/synthetic-post-1', snippet: 'Worried about what this means for my team and our managers.', published: '2026-11-12T00:00:00Z', person: { handle: 'someone-a', name: 'Sam Sample', headline: 'Chief Operating Officer at Harborline', contact_id: id(1) } },
    { url: 'https://www.linkedin.com/posts/synthetic-post-1', snippet: 'Worried my board will ask and my team will not know.', published: '2026-11-12T00:00:00Z', person: { handle: 'someone-b', name: 'Riley Placeholder', headline: 'Chief Executive Officer at Tidewater' } },
  ] };
  const routeAnswer = { request_id: 'route:someone-b', kind: 'person_route', status: 'answered', subject_ref: `contact:${id(2)}`, query: 'li:someone-b' };
  const found = coldCandidates({ context: ctx([row(1)]), research: [engagers, routeAnswer] });
  assert.deepEqual(found.map(c => [c.id, [...c.origins].sort()]), [[id(1), ['pool', 'signal']], [id(2), ['lookup', 'signal']]]);
  assert.equal(found[1].name, 'Riley Placeholder');
  assert.equal(found[0].name, 'Dana Example1', 'the person row is read first');
  // Nobody is made up from a name: a row with no contact id, or a commenter with no id and no route, is no candidate.
  assert.deepEqual(coldCandidates({ context: { network: [{ ...row(3), contact_id: 'not-an-id' }] }, research: [{ ...engagers, evidence: [{ ...engagers.evidence[1], person: { ...engagers.evidence[1].person, handle: 'someone-c' } }] }] }), []);
});

test("a signal outside his network is the cold lane's where cold email is served, and the signal row stands aside", () => {
  const engagers = { request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', evidence: [
    { url: 'https://www.linkedin.com/posts/synthetic-post-1', snippet: 'Worried about what this means for my team and our managers.', published: '2026-11-12T00:00:00Z', person: { handle: 'someone-a', name: 'Sam Sample', headline: 'Chief Executive Officer at Harborline', contact_id: id(5) } },
  ] };
  const context = { routes: { [id(5)]: route() }, feedback: [], records: { drafts: [], brief_takers: [], deals: [], guests: [], visibility: [] } };
  const args = { context, research: [engagers], weekGoals: [], canon, files: canon.files, at: NOW };
  assert.equal(signalRows(args).rows.length, 1, 'off: as before');
  assert.deepEqual(signalRows({ ...args, coldLane: true }), { rows: [], held: ['signal_cold_lane'] });
  const out = run(context, { research: [engagers], eligibility: () => ({ country: 'US', email_domain: 'harborline.example.net', company_domain: 'harborline.example.net' }) });
  // The signal scores on its own: CEO (+30), a verified route (+25), the signal (+20), with no fit served.
  assert.equal(out.rows.length, 1);
  const a = action(out.rows[0].proposal);
  assert.deepEqual(a.cold, { source_line: SOURCE_LINES.signal });
  assert.match(a.body, /I saw your comment on a public LinkedIn post about AI\./);
  assert.doesNotMatch(a.body, /Worried/, 'their words are never quoted: they are not on their own record');
});

// ── The score, after the gate ───────────────────────────────────────────────

test('the lead scorer joins SCORERS last, with a reason beside every point and its rule-out apart', () => {
  assert.equal(SCORERS.at(-1).name, 'lead');
  const at = NOW, buyer = canon.buyer;
  const base = { title: 'Chief Executive Officer', decision_authority: 'unknown', moment: null, evidence: {}, email_route: 'unchecked' };
  assert.deepEqual(scoreProspect(base, { buyer, at }).reasons, ['+30 title in the canon\'s buyer group "CEO"', '+15 an email route, not yet verified'], 'a prospect carrying no lead field scores as before');
  const lead = scoreProspect({ ...base, signal: true, mindmake_fit: 74, in_network: false }, { buyer, at });
  assert.deepEqual(lead.reasons.slice(-2), [`+${POINTS.signal} said in public that AI is a live question for them (their own comment, cited)`, `+${POINTS.fit_high} Control Center scores their Mindmake fit 74 of 100`]);
  assert.equal(lead.qualified, true);
  assert.deepEqual(scoreProspect({ ...base, mindmake_fit: 50 }, { buyer, at }).reasons.at(-1), `+${POINTS.fit_some} Control Center scores their Mindmake fit 50 of 100`);
  assert.deepEqual(scoreProspect({ ...base, mindmake_fit: 12 }, { buyer, at }).reasons.at(-1), `${POINTS.fit_low} Control Center scores their Mindmake fit 12 of 100, a poor fit`);
  for (const inside of [true, null, undefined]) {
    const s = scoreProspect({ ...base, signal: true, in_network: inside }, { buyer, at });
    assert.deepEqual([s.qualified, s.ruled_out], [false, ['inside his network or not placed by Control Center: only Krish writes to them, in his own words']], String(inside));
  }
});

test('a rule-out or a score under the floor holds as cold_score_low, and authority is never read from a title', () => {
  assert.deepEqual(run(ctx([row(1, { sells_competing_services: true })])).held, ['cold_score_low']);
  assert.deepEqual(run(ctx([row(1, { mindmake_fit: 20 })])).held, ['cold_score_low'], 'a poor fit');
  assert.deepEqual(run(ctx([row(1, { current_title: 'Analyst' })])).held, ['cold_score_low'], 'no buyer title');
  assert.deepEqual(run(ctx(), { canon: { ...canon, buyer: null } }).held, ['cold_score_low'], 'no buyer read this run: nothing is scored');
  const c = ctx(); c.routes[id(1)].email = 'unchecked';
  // CEO +30, an unchecked route +15, fit 80 +15: 60 clears the floor; "can move the decision" is never given from a title.
  assert.equal(run(c).rows.length, 1);
  assert.ok(!run(c).rows[0].proposal.why.includes('can move the decision'));
});

// ── Something specific ──────────────────────────────────────────────────────

test("with no cited fact on their record or their company's, the note holds as cold_nothing_specific and the desk is asked, at most three a run", () => {
  const bare = n => row(n, { facts: [] });
  const c = ctx([1, 2, 3, 4].map(bare));
  // Each found by a lookup, which gives the footer its source.
  const lookups = [1, 2, 3, 4].map(n => ({ request_id: `route:p${n}`, kind: 'person_route', status: 'answered', subject_ref: `contact:${id(n)}`, query: `li:p${n}` }));
  const out = run(c, { research: lookups });
  assert.deepEqual(out.held, Array(4).fill('cold_nothing_specific'));
  assert.equal(out.rows.length, 0);
  assert.equal(out.company_reads.length, 3, 'their company sites, three at most');
  assert.deepEqual(out.company_reads.map(w => w.site).sort(), ['northwind1.example.net', 'northwind2.example.net', 'northwind3.example.net']);
  // With no site the desk can read (a reserved name here), one search under its own month's id; never asked twice, never with an address in it.
  const noSite = ctx([1, 2].map(n => row(n, { facts: [], contacts: { full_name: `Dana Example${n}`, company_domain: `northwind${n}.test` } })));
  const searches = run(noSite, { research: lookups }).research;
  assert.deepEqual(searches.map(r => [r.request_id, r.kind, r.subject_ref]), [[`cold:${id(1)}:2026-11`, 'search', `contact:${id(1)}`], [`cold:${id(2)}:2026-11`, 'search', `contact:${id(2)}`]]);
  assert.ok(searches.every(r => !/@/.test(r.query) && r.query.length <= 400));
  assert.deepEqual(run(noSite, { research: [...lookups, { request_id: `cold:${id(1)}:2026-11`, kind: 'search', status: 'empty', subject_ref: `contact:${id(1)}` }] }).research.map(r => r.request_id), [`cold:${id(2)}:2026-11`]);
});

test("an answered search about them or a read of their company's site is something specific, quoted whole and cited", () => {
  const lookup = { request_id: 'route:p1', kind: 'person_route', status: 'answered', subject_ref: `contact:${id(1)}`, query: 'li:p1' };
  const answer = { request_id: `cold:${id(1)}:2026-11`, kind: 'search', status: 'answered', subject_ref: `contact:${id(1)}`, answered_at: ago(H),
    evidence: [{ title: 'Northwind 1 opens a new hub', url: 'https://news.example.test/northwind-1', snippet: 'Northwind 1 opened a logistics hub in Harbour City this autumn. More below.' }] };
  const out = run(ctx([row(1, { facts: [] })]), { research: [lookup, answer] });
  assert.equal(out.rows.length, 1);
  assert.match(action(out.rows[0].proposal).body, /I read this about your work: "Northwind 1 opened a logistics hub in Harbour City this autumn"\./);
  assert.ok(out.rows[0].proposal.evidence.some(e => e.url === 'https://news.example.test/northwind-1'));
  const read = { request_id: 'company:northwind1.example.net:2026-11', kind: 'company_read', status: 'answered', query: 'northwind1.example.net', answered_at: ago(H),
    evidence: [{ url: 'https://northwind1.example.net/', title: 'Northwind 1', snippet: 'Freight software for regional carriers' }] };
  const site = run(ctx([row(1, { facts: [] })]), { research: [lookup, read] });
  assert.match(action(site.rows[0].proposal).body, /Your company's site says: "Freight software for regional carriers\."/);
});

// ── The note: one ask, one link at most, under 90 words, no footer ──────────

test(`a body of ${COLD_WORDS_MAX - 1} words passes and ${COLD_WORDS_MAX} is held`, () => {
  const base = coldAction({ c: { id: id(1), name: 'Dana Example' }, fact: { kind: 'post', text: 'Most AI pilots stall in procurement.' }, sourceLine: SOURCE_LINES.post });
  // The greeting (2), the filler, the ask (8) and the sign-off (2).
  const body = n => ['Hi Dana,', `${Array.from({ length: n - 12 }, () => 'word').join(' ')}.`, 'Would you be open to a quick call?', 'Cheers,\nKrish'].join('\n\n');
  assert.equal(coldNoteHold({ ...base, body: body(COLD_WORDS_MAX - 1) }), null);
  assert.equal(coldNoteHold({ ...base, body: body(COLD_WORDS_MAX) }), 'cold_note_invalid');
});

test('one ask and at most one link: none, two questions, a question and a request, two links, a footer or an address are each held', () => {
  const ok = coldAction({ c: { id: id(1), name: 'Dana Example' }, fact: { kind: 'post', text: 'Most AI pilots stall in procurement.' }, sourceLine: SOURCE_LINES.post });
  assert.equal(coldNoteHold(ok), null);
  const swap = body => ({ ...ok, body });
  assert.equal(coldNoteHold(swap(`${ok.body} See https://one.example.test/a for more.`)), null, 'one link');
  for (const [why, body] of [
    ['no ask', 'Hi Dana,\n\nA note.\n\nCheers,\nKrish'],
    ['two questions', 'Hi Dana,\n\nDid you see it? Would you be open to a quick call?\n\nCheers,\nKrish'],
    ['a question and a request', 'Hi Dana,\n\nLet me know what you think. Would you be open to a quick call?\n\nCheers,\nKrish'],
    ['two links', `${ok.body} https://one.example.test/a and https://two.example.test/b`],
    ['a footer', `${ok.body}\n\nReply STOP to opt out.`],
    ['an unsubscribe line', `${ok.body}\n\nUnsubscribe here.`],
    ['an address', `${ok.body}\n\nWrite to someone@northwind1.test.`],
  ]) assert.equal(coldNoteHold(swap(body)), 'cold_note_invalid', why);
});

test('the source line is one plain line of 200 characters or fewer, with no link or address, on an email for his own box only', () => {
  const ok = coldAction({ c: { id: id(1), name: 'Dana Example' }, fact: { kind: 'post', text: 'Most AI pilots stall in procurement.' }, sourceLine: SOURCE_LINES.post });
  for (const line of Object.values(SOURCE_LINES)) { assert.ok(line.length <= SOURCE_LINE_MAX && !/https?:|www\.|@|\n/.test(line)); assert.equal(coldNoteHold({ ...ok, cold: { source_line: line } }), null); }
  for (const bad of [undefined, '', 'x'.repeat(SOURCE_LINE_MAX + 1), 'I read https://northwind1.test', 'I read www.northwind1.test', 'someone@northwind1.test listed you', 'one\ntwo']) {
    assert.equal(coldNoteHold({ ...ok, cold: { source_line: bad } }), 'cold_note_invalid', String(bad));
  }
  assert.equal(coldNoteHold({ ...ok, cold: undefined }), 'cold_note_invalid');
  assert.equal(coldNoteHold({ ...ok, mailbox: 'jonny' }), 'cold_note_invalid', "never Jonny's box");
  assert.equal(coldNoteHold({ ...ok, channel: 'whatsapp' }), 'cold_note_invalid');
  assert.equal(coldNoteHold({ ...ok, kind: 'show_notes_ask' }), 'cold_note_invalid');
});

// ── One follow-up only ──────────────────────────────────────────────────────

const FIRST = `${COLD_PREFIX}${'b'.repeat(32)}`;
const sentNote = (over = {}) => ({ contact_id: id(1), mailbox: 'krish', job: 'morning', proposal_id: FIRST, created_at: ago(6 * D), sent_at: ago(5 * D), ...over });
const opened = (over = {}) => ({ proposal_id: FIRST, recipient_opened: true, first_recipient_opened_at: ago(4 * D), ...over });
const newPost = n => row(n, { facts: [{ kind: 'post', text: 'Our procurement team now runs every AI pilot.', source_url: 'https://posts.example.test/new', observed_at: ago(2 * D) }] });
const followCtx = ({ note = {}, open = {}, rows = [newPost(1)], extra = [] } = {}) => ctx(rows, { asset_opens: { links: [opened(open)] } }, { drafts: [sentNote(note), ...extra] });

test('one follow-up after an open Control Center proved, with a fact new since the note, naming the note and never the open', () => {
  const out = run(followCtx());
  assert.deepEqual([out.held, out.rows.length, out.counts.follow_ups], [[], 1, 1]);
  const p = out.rows[0].proposal, a = action(p);
  assert.ok(p.proposal_id.startsWith(FOLLOW_PREFIX));
  assert.deepEqual([a.kind, a.follows, a.mailbox, a.recipient_contact_id], ['follow_up', FIRST, 'krish', id(1)]);
  assert.ok(a.cold?.source_line);
  assert.match(a.body, /Our procurement team now runs every AI pilot\./);
  assert.equal(coldNoteHold(a), null);
  assert.equal(coldNoteHold({ ...a, body: a.body.replace('A short follow-up', 'I saw you opened my note. A short follow-up') }), 'cold_note_invalid', 'never the open');
  assert.equal(coldNoteHold({ ...a, follows: undefined }), 'cold_note_invalid');
});

test('no follow-up without its proof or past its rules: too soon, answered, bounced, opted out, a deal, a second one, an unread or own open, or the feature unserved', () => {
  const count = (o, over = {}) => run(followCtx(o), over).rows.filter(r => r.proposal.proposal_id.startsWith(FOLLOW_PREFIX)).length;
  assert.equal(count({}), 1);
  assert.equal(count({ note: { sent_at: ago(2 * D) }, open: { first_recipient_opened_at: ago(D) } }), 0, 'under three days');
  assert.equal(count({ note: { replied_at: ago(D) } }), 0, 'a reply');
  assert.equal(count({ note: { bounced_at: ago(4 * D) } }), 0, 'a bounce');
  assert.equal(count({ note: { opted_out_at: ago(D) } }), 0, 'an opt-out');
  assert.equal(count({ open: { recipient_opened: null } }), 0, 'a recipient class not told apart is no proof');
  assert.equal(count({ open: { first_recipient_opened_at: ago(6 * D) } }), 0, 'an open before the send');
  assert.equal(count({ open: { proposal_id: 'gmw-other' } }), 0, "another note's link");
  assert.equal(count({ extra: [{ contact_id: id(1), mailbox: 'krish', job: 'morning', proposal_id: `${FOLLOW_PREFIX}${'c'.repeat(32)}`, created_at: ago(D) }] }), 0, 'no chains');
  const deal = followCtx(); deal.records.deals.push({ contact_id: id(1) });
  assert.equal(run(deal).rows.length, 0, 'an open deal');
  assert.equal(count({}, { capabilities: CAPS({}, { follow_up: false }) }), 0, 'features.follow_up');
  assert.equal(count({}, { capabilities: CAPS({ schema_versions: ['1.39.0'] }) }), 0, 'the version that carries it');
  // A note never gets a second first note either.
  assert.deepEqual(run(followCtx({ open: { recipient_opened: null } })).held, ['cold_excluded']);
});

test('a follow-up with nothing new since the note holds as cold_nothing_specific', () => {
  const out = run(followCtx({ rows: [row(1)] }));
  assert.deepEqual([out.held, out.rows.length], [['cold_nothing_specific'], 0]);
});

// ── At most three a New York day ────────────────────────────────────────────

test(`at most ${COLD_SLOTS_PER_DAY} slots a New York day, follow-ups first; a tighter cap wins`, () => {
  assert.equal(COLD_SLOTS_PER_DAY, 3);
  const rows = [1, 2, 3, 4, 5].map(n => row(n));
  const out = run(ctx(rows));
  assert.equal(out.rows.length, 3);
  assert.deepEqual(out.held, ['cold_daily_cap', 'cold_daily_cap']);
  assert.equal(run(ctx(rows), { cap: 1 }).rows.length, 1, "the week spec's REACH OUT cap");
  assert.equal(run(ctx(rows), { cap: 0 }).rows.length, 0, 'REACH OUT turned off');
  assert.equal(run(ctx(rows), { capabilities: { ...CAPS(), cold_email: { ...CAPS().cold_email, per_day: 2 } } }).rows.length, 2, "Control Center's own cap");
  assert.equal(run(ctx(rows), { cap: 30 }).rows.length, 3, 'never past three');
  // A follow-up takes its slot first.
  const m = run(followCtx({ rows: [newPost(1), row(2), row(3), row(4)] }));
  assert.equal(m.rows.length, 3);
  assert.ok(m.rows[0].proposal.proposal_id.startsWith(FOLLOW_PREFIX));
  assert.deepEqual(m.held, ['cold_daily_cap']);
});

test("repeat dispatches share the day: drafts made today and earlier reports' slots count, the same proposal keeps its slot, and the day is New York's", () => {
  const rows = [1, 2, 3, 4, 5].map(n => row(n));
  const first = run(ctx(rows));
  const line = coldLine({ counts: first.counts, before: first.before, posted: first.rows.map(r => r.proposal) });
  assert.match(line, /^Cold lane: 5 people read, 3 proposed \(0 follow-ups\), 2 held, 0 research asks; 3 of 3 slots taken this New York day \(slots [0-9a-f]{8} [0-9a-f]{8} [0-9a-f]{8}\)\.$/);
  // The same run again: the same three, the same ids and words, and no new slot.
  const again = run(ctx(rows), { history: [{ accepted_at: ago(H), activity: [{ line }] }] });
  assert.deepEqual(again.rows.map(r => r.proposal.proposal_id), first.rows.map(r => r.proposal.proposal_id));
  assert.deepEqual(again.rows.map(r => r.proposal.exact_payload), first.rows.map(r => r.proposal.exact_payload));
  assert.equal(again.used.size, 3);
  // Three taken by other notes earlier today: none left.
  const other = coldLine({ counts: first.counts, before: new Set(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']) });
  assert.equal(run(ctx(rows), { history: [{ accepted_at: ago(H), activity: [{ line: other }] }] }).rows.length, 0);
  // Yesterday's report, in New York time, takes nothing today; a report with no time read is counted.
  const yesterday = new Date(Date.parse(`${nyDay(NOW)}T04:00:00Z`) - H).toISOString();
  assert.notEqual(nyDay(yesterday), nyDay(NOW));
  assert.equal(run(ctx(rows), { history: [{ accepted_at: yesterday, activity: [{ line: other }] }] }).rows.length, 3);
  assert.equal(run(ctx(rows), { history: [{ activity: [{ line: other }] }] }).rows.length, 0);
  // Two cold notes drafted today in New York take two slots.
  const drafted = ctx(rows, {}, { drafts: [6, 7].map(n => ({ contact_id: id(n), mailbox: 'krish', job: 'morning', proposal_id: `${COLD_PREFIX}${String(n).repeat(32)}`, created_at: ago(2 * H) })) });
  assert.equal(run(drafted).rows.length, 1);
});

// ── The seven-day pause, from the drafts ────────────────────────────────────

const coldDraft = (n, over = {}) => ({ contact_id: id(100 + n), mailbox: 'krish', job: 'morning', proposal_id: `${COLD_PREFIX}${n.toString(16).padStart(32, '0')}`, created_at: ago(8 * D), sent_at: ago((2 + (n % 4)) * D), ...over });

test("bounces over 3% of the last seven days' cold sends pause the lane for seven days", () => {
  const sends = Array.from({ length: 10 }, (_, n) => coldDraft(n));
  assert.equal(coldPause(sends, NOW).paused, false);
  const bounced = sends.map((d, n) => (n === 0 ? { ...d, bounced_at: ago(D) } : d));
  assert.equal(coldPause(bounced, NOW).paused, true, '1 in 10 is over 3%');
  assert.deepEqual(run(ctx([row(1)], {}, { drafts: bounced })).held, ['cold_paused']);
  const many = Array.from({ length: 40 }, (_, n) => coldDraft(n, { sent_at: ago(2 * D) }));
  assert.equal(coldPause(many.map((d, n) => (n === 0 ? { ...d, bounced_at: ago(D) } : d)), NOW).paused, false, '1 in 40 is under 3%');
  // Seven days after the bounce, the pause is over.
  assert.equal(coldPause(sends.map((d, n) => ({ ...d, sent_at: ago(20 * D), ...(n === 0 ? { bounced_at: ago(8 * D) } : {}) })), NOW).paused, false);
});

test('three opt-outs or negative replies in a week pause the lane; an unclassified reply is unknown, never zero, and holds as cold_history_unread', () => {
  const three = [0, 1, 2].map(n => coldDraft(n, { opted_out_at: ago((n + 1) * D) }));
  assert.equal(coldPause(three, NOW).paused, true);
  assert.deepEqual(run(ctx([row(1)], {}, { drafts: three })).held, ['cold_paused']);
  assert.equal(coldPause(three.slice(0, 2), NOW).paused, false);
  const replies = [coldDraft(0, { opted_out_at: ago(D) }), coldDraft(1, { opted_out_at: ago(D) }), coldDraft(2, { replied_at: ago(D) })];
  assert.deepEqual([coldPause(replies, NOW).paused, coldPause(replies, NOW).unknown], [false, true]);
  assert.deepEqual(run(ctx([row(1)], {}, { drafts: replies })).held, ['cold_history_unread']);
  assert.equal(coldPause(replies, NOW, { replyClass: d => (d.replied_at ? 'negative' : null) }).paused, true, 'a served negative class counts');
  assert.equal(coldPause(replies, NOW, { replyClass: d => (d.replied_at ? 'interested' : null) }).paused, false, 'any other class does not');
  assert.equal(coldPause([coldDraft(0, { opted_out_at: ago(D), replied_at: ago(D) }), coldDraft(1, { opted_out_at: ago(D) })], NOW).unknown, false, 'an opt-out reply is counted once');
});

test('history that cannot be proved read holds every cold note as cold_history_unread', () => {
  assert.deepEqual(run(ctx(), { history: null }).held, ['cold_history_unread'], 'the recent reports unread');
  assert.deepEqual(run(ctx(), { capabilities: CAPS({}, { mail_outcomes: false }) }).held, ['cold_history_unread'], 'what became of each draft unserved');
  const noDrafts = ctx(); delete noDrafts.records.drafts;
  assert.deepEqual(run(noDrafts).held, ['cold_history_unread'], 'the drafts unread');
  assert.deepEqual(run(ctx([row(1)], { coverage: [{ source: 'drafts', available: true, complete: false }] })).held, ['cold_history_unread'], 'the drafts short');
  assert.deepEqual(run(ctx([row(1)], {}, { drafts: [{ mailbox: 'krish', proposal_id: `${COLD_PREFIX}${'d'.repeat(32)}`, created_at: ago(3 * D) }] })).held, ['cold_history_unread'], 'a cold draft with no person');
  assert.equal(coldHistory({ context: ctx(), capabilities: CAPS(), history: [], at: NOW }).read, true);
});

// ── Counts only ─────────────────────────────────────────────────────────────

test("the lane's line and holds carry counts and codes, never a name, an address or a source", () => {
  const out = run(ctx([row(1), row(2, { sells_competing_services: true })]));
  const line = coldLine({ counts: out.counts, before: out.before, posted: out.rows.map(r => r.proposal) });
  const said = [line, ...coldHolds(out.held).map(h => `${h.reason} ${h.detail}`)].join(' ');
  assert.equal(/Dana|Example|Northwind|northwind|posts\.example|@/.test(said), false);
  assert.deepEqual(coldHolds(['cold_daily_cap', 'cold_daily_cap', 'cold_excluded']), [
    { reason: 'cold_daily_cap', detail: '2 possible cold emails held: daily cap.' },
    { reason: 'cold_excluded', detail: '1 possible cold email held: excluded.' },
  ]);
  for (const code of COLD_HOLDS) assert.match(code, /^cold_[a-z_]+$/);
});

// ── In the daily dispatch ───────────────────────────────────────────────────

const GOALS = ['Have a clear plan for driving partnerships and visibility for Mindmake'];
const SERVED = ['1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.38.0', '1.39.0'];
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
async function dispatchOnce({ features = {}, served = SERVED, eligibility, recent = [], morningCheck, voiceCheck, rows = [row(1), row(2)] } = {}) {
  const reports = [];
  const caps = { activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true, network_routes: true, cold_email: true, mail_outcomes: true, recent_reports: true, ...features }, cold_email: CAPS().cold_email };
  const context = { schema_version: '1.39.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }],
    records: { advisory: [], visibility: [], drafts: [], guests: [], deals: [], brief_takers: [] }, network: rows, amplifier_candidates: [], routes: Object.fromEntries(rows.map(r => [r.contact_id, route()])), feedback: [], research: [] };
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }), capabilities: async () => caps,
    context: async () => ({ ok: true, context }), decisions: async () => [], recentReports: async () => recent,
    postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1), ...(voiceCheck ? { voiceCheck } : {}) };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-cold-lane-1234', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'c'.repeat(40) }], recordReader: async () => null,
    complianceReader: async ({ at, footer }) => gateState({ config: CONFIG, optOuts: null, at, footer }), ...(eligibility ? { coldEligibility: eligibility } : {}), ...(morningCheck ? { morningCheck } : {}) });
  return { result, report: reports[0] };
}
const coldOf = report => report.proposals.filter(isColdProposal);
const coldLineOf = report => report.activity.map(a => a.line).find(l => l.startsWith('Cold lane: '));

test('in the daily dispatch: no parallel sender, the report raised to 1.39.0, every cold note in his own box, counts only', async () => {
  const { result, report } = await dispatchOnce({ eligibility: ELIGIBLE });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(violations(schema, report), []);
  assert.equal(report.schema_version, COLD_VERSION);
  const cold = coldOf(report);
  assert.equal(cold.length, 2);
  for (const p of cold) {
    const a = action(p);
    assert.deepEqual([a.mailbox, a.channel, p.row, p.wall, p.stage], ['krish', 'email', 'reach_out', 'send', null]);
    assert.equal(coldNoteHold(a), null);
    assert.ok(p.source_revision.some(f => f.path === 'src/stages/cold.mjs'));
    assert.equal('name' in p, false);
  }
  assert.deepEqual([result.sends, result.gmail_drafts], [0, 0], 'nothing sent or drafted by the engine');
  const line = coldLineOf(report);
  assert.match(line, /^Cold lane: 2 people read, 2 proposed \(0 follow-ups\), 0 held, 0 research asks; 2 of 3 slots taken this New York day \(slots [0-9a-f]{8} [0-9a-f]{8}\)\.$/);
  assert.equal(/Dana|Northwind|northwind|@/.test(line), false);
  // A repeat dispatch the same New York day reads the first one's line: the same two, no new slot.
  const again = await dispatchOnce({ eligibility: ELIGIBLE, recent: [{ run_id: 'x', accepted_at: ago(H), status: 'ready', activity: report.activity }] });
  assert.deepEqual(coldOf(again.report).map(p => p.proposal_id), cold.map(p => p.proposal_id));
  assert.equal(coldLineOf(again.report), line);
});

test("in the daily dispatch, today's served record holds every cold note by name, and where cold email is not served nothing changes", async () => {
  const { report } = await dispatchOnce();
  assert.equal(coldOf(report).length, 0);
  assert.deepEqual(report.holds.find(h => h.reason === 'cold_country_unknown'), { reason: 'cold_country_unknown', detail: '2 possible cold emails held: country unknown.' });
  assert.match(coldLineOf(report), /^Cold lane: 2 people read, 0 proposed .*0 of 3 slots taken this New York day\.$/);
  assert.notEqual(report.schema_version, COLD_VERSION);
  const off = await dispatchOnce({ eligibility: ELIGIBLE, features: { cold_email: false } });
  assert.equal(coldLineOf(off.report), undefined);
  assert.equal(coldOf(off.report).length, 0);
  const old = await dispatchOnce({ eligibility: ELIGIBLE, served: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'] });
  assert.equal(coldLineOf(old.report), undefined, 'a Control Center that does not take 1.39.0 gets no cold note');
  assert.equal(takesCold({ features: { cold_email: true }, schema_versions: ['1.38.0'] }), false);
});

test('in the daily dispatch, a cold note goes through the morning QA and the voice check like every email for his box', async () => {
  const qa = await dispatchOnce({ eligibility: ELIGIBLE, morningCheck: ps => ps.filter(isColdProposal).map(p => ({ proposal_id: p.proposal_id, reason: 'morning_claim_untraced', kinds: ['name'], held: true })) });
  assert.equal(coldOf(qa.report).length, 0);
  assert.ok(qa.report.holds.some(h => h.reason === 'morning_claim_untraced'));
  assert.match(coldLineOf(qa.report), /0 proposed .*0 of 3 slots taken/, 'a held note takes no slot');
  // The real QA passes the lane's own words: its fixed lines are its vocabulary, and the quoted post is on their record.
  const real = await dispatchOnce({ eligibility: ELIGIBLE });
  assert.equal(real.report.holds.some(h => /^morning_/.test(h.reason)), false);
  const asked = [];
  const voice = await dispatchOnce({ eligibility: ELIGIBLE, features: { voice_check: true }, voiceCheck: async w => { asked.push(w); return { hard: /quick call/.test(w.text) ? [{ rule: 'synthetic_rule' }] : [] }; } });
  assert.ok(asked.some(w => w.channel === 'email' && /quick call/.test(w.text)));
  assert.equal(coldOf(voice.report).length, 0);
  assert.ok(voice.report.holds.some(h => h.reason === 'voice_refused'));
});

test('a report with no cold note stays at its own version', () => {
  const base = { run_id: 'mindmake:2026-11-16:dispatch', mode: 'live', observed_at: NOW, source: { revision: 'r', captured_at: NOW }, status: 'ready', objectives: [], activity: [], holds: [] };
  assert.equal(buildReport({ ...base, proposals: [] }).schema_version, '1.2.0');
});
