import { createHash } from 'node:crypto';

/**
 * Mindmake's canon, read live from its own repository on every run.
 *
 * Ruling (Krish, 2026-10-26): never send a stale pitch; fetch or cross-check
 * the latest from the venture's own repository. The pinned APPROVED_CANON in
 * contracts/growth.ts went stale within days: on 24 October the main ask
 * changed from "Get your free AI brief" to "Start building your AI brain". So
 * every row action is written from the files as they are this run, and names
 * them by git blob SHA (source_revision); Control Center reads each SHA again
 * before he acts and holds the action when a file has moved.
 *
 * Only what the canon already says publicly is read: the main ask and its
 * link, the two doors in their own words, the publication and its link, and
 * the Horizon's buyer. A file that no longer parses holds every row; nothing
 * falls back to an older copy.
 */

export const CANON_REPO = 'krishanraja/mindmake';
export const CANON_PATHS = { north_star: 'project-documentation/00_NORTH_STAR.md', canon: 'project-documentation/01_CANON.md' };
const RAW = 'https://raw.githubusercontent.com/krishanraja/mindmake/main/';

/** The git blob SHA of a file's bytes, as `git hash-object` gives it. */
export function blobSha(text) {
  const bytes = Buffer.from(text, 'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
}

export class CanonError extends Error { constructor(code) { super(code); this.code = code; } }

const one = (text, re, code) => { const m = re.exec(text); if (!m) throw new CanonError(code); return m; };
const flat = s => s.replace(/\s+/g, ' ').trim();

/** What a message may say about Mindmake, from the two files' text. Throws CanonError when a part is missing. */
export function parseCanon({ northStar, canon }) {
  // "1. **Start building your AI brain**, at `https://mindmake.co/?start=1`. The main ask,"
  const ask = one(canon, /^1\. \*\*([^*]{3,80})\*\*, at `(https:\/\/[^`\s]+)`\. The main ask/m, 'main_ask_unreadable');
  // "2. **Subscribe to Make Your Mind Up**, at `https://makeyourmindup.ai`"
  const pub = one(canon, /^2\. \*\*([^*]{3,80})\*\*, at `(https:\/\/[^`\s]+)`/m, 'publication_unreadable');
  // "Describe it as the site does: answer a few questions, keep the brief, then a free consultation."
  const describe = one(canon, /Describe\s+it\s+as\s+the\s+site\s+does:\s+([^.]{10,200})\./, 'main_ask_description_unreadable');
  // "- **Build your AI brain.** Your taste, standards and judgement, running as a system you own."
  const brain = one(northStar, /^- \*\*Build your AI brain\.\*\* ([\s\S]{10,200}?\.)\s*$/m, 'brain_door_unreadable');
  const horizon = one(northStar, /^## Horizon\s+> ([^\n]{20,400})/m, 'horizon_unreadable');
  const publicationName = one(pub[1], /Subscribe to (.+)$/, 'publication_unreadable')[1];
  // Protocol 1.8.0, the angles on the full card: the locked site copy in the
  // canon's own table. Each is optional; a line the canon no longer carries is
  // simply not offered as an angle, never written from memory.
  const cell = label => { const m = new RegExp(`^\\| ${label} \\| ([^|\\n]{3,200}) \\|\\s*$`, 'm').exec(canon); return m ? flat(m[1]) : null; };
  const revenueLabel = cell('Revenue engine door'), revenueLine = cell('Revenue engine door explanation');
  const problem = cell('Homepage section 1 \\(the problem\\)'), answer = cell('Homepage section 2 \\(how it works\\)');
  const headline = cell('Homepage headline \\(first, and the h1\\)');
  return {
    ask: { label: flat(ask[1]), url: ask[2], description: flat(describe[1]) },
    publication: { name: flat(publicationName), url: pub[2] },
    brain: flat(brain[1]),
    horizon: flat(horizon[1]),
    site: {
      headline,
      problem,
      answer,
      revenue: revenueLabel && revenueLine ? { label: revenueLabel, line: revenueLine } : null,
    },
  };
}

/** Both files from the default branch, their blob SHAs and what they say. */
export async function readCanon({ fetcher = fetch, timeoutMs = 15000 } = {}) {
  const read = async path => {
    const r = await fetcher(`${RAW}${path}`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new CanonError('canon_unavailable');
    return r.text();
  };
  let northStar, canon;
  try { [northStar, canon] = await Promise.all([read(CANON_PATHS.north_star), read(CANON_PATHS.canon)]); }
  catch (error) { throw error instanceof CanonError ? error : new CanonError('canon_unavailable'); }
  return {
    ...parseCanon({ northStar, canon }),
    files: [
      { repo: CANON_REPO, path: CANON_PATHS.north_star, sha: blobSha(northStar) },
      { repo: CANON_REPO, path: CANON_PATHS.canon, sha: blobSha(canon) },
    ],
  };
}
