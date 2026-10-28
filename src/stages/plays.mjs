import { DAY } from '../guards.mjs';
import { lessons } from './rows.mjs';
import { roomRank, roomIsLive, roomDemand, buyerRoom } from './rooms.mjs';
import { pitchHold, inviteHold, stageForm, invitedGuests, pitchedStages } from './pitches.mjs';
import { shadowLine, stageStrength } from './visibility.mjs';

/**
 * The focus playbooks for Mindmake: which play, which person and which path
 * (plan section 12, M7; Ruling, Krish, 2026-10-27: Control Center "does not
 * own the strategy for how to grow mindmake as a business"). The engine home
 * is the rows stage: each of Mindmake's plays either has a row of its own
 * here (src/stages/rows.mjs for people, src/stages/pitches.mjs for shows,
 * guests and stage forms), stays a thing on his one list that only he can
 * answer, or is ruled out.
 *
 * Ported from Control Center's api/_focus.ts, rule for rule:
 *   PLAYBOOKS      the plays of the three books whose default product is
 *                  Mindmake or whose plays are his own network (visibility,
 *                  revenue, network; src/lib/families.ts FAMILIES): their
 *                  order, cap, paths, the founder flag and what each fills.
 *                  Each now names its engine home (PLAYS below)
 *   pickApproach   the first approach a drafting play can make: only the
 *                  paths it allows, never 'none', one row per contact, a
 *                  guest or target already approached is skipped, guests by
 *                  fit, targets by score, touches by due date, ties on id
 *   roomRank       reused from src/stages/rooms.mjs (ported in M5)
 *   selectRooms    the rooms worth a decision: verified or unknown, not
 *                  archived or decided, an https page, starting inside 14
 *                  days, in his city or online; a buyer room needs buyers
 *   selectAfter    the rooms he went to, behind him, with no word yet
 *   selectStages   the stages that asked: an open public form, inside 30
 *                  days of its deadline or with none stated, by score
 *   playsToFill    and fillFocus's caps: three focus items at most, one a
 *                  play, three drafts a day (src/lib/waiting.ts FOCUS_MAX and
 *                  FOCUS_PER_PLAY, api/_focus.ts DRAFTS_PER_DAY)
 *   playAllowed    the founder visibility ruling as a gate
 *
 * Not ported, and why:
 *   - the family registry, the focus rule (focusFor, pickFocus), orderFocus
 *     and the list's progress line: they serve every venture and stay in
 *     Control Center (plan section 12, M7)
 *   - draftContext and ASK_WORDS: those are words for Control Center's model,
 *     and the engine writes its own (rows.mjs, pitches.mjs)
 *   - host_room: "Rooms are guest seats only: no hosted rooms this year"
 *     (Rulings, Krish, 2026-10-27), so it is ruled out, not ported
 *   - the founder visibility ruling's store (system_config): his visibility
 *     targets (two podcasts booked a week and a stage a fortnight, the same
 *     rulings) put his name out by his own word, so the engine never holds a
 *     name-out play on it; Control Center's stored answer is not served, so
 *     the shadow says so
 *   - the podcast pitch and press drafted into his own Gmail on a path to a
 *     person: for visibility Jonny sends (Ruling, Krish, 2026-10-27), and the
 *     engine's pitches go to a show's booking contact in Jonny's box
 *
 * What stays in Control Center: the records, the warm-path index and Rule
 * 2's wall (the context's `paths`), the one list and its closes, the drafter,
 * and the hourly refill that runs a play. Pure: no model, no network.
 */

/** src/lib/waiting.ts FOCUS_MAX and FOCUS_PER_PLAY: at most three focus items on his list, one a play. */
export const FOCUS_MAX = 3;
export const FOCUS_PER_PLAY = 1;
/** api/_focus.ts DRAFTS_PER_DAY: at most three drafter calls a day across every play. */
export const DRAFTS_PER_DAY = 3;
/** api/_focus.ts ROOM_DAYS, AFTER_DAYS and STAGE_DAYS. */
export const ROOM_DAYS = 14;
export const AFTER_DAYS = 7;
export const STAGE_DAYS = 30;
/** api/_focus.ts DRAFT_PATHS: 'none' is never a path a draft goes on. */
export const DRAFT_PATHS = Object.freeze(['warm', 'hop', 'invited', 'rich']);
const STAGE_TYPES = new Set(['cfp', 'conference', 'speaking', 'podcast', 'guest_appearance']);

