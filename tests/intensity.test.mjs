import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gapOf, gapLine, intensify, intensityPolicy, VOLUME_KEYS, RAISE_FROM, GAP_LINE, RAISE_ON } from '../src/stages/intensity.mjs';
import { todaysCaps } from '../src/crew/compile.mjs';
import { runDispatch, laneCounts } from '../src/dispatch.mjs';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { capsReport, capsContext } from './support/caps-scenario.mjs';
import { readLanesLine } from '../src/stages/momentum.mjs';

// Intensity (C3). Ruling (Krish, 2026-10-29): "At U3 to U5, engines and Control
// Center may raise volume caps up to each repo's existing policy bounds without a
// signed week spec. This is volume only: walls unchanged."
const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
const today = todaysCaps(policy);

test('the gap line says X of Y, U-n, short by Z, and unknown stays unknown', () => {
  assert.equal(gapLine(gapOf({ northStar: { urgency: 4, current: 1 }, thisTarget: 5 })), 'Gap: good meetings 1 of 5 this week, U4, short by 4.');
  assert.equal(gapLine(gapOf({ northStar: { urgency: 4, current: null }, thisTarget: 2 }), 'not measured yet'), 'Gap: good meetings unknown of 2 this week, U4, short by unknown (not measured yet).');
  assert.equal(gapLine(gapOf({ northStar: {}, thisTarget: null })), 'Gap: good meetings unknown of unknown this week, urgency unknown, short by unknown.');
  // His taps this week are fresher than Control Center's reading; ahead of target is short by 0, never negative.
  assert.deepEqual(gapOf({ northStar: { urgency: 2, current: 1 }, thisTarget: 5, tapsThisWeek: 7 }), { current: 7, target: 5, urgency: 2, short: 0 });
  assert.equal(gapOf({ northStar: { urgency: 9 }, thisTarget: 5 }).urgency, null, 'an urgency out of range is unknown, never guessed');
});

test('the policy names only volume caps, each bound and safer down, with no authority', () => {
  const rule = intensityPolicy(policy);
  assert.deepEqual(rule, { raise_from: RAISE_FROM, raises: [...VOLUME_KEYS] });
  for (const k of rule.raises) assert.equal(policy.bounds[k].direction, 'down_is_safer');
  assert.equal(intensityPolicy({ ...policy, intensity: { ...policy.intensity, raises: ['fit_floor'] } }), null, 'the fit floor is not volume');
  assert.equal(intensityPolicy({ ...policy, intensity: { ...policy.intensity, raises: ['pitches.per_run', 'rows.max'] } }), null, "Jonny's ten a run never rises");
  assert.equal(intensityPolicy({ ...policy, intensity: { ...policy.intensity, raise_from: 2 } }), null, 'nothing rises under U3');
  assert.equal(intensityPolicy({ ...policy, spend_authority: 'some' }), null);
  assert.equal(intensityPolicy({ ...policy, intensity: undefined }), null);
});

test('at U3 and above on unsigned caps, volume rises to the bounds and nothing else moves', () => {
  for (const urgency of [3, 4, 5]) {
    const { caps, raised, line } = intensify(today, { urgency, source: 'today', policy });
    for (const l of Object.keys(caps.rows)) assert.equal(caps.rows[l].max, policy.bounds['rows.max'].max);
    assert.equal(caps.pitches.invites_per_run, policy.bounds['pitches.invites_per_run'].max);
    assert.equal(caps.pitches.invites_per_week, policy.bounds['pitches.invites_per_week'].max);
    assert.equal(caps.pitches.forms_per_row, policy.bounds['pitches.forms_per_row'].max);
    for (const same of ['per_run', 'stage_share', 'jonny_per_day']) assert.equal(caps.pitches[same], today.pitches[same]);
    assert.deepEqual(caps.pitches.show_shares, today.pitches.show_shares);
    assert.equal(caps.fit_floor, today.fit_floor);
    assert.equal(caps.spend_usd, 0);
    assert.equal(raised.length, 8);
    assert.match(line, new RegExp(`^Intensity: U${urgency}, so volume rises`));
    assert.match(line, /walls/);
  }
  assert.equal(today.rows.network.max, 6, 'today is untouched');
});

test('under U3, with urgency unknown, or under a spec he signed, the caps stand', () => {
  for (const [urgency, source] of [[1, 'today'], [2, 'default'], [null, 'today'], [4, 'signed'], [5, 'last_signed']]) {
    const r = intensify(today, { urgency, source, policy });
    assert.equal(r.caps, today);
    assert.equal(r.raised.length, 0);
  }
  // A lane he turned off stays off, and a cap already at its bound is not "raised".
  const off = structuredClone(today); off.rows.events.on = false; off.pitches.forms_per_row = 4;
  const r = intensify(off, { urgency: 4, source: 'default', policy });
  assert.equal(r.caps.rows.events.max, 6);
  assert.ok(!r.raised.some(x => x.startsWith('rows.events') || x.startsWith('pitches.forms_per_row')));
  // A run's invites never pass its Jonny drafts.
  const small = structuredClone(today); small.pitches.per_run = 3;
  assert.equal(intensify(small, { urgency: 4, source: 'today', policy }).caps.pitches.invites_per_run, 3);
});

