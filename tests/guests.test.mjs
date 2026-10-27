import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { weeklyInvites, SHOW_SHARES } from '../src/stages/pitches.mjs';
import { computeGuestAxes, guestStanding, parseGuestJudgment, thinCause, standingFor, standingFromAxes, quotaByShare, interleaveByShare, byStrength, rankGuests, guestReady, guestCounts, approachPath,
  guestPath, mayDraftPitch, mayStoreGuest, mayStoreRow, lensFitScore, isOnDirection, showFit, scoutScore, evidenceFirst, callBudget, scoutTerms, guestsShadow,
  GUEST_FLOORS, GUEST_REASONS, WARM_TIERS, SHOW_ORDER, MAX_JUDGE_CALLS } from '../src/stages/guests.mjs';

// The guest standard, the shows' split and the queue, ported from Control
// Center (plan section 12, M3). Every person, show and id below is invented.
//
// Parity table (Control Center test: engine test):
//   guestStandard.test.ts, the headline is the minimum of the three axes:    the same
//   guestStandard.test.ts, a famous bore is refused as boring:               the same
//   guestStandard.test.ts, a brilliant unknown is refused as not visible:    the same
//   guestStandard.test.ts, the right person, less known, is a stretch:       the same
//   guestStandard.test.ts, all three at the bar is a take:                   the same
//   guestStandard.test.ts, thin evidence is unjudged with no numbers:        the same
//   guestStandard.test.ts, nothing found online is not visible:              the same (the judge's wording stays in Control Center)
//   guestStandard.test.ts, a thin reply says why:                            the same
//   guestStandard.test.ts, wrong show is its own refusal:                    the same
//   guestStandard.test.ts, every refusal code in the one vocabulary:         GUEST_REASONS (the database CHECK stays in Control Center)
//   guestStandard.test.ts, a past Signal & Noise guest is never wrong show:  the same, on standingFor
//   shows.test.ts, the shares are the ruling and sum to one:                 the same, in percent, from the invite stage's registry
//   shows.test.ts, a quota splits by share, largest remainder:               the same
//   shows.test.ts, any ten in a row is seven and three:                      the same
//   shows.test.ts, a show that runs dry is named:                            the same
//   shows.test.ts, rows with no show yet go last:                            the same
//   shows.test.ts, old rows keep a label:                                    left in Control Center (a surface label)
//   approaches.test.ts, guests come forward seven to three by show:          the same, on guest rows
//   approaches.test.ts, takes rank before stretches within a show:           the same
//   approaches.test.ts, the card, the box and the key tests:                 left in Control Center (People tab surface and mailbox routing)
//   focusDeadEnds.test.ts, guestPath warm tiers and no path:                 the same
//   focusDeadEnds.test.ts, a past guest is warm, two sources make rich:     the same
//   guestResearch.test.ts, people with something on record judged first:    the same, on evidenceFirst

const AT = '2026-10-27T09:00:00.000Z';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example.org/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example.org\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };

const base = { decision_authority: 85, ai_building: 80, online_presence: 80, appearances: 70, positivity: 80, memorability: 80, vendor_voice: false, show_fit: 'makeyourmindup', show_reason: 'An invented reason.', evidence_thin: false };

test('the headline is the minimum of the three axes', () => {
  const a = computeGuestAxes(base);
  assert.deepEqual(a, { senior_score: 83, seen_score: 77, spark_score: 80, guest_score: 77 }, "Control Center's answer for the same judgment");
  assert.equal(a.guest_score, Math.min(a.senior_score, a.seen_score, a.spark_score));
});

test('a famous bore is refused as boring, though a mean would pass them', () => {
  const j = { ...base, positivity: 30, memorability: 25, vendor_voice: true };
  const a = computeGuestAxes(j);
  assert.ok((a.senior_score + a.seen_score + a.spark_score) / 3 < GUEST_FLOORS.take || a.spark_score < GUEST_FLOORS.take);
  assert.deepEqual([guestStanding(j).guest_verdict, guestStanding(j).guest_reason], ['rejected', 'guest_boring']);
});

