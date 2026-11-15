/**
 * The paid-accounts audit: wasted spend, efficiency, tracking gaps and a
 * cross-platform table, from accounts read by src/ads/ingest.mjs. Pure and
 * deterministic: the same accounts and time give the same report, byte for
 * byte. It contacts no platform, changes nothing, spends nothing and is never
 * run by the daily dispatch.
 *
 * Evidence rules:
 *   - every line is figured from the export alone. There is no outside
 *     benchmark: where a line is needed, it is the account's own average
 *     cost per conversion, and each such line says so;
 *   - a figure the export did not give is unknown, never zero, and a check
 *     that needs it says `unknown` with what would settle it;
 *   - conversions from accounts whose attribution windows differ, or are not
 *     given, are never added together; spend is never added across currencies;
 *   - there is no health score: states and money at stake only.
 *
 * Every recommendation is a draft for Krish. A change in an ad platform is
 * his own hand after his own yes; this engine has no route to make one.
 * Paid media stays excluded for Mindmake (playbook 10) until he rules
 * otherwise; this audit does not propose starting it.
 */

export const REPORT_FORMAT = 'ads-audit/1';
export const STATES = ['fail', 'watch', 'unknown', 'not_applicable', 'pass'];
export const AREAS = ['waste', 'efficiency', 'tracking', 'data'];
export const CHECKS = [
  'ads.data.window', 'ads.data.figures',
  'ads.waste.no_conversion_campaigns', 'ads.waste.search_terms', 'ads.waste.no_click_spend',
  'ads.efficiency.cost_outliers',
  'ads.tracking.no_conversions', 'ads.tracking.primary_action', 'ads.tracking.duplicate_actions', 'ads.tracking.counting', 'ads.tracking.offline', 'ads.tracking.values', 'ads.tracking.links', 'ads.tracking.more_conversions_than_clicks'
];
export const CROSS_CHECKS = ['ads.compare.windows'];
/** The engine's own line for a costly campaign: twice the account's own cost per conversion. A policy choice, not a benchmark. */
export const OUTLIER_TIMES = 2;
/** At most this many names are listed in one finding; the rest are counted. */
export const LIST_MAX = 10;
const SEARCH_PLATFORMS = ['google', 'microsoft'];
const SITE = 'mindmake.co';
const OWN_LINE = "the engine's own line: one of this account's own average cost per conversion, never an outside benchmark";

const sum = (xs, k) => xs.reduce((n, x) => n + x[k], 0);
const known = (xs, k) => xs.every(x => x[k] !== null);
const money = (n, cur) => `${cur} ${n.toFixed(2)}`;
const names = xs => `${xs.slice(0, LIST_MAX).map(x => x.name ?? x.term).join('; ')}${xs.length > LIST_MAX ? `; and ${xs.length - LIST_MAX} more` : ''}`;
const label = a => `${a.platform}:${a.account_ref}`;

/** An account's totals, each null where any campaign leaves it unknown. Pure. */
export function totals(a) {
  const c = a.campaigns;
  const spend = known(c, 'spend') ? sum(c, 'spend') : null;
  const conversions = known(c, 'conversions') ? sum(c, 'conversions') : null;
  return {
    spend, conversions,
    clicks: known(c, 'clicks') ? sum(c, 'clicks') : null,
    impressions: known(c, 'impressions') ? sum(c, 'impressions') : null,
    value: known(c, 'conversion_value') ? sum(c, 'conversion_value') : null,
    cost_per_conversion: spend !== null && conversions ? spend / conversions : null
  };
}

const finding = (account, id, area, state, evidence, extra = {}) => ({ account, id, area, state, evidence, at_stake: extra.at_stake ?? null, currency: extra.currency ?? null, rule: extra.rule ?? null, recommendation: extra.recommendation ?? null, stake: extra.stake ?? null });
/** What a waste finding puts at stake, item by item, so the headline adds each campaign once. */
const campaignsAt = xs => xs.map(c => ({ campaign_id: c.id, term: null, spend: c.spend }));
const draft = (action, owner = 'Krish, in the platform') => ({ action, owner, wall: 'a draft: nothing changes until he says yes and makes the change himself' });

