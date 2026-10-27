import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord, readRecord, RECORD_REPO, RECORD_PATH } from '../src/stages/canon.mjs';
import { pitchRows, pitchHold, pitchedStages, pitchScore, pitchWords, hostOf, showTopic, stageKind, speakingAsk, speakHold, speakScore, speakWords, talkTitle, shares, PITCHES_PER_RUN, STAGE_SHARE, QUIET_AFTER_DAYS,
  inviteHold, invitedGuests, invitesThisWeek, weeklyInvites, londonWeekStart, pickInvites, inviteWords, inviteShow, inviteCard, guestTopic, guestName, reachOf, INVITES_PER_RUN, INVITES_A_WEEK } from '../src/stages/pitches.mjs';
import { lessons, titleFor, OWN_SHOW, WORDS, KRISH_TITLE, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, BECAUSE_MAX, TITLE_MAX_BRIEF } from '../src/stages/rows.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';
import { golden } from './support/golden.mjs';
import { STAGE, GUEST } from './support/standard.mjs';

// Synthetic only: invented shows, .test and example addresses, no live record.
const NOW = '2026-10-27T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you'll need. |\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Send the Mindmake one-pagers and offers to warm leads', 'Have a clear plan for driving partnerships and visibility for Mindmake'];
const RECEIPTS = `export const receipts = {\n  credentials: [\n    'Founder, Example OS',\n    'Public Speaker (Example Concert Hall)',\n  ],\n  roles: [\n    {\n      org: 'Example Broadcasting',\n      title: 'Head of Data',\n      detail:\n        "grew data revenue from $1M to $9M in three years. Launched 12 products.",\n    },\n    { org: 'Second Co', title: '', detail: 'built a team.' },\n  ],\n};\n`;
const RECORD = { line: parseRecord(RECEIPTS), file: { repo: RECORD_REPO, path: RECORD_PATH, sha: blobSha(RECEIPTS) } };
const EM = String.fromCharCode(8212);

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stage = (n, over = {}) => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', verdict: 'unjudged', organizer: 'Avery Example', buried_at: null, applied_at: null,
  event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, episodes: 80, latest_episode_at: '2026-10-20T00:00:00Z', booking_contact_id: id(100 + n), booking_source: 'feed_owner',
  audience: 'Marketing leaders at mid-size companies', angle: null, why_him: 'The show interviews operators who changed how a company works.', why_now: null, ...over });
const ctx = (visibility, over = {}) => ({ records: { visibility, drafts: [] }, feedback: [], ...over });

test('his track record is read from his own site\'s file, whole, or left out', async () => {
  assert.equal(RECORD.line, 'At Example Broadcasting he grew data revenue from $1M to $9M in three years, and he has spoken at the Example Concert Hall.');
  assert.equal(parseRecord(RECEIPTS.replace("'Public Speaker (Example Concert Hall)',", '')), 'At Example Broadcasting he grew data revenue from $1M to $9M in three years.', 'the role alone');
  assert.equal(parseRecord("credentials: ['Public Speaker (The Example Hall)']"), 'He has spoken at The Example Hall.', 'the stage alone, never "the The"');
  assert.equal(parseRecord('export const nothing = {}'), null, 'nothing readable, nothing said');
  assert.equal(parseRecord("roles: [{ org: 'Example Co', detail: 'Grew revenue.' }]"), null, 'a detail that is not a clause he can follow is not used');
  const read = await readRecord({ fetcher: async url => { assert.ok(String(url).endsWith(RECORD_PATH)); return new Response(RECEIPTS); } });
  assert.deepEqual(read, RECORD, 'named by the blob SHA of the file read this run');
  assert.equal(await readRecord({ fetcher: async () => new Response(RECEIPTS, { status: 404 }) }), null, 'a failed read is no record, whatever its body says');
  assert.equal(await readRecord({ fetcher: async () => { throw new Error('offline'); } }), null, 'unreadable leaves the record out; it never holds a pitch');
});

test('a host is addressed by first name only when the stage names one person', () => {
  assert.equal(hostOf({ organizer: 'Avery Example' }), 'Avery Example');
  assert.equal(hostOf({ organizer: 'Dr. Avery Example' }), 'Avery Example', 'never a title');
  for (const o of ['Example Media', 'Avery Example & Sam Sample', 'Avery', 'The Example Show', 'Example Studios', 'avery example', 'Avery Example 2', null]) assert.equal(hostOf({ organizer: o }), null, String(o));
  assert.match(pitchWords({ show: 'S', host: 'Avery Example', topic: null, canon, record: null }).body, /^Hi Avery,/);
  assert.match(pitchWords({ show: 'S', host: null, topic: null, canon, record: null }).body, /^Hi there,/);
});

test('a show\'s topic comes from its own title and what is held about it; null when nothing says', () => {
  assert.equal(showTopic(stage(1)), 'marketing');
  assert.equal(showTopic({ title: 'The Recruiting Hour' }), 'talent');
  assert.equal(showTopic({ title: 'Conversations' }), null);
});

test('only a live show with an address of its own, not pitched before and not ruled out, is pitched', () => {
  const L = lessons([], NOW);
  const hold = (over, extra = {}) => pitchHold(stage(1, over), { L, pitched: new Set(), at: NOW, ...extra });
  assert.equal(hold({}), null);
  assert.equal(hold({ type: 'conference' }), 'not_a_podcast');
  assert.equal(hold({ booking_contact_id: null }), 'no_booking_address');
  assert.equal(hold({ booking_contact_id: 'not-an-id' }), 'no_booking_address');
  assert.equal(hold({ buried_at: '2026-10-01T00:00:00Z' }), 'buried');
  assert.equal(hold(STAGE.rejected), 'rejected', 'the visibility standard refuses it on its axes');
  assert.equal(hold({ ...STAGE.rejected, verdict: 'take' }), 'rejected', "the engine's verdict decides, not Control Center's");
  assert.equal(hold({ ...STAGE.take, verdict: 'rejected' }), null, "Control Center's stored verdict is never read");
  assert.equal(hold({ verdict: 'rejected' }), null, 'with no axes served the engine has not judged it, and an unjudged show is pitched as before');
  assert.equal(hold({ ...STAGE.take, event_start_at: '2026-10-01T00:00:00Z' }), 'rejected', 'the standard refuses a passed date');
  assert.equal(hold({ status: 'applied' }), 'applied');
  assert.equal(hold({ applied_at: '2026-10-01T00:00:00Z' }), 'applied');
  assert.equal(hold({ title: 'Signal & Noise' }), 'own_show', 'his own show is no booking');
  assert.equal(hold({ organizer: 'makeyourmindup' }), 'own_show');
  assert.equal(hold({ latest_episode_at: null }), 'quiet_show', 'an unknown latest episode is not live');
  assert.equal(hold({ latest_episode_at: new Date(Date.parse(NOW) - (QUIET_AFTER_DAYS + 1) * 86400000).toISOString() }), 'quiet_show');
  assert.equal(hold({}, { pitched: new Set([id(1)]) }), 'already_pitched');
  const no = (reason_code, extra = {}) => lessons([{ state: 'declined', decided_at: NOW, row: 'visibility', subject_ref: `target:${id(9)}`, reason_code, amplifier_kind: 'broadcaster', features: { sector: null, topic: 'marketing', seniority: null }, reach: { band: 'unknown' }, ...extra }], NOW);
  assert.equal(pitchHold(stage(9), { L: no(null), pitched: new Set(), at: NOW }), 'declined_on_row', 'a No on the show is kept');
  assert.equal(pitchHold(stage(1), { L: no('not_my_topic'), pitched: new Set(), at: NOW }), 'not_my_topic', 'his reason reaches shows like it');
  assert.equal(pitchHold(stage(1), { L: no('wrong_audience'), pitched: new Set(), at: NOW }), 'wrong_audience');
  assert.equal(pitchHold(stage(1, { title: 'The Recruiting Hour', audience: null }), { L: no('not_my_topic'), pitched: new Set(), at: NOW }), null, 'another topic is not like it');
});

