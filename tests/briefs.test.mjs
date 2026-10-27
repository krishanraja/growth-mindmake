import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offerFindings } from '../src/stages/canon.mjs';
import { ccSubjectFor, ccSubjectPart, ccGuestGate, ccTargetGate, ccRoomGate, briefRules, briefsShadow, pitchWords, inviteWords, inviteShow } from '../src/stages/pitches.mjs';
import { canon, AT, id, daysAgo, CC_MINDMAKE_ANGLE } from './support/section12.mjs';

// Mindmake's outreach angle and the People briefs, ported from Control
// Center (plan section 12, M9). Every person, show and id below is invented.
//
// Parity table (Control Center test or source: engine test):
//   tests/api/draftWords.test.ts, the subject says what it is (an invitation,
//     a guest idea, a speaker idea, a question about an event):               the same (ccSubjectFor); Control Center's answers
//                                                                              were also read by running its subjectFor on 27 Oct
//   tests/api/draftWords.test.ts, a long or broken name is one line:          the same (ccSubjectPart), including its cut that can
//                                                                              end on "and"
//   tests/api/draftWords.test.ts, a stage with no name:                       the same
//   tests/api/draftWords.test.ts, signatures, sign-offs and MIME:             left in Control Center (the Gmail draft executor)
//   api/_peopleDraft.ts forGuest, forTarget, forRoom gates (read from code):  the same (ccGuestGate, ccTargetGate, ccRoomGate)
//   api/_peopleDraft.ts the rules each brief hands its model:                 the same words (briefRules); the model call stays
//   api/_venturePositioning.ts, the Mindmake offer:                           not ported: out of date against the canon (below)

test("the subject is set by code, plain, and says what it is (Control Center's answers)", () => {
  assert.equal(ccSubjectFor('guests', { show: 'Make Your Mind Up' }), 'Podcast invitation: Make Your Mind Up with Krish Raja');
  assert.equal(ccSubjectFor('booked', { stage: 'Founder Built', stageType: 'podcast' }), 'Guest idea for Founder Built: Krish Raja');
  assert.equal(ccSubjectFor('booked', { stage: 'The Operators Summit', stageType: 'conference' }), 'Speaker idea for The Operators Summit: Krish Raja');
  assert.equal(ccSubjectFor('rooms', { event: 'The Operators Summit' }), 'Are you going to The Operators Summit?');
  assert.equal(ccSubjectFor('booked', { stage: null }), 'Speaker idea: Krish Raja');
  assert.equal(ccSubjectFor('rooms', { event: null }), 'Are you going?');
  assert.equal(ccSubjectFor('guests', { show: null }), 'Podcast invitation: a conversation with Krish Raja');
  const long = ccSubjectFor('rooms', { event: 'The Very Long Annual Summit of\nOperators, Founders and Everyone Who Builds Things With AI' });
  assert.equal(long, 'Are you going to The Very Long Annual Summit of Operators, Founders and?', "Control Center's own cut, kept as it is");
  assert.ok(!long.includes('\n') && long.length < 90);
  assert.equal(ccSubjectPart('a'.repeat(70)), 'a'.repeat(60), 'no space past the twentieth character: cut at the limit');
});

test('which approach may be drafted at all, by job', () => {
  assert.equal(ccGuestGate({ invite_state: 'proposed', invite_show: 'makeyourmindup' }), true);
  assert.equal(ccGuestGate({ invite_state: 'drafted', invite_show: 'makeyourmindup' }), false, 'no longer waiting to be drafted');
  assert.equal(ccGuestGate({ invite_state: 'proposed', invite_show: 'builder_economy' }), false, 'no show to be invited onto');
  assert.deepEqual(['take', 'stretch', 'rejected', null].map(v => ccTargetGate({ verdict: v })), [true, true, false, false]);
  assert.equal(ccRoomGate({ archived_at: null }, { full_name: 'Avery Example' }), true);
  assert.equal(ccRoomGate({ archived_at: AT }, { full_name: 'Avery Example' }), false, 'that room is gone');
  assert.equal(ccRoomGate({ archived_at: null }, { full_name: ' ' }), false, 'not in the network');
  assert.match(briefRules('guests', { path: 'rich' }), /never pretend familiarity/);
  assert.match(briefRules('booked'), /No attachments, no promises/);
  assert.match(briefRules('rooms'), /No pitch\./);
});

test("Control Center's Mindmake angle is out of date against the canon; the engine's angle is the canon's own ask", () => {
  assert.deepEqual(offerFindings(CC_MINDMAKE_ANGLE, canon.offer), ['retired_offer', 'duration_promise', 'offer_named_otherwise']);
  assert.equal(canon.ask.label, 'Start building your AI brain');
});

const stage = (n, extra = {}) => ({ id: id(n), title: `Example Show ${n}`, type: 'podcast', status: 'sourced', booking_contact_id: id(900 + n), latest_episode_at: daysAgo(5), episodes: 40, verdict: 'take', ...extra });
const guest = (n, extra = {}) => ({ id: id(300 + n), contact_id: id(500 + n), name: `Avery Example${n}`, invite_show: 'makeyourmindup', invite_state: 'proposed', status: 'scouted', guest_verdict: 'take', ...extra });

test('in shadow: both gates, side by side, and whether the subjects are the same words, in counts only', () => {
  const context = {
    routes: { [id(501)]: { email: 'verified' }, [id(502)]: { email: 'none' }, [id(503)]: { email: 'verified' } },
    feedback: [],
    records: {
      visibility: [stage(1), stage(2, { verdict: null }), stage(3, { latest_episode_at: daysAgo(400) }), stage(4, { type: 'conference', verdict: 'stretch' }), stage(5, { type: 'newsletter' }), stage(6, { verdict: 'rejected' }), stage(1)],
      guests: [guest(1), guest(2), guest(3, { invite_state: 'drafted' }), guest(1)],
    },
  };
  const frozen = structuredClone(context);
  const out = briefsShadow({ context, canon, at: AT });
  assert.equal(out.line, 'Outreach briefs, in shadow: 9 stages and guests read; agrees with Control Center on 5, differs on 3 (engine_no_email 1, engine_pitches_unjudged 1, engine_quiet_show 1); 1 not comparable (not_a_pitch_kind 1). Subjects: 3 both would write, 0 in the same words.');
  assert.deepEqual(context, frozen, 'the context is read, never changed');
  assert.doesNotMatch(out.line, /0000|Example|Avery/, 'no id, name or show in the line');
  assert.match(briefsShadow({ context, canon: null, at: AT }).line, /Subjects: the canon was not read this run, so none were compared\.$/);
  // The engine's subjects as they are today, beside Control Center's: different words for the same ask.
  assert.equal(pitchWords({ show: 'Example Show 1', host: null, topic: null, canon }).subject.startsWith('A guest for Example Show 1'), true);
  assert.equal(inviteWords({ name: 'Avery Example1', show: inviteShow('makeyourmindup', canon), page: null }).subject, 'A conversation for Make Your Mind Up');
});
