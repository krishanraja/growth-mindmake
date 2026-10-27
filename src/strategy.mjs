/** Portfolio and institution selection over scoped, dated Control Center reads.
 * This is preparation. Native records own people, words and lifecycle states. */
import { qualified } from './stages/scorecard.mjs';

const MOTIONS = ['multiplier', 'institution', 'visibility', 'direct'];
const rank = c => c.access + c.authority + c.distribution + c.proof_strength + c.timing - c.effort;
const scores = c => ['access','authority','distribution','proof_strength','timing','effort'].every(k => Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 5);
const current = (time, now, days = 90) => Number.isFinite(Date.parse(time)) && Date.parse(time) <= Date.parse(now) && Date.parse(now) - Date.parse(time) <= days * 86400000;

export function validateStrategicRead(value, field, at) {
  const data = value?.[field];
  if (value?.ok !== true || data?.engine_id !== 'growth-mindmake' || data?.product_slug !== 'mindmake' || !/^1\.\d+\.\d+$/.test(data?.schema_version ?? '') || !current(data.observed_at, at, 1) || !Array.isArray(data.coverage) || !data.records || typeof data.records !== 'object') throw new Error(`Invalid ${field} read`);
  return data;
}

/** Unknown metrics stay null. Full table coverage is necessary for a measured zero.
 * Payment requires its own receipt; legacy paid timestamps alone do not suffice. */
export function outcomeScorecard(outcomes, at) {
  if (outcomes.timezone !== 'Europe/London' || !outcomes.windows?.week || !outcomes.windows?.first_30_days) throw new Error('Outcome windows missing');
  const complete = source => outcomes.coverage.some(c => c.source === source && c.available === true && c.complete === true);
  const week = outcomes.windows.week, first = outcomes.windows.first_30_days;
  const inWindow = (date, window) => current(date, at, 36600) && Date.parse(date) >= Date.parse(window.start) && Date.parse(date) < Date.parse(window.end);
  const deals = outcomes.records.advisory ?? [];
  const distinct = rows => new Set(rows.map(r => r.contact_id)).size;
  const held = deals.filter(d => inWindow(d.call_taken_at, week));
  const qualifiedPeople = held.filter(d => qualified(d, at));
  const paid = deals.filter(d => inWindow(d.pilot_paid_at, first));
  const verified = d => d.growth_context?.payment?.verified === true && typeof d.growth_context.payment.receipt_id === 'string' && !!d.growth_context.payment.receipt_id && current(d.growth_context.payment.verified_at, at, 36600);
  const reading = (key, value, unit, window, available, reason) => ({ key, value: available ? value : null, unit, window_start: window.start, window_end: window.end, timezone: 'Europe/London', availability: available ? 'measured' : 'missing', reason: available ? null : reason });
  const units = {free_pilots_started:'pilots',free_pilots_completed:'pilots',verified_payment_total:'GBP',active_sponsors:'sponsors',introductions_made:'introductions',institution_sessions_held:'sessions',qualified_appearances_confirmed:'appearances',qualified_appearances_held:'appearances',return_invitations:'invitations',attributed_inbound:'requests',founder_hours:'hours',approval_minutes:'minutes',preparation_cost:'USD',stalled_commitments:'commitments'};
  return [
    reading('held_intros', distinct(held), 'people', week, complete('advisory'), 'Complete Advisory outcome coverage unavailable.'),
    reading('qualified_conversations', distinct(qualifiedPeople), 'people', week, complete('advisory'), 'Complete Advisory outcome coverage unavailable.'),
    reading('paid_proofs', new Set(paid.filter(verified).map(d => d.id)).size, 'proofs', first, complete('advisory') && !!first.start && paid.every(verified), 'Activation or independent payment evidence is missing; a paid timestamp is insufficient.'),
    ...(outcomes.unavailable ?? []).map(key => reading(key, 0, units[key] ?? 'records', key.startsWith('qualified_appearances_') ? outcomes.windows.recognition ?? {start:first.start,end:null} : week, false, 'This outcome is not yet completely recorded by its native owner.')),
  ];
}

/** A campaign lives on its existing Advisory/Visibility record. Human wording
 * stays there. No engine copy competes with the native action on his one list. */
