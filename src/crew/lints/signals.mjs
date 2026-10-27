/**
 * The Signal Scout's lint (plan section 3): REACH OUT rows from people who
 * commented, worried, on posts about AI and their jobs. Lens: will they feel
 * heard, or harvested? Pure; who counts is signals.mjs's icpOf, imported.
 */
import { icpOf, quoteOf } from '../../stages/signals.mjs';
import { refusedBy } from '../../stages/rows.mjs';
import { cardGrammar, actionOf, wordsOf, questionsIn, subjectId, finding } from './grammar.mjs';
import { taggedLinks } from './measurement.mjs';

export const SPECIALIST = 'signal-scout';
export const LINTS = ['signals.icp', 'signals.quoted_exactly', 'signals.post_named', 'signals.window', 'signals.no_refusal', 'signals.one_ask', 'card_grammar', 'signals.canon_link_untagged'];
/** The fourteen days of research a context carries: a comment older than its answer's window is stale. */
export const WINDOW_DAYS = 14;
const DAY = 86400000;

export const applies = p => p?.close_condition?.reference === 'reach_out:signal';

/** Findings for one signal row. */
export function lint(p, ctx) {
  const out = [];
  const id = subjectId(p);
  const url = p.evidence?.find(e => typeof e?.url === 'string')?.url ?? null;
  // The comment this row quotes, found again in the research Control Center answered.
  let hit = null;
  for (const r of ctx.research) {
    if (r?.kind !== 'post_engagers' || r.status !== 'answered') continue;
    for (const e of Array.isArray(r.evidence) ? r.evidence : []) if (e?.url === url && e?.person) hit = { r, e };
  }
  if (!url) out.push(finding('signals.post_named', p, 'no comment link'));
  if (!hit) out.push(finding('signals.icp', p, 'the comment is not in the research read'));
  else {
    if (!icpOf(hit.e.person, hit.e.snippet)) out.push(finding('signals.icp', p, 'not a worried executive by their own headline and words'));
    const body = actionOf(p)?.body ?? '';
    if (!body.includes(`"${quoteOf(hit.e.snippet)}"`)) out.push(finding('signals.quoted_exactly', p, 'their words are not quoted as written'));
    const answered = Date.parse(hit.r.answered_at ?? hit.r.requested_at ?? '');
    if (!Number.isFinite(answered) || Date.parse(ctx.at) - answered > WINDOW_DAYS * DAY) out.push(finding('signals.window', p, 'outside the research window'));
  }
  const refused = id ? refusedBy(ctx.L, { subject: `contact:${id}`, row: 'reach_out', kind: null, sector: p.features?.sector ?? null, topic: p.features?.topic ?? null, band: 'unknown' }, ctx.at) : 'no_subject';
  if (refused) out.push(finding('signals.no_refusal', p, refused));
  if (questionsIn(wordsOf(p)) > 1) out.push(finding('signals.one_ask', p, 'more than one question'));
  // Their own words are the record a signal card quotes; nothing else of theirs is drawn on.
  for (const f of cardGrammar(p.card, { records: hit ? [hit.e.person?.headline].filter(x => typeof x === 'string') : [] })) out.push(finding('card_grammar', p, `${f.field}: ${f.reason}`));
  if (taggedLinks(p).length) out.push(finding('signals.canon_link_untagged', p, 'a one-to-one note carries a tagged link'));
  return out;
}
