import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { amplifierRows } from '../src/stages/rows.mjs';
import { readDeals, dealsLine } from '../src/stages/pilots.mjs';

// 5.13 (Krish, 2026-11-14: catch-up drafts for Pipeline deals gone quiet, each a draft for his send).
// A deal Control Center serves in records.stale_deals (features.deals_detail) makes its person a catch-up
// on NETWORK in his own box, whatever their tier, once nothing is on record for 30 days. Synthetic only.

const NOW = '2026-11-14T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Have a clear plan for driving partnerships and visibility for Mindmake'];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const route = () => ({ email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false });
const person = (n, extra = {}, contacts = {}) => ({ contact_id: id(n), network_tier: '6_cold', current_title: 'COO', current_company: `Example Co ${n}`, mindmake_fit: 70, known_since: '2025-05-01', email_last: '2026-09-20', hook: `Rebuilt the supply chain at Example Co ${n}.`, ...extra, contacts: { full_name: `Robin Sample${n}`, status: 'active', last_touch_at: null, ...contacts } });
const deal = (n, extra = {}) => ({ deal_ref: `deal-${n}`, contact_id: id(n), stage: 'Parked', next_date: null, last_touched: '2026-09-20', closed_reason: null, source: null, first_met: '2026-05-01', ...extra });

const run = (ctx, dealCatchups = true) => amplifierRows({ context: { feedback: [], research: [], ...ctx }, weekGoals: GOALS, canon, files: FILES, at: NOW, dealCatchups });

test('a deal gone quiet makes its person a catch-up on NETWORK in his own box, whatever their tier', () => {
  const r = run({ network: [person(1), person(2)], routes: { [id(1)]: route(), [id(2)]: route() }, records: { stale_deals: [deal(1, { stage: 'Closed Lost', closed_reason: 'Went quiet' })], deals: [] } });
  const net = r.rows.map(x => x.proposal).filter(p => p.row === 'network');
  assert.deepEqual(net.map(p => p.target), [id(1)], 'only the person with a deal gone quiet; a cold tie with no deal is no catch-up');
  const p = net[0];
  assert.match(p.title, /^Catch up with Robin/);
  assert.match(p.because, /^A deal gone quiet \(closed: went quiet\)/);
  assert.match(p.why, /deal went quiet/);
  assert.equal(p.close_condition.reference, 'network:deal_catchup');
  const a = JSON.parse(p.exact_payload);
  assert.equal(a.channel, 'email');
  assert.equal(a.mailbox ?? null, null, 'his own box, so the morning lane drafts it for his send');
  assert.equal(r.deal_catchups, 1);
});

test('nothing in the last 30 days, no catch-up; a person Control Center does not serve is held by name of the reason', () => {
  const recent = run({ network: [person(3, { email_last: '2026-11-01' })], routes: { [id(3)]: route() }, records: { stale_deals: [deal(3)] } });
  assert.equal(recent.rows.length, 0, 'written to 13 days ago');
  const missing = run({ network: [], routes: {}, records: { stale_deals: [deal(4)] } });
  assert.ok(missing.held.includes('deal_person_not_served'));
  assert.equal(missing.deal_catchups, 0);
});

test('without features.deals_detail the deals are not read, and a close tie stays the ordinary catch-up', () => {
  const off = run({ network: [person(5)], routes: { [id(5)]: route() }, records: { stale_deals: [deal(5)] } }, false);
  assert.equal(off.rows.length, 0, 'a cold tie with a deal is no catch-up when the deals are not served');
  const tie = run({ network: [person(6, { network_tier: '1_reciprocated', email_last: '2025-03-01' })], routes: { [id(6)]: route() }, records: { stale_deals: [] } });
  const p = tie.rows[0].proposal;
  assert.match(p.because, /^A close tie gone quiet/);
  assert.equal(p.close_condition.reference, 'network:relationship');
});

test('the deals line counts the catch-ups proposed, never a name', () => {
  const r = readDeals({ records: { deals: [], stale_deals: [deal(1), deal(2, { stage: 'Closed Lost', closed_reason: 'Timing' })] }, coverage: [{ source: 'deals', complete: true }] }, { deals_detail: true });
  const line = dealsLine(r, 1);
  assert.match(line, /1 catch-up proposed from them/);
  assert.equal(/Robin|Example Co/.test(line), false);
  assert.match(dealsLine(r), /No catch-up is proposed from them yet/, 'a run that did not build rows says so as before');
});
