import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * The cold compliance gate (docs/GET-GOING.md 1.2; Rulings, Krish,
 * 2026-11-13, "The full-funnel engine": "Recipients are allowed by country
 * and recipient type, and an unknown country or type is held. None of it
 * starts before that plumbing reads back.").
 *
 * A hard gate, read back from its own files before any cold draft: every
 * run reads config/compliance.json (Krish's four approvals, digests only)
 * and the ignored runtime/compliance/opt-outs.json (the old opt-out lists,
 * hashed) again, and a cold draft is prepared only when every part reads
 * back as done and the recipient passes. Anything it cannot read is held,
 * never assumed (docs/playbooks/09-privacy-and-suppression.md: "If the
 * review cannot establish eligibility, mark the action blocked"; "If
 * suppression cannot be checked, hold the action").
 *
 * The recipient checks, each fail-closed:
 * - where: the two countries Krish allowed, read only from a code or the
 *   country's own name. In the United Kingdom only a corporate subscriber
 *   may be written to cold; a sole trader or a partnership is an individual
 *   subscriber under PECR, and so is anyone on a personal mailbox.
 * - which address: one that reads as a real mailbox on the company's own
 *   domain. A personal mailbox, a throwaway inbox, an address on another
 *   organisation's domain and an address worked out rather than found are
 *   all held.
 * - why we may: the page or record the person and the address came from,
 *   kept as a digest, which the footer names and the legitimate interest
 *   rests on.
 * - never again: do not contact, an opted-out reply on any lane, the old
 *   opt-out lists by address or by whole domain (an opted-out domain holds
 *   everyone at that company), and anyone who took the free brief.
 *
 * What stays Krish's, each a hold the gate reports by name until his yes is
 * recorded in config/compliance.json by digest: the footer words Control
 * Center adds at draft time, the privacy page section on mindmake.co, the
 * private legitimate-interests assessment, and the qualified review by a
 * reviewer he names.
 *
 * Pure but for readGate, which reads two files. No model, no network, and
 * nothing it returns or prints carries an address.
 */

export const COMPLIANCE_VERSION = 1;
export const CONFIG_PATH = 'config/compliance.json';
export const OPT_OUTS_PATH = 'runtime/compliance/opt-outs.json';

/**
 * The allowlist, as ruled: the United States, and United Kingdom corporate
 * subscribers on a company domain. Every other country is held, whatever
 * its own law would allow: Krish has allowed these two and no other.
 */
export const COUNTRIES = Object.freeze({
  US: Object.freeze({ name: 'United States', law: 'CAN-SPAM', subscriber: false }),
  GB: Object.freeze({ name: 'United Kingdom', law: 'PECR and UK GDPR', subscriber: true }),
});
/** The recipient types a cold note may go to: a named person, or a shared mailbox, on the company's own domain. */
export const BUSINESS_TYPES = Object.freeze(['company_person', 'company_mailbox']);

/**
 * Krish's four, in the order the gate reports them. Each is null in
 * config/compliance.json until he approves it, then `{ approved_on, sha256 }`:
 * the day of his yes and the SHA-256 of exactly what he approved (the
 * footer's words, the privacy section's words, the assessment, the
 * reviewer's signed review). The words themselves stay private.
 */
export const KRISH_ITEMS = Object.freeze([
  Object.freeze({ key: 'footer_words', hold: 'footer_words_unapproved' }),
  Object.freeze({ key: 'privacy_section', hold: 'privacy_section_unapproved' }),
  Object.freeze({ key: 'legitimate_interests', hold: 'legitimate_interests_unassessed' }),
  Object.freeze({ key: 'reviewer', hold: 'reviewer_unnamed' }),
]);
/** The holds a cold draft can meet, every one named. */
export const GATE_HOLDS = Object.freeze([...KRISH_ITEMS.map(i => i.hold), 'compliance_config_unreadable', 'opt_outs_not_imported', 'opt_outs_unreadable']);
export const CANDIDATE_HOLDS = Object.freeze([
  'source_missing', 'country_unknown', 'country_not_allowed', 'address_unread', 'address_not_plausible', 'throwaway_address',
  'guessed_address', 'other_organisation_address', 'company_domain_unknown', 'not_a_business_address', 'subscriber_unknown', 'individual_subscriber',
  'do_not_contact', 'opted_out', 'opted_out_before', 'domain_suppressed', 'brief_taker', 'brief_takers_unread',
]);

const sha256 = s => createHash('sha256').update(String(s), 'utf8').digest('hex');
const HEX64 = /^[0-9a-f]{64}$/;

// ── One address, read strictly ──────────────────────────────────────────────
// The cold lane's addresses come from Control Center's records and lookups.
// Each is read as given and held when it does not read as a real mailbox;
// nothing here repairs one address into another.

/** Personal mailbox providers in the two allowed countries: an address on one is the person's own, never their company's. */
export const PERSONAL_MAIL = new Set([
  'aol.com', 'att.net', 'btinternet.com', 'comcast.net', 'fastmail.com', 'gmail.com', 'gmx.co.uk', 'gmx.com',
  'googlemail.com', 'hey.com', 'hotmail.co.uk', 'hotmail.com', 'icloud.com', 'live.co.uk', 'live.com', 'mac.com',
  'me.com', 'msn.com', 'outlook.com', 'proton.me', 'protonmail.com', 'sbcglobal.net', 'sky.com', 'talktalk.net',
  'verizon.net', 'virginmedia.com', 'yahoo.co.uk', 'yahoo.com', 'ymail.com', 'zoho.com',
]);
/** Inboxes made to be thrown away: nobody reads a cold note sent to one. */
export const THROWAWAY_MAIL = new Set([
  'dispostable.com', 'fakeinbox.com', 'getnada.com', 'guerrillamail.com', 'mail.tm', 'maildrop.cc', 'mailinator.com',
  'mailnesia.com', 'mytemp.email', 'sharklasers.com', 'temp-mail.org', 'throwawaymail.com', 'trashmail.com', 'yopmail.com',
]);
/** Mailboxes a team reads together rather than one person, by the part before the @ or its first word. */
export const SHARED_MAILBOXES = new Set([
  'accounts', 'admin', 'billing', 'bookings', 'careers', 'contact', 'enquiries', 'events', 'finance', 'hello', 'help',
  'hr', 'info', 'inquiries', 'jobs', 'legal', 'marketing', 'media', 'news', 'office', 'partners', 'partnerships',
  'press', 'privacy', 'reception', 'recruitment', 'sales', 'security', 'support', 'team',
]);
// Text from a form or a template, never somebody's mailbox.
const TEMPLATE_LOCALS = new Set([
  'email', 'example', 'first.last', 'firstname', 'firstname.lastname', 'jane.doe', 'janedoe', 'john.doe', 'johndoe',
  'lastname', 'name', 'sample', 'someone', 'test', 'user', 'username', 'you', 'your.email', 'youremail', 'yourname',
]);
const TEMPLATE_HOSTS = new Set(['domain.com', 'example.com', 'example.net', 'example.org', 'yourcompany.com', 'yourdomain.com', 'yoursite.com']);
// A mailbox that takes no replies is no place for a note.
const NO_REPLY = new Set(['do-not-reply', 'donotreply', 'mailer-daemon', 'no-reply', 'noreply', 'postmaster']);
// An image or a script picked up as if it were a host ("banner@3x.png").
const FILE_ENDINGS = new Set(['css', 'gif', 'jpeg', 'jpg', 'js', 'png', 'svg', 'webp']);
// Brackets, quotes and list punctuation around an address; a full stop only after it, where a sentence ends.
const WRAPPING = /^[\s<>()[\]"',;:]+|[\s<>()[\]"',;:.]+$/g;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL = /^[a-z0-9][a-z0-9._%+-]*$/;
const TOP_LEVEL = /^[a-z]{2,24}$/;

/** A lower-case address split at its one @, or null when either side is not well formed. Pure. */
function addressParts(s) {
  const at = s.indexOf('@');
  if (at < 1 || at !== s.lastIndexOf('@') || s.length > 254) return null;
  const local = s.slice(0, at), host = s.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local) || local.endsWith('.') || local.includes('..')) return null;
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every(l => LABEL.test(l)) || !TOP_LEVEL.test(labels[labels.length - 1])) return null;
  return { local, host };
}

/**
 * An address as the gate reads it: trimmed, lower case, with no "mailto:",
 * no query and no wrapping punctuation; '' when it does not read as a real
 * mailbox (badly formed, template text, a no-reply box, a template or file
 * host, a long hexadecimal tracking id, or a phone number run into the
 * front of it). Pure.
 */
export function plainAddress(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  let s = raw.trim();
  try { s = decodeURIComponent(s); } catch { /* read as given */ }
  s = s.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(WRAPPING, '');
  const parts = addressParts(s);
  if (!parts) return '';
  const { local, host } = parts;
  if (TEMPLATE_LOCALS.has(local) || NO_REPLY.has(local)) return '';
  if (TEMPLATE_HOSTS.has(host) || FILE_ENDINGS.has(host.slice(host.lastIndexOf('.') + 1))) return '';
  if (/^[0-9a-f]{24,}$/.test(local)) return '';
  if (/^\d{7,}/.test(local.replace(/[-.]/g, ''))) return '';
  return s;
}

/**
 * The bare host of a web address, a host or an address: no scheme, "www.",
 * port, path or query; '' when what is left is not a host with a real
 * top-level name. Pure.
 */
export function domainOf(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase().replace(/^["'<\s]+|["'>\s]+$/g, '');
  s = s.slice(s.lastIndexOf('@') + 1).replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#:]/)[0].replace(/^www\./, '').replace(/^\.+|\.+$/g, '');
  const labels = s.split('.');
  return s.length <= 253 && labels.length >= 2 && labels.every(l => LABEL.test(l)) && TOP_LEVEL.test(labels[labels.length - 1]) ? s : '';
}

/**
 * Whether a host is the company's own: its domain, a subdomain of it (or it
 * of the host), or the same name of five letters or more under another
 * ending (northwind.com and northwind.co.uk). Anything looser is another
 * organisation's, and held. Pure.
 */
export function companyHost(host, companyDomain) {
  const a = domainOf(host ?? ''), b = domainOf(companyDomain ?? '');
  if (!a || !b) return false;
  if (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) return true;
  const name = d => d.slice(0, d.indexOf('.'));
  return name(a).length >= 5 && name(a) === name(b);
}

/** Whether an address is a shared mailbox (sales@, info@, sales.emea@ and the like) rather than one person's. Pure. */
export function sharedMailbox(address) {
  const local = String(address ?? '').toLowerCase().split('@')[0];
  return SHARED_MAILBOXES.has(local) || SHARED_MAILBOXES.has(local.split(/[._+-]/)[0]);
}

// ── Country and recipient type ──────────────────────────────────────────────

const COUNTRY_NAMES = Object.freeze({ US: 'US', USA: 'US', 'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US', GB: 'GB', UK: 'GB', 'UNITED KINGDOM': 'GB', 'GREAT BRITAIN': 'GB' });
const isoCountry = code => { try { const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code); return name !== code && name !== 'Unknown Region'; } catch { return false; } };
/**
 * The country a candidate names, as an ISO code, from a code or the country's
 * own name only. A city, a region or any other free text is never read as a
 * country: unknown is held, never guessed. Pure.
 */
export function countryOf(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const k = raw.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (COUNTRY_NAMES[k]) return COUNTRY_NAMES[k];
  return /^[A-Z]{2}$/.test(k) && isoCountry(k) ? k : null;
}
/** A UK subscriber type: 'corporate' (a company, an LLP or a public body) or 'individual' (a person, a sole trader or a partnership); null when unsaid. Pure. */
export function subscriberOf(raw) {
  const k = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  if (['corporate', 'company', 'limited_company', 'llp', 'public_body'].includes(k)) return 'corporate';
  if (['individual', 'person', 'consumer', 'sole_trader', 'partnership'].includes(k)) return 'individual';
  return null;
}

const SOURCE_REF = /^[a-z_]{2,30}:[A-Za-z0-9._:/-]{1,200}$/;
const sourceOf = s => typeof s === 'string' && (/^https:\/\/[^\s]+$/.test(s) || SOURCE_REF.test(s)) ? s : null;

/**
 * The recipient type of a candidate's address: company_person or
 * company_mailbox (on the company's own domain), personal_mailbox,
 * other_organisation, or a hold code. `email` is the address when the lane
 * holds it; `email_domain` its domain when only that is known. Pure.
 */
function recipientType(c) {
  const companyDomain = domainOf(c.company_domain ?? '');
  const given = typeof c.email === 'string' && c.email.trim() ? c.email : null;
  let address = null, host;
  if (given) {
    address = plainAddress(given);
    if (!address) return { hold: 'address_not_plausible' };
    host = address.slice(address.indexOf('@') + 1);
  } else {
    host = domainOf(c.email_domain ?? '');
    if (!host) return { hold: 'address_unread' };
  }
  if (THROWAWAY_MAIL.has(host)) return { hold: 'throwaway_address', host };
  if (c.email_guessed === true) return { hold: 'guessed_address', host };
  if (PERSONAL_MAIL.has(host)) return { type: 'personal_mailbox', host, address };
  if (!companyDomain) return { hold: 'company_domain_unknown', host, address };
  if (!companyHost(host, companyDomain)) return { type: 'other_organisation', host, address };
  return { type: address && sharedMailbox(address) ? 'company_mailbox' : 'company_person', host, address };
}

// ── The gate's own files, read back ─────────────────────────────────────────

const realDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
/** One of Krish's approvals as recorded: a real day not after `at`, and the SHA-256 of what he approved. Pure. */
export function approvalOf(v, at) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (!realDay(v.approved_on) || !HEX64.test(v.sha256 ?? '')) return null;
  if (!Number.isFinite(Date.parse(at)) || Date.parse(`${v.approved_on}T00:00:00Z`) > Date.parse(at)) return null;
  return { approved_on: v.approved_on, sha256: v.sha256 };
}

/** The most entries an opt-out record may hold in each list. */
export const OPT_OUTS_MAX = 200000;
/** An opt-out record as the importer writes it, or null when it is not one. Pure. */
export function parseOptOutRecord(v) {
  if (!v || typeof v !== 'object' || v.version !== COMPLIANCE_VERSION) return null;
  if (typeof v.imported_at !== 'string' || !Number.isFinite(Date.parse(v.imported_at))) return null;
  if (!Array.isArray(v.files) || !v.files.length || !v.files.every(f => HEX64.test(f?.sha256 ?? '') && Number.isSafeInteger(f?.entries) && f.entries >= 0)) return null;
  for (const k of ['emails', 'domains']) if (!Array.isArray(v[k]) || v[k].length > OPT_OUTS_MAX || !v[k].every(h => HEX64.test(h))) return null;
  return { imported_at: v.imported_at, files: v.files.length, emails: new Set(v.emails), domains: new Set(v.domains) };
}

/**
 * The gate's state from its two files as read this run: Krish's four
 * approvals from config/compliance.json and the old opt-outs from the
 * ignored record. `config` and `optOuts` are the parsed files, `null` when
 * absent, or `{ unreadable: true }`. `holds` names every part not done, in
 * order; the gate is open only when it is empty. Pure.
 */
export function gateState({ config, optOuts, at }) {
  const holds = [];
  const cfgOk = config && typeof config === 'object' && !config.unreadable && config.version === COMPLIANCE_VERSION && config.krish && typeof config.krish === 'object';
  if (!cfgOk) holds.push('compliance_config_unreadable');
  const krish = {};
  for (const { key, hold } of KRISH_ITEMS) { krish[key] = cfgOk ? approvalOf(config.krish[key], at) : null; if (!krish[key]) holds.push(hold); }
  let opt = null;
  if (optOuts === null || optOuts === undefined) holds.push('opt_outs_not_imported');
  else { opt = optOuts.unreadable ? null : parseOptOutRecord(optOuts); if (!opt) holds.push('opt_outs_unreadable'); }
  return { version: COMPLIANCE_VERSION, krish, opt_outs: opt, holds, open: holds.length === 0 };
}

/**
 * Reads the gate back from its files, fresh, every time it is asked: the
 * repository's config/compliance.json and the ignored opt-out record. An
 * absent file is absent, a file that does not parse is unreadable; neither
 * is ever taken as done.
 */
export async function readGate({ root = new URL('../../', import.meta.url), at = new Date().toISOString(), read = p => readFile(new URL(p, root), 'utf8') } = {}) {
  const load = async p => {
    let text;
    try { text = await read(p); } catch (e) { return e?.code === 'ENOENT' ? null : { unreadable: true }; }
    try { return JSON.parse(text); } catch { return { unreadable: true }; }
  };
  const [config, optOuts] = await Promise.all([load(CONFIG_PATH), load(OPT_OUTS_PATH)]);
  return gateState({ config, optOuts, at });
}

// ── The verdict on one cold recipient ───────────────────────────────────────

/**
 * Whether one cold first touch (or a follow-up to a cold recipient) may be
 * drafted. `candidate` is what the cold lane knows of the person:
 *   subject_ref     contact:<id> or another reference, never a name
 *   source          where the person and the address were found: an https
 *                   page or a `kind:ref` reference (the footer's source,
 *                   and the record the legitimate interest rests on)
 *   country         an ISO code or the country's own name
 *   subscriber      for the United Kingdom: corporate, or an individual,
 *                   sole trader or partnership
 *   email or email_domain, with email_guessed (true when the address was
 *                   worked out rather than found)
 *   company_domain
 *   status          the contact's Control Center status
 *   opted_out       a reply that opted out, on any lane
 *   brief_taker     true or false once Control Center serves who took the
 *                   free brief; anything else is unread, and held
 * Returns `{ allowed, holds, record }`: every hold by name (the gate's own
 * first), and the eligibility record playbook 09 asks for, with no address,
 * name or source text in it. Pure.
 */
export function coldVerdict(candidate, gate) {
  const c = candidate && typeof candidate === 'object' ? candidate : {};
  const holds = gate && Array.isArray(gate.holds) ? [...gate.holds] : ['compliance_config_unreadable', ...KRISH_ITEMS.map(i => i.hold), 'opt_outs_not_imported'];
  const add = h => { if (!holds.includes(h)) holds.push(h); };
  const source = sourceOf(c.source);
  if (!source) add('source_missing');
  const country = countryOf(c.country);
  if (!country) add('country_unknown');
  else if (!COUNTRIES[country]) add('country_not_allowed');
  const r = recipientType(c);
  if (r.hold) add(r.hold);
  else if (r.type === 'other_organisation') add('other_organisation_address');
  else if (!BUSINESS_TYPES.includes(r.type)) add('not_a_business_address');
  const subscriber = subscriberOf(c.subscriber);
  if (country === 'GB') { if (subscriber === null) add('subscriber_unknown'); else if (subscriber !== 'corporate') add('individual_subscriber'); }
  // Suppression wins (playbook 09); an opted-out domain holds everyone at that company.
  if (['do_not_contact', 'closed'].includes(c.status)) add('do_not_contact');
  if (c.opted_out === true) add('opted_out');
  if (c.brief_taker === true) add('brief_taker');
  else if (c.brief_taker !== false) add('brief_takers_unread');
  const opt = gate?.opt_outs ?? null;
  let suppression = opt ? 'clear' : 'unchecked';
  if (opt) {
    if (r.address && opt.emails.has(sha256(`email:${r.address}`))) { add('opted_out_before'); suppression = 'suppressed'; }
    const domains = [r.host, domainOf(c.company_domain ?? '')].filter(Boolean);
    if (domains.some(d => opt.domains.has(sha256(`domain:${d}`)))) { add('domain_suppressed'); suppression = 'suppressed'; }
  }
  if (holds.some(h => ['do_not_contact', 'opted_out', 'brief_taker'].includes(h))) suppression = 'suppressed';
  else if (suppression === 'clear' && holds.includes('brief_takers_unread')) suppression = 'unchecked';
  const allowed = holds.length === 0;
  const record = {
    version: COMPLIANCE_VERSION,
    subject_ref: typeof c.subject_ref === 'string' ? c.subject_ref : null,
    country,
    law: country && COUNTRIES[country] ? COUNTRIES[country].law : null,
    recipient_type: r.type ?? 'unknown',
    subscriber: country === 'GB' ? subscriber : null,
    source_sha256: source ? sha256(source) : null,
    purpose: 'cold_first_touch',
    suppression,
    lawful_basis: gate?.krish?.legitimate_interests ?? null,
    reviewer: gate?.krish?.reviewer ?? null,
    decision: allowed ? 'allowed' : 'held',
    holds,
  };
  return { allowed, holds, record };
}

/** A cold hold in a stage's held list, as analyse names it. */
export const COLD_PREFIX = 'cold_';
export const isColdHold = reason => typeof reason === 'string' && reason.startsWith(COLD_PREFIX);
/** What a cold draft meets when no gate was read back: closed, by name. */
export const CLOSED = 'cold_compliance_closed';
/** The gate for a stage that reads no gate: every cold draft held. */
export const closedGate = () => CLOSED;

/**
 * The gate as a stage applies it to a contact on the legacy snapshot route
 * (src/stages/qualify.mjs analyse, and the named_cold motion through it): a
 * hold code, or null to draft. A closed gate holds every cold draft as
 * cold_compliance_closed; an open one judges the contact, and a snapshot
 * contact carries no country, address or source, so it is held by the first
 * thing it lacks until the cold lane (GET-GOING 1.3) supplies them. Pure.
 */
export function coldGateFor(gate) {
  if (!gate || !Array.isArray(gate.holds) || gate.holds.length) return closedGate;
  return contact => {
    const v = coldVerdict({
      subject_ref: typeof contact?.id === 'string' ? `contact:${contact.id}` : null,
      status: contact?.suppressed || contact?.closed || contact?.consent_status === 'blocked' ? 'do_not_contact' : null,
    }, gate);
    return v.allowed ? null : `${COLD_PREFIX}${v.holds[0]}`;
  };
}

/** One report line, only when the gate held a cold draft this run: how many, and what is still open, by name. Pure. */
export function gateLine(gate, held) {
  const open = gate && Array.isArray(gate.holds) ? gate.holds : [CLOSED];
  const n = `${held} cold draft${held === 1 ? '' : 's'}`;
  return open.length
    ? `Cold compliance gate: closed, so ${n} held. Still open: ${open.join(', ')}. The footer words, the privacy section, the legitimate-interests assessment and the named reviewer are Krish's; nothing cold is drafted until every part reads back done.`
    : `Cold compliance gate: open, and ${n} held by the recipient checks (country, recipient type, source or suppression).`;
}

// ── Who took the free brief (suppressed from every lane) ────────────────────

/** Whether a string is a contact id: five dash-separated runs of hexadecimal, 8, 4, 4, 4 and 12 long. Pure. */
const contactId = s => {
  const runs = s.split('-');
  return runs.length === 5 && runs.map(p => p.length).join(',') === '8,4,4,4,12' && /^[0-9a-f]+$/.test(runs.join(''));
};
/**
 * Everyone who took the free brief, as `contact:<id>`, from the context's
 * `records.brief_takers` (`[{ contact_id }]`) once Control Center serves it,
 * or null while it does not. mindmake.co promises "Two emails, and then
 * nothing", so while a brief record exists the person is in no lane (Rulings,
 * Krish, 2026-11-13): rows.mjs `lessons` puts each in `never`, which every
 * lane reads and the suppression list sends. Pure.
 */
export function briefTakers(context) {
  const rows = context?.records?.brief_takers;
  if (!Array.isArray(rows)) return null;
  const out = new Set();
  for (const r of rows) { const id = typeof r?.contact_id === 'string' ? r.contact_id.toLowerCase() : null; if (id && contactId(id)) out.add(`contact:${id}`); }
  return out;
}

// ── The old opt-out lists (Instantly and Apollo), imported ──────────────────

/** RFC 4180 rows from CSV text: quoted fields, doubled quotes, commas and newlines inside quotes. Pure. */
function csvRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim()));
}

