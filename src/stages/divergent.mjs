/**
 * Consulting divergent-thinker, the fleet's divergent thinking engine
 * (krishanraja/divergent-thinker), through Control Center's `divergent` route
 * on this engine's own bearer. Three uses, each dormant until Control Center's
 * capabilities say `features.divergent: true`; before that there is no call,
 * no error and no line, only a quiet "not served" count in the run's outcome.
 *
 * - **Recovery plays** (ENGINE-PROTOCOL.md, "How the next action is chosen",
 *   rule 5: at U4 one bold swing, at U5 three unconventional recovery plays,
 *   each different in kind). At U4 or U5, with the engine not held and no
 *   other strategy ask in the report, the live run asks `diverge` once a
 *   London week for three plays. Every spark is read against this engine's
 *   own walls and lint first (`sparkFindings`): a play that reads well and
 *   breaks consent, a community's rules, the guest-seats-only rooms, paid
 *   media or scarcity never reaches him. The best survivor is one strategy
 *   ask (`gmu-<monday>`, one ask per engine); the others stay in the report's
 *   lines. Later runs that week carry the same ask forward unchanged from the
 *   report that made it, so its digest and his answer hold.
 * - **The consensus map** for the week's one change: once a London week it
 *   maps what most teams would do (`map`, one call) and reads the chosen
 *   change against it (`score`, no call), so the change is not simply the
 *   default. One line in the report; never an ask.
 * - **The score guard** on pitch and morning-draft openings, run by
 *   scripts/reader.mjs in the Reader Check session: `score` with a fixed list
 *   of generic openers (config/pitch-openers.json), no model call, counts in
 *   shadow only. It never holds a draft.
 *
 * Nothing here sends, posts or spends, and no answer moves a wall.
 */
import { readFileSync } from 'node:fs';
import { BANNED, PRAISE } from './openings.mjs';
import { lint as guardLint } from '../crew/lints/guard.mjs';

export const NAMESPACE = 'growth-mindmake';
export const PITCH_NAMESPACE = 'growth-mindmake:pitches';
export const RECOVERY_PREFIX = 'gmu-';
export const RECOVERY_LINE = /^Recovery plays: /;
export const CONSENSUS_LINE = /^Consensus map: /;
export const SPARK_COUNT = 3;
/** A diverge runs up to four minutes at Control Center; the client waits five. */
export const DIVERGE_TIMEOUT_MS = 300000;
/** Rule 5 starts at U4. */
export const URGENT = 4;

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

/** Whether Control Center serves the divergent route this run. Pure. */
export const divergentServed = capabilities => capabilities?.features?.divergent === true;

/** The thesis, the first bold sentence under "## The thesis" in docs/STRATEGY.md, or null. Pure. */
export function thesisOf(text) {
  const m = /^## The thesis\s+\*\*([^*]+)\*\*/m.exec(String(text ?? ''));
  return m ? m[1].trim() : null;
}
/** The number from docs/NORTH_STAR.md's metric block: { metric, target, deadline }, or null. Pure. */
export function northStarOf(text) {
  const block = /```yaml north-star-metric\n([\s\S]*?)```/.exec(String(text ?? ''))?.[1];
  if (!block) return null;
  const metric = /^metric: "([^"]+)"/m.exec(block)?.[1] ?? null;
  const target = Number(/^target: (\d+)/m.exec(block)?.[1] ?? NaN);
  const deadline = /^deadline: (\d{4}-\d{2}-\d{2})/m.exec(block)?.[1] ?? null;
  return metric && Number.isInteger(target) && deadline ? { metric, target, deadline } : null;
}
export const THESIS = thesisOf(read('docs/STRATEGY.md'));
export const NUMBER = northStarOf(read('docs/NORTH_STAR.md'));

