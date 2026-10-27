/**
 * Card grammar (plan section 3): the lint every row specialist shares.
 *
 * A card line may be built only from typed slots: a name, a title, an
 * organisation, a counted figure with its source, a canon quote, or a record
 * sentence that passes the fact test (factTest in src/stages/rows.mjs, which
 * extends factOf and leadFacts). The stages already filter the record's prose
 * before a card is built; this reads the finished card after, so a live
 * failure shape that slips past a deny-list is still caught. The deny-lists
 * stay as the first net, in the stages.
 *
 * In shadow until the Phase 5 switch: findings are counted and reported, and
 * nothing is held by them. Pure.
 */
import { factTest, factOf, sentences, plain, endsWhole } from '../../stages/rows.mjs';

export const LINTS = ['card_grammar'];

/** The 1.8.0 card fields a line can sit in, in the order he reads them. */
export function cardLines(card) {
  if (!card || typeof card !== 'object') return [];
  const out = [];
  const add = (field, text, title = false) => { if (typeof text === 'string' && text.trim()) out.push({ field, text, title }); };
  add('who', card.who);
  add('known', card.known);
  (Array.isArray(card.why) ? card.why : []).forEach((t, i) => add(`why.${i}`, t));
  (Array.isArray(card.gain) ? card.gain : []).forEach((t, i) => add(`gain.${i}`, t));
  (Array.isArray(card.angles) ? card.angles : []).forEach((a, i) => { add(`angles.${i}.title`, a?.title, true); add(`angles.${i}.line`, a?.line); });
  return out;
}

/** A line with its quotes taken out: a canon quote or a person's own words are theirs, never the engine's. */
export function unquote(text) {
  return String(text ?? '').replace(/"[^"]*"|“[^”]*”/g, '"Q"');
}

const norm = s => plain(s).replace(/[.!?]+$/, '').toLowerCase();
/** Every record sentence, as plain text, from the free-text fields a card may draw on. */
export function recordSentences(records) {
  const out = [];
  for (const r of records) for (const s of sentences(r)) { const n = norm(s); if (n.length >= 12) out.push({ raw: s, n }); }
  return out;
}

const COUNTED = /\b(?:\d[\d,]*|once|twice|\d+ times)\b[^.]*\b(?:emails?|written|wrote)\b|\b(?:written|wrote)\b[^.]*\b(?:once|twice|\d+ times)\b/i;
const NONE_ON_RECORD = /\bno emails?\b/i;
/** A room figure said as followers: "in front of their leaders: 20,000 followers" (F35). */
const FOLLOWERS_AS_ROOM = /\bin front of\b[^:]*:\s*[\d,.]+(?:\s+(?:to|million|thousand)\s*[\d,.]*)*\s+(?:\w+\s+)?followers?\b/i;

/**
 * Card grammar findings for one card: each a line that is not built from
 * typed slots, with the field it sits in and why. `records` are the record's
 * own free-text fields the card was built from (hook, why_them, who, a
 * profile answer, a stage's why_him); a sentence drawn from them must be its
 * fact whole, and every other line must be whole engine sentences. Pure.
 */
export function cardGrammar(card, { records = [] } = {}) {
  const findings = [];
  const facts = recordSentences(records.filter(r => typeof r === 'string'));
  const flag = (field, reason) => { if (!findings.some(f => f.field === field && f.reason === reason)) findings.push({ lint: 'card_grammar', field, reason }); };
  for (const { field, text, title } of cardLines(card)) {
    const open = unquote(text).replace(/\s+/g, ' ').trim();
    if (/[\u2014\u2013]/.test(open)) flag(field, 'dash');
    if (/\.{3}|\u2026/.test(open)) flag(field, 'ellipsis');
    if (/\b[a-z0-9]+_[a-z0-9_]+\b/.test(open)) flag(field, 'slug');
    if (title) continue;
    if (field === 'known' && COUNTED.test(open) && NONE_ON_RECORD.test(open)) flag(field, 'contradiction');
    if (FOLLOWERS_AS_ROOM.test(open)) flag(field, 'reach_as_room');
    for (const s of sentences(open)) {
      if (!endsWhole(s)) { flag(field, 'fragment'); continue; }
      const n = norm(s);
      for (const r of facts) {
        // The card carries a whole record sentence: it must be a fact with nothing cut.
        if (n.includes(r.n)) { const t = factTest(r.raw); if (!t.ok && factOf(r.raw) !== plain(r.raw).replace(/[.!?]+$/, '')) flag(field, t.reason); }
        // The card carries part of one: that part must pass the fact test itself.
        else if (n.length >= 24 && r.n.includes(n)) { const t = factTest(s); if (!t.ok) flag(field, t.reason); }
      }
    }
  }
  return findings;
}

// ── Shared reads over an action ────────────────────────────────────────────

/** The version 2 action a proposal carries, or null. */
export function actionOf(p) { try { const a = JSON.parse(p?.exact_payload ?? 'null'); return a && typeof a === 'object' ? a : null; } catch { return null; } }
/** The words a proposal would send: the subject, the body and any form answers. */
export function wordsOf(p) {
  const a = actionOf(p);
  if (!a) return typeof p?.exact_payload === 'string' ? p.exact_payload : '';
  return [a.subject, a.body, ...(Array.isArray(a.form?.answers) ? a.form.answers.map(x => x?.value) : [])].filter(x => typeof x === 'string').join('\n\n');
}
/** Every https link in a text, trailing punctuation removed. */
export function linksIn(text) { return [...String(text ?? '').matchAll(/https:\/\/[^\s"')<>]+/g)].map(m => m[0].replace(/[.,;:!?]+$/, '')); }
/** Questions asked outside quotes: one ask a message. */
export function questionsIn(text) { return (unquote(text).match(/\?/g) ?? []).length; }
/** The contact a proposal is about, from its subject_ref. */
export function subjectId(p, prefix = 'contact:') { const s = typeof p?.subject_ref === 'string' ? p.subject_ref : ''; return s.startsWith(prefix) ? s.slice(prefix.length) : null; }
/** The record's free-text fields a card may draw on, for card grammar. */
export function recordTexts(c) { return c ? [c.who, c.hook, c.why_them, c.why_him, c.why_now, c.angle, c.audience, c.one_liner, c.why_fit, c.intent_summary, c.headline].filter(x => typeof x === 'string') : []; }
/** One finding. */
export const finding = (lint, p, detail) => ({ lint, proposal_id: p?.proposal_id ?? null, detail });
