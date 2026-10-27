import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ccBuyingMoment, buyingMoment, buyingStances, ccBuyerTitle, qualifyShadow, CC_STANCE_VALUE, CC_TRIGGER_FLOOR, PUBLIC_POST, MOMENT_DAYS, EVIDENCE_DAYS } from '../src/stages/qualify.mjs';
import { prepare, pinnedCanonDrift, templateAskCurrent, TEMPLATE_ASK } from '../src/stages/draft.mjs';
import { canonBuyerTitle } from '../src/stages/canon.mjs';
import { canon, AT, id } from './support/section12.mjs';

// The legacy ingest gate's strategy, ported from Control Center (plan
// section 12, M12). Every person, company and id below is invented.
//
// Parity table (Control Center test or source: engine test):
//   tests/api/mindmakeGrowth.test.ts, a stance that is not a buying moment
//     (teaching) holds no_current_buying_moment:                                the same (ccBuyingMoment)
//   tests/api/mindmakeGrowth.test.ts, a post 31 days old is no buying moment:   the same, at its own NOW
//   tests/api/mindmakeGrowth.test.ts, titles outside, none, no "who",
//     excluded by "who not":                                                     the same codes (ccBuyerTitle)
//   api/_mindmakeGrowth.ts contactEvidence, ten stance, source and age cases
//     (run against Control Center's code on 27 Oct):                             the same (ccBuyingMoment)
//   api/_mindmakeGrowth.ts prepare, ten titles against one product_icp
//     (run against Control Center's code on 27 Oct):                             the same (ccBuyerTitle)
//   tests/api/mindmakeGrowth.test.ts, suppression, changed evidence, an
//     existing deal, cold richness, cooldown:                                    already held by analyse() (tests/planning.test.mjs);
//                                                                                 the consent, suppression and richness walls stay in Control Center
//   tests/api/mindmakeGrowth.test.ts, bearer, replay, HTTP boundary, expired
//     pinned canon, human qualification:                                         left in Control Center (the ingest route, its records,
//                                                                                 and qualification, which only Krish confirms)
//   api/_mindmakeGrowthContract.ts APPROVED_CANON:                             checked against the canon (pinnedCanonDrift); not ported

const NOW = '2026-10-16T17:00:00.000Z';
// Control Center's answers, from running api/_mindmakeGrowth.ts contactEvidence on these cases at NOW.
const MOMENTS = [
  ['asking', 'https://www.linkedin.com/posts/example-a', '2026-10-15T12:00:00Z', true],
  ['struggling', 'https://www.linkedin.com/posts/example-b', '2026-10-01T12:00:00Z', true],
  ['hiring', 'https://x.com/example/status/1', '2026-10-10T12:00:00Z', true],
  ['evaluating', 'https://twitter.com/example/status/2', '2026-10-10T12:00:00Z', true],
  ['building', 'https://www.linkedin.com/posts/example-c', '2026-10-10T12:00:00Z', false],
  ['teaching', 'https://www.linkedin.com/posts/example-d', '2026-10-10T12:00:00Z', false],
  ['asking', 'https://www.linkedin.com/posts/example-e', '2026-09-15T17:00:00Z', false],
  ['asking', 'https://example.org/blog/post', '2026-10-15T12:00:00Z', false],
  ['asking', 'https://www.linkedin.com/in/example-f', '2026-10-15T12:00:00Z', false],
  ['asking', 'https://www.linkedin.com/feed/update/urn:li:activity:1', '2026-10-15T12:00:00Z', true],
];

