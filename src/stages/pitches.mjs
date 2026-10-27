import { seal, clean, DAY } from '../guards.mjs';
import { lessons, refusedBy, firstName, givenParts, cleanName, monthYear, servesOf, leadFacts, fitTitleWithin, cutClean, knownWords, bandOf, KRISH_TITLE, OWN_SHOW, TOPICS, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, CARD_LINES, CARD_ANGLE_TITLE_MAX, CARD_SOURCES, BECAUSE_MAX, BRIEF_LINE_MAX, TITLE_MAX } from './rows.mjs';

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
 * visibility; Make Your Mind Up takes a weekly conversation). A guest
 * Control Center's guest standard judged worth having, with an address on
 * record, gets one invite from Jonny, to the show it was judged for. The
 * week's invites follow the shows' shares (Make Your Mind Up 70, Signal &
 * Noise 30: Ruling, Krish, 2026-10-20), at most two a run, taken first from
 * the run's ten.
 *
 * Pure: everything comes from the context, the directive and the files read
 * this run. No model call. No address, ever.
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
/** How Nova's standard ranks a stage: worth taking, a stretch, or not yet judged. */
const VERDICT_WEIGHT = { take: 3, stretch: 2 };
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

/** How a show ranks: Nova's verdict, how recently it published, whether it is about a room his buyer is in, and how long it has run. Pure. */
export function pitchScore(t, at) {
  const days = sinceLatest(t, at);
  const recent = days === null ? 0 : days <= 30 ? 1 : days <= 60 ? 0.85 : 0.7;
  const topic = showTopic(t);
  const fit = topic && BUYER_TOPICS.has(topic) ? 1 : 0.7;
  const eps = Number.isInteger(t?.episodes) && t.episodes > 0 ? t.episodes : 0;
  return (VERDICT_WEIGHT[t?.verdict] ?? 1) * recent * fit * Math.log10(eps + 10);
}

