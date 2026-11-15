import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readTracking, trackingAudit, trackingCounts, trackingLine, CHECKS, STATES, UNTRACED_LINE } from '../src/stages/tracking.mjs';
import { runDispatch, readDirective } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { golden } from './support/golden.mjs';

// Synthetic shapes only: no real site figures, no real measurement id.
const day = n => `2026-10-${String(n).padStart(2, '0')}`;
const DAYS = Array.from({ length: 28 }, (_, i) => day(i + 1));
const row = (d, value, sessions, key_events = 0) => ({ date: day(d), dim_type: 'source_medium', value, sessions, users: sessions, key_events });
const health = (verdict = 'ok', flags = ['consent_gated'], over = {}) => ({ as_of: day(28), verdict, flags, line: `Site G-SYNTHETIC0 reads ${verdict}.`, ...over });
const block = (over = {}) => ({
  property: 'site', measurement_id: 'G-SYNTHETIC0', through: day(28), days: 28, events: null,
  rows: [row(28, 'google / organic', 10, 1), row(27, 'growth-podcast / referral', 4, 1), row(26, '(direct) / (none)', 6)],
  coverage: { complete: true, reason: null, dates: { source_medium: DAYS, landing_page: DAYS, utm_content: [] } },
  consent_gated: true,
  daily: DAYS.map(date => ({ date, sessions: 1, users: 1, pageviews: 2, key_events: 0 })),
  health: health(),
  ...over
});
const TODAY = day(29);
const audit = (over = {}, hosts = new Set(['showsite.example'])) => trackingAudit({ tracking: readTracking(block(over)), today: TODAY, hosts });
const state = (findings, id) => findings.find(f => f.id === id)?.state;

test('a tagged, read and current site passes every check, and the line says so with counts', () => {
  const f = audit();
  assert.deepEqual(f.map(x => x.id), CHECKS, 'every check runs once, in a fixed order');
  assert.deepEqual(trackingCounts(f), { fail: 0, watch: 0, unknown: 0, pass: 8 });
  assert.equal(trackingLine(f), 'Tracking check on mindmake.co: 0 fail, 0 to watch, 0 unknown, 8 pass.');
});

test('unserved is one unknown, never a pass and never a zero', () => {
  const f = trackingAudit({ tracking: readTracking(undefined), today: TODAY, hosts: new Set() });
  assert.equal(f.length, 1);
  assert.equal(f[0].state, 'unknown');
  assert.match(trackingLine(f), /0 fail, 0 to watch, 1 unknown, 0 pass\. Unknown, not passed: served\./);
  assert.equal(readTracking({ rows: [] }), null, 'no coverage, not served');
});

test('a broken tag fails with who fixes it; a flag is watched; consent alone is expected', () => {
  for (const [verdict, owner] of [['tag_missing', /mindmake repository/], ['wrong_stream', /mindmake repository/], ['never_received', /mindmake repository/], ['no_access', /Krish's yes/], ['api_disabled', /Krish's yes/]]) {
    const f = audit({ health: health(verdict) });
    const h = f.find(x => x.id === 'tracking.health');
    assert.equal(h.state, 'fail', verdict);
    assert.match(h.fix, owner, verdict);
  }
  for (const verdict of ['provisional', 'quiet']) assert.equal(state(audit({ health: health(verdict) }), 'tracking.health'), 'watch', verdict);
  const flagged = audit({ health: health('ok', ['consent_gated', 'undercounting', 'host_filter_off', 'not_a_flag']) }).find(x => x.id === 'tracking.flags');
  assert.equal(flagged.state, 'watch');
  assert.match(flagged.evidence, /undercounting/);
  assert.match(flagged.evidence, /host_filter_off/);
  assert.equal(/not_a_flag|consent_gated:/.test(flagged.evidence), false, 'unknown flags are dropped, and consent is not a gap');
  assert.equal(state(audit({ health: null }), 'tracking.health'), 'unknown');
  assert.equal(state(audit({ health: { verdict: 'made_up', flags: [], line: '', as_of: day(28) } }), 'tracking.health'), 'unknown', 'a verdict off the list is not read');
  assert.match(audit({ health: health('ok', ['consent_gated'], { as_of: day(20) }) }).find(x => x.id === 'tracking.health').evidence, /9 days old/);
});

