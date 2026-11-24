import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// The revenue desk adapter (Ruling, Krish, 2026-11-24): read only, no figures, no
// people. Every file and export it names must exist, every ruling it maps must be
// in docs/RULINGS.md, and no band binds before Krish's yes.
const read = p => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const raw = await read('config/revenue-desk.json');
const adapter = JSON.parse(raw);
const rulings = await read('docs/RULINGS.md');
const exists = p => existsSync(new URL(`../${p}`, import.meta.url));
const exportsName = (src, name) => new RegExp(`export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${name}\\b`).test(src);

async function assertExport(file, name) {
  assert.ok(exists(file), `${file} exists`);
  assert.ok(exportsName(await read(file), name), `${file} exports ${name}`);
}

test('the adapter parses, names this engine and holds no authority', () => {
  assert.equal(adapter.schema, 'revenue-desk-adapter/1');
  assert.equal(adapter.desk, 'revenue-desk');
  assert.equal(adapter.venture, 'mindmake');
  assert.equal(adapter.repo, 'krishanraja/growth-mindmake');
  assert.equal(adapter.spend_authority, 'none');
  assert.match(adapter.approval, /plan behind strategy/);
  assert.match(adapter.sheets, /^runtime\//, 'sheets stay in the private runtime spool');
  assert.ok(exists(adapter.north_star.file) && exists(adapter.north_star.state_line));
});

test('the money path runs from drafts sent to a module or retainer, and every read it names exists', async () => {
  const ids = adapter.money_path.map(s => s.id);
  assert.deepEqual(ids, ['drafts_sent', 'replied', 'booked', 'good_meeting', 'qualified', 'paid_proof', 'module_sale', 'retainer']);
  for (const s of adapter.money_path) {
    assert.ok(['up', 'down'].includes(s.better), `${s.id} has a better direction`);
    assert.ok(typeof s.alarm_action === 'string' && s.alarm_action.length > 0, `${s.id} has one required action`);
    if (s.read === null) { assert.match(s.blind_reason ?? '', /blind/i, `${s.id} says why it is blind`); assert.match(s.connect ?? '', /^Krish: /, `${s.id} says what Krish must connect`); continue; }
    await assertExport(s.read.file, s.read.export);
    assert.ok(s.read.unserved, `${s.id} says what an unserved read means`);
  }
});

test('qualified means all five scorecard confirmations, as the code counts them', async () => {
  const q = adapter.money_path.find(s => s.id === 'qualified');
  const src = await read('src/stages/scorecard.mjs');
  for (const k of q.read.confirmations) assert.ok(src.includes(`'${k}'`), `scorecard.mjs confirms ${k}`);
  assert.equal(q.read.confirmations.length, 5);
});

test('no band carries a threshold before Krish says yes', () => {
  assert.equal(adapter.band_status, "assumption, to calibrate from this engine's own history; binding only after Krish's yes");
  for (const s of adapter.money_path) {
    assert.equal(s.bands.warning, null, `${s.id} warning`);
    assert.equal(s.bands.breach, null, `${s.id} breach`);
    assert.ok(s.bands.calibrate_from, `${s.id} says where it calibrates from`);
  }
});

test('the throughput check, the stall hook and the revival read point at real code and the strategy figure', async () => {
  const t = adapter.throughput;
  await assertExport(t.actual.file, t.actual.export);
  assert.ok((await read(t.assumed.file)).includes(t.assumed.phrase), 'docs/STRATEGY.md still states the assumed sends figure');
  for (const name of adapter.stall_rule.hook.exports) await assertExport(adapter.stall_rule.hook.file, name);
  await assertExport(adapter.stall_rule.revival.file, adapter.stall_rule.revival.export);
  assert.ok(rulings.includes(`## ${adapter.stall_rule.revival.ruling}`));
});

test('every offer term maps to a ruling recorded word for word', () => {
  const ids = adapter.offer_terms.map(o => o.id);
  for (const id of ['codes', 'codes_scope', 'public_price', 'paid_proof_price']) assert.ok(ids.includes(id), id);
  for (const o of adapter.offer_terms) {
    assert.ok(rulings.includes(`## ${o.ruling}`), `docs/RULINGS.md has "${o.ruling}"`);
    if (o.ruling_phrase) assert.ok(rulings.includes(o.ruling_phrase), `the ruling says "${o.ruling_phrase}"`);
  }
});

test('no figures beyond the ruled public price, no outside names, no dashes or exclamation marks', () => {
  assert.ok(!raw.includes(String.fromCharCode(8212)), 'no em dash');
  assert.ok(!raw.includes('!'), 'no exclamation mark');
  const money = raw.match(/\$\s?\d[\d,.]*/g) ?? [];
  for (const m of money) assert.ok(rulings.includes(m), `${m} is a price a ruling already makes public`);
  assert.ok(!/@[a-z0-9.-]+\.[a-z]/i.test(raw), 'no address');
  const own = new Set(['src', 'docs', 'config', 'runtime', 'krishanraja', 'revenue-desk-adapter']);
  for (const ref of raw.match(/\b[A-Za-z][\w-]*\/[\w.-]+/g) ?? []) assert.ok(own.has(ref.split('/')[0]), `${ref} names nothing outside this repository or krishanraja`);
});