/** Why a stage is not pitched today, or null when it may be. Pure. */
export function pitchHold(t, { L, pitched, at }) {
  if (t?.type !== 'podcast') return 'not_a_podcast';
  if (!t.booking_contact_id || !UUID.test(t.booking_contact_id)) return 'no_booking_address';
  if (t.buried_at) return 'buried';
  if (t.verdict === 'rejected') return 'rejected';
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
  if (t.verdict === 'rejected') return 'rejected';
  if (t.status === 'applied' || t.applied_at) return 'applied';
  if (!['sourced', 'queued'].includes(t.status)) return 'not_open';
  if ([t.title, t.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) return 'own_show';
  const now = Date.parse(at);
  if (Number.isFinite(Date.parse(t.deadline_at ?? '')) && Date.parse(t.deadline_at) < now) return 'deadline_passed';
  if (Number.isFinite(Date.parse(t.event_start_at ?? '')) && Date.parse(t.event_start_at) < now) return 'event_passed';
  if (pitched.has(t.id)) return 'already_pitched';
  return refusedBy(L, { subject: `target:${t.id}`, row: 'events', kind: 'ceo_educator', sector: null, topic: showTopic(t), band: 'unknown' }, at);
}

/** How a stage ranks: Nova's verdict, its three scores when judged, how soon its call closes while still open, and whether his buyer is in the room. Pure. */
export function speakScore(t, at) {
  const scores = [t?.room_score, t?.standing_score, t?.only_him_score];
  const judged = scores.every(x => Number.isFinite(x)) ? Math.max(0.1, Math.min(...scores) / 100) : 0.6;
  const days = Number.isFinite(Date.parse(t?.deadline_at ?? '')) ? (Date.parse(t.deadline_at) - Date.parse(at)) / DAY : null;
  const soon = days === null ? 1 : days <= 14 ? 1.3 : days <= 30 ? 1.15 : 1;
  const topic = showTopic(t);
  const fit = topic && BUYER_TOPICS.has(topic) ? 1 : 0.7;
  return (VERDICT_WEIGHT[t?.verdict] ?? 1) * judged * soon * fit;
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
export function speakCard({ t, event, ask, talk, topic, canon, serves }) {
  const org = t.organizer && cleanName(t.organizer) !== event ? cleanName(t.organizer) : '';
  const when = monthYear(t.event_start_at);
  const where = typeof t.location === 'string' && t.location.trim() ? cleanName(t.location) : '';
  const room = typeof t.audience === 'string' && t.audience.trim() ? t.audience.trim().replace(/[.!?]+$/, '') : typeof t.who_is_in_the_room === 'string' && t.who_is_in_the_room.trim() ? leadFacts(t.who_is_in_the_room, 160).replace(/[.!?]+$/, '') : '';
  const kind = SPEAKING_FORMAT.exec(`${t.title ?? ''} ${t.format ?? ''}`)?.[0]?.toLowerCase().replace(/s$/, '') ?? (t.type === 'cfp' ? 'call for speakers' : 'event');
  const who = within([`${event} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}${org ? ` run by ${org}` : ''}${when ? `, in ${when}` : ''}${where ? `, ${where}` : ''}.`, room ? leadFacts(`Its room: ${room}.`, 200) : ''].filter(Boolean).join(' '), CARD_WHO_MAX) || `${event} is an event.`;
  const known = "You do not know them yet. The event's own page gives this address for speakers, and Jonny writes first.";
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
export function pitchCard({ t, show, host, topic, canon, serves, at }) {
  const eps = Number.isInteger(t.episodes) && t.episodes > 0 ? t.episodes : null;
  const by = host ? `, hosted by ${host}` : t.organizer && cleanName(t.organizer) !== show ? `, published by ${cleanName(t.organizer)}` : '';
  const audience = typeof t.audience === 'string' && t.audience.trim() ? leadFacts(`Its audience: ${t.audience.trim().replace(/[.!?]+$/, '')}.`, 200) : '';
  const who = within([`${show} is a podcast${eps ? ` with ${eps} episodes` : ''}${by}.`, audience].filter(Boolean).join(' '), CARD_WHO_MAX) || `${show} is a podcast.`;
  const known = 'You do not know them yet. The show publishes this address in its own feed, and Jonny writes first.';
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
/** The guest standard's verdicts that may be invited (Control Center, api/_guestStandard.ts): worth taking, or a stretch. */
const GUEST_VERDICT = { take: 2, stretch: 1 };
const OPEN_GUEST = new Set(['scouted', 'enriched']);
const KRISH = /\bkrish\s+raja\b/i;

/** Each show's invites this week, by its share of INVITES_A_WEEK, the larger share rounded up. Pure. */
export function weeklyInvites(total = INVITES_A_WEEK) {
  const mymu = Math.ceil(total * INVITE_SHOWS.makeyourmindup.share / 100);
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
  if (g.recorded_at || g.published_at) return 'recorded';
  if (!OPEN_GUEST.has(g.status)) return 'not_open';
  if (g.invite_state && g.invite_state !== 'proposed') return 'already_invited';
  if (g.guest_verdict === 'rejected') return 'guest_rejected';
  if (!(g.guest_verdict in GUEST_VERDICT)) return 'guest_not_judged';
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
    ? { name: canon.publication.name, who: `who writes ${canon.publication.name} (${canon.publication.url})`, ask: 'for one of its weekly conversations' }
    : { name: 'Signal & Noise', who: KRISH_TITLE, ask: 'on the show for a conversation' };
}

/** The invite in Jonny's words: one point, one ask, Krish in the third person, signed Jonny. Pure. */
export function inviteWords({ name, show, page }) {
  // A page's own title, a few words long, never a bare word or an address.
  const label = page ? clean(page.label).replace(/[.!?]+$/, '') : '';
  const seen = label && label.length <= 100 && /\S\s+\S/.test(label) && !/https?:|www\.|@/i.test(label) ? `We came across "${label}", and it is exactly the kind of thinking we'd love to hear more of.` : '';
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

/** The full card for an invite: who the guest is, how Krish knows them, why them, what he gets, the angles. */
export function inviteCard({ g, name, show, topic, canon, contact, serves, weekly }) {
  const who = within(`${name}${g.one_liner ? `: ${leadFacts(g.one_liner, CARD_WHO_MAX - name.length - 2).replace(/[.!?]+$/, '')}` : ''}.`, CARD_WHO_MAX) || `${name}.`;
  const known = (contact ? knownWords(contact) : '') || 'You do not know them yet. Jonny writes first, from his own Gmail.';
  const pages = evidencePages(g);
  const why = [leadFacts(g.why_fit, CARD_LINE_MAX), pages[0] ? within(`Seen online: ${clean(pages[0].label)}.`) : '', g.guest_verdict === 'take' ? `The guest standard judged them worth having on ${show.name}.` : `The guest standard judged them a stretch for ${show.name}, worth asking.`]
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
export function pickInvites(open, done, perRun = INVITES_PER_RUN) {
  const quota = weeklyInvites();
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
  return picked;
}

/** How many of each kind a run writes: stages up to their share, podcasts the rest, and a share one kind cannot fill goes to the other. Pure. */
export function shares(podcasts, stages, total = PITCHES_PER_RUN) {
  const p = Math.min(podcasts, total - Math.min(stages, STAGE_SHARE));
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

/**
 * Today's pitches, best first, at most PITCHES_PER_RUN between them, each a
 * 1.9.0 row proposal for Jonny's box: podcasts on the visibility row, stages
 * to speak on on the events row; and why every other stage was left out.
 * Ranks start at 1 within each row.
 */
export function pitchRows({ context, weekGoals, canon, record = null, files, at, titleMax = TITLE_MAX }) {
  const L = lessons(context?.feedback, at);
  const pitched = pitchedStages(context);
  const held = [], stageHeld = [], pods = [], stages = [];
  const seen = new Set();
  for (const t of Array.isArray(context?.records?.visibility) ? context.records.visibility : []) {
    if (typeof t?.id !== 'string' || !UUID.test(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    const kind = stageKind(t);
    // A stage of neither kind is not counted as held from one.
    if (kind === 'podcast') {
      const why = pitchHold(t, { L, pitched, at });
      if (why) held.push(why); else pods.push({ t, score: pitchScore(t, at) });
    } else if (kind === 'stage') {
      const why = speakHold(t, { L, pitched, at });
      if (why) stageHeld.push(why); else stages.push({ t, score: speakScore(t, at) });
    }
  }
  const byScore = (a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id);
  pods.sort(byScore);
  stages.sort(byScore);
  // Guests he might have on his own shows: up to two a run, before the pitches.
  const routes = context?.routes ?? {};
  const invited = invitedGuests(context);
  const guests = Array.isArray(context?.records?.guests) ? context.records.guests : [];
  const people = new Map([...(context?.network ?? []), ...(context?.amplifier_candidates ?? []), ...(context?.quiet_ties ?? [])].filter(c => typeof c?.contact_id === 'string').map(c => [c.contact_id, c]));
  const inviteHeld = [], open = [], seenGuest = new Set();
  for (const g of guests) {
    if (typeof g?.contact_id === 'string' && seenGuest.has(g.contact_id)) continue;
    if (typeof g?.contact_id === 'string') seenGuest.add(g.contact_id);
    const why = inviteHold(g, { L, invited, routes, at });
    if (why) inviteHeld.push(why); else open.push({ g, score: GUEST_VERDICT[g.guest_verdict] ?? 0 });
  }
  open.sort((a, b) => b.score - a.score || a.g.contact_id.localeCompare(b.g.contact_id));
  const invites = pickInvites(open, invitesThisWeek(context, guests, at));
  if (open.length > invites.length) inviteHeld.push(...Array(open.length - invites.length).fill('invite_week_or_run_cap'));
  const take = shares(pods.length, stages.length, PITCHES_PER_RUN - invites.length);
  const usedFiles = [...files, ...(record?.file ? [record.file] : [])].slice(0, 8);
  const serves = servesOf('visibility', weekGoals);
  const inviteProposals = invites.map(({ g }, i) => {
    const name = guestName(g);
    const show = inviteShow(g.invite_show, canon);
    const weekly = INVITE_SHOWS[g.invite_show].weekly;
    const topic = guestTopic(g);
    const words = inviteWords({ name, show, page: evidencePages(g)[0] ?? null });
    const card = inviteCard({ g, name, show, topic, canon, contact: people.get(g.contact_id) ?? null, serves, weekly });
    const because = `A ${g.guest_verdict === 'take' ? 'strong ' : ''}guest for ${show.name}. Jonny invites them.`;
    const action = { version: 2, channel: 'email', recipient_contact_id: g.contact_id, subject: words.subject, body: words.body, form: null, mailbox: 'jonny' };
    return {
      proposal_id: `gmp-${seal({ subject: `contact:${g.contact_id}`, ask: 'invite' }).slice(0, 32)}`,
      title: fitTitleWithin(titleMax, `Jonny invites ${name} onto ${show.name}`, `Jonny invites ${firstName(name)} onto ${show.name}`, `Jonny invites a guest onto ${show.name}`),
      why: clean(`${name} is a guest the guest standard judged ${g.guest_verdict === 'take' ? 'worth having' : 'a stretch'} for ${show.name}, with an address on record. One ask: a conversation on the show.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: 'qualified_conversations',
      exact_payload: JSON.stringify(action), target: g.contact_id, subject_ref: `contact:${g.contact_id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: 'visibility:invite' },
      expires_at: new Date(Date.parse(at) + 14 * DAY).toISOString(), stage: null, parent_proposal_id: null,
      row: 'visibility', rank: i + 1,
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
      why: clean(`${show} is a podcast${eps ? ` with ${eps} episodes` : ''} taking guests, with an address of its own. Nova's verdict: ${t.verdict ?? 'not yet judged'}. One ask: have Krish on.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: 'qualified_conversations',
      exact_payload: JSON.stringify(action), target: t.booking_contact_id, subject_ref: `target:${t.id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: 'visibility:pitch' },
      expires_at: new Date(Date.parse(at) + 14 * DAY).toISOString(), stage: null, parent_proposal_id: null,
      row: 'visibility', rank: inviteProposals.length + i + 1,
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
      why: clean(`${event} is open for speakers, and its own page gives an address for them. Nova's verdict: ${t.verdict ?? 'not yet judged'}. One ask: ${ask} for Krish.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: 'qualified_conversations',
      exact_payload: JSON.stringify(action), target: t.booking_contact_id, subject_ref: `target:${t.id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: 'events:pitch' },
      expires_at: new Date(Math.min(Date.parse(at) + 14 * DAY, Number.isFinite(Date.parse(t.deadline_at ?? '')) ? Date.parse(t.deadline_at) : Infinity)).toISOString(), stage: null, parent_proposal_id: null,
      row: 'events', rank: i + 1,
      reach: reachOf(t, 'people in its room, as Nova read it', "an event's room not yet measured"),
      amplifier_kind: 'ceo_educator', features: { sector: null, topic, seniority: null }, serves: speakServes, source_revision: usedFiles,
      ...(because.length <= BECAUSE_MAX ? { because } : {}),
      brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: Jonny asks ${event} for ${ask} for you, from his own Gmail.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
      card,
    };
  });
  if (pods.length > take.podcasts) held.push(...Array(pods.length - take.podcasts).fill('pitch_per_run_cap'));
  if (stages.length > take.stages) stageHeld.push(...Array(stages.length - take.stages).fill('pitch_per_run_cap'));
  return { proposals: [...inviteProposals, ...podcastProposals, ...stageProposals], held, stageHeld, inviteHeld };
}
