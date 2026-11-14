import { actionFor, caseFor, cardFor, channelOf, cleanName, companyAsWritten, fitHold, fitOf, hasFullName, rowProposal, servesOf, titleCase, titleFor, TITLE_MAX, FIT_FLOOR } from './rows.mjs';

/**
 * Outreach from AEO's cited pages (item 5.14, integration I-10, decision D10;
 * Krish, 2026-11-14: outreach drafts from AEO's cited pages, each a draft for
 * his send).
 *
 * AEO-Engine's fortnightly research finds the pages AI assistants cite when a
 * buyer asks one of Mindmake's questions. Control Center serves them in the
 * directive's standing as `cited_pages` (protocol 1.26.0,
 * `features.ai_answers_detail`): never a platform, never one of ours. A page an
 * assistant cites FIRST for a question this engine planned, on the site of a
 * company whose person Control Center already serves (network, quiet_ties,
 * amplifier_candidates) with an address on record, gets one REACH OUT email in
 * his own box: the fact (the question and the page), what Mindmake builds in
 * the canon's words, and one ask. The morning lane drafts it for his send;
 * nothing sends. Every other page is counted and said, never guessed at: a
 * host nobody he holds works at, a page cited but never first, a person with
 * no address. Only counts leave this stage in the report.
 */

/** One cited-page note a run: two would share their fixed sentences once the names and links are out, which the run's
 *  same-words rule holds as a template (sharedBodies in src/stages/rows.mjs). The next page waits for the next run. */
export const CITED_PER_RUN = 1;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A host as compared: lower case, no www, no port. Pure. */
export const hostKey = h => String(h ?? '').trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
const hostOfUrl = u => { try { return hostKey(new URL(u).hostname); } catch { return ''; } };

/** The standing's cited pages, read loosely: https pages with a host, in Control Center's order. Pure. */
export function citedPages(standing) {
  const list = Array.isArray(standing?.cited_pages) ? standing.cited_pages : [];
  return list.filter(p => p && typeof p.url === 'string' && /^https:\/\//.test(p.url)).map(p => ({
    url: p.url, host: hostKey(p.host) || hostOfUrl(p.url),
    times_first: Number.isFinite(p.times_first) ? p.times_first : 0, times_cited: Number.isFinite(p.times_cited) ? p.times_cited : 0,
    status: typeof p.status === 'string' ? p.status : 'not started',
  })).filter(p => p.host);
}

/** The first question in the standing whose first citation is on this host, or null. Pure. */
export function questionFirstOn(standing, host) {
  for (const q of Array.isArray(standing?.questions) ? standing.questions : []) {
    if (typeof q?.question !== 'string' || !q.question.trim()) continue;
    if ((Array.isArray(q.engines) ? q.engines : []).some(e => hostKey(e?.first_host) === host || hostOfUrl(e?.first_url ?? '') === host)) return q.question.trim();
  }
  return null;
}

/** Whether a person works at this host: their company's own domain is the host, or the host is a subdomain of it. Pure. */
export function worksAt(person, host) {
  const d = hostKey(person?.contacts?.company_domain);
  return !!d && (host === d || host.endsWith(`.${d}`));
}

/** The words: the fact, what Mindmake builds in the canon's words, one ask. Nothing about the person is invented. Pure. */
export function citedWords({ question, url, host }, canon) {
  const brain = String(canon?.brain ?? '').replace(/[.!?]+$/, '');
  return {
    subject: `Your page on ${host}`,
    lines: [
      `When someone asks an AI assistant "${question.replace(/["]+/g, '').replace(/[?.!\s]+$/, '')}?", the first source it cites is your page at ${url}.`,
      `That is the question we work on at Mindmake${brain ? ` (${brain.charAt(0).toLowerCase()}${brain.slice(1)})` : ''}; would a short call to compare notes be useful?`,
    ],
  };
}

/**
 * The cited-page notes for this run, and why every other page is not one.
 * `taken` is everyone another row already proposes this run: one ask a person.
 * Pure.
 */
