/**
 * Krish's instruction and this engine's state (protocol 1.20.0).
 *
 * Ruling (Krish, 2026-11-11): every growth engine's priorities, obsessions,
 * next steps and outstanding items feed live across Control Centre, and
 * Krish instructs each engine with his next best action, which starts it.
 *
 * - His instruction arrives in the directive as `krish_instruction`
 *   (`{ id, words, given_at, given_by: 'krish', supersedes }` or null). It is
 *   put first in the run's work: his words go before the week's goals, in
 *   memory only, so each row says whether it serves them and the rows that do
 *   rank first. It is never an approval: anything at a wall still comes back
 *   to him as a proposal he approves by its digest.
 * - His words are never printed, logged or committed: this repository and its
 *   Actions logs are public. Only the id and a SHA-256 digest leave memory,
 *   except as the `serves` of a row in the report Control Center keeps.
 * - What the run did with it goes back as `instruction_acks`: `received` the
 *   first time a run reads it, then `started` when the run ranked its rows
 *   with it first, or `blocked` with why and what would unblock it. Never
 *   `done`: the dispatch cannot prove his ask is finished, so his own Clear
 *   on the instruction closes it. An ack never goes in `holds`. A state is
 *   acked only when it changes: Control Center applies acks forward only and
 *   counts a repeat of the state it holds as stale, so a later run whose
 *   state matches the one its own last report named sends no ack, and its
 *   first activity line still says the state.
 * - The engine's state (`priorities`, `obsessions`, `next_steps`) is read from
 *   this repository's own files and the run's own numbers: the North Star
 *   and its ladder, the bookings against the ruled targets, the urgency,
 *   starved lanes, Krish's quoted aims in docs/NORTH_STAR.md, the first
 *   unticked step of docs/GET-GOING.md and NOW.md's "Next:". Nothing is
 *   invented; a field with no source is left out.
 * - All of it goes out only where the directive says `features.engine_state`
 *   and the copied report schema carries the fields (ENGINE-PROTOCOL.md,
 *   "Krish's instruction and the engine's state (1.20.0)").
 *
 * Pure: the dispatch passes what it read and counted. It stores nothing.
 */
import { createHash } from 'node:crypto';

export const ENGINE_STATE_VERSION = '1.20.0';
export const ENGINE_STATE_KEYS = Object.freeze(['priorities', 'obsessions', 'next_steps', 'instruction_acks']);
export const PRIORITIES_MAX = 5;
export const OBSESSIONS_MAX = 3;
export const NEXT_STEPS_MAX = 5;
export const ACKS_MAX = 5;
export const STATE_LINE_MAX = 200;
export const ACK_LINE_MAX = 280;
/** The longest week goal a row quotes as its `serves` (1.6.0), so the longest instruction a row can say it serves. */
export const GOAL_MAX = 300;
export const WORDS_MAX = 2000;

const INSTRUCTION_ID = /^ki_[0-9a-f]{24}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
// The same address and number rules Control Center reads every state and ack line with (lineCarriesContact).
const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RUN = /\+?\d[\d\s().-]{8,}\d/g;
const hasPhone = t => (t.match(PHONE_RUN) ?? []).some(r => r.replace(/\D/g, '').length >= 10);
/** Whether a line carries an address or a phone number. Pure. */
export const carriesContact = text => EMAIL_IN_TEXT.test(text) || hasPhone(text);

/** One plain line: markdown marks dropped, whitespace folded, at most `max`, with no control character, address or number; else null. Pure. */
export function stateLine(text, max = STATE_LINE_MAX) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
  return t && t.length <= max && !CONTROL.test(t) && !carriesContact(t) ? t : null;
}

const digest = words => createHash('sha256').update(words, 'utf8').digest('hex');

/**
 * The directive's `krish_instruction`, checked: `open` with the instruction,
 * `none` when Control Center says none is open (null), `absent` when it did
 * not say, or `unreadable` (with its id when the id itself reads). Pure.
 */
