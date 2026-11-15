/**
 * Call prep (docs/GET-GOING.md 1.7). For every booked meeting, the day
 * before: the person, the company, the mirror, the prior touches, the
 * Pipeline record and the discovery questions, each fact said, inferred or
 * missing; and, for a first meeting, the test-kit interview: the handful of
 * questions Krish asks a buyer on a first call to test whether the offer
 * fits (does the problem cost them, what they do today, what a yes would
 * need), in this engine's own words, each drawn from the buyer's own record.
 *
 * The three labels, by one rule:
 *   said      on Control Center's record as a fact: a typed fact (protocol
 *             1.10.0, a dated profile read, their own post, the email
 *             counts), a deal in his Pipeline, a draft and what became of it,
 *             a meeting he held, his own answer to a row about them.
 *   inferred  this engine's or Control Center's own reading of the record:
 *             an undated title, the buyer group a title falls in, the fit
 *             score, the prose a model wrote about them.
 *   missing   asked for and not on the record. Never filled with a guess:
 *             a missing fact becomes a question for the call.
 *
 * Where it reaches him: on that meeting's card in Pipeline (Ruling, Krish,
 * 2026-11-15: call prep reaches him on the meeting in Pipeline). Where
 * Control Center serves `features.call_prep` at protocol 1.40.0, the dispatch
 * sends each prep in the report's `call_prep` (callPrepField), named by the
 * meeting and person ids Control Center gave, and counts its answer; without
 * it, each is made in memory and counted in shadow. Either way the activity
 * line and the run's outcome carry counts only, never a name, a company or a
 * word of the record (the runner's logs are public). Pure: no clock, no
 * network, no file.
 */

import { canonBuyerGroup } from './canon.mjs';
import { schemaErrors } from '../guards.mjs';

