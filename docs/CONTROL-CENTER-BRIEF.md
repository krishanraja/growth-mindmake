# Control Center brief: growth-mindmake

**The five rows, 2026-10-26 (protocol 1.6.0):** when Control Center's
capabilities list 1.6.0 and `rows`, the dispatch adds up to 30 row proposals for
Krish's home screen widget (REACH OUT, NETWORK, VISIBILITY, EVENTS, PARTNERS):
amplifiers ranked by how far a yes travels, close ties gone quiet, and worried
executives who commented on posts about AI and their jobs. Each is a prepared
send with a version 2 action that names no address, written from Mindmake's
canon read live this run and naming those files by blob SHA. It asks Control
Center's research desk for cited reach figures and LinkedIn signals, inside
its daily caps. Before Control Center serves 1.6.0 the report is 1.2.0 and
unchanged. Doctrine: playbook 11; contract: docs/control-center/ENGINE-PROTOCOL.md.

**Current implementation, 2026-10-22:** the additive shared protocol provides
capability-negotiated context and complete outcome windows. The producer uses
native records and a 70/30 distribution/direct-learning allocation, with replies
and commitments first. Approved plans yield exact finished actions; the shared
executor supports plain zero-cost email and independent sent-message readback.
Other routes are held. Release and real external-action acceptance remain
separate from local tests. See the trusted-distribution playbook and release state.

**Status, 2026-10-19:** adopted in this repository. `node src/cli.mjs dispatch` runs the protocol loop on the `cc-growth-directive` wake-up (the `dispatch` job in .github/workflows/operate.yml); see docs/OPERATIONS.md. Both objectives report as missing until Control Center serves complete outcome records.

Written 2026-10-18 by Control Center. This brief **supersedes `docs/CONTROL-CENTRE-HANDOFF.md`** as the contract between this engine and Control Center. Krish ruled that every growth engine reports through one protocol and conforms to it, rather than Control Center building a receiver per engine (ADR-038 in Control Center).

## What Control Center now does for you

- **Pushes you one next action every day.** It is chosen by rule, in this order:
  1. what Krish approved
  2. a repair
  3. your unwalled proposal that closes the widest gap to an objective
  4. otherwise, waiting on him
  5. otherwise, naming the gap
- **Puts what only Krish can do on his one list on Home.** This means every message to send, every spend and every strategy call, and returns his decision to you bound to the exact payload.
- **Shows your health, objectives, today's push and what you did** on Growth > Engines, next to the other five engines.

## Control Center already grows Mindmake: work with it

Krish, 2026-10-18: Control Center's Visibility tab, Network and Advisory are a huge driver of Mindmake's growth. They are not this engine's to rebuild. They are its partners.

| Lane in Control Center | What it already does | What this engine does with it |
|---|---|---|
| **Advisory** (`pilot_deals`, People > Advisory) | Drafts the note to a named person into Gmail. Krish sends it. It then tracks sent, replied, call booked, call taken, pilot booked and pilot paid | Never drafts a second note to someone Advisory holds. Propose who should get a note next, and why now, as a `strategy` proposal. When Advisory's counts move (sent, call booked, paid), use them as your evidence |
| **Network** (warm tiers, warm paths) | Knows who Krish knows, how well, and the warm path to a person, a show or a room | Starts every proposed approach from a warm path or a named room, which is your aim. A stranger with nothing known stays "no path yet" |
| **Visibility** (stages, rooms, podcast pitches) | Finds stages with open calls and rooms in his city, and drafts pitches | Proposes which stage or room serves a paid proof. Never a second pitch to a show Visibility already pitched |

Every directive carries `in_house: { rule, counts }`, this week's Advisory, Network and Visibility counts as Control Center reads them, with no names. Growth > Engines shows the same counts on your card. Read them before you propose. A part that could not be read is `null`, never zero.

## Your registry row

