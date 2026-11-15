import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companySite, companySites, takesCompanyRead, companyReadRequest, companyReadRequests, companyReadOnFile, companyFacts, companyReadLine,
  COMPANY_READS_PER_RUN, COMPANY_FACT_LABEL } from '../src/stages/company.mjs';
import { openingFact, openingFactWithSource, opening, validBuyerNote } from '../src/stages/openings.mjs';
import { amplifierRows } from '../src/stages/rows.mjs';
import { pilotRows, pilotTrigger } from '../src/stages/pilots.mjs';
import { canon, AT, id, daysAgo } from './support/section12.mjs';

// Plan item A2, the engine's side: a company's own site, read free by the research desk (`company_read`), so an
// opening with nothing of the person's own to cite can cite one thing their company says about itself.
// Every person, company, site and link below is invented; the sites are on the reserved example.com.

const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/rows.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Have a clear plan for driving partnerships and visibility for Mindmake'];
const ROUTE_OK = { email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false };
const SERVED = { research: { kinds: ['search', 'question', 'write', 'company_read'], per_day: { search: 120, question: 40, write: 150, company_read: 20 } } };
const NOT_SERVED = { research: { kinds: ['search', 'question', 'write'], per_day: { search: 120, question: 40, write: 150 } } };

// A close tie gone quiet with nothing of their own on the card to cite: no post, no move, no hook, no who.
const tie = (n, extra = {}) => ({ contact_id: id(200 + n), network_tier: '1_reciprocated', current_title: 'Chief Operating Officer', current_company: `Harbour Freight ${n}`, mindmake_fit: 70,
  known_since: '2020-01-01T00:00:00Z', email_last: daysAgo(200), hook: null, why_them: null, who: null, facts: [],
  contacts: { full_name: `Robin Sample${n}`, title: 'Chief Operating Officer', company: `Harbour Freight ${n}`, company_domain: `freight${n}.example.com`, status: 'active' }, ...extra });
const read = (site, extra = {}) => ({ request_id: `company:${site}:2026-10`, kind: 'company_read', subject_ref: null, query: site, status: 'answered', answer: `Read 2 pages of ${site}: home, about.`,
  evidence: [
    { title: 'About us', url: `https://${site}/about`, snippet: 'Founded by two drivers, now a fleet of electric trucks.', published: null },
    { title: 'Harbour Freight | Cold chain shipping', url: `https://${site}/`, snippet: 'Cold chain shipping | We move chilled food from farms to shops across three countries every night.', published: null },
  ], requested_at: daysAgo(2), answered_at: daysAgo(2), ...extra });
const ties = (list, research = []) => ({ feedback: [], research, quiet_ties: list, network: [], amplifier_candidates: [], routes: Object.fromEntries(list.map(t => [t.contact_id, ROUTE_OK])) });
const rowsOf = (context, extra = {}) => amplifierRows({ context, weekGoals: GOALS, canon, files: FILES, at: AT, openingsRequired: true, openingKind: 'write', ...extra });

test('the site is only the company domain Control Center serves, read by its own rules: never a name, an address, an IP, a reserved host or a personal mail service', () => {
  assert.equal(companySite('freight1.example.com'), 'freight1.example.com');
  assert.equal(companySite('WWW.Freight1.Example.com'), 'freight1.example.com');
  assert.equal(companySite('https://www.freight1.example.com/about?x=1'), 'freight1.example.com');
  for (const bad of ['', null, 'Harbour Freight', 'robin@freight1.example.com', '192.0.2.10', 'freight1.test', 'intranet.example', 'localhost', 'https://freight1.example.com:8080/', 'https://user:pw@freight1.example.com/', 'freight1', 'gmail.com', 'https://www.outlook.com/', 'mail.yahoo.com']) {
    assert.equal(companySite(bad), null, String(bad));
  }
  // Each served person's site by contact id, from any row that carries one; a person with none has none.
  const sites = companySites({ quiet_ties: [tie(1), tie(2, { contacts: { ...tie(2).contacts, company_domain: null } })], network: [], amplifier_candidates: [],
    records: { advisory: [{ contact_id: id(301), person: { contacts: { company_domain: 'works1.example.com' } } }] } });
  assert.deepEqual([...sites], [[id(201), 'freight1.example.com'], [id(301), 'works1.example.com']]);
});

