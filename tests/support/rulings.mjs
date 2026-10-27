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
