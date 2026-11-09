// Every email this engine prepares in Krish's name, or for Jonny's box in his style, passes Control Center's one
// voice check before it is proposed (Ruling, Krish, 2026-11-07). Synthetic words and a stand-in client only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceHolds, voiceHoldLine, wordsOf } from '../src/stages/voice.mjs';

const email = (id, body, mailbox = null) => ({ proposal_id: id, exact_payload: JSON.stringify({ version: 2, channel: 'email', subject: 'A quick idea', body, mailbox }) });
const served = { features: { voice_check: true } };
const stand = (bad = {}) => {
  const calls = [];
  return { calls, async voiceCheck(input) { calls.push(input); return { hard: bad[input.text] ?? [] }; } };
};

test('an email that breaks a hard rule is held by id, with the rule names only', async () => {
  const cc = stand({ 'A seamless plan.': [{ rule: 'words', message: 'x' }] });
  const r = await voiceHolds({ cc, capabilities: served, proposals: [email('p1', 'A seamless plan.'), email('p2', 'A plain plan.')] });
  assert.deepEqual([...r.held.keys()], ['p1']);
  assert.equal(r.checked, 2);
  const line = voiceHoldLine(r.held);
  assert.equal(line.reason, 'voice_refused');
  assert.match(line.detail, /words/);
  assert.doesNotMatch(line.detail, /seamless plan/, 'never the words in a public report');
});

test('Jonny\'s box is checked as Jonny in Krish\'s style, Krish\'s rows as his own email', async () => {
  const cc = stand();
  await voiceHolds({ cc, capabilities: served, proposals: [email('a', 'One.', 'jonny'), email('b', 'Two.')] });
  assert.deepEqual(cc.calls.map(c => c.channel), ['email_jonny', 'email']);
  assert.equal(cc.calls[0].subject, 'A quick idea');
});

test('a strategy proposal carries no words of his and is not asked about', async () => {
  const cc = stand();
  const r = await voiceHolds({ cc, capabilities: served, proposals: [{ proposal_id: 's', exact_payload: '{"strategy":true}' }] });
  assert.equal(cc.calls.length, 0);
  assert.equal(r.held.size, 0);
});

test('every action with his words is checked: a message, a form\'s written answers and an engagement task\'s taps (Ruling, Krish, 2026-11-09)', async () => {
  assert.deepEqual(wordsOf({ channel: 'whatsapp', body: 'Quick one for you.' }), { text: 'Quick one for you.', channel: 'message' });
  assert.deepEqual(wordsOf({ channel: 'x_message', body: 'Saw your post.' })?.channel, 'message');
  const form = wordsOf({ channel: 'form', form: { url: 'https://example.org/cfp', answers: [{ label: 'Name', value: 'A Synthetic Name' }, { label: 'Abstract', value: 'A talk about what happens to pricing when the buyer is an agent.' }] } });
  assert.deepEqual(form, { text: 'A talk about what happens to pricing when the buyer is an agent.', channel: 'form' }, 'only the written answers, never a name or a country');
  assert.deepEqual(wordsOf({ channel: 'engage', taps: [{ label: 'a', text: 'Good point on agent pricing.', url: 'https://example.org/p' }] }), { text: 'Good point on agent pricing.', channel: 'comment' });
  const cc = stand({ 'A robust idea.': [{ rule: 'words' }] });
  const r = await voiceHolds({ cc, capabilities: served, proposals: [{ proposal_id: 'm', exact_payload: JSON.stringify({ version: 2, channel: 'whatsapp', body: 'A robust idea.' }) }] });
  assert.deepEqual([...r.held.keys()], ['m']);
  assert.equal(cc.calls[0].channel, 'message');
});

test('an older Control Center without the check holds nothing, and says it was not served', async () => {
  const cc = stand({ 'A seamless plan.': [{ rule: 'words' }] });
  const r = await voiceHolds({ cc, capabilities: { features: {} }, proposals: [email('p1', 'A seamless plan.')] });
  assert.equal(r.served, false);
  assert.equal(r.held.size, 0);
  assert.equal(cc.calls.length, 0);
});

test('a check that cannot be read is counted, never a hold and never a pass of a broken rule it read', async () => {
  const cc = { async voiceCheck() { throw new Error('unreachable'); } };
  const r = await voiceHolds({ cc, capabilities: served, proposals: [email('p1', 'Words.')] });
  assert.deepEqual([r.unread, r.held.size], [1, 0]);
});
