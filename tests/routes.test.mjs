import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { routeFromEvidence, addressFrom, formFrom, ownSites, sameSite, roleRank, ownSentence, carriesWholeName } from '../src/stages/routes.mjs';
import { pitchRows } from '../src/stages/pitches.mjs';
import { runDispatch, foundRoutesField, foundRoutesAnswer, buildReport, laterVersion, REPORT_SCHEMA } from '../src/dispatch.mjs';
import { schemaErrors } from '../src/guards.mjs';
import { directiveFixture, violations, startProtocolService, STAND_IN_TOKEN, digest } from './support/engine-protocol-service.mjs';
import { capsContext, capsKit, AT } from './support/caps-scenario.mjs';

// 2026-10-30: an answered lookup's evidence becomes a route, or a hold that says it found nothing.
// Synthetic only: every domain is a reserved example or test name, every address invented.
const { canon, RECORD, GOALS } = capsKit({ parseCanon, blobSha, parseRecord });
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));

const SUMMIT = { name: 'The Example Summit 1', event_url: 'https://summit.example/1', cfp_url: null };
const item = (url, title, snippet) => ({ url, title, snippet, published: '2026-10-20' });
const ROLE = item('https://summit.example/1/contact', 'Contact The Example Summit 1', 'Talk ideas go to speakers@summit.example, and anything else to info@summit.example.');
const THIRD = item('https://directory.test/best-summits', 'Ten summits worth attending', 'Write to booking@directory.test to be listed, or speakers@summit.example.');
const FORM = item('https://summit.example/1/call-for-speakers', 'Call for speakers', 'Submit a talk by 1 November.');

/** The caps fixture with summit 1, show 1 and guest 1 held only for an address, and the research given. */
function heldContext(research = []) {
  const c = capsContext();
  for (const t of c.records.visibility) if ([id(601), id(401)].includes(t.id)) t.booking_contact_id = null;
  c.routes[id(801)] = { email: null, in_network: false };
  c.research = research;
  return c;
}
const answered = (base, evidence, status = evidence.length ? 'answered' : 'empty') => ({ request_id: `${base}:2026-10-26:abcdef01`, kind: 'search', status, evidence, answer: null, requested_at: '2026-10-26T05:10:00Z', answered_at: '2026-10-26T05:10:02Z' });
const rows = research => pitchRows({ context: heldContext(research), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });

test('a same-domain role address read on the subject\'s own page is the route, the booking role first, with its page as provenance', () => {
  assert.deepEqual(ownSites(SUMMIT), ['summit.example']);
  assert.deepEqual(routeFromEvidence([ROLE], SUMMIT, 'stage'), { kind: 'email', address: 'speakers@summit.example', source_url: ROLE.url, basis: 'role' });
  assert.equal(roleRank('noreply'), null);
  assert.equal(roleRank('press'), null);
  assert.equal(sameSite('events.summit.example', 'summit.example'), true);
  assert.equal(sameSite('co.uk', 'summit.co.uk'), false, 'a bare suffix is no site');
});

test('a third party\'s address is refused, and so is the subject\'s address read on a third party\'s page that does not name it', () => {
  assert.equal(routeFromEvidence([THIRD], SUMMIT, 'stage'), null);
  const named = item('https://directory.test/the-example-summit-1', 'The Example Summit 1 on Directory', 'Book through speakers@summit.example or booking@directory.test.');
  assert.deepEqual(routeFromEvidence([named], SUMMIT, 'stage'), { kind: 'email', address: 'speakers@summit.example', source_url: named.url, basis: 'role' }, 'its own listing: only the address on its own domain');
});

test('a personal-looking address counts only where the words before it make it the way to book; a policy address never', () => {
  const plain = item('https://summit.example/1/team', 'Our team', 'Avery runs operations: avery.sample@summit.example.');
  const booking = item('https://summit.example/1/team', 'Our team', 'To pitch a talk, write to avery.sample@summit.example.');
  const policyOnly = item('https://summit.example/1/privacy', 'Privacy', 'Questions to privacy@summit.example or noreply@summit.example.');
  assert.equal(addressFrom([plain], SUMMIT), null);
  assert.equal(addressFrom([booking], SUMMIT)?.basis, 'named_booking');
  assert.equal(routeFromEvidence([policyOnly], SUMMIT, 'stage'), null);
});

