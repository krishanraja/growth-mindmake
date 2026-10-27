import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, readCanon, CanonError } from '../src/stages/canon.mjs';
import { kindsOf, reachOf, countIn, lessons, refusedBy, amplifierRows, rankRows, score, fitTitle, channelOf, servesOf, fitHold, cleanName, lastContact, caseFor, FIT_FLOOR, BECAUSE_MAX, BRIEF_LINE_MAX } from '../src/stages/rows.mjs';
import { icpOf, signalRequests, signalRows, isoWeek } from '../src/stages/signals.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';

// Synthetic only: fictional people, .test addresses, example links.
const NOW = '2026-10-26T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n- **Build your AI revenue engine.** Something else.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Send the Mindmake one-pagers and offers to warm leads', 'Have a clear plan for driving partnerships and visibility for Mindmake'];

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = (n, title, extra = {}) => ({ contact_id: id(n), network_tier: '2_core_network', current_title: title, followers: null, plays: [], roles: [], mindmake_fit: 60, sells_competing_services: false, contacts: { id: id(n), full_name: `Avery Example${n}`, title, company: `Company ${n}`, company_domain: `c${n}.test`, status: 'active' }, ...extra });
const route = (email = 'verified', extra = {}) => ({ email, x: false, linkedin: true, instagram: false, whatsapp: false, ...extra });

test('canon is read from the venture as it is today: the main ask, its link, the brain door and the Horizon, named by blob SHA', async () => {
  assert.deepEqual(canon.ask, { label: 'Start building your AI brain', url: 'https://mindmake.example/?start=1', description: 'answer a few questions, keep the brief, then a free consultation' });
  assert.equal(canon.brain, 'Your taste, standards and judgement, running as a system you own.');
  assert.equal(blobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a', 'the same SHA git gives');
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
    decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1),
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-rows-12345678', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }] });
  assert.equal(result.status, 'succeeded');
  const report = reports[0];
  assert.equal(report.schema_version, '1.6.0');
  assert.deepEqual(asked, [['posts', 'posts', 'posts', 'question', 'question', 'question', 'question'], ['post_engagers']], 'round one finds posts, round two reads who argued');
  assert.equal(contextReads, 1, 'no person was filed in these two rounds, so no second context read');
  const rows = report.proposals.filter(p => p.row);
  assert.deepEqual(rows.map(p => p.row).sort(), ['events', 'partners', 'reach_out', 'visibility'], 'one amplifier on each of four rows; the tie with no route waits');
  assert.ok(report.holds.some(h => h.reason === 'row_signal_awaiting_route'), 'the stranger found today gets a route on the next run');
  assert.ok(rows.every(p => p.wall === 'send' && p.stage === null && p.subject_ref?.startsWith('contact:') && p.source_revision.length === 3 && p.title.length <= 72));
  assert.equal(new Set(rows.map(p => `${p.row}:${p.rank}`)).size, rows.length, 'one rank per place in a row');
  const printed = JSON.stringify(result);
  assert.equal(/Avery|Robin|Sam|Pat/.test(printed), false, 'the printed outcome carries counts, never a name');
  assert.equal(result.rows.prepared, rows.length);
  assert.ok(rows.every(p => !('because' in p) && !('brief' in p)), 'a 1.6.0 Control Center gets the rows without their reasons');

  // Before Control Center reads rows, the engine reports as it always has.
  const older = []; const cc2 = { ...cc, capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { context: true } }), postReport: async r => { older.push(r); return { replayed: false }; }, readReport: async () => older.at(-1) };
  await runDispatch({ cc: cc2, source: async () => ({}), policy, registry: {}, attemptId: 'gma-rows-older-1234', clock: () => NOW, canonReader: async () => { throw new Error('never read'); } });
  assert.equal(older[0].schema_version, '1.2.0');
  assert.equal(older[0].proposals.some(p => 'row' in p), false);
});

test('a canon that cannot be read holds every row and says why', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture(), capabilities: async () => ({ schema_versions: ['1.6.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { schema_version: '1.6.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [], records: { advisory: [] }, ...ampContext() } }),
    decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1) };
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
  ctx.amplifier_candidates.push(host(51, { followers: 60000, known_since: '2021-03-02', email_last: '2024-06-02', hook: 'Hosts a weekly show for media operators, plus a live event each spring.', contacts: { ...host(51).contacts, full_name: 'Jess Example⚡️', company: 'Spark Media⚡️' }, current_company: 'Spark Media⚡️' }));
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
  assert.equal(jess.because, 'Host of Example Show 51 at Spark Media. Hosts a weekly show for media operators. Known since 2021, last email Jun 2024.');
  assert.equal(/\p{Extended_Pictographic}/u.test(jess.title + JSON.parse(jess.exact_payload).body + jess.because), false, 'no emoji in the title, the words or the line');
  assert.match(JSON.parse(jess.exact_payload).body, /^Hi Jess,/);
  assert.equal(cleanName('Avery Example⚡️ '), 'Avery Example');
  const told = caseFor({ c: { network_tier: '2_core_network' }, name: 'Avery Example', company: '', ask: 'introduce', kind: 'connector', reach: { band: 'unknown' }, fit: 50, serves: GOALS[0] });
  assert.equal(told.because, 'No email on record.', 'with nothing else held, it says only what is known');
  assert.ok(told.brief.includes(`The ask: one introduction to a leader working out what AI should do for them. It serves this week's goal: ${GOALS[0]}.`));
});

test('signal rows carry their reasons too: who they are and what they said in public', () => {
  const research = [{ request_id: 'engagers:x', kind: 'post_engagers', status: 'answered', answered_at: NOW, evidence: [engager('known-exec', 'Kim Known', 'COO, Example Media', 'My board asked what AI means for our managers. I had no good answer.', id(21))] }];
  const r = signalRows({ context: { routes: { [id(21)]: route() }, feedback: [] }, research, weekGoals: GOALS, canon, files: FILES, at: NOW });
  const p = r.rows[0].proposal;
  assert.equal(p.because, 'COO, Example Media. Worried in public about AI and their job.');
  assert.ok(p.brief.length >= 2 && p.brief.every(l => l.length <= BRIEF_LINE_MAX));
  assert.ok(p.brief.some(l => l.startsWith('They wrote in Oct 2026: "My board asked')));
});

test('a dispatch run against Control Center 1.7.0 reports 1.7.0, and every row carries its line and its brief', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.7.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0'], features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: { schema_version: '1.7.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [] }, ...ampContext() } }),
    decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-rows-17-123456', clock: () => NOW,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'b'.repeat(40) }] });
  assert.equal(result.status, 'succeeded');
  assert.equal(reports[0].schema_version, '1.7.0');
  const rows = reports[0].proposals.filter(p => p.row);
  assert.ok(rows.length >= 3);
  assert.ok(rows.every(p => p.because && p.because.length <= BECAUSE_MAX && Array.isArray(p.brief) && p.brief.length >= 2 && p.brief.length <= 6));
  assert.equal(/Avery|Robin/.test(JSON.stringify(result)), false, 'the printed outcome carries counts, never a name');
});