test("what counts as a buying moment: Control Center's rule, case for case", () => {
  for (const [stance, url, posted, want] of MOMENTS) assert.equal(ccBuyingMoment({ stance, url, posted }, NOW), want, `${stance} ${url} ${posted}`);
  assert.equal(CC_TRIGGER_FLOOR, 65);
  assert.deepEqual(Object.keys(CC_STANCE_VALUE).filter(s => CC_STANCE_VALUE[s] >= CC_TRIGGER_FLOOR), ['asking', 'struggling', 'hiring', 'evaluating']);
  assert.equal(MOMENT_DAYS, 30);
  assert.equal(EVIDENCE_DAYS, 90);
  assert.ok(PUBLIC_POST.test('https://www.linkedin.com/posts/x') && !PUBLIC_POST.test('https://www.linkedin.com/in/x'));
});

test("the engine keeps the source and the window, and counts only a stance one of the canon's moments supports", () => {
  assert.deepEqual(buyingStances(canon.buyer), ['asking', 'struggling', 'evaluating']);
  const engine = MOMENTS.map(([stance, url, posted]) => buyingMoment({ stance, url, posted }, { at: NOW, buyer: canon.buyer }));
  assert.deepEqual(engine, [true, true, false, true, false, false, false, false, false, true], 'hiring is the one difference: no canon moment names it');
  assert.equal(buyingMoment({ stance: 'asking', url: MOMENTS[0][1], posted: MOMENTS[0][2] }, { at: NOW, buyer: null }), null, 'no buyer read, no verdict');
  assert.deepEqual(buyingStances({ moments: ['Growth is possible, but the price is holding it back.'] }), ['asking'], 'a moment the canon drops takes its stances with it');
});

const ICP = { defined: true, definition: 'Leaders with an owned business decision.', buyer_titles: ['Principal', 'CEO', 'Founder'], industries: [], exclusions: ['Vendors'] };
// Control Center's answers, from running api/_mindmakeGrowth.ts prepare on these titles with ICP.
const TITLES = [['Principal', null], ['Chief Executive Officer', 'buyer_title_outside_current_definition'], ['CEO', null], ['Co-founder', null], ['Founder and CEO', null],
  ['Chief Revenue Officer', 'buyer_title_outside_current_definition'], ['VP Revenue', 'buyer_title_outside_current_definition'], ['Head of Strategy', 'buyer_title_outside_current_definition'],
  ['Software Engineer', 'buyer_title_outside_current_definition'], ['Managing Partner', 'buyer_title_outside_current_definition']];

test("the buyer-title rules: Control Center's answers on product_icp, and where the canon's groups read the same titles differently", () => {
  for (const [title, want] of TITLES) assert.equal(ccBuyerTitle({ title, company: 'Example Works' }, ICP), want, title);
  assert.equal(ccBuyerTitle({ title: 'Principal', company: 'Vendors Ltd' }, ICP), 'buyer_excluded_by_current_definition');
  assert.equal(ccBuyerTitle({ title: 'Principal' }, { ...ICP, buyer_titles: [] }), 'buyer_definition_or_context_unavailable');
  assert.equal(ccBuyerTitle({ title: 'Principal' }, { ...ICP, definition: ' ' }), 'buyer_definition_or_context_unavailable');
  assert.equal(ccBuyerTitle({ title: 'Principal' }, { ...ICP, defined: false }), 'buyer_definition_or_context_unavailable');
  assert.equal(ccBuyerTitle({ title: 'Principal', company: 'Example Works' }, { defined: true, who: 'Leaders.', buyer_titles: ['Principal'], who_not: 'Example Works' }), 'buyer_excluded_by_current_definition', "the raw row's who_not reads the same");
  const canonSays = TITLES.map(([t]) => canonBuyerTitle(t, canon.buyer));
  assert.deepEqual(canonSays, [true, true, true, true, true, true, true, true, false, false]);
});

const APPROVED = (() => {
  const src = readFileSync(new URL('../contracts/growth.ts', import.meta.url), 'utf8');
  const field = k => new RegExp(`${k}: '([^']+)'`).exec(src)[1];
  return { brief_url: field('brief_url'), publication_url: field('publication_url'), brain_description: field('brain_description'), revenue_description: field('revenue_description') };
})();

