/**
 * A route out of an answered lookup (2026-10-30). Control Center's research
 * desk answers a `booking:` or `email:` lookup with search results in
 * `evidence` (`{ title, url, snippet, published }`, ENGINE-PROTOCOL.md, "The
 * research desk"), and nothing in `answer`. This reads those results and keeps
 * one route, or none, by fixed rules: no model and no guess.
 *
 * What counts, for a stage or a show:
 * (a) an email address on the subject's own site domain: a role address first
 *     (booking@, guests@, speakers@, hello@, contact@, info@ and their kind),
 *     a personal-looking one only on a site the record declares and only where
 *     the words before it, in its own sentence with no other address between,
 *     say it is the way to book, pitch or apply; never a no-reply, privacy,
 *     sales or press address. The page it was read on is the subject's own site, or a
 *     listing that names the subject; an address read on a third party's page
 *     that does not name the subject is refused, whatever its domain.
 * (b) failing that, the subject's own application, speaker, guest or contact
 *     page on its own domain, which Control Center reads for its fields and
 *     the existing form lane then fills for his Submit.
 * For a guest only (a), on the guest's own site: a role address, or, only on
 * the site the guest's record declares, one whose local part carries the
 * guest's whole name (first and last).
 *
 * The subject's own site is the domain its record names (`event_url`,
 * `cfp_url`, a guest's `website`), never a listing, host or social site; or,
 * where the record names none, a result whose title names the subject and
 * whose registrable label is the subject's name run together (or starts with
 * it): marketingovercoffee for Marketing Over Coffee, never marketingprofs.
 * An address belongs to a site only on that host or a part of it, never its
 * parent: hello@sched.com is not an event's on aibuilders.sched.com. An address pattern is
 * never guessed: only an address the page shows is kept, with the page it came
 * from as provenance. Pure.
 */