test('a stale read and missing days are watched, and a missing day is unknown, not zero', () => {
  assert.equal(state(audit({ through: day(25) }), 'tracking.fresh'), 'watch');
  assert.equal(state(audit({ through: day(27) }), 'tracking.fresh'), 'pass');
  assert.equal(state(audit({ through: null, coverage: { complete: false, reason: 'Nothing captured.', dates: null } }), 'tracking.fresh'), 'unknown');
  const partial = audit({ coverage: { complete: false, reason: 'Source rows on 20 of 28 days.', dates: { source_medium: DAYS.slice(8), landing_page: DAYS, utm_content: [] } } }).find(x => x.id === 'tracking.days_read');
  assert.equal(partial.state, 'watch');
  assert.equal(partial.evidence, 'Source rows on 20 of 28 days; the other 8 are unknown, not zero.');
  assert.equal(state(audit({ coverage: { complete: false, reason: null, dates: null } }), 'tracking.days_read'), 'unknown');
});

test('key events: none across real sessions is watched, the daily totals stand in, and nothing served is unknown', () => {
  const none = audit({ rows: [row(28, 'google / organic', 30, 0)] }).find(x => x.id === 'tracking.key_event');
  assert.equal(none.state, 'watch');
  assert.match(none.evidence, /^0 key events across 30 sessions in the source rows of 28 days: either nobody finished the brief, or no key event is set\./);
  assert.match(none.fix, /brief_submit/);
  assert.match(none.evidence, /cannot be read here/, 'which event fires is unknown for mindmake.co');
  const daily = audit({ rows: [], daily: [{ date: day(28), sessions: 5, users: 5, pageviews: 9, key_events: 2 }] }).find(x => x.id === 'tracking.key_event');
  assert.equal(daily.state, 'pass');
  assert.match(daily.evidence, /^2 key events across 5 sessions in the daily totals/);
  assert.equal(state(audit({ rows: [], daily: [] }), 'tracking.key_event'), 'unknown');
  assert.equal(state(audit({ rows: null, daily: null }), 'tracking.key_event'), 'unknown');
  assert.equal(state(audit({ rows: [], daily: [{ date: day(28), sessions: null, users: null, pageviews: null, key_events: null }] }), 'tracking.key_event'), 'unknown', 'a null figure is unknown, never zero');
});

