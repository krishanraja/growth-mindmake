/**
 * The local link check (F10; plan section 4, "Claims in docs"): every
 * relative link in this repository's Markdown resolves to a file or folder
 * inside it. A link out of the repository, as the copied protocol once had,
 * fails. Web links and in-page anchors are not followed.
 *
 *   node scripts/check-links.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative, dirname, sep } from 'node:path';

const SKIP = new Set(['.git', 'node_modules', 'runtime', 'work', '_corpus']);

/** The relative link targets in one Markdown text, code spans and fences left out. Pure. */
export function linkTargets(markdown) {
  const text = String(markdown).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const out = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const t = m[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(t)) continue;
    out.push(decodeURIComponent(t.split('#')[0]));
  }
  return out.filter(Boolean);
}

/** Every broken relative link under `root`: the file and the target, never followed outside the repository. */
export async function brokenLinks(root) {
  const broken = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = resolve(dir, e.name);
      if (e.isDirectory()) { await walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      for (const t of linkTargets(await readFile(p, 'utf8'))) {
        const target = resolve(dirname(p), t);
        const inside = target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);
        if (!inside || !existsSync(target)) broken.push({ file: relative(root, p), target: t, reason: inside ? 'missing' : 'outside the repository' });
      }
    }
  }
  await walk(root);
  return broken;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
  const broken = await brokenLinks(root);
  if (broken.length) { console.error(broken.map(b => `${b.file}: ${b.target} (${b.reason})`).join('\n')); process.exitCode = 1; }
  else console.log('PASS: every relative Markdown link resolves inside the repository');
}
