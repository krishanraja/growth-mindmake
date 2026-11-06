import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { amplifierRows } from '../src/stages/rows.mjs';
import { openingFact, openingQuery, openingRequest, openingAnswer, validOpening, opening, QUERY_MAX } from '../src/stages/openings.mjs';

// Krish, 2026-11-06: "make those still open decisions yourself for the best quality". The opening of a
// catch-up or an invite is written by Control Center's research desk from one fact and read by fixed rules.
// Synthetic only.
const NOW = '2026-11-06T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const route = () => ({ email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false });
const tie = (n, over = {}) => ({ contact_id: id(n), network_tier: '1_reciprocated', mindmake_fit: 70, known_since: '2019-03-01', email_last: '2024-06-10', current_title: 'Chief Data Officer', current_company: `Example Firm ${n}`,
  contacts: { full_name: `Robin Sample${n}`, status: 'active', company: `Example Firm ${n}` }, ...over });
const body = p => JSON.parse(p.exact_payload).body;

test('the fact an opening is written from is theirs: never a research note, a line about Krish or a placeholder post', () => {
  assert.equal(openingFact({ facts: [{ kind: 'post', text: 'Posted: "Please suppress this post"' }], who: 'Leads partnerships at Example News, pairing AI strategy with distribution.' }), 'Leads partnerships at Example News, pairing AI strategy with distribution.');
  assert.equal(openingFact({ facts: [{ kind: 'post', text: 'Posted: "Boards are asking what AI should decide next year."' }] }), 'They posted: "Boards are asking what AI should decide next year."');
  assert.equal(openingFact({ who: 'Named contact at Example Bank; role unknown.' }, ['Has already replied to Krish\'s email.', 'A close tie, and nothing between you since Jun 2024.']), '');
  assert.equal(openingFact({}, ['Chairs the Example Association\'s AI Taskforce and writes on agentic commerce.']), 'Chairs the Example Association\'s AI Taskforce and writes on agentic commerce.');
  const q = openingQuery({ name: 'Robin Sample', fact: 'x'.repeat(180) });
  assert.ok(q && q.length <= QUERY_MAX && q.includes('Robin'));
  const r1 = openingRequest({ id: id(1), name: 'Robin Sample', fact: 'Chairs the Example Taskforce.' });
  assert.equal(r1.kind, 'question');
  assert.equal(r1, openingRequest({ id: id(1), name: 'Robin Sample', fact: 'Chairs the Example Taskforce.' }) && r1, 'the same fact is the same request');
  assert.equal(openingRequest({ id: id(1), name: 'Robin Sample', fact: 'Chairs the Example Taskforce.' }).request_id, r1.request_id, 'its id replays');
  assert.equal(openingAnswer([], r1).state, 'waiting');
  assert.equal(openingAnswer([{ ...r1, status: 'over_cap' }], r1).state, 'waiting');
  assert.equal(openingAnswer([{ ...r1, status: 'failed' }], r1).state, 'failed');
  assert.equal(openingAnswer([{ ...r1, status: 'answered', answer: 'You chair it.' }], r1).text, 'You chair it.');
});

test('a model sentence is read by fixed rules: every bad line Control Center found fails, a plain one passes', () => {
  const fact = 'Chairs the Example Association\'s AI Taskforce and moved from Example Bank to Example Pay in 2025.';
  const name = 'Robin Sample';
  for (const [text, why] of [
    ["I'd like to hear how your long internal trajectory suggests strong relationships across publishers is going.", 'research_words'],
    ['I hear you named contact at Example Bank, a large bank; role unknown.', 'research_words'],
    ["I hear you have already replied to Krish's email.", 'research_words'],
    ['I read your post, "Please suppress this post", and want to hear more.', 'research_words'],
    ['You joined the chapter and warn tools want to be your fulcrum.', 'claim_without_that'],
    ['Your run through Example Bank, Example Pay.', 'no_verb'],
    ['Congratulations on chairing the Example Association taskforce, an impressive role for you.', 'praise'],
    ['You chair the AI Taskforce at Example Association. You also moved banks.', 'not_one_sentence'],
    ['How is the Example Association taskforce going for you these days?', 'dash_question_or_link'],
    ['You chair the Example Association taskforce \u2014 a big job for you.', 'dash_question_or_link'],
    ['You chair the Example Association taskforce alongside Jordan Other at Example Bank.', 'new_name'],
    ['You moved from Example Bank to Example Pay in 2023, which was a bold step.', 'new_number'],
    ['The Example Association taskforce on AI policy and banking.', 'not_to_them'],
  ]) assert.equal(validOpening(text, { name, fact }).reason, why, text);
  for (const text of [
    "You took the Example Association's AI Taskforce on while moving from Example Bank to Example Pay in 2025.",
    'Since you moved from Example Bank to Example Pay, I have wondered how the AI Taskforce work has gone [1].',
    '"You chair the Example Association\'s AI Taskforce, and I would like to hear what it has decided so far."',
  ]) {
    const v = validOpening(text, { name, fact });
    assert.equal(v.ok, true, `${text}: ${v.reason}`);
    assert.equal(/\[\d\]|^"|"$/.test(v.sentence), false, 'citations and wrapping quotes are taken off');
  }
});