test('with no address, the subject\'s own speaker page is the route to the form lane; a ticket page or another site\'s form is not', () => {
  assert.deepEqual(routeFromEvidence([FORM], SUMMIT, 'stage'), { kind: 'form', url: FORM.url, source_url: FORM.url });
  assert.equal(formFrom([item('https://summit.example/1/apply/tickets', 'Apply for your pass', 'Register now.')], SUMMIT), null);
  assert.equal(formFrom([item('https://elsewhere.test/call-for-speakers', 'Call for speakers', 'Apply.')], SUMMIT), null);
  assert.equal(routeFromEvidence([ROLE, FORM], SUMMIT, 'stage').kind, 'email', 'an address beats a form');
});

test('a guest\'s own site gives a route only by a role address or one carrying the guest\'s name', () => {
  const guest = { name: 'Avery Sample', website: 'https://averysample.example' };
  assert.equal(routeFromEvidence([item('https://averysample.example/contact', 'Contact', 'Write to avery.sample@averysample.example.')], guest, 'guest')?.basis, 'own_name');
  assert.equal(routeFromEvidence([item('https://averysample.example/contact', 'Contact', 'Write to avery@averysample.example.')], guest, 'guest'), null, 'a first name alone is not the whole name');
  assert.equal(carriesWholeName('sampleavery', 'Avery Sample'), true);
  assert.equal(routeFromEvidence([item('https://averysample.example/contact', 'Contact', 'Write to jordan@averysample.example.')], guest, 'guest'), null, 'someone else\'s address');
  assert.equal(routeFromEvidence([item('https://averysample.example/speak', 'Speaking', 'Apply here.')], guest, 'guest'), null, 'no form lane for a guest');
});

// Review of 2026-10-30: three ways a route could have named someone else's address or form.
test('an inferred site must carry the subject\'s whole name as its label: a third party whose label only contains a word is refused, address and form alike', () => {
  const coffee = { name: 'Marketing Over Coffee' };
  const profs = item('https://marketingprofs.example/podcasts', 'Top 10 marketing podcasts: Marketing Over Coffee and more', 'Write to info@marketingprofs.example to suggest a show.');
  const profsForm = item('https://marketingprofs.example/contact', 'Marketing Over Coffee - contact us', 'Marketing Over Coffee');
  assert.deepEqual(ownSites(coffee, [profs, profsForm]), []);
  assert.equal(routeFromEvidence([profs], coffee, 'podcast'), null);
  assert.equal(routeFromEvidence([profsForm], coffee, 'podcast'), null, 'no third party\'s contact form for his Submit');
  assert.equal(routeFromEvidence([item('https://foundersfeedspot.example/x', 'Future Proof Founders podcast', 'Future Proof Founders. Contact hello@foundersfeedspot.example')], { name: 'Future Proof Founders' }, 'podcast'), null);
  assert.equal(routeFromEvidence([item('https://smithconsulting.example/contact', 'Jane Smith Consulting - contact Jane Smith', 'hello@smithconsulting.example')], { name: 'Jane Smith' }, 'guest'), null);
  // Its own site, named in full, still gives a role address; a personal one never, on a site the record does not declare.
  const own = item('https://marketingovercoffee.example/contact', 'Marketing Over Coffee: contact', 'Guests: guests@marketingovercoffee.example. To pitch, write to jordan.sample@marketingovercoffee.example.');
  assert.deepEqual(routeFromEvidence([own], coffee, 'podcast'), { kind: 'email', address: 'guests@marketingovercoffee.example', source_url: own.url, basis: 'role' });
  assert.equal(addressFrom([item(own.url, own.title, 'To pitch, write to jordan.sample@marketingovercoffee.example.')], coffee), null);
  assert.equal(routeFromEvidence([item('https://janesmith.example/contact', 'Jane Smith', 'jane.smith@janesmith.example')], { name: 'Jane Smith' }, 'guest'), null, 'an own-name address only on a declared site');
});