/** Role addresses, best first: where a show or a stage takes pitches, then where any message lands. */
export const ROLE_LOCALS = Object.freeze(['booking', 'bookings', 'guests', 'guest', 'speakers', 'speaker', 'speaking', 'cfp', 'submissions', 'pitch', 'pitches', 'podcast', 'producer', 'producers', 'events', 'hello', 'contact', 'info', 'team']);
/** Addresses that never take a pitch: machines, policy, money, hiring, press and selling. */
const NOT_A_ROUTE = /^(?:no-?reply|do-?not-?reply|donotreply|mailer-?daemon|postmaster|webmaster|hostmaster|abuse|privacy|legal|dpo|gdpr|security|unsubscribe|billing|accounts?|invoices?|finance|payments?|careers|jobs|hr|recruit\w*|sales|sponsors?|sponsorships?|partnerships?|partners|advertis\w*|ads|tickets?|support|help|helpdesk|press|media|news|editor|editorial|orders?|shop|store|returns|admin|root|test|example)$/;
/** The words right before a personal-looking address that make it the way in. */
const BOOKING_WORDS = /\b(?:book(?:s|ed|ing|ings)?|guests?|pitch(?:es|ing)?|speakers?|speaking|speak|submissions?|submit|apply|producer|cfp|call for (?:speakers|papers|proposals))\b/i;
/** Hosts that are never a subject's own site: listings, podcast hosts, ticketing, social and search. */
const NOT_OWN_SITE = /(?:^|\.)(?:podcasts\.apple\.com|apple\.com|spotify\.com|iheart\.com|iheartradio\.com|amazon\.[a-z.]+|audible\.[a-z.]+|youtube\.com|youtu\.be|google\.com|goo\.gl|linkedin\.com|twitter\.com|x\.com|facebook\.com|fb\.com|instagram\.com|tiktok\.com|threads\.net|reddit\.com|medium\.com|wikipedia\.org|anchor\.fm|podbean\.com|libsyn\.com|buzzsprout\.com|simplecast\.com|megaphone\.fm|transistor\.fm|captivate\.fm|spreaker\.com|acast\.com|rss\.com|podchaser\.com|listennotes\.com|player\.fm|podcastaddict\.com|castbox\.fm|pocketcasts\.com|overcast\.fm|stitcher\.com|tunein\.com|deezer\.com|eventbrite\.[a-z.]+|meetup\.com|lu\.ma|luma\.com|sessionize\.com|papercall\.io|typeform\.com|tally\.so|jotform\.com|airtable\.com|forms\.gle|linktr\.ee|beacons\.ai|substack\.com|wordpress\.com|wixsite\.com|squarespace\.com|github\.com|crunchbase\.com|bloomberg\.com|forbes\.com|nytimes\.com)$/;
/** Words in a page's path or title that say it is the way in to speak, be a guest or write to them. */
const FORM_PATH = /(?:^|[/_-])(?:apply|application|be-?a-?guest|become-?a-?guest|be-?our-?guest|guest-?(?:application|request|form|pitch)|pitch|apply-?to-?speak|speak(?:er|ers|ing)?|call-?for-?(?:speakers|papers|proposals)|cfp|submit|submissions?|proposals?|contact(?:-?us)?)(?:[/_.-]|$)/i;
const FORM_WORDS = /\b(?:be (?:a|our) guest|become a guest|guest (?:application|request|form)|apply to (?:be a guest|speak|be a speaker)|call for (?:speakers|papers|proposals|presenters)|submit a (?:talk|session|proposal)|speaker (?:application|submission)s?|become a speaker|pitch (?:a guest|yourself|us)|cfp|contact us|get in touch)\b/i;
/** A page for attending, buying, sponsoring or subscribing is never the way in to speak. */
const NOT_A_FORM = /\b(?:attend|attendee|tickets?|passes|register|registration|sponsor(?:s|ship)?|exhibit(?:or|ors)?|newsletter|subscribe|waitlist|donate|volunteer|vote|nominat\w*|careers?|jobs?|privacy|terms)\b|(?:^|[/_-])(?:tickets?|register|registration|sponsor\w*|exhibit\w*|newsletter|subscribe|careers?|jobs?|privacy|terms)(?:[/_.-]|$)/i;
/** Words a subject's title shares with every other, so they never prove a domain is its own. */
const COMMON = new Set(['the', 'and', 'for', 'with', 'from', 'show', 'podcast', 'podcasts', 'summit', 'conference', 'conf', 'event', 'events', 'forum', 'festival', 'week', 'live', 'expo', 'series', 'radio', 'talk', 'talks', 'media', 'network', 'news', 'daily', 'weekly', 'official', 'global', 'world', 'annual', 'edition', 'leaders', 'leadership', 'business', 'future']);
const SECOND_LEVEL = /^(?:co|com|org|net|ac|gov|edu|ltd|plc|me)\.[a-z]{2}$/;
const EMAIL = /[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}/g;
/** "name [at] site [dot] com", written to dodge scrapers: the page still shows the address. */
const SPELLED = /\b([A-Za-z0-9][A-Za-z0-9._%+-]{0,63})\s*[[(]\s*at\s*[\])]\s*([A-Za-z0-9-]+(?:\s*[[(]\s*dot\s*[\])]\s*[A-Za-z0-9-]+)+)\b/gi;
const FILE_LIKE = /\.(?:png|jpe?g|gif|webp|svg|avif|ico|css|js)$/i;

/** A url's host, lower case, without www; null when it is not an https or http page. Pure. */
export function hostOf(url) {
  try { const u = new URL(String(url ?? '')); return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : null; } catch { return null; }
}
/**
 * Whether a host is on a site: the site itself or a part of it, never its
 * parent (an event platform's own domain is not the event hosted on its
 * subdomain), and never a bare suffix such as co.uk. Pure.
 */
export function sameSite(host, site) {
  if (!host || !site) return false;
  if (!site.includes('.') || SECOND_LEVEL.test(site)) return false;
  return host === site || host.endsWith(`.${site}`);
}
/** A site that is never anyone's own: a listing, a host, ticketing, social or search. Pure. */
export const notOwnSite = host => !host || NOT_OWN_SITE.test(host);
/** The words of a name as a domain might carry them: lower case, at least four letters, none every title shares. Pure. */
export function ownWords(name) {
  return [...new Set(String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !COMMON.has(w)))];
}
/** A title or a name, as words to compare: lower case letters and digits, single spaces. Pure. */
const plain = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
/** Whether a page's title or snippet names the subject: the whole name, of two words or more. Pure. */
export function names(item, name) {
  const want = plain(name);
  if (!want || !/\s/.test(want)) return false;
  return [item?.title, item?.snippet].some(x => ` ${plain(x)} `.includes(` ${want} `));
}
/** The registrable label of a host, the part before its suffix: summit for events.summit.example. Pure. */
const label = host => { const parts = host.split('.'); const keep = parts.length >= 3 && SECOND_LEVEL.test(parts.slice(-2).join('.')) ? 3 : 2; return parts.slice(-keep)[0] ?? ''; };

