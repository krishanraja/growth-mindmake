import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openingRequest, opening } from '../src/stages/openings.mjs';

// Ruling (Krish, 2026-11-06): the openings are written by a model; Control Center serves `write` (krishanraja/control-center#659).
test('an opening is asked as write where the desk serves it, keyed apart from the same words asked as a question', () => {
  const args = { id: 'c1', name: 'Mykola', fact: 'They posted: "Quite a week for AI in China."' };
  const q = openingRequest(args);
  const w = openingRequest({ ...args, kind: 'write' });
  assert.equal(q.kind, 'question');
  assert.equal(w.kind, 'write');
  assert.equal(w.query, q.query, 'the same instruction');
  assert.notEqual(w.request_id, q.request_id, 'one id is never asked two ways');
  assert.match(w.request_id, /^open:c1:[0-9a-f]{12}$/);
  const op = opening({ id: 'c1', name: 'Mykola', card: { specific: 'They posted: "Quite a week for AI in China."' }, research: [], required: true, kind: 'write' });
  assert.equal(op.request?.kind ?? 'write', 'write');
});