test('booking words count only in the address\'s own sentence, with no other address between', () => {
  const deep = { name: 'Deep Tech Talk', event_url: 'https://deeptechtalk.example' };
  assert.equal(routeFromEvidence([item('https://deeptechtalk.example/about', 'Deep Tech Talk Show', 'For bookings use the form. Our host is jane.doe@deeptechtalk.example')], deep, 'podcast'), null);
  assert.equal(addressFrom([item('https://deeptechtalk.example/about', 'About', 'To book, write to producer.sample@other.example or jane.doe@deeptechtalk.example')], deep), null, 'another address between');
  assert.equal(addressFrom([item('https://deeptechtalk.example/about', 'About', 'Book: jane.doe@deeptechtalk.example')], deep)?.basis, 'named_booking');
  assert.equal(ownSentence('For bookings use the form. Our host is '), ' Our host is ');
});

test('an address on the hosting platform\'s own domain is not the event\'s on its subdomain', () => {
  const ai = { name: 'AI Builders Summit 2026', event_url: 'https://aibuilders2026.sched.example/' };
  assert.equal(routeFromEvidence([item('https://aibuilders2026.sched.example/', 'AI Builders Summit 2026 schedule', 'Questions? hello@sched.example')], ai, 'stage'), null);
  assert.equal(routeFromEvidence([item('https://aibuilders2026.sched.example/', 'AI Builders Summit 2026 schedule', 'Questions? speakers@aibuilders2026.sched.example')], ai, 'stage')?.address, 'speakers@aibuilders2026.sched.example');
  assert.equal(sameSite('sched.example', 'aibuilders2026.sched.example'), false, 'never the parent');
});

test('answered evidence with a same-domain role address takes the stage out of no_booking_address, hands the route over, and the pitch is prepared once Control Center records it', () => {
  const r = rows([answered(`booking:${id(601)}`, [ROLE])]);
  assert.equal(r.lookups.answered.addresses, 1);
  assert.deepEqual(r.found, [{ subject_ref: `target:${id(601)}`, lane: 'stage', kind: 'email', address: 'speakers@summit.example', basis: 'role', source_url: ROLE.url, request_id: `booking:${id(601)}:2026-10-26:abcdef01` }]);
  assert.ok(r.stageHeld.includes('address_found'));
  assert.equal(r.lookups.requests.some(q => q.subject_ref === `target:${id(601)}`), false, 'a found route is not asked again');
  // Control Center records the address as the stage's booking contact (features.found_routes): the next run pitches it, for his yes.
  const c = heldContext([answered(`booking:${id(601)}`, [ROLE])]);
  c.records.visibility.find(t => t.id === id(601)).booking_contact_id = id(1601);
  const next = pitchRows({ context: c, weekGoals: GOALS, canon, record: RECORD, files: FILES, at: AT });
  const pitch = next.proposals.find(p => p.subject_ref === `target:${id(601)}`);
  assert.ok(pitch, 'prepared');
  assert.equal(JSON.parse(pitch.exact_payload).recipient_contact_id, id(1601));
  assert.equal(pitch.wall, 'send', 'still behind his yes');
});

test('a third-party address leaves the stage held as found nothing, and it is asked again in the next wording on a later day', () => {
  const r = rows([answered(`booking:${id(601)}`, [THIRD])]);
  assert.deepEqual(r.found, []);
  assert.ok(r.stageHeld.includes('lookup_found_nothing'));
  const again = r.lookups.requests.find(q => q.subject_ref === `target:${id(601)}`);
  assert.ok(again, 'asked again');
  assert.match(again.query, /site:summit\.example/, 'the second wording looks on its own site');
});

test('a form URL routes to the form lane: held as form_found, with the page handed over', () => {
  const r = rows([answered(`booking:${id(601)}`, [FORM])]);
  assert.ok(r.stageHeld.includes('form_found'));
  assert.deepEqual(r.found.map(f => [f.kind, f.url]), [['form', FORM.url]]);
});

test('empty evidence gives lookup_found_nothing, for a show and a guest too, and none of them counts as waiting', () => {
  const r = rows([answered(`booking:${id(401)}`, []), answered(`email:${id(801)}`, []), answered(`booking:${id(601)}`, [], 'answered')]);
  assert.ok(r.held.includes('lookup_found_nothing'));
  assert.ok(r.inviteHeld.includes('lookup_found_nothing'));
  assert.ok(r.stageHeld.includes('lookup_found_nothing'));
  assert.equal(r.lookups.waiting, 0, 'answered lookups are never waiting');
  assert.equal(r.lookups.answered.nothing, 3);
  // Only one with no status yet is waiting.
  const w = rows([{ request_id: `booking:${id(401)}:2026-10-26:abcdef01`, kind: 'search' }]);
  assert.equal(w.lookups.waiting, 1);
  assert.ok(w.held.includes('no_booking_address'));
});

