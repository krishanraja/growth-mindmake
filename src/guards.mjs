import { createHash } from 'node:crypto';
import { APPROVED_CANON, parseSnapshot } from '../contracts/growth.ts';

export const DAY = 86400000;
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function seal(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
export function ageDays(value, at) { return (Date.parse(at) - Date.parse(value)) / DAY; }
export function fresh(e, at, days) { const age = ageDays(e.observed_at, at); return age >= 0 && age <= days; }
export function clean(value) { return String(value).replaceAll('\u2014', ', ').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(); }
export function validateContext(input, policy, at) {
  const requiredLimits = ['recommendations_per_run','contacts_per_snapshot','evidence_max_age_days','trigger_max_age_days','snapshot_max_age_hours','canon_max_age_days','cooldown_days','max_follow_ups'];
  if (!policy || !policy.limits || requiredLimits.some(k => !Number.isInteger(policy.limits[k]) || policy.limits[k] < 1) || policy.limits.evidence_max_age_days > 90 || policy.limits.trigger_max_age_days > 30 || policy.limits.snapshot_max_age_hours > 24 || policy.limits.canon_max_age_days > 30 || policy.limits.cooldown_days < 14 || policy.limits.max_follow_ups !== 1 || policy.limits.contacts_per_snapshot > 100 || !Array.isArray(policy.motions) || policy.motions.some(x => !['warm','intro','cold','follow_up'].includes(x)) || !policy.targets || Object.values(policy.targets).some(x => !Number.isInteger(x) || x < 1)) throw new Error('Unsafe engine policy: limits, targets or motions are invalid');
  const snapshot = parseSnapshot(input);
  if (!Number.isFinite(Date.parse(at))) throw new Error('Invalid run clock');
  if (!snapshot.complete) throw new Error('Snapshot incomplete: no planning or writes allowed');
  const snapshotAge = ageDays(snapshot.generated_at, at) * 24;
  if (snapshotAge < -0.1 || snapshotAge > policy.limits.snapshot_max_age_hours) throw new Error('Snapshot is stale or future dated');
  if (stable(snapshot.canon) !== stable(APPROVED_CANON)) throw new Error('Canon does not match the reviewed contract');
  if (ageDays(snapshot.canon.approved_at, at) < 0 || ageDays(snapshot.canon.approved_at, at) > policy.limits.canon_max_age_days) throw new Error('Canon needs a current source review');
  if (!snapshot.icp.defined) throw new Error('Buyer definition missing in the canonical store');
  if (!snapshot.icp.buyer_titles.some(t => t.trim())) throw new Error('Buyer definition needs explicit buyer criteria');
  if (snapshot.contacts.length > policy.limits.contacts_per_snapshot) throw new Error('Snapshot exceeds item budget');
  if (!Number.isInteger(policy.limits.recommendations_per_run) || policy.limits.recommendations_per_run < 1 || policy.limits.recommendations_per_run > 10 || policy.send_authority !== 'none' || policy.spend_authority !== 'none') throw new Error('Unsafe engine policy');
  return snapshot;
}
export function semanticSnapshot(snapshot) {
  const { generated_at, ...semantic } = snapshot;
  return semantic;
}

/** Canonical JSON: keys sorted at every depth, no whitespace, arrays in order, strings as JSON.stringify writes them. */
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Canonical JSON has no non-finite numbers'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map(k => { if (value[k] === undefined) throw new Error('Canonical JSON has no undefined values'); return `${JSON.stringify(k)}:${canonicalJson(value[k])}`; }).join(',')}}`;
  throw new Error('Canonical JSON cannot encode this value');
}
/** SHA-256 of canonical JSON: the digest every proposal, report and amended version is bound by. */
export const payloadDigest = value => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
/** Minimal JSON Schema check for the keywords the protocol schema uses. Unknown fields fail. */
export function schemaErrors(schema, value, path = '$') {
  const errors = [];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: value not allowed`);
  if (schema.type !== undefined) {
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const allowed = [].concat(schema.type).some(t => t === kind || (t === 'integer' && Number.isInteger(value)) || (t === 'number' && kind === 'number' && Number.isFinite(value)));
    if (!allowed) { errors.push(`${path}: wrong type`); return errors; }
  }
  if (value === null || value === undefined) return errors;
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: does not match its pattern`);
    if (schema.format === 'date-time' && (!DATE_TIME.test(value) || !Number.isFinite(Date.parse(value)))) errors.push(`${path}: not a date-time`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below its minimum`);
  if (typeof value === 'number' && schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above its maximum`);
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: too many items`);
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: too few items`);
    if (schema.items) value.forEach((item, i) => errors.push(...schemaErrors(schema.items, item, `${path}[${i}]`)));
  } else if (typeof value === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}: missing ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && Object.hasOwn(schema.properties, key)) errors.push(...schemaErrors(schema.properties[key], child, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}: unknown field ${key}`);
    }
  }
  return errors;
}
