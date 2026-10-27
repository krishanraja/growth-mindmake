import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tagged, untagged, readWeb, trafficLines, bookedHosts, CONSENT, TAG_PATHS } from '../src/stages/traffic.mjs';
import { runDispatch, readDirective } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { golden } from './support/golden.mjs';

// Synthetic shapes only: no real site figures, no measurement id.
const BRIEF = 'https://mindmake.co/?start=1';
const day = n => `2026-10-${String(n).padStart(2, '0')}`;
const row = (d, value, sessions, key_events = 0, dim_type = 'source_medium') => ({ date: day(d), dim_type, value, sessions, users: sessions, key_events });
const block = (rows, over = {}) => ({ property: 'site', measurement_id: 'G-SYNTHETIC0', through: day(27), days: 28, events: null, rows, coverage: { complete: true, reason: null, dates: null }, consent_gated: true, ...over });

test('a tagged link is the canon URL byte for byte plus exactly the two keys, and strips back to it', () => {
  const t = tagged(BRIEF, 'podcast');
  assert.equal(t, 'https://mindmake.co/?start=1&utm_source=growth-podcast&utm_medium=referral');
  assert.equal(untagged(t), BRIEF);
  assert.equal(tagged('https://mindmake.co/media/one-sheet.pdf', 'one-sheet'), 'https://mindmake.co/media/one-sheet.pdf?utm_source=growth-one-sheet&utm_medium=referral');
  for (const p of TAG_PATHS) assert.equal(untagged(tagged(BRIEF, p)), BRIEF, p);
  assert.equal(tagged(BRIEF, 'jane-smith'), null, 'no tag names a person, a show or a proposal');
  assert.equal(tagged('https://makeyourmindup.ai/', 'podcast'), null, 'never another domain');
  assert.equal(tagged('http://mindmake.co/?start=1', 'podcast'), null);
  assert.equal(tagged(t, 'podcast'), null, 'never tagged twice');
  assert.equal(untagged(BRIEF), BRIEF, 'an untagged link is left as it is');
});

test('his notes, pitches, row words and citations carry no tag', async () => {
  for (const f of ['rows.mjs', 'signals.mjs', 'pitches.mjs', 'canon.mjs', 'meetings.mjs']) {
    const src = await readFile(new URL(`../src/stages/${f}`, import.meta.url), 'utf8');
    assert.equal(/utm_|tagged\(/.test(src), false, f);
  }
});

test('the block is read without its measurement id, and an absent block is not served', () => {
  const w = readWeb(block([row(27, 'google / organic', 3)]));
  assert.equal(JSON.stringify(w).includes('G-'), false);
  assert.equal(w.consent_gated, true);
  assert.equal(readWeb(undefined), null);
  assert.equal(readWeb({ rows: [] }), null, 'no coverage, not served');
});

test('exact lines: the whole site week on week, then what the engine sent by path and from booked shows', () => {
  const rows = [
    // this week: 21 to 27 October
    row(27, 'google / organic', 10, 1), row(26, 'growth-podcast / referral', 4, 1), row(25, 'growth-one-sheet / referral', 2),
    row(24, 'showsite.example / referral', 3), row(24, 'other.example / referral', 1), row(23, '(direct) / (none)', 5),
    row(23, '/', 99, 0, 'landing_page'),
    // the week before: 14 to 20 October
    row(20, 'google / organic', 10), row(15, '(direct) / (none)', 10, 2)
  ];
  const lines = trafficLines({ web: readWeb(block(rows)), hosts: new Set(['showsite.example']) });
  assert.deepEqual(lines, [
    `mindmake.co, the 7 days to 2026-10-27 against the 7 before: 25 sessions (up 25%), 2 key events (no change), with rows on 5 and 2 of 7 days. ${CONSENT}`,
    `What the engine's placements sent mindmake.co in those 7 days: 9 sessions, 36% of the site's (4 growth-podcast, 2 growth-one-sheet, 3 from shows and stages he was booked on). A supporting reading only: it ranks levers, never counts as a meeting. ${CONSENT}`
  ]);
});

test('unserved, uncaptured or partly read is said, never a zero, and every line carries the consent sentence', () => {
  const unserved = trafficLines({ web: null });
  assert.equal(unserved.length, 1);
  assert.match(unserved[0], /not served yet/);
  const none = trafficLines({ web: readWeb(block([], { through: null, coverage: { complete: false, reason: 'Nothing has been captured for this site yet, so nothing is known.', dates: null } })) });
  assert.deepEqual(none, [`mindmake.co traffic: unknown. Nothing has been captured for this site yet, so nothing is known. ${CONSENT}`]);
  const partial = trafficLines({ web: readWeb(block([row(27, 'google / organic', 1)], { coverage: { complete: false, reason: 'Source rows on 1 of 28 days.', dates: null } })) });
  assert.match(partial[0], /Not every day was read, so a day with no rows is unknown\./);
  for (const l of [...unserved, ...none, ...partial]) assert.ok(l.endsWith(CONSENT), l);
});

test('referral visits match only the shows and stages he was booked on', () => {
  const context = { records: {
    visibility: [{ id: 'T1', event_url: 'https://www.showsite.example/episodes', feed_url: 'https://feeds.showsite.example/rss' }, { id: 't2', event_url: 'https://notbooked.example/' }, { id: 't3', event_url: 'https://mindmake.co/x' }],
    drafts: [{ visibility_target_id: 't1', booked_at: '2026-10-20T10:00:00Z' }, { visibility_target_id: 't2', booked_at: null }, { visibility_target_id: 't3', booked_at: '2026-10-20T10:00:00Z' }]
  } };
  assert.deepEqual([...bookedHosts(context)].sort(), ['feeds.showsite.example', 'showsite.example']);
});

test('the dispatch reports the traffic lines to Control Center, never as an objective, and prints no figure', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const web_analytics = block([row(27, 'google / organic', 4321), row(20, 'google / organic', 1234)]);
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directiveFixture({ schema_version: '1.10.0', web_analytics }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: {} }), decisions: async () => [],
    readReport: async () => { const r = reports.at(-1); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, report: r }; }, postReport: async r => { reports.push(golden(r)); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
    context: async () => { throw new Error('not served'); }, outcomes: async () => { throw new Error('not served'); },
    prepareAction: async () => { throw new Error('no route'); }, actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); }, executeAction: async () => { throw new Error('none'); }
  };
  const result = await runDispatch({ cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode: 'synthetic', attemptId: 'gma-synthetic-traffic01', clock: () => '2026-10-28T06:00:00Z' });
  assert.equal(result.status, 'succeeded');
  const rep = reports[0];
  assert.ok(rep.activity.some(a => a.line.startsWith('mindmake.co, the 7 days to 2026-10-27 against the 7 before: 4321 sessions')));
  assert.equal(rep.objectives.some(o => /traffic|session|visit|web/.test(o.key)), false, 'traffic never steers the work');
  const printed = JSON.stringify(result);
  assert.equal(printed.includes('4321') || printed.includes('1234') || printed.includes('G-SYNTHETIC0'), false, 'no traffic figure and no measurement id in the printed result');
  assert.equal(readDirective(directiveFixture({ web_analytics })).web.rows.length, 2);
});
