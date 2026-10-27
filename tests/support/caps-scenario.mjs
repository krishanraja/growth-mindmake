/**
 * A dispatch fixture that binds every cap the week spec can set (plan Phase 2,
 * golden test): more people on a row than it shows, people either side of the
 * fit floor, more podcasts than a run pitches, more stages than their share,
 * more guests than a run invites and more stage forms than a row leads with.
 * The earlier fixtures never reach a cap, so a default spec that moved one
 * would pass them all; this one would not.
 *
 * Its report digest was recorded from the code before the week spec existed
 * (tests/golden/golden.json), so the modules it runs are passed in. It was
 * re-recorded once, when the engine's own verdicts began to act (plan section
 * 12, M3 to M5): its guests carry the axes Control Center serves, and its
 * stages still carry none, so the engine reads them as not yet judged. Synthetic
 * only: invented people, shows, ids and .example addresses.
 */
import { GUEST } from './standard.mjs';

export const AT = '2026-10-27T09:00:00.000Z';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NORTH_STAR = `# North Star\n\n## Horizon\n\n> By March 2027, Mindmake is the first name an example leader hears when they ask who can build an AI that knows them.\n\n## What we sell\n\n- **Build your AI brain.** Your taste, standards and judgement, running as a\n  system you own.\n`;
const CANON = `## What the growth engine may say\n\n1. **Start building your AI brain**, at \`https://mindmake.example/?start=1\`. The main ask,\n   for a leader who can decide. Describe it as\n   the site does: answer a few questions, keep the brief, then a free consultation.\n2. **Subscribe to Make Your Mind Up**, at \`https://publication.example\`, free.\n| Revenue engine door | Build your AI revenue engine |\n| Revenue engine door explanation | The pricing, positioning and team you'll need. |\n`;
const RECEIPTS = `export const receipts = {\n  credentials: [\n    'Public Speaker (Example Concert Hall)',\n  ],\n  roles: [\n    {\n      org: 'Example Broadcasting',\n      title: 'Head of Data',\n      detail:\n        "grew data revenue from $1M to $9M in three years. Launched 12 products.",\n    },\n  ],\n};\n`;
const GOALS = ['Send the Mindmake one-pagers and offers to warm leads', 'Have a clear plan for driving partnerships and visibility for Mindmake'];

const person = (n, title, fit) => ({ contact_id: id(n), network_tier: '2_core_network', current_title: title, followers: 20000 + n, plays: [], roles: [], mindmake_fit: fit, sells_competing_services: false, hook: 'Took two media software companies through a sale.', contacts: { id: id(n), full_name: `Avery Example${n}`, title, company: `Company ${n}`, company_domain: `c${n}.test`, status: 'active' } });
const route = () => ({ email: 'verified', x: false, linkedin: true, instagram: false, whatsapp: false });
const show = n => ({ id: id(400 + n), title: `The Example Show ${n}`, type: 'podcast', status: 'queued', verdict: n % 2 ? 'take' : 'stretch', organizer: 'Avery Example', buried_at: null, applied_at: null,
  event_url: `https://podcasts.example/show-${n}`, feed_url: `https://feeds.example/${n}`, episodes: 40 + n, latest_episode_at: '2026-10-20T00:00:00Z', booking_contact_id: id(500 + n), booking_source: 'feed_owner',
  audience: 'Marketing leaders at mid-size companies', angle: null, why_him: 'The show interviews operators who changed how a company works.', why_now: null });
const field = (label, name, over = {}) => ({ label, name, type: 'text', required: false, options: [], ...over });
const FIELDS = [field('Full name', 'full_name', { required: true }), field('Email', 'email', { type: 'email', required: true }), field('Company', 'company', { required: true }), field('Talk title', 'talk_title', { required: true }), field('Abstract', 'abstract', { type: 'textarea', required: true })];
const summit = (n, form) => ({ id: id(600 + n), title: `The Example Summit ${n}`, type: 'conference', status: 'queued', verdict: 'take', organizer: 'Example Events Ltd', buried_at: null, applied_at: null,
  event_url: `https://summit.example/${n}`, cfp_url: form ? `https://summit.example/${n}/speak` : null, deadline_at: '2026-11-20T00:00:00Z', event_start_at: '2027-03-10T00:00:00Z', location: 'London',
  booking_contact_id: id(700 + n), booking_source: 'stage_page', audience: 'Marketing leaders at mid-size companies', angle: null, why_him: null, why_now: null,
  room_score: null, standing_score: null, only_him_score: null, suggested_talk_title: null, audience_size: null, updated_at: '2026-10-20T10:00:00Z',
  ...(form ? { form_fields: FIELDS, form_fields_at: '2026-10-26T06:00:00Z' } : {}) });
