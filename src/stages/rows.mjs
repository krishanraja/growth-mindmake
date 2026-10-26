import { seal, clean, DAY } from '../guards.mjs';

/**
 * The five rows on Krish's home screen (protocol 1.6.0, playbook 11).
 *
 * Ruling (Krish, 2026-10-26): every action should make him exponentially more
 * visible. The engine hunts amplifiers (prolific investors, well-connected
 * people, people anywhere with inordinate money who want to shape AI, mass AI
 * trainers, mass student and CEO educators, and mass broadcast and social
 * channels on growing with AI), ranks them by how far a yes travels, writes
 * the words, picks the channel, and learns from every No and its reason.
 * Control Center holds the records and carries out his press; it ranks nothing.
 *
 * Pure: everything comes from the context, the directive and the canon read
 * this run. No model call. Every action names the files it was written from.
 */

export const ROWS = ['reach_out', 'network', 'visibility', 'events', 'partners'];
export const KINDS = ['investor', 'connector', 'ai_capital', 'ai_trainer', 'student_educator', 'ceo_educator', 'broadcaster'];
export const PER_ROW = 6;
export const TITLE_MAX = 72;

/** The ask decides the row. */
export const ASK_FOR = { investor: 'partner', ai_capital: 'partner', ai_trainer: 'partner', connector: 'introduce', broadcaster: 'appear', ceo_educator: 'teach', student_educator: 'teach' };
export const ROW_FOR = { partner: 'partners', introduce: 'reach_out', appear: 'visibility', teach: 'events', relationship: 'network', signal: 'reach_out' };

