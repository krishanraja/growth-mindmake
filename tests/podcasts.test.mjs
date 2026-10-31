import test from 'node:test';
import assert from 'node:assert/strict';
import { podcastRequests, podcastFinds, topics, PODCASTS_PER_DAY, REPEAT_DAYS } from '../src/stages/podcasts.mjs';

const AT = '2026-11-02T09:00:00Z';
const served = (perDay = 20) => ({ research: { kinds: ['search', 'question', 'podcasts'], per_day: { search: 40, podcasts: perDay } } });

test('no podcasts kind served, or the visibility lane off, asks for nothing', () => {
  assert.deepEqual(podcastRequests({ capabilities: { research: { kinds: ['search'], per_day: { search: 40 } } }, at: AT }), []);
  assert.deepEqual(podcastRequests({ capabilities: null, at: AT }), []);
  assert.deepEqual(podcastRequests({ capabilities: served(), at: AT, visibilityOn: false }), []);
});

test('a run asks for what is left of the day, never past the cap', () => {
  const first = podcastRequests({ capabilities: served(), at: AT });
  assert.equal(first.length, PODCASTS_PER_DAY);
  assert.ok(first.every(r => r.kind === 'podcasts' && r.subject_ref === null && r.query.length <= 400 && !/@|\d{6}/.test(r.query)));
  assert.equal(new Set(first.map(r => r.request_id)).size, first.length);
  const asked = first.slice(0, 15).map(r => ({ ...r, status: 'answered', requested_at: AT }));
  const refused = first.slice(15).map(r => ({ ...r, status: 'over_cap', requested_at: AT }));
  const later = podcastRequests({ capabilities: served(), research: [...asked, ...refused], at: '2026-11-02T15:00:00Z' });
  assert.equal(later.length, 5, 'a request refused over the cap ran nothing and is not counted');
  assert.ok(later.every(r => !asked.some(a => a.query === r.query)), 'a topic asked today is not asked again');
  const full = podcastRequests({ capabilities: served(), research: [...asked, ...later.map(r => ({ ...r, status: 'answered', requested_at: AT }))], at: '2026-11-02T18:00:00Z' });
  assert.deepEqual(full, []);
});

test('the rotation is the same for the same day, and moves on a day later', () => {
  const a = podcastRequests({ capabilities: served(5), at: AT }).map(r => r.query);
  const b = podcastRequests({ capabilities: served(5), at: '2026-11-02T20:00:00Z' }).map(r => r.query);
  const c = podcastRequests({ capabilities: served(5), at: '2026-11-03T09:00:00Z' }).map(r => r.query);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(topics().length >= 40, 'enough topics that a month goes round without repeating many');
});

test(`a topic asked in the last ${REPEAT_DAYS} days waits`, () => {
  const all = topics();
  const research = all.slice(0, all.length - 3).map(t => ({ request_id: `${t.base}:2026-10-20:abcd1234`, kind: 'podcasts', status: 'answered', requested_at: '2026-10-20T09:00:00Z' }));
  const asks = podcastRequests({ capabilities: served(), research, at: AT });
  assert.equal(asks.length, 3);
  const old = all.map(t => ({ request_id: `${t.base}:2026-09-01:abcd1234`, kind: 'podcasts', status: 'answered', requested_at: '2026-09-01T09:00:00Z' }));
  assert.equal(podcastRequests({ capabilities: served(), research: old, at: AT }).length, PODCASTS_PER_DAY, 'older than the window comes round again');
});

test('answered shows become candidates once, never one the list already holds, and carry no contact', () => {
  const context = { records: { visibility: [{ id: '00000000-0000-4000-8000-000000000001', title: 'The Example Leaders Podcast', event_url: 'https://shows.example/leaders' }] } };
  const research = [
    { request_id: 'podcasts:a:2026-11-02:x', kind: 'podcasts', status: 'answered', answered_at: '2026-11-02T09:01:00Z', evidence: [
      { title: 'Example Leaders, hosted by A Host', url: 'https://other.example/leaders', snippet: '120 episodes.', published: '2026-10-30T00:00:00.000Z' },
      { title: 'Fresh Show, hosted by B Host', url: 'https://www.podchaser.example/fresh', snippet: '40 episodes. Recent: AI at work.', published: '2026-10-29T00:00:00.000Z' },
      { title: 'Held By Page', url: 'https://shows.example/leaders/', snippet: '' },
      { title: 'No Secure Page', url: 'http://plain.example/x', snippet: '' },
    ] },
    { request_id: 'podcasts:b:2026-11-02:y', kind: 'podcasts', status: 'answered', answered_at: '2026-11-02T09:00:00Z', evidence: [
      { title: 'Fresh Show, hosted by B Host', url: 'https://podchaser.example/fresh', snippet: 'again' },
    ] },
    { request_id: 'podcasts:c:2026-11-02:z', kind: 'podcasts', status: 'over_cap', evidence: [] },
    { request_id: 'other', kind: 'search', status: 'answered', evidence: [{ title: 'Not A Podcast Lookup', url: 'https://x.example' }] },
  ];
  const finds = podcastFinds({ research, context });
  assert.deepEqual(finds.map(f => f.title), ['Fresh Show, hosted by B Host']);
  assert.ok(finds.every(f => !('contact' in f) && !('email' in f)));
  assert.deepEqual(podcastFinds({ research: [], context }), []);
});
