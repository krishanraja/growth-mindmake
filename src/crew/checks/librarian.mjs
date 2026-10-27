/**
 * The Librarian's measured check: the counts docs/DRIVE.md's "The check"
 * lists, over the listing of the Growth library. Unknown until Control
 * Center serves that listing to the dispatch (`context.library`). Pure.
 */
import { checkListing, COUNTS } from '../library.mjs';
import { measured, unknown } from './common.mjs';

export const SPECIALIST = 'librarian';
export const CHECKS = ['library.listing', ...COUNTS.map(c => `library.${c}`)];
export function measure({ context, taxonomy }) {
  const listing = context?.library;
  if (!listing || typeof listing !== 'object' || !Array.isArray(listing.drive) || !taxonomy) return [unknown('library.listing', 'Control Center does not serve the library listing yet')];
  const counts = checkListing(listing, taxonomy);
  return [measured('library.listing', listing.drive.length), ...COUNTS.map(c => measured(`library.${c}`, counts[c]))];
}