test('a dispatch at U4 leads with the gap and invites to the bound; at U1 it invites as before', async () => {
  const run = directive => capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy, directive });
  const invites = r => r.proposals.filter(p => p.close_condition?.reference === 'visibility:invite').length;
  const u4 = await run({ north_star: { own: { week_target: 2, current: null, urgency: 4, urgency_reason: 'not measured yet' }, intensity: { urgency: 4 } } });
  assert.equal(u4.result.status, 'succeeded');
  assert.match(u4.report.activity[0].line, GAP_LINE);
  assert.equal(u4.report.activity[0].line, 'Gap: good meetings unknown of 2 this week, U4, short by unknown (not measured yet).');
  assert.ok(u4.report.activity.some(a => /^Intensity: U4, so volume rises/.test(a.line)));
  const u1 = await run({ north_star: { own: { week_target: 2, current: 2, urgency: 1 } } });
  assert.equal(u1.report.activity[0].line, 'Gap: good meetings 2 of 2 this week, U1, short by 0.');
  assert.equal(invites(u1.report), 2);
  assert.ok(invites(u4.report) > invites(u1.report), 'urgency raises the guest invites a run');
  assert.ok(invites(u4.report) <= policy.bounds['pitches.invites_per_run'].max);
  // Volume only: every walled proposal in either report still waits on his decision.
  for (const r of [u1.report, u4.report]) assert.ok(r.proposals.every(p => p.wall !== 'none' || p.kind === 'advice'));
});

test('volume rises only when it is known that no spec he signed is in force, and never on a policy the week spec would refuse', () => {
  assert.deepEqual([...RAISE_ON], ['default', 'today']);
  for (const [source, why] of [['unread', /could not be read/], ['unsure', /could not be used/], ['stopped', /stopped the week spec/], ['unsafe', /cannot bound a week spec/], ['signed', /he signed/], ['last_signed', /he signed/], [undefined, /unknown/]]) {
    const r = intensify(today, { urgency: 5, source, policy });
    assert.equal(r.caps, today, `${source}: the caps stand`);
    assert.equal(r.raised.length, 0);
    assert.match(r.line, why);
  }
  // policy_unsafe (here Jonny's daily limit is missing): the stages' own settings stand, and nothing rises from that policy either.
  const unsafe = { ...policy, limits: { ...policy.limits, jonny_drafts_per_day: undefined } };
  assert.equal(intensityPolicy(unsafe), null);
  assert.equal(intensify(today, { urgency: 5, source: 'default', policy: unsafe }).raised.length, 0);
});

test('at U4 with a crowd, wider rows never push out a pitch, an invite or a form, and the Lanes line counts what was posted', async () => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const person = (n, title) => ({ contact_id: id(n), network_tier: '2_core_network', current_title: title, followers: 20000 + n, plays: [], roles: [], mindmake_fit: 80, sells_competing_services: false, hook: 'Took two media software companies through a sale.', contacts: { id: id(n), full_name: `Avery Example${n}`, title, company: `Company ${n}`, company_domain: `c${n}.test`, status: 'active' } });
  const titles = ['Host of Example Show', 'Chapter Chair, Example Leaders Forum', 'General Partner, Example Ventures', 'Head of Learning and Development, Example Academy', 'Community Lead, Example Founders Club', 'Podcast Host', 'Managing Partner, Example Capital', 'Professor of Management, Example Business School', 'Director, Example Leadership Institute'];
  const crowd = () => {
    const c = capsContext(); let n = 1000;
    for (const t of titles) for (let i = 0; i < 12; i++) { const p = person(n++, `${t} ${i}`); c.amplifier_candidates.push(p); c.routes[p.contact_id] = { email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false }; }
    return c;
  };
  const run = urgency => capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy, context: crowd, directive: { north_star: { own: { week_target: 2, current: 0, urgency }, intensity: { urgency } } } });
  const jonny = r => { const l = laneCounts(r.report.proposals); return l.invites + l.podcasts + l.stages; };
  const u1 = await run(1), u4 = await run(4);
  assert.ok(u4.report.holds.some(h => h.reason === 'row_cap'), 'the crowd overflows the report');
  assert.ok(u4.report.proposals.length <= 40);
  assert.ok(jonny(u4) >= jonny(u1), "urgency never lowers Jonny's pitches and invites");
  assert.equal(jonny(u4), policy.limits.jonny_drafts_per_day, "Jonny's ten are all posted");
  assert.ok(u4.report.proposals.filter(p => p.channel === 'form').length >= u1.report.proposals.filter(p => p.channel === 'form').length);
  for (const r of [u1, u4]) {
    const posted = laneCounts(r.report.proposals);
    const line = readLanesLine(r.report.activity.find(a => /^Lanes: /.test(a.line)).line);
    for (const [k, n] of Object.entries(posted)) if (n > 0) assert.equal(line.lanes[k], n, `${k} as posted`);
  }
});