/**
 * Mindmake's plays, in api/_focus.ts PLAYBOOKS order, each with its engine
 * home: `row` (one of the five rows carries it, named by `row` and the stage
 * that writes it), `list` (a thing on his one list only he answers; it stays
 * in Control Center), `ruled_out`, `not_a_lane` (the engine has no lane for
 * it yet) or `not_wired` (unwired in Control Center too).
 */
export const PLAYS = Object.freeze([
  { id: 'podcast_pitch', book: 'visibility', home: 'row', row: 'visibility', by: 'pitches.mjs', cap: 1, prepare: 'draft', paths: ['warm', 'hop', 'rich'], founder_visible: true, ask_kind: 'podcast_pitch', fill: 'target', wired: true },
  { id: 'guest_invite', book: 'visibility', home: 'row', row: 'visibility', by: 'pitches.mjs', cap: 1, prepare: 'draft', paths: ['warm', 'hop', 'rich'], ask_kind: 'guest_invite', fill: 'guest', wired: true },
  { id: 'event_go', book: 'visibility', home: 'list', row: null, by: null, cap: 1, prepare: 'link', wired: true },
  { id: 'stage_submit', book: 'visibility', home: 'row', row: 'events', by: 'pitches.mjs', cap: 1, prepare: 'link', paths: ['invited'], founder_visible: true, wired: true },
  { id: 'press', book: 'visibility', home: 'not_a_lane', row: null, by: null, cap: 1, prepare: 'draft', paths: ['warm', 'hop', 'rich'], founder_visible: true, ask_kind: 'press', fill: 'target', wired: true },
  { id: 'host_room', book: 'visibility', home: 'ruled_out', row: null, by: null, cap: 1, prepare: 'draft', paths: ['warm'], ask_kind: 'collaborator', wired: false },
  { id: 'event_followup', book: 'visibility', home: 'list', row: null, by: null, cap: 1, prepare: 'none', wired: true },
  { id: 'piece', book: 'visibility', home: 'list', row: null, by: null, cap: 1, prepare: 'link', wired: true },
  { id: 'reply_waiting', book: 'revenue', home: 'list', row: null, by: null, cap: 1, prepare: 'link', wired: true },
  { id: 'warm_ask', book: 'revenue', home: 'row', row: 'reach_out', by: 'pilots.mjs', cap: 1, prepare: 'draft', paths: ['warm'], ask_kind: 'buyer', wired: true },
  { id: 'intro_ask', book: 'revenue', home: 'row', row: 'reach_out', by: 'pilots.mjs', cap: 1, prepare: 'draft', paths: ['warm'], ask_kind: 'intro', wired: true },
  { id: 'buyer_room', book: 'revenue', home: 'list', row: null, by: null, cap: 1, prepare: 'link', wired: true },
  { id: 'touch_due', book: 'network', home: 'row', row: 'network', by: 'rows.mjs', cap: 1, prepare: 'draft', paths: ['warm'], ask_kind: 'reconnect', fill: 'touch', wired: true },
  { id: 'alumni', book: 'network', home: 'not_wired', row: null, by: null, cap: 1, prepare: 'draft', paths: ['warm'], ask_kind: 'reconnect', wired: false },
  // Control Center leaves amplifiers unwired; the engine's whole rows stage hunts them (playbook 11).
  { id: 'amplifiers', book: 'network', home: 'row', row: 'reach_out', by: 'rows.mjs', cap: 1, prepare: 'draft', paths: ['warm'], ask_kind: 'collaborator', wired: false },
].map(p => Object.freeze({ ...p, ...(p.paths ? { paths: Object.freeze([...p.paths]) } : {}) })));

