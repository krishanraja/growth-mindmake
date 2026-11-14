import { createHash } from 'node:crypto';
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
 *
 * Where the request on file carries its `digest` (protocol 1.26.0,
 * `features.ai_answers_detail`), the run compares the plan's own digest with
 * it instead of the count, and asks again, replacing the request, whenever the
 * two differ (`questionsDigest`, Control Center's definition exactly). The
 * canon's offer must still have been read. Without a digest the count rule
 * above stands. A run that asks says which list it asked for as a short digest
 * mark in its line (`questionsMark`, never a question's words), read back from
 * this engine's recent reports (`askedMarks`): when the request on file still
 * reads otherwise after that exact list was asked for, the run says so and
 * does not ask again until the plan changes, so a digest that never meets
 * never asks every day.
 *
 * AEO's win kits (Ruling, Krish, 2026-11-13: AEO's win kits reach him through
 * each venture's own growth engine) arrive in the same standing, for Mindmake
 * and, in `portfolio[]`, for CTRL, Circle and Pulse. `kitsFor` reads them
 * loosely, best priority first; src/weekly-review.mjs `weeklyAnswerKits` shapes
 * the best of them in memory, and no stage reads them yet. This repository is
 * public, so a kit's words stay in the run's memory and only counts leave it.
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

/** A question as the digest reads it: trimmed, with each run of internal whitespace one space. Pure. */
const digestForm = q => String(q).trim().replace(/\s+/g, ' ');
/** Two strings by Unicode code point, as Python's sort orders them (JavaScript's own sort compares UTF-16 units). Pure. */
export function byCodePoint(a, b) {
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0) - y[i].codePointAt(0);
    if (d) return d;
  }
  return x.length - y.length;
}

/**
 * `request.digest` as Control Center defines it (protocol 1.26.0): the lowercase hex SHA-256 of the
 * questions, each trimmed with its internal whitespace collapsed to one space, sorted by code point, written as
 * compact JSON with non-ASCII left unescaped, UTF-8 encoded. Python's `json.dumps(sorted(...), separators=(',',':'),
 * ensure_ascii=False)` gives the same bytes. Pure.
 */
export function questionsDigest(questions) {
  const list = (Array.isArray(questions) ? questions : []).filter(q => typeof q === 'string').map(digestForm).sort(byCodePoint);
  return createHash('sha256').update(JSON.stringify(list), 'utf8').digest('hex');
}
const DIGEST = /^[0-9a-f]{64}$/;

/** The mark a line carries for the exact list of questions this engine asked for: a short digest, never a question's words. Pure. */
export const questionsMark = questions => `questions ${questionsDigest(questions).slice(0, 12)}`;
const MARK = /\bquestions [0-9a-f]{12}\b/g;

/**
 * The lists this engine already asked for, as the marks its own recent reports carry (`features.recent_reports`,
 * activity lines as strings or `{ line }`); an empty set where none were read. Pure.
 */