/** What every team already does, so a spark is never one of these. */
export const CLICHES = Object.freeze([
  'Warm morning drafts from the founder to his own network',
  'Podcast and stage pitches sent by an assistant',
  'Cold, named and researched email to leaders with a buying moment',
  'Inbound from a free brief on the website',
  'A free "Who decided?" judgement audit as a lead magnet',
  'Selling $59 parts of a leader\'s AI brain',
  'Post more on LinkedIn',
  'Host a webinar'
]);

// ── The banned words, read from the engine's own lists ──
function alternatives(src) {
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') { cur += ch + (src[i + 1] ?? ''); i++; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '|' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function expand(src) {
  const i = src.indexOf('(?:');
  if (i < 0) return [src];
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === '(') depth++;
    else if (src[j] === ')' && --depth === 0) break;
  }
  const head = src.slice(0, i), inner = src.slice(i + 3, j), tail = expand(src.slice(j + 1));
  return alternatives(inner).flatMap(a => expand(a).flatMap(x => tail.map(t => head + x + t)));
}
/** A word-list regular expression as the plain words and phrases it matches (one level of `\w*` dropped). Pure. */
export function regexWords(re) {
  const src = re.source.replace(/^\\b/, '').replace(/\\b$/, '');
  return expand(src).map(w => w.replace(/\\w\*/g, '').replace(/\\s\+?/g, ' ').trim()).filter(Boolean);
}
/**
 * Words an idea from divergent-thinker must not contain: openings.mjs PRAISE (puffery a reader distrusts).
 * Not BANNED, which keeps internal data out of an email opening ("Krish", "research", "record"), and not the
 * taxonomy's file-name words ("new", "final"): its gate rejects any idea holding a banned word, so those lists
 * would reject almost every strategy idea. Pure.
 */
export function bannedWords() {
  return [...new Set(regexWords(PRAISE))];
}

// ── Recovery plays ──

/** The problem diverge is asked: the thesis, the number and the gap line, no person and no figure but the public count. Pure. */
export function recoveryProblem({ gap, thesis = THESIS, number = NUMBER }) {
  const aim = number ? `The number is "${number.metric}", ${number.target} a week by ${number.deadline}.` : '';
  return [
    `Mindmake is one founder's company that builds leaders an AI brain that runs on their own judgement.`,
    thesis ? `Its thesis: ${thesis}.` : '',
    aim,
    typeof gap === 'string' ? gap : '',
    `Find unconventional recovery plays, each different in kind, that put the founder in good meetings with senior leaders before the deadline.`,
    `Every play stays inside these walls: nothing is sent, posted or spent without his yes; no bought, scraped or automated lists or messages; nothing posted into a community or group that has not asked him to speak; rooms are guest seats only this year, never hosted; no paid media; no scarcity.`
  ].filter(Boolean).join(' ').slice(0, 2000);
}
export const RECOVERY_CONTEXT = 'The founder has 20 minutes a day to send. An assistant sends visibility pitches. The engine prepares, and every send waits on a press.';

/** The diverge body. Pure. */
export function divergeBody({ gap }) {
  return { op: 'diverge', problem: recoveryProblem({ gap }), context: RECOVERY_CONTEXT, count: SPARK_COUNT, cliches: [...CLICHES], bannedWords: bannedWords(), target: 'strategy', namespace: NAMESPACE };
}

const str = (v, max = 500) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : null);
/** The sparks of a diverge answer, read tolerantly and ranked; a spark with no title is dropped. Pure. */
export function readSparks(value) {
  const list = Array.isArray(value?.sparks) ? value.sparks : [];
  return list.filter(s => s && typeof s === 'object' && str(s.title)).map((s, i) => ({
    id: str(s.id, 80), rank: Number.isInteger(s.rank) ? s.rank : i + 1,
    title: str(s.title, 200), mechanism: str(s.mechanism, 1200), whyNonObvious: str(s.whyNonObvious, 600), firstStep: str(s.firstStep, 400),
    lens: str(s.lens, 80), kind: str(s.kind, 80), conventionalTwin: str(s.conventionalTwin, 300), survivedAttack: s.survivedAttack
  })).sort((a, b) => a.rank - b.rank);
}