/** A play by id. */
export const playOf = id => PLAYS.find(p => p.id === id) ?? null;

/** api/_focus.ts playAllowed: a name-out play runs only on his yes. The engine passes 'yes' (his visibility targets); Control Center's stored answer may say otherwise. Pure. */
export function playAllowed(play, founder) {
  return !play?.founder_visible || founder === 'yes';
}

/** api/_focus.ts playsToFill, for one book: the drafting plays, in order, wired, allowed, with none open, under the focus cap. Pure. */
export function playsToFill(book, { founder, openByPlay = new Map(), openFocus = 0 }) {
  const room = Math.max(0, FOCUS_MAX - openFocus);
  return PLAYS.filter(p => p.book === book && p.wired && p.fill && p.prepare === 'draft' && playAllowed(p, founder) && (openByPlay.get(p.id) ?? 0) < p.cap).slice(0, room);
}

const t = iso => (iso ? Date.parse(iso) : NaN);
const https = u => /^https:\/\//.test(String(u ?? '').trim());

/**
 * api/_focus.ts pickApproach: the first approach a drafting play can make, or
 * null. Only paths the play allows and never 'none'; a contact, guest or
 * target already taken is skipped; guests by fit then id, targets of the
 * play's type by score then id, touches by due date then contact. `paths` is
 * a Map keyed guest:, target: and contact:, as the context's paths read. Pure.
 */
export function pickApproach(play, { guests = [], targets = [], touches = [], paths, taken }) {
  const allowed = new Set(play.paths ?? []);
  const usable = p => !!p && p.path !== 'none' && allowed.has(p.path) && typeof p.contact_id === 'string' && !taken.contacts.has(p.contact_id);
  if (play.fill === 'guest') {
    const rows = [...guests].filter(g => !g.buried_at && !taken.guests.has(g.id)).sort((a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1) || a.id.localeCompare(b.id));
    for (const g of rows) {
      const p = paths.get(`guest:${g.id}`);
      if (usable(p)) return { play: play.id, contact_id: p.contact_id, path: p.path, guest_id: g.id, visibility_target_id: null, existing_draft: p.path === 'warm' && https(g.last_email_draft_url) };
    }
    return null;
  }
  if (play.fill === 'target') {
    const type = play.ask_kind === 'press' ? 'press_relationship' : 'podcast';
    const rows = [...targets].filter(r => !r.buried_at && r.type === type && (r.status === 'sourced' || r.status === 'queued') && !taken.targets.has(r.id))
      .sort((a, b) => (stageStrength(b) ?? -1) - (stageStrength(a) ?? -1) || a.id.localeCompare(b.id));
    for (const r of rows) {
      const p = paths.get(`target:${r.id}`);
      if (usable(p)) return { play: play.id, contact_id: p.contact_id, path: p.path, guest_id: null, visibility_target_id: r.id, existing_draft: false };
    }
    return null;
  }
  if (play.fill === 'touch') {
    const rows = [...touches].sort((a, b) => String(a.next_touch_due_at).localeCompare(String(b.next_touch_due_at)) || a.contact_id.localeCompare(b.contact_id));
    for (const r of rows) {
      const p = paths.get(`contact:${r.contact_id}`);
      if (usable(p)) return { play: play.id, contact_id: p.contact_id, path: p.path, guest_id: null, visibility_target_id: null, existing_draft: false };
    }
    return null;
  }
  return null;
}

/**
 * Every approach a play would make, in Control Center's order, each taking
 * its contact, guest or target before the next is chosen: what the hourly
 * refill would place over the hours, one at a time. Pure.
 */
export function approachQueue(play, input) {
  const taken = { contacts: new Set(input.taken.contacts), guests: new Set(input.taken.guests), targets: new Set(input.taken.targets) };
  const out = [];
  for (let pick = pickApproach(play, { ...input, taken }); pick; pick = pickApproach(play, { ...input, taken })) {
    out.push(pick);
    taken.contacts.add(pick.contact_id);
    if (pick.guest_id) taken.guests.add(pick.guest_id);
    if (pick.visibility_target_id) taken.targets.add(pick.visibility_target_id);
    if (out.length >= 200) break;
  }
  return out;
}

