import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { fromJson, fromCsv, readExport, parseCsv, isExportError, LIMITS, CSV_COLUMNS } from '../src/ads/ingest.mjs';
import { auditAccounts, auditAccount, crossPlatform, renderMarkdown, wasteAtStake, totals, CHECKS, STATES, AREAS } from '../src/ads/audit.mjs';
import { main, insideRuntime, parseArgs } from '../scripts/ads-audit.mjs';

// Synthetic fixtures only (fixtures/ads/): every expected figure below is worked out by hand from them.
const AT = '2026-11-15T09:00:00.000Z';
const read = async f => readFile(new URL(`../fixtures/ads/${f}`, import.meta.url), 'utf8');
const json = async () => fromJson(await read('export.synthetic.json'));
const find = (r, account, id) => r.findings.find(f => f.account === account && f.id === id);
const G = 'google:synthetic-google', L = 'linkedin:synthetic-linkedin';
const refused = (fn, re) => assert.throws(fn, e => isExportError(e) && re.test(e.message), String(re));
const base = over => ({ format: 'ads-export/1', accounts: [{ platform: 'google', account_ref: 'a', currency: 'GBP', window: { start: '2026-10-01', end: '2026-10-28' }, campaigns: [{ id: 'c1', spend: 10, conversions: 1 }], ...over }] });

test('the synthetic export: every check runs on every account, and the counts are the hand-worked ones', async () => {
  const r = auditAccounts(await json(), { at: AT });
  assert.equal(r.findings.length, CHECKS.length * 2 + 1, 'each check once an account, then the cross-platform check');
  assert.deepEqual(r.counts, { fail: 2, watch: 12, unknown: 1, not_applicable: 1, pass: 13 });
  for (const f of r.findings) { assert.ok(STATES.includes(f.state), f.id); assert.ok(AREAS.includes(f.area), f.id); assert.ok(f.evidence.length > 10, f.id); }
  assert.equal(r.read_only, true);
  assert.equal(r.platforms_contacted, 0);
  assert.equal(r.changes_made, 0);
});

test('wasted spend is measured against the account\'s own cost per conversion, never an outside benchmark', async () => {
  const r = auditAccounts(await json(), { at: AT });
  assert.equal(totals((await json())[0]).cost_per_conversion, 120, 'GBP 1200 over 10 conversions');
  const idle = find(r, G, 'ads.waste.no_conversion_campaigns');
  assert.equal(idle.state, 'fail');
  assert.equal(idle.at_stake, 400, 'Search competitors 250 and Display awareness 150');
  assert.match(idle.evidence, /^2 campaigns spent at least GBP 120\.00 each, the account's own cost per conversion, with no conversion: Search competitors; Display awareness\. Together GBP 400\.00, 33% of the account's spend\.$/);
  assert.match(idle.rule, /never an outside benchmark/);
  const terms = find(r, G, 'ads.waste.search_terms');
  assert.equal(terms.state, 'watch');
  assert.equal(terms.at_stake, 255, 'term one 130 and term four 125; term two is under the line');
  assert.equal(find(r, L, 'ads.waste.search_terms').state, 'not_applicable');
  assert.equal(find(r, G, 'ads.waste.no_click_spend').at_stake, 150);
  assert.equal(find(r, L, 'ads.waste.no_conversion_campaigns').state, 'pass');
  const small = auditAccount(fromJson(JSON.stringify(base({ campaigns: [{ id: 'c1', spend: 100, conversions: 2 }, { id: 'c2', spend: 5, conversions: 0 }] })))[0]);
  assert.equal(small.find(f => f.id === 'ads.waste.no_conversion_campaigns').state, 'pass', "GBP 5 with none is under the account's own GBP 52.50, so it is not called waste");
});

