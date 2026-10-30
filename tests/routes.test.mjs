import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord } from '../src/stages/canon.mjs';
import { routeFromEvidence, addressFrom, formFrom, ownSites, sameSite, roleRank, ownSentence, carriesWholeName } from '../src/stages/routes.mjs';
import { pitchRows } from '../src/stages/pitches.mjs';
import { runDispatch, foundRoutesField, REPORT_SCHEMA } from '../src/dispatch.mjs';
import { directiveFixture, violations } from './support/engine-protocol-service.mjs';
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

test('a live run reads this run\'s answer the same run, and no address leaves the engine until Control Center takes found routes', async () => {
  const reports = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: ['1.6.0', '1.7.0', '1.8.0', '1.9.0'], features: { context: true, rows: true, research: true, network_routes: true, found_routes: true } }),
    context: async () => ({ ok: true, context: heldContext() }),
    research: async requests => requests.map(q => ({ ...q, status: 'answered', evidence: q.subject_ref === `target:${id(601)}` ? [ROLE] : [], answer: null, requested_at: AT, answered_at: AT })),
    decisions: async () => [], postReport: async rep => { reports.push(rep); return { replayed: false }; }, readReport: async () => reports.at(-1)
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-routes-12345', clock: () => AT,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.rows.lookups_found, 1, 'the answer this run gave is read this run');
  const report = reports[0];
  assert.ok(report.holds.some(h => h.reason === 'speak_address_found'));
  // The copied report schema does not carry found_routes yet, so the field is not sent and the hold says why.
  assert.equal(REPORT_SCHEMA.properties.found_routes, undefined);
  assert.equal('found_routes' in report, false);
  assert.ok(report.holds.some(h => h.reason === 'found_routes_unrecorded'));
  assert.doesNotMatch(JSON.stringify(report), /@summit\.example/, 'no address in the report');
  assert.deepEqual(violations(schema, report), []);
  // The field it would carry: the subject, the address and where it was read, nothing else.
  assert.deepEqual(foundRoutesField([{ subject_ref: 'target:x', lane: 'stage', kind: 'email', address: 'speakers@summit.example', basis: 'role', source_url: ROLE.url, request_id: 'booking:x:2026-10-27:abcdef01' }]),
    [{ subject_ref: 'target:x', kind: 'email', address: 'speakers@summit.example', source_url: ROLE.url, request_id: 'booking:x:2026-10-27:abcdef01' }]);
});
