import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { factTest, factOf, plain } from '../src/stages/rows.mjs';
import { cardGrammar } from '../src/crew/lints/grammar.mjs';
import { crewShadow, crewContext, lintAll, LINT_MODULES, CHECK_MODULES, CREW_LINE } from '../src/crew/shadow.mjs';
import * as network from '../src/crew/lints/network.mjs';
import * as visibility from '../src/crew/lints/visibility.mjs';
import * as stages from '../src/crew/lints/stages.mjs';
import * as signals from '../src/crew/lints/signals.mjs';
import * as trust from '../src/crew/lints/trust.mjs';
import * as measurement from '../src/crew/lints/measurement.mjs';
import * as guard from '../src/crew/lints/guard.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { capsReport, capsContext, AT } from './support/caps-scenario.mjs';
import { STAGE } from './support/standard.mjs';

// The crew as code (plan Phase 3): card grammar, each specialist's lint and
// measured check, all in shadow. Synthetic people, shows and ids only.
const root = new URL('../', import.meta.url);
const policy = JSON.parse(await readFile(new URL('config/policy.json', root), 'utf8'));
const index = JSON.parse(await readFile(new URL('crew/index.json', root), 'utf8'));
const shapesDir = new URL('tests/fixtures/live-shapes/', root);
const SHAPES = await Promise.all((await readdir(shapesDir)).filter(f => f.endsWith('.json')).sort().map(async f => JSON.parse(await readFile(new URL(f, shapesDir), 'utf8'))));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ── The fact test ───────────────────────────────────────────────────────────

test('the fact test says why a record sentence is not a fact, and agrees with factOf on every fact', () => {
  const facts = ['Rebuilt the marketing team around AI tools last year.', 'Took two media software companies through a sale.', 'Runs a newsletter for 12,000 retail leaders.', 'Chairs the board of Example Foods.'];
  for (const f of facts) { assert.deepEqual(factTest(f), { ok: true, reason: null }, f); assert.equal(factOf(f), plain(f).replace(/[.!?]+$/, ''), f); }
  const cases = [
    ['There is no recent public signal in the provided data.', 'judge_note'],
    ['Not a fit for the brief since the business is not AI-related.', 'verdict'],
    ['Reference a specific recent post if one is known.', 'instruction'],
    ['Built a newsletter to 50,000 readers, worth asking him to unpack on the podcast.', 'prompt'],
    ['Head of Growth at', 'fragment'],
    ['Reads as ai_trainer.', 'slug'],
    ['Founder \u2014 Example Studio.', 'dash'],
    ['Sold the company and then...', 'ellipsis'],
    ['Leads sales.', 'short'],
    ['', 'empty']
  ];
  for (const [s, reason] of cases) { const t = factTest(s); assert.equal(t.ok, false, s); assert.equal(t.reason, reason, s); }
});

// ── Card grammar: every live failure shape and its generated variants ──────

const CLEAN = 'Runs a team of forty people in London.';
const swap = s => s.replaceAll('Example', 'Sample').replaceAll('newsletter', 'podcast');
function place(card, field, line) {
  const c = structuredClone(card);
  if (field === 'who' || field === 'known') c[field] = line;
  else { const [k, i] = field.split('.'); c[k][Number(i)] = line; }
  return c;
}
/** Generated variants of one live shape: other names, a clean fact before it, another field, its case and spacing, a clean line after it. */
function variants(shape) {
  const out = [{ name: 'as recorded', card: shape.card, records: shape.records }];
  const records = shape.records.map(swap);
  out.push({ name: 'other names', card: place(shape.card, shape.field, swap(shape.line)), records });
  out.push({ name: 'a clean fact before it', card: place(shape.card, shape.field, `${CLEAN} ${shape.line}`), records: [...shape.records, CLEAN] });
  out.push({ name: 'inside an engine sentence', card: place(shape.card, shape.field, `Open with what you know: ${shape.line.charAt(0).toLowerCase()}${shape.line.slice(1)}`), records: shape.records });
  out.push({ name: 'extra spacing', card: place(shape.card, shape.field, `  ${shape.line.replace(/ /g, '  ')}  `), records: shape.records });
  out.push({ name: 'a clean line after it', card: { ...structuredClone(shape.card), why: [...shape.card.why, CLEAN] }, records: shape.records });
  if (!['known', 'gain.0'].includes(shape.field) || shape.expect === 'slug') {
    for (const other of ['why.0', 'gain.0', 'who'].filter(f => f !== shape.field)) out.push({ name: `in ${other}`, card: place(place(shape.card, shape.field, other === 'who' ? 'Chief Marketing Officer at Example Retail.' : CLEAN), other, shape.line), records: shape.records });
  }
  if (/^[A-Z]/.test(shape.line) && shape.expect !== 'fragment') out.push({ name: 'lower case first', card: place(shape.card, shape.field, shape.line.charAt(0).toLowerCase() + shape.line.slice(1)), records: shape.records.map(r => r.charAt(0).toLowerCase() + r.slice(1)) });
  return out;
}

