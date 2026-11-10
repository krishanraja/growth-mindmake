import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectDrafts, briefFor, validAnswer, tally, tallyLine, ledgerEntry, mergeLedger, outcomeOf, calibrate, calibrationLine, roleOf, readerFacts, LINKS, CALIBRATION } from '../src/crew/reader.mjs';
import * as readerLint from '../src/crew/lints/reader.mjs';
import * as readerCheck from '../src/crew/checks/reader.mjs';
import { crewShadow } from '../src/crew/shadow.mjs';

// The Reader Check (Ruling, Krish, 2026-11-10). Synthetic people and ids only.
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AT = '2026-11-10T09:00:00Z';
const action = (body, extra = {}) => JSON.stringify({ version: 2, kind: 'email', subject: 'A quick one', body, ...extra });
const card = { who: 'Avery Example, Chief Operating Officer at Example Retail.', known: 'You both worked at Example Media until 2019.', why: ['Moved to run operations at Example Retail this year.'] };
const proposal = (n, row = 'network', extra = {}) => ({ proposal_id: `gmw-${n}`, row, subject_ref: `contact:${id(n)}`, card, exact_payload: action('It has been a while. Would you be open to a quick chat?', extra) });
const answer = (pid, over = {}) => ({ id: pid, replies: true, reply: 'Happy to, next week works.', weakest_link: 'none', why: '"It has been a while." It reads like it is to me.', feels: 'remembered', ...over });

test('readers are built only from the card, and a draft with no words or no card facts is not read', () => {
  assert.deepEqual(readerFacts(card), [card.who, card.known, card.why[0]]);
  const items = selectDrafts([proposal(1), { ...proposal(2), card: {} }, { ...proposal(3), exact_payload: JSON.stringify({ version: 2, kind: 'form' }) }, { ...proposal(4), row: undefined }]);
  assert.deepEqual(items.map(i => i.proposal_id), ['gmw-1']);
  assert.equal(items[0].role, 'recipient');
  assert.equal(selectDrafts(Array.from({ length: 30 }, (_, i) => proposal(i + 1)), 99).length, 20, 'never more than 20 a run');
});

test('a show or stage, or anything in Jonny\'s box, is read by its booker', () => {
  assert.equal(roleOf(proposal(1, 'visibility')), 'booker');
  assert.equal(roleOf(proposal(1, 'events')), 'booker');
  assert.equal(roleOf(proposal(1, 'partners', { mailbox: 'jonny' })), 'booker');
  assert.equal(roleOf(proposal(1, 'partners')), 'recipient');
});

test('the brief carries the exact words and the card facts, and asks for honesty, never agreement', () => {
  const [item] = selectDrafts([proposal(1)]);
  const b = briefFor(item, '/x/01.json');
  assert.match(b, /It has been a while\. Would you be open to a quick chat\?/);
  for (const f of item.facts) assert.ok(b.includes(f));
  assert.match(b, /Do not be agreeable/);
  assert.match(b, /Do not invent anything else/);
  assert.equal(/[\u2013\u2014]/.test(b), false, 'no dash in the brief');
});

test('an answer is read by fixed rules and nothing is filled in for a reader', () => {
  assert.equal(validAnswer(answer('gmw-1'), 'gmw-1').ok, true);
  assert.equal(validAnswer(JSON.stringify(answer('gmw-1')), 'gmw-1').ok, true);
  assert.equal(validAnswer('```json\n' + JSON.stringify(answer('gmw-1')) + '\n```', 'gmw-1').ok, true);
  const bad = [
    [answer('gmw-2'), 'wrong_id'], ['not json', 'not_json'], [answer('gmw-1', { replies: 'yes' }), 'replies'],
    [answer('gmw-1', { reply: '' }), 'reply'], [answer('gmw-1', { weakest_link: 'tone' }), 'weakest_link'],
    [answer('gmw-1', { why: '' }), 'why'], [answer('gmw-1', { feels: 'happy' }), 'feels']
  ];
  for (const [a, reason] of bad) assert.deepEqual(validAnswer(a, 'gmw-1'), { ok: false, reason });
  assert.equal(validAnswer(answer('gmw-1', { replies: false, reply: '' }), 'gmw-1').ok, true, 'a no needs no reply');
  assert.equal(LINKS.length, 10);
});