export function strategicPlan(context, { at, capacity = 5, allocation = null } = {}) {
  const candidates = [], held = [], seen = new Set();
  const unresolvedReplies = (context.records.advisory ?? []).filter(r=>r.state==='replied' && !r.growth_context?.campaign && !(r.growth_context?.engine_jobs?.length));
  if (unresolvedReplies.length) {
    held.push({reason:'existing_replies_first',detail:`${unresolvedReplies.length} existing replies need their current request read on the native Advisory record before fresh acquisition preparation.`});
    capacity = 0;
  }
  for (const [lane, rows] of Object.entries(context.records)) for (const row of rows ?? []) {
    const raw = row.growth_context?.campaign;
    const c = raw ? {...raw,reply_waiting:raw.reply_waiting || row.state==='replied'} : null;
    if (!c) continue;
    const ref = lane === 'advisory' ? `pilot:${row.id}` : lane === 'visibility' ? `target:${row.id}` : null;
    const stop = reason => held.push({ reason, detail: `${ref ?? lane}: campaign held.` });
    if (!ref || !MOTIONS.includes(c.motion) || !scores(c)) { stop('campaign_invalid'); continue; }
    if ((context.feedback ?? []).some(f=>f.reference===ref && f.stage==='plan' && f.state==='declined' && Date.parse(f.decided_at)>=Date.parse(c.reviewed_at))) { stop('campaign_declined'); continue; }
    if (row.state === 'not_now' || row.buried_at || ['declined','closed','done'].includes(c.state)) continue;
    if (!current(c.reviewed_at, at, 30) || !Array.isArray(c.sources) || !c.sources.length || c.sources.some(s => !current(s.observed_at, at) || !/^https:\/\//.test(s.url ?? ''))) { stop('campaign_evidence_stale'); continue; }
    const host = lane === 'visibility' ? row : row.visibility_target_id ? (context.records.visibility ?? []).find(t=>t.id===row.visibility_target_id) : null;
    if ((lane === 'visibility' || c.motion === 'institution') && !(host?.score_version === 1 && ['take','stretch'].includes(host.verdict))) { stop('visibility_standard_held'); continue; }
    if (!c.argument || !c.commitment || !c.follow_through || !c.success_measure || !c.preparation || !c.first_action?.body || !c.first_action?.recipient_contact_id || JSON.stringify(c).length > 6000) { stop('campaign_incomplete'); continue; }
    const permissions = context.proof_permissions?.value?.assets;
    if (!Array.isArray(c.proof) || !c.proof.length || !Array.isArray(permissions) || c.proof.some(p => p.permission !== 'approved' || !p.source_url || !p.allowed_use || !permissions.some(a=>a.id===p.id && a.permission==='approved' && a.source_url===p.source_url && a.allowed_use===p.allowed_use))) { stop('proof_permission_missing'); continue; }
    // The approval and send step re-resolve suppression and path from the owner.
    if (!c.route?.evidence || !c.route?.kind || c.route.kind === 'none') { stop('campaign_route_missing'); continue; }
    const key = `${c.first_action.recipient_contact_id}:${c.first_action.channel}`;
    if (seen.has(key)) { stop('recipient_already_selected'); continue; }
    seen.add(key);
    candidates.push({ ...c, ref, record_id: row.id, owner: lane, score: rank(c), commitment_due: c.commitment_due ?? null });
  }
  candidates.sort((a,b) => Number(b.reply_waiting || !!b.commitment_due) - Number(a.reply_waiting || !!a.commitment_due) || (a.commitment_due ?? '9999').localeCompare(b.commitment_due ?? '9999') || b.score-a.score || a.ref.localeCompare(b.ref));
  const commitments = candidates.filter(c => c.reply_waiting || c.commitment_due);
  const fresh = candidates.filter(c => !commitments.includes(c));
  const selected = commitments.slice(0, capacity);
  const left = capacity-selected.length, multiplierSlots = Math.round(left * .7);
  const distribution = fresh.filter(c => c.motion !== 'direct'), direct = fresh.filter(c => c.motion === 'direct');
  selected.push(...distribution.splice(0,multiplierSlots), ...direct.splice(0,left-multiplierSlots));
  selected.push(...[...distribution,...direct].sort((a,b)=>b.score-a.score).slice(0,capacity-selected.length));
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(at));
  const date = new Date(`${day}T12:00:00Z`), weekday = date.getUTCDay(); date.setUTCDate(date.getUTCDate()-(weekday === 0 ? 6 : weekday-1));
  const networkResearch = (context.network ?? []).map(person=>{
    const words = `${person.current_title ?? ''} ${person.current_company ?? ''} ${person.who ?? ''}`;
    const motion = /portfolio|venture|invest|holding company|multi.venture|operating partner/i.test(words) ? 'multiplier' : /association|institute|programme|programs|community|convene|forum/i.test(words) ? 'institution' : null;
    return motion ? {contact_id:person.contact_id,motion,owner:'network',next_action:'Verify current ownership or convening role, find a sourced decision and check the existing path before preparing an approach.',authority:'research_only'} : null;
  }).filter(Boolean).slice(0,5);
  const missing = context.coverage.filter(c=>!c.complete).map(c=>c.source);
  const pathsWithoutAccess = (context.paths?.targets ?? []).filter(p=>p.kind==='none' || p.path?.kind==='none');
  // The allocation is config/policy.json's `acquisition`, read where it belongs and still inert (plan section 1): nothing ranks by it yet.
  // No plan-wide digest (N14, removed): each campaign is bound by its own proposal's payload_sha256, which his decision names.
  const share = (v, d) => typeof v === 'number' && v >= 0 && v <= 1 ? v : d;
  return { selected, held, allocation: { multiplier_institution: share(allocation?.multiplier_institution_share, .7), direct_learning: share(allocation?.direct_learning_share, .3), rebalance_every_days: Number.isInteger(allocation?.rebalance_days) ? allocation.rebalance_days : 14 },
    research: networkResearch,
    review: { id: `mindmake:strategy:${date.toISOString().slice(0,10)}`, experiment: pathsWithoutAccess.length ? 'Test one existing host opportunity with no credible route: research an evidenced mutual and seek permission for one introduction.' : 'Find one absent institution where comparable practitioners earn invitations; verify audience, route and proof before preparing a pitch.', coverage_gaps: missing, comparable_practitioner_evidence: 'Not yet verified; research is required before a claim or approach.', buyer_questions: ['Can the leader see their own criteria applied to an actual business decision?','What must stay private to the leader versus shared with a portfolio?','What would make the two-week pilot worth continuing?'], commercial_inference: 'Drafts and successful runs are preparation only.' } };
}
