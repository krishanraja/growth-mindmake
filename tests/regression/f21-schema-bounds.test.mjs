import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaErrors } from '../../src/guards.mjs';

// F21: the engine's schema check once ignored maximum, minLength and
// minItems, so an over-long field passed locally and failed at Control
// Center. Each bound is now tested on its own, then on the real schema.
const schema = JSON.parse(await readFile(new URL('../../docs/control-center/engine-report.schema.json', import.meta.url), 'utf8'));

test('each bound the protocol schema uses is enforced on its own (F21)', () => {
  assert.deepEqual(schemaErrors({ type: 'integer', maximum: 3 }, 4), ['$: above its maximum']);
  assert.deepEqual(schemaErrors({ type: 'integer', maximum: 3 }, 3), []);
  assert.deepEqual(schemaErrors({ type: 'integer', minimum: 1 }, 0), ['$: below its minimum']);
  assert.deepEqual(schemaErrors({ type: 'string', minLength: 2 }, 'a'), ['$: too short']);
  assert.deepEqual(schemaErrors({ type: 'string', minLength: 2 }, 'ab'), []);
  assert.deepEqual(schemaErrors({ type: 'string', maxLength: 2 }, 'abc'), ['$: too long']);
  assert.deepEqual(schemaErrors({ type: 'array', minItems: 1 }, []), ['$: too few items']);
  assert.deepEqual(schemaErrors({ type: 'array', maxItems: 1 }, [1, 2]), ['$: too many items']);
  assert.deepEqual(schemaErrors({ type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false }, { b: 1 }), ['$: unknown field b']);
});

test("the report schema's own bounds hold: a hold reason over 200 and an activity line over 500 characters fail (F21)", () => {
  const holds = schema.properties.holds.items.properties.reason;
  assert.ok(Number.isInteger(holds.maxLength));
  assert.ok(schemaErrors(holds, 'x'.repeat(holds.maxLength + 1)).length > 0);
  assert.deepEqual(schemaErrors(holds, 'a'.repeat(Math.min(holds.maxLength, 20))), []);
  assert.ok(schemaErrors(schema.properties.proposals, Array(schema.properties.proposals.maxItems + 1).fill({})).some(e => e === '$: too many items'));
  const line = schema.properties.activity.items.properties.line;
  assert.ok(schemaErrors(line, 'x'.repeat(line.maxLength + 1)).includes('$: too long'));
});
