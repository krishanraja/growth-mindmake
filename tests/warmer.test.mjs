import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pitchWords, speakWords, inviteWords, inviteShow, pitchRows, pitchedStages, invitedGuests, inviteHold, invitesThisWeek, stageProposalId, inviteProposalId,
  conviction, recordParts, greetingFor, HUMAN_IP, SPEAKER_PROFILE, MEDIA_CHANNEL, PODCAST_LINK, JONNY_SIGN_OFF } from '../src/stages/pitches.mjs';
import { lessons, unsentJonny, sharedBodies, actionFor, KRISH_SIGN_OFF, EPISODES, KRISH_TITLE, REISSUE_DAYS } from '../src/stages/rows.mjs';
import { STAGE, GUEST } from './support/standard.mjs';

// Rulings (Krish, 2026-11-16): Jonny's speaking pitches showcase www.krishraja.com as his speaking profile and
// mindmake.co as his media channel; every draft is sincere, helpful, laid-back, confident, personable and respectful;
// Jonny pitches what Krish loves talking about with real conviction (AI is starting to take in our human know-how,
// and we must use it rather than be used by it). Synthetic only.
const EM = String.fromCharCode(8212);
const KILL = /\b(?:excited|thrilled|seamless|empower\w*|journey|landscape|game-chang\w*|revolutionary|cutting-edge|robust|utili[sz]e|facilitate|paradigm|tapestry|moreover|furthermore|groundbreaking|innovative|innovation|synergy|holistic|spearhead|delve|unpack|unleash|elevate|supercharge|foster|cultivate|crucial|pivotal|testament|boasts|underscores|realm|leverage|savant|genius)\b/i;
const canon = { publication: { name: 'Make Your Mind Up', url: 'https://publication.example' }, brain: 'Your taste, standards and judgement, running as a system you own.' };
const RECORD = 'At Example Broadcasting he grew data revenue from $1M to $9M in three years, and he has spoken at the Example Concert Hall.';
const NOW = '2026-11-16T09:00:00.000Z';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clean = body => { assert.equal(body.includes(EM), false, 'no em dash'); assert.equal(/\bHi there\b/.test(body), false, 'never "Hi there"'); assert.equal(KILL.test(body), false, `nothing on the kill list: ${body}`); };

