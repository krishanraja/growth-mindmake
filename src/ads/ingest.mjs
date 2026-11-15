/**
 * The paid-accounts audit's ingest: one exported file Krish supplies, read
 * into the engine's own account shape. Pure: it takes the file's text and
 * returns accounts or throws with what is wrong. It contacts no platform and
 * reads no other file.
 *
 * Two forms are read:
 *   - JSON in the engine's own format (`ads-export/1`): accounts with their
 *     campaigns and, where the platform has them, search terms, conversion
 *     actions, attribution windows and auto-tagging;
 *   - CSV, one row per campaign over one window, with the columns in
 *     CSV_COLUMNS: campaigns only.
 *
 * A figure the file does not give is null, which the audit reads as unknown,
 * never as zero. A file that cannot be read whole is refused whole: no
 * partial audit. Paid media stays excluded for Mindmake (playbook 10); this
 * reads an account Krish chooses to show it and changes nothing.
 */

export const FORMAT = 'ads-export/1';
/** The bounds a file must sit inside, so a runaway export is refused before it is read. */
export const LIMITS = { bytes: 5 * 1024 * 1024, accounts: 20, campaigns: 2000, search_terms: 20000, conversion_actions: 200, urls: 20 };
export const CSV_REQUIRED = ['platform', 'account_ref', 'currency', 'window_start', 'window_end', 'campaign_id', 'spend'];
export const CSV_COLUMNS = [...CSV_REQUIRED, 'campaign_name', 'status', 'impressions', 'clicks', 'conversions', 'conversion_value', 'click_days', 'view_days', 'auto_tagging', 'final_url'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const COUNTING = ['one', 'every'];
const SOURCES = ['website', 'lead_form', 'import', 'call', 'app', 'other'];

class ExportError extends Error {}
const fail = msg => { throw new ExportError(msg); };
export const isExportError = e => e instanceof ExportError;

const text = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);
/** A non-negative figure, or null when it is not given. A given figure that is not one is refused. */
function figure(v, where) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0) fail(`${where}: not a figure of zero or more`);
  return n;
}
function flag(v, where) {
  if (v === null || v === undefined || v === '') return null;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return fail(`${where}: true or false`);
}
function url(v, where) {
  const s = text(v, 2000);
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return fail(`${where}: not a URL`); }
  if (!['https:', 'http:'].includes(u.protocol)) fail(`${where}: not a web address`);
  return u.href;
}

function campaignOf(c, where) {
  if (!c || typeof c !== 'object') fail(`${where}: not a campaign`);
  const id = text(c.id ?? c.campaign_id, 120) ?? fail(`${where}: no campaign id`);
  const urls = c.final_urls ?? (c.final_url ? [c.final_url] : null);
  if (urls !== null && (!Array.isArray(urls) || urls.length > LIMITS.urls)) fail(`${where}: final_urls must be a list of at most ${LIMITS.urls}`);
  return {
    id, name: text(c.name ?? c.campaign_name) ?? id, status: text(c.status, 40)?.toLowerCase() ?? null,
    spend: figure(c.spend, `${where} spend`), impressions: figure(c.impressions, `${where} impressions`), clicks: figure(c.clicks, `${where} clicks`),
    conversions: figure(c.conversions, `${where} conversions`), conversion_value: figure(c.conversion_value, `${where} conversion_value`),
    final_urls: urls === null ? null : urls.map((u, i) => url(u, `${where} final_urls[${i}]`)).filter(Boolean)
  };
}

function accountOf(a, i) {
  const where = `accounts[${i}]`;
  if (!a || typeof a !== 'object') fail(`${where}: not an account`);
  const platform = text(a.platform, 40)?.toLowerCase() ?? fail(`${where}: no platform`);
  const currency = text(a.currency, 3) ?? fail(`${where}: no currency`);
  if (!CURRENCY.test(currency)) fail(`${where}: currency must be a three-letter code`);
  const w = a.window ?? {};
  const window = DAY.test(w.start ?? '') && DAY.test(w.end ?? '') ? (w.start <= w.end ? { start: w.start, end: w.end } : fail(`${where}: window ends before it starts`)) : null;
  const att = a.attribution;
  const attribution = att && typeof att === 'object' ? { click_days: figure(att.click_days, `${where} click_days`), view_days: figure(att.view_days, `${where} view_days`) } : null;
  if (!Array.isArray(a.campaigns) || !a.campaigns.length) fail(`${where}: no campaigns`);
  if (a.campaigns.length > LIMITS.campaigns) fail(`${where}: more than ${LIMITS.campaigns} campaigns`);
  const campaigns = a.campaigns.map((c, j) => campaignOf(c, `${where} campaigns[${j}]`));
  const ids = new Set();
  for (const c of campaigns) { if (ids.has(c.id)) fail(`${where}: campaign ${c.id} appears twice`); ids.add(c.id); }
  let search_terms = null;
  if (a.search_terms !== undefined && a.search_terms !== null) {
    if (!Array.isArray(a.search_terms) || a.search_terms.length > LIMITS.search_terms) fail(`${where}: search_terms must be a list of at most ${LIMITS.search_terms}`);
    search_terms = a.search_terms.map((t, j) => ({
      campaign_id: text(t?.campaign_id, 120), term: text(t?.term) ?? fail(`${where} search_terms[${j}]: no term`),
      spend: figure(t.spend, `${where} search_terms[${j}] spend`), clicks: figure(t.clicks, `${where} search_terms[${j}] clicks`), conversions: figure(t.conversions, `${where} search_terms[${j}] conversions`)
    }));
  }
  let conversion_actions = null;
  if (a.conversion_actions !== undefined && a.conversion_actions !== null) {
    if (!Array.isArray(a.conversion_actions) || a.conversion_actions.length > LIMITS.conversion_actions) fail(`${where}: conversion_actions must be a list of at most ${LIMITS.conversion_actions}`);
    conversion_actions = a.conversion_actions.map((x, j) => {
      const w2 = `${where} conversion_actions[${j}]`;
      const counting = text(x?.counting, 10)?.toLowerCase() ?? null;
      if (counting !== null && !COUNTING.includes(counting)) fail(`${w2}: counting is one or every`);
      const source = text(x?.source, 20)?.toLowerCase() ?? null;
      if (source !== null && !SOURCES.includes(source)) fail(`${w2}: source is one of ${SOURCES.join(', ')}`);
      return { name: text(x?.name) ?? fail(`${w2}: no name`), primary: flag(x.primary, `${w2} primary`), enabled: flag(x.enabled, `${w2} enabled`), counting, source, has_value: flag(x.has_value, `${w2} has_value`) };
    });
  }
  return { platform, account_ref: text(a.account_ref, 80) ?? `${platform}-${i + 1}`, currency, window, attribution, auto_tagging: flag(a.auto_tagging, `${where} auto_tagging`), campaigns, search_terms, conversion_actions };
}

