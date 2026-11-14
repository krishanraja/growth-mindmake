import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyBundle, bundleLine, bundleDigest, BUNDLE_DIR } from '../src/protocol-bundle.mjs';

// Integration I-11: the protocol copy is Control Center's bundle byte for byte, and each run says whether it is current.
test('the copy here is whole, and a changed byte or a wrong digest is caught', async () => {
  const here = verifyBundle();
  assert.equal(here.ok, true, here.failures.join('; '));
  assert.match(here.bundle_sha256, /^[0-9a-f]{64}$/);
  const dir = await mkdtemp(join(tmpdir(), 'bundle-'));
  await cp(BUNDLE_DIR, dir, { recursive: true });
  await writeFile(join(dir, 'engine-report.example.json'), '{}\n');
  assert.deepEqual(verifyBundle(`${dir}/`).failures, ['engine-report.example.json is not the bundle\'s bytes']);
  assert.equal(bundleDigest('1.0.0', { b: 'y', a: 'x' }), bundleDigest('1.0.0', { a: 'x', b: 'y' }), 'files in name order');
});

test('each run says current, behind or unknown, never a hold', () => {
  const local = { ok: true, version: '1.28.0', bundle_sha256: 'a'.repeat(64), failures: [] };
  assert.equal(bundleLine(local, { version: '1.28.0', bundle_sha256: 'a'.repeat(64) }), 'Protocol copy: current (1.28.0).');
  assert.equal(bundleLine(local, { version: '1.29.0', bundle_sha256: 'b'.repeat(64) }), 'Protocol copy: behind 1.29.0 (this repository holds 1.28.0).');
  assert.match(bundleLine(local, undefined), /^Protocol copy: unknown \(Control Center serves no protocol_bundle this run\)/);
  assert.match(bundleLine({ ok: false, failures: ['bundle.json is missing or not JSON'] }, { bundle_sha256: 'a'.repeat(64) }), /^Protocol copy: unknown \(this repository's copy is not whole/);
});