/** Every check on one account, in CHECKS order. Pure. */
export function auditAccount(a) {
  const acc = label(a), cur = a.currency, t = totals(a), cpa = t.cost_per_conversion;
  const out = [];
  const add = (...args) => out.push(finding(acc, ...args));

  // Data: what the export can and cannot say.
  add('ads.data.window', 'data', a.window ? 'pass' : 'unknown', a.window ? `Window ${a.window.start} to ${a.window.end}.` : 'No window given, so no figure can be read against a period.', a.window ? {} : { recommendation: draft('export again with the window start and end', 'whoever exports the account') });
  const gaps = ['spend', 'conversions', 'clicks', 'impressions'].map(k => [k, a.campaigns.filter(c => c[k] === null).length]).filter(([, n]) => n);
  add('ads.data.figures', 'data', gaps.length ? 'watch' : 'pass', gaps.length ? `Not given: ${gaps.map(([k, n]) => `${k} on ${n} of ${a.campaigns.length} campaigns`).join(', ')}. Those are unknown, never zero, and every check that needs them says unknown.` : `Spend, conversions, clicks and impressions are given for all ${a.campaigns.length} campaigns.`);

  // Waste: spend with nothing to show for it, measured against the account's own cost per conversion.
  if (cpa === null) add('ads.waste.no_conversion_campaigns', 'waste', 'unknown', t.conversions === 0 ? 'The account has no conversions, so it has no cost per conversion to measure a campaign against (see ads.tracking.no_conversions).' : 'Spend or conversions are not given for every campaign, so the account has no cost per conversion.');
  else {
    const idle = a.campaigns.filter(c => c.conversions === 0 && c.spend !== null && c.spend >= cpa).sort((x, y) => y.spend - x.spend || x.id.localeCompare(y.id));
    const at = sum(idle, 'spend');
    if (idle.length) add('ads.waste.no_conversion_campaigns', 'waste', 'fail', `${idle.length} campaign${idle.length === 1 ? '' : 's'} spent at least ${money(cpa, cur)}${idle.length === 1 ? '' : ' each'}, the account's own cost per conversion, with no conversion: ${names(idle)}. Together ${money(at, cur)}, ${Math.round(at / t.spend * 100)}% of the account's spend.`, { at_stake: at, currency: cur, rule: OWN_LINE, stake: campaignsAt(idle), recommendation: draft(`review ${names(idle)}: cut, pause or fix the conversion tracking first, his call in the platform`) });
    else add('ads.waste.no_conversion_campaigns', 'waste', 'pass', `No campaign spent ${money(cpa, cur)}, the account's own cost per conversion, without a conversion.`, { rule: OWN_LINE });
  }

  if (!SEARCH_PLATFORMS.includes(a.platform)) add('ads.waste.search_terms', 'waste', 'not_applicable', `${a.platform} has no search terms.`);
  else if (!a.search_terms) add('ads.waste.search_terms', 'waste', 'unknown', 'No search terms in the export.', { recommendation: draft('export the search terms report for the same window', 'whoever exports the account') });
  else if (cpa === null) add('ads.waste.search_terms', 'waste', 'unknown', 'The account has no cost per conversion to measure a search term against.');
  else {
    const idle = a.search_terms.filter(s => s.conversions === 0 && s.spend !== null && s.spend >= cpa).sort((x, y) => y.spend - x.spend || x.term.localeCompare(y.term));
    const at = sum(idle, 'spend');
    if (idle.length) add('ads.waste.search_terms', 'waste', 'watch', `${idle.length} search term${idle.length === 1 ? '' : 's'} spent at least ${money(cpa, cur)}${idle.length === 1 ? '' : ' each'} with no conversion: ${names(idle)}. Together ${money(at, cur)}.`, { at_stake: at, currency: cur, rule: OWN_LINE, stake: idle.map(x => ({ campaign_id: x.campaign_id, term: x.term, spend: x.spend })), recommendation: draft(`consider exact-match negatives for: ${names(idle)}. Check each against the buyer first: a term can be right and the page wrong`) });
    else add('ads.waste.search_terms', 'waste', 'pass', `No search term spent ${money(cpa, cur)} without a conversion.`, { rule: OWN_LINE });
  }

  const unseen = a.campaigns.filter(c => c.spend > 0 && c.impressions > 0 && c.clicks === 0).sort((x, y) => y.spend - x.spend || x.id.localeCompare(y.id));
  if (!known(a.campaigns, 'clicks')) add('ads.waste.no_click_spend', 'waste', 'unknown', 'Clicks are not given for every campaign.');
  else if (unseen.length) add('ads.waste.no_click_spend', 'waste', 'watch', `${unseen.length} campaign${unseen.length === 1 ? '' : 's'} paid for impressions with no click at all: ${names(unseen)}. Together ${money(sum(unseen, 'spend'), cur)}. Right only if the aim was to be seen, not visited.`, { at_stake: sum(unseen, 'spend'), currency: cur, stake: campaignsAt(unseen), recommendation: draft(`say what ${names(unseen)} ${unseen.length === 1 ? 'is' : 'are'} for; if visits, review the creative and the audience`) });
  else add('ads.waste.no_click_spend', 'waste', 'pass', 'Every campaign with impressions had a click.');

  // Efficiency: the campaigns that cost far more per conversion than the account's own average.
  if (cpa === null) add('ads.efficiency.cost_outliers', 'efficiency', 'unknown', 'The account has no cost per conversion to compare campaigns with.');
  else {
    const costly = a.campaigns.filter(c => c.conversions > 0 && c.spend !== null && c.spend / c.conversions > OUTLIER_TIMES * cpa).sort((x, y) => (y.spend - y.conversions * cpa) - (x.spend - x.conversions * cpa) || x.id.localeCompare(y.id));
    const over = costly.reduce((n, c) => n + (c.spend - c.conversions * cpa), 0);
    const rule = `the engine's own line: ${OUTLIER_TIMES} times this account's own average cost per conversion (${money(cpa, cur)}), never an outside benchmark`;
    if (costly.length) add('ads.efficiency.cost_outliers', 'efficiency', 'watch', `${costly.length} campaign${costly.length === 1 ? '' : 's'} cost more than ${money(OUTLIER_TIMES * cpa, cur)} a conversion: ${costly.slice(0, LIST_MAX).map(c => `${c.name} (${money(c.spend / c.conversions, cur)})`).join('; ')}. They spent ${money(over, cur)} more than the same conversions cost at the account's average.`, { at_stake: over, currency: cur, rule, recommendation: draft('check the conversions are the same kind before moving any budget: a costly campaign that brings buyers can beat a cheap one that brings form fills') });
    else add('ads.efficiency.cost_outliers', 'efficiency', 'pass', `No campaign cost more than ${money(OUTLIER_TIMES * cpa, cur)} a conversion.`, { rule });
  }

  // Tracking: whether what the account counts is what Mindmake needs counted.
  const actions = a.conversion_actions;
  const live = actions?.filter(x => x.enabled !== false) ?? null;
  const primary = live?.filter(x => x.primary === true) ?? null;
  if (t.spend === null || t.conversions === null) add('ads.tracking.no_conversions', 'tracking', 'unknown', 'Spend or conversions are not given for every campaign.');
  else if (t.spend > 0 && t.conversions === 0) {
    const proven = primary !== null && primary.length === 0;
    add('ads.tracking.no_conversions', 'tracking', proven ? 'fail' : 'watch', `${money(t.spend, cur)} spent and 0 conversions recorded. ${proven ? 'No primary conversion action is enabled, so the account counts nothing.' : actions ? 'A primary action is enabled, so either nothing converted or it does not fire.' : 'Without the conversion actions it cannot be told whether nothing converted or nothing is tracked.'}`, { at_stake: t.spend, currency: cur, recommendation: draft(proven ? 'set one primary conversion action for the finished brief before any more spend' : 'fire a test conversion end to end and confirm it is recorded before any more spend') });
  } else add('ads.tracking.no_conversions', 'tracking', 'pass', `${t.conversions} conversions recorded.`);

  if (!actions) {
    for (const id of ['ads.tracking.primary_action', 'ads.tracking.duplicate_actions', 'ads.tracking.counting', 'ads.tracking.offline']) add(id, 'tracking', 'unknown', 'The export lists no conversion actions.', { recommendation: id === 'ads.tracking.primary_action' ? draft('export the conversion actions with primary, enabled, counting and source', 'whoever exports the account') : null });
  } else {
    if (!primary.length) add('ads.tracking.primary_action', 'tracking', 'fail', `${actions.length} conversion action${actions.length === 1 ? '' : 's'}, none enabled as primary: bidding optimises to nothing Mindmake counts.`, { recommendation: draft('make the finished brief the one primary conversion action') });
    else add('ads.tracking.primary_action', 'tracking', 'pass', `${primary.length} enabled primary action${primary.length === 1 ? '' : 's'}: ${names(primary)}.`);
    const seen = new Map();
    for (const x of primary) seen.set(x.name.toLowerCase(), (seen.get(x.name.toLowerCase()) ?? 0) + 1);
    const twice = [...seen].filter(([, n]) => n > 1).map(([k]) => k).sort();
    if (twice.length) add('ads.tracking.duplicate_actions', 'tracking', 'watch', `More than one enabled primary action named: ${twice.join('; ')}. One result may be counted twice.`, { recommendation: draft('keep one primary action per result and make the others secondary') });
    else add('ads.tracking.duplicate_actions', 'tracking', 'pass', 'No two enabled primary actions share a name.');
    const every = primary.filter(x => x.counting === 'every' && ['website', 'lead_form'].includes(x.source));
    if (primary.some(x => x.counting === null)) add('ads.tracking.counting', 'tracking', 'unknown', 'Counting is not given for every primary action.');
    else if (every.length) add('ads.tracking.counting', 'tracking', 'watch', `${names(every)} ${every.length === 1 ? 'counts' : 'count'} every submission, so one person who submits twice is two results.`, { recommendation: draft('count one result per click for a lead action') });
    else add('ads.tracking.counting', 'tracking', 'pass', 'No primary lead action counts every submission.');
    const imported = live.filter(x => x.source === 'import');
    if (live.some(x => x.source === null)) add('ads.tracking.offline', 'tracking', 'unknown', 'The source is not given for every enabled action.');
    else if (!imported.length) add('ads.tracking.offline', 'tracking', 'watch', 'No action is imported from outside the platform, so a good meeting or a paid proof never reaches it: it learns from form fills, not from the outcomes the North Star counts.', { recommendation: draft("import good meetings as an offline conversion. That sends records out of Control Center, so it needs his yes and a data protection read first", 'Krish, then Control Center') });
    else add('ads.tracking.offline', 'tracking', 'pass', `${imported.length} imported action${imported.length === 1 ? '' : 's'}: ${names(imported)}.`);
  }

  if (!t.conversions) add('ads.tracking.values', 'tracking', t.conversions === null ? 'unknown' : 'not_applicable', t.conversions === null ? 'Conversions are not given for every campaign.' : 'No conversions to value.');
  else if (t.value === null) add('ads.tracking.values', 'tracking', 'unknown', 'Conversion value is not given for every campaign.');
  else if (t.value === 0) add('ads.tracking.values', 'tracking', 'watch', `${t.conversions} conversions with no value on any, so spend cannot be read against what it earned.`, { recommendation: draft('give the finished brief a value, even a planning one, and say it is one') });
  else add('ads.tracking.values', 'tracking', 'pass', `${money(t.value, cur)} of conversion value recorded.`);

  const withUrls = a.campaigns.filter(c => c.final_urls?.length);
  if (!withUrls.length) add('ads.tracking.links', 'tracking', 'unknown', 'No landing page addresses in the export.');
  else {
    const off = [], bare = [];
    for (const c of withUrls) for (const u of c.final_urls) {
      const x = new URL(u);
      const host = x.hostname.replace(/^www\./, '');
      if (host !== SITE) off.push(c);
      else if (!(x.searchParams.has('utm_source') && x.searchParams.has('utm_medium')) && a.auto_tagging !== true) bare.push(c);
    }
    const uniq = xs => [...new Map(xs.map(c => [c.id, c])).values()];
    const offU = uniq(off), bareU = uniq(bare);
    if (bareU.length) add('ads.tracking.links', 'tracking', 'fail', `${bareU.length} campaign${bareU.length === 1 ? ' lands' : 's land'} on ${SITE} with no utm_source and utm_medium and no auto-tagging: ${names(bareU)}. Those visits read as untraced in Analytics.${offU.length ? ` ${offU.length} more ${offU.length === 1 ? 'lands' : 'land'} off ${SITE}: ${names(offU)}.` : ''}`, { recommendation: draft(`tag the landing addresses of ${names(bareU)} with utm_source and utm_medium${a.platform === 'google' ? ', or turn on auto-tagging' : ''}`) });
    else if (offU.length) add('ads.tracking.links', 'tracking', 'watch', `${offU.length} campaign${offU.length === 1 ? ' lands' : 's land'} off ${SITE}: ${names(offU)}. Every Mindmake link points at ${SITE} (Ruling, Krish, 2026-10-27).`, { recommendation: draft(`point ${names(offU)} at ${SITE}`) });
    else add('ads.tracking.links', 'tracking', 'pass', `Every landing address is on ${SITE} and traceable.`);
  }

  const over = a.campaigns.filter(c => c.clicks !== null && c.conversions !== null && c.conversions > c.clicks);
  if (!known(a.campaigns, 'clicks') || t.conversions === null) add('ads.tracking.more_conversions_than_clicks', 'tracking', 'unknown', 'Clicks or conversions are not given for every campaign.');
  else if (over.length) add('ads.tracking.more_conversions_than_clicks', 'tracking', 'watch', `${over.length} campaign${over.length === 1 ? '' : 's'} recorded more conversions than clicks: ${names(over)}. That means view-through conversions, repeat counting or a duplicated action.`, { recommendation: draft('find which before trusting the cost per conversion of those campaigns') });
  else add('ads.tracking.more_conversions_than_clicks', 'tracking', 'pass', 'No campaign recorded more conversions than clicks.');
  return out;
}

