import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCanon, blobSha, parseRecord, RECORD_REPO, RECORD_PATH } from '../src/stages/canon.mjs';
import { pitchRows, formRows, stageForm, formAnswers, fieldAsk, formKey, answerFor, runnerPick, overlaps, labelLimit, wholeWithin, formRow, formBio, pitchedStages,
  FORM_EMAIL, FORM_SITE, SPEAKER_SITE, FORMS_PER_ROW, PITCHES_PER_RUN, BIO_MAX } from '../src/stages/pitches.mjs';
import { lessons, KRISH_TITLE, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, BECAUSE_MAX, TITLE_MAX_BRIEF } from '../src/stages/rows.mjs';
import { runDispatch } from '../src/dispatch.mjs';
import { directiveFixture, violations, parseActionV2 } from './support/engine-protocol-service.mjs';
import { golden } from './support/golden.mjs';

// Synthetic only: invented stages and forms, example links, no live record.
// The one address a form is given is his public business address (FORM_EMAIL).
const NOW = '2026-10-27T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'a'.repeat(40) }];
const GOALS = ['Speak at one event this month', 'Have a clear plan for driving partnerships and visibility for Mindmake'];
const RECEIPTS = `export const receipts = {\n  credentials: [\n    'Public Speaker (Example Concert Hall)',\n  ],\n  roles: [\n    {\n      org: 'Example Broadcasting',\n      title: 'Head of Data',\n      detail:\n        "grew data revenue from $1M to $9M in three years. Launched 12 products.",\n    },\n  ],\n};\n`;
const RECORD = { line: parseRecord(RECEIPTS), file: { repo: RECORD_REPO, path: RECORD_PATH, sha: blobSha(RECEIPTS) } };
const EM = String.fromCharCode(8212);

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const field = (label, over = {}) => ({ label, name: formKey(label).replace(/ /g, '_'), type: 'text', required: false, options: [], ...over });
const FIELDS = [
  field('Full name', { required: true }),
  field('Email', { type: 'email', required: true }),
  field('Company', { required: true }),
  field('Job title'),
  field('Website', { type: 'url' }),
  field('Phone', { type: 'tel' }),
  field('Talk title', { required: true }),
  field('Abstract', { type: 'textarea', required: true }),
  field('Short bio (max 60 words)', { type: 'textarea', required: true }),
  field('Session format', { type: 'select', options: ['Select one', 'Workshop', 'Keynote', 'Panel'] }),
  field('Track', { type: 'select', options: ['Choose a track', 'Brand and growth', 'AI and automation'] }),
  field('Subscribe me to the newsletter', { type: 'checkbox' }),
];
const summit = (n, over = {}) => ({ id: id(n), title: `The Example Summit ${n}`, type: 'conference', status: 'queued', verdict: 'take', organizer: 'Example Events Ltd', buried_at: null, applied_at: null,
  event_url: `https://summit.example/${n}`, cfp_url: `https://summit.example/${n}/speak`, deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-03-10T00:00:00Z', location: 'London',
  booking_contact_id: id(200 + n), booking_source: 'stage_page', audience: 'Marketing leaders at mid-size companies', angle: null, why_him: null, why_now: null,
  room_score: null, standing_score: null, only_him_score: null, suggested_talk_title: null, audience_size: null, updated_at: '2026-10-20T10:00:00Z',
  form_fields: FIELDS, form_fields_at: '2026-10-26T06:00:00Z', ...over });