test('every live failure shape is held as card_grammar, for the reason it failed', () => {
  assert.ok(SHAPES.length >= 13, 'the live shapes are on file');
  for (const s of SHAPES) {
    assert.equal(s.synthetic, true, `${s.id} is synthetic`);
    const found = cardGrammar(s.card, { records: s.records });
    assert.ok(found.some(f => f.lint === 'card_grammar' && f.reason === s.expect), `${s.id} (${s.fix}) is held as ${s.expect}: ${JSON.stringify(found)}`);
  }
});

test('every generated variant of every live shape is held as card_grammar too', () => {
  let n = 0;
  for (const s of SHAPES) for (const v of variants(s)) {
    n++;
    assert.ok(cardGrammar(v.card, { records: v.records }).some(f => f.lint === 'card_grammar'), `${s.id}, ${v.name}`);
  }
  assert.ok(n >= 100, `${n} variants`);
});

test('a card built from typed slots passes, and a record fact cut back to its fact passes', () => {
  const card = SHAPES[0].card;
  assert.deepEqual(cardGrammar({ ...card, why: ['Rebuilt the marketing team around AI tools last year.'] }, { records: [] }), []);
  // The stage cut a prompt back to its fact: the card carries only the fact, which passes.
  const record = 'Built a newsletter to 50,000 readers, worth asking him to unpack on the podcast.';
  assert.deepEqual(cardGrammar({ ...card, why: [`${factOf(record)}.`] }, { records: [record] }), []);
  // Quotes are the canon's or the person's own words: a dash or a cut inside one is theirs.
  assert.deepEqual(cardGrammar({ ...card, why: ['They wrote: "We cut the team in half and then..."'] }, { records: [] }), []);
});

test('the stages produce no card the grammar holds: every card in the caps fixture passes', async () => {
  const { report } = await capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy });
  const ctx = crewContext({ context: capsContext(), at: AT });
  const cards = report.proposals.filter(p => p.card);
  assert.ok(cards.length >= 10, `${cards.length} cards read`);
  assert.deepEqual(lintAll(report.proposals, ctx, null).filter(f => f.lint === 'card_grammar'), []);
});

// ── Each specialist's lint ─────────────────────────────────────────────────

const ctxWith = context => crewContext({ context: { routes: {}, feedback: [], research: [], records: { visibility: [], guests: [], drafts: [] }, ...context }, canon: { ask: { url: 'https://mindmake.co/?start=1' }, publication: { url: 'https://publication.example' } }, at: AT });
const action = (body, extra = {}) => JSON.stringify({ version: 2, channel: 'email', recipient_contact_id: id(1), subject: 'Catching up', body, ...extra });
const lintIds = (m, p, ctx, spec) => m.lint(p, ctx, spec).map(f => f.lint);

