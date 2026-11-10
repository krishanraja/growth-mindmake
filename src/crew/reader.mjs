/**
 * The Reader Check (Ruling, Krish, 2026-11-10): before a draft reaches his
 * rows, a fresh reader who knows only what the card says about them reads the
 * exact words and says whether they would reply within a week, which link of
 * the persuasion chain breaks (docs/playbooks/10-copy-and-offer-doctrine.md,
 * "Diagnose the weakest link first"), and whether they would feel remembered
 * or worked. The method is the buyer panel of the founder-skill repository
 * (MIT), rebuilt for this engine: readers are built from the card, never
 * invented, and every verdict is later scored against what happened.
 *
 * What it never is: evidence, a reply, a testimonial, a count toward the
 * number, or a hold. It runs in shadow. It earns weight only when its
 * predictions beat chance on real sends (`calibrate`), and is retired when
 * they do not (docs/playbooks/07-scorecard-and-experiments.md, "The reader
 * check").
 *
 * The verdicts come from fresh-context sub-agents in a Claude session, one per
 * brief, never from the session that wrote the draft and never typed by it
 * (scripts/reader.mjs). This module is pure: briefs in, answers checked,
 * counts out.
 */
import { createHash } from 'node:crypto';
import { actionOf } from './lints/grammar.mjs';

/** The nine links of the persuasion chain, and none. */
export const LINKS = Object.freeze(['relevance', 'attention', 'desire', 'difference', 'belief', 'value', 'safety', 'timing', 'action', 'none']);
/** How the reader felt: his Network Steward's lens, asked of every reader. */
export const FEELS = Object.freeze(['remembered', 'worked', 'neither']);
/** Rows whose reader books guests or speakers rather than being written to as a person. */
const BOOKER_ROWS = new Set(['visibility', 'events']);
/** At most this many drafts a run: one sub-agent each. */
export const MAX_PER_RUN = 20;
export const DEFAULT_PER_RUN = 10;
/** The pre-registered stop rule (07, "The reader check"). */
export const CALIBRATION = Object.freeze({ min_matured: 20, min_replies: 3, mature_days: 7, lift: 2 });

const DAY = 86400000;
const sha = text => createHash('sha256').update(String(text)).digest('hex');
const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The reader a proposal is written to: `booker` for a show or stage, else `recipient`. Pure. */
export function roleOf(p) {
  const a = actionOf(p);
  return BOOKER_ROWS.has(p?.row) || a?.mailbox === 'jonny' ? 'booker' : 'recipient';
}

/** The draft a reader sees: the subject and the body exactly as they would arrive, or null when the proposal sends no words. Pure. */
export function draftOf(p) {
  const a = actionOf(p);
  if (!a) return null;
  const body = str(a.body);
  if (!body) return null;
  return { subject: str(a.subject) ?? '', body };
}

/**
 * What is true about the reader: only the card's own lines (who, what is
 * known between them, why now), never an invented age, income or habit. An
 * empty list means the card says nothing about them, and no brief is made. Pure.
 */
export function readerFacts(card) {
  if (!card || typeof card !== 'object') return [];
  return [card.who, card.known, ...(Array.isArray(card.why) ? card.why : [])].map(str).filter(Boolean);
}

/** The drafts this run reads, in report order: proposals with words and a card with facts, at most `n`. Pure. */
export function selectDrafts(proposals, n = DEFAULT_PER_RUN) {
  const cap = Math.max(1, Math.min(MAX_PER_RUN, Number.isInteger(n) ? n : DEFAULT_PER_RUN));
  const out = [];
  for (const p of Array.isArray(proposals) ? proposals : []) {
    if (out.length >= cap) break;
    if (typeof p?.proposal_id !== 'string' || !p.row) continue;
    const draft = draftOf(p);
    const facts = readerFacts(p.card);
    if (!draft || !facts.length) continue;
    out.push({ proposal_id: p.proposal_id, subject_ref: str(p.subject_ref), row: p.row, role: roleOf(p), facts, draft });
  }
  return out;
}

const ROLE_LINE = {
  recipient: 'You are the person this email is written to. You are senior and busy, and most emails like this one go unanswered.',
  booker: 'You book the guests or speakers for the show or event this email is about. You get many pitches a week and say yes to few.'
};

