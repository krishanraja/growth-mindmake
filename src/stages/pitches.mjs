import { seal, clean, DAY } from '../guards.mjs';
import { lessons, refusedBy, firstName, givenParts, cleanName, monthYear, servesOf, leadFacts, fitTitleWithin, cutClean, knownWords, bandOf, actionFor, rowProposal, score, channelOf, KRISH_TITLE, OWN_SHOW, TOPICS, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, CARD_LINES, CARD_ANGLE_TITLE_MAX, CARD_SOURCES, BECAUSE_MAX, BRIEF_LINE_MAX, TITLE_MAX, OBJECTIVE } from './rows.mjs';
import { showNoteRows } from './shownotes.mjs';
import { shadowLine, stageVerdict, stageStrength, ccStageVerdict, isDeadDate } from './visibility.mjs';
import { guestVerdictOf, guestStrength, WARM_TIERS } from './guests.mjs';
import { routeFromEvidence, ownSites } from './routes.mjs';

/**
 * Podcast pitches, written in Jonny's voice for Krish (protocol 1.9.0, playbook 11).
 *
 * Krish, 2026-10-27: pitch him to as many podcasts as possible from Jonny's
 * Gmail, "Drafted daily, no press", "For visibility Jonny sends"; his goal is
 * one podcast a week. Control Center holds the stages and reads, from each
 * show's own public feed, the address it publishes for itself; it only says
 * that the address exists (booking_contact_id). This stage chooses the shows,
 * ranks them, and writes each pitch. Control Center drafts each into Jonny's
 * Gmail with no press, at most ten a day, and Jonny sends it.
 *
 * Who Jonny says Krish is comes only from what the run reads live: the title
 * Krish ruled (Executive Host of Signal & Noise, 2026-10-27), his publication
 * and the brain door from Mindmake's canon, and his track record from
 * krishraja.com's own repository when it reads (canon.mjs, readRecord). A
 * show is pitched once: a draft or an answer on it is never written again.
 *
 * Speaking pitches (EVENTS) work the same way for a stage to speak on: a
 * conference, a call for papers, a speaking slot, a webinar or a panel whose
 * own page gives an address for speakers (Control Center keeps it as the
 * stage's booking contact). One ask: a talk or a panel seat, with one talk
 * title tied to the room. Krish: EVENTS is events to pitch to.
 *
 * Guest invites (VISIBILITY) bring people onto his own shows (Krish,
 * 2026-10-27: guests for Signal & Noise and Make Your Mind Up are part of his
 * visibility; Make Your Mind Up takes a weekly conversation). A guest the
 * engine's guest standard judges worth having (guests.mjs, on the axes
 * Control Center serves), with an address on record, gets one invite from
 * Jonny, to the show it was judged for. The
 * week's invites follow the shows' shares (Make Your Mind Up 70, Signal &
 * Noise 30: Ruling, Krish, 2026-10-20), at most two a run, taken first from
 * the run's ten.
 *
 * Forms on his tap (Ruling, Krish, 2026-10-26: "a form is filled for him and
 * his tap submits it; when it cannot be, the most automated next best
 * route"). A stage whose own speaker call or guest form Control Center has
 * read (cfp_url, form_fields) gets a form action instead of a pitch: every
 * field it asks answered by the field's own label from what the run reads
 * live, which his Submit fills in a browser and sends. A form that cannot be
 * answered for certain is never written, and the stage falls to its Jonny
 * pitch. A form is his press, not a Jonny draft, so it is outside the ten.
 *
 * Pure: everything comes from the context, the directive and the files read
 * this run. No model call. No address, ever, but the one public business
 * address a form is given for him (FORM_EMAIL).
 */

/** Pitches a run writes at most: Control Center drafts at most ten a day. */
export const PITCHES_PER_RUN = 10;
/** Of the ten, stages to speak on keep up to four when podcasts could take them all; what one kind cannot fill goes to the other. */
export const STAGE_SHARE = 4;
/** The stage types Krish speaks on; a webinar or a panel is one whatever its type says. */
export const SPEAKING_TYPES = new Set(['conference', 'cfp', 'speaking']);
const SPEAKING_FORMAT = /\b(?:webinar|panel)s?\b/i;
/** Press is a relationship, not a stage: it gets no pitch. */
const NOT_A_STAGE = new Set(['podcast', 'press_relationship', 'newsletter']);
/** A show with no episode in this long is not taking guests. */
export const QUIET_AFTER_DAYS = 120;
/** How the visibility standard ranks a stage: worth taking, a stretch, or not yet judged (the engine's own verdict, visibility.mjs). */
const VERDICT_WEIGHT = { take: 3, stretch: 2 };
/** A stage's rank weight from the engine's own verdict on it; unjudged weighs 1, as a stage Control Center had not judged did. Pure. */
const standardWeight = (t, at) => VERDICT_WEIGHT[stageVerdict(t, at)] ?? 1;
/** Whether the visibility standard refuses a stage to speak on or a form, leaving a passed date, which it refuses too, to the hold that names it (deadline_passed, event_passed). Pure. */
const refusedByStandard = (t, at) => stageVerdict(t, at) === 'rejected' && !isDeadDate(t, at);
/** The line a pitch's why carries: the visibility standard by name, with the engine's own verdict. Pure. */
const standardSays = (t, at) => { const v = stageVerdict(t, at); return `The visibility standard: ${v === 'take' || v === 'stretch' ? v : 'not yet judged'}.`; };
/** The rooms his buyer listens in (playbook 11): a show about one of these fits best. */
export const BUYER_TOPICS = new Set(['leadership', 'marketing', 'advertising', 'media', 'venture', 'finance', 'technology', 'talent']);

