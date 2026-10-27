import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord, readRecord, RECORD_REPO, RECORD_PATH } from '../src/stages/canon.mjs';
import { pitchRows, pitchHold, pitchedStages, pitchScore, pitchWords, hostOf, showTopic, PITCHES_PER_RUN, QUIET_AFTER_DAYS } from '../src/stages/pitches.mjs';
import { lessons, titleFor, OWN_SHOW, WORDS, KRISH_TITLE, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, BECAUSE_MAX, TITLE_MAX_BRIEF } from '../src/stages/rows.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';

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
  assert.equal(hold({ verdict: 'rejected' }), 'rejected');
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

test('shows rank by Nova\'s verdict, how recently they published, whether his buyer listens, and how long they have run', () => {
  assert.ok(pitchScore(stage(1, { verdict: 'take' }), NOW) > pitchScore(stage(1, { verdict: 'stretch' }), NOW));
  assert.ok(pitchScore(stage(1, { verdict: 'stretch' }), NOW) > pitchScore(stage(1), NOW));
  assert.ok(pitchScore(stage(1), NOW) > pitchScore(stage(1, { latest_episode_at: '2026-08-01T00:00:00Z' }), NOW), 'recent first');
  assert.ok(pitchScore(stage(1), NOW) > pitchScore(stage(1, { title: 'The Gardening Hour', audience: 'Gardeners' }), NOW), 'a room his buyer is in');
  assert.ok(pitchScore(stage(1, { episodes: 400 }), NOW) > pitchScore(stage(1, { episodes: 10 }), NOW), 'by log of its run');
});

test('a pitch is a 1.9.0 visibility row for Jonny\'s box, in Jonny\'s words, about the show, with no address', () => {
  const r = pitchRows({ context: ctx([stage(1, { verdict: 'take' }), stage(2), stage(3, { organizer: 'Example Media' })]), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: NOW, titleMax: TITLE_MAX_BRIEF });
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
  const many = Array.from({ length: 14 }, (_, i) => stage(i + 1, { verdict: i === 13 ? 'take' : 'unjudged' }));
  const r = pitchRows({ context: ctx(many), weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(r.proposals.length, PITCHES_PER_RUN);
  assert.equal(r.proposals[0].subject_ref, `target:${id(14)}`, 'the show Nova judged worth taking first');
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
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1) };
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
