/**
 * The show-notes note (Ruling, Krish, 2026-10-27): "After one of Jonny's
 * pitches to someone else's show or stage is booked, Jonny sends the host
 * one short note asking for the brief link in its show notes or event page."
 * Pure: it writes the words; Control Center drafts them into Jonny's Gmail
 * (protocol 1.10.0, kind show_notes_ask) and Jonny sends them.
 *
 * The link is the canon's brief URL, tagged for its placement (traffic.mjs),
 * because it is meant for the public show notes, a public placement. This is
 * the one stage that writes a tagged link.
 */
import { seal, clean, DAY } from '../guards.mjs';
import { firstName, cleanName, cutClean, fitTitleWithin, NOT_A_SOURCE, CARD_LINE_MAX, CARD_ANGLE_TITLE_MAX, CARD_SOURCES, BECAUSE_MAX, BRIEF_LINE_MAX, TITLE_MAX } from './rows.mjs';
import { stageKind, hostOf } from './pitches.mjs';
import { tagged } from './traffic.mjs';

export const SHOW_NOTES_KIND = 'show_notes_ask';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const within = (line, max = CARD_LINE_MAX) => line && line.length <= max ? line : '';

/** The stages one of Jonny's pitches booked, and those already asked, from the context's drafts. Pure. */
export function bookedStages(context) {
  const booked = new Set(), asked = new Set();
  for (const d of Array.isArray(context?.records?.drafts) ? context.records.drafts : []) {
    const id = typeof d?.visibility_target_id === 'string' ? d.visibility_target_id.toLowerCase() : null;
    if (!id) continue;
    if (d.job === 'show_notes') asked.add(id);
    else if (d.job === 'booked' && d.mailbox === 'jonny' && typeof d.booked_at === 'string' && Number.isFinite(Date.parse(d.booked_at))) booked.add(id);
  }
  return { booked, asked };
}

/** The note in Jonny's voice: thanks, then one ask, the tagged brief link. Pure. */
export function showNoteWords({ name, host, kind, canon }) {
  const podcast = kind === 'podcast';
  const link = tagged(canon.ask.url, podcast ? 'podcast' : 'guest-seat');
  const place = podcast ? 'the show notes' : 'the event page';
  const who = podcast ? 'your listeners' : 'the people in the room';
  return {
    subject: clean(`${name}: one link for ${place}`).slice(0, 200),
    body: [
      `Hi ${host ? firstName(host) : 'there'},`,
      clean(`Thank you for having Krish ${podcast ? 'on' : 'at'} ${name}. He is looking forward to it.`),
      clean(`When it goes up, could you add one link to ${place}? It is where ${who} can try what Krish talks about: ${canon.ask.description}. ${link}`),
      'Thanks again,',
      'Jonny'
    ].join('\n\n'),
    link
  };
}

/**
 * One note for each stage a Jonny pitch booked that has not been asked yet,
 * at most `room`, with an address Control Center can draft to. Each is a
 * version 2 email action naming Jonny's box and kind show_notes_ask, on the
 * visibility row for a podcast and the events row for a stage. No objective:
 * traffic never steers the work. Pure.
 */
export function showNoteRows({ context, canon, files, at, room, titleMax = TITLE_MAX }) {
  const { booked, asked } = bookedStages(context);
  const routes = context?.routes ?? {};
  const out = [], held = [];
  for (const t of Array.isArray(context?.records?.visibility) ? context.records.visibility : []) {
    const id = typeof t?.id === 'string' ? t.id.toLowerCase() : null;
    if (!id || !UUID.test(id) || !booked.has(id)) continue;
    if (asked.has(id)) { held.push('show_notes_asked'); continue; }
    const kind = stageKind(t);
    if (!kind) { held.push('show_notes_not_a_stage'); continue; }
    const to = typeof t.booking_contact_id === 'string' && UUID.test(t.booking_contact_id) ? t.booking_contact_id : null;
    if (!to || routes[to]?.email === 'none') { held.push('show_notes_no_address'); continue; }
    if (out.length >= room) { held.push('show_notes_day_cap'); continue; }
    const name = cleanName(t.title);
    const host = hostOf(t);
    const words = showNoteWords({ name, host, kind, canon });
    // The brief must be on mindmake.co to be tagged; anything else is held, never sent untagged or off the canon.
    if (!words.link) { held.push('show_notes_no_site_link'); continue; }
    const row = kind === 'podcast' ? 'visibility' : 'events';
    const action = { version: 2, channel: 'email', recipient_contact_id: to, subject: words.subject, body: words.body, form: null, mailbox: 'jonny', kind: SHOW_NOTES_KIND };
    const sources = [];
    for (const [label, url] of [[`${name}, its own page`, t.event_url], [`${name}, its feed`, t.feed_url]]) {
      if (typeof url === 'string' && /^https:\/\/\S+$/.test(url) && url.length <= 2000 && !NOT_A_SOURCE.test(url) && !sources.some(s => s.url === url)) sources.push({ label, url });
    }
    const place = kind === 'podcast' ? 'show notes' : 'event page';
    const card = {
      who: within(`${name} booked Krish through Jonny's pitch.`) || 'A show booked Krish through Jonny\'s pitch.',
      known: 'They know Krish through Jonny, who pitched them and booked the date.',
      why: [within(`A link in its ${place} keeps sending people to the brief long after the date.`)].filter(Boolean),
      gain: [within(`Lasting visits to mindmake.co from ${name}'s audience, tagged so they are counted.`) || 'Lasting visits to mindmake.co, tagged so they are counted.'],
      angles: [{ title: 'One link', line: within(`Jonny thanks them and asks for the brief link in the ${place}, once.`) }].filter(a => a.line && a.title.length <= CARD_ANGLE_TITLE_MAX),
      sources: sources.slice(0, CARD_SOURCES)
    };
    const because = `Booked through Jonny's pitch. Jonny asks for the brief link in the ${place}.`;
    out.push({
      proposal_id: `gmp-${seal({ subject: `target:${t.id}`, ask: 'show_notes' }).slice(0, 32)}`,
      title: fitTitleWithin(titleMax, `Jonny asks ${name} for the brief link`, 'Jonny asks a booked show for the brief link'),
      why: clean(`${name} booked Krish through Jonny's pitch. One ask: the brief link in its ${place}, so its audience reaches mindmake.co.`).slice(0, 1000),
      kind: 'prepared', wall: 'send', channel: 'email', amount_usd: 0, objective_key: null,
      exact_payload: JSON.stringify(action), target: to, subject_ref: `target:${t.id}`,
      evidence: [], close_condition: { event: 'outreach_sent', reference: `${row}:show_notes` },
      expires_at: new Date(Date.parse(at) + 14 * DAY).toISOString(), stage: null, parent_proposal_id: null,
      row, rank: 0,
      reach: { value: null, band: 'unknown', basis: 'a booked audience not yet measured', source_url: null, as_of: null },
      amplifier_kind: kind === 'podcast' ? 'broadcaster' : 'ceo_educator', features: { sector: null, topic: null, seniority: null }, serves: null, source_revision: files.slice(0, 8),
      ...(because.length <= BECAUSE_MAX ? { because } : {}),
      brief: [card.who, card.known, ...card.why, `The ask: Jonny asks for the brief link in the ${place}, from his own Gmail.`].map(l => cutClean(l, BRIEF_LINE_MAX)).slice(0, 6),
      card
    });
  }
  return { proposals: out, held };
}