export function readInstruction(raw) {
  if (raw === undefined) return { state: 'absent', instruction: null, id: null };
  if (raw === null) return { state: 'none', instruction: null, id: null };
  const id = typeof raw?.id === 'string' && INSTRUCTION_ID.test(raw.id) ? raw.id : null;
  const ok = id && typeof raw.words === 'string' && raw.words.trim() && raw.words.length <= WORDS_MAX && raw.given_by === 'krish'
    && typeof raw.given_at === 'string' && Number.isFinite(Date.parse(raw.given_at))
    && (raw.supersedes === null || raw.supersedes === undefined || (typeof raw.supersedes === 'string' && INSTRUCTION_ID.test(raw.supersedes)));
  if (!ok) return { state: 'unreadable', instruction: null, id };
  return { state: 'open', id, instruction: { id, words: raw.words, given_at: raw.given_at, supersedes: raw.supersedes ?? null, sha256: digest(raw.words) } };
}

/**
 * Whether this run may send the 1.20.0 fields: the directive says
 * `features.engine_state`, the copied schema has them, and Control Center's
 * capabilities, when they list versions, list 1.20.0. A report raised to
 * 1.20.0 must carry everything an earlier version requires of a row, which
 * only a Control Center serving every version gets. Pure.
 */
export function takesEngineState(directive, schema, capabilities = null) {
  const versions = capabilities?.schema_versions;
  return directive?.engine_state === true && ENGINE_STATE_KEYS.every(k => !!schema?.properties?.[k])
    && (!Array.isArray(versions) || versions.includes(ENGINE_STATE_VERSION));
}

/** Why a row cannot quote his words as the goal it serves, or null when it can. Pure. */
export function unquotable(instruction) {
  const w = instruction?.words;
  if (typeof w !== 'string' || !w.trim()) return 'unreadable';
  if (w.length > GOAL_MAX) return 'too_long';
  if (CONTROL.test(w)) return 'not_one_line';
  if (carriesContact(w)) return 'carries_contact';
  return null;
}

/** The goals the rows rank against: his words first when a row can quote them, then the week's goals. In memory only. Pure. */
export function rowGoals(instruction, weekGoals = []) {
  const goals = Array.isArray(weekGoals) ? weekGoals : [];
  if (!instruction || unquotable(instruction)) return goals;
  return [instruction.words, ...goals.filter(g => g !== instruction.words)].slice(0, 11);
}

/** Whether an earlier report of this engine already named this instruction (each run that reads it says so in its first line). Unknown is false. Pure. */
export function instructionSeen(recent, id) {
  if (!Array.isArray(recent) || !id) return false;
  return recent.some(r => (Array.isArray(r?.activity) ? r.activity : []).some(a => (typeof a === 'string' ? a : a?.line ?? '').includes(`Krish's instruction ${id}`)));
}

/**
 * The state this engine last acked his instruction with, read from the first
 * activity line of its newest recent report that names it: `started`, or
 * `blocked` (a block or the engine held), else `received`. Null when no
 * report names it or the history could not be read, so the state is sent
 * again. Pure.
 */
export function lastAck(recent, id) {
  if (!Array.isArray(recent) || !id) return null;
  for (const r of recent) {
    const line = (Array.isArray(r?.activity) ? r.activity : []).map(a => (typeof a === 'string' ? a : a?.line ?? '')).find(l => l.includes(`Krish's instruction ${id}`));
    if (line === undefined) continue;
    if (/\. Started: /.test(line)) return 'started';
    if (/\. (?:Blocked|Engine held): /.test(line)) return 'blocked';
    return 'received';
  }
  return null;
}

