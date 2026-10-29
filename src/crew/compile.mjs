/**
 * The week spec, compiled (plan Phase 2; docs/briefs/2026-10-27-bulletproof-growth-engine.md, section 1).
 *
 * One spec per London week, `growth-week/1` (specs/schema/week.schema.json):
 * the lanes on or off, the caps, the fit floor, the assets in play, one
 * experiment and his questions. Krish signs it with one Clear on his list
 * (Ruling, Krish, 2026-10-27: "The week spec is signed Monday morning"), or
 * signs his own version with "Change it first". This module turns a spec
 * into the caps the stages read, inside the bounds config/policy.json owns.
 *
 * - A value outside its bound is refused, never clamped. No spec can change a
 *   bound: the schema has no field for one, and every cap is checked against
 *   policy.json's own.
 * - Zero spend is enforced here: no field may carry an amount, a cost or any
 *   authority, the policy itself must hold none, and the caps carry spend 0.
 * - The default spec is generated from the stages' own exported caps, so it
 *   reproduces today's behaviour exactly.
 * - Which spec is in force: the one he signed for this week, else last week's
 *   signed one (up to 7 days old), else today's settings with `spec_unsigned`.
 * - Caps move by a spec he signs, with one exception: at U3 and above, on a
 *   week with no signed spec in force, src/stages/intensity.mjs lifts the
 *   volume caps config/policy.json's `intensity` names to the top of their
 *   bounds (Ruling, Krish, 2026-10-29: "At U3 to U5, engines and Control
 *   Center may raise volume caps up to each repo's existing policy bounds
 *   without a signed week spec. This is volume only: walls unchanged.").
 *   A signed spec still sets every cap within bounds, and urgency never
 *   overrules it.
 *
 * Pure: the dispatch reads the files and decisions and passes them in. It
 * stores nothing; his signature lives in Control Center's decisions.
 */
import { readFile } from 'node:fs/promises';
import { canonicalJson, payloadDigest, schemaErrors } from '../guards.mjs';
import { LANES, FIT_FLOOR } from '../stages/rows.mjs';
import { PITCH_CAPS } from '../stages/pitches.mjs';
import { PATHS } from '../stages/meetings.mjs';
import { stoppedPlans } from '../stages/momentum.mjs';

export const SPEC_ID = 'growth-week/1';
/** The week spec's proposal id prefix: `gms-<week_of>`. A strategy plan; it never reaches prepare-action (only `gmc-` does). */
export const SPEC_PREFIX = 'gms-';
/** The first week a spec is posted for him to sign (plan section 1: effective Tuesday 10 November). Before it nothing changes. */
export const FIRST_SPEC_WEEK = '2026-11-09';
/** Canonical JSON of a spec is 8,000 characters or fewer, as a proposal's exact words are. */
export const SPEC_MAX = 8000;
/** The lanes in the order the plan writes them. */
export const SPEC_LANES = ['network', 'partners', 'reach_out', 'visibility', 'events'];
export const WEEK_SCHEMA = JSON.parse(await readFile(new URL('../../specs/schema/week.schema.json', import.meta.url), 'utf8'));
const REPO = 'krishanraja/growth-mindmake';

/** Today's caps, read from the stages that own them. The default spec is these, word for word. */
export const DEFAULT_CAPS = Object.freeze({
  rows: Object.freeze(Object.fromEntries(SPEC_LANES.map(l => [l, Object.freeze({ on: LANES[l].on, max: LANES[l].max })]))),
  fit_floor: FIT_FLOOR,
  pitches: Object.freeze({ per_run: PITCH_CAPS.per_run, stage_share: PITCH_CAPS.stage_share, invites_per_run: PITCH_CAPS.invites_per_run, invites_per_week: PITCH_CAPS.invites_per_week, show_shares: Object.freeze({ ...PITCH_CAPS.show_shares }), forms_per_row: PITCH_CAPS.forms_per_row })
});

