/**
 * Control Center's daily dispatch for this engine (growth engine protocol 1.0.0).
 *
 * One run: journal the attempt, read the directive, run the engine dry on what it can read
 * safely, turn its outputs into proposals, report, read the report back, read Krish's
 * decisions and journal the terminal attempt. Nothing here sends, posts, spends, drafts into
 * Gmail or commits an Advisory batch. An approval only means Krish said yes to that exact payload.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { seal } from './guards.mjs';
import { plan } from './orchestrator.mjs';
import { enginePlan } from './engine.mjs';

export const ENGINE_ID = 'growth-mindmake';
export const PRODUCT_SLUG = 'mindmake';
export const SLUG = 'mindmake';
export const TIMEZONE = 'Europe/London';
export const REPORT_SCHEMA = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const DAY = 86400000;
const CODE = /^[a-z][a-z0-9_]{0,63}$/;
const CONTACT = /^[A-Za-z0-9_-]{1,64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;
const HTTPS = /^https:\/\/\S+$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class DispatchError extends Error {
  constructor(code) { super(`Dispatch stopped: ${code}`); this.code = code; }
}

/** Canonical JSON: keys sorted at every depth, no whitespace, arrays in order, strings as JSON.stringify writes them. */
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Canonical JSON has no non-finite numbers'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map(k => { if (value[k] === undefined) throw new Error('Canonical JSON has no undefined values'); return `${JSON.stringify(k)}:${canonicalJson(value[k])}`; }).join(',')}}`;
  throw new Error('Canonical JSON cannot encode this value');
}
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
export const payloadDigest = value => sha256(canonicalJson(value));
/** SHA-256 of the canonical report without its own payload_sha256 field. */
export function reportDigest(report) { const { payload_sha256, ...body } = report; return payloadDigest(body); }