const show = (n, over = {}) => ({ id: id(n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', verdict: 'unjudged', organizer: 'Avery Example', buried_at: null, applied_at: null,
  event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, cfp_url: `https://podcasts.example/show-${n}/guests`, episodes: 80, latest_episode_at: '2026-10-20T00:00:00Z',
  booking_contact_id: id(100 + n), booking_source: 'feed_owner', audience: 'Marketing leaders at mid-size companies', angle: null, why_him: null, why_now: null,
  form_fields: [field('Your name', { required: true }), field('Email address', { type: 'email', required: true }), field('What would you like to talk about on the show?', { type: 'textarea', required: true })], ...over });
const ctx = (visibility, over = {}) => ({ records: { visibility, drafts: [], forms: [], ...(over.records ?? {}) }, feedback: [], ...over, records: { visibility, drafts: [], forms: [], ...(over.records ?? {}) } });
const run = (visibility, over = {}, opts = {}) => pitchRows({ context: ctx(visibility, over), weekGoals: GOALS, canon, record: RECORD, files: FILES, at: NOW, titleMax: TITLE_MAX_BRIEF, ...opts });
const answersOf = p => Object.fromEntries(JSON.parse(p.exact_payload).form.answers.map(a => [a.label, a.value]));
const isForm = p => p.channel === 'form';
const opts = { L: lessons([], NOW), pitched: new Set(), at: NOW, canon, record: RECORD };
const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_LIKE = /\+?\d[\d\s().-]{6,}\d/;

test('each field is read by its own label: what the run can answer, and what is never his to give', () => {
  const ask = (label, type = 'text') => fieldAsk({ label, type });
  for (const [label, want] of [
    ['Full name', 'full_name'], ['Your name', 'full_name'], ['Speaker name *', 'full_name'], ['Name', 'full_name'],
    ['First name', 'first_name'], ['Given name', 'first_name'], ['Last name', 'last_name'], ['Surname', 'last_name'],
    ['Email', 'email'], ['E-mail address', 'email'], ['Work email', 'email'],
    ['Company', 'company'], ['Company name', 'company'], ['Organisation', 'company'], ['Organization', 'company'],
    ['Job title', 'job_title'], ['Your role', 'job_title'], ['Position', 'job_title'],
    ['Website', 'website'], ['Personal website', 'website'], ['LinkedIn profile URL', 'linkedin'],
    ['Short bio', 'bio'], ['Speaker biography', 'bio'], ['Tell us about yourself', 'bio'],
    ['Talk title', 'talk_title'], ['Title of your talk', 'talk_title'], ['Session title', 'talk_title'], ['Proposed title', 'talk_title'],
    ['Abstract', 'abstract'], ['Session description', 'abstract'], ['What will you talk about?', 'abstract'], ['What would you like to talk about on the show?', 'abstract'],
    ['Session format', 'format'], ['Type of session', 'format'], ['Topic', 'topic'], ['Track', 'topic'],
    ['City', 'location'], ['Where are you based?', 'location'], ['Country', 'location'],
    ['Phone', 'phone'], ['Mobile number', 'phone'], ['WhatsApp', 'phone'],
    ['Street address', 'address'], ['Postcode', 'address'], ['Card number', 'payment'], ['Speaking fee', 'payment'], ['Password', 'password'],
    ['Date of birth', 'birth'], ['Age', 'birth'], ['Gender', 'demographic'], ['Ethnicity', 'demographic'], ['Pronouns', 'demographic'],
    ['I agree to the terms and conditions', 'terms'], ['Privacy policy', 'terms'], ['I consent to being contacted', 'terms'],
    ['Co-speaker name', 'someone_else'], ['Referee email', 'someone_else'],
  ]) assert.equal(ask(label), want, label);
  assert.equal(ask('Anything', 'tel'), 'phone', 'a tel field is a phone whatever its label');
  assert.equal(ask('Preferred date', 'date'), 'number', 'a date or a number is never written');
  assert.equal(ask('Contact', 'email'), 'email');
  for (const label of ['Title', 'Company description', 'Event name', 'How did you hear about us?', 'Twitter handle', 'Headshot URL', 'Anything else?']) assert.equal(ask(label), null, label);
  assert.equal(fieldAsk({ label: 'Keynote', type: 'radio' }), null, 'a choice is never ticked for him');
  assert.equal(fieldAsk({ label: 'Company', type: 'checkbox' }), null, 'nor a box, whatever its label says');
  assert.equal(fieldAsk({ label: 'I agree to the code of conduct', type: 'checkbox' }), 'terms');
});

test('a stage\'s form is answered by each field\'s own label from what the run reads, and nothing he alone may give', () => {
  const f = stageForm(summit(1), opts);
  assert.equal(f.row, 'events');
  const a = JSON.parse(f.exact).form.answers;
  const by = Object.fromEntries(a.map(x => [x.label, x.value]));
  assert.equal(by['Full name'], 'Krish Raja');
  assert.equal(by.Email, FORM_EMAIL);
  assert.equal(by.Company, 'Mindmake');
  assert.equal(by['Job title'], KRISH_TITLE, 'the title the run already uses for him');
  assert.equal(by.Website, FORM_SITE);
  assert.equal(by['Talk title'], 'AI for marketing leaders');
  assert.ok(by.Abstract.startsWith('In "AI for marketing leaders", Krish Raja talks about what an AI that knows a marketing leader should actually do.'), 'the speaking words, plain');
  assert.ok(by.Abstract.includes(`"${canon.brain}"`) && by.Abstract.includes(RECORD.line));
  const bio = by['Short bio (max 60 words)'];
  assert.ok(bio.startsWith(`Krish Raja is ${KRISH_TITLE} and writes Make Your Mind Up (https://publication.example).`));
  assert.ok(bio.split(/\s+/).length <= 60 && /[.!?"]$/.test(bio), 'within the limit its own label states, cut at a whole sentence');
  assert.equal(by['Session format'], 'Keynote', 'a talk, from its own options, never a workshop');
  assert.equal(by.Track, 'AI and automation', 'the track named for AI first');
  assert.equal('Phone' in by, false, 'a phone is never answered');
  assert.equal(Object.keys(by).some(k => /newsletter/i.test(k)), false, 'a box is never ticked');
  assert.deepEqual(a.map(x => x.label), ['Full name', 'Email', 'Company', 'Job title', 'Website', 'Talk title', 'Abstract', 'Short bio (max 60 words)', 'Session format', 'Track'], 'in the form\'s own order');
  const split = stageForm(summit(2, { form_fields: [field('First name', { required: true }), field('Last name', { required: true }), field('Email', { type: 'email', required: true }), field('Talk topic', { required: true })] }), opts);
  assert.deepEqual(JSON.parse(split.exact).form.answers, [{ label: 'First name', value: 'Krish' }, { label: 'Last name', value: 'Raja' }, { label: 'Email', value: FORM_EMAIL }, { label: 'Talk topic', value: 'AI for marketing leaders' }]);
  const panel = stageForm(summit(3, { title: 'The CMO Panel Example', form_fields: [field('Email', { type: 'email', required: true }), field('Format', { type: 'select', required: true, options: ['Keynote', 'Panel'] }), field('Topic', { type: 'select', options: ['Leadership', 'Brand and growth'] })] }), opts);
  assert.deepEqual(answersOf({ exact_payload: panel.exact }), { Email: FORM_EMAIL, Format: 'Panel', Topic: 'Brand and growth' }, 'a panel seat where it says panel; the stage\'s own topic when no track names AI');
  const suggested = stageForm(summit(4, { suggested_talk_title: 'The org chart after AI' }), opts);
  assert.equal(answersOf({ exact_payload: suggested.exact })['Talk title'], 'The org chart after AI', 'the talk Nova suggested for the room');
});

test('a form is a 1.9.0 row action Control Center\'s own parser takes: no recipient, no mailbox, the page and every answer', () => {
  const r = run([summit(1)]);
  const p = r.proposals.find(isForm);
  const parsed = parseActionV2(p.exact_payload);
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.value.channel, 'form');
  assert.equal(parsed.value.recipient_contact_id, null);
  assert.equal(parsed.value.mailbox, null, 'a form is not a Jonny draft');
  assert.equal(parsed.value.subject, null);
  assert.equal(parsed.value.form.url, 'https://summit.example/1/speak');
  assert.equal(parsed.value.body, answersOf(p).Abstract, 'its words are the abstract');
  assert.deepEqual(Object.keys(JSON.parse(p.exact_payload)).sort(), ['body', 'channel', 'form', 'mailbox', 'recipient_contact_id', 'subject', 'version']);
  assert.equal(p.channel, 'form');
  assert.equal(p.row, 'events');
  assert.equal(p.rank, 1);
  assert.equal(p.wall, 'send');
  assert.equal(p.kind, 'prepared');
  assert.equal(p.stage, null);
  assert.equal(p.subject_ref, `target:${id(1)}`, 'about the stage');
  assert.equal(p.target, 'https://summit.example/1/speak', 'it goes to the page, never a person');
  assert.equal(p.amplifier_kind, 'ceo_educator', 'so a No\'s reason reaches stages like it');
  assert.equal(p.serves, 'Speak at one event this month');
  assert.deepEqual(p.close_condition, { event: 'form_submitted', reference: 'events:form' });
  assert.ok(Date.parse(p.expires_at) <= Date.parse('2026-11-20T00:00:00Z'), 'never outlives its call');
  assert.deepEqual(p.source_revision, [...FILES, RECORD.file]);
  assert.equal(p.title, 'Apply to speak at The Example Summit 1', 'what his tap does');
  assert.ok(p.title.length <= TITLE_MAX_BRIEF);
  assert.equal(p.because, 'A stage that asks for talks, call closes 20 Nov. Your tap applies.');
  assert.ok(p.because.length <= BECAUSE_MAX);
  assert.match(p.why, /asks for speakers through its own form/);
  const c = p.card;
  assert.ok(c.who.length <= CARD_WHO_MAX && c.who.startsWith('The Example Summit 1 is an event run by Example Events Ltd'));
  assert.match(c.known, /You do not know them yet\. The Example Summit 1's own page links this form for speakers, and your tap sends it/);
  assert.ok(c.known.length <= CARD_LINE_MAX);
  assert.equal(c.gain[0], 'The Example Summit 1 asked for talks through its own form: a talk for you, in front of Marketing leaders at mid-size companies.', 'what he gets: the stage asked');
  assert.ok([...c.why, ...c.gain, ...c.angles.map(x => x.line)].every(l => l.length <= CARD_LINE_MAX));
  assert.ok(c.sources.some(s => s.url === 'https://summit.example/1/speak') && c.sources.every(s => /^https:\/\/\S+$/.test(s.url) && !NOT_A_SOURCE.test(s.url)));
  assert.ok(p.brief.length >= 2 && p.brief.length <= 6 && p.brief.at(-1).includes("your tap sends The Example Summit 1's own form"));
  assert.equal(p.exact_payload.includes(EM) || JSON.stringify(c).includes(EM), false, 'no em dash');
});

test('the email is always his public business address, and no other address and no number is ever written', () => {
  assert.equal(FORM_EMAIL, 'hello@krishraja.com');
  assert.equal(FORM_SITE, 'https://mindmake.co', 'mindmake.co for every Mindmake venture thing');
  assert.equal(SPEAKER_SITE, 'https://krishraja.com');
  const r = run([summit(1), summit(2, { form_fields: [field('Your name', { required: true }), field('Contact email', { type: 'email', required: true }), field('Mobile', { type: 'tel' }), field('Street address'), field('Speaking fee'), field('Date of birth', { type: 'date' })] }), show(3)]);
  const forms = r.proposals.filter(isForm);
  assert.equal(forms.length, 3);
  for (const p of forms) {
    const answers = JSON.parse(p.exact_payload).form.answers;
    assert.ok(answers.some(a => a.value === FORM_EMAIL), 'answered on his address');
    assert.deepEqual([...new Set(p.exact_payload.match(ADDRESS))], [FORM_EMAIL], 'the only address in the payload');
    assert.equal(PHONE_LIKE.test(p.exact_payload), false, 'no number');
    assert.equal(answers.some(a => /mobile|address|fee|birth/i.test(a.label) && a.value !== FORM_EMAIL), false, 'a phone, an address, a payment or a date of birth is never answered');
    assert.equal(/@|\+\d{6}/.test(JSON.stringify(p.card)), false, 'the card carries no address');
  }
  assert.equal(answersOf(forms.find(p => p.subject_ref === `target:${id(2)}`))['Contact email'], FORM_EMAIL);
  assert.equal(stageForm(summit(4, { form_fields: [field('Full name', { required: true }), field('Talk title', { required: true })] }), opts).hold, 'no_email', 'a form that asks no email cannot answer him');
});

test('a required field with no answer the run is sure of holds the form, and the stage falls to its Jonny pitch', () => {
  const hold = (fields, over = {}) => stageForm(summit(1, { form_fields: [...FIELDS, ...fields], ...over }), opts).hold;
  assert.equal(hold([field('How did you hear about us?', { required: true })]), 'unanswerable');
  assert.equal(hold([field('Phone number', { type: 'tel', required: true })]), 'unanswerable', 'a required phone is never answered');
  assert.equal(hold([field('LinkedIn', { required: true })]), 'unanswerable', 'the canon names no profile today');
  assert.equal(hold([field('City', { required: true })]), 'unanswerable', 'the canon names no city today');
  assert.equal(hold([field('Gender', { type: 'select', required: true, options: ['Female', 'Male'] })]), 'unanswerable');
  assert.equal(hold([field('Talk length', { type: 'radio', required: true })]), 'unanswerable', 'a required choice is never ticked');
  assert.equal(hold([], { form_fields: FIELDS.map(f => f.label === 'Session format' ? { ...f, required: true, options: ['Workshop', 'Lightning talk'] } : f) }), 'unanswerable', 'a required select whose options match nothing');
  assert.equal(hold([field('Format', { required: true })]), 'unanswerable', 'a format is chosen only from its own options');
  assert.equal(hold([field('Organisation', { type: 'select', required: true, options: ['Example Co', 'Other'] })]), 'unanswerable', 'a select takes only a format or a topic from its own options');
  assert.equal(hold([field('Work email', { type: 'url', required: true })]), 'unanswerable', 'a link field takes only his site, never an address');
  assert.equal(hold([field('Notes')]), null, 'an optional field the run cannot answer is left empty');
  const r = run([summit(1, { form_fields: [...FIELDS, field('How did you hear about us?', { required: true })] })]);
  assert.equal(r.proposals.filter(isForm).length, 0);
  assert.deepEqual(r.formHeld, ['unanswerable']);
  const pitch = r.proposals.find(p => p.row === 'events');
  assert.equal(JSON.parse(pitch.exact_payload).mailbox, 'jonny', 'the next best route: Jonny pitches the stage');
  assert.equal(pitch.subject_ref, `target:${id(1)}`);
  assert.equal(pitch.rank, 1);
  const none = run([summit(1, { booking_contact_id: null, form_fields: [...FIELDS, field('Phone', { type: 'tel', required: true })] })]);
  assert.equal(none.proposals.length, 0, 'with no address for speakers there is no route left today');
  assert.deepEqual(none.stageHeld, ['no_booking_address']);
});

test('a required terms box is his alone: the form holds and the stage falls to its pitch', () => {
  assert.equal(stageForm(summit(1, { form_fields: [...FIELDS, field('I agree to the privacy policy', { type: 'checkbox', required: true })] }), opts).hold, 'terms');
  assert.equal(stageForm(summit(1, { form_fields: [...FIELDS, field('Notes?', { required: true }), field('I accept the terms', { type: 'checkbox', required: true })] }), opts).hold, 'terms', 'named first, whatever else the form lacks');
  assert.equal(stageForm(summit(1), { ...opts, tries: [{ url: 'https://summit.example/1/speak', status: 'not_sent', missing: ['i agree to the terms'], blockers: [], created_at: '2026-10-26T10:00:00Z' }] }).hold, 'terms', 'a terms box the runner found missing is still his alone');
  assert.equal(stageForm(summit(1, { form_fields: [...FIELDS, field('I agree to the code of conduct', { type: 'checkbox' })] }), opts).hold, null, 'an optional one is left unticked');
  const r = run([summit(1, { form_fields: [...FIELDS, field('I consent to the terms', { type: 'checkbox', required: true })] })]);
  assert.deepEqual(r.formHeld, ['terms']);
  assert.equal(r.proposals.length, 1);
  assert.equal(JSON.parse(r.proposals[0].exact_payload).mailbox, 'jonny');
});

test('the engine predicts the runner\'s pick, the closest label, and holds a form only when an answer would still land where it should not', () => {
  assert.deepEqual(runnerPick('Company name', [{ label: 'Name', value: 'Krish Raja' }, { label: 'Company name', value: 'Mindmake' }]), { label: 'Company name', value: 'Mindmake' }, 'the field\'s own label first, as api/_formFill.ts matches');
  assert.equal(runnerPick('Bio', [{ label: 'Website', value: FORM_SITE }]), null);
  assert.equal(runnerPick('ab', [{ label: 'ab', value: 'x' }]), null, 'under three letters the runner matches nothing');
  assert.equal(overlaps([field('Email'), field('Email address')], [{ label: 'Email', value: FORM_EMAIL }, { label: 'Email address', value: FORM_EMAIL }]), false, 'the same answer either way is no harm');
  assert.equal(overlaps([field('Company'), field('Company phone')], [{ label: 'Company', value: 'Mindmake' }]), true, 'a field left empty on purpose would be filled');
  assert.equal(overlaps([field('Topics', { type: 'checkbox', name: 'topics' })], [{ label: 'Topic', value: 'AI for marketing leaders' }]), true, 'a box would be ticked');
  assert.equal(overlaps([field('I agree to the terms', { type: 'checkbox', name: 'terms' })], [{ label: 'Terms', value: 'x' }]), false, 'the runner leaves a terms box alone');
  const both = stageForm(summit(1, { form_fields: [field('Name', { required: true }), field('Company name', { required: true }), field('Email', { type: 'email', required: true })] }), opts);
  assert.equal(both.hold, null, 'the runner takes the closest label, so a name beside a company name is answered (control-center#576)');
  assert.deepEqual(runnerPick('Your company name', [{ label: 'Name', value: 'Krish Raja' }, { label: 'Company name', value: 'Mindmake' }])?.value, 'Mindmake', 'the closer label wins');
  assert.equal(stageForm(summit(1, { form_fields: [field('Full name', { required: true }), field('Company', { required: true }), field('Email', { type: 'email', required: true })] }), opts).hold, null);
});

test('a form sent, or one whose browser never answered, an applied stage and a passed deadline are never proposed again', () => {
  const tried = status => ({ id: id(900), proposal_id: id(901), url: 'https://SUMMIT.example/1/speak/', status, filled: [], missing: [], blockers: [], unused: [], after_url: null, after_title: null, submitted_at: status === 'not_sent' ? null : '2026-10-26T10:00:00Z', created_at: '2026-10-26T10:00:00Z' });
  for (const status of ['submitted', 'confirmed', 'running']) {
    const r = run([summit(1)], { records: { forms: [tried(status)] } });
    assert.equal(r.proposals.length, 0, status);
    assert.deepEqual(r.formHeld, ['sent'], `${status}: matched by its page, whatever the case or a trailing slash`);
    assert.deepEqual(r.stageHeld, ['form_sent'], `${status}: and no pitch on top of it`);
  }
  const hold = over => stageForm(summit(1, over), opts)?.hold;
  assert.equal(hold({ status: 'applied' }), 'applied', 'a stage it was sent for is marked applied');
  assert.equal(hold({ applied_at: '2026-10-26T10:00:00Z' }), 'applied');
  assert.equal(hold({ deadline_at: '2026-10-26T00:00:00Z' }), 'deadline_passed');
  assert.equal(hold({ deadline_at: null, event_start_at: '2026-10-01T00:00:00Z' }), 'event_passed');
  assert.equal(hold({ buried_at: '2026-10-01T00:00:00Z' }), 'buried');
  assert.equal(hold({ verdict: 'rejected' }), 'rejected');
  assert.equal(hold({ status: 'dropped' }), 'not_open');
  assert.equal(hold({ title: 'Signal & Noise Live' }), 'own_show');
  const applied = run([summit(1, { status: 'applied' }), summit(2, { deadline_at: '2026-10-26T00:00:00Z' })]);
  assert.equal(applied.proposals.length, 0);
  assert.deepEqual(applied.formHeld, [], 'a stage\'s own reasons are its pitch\'s to count, not the form\'s');
  assert.deepEqual(applied.stageHeld.sort(), ['applied', 'deadline_passed']);
});

test('a stage pitched or answered before, or ruled out by a No, gets no form either', () => {
  const drafted = run([summit(1)], { records: { drafts: [{ visibility_target_id: id(1) }] } });
  assert.equal(drafted.proposals.length, 0, 'a Jonny draft already went to it');
  const done = { proposal_id: 'gmp-x', state: 'done', carried_out: 'submit', decided_at: '2026-10-26T10:00:00Z', row: 'events', subject_ref: `target:${id(1)}`, reason_code: null, amplifier_kind: 'ceo_educator', features: { sector: null, topic: 'marketing', seniority: null }, reach: { band: 'unknown' } };
  assert.ok(pitchedStages({ records: { drafts: [] }, feedback: [done] }).has(id(1)), 'his Submit carried out is an answer on the stage');
  assert.equal(run([summit(1)], { feedback: [done] }).proposals.length, 0);
  const no = { ...done, state: 'declined', carried_out: null };
  const r = run([summit(1)], { feedback: [no] });
  assert.equal(r.proposals.length, 0);
  assert.equal(stageForm(summit(1), { ...opts, L: lessons([{ ...no, subject_ref: `target:${id(9)}`, reason_code: 'not_my_topic' }], NOW) }).hold, 'not_my_topic', 'his reason reaches stages like it');
});

test('a try that sent nothing is routed again: what was missing answered now, or the pitch', () => {
  const notSent = (over = {}) => ({ id: id(900), proposal_id: id(901), url: 'https://summit.example/1/speak', status: 'not_sent', filled: ['full name'], missing: [], blockers: [], unused: [], after_url: null, after_title: null, submitted_at: null, created_at: '2026-10-26T10:00:00Z', ...over });
  const again = run([summit(1)], { records: { forms: [notSent({ missing: ['organisation'] })] } });
  const p = again.proposals.find(isForm);
  assert.ok(p, 'proposed again');
  assert.equal(answersOf(p).organisation, 'Mindmake', 'with the answer it lacked, under the label the runner saw');
  assert.equal(parseActionV2(p.exact_payload).ok, true);
  assert.match(p.why, /His last tap sent nothing; what it lacked is answered now\./);
  assert.notEqual(p.exact_payload, run([summit(1)]).proposals.find(isForm).exact_payload, 'new words, so it comes back to him');
  assert.equal(p.proposal_id, run([summit(1)]).proposals.find(isForm).proposal_id, 'the same proposal');
  for (const [missing, why] of [[['phone number'], 'unanswerable'], [['talk title'], 'unanswerable'], [['your website'], 'unanswerable'], [['a choice'], 'unanswerable'], [['the submit button'], 'unanswerable']]) {
    const r = run([summit(1)], { records: { forms: [notSent({ missing })] } });
    assert.deepEqual(r.formHeld, [why], missing[0]);
    assert.equal(JSON.parse(r.proposals[0].exact_payload).mailbox, 'jonny', `${missing[0]}: falls to the pitch`);
  }
  for (const [blockers, why] of [[['captcha'], 'blocked'], [['login'], 'blocked'], [['payment'], 'blocked'], [['terms'], 'terms'], [['captcha', 'terms'], 'terms']]) {
    const r = run([summit(1)], { records: { forms: [notSent({ blockers })] } });
    assert.deepEqual(r.formHeld, [why], blockers.join('+'));
    assert.equal(r.proposals.length, 1);
    assert.equal(JSON.parse(r.proposals[0].exact_payload).mailbox, 'jonny', 'what only he can give: the most automated next route');
  }
  const later = run([summit(1)], { records: { forms: [notSent({ created_at: '2026-10-25T10:00:00Z', blockers: ['captcha'] }), notSent({ created_at: '2026-10-26T12:00:00Z', missing: ['organisation'] })] } });
  assert.ok(later.proposals.some(isForm), 'the latest try counts');
});

test('a form drawn in script is left alone, and its stage is pitched as before', () => {
  const r = run([summit(1, { form_fields: [] })]);
  assert.deepEqual(r.formHeld, ['in_script']);
  assert.equal(r.proposals.length, 1);
  assert.equal(JSON.parse(r.proposals[0].exact_payload).mailbox, 'jonny');
  for (const over of [{ form_fields: null }, { cfp_url: null }, { cfp_url: 'http://summit.example/1/speak' }, { cfp_url: 'mailto:speakers@summit.example' }, { type: 'press_relationship' }]) {
    assert.equal(stageForm(summit(1, over), opts), null, JSON.stringify(over));
    assert.deepEqual(run([summit(1, over)]).formHeld, [], 'not a form the engine can read, and not counted as one');
  }
});

test('a podcast\'s or a show\'s guest form goes on visibility, ahead of the podcast pitches', () => {
  assert.equal(formRow(show(1)), 'visibility');
  assert.equal(formRow({ type: 'guest_appearance', title: 'Example Live' }), 'visibility');
  assert.equal(formRow(summit(1)), 'events');
  assert.equal(formRow({ type: 'newsletter' }), null);
  const r = run([show(1), show(2, { cfp_url: null })]);
  const [p, q] = r.proposals;
  assert.equal(p.channel, 'form');
  assert.equal(p.row, 'visibility');
  assert.equal(p.rank, 1);
  assert.equal(p.title, 'Apply to be a guest on The Example Show 1');
  assert.equal(p.amplifier_kind, 'broadcaster');
  assert.equal(p.because, 'A podcast that asks for guests. Your tap applies.');
  assert.ok(p.card.who.startsWith('The Example Show 1 is a podcast with 80 episodes, hosted by Avery Example.'));
  assert.equal(p.card.gain[0], 'The Example Show 1 asked for guests through its own form: a guest spot for you, in front of Marketing leaders at mid-size companies.');
  assert.ok(p.card.sources.some(s => s.url === 'https://podcasts.example/show-1/guests'));
  const a = answersOf(p);
  assert.deepEqual(Object.keys(a), ['Your name', 'Email address', 'What would you like to talk about on the show?']);
  assert.ok(a['What would you like to talk about on the show?'].startsWith('Krish Raja would come on The Example Show 1 to talk about what an AI that knows a marketing leader should actually do.'));
  assert.equal(q.subject_ref, `target:${id(2)}`, 'the show with no form is pitched');
  assert.equal(JSON.parse(q.exact_payload).mailbox, 'jonny');
  assert.equal(q.rank, 2, 'a stage that asked ranks above a cold pitch to the same kind of stage');
  assert.deepEqual(r.held, ['form_route'], 'the show with a form is not also pitched');
  const guest = run([{ ...show(3), type: 'guest_appearance', title: 'Example Live', episodes: null, latest_episode_at: null }]).proposals[0];
  assert.ok(guest.card.who.startsWith('Example Live is a show'), 'a show, not a podcast');
  assert.equal(guest.title, 'Apply to be a guest on Example Live');
  assert.equal(stageForm(show(4, { latest_episode_at: '2026-04-01T00:00:00Z' }), opts).hold, 'quiet_show');
  assert.equal(stageForm(show(4, { latest_episode_at: null }), opts).hold, null, 'a guest form on its own page is the show asking');
});

test('forms lead their row, at most two a row, outside the ten pitches; a form waiting its turn keeps its stage\'s pitch back', () => {
  const pods = Array.from({ length: 12 }, (_, i) => show(i + 1, { cfp_url: null }));
  const stages = Array.from({ length: 3 }, (_, i) => summit(i + 30, { verdict: i === 2 ? 'take' : 'stretch' }));
  const r = run([...pods, ...stages]);
  const forms = r.proposals.filter(isForm);
  assert.equal(FORMS_PER_ROW, 2);
  assert.equal(forms.length, 2, 'two on events');
  assert.equal(forms[0].subject_ref, `target:${id(32)}`, 'best first');
  assert.deepEqual(forms.map(p => p.rank), [1, 2]);
  assert.deepEqual(r.formHeld, ['per_run_cap']);
  const jonny = r.proposals.filter(p => !isForm(p));
  assert.equal(jonny.length, PITCHES_PER_RUN, 'a form is not a Jonny draft and does not count against the ten');
  assert.ok(jonny.every(p => JSON.parse(p.exact_payload).mailbox === 'jonny'));
  assert.equal(jonny.filter(p => p.row === 'events').length, 0, 'every stage here has a form as its route: none is pitched');
  assert.deepEqual(r.stageHeld, ['form_route', 'form_route', 'form_route']);
  const mixed = run([summit(1), summit(2, { form_fields: [] })]);
  assert.deepEqual(mixed.proposals.map(p => [p.channel, p.rank]), [['form', 1], ['email', 2]], 'the pitches rank after the forms on their row');
});

test('wholeWithin keeps whole sentences, and a field\'s own label sets the limit', () => {
  assert.deepEqual(labelLimit('Short bio (max 60 words)'), { words: 60 });
  assert.deepEqual(labelLimit('Abstract, up to 500 characters'), { chars: 500 });
  assert.deepEqual(labelLimit('Bio (100 words)'), { words: 100 });
  assert.deepEqual(labelLimit('Abstract'), {});
  assert.equal(wholeWithin('One two. Three four five. Six.', { words: 5 }), 'One two. Three four five.');
  assert.equal(wholeWithin('One two three.', { words: 2 }), '', 'not even the first fits: nothing, never half a sentence');
  assert.equal(wholeWithin('He said "yes." Then left.', { chars: 15 }), 'He said "yes."');
  const bio = formBio(canon, RECORD);
  assert.ok(bio.length <= BIO_MAX && bio.endsWith(RECORD.line));
  assert.equal(stageForm(summit(1, { form_fields: [field('Email', { type: 'email', required: true }), field('Bio (max 5 words)', { required: true })] }), opts).hold, 'unanswerable', 'a bio that cannot be cut whole is no answer');
});

test('a dispatch run at 1.9.0 reports forms first on their row, the people behind them, and counts what it held', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/policy.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
  const professor = { contact_id: id(4), network_tier: '2_core_network', current_title: 'Professor, Example University', followers: null, plays: [], roles: [], mindmake_fit: 60, sells_competing_services: false,
    hook: 'Took two media software companies through a sale.', contacts: { id: id(4), full_name: 'Avery Example4', title: 'Professor, Example University', company: 'Company 4', company_domain: 'c4.test', status: 'active' } };
  for (const [served, expected] of [[['1.6.0', '1.7.0', '1.8.0', '1.9.0'], '1.9.0'], [['1.6.0', '1.7.0', '1.8.0'], '1.8.0']]) {
    const reports = [];
    const cc = { recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: served.at(-1), week_goals: GOALS }),
      capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
      context: async () => ({ ok: true, context: { schema_version: served.at(-1), engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: NOW, coverage: [{ source: 'advisory', available: true, complete: true }],
        records: { advisory: [], visibility: [summit(1), summit(2, { form_fields: [...FIELDS, field('Phone', { type: 'tel', required: true })] })], drafts: [], forms: [] },
        amplifier_candidates: [professor], routes: { [id(4)]: { email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false } }, feedback: [], research: [] } }),
      decisions: async () => [], postReport: async rep => { reports.push(golden(rep)); return { replayed: false }; }, readReport: async () => reports.at(-1) };
    const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: `gma-form-${expected.replace(/\./g, '')}-1234`, clock: () => NOW,
      canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
    assert.equal(result.status, 'succeeded', expected);
    const rep = reports[0];
    assert.deepEqual(violations(schema, rep), [], expected);
    const events = rep.proposals.filter(p => p.row === 'events');
    const forms = events.filter(isForm);
    if (expected === '1.9.0') {
      assert.equal(forms.length, 1);
      assert.equal(forms[0].rank, 1, 'the stage that asked leads its row');
      assert.equal(forms[0].subject_ref, `target:${id(1)}`);
      assert.match(forms[0].payload_sha256, /^[0-9a-f]{64}$/);
      assert.equal('target' in forms[0], false, 'the page is in the action, never a field of the report');
      assert.equal(parseActionV2(forms[0].exact_payload).ok, true);
      const person = events.find(p => p.subject_ref === `contact:${id(4)}`);
      assert.ok(person, 'the professor is on events');
      assert.equal(person.rank, 2, 'the people ranked on the row come after its form');
      const pitch = events.find(p => p.subject_ref === `target:${id(2)}`);
      assert.equal(JSON.parse(pitch.exact_payload).mailbox, 'jonny', 'the form that could not be answered falls to its pitch');
      assert.ok(rep.holds.some(h => h.reason === 'form_unanswerable' && h.detail === '1 stage form not filled today: unanswerable.'));
      assert.ok(rep.holds.some(h => h.reason === 'speak_form_route'));
      assert.ok(rep.activity.some(a => a.line.startsWith('Forms for his tap: 1 stage asked through their own form')));
      assert.equal(result.rows.forms, 1);
      assert.equal(result.rows.speaking_pitches, 1, 'a form is not counted as a pitch');
    } else {
      assert.equal(forms.length, 0, 'nothing is written for a Control Center that does not serve 1.9.0');
      assert.equal(events.find(p => p.subject_ref === `contact:${id(4)}`).rank, 1);
    }
  }
});

test('a website field gets mindmake.co, and krishraja.com only where its own label asks for his personal or speaker site', () => {
  assert.equal(answerFor({ label: 'Website', type: 'url' }), FORM_SITE);
  assert.equal(answerFor({ label: 'Company website' }), FORM_SITE, "the company is Mindmake, so its website is mindmake.co");
  assert.equal(answerFor({ label: 'Organisation URL', type: 'url' }), FORM_SITE);
  assert.equal(answerFor({ label: 'Link to your work' }), FORM_SITE);
  assert.equal(answerFor({ label: 'Personal website', type: 'url' }), SPEAKER_SITE);
  assert.equal(answerFor({ label: 'Speaker site URL' }), SPEAKER_SITE);
  assert.equal(answerFor({ label: 'Your own website*' }), SPEAKER_SITE);
});
