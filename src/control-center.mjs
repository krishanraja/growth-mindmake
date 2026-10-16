import { parseBatch, parseSnapshot, semanticBatch } from '../contracts/growth.ts';
import { stable } from './guards.mjs';

export function client(base, token, { fetcher = fetch } = {}) {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Control Center must be a credential-free HTTPS origin');
  if (!token || /[\r\n]/.test(token)) throw new Error('Managed runtime credential is missing');
  async function request(method, query = '', body) {
    const response = await fetcher(new URL(`/api/growth/mindmake${query}`, origin), { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000), ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Control Center ${method} failed (${response.status}); no automatic retry`);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Control Center returned a non-JSON response');
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Control Center response exceeded the byte budget');
    try { return JSON.parse(text); } catch { throw new Error('Control Center returned invalid JSON'); }
  }
  return {
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
  return value;
}