test('a show with a draft, or an answer on its pitch, is pitched once', () => {
  const pitched = pitchedStages({ records: { drafts: [{ visibility_target_id: id(1) }, { visibility_target_id: null }] }, feedback: [
    { subject_ref: `target:${id(2)}`, row: 'visibility', state: 'approved' },
    { subject_ref: `target:${id(3)}`, row: 'visibility', state: 'pending' },
    { subject_ref: `contact:${id(4)}`, row: 'visibility', state: 'approved' },
  ] });
  assert.deepEqual([...pitched].sort(), [id(1), id(2)], 'a pending pitch may be written again with the same id; a contact is not a show');
});

test('shows rank by the visibility standard\'s verdict, how recently they published, whether his buyer listens, and how long they have run', () => {
  assert.ok(pitchScore(stage(1, STAGE.take), NOW) > pitchScore(stage(1, STAGE.stretch), NOW));
  assert.ok(pitchScore(stage(1, STAGE.stretch), NOW) > pitchScore(stage(1), NOW));
  assert.equal(pitchScore(stage(1, { verdict: 'take' }), NOW), pitchScore(stage(1), NOW), "Control Center's stored verdict alone ranks nothing");
  assert.equal(pitchScore(stage(1, { ...STAGE.stretch, verdict: 'take' }), NOW), pitchScore(stage(1, STAGE.stretch), NOW), 'the axes rank it');
  assert.ok(pitchScore(stage(1), NOW) > pitchScore(stage(1, { latest_episode_at: '2026-08-01T00:00:00Z' }), NOW), 'recent first');
  assert.ok(pitchScore(stage(1), NOW) > pitchScore(stage(1, { title: 'The Gardening Hour', audience: 'Gardeners' }), NOW), 'a room his buyer is in');
  assert.ok(pitchScore(stage(1, { episodes: 400 }), NOW) > pitchScore(stage(1, { episodes: 10 }), NOW), 'by log of its run');
});

