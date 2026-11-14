/**
 * Control Center's protocol bundle, kept byte for byte in docs/control-center/
 * (integration I-11): ENGINE-PROTOCOL.md, both schemas, the example and
 * bundle.json. Never edited here: refreshed by copying Control Center's
 * docs/app/growth/protocol-bundle/ whole.
 *
 * `bundle_sha256` is sha256("version <v>\n" + "<file> <sha256>\n" for each
 * file in name order). `verifyBundle` proves the copy is whole; `bundleLine`
 * says each run whether it is the bundle Control Center serves.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BUNDLE_DIR = fileURLToPath(new URL('../docs/control-center/', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');

/** The bundle's own digest from its version and its files' digests. Pure. */
export function bundleDigest(version, files) {
  return sha(`version ${version}\n${Object.keys(files).sort().map(f => `${f} ${files[f]}\n`).join('')}`);
}

/** Whether the copy is whole: every file's sha256 as bundle.json says, and its bundle_sha256. { ok, version, bundle_sha256, failures }. */
export function verifyBundle(dir = BUNDLE_DIR) {
  const failures = [];
  let b;
  try { b = JSON.parse(readFileSync(`${dir}bundle.json`, 'utf8')); } catch { return { ok: false, version: null, bundle_sha256: null, failures: ['bundle.json is missing or not JSON'] }; }
  if (!b || typeof b.version !== 'string' || !b.files || typeof b.files !== 'object' || typeof b.bundle_sha256 !== 'string') return { ok: false, version: null, bundle_sha256: null, failures: ['bundle.json lacks version, files or bundle_sha256'] };
  for (const [f, want] of Object.entries(b.files)) {
    let got = null;
    try { got = sha(readFileSync(`${dir}${f}`)); } catch { failures.push(`${f} is missing`); continue; }
    if (got !== want) failures.push(`${f} is not the bundle's bytes`);
  }
  if (bundleDigest(b.version, b.files) !== b.bundle_sha256) failures.push('bundle_sha256 does not match its files');
  return { ok: failures.length === 0, version: b.version, bundle_sha256: b.bundle_sha256, failures };
}

/**
 * One counted line each run: current, behind the version Control Center
 * serves, or unknown. Never a hold. `served` is capabilities' protocol_bundle
 * `{ version, bundle_sha256 }`. Pure.
 */
export function bundleLine(local, served) {
  const ok = s => s && typeof s === 'object' && typeof s.bundle_sha256 === 'string' && /^[0-9a-f]{64}$/.test(s.bundle_sha256);
  if (!local?.ok) return `Protocol copy: unknown (this repository's copy is not whole: ${local?.failures?.[0] ?? 'unread'}).`;
  if (!ok(served)) return `Protocol copy: unknown (Control Center serves no protocol_bundle this run); this repository holds ${local.version}.`;
  if (served.bundle_sha256 === local.bundle_sha256) return `Protocol copy: current (${local.version}).`;
  return `Protocol copy: behind ${typeof served.version === 'string' ? served.version.slice(0, 20) : 'unknown'} (this repository holds ${local.version}).`;
}