// Who someone is, from the words on their record. A title is never proof of
// wealth, authority or permission (playbook 03): ai_capital needs a named
// capital vehicle, and nobody is read as rich from a title.
const KIND_WORDS = [
  ['ai_capital', /\b(family office|private office|sovereign (wealth )?fund|strategic investment office|investment office of)\b/i],
  ['investor', /\b(venture capital|ventures?\b|vc\b|angel investor|general partner|managing partner|investment partner|limited partner|fund manager|private equity|growth equity|capital partners)\b/i],
  ['ceo_educator', /\b(executive education|exec ed|vistage|ypo forum|ceo (forum|peer|coach(ing)?|round ?table)|chief executives? (organi[sz]ation|network|club)|institute of directors|board (academy|institute)|leadership (institute|programme|program))\b/i],
  ['student_educator', /\b(professor|lecturer|dean|provost|vice[- ]chancellor|head ?teacher|university|college|business school|school of)\b/i],
  ['ai_trainer', /\b(ai (training|trainer|academy|bootcamp|literacy|upskilling|educator|course)|(learning (and|&) development|l&d|upskilling|corporate training|training) .*\bai\b|\bai\b.*(training|academy|bootcamp|course))/i],
  ['broadcaster', /\b(podcast|host of|presenter|broadcaster|newsletter|editor|journalist|columnist|anchor|youtube|substack|creator)\b/i],
  ['connector', /\b(ypo|entrepreneurs'? organi[sz]ation|\beo\b chapter|chapter (chair|president)|community (founder|lead|builder)|convener|founder of (the )?[a-z ]*(club|network|forum|community|society|collective|dinner|salon)|networking)\b/i],
];
const AI = /\b(ai|artificial intelligence|genai|machine learning)\b/i;

/** Which amplifier kinds a person reads as, from their own words, most specific first. */
export function kindsOf(c) {
  const text = [c.current_title, c.headline, c.contacts?.title, c.who, ...(Array.isArray(c.roles) ? c.roles : [])].filter(x => typeof x === 'string').join(' | ');
  const out = KIND_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
  const plays = Array.isArray(c.plays) ? c.plays : [];
  if ((c.is_creator || c.is_influencer || (Number(c.followers) || 0) >= 50000) && !out.includes('broadcaster')) out.push('broadcaster');
  if ((plays.includes('multiplier') || plays.includes('amplifier')) && !out.length) out.push('connector');
  // A capital vehicle counts as AI-minded capital only with an AI interest on record.
  return out.filter(k => k !== 'ai_capital' || AI.test(`${text} ${c.intent_summary ?? ''}`));
}

// ── Reach ───────────────────────────────────────────────────────────────────

export const BANDS = ['under_1k', '1k_10k', '10k_100k', '100k_1m', 'over_1m', 'unknown'];
const ORDER = { unknown: 0, under_1k: 1, '1k_10k': 2, '10k_100k': 3, '100k_1m': 4, over_1m: 5 };
const MID = { unknown: 100, under_1k: 300, '1k_10k': 3000, '10k_100k': 30000, '100k_1m': 300000, over_1m: 3000000 };
export function bandOf(n) { return n < 1000 ? 'under_1k' : n < 10000 ? '1k_10k' : n < 100000 ? '10k_100k' : n < 1000000 ? '100k_1m' : 'over_1m'; }

/** The first count in a cited answer, with what it counts. "about 35,000 chief executives" gives 35000. */
export function countIn(text) {
  const m = /(\d[\d,.]*)\s*(k|m|thousand|million|bn|billion)?\+?\s+([a-z][a-z -]{2,40})/i.exec(String(text || ''));
  if (!m) return null;
  const base = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;
  const mult = /^(k|thousand)$/i.test(m[2] ?? '') ? 1e3 : /^(m|million)$/i.test(m[2] ?? '') ? 1e6 : /^(bn|billion)$/i.test(m[2] ?? '') ? 1e9 : 1;
  const value = Math.round(base * mult);
  return value >= 10 ? { value, counts: m[3].trim().split(/\s+/).slice(0, 3).join(' ') } : null;
}

/** How far a yes travels: a cited figure from research, else a band from followers, else unknown. Never a guess. */
export function reachOf(c, research) {
  const asked = research.find(r => r.kind === 'question' && r.status === 'answered' && typeof r.request_id === 'string' && r.request_id.startsWith(`reach:${c.contact_id}:`));
  const n = asked ? countIn(asked.answer) : null;
  const url = asked?.evidence?.find(e => /^https:\/\//.test(e?.url ?? ''))?.url ?? null;
  if (n && url && asked.answered_at) return { value: n.value, band: bandOf(n.value), basis: clean(`${n.counts}, from a cited answer`).slice(0, 200), source_url: url, as_of: new Date(asked.answered_at).toISOString() };
  const f = Number(c.followers);
  if (Number.isFinite(f) && f > 0) return { value: null, band: bandOf(f), basis: 'followers on their profile, as Control Center last read it', source_url: null, as_of: null };
  return { value: null, band: 'unknown', basis: 'not yet researched', source_url: null, as_of: null };
}

// ── What he said No to, and why ─────────────────────────────────────────────

/**
 * Every answer he has given, applied for good (no decay), so a No is never
 * offered again and a reason reaches what is like it:
 *   wrong_person, already_in_touch  never this person again, on any row
 *   not_now                         not this person for 30 days
 *   too_small                       nothing of that kind below the next band up
 *   wrong_audience                  not that kind in that sector
 *   not_my_topic                    not that topic
 *   pitch_off                       the words for that row change; repeated, a doctrine review
 *   any No                          never this person on that row again
 *   carried out                     not this person for 30 days: he has just acted
 */
export function lessons(feedback, at) {
  const now = Date.parse(at);
  const L = { never: new Set(), notOnRow: new Set(), until: new Map(), floor: new Map(), audiences: new Set(), topics: new Set(), pitchOff: new Map() };
  const snooze = (s, days, from) => { const t = Date.parse(from ?? at) + days * DAY; if (t > now && t > (L.until.get(s) ?? 0)) L.until.set(s, t); };
  for (const f of Array.isArray(feedback) ? feedback : []) {
    const s = typeof f?.subject_ref === 'string' ? f.subject_ref : null;
    if (f?.carried_out && s) snooze(s, 30, f.decided_at);
    if (f?.state !== 'declined') continue;
    if (s && f.row) L.notOnRow.add(`${f.row}|${s}`);
    const kind = f.amplifier_kind ?? null, sector = f.features?.sector ?? null, topic = f.features?.topic ?? null;
    switch (f.reason_code) {
      case 'wrong_person': case 'already_in_touch': if (s) L.never.add(s); break;
      case 'not_now': if (s) snooze(s, 30, f.decided_at); break;
      case 'too_small': if (kind) L.floor.set(kind, Math.max(L.floor.get(kind) ?? 0, ORDER[f.reach?.band ?? 'unknown'] + 1)); break;
      case 'wrong_audience': if (kind) L.audiences.add(`${kind}|${sector}`); break;
      case 'not_my_topic': if (topic) L.topics.add(topic); break;
      case 'pitch_off': if (f.row) L.pitchOff.set(f.row, (L.pitchOff.get(f.row) ?? 0) + 1); break;
      default: break;
    }
  }
  return L;
}

/** Why a candidate is left out under what he has said, or null. */
export function refusedBy(L, { subject, row, kind, sector, topic, band }, at) {
  if (L.never.has(subject)) return 'declined_person';
  if (L.notOnRow.has(`${row}|${subject}`)) return 'declined_on_row';
  if ((L.until.get(subject) ?? 0) > Date.parse(at)) return 'snoozed';
  if (kind && ORDER[band] < (L.floor.get(kind) ?? 0)) return 'below_reach_floor';
  if (kind && (L.audiences.has(`${kind}|${sector}`) || L.audiences.has(`${kind}|null`))) return 'wrong_audience';
  if (topic && L.topics.has(topic)) return 'not_my_topic';
  return null;
}

// ── Rank, goals, channels ───────────────────────────────────────────────────

/** How well each kind reaches his buyer: leaders who decide (playbook 11). */
export const FIT = { ceo_educator: 1.3, connector: 1.2, investor: 1.15, ai_capital: 1.1, broadcaster: 1.0, ai_trainer: 0.9, student_educator: 0.75 };
const ROUTE = { email_verified: 1, email_unchecked: 0.85, whatsapp: 0.9, x_message: 0.6 };
const GOAL_WORDS = { partners: /partner/i, visibility: /visib|audience|podcast|media|stage/i, events: /event|speak|talk|stage|room/i, reach_out: /warm lead|one-?pager|offer|lead|intro/i, network: /warm|network|relationship|reconnect/i };

/** The week goal this row serves, word for word, or null. */
export function servesOf(row, weekGoals) {
  return (Array.isArray(weekGoals) ? weekGoals : []).find(g => typeof g === 'string' && GOAL_WORDS[row].test(g)) ?? null;
}

/** The channel to use: an address first, WhatsApp only where Control Center says he is close, then X. None means no row. */
export function channelOf(routes, row) {
  if (!routes) return null;
  if (routes.email === 'verified') return { channel: 'email', weight: ROUTE.email_verified };
  if (routes.email === 'unchecked') return { channel: 'email', weight: ROUTE.email_unchecked };
  if (routes.whatsapp && row === 'network') return { channel: 'whatsapp', weight: ROUTE.whatsapp };
  if (routes.x) return { channel: 'x_message', weight: ROUTE.x_message };
  return null;
}

/** log10 of reach, times fit, route, goal and closeness. A 1M channel ranks above a 1k one by log, never by a factor of a thousand. */
export function score({ band, value }, fit, route, goal, close) {
  return Math.log10(Math.max(10, value ?? MID[band])) * fit * route * (goal ? 1.25 : 1) * (close ? 1.3 : 1);
}

const SENIOR = [['c_suite', /\b(chief|ceo|cfo|coo|cto|cmo|cro|chro|founder|co-founder|president|owner|chair(man|woman|person)?|managing director|general partner|managing partner)\b/i], ['senior', /\b(vp|vice president|director|head of|partner|principal|lead|general manager|dean|professor|editor)\b/i]];
export function seniorityOf(text) { return (SENIOR.find(([, re]) => re.test(String(text || '')))?.[0]) ?? 'other'; }
const word = x => { const w = String(x ?? '').toLowerCase().replace(/[^a-z0-9_ -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 59); return /^[a-z]/.test(w) ? w : null; };

// ── Words ───────────────────────────────────────────────────────────────────

const first = name => clean(name).split(' ')[0] || 'there';
const cutAt = (s, max) => { const t = clean(s); if (t.length <= max) return t; const c = t.slice(0, max - 3); return `${c.slice(0, c.lastIndexOf(' ') > 20 ? c.lastIndexOf(' ') : c.length)}...`; };
const lower1 = s => s.charAt(0).toLowerCase() + s.slice(1);
/** The first title that fits his phone whole. */
export function fitTitle(...options) { return options.map(clean).find(t => t && t.length <= TITLE_MAX) ?? cutAt(options.at(-1), TITLE_MAX); }

/**
 * The words for each ask, in Krish's own name from his own mailbox (krish-voice,
 * outbound email): the first sentence is the point, one question, contractions,
 * active voice, no invented feeling or familiarity, no em dash, British English,
 * and Mindmake only in the canon's own words read this run (01_CANON.md, "What
 * the growth engine may say"). A pitch_off on a row moves it to its other words.
 */
export const WORDS = {
  partner: [
    (p, canon) => p.kind === 'ai_trainer'
      ? { subject: 'Your AI training and what comes after it', lines: [
        `You train people to use AI. At Mindmake we build what comes after, one leader at a time: ${lower1(canon.brain)}`,
        'Worth a short call to see if the two fit?',
      ] }
      : { subject: 'A session for the leaders you back', lines: [
        `At Mindmake we build AI that knows the leader using it: ${lower1(canon.brain)}`,
        "Would a working session for the leaders you back be useful? I'd build it around one decision each of them faces.",
      ] },
    (p, canon) => ({ subject: 'One idea for the leaders you work with', lines: [
      `The short version of what we do at Mindmake: ${lower1(canon.brain)}`,
      "Worth a short call on whether it's useful to the leaders you work with?",
    ] }),
  ],
  introduce: [
    () => ({ subject: 'One introduction, if it fits', lines: [
      "Do you know one leader who's working out what AI should do for them, and would want to talk it through?",
      "An introduction would mean a lot. I'll take it from there.",
    ] }),
    (p, canon) => ({ subject: 'A small ask', lines: [
      `At Mindmake we build AI that knows the leader using it: ${lower1(canon.brain)}`,
      "Know one leader who'd want that? A short intro is all I'd ask.",
    ] }),
  ],
  appear: [
    () => ({ subject: 'An idea for your audience', lines: [
      'Would you have me on to talk about one question: what should an AI that knows a leader actually do?',
      "I'll keep it practical, with one real decision worked through.",
    ] }),
    (p, canon) => ({ subject: 'A conversation for your audience', lines: [
      `At Mindmake we build AI that knows the leader using it: ${lower1(canon.brain)}`,
      'Would a conversation on that work for your audience?',
    ] }),
  ],
  teach: [
    p => ({ subject: `A session for your ${p.kind === 'student_educator' ? 'students' : 'leaders'}`, lines: [
      `Would a session for your ${p.kind === 'student_educator' ? 'students' : 'leaders'} on building an AI that knows them be useful?`,
      "I'd build it around one decision they face, worked through live.",
    ] }),
    (p, canon) => ({ subject: `An idea for your ${p.kind === 'student_educator' ? 'students' : 'leaders'}`, lines: [
      `At Mindmake we build AI that knows the leader using it: ${lower1(canon.brain)}`,
      `Would a short session on that work for your ${p.kind === 'student_educator' ? 'students' : 'leaders'}?`,
    ] }),
  ],
  relationship: [
    () => ({ subject: 'Catching up', lines: [
      "Been a while. Keen to hear what you're working on.",
      'Up for a call in the next few weeks?',
    ] }),
    () => ({ subject: 'Coffee?', lines: [
      "Been a while. Up for a coffee or a call soon? I'd like to hear what you're seeing.",
    ] }),
  ],
};

/** The exact version 2 action for one person: Control Center fills the address from its own records when he presses. */
export function actionFor(channel, contactId, name, words) {
  const greeting = `Hi ${first(name)},`;
  // Signed plainly. A Gmail draft made through the API carries no automatic signature.
  if (channel === 'email') return { version: 2, channel, recipient_contact_id: contactId, subject: clean(words.subject).slice(0, 200), body: [greeting, ...words.lines.map(clean), 'Krish'].join('\n\n') };
  // A message has no subject and no signature.
  return { version: 2, channel, recipient_contact_id: contactId, body: [greeting, ...words.lines.map(clean)].join('\n\n').slice(0, 1000) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One row proposal, shaped as dispatch's finishProposal expects. */
export function rowProposal({ row, ask, contactId, name, title, why, action, reach, kind, features, serves, files, evidence, at }) {
  return {
    proposal_id: `gmw-${seal({ subject: contactId, row, ask }).slice(0, 32)}`,
    title, why: clean(why).slice(0, 1000), kind: 'prepared', wall: 'send', channel: action.channel, amount_usd: 0,
    objective_key: 'qualified_conversations', exact_payload: JSON.stringify(action), target: contactId,
    evidence: evidence.slice(0, 12), close_condition: { event: 'outreach_sent', reference: `${row}:${ask}` },
    expires_at: new Date(Date.parse(at) + 14 * DAY).toISOString(), stage: null, parent_proposal_id: null,
    row, reach, amplifier_kind: kind, features, serves, source_revision: files.slice(0, 8), name,
  };
}

// ── The amplifier and network rows ──────────────────────────────────────────

const CLOSE = new Set(['1_reciprocated', '2_core_network']);
const KIND_NOUN = { investor: 'portfolio', ai_capital: 'investments', connector: 'network', ai_trainer: 'learners', student_educator: 'students', ceo_educator: 'members', broadcaster: 'audience' };

/**
 * Rows from the people Control Center says may reach many (amplifier_candidates)
 * and from close ties gone quiet (network). Also the reach questions worth
 * asking: the top few with no cited figure, once a month each.
 */
export function amplifierRows({ context, weekGoals, canon, files, at }) {
  const L = lessons(context.feedback, at);
  const research = Array.isArray(context.research) ? context.research : [];
  const routes = context.routes ?? {};
  const sectorOf = new Map((context.companies ?? []).map(c => [c.domain, word(c.kind)]));
  const out = [], held = [], asks = [];
  const seen = new Set();
  for (const c of Array.isArray(context.amplifier_candidates) ? context.amplifier_candidates : []) {
    const id = c.contact_id;
    if (typeof id !== 'string' || !UUID.test(id) || seen.has(id) || ['do_not_contact', 'closed'].includes(c.contacts?.status)) continue;
    seen.add(id);
    const kinds = kindsOf(c);
    if (!kinds.length) continue;
    const reach = reachOf(c, research);
    const sector = sectorOf.get(c.contacts?.company_domain) ?? null;
    const name = clean(c.contacts?.full_name ?? '');
    if (!name.includes(' ')) { held.push('no_full_name'); continue; }
    const subject = `contact:${id}`;
    const close = CLOSE.has(c.network_tier);
    // Two kinds at once: one ask, the higher rank.
    const options = kinds.map(kind => {
      const ask = ASK_FOR[kind], row = ROW_FOR[ask];
      const ch = channelOf(routes[id], row);
      const features = { sector, topic: 'ai_leadership', seniority: seniorityOf(c.current_title ?? c.contacts?.title) };
      const refused = refusedBy(L, { subject, row, kind, sector, topic: features.topic, band: reach.band }, at);
      return { kind, ask, row, ch, features, refused, serves: servesOf(row, weekGoals), s: ch ? score(reach, FIT[kind], ch.weight, servesOf(row, weekGoals), close) : 0 };
    }).sort((a, b) => b.s - a.s);
    const best = options.find(o => o.ch && !o.refused);
    if (!best) { held.push(options.find(o => o.refused)?.refused ?? 'no_route'); continue; }
    const variant = (L.pitchOff.get(best.row) ?? 0) % WORDS[best.ask].length;
    const words = WORDS[best.ask][variant]({ kind: best.kind }, canon);
    const company = clean(c.current_company ?? c.contacts?.company ?? '');
    out.push({ score: best.s, proposal: rowProposal({
      row: best.row, ask: best.ask, contactId: id, name, at, files,
      title: titleFor(best.ask, best.kind, name, company),
      why: `${name}${company ? ` (${company})` : ''} reads as ${best.kind.replace('_', ' ')}: ${clean(c.current_title ?? c.headline ?? c.contacts?.title ?? '')}. Reach: ${reach.band === 'unknown' ? 'not yet known' : reach.band.replace('_', ' ')} (${reach.basis}). One ask: ${best.ask}.`,
      action: actionFor(best.ch.channel, id, name, words), reach, kind: best.kind, features: best.features, serves: best.serves,
      evidence: reach.source_url ? [{ label: clean(`Reach: ${reach.basis}, as of ${reach.as_of.slice(0, 10)}`).slice(0, 500), url: reach.source_url }] : [],
    }) });
    // Rank by a cited figure where it is worth one question: the strongest without one.
    if (reach.value === null && asks.length < 4) asks.push({ c, kind: best.kind, name, company, score: best.s });
  }
  for (const n of Array.isArray(context.network) ? context.network : []) {
    const id = n.contact_id;
    if (typeof id !== 'string' || !UUID.test(id) || seen.has(id) || !CLOSE.has(n.network_tier) || ['do_not_contact', 'closed'].includes(n.contacts?.status)) continue;
    const last = Date.parse(n.contacts?.last_touch_at ?? '');
    // Gone quiet: a real relationship, nothing for 90 days.
    if (!Number.isFinite(last) || Date.parse(at) - last < 90 * DAY) continue;
    seen.add(id);
    const name = clean(n.contacts?.full_name ?? '');
    const subject = `contact:${id}`;
    const ch = channelOf(routes[id], 'network');
    const refused = refusedBy(L, { subject, row: 'network', kind: null, sector: null, topic: null, band: 'unknown' }, at);
    if (!name.includes(' ') || !ch || refused) { held.push(refused ?? (ch ? 'no_full_name' : 'no_route')); continue; }
    const serves = servesOf('network', weekGoals);
    const variant = (L.pitchOff.get('network') ?? 0) % WORDS.relationship.length;
    out.push({ score: score({ band: 'unknown', value: null }, 1, ch.weight, serves, true) + Math.min(2, (Date.parse(at) - last) / (365 * DAY)), proposal: rowProposal({
      row: 'network', ask: 'relationship', contactId: id, name, at, files,
      title: fitTitle(`Catch up with ${name}`, `Catch up with ${first(name)}`),
      why: `${name} is a close tie with nothing on record for ${Math.round((Date.parse(at) - last) / DAY)} days.`,
      action: actionFor(ch.channel, id, name, WORDS.relationship[variant]()), reach: { value: null, band: 'unknown', basis: 'a relationship, not an audience', source_url: null, as_of: null },
      kind: null, features: { sector: null, topic: 'relationship', seniority: seniorityOf(n.current_title ?? n.contacts?.title) }, serves, evidence: [],
    }) });
  }
  const month = at.slice(0, 7);
  const research_requests = asks.sort((a, b) => b.score - a.score).map(({ c, kind, name, company }) => ({
    request_id: `reach:${c.contact_id}:${month}`, kind: 'question', subject_ref: `contact:${c.contact_id}`,
    query: clean(`How many people does ${name}${company ? ` of ${company}` : ''} reach through their ${KIND_NOUN[kind]}? Give one number, what it counts, and the source with its date.`).slice(0, 400),
    why: clean(`Ranks an ask to ${name} by how far a yes travels.`).slice(0, 300),
  })).filter(r => !research.some(x => x.request_id === r.request_id));
  return { rows: out, held, research: research_requests };
}

function titleFor(ask, kind, name, company) {
  const f = first(name);
  if (ask === 'partner') return kind === 'ai_trainer'
    ? fitTitle(`Pair Mindmake with ${name}'s AI training`, `Pair Mindmake with ${f}'s AI training`)
    : fitTitle(`Offer ${name}${company ? ` at ${company}` : ''} a session for their leaders`, `Offer ${name} a session for their leaders`, `Offer ${f} a session for their leaders`);
  if (ask === 'introduce') return fitTitle(`Ask ${name} for one introduction`, `Ask ${f} for one introduction`);
  if (ask === 'appear') return fitTitle(`Ask to go on ${name}'s channel`, `Ask to go on ${f}'s channel`);
  if (ask === 'teach') return fitTitle(`Offer ${name} a session for their ${kind === 'student_educator' ? 'students' : 'leaders'}`, `Offer ${f} a session`);
  return fitTitle(`Reach out to ${name}`, `Reach out to ${f}`);
}

/** Rank inside each row, keep PER_ROW a row, and drop the engine's own field that names the person. */
export function rankRows(entries) {
  const byRow = new Map(ROWS.map(r => [r, []]));
  for (const e of entries) byRow.get(e.proposal.row)?.push(e);
  const kept = [], dropped = [];
  for (const [, list] of byRow) {
    list.sort((a, b) => b.score - a.score || a.proposal.proposal_id.localeCompare(b.proposal.proposal_id));
    list.forEach((e, i) => { const { name, ...p } = e.proposal; (i < PER_ROW ? kept : dropped).push({ ...p, rank: i + 1 }); });
  }
  return { kept, dropped: dropped.length };
}