const cellValue = v => String(v ?? '').trim().toLowerCase().replace(/^mailto:/, '').replace(WRAPPING, '');
const MAIL_HEADING = /mail/;
const DOMAIN_HEADING = /domain|site|url/;

/**
 * Everything one old opt-out export says not to write to again, as digests.
 * Lines starting with # are notes. When the first row is headings (none of
 * its cells is an address or a host), only the columns headed as a domain,
 * website or url, or as an email, are read, if there are any; otherwise
 * every cell is. A value with an @ is an address; any other value in a domain
 * column, or in a file with no such heading, is a host, and an opted-out
 * host holds everyone at it. `{ emails, domains, entries, skipped }`: sets of
 * SHA-256 digests and counts, and nothing else of the file. Pure.
 */
export function parseOptOuts(text) {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter(l => !l.trimStart().startsWith('#'));
  const rows = csvRows(lines.join('\n'));
  const readable = cell => { const v = cellValue(cell); return v.includes('@') ? Boolean(addressParts(v)) : Boolean(domainOf(v)); };
  const headings = rows.length && !rows[0].some(readable) ? rows.shift().map(h => h.trim().toLowerCase()) : [];
  const domainCols = new Set(headings.flatMap((h, i) => DOMAIN_HEADING.test(h) ? [i] : []));
  const mailCols = new Set(headings.flatMap((h, i) => !domainCols.has(i) && MAIL_HEADING.test(h) ? [i] : []));
  const named = mailCols.size + domainCols.size > 0;
  const emails = new Set(), domains = new Set();
  let entries = 0, skipped = 0;
  for (const row of rows) {
    row.forEach((cell, i) => {
      if (named && !mailCols.has(i) && !domainCols.has(i)) return;
      const v = cellValue(cell);
      if (!v) return;
      if (v.includes('@')) {
        if (addressParts(v)) { emails.add(sha256(`email:${v}`)); entries++; } else skipped++;
        return;
      }
      const host = !named || domainCols.has(i) ? domainOf(v) : '';
      if (host) { domains.add(sha256(`domain:${host}`)); entries++; } else skipped++;
    });
  }
  return { emails, domains, entries, skipped };
}

