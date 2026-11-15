import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  plainAddress, domainOf, companyHost, sharedMailbox, countryOf, subscriberOf, coldVerdict, gateState, readGate, approvalOf,
  parseOptOuts, addOptOuts, parseOptOutRecord, coldGateFor, closedGate, CLOSED, gateLine, briefTakers, KRISH_ITEMS,
  GATE_HOLDS, CANDIDATE_HOLDS, COUNTRIES, CONFIG_PATH, OPT_OUTS_PATH,
} from '../src/stages/compliance.mjs';
import { analyse, scoreProspect, SCORERS, SCORE_FLOOR, POINTS } from '../src/stages/qualify.mjs';
import { plan } from '../src/orchestrator.mjs';
import { lessons, refusedBy } from '../src/stages/rows.mjs';
import { suppressionList, suppressionFields } from '../src/stages/suppression.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture } from './support/engine-protocol-service.mjs';
import { canon as syntheticCanon, CANON, NORTH_STAR } from './support/section12.mjs';
import { parseCanon } from '../src/stages/canon.mjs';
import { AT, POLICY, snapshot, contact, OPEN_COLD } from './helpers.mjs';

// Synthetic only: every domain below is under a reserved test name (.test or .invalid), and no person or company is real.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
const DAY = '2026-11-10';
const approved = (n = 1) => ({ approved_on: DAY, sha256: sha(`synthetic approval ${n}`) });
const allApproved = () => ({ version: 1, krish: { footer_words: approved(1), privacy_section: approved(2), legitimate_interests: approved(3), reviewer: approved(4) } });
const NOW = '2026-11-15T12:00:00Z';
const optOuts = (text = 'email\nleft@harborline.test\n') => addOptOuts(null, { text, at: NOW }).record;
const openGate = (text) => gateState({ config: allApproved(), optOuts: optOuts(text), at: NOW });
const usBuyer = (x = {}) => ({ subject_ref: 'contact:11111111-1111-4111-8111-111111111111', source: 'https://northwind.test/team', country: 'US', email: 'dana@northwind.test', company_domain: 'northwind.test', status: null, opted_out: false, brief_taker: false, ...x });

// ── One address, read strictly ───────────────────────────────────────────────

test('an address is read as given and held when it does not read as a real mailbox; nothing is repaired into another address', () => {
  assert.equal(plainAddress(' MAILTO:Dana.Reyes@Northwind.test?subject=Hello '), 'dana.reyes@northwind.test');
  assert.equal(plainAddress('<ops@tidewater.test>,'), 'ops@tidewater.test');
  assert.equal(plainAddress('team42@northwind.test'), 'team42@northwind.test', 'a few digits are part of a name');
  for (const bad of ['', null, 42, 'dana@@northwind.test', 'dana@northwind', '.dana@northwind.test', 'dana.@northwind.test', 'dana..reyes@northwind.test',
    'dana@-northwind.test', 'dana@northwind.t3st', 'firstname.lastname@northwind.test', 'noreply@northwind.test', 'dana@yourdomain.com',
    'dana@example.org', 'banner@3x.png', '9f8e7d6c5b4a39281706f5e4d3c2b1a0@mail.tidewater.test', '5550142-0199dana@northwind.test']) {
    assert.equal(plainAddress(bad), '', String(bad));
  }
});

test("a company address is on the company's own domain, a subdomain of it or the same name under another ending; anything else is another organisation's", () => {
  assert.equal(companyHost('northwind.test', 'https://www.northwind.test/team'), true);
  assert.equal(companyHost('mail.northwind.test', 'northwind.test'), true);
  assert.equal(companyHost('northwind.test', 'eu.northwind.test'), true);
  assert.equal(companyHost('northwind.example', 'northwind.test'), true, 'the same name under another ending');
  assert.equal(companyHost('ab.example', 'ab.test'), false, 'too short a name to match on alone');
  assert.equal(companyHost('nwlabs.test', 'northwind.test'), false);
  assert.equal(companyHost('northwindcraft.test', 'northwind.test'), false, 'a longer name is someone else until shown otherwise');
  assert.equal(companyHost('northwind.test', ''), false);
  assert.equal(sharedMailbox('sales@northwind.test'), true);
  assert.equal(sharedMailbox('Support.EMEA@northwind.test'), true);
  assert.equal(sharedMailbox('dana.reyes@northwind.test'), false);
  assert.equal(sharedMailbox('salesforce.admin@northwind.test'), false, 'a word that starts with one is not one');
});