test('a company read is asked only where Control Center serves the kind: its query is the site alone, its id stable per site and month', () => {
  assert.equal(takesCompanyRead(SERVED), true);
  assert.equal(takesCompanyRead(NOT_SERVED), false);
  assert.equal(takesCompanyRead(undefined), false);
  assert.deepEqual(companyReadRequests({ wants: [{ site: 'freight1.example.com', score: 1 }], research: [], at: AT, capabilities: NOT_SERVED }), [], 'not served, nothing asked');
  const q = companyReadRequest({ site: 'freight1.example.com', research: [], at: AT });
  assert.deepEqual(Object.keys(q).sort(), ['kind', 'query', 'request_id', 'subject_ref', 'why']);
  assert.deepEqual([q.request_id, q.kind, q.subject_ref, q.query], ['company:freight1.example.com:2026-10', 'company_read', null, 'freight1.example.com']);
  assert.ok(q.why.length <= 300 && !/Robin|Sample|Harbour|@/.test(q.why), 'no person and no company name in why');
  assert.deepEqual(companyReadRequest({ site: 'freight1.example.com', research: [], at: '2026-10-03T18:00:00Z' }).request_id, q.request_id, 'the same id all month');
  assert.equal(companyReadRequest({ site: 'freight1.example.com', research: [], at: '2026-11-02T09:00:00Z' }).request_id, 'company:freight1.example.com:2026-11');
});

test('never while a read from the last 30 days is on file; a read that could not run is asked again the next desk day under that day\'s id', () => {
  const site = 'freight1.example.com';
  assert.equal(companyReadRequest({ site, research: [read(site)], at: AT }), null, 'answered two days ago');
  assert.equal(companyReadRequest({ site, research: [read(site, { status: 'empty', evidence: [] })], at: AT }), null, 'nothing to read is an answer too');
  // A read from last month, 20 days ago, still stands; one 31 days ago does not.
  const lastMonth = read(site, { request_id: `company:${site}:2026-09`, requested_at: daysAgo(20), answered_at: daysAgo(20) });
  assert.equal(companyReadRequest({ site, research: [lastMonth], at: AT }), null);
  assert.equal(companyReadOnFile([lastMonth], site, AT)?.request_id, `company:${site}:2026-09`);
  const old = { ...lastMonth, requested_at: daysAgo(31), answered_at: daysAgo(31) };
  assert.equal(companyReadOnFile([old], site, AT), null);
  assert.equal(companyReadRequest({ site, research: [old], at: AT }).request_id, `company:${site}:2026-10`);
  // Another site's read is never this one's.
  assert.equal(companyReadOnFile([read('freight2.example.com')], site, AT), null);
  // Failed or over the cap yesterday: today's id; asked today already: nothing.
  for (const status of ['failed', 'over_cap']) {
    const tried = { request_id: `company:${site}:2026-10`, kind: 'company_read', subject_ref: null, query: site, status, evidence: [], answer: null, requested_at: daysAgo(1), answered_at: null };
    assert.equal(companyReadRequest({ site, research: [tried], at: AT }).request_id, `company:${site}:2026-10:2026-10-27`, status);
    assert.equal(companyReadRequest({ site, research: [{ ...tried, requested_at: AT }], at: AT }), null, `${status} today`);
  }
});

