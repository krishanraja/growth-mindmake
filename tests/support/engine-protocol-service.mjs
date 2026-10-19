import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/** Synthetic stand-in for Control Center's growth engine protocol 1.0.0, never production storage. */
const schema = JSON.parse(await readFile(new URL('../../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
export const STAND_IN_TOKEN = `gen1_${'S'.repeat(20)}synthetic_bearer_value_0001`;

// Independent of src/dispatch.mjs, so the digest and schema checks are not the producer checking itself.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const digest = report => { const { payload_sha256, ...rest } = report; return createHash('sha256').update(canonical(rest)).digest('hex'); };
export function violations(s, v, path = '$') {
  const out = [];
  if (s.const !== undefined && v !== s.const) out.push(path);
  if (s.enum && !s.enum.includes(v)) out.push(path);
  if (s.type) {
    const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (![].concat(s.type).some(x => x === t || (x === 'integer' && Number.isInteger(v)))) return [...out, `${path}:type`];
  }
  if (typeof v === 'string') {
    if (s.maxLength !== undefined && v.length > s.maxLength) out.push(`${path}:length`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) out.push(`${path}:pattern`);
    if (s.format === 'date-time' && Number.isNaN(Date.parse(v))) out.push(`${path}:date`);
  }
  if (Array.isArray(v)) { if (s.maxItems !== undefined && v.length > s.maxItems) out.push(`${path}:items`); v.forEach((x, i) => s.items && out.push(...violations(s.items, x, `${path}[${i}]`))); }
  else if (v && typeof v === 'object') {
    for (const k of s.required ?? []) if (!(k in v)) out.push(`${path}.${k}:required`);
    for (const [k, x] of Object.entries(v)) if (s.properties?.[k]) out.push(...violations(s.properties[k], x, `${path}.${k}`)); else if (s.additionalProperties === false) out.push(`${path}.${k}:unknown`);
  }
  return out;
}

export function directiveFixture(changes = {}) {
  return {
    ok: true, chosen_by: 'rule',
    directive: {
      schema_version: '1.0.0', directive_id: 'mindmake:2026-10-19', engine_id: 'growth-mindmake', for_date: '2026-10-19',
      aim: 'Every paid proof starts from a warm path or a room.',
      objectives: [
        { key: 'qualified_conversations', label: 'Qualified conversations', target: 5, unit: 'people', window: 'week', timezone: 'Europe/London', latest: null, availability: 'unreported' },
        { key: 'paid_proofs', label: 'Paid proofs', target: 1, unit: 'proofs', window: 'first_30_days', timezone: 'Europe/London', latest: null, availability: 'unreported' }
      ],
      next_action: { proposal_id: null, instruction: 'Propose your best move on the widest gap.', why: 'Nothing is proposed yet.', close_condition: null },
      decisions_since: [],
      constraints: { walls: 'Nothing sends, posts, spends, deletes or changes a permission without a decision from Krish whose payload_sha256 matches what you are about to do.', spend_cap_usd: 0, max_actions: 5 },
      in_house: { rule: 'Never a second note to someone Advisory holds.', counts: { week_start: '2026-10-19', advisory: { drafted_waiting: 2, sent_this_week: 1, replied_waiting: 0, calls_booked_this_week: 1, paid: 0 }, network: null, visibility: { stages_open: 3, applied_this_week: 0, rooms_going: 1 } } },
      ...changes
    }
  };
}

export async function startProtocolService({ token = STAND_IN_TOKEN, directive = directiveFixture(), decisions = [], activatedOn = '2026-10-18', active = true } = {}) {
  const reports = new Map(), attempts = new Map(), requests = [], faults = [];
  const base = '/api/growth/engines/mindmake/';
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://stand-in.test');
    const chunks = []; for await (const c of req) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
    let body; try { body = text ? JSON.parse(text) : undefined; } catch { reply(400, { error: 'invalid_json' }); return; }
    const route = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
    requests.push({ method: req.method, route, query: Object.fromEntries(url.searchParams), body, idempotency: req.headers['idempotency-key'] ?? null, authorization: req.headers.authorization ?? null });
    if (req.headers.authorization !== `Bearer ${token}`) { reply(401, { error: 'unauthorized' }); return; }
    const i = faults.findIndex(f => f.method === req.method && f.route === route);
    if (i >= 0) { const [f] = faults.splice(i, 1); if (f.drop) { req.socket.destroy(); return; } reply(f.status, f.body ?? { error: 'synthetic_fault' }); return; }
    if (route === null) { reply(404, { error: 'not_found' }); return; }
    if (req.method === 'GET' && route === 'capabilities') { reply(200, { schema_version: '1.0.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', idempotency: true, activation: { state: active ? 'active' : 'inactive', activated_on: activatedOn }, features: {} }); return; }
    if (req.method === 'GET' && route === 'directive') { reply(200, directive); return; }
    if (req.method === 'GET' && route === 'decisions') { reply(200, { ok: true, decisions }); return; }
    if (route === 'attempts' && req.method === 'POST') {
      const a = body;
      const terminal = ['succeeded', 'failed', 'unknown'].includes(a?.status);
      if (!a || typeof a.attempt_id !== 'string' || !['started', 'succeeded', 'failed', 'unknown'].includes(a.status) || (terminal ? typeof a.finished_at !== 'string' : 'finished_at' in a) || (a.status === 'failed' && !/^[a-z][a-z0-9_]{0,63}$/.test(a.error_code ?? ''))) { reply(400, { error: 'invalid_attempt' }); return; }
      const prior = attempts.get(a.attempt_id);
      if (prior && prior.status !== 'started' && canonical(prior) !== canonical(a)) { reply(409, { error: 'attempt_conflict' }); return; }
      const replayed = Boolean(prior && canonical(prior) === canonical(a));
      attempts.set(a.attempt_id, structuredClone(a));
      reply(200, { ok: true, attempt: a, ...(replayed ? { replayed: true } : {}) }); return;
    }
    if (route?.startsWith('attempts/') && req.method === 'GET') { const a = attempts.get(decodeURIComponent(route.slice(9))); reply(a ? 200 : 404, a ? { ok: true, attempt: a } : { error: 'not_found' }); return; }
    if (route === 'reports' && req.method === 'POST') {
      const problems = violations(schema, body);
      if (problems.length) { reply(400, { error: 'invalid_report', field: problems[0] }); return; }
      if (body.engine_id !== 'growth-mindmake' || body.product_slug !== 'mindmake') { reply(403, { error: 'wrong_engine' }); return; }
      if (req.headers['idempotency-key'] !== body.run_id) { reply(400, { error: 'idempotency_key_mismatch' }); return; }
      if (digest(body) !== body.payload_sha256) { reply(400, { error: 'payload_sha256_mismatch' }); return; }
      if (body.mode === 'live' && !active) { reply(409, { error: 'engine_inactive' }); return; }
      const prior = reports.get(body.run_id);
      if (prior && prior.payload_sha256 !== body.payload_sha256) { reply(409, { error: 'run_id_conflict' }); return; }
      if (!prior) reports.set(body.run_id, { payload_sha256: body.payload_sha256, mode: body.mode, accepted_at: '2026-10-19T05:11:00Z', report: structuredClone(body) });
      reply(200, { accepted: true, run_id: body.run_id, payload_sha256: body.payload_sha256, replayed: Boolean(prior) }); return;
    }
    if (route?.startsWith('reports/') && req.method === 'GET') {
      const r = reports.get(decodeURIComponent(route.slice(8)));
      reply(r ? 200 : 404, r ? { accepted: true, run_id: r.report.run_id, ...r } : { error: 'not_found' }); return;
    }
    reply(405, { error: 'method_not_allowed' });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const localOrigin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin: 'https://controlcenter.example.test', localOrigin, token, reports, attempts, requests,
    fault(method, route, status, body) { faults.push({ method, route, status, body }); },
    drop(method, route) { faults.push({ method, route, drop: true }); },
    fetcher(input, init) { const u = new URL(input); return fetch(new URL(u.pathname + u.search, localOrigin), init); },
    async close() { server.closeAllConnections(); await new Promise((r, j) => server.close(e => e ? j(e) : r())); }
  };
}
