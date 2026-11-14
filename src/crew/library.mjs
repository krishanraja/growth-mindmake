/**
 * The Growth library's taxonomy and its check (docs/DRIVE.md, "The check";
 * plan section 3, the Librarian). Pure.
 *
 * `taxonomyOf` reads docs/DRIVE.md itself: the map, the naming pattern and
 * its kinds, the words never used in a title, the one PDF a Current holds,
 * the drafts kept, the archive and the Canva folders. library/taxonomy.json
 * is generated from it and checked for drift (scripts/check-library.mjs), so
 * the rules live in one place, the doc Krish reads.
 *
 * `checkListing` takes a listing of the folders (titles, folders, mime types,
 * modified dates, and for a repository copy the commit time it names) and
 * returns the counts "The check" lists, each of which should be zero.
 */
import { createHash } from 'node:crypto';

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The taxonomy, from the text of docs/DRIVE.md. Throws when a part the check needs is missing, so a rewrite of the doc cannot silently empty the gate. */
export function taxonomyOf(markdown) {
  const text = String(markdown);
  const need = (v, what) => { if (v === null || v === undefined || (Array.isArray(v) && !v.length)) throw new Error(`docs/DRIVE.md: ${what} could not be read`); return v; };
  const map = need(/## The map[\s\S]*?```\n([\s\S]*?)```/.exec(text)?.[1], 'the map');
  const folders = [], topFiles = [], examples = [];
  const stack = [];
  let root = null;
  for (const line of map.split('\n')) {
    if (!line.trim()) continue;
    const depth = Math.floor((/^ */.exec(line)[0].length) / 2);
    const [name, comment = ''] = line.trim().split(/\s{2,}/);
    for (const m of comment.matchAll(/\b\d{4}-\d{2}-\d{2} [^,]+? v\d+\b/g)) examples.push(m[0]);
    if (depth === 0) { root = name.replace(/\/$/, ''); stack.length = 0; stack.push(root); folders.push(root); continue; }
    stack.length = depth;
    if (name.endsWith('/')) { const path = `${stack.join('/')}/${name.slice(0, -1)}`; stack.push(name.slice(0, -1)); folders.push(path); }
    else if (depth === 1) topFiles.push(name);
  }
  const naming = need(/## Naming\n\n([\s\S]*?)\n\n## /.exec(text)?.[1], 'the naming section');
  const kinds = need(/Kinds: ([^.]+)\./.exec(naming)?.[1].split(/,\s*/).map(s => s.trim()).filter(Boolean), 'the kinds');
  for (const m of naming.matchAll(/`(\d{4}-\d{2}-\d{2} [^`]+)`/g)) examples.push(m[1]);
  const banned = need([...(/Never ([^.]*) in a title\./.exec(naming)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(m => m[1].toLowerCase()), 'the words never in a title');
  const exceptFolders = /files in a ([A-Z][a-z]+ [a-z]+) folder/.exec(naming)?.[1] ?? null;
  const kindAlt = [...kinds].sort((a, b) => b.length - a.length).map(esc).join('|');
  const rules = need(/## Rules\n\n([\s\S]*?)\n\n## /.exec(text)?.[1], 'the rules');
  const drafts = WORDS[/The last (\w+) drafts of an asset at most/.exec(rules)?.[1]] ?? null;
  const pdfs = /Current\/\s+exactly (\w+) PDF/.exec(map)?.[1];
  const archive = need(folders.find(f => /\/Growth archive$/.test(f)), 'the archive folder');
  const canvaRoot = need(/Canva: the folder \*\*([^*]+)\*\*/.exec(text)?.[1], 'the Canva folder');
  const canvaSubs = need(/in its subfolders ([^.]+)\./.exec(rules)?.[1].split(/,\s*/).map(s => s.trim().replace(/^and\s+/, '')).filter(Boolean), 'the Canva subfolders');
  const declared = /Drive map \(drive-map\/1\): `([^`]+)`/.exec(text)?.[1] ?? null;
  return {
    version: 1,
    source: 'docs/DRIVE.md',
    source_sha256: createHash('sha256').update(text).digest('hex'),
    root,
    folders,
    top_files: topFiles,
    exception_folders: exceptFolders ? [exceptFolders] : [],
    kinds,
    name_pattern: `^(\\d{4}-\\d{2}-\\d{2}) (${kindAlt}) (.+) v(\\d+)(?: \\(superseded (\\d{4}-\\d{2}-\\d{2})\\))?(\\.[a-z0-9]{1,5})?$`,
    banned_words: banned,
    examples: [...new Set(examples)],
    current: { folder: 'Current', max_pdf: need(WORDS[pdfs], 'the PDFs a Current holds') },
    drafts: { folder: 'Drafts', max: need(drafts, 'the drafts kept') },
    archive,
    canva: { root: canvaRoot, folders: [canvaRoot, ...canvaSubs.map(s => `${canvaRoot}/${s}`)] },
    // The root this engine declares to Control Center (fleet integration I-25), by path only: this repository is public.
    drive_map: declared ? { schema: 'drive-map/1', roots: [{ path: declared }] } : null
  };
}

/** A title read by the naming pattern: its parts, or null when it fails. Never "final", "new" or "copy of". */
export function nameOf(title, taxonomy) {
  const m = new RegExp(taxonomy.name_pattern).exec(String(title ?? ''));
  if (!m) return null;
  const words = ` ${m[3].toLowerCase()} `;
  if (taxonomy.banned_words.some(w => words.includes(` ${w} `))) return null;
  return { date: m[1], kind: m[2], subject: m[3], version: Number(m[4]), superseded: m[5] ?? null, ext: m[6] ?? null };
}

const under = (folder, path) => folder === path || folder.startsWith(`${path}/`);
const leaf = folder => String(folder).split('/').at(-1);
/** Whether a file keeps its own name: the READ ME and index at the top, and anything in a Source files folder. */
export function exempt(file, taxonomy) {
  return (file.folder === taxonomy.root && taxonomy.top_files.includes(file.title)) || taxonomy.exception_folders.some(x => String(file.folder).split('/').includes(x));
}

/**
 * The directive's `library` (protocol 1.35.0, fleet integration I-25) as checkListing's listing: the file titles,
 * folders, types and dates under the root this engine declares. Control Center reads titles, never contents, so the
 * index's entries, the Canva designs and the repository copies are not in it: `canva`, `index` and `sources` are left
 * out and their counts stay unknown. An id is kept only where Control Center serves one (a Current folder), in memory
 * only. Returns `{ unknown: reason }` when the part is not available, null when it is not served. Pure.
 */
export function libraryListing(part) {
  if (!part || typeof part !== 'object') return null;
  if (part.available !== true || part.complete !== true) return { unknown: String(part.reason ?? 'not_available') };
  const roots = Array.isArray(part.roots) ? part.roots : [];
  if (roots.length !== 1) return { unknown: roots.length ? 'more_than_one_root' : 'no_roots' };
  const files = Array.isArray(roots[0].files) ? roots[0].files : [];
  return {
    as_of: typeof part.as_of === 'string' ? part.as_of : null,
    drive: files.filter(f => f && typeof f.title === 'string' && typeof f.folder === 'string')
      .map(f => ({ title: f.title, folder: f.folder, mime: typeof f.mime === 'string' ? f.mime : null, modified: typeof f.modified === 'string' ? f.modified : null, ...(typeof f.id === 'string' ? { id: f.id } : {}) }))
  };
}

export const COUNTS = ['outside_map', 'loose', 'bad_names', 'duplicates', 'current_over_one_pdf', 'drafts_over_cap', 'canva_outside', 'stale_copies', 'index_mismatch'];

/**
 * The counts "The check" lists, each of which should be zero, for one
 * listing: `{ drive: [{ title, folder, mime, modified, copied_from }],
 * canva: [{ title, folder, engine_made }], index: [{ title, folder }],
 * sources: { <repository path>: <last change> } }`. Pure.
 */
export function checkListing(listing, taxonomy) {
  const drive = Array.isArray(listing?.drive) ? listing.drive : [];
  const counts = Object.fromEntries(COUNTS.map(k => [k, 0]));
  const known = new Set(taxonomy.folders);
  const keys = new Map(), pdfs = new Map(), drafts = new Map();
  for (const f of drive) {
    const folder = String(f?.folder ?? '');
    if (!known.has(folder)) counts.outside_map++;
    if (folder === taxonomy.root && !taxonomy.top_files.includes(f.title)) counts.loose++;
    if (!exempt(f, taxonomy)) {
      const n = nameOf(f.title, taxonomy);
      if (!n) counts.bad_names++;
      else { const k = `${n.kind}|${n.subject.toLowerCase()}|${n.version}`; keys.set(k, (keys.get(k) ?? 0) + 1); }
    }
    if (leaf(folder) === taxonomy.current.folder && (f.mime === 'application/pdf' || /\.pdf$/i.test(f.title))) pdfs.set(folder, (pdfs.get(folder) ?? 0) + 1);
    if (leaf(folder) === taxonomy.drafts.folder) drafts.set(folder, (drafts.get(folder) ?? 0) + 1);
    const c = f?.copied_from;
    const changed = c && typeof listing?.sources?.[c.path] === 'string' ? Date.parse(listing.sources[c.path]) : NaN;
    if (c && Number.isFinite(changed) && Number.isFinite(Date.parse(c.commit_at)) && changed > Date.parse(c.commit_at)) counts.stale_copies++;
  }
  for (const n of keys.values()) if (n > 1) counts.duplicates += n - 1;
  for (const n of pdfs.values()) if (n > taxonomy.current.max_pdf) counts.current_over_one_pdf++;
  for (const n of drafts.values()) if (n > taxonomy.drafts.max) counts.drafts_over_cap += n - taxonomy.drafts.max;
  for (const d of Array.isArray(listing?.canva) ? listing.canva : []) if (d?.engine_made === true && !taxonomy.canva.folders.some(p => under(String(d.folder ?? ''), p))) counts.canva_outside++;
  // The index lists every current item: nothing it names is missing, and nothing current is left off it.
  const index = Array.isArray(listing?.index) ? listing.index : [];
  const has = (list, f) => list.some(x => x?.title === f.title && x?.folder === f.folder);
  for (const e of index) if (!has(drive, e)) counts.index_mismatch++;
  for (const f of drive) {
    const folder = String(f?.folder ?? '');
    if (exempt(f, taxonomy) || under(folder, taxonomy.archive) || leaf(folder) === taxonomy.drafts.folder || !known.has(folder) || folder === taxonomy.root) continue;
    if (!has(index, f)) counts.index_mismatch++;
  }
  return counts;
}