const windowKey = a => (a.attribution && a.attribution.click_days !== null && a.attribution.view_days !== null ? `${a.attribution.click_days}/${a.attribution.view_days}` : null);

/**
 * The cross-platform table: one row an account, totals by currency, and
 * conversions added across accounts only when every attribution window is
 * given and the same. Pure.
 */
export function crossPlatform(accounts) {
  const rows = accounts.map(a => {
    const t = totals(a);
    return { account: label(a), platform: a.platform, currency: a.currency, window: a.window, attribution: windowKey(a), spend: t.spend, impressions: t.impressions, clicks: t.clicks, conversions: t.conversions, cost_per_conversion: t.cost_per_conversion, click_rate: t.clicks !== null && t.impressions ? t.clicks / t.impressions : null };
  });
  const keys = new Set(rows.map(r => r.attribution));
  const periods = new Set(rows.map(r => (r.window ? `${r.window.start}..${r.window.end}` : null)));
  const comparable = !keys.has(null) && keys.size === 1 && !periods.has(null) && periods.size === 1;
  const byCurrency = {};
  for (const r of rows) {
    const c = byCurrency[r.currency] ??= { spend: 0, unknown_spend: 0, conversions: comparable ? 0 : null };
    if (r.spend === null) c.unknown_spend += 1; else c.spend += r.spend;
    if (comparable) c.conversions = r.conversions === null || c.conversions === null ? null : c.conversions + r.conversions;
  }
  const evidence = comparable
    ? `Every account reads the same window and the same attribution (${[...keys][0]} days click/view), so conversions are added.`
    : `${[...keys].includes(null) ? 'Not every account gives its attribution windows' : keys.size > 1 ? `The accounts count conversions over different attribution windows (${[...keys].sort().join(', ')} days click/view)` : 'The accounts read different periods'}, so conversions are not added across them: each platform's count stands alone.`;
  const check = finding('all', 'ads.compare.windows', 'data', rows.length < 2 ? 'not_applicable' : comparable ? 'pass' : 'watch', rows.length < 2 ? 'One account: nothing to compare.' : evidence);
  return { rows, by_currency: byCurrency, comparable, check };
}