test('a brilliant unknown is refused as not visible', () => {
  const st = guestStanding({ ...base, online_presence: 15, appearances: 10 });
  assert.deepEqual([st.guest_verdict, st.guest_reason], ['rejected', 'guest_not_visible']);
});

test('the right person, less known, is a marked stretch; all three at the bar is a take', () => {
  assert.equal(guestStanding({ ...base, online_presence: 50, appearances: 40 }).guest_verdict, 'stretch');
  assert.equal(guestStanding(base).guest_verdict, 'take');
});

test('thin evidence is unjudged with no numbers, never a low score', () => {
  const st = guestStanding({ ...base, evidence_thin: true });
  assert.equal(st.guest_verdict, 'unjudged');
  assert.equal(st.guest_score, null);
  assert.equal(st.senior_score, null);
  assert.equal(parseGuestJudgment({ ...base, decision_authority: undefined })?.evidence_thin, true);
  assert.equal(guestStanding(null).guest_verdict, 'unjudged');
});

test('nothing found about them online is not visible, never unjudged (Ruling, Krish, 2026-10-21)', () => {
  const none = parseGuestJudgment({ ...base, online_presence: undefined, appearances: undefined });
  assert.equal(none?.evidence_thin, false);
  const st = guestStanding(none);
  assert.deepEqual([st.guest_verdict, st.guest_reason, st.seen_score], ['rejected', 'guest_not_visible', 0]);
});

test('a thin reply says why, so a run can count it', () => {
  assert.equal(thinCause({ ...base, evidence_thin: true }), 'model');
  assert.equal(thinCause({ ...base, memorability: '70' }), 'missing:memorability', 'a number as text is missing');
  assert.equal(thinCause({ ...base, online_presence: undefined }), null, 'presence is never a reason to be thin');
  assert.equal(thinCause(null), 'no_reply');
  assert.equal(thinCause(base), null);
});

test('wrong show is its own refusal, and every refusal is in the one vocabulary', () => {
  assert.equal(guestStanding({ ...base, show_fit: 'neither' }).guest_reason, 'guest_wrong_show');
  assert.deepEqual([...GUEST_REASONS], ['guest_not_senior', 'guest_not_visible', 'guest_boring', 'guest_wrong_show']);
  for (const j of [{ ...base, decision_authority: 10 }, { ...base, online_presence: 5 }, { ...base, positivity: 5 }, { ...base, show_fit: 'neither' }]) assert.ok(GUEST_REASONS.includes(guestStanding(j).guest_reason));
});

test('a past Signal & Noise guest is never refused for Make Your Mind Up as the wrong show', () => {
  const fitsSN = { ...base, show_fit: 'signal_noise' };
  assert.equal(standingFor(fitsSN, true, 'makeyourmindup').guest_verdict, 'take');
  assert.equal(standingFor(fitsSN, false, 'makeyourmindup').guest_reason, 'guest_wrong_show', 'anyone else is wrong for this brief');
  assert.equal(standingFor({ ...fitsSN, positivity: 20, memorability: 20 }, true, 'makeyourmindup').guest_reason, 'guest_boring');
  assert.equal(standingFor({ ...fitsSN, evidence_thin: true }, false, 'makeyourmindup').guest_verdict, 'unjudged');
});

test('the shares are the ruling, read from the invite stage, and sum to the whole', () => {
  assert.deepEqual(SHOW_SHARES, { makeyourmindup: 70, signal_noise: 30 });
  assert.deepEqual([...SHOW_ORDER], ['makeyourmindup', 'signal_noise']);
  assert.equal(SHOW_ORDER.reduce((a, s) => a + SHOW_SHARES[s], 0), 100);
});