test('a host is read bare from a web address, a host or an address, and anything with no real top-level name is no host', () => {
  assert.equal(domainOf('HTTPS://www.Northwind.test:8443/about?team=1'), 'northwind.test');
  assert.equal(domainOf('dana@northwind.test'), 'northwind.test');
  assert.equal(domainOf(' "eu.northwind.test." '), 'eu.northwind.test');
  for (const bad of ['northwind', 'not a domain', '', null, 'localhost', 'northwind.123', 'north_wind.test']) assert.equal(domainOf(bad), '', String(bad));
});

// ── Country and recipient type ───────────────────────────────────────────────

test('a country is read only from a code or its own name; a city or a region is unknown, never guessed', () => {
  for (const v of ['US', 'us', 'USA', 'U.S.', 'United States', 'united states of america']) assert.equal(countryOf(v), 'US', v);
  for (const v of ['GB', 'UK', 'U.K.', 'United Kingdom', 'Great Britain']) assert.equal(countryOf(v), 'GB', v);
  for (const v of ['CA', 'FR', 'AU', 'DE', 'EU']) assert.equal(countryOf(v), v, 'known, and held as not allowed');
  for (const v of ['London', 'New York', 'Austin, TX', 'England', 'ZZ', '', null, 7]) assert.equal(countryOf(v), null, String(v));
  assert.deepEqual(Object.keys(COUNTRIES), ['US', 'GB'], 'the allowlist is the ruled one, the United States and the United Kingdom, and no other');
  assert.equal(subscriberOf('Limited company'), 'corporate');
  assert.equal(subscriberOf('sole trader'), 'individual');
  assert.equal(subscriberOf('partnership'), 'individual');
  assert.equal(subscriberOf('unsure'), null);
});

test('an open gate allows a US business address and UK corporate subscribers on a company domain, and nothing else', () => {
  const gate = openGate();
  assert.equal(gate.open, true);
  assert.deepEqual(coldVerdict(usBuyer(), gate).holds, []);
  assert.deepEqual(coldVerdict(usBuyer({ email: 'hello@northwind.test' }), gate).holds, [], 'a role address on the company domain is business');
  assert.deepEqual(coldVerdict(usBuyer({ country: 'GB', subscriber: 'corporate' }), gate).holds, []);
  const held = (x, code) => { const v = coldVerdict(usBuyer(x), gate); assert.equal(v.allowed, false); assert.ok(v.holds.includes(code), `${code}: ${v.holds}`); };
  held({ country: 'GB' }, 'subscriber_unknown');
  held({ country: 'GB', subscriber: 'sole_trader' }, 'individual_subscriber');
  held({ country: 'CA' }, 'country_not_allowed');
  held({ country: 'France' }, 'country_unknown');
  held({ country: undefined }, 'country_unknown');
  held({ email: 'reader.two@gmail.com' }, 'not_a_business_address');
  held({ email: 'dana@studio-hire.test' }, 'other_organisation_address');
  held({ email: 'reader.three@mailinator.com' }, 'throwaway_address');
  held({ email: 'you@example.com' }, 'address_not_plausible');
  held({ email_guessed: true }, 'guessed_address');
  held({ company_domain: undefined }, 'company_domain_unknown');
  held({ email: undefined }, 'address_unread');
  held({ source: undefined }, 'source_missing');
  held({ source: 'a note' }, 'source_missing');
  held({ status: 'do_not_contact' }, 'do_not_contact');
  held({ opted_out: true }, 'opted_out');
  held({ brief_taker: true }, 'brief_taker');
  held({ brief_taker: undefined }, 'brief_takers_unread');
  // A domain alone (all Control Center may serve of an address) is judged the same way.
  assert.deepEqual(coldVerdict(usBuyer({ email: undefined, email_domain: 'northwind.test' }), gate).holds, []);
  held({ email: undefined, email_domain: 'gmail.com' }, 'not_a_business_address');
});