/** One reader's brief: who they are (card facts only), the exact draft, and the JSON to write. Pure. */
export function briefFor(item, out) {
  const facts = item.facts.map(f => `- ${f}`).join('\n');
  return `You are one reader in a check of a draft email, before anyone decides to send it. Your answer is only useful if it is honest: a polite yes is worse than a clear no.

=== WHO YOU ARE ===
${ROLE_LINE[item.role]}
These lines are everything known about you. Do not invent anything else about yourself, the sender or their business.
${facts}
=== END ===

=== THE EMAIL, EXACTLY AS IT WOULD ARRIVE ===
Subject: ${item.draft.subject}

${item.draft.body}
=== END ===

Decide as this person would, in a normal week. Do not be agreeable.

Create the file ${out} with your file-writing tool (do not just print it in your reply) containing ONLY this JSON, no markdown fence, nothing else:
{
  "id": "${item.proposal_id}",
  "replies": true or false (would you reply within 7 days),
  "reply": "what you would write back, in one or two sentences, or empty if you would not reply",
  "weakest_link": one of ${JSON.stringify(LINKS)} (the part of the email that most stops you replying: relevance is it for me, attention why notice it, desire do I want the result, difference why this, belief will it work, value is it worth my time, safety what if it goes wrong, timing why now, action what exactly do I do; none if nothing does),
  "why": "the one line of the email that decided it, quoted, and why, in one sentence",
  "feels": one of ${JSON.stringify(FEELS)} (did it make you feel remembered as a person, or worked as a target)
}
`;
}

/** The digest of one brief's inputs, so a changed draft or card is a new prediction. Pure. */
export const briefSha = item => sha(JSON.stringify({ id: item.proposal_id, role: item.role, facts: item.facts, draft: item.draft }));

/**
 * One reader's answer, read by fixed rules. { ok: true, answer } or
 * { ok: false, reason }. Nothing is filled in for a reader. Pure.
 */
export function validAnswer(raw, id) {
  let a = raw;
  if (typeof raw === 'string') {
    const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { a = JSON.parse(t); } catch { return { ok: false, reason: 'not_json' }; }
  }
  if (!a || typeof a !== 'object' || Array.isArray(a)) return { ok: false, reason: 'not_object' };
  if (a.id !== id) return { ok: false, reason: 'wrong_id' };
  if (typeof a.replies !== 'boolean') return { ok: false, reason: 'replies' };
  if (typeof a.reply !== 'string' || a.reply.length > 600 || (a.replies && !a.reply.trim())) return { ok: false, reason: 'reply' };
  if (!LINKS.includes(a.weakest_link)) return { ok: false, reason: 'weakest_link' };
  if (typeof a.why !== 'string' || !a.why.trim() || a.why.length > 600) return { ok: false, reason: 'why' };
  if (!FEELS.includes(a.feels)) return { ok: false, reason: 'feels' };
  return { ok: true, answer: { id: a.id, replies: a.replies, reply: a.reply.trim(), weakest_link: a.weakest_link, why: a.why.trim(), feels: a.feels } };
}

const count = values => { const m = new Map(); for (const v of values) m.set(v, (m.get(v) ?? 0) + 1); return [...m].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0]))); };

/** Counts and codes for one run, never the words: reply rate, weakest links, feels, and readers missing. Pure. */
export function tally(items, answers) {
  const got = items.map(i => answers.get(i.proposal_id)).filter(Boolean);
  return {
    read: items.length,
    answered: got.length,
    missing: items.length - got.length,
    would_reply: got.filter(a => a.replies).length,
    weakest_links: count(got.filter(a => a.weakest_link !== 'none').map(a => a.weakest_link)),
    feels: count(got.map(a => a.feels)),
    by_row: count(items.filter(i => answers.has(i.proposal_id)).map(i => `${i.row}:${answers.get(i.proposal_id).replies ? 'yes' : 'no'}`))
  };
}

/** The one line a run reports: counts and codes only. Pure. */
export function tallyLine(t) {
  const pairs = list => (list.length ? list.map(([k, v]) => `${k} ${v}`).join(', ') : 'none');
  return `Reader check, in shadow: read ${t.read} draft${t.read === 1 ? '' : 's'}, ${t.answered} answered${t.missing ? `, ${t.missing} missing` : ''}; would reply ${t.would_reply} of ${t.answered}; weakest links: ${pairs(t.weakest_links)}; feels: ${pairs(t.feels)}. Simulated readers, never evidence; nothing is held.`;
}

/** A ledger entry: the prediction and its keys, never a word of the draft, the card or the answer. Pure. */
export function ledgerEntry(item, answer, at) {
  return { proposal_id: item.proposal_id, subject_ref: item.subject_ref, row: item.row, role: item.role, brief_sha: briefSha(item), briefed_at: at, replies: answer.replies, weakest_link: answer.weakest_link, feels: answer.feels };
}

