/**
 * No per-run bespoke code (plan section 4, "Bespoke code per run", the
 * 27 October pattern): no run id, no dated value and no person in a string
 * literal in src/. Comments are free, and a dated ruling citation ("Ruling,
 * Krish, 2026-10-27") is allowed, since it names where a rule came from.
 * A constant that is dated by design is named below with its reason.
 *
 *   node scripts/check-bespoke.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

/** Dated by design, each with its reason. A new entry needs a reason a reviewer accepts. */
export const ALLOW = [
  { file: 'src/crew/compile.mjs', literal: '2026-11-09', reason: 'FIRST_SPEC_WEEK: the week the signed spec takes over, set by the plan (Phase 2)' },
  { file: 'src/stages/pitches.mjs', literal: 'hello@krishraja.com', reason: "FORM_EMAIL: the one public business address a stage form is given for him (playbook 11)" }
];

/** What a string literal must never carry. */
export const RULES = [
  ['run id', /\bmindmake:\d{4}-\d{2}-\d{2}\b|\b(?:manual|dispatch)-\d+\b|\bgm[a-z]-[0-9a-f]{16,}\b/],
  ['dated value', /\b20\d{2}-\d{2}-\d{2}\b/],
  ['address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/],
  ['id', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ['profile', /linkedin\.com\/in\/[A-Za-z0-9-]/],
  ['phone number', /\+\d{1,3}[ -]?\d{3,4}[ -]?\d{3,4}[ -]?\d{0,4}/]
];
const CITATION = /\b(?:Ruling, )?Krish, 20\d{2}-\d{2}-\d{2}\b/g;

/**
 * Every string literal in a JavaScript source, with comments, regular
 * expressions and code skipped: quoted strings whole, and a template's text
 * parts (its ${} parts are code, read as code). Pure.
 */
export function literals(src) {
  const out = [];
  let i = 0, prev = '';
  const n = src.length;
  const regexAllowed = () => !prev || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(?:return|typeof|case|in|of|delete|void|throw|new)$/.test(prev);
  function code(stopAtBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
      if (c === '"' || c === "'") { let s = ''; i++; while (i < n && src[i] !== c) { if (src[i] === '\\') { s += src[i + 1] ?? ''; i += 2; } else s += src[i++]; } i++; out.push(s); prev = 'x'; continue; }
      if (c === '`') { i++; template(); prev = 'x'; continue; }
      if (c === '/' && regexAllowed()) { i++; let cls = false; while (i < n && (cls || src[i] !== '/')) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; } i++; while (/[a-z]/.test(src[i] ?? '')) i++; prev = 'x'; continue; }
      if (stopAtBrace) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) { i++; return; } depth--; } }
      if (!/\s/.test(c)) prev = (/[A-Za-z0-9_$]/.test(c) && /[A-Za-z0-9_$]$/.test(prev)) ? prev + c : c;
      i++;
    }
  }
  function template() {
    let s = '';
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i + 1] ?? ''; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { out.push(s); s = ''; i += 2; prev = '{'; code(true); continue; }
      s += src[i++];
    }
    i++; out.push(s);
  }
  code(false);
  return out.filter(s => s.length);
}

/** Every finding in one file: what rule a literal broke, never the literal itself, so a person's name or an address is never printed. */
export function findings(file, src) {
  const out = [];
  for (const lit of literals(src)) {
    const text = lit.replace(CITATION, '');
    for (const [rule, re] of RULES) {
      if (!re.test(text)) continue;
      if (ALLOW.some(a => a.file === file && lit.includes(a.literal) && !re.test(text.replaceAll(a.literal, '')))) continue;
      out.push({ file, rule });
    }
  }
  return out;
}

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p)); else if (/\.mjs$/.test(e.name)) files.push(p);
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const found = [];
  for (const f of await walk(resolve(root, 'src'))) found.push(...findings(relative(root, f), await readFile(f, 'utf8')));
  if (found.length) { console.error(found.map(f => `${f.file}: a string literal carries a ${f.rule}`).join('\n')); process.exitCode = 1; }
  else console.log('PASS: no run id, dated value, address, id, profile or phone number in a src string literal');
}
