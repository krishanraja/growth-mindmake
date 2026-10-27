import { seal, clean, DAY } from '../guards.mjs';
import { lessons, refusedBy, firstName, givenParts, cleanName, monthYear, servesOf, leadFacts, fitTitleWithin, cutClean, KRISH_TITLE, OWN_SHOW, TOPICS, NOT_A_SOURCE, CARD_WHO_MAX, CARD_LINE_MAX, CARD_LINES, CARD_ANGLE_TITLE_MAX, CARD_SOURCES, BECAUSE_MAX, BRIEF_LINE_MAX, TITLE_MAX } from './rows.mjs';

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
 * Pure: everything comes from the context, the directive and the files read
 * this run. No model call. No address, ever.
 */

/** Pitches a run writes at most: Control Center drafts at most ten a day. */
export const PITCHES_PER_RUN = 10;
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

/** The stages already pitched: a draft made for one, or any answer on a pitch to it. */
export function pitchedStages(context) {
  const out = new Set();
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) if (typeof d?.visibility_target_id === 'string') out.add(d.visibility_target_id);
  for (const f of Array.isArray(context?.feedback) ? context.feedback : []) {
    const m = /^target:([0-9a-f-]{36})$/i.exec(f?.subject_ref ?? '');
    if (m && f.row === 'visibility' && ['approved', 'done', 'declined'].includes(f.state)) out.add(m[1].toLowerCase());
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

/**
 * Today's pitches, best first, at most PITCHES_PER_RUN, each a 1.9.0
 * visibility row proposal for Jonny's box; and why every other stage was
 * left out. Ranks start at 1 among the pitches.
 */
export function pitchRows({ context, weekGoals, canon, record = null, files, at, titleMax = TITLE_MAX }) {
  const L = lessons(context?.feedback, at);
  const pitched = pitchedStages(context);
  const held = [], kept = [];
  const seen = new Set();
  for (const t of Array.isArray(context?.records?.visibility) ? context.records.visibility : []) {
    if (typeof t?.id !== 'string' || !UUID.test(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    const why = pitchHold(t, { L, pitched, at });
    // A stage of another kind is not a show; it is not counted as held from one.
    if (why === 'not_a_podcast') continue;
    if (why) { held.push(why); continue; }
    kept.push({ t, score: pitchScore(t, at) });
  }
  kept.sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id));
  const serves = servesOf('visibility', weekGoals);
  const usedFiles = [...files, ...(record?.file ? [record.file] : [])].slice(0, 8);
  const proposals = kept.slice(0, PITCHES_PER_RUN).map(({ t }, i) => {
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
      row: 'visibility', rank: i + 1,
      reach: { value: null, band: 'unknown', basis: 'a podcast audience not yet measured', source_url: null, as_of: null },
      amplifier_kind: 'broadcaster', features: { sector: null, topic, seniority: null }, serves, source_revision: usedFiles,
      ...(because.length <= BECAUSE_MAX ? { because } : {}),
      brief: [card.who, card.known, ...card.why.slice(0, 2), `The ask: Jonny asks ${show} to have you on as a guest, from his own Gmail.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
      card,
    };
  });
  if (kept.length > PITCHES_PER_RUN) held.push(...Array(kept.length - PITCHES_PER_RUN).fill('pitch_per_run_cap'));
  return { proposals, held };
}