test('the Network Steward holds a tie that is not quiet, runs one way, or asks twice', () => {
  const tie = days => ({ contact_id: id(1), network_tier: '2_core_network', email_inbound: 4, email_outbound: 0, email_last: new Date(Date.parse(AT) - days * 86400000).toISOString(), contacts: { full_name: 'Avery Example', status: 'active' } });
  const p = { proposal_id: 'gmw-1', row: 'network', subject_ref: `contact:${id(1)}`, exact_payload: action('Hi Avery,\n\nBeen a while. Up for a call? Or coffee?\n\nKrish'), card: null };
  const found = lintIds(network, p, ctxWith({ network: [tie(30)], routes: { [id(1)]: { email: 'verified' } } }));
  for (const l of ['network.tie_both_ways', 'network.quiet_90_days', 'network.one_ask']) assert.ok(found.includes(l), l);
  assert.ok(!found.includes('network.route'));
  assert.deepEqual(lintIds(network, { ...p, exact_payload: action('Hi Avery,\n\nUp for a call?\n\nKrish') }, ctxWith({ network: [{ ...tie(120), email_outbound: 3 }], routes: { [id(1)]: { email: 'verified' } } })), []);
});

const show = (over = {}) => ({ id: id(400), title: 'The Example Show', type: 'podcast', status: 'queued', ...STAGE.take, organizer: 'Avery Example', booking_contact_id: id(500), latest_episode_at: '2026-10-20T00:00:00Z', episodes: 40, ...over });
const pitch = (body, over = {}) => ({ proposal_id: 'gmp-1', row: 'visibility', subject_ref: `target:${id(400)}`, close_condition: { event: 'outreach_sent', reference: 'visibility:pitch' }, exact_payload: action(body, { mailbox: 'jonny' }), ...over });
const GOOD = 'Hi Avery,\n\nI work with Krish Raja, and I think he\'d make a strong guest for The Example Show.\n\nHe\'s Executive Host of Signal & Noise and writes it (https://publication.example).\n\nWould you have him on?\n\nJonny';

test('the Visibility Producer re-runs the pitch holds and checks the title, the show, one link and one ask', () => {
  assert.deepEqual(lintIds(visibility, pitch(GOOD), ctxWith({ records: { visibility: [show()], drafts: [], guests: [] } })), []);
  const own = lintIds(visibility, pitch(GOOD), ctxWith({ records: { visibility: [show({ title: 'Make Your Mind Up' })], drafts: [], guests: [] } }));
  assert.ok(own.includes('visibility.not_own_show') && own.includes('visibility.show_named'));
  const quiet = lintIds(visibility, pitch(GOOD.replace('Executive Host of Signal & Noise', 'a host').replace('(https://publication.example)', 'https://a.example https://b.example')), ctxWith({ records: { visibility: [show({ latest_episode_at: '2026-01-01T00:00:00Z' })], drafts: [], guests: [] } }));
  for (const l of ['visibility.recent_episode', 'visibility.ruled_title', 'visibility.one_link']) assert.ok(quiet.includes(l), l);
  // The show-notes note only after Control Center records the booking on one of Jonny's pitches.
  const note = pitch(GOOD, { exact_payload: action('Hi', { mailbox: 'jonny', kind: 'show_notes_ask' }) });
  assert.ok(lintIds(visibility, note, ctxWith({ records: { visibility: [show()], drafts: [], guests: [] } })).includes('visibility.show_notes_after_booking'));
  assert.deepEqual(lintIds(visibility, note, ctxWith({ records: { visibility: [show()], drafts: [{ visibility_target_id: id(400), job: 'booked', mailbox: 'jonny', booked_at: '2026-10-20T00:00:00Z' }], guests: [] } })), []);
});