/** One live run over the held context, with the capabilities and acceptance given; the posted report and the result. */
async function liveRun({ versions = ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features = {}, ack = {} } = {}) {
  const reports = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: versions.at(-1), week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: versions, features: { context: true, rows: true, research: true, network_routes: true, ...features } }),
    context: async () => ({ ok: true, context: heldContext() }),
    research: async requests => requests.map(q => ({ ...q, status: 'answered', evidence: q.subject_ref === `target:${id(601)}` ? [ROLE] : [], answer: null, requested_at: AT, answered_at: AT })),
    decisions: async () => [], postReport: async rep => { reports.push(rep); return { accepted: true, run_id: rep.run_id, payload_sha256: rep.payload_sha256, replayed: false, ...ack }; }, readReport: async () => reports.at(-1)
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-routes-12345', clock: () => AT,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
  return { result, report: reports[0] };
}
const SERVED = ['1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.16.0', '1.18.0'];
const ANSWER = { dry_run: false, checked: 1, recorded: 1, already: 0, refused: {}, routes: [{ subject_ref: `target:${id(601)}`, kind: 'email', request_id: `booking:${id(601)}:2026-10-30:abcdef01`, outcome: 'recorded' }] };

test('a live run reads this run\'s answer the same run, and no address leaves the engine while Control Center does not serve 1.18.0', async () => {
  const { result, report } = await liveRun({ features: { found_routes: true } });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.rows.lookups_found, 1, 'the answer this run gave is read this run');
  assert.ok(report.holds.some(h => h.reason === 'speak_address_found'));
  // The copied report schema carries found_routes (1.18.0), but the version is not served, so the field is not sent and the hold says why.
  assert.ok(REPORT_SCHEMA.properties.found_routes);
  assert.equal('found_routes' in report, false);
  assert.equal(report.schema_version, '1.9.0');
  assert.ok(report.holds.some(h => h.reason === 'found_routes_unrecorded'));
  assert.doesNotMatch(JSON.stringify(report), /@summit\.example/, 'no address in the report');
  assert.deepEqual(violations(schema, report), []);
  assert.equal(result.found_routes, undefined, 'no answer is read for routes never sent');
  // The field it would carry: the subject, the address and where it was read, nothing else.
  assert.deepEqual(foundRoutesField([{ subject_ref: 'target:x', lane: 'stage', kind: 'email', address: 'speakers@summit.example', basis: 'role', source_url: ROLE.url, request_id: 'booking:x:2026-10-27:abcdef01' }]),
    [{ subject_ref: 'target:x', kind: 'email', address: 'speakers@summit.example', source_url: ROLE.url, request_id: 'booking:x:2026-10-27:abcdef01' }]);
});

test('where Control Center serves 1.18.0 and features.found_routes, the route goes out at 1.18.0 and its answer is counted, never repeated', async () => {
  const { result, report } = await liveRun({ versions: SERVED, features: { found_routes: true }, ack: { found_routes: ANSWER } });
  assert.equal(result.status, 'succeeded');
  assert.equal(report.schema_version, '1.18.0');
  assert.equal(report.found_routes.length, 1);
  assert.deepEqual(Object.keys(report.found_routes[0]).sort(), ['address', 'kind', 'request_id', 'source_url', 'subject_ref']);
  assert.equal(report.found_routes[0].subject_ref, `target:${id(601)}`);
  assert.equal(report.found_routes[0].address, 'speakers@summit.example');
  assert.equal(report.found_routes[0].source_url, ROLE.url);
  assert.equal(report.holds.some(h => h.reason === 'found_routes_unrecorded'), false, 'nothing waits on Control Center');
  assert.deepEqual(violations(schema, report), []);
  assert.deepEqual(schemaErrors(REPORT_SCHEMA, report), []);
  // Only the route itself carries the address; no line, hold or proposal repeats it.
  const { found_routes, ...rest } = report;
  assert.doesNotMatch(JSON.stringify(rest), /@summit\.example/);
  assert.deepEqual(result.found_routes, { state: 'answered', sent: 1, recorded: 1, already: 0, refused: {}, line: 'Found routes: 1 sent; 1 recorded, 0 already on record, 0 refused.' });
  assert.doesNotMatch(JSON.stringify(result), /@summit\.example|summit\.example\/1\/contact/, 'the printed outcome never carries an address or a page');
});

