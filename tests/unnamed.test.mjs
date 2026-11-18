import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { namesUnnamed, outboundWords, unnamedHeld, unnamedHoldLine, decisionNamesUnnamed, UNNAMED_HOLD } from '../src/stages/unnamed.mjs';
import { parseRecord } from '../src/stages/canon.mjs';
import { recordParts, recordWithout, bioLine, formBio, formAbstract, pitchWords, speakWords } from '../src/stages/pitches.mjs';
import { amplifierRows, sharedPlace, historyOf, specificOf, EPISODES, KRISH_TITLE } from '../src/stages/rows.mjs';
import { openingFact } from '../src/stages/openings.mjs';
import { runDispatch, payloadDigest } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';

// Ruling (Krish, 2026-11-18): "don't name Nine anywhere". No word that leaves in his name or Jonny's names the media
// company he worked at before Mindmake; a record clause that names it is dropped, a draft that names it is held as
// former_employer_named, and his card may still say a contact worked there. The company's name appears here only as
// the input the rules must catch. Synthetic only: invented people, companies, ids and figures.

const ID = '00000000-0000-4000-8000-0000000000aa';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NAMED = /(?<![\p{L}\d])(?:Nine|NINE)(?![\p{L}\d])/u;
const canon = { publication: { name: 'Make Your Mind Up', url: 'https://publication.example' }, brain: 'Your taste, standards and judgement, running as a system you own.' };
const RECORD = 'At Example Broadcasting he grew data revenue from $1M to $9M in three years, and he has spoken at the Example Concert Hall.';
const RECORD_NAMED = 'At Nine he grew data revenue from $1M to $9M in three years, and he has spoken at the Example Concert Hall.';
const receipts = org => `export const receipts = {\n  credentials: [\n    'Public Speaker (Example Concert Hall)',\n  ],\n  roles: [\n    {\n      org: '${org}',\n      title: 'Head of Data',\n      detail:\n        "grew data revenue from $1M to $9M in three years. Launched 12 products.",\n    },\n  ],\n};\n`;

test('the company is found by itself, in its group\'s names and as its outlets, wherever it stands', () => {
  for (const text of [
    'At Nine he grew data revenue.',
    'He worked at Nine as head of data, where you also worked.',
    'Nine Entertainment is where we met.',
    'I saw the news from Nine Network last week.',
    'We met at Nine Network in May.',
    'NINE ENTERTAINMENT',
    "Nine's data team built it.",
    'Nine grew its data revenue.',
    'Nine is where he built the data team.',
    'It ran on Channel Nine.',
    'Watch it on 9Now tonight.',
    'Read it at https://www.nine.com.au/story.',
  ]) assert.equal(namesUnnamed(text), true, text);
});

test('the number word is never the company: "Nine of ten" and the number in lower case do not hold', () => {
  for (const text of [
    'Nine of ten leaders get this wrong.',
    'Hi Sam,\n\nNine of ten leaders I talk to say the same.\n\nKrish',
    'Subject: Nine of ten boards ask this',
    'I read your post, "Nine of ten leaders get this wrong", and I liked it.',
    'Nine in ten boards ask this.',
    'Nine leaders told me the same thing.',
    'Nine CEOs told me the same thing.',
    'Nine-figure deals are rare.',
    'nine of ten leaders',
    'Shall we meet at nine on Tuesday?',
    'Ninety leaders and Nineteen boards.',
    '',
  ]) assert.equal(namesUnnamed(text), false, text);
  assert.equal(namesUnnamed(null), false);
});

const email = (body, extra = {}) => JSON.stringify({ version: 2, channel: 'email', recipient_contact_id: id(1), subject: 'It has been a while', body, ...extra });
const wrap = (line, sign = 'Krish') => ['Hi Sam,', line, sign].join('\n\n');