const clone = v => JSON.parse(JSON.stringify(v));
const MONDAY = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day && new Date(`${day}T12:00:00Z`).getUTCDay() === 1;

/** Last week's counts to confirm: every path null, for him to type; or nothing to ask. */
export const countsAsk = ask => ask ? { good_meetings_total: null, by_path: Object.fromEntries(PATHS.map(p => [p, null])) } : { good_meetings_total: null, by_path: {} };

/** The default spec for a London week: today's caps, no assets, no experiment, no questions. */
export function defaultSpec({ weekOf, northStarSha = null, weekTarget = null, ask = false }) {
  return {
    spec: SPEC_ID, week_of: weekOf,
    compiled: { north_star_sha: northStarSha, week_target: Number.isInteger(weekTarget) ? weekTarget : null, canon: [], week_goals_sha256: null },
    rows: clone(DEFAULT_CAPS.rows), pitches: clone(DEFAULT_CAPS.pitches), fit_floor: DEFAULT_CAPS.fit_floor,
    assets: [], experiment: null, last_week: countsAsk(ask), questions: []
  };
}

/** The same spec with or without last week's counts to confirm. */
export const withCounts = (spec, ask) => ({ ...spec, last_week: countsAsk(ask) });

// Any key that could carry money or authority. The schema already refuses unknown
// fields; this names the refusal, so zero spend is enforced in the compiler itself.
const MONEY = /(spend|cost|usd|amount|budget|price|payment|authority|permission)/i;
function moneyKey(value, path = '$') {
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) { const hit = moneyKey(value[i], `${path}[${i}]`); if (hit) return hit; } return null; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (MONEY.test(k)) return `${path}.${k}`; const hit = moneyKey(v, `${path}.${k}`); if (hit) return hit; }
  return null;
}

/** The policy a spec compiles under must itself carry no send or spend authority, and bound every cap. */
export function policyErrors(policy) {
  const errors = [];
  if (policy?.venture !== 'mindmake') errors.push('the policy is not Mindmake\'s');
  if (policy?.send_authority !== 'none' || policy?.spend_authority !== 'none') errors.push('the policy carries send or spend authority');
  if (policy?.execution?.maximum_cost_usd !== 0) errors.push('the policy allows a cost');
  const perDay = policy?.limits?.jonny_drafts_per_day;
  if (!Number.isInteger(perDay) || perDay < 0 || perDay > PITCH_CAPS.jonny_per_day) errors.push('the policy has no Jonny draft limit inside Control Center\'s ten a day');
  for (const key of BOUND_KEYS) {
    const b = policy?.bounds?.[key];
    if (!b || !Number.isInteger(b.min) || !Number.isInteger(b.max) || b.min > b.max || !['down_is_safer', 'up_is_safer', 'either'].includes(b.direction)) errors.push(`the policy has no whole bound for ${key}`);
  }
  if (Number.isInteger(policy?.bounds?.fit_floor?.min) && policy.bounds.fit_floor.min < FIT_FLOOR) errors.push(`the fit floor's bound is under ${FIT_FLOOR}`);
  if (Number.isInteger(policy?.bounds?.['pitches.per_run']?.max) && Number.isInteger(perDay) && policy.bounds['pitches.per_run'].max > perDay) errors.push('a run could ask for more Jonny drafts than a day takes');
  return errors;
}
export const BOUND_KEYS = ['rows.max', 'fit_floor', 'pitches.per_run', 'pitches.stage_share', 'pitches.invites_per_run', 'pitches.invites_per_week', 'pitches.show_shares.makeyourmindup', 'pitches.show_shares.signal_noise', 'pitches.forms_per_row'];

