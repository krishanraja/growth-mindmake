import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  morningQa, morningHolds, morningLengthLine, forHisBox, messageOf, wordsIn, claimsIn, recordText, engineVocabulary, traced, MORNING_WORDS_MAX,
  MORNING_LENGTH_HOLDS
} from '../src/stages/morning.mjs';
import { MORNING_WORD_FILES } from '../src/dispatch.mjs';

// The morning drafts' QA: an email for his own box is held when a claim in it
// is on neither the person's nor the company's record; a message over 80 words
// is counted, and holds only once MORNING_LENGTH_HOLDS is on (Ruling, Krish,
// 2026-11-15). Synthetic only: invented people, companies and ids.

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ROW = {
  contact_id: id(1), current_title: 'COO', current_company: 'Example Co',
  hook: 'Rebuilt the supply chain at Example Co in 2024.', known_since: '2021-05-01', followers: 12000,
  contacts: { full_name: 'Robin Sample', company_domain: 'example.test' },
  facts: [{ kind: 'post', text: 'Most AI pilots die in procurement.', source_url: 'https://posts.example/1', observed_at: null }],
};
const CTX = {
  network: [ROW],
  companies: [{ domain: 'example.test', kind: 'logistics' }],
  research: [{ request_id: 'company:example.test', kind: 'company_read', status: 'answered', query: 'https://example.test', answer: 'Runs warehouses across Northbridge.' }],
  records: { deals: [], visibility: [{ id: id(900), booking_contact_id: id(2), title: 'The Example Show', audience: 'Leaders at 900 firms' }] },
};
const VOCAB = engineVocabulary(["const s = `Mindmake builds an AI that knows the leader using it, worth a short call?`;", "'I read your post'"], { brain: 'Your taste, standards and judgement, running as a system you own.' });

const email = (body, extra = {}) => ({ proposal_id: 'p-1', subject_ref: `contact:${id(1)}`, exact_payload: JSON.stringify({ version: 2, channel: 'email', recipient_contact_id: id(1), subject: 'It has been a while', body, ...extra }) });
const wrap = lines => ['Hi Robin,', ...lines, 'Krish'].join('\n\n');

test('only an email for his own box is read: Jonny\'s box and other channels pass untouched', () => {
  assert.ok(forHisBox(email('x')));
  assert.equal(forHisBox(email('x', { mailbox: 'jonny' })), null);
  assert.equal(forHisBox({ exact_payload: JSON.stringify({ version: 2, channel: 'linkedin', body: 'x' }) }), null);
  assert.equal(forHisBox({ exact_payload: 'not json' }), null);
  assert.deepEqual(morningQa([email(wrap(['Invented Name.'.repeat(1)]), { mailbox: 'jonny' })], { context: CTX, vocabulary: VOCAB }), []);
});

test(`the message is counted between the greeting and the sign-off, and over ${MORNING_WORDS_MAX} words is found`, () => {
  assert.equal(messageOf(wrap(['One two three.'])), 'One two three.');
  assert.equal(messageOf('Dear Robin Sample,\n\nOne two.\n\nBest,\nKrish'), 'One two.');
  assert.equal(wordsIn('One two  three\nfour'), 4);
  const words = n => Array.from({ length: n }, () => 'word').join(' ');
  assert.deepEqual(morningQa([email(wrap([`${words(MORNING_WORDS_MAX - 1)}.`]))], { context: CTX, vocabulary: VOCAB }), [], 'eighty is the cap, not over it');
  const over = morningQa([email(wrap([`${words(MORNING_WORDS_MAX + 1)}.`]))], { context: CTX, vocabulary: VOCAB });
  assert.deepEqual(over.map(o => [o.reason, o.words]), [['morning_over_80_words', MORNING_WORDS_MAX + 1]]);
});

test('length only counts until it is turned on; an untraced claim always holds', () => {
  const words = n => Array.from({ length: n }, () => 'word').join(' ');
  assert.equal(MORNING_LENGTH_HOLDS, false, 'length reports for a week before it holds (Ruling, Krish, 2026-11-15)');
  const long = email(wrap([`${words(MORNING_WORDS_MAX + 5)}.`]));
  const counted = morningQa([long], { context: CTX, vocabulary: VOCAB });
  assert.deepEqual(counted.map(o => [o.reason, o.held]), [['morning_over_80_words', false]]);
  assert.deepEqual(morningHolds(counted), [], 'a count is not a hold');
  assert.match(morningLengthLine(counted), /^Morning drafts, length counted only: 1 email for his box ran over 80 words and was not held/);
  assert.equal(morningLengthLine([]), null);
  assert.deepEqual(morningQa([long], { context: CTX, vocabulary: VOCAB, lengthHolds: true }).map(o => [o.reason, o.held]), [['morning_over_80_words', true]]);
  assert.equal(morningHolds(morningQa([long], { context: CTX, vocabulary: VOCAB, lengthHolds: true }))[0]?.reason, 'morning_over_80_words');
  // A long email is still read for claims while length only counts, and the claim holds it.
  const longAndUntraced = email(wrap([`${words(MORNING_WORDS_MAX + 5)} at Zenithcorp.`]));
  const both = morningQa([longAndUntraced], { context: CTX, vocabulary: VOCAB });
  assert.deepEqual(both.map(o => [o.reason, o.held]), [['morning_over_80_words', false], ['morning_claim_untraced', true]]);
  assert.deepEqual(morningHolds(both).map(h => h.reason), ['morning_claim_untraced']);
});