/** Accounts from the engine's JSON format. Throws an export error naming what is wrong. Pure. */
export function fromJson(body) {
  let doc;
  try { doc = JSON.parse(body); } catch { fail('not valid JSON'); }
  if (!doc || doc.format !== FORMAT) fail(`format must be ${FORMAT}`);
  if (!Array.isArray(doc.accounts) || !doc.accounts.length) fail('no accounts');
  if (doc.accounts.length > LIMITS.accounts) fail(`more than ${LIMITS.accounts} accounts`);
  const accounts = doc.accounts.map(accountOf);
  const keys = new Set();
  for (const a of accounts) { const k = `${a.platform}:${a.account_ref}`; if (keys.has(k)) fail(`account ${k} appears twice`); keys.add(k); }
  return accounts;
}

/** Rows of a CSV text: quoted fields, doubled quotes and CRLF line ends. Pure. */
export function parseCsv(body) {
  const rows = [];
  let row = [], field = '', quoted = false, i = 0;
  const s = String(body).replace(/^﻿/, '');
  while (i < s.length) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' && s[i + 1] === '\n') i++;
    if (ch === '\n' || ch === '\r') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (quoted) fail('a quoted CSV field is never closed');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

/**
 * Accounts from a campaign CSV: one row per campaign, grouped into accounts by
 * platform and account_ref, each account one window, currency and attribution.
 * Columns off CSV_COLUMNS are refused, so a misspelt header never reads as
 * a missing figure. Pure.
 */
export function fromCsv(body) {
  const rows = parseCsv(body);
  if (rows.length < 2) fail('a header and at least one campaign row');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const unknown = head.filter(h => !CSV_COLUMNS.includes(h));
  if (unknown.length) fail(`columns not read: ${unknown.join(', ')} (the columns are ${CSV_COLUMNS.join(', ')})`);
  const missing = CSV_REQUIRED.filter(h => !head.includes(h));
  if (missing.length) fail(`missing columns: ${missing.join(', ')}`);
  if (new Set(head).size !== head.length) fail('a column appears twice');
  if (rows.length - 1 > LIMITS.campaigns) fail(`more than ${LIMITS.campaigns} campaign rows`);
  const groups = new Map();
  rows.slice(1).forEach((cells, n) => {
    if (cells.length !== head.length) fail(`row ${n + 2}: ${cells.length} cells for ${head.length} columns`);
    // A column the file leaves out reads as an empty cell: not given, so unknown.
    const r = { ...Object.fromEntries(CSV_COLUMNS.map(h => [h, ''])), ...Object.fromEntries(head.map((h, j) => [h, cells[j].trim()])) };
    const key = `${r.platform.toLowerCase()}:${r.account_ref}`;
    const g = groups.get(key) ?? { platform: r.platform, account_ref: r.account_ref, currency: r.currency, window: { start: r.window_start, end: r.window_end }, attribution: r.click_days || r.view_days ? { click_days: r.click_days, view_days: r.view_days } : null, auto_tagging: r.auto_tagging || null, campaigns: [], first: n + 2 };
    for (const [k, v] of [['currency', r.currency], ['window', `${r.window_start}..${r.window_end}`], ['attribution', `${r.click_days}/${r.view_days}`], ['auto_tagging', r.auto_tagging]]) {
      const was = k === 'window' ? `${g.window.start}..${g.window.end}` : k === 'attribution' ? `${g.attribution?.click_days ?? ''}/${g.attribution?.view_days ?? ''}` : k === 'auto_tagging' ? (g.auto_tagging ?? '') : g[k];
      if (was !== v) fail(`row ${n + 2}: ${k} differs from row ${g.first} of the same account`);
    }
    g.campaigns.push({ id: r.campaign_id, name: r.campaign_name, status: r.status, spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, conversion_value: r.conversion_value, final_urls: r.final_url ? [r.final_url] : null });
    groups.set(key, g);
  });
  return fromJson(JSON.stringify({ format: FORMAT, accounts: [...groups.values()].map(({ first, ...g }) => g) }));
}

/** Accounts from a file's text and name: .json or .csv, within LIMITS.bytes. Pure. */
export function readExport(body, name) {
  if (typeof body !== 'string') fail('no file text');
  if (Buffer.byteLength(body, 'utf8') > LIMITS.bytes) fail(`larger than ${LIMITS.bytes} bytes`);
  if (/\.json$/i.test(name)) return fromJson(body);
  if (/\.csv$/i.test(name)) return fromCsv(body);
  return fail('a .json or .csv file');
}
