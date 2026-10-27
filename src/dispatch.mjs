/**
 * Control Center's daily dispatch for this engine (additive growth protocol 1.x).
 *
 * One run: journal the attempt, read the directive, run the engine dry on what it can read
 * safely, turn its outputs into proposals, report, read the report back, read Krish's
 * decisions and journal the terminal attempt. The separately guarded shared executor
 * may carry out an exact approved go-live; an uncertain result is never retried.
 */
import { readFile } from 'node:fs/promises';
import { seal, canonicalJson, payloadDigest, schemaErrors } from './guards.mjs';
import { plan } from './orchestrator.mjs';
import { enginePlan } from './engine.mjs';
import { validateStrategicRead, strategicPlan, outcomeScorecard } from './strategy.mjs';
import { readVoice } from './stages/draft.mjs';
import { amplifierRows, rankRows, ROWS, PER_ROW, TITLE_MAX, TITLE_MAX_BRIEF } from './stages/rows.mjs';
import { signalRequests, signalRows } from './stages/signals.mjs';
import { readCanon, readRecord, blobSha, CanonError } from './stages/canon.mjs';
import { pitchRows } from './stages/pitches.mjs';
import { readLadder, ladderTarget, readNorthStar, readConstraints, stopgapProposal, readStopgap, readSpecCounts, goodMeetingsObjective, goodMeetingsLine, bookings, bookingObjectives, bookingLine, visibilityTargets, STOPGAP_PREFIX, MEETINGS_VERSION, meetingsServed, readMeetings, countGood, tappedObjective, tappedLine, originCandidates } from './stages/meetings.mjs';
import { readWeb, trafficLines, bookedHosts } from './stages/traffic.mjs';
import { weekSpec, defaultSpec, parseSpec, compiledDrift, STAGE_CAPS, SPEC_PREFIX, FIRST_SPEC_WEEK } from './crew/compile.mjs';

export const ENGINE_ID = 'growth-mindmake';
export const PRODUCT_SLUG = 'mindmake';
export const SLUG = 'mindmake';
export const TIMEZONE = 'Europe/London';
export const REPORT_SCHEMA = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
/** The weekly ladder Krish set in docs/NORTH_STAR.md, read from the file itself so it never drifts from his number. */
const NORTH_STAR_TEXT = await readFile(new URL('../docs/NORTH_STAR.md', import.meta.url), 'utf8');
export const LADDER = readLadder(NORTH_STAR_TEXT);
/** docs/NORTH_STAR.md by its blob SHA, which a default week spec names as the file it was written against. */
export const NORTH_STAR_SHA = blobSha(NORTH_STAR_TEXT);
/** Campaign plans are the only plans prepare-action may act on (N18). Other plans (`gmg-` and later kinds) are read by their own readers. */
export const CAMPAIGN_PREFIX = 'gmc-';
/** Holds that record a standing ruling or a signature still his to give, rather than a problem with this run; they never make a run read as held. */
const STANDING_HOLDS = new Set(['founder_visibility_open', 'spec_unsigned']);
const DAY = 86400000;
const CODE = /^[a-z][a-z0-9_]{0,63}$/;
const CONTACT = /^[A-Za-z0-9_-]{1,64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;
const HTTPS = /^https:\/\/\S+$/;

export class DispatchError extends Error {
  constructor(code) { super(`Dispatch stopped: ${code}`); this.code = code; }
}

/** The canonical digest and the schema check live in guards.mjs, so the week spec's compiler shares them; they are re-exported here unchanged. */
export { canonicalJson, payloadDigest, schemaErrors } from './guards.mjs';
/** An amended decision's digest, recomputed: SHA-256 of canonical JSON of exactly `{ amount_usd, exact_payload }`, null when absent (ENGINE-PROTOCOL.md). */
export function amendedDigestOk(d) {
  if (typeof d?.amended_sha256 !== 'string' || typeof d.exact_payload !== 'string') return false;
  return payloadDigest({ amount_usd: d.amount_usd === undefined ? null : d.amount_usd, exact_payload: d.exact_payload }) === d.amended_sha256;
}
/** SHA-256 of the canonical report without its own payload_sha256 field. */
export function reportDigest(report) { const { payload_sha256, ...body } = report; return payloadDigest(body); }

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
/** The version this engine sends: 1.2.0 for subject_ref, 1.6.0 once Control Center reads rows, 1.7.0 once it shows their reasons, 1.8.0 once it opens the full card, 1.9.0 once it drafts Jonny's pitches. */
export const SCHEMA_VERSION = '1.2.0';
export const ROWS_VERSION = '1.6.0';
/** 1.7.0: each row carries the line under its title (because) and the brief a tap opens. */
export const BRIEF_VERSION = '1.7.0';
/** 1.8.0: each row carries the full card a tap opens: who, how he knows them, why, what he gets, the angles. */
export const CARD_VERSION = '1.8.0';
/** 1.9.0: a visibility pitch (a podcast) or an events pitch (a stage to speak on) may name Jonny's box; Control Center drafts it there each day with no press. */
export const PITCH_VERSION = '1.9.0';
/** The engine files row words are written from, named in every row's source_revision. */
export const ENGINE_REPO = 'krishanraja/growth-mindmake';
export const WORD_FILES = ['src/stages/rows.mjs', 'src/stages/signals.mjs', 'src/stages/pitches.mjs', 'src/stages/shownotes.mjs'];
const repoRoot = new URL('../', import.meta.url);
export async function engineFiles() {
  return Promise.all(WORD_FILES.map(async path => ({ repo: ENGINE_REPO, path, sha: blobSha(await readFile(new URL(path, repoRoot), 'utf8')) })));
}
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
    // 1.5.0 `taste`: Krish's approved voice rules, for drafting only. Absent reads as unknown, never none.
    voice: readVoice(d.taste),
    // 1.6.0: his goals this week, word for word, so each row says which one it serves.
    week_goals: Array.isArray(d.week_goals) ? d.week_goals.filter(g => typeof g === 'string' && g.trim() && g.length <= 300).slice(0, 10) : [],
    // 1.6.0: Control Center's copy of the rows doctrine, read as data only (N03): the SHA-256 of its canonical JSON and its length, never its words.
    // This engine owns the doctrine (Ruling, Krish, 2026-10-27; plan M10), so the rule never steers a row.
    rows_rule: typeof d.rows_rule === 'string' && d.rows_rule.trim() ? { sha256: payloadDigest(d.rows_rule), length: d.rows_rule.length } : null,
    // 1.4.0: the number, its urgency and the walls' constraints, read as data (N03). They never widen authority.
    north_star: readNorthStar(d),
    constraints: readConstraints(d),
    // 1.10.0: mindmake.co's Google Analytics readings, for the Measurement Specialist's traffic lines. Never an objective.
    web: readWeb(d.web_analytics),
    decisions_since: d.decisions_since.filter(x => x && typeof x.proposal_id === 'string' && ['approved','declined'].includes(x.decision)).map(x => ({ proposal_id: x.proposal_id, decision: x.decision, payload_sha256: typeof x.payload_sha256 === 'string' ? x.payload_sha256 : null })),
    in_house: counts && typeof counts === 'object' ? {
      advisory: part(counts.advisory, ['drafted_waiting','sent_this_week','replied_waiting','calls_booked_this_week','paid']),
      network: part(counts.network, ['warm_people']),
      visibility: part(counts.visibility, ['stages_open','applied_this_week','rooms_going'])
    } : null
  };
}
const n = v => v === null ? 'an unknown number of' : String(v);
/** Says which voice rules drafting receives, as a count. The rules never reach a judge or score. */
export function voiceLine(voice) {
  if (voice.state === 'approved') return `Krish's approved voice rules: ${voice.rules.length} read for the drafting packets of a model drafting step, for how words are written only; today's template drafts do not use them. No judge, score, rank or gate receives them.`;
  if (voice.state === 'none') return "Krish's approved voice rules: none approved yet, so drafting uses none and invents none.";
  return "Krish's approved voice rules could not be read today, so drafting uses none and invents none.";
}
export function inHouseLines(inHouse) {
  if (!inHouse) return ['Control Center sent no in-house counts for Advisory, Network or Visibility today, so none are assumed.'];
  const { advisory: a, network: w, visibility: v } = inHouse;
  return [
    a ? `Advisory this week: ${n(a.drafted_waiting)} drafted and waiting, ${n(a.sent_this_week)} sent, ${n(a.replied_waiting)} replies waiting, ${n(a.calls_booked_this_week)} calls booked, ${n(a.paid)} paid. Advisory owns those people, so no second note is proposed to anyone it holds.` : 'Advisory counts could not be read this week, so none are assumed and no note is proposed to anyone Advisory may hold.',
    w ? `Network: ${n(w.warm_people)} people on a warm tier.` : 'Network counts could not be read this week.',
    v ? `Visibility this week: ${n(v.stages_open)} stages open, ${n(v.applied_this_week)} applied, ${n(v.rooms_going)} rooms going. No second pitch is proposed to a stage Visibility already pitched.` : 'Visibility counts could not be read this week.'
  ];
}

