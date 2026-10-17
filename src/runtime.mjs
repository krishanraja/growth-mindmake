import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FEATURES, parseAttempt } from '../contracts/operations.ts';
import { plan } from './orchestrator.mjs';
import { weeklyReview } from './weekly-review.mjs';
import { handoff } from './publish.mjs';

export async function contractHashes() {
  const result = {};
  for (const name of ['growth','reporting','operations']) result[name] = createHash('sha256').update(await readFile(new URL(`../contracts/${name}.ts`, import.meta.url))).digest('hex');
  return result;
}
export async function readiness(remote) {
  let actual;
  try { actual = await remote.capabilities(); } catch (error) {
    if ([404,405,501].includes(error.status)) return { ready: false, state: 'consumer_pending', contract_mismatches: [], missing_features: [...FEATURES], source_revision: null, activation: null };
    throw error;
  }
  const expected = await contractHashes();
  const contract_mismatches = Object.keys(expected).filter(k => actual.contracts[k] !== expected[k]);
  const missing_features = FEATURES.filter(k => actual.features[k] !== true);
  return { ready: !contract_mismatches.length && !missing_features.length, state: contract_mismatches.length || missing_features.length ? 'consumer_pending' : 'compatible', contract_mismatches, missing_features, source_revision: actual.source_revision, activation: actual.activation };
}
export class RunFailure extends Error {
  constructor(attempt) { super('Growth operation did not complete'); this.attempt = attempt; }
}
export async function execute(remote, policy, { command = 'daily', cursor, launchDate, clock = () => new Date().toISOString(), observe = () => {} } = {}) {
  if (!['daily','weekly-review'].includes(command)) throw new Error('Unknown live command');
  const ready = await readiness(remote);
  if (!ready.ready) throw new Error('Control Center reporting integration is not ready');
  const configuredLaunch = ready.activation.launch_date ?? undefined;
  if (launchDate && launchDate !== configuredLaunch) throw new Error('Launch date must match canonical activation');
  if (!configuredLaunch) throw new Error('Launch date must be recorded in the canonical activation state before writes');
  const attempt = parseAttempt({ version: 1, attempt_id: `gma-${randomUUID()}`, command, started_at: clock(), finished_at: null, status: 'started', phase: command === 'daily' ? 'capture' : 'review_context', run_id: null, error_code: null });
  observe({ attempt_id: attempt.attempt_id, state: 'attempt_pending' });
  try { await remote.recordAttempt(attempt); } catch { throw new RunFailure(parseAttempt({ ...attempt, status: 'unknown', finished_at: clock(), error_code: 'readback_unconfirmed' })); }
  let writeStarted = false;
  try {
    let artifact, receipt;
    if (command === 'daily') {
      const snapshot = await remote.snapshot(cursor);
      attempt.phase = 'plan'; artifact = plan(snapshot, policy, { at: clock(), launchDate: configuredLaunch });
      attempt.run_id = artifact.run_id; attempt.phase = 'handoff'; writeStarted = true;
      observe({ run_id: artifact.run_id, attempt_id: attempt.attempt_id, state: 'handoff_pending' });
      receipt = await handoff(artifact, remote);
    } else {
      const context = await remote.reviewContext();
      if (context.activation.launch_date !== configuredLaunch) throw new Error('Activation context changed');
      attempt.phase = 'review'; artifact = weeklyReview(context, policy, clock());
      attempt.run_id = artifact.review_id; writeStarted = true;
      observe({ review_id: artifact.review_id, attempt_id: attempt.attempt_id, state: 'handoff_pending' });
      receipt = await remote.commitReview(artifact);
    }
    attempt.phase = 'readback';
    await remote.recordAttempt(parseAttempt({ ...attempt, finished_at: clock(), status: 'succeeded' }));
    return { artifact, receipt, attempt_id: attempt.attempt_id };
  } catch {
    const phase = attempt.phase;
    const error_code = phase === 'readback' ? 'readback_unconfirmed' : writeStarted ? 'handoff_unconfirmed' : ['capture','review_context'].includes(phase) ? 'source_unavailable' : 'context_invalid';
    const terminal = parseAttempt({ ...attempt, finished_at: clock(), status: writeStarted ? 'unknown' : 'failed', error_code });
    if (phase !== 'readback') {
      try { await remote.recordAttempt(terminal); } catch { /* The original unknown outcome is preserved; no original write retry. */ }
    }
    throw new RunFailure(terminal);
  }
}