/**
 * Waste at stake by currency: each flagged campaign's spend once, however many
 * waste checks flag it, plus each flagged search term whose campaign is given
 * and not already flagged. A term with no campaign is left out, never guessed
 * into one, and counted in `terms_unplaced`. Never added across currencies. Pure.
 */
export function wasteAtStake(accounts, findings) {
  const out = {};
  for (const a of accounts) {
    const acc = label(a);
    const items = findings.filter(f => f.account === acc && f.area === 'waste' && ['fail', 'watch'].includes(f.state) && f.stake).flatMap(f => f.stake);
    const flagged = new Set(items.filter(x => x.term === null).map(x => x.campaign_id));
    let spend = a.campaigns.filter(c => flagged.has(c.id)).reduce((n, c) => n + c.spend, 0), unplaced = 0;
    const terms = new Set();
    for (const x of items.filter(i => i.term !== null)) {
      const key = `${x.campaign_id}|${x.term}`;
      if (terms.has(key)) continue;
      terms.add(key);
      if (x.campaign_id === null) unplaced += 1;
      else if (!flagged.has(x.campaign_id)) spend += x.spend;
    }
    const c = out[a.currency] ??= { spend: 0, terms_unplaced: 0 };
    c.spend += spend; c.terms_unplaced += unplaced;
  }
  for (const k of Object.keys(out)) if (!out[k].spend && !out[k].terms_unplaced) delete out[k];
  return out;
}