/** A pitch for Jonny's box (1.9.0), which Control Center drafts itself. */
const isPitch = p => { try { return JSON.parse(p.exact_payload ?? '').mailbox === 'jonny'; } catch { return false; } };
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
  // A pitch is about the show it names (target:<id>), not the address it goes to.
  if (proposal.wall === 'send' && typeof proposal.target === 'string' && CONTACT.test(proposal.target) && !proposal.subject_ref) proposal.subject_ref = `contact:${proposal.target}`;
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

/** The campaign plan points back to its native owner. Its first external
 * action is prepared separately only after this plan has been approved. */
export function campaignProposal(campaign) {
  const { first_action, ...strategy } = campaign;
  const nativeSubject = campaign.ref.startsWith('pilot:') ? `contact:${first_action.recipient_contact_id}` : campaign.ref;
  return { ...finishProposal({
    proposal_id: `gmc-${seal({ ref: campaign.ref, reviewed_at: campaign.reviewed_at }).slice(0,32)}`,
    title: cut(campaign.title ?? campaign.argument, 160), why: cut(`${campaign.argument} Commitment: ${campaign.commitment}. Preparation: ${campaign.preparation}`,1000),
    kind: 'prepared', wall: 'strategy', objective_key: 'qualified_conversations',
    exact_payload: JSON.stringify({ ...strategy, first_action }, null, 2),
    stage: 'plan', parent_proposal_id: null,
    evidence: campaign.sources.slice(0,12).map(s => ({ label: cut(s.label ?? 'Campaign evidence',500), url: s.url })),
    close_condition: { event: 'campaign_plan_accepted', reference: campaign.ref },
  }), subject_ref: nativeSubject };
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

const PILOT_REF = /^pilot:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/**
 * Pending campaign plans whose Advisory record Control Center no longer
 * holds: prepare-action would refuse each one forever, so they are taken
 * back (1.10.0 withdrawn). Only when the Advisory records are served
 * complete, never one he decided, never one this run proposes again. Pure.
 */
export function deadPlans(context, proposing = new Set()) {
  const cov = (Array.isArray(context?.coverage) ? context.coverage : []).find(c => c?.source === 'advisory');
  if (!cov || cov.available !== true || cov.complete !== true || !Array.isArray(context?.records?.advisory)) return [];
  const held = new Set(context.records.advisory.map(r => String(r?.id ?? '').toLowerCase()));
  return (Array.isArray(context?.feedback) ? context.feedback : [])
    .filter(f => typeof f?.proposal_id === 'string' && f.proposal_id.startsWith(CAMPAIGN_PREFIX) && f.state === 'pending' && !f.decided_at && !proposing.has(f.proposal_id))
    .filter(f => { const m = PILOT_REF.exec(String(f.reference ?? '')); return m && !held.has(m[1].toLowerCase()); })
    .slice(0, 40)
    .map(f => ({ proposal_id: f.proposal_id, reason: 'Its Advisory record is no longer held, so this plan can never run.' }));
}

/** Build the report envelope exactly as engine-report.schema.json, then check it against that schema. */
export function buildReport({ run_id, mode, observed_at, source, status, objectives, activity, proposals, events = [], holds, schema_version = SCHEMA_VERSION, origin_candidates = null, withdrawn = null }) {
  const body = {
    schema_version, engine_id: ENGINE_ID, product_slug: PRODUCT_SLUG, run_id, mode, observed_at, source, status,
    objectives, activity: activity.slice(0, 40).map(line => ({ line: cut(line, 500), evidence_url: null })),
    proposals, events, holds: holds.slice(0, 40).map(h => ({ reason: cut(h.reason, 200), detail: h.detail === null || h.detail === undefined ? null : cut(h.detail, 1000) })),
    // 1.10.0: where each unanswered meeting came from, only when there is one to say.
    ...(origin_candidates?.length ? { origin_candidates } : {}),
    // 1.10.0: its own pending plans it takes back, only when there is one.
    ...(withdrawn?.length ? { withdrawn } : {})
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

const mergeResearch = (fresh, known) => [...fresh, ...known.filter(r => !fresh.some(f => f.request_id === r.request_id))];

/**
 * The five rows (playbook 11): amplifiers and close ties gone quiet from the
 * context, signals from his buyers through the research desk, every action
 * written from the canon read this run. Live runs ask Control Center to
 * collect (at most two rounds of ten, inside its daily caps); a synthetic run
 * asks for nothing. Counts only leave this function for the printed outcome.
 */
export async function fiveRows({ cc, context, directive, capabilities, mode, at, clock, canonReader = readCanon, wordFiles = engineFiles, recordReader = readRecord, briefs = false, pitches = false, caps = STAGE_CAPS }) {
  // 1.7.0: the title shares the card with the line under it, so it is shorter.
  const titleMax = briefs ? TITLE_MAX_BRIEF : TITLE_MAX;
  const holds = [], activity = [], counts = { prepared: 0, held: 0, research_asked: 0, research_answered: 0 };
  let canon, files;
  try { canon = await canonReader(); files = [...canon.files, ...await wordFiles()]; }
  catch (error) {
    holds.push({ reason: error instanceof CanonError ? error.code : 'canon_unavailable', detail: "Mindmake's canon could not be read from its own repository this run, so no row action was written. Nothing falls back to an older copy." });
    return { proposals: [], holds, activity, counts };
  }
  let ctx = context;
  let research = Array.isArray(ctx.research) ? [...ctx.research] : [];
  // The caps come from the week spec in force (src/crew/compile.mjs): today's unless he signed others.
  const amplifiersFirst = amplifierRows({ context: ctx, weekGoals: directive.week_goals, canon, files, at, titleMax, fitFloor: caps.fit_floor });
  if (mode === 'live' && capabilities?.features?.research === true) {
    // The engine's own asks first (a cited reach, a profile for a card too thin to show), then the signals' collection.
    let pending = [...amplifiersFirst.research, ...signalRequests({ voices: ctx.voices, research, at })].slice(0, 10);
    for (let round = 0; round < 2 && pending.length; round++) {
      try {
        const got = await cc.research(pending);
        counts.research_asked += pending.length;
        counts.research_answered += got.filter(r => r.status === 'answered').length;
        research = mergeResearch(got, research);
      } catch {
        holds.push({ reason: 'research_unavailable', detail: 'Control Center could not run the lookups asked for this run; rows use what was already known.' });
        break;
      }
      pending = signalRequests({ voices: ctx.voices, research, at });
    }
    // Someone filed this run has no routes in the context read before it: read it again once.
    if (research.some(r => r.kind === 'person_route' && r.status === 'answered' && !(ctx.research ?? []).some(x => x.request_id === r.request_id))) {
      try { ctx = validateStrategicRead(await cc.context(), 'context', clock()); research = mergeResearch(research, ctx.research ?? []); }
      catch { holds.push({ reason: 'context_reread_unavailable', detail: 'People found this run get their row on the next run.' }); }
    }
  }
  const amplifiers = ctx === context ? amplifiersFirst : amplifierRows({ context: ctx, weekGoals: directive.week_goals, canon, files, at, titleMax, fitFloor: caps.fit_floor });
  const signals = signalRows({ context: ctx, research, weekGoals: directive.week_goals, canon, files, at, titleMax });
  const { kept, dropped, off } = rankRows([...amplifiers.rows, ...signals.rows], caps.rows);
  // 1.9.0: pitches for Jonny's box, after the rows he presses himself: guests
  // invited onto his own shows and podcasts on visibility, stages to speak on
  // on events. With them, the forms of stages that asked, for his Submit. An
  // older Control Center gets none.
  // 1.10.0: notes asking a booked show for the brief link, only where Control Center drafts them.
  const showNotes = capabilities?.features?.show_notes === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes('1.10.0');
  const pitched = pitches ? pitchRows({ context: ctx, weekGoals: directive.week_goals, canon, record: await recordReader(), files, at, titleMax, caps: caps.pitches, showNotes }) : { proposals: [], held: [], stageHeld: [], inviteHeld: [], formHeld: [], notesHeld: [], jonny: null };
  const isForm = p => p.channel === 'form';
  // A stage that asked leads its row, one tap from done: the people ranked on that row come after its forms (at most two a row).
  const lead = {};
  for (const p of pitched.proposals.filter(isForm)) lead[p.row] = (lead[p.row] ?? 0) + 1;
  const proposals = kept.map(p => finishProposal({ ...p, rank: p.rank + (lead[p.row] ?? 0) }));
  proposals.push(...pitched.proposals.map(finishProposal));
  const isInvite = p => p.close_condition?.reference === 'visibility:invite';
  counts.invites = pitched.proposals.filter(isInvite).length;
  counts.pitches = pitched.proposals.filter(p => p.row === 'visibility' && !isInvite(p) && !isForm(p)).length;
  counts.speaking_pitches = pitched.proposals.filter(p => p.row === 'events' && !isForm(p)).length;
  counts.forms = pitched.proposals.filter(isForm).length;
  counts.prepared = proposals.length;
  for (const [reason, count] of tally(pitched.notesHeld ?? [])) holds.push({ reason: holdCode('notes', reason), detail: `${count} booked show${count === 1 ? '' : 's'} not asked for the brief link today: ${reason.replace(/_/g, ' ')}.` });
  for (const [reason, count] of tally(pitched.inviteHeld ?? [])) holds.push({ reason: holdCode('invite', reason), detail: `${count} guest${count === 1 ? '' : 's'} not invited today: ${reason.replace(/_/g, ' ')}.` });
  for (const [reason, count] of tally(pitched.held)) holds.push({ reason: holdCode('pitch', reason), detail: `${count} podcast${count === 1 ? '' : 's'} not pitched today: ${reason.replace(/_/g, ' ')}.` });
  for (const [reason, count] of tally(pitched.stageHeld ?? [])) holds.push({ reason: holdCode('speak', reason), detail: `${count} stage${count === 1 ? '' : 's'} to speak on not pitched today: ${reason.replace(/_/g, ' ')}.` });
  for (const [reason, count] of tally(pitched.formHeld ?? [])) holds.push({ reason: holdCode('form', reason), detail: `${count} stage form${count === 1 ? '' : 's'} not filled today: ${reason.replace(/_/g, ' ')}.` });
  const held = [...amplifiers.held, ...signals.held];
  counts.held = held.length;
  for (const [reason, count] of tally(held)) holds.push({ reason: holdCode('row', reason), detail: `${count} possible row action${count === 1 ? '' : 's'} held: ${reason.replace(/_/g, ' ')}.` });
  const sixEach = ROWS.every(r => caps.rows[r]?.max === PER_ROW);
  if (dropped) holds.push({ reason: 'row_per_row_cap', detail: `${dropped} more row action${dropped === 1 ? '' : 's'} ranked below ${sixEach ? 'the six a row shows' : "the cap the week's spec sets for its row"}.` });
  if (off) holds.push({ reason: 'row_lane_off', detail: `${off} possible row action${off === 1 ? '' : 's'} on a row the week's spec turned off.` });
  activity.push(`Rows from Mindmake's canon as it is today (${canon.files.map(f => f.sha.slice(0, 7)).join(', ')}): ${ROWS.map(r => `${proposals.filter(p => p.row === r && !isPitch(p) && !isForm(p)).length} ${r.replace('_', ' ')}`).join(', ')}.`);
  if (pitches) activity.push(`Pitches for Jonny's Gmail: ${counts.invites} guests invited onto his shows, ${counts.pitches} podcasts, ${counts.speaking_pitches} stages to speak on.`);
  if (pitches) activity.push(`Forms for his tap: ${counts.forms} stage${counts.forms === 1 ? '' : 's'} asked through their own form, every answer written; only his Submit sends one.`);
  if (counts.research_asked) activity.push(`Asked Control Center for ${counts.research_asked} lookups; ${counts.research_answered} answered.`);
  // Control Center drafts ten a day into Jonny's Gmail; a wake later the same day writes only what is left.
  if (pitched.jonny?.used) activity.push(`Jonny's Gmail already holds ${pitched.jonny.used} draft${pitched.jonny.used === 1 ? '' : 's'} made today, so this run writes at most ${pitched.jonny.room} more.`);
  return { proposals, holds, activity, counts, canonFiles: canon.files };
}

/**
 * One dispatch run. `cc` is the protocol client; `source()` reads the bounded snapshot and
 * resolves `{ snapshot }` or `{ hold }`. `context` is an engine context, supplied only for a
 * synthetic run, because the protocol retired the live work-context route.
 */
/**
 * Why a read failed, as a class and never a body: the HTTP status and code
 * Control Center answered, an answer over the byte budget, or a read that
 * did not hold together. The run report carries it, so the next run's
 * failure is named rather than guessed.
 */
export function failureClass(e) {
  if (Number.isInteger(e?.status)) return `Control Center answered ${e.status}${typeof e.code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(e.code) ? ` ${e.code}` : ''}`;
  if (e?.code === 'response_over_budget') return 'the answer was larger than the byte budget';
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'Control Center did not answer in time';
  if (/invalid JSON|non-JSON/.test(String(e?.message))) return 'the answer was not JSON';
  if (/^Invalid (context|outcomes) read$/.test(String(e?.message))) return 'the answer did not hold together';
  return 'the engine could not plan from it';
}

/** A proposed week spec, specs/weeks/<monday>.json, as its text; null when none was proposed for that week. */
export async function readSpecFile(week) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return null;
  try { return await readFile(new URL(`../specs/weeks/${week}.json`, import.meta.url), 'utf8'); }
  catch (e) { if (e?.code === 'ENOENT') return null; throw e; }
}

export async function runDispatch({ cc, source, context = null, policy, registry, mode = 'live', kind = 'dispatch', attemptId, revision = 'unrecorded', wakeDirectiveId = null, clock = () => new Date().toISOString(), canonReader = readCanon, wordFiles = engineFiles, recordReader = readRecord, ladder = LADDER, specReader = readSpecFile, northStarSha = NORTH_STAR_SHA }) {
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
    if (mode === 'live') {
      // A restarted daily run reuses its already accepted report. It must not
      // prepare new bytes or re-execute actions under that same run identity.
      phase = 'recovery';
      let previous = null;
      try { previous = await cc.readReport(run_id); }
      catch (e) { if (e.status !== 404) throw e; }
      if (previous) {
        if (previous.report?.engine_id !== ENGINE_ID || previous.report.mode !== mode || previous.report.run_id !== run_id || reportDigest(previous.report) !== previous.payload_sha256) throw new DispatchError('recovery_report_mismatch');
        outcome.report = { status: previous.report.status, payload_sha256: previous.payload_sha256, proposals: previous.report.proposals.length, holds: previous.report.holds.map(h=>h.reason), read_back: true, replayed: true };
        return await finish('succeeded',null);
      }
    }
    let activatedOn = null, capabilities = null;
    try { capabilities = await cc.capabilities(); activatedOn = typeof capabilities?.activation?.activated_on === 'string' ? capabilities.activation.activated_on : null; } catch { activatedOn = null; }
    phase = 'capture';
    const read = capabilities?.features?.context ? {} : await source();
    const snapshot = read?.snapshot ?? null;
    const holds = [], activity = [];
    // His decisions, read once before planning: the Monday ask's answer and the approved plans both come from here.
    let decisionsRead = null;
    try { decisionsRead = await cc.decisions(new Date(Date.parse(started_at) - 30 * DAY).toISOString()); }
    catch (e) { holds.push({ reason: 'decisions_unavailable', detail: `Krish's decisions could not be read before planning (${failureClass(e)}); no answer is assumed.` }); }
    // HeyGen outbound waits on the open founder-visibility ruling (docs/briefs/2026-10-22-heygen-outbound.md; N10).
    holds.push({ reason: 'founder_visibility_open', detail: 'Avatar-led outbound waits on the open founder-visibility ruling; growth-makeyourmindup asks it, so no duplicate question is raised here.' });
    let strategic = null, outcomes = null, strategicSource = null, liveWorkContext = null, suppliedContext = null;
    if (capabilities?.features?.context) {
      try {
        const supplied = validateStrategicRead(await cc.context(), 'context', clock());
        suppliedContext = supplied;
        strategicSource = { revision: supplied.source_revision ?? payloadDigest(supplied.records), captured_at: supplied.observed_at };
        liveWorkContext = supplied.work_context ?? null;
        strategic = strategicPlan(supplied, { at: clock(), capacity: policy.limits.recommendations_per_run, allocation: policy.acquisition });
        holds.push(...strategic.held);
        for (const coverage of supplied.coverage.filter(c => !c.available)) holds.push({ reason: 'context_source_unavailable', detail: `${coverage.source} is unread; no empty result is assumed.` });
        activity.push(`Read cross-channel context from ${supplied.coverage.length} native sources. Selected ${strategic.selected.length} complete relationship campaigns; existing records retain the words and action.`);
        for (const c of strategic.selected) activity.push(`${c.motion}: ${c.argument} Next: ${c.commitment}. Owner ${c.owner}; record ${c.record_id}.`);
        activity.push(`Weekly strategic review ${strategic.review.id}: ${strategic.review.experiment}`);
        for (const task of strategic.research) activity.push(`Network research ${task.contact_id}: verify a ${task.motion} route. This is research preparation, not outreach authority.`);
        if (!strategic.selected.length) holds.push({ reason: 'complete_campaign_needed', detail: 'No current complete campaign passed the route, proof and preparation gates. Native drafts stay preserved.' });
      } catch (e) { holds.push({ reason: 'context_read_unavailable', detail: `The advertised cross-channel context could not be validated (${failureClass(e)}).` }); }
    }
    if (capabilities?.features?.outcomes) {
      try { outcomes = validateStrategicRead(await cc.outcomes(), 'outcomes', clock()); }
      catch (e) { holds.push({ reason: 'outcomes_read_unavailable', detail: `Complete outcome windows could not be validated (${failureClass(e)}); no counts are assumed.` }); }
    }
    activity.push(`Read directive ${directive.directive_id}, chosen by ${directive.chosen_by === 'krish' ? 'Krish' : 'rule'}; its next action ${directive.next_proposal_id ? `names proposal ${directive.next_proposal_id}` : 'names no proposal'}.`);
    if (wakeDirectiveId && wakeDirectiveId !== directive.directive_id) activity.push(`The wake-up named directive ${wakeDirectiveId}; the directive read now is ${directive.directive_id}, and the run follows the one it read.`);
    activity.push(...inHouseLines(directive.in_house));
    activity.push(voiceLine(directive.voice));
    if (directive.rows_rule) activity.push(`Control Center's rows rule was read as data only (sha256 ${directive.rows_rule.sha256.slice(0, 12)}, ${directive.rows_rule.length} characters): the rows follow this engine's own doctrine and the week spec, never a rule Control Center holds.`);
    outcome.voice = { state: directive.voice.state, approved: directive.voice.rules.length };
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
    } else if (!strategic) holds.push(read?.hold ?? { reason: 'source_unavailable', detail: 'No snapshot was read.' });
    const producerContext = context ?? liveWorkContext;
    if (producerContext) {
      try {
        work = enginePlan(producerContext, policy, registry, { at, launchDate });
        activity.push(`Ran the full engine cycle dry on ${work.jobs_examined} supplied jobs: ${work.items.length} prepared, ${work.held.length} held.`);
      } catch (error) { holds.push({ reason: 'engine_cycle_held', detail: cut(error?.message ?? 'The full engine cycle held.', 1000) }); }
    } else if (mode === 'live') holds.push({ reason: 'engine_context_unavailable', detail: 'The shared protocol does not provide a usable complete selected-job context. No full producer coverage is claimed.' });
    const mapped = proposalsFrom({ batch, snapshot, work, workSnapshot: producerContext?.snapshot ?? null, policy });
    if (strategic) {
      // A plan longer than the protocol allows is held, never thrown, so one long plan cannot fail the whole report (N16).
      const plans = strategic.selected.map(campaignProposal);
      const fits = plans.filter(p => (p.exact_payload ?? '').length <= 8000);
      if (fits.length < plans.length) holds.push({ reason: 'payload_too_long', detail: `${plans.length - fits.length} campaign plan${plans.length - fits.length === 1 ? ' is' : 's are'} longer than the protocol allows and stay${plans.length - fits.length === 1 ? 's' : ''} unproposed.` });
      mapped.proposals = [...mapped.proposals, ...fits].slice(0, policy.limits.recommendations_per_run);
    }
    // Every execution field gates the executor and can only narrow it: email only, no assets, zero cost, a receipt.
    if (mode === 'live' && capabilities?.features?.exact_actions && policy.execution?.authority === 'exact_approval' && policy.execution.maximum_cost_usd === 0 && policy.execution.require_independent_receipt === true && policy.execution.assets === false && Array.isArray(policy.execution.channels) && policy.execution.channels.includes('email')) {
      phase = 'prepare_action';
      const decisions = decisionsRead ?? await cc.decisions(new Date(Date.parse(started_at)-30*DAY).toISOString());
      // Only campaign plans reach prepare-action (N18). The pending 22 October route plans are campaign plans (gmc-), so none is stranded.
      for (const decision of decisions.filter(d => d.decision === 'approved' && d.stage === 'plan' && typeof d.proposal_id === 'string' && d.proposal_id.startsWith(CAMPAIGN_PREFIX))) {
        try {
          // His amended version is acted on only after its digest is recomputed (N15).
          if (decision.amended === true && !amendedDigestOk(decision)) { holds.push({ reason: 'amended_digest_mismatch', detail: "An approved plan's amended version does not match its digest, so it was not acted on." }); continue; }
          const prepared = await cc.prepareAction(decision.proposal_id);
          if (prepared?.ok === true && prepared.prepared?.parent_proposal_id === decision.proposal_id && prepared.prepared.completed === true) {
            mapped.proposals = mapped.proposals.filter(p=>p.proposal_id !== decision.proposal_id); continue;
          }
          if (prepared?.ok === true && prepared.prepared?.parent_proposal_id === decision.proposal_id && prepared.prepared.existing_proposal) {
            const existing = prepared.prepared.existing_proposal;
            if (existing.stage !== 'go_live' || existing.parent_proposal_id !== decision.proposal_id || existing.wall !== 'send') throw new Error('Existing action invalid');
            mapped.proposals = mapped.proposals.filter(p=>p.proposal_id !== decision.proposal_id);
            mapped.proposals.unshift(existing); continue;
          }
          const a = prepared?.prepared?.action;
          if (prepared.ok !== true || prepared.prepared.parent_proposal_id !== decision.proposal_id || payloadDigest(a) !== prepared.prepared.payload_sha256 || a.cost_usd !== 0 || !Array.isArray(a.assets) || a.assets.length || a.channel !== 'email') throw new Error('Invalid prepared action');
          mapped.proposals = mapped.proposals.filter(p=>p.proposal_id !== decision.proposal_id);
          mapped.proposals.unshift({ proposal_id: `gma-${payloadDigest(a).slice(0,32)}`, title: cut(`Review the exact email: ${a.subject}`,160), why: 'The campaign plan is approved. This approval binds this recipient, email, full wording, no assets, zero cost and the stated time window.', kind: 'prepared', wall: 'send', amount_usd: 0, channel: 'email', objective_key: 'qualified_conversations', exact_payload: JSON.stringify(a,null,2), payload_sha256: payloadDigest(a), evidence: [], expires_at: a.expires_at, stage: 'go_live', parent_proposal_id: decision.proposal_id, subject_ref: `contact:${a.recipient_contact_id}`, close_condition: { event: 'external_action_verified', reference: a.source_ref } });
        } catch { holds.push({ reason: 'approved_plan_preparation_blocked', detail: 'The approved plan changed, its proof or recipient is unavailable, or no supported execution route exists. No action is inferred.' }); }
      }
      phase = 'execute_action';
      for (const decision of decisions.filter(d => d.decision === 'approved' && d.stage === 'go_live')) {
        try {
          let receipt;
          try { receipt = await cc.actionReceipt(decision.proposal_id); }
          catch (e) { if (e.status !== 404) throw e; receipt = null; }
          if (!receipt) receipt = await cc.executeAction(decision.proposal_id);
          else if (receipt.receipt?.state === 'submitted') receipt = await cc.reconcileAction(decision.proposal_id);
          if (decision.amended === true && !amendedDigestOk(decision)) throw new Error('Amended digest does not verify');
          const expectedDigest = decision.amended === true ? decision.amended_sha256 : decision.payload_sha256;
          if (receipt?.receipt?.state !== 'verified' || !receipt.receipt.provider_id || receipt.receipt.payload_sha256 !== expectedDigest) throw new Error('Receipt not verified');
          activity.push(`Approved external action ${decision.proposal_id} has an independently verified provider receipt.`);
          mapped.proposals = mapped.proposals.filter(p=>p.proposal_id !== decision.proposal_id);
          outcome.sends++;
        } catch { holds.push({ reason: 'external_action_unverified', detail: 'The connector is blocked, the exact approval no longer matches, or delivery needs reconciliation. No resend or completion is assumed.' }); }
      }
      mapped.proposals = mapped.proposals.slice(0,10);
    }
    // The number (docs/NORTH_STAR.md): last week's good meetings. From his taps once Control Center
    // serves each meeting he held (1.10.0); until then from the Monday ask.
    const thisWeek = londonWeek(at), lastWeek = { start: addDays(thisWeek.start, -7), end: thisWeek.start };
    const due = ladder.length > 0 && lastWeek.start >= ladder[0][0];
    const thisTarget = directive.north_star.week_target ?? ladderTarget(ladder, thisWeek.start);
    const targetSource = directive.north_star.week_target !== null ? "Control Center's refresh" : 'the ladder in docs/NORTH_STAR.md';
    const tapped = suppliedContext && meetingsServed(capabilities) ? readMeetings(suppliedContext) : null;
    const taps = tapped?.state === 'served' ? tapped : null;
    // The week spec (plan Phase 2), read from his decisions before compilation and rows. From the week of
    // 9 November it carries last week's counts to confirm while his taps are not served: one Monday ask.
    const ask = due && !taps;
    const specTexts = {};
    if (thisWeek.start >= FIRST_SPEC_WEEK) for (const w of [thisWeek.start, addDays(thisWeek.start, -7)]) { try { specTexts[w] = await specReader(w); } catch { specTexts[w] = { unreadable: true }; } }
    const specFor = w => {
      const text = specTexts[w] ?? null;
      if (text === null) return { spec: defaultSpec({ weekOf: w, northStarSha, weekTarget: ladderTarget(ladder, w) }) };
      if (typeof text !== 'string') return { hold: { reason: 'spec_unreadable', detail: `specs/weeks/${w}.json could not be read, so it is neither posted nor used.` } };
      const parsed = parseSpec(text);
      if (!parsed.ok) return { hold: { reason: parsed.reason === 'spec_too_long' ? 'spec_too_long' : 'spec_invalid', detail: `specs/weeks/${w}.json: ${parsed.detail}` } };
      return { spec: parsed.spec, file: { sha: blobSha(text) } };
    };
    const week = weekSpec({ weekOf: thisWeek.start, decisions: decisionsRead, policy, specFor, finish: finishProposal, expiresAt: w => londonMidnight(addDays(w, 7)), ask });
    let answer = null, goodObjective, origin_candidates = null;
    if (taps) {
      const count = countGood(taps.meetings, lastWeek, londonDate);
      goodObjective = tappedObjective({ read: taps, count, lastWeek, midnight: londonMidnight, timezone: TIMEZONE });
      activity.push(tappedLine({ read: taps, count, lastWeekOf: lastWeek.start, lastTarget: ladderTarget(ladder, lastWeek.start), thisTarget, targetSource, northStar: directive.north_star }));
      origin_candidates = originCandidates({ meetings: taps.meetings, context: suppliedContext });
      const open = new Set(taps.meetings.filter(m => m.good === null && m.origin_path === null).map(m => m.contact_id)).size;
      activity.push(`Where his meetings came from: ${origin_candidates.length} of the ${open} ${open === 1 ? 'person' : 'people'} in an unanswered meeting ${origin_candidates.length === 1 ? 'has' : 'have'} a path from the engine's records; the rest are recorded as unknown at his tap.`);
      if (taps.dropped) holds.push({ reason: 'meetings_unreadable', detail: `${taps.dropped} held meeting${taps.dropped === 1 ? '' : 's'} in the context did not parse, so the number is not claimed.` });
    } else {
      const viaAsk = !due ? { state: 'not_due' } : decisionsRead ? readStopgap(decisionsRead, lastWeek.start, payloadDigest) : { state: 'unread' };
      const viaSpec = week.era && ask ? (decisionsRead ? readSpecCounts(decisionsRead, thisWeek.start, payloadDigest, SPEC_PREFIX) : { state: 'unread' }) : null;
      // Folded into the week spec when it is on his list or he has answered it; otherwise the Monday ask stands.
      const folded = Boolean(viaSpec) && (week.post !== null || viaSpec.state !== 'unanswered');
      answer = folded ? ([viaSpec, viaAsk].find(a => a.state === 'counted') ?? (viaSpec.state !== 'unanswered' ? viaSpec : viaAsk)) : viaAsk;
      if (!folded && due && (answer.state === 'unanswered' || answer.state === 'unread')) mapped.proposals.unshift(finishProposal(stopgapProposal({ weekOf: lastWeek.start, expiresAt: londonMidnight(thisWeek.end), target: ladderTarget(ladder, lastWeek.start) })));
      if (answer === viaAsk && answer.state === 'digest_mismatch') holds.push({ reason: 'amended_digest_mismatch', detail: "The Monday ask's amended answer does not match its digest, so it was not counted." });
      activity.push(goodMeetingsLine({ answer, lastWeekOf: lastWeek.start, lastTarget: ladderTarget(ladder, lastWeek.start), thisTarget, targetSource, northStar: directive.north_star }));
      if (tapped) activity.push(`Held meetings: served at 1.10.0 but not usable this run (${tapped.reason}), so the Monday ask stands in.`);
      goodObjective = goodMeetingsObjective({ answer, lastWeek, thisWeek, midnight: londonMidnight, timezone: TIMEZONE });
    }
    // The spec in force, and his ask to sign this week's while it is not signed: one Monday ask.
    if (week.post) mapped.proposals.unshift(week.post);
    holds.push(...week.holds); activity.push(...week.lines);
    if (week.spec) activity.push(...compiledDrift(week.spec, { northStarSha, weekGoalsSha: payloadDigest(directive.week_goals) }));
    const booked = suppliedContext ? bookings({ context: suppliedContext, at, weekStart: thisWeek.start, londonDate, addDays }) : null;
    activity.push(bookingLine(booked, visibilityTargets(policy)));
    // Traffic to mindmake.co: a supporting reading beside the number, never the number (Phase 1b).
    activity.push(...trafficLines({ web: directive.web, hosts: suppliedContext ? bookedHosts(suppliedContext) : new Set() }));
    // 1.6.0: the five rows on his home screen, after everything else, in the room a report has left.
    let schema_version = SCHEMA_VERSION;
    if (suppliedContext && capabilities?.features?.rows === true && Array.isArray(capabilities.schema_versions) && capabilities.schema_versions.includes(ROWS_VERSION)) {
      phase = 'rows';
      // 1.7.0 and 1.8.0 only where Control Center serves them; an older one gets the rows without what it cannot read.
      const briefs = capabilities.schema_versions.includes(BRIEF_VERSION);
      const cards = briefs && capabilities.schema_versions.includes(CARD_VERSION);
      const pitches = cards && capabilities.schema_versions.includes(PITCH_VERSION);
      schema_version = pitches ? PITCH_VERSION : cards ? CARD_VERSION : briefs ? BRIEF_VERSION : ROWS_VERSION;
      const rows = await fiveRows({ cc, context: suppliedContext, directive, capabilities, mode, at, clock, canonReader, wordFiles, recordReader, briefs, pitches, caps: week.caps });
      if (week.spec) activity.push(...compiledDrift(week.spec, { canon: rows.canonFiles }));
      if (!pitches) holds.push({ reason: 'pitch_needs_1_9_0', detail: "Control Center does not yet take pitches for Jonny's Gmail (protocol 1.9.0), so none were written." });
      const shown = cards ? rows.proposals : briefs ? rows.proposals.map(({ card, ...p }) => p) : rows.proposals.map(({ because, brief, card, ...p }) => p);
      const room = Math.max(0, 40 - mapped.proposals.length);
      mapped.proposals.push(...shown.slice(0, room));
      if (shown.length > room) holds.push({ reason: 'row_cap', detail: `${shown.length - room} more row actions wait for a later run; a report carries at most 40.` });
      holds.push(...rows.holds); activity.push(...rows.activity);
      outcome.rows = rows.counts;
    }
    // Plans Control Center can never run, because the Advisory record each rests on is gone, are taken back (1.10.0).
    let withdrawn = capabilities?.features?.withdrawn === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes(MEETINGS_VERSION) && suppliedContext
      ? deadPlans(suppliedContext, new Set(mapped.proposals.map(p => p.proposal_id))) : [];
    // 1.10.0 adds origin_candidates and withdrawn and changes nothing earlier, so a run that can send them does.
    const isNote = p => { try { return JSON.parse(p.exact_payload ?? 'null')?.kind === 'show_notes_ask'; } catch { return false; } };
    const wants110 = !!taps || withdrawn.length > 0 || mapped.proposals.some(isNote);
    if (wants110 && (schema_version === PITCH_VERSION || schema_version === SCHEMA_VERSION)) schema_version = MEETINGS_VERSION;
    else if (wants110) { origin_candidates = null; withdrawn = []; mapped.proposals = mapped.proposals.filter(p => !isNote(p)); holds.push({ reason: 'meetings_need_1_9_0', detail: 'Control Center serves 1.10.0 but not every earlier version this run, so no origin candidates, withdrawals or show-notes notes were sent.' }); }
    if (withdrawn.length) activity.push(`Took back ${withdrawn.length} pending plan${withdrawn.length === 1 ? '' : 's'} whose Advisory record Control Center no longer holds, so ${withdrawn.length === 1 ? 'it' : 'they'} could never run and no longer wait on his list.`);
    holds.push(...mapped.holds); activity.push(...mapped.activity);
    // The directive's constraints, in shadow until the switch (plan section 3): counted and reported, nothing hidden.
    const c = directive.constraints;
    if (c) {
      const walled = mapped.proposals.filter(p => ['send', 'post', 'spend'].includes(p.wall)).length;
      const spend = mapped.proposals.reduce((sum, p) => sum + (typeof p.amount_usd === 'number' ? p.amount_usd : 0), 0);
      activity.push(`Constraints, in shadow: ${walled} walled proposal${walled === 1 ? '' : 's'}${c.max_actions !== null ? ` against max_actions ${c.max_actions}` : ''}, ${spend} USD proposed${c.spend_cap_usd !== null ? ` against a spend cap of ${c.spend_cap_usd}` : ''}. Nothing is held by them yet.`);
    } else activity.push('Constraints: the directive carried none this run, so none are assumed.');
    const current = new Map(mapped.proposals.map(p => [p.proposal_id, p.payload_sha256]));
    const approved = directive.decisions_since.filter(d => d.decision === 'approved');
    activity.push(`Control Center returned ${directive.decisions_since.length} decisions from the last seven days: ${approved.length} approved, ${directive.decisions_since.length - approved.length} declined; ${approved.filter(d => d.payload_sha256 && current.get(d.proposal_id) === d.payload_sha256).length} approvals match a payload in this report.`);
    activity.push('Preparation used the existing daily dispatch. External actions require exact approval, a supported connector and independently verified receipts. Native drafts and human edits remain with their owners.');
    const observed_at = clock();
    const report = buildReport({
      run_id, mode, observed_at, status: !snapshot && !strategic ? 'degraded' : holds.some(h => !STANDING_HOLDS.has(h.reason)) ? 'held' : 'ready',
      source: strategicSource ?? { revision: snapshot && snapshot.source_revision.length <= 128 ? snapshot.source_revision : revision, captured_at: snapshot?.generated_at ?? observed_at },
      objectives: [
        goodObjective,
        ...bookingObjectives({ booked, thisWeek, at, midnight: londonMidnight, addDays, londonDate, timezone: TIMEZONE }),
        ...(outcomes ? outcomeScorecard(outcomes, observed_at) : objectiveReadings({ at: observed_at, activatedOn }))
      ].slice(0, 20), activity, proposals: mapped.proposals, holds, schema_version, origin_candidates, withdrawn
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