test('the old opt-outs are applied on the way in: an address on the list, or its whole domain, is held', () => {
  const gate = openGate('email,reason\nleft@harborline.test,asked\n"Gone@Northwind.test",bounced\n');
  assert.ok(coldVerdict(usBuyer({ email: 'gone@northwind.test' }), gate).holds.includes('opted_out_before'));
  const byDomain = openGate('domain\nhttps://www.northwind.test/\n');
  const v = coldVerdict(usBuyer(), byDomain);
  assert.ok(v.holds.includes('domain_suppressed'));
  assert.equal(v.record.suppression, 'suppressed');
  assert.ok(coldVerdict(usBuyer({ email: undefined, email_domain: 'northwind.test' }), byDomain).holds.includes('domain_suppressed'), 'a suppressed domain drops the whole company');
  assert.deepEqual(coldVerdict(usBuyer(), gate).holds, [], 'another address at the same company is not suppressed by one address');
});

test('the eligibility record carries what playbook 09 asks for and never an address, a name or the source text', () => {
  const v = coldVerdict(usBuyer(), openGate());
  assert.deepEqual(Object.keys(v.record).sort(), ['country', 'decision', 'holds', 'law', 'lawful_basis', 'purpose', 'recipient_type', 'reviewer', 'source_sha256', 'subject_ref', 'subscriber', 'suppression', 'version']);
  assert.equal(v.record.decision, 'allowed');
  assert.equal(v.record.country, 'US');
  assert.equal(v.record.law, 'CAN-SPAM');
  assert.equal(v.record.recipient_type, 'company_person');
  assert.equal(coldVerdict(usBuyer({ email: 'hello@northwind.test' }), openGate()).record.recipient_type, 'company_mailbox');
  assert.equal(v.record.suppression, 'clear');
  assert.equal(v.record.lawful_basis.sha256, approved(3).sha256);
  assert.equal(v.record.reviewer.sha256, approved(4).sha256);
  const text = JSON.stringify(v.record);
  assert.ok(!text.includes('@') && !text.includes('northwind') && !text.includes('Northwind'));
  for (const h of [...GATE_HOLDS, ...CANDIDATE_HOLDS]) assert.match(h, /^[a-z_]+$/);
});

// ── Krish's four, and the gate read back ─────────────────────────────────────

test("Krish's four are holds by name until each is recorded with a real day and a digest; a future day or a bad digest is no approval", () => {
  const none = gateState({ config: { version: 1, krish: { footer_words: null, privacy_section: null, legitimate_interests: null, reviewer: null } }, optOuts: null, at: NOW });
  assert.equal(none.open, false);
  assert.deepEqual(none.holds, ['footer_words_unapproved', 'privacy_section_unapproved', 'legitimate_interests_unassessed', 'reviewer_unnamed', 'opt_outs_not_imported']);
  const partial = allApproved(); partial.krish.reviewer = null;
  assert.deepEqual(gateState({ config: partial, optOuts: optOuts(), at: NOW }).holds, ['reviewer_unnamed']);
  assert.equal(approvalOf({ approved_on: '2026-12-01', sha256: sha('x') }, NOW), null, 'not yet');
  assert.equal(approvalOf({ approved_on: '2026-02-30', sha256: sha('x') }, NOW), null, 'no such day');
  assert.equal(approvalOf({ approved_on: DAY, sha256: 'not-a-digest' }, NOW), null);
  assert.equal(approvalOf(true, NOW), null);
  assert.equal(approvalOf(approved(), 'not a time'), null, 'no clock, no approval');
  assert.deepEqual(gateState({ config: null, optOuts: null, at: NOW }).holds.slice(0, 1), ['compliance_config_unreadable']);
  assert.ok(gateState({ config: { unreadable: true }, optOuts: optOuts(), at: NOW }).holds.includes('compliance_config_unreadable'));
  assert.deepEqual(gateState({ config: allApproved(), optOuts: { unreadable: true }, at: NOW }).holds, ['opt_outs_unreadable']);
  assert.deepEqual(gateState({ config: allApproved(), optOuts: { version: 1, imported_at: NOW, files: [], emails: [], domains: [] }, at: NOW }).holds, ['opt_outs_unreadable'], 'an import of no file is no import');
  assert.deepEqual(gateState({ config: allApproved(), optOuts: optOuts(), at: NOW }).holds, []);
  // With the gate closed, every recipient is held by everything still open, the gate's own holds first.
  assert.deepEqual(coldVerdict(usBuyer(), none).holds.slice(0, 5), none.holds);
  assert.deepEqual(coldVerdict(usBuyer(), null).holds.slice(0, 1), ['compliance_config_unreadable'], 'no gate read is a closed gate');
});

