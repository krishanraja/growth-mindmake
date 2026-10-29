import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaErrors } from '../src/guards.mjs';
import { violations } from './support/engine-protocol-service.mjs';

// Protocol 1.16.0 (Ruling, Krish, 2026-10-29): a report may carry credits_spent[],
// and the copied report schema now uses $ref, uniqueItems and map entries. Both
// checkers, the producer's and the stand-in's, must read them, or a malformed
// field would pass as unchecked.
const schema = JSON.parse(await readFile(new URL('../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));
const spent = schema.properties.credits_spent;
const both = (s, v) => [schemaErrors(s, v, '$', schema), violations(s, v, '$', schema)];

test('credits_spent: a well-formed spend passes both checkers', () => {
  for (const errs of both(spent, [{ pool: 'apify-main', amount: 0.42, asset: 'Booking routes for four podcasts', objective_key: 'good_meetings' }, { pool: 'elevenlabs-main', amount: 1200, asset: 'A draft voice-over for the one-sheet, waiting for his yes' }])) assert.deepEqual(errs, []);
});

test('credits_spent: a zero or negative amount, a missing asset, an unknown field and more than 40 are refused by both', () => {
  const ok = { pool: 'apify-main', amount: 1, asset: 'x' };
  for (const bad of [[{ ...ok, amount: 0 }], [{ ...ok, amount: -1 }], [{ pool: 'apify-main', amount: 1 }], [{ ...ok, address: 'x' }], [{ ...ok, pool: 'Apify Main' }], Array.from({ length: 41 }, () => ok)]) {
    for (const errs of both(spent, bad)) assert.ok(errs.length > 0, JSON.stringify(bad).slice(0, 80));
  }
});

test('a $ref is followed, and one that does not resolve fails closed in both checkers', () => {
  const never = schema.properties.suppression.properties.never;
  for (const errs of both(never, ['contact:abc'])) assert.deepEqual(errs, []);
  for (const errs of both(never, ['Jane Example'])) assert.ok(errs.length > 0, 'a name is never a reference');
  for (const errs of both(never, ['contact:abc', 'contact:abc'])) assert.ok(errs.length > 0, 'no entry twice');
  for (const errs of both({ $ref: '#/properties/nowhere' }, 'x')) assert.ok(errs.length > 0);
});