test('where the desk is open, a catch-up opens on its sentence, and one not written or not passing is held, never framed', () => {
  const ties = [
    tie(1, { why_them: 'Chairs the Example Association\'s AI Taskforce and writes on agentic commerce.' }),
    tie(2, { why_them: 'Moved from Example Bank to Example Pay to run its data team.' }),
    tie(3, { why_them: 'Runs the Example Forum for retail data leaders in London.' }),
  ];
  const context = { network: ties, routes: Object.fromEntries(ties.map(t => [t.contact_id, route()])), feedback: [], research: [] };
  // First pass: nothing answered yet, so every catch-up waits and each asks the desk once.
  const asked = amplifierRows({ context, weekGoals: [], canon, files: FILES, at: NOW, openingsRequired: true });
  assert.equal(asked.rows.length, 0);
  assert.equal(asked.held.filter(h => h === 'opening_waiting').length, 3);
  assert.match(asked.research.find(r => r.request_id.startsWith('open:')).query, /it's been a while\. I'm reaching out because .+ Why I thought of you, in my words, from only this: .+ Would you be open to a quick chat\? .*no quotes, no career recap/);
  const reqs = asked.research.filter(r => r.request_id.startsWith('open:'));
  assert.equal(reqs.length, 3);
  for (const r of reqs) assert.ok(r.query.length <= QUERY_MAX && r.kind === 'question' && !/@/.test(r.query));
  // The desk answers: one good, one that pastes a clause, one failed.
  const byId = Object.fromEntries(reqs.map(r => [r.subject_ref, r]));
  const research = [
    { ...byId[`contact:${id(1)}`], status: 'answered', answer: "It's been a while since we last spoke. I'm reaching out because I'm building Mindmake, AI that works the way a leader thinks, and I want views from people I rate. I thought of you because of the Example Association's AI Taskforce, which sits right on that question. Would you be open to a quick chat?" },
    // Krish, 2026-11-06: "I'm just telling them about their career history." A note that does that is held.
    { ...byId[`contact:${id(2)}`], status: 'answered', answer: "It's been a long time. You moved from Example Bank to Example Pay to run its data team. I thought of you because I'm reaching out about AI and data. Would you be open to a quick chat?" },
    { ...byId[`contact:${id(3)}`], status: 'failed' },
  ];
  const r = amplifierRows({ context, weekGoals: [], canon, files: FILES, at: NOW, openingsRequired: true, research });
  assert.equal(r.rows.length, 1);
  assert.match(body(r.rows[0].proposal), /^Hi Robin,\n\nIt's been a while since we last spoke\. I'm reaching out because .+ I thought of you because .+ Would you be open to a quick chat\?\n\nKrish$/s);
  assert.deepEqual(r.held.filter(h => h.startsWith('opening_')).sort(), ['opening_failed', 'opening_waiting'], 'a sentence that fails is held; a desk failure is asked again');
  const again = r.research.filter(x => x.request_id.startsWith('open:'));
  assert.deepEqual(again.map(x => x.subject_ref), [`contact:${id(3)}`], 'only the desk failure is asked again, never an answered one');
  assert.match(again[0].request_id, /:\d{4}-\d{2}-\d{2}$/);
  // Where the desk is closed (a dry run, a test), the catch-up keeps its own sentence.
  const closed = amplifierRows({ context, weekGoals: [], canon, files: FILES, at: NOW });
  assert.equal(closed.rows.length, 3);
});