test('waste at stake adds each campaign once however many checks flag it, and never across currencies', async () => {
  const accounts = await json();
  const r = auditAccounts(accounts, { at: AT });
  // Campaigns g4 (250) and g3 (150, flagged twice) once each, plus term one (130) in g2, which is not flagged; term four is in g4, already counted.
  assert.deepEqual(r.waste_at_stake, { GBP: { spend: 530, terms_unplaced: 0 } });
  const unplaced = fromJson(JSON.stringify(base({ search_terms: [{ campaign_id: null, term: 'loose term', spend: 50, conversions: 0 }], campaigns: [{ id: 'c1', spend: 10, conversions: 1 }, { id: 'c2', spend: 0, conversions: 0 }] })));
  const u = auditAccounts(unplaced, { at: AT });
  assert.deepEqual(u.waste_at_stake, { GBP: { spend: 0, terms_unplaced: 1 } }, 'a term with no campaign is counted, never guessed into one');
  const two = fromJson(JSON.stringify({ format: 'ads-export/1', accounts: [base().accounts[0], { ...base().accounts[0], account_ref: 'b', currency: 'USD', campaigns: [{ id: 'x', spend: 30, conversions: 3 }, { id: 'y', spend: 40, conversions: 0, clicks: 1, impressions: 1 }] }] }));
  // USD: 70 over 3 conversions is 23.33 a conversion, so y's 40 with none is flagged; GBP's one campaign converted.
  const w = wasteAtStake(two, two.flatMap(auditAccount));
  assert.deepEqual(Object.keys(w), ['USD'], 'currencies stay apart');
  assert.equal(w.USD.spend, 40);
});

test('efficiency: costly campaigns against twice the account\'s own average, with the extra they cost', async () => {
  const r = auditAccounts(await json(), { at: AT });
  const g = find(r, G, 'ads.efficiency.cost_outliers');
  assert.equal(g.state, 'watch');
  assert.equal(g.at_stake, 360, 'Search generic: 600 for 2 conversions against 2 at 120');
  const l = find(r, L, 'ads.efficiency.cost_outliers');
  assert.equal(Math.round(l.at_stake * 100) / 100, 771.43, '900 for 3 conversions against 3 at 1200/28');
  assert.match(l.recommendation.action, /check the conversions are the same kind/);
});

test('tracking gaps: duplicate primaries, counting every lead, no offline import, no values, untagged links, more conversions than clicks', async () => {
  const r = auditAccounts(await json(), { at: AT });
  assert.equal(find(r, G, 'ads.tracking.duplicate_actions').state, 'watch');
  assert.equal(find(r, G, 'ads.tracking.counting').state, 'watch');
  assert.equal(find(r, L, 'ads.tracking.counting').state, 'watch');
  for (const a of [G, L]) assert.match(find(r, a, 'ads.tracking.offline').evidence, /good meeting/);
  assert.equal(find(r, G, 'ads.tracking.values').state, 'watch');
  assert.equal(find(r, L, 'ads.tracking.values').state, 'unknown', 'a value not given is unknown, never zero');
  const links = find(r, G, 'ads.tracking.links');
  assert.equal(links.state, 'fail');
  assert.match(links.evidence, /^2 campaigns land on mindmake\.co with no utm_source and utm_medium and no auto-tagging: Search generic; Display awareness\..* 1 more lands off mindmake\.co: Search competitors\.$/);
  assert.equal(find(r, L, 'ads.tracking.links').state, 'pass');
  assert.equal(find(r, L, 'ads.tracking.more_conversions_than_clicks').state, 'watch');
  const tagged = fromJson(JSON.stringify(base({ auto_tagging: true, campaigns: [{ id: 'c1', spend: 10, conversions: 1, final_urls: ['https://www.mindmake.co/?start=1'] }] })));
  assert.equal(auditAccount(tagged[0]).find(f => f.id === 'ads.tracking.links').state, 'pass', 'auto-tagging traces a bare link');
});

test('zero conversions: a fail only when the actions prove nothing is tracked, else watched with what would tell', () => {
  const zero = actions => auditAccount(fromJson(JSON.stringify(base({ campaigns: [{ id: 'c1', spend: 90, conversions: 0 }], conversion_actions: actions })))[0]);
  const none = zero([{ name: 'Brief finished', primary: false, enabled: true }]).find(f => f.id === 'ads.tracking.no_conversions');
  assert.equal(none.state, 'fail');
  assert.equal(none.at_stake, 90);
  assert.equal(zero([{ name: 'Brief finished', primary: true, enabled: true }]).find(f => f.id === 'ads.tracking.no_conversions').state, 'watch');
  const blind = zero(null);
  assert.equal(blind.find(f => f.id === 'ads.tracking.no_conversions').state, 'watch');
  assert.match(blind.find(f => f.id === 'ads.tracking.no_conversions').evidence, /cannot be told/);
  for (const id of ['ads.tracking.primary_action', 'ads.tracking.duplicate_actions', 'ads.tracking.counting', 'ads.tracking.offline']) assert.equal(blind.find(f => f.id === id).state, 'unknown', id);
  assert.equal(blind.find(f => f.id === 'ads.waste.no_conversion_campaigns').state, 'unknown', 'no cost per conversion to measure against');
});

