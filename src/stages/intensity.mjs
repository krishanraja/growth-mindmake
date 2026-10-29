/**
 * Intensity: the gap to the number, and what urgency does to volume (C3).
 *
 * Ruling (Krish, 2026-10-29): "At U3 to U5, engines and Control Center may
 * raise volume caps up to each repo's existing policy bounds without a signed
 * week spec. This is volume only: walls unchanged."
 *
 * - The gap line leads every report's activity: "X of Y, U-n, short by Z",
 *   good meetings against this week's target. Unknown stays unknown: a count
 *   nobody measured is never 0, and an urgency the directive did not send is
 *   never guessed.
 * - At U3 and above, on a week whose caps are today's settings (no spec he
 *   signed is in force), the volume caps config/policy.json's `intensity`
 *   names (`raises`) go to the top of their bounds: rows, guest invites a run
 *   and a week, and forms a row. Nothing else moves: not the fit floor, not
 *   the stage share, not Jonny's ten a day, not a lane's on or off, and never
 *   a wall, a send, a spend or anyone's authority.
 * - A spec he signed (this week's, or last week's carried on) stays as he set
 *   it: he chose those caps inside the same bounds, and urgency never
 *   overrules his signature (src/crew/compile.mjs).
 *
 * - Volume rises only when it is known that no spec he signed is in force
 *   (`default`, or `today` before the spec era). When his decisions could not
 *   be read (`unread`), his version of a spec could not be used (`unsure`),
 *   he stopped the spec with a Purge on its check-in (`stopped`), or the
 *   policy cannot bound a spec (`unsafe`), the caps in force stand: urgency
 *   never guesses past a signature it could not see.
 *
 * Pure: the dispatch passes the caps the week spec compiled, the policy and
 * what the directive and his taps say. It stores nothing.
 */
import { policyErrors } from '../crew/compile.mjs';


/** Urgency from which volume rises to its bounds (Ruling, Krish, 2026-10-29). */
export const RAISE_FROM = 3;
/** The volume caps urgency may raise, and only these: each is a count of drafts or asks, never a wall. */
export const VOLUME_KEYS = Object.freeze(['rows.max', 'pitches.invites_per_run', 'pitches.invites_per_week', 'pitches.forms_per_row']);
/** The line every report leads with, so a reader (and a later run) can find it. */
export const GAP_LINE = /^Gap: /;

/** The week sources on which it is known that no spec he signed is in force: the only ones urgency may raise. */
export const RAISE_ON = Object.freeze(['default', 'today']);
/** Why the caps stand on every other source. */
const STANDS = {
  signed: 'the week spec he signed sets the caps, so they stand as he set them',
  last_signed: 'the week spec he signed sets the caps, so they stand as he set them',
  unread: 'his decisions could not be read, so whether a spec he signed is in force is unknown and the caps in force stand',
  unsure: 'his version of the week spec could not be used, so whether a spec he signed is in force is unknown and the caps in force stand',
  stopped: 'he stopped the week spec with a Purge on its check-in, so volume does not rise past the caps in force',
  unsafe: 'config/policy.json cannot bound a week spec, so the stages\' own settings stand'
};

const whole = v => Number.isInteger(v) && v >= 0 ? v : null;
const clone = v => JSON.parse(JSON.stringify(v));

/**
 * Where the number stands this week: `current` from his taps this week when
 * every meeting was read, else Control Center's own reading of the number when
 * it is a figure, else unknown. Pure.
 */
export function gapOf({ northStar, thisTarget, tapsThisWeek = null }) {
  const target = whole(thisTarget);
  const current = whole(tapsThisWeek) ?? whole(northStar?.current);
  const urgency = Number.isInteger(northStar?.urgency) && northStar.urgency >= 1 && northStar.urgency <= 5 ? northStar.urgency : null;
  const short = target !== null && current !== null ? Math.max(0, target - current) : null;
  return { current, target, urgency, short };
}

