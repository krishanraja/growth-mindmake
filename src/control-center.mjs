import { parseBatch, parseSnapshot, semanticBatch } from '../contracts/growth.ts';
import { stable } from './guards.mjs';
import { parseAttempt, parseCapabilities, parseReviewContext, parseWeeklyReview } from '../contracts/operations.ts';
import { parseReport } from '../contracts/reporting.ts';

export function client(base, token, { fetcher = fetch } = {}) {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Control Center must be a credential-free HTTPS origin');
  if (!token || /[\r\n]/.test(token)) throw new Error('Managed runtime credential is missing');
  async function request(method, query = '', body, path = '/api/growth/mindmake') {
    const response = await fetcher(new URL(`${path}${query}`, origin), { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000), ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) { const failure = new Error(`Control Center ${method} failed (${response.status}); no automatic retry`); failure.status = response.status; throw failure; }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Control Center returned a non-JSON response');
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Control Center response exceeded the byte budget');
    try { return JSON.parse(text); } catch { throw new Error('Control Center returned invalid JSON'); }
  }
  const operation = (method, query, body) => request(method, query, body, '/api/growth/mindmake/operations');
  const envelope = (value, field, parse) => { if (!value || value.ok !== true || !value[field]) throw new Error('Control Center operation was not acknowledged'); return parse(value[field]); };
  return {
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
