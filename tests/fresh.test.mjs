import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { amplifierRows, rankRows, sharedBodies, bodySkeleton, shownLine, shownHistory, shortId, cardClash, employersIn, sameOrg, specificOf, historyOf, youFact, titleNaming, shorterNames, WORDS, actionFor } from '../src/stages/rows.mjs';
import { pitchRows, lookupRequests, uniqueStages, stageKeys } from '../src/stages/pitches.mjs';

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

test('a catch-up names one thing about them and the history between you, and no two catch-ups are the same email', () => {
  const ties = [tie(1), tie(2, { hook: 'Rebuilt the data desk at Example Firm 2 around one platform.' }), tie(3, { facts: [{ kind: 'post', text: 'Posted: "Boards are asking what AI should decide."', source_url: 'https://example.org/post/3', observed_at: '2026-10-01T00:00:00Z' }] })];
  const r = amplifierRows({ context: { network: ties, routes: Object.fromEntries(ties.map(t => [t.contact_id, route()])), feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW });
  const rows = r.rows.map(x => x.proposal);
  assert.equal(rows.length, 3);
  const [a, b, c] = rows.sort((x, y) => x.target.localeCompare(y.target)).map(body);
  assert.match(a, /Saw you're Chief Data Officer at Example Firm 1 these days\. We go back to 2019, and the last time we wrote was Jun 2024\./, 'their role now and the history');
  assert.match(b, /Read that you rebuilt the data desk at Example Firm 2 around one platform\./, 'a fact from their record, said to them');
  assert.match(c, /Read your post: "Boards are asking what AI should decide\."/, 'their own post first');
  for (const x of [a, b, c]) {
    assert.equal(/Been a while\. Keen to hear what you're working on/.test(x), false, 'never the old template');
    assert.equal(x.includes(EM), false, 'no em dash');
    assert.equal((x.match(/\?/g) ?? []).length, 1, 'one ask');
  }
  assert.deepEqual(sharedBodies(rows), [], 'every catch-up is its own email');
  // A tie the record says nothing about is not written to at all.
  const blank = amplifierRows({ context: { network: [tie(4, { current_title: null, current_company: null, contacts: { full_name: 'Robin Sample4', status: 'active' } })], routes: { [id(4)]: route() }, feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW });
  assert.equal(blank.rows.length, 0);
  assert.ok(blank.held.some(h => ['nothing_specific', 'thin_card'].includes(h)), blank.held.join());
});

test('the check fails when two proposals in one run share a body once the name is out, and passes when each says something of its own', () => {
  const old = n => ({ proposal_id: `gmw-${String(n).padStart(32, '0')}`, name: `Robin Sample${n}`, title: `Catch up with Robin Sample${n}`, exact_payload: JSON.stringify(actionFor('email', id(n), `Robin Sample${n}`, { subject: 'Catching up', lines: ["Been a while. Keen to hear what you're working on.", 'Up for a call in the next few weeks?'] })) });
  assert.equal(sharedBodies([old(1), old(2), old(3)]).length, 2, 'the old catch-up is one email three times');
  // The old visibility pitch: one template with the show name swapped.
  const pitch = n => ({ proposal_id: `gmp-${String(n).padStart(32, '0')}`, title: `Jonny pitches you to The Example Show ${n}`, exact_payload: JSON.stringify({ version: 2, channel: 'email', subject: 's', body: `Hi there,\n\nI work with Krish Raja, and I think he'd make a strong guest for The Example Show ${n}.\n\nJonny`, mailbox: 'jonny' }) });
  assert.equal(sharedBodies([pitch(1), pitch(2)]).length, 1, 'a show name swapped is still one email');
  assert.equal(bodySkeleton('Hi Avery,\n\nRead that you run a forum.\n\nKrish', ['Avery Example']), 'read that you run a forum');
  // A form carries no email body: never compared.
  assert.deepEqual(sharedBodies([{ proposal_id: 'gmp-1', exact_payload: JSON.stringify({ channel: 'form', body: 'x' }) }, { proposal_id: 'gmp-2', exact_payload: JSON.stringify({ channel: 'form', body: 'x' }) }]), []);
});

test('a partner offer names their portfolio and one decision; a pitch names the audience and an episode', () => {
  const a = WORDS.partner[0]({ kind: 'investor', company: 'Northwind Capital', topic: 'venture' }, canon);
  const b = WORDS.partner[0]({ kind: 'investor', company: 'Harbour Equity', topic: 'finance' }, canon);
  assert.match(a.lines[0], /Northwind Capital's portfolio.*which of their AI bets deserve more money this year/);
  assert.match(b.lines[0], /Harbour Equity's portfolio.*where the AI budget goes and what it has to return/);
  const show = WORDS.appear[0]({ show: 'The Example Show', topic: 'marketing', audience: '' }, canon);
  assert.match(show.lines[0], /^One episode I'd bring to The Example Show for marketing leaders: "What a CMO should hand to AI this quarter, and what stays human"\.$/);
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
  const p = n => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', verdict: 'take', organizer: 'Example Media', episodes: 50, latest_episode_at: '2026-10-30T00:00:00Z', booking_contact_id: id(800 + n), audience: n === 11 ? 'Media executives' : 'Venture investors and founders', angle: `Episode ${n} asked who owns AI in a company.` });
  const out = pitchRows({ context: { records: { visibility: [t(1), t(2), p(11), p(12)], drafts: [] }, routes: Object.fromEntries([701, 702, 811, 812].map(n => [id(n), { in_network: false }])), feedback: [], research: [] }, weekGoals: [], canon, files: FILES, at: NOW, networkRoutes: true });
  const speak = out.proposals.filter(x => x.row === 'events').map(body);
  assert.equal(speak.length, 2);
  assert.match(speak[0], /The Example Summit \d gathers (?:chief marketing officers|finance leaders in insurance), and the talk is built for that room/);
  assert.match(speak[0], /Your call closes on 20 Nov, so I wanted this with you first\./);
  const pods = out.proposals.filter(x => x.row === 'visibility').map(body);
  assert.equal(pods.length, 2);
  assert.match(pods.join('\n'), /The Example Show 11's listeners, media executives: "What a media business sells once AI can make the content"/);
  assert.match(pods.join('\n'), /Episode 1[12] asked who owns AI in a company\./, 'the angle Nova read for this show');
  assert.deepEqual(sharedBodies(out.proposals), []);
  for (const x of [...speak, ...pods]) assert.equal(x.includes(EM), false);
  assert.equal(youFact('Partner at Example Ventures.'), '', 'a sentence that is no deed is never turned into one');
});
