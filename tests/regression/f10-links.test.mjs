import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { brokenLinks } from '../../scripts/check-links.mjs';

// F10: the copied protocol linked to a path outside this repository, and the
// fault came back. The local link check (scripts/check-links.mjs, run by
// npm run check) now holds every relative Markdown link.
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');

test('every relative Markdown link resolves inside the repository, the copied protocol included (F10)', async () => {
  assert.deepEqual(await brokenLinks(root), []);
  const protocol = await readFile(new URL('../../docs/control-center/ENGINE-PROTOCOL.md', import.meta.url), 'utf8');
  assert.doesNotMatch(protocol, /\]\(\.\.\/\.\.\//, 'no link climbs out of docs/');
  assert.match(protocol, /\]\(https:\/\/github\.com\/krishanraja\/control-center\/blob\/main\/docs\/DECISIONS\/038-/, 'the ADR is an absolute link (the bundle, byte for byte, I-11)');
});
