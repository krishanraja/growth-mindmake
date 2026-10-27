/**
 * The Multiplier Steward's lint (plan section 3): PARTNERS and the connector
 * introductions on REACH OUT. Lens: does this spend their trust, or give
 * first? Pure; it imports the rows stage's predicates.
 */
import { fitHold, hasFullName, cleanName, channelOf } from '../../stages/rows.mjs';
import { cardGrammar, wordsOf, questionsIn, subjectId, recordTexts, finding } from './grammar.mjs';
import { taggedLinks } from './measurement.mjs';

export const SPECIALIST = 'multiplier-steward';
export const LINTS = ['multiplier.beyond_linkedin', 'multiplier.named_with_reason', 'multiplier.fit_floor', 'multiplier.one_ask', 'multiplier.route', 'card_grammar', 'multiplier.canon_link_untagged'];

export const applies = p => p?.row === 'partners' || p?.close_condition?.reference === 'reach_out:introduce';

/** Findings for one partner or connector ask. */
export function lint(p, ctx, spec) {
  const out = [];
  const id = subjectId(p);
  const c = id ? ctx.people.get(id) : null;
  // Relationship evidence beyond a LinkedIn connection: another source, or an email either way.
  const sources = Array.isArray(c?.source_list) ? c.source_list.map(String) : [];
  const emails = (Number.isInteger(c?.email_inbound) ? c.email_inbound : 0) + (Number.isInteger(c?.email_outbound) ? c.email_outbound : 0);
  if (!sources.some(s => !/^linkedin/i.test(s)) && emails === 0) out.push(finding('multiplier.beyond_linkedin', p, 'known only as a LinkedIn connection'));
  if (!hasFullName(cleanName(c?.contacts?.full_name ?? '')) || !p.card?.why?.length) out.push(finding('multiplier.named_with_reason', p, 'no full name or no reason on the card'));
  const unfit = c ? fitHold(c, spec?.fit_floor) : 'no_record';
  if (unfit) out.push(finding('multiplier.fit_floor', p, unfit));
  if (questionsIn(wordsOf(p)) > 1) out.push(finding('multiplier.one_ask', p, 'more than one question'));
  if (!channelOf(ctx.routes[id], p.row)) out.push(finding('multiplier.route', p, 'no route on record for this row'));
  for (const f of cardGrammar(p.card, { records: [...recordTexts(c), ...ctx.extraRecords(id)] })) out.push(finding('card_grammar', p, `${f.field}: ${f.reason}`));
  if (taggedLinks(p).length) out.push(finding('multiplier.canon_link_untagged', p, 'a one-to-one note carries a tagged link'));
  return out;
}