/** api/_focus.ts selectRooms: the rooms worth a decision, best first. A buyer room ranks buyers first. Pure. */
export function selectRooms(rows, { at, homeCity, play = 'event_go' }) {
  const now = Date.parse(at);
  const score = e => (play === 'buyer_room' ? (e.buyer_density ?? roomDemand(e)) : roomRank(e));
  return (Array.isArray(rows) ? rows : [])
    .filter(e => !e.archived_at && e.date_verified !== false && !e.decision && https(e.url))
    .filter(e => { const s = t(e.starts_at); return s > now && s <= now + ROOM_DAYS * DAY; })
    .filter(e => e.city === homeCity || e.city === 'virtual')
    .filter(e => play !== 'buyer_room' || buyerRoom(e))
    .sort((a, b) => score(b) - score(a) || String(a.starts_at).localeCompare(String(b.starts_at)) || a.id.localeCompare(b.id));
}

/** api/_focus.ts selectAfter: the rooms he said he would go to, now behind him, with no word on how they were. Pure. */
export function selectAfter(rows, at) {
  const n = Date.parse(at);
  return (Array.isArray(rows) ? rows : [])
    .filter(e => e.decision === 'attend' && !e.outcome && !e.archived_at)
    .filter(e => { const s = t(e.starts_at); return s <= n && s > n - AFTER_DAYS * DAY; })
    .sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)) || a.id.localeCompare(b.id));
}

/** api/_focus.ts selectStages: the stages that asked, best first. Pure. */
export function selectStages(rows, at) {
  const n = Date.parse(at);
  return (Array.isArray(rows) ? rows : [])
    .filter(r => !r.buried_at && STAGE_TYPES.has(String(r.type)) && (r.status === 'sourced' || r.status === 'queued'))
    .filter(r => https(r.cfp_url))
    .filter(r => { const d = t(r.deadline_at); return Number.isNaN(d) || (d > n && d <= n + STAGE_DAYS * DAY); })
    .sort((a, b) => (stageStrength(b) ?? -1) - (stageStrength(a) ?? -1)
      || String(a.deadline_at ?? '9999').localeCompare(String(b.deadline_at ?? '9999')) || a.id.localeCompare(b.id));
}

/** The context's warm paths as pickApproach reads them: guest:<id> and target:<id>. */
export function pathsOf(context) {
  const out = new Map(), p = context?.paths;
  for (const g of Array.isArray(p?.guests) ? p.guests : []) if (typeof g?.id === 'string') out.set(`guest:${g.id}`, g);
  for (const r of Array.isArray(p?.targets) ? p.targets : []) if (typeof r?.id === 'string') out.set(`target:${r.id}`, r);
  return out;
}

/** What is already approached, from Advisory: api/_focus.ts fillFocus's taken sets. */
export function takenOf(context) {
  const rows = Array.isArray(context?.records?.advisory) ? context.records.advisory : [];
  const ids = k => new Set(rows.map(r => r?.[k]).filter(x => typeof x === 'string' && x));
  return { contacts: ids('contact_id'), guests: ids('guest_id'), targets: ids('visibility_target_id') };
}

/**
 * The engine's answer on one of Control Center's picks: null where the
 * engine would make the same approach on its row, else why not, as a code.
 * A show is pitched by pitches.mjs's own holds, a guest invited by its
 * invite holds, a stage that asked by its form's holds; press is no lane
 * of the engine's. Pure.
 */