/** What Krish talks about on a show, by its topic: the line in the pitch, and the short form in its subject. */
export const TOPIC_PITCH = {
  advertising: ['what AI is doing to advertising and the agencies that sell it', 'AI and advertising'],
  marketing: ['what an AI that knows a marketing leader should actually do', 'AI for marketing leaders'],
  talent: ['what AI does to hiring, careers and the teams leaders run', 'AI, hiring and careers'],
  venture: ['how investors and founders should judge what AI is worth', 'what AI is worth'],
  finance: ['where the money spent on AI actually goes', 'where AI money goes'],
  retail: ['what AI changes first for the people running retail businesses', 'AI in retail'],
  media: ['what AI does to media businesses and the people who run them', 'AI and media businesses'],
  education: ['how leaders should learn AI once the course ends', 'learning AI as a leader'],
  health: ['what leaders in health should and should not hand to AI', 'AI and health leadership'],
  technology: ['the org chart after AI, and what leaders still decide', 'the org chart after AI'],
  leadership: ['what an AI that knows a leader should actually do', 'an AI that knows the leader'],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const within = (line, max = CARD_LINE_MAX) => line && line.length <= max ? line : '';

/** What a show is about, from its own title and Nova's read of it; null when nothing says. Pure. */
export function showTopic(t) {
  const text = [t?.title, t?.audience, t?.angle, t?.who_is_in_the_room].filter(x => typeof x === 'string').join(' | ');
  return text.trim() ? (TOPICS.find(([, re]) => re.test(text))?.[0] ?? null) : null;
}

/** Words a publisher's name carries and a person's never does. */
const NOT_A_PERSON = /\b(?:media|network|networks|inc|llc|ltd|limited|group|studios?|productions?|podcasts?|show|fm|radio|news|company|co|partners|agency|labs?|institute|university|school|magazine|publishing|the)\b|[&+,|/@]|\d/i;
/** The host, when the stage names one person: two or three capitalised words and nothing a company is called. Else null. Pure. */
export function hostOf(t) {
  const name = cleanName(t?.organizer ?? '');
  const parts = givenParts(name);
  if (parts.length < 2 || parts.length > 3 || NOT_A_PERSON.test(name) || !parts.every(p => /^\p{Lu}[\p{L}'’-]+$/u.test(p))) return null;
  return parts.join(' ');
}

/** Days since a show's latest episode, or null when it is not known. */
const sinceLatest = (t, at) => { const l = Date.parse(t?.latest_episode_at ?? ''); return Number.isFinite(l) ? (Date.parse(at) - l) / DAY : null; };

/** What a win lifts a stage by (src/stages/wins.mjs): its topic and kind, 1 when nothing has won. Pure. */
const winLift = (t, W) => typeof W?.lift === 'function' ? W.lift({ kind: stageKind(t), sector: null, topic: showTopic(t) }) : 1;
/** How a show ranks: the visibility standard's verdict, how recently it published, whether it is about a room his buyer is in, how long it has run, and what of its kind has answered or booked before (`W`, src/stages/wins.mjs). Pure. */
export function pitchScore(t, at, W = null) {
  const days = sinceLatest(t, at);
  const recent = days === null ? 0 : days <= 30 ? 1 : days <= 60 ? 0.85 : 0.7;
  const topic = showTopic(t);
  const fit = topic && BUYER_TOPICS.has(topic) ? 1 : 0.7;
  const eps = Number.isInteger(t?.episodes) && t.episodes > 0 ? t.episodes : 0;
  return standardWeight(t, at) * recent * fit * Math.log10(eps + 10) * winLift(t, W);
}

/** Why a stage is not pitched today, or null when it may be. Pure. */
export function pitchHold(t, { L, pitched, at }) {
  if (t?.type !== 'podcast') return 'not_a_podcast';
  if (!t.booking_contact_id || !UUID.test(t.booking_contact_id)) return 'no_booking_address';
  if (t.buried_at) return 'buried';
  if (stageVerdict(t, at) === 'rejected') return 'rejected';
  if (t.status === 'applied' || t.applied_at) return 'applied';
  if ([t.title, t.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) return 'own_show';
  const days = sinceLatest(t, at);
  if (days === null || days > QUIET_AFTER_DAYS) return 'quiet_show';
  if (pitched.has(t.id)) return 'already_pitched';
  return refusedBy(L, { subject: `target:${t.id}`, row: 'visibility', kind: 'broadcaster', sector: null, topic: showTopic(t), band: 'unknown' }, at);
}

/** Whether a stage is a podcast to be a guest on, a stage to speak on, or neither. Pure. */
export function stageKind(t) {
  if (t?.type === 'podcast') return 'podcast';
  if (NOT_A_STAGE.has(t?.type)) return null;
  if (SPEAKING_TYPES.has(t?.type) || SPEAKING_FORMAT.test(`${t?.title ?? ''} ${t?.format ?? ''}`)) return 'stage';
  return null;
}

/** The ask a stage takes: a panel seat where it says panel, else a talk. Pure. */
export const speakingAsk = t => /\bpanels?\b/i.test(`${t?.title ?? ''} ${t?.format ?? ''}`) ? 'a panel seat' : 'a talk';

/** Why a stage to speak on is not pitched today, or null when it may be. Pure. */
export function speakHold(t, { L, pitched, at }) {
  if (stageKind(t) !== 'stage') return 'not_a_stage';
  if (!t.booking_contact_id || !UUID.test(t.booking_contact_id)) return 'no_booking_address';
  if (t.buried_at) return 'buried';
  if (refusedByStandard(t, at)) return 'rejected';
  if (t.status === 'applied' || t.applied_at) return 'applied';
  if (!['sourced', 'queued'].includes(t.status)) return 'not_open';
  if ([t.title, t.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) return 'own_show';
  const now = Date.parse(at);
  if (Number.isFinite(Date.parse(t.deadline_at ?? '')) && Date.parse(t.deadline_at) < now) return 'deadline_passed';
  if (Number.isFinite(Date.parse(t.event_start_at ?? '')) && Date.parse(t.event_start_at) < now) return 'event_passed';
  if (pitched.has(t.id)) return 'already_pitched';
  return refusedBy(L, { subject: `target:${t.id}`, row: 'events', kind: 'ceo_educator', sector: null, topic: showTopic(t), band: 'unknown' }, at);
}

/** How a stage ranks: the visibility standard's verdict, its weakest axis when judged, how soon its call closes while still open, and whether his buyer is in the room. Pure. */
export function speakScore(t, at, W = null) {
  const weakest = stageStrength(t);
  const judged = weakest === null ? 0.6 : Math.max(0.1, weakest / 100);
  const days = Number.isFinite(Date.parse(t?.deadline_at ?? '')) ? (Date.parse(t.deadline_at) - Date.parse(at)) / DAY : null;
  const soon = days === null ? 1 : days <= 14 ? 1.3 : days <= 30 ? 1.15 : 1;
  const topic = showTopic(t);
  const fit = topic && BUYER_TOPICS.has(topic) ? 1 : 0.7;
  return standardWeight(t, at) * judged * soon * fit * winLift(t, W);
}

/** The talk Krish offers a stage: the one Nova suggested for it, else one from its topic. Pure. */
export function talkTitle(t, topic) {
  const suggested = typeof t?.suggested_talk_title === 'string' ? clean(t.suggested_talk_title).replace(/^["'“]+|["'”.]+$/g, '') : '';
  if (suggested && suggested.length <= 80 && !OWN_SHOW.test(suggested)) return suggested;
  const short = (TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership)[1];
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** The speaking pitch in Jonny's words: one point, one ask, Krish in the third person, signed Jonny. Pure. */
export function speakWords({ event, host, ask, talk, canon, record }) {
  const lines = [
    `I work with Krish Raja, and I'd like to put him forward for ${ask} at ${event}: "${talk}".`,
    `He's ${KRISH_TITLE} and writes ${canon.publication.name} (${canon.publication.url}). At Mindmake he helps leaders build their AI brain: "${canon.brain}"`,
    ...(record ? [record] : []),
    `Would you consider him for the programme? I can send a short abstract and a bio.`,
  ];
  return {
    subject: clean(`A speaker for ${event}: ${talk}`).slice(0, 200),
    body: [`Hi ${host ? firstName(host) : 'there'},`, ...lines.map(clean), 'Jonny'].join('\n\n'),
  };
}

/** The date a call closes, as "12 Nov", or null. */
const dayMonth = value => { const d = new Date(Date.parse(value ?? '')); return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${monthYear(value).split(' ')[0]}` : null; };

/** The full card for a speaking pitch, from the stage alone: what the event is, that Krish does not know them, why, what he gets, the angles. */
export function speakCard({ t, event, ask, talk, topic, canon, serves, known: knownLine = null }) {
  const org = t.organizer && cleanName(t.organizer) !== event ? cleanName(t.organizer) : '';
  const when = monthYear(t.event_start_at);
  const where = typeof t.location === 'string' && t.location.trim() ? cleanName(t.location) : '';
  const room = typeof t.audience === 'string' && t.audience.trim() ? t.audience.trim().replace(/[.!?]+$/, '') : typeof t.who_is_in_the_room === 'string' && t.who_is_in_the_room.trim() ? leadFacts(t.who_is_in_the_room, 160).replace(/[.!?]+$/, '') : '';
  const kind = SPEAKING_FORMAT.exec(`${t.title ?? ''} ${t.format ?? ''}`)?.[0]?.toLowerCase().replace(/s$/, '') ?? (t.type === 'cfp' ? 'call for speakers' : 'event');
  const who = within([`${event} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}${org ? ` run by ${org}` : ''}${when ? `, in ${when}` : ''}${where ? `, ${where}` : ''}.`, room ? leadFacts(`Its room: ${room}.`, 200) : ''].filter(Boolean).join(' '), CARD_WHO_MAX) || `${event} is an event.`;
  const known = knownLine || "You do not know them yet. The event's own page gives this address for speakers, and Jonny writes first.";
  const closes = dayMonth(t.deadline_at);
  const why = [leadFacts(t.why_him, CARD_LINE_MAX), leadFacts(t.why_now, CARD_LINE_MAX), closes ? `Its call for speakers closes on ${closes}, so now is the time to ask.` : 'It is open for speakers now.']
    .filter(Boolean).filter((l, i, a) => a.findIndex(x => x.slice(0, 40) === l.slice(0, 40)) === i).slice(0, CARD_LINES);
  const goal = serves ? within(`It serves this week's goal: ${serves.replace(/[.!?]+$/, '')}.`) : '';
  const gain = [within(`${ask.charAt(0).toUpperCase()}${ask.slice(1)} at ${event}${room ? `, in front of ${room}` : ''}.`) || `${ask.charAt(0).toUpperCase()}${ask.slice(1)} at ${event}.`, ...(goal ? [goal] : [])];
  const [about] = TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership;
  const angle = typeof t.angle === 'string' && t.angle.trim() ? leadFacts(t.angle, 120) : '';
  const angles = [
    { title: fitTitleWithin(CARD_ANGLE_TITLE_MAX, talk, 'The talk'), line: within(`Offer "${talk}": ${about}${angle ? `. Nova's angle for this room: ${angle}` : `, for the room ${event} gathers.`}`) || `Offer "${talk}".` },
    { title: canon.publication.name, line: within(`Point them to ${canon.publication.name} first, at ${canon.publication.url}, so they know what Krish writes before they say yes.`) },
  ].filter(a => a.line && a.title.length <= CARD_ANGLE_TITLE_MAX);
  const sources = [];
  const add = (label, url) => { if (typeof url === 'string' && /^https:\/\/\S+$/.test(url) && url.length <= 2000 && !NOT_A_SOURCE.test(url) && !sources.some(s => s.url === url)) sources.push({ label: fitTitleWithin(80, label), url }); };
  add(`${event}, its own page`, t.event_url);
  add(`${event}, its call for speakers`, t.cfp_url);
  return { who, known, why: why.length ? why : [`${event} is open for speakers.`], gain, angles, sources: sources.slice(0, CARD_SOURCES) };
}

/** The stages already pitched: a draft made for one, or any answer on a pitch to it. */
export function pitchedStages(context) {
  const out = new Set();
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) if (typeof d?.visibility_target_id === 'string') out.add(d.visibility_target_id);
  for (const f of Array.isArray(context?.feedback) ? context.feedback : []) {
    const m = /^target:([0-9a-f-]{36})$/i.exec(f?.subject_ref ?? '');
    if (m && (f.row === 'visibility' || f.row === 'events') && ['approved', 'done', 'declined'].includes(f.state)) out.add(m[1].toLowerCase());
  }
  return out;
}

/** The pitch in Jonny's words: one point, one ask, Krish in the third person, signed Jonny. Pure. */
export function pitchWords({ show, host, topic, canon, record }) {
  const [about, short] = TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership;
  const lines = [
    `I work with Krish Raja, and I think he'd make a strong guest for ${show} on ${about}.`,
    // The canon's line is about the leader ("your taste"), so it is quoted whole rather than bent into the third person.
    `He's ${KRISH_TITLE} and writes ${canon.publication.name} (${canon.publication.url}). At Mindmake he helps leaders build their AI brain: "${canon.brain}"`,
    ...(record ? [record] : []),
    'Would you have him on? I can send a short brief and a few dates.',
  ];
  return {
    subject: clean(`A guest for ${show}: ${short}`).slice(0, 200),
    body: [`Hi ${host ? firstName(host) : 'there'},`, ...lines.map(clean), 'Jonny'].join('\n\n'),
  };
}

/** The full card a tap would open (1.8.0), from the stage alone: who the show is, that Krish does not know them, why, what he gets, the angles. */
export function pitchCard({ t, show, host, topic, canon, serves, at, noun = 'podcast', known: knownLine = null }) {
  const eps = Number.isInteger(t.episodes) && t.episodes > 0 ? t.episodes : null;
  const by = host ? `, hosted by ${host}` : t.organizer && cleanName(t.organizer) !== show ? `, published by ${cleanName(t.organizer)}` : '';
  const audience = typeof t.audience === 'string' && t.audience.trim() ? leadFacts(`Its audience: ${t.audience.trim().replace(/[.!?]+$/, '')}.`, 200) : '';
  const who = within([`${show} is a ${noun}${eps ? ` with ${eps} episodes` : ''}${by}.`, audience].filter(Boolean).join(' '), CARD_WHO_MAX) || `${show} is a ${noun}.`;
  const known = knownLine || 'You do not know them yet. The show publishes this address in its own feed, and Jonny writes first.';
  const why = [leadFacts(t.why_him, CARD_LINE_MAX), leadFacts(t.why_now, CARD_LINE_MAX), monthYear(t.latest_episode_at) ? `Its latest episode was out in ${monthYear(t.latest_episode_at)}, so it is taking guests now.` : '']
    .filter(Boolean).filter((l, i, a) => a.findIndex(x => x.slice(0, 40) === l.slice(0, 40)) === i).slice(0, CARD_LINES);
  const goal = serves ? within(`It serves this week's goal: ${serves.replace(/[.!?]+$/, '')}.`) : '';
  const gain = [within(`A guest spot on ${show}${audience ? `, in front of ${t.audience.trim().replace(/[.!?]+$/, '')}` : ''}.`) || `A guest spot on ${show}.`, ...(goal ? [goal] : [])];
  const [about, short] = TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership;
  const angle = typeof t.angle === 'string' && t.angle.trim() ? leadFacts(t.angle, 120) : '';
  const angles = [
    { title: short.charAt(0).toUpperCase() + short.slice(1), line: within(`Pitch Krish on ${about}${angle ? `. Nova's angle for this show: ${angle}` : `, tied to what ${show} covers.`}`) || `Pitch Krish on ${about}.` },
    { title: canon.publication.name, line: within(`Point them to ${canon.publication.name} first, at ${canon.publication.url}, so they know what Krish writes before they say yes.`) },
  ].filter(a => a.line && a.title.length <= CARD_ANGLE_TITLE_MAX);
  const sources = [];
  const add = (label, url) => { if (typeof url === 'string' && /^https:\/\/\S+$/.test(url) && url.length <= 2000 && !NOT_A_SOURCE.test(url) && !sources.some(s => s.url === url)) sources.push({ label: fitTitleWithin(80, label), url }); };
  add(`${show}, its own page`, t.event_url);
  add(`${show}, its feed`, t.feed_url);
  return { who, known, why: why.length ? why : [`${show} is live and takes guests.`], gain, angles, sources: sources.slice(0, CARD_SOURCES) };
}

// ── Guest invites for his own shows ────────────────────────────────────────

/** Invites a run writes at most, taken first from the run's ten. */
export const INVITES_PER_RUN = 2;
/** Invites a week across both shows, split by their shares. */
export const INVITES_A_WEEK = 4;
/** His two shows: their share of guests (Ruling, Krish, 2026-10-20), and whether each takes a weekly conversation. */
export const INVITE_SHOWS = {
  makeyourmindup: { share: 70, weekly: true },
  signal_noise: { share: 30, weekly: false },
};
/** The guest standard's verdicts that may be invited (guests.mjs, ported from api/_guestStandard.ts): worth taking, or a stretch. */
const GUEST_VERDICT = { take: 2, stretch: 1 };
const OPEN_GUEST = new Set(['scouted', 'enriched']);
const KRISH = /\bkrish\s+raja\b/i;

/** The shows' shares as the week spec carries them (src/crew/compile.mjs): today's ruled split. */
export const SHOW_SHARES = Object.freeze(Object.fromEntries(Object.entries(INVITE_SHOWS).map(([k, v]) => [k, v.share])));
/** The two shows in order (src/lib/shows.ts SHOW_ORDER), which guests.mjs re-exports. */
export const SHOW_ORDER = Object.freeze(Object.keys(INVITE_SHOWS));

/** Each show's invites this week, by its share of the week's invites (INVITES_A_WEEK unless the spec says otherwise), Make Your Mind Up's share rounded up. Pure. */
export function weeklyInvites(total = INVITES_A_WEEK, shares = SHOW_SHARES) {
  const mymu = Math.ceil(total * shares.makeyourmindup / 100);
  return { makeyourmindup: mymu, signal_noise: Math.max(0, total - mymu) };
}

/** The Monday his London week began, as a time. Pure. */
export function londonWeekStart(at) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(at));
  const get = t => day.find(p => p.type === t)?.value;
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const back = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[get('weekday')] ?? 0;
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  // London is at UTC or an hour ahead; an hour early never misses a Monday invite.
  return d.getTime() - 3600000;
}

/** A guest's full name without a title, or null. */
export const guestName = g => { const n = givenParts(g?.name ?? ''); return n.length >= 2 ? n.join(' ') : null; };

/** The guests already invited: an answer on an invite to them. Their own row says drafted or booked too. */
export function invitedGuests(context) {
  const out = new Set();
  for (const f of Array.isArray(context?.feedback) ? context.feedback : []) {
    const m = /^contact:([0-9a-f-]{36})$/i.exec(f?.subject_ref ?? '');
    if (m && f.row === 'visibility' && ['approved', 'done', 'declined'].includes(f.state)) out.add(m[1].toLowerCase());
  }
  return out;
}

/** How many invites to each show were carried out this week. */
export function invitesThisWeek(context, guests, at) {
  const since = londonWeekStart(at);
  const showOf = new Map(guests.map(g => [String(g.contact_id).toLowerCase(), g.invite_show]));
  const out = { makeyourmindup: 0, signal_noise: 0 };
  for (const f of Array.isArray(context?.feedback) ? context.feedback : []) {
    const m = /^contact:([0-9a-f-]{36})$/i.exec(f?.subject_ref ?? '');
    if (!m || f.row !== 'visibility' || f.reference !== 'visibility:invite' || !f.carried_out || !(Date.parse(f.decided_at ?? '') >= since)) continue;
    const show = showOf.get(m[1].toLowerCase());
    if (show in out) out[show] += 1;
  }
  return out;
}

/** Why a guest is not invited today, or null when they may be. Pure. */
export function inviteHold(g, { L, invited, routes, at }) {
  if (typeof g?.contact_id !== 'string' || !UUID.test(g.contact_id)) return 'no_contact';
  if (!(g.invite_show in INVITE_SHOWS)) return 'no_show';
  if (g.buried_at) return 'buried';
  // Recorded on the show he would be invited to is done; recorded on his other show is a past guest worth having again
  // (Ruling, Krish, 2026-10-28: volume now), so a past Signal & Noise guest may be invited onto Make Your Mind Up.
  if ((g.recorded_at || g.published_at) && (!g.podcast_target || g.podcast_target === g.invite_show)) return 'recorded';
  const pastOther = ['recorded', 'published'].includes(String(g.status)) && g.podcast_target && g.podcast_target !== g.invite_show;
  if (!OPEN_GUEST.has(g.status) && !pastOther) return 'not_open';
  if (g.invite_state && g.invite_state !== 'proposed') return 'already_invited';
  const verdict = guestVerdictOf(g);
  if (verdict === 'rejected') return 'guest_rejected';
  if (!(verdict in GUEST_VERDICT)) return 'guest_not_judged';
  if (!guestName(g)) return 'no_name';
  if (KRISH.test(g.name)) return 'krish_himself';
  const email = routes?.[g.contact_id]?.email;
  if (email !== 'verified' && email !== 'unchecked') return 'no_email';
  if (invited.has(g.contact_id.toLowerCase())) return 'already_invited';
  return refusedBy(L, { subject: `contact:${g.contact_id}`, row: 'visibility', kind: null, sector: null, topic: guestTopic(g), band: 'unknown' }, at);
}

/** What a guest talks about, from their own record; null when nothing says. Pure. */
export function guestTopic(g) {
  const text = [g?.one_liner, g?.why_fit].filter(x => typeof x === 'string').join(' | ');
  return text.trim() ? (TOPICS.find(([, re]) => re.test(text))?.[0] ?? null) : null;
}

/** A public page about the guest from their evidence: https, never a profile or a way to reach them. */
const evidencePages = g => (Array.isArray(g?.evidence) ? g.evidence : [])
  .filter(e => typeof e?.url === 'string' && /^https:\/\/\S+$/.test(e.url) && e.url.length <= 2000 && !NOT_A_SOURCE.test(e.url) && typeof e.label === 'string' && clean(e.label));

/** The show an invite is to, in the words the run reads: the publication's name from the canon, Signal & Noise by the ruling. Pure. */
export function inviteShow(slug, canon) {
  return slug === 'makeyourmindup'
    ? { name: canon.publication.name, who: `who writes ${canon.publication.name} (${canon.publication.url})`, self: `I write ${canon.publication.name} (${canon.publication.url})`, ask: 'for one of its weekly conversations' }
    : { name: 'Signal & Noise', who: KRISH_TITLE, self: `I'm ${KRISH_TITLE}`, ask: 'on the show for a conversation' };
}

/** A page's own title as an invite may quote it: a few words long, never a bare word or an address; else ''. Pure. */
const quotable = page => {
  const label = page ? clean(page.label).replace(/[.!?]+$/, '') : '';
  return label && label.length <= 100 && /\S\s+\S/.test(label) && !/https?:|www\.|@/i.test(label) ? label : '';
};

/** The invite in Jonny's words: one point, one ask, Krish in the third person, signed Jonny. Pure. */
export function inviteWords({ name, show, page }) {
  const label = quotable(page);
  const seen = label ? `We came across "${label}", and it is exactly the kind of thinking we'd love to hear more of.` : '';
  const lines = [
    `I work with Krish Raja, ${show.who}. We'd love to have you ${show.ask}.`,
    ...(seen ? [seen] : []),
    'Would you be up for it in the coming weeks? I can send a short brief and a few dates.',
  ];
  return {
    subject: clean(`A conversation for ${show.name}`).slice(0, 200),
    body: [`Hi ${firstName(name)},`, ...lines.map(clean), 'Jonny'].join('\n\n'),
  };
}

// ── Who writes to someone in his network (Ruling, Krish, 2026-10-28) ──────
//
// "anyone that comes from inside my Network, should only ever be emailed by
// me." Control Center says who is: routes[contact_id].in_network, true when
// the contact's network tier is one of his own networks (reciprocated, core,
// known or owned), false when it is not, null when it cannot say, advertised
// by features.network_routes. Jonny's box never writes to anyone it says is
// in his network, nor to anyone it cannot say about. Someone in his network
// is not dropped: the same approach goes on Krish's own row, in his own
// words and signed by him, for his Draft press into his own box.

/** Jonny's lane's hold for a recipient who is not his to write to. */
export const NETWORK_HOLD = Object.freeze({ krish: 'network_is_krish', unknown: 'jonny_network_unknown' });
/** A card's line for someone in his network when nothing more is on record. */
const IN_NETWORK_KNOWN = 'They are in your own network, so you write to them yourself.';

/** The tier each network list the context serves gives a contact (network, quiet_ties, amplifier_candidates), by lower-cased id; one of his own tiers wins. Pure. */
export function networkListed(context) {
  const out = new Map();
  const lists = [context?.network, context?.quiet_ties, context?.amplifier_candidates].flatMap(l => Array.isArray(l) ? l : []);
  for (const c of lists) {
    if (typeof c?.contact_id !== 'string') continue;
    const id = c.contact_id.toLowerCase(), tier = typeof c.network_tier === 'string' ? c.network_tier : null;
    if (!out.has(id) || WARM_TIERS.includes(tier)) out.set(id, tier);
  }
  return out;
}

/**
 * Whose box may write to one recipient: 'krish' when Control Center says they
 * are in his network, or a list it serves puts them on one of his own tiers;
 * 'jonny' when, serving the flag, it says they are not; otherwise 'unknown'.
 * One exception: a podcast's or a stage's booking address (booking) that no
 * network list names is the show's own, so Jonny may still write to it. A
 * false read without the flag advertised says nothing. Pure.
 */
export function networkLane(contactId, { routes, listed, served = false, booking = false }) {
  if (typeof contactId !== 'string' || !UUID.test(contactId)) return 'unknown';
  const flag = routes?.[contactId]?.in_network;
  if (flag === true || WARM_TIERS.includes(listed.get(contactId.toLowerCase()))) return 'krish';
  if (served && flag === false) return 'jonny';
  return booking && !listed.has(contactId.toLowerCase()) ? 'jonny' : 'unknown';
}

/** The invite in Krish's own words, for someone in his network: the same show and the same page as Jonny's, one ask. actionFor signs it Krish. Pure. */
export function krishInviteWords({ show, page }) {
  const label = quotable(page);
  return {
    subject: clean(`A conversation for ${show.name}`).slice(0, 200),
    lines: [
      `${show.self}, and I'd love to have you ${show.ask}.`,
      ...(label ? [`I came across "${label}", and it's the kind of thinking I'd like more of on the show.`] : []),
      'Would you be up for it in the coming weeks? I can send a short brief and a few dates.',
    ],
  };
}

/** Who he is to a booker he knows, in his own words, from the canon this run reads. */
const selfLine = canon => `I'm ${KRISH_TITLE} and I write ${canon.publication.name} (${canon.publication.url}). At Mindmake I help leaders build their AI brain: "${canon.brain}"`;

/** A podcast pitch in Krish's own words, to someone in his network who books the show: the same topic as Jonny's, one ask. Pure. */
export function krishPitchWords({ show, topic, canon }) {
  const [about, short] = TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership;
  return {
    subject: clean(`A guest for ${show}: ${short}`).slice(0, 200),
    lines: [`I'd love to come on ${show} and talk about ${about}.`, selfLine(canon), 'Would you have me on? I can send a short brief and a few dates.'],
  };
}

/** A speaking pitch in Krish's own words, to someone in his network who books the speakers: the same talk as Jonny's, one ask. Pure. */
export function krishSpeakWords({ event, ask, talk, canon }) {
  return {
    subject: clean(`A speaker for ${event}: ${talk}`).slice(0, 200),
    lines: [`I'd like to put myself forward for ${ask} at ${event}: "${talk}".`, selfLine(canon), 'Would you consider me for the programme? I can send a short abstract and a bio.'],
  };
}

/** The full card for an invite: who the guest is, how Krish knows them, why them, what he gets, the angles. By Jonny, or by Krish to someone in his network. */
export function inviteCard({ g, name, show, topic, canon, contact, serves, weekly, by = 'jonny' }) {
  const who = within(`${name}${g.one_liner ? `: ${leadFacts(g.one_liner, CARD_WHO_MAX - name.length - 2).replace(/[.!?]+$/, '')}` : ''}.`, CARD_WHO_MAX) || `${name}.`;
  const known = (contact ? knownWords(contact) : '') || (by === 'krish' ? IN_NETWORK_KNOWN : 'You do not know them yet. Jonny writes first, from his own Gmail.');
  const pages = evidencePages(g);
  const why = [leadFacts(g.why_fit, CARD_LINE_MAX), pages[0] ? within(`Seen online: ${clean(pages[0].label)}.`) : '', guestVerdictOf(g) === 'take' ? `The guest standard judged them worth having on ${show.name}.` : `The guest standard judged them a stretch for ${show.name}, worth asking.`]
    .filter(Boolean).filter((l, i, a) => a.findIndex(x => x.slice(0, 40) === l.slice(0, 40)) === i).slice(0, CARD_LINES);
  const goal = serves ? within(`It serves this week's goal: ${serves.replace(/[.!?]+$/, '')}.`) : '';
  const gain = [`A guest for ${weekly ? `${show.name}'s weekly conversation` : show.name}, and a conversation that puts both names in front of each other's audience.`, ...(goal ? [goal] : [])].map(l => within(l)).filter(Boolean);
  const [about, short] = TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership;
  const angles = [
    { title: fitTitleWithin(CARD_ANGLE_TITLE_MAX, short.charAt(0).toUpperCase() + short.slice(1), 'The conversation'), line: within(`Ask them about ${about}, from their own work.`) },
    { title: canon.publication.name, line: within(`Point them to ${canon.publication.name} first, at ${canon.publication.url}, so they know the conversation before they say yes.`) },
  ].filter(a => a.line && a.title.length <= CARD_ANGLE_TITLE_MAX);
  const sources = pages.slice(0, CARD_SOURCES).map(e => ({ label: fitTitleWithin(80, clean(e.label)), url: e.url }));
  return { who, known, why: why.length ? why : [`${name} is worth having on ${show.name}.`], gain: gain.length ? gain : [`A guest for ${show.name}.`], angles, sources };
}

/** This run's invites: the shows' room this week, Make Your Mind Up first, the best judged guest first, at most INVITES_PER_RUN. Pure. */
export function pickInvites(open, done, perRun = INVITES_PER_RUN, quota = weeklyInvites()) {
  const room = { makeyourmindup: Math.max(0, quota.makeyourmindup - done.makeyourmindup), signal_noise: Math.max(0, quota.signal_noise - done.signal_noise) };
  const picked = [];
  const take = slug => {
    const next = room[slug] > 0 && picked.length < perRun ? open.find(o => o.g.invite_show === slug && !picked.includes(o)) : null;
    if (next) { picked.push(next); room[slug] -= 1; }
    return Boolean(next);
  };
  // The weekly conversation first, then Signal & Noise, then whichever still has room.
  take('makeyourmindup');
  take('signal_noise');
  while (take('makeyourmindup') || take('signal_noise'));
  // A show with no one left to invite gives its room to the other, inside the week's total (Ruling, Krish, 2026-10-28: volume now).
  let week = Math.max(0, quota.makeyourmindup + quota.signal_noise - done.makeyourmindup - done.signal_noise) - picked.length;
  for (const o of open) {
    if (week <= 0 || picked.length >= perRun) break;
    if (!picked.includes(o) && o.g.invite_show in room) { picked.push(o); week -= 1; }
  }
  return picked;
}

/** How many of each kind a run writes: stages up to their share, podcasts the rest, and a share one kind cannot fill goes to the other. Pure. */
export function shares(podcasts, stages, total = PITCHES_PER_RUN, stageShare = STAGE_SHARE) {
  const p = Math.min(podcasts, total - Math.min(stages, stageShare, total));
  return { podcasts: p, stages: Math.min(stages, total - p) };
}

/** A stage's reach: its audience size as Nova read it, a figure with its page and when, else a band nobody has measured. Pure. */
export function reachOf(t, basis, unknown) {
  const n = t?.audience_size;
  const page = typeof t?.event_url === 'string' && /^https:\/\/\S+$/.test(t.event_url) && !NOT_A_SOURCE.test(t.event_url) ? t.event_url : null;
  const asOf = Number.isFinite(Date.parse(t?.updated_at ?? '')) ? new Date(Date.parse(t.updated_at)).toISOString() : null;
  if (Number.isInteger(n) && n > 0 && page && asOf) return { value: n, band: bandOf(n), basis, source_url: page, as_of: asOf };
  return { value: null, band: 'unknown', basis: unknown, source_url: null, as_of: null };
}

// ── Forms on his tap (Ruling, Krish, 2026-10-26) ───────────────────────────
//
// "A form is filled for him and his tap submits it; when it cannot be, the
// most automated next best route." Control Center reads each stage's own
// speaker call or guest form (cfp_url) and the fields it asks (form_fields).
// The engine answers each field by its own label from what the run reads,
// and his Submit fills it in a browser and sends it, but only when every
// required field is filled and nothing on the page is his alone to give.
// A form the engine cannot answer for certain is never written, and the
// stage falls to its Jonny pitch.

/** His public business address: the one email a form is ever given for him (Krish, 2026-10-26). Never any other. */
export const FORM_EMAIL = 'hello@krishraja.com';
/** Mindmake's site, which a website field is given: mindmake.co for every Mindmake venture thing (Krish, 2026-10-27). */
export const FORM_SITE = 'https://mindmake.co';
/** His personal speaker site, given only where a field's own label asks for that. */
export const SPEAKER_SITE = 'https://krishraja.com';
/** A label that asks for his personal or speaker site rather than the company's. */
const SPEAKER_LABEL = /\b(?:personal (?:site|website|web site|page|url)|speaker (?:site|website|web site|page|url)|your own (?:site|website))\b/;
/** Forms a row leads with at most in a run, so the people the engine ranked still show behind them on his widget. */
export const FORMS_PER_ROW = 2;
/** A bio and an abstract are whole sentences within these, or within a limit the field's own label states. */
export const BIO_MAX = 700;
export const ABSTRACT_MAX = 1500;
/** What Control Center's version 2 form action takes (parseActionV2), and a proposal's exact words. */
const FORM_ANSWERS_MAX = 40;
const PAYLOAD_MAX = 8000;
/** A try Control Center says went, or may have gone (a browser that never answered): never sent again. */
const SENT = new Set(['submitted', 'confirmed', 'running']);
/** The holds that are the form's own to count; a stage's own reasons (applied, buried, past its deadline, a No) are its pitch's. */
const FORM_OWN = new Set(['in_script', 'sent', 'blocked', 'terms', 'unanswerable', 'no_email', 'labels_overlap', 'too_long', 'per_run_cap', 'lane_off']);

/** A label as Control Center's form runner reads it (api/_formRunner.ts): lower case, letters and digits, single spaces. Pure. */
export const formKey = s => String(s ?? '').toLowerCase().replace(/\*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// What a field asks, read from its label as formKey gives it. Checked in this
// order: what is never his to give first, then what the run can answer.
const CONSENT = /\b(?:terms|conditions|privacy|consent|agree|agreement|policy|gdpr|permission|opt in|unsubscribe|newsletter|code of conduct|marketing (?:emails?|communications?))\b/;
const PHONE = /\b(?:phone|mobile|cell|telephone|tel|whatsapp|sms|contact number|(?:country|area|dial(?:l)?ing|calling) code)\b/;
const PAYMENT = /\b(?:card|cvc|cvv|iban|payment|billing|invoice|fees?|price|cost|budget|honorarium|sort code|account number|paypal|vat|tax)\b/;
const SECRET = /\b(?:password|passcode|pin)\b/;
const BIRTH = /\b(?:birth|dob|birthday|age)\b/;
const DEMOGRAPHIC = /\b(?:gender|sex|pronouns?|ethnic\w*|race|racial|disab\w*|religio\w*|sexual\w*|orientation|nationality|citizenship|veteran|marital|caste|lgbt\w*|minority|underrepresented|diversity)\b/;
const SOMEONE_ELSE = /\b(?:referee|reference|nominat\w*|recommend\w*|assistant|agent|manager|colleague|emergency|spouse|guardian|parent|booker|co ?speakers?|co ?presenters?|co ?hosts?|second speaker|additional speakers?|other speakers?|panell?ists?|moderators?)\b/;
const NOT_TEXT = new Set(['number', 'range', 'date', 'datetime-local', 'time', 'month', 'week', 'color', 'tel']);
const EMAIL = /\be ?mail\b/;
const LINKEDIN = /\blinked ?in\b/;
const ELSEWHERE = /\b(?:twitter|instagram|tiktok|facebook|youtube|threads|bluesky|mastodon|social|handle|video|recording|reel|sample|slides?|deck|portfolio|headshot|photo|image|picture|logo|cv|resume)\b/;
const ORG = /\b(?:company|organi[sz]ation|employer|business|affiliation|institution|firm)\b/;
const NOT_ORG_NAME = /\b(?:size|website|site|url|link|web|description|describe|revenue|employees|industry|sector|type|logo|stage|founded|funding|headcount|number|about|address)\b/;
const WEBSITE = /\b(?:website|web site|homepage|home page|personal site|url|web address|link)\b/;
const POSTAL = /\b(?:address|street|post ?code|zip|postal|house|flat|apartment)\b/;
const PLACE = /\b(?:location|city|town|country|region|state|province|county|based|where are you|time ?zone)\b/;
const TALK_TITLE = /\b(?:(?:talk|session|presentation|proposal|keynote|workshop|panel|episode|submission) (?:title|name)|title of (?:your |the )?(?:talk|session|presentation|proposal|keynote|workshop|submission)|(?:proposed|working) title)\b/;
const FIRST = /\b(?:first|given|fore) ?name\b/;
const LAST = /\b(?:last|family|sur) ?name\b/;
const NOT_HIS_NAME = /\b(?:middle|event|talk|session|show|podcast|episode|file|user|nick|brand|product|team|school|university|venue|group|account|channel|project|book|course|publication|newsletter|conference)\b/;
const JOB = /\b(?:job ?title|job|role|position|designation|occupation|(?:your|current|professional) title)\b/;
const BIO = /\b(?:bio|biography|about (?:you|yourself|me|the speaker|the guest)|speaker profile|introduce yourself|who are you|background)\b/;
const ABSTRACT = /\b(?:abstract|synopsis|summary|outline|description|describe|proposal|pitch|what (?:will|would|do) you (?:like to )?(?:talk|speak|cover|share|discuss)|talk about|speak about|about (?:your|the) (?:talk|session|idea|topic|presentation)|session details|why (?:should|would) (?:we|you)|why you|your idea|episode idea|topic idea)\b/;
const FORMAT = /\b(?:format|session type|talk type|presentation type|submission type|type of (?:session|talk|presentation|submission))\b/;
const TOPIC_FIELD = /\b(?:topics?|track|theme|category|subject|stream|focus area|area of expertise|expertise)\b/;
/** An option that is a prompt, a catch-all or a different ask: never chosen. */
const NOT_AN_OPTION = /^(?:select|choose|please|pick|none|n a|other|any)\b|\b(?:lightning|workshop|masterclass|tutorial|hands on|lab|poster|demo)\b/;
const AI_OPTION = /\b(?:ai|a i|artificial intelligence|machine learning|generative|genai|gen ai|llms?)\b/;
// The country a speaker form asks for (Ruling, Krish, 2026-10-31: "UK & US or global if its virtual").
/** A field that asks for a country, and not for a city, a state or an address beside it. */
const COUNTRY = /\b(?:country|countries|territory|nation)\b/;
// A country of his own (where he lives, comes from or holds a passport) or a dialling code is not the event's country: never given.
const NOT_COUNTRY = /\b(?:city|town|state|province|county|time ?zone|address|street|post ?code|zip|postal|code|dial\w*|calling|prefix|residence|resident|reside|live|living|home|based|origin|birth|citizenship|passport|nationality)\b/;
/** An option, as formKey gives it, that is the United Kingdom, the United States, or no one country. */
const UK_OPTION = /^(?:the )?(?:united kingdom|great britain|britain|uk|u k|gb)(?: (?:uk|u k|gb|of great britain and northern ireland))?$/;
const US_OPTION = /^(?:the )?(?:united states|united states of america|usa|us|u s|u s a)(?: (?:usa|us|u s|u s a))?$/;
const GLOBAL_OPTION = /\b(?:global|worldwide|international|anywhere|remote|virtual|online)\b/;
/** Words that say an event is held online, in its own location or format, or a title that says so plainly. */
const VIRTUAL = /\b(?:virtual|online|remote|webinar|webcast|livestream|live stream|zoom)\b/;
const VIRTUAL_TITLE = /\b(?:virtual|webinar|webcast|online summit|online conference|online event)\b/;
/** A location that is only an online marker ("Online", "Virtual event", "Zoom"): anything else in it is a place, so the event is held there. */
const ONLY_VIRTUAL = /^(?:(?:virtual|online|remote|webinar|webcast|livestream|live|stream|zoom|microsoft|teams|google|meet|event|events|only|via|on|the|internet|web|digital|global|worldwide|anywhere|tbc|tba|and|or)\s*)+$/;
/** Words that say an event is held in a room, whatever else it offers online. */
const IN_PERSON = /\b(?:hybrid|in person|on site|onsite|venue)\b/;
/** US state codes that are no country's ISO code: one alone as a location's last part is the United States ("Austin, TX"). */
const STATE_ONLY = new Set('AK CT DC FL HI IA KS MI NV NJ NM NY ND OH OK OR RI TX UT VT WA WV WI WY'.split(' '));
/** US state codes that are also a country's ISO code (DE Germany, IN India, CA Canada, IL Israel, MA Morocco...): American only beside another US signal. */
const STATE_OR_COUNTRY = new Set('AL AZ AR CA CO DE GA ID IL IN KY LA ME MD MA MN MS MO MT NE NH NC PA SC SD TN VA'.split(' '));
/** Whether a two-letter code is some country's ISO code ("FR", "AU"). */
const isoCountry = code => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) !== code; } catch { return false; } };
/** The United States named, as formKey gives it. */
const US_COUNTRY = /\b(?:united states|united states of america|usa|u s a|u s)\b/;
const US_STATE = /\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|west virginia|wisconsin|wyoming|washington d ?c)\b/;
/** A city that is only American when nothing beside it names somewhere else ("Boston, Lincolnshire" is not). */
const US_CITY = /\b(?:nyc|manhattan|brooklyn|san francisco|los angeles|las vegas|chicago|boston|austin|seattle|miami|atlanta|denver|dallas|houston|orlando|san diego|san jose|philadelphia|nashville|phoenix|silicon valley)\b/;
/** A location that names another country is not American, whatever abbreviation follows a comma ("Perth, WA, Australia"). New Mexico is a state. */
const NOT_US = /\b(?:australia|canada|united kingdom|uk|u k|great britain|britain|england|scotland|wales|ireland|india|(?<!new )mexico|germany|france|spain|portugal|italy|netherlands|holland|belgium|switzerland|austria|sweden|norway|denmark|finland|poland|greece|turkey|israel|uae|united arab emirates|dubai|saudi arabia|qatar|egypt|morocco|nigeria|kenya|south africa|singapore|malaysia|indonesia|philippines|thailand|vietnam|japan|china|hong kong|taiwan|korea|new zealand|brazil|argentina|colombia|chile|peru|costa rica|panama|tbilisi)\b/;

/**
 * Where an event is, as far as the stage Control Center holds says. Virtual
 * when its location is only an online marker ("Online", "Virtual") or, with no
 * location, its format or title says so; a location that also names a place,
 * or anything that says hybrid or in person, is held in a room. In the United
 * States only on a US signal with nothing naming another country (inUS). A
 * stage that says nothing is taken as neither virtual nor in the United
 * States, so its form is answered United Kingdom. Pure.
 */
export function eventPlace(t) {
  const location = typeof t?.location === 'string' ? t.location : '';
  const format = typeof t?.format === 'string' ? t.format : '';
  const title = typeof t?.title === 'string' ? t.title : '';
  const loc = formKey(location);
  const inPerson = IN_PERSON.test(formKey(`${location} ${format}`));
  const virtual = !inPerson && (loc
    ? VIRTUAL.test(loc) && ONLY_VIRTUAL.test(loc)
    : VIRTUAL.test(formKey(format)) || VIRTUAL_TITLE.test(formKey(title)));
  return { virtual, us: inUS(location) };
}

/**
 * Whether a location is in the United States: the country or a state named in
 * full; a state code that is no country's ISO code as the last part ("Austin,
 * TX"); an American city whose other parts are only state codes ("Boston,
 * MA") or Georgia, which is also a country ("Atlanta, Georgia"). A state code that is also a country's ("Berlin, DE", "Tel Aviv, IL")
 * is not enough alone, and a last part that is another country's code
 * ("Toronto, ON, CA", "Paris, FR") or any country named in full is abroad. Pure.
 */
function inUS(location) {
  const parts = location.split(/[,;|()/]+/).map(x => x.trim()).filter(Boolean);
  if (!parts.length || NOT_US.test(formKey(location))) return false;
  const code = part => { const c = part.replace(/\./g, ''); return /^[A-Z]{2,3}$/.test(c) ? c : null; };
  if (parts.some(part => code(part) === 'US' || code(part) === 'USA' || US_COUNTRY.test(formKey(part)) || US_STATE.test(formKey(part)))) return true;
  const last = code(parts[parts.length - 1]);
  const stateCode = part => { const c = code(part); return c && (STATE_ONLY.has(c) || STATE_OR_COUNTRY.has(c)) ? c : null; };
  const cityAt = parts.findIndex(part => US_CITY.test(formKey(part)));
  if (cityAt >= 0 && parts.every((part, i) => i === cityAt || stateCode(part) || formKey(part) === 'georgia')) return true;
  if (last && !STATE_ONLY.has(last) && isoCountry(last)) return false;
  return parts.length > 1 && !!last && STATE_ONLY.has(last);
}

/** The country a country field takes, by his ruling: Global when the event is virtual, else United States or United Kingdom by where it is. Pure. */
export function countryAnswer(field, place) {
  const { virtual = false, us = false } = place ?? {};
  const type = String(field?.type ?? 'text').toLowerCase();
  const country = us ? US_OPTION : UK_OPTION;
  if (type !== 'select') return virtual ? 'Global' : us ? 'United States' : 'United Kingdom';
  // A choice only from the field's own options, by their own words; none that fits holds the form.
  // A prompt or a catch-all ("Select country (international)") is never the answer, as in choose().
  const real = (Array.isArray(field?.options) ? field.options : []).filter(o => typeof o === 'string' && formKey(o) && !NOT_AN_OPTION.test(formKey(o)));
  const pick = re => real.find(o => re.test(formKey(o)));
  const hit = (virtual ? pick(GLOBAL_OPTION) : undefined) ?? pick(country);
  return hit ? clean(hit) : null;
}

/**
 * What a form's field asks, from its own label and type: one of the answers
 * the run can give (full_name, first_name, last_name, email, company,
 * job_title, website, bio, talk_title, abstract, format, topic, and location
 * where it asks for a country), one the canon does not give yet (linkedin,
 * and location where it asks for a city or a region), one never given for him
 * (terms, phone, payment, password, birth, demographic, someone_else,
 * number, address), or null for anything else. Pure.
 */
export function fieldAsk(field) {
  const k = formKey(field?.label);
  const type = String(field?.type ?? 'text').toLowerCase();
  if (!k) return null;
  if (CONSENT.test(k)) return 'terms';
  // A box or a choice is never ticked for him: the fields read carry no choices for one.
  if (type === 'checkbox' || type === 'radio') return null;
  if (type === 'tel' || PHONE.test(k)) return 'phone';
  if (PAYMENT.test(k)) return 'payment';
  if (SECRET.test(k)) return 'password';
  if (BIRTH.test(k)) return 'birth';
  if (DEMOGRAPHIC.test(k)) return 'demographic';
  if (SOMEONE_ELSE.test(k)) return 'someone_else';
  if (NOT_TEXT.has(type)) return 'number';
  if (type === 'email' || EMAIL.test(k)) return 'email';
  if (LINKEDIN.test(k)) return 'linkedin';
  if (ELSEWHERE.test(k)) return null;
  // The company's website is Mindmake's, mindmake.co (FORM_SITE), since 2026-10-27.
  if (ORG.test(k)) return WEBSITE.test(k) ? 'website' : NOT_ORG_NAME.test(k) ? null : 'company';
  if (WEBSITE.test(k)) return 'website';
  if (POSTAL.test(k)) return 'address';
  if (PLACE.test(k)) return 'location';
  if (TALK_TITLE.test(k)) return 'talk_title';
  if (FIRST.test(k)) return 'first_name';
  if (LAST.test(k)) return 'last_name';
  if (/\bname\b/.test(k)) return NOT_HIS_NAME.test(k) ? null : 'full_name';
  if (JOB.test(k) && !/\b(?:description|describe|responsibilit\w*)\b/.test(k)) return 'job_title';
  if (BIO.test(k)) return 'bio';
  if (ABSTRACT.test(k)) return 'abstract';
  if (FORMAT.test(k)) return 'format';
  if (TOPIC_FIELD.test(k)) return 'topic';
  return null;
}

/** A limit the field's own label states ("max 100 words", "500 characters"), or none. Pure. */
export function labelLimit(label) {
  const k = formKey(label);
  const m = /\b(?:max(?:imum)?|up to|no more than|under|less than|within|in)\s+(\d{1,5})\s+(words?|characters?|chars?)\b/.exec(k)
    ?? /\b(\d{1,5})\s+(words?|characters?|chars?)\b/.exec(k);
  if (!m) return {};
  return /^w/.test(m[2]) ? { words: Number(m[1]) } : { chars: Number(m[1]) };
}

/** Whole sentences of the text within a limit of characters and of words, never cut mid-sentence; '' when not even the first fits. Pure. */
export function wholeWithin(text, { chars = Infinity, words = Infinity } = {}) {
  let out = '';
  for (const s of clean(text).split(/(?<=[.!?]["”]?)\s+/)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > chars || next.split(/\s+/).length > words) break;
    out = next;
  }
  return out;
}

/** Who Krish is, in the third person, from the canon and his own site's record read this run. Pure. */
export function formBio(canon, record) {
  return [
    `Krish Raja is ${KRISH_TITLE} and writes ${canon.publication.name} (${canon.publication.url}).`,
    `At Mindmake he helps leaders build their AI brain: "${canon.brain}"`,
    ...(record?.line ? [record.line] : []),
  ].map(clean).join(' ');
}

/** What he would talk about there, plainly, then who he is: the abstract a form asks for, and the words of the form action. Pure. */
export function formAbstract({ row, name, ask, talk, about, canon, record }) {
  const lead = row !== 'events' ? `Krish Raja would come on ${name} to talk about ${about}.`
    : ask === 'a panel seat' ? `On a panel at ${name}, Krish Raja would speak to ${about}.`
    : `In "${talk}", Krish Raja talks about ${about}.`;
  return wholeWithin([
    lead,
    `He is ${KRISH_TITLE} and writes ${canon.publication.name} (${canon.publication.url}).`,
    `At Mindmake he helps leaders build their AI brain: "${canon.brain}"`,
    ...(record?.line ? [record.line] : []),
  ].map(clean).join(' '), { chars: ABSTRACT_MAX });
}

/** The first of the options a preference names, in the order of the preferences, as the form wrote it; null when none fits. Pure. */
function choose(options, preferences) {
  const real = (Array.isArray(options) ? options : []).filter(o => typeof o === 'string' && formKey(o) && !NOT_AN_OPTION.test(formKey(o)));
  for (const p of preferences) { const hit = real.find(o => p.test(formKey(o))); if (hit) return clean(hit); }
  return null;
}

/** Which kinds of field a value may go in: an email in an email field, a link in a link field, a choice only from a field's own options, and text in text. */
const FITS = { email: ['email'], url: ['website'], select: ['format', 'topic', 'location'] };
function fits(type, ask) {
  if (FITS[type]) return FITS[type].includes(ask);
  return ['text', 'textarea', 'search', ''].includes(type) && ask !== 'format';
}

/** The answer to one field, from what the run reads, or null when the run is not sure of one. Pure. */
export function answerFor(field, said) {
  const ask = fieldAsk(field);
  const type = String(field?.type ?? 'text').toLowerCase();
  if (!ask || !fits(type, ask)) return null;
  const limit = labelLimit(field.label);
  const whole = (text, max) => wholeWithin(text, { chars: Math.min(max, limit.chars ?? Infinity), words: limit.words ?? Infinity }) || null;
  switch (ask) {
    case 'full_name': return 'Krish Raja';
    case 'first_name': return 'Krish';
    case 'last_name': return 'Raja';
    case 'email': return FORM_EMAIL;
    case 'company': return 'Mindmake';
    case 'job_title': return KRISH_TITLE;
    case 'website': return SPEAKER_LABEL.test(formKey(field.label)) ? SPEAKER_SITE : FORM_SITE;
    case 'bio': return whole(said.bio, BIO_MAX);
    case 'abstract': return whole(said.abstract, ABSTRACT_MAX);
    case 'talk_title': return whole(said.talk, 200);
    case 'format': return type === 'select' ? choose(field.options, said.formats) : null;
    case 'topic': return type === 'select' ? choose(field.options, said.topics) : whole(said.topicLine, 200);
    // A country by his ruling (2026-10-31), from where the event is (said.place, eventPlace); a city, a state or a region stays empty.
    case 'location': { const k = formKey(field.label); return COUNTRY.test(k) && !NOT_COUNTRY.test(k) ? countryAnswer(field, said?.place) : null; }
    // linkedin: the canon names no profile today. The rest are never his to give here.
    default: return null;
  }
}

/**
 * The answer Control Center's runner would put in a field (api/_formFill.ts,
 * since krishanraja/control-center#576): of the answers whose label the
 * field's contains, or is contained by, the closest in length, so the field's
 * own label wins and "Name" never lands in "Company name". Pure.
 */
export function runnerPick(fieldLabel, answers) {
  const label = formKey(fieldLabel);
  if (!label) return null;
  const near = answers.filter(a => { const key = formKey(a.label); return key && Math.min(label.length, key.length) >= 3 && (label === key || label.includes(key) || key.includes(label)); });
  near.sort((x, y) => Math.abs(formKey(x.label).length - label.length) - Math.abs(formKey(y.label).length - label.length));
  return near[0] ?? null;
}

/** Whether the runner would put any answer in a field it was not written for, or tick a box with one. Pure. */
export function overlaps(fields, answers) {
  return fields.some(f => {
    const grouped = f.type === 'checkbox' || f.type === 'radio';
    // The runner leaves a terms box alone (a required one blocks the form), and a group is matched by its name.
    if (grouped && fieldAsk(f) === 'terms') return false;
    const got = runnerPick(grouped ? (f.name || f.label) : f.label, answers);
    if (!got) return false;
    if (grouped) return true;
    const own = answers.find(a => formKey(a.label) === formKey(f.label));
    return !own || own.value !== got.value;
  });
}

/**
 * The answers for one form, each under the field's own label, one for every
 * required field, or why there are none: a required field the run is not
 * sure of (unanswerable), a required terms box (terms: ticking one is a
 * legal yes in his name), no email for the stage to answer him on
 * (no_email), or labels so alike that the runner would put an answer in the
 * wrong field (labels_overlap). `missing` is what an
 * earlier try sent nothing for; each is answered now or it holds. Pure.
 */
export function formAnswers(fields, said, missing = []) {
  const answers = [];
  const add = (label, value) => { if (!answers.some(a => formKey(a.label) === formKey(label) && a.value === value)) answers.push({ label: clean(label).slice(0, 300), value }); };
  // A required terms box is a legal yes only he can give: named first, whatever else the form lacks.
  if ((Array.isArray(fields) ? fields : []).some(f => f?.required === true && fieldAsk(f) === 'terms')) return { answers: [], hold: 'terms' };
  for (const f of Array.isArray(fields) ? fields : []) {
    if (!f || typeof f.label !== 'string' || !formKey(f.label)) { if (f?.required === true) return { answers: [], hold: 'unanswerable' }; continue; }
    const value = formKey(f.label).length >= 3 ? answerFor(f, said) : null;
    if (value === null) { if (f.required === true) return { answers: [], hold: 'unanswerable' }; continue; }
    add(f.label, value);
  }
  const extra = [];
  for (const m of Array.isArray(missing) ? missing : []) {
    const f = { label: String(m ?? ''), name: null, type: 'text', required: true, options: [] };
    // Answered already and still not filled: the run has nothing better for it.
    if (runnerPick(f.label, answers)) return { answers: [], hold: 'unanswerable' };
    const value = formKey(f.label).length >= 3 ? answerFor(f, said) : null;
    if (value === null) return { answers: [], hold: fieldAsk(f) === 'terms' ? 'terms' : 'unanswerable' };
    add(f.label, value);
    extra.push(f);
  }
  if (!answers.some(a => a.value === FORM_EMAIL)) return { answers: [], hold: 'no_email' };
  if (answers.length > FORM_ANSWERS_MAX) return { answers: [], hold: 'too_long' };
  // When one label holds another ("Name" and "Company name"), both fields match both answers, so no order separates them.
  if (overlaps([...fields.filter(f => f && typeof f.label === 'string'), ...extra], answers)) return { answers: [], hold: 'labels_overlap' };
  return { answers, hold: null };
}

/** The row a stage's own form goes on: a stage to speak on on events, a podcast's or a show's guest form on visibility; null for anything else. Pure. */
export function formRow(t) {
  if (stageKind(t) === 'stage') return 'events';
  if (t?.type === 'podcast' || t?.type === 'guest_appearance') return 'visibility';
  return null;
}

/** A form page the runner may open: https, whole, never a profile or a way to reach someone. */
const formUrl = u => typeof u === 'string' && /^https:\/\/\S+$/.test(u) && u.length <= 2000 && !NOT_A_SOURCE.test(u) ? u : null;
/** A form's page as a key, so Control Center's copy of the url matches the one the engine wrote. */
const formUrlKey = u => { try { const x = new URL(u); x.hash = ''; return `${x.host}${x.pathname.replace(/\/+$/, '')}${x.search}`.toLowerCase(); } catch { return null; } };
const sameForm = (a, b) => { const x = formUrlKey(a); return x !== null && x === formUrlKey(b); };

/**
 * One stage's form: its row and answers, or its row and why it is held, or
 * null when the stage has no form the engine can read (no https cfp_url, or
 * fields not read yet). A stage's own reasons come first, as its pitch would
 * give them, then what his taps did with the form, then the answers. Pure.
 */
export function stageForm(t, { L, pitched, at, tries = [], canon, record = null }) {
  const row = formRow(t);
  const url = formUrl(t?.cfp_url);
  if (!row || !url || !Array.isArray(t.form_fields)) return null;
  const hold = h => ({ row, hold: h });
  // An empty list is a form drawn in script, which the runner cannot read: left alone.
  if (!t.form_fields.length) return hold('in_script');
  if (typeof t.title !== 'string' || !cleanName(t.title)) return hold('no_title');
  if (t.buried_at) return hold('buried');
  if (refusedByStandard(t, at)) return hold('rejected');
  if (t.status === 'applied' || t.applied_at) return hold('applied');
  if (!['sourced', 'queued'].includes(t.status)) return hold('not_open');
  if ([t.title, t.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) return hold('own_show');
  const now = Date.parse(at);
  if (Number.isFinite(Date.parse(t.deadline_at ?? '')) && Date.parse(t.deadline_at) < now) return hold('deadline_passed');
  if (Number.isFinite(Date.parse(t.event_start_at ?? '')) && Date.parse(t.event_start_at) < now) return hold('event_passed');
  // A show known to have gone quiet is not taking guests; a guest form on its own page with no feed read is the show asking.
  if (row === 'visibility' && (sinceLatest(t, at) ?? 0) > QUIET_AFTER_DAYS) return hold('quiet_show');
  const mine = (Array.isArray(tries) ? tries : []).filter(f => sameForm(f?.url, url));
  if (mine.some(f => SENT.has(f?.status))) return hold('sent');
  if (pitched.has(t.id)) return hold('already_pitched');
  const topic = showTopic(t);
  const refused = refusedBy(L, { subject: `target:${t.id}`, row, kind: row === 'events' ? 'ceo_educator' : 'broadcaster', sector: null, topic, band: 'unknown' }, at);
  if (refused) return hold(refused);
  // The last try that sent nothing: what only he could give holds it; what was missing is answered now or holds it.
  const last = mine.filter(f => f?.status === 'not_sent').sort((a, b) => String(b?.created_at ?? '').localeCompare(String(a?.created_at ?? '')))[0] ?? null;
  const blockers = Array.isArray(last?.blockers) ? last.blockers : [];
  if (blockers.length) return hold(blockers.includes('terms') ? 'terms' : 'blocked');
  const name = cleanName(t.title);
  const ask = row === 'events' ? speakingAsk(t) : 'a guest spot';
  const talk = talkTitle(t, topic);
  const [about, short] = TOPIC_PITCH[topic] ?? TOPIC_PITCH.leadership;
  const topicRe = TOPICS.find(([n]) => n === topic)?.[1];
  const said = {
    bio: formBio(canon, record), abstract: formAbstract({ row, name, ask, talk, about, canon, record }), talk, ask,
    topicLine: short.charAt(0).toUpperCase() + short.slice(1),
    formats: row !== 'events' ? [] : ask === 'a panel seat' ? [/\bpanel/, /\btalk\b/, /\bkeynote\b/, /\bpresentation\b/] : [/\btalk\b/, /\bkeynote\b/, /\bpresentation\b/, /\bsession\b/],
    // Every talk he gives is about AI, so a track named for it first, then one for the stage's own topic.
    topics: [AI_OPTION, ...(topicRe ? [topicRe] : [])],
    // Where the event is, for a country field: what the stage's own location, format and title say (eventPlace).
    place: eventPlace(t),
  };
  const { answers, hold: why } = formAnswers(t.form_fields, said, Array.isArray(last?.missing) ? last.missing : []);
  if (why) return hold(why);
  const action = { version: 2, channel: 'form', recipient_contact_id: null, subject: null, body: said.abstract, form: { url, answers }, mailbox: null };
  const exact = JSON.stringify(action);
  if (exact.length > PAYLOAD_MAX || !said.abstract) return hold('too_long');
  return { row, hold: null, url, name, ask, talk, topic, exact, retried: Boolean(last) };
}

/** A form proposal for his tap: a prepared send on its row, about the stage, with the form's page and every answer. */
function formProposal(f, rank, { t, canon, record, files, weekGoals, at, titleMax }) {
  const events = f.row === 'events';
  const noun = t.type === 'podcast' ? 'podcast' : 'show';
  const serves = servesOf(f.row, weekGoals);
  const base = events ? speakCard({ t, event: f.name, ask: f.ask, talk: f.talk, topic: f.topic, canon, serves })
    : pitchCard({ t, show: f.name, host: hostOf(t), topic: f.topic, canon, serves, at, noun });
  const room = typeof t.audience === 'string' && t.audience.trim() ? t.audience.trim().replace(/[.!?]+$/, '') : '';
  const sources = [...base.sources];
  if (!sources.some(s => s.url === f.url) && sources.length < CARD_SOURCES) sources.push({ label: fitTitleWithin(80, `${f.name}, its ${events ? 'call for speakers' : 'guest form'}`), url: f.url });
  const card = {
    ...base,
    known: within(`You do not know them yet. ${f.name}'s own page links this form for ${events ? 'speakers' : 'guests'}, and your tap sends it, every answer shown first.`) || 'You do not know them yet. Its own page links this form, and your tap sends it, every answer shown first.',
    // What he gets: the stage asked.
    gain: [within(`${f.name} asked for ${events ? 'talks' : 'guests'} through its own form: ${f.ask} for you${room ? `, in front of ${room}` : ''}.`) || `${f.name} asked for ${events ? 'talks' : 'guests'} through its own form.`, ...base.gain.slice(1)],
    sources,
  };
  const closes = dayMonth(t.deadline_at);
  const because = events ? `A stage that asks for talks${closes ? `, call closes ${closes}` : ''}. Your tap applies.` : `A ${noun} that asks for guests. Your tap applies.`;
  return {
    proposal_id: `gmp-${seal({ subject: `target:${t.id}`, ask: 'form' }).slice(0, 32)}`,
    title: events ? fitTitleWithin(titleMax, `Apply to speak at ${f.name}`, `Apply to ${f.name}`, 'Apply to speak at an event')
      : fitTitleWithin(titleMax, `Apply to be a guest on ${f.name}`, `Apply to ${f.name}`, `Apply to be a guest on a ${noun}`),
    why: clean(`${f.name} asks for ${events ? 'speakers' : 'guests'} through its own form, and every field it requires is answered from what the run reads.${f.retried ? ' His last tap sent nothing; what it lacked is answered now.' : ''} ${standardSays(t, at)} One ask: his tap sends it.`).slice(0, 1000),
    kind: 'prepared', wall: 'send', channel: 'form', amount_usd: 0, objective_key: OBJECTIVE,
    exact_payload: f.exact, target: f.url, subject_ref: `target:${t.id}`,
    evidence: [], close_condition: { event: 'form_submitted', reference: `${f.row}:form` },
    expires_at: new Date(Math.min(Date.parse(at) + 14 * DAY, Number.isFinite(Date.parse(t.deadline_at ?? '')) ? Date.parse(t.deadline_at) : Infinity)).toISOString(), stage: null, parent_proposal_id: null,
    row: f.row, rank,
    reach: events ? reachOf(t, 'people in its room, as Nova read it', "an event's room not yet measured") : reachOf(t, 'people in its audience, as Nova read it', 'a podcast audience not yet measured'),
    amplifier_kind: events ? 'ceo_educator' : 'broadcaster', features: { sector: null, topic: f.topic, seniority: null }, serves,
    source_revision: [...files, ...(record?.file ? [record.file] : [])].slice(0, 8),
    ...(because.length <= BECAUSE_MAX ? { because } : {}),
    brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: your tap sends ${f.name}'s own form, every answer shown first.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
    card,
  };
}

/**
 * Today's forms, at most FORMS_PER_ROW a row, best first (a stage by its
 * pitch's score, a show by its pitch's), ranked 1 on up within each row;
 * the form's own holds; and the stages whose pitch waits behind a form
 * (`routed`: form_route while a form is the route, form_sent once one went).
 */
export function formRows({ context, weekGoals, canon, record = null, files, at, titleMax = TITLE_MAX, L = lessons(context?.feedback, at), pitched = pitchedStages(context), formsPerRow = FORMS_PER_ROW, lanes = LANES_ON, wins = null }) {
  const tries = Array.isArray(context?.records?.forms) ? context.records.forms : [];
  const held = [], routed = new Map(), open = { visibility: [], events: [] }, seen = new Set();
  for (const t of Array.isArray(context?.records?.visibility) ? context.records.visibility : []) {
    if (typeof t?.id !== 'string' || !UUID.test(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    const f = stageForm(t, { L, pitched, at, tries, canon, record });
    if (!f) continue;
    if (f.hold) {
      if (f.hold === 'sent') routed.set(t.id, 'form_sent');
      if (FORM_OWN.has(f.hold)) held.push(f.hold);
      continue;
    }
    open[f.row].push({ f, t, score: f.row === 'events' ? speakScore(t, at, wins) : pitchScore(t, at, wins) });
  }
  const proposals = [];
  for (const row of ['visibility', 'events']) {
    open[row].sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id));
    open[row].forEach(({ f, t }, i) => {
      // A form waiting its turn is still the route: its pitch waits behind it.
      routed.set(t.id, 'form_route');
      if (lanes[row] === false) held.push('lane_off');
      else if (i < formsPerRow) proposals.push(formProposal(f, i + 1, { t, canon, record, files, weekGoals, at, titleMax }));
      else held.push('per_run_cap');
    });
  }
  return { proposals, held, routed };
}

/**
 * Today's pitches, best first, at most PITCHES_PER_RUN between them, each a
 * 1.9.0 row proposal for Jonny's box: podcasts on the visibility row, stages
 * to speak on on the events row; and why every other stage was left out.
 * A stage whose own form is answered gets the form, first on its row, and
 * its pitch waits behind it; the pitches rank after the forms on their row.
 * Ranks start at 1 within each row.
 */
/**
 * Lookups for an address (C2, 2026-10-29). A podcast or stage held only for
 * no_booking_address, and a guest held only for no_email or no_contact, would
 * be pitched or invited if an address were on record: the same run asks
 * Control Center's research desk to find where it takes pitches, so the hold
 * clears itself instead of sitting there every run. At most LOOKUPS_PER_RUN a
 * run (twelve since 2026-10-31: Ruling, Krish, "Raise the daily lookup"), first
 * in the research round, which carries twenty sent ten a request
 * (RESEARCH_ROUND and RESEARCH_BATCH in src/dispatch.mjs), cut to at most
 * half of the searches left of the desk's day (searchesLeft, withinSearches).
 * The kinds take turns, a stage, then a podcast, then a guest, then the next
 * stage, each kind in its own rank (stages by speakScore, podcasts by
 * pitchScore, guests by verdict and strength), so no kind waits behind another.
 *
 * When it is asked again: never while Control Center's context holds a lookup
 * for the subject with no answer yet, or one whose results gave a route (the
 * context carries the desk's last 14 days, its 200 newest rows). One over the
 * cap or failed is asked again the next day. One that has left the context is asked again as a
 * new lookup, at most once a London day. Every attempt has an id of its own,
 * the subject, the London day and the words' digest, so a resend is never the
 * same id with other words (which the desk refuses for the whole batch), and
 * the same id is only ever the same words, whose stored answer the desk replays.
 *
 * An answered lookup is read the same run and the runs after it
 * (src/stages/routes.mjs, 2026-10-30): its results either give a route (an
 * address on the subject's own site, or for a stage or a show its own form
 * page), which is held as `address_found` or `form_found` and handed to
 * Control Center (`found`, below), or give nothing, which is held as
 * `lookup_found_nothing` and asked again in the next of LOOKUP_WORDINGS
 * wordings, at most once a London day, until the wordings run out. Only a
 * lookup with no status yet is waiting. A found address grants nothing: the
 * pitch it allows is still a proposal for his yes, and the network rule still
 * decides whose box it goes in (Ruling, Krish, 2026-10-28). The query names
 * the show, the stage or the person, never an address or a number the desk
 * would read as a phone. Pure.
 */
export const LOOKUPS_PER_RUN = 12;
/** The wordings a subject's lookup is asked in, one after another, while each answers with nothing. */
export const LOOKUP_WORDINGS = 3;
/** A stand-in address for asking a hold whether the address is all a subject lacks. Never written anywhere. */
const SOME_ADDRESS = '00000000-0000-4000-8000-000000000000';
/** The desk's statuses: anything else, or none, is a lookup still waiting. */
const TERMINAL = new Set(['answered', 'empty', 'failed', 'over_cap']);
/** A run of nine digits or more reads as a phone number to the desk (carriesPrivate in Control Center's api/_growthResearch.ts), and one such query fails the whole batch. */
const PHONE_LIKE = /\+?\d[\d\s().-]{7,}\d/g;
const longDigits = text => (text.match(PHONE_LIKE) ?? []).some(run => (run.match(/\d/g) ?? []).length >= 9);
const noAddress = text => clean(String(text ?? '').replace(/\S*@\S*/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(PHONE_LIKE, run => ((run.match(/\d/g) ?? []).length >= 9 ? ' ' : run)));
const newestFirst = (a, b) => String(b?.answered_at ?? b?.requested_at ?? b?.request_id ?? '').localeCompare(String(a?.answered_at ?? a?.requested_at ?? a?.request_id ?? ''));
/**
 * Where a subject's lookup stands: `found` (an answered lookup's results give
 * a route, with it), `waiting` (one has no answer yet), `exhausted` (every
 * wording answered with nothing), `nothing` (some wordings answered with
 * nothing; `tried` says how many) or `none`. A failed or over-cap attempt is
 * neither tried nor waiting. Pure.
 */
export function lookupState(base, research, { subject = null, lane = null } = {}) {
  const seen = new Set();
  const mine = (Array.isArray(research) ? research : []).filter(r => typeof r?.request_id === 'string' && r.request_id.startsWith(`${base}:`) && !seen.has(r.request_id) && seen.add(r.request_id));
  const tried = mine.filter(r => r.status === 'answered' || r.status === 'empty').length;
  if (subject) for (const r of mine.filter(x => x.status === 'answered').sort(newestFirst)) {
    const route = routeFromEvidence(r.evidence, subject, lane);
    if (route) return { state: 'found', route, request_id: r.request_id, tried };
  }
  if (mine.some(r => !TERMINAL.has(r.status))) return { state: 'waiting', tried };
  return { state: tried >= LOOKUP_WORDINGS ? 'exhausted' : tried ? 'nothing' : 'none', tried };
}
/** The request id for one attempt at a subject's lookup, or null when one waits, has found a route, has run out of wordings, or was asked today. Pure. */
export function lookupId(base, research, at, query = '', state = lookupState(base, research)) {
  if (!['none', 'nothing'].includes(state.state)) return null;
  const day = londonDay(at);
  if ((Array.isArray(research) ? research : []).some(r => typeof r?.request_id === 'string' && r.request_id.startsWith(`${base}:${day}`))) return null;
  return `${base}:${day}:${seal({ query }).slice(0, 8)}`;
}
/** The lookups for subjects held only for want of an address, ranked and capped, and how many truly wait (no answer yet). Pure. */
export function lookupRequests({ stages = [], podcasts = [], guests = [], research = [], at, max = LOOKUPS_PER_RUN }) {
  const ask = [], lanes = [stages, podcasts, guests].map(l => [...l].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)));
  let waiting = 0, today = 0;
  const live = lanes.map(l => l.filter(c => {
    const state = c.state ?? lookupState(c.base, research);
    if (state.state === 'waiting') { waiting++; return false; }
    if (!['none', 'nothing'].includes(state.state)) return false;
    const query = c.query.slice(0, 400), why = c.why.slice(0, 300);
    // A query the desk would refuse is left out on its own, never sent to fail the batch.
    if (!query || !why || longDigits(query) || longDigits(why) || /@/.test(query)) return false;
    const id = lookupId(c.base, research, at, query, state);
    if (!id) { today++; return false; }
    c.request_id = id; return true;
  }));
  for (let i = 0; ask.length < max && live.some(l => i < l.length); i++) for (const l of live) if (i < l.length && ask.length < max) ask.push(l[i]);
  const requests = ask.map(c => ({ request_id: c.request_id, kind: 'search', subject_ref: c.subject_ref, query: c.query.slice(0, 400), why: c.why.slice(0, 300) }));
  return { requests, waiting, asked_today: today, eligible: live.reduce((n, l) => n + l.length, 0) + waiting + today, by: { stages: ask.filter(c => c.lane === 'stage').length, podcasts: ask.filter(c => c.lane === 'podcast').length, guests: ask.filter(c => c.lane === 'guest').length } };
}
/** The subject's own site, as words a search may carry (no address, no link): site:domain, or ''. Pure. */
const siteWords = subject => { const s = ownSites(subject)[0]; return s ? ` site:${s}` : ''; };
const stageSubject = t => ({ name: cleanName(t?.title ?? ''), event_url: t?.event_url ?? null, cfp_url: t?.cfp_url ?? null });
const guestSubject = g => ({ name: guestName(g), website: typeof g?.website === 'string' ? g.website : null });
const podcastLookup = (t, at, W = null, attempt = 0) => {
  const title = noAddress(t.title) || 'this show', host = hostOf(t);
  const query = [
    `Where does the podcast "${title}"${host ? ` hosted by ${host}` : ''} take guest pitches? Give its guest booking page or application form, or the named host or producer who books guests, with the source and its date.`,
    `"${title}" podcast guest booking contact or be a guest page on its own website.${siteWords(stageSubject(t))}`,
    `Contact email for the producer or booking team of the podcast "${title}"${host ? ` with ${host}` : ''}, from the show's own website.`,
  ][Math.min(attempt, LOOKUP_WORDINGS - 1)];
  return { lane: 'podcast', key: t.id, base: `booking:${t.id}`, score: pitchScore(t, at, W), subject_ref: `target:${t.id}`, query: noAddress(query),
    why: noAddress(`Held for want of a booking address: finding it lets Jonny pitch Krish to ${noAddress(t.title) || 'the show'}, still only on his yes.`) };
};
const stageLookup = (t, at, W = null, attempt = 0) => {
  const title = noAddress(t.title) || 'this event', org = noAddress(t.organizer);
  const query = [
    `Who takes speaker submissions for ${title}${org ? `, run by ${org}` : ''}? Give its call-for-speakers page or the named organiser who books speakers, with the source and its date.`,
    `"${title}" speaker application or call for speakers page on its own website.${siteWords(stageSubject(t))}`,
    `Contact email for the organisers of ${title}${org ? ` (${org})` : ''} about speaking, from the event's own website.`,
  ][Math.min(attempt, LOOKUP_WORDINGS - 1)];
  return { lane: 'stage', key: t.id, base: `booking:${t.id}`, score: speakScore(t, at, W), subject_ref: `target:${t.id}`, query: noAddress(query),
    why: noAddress(`Held for want of a booking address: finding it lets Jonny pitch Krish to speak at ${noAddress(t.title) || 'the event'}, still only on his yes.`) };
};
const guestLookup = (g, key, contactId, attempt = 0) => {
  const name = guestName(g), org = noAddress(g.company ?? g.organisation ?? '');
  const query = [
    `How can ${name}${org ? ` of ${org}` : ''} be invited onto a podcast as a guest? Give their public booking page, agent or the route their own site gives for invitations, with the source and its date.`,
    `${name}${org ? ` ${org}` : ''} official website contact or speaking enquiries page.${siteWords(guestSubject(g))}`,
    `${name} speaker bureau, agent or booking contact for podcast interviews.`,
  ][Math.min(attempt, LOOKUP_WORDINGS - 1)];
  return { lane: 'guest', key, base: `email:${contactId ? '' : 'guest:'}${key}`, score: (GUEST_VERDICT[guestVerdictOf(g)] ?? 0) * 1000 + (guestStrength(g) ?? 0), subject_ref: contactId ? `contact:${contactId}` : null,
    query: noAddress(query), why: noAddress(`Held for want of an address: finding one lets ${name ?? 'this guest'} be invited onto Krish's show, still only on his yes.`) };
};
/** The hold an answered lookup leaves: a found route by its kind, nothing found, or the hold the subject had. Pure. */
const LOOKUP_HOLD = { email: 'address_found', form: 'form_found' };
function afterLookup(state, held) {
  if (state.state === 'found') return LOOKUP_HOLD[state.route.kind];
  if (state.state === 'nothing' || state.state === 'exhausted') return 'lookup_found_nothing';
  return held;
}
/** A found route as it goes to Control Center: the subject, the route and the result it was read from. Holds an address: never written to a file or a fixture. Pure. */
const foundRoute = (subject_ref, lane, state) => ({ subject_ref, lane, kind: state.route.kind, ...(state.route.kind === 'email' ? { address: state.route.address, basis: state.route.basis } : { url: state.route.url }), source_url: state.route.source_url, request_id: state.request_id });

export function pitchRows({ context, weekGoals, canon, record = null, files, at, titleMax = TITLE_MAX, caps = PITCH_CAPS, showNotes = false, networkRoutes = false, wins = null, research = context?.research }) {
  const L = lessons(context?.feedback, at);
  const pitched = pitchedStages(context);
  const lanes = { ...LANES_ON, ...(caps.lanes ?? {}) };
  const forms = formRows({ context, weekGoals, canon, record, files, at, titleMax, L, pitched, formsPerRow: caps.forms_per_row, lanes, wins });
  // Jonny's Gmail takes ten drafts a day (Control Center, api/_pitchDrafts.ts). What a wake earlier
  // today already drafted there comes out of this run's room, so a second wake never asks for more.
  const used = jonnyDraftsToday(context, at);
  const lead = { visibility: forms.proposals.filter(p => p.row === 'visibility').length, events: forms.proposals.filter(p => p.row === 'events').length };
  // 1.10.0: a booked show's note asking for the brief link comes before any new pitch, inside the day's room (shownotes.mjs).
  const notes = showNotes ? showNoteRows({ context, canon, files, at, titleMax, room: Math.max(0, Math.min(caps.per_run, (caps.jonny_per_day ?? PITCHES_PER_RUN) - used)), networkRoutes }) : { proposals: [], held: [] };
  for (const n of notes.proposals) n.rank = ++lead[n.row];
  const room = Math.max(0, Math.min(caps.per_run, (caps.jonny_per_day ?? PITCHES_PER_RUN) - used) - notes.proposals.length);
  const held = [], stageHeld = [], pods = [], stages = [], krishPods = [], krishStages = [];
  const lookPods = [], lookStages = [], lookGuests = [];
  // What answered lookups found (src/stages/routes.mjs): the routes for Control Center, and how many answered with nothing.
  const found = [], answered = { addresses: 0, forms: 0, nothing: 0 };
  const tallyLookup = st => { if (st.state === 'found') answered[st.route.kind === 'form' ? 'forms' : 'addresses']++; else if (st.state === 'nothing' || st.state === 'exhausted') answered.nothing++; };
  const seen = new Set();
  // Ruling (Krish, 2026-10-28): nobody in his network is written to from Jonny's box, nor anyone Control Center cannot say about.
  const routes = context?.routes ?? {};
  const listed = networkListed(context);
  const laneOf = (id, booking) => networkLane(id, { routes, listed, served: networkRoutes, booking });
  for (const t of Array.isArray(context?.records?.visibility) ? context.records.visibility : []) {
    if (typeof t?.id !== 'string' || !UUID.test(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    const kind = stageKind(t);
    // A stage of neither kind is not counted as held from one. One whose own form is the route is not pitched as well.
    if (kind === 'podcast') {
      let why = pitchHold(t, { L, pitched, at }) ?? forms.routed.get(t.id) ?? (lanes.visibility ? null : 'lane_off');
      const lane = why ? null : laneOf(t.booking_contact_id, true);
      if (why === 'no_booking_address' && lanes.visibility && !forms.routed.has(t.id) && pitchHold({ ...t, booking_contact_id: SOME_ADDRESS }, { L, pitched, at }) === null) {
        const st = lookupState(`booking:${t.id}`, research, { subject: stageSubject(t), lane: 'podcast' });
        tallyLookup(st);
        if (st.state === 'found') found.push(foundRoute(`target:${t.id}`, 'podcast', st));
        else lookPods.push({ ...podcastLookup(t, at, wins, st.tried), state: st });
        why = afterLookup(st, why);
      }
      if (why) held.push(why);
      else if (lane === 'jonny') pods.push({ t, score: pitchScore(t, at, wins) });
      else { held.push(NETWORK_HOLD[lane]); if (lane === 'krish') krishPods.push({ t, score: pitchScore(t, at, wins) }); }
    } else if (kind === 'stage') {
      let why = speakHold(t, { L, pitched, at }) ?? forms.routed.get(t.id) ?? (lanes.events ? null : 'lane_off');
      const lane = why ? null : laneOf(t.booking_contact_id, true);
      if (why === 'no_booking_address' && lanes.events && !forms.routed.has(t.id) && speakHold({ ...t, booking_contact_id: SOME_ADDRESS }, { L, pitched, at }) === null) {
        const st = lookupState(`booking:${t.id}`, research, { subject: stageSubject(t), lane: 'stage' });
        tallyLookup(st);
        if (st.state === 'found') found.push(foundRoute(`target:${t.id}`, 'stage', st));
        else lookStages.push({ ...stageLookup(t, at, wins, st.tried), state: st });
        why = afterLookup(st, why);
      }
      if (why) stageHeld.push(why);
      else if (lane === 'jonny') stages.push({ t, score: speakScore(t, at, wins) });
      else { stageHeld.push(NETWORK_HOLD[lane]); if (lane === 'krish') krishStages.push({ t, score: speakScore(t, at, wins) }); }
    }
  }
  const byScore = (a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id);
  pods.sort(byScore);
  stages.sort(byScore);
  // Guests he might have on his own shows: up to two a run, before the pitches.
  const invited = invitedGuests(context);
  const guests = Array.isArray(context?.records?.guests) ? context.records.guests : [];
  const people = new Map([...(context?.network ?? []), ...(context?.amplifier_candidates ?? []), ...(context?.quiet_ties ?? [])].filter(c => typeof c?.contact_id === 'string').map(c => [c.contact_id, c]));
  const inviteHeld = [], open = [], seenGuest = new Set();
  for (const g of guests) {
    if (typeof g?.contact_id === 'string' && seenGuest.has(g.contact_id)) continue;
    if (typeof g?.contact_id === 'string') seenGuest.add(g.contact_id);
    let why = inviteHold(g, { L, invited, routes, at }) ?? (lanes.visibility ? null : 'lane_off');
    const lane = why ? null : laneOf(g.contact_id, false);
    if ((why === 'no_email' || why === 'no_contact') && lanes.visibility) {
      // Asked as if the address were on record: a lookup only where the address is all the guest lacks.
      const cid = why === 'no_contact' ? null : g.contact_id;
      const key = cid ?? (typeof g?.id === 'string' && UUID.test(g.id) ? g.id : null);
      const as = cid ?? SOME_ADDRESS;
      if (key && inviteHold({ ...g, contact_id: as }, { L, invited, routes: { ...routes, [as]: { ...(routes[as] ?? {}), email: 'verified' } }, at }) === null) {
        const base = `email:${cid ? '' : 'guest:'}${key}`;
        const st = lookupState(base, research, { subject: guestSubject(g), lane: 'guest' });
        tallyLookup(st);
        if (st.state === 'found') found.push(foundRoute(cid ? `contact:${cid}` : `guest:${key}`, 'guest', st));
        else lookGuests.push({ ...guestLookup(g, key, cid, st.tried), state: st });
        why = afterLookup(st, why);
      }
    }
    if (why) inviteHeld.push(why);
    else if (lane === 'unknown') inviteHeld.push(NETWORK_HOLD.unknown);
    else { const standard = guestVerdictOf(g); open.push({ g, standard, lane, score: GUEST_VERDICT[standard] ?? 0 }); }
  }
  // Take before stretch, then the stronger guest on the three axes, then the contact id (Ruling, Krish, 2026-10-28).
  open.sort((a, b) => b.score - a.score || guestStrength(b.g) - guestStrength(a.g) || a.g.contact_id.localeCompare(b.g.contact_id));
  // The week's invites are one pick whoever writes them; only Jonny's take room in his box. A shorter pick is a prefix of a longer one.
  const picked = pickInvites(open, invitesThisWeek(context, guests, at), caps.invites_per_run, weeklyInvites(caps.invites_per_week, caps.show_shares));
  const invites = [], krishInvites = [], jonnyRoom = Math.min(caps.invites_per_run, room);
  for (const o of picked) {
    if (o.lane === 'krish') { krishInvites.push(o); inviteHeld.push(NETWORK_HOLD.krish); }
    else if (invites.length < jonnyRoom) invites.push(o);
  }
  if (open.length > invites.length + krishInvites.length) inviteHeld.push(...Array(open.length - invites.length - krishInvites.length).fill('invite_week_or_run_cap'));
  const take = shares(pods.length, stages.length, room - invites.length, caps.stage_share);
  const usedFiles = [...files, ...(record?.file ? [record.file] : [])].slice(0, 8);
  const serves = servesOf('visibility', weekGoals);
  const inviteProposals = invites.map(({ g, standard }, i) => {
    const name = guestName(g);
    const show = inviteShow(g.invite_show, canon);
    const weekly = INVITE_SHOWS[g.invite_show].weekly;
    const topic = guestTopic(g);
    const words = inviteWords({ name, show, page: evidencePages(g)[0] ?? null });
    const card = inviteCard({ g, name, show, topic, canon, contact: people.get(g.contact_id) ?? null, serves, weekly });
    const because = `A ${standard === 'take' ? 'strong ' : ''}guest for ${show.name}. Jonny invites them.`;
    const action = { version: 2, channel: 'email', recipient_contact_id: g.contact_id, subject: words.subject, body: words.body, form: null, mailbox: 'jonny' };
    return {
      proposal_id: `gmp-${seal({ subject: `contact:${g.contact_id}`, ask: 'invite' }).slice(0, 32)}`,
      title: fitTitleWithin(titleMax, `Jonny invites ${name} onto ${show.name}`, `Jonny invites ${firstName(name)} onto ${show.name}`, `Jonny invites a guest onto ${show.name}`),
      why: clean(`${name} is a guest the guest standard judged ${standard === 'take' ? 'worth having' : 'a stretch'} for ${show.name}, with an address on record. One ask: a conversation on the show.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: OBJECTIVE,
      exact_payload: JSON.stringify(action), target: g.contact_id, subject_ref: `contact:${g.contact_id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: 'visibility:invite' },
      expires_at: new Date(Date.parse(at) + 14 * DAY).toISOString(), stage: null, parent_proposal_id: null,
      row: 'visibility', rank: lead.visibility + i + 1,
      reach: { value: null, band: 'unknown', basis: "a guest's audience not yet measured", source_url: null, as_of: null },
      amplifier_kind: null, features: { sector: null, topic, seniority: null }, serves, source_revision: files.slice(0, 8),
      ...(because.length <= BECAUSE_MAX ? { because } : {}),
      brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: Jonny invites ${firstName(name)} onto ${show.name}, from his own Gmail.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
      card,
    };
  });
  const podcastProposals = pods.slice(0, take.podcasts).map(({ t }, i) => {
    const show = cleanName(t.title);
    const host = hostOf(t);
    const topic = showTopic(t);
    const words = pitchWords({ show, host, topic, canon, record: record?.line ?? null });
    const card = pitchCard({ t, show, host, topic, canon, serves, at });
    const eps = Number.isInteger(t.episodes) && t.episodes > 0 ? t.episodes : null;
    const latest = monthYear(t.latest_episode_at);
    const because = [`A podcast${eps ? ` with ${eps} episodes` : ''}${latest ? `, latest ${latest}` : ''}.`, 'Jonny pitches you.'].join(' ');
    const action = { version: 2, channel: 'email', recipient_contact_id: t.booking_contact_id, subject: words.subject, body: words.body, form: null, mailbox: 'jonny' };
    return {
      proposal_id: `gmp-${seal({ subject: `target:${t.id}`, ask: 'pitch' }).slice(0, 32)}`,
      title: fitTitleWithin(titleMax, `Jonny pitches you to ${show}`, 'Jonny pitches you to a podcast'),
      why: clean(`${show} is a podcast${eps ? ` with ${eps} episodes` : ''} taking guests, with an address of its own. ${standardSays(t, at)} One ask: have Krish on.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: OBJECTIVE,
      exact_payload: JSON.stringify(action), target: t.booking_contact_id, subject_ref: `target:${t.id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: 'visibility:pitch' },
      expires_at: new Date(Date.parse(at) + 14 * DAY).toISOString(), stage: null, parent_proposal_id: null,
      row: 'visibility', rank: lead.visibility + inviteProposals.length + i + 1,
      reach: reachOf(t, 'people in its audience, as Nova read it', 'a podcast audience not yet measured'),
      amplifier_kind: 'broadcaster', features: { sector: null, topic, seniority: null }, serves, source_revision: usedFiles,
      ...(because.length <= BECAUSE_MAX ? { because } : {}),
      brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: Jonny asks ${show} to have you on as a guest, from his own Gmail.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
      card,
    };
  });
  const speakServes = servesOf('events', weekGoals);
  const stageProposals = stages.slice(0, take.stages).map(({ t }, i) => {
    const event = cleanName(t.title);
    const host = hostOf(t);
    const topic = showTopic(t);
    const ask = speakingAsk(t);
    const talk = talkTitle(t, topic);
    const words = speakWords({ event, host, ask, talk, canon, record: record?.line ?? null });
    const card = speakCard({ t, event, ask, talk, topic, canon, serves: speakServes });
    const closes = dayMonth(t.deadline_at);
    const when = monthYear(t.event_start_at);
    const because = [`${ask === 'a panel seat' ? 'A panel' : 'A stage'}${when ? ` in ${when}` : ''}${closes ? `, call closes ${closes}` : ''}.`, 'Jonny pitches you.'].join(' ');
    const action = { version: 2, channel: 'email', recipient_contact_id: t.booking_contact_id, subject: words.subject, body: words.body, form: null, mailbox: 'jonny' };
    return {
      proposal_id: `gmp-${seal({ subject: `target:${t.id}`, ask: 'speak' }).slice(0, 32)}`,
      title: fitTitleWithin(titleMax, `Jonny pitches you to speak at ${event}`, `Jonny pitches you to ${event}`, 'Jonny pitches you to speak at an event'),
      why: clean(`${event} is open for speakers, and its own page gives an address for them. ${standardSays(t, at)} One ask: ${ask} for Krish.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: OBJECTIVE,
      exact_payload: JSON.stringify(action), target: t.booking_contact_id, subject_ref: `target:${t.id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: 'events:pitch' },
      expires_at: new Date(Math.min(Date.parse(at) + 14 * DAY, Number.isFinite(Date.parse(t.deadline_at ?? '')) ? Date.parse(t.deadline_at) : Infinity)).toISOString(), stage: null, parent_proposal_id: null,
      row: 'events', rank: lead.events + i + 1,
      reach: reachOf(t, 'people in its room, as Nova read it', "an event's room not yet measured"),
      amplifier_kind: 'ceo_educator', features: { sector: null, topic, seniority: null }, serves: speakServes, source_revision: usedFiles,
      ...(because.length <= BECAUSE_MAX ? { because } : {}),
      brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: Jonny asks ${event} for ${ask} for you, from his own Gmail.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
      card,
    };
  });
  const krishRows = [
    ...krishInvites.map(({ g, standard }) => krishInviteRow({ g, standard, canon, contact: people.get(g.contact_id) ?? null, routes, serves, files, at, titleMax })),
    ...krishPods.map(({ t }) => krishPitchRow({ t, kind: 'podcast', canon, contact: people.get(t.booking_contact_id) ?? null, routes, serves, files: usedFiles, at, titleMax })),
    ...krishStages.map(({ t }) => krishPitchRow({ t, kind: 'stage', canon, contact: people.get(t.booking_contact_id) ?? null, routes, serves: speakServes, files: usedFiles, at, titleMax })),
  ];
  if (pods.length > take.podcasts) held.push(...Array(pods.length - take.podcasts).fill('pitch_per_run_cap'));
  if (stages.length > take.stages) stageHeld.push(...Array(stages.length - take.stages).fill('pitch_per_run_cap'));
  // Forms first: a report keeps at most forty, and a pitch left out waits for the next run.
  // His own rows for those in his network go with the rows he presses himself (rows.mjs rankRows), never in Jonny's ten.
  return { proposals: [...forms.proposals, ...notes.proposals, ...inviteProposals, ...podcastProposals, ...stageProposals], krishRows, held, stageHeld, inviteHeld, formHeld: forms.held, notesHeld: notes.held, jonny: { used, room },
    lookups: { ...lookupRequests({ stages: lookStages, podcasts: lookPods, guests: lookGuests, research, at, max: LOOKUPS_PER_RUN }), answered }, found };
}

/** The route weight his own row would draft on: an address on record, else one Control Center has not checked. */
const emailWeight = (routes, id) => routes?.[id]?.email === 'verified' ? channelOf({ email: 'verified' }, 'visibility').weight : channelOf({ email: 'unchecked' }, 'visibility').weight;

/**
 * A guest invite to someone in his network, as one of his own rows (rows.mjs
 * rowProposal): the visibility row, a version 2 email action with no mailbox,
 * so his Draft press drafts it into his own box, in his own words, signed
 * Krish, from the same facts Jonny's invite would have used. Pure.
 */
export function krishInviteRow({ g, standard, canon, contact, routes, serves, files, at, titleMax = TITLE_MAX }) {
  const name = guestName(g), f = firstName(name);
  const show = inviteShow(g.invite_show, canon);
  const topic = guestTopic(g);
  const card = inviteCard({ g, name, show, topic, canon, contact, serves, weekly: INVITE_SHOWS[g.invite_show].weekly, by: 'krish' });
  const reach = { value: null, band: 'unknown', basis: "a guest's audience not yet measured", source_url: null, as_of: null };
  const because = `In your network. You invite them onto ${show.name}.`;
  return { score: score(reach, standard === 'take' ? 1 : 0.8, emailWeight(routes, g.contact_id), serves, true), proposal: rowProposal({
    row: 'visibility', ask: 'invite', contactId: g.contact_id, name, at, files,
    title: fitTitleWithin(titleMax, `Invite ${name} onto ${show.name}`, `Invite ${f} onto ${show.name}`, `Invite a guest onto ${show.name}`),
    why: `${name} is in your own network, so you invite them yourself, not Jonny. The guest standard judged them ${standard === 'take' ? 'worth having' : 'a stretch'} for ${show.name}. One ask: a conversation on the show.`,
    because: because.length <= BECAUSE_MAX ? because : `In your network. You invite them.`,
    brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: you invite ${f} onto ${show.name}, from your own Gmail.`],
    card, action: actionFor('email', g.contact_id, name, krishInviteWords({ show, page: evidencePages(g)[0] ?? null })),
    reach, kind: null, features: { sector: null, topic, seniority: null }, serves, evidence: [],
  }) };
}

/**
 * A podcast or a stage pitch whose booking contact is in his network, as one
 * of his own rows: visibility for a podcast, events for a stage, a version 2
 * email action with no mailbox, in his own words and signed Krish, about the
 * show or stage it names (target:<id>), so it is never pitched twice. Pure.
 */
export function krishPitchRow({ t, kind, canon, contact, routes, serves, files, at, titleMax = TITLE_MAX }) {
  const name = cleanName(t.title), host = hostOf(t), topic = showTopic(t);
  const to = t.booking_contact_id, greet = cleanName(contact?.contacts?.full_name ?? '') || host || '';
  const podcast = kind === 'podcast';
  const ask = podcast ? null : speakingAsk(t), talk = podcast ? null : talkTitle(t, topic);
  const known = (contact ? knownWords(contact) : '') || (podcast ? "The show's booking contact is in your own network, so you write to them yourself." : "The event's speaker contact is in your own network, so you write to them yourself.");
  const card = podcast ? pitchCard({ t, show: name, host, topic, canon, serves, at, known }) : speakCard({ t, event: name, ask, talk, topic, canon, serves, known });
  const words = podcast ? krishPitchWords({ show: name, topic, canon }) : krishSpeakWords({ event: name, ask, talk, canon });
  const reach = podcast ? reachOf(t, 'people in its audience, as Nova read it', 'a podcast audience not yet measured') : reachOf(t, 'people in its room, as Nova read it', "an event's room not yet measured");
  const row = podcast ? 'visibility' : 'events';
  const because = podcast ? 'Someone in your network books this show.' : 'Someone in your network books its speakers.';
  const p = rowProposal({
    row, ask: 'pitch', contactId: to, name: greet || name, at, files,
    title: podcast ? fitTitleWithin(titleMax, `Ask to go on ${name}`, 'Ask to go on a podcast') : fitTitleWithin(titleMax, `Ask to speak at ${name}`, 'Ask to speak at an event'),
    why: `${name} ${podcast ? 'takes guests' : 'is open for speakers'}, and the person who books it is in your own network, so you ask yourself, not Jonny. ${standardSays(t, at)} One ask: ${podcast ? 'have you on' : `${ask} for you`}.`,
    because, card,
    brief: [card.who, card.known, ...card.why.slice(0, 2), podcast ? `The ask: you ask ${name} to have you on as a guest, from your own Gmail.` : `The ask: you ask ${name} for ${ask}, from your own Gmail.`],
    action: actionFor('email', to, greet || 'there', words),
    reach, kind: podcast ? 'broadcaster' : 'ceo_educator', features: { sector: null, topic, seniority: null }, serves, evidence: [],
  });
  // One booker may book two shows: the row is keyed by the show, never by the person alone.
  return { score: score(reach, standardWeight(t, at) / 3, emailWeight(routes, to), serves, true), proposal: { ...p, proposal_id: `gmw-${seal({ subject: `target:${t.id}`, row, ask: 'pitch' }).slice(0, 32)}`, subject_ref: `target:${t.id}` } };
}

// ── The caps a run reads (plan Phase 2, N04) ───────────────────────────────
//
// Today's values, which the default week spec reproduces exactly. A signed
// spec compiles into the same shape (src/crew/compile.mjs), inside the
// bounds config/policy.json owns.

/** Both pitch rows on: a lane the week spec turns off writes nothing there. */
export const LANES_ON = Object.freeze({ visibility: true, events: true });
/** The pitch caps of today's behaviour. jonny_per_day is Control Center's ten drafts a day in Jonny's Gmail. */
export const PITCH_CAPS = Object.freeze({ per_run: PITCHES_PER_RUN, stage_share: STAGE_SHARE, invites_per_run: INVITES_PER_RUN, invites_per_week: INVITES_A_WEEK, show_shares: SHOW_SHARES, forms_per_row: FORMS_PER_ROW, jonny_per_day: PITCHES_PER_RUN, lanes: LANES_ON });

const londonDay = at => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
/**
 * Drafts already made in Jonny's Gmail on this London day, as the context's
 * drafts say (each with its mailbox and created_at): pitches, invites and,
 * later, show-notes notes. One with no readable time is not counted, since
 * its day is unknown; Control Center's own cap still holds it. Pure.
 */
export function jonnyDraftsToday(context, at) {
  const today = londonDay(at), now = Date.parse(at);
  let n = 0;
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) {
    const t = Date.parse(d?.created_at ?? '');
    if (d?.mailbox === 'jonny' && Number.isFinite(t) && t <= now && londonDay(t) === today) n++;
  }
  return n;
}

// ── Mindmake's outreach angle and the People briefs (plan section 12, M9) ──
//
// Moved out of Control Center (Ruling, Krish, 2026-10-27). Ported from:
//   api/_peopleDraft.ts subjectPart and subjectFor: the subject is set by code,
//     never by a model, a plain invitation and never a teaser (Ruling, Krish,
//     2026-10-21), one line cut at a word.
//   api/_peopleDraft.ts forGuest, forTarget and forRoom: which approach may be
//     drafted at all (a guest still proposed for a show of his; a stage that
//     cleared the standard, take or stretch; a room not archived, to someone
//     in the network with a name), and the rules each brief hands its model.
//   api/_venturePositioning.ts, the Mindmake entry: not ported. Its offer is
//     out of date against the canon: offerFindings in canon.mjs finds a
//     retired offer, a duration promise and the offer named otherwise. The
//     engine's angle is the canon's own ask, read live.
// What stays in Control Center: the model call that writes a People draft,
// the Gmail draft in the right box, people_drafts and its record of each.

/** api/_peopleDraft.ts subjectPart: one line, no doubled spaces, cut at a word past the twentieth character, trailing punctuation off. Pure. */
export function ccSubjectPart(v, max = 60) {
  const one = String(v || '').replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : max).replace(/[\s,;:.-]+$/, '');
}

/** api/_peopleDraft.ts subjectFor: the subject Control Center sets for a guest invite, a stage pitch or a room note. Pure. */
export function ccSubjectFor(job, facts = {}) {
  if (job === 'guests') return `Podcast invitation: ${ccSubjectPart(facts.show) || 'a conversation'} with Krish Raja`;
  if (job === 'booked') {
    const stage = ccSubjectPart(facts.stage);
    const idea = facts.stageType === 'podcast' ? 'Guest idea' : 'Speaker idea';
    return stage ? `${idea} for ${stage}: Krish Raja` : `${idea}: Krish Raja`;
  }
  const event = ccSubjectPart(facts.event);
  return event ? `Are you going to ${event}?` : 'Are you going?';
}

/** api/_peopleDraft.ts forGuest's gate: a guest still proposed, for one of his two shows. Pure. */
export const ccGuestGate = g => g?.invite_state === 'proposed' && g.invite_show in INVITE_SHOWS;
/** api/_peopleDraft.ts forTarget's gate: only a stage Control Center's stored verdict took or stretched for. For the shadow line only. Pure. */
export const ccTargetGate = t => ['take', 'stretch'].includes(ccStageVerdict(t));
/** api/_peopleDraft.ts forRoom's gate: a room not archived, to someone in the network with a name. Pure. */
export const ccRoomGate = (e, person) => Boolean(e && !e.archived_at && typeof person?.full_name === 'string' && person.full_name.trim());

/** The rules each People brief hands its model (api/_peopleDraft.ts), by job; the path a guest is reached on changes the guest's. */
export function briefRules(job, { path = null } = {}) {
  if (job === 'guests') return path === 'rich'
    ? 'Krish has not met them. Write only from the evidence above, never pretend familiarity, and ask for one short conversation.'
    : 'A warm, specific invitation for one recorded conversation. Do not pitch anything else.';
  if (job === 'booked') return 'A short, specific pitch for one slot. No attachments, no promises, nothing invented about the show or its audience.';
  return 'Two or three warm sentences between people who know each other. No pitch.';
}

/**
 * The People briefs in shadow. For every stage and guest the context serves,
 * whether Control Center's gate would let it be drafted, beside whether the
 * engine's own pitch or invite stage would write it on its standard alone
 * (its lessons and what was already pitched left aside, so only the two
 * standards are compared), and, where both would, whether the subjects are
 * the same words. Counts and codes only. Nothing is held, hidden or
 * changed. Pure.
 */
export function briefsShadow({ context, canon = null, at }) {
  const none = new Set(), L = lessons([], at), routes = context?.routes ?? {};
  const differ = {}, apart = {}, verdicts = [], seen = new Set();
  let agree = 0, both = 0, same = 0, read = 0;
  const bumpIn = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
  for (const t of Array.isArray(context?.records?.visibility) ? context.records.visibility : []) {
    if (typeof t?.id !== 'string' || seen.has(`t:${t.id}`)) continue;
    seen.add(`t:${t.id}`); read++;
    const kind = stageKind(t);
    const theirs = ccTargetGate(t);
    let code = null;
    if (!kind) { code = 'not_a_pitch_kind'; bumpIn(apart, code); verdicts.push({ subject_ref: `target:${t.id}`, code, agrees: null }); continue; }
    const hold = kind === 'podcast' ? pitchHold(t, { L, pitched: none, at }) : speakHold(t, { L, pitched: none, at });
    const mine = hold === null;
    if (mine === theirs) agree++;
    else { code = mine ? 'engine_pitches_unjudged' : `engine_${hold}`; bumpIn(differ, code); }
    if (mine && theirs && canon?.publication) {
      both++;
      const show = cleanName(t.title), topic = showTopic(t);
      const ours = kind === 'podcast' ? pitchWords({ show, host: null, topic, canon }).subject : speakWords({ event: show, host: null, ask: speakingAsk(t), talk: talkTitle(t, topic), canon }).subject;
      if (ours === ccSubjectFor('booked', { stage: t.title, stageType: t.type })) same++;
    }
    verdicts.push({ subject_ref: `target:${t.id}`, engine: mine, control_center: theirs, agrees: code === null, code });
  }
  for (const g of Array.isArray(context?.records?.guests) ? context.records.guests : []) {
    const key = typeof g?.contact_id === 'string' ? `contact:${g.contact_id}` : typeof g?.id === 'string' ? `guest:${g.id}` : null;
    if (!key || seen.has(key)) continue;
    seen.add(key); read++;
    const theirs = ccGuestGate(g);
    const hold = inviteHold(g, { L, invited: none, routes, at });
    const mine = hold === null;
    let code = null;
    if (mine === theirs) agree++;
    else { code = mine ? 'engine_invites_unproposed' : `engine_${hold}`; bumpIn(differ, code); }
    if (mine && theirs && canon?.publication) {
      both++;
      const show = inviteShow(g.invite_show, canon);
      if (inviteWords({ name: guestName(g), show, page: null }).subject === ccSubjectFor('guests', { show: show.name })) same++;
    }
    verdicts.push({ subject_ref: key, engine: mine, control_center: theirs, agrees: code === null, code });
  }
  const tail = canon?.publication ? ` Subjects: ${both} both would write, ${same} in the same words.` : ' Subjects: the canon was not read this run, so none were compared.';
  return { verdicts, line: shadowLine('Outreach briefs', ['stage or guest', 'stages and guests'], { read, agree, differ, apart }) + tail, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