export function citedRows({ standing, context, canon, files, at, weekGoals = [], titleMax = TITLE_MAX, fitFloor = FIT_FLOOR, taken = new Set(), max = CITED_PER_RUN }) {
  const pages = citedPages(standing);
  const held = [], rows = [];
  const counts = { pages: pages.length, proposed: 0 };
  if (!pages.length) return { rows, held, counts };
  const people = [...(context?.quiet_ties ?? []), ...(context?.network ?? []), ...(context?.amplifier_candidates ?? [])]
    .filter(p => typeof p?.contact_id === 'string' && UUID.test(p.contact_id) && !['do_not_contact', 'closed'].includes(p.contacts?.status));
  const routes = context?.routes ?? {};
  const used = new Set(taken);
  for (const page of pages) {
    if (rows.length >= max) { held.push('cited_per_run_cap'); continue; }
    if (page.times_first < 1) { held.push('cited_not_first'); continue; }
    const question = questionFirstOn(standing, page.host);
    if (!question) { held.push('cited_no_question'); continue; }
    const there = people.filter(p => worksAt(p, page.host) && !used.has(p.contact_id)).sort((a, b) => (fitOf(b) ?? -1) - (fitOf(a) ?? -1));
    if (!there.length) { held.push('cited_nobody_held_there'); continue; }
    const c = there.find(p => ['verified', 'unchecked'].includes(routes[p.contact_id]?.email) && channelOf(routes[p.contact_id], 'reach_out')?.channel === 'email');
    if (!c) { held.push('cited_no_address'); continue; }
    if (fitHold(c, fitFloor)) { held.push('low_fit'); continue; }
    const name = cleanName(c.contacts?.full_name ?? '');
    if (!hasFullName(name)) { held.push('no_full_name'); continue; }
    const id = c.contact_id, fit = fitOf(c);
    const company = companyAsWritten(c.current_company ?? c.contacts?.company ?? '', [c.who, c.hook, c.why_them]);
    const title = titleCase(cleanName(c.current_title ?? c.contacts?.title ?? ''));
    const serves = servesOf('reach_out', weekGoals);
    const reach = { value: null, band: 'unknown', basis: 'a page AI assistants cite first, not an audience', source_url: page.url, as_of: at };
    const evidence = [{ label: 'Cited first by an AI assistant for one of Mindmake\'s buyer questions (AEO-Engine research)', url: page.url }];
    const card = cardFor({ c, id, name, title, company, ask: 'cited', kind: null, reach, fit, serves, canon, at, extraSources: [page.url] });
    if (!card) { held.push('thin_card'); continue; }
    const told = caseFor({ c, name, company, ask: 'cited', kind: null, reach, fit, serves, at });
    used.add(id);
    rows.push({ score: 1 + (fit ?? 0) / 100 + Math.min(1, page.times_first / 10), proposal: rowProposal({
      row: 'reach_out', ask: 'cited', contactId: id, name, at, files, play: 'cited_page', month: at.slice(0, 7),
      title: titleFor('cited', null, name, company, titleMax),
      why: `${name} works at ${page.host}, whose page an AI assistant cites first when asked one of Mindmake's buyer questions.${fit !== null ? ` Mindmake fit ${fit} of 100.` : ''}`,
      because: told.because, brief: told.brief, card,
      action: actionFor('email', id, name, citedWords({ question, url: page.url, host: page.host }, canon)),
      reach, kind: null, features: { sector: null, topic: null, seniority: null }, serves, evidence,
    }) });
  }
  counts.proposed = rows.length;
  return { rows, held, counts };
}

/** One activity line, counts only, or null when no cited pages were served. Pure. */
export function citedLine(r, served) {
  if (!served) return null;
  if (!r?.counts?.pages) return 'Cited pages: none served for Mindmake yet, so no cited-page note was written.';
  const by = new Map();
  for (const h of r.held) by.set(h, (by.get(h) ?? 0) + 1);
  const why = [...by].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k.replace(/^cited_/, '').replace(/_/g, ' ')} ${n}`).join(', ');
  return `Cited pages: ${r.counts.pages} read; ${r.counts.proposed} written as REACH OUT notes for his own box${why ? `; not written: ${why}` : ''}.`;
}