test("the repository's own record parses, names Krish's four and nothing else, and holds digests only", async () => {
  const cfg = JSON.parse(await readFile(new URL(`../${CONFIG_PATH}`, import.meta.url), 'utf8'));
  assert.equal(cfg.version, 1);
  assert.deepEqual(Object.keys(cfg.krish), KRISH_ITEMS.map(i => i.key));
  for (const [k, v] of Object.entries(cfg.krish)) assert.ok(v === null || (approvalOf(v, NOW) && Object.keys(v).length === 2), `${k} is null or { approved_on, sha256 }`);
});

test('the gate is read back from its files every time it is asked, and an absent or broken file is never taken as done', async () => {
  const files = { [CONFIG_PATH]: JSON.stringify(allApproved()) };
  const read = async p => { if (!(p in files)) { const e = new Error('absent'); e.code = 'ENOENT'; throw e; } return files[p]; };
  assert.deepEqual((await readGate({ at: NOW, read })).holds, ['opt_outs_not_imported']);
  files[OPT_OUTS_PATH] = JSON.stringify(optOuts());
  assert.equal((await readGate({ at: NOW, read })).open, true, 'the same reader, a later read, sees the import');
  files[OPT_OUTS_PATH] = '{ not json';
  assert.deepEqual((await readGate({ at: NOW, read })).holds, ['opt_outs_unreadable']);
  const failing = async () => { const e = new Error('denied'); e.code = 'EACCES'; throw e; };
  assert.ok((await readGate({ at: NOW, read: failing })).holds.includes('compliance_config_unreadable'));
  // The repository as it is: closed, by name.
  const real = await readGate({ at: NOW });
  assert.equal(real.open, false);
  for (const { hold } of KRISH_ITEMS) assert.ok(real.holds.includes(hold), hold);
});

// ── The importer ─────────────────────────────────────────────────────────────

test('an opt-out export is read by its address and domain columns, kept only as digests, and the same file twice changes nothing', () => {
  const unsubscribes = 'Email,Unsubscribed At\n"Left@Harborline.test",2026-01-02\nnot-an-address@,2026-01-03\n';
  const people = 'First Name,Company,Work Email,Company Website\nAva,Northwind,gone@northwind.test,https://www.quietcove.test/x\n';
  const plain = '# the old list\nleft@harborline.test\nquietcove.test\n\n';
  const a = parseOptOuts(unsubscribes), b = parseOptOuts(people), c = parseOptOuts(plain);
  assert.deepEqual([a.entries, a.skipped, b.entries, b.skipped, c.entries], [1, 1, 2, 0, 2]);
  assert.ok(a.emails.has(sha('email:left@harborline.test')));
  assert.ok(b.emails.has(sha('email:gone@northwind.test')) && b.domains.has(sha('domain:quietcove.test')), 'the email and website columns');
  assert.equal(b.domains.size, 1, 'a name or company column is never read as a host');
  assert.ok(c.emails.has(sha('email:left@harborline.test')) && c.domains.has(sha('domain:quietcove.test')), 'a plain list: an address, or else a host');
  assert.ok(parseOptOuts('Email Domain\nquietcove.test\n').domains.has(sha('domain:quietcove.test')), 'a domain heading wins over the word email in it');
  const first = addOptOuts(null, { text: unsubscribes, at: NOW });
  const both = addOptOuts(first.record, { text: people, at: NOW });
  const again = addOptOuts(both.record, { text: people, at: NOW });
  assert.deepEqual(again.record, both.record);
  assert.deepEqual(both.counts, { entries: 2, skipped: 0, emails: 2, domains: 1, files: 2 });
  assert.ok(parseOptOutRecord(both.record));
  const text = JSON.stringify(both.record);
  assert.ok(!text.includes('@') && !text.includes('harborline') && !text.includes('northwind') && !text.includes('quietcove'), 'no address or host in the record');
  assert.throws(() => addOptOuts({ version: 1 }, { text: plain, at: NOW }), /does not parse/);
  assert.throws(() => addOptOuts(null, { text: 'Name\nAva\n', at: NOW }), /nothing was added/, 'a file with no address or host is no import');
});

