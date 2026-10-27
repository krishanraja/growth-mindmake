/**
 * The Codex task card's allowance guard (plan Phase 4; docs/briefs/2026-10-27-bulletproof-growth-engine.md, section 6).
 *
 * It never dispatches anything itself: Codex lives on Krish's PC. It checks a
 * card and, only when every rule passes, prints the exact command lines for a
 * Claude Code session on his PC and records the dispatch in a ledger under the
 * git-ignored runtime/. It refuses, with a named reason, when:
 *
 *   - the card does not fit specs/schema/task-card.schema.json, its own rules
 *     (branch codex/<id>, every never item, the worktree named for its id) or
 *     6 KB (`card_invalid`, `card_too_large`);
 *   - the usage reading is unknown: no reading, no date, no source, no
 *     percentage, or a date in the future (`usage_unknown`);
 *   - the reading is not newer than the last dispatched card, or more than a
 *     day old (`usage_stale`);
 *   - usage is above 80% (`usage_above_80`);
 *   - there is no yes for this card (`no_approval`): his yes is a decision on
 *     his Control Center list, named by its id and the payload digest it was
 *     made on, which must be this card's digest (`approval_mismatch`) and
 *     must not have dispatched a card before (`approval_used`).
 *
 *   node scripts/dispatch-card.mjs --card <file> --usage <file> --approval <decision-id>:<sha256> [--plugin <dir>]
 *   node scripts/dispatch-card.mjs --card <file> --check      (validate and print the digest to ask his yes on)
 *
 * The usage file is `{ "read_at": "<ISO time>", "source": "<where it was read>", "used_percent": <0 to 100> }`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { payloadDigest, schemaErrors } from '../src/guards.mjs';

export const CARD_MAX = 6 * 1024;
export const USAGE_MAX = 80;
/** A reading older than this is stale even when nothing was dispatched since. */
export const USAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Plan section 6's never list: no git, network, MCP, publishing, new dependencies, or edits outside write_allow. */
export const NEVER_REQUIRED = ['git', 'network', 'mcp', 'publishing', 'new_dependencies', 'edits_outside_write_allow'];
export const CARD_SCHEMA = JSON.parse(await readFile(new URL('../specs/schema/task-card.schema.json', import.meta.url), 'utf8'));
export const LEDGER = 'runtime/codex/ledger.json';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const SHA = /^[a-f0-9]{64}$/;
const DECISION = /^[A-Za-z0-9_-]{4,80}$/;

const refuse = (reason, detail) => ({ ok: false, reason, detail });

/** Every reason a card cannot be dispatched, from its parsed form and the bytes of its file. Pure. */
export function cardErrors(card, text) {
  const errors = schemaErrors(CARD_SCHEMA, card);
  if (errors.length) return errors;
  if (card.worktree.branch !== `codex/${card.id}`) errors.push(`the branch must be codex/${card.id}`);
  if (card.worktree.dir !== `../growth-mindmake-codex-${card.id}`) errors.push(`the worktree must be ../growth-mindmake-codex-${card.id}`);
  for (const n of NEVER_REQUIRED) if (!card.never.includes(n)) errors.push(`the never list must hold ${n}`);
  for (const [k, list] of [['never', card.never], ['write_allow', card.write_allow], ['read', card.read], ['acceptance', card.acceptance]]) if (new Set(list).size !== list.length) errors.push(`${k} names an item twice`);
  for (const r of card.returns.required) if (!Object.hasOwn(card.returns.properties, r)) errors.push(`returns.required names ${r}, which returns.properties does not describe`);
  return errors;
}

/** The SHA-256 his yes is bound to: canonical JSON of the card. Pure. */
export const cardDigest = card => payloadDigest(card);

/** A usage reading's problem, or null when it is usable now. Pure. */
export function usageProblem(usage, { now, last }) {
  if (!usage || typeof usage !== 'object') return refuse('usage_unknown', 'No usage reading was given, so the allowance is unknown.');
  if (typeof usage.read_at !== 'string' || !ISO.test(usage.read_at) || !Number.isFinite(Date.parse(usage.read_at))) return refuse('usage_unknown', 'The usage reading has no date.');
  if (typeof usage.source !== 'string' || !usage.source.trim() || usage.source.length > 200) return refuse('usage_unknown', 'The usage reading names no source.');
  if (typeof usage.used_percent !== 'number' || !Number.isFinite(usage.used_percent) || usage.used_percent < 0 || usage.used_percent > 100) return refuse('usage_unknown', 'The usage reading has no percentage used.');
  const read = Date.parse(usage.read_at), at = Date.parse(now);
  if (read > at + 5 * 60 * 1000) return refuse('usage_unknown', 'The usage reading is dated in the future.');
  if (last && read <= Date.parse(last.dispatched_at)) return refuse('usage_stale', `The usage reading (${usage.read_at}) is not newer than the last dispatched card (${last.card_id} at ${last.dispatched_at}); read usage again.`);
  if (at - read > USAGE_MAX_AGE_MS) return refuse('usage_stale', `The usage reading (${usage.read_at}) is more than a day old; read usage again.`);
  if (usage.used_percent > USAGE_MAX) return refuse('usage_above_80', `Usage is ${usage.used_percent}%, above ${USAGE_MAX}%.`);
  return null;
}