/** The labels a fact carries. */
export const BASES = Object.freeze(['said', 'inferred', 'missing']);
/** At most this many discovery questions a meeting. */
export const QUESTIONS_MAX = 5;
/** The test kit's three moves, in the order he asks them. */
export const TEST_KIT = Object.freeze(['cost', 'today', 'yes']);
/** 1.40.0: the protocol version whose report carries call_prep (features.call_prep). */
export const CALL_PREP_VERSION = '1.40.0';
/** At most this many preps in one report, the protocol's cap. */
export const CALL_PREP_MAX = 40;
/** The refusals ENGINE-PROTOCOL.md names for a prep at 1.40.0. Any other key is counted as `unlisted`, never repeated. */
export const CALL_PREP_REFUSALS = new Set(['meetings_unread', 'unknown_meeting', 'contact_not_in_meeting', 'kit_not_first_meeting', 'deals_unread', 'deal_not_theirs']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = v => String(v ?? '').toLowerCase();
const text = v => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const cut = (v, n) => (v.length <= n ? v : `${v.slice(0, n - 3).replace(/\s+\S*$/, '')}...`);
const day = v => (Number.isFinite(Date.parse(v ?? '')) ? new Date(Date.parse(v)).toISOString().slice(0, 10) : null);

function fact(about, label, value, basis, source) {
  return { about, label, text: value === null ? null : cut(value, 240), basis, source };
}

/** Every person row Control Center serves for one contact, first found first. Pure. */
export function personRow(context, contactId) {
  const advisory = (Array.isArray(context?.records?.advisory) ? context.records.advisory : [])
    .filter(r => key(r?.contact_id) === key(contactId) && r?.person && typeof r.person === 'object')
    .map(r => ({ ...r.person, contact_id: r.contact_id }));
  for (const list of [context?.quiet_ties, context?.network, context?.amplifier_candidates, advisory]) {
    for (const n of Array.isArray(list) ? list : []) if (key(n?.contact_id) === key(contactId)) return n;
  }
  return null;
}

/** The meetings ahead that start on the London day after `at`, each with a contact Control Center holds. The dispatch's own London calendar is passed in. Pure. */
export function meetingsTomorrow(context, at, { londonDate, addDays }) {
  const tomorrow = addDays(londonDate(at), 1);
  return (Array.isArray(context?.upcoming_meetings) ? context.upcoming_meetings : [])
    .filter(m => m && typeof m.meeting_id === 'string' && typeof m.contact_id === 'string' && UUID.test(m.contact_id)
      && Number.isFinite(Date.parse(m.starts_at ?? '')) && londonDate(m.starts_at) === tomorrow);
}

const typed = (row, kind) => (Array.isArray(row?.facts) ? row.facts : []).filter(f => f?.kind === kind && text(f.text));

/** Who they are: said where a typed fact says it, inferred from the rest of the row, missing where nothing does. Pure. */
export function personFacts(row, buyer) {
  const out = [];
  const name = text(row?.contacts?.full_name);
  out.push(name ? fact('person', 'Name', name, 'said', 'contacts') : fact('person', 'Name', null, 'missing', 'contacts'));
  const role = typed(row, 'role')[0];
  const title = text(row?.current_title) ?? text(row?.contacts?.title);
  if (role) out.push(fact('person', 'Role', text(role.text), 'said', `facts.role${role.observed_at ? ` (${day(role.observed_at)})` : ''}`));
  else if (title) out.push(fact('person', 'Role', title, 'inferred', 'current_title, not dated'));
  else out.push(fact('person', 'Role', null, 'missing', 'facts.role'));
  for (const f of typed(row, 'role_change').slice(0, 1)) out.push(fact('person', 'Role change', text(f.text), 'said', 'facts.role_change'));
  const group = canonBuyerGroup(title ?? text(role?.text), buyer);
  if (group === undefined) out.push(fact('person', 'Buyer group', null, 'missing', 'canon buyer groups'));
  else out.push(fact('person', 'Buyer group', group ? `Their title reads as ${group}, a buyer group in the canon.` : 'Their title is in none of the canon\'s buyer groups.', 'inferred', 'canon buyer groups'));
  const fit = Number.isFinite(row?.mindmake_fit) ? row.mindmake_fit : null;
  out.push(fit === null ? fact('person', 'Mindmake fit', null, 'missing', 'mindmake_fit') : fact('person', 'Mindmake fit', `Control Center reads their fit as ${Math.round(fit)} of 100.`, 'inferred', 'mindmake_fit'));
  if (row?.sells_competing_services === true) out.push(fact('person', 'Competes', 'Control Center reads them as selling what Mindmake sells.', 'inferred', 'sells_competing_services'));
  for (const f of [...typed(row, 'post'), ...typed(row, 'last_post')].slice(0, 2)) out.push(fact('person', f.kind === 'post' ? 'Their words' : 'Last post', text(f.text), 'said', `facts.${f.kind}`));
  if (!typed(row, 'post').length) out.push(fact('person', 'Their words', null, 'missing', 'facts.post'));
  const who = text(row?.who);
  if (who) out.push(fact('person', 'Who, as written', who, 'inferred', 'who (a model wrote it)'));
  return out;
}

/** Their company: said from a dated role fact or a company read, inferred from the row, missing otherwise. Pure. */
export function companyFacts(row, context) {
  const out = [];
  const role = typed(row, 'role')[0];
  const company = text(row?.current_company) ?? text(row?.contacts?.company);
  out.push(company ? fact('company', 'Company', company, role ? 'said' : 'inferred', role ? 'facts.role' : 'current_company, not dated') : fact('company', 'Company', null, 'missing', 'current_company'));
  const domain = text(row?.contacts?.company_domain);
  const listed = domain ? (Array.isArray(context?.companies) ? context.companies : []).find(c => key(c?.domain) === key(domain)) : null;
  if (listed && text(listed.kind)) out.push(fact('company', 'Kind', text(listed.kind), 'said', 'companies'));
  const read = domain ? (Array.isArray(context?.research) ? context.research : []).find(r => r?.kind === 'company_read' && r.status === 'answered' && key(r.query).includes(key(domain).replace(/^www\./, '')) && text(r.answer)) : null;
  out.push(read ? fact('company', 'What the company does', text(read.answer), 'said', 'company_read (its own site)') : fact('company', 'What the company does', null, 'missing', 'company_read'));
  for (const f of typed(row, 'shared_employer').slice(0, 1)) out.push(fact('company', 'Shared employer', text(f.text), 'said', 'facts.shared_employer'));
  return out;
}

/** The AI mirror: Control Center runs it on his press and keeps it there, so it is never on this engine's record. Pure. */
export function mirrorFact() {
  return fact('mirror', 'The mirror', null, 'missing', 'the AI mirror on their card in Control Center, made on his press before the call');
}

/** Every touch on record: how he knows them, the email each way, the drafts and what became of them, meetings held, his answers. Pure. */
export function touchFacts(row, context, contactId, meeting) {
  const out = [];
  for (const k of ['known_since', 'email', 'shared_room']) for (const f of typed(row, k).slice(0, 1)) out.push(fact('touch', k === 'email' ? 'Email' : k === 'known_since' ? 'Known since' : 'Shared room', text(f.text), 'said', `facts.${k}`));
  for (const d of (Array.isArray(context?.records?.drafts) ? context.records.drafts : []).filter(d => key(d?.contact_id) === key(contactId)).slice(0, 3)) {
    const steps = [['sent_at', 'sent'], ['replied_at', 'replied'], ['booked_at', 'booked'], ['opted_out_at', 'opted out'], ['bounced_at', 'bounced'], ['binned_at', 'binned unsent']]
      .filter(([k]) => day(d[k])).map(([k, w]) => `${w} ${day(d[k])}`);
    out.push(fact('touch', 'A draft', `${text(d.job) ?? 'a'} draft${steps.length ? `: ${steps.join(', ')}` : ', not sent'}.`, 'said', 'records.drafts'));
  }
  const held = (Array.isArray(context?.meetings) ? context.meetings : []).filter(m => key(m?.contact_id) === key(contactId) && day(m.held_at));
  for (const m of held.slice(0, 2)) out.push(fact('touch', 'Met', `Met ${day(m.held_at)}${m.good === true ? ', marked good' : m.good === false ? ', marked not good' : ''}.`, 'said', 'meetings'));
  for (const f of (Array.isArray(context?.feedback) ? context.feedback : []).filter(f => key(f?.subject_ref) === `contact:${key(contactId)}`).slice(0, 2)) {
    out.push(fact('touch', 'His answer', `He ${f.state === 'declined' ? `said no${f.reason_code ? ` (${String(f.reason_code).replace(/_/g, ' ')})` : ''}` : f.carried_out ? `carried it out (${f.carried_out})` : String(f.state ?? 'answered')} on a ${text(f.row) ?? 'row'} proposal about them.`, 'said', 'feedback'));
  }
  if (meeting?.first_meeting === true) out.push(fact('touch', 'First meeting', 'None of them is in a meeting he held.', 'said', 'upcoming_meetings'));
  else if (meeting?.first_meeting === false) out.push(fact('touch', 'First meeting', 'He has met them before.', 'said', 'upcoming_meetings'));
  if (!out.length) out.push(fact('touch', 'Prior touches', null, 'missing', 'facts, records.drafts, meetings, feedback'));
  return out;
}

/** The Pipeline record: his own Sheet's deal for them, open or gone quiet, said; none, missing. Pure. */
export function pipelineFacts(context, contactId) {
  const open = (Array.isArray(context?.records?.deals) ? context.records.deals : []).filter(d => key(d?.contact_id) === key(contactId));
  const quiet = (Array.isArray(context?.records?.stale_deals) ? context.records.stale_deals : []).filter(d => key(d?.contact_id) === key(contactId));
  const words = d => [text(d.stage) ? `stage ${text(d.stage)}` : null, day(d.next_date) ? `next step due ${day(d.next_date)}` : null, day(d.last_touched) ? `last touched ${day(d.last_touched)}` : null, text(d.closed_reason) ? `closed: ${text(d.closed_reason)}` : null, day(d.first_met) ? `first met ${day(d.first_met)}` : null].filter(Boolean).join(', ');
  const out = [...open.map(d => fact('pipeline', 'Open deal', words(d) || 'an open deal', 'said', 'records.deals')), ...quiet.map(d => fact('pipeline', 'Deal gone quiet', words(d) || 'a deal gone quiet', 'said', 'records.stale_deals'))];
  if (!Array.isArray(context?.records?.deals)) out.push(fact('pipeline', 'The Pipeline', null, 'missing', 'records.deals not served'));
  else if (!out.length) out.push(fact('pipeline', 'The Pipeline', null, 'missing', 'no deal in his Pipeline'));
  return out;
}

const QUESTION_FOR = {
  Role: 'What is your part in decisions about AI where you are?',
  'Buyer group': 'Who else would decide on something like this with you?',
  Company: 'Where are you working now, and on what?',
  'What the company does': 'What does the company do, in your words, and where is it heading this year?',
  'The Pipeline': 'What made now the right time to talk?',
  'Prior touches': 'How did you come to want this conversation?',
};

/**
 * The discovery questions: one for each thing missing that the call can
 * settle, then one from their own words or their deal, never a guess
 * dressed as a question. Pure.
 */
export function discoveryQuestions(facts) {
  const out = [];
  for (const f of facts) if (f.basis === 'missing' && QUESTION_FOR[f.label] && !out.some(q => q.text === QUESTION_FOR[f.label])) out.push({ text: QUESTION_FOR[f.label], from: `missing: ${f.label}` });
  const said = facts.find(f => f.label === 'Their words' && f.basis === 'said');
  if (said) out.push({ text: `You wrote "${cut(said.text, 120)}". What has happened since?`, from: 'said: their words' });
  const deal = facts.find(f => f.about === 'pipeline' && f.basis === 'said');
  if (deal) out.push({ text: `Your Pipeline has it at ${deal.text}. What has changed since?`, from: 'said: the Pipeline' });
  return out.slice(0, QUESTIONS_MAX);
}

/**
 * The test-kit interview for a first meeting: whether the offer fits, asked
 * in three moves (the cost, what they do today, what a yes would need), each
 * drawn from the strongest thing on the buyer's own record: the cost from
 * their own words, else their role, else their company; today from their
 * company, else their role; the yes from the buyer group their title falls
 * in. With nothing on record to draw on, a question is asked plainly and
 * says so in `from`. Pure.
 */
export function testKit(facts) {
  const has = label => facts.find(f => f.label === label && f.basis !== 'missing') ?? null;
  const words = facts.find(f => f.label === 'Their words' && f.basis === 'said') ?? null;
  const role = has('Role'), company = has('Company');
  const group = facts.find(f => f.label === 'Buyer group' && f.basis === 'inferred' && /a buyer group in the canon/.test(f.text ?? '')) ?? null;
  const cost = words ? { on: `the problem in your own words ("${cut(words.text, 100)}")`, from: 'said: their words' }
    : role ? { on: `the part of your work as ${cut(role.text, 80)} that AI should change`, from: `${role.basis}: role` }
      : company ? { on: `what AI should change at ${cut(company.text, 60)}`, from: `${company.basis}: company` }
        : { on: 'the problem you want AI to solve', from: 'missing: nothing on their record to draw on' };
  const where = company ? { at: ` at ${cut(company.text, 60)}`, from: `${company.basis}: company` }
    : role ? { at: ` as ${cut(role.text, 80)}`, from: `${role.basis}: role` }
      : { at: '', from: 'missing: nothing on their record to draw on' };
  // The group's first name in the canon ("CRO, or whoever owns revenue" asks as CRO).
  const who = group ? /reads as (.+), a buyer group/.exec(group.text)?.[1]?.split(/,\s*or\s+|\s+or\s+/)[0] ?? null : null;
  return [
    { kit: 'cost', text: `What does ${cost.on} cost you today, in time, money or a decision that waits?`, from: cost.from },
    { kit: 'today', text: `What do you do about it today${where.at}, and who does that work?`, from: where.from },
    who
      ? { kit: 'yes', text: `As ${who}, could you say yes to this yourself? If not, who signs, by when, and what would they need to see first?`, from: 'inferred: buyer group' }
      : { kit: 'yes', text: 'If this were right for you, what would a yes need: who signs, by when, and what would they need to see first?', from: 'missing: no buyer group on their record' },
  ];
}

/** One meeting's prep, whole. Pure. */
export function prepFor(meeting, { context, buyer }) {
  const row = personRow(context, meeting.contact_id);
  const facts = [
    ...(row ? personFacts(row, buyer) : [fact('person', 'Person row', null, 'missing', 'not served in network, quiet_ties, amplifier_candidates or records.advisory')]),
    ...(row ? companyFacts(row, context) : [fact('company', 'Company', null, 'missing', 'no person row')]),
    mirrorFact(),
    ...touchFacts(row, context, meeting.contact_id, meeting),
    ...pipelineFacts(context, meeting.contact_id),
  ];
  return {
    meeting_id: meeting.meeting_id, starts_at: meeting.starts_at, contact_id: meeting.contact_id,
    first_meeting: meeting.first_meeting ?? null, organizer: ['him', 'them', 'other'].includes(meeting.organizer) ? meeting.organizer : null,
    facts, questions: discoveryQuestions(facts),
    // The test kit is for a first call; a meeting not known to be a first one gets it too, since the record cannot say.
    test_kit: meeting.first_meeting === false ? [] : testKit(facts),
  };
}

/**
 * Every call prep due this run: the meetings that start tomorrow, London
 * time, where Control Center serves the meetings ahead
 * (`features.upcoming_meetings`). `served: false` without the flag;
 * `read: false` when the part is null. Pure.
 */
export function callPreps({ context, features = {}, buyer = null, at, londonDate, addDays }) {
  if (features?.upcoming_meetings !== true) return { served: false, preps: [] };
  if (!Array.isArray(context?.upcoming_meetings)) {
    const cov = (Array.isArray(context?.coverage) ? context.coverage : []).find(c => c?.source === 'upcoming_meetings');
    return { served: true, read: false, reason: typeof cov?.reason === 'string' ? cov.reason.slice(0, 60) : 'upcoming_unread', preps: [] };
  }
  return { served: true, read: true, preps: meetingsTomorrow(context, at, { londonDate, addDays }).map(m => prepFor(m, { context, buyer })) };
}

/**
 * Whether this run sends call prep: Control Center takes it
 * (features.call_prep), serves the version that carries it (1.40.0), and the
 * report schema copied here has the field. Pure.
 */
export function takesCallPrep(capabilities, schema) {
  return capabilities?.features?.call_prep === true && Array.isArray(capabilities?.schema_versions) && capabilities.schema_versions.includes(CALL_PREP_VERSION) && !!schema?.properties?.call_prep;
}

/** The deal a prep names: the person's one open deal in his Pipeline, by its deal_ref; null with none or several, and Control Center then shows it on each of their rows. Pure. */
export function dealRefFor(context, contactId) {
  const theirs = (Array.isArray(context?.records?.deals) ? context.records.deals : []).filter(d => key(d?.contact_id) === key(contactId));
  return theirs.length === 1 && typeof theirs[0].deal_ref === 'string' && theirs[0].deal_ref ? theirs[0].deal_ref : null;
}

/** One prep as the report carries it (ENGINE-PROTOCOL.md, "Call prep on the meeting in Pipeline"): the ids, each fact with its mark and source, the questions and the test questions, nothing else. Pure. */
export function prepEntry(p, context) {
  return {
    meeting_id: p.meeting_id, contact_id: p.contact_id, deal_ref: dealRefFor(context, p.contact_id),
    facts: p.facts.map(f => ({ about: f.about, label: f.label, text: f.text, basis: f.basis, source: f.source })),
    questions: p.questions.map(q => ({ text: q.text, from: q.from })),
    test_kit: p.test_kit.map(q => ({ kit: q.kit, text: q.text, from: q.from }))
  };
}

/**
 * The report's call_prep: each prep that meets the protocol's own rules,
 * checked against the report schema copied here (its caps, the three marks,
 * a missing fact with no words, plain words with no address or number) and
 * the test questions' order, one per meeting, at most CALL_PREP_MAX. One that
 * does not is held and counted, never sent and never trimmed into something
 * it did not say. { entries, held }. Pure.
 */
export function callPrepField(r, context, schema) {
  const item = schema?.properties?.call_prep?.items;
  const entries = [], seen = new Set();
  let held = 0;
  for (const p of Array.isArray(r?.preps) ? r.preps : []) {
    const e = prepEntry(p, context);
    const inOrder = e.test_kit.length === 0 || e.test_kit.map(q => q.kit).join() === TEST_KIT.join();
    if (item && !seen.has(e.meeting_id) && entries.length < CALL_PREP_MAX && inOrder && !schemaErrors(item, e, '$', schema).length) { entries.push(e); seen.add(e.meeting_id); }
    else held++;
  }
  return { entries, held };
}

/**
 * One counts line for the report: never a name, a company or a word of
 * anyone's record. `sending` is this run's callPrepField, or null when it
 * sends none; `offered` is whether Control Center says it takes call prep.
 * Pure.
 */
export function callPrepLine(r, sending = null, offered = false) {
  if (!r?.served) return null;
  if (!r.read) return `Call prep: the meetings ahead were not read this run (${r.reason}), so no prep was made.`;
  if (!r.preps.length) return 'Call prep: no booked meeting tomorrow with someone Control Center holds.';
  const n = b => r.preps.reduce((s, p) => s + p.facts.filter(f => f.basis === b).length, 0);
  const first = r.preps.filter(p => p.first_meeting === true).length;
  const q = r.preps.reduce((s, p) => s + p.questions.length, 0), kit = r.preps.reduce((s, p) => s + p.test_kit.length, 0);
  const sent = sending?.entries?.length ?? 0, held = sending?.held ?? 0;
  const where = sending
    ? `Sent to Control Center for each meeting's card in Pipeline: ${sent}${held ? `; ${held} held, outside the protocol's rules (a cap, a mark or an address or number in its words), never sent` : ''}.`
    : offered
      ? 'Control Center takes call prep, but this run cannot send it (the version it serves or the protocol copy here does not carry call_prep), so it is made and counted in shadow.'
      : 'Control Center takes no call prep yet, so none reaches him; it is made and counted in shadow.';
  return `Call prep: ${r.preps.length} booked meeting${r.preps.length === 1 ? '' : 's'} tomorrow (${first} a first meeting); ${n('said')} facts said, ${n('inferred')} inferred and ${n('missing')} missing, ${q} discovery question${q === 1 ? '' : 's'} and ${kit} test-kit question${kit === 1 ? '' : 's'}. ${where}`;
}

const tallyOf = v => (Number.isInteger(v) && v >= 0 ? v : null);
/**
 * Control Center's answer to the call prep a report carried (1.40.0, the
 * acceptance's call_prep), as counts only: kept for the meeting's card and
 * refused by reason. A reason the protocol does not name is counted under
 * `unlisted`, so the total stays true and no foreign string is repeated; a
 * meeting id is never repeated either. An answer it cannot read is said to
 * be unread, never counted as none. Null when none was sent. Pure.
 */
export function callPrepAnswer(sent, answer) {
  if (!sent) return null;
  const unread = { state: 'unread', line: `Call prep: ${sent} sent; Control Center's answer could not be read, so none is counted as shown or refused.` };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return unread;
  if (answer.error === 'call_prep_unchecked') return { state: 'unchecked', line: `Call prep: ${sent} sent; Control Center's checker failed this run (call_prep_unchecked), so none is counted as shown, and the report still stands.` };
  const kept = tallyOf(answer.kept);
  if (kept === null || !answer.refused || typeof answer.refused !== 'object' || Array.isArray(answer.refused)) return unread;
  const refused = {};
  for (const [reason, n] of Object.entries(answer.refused)) {
    if (!tallyOf(n)) continue;
    const k = CALL_PREP_REFUSALS.has(reason) ? reason : 'unlisted';
    refused[k] = (refused[k] ?? 0) + n;
  }
  const sorted = Object.fromEntries(Object.entries(refused).sort(([a], [b]) => a.localeCompare(b)));
  const total = Object.values(sorted).reduce((a, n) => a + n, 0);
  const why = total ? ` (${Object.entries(sorted).map(([r, n]) => `${r} ${n}`).join(', ')})` : '';
  const dry = answer.dry_run === true;
  return {
    state: dry ? 'dry_run' : 'answered', sent, kept, refused: sorted,
    line: `Call prep: ${sent} sent; ${dry ? `a dry run, none shown: ${kept} would be kept` : `${kept} kept for the meeting's card in Pipeline`}, ${total} refused${why}.`
  };
}

/** One prep as plain text, for the person who reads it (and the tests). Pure. */
export function prepText(p) {
  const tag = { said: 'said', inferred: 'inferred', missing: 'missing' };
  const lines = [`Call prep for the meeting at ${p.starts_at}${p.first_meeting === true ? ' (a first meeting)' : ''}`];
  for (const about of ['person', 'company', 'mirror', 'touch', 'pipeline']) {
    for (const f of p.facts.filter(x => x.about === about)) lines.push(`- [${tag[f.basis]}] ${f.label}: ${f.text ?? `not on record (${f.source})`}`);
  }
  if (p.questions.length) lines.push('Discovery questions:', ...p.questions.map(q => `- ${q.text}`));
  if (p.test_kit.length) lines.push('The test kit, does the offer fit:', ...p.test_kit.map(q => `- ${q.text}`));
  return lines.join('\n');
}