/** The walls a play must not cross, each read from the words of the play. */
export const SPARK_WALLS = Object.freeze([
  ['wall_consent', /\b(?:scrap(?:e|es|ed|ing)|harvest\w*|bought (?:a |an )?(?:email |contact )?lists?|buy(?:ing)? (?:a |an )?(?:email |contact )?lists?|purchased (?:email |contact )?lists?|mass[- ](?:email|dm|message|outreach)\w*|bulk (?:email|dm|message|connect)\w*|auto[- ]?(?:send|dm|message|connect|post|repl)\w*|automatically (?:send|message|dm|connect|post|repl|email)\w*|without (?:asking|their consent|consent|permission|an opt[- ]?in)|cold[- ](?:call|dm|text)\w*)\b/i],
  ['wall_community', /\b(?:post|drop|share|pitch|promot|plug|seed|spam|advertis)\w*\b(?:\W+\w+){0,5}?\W+(?:in|into|across|on|to)\W+(?:\w+\W+){0,3}?(?:communit(?:y|ies)|groups?|forums?|slack|discord|subreddits?|reddit|whatsapp|alumni networks?|member director(?:y|ies))\b/i],
  ['wall_hosted_room', /\bhost(?:s|ed|ing)?\s+(?:(?:a|an|his|our|their|your|the|own|small|private|monthly|weekly)\s+){0,3}(?:\w+\s+){0,2}?(?:rooms?|dinners?|roundtables?|round tables?|salons?|breakfasts?|webinars?|events?|summits?|meetups?|workshops?|masterclass(?:es)?|retreats?)\b/i],
  ['wall_paid_media', /\b(?:paid (?:ads?|media|promotion|placements?|social)|ad spend|boost(?:ed|ing)? (?:a |the |his )?posts?|sponsor(?:ed|ing|ship)|advertis(?:e|ing|ement))\b/i],
  ['wall_scarcity', /\b(?:limited (?:time|spots|seats|places|offer)|only \d+ (?:spots|seats|places)|first \d+ (?:people|leaders|buyers)|while (?:stocks?|it|they) lasts?|fomo|countdown)\b/i],
  ['wall_impersonation', /\b(?:posing as|pretend(?:ing)? to be|as if (?:he|the founder) wrote)\b/i]
]);
const DASH = /[\u2013\u2014]/;
const NAME_SLIP = /\b(?:MindMake|Mind Make|Mind-Make|Mindmaker)\b/;

/** The words of a play as one text. Pure. */
export const sparkText = s => [s.title, s.mechanism, s.whyNonObvious, s.firstStep].filter(Boolean).join(' ');

/** Every wall and lint finding on one spark, as codes; [] when it passes. The banned words go to Control Center with the ask, which applies them. Pure. */
export function sparkFindings(spark) {
  const text = sparkText(spark);
  const out = SPARK_WALLS.filter(([, re]) => re.test(text)).map(([code]) => code);
  if (spark.survivedAttack === false) out.push('attack_failed');
  if (DASH.test(text)) out.push('lint_dash');
  if (NAME_SLIP.test(text)) out.push('lint_name');
  return out;
}

