/**
 * The Measurement Specialist's lint (plan section 3): every link the engine
 * writes and every number it reports. Lens: would this survive "show me the
 * meeting", with every visit figure saying what it cannot see? Pure; the tag
 * rules are traffic.mjs's and the paths meetings.mjs's, imported, never
 * restated.
 */
import { tagged, untagged, TAG_PATHS, CONSENT, SITE } from '../../stages/traffic.mjs';
import { PATHS } from '../../stages/meetings.mjs';
import { SHOW_NOTES_KIND } from '../../stages/shownotes.mjs';
import { FORM_SITE } from '../../stages/pitches.mjs';
import { actionOf, wordsOf, linksIn, finding } from './grammar.mjs';

export const SPECIALIST = 'measurement-specialist';
export const LINTS = ['measurement.link_canon', 'measurement.tag_placement', 'measurement.tag_keys', 'measurement.meeting_path', 'measurement.null_not_zero', 'measurement.traffic_consent'];

export const applies = () => true;

/** The links in a proposal's words that carry a utm key. */
export function taggedLinks(p) { return linksIn(wordsOf(p)).filter(u => /[?&]utm_[a-z]+=/i.test(u)); }
const onSite = u => { try { return new URL(u).hostname === SITE; } catch { return false; } };

/** Findings for one proposal's links. A link is the canon's URL byte for byte, or that URL plus exactly the two allowed keys on a public placement. */
export function lint(p, ctx) {
  const out = [];
  const a = actionOf(p);
  const placement = a?.kind === SHOW_NOTES_KIND;
  const canonUrls = new Set([ctx.canon?.ask?.url, ctx.canon?.publication?.url, FORM_SITE].filter(Boolean));
  for (const u of linksIn(wordsOf(p))) {
    let keys;
    try { keys = [...new URL(u).searchParams.keys()].filter(k => /^utm_/i.test(k)); } catch { continue; }
    if (keys.some(k => !['utm_source', 'utm_medium'].includes(k))) out.push(finding('measurement.tag_keys', p, 'a utm key off the allowlist'));
    if (keys.length) {
      if (!placement) out.push(finding('measurement.tag_placement', p, 'a tag outside a public placement'));
      const base = untagged(u);
      if (!onSite(u) || !canonUrls.has(base) || !TAG_PATHS.some(path => tagged(base, path) === u)) out.push(finding('measurement.link_canon', p, 'a tagged link that is not the canon URL plus the two keys'));
    } else if (onSite(u) && !canonUrls.has(u)) out.push(finding('measurement.link_canon', p, 'a mindmake.co link that is not the canon URL'));
  }
  return out;
}

/** Findings over the report itself: every number it states, and every traffic line. */
export function lintReport({ objectives = [], activity = [], origin_candidates = null }) {
  const out = [];
  for (const o of objectives) if (o?.value === 0 && o.availability !== 'measured') out.push({ lint: 'measurement.null_not_zero', proposal_id: null, detail: `${o.key} reads zero without a measurement` });
  for (const c of Array.isArray(origin_candidates) ? origin_candidates : []) if (!PATHS.includes(c?.path)) out.push({ lint: 'measurement.meeting_path', proposal_id: null, detail: 'an origin off the path list' });
  for (const line of activity) if (/^mindmake\.co\b|What the engine's placements sent mindmake\.co/.test(line) && !line.includes(CONSENT)) out.push({ lint: 'measurement.traffic_consent', proposal_id: null, detail: 'a traffic line without the consent sentence' });
  return out;
}
