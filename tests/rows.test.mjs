import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, readCanon, CanonError } from '../src/stages/canon.mjs';
import { kindsOf, reachOf, countIn, lessons, refusedBy, amplifierRows, rankRows, score, fitTitle, channelOf, servesOf, fitHold, cleanName, lastContact, caseFor, titleFor, fitTitleWithin, endsWhole, firstSentence, titleCase, wholeRole, wholeSentence, JOINERS, FIT_FLOOR, BECAUSE_MAX, BRIEF_LINE_MAX, TITLE_MAX_BRIEF, cardFor, knownWords, knownLine, knownShort, mailWords, whyLines, gainLines, angleLines, openerOf, openLine, sourceLinks, leadSentences, leadFacts, factOf, reachSentence, hasChannel, plain, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, RESEARCH_PAGES, firstName, hasFullName, showIn, showOf, onOwnShow, topicOf, actionFor, KRISH_TITLE } from '../src/stages/rows.mjs';
import { icpOf, signalRequests, signalRows, isoWeek } from '../src/stages/signals.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { golden } from './support/golden.mjs';
import { factLine, factLines, factSources, FACT_LINES_MAX } from '../src/stages/rows.mjs';
import { cardGrammar } from '../src/crew/lints/grammar.mjs';

// Synthetic only: fictional people, .test addresses, example links.
const NOW = '2026-10-26T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n- **Build your AI revenue engine.** Something else.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Send the Mindmake one-pagers and offers to warm leads', 'Have a clear plan for driving partnerships and visibility for Mindmake'];

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Every synthetic person carries a reason on record (protocol 1.8.0: a card that cannot say why them is held); it names no kind.
const person = (n, title, extra = {}) => ({ contact_id: id(n), network_tier: '2_core_network', current_title: title, followers: null, plays: [], roles: [], mindmake_fit: 60, sells_competing_services: false, hook: 'Took two media software companies through a sale.', contacts: { id: id(n), full_name: `Avery Example${n}`, title, company: `Company ${n}`, company_domain: `c${n}.test`, status: 'active' }, ...extra });
const route = (email = 'verified', extra = {}) => ({ email, x: false, linkedin: true, instagram: false, whatsapp: false, ...extra });

test('canon is read from the venture as it is today: the main ask, its link, the brain door and the Horizon, named by blob SHA', async () => {
  assert.deepEqual(canon.ask, { label: 'Start building your AI brain', url: 'https://mindmake.example/?start=1', description: 'answer a few questions, keep the brief, then a free consultation' });
  assert.equal(canon.brain, 'Your taste, standards and judgement, running as a system you own.');
  assert.equal(blobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a', 'the same SHA git gives');
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x00, 0x80, 0x0a]);
  assert.equal(blobSha(pdf), '2453d10dafce2943703353576a4670bcc4b6a136', 'raw bytes, as git hashes a binary file');
  assert.notEqual(blobSha(pdf), blobSha(Buffer.from(pdf).toString('utf8')), 'decoding a binary file as text gives another SHA (N17)');
  assert.throws(() => parseCanon({ northStar: NORTH_STAR, canon: CANON.replace('The main ask', 'Main') }), e => e instanceof CanonError && e.code === 'main_ask_unreadable');
  const read = await readCanon({ fetcher: async url => new Response(String(url).endsWith('00_NORTH_STAR.md') ? NORTH_STAR : CANON) });
  assert.deepEqual(read.files.map(f => f.sha), canon.files.map(f => f.sha));
  await assert.rejects(readCanon({ fetcher: async () => new Response('gone', { status: 404 }) }), e => e.code === 'canon_unavailable', 'nothing falls back to an older copy');
});

test('who an amplifier is comes from their own words; capital needs a named vehicle and an AI interest, never a title', () => {
  assert.deepEqual(kindsOf(person(1, 'General Partner, Example Ventures')), ['investor']);
  assert.deepEqual(kindsOf(person(2, 'Chapter Chair, YPO Gold')), ['connector']);
  assert.deepEqual(kindsOf(person(3, 'Director, Executive Education, Example Business School')), ['ceo_educator', 'student_educator']);
  assert.deepEqual(kindsOf(person(4, 'Host of The Example Podcast')), ['broadcaster']);
  assert.deepEqual(kindsOf(person(5, 'Founder, Example AI Academy')), ['ai_trainer']);
  assert.deepEqual(kindsOf(person(6, 'Chairman, Example Holdings')), [], 'a chairman is never read as rich');
  assert.deepEqual(kindsOf(person(7, 'Principal, Example Family Office')), [], 'a capital vehicle with no AI interest is not AI-minded capital');
  assert.deepEqual(kindsOf(person(8, 'Principal, Example Family Office', { intent_summary: 'Backing AI infrastructure' })), ['ai_capital']);
  assert.deepEqual(kindsOf(person(9, 'Writer', { followers: 120000 })), ['broadcaster']);
});

test('reach is a cited figure, a band from followers, or unknown; a figure without a source is never a number', () => {
  const c = person(1, 'Host', { followers: 42000 });
  assert.deepEqual(reachOf(c, []), { value: null, band: '10k_100k', basis: 'followers on their profile, as Control Center last read it', source_url: null, as_of: null });
  const cited = { request_id: `reach:${id(1)}:2026-10`, kind: 'question', status: 'answered', answer: 'The show reaches about 1.2 million listeners a month (Example Network, 2026).', evidence: [{ url: 'https://example.org/show' }], answered_at: NOW };
  assert.deepEqual(reachOf(c, [cited]), { value: 1200000, band: 'over_1m', basis: 'listeners a month, from a cited answer', source_url: 'https://example.org/show', as_of: NOW });
  assert.equal(reachOf(c, [{ ...cited, evidence: [] }]).value, null, 'no source, no number');
  assert.equal(reachOf(person(2, 'Host'), []).band, 'unknown');
  assert.equal(countIn('35,000 chief executives').value, 35000);
  assert.ok(score({ band: 'over_1m', value: null }, 1, 1, null, false) > score({ band: 'under_1k', value: null }, 1, 1, null, false));
  assert.ok(score({ band: 'over_1m', value: null }, 1, 1, null, false) < 3 * score({ band: 'under_1k', value: null }, 1, 1, null, false), 'by log, not by a factor of a thousand');
});

test('every No is kept for good, and a reason reaches what is like it', () => {
  const f = (reason_code, extra = {}) => ({ state: 'declined', decided_at: NOW, row: 'partners', subject_ref: `contact:${id(1)}`, reason_code, amplifier_kind: 'investor', features: { sector: 'media', topic: 'ai_leadership', seniority: 'c_suite' }, reach: { band: '1k_10k' }, ...extra });
  const ask = (L, over = {}) => refusedBy(L, { subject: `contact:${id(2)}`, row: 'partners', kind: 'investor', sector: 'media', topic: 'ai_leadership', band: '10k_100k', ...over }, NOW);
  assert.equal(refusedBy(lessons([f(null)], NOW), { subject: `contact:${id(1)}`, row: 'partners' }, NOW), 'declined_on_row', 'a plain No: never that person on that row');
  assert.equal(refusedBy(lessons([f('wrong_person')], NOW), { subject: `contact:${id(1)}`, row: 'events' }, NOW), 'declined_person');
  assert.equal(refusedBy(lessons([f('not_now')], NOW), { subject: `contact:${id(1)}`, row: 'events' }, NOW), 'snoozed');
  assert.equal(refusedBy(lessons([f('not_now', { decided_at: '2026-08-01T00:00:00Z' })], NOW), { subject: `contact:${id(1)}`, row: 'events' }, NOW), null, 'not now ends');
  assert.equal(ask(lessons([f('too_small')], NOW), { band: '1k_10k' }), 'below_reach_floor');
  assert.equal(ask(lessons([f('too_small')], NOW), { band: '10k_100k' }), null, 'bigger than what he called too small');
  assert.equal(ask(lessons([f('wrong_audience')], NOW)), 'wrong_audience');
  assert.equal(ask(lessons([f('wrong_audience')], NOW), { sector: 'retail' }), null);
  assert.equal(ask(lessons([f('not_my_topic')], NOW)), 'not_my_topic');
  assert.equal(lessons([f('pitch_off'), f('pitch_off')], NOW).pitchOff.get('partners'), 2);
  assert.equal(refusedBy(lessons([{ state: 'approved', carried_out: 'draft', decided_at: NOW, subject_ref: `contact:${id(3)}` }], NOW), { subject: `contact:${id(3)}`, row: 'network' }, NOW), 'snoozed', 'he just acted');
});

const ampContext = extra => ({
  amplifier_candidates: [
    person(1, 'General Partner, Example Ventures', { followers: 30000 }),
    person(2, 'Host of The Example Podcast', { followers: 900000 }),
    person(3, 'Chapter Chair, YPO Example'),
    person(4, 'Professor, Example University'),
    person(5, 'Chairman, Example Holdings'),
    person(6, 'General Partner, Quiet Capital', { contacts: { ...person(6, '').contacts, status: 'do_not_contact' } }),
    person(7, 'Host of Another Podcast'),
  ],
  routes: { [id(1)]: route(), [id(2)]: route('unchecked'), [id(3)]: route('none', { x: true }), [id(4)]: route(), [id(7)]: route('none') },
  network: [{ contact_id: id(9), network_tier: '1_reciprocated', current_title: 'COO', mindmake_fit: 60, contacts: { full_name: 'Robin Sample', status: 'active', last_touch_at: '2026-05-01T00:00:00Z' } }],
  companies: [{ domain: 'c1.test', kind: 'Media' }],
  feedback: [], research: [], ...extra,
});

