/**
 * The Reader Check's lint (Ruling, Krish, 2026-11-10; src/crew/reader.mjs):
 * the verdicts fresh readers gave on this run's drafts, where a session
 * passes them in. A dispatch has none, so it finds nothing. In shadow: a
 * finding is reported, never a hold, and a simulated reader is never
 * evidence. Lens: would this person reply within a week, and which link
 * stops them? Pure.
 */
import { draftOf } from '../reader.mjs';
import { finding } from './grammar.mjs';

export const SPECIALIST = 'reader-check';
export const LINTS = ['reader.no_reply', 'reader.weakest_link', 'reader.feels_worked'];

export const applies = p => Boolean(p?.row) && draftOf(p) !== null;

/** Findings for one draft from its reader's verdict, if a session passed one. */
export function lint(p, ctx) {
  const a = ctx?.reader instanceof Map ? ctx.reader.get(p?.proposal_id) : null;
  if (!a) return [];
  const out = [];
  if (a.replies === false) out.push(finding('reader.no_reply', p, 'its reader would not reply within 7 days'));
  if (a.weakest_link && a.weakest_link !== 'none') out.push(finding('reader.weakest_link', p, a.weakest_link));
  if (a.feels === 'worked') out.push(finding('reader.feels_worked', p, 'its reader felt worked, not remembered'));
  return out;
}