const cut = (text, max) => { const s = String(text).replace(/\s+/g, ' ').trim(); return s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`; };

/** The one recovery ask: a strategy proposal behind its wall, carrying the play and where it came from. Pure. */
export function recoveryProposal({ spark, runId, weekOf, expiresAt, gap = null }) {
  return {
    proposal_id: `${RECOVERY_PREFIX}${weekOf}`,
    title: cut(`A recovery play for the number: ${spark.title}`, 160),
    why: cut(`${gap ? `${gap} ` : ''}At this urgency the engine proposes unconventional recovery plays. This one passed the engine's own walls and lint; ${spark.whyNonObvious ?? 'it is not one of the usual moves'} Change it first to redirect it, Clear to have the engine plan it, or Purge to drop it. Nothing is sent, posted or spent by this answer.`, 1000),
    kind: 'advice', wall: 'strategy', objective_key: 'good_meetings',
    exact_payload: JSON.stringify({ week_of: weekOf, gap, play: { title: spark.title, mechanism: spark.mechanism, first_step: spark.firstStep, why_non_obvious: spark.whyNonObvious, kind: spark.kind, lens: spark.lens, conventional_twin: spark.conventionalTwin }, your_call: null }, null, 2),
    evidence: [{ label: cut(`divergent-thinker spark ${spark.id ?? spark.rank}, run ${runId}`, 500), url: null }],
    close_condition: { event: 'recovery_play_answered', reference: `week:${weekOf}` },
    expires_at: expiresAt
  };
}

/** A spark kept in the report's lines instead of on his list. Pure. */
export const noteLine = (spark, n) => cut(`Recovery play ${n} (${spark.kind ?? 'unlabelled'}, kept in the notes): ${spark.title}.${spark.firstStep ? ` First step: ${spark.firstStep}` : ''}`, 500);

const linesOf = r => (Array.isArray(r?.activity) ? r.activity.map(a => (typeof a === 'string' ? a : a?.line ?? '')) : []);
/** The recent report whose marker line says it consulted for this week, or null. Pure. */
export function markedThisWeek(recent, marker, weekOf) {
  for (const r of Array.isArray(recent) ? recent : []) if (linesOf(r).some(l => marker.test(l) && l.includes(`week of ${weekOf}`))) return r;
  return null;
}

/** A failed consult said by its code only, never a body. Pure. */
export function failureLine(prefix, e) {
  const code = typeof e?.code === 'string' ? e.code : null;
  if (e?.status === 429) return `${prefix}Control Center's daily cap was reached (${code ?? 'cap'}), so none were asked this run.`;
  if (e?.status === 503) return `${prefix}not available this run (${code ?? 'unavailable'}), so none were asked.`;
  if (e?.status === 409) return `${prefix}Control Center holds the engine, so none were asked.`;
  return `${prefix}could not be asked this run${code ? ` (${code})` : ''}; nothing is assumed.`;
}

/**
 * Rule 5 at U4 and U5. Returns { proposal, lines, outcome }: at most one ask, the
 * report's lines and a quiet outcome. `finish` gives the proposal its digest.
 */