test('a quota splits by share, largest remainder', () => {
  assert.deepEqual(quotaByShare(10), { makeyourmindup: 7, signal_noise: 3 });
  assert.deepEqual(quotaByShare(1), { makeyourmindup: 1, signal_noise: 0 });
  assert.deepEqual(quotaByShare(3), { makeyourmindup: 2, signal_noise: 1 });
  assert.deepEqual(quotaByShare(0), { makeyourmindup: 0, signal_noise: 0 });
  // A stated difference, kept until the switch: the invite stage's weekly split rounds Make Your Mind Up up.
  assert.deepEqual(weeklyInvites(4), quotaByShare(4), 'the same at today\'s four a week');
  assert.notDeepEqual(weeklyInvites(3), quotaByShare(3), 'they part at three a week');
});

const rows = (show, n) => Array.from({ length: n }, (_, i) => ({ show, name: `${show}-${i}` }));

test('any ten in a row is seven and three when both shows have enough', () => {
  const { rows: out, short } = interleaveByShare([...rows('signal_noise', 9), ...rows('makeyourmindup', 21)], r => r.show);
  assert.deepEqual(short, []);
  const first10 = out.slice(0, 10);
  assert.equal(first10.filter(r => r.show === 'makeyourmindup').length, 7);
  assert.equal(first10.filter(r => r.show === 'signal_noise').length, 3);
  assert.equal(out[0].show, 'makeyourmindup', 'the larger share leads');
  assert.deepEqual(out.filter(r => r.show === 'makeyourmindup').map(r => r.name).slice(0, 3), ['makeyourmindup-0', 'makeyourmindup-1', 'makeyourmindup-2']);
});

test('a show that runs dry is named, and the other fills in; rows with no show go last', () => {
  const { rows: out, short } = interleaveByShare([...rows('makeyourmindup', 2), ...rows('signal_noise', 5)], r => r.show);
  assert.equal(out.length, 7);
  assert.deepEqual(short, ['makeyourmindup']);
  assert.deepEqual(interleaveByShare([{ show: 'either', name: 'x' }, ...rows('signal_noise', 1)], r => r.show).rows.map(r => r.name), ['signal_noise-0', 'x']);
  assert.deepEqual(interleaveByShare([{ show: 'constructor', name: 'y' }], r => r.show).rows.map(r => r.name), ['y'], 'a show name is a key, never an inherited property');
});

const guest = (n, over = {}) => ({ id: id(n), contact_id: id(500 + n), name: `Invented Person ${n}`, status: 'scouted', podcast_target: 'makeyourmindup', invite_show: 'makeyourmindup', invite_state: 'proposed', guest_verdict: 'take', guest_score: 70, buried_at: null, recorded_at: null, published_at: null, ...over });

test('guests come forward seven to three by show, takes before stretches within a show', () => {
  const list = [
    ...Array.from({ length: 9 }, (_, i) => guest(100 + i, { invite_show: 'signal_noise', podcast_target: 'signal_noise', guest_score: 90 - i })),
    ...Array.from({ length: 21 }, (_, i) => guest(200 + i, { guest_score: 60 + (i % 5) })),
  ];
  const first10 = rankGuests(list).rows.slice(0, 10);
  assert.equal(first10.filter(g => g.invite_show === 'makeyourmindup').length, 7);
  assert.equal(first10.filter(g => g.invite_show === 'signal_noise').length, 3);
  const s = guest(4, { guest_verdict: 'stretch', guest_score: 95 }), t = guest(5, { guest_verdict: 'take', guest_score: 61 });
  assert.deepEqual(rankGuests([s, t]).rows.map(g => g.id), [t.id, s.id]);
  assert.ok(byStrength(guest(6, { name: 'A', guest_score: null, fit_score: 50 }), guest(7, { name: 'B', guest_score: 40 })) < 0, 'the older fit score stands in for a missing guest score');
});