/** The ledger with new entries merged in: one per proposal and brief, the first kept. Pure. */
export function mergeLedger(ledger, entries) {
  const out = Array.isArray(ledger) ? [...ledger] : [];
  const seen = new Set(out.map(e => `${e.proposal_id}|${e.brief_sha}`));
  for (const e of entries) { const k = `${e.proposal_id}|${e.brief_sha}`; if (!seen.has(k)) { seen.add(k); out.push(e); } }
  return out;
}

/**
 * What actually happened to one prediction, from the context: `unsent` when
 * he never carried it out, `pending` until 7 days have passed, `unknown`
 * when the reply date is not served, else `replied` or `silent`. Pure.
 */
export function outcomeOf(entry, context, at) {
  const feedback = Array.isArray(context?.feedback) ? context.feedback : [];
  const after = Date.parse(entry.briefed_at ?? '') || 0;
  const f = feedback.find(x => x?.carried_out && (x.proposal_id ? x.proposal_id === entry.proposal_id : x.subject_ref === entry.subject_ref && x.row === entry.row && Date.parse(x.decided_at ?? '') >= after));
  if (!f) return 'unsent';
  const sent = Date.parse(f.decided_at ?? '');
  if (!Number.isFinite(sent)) return 'unknown';
  if (Date.parse(at) - sent < CALIBRATION.mature_days * DAY) return 'pending';
  const people = [...(context?.network ?? []), ...(context?.quiet_ties ?? []), ...(context?.amplifier_candidates ?? [])];
  const id = String(entry.subject_ref ?? '').replace(/^contact:/, '').toLowerCase();
  const person = people.find(c => String(c?.contact_id ?? '').toLowerCase() === id);
  const last = Date.parse(person?.email_last ?? '');
  if (!person || !Number.isFinite(last)) return 'unknown';
  return last > sent && last - sent <= CALIBRATION.mature_days * DAY ? 'replied' : 'silent';
}

/**
 * The calibration: predictions against what happened, over sends at least 7
 * days old. Standing `too_early` until `min_matured` sends and `min_replies`
 * real replies; then `earns_weight` only when the readers beat the majority
 * guess and drafts they said would get a reply were answered at least `lift`
 * times as often as drafts they said would not; else `retire`. Pure.
 */
export function calibrate(ledger, context, at) {
  const rows = (Array.isArray(ledger) ? ledger : []).map(e => ({ e, o: outcomeOf(e, context, at) }));
  const by = k => rows.filter(r => r.o === k).length;
  const matured = rows.filter(r => r.o === 'replied' || r.o === 'silent');
  const replied = matured.filter(r => r.o === 'replied').length;
  const yes = matured.filter(r => r.e.replies), no = matured.filter(r => !r.e.replies);
  const rate = list => (list.length ? list.filter(r => r.o === 'replied').length / list.length : null);
  const correct = matured.filter(r => r.e.replies === (r.o === 'replied')).length;
  const accuracy = matured.length ? correct / matured.length : null;
  const baseline = matured.length ? Math.max(replied, matured.length - replied) / matured.length : null;
  const yesRate = rate(yes), noRate = rate(no);
  let standing = 'too_early';
  if (matured.length >= CALIBRATION.min_matured && replied >= CALIBRATION.min_replies) {
    const lifts = yesRate !== null && (noRate === 0 ? yesRate > 0 : noRate !== null && yesRate >= CALIBRATION.lift * noRate);
    standing = accuracy > baseline && lifts ? 'earns_weight' : 'retire';
  }
  return { predictions: rows.length, unsent: by('unsent'), pending: by('pending'), unknown: by('unknown'), matured: matured.length, replied, accuracy, baseline, reply_rate_when_yes: yesRate, reply_rate_when_no: noRate, standing };
}

/** The calibration as one line: counts and rates, never a person. Pure. */
export function calibrationLine(c) {
  const pct = v => (v === null ? 'unknown' : `${Math.round(v * 100)}%`);
  return `Reader calibration: ${c.predictions} prediction${c.predictions === 1 ? '' : 's'}; ${c.matured} sent 7+ days ago (${c.replied} replied), ${c.pending} pending, ${c.unsent} never sent, ${c.unknown} with no reply date; accuracy ${pct(c.accuracy)} against ${pct(c.baseline)} for the majority guess; replies when it said yes ${pct(c.reply_rate_when_yes)}, when it said no ${pct(c.reply_rate_when_no)}; standing ${c.standing}.`;
}