| | |
|---|---|
| Slug in the path | `mindmake` |
| `engine_id` | `growth-mindmake` |
| `product_slug` | `mindmake` |
| Aim | Every paid proof starts from a warm path or a room, never a list, and leaders arrive already asking for the brain because someone they trust told them. By 2026-11-30 |
| Objectives | `good_meetings`: the weekly ladder in docs/NORTH_STAR.md, 20 by 2026-11-30, the objective every row and pitch proposal names (since 2026-10-29); `qualified_conversations`: target 5 people per week (Europe/London), a reported subset; `paid_proofs`: target 1 in the first 30 days (Europe/London) |
| Cadence | daily |
| State | Switched on 2026-10-18, with dispatch on. Your bearer arrives in this repository's secrets as `CONTROL_CENTER_ENGINE_TOKEN`, with `CONTROL_CENTER_URL` as a variable. Until then, build against `mode: synthetic` |

## The protocol, in short

The full spec is `docs/control-center/ENGINE-PROTOCOL.md`, with the report and directive schemas and a worked example beside it. In short:

**Base URL and auth.**
- Base: `CONTROL_CENTER_URL`, which is `https://controlcenter.krishraja.com`.
- Bearer: `Authorization: Bearer $CONTROL_CENTER_ENGINE_TOKEN`. This is a `gen1_` token issued for this engine alone. Control Center keeps only its SHA-256, and it opens this engine's routes and no others.
- Transport: HTTPS only. Follow no redirects, use bounded timeouts, and read back before retrying any write.

**Every run, in this order:**
1. `POST {base}/api/growth/engines/mindmake/attempts` with `status: started`, before reading any source.
2. `GET {base}/api/growth/engines/mindmake/directive` returns today's `next_action`, your objectives with their targets and latest values, his decisions of the last seven days, and the walls.
3. Do the work, inside the walls. The rule, word for word: "Nothing sends, posts, spends, deletes or changes a permission without a decision from Krish whose payload_sha256 matches what you are about to do."
4. `POST {base}/api/growth/engines/mindmake/reports` with header `Idempotency-Key: {run_id}`. The body is the report envelope:
   - `schema_version: "1.0.0"`, `engine_id`, `product_slug`, `run_id`, `mode`, `observed_at`, `source`, `status`
   - `objectives[]`, `activity[]`, `proposals[]`, `events[]`, `holds[]`
   - `payload_sha256`: the SHA-256 of the canonical JSON without that field, with keys sorted at every depth and no whitespace

   An unknown field is refused, never dropped. Then `GET .../reports/{run_id}` and compare the digest.
5. `POST .../attempts` again with the terminal state (`succeeded`, `failed` with a lower_snake `error_code`, or `unknown`) and `finished_at`. A terminal record never changes.
6. `GET {base}/api/growth/engines/mindmake/decisions?since={last run}` returns his yes and no, each with the `payload_sha256` it was made on. Act on a yes only when that digest equals the payload you are about to use. A changed payload is a new ask, and it goes back to him by itself when you report it.

**How proposals and readings are judged.**
- A proposal behind a wall (`spend` with its `amount_usd`, `send` or `post` with its `exact_payload`, or `strategy`) goes on Krish's one list on Home, where Clear approves it, Purge declines it and Bump defers it a day.
- A proposal inside the walls is yours to do. Control Center may pick it as your next push.
- Unknown is `value: null` with a `reason`, never zero. A measured zero is `0`.
- `mode: synthetic` is stored and read back but never touches his numbers or his list. Use it to prove your client before Krish switches you on. A live report is refused (409 `engine_inactive`) until he does.

**The wake-up.** Control Center wakes you once a day around 06:10 London with `repository_dispatch` of type `cc-growth-directive`, whose `client_payload` is `{ directive_id, engine_id }` and nothing else. Add that trigger to your workflow. If you do not run on GitHub Actions, pull the directive at the start of your own run instead; it is the same directive.

## How your old handoff maps

