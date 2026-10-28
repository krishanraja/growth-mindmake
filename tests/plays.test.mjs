import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYS, playOf, playAllowed, playsToFill, pickApproach, approachQueue, selectRooms, selectAfter, selectStages, pathsOf, takenOf, engineOnPick, playsShadow,
  FOCUS_MAX, DRAFTS_PER_DAY, ROOM_DAYS, STAGE_DAYS } from '../src/stages/plays.mjs';
import { roomRank } from '../src/stages/rooms.mjs';
import { lessons } from '../src/stages/rows.mjs';
import { canon, AT, id, daysAgo } from './support/section12.mjs';

// The focus playbooks for Mindmake, ported from Control Center (plan section
// 12, M7). Every person, show, room and id below is invented.
//
// Parity table (Control Center tests/api/focus.test.ts and api/_focus.ts: engine test):
//   the name-out plays are podcast_pitch, stage_submit and press:          the same
//   an open or not-yet ruling holds them, yes runs them, a guest invite
//     is never held:                                                       the same
//   a drafting play declares its paths and never 'none':                   the same
//   a catch-up (touch_due) never goes on a rich path:                      the same
//   the refill takes the plays in order, under three on his list, one a
//     play, and its cap is three drafts a day:                             the same
//   a stranger with no path is never picked, even with a pitch drafted:    the same
//   on a hop the approach goes to the mutual, never the target:            the same
//   a hop guest and a hop show through one mutual make one approach:       the same
//   a warm guest's existing Gmail draft comes forward with no new draft:   the same
//   guests by fit, shows by score, ties on id:                             the same
//   rooms: verified or unknown, an https page, inside 14 days, his city
//     or online, best by roomRank; a buyer room by its buyers:            the same
//   the stages that asked: an https form, sourced or queued, inside 30
//     days of a deadline or none stated, by score then deadline:          the same
// Where the engine decides otherwise, each is a code (playsShadow):
//   host_room is ruled out (Rooms are guest seats only, Krish, 2026-10-27)
//   press is no lane of the engine's (press_not_a_lane)
//   a show is pitched by Jonny to its booking contact, so pitches.mjs's
//     holds decide (no_booking_address, quiet_show, already_pitched ...)
//   a room Control Center would bring with no verified date is held by the
//     engine's room gate (date_unverified)

const pathTo = (target, path, contact, mutual = null) => ({ id: target, path, contact_id: contact, mutual, others: 0, target_name: path === 'none' ? null : 'Avery Example', form_url: null, line: '' });
const none = { contacts: new Set(), guests: new Set(), targets: new Set() };

test('the books: every play of Control Center\'s three Mindmake books, in order, with its engine home', () => {
  assert.deepEqual(PLAYS.filter(p => p.book === 'visibility').map(p => p.id), ['podcast_pitch', 'guest_invite', 'event_go', 'stage_submit', 'press', 'host_room', 'event_followup', 'piece']);
  assert.deepEqual(PLAYS.filter(p => p.book === 'revenue').map(p => p.id), ['reply_waiting', 'warm_ask', 'intro_ask', 'buyer_room']);
  assert.deepEqual(PLAYS.filter(p => p.book === 'network').map(p => p.id), ['touch_due', 'alumni', 'amplifiers']);
  assert.deepEqual(PLAYS.filter(p => p.founder_visible).map(p => p.id), ['podcast_pitch', 'stage_submit', 'press']);
  for (const p of PLAYS) {
    if (p.prepare === 'draft') assert.ok(p.paths?.length && !p.paths.includes('none'), `${p.id}: a drafting play declares its paths, never none`);
    if (p.home === 'row') assert.ok(['reach_out', 'network', 'visibility', 'events', 'partners'].includes(p.row) && p.by, `${p.id}: a row and the stage that writes it`);
    else assert.equal(p.row, null, `${p.id}: no row`);
  }
  assert.equal(playOf('host_room').home, 'ruled_out', 'no hosted rooms this year');
  assert.equal(playOf('press').home, 'not_a_lane');
  assert.ok(!playOf('touch_due').paths.includes('rich'), 'a catch-up is for people he knows');
});