test('the pinned offer copy, field by field, against the canon read this run; the template names an ask the canon renamed', () => {
  const live = { ...canon, ask: { ...canon.ask, url: APPROVED.brief_url }, publication: { ...canon.publication, url: APPROVED.publication_url }, offer: { ...canon.offer, revenue_line: 'their pricing, positioning and team rebuilt for AI, then tested with real buyers.' } };
  assert.deepEqual(pinnedCanonDrift(APPROVED, live), [], 'the pinned copy matches a canon that says the same');
  assert.deepEqual(pinnedCanonDrift(APPROVED, canon), ['brief_url_moved', 'publication_url_moved', 'revenue_line_changed']);
  assert.equal(pinnedCanonDrift(null, canon), null);
  assert.equal(templateAskCurrent(canon), false, "'the free AI brief' is not 'Start building your AI brain'");
  assert.equal(templateAskCurrent({ ask: { label: 'Get your free AI brief' } }), true);
  const out = prepare({ contact: { id: id(1), full_name: 'Avery Example', company: 'Example Works' }, trigger: { fact: 'Example Works rebuilt its pricing.' }, mode: 'warm', evidence: [{ observed_at: AT, url: 'https://example.org/a' }], offer: 'brain', why_fit: 'An invented fit.' },
    { ...APPROVED, revision: 'synthetic' });
  assert.ok(out.draft.body.includes(TEMPLATE_ASK), "TEMPLATE_ASK is prepare()'s own words");
});

test('in shadow: the canon beside product_icp over Control Center\'s own snapshot, its buying moments and its pinned copy, in counts only', () => {
  const c = (n, title, extra = {}) => ({ id: id(n), full_name: `Avery Example${n}`, title, company: 'Example Works', ...extra });
  const moment = posted => ({ id: 'm', kind: 'trigger', visibility: 'public', fact: 'An invented post.', url: 'https://www.linkedin.com/posts/example', observed_at: posted });
  const context = { work_context: { snapshot: { icp: ICP, canon: APPROVED, contacts: [
    c(1, 'Founder', { buying_moment: moment('2026-10-20T09:00:00.000Z') }), c(2, 'Chief Revenue Officer'), c(3, 'Principal', { company: 'Vendors Ltd' }), c(4, 'Software Engineer'),
    c(5, 'Role not recorded'), c(6, 'CEO', { buying_moment: moment('2026-09-01T09:00:00.000Z') }), c(1, 'Founder'),
  ] } } };
  const frozen = structuredClone(context);
  const out = qualifyShadow({ context, canon, at: AT });
  assert.equal(out.line, 'Ingest gate, in shadow: 6 contacts read; agrees with Control Center on 3, differs on 2 (canon_buyer_excluded_by_icp 1, canon_buyer_outside_icp_titles 1); 1 not comparable (title_not_served 1). Buying moments: Control Center calls 2 current, 1 keep their source and window this run (the stance is not served); the canon supports 3 of the 4 stances it counts. Pinned offer copy: 1 of 4 fields match the canon read live (brief_url_moved, publication_url_moved, revenue_line_changed); the outreach template\'s ask is not the canon\'s.');
  assert.deepEqual(context, frozen, 'the context is read, never changed');
  assert.doesNotMatch(out.line, /0000|Avery|Example|https/, 'no id, name or link in the line');
  assert.match(qualifyShadow({ context: { work_context: { snapshot: { icp: { defined: false }, contacts: [c(1, 'Founder')] } } }, canon, at: AT }).line, /icp_not_defined 1/);
  assert.equal(qualifyShadow({ context: null, canon: null, at: AT }).line, 'Ingest gate, in shadow: 0 contacts read; agrees with Control Center on 0, differs on 0. Buying moments: Control Center calls 0 current, 0 keep their source and window this run (the stance is not served). Pinned offer copy: not compared this run.');
});
