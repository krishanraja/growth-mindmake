import { createServer } from 'node:http';
import { once } from 'node:events';
import { parseBatch, semanticBatch } from '../../contracts/growth.ts';
import { seal } from '../../src/guards.mjs';
import { parseAttempt, parseReviewContext, parseWeeklyReview } from '../../contracts/operations.ts';
import { parseWorkBatch, semanticWorkBatch, parseEngineContext } from '../../contracts/engine.ts';

/** Synthetic HTTP service for the published wire contract, never production storage. */
export async function startContractService({ sourceSnapshot, engineContext, token = 'synthetic-contract-service', extension, capabilities, reviewContext } = {}) {
  const runs = new Map();
  const recommendations = new Map();
  const attempts = new Map();
  const reviews = new Map();
  const workRuns = new Map(), workItems = new Map();
  const context = reviewContext && structuredClone(reviewContext);
  const requests = [];
  const faults = [];
  let mutations = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://synthetic.test');
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    const text = Buffer.concat(parts).toString('utf8');
    let body;
    try { body = text ? JSON.parse(text) : undefined; } catch { res.writeHead(400).end(); return; }
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
    const reply = (status, value, contentType = 'application/json') => {
      res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
      res.end(contentType === 'application/json' ? JSON.stringify(value) : String(value));
    };
    if (req.headers.authorization !== `Bearer ${token}`) { reply(401, { ok: false, error: 'unauthorized' }); return; }
    const fault = faults[0];
    if (fault && (!fault.method || req.method === fault.method) && (!fault.path || fault.path === url.pathname)) {
      faults.shift();
      if (fault.kind === 'html') { reply(200, '<html>Synthetic upstream error</html>', 'text/html'); return; }
      if (fault.kind === 'malformed') { reply(200, '{bad-json', 'text/plain'); return; }
      if (fault.kind === 'unavailable') { reply(503, { ok: false, error: 'synthetic_unavailable' }); return; }
    }
    try {
      if (extension) {
        const result = await extension({ method: req.method, url, body, runs, recommendations });
        if (result) { reply(result.status ?? 200, result.body); return; }
      }
      if (url.pathname === '/api/growth/mindmake/work') {
        if (req.method === 'GET' && url.searchParams.get('context') === '1') { reply(200,parseEngineContext(engineContext));return; }
        if (req.method === 'GET') { const r=workRuns.get(url.searchParams.get('run_id'));reply(r?200:404,r?{...r.receipt,replayed:true}:{ok:false,error:'work_not_found'});return; }
        if(req.method!=='POST'){reply(405,{ok:false});return;}
        const batch=parseWorkBatch(body),hash=seal(semanticWorkBatch(batch)),prior=workRuns.get(batch.run_id);
        if(prior){reply(prior.hash===hash?200:409,prior.hash===hash?{...prior.receipt,replayed:true}:{ok:false,error:'work_conflict'});return;}
        const created=[],held=[];
        for(const item of batch.items){if(workItems.has(item.item_id)){held.push({item_id:item.item_id,reason:'existing_work_item'});continue;}const record_id=`private-work-${workItems.size+1}`;workItems.set(item.item_id,{item:structuredClone(item),record_id});created.push({item_id:item.item_id,record_id});mutations++;}
        const receipt={ok:true,batch:structuredClone(batch),created,held,replayed:false};workRuns.set(batch.run_id,{hash,receipt});
        if(fault?.kind==='drop_after_commit'&&(!fault.method||req.method===fault.method)&&(!fault.path||fault.path===url.pathname)){req.socket.destroy();return;}
        reply(200,receipt);return;
      }
      if (url.pathname === '/api/growth/mindmake/operations') {
        if (req.method === 'GET') {
          if (url.searchParams.get('capabilities') === '1') { reply(200, capabilities); return; }
          if (url.searchParams.get('review_context') === '1') { reply(200, parseReviewContext(context)); return; }
          const kind = url.searchParams.has('attempt_id') ? 'attempt' : 'review';
          const value = kind === 'attempt' ? attempts.get(url.searchParams.get('attempt_id')) : reviews.get(url.searchParams.get('review_id'))?.review;
          reply(value ? 200 : 404, value ? { ok: true, [kind]: value } : { ok: false, error: 'not_found' }); return;
        }
        if (req.method !== 'POST' || body?.version !== 1) { reply(400, { ok: false, error: 'invalid_operation' }); return; }
        if (body.kind === 'attempt') {
          const next = parseAttempt(body.attempt);
          const prior = attempts.get(next.attempt_id);
          if (prior && (prior.command !== next.command || prior.started_at !== next.started_at || (prior.status !== 'started' && seal(prior) !== seal(next)))) { reply(409, { ok: false, error: 'attempt_conflict' }); return; }
          attempts.set(next.attempt_id, structuredClone(next));
          reply(200, { ok: true, attempt: next }); return;
        }
        if (body.kind === 'review') {
          const review = parseWeeklyReview(body.review);
          const { generated_at, ...semantic } = review;
          const hash = seal(semantic), prior = reviews.get(review.review_id);
          if (prior && prior.hash !== hash) { reply(409, { ok: false, error: 'review_conflict' }); return; }
          if (!prior) reviews.set(review.review_id, { hash, review: structuredClone(review) });
          reply(200, { ok: true, review: prior?.review ?? review }); return;
        }
        reply(400, { ok: false, error: 'invalid_operation' }); return;
      }
      if (url.pathname !== '/api/growth/mindmake') { reply(404, { ok: false }); return; }
      if (req.method === 'GET') {
        if (url.searchParams.has('run_id')) {
          const result = runs.get(url.searchParams.get('run_id'))?.receipt;
          reply(result ? 200 : 404, result ? { ...result, replayed: true } : { ok: false, error: 'run_not_found' });
        } else reply(200, structuredClone(sourceSnapshot));
        return;
      }
      if (req.method !== 'POST') { reply(405, { ok: false }); return; }
      const batch = parseBatch(body);
      const hash = seal(semanticBatch(batch));
      const prior = runs.get(batch.run_id);
      if (prior) { reply(prior.hash === hash ? 200 : 409, prior.hash === hash ? { ...prior.receipt, replayed: true } : { ok: false, error: 'run_id_conflict' }); return; }
      const created = [], held = [];
      for (const recommendation of batch.recommendations) {
        if (recommendations.has(recommendation.recommendation_id)) { held.push({ recommendation_id: recommendation.recommendation_id, reason: 'existing_recommendation' }); continue; }
        const result = { recommendation_id: recommendation.recommendation_id, deal_id: `20000000-0000-4000-8000-${String(recommendations.size + 1).padStart(12, '0')}` };
        recommendations.set(recommendation.recommendation_id, { ...result, recommendation: structuredClone(recommendation) });
        created.push(result); mutations++;
      }
      const receipt = { ok: true, run_id: batch.run_id, replayed: false, created, held, report: structuredClone(batch.report) };
      runs.set(batch.run_id, { hash, batch: structuredClone(batch), receipt });
      if (fault?.kind === 'drop_after_commit' && (!fault.method || req.method === fault.method) && (!fault.path || fault.path === url.pathname)) { req.socket.destroy(); return; }
      reply(200, receipt);
    } catch {
      reply(400, { ok: false, error: 'invalid_contract_payload' });
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const localOrigin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin: 'https://service.example.test', localOrigin, token, runs, recommendations, requests, attempts, reviews, workRuns, workItems,
    get mutations() { return mutations; },
    fault(kind, method, path) { faults.push({ kind, method, path }); },
    recordHumanFeedback(feedback) {
      if (!context) throw new Error('Synthetic feedback requires a review context');
      const next = parseReviewContext({ ...context, feedback: [...context.feedback.filter(f => f.recommendation_id !== feedback.recommendation_id), feedback] });
      context.feedback = structuredClone(next.feedback);
    },
    fetcher(input, init) {
      const logical = new URL(input);
      return fetch(new URL(logical.pathname + logical.search, localOrigin), init);
    },
    async close() {
      server.closeIdleConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}
