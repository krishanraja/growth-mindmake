import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { amplifierRows, rankRows, sharedBodies, bodySkeleton, sentenceSkeletons, companyAsWritten, plainWords, possessive, portfolioNames, yourWork, shownLine, shownHistory, shortId, cardClash, employersIn, sameOrg, specificOf, historyOf, sharedPlace, fundOf, youFact, titleNaming, givenParts, brokenSentence, brokenEmails, shorterNames, WORDS, actionFor } from '../src/stages/rows.mjs';
import { pitchRows, lookupRequests, uniqueStages, stageKeys, guestIdea } from '../src/stages/pitches.mjs';

// Krish, 2026-11-06: "The widget is not updating regularly ... One of them is just a blank card and the
// other two are duplicates ... The email drafts are super generic and rubbish." Synthetic only.
const NOW = '2026-11-06T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you'll need. |\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const route = () => ({ email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false });
const EM = String.fromCharCode(8212);
const tie = (n, over = {}) => ({ contact_id: id(n), network_tier: '1_reciprocated', mindmake_fit: 70, known_since: '2019-03-01', email_last: '2024-06-10', current_title: 'Chief Data Officer', current_company: `Example Firm ${n}`,
  contacts: { full_name: `Robin Sample${n}`, status: 'active', company: `Example Firm ${n}` }, ...over });
const body = p => JSON.parse(p.exact_payload).body;

