import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toQuestion, questionsFrom, controlCenterPlan, enginePlan, canonDomains, controlCenterHits, engineHits, domainFindings, accountMoves, placesCount, missedQuestions, placesReview, placesShadow,
  MAX_PROBES_PER_RUN, QUESTIONS_PER_PLACE } from '../src/stages/places.mjs';
import { weeklyPlaces } from '../src/weekly-review.mjs';
import { canon, AT, id, daysAgo, CC_DOMAINS } from './support/section12.mjs';

// Places, GEO and AEO question choice for Mindmake, ported from Control
// Center (plan section 12, M13). Every place, question, domain and id below
// is invented; CC_DOMAINS is a stand-in that trips the same findings as
// Control Center's own list.
//
// Parity table (api/growth/geo-probe.ts and src/lib/growthModel.ts, and
// Control Center's tests/api/growthModel.test.ts: engine test):
//   a clause becomes a question: capitalised, with one question mark     the same
//   a trigger splits on "/", fragments under 12 characters dropped,
//     duplicates once, at most four                                      the same
//   the plan: best-rated first, then by product, twelve a run, the rest
//     skipped and said                                                   the same
//   a citation is any of Mindmake's domains in the answer or citations   the same rule, with the canon's domains as whole hosts
//   accounts: the one that opens the best-rated places first, a live
//     account is no chore                                                the same, for Mindmake
//   places: not retired, covered, waiting on an open question            the same, for Mindmake
//   missedQuestions: one per question, only the engines that missed,
//     inside 30 days, someone else's answers never                       the same, for Mindmake
// Differences, each a code: domain_outside_canon, canon_domain_missing,
// substring_hit, answer_cut, cap_shared_with_other_products,
// question_names_retired_offer.

const tp = (n, product, score, trigger, over = {}) => ({ id: id(n), product_slug: product, channel: 'geo', icp_trigger: trigger, coverage_status: 'unaddressed', cost_efficiency_score: score, assumption_flag: null, ...over });

test('questions: the clause, the split, the caps', () => {
  assert.equal(toQuestion('  how do I   get my first clients '), 'How do I get my first clients?');
  assert.equal(toQuestion('Is it worth it?'), 'Is it worth it?');
  assert.equal(toQuestion(''), '');
  assert.deepEqual(questionsFrom('how do leaders build an AI of their own / short / how do leaders build an AI of their own / who builds AI for a CEO'), ['How do leaders build an AI of their own?', 'Who builds AI for a CEO?']);
  assert.deepEqual(questionsFrom('tiny'), ['Tiny?'], 'nothing long enough: the whole trigger is the question');
  assert.equal(questionsFrom(Array.from({ length: 6 }, (_, i) => `a buyer question number ${i}`).join(' / ')).length, QUESTIONS_PER_PLACE);
});