test('who is ready, and the counts that say why a queue is short', () => {
  const list = [guest(1), guest(2, { guest_verdict: 'stretch' }), guest(3, { invite_state: 'drafted' }), guest(4, { buried_at: '2026-10-01T00:00:00Z' }), guest(5, { guest_verdict: null }), guest(6, { guest_verdict: 'rejected' }), guest(7, { invite_show: 'either' }), guest(8, { guest_verdict: null, status: 'recorded' })];
  assert.deepEqual(list.filter(guestReady).map(g => g.id), [id(1), id(2)]);
  assert.deepEqual(guestCounts(list), { ready: 2, unjudged: 1, refused: 1 });
  assert.equal(approachPath(guest(9, { status: 'recorded', podcast_target: 'signal_noise' })), 'past_guest');
  assert.equal(approachPath(guest(10, { raw_data: { path: 'rich' } })), 'rich');
  assert.equal(approachPath(guest(11, { in_network: true })), 'warm');
  assert.equal(approachPath(guest(12)), 'none');
});

test('how Krish could reach a guest: a warm tier, a past guest, or two sourced pages and a company', () => {
  const c = id(900);
  assert.equal(guestPath({ contactId: null }), 'none');
  assert.equal(guestPath({}), 'none');
  assert.equal(guestPath({ contactId: '  ', networkTier: '1_reciprocated' }), 'none');
  for (const tier of WARM_TIERS) assert.equal(guestPath({ contactId: c, networkTier: tier }), 'warm', tier);
  assert.equal(guestPath({ contactId: c, networkTier: '4_owned_network' }), 'none', 'in the contacts table is not knowing them');
  assert.equal(guestPath({ contactId: c, networkTier: '5_cold_lead' }), 'none');
  assert.equal(guestPath({ contactId: c, networkTier: null }), 'none');
  assert.equal(guestPath({ contactId: c, networkTier: '9_custom' }, ['9_custom']), 'warm', 'the tiers the context names are the ones read');
  assert.equal(guestPath({ pastGuest: true, contactId: null }), 'warm');
  const two = [{ url: 'https://news.example.org/a' }, { url: 'https://talks.example.org/b' }];
  assert.equal(guestPath({ company: 'Example Co', evidence: two }), 'rich');
  assert.equal(guestPath({ company: null, evidence: two }), 'none', 'no company, not enough');
  assert.equal(guestPath({ company: 'Example Co', evidence: [two[0], two[0]] }), 'none', 'one source twice is one source');
  assert.equal(mayDraftPitch('none'), false);
  assert.equal(mayDraftPitch('rich'), true);
  assert.equal(mayStoreGuest('warm'), true);
  assert.equal(mayStoreRow('rich', ''), false, 'a rich stranger with no note is not stored');
  assert.equal(mayStoreRow('rich', 'An invented note.'), true);
  assert.equal(mayStoreRow('warm', null), true);
});

test('the scout ranks by show fit, its source and reach, and judges people with something on record first', () => {
  assert.equal(lensFitScore(null), 0);
  assert.equal(lensFitScore('judgment and taste are the moat'), 1, 'three core terms saturate');
  assert.equal(lensFitScore('some hype'), 0.2);
  assert.equal(isOnDirection('judgment'), true);
  assert.equal(isOnDirection('hype'), false);
  assert.ok(showFit('CEO and founder who shipped agents', 'makeyourmindup') > showFit('CEO and founder who shipped agents', 'signal_noise'));
  assert.equal(showFit('media advertising agency cmo', 'signal_noise'), 0.6);
  const past = { name: 'Invented Person', title: 'CEO', company: 'Example Co', context: 'founder', sourceScore: 0.5, pastGuestId: id(1) };
  const net = { ...past, pastGuestId: null, inNetwork: true }, cold = { ...past, pastGuestId: null };
  assert.ok(scoutScore(past, 'makeyourmindup') > scoutScore(net, 'makeyourmindup'));
  assert.ok(scoutScore(net, 'makeyourmindup') > scoutScore(cold, 'makeyourmindup'));
  assert.ok(scoutScore({ ...past, sourceScore: 9 }, 'makeyourmindup') <= 1, 'capped at one');
  const order = evidenceFirst([
    { c: { name: 'bare past guest', has: false }, score: 0.9 },
    { c: { name: 'researched contact', has: true }, score: 0.6 },
    { c: { name: 'researched stranger', has: true }, score: 0.7 },
  ], c => c.has).map(r => r.c.name);
  assert.deepEqual(order, ['researched stranger', 'researched contact', 'bare past guest']);
  assert.deepEqual([callBudget(7), callBudget(3), MAX_JUDGE_CALLS], [28, 12, 40], 'a show\'s share of the run\'s calls');
});

