/**
 * The Trust-Asset Steward's measured check: the PDF at its URL is the one
 * Control Center approved by SHA. Unknown until Control Center serves the
 * asset in force (`asset_ref`) with the SHA it read back. Pure.
 */
import { measured, unknown } from './common.mjs';

export const SPECIALIST = 'trust-asset-steward';
export const CHECKS = ['trust.pdf_sha_matches'];
const SHA = /^[0-9a-f]{40,64}$/;
export function measure({ context }) {
  const a = context?.asset_ref;
  if (!a || typeof a !== 'object' || !SHA.test(a.approved_sha ?? '') || !SHA.test(a.read_sha ?? '')) return [unknown('trust.pdf_sha_matches', 'the asset in force is not served yet')];
  return [measured('trust.pdf_sha_matches', a.approved_sha === a.read_sha ? 1 : 0)];
}