/** Every cap a spec sets: [bound key, its path in the spec, its value]. */
function capsOf(spec) {
  return [
    ...SPEC_LANES.map(l => ['rows.max', `rows.${l}.max`, spec.rows[l].max]),
    ['fit_floor', 'fit_floor', spec.fit_floor],
    ...['per_run', 'stage_share', 'invites_per_run', 'invites_per_week', 'forms_per_row'].map(k => [`pitches.${k}`, `pitches.${k}`, spec.pitches[k]]),
    ...['makeyourmindup', 'signal_noise'].map(k => [`pitches.show_shares.${k}`, `pitches.show_shares.${k}`, spec.pitches.show_shares[k]])
  ];
}
const boundOf = field => field.startsWith('rows.') ? 'rows.max' : field;
const outside = (b, v) => !Number.isInteger(v) || v < b.min || v > b.max;
const setPath = (obj, path, value) => { const keys = path.split('.'); let o = obj; for (const k of keys.slice(0, -1)) o = o[k]; o[keys.at(-1)] = value; };
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
/** A traffic reading is never an experiment's first measure (plan section 1). */
const TRAFFIC = /(traffic|visit|session|pageview|page_view|utm|analytics)/;

const refuse = (reason, detail) => ({ ok: false, reason, detail });

/**
 * A spec to the caps the stages read, or why it is refused. `weekOf` is the
 * London week it must be for. Refusal reasons: spec_too_long, spec_schema,
 * spec_spend, spec_week, spec_out_of_bounds, policy_unsafe. Pure.
 */
export function compile(spec, policy, { weekOf } = {}) {
  const policyProblems = policyErrors(policy);
  if (policyProblems.length) return refuse('policy_unsafe', `config/policy.json cannot bound a spec: ${policyProblems[0]}.`);
  let text;
  try { text = canonicalJson(spec); } catch { return refuse('spec_schema', 'The spec is not plain JSON.'); }
  if (text.length > SPEC_MAX) return refuse('spec_too_long', `The spec is ${text.length} characters as canonical JSON; a spec is ${SPEC_MAX} or fewer.`);
  const money = moneyKey(spec);
  if (money) return refuse('spec_spend', `The spec names ${money}; a spec carries no amount, cost or authority, and nothing in it can spend.`);
  const errors = schemaErrors(WEEK_SCHEMA, spec);
  if (errors.length) return refuse('spec_schema', `The spec does not fit growth-week/1 (${errors.length} problem${errors.length === 1 ? '' : 's'}, first: ${errors[0]}).`);
  if (!MONDAY(spec.week_of) || (weekOf && spec.week_of !== weekOf)) return refuse('spec_week', `The spec is for the week of ${spec.week_of}, not ${weekOf ?? 'a Monday'}.`);
  for (const [key, path, value] of capsOf(spec)) {
    const b = policy.bounds[key];
    if (outside(b, value)) return refuse('spec_out_of_bounds', `${path} is ${value}; config/policy.json bounds it to ${b.min} to ${b.max}.`);
  }
  const p = spec.pitches;
  if (p.show_shares.makeyourmindup + p.show_shares.signal_noise !== 100) return refuse('spec_out_of_bounds', 'The two shows\' shares must add up to 100.');
  if (p.stage_share > p.per_run || p.invites_per_run > p.per_run) return refuse('spec_out_of_bounds', 'Stages and invites come out of the run\'s Jonny drafts, so neither can be more than per_run.');
  const caps = {
    rows: clone(spec.rows), fit_floor: spec.fit_floor,
    pitches: { ...clone(p), jonny_per_day: policy.limits.jonny_drafts_per_day, lanes: { visibility: spec.rows.visibility.on, events: spec.rows.events.on } },
    assets: clone(spec.assets), spend_usd: 0
  };
  const changes = [];
  if (spec.experiment) {
    const { field, to } = spec.experiment.change;
    const b = policy.bounds[boundOf(field)];
    if (outside(b, to)) return refuse('spec_out_of_bounds', `The experiment sets ${field} to ${to}; config/policy.json bounds it to ${b.min} to ${b.max}.`);
    if (TRAFFIC.test(spec.experiment.measure)) return refuse('spec_schema', 'An experiment\'s first measure is a meeting or a reply, never a traffic reading.');
    setPath(caps, field, to);
    const after = caps.pitches;
    if (after.stage_share > after.per_run || after.invites_per_run > after.per_run) return refuse('spec_out_of_bounds', 'With the experiment, stages or invites would be more than per_run.');
  }
  for (const [key, path] of capsOf(spec)) {
    const now = getPath(caps, path), was = getPath(DEFAULT_CAPS, path);
    if (now === was) continue;
    const dir = policy.bounds[key].direction;
    const safer = dir === 'either' ? null : (dir === 'down_is_safer') === (now < was);
    changes.push(`${path} ${now} (today ${was}${safer === null ? '' : safer ? ', the safer way' : ', a wider setting inside its bound'})`);
  }
  for (const l of SPEC_LANES) if (!caps.rows[l].on) changes.push(`${l.replace('_', ' ')} off`);
  return { ok: true, caps, changes, spend_usd: 0 };
}