const say = v => v === null ? 'unknown' : String(v);
/** The gap line: "X of Y, U-n, short by Z", unknown where it is unknown. Pure. */
export function gapLine(gap, reason = null) {
  const why = gap.current === null && typeof reason === 'string' && reason ? ` (${reason.slice(0, 120)})` : '';
  return `Gap: good meetings ${say(gap.current)} of ${say(gap.target)} this week, ${gap.urgency === null ? 'urgency unknown' : `U${gap.urgency}`}, short by ${say(gap.short)}${why}.`;
}

/** The policy's intensity block, checked: the keys it raises are bound volume caps whose safer move is down. Else null, and nothing rises. Pure. */
export function intensityPolicy(policy) {
  const i = policy?.intensity;
  if (!i || typeof i !== 'object' || !Array.isArray(i.raises) || !Number.isInteger(i.raise_from) || i.raise_from < RAISE_FROM || i.raise_from > 5) return null;
  const raises = i.raises.filter(k => VOLUME_KEYS.includes(k));
  if (raises.length !== i.raises.length) return null;
  for (const k of raises) {
    const b = policy?.bounds?.[k];
    if (!b || !Number.isInteger(b.max) || !Number.isInteger(b.min) || b.direction !== 'down_is_safer') return null;
  }
  if (policy?.send_authority !== 'none' || policy?.spend_authority !== 'none') return null;
  // A policy the week spec would refuse raises nothing either (compile.mjs policyErrors).
  if (policyErrors(policy).length) return null;
  return { raise_from: i.raise_from, raises };
}

/**
 * The caps this run uses. `caps` is what the week spec compiled, `source` where
 * it came from (`signed`, `last_signed`, `default`, `today`, `unread`,
 * `unsure`, `stopped` or `unsafe`). At U3 and above, only on `default` or
 * `today` (RAISE_ON), each volume cap rises to its bound, never past it
 * and never down. Returns the caps, what rose (as `path from to`), and one
 * activity line. Pure.
 */
export function intensify(caps, { urgency, source, policy }) {
  const rule = intensityPolicy(policy);
  if (!Number.isInteger(urgency)) return { caps, raised: [], line: 'Intensity: urgency unknown this run, so volume stays at the caps in force.' };
  if (!rule) return { caps, raised: [], line: `Intensity: U${urgency}, but config/policy.json names no volume it may raise, so the caps in force stand.` };
  if (urgency < rule.raise_from) return { caps, raised: [], line: `Intensity: U${urgency}, under U${rule.raise_from}, so volume stays at the caps in force.` };
  if (!RAISE_ON.includes(source)) return { caps, raised: [], line: `Intensity: U${urgency}, but ${STANDS[source] ?? 'where the caps in force came from is unknown, so they stand'}.` };
  const out = clone(caps), raised = [];
  const lift = (path, now, max, set) => { if (Number.isInteger(now) && now < max) { set(max); raised.push(`${path} ${now} to ${max}`); } };
  for (const key of rule.raises) {
    const max = policy.bounds[key].max;
    if (key === 'rows.max') for (const [lane, l] of Object.entries(out.rows ?? {})) { if (l?.on) lift(`rows.${lane}.max`, l.max, max, v => { l.max = v; }); }
    else {
      const field = key.slice('pitches.'.length);
      // Invites come out of the run's Jonny drafts, so a run's invites never pass per_run (compile.mjs refuses that too).
      const cap = field === 'invites_per_run' ? Math.min(max, out.pitches.per_run) : max;
      lift(key, out.pitches[field], cap, v => { out.pitches[field] = v; });
    }
  }
  const line = raised.length
    ? `Intensity: U${urgency}, so volume rises to config/policy.json's bounds with no signed spec (Ruling, Krish, 2026-10-29): ${raised.join(', ')}. Volume only: the walls, the fit floor and Jonny's ten a day are unchanged.`
    : `Intensity: U${urgency}, and every volume cap is already at its bound.`;
  return { caps: out, raised, line };
}
