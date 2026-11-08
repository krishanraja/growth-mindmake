// Every email this engine prepares in Krish's name, or for Jonny's box in his style, passes Control Center's one
// voice check before it is proposed (Ruling, Krish, 2026-11-07). Synthetic words and a stand-in client only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceHolds, voiceHoldLine } from '../src/stages/voice.mjs';

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

test('a message, a form or a strategy proposal is not an email and is not asked about', async () => {
  const cc = stand();
  const r = await voiceHolds({ cc, capabilities: served, proposals: [{ proposal_id: 's', exact_payload: '{"strategy":true}' }, { proposal_id: 'm', exact_payload: JSON.stringify({ version: 2, channel: 'whatsapp', body: 'Hi' }) }] });
  assert.equal(cc.calls.length, 0);
  assert.equal(r.held.size, 0);
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