test("Control Center's plan shares twelve probes across products; the engine plans Mindmake's alone and holds a retired offer", () => {
  const many = n => Array.from({ length: 4 }, (_, i) => `a ${n} buyer question number ${i}`).join(' / ');
  const tps = [tp(1, 'other_product', 9, many('first')), tp(2, 'other_product', 8, many('second')), tp(3, 'mindmake', 7, many('mindmake')), tp(4, 'mindmake', 6, 'who runs an Example Audit for AI'),
    tp(5, 'mindmake', 9, many('retired'), { coverage_status: 'retired' }), tp(6, 'mindmake', 9, many('social'), { channel: 'social_organic' })];
  const theirs = controlCenterPlan(tps);
  assert.equal(theirs.planned.length, MAX_PROBES_PER_RUN);
  assert.equal(theirs.planned.filter(p => p.product_slug === 'mindmake').length, 4, "other products' questions take two thirds of the run");
  assert.equal(theirs.skipped.length, 1);
  const mine = enginePlan(tps, canon);
  assert.equal(mine.planned.length, 4);
  assert.deepEqual(mine.held.map(h => h.code), ['question_names_retired_offer']);
  assert.ok(mine.planned.every(p => p.product_slug === 'mindmake'));
  const shadow = placesShadow({ context: { records: { touchpoints: tps } }, canon, at: AT }).line;
  assert.match(shadow, /Questions: the engine would probe 4 for Mindmake, Control Center's shared plan reaches 4 \(question_names_retired_offer 1\)\./);
  const crowded = [...tps, tp(7, 'other_product', 10, many('third')), tp(8, 'other_product', 10, many('fourth'))];
  assert.match(placesShadow({ context: { records: { touchpoints: crowded } }, canon, at: AT }).line, /shared plan reaches 0 \(cap_shared_with_other_products 4, question_names_retired_offer 1\)/);
});

test("Mindmake's domains come from the canon; Control Center's list is compared by code", () => {
  assert.deepEqual(canonDomains(canon), ['mindmake.example.org', 'publication.example.org']);
  assert.deepEqual(canonDomains(null), []);
  // The same findings the real list gives against the real canon: four outside it, the publication's own host missing.
  assert.deepEqual(domainFindings(CC_DOMAINS, canon), { domain_outside_canon: 4, canon_domain_missing: 1 });
  assert.deepEqual(domainFindings(canonDomains(canon), canon), {});
  assert.deepEqual(domainFindings(CC_DOMAINS, null), { canon_not_read: 1 });
  const answer = { text: 'See mindmake.example.org.uk and notmindmake.example.org for more.', citations: ['https://www.othersite.example/mindmake.example.orgs'] };
  assert.deepEqual(controlCenterHits(answer, canonDomains(canon)), ['mindmake.example.org'], 'a substring counts for Control Center');
  assert.deepEqual(engineHits(answer, canonDomains(canon)), [], 'never inside another name');
  assert.deepEqual(engineHits({ text: 'Built by Mindmake (https://mindmake.example.org/?start=1).', citations: ['https://home.publication.example.org/p/1'] }, canonDomains(canon)), ['mindmake.example.org', 'publication.example.org']);
});

test('places, accounts and missed questions, for Mindmake', () => {
  const tps = [tp(1, 'mindmake', 9, 't', { channel: 'substack' }), tp(2, 'mindmake', 6, 't', { channel: 'social_organic' }), tp(3, 'mindmake', 8, 't', { channel: 'social_organic', coverage_status: 'covered' }),
    tp(4, 'mindmake', 3, 't', { coverage_status: 'retired' }), tp(5, 'mindmake', 5, 't', { channel: 'social_organic', assumption_flag: 'Krish to open the account' }), tp(6, 'other_product', 10, 't', { channel: 'substack' })];
  const accounts = [{ product_slug: 'mindmake', platform: 'Instagram', status: 'planned', handle: null }, { product_slug: 'mindmake', platform: 'substack', status: 'planned', handle: '' }, { product_slug: 'mindmake', platform: 'linkedin', status: 'live', handle: 'someone' }, { product_slug: 'other_product', platform: 'x', status: 'planned', handle: null }];
  assert.deepEqual(accountMoves(accounts, tps), [{ key: 'account:mindmake:substack', platform: 'substack', opens: 1, best: 9 }, { key: 'account:mindmake:instagram', platform: 'instagram', opens: 2, best: 6 }]);
  assert.deepEqual(placesCount(tps), { covered: 1, total: 4, waiting: 1 });
  const probe = (q, cited, engine, d, over = {}) => ({ product_slug: 'mindmake', question: q, we_cited: cited, engine, run_at: daysAgo(d), ...over });
  const probes = [probe('Who builds an AI for a CEO?', false, 'perplexity', 3), probe('Who builds an AI for a CEO?', false, 'chatgpt', 5), probe('Mindmake reviews', true, 'perplexity', 3), probe('Mindmake reviews', false, 'chatgpt', 3),
    probe('An old question', false, 'perplexity', 40), probe('Their question', false, 'perplexity', 2, { subject_kind: 'prospect' }), probe('Other product', false, 'perplexity', 2, { product_slug: 'other_product' })];
  // As in Control Center, a question named by one engine and missed by another is still missed by that one.
  assert.deepEqual(missedQuestions(probes, AT), [{ question: 'Mindmake reviews', engines: ['chatgpt'], last_asked: daysAgo(3) }, { question: 'Who builds an AI for a CEO?', engines: ['chatgpt', 'perplexity'], last_asked: daysAgo(3) }]);
  const review = weeklyPlaces({ touchpoints: tps, probes, accounts, canon }, AT);
  assert.deepEqual(review, placesReview({ touchpoints: tps, probes, accounts, canon, at: AT }));
  assert.deepEqual(weeklyPlaces({}, AT), { questions: null, accounts: null, places: null, missed: null, domains: [] }, 'nothing served, nothing assumed');
});

test('placesShadow: the engine reads each stored probe again; counts and codes only', () => {
  const p = (n, cited, text, citations = []) => ({ product_slug: 'mindmake', question: `Question ${n}?`, we_cited: cited, answer_snapshot: text, competitors_cited: citations, run_at: daysAgo(1) });
  const probes = [p(1, true, 'Mindmake (mindmake.example.org) builds these.'), p(2, false, 'Nobody we know.'), p(3, true, 'See notmindmake.example.org.'), p(4, true, 'Try circle.example.net.'), p(5, true, 'x'.repeat(1800)), p(6, false, 'publication.example.org has it.'), { product_slug: 'mindmake', question: 'Unrecorded?', we_cited: null, answer_snapshot: '' }];
  const context = { records: { geo_probes: [...probes, { ...p(9, true, 'other'), product_slug: 'other_product' }] } };
  const frozen = structuredClone(context);
  const { line } = placesShadow({ context, canon, at: AT, ccDomains: CC_DOMAINS });
  assert.deepEqual(context, frozen);
  assert.equal(line, "Places and questions, in shadow: 7 probes read; agrees with Control Center on 2, differs on 4 (answer_cut 1, cited_outside_canon 1, missed_by_control_center 1, substring_hit 1); 1 not comparable (not_recorded 1). Questions: Mindmake's touchpoints are not served this run, so none are planned. Domains: the canon names 2; Control Center's list differs (canon_domain_missing 1, domain_outside_canon 4).");
  assert.equal(placesShadow({ context: {}, canon, at: AT }).line, "Places and questions, in shadow: Control Center's probes are not served this run, so none are compared. Questions: Mindmake's touchpoints are not served this run, so none are planned. Domains: the canon names 2, not compared with Control Center's list this run.");
  assert.doesNotMatch(line, /Question \d|example|https?:\/\//, 'never a question, a domain or a link');
});