const BLOCKED = {
  held: 'Engine held: Control Center holds this engine, so it acts on nothing until he releases it on Growth > Engines.',
  unreadable: 'Blocked: the instruction did not read as protocol 1.20.0 shapes it, so this run could not act on it; Control Center sending it in that shape would unblock it.',
  too_long: `Blocked: it is longer than the ${GOAL_MAX} characters a row can quote, so no row could be ranked against it; a shorter instruction would unblock it.`,
  not_one_line: 'Blocked: it runs over more than one line, which a row cannot quote; the same words on one line would unblock it.',
  carries_contact: 'Blocked: it carries an address or a phone number, which a row may never quote; the same words without it would unblock it.',
  no_rows: 'Blocked: Control Center served no people or stages to rank this run, so no row could be ranked against it; the next run that reads its context will.'
};

/**
 * What this run did with his instruction: the first activity line (the id and
 * a digest, never his words), the acks, and counts for the printed outcome.
 * `held` when Control Center holds the engine; `rowsRan` when the five rows
 * were built; `proposals` the report's final proposals; `seen` whether an
 * earlier report named it and `last` the state that report named
 * (`lastAck`), so an unchanged state is not acked again. Pure.
 */
export function instructionWork({ read, held = false, rowsRan = false, proposals = [], seen = false, last = null, receivedAt, at }) {
  if (!read || read.state === 'none' || read.state === 'absent') return null;
  const id = read.id;
  const why = read.state === 'unreadable' ? 'unreadable' : held ? 'held' : unquotable(read.instruction) ?? (rowsRan ? null : 'no_rows');
  const rows = proposals.filter(p => typeof p?.row === 'string');
  const serving = why ? 0 : rows.filter(p => p.serves === read.instruction.words).length;
  const started = `Started: this run ranked its rows with it first, and ${serving} of ${rows.length} row${rows.length === 1 ? '' : 's'} say they serve it. Anything that sends, posts or spends still comes to him as a proposal; his Clear marks it done.`;
  const line = why ? BLOCKED[why] : started;
  const state = why ? 'blocked' : 'started';
  // Control Center applies acks forward only and counts a repeat of the state it holds as stale (ackStep), so it is not sent again.
  const repeat = seen && last === state;
  const acks = id ? [
    ...(seen ? [] : [{ instruction_id: id, state: 'received', line: 'Received at the daily dispatch and put first in this run\'s work.', at: receivedAt, evidence_url: null }]),
    ...(repeat ? [] : [{ instruction_id: id, state, line, at, evidence_url: null }])
  ] : [];
  const tag = read.instruction ? ` (sha256 ${read.instruction.sha256.slice(0, 12)})` : '';
  const activity = id
    ? `${seen ? `Krish's instruction ${id}${tag} is first again this run` : `Received Krish's instruction ${id}${tag} and put it first in this run's work`}. ${line}${repeat ? ` Acked ${state} on an earlier run, so no ack is sent again.` : ''}`
    : `The directive carried an instruction from Krish this run could not read, with no id to answer it by, so it acted on none and acked none.`;
  return { activity, acks, outcome: { id, sha256: read.instruction?.sha256 ?? null, acks: acks.map(a => a.state), serving } };
}