test('every claim traces to the person\'s or the company\'s record', () => {
  const ok = wrap([
    'Saw you rebuilt the supply chain at Example Co in 2024, and I read your post, "Most AI pilots die in procurement."',
    'We have known each other since May 2021 and you reach 12,000 people; the warehouses across Northbridge stood out.',
    'Mindmake builds an AI that knows the leader using it, worth a short call?',
  ]);
  assert.deepEqual(morningQa([email(ok)], { context: CTX, vocabulary: VOCAB }), []);
});

test('a name, a number or a quotation of theirs that the record does not hold is held, with its kind', () => {
  const cases = [
    ['Congratulations on the Acme acquisition.', 'name'],
    ['Your team of 40 must be busy.', 'number'],
    ['I read your post, "AI will replace every analyst."', 'quote'],
  ];
  for (const [line, kind] of cases) {
    const [f] = morningQa([email(wrap(['A note.', line]))], { context: CTX, vocabulary: VOCAB });
    assert.equal(f?.reason, 'morning_claim_untraced', line);
    assert.deepEqual(f.kinds, [kind], line);
  }
  // The subject is read too.
  const [s] = morningQa([email(wrap(['A note.']), { subject: 'About Zenith' })], { context: CTX, vocabulary: VOCAB });
  assert.equal(s?.reason, 'morning_claim_untraced');
});

test('what starts a sentence is no claim, and a quotation not given as theirs is read as prose', () => {
  assert.deepEqual(claimsIn('Today works. Tomorrow too.'), []);
  assert.deepEqual(claimsIn('One episode: "How teams change with AI".').map(c => [c.kind, c.text]), [['name', 'AI']], 'an episode the engine proposes is not their words');
  assert.deepEqual(claimsIn('You wrote "Pilots die early" last week.').map(c => c.kind), ['quote']);
  assert.equal(traced({ kind: 'name', text: "Example Co's" }, recordText(CTX, id(1)), VOCAB) || traced({ kind: 'name', text: 'Example' }, recordText(CTX, id(1)), VOCAB), true);
});

test('a show the email is about is on the record of the person who books it', () => {
  const pitch = { proposal_id: 'p-2', subject_ref: `target:${id(900)}`, exact_payload: JSON.stringify({ version: 2, channel: 'email', recipient_contact_id: id(2), subject: 'For The Example Show', body: wrap(['Your show reaches leaders at 900 firms.']) }) };
  assert.deepEqual(morningQa([pitch], { context: CTX, vocabulary: VOCAB }), []);
  assert.equal(morningQa([pitch], { context: { ...CTX, records: { visibility: [] } }, vocabulary: VOCAB })[0]?.reason, 'morning_claim_untraced');
});

test('the holds say how many and why, never a word of the email or a name', () => {
  const holds = morningHolds([
    { proposal_id: 'a', reason: 'morning_over_80_words', words: 90 },
    { proposal_id: 'b', reason: 'morning_claim_untraced', kinds: ['name'], untraced: [{ kind: 'name', text: 'Acme' }] },
    { proposal_id: 'c', reason: 'morning_claim_untraced', kinds: ['number', 'name'], untraced: [{ kind: 'number', text: '40' }] },
  ]);
  assert.deepEqual(holds.map(h => h.reason), ['morning_over_80_words', 'morning_claim_untraced']);
  assert.equal(holds[1].detail, "2 emails for his box held: a claim (a name, a number) is on neither the person's nor the company's record.");
  assert.equal(/Acme|40/.test(JSON.stringify(holds)), false);
  assert.deepEqual(morningHolds([]), []);
});

test('the engine\'s own words are the string literals of the files its emails are written from', async () => {
  const texts = await Promise.all(MORNING_WORD_FILES.map(p => readFile(new URL(`../${p}`, import.meta.url), 'utf8')));
  const vocab = engineVocabulary(texts, null);
  assert.equal(traced({ kind: 'name', text: 'Mindmake' }, '', vocab), true);
  assert.equal(traced({ kind: 'name', text: 'Zenithcorp' }, '', vocab), false);
  assert.ok(MORNING_WORD_FILES.includes('src/stages/pilots.mjs') && MORNING_WORD_FILES.includes('src/stages/rows.mjs'));
});