export async function recoveryStep({ cc, capabilities, mode, held, urgency, proposals = [], decisions, recent, weekOf, gap = null, expiresAt = null, finish = p => p }) {
  const none = (reason, lines = []) => ({ proposal: null, lines, outcome: { served: divergentServed(capabilities), recovery: reason } });
  if (!divergentServed(capabilities)) return { proposal: null, lines: [], outcome: { served: false, not_served: 1 } };
  if (!Number.isInteger(urgency) || urgency < URGENT) return none('not_urgent');
  if (held) return none('held');
  const id = `${RECOVERY_PREFIX}${weekOf}`;
  if (!Array.isArray(decisions)) return none('decisions_unread');
  if (decisions.some(d => d?.proposal_id === id)) return none('answered');
  if (proposals.some(p => p?.wall === 'strategy' && p.proposal_id !== id)) return none('other_ask');
  if (recent === null || recent === undefined) return none('history_unread', ["Recovery plays: not asked, because this engine's recent reports could not be read and a play may already be on his list this week."]);
  const before = markedThisWeek(recent, RECOVERY_LINE, weekOf);
  if (before) {
    const notes = linesOf(before).filter(l => /^Recovery play \d/.test(l));
    try {
      const stored = await cc.readReport(before.run_id);
      const kept = (stored?.report?.proposals ?? []).find(p => p?.proposal_id === id) ?? null;
      return { proposal: kept, lines: [`Recovery plays: ${kept ? "this week's play is kept on his list unchanged" : 'none passed this week'}; divergent-thinker is not asked again for the week of ${weekOf}.`, ...notes], outcome: { served: true, recovery: kept ? 'carried' : 'none_this_week' } };
    } catch { return none('carry_unread', [`Recovery plays: this week's report could not be read back, so its play is not carried and divergent-thinker is not asked again for the week of ${weekOf}.`]); }
  }
  if (mode !== 'live') return none('not_live');
  let answer;
  try { answer = await cc.divergent(divergeBody({ gap })); }
  catch (e) { return none(`failed_${e?.status ?? 'unknown'}`, [failureLine('Recovery plays: ', e)]); }
  const runId = str(answer?.runId, 120) ?? 'unrecorded';
  const sparks = readSparks(answer);
  const codes = new Map(), pass = [];
  for (const s of sparks) {
    const found = sparkFindings(s);
    if (found.length) { for (const c of found) codes.set(c, (codes.get(c) ?? 0) + 1); continue; }
    pass.push(s);
  }
  let proposal = null, first = null;
  for (const s of pass) {
    const p = finish(recoveryProposal({ spark: s, runId, weekOf, expiresAt, gap }));
    if (guardLint(p, { people: new Map() }).length) { codes.set('lint_guard', (codes.get('lint_guard') ?? 0) + 1); continue; }
    proposal = p; first = s; break;
  }
  const rest = pass.filter(s => s !== first);
  const heldBy = [...codes].map(([c, n]) => `${c.replace(/_/g, ' ')} ${n}`).join(', ');
  const marker = `Recovery plays: divergent-thinker run ${runId} for the week of ${weekOf}: ${sparks.length} spark${sparks.length === 1 ? '' : 's'}, ${pass.length} passed the engine's walls and lint${heldBy ? `, held by ${heldBy}` : ''}; ${proposal ? 'the first is on his list as one strategy ask' : 'none is on his list'}.`;
  return { proposal, lines: [cut(marker, 500), ...rest.map((s, i) => noteLine(s, i + 2))], outcome: { served: true, recovery: proposal ? 'proposed' : 'none_passed', sparks: sparks.length, passed: pass.length } };
}

// ── The consensus map for the week's one change ──

/** The consensus views of a map answer, read tolerantly: strings or objects with a title. Pure. */
export function readConsensus(value) {
  const list = Array.isArray(value?.consensus) ? value.consensus : Array.isArray(value?.map?.consensus) ? value.map.consensus : [];
  return list.map(c => (typeof c === 'string' ? str(c, 300) : str(c?.title, 300) ?? str(c?.idea, 300))).filter(Boolean).slice(0, 30);
}
export const consensusProblem = () => `The one change a growth team would make this week to get a founder more good meetings with senior leaders.${THESIS ? ` Context: ${THESIS}.` : ''}`;