test('the founder ruling as a gate, and the refill\'s caps', () => {
  assert.equal(playAllowed(playOf('podcast_pitch'), null), false);
  assert.equal(playAllowed(playOf('podcast_pitch'), 'not_yet'), false);
  assert.equal(playAllowed(playOf('podcast_pitch'), 'yes'), true);
  assert.equal(playAllowed(playOf('guest_invite'), null), true);
  assert.deepEqual(playsToFill('visibility', { founder: null }).map(p => p.id), ['guest_invite'], 'Control Center\'s held plays are not drafted');
  assert.deepEqual(playsToFill('visibility', { founder: 'yes' }).map(p => p.id), ['podcast_pitch', 'guest_invite', 'press']);
  assert.deepEqual(playsToFill('visibility', { founder: 'yes', openFocus: 2 }).map(p => p.id), ['podcast_pitch'], 'under three on his list');
  assert.deepEqual(playsToFill('visibility', { founder: 'yes', openByPlay: new Map([['podcast_pitch', 1]]) }).map(p => p.id), ['guest_invite', 'press'], 'one a play');
  assert.deepEqual(playsToFill('network', { founder: null }).map(p => p.id), ['touch_due']);
  assert.equal(FOCUS_MAX, 3);
  assert.equal(DRAFTS_PER_DAY, 3);
});

test('pickApproach: never a none path, the mutual on a hop, one approach a contact, an existing warm draft kept', () => {
  const guest = playOf('guest_invite');
  const stranger = { id: id(1), fit_score: 90, buried_at: null, last_email_draft_url: 'https://mail.example/drafts/1' };
  const warm = { id: id(2), fit_score: 70, buried_at: null, last_email_draft_url: 'https://mail.example/drafts/2' };
  const hop = { id: id(3), fit_score: 80, buried_at: null, last_email_draft_url: null };
  const paths = new Map([[`guest:${id(1)}`, pathTo(id(1), 'none', null)], [`guest:${id(2)}`, pathTo(id(2), 'warm', id(102))], [`guest:${id(3)}`, pathTo(id(3), 'hop', id(103), { name: 'Robin Example', via: 'same_company' })]]);
  assert.equal(pickApproach(guest, { guests: [stranger], paths, taken: none }), null, 'a stranger with a pitch drafted is never picked');
  const first = pickApproach(guest, { guests: [stranger, warm, hop], paths, taken: none });
  assert.equal(first.guest_id, id(3), 'by fit, the stranger skipped');
  assert.equal(first.contact_id, id(103), 'on a hop the approach goes to the mutual');
  assert.equal(first.existing_draft, false);
  const queue = approachQueue(guest, { guests: [stranger, warm, hop], paths, taken: none });
  assert.deepEqual(queue.map(q => q.guest_id), [id(3), id(2)]);
  assert.equal(queue[1].existing_draft, true, "a warm guest's existing draft comes forward with no new draft");
  // A hop guest and a hop show through the same mutual are one approach.
  const show = { id: id(10), type: 'podcast', status: 'queued', visibility_score: 50, score_version: 1, buried_at: null };
  const both = new Map([...paths, [`target:${id(10)}`, pathTo(id(10), 'hop', id(103))]]);
  const taken = { contacts: new Set([first.contact_id]), guests: new Set([first.guest_id]), targets: new Set() };
  assert.equal(pickApproach(playOf('podcast_pitch'), { targets: [show], paths: both, taken }), null);
  assert.equal(pickApproach(playOf('podcast_pitch'), { targets: [show], paths: both, taken: none }).visibility_target_id, id(10));
  // Press reads only press relationships; a podcast is not one.
  assert.equal(pickApproach(playOf('press'), { targets: [show], paths: both, taken: none }), null);
  // A rich path is not a catch-up's.
  const touch = pickApproach(playOf('touch_due'), { touches: [{ contact_id: id(20), next_touch_due_at: daysAgo(1) }], paths: new Map([[`contact:${id(20)}`, pathTo(id(20), 'rich', id(20))]]), taken: none });
  assert.equal(touch, null);
});

