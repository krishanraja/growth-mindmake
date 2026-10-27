/**
 * The golden reports (plan Phase 2, accept: "every fixture gives a
 * byte-identical report under the default spec"). Every report a dispatch
 * test posts, in the order its file posts them, is checked against the
 * digest the same fixture gave before the week spec existed. A report's
 * payload_sha256 is the SHA-256 of its whole canonical body, so an equal
 * digest is an equal report, byte for byte.
 *
 * Digests are matched in the order a file posts them, so run whole files:
 * a name filter that skips a posting test fails the count check.
 *
 * GOLDEN_WRITE=1 records instead of checking. Re-record only in a change
 * that is meant to change what a fixture reports, and say so in its PR.
 * Synthetic fixtures only: the files hold digests and nothing else.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const dir = new URL('../golden/', import.meta.url);
const file = basename(process.argv[1] ?? 'unknown').replace(/\.test\.mjs$/, '');
const path = new URL(`${file}.json`, dir);
const writing = process.env.GOLDEN_WRITE === '1';
const expected = !writing && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const seen = [];
// A fixture that stops reporting is a change too: the count must match as well as each digest.
if (!writing && expected) process.on('exit', () => { if (seen.length !== expected.reports.length) { console.error(`tests/${file}.test.mjs posted ${seen.length} reports; ${expected.reports.length} were recorded before the week spec`); process.exitCode = 1; } });
if (writing) process.on('exit', () => { mkdirSync(dir, { recursive: true }); writeFileSync(path, `${JSON.stringify({ file: `tests/${file}.test.mjs`, reports: seen }, null, 2)}\n`); });

/** Check (or record) one posted report. Returns it unchanged, so a harness can wrap its push. */
export function golden(report) {
  const i = seen.length;
  seen.push(report?.payload_sha256 ?? null);
  if (writing) return report;
  assert.ok(expected, `tests/golden/${file}.json is missing; record it with GOLDEN_WRITE=1 before changing behaviour`);
  assert.equal(report?.payload_sha256, expected.reports[i], `tests/${file}.test.mjs report ${i + 1} is not byte-identical to the one recorded before the week spec`);
  return report;
}
