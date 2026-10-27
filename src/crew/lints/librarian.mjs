/**
 * The Librarian's lint (plan section 3; docs/DRIVE.md): a filing action
 * before it is made. Lens: could Krish find the current version in ten
 * seconds? Pure; the map and the naming pattern are library/taxonomy.json,
 * generated from docs/DRIVE.md (src/crew/library.mjs).
 *
 * A filing action is `{ op, title, folder, mime, moves }`: `op` is file or
 * move (trash, share and permission changes are never the engine's), and
 * `moves` the other moves made in the same step, so a superseded version
 * goes to the archive with its date in the same change.
 */
import { nameOf, exempt } from '../library.mjs';

export const SPECIALIST = 'librarian';
export const LINTS = ['library.path_in_map', 'library.name_pattern', 'library.no_duplicate', 'library.superseded_archived', 'library.never_trash_or_share', 'library.nothing_private'];

export const applies = p => p?.filing && typeof p.filing === 'object';
/** What a library is shared too widely to hold: an address, a phone number or a profile (rule 8). */
const PRIVATE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|linkedin\.com\/in\/|\+\d[\d ()-]{7,}\d/i;

/** Findings for one filing action against the taxonomy and the current listing. */
export function lint(p, { taxonomy, listing = { drive: [] } }) {
  const f = p.filing;
  const out = [];
  const flag = (lint, detail) => out.push({ lint, proposal_id: p.proposal_id ?? null, detail });
  if (!['file', 'move'].includes(f.op)) flag('library.never_trash_or_share', 'only file and move are the engine\'s');
  if (!taxonomy.folders.includes(f.folder)) flag('library.path_in_map', 'a folder outside the map');
  const named = exempt(f, taxonomy) ? null : nameOf(f.title, taxonomy);
  if (!exempt(f, taxonomy) && !named) flag('library.name_pattern', 'the title fails the naming pattern');
  if (named) {
    const same = (listing.drive ?? []).filter(x => { const n = nameOf(x.title, taxonomy); return n && n.kind === named.kind && n.subject.toLowerCase() === named.subject.toLowerCase() && n.version === named.version; });
    if (same.length) flag('library.no_duplicate', 'the same kind, subject and version is already filed');
    // A newer version in a Current: the version it replaces leaves for the archive in the same step, its superseded date in its title.
    if (String(f.folder).endsWith(`/${taxonomy.current.folder}`)) {
      const older = (listing.drive ?? []).filter(x => x.folder === f.folder && x.title !== f.title);
      const moved = Array.isArray(f.moves) ? f.moves : [];
      if (older.some(o => !moved.some(m => m.from_title === o.title && m.folder === taxonomy.archive && nameOf(m.title, taxonomy)?.superseded))) flag('library.superseded_archived', 'a superseded version stays in Current');
    }
  }
  if (PRIVATE.test(`${f.title} ${f.text ?? ''}`)) flag('library.nothing_private', 'a contact detail in a link-editable library');
  return out;
}