test('the scout\'s search terms name the show as the canon does and carry no person', () => {
  const terms = scoutTerms(canon, ['An Example Shift']);
  assert.equal(terms[0].label, 'Make Your Mind Up', 'the canon\'s publication name');
  assert.equal(terms[1].label, 'Signal & Noise');
  assert.match(terms[0].web_queries.at(-1), /An Example Shift/, 'a current shift is passed in, never written here');
  assert.equal(scoutTerms(null)[0].web_queries.length, 2);
  assert.equal(scoutTerms(null)[0].label, null, 'no canon read, no name');
  assert.doesNotMatch(JSON.stringify(terms), /linkedin|@|\u2014/i);
});

test('from stored axes the verdict is the same, and a stored row without them is not comparable', () => {
  const st = guestStanding(base);
  assert.deepEqual(standingFromAxes({ senior_score: st.senior_score, seen_score: st.seen_score, spark_score: st.spark_score }), { senior_score: 83, seen_score: 77, spark_score: 80, guest_score: 77, guest_verdict: 'take', guest_reason: null });
  assert.equal(standingFromAxes({ guest_verdict: 'take' }), null, 'not served');
  assert.equal(standingFromAxes({ senior_score: null, seen_score: null, spark_score: null }).guest_verdict, 'unjudged');
  assert.equal(standingFromAxes({ senior_score: 70, seen_score: '50', spark_score: 70 }), null, 'a number as text is not a number');
});

test('in shadow: counts only, Control Center\'s queue beside what the invite stage would do, nothing changed', () => {
  const routes = Object.fromEntries([1, 2, 3, 4, 6].map(n => [id(500 + n), { email: 'verified' }]));
  const context = { routes, feedback: [], records: { guests: [
    guest(1), guest(2, { invite_show: 'signal_noise', podcast_target: 'signal_noise', guest_verdict: 'stretch' }),
    // A past Signal & Noise guest proposed onto Make Your Mind Up: Control Center's first source for that show.
    guest(3, { status: 'recorded', podcast_target: 'signal_noise', recorded_at: '2026-03-04T00:00:00Z' }),
    guest(4, { guest_verdict: 'rejected' }), guest(5), guest(6, { guest_verdict: null }), guest(1),
    guest(7, { senior_score: 83, seen_score: 77, spark_score: 80, guest_verdict: 'take' }),
    guest(8, { senior_score: 83, seen_score: 77, spark_score: 80, guest_verdict: 'rejected' }),
    guest(9, { senior_score: 30, seen_score: 77, spark_score: 80, guest_verdict: 'take' }),
  ] } };
  const frozen = structuredClone(context);
  const out = guestsShadow({ context, canon, at: AT });
  assert.equal(out.line, "Guest standard, in shadow: 9 guests read; agrees with Control Center on 1, differs on 2 (axes_disagree 1, show_fit_not_served 1); 6 not comparable (axes_not_served 5, not_judged 1). Control Center's queue: 6 ready (makeyourmindup 5, signal_noise 1); the invite stage would hold 4 of them (no_email 3, recorded 1).");
  assert.deepEqual(context, frozen, 'the context is read, never changed');
  assert.equal(out.queue[0], `contact:${id(501)}`, 'the queue leads with Make Your Mind Up');
  assert.deepEqual(out.counts, { ready: 6, unjudged: 1, refused: 2 });
  assert.equal(out.source_revision.length, 2);
  assert.doesNotMatch(out.line, /Invented|0000/, 'no name and no id in the line');
});