export function askedMarks(reports) {
  const out = new Set();
  for (const r of Array.isArray(reports) ? reports : []) {
    for (const a of Array.isArray(r?.activity) ? r.activity : []) {
      const line = typeof a === 'string' ? a : typeof a?.line === 'string' ? a.line : '';
      for (const m of line.match(MARK) ?? []) out.add(m);
    }
  }
  return out;
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
 * Whether this run asks AEO, from the request on file and the request it would make: `first` when none is on file;
 * where the request on file carries a well-formed `digest` (1.26.0), `changed` when the plan's own digest differs
 * from it, `settled` instead when this engine already asked for exactly this list (its mark is in `asked`, read by
 * `askedMarks`) and the request on file still reads otherwise, else null; otherwise `more` when the plan now holds
 * more questions than the one on file counts, else null. A count that is not a whole number, or a digest that is
 * not 64 lowercase hex characters, is never compared, so a misshapen standing never makes a run ask every day. Pure.
 */
export function askFor(onFile, body, asked = null) {
  if (!body) return null;
  if (!onFile) return 'first';
  if (typeof onFile.digest === 'string' && DIGEST.test(onFile.digest)) {
    if (questionsDigest(body.questions) === onFile.digest) return null;
    return asked instanceof Set && asked.has(questionsMark(body.questions)) ? 'settled' : 'changed';
  }
  return Number.isInteger(onFile.questions) && onFile.questions >= 0 && body.questions.length > onFile.questions ? 'more' : null;
}

/**
 * The run's AI-answer lines: the standing, and the request to AEO when none is on file, when the plan's digest
 * differs from the one on file (1.26.0), or, with no digest on file, when the plan has grown past it; only when
 * Control Center takes one (features.ai_answers, a live run). A run that did not read the canon's offer never asks
 * again: its plan would carry the questions a retired offer holds. Where Control Center serves
 * `features.ai_answers_detail` (`detail`), the request says it replaces the one on file (`mode: 'replace'`); before
 * that it carries nothing new. Where the detail is served or the request on file carries a digest, a line that asks
 * ends with the asked list's mark (`questionsMark`), and `reports`, this engine's recent reports, say which lists it
 * already asked for: an exact list asked for once whose digest still differs is not asked again, and the line that
 * says so carries the mark too, so it stays in the recent reports until the plan changes. Never throws.
 */
export async function answersStep({ cc, standing, served, readable = true, detail = false, capabilities, mode, context, canon, reports = null }) {
  if (!served) return [];
  if (!readable) return ['AI answers: Control Center could not read the standing this run, so AEO-Engine was not asked.'];
  const lines = [answersLine(standing)];
  if (mode !== 'live' || capabilities?.features?.ai_answers !== true) return lines;
  const onFile = standing?.request ?? null;
  const body = answersRequest({ context, canon });
  const why = askFor(onFile, body, askedMarks(reports));
  if (!why) return body || onFile ? lines : [...lines, 'No planned question for Mindmake\'s places this run, so AEO-Engine was not asked yet.'];
  if (why !== 'first' && !canon?.offer) return [...lines, 'Mindmake\'s canon was not read this run, so the plan was not compared with the request on file and AEO-Engine was not asked again.'];
  // The mark is a digest, never a question's words: the next run reads it back from this engine's own reports.
  const mark = questionsMark(body.questions);
  if (why === 'settled') return [...lines, `AI answers: the request on file still reads differently from the plan after this engine asked for exactly these questions (${mark}), so AEO-Engine is not asked again until the plan changes.`];
  const marked = detail === true || (typeof onFile?.digest === 'string' && DIGEST.test(onFile.digest)) ? ` (${mark})` : '';
  try {
    const out = await cc.answers(detail === true ? { ...body, mode: 'replace' } : body);
    const asked = plural(Number.isInteger(out?.questions) ? out.questions : body.questions.length, 'of Mindmake\'s planned question');
    return [...lines, why === 'more'
      ? `Asked AEO-Engine again to track ${asked} from its next research run, up from ${onFile.questions} on file${marked}.`
      : why === 'changed'
        ? `Asked AEO-Engine again to track ${asked} from its next research run: the plan's questions differ from the request on file${marked}.`
        : `Asked AEO-Engine to track ${asked} from its next research run${marked}.`];
  } catch {
    return [...lines, 'Could not ask AEO-Engine to track Mindmake\'s planned questions this run; the next run asks again.'];
  }
}

// ── AEO's win kits (protocol 1.26.0, `features.ai_answers_detail`) ──

/** A standing serves at most this many kits (Control Center's cap), and the portfolio at most this many products. */
export const KITS_PER_STANDING = 5;
export const PORTFOLIO_MAX = 10;
const TARGET_KINDS = ['new_page', 'update_page', 'off_site_only'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
/** A trimmed one-line string of at most `max` characters, else null. Pure. */
const str = (v, max = 500) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
/** The strings of a list, each read by `str`, at most `cap`; anything else reads as an empty list. Pure. */
const strs = (v, cap = 20, max = 500) => (Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, cap) : []);
/** The objects of a list, each read by `pick`, at most `cap`; anything else reads as an empty list. Pure. */
const objs = (v, pick, cap = 20) => (Array.isArray(v) ? v.filter(isObj).map(pick).slice(0, cap) : []);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = v => (typeof v === 'boolean' ? v : null);
const whole = v => (Number.isInteger(v) && v >= 0 ? v : null);

/**
 * A page to beat's `features`, as AEO serves them (CitedFeatures in AEO-Engine's src/pipeline/45-pages.ts): an object
 * of scalars, every feature null when the page was not read. Its known fields only; null when it is not an object. Pure.
 */
export function readFeatures(f) {
  if (!isObj(f)) return null;
  return {
    source_type: str(f.source_type, 100), read: bool(f.read), title_matches_question: bool(f.title_matches_question),
    answer_first_words: whole(f.answer_first_words), words: whole(f.words), h2_count: whole(f.h2_count),
    dated: bool(f.dated), server_rendered: bool(f.server_rendered)
  };
}

/** One kit as AEO serves it, read loosely: null when it has no id, or neither a question nor a title. Pure. */
export function readKit(value, product) {
  if (!isObj(value)) return null;
  const kit_id = str(value.kit_id, 200), question = str(value.question, 300), title = str(value.title, 300);
  if (!kit_id || !(question || title)) return null;
  const t = isObj(value.target) ? value.target : null;
  const capsule = isObj(value.capsule) ? value.capsule : {};
  return {
    kit_id, product, v: Number.isInteger(value.v) ? value.v : null, query_id: str(value.query_id, 200), question, title,
    gap_class: str(value.gap_class, 100), priority: num(value.priority),
    target: t ? { kind: TARGET_KINDS.includes(t.kind) ? t.kind : null, url: str(t.url, 2000), host: str(t.host, 300), suggested_path: str(t.suggested_path, 500) } : null,
    capsule: { rules: strs(capsule.rules), must_cover: Array.isArray(capsule.must_cover) ? strs(capsule.must_cover) : null },
    h2s: strs(value.h2s, 20, 300),
    beat: objs(value.beat, b => ({ url: str(b.url, 2000), host: str(b.host, 300), engine: str(b.engine, 50), position: num(b.position), features: readFeatures(b.features) })),
    site_fixes: objs(value.site_fixes, f => ({ gate: str(f.gate, 100), host: str(f.host, 300), url: str(f.url, 2000), fix: str(f.fix, 1000), owner_repo: str(f.owner_repo, 200) })),
    off_site: objs(value.off_site, o => ({ host: str(o.host, 300), url: str(o.url, 2000), source_type: str(o.source_type, 100), engines: strs(o.engines, 10, 50), why: str(o.why, 1000) })),
    verify: isObj(value.verify) ? { engines: strs(value.verify.engines, 10, 50), samples: Number.isInteger(value.verify.samples) ? value.verify.samples : null, success: str(value.verify.success, 500), recheck: str(value.verify.recheck, 100), baseline: value.verify.baseline ?? null } : null,
    evidence: strs(value.evidence, 20, 1000)
  };
}

/**
 * The kits a standing serves, Mindmake's and its portfolio's (`portfolio[]`: CTRL, Circle and Pulse, each a standing
 * of its own), read loosely: a `kits` that is not a list reads as none, a kit read as null is counted in `dropped`,
 * a repeated id is kept once, at most five a standing. Ordered best priority first (a higher number first, a kit
 * with none last), then as served. Never throws. Pure.
 */
export function readKits(standing) {
  const out = { kits: [], dropped: 0, mindmake: 0, portfolio: 0 };
  if (!isObj(standing)) return out;
  const seen = new Set();
  const take = (s, part) => {
    if (!isObj(s) || !Array.isArray(s.kits)) return;
    const product = str(s.product_slug, 100) ?? (part === 'mindmake' ? 'mindmake' : null);
    for (const value of s.kits.slice(0, KITS_PER_STANDING)) {
      const kit = readKit(value, product);
      if (!kit) { out.dropped++; continue; }
      if (seen.has(kit.kit_id)) continue;
      seen.add(kit.kit_id); out.kits.push(kit); out[part]++;
    }
  };
  take(standing, 'mindmake');
  if (Array.isArray(standing.portfolio)) for (const s of standing.portfolio.slice(0, PORTFOLIO_MAX)) take(s, 'portfolio');
  const rank = k => (k.priority === null ? -Infinity : k.priority);
  out.kits = out.kits.map((k, i) => [k, i]).sort(([a, i], [b, j]) => (rank(b) - rank(a)) || i - j).map(([k]) => k);
  return out;
}

/** AEO's win kits for Mindmake and its portfolio, best priority first; none when the standing carries none. Pure. */
export const kitsFor = standing => readKits(standing).kits;
