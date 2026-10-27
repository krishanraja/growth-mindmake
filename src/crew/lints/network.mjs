/**
 * The Network Steward's lint (plan section 3): the NETWORK row, close ties
 * gone quiet. Lens: will they feel remembered, or worked? Pure; it imports
 * the rows stage's own predicates and restates none of them.
 */
import { lastContact, refusedBy, channelOf } from '../../stages/rows.mjs';
import { cardGrammar, wordsOf, questionsIn, subjectId, recordTexts, finding } from './grammar.mjs';
import { taggedLinks } from './measurement.mjs';

export const SPECIALIST = 'network-steward';
export const LINTS = ['network.tie_both_ways', 'network.quiet_90_days', 'network.no_refusal', 'network.one_ask', 'network.route', 'card_grammar', 'network.canon_link_untagged'];
const DAY = 86400000;

export const applies = p => p?.row === 'network';

/** Findings for one NETWORK row action. */
export function lint(p, ctx) {
  const out = [];
  const id = subjectId(p);
  const c = id ? ctx.people.get(id) : null;
  // Tie evidence counted both ways: a tie he only ever wrote to, or who only wrote to him, is not one. Unknown counts are not a finding.
  const i = Number.isInteger(c?.email_inbound) ? c.email_inbound : null, o = Number.isInteger(c?.email_outbound) ? c.email_outbound : null;
  if (i !== null && o !== null && (i === 0 || o === 0)) out.push(finding('network.tie_both_ways', p, 'the emails between them run one way only'));
  const last = c ? lastContact(c) : null;
  if (last === null || Date.parse(ctx.at) - last < 90 * DAY) out.push(finding('network.quiet_90_days', p, last === null ? 'no last contact on record' : 'in touch within 90 days'));
  const refused = id ? refusedBy(ctx.L, { subject: `contact:${id}`, row: 'network', kind: null, sector: null, topic: null, band: 'unknown' }, ctx.at) : 'no_subject';
  if (refused) out.push(finding('network.no_refusal', p, refused));
  if (questionsIn(wordsOf(p)) > 1) out.push(finding('network.one_ask', p, 'more than one question'));
  if (!channelOf(ctx.routes[id], 'network')) out.push(finding('network.route', p, 'no route on record for this row'));
  for (const f of cardGrammar(p.card, { records: [...recordTexts(c), ...ctx.extraRecords(id)] })) out.push(finding('card_grammar', p, `${f.field}: ${f.reason}`));
  if (taggedLinks(p).length) out.push(finding('network.canon_link_untagged', p, 'a one-to-one note carries a tagged link'));
  return out;
}