test('an opening is one call: no fact holds, a passing answer is used, and nothing is asked twice', () => {
  const none = opening({ id: id(9), name: 'Robin Sample', card: { who: 'Named contact; role unknown.' }, research: [], required: true });
  assert.deepEqual(none, { request: null, sentence: null, hold: 'opening_no_fact' });
  const card = { who: 'Runs the Example Forum for retail data leaders in London.' };
  const first = opening({ id: id(9), name: 'Robin Sample', card, research: [], required: true });
  assert.equal(first.hold, 'opening_waiting');
  const done = opening({ id: id(9), name: 'Robin Sample', card, research: [{ ...first.request, status: 'answered', answer: "It's been a while. I'm reaching out because I'm building Mindmake and want views from people I rate. I thought of you because of the Example Forum for retail data leaders in London. Would you be open to a quick chat?" }], required: true });
  assert.equal(done.hold, null);
  assert.equal(done.request, null);
  assert.match(done.sentence, /^It's been a while\./);
});

// Control Center #656 (features.person_routes): a row person with no address is looked up, and a found one is sent to record.
test('a row person with no address is looked up, and an address that is theirs is found; a role inbox or another name is not', async () => {
  const { personAddressFrom, routeFromEvidence } = await import('../src/stages/routes.mjs');
  const person = { name: 'Robin Sample' };
  const ev = (url, title, snippet) => [{ url, title, snippet }];
  assert.equal(personAddressFrom(ev('https://example.org/team', 'Robin Sample, Example Firm', 'Write to robin.sample@example.org'), person).address, 'robin.sample@example.org');
  assert.equal(personAddressFrom(ev('https://example.org/team', 'Robin Sample, Example Firm', 'Write to rsample@example.org'), person).address, 'rsample@example.org');
  assert.equal(personAddressFrom(ev('https://example.org/team', 'Robin Sample, Example Firm', 'Write to info@example.org'), person), null, 'a role inbox is not theirs');
  assert.equal(personAddressFrom(ev('https://example.org/team', 'Jordan Other, Example Firm', 'Write to robin.sample@example.org'), person), null, 'the result must name them');
  assert.equal(personAddressFrom(ev('https://example.org/team', 'Robin Sample, Example Firm', 'Write to jordan@example.org'), person), null, 'the address must carry their name');
  assert.equal(routeFromEvidence(ev('https://example.org/team', 'Robin Sample', 'robin@example.org'), person, 'person').kind, 'email');
  // In the rows: no route asks once, and an answered lookup becomes a found route.
  const t = tie(7);
  const context = { network: [t], routes: {}, feedback: [], research: [] };
  const first = amplifierRows({ context, weekGoals: [], canon, files: FILES, at: NOW, personRoutes: true });
  assert.equal(first.lookups.length, 1);
  assert.equal(first.lookups[0].subject_ref, `contact:${id(7)}`);
  assert.ok(!/@/.test(first.lookups[0].query));
  const answered = [{ request_id: `email:${id(7)}:2026-11-06:abcd1234`, kind: 'search', status: 'answered', evidence: ev('https://example.org/team', 'Robin Sample7, Example Firm 7', 'robin.sample7@example.org') }];
  const again = amplifierRows({ context: { ...context, research: answered }, weekGoals: [], canon, files: FILES, at: NOW, personRoutes: true });
  assert.equal(again.lookups.length, 0);
  assert.deepEqual(again.found.map(f => [f.subject_ref, f.kind, f.address]), [[`contact:${id(7)}`, 'email', 'robin.sample7@example.org']]);
  // A route that says there is no address is no address.
  assert.equal(amplifierRows({ context: { ...context, routes: { [id(7)]: { email: 'none', linkedin: true } } }, weekGoals: [], canon, files: FILES, at: NOW, personRoutes: true }).lookups.length, 1);
  assert.equal(amplifierRows({ context: { ...context, routes: { [id(7)]: { email: 'verified' } } }, weekGoals: [], canon, files: FILES, at: NOW, personRoutes: true }).lookups.length, 0);
  // Without the feature, nobody is looked up.
  assert.equal(amplifierRows({ context, weekGoals: [], canon, files: FILES, at: NOW }).lookups.length, 0);
});

// Live run merge-71: seven openings came back failed at no cost, one batch at one second. A failed attempt is asked again under the day.
test('a failed opening is asked again under the London day, once a day; an answer to any attempt is used', () => {
  const card = { who: 'Runs the Example Forum for retail data leaders in London.' };
  const at = '2026-11-06T13:00:00.000Z';
  const first = opening({ id: id(9), name: 'Robin Sample', card, research: [], required: true, at });
  assert.ok(/^open:[^:]+:[0-9a-f]{12}$/.test(first.request.request_id));
  assert.equal('base' in first.request, false, 'only the desk fields are sent');
  const failed = [{ ...first.request, status: 'failed' }];
  const retry = opening({ id: id(9), name: 'Robin Sample', card, research: failed, required: true, at });
  assert.equal(retry.request.request_id, `${first.request.request_id}:2026-11-06`);
  assert.equal(retry.hold, 'opening_waiting');
  const twice = [...failed, { ...retry.request, status: 'failed' }];
  const today = opening({ id: id(9), name: 'Robin Sample', card, research: twice, required: true, at });
  assert.equal(today.request, null, 'not asked a third time today');
  assert.equal(today.hold, 'opening_failed');
  const tomorrow = opening({ id: id(9), name: 'Robin Sample', card, research: twice, required: true, at: '2026-11-07T09:00:00.000Z' });
  assert.equal(tomorrow.request.request_id, `${first.request.request_id}:2026-11-07`);
  const won = opening({ id: id(9), name: 'Robin Sample', card, research: [...twice, { ...tomorrow.request, status: 'answered', answer: "It's been a while. I'm reaching out because I'm building Mindmake and want views from people I rate. I thought of you because of the Example Forum for retail data leaders in London. Would you be open to a quick chat?" }], required: true, at: '2026-11-07T09:00:00.000Z' });
  assert.equal(won.hold, null);
  // A praise post or a status note is no fact to write from.
  assert.equal(openingFact({ facts: [{ kind: 'post', text: 'Posted: "Super proud of the team for this one."' }], who: 'Leads data at Example Co and writes on measurement.' }), 'Leads data at Example Co and writes on measurement.');
  assert.equal(openingFact({}, ['Already engaged for Example Show at Example Festival 2026.', 'Runs revenue at Example AI and writes on outbound.']), 'Runs revenue at Example AI and writes on outbound.');
  assert.equal(validOpening('You joined the Example chapter and warned that tools want to be your fulcrum, making you worth hearing.', { name: 'Robin Sample', fact: 'Joined the Example chapter and warns tools want to be your fulcrum.' }).reason, 'praise');
  assert.equal(validOpening('You are already engaged for the Example Show, so you would bring a useful perspective.', { name: 'Robin Sample', fact: 'Already engaged for the Example Show.' }).ok, false);
});

// Krish, 2026-11-06: "It's been a long time. Here's why I'm reaching out. Here's why I thought of you. Would you be open to a quick chat?"
test('a catch-up note is read for his order, and one that tells them their career is held', async () => {
  const { validCatchUp } = await import('../src/stages/openings.mjs');
  const fact = 'Runs the Example Forum for retail data leaders in London.';
  const ok = validCatchUp("Hi Robin, It's been a while since we spoke in Jun 2026. I'm reaching out because I'm building Mindmake, AI that works the way a leader thinks. I thought of you because the Example Forum puts you in the room with exactly those leaders. Would you be open to a quick chat? Krish", { name: 'Robin Sample', fact, last: 'Jun 2026' });
  assert.equal(ok.ok, true, ok.reason);
  assert.equal(/^Hi|Krish$/.test(ok.sentence), false, 'greeting and sign-off are the email\'s own');
  const bad = (text, reason) => assert.equal(validCatchUp(text, { name: 'Robin Sample', fact, last: 'Jun 2026' }).reason, reason, text);
  bad("It's been a while. You went from Example Bank to running the Example Forum. I'm reaching out because I thought of you. Would you be open to a quick chat?", 'recites_career');
  bad("I'm reaching out because I'm building Mindmake. I thought of you because of the Example Forum. Would you be open to a quick chat?", 'no_while');
  bad("It's been a while. I'm reaching out because I'm building Mindmake. Would you be open to a quick chat?", 'no_why_you');
  bad("It's been a while. Would you be open to a quick chat?", 'not_four_sentences');
  bad("It's been a while. I'm reaching out about Mindmake. I thought of you because of the Example Forum. Let me know.", 'no_ask');
  bad("It's been a while. I'm reaching out about Mindmake. I thought of you because of the Acme Summit. Would you be open to a quick chat?", 'new_name');
});

test('a catch-up may say June for Jun and is held when it quotes them; his frame lines are not a template', async () => {
  const { validCatchUp } = await import('../src/stages/openings.mjs');
  const { sentenceSkeletons } = await import('../src/stages/rows.mjs');
  const fact = 'Runs the Example Forum for retail data leaders in London.';
  const june = validCatchUp("It's been a while since we spoke in June 2026. I'm reaching out because I'm building Mindmake and want views from people I rate. I thought of you because the Example Forum puts you close to retail data leaders. Would you be open to a quick chat?", { name: 'Robin Sample', fact, last: 'Jun 2026' });
  assert.equal(june.ok, true, june.reason);
  assert.equal(validCatchUp("It's been a while. I'm reaching out about Mindmake. I thought of you after your post \"always grateful to the one who\". Would you be open to a quick chat?", { name: 'Robin Sample', fact, last: '' }).reason, 'quotes_them');
  const frame = "It's been a while since we last spoke. I'm reaching out because I'm building Mindmake and want views from people I rate. Would you be open to a quick chat?";
  assert.deepEqual(sentenceSkeletons(frame), [], 'the same frame to two people is not a template');
});

test('a catch-up note starts with a capital once the greeting is off', async () => {
  const { validCatchUp } = await import('../src/stages/openings.mjs');
  const v = validCatchUp("Hi Robin, it's been a while since we spoke. I'm reaching out because I'm building Mindmake. I thought of you because the Example Forum puts you near retail data leaders. Would you be open to a quick chat?", { name: 'Robin Sample', fact: 'Runs the Example Forum for retail data leaders in London.' });
  assert.equal(v.ok, true, v.reason);
  assert.match(v.sentence, /^It's been a while/);
});