/** The stages' own caps, for a policy that cannot bound a spec: today's behaviour, never wider. */
export const STAGE_CAPS = Object.freeze({ rows: DEFAULT_CAPS.rows, fit_floor: DEFAULT_CAPS.fit_floor, pitches: PITCH_CAPS, assets: [], spend_usd: 0 });
/** The caps of today's behaviour, compiled from the default spec; the stages' own when the policy cannot bound one. */
export function todaysCaps(policy, weekOf = FIRST_SPEC_WEEK) {
  const c = compile(defaultSpec({ weekOf }), policy, { weekOf });
  return c.ok ? c.caps : STAGE_CAPS;
}

/** A spec read from its text: parsed, or why it cannot be. */
export function parseSpec(text) {
  if (typeof text !== 'string') return refuse('spec_schema', 'There is no spec text.');
  if (text.length > SPEC_MAX * 4) return refuse('spec_too_long', `The spec text is ${text.length} characters; a spec is ${SPEC_MAX} or fewer as canonical JSON.`);
  try { return { ok: true, spec: JSON.parse(text) }; } catch { return refuse('spec_schema', 'The spec text is not JSON.'); }
}

/**
 * The proposal that asks him to sign a spec: a strategy plan with the spec as
 * its exact words, expiring at the end of its London week, its evidence fixed
 * (the spec file by its blob SHA, or today's settings), so its digest never
 * changes on its own and never asks him twice. Pure.
 */
export function specProposal({ spec, expiresAt, file = null }) {
  const exact = JSON.stringify(spec, null, 2);
  if (exact.length > SPEC_MAX || canonicalJson(spec).length > SPEC_MAX) return { hold: { reason: 'spec_too_long', detail: `The week spec for ${spec.week_of} is longer than ${SPEC_MAX} characters, so it was not posted.` } };
  const counts = spec.last_week.good_meetings_total === null && Object.keys(spec.last_week.by_path).length > 0;
  return { proposal: {
    proposal_id: `${SPEC_PREFIX}${spec.week_of}`,
    title: `Sign the growth spec for the week of ${spec.week_of}${counts ? ", with last week's good meetings" : ''}`,
    why: `One Clear signs this week's lanes and caps, each inside the bounds config/policy.json owns. It carries no send or spend authority. To change a cap${counts ? ', or to type last week\'s good meetings as good_meetings_total and by path (leave a path you do not know as null)' : ''}, press "Change it first". A version outside a bound is not used, and the last signed spec stays in force.${counts ? ' A Clear without your numbers counts no meetings. Counts only, never names.' : ''}`,
    kind: 'prepared', wall: 'strategy', stage: 'plan', parent_proposal_id: null,
    objective_key: 'good_meetings',
    exact_payload: exact,
    evidence: file
      ? [{ label: `The proposed spec, specs/weeks/${spec.week_of}.json, blob ${file.sha}`, url: `https://github.com/${REPO}/blob/main/specs/weeks/${spec.week_of}.json` }]
      : [{ label: "No spec was proposed for this week, so this is today's settings: the stages' caps inside config/policy.json's bounds", url: `https://github.com/${REPO}/blob/main/config/policy.json` }],
    close_condition: { event: 'week_spec_signed', reference: `week:${spec.week_of}` },
    expires_at: expiresAt
  } };
}