test('a figure not given is unknown, never zero, everywhere it is needed', () => {
  const [a] = fromJson(JSON.stringify(base({ campaigns: [{ id: 'c1', spend: 100, conversions: 2 }, { id: 'c2', spend: 50 }] })));
  const t = totals(a);
  assert.equal(t.conversions, null);
  assert.equal(t.cost_per_conversion, null);
  const f = auditAccount(a);
  for (const id of ['ads.waste.no_conversion_campaigns', 'ads.efficiency.cost_outliers', 'ads.tracking.no_conversions', 'ads.tracking.values', 'ads.waste.no_click_spend', 'ads.tracking.links', 'ads.tracking.more_conversions_than_clicks']) assert.equal(f.find(x => x.id === id).state, 'unknown', id);
  assert.equal(f.find(x => x.id === 'ads.data.figures').state, 'watch');
  assert.equal(auditAccount(fromJson(JSON.stringify(base({ window: null })))[0]).find(x => x.id === 'ads.data.window').state, 'unknown');
});

test('across platforms: conversions are added only when every window and attribution match', async () => {
  const c = crossPlatform(await json());
  assert.equal(c.comparable, false);
  assert.equal(c.check.state, 'watch');
  assert.deepEqual(c.by_currency, { GBP: { spend: 2400, unknown_spend: 0, conversions: null } });
  const same = fromJson(JSON.stringify({ format: 'ads-export/1', accounts: [base({ attribution: { click_days: 30, view_days: 1 } }).accounts[0], { ...base({ attribution: { click_days: 30, view_days: 1 } }).accounts[0], platform: 'linkedin', campaigns: [{ id: 'l', spend: 20, conversions: 3 }] }] }));
  const s = crossPlatform(same);
  assert.equal(s.comparable, true);
  assert.equal(s.check.state, 'pass');
  assert.deepEqual(s.by_currency.GBP, { spend: 30, unknown_spend: 0, conversions: 4 });
  assert.equal(crossPlatform(same.slice(0, 1)).check.state, 'not_applicable');
});

test('the CSV form reads quoted fields and fills only what it has; search terms and actions stay unknown', async () => {
  const accounts = fromCsv(await read('campaigns.synthetic.csv'));
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].campaigns[1].name, 'Search generic, broad');
  assert.equal(accounts[1].campaigns[0].conversions, null, 'an empty cell is unknown, never zero');
  assert.equal(accounts[0].attribution.click_days, 30);
  assert.equal(accounts[1].attribution, null);
  const r = auditAccounts(accounts, { at: AT });
  assert.equal(find(r, G, 'ads.waste.search_terms').state, 'unknown');
  assert.equal(find(r, G, 'ads.tracking.primary_action').state, 'unknown');
  assert.equal(find(r, G, 'ads.tracking.links').state, 'fail', 'a bare mindmake.co link with auto-tagging not given');
  assert.deepEqual(parseCsv('a,b\r\n"x ""y""",2\n'), [['a', 'b'], ['x "y"', '2']]);
});

test('a bad file is refused whole, naming what is wrong: never a partial audit', async () => {
  const csv = await read('campaigns.synthetic.csv');
  const [head, ...rows] = csv.trim().split('\n');
  refused(() => fromCsv(`${head},budget\n${rows.map(r => `${r},1`).join('\n')}`), /columns not read: budget/);
  refused(() => fromCsv(`${head.replace('spend,', '')}\n${rows[0]}`), /missing columns: spend|cells for/);
  refused(() => fromCsv(`${head}\n${rows[0]}\n${rows[0]}`), /campaign g1 appears twice/);
  refused(() => fromCsv(`${head}\n${rows[0]}\n${rows[1].replace(',GBP,', ',EUR,')}`), /currency differs/);
  refused(() => fromCsv(`${head}\n${rows[0].replace(',200,', ',-200,')}`), /not a figure of zero or more/);
  refused(() => fromCsv(`${head}\n"open,1`), /never closed/);
  refused(() => fromJson('{"format":"other","accounts":[]}'), /format must be/);
  refused(() => fromJson('not json'), /not valid JSON/);
  refused(() => fromJson(JSON.stringify(base({ currency: 'pounds' }))), /three-letter code/);
  refused(() => fromJson(JSON.stringify(base({ window: { start: '2026-10-28', end: '2026-10-01' } }))), /ends before it starts/);
  refused(() => fromJson(JSON.stringify(base({ campaigns: [{ id: 'c1', spend: 1, final_urls: ['javascript:alert(1)'] }] }))), /not a web address/);
  refused(() => fromJson(JSON.stringify(base({ conversion_actions: [{ name: 'x', counting: 'twice' }] }))), /counting is one or every/);
  refused(() => readExport('{}', 'export.xlsx'), /a \.json or \.csv file/);
  refused(() => readExport('x'.repeat(LIMITS.bytes + 1), 'big.csv'), /larger than/);
  assert.equal(CSV_COLUMNS.length, new Set(CSV_COLUMNS).size);
});

