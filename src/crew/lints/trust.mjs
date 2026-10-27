/**
 * The Trust-Asset Steward's lint (plan section 3): trust assets and decision
 * aids (motions.mjs), and the Canva assets to come, the speaker and guest
 * one-sheet first. Lens: does it prove, or decorate? Pure.
 *
 * Two shapes: a proposal that posts (a trust asset's words), and an asset
 * record `{ kit, fonts, colours, text, approved_text, readback_text, facts,
 * pages, contact }` once one is served. A rule that needs a field the action
 * does not carry is not read as passed or failed.
 */
import { finding } from './grammar.mjs';

export const SPECIALIST = 'trust-asset-steward';
export const LINTS = ['trust.mindmake_kit', 'trust.readback_equals_approved', 'trust.facts_by_sha', 'trust.one_page', 'trust.contact_box', 'trust.name_exact', 'trust.never_published', 'trust.no_duration_emoji_dash'];

export const applies = p => p?.wall === 'post' || (p?.asset && typeof p.asset === 'object');

/** "Mindmake" exactly: never MindMake, Mind Make, Mindmaker or mindmake as a name. Lowercase only inside a link or a domain. */
const NAME = /\bmind[\s-]?make(?:r|rs)?\b/gi;
const nameSlips = text => [...String(text).replace(/https:\/\/\S+|\b[a-z0-9.-]*mindmake\.[a-z]{2,}\S*/gi, '').matchAll(NAME)].map(m => m[0]).filter(w => w !== 'Mindmake');
/** What the canon says is never published: a price, a rate card, his availability, the method's name. Unconsented client names need the record and are read on the asset. */
const NEVER = /(?:[$£€]\s?\d|\b\d+\s?(?:usd|gbp|eur|k)\b|\brate card\b|\bper (?:hour|day|session)\b|\bavailab(?:le|ility) (?:on|from|in|for)\b|\bday rate\b|\bthe mindmake method\b)/i;
const DURATION = /\b\d+(?:\.\d+)?\s?(?:-\s?)?(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
/** Krish's own addresses are never the contact on an asset: Jonny's box is. */
const KRISH_MAIL = /\bkrish[a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}\b/i;

/** Findings for one trust asset or asset record. */
export function lint(p) {
  const out = [];
  const asset = p.asset && typeof p.asset === 'object' ? p.asset : null;
  const text = asset ? String(asset.text ?? '') : String(p.exact_payload ?? '');
  if (nameSlips(text).length) out.push(finding('trust.name_exact', p, 'the name is not exactly Mindmake'));
  if (NEVER.test(text)) out.push(finding('trust.never_published', p, 'something the canon never publishes'));
  if (DURATION.test(text) || EMOJI.test(text) || /[\u2014\u2013]/.test(text)) out.push(finding('trust.no_duration_emoji_dash', p, 'a duration, an emoji or a dash'));
  if (KRISH_MAIL.test(text)) out.push(finding('trust.contact_box', p, "Krish's own address as a contact"));
  if (asset) {
    if (asset.kit !== 'Mindmake') out.push(finding('trust.mindmake_kit', p, 'not the Mindmake kit'));
    for (const k of ['fonts', 'colours']) if (Array.isArray(asset[k]) && Array.isArray(asset.kit_allows?.[k]) && asset[k].some(x => !asset.kit_allows[k].includes(x))) out.push(finding('trust.mindmake_kit', p, `${k} outside the kit`));
    if (typeof asset.readback_text !== 'string' || asset.readback_text !== asset.approved_text) out.push(finding('trust.readback_equals_approved', p, 'the read-back text is not the approved text'));
    if (!Array.isArray(asset.facts) || !asset.facts.length || asset.facts.some(f => !/^[0-9a-f]{40}$/.test(f?.sha ?? ''))) out.push(finding('trust.facts_by_sha', p, 'a fact not named by blob SHA'));
    if (asset.pages !== 1) out.push(finding('trust.one_page', p, 'not one page'));
    if (asset.contact !== 'jonny') out.push(finding('trust.contact_box', p, "the contact is not Jonny's box"));
  }
  return out;
}