/**
 * His signature on the spec for `weekOf`, read from his decisions. A Clear
 * signs the proposal it was made on, so its digest must match one of the
 * proposals this week's spec could have been posted as (`candidates`, each
 * with its payload_sha256). "Change it first" signs his own version, used
 * only after `amended_sha256` is recomputed and the version compiles inside
 * the bounds. Pure.
 */
export function signedSpec({ decisions, weekOf, candidates, policy, digest = payloadDigest }) {
  const d = (Array.isArray(decisions) ? decisions : []).filter(x => x?.proposal_id === `${SPEC_PREFIX}${weekOf}`).sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0];
  if (!d) return { state: 'unsigned' };
  if (d.decision === 'declined') return { state: 'declined' };
  if (d.decision !== 'approved' && d.decision !== 'done') return { state: 'unsigned' };
  if (d.amended === true) {
    const amount = d.amount_usd === undefined ? null : d.amount_usd;
    if (typeof d.exact_payload !== 'string' || typeof d.amended_sha256 !== 'string' || digest({ amount_usd: amount, exact_payload: d.exact_payload }) !== d.amended_sha256) return { state: 'digest_mismatch' };
    if (amount !== null) return { state: 'amended_invalid', reason: 'spec_spend', detail: 'His version carries an amount; a spec spends nothing.' };
    const parsed = parseSpec(d.exact_payload);
    if (!parsed.ok) return { state: 'amended_invalid', reason: parsed.reason, detail: parsed.detail };
    const c = compile(parsed.spec, policy, { weekOf });
    if (!c.ok) return { state: 'amended_invalid', reason: c.reason, detail: c.detail };
    return { state: 'signed', by: 'his version', spec: parsed.spec, compiled: c, decided_at: d.decided_at ?? null };
  }
  const match = (candidates ?? []).find(c => c.proposal.payload_sha256 === d.payload_sha256);
  if (!match) return { state: 'changed' };
  const c = compile(match.spec, policy, { weekOf });
  if (!c.ok) return { state: 'amended_invalid', reason: c.reason, detail: c.detail };
  return { state: 'signed', by: 'his Clear', spec: match.spec, compiled: c, decided_at: d.decided_at ?? null };
}

const NOT_SIGNED = {
  unsigned: 'He has not signed it yet.',
  declined: 'He declined it.',
  changed: 'The spec he signed is not the one proposed now, so his Clear does not carry over.',
  digest_mismatch: "His version's digest did not match its words, so it was not read.",
  amended_invalid: 'His version could not be used.',
  stopped: 'He stopped it with a Purge on its check-in.',
  unread: 'His decisions could not be read this run.'
};
const summary = caps => {
  const on = SPEC_LANES.filter(l => caps.rows[l].on);
  const maxes = [...new Set(on.map(l => caps.rows[l].max))];
  const rows = on.length === SPEC_LANES.length && maxes.length === 1 ? `every row on, ${maxes[0]} a row` : `${on.length ? on.map(l => `${l.replace('_', ' ')} ${caps.rows[l].max}`).join(', ') : 'no row'} on`;
  const p = caps.pitches;
  return `${rows}; fit floor ${caps.fit_floor}; up to ${p.per_run} Jonny drafts a run (stages keep ${p.stage_share}), ${p.invites_per_run} invites a run and ${p.invites_per_week} a week (${p.show_shares.makeyourmindup}/${p.show_shares.signal_noise}); ${p.forms_per_row} forms a row; spend 0.`;
};

