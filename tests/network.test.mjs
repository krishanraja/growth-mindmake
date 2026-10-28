import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { pitchRows, networkLane, networkListed, krishInviteWords, krishPitchWords, krishSpeakWords, inviteShow, NETWORK_HOLD } from '../src/stages/pitches.mjs';
import { showNoteRows } from '../src/stages/shownotes.mjs';
import { KRISH_TITLE } from '../src/stages/rows.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture, violations, parseActionV2 } from './support/engine-protocol-service.mjs';
import { GUEST } from './support/standard.mjs';

// Ruling (Krish, 2026-10-28): "anyone that comes from inside my Network,
// should only ever be emailed by me." Jonny's lane never carries a recipient
// Control Center says is in his network, nor one it cannot say about; the
// same approach goes on Krish's own row instead. Synthetic only: invented
// people, shows and ids.

const NOW = '2026-10-27T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.co/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Have a clear plan for driving partnerships and visibility for Mindmake'];
const EM = String.fromCharCode(8212);

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NAMES = ['Avery Example', 'Sam Sample', 'Jordan Test', 'Riley Placeholder'];
const guest = (n, over = {}) => ({ contact_id: id(300 + n), name: NAMES[(n - 1) % NAMES.length], status: 'enriched', invite_show: 'makeyourmindup', invite_state: null,
  ...GUEST.take, buried_at: null, recorded_at: null, published_at: null,
  one_liner: 'Chief Marketing Officer at Example Retail, rebuilding a marketing team around AI', why_fit: 'Runs a marketing team that changed how it works with AI.',
  evidence: [{ url: `https://talks.example/guest-${n}`, label: 'How marketing teams change with AI', at: '2026-10-01T00:00:00Z', kind: 'talk' }], ...over });
const show = (n, over = {}) => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', organizer: 'Avery Example', buried_at: null, applied_at: null,
  event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, episodes: 80, latest_episode_at: '2026-10-20T00:00:00Z', booking_contact_id: id(100 + n),
  audience: 'Marketing leaders at mid-size companies', angle: null, why_him: 'The show interviews operators who changed how a company works.', why_now: null, ...over });
