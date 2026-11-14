import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCanon, blobSha } from '../src/stages/canon.mjs';
import { citedRows, citedLine, citedPages, questionFirstOn, worksAt, citedWords, CITED_PER_RUN } from '../src/stages/cited.mjs';

// 5.14 (Krish, 2026-11-14: outreach drafts from AEO's cited pages, each a draft for his send). Synthetic only.
const NOW = '2026-11-23T09:00:00.000Z';
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name a PE or VC backed media leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n`;
const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }] };
const FILES = [...canon.files, { repo: 'krishanraja/growth-mindmake', path: 'src/stages/cited.mjs', sha: 'b'.repeat(40) }];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = (n, domain, extra = {}) => ({ contact_id: id(n), network_tier: '4_owned_network', current_title: 'Editor', current_company: `Example Media ${n}`, mindmake_fit: 70, hook: `Edits the leadership section at Example Media ${n}.`, who: `Robin Sample${n} edits the leadership section at Example Media ${n}.`, ...extra, contacts: { full_name: `Robin Sample${n}`, status: 'active', company_domain: domain, ...extra.contacts } });
const page = (host, extra = {}) => ({ url: `https://www.${host}/ai-readiness`, host: `www.${host}`, page_type: 'article', questions: 2, engines: ['perplexity'], times_cited: 3, times_first: 2, mention: 'unchecked', mention_ok: null, checked_at: null, status: 'not started', ...extra });
const question = (q, host) => ({ query_id: 'q1', question: q, state: 'absent', engines: [{ engine: 'perplexity', our_position: null, first_host: host, first_url: `https://www.${host}/ai-readiness`, searched: true }] });
const route = () => ({ email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false });

test('a page cited first, at a company whose person Control Center serves with an address, is one REACH OUT email in his own box', () => {
  const standing = { cited_pages: [page('media-one.example')], questions: [question('How should a media company get its leaders ready for AI', 'media-one.example')] };
  const r = citedRows({ standing, context: { network: [person(1, 'media-one.example')], routes: { [id(1)]: route() } }, canon, files: FILES, at: NOW });
  assert.equal(r.rows.length, 1);
  const p = r.rows[0].proposal;
  assert.equal(p.row, 'reach_out');
  assert.equal(p.target, id(1));
  assert.equal(p.close_condition.reference, 'reach_out:cited_page');
  assert.ok(p.card, 'a row carries its full card (protocol 1.8.0)');
  const a = JSON.parse(p.exact_payload);
  assert.equal(a.channel, 'email');
  assert.equal(a.mailbox ?? null, null, 'his own box: the morning lane drafts it for his send');
  assert.match(a.body, /^Hi Robin,\n\nWhen someone asks an AI assistant "How should a media company get its leaders ready for AI\?", the first source it cites is your page at https:\/\/www\.media-one\.example\/ai-readiness\./);
  assert.match(a.body, /would a short call to compare notes be useful\?\n\nKrish$/);
  assert.equal(a.body.includes(String.fromCharCode(8212)), false, 'no em dash');
  assert.match(citedLine(r, true), /^Cited pages: 1 read; 1 written as REACH OUT notes for his own box\.$/);
});

test('every other page is counted and said, never guessed at', () => {
  const standing = {
    cited_pages: [page('nobody.example'), page('second.example', { times_first: 0 }), page('noq.example'), page('noaddr.example'), page('busy.example')],
    questions: [question('Q one about AI readiness', 'nobody.example'), question('Q two about AI readiness', 'noaddr.example'), question('Q three about AI readiness', 'busy.example')],
  };
  const context = {
    network: [person(2, 'noaddr.example'), person(3, 'busy.example'), person(4, 'noq.example')],
    routes: { [id(2)]: { email: 'none' }, [id(3)]: route(), [id(4)]: route() },
  };
  const r = citedRows({ standing, context, canon, files: FILES, at: NOW, taken: new Set([id(3)]) });
  assert.equal(r.rows.length, 0);
  assert.deepEqual([...r.held].sort(), ['cited_no_address', 'cited_no_question', 'cited_nobody_held_there', 'cited_nobody_held_there', 'cited_not_first'].sort(), 'one already on another row this run counts as nobody left there');
  assert.match(citedLine(r, true), /not written: (.*)nobody held there 2/);
  assert.equal(/Robin|example/.test(citedLine(r, true)), false, 'counts only, never a name or a host');
});

test('at most CITED_PER_RUN a run; none served, or not served at all, is said plainly', () => {
  const hosts = Array.from({ length: CITED_PER_RUN + 2 }, (_, i) => `site${i}.example`);
  const standing = { cited_pages: hosts.map(h => page(h)), questions: hosts.map((h, i) => question(`Question ${i} about AI readiness`, h)) };
  const context = { network: hosts.map((h, i) => person(10 + i, h)), routes: Object.fromEntries(hosts.map((_, i) => [id(10 + i), route()])) };
  const r = citedRows({ standing, context, canon, files: FILES, at: NOW });
  assert.equal(r.rows.length, CITED_PER_RUN);
  assert.equal(r.held.filter(h => h === 'cited_per_run_cap').length, hosts.length - CITED_PER_RUN);
  assert.equal(citedLine(citedRows({ standing: {}, context, canon, files: FILES, at: NOW }), true), 'Cited pages: none served for Mindmake yet, so no cited-page note was written.');
  assert.equal(citedLine(r, false), null);
});

test('the helpers: hosts compared without www, a subdomain counts, a page needs https', () => {
  assert.deepEqual(citedPages({ cited_pages: [{ url: 'http://x.example/a', host: 'x.example' }, { url: 'https://www.y.example/b' }] }).map(p => p.host), ['y.example']);
  assert.equal(worksAt({ contacts: { company_domain: 'www.y.example' } }, 'blog.y.example'), true);
  assert.equal(worksAt({ contacts: { company_domain: 'y.example' } }, 'noty.example'), false);
  assert.equal(questionFirstOn({ questions: [question('Q', 'z.example')] }, 'z.example'), 'Q');
  assert.match(citedWords({ question: 'Is "this" ready?', url: 'https://z.example/p', host: 'z.example' }, canon).lines[0], /asks an AI assistant "Is this ready\?"/);
});