| Your contract | In the protocol |
|---|---|
| `Attempt` (`gma-…`, `started` then one terminal state, `error_code` allowlist) | `POST attempts`, unchanged in meaning. Keep your ids and codes |
| Per-run `DashboardReport` (selected page, provisional) | A report with `status: held` or `ready`. Put the global measures in `objectives` only when they cover every Mindmake outcome record in the window; otherwise send `value: null`, `availability: missing` and the reason. A page count is never the headline |
| `WeeklyReview` and its one `Improvement` | A report from your `weekly-review` command, with the improvement as one proposal. Its `close_condition.event` is your matching persisted event (`promise_fulfilment_recorded`, `proof_decision_recorded`, …) |
| `WorkItem`s (outreach, introduction, trust, speaking drafts) | Proposals. An outward message to someone Advisory does not hold is `wall: send` with `exact_payload` and `channel` (`email` or `linkedin`); one to someone it does hold goes through Advisory instead. A speaking draft for a stage Visibility found is a proposal on that stage. A qualification or proof decision is `wall: strategy`. Research and internal prep are `wall: none` |
| `ReviewContext.feedback` (accepted, bumped, declined, completed) | `GET decisions`, plus the `decisions_since` in each directive. Bump is not returned: a bumped item stays pending and returns to his list the next day |
| `Capabilities` and digests | `GET capabilities`. Keep pinning your seven contract digests on your side |
| Activation date | `capabilities.activation.activated_on`, which Krish sets when he switches you on. Never infer it |

## What you build now

1. A Control Center client for the six calls above, behind your existing dry-run default. Writes happen only with `--commit`.
2. The `cc-growth-directive` trigger on your runner workflow. Without it, pull the directive at the start of each run.
3. A mapping from your Improvement and WorkItem outputs to proposals, with stable `proposal_id`s (for example `gmi-…`) and `payload_sha256` over the exact outward payload.
4. A synthetic run that posts a report with `mode: synthetic` and reads it back. Prove it against the worked example's digest first.
5. Global measures computed on your side, in Europe/London weeks with each local boundary converted on its own. Report them as objectives, or as missing with the reason.

## What you stop

- **Expecting the rest of the 13 routes.** Control Center built the first of them in PR 469 (merged 2026-10-18), and they stay: `GET /api/growth/mindmake` (the snapshot), `POST /api/growth/mindmake` (a draft batch that lands as Advisory notes in `pilot_deals`, for Krish to send) and `GET /api/growth/mindmake?run_id=` (its receipt), all on the shared growth credential. Use that path for any note to a named person: it is Advisory's own door. The `work`, `operations` and `report` routes will not be built. Your attempts, reports, push and his decisions go through this protocol instead.
- **Sending, scheduling or spending yourself.** Unchanged.

## Still owed by Control Center (named, not built)

- The refusal flags its judges set but do not store or serve: a stage's `pay_to_play` and `generic_take`, and a guest's wrong-show judgment. The engine now judges stages and guests on their served axes alone (plan section 12, M3 to M5), so a stage or guest refused only on one of these flags is not refused by the engine; none was on record at the 27 October readback, and the shadow lines count such cases as `flag_not_served` and `show_fit_not_served`.
- Global outcome reads from Control Center's own deals (qualified conversations, paid proofs), so you need not compute them from a page.
- The Gmail draft readback close.
- Done: a read of this engine's own latest live reports, newest first (`GET .../reports?recent=<n>`, `features.recent_reports`, krishanraja/control-center#589), each with only `run_id`, `accepted_at`, `status` and `activity`. The Phase 5 switch counts its proof runs from it (`readProofRuns` in src/crew/switch.mjs) and reads nothing where it is not served.

