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
 * The crew's two lines (src/crew/shadow.mjs, plan Phase 3) are left out of
 * the digest: they are shadow output, added on top of today's report, and
 * leaving them out proves everything else is still byte for byte the report
 * recorded before the week spec. Nothing else is ever left out.
 *
 * GOLDEN_WRITE=1 records instead of checking. Re-record only in a change
 * that is meant to change what a fixture reports, and say so in its PR.
 * Synthetic fixtures only: the files hold digests and nothing else.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { payloadDigest } from '../../src/guards.mjs';
import { CREW_LINE } from '../../src/crew/shadow.mjs';

const dir = new URL('../golden/', import.meta.url);
const file = basename(process.argv[1] ?? 'unknown').replace(/\.test\.mjs$/, '');
const path = new URL(`${file}.json`, dir);
const writing = process.env.GOLDEN_WRITE === '1';
const expected = !writing && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const seen = [], mismatched = [];
// A fixture that stops reporting is a change too: the count must match as well as each digest.
// A mismatch fails the file even where the test that posted it never looks at the report.
if (!writing && expected) process.on('exit', () => {
  if (seen.length !== expected.reports.length) { console.error(`tests/${file}.test.mjs posted ${seen.length} reports; ${expected.reports.length} were recorded before the week spec`); process.exitCode = 1; }
  if (mismatched.length) { console.error(`tests/${file}.test.mjs reports ${mismatched.join(', ')} are not byte-identical to the ones recorded`); process.exitCode = 1; }
});
if (writing) process.on('exit', () => { mkdirSync(dir, { recursive: true }); writeFileSync(path, `${JSON.stringify({ file: `tests/${file}.test.mjs`, reports: seen }, null, 2)}\n`); });

/** A report's digest with the crew's shadow lines left out: the digest it would have had without them. */
export function withoutCrew(report) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.activity)) return report?.payload_sha256 ?? null;
  const { payload_sha256, ...body } = report;
  const activity = body.activity.filter(a => !CREW_LINE.test(a?.line ?? ''));
  return activity.length === body.activity.length ? payload_sha256 : payloadDigest({ ...body, activity });
}

/** Check (or record) one posted report. Returns it unchanged, so a harness can wrap its push. */
export function golden(report) {
  const i = seen.length;
  const digest = withoutCrew(report);
  seen.push(digest);
  if (writing) return report;
  assert.ok(expected, `tests/golden/${file}.json is missing; record it with GOLDEN_WRITE=1 before changing behaviour`);
  if (digest !== expected.reports[i]) mismatched.push(i + 1);
  assert.equal(digest, expected.reports[i], `tests/${file}.test.mjs report ${i + 1} is not byte-identical to the one recorded before the week spec`);
  return report;
}