test('untraced visits above the engine\'s own line are watched, with the reason that part of it is by rule', () => {
  const over = audit({ rows: [row(28, '(direct) / (none)', 6), row(28, 'google / (not set)', 1), row(27, 'google / organic', 3, 1)] }).find(x => x.id === 'tracking.untraced');
  assert.equal(over.state, 'watch');
  assert.match(over.evidence, /^7 of 10 sessions \(70%\) have no traceable source, above the engine's own line of 50%\./);
  assert.match(over.evidence, /one-to-one notes carry no tag/);
  assert.equal(UNTRACED_LINE, 0.5);
  assert.equal(state(audit(), 'tracking.untraced'), 'pass');
  assert.equal(state(audit({ rows: [] }), 'tracking.untraced'), 'unknown');
});

test('placements: booked and silent is watched, untagged is watched, tagged passes, an unread context is unknown', () => {
  const silent = audit({ rows: [row(28, 'google / organic', 3, 1)] }).find(x => x.id === 'tracking.placements');
  assert.equal(silent.state, 'watch');
  assert.match(silent.evidence, /^Booked on 1 show or stage; none sent a visit/);
  const bare = audit({ rows: [row(28, 'www.showsite.example / referral', 2), row(28, 'google / organic', 3, 1)] }, new Set(['showsite.example'])).find(x => x.id === 'tracking.placements');
  assert.equal(bare.state, 'watch');
  assert.match(bare.evidence, /^2 sessions came from the sites of shows or stages he was booked on, none with the growth tag/);
  assert.equal(state(audit(), 'tracking.placements'), 'pass');
  assert.equal(state(audit({}, null), 'tracking.placements'), 'unknown');
  assert.equal(state(audit({}, new Set()), 'tracking.placements'), 'pass', 'nothing booked, nothing due');
});

test('the measurement id never survives, even inside Control Center\'s own line', () => {
  const t = readTracking(block({ coverage: { complete: false, reason: 'Stream G-SYNTHETIC0 behind.', dates: { source_medium: DAYS, landing_page: DAYS, utm_content: [] } } }));
  assert.equal(JSON.stringify(t).includes('G-SYNTHETIC0'), false);
  const f = audit({ health: health('tag_missing', ['consent_gated', 'undercounting']) });
  assert.equal(JSON.stringify(f).includes('G-SYNTHETIC0') || trackingLine(f).includes('G-'), false);
});

test('the line keeps every count within 500 characters, naming fewer fixes before dropping any count', () => {
  const f = audit({ health: health('tag_missing', ['undercounting', 'host_filter_off', 'thresholded', 'admin_unverified', 'read_failed']), through: day(20), rows: [row(28, '(direct) / (none)', 9)], coverage: { complete: false, reason: null, dates: { source_medium: DAYS.slice(10), landing_page: DAYS, utm_content: [] } } });
  const line = trackingLine(f);
  assert.ok(line.length <= 500, `${line.length}`);
  assert.match(line, /^Tracking check on mindmake\.co: 1 fail, 6 to watch, 0 unknown, 1 pass\./);
  assert.match(line, /Fail health: restore the tag on mindmake\.co/);
  assert.match(line, /left out to fit the line/);
  assert.deepEqual(STATES, ['fail', 'watch', 'unknown', 'pass']);
});

test('the same block gives the same findings: deterministic and pure', () => {
  const a = JSON.stringify(audit()), b = JSON.stringify(audit());
  assert.equal(a, b);
});

test('the dispatch reports the tracking line to Control Center, never as an objective, and prints no figure', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const reports = [];
  const web_analytics = block({ rows: [row(28, '(direct) / (none)', 4321)], health: health('tag_missing') });
  const cc = {
    recordAttempt: async () => ({ ok: true }), directive: async () => directiveFixture({ schema_version: '1.13.0', web_analytics }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: {} }), decisions: async () => [],
    readReport: async () => { const r = reports.at(-1); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, report: r }; }, postReport: async r => { reports.push(golden(r)); return { accepted: true, run_id: r.run_id, payload_sha256: r.payload_sha256, replayed: false }; },
    context: async () => { throw new Error('not served'); }, outcomes: async () => { throw new Error('not served'); },
    prepareAction: async () => { throw new Error('no route'); }, actionReceipt: async () => { throw Object.assign(new Error('none'), { status: 404 }); }, executeAction: async () => { throw new Error('none'); }
  };
  const result = await runDispatch({ cc, source: async () => ({ hold: { reason: 'source_credential_unavailable', detail: 'none' } }), policy, registry: {}, mode: 'synthetic', attemptId: 'gma-synthetic-track001', clock: () => '2026-10-29T06:00:00Z' });
  assert.equal(result.status, 'succeeded');
  const line = reports[0].activity.find(a => a.line.startsWith('Tracking check on mindmake.co:'))?.line;
  assert.ok(line, 'the tracking line is reported');
  assert.match(line, /1 fail/);
  assert.match(line, /Unknown, not passed: placements\./, 'no context read, so placements are unknown');
  assert.equal(reports[0].objectives.some(o => /track|traffic|session|visit|web/.test(o.key)), false, 'tracking never steers the work');
  const printed = JSON.stringify(result);
  assert.equal(printed.includes('4321') || printed.includes('G-SYNTHETIC0'), false, 'no figure and no measurement id in the printed result');
  assert.equal(JSON.stringify(reports[0]).includes('G-SYNTHETIC0'), false, 'nor in the report');
  assert.equal(readDirective(directiveFixture({ web_analytics })).tracking.health.verdict, 'tag_missing');
});
