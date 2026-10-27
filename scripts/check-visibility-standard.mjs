/**
 * Guards the visibility standard and the guest standard the engine now owns
 * (plan section 12, M3 and M4), ported from Control Center's
 * scripts/check-visibility-standard.mts. Every rule below is one an edit
 * undoes as a convenience, and none of them shows on a card when it breaks.
 *
 * Ported, rule by rule (Control Center's numbering):
 *   1  the standard is a conjunction, proved by arithmetic on its own cases
 *   2  the gates run in order, so a refusal names the reason Krish would give
 *   3  an empty angle, or one feeding neither channel, is generic by construction
 *   4  thin evidence is unjudged with no axes, never a zero
 *   5  every refusal comes from the one taxonomy, and there are at least six
 *   6  the legacy column normalises its two scales, and no engine code reads it raw
 *   7  the stretch cap and the score version agree in both halves
 *   8  the view partitions by verdict, caps the stretch lane, and nothing in
 *      src/ applies a second numeric threshold to the standard
 *   9  the stages that judge never send: no network, no transport, no send route
 *  11  a date is arithmetic
 *  12  the weights still say the sentences their comments claim
 *  and the guest standard's conjunction, its refusals and its floor.
 *
 * Not ported, because they guard Control Center's own surfaces and database,
 * which stay there: rule 4's checks on the scoring route's source, rule 5's
 * SQL constraint and served-surfaces vocabulary, rule 9's empty states on the
 * Worth Taking surface, and rule 10's hook columns.
 *
 *   node scripts/check-visibility-standard.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import {
  computeVisibilityAxes, visibilityVerdict, judgmentFrom, judgeStage, isDeadDate, legacyRelevanceOutOfTen, standardView,
  VISIBILITY_WEIGHTS, VISIBILITY_FLOORS, VISIBILITY_SCORE_VERSION, STRETCH_CAP, REJECT_REASONS,
} from '../src/stages/visibility.mjs';
import { computeGuestAxes, guestStanding, GUEST_FLOORS, GUEST_REASONS } from '../src/stages/guests.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const LIB = 'src/stages/visibility.mjs';
const GUEST_LIB = 'src/stages/guests.mjs';
const JUDGES = ['src/stages/visibility.mjs', 'src/stages/guests.mjs', 'src/stages/rooms.mjs'];
const AT = '2026-10-27T00:00:00.000Z';
const failures = [];
const bad = m => failures.push(m);
const read = p => readFile(resolve(root, p), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
async function walk(dir) { const out = []; for (const e of await readdir(resolve(root, dir), { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) out.push(...await walk(p)); else if (p.endsWith('.mjs')) out.push(p); } return out; }

// 1. The conjunction, proved by arithmetic.
{
  const tradeTitle = { decider_density: 20, practitioner_density: 10, vendor_density: 10, press_density: 85, seniority: 60, platform_standing: 92, platform_reach_quality: 70, angle_ownership: 35 };
  const a = computeVisibilityAxes(tradeTitle);
  if (a.visibility_score !== Math.min(a.room_score, a.standing_score, a.only_him_score)) bad(`${LIB}: visibility_score is not the minimum of the three axes. A mean lets one strong axis carry two weak ones.`);
  if (a.room_score >= VISIBILITY_FLOORS.room) bad(`${LIB}: a room that is 85 percent press scored ${a.room_score}, at or above the room floor.`);
  if (visibilityVerdict(tradeTitle).verdict !== 'rejected') bad(`${LIB}: the trade title with a room of journalists and a generic angle is not refused.`);
  const foundersDinner = { decider_density: 90, practitioner_density: 5, vendor_density: 10, press_density: 0, seniority: 80, platform_standing: 42, platform_reach_quality: 45, angle_ownership: 88, feeds_channel: 'built with ai' };
  if (computeVisibilityAxes(foundersDinner).room_score < VISIBILITY_FLOORS.room) bad(`${LIB}: a room of ninety percent owners scored below the room floor.`);
  if (visibilityVerdict(foundersDinner).verdict !== 'stretch') bad(`${LIB}: the right room and angle on a small platform is not a marked stretch, the slot Krish refined to keep.`);
  const generic = { ...foundersDinner, platform_standing: 80, platform_reach_quality: 80, angle_ownership: 30 };
  const g = visibilityVerdict(generic);
  if (g.verdict !== 'rejected' || g.reject_reason !== 'visibility_no_relevant_talk') bad(`${LIB}: a perfect room with an angle anyone could give is not refused as visibility_no_relevant_talk.`);
}

// 2. The order of the gates.
{
  const paid = { decider_density: 5, practitioner_density: 95, vendor_density: 40, press_density: 0, seniority: 20, platform_standing: 30, platform_reach_quality: 30, angle_ownership: 90, pay_to_play: true };
  if (visibilityVerdict(paid).reject_reason !== 'visibility_pay_to_play') bad(`${LIB}: a bought slot in front of practitioners is not refused as pay-to-play first.`);
  const dead = { decider_density: 95, practitioner_density: 0, vendor_density: 0, press_density: 0, seniority: 90, platform_standing: 95, platform_reach_quality: 90, angle_ownership: 95, dead_date: true };
  if (visibilityVerdict(dead).reject_reason !== 'visibility_bad_timing') bad(`${LIB}: a perfect stage whose date has passed is not refused as visibility_bad_timing.`);
  const technical = { decider_density: 10, practitioner_density: 90, vendor_density: 5, press_density: 0, seniority: 40, platform_standing: 70, platform_reach_quality: 60, angle_ownership: 85 };
  if (visibilityVerdict(technical).reject_reason !== 'visibility_too_technical') bad(`${LIB}: a room of engineers is not refused as visibility_too_technical.`);
  const press = { decider_density: 15, practitioner_density: 5, vendor_density: 5, press_density: 90, seniority: 65, platform_standing: 70, platform_reach_quality: 60, angle_ownership: 85 };
  if (visibilityVerdict(press).reject_reason !== 'visibility_off_vertical') bad(`${LIB}: a room of journalists is not refused as visibility_off_vertical.`);
}

// 3. Generic by construction.
{
  const reply = { decider_density: 90, seniority: 80, angle_ownership: 90, angle: 'His own angle.', feeds_channel: 'built with ai', generic_take: false };
  if (judgmentFrom({ ...reply, feeds_channel: 'neither' }).generic_take !== true) bad(`${LIB}: an angle that feeds neither channel is no longer forced generic.`);
  if (judgmentFrom({ ...reply, angle: '  ' }).generic_take !== true) bad(`${LIB}: an empty angle is no longer forced generic.`);
}

// 4. No evidence is recorded as no evidence.
{
  if (judgmentFrom({ evidence_thin: true }) !== null) bad(`${LIB}: a thin reply no longer returns null; scoring it writes a number the material never supported.`);
  const live = { event_start_at: '2099-01-01T00:00:00Z' };
  const thin = judgeStage(live, { evidence_thin: true }, AT);
  const dead = judgeStage({ event_start_at: '2020-01-01T00:00:00Z' }, { decider_density: 90 }, AT);
  if (thin.verdict !== 'unjudged') bad(`${LIB}: a thin reply is not written unjudged.`);
  for (const [name, r] of [['unjudged', thin], ['dead-date', dead]]) {
    for (const col of ['room_score', 'standing_score', 'only_him_score', 'visibility_score']) if (r[col] !== null) bad(`${LIB}: the ${name} path does not null ${col}.`);
  }
}

// 5. One taxonomy.
{
  const src = strip(await read(LIB));
  const emitted = [...new Set(Array.from(src.matchAll(/refuse\('(visibility_[a-z_]+)'\)/g)).map(m => m[1]))];
  if (emitted.length < 6) bad(`${LIB}: only ${emitted.length} refusal reasons are emitted; the judge has stopped telling the ways a stage is wrong apart.`);
  for (const code of emitted) if (!REJECT_REASONS.includes(code)) bad(`${LIB} emits '${code}', which is not in REJECT_REASONS.`);
}

// 6. The legacy column.
{
  if (legacyRelevanceOutOfTen(9) !== 9) bad(`${LIB}: a 1-10 value of 9 no longer reads as 9.`);
  if (legacyRelevanceOutOfTen(88) !== 8.8) bad(`${LIB}: a 0-100 value of 88 no longer reads as 8.8.`);
  if (legacyRelevanceOutOfTen(null) !== null) bad(`${LIB}: a missing legacy score now returns a number.`);
  for (const f of await walk('src')) {
    if (f === LIB) continue;
    if (/relevance_score/.test(strip(await read(f)))) bad(`${f} reads relevance_score. That column is two scales at once; read the verdict, or the legacy value through legacyRelevanceOutOfTen.`);
  }
}

// 7. The cap and the version agree.
{
  if (STRETCH_CAP !== VISIBILITY_FLOORS.stretchCap) bad(`${LIB}: the view caps the stretch lane at ${STRETCH_CAP} and the floors at ${VISIBILITY_FLOORS.stretchCap}.`);
  if (VISIBILITY_SCORE_VERSION !== 1) bad(`${LIB}: the score version is ${VISIBILITY_SCORE_VERSION}; the rules here port version 1, and a corpus judged under two would be mixed.`);
}

// 8. The view partitions by verdict, caps the stretch lane, and no one else sets a threshold.
{
  const row = (n, verdict) => ({ id: `s${n}`, status: 'queued', score_version: 1, verdict, room_score: 70, standing_score: 40 + n, only_him_score: 80, updated_at: AT });
  const view = standardView([row(1, 'stretch'), row(2, 'stretch'), row(3, 'stretch'), row(4, 'rejected'), row(5, 'take')], AT);
  if (view.stretch.length !== STRETCH_CAP) bad(`${LIB}: the stretch lane is no longer capped.`);
  if (view.refused.length !== 1 || view.take.length !== 1) bad(`${LIB}: the view no longer partitions by verdict.`);
  for (const f of await walk('src')) {
    if (f === LIB) continue;
    if (/visibility_score\s*>=?\s*\d/.test(strip(await read(f)))) bad(`${f} applies its own numeric threshold to visibility_score. The floors live in ${LIB} once.`);
  }
}

// 9. The judges never send.
for (const f of JUDGES) {
  const src = strip(await read(f));
  for (const banned of [/\bfetch\(/, /control-center\.mjs/, /node:(?:http|https|net|child_process)/, /sendMail|messages\.send|\/execute\//]) {
    if (banned.test(src)) bad(`${f} reaches ${banned}. A stage that judges is pure: it reads the context and returns a verdict, and nothing else.`);
  }
}

// 11. A date is arithmetic.
{
  if (!isDeadDate({ event_start_at: '2020-01-01T00:00:00Z' }, AT)) bad(`${LIB}: isDeadDate missed a date in 2020.`);
  if (isDeadDate({ event_start_at: '2099-01-01T00:00:00Z' }, AT)) bad(`${LIB}: isDeadDate called 2099 dead.`);
  if (isDeadDate({ event_start_at: 'not a date' }, AT)) bad(`${LIB}: an unparseable date is treated as passed.`);
  if (isDeadDate({ event_start_at: null, deadline_at: null }, AT)) bad(`${LIB}: a row with no dates is treated as dead.`);
}

// 12. The weights.
{
  const w = VISIBILITY_WEIGHTS;
  if (w.room.decider <= 0) bad(`${LIB}: the room no longer rewards decision-makers.`);
  for (const [k, v] of Object.entries(w.room)) if (k !== 'decider' && k !== 'seniority' && v >= 0) bad(`${LIB}: room weight '${k}' is no longer a penalty.`);
  if (Object.values(w.standing).some(v => v <= 0)) bad(`${LIB}: a standing weight is not positive.`);
  if (VISIBILITY_FLOORS.room <= 50 || VISIBILITY_FLOORS.onlyHim <= 50) bad(`${LIB}: a floor has dropped to 50 or below.`);
  if (VISIBILITY_FLOORS.stretchStanding >= VISIBILITY_FLOORS.standing) bad(`${LIB}: the stretch standing floor is not below the take floor.`);
}

// The guest standard is the same kind of conjunction (Ruling, Krish, 2026-10-20).
{
  const j = { decision_authority: 90, ai_building: 85, online_presence: 90, appearances: 85, positivity: 30, memorability: 25, vendor_voice: true, show_fit: 'makeyourmindup', show_reason: '', evidence_thin: false };
  const a = computeGuestAxes(j);
  if (a.guest_score !== Math.min(a.senior_score, a.seen_score, a.spark_score)) bad(`${GUEST_LIB}: guest_score is not the minimum of senior, seen and spark.`);
  if (guestStanding(j).guest_verdict !== 'rejected') bad(`${GUEST_LIB}: a famous bore passes the guest standard.`);
  const unknown = guestStanding({ ...j, positivity: 85, memorability: 85, vendor_voice: false, online_presence: 10, appearances: 5 });
  if (unknown.guest_verdict !== 'rejected' || unknown.guest_reason !== 'guest_not_visible') bad(`${GUEST_LIB}: someone nobody can find online is not refused as not visible.`);
  const thin = guestStanding({ ...j, evidence_thin: true });
  if (thin.guest_verdict !== 'unjudged' || thin.guest_score !== null) bad(`${GUEST_LIB}: thin evidence is written as a number.`);
  if (GUEST_FLOORS.take <= 50) bad(`${GUEST_LIB}: the take floor has dropped to 50 or below.`);
  for (const c of ['guest_not_senior', 'guest_not_visible', 'guest_boring', 'guest_wrong_show']) if (!GUEST_REASONS.includes(c)) bad(`${GUEST_LIB}: refusal '${c}' is not in GUEST_REASONS.`);
}

if (failures.length) { console.error(failures.map(f => `FAIL: ${f}`).join('\n')); process.exitCode = 1; }
else console.log(`check-visibility-standard: OK (${relative(root, resolve(root, LIB))} and ${GUEST_LIB})`);
