import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CONTRACT_NAMES, FEATURES } from '../../contracts/operations.ts';

export async function capabilities(changes = {}) {
  const hashes = {};
  for (const name of CONTRACT_NAMES) {
    hashes[name] = createHash('sha256').update(await readFile(new URL(`../../contracts/${name}.ts`, import.meta.url))).digest('hex');
  }
  return { version: 1, source_revision: 'synthetic-revision-1', contracts: hashes, features: Object.fromEntries(FEATURES.map(f => [f, true])), activation: { state: 'inactive', launch_date: null }, ...changes };
}

export function reviewContext(changes = {}) {
  return {
    version: 1, generated_at: '2026-10-16T13:00:00Z', source_revision: 'synthetic-revision-1', complete: true,
    week_starts: '2026-10-12', activation: { launch_date: null },
    metrics: { qualified_conversations: 2, pending_human_qualification: 3, paid_proofs: null, paid_proof_gap: null,
      prepared: 1, examined: 10, research_needed: 0, missing_current_buying_moment: 0, missing_person_company_evidence: 0, permission_review_required: 0 },
    coverage: { has_more: false, person: 5, company: 5, trigger: 5, source_ids: ['public-source-a'] },
    runs: { succeeded: 1, failed: 0, unknown: 0 }, feedback: [], commercial:{origins:[],promises:{due:0,overdue:0},proposals:{awaiting_decision:0,declined:0},founder_minutes:null,experiment:null}, ...changes
  };
}

export function attempt(changes = {}) {
  return { version: 1, attempt_id: 'gma-10000000-0000-4000-8000-000000000001', command: 'daily',
    started_at: '2026-10-16T13:00:00Z', finished_at: null, status: 'started', phase: 'capture', run_id: null, error_code: null, ...changes };
}