/** Once a London week, the week's one change read against the mapped consensus. One line at most, never an ask. */
export async function consensusStep({ cc, capabilities, mode, held, change, recent, weekOf }) {
  if (!divergentServed(capabilities)) return { lines: [], outcome: { served: false, not_served: 1 } };
  const none = reason => ({ lines: [], outcome: { served: true, consensus: reason } });
  if (typeof change !== 'string' || !change.trim()) return none('no_change');
  if (held) return none('held');
  if (recent === null || recent === undefined) return none('history_unread');
  if (markedThisWeek(recent, CONSENSUS_LINE, weekOf)) return none('done_this_week');
  if (mode !== 'live') return none('not_live');
  const problem = consensusProblem();
  let views;
  try { views = readConsensus(await cc.divergent({ op: 'map', problem, namespace: NAMESPACE })); }
  catch (e) { return { lines: [failureLine(`Consensus map: for the week of ${weekOf}, `, e)], outcome: { served: true, consensus: `failed_${e?.status ?? 'unknown'}` } }; }
  if (!views.length) return { lines: [`Consensus map: for the week of ${weekOf}, the map came back empty, so the week's change was not compared.`], outcome: { served: true, consensus: 'empty' } };
  let verdict;
  try {
    const scored = await cc.divergent({ op: 'score', problem, ideas: [change.slice(0, 500)], obvious: views, namespace: NAMESPACE });
    const r = Array.isArray(scored?.results) ? scored.results[0] : null;
    verdict = r?.outsideConsensus === true ? 'outside the consensus' : r?.outsideConsensus === false ? `inside the consensus, so it repeats a default (${typeof r.status === 'string' ? r.status : 'scored'})` : 'not scored';
  } catch (e) { verdict = `not scored (${typeof e?.code === 'string' ? e.code : 'error'})`; }
  return { lines: [cut(`Consensus map: for the week of ${weekOf}, the week's one change read against ${views.length} consensus view${views.length === 1 ? '' : 's'}: ${verdict}. A note only, never an ask.`, 500)], outcome: { served: true, consensus: verdict.startsWith('outside') ? 'outside' : verdict.startsWith('inside') ? 'inside' : 'unscored' } };
}

// ── The score guard on openings (scripts/reader.mjs, shadow only) ──

/** The fixed generic openers in config/pitch-openers.json. */
export function genericOpeners() {
  try { const v = JSON.parse(read('config/pitch-openers.json')); return Array.isArray(v.openers) ? v.openers.filter(o => typeof o === 'string' && o.trim()).slice(0, 30) : []; } catch { return []; }
}
const GREETING = /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b[^\n]*$/i;
/** The opening sentence of an email body: the first line after a greeting, cut at its first full stop. Pure. */
export function openingOf(body) {
  const lines = String(body ?? '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  const first = lines.find(l => !GREETING.test(l));
  if (!first) return null;
  const m = /^(.+?[.!?])(?:\s|$)/.exec(first);
  return (m ? m[1] : first).slice(0, 500);
}
/** The openings of every email draft in a report, by box (Jonny's pitches, his own morning drafts). Pure. */
export function draftOpenings(proposals) {
  const out = [];
  for (const p of Array.isArray(proposals) ? proposals : []) {
    let a; try { a = JSON.parse(p?.exact_payload ?? 'null'); } catch { continue; }
    if (a?.version !== 2 || a.channel !== 'email') continue;
    const opening = openingOf(a.body);
    if (opening) out.push({ proposal_id: p.proposal_id, box: a.mailbox === 'jonny' ? 'jonny' : 'krish', opening });
    if (out.length >= 100) break;
  }
  return out;
}
export const scoreBody = openings => ({ op: 'score', problem: 'The opening line of an email to a senior leader or a show booker that earns a reply.', ideas: openings.map(o => o.opening), obvious: genericOpeners(), namespace: PITCH_NAMESPACE });
/** Shadow counts by box from a score answer: how many openings read as generic. Counts only. Pure. */
export function guardCounts(openings, value) {
  const results = Array.isArray(value?.results) ? value.results : [];
  const counts = {};
  openings.forEach((o, i) => {
    const c = counts[o.box] ??= { read: 0, generic: 0, other_rejected: 0, accepted: 0, unscored: 0 };
    c.read++;
    const s = results[i]?.status;
    if (s === 'accepted') c.accepted++; else if (s === 'rejected_gravity') c.generic++; else if (typeof s === 'string') c.other_rejected++; else c.unscored++;
  });
  return counts;
}
export const guardLine = counts => `Score guard, in shadow: ${Object.entries(counts).map(([box, c]) => `${box === 'jonny' ? "Jonny's pitches" : 'his morning drafts'} ${c.read} read, ${c.generic} generic, ${c.accepted} accepted${c.other_rejected ? `, ${c.other_rejected} otherwise rejected` : ''}${c.unscored ? `, ${c.unscored} unscored` : ''}`).join('; ') || 'no email openings to read'}. Nothing is held by it.`;