test('the import command holds with no export, refuses one inside the repository, and writes only digests to the ignored record', async () => {
  const work = await mkdtemp(join(tmpdir(), 'compliance-root-'));
  const exportsDir = await mkdtemp(join(tmpdir(), 'compliance-export-'));
  try {
    await mkdir(join(work, 'config'), { recursive: true });
    await cp(join(root, CONFIG_PATH), join(work, CONFIG_PATH));
    const run = (args, env = {}) => spawnSync(process.execPath, ['scripts/compliance.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH, COMPLIANCE_ROOT: work, ...env } });
    const absent = run(['import', '--file', join(exportsDir, 'missing.csv')]);
    assert.equal(absent.status, 2);
    assert.equal(JSON.parse(absent.stdout).hold, 'opt_out_file_absent');
    assert.equal(existsSync(join(work, OPT_OUTS_PATH)), false, 'nothing written');
    assert.equal(run(['import']).status, 2, 'no file named is absent too');
    const inside = run(['import', '--file', join(root, 'package.json')]);
    assert.equal(inside.status, 1);
    assert.equal(JSON.parse(inside.stdout).hold, 'opt_out_file_inside_repository');
    const file = join(exportsDir, 'old-opt-outs.csv');
    await writeFile(file, 'email\nleft@harborline.test\ngone@northwind.test\n');
    const ok = run(['import'], { MINDMAKE_OPT_OUTS_FILE: file });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout).imported, { entries: 2, skipped: 0, emails: 2, domains: 0, files: 1 });
    assert.ok(!(ok.stdout + ok.stderr).includes('@') && !(ok.stdout + ok.stderr).includes(exportsDir));
    const record = await readFile(join(work, OPT_OUTS_PATH), 'utf8');
    assert.ok(!record.includes('@') && parseOptOutRecord(JSON.parse(record)));
    const status = JSON.parse(run(['status']).stdout);
    assert.equal(status.gate, 'closed');
    assert.ok(!status.holds.includes('opt_outs_not_imported'));
    assert.deepEqual(status.holds, ['footer_words_unapproved', 'privacy_section_unapproved', 'legitimate_interests_unassessed', 'reviewer_unnamed']);
  } finally { await rm(work, { recursive: true, force: true }); await rm(exportsDir, { recursive: true, force: true }); }
});

// ── Before any cold note, on every route ────────────────────────────────────

test('a cold note is held unless the gate was read back, on the snapshot route and its follow-ups, and nothing warm is touched', () => {
  const warm = contact('warm-a', { relationship: 'warm' });
  const cold = contact('cold-a');
  const input = snapshot({ contacts: [cold, warm] });
  const held = plan(input, POLICY, { at: AT });
  assert.deepEqual(held.recommendations.map(r => r.mode), ['warm']);
  assert.deepEqual(held.report.held.filter(h => h.contact_id === 'cold-a').map(h => h.reason), [CLOSED]);
  assert.deepEqual(plan(input, POLICY, { at: AT, coldGate: coldGateFor(null) }).report.held.map(h => h.reason), [CLOSED]);
  // An open gate still judges the contact: a snapshot contact has no country, address or source, so it is held by what it lacks.
  const judged = plan(input, POLICY, { at: AT, coldGate: coldGateFor(openGate()) });
  assert.deepEqual(judged.report.held.map(h => h.reason), ['cold_source_missing']);
  assert.equal(analyse(input, POLICY, AT).eligible.length, 1);
  assert.equal(analyse(input, POLICY, AT, { cold_gate: OPEN_COLD }).eligible.length, 2);
  assert.equal(closedGate(), CLOSED);
});