test('at most five a run, one a site, highest first, and never past what is left of the desk\'s day', () => {
  const wants = Array.from({ length: 8 }, (_, i) => ({ site: `freight${i + 1}.example.com`, score: i }));
  const out = companyReadRequests({ wants: [...wants, { site: 'freight8.example.com', score: 0 }], research: [], at: AT, capabilities: SERVED });
  assert.equal(out.length, COMPANY_READS_PER_RUN);
  assert.deepEqual(out.map(r => r.query), ['freight8.example.com', 'freight7.example.com', 'freight6.example.com', 'freight5.example.com', 'freight4.example.com']);
  // The day's cap counts reads the desk ran today; one over the cap or failed ran nothing.
  const today = Array.from({ length: 18 }, (_, i) => read(`ran${i}.example.com`, { requested_at: AT, answered_at: AT }));
  const left = companyReadRequests({ wants, research: [...today, { ...read('x.example.com'), status: 'over_cap', requested_at: AT }], at: AT, capabilities: SERVED });
  assert.equal(left.length, 2);
  assert.equal(companyReadRequests({ wants, research: [], at: AT, capabilities: { research: { kinds: ['company_read'], per_day: { company_read: 1 } } } }).length, 1);
  assert.equal(companyReadRequests({ wants: [{ site: 'Harbour Freight', score: 9 }], research: [], at: AT, capabilities: SERVED }).length, 0, 'never a site worked out from a name');
});

test("a read's facts: the home page's own words first, each labelled as read from the company's own site with its page as the source", () => {
  const facts = companyFacts(read('freight1.example.com'));
  assert.deepEqual(facts.map(f => [f.text, f.url]), [
    [`${COMPANY_FACT_LABEL} We move chilled food from farms to shops across three countries every night.`, 'https://freight1.example.com/'],
    [`${COMPANY_FACT_LABEL} Cold chain shipping.`, 'https://freight1.example.com/'],
    [`${COMPANY_FACT_LABEL} Founded by two drivers, now a fleet of electric trucks.`, 'https://freight1.example.com/about'],
  ]);
  assert.equal(facts[0].label, 'Their own site: freight1.example.com');
  // A name alone, an address, a number run or a link says nothing a note may carry.
  const noisy = read('freight1.example.com', { evidence: [{ title: 'Harbour Freight', url: 'https://freight1.example.com/', snippet: 'Call 020 7946 0000 9 today | Write to hello@freight1.example.com now | Visit freight1.example.com/team', published: null }] });
  assert.deepEqual(companyFacts(noisy), []);
  assert.deepEqual(companyFacts({ ...read('freight1.example.com'), status: 'empty', evidence: [] }), []);
  assert.deepEqual(companyFacts(null), []);
});