test('the Stages Producer holds a closed call, a room without his buyer, and two talks', () => {
  const stage = over => ({ id: id(600), title: 'The Example Summit', type: 'conference', status: 'queued', ...STAGE.take, organizer: 'Example Events Ltd', booking_contact_id: id(700), deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-03-10T00:00:00Z', audience: 'Marketing leaders at mid-size companies', ...over });
  const p = (subject, body) => ({ proposal_id: 'gmp-2', row: 'events', subject_ref: `target:${id(600)}`, close_condition: { reference: 'events:pitch' }, exact_payload: action(body, { subject, mailbox: 'jonny' }) });
  const ok = p('A speaker for The Example Summit: AI for marketing leaders', 'Hi,\n\nI\'d like to put him forward for a talk: "AI for marketing leaders".\n\nWould you consider him?\n\nJonny');
  assert.deepEqual(lintIds(stages, ok, ctxWith({ records: { visibility: [stage()], drafts: [], guests: [] } })), []);
  const bad = lintIds(stages, p('A speaker for The Example Summit', 'Hi'), ctxWith({ records: { visibility: [stage({ deadline_at: '2026-10-01T00:00:00Z', audience: 'Gardeners' })], drafts: [], guests: [] } }));
  for (const l of ['stages.open_before_deadline', 'stages.buyer_in_room', 'stages.one_talk_title']) assert.ok(bad.includes(l), l);
});

test('the Signal Scout holds a comment that is not a worried executive, or one not quoted as written', () => {
  const url = 'https://www.linkedin.com/feed/update/urn:li:activity:1234567890';
  const research = person => [{ kind: 'post_engagers', status: 'answered', answered_at: '2026-10-25T00:00:00Z', evidence: [{ url, snippet: 'I am worried what this means for my team.', person }] }];
  const p = body => ({ proposal_id: 'gmw-3', row: 'reach_out', subject_ref: `contact:${id(9)}`, close_condition: { reference: 'reach_out:signal' }, evidence: [{ url }], exact_payload: action(body) });
  const ctx = person => crewContext({ context: { research: research(person), feedback: [], routes: {} }, at: AT });
  const exec = { contact_id: id(9), name: 'Avery Example', headline: 'Chief Executive Officer at Example Retail' };
  assert.deepEqual(lintIds(signals, p('Saw your comment: "I am worried what this means for my team."'), ctx(exec)), []);
  assert.ok(lintIds(signals, p('Saw your comment: "I am worried."'), ctx(exec)).includes('signals.quoted_exactly'));
  assert.ok(lintIds(signals, p('Saw your comment: "I am worried what this means for my team."'), ctx({ ...exec, headline: 'Founder, AI agents for sales' })).includes('signals.icp'));
});

test('the Trust-Asset Steward holds a wrong name, a price, a dash and Krish\'s own address; an asset record needs its kit, read-back and facts', () => {
  const post = text => ({ proposal_id: 'gwp-1', wall: 'post', exact_payload: text });
  assert.deepEqual(lintIds(trust, post('Mindmake helps a leader decide what AI should do for them. https://mindmake.co/?start=1')), []);
  const bad = lintIds(trust, post('MindMake from $500 a day \u2014 email krish@example.org'));
  for (const l of ['trust.name_exact', 'trust.never_published', 'trust.no_duration_emoji_dash', 'trust.contact_box']) assert.ok(bad.includes(l), l);
  const asset = { kit: 'Mindmaker', text: 'Mindmake', approved_text: 'a', readback_text: 'b', facts: [{ sha: 'x' }], pages: 2, contact: 'krish' };
  const held = lintIds(trust, { proposal_id: 'one-sheet', asset });
  for (const l of ['trust.mindmake_kit', 'trust.readback_equals_approved', 'trust.facts_by_sha', 'trust.one_page', 'trust.contact_box']) assert.ok(held.includes(l), l);
  assert.deepEqual(lintIds(trust, { proposal_id: 'one-sheet', asset: { kit: 'Mindmake', text: 'Mindmake', approved_text: 'a', readback_text: 'a', facts: [{ sha: 'a'.repeat(40) }], pages: 1, contact: 'jonny' } }), []);
});

test('the Measurement Specialist holds a tag off a public placement, a key off the list, and a link that is not the canon', () => {
  const ctx = ctxWith({});
  const note = body => ({ proposal_id: 'gmp-9', exact_payload: action(body, { kind: 'show_notes_ask' }) });
  assert.deepEqual(lintIds(measurement, note('https://mindmake.co/?start=1&utm_source=growth-podcast&utm_medium=referral'), ctx), []);
  assert.ok(lintIds(measurement, { proposal_id: 'gmw-1', exact_payload: action('https://mindmake.co/?start=1&utm_source=growth-podcast&utm_medium=referral') }, ctx).includes('measurement.tag_placement'));
  assert.ok(lintIds(measurement, note('https://mindmake.co/?start=1&utm_source=growth-podcast&utm_medium=referral&utm_campaign=x'), ctx).includes('measurement.tag_keys'));
  assert.ok(lintIds(measurement, { proposal_id: 'gmw-1', exact_payload: action('https://mindmake.co/pricing') }, ctx).includes('measurement.link_canon'));
  assert.deepEqual(measurement.lintReport({ objectives: [{ key: 'good_meetings', value: 0, availability: 'missing' }], activity: ['mindmake.co traffic: unknown.'] }).map(f => f.lint), ['measurement.null_not_zero', 'measurement.traffic_consent']);
});

test('the Guard holds an amount, an unwalled outward action, a do-not-contact person and a breached constraint', () => {
  const ctx = ctxWith({ network: [{ contact_id: id(5), contacts: { status: 'do_not_contact' } }] });
  const found = lintIds(guard, { proposal_id: 'x', amount_usd: 10, wall: 'none', channel: 'email', subject_ref: `contact:${id(5)}` }, ctx);
  for (const l of ['guard.spend_zero', 'guard.unwalled_action', 'guard.do_not_contact']) assert.ok(found.includes(l), l);
  assert.deepEqual(guard.lintRun({ proposals: [{ wall: 'send' }, { wall: 'send' }], constraints: { max_actions: 1, spend_cap_usd: null } }).map(f => f.lint), ['guard.constraints']);
  assert.deepEqual(guard.lintRun({ proposals: [], printed: '{"status":"succeeded"}' }), []);
});

// ── The crew in shadow ─────────────────────────────────────────────────────

test('crew/index.json names every module the shadow runs, and every module its specialist', () => {
  assert.deepEqual(index.specialists.map(s => s.slug), LINT_MODULES.map(m => m.SPECIALIST));
  assert.deepEqual(index.specialists.map(s => s.slug), CHECK_MODULES.map(m => m.SPECIALIST));
  for (const [i, s] of index.specialists.entries()) { assert.deepEqual(s.lints, LINT_MODULES[i].LINTS, s.slug); assert.deepEqual(s.checks, CHECK_MODULES[i].CHECKS, s.slug); }
});

test('the crew holds nothing in shadow: it changes no proposal, and says so in two counted lines', () => {
  const proposals = [{ proposal_id: 'x', amount_usd: 5, wall: 'none', channel: 'email', exact_payload: action('Hi? Again?') }];
  const before = structuredClone(proposals);
  const { findings, measurements, lines } = crewShadow({ proposals, at: AT });
  assert.deepEqual(proposals, before, 'no proposal is changed, dropped or held');
  assert.ok(findings.length >= 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every(l => CREW_LINE.test(l)));
  assert.match(lines[0], /^Crew lints, in shadow: read 1 proposal; \d+ findings \(.*guard\.spend_zero 1.*\)\. Nothing is held by them until the switch/);
  // A measurement nobody could make is null with its reason, never zero.
  for (const m of measurements.filter(x => x.value === null)) assert.ok(m.reason && m.reason.length > 10, m.check);
  assert.match(lines[1], /not measured yet, none of them read as zero\.$/);
});

test('the dispatch reports the crew lines and keeps every proposal and hold it had without them', async () => {
  const { result, report } = await capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy });
  assert.equal(result.status, 'succeeded');
  const crew = report.activity.filter(a => CREW_LINE.test(a.line));
  assert.equal(crew.length, 2);
  assert.match(crew[0].line, /^Crew lints, in shadow: read 22 proposals;/);
  // The printed result names no finding and no measurement: counts reach Control Center only.
  assert.doesNotMatch(JSON.stringify(result), /Crew|card_grammar|multiplier\./);
});