/**
 * The subject's own sites: the domains its record names, and, only where it
 * names none, the domain of a result whose title names the subject and whose
 * registrable label carries one of the subject's own words. Pure.
 */
export function ownSites(subject, evidence = []) {
  const declared = declaredSites(subject);
  if (declared.length) return declared;
  const runs = nameRuns(subject?.name);
  if (!runs.length) return [];
  const inferred = (Array.isArray(evidence) ? evidence : []).map(e => ({ e, host: hostOf(e?.url) }))
    .filter(({ e, host }) => host && !notOwnSite(host) && names(e, subject.name) && runs.some(r => label(host) === r || label(host).startsWith(r)))
    .map(({ host }) => host);
  return [...new Set(inferred)];
}
/** The sites the subject's own record names: `event_url`, `cfp_url`, a guest's `website`, never a listing or host. Pure. */
export function declaredSites(subject) {
  return [...new Set([subject?.event_url, subject?.cfp_url, subject?.website].map(hostOf).filter(h => h && !notOwnSite(h)))];
}
/** A name run together as a domain label would carry it: every word but "the", and its own words alone when two or more. Pure. */
function nameRuns(name) {
  const all = plain(name).split(' ').filter(w => w && w !== 'the').join('');
  const own = ownWords(name);
  return [...new Set([all.length >= 6 ? all : '', own.length >= 2 ? own.join('') : ''].filter(Boolean))];
}
/** The words before an address that speak for it: back to the end of the last sentence, and none if another address sits between. Pure. */
export function ownSentence(before) {
  const text = String(before ?? '');
  let cut = 0;
  for (const m of text.matchAll(/[.!?;](?=\s)|\n/g)) cut = m.index + m[0].length;
  const tail = text.slice(cut);
  return /@|[[(]\s*at\s*[\])]/i.test(tail) ? '' : tail;
}

/** Every address a result shows, with the words right before it. Pure. */
function addressesIn(item) {
  const text = [item?.title, item?.snippet].filter(x => typeof x === 'string').join(' \n ');
  const out = [];
  for (const m of text.matchAll(EMAIL)) out.push({ address: m[0].replace(/\.+$/, '').toLowerCase(), before: text.slice(Math.max(0, m.index - 100), m.index) });
  for (const m of text.matchAll(SPELLED)) out.push({ address: `${m[1]}@${m[2].replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.')}`.toLowerCase(), before: text.slice(Math.max(0, m.index - 100), m.index) });
  return out.filter(a => !FILE_LIKE.test(a.address) && !/@\d+x\./.test(a.address));
}

/** An address's role rank (lower is better), or Infinity for a personal-looking one, or null for one that never takes a pitch. Pure. */
export function roleRank(local) {
  const l = String(local ?? '').toLowerCase();
  if (NOT_A_ROUTE.test(l)) return null;
  const at = ROLE_LOCALS.indexOf(l.replace(/[._-]?(?:team|desk)$/, '') || l);
  return at === -1 ? Infinity : at;
}

/**
 * The best address the results show for a stage or a show, or null. The
 * address is on the subject's own site; it was read on that site or on a
 * listing that names the subject; a role address beats a personal one, which
 * counts only where the words before it say it is the way to book or pitch.
 * Pure.
 */
export function addressFrom(evidence, subject, sites = ownSites(subject, evidence)) {
  // A personal-looking address counts only on a site the record itself declares.
  const declared = declaredSites(subject).length > 0;
  const found = [];
  (Array.isArray(evidence) ? evidence : []).forEach((item, at) => {
    const page = hostOf(item?.url);
    if (!page) return;
    const onOwn = sites.some(s => sameSite(page, s));
    // A third party's page counts only as the subject's own listing: it names the subject.
    if (!onOwn && !names(item, subject?.name)) return;
    for (const { address, before } of addressesIn(item)) {
      const [local, domain] = address.split('@');
      if (!sites.some(s => sameSite(domain, s))) continue;
      const rank = roleRank(local);
      if (rank === null) continue;
      if (rank === Infinity && (!declared || !BOOKING_WORDS.test(ownSentence(before)))) continue;
      found.push({ address, source_url: item.url, rank, own: onOwn ? 0 : 1, at, basis: rank === Infinity ? 'named_booking' : 'role' });
    }
  });
  found.sort((a, b) => a.rank - b.rank || a.own - b.own || a.at - b.at);
  const best = found[0];
  return best ? { kind: 'email', address: best.address, source_url: best.source_url, basis: best.basis } : null;
}