test('every outbound draft that names it is held as former_employer_named, whatever its channel or box; "Nine of ten" is not', () => {
  assert.equal(UNNAMED_HOLD, 'former_employer_named');
  const proposals = [
    { proposal_id: 'his-at', wall: 'send', channel: 'email', exact_payload: email(wrap('We both worked at Nine, and it has been a while.')) },
    { proposal_id: 'jonny-entertainment', wall: 'send', channel: 'email', exact_payload: email(wrap('He grew data revenue at Nine Entertainment.', 'Thanks either way,\nJonny'), { mailbox: 'jonny' }) },
    { proposal_id: 'form-network', wall: 'send', channel: 'form', exact_payload: JSON.stringify({ version: 2, channel: 'form', form: { answers: [{ label: 'Bio', value: 'Krish Raja ran data at Nine Network.' }] } }) },
    { proposal_id: 'subject', wall: 'send', channel: 'email', exact_payload: email(wrap('Up for a call?'), { subject: 'From one Nine alum to another' }) },
    { proposal_id: 'message', wall: 'send', channel: 'whatsapp', exact_payload: JSON.stringify({ version: 2, channel: 'whatsapp', body: "Saw Nine's news." }) },
    { proposal_id: 'plain-note', wall: 'send', channel: 'email', exact_payload: 'Subject: Hello\n\nHi Sam,\n\nI was at Nine for years.\n\nKrish' },
    { proposal_id: 'post', wall: 'post', channel: 'publication', exact_payload: 'What I learned at Nine Entertainment about data.' },
    { proposal_id: 'plan', wall: 'strategy', channel: null, exact_payload: JSON.stringify({ ref: 'pilot:x', first_action: { channel: 'email', subject: 'Hello', body: 'We met at Nine.' } }) },
    { proposal_id: 'number', wall: 'send', channel: 'email', exact_payload: email(wrap('Nine of ten leaders I meet ask the same question. Up for a call?')) },
    // His card, his title and the why are his: they may say a contact worked there.
    { proposal_id: 'card-only', wall: 'send', channel: 'email', title: 'Catch up with Sam, ex Nine', why: 'They have worked at Nine.', card: { why: ['They have worked at Nine as Producer, where you also worked.'] }, exact_payload: email(wrap('We go back to 2019: up for a call?')) },
    // An ask of him with no first action is no outbound draft.
    { proposal_id: 'ask', wall: 'strategy', channel: null, exact_payload: JSON.stringify({ note: 'A contact moved to Nine Entertainment.' }) },
  ];
  assert.deepEqual([...unnamedHeld(proposals)].sort(), ['form-network', 'his-at', 'jonny-entertainment', 'message', 'plain-note', 'plan', 'post', 'subject']);
  assert.deepEqual(outboundWords({ wall: 'none', exact_payload: null }), []);
  assert.deepEqual(unnamedHeld(null).size, 0);
  // The hold says how many and why, never the name and never a word of the draft.
  const line = unnamedHoldLine(8);
  assert.equal(line.reason, 'former_employer_named');
  assert.match(line.detail, /^8 proposals held: the words name the media company Krish worked at before Mindmake/);
  assert.equal(NAMED.test(JSON.stringify(line)) || /nine/i.test(JSON.stringify(line)), false);
  assert.match(unnamedHoldLine(1, { approved: true }).detail, /^1 approved email not sent:/);
  assert.equal(decisionNamesUnnamed({ exact_payload: email(wrap('I was at Nine.')) }), true);
  assert.equal(decisionNamesUnnamed({ exact_payload: email(wrap('Nine of ten leaders ask.')) }), false);
  assert.equal(decisionNamesUnnamed({}), false, 'a decision with no words of its own was held when it was proposed');
});

