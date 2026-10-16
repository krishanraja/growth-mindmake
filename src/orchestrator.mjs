import { parseBatch } from '../contracts/growth.ts';
import { seal, semanticSnapshot, validateContext } from './guards.mjs';
import { analyse } from './stages/qualify.mjs';
import { prepare } from './stages/draft.mjs';
import { scorecard } from './stages/scorecard.mjs';

export function plan(input, policy, { at = new Date().toISOString(), launchDate } = {}) {
  const snapshot = validateContext(input, policy, at);
  const analysis = analyse(snapshot, policy, at);
  const recommendations = analysis.eligible.map(c => prepare(c, snapshot.canon));
  const snapshot_revision = snapshot.source_revision;
  const source_seal = seal(semanticSnapshot(snapshot));
  const report = {
    scorecard: scorecard(snapshot, policy, at, launchDate),
    examined: snapshot.contacts.length, prepared: recommendations.length, held: analysis.held,
    research: analysis.research, deferred_by_budget: analysis.deferred_by_budget,
    permission_review_required: analysis.eligible.filter(c => c.permission_review_required).map(c => c.contact.id),
    next_cursor: snapshot.next_cursor ?? null,
    authority: 'Drafts only. Krish checks permission and sends each exact message himself. No sending, posting, scheduling or spend.'
  };
  // Exclude delivery time from identity; changed source facts, policy or drafts create a new run.
  const { as_of, ...measures } = report.scorecard;
  const run_id = `gm-${seal({ source_seal, policy, day: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(at)), recommendations, report: { ...report, scorecard: measures } }).slice(0, 40)}`;
  return parseBatch({ version: 1, run_id, generated_at: at, canon_revision: snapshot.canon.revision, snapshot_revision, recommendations, report });
}
