/**
 * What plan Phase 4's shortening must keep, derived from AGENTS.md and
 * NOW.md as they stood on main at commit c6f95c5 (the fixture
 * tests/fixtures/rulings/at-main.json). tests/rulings.test.mjs checks the
 * current files against it, and, where git holds that commit, re-derives the
 * fixture from it so the fixture cannot drift from what main held. Pure.
 */
import { createHash } from 'node:crypto';

export const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');

/** `## ` sections of a Markdown text: each heading with its body trimmed. Pure. */
export function sections(markdown) {
  const out = []; let cur = null;
  for (const l of String(markdown).split('\n')) {
    if (l.startsWith('## ')) { if (cur) out.push(cur); cur = { heading: l.slice(3), lines: [] }; }
    else if (cur) cur.lines.push(l);
  }
  if (cur) out.push(cur);
  return out.map(s => ({ heading: s.heading, body: s.lines.join('\n').trim() }));
}
export const RULING = /\(Rulings?, Krish, \d{4}-\d{2}-\d{2}\)/;
export const STANDING = ['North Star: read it first, every session', '"Get going"', 'Current release boundary', 'Privacy and action authority', 'Checks and delivery'];
export const OWNERS = 'One owner per responsibility';

/** The keys Control Center's North Star reader writes into the state line, in its order. */
export const STATE_KEYS = ['week_of', 'week_target', 'current', 'current_as_of', 'current_source', 'urgency', 'urgency_reason'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const countOrNull = v => v === null || (Number.isSafeInteger(v) && v >= 0);

/**
 * Whether a NOW.md state line is one Control Center's North Star reader may
 * have written: the same seven keys and nothing else, `current` and
 * `week_target` a whole count or null, and a sentence that opens the way the
 * contract's does. The good-meetings count on this one line is the only
 * business figure this public repository may hold (Ruling, Krish,
 * 2026-10-29, docs/RULINGS.md). Pure.
 */
export function controlCenterStateLine(line) {
  const m = /^<!-- north-star-state (\{.*?\}) --> (\*\*North Star number: (?:U[1-5], [a-z ,]+|paused)\.\*\*) (.+)$/.exec(String(line ?? ''));
  if (!m) return false;
  let s; try { s = JSON.parse(m[1]); } catch { return false; }
  if (!s || typeof s !== 'object' || Array.isArray(s) || JSON.stringify(Object.keys(s)) !== JSON.stringify(STATE_KEYS)) return false;
  if (!countOrNull(s.current) || !countOrNull(s.week_target)) return false;
  if (!(s.week_of === null || DAY.test(s.week_of))) return false;
  if (!(s.current_as_of === null || (typeof s.current_as_of === 'string' && s.current_as_of.length <= 40))) return false;
  if (!(s.current_source === null || (typeof s.current_source === 'string' && s.current_source.length <= 200))) return false;
  if (!(s.urgency === null || [1, 2, 3, 4, 5].includes(s.urgency))) return false;
  if (!(s.urgency_reason === null || typeof s.urgency_reason === 'string')) return false;
  // The sentence names only the count, the week's target and the goal: no money, no percentage.
  return !/[$\u00a3\u20ac%]/.test(m[3]);
}

/** Every double-quoted run of words: his quotes and the names the rules quote. Pure. */
export const quotes = markdown => [...new Set([...String(markdown).matchAll(/"([^"\n]+)"/g)].map(m => m[1]))];

/** The fixture's content from AGENTS.md and NOW.md as main held them. Pure. */
export function derive({ agents, now }) {
  const secs = sections(agents);
  const owner = secs.find(s => s.heading === OWNERS);
  const changed = sections(now).find(s => s.heading === 'What changed recently');
  return {
    quotes: quotes(agents),
    ruling_sections: secs.filter(s => RULING.test(s.heading)).map(s => ({ heading: s.heading, sha256: sha(s.body) })),
    standing_sections: secs.filter(s => STANDING.includes(s.heading)).map(s => ({ heading: s.heading, sha256: sha(s.body) })),
    owner_lines: owner.body.split('\n').filter(l => l.trim()).map(sha),
    now: {
      front_matter_keys: [...(/^---\n([\s\S]*?)\n---/.exec(now)?.[1] ?? '').matchAll(/^([a-z_]+):/gm)].map(m => m[1]),
      state_line_sha256: sha(String(now).split('\n').find(l => l.includes('<!-- north-star-state'))),
      headings: String(now).split('\n').filter(l => /^#{1,6} /.test(l)),
      changed_bullets: changed.body.split('\n').filter(l => l.startsWith('- ')).map(sha)
    }
  };
}