test('the same export gives the same report, byte for byte, with no em dash and every draft behind his yes', async () => {
  const a = auditAccounts(await json(), { at: AT }), b = auditAccounts(await json(), { at: AT });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const md = renderMarkdown(a);
  assert.equal(md, renderMarkdown(b));
  assert.equal(md.includes(String.fromCharCode(8212)), false);
  assert.match(md, /No ad platform was contacted and nothing was changed/);
  assert.match(md, /Paid media stays excluded for Mindmake \(playbook 10\)/);
  assert.match(md, /There is no health score/);
  assert.equal(a.recommendations.length, 13);
  assert.equal(a.recommendations[0].state, 'fail', 'fails first');
  for (const x of a.recommendations) assert.match(x.wall, /nothing changes until he says yes and makes the change himself/);
});

test('read only by construction: nothing in the audit can reach a network, a process or Control Center, and nothing runs it on a schedule', async () => {
  const files = ['src/ads/ingest.mjs', 'src/ads/audit.mjs', 'scripts/ads-audit.mjs'];
  for (const f of files) {
    const src = await readFile(new URL(`../${f}`, import.meta.url), 'utf8');
    for (const banned of [/\bfetch\s*\(/, /node:https?\b/, /node:net\b/, /node:dgram\b/, /node:child_process\b/, /control-center\.mjs/, /dispatch\.mjs/, /XMLHttpRequest|WebSocket/]) assert.equal(banned.test(src), false, `${f}: ${banned}`);
  }
  for (const f of ['src/dispatch.mjs', 'src/cli.mjs', 'src/engine.mjs']) assert.equal(/src\/ads\/|\.\/ads\//.test(await readFile(new URL(`../${f}`, import.meta.url), 'utf8')), false, `${f} never runs the audit`);
  for (const w of await readdir(new URL('../.github/workflows/', import.meta.url))) assert.equal(/ads-audit|src\/ads/.test(await readFile(new URL(`../.github/workflows/${w}`, import.meta.url), 'utf8')), false, w);
});

test('the command writes only under runtime/, prints counts and paths but no figure or name, and refuses a bad file with exit 2', async () => {
  assert.equal(insideRuntime('runtime/ads'), true);
  assert.equal(insideRuntime('runtime/../docs'), false);
  assert.equal(insideRuntime('fixtures'), false);
  assert.match(parseArgs(['--export']).error, /unknown or empty/);
  assert.match(parseArgs([]).error, /--export/);
  const out = `runtime/ads-test-${process.pid}`;
  const logs = [], errs = [];
  const io = { log: l => logs.push(l), err: l => errs.push(l), now: () => AT };
  try {
    assert.equal(await main(['--export', 'fixtures/ads/export.synthetic.json', '--out', 'docs'], io), 2);
    assert.match(errs.at(-1), /inside runtime\//);
    assert.equal(await main(['--export', 'fixtures/ads/missing.json', '--out', out], io), 2);
    assert.equal(await main(['--export', 'package.json', '--out', out], io), 2, 'not an export');
    assert.equal(await main(['--export', 'fixtures/ads/export.synthetic.json', '--out', out], io), 0);
    const printed = JSON.parse(logs.at(-1));
    assert.deepEqual(printed.findings, { fail: 2, watch: 12, unknown: 1, not_applicable: 1, pass: 13 });
    assert.equal(printed.platforms_contacted, 0);
    assert.equal(/Search|synthetic term|530|400|GBP/.test(logs.at(-1)), false, 'no figure or name reaches the terminal');
    for (const p of printed.written) { assert.ok(p.startsWith(`${out}/`), p); assert.ok((await stat(new URL(`../${p}`, import.meta.url))).size > 100, p); }
    const written = JSON.parse(await readFile(new URL(`../${printed.written[0]}`, import.meta.url), 'utf8'));
    assert.deepEqual(written, auditAccounts(await json(), { at: AT }), 'the file is the pure report, byte for byte');
  } finally {
    await rm(new URL(`../${out}`, import.meta.url), { recursive: true, force: true });
  }
});