test('a catch-up is about one fact on its card and no two share more than one sentence once names, companies, roles and dates are out', () => {
  // Shaped like the live cards of 6 November: a why line that names their work, a move, a fact that opens on its verb, a post.
  const ties = [
    tie(1, { why_them: 'His work chairing the Example Association\'s AI Taskforce.' }),
    tie(2, { hook: 'His move from Example Bank CMO to Other Bank CMO, plus running Example Alarm as CEO in between, is an unusually direct path.' }),
    tie(3, { who: 'Leads AI strategy and builds production agentic AI systems for recruiting/workforce operations at Example Staffing.' }),
    tie(4, { facts: [{ kind: 'post', text: 'Posted: "Boards are asking what AI should decide."', source_url: 'https://example.org/post/4', observed_at: '2026-10-01T00:00:00Z' }] }),
  ];
  const r = amplifierRows({ context: { network: ties, routes: Object.fromEntries(ties.map(t => [t.contact_id, route()])), feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW });
  const rows = r.rows.map(x => x.proposal).sort((x, y) => x.target.localeCompare(y.target));
  assert.equal(rows.length, 4);
  const [a, b, c, d] = rows.map(body);
  assert.match(a, /I'd like to hear how your work chairing the Example Association's AI Taskforce is going\./);
  assert.match(b, /I'd like to hear how your move from Example Bank CMO to Other Bank CMO is going/, 'the judgement and the clause after it are cut');
  assert.match(c, /I hear you lead AI strategy and build production agentic AI systems for recruiting and workforce operations at Example Staffing/, 'a slash in plain words');
  assert.match(d, /I read your post, "Boards are asking what AI should decide", and I'd like to hear where your thinking has gone since\./);
  for (const x of [a, b, c, d]) {
    assert.match(x, /We go back to 2019 and last wrote in Jun 2024: up for a call in the next few weeks\?/);
    assert.equal(/these days|Been a while|what AI is changing at/.test(x), false, 'never the employer-slot template');
    assert.equal(x.includes(EM) || /\w\/\w/.test(x.replace(/https:\/\/\S+/g, '')), false, 'no em dash, no slash');
  }
  assert.deepEqual(sharedBodies(rows), [], 'each catch-up shares at most one sentence with any other');
  // A tie whose card names only their employer gets no email: that line is the same for everyone.
  const blank = amplifierRows({ context: { network: [tie(5)], routes: { [id(5)]: route() }, feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW });
  assert.equal(blank.rows.length, 0);
  assert.ok(blank.held.some(h => ['nothing_specific', 'thin_card'].includes(h)), blank.held.join());
});

test('the check fails when two emails share more than one sentence once every capitalised slot, number and link is out', () => {
  const mail = (n, lines) => ({ proposal_id: `gmw-${String(n).padStart(32, '0')}`, name: `Robin Sample${n}`, title: `Catch up with Robin Sample${n}`, exact_payload: JSON.stringify(actionFor('email', id(n), `Robin Sample${n}`, { subject: 's', lines })) });
  // The live template of 6 November: the employer, the year and the month were the only differences.
  const slot = n => mail(n, [`Saw you're at Example Firm ${n} these days. We go back to 20${10 + n}, and the last time we wrote was Jun 2026.`, `Up for a call in the next few weeks? I'd like to hear what AI is changing at Example Firm ${n}, and I'll tell you what I'm seeing with leaders.`]);
  assert.equal(sharedBodies([slot(1), slot(2), slot(3)]).length, 2, 'the slot-filled catch-up is one email three times');
  const own = (n, fact) => mail(n, [`I'd like to hear where your work on ${fact} has got to.`, 'We go back to 2019 and last wrote in Jun 2024: up for a call in the next few weeks?']);
  assert.deepEqual(sharedBodies([own(1, 'bringing ads into agentic commerce'), own(2, 'chairing the taskforce on AI in advertising')]), [], 'one shared sentence is allowed');
  assert.deepEqual(sentenceSkeletons('Hi Avery,\n\nRead that you run Example Forum for 300 CEOs in Jun 2024.\n\nKrish', ['Avery Example']), ['that you run for in']);
  assert.deepEqual(sharedBodies([{ proposal_id: 'gmp-1', exact_payload: JSON.stringify({ channel: 'form', body: 'x' }) }, { proposal_id: 'gmp-2', exact_payload: JSON.stringify({ channel: 'form', body: 'x' }) }]), [], 'a form is never compared');
});

test('partners: each offer names its own portfolio and a decision no other partner in the run gets, with no pasted site line and no "s\'s"', () => {
  const vc = (n, extra) => ({ contact_id: id(60 + n), network_tier: '3_known', current_title: 'General Partner', current_company: `Example ${n} Ventures`, mindmake_fit: 80, sells_competing_services: false, plays: [], roles: [], followers: 20000,
    contacts: { id: id(60 + n), full_name: `Avery Partner${n}`, title: 'General Partner', company: `Example ${n} Ventures`, company_domain: `v${n}.test`, status: 'active' }, ...extra });
  const people = [vc(1, { why_them: 'His portfolio across energy (Example Grid, Example Solar, Example Data).' }), vc(2, { hook: 'His board seats at Example Alpha and Example Labs.' }), vc(3, { who: 'COO of Example 3 Ventures, a portfolio company spanning ecommerce, hospitality, media and property.', hook: 'Its portfolio reshaped with two exits and one launch this year.' }), vc(4, { hook: 'Backs seed-stage AI founders outside the big cities.' }), vc(5, { hook: 'Backs seed-stage AI founders in health.' })];
  const r = amplifierRows({ context: { amplifier_candidates: people, routes: Object.fromEntries(people.map(p => [p.contact_id, route()])), feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW });
  const offers = r.rows.map(x => x.proposal).filter(p => p.row === 'partners');
  assert.equal(offers.length, 5);
  const bodies = offers.map(body);
  const decisions = bodies.map(b => /one decision: ([^.]+)\./.exec(b)?.[1]);
  assert.equal(new Set(decisions).size, decisions.length, `no decision twice: ${decisions.join(' | ')}`);
  assert.ok(bodies.some(b => b.includes('founders like Example Grid, Example Solar and Example Data')));
  assert.ok(bodies.some(b => b.includes('founders like Example Alpha and Example Labs')));
  assert.ok(bodies.some(b => b.includes('a portfolio spanning ecommerce, hospitality, media and property')));
  for (const b of bodies) {
    assert.equal(/in our site's words|It comes out of what Mindmake does/.test(b), false, 'no pasted site line');
    assert.equal(/s's\b/.test(b), false, 'no "Ventures\'s"');
  }
  assert.deepEqual(sharedBodies(offers), []);
  assert.equal(possessive('Example Ventures'), "Example Ventures'");
});

test('company names as their record writes them, never miscased', () => {
  assert.equal(companyAsWritten('examplenbc', ["Leads AI across ExampleNBC's News Group."]), 'ExampleNBC');
  assert.equal(companyAsWritten('u.s. example bank', ['CMO of U.S. Example Bank, overseeing brand.']), 'U.S. Example Bank');
  assert.equal(companyAsWritten('Example Ai', []), 'Example AI');
  assert.equal(companyAsWritten('Exampleblue Inc.', ['Builds agents at ExampleBlue.']), 'ExampleBlue');
  assert.equal(companyAsWritten('u.s. example bank', []), 'U.S. Example Bank');
  assert.equal(plainWords('coaching/speaking and Founder/CEO, https://a.example/b and and/or'), 'coaching and speaking and Founder and CEO, https://a.example/b and and/or');
});

test('a card that names two employers as current is held and asked about, never shown', () => {
  const card = { who: 'Avery Example is Chief Data Officer at Example Broadcasting.', why: ['Avery Example leads data partnerships at Example Stock Exchange Group.'] };
  assert.deepEqual(cardClash(card, 'Example Broadcasting'), ['Example Broadcasting', 'Example Stock Exchange Group']);
  assert.equal(cardClash({ who: 'Avery is Partner at Northwind Capital.', why: ['Previously led sales at Example Bank.', 'Sits on the board of Example Trust.'] }, 'Northwind Capital'), null, 'a past role and a board seat are not where they work now');
  assert.ok(sameOrg('London Example Exchange Group', 'LEEG'), 'initials are the same organisation');
  assert.ok(sameOrg('Example Broadcasting Ltd', 'example broadcasting'));
  assert.deepEqual(employersIn('Works at Example Retail. Spoke at Example Summit.'), ['Example Retail']);
  const stale = tie(5, { who: 'Robin Sample5 is Chief Data Officer at Example Broadcasting.', hook: 'Robin Sample5 leads data partnerships at Example Stock Exchange Group.' });
  const r = amplifierRows({ context: { network: [stale], routes: { [id(5)]: route() }, feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW });
  assert.equal(r.rows.length, 0);
  assert.ok(r.held.includes('facts_disagree'));
  assert.ok(r.research.some(q => q.request_id.startsWith(`profile:${id(5)}:`)), 'who they are is asked again');
});

test('each run brings new suggestions: what recent runs showed and he has not acted on goes behind what he has not seen', () => {
  const entry = (n, score) => ({ score, proposal: { proposal_id: `gmw-${String(n).repeat(8).slice(0, 8)}${'0'.repeat(24)}`, row: 'network', name: 'x' } });
  const list = [entry(1, 9), entry(2, 8), entry(3, 7)];
  const lanes = { reach_out: { on: true, max: 2 }, network: { on: true, max: 2 }, visibility: { on: true, max: 2 }, events: { on: true, max: 2 }, partners: { on: true, max: 2 } };
  assert.deepEqual(rankRows(list, lanes).kept.map(p => p.proposal_id.slice(4, 5)), ['1', '2'], 'by score when nothing was shown');
  const line = shownLine([{ proposal_id: list[0].proposal.proposal_id }, { proposal_id: list[1].proposal.proposal_id }]);
  assert.equal(line, `Shown: ${shortId(list[0].proposal.proposal_id)} ${shortId(list[1].proposal.proposal_id)}.`);
  const seen = shownHistory([{ activity: [{ line }] }, { activity: [{ line }] }]);
  assert.equal(seen(list[0].proposal.proposal_id), 2);
  assert.deepEqual(rankRows(list, lanes, seen).kept.map(p => p.proposal_id.slice(4, 5)), ['3', '1'], 'the unseen one first, then the best of the rest');
  assert.equal(shownHistory(null), null, 'unread reports are unknown, never an empty history');
});

test('one event, one row; a title always names its subject; a lookup reaches a subject not yet asked first', () => {
  const s = (n, over) => ({ id: id(n), title: 'The AI Leadership Summit', type: 'conference', event_start_at: '2026-11-17T09:00:00Z', ...over });
  const { kept, dupes } = uniqueStages([s(1, { booking_contact_id: id(90) }), s(2, { title: 'AI Leadership Summit 2026' }), s(3, { title: 'The AI Leadership Summit', event_start_at: '2027-11-17T09:00:00Z' })]);
  assert.deepEqual(kept.map(t => t.id), [id(1), id(3)], 'the same name on another day is another event');
  assert.deepEqual([...dupes], [id(2)]);
  assert.ok(stageKeys(s(1)).some(k => k === 'name:stage:ai leadership summit:2026-11-17'));
  const long = 'Leading Across the Example Suite: Marketing, Communications, Technology and Data (The Example Board)';
  assert.deepEqual(shorterNames(long).slice(0, 3), [long, 'Leading Across the Example Suite: Marketing, Communications, Technology and Data', 'Leading Across the Example Suite']);
  assert.equal(titleNaming(56, n => `Apply to speak at ${n}`, long), 'Apply to speak at Leading Across the Example Suite');
  assert.equal(titleNaming(34, n => `Ask to go on ${n}`, 'The Extraordinarily Long Example Podcast Name'), 'Ask to go on The Extraordinarily');
  const c = (key, tried, score) => ({ lane: 'stage', key, base: `booking:${key}`, score, subject_ref: `target:${key}`, query: `Who takes speaker submissions for ${key}?`, why: 'Held for want of a booking address.', state: { state: tried ? 'nothing' : 'none', tried } });
  const r = lookupRequests({ stages: [c('a', 1, 9), c('b', 0, 1)], at: NOW, max: 1 });
  assert.deepEqual(r.requests.map(q => q.subject_ref), ['target:b'], 'a stage never asked about comes before one asked again in other words');
});

test('a speaking pitch says the room, the talk and when the call closes; a podcast pitch says who listens and one episode', () => {
  const t = n => ({ id: id(n), title: `The Example Summit ${n}`, type: 'conference', status: 'queued', verdict: 'take', organizer: 'Example Events Ltd', event_url: `https://summit.example/${n}`, deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-03-10T00:00:00Z', location: 'London', booking_contact_id: id(700 + n), audience: n === 1 ? 'Chief marketing officers' : 'Finance leaders in insurance' });
  const p = n => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', verdict: 'take', organizer: 'Example Media', episodes: 50, latest_episode_at: '2026-10-30T00:00:00Z', booking_contact_id: id(800 + n), audience: n === 11 ? 'Media executives' : 'Venture investors and founders', angle: n === 11 ? 'Its last episode asked who owns AI in a newsroom.' : 'Its founders keep asking how to price AI features.' });
  const out = pitchRows({ context: { records: { visibility: [t(1), t(2), p(11), p(12)], drafts: [] }, routes: Object.fromEntries([701, 702, 811, 812].map(n => [id(n), { in_network: false }])), feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW, networkRoutes: true });
  const speak = out.proposals.filter(x => x.row === 'events').map(body);
  assert.equal(speak.length, 2);
  assert.match(speak[0], /built for the room it gathers, (?:chief marketing officers|finance leaders in insurance)/);
  assert.match(speak[0], /before your call closes on 20 Nov/);
  assert.notEqual(/"([^"]+)"/.exec(speak[0])[1], /"([^"]+)"/.exec(speak[1])[1], 'no two stages are offered the same talk');
  const pods = out.proposals.filter(x => x.row === 'visibility').map(body);
  assert.equal(pods.length, 2);
  assert.match(pods.join('\n'), /The Example Show 11's listeners, media executives, "What a media business sells once AI can make the content"; would you have him on\?/);
  assert.match(pods.join('\n'), /Its last episode asked who owns AI in a newsroom\./, 'the angle Nova read for this show');
  assert.deepEqual(sharedBodies(out.proposals), []);
  for (const x of [...speak, ...pods]) assert.equal(x.includes(EM), false);
  assert.equal(youFact('Partner at Example Ventures.'), '', 'a sentence that is no deed is never turned into one');
});

test('the live misses of 6 November stay fixed: a past build at another firm holds the card, a portfolio stops at its sentence, a role gives an invite its episode', () => {
  // Shaped like the card Control Center flagged: who names one employer, why names work at another with no tense.
  assert.deepEqual(cardClash({ who: 'Leads AI strategy across ExampleNBC\'s News Group.', why: ['Her build at Example Exchange Group of an innovation function, tied to a 10-year deal.'] }, 'ExampleNBC'), ['ExampleNBC', 'Example Exchange Group']);
  assert.deepEqual(portfolioNames(['His newsletter and board seats at Example Alpha and Example Labs. Example Bird promoted two partners.']), ['Example Alpha', 'Example Labs']);
  assert.equal(yourWork('His move from Example Bank CMO to Other Bank CMO, plus running Example Alarm as CEO in between, is an unusually direct path.'), 'your move from Example Bank CMO to Other Bank CMO');
  assert.equal(guestIdea({ one_liner: 'CRO at Example AI' }, null, new Set()), 'What a revenue team looks like when AI does the prospecting');
  assert.equal(youFact('He runs the exact kind of curated events that are useful for reaching senior buyers.'), '', 'a judgement written for Krish is never said to them');
});

test('the live read after #61: a funding stage is no company, a trainer is named by their own firm, and an invite idea stops at its field', () => {
  assert.deepEqual(portfolioNames(['Backs founders from (Seed and Series F).', 'Board seats at Example One and Example Two.']), ['Example One', 'Example Two']);
  const trainer = WORDS.partner[0]({ kind: 'ai_trainer', company: 'Example Academy', decision: 'which teams to retrain first' }, canon);
  assert.equal(trainer.lines[0], 'At Example Academy you train people to use AI, and the part that stalls is what happens once the course ends, when nobody decides which teams to retrain first.');
  assert.equal(guestIdea({ one_liner: 'The guy who joined the Example chapter and warns tools want to be your fulcrum', why_fit: 'He runs retail media for Example Exchange.' }, null, new Set()), 'Why tools want to be your fulcrum');
});

// Live read of 6 November, second pass: a day job is no portfolio, and a catch-up names the place you both worked.
test('a partner email names a fund only when it is one, and a catch-up uses the ask line and the shared employer', () => {
  assert.equal(fundOf('Example Tax Office', ['Founder of Example Shop, angel investor, and a brief stint at the Example Tax Office.']), '');
  assert.equal(fundOf('Northwind Capital', []), 'Northwind Capital');
  assert.equal(fundOf('Example Studio', ['Example Studio backs early founders.']), 'Example Studio');
  const angel = WORDS.partner[0]({ kind: 'investor', company: 'Example Tax Office', fund: '', decision: 'where the AI budget goes' }, canon);
  assert.equal(angel.subject, 'One decision for the founders you back');
  assert.ok(!/Tax Office/.test(angel.lines.join(' ')));
  assert.equal(sharedPlace(['They have worked at Example Media as Group Manager, where you also worked.']), 'Example Media');
  assert.equal(historyOf({ known_since: '2015-03-01', email_last: '2025-05-02' }, { why: ['They have worked at Example Media as Group Manager, where you also worked.'] }), 'We both worked at Example Media, go back to 2015 and last wrote in May 2025: up for a call in the next few weeks?');
  assert.equal(historyOf({ email_last: '2025-05-02' }), 'We last wrote in May 2025: up for a call in the next few weeks?');
  assert.equal(specificOf({ who: 'Leads strategy at Example Co.' }, { why: ['Ask about the shift from running two agencies to leading commerce at Example Co.'] }), "I'd like to hear about the shift from running two agencies to leading commerce at Example Co.");
});

// Live read of 6 November, third pass: six of eight partner emails went to operators with no portfolio.
test('an operator is offered a session for their own leaders, and the grammar holds', async () => {
  const { backsFounders, quotesClosed } = await import('../src/stages/rows.mjs');
  assert.equal(backsFounders('', ['Co-founder and Co-CEO of Example Data, a customer data platform.']), false);
  assert.equal(backsFounders('', ['Founder of Example Shop, author and angel investor.']), true);
  const op = WORDS.partner[0]({ kind: 'investor', company: 'Example Data', backer: false, decision: 'what to build with AI in-house and what to buy' }, canon);
  assert.equal(op.subject, "One decision for Example Data's leaders");
  assert.equal(op.lines[0], "For the leaders at Example Data, I'd run a working session on one decision: what to build with AI in-house and what to buy.");
  const op2 = WORDS.partner[1]({ kind: 'investor', company: 'Example Data', backer: false, decision: 'which reports to hand to AI first' }, canon);
  assert.ok(op2.lines[0].startsWith("The call I'd help the leaders at Example Data make:"), op2.lines[0]);
  assert.equal(youFact('Leads corporate development at Example Studio, and co-hosts a podcast on growth deals.'), 'you lead corporate development at Example Studio, and co-host a podcast on growth deals');
  assert.equal(yourWork("Her framing that '80% of buyers"), '');
  assert.equal(quotesClosed("it's fine"), true);
  assert.deepEqual(employersIn('Fractional talent lead working with founder-led startups via her own practice, Example People.'), ['Example People']);
  assert.ok(cardClash({ who: 'Fractional talent lead working with founder-led startups via her own practice, Example People.', why: [] }, 'Example Meals'));
});

// Live read of 6 November, fourth pass (run merge-66): who backs founders, and lines written for Krish.
test('only someone who backs founders gets the founders wording, and a line written for Krish is never turned', async () => {
  const { backsFounders } = await import('../src/stages/rows.mjs');
  assert.equal(backsFounders('', ['Runs a talent consultancy placing senior hires into VC-backed startups.']), false);
  assert.equal(backsFounders('', ['Founder and Managing Partner of Example Policy, a governance firm.']), false);
  assert.equal(backsFounders('', ['Serial founder running a portfolio of media and recruitment businesses.']), false);
  assert.equal(backsFounders('', ['A venture platform building and backing seed-stage founders.']), true);
  assert.deepEqual(portfolioNames(['His thesis on founders (AI-era, Example One and Example Two).']), ['Example One', 'Example Two']);
  assert.equal(specificOf({ who: 'CRO at Example Data.' }, { why: ['Noticed your move from Example Ads to CRO at Example Data.'] }), "I saw your move from Example Ads to CRO at Example Data; I'd like to hear what you're changing first.");
  assert.equal(yourWork('His public-facing work (podcast, writing, speaking) also makes him a useful connector.'), 'your public-facing work (podcast, writing, speaking)');
  assert.equal(youFact('Runs North America for Example Data, whose entire business sits on measurement, the same ground Example Co works.'), 'you run North America for Example Data');
});

// Live read of 6 November, fifth pass (run merge-67): a credential in a title, a research aside, a clause verb.
test('a credential leaves the name, a which-aside leaves the fact, and an adverb before a verb ends the phrase', () => {
  assert.equal(givenParts('Avery Example, CMP').join(' '), 'Avery Example');
  assert.equal(givenParts('Avery Example, CMP, PhD').join(' '), 'Avery Example');
  assert.equal(youFact('Owns data revenue at Example Rewards and came from Example TV, which is precisely the seat Example Co needs to reach.'), 'you own data revenue at Example Rewards and came from Example TV');
  assert.equal(yourWork('Her current mandate explicitly pairs AI strategy with partnerships at Example News.'), 'your current mandate');
});

// Control Center's reads of 6 November: every sentence built from a card fact is read before it is proposed.
test('the final guard holds an email whose card sentence does not read as a sentence', () => {
  for (const [t, why] of [
    ["I'd like to hear how your current mandate explicitly pairs AI strategy with partnerships at Example News is going.", 'clause_in_phrase'],
    ["I'd like to hear how your background bridges loyalty marketing is going.", 'clause_in_phrase'],
    ["I'd like to hear how your bet that fractional work would explode is going.", 'clause_in_phrase'],
    ["I hear you congrat on the award, and I'd like to know how it's going.", 'krish_line_turned'],
    ["I hear you noticed your move to Example Data, and I'd like to know how it's going.", 'krish_line_turned'],
    ["I'd like to hear how your podcast also is going.", 'stray_also'],
    ['He would like to talk because you joined the chapter and warn tools want to be your fulcrum.', 'claim_without_that'],
    ["For founders like AI-era, I'd run a working session.", 'not_a_company'],
    ["For founders like Seed and Series F, I'd run a working session.", 'not_a_company'],
  ]) assert.equal(brokenSentence(t), why, t);
  for (const t of ["I'd like to hear how your public-facing work (podcast, writing, speaking) is going.", "For founders like Example One and Example Two, I'd run a working session.", 'you joined the chapter and warn that tools want to be your fulcrum.']) assert.equal(brokenSentence(t), '', t);
  const mk = (id, body) => ({ proposal_id: id, exact_payload: JSON.stringify({ body }) });
  assert.deepEqual(brokenEmails([mk('a', 'Hi A,\n\nI read your post, "New production soon, feat. Example", and I would like to hear more.\n\nKrish'), mk('b', "Hi B,\n\nI'd like to hear how your framing that '80% of buyers is going.\n\nKrish")]), [{ proposal_id: 'b', reason: 'open_quote' }]);
  assert.equal(yourWork('Her bet that fractional work would explode due to AI.'), '');
  assert.equal(youFact('Joined the Example chapter and warns tools want to be your fulcrum.'), 'you joined the Example chapter and warn that tools want to be your fulcrum');
  assert.equal(guestIdea({ one_liner: 'The guy who joined the Example chapter and warns tools want to be your fulcrum', why_fit: 'He runs retail media for Example Exchange.' }, null, new Set()), 'Why tools want to be your fulcrum');
});

// Control Center's read of the 12:18 live run: research notes, a verb by shape, a placeholder post, a bare list.
test('the guard reads research notes, verbs by shape, placeholder posts and bare lists', () => {
  for (const [t, why] of [
    ["I'd like to hear how your long internal trajectory suggests strong relationships across publishers is going.", 'clause_in_phrase'],
    ["I'd like to hear how your trajectory points the way markets move is going.", 'clause_in_phrase'],
    ["I hear you named contact at Example Bank, a large bank; role unknown, and I'd like to know how it's going.", 'research_note'],
    ["I hear you have already replied to Krish's email, and I'd like to know how it's going.", 'research_note'],
    ['I read your post, "Please suppress this post", and I would like to hear more.', 'not_a_post'],
    ["I'd like to hear how your run through Example One, Example Two is going.", 'bare_list'],
    ["I'd like to hear how your work on Example One and Example Two is going.", ''],
  ]) assert.equal(brokenSentence(t), why, t);
  assert.equal(specificOf({ facts: [{ kind: 'post', text: 'Posted: "Please suppress this post"' }] }, { why: [] }), '');
  assert.equal(youFact('Has already replied to Krish\'s email and sits on a committee.'), '');
});

// Live read of run merge-69: a phrase cut at its own verb.
test('a phrase cut at its own verb is not used and is held', () => {
  assert.equal(brokenSentence("I'd like to hear how your interest in how emerging AI tools is going."), 'clause_in_phrase');
  assert.equal(yourWork('Her interest in how emerging AI tools are changing retail.'), '');
  assert.equal(brokenSentence("I'd like to hear how your work chairing the Example Association's AI Taskforce is going."), '');
});