const NAMES = ['Avery Sample', 'Sam Fixture', 'Jordan Placeholder', 'Riley Demo'];
const guest = (n, show) => ({ contact_id: id(800 + n), name: NAMES[n - 1], status: 'enriched', invite_show: show, invite_state: null, scheduled_at: null,
  ...GUEST.take, buried_at: null, recorded_at: null, published_at: null,
  one_liner: 'Chief Marketing Officer at Example Retail, rebuilding a marketing team around AI', why_fit: 'Runs a marketing team that changed how it works with AI.',
  evidence: [{ url: `https://talks.example/guest-${n}`, label: 'How marketing teams change with AI', at: '2026-10-01T00:00:00Z', kind: 'talk' }] });

export function capsContext() {
  // Ten hosts for the visibility row (six show), one under the floor and one on it; four connectors for reach out.
  const fits = [39, 40, 41, 55, 60, 65, 70, 75, 80, 90];
  const hosts = fits.map((fit, i) => person(i + 1, `Host of Example Show ${i + 1}`, fit));
  const connectors = [20, 21, 22, 23].map(n => person(n, 'Chapter Chair, Example Leaders Forum', 50 + n));
  const guests = [guest(1, 'makeyourmindup'), guest(2, 'makeyourmindup'), guest(3, 'makeyourmindup'), guest(4, 'signal_noise')];
  const routes = Object.fromEntries([...hosts, ...connectors].map(p => [p.contact_id, route()]).concat(guests.map(g => [g.contact_id, { email: 'verified' }])));
  return {
    schema_version: '1.9.0', engine_id: 'growth-mindmake', product_slug: 'mindmake', observed_at: AT,
    coverage: [{ source: 'advisory', available: true, complete: true }],
    records: { advisory: [], visibility: [...Array.from({ length: 13 }, (_, i) => show(i + 1)), ...Array.from({ length: 6 }, (_, i) => summit(i + 1, false)), ...Array.from({ length: 3 }, (_, i) => summit(i + 10, true))], drafts: [], guests },
    amplifier_candidates: [...hosts, ...connectors], routes, feedback: [], research: []
  };
}

/** One dispatch run of the fixture with the modules given; resolves to the report it posted. */
export async function capsReport({ runDispatch, directiveFixture, parseCanon, blobSha, parseRecord, policy, record = r => r }) {
  const canon = { ...parseCanon({ northStar: NORTH_STAR, canon: CANON }), files: [{ repo: 'krishanraja/mindmake', path: 'project-documentation/00_NORTH_STAR.md', sha: blobSha(NORTH_STAR) }, { repo: 'krishanraja/mindmake', path: 'project-documentation/01_CANON.md', sha: blobSha(CANON) }] };
  const RECORD = { line: parseRecord(RECEIPTS), file: { repo: 'krishanraja/krish-raja', path: 'src/content/receipts.ts', sha: blobSha(RECEIPTS) } };
  const served = ['1.6.0', '1.7.0', '1.8.0', '1.9.0'];
  const reports = [];
  const cc = {
    recordAttempt: async () => {}, directive: async () => directiveFixture({ schema_version: '1.9.0', week_goals: GOALS }),
    capabilities: async () => ({ activation: { activated_on: '2026-10-18' }, schema_versions: served, features: { context: true, rows: true } }),
    context: async () => ({ ok: true, context: capsContext() }),
    decisions: async () => [], postReport: async rep => { reports.push(record(rep)); return { replayed: false }; }, readReport: async () => reports.at(-1)
  };
  const result = await runDispatch({ cc, source: async () => { throw Error('Retired source must not run'); }, policy, registry: {}, attemptId: 'gma-golden-caps-1234', clock: () => AT,
    canonReader: async () => canon, wordFiles: async () => [{ repo: 'krishanraja/growth-mindmake', path: 'src/stages/pitches.mjs', sha: 'b'.repeat(40) }], recordReader: async () => RECORD });
  return { result, report: reports[0] ?? null };
}