/** The subject's own way in on its own site: a speaker, guest, application or contact page, the first two before a contact page; else null. Pure. */
export function formFrom(evidence, subject, sites = ownSites(subject, evidence)) {
  const found = [];
  (Array.isArray(evidence) ? evidence : []).forEach((item, at) => {
    const page = hostOf(item?.url);
    if (!page || !sites.some(s => sameSite(page, s)) || !/^https:\/\/\S+$/.test(item.url) || item.url.length > 2000) return;
    let path;
    try { const u = new URL(item.url); path = `${u.pathname}${u.search}`; } catch { return; }
    if (path === '/' || !path) return;
    const words = `${item?.title ?? ''} ${path}`;
    if (NOT_A_FORM.test(words)) return;
    if (!FORM_PATH.test(path) && !FORM_WORDS.test(item?.title ?? '')) return;
    const contact = /contact|get in touch/i.test(words) && !/speak|guest|apply|application|cfp|submit|pitch|proposal/i.test(words);
    found.push({ url: item.url, contact: contact ? 1 : 0, at });
  });
  found.sort((a, b) => a.contact - b.contact || a.at - b.at);
  return found[0] ? { kind: 'form', url: found[0].url, source_url: found[0].url } : null;
}

/** A guest's own address on the guest's own site: a role address, or one whose local part carries the guest's own name; else null. Pure. */
export function guestAddressFrom(evidence, guest) {
  const sites = ownSites(guest, evidence);
  if (!sites.length) return null;
  const declared = declaredSites(guest).length > 0;
  const found = [];
  (Array.isArray(evidence) ? evidence : []).forEach((item, at) => {
    const page = hostOf(item?.url);
    if (!page || !sites.some(s => sameSite(page, s))) return;
    for (const { address } of addressesIn(item)) {
      const [local, domain] = address.split('@');
      if (!sites.some(s => sameSite(domain, s))) continue;
      const rank = roleRank(local);
      if (rank === null) continue;
      const own = rank === Infinity ? declared && carriesWholeName(local, guest?.name) : true;
      if (!own) continue;
      found.push({ address, source_url: item.url, rank: rank === Infinity ? ROLE_LOCALS.length : rank, at, basis: rank === Infinity ? 'own_name' : 'role' });
    }
  });
  found.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return found[0] ? { kind: 'email', address: found[0].address, source_url: found[0].source_url, basis: found[0].basis } : null;
}

/** Whether an address's local part carries a person's whole name: first and last, in either order, run together or apart. Pure. */
export function carriesWholeName(local, name) {
  const n = plain(name).split(' ').filter(w => w.length >= 2);
  if (n.length < 2) return false;
  const [first, last] = [n[0], n.at(-1)];
  const l = String(local ?? '').toLowerCase();
  const run = l.replace(/[^a-z]/g, '');
  const tokens = l.split(/[^a-z]+/).filter(Boolean);
  return run === n.join('') || run === first + last || run === last + first || (tokens.includes(first) && tokens.includes(last));
}

/**
 * The route an answered lookup's results give, or null: for a stage or a show
 * an address first and its own form page second; for a guest an address only.
 * `subject` is `{ name, event_url, cfp_url }` for a stage or a show and
 * `{ name, website }` for a guest. Pure.
 */
export function routeFromEvidence(evidence, subject, lane) {
  if (!Array.isArray(evidence) || !evidence.length || !subject?.name) return null;
  if (lane === 'guest') return guestAddressFrom(evidence, subject);
  const sites = ownSites(subject, evidence);
  if (!sites.length) return null;
  return addressFrom(evidence, subject, sites) ?? formFrom(evidence, subject, sites);
}
