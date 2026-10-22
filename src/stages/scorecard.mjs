const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
function londonDate(value) { const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value])); return `${p.year}-${p.month}-${p.day}`; }
function addDays(value, days) { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function qualified(d, at) {
  const q = d.qualification;
  return Boolean(d.call_taken_at && d.qualified_at && q && q.confirmed_by === 'krish' && ['decision_authority','owned_problem','active_need','offer_fit','next_step_agreed'].every(k => q[k] === true) && Date.parse(q.confirmed_at) >= Date.parse(d.call_taken_at) && Date.parse(q.confirmed_at) <= Date.parse(at) && Date.parse(d.qualified_at) >= Date.parse(d.call_taken_at) && Date.parse(d.qualified_at) <= Date.parse(at));
}
export function scorecard(snapshot, policy, at, launchDate) {
  const today = londonDate(at);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weekStart = addDays(today, -(weekday === 0 ? 6 : weekday - 1));
  const window = (value, start, end) => value && Date.parse(value) <= Date.parse(at) && londonDate(value) >= start && londonDate(value) <= end;
  const held = snapshot.deals.filter(d => window(d.call_taken_at, weekStart, today));
  const count = new Set(held.filter(d => qualified(d, at)).map(d => d.contact_id)).size;
  let firstMonth = null;
  if (launchDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate) || new Date(`${launchDate}T12:00:00Z`).toISOString().slice(0, 10) !== launchDate || launchDate > today) throw new Error('Launch date must be the actual activation date, on or before today');
    const lastDay = addDays(launchDate, 29);
    const paid = new Set(snapshot.deals.filter(d => window(d.pilot_paid_at, launchDate, lastDay)).map(d => d.id)).size;
    firstMonth = { starts: launchDate, ends: lastDay, paid_proofs: paid, target: policy.targets.paid_proofs_first_30_days, gap: Math.max(0, policy.targets.paid_proofs_first_30_days - paid) };
  }
  return {
    measurement_scope: 'snapshot_deals', global_authoritative: false,
    timezone: 'Europe/London', week_starts: weekStart, as_of: at,
    qualified_conversations: count, target: policy.targets.qualified_conversations_per_week,
    gap: Math.max(0, policy.targets.qualified_conversations_per_week - count),
    held_conversations_pending_qualification: held.filter(d => !qualified(d, at)).length,
    first_month: firstMonth,
    qualification_rule: 'A held conversation, confirmed by Krish: authority, owned problem, active need, offer fit and agreed next step. Bookings and drafts do not count.',
    limits: ['This is a selected contact page; deals must cover the reporting window.', ...(!launchDate ? ['First-month measurement is inactive until the actual activation date is recorded.'] : [])]
  };
}