/** Counts by state, in STATES order. Pure. */
export function stateCounts(findings) {
  const c = Object.fromEntries(STATES.map(s => [s, 0]));
  for (const f of findings) c[f.state] += 1;
  return c;
}

/**
 * The whole report on the accounts: each account's findings, the
 * cross-platform table and check, money at stake by currency (never added
 * across currencies), and the drafts in one list, fails first. Pure.
 */
export function auditAccounts(accounts, { at }) {
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('no accounts to audit');
  const findings = accounts.flatMap(auditAccount);
  const cross = crossPlatform(accounts);
  findings.push(cross.check);
  const at_stake = wasteAtStake(accounts, findings);
  const order = s => STATES.indexOf(s);
  const recommendations = findings.filter(f => f.recommendation && ['fail', 'watch', 'unknown'].includes(f.state))
    .sort((x, y) => order(x.state) - order(y.state) || (y.at_stake ?? 0) - (x.at_stake ?? 0) || x.account.localeCompare(y.account) || x.id.localeCompare(y.id))
    .map(f => ({ account: f.account, check: f.id, state: f.state, ...f.recommendation }));
  return {
    format: REPORT_FORMAT, generated_at: at, read_only: true, platforms_contacted: 0, changes_made: 0,
    accounts: accounts.map(a => ({ account: label(a), platform: a.platform, currency: a.currency, window: a.window, campaigns: a.campaigns.length })),
    counts: stateCounts(findings), waste_at_stake: at_stake,
    table: cross.rows, totals_by_currency: cross.by_currency, conversions_comparable: cross.comparable,
    findings, recommendations
  };
}