test('features.found_routes off, or the field missing from the served versions, sends no route whatever else is served', async () => {
  const off = await liveRun({ versions: SERVED, features: { found_routes: false }, ack: { found_routes: ANSWER } });
  assert.equal('found_routes' in off.report, false);
  assert.ok(off.report.holds.some(h => h.reason === 'found_routes_unrecorded'));
  assert.notEqual(off.report.schema_version, '1.18.0');
  assert.equal(off.result.found_routes, undefined);
  const older = await liveRun({ versions: SERVED.filter(v => v !== '1.18.0'), features: { found_routes: true } });
  assert.equal('found_routes' in older.report, false);
  assert.ok(older.report.holds.some(h => h.reason === 'found_routes_unrecorded'));
});

test('the copied schema takes a route as an email with an address or a form with a page, never both, never neither, in both checkers', () => {
  const base = { schema_version: '1.18.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', run_id: 'mindmake:2026-10-30:synthetic', mode: 'synthetic', observed_at: AT, source: { revision: 'synthetic-revision-1', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], events: [], holds: [], payload_sha256: 'a'.repeat(64) };
  const email = { subject_ref: `target:${id(601)}`, kind: 'email', address: 'speakers@summit.example', source_url: ROLE.url, request_id: 'booking:x:2026-10-30:abcdef01' };
  const form = { subject_ref: `target:${id(601)}`, kind: 'form', url: FORM.url, source_url: FORM.url, request_id: 'booking:x:2026-10-30:abcdef01' };
  const check = routes => [violations(schema, { ...base, found_routes: routes }).length, schemaErrors(REPORT_SCHEMA, { ...base, found_routes: routes }).length];
  assert.deepEqual(check([email, form]), [0, 0]);
  for (const bad of [{ ...email, url: FORM.url }, { ...form, address: 'speakers@summit.example' }, (({ address, ...r }) => r)(email), (({ url, ...r }) => r)(form), { ...email, kind: 'phone' }, { ...email, subject_ref: 'person:x' }, { ...email, source_url: 'http://summit.example/' }]) {
    const [a, b] = check([bad]);
    assert.ok(a > 0 && b > 0, JSON.stringify(bad));
  }
  assert.ok(check(Array.from({ length: 41 }, () => email)).every(n => n > 0), 'at most 40');
});

test('the report goes to 1.18.0 only with a route in it, and to 1.16.0 with only a spend, whichever version the run chose', () => {
  const fields = { run_id: 'mindmake:2026-10-30:synthetic', mode: 'synthetic', observed_at: AT, source: { revision: 'synthetic-revision-1', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], holds: [], schema_version: '1.10.0' };
  const route = { subject_ref: `target:${id(601)}`, kind: 'email', address: 'speakers@summit.example', source_url: ROLE.url, request_id: 'booking:x:2026-10-30:abcdef01' };
  assert.equal(buildReport(fields).schema_version, '1.10.0');
  assert.equal(buildReport({ ...fields, found_routes: [] }).schema_version, '1.10.0', 'an empty list is not sent and raises nothing');
  assert.equal('found_routes' in buildReport({ ...fields, found_routes: [] }), false);
  assert.equal(buildReport({ ...fields, found_routes: [route] }).schema_version, '1.18.0');
  assert.equal(buildReport({ ...fields, found_routes: Array.from({ length: 45 }, () => route) }).found_routes.length, 40);
  const spend = [{ pool: 'apify-main', amount: 0.42, asset: 'Booking routes for four podcasts', objective_key: 'good_meetings' }];
  assert.equal(buildReport({ ...fields, credits_spent: spend }).schema_version, '1.16.0');
  const both = buildReport({ ...fields, credits_spent: spend, found_routes: [route] });
  assert.equal(both.schema_version, '1.18.0', 'the later of the two');
  assert.deepEqual(schemaErrors(REPORT_SCHEMA, both), []);
  assert.deepEqual(violations(schema, both), []);
  assert.equal(buildReport({ ...fields, schema_version: '1.2.0', credits_spent: spend }).schema_version, '1.16.0');
  assert.equal(laterVersion('1.9.0', '1.18.0'), '1.18.0');
  assert.equal(laterVersion('1.18.0', '1.16.0'), '1.18.0');
  assert.equal(laterVersion('1.10.0', '1.9.0'), '1.10.0');
});