test('a pitch is a 1.9.0 visibility row for Jonny\'s box, in Jonny\'s words, about the show, with no address', () => {
  const r = pitchRows({ context: ctx([stage(1, STAGE.take), stage(2), stage(3, { organizer: 'Example Media' })]), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: NOW, titleMax: TITLE_MAX_BRIEF });
  assert.equal(r.proposals.length, 3);
  const [p] = r.proposals;
  assert.equal(p.rank, 1);
  assert.equal(p.subject_ref, `target:${id(1)}`, 'about the show');
  assert.equal(p.target, id(101), 'to the address the show publishes, by its contact id');
  assert.equal(p.row, 'visibility');
  assert.equal(p.wall, 'send');
  assert.equal(p.stage, null);
  assert.equal(p.amplifier_kind, 'broadcaster');
  assert.deepEqual(p.features, { sector: null, topic: 'marketing', seniority: null });
  assert.equal(p.serves, GOALS[1]);
  assert.deepEqual(p.source_revision, [...FILES, RECORD.file], 'every file the words came from, his site\'s included');
  const a = JSON.parse(p.exact_payload);
  assert.deepEqual(Object.keys(a).sort(), ['body', 'channel', 'form', 'mailbox', 'recipient_contact_id', 'subject', 'version']);
  assert.equal(a.mailbox, 'jonny');
  assert.equal(a.recipient_contact_id, id(101));
  assert.equal(a.subject, 'A guest for The Example Show 1: AI for marketing leaders');
  const body = a.body;
  assert.match(body, /^Hi Avery,\n\nI work with Krish Raja, and I think he'd make a strong guest for The Example Show 1 on what an AI that knows a marketing leader should actually do\./, 'the point first, in Jonny\'s voice');
  assert.ok(body.includes(`He's ${KRISH_TITLE} and writes Make Your Mind Up (https://publication.example).`), 'his title as he ruled, his publication as the canon names it');
  assert.ok(body.includes(`At Mindmake he helps leaders build their AI brain: "${canon.brain}"`), 'Mindmake only in the canon\'s own words, quoted whole');
  assert.ok(body.includes(RECORD.line), 'his record as his site publishes it');
  assert.ok(body.endsWith('\n\nJonny'), 'signed Jonny');
  assert.equal((body.match(/\?/g) ?? []).length, 1, 'one ask');
  assert.equal(/@|\+\d{6}/.test(body), false, 'never an address or a number');
  assert.equal(body.includes(EM) || a.subject.includes(EM), false, 'no em dash');
  assert.equal(/\bI'm Krish\b|\bmy\b/i.test(body), false, 'Krish is in the third person');
  assert.ok(p.title.length <= TITLE_MAX_BRIEF);
  assert.ok(p.because.length <= BECAUSE_MAX);
  assert.equal(p.because, 'A podcast with 80 episodes, latest Oct 2026. Jonny pitches you.');
  const c = p.card;
  assert.ok(c.who.length <= CARD_WHO_MAX && c.who.startsWith('The Example Show 1 is a podcast with 80 episodes, hosted by Avery Example.'));
  assert.ok(c.known.length <= CARD_LINE_MAX && /You do not know them yet/.test(c.known));
  assert.ok(c.why.length >= 1 && c.why.length <= 3 && c.why.every(l => l.length <= CARD_LINE_MAX));
  assert.ok(c.gain[0].startsWith('A guest spot on The Example Show 1'));
  assert.ok(c.angles.length >= 1 && c.angles.every(x => x.title.length <= 60 && x.line.length <= CARD_LINE_MAX));
  assert.ok(c.sources.every(s => /^https:\/\/\S+$/.test(s.url) && !NOT_A_SOURCE.test(s.url)));
  assert.equal(/@[a-z]/i.test(JSON.stringify(c)), false);
  const team = JSON.parse(r.proposals.find(x => x.subject_ref === `target:${id(3)}`).exact_payload).body;
  assert.match(team, /^Hi there,/, 'a publisher is never greeted as a person');
  const bare = pitchRows({ context: ctx([stage(1)]), weekGoals: GOALS, canon, record: null, files: FILES, at: NOW }).proposals[0];
  assert.equal(bare.source_revision.length, FILES.length, 'no record read, no record named');
  assert.equal(JSON.parse(bare.exact_payload).body.includes('he has spoken'), false, 'and nothing said from memory');
});

test('at most ten a run, best first, and the rest counted', () => {
  const many = Array.from({ length: 14 }, (_, i) => stage(i + 1, i === 13 ? STAGE.take : {}));
  const r = pitchRows({ context: ctx(many), weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(r.proposals.length, PITCHES_PER_RUN);
  assert.equal(r.proposals[0].subject_ref, `target:${id(14)}`, 'the show the visibility standard judged worth taking first');
  assert.deepEqual(r.proposals.map(p => p.rank), Array.from({ length: PITCHES_PER_RUN }, (_, i) => i + 1));
  assert.equal(r.held.filter(h => h === 'pitch_per_run_cap').length, 4);
  const mixed = pitchRows({ context: ctx([stage(1), stage(2, { type: 'conference' }), stage(3, { booking_contact_id: null })]), weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.deepEqual(mixed.held, ['no_booking_address'], 'a conference is not a show and is not counted as one');
});

// ── The leftovers of round 2 (live run manual-23, synthetic shapes) ─────────

test('a title never carries an honorific, his own show is caught by Control Center\'s slug, and a partner email is about who they back', () => {
  assert.equal(titleFor('partner', 'investor', 'Dr. Avery Example', '', 56), 'Offer Avery Example a session for their leaders');
  assert.equal(titleFor('introduce', 'connector', 'Prof Avery Example', '', 56), 'Ask Avery Example for one introduction');
  for (const t of ['co-hosts with Krish on the lane signal_noise', 'Make Your Mind Up', 'make_your_mind_up guest', 'Signal and Noise']) assert.ok(OWN_SHOW.test(t), t);
  assert.equal(OWN_SHOW.test('Signals from the noise floor'), false);
  const siteCanon = { ...canon, site: { revenue: { label: 'Build your AI revenue engine', line: 'The pricing, positioning and team you\'ll need.' } } };
  const words = WORDS.partner[0]({ kind: 'investor', company: 'Northwind Capital' }, siteCanon);
  assert.equal(words.subject, 'A session for the leaders Northwind Capital backs');
  assert.ok(words.lines[0].startsWith('For the companies Northwind Capital backs or runs: the pricing'), 'their angle first');
  assert.ok(words.lines[1].includes('Northwind Capital backs'));
  const other = WORDS.partner[0]({ kind: 'investor', company: 'Southwind Partners' }, siteCanon);
  assert.notEqual(words.lines.join(' '), other.lines.join(' '), 'two partners, two emails');
  assert.equal(WORDS.partner[0]({ kind: 'investor', company: '' }, canon).subject, 'A session for the leaders you back', 'nobody named, nothing invented');
});

test('a dispatch run reports pitches at 1.9.0 only where Control Center serves it, and holds them otherwise', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  for (const [served, expected] of [[['1.6.0', '1.7.0', '1.8.0', '1.9.0'], '1.9.0'], [['1.6.0', '1.7.0', '1.8.0'], '1.8.0']]) {
    const reports = [];
    let recordReads = 0;
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: served.at(-1), week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
      context: async () => ({ ok: true, context: { schema_version: served.at(-1), engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [], visibility: [stage(1, { verdict: 'take' }), stage(2)], drafts: [{ visibility_target_id: id(2) }] }, amplifier_candidates: [], routes: {}, feedback: [], research: [] } }),
      decisions: async () => [], postReport: async rep => { reports.push(golden(rep)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: `gma-pitch-${expected.replace(/\./g, '')}-1234`, clock: () => NOW,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => { recordReads++; return RECORD; } });
    assert.equal(result.status, 'succeeded', expected);
    const rep = reports[0];
    assert.equal(rep.schema_version, expected);
    const pitches = rep.proposals.filter(p => { try { return JSON.parse(p.exact_payload).mailbox === 'jonny'; } catch { return false; } });
    if (expected === '1.9.0') {
      assert.equal(pitches.length, 1, 'the show already drafted is not pitched again');
      assert.equal(pitches[0].subject_ref, `target:${id(1)}`, 'the report keeps the show as the subject, never the address\'s contact');
      assert.equal(recordReads, 1);
      assert.deepEqual(violations(schema, rep), []);
      assert.ok(rep.holds.some(h => h.reason === 'pitch_already_pitched'));
    } else {
      assert.equal(pitches.length, 0);
      assert.equal(recordReads, 0, 'nothing is read for a pitch that cannot be sent');
      assert.ok(rep.holds.some(h => h.reason === 'pitch_needs_1_9_0'));
    }
  }
});

// ── Speaking pitches on EVENTS (protocol 1.9.0, synthetic shapes) ───────────

const summit = (n, over = {}) => ({ id: id(n), title: `The Example Summit ${n}`, type: 'conference', status: 'queued', verdict: 'unjudged', organizer: 'Example Events Ltd', buried_at: null, applied_at: null,
  event_url: `https://summit.example/${n}`, cfp_url: null, deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-03-10T00:00:00Z', location: 'London', booking_contact_id: id(200 + n), booking_source: 'stage_page',
  audience: 'Marketing leaders at mid-size companies', angle: null, why_him: null, why_now: null, room_score: null, standing_score: null, only_him_score: null, ...over });

test('a stage to speak on is a conference, a call for papers, a speaking slot, or anything that says webinar or panel; press never is', () => {
  assert.equal(stageKind(stage(1)), 'podcast');
  for (const type of ['conference', 'cfp', 'speaking']) assert.equal(stageKind({ type }), 'stage', type);
  assert.equal(stageKind({ type: 'other', title: 'AI Leaders Webinar' }), 'stage');
  assert.equal(stageKind({ type: 'other', format: 'Panel discussion' }), 'stage');
  assert.equal(stageKind({ type: 'press_relationship', title: 'A panel of editors' }), null, 'press is a relationship, not a stage');
  assert.equal(stageKind({ type: 'newsletter' }), null);
  assert.equal(stageKind({ type: 'other', title: 'An award' }), null);
  assert.equal(speakingAsk({ title: 'The CMO Panel' }), 'a panel seat');
  assert.equal(speakingAsk({ title: 'The Example Summit' }), 'a talk');
});

test('only an open stage with an address for speakers, before its deadline, not pitched before and not ruled out, is pitched', () => {
  const L = lessons([], NOW);
  const hold = (over, extra = {}) => speakHold(summit(1, over), { L, pitched: new Set(), at: NOW, ...extra });
  assert.equal(hold({}), null);
  assert.equal(hold({ type: 'podcast' }), 'not_a_stage');
  assert.equal(hold({ booking_contact_id: null }), 'no_booking_address');
  assert.equal(hold({ buried_at: '2026-10-01T00:00:00Z' }), 'buried');
  assert.equal(hold(STAGE.rejected), 'rejected', 'the visibility standard refuses it on its axes');
  assert.equal(hold({ verdict: 'rejected' }), null, "Control Center's stored verdict is never read: with no axes served it is unjudged, as before");
  assert.equal(hold({ status: 'applied' }), 'applied');
  assert.equal(hold({ applied_at: '2026-10-01T00:00:00Z' }), 'applied');
  assert.equal(hold({ status: 'dropped' }), 'not_open');
  assert.equal(hold({ organizer: 'Signal & Noise' }), 'own_show');
  assert.equal(hold({ deadline_at: '2026-10-26T00:00:00Z' }), 'deadline_passed');
  assert.equal(hold({ deadline_at: null, event_start_at: '2026-10-01T00:00:00Z' }), 'event_passed');
  assert.equal(hold({ deadline_at: null, event_start_at: null }), null, 'no date known is still open');
  assert.equal(hold({}, { pitched: new Set([id(1)]) }), 'already_pitched');
  const no = (reason_code, extra = {}) => lessons([{ state: 'declined', decided_at: NOW, row: 'events', subject_ref: `target:${id(9)}`, reason_code, amplifier_kind: 'ceo_educator', features: { sector: null, topic: 'marketing', seniority: null }, reach: { band: 'unknown' }, ...extra }], NOW);
  assert.equal(speakHold(summit(9), { L: no(null), pitched: new Set(), at: NOW }), 'declined_on_row', 'a No on the stage is kept');
  assert.equal(speakHold(summit(1), { L: no('not_my_topic'), pitched: new Set(), at: NOW }), 'not_my_topic', 'his reason reaches stages like it');
  assert.equal(speakHold(summit(1), { L: no('wrong_audience'), pitched: new Set(), at: NOW }), 'wrong_audience');
  assert.equal(speakHold(summit(1, { title: 'The Recruiting Summit', audience: null }), { L: no('not_my_topic'), pitched: new Set(), at: NOW }), null, 'another topic is not like it');
  const answered = pitchedStages({ records: { drafts: [] }, feedback: [{ subject_ref: `target:${id(5)}`, row: 'events', state: 'declined' }] });
  assert.ok(answered.has(id(5)), 'an answer on a speaking pitch counts as pitched');
});

test('stages rank by the visibility standard\'s verdict, its three axes, how soon the call closes, and whether his buyer is in the room', () => {
  assert.ok(speakScore(summit(1, STAGE.take), NOW) > speakScore(summit(1, STAGE.stretch), NOW));
  assert.ok(speakScore(summit(1, STAGE.stretch), NOW) > speakScore(summit(1), NOW));
  assert.equal(speakScore(summit(1, { verdict: 'take' }), NOW), speakScore(summit(1), NOW), "Control Center's stored verdict alone ranks nothing");
  assert.ok(speakScore(summit(1, { score_version: 1, room_score: 90, standing_score: 85, only_him_score: 80 }), NOW) > speakScore(summit(1), NOW), 'a judged strong room first');
  assert.ok(speakScore(summit(1, { score_version: 1, room_score: 90, standing_score: 20, only_him_score: 80 }), NOW) < speakScore(summit(1), NOW), 'by its weakest axis');
  assert.equal(speakScore(summit(1, { score_version: 0, room_score: 90, standing_score: 20, only_him_score: 80 }), NOW), speakScore(summit(1), NOW), 'axes judged under another version are not read');
  assert.ok(speakScore(summit(1, { deadline_at: '2026-11-05T00:00:00Z' }), NOW) > speakScore(summit(1, { deadline_at: '2027-01-30T00:00:00Z' }), NOW), 'a call closing soon first');
  assert.ok(speakScore(summit(1), NOW) > speakScore(summit(1, { title: 'The Gardening Summit', audience: 'Gardeners' }), NOW), 'a room his buyer is in');
});

test('the talk is the one Nova suggested for the room, else one from its topic', () => {
  assert.equal(talkTitle({ suggested_talk_title: '"The org chart after AI."' }, 'marketing'), 'The org chart after AI');
  assert.equal(talkTitle({ suggested_talk_title: 'x'.repeat(81) }, 'marketing'), 'AI for marketing leaders', 'too long for a subject');
  assert.equal(talkTitle({ suggested_talk_title: 'Live from Signal & Noise' }, 'marketing'), 'AI for marketing leaders', 'never his own show as a talk');
  assert.equal(talkTitle({}, null), 'An AI that knows the leader');
});

test('a speaking pitch is a 1.9.0 events row for Jonny\'s box, in Jonny\'s words, about the stage, with no address', () => {
  const r = pitchRows({ context: ctx([summit(1, STAGE.take), summit(2, { title: 'The CMO Panel Example', deadline_at: null })]), weekGoals: [...GOALS, 'Speak at one event this month'], canon, record: RECORD, files: FILES, at: NOW, titleMax: TITLE_MAX_BRIEF });
  assert.equal(r.proposals.length, 2);
  const [p, q] = r.proposals;
  assert.equal(p.row, 'events');
  assert.equal(p.rank, 1);
  assert.equal(q.rank, 2);
  assert.equal(p.subject_ref, `target:${id(1)}`, 'about the stage');
  assert.equal(p.target, id(201), 'to the address its page gives for speakers, by its contact id');
  assert.equal(p.wall, 'send');
  assert.equal(p.stage, null);
  assert.equal(p.amplifier_kind, 'ceo_educator');
  assert.equal(p.serves, 'Speak at one event this month');
  assert.ok(Date.parse(p.expires_at) <= Date.parse('2026-11-20T00:00:00Z'), 'never outlives its call');
  const a = JSON.parse(p.exact_payload);
  assert.equal(a.mailbox, 'jonny');
  assert.equal(a.recipient_contact_id, id(201));
  assert.equal(a.subject, 'A speaker for The Example Summit 1: AI for marketing leaders');
  assert.match(a.body, /^Hi there,\n\nI work with Krish Raja, and I'd like to put him forward for a talk at The Example Summit 1: "AI for marketing leaders"\./, 'a company is never greeted as a person');
  assert.ok(a.body.includes(`He's ${KRISH_TITLE} and writes Make Your Mind Up (https://publication.example).`));
  assert.ok(a.body.includes(RECORD.line));
  assert.ok(a.body.endsWith('\n\nJonny'));
  assert.equal((a.body.match(/\?/g) ?? []).length, 1, 'one ask');
  assert.equal(/@|\+\d{6}/.test(a.body), false, 'never an address or a number');
  assert.equal(a.body.includes(EM) || a.subject.includes(EM), false, 'no em dash');
  assert.match(JSON.parse(q.exact_payload).body, /for a panel seat at The CMO Panel Example/);
  assert.ok(p.title.length <= TITLE_MAX_BRIEF);
  assert.equal(p.because, 'A stage in Mar 2027, call closes 20 Nov. Jonny pitches you.');
  assert.ok(p.because.length <= BECAUSE_MAX);
  const c = p.card;
  assert.ok(c.who.startsWith('The Example Summit 1 is an event run by Example Events Ltd, in Mar 2027, London.') && c.who.length <= CARD_WHO_MAX);
  assert.match(c.known, /You do not know them yet/);
  assert.ok(c.why.some(l => l.includes('closes on 20 Nov')));
  assert.ok(c.gain[0].startsWith('A talk at The Example Summit 1, in front of Marketing leaders'));
  assert.ok(c.angles.length >= 1 && c.angles.every(x => x.title.length <= 60 && x.line.length <= CARD_LINE_MAX));
  assert.deepEqual(c.sources.map(x => x.url), ['https://summit.example/1']);
  assert.equal(/@[a-z]/i.test(JSON.stringify(c)), false);
});

test('podcasts and stages share the ten: each its share, and what one kind cannot fill goes to the other', () => {
  assert.equal(STAGE_SHARE, 4);
  assert.deepEqual(shares(14, 0), { podcasts: 10, stages: 0 });
  assert.deepEqual(shares(14, 10), { podcasts: 6, stages: 4 });
  assert.deepEqual(shares(2, 10), { podcasts: 2, stages: 8 });
  assert.deepEqual(shares(8, 2), { podcasts: 8, stages: 2 });
  assert.deepEqual(shares(0, 3), { podcasts: 0, stages: 3 });
  const many = pitchRows({ context: ctx([...Array.from({ length: 8 }, (_, i) => stage(i + 1)), ...Array.from({ length: 6 }, (_, i) => summit(i + 20))]), weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(many.proposals.filter(p => p.row === 'visibility').length, 6);
  assert.equal(many.proposals.filter(p => p.row === 'events').length, 4);
  assert.equal(many.held.filter(h => h === 'pitch_per_run_cap').length, 2);
  assert.equal(many.stageHeld.filter(h => h === 'pitch_per_run_cap').length, 2);
  assert.deepEqual(many.proposals.filter(p => p.row === 'events').map(p => p.rank), [1, 2, 3, 4], 'ranks start at 1 within each row');
  const mixed = pitchRows({ context: ctx([stage(1), summit(2, { booking_contact_id: null }), { ...summit(3), type: 'press_relationship' }]), weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.deepEqual(mixed.held, [], 'a podcast\'s holds and a stage\'s are counted apart');
  assert.deepEqual(mixed.stageHeld, ['no_booking_address'], 'press is not a stage and is not counted as one');
});

test('a dispatch run at 1.9.0 reports speaking pitches on events and says why the others were not pitched', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0'];
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [], visibility: [stage(1), summit(2), summit(3, { deadline_at: '2026-10-01T00:00:00Z' })], drafts: [] }, amplifier_candidates: [], routes: {}, feedback: [], research: [] } }),
    decisions: async () => [], postReport: async rep => { reports.push(golden(rep)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-speak-190-1234', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
  assert.equal(result.status, 'succeeded');
  const rep = reports[0];
  assert.equal(rep.schema_version, '1.9.0');
  const speaking = rep.proposals.filter(p => p.row === 'events' && JSON.parse(p.exact_payload).mailbox === 'jonny');
  assert.equal(speaking.length, 1);
  assert.equal(speaking[0].subject_ref, `target:${id(2)}`, 'the stage stays the subject, never the address\'s contact');
  assert.ok(rep.holds.some(h => h.reason === 'speak_deadline_passed'));
  assert.deepEqual(violations(schema, rep), []);
});

// ── Guest invites for his own shows (protocol 1.9.0, synthetic shapes) ──────

const NAMES = ['Avery Example', 'Sam Sample', 'Jordan Test', 'Riley Placeholder', 'Casey Demo', 'Morgan Fixture'];
const guest = (n, over = {}) => ({ contact_id: id(300 + n), name: NAMES[(n - 1) % NAMES.length], status: 'enriched', invite_show: 'makeyourmindup', invite_state: null, scheduled_at: null,
  ...GUEST.take, buried_at: null, recorded_at: null, published_at: null,
  one_liner: 'Chief Marketing Officer at Example Retail, rebuilding a marketing team around AI', why_fit: 'Runs a marketing team that changed how it works with AI.',
  evidence: [{ url: `https://talks.example/guest-${n}`, label: 'How marketing teams change with AI', at: '2026-10-01T00:00:00Z', kind: 'talk' }], ...over });
const route = (...ns) => Object.fromEntries(ns.map(n => [id(300 + n), { email: 'verified' }]));
const invitedOn = (n, decided_at, over = {}) => ({ proposal_id: `gmp-${n}`, state: 'done', stage: null, decided_at, reference: 'visibility:invite', row: 'visibility', subject_ref: `contact:${id(300 + n)}`, carried_out: 'draft', reason_code: null, reason_text: null, amplifier_kind: null, features: null, reach: null, ...over });

test('the week\'s invites follow the shows\' shares, and Make Your Mind Up gets one every week', () => {
  assert.equal(INVITES_A_WEEK, 4);
  assert.deepEqual(weeklyInvites(), { makeyourmindup: 3, signal_noise: 1 });
  assert.deepEqual(weeklyInvites(1), { makeyourmindup: 1, signal_noise: 0 }, 'one a week is the weekly conversation');
  assert.deepEqual(weeklyInvites(10), { makeyourmindup: 7, signal_noise: 3 }, 'seventy and thirty');
});

test('his week starts on Monday in London, in winter and in summer', () => {
  assert.equal(new Date(londonWeekStart(NOW)).toISOString(), '2026-10-25T23:00:00.000Z', 'a Tuesday in GMT: Monday midnight, an hour early');
  assert.equal(new Date(londonWeekStart('2026-07-01T12:00:00Z')).toISOString(), '2026-06-28T23:00:00.000Z', 'a Wednesday in BST: Monday midnight exactly');
  assert.equal(new Date(londonWeekStart('2026-11-01T23:30:00Z')).toISOString(), '2026-10-25T23:00:00.000Z', 'Sunday night is still the week before');
  assert.equal(new Date(londonWeekStart('2026-07-05T23:30:00Z')).toISOString(), '2026-07-05T23:00:00.000Z', 'half past midnight on a BST Monday is the new week');
});

test('a guest is invited only when judged worth having, with an address, a full name, not invited before and not ruled out', () => {
  const L = lessons([], NOW);
  const hold = (over, extra = {}) => inviteHold(guest(1, over), { L, invited: new Set(), routes: route(1), at: NOW, ...extra });
  assert.equal(hold({}), null);
  assert.equal(hold({ contact_id: null }), 'no_contact');
  assert.equal(hold({ contact_id: 'not-an-id' }), 'no_contact');
  assert.equal(hold({ invite_show: null }), 'no_show', 'a guest judged for no show of his is not invited');
  assert.equal(hold({ invite_show: 'another_show' }), 'no_show');
  assert.equal(hold({ buried_at: '2026-10-01T00:00:00Z' }), 'buried');
  assert.equal(hold({ recorded_at: '2026-10-01T00:00:00Z' }), 'recorded');
  assert.equal(hold({ published_at: '2026-10-01T00:00:00Z' }), 'recorded');
  assert.equal(hold({ status: 'scouted' }), null, 'scouted is open');
  assert.equal(hold({ status: 'booked' }), 'not_open');
  assert.equal(hold({ invite_state: 'proposed' }), null, 'proposed is not yet invited');
  for (const s of ['drafted', 'booked', 'declined']) assert.equal(hold({ invite_state: s }), 'already_invited', s);
  assert.equal(hold(GUEST.stretch), null, 'a stretch is worth asking');
  assert.equal(hold(GUEST.rejected), 'guest_rejected', 'the guest standard refuses it on its axes');
  assert.equal(hold({ ...GUEST.rejected, guest_verdict: 'take' }), 'guest_rejected', "the engine's verdict decides, not Control Center's");
  assert.equal(hold({ guest_verdict: 'rejected' }), null, "Control Center's stored verdict is never read: the axes take them");
  assert.equal(hold({ guest_verdict: 'unjudged', senior_score: null, seen_score: null, spark_score: null }), 'guest_not_judged');
  const { senior_score, seen_score, spark_score, ...unserved } = guest(1);
  assert.equal(inviteHold(unserved, { L, invited: new Set(), routes: route(1), at: NOW }), 'guest_not_judged', "axes not served: not judged, whatever Control Center's verdict says");
  assert.equal(hold({ name: 'Avery' }), 'no_name');
  assert.equal(hold({ name: 'Dr Avery' }), 'no_name', 'a title is not a surname');
  assert.equal(hold({ name: 'Krish Raja' }), 'krish_himself');
  assert.equal(hold({}, { routes: {} }), 'no_email');
  assert.equal(hold({}, { routes: { [id(301)]: { email: 'none' } } }), 'no_email');
  assert.equal(hold({}, { routes: { [id(301)]: { email: 'unchecked' } } }), null, 'an unchecked address may be drafted');
  assert.equal(hold({}, { invited: new Set([id(301)]) }), 'already_invited');
  const no = (extra = {}) => lessons([{ state: 'declined', decided_at: NOW, row: 'visibility', subject_ref: `contact:${id(309)}`, reason_code: null, amplifier_kind: null, features: { sector: null, topic: 'marketing', seniority: null }, reach: { band: 'unknown' }, ...extra }], NOW);
  assert.equal(inviteHold(guest(9), { L: no(), invited: new Set(), routes: route(9), at: NOW }), 'declined_on_row', 'a No on the guest is kept');
  assert.equal(inviteHold(guest(1), { L: no({ reason_code: 'not_my_topic' }), invited: new Set(), routes: route(1), at: NOW }), 'not_my_topic', 'his reason reaches guests like them');
  assert.equal(inviteHold(guest(1, { one_liner: 'Head of hiring at Example Co', why_fit: 'Writes about recruiting.' }), { L: no({ reason_code: 'not_my_topic' }), invited: new Set(), routes: route(1), at: NOW }), null, 'another topic is not like it');
  assert.equal(guestTopic(guest(1)), 'marketing');
  assert.equal(guestTopic({ one_liner: null, why_fit: null }), null);
  assert.equal(guestName({ name: 'Dr. Avery Example' }), 'Avery Example', 'never a title');
});

test('a guest invited before is invited once: an answer on their invite, on his shows\' row only', () => {
  const invited = invitedGuests({ feedback: [
    { subject_ref: `contact:${id(301)}`, row: 'visibility', state: 'done' },
    { subject_ref: `contact:${id(302)}`, row: 'visibility', state: 'declined' },
    { subject_ref: `contact:${id(303)}`, row: 'visibility', state: 'pending' },
    { subject_ref: `contact:${id(304)}`, row: 'network', state: 'done' },
    { subject_ref: `target:${id(305)}`, row: 'visibility', state: 'done' },
  ] });
  assert.deepEqual([...invited].sort(), [id(301), id(302)]);
});

test('this week\'s invites are counted by show from what was drafted since Monday', () => {
  const guests = [guest(1), guest(2), guest(3, { invite_show: 'signal_noise' })];
  const done = invitesThisWeek({ feedback: [
    invitedOn(1, '2026-10-26T08:00:00Z'),
    invitedOn(2, '2026-10-24T08:00:00Z'),
    invitedOn(3, '2026-10-26T09:00:00Z'),
    invitedOn(4, '2026-10-26T09:00:00Z'),
    invitedOn(1, '2026-10-26T10:00:00Z', { reference: 'visibility:pitch' }),
    invitedOn(2, '2026-10-26T10:00:00Z', { carried_out: null, state: 'declined' }),
  ] }, guests, NOW);
  assert.deepEqual(done, { makeyourmindup: 1, signal_noise: 1 }, 'last week, a pitch, a No and a guest not on record are not this week\'s invites');
});

test('a run invites Make Your Mind Up first, then Signal & Noise, within the week\'s room and two a run', () => {
  assert.equal(INVITES_PER_RUN, 2);
  const open = [guest(1), guest(2), guest(3), guest(4, { invite_show: 'signal_noise' }), guest(5, { invite_show: 'signal_noise' })].map(g => ({ g }));
  const ids = picked => picked.map(o => o.g.contact_id);
  const none = { makeyourmindup: 0, signal_noise: 0 };
  assert.deepEqual(ids(pickInvites(open, none)), [id(301), id(304)], 'the weekly conversation first, then the other show');
  assert.deepEqual(ids(pickInvites(open, { makeyourmindup: 3, signal_noise: 0 })), [id(304)], 'a full week for one show leaves the other');
  assert.deepEqual(ids(pickInvites(open, { makeyourmindup: 1, signal_noise: 1 })), [id(301), id(302)], 'the show with room takes both');
  assert.deepEqual(ids(pickInvites(open, { makeyourmindup: 3, signal_noise: 1 })), [], 'a full week invites nobody');
  assert.deepEqual(ids(pickInvites(open.slice(3), none)), [id(304)], 'Signal & Noise alone takes its one');
  assert.deepEqual(ids(pickInvites(open, none, 4)), [id(301), id(304), id(302), id(303)]);
});

test('an invite is one ask in Jonny\'s words, to the show it was judged for, signed Jonny', () => {
  const page = { label: 'How marketing teams change with AI.', url: 'https://talks.example/guest-1' };
  const mymu = inviteWords({ name: 'Avery Example', show: inviteShow('makeyourmindup', canon), page });
  assert.equal(mymu.subject, 'A conversation for Make Your Mind Up');
  assert.equal(mymu.body, [
    'Hi Avery,',
    'I work with Krish Raja, who writes Make Your Mind Up (https://publication.example). We\'d love to have you for one of its weekly conversations.',
    'We came across "How marketing teams change with AI", and it is exactly the kind of thinking we\'d love to hear more of.',
    'Would you be up for it in the coming weeks? I can send a short brief and a few dates.',
    'Jonny',
  ].join('\n\n'));
  const sn = inviteWords({ name: 'Sam Sample', show: inviteShow('signal_noise', canon), page: null });
  assert.equal(sn.subject, 'A conversation for Signal & Noise');
  assert.ok(sn.body.startsWith(`Hi Sam,\n\nI work with Krish Raja, ${KRISH_TITLE}. We'd love to have you on the show for a conversation.\n\nWould you`), 'no page, no line about it');
  for (const w of [mymu, sn]) {
    assert.equal((w.body.match(/\?/g) ?? []).length, 1, 'one ask');
    assert.ok(w.body.endsWith('\n\nJonny'));
    assert.equal(w.body.includes(EM) || w.subject.includes(EM), false, 'no em dash');
    assert.equal(/@|\+\d{6}/.test(w.body), false, 'never an address or a number');
  }
  for (const label of ['Talk', 'https://talks.example/guest-1', 'www.example.com/talk', 'Write to avery@example.test', 'x'.repeat(60) + ' ' + 'y'.repeat(60)]) {
    assert.equal(inviteWords({ name: 'Avery Example', show: inviteShow('makeyourmindup', canon), page: { label, url: page.url } }).body.includes('came across'), false, label);
  }
  const renamed = { ...canon, publication: { name: 'The Example Letter', url: 'https://letter.example' } };
  assert.equal(inviteWords({ name: 'Avery Example', show: inviteShow('makeyourmindup', renamed), page: null }).subject, 'A conversation for The Example Letter', 'the publication\'s name is read from the canon each run');
});

test('an invite\'s card says who the guest is, how Krish knows them, why them, what he gets, and where it was read', () => {
  const g = guest(1, { evidence: [{ url: 'https://www.linkedin.com/in/avery-example', label: 'Profile' }, { url: 'http://talks.example/old', label: 'An old talk' }, { url: 'https://talks.example/guest-1', label: 'How marketing teams change with AI' }] });
  const show = inviteShow('makeyourmindup', canon);
  const c = inviteCard({ g, name: 'Avery Example', show, topic: 'marketing', canon, contact: null, serves: GOALS[1], weekly: true });
  assert.ok(c.who.startsWith('Avery Example: Chief Marketing Officer at Example Retail') && c.who.length <= CARD_WHO_MAX);
  assert.equal(c.known, 'You do not know them yet. Jonny writes first, from his own Gmail.');
  assert.ok(c.why.includes('Runs a marketing team that changed how it works with AI.'));
  assert.ok(c.why.includes('Seen online: How marketing teams change with AI.'));
  assert.ok(c.why.includes('The guest standard judged them worth having on Make Your Mind Up.'));
  assert.ok(c.gain[0].startsWith('A guest for Make Your Mind Up\'s weekly conversation'));
  assert.ok(c.gain.some(l => l.startsWith('It serves this week\'s goal: Have a clear plan for driving partnerships and visibility')));
  assert.ok(c.angles.length === 2 && c.angles.every(a => a.title.length <= 60 && a.line.length <= CARD_LINE_MAX));
  assert.deepEqual(c.sources, [{ label: 'How marketing teams change with AI', url: 'https://talks.example/guest-1' }], 'a profile or a plain http page is never a source');
  const stretch = inviteCard({ g: guest(2, { ...GUEST.stretch, invite_show: 'signal_noise' }), name: 'Sam Sample', show: inviteShow('signal_noise', canon), topic: null, canon, contact: { known_since: '2019-03-01', source_list: ['linkedin'] }, serves: null, weekly: false });
  assert.ok(stretch.why.includes('The guest standard judged them a stretch for Signal & Noise, worth asking.'));
  assert.ok(stretch.known.startsWith('Known since 2019'), 'a guest he knows says how');
  assert.ok(stretch.gain[0].startsWith('A guest for Signal & Noise,'));
  assert.equal(/@[a-z]/i.test(JSON.stringify(c)), false);
});

test('invites rank first on visibility, take their two from the run\'s ten, and leave the podcasts the rest', () => {
  const guests = [guest(1, GUEST.stretch), guest(2), guest(3), guest(4, { invite_show: 'signal_noise' }), guest(5, { invite_show: 'signal_noise', invite_state: 'drafted' }), guest(2)];
  const r = pitchRows({ context: { ...ctx(Array.from({ length: 12 }, (_, i) => stage(i + 1))), records: { visibility: Array.from({ length: 12 }, (_, i) => stage(i + 1)), drafts: [], guests }, routes: route(1, 2, 3, 4, 5) }, weekGoals: GOALS, canon, record: RECORD, files: FILES, at: NOW, titleMax: TITLE_MAX_BRIEF });
  const invites = r.proposals.filter(p => p.close_condition.reference === 'visibility:invite');
  const pods = r.proposals.filter(p => p.close_condition.reference === 'visibility:pitch');
  assert.deepEqual(invites.map(p => p.target), [id(302), id(304)], 'the best judged guest of each show, Make Your Mind Up first');
  assert.deepEqual(invites.map(p => p.rank), [1, 2]);
  assert.equal(pods.length, PITCHES_PER_RUN - 2, 'the invites come out of the ten');
  assert.equal(pods[0].rank, 3, 'the podcasts follow the invites');
  assert.deepEqual(r.inviteHeld.sort(), ['already_invited', 'invite_week_or_run_cap', 'invite_week_or_run_cap'], 'a guest listed twice is counted once');
  assert.equal(r.held.filter(h => h === 'pitch_per_run_cap').length, 4);
  const [p] = invites;
  assert.equal(p.row, 'visibility');
  assert.equal(p.subject_ref, `contact:${id(302)}`);
  assert.equal(p.wall, 'send');
  assert.equal(p.amplifier_kind, null);
  assert.equal(p.title, 'Jonny invites Sam Sample onto Make Your Mind Up');
  assert.ok(p.title.length <= TITLE_MAX_BRIEF);
  assert.equal(p.because, 'A strong guest for Make Your Mind Up. Jonny invites them.');
  assert.equal(invites[1].because, 'A strong guest for Signal & Noise. Jonny invites them.');
  assert.ok(p.brief.length >= 2 && p.brief.length <= 6);
  assert.deepEqual(p.source_revision, FILES, 'an invite rests on the canon and the words, not his record');
  assert.equal(p.features.topic, 'marketing');
  assert.equal(p.reach.band, 'unknown');
  const a = JSON.parse(p.exact_payload);
  assert.deepEqual([a.version, a.channel, a.mailbox, a.recipient_contact_id, a.form], [2, 'email', 'jonny', id(302), null]);
  assert.equal(a.subject, 'A conversation for Make Your Mind Up');
  assert.ok(a.body.startsWith('Hi Sam,'));
  assert.equal(a.body.includes(RECORD.line), false, 'an invite asks for nothing about Krish beyond who he is');
  const again = pitchRows({ context: { records: { visibility: [], drafts: [], guests: [guest(1), guest(2)] }, routes: route(1, 2), feedback: [invitedOn(9, '2026-10-26T08:00:00Z'), invitedOn(8, '2026-10-26T08:00:00Z'), invitedOn(7, '2026-10-26T08:00:00Z')] }, weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(again.proposals.length, 2, 'invites to guests not on record count for no show');
  const full = pitchRows({ context: { records: { visibility: [], drafts: [], guests: [guest(1), guest(2), guest(7), guest(8), guest(9)] }, routes: route(1, 2), feedback: [invitedOn(9, '2026-10-26T08:00:00Z'), invitedOn(8, '2026-10-26T08:00:00Z'), invitedOn(7, '2026-10-26T08:00:00Z')] }, weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(full.proposals.length, 0, 'three Make Your Mind Up invites this week fill its week');
  assert.ok(full.inviteHeld.includes('invite_week_or_run_cap'));
});

test('a stage\'s reach is its audience size with its page and when it was read, else unknown', () => {
  const t = { audience_size: 2500, event_url: 'https://summit.example/1', updated_at: '2026-10-20T10:00:00Z' };
  assert.deepEqual(reachOf(t, 'people in its room', 'unmeasured'), { value: 2500, band: '1k_10k', basis: 'people in its room', source_url: 'https://summit.example/1', as_of: '2026-10-20T10:00:00.000Z' });
  for (const over of [{ audience_size: null }, { audience_size: 0 }, { audience_size: 12.5 }, { event_url: null }, { event_url: 'http://summit.example/1' }, { updated_at: null }]) {
    assert.deepEqual(reachOf({ ...t, ...over }, 'people in its room', 'unmeasured'), { value: null, band: 'unknown', basis: 'unmeasured', source_url: null, as_of: null }, JSON.stringify(over));
  }
  const r = pitchRows({ context: ctx([summit(1, { audience_size: 40000, updated_at: '2026-10-20T10:00:00Z' }), stage(2, { audience_size: 150000, updated_at: '2026-10-20T10:00:00Z' })]), weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(r.proposals.find(p => p.row === 'events').reach.band, '10k_100k');
  assert.equal(r.proposals.find(p => p.row === 'visibility').reach.value, 150000);
});

test('a dispatch run at 1.9.0 reports invites with the pitches, counts them, and says why the others were not invited', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0'];
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [], visibility: [stage(1)], drafts: [], guests: [guest(1), guest(2, { invite_state: 'booked' }), guest(3, GUEST.rejected)] }, amplifier_candidates: [], routes: route(1, 2, 3), feedback: [], research: [] } }),
    decisions: async () => [], postReport: async rep => { reports.push(golden(rep)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-invite-190-1234', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
  assert.equal(result.status, 'succeeded');
  const rep = reports[0];
  const jonny = rep.proposals.filter(p => JSON.parse(p.exact_payload ?? 'null')?.mailbox === 'jonny');
  assert.deepEqual(jonny.map(p => p.subject_ref), [`contact:${id(301)}`, `target:${id(1)}`], 'the invite first, then the podcast');
  assert.ok(rep.holds.some(h => h.reason === 'invite_already_invited'));
  assert.ok(rep.holds.some(h => h.reason === 'invite_guest_rejected'));
  assert.ok(rep.activity.some(a => a.line === 'Pitches for Jonny\'s Gmail: 1 guests invited onto his shows, 1 podcasts, 0 stages to speak on.'));
  assert.deepEqual(violations(schema, rep), []);
});

// ── The show-notes note (protocol 1.10.0, synthetic shapes) ─────────────────

import { showNoteRows, showNoteWords, bookedStages } from '../src/stages/shownotes.mjs';
import { untagged } from '../src/stages/traffic.mjs';
import { parseActionV2 } from './support/engine-protocol-service.mjs';

const siteCanon = { ...canon, ask: { ...canon.ask, url: 'https://mindmake.co/?start=1' } };
const booked = (n, over = {}) => ({ visibility_target_id: id(n), job: 'booked', mailbox: 'jonny', booked_at: '2026-10-26T10:00:00Z', created_at: '2026-10-20T10:00:00Z', ...over });
const conference = (n, over = {}) => stage(n, { type: 'conference', title: `The Example Summit ${n}`, ...over });

test('a booked show is asked once for the brief link, tagged for its placement; a guest invite, an unbooked pitch or one already asked is not', () => {
  const context = ctx([stage(1), stage(2), stage(3), conference(4), stage(5)], { records: { visibility: [stage(1), stage(2), stage(3), conference(4), stage(5)], drafts: [
    booked(1), booked(2), { visibility_target_id: id(2), job: 'show_notes', mailbox: 'jonny' }, booked(3, { booked_at: null }), booked(4), booked(5, { job: 'guests' })
  ] } });
  const { booked: b, asked } = bookedStages(context);
  assert.deepEqual([...b].sort(), [id(1), id(2), id(4)]);
  assert.deepEqual([...asked], [id(2)]);
  const r = showNoteRows({ context, canon: siteCanon, files: FILES, at: NOW, room: 10 });
  assert.deepEqual(r.proposals.map(p => [p.subject_ref, p.row]), [[`target:${id(1)}`, 'visibility'], [`target:${id(4)}`, 'events']]);
  assert.deepEqual(r.held, ['show_notes_asked']);
  const a = JSON.parse(r.proposals[0].exact_payload);
  assert.equal(a.kind, 'show_notes_ask');
  assert.equal(a.mailbox, 'jonny');
  assert.equal(a.recipient_contact_id, id(101));
  assert.ok(a.body.includes('https://mindmake.co/?start=1&utm_source=growth-podcast&utm_medium=referral'), 'tagged for a podcast');
  assert.ok(JSON.parse(r.proposals[1].exact_payload).body.includes('utm_source=growth-guest-seat'), 'a stage is a guest seat');
  assert.ok(a.body.endsWith('Jonny') && a.body.startsWith('Hi Avery,'));
  assert.equal(r.proposals[0].objective_key, null, 'traffic never steers the work');
  for (const p of r.proposals) {
    assert.equal(parseActionV2(p.exact_payload).ok, true, 'Control Center reads it');
    assert.equal(p.exact_payload.includes(EM), false);
  }
  assert.equal(untagged(showNoteWords({ name: 'X', host: null, kind: 'podcast', canon: siteCanon }).link), siteCanon.ask.url, 'the canon URL byte for byte');
  assert.deepEqual(showNoteRows({ context, canon, files: FILES, at: NOW, room: 10 }).held.filter(h => h === 'show_notes_no_site_link').length, 2, 'never an untagged or off-site link');
  assert.equal(showNoteRows({ context, canon: siteCanon, files: FILES, at: NOW, room: 1 }).proposals.length, 1, 'inside the day room');
});

test('pitchRows puts a booked show\'s note before any new pitch, inside the day room, only when Control Center drafts them', () => {
  const vis = [stage(1), stage(2), stage(3)];
  const context = { records: { visibility: vis, drafts: [booked(1)] }, feedback: [] };
  const off = pitchRows({ context, weekGoals: GOALS, canon: siteCanon, files: FILES, at: NOW });
  assert.equal(off.proposals.some(p => JSON.parse(p.exact_payload).kind === 'show_notes_ask'), false, 'not without the capability');
  const on = pitchRows({ context, weekGoals: GOALS, canon: siteCanon, files: FILES, at: NOW, showNotes: true });
  const first = on.proposals.filter(p => p.row === 'visibility').sort((a, b) => a.rank - b.rank)[0];
  assert.equal(JSON.parse(first.exact_payload).kind, 'show_notes_ask', 'ranked first among the Jonny drafts');
  const ranks = on.proposals.filter(p => p.row === 'visibility').map(p => p.rank);
  assert.equal(new Set(ranks).size, ranks.length, 'one rank each');
  const jonny = on.proposals.filter(p => JSON.parse(p.exact_payload).mailbox === 'jonny').length;
  assert.ok(jonny <= PITCHES_PER_RUN, 'inside the ten');
});

test('a dispatch run sends the show-notes note at 1.10.0 only where Control Center says it drafts them, inside the schema', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0'];
  for (const show_notes of [true, false]) {
    const reports = [];
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.10.0', week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true, show_notes } }),
      context: async () => ({ ok: true, context: { schema_version: '1.10.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [], visibility: [stage(1), stage(2)], drafts: [booked(1)] }, amplifier_candidates: [], routes: {}, feedback: [], research: [] } }),
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: `gma-notes-${show_notes}-1234`, clock: () => NOW,
      canonReader: async () => siteCanon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/shownotes.mjs', sha: 'c'.repeat(40) }], recordReader: async () => RECORD });
    assert.equal(result.status, 'succeeded', String(show_notes));
    const rep = reports[0];
    const notes = rep.proposals.filter(p => { try { return JSON.parse(p.exact_payload).kind === 'show_notes_ask'; } catch { return false; } });
    if (show_notes) {
      assert.equal(rep.schema_version, '1.10.0');
      assert.equal(notes.length, 1);
      assert.deepEqual(violations(schema, rep), []);
    } else assert.equal(notes.length, 0);
  }
});