export function engineOnPick(pick, { byTarget, byGuest, L, invited, pitched, routes, at, canon }) {
  if (pick.play === 'press') return 'press_not_a_lane';
  if (pick.play === 'podcast_pitch') return pitchHold(byTarget.get(pick.visibility_target_id), { L, pitched, at });
  if (pick.play === 'guest_invite') return inviteHold(byGuest.get(pick.guest_id), { L, invited, routes, at });
  if (pick.play === 'stage_submit') {
    let f = null;
    try { f = stageForm(byTarget.get(pick.visibility_target_id), { L, pitched, at, canon }); } catch { return 'form_not_read'; }
    return f === null ? 'form_not_read' : f.hold ?? null;
  }
  return 'not_compared';
}

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * The focus playbooks in shadow. Control Center's own rules, run on the
 * context it serves, give the queue each of Mindmake's drafting plays would
 * fill (podcast pitches, guest invites and press, by pickApproach over the
 * served paths) and the stages that asked (selectStages). For each pick, the
 * engine's own answer: the same approach on its row (agrees), or why not.
 * Touches due and his city are not served, so a touch and the rooms are not
 * compared; the founder ruling's stored answer is not served, so the queue is
 * read as if he said yes. Nothing is held, hidden or changed. Pure.
 */
export function playsShadow({ context, canon = null, at, homeCity = null }) {
  const records = context?.records ?? {};
  const targets = Array.isArray(records.visibility) ? records.visibility.filter(r => typeof r?.id === 'string') : [];
  const guests = Array.isArray(records.guests) ? records.guests.filter(g => typeof g?.id === 'string') : [];
  const paths = pathsOf(context), taken = takenOf(context);
  const byTarget = new Map(targets.map(r => [r.id, r])), byGuest = new Map(guests.map(g => [g.id, g]));
  const ctx = { byTarget, byGuest, L: lessons(context?.feedback, at), invited: invitedGuests(context), pitched: pitchedStages(context), routes: context?.routes ?? {}, at, canon };
  const picks = [];
  for (const play of playsToFill('visibility', { founder: 'yes' })) picks.push(...approachQueue(play, { guests, targets, paths, taken }));
  for (const s of selectStages(targets, at)) picks.push({ play: 'stage_submit', contact_id: null, path: 'invited', guest_id: null, visibility_target_id: s.id, existing_draft: false });
  const verdicts = [], differ = {};
  let agree = 0;
  for (const p of picks) {
    const code = engineOnPick(p, ctx);
    if (code === null) agree++; else bump(differ, code);
    verdicts.push({ play: p.play, subject_ref: p.guest_id ? `guest:${p.guest_id}` : `target:${p.visibility_target_id}`, path: p.path, agrees: code === null, code });
  }
  const drafting = picks.filter(p => ['podcast_pitch', 'guest_invite', 'press'].includes(p.play) && !p.existing_draft);
  const homes = {};
  for (const p of PLAYS) bump(homes, p.home);
  const plays = ` Plays: ${PLAYS.length} of Control Center's for Mindmake; ${homes.row ?? 0} on an engine row, ${homes.list ?? 0} stay on his list, ${homes.ruled_out ?? 0} ruled out (hosted rooms), ${homes.not_a_lane ?? 0} with no lane, ${homes.not_wired ?? 0} unwired.`;
  const caps = ` Caps: it would draft ${Math.min(DRAFTS_PER_DAY, drafting.length)} of ${drafting.length} today (${DRAFTS_PER_DAY} a day, ${FOCUS_MAX} on his list, ${FOCUS_PER_PLAY} a play), its founder ruling read as yes, as his visibility targets say.`;
  const events = Array.isArray(records.events) ? records.events.filter(e => typeof e?.id === 'string') : [];
  let rooms;
  if (!homeCity) rooms = ` Rooms: ${events.length} read, not compared (his city is not served).`;
  else {
    const shown = selectRooms(events, { at, homeCity }), unverified = shown.filter(e => !roomIsLive(e, at)).length;
    rooms = ` Rooms: it would bring ${shown.length} of ${events.length}; the engine's room gate holds ${unverified}${unverified ? ' (date_unverified)' : ''}.`;
  }
  const line = shadowLine('Focus playbooks', ['pick', 'picks'], { read: picks.length, agree, differ }) + plays + caps + rooms;
  return { verdicts, line, source_revision: Array.isArray(canon?.files) ? canon.files : [] };
}