const f2 = n => (n === null ? 'unknown' : Number.isInteger(n) ? String(n) : n.toFixed(2));
const pct = n => (n === null ? 'unknown' : `${(n * 100).toFixed(2)}%`);
const cell = s => String(s).replace(/\|/g, '/');

/** The report as Markdown for Krish to read: the summary, the table, then every finding by area. Pure. */
export function renderMarkdown(r) {
  const out = [];
  out.push('# Paid accounts audit (read only)', '');
  out.push(`Generated ${r.generated_at} from an export file. No ad platform was contacted and nothing was changed. Every recommendation is a draft: nothing changes until Krish says yes and makes the change himself. Paid media stays excluded for Mindmake (playbook 10) until he rules otherwise.`, '');
  out.push(`Findings: ${STATES.map(s => `${r.counts[s]} ${s.replace('_', ' ')}`).join(', ')}. There is no health score: a score would hide what the export did not say.`, '');
  const stake = Object.entries(r.waste_at_stake);
  out.push(`Waste at stake: ${stake.length ? stake.map(([c, v]) => `${c} ${v.spend.toFixed(2)}${v.terms_unplaced ? ` (plus ${v.terms_unplaced} search term${v.terms_unplaced === 1 ? '' : 's'} with no campaign, left out)` : ''}`).join(', ') : 'none found'}: each flagged campaign's spend once, by currency, never added across currencies.`, '');
  out.push('## Across platforms', '');
  out.push('| Account | Window | Attribution (click/view days) | Spend | Impressions | Clicks | Click rate | Conversions | Cost per conversion |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const x of r.table) out.push(`| ${cell(x.account)} | ${x.window ? `${x.window.start} to ${x.window.end}` : 'unknown'} | ${x.attribution ?? 'unknown'} | ${x.spend === null ? 'unknown' : `${x.currency} ${x.spend.toFixed(2)}`} | ${f2(x.impressions)} | ${f2(x.clicks)} | ${pct(x.click_rate)} | ${f2(x.conversions)} | ${x.cost_per_conversion === null ? 'unknown' : `${x.currency} ${x.cost_per_conversion.toFixed(2)}`} |`);
  out.push('');
  for (const [c, v] of Object.entries(r.totals_by_currency)) out.push(`- ${c}: spend ${v.spend.toFixed(2)}${v.unknown_spend ? ` plus ${v.unknown_spend} account${v.unknown_spend === 1 ? '' : 's'} with spend unknown` : ''}; conversions ${r.conversions_comparable ? f2(v.conversions) : 'not added (see ads.compare.windows)'}.`);
  out.push('');
  out.push('## Drafts for Krish', '');
  if (!r.recommendations.length) out.push('None.');
  r.recommendations.forEach((x, i) => out.push(`${i + 1}. ${x.state.toUpperCase()} ${cell(x.account)} ${x.check}: ${x.action}. Owner: ${x.owner}; ${x.wall}.`));
  out.push('');
  for (const area of AREAS) {
    const fs = r.findings.filter(f => f.area === area);
    if (!fs.length) continue;
    out.push(`## ${area[0].toUpperCase()}${area.slice(1)}`, '');
    for (const f of fs) out.push(`- **${f.state}** ${cell(f.account)} ${f.id}: ${f.evidence}${f.rule ? ` Rule: ${f.rule}.` : ''}`);
    out.push('');
  }
  return `${out.join('\n').trimEnd()}\n`;
}
