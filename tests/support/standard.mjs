/**
 * What Control Center serves beside each verdict it stores (api/_growthContext.ts):
 * a stage's three axes and their score version, and a guest's three axes. Since
 * the engine's version acts (plan section 12, M3 to M5), every stage and the
 * invite stage judge from those axes and never read the stored verdict. A
 * synthetic fixture that names a verdict therefore also carries axes that give
 * the engine the same verdict, so it reads as Control Center serves it.
 *
 * A take's weakest stage axis is 60, so a stage's rank (speakScore) is what it
 * was when its axes were not read. Synthetic only.
 */
export const STAGE = Object.freeze({
  take: Object.freeze({ verdict: 'take', score_version: 1, room_score: 70, standing_score: 70, only_him_score: 60 }),
  stretch: Object.freeze({ verdict: 'stretch', score_version: 1, room_score: 70, standing_score: 45, only_him_score: 60 }),
  rejected: Object.freeze({ verdict: 'rejected', score_version: 1, room_score: 40, standing_score: 70, only_him_score: 60 }),
});

export const GUEST = Object.freeze({
  take: Object.freeze({ guest_verdict: 'take', senior_score: 70, seen_score: 70, spark_score: 70 }),
  stretch: Object.freeze({ guest_verdict: 'stretch', senior_score: 70, seen_score: 50, spark_score: 70 }),
  rejected: Object.freeze({ guest_verdict: 'rejected', senior_score: 70, seen_score: 20, spark_score: 70 }),
});
