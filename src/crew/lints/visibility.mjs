/**
 * The Visibility Producer's lint (plan section 3): podcast pitches, guest
 * invites onto his own shows, podcast forms, appearance asks and the
 * show-notes note, all on VISIBILITY. Lens: would the booker say yes in ten
 * seconds? Pure; it runs the pitches stage's own holds again on the record
 * each action names, so a rule lives in one place.
 */
import { pitchHold, inviteHold, stageKind } from '../../stages/pitches.mjs';
import { OWN_SHOW, KRISH_TITLE, cleanName } from '../../stages/rows.mjs';
import { SHOW_NOTES_KIND } from '../../stages/shownotes.mjs';
import { cardGrammar, actionOf, wordsOf, questionsIn, linksIn, subjectId, recordTexts, finding } from './grammar.mjs';

export const SPECIALIST = 'visibility-producer';
export const LINTS = ['visibility.booking_address', 'visibility.recent_episode', 'visibility.never_pitched', 'visibility.not_own_show', 'visibility.no_refusal', 'visibility.invite_hold', 'visibility.one_ask', 'visibility.ruled_title', 'visibility.show_named', 'visibility.one_link', 'visibility.show_notes_after_booking', 'card_grammar'];

export const applies = p => p?.row === 'visibility';

const PITCH_LINT = { no_booking_address: 'visibility.booking_address', quiet_show: 'visibility.recent_episode', already_pitched: 'visibility.never_pitched', applied: 'visibility.never_pitched', own_show: 'visibility.not_own_show', not_a_podcast: 'visibility.booking_address' };

/** Findings for one visibility action. */
export function lint(p, ctx) {
  const out = [];
  const a = actionOf(p);
  const ref = p.close_condition?.reference;
  const words = wordsOf(p);
  if (a?.kind === SHOW_NOTES_KIND) {
    // The note only after Control Center records the booking on one of Jonny's pitches, once per booking.
    const id = subjectId(p, 'target:')?.toLowerCase();
    if (!id || !ctx.booked.booked.has(id) || ctx.booked.asked.has(id)) out.push(finding('visibility.show_notes_after_booking', p, 'no recorded booking on a Jonny pitch, or already asked'));
    const t = id ? ctx.stages.get(id) : null;
    if ([t?.title, t?.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) out.push(finding('visibility.not_own_show', p, 'his own show'));
    return out;
  }
  if (ref === 'visibility:invite') {
    const id = subjectId(p);
    const g = ctx.guests.get(id);
    // invitesThisWeek and the cap are the stage's; here only whether the guest may be invited at all.
    const why = g ? inviteHold(g, { L: ctx.L, invited: ctx.invited, routes: ctx.routes, at: ctx.at }) : 'no_record';
    if (why) out.push(finding('visibility.invite_hold', p, why));
  } else if (ref === 'visibility:pitch' || p.channel === 'form') {
    const id = subjectId(p, 'target:')?.toLowerCase() ?? String(a?.form?.target_id ?? '').toLowerCase();
    const t = ctx.stages.get(id);
    if (!t) out.push(finding('visibility.booking_address', p, 'no stage on record'));
    else if (p.channel === 'form') { if ([t.title, t.organizer].some(x => typeof x === 'string' && OWN_SHOW.test(x))) out.push(finding('visibility.not_own_show', p, 'his own show')); }
    else {
      const why = pitchHold(t, { L: ctx.L, pitched: ctx.pitched, at: ctx.at });
      if (why) out.push(finding(PITCH_LINT[why] ?? 'visibility.no_refusal', p, why));
      if (!words.includes(KRISH_TITLE)) out.push(finding('visibility.ruled_title', p, 'not his ruled title'));
      if (!words.includes(cleanName(t.title))) out.push(finding('visibility.show_named', p, 'the show is not named'));
      if (linksIn(a?.body ?? '').length > 1) out.push(finding('visibility.one_link', p, 'more than one link'));
      if (stageKind(t) !== 'podcast') out.push(finding('visibility.booking_address', p, 'not a podcast'));
    }
  }
  if (p.channel !== 'form' && questionsIn(words) > 1) out.push(finding('visibility.one_ask', p, 'more than one question'));
  const record = subjectId(p) ? [...recordTexts(ctx.people.get(subjectId(p))), ...recordTexts(ctx.guests.get(subjectId(p)))] : recordTexts(ctx.stages.get(subjectId(p, 'target:')?.toLowerCase()));
  for (const f of cardGrammar(p.card, { records: [...record, ...ctx.extraRecords(subjectId(p))] })) out.push(finding('card_grammar', p, `${f.field}: ${f.reason}`));
  return out;
}
