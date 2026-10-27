/**
 * The Stages Producer's lint (plan section 3): speaking pitches, stage forms
 * and the event-page note, all on EVENTS. Lens: is his buyer actually in
 * this room? Pure; it runs the pitches stage's own holds again on the stage
 * each action names.
 */
import { speakHold, stageKind, showTopic, BUYER_TOPICS } from '../../stages/pitches.mjs';
import { OWN_SHOW } from '../../stages/rows.mjs';
import { SHOW_NOTES_KIND } from '../../stages/shownotes.mjs';
import { cardGrammar, actionOf, wordsOf, questionsIn, subjectId, recordTexts, finding } from './grammar.mjs';

export const SPECIALIST = 'stages-producer';
export const LINTS = ['stages.open_before_deadline', 'stages.speaker_address', 'stages.never_pitched', 'stages.not_own_show', 'stages.no_refusal', 'stages.buyer_in_room', 'stages.one_talk_title', 'stages.never_press', 'stages.one_ask', 'stages.event_page_note_after_confirm', 'card_grammar'];

export const applies = p => p?.row === 'events';

const SPEAK_LINT = { deadline_passed: 'stages.open_before_deadline', event_passed: 'stages.open_before_deadline', not_open: 'stages.open_before_deadline', no_booking_address: 'stages.speaker_address', already_pitched: 'stages.never_pitched', applied: 'stages.never_pitched', own_show: 'stages.not_own_show', not_a_stage: 'stages.never_press' };
/** On a form the speaker address is the form itself and the stage stays unpitched, so only these holds apply. */
const FORM_HOLDS = new Set(['deadline_passed', 'event_passed', 'not_open', 'own_show', 'not_a_stage']);

/** Findings for one events action. */
export function lint(p, ctx) {
  const out = [];
  const a = actionOf(p);
  const id = subjectId(p, 'target:')?.toLowerCase();
  const t = id ? ctx.stages.get(id) : null;
  if (a?.kind === SHOW_NOTES_KIND) {
    if (!id || !ctx.booked.booked.has(id) || ctx.booked.asked.has(id)) out.push(finding('stages.event_page_note_after_confirm', p, 'no confirmed date on a Jonny pitch, or already asked'));
    if ([t?.title, t?.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) out.push(finding('stages.not_own_show', p, 'his own show'));
    return out;
  }
  // A teach ask on EVENTS is about a person, not a stage: one ask and the card's grammar, from their record.
  const person = subjectId(p);
  if (person) {
    if (questionsIn(wordsOf(p)) > 1) out.push(finding('stages.one_ask', p, 'more than one question'));
    for (const f of cardGrammar(p.card, { records: [...recordTexts(ctx.people.get(person)), ...ctx.extraRecords(person)] })) out.push(finding('card_grammar', p, `${f.field}: ${f.reason}`));
    return out;
  }
  if (!t) return [finding('stages.speaker_address', p, 'no stage on record')];
  const why = speakHold(t, { L: ctx.L, pitched: ctx.pitched, at: ctx.at });
  if (why && (p.channel !== 'form' || FORM_HOLDS.has(why))) out.push(finding(SPEAK_LINT[why] ?? 'stages.no_refusal', p, why));
  if (stageKind(t) !== 'stage') out.push(finding('stages.never_press', p, 'not a stage to speak on'));
  const topic = showTopic(t);
  if (!topic || !BUYER_TOPICS.has(topic)) out.push(finding('stages.buyer_in_room', p, topic ? `a room about ${topic}` : 'nothing says who is in the room'));
  if (p.channel !== 'form') {
    // One talk title: the subject names it once, and the body offers that same title.
    const talk = /: (.+)$/.exec(a?.subject ?? '')?.[1];
    if (!talk || !(a?.body ?? '').includes(`"${talk}"`)) out.push(finding('stages.one_talk_title', p, 'the subject and the body do not offer one talk'));
    if (questionsIn(wordsOf(p)) > 1) out.push(finding('stages.one_ask', p, 'more than one question'));
  }
  for (const f of cardGrammar(p.card, { records: [...recordTexts(t), ...ctx.extraRecords(null)] })) out.push(finding('card_grammar', p, `${f.field}: ${f.reason}`));
  return out;
}