/**
 * Which spec is in force this London week, and whether to ask him to sign
 * one. Before FIRST_SPEC_WEEK: today's settings, silently, so nothing
 * changes. From it: this week's signed spec, else last week's (up to 7 days
 * old), else today's settings with the hold `spec_unsigned`; and, until this
 * week's is signed, the `gms-` proposal to sign it.
 *
 * `specFor(week, ask)` gives the spec proposed for a week (a file, or the
 * default) as `{ spec, file }`, or `{ hold }` when the file cannot be used.
 * `finish` turns a proposal into its posted form with its payload_sha256.
 * `ask` is whether this week's spec carries last week's counts to confirm.
 *
 * `source` says where the caps came from: `signed`, `last_signed`, `today`
 * (before the spec era), `default` (his decisions were read and no spec he
 * signed is in force), `unread` (his decisions could not be read), `unsure`
 * (his version of a spec could not be used), `stopped` (he Purged the spec's
 * check-in: it is not in force, last week's does not carry on, and it is not
 * asked again this week) or `unsafe` (the policy cannot bound a spec). Only
 * `default` and `today` let urgency raise volume (src/stages/intensity.mjs).
 * Pure.
 */
export function weekSpec({ weekOf, decisions, policy, specFor, finish, expiresAt, ask = false }) {
  if (weekOf < FIRST_SPEC_WEEK) return { era: false, caps: todaysCaps(policy), source: 'today', post: null, holds: [], lines: [], spec: null };
  const holds = [], lines = [];
  const unsafe = policyErrors(policy);
  if (unsafe.length) {
    holds.push({ reason: 'policy_unsafe', detail: `config/policy.json cannot bound a week spec (${unsafe[0]}), so none is posted or used and the stages' own settings apply.` });
    return { era: true, caps: STAGE_CAPS, source: 'unsafe', post: null, holds, lines, spec: null };
  }
  const candidatesFor = week => {
    const proposed = specFor(week);
    if (!proposed || proposed.hold) return { proposed, list: [] };
    const list = [];
    for (const variant of [ask, !ask]) {
      const spec = withCounts(proposed.spec, variant);
      const made = specProposal({ spec, expiresAt: expiresAt(week), file: proposed.file ?? null });
      if (made.proposal) list.push({ spec, proposal: finish(made.proposal) });
    }
    return { proposed, list };
  };
  const now = candidatesFor(weekOf);
  if (now.proposed?.hold) holds.push(now.proposed.hold);
  // The proposed spec must itself compile, or it is never posted.
  let postable = now.list[0] ?? null;
  if (postable) {
    const c = compile(postable.spec, policy, { weekOf });
    if (!c.ok) { holds.push({ reason: c.reason === 'spec_too_long' ? 'spec_too_long' : 'spec_invalid', detail: `The spec proposed for ${weekOf} cannot be used: ${c.detail}` }); postable = null; }
  } else if (now.proposed && !now.proposed.hold) holds.push({ reason: 'spec_too_long', detail: `The week spec for ${weekOf} is longer than ${SPEC_MAX} characters, so it was not posted.` });
  // A spec whose check-in he Purged is stopped (momentum.mjs stoppedPlans): never in force, never asked again this week.
  const stopped = decisions === null ? new Set() : stoppedPlans(decisions);
  const signedOrStopped = (w, got) => got.state === 'signed' && stopped.has(`${SPEC_PREFIX}${w}`) ? { state: 'stopped' } : got;
  const sig = decisions === null ? { state: 'unread' } : signedOrStopped(weekOf, signedSpec({ decisions, weekOf, candidates: now.list, policy }));
  if (sig.state === 'stopped') holds.push({ reason: 'spec_stopped', detail: `He stopped the spec for ${weekOf} with a Purge on its check-in, so it is not in force and today's settings apply.` });
  if (sig.state === 'signed') {
    lines.push(`Week spec for the week of ${weekOf}: signed by ${sig.by}, in force: ${summary(sig.compiled.caps)}${sig.compiled.changes.length ? ` Changed from today: ${sig.compiled.changes.join(', ')}.` : ''}`);
    return { era: true, caps: sig.compiled.caps, source: 'signed', post: null, holds, lines, spec: sig.spec };
  }
  if (sig.state === 'amended_invalid') holds.push({ reason: sig.reason === 'spec_too_long' ? 'spec_too_long' : 'spec_amended_invalid', detail: `His version of the spec for ${weekOf} was not used: ${sig.detail} The last valid signed spec stays in force.` });
  if (sig.state === 'digest_mismatch') holds.push({ reason: 'amended_digest_mismatch', detail: `His version of the spec for ${weekOf} does not match its digest, so it was not used.` });
  const post = postable && sig.state !== 'declined' && sig.state !== 'stopped' ? postable.proposal : null;
  // Last week's signed spec carries on for up to 7 days.
  const lastWeek = new Date(`${weekOf}T12:00:00Z`); lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const prior = lastWeek.toISOString().slice(0, 10);
  // This week's spec stopped means stop: last week's does not carry on in its place.
  const last = decisions === null || prior < FIRST_SPEC_WEEK || sig.state === 'stopped' ? null : signedOrStopped(prior, signedSpec({ decisions, weekOf: prior, candidates: candidatesFor(prior).list, policy }));
  if (last?.state === 'stopped') holds.push({ reason: 'spec_stopped', detail: `He stopped the spec for ${prior} with a Purge on its check-in, so it does not carry on into ${weekOf}.` });
  if (last?.state === 'signed') {
    lines.push(`Week spec for the week of ${weekOf}: not signed (${NOT_SIGNED[sig.state]}), so the spec he signed for ${prior} stays in force, up to 7 days: ${summary(last.compiled.caps)}`);
    return { era: true, caps: last.compiled.caps, source: 'last_signed', post, holds, lines, spec: last.spec };
  }
  const caps = todaysCaps(policy, weekOf);
  holds.push({ reason: 'spec_unsigned', detail: `No signed week spec is in force for ${weekOf} (${NOT_SIGNED[sig.state]}), so today's settings apply: ${summary(caps)}` });
  lines.push(`Week spec for the week of ${weekOf}: not signed, so today's settings apply.${post ? ' It is on his list to sign.' : ''}`);
  // Known unsigned only when his decisions were read and nothing he signed was unusable or stopped; urgency raises volume only then (intensity.mjs).
  const unsure = s => s === 'amended_invalid' || s === 'digest_mismatch';
  const source = decisions === null ? 'unread' : [sig.state, last?.state].includes('stopped') ? 'stopped' : unsure(sig.state) || unsure(last?.state) ? 'unsure' : 'default';
  return { era: true, caps, source, post, holds, lines, spec: null };
}

