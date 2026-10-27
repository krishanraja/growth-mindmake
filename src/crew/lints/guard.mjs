/**
 * The Guard's lint (plan section 3): the walls, on every proposal and on the
 * report. Lens: is anything here acting without his yes? Pure.
 */
import { actionOf, subjectId, finding } from './grammar.mjs';
import { CONSENT } from '../../stages/traffic.mjs';

export const SPECIALIST = 'guard';
export const LINTS = ['guard.spend_zero', 'guard.unwalled_action', 'guard.no_linkedin_automation', 'guard.do_not_contact', 'guard.constraints', 'guard.no_traffic_figure_printed'];

export const applies = () => true;
const OUTWARD = new Set(['email', 'linkedin', 'x_message', 'whatsapp', 'form', 'publication']);

/** Findings for one proposal. */
export function lint(p, ctx) {
  const out = [];
  if (p.amount_usd !== null && p.amount_usd !== undefined && p.amount_usd !== 0) out.push(finding('guard.spend_zero', p, 'a proposal carries an amount'));
  const a = actionOf(p);
  // An outward action is always behind a wall he presses: never on an unwalled proposal.
  if (p.wall === 'none' && (OUTWARD.has(p.channel) || OUTWARD.has(a?.channel))) out.push(finding('guard.unwalled_action', p, 'an outward action with no wall'));
  // LinkedIn is read through Control Center's research desk only: the engine never posts, messages or connects there.
  if ((p.channel === 'linkedin' || a?.channel === 'linkedin') && p.wall !== 'send') out.push(finding('guard.no_linkedin_automation', p, 'a LinkedIn action not sent by Krish himself'));
  const id = subjectId(p);
  const c = id ? ctx.people.get(id) : null;
  if (['do_not_contact', 'closed'].includes(c?.contacts?.status)) out.push(finding('guard.do_not_contact', p, 'a person he marked do not contact or closed'));
  return out;
}

/** Findings over the whole run: the directive's constraints, and no traffic figure in what the CLI prints. */
export function lintRun({ proposals = [], constraints = null, printed = null }) {
  const out = [];
  if (constraints) {
    const walled = proposals.filter(p => ['send', 'post', 'spend'].includes(p.wall)).length;
    const spend = proposals.reduce((s, p) => s + (typeof p.amount_usd === 'number' ? p.amount_usd : 0), 0);
    if (constraints.max_actions !== null && walled > constraints.max_actions) out.push({ lint: 'guard.constraints', proposal_id: null, detail: 'more walled proposals than max_actions' });
    if (constraints.spend_cap_usd !== null && spend > constraints.spend_cap_usd) out.push({ lint: 'guard.constraints', proposal_id: null, detail: 'more spend than the cap' });
  }
  if (printed !== null && (String(printed).includes(CONSENT) || /\bsessions\b/i.test(String(printed)))) out.push({ lint: 'guard.no_traffic_figure_printed', proposal_id: null, detail: 'a traffic figure in printed output' });
  return out;
}
