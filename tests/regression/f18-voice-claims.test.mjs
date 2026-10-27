import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// F18: docs said the voice rules shaped today's drafts, which come from fixed
// templates. The report line was pinned (tests/voice.test.mjs); the same
// claim in NOW.md and prompts/README.md rule 10 is held here. Since plan
// Phase 4, NOW.md's older changes live verbatim in docs/history/LOG.md, so
// the corrected NOW.md line is read from either.
const root = new URL('../../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const CLAIM = /voice rules\b[^.]*\b(?:shape|shapes|shaped|write|writes|wrote|are used in|apply to)\b[^.]*\btoday'?s?\b[^.]*\bdrafts?\b/i;

test("NOW.md and prompts/README.md rule 10 never say the voice rules shape today's drafts (F18)", async () => {
  const now = await read('NOW.md'), log = await read('docs/history/LOG.md'), prompts = await read('prompts/README.md');
  for (const [name, text] of [['NOW.md', now], ['docs/history/LOG.md', log], ['prompts/README.md', prompts], ['docs/RELEASE.md', await read('docs/RELEASE.md')]]) assert.doesNotMatch(text, CLAIM, name);
  const rule = /^10\. Approved voice rules\.(.*)$/m.exec(prompts)?.[1] ?? '';
  assert.match(rule, /No model drafting step runs today/);
  assert.match(rule, /template drafts \(`prepare` and the motion stages\) do not use the rules/);
  assert.match(`${now}\n${log}`, /today's template drafts do not use them/);
  // The test itself catches the claim it guards against.
  assert.match("Krish's voice rules shaped today's drafts.", CLAIM);
});