test("the person's own facts come first; a company fact is used only where they give none, and the one that fits the ask whole", () => {
  const facts = companyFacts(read('freight1.example.com'));
  const own = { hook: 'Rebuilt the night routes for chilled food last spring.', facts: [] };
  assert.equal(openingFactWithSource(own, [], facts).fact, openingFact(own), 'a person fact outranks the company');
  assert.equal(openingFactWithSource(own, [], facts).source, null);
  assert.equal(openingFact({}), '', 'with no company facts given, nothing changes');
  const got = openingFactWithSource({}, [], facts);
  assert.deepEqual(got, { fact: facts[0].text, source: { label: facts[0].label, url: facts[0].url } });
  // A catch-up's ask leaves a fact little room: the shortest page part that fits whole is taken, never a cut one.
  const op = opening({ id: id(201), name: 'Robin Sample1', card: {}, research: [], required: true, kind: 'write', last: 'Apr 2026', company: facts });
  assert.equal(op.hold, 'opening_waiting');
  assert.match(op.request.query, /from only this: Their company's site: Cold chain shipping\. Would you/);
  assert.equal(op.source.url, 'https://freight1.example.com/');
  // Nothing to cite at all still holds the email, as before.
  assert.equal(opening({ id: id(201), name: 'Robin Sample1', card: {}, research: [], required: true, kind: 'write' }).hold, 'opening_no_fact');
});

test("a close tie with nothing of their own to cite: their company's site is wanted, then cited, and its page is on the card", () => {
  const ctx = ties([tie(1)]);
  const before = rowsOf(ctx, { companyReads: true });
  assert.deepEqual(before.held, ['opening_no_fact']);
  assert.deepEqual(before.company_reads.map(w => w.site), ['freight1.example.com']);
  assert.equal('company_reads' in rowsOf(ctx), false, 'without the capability the rows say nothing new');
  assert.deepEqual(rowsOf(ctx).held, ['opening_no_fact']);
  // A tie with a fact of their own is never read for: the company's site could not be used.
  assert.deepEqual(rowsOf(ties([tie(2, { hook: 'Rebuilt the night routes for chilled food last spring.' })]), { companyReads: true }).company_reads, []);
  // The read is in: the desk is asked to write from the company fact, labelled.
  const asked = rowsOf(ties([tie(1)], [read('freight1.example.com')]), { companyReads: true });
  assert.deepEqual(asked.held, ['opening_waiting']);
  assert.deepEqual(asked.company_reads, []);
  const req = asked.research.find(r => r.request_id.startsWith('open:'));
  assert.match(req.query, /Their company's site: Cold chain shipping/);
  assert.equal(req.subject_ref, `contact:${id(201)}`);
  // The desk's catch-up passes the fixed rules: a row, with the page among the card's sources.
  const note = "It's been a while since we last spoke. I'm reaching out because I'm building Mindmake, AI that works the way a leader thinks, and I want views from people I rate. I thought of you because your company does cold chain shipping. Would you be open to a quick chat?";
  const done = rowsOf(ties([tie(1)], [read('freight1.example.com'), { ...req, status: 'answered', answer: note, evidence: [], requested_at: AT, answered_at: AT }]));
  assert.equal(done.rows.length, 1);
  const p = done.rows[0].proposal;
  assert.ok(p.card.sources.some(s => s.url === 'https://freight1.example.com/' && s.label === 'Their own site: freight1.example.com'));
  assert.match(JSON.parse(p.exact_payload).body, /your company does cold chain shipping/);
  // A sentence that breaks the fixed rules still holds the email.
  const bad = rowsOf(ties([tie(1)], [read('freight1.example.com'), { ...req, status: 'answered', answer: 'Your amazing company is incredible.', evidence: [], requested_at: AT, answered_at: AT }]));
  assert.equal(bad.rows.length, 0);
});

// A warm buyer on his closest tiers with no cited reason to write now.
const buyer = (n, extra = {}) => ({ contact_id: id(100 + n), network_tier: '1_reciprocated', current_title: 'Founder', current_company: `Example Works ${n}`, mindmake_fit: 70, sells_competing_services: false,
  who: `Founder of Example Works ${n}, a media data business.`, why_them: 'Runs a media data business that sells to publishers.', facts: [],
  known_since: '2019-03-01T00:00:00Z', email_last: daysAgo(21), contacts: { full_name: `Avery Example${n}`, title: 'Founder', company: `Example Works ${n}`, company_domain: `works${n}.example.com`, status: 'active' }, ...extra });
const listed = n => ({ id: id(n), contact_id: id(100 + n), state: 'listed', ask_kind: 'buyer', notes: null, trigger_found_at: null, listed_at: daysAgo(60 - n), intent_evidence: null, intent_evidence_url: null, last_post_at: null });
const warm = (n, research = []) => ({ records: { advisory: [listed(n)], visibility: [], drafts: [], guests: [] }, network: [buyer(n)], quiet_ties: [], amplifier_candidates: [],
  routes: { [id(100 + n)]: ROUTE_OK }, feedback: [], research });
const siteRead = read('works1.example.com', { evidence: [{ title: 'Example Works 1 | Audience data for publishers', url: 'https://works1.example.com/', snippet: 'Audience data for publishers | We help regional publishers sell their audience data to advertisers.', published: null }] });
const nothingFound = { request_id: `trigger:${id(101)}:2026-10:2026-10-27`, kind: 'question', subject_ref: `contact:${id(101)}`, query: 'q', status: 'answered', answer: 'Nothing found in the last 90 days.', evidence: [], requested_at: AT, answered_at: AT };

test("a warm buyer with no reason to write: the site is read alongside the month's question, and stands in only once that question found nothing", () => {
  const first = pilotRows({ context: warm(1), canon, at: AT, required: true, kind: 'write', companyReads: true });
  assert.deepEqual(first.held, ['no_trigger']);
  assert.deepEqual(first.company_reads, [{ site: 'works1.example.com', score: 1000 }]);
  assert.equal('company_reads' in pilotRows({ context: warm(1), canon, at: AT, required: true, kind: 'write' }), false);
  // The site is read but the month's question is still out: the news comes first, so it waits.
  const early = pilotRows({ context: warm(1, [siteRead]), canon, at: AT, required: true, kind: 'write', companyReads: true });
  assert.deepEqual(early.held, ['no_trigger']);
  assert.equal(pilotTrigger({ row: listed(1), person: buyer(1), research: [siteRead], at: AT, site: 'works1.example.com' }), null);
  // The question found nothing: their company's own site is the reason, labelled, with its page.
  const t = pilotTrigger({ row: listed(1), person: buyer(1), research: [siteRead, nothingFound], at: AT, site: 'works1.example.com' });
  assert.deepEqual(t, { signal: `${COMPANY_FACT_LABEL} We help regional publishers sell their audience data to advertisers.`, url: 'https://works1.example.com/', found_at: daysAgo(2), kind: 'company_site' });
  assert.equal(pilotTrigger({ row: listed(1), person: buyer(1), research: [siteRead, nothingFound], at: AT }), null, 'no site passed, no company reason');
  const asked = pilotRows({ context: warm(1, [siteRead, nothingFound]), canon, at: AT, required: true, kind: 'write', companyReads: true });
  assert.deepEqual(asked.held, ['note_waiting']);
  assert.match(asked.research[0].query, /from only this \(its "I" or "we" is the source, not Krish\): Their company's site: We help regional publishers/);
  // The desk's one sentence is read by the fixed allowlist, as any warm note's is.
  const sentence = 'I read on your company site that you help regional publishers sell their audience data to advertisers.';
  assert.equal(validBuyerNote(sentence, { name: 'Avery Example1', company: 'Example Works 1', trigger: t.signal, offer: canon.offer }).ok, true);
  assert.equal(validBuyerNote('I read that your company doubled its revenue with our pilot.', { name: 'Avery Example1', company: 'Example Works 1', trigger: t.signal, offer: canon.offer }).ok, false);
  const done = pilotRows({ context: warm(1, [siteRead, nothingFound, { ...asked.research[0], status: 'answered', answer: sentence, evidence: [], requested_at: AT, answered_at: AT }]), canon, at: AT, required: true, kind: 'write' });
  assert.equal(done.rows.length, 1);
  const p = done.rows[0].proposal;
  assert.match(JSON.parse(p.exact_payload).body, /^Hi Avery,\n\nI read on your company site that you help regional publishers/);
  assert.doesNotMatch(p.why, /Why now:/, 'a page of their own site is never said as news');
  assert.match(p.why, /Their company's site: We help regional publishers .* Source: https:\/\/works1\.example\.com\/\./);
  assert.ok(p.card.sources.some(s => s.label === 'Their own site: works1.example.com'));
  // A cited reason of their own still comes first.
  const news = { ...nothingFound, answer: 'Example Works 1 is rebuilding its pricing for AI agents this quarter, its chief executive said [1].', evidence: [{ url: 'https://example.org/news/1' }] };
  assert.equal(pilotTrigger({ row: listed(1), person: buyer(1), research: [siteRead, news], at: AT, site: 'works1.example.com' }).url, 'https://example.org/news/1');
});

test('on the protocol stand-in: the reads go after the warm buyers\' questions, the openings they unlock in the second round, and nothing new without the capability', async () => {
  const { runDispatch } = await import('../src/dispatch.mjs');
  const { directiveFixture } = await import('./support/engine-protocol-service.mjs');
  const { readFile } = await import('node:fs/promises');
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url), 'utf8'));
  const catchUp = "It's been a while since we last spoke. I'm reaching out because I'm building Mindmake, AI that works the way a leader thinks, and I want views from people I rate. I thought of you because your company does cold chain shipping. Would you be open to a quick chat?";
  const sentence = 'I read on your company site that you help regional publishers sell their audience data to advertisers.';
  const desk = r => r.kind === 'company_read' ? { status: 'answered', answer: `Read 1 page of ${r.query}: home.`, evidence: (r.query.startsWith('works') ? siteRead : read(r.query)).evidence.filter(e => new URL(e.url).pathname === '/') }
    : r.kind === 'write' ? { status: 'answered', evidence: [], answer: r.query.startsWith('Catch-up') ? catchUp : sentence }
      : { status: 'answered', evidence: [], answer: 'Nothing found in the last 90 days.' };
  const run = async ({ capabilities, many = 1 }) => {
    const reports = [], batches = [];
    const quiet = Array.from({ length: many }, (_, i) => tie(i + 1));
    const ctx = { schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: AT, coverage: [{ source: 'advisory', available: true, complete: true }],
      ...warm(1), quiet_ties: quiet, routes: { [id(101)]: ROUTE_OK, ...Object.fromEntries(quiet.map(t => [t.contact_id, ROUTE_OK])) } };
    const cc = {
      recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0' }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, voice_check: true }, ...capabilities }),
      context: async () => ({ ok: true, context: ctx }),
      research: async requests => { batches.push(requests); return requests.map(r => ({ ...r, requested_at: AT, answered_at: AT, ...desk(r) })); },
      voiceCheck: async () => ({ hard: [] }), decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1),
    };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-company-read-1', clock: () => AT,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/company.mjs', sha: 'c'.repeat(40) }], recordReader: async () => null });
    return { result, report: reports[0], batches };
  };
  const on = await run({ capabilities: SERVED });
  assert.equal(on.result.status, 'succeeded');
  const flat = on.batches.flat();
  const reads = flat.filter(r => r.kind === 'company_read');
  assert.deepEqual(reads.map(r => [r.request_id, r.query, r.subject_ref]), [['company:works1.example.com:2026-10', 'works1.example.com', null], ['company:freight1.example.com:2026-10', 'freight1.example.com', null]], 'the warm buyer first, then the tie');
  assert.ok(reads.every(r => !/Avery|Robin|Example Works|Harbour/.test(JSON.stringify(r))), 'the site only: no name in any field');
  const firstIds = on.batches[0].map(r => r.request_id);
  assert.ok(firstIds.findIndex(x => x.startsWith('trigger:')) < firstIds.findIndex(x => x.startsWith('company:')), 'after the warm buyers\' questions');
  const roundOf = pred => on.batches.findIndex(b => b.some(pred));
  assert.ok(roundOf(r => r.kind === 'company_read') < roundOf(r => r.kind === 'write' && r.subject_ref === `contact:${id(201)}`), "the tie's opening is asked once its site is read");
  const rows = on.report.proposals.filter(p => [`contact:${id(101)}`, `contact:${id(201)}`].includes(p.subject_ref)).map(p => [p.subject_ref, p.close_condition.reference]);
  assert.deepEqual(rows.sort(), [[`contact:${id(101)}`, 'reach_out:warm_ask'], [`contact:${id(201)}`, 'network:relationship']]);
  assert.ok(on.report.activity.some(a => a.line === companyReadLine({ company_reads_asked: 2, company_reads_answered: 2 })));
  // Not served: no company read, the tie and the buyer held as before.
  const off = await run({ capabilities: NOT_SERVED });
  assert.equal(off.batches.flat().some(r => r.kind === 'company_read'), false);
  assert.equal(off.report.proposals.some(p => [`contact:${id(101)}`, `contact:${id(201)}`].includes(p.subject_ref)), false);
  assert.equal(off.report.activity.some(a => a.line.startsWith('Company sites read')), false);
  // Never more than five a run, however many are held.
  const busy = await run({ capabilities: SERVED, many: 9 });
  assert.equal(busy.batches.flat().filter(r => r.kind === 'company_read').length, COMPANY_READS_PER_RUN);
});