test('amplifier rows: the ask decides the row, the words are the canon of today, one ask, no address, and nobody without a route', () => {
  const ctx = ampContext();
  ctx.routes[id(9)] = route('none', { whatsapp: true });
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon, files: FILES, at: NOW });
  const by = Object.fromEntries(r.rows.map(x => [x.proposal.target, x.proposal]));
  assert.equal(by[id(1)].row, 'partners');
  assert.equal(by[id(2)].row, 'visibility');
  assert.equal(by[id(3)].row, 'reach_out');
  assert.equal(by[id(4)].row, 'events');
  assert.equal(by[id(9)].row, 'network');
  assert.equal(by[id(5)], undefined, 'a chairman alone is no amplifier');
  assert.equal(by[id(6)], undefined, 'do not contact is never proposed');
  assert.equal(by[id(7)], undefined, 'no route, no row');
  assert.ok(r.held.includes('no_route'));
  assert.equal(by[id(3)].channel, 'x_message', 'X only where his numeric id is on file');
  assert.equal(by[id(9)].channel, 'whatsapp', 'WhatsApp for a close tie gone quiet');
  for (const p of r.rows.map(x => x.proposal)) {
    const a = JSON.parse(p.exact_payload);
    assert.equal(a.version, 2);
    assert.equal(a.recipient_contact_id, p.target);
    assert.equal(/@|\+\d/.test(p.exact_payload), false, 'never an address or a number');
    assert.equal(p.exact_payload.includes(String.fromCharCode(8212)), false, 'no em dash');
    assert.ok(p.title.length <= 72, p.title);
    assert.ok((a.body.match(/https:\/\//g) ?? []).length <= 1, 'one link at most');
    assert.equal(/free AI brief/i.test(a.body), false, 'never the retired ask');
    assert.deepEqual(p.source_revision, FILES);
    assert.equal(p.stage, null);
  }
  assert.match(JSON.parse(by[id(1)].exact_payload).body, /running as a system you own/, 'Mindmake in the canon\'s own words');
  assert.equal(by[id(1)].serves, GOALS[1], 'partners serve the partnerships goal, word for word');
  assert.equal(by[id(1)].features.sector, 'media');
  assert.equal(r.research.length, 4, 'the strongest without a cited figure are asked about, four at most');
  assert.ok(r.research.every(q => /^reach:[0-9a-f-]{36}:2026-10$/.test(q.request_id) && !/@/.test(q.query) && q.query.length <= 400));
  const again = amplifierRows({ context: { ...ctx, research: r.research.map(q => ({ ...q, status: 'answered' })) }, weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(again.research.length, 0, 'once a month each');
  const ranked = rankRows(r.rows);
  assert.ok(ranked.kept.every(p => p.rank >= 1 && !('name' in p)));
});

test('a pitch_off on a row moves it to its other words', () => {
  const plain = amplifierRows({ context: ampContext(), weekGoals: GOALS, canon, files: FILES, at: NOW }).rows.find(x => x.proposal.row === 'partners').proposal;
  const fb = [{ state: 'declined', decided_at: NOW, row: 'partners', subject_ref: `contact:${id(77)}`, reason_code: 'pitch_off' }];
  const changed = amplifierRows({ context: ampContext({ feedback: fb }), weekGoals: GOALS, canon, files: FILES, at: NOW }).rows.find(x => x.proposal.row === 'partners').proposal;
  assert.notEqual(JSON.parse(changed.exact_payload).body, JSON.parse(plain.exact_payload).body);
});

test('titles fit his phone whole, channels and goals are chosen by rule', () => {
  assert.equal(fitTitle('x'.repeat(80), 'short one'), 'short one');
  assert.ok(fitTitle('x '.repeat(60)).length <= 72);
  assert.equal(channelOf(route('none'), 'reach_out'), null);
  assert.equal(channelOf(route('none', { whatsapp: true }), 'reach_out'), null, 'WhatsApp only for the network row');
  assert.equal(servesOf('events', GOALS), null);
});

// ── Signals ─────────────────────────────────────────────────────────────────

const POST_URL = 'https://www.linkedin.com/feed/update/urn:li:activity:7300000000000000001/';
const engager = (handle, name, headline, snippet, contact_id = null) => ({ title: name, url: POST_URL, snippet, published: '2026-10-24T08:00:00.000Z', person: { handle, name, headline, contact_id } });

test('only worried executives count: never an AI person, a seller, someone with an answer to sell, or a junior', () => {
  assert.ok(icpOf({ headline: 'CEO, Example Media Group' }, 'My board asked what AI means for our managers and I had no good answer.'));
  assert.equal(icpOf({ headline: 'Chief AI Officer, Example' }, 'Worried about this.'), null, 'an AI person');
  assert.equal(icpOf({ headline: 'Founder, AI automation agency' }, 'Worried about this.'), null);
  assert.equal(icpOf({ headline: 'Leadership coach and keynote speaker' }, 'Leaders are worried.'), null, 'a seller');
  assert.equal(icpOf({ headline: 'COO, Example Logistics' }, 'We built agents that fix this, DM me.'), null, 'an answer to sell');
  assert.equal(icpOf({ headline: 'Marketing assistant' }, 'I am worried about my job.'), null, 'not an executive');
  assert.equal(icpOf({ headline: 'CFO, Example Retail' }, 'Great post, thanks for sharing.'), null, 'no worry, no signal');
  const media = icpOf({ headline: 'Managing Director, Example Media' }, 'Honestly not sure how to lead my team through this, and the board keeps asking.');
  const retail = icpOf({ headline: 'Managing Director, Example Retail' }, 'Honestly not sure how to lead my team through this, and the board keeps asking.');
  assert.ok(media.strength > retail.strength, 'the Horizon\'s buyer ranks first');
});

test('signal research: routes first, then the posts where most argued, then this week\'s voices and topics; nothing asked twice, ten at most', () => {
  const voices = [{ slug: 'voice-one', name: 'Voice One', linkedin_url: 'https://www.linkedin.com/in/voice-one' }, { slug: 'no-link', name: 'No Link', linkedin_url: null }, { slug: 'bad', name: 'Bad', linkedin_url: 'https://www.linkedin.com/in/bad?trk=x' }];
  const research = [
    { request_id: 'posts:topic:0:2026-W43', kind: 'posts', status: 'answered', answered_at: NOW, evidence: [{ url: POST_URL, title: 'Pat Writer: Founder', engagement: { comments: 412, reactions: 3000 } }, { url: 'https://www.linkedin.com/posts/quiet-activity-1', engagement: { comments: 3 } }] },
    { request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('stranger-ceo', 'Sam Stranger', 'CEO, Example Media', 'This keeps me up at night: what happens to my managers?'), engager('ai-guy', 'Al Builder', 'Head of AI, Example', 'Worried? We built agents for this.')] },
  ];
  const q = signalRequests({ voices, research, at: NOW });
  assert.deepEqual(q.map(r => r.kind), ['person_route', 'post_engagers', 'posts', 'posts', 'posts']);
  assert.equal(q[0].query, 'li:stranger-ceo', 'only the worried executive gets a route');
  assert.equal(q[1].query, POST_URL, 'the post where 412 argued, never the quiet one');
  assert.deepEqual(q.filter(r => r.request_id.startsWith('posts:voice')).map(r => r.query), ['https://www.linkedin.com/in/voice-one'], 'a voice with a clean profile link, never a bad one');
  assert.ok(q.filter(r => r.request_id.startsWith('posts:topic')).every(r => r.request_id.endsWith(isoWeek(NOW))), 'topics once a week');
  const again = signalRequests({ voices, research: [...research, ...q.map(r => ({ ...r, status: 'answered', evidence: [] }))], at: NOW });
  assert.equal(again.length, 0, 'nothing asked twice');
  assert.ok(q.length <= 10);
});

test('signal rows: their own words open the note, one ask, one link, canon of today; a stranger waits for a route', () => {
  const research = [
    { request_id: 'posts:t', kind: 'posts', status: 'answered', answered_at: NOW, evidence: [{ url: POST_URL, title: 'Pat Writer: Co-founder, Example Brew' }] },
    { request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [
      engager('known-exec', 'Kim Known', 'COO, Example Media', 'My board asked what AI means for our managers. I had no good answer.', id(21)),
      engager('stranger-ceo', 'Sam Stranger', 'CEO, Example Data', 'This keeps me up at night: what happens to my managers?'),
      engager('waiting', 'Wren Waiting', 'CFO, Example Group', 'Not sure what this means for my team.'),
    ] },
    { request_id: 'route:stranger-ceo', kind: 'person_route', query: 'li:stranger-ceo', status: 'answered', subject_ref: `contact:${id(22)}`, answer: 'an address the search checked' },
  ];
  const context = { routes: { [id(21)]: route(), [id(22)]: route('verified') }, feedback: [] };
  const r = signalRows({ context, research, weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.deepEqual(r.rows.map(x => x.proposal.target).sort(), [id(21), id(22)]);
  assert.ok(r.held.includes('signal_awaiting_route'));
  const p = r.rows.find(x => x.proposal.target === id(21)).proposal;
  const a = JSON.parse(p.exact_payload);
  assert.equal(p.row, 'reach_out');
  assert.equal(a.subject, "Your comment on Pat Writer's post");
  assert.match(a.body, /^Hi Kim,\n\nSaw your comment under Pat Writer's post: "My board asked/);
  assert.match(a.body, /answer a few questions, keep the brief, then a free consultation\. https:\/\/mindmake\.example\/\?start=1/);
  assert.equal((a.body.match(/https:\/\//g) ?? []).length, 1, 'one link');
  assert.equal(p.serves, GOALS[0]);
  assert.equal(p.evidence[0].url, POST_URL, 'the post is the source');
  assert.equal(p.amplifier_kind, null);
  assert.ok(p.title.length <= 72);
  const declined = signalRows({ context: { ...context, feedback: [{ state: 'declined', decided_at: NOW, row: 'reach_out', subject_ref: `contact:${id(21)}`, reason_code: 'wrong_person' }] }, research, weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.equal(declined.rows.some(x => x.proposal.target === id(21)), false, 'a No is kept');
});

test('a dispatch run against Control Center 1.6.0: the rows reach the report, research runs in two bounded rounds, and only counts are printed', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [], asked = [];
  let contextReads = 0;
  const ctx = () => ({
    schema_version: '1.6.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [] },
    ...ampContext(), voices: [{ slug: 'voice-one', name: 'Voice One', linkedin_url: 'https://www.linkedin.com/in/voice-one' }],
    routes: { ...ampContext().routes, ...(contextReads > 1 ? { [id(22)]: route() } : {}) },
    research: contextReads > 1 ? [{ request_id: 'route:stranger-ceo', kind: 'person_route', query: 'li:stranger-ceo', status: 'answered', subject_ref: `contact:${id(22)}` }] : [],
  });
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.6.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.5.0', '1.6.0'], features: { context: true, rows: true, research: true } }),
    context: async () => { contextReads++; return { ok: true, context: ctx() }; },
    research: async requests => {
      asked.push(requests.map(r => r.kind));
      return requests.map(r => ({ ...r, status: 'answered', answered_at: NOW, answer: r.kind === 'person_route' ? 'an address the search checked' : null,
        subject_ref: r.kind === 'person_route' ? `contact:${id(22)}` : r.subject_ref,
        evidence: r.kind === 'posts' ? [{ url: POST_URL, title: 'Pat Writer: Founder', engagement: { comments: 300, reactions: 900 } }]
          : r.kind === 'post_engagers' ? [engager('stranger-ceo', 'Sam Stranger', 'CEO, Example Media', 'This keeps me up at night: what happens to my managers?')] : [] }));
    },
    decisions: async () => [], postReport: async r => { reports.push(golden(r)); return { replayed: false }; }, readReport: async () => reports.at(-1),
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-rows-12345678', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }] });
  assert.equal(result.status, 'succeeded');
  const report = reports[0];
  assert.equal(report.schema_version, '1.6.0');
  assert.deepEqual(asked, [['question', 'question', 'question', 'question', 'posts', 'posts', 'posts'], ['post_engagers']], 'round one asks the engine\'s own questions first, then finds posts; round two reads who argued');
  assert.equal(contextReads, 1, 'no person was filed in these two rounds, so no second context read');
  const rows = report.proposals.filter(p => p.row);
  assert.deepEqual(rows.map(p => p.row).sort(), ['events', 'partners', 'reach_out', 'visibility'], 'one amplifier on each of four rows; the tie with no route waits');
  assert.ok(report.holds.some(h => h.reason === 'row_signal_awaiting_route'), 'the stranger found today gets a route on the next run');
  assert.ok(rows.every(p => p.wall === 'send' && p.stage === null && p.subject_ref?.startsWith('contact:') && p.source_revision.length === 3 && p.title.length <= 72));
  assert.equal(new Set(rows.map(p => `${p.row}:${p.rank}`)).size, rows.length, 'one rank per place in a row');
  const printed = JSON.stringify(result);
  assert.equal(/Avery|Robin|Sam|Pat/.test(printed), false, 'the printed outcome carries counts, never a name');
  assert.equal(result.rows.prepared, rows.length);
  assert.ok(rows.every(p => !('because' in p) && !('brief' in p) && !('card' in p)), 'a 1.6.0 Control Center gets the rows without their reasons or their cards');

  // Before Control Center reads rows, the engine reports as it always has.
  const older = []; const cc2 = { ...cc, capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { context: true } }), postReport: async r => { older.push(golden(r)); return { replayed: false }; }, readReport: async () => older.at(-1) };
  await runDispatch({ cc: cc2, source: async () => ({}), policy, registry: {}, attemptId: 'gma-rows-older-1234', clock: () => NOW, canonReader: async () => { throw new Error('never read'); } });
  assert.equal(older[0].schema_version, '1.2.0');
  assert.equal(older[0].proposals.some(p => 'row' in p), false);
});

test('a canon that cannot be read holds every row and says why', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture(), capabilities: async () => ({ schema_versions: ['1.6.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { schema_version: '1.6.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [], records: { advisory: [] }, ...ampContext() } }),
    decisions: async () => [], postReport: async r => { reports.push(golden(r)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  await runDispatch({ cc, source: async () => ({}), policy, registry: {}, attemptId: 'gma-canon-held-1234', clock: () => NOW, canonReader: async () => { throw new CanonError('main_ask_unreadable'); } });
  assert.equal(reports[0].proposals.some(p => p.row), false);
  assert.ok(reports[0].holds.some(h => h.reason === 'main_ask_unreadable'));
});

// ── Reasons and fit (protocol 1.7.0, Ruling, Krish, 2026-10-27) ─────────────

const host = (n, extra = {}) => person(n, `Host of Example Show ${n}`, extra);

test('a competitor, and anyone under the fit floor or with no fit, is left out; fit outranks a bigger following', () => {
  const ctx = { amplifier_candidates: [
    host(31, { followers: 900000, mindmake_fit: FIT_FLOOR + 1 }),
    host(32, { followers: 12000, mindmake_fit: 90 }),
    host(33, { followers: 500000, sells_competing_services: true }),
    host(34, { followers: 500000, mindmake_fit: FIT_FLOOR - 1 }),
    host(35, { followers: 500000, mindmake_fit: null }),
  ], routes: Object.fromEntries([31, 32, 33, 34, 35].map(n => [id(n), route()])), feedback: [], research: [] };
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon, files: FILES, at: NOW });
  const ranked = rankRows(r.rows).kept.filter(p => p.row === 'visibility');
  assert.deepEqual(ranked.map(p => p.target), [id(32), id(31)], 'fit 90 with 12,000 followers above fit 41 with 900,000');
  assert.deepEqual(r.held.filter(h => h === 'competitor' || h === 'low_fit').sort(), ['competitor', 'low_fit', 'low_fit']);
  assert.equal(fitHold({ mindmake_fit: FIT_FLOOR }), null, 'the floor itself is in');
  assert.equal(fitHold({ mindmake_fit: 95, sells_competing_services: true }), 'competitor', 'a competitor is out whatever its fit');
});

test('who someone is also reads Control Center\'s hook and why_them, but a passing university is no teaching post', () => {
  assert.deepEqual(kindsOf(person(61, 'Founder', { hook: 'Has run her own tech podcast for six years.' })), ['broadcaster']);
  assert.deepEqual(kindsOf(person(62, 'Founder', { why_them: 'Met at Example University; now runs a retail group.' })), []);
});

test('NETWORK: quiet ties come first, last contact is the later of a touch and an email, and a tie with no date is skipped', () => {
  const tie = (n, extra = {}, contacts = {}) => ({ contact_id: id(n), network_tier: '1_reciprocated', current_title: 'COO', current_company: `Example Co ${n}`, mindmake_fit: 70, known_since: '2019-05-01', email_last: null, ...extra, contacts: { full_name: `Robin Sample${n}`, status: 'active', last_touch_at: null, ...contacts } });
  const ctx = {
    quiet_ties: [tie(41, { email_last: '2025-03-04' }), tie(47, { email_last: '2025-01-10' })],
    network: [
      tie(47, { email_last: '2025-01-10' }),
      tie(42, { email_last: '2026-10-01' }),
      tie(43),
      tie(44, { email_last: '2024-01-01' }, { last_touch_at: '2026-10-20T00:00:00Z' }),
      tie(45, { email_last: '2024-01-01', mindmake_fit: 20 }),
    ],
    routes: Object.fromEntries([41, 42, 43, 44, 45, 47].map(n => [id(n), route()])), feedback: [], research: [],
  };
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon, files: FILES, at: NOW });
  const net = r.rows.filter(x => x.proposal.row === 'network').map(x => x.proposal);
  assert.deepEqual(net.map(p => p.target).sort(), [id(41), id(47)], 'from quiet_ties, each once; recent, undated and a later touch are not quiet');
  assert.ok(r.held.includes('low_fit'), 'a quiet tie under the floor is held');
  assert.match(net.find(p => p.target === id(41)).because, /^A close tie gone quiet since Mar 2025\. COO at Example Co 41\.$/);
  assert.equal(lastContact({ email_last: '2024-01-01', contacts: { last_touch_at: '2026-10-20T00:00:00Z' } }), Date.parse('2026-10-20T00:00:00Z'));
  assert.equal(lastContact({ contacts: {} }), null);
});

test('every row says who they are, how he knows them and why them, inside its limits, and names lose their emoji', () => {
  const ctx = ampContext();
  ctx.amplifier_candidates.push(host(51, { followers: 60000, known_since: '2021-03-02', email_last: '2024-06-02', hook: 'Hosts a weekly show for media operators. A live event follows each spring.', contacts: { ...host(51).contacts, full_name: 'Jess Example⚡️', company: 'Spark Media⚡️' }, current_company: 'Spark Media⚡️' }));
  ctx.routes[id(51)] = route();
  ctx.routes[id(9)] = route('none', { whatsapp: true });
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.ok(r.rows.length >= 5);
  for (const p of r.rows.map(x => x.proposal)) {
    assert.ok(typeof p.because === 'string' && p.because.length >= 1 && p.because.length <= BECAUSE_MAX, p.because);
    assert.ok(Array.isArray(p.brief) && p.brief.length >= 2 && p.brief.length <= 6, JSON.stringify(p.brief));
    for (const line of [p.because, ...p.brief]) {
      assert.ok(line.length <= BRIEF_LINE_MAX);
      assert.equal(line.includes(String.fromCharCode(8212)), false, 'no em dash');
      assert.equal(/@|\+\d{6}/.test(line), false, 'never an address or a number');
    }
    assert.ok(p.brief.some(l => /^Mindmake fit \d+ of 100/.test(l)), 'the fit is said');
    assert.ok(p.brief.some(l => /Known since|email/.test(l)), 'how he knows them is said');
  }
  const jess = r.rows.find(x => x.proposal.target === id(51)).proposal;
  assert.equal(jess.because, 'Hosts a weekly show for media operators. Known since 2021, last email Jun 2024.');
  assert.equal(/\p{Extended_Pictographic}/u.test(jess.title + JSON.parse(jess.exact_payload).body + jess.because), false, 'no emoji in the title, the words or the line');
  assert.match(JSON.parse(jess.exact_payload).body, /^Hi Jess,/);
  assert.equal(cleanName('Avery Example⚡️ '), 'Avery Example');
  const told = caseFor({ c: { network_tier: '2_core_network' }, name: 'Avery Example', company: '', ask: 'introduce', kind: 'connector', reach: { band: 'unknown' }, fit: 50, serves: GOALS[0] });
  assert.equal(told.because, 'No emails between you on record.', 'with nothing else held, it says only what is known');
  assert.ok(told.brief.includes(`The ask: one introduction to a leader working out what AI should do for them. It serves this week's goal: ${GOALS[0]}.`));
});

test('signal rows carry their reasons too: who they are and what they said in public', () => {
  const research = [{ request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('known-exec', 'Kim Known', 'COO, Example Media', 'My board asked what AI means for our managers. I had no good answer.', id(21))] }];
  const r = signalRows({ context: { routes: { [id(21)]: route() }, feedback: [] }, research, weekGoals: GOALS, canon, files: FILES, at: NOW });
  const p = r.rows[0].proposal;
  assert.equal(p.because, 'COO, Example Media. Worried in public about AI and their job.');
  assert.ok(p.brief.some(l => l.startsWith("They wrote on ") || l.startsWith('They wrote in ')));
  assert.ok(p.brief.length >= 2 && p.brief.every(l => l.length <= BRIEF_LINE_MAX));
  assert.ok(p.brief.some(l => l.startsWith('They wrote in Oct 2026: "My board asked')));
});

test('a dispatch run against Control Center 1.7.0 reports 1.7.0, and every row carries its line and its brief', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.7.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { schema_version: '1.7.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [] }, ...ampContext() } }),
    decisions: async () => [], postReport: async r => { reports.push(golden(r)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-rows-17-123456', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }] });
  assert.equal(result.status, 'succeeded');
  assert.equal(reports[0].schema_version, '1.7.0');
  const rows = reports[0].proposals.filter(p => p.row);
  assert.ok(rows.length >= 3);
  assert.ok(rows.every(p => p.because && p.because.length <= BECAUSE_MAX && Array.isArray(p.brief) && p.brief.length >= 2 && p.brief.length <= 6));
  assert.ok(rows.every(p => p.title.length <= TITLE_MAX_BRIEF && !p.title.includes('...')), 'at 1.7.0 a title fits two lines beside the presses');
  assert.equal(/Avery|Robin/.test(JSON.stringify(result)), false, 'the printed outcome carries counts, never a name');
});

test('the card line is two lines at most and always whole; a 1.7.0 title is 56 at most and leaves the company to it', () => {
  assert.equal(BECAUSE_MAX, 80);
  assert.equal(TITLE_MAX_BRIEF, 56);
  const long = {
    current_title: 'Chief Executive Officer and Founding Partner', current_company: 'Example International Media Holdings Group',
    network_tier: '2_core_network', known_since: '2018-04-01', email_last: '2025-09-09',
    hook: 'Built and sold two regional broadcasting groups, then founded a network of executive dinners across eleven cities, which most of the leaders he would want now attend.',
  };
  const told = caseFor({ c: long, name: 'Bartholomew Longname-Example', company: long.current_company, ask: 'partner', kind: 'investor', reach: { band: 'unknown' }, fit: 80, serves: null });
  assert.ok(told.because.length <= BECAUSE_MAX, told.because);
  assert.equal(told.because.includes('...'), false, 'never an ellipsis');
  assert.equal(told.because, 'Chief Executive Officer and Founding Partner. Known since 2018.', 'a story that will not fit whole is skipped, never cut; the role stands whole and the known line shortens');
  for (const c of [{ ...long, hook: null }, { network_tier: '3_known_network' }, { ...long, hook: 'x'.repeat(300) }]) {
    const b = caseFor({ c, name: 'Bartholomew Longname-Example', company: long.current_company, ask: 'introduce', kind: 'connector', reach: { band: 'unknown' }, fit: 80, serves: null }).because;
    assert.ok(b.length >= 1 && b.length <= BECAUSE_MAX && !b.includes('...') && /[.!?]$/.test(b), b);
  }
  const title = titleFor('partner', 'investor', 'Bartholomew Longname-Example', long.current_company, TITLE_MAX_BRIEF);
  assert.ok(title.length <= TITLE_MAX_BRIEF && !title.includes('...') && !title.includes(long.current_company), title);
  assert.equal(titleFor('partner', 'investor', 'Hugo Example', 'Climate Example', TITLE_MAX_BRIEF), 'Offer Hugo Example a session for their leaders');
  assert.equal(titleFor('partner', 'investor', 'Ann Lee', 'Acme', TITLE_MAX_BRIEF), 'Offer Ann Lee a session for their leaders', 'the company is left to the line under it even when it would fit');
  assert.equal(titleFor('partner', 'investor', 'Hugo Example', 'Climate Example'), 'Offer Hugo Example at Climate Example a session for their leaders', '1.6.0 keeps the company');
  assert.equal(fitTitleWithin(20, 'Ask Maximiliana Extraordinarily for one introduction'), 'Ask Maximiliana', 'cut at a word, never an ellipsis');
});

// Synthetic people shaped like the lines the first live 1.7.0 run cut mid-phrase.
const CUT_LIVE = [
  { current_title: 'SVP of Data, AI & Analytics, Example Retail Group', current_company: 'Example Retail Group International' },
  { current_title: 'Managing Director of Example Lab & Head of Open Innovation for Europe, Middle East and Africa', current_company: 'Example Beauty Group' },
  { current_title: 'chief marketing officer at u.s. example bank' },
  { current_title: 'Commercial Director & Co-Founder at Example Games Studio Holdings', current_company: 'Example Games Studio Holdings' },
  { current_title: 'Partner', hook: 'His Privacy Act Review submissions were cited four times by the Example Law Reform Commission in its final report.' },
  { current_title: 'Founder', hook: 'Building the first agentic full-stack gaming advertising platform for mid-size studios across Asia and Europe.' },
  { current_title: 'Chairman', hook: 'Co-founder of Example TV and the executive producer behind three long-running music shows across two decades.' },
  { current_title: 'Head of Growth', hook: 'Led the U.S. launch of a streaming service that reached two million homes.' },
  { current_title: 'Creator', why_them: "She's a high-reach creator in the audience builder_economy wants to reach." },
  { current_title: 'Creator', why_them: 'Reaches the audience builder_economy wants.' },
  { current_title: 'Director of Partnerships for the', current_company: 'Example Group' },
  { current_title: 'VP, Strategy & Operations | Board Member | Advisor to Example Ventures and Example Capital Partners LLP' },
];

test('a card line is built only from whole pieces: never ending on a joiner, an initial or a slug, never cut mid-name, 80 at most', () => {
  for (const [i, extra] of CUT_LIVE.entries()) {
    for (const ask of ['introduce', 'partner', 'appear', 'relationship']) {
      const c = { network_tier: '2_core_network', known_since: '2020-05-01', email_last: i % 2 ? '2025-02-01' : null, ...extra };
      const { because } = caseFor({ c, name: 'Avery Example', company: c.current_company ?? '', ask, kind: 'connector', reach: { band: 'unknown' }, fit: 60, serves: null });
      assert.ok(because.length >= 1 && because.length <= BECAUSE_MAX, because);
      assert.equal(because.includes('...'), false, because);
      for (const piece of because.split(/(?<=\.) (?=[A-Z])/)) {
        const last = piece.replace(/[.,;:!?]+$/, '').split(' ').at(-1);
        assert.equal(JOINERS.has(last.toLowerCase()), false, `ends on "${last}": ${because}`);
        assert.equal(/^\p{L}$/u.test(last), false, `ends on an initial: ${because}`);
      }
      assert.equal(/_/.test(because), false, `an internal slug: ${because}`);
      assert.equal(/\bu\.s\./.test(because), false, `raw lower-case data: ${because}`);
      for (const bad of ['four times by.', 'gaming advertising.', 'the executive.', 'Led the U.', 'Studio.', 'Head.', 'for the.']) assert.equal(because.includes(bad), false, `${bad} in ${because}`);
    }
  }
  assert.equal(endsWhole('cited four times by'), false);
  assert.equal(endsWhole('Commercial Director & Co-Founder at'), false);
  assert.equal(endsWhole('Led the U'), false);
  assert.equal(endsWhole('Chief Marketing Officer'), true);
  assert.equal(firstSentence('Led the U.S. launch of Example Inc. and its partners. Then more.'), 'Led the U.S. launch of Example Inc. and its partners');
  assert.equal(titleCase('chief marketing officer at u.s. example bank'), 'Chief Marketing Officer at U.S. Example Bank');
  assert.equal(titleCase('VP of Sales at eBay'), 'VP of Sales at eBay', 'a title with any capital is left as written');
  assert.equal(firstSentence('Led the U.S. Senate inquiry into data brokers. Then more.'), 'Led the U.S. Senate inquiry into data brokers', 'an initial is no sentence end');
  assert.equal(firstSentence('Works with Dr. Example on media law. Then more.'), 'Works with Dr. Example on media law', 'nor an abbreviation');
  assert.equal(wholeSentence('Reaches the audience builder_economy wants.', 62), '', 'an internal slug is never his');
  assert.equal(wholeRole('Director of Partnerships for the', '', 62), '', 'a whole field that itself ends on a joiner is dropped');
  assert.equal(caseFor({ c: { network_tier: '2_core_network', known_since: '2020-05-01', current_title: 'Director of Partnerships for the' }, name: 'Avery Example', company: '', ask: 'introduce', kind: 'connector', reach: { band: 'unknown' }, fit: 60, serves: null }).because, 'Known since 2020, no emails between you on record.', 'the known line alone is better than a broken one');
  assert.equal(wholeRole('VP, Strategy & Operations | Board Member | Advisor to Example Ventures and Example Capital Partners LLP', '', 62), 'VP, Strategy & Operations.', 'the title up to its first separator, the shortest whole piece');
});

test('a signal\'s line names who they are as a whole, readable piece too', () => {
  const research = [{ request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('long-exec', 'Lee Long', 'chief operating officer, example media group holdings and three subsidiaries across europe', 'My board asked what AI means for our managers. I had no good answer.', id(23))] }];
  const p = signalRows({ context: { routes: { [id(23)]: route() }, feedback: [] }, research, weekGoals: GOALS, canon, files: FILES, at: NOW }).rows[0].proposal;
  assert.equal(p.because, 'Chief Operating Officer. Worried in public about AI and their job.');
  assert.ok(p.because.length <= BECAUSE_MAX);
});

// ── The full card (protocol 1.8.0, Krish, 2026-10-27) ───────────────────────
// "I need to be fully in the know as to who they are, why I'm getting in touch
// with them, what benefit I would have, and what angles to take."

const SITE_CANON = CANON + '\n| Homepage headline (first, and the h1) | Promote your AI from intern to chief of staff. |\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you\'ll need. |\n| Homepage section 1 (the problem) | Right now, your AI is an intern. |\n| Homepage section 2 (how it works) | A chief of staff knows how you think. |\n';
const fullCanon = { ...parseCanon({ northStar: NORTH_STAR, canon: SITE_CANON }), files: canon.files };
const EM = String.fromCharCode(8212);
const cardOf = (c, over = {}) => cardFor({ c, id: c.contact_id ?? id(90), name: 'Avery Example', title: c.current_title ?? '', company: c.current_company ?? '', ask: 'partner', kind: 'investor', reach: { value: null, band: 'unknown', basis: 'not yet researched', source_url: null, as_of: null }, fit: 70, serves: GOALS[1], canon: fullCanon, at: NOW, ...over });
const assertCard = (card, where) => {
  assert.ok(card, where);
  assert.ok(card.who.length >= 1 && card.who.length <= CARD_WHO_MAX, `who ${where}`);
  assert.ok(card.known.length >= 1 && card.known.length <= CARD_LINE_MAX, `known ${where}`);
  for (const k of ['why', 'gain']) assert.ok(card[k].length >= 1 && card[k].length <= 3 && card[k].every(l => l.length >= 1 && l.length <= CARD_LINE_MAX), `${k} ${where}`);
  assert.ok(card.angles.length >= 1 && card.angles.length <= 3 && card.angles.every(a => a.title.length <= 60 && a.line.length <= CARD_LINE_MAX && a.title && a.line), `angles ${where}`);
  assert.ok(card.sources.length <= 6 && card.sources.every(s => /^https:\/\/\S+$/.test(s.url) && !NOT_A_SOURCE.test(s.url) && s.label.length <= 80), `sources ${where}`);
  const text = JSON.stringify(card);
  assert.equal(text.includes(EM), false, `no em dash ${where}`);
  assert.equal(/@[a-z]|\+\d{6}/i.test(text), false, `never an address or a number ${where}`);
  assert.deepEqual(Object.keys(card).sort(), ['angles', 'gain', 'known', 'sources', 'who', 'why']);
};

test('who they are: the record\'s own sentence, whole, then the role; nothing known is a card too thin to show', () => {
  const who = 'Co-founder and CEO of Example Board, a sports and entertainment media and venture company. Based in New York. Also on two boards.';
  assert.equal(cardOf({ who, hook: 'Moved the company into a members club this year.' }).who, 'Co-founder and CEO of Example Board, a sports and entertainment media and venture company. Based in New York.', 'two whole sentences at most');
  assert.equal(cardOf({ who: 'chief marketing officer of example bank, a top-10 lender.', hook: 'Ran a turnaround.' }).who, 'Chief Marketing Officer of Example Bank, a Top-10 Lender.');
  assert.equal(cardOf({ who: 'Reaches the audience builder_economy wants.', current_title: 'Partner', current_company: 'Example Capital', hook: 'Ran a turnaround.' }).who, 'Partner at Example Capital.', 'an internal slug is never his: the role stands');
  assert.equal(cardOf({ hook: 'Ran a turnaround.' }), null, 'no who and no role: held');
  assert.equal(leadSentences('x'.repeat(400), CARD_WHO_MAX), '', 'a sentence that will not fit whole is skipped, never cut');
});

test('how he knows them: every combination of emails each way reads true, and the live contradiction cannot happen', () => {
  const counts = [undefined, null, 0, 1, 2, 23];
  for (const inn of counts) for (const out of counts) for (const last of [null, '2026-06-02']) for (const since of [null, '2020-03-01']) {
    const c = { email_inbound: inn, email_outbound: out, email_last: last, known_since: since, source_list: ['gmail_krish_mindmaker', 'apify', 'linkedin_export'] };
    const k = knownWords(c);
    const where = JSON.stringify(c);
    assert.ok(k.length >= 1 && k.length <= CARD_LINE_MAX && !k.includes(EM), where);
    const i = Number.isInteger(inn) ? inn : null, o = Number.isInteger(out) ? out : null;
    if (/each other/.test(k)) assert.ok(i > 0 && o > 0, `each other only when both wrote: ${k}`);
    if (/not written back/.test(k)) assert.ok((/They have written/.test(k) ? o : i) === 0, `"not written back" only on a counted zero: ${k}`);
    if (/No email/.test(k)) assert.ok(!(i > 0) && !(o > 0), `no email only when none is counted: ${k}`);
    if (since) assert.match(k, /^Known since 2020, through your Gmail and your LinkedIn connections\./, 'since when and through what; enrichment sources are not where he knows them from');
    for (const line of [knownLine(c), knownShort(c)]) if (i > 0 || o > 0) assert.equal(/no emails? (between you )?on record/i.test(line), false, `the card line never says no email when emails are counted: ${line}`);
  }
  assert.equal(mailWords({ email_inbound: 23, email_outbound: 9, email_last: '2026-09-14' }), 'You have emailed each other 32 times (they wrote 23, you wrote 9); the last was Sep 2026.');
  assert.equal(mailWords({ email_inbound: 0, email_outbound: 2 }), 'You have written to them twice, and they have not written back.');
  assert.equal(mailWords({ email_inbound: 0, email_outbound: 0 }), 'No emails between you yet.');
  // The live card said "You have written to each other before" and "no email on record" together.
  const raph = { contact_id: id(91), network_tier: '1_reciprocated', known_since: '2025-01-01', email_last: null, email_inbound: 2, email_outbound: 1, current_title: 'Founding Growth', current_company: 'Example Growth Co', hook: 'Built growth at two AI marketing startups.' };
  const told = caseFor({ c: raph, name: 'Ray Example', company: raph.current_company, ask: 'appear', kind: 'broadcaster', reach: { band: 'unknown' }, fit: 58, serves: null });
  const all = [told.because, ...told.brief, cardOf(raph).known].join(' | ');
  assert.equal(/no emails? (between you )?on record/i.test(all), false, all);
  assert.equal(/written to each other before/i.test(all), false, all);
  assert.ok(told.brief.includes(cardOf(raph).known), 'the brief says what the card says');
});

test('why them, why now: whole sentences from the record, the quiet tie first, a recent AI post but never selling AI', () => {
  const c = { hook: `Chairs the industry AI taskforce ${EM} worth asking what is landing.`, why_them: 'Reaches the audience builder_economy wants.', intent_summary: `building a team ${EM} Active job posting for an AI platform role.`, last_post_at: '2026-09-10T00:00:00Z' };
  const why = whyLines(c, { ask: 'relationship', quietSince: 'Jun 2025', company: { why_now: 'Raised a growth round in September.' }, at: NOW });
  assert.deepEqual(why, ['A close tie, and nothing between you since Jun 2025.', 'Chairs the industry AI taskforce.', 'Raised a growth round in September.'], 'no em dash, no slug, no prompt, at most three');
  assert.ok(whyLines({ ...c, hook: null }, { ask: 'partner', at: NOW }).includes('They posted in Sep 2026: Active job posting for an AI platform role.'));
  assert.deepEqual(whyLines({ intent_summary: `selling AI ${EM} Pitching AI services to agencies.`, last_post_at: '2026-10-01T00:00:00Z' }, { ask: 'partner', at: NOW }), [], 'selling AI is not his buyer\'s signal');
  assert.deepEqual(whyLines({ intent_summary: `commenting ${EM} Asked about AI pricing.`, last_post_at: '2026-03-01T00:00:00Z' }, { ask: 'partner', at: NOW }), [], 'an old post is no reason now');
  assert.equal(cardOf({ who: 'Partner at Example Capital.' }), null, 'no reason on record: held');
  assert.equal(plain(`A ${EM} B – C ,  D`), 'A, B, C, D');
});

test('what he gets: by the ask, numbers only with their source, ending on the goal it serves word for word', () => {
  const cited = { value: 35000, band: '10k_100k', basis: 'chief executives, from a cited answer', source_url: 'https://example.org/forum', as_of: NOW };
  assert.deepEqual(gainLines({ ask: 'teach', kind: 'ceo_educator', name: 'Avery Example', reach: cited, fit: 70, serves: GOALS[1] }), ['A session in front of their leaders: 35,000 chief executives, from a cited answer.', `It serves this week's goal: ${GOALS[1]}.`]);
  assert.deepEqual(gainLines({ ask: 'appear', name: 'Avery Example', reach: { value: null, band: '10k_100k', basis: 'followers on their profile, as Control Center last read it' }, serves: null }), ['A guest spot on their channel.', 'Avery has 10,000 to 100,000 followers on their profile, as Control Center last read it.'], 'a profile following is not the audience of a channel');
  assert.deepEqual(gainLines({ ask: 'appear', name: 'Avery Example', reach: { value: null, band: 'unknown', basis: 'not yet researched' }, serves: null }), ['A guest spot on their channel.'], 'an unknown reach is not said as a number');
  assert.match(gainLines({ ask: 'relationship', name: 'Avery Example', fit: 92, serves: GOALS[0] })[0], /scores 92 of 100 for Mindmake fit; it can turn into an advisory conversation\.$/);
  assert.match(gainLines({ ask: 'introduce', name: 'Avery Example', reach: { band: 'unknown' }, serves: null })[0], /^One introduction from Avery puts you in front of a leader/);
  for (const ask of ['introduce', 'relationship', 'appear', 'teach', 'partner', 'signal']) assert.ok(gainLines({ ask, name: 'Avery Example', reach: cited, fit: 60, serves: GOALS[1] }).at(-1).startsWith("It serves this week's goal: "), ask);
});

test('the angles: titled in the canon\'s own words this run, tied to this person, and only what the canon still says', () => {
  const c = { hook: 'His Data Driven newsletter and two board seats, worth asking what patterns he sees.', current_company: 'Example Capital' };
  const partner = angleLines({ ask: 'partner', kind: 'investor', name: 'Avery Example', c, company: 'Example Capital', canon: fullCanon });
  assert.deepEqual(partner.map(a => a.title), ['Build your AI revenue engine', 'Build your AI brain']);
  assert.equal(partner[1].line, `Open with what you know: His Data Driven newsletter and two board seats. Then the brain door, in the site's words: "${fullCanon.brain}"`);
  assert.ok(partner[0].line.includes(`"The pricing, positioning and team you'll need."`), 'the revenue door quoted, not paraphrased');
  assert.deepEqual(angleLines({ ask: 'relationship', name: 'Avery Example', c, company: '', canon: fullCanon }).map(a => a.title), ['Promote your AI from intern to chief of staff', 'Build your AI brain']);
  assert.deepEqual(angleLines({ ask: 'appear', name: 'Avery Example', c, company: '', canon: fullCanon }).map(a => a.title), ['Make Your Mind Up', 'Build your AI brain']);
  assert.deepEqual(angleLines({ ask: 'partner', kind: 'investor', name: 'Avery Example', c, company: '', canon }).map(a => a.title), ['Build your AI brain'], 'a door the canon no longer carries is not offered');
  assert.equal(openerOf({ hook: 'Built a fund. Then more.' }), 'Built a fund');
  assert.equal(openerOf({}), '');
  assert.equal(openLine({}, 'Example Capital'), 'Open with their work at Example Capital.');
  assert.equal(openLine({}, ''), '');
});

test('sources are public pages about them: a profile, an address or a number is never one, and there are six at most', () => {
  const research = [{ request_id: `profile:${id(92)}:2026-10`, kind: 'question', status: 'answered', subject_ref: `contact:${id(92)}`, answered_at: NOW, evidence: [{ url: 'https://example.org/interview', title: 'An interview' }, { url: 'https://www.linkedin.com/in/someone' }] },
    { request_id: 'other', kind: 'question', status: 'answered', subject_ref: `contact:${id(93)}`, evidence: [{ url: 'https://example.org/not-them' }] }];
  const s = sourceLinks({ reach: { basis: 'listeners a month, from a cited answer', source_url: 'https://example.org/show', as_of: NOW }, research, id: id(92), domain: 'example-capital.test', company: 'Example Capital',
    extra: [{ label: 'Mail', url: 'mailto:a@b.test' }, { label: 'Chat', url: 'https://wa.me/123' }, { label: 'Call', url: 'tel:+100' }, { label: 'Again', url: 'https://example.org/show' }] });
  assert.deepEqual(s.map(x => x.url), ['https://example.org/show', 'https://example.org/interview', 'https://example-capital.test']);
  assert.equal(s[0].label, 'Reach: listeners a month, from a cited answer, 2026-10-26');
  assert.ok(sourceLinks({ extra: Array.from({ length: 9 }, (_, i) => ({ label: `Page ${i}`, url: `https://example.org/${i}` })) }).length === 6);
});

// ── Facts, not notes (the first live 1.8.0 run): synthetic shapes of the live faults ──

test('a judge\'s note or an instruction is never a reason, and a prompt is cut back to the fact before it', () => {
  const notes = [
    'There are no recent dated news triggers or readable website details available for Example Data to indicate a need.',
    'There is no readable website content or recent news regarding Example Group to indicate an immediate need.',
    'Example Labs is an AI vendor offering creative agents for commerce, making them a potential technology partner rather than a primary buyer for AI strategy consulting.',
    'As a fast-growing video platform, Example Video is a prospective partner or vendor rather than a direct client.',
    'Example Weekly is a small niche publisher with no recent funding, leadership changes, or strategic triggers in the provided data.',
  ];
  for (const n of notes) assert.equal(factOf(n), '', n);
  assert.equal(factOf('His podcast and public commentary on ad infrastructure, reference a specific episode or piece if one is known.'), '', 'an instruction is dropped whole');
  assert.equal(factOf('His path from Example Audio to Example Mart to running Example Media Exchange is a clean narrative of retail media\'s rise, worth asking him to unpack on the podcast.'),
    "His path from Example Audio to Example Mart to running Example Media Exchange is a clean narrative of retail media's rise");
  assert.equal(factOf('He hosts Example Talk and two other podcasts, worth comparing notes on guest booking and format.'), 'He hosts Example Talk and two other podcasts');
  assert.equal(factOf('Her build of an innovation team tied to a ten-year deal, worth referencing directly as a parallel.'), 'Her build of an innovation team tied to a ten-year deal');
  assert.equal(factOf('His portfolio across three sectors could make for a good podcast conversation on venture investing.'), 'His portfolio across three sectors');
  assert.equal(factOf('Raised a growth round in September.'), 'Raised a growth round in September', 'a plain fact stands');
  const c = { hook: 'His work chairing an industry AI taskforce, worth asking what is landing.', why_them: 'There is no readable website content to indicate a need.' };
  const why = whyLines(c, { ask: 'partner', company: { why_now: 'Example Labs is an AI vendor, a potential technology partner rather than a primary buyer. It signed a distribution deal in June 2026.' }, at: NOW });
  assert.deepEqual(why, ["His work chairing an industry AI taskforce.", 'It signed a distribution deal in June 2026.'], 'the note is passed over and the fact after it kept');
  assert.equal(leadFacts('There are no recent triggers. Then nothing.', 240), 'Then nothing.');
  assert.equal(cardFor({ c: { who: 'Partner at Example Capital.', hook: 'There is no recent news for Example Capital to indicate a need.' }, id: id(97), name: 'Avery Example', title: 'Partner', company: 'Example Capital', ask: 'partner', kind: 'investor', reach: { band: 'unknown' }, fit: 60, serves: GOALS[1], canon: fullCanon, at: NOW }), null, 'nothing left but notes: the card is thin and held');
});

test('the opener always reads as a sentence: the fact quoted whole, never "Open on his move ... is a path"', () => {
  const c = { hook: 'His move from Example Bank CMO to Other Bank CMO, plus running Example Alarm as CEO in between, is an unusually direct path worth asking about.' };
  const line = openLine(c, 'Other Bank');
  assert.equal(line, 'Open with what you know: His move from Example Bank CMO to Other Bank CMO, plus running Example Alarm as CEO in between, is an unusually direct path.');
  assert.equal(/Open on (his|her|their)\b/.test(angleLines({ ask: 'relationship', name: 'Avery Example', c, company: 'Other Bank', canon: fullCanon }).map(a => a.line).join(' ')), false);
  assert.equal(openLine({ hook: 'There is no recent news to indicate a need.' }, 'Example Co'), 'Open with their work at Example Co.', 'a note is never the opener');
  const long = { hook: 'His move from a chief marketing role at Example Bank to Other Bank, plus running Example Alarm as chief executive in between, is an unusually direct path worth asking about.' };
  const brain = angleLines({ ask: 'introduce', name: 'Avery Example', c: long, company: 'Other Bank', canon: fullCanon })[0];
  assert.equal(brain.title, 'Build your AI brain');
  assert.ok(brain.line.startsWith('Open with what you know: His move from a chief marketing role'), 'a long fact keeps its place; the quote gives way');
  assert.ok(brain.line.length <= CARD_LINE_MAX);
});

test('what he gets says what each number is: a profile following or a media audience is never the room of leaders', () => {
  const people = { value: 52000000, band: 'over_1m', basis: 'people, from a cited answer', source_url: 'https://example.org/a', as_of: NOW };
  const followers = { value: null, band: '10k_100k', basis: 'followers on their profile, as Control Center last read it' };
  const portfolio = { value: 40, band: 'under_1k', basis: 'portfolio companies, from the fund page', source_url: 'https://example.org/f', as_of: NOW };
  assert.deepEqual(gainLines({ ask: 'partner', kind: 'investor', name: 'Ann Example', company: 'Example Board', reach: people, serves: GOALS[1] }),
    ['A working session for the leaders Example Board backs or gathers.', 'Example Board reaches 52,000,000 people, from a cited answer.', `It serves this week's goal: ${GOALS[1]}.`]);
  assert.deepEqual(gainLines({ ask: 'partner', kind: 'investor', name: 'Ann Example', company: 'Example Capital', reach: followers, serves: GOALS[1] }).slice(0, 2),
    ['A working session for the leaders Example Capital backs or gathers.', 'Ann has 10,000 to 100,000 followers on their profile, as Control Center last read it.']);
  assert.deepEqual(gainLines({ ask: 'partner', kind: 'investor', name: 'Ann Example', company: 'Example Capital', reach: portfolio, serves: null }),
    ['A working session for the leaders Example Capital backs or gathers: 40 portfolio companies, from the fund page.'], 'a count of the room it is for stays in the line');
  assert.deepEqual(gainLines({ ask: 'introduce', name: 'Ann Example', reach: followers, serves: null })[1], 'Ann has 10,000 to 100,000 followers on their profile, as Control Center last read it.', 'never "Their network: ..."');
  assert.equal(reachSentence({ band: 'unknown', basis: 'not yet researched' }, 'Ann Example', 'Example Co'), '');
  for (const ask of ['introduce', 'appear', 'teach', 'partner']) {
    for (const r of [people, followers]) {
      const lines = gainLines({ ask, kind: 'investor', name: 'Ann Example', company: 'Example Co', reach: r, serves: null });
      assert.equal(lines.some(l => /(leaders|audience|people they train|students)[^.]*: [\d,]+ (people|followers)|: [\d,]+ to [\d,]+ followers/.test(l)), false, `${ask}: ${lines.join(' | ')}`);
    }
  }
});

test('VISIBILITY counts a channel only where the record says they host, run, write or present it, never from a prompt', () => {
  const cmo = person(98, 'CMO at Example Tracking', { followers: 8000, who: 'CMO at Example Tracking, a brand tracking company, after marketing roles at three startups.', hook: 'His founder to enterprise CMO arc is a solid operator story worth asking about on the podcast.' });
  const founder = person(99, 'Founder and CEO, Example Video', { followers: 74000, who: 'Founder and CEO of Example Video, a video creation startup.', hook: 'His line that AI is the social elevator of this decade, worth asking how that shows up in what he is building.' });
  const host = person(100, 'Founder, Example Talk Group', { followers: 30000, who: 'Serial founder running media and podcast production businesses.', hook: 'He hosts Example Talk and two other podcasts, worth comparing notes on guest booking.' });
  const publisher = person(101, 'Founder', { followers: 30000, who: 'Runs The Example Weekly, a global research company and conference for marketing technology leaders.' });
  assert.equal(hasChannel(cmo), false, 'a "worth asking on the podcast" prompt is his podcast, not theirs');
  assert.equal(hasChannel(founder), false, '"shows up" is not a show');
  assert.equal(hasChannel(host), true);
  assert.equal(hasChannel(publisher), true, 'a named publication they run');
  assert.equal(hasChannel({ who: 'Runs the sales channel and shows the team what works.' }), false);
  assert.equal(hasChannel({ current_title: 'Editor at Example Times' }), true);
  assert.equal(hasChannel({ current_title: 'Podcast Host' }), true, 'a title that is a media role');
  assert.equal(hasChannel({ hook: 'Ran three company exits, worth asking about on the show.' }), false, 'a prompt naming "the show" is read past');
  const ctx = { amplifier_candidates: [cmo, founder, host, publisher], routes: Object.fromEntries([98, 99, 100, 101].map(n => [id(n), route()])), feedback: [], research: [] };
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  const vis = r.rows.filter(x => x.proposal.row === 'visibility').map(x => x.proposal.target);
  assert.equal(vis.includes(id(98)) || vis.includes(id(99)), false, vis.join(','));
});

test('each research page is named by its title or its site, deduped, four at most', () => {
  const evidence = Array.from({ length: 6 }, (_, i) => ({ url: `https://news${i}.example.org/story` }));
  const research = [{ request_id: `profile:${id(102)}:2026-10`, kind: 'question', status: 'answered', subject_ref: `contact:${id(102)}`, answered_at: NOW,
    evidence: [{ url: 'https://www.example.com/summit', title: 'Example News: the board summit' }, { url: 'https://www.example.com/summit' }, ...evidence] }];
  const s = sourceLinks({ research, id: id(102) });
  assert.equal(s.length, RESEARCH_PAGES);
  assert.deepEqual(s.map(x => x.label), ['Example News: the board summit', 'news0.example.org', 'news1.example.org', 'news2.example.org']);
  assert.equal(s.some(x => /^Research, /.test(x.label)), false);
});

test('a card too thin to show is held and asks once a month who they are; the answer fills it on the next run', () => {
  const thin = person(94, 'Partner, Example Ventures', { hook: null, followers: 30000 });
  const ctx = { amplifier_candidates: [thin], routes: { [id(94)]: route() }, feedback: [], research: [] };
  const first = amplifierRows({ context: ctx, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.equal(first.rows.length, 0);
  assert.deepEqual(first.held, ['thin_card']);
  const ask = first.research.find(r => r.request_id === `profile:${id(94)}:2026-10`);
  assert.ok(ask && ask.kind === 'question' && ask.subject_ref === `contact:${id(94)}` && ask.query.length <= 400);
  assert.equal(amplifierRows({ context: { ...ctx, research: [{ ...ask, status: 'requested' }] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW }).research.some(r => r.request_id === ask.request_id), false, 'asked once a month');
  const answered = { ...ask, status: 'answered', answered_at: NOW, answer: 'General partner at Example Ventures, an early-stage fund backing media software. Led the fund\'s AI investments in 2026.', evidence: [{ url: 'https://example.org/fund', title: 'Fund page' }] };
  const next = amplifierRows({ context: { ...ctx, research: [answered] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  const card = next.rows[0]?.proposal.card;
  assertCard(card, 'filled by the profile answer');
  assert.equal(card.who, 'General partner at Example Ventures, an early-stage fund backing media software.');
  assert.ok(card.why.includes("Led the fund's AI investments in 2026."));
  assert.ok(card.sources.some(s => s.url === 'https://example.org/fund'));
});

test('VISIBILITY needs a channel they own: followers alone are an audience, not a channel', () => {
  const pm = person(95, 'Head of AI Product Management, Example Software', { is_influencer: true, followers: 40000, who: 'Heads AI product management for an enterprise software line and coaches professionals on their careers.' });
  const hostP = person(96, 'Host of Example Show', { followers: 40000 });
  const ctx = { amplifier_candidates: [pm, hostP], routes: { [id(95)]: route(), [id(96)]: route() }, feedback: [], research: [] };
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.deepEqual(r.rows.filter(x => x.proposal.row === 'visibility').map(x => x.proposal.target), [id(96)]);
  assert.ok(r.held.includes('no_channel'));
  assert.equal(hasChannel(pm), false);
  assert.equal(hasChannel({ hook: 'Writes a weekly newsletter for media operators.' }), true);
});

test('every row in a run carries a whole card within its limits, and a signal\'s card is said from what they wrote', () => {
  const ctx = ampContext();
  ctx.amplifier_candidates.forEach((c, i) => Object.assign(c, { email_inbound: i % 3, email_outbound: (i + 1) % 2, source_list: ['gmail_krish_mindmaker', 'phone_address_book'], known_since: '2021-02-01' }));
  const r = amplifierRows({ context: ctx, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.ok(r.rows.length >= 3);
  for (const x of r.rows) assertCard(x.proposal.card, x.proposal.title);
  const research = [{ request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('known-exec', 'Kim Known', 'COO, Example Media', 'My board asked what AI means for our managers. I had no good answer.', id(21))] }];
  const posts = [{ request_id: 'posts:x', kind: 'posts', status: 'answered', answered_at: NOW, evidence: [{ url: POST_URL, title: 'Pat Writer: Founder' }] }];
  const sig = signalRows({ context: { routes: { [id(21)]: route() }, feedback: [] }, research: [...research, ...posts], weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW }).rows[0].proposal;
  assertCard(sig.card, 'signal');
  assert.equal(sig.title, "Kim Known worried about AI on Pat Writer's post", 'never "on Pat Writer", always whose post');
  assert.equal(sig.card.known, 'Already in your contacts. Control Center found them again through their public comment.');
  assert.ok(sig.card.why[0].startsWith('They wrote on Pat Writer\'s post'));
  assert.deepEqual(sig.card.sources, [{ label: "Their comment on Pat Writer's post", url: POST_URL }]);
});

test('a dispatch run reports 1.8.0 with the full card only where Control Center serves it, and 1.7.0 without it otherwise', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  for (const [served, expected] of [[['1.6.0', '1.7.0', '1.8.0'], '1.8.0'], [['1.6.0', '1.7.0'], '1.7.0']]) {
    const reports = [];
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: served.at(-1), week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
      context: async () => ({ ok: true, context: { schema_version: served.at(-1), engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [] }, ...ampContext() } }),
      decisions: async () => [], postReport: async rep => { reports.push(golden(rep)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: `gma-card-${expected.replace(/\./g, '')}-1234`, clock: () => NOW,
      canonReader: async () => fullCanon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }] });
    assert.equal(result.status, 'succeeded', expected);
    assert.equal(reports[0].schema_version, expected);
    const rows = reports[0].proposals.filter(p => p.row);
    assert.ok(rows.length >= 3);
    if (expected === '1.8.0') for (const p of rows) assertCard(p.card, p.title);
    else assert.ok(rows.every(p => !('card' in p) && p.because && p.brief), '1.7.0 keeps the line and the brief and leaves the card off');
  }
});

test('a signal whose headline cannot say who they are, whole, is held as a thin card', () => {
  const research = [{ request_id: 'engagers:y', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('thin-exec', 'Tam Thin', 'Chief of', 'My board asked what AI means for our managers. I had no good answer.', id(24))] }];
  const r = signalRows({ context: { routes: { [id(24)]: route() }, feedback: [] }, research, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.held, ['thin_card']);
});

// ── The second live 1.8.0 run (2026-10-27): synthetic shapes of each fault ──

test('a first name is never a title: "Hi Dr.," and "Dr. has" cannot be written', () => {
  for (const n of ['Dr. Avery Example', 'dr Avery Example', 'DR. Avery Example', 'Prof. Avery Example', 'Professor Avery Example', 'Sir Avery Example', 'Mrs Avery Example', 'Mx. Avery Example', 'Rev Dr Avery Example']) {
    assert.equal(firstName(n), 'Avery', n);
    assert.equal(hasFullName(n), true, n);
  }
  assert.equal(hasFullName('Dr. Example'), false, 'a title and one name is no full name');
  assert.equal(firstName('Drew Example'), 'Drew', 'a name that starts like a title is a name');
  assert.match(actionFor('email', id(1), 'Dr. Avery Example', { subject: 'S', lines: ['One line.'] }).body, /^Hi Avery,/);
  assert.equal(reachSentence({ band: '10k_100k', basis: 'followers on their profile' }, 'Dr. Avery Example', ''), 'Avery has 10,000 to 100,000 followers on their profile.');
  const doc = person(120, 'General Partner, Example Ventures', { followers: 30000, contacts: { ...person(120, '').contacts, full_name: 'Dr. Avery Example' } });
  const r = amplifierRows({ context: { amplifier_candidates: [doc], routes: { [id(120)]: route() }, feedback: [], research: [] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  const p = r.rows[0].proposal;
  assert.match(JSON.parse(p.exact_payload).body, /^Hi Avery,/);
  assert.equal(/\bDr\.? (has|reaches|uses)|Hi Dr/.test(JSON.stringify(p)), false, JSON.stringify(p.card.gain));
  const sig = signalRows({ context: { routes: { [id(121)]: route(), [id(122)]: route() }, feedback: [] }, research: [{ request_id: 'engagers:d', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [
    engager('dr-kim', 'Dr. Kim Known', 'COO, Example Media', 'My board asked what AI means for our managers.', id(121)),
    engager('dr-only', 'Dr. Known', 'CFO, Example Group', 'Not sure what this means for my team.', id(122)),
  ] }], weekGoals: GOALS, canon, files: FILES, at: NOW });
  assert.match(JSON.parse(sig.rows[0].proposal.exact_payload).body, /^Hi Kim,/);
  assert.ok(sig.held.includes('no_full_name'), 'a title and one name is held');
  const short = signalRows({ context: { routes: { [id(121)]: route() }, feedback: [] }, research: [{ request_id: 'engagers:e', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('dr-kim', 'Dr. Kim Known', 'COO, Example Media', 'My board asked what AI means for our managers.', id(121))] }], weekGoals: GOALS, canon, files: FILES, at: NOW, titleMax: 36 });
  assert.equal(short.rows[0].proposal.title, 'Kim worried about AI in public', 'a short title falls back to the first name, never the title');
});

test('a verdict on whether they fit is never a reason, and a judge\'s clause is cut back to the fact before it', () => {
  for (const note of [
    "Not a fit for mindmake since his business isn't AI-related.",
    'Example Media looks like a direct fit for connecting with the CX buyer audience.',
    'He sits where adtech meets identity, a space that is highly relevant if the operator works in martech.',
    'Active job posting for an AI role with budget signal.',
    'His book on org design is a strong jumping-off point for a conversation.',
    'Weak fit overall for the offer.',
    'No clear fit with the brief yet.',
    'The company is not AI-related at all.',
    'Not relevant to the current campaign.',
    'Outside the ICP for this quarter.',
    'Scored low on the last pass.',
    'An unlikely buyer this year.',
    "Their work doesn't fit the offer today.",
  ]) assert.equal(factOf(note), '', note);
  assert.equal(factOf('Example Innovators is hosting industry events on marketing ROI, though their website shows no direct internal executive hiring triggers.'), 'Example Innovators is hosting industry events on marketing ROI', 'the fact stands and the clause goes');
  for (const fact of ['Chairs an industry AI taskforce.', 'Runs a fitness brand across three cities.', 'Moved from a bank to a fintech in 2024.', 'Hosts a weekly show for media operators.'])
    assert.equal(factOf(fact), fact.replace(/\.$/, ''), fact);
  const told = caseFor({ c: { hook: "Not a fit for mindmake since it isn't AI-related. Hosts a weekly show for media operators." }, name: 'Avery Example', company: '', ask: 'appear', kind: 'broadcaster', reach: { band: 'unknown' }, fit: 60, serves: null });
  assert.match(told.because, /^Hosts a weekly show for media operators\./, told.because);
  assert.equal(told.brief.some(l => /not a fit/i.test(l)), false, told.brief.join(' | '));
  const why = whyLines({ hook: 'His podcast and an investing community show he has built media infrastructure in financial services.', why_them: "Not a fit for mindmake since his business isn't AI-related." }, { ask: 'appear', at: NOW });
  assert.deepEqual(why, ['His podcast and an investing community show he has built media infrastructure in financial services.']);
});

test('partner angles are tied to the person: their company or what they do, and one angle when nothing is known', () => {
  const a = angleLines({ ask: 'partner', kind: 'investor', name: 'Avery Example', c: {}, company: 'Example Capital', canon: fullCanon });
  const b = angleLines({ ask: 'partner', kind: 'investor', name: 'Blair Example', c: {}, company: 'Sample Partners', canon: fullCanon });
  assert.ok(a[0].line.includes('Example Capital') && b[0].line.includes('Sample Partners'), a[0].line);
  assert.equal(a.some(x => b.some(y => y.line === x.line)), false, 'no line is the same on two partners');
  const bare = angleLines({ ask: 'partner', kind: 'investor', name: 'Avery Example', c: {}, company: '', canon: fullCanon });
  assert.equal(bare.length, 1, 'nothing known: one angle, not generic lines over again');
  const trainer = angleLines({ ask: 'partner', kind: 'ai_trainer', name: 'Avery Example', c: {}, company: 'Example Academy', canon: fullCanon });
  assert.ok(trainer.every(x => x.line.includes('Example Academy')), JSON.stringify(trainer));
  assert.deepEqual(Object.keys(a[0]).sort(), ['line', 'title'], 'nothing but the title and the line reaches the card');
});

test('an appearance names its show, and his own shows are never one', () => {
  assert.equal(showIn('Her work hosting The Example Agenda podcast for a national paper.'), 'The Example Agenda');
  assert.equal(showIn('He has been hosting The Example Show for over 8 years.'), 'The Example Show');
  assert.equal(showIn("He hosts 'Give It A Go' and a couple of other podcasts."), 'Give It A Go');
  assert.equal(showIn('Runs The Example Weekly, a research company.'), 'The Example Weekly');
  assert.equal(showIn('Host of Example Show 9'), 'Example Show 9');
  assert.equal(showIn('His podcast and public commentary on ad infrastructure.'), '', 'a podcast with no name names nothing');
  assert.equal(showIn('Founder of Example Media, a studio.'), '', 'a company someone founded is not a show');
  assert.equal(showIn('Leads the region, and has seen B2B podcast advertising shift.'), '', 'one word before a lower-case podcast is a kind of podcast, not its name');
  assert.equal(showIn('Hosts the Example Podcast every week.'), 'Example Podcast', 'a capitalised noun is part of the name');
  assert.equal(factOf('Leading Example Audio for over 9 years, curious what he has seen shift in podcast advertising.'), 'Leading Example Audio for over 9 years', 'a "curious what" prompt is cut back to the fact');
  assert.equal(showIn('His story is worth asking about on The Example Show.'), '', 'a prompt names his show, not theirs');
  // A co-host of his own show is never asked to have him on it, and may still be a tie to catch up with.
  const cohost = person(130, 'Co-host, Signal & Noise', { followers: 5000, hook: 'Co-hosts the Signal & Noise podcast, a weekly show on AI and media.' });
  const tie = { contact_id: id(130), network_tier: '1_reciprocated', current_title: 'Partner', current_company: 'Example Consulting', mindmake_fit: 70, known_since: '2020-01-01', email_last: '2025-01-10', who: 'Partner at Example Consulting, advising on data and identity.', contacts: { full_name: 'Rory Example', status: 'active' } };
  const r = amplifierRows({ context: { amplifier_candidates: [cohost], network: [tie], routes: { [id(130)]: route() }, feedback: [], research: [] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.equal(r.rows.some(x => x.proposal.row === 'visibility'), false);
  assert.ok(r.held.includes('own_show'));
  assert.deepEqual(r.rows.map(x => x.proposal.row), ['network'], 'still a tie to catch up with');
  assert.equal(onOwnShow({ current_title: 'Contributor, makeyourmindup.ai' }), true);
  assert.equal(onOwnShow({ hook: 'Writes for Make Your Mind Up.' }), true);
  assert.equal(onOwnShow({ hook: 'Hosts The Example Show.' }), false);
  // A podcast with no name is held and asked about once a month; the answer names it, and his own show is held then.
  const unnamed = person(131, 'Partner, Example Consulting', { followers: 5000, hook: 'His podcast and public commentary on AI in advertising.' });
  const ctx = { amplifier_candidates: [unnamed], routes: { [id(131)]: route() }, feedback: [], research: [] };
  const first = amplifierRows({ context: ctx, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.equal(first.rows.some(x => x.proposal.row === 'visibility'), false);
  assert.ok(first.held.includes('unnamed_channel'));
  const ask = first.research.find(q => q.request_id === `channel:${id(131)}:2026-10`);
  assert.ok(ask && ask.kind === 'question' && ask.subject_ref === `contact:${id(131)}` && ask.query.length <= 400 && !/@/.test(ask.query), JSON.stringify(first.research));
  const named = { ...ask, status: 'answered', answered_at: NOW, answer: 'Avery co-hosts The Example Hour, a weekly show on ad tech.', evidence: [] };
  const second = amplifierRows({ context: { ...ctx, research: [named] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.equal(second.rows.find(x => x.proposal.row === 'visibility')?.proposal.card.gain[0], 'A guest spot on The Example Hour.');
  const own = { ...named, answer: 'Avery co-hosts Signal & Noise, a weekly show on AI and media.' };
  const third = amplifierRows({ context: { ...ctx, research: [own] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.equal(third.rows.some(x => x.proposal.row === 'visibility'), false);
  assert.ok(third.held.includes('own_show'));
  const unnamedOwn = { ...named, answer: 'Avery hosts the weekly podcast that makeyourmindup publishes.' };
  assert.ok(amplifierRows({ context: { ...ctx, research: [unnamedOwn] }, weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW }).held.includes('own_show'), 'the answer names his show even where it names no show of theirs');
});

test('VISIBILITY says the show by name, what he gets on it, and who he is to a booker', () => {
  const h = person(140, 'Host of Example Show 140', { followers: 60000 });
  const r = amplifierRows({ context: { amplifier_candidates: [h], routes: { [id(140)]: route() }, feedback: [], research: [] }, weekGoals: GOALS, canon, files: FILES, at: NOW });
  const p = r.rows.find(x => x.proposal.row === 'visibility').proposal;
  assert.equal(p.card.gain[0], 'A guest spot on Example Show 140.');
  assert.ok(p.title.includes('Example Show 140'), p.title);
  const a = JSON.parse(p.exact_payload);
  assert.equal(a.subject, 'An idea for Example Show 140');
  assert.ok(a.body.includes(`I'm ${KRISH_TITLE} and I write Make Your Mind Up (https://publication.example)`), a.body);
  assert.equal(KRISH_TITLE, 'Executive Host of Signal & Noise');
  assert.equal((a.body.match(/https:\/\//g) ?? []).length, 1, 'one link');
  const audience = { value: 52000, band: '10k_100k', basis: 'listeners a month, from a cited answer', source_url: 'https://example.org/a', as_of: NOW };
  assert.equal(gainLines({ ask: 'appear', name: 'Avery Example', reach: audience, serves: null, show: 'Example Show' })[0], 'A guest spot on Example Show, in front of its audience: 52,000 listeners a month, from a cited answer.');
  const fb = [{ state: 'declined', decided_at: NOW, row: 'visibility', subject_ref: `contact:${id(77)}`, reason_code: 'pitch_off' }];
  const other = amplifierRows({ context: { amplifier_candidates: [h], routes: { [id(140)]: route() }, feedback: fb, research: [] }, weekGoals: GOALS, canon, files: FILES, at: NOW }).rows[0].proposal;
  const b = JSON.parse(other.exact_payload);
  assert.notEqual(b.body, a.body);
  assert.ok(b.body.includes(KRISH_TITLE) && b.subject === 'A conversation for Example Show 140', b.body);
});

test('a topic is what this one is about, or null: one "Not my topic" never refuses a whole row', () => {
  assert.equal(topicOf({ who: 'Founder of Example Wealth, a financial advice firm, and host of Example Money Podcast.' }, 'Example Money Podcast'), 'finance');
  assert.equal(topicOf({ who: 'Runs an executive search firm placing board leaders, and hosts The Example Talent Show.' }, 'The Example Talent Show'), 'talent');
  assert.equal(topicOf({ who: 'Partner at an agency leading programmatic advertising.' }), 'advertising');
  assert.equal(topicOf({ who: 'Keeps bees.' }), null);
  const money = person(150, 'Host of Example Money Podcast', { followers: 30000, who: 'Hosts Example Money Podcast on personal finance.' });
  const talent = person(151, 'Host of The Example Talent Show', { followers: 30000, who: 'Hosts The Example Talent Show on recruiting and careers.' });
  const ctx = (feedback = []) => ({ amplifier_candidates: [money, talent], network: [{ contact_id: id(152), network_tier: '1_reciprocated', current_title: 'COO', mindmake_fit: 70, email_last: '2025-01-10', contacts: { full_name: 'Robin Sample', status: 'active' } }], routes: { [id(150)]: route(), [id(151)]: route(), [id(152)]: route() }, feedback, research: [] });
  const r = amplifierRows({ context: ctx(), weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  const topic = t => r.rows.find(x => x.proposal.target === id(t)).proposal.features.topic;
  assert.deepEqual([topic(150), topic(151), topic(152)], ['finance', 'talent', null]);
  const fb = [{ state: 'declined', decided_at: NOW, row: 'visibility', subject_ref: `contact:${id(150)}`, reason_code: 'not_my_topic', amplifier_kind: 'broadcaster', features: { sector: null, topic: 'finance', seniority: 'other' } }];
  const after = amplifierRows({ context: ctx(fb), weekGoals: GOALS, canon: fullCanon, files: FILES, at: NOW });
  assert.deepEqual(after.rows.filter(x => x.proposal.row === 'visibility').map(x => x.proposal.target), [id(151)], 'another show on another topic stays');
});

// ── Typed facts (protocol 1.10.0) ──────────────────────────────────────────
const FACTS = [
  { kind: 'role', text: 'CEO at Harbour Foods', source_url: null, observed_at: '2026-10-01T00:00:00Z' },
  { kind: 'post', text: 'Posted: "Boards are asking what AI should decide, not what it can do."', source_url: 'https://example.org/post/1', observed_at: '2026-09-14T00:00:00Z' },
  { kind: 'role_change', text: 'Changed role: was COO at Harbour Foods, now CEO at Harbour Foods', source_url: null, observed_at: '2026-08-02T00:00:00Z' },
  { kind: 'shared_employer', text: 'Has worked at Example Media as Producer, where Krish also worked', source_url: null, observed_at: null },
  { kind: 'email', text: '3 emails from them and 2 to them', source_url: null, observed_at: null },
];

test('a fact becomes one whole sentence to him, or nothing', () => {
  assert.equal(factLine(FACTS[1]), 'They posted in Sep 2026: "Boards are asking what AI should decide, not what it can do."');
  assert.equal(factLine(FACTS[2]), 'They changed role: was COO at Harbour Foods, now CEO at Harbour Foods.');
  assert.equal(factLine(FACTS[3]), 'They have worked at Example Media as Producer, where you also worked.');
  assert.equal(factLine(FACTS[0]), '', 'a role is the who line, never a why line');
  assert.equal(factLine(FACTS[4]), '', 'emails are the known line, never repeated');
  assert.equal(factLine({ ...FACTS[1], text: 'Posted: "Boards are asking what AI should..."' }), '', 'a clipped fact is never shown cut');
  assert.equal(factLine({ ...FACTS[1], source_url: null }), '', 'a post is said only with its page');
  assert.equal(factLine({ ...FACTS[1], source_url: 'https://www.linkedin.com/in/someone' }), '', 'a profile is never a source');
  assert.equal(factLine({ ...FACTS[2], text: 'Changed role \u2014 was COO' }), '', 'a dash is never shown');
  assert.equal(factLine({ kind: 'post', text: 42 }), '');
});

test('fact lines keep their order, stop at the cap, and name each post as a source', () => {
  assert.deepEqual(factLines(FACTS), [factLine(FACTS[1]), factLine(FACTS[2])]);
  assert.equal(factLines(FACTS).length, FACT_LINES_MAX);
  assert.deepEqual(factLines(null), []);
  assert.deepEqual(factSources(FACTS), [{ label: 'Their post, Sep 2026', url: 'https://example.org/post/1' }]);
});

test('a card reads its facts before the record\'s prose, cites the post, and passes card grammar', () => {
  const c = { contact_id: id(91), who: 'Chief executive of Harbour Foods.', hook: 'Harbour Foods doubled its stores in two years.', facts: FACTS };
  const card = cardOf(c);
  assertCard(card, 'with facts');
  assert.equal(card.why[0], factLine(FACTS[1]));
  assert.equal(card.why[1], factLine(FACTS[2]));
  assert.ok(card.sources.some(s => s.url === 'https://example.org/post/1'));
  assert.deepEqual(cardGrammar(card, { records: [c.who, c.hook] }), []);
  // No facts served: the card is what it was.
  const { facts, ...bare } = c;
  assert.deepEqual(cardOf(bare).why, whyLines(bare, { ask: 'partner', at: NOW }));
});

test('facts can carry a card the record\'s prose alone could not', () => {
  const thin = { contact_id: id(92), who: 'Partner at Example Capital.', hook: 'There is no recent news for Example Capital to indicate a need.' };
  assert.equal(cardOf(thin), null);
  assert.ok(cardOf({ ...thin, facts: [FACTS[1]] })?.why.includes(factLine(FACTS[1])));
});