test('his record never carries a clause that names it: the record read, its parts, the bio line, the form answers and every pitch', () => {
  // The site's record: a role at the company is left out and where he spoke stays; written as a national media group, it is kept whole.
  assert.equal(parseRecord(receipts('Nine')), 'He has spoken at the Example Concert Hall.');
  assert.equal(parseRecord(receipts('Nine Entertainment')), 'He has spoken at the Example Concert Hall.');
  assert.equal(parseRecord(receipts('a national media group')), 'At a national media group he grew data revenue from $1M to $9M in three years, and he has spoken at the Example Concert Hall.');
  assert.equal(parseRecord(receipts('Nine').replace("'Public Speaker (Example Concert Hall)',", '')), null, 'nothing left, no record');
  // A record line that still names it, however it arrives.
  assert.deepEqual(recordParts(RECORD_NAMED), { did: '', spoke: 'has spoken at the Example Concert Hall' });
  assert.deepEqual(recordParts('At Nine Network he grew data revenue from $1M to $9M in three years.'), { did: '', spoke: '' });
  assert.equal(recordWithout('At Example Broadcasting he grew data revenue from $1M to $9M in three years, and he has spoken at the Nine Network Summit.'), 'At Example Broadcasting he grew data revenue from $1M to $9M in three years.');
  assert.equal(recordWithout(RECORD), RECORD, 'a record that names nothing is kept as read');
  assert.equal(bioLine(canon, RECORD_NAMED), `He's ${KRISH_TITLE}, writes Make Your Mind Up (https://publication.example) and helps leaders build their AI brain at Mindmake; he has spoken at the Example Concert Hall.`);
  assert.ok(bioLine(canon, RECORD).endsWith('; at Example Broadcasting he grew data revenue from $1M to $9M in three years, and he has spoken at the Example Concert Hall.'), 'unchanged when nothing is named');
  const words = [
    bioLine(canon, RECORD_NAMED), bioLine(canon, 'At Nine he grew data revenue.', 'first'),
    formBio(canon, { line: RECORD_NAMED }), formAbstract({ row: 'events', name: 'The Example Summit', ask: 'a talk', talk: EPISODES.leadership[0], about: 'how leaders keep their judgement', canon, record: { line: RECORD_NAMED } }),
    pitchWords({ t: { audience: 'Senior leaders' }, show: 'The Example Show', host: 'Avery Example', topic: 'leadership', canon, record: RECORD_NAMED, episode: EPISODES.leadership[0] }).body,
    speakWords({ t: { audience: 'Senior leaders' }, event: 'The Example Summit', host: 'Avery Example', ask: 'a talk', talk: EPISODES.leadership[0], topic: 'leadership', canon, record: RECORD_NAMED }).body,
  ];
  for (const w of words) { assert.equal(NAMED.test(w), false, w); assert.equal(namesUnnamed(w), false, w); }
  assert.ok(formBio(canon, { line: RECORD_NAMED }).endsWith('He has spoken at the Example Concert Hall.'));
  assert.equal(pitchWords({ show: 'The Example Show', host: null, topic: 'leadership', canon, record: RECORD_NAMED }).body.includes('$1M'), false, 'the clause and its figure go together');
});

const route = () => ({ email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false });
const tie = (n, over = {}) => ({ contact_id: id(n), network_tier: '1_reciprocated', mindmake_fit: 70, known_since: '2019-03-01', email_last: '2024-06-10', current_title: 'Chief Data Officer', current_company: `Example Firm ${n}`,
  contacts: { full_name: `Robin Sample${n}`, status: 'active', company: `Example Firm ${n}` }, ...over });