const summit = (n, over = {}) => show(n, { type: 'conference', title: `The Example Summit ${n}`, status: 'sourced', deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-01-20T00:00:00Z', ...over });
/** Routes for contacts n, each with Control Center's in_network as given (undefined leaves the field out). */
const routesFor = (ns, in_network) => Object.fromEntries(ns.map(n => [id(n), in_network === undefined ? { email: 'verified' } : { email: 'verified', in_network }]));
const run = (context, networkRoutes) => pitchRows({ context: { feedback: [], ...context }, weekGoals: GOALS, canon, files: FILES, at: NOW, networkRoutes });
const action = p => JSON.parse(p.exact_payload);
const jonnyTo = r => r.proposals.filter(p => action(p).mailbox === 'jonny').map(p => action(p).recipient_contact_id);

test('whose box may write: Control Center\'s flag, his own tiers on a list, and a show\'s own booking address', () => {
  const listed = networkListed({ network: [{ contact_id: id(1), network_tier: '2_core_network' }, { contact_id: id(2), network_tier: '6_cold' }], quiet_ties: [{ contact_id: id(3), network_tier: '1_reciprocated' }], amplifier_candidates: [{ contact_id: id(4) }] });
  assert.deepEqual([...listed.keys()].sort(), [id(1), id(2), id(3), id(4)]);
  const lane = (n, flag, opts = {}) => networkLane(id(n), { routes: flag === undefined ? {} : { [id(n)]: { in_network: flag } }, listed, ...opts });
  // Served: true is his, false is Jonny's, null or missing is unknown.
  assert.equal(lane(9, true, { served: true }), 'krish');
  assert.equal(lane(9, false, { served: true }), 'jonny');
  assert.equal(lane(9, null, { served: true }), 'unknown');
  assert.equal(lane(9, undefined, { served: true }), 'unknown');
  // Not served: a false says nothing; a true is still his.
  assert.equal(lane(9, false), 'unknown');
  assert.equal(lane(9, true), 'krish');
  assert.equal(lane(9, undefined), 'unknown');
  // A list that puts them on one of his own tiers is his, whatever else is said.
  assert.equal(lane(1, false, { served: true }), 'krish');
  assert.equal(lane(3, undefined), 'krish');
  // A show's booking address no network list names may still go to Jonny; one a list names may not.
  assert.equal(lane(9, undefined, { booking: true }), 'jonny');
  assert.equal(lane(9, null, { served: true, booking: true }), 'jonny');
  assert.equal(lane(2, undefined, { booking: true }), 'unknown', 'on a list, even a cold tier, is not outside every list');
  assert.equal(lane(4, null, { served: true, booking: true }), 'unknown');
  assert.equal(lane(1, undefined, { booking: true }), 'krish');
  assert.equal(networkLane('not-an-id', { routes: {}, listed, served: true, booking: true }), 'unknown');
  assert.deepEqual(NETWORK_HOLD, { krish: 'network_is_krish', unknown: 'jonny_network_unknown' });
});

test('a guest invite: unknown and not served are held, outside his network is Jonny\'s as before, inside it is his own row', () => {
  const guests = [guest(1), guest(2, { invite_show: 'signal_noise' })];
  const records = { visibility: [], drafts: [], guests };
  // The flag not served: every guest is possibly in his network, so Jonny invites nobody.
  for (const [routes, served] of [[routesFor([301, 302]), false], [routesFor([301, 302], false), false], [routesFor([301, 302], null), true], [routesFor([301, 302]), true]]) {
    const r = run({ records, routes }, served);
    assert.deepEqual(jonnyTo(r), [], JSON.stringify({ served }));
    assert.deepEqual(r.krishRows, []);
    assert.deepEqual(r.inviteHeld, ['jonny_network_unknown', 'jonny_network_unknown'], 'held with a counted reason');
  }
  // Served and false: Jonny's lane proceeds as today.
  const out = run({ records, routes: routesFor([301, 302], false) }, true);
  assert.deepEqual(jonnyTo(out), [id(301), id(302)]);
  assert.deepEqual(out.krishRows, []);
  // Served and true: nobody in Jonny's lane, the same two on his own visibility row.
  const inside = run({ records, routes: routesFor([301, 302], true) }, true);
  assert.deepEqual(jonnyTo(inside), []);
  assert.deepEqual(inside.inviteHeld, ['network_is_krish', 'network_is_krish']);
  assert.equal(inside.krishRows.length, 2);
  const [{ proposal: p }] = inside.krishRows;
  assert.equal(p.row, 'visibility');
  assert.equal(p.target, id(301));
  assert.equal(p.close_condition.reference, 'visibility:invite', 'it counts against the week\'s invites like any other');
  assert.equal(p.title, 'Invite Avery Example onto Make Your Mind Up');
  assert.ok(p.proposal_id.startsWith('gmw-'), 'one of his own rows, never a Jonny pitch');
  const a = action(p);
  assert.equal('mailbox' in a, false, 'no mailbox: his Draft press drafts it into his own box');
  assert.deepEqual([a.version, a.channel, a.recipient_contact_id], [2, 'email', id(301)]);
  assert.equal(a.subject, 'A conversation for Make Your Mind Up');
  assert.equal(a.body, [
    'Hi Avery,',
    "I write Make Your Mind Up (https://publication.example), and I'd love to have you for one of its weekly conversations.",
    'I came across "How marketing teams change with AI", and it\'s the kind of thinking I\'d like more of on the show.',
    'Would you be up for it in the coming weeks? I can send a short brief and a few dates.',
    'Krish',
  ].join('\n\n'));
  assert.doesNotMatch(a.body, /Jonny|\bhe\b|\bhim\b|Krish Raja|\bwe\b/i, 'his own first person, never Jonny\'s third');
  assert.equal(parseActionV2(p.exact_payload).ok, true, 'Control Center reads it');
  assert.ok(p.brief.at(-1).includes('from your own Gmail'));
  assert.equal(JSON.stringify(inside.krishRows).includes(EM), false);
  const sn = action(inside.krishRows[1].proposal);
  assert.ok(sn.body.includes(`I'm ${KRISH_TITLE}, and I'd love to have you on the show for a conversation.`));
});

test('his own invites keep the week\'s picks but never take Jonny\'s room', () => {
  const guests = [guest(1), guest(2), guest(3), guest(4)];
  const routes = { ...routesFor([301, 302], true), ...routesFor([303, 304], false) };
  // Jonny's ten are spent today: his own rows still go out, Jonny's invites wait.
  const drafts = Array.from({ length: 10 }, (_, i) => ({ mailbox: 'jonny', created_at: '2026-10-27T08:00:00Z', visibility_target_id: id(900 + i) }));
  const r = run({ records: { visibility: [], drafts, guests }, routes }, true);
  assert.deepEqual(jonnyTo(r), []);
  assert.deepEqual(r.krishRows.map(e => e.proposal.target), [id(301), id(302)], 'the two the week picks first, both his');
  assert.equal(r.inviteHeld.filter(h => h === 'invite_week_or_run_cap').length, 2);
});

test('a podcast or stage booker in his network gets his own row; an unknown booker on a network list is held; one on no list is Jonny\'s', () => {
  const visibility = [show(1), show(2), show(3), summit(4)];
  const network = [{ contact_id: id(102), network_tier: '6_cold' }];
  const routes = { [id(101)]: { in_network: true }, [id(104)]: { in_network: true } };
  const r = run({ records: { visibility, drafts: [] }, network, routes }, false);
  assert.deepEqual(jonnyTo(r), [id(103)], 'only the show whose booker no network list names');
  assert.deepEqual(r.held.sort(), ['jonny_network_unknown', 'network_is_krish']);
  assert.deepEqual(r.stageHeld, ['network_is_krish']);
  const rows = r.krishRows.map(e => e.proposal);
  assert.deepEqual(rows.map(p => [p.row, p.subject_ref, p.close_condition.reference]), [['visibility', `target:${id(1)}`, 'visibility:pitch'], ['events', `target:${id(4)}`, 'events:pitch']]);
  for (const p of rows) {
    const a = action(p);
    assert.equal('mailbox' in a, false);
    assert.ok(a.body.endsWith('\n\nKrish') && !/Jonny|\bhe\b|\bhim\b/i.test(a.body));
    assert.equal(parseActionV2(p.exact_payload).ok, true);
    assert.ok(p.proposal_id.startsWith('gmw-'));
  }
  assert.equal(action(rows[0]).body.split('\n\n')[1], "I'd love to come on The Example Show 1 and talk about what an AI that knows a marketing leader should actually do.");
  assert.match(action(rows[1]).body, /I'd like to put myself forward for a talk at The Example Summit 4: "/);
  // With the flag served and false, every booker is Jonny's as today.
  const served = run({ records: { visibility, drafts: [] }, network, routes: Object.fromEntries([1, 2, 3, 4].map(n => [id(100 + n), { in_network: false }])) }, true);
  assert.deepEqual(jonnyTo(served).sort(), [id(101), id(102), id(103), id(104)]);
  assert.deepEqual(served.krishRows, []);
});

test('the show-notes note goes from Jonny only to a host outside his network; inside it, or unknown on a list, it is held, never rewritten', () => {
  const visibility = [show(1), show(2), show(3)];
  const drafts = [1, 2, 3].map(n => ({ visibility_target_id: id(n), job: 'booked', mailbox: 'jonny', booked_at: '2026-10-26T10:00:00Z', created_at: '2026-10-20T10:00:00Z' }));
  const context = { records: { visibility, drafts }, routes: { [id(101)]: { in_network: true } }, network: [{ contact_id: id(102), network_tier: '6_cold' }] };
  const r = showNoteRows({ context, canon, files: FILES, at: NOW, room: 10 });
  assert.deepEqual(r.proposals.map(p => action(p).recipient_contact_id), [id(103)]);
  assert.deepEqual(r.held.sort(), ['jonny_network_unknown', 'network_is_krish']);
  const served = showNoteRows({ context: { ...context, routes: { [id(101)]: { in_network: true }, [id(102)]: { in_network: false } } }, canon, files: FILES, at: NOW, room: 10, networkRoutes: true });
  assert.deepEqual(served.proposals.map(p => action(p).recipient_contact_id).sort(), [id(102), id(103)]);
  assert.deepEqual(served.held, ['network_is_krish']);
});

test('across every mix of flag, value and list, Jonny\'s lane never carries anyone in his network or anyone unknown', () => {
  const values = [true, false, null, undefined];
  const tiers = [null, '1_reciprocated', '3_known_network', '6_cold'];
  let jonny = 0, his = 0;
  for (const served of [true, false]) for (const v of values) for (const tier of tiers) {
    const lists = tier === null ? {} : { network: [{ contact_id: id(301), network_tier: tier }, { contact_id: id(101), network_tier: tier }] };
    const routes = { [id(301)]: v === undefined ? { email: 'verified' } : { email: 'verified', in_network: v }, [id(101)]: v === undefined ? {} : { in_network: v } };
    const drafts = [{ visibility_target_id: id(2), job: 'booked', mailbox: 'jonny', booked_at: '2026-10-26T10:00:00Z', created_at: '2026-10-20T10:00:00Z' }];
    const context = { records: { visibility: [show(1), show(2, { booking_contact_id: id(101) })], drafts, guests: [guest(1)] }, routes, ...lists };
    const r = pitchRows({ context: { feedback: [], ...context }, weekGoals: GOALS, canon: { ...canon }, files: FILES, at: NOW, networkRoutes: served, showNotes: true });
    const listed = networkListed(context);
    for (const to of jonnyTo(r)) {
      jonny++;
      const booking = to === id(101);
      assert.equal(networkLane(to, { routes, listed, served, booking }), 'jonny', JSON.stringify({ served, v, tier, to }));
      assert.notEqual(routes[to]?.in_network, true, 'never someone Control Center says is his');
      assert.ok(!['1_reciprocated', '3_known_network'].includes(tier), 'never someone on his own tier');
      if (!booking) assert.ok(served && v === false, 'a guest goes to Jonny only on a served false');
    }
    his += r.krishRows.length;
    for (const { proposal } of r.krishRows) assert.equal('mailbox' in action(proposal), false);
  }
  assert.ok(jonny > 0 && his > 0, 'the sweep saw both lanes');
});

test('the Krish words are his first person, from the same facts as Jonny\'s', () => {
  const words = krishPitchWords({ show: 'The Example Show', topic: null, canon });
  assert.equal(words.subject, 'A guest for The Example Show: an AI that knows the leader');
  assert.ok(words.lines[1].startsWith(`I'm ${KRISH_TITLE} and I write Make Your Mind Up (https://publication.example). At Mindmake I help leaders build their AI brain: "`));
  const speak = krishSpeakWords({ event: 'The Example Summit', ask: 'a panel seat', talk: 'The org chart after AI', canon });
  assert.equal(speak.lines[0], 'I\'d like to put myself forward for a panel seat at The Example Summit: "The org chart after AI".');
  assert.equal(krishInviteWords({ show: inviteShow('makeyourmindup', canon), page: { label: 'x', url: 'https://talks.example/1' } }).lines.length, 2, 'a one-word page title is never quoted');
  for (const w of [words, speak]) assert.equal(JSON.stringify(w).includes(EM), false);
});

test('a dispatch run puts an in-network guest on his own row, holds the unknown with a counted reason, and stays inside the schema', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0'];
  const once = async (features, routes) => {
    const reports = [];
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true, ...features } }),
      context: async () => ({ ok: true, context: { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }], records: { advisory: [], visibility: [show(1)], drafts: [], guests: [guest(1), guest(2)] }, amplifier_candidates: [], routes, feedback: [], research: [] } }),
      decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-network-1234', clock: () => NOW,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => null });
    assert.equal(result.status, 'succeeded');
    assert.deepEqual(violations(schema, reports[0]), []);
    return reports[0];
  };
  const recipients = rep => rep.proposals.filter(p => p.exact_payload).map(p => ({ to: action(p).recipient_contact_id, jonny: action(p).mailbox === 'jonny', ref: p.subject_ref, row: p.row, rank: p.rank }));
  // Not served: no guest in Jonny's lane, both held as unknown, counted once.
  const blind = await once({}, routesFor([301, 302]));
  assert.deepEqual(recipients(blind).filter(r => r.jonny).map(r => r.ref), [`target:${id(1)}`], 'the podcast\'s own address still goes; no guest does');
  assert.ok(blind.holds.some(h => h.reason === 'invite_jonny_network_unknown' && h.detail.startsWith('2 guests')));
  assert.ok(blind.activity.some(a => a.line === "His network, never Jonny's box: 0 invites or pitches to someone in it written as his own rows; 2 held because Control Center does not yet say whether the person is in it."));
  // Served: one inside his network, one outside.
  const mixed = await once({ network_routes: true }, { ...routesFor([301], true), ...routesFor([302], false) });
  const r = recipients(mixed);
  assert.deepEqual(r.filter(x => x.jonny).map(x => x.to), [id(302), id(101)], 'the guest outside his network, then the podcast');
  const own = r.filter(x => !x.jonny && x.to === id(301));
  assert.equal(own.length, 1, 'the guest inside it, once, on his own row');
  assert.deepEqual([own[0].row, own[0].ref, own[0].rank], ['visibility', `contact:${id(301)}`, 1]);
  assert.ok(mixed.holds.some(h => h.reason === 'invite_network_is_krish'));
  assert.equal(mixed.holds.some(h => h.reason === 'invite_jonny_network_unknown'), false);
});