/** His yes in `<decision-id>:<sha256>` form, parsed, or null. Pure. */
export function parseApproval(text) {
  const m = /^([^:\s]+):([a-f0-9]{64})$/.exec(String(text ?? '').trim());
  return m && DECISION.test(m[1]) ? { decision_id: m[1], payload_sha256: m[2] } : null;
}

/** The command lines for his local Claude Code session. Pure. */
export function commandLines(card, { cardPath, plugin = '<plugin>' }) {
  const companion = `node ${plugin}/scripts/codex-companion.mjs`;
  return [
    `git worktree add -b ${card.worktree.branch} ${card.worktree.dir} ${card.worktree.from}`,
    `${companion} task --background --fresh --write --model ${card.model.name} --effort ${card.model.effort} --cwd ${card.worktree.dir} --prompt-file ${cardPath}`,
    `${companion} status --wait`,
    `${companion} result`,
    `node scripts/verify-card.mjs --card ${cardPath} --worktree ${card.worktree.dir}`
  ];
}

/**
 * The guard. Pure: it reads nothing and writes nothing; the CLI reads the
 * files and keeps the ledger. Returns the refusal, or the digest, the
 * command lines and the ledger entry to record.
 */
export function guard({ card, text, usage, approval, ledger = [], now, cardPath, plugin }) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > CARD_MAX) return refuse('card_too_large', `The card is ${typeof text === 'string' ? Buffer.byteLength(text, 'utf8') : 'an unknown number of'} bytes; a card is ${CARD_MAX} or fewer.`);
  const errors = card && typeof card === 'object' ? cardErrors(card, text) : ['the card is not a JSON object'];
  if (errors.length) return refuse('card_invalid', errors.slice(0, 5).join('; '));
  const digest = cardDigest(card);
  const list = Array.isArray(ledger) ? ledger : [];
  const last = list.length ? list[list.length - 1] : null;
  const u = usageProblem(usage, { now, last });
  if (u) return u;
  if (!approval) return refuse('no_approval', `There is no yes for this card. Ask for it on his Control Center list on digest ${digest}, then pass --approval <decision-id>:${digest}.`);
  if (approval.payload_sha256 !== digest) return refuse('approval_mismatch', `His yes was made on ${approval.payload_sha256}, not on this card's digest ${digest}; the card changed or the yes is for another card.`);
  if (list.some(e => e.decision_id === approval.decision_id)) return refuse('approval_used', `Decision ${approval.decision_id} already dispatched a card; each card needs its own yes.`);
  const entry = { card_id: card.id, card_sha256: digest, decision_id: approval.decision_id, usage: { read_at: usage.read_at, source: usage.source, used_percent: usage.used_percent }, dispatched_at: new Date(now).toISOString() };
  return { ok: true, digest, bytes: Buffer.byteLength(text, 'utf8'), lines: commandLines(card, { cardPath, plugin }), entry };
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') { out.check = true; continue; }
    if (!['--card', '--usage', '--approval', '--plugin', '--at', '--ledger'].includes(a)) throw new Error(`Unknown argument ${a}`);
    out[a.slice(2)] = argv[++i];
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fail = (reason, detail) => { console.error(`REFUSED (${reason}): ${detail}`); process.exitCode = 1; };
  try {
    const a = args(process.argv.slice(2));
    if (!a.card) throw new Error('Name the card: --card <file>.');
    const text = await readFile(resolve(a.card), 'utf8');
    let card = null; try { card = JSON.parse(text); } catch { card = null; }
    if (a.check) {
      const size = Buffer.byteLength(text, 'utf8');
      const errors = size > CARD_MAX ? [`${size} bytes; a card is ${CARD_MAX} or fewer`] : card && typeof card === 'object' ? cardErrors(card, text) : ['the card is not a JSON object'];
      if (errors.length) fail(size > CARD_MAX ? 'card_too_large' : 'card_invalid', errors.slice(0, 5).join('; '));
      else console.log(`PASS: card ${card.id}, ${size} bytes, digest ${cardDigest(card)}. Ask his yes on this digest on his Control Center list.`);
    } else {
      let usage = null;
      if (a.usage) { try { usage = JSON.parse(await readFile(resolve(a.usage), 'utf8')); } catch { usage = null; } }
      const ledgerFile = resolve(root, a.ledger ?? LEDGER);
      let ledger = [];
      try { ledger = JSON.parse(await readFile(ledgerFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('The dispatch ledger cannot be read; nothing is dispatched until it can.'); }
      const r = guard({ card, text, usage, approval: parseApproval(a.approval), ledger, now: a.at ?? new Date().toISOString(), cardPath: a.card, plugin: a.plugin });
      if (!r.ok) fail(r.reason, r.detail);
      else {
        await mkdir(dirname(ledgerFile), { recursive: true });
        await writeFile(ledgerFile, JSON.stringify([...ledger, r.entry], null, 2) + '\n');
        console.log(`PASS: card ${card.id} (${r.bytes} bytes, digest ${r.digest}) may go to Codex. Usage ${usage.used_percent}% at ${usage.read_at} from ${usage.source}; his yes is decision ${r.entry.decision_id}. Recorded in ${a.ledger ?? LEDGER}.`);
        console.log(`Run these in a Claude Code session on Krish's PC, from the main checkout. Check first that ${card.model.name} is on Codex's own model list; never the codex-rescue subagent.`);
        for (const l of r.lines) console.log(`  ${l}`);
      }
    }
  } catch (e) { fail('error', e.message); }
}