test('his card may say a contact worked there; nothing from it reaches the catch-up', async () => {
  const shared = 'They have worked at Nine as Group Business Manager, where you also worked.';
  assert.equal(sharedPlace([shared]), '', 'never a place an email shares');
  assert.equal(sharedPlace([shared, 'They have worked at Example Media as Producer, where you also worked.']), 'Example Media', 'another shared place still can be');
  assert.equal(historyOf({ known_since: '2015-03-01', email_last: '2025-05-02' }, { why: [shared] }), 'We go back to 2015 and last wrote in May 2025: up for a call in the next few weeks?');
  assert.equal(specificOf({ hook: 'His work running data at Nine Entertainment.' }), '', 'a line that names it is no subject');
  assert.equal(specificOf({ facts: [{ kind: 'role_change', text: 'Changed role: was COO at Example Co, now CEO at Nine Network' }] }), '');
  assert.equal(openingFact({ facts: [{ kind: 'role_change', text: 'Changed role: was COO at Nine, now CEO at Example Co' }], who: 'Chief executive of Example Co, building its data team.' }), 'Chief executive of Example Co, building its data team.', 'the desk is never given a fact that names it');
  // End to end: a close tie whose shared employer is the company. The card says so; the email does not, and passes the last net.
  const { parseCanon, blobSha } = await import('../src/stages/canon.mjs');
  const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
  const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
  const full = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
  const t = tie(1, { facts: [
    { kind: 'post', text: 'Posted: "Boards are asking what AI should decide, not what it can do."', source_url: 'https://example.org/post/1', observed_at: '2026-10-01T00:00:00Z' },
    { kind: 'shared_employer', text: 'Has worked at Nine as Group Business Manager, where Krish also worked', source_url: null, observed_at: null },
  ] });
  const r = amplifierRows({ context: { network: [t], routes: { [t.contact_id]: route() }, feedback: [], research: [] }, weekGoals: [], canon: full, files: full.files, at: '2026-11-06T09:00:00.000Z' });
  assert.equal(r.rows.length, 1);
  const p = r.rows[0].proposal;
  assert.ok(p.card.why.includes(shared), 'his card keeps the history');
  const body = JSON.parse(p.exact_payload).body;
  assert.equal(NAMED.test(body), false, body);
  assert.match(body, /We go back to 2019 and last wrote in Jun 2024/);
  assert.equal(unnamedHeld([p]).size, 0, 'the card is never read as words to them');
});

async function run({ body, decisions = null, executed = [] }) {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const plan = { proposal_id: 'gmc-note-1', decision: 'approved', stage: 'plan', exact_payload: JSON.stringify({ ref: `contact:${ID}`, first_action: { subject: 'S', body: 'B' } }) };
  const a = { version: 1, channel: 'email', recipient_contact_id: ID, subject: 'It has been a while', body, assets: [], cost_usd: 0, source_ref: `contact:${ID}`, expires_at: '2026-11-05T00:00:00Z' };
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture(),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { exact_actions: true, contact_notes: true } }),
    decisions: async () => decisions ?? [plan],
    prepareAction: async () => ({ ok: true, prepared: { parent_proposal_id: 'gmc-note-1', action: a, payload_sha256: payloadDigest(a) } }),
    actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); },
    executeAction: async pid => { executed.push(pid); throw new Error('none'); },
    postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1)
  };
  await runDispatch({ cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, attemptId: 'gma-synthetic-12345678', clock: () => '2026-11-03T12:00:00Z' });
  return reports[0];
}

test('a dispatch holds a prepared email that names it, fail closed, and files one that says "Nine of ten"', async () => {
  const held = await run({ body: wrap('I was at Nine for years, and it has been a while. Up for a call?') });
  assert.ok(!held.proposals.some(p => p.stage === 'go_live'), 'never on his list');
  const hold = held.holds.find(h => h.reason === 'former_employer_named');
  assert.ok(hold, 'held by its code');
  assert.match(hold.detail, /^1 proposal held:/);
  assert.equal(NAMED.test(JSON.stringify(held)), false, 'the report never names it');
  const filed = await run({ body: wrap('Nine of ten leaders I meet ask the same thing. Up for a call?') });
  assert.ok(filed.proposals.some(p => p.stage === 'go_live'), 'the number is no name');
  assert.ok(!filed.holds.some(h => h.reason === 'former_employer_named'));
});

test('an approved email that names it is not carried out; one that does not is', async () => {
  const live = text => ({ proposal_id: 'live-1', decision: 'approved', stage: 'go_live', payload_sha256: 'a'.repeat(64), amended: true, amount_usd: 0, exact_payload: email(wrap(text)) });
  const executed = [];
  const report = await run({ body: 'B', decisions: [live('Good to see the news from Nine Entertainment.')], executed });
  assert.deepEqual(executed, [], 'the executor is never asked');
  assert.match(report.holds.find(h => h.reason === 'former_employer_named')?.detail ?? '', /^1 approved email not sent:/);
  const sent = [];
  await run({ body: 'B', decisions: [live('Nine of ten leaders ask this.')], executed: sent });
  assert.deepEqual(sent, ['live-1'], 'the number is no name: the executor is asked as before');
});
