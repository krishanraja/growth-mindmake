import { canonDomains, enginePlan } from './places.mjs';

/**
 * Mindmake's AI answers through AEO-Engine, the one AI-answers specialist
 * (protocol 1.22.0; Ruling, Krish, 2026-11-12: "AEO-Engine becomes the one
 * specialist that every venture's growth engine calls for its AI-answer
 * work."). This engine never asks an AI assistant itself.
 *
 * Each run it says Mindmake's standing in one line, read from the directive
 * (`ai_answers`, AEO's fortnightly research), and, when Mindmake has no
 * request on file, asks AEO once (`POST answers`) to track the questions the
 * weekly review plans for Mindmake's places (enginePlan: the best-rated
 * touchpoints' buyer questions, a retired offer held) with the hosts the
 * canon names. That is the plan Control Center's retired Monday probe used
 * to owe (M13's `places`): it now goes to AEO, never into a report. Pure but
 * for the one call, which never fails the run.
 */

const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const day = ymd => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : String(ymd ?? ''); };

/** The directive's ai_answers block, read loosely: its standing, or null when absent or misshapen. Pure. */
export function readAiAnswers(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  const s = block.standing;
  return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
}

/** Mindmake's AI answers in one line, the words Control Center's tile uses. Pure. */
export function answersLine(s) {
  if (!s) return 'AI answers: not tracked yet.';
  if (s.latest) return `AI answers: cited first on ${s.latest.cited_first} of ${plural(s.latest.asked, 'question')}, ${day(s.latest.as_of)}.`;
  if (s.request?.state === 'open') return `AI answers: AEO tracks ${plural(s.request.questions, 'question')} from its next research run.`;
  return s.tracked ? 'AI answers: tracked, not asked yet.' : 'AI answers: not tracked yet.';
}

/** The request for AEO: the planned questions (at most 25) and the canon's hosts, or null when there is nothing to ask. Pure. */
export function answersRequest({ context, canon }) {
  const touchpoints = context?.records?.touchpoints;
  if (!Array.isArray(touchpoints)) return null;
  const questions = [...new Set(enginePlan(touchpoints, canon).planned.map(p => p.question).filter(q => typeof q === 'string' && q.length >= 8 && q.length <= 300))].slice(0, 25);
  if (!questions.length) return null;
  const domains = canonDomains(canon).slice(0, 5);
  return { questions, ...(domains.length ? { domains } : {}) };
}

/**
 * The run's AI-answer lines: the standing, and the request to AEO when none is on file and Control Center takes one
 * (features.ai_answers, a live run). Never throws.
 */
export async function answersStep({ cc, standing, served, capabilities, mode, context, canon }) {
  if (!served) return [];
  const lines = [answersLine(standing)];
  if (standing?.request || mode !== 'live' || capabilities?.features?.ai_answers !== true) return lines;
  const body = answersRequest({ context, canon });
  if (!body) return [...lines, 'No planned question for Mindmake\'s places this run, so AEO-Engine was not asked yet.'];
  try {
    const out = await cc.answers(body);
    return [...lines, `Asked AEO-Engine to track ${plural(out.questions ?? body.questions.length, 'of Mindmake\'s planned question')} from its next research run.`];
  } catch {
    return [...lines, 'Could not ask AEO-Engine to track Mindmake\'s planned questions this run; the next run asks again.'];
  }
}