test('selectRooms, selectAfter and selectStages pick what Control Center picks', () => {
  const room = (n, over = {}) => ({ id: id(30 + n), url: `https://rooms.example/${n}`, city: 'london', starts_at: new Date(Date.parse(AT) + n * 86400000).toISOString(), date_verified: true, draw_score: 50, demand_score: 50, buyer_density: 0, archived_at: null, decision: null, ...over });
  const rows = [room(1, { draw_score: 40 }), room(2, { draw_score: 90 }), room(3, { date_verified: null }), room(4, { url: 'http://rooms.example/4' }), room(5, { city: 'paris' }), room(6, { city: 'virtual' }), room(ROOM_DAYS + 1), room(7, { decision: 'attend' }), room(8, { date_verified: false }), room(9, { buyer_density: 30, draw_score: 10, demand_score: 10 })];
  const picked = selectRooms(rows, { at: AT, homeCity: 'london' }).map(e => e.id);
  assert.deepEqual(picked, [id(32), id(33), id(36), id(31), id(39)].sort((a, b) => roomRank(rows.find(r => r.id === b)) - roomRank(rows.find(r => r.id === a)) || rows.find(r => r.id === a).starts_at.localeCompare(rows.find(r => r.id === b).starts_at)));
  assert.ok(picked.includes(id(33)), 'an unverified date still comes forward in Control Center');
  const buyers = selectRooms(rows, { at: AT, homeCity: 'london', play: 'buyer_room' }).map(e => e.id);
  assert.equal(buyers[0], id(39), 'a buyer room ranks by its buyers first');
  assert.equal(buyers.length, 5);
  assert.deepEqual(selectRooms(rows.map(r => ({ ...r, demand_score: 0 })), { at: AT, homeCity: 'london', play: 'buyer_room' }).map(e => e.id), [id(39)], 'a room with no buyers is no buyer room');
  const after = selectAfter([room(-1, { decision: 'attend' }), room(-8, { decision: 'attend' }), room(-2, { decision: 'attend', outcome: 'worth_it' })], AT);
  assert.deepEqual(after.map(e => e.id), [id(29)], 'behind him, inside 7 days, with no word');
  const stage = (n, over = {}) => ({ id: id(50 + n), type: 'conference', status: 'queued', cfp_url: `https://stages.example/${n}`, deadline_at: new Date(Date.parse(AT) + 10 * 86400000).toISOString(), visibility_score: 50, score_version: 1, buried_at: null, ...over });
  const stages = [stage(1, { visibility_score: 40 }), stage(2, { visibility_score: 70 }), stage(3, { deadline_at: null }), stage(4, { cfp_url: null }), stage(5, { status: 'applied' }), stage(6, { deadline_at: new Date(Date.parse(AT) + (STAGE_DAYS + 1) * 86400000).toISOString() }), stage(7, { type: 'press_relationship' })];
  assert.deepEqual(selectStages(stages, AT).map(s => s.id), [id(52), id(53), id(51)]);
});

