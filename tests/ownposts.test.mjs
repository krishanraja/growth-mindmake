import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownPosts, ownPostsProfile, ownPostRequests, replyList, substantive, ownPostLine, OWN_ENGAGER_READS } from '../src/stages/ownposts.mjs';

const OWN_PROFILE = JSON.parse(readFileSync(new URL('../config/policy.json', import.meta.url))).linkedin.own_profile;

// Synthetic only: no live person, post or comment.
const AT = '2026-11-20T09:00:00Z';
const post = n => `https://www.linkedin.com/posts/example-person_synthetic-post-${n}-activity-70000000000000000${n}-abcd`;
const ownRead = (day, evidence) => ({ request_id: `posts:own:${day}`, kind: 'posts', status: 'answered', answered_at: `${day}T08:00:00Z`, query: OWN_PROFILE, evidence });
const engagers = (url, day, evidence) => ({ request_id: `engagers:own:x${url.slice(-6)}:${day}`, kind: 'post_engagers', status: 'answered', answered_at: `${day}T08:05:00Z`, query: url, evidence });
const person = (handle, contact_id = null) => ({ handle, name: 'Sam Example', headline: 'COO, Example Media', contact_id });

test('asks for his own posts once a London day, before anything else', () => {
  const first = ownPostRequests({ research: [], at: AT, profile: OWN_PROFILE });
  assert.deepEqual(first.map(r => [r.kind, r.request_id, r.query]), [['posts', 'posts:own:2026-11-20', OWN_PROFILE]]);
  assert.deepEqual(ownPostRequests({ research: first.map(r => ({ ...r, status: 'answered', evidence: [] })), at: AT, profile: OWN_PROFILE }), [], 'the same day is never asked twice');
});

test('with no profile in config, nothing is asked about his own posts', () => {
  assert.deepEqual(ownPostRequests({ research: [], at: AT }), []);
  assert.deepEqual(ownPostRequests({ research: [], at: AT, profile: 'not a profile' }), []);
});

test('reads who commented on each recent post with comments, newest first, at most two a day', () => {
  const research = [ownRead('2026-11-20', [
    { url: post(1), published: '2026-11-19T12:30:00Z', engagement: { comments: 12 } },
    { url: post(2), published: '2026-11-17T12:30:00Z', engagement: { comments: 4 } },
    { url: post(3), published: '2026-11-15T12:30:00Z', engagement: { comments: 9 } },
    { url: post(4), published: '2026-11-18T12:30:00Z', engagement: { comments: 0 } },
    { url: post(5), published: '2026-11-01T12:30:00Z', engagement: { comments: 40 } },
  ])];
  const asks = ownPostRequests({ research, at: AT }).filter(r => r.kind === 'post_engagers');
  assert.equal(asks.length, OWN_ENGAGER_READS);
  assert.deepEqual(asks.map(r => r.query), [post(1), post(2)], 'newest first; a post with no comments and one older than seven days are skipped');
  assert.ok(asks.every(r => /^engagers:own:[0-9a-f]{24}:2026-11-20$/.test(r.request_id)));
});

test('a post with no readable date is kept only while its read is young', () => {
  const research = [ownRead('2026-11-10', [{ url: post(6), engagement: { comments: 3 } }])];
  assert.equal(ownPosts({ research, at: '2026-11-12T09:00:00Z' }).length, 1);
  assert.equal(ownPosts({ research, at: AT }).length, 0);
});

test('a substantive comment says something he can answer', () => {
  assert.equal(substantive('Great post!'), false);
  assert.equal(substantive('Love this, so true'), false);
  assert.equal(substantive('@Someone Else @Another Person'), false);
  assert.equal(substantive('Congrats on the launch, really well put together'), false);
  assert.equal(substantive('How do you stop it drifting from your standards?'), true);
  assert.equal(substantive('Our board asked the same thing last month and nobody had a good answer for it.'), true);
});

test('the reply list keeps each commenter once per post, the newest read winning, known or not', () => {
  const research = [
    ownRead('2026-11-20', [{ url: post(1), published: '2026-11-19T12:30:00Z', engagement: { comments: 3 } }]),
    engagers(post(1), '2026-11-19', [{ snippet: 'Nice', person: person('reader-one') }]),
    engagers(post(1), '2026-11-20', [
      { snippet: 'Nice. Though how do you know when it is wrong?', person: person('reader-one') },
      { snippet: 'Great post!', person: person('reader-two', 'c-0002') },
    ]),
  ];
  const replies = replyList({ research, at: AT });
  assert.equal(replies.length, 2);
  assert.deepEqual(replies.map(r => [r.handle, r.substantive, r.contact_id]), [['reader-one', true, null], ['reader-two', false, 'c-0002']]);
});

test('the report line carries counts only, never a name, handle, comment or link', () => {
  const research = [
    ownRead('2026-11-20', [{ url: post(1), published: '2026-11-19T12:30:00Z', engagement: { comments: 2 } }]),
    engagers(post(1), '2026-11-20', [
      { snippet: 'How do you stop it drifting from your standards over time?', person: person('reader-one', 'c-0001') },
      { snippet: 'Great post!', person: person('reader-two') },
    ]),
  ];
  const line = ownPostLine({ research, at: AT });
  assert.match(line, /^Own posts: 1 from the last 7 days read, 2 commenters, 1 substantive to reply to \(1 he already knows\)\./);
  for (const leak of ['reader-one', 'reader-two', 'Sam Example', 'drifting', 'linkedin.com', 'c-0001']) assert.ok(!line.includes(leak), `no ${leak} in the line`);
  assert.equal(ownPostLine({ research: [], at: AT }), null, 'nothing read, no line');
});

test('his own posts are read only on a live run where the desk advertises both kinds', () => {
  const served = { features: { research: true }, research: { kinds: ['search', 'posts', 'post_engagers'] } };
  assert.equal(ownPostsProfile({ mode: 'live', capabilities: served, profile: OWN_PROFILE }), OWN_PROFILE);
  assert.equal(ownPostsProfile({ mode: 'shadow', capabilities: served, profile: OWN_PROFILE }), null);
  assert.equal(ownPostsProfile({ mode: 'live', capabilities: { features: { research: true } }, profile: OWN_PROFILE }), null, 'kinds not advertised: consumer-pending');
  assert.equal(ownPostsProfile({ mode: 'live', capabilities: { ...served, research: { kinds: ['posts'] } }, profile: OWN_PROFILE }), null);
  assert.equal(ownPostsProfile({ mode: 'live', capabilities: { ...served, features: { research: false } }, profile: OWN_PROFILE }), null);
  assert.equal(ownPostsProfile({ mode: 'live', capabilities: served, profile: null }), null);
});