test('the dispatch reads the gate back each run, holds the named cold job and says what is still open, by name', async () => {
  const NOW_RUN = '2026-10-25T12:00:00Z';
  const full = JSON.parse(await readFile(new URL('../fixtures/engine-context.json', import.meta.url), 'utf8'));
  full.generated_at = NOW_RUN; full.snapshot.generated_at = NOW_RUN;
  const registry = JSON.parse(await readFile(new URL('../config/campaigns.json', import.meta.url), 'utf8'));
  const context = { schema_version: '1.3.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW_RUN, coverage: [{ source: 'advisory', available: true, complete: true }], proof_permissions: { value: { assets: [] } }, records: { advisory: [] }, work_context: full };
  const go = async options => {
    const reports = [];
    let reads = 0;
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture(), capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { context: true } }), context: async () => ({ ok: true, context: structuredClone(context) }), decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy: POLICY, registry, attemptId: 'gma-compliance-12345678', clock: () => NOW_RUN, ...options(() => reads++) });
    return { result, report: reports[0], reads };
  };
  const real = await go(() => ({}));
  assert.equal(real.result.status, 'succeeded');
  assert.ok(real.report.holds.some(h => h.reason === 'work_cold_compliance_closed'), 'the named cold job is held by the gate');
  const line = real.report.activity.map(a => a.line).find(l => l.startsWith('Cold compliance gate: '));
  assert.ok(line, 'one line says so');
  for (const { hold } of KRISH_ITEMS) assert.ok(line.includes(hold), hold);
  assert.ok(line.includes('opt_outs_not_imported'));
  // The reader is asked once a run, and a reader that fails holds every cold note.
  const counted = await go(tick => ({ complianceReader: async () => { tick(); return gateState({ config: null, optOuts: null, at: NOW_RUN }); } }));
  assert.ok(counted.report.holds.some(h => h.reason === 'work_cold_compliance_closed'));
  const broken = await go(() => ({ complianceReader: async () => { throw new Error('unreadable'); } }));
  assert.ok(broken.report.holds.some(h => h.reason === 'work_cold_compliance_closed'));
  assert.match(broken.report.activity.map(a => a.line).find(l => l.startsWith('Cold compliance gate: ')), /cold_compliance_closed/);
  // With nothing cold to judge, no line is added.
  const quiet = structuredClone(context); quiet.work_context.jobs = quiet.work_context.jobs.filter(j => j.details?.mode !== 'named_cold');
  const reports = [];
  const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture(), capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, features: { context: true } }), context: async () => ({ ok: true, context: quiet }), decisions: async () => [], postReport: async r => { reports.push(r); return { replayed: false }; }, readReport: async () => reports.at(-1) };
  await runDispatch({ cc, source: async () => { throw Error('no'); }, policy: POLICY, registry, attemptId: 'gma-compliance-87654321', clock: () => NOW_RUN });
  assert.ok(!reports[0].activity.some(a => a.line.startsWith('Cold compliance gate: ')));
  assert.equal(gateLine(openGate(), 2), 'Cold compliance gate: open, and 2 cold drafts held by the recipient checks (country, recipient type, source or suppression).');
});

// ── Who took the free brief, out of every lane ──────────────────────────────

test('everyone who took the free brief is in no lane once Control Center serves them, and in the list Control Center applies', () => {
  const id = '22222222-2222-4222-8222-222222222222';
  assert.equal(briefTakers({ records: {} }), null, 'not served is unread, never none');
  const context = { feedback: [], records: { drafts: [], brief_takers: [{ contact_id: id.toUpperCase() }, { contact_id: 'not-an-id' }, null] } };
  assert.deepEqual([...briefTakers(context)], [`contact:${id}`]);
  const L = lessons([], NOW, [], briefTakers(context));
  assert.equal(refusedBy(L, { subject: `contact:${id}`, row: 'network' }, NOW), 'declined_person');
  assert.equal(refusedBy(lessons([], NOW, []), { subject: `contact:${id}`, row: 'network' }, NOW), null);
  assert.ok(suppressionList([], NOW, [], briefTakers(context)).never.includes(`contact:${id}`));
  assert.ok(suppressionFields(context, NOW).fields.suppression.never.includes(`contact:${id}`));
  assert.ok(!suppressionList([], NOW, []).never.length);
});

// ── The prospect score: a reason beside every point ─────────────────────────

const prospect = (x = {}) => ({ title: 'Chief Executive Officer', sector: 'Media', decision_authority: 'confirmed', moment: { stance: 'asking', url: 'https://www.linkedin.com/posts/synthetic-post-1', posted: '2026-11-10T09:00:00Z' }, evidence: { person: true, company: true }, email_route: 'verified', ...x });