test('the tally is counts and codes, never a word of a draft or an answer', () => {
  const items = selectDrafts([proposal(1), proposal(2), proposal(3, 'visibility')]);
  const got = new Map([['gmw-1', answer('gmw-1')], ['gmw-2', answer('gmw-2', { replies: false, reply: '', weakest_link: 'timing', feels: 'worked' })]]);
  const t = tally(items, got);
  assert.equal(t.read, 3); assert.equal(t.answered, 2); assert.equal(t.missing, 1); assert.equal(t.would_reply, 1);
  assert.deepEqual(t.weakest_links, [['timing', 1]]);
  const line = tallyLine(t);
  assert.match(line, /^Reader check, in shadow: read 3 drafts, 2 answered, 1 missing; would reply 1 of 2; weakest links: timing 1; feels: remembered 1, worked 1\. Simulated readers, never evidence; nothing is held\.$/);
  assert.equal(line.includes('quick chat'), false);
});

test('the ledger keeps keys and verdicts only, one per proposal and brief', () => {
  const [item] = selectDrafts([proposal(1)]);
  const e = ledgerEntry(item, answer('gmw-1'), AT);
  assert.deepEqual(Object.keys(e).sort(), ['brief_sha', 'briefed_at', 'feels', 'proposal_id', 'replies', 'role', 'row', 'subject_ref', 'weakest_link']);
  assert.equal(JSON.stringify(e).includes('quick chat'), false);
  assert.equal(mergeLedger([e], [e, { ...e, brief_sha: 'other' }]).length, 2);
});

// ── Calibration ────────────────────────────────────────────────────────────

const DAY = 86400000;
const iso = ms => new Date(ms).toISOString();
/** A world of `n` sends 10 days before AT: each predicted and each answered (or not) as given. */
function world(cases) {
  const sent = Date.parse(AT) - 10 * DAY;
  const ledger = [], feedback = [], network = [];
  cases.forEach(([predicted, replied], i) => {
    const n = i + 100;
    ledger.push({ proposal_id: `gmw-${n}`, subject_ref: `contact:${id(n)}`, row: 'network', role: 'recipient', brief_sha: 's', briefed_at: iso(sent - DAY), replies: predicted, weakest_link: 'none', feels: 'neither' });
    feedback.push({ proposal_id: `gmw-${n}`, subject_ref: `contact:${id(n)}`, row: 'network', carried_out: 'draft', decided_at: iso(sent) });
    network.push({ contact_id: id(n), email_last: replied ? iso(sent + 2 * DAY) : iso(sent - 40 * DAY) });
  });
  return { ledger, context: { feedback, network } };
}

test('an outcome is unsent, pending, unknown, replied or silent, never guessed', () => {
  const { ledger, context } = world([[true, true], [false, false]]);
  assert.equal(outcomeOf(ledger[0], context, AT), 'replied');
  assert.equal(outcomeOf(ledger[1], context, AT), 'silent');
  assert.equal(outcomeOf(ledger[0], { ...context, feedback: [] }, AT), 'unsent');
  assert.equal(outcomeOf(ledger[0], context, iso(Date.parse(AT) - 5 * DAY)), 'pending');
  assert.equal(outcomeOf(ledger[0], { ...context, network: [] }, AT), 'unknown');
});

test('calibration is too early below its pre-registered sample, whatever the rates', () => {
  const { ledger, context } = world(Array.from({ length: CALIBRATION.min_matured - 1 }, (_, i) => [i % 2 === 0, i % 2 === 0]));
  assert.equal(calibrate(ledger, context, AT).standing, 'too_early');
});