- **Who is in his network, on each route (Ruling, Krish, 2026-10-28: "anyone that comes from inside my Network, should only ever be emailed by me").** `routes[contact_id].in_network`: `true` when the contact's network tier is one of his own networks (reciprocated, core, known or owned), `false` when it is not, `null` when Control Center cannot say; advertised by `features.network_routes: true`. The engine's side is built and tested (`networkLane` in src/stages/pitches.mjs, tests/network.test.mjs) and reads the field only where the flag is advertised. Until then, and for any null or missing value, the engine treats the recipient as possibly in his network: no guest invite, podcast or stage pitch or show-notes note goes to Jonny's box for them (held as `jonny_network_unknown`), except a podcast's or a stage's booking address that no network list in the context names. Someone in his network gets the same invite or pitch on his own row instead (a version 2 email action with no `mailbox`, signed Krish), and Jonny's lane holds them as `network_is_krish`.

- **The suppression list and the taxonomy (plan section 12, M10).** So the widget hides what he said No to by the engine's rule, not a copy (`answeredLike` in src/lib/widgetPlays.ts, read through `rowAnswers` in api/_rowPress.ts), two optional report fields, sent only once Control Center's capabilities say `features.suppression`. Control Center keeps schema checks only and decides nothing from its own rules:
  - `suppression`: `{ version: 1, as_of, never: [subject_ref], not_on_row: [{ row, subject_ref }], paused: [{ subject_ref, until }], reach_floor: [{ kind, at_or_below }], audiences: [{ kind, sector }], topics: [topic] }`. `as_of` and `until` are ISO times; `row` is one of the five rows; `kind` one of the seven amplifier kinds; `at_or_below` one of the six bands (a candidate of that kind at that band or lower is hidden); `sector` a string of at most 59 characters or null (null is every sector); `topic` at most 59 characters. A `subject_ref` matches `^[a-z_]{2,20}:[A-Za-z0-9._:-]{1,120}$` (a reference such as `contact:<uuid>` or `target:<uuid>`, never a name or an address). Each list at most 500 entries, sorted; the whole field at most 64 KB. It replaces every earlier list. Built and tested here (`suppressionList`, `suppressionApplies` in src/stages/suppression.mjs, which decides what the engine's own rule decides on a 500-case sweep), and wired: the copied report schema (docs/control-center/engine-report.schema.json) carries both fields, and the dispatch sends them, both or neither, on every run where Control Center's capabilities say `features.suppression: true` (`suppressionFields`, tests/suppression-report.test.mjs).
  - `taxonomy`: `{ version: 1, rows[5], kinds[7], bands[6], reasons[8], carried_out[3], ask_for: { kind: ask }, row_for: { ask: row }, doctrine: { title_max, because_max, title_max_with_because, brief_lines: { min, max }, card_lines: { min, max }, card_sources_max, angle_title_max } }`, every value an identifier or an integer, at most 2 KB, sent once a run beside `suppression`. Control Center checks a proposal's `row`, `amplifier_kind`, `reach.band`, a decision's `reason_code` and `carried_out`, and the title and card bounds against it in place of its own REACH_ROWS, AMPLIFIER_KINDS, REACH_BANDS, DECLINE_REASONS, CARRIED_OUT and ROWS_RULE, which then stops being sent as `rows_rule`.
  - Until then the shadow line `Suppression, in shadow:` names where Control Center's copy decides differently on the same answers: `undated_answer`, `answer_without_row`, `carried_state` (a submit, or a press on a row neither approved nor done), `unknown_kind`, `blank_sector`, `answers_beyond_cap` (its newest 500) and `band_missing`.
- **Places and the focus inputs (plan section 12, M7 and M13).** Context parts, each with its coverage line, so the engine decides from what Control Center collects:
  - `records.touchpoints`: Mindmake's rows of `growth_touchpoints` (`id, product_slug, channel, icp_trigger, watering_hole, coverage_status, cost_efficiency_score, assumption_flag, updated_at`), at most 200; `records.geo_probes`: Mindmake's venture probes of the last 30 days (`id, product_slug, subject_kind, question, engine, run_at, we_cited, answer_snapshot, competitors_cited, touchpoint_id`), at most 500; `records.accounts`: Mindmake's social accounts (`product_slug, platform, status, handle`), handles only, never a login. With them the weekly review (`weeklyPlaces`) plans Mindmake's questions alone, and Control Center's probe takes the engine's planned questions in place of its shared twelve and counts a citation by the canon's domains as whole hosts.
  - `touches`: contacts due a touch (`contact_id, next_touch_due_at`), at most 50, and `home_city`: his city as Control Center's one home-city reader returns it, a city name or null, so the focus playbooks' catch-up and rooms are compared too.
- **Found routes from answered lookups (2026-10-30), built on both sides.** Control Center serves it at 1.18.0 (krishanraja/control-center#636); the engine sends `found_routes` at 1.18.0 only where the flag and the version are served, and counts the acceptance's answer (`foundRoutesAnswer`). The ask as it was made: The engine's `booking:` and `email:` lookups come back from the research desk with results in `evidence` and an empty `answer`; on 30 October 22 were answered, two booking results held an email address and fifteen a contact, booking, speaker, apply or form page, and none of it became a route, because a version 2 email action names its recipient by contact id (`parseActionV2` in src/lib/growthEngines.ts refuses any other key). The engine now reads that evidence by fixed rules (src/stages/routes.mjs: an address on the subject's own site, role first, never a third party's and never a guessed pattern; else the stage's or show's own form page) and holds each subject as `address_found`, `form_found` or `lookup_found_nothing`. What it needs from Control Center: `features.found_routes: true` and an optional report field `found_routes`, at most 40, each `{ subject_ref, kind: email|form, address | url, source_url, request_id }`, where `subject_ref` is `target:<visibility_target id>`, `contact:<id>` or `guest:<guest record id>`, `source_url` is the result the route was read from and `request_id` its lookup. Control Center records an `email` route through its existing ingest gate (`bookingContact` in api/_podcastFeeds.ts, as api/_stageForms.ts does for an address a stage's page gives) as the stage's `booking_contact_id` with `booking_source: 'research'`, or as the guest's contact route, only when the address appears in the stored evidence of that `request_id` for that subject; and a `form` route as the stage's `cfp_url` when it is empty and on the same site as the result, so its daily walk reads `form_fields` and the engine's existing form lane writes the form. The next context then carries the address as a contact id, and the engine's existing pitch, invite and form stages prepare the action, still behind his yes, with the network rule (2026-10-28) deciding whose box. The engine sends the field only where the flag is served and the copied report schema carries it (`foundRoutesField` in src/dispatch.mjs, tests/routes.test.mjs); until then it holds `found_routes_unrecorded` and no address leaves it.
- **Retirement, once the three lines have run live and been read back (one change on Control Center's side, other ventures keeping theirs):** M7, the Mindmake plays of `PLAYBOOKS` stop being filled by `fillFocus` for Mindmake (the visibility and revenue books' drafting plays, whose people the engine's rows now bring), with the family registry, the focus rule and the one list's sources kept; M10, `answeredLike` applied from the engine's `suppression` list, `rows_rule` no longer sent, and the taxonomy lists read from the engine's `taxonomy`; M13, `api/growth/geo-probe.ts` asks the engine's questions for Mindmake and reads Mindmake's domains from the canon, its own list dropping the retired and sibling properties, and `nextMoves` stops ranking Mindmake's places.

- **An intake for the shows Podchaser finds (2026-10-31).** The engine asks the research desk for `podcasts` every day on Podchaser's prepaid points (krishanraja/control-center#641) and counts the shows the visibility list does not hold (src/stages/podcasts.mjs). A show reaches the pitch path only as a `records.visibility` row, and nothing yet turns a found show into one, so each run holds them as `podcast_finds_no_intake`. What it needs: Control Center reads the answered `podcasts` evidence it already stores and adds each show it does not hold to `visibility_targets` (its own page as the url, its host as the organiser, no contact), through the same rules Nova's weekly Podchaser search uses.

## What Control Center still owes: protocol 1.10.0 (approved by Krish, 27 October 2026)

Built in this order: first what wires the number, then traffic and the show-notes note. Within 1.x Control Center only adds; the engine sends a new report field only once Control Center serves 1.10.0.

1. **The registry.** Served 27 October 2026 (krishanraja/control-center#580, applied live and read back: eight Mindmake objectives, these three among them). Register `good_meetings` (unit `meetings`, the weekly ladder in this repository's `docs/NORTH_STAR.md`), `podcasts_booked` (2 a week) and `stages_confirmed` (1 a fortnight) as Mindmake's objectives, so `chooseNextAction` weighs their gaps. Until then they arrive as unregistered keys. `qualified_conversations` keeps its 5/1 lock.
2. **Held meetings.** Built in krishanraja/control-center#582 (steps 2 and 3 together), with the engine's side here: the number counted from his taps and `origin_candidates` sent at 1.10.0. A context part `meetings` from his calendar, each `{ meeting_id, contact_id, held_at, good, good_at, origin_path, origin_ref, assists[], said_yes_because }`, with its coverage line. `good` is null until he answers. `origin_path` is one of `existing-relationship`, `multiplier-intro`, `partner`, `guest-seat`, `podcast`, `own-show-guest`, `public-signal`, `inbound`, `referral`, `unknown`, recorded once and never rewritten.
3. **The good tap.** One source on his one list after each held meeting, on the "How was the room?" pattern: Clear means good and Purge means not. It is pre-filled from the engine's report field `origin_candidates` (`[{ contact_id, path, origin_ref }]`, at most 40), which the engine sends only once 1.10.0 is served.
4. **Typed `facts[]`** on a row card, each `{ kind, text, source_url, observed_at }`, so card words are built from facts and never from prose. Built in krishanraja/control-center#586: at most eight on each person in `network`, `amplifier_candidates` and `quiet_ties`, with a `facts` coverage line and `features.facts`; `null` is unread and `[]` is read with nothing that qualifies. The engine's side is `factLines` in src/stages/rows.mjs (a post with its page, a role change, a shared employer).
5. **`asset_ref`** on a version 2 action: Control Center mints a SendLinks link per recipient when it drafts or he presses.
6. **The Growth library listing.** Titles and modified dates only, of Drive mind/make > 03_Growth and the Canva folder Mindmake Growth, as a context part with coverage. Read access is Krish's grant.
7. **Traffic.** Revised 27 October so as not to fork Control Center's one Google Analytics feed: the directive's existing `web_analytics` block (1.10.0, served to makeyourmindup today) also for Mindmake's mindmake.co, with no per-post part and with `consent_gated: true`; the engine reads it (`src/stages/traffic.mjs`) and needs no `features.web`. As first written: `features.web` and a context part `web` for mindmake.co from the existing Google Analytics store: its coverage line and flags (always `consent_gated`); the latest weekly insights (7 days against the previous 7: sessions, users, engaged sessions, page views, key events; top sources, pages, channels and AI sources); 28 days of the daily totals, each null with a reason when unread; and 14 days of rows by source and medium and by landing page, landing paths filtered as Control Center filters them. Nothing else: no full referrer, query string, country, device, user id or Plausible. Figures go to the engine's own bearer only.
8. **The show-notes note.** Built in krishanraja/control-center#584 with `withdrawn[]` beside it; the engine writes the words (`src/stages/shownotes.mjs`). A `show_notes_ask` email kind in Jonny's box, drafted only after Control Center records `booked_at` on one of Jonny's pitches to someone else's show or stage (`job: 'booked'` with a `visibility_target_id`), never on a guest invite (`job: 'guests'`), once per booking, counted inside the ten Jonny drafts a day, and sent by Jonny.
9. **Each draft's `mailbox` and `created_at` (plan Phase 2): already served, nothing to build.** A read-only check of Control Center's `api/_growthContext.ts` on 27 October found `records.drafts` carrying both from `people_drafts`, with `mailbox: 'jonny'` on every pitch and invite `api/_pitchDrafts.ts` drafts. The engine counts that London day's Jonny drafts (`jonnyDraftsToday` in `src/stages/pitches.mjs`), so a second wake writes only what is left of the ten; a draft with no readable time is not counted. The week spec (`gms-<monday>`) is an ordinary `stage: "plan"`, `wall: "strategy"` proposal on the existing fields, read back from decisions and never sent to prepare-action, so it needs no change either.

## Prepaid credits (protocol 1.16.0)

Ruling (Krish, 2026-10-29): a growth engine may spend up to its placement share of a tool's prepaid credits each cycle with no per-batch approval, and reports what it made. The contract is docs/control-center/ENGINE-PROTOCOL.md, "Prepaid credits: spend your share before it is wiped (1.16.0)".

- **Where it arrives.** Every directive may carry `credits: { rule, pools[] }` (`features.credits`), each pool `{ pool, tool, unit, share, share_amount, spent_this_cycle, remaining_for_you, pool_balance, balance_as_of, use_by, resets_on, days_left, unit_costs[] }`, soonest wipe first. A directive with no `credits` means it could not be read today, never a share of zero.
- **Mindmake's pools.** ElevenLabs `main`: about half of the pool's monthly credits; it renews on the 10th and unused credits roll over for two months. It holds Krish's voice clone. Apify `main`: about a fifth of the plan's included monthly usage, in `usd`; it resets on the 21st. Apify is pay as you go (Ruling, Krish, 2026-10-29), so its pool comes with `mode: ceiling`: the share is a cap, never a target, and runs are chosen by `get_apify_learnings` (docs/CREDITS-SESSION.md). The exact share, what is spent and what is left come from the directive each run, never from this file.
- **What to do.** Spend up to `remaining_for_you` of each pool on work that moves this engine's objectives, `good_meetings` first: for example Apify runs that find booking routes, hosts and stages, and ElevenLabs drafts of audio a pitch or one-sheet could carry. Report each spend in the report's optional `credits_spent[]`, `{ pool, amount, asset, objective_key }`, at most 40, at `schema_version` 1.16.0. `asset` says what it made in words, never an address.
- **The walls.** Never past `remaining_for_you`; never a top-up, a plan change or new money (Apify beyond its included usage is new money, so stop at the share). Nothing made with the credits is published, posted or sent without its own approval, and anything in Krish's cloned voice needs his yes before it goes anywhere. The approved execution ruling (2026-10-22) still governs every external action: he approves the exact finished action, and only the shared executor runs it.
- **Podchaser's API points.** Mindmake holds the main share of the 25,000 points a month (wiped on the 1st). The runner spends them every day through the research desk's `podcasts` kind, up to its daily cap, on rotated topics his buyer listens to (src/stages/podcasts.mjs); they cost no dollars.
- **Who spends it.** The runner reads `credits` where `features.credits` is served, says what is left in one activity line and spends nothing (src/stages/credits.mjs). The daily scheduled session spends the share (docs/CREDITS-SESSION.md): `get_engine_credits`, then `reserve_credit_spend` before and `settle_credit_spend` after every generation through the Control Center connector, which takes it off the share in the next directive, so it is never reported again in `credits_spent`. The copied report schema lists every version through 1.16.0 (krishanraja/control-center#619).

## Acceptance

- A synthetic report is accepted, replays with the same acknowledgement, and reads back with the same digest.
- A second report under the same `run_id` with a different payload is refused with a 409.
- A failed run leaves started plus failed attempts, and Growth > Engines shows it failing beside the last success.
- An outreach proposal reaches Krish's list. His Clear appears in `GET decisions` with the payload digest you sent. Change one word and report again: it is pending again.
