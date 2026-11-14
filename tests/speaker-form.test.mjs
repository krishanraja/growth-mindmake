import test from 'node:test';
import assert from 'node:assert/strict';
import { isSpeakerForm, TALK_TITLE, ABSTRACT, BIO } from '../src/stages/pitches.mjs';

test('a speaker form asks for a talk, an abstract or a bio; a search, login or newsletter box does not', () => {
  assert.ok(TALK_TITLE instanceof RegExp && ABSTRACT instanceof RegExp && BIO instanceof RegExp);
  assert.equal(isSpeakerForm([{ label: 'Full name' }, { label: 'Talk title' }]), true);
  assert.equal(isSpeakerForm([{ label: 'Speaker bio', type: 'textarea' }]), true);
  assert.equal(isSpeakerForm([{ label: 'Abstract', type: 'textarea' }]), true);
  assert.equal(isSpeakerForm([{ label: 'Search', type: 'search' }]), false);
  assert.equal(isSpeakerForm([{ label: 'Email', type: 'email' }, { label: 'Password', type: 'password' }]), false);
  assert.equal(isSpeakerForm([{ label: 'Email address', type: 'email' }, { label: 'Subscribe to our newsletter', type: 'checkbox' }]), false);
  assert.equal(isSpeakerForm(null), false);
});