const say = v => v === null || v === undefined ? 'unknown' : String(v);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** 2026-11-30 as "30 November 2026". Pure. */
export const longDate = ymd => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd)); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null; };
/** "18 October 2026" as 2026-10-18, or null. Pure. */
export const isoDate = words => {
  const m = /^(\d{1,2}) ([A-Z][a-z]+) (\d{4})$/.exec(String(words).trim());
  const month = m ? MONTHS.indexOf(m[2]) : -1;
  return month < 0 ? null : `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

/**
 * What the engine is chasing, most important first, from the run's own
 * numbers: the North Star (good meetings against this week's rung and the
 * ladder's last), the ruled visibility targets against bookings, the volume
 * urgency sets, and lanes starved for runs. Pure.
 */
export function priorities({ gap, ladder = [], booked = null, targets = null, raised = 0, starved = [], starvedRuns = 3 }) {
  const out = [];
  const last = ladder.length ? ladder[ladder.length - 1] : null;
  const by = last ? `; ${last[1]} a week by ${longDate(last[0])}` : '';
  out.push([`Good meetings, each marked good by Krish and traced to its path: ${say(gap?.current)} of ${say(gap?.target)} this week (${Number.isInteger(gap?.urgency) ? `U${gap.urgency}` : 'urgency unknown'})${by}.`, 'good_meetings']);
  if (targets) out.push([`Visibility: ${targets.podcasts} podcast${targets.podcasts === 1 ? '' : 's'} booked a week and ${targets.stages} stage${targets.stages === 1 ? '' : 's'} a fortnight; ${booked ? `so far ${booked.podcasts} this week and ${booked.stages} in the last fourteen days` : 'bookings not measured this run'}.`, 'podcasts_booked']);
  if (Number.isInteger(gap?.urgency) && gap.urgency >= 3) out.push([`At U${gap.urgency}, volume ${raised ? 'runs at the top of its policy bounds' : 'stays at the caps in force'} and nothing else moves: no wall, no send, no spend.`, 'good_meetings']);
  if (starved.length) out.push([`Feed the lanes at 0 for ${starvedRuns} runs: ${starved.map(s => String(s.lane ?? s).replace('_', ' ')).join(', ')}.`, 'good_meetings']);
  return out.map(([line, key]) => [stateLine(line), key]).filter(([line]) => line).slice(0, PRIORITIES_MAX).map(([line, key], i) => ({ rank: i + 1, line, objective_key: key }));
}

/**
 * Krish's own aims, as quoted in docs/NORTH_STAR.md: the North Star's
 * quoted lines (set on the date the file names) and the number's ruling in
 * quotes. A line over the limit is left out, never cut. Pure.
 */
export function obsessions(northStarText) {
  const text = String(northStarText ?? '');
  const set = isoDate(/Set by Krish on (\d{1,2} [A-Z][a-z]+ \d{4})/.exec(text)?.[1] ?? '');
  const quoted = [...text.matchAll(/^> (\S.*)$/gm)].map(m => ({ line: m[1], since: set }));
  const ruled = [...text.matchAll(/Ruling \(Krish, (\d{4}-\d{2}-\d{2})\): "([^"]+)"/g)].map(m => ({ line: m[2], since: m[1] }));
  return [...quoted, ...ruled].map(o => ({ line: stateLine(o.line), since: o.since })).filter(o => o.line).slice(0, OBSESSIONS_MAX);
}

/** Splits at a separator outside parentheses. Pure. */
function splitOutside(text, sep) {
  const parts = []; let depth = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && text.startsWith(sep, i)) { parts.push(text.slice(from, i)); from = i + sep.length; i += sep.length - 1; }
  }
  parts.push(text.slice(from));
  return parts.map(p => p.trim()).filter(Boolean);
}
const sentences = text => String(text).split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
const upper = s => s.charAt(0).toUpperCase() + s.slice(1);
// A date inside an id (`gms-2026-11-09`) names the thing, not when it is due.
const whenOf = s => /(?<![\w-])(\d{4}-\d{2}-\d{2})\b/.exec(s)?.[1] ?? null;
const DAY_NAME = '(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) )?';
const DEADLINE = new RegExp(`\\b(?:by|on|before) ${DAY_NAME}(?:(\\d{4}-\\d{2}-\\d{2})|(\\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?(?: (\\d{4}))?)\\b`, 'g');
const ABBR = MONTHS.map(m => m.slice(0, 3));
/**
 * The dates a line sets as its deadline ("on 2026-11-09", "by 5 Nov", "on
 * Monday 9 November"), as YYYY-MM-DD; a day and month with no year take
 * `year`. Pure.
 */
export function deadlines(text, year) {
  return [...String(text).matchAll(DEADLINE)].map(m => m[1] ?? ((m[4] ?? year) ? `${m[4] ?? year}-${String(ABBR.indexOf(m[3]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null)).filter(Boolean);
}
/** Who a clause of NOW.md's "Next:" waits on: Krish when he is its subject, another session or Control Center when one is, else this engine. Pure. */
const waitsOn = clause => /^Krish\b/.test(clause) ? 'krish' : /^(?:the |a )?(?:[A-Z][\w-]* ){0,3}(?:session|Control Center|Codex)\b/.test(clause) ? 'other' : 'engine';

/**
 * What the engine does next: the first unticked step of docs/GET-GOING.md's
 * build, then, under NOW.md's "What is next and what is waiting on Krish",
 * the Next line (the fold's `- Next (YYYY-MM-DD):` or `- **Next:**`) clause
 * by clause, and what waits on Krish, inside it or on its own `Waiting on
 * Krish:` line. Given `today` (YYYY-MM-DD), a step whose own deadline has
 * passed is left out: a dated line nobody updated is never sent as a next
 * step. Unparsed or overlong text is left out, never cut. Pure.
 */
export function nextSteps({ getGoing = '', now = '', today = null } = {}) {
  const out = [];
  const year = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today.slice(0, 4) : null;
  const step = (text, waits_on) => {
    const due = deadlines(text, year);
    if (year && due.some(d => d < today)) return;
    out.push({ line: stateLine(text), waits_on, when: due[0] ?? whenOf(text) });
  };
  const first = /^- \[ \] \*\*(.+?)\*\*\s*(.*)$/m.exec(String(getGoing));
  if (first) {
    const label = first[1].replace(/[.:]\s*$/, '').trim();
    const opening = sentences(first[2])[0] ?? '';
    step(opening ? `${label}: ${opening}` : label, 'engine');
  }
  // A channel this engine owns but has not built is said as not built while its step is open, so the state is true (audit seams-6).
  if (/^- \[ \] \*\*1\.4 LinkedIn\.\*\*/m.test(String(getGoing))) step('His personal LinkedIn: not built. This engine owns it since growth-makeyourmindup handed it over (GET-GOING 1.4).', 'engine');
  const section = /^## What is next and what is waiting on Krish\s*$([\s\S]*?)(?=^#{2,3} )/m.exec(`${String(now)}\n## `)?.[1] ?? '';
  const next = (/^- Next(?: \(\d{4}-\d{2}-\d{2}\))?:\s*(.+)$/m.exec(section) ?? /^- \*\*Next:\*\*\s*(.+)$/m.exec(section))?.[1] ?? '';
  const waitingItems = text => splitOutside(text.replace(/\.$/, ''), ', and ').flatMap(x => splitOutside(x, '; '));
  for (const s of sentences(next)) {
    const waiting = /^Waiting on Krish:\s*(.+?)\.?$/.exec(s);
    if (waiting) { for (const item of waitingItems(waiting[1])) step(`Waiting on Krish: ${item.replace(/\.$/, '')}.`, 'krish'); continue; }
    for (const clause of splitOutside(s.replace(/\.$/, ''), '; ')) step(`${upper(clause)}.`, waitsOn(clause));
  }
  const waitingLine = /^- (?:\*\*)?Waiting on Krish:(?:\*\*)?\s*(.+)$/m.exec(section)?.[1] ?? '';
  for (const item of waitingLine ? waitingItems(waitingLine) : []) step(`Waiting on Krish: ${item.replace(/\.$/, '')}.`, 'krish');
  return out.filter(x => x.line).slice(0, NEXT_STEPS_MAX);
}

/**
 * The 1.20.0 fields for the report: each only when it has an entry. Pure.
 */
export function engineState({ priorities: p = [], obsessions: o = [], next_steps: n = [], acks = [] }) {
  return {
    ...(p.length ? { priorities: p.slice(0, PRIORITIES_MAX) } : {}),
    ...(o.length ? { obsessions: o.slice(0, OBSESSIONS_MAX) } : {}),
    ...(n.length ? { next_steps: n.slice(0, NEXT_STEPS_MAX) } : {}),
    ...(acks.length ? { instruction_acks: acks.slice(0, ACKS_MAX) } : {})
  };
}
