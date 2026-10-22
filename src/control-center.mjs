import { parseBatch, parseSnapshot, semanticBatch } from '../contracts/growth.ts';
import { stable } from './guards.mjs';
import { parseAttempt, parseCapabilities, parseReviewContext, parseWeeklyReview } from '../contracts/operations.ts';
import { parseReport } from '../contracts/reporting.ts';
import { parseEngineContext, parseWorkBatch, semanticWorkBatch } from '../contracts/engine.ts';

const CODE = /^[a-z][a-z0-9_]{0,63}$/;
/** One bounded HTTPS transport for every Control Center route: no redirects, 20 s, JSON only, no retries. */
function httpsOrigin(base) {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Control Center must be a credential-free HTTPS origin');
  return origin;
}
async function transport({ origin, token, fetcher, method, path, body, headers = {}, timeoutMs = 20000 }) {
  const response = await fetcher(new URL(path, origin), { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json', ...headers }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs), ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    // Keep only a lower_snake code from the error body: never the body, a URL or a credential.
    let code = null;
    try { if (response.headers.get('content-type')?.includes('application/json')) { const text = await response.text(); if (text.length <= 20000) { const value = JSON.parse(text); code = [value?.error, value?.code].find(c => typeof c === 'string' && CODE.test(c)) ?? null; } } } catch { code = null; }
    const failure = new Error(`Control Center ${method} failed (${response.status}); no automatic retry`); failure.status = response.status; failure.code = code; throw failure;
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Control Center returned a non-JSON response');
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Control Center response exceeded the byte budget');
  try { return JSON.parse(text); } catch { throw new Error('Control Center returned invalid JSON'); }
}

export function client(base, token, { fetcher = fetch } = {}) {
  const origin = httpsOrigin(base);
  if (!token || /[\r\n]/.test(token)) throw new Error('Managed runtime credential is missing');
  const request = (method, query = '', body, path = '/api/growth/mindmake') => transport({ origin, token, fetcher, method, path: `${path}${query}`, body });
  const operation = (method, query, body) => request(method, query, body, '/api/growth/mindmake/operations');
  const work = (method, query, body) => request(method, query, body, '/api/growth/mindmake/work');
  const envelope = (value, field, parse) => { if (!value || value.ok !== true || !value[field]) throw new Error('Control Center operation was not acknowledged'); return parse(value[field]); };
  return {
    async engineContext() { return parseEngineContext(await work('GET', '?context=1')); },
    async workReceipt(id) { return validateWorkReceipt(await work('GET', `?run_id=${encodeURIComponent(id)}`), id); },
    async commitWork(value) {
      const batch = parseWorkBatch(value);
      const written = validateWorkReceipt(await work('POST', '', batch), batch.run_id);
      const observed = validateWorkReceipt(await work('GET', `?run_id=${encodeURIComponent(batch.run_id)}`), batch.run_id);
      const expected = stable(semanticWorkBatch(batch));
      if (expected !== stable(semanticWorkBatch(written.batch)) || expected !== stable(semanticWorkBatch(observed.batch))) throw new Error('Destination did not persist the complete work batch');
      if (stable({created:written.created,held:written.held}) !== stable({created:observed.created,held:observed.held})) throw new Error('Destination work readback disagrees with write receipt');
      return { ...observed, replayed: written.replayed };
    },
    async capabilities() { return parseCapabilities(await operation('GET', '?capabilities=1')); },
    async attempt(id) { const a = envelope(await operation('GET', `?attempt_id=${encodeURIComponent(id)}`), 'attempt', parseAttempt); if (a.attempt_id !== id) throw new Error('Destination attempt identity mismatch'); return a; },
    async recordAttempt(value) {
      const attempt = parseAttempt(value);
      const written = envelope(await operation('POST', '', { version: 1, kind: 'attempt', attempt }), 'attempt', parseAttempt);
      const observed = envelope(await operation('GET', `?attempt_id=${encodeURIComponent(attempt.attempt_id)}`), 'attempt', parseAttempt);
      if (stable(attempt) !== stable(written) || stable(attempt) !== stable(observed)) throw new Error('Destination attempt readback mismatch');
      return observed;
    },
    async reviewContext() { return parseReviewContext(await operation('GET', '?review_context=1')); },
    async review(id) { const r = envelope(await operation('GET', `?review_id=${encodeURIComponent(id)}`), 'review', parseWeeklyReview); if (r.review_id !== id) throw new Error('Destination review identity mismatch'); return r; },
    async commitReview(value) {
      const review = parseWeeklyReview(value);
      const written = envelope(await operation('POST', '', { version: 1, kind: 'review', review }), 'review', parseWeeklyReview);
      const observed = envelope(await operation('GET', `?review_id=${encodeURIComponent(review.review_id)}`), 'review', parseWeeklyReview);
      const semantic = r => { const { generated_at, ...body } = r; return stable(body); };
      if (semantic(review) !== semantic(written) || semantic(review) !== semantic(observed)) throw new Error('Destination weekly review readback mismatch');
      return observed;
    },
    async snapshot(cursor) { return parseSnapshot(await request('GET', cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')); },
    async receipt(runId) { return validateReceipt(await request('GET', `?run_id=${encodeURIComponent(runId)}`), runId); },
    async commit(batch) {
      parseBatch(batch);
      const written = validateReceipt(await request('POST', '', batch), batch.run_id);
      // A lost response is not retried here. Resume reads the durable receipt first.
      const observed = validateReceipt(await request('GET', `?run_id=${encodeURIComponent(batch.run_id)}`), batch.run_id);
      if (stable({ created: written.created, held: written.held }) !== stable({ created: observed.created, held: observed.held })) throw new Error('Destination readback disagrees with the write receipt');
      const expected = batch.recommendations.map(r => r.recommendation_id).sort();
      const actual = [...observed.created, ...observed.held].map(r => r.recommendation_id).sort();
      if (stable(expected) !== stable(actual)) throw new Error('Destination did not account for every recommendation');
      if (!observed.report || Array.isArray(observed.report) || typeof observed.report !== 'object' || stable(semanticBatch({ ...batch, report: observed.report })) !== stable(semanticBatch(batch))) throw new Error('Destination did not persist the consumed run report');
      return { ...observed, replayed: written.replayed };
    }
  };
}
export function validateWorkReceipt(value, runId) {
  if (!value || value.ok !== true || !Array.isArray(value.created) || !Array.isArray(value.held) || typeof value.replayed !== 'boolean') throw new Error('Destination did not acknowledge the work batch');
  const batch = parseWorkBatch(value.batch);
  if (batch.run_id !== runId) throw new Error('Destination work identity mismatch');
  const ids=[],records=[];
  for (const item of value.created) { if (!item || typeof item.item_id !== 'string' || typeof item.record_id !== 'string' || !item.record_id.trim()) throw new Error('Invalid created work receipt'); ids.push(item.item_id); records.push(item.record_id); }
  for (const item of value.held) { if (!item || typeof item.item_id !== 'string' || typeof item.reason !== 'string' || !item.reason.trim()) throw new Error('Invalid held work receipt'); ids.push(item.item_id); }
  if (new Set(ids).size !== ids.length || new Set(records).size !== records.length || stable(ids.sort()) !== stable(batch.items.map(i=>i.item_id).sort())) throw new Error('Destination did not account for every distinct work item');
  return value;
}
export function validateReceipt(value, runId) {
  if (!value || value.ok !== true || value.run_id !== runId || !Array.isArray(value.created) || !Array.isArray(value.held)) throw new Error('Control Center did not return a durable run receipt');
  const ids = [];
  for (const r of value.created) { if (typeof r.recommendation_id !== 'string' || !r.recommendation_id.trim() || typeof r.deal_id !== 'string' || !r.deal_id.trim()) throw new Error('Invalid created receipt'); ids.push(r.recommendation_id); }
  for (const r of value.held) { if (typeof r.recommendation_id !== 'string' || !r.recommendation_id.trim() || typeof r.reason !== 'string' || !r.reason.trim()) throw new Error('Invalid hold receipt'); ids.push(r.recommendation_id); }
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate recommendation in receipt');
  if (!value.report || typeof value.report !== 'object' || Array.isArray(value.report) || !Number.isInteger(value.report.prepared) || value.report.prepared !== ids.length) throw new Error('Destination receipt is missing its complete consumed run report');
  if (value.report.dashboard !== undefined && parseReport(value.report.dashboard).pipeline.prepared !== value.report.prepared) throw new Error('Destination receipt has inconsistent report counts');
  return value;
}

/**
 * The growth engine protocol 1.0.0 (docs/control-center/ENGINE-PROTOCOL.md), on the same
 * bounded transport. Every write is read back before it counts; nothing is retried blindly.
 * The bearer is this engine's own gen1_ token. It is never printed, logged or stored.
 */
export const ENGINE_SLUG = 'mindmake';
export function engineClient(base, token, { fetcher = fetch, slug = ENGINE_SLUG, timeoutMs = 20000 } = {}) {
  const origin = httpsOrigin(base);
  if (typeof token !== 'string' || !/^gen1_[A-Za-z0-9_-]{43,}$/.test(token)) throw new Error('Control Center engine credential is missing or malformed');
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug)) throw new Error('Invalid engine slug');
  const base_path = `/api/growth/engines/${slug}`;
  const call = (method, route, body, headers) => transport({ origin, token, fetcher, method, path: `${base_path}/${route}`, body, headers, timeoutMs });
  const sameAttempt = (a, b) => ['attempt_id','command','run_id','status','phase','error_code','started_at','finished_at'].every(k => (a[k] ?? null) === (b?.[k] ?? null));
  return {
    async capabilities() { return call('GET', 'capabilities'); },
    async context() { return call('GET', 'context'); },
    async outcomes() { return call('GET', 'outcomes'); },
    async prepareAction(id) { return call('GET', `prepare-action/${encodeURIComponent(id)}`); },
    async executeAction(id) { return call('POST', `execute/${encodeURIComponent(id)}`, {}); },
    async actionReceipt(id) { return call('GET', `execute/${encodeURIComponent(id)}`); },
    async reconcileAction(id) { return call('POST', `execute/${encodeURIComponent(id)}`, { reconcile: true }); },
    async directive() {
      const value = await call('GET', 'directive');
      if (!value || value.ok !== true || !value.directive || typeof value.directive !== 'object') throw new Error('Control Center returned no directive');
      return value;
    },
    async attempt(id) {
      const value = await call('GET', `attempts/${encodeURIComponent(id)}`);
      if (!value || value.ok !== true || value.attempt?.attempt_id !== id) throw new Error('Destination attempt identity mismatch');
      return value.attempt;
    },
    async recordAttempt(attempt) {
      const written = await call('POST', 'attempts', attempt);
      if (!written || written.ok !== true || !sameAttempt(attempt, written.attempt)) throw new Error('Control Center did not acknowledge the attempt');
      const observed = await this.attempt(attempt.attempt_id);
      if (!sameAttempt(attempt, observed)) throw new Error('Destination attempt readback mismatch');
      return { attempt: observed, replayed: written.replayed === true };
    },
    async postReport(report) {
      const ack = await call('POST', 'reports', report, { 'idempotency-key': report.run_id });
      if (!ack || ack.accepted !== true || ack.run_id !== report.run_id || typeof ack.replayed !== 'boolean') throw new Error('Control Center did not acknowledge the report');
      if (ack.payload_sha256 !== report.payload_sha256) throw new Error('Control Center computed a different report digest');
      return ack;
    },
    async readReport(runId) {
      const value = await call('GET', `reports/${encodeURIComponent(runId)}`);
      if (!value || value.accepted !== true || value.run_id !== runId || typeof value.payload_sha256 !== 'string') throw new Error('Control Center returned no stored report');
      return value;
    },
    async decisions(since) {
      const value = await call('GET', `decisions?since=${encodeURIComponent(since)}`);
      if (!value || value.ok !== true || !Array.isArray(value.decisions)) throw new Error('Control Center returned no decisions');
      for (const d of value.decisions) if (!d || typeof d.proposal_id !== 'string' || !['approved','declined','done'].includes(d.decision) || typeof d.decided_at !== 'string' || !(d.payload_sha256 === null || /^[0-9a-f]{64}$/.test(d.payload_sha256))) throw new Error('Control Center returned an invalid decision');
      return value.decisions;
    }
  };
}