test('Control Center\'s answer to the routes is counts and reasons only, a dry run says nothing was written, and an unreadable or failed answer counts nothing', () => {
  assert.equal(foundRoutesAnswer(0, ANSWER), null, 'no routes sent, no answer read');
  const refused = foundRoutesAnswer(3, { dry_run: false, checked: 3, recorded: 1, already: 0, refused: { source_not_in_evidence: 1, address_not_in_evidence: 1, 'Bad Reason!': 4, would_overwrite: 0 }, routes: [{ subject_ref: 'target:x', kind: 'email', request_id: 'r', outcome: 'recorded', address: 'leak@summit.example' }] });
  assert.equal(refused.line, 'Found routes: 3 sent; 1 recorded, 0 already on record, 2 refused (address_not_in_evidence 1, source_not_in_evidence 1).');
  assert.deepEqual(refused.refused, { address_not_in_evidence: 1, source_not_in_evidence: 1 });
  assert.doesNotMatch(JSON.stringify(refused), /leak@/, 'a route outcome is never copied');
  const dry = foundRoutesAnswer(2, { dry_run: true, checked: 2, recorded: 0, already: 0, refused: { form_not_same_site: 1 }, routes: [] });
  assert.equal(dry.state, 'dry_run');
  assert.equal(dry.line, 'Found routes: 2 sent; a dry run, nothing written: 2 checked, 1 refused (form_not_same_site 1).');
  assert.equal(foundRoutesAnswer(2, { error: 'found_routes_unrecorded' }).state, 'unrecorded');
  for (const bad of [undefined, null, [], 'yes', { recorded: 1 }, { recorded: -1, already: 0, refused: {} }, { recorded: 1, already: 0, refused: [] }]) assert.equal(foundRoutesAnswer(1, bad).state, 'unread', JSON.stringify(bad));
});

test('the protocol stand-in refuses found_routes on a report below 1.18.0 or where they are not served, and answers them where they are', async () => {
  const route = { subject_ref: `target:${id(601)}`, kind: 'email', address: 'speakers@summit.example', source_url: ROLE.url, request_id: 'booking:x:2026-10-30:abcdef01' };
  const fields = { run_id: 'mindmake:2026-10-30:synthetic', mode: 'synthetic', observed_at: AT, source: { revision: 'synthetic-revision-1', captured_at: AT }, status: 'ready', objectives: [], activity: [], proposals: [], holds: [], schema_version: '1.10.0' };
  const post = async (svc, report) => { const r = await fetch(`${svc.localOrigin}/api/growth/engines/mindmake/reports`, { method: 'POST', headers: { authorization: `Bearer ${STAND_IN_TOKEN}`, 'content-type': 'application/json', 'idempotency-key': report.run_id }, body: JSON.stringify(report) }); return { status: r.status, body: await r.json() }; };
  const withRoutes = buildReport({ ...fields, found_routes: [route] });
  const served = await startProtocolService({ recorded: false, foundRoutes: routes => ({ dry_run: true, checked: routes.length, recorded: 0, already: 0, refused: {}, routes: routes.map(r => ({ subject_ref: r.subject_ref, kind: r.kind, request_id: r.request_id, outcome: 'would_record' })) }) });
  const unserved = await startProtocolService({ recorded: false });
  try {
    const ok = await post(served, withRoutes);
    assert.equal(ok.status, 200);
    assert.equal(foundRoutesAnswer(1, ok.body.found_routes).line, 'Found routes: 1 sent; a dry run, nothing written: 1 checked, 0 refused.');
    assert.equal((await post(unserved, withRoutes)).status, 400);
    const stale = { ...withRoutes, schema_version: '1.16.0', run_id: 'mindmake:2026-10-29:synthetic' };
    const { payload_sha256, ...body } = stale;
    assert.equal((await post(served, { ...body, payload_sha256: digest(body) })).status, 400, 'a field newer than the version sent is refused');
  } finally { await served.close(); await unserved.close(); }
});