/** Minimal JSON Schema check for the keywords the protocol schema uses. Unknown fields fail. */
export function schemaErrors(schema, value, path = '$') {
  const errors = [];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: value not allowed`);
  if (schema.type !== undefined) {
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const allowed = [].concat(schema.type).some(t => t === kind || (t === 'integer' && Number.isInteger(value)) || (t === 'number' && kind === 'number' && Number.isFinite(value)));
    if (!allowed) { errors.push(`${path}: wrong type`); return errors; }
  }
  if (value === null || value === undefined) return errors;
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: does not match its pattern`);
    if (schema.format === 'date-time' && (!DATE_TIME.test(value) || !Number.isFinite(Date.parse(value)))) errors.push(`${path}: not a date-time`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below its minimum`);
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: too many items`);
    if (schema.items) value.forEach((item, i) => errors.push(...schemaErrors(schema.items, item, `${path}[${i}]`)));
  } else if (typeof value === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}: missing ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && Object.hasOwn(schema.properties, key)) errors.push(...schemaErrors(schema.properties[key], child, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}: unknown field ${key}`);
    }
  }
  return errors;
}

// London calendar. Each boundary is converted on its own, so a week that crosses a clock
// change starts and ends on different offsets.
const londonParts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export function londonDate(at) { const p = Object.fromEntries(londonParts.formatToParts(new Date(at)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; }
export function addDays(day, days) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
const offsetName = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, timeZoneName: 'longOffset' });
function londonOffsetMinutes(instant) {
  const name = offsetName.formatToParts(new Date(instant)).find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (!m) throw new Error('Unexpected London offset');
  return m[1] ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}
/** Local midnight of a London calendar date, as an ISO time with that midnight's own offset. */
export function londonMidnight(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || addDays(day, 0) !== day) throw new Error('Invalid London date');
  const nominal = Date.parse(`${day}T00:00:00Z`);
  let offset = londonOffsetMinutes(nominal);
  offset = londonOffsetMinutes(nominal - offset * 60000);
  const a = Math.abs(offset), pad = n => String(n).padStart(2, '0');
  return `${day}T00:00:00${offset < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
export function londonWeek(at) {
  const today = londonDate(at), weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = addDays(today, -(weekday === 0 ? 6 : weekday - 1));
  return { start, end: addDays(start, 7) };
}

const OUTCOMES_MISSING = 'Control Center does not yet give this engine complete Mindmake outcome records (its global outcome read is still owed), so no count is claimed. A selected contact page or an Advisory booking count is never this number.';
/** Both objectives need complete outcome coverage. Until it exists they are missing, never 0. */
export function objectiveReadings({ at, activatedOn = null }) {
  const week = londonWeek(at);
  const activation = typeof activatedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(activatedOn) && addDays(activatedOn, 0) === activatedOn ? activatedOn : null;
  return [
    { key: 'qualified_conversations', value: null, unit: 'people', window_start: londonMidnight(week.start), window_end: londonMidnight(week.end), timezone: TIMEZONE, availability: 'missing', reason: OUTCOMES_MISSING },
    activation
      ? { key: 'paid_proofs', value: null, unit: 'proofs', window_start: londonMidnight(activation), window_end: londonMidnight(addDays(activation, 30)), timezone: TIMEZONE, availability: 'missing', reason: OUTCOMES_MISSING }
      : { key: 'paid_proofs', value: null, unit: 'proofs', window_start: null, window_end: null, timezone: TIMEZONE, availability: 'missing', reason: `${OUTCOMES_MISSING} The activation date could not be read either.` }
  ];
}

const intOrNull = v => Number.isInteger(v) && v >= 0 ? v : null;
const part = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(keys.map(k => [k, intOrNull(v[k])])) : null;
/** The version this engine sends: 1.2.0 for subject_ref. */
export const SCHEMA_VERSION = '1.2.0';
/** Control Center only ever adds within 1.x, so any 1.x directive is read (ENGINE-PROTOCOL.md, "Versions"). Requiring 1.0.0 exactly stopped every run from 2026-10-19 on directive_invalid. */
const SERVED = /^1\.\d+\.\d+$/;

/** The directive is data from Control Center. It can name a next action; it cannot widen authority. */
export function readDirective(value) {
  const d = value?.directive;
  if (value?.ok !== true || !d || typeof d !== 'object' || typeof d.schema_version !== 'string' || !SERVED.test(d.schema_version) || d.engine_id !== ENGINE_ID || typeof d.directive_id !== 'string' || !d.directive_id.startsWith(`${SLUG}:`) || !d.next_action || typeof d.next_action !== 'object' || !Array.isArray(d.decisions_since) || !Array.isArray(d.objectives)) throw new DispatchError('directive_invalid');
  const counts = d.in_house?.counts;
  return {
    directive_id: d.directive_id,
    chosen_by: value.chosen_by === 'krish' ? 'krish' : 'rule',
    next_proposal_id: typeof d.next_action.proposal_id === 'string' && ID.test(d.next_action.proposal_id) ? d.next_action.proposal_id : null,
    decisions_since: d.decisions_since.filter(x => x && typeof x.proposal_id === 'string' && ['approved','declined'].includes(x.decision)).map(x => ({ proposal_id: x.proposal_id, decision: x.decision, payload_sha256: typeof x.payload_sha256 === 'string' ? x.payload_sha256 : null })),
    in_house: counts && typeof counts === 'object' ? {
      advisory: part(counts.advisory, ['drafted_waiting','sent_this_week','replied_waiting','calls_booked_this_week','paid']),
      network: part(counts.network, ['warm_people']),
      visibility: part(counts.visibility, ['stages_open','applied_this_week','rooms_going'])
    } : null
  };
}
const n = v => v === null ? 'an unknown number of' : String(v);
export function inHouseLines(inHouse) {
  if (!inHouse) return ['Control Center sent no in-house counts for Advisory, Network or Visibility today, so none are assumed.'];
  const { advisory: a, network: w, visibility: v } = inHouse;
  return [
    a ? `Advisory this week: ${n(a.drafted_waiting)} drafted and waiting, ${n(a.sent_this_week)} sent, ${n(a.replied_waiting)} replies waiting, ${n(a.calls_booked_this_week)} calls booked, ${n(a.paid)} paid. Advisory owns those people, so no second note is proposed to anyone it holds.` : 'Advisory counts could not be read this week, so none are assumed and no note is proposed to anyone Advisory may hold.',
    w ? `Network: ${n(w.warm_people)} people on a warm tier.` : 'Network counts could not be read this week.',
    v ? `Visibility this week: ${n(v.stages_open)} stages open, ${n(v.applied_this_week)} applied, ${n(v.rooms_going)} rooms going. No second pitch is proposed to a stage Visibility already pitched.` : 'Visibility counts could not be read this week.'
  ];
}

const cut = (text, max) => { const s = String(text).replace(/\s+/g, ' ').trim(); return s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`; };
function finishProposal(p) {
  const proposal = { amount_usd: null, channel: null, objective_key: null, exact_payload: null, evidence: [], expires_at: null, ...p };
  if (['send','post'].includes(proposal.wall)) {
    if (!proposal.exact_payload || !proposal.channel || !proposal.target) throw new Error('A send or post proposal needs its exact words, channel and target');
    proposal.payload_sha256 = payloadDigest({ channel: proposal.channel, exact_payload: proposal.exact_payload, target: proposal.target });
  } else {
    const { target, ...body } = proposal;
    proposal.payload_sha256 = payloadDigest(body);
  }
  // A note names its recipient by the Control Center contact id it came with, so his list
  // keeps Advisory's, People's or Visibility's copy when they already hold that person.
  if (proposal.wall === 'send' && typeof proposal.target === 'string' && CONTACT.test(proposal.target)) proposal.subject_ref = `contact:${proposal.target}`;
  delete proposal.target;
  return proposal;
}
const OBJECTIVE_FOR = { research_freshness: 'qualified_conversations', permissions_review: 'qualified_conversations', review_prepared: 'qualified_conversations', qualify_held: 'qualified_conversations', paid_proof_next_step: 'paid_proofs', honour_promises: 'qualified_conversations', review_proof_decisions: 'paid_proofs', more_coverage: null };
/** The one grounded improvement: Krish's call is a strategy ruling, engine work stays inside the walls. */
export function improvementProposal(improvement) {
  const ref = improvement.close_condition.reference;
  return finishProposal({
    proposal_id: `gmi-${seal({ kind: improvement.kind }).slice(0, 32)}`,
    title: cut(improvement.title, 160), why: cut(improvement.reason, 1000), kind: 'advice',
    wall: improvement.owner === 'krish' ? 'strategy' : 'none', objective_key: OBJECTIVE_FOR[improvement.kind] ?? null,
    close_condition: { event: improvement.close_condition.kind, reference: cut(`${ref.metric}: ${ref.baseline} to ${ref.target}`, 500) }
  });
}
const MODE_TITLE = { warm: 'Send the prepared warm note', cold: 'Send the prepared named note', follow_up: 'Send the prepared follow-up', intro: 'Ask a connector for permission to introduce' };
/** A prepared note becomes a send proposal with its exact words. Krish sends it himself, or not at all. */
export function recommendationProposal(rec, policy) {
  const exact = `Subject: ${rec.draft.subject}\n\n${rec.draft.body}`;
  if (exact.length > 8000) return { hold: 'payload_too_long' };
  const trigger = rec.evidence.find(e => e.kind === 'trigger');
  return { proposal: finishProposal({
    proposal_id: `gmr-${seal({ contact_id: rec.contact_id, recipient: rec.recipient_contact_id, mode: rec.mode }).slice(0, 32)}`,
    title: cut(`${MODE_TITLE[rec.mode]}: ${rec.draft.subject}`, 160), why: cut(`${rec.why_now} ${rec.why_fit}`, 1000), kind: 'prepared', wall: 'send', channel: 'email',
    objective_key: 'qualified_conversations', exact_payload: exact, target: rec.recipient_contact_id,
    evidence: rec.evidence.slice(0, 12).map(e => ({ label: cut(`${e.kind} source observed ${e.observed_at.slice(0, 10)}`, 500), url: HTTPS.test(e.url) ? e.url : null })),
    close_condition: { event: rec.mode === 'intro' ? 'introduction_permission_requested' : 'outreach_sent', reference: rec.recommendation_id },
    expires_at: trigger ? new Date(Date.parse(trigger.observed_at) + policy.limits.trigger_max_age_days * DAY).toISOString() : null
  }) };
}
const STRATEGY_KINDS = new Set(['qualification_review', 'proof_scope_review', 'paid_proof_delivery_handoff']);
const PAID_KINDS = new Set(['proof_scope_review', 'paid_proof_delivery_handoff']);
/** A full-cycle work item: outward words are send or post, qualification and proof decisions are strategy, the rest is internal prep. */
export function workItemProposal(item) {
  const wall = ['email','linkedin'].includes(item.channel) ? 'send' : item.channel === 'publication' ? 'post' : STRATEGY_KINDS.has(item.kind) ? 'strategy' : 'none';
  const exact = wall === 'none' ? null : item.body;
  if (exact !== null && exact.length > 8000) return { hold: 'payload_too_long' };
  return { proposal: finishProposal({
    proposal_id: `gwp-${seal({ input_id: item.input_id, campaign_id: item.campaign_id, kind: item.kind }).slice(0, 32)}`,
    title: cut(item.title, 160), why: cut(item.internal_notes.slice(0, 2).join(' ') || 'Prepared inside the walls for review.', 1000), kind: 'prepared', wall,
    channel: wall === 'none' ? null : item.channel, objective_key: PAID_KINDS.has(item.kind) ? 'paid_proofs' : ['research_task','research_enrichment','decision_aid'].includes(item.kind) ? null : 'qualified_conversations',
    exact_payload: exact, target: wall === 'send' ? item.recipient_contact_id : wall === 'post' ? item.destination : undefined,
    close_condition: { event: item.closure_event, reference: item.item_id }
  }) };
}

function tally(values) { return [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())].sort(([a], [b]) => a.localeCompare(b)); }
const holdCode = (prefix, reason) => cut(`${prefix}_${CODE.test(reason) ? reason : 'held'}`, 200);

/** Map the engine's dry outputs to proposals and holds, never proposing a note to someone Advisory holds. */
export function proposalsFrom({ batch = null, snapshot = null, work = null, workSnapshot = null, policy }) {
  const proposals = [], holds = [], activity = [];
  const advisory = new Set([...(snapshot?.deals ?? []), ...(workSnapshot?.deals ?? [])].map(d => d.contact_id));
  let withheld = 0;
  const improvement = batch?.report?.dashboard?.recommendations?.[0];
  if (improvement) proposals.push(improvementProposal(improvement));
  for (const rec of batch?.recommendations ?? []) {
    if (advisory.has(rec.recipient_contact_id) || advisory.has(rec.contact_id)) { withheld++; continue; }
    const r = recommendationProposal(rec, policy);
    if (r.hold) holds.push({ reason: r.hold, detail: 'A prepared note is longer than the protocol allows and stays unproposed.' }); else proposals.push(r.proposal);
  }
  for (const item of work?.items ?? []) {
    if (['email','linkedin'].includes(item.channel) && advisory.has(item.recipient_contact_id)) { withheld++; continue; }
    const r = workItemProposal(item);
    if (r.hold) holds.push({ reason: r.hold, detail: 'A prepared item is longer than the protocol allows and stays unproposed.' }); else proposals.push(r.proposal);
  }
  if (withheld) {
    holds.push({ reason: 'advisory_holds_recipient', detail: `${withheld} prepared note${withheld === 1 ? '' : 's'} withheld because Advisory already holds that person. Advisory's own door carries any note to them.` });
    activity.push(`Withheld ${withheld} prepared note${withheld === 1 ? '' : 's'} because Advisory already holds that person.`);
  }
  for (const [reason, count] of tally((batch?.report?.held ?? []).map(h => h.reason))) holds.push({ reason: holdCode('prospect', reason), detail: `${count} prospect${count === 1 ? '' : 's'} on this page held before drafting.` });
  for (const [reason, count] of tally((work?.held ?? []).map(h => h.reason))) holds.push({ reason: holdCode('work', reason), detail: `${count} engine job${count === 1 ? '' : 's'} held.` });
  const unique = [...new Map(proposals.map(p => [p.proposal_id, p])).values()];
  if (unique.length > 10) holds.push({ reason: 'proposal_cap', detail: `${unique.length - 10} more proposal${unique.length - 10 === 1 ? '' : 's'} wait for a later run; a report carries at most 10.` });
  return { proposals: unique.slice(0, 10), holds, activity };
}

/** Build the report envelope exactly as engine-report.schema.json, then check it against that schema. */
export function buildReport({ run_id, mode, observed_at, source, status, objectives, activity, proposals, events = [], holds }) {
  const body = {
    schema_version: SCHEMA_VERSION, engine_id: ENGINE_ID, product_slug: PRODUCT_SLUG, run_id, mode, observed_at, source, status,
    objectives, activity: activity.slice(0, 40).map(line => ({ line: cut(line, 500), evidence_url: null })),
    proposals, events, holds: holds.slice(0, 40).map(h => ({ reason: cut(h.reason, 200), detail: h.detail === null || h.detail === undefined ? null : cut(h.detail, 1000) }))
  };
  const report = { ...body, payload_sha256: reportDigest(body) };
  const errors = schemaErrors(REPORT_SCHEMA, report);
  if (errors.length) throw new DispatchError('report_invalid');
  return report;
}

export function errorCode(error, phase) {
  if (error instanceof DispatchError) return error.code;
  const s = error?.status;
  if (s === 401) return 'unauthorized';
  if (s === 403) return 'forbidden';
  if (s === 409) return error.code === 'engine_inactive' ? 'engine_inactive' : `${phase}_conflict`;
  if (s === 413) return 'report_too_large';
  if (s === 429) return 'rate_limited';
  if (s === 400) return `${phase}_rejected`;
  if (s === 404) return `${phase}_not_found`;
  if (Number.isInteger(s) && s >= 500) return 'server_error';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return `${phase}_unavailable`;
}

/**
 * One dispatch run. `cc` is the protocol client; `source()` reads the bounded snapshot and
 * resolves `{ snapshot }` or `{ hold }`. `context` is an engine context, supplied only for a
 * synthetic run, because the protocol retired the live work-context route.
 */
export async function runDispatch({ cc, source, context = null, policy, registry, mode = 'live', kind = 'dispatch', attemptId, revision = 'unrecorded', wakeDirectiveId = null, clock = () => new Date().toISOString() }) {
  if (!['live','synthetic'].includes(mode) || !/^[a-z][a-z0-9-]{0,40}$/.test(kind) || !/^gma-[A-Za-z0-9-]{8,80}$/.test(attemptId)) throw new Error('Invalid dispatch options');
  const started_at = clock();
  const run_id = `${SLUG}:${londonDate(started_at)}:${kind}`;
  const attempt = { attempt_id: attemptId, command: 'dispatch', run_id, status: 'started', phase: 'directive', error_code: null, started_at };
  const outcome = { run_id, attempt_id: attemptId, mode, journaled: false, report: null, decisions: null, sends: 0, gmail_drafts: 0, advisory_batches: 0 };
  // Journal the start before reading any source, so a failure before the report still shows.
  try { await cc.recordAttempt(attempt); outcome.journaled = true; }
  catch (error) { return { ...outcome, status: error?.status ? 'failed' : 'unknown', error_code: error?.status ? errorCode(error, 'attempt') : 'attempt_unconfirmed' }; }
  let phase = 'directive';
  const finish = async (status, error_code) => {
    const terminal = { ...attempt, phase, status, error_code, finished_at: clock() };
    try { await cc.recordAttempt(terminal); return { ...outcome, status, error_code, journaled: true }; }
    catch { return { ...outcome, status, error_code, journaled: false, terminal_unconfirmed: true }; }
  };
  try {
    const directive = readDirective(await cc.directive());
    let activatedOn = null;
    try { const caps = await cc.capabilities(); activatedOn = typeof caps?.activation?.activated_on === 'string' ? caps.activation.activated_on : null; } catch { activatedOn = null; }
    phase = 'capture';
    const read = await source();
    const snapshot = read?.snapshot ?? null;
    const holds = [], activity = [];
    activity.push(`Read directive ${directive.directive_id}, chosen by ${directive.chosen_by === 'krish' ? 'Krish' : 'rule'}; its next action ${directive.next_proposal_id ? `names proposal ${directive.next_proposal_id}` : 'names no proposal'}.`);
    if (wakeDirectiveId && wakeDirectiveId !== directive.directive_id) activity.push(`The wake-up named directive ${wakeDirectiveId}; the directive read now is ${directive.directive_id}, and the run follows the one it read.`);
    activity.push(...inHouseLines(directive.in_house));
    phase = 'plan';
    const at = clock();
    const today = londonDate(at);
    const launchDate = activatedOn && /^\d{4}-\d{2}-\d{2}$/.test(activatedOn) && activatedOn <= today ? activatedOn : undefined;
    let batch = null, work = null;
    if (snapshot) {
      try {
        batch = plan(snapshot, policy, { at, launchDate });
        activity.push(`Read one snapshot page in dry mode: ${batch.report.examined} prospects examined, ${batch.recommendations.length} notes prepared, ${batch.report.held.length} held before drafting.${snapshot.next_cursor ? ' More prospects exist beyond this page.' : ''}`);
      } catch (error) { holds.push({ reason: 'plan_held', detail: cut(error?.message ?? 'The bounded plan held.', 1000) }); }
    } else holds.push(read?.hold ?? { reason: 'source_unavailable', detail: 'No snapshot was read.' });
    if (context) {
      try {
        work = enginePlan(context, policy, registry, { at, launchDate });
        activity.push(`Ran the full engine cycle dry on ${work.jobs_examined} supplied jobs: ${work.items.length} prepared, ${work.held.length} held.`);
      } catch (error) { holds.push({ reason: 'engine_cycle_held', detail: cut(error?.message ?? 'The full engine cycle held.', 1000) }); }
    } else if (mode === 'live') holds.push({ reason: 'engine_context_route_retired', detail: 'The full engine cycle needs a job context that Control Center no longer serves; the protocol replaced that route. Only the snapshot page is read.' });
    const mapped = proposalsFrom({ batch, snapshot, work, workSnapshot: context?.snapshot ?? null, policy });
    holds.push(...mapped.holds); activity.push(...mapped.activity);
    const current = new Map(mapped.proposals.map(p => [p.proposal_id, p.payload_sha256]));
    const approved = directive.decisions_since.filter(d => d.decision === 'approved');
    activity.push(`Control Center returned ${directive.decisions_since.length} decisions from the last seven days: ${approved.length} approved, ${directive.decisions_since.length - approved.length} declined; ${approved.filter(d => d.payload_sha256 && current.get(d.proposal_id) === d.payload_sha256).length} approvals match a payload in this report.`);
    activity.push('Nothing in this run sent, posted, spent or drafted into Gmail, and no Advisory batch was committed. Krish acts on an approved payload himself.');
    const observed_at = clock();
    const report = buildReport({
      run_id, mode, observed_at, status: !snapshot ? 'degraded' : holds.length ? 'held' : 'ready',
      source: { revision: snapshot && snapshot.source_revision.length <= 128 ? snapshot.source_revision : revision, captured_at: snapshot?.generated_at ?? observed_at },
      objectives: objectiveReadings({ at: observed_at, activatedOn }), activity, proposals: mapped.proposals, holds
    });
    outcome.report = { status: report.status, payload_sha256: report.payload_sha256, proposals: report.proposals.length, walled: report.proposals.filter(p => p.wall !== 'none').length, holds: report.holds.map(h => h.reason), objectives: report.objectives.map(o => ({ key: o.key, availability: o.availability })), replayed: null };
    phase = 'report';
    let ack = null;
    try { ack = await cc.postReport(report); }
    catch (error) {
      // A refusal wrote nothing. A conflict or a lost response is read back, never resent.
      if (error?.status && !(error.status === 409 && error.code !== 'engine_inactive')) return await finish('failed', errorCode(error, 'report'));
      phase = 'readback';
      let stored;
      try { stored = await cc.readReport(run_id); } catch { return await finish(error?.status === 409 ? 'failed' : 'unknown', error?.status === 409 ? 'report_conflict' : 'readback_unconfirmed'); }
      if (stored.payload_sha256 !== report.payload_sha256) return await finish(error?.status === 409 ? 'failed' : 'unknown', error?.status === 409 ? 'report_conflict' : 'readback_unconfirmed');
    }
    outcome.report.replayed = ack ? ack.replayed : null;
    phase = 'readback';
    let stored;
    try { stored = await cc.readReport(run_id); } catch { return await finish('unknown', 'readback_unconfirmed'); }
    if (stored.payload_sha256 !== report.payload_sha256) return await finish('failed', 'readback_mismatch');
    outcome.report.read_back = true;
    phase = 'decisions';
    const decisions = await cc.decisions(new Date(Date.parse(started_at) - 7 * DAY).toISOString());
    const digests = new Map(report.proposals.map(p => [p.proposal_id, p.payload_sha256]));
    outcome.decisions = {
      read: decisions.length,
      approved_matching: decisions.filter(d => d.decision === 'approved' && d.payload_sha256 && digests.get(d.proposal_id) === d.payload_sha256).length,
      approved_changed: decisions.filter(d => d.decision === 'approved' && digests.has(d.proposal_id) && digests.get(d.proposal_id) !== d.payload_sha256).length,
      declined: decisions.filter(d => d.decision === 'declined').length,
      done: decisions.filter(d => d.decision === 'done').length
    };
    return await finish('succeeded', null);
  } catch (error) {
    return await finish('failed', errorCode(error, phase));
  }
}
