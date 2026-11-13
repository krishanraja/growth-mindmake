import { canonDomains, enginePlan } from './places.mjs';

/**
 * Mindmake's AI answers through AEO-Engine, the one AI-answers specialist
 * (protocol 1.22.0; Ruling, Krish, 2026-11-12: "AEO-Engine becomes the one
 * specialist that every venture's growth engine calls for its AI-answer
 * work."). This engine never asks an AI assistant itself.
 *
 * Each run it says Mindmake's standing in one line, read from the directive
 * (`ai_answers`, AEO's fortnightly research), and asks AEO (`POST answers`)
 * to track the questions the weekly review plans for Mindmake's places
 * (enginePlan: the best-rated touchpoints' buyer questions, a retired offer
 * held) with the hosts the canon names: once when Mindmake has no request on
 * file, and again only when the plan now holds more questions AEO's route
 * takes than the request on file counts (a newer request replaces the open
 * one), and that only when the canon was read and its offer parsed: without
 * it the plan no longer holds a question that names a retired offer, its
 * count rises, and a re-ask would put that question on AEO's request for good,
 * since a smaller plan never asks again. A request has its own cap, the protocol's 25, never the twelve of
 * MAX_PROBES_PER_RUN, and the questions are filtered as Control Center
 * filters them, so the count compared is the count it records and a run
 * never asks again for nothing. That is the plan Control Center's retired
 * Monday probe used to owe (M13's `places`): it now goes to AEO, never into a
 * report. Pure but for the one call, which never fails the run.
 */

/** POST answers: at most this many questions a request (protocol 1.22.0). A request's own cap, never MAX_PROBES_PER_RUN. */
export const MAX_REQUEST_QUESTIONS = 25;
/** POST answers: a question is 8 to 300 characters. */
export const MIN_QUESTION_CHARS = 8;
export const MAX_QUESTION_CHARS = 300;
/** Control Center's own test for a buyer question (CONTACT in its src/lib/aiAnswers.ts): never an address, a link or a number. */
const CONTACT = /@|https?:\/\/|www\.|\+?\d[\d\s().-]{7,}\d/i;

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const day = ymd => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : String(ymd ?? ''); };

/** The directive's ai_answers block, read loosely: its standing, or null when absent or misshapen. Pure. */
export function readAiAnswers(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  const s = block.standing;
  return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
}

/**
 * Whether the directive carries a standing this run can read: an `ai_answers` block whose `standing` is null or an
 * object. Protocol 1.22.0 leaves the block out when Control Center could not read the standing, so a missing block
 * never means "no request on file". Pure.
 */
export function aiAnswersReadable(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block) || !('standing' in block)) return false;
  const s = block.standing;
  return s === null || (typeof s === 'object' && !Array.isArray(s));
}

/** Mindmake's AI answers in one line, the words Control Center's tile uses. Pure. */
export function answersLine(s) {
  if (!s) return 'AI answers: not tracked yet.';
  if (s.latest) return `AI answers: cited first on ${s.latest.cited_first} of ${plural(s.latest.asked, 'question')}, ${day(s.latest.as_of)}.`;
  if (s.request?.state === 'open') return `AI answers: AEO tracks ${plural(s.request.questions, 'question')} from its next research run.`;
  return s.tracked ? 'AI answers: tracked, not asked yet.' : 'AI answers: not tracked yet.';
}

/** A question AEO's route takes, as Control Center tests it: 8 to 300 characters, never an address, a link or a number. Pure. */
export function validQuestion(q) {
  return typeof q === 'string' && q.length >= MIN_QUESTION_CHARS && q.length <= MAX_QUESTION_CHARS && !CONTACT.test(q);
}

/**
 * The request for AEO: Mindmake's planned questions that AEO's route takes, at most 25 under the request's own cap,
 * the best-rated places first, and the canon's hosts; or null when there is nothing to ask. Pure.
 */
export function answersRequest({ context, canon }) {
  const touchpoints = context?.records?.touchpoints;
  if (!Array.isArray(touchpoints)) return null;
  const planned = enginePlan(touchpoints, canon, Infinity).planned.map(p => p.question).filter(validQuestion);
  const questions = [...new Set(planned)].slice(0, MAX_REQUEST_QUESTIONS);
  if (!questions.length) return null;
  const domains = canonDomains(canon).slice(0, 5);
  return { questions, ...(domains.length ? { domains } : {}) };
}

/**
 * Whether this run asks AEO, from the request on file and the request it would make: `first` when none is on file,
 * `more` when the plan now holds more questions than the one on file counts, else null. A count that is not a whole
 * number is never compared, so a misshapen standing never makes a run ask every day. Pure.
 */
export function askFor(onFile, body) {
  if (!body) return null;
  if (!onFile) return 'first';
  return Number.isInteger(onFile.questions) && onFile.questions >= 0 && body.questions.length > onFile.questions ? 'more' : null;
}

/**
 * The run's AI-answer lines: the standing, and the request to AEO when none is on file or the plan has grown past the
 * one on file, when Control Center takes one (features.ai_answers, a live run). A run that did not read the canon's
 * offer never asks again: its plan would carry the questions a retired offer holds. Never throws.
 */
export async function answersStep({ cc, standing, served, readable = true, capabilities, mode, context, canon }) {
  if (!served) return [];
  if (!readable) return ['AI answers: Control Center could not read the standing this run, so AEO-Engine was not asked.'];
  const lines = [answersLine(standing)];
  if (mode !== 'live' || capabilities?.features?.ai_answers !== true) return lines;
  const onFile = standing?.request ?? null;
  const body = answersRequest({ context, canon });
  const why = askFor(onFile, body);
  if (!why) return body || onFile ? lines : [...lines, 'No planned question for Mindmake\'s places this run, so AEO-Engine was not asked yet.'];
  if (why === 'more' && !canon?.offer) return [...lines, 'Mindmake\'s canon was not read this run, so the plan was not compared with the request on file and AEO-Engine was not asked again.'];
  try {
    const out = await cc.answers(body);
    const asked = plural(Number.isInteger(out?.questions) ? out.questions : body.questions.length, 'of Mindmake\'s planned question');
    return [...lines, why === 'more'
      ? `Asked AEO-Engine again to track ${asked} from its next research run, up from ${onFile.questions} on file.`
      : `Asked AEO-Engine to track ${asked} from its next research run.`];
  } catch {
    return [...lines, 'Could not ask AEO-Engine to track Mindmake\'s planned questions this run; the next run asks again.'];
  }
}