test('a speaking pitch names his speaking profile and his media channel once each, greets by first name, and asks once', () => {
  const w = speakWords({ t: { audience: 'Marketing leaders at mid-size companies', deadline_at: '2026-11-28T00:00:00Z' }, event: 'The Example Summit', host: 'Avery Example', ask: 'a talk', talk: EPISODES.marketing[0], topic: 'marketing', canon, record: RECORD });
  assert.ok(w.body.startsWith('Hi Avery,\n\n'));
  assert.equal(SPEAKER_PROFILE, 'https://www.krishraja.com');
  assert.equal(MEDIA_CHANNEL, 'https://mindmake.co');
  for (const link of [SPEAKER_PROFILE, MEDIA_CHANNEL]) assert.equal(w.body.split(link).length - 1, 1, `${link} once`);
  assert.equal((w.body.match(/https:\/\//g) ?? []).length, 2, 'no link dump');
  assert.ok(w.body.includes(`He's ${KRISH_TITLE} and has spoken at the Example Concert Hall; his speaking profile is at`), 'two credentials at most, woven in');
  assert.equal(w.body.includes('$1M'), false, 'the speaking pitch leads with where he has spoken, not a figure');
  assert.equal((w.body.match(/\?/g) ?? []).length, 1);
  assert.match(w.body, /rather than/, 'the message he cares about most');
  assert.ok(w.body.endsWith(`\n\n${JONNY_SIGN_OFF}`));
  clean(w.body);
});

test('a podcast pitch names Make Your Mind Up once and no other link, and every greeting without a name is the team, never "there"', () => {
  const w = pitchWords({ t: { audience: 'Founders and investors' }, show: 'The Example Show', host: null, topic: 'venture', canon, record: RECORD, episode: EPISODES.venture[0] });
  assert.ok(w.body.startsWith('Hi Example Show team,\n\n'));
  assert.equal(PODCAST_LINK, 'https://makeyourmindup.ai');
  assert.equal(w.body.split(PODCAST_LINK).length - 1, 1);
  assert.ok(!w.body.includes(MEDIA_CHANNEL), 'mindmake.co is for speaking pitches');
  assert.equal((w.body.match(/https:\/\//g) ?? []).length, 1, 'one link');
  assert.equal(w.body.includes('Example Concert Hall'), false, 'one line of record, not a wall of proof');
  clean(w.body);
  assert.equal(greetingFor(null, ''), 'Hello,');
  assert.equal(greetingFor('Dr. Sam Sample', 'x'), 'Hi Sam,');
});

test('the message is told for every room, and no two pitches on one topic in a run say it the same way', () => {
  for (const [topic, line] of Object.entries(HUMAN_IP)) {
    assert.equal(line.includes(EM) || KILL.test(line), false, topic);
    assert.equal(/^(?:AI|[a-z])/.test(line), true, 'read inside a sentence');
  }
  for (const [topic, eps] of Object.entries(EPISODES)) assert.equal(new Set(eps.map(e => conviction(topic, e))).size, eps.length, topic);
  // Four pitches on one topic, each with its own episode: the template guard passes them all.
  const proposals = EPISODES.leadership.map((ep, i) => ({ proposal_id: `gmp-${i}`, exact_payload: JSON.stringify({ channel: 'email', body: pitchWords({ t: { audience: 'Senior leaders' }, show: `Show ${i}`, host: 'Avery Example', topic: 'leadership', canon, record: RECORD, episode: ep }).body }) }));
  assert.deepEqual(sharedBodies(proposals), []);
});

test('his record splits into what he did and where he spoke, and says nothing it does not hold', () => {
  assert.deepEqual(recordParts(RECORD), { did: 'At Example Broadcasting he grew data revenue from $1M to $9M in three years', spoke: 'has spoken at the Example Concert Hall' });
  assert.deepEqual(recordParts('He has spoken at The Example Hall.'), { did: '', spoke: 'has spoken at The Example Hall' });
  assert.deepEqual(recordParts(null), { did: '', spoke: '' });
  assert.equal(speakWords({ event: 'E', host: null, ask: 'a talk', talk: 'T', canon, record: null }).body.includes('spoken'), false);
});

test('an invite and his own email are warm and unhurried, signed warmly, never "Hi there"', () => {
  const w = inviteWords({ name: 'Avery Example', show: inviteShow('makeyourmindup', canon), page: null, g: { one_liner: 'CRO at Example AI' }, idea: EPISODES.sales[0] });
  assert.match(w.body, /whenever suits you\?/);
  clean(w.body);
  const mine = actionFor('email', id(1), 'Avery Example', { subject: 'Hello', lines: ['Up for a call?'] });
  assert.ok(mine.body.endsWith(`\n\n${KRISH_SIGN_OFF}`));
  assert.ok(actionFor('email', id(1), '', { subject: 'Hello', lines: ['Up for a call?'] }).body.startsWith('Hello,\n\n'), 'no name, a plain hello');
});

// ── Redrafting what still waits unsent in Jonny's Gmail ─────────────────────
const show = (n, over = {}) => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', ...STAGE.take, organizer: 'Avery Example', buried_at: null, applied_at: null,
  event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, episodes: 80, latest_episode_at: '2026-11-01T00:00:00Z', booking_contact_id: id(100 + n), booking_source: 'feed_owner', audience: 'Marketing leaders at mid-size companies', ...over });
const draft = (n, over = {}) => ({ mailbox: 'jonny', job: 'booked', proposal_id: stageProposalId(id(n), 'pitch'), visibility_target_id: id(n), contact_id: id(100 + n), created_at: '2026-11-12T05:10:00Z', sent_at: null, replied_at: null, booked_at: null, binned_at: null, ...over });
const drafted = (n, over = {}) => ({ id: stageProposalId(id(n), 'pitch'), state: 'done', carried_out: 'draft', row: 'visibility', reference: 'visibility:pitch', subject_ref: `target:${id(n)}`, decided_at: '2026-11-12T05:10:00Z', ...over });
const context = (drafts, feedback) => ({ observed_at: NOW, records: { visibility: [show(1), show(2)], drafts }, routes: { [id(101)]: { in_network: false }, [id(102)]: { in_network: false } }, feedback, research: [] });

test('a pitch still unsent in Jonny\'s Gmail is proposed again under its own id, to the same recipient, in the new words', () => {
  const ctx = context([draft(1)], [drafted(1)]);
  assert.equal(unsentJonny(ctx.records.drafts, ctx.feedback, NOW).size, 1);
  assert.equal(pitchedStages(ctx).has(id(1)), false, 'not counted as pitched while it waits unsent');
  assert.equal(lessons(ctx.feedback, NOW, ctx.records.drafts).until.has(`target:${id(1)}`), false, 'its draft does not snooze it');
  const run = pitchRows({ context: ctx, weekGoals: [], canon, record: RECORD, files: [], at: NOW, networkRoutes: true });
  const again = run.proposals.find(p => p.subject_ref === `target:${id(1)}`);
  assert.ok(again, 'proposed again');
  assert.equal(again.proposal_id, draft(1).proposal_id, 'the same id, so Control Center replaces the draft in place');
  assert.equal(JSON.parse(again.exact_payload).recipient_contact_id, id(101), 'the same recipient');
  assert.ok(JSON.parse(again.exact_payload).body.includes(PODCAST_LINK), 'the new words');
  assert.ok(run.proposals.length <= 10, 'inside the run\'s ten');
});

test('a pitch that moved on, was declined, is too old or carries another id is never redrafted', () => {
  for (const [why, d, f] of [
    ['sent', draft(1, { sent_at: '2026-11-13T00:00:00Z' }), drafted(1)],
    ['replied', draft(1, { replied_at: '2026-11-13T00:00:00Z' }), drafted(1)],
    ['binned', draft(1, { binned_at: '2026-11-13T00:00:00Z' }), drafted(1)],
    ['declined', draft(1), drafted(1, { state: 'declined', carried_out: null })],
    ['too old', draft(1, { created_at: new Date(Date.parse(NOW) - (REISSUE_DAYS + 1) * 86400000).toISOString() }), drafted(1)],
    ['no time', draft(1, { created_at: null }), drafted(1)],
    ['another id', draft(1, { proposal_id: `gmp-${'0'.repeat(32)}` }), drafted(1, { id: `gmp-${'0'.repeat(32)}` })],
    ['his own box', draft(1, { mailbox: 'krish' }), drafted(1)],
  ]) {
    const ctx = context([d], [f]);
    assert.equal(pitchedStages(ctx).has(id(1)), true, why);
    assert.equal(pitchRows({ context: ctx, weekGoals: [], canon, record: RECORD, files: [], at: NOW, networkRoutes: true }).proposals.some(p => p.subject_ref === `target:${id(1)}`), false, why);
  }
});

test('an invite still unsent in Jonny\'s Gmail may be invited again under its own id, and is not counted twice in the week', () => {
  const g = { contact_id: id(301), name: 'Avery Example', status: 'enriched', invite_show: 'makeyourmindup', invite_state: 'drafted', scheduled_at: null, ...GUEST.take, buried_at: null, recorded_at: null, published_at: null, one_liner: 'CRO at Example AI', why_fit: 'Runs a sales team.' };
  const d = { mailbox: 'jonny', job: 'guests', proposal_id: inviteProposalId(id(301)), contact_id: id(301), created_at: '2026-11-15T05:10:00Z', sent_at: null };
  const f = { id: inviteProposalId(id(301)), state: 'done', carried_out: 'draft', row: 'visibility', reference: 'visibility:invite', subject_ref: `contact:${id(301)}`, decided_at: '2026-11-16T05:10:00Z' };
  const ctx = { observed_at: NOW, records: { drafts: [d] }, feedback: [f] };
  const routes = { [id(301)]: { email: 'verified', in_network: false } };
  const invited = invitedGuests(ctx);
  assert.equal(invited.has(id(301)), false);
  assert.equal(inviteHold(g, { L: lessons(ctx.feedback, NOW, ctx.records.drafts), invited, routes, at: NOW }), null, 'free to be redrafted');
  assert.deepEqual(invitesThisWeek(ctx, [g], NOW), { makeyourmindup: 0, signal_noise: 0 }, 'its first draft is not counted twice');
  const sent = { ...ctx, records: { drafts: [{ ...d, sent_at: '2026-11-16T08:00:00Z' }] } };
  assert.equal(inviteHold(g, { L: lessons(sent.feedback, NOW, sent.records.drafts), invited: invitedGuests(sent), routes, at: NOW }), 'already_invited', 'once Jonny sends it, never again');
});