/**
 * The opt-out record with one more export added: the file's own SHA-256 and
 * how many entries it gave, and every address and domain as a digest,
 * sorted. Importing the same file twice changes nothing, and a file that
 * gives no address or host adds nothing, so a wrong file never reads back
 * as an import. Pure.
 */
export function addOptOuts(record, { text, at }) {
  const prior = record ? parseOptOutRecord(record) : null;
  if (record && !prior) throw new Error('The opt-out record does not parse, so nothing was added to it.');
  const parsed = parseOptOuts(text);
  if (!parsed.entries) throw new Error('No address or domain was read from the export, so nothing was added.');
  const fileSha = sha256(String(text ?? ''));
  const files = prior ? record.files.filter(f => f.sha256 !== fileSha) : [];
  const emails = new Set([...(prior?.emails ?? []), ...parsed.emails]), domains = new Set([...(prior?.domains ?? []), ...parsed.domains]);
  if (emails.size > OPT_OUTS_MAX || domains.size > OPT_OUTS_MAX) throw new Error(`An opt-out list holds at most ${OPT_OUTS_MAX} addresses and ${OPT_OUTS_MAX} domains.`);
  return {
    record: { version: COMPLIANCE_VERSION, imported_at: new Date(Date.parse(at)).toISOString(), files: [...files, { sha256: fileSha, entries: parsed.entries }].sort((a, b) => a.sha256.localeCompare(b.sha256)), emails: [...emails].sort(), domains: [...domains].sort() },
    counts: { entries: parsed.entries, skipped: parsed.skipped, emails: emails.size, domains: domains.size, files: files.length + 1 },
  };
}