/**
 * What the spec in force was written against, beside what this run reads:
 * one activity line for each that moved. For information only, never a gate,
 * so a canon change never unsigns a week (plan section 1). Pure.
 */
export function compiledDrift(spec, { northStarSha, weekGoalsSha, canon } = {}) {
  const c = spec?.compiled ?? {}, lines = [];
  if (northStarSha !== undefined && c.north_star_sha && c.north_star_sha !== northStarSha) lines.push(`The week spec was written against docs/NORTH_STAR.md at ${c.north_star_sha.slice(0, 7)}; it reads ${String(northStarSha).slice(0, 7)} now. For information only: the spec stays signed.`);
  if (weekGoalsSha !== undefined && c.week_goals_sha256 && c.week_goals_sha256 !== weekGoalsSha) lines.push('His week goals changed after the spec was written. For information only: the spec stays signed, and each row still quotes the goal it serves word for word.');
  if (Array.isArray(canon) && Array.isArray(c.canon) && c.canon.length) {
    const now = new Map(canon.map(f => [f.path, f.sha]));
    const moved = c.canon.filter(f => now.has(f.path) && now.get(f.path) !== f.sha).map(f => f.path);
    if (moved.length) lines.push(`Mindmake's canon moved since the spec was written (${moved.join(', ')}). For information only: the rows are written from the canon as it is today, and the spec stays signed.`);
  }
  return lines;
}
