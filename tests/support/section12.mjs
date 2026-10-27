/**
 * A synthetic Mindmake canon with the parts plan section 12 (M6, M9 and M12)
 * reads: the buyer groups, who it is for, the best-fit moments, the sales
 * wedge, the offer's noun and public shape, the retired offers and the
 * revenue door's line. The words are invented and only the markup matches
 * the real files, so a test proves the reader, never a copy of the canon.
 */
import { parseCanon, blobSha } from '../../src/stages/canon.mjs';

export const NORTH_STAR = `# North Star

## Horizon

> By March 2027, Mindmake is the first name a PE or VC backed media, adtech or data leader hears when they ask who can build an AI that knows them.

## Mindmake in one page

- **Build your AI brain** (\`/ai-brain\`): the leader's own judgement, running as
  a system they own.
- **Build your AI revenue engine** (\`/ai-gtm\`): their example pricing and team
  rebuilt for AI, then tested with real buyers.

Either door leads to one example proof. The public shape is 30 days, stated on the two door pages only. The price is agreed privately and never published.

## Who this is for

A founder, principal, portfolio owner or senior commercial leader who
can move a decision on their own, and whose decisions matter.

## What we sell

- **Build your AI brain.** Your taste, standards and judgement, running as a
  system you own.

Both lead to **one paid proof**: pick one decision, build a first version.
`;

export const CANON = `# 01. Canon

## Who buys

**Buyer groups.** Founder. CEO. CRO, or whoever owns revenue. Strategy leader.

**The gate.** The person must own, or be able to move, the decision.

**Best-fit moments.**

- Growth is possible, but the product or the price is holding it back.
- AI has changed an important product, sales or company decision.
- The leader knows something is wrong but cannot yet name the real
  problem.

**Poor fit.** The person cannot move the decision. The request is only for training.

**Sales wedge, internal only, never the public position.** Media, data and publishing businesses, because the proof is strongest there. Coaching businesses can also fit well.

### The archetype

Private.

## Do not reintroduce

One list, so it does not have to be repeated:

- The Example Audit, The Example Handover, the 14-day Sprint, or any other offer ladder.
- Public prices.

## What the growth engine may say

1. **Start building your AI brain**, at \`https://mindmake.example.org/?start=1\`. The main ask,
   for a leader who can decide. Describe it as
   the site does: answer a few questions, keep the brief, then a free consultation.
2. **Subscribe to Make Your Mind Up**, at \`https://publication.example.org\`, free.
`;

export const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };

export const AT = '2026-10-27T09:00:00.000Z';
export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const daysAgo = d => new Date(Date.parse(AT) - d * 86400000).toISOString();

/** Stand-ins for Control Center's own copy (api/_mission.ts DOOR, api/_venturePositioning.ts's Mindmake angle), invented so that this public repository never carries Control Center's private words: each trips the same findings the real copy does. */
export const CC_DOOR = 'A paid four week workshop, flat fee, that shows an example leader where they stand. Sold first to people he already knows.';
export const CC_MINDMAKE_ANGLE = 'An example sprint that takes the team from noise to a shipped system in a matter of weeks.';
/** api/pilot-deals/seed.ts INDUSTRY, for the parity table only. */
export const CC_INDUSTRY = ['media', 'advertising', 'adtech', 'publishing', 'broadcast', 'data', 'martech'];
