import { readFile } from 'node:fs/promises';
import { APPROVED_CANON } from '../contracts/growth.ts';

export const AT = '2026-10-16T13:00:00Z';
export const POLICY = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
export const copy = value => structuredClone(value);
export function evidence(kind, { id = `${kind}-a`, observed_at = '2026-10-15T12:00:00Z', fact = `Synthetic ${kind} evidence`, visibility = 'public' } = {}) {
  return { id, kind, visibility, observed_at, fact, url: `https://example.com/evidence/${id}` };
}
export function contact(id = 'buyer-a', changes = {}) {
  return {
    id, full_name: `Synthetic ${id}`, title: 'Chief Executive Officer', company: `Example ${id}`,
    relationship: 'cold', suppressed: false, closed: false, consent_status: 'allowed',
    evidence: [evidence('person', { id: `person-${id}` }), evidence('company', { id: `company-${id}` })],
    buying_moment: evidence('trigger', { id: `trigger-${id}`, fact: 'A new pricing decision is being tested this month.' }),
    offer_fit: 'revenue_engine', why_fit: 'The leader owns the current pricing decision.', decision_authority: 'confirmed',
    ...changes
  };
}
export function snapshot(changes = {}) {
  return {
    version: 1, generated_at: AT, source_revision: 'synthetic-revision-1', complete: true,
    icp: { defined: true, definition: 'Leaders who own a current commercial decision.', buyer_titles: ['Chief Executive Officer'], industries: [], exclusions: ['Excluded Example'] },
    canon: copy(APPROVED_CANON), contacts: [contact()], deals: [], ...changes
  };
}
export function qualification(changes = {}) {
  return { decision_authority: true, owned_problem: true, active_need: true, offer_fit: true, next_step_agreed: true, confirmed_by: 'krish', confirmed_at: '2026-10-16T12:00:00Z', ...changes };
}
export function deal(id = 'deal-a', changes = {}) {
  return { id, contact_id: 'buyer-a', state: 'call_taken', call_taken_at: '2026-10-16T11:00:00Z', qualified_at: '2026-10-16T12:00:00Z', qualification: qualification(), ...changes };
}
export function response(value, options = {}) {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' }, ...options });
}