test('every point a prospect scores says why, and the buyer is read from the canon', () => {
  const s = scoreProspect(prospect(), { buyer: syntheticCanon.buyer, at: NOW });
  assert.equal(s.score, 30 + 20 + 20 + 10 + 10 + 15 + 10);
  assert.deepEqual(s.reasons, [
    '+30 title in the canon\'s buyer group "CEO"',
    "+20 can move the decision (the canon's gate)",
    "+20 a buying moment the canon's best-fit moments support (asking, 5 days ago)",
    '+10 sector "media" is in the canon\'s horizon',
    '+10 current sourced evidence of the person and the company',
    '+15 an email route',
    '+10 the route is verified',
  ]);
  assert.deepEqual(s.ruled_out, []);
  assert.equal(s.qualified, true);
  assert.equal(s.floor, SCORE_FLOOR);
  assert.deepEqual(s.scorers, SCORERS.map(x => x.name));
  for (const r of s.reasons) assert.match(r, /^[+-]\d+ \S/);
  const thin = scoreProspect(prospect({ title: 'Analyst', decision_authority: 'unknown', moment: null, sector: 'retail', evidence: {}, email_route: 'none' }), { buyer: syntheticCanon.buyer, at: NOW });
  assert.deepEqual(thin.reasons, ['-20 no usable email route']);
  assert.equal(thin.qualified, false);
  const titleOnly = scoreProspect(prospect({ decision_authority: 'unknown', moment: null, sector: null, evidence: {}, email_route: 'unchecked' }), { buyer: syntheticCanon.buyer, at: NOW });
  assert.equal(titleOnly.score, 45);
  assert.equal(titleOnly.qualified, false, 'a title and a route alone do not clear the floor');
  const wedge = scoreProspect(prospect({ sector: 'publishing' }), { buyer: syntheticCanon.buyer, at: NOW });
  assert.ok(wedge.reasons.includes('+10 sector "publishing" is in the canon\'s sales wedge (internal only, never written)'));
  assert.equal(POINTS.no_route, -20);
});

test('a rule-out is listed apart from the points, and nothing ruled out qualifies whatever it totals', () => {
  const s = scoreProspect(prospect({ sells_competing_services: true, status: 'do_not_contact', decision_authority: 'none' }), { buyer: syntheticCanon.buyer, at: NOW });
  assert.equal(s.qualified, false);
  assert.deepEqual(s.ruled_out, ["cannot move the decision (the canon's gate)", 'marked do not contact or closed', 'sells what Mindmake sells']);
  assert.ok(s.score > SCORE_FLOOR, 'the points still say why');
  assert.ok(!s.reasons.some(r => r.includes('sells what')), 'a rule-out is never a point');
  assert.deepEqual(scoreProspect(prospect({ suppressed: true }), { buyer: syntheticCanon.buyer, at: NOW }).ruled_out, ['suppressed']);
});

test('the buyer is only what the canon says this run: with no buyer nothing is scored, and a group the canon drops scores nothing', () => {
  assert.deepEqual(scoreProspect(prospect(), { buyer: null, at: NOW }), { version: 1, floor: SCORE_FLOOR, scorers: SCORERS.map(x => x.name), score: null, reasons: [], ruled_out: [], qualified: false, hold: 'buyer_not_in_canon' });
  const without = parseCanon({ northStar: NORTH_STAR.replace('A founder, principal, portfolio owner or senior commercial leader', 'A principal or portfolio owner'), canon: CANON.replace('Founder. CEO. CRO, or whoever owns revenue. Strategy leader.', 'Strategy leader.') }).buyer;
  const s = scoreProspect(prospect(), { buyer: without, at: NOW });
  assert.ok(!s.reasons.some(r => r.includes('buyer group')), 'no title list of its own keeps the CEO in');
  // The stance a moment needs is one the canon's moments support, read live too.
  const noMoments = { ...syntheticCanon.buyer, moments: [] };
  assert.ok(!scoreProspect(prospect(), { buyer: noMoments, at: NOW }).reasons.some(r => r.includes('buying moment')));
});

test('a further scorer joins after the others, its points carry reasons like theirs and its rule-outs rule out', () => {
  const sdr = { name: 'sdr', score: p => ({ points: [[5, 'a synthetic SDR signal']], rule_out: p.title === 'Intern' ? ['a synthetic SDR rule-out'] : [] }) };
  const s = scoreProspect(prospect(), { buyer: syntheticCanon.buyer, at: NOW, scorers: [...SCORERS, sdr] });
  assert.equal(s.reasons.at(-1), '+5 a synthetic SDR signal');
  assert.deepEqual(s.scorers.at(-1), 'sdr');
  const intern = scoreProspect(prospect({ title: 'Intern' }), { buyer: syntheticCanon.buyer, at: NOW, scorers: [...SCORERS, sdr] });
  assert.deepEqual([intern.ruled_out, intern.qualified], [['a synthetic SDR rule-out'], false]);
});