test('engineOnPick: the engine decides each pick by its own lanes and holds', () => {
  const show = { id: id(60), type: 'podcast', status: 'queued', verdict: 'take', title: 'The Example Show', organizer: 'Example Media', booking_contact_id: id(61), latest_episode_at: daysAgo(5), episodes: 30, buried_at: null, applied_at: null };
  const ctx = { byTarget: new Map([[show.id, show], [id(62), { ...show, id: id(62), booking_contact_id: null }]]), byGuest: new Map(), L: lessons([], AT), invited: new Set(), pitched: new Set(), routes: {}, at: AT, canon };
  assert.equal(engineOnPick({ play: 'podcast_pitch', visibility_target_id: show.id }, ctx), null, 'Jonny pitches the same show');
  assert.equal(engineOnPick({ play: 'podcast_pitch', visibility_target_id: id(62) }, ctx), 'no_booking_address');
  assert.equal(engineOnPick({ play: 'press', visibility_target_id: show.id }, ctx), 'press_not_a_lane');
  assert.equal(engineOnPick({ play: 'stage_submit', visibility_target_id: show.id }, ctx), 'form_not_read', 'no form fields read: nothing the engine can fill');
  const declined = lessons([{ state: 'declined', row: 'visibility', subject_ref: `target:${show.id}`, reason_code: 'not_my_topic', decided_at: daysAgo(2), features: { topic: null } }], AT);
  assert.equal(engineOnPick({ play: 'podcast_pitch', visibility_target_id: show.id }, { ...ctx, L: declined }), 'declined_on_row', 'his No on the show holds it');
});

test('playsShadow: counts and codes beside Control Center\'s picks, the context unchanged', () => {
  const show = n => ({ id: id(70 + n), type: 'podcast', status: 'queued', verdict: 'take', title: `The Example Show ${n}`, organizer: 'Example Media', booking_contact_id: n === 2 ? null : id(80 + n), latest_episode_at: daysAgo(5), episodes: 30, visibility_score: 60 - n, score_version: 1, buried_at: null, applied_at: null });
  const press = { id: id(75), type: 'press_relationship', status: 'sourced', title: 'Example Weekly', visibility_score: 50, score_version: 1, buried_at: null };
  const context = {
    records: { visibility: [show(1), show(2), show(3), press], guests: [], advisory: [{ id: id(90), contact_id: id(93), visibility_target_id: null, guest_id: null }], events: [{ id: id(95), url: 'https://rooms.example/1', city: 'london', starts_at: new Date(Date.parse(AT) + 86400000).toISOString(), date_verified: null, draw_score: 80, demand_score: 40, decision: null }] },
    paths: { ok: true, guests: [], targets: [pathTo(id(71), 'warm', id(91)), pathTo(id(72), 'hop', id(92)), pathTo(id(73), 'warm', id(93)), pathTo(id(75), 'rich', id(94))], events: [] },
    feedback: [], routes: {},
  };
  const frozen = structuredClone(context);
  const { verdicts, line } = playsShadow({ context, canon, at: AT });
  assert.deepEqual(context, frozen);
  // Show 3's contact already has an Advisory row, so Control Center skips it; show 2 has no booking address for Jonny.
  assert.deepEqual(verdicts.map(v => [v.play, v.code]), [['podcast_pitch', null], ['podcast_pitch', 'no_booking_address'], ['press', 'press_not_a_lane']]);
  assert.match(line, /^Focus playbooks, in shadow: 3 picks read; agrees with Control Center on 1, differs on 2 \(no_booking_address 1, press_not_a_lane 1\)\. Plays: 15 of Control Center's for Mindmake; 7 on an engine row, 5 stay on his list, 1 ruled out \(hosted rooms\), 1 with no lane, 1 unwired\. Caps: it would draft 3 of 3 today/);
  assert.match(line, /Rooms: 1 read, not compared \(his city is not served\)\.$/);
  const city = playsShadow({ context, canon, at: AT, homeCity: 'london' }).line;
  assert.equal(playsShadow({ context: { ...context, home_city: 'london' }, canon, at: AT }).line, city, "the city Control Center serves is the one the rooms are compared in");
  assert.match(playsShadow({ context: { ...context, home_city: null }, canon, at: AT }).line, /his city is not served/);
  assert.match(city, /Rooms: it would bring 1 of 1; the engine's room gate holds 1 \(date_unverified\)\.$/);
  assert.doesNotMatch(line, /[0-9a-f]{8}-[0-9a-f]{4}-|@|https?:\/\/|Example/, 'counts and codes only');
  assert.ok(line.length <= 500, 'inside the report\'s line');
  assert.deepEqual(pathsOf({}).size, 0);
  assert.deepEqual([...takenOf(context).contacts], [id(93)]);
});