test('readers that predict real replies earn weight; readers no better than the majority guess are retired', () => {
  // 20 sends, 6 replies: it said yes to 8 (5 replied) and no to 12 (1 replied).
  const good = [...Array(5).fill([true, true]), ...Array(3).fill([true, false]), ...Array(1).fill([false, true]), ...Array(11).fill([false, false])];
  const c = calibrate(world(good).ledger, world(good).context, AT);
  assert.equal(c.matured, 20); assert.equal(c.replied, 6); assert.equal(c.standing, 'earns_weight');
  // An agreeable reader: yes to everything. It never beats the majority guess.
  const yes = [...Array(6).fill([true, true]), ...Array(14).fill([true, false])];
  assert.equal(calibrate(world(yes).ledger, world(yes).context, AT).standing, 'retire');
  assert.match(calibrationLine(c), /^Reader calibration: 20 predictions; 20 sent 7\+ days ago \(6 replied\), 0 pending, 0 never sent, 0 with no reply date; accuracy 80% against 70% for the majority guess; .*standing earns_weight\.$/);
});

// ── In the crew ────────────────────────────────────────────────────────────

test('in a dispatch the Reader Check finds nothing and measures nothing, and says why', () => {
  const s = crewShadow({ proposals: [proposal(1)], context: {}, at: AT });
  assert.equal(s.findings.filter(f => f.specialist === 'reader-check').length, 0);
  const m = s.measurements.find(x => x.check === 'reader.calibration');
  assert.deepEqual(m, { specialist: 'reader-check', check: 'reader.calibration', value: null, reason: readerCheck.NOT_IN_DISPATCH });
});

test('with a session\'s verdicts the lint reports, in shadow, and holds nothing', () => {
  const p = proposal(1);
  assert.equal(readerLint.applies(p), true);
  const f = readerLint.lint(p, { reader: new Map([['gmw-1', answer('gmw-1', { replies: false, reply: '', weakest_link: 'relevance', feels: 'worked' })]]) });
  assert.deepEqual(f.map(x => x.lint), ['reader.no_reply', 'reader.weakest_link', 'reader.feels_worked']);
  assert.deepEqual(readerLint.lint(p, { reader: null }), []);
});

// ── The CLI, end to end in a temporary folder ──────────────────────────────

test('the CLI writes briefs, refuses a bad answer, tallies, keeps the ledger across runs and calibrates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reader-'));
  const env = { ...process.env, READER_DIR: join(dir, 'reader') };
  const node = (args, input) => new Promise((ok, no) => {
    const child = execFile(process.execPath, [join(root, 'scripts/reader.mjs'), ...args], { env, cwd: root }, (e, stdout, stderr) => (e ? no(Object.assign(e, { stdout, stderr })) : ok({ stdout, stderr })));
    if (input !== undefined) { child.stdin.write(input); }
    child.stdin.end();
  });
  const report = join(dir, 'report.json');
  await writeFile(report, JSON.stringify({ report: { proposals: [proposal(1), proposal(2)] } }));
  const b = await node(['brief', '--report', report, '--at', AT]);
  assert.match(b.stdout, /Wrote 2 reader briefs \(2 sub-agent calls\)/);
  assert.deepEqual((await readdir(join(dir, 'reader', 'briefs'))).sort(), ['01.md', '02.md']);
  assert.equal(b.stdout.includes('quick chat'), false, 'nothing printed is a word of a draft');
  await assert.rejects(node(['save', 'gmw-1'], '{"id":"gmw-1"}'), /Refused/);
  await node(['save', 'gmw-1'], `Here is my answer: ${JSON.stringify(answer('gmw-1'))}`);
  const c = await node(['check']);
  assert.match(c.stdout, /1 of 2 readers answered in shape/);
  const t = await node(['tally']);
  assert.match(t.stdout, /read 2 drafts, 1 answered, 1 missing/);
  assert.match(t.stdout, /Ledger: 1 prediction /);
  await node(['brief', '--report', report, '--at', AT]);
  const ledger = JSON.parse(await readFile(join(dir, 'reader', 'ledger.json'), 'utf8'));
  assert.equal(ledger.length, 1, 'a new run keeps the ledger');
  const ctx = join(dir, 'context.json');
  await writeFile(ctx, JSON.stringify({ feedback: [], network: [] }));
  const cal = await node(['calibrate', '--context', ctx, '--at', AT]);
  assert.match(cal.stdout, /^Reader calibration: 1 prediction; 0 sent 7\+ days ago .*1 never sent.*standing too_early\./);
});
