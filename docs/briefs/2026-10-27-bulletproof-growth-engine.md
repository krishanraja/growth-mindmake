# A bulletproof growth engine for Mindmake, with Canva in it

Status: plan (version 3), filed for Krish's go. Nothing in the engine is built by this document. Version 3 adds traffic to mindmake.co, read by the Measurement Specialist.

Written 2026-10-27, from four sources:
- Krish's brief;
- the reference architecture (Drive, 27 Oct 2026, the content-engine redesign);
- the Mindmake growth corpus (Oct 2026);
- a read-only inventory of this repository, its Actions runs and pull requests, Control Center's placements and venture state, the Mindmake canon, Drive and Canva.

Two independent review rounds tried to refute every figure and mechanism. Version 2 folds in their corrections. Version 3 adds a read-only inventory of how mindmake.co is measured, in the mindmake and Control Center repositories. Where a figure is this review's own count, it says so.

## Why

The content engine failed on 27 October. It ran in one long thread, the engine was rebuilt during the job, rules written as prose never held, and passes were certified by the session that did the work. This repository shows the same pattern on a smaller scale:
- **The full-card feature** on 27 October took six pull requests (#11 to #16) and six manual live runs (18 to 23) in about four hours. Five of those runs came before the last fix, and four found the defects the next pull request fixed.
- **At least seven of 23 pull requests** are corrections of earlier work: #6, #12, #14, #15, #16 and #22 fully, and #17 partly. #23 adapts #20 to a change in Control Center's form runner.
- **A silent success.** Live run manual-24 reported success while it read no context and prepared nothing.
- **The North Star number is computed nowhere.** It is U4, unmeasured.

The outcome wanted is an engine that:
- measures the number at its source;
- compiles each week from one spec Krish signs;
- blocks bad output with code before it reaches his phone;
- gets him onto more podcasts and stages;
- keeps everything it makes easy to find;
- costs a twentieth as much to change.

**What this moves on the North Star.** First, measuring it at all (Phase 1). Second, the visibility route to meetings: podcast and stage pitches that carry a real one-sheet, with bookings counted against the target. Third, traffic to mindmake.co: each booking becomes a lasting link to the brief, the site's only door to a meeting, and visits are read as a supporting measure that only breaks ties between levers, never as the number. Phases 2 to 5 are mostly cost and quality work. Under U4 they start only with Krish's explicit go, and each says what it moves. Nothing here changes the ICP, channels, formats or remit.

## Krish's answers (27 October 2026)

Recorded in docs/NORTH_STAR.md and AGENTS.md:

1. **The number:** "Anything that gets me good meetings counts towards my number, and we need to trace where it came from so we know what works." A meeting counts when he marks it good with one tap after it, whether with a buyer, a multiplier, a partner or a host. The engine pre-fills where it came from; he confirms. Qualified buyer conversations (the five tests) are reported as a subset.
2. **Rooms:** guest seats only. No hosted rooms this year.
3. **Visibility target:** two podcasts booked a week and one stage or panel confirmed a fortnight, replacing one podcast a week.
4. **Canva order:** a full, new Mindmake brand kit first, then the speaker and guest one-sheet. The kit is built by a Cowork computer-use session on his PC from his brand assets folder; he logs in and opens the folder. The old "Mindmaker" kit and decks stay as they are.
5. **The one-sheet:** a PDF at mindmake.co/media, with Jonny's box as the booking contact. SendLinks later carries a tracked link per recipient.
6. **The Growth library:** every asset and strategy the engine produces lives in Drive, mind/make > 03_Growth (docs/DRIVE.md), and the engine keeps it from sprawling.
7. **Signing:** the week spec is signed Monday morning, and Friday is the review.
8. **Drive sharing:** mind/make, and so 03_Growth, stays link-editable by his choice, so nothing private is filed there.
9. **Traffic:** "Don't forget to drive as much traffic to mindmake.co as possible. You have Google Analytics installed already and Control Centre can see that. Make sure this is a part of your Measurement Specialist. Happy to let you read Google Analytics directly if you prefer." His answers the same day:
   - Analytics is read through Control Center, never directly.
   - After one of Jonny's pitches to someone else's show or stage is booked, Jonny sends the host one short note asking for the brief link in its show notes or event page.
   - Once the one-sheet exists, it replaces the show link in podcast and stage pitches; Make Your Mind Up is still named, and the one-sheet prints the show's link and the brief link.
   - Traffic counts stay in Control Center; Drive readouts carry the week-on-week change and the share by path only.

Also recorded:
- **A dated fact, not a ruling.** Krish said on 27 October that the shared Codex allowance has reset. The allowance guard uses this as an input.
- **Canva, in his words:** "Canva is also available for you to use at will with zero limits in the engine." This plan reads that as: creating, editing, uploading and exporting drafts inside his own Canva account is at will. Publishing a brand template, sharing a design, making anything public, merging a page, and any send, spend, purchase, upgrade or trial still need his yes at the time. That reading is an interpretation pending his confirmation.

## 0. Lose nothing: what exists and stays

**What stays exactly as is.** All of this remains the fallback route until the new route has proved itself on real runs:
- the daily Control Center wake (05:10 UTC `repository_dispatch`) and `node src/cli.mjs dispatch`;
- the attempt journal, report readback by digest, and decision digests;
- capability negotiation from 1.2 to 1.9;
- the five rows with full cards, fit first, and the permanent No store (`lessons`, `refusedBy`);
- the canon and track record read live by blob SHA;
- Jonny's podcast, stage and guest pitches;
- forms on his tap (#20, #23);
- signals;
- the larger context budget (#22);
- 255 tests and the three demos;
- the 27 October session handoff (docs/history/2026-10-27-growth-session-handoff.md) and its continuation point.

**Live jobs.** There is no `schedule` trigger anywhere.
- `operate.yml`: `repository_dispatch` (`cc-growth-directive`) and `workflow_dispatch`, in modes engine, daily, readiness, weekly-review and dispatch.
- `ci.yml`: push, pull request and manual.

**Run history** (Actions, as of 27 Oct 12:25 UTC; #23 merged at 12:46):
- 25 operate runs, of which 22 were live dispatch runs since 19 October (9 woken by Control Center, 13 manual).
- Three failed: `attempt_unconfirmed` on 19 Oct, and `directive_invalid` on 20 and 21 Oct.
- Run manual-24 reported success while it read no context.
- The median run lasts 15 seconds overall, 17 for dispatch runs and 21 on 27 October. Actions billable time is effectively zero.
- CI: 62 runs then, 61 passed and 1 cancelled.

**Past fixes.** This review counted 48 distinct fixes from commit bodies, PR descriptions and docs. That is its own count; Phase 0 commits the list, with a commit or PR for each, so it can be checked. Most fixes are guarded by objective code tests.
- **No test (4):**
  - F08: secret and variable names in the workflow.
  - F09: schema verified before promotion.
  - F10: a link outside the repository. The fault is live again at docs/control-center/ENGINE-PROTOCOL.md lines 3, 157 and 300, and RELEASE.md claims a link check that does not exist.
  - F22: OPERATIONS.md says five minutes; operate.yml says ten.
- **Partly guarded (4):**
  - F15: the live report-reuse branch and `recovery_report_mismatch`.
  - F18: the voice-rules overclaim, half covered by tests/voice.test.mjs.
  - F20: the pinned canon, still stale.
  - F21: schema bounds, with no direct unit test.
- **Open (1):**
  - F48: a run that reads no context still journals success. #22 named the cause and raised the budget, but the silent success itself is not fixed.

**Open findings**, each confirmed by an independent reviewer, with the phase that closes it:

| Id | Finding | Phase |
|---|---|---|
| N01 | A second Control Center wake on the same London day replays the first report, though the protocol gives a later wake a new run_id. This happened live on 23 Oct. | 2, with a per-day pitch budget |
| N02 | `events[]` is always empty, so closes are never reported. | 3 |
| N03 | The directive's `north_star`, `urgency`, `constraints` and `rows_rule` are read nowhere. | 1 (north_star, urgency, constraints), 2 (rows_rule) |
| N04 | Policy fields `voice`, `recognition`, `acquisition`, `pilot`, `venture` and `execution.*` are never read. Row, fit and pitch caps and the 70/30 split are hard-coded. | 2 |
| N05 | The 1.9.0 pitch outcomes (sent, replied, booked, recorded, published) are read nowhere, so the engine cannot learn which shows answer. | 1 |
| N06 | A repeated `pitch_off` No never reaches the weekly review as a doctrine change. | 3 |
| N07 | Mutation-kill claims in PRs #12 to #19 cannot be re-run: no harness is committed or run in CI. | 3 |
| N08 | Docs drift: NOW.md head lags, docs/history/LOG.md is named but missing, merged PRs are called unmerged, and the protocol header says 1.8.0 while documenting 1.9.0. | 3, by the drift check |
| N09 | The trust-asset prompt's formats differ from `contracts/motions.ts`. | 3 |
| N10 | The `founder_visibility_open` hold was never recorded. | 1 |
| N11 | The registry target is a flat 5 against the ladder 2, 5, 8, 11, 15, 20. | 1 (good_meetings reads the ladder) |
| N12 | The pinned canon review lapses on 15 November. | Krish's review |
| N13 | The 50 held prospects were never turned into one decision. | 0 (reconcile with the handoff) |
| N14 | `strategicPlan().digest` is computed and never read. | 2 |
| N15 | The engine never recomputes `amended_sha256` before acting on an amended decision, as AGENTS.md and the protocol require. | 1 |
| N16 | A campaign plan over 8,000 characters fails the whole report instead of holding. | 1 |
| N17 | `blobSha` hashes decoded text, so it gives the wrong SHA for a binary file such as a PDF. | closed: raw bytes hash as bytes (PR #28) |
| N18 | Every approved `stage: "plan"` decision is routed to prepare-action whatever its id, so any new kind of plan would be treated as a campaign. | 1 |
| N19 | Version 2 said Vercel page views would measure the one-sheet. Vercel Web Analytics is off for the mindmake project, and a PDF runs no page tag, so nothing could have read it. | closed by version 3 (sections 3, 7 and 9) |

**How mindmake.co is measured today** (read-only, 27 October; mindmake at ddd0049, Control Center at 2965e73):
- **The site** runs Google Analytics 4 in Consent Mode v2 "basic": Google receives nothing until a visitor presses Allow, and the banner appears only after a scroll past 60% of the first screen. Analytics gets page views only, with no custom events.
- **Plausible** is installed and cookieless, so it sees every visit and the site's own events, including `scoping_request`, the click that opens the brief. Krish ruled on 2 October that Control Center gets no Plausible key, so it is read nowhere.
- **No attribution.** The site keeps no UTM tag or referrer; the brief request records only its entry route. (`/start` keeps a query string at the edge: a 307 to `/?...&start=1`.) There is no booking link, by canon rule: a reader reaches a meeting through the free brief.
- **Control Center** reads Analytics for mindmake.co every day with a read-only service account. It stores daily totals (sessions, users, page views, key events), rows by source and medium and by landing page, and a weekly insights read that always flags the count as consent-gated. None of it reaches a growth engine: the protocol has no traffic field.
- **The engine** puts mindmake.co in words only through the canon's brief link (row notes, signals and card angles). Pitches carry makeyourmindup.ai, and stage forms carry krishraja.com. Nothing is tagged, and nothing reads traffic.

**Pending work from the handoff.** Four route plans prepared on 22 October are still pending. Their action windows have expired and their original Advisory records do not resolve. The handoff's continuation point stays first in line: reconcile them before anything replaces them. Their id prefixes are recorded before the plan route is narrowed (N18), so none is stranded.

**The recurring defect.** Free text from Control Center records was used as card copy, so each live run found a new shape, and each fix added to a deny-list. The tests pin past examples rather than define a valid line, so the next unseen shape passes.

**In flight.** There are no open PRs. Of the Codex branches, only #7's remains on the remote; #21's was deleted. The second checkout on Krish's PC is checked before any local write and never written to.

## 1. The week spec: the one artefact he signs

One spec per London week, `growth-week/1`: canonical JSON of 8,000 characters or fewer. It holds no people, ids or private links, so a proposed spec can be reviewed as a file.

**Typed judgement fields:**
- lanes on or off;
- caps, inside the minimum and maximum bounds config/policy.json owns, each with a stated direction;
- a fit floor of 40 or higher;
- the assets in play;
- one experiment;
- questions for Krish.

**Referenced, never owned by the spec:**
- The visibility targets, which config/policy.json owns. Phase 2 replaces `policy.recognition` with the 27 October ruling before wiring it.
- The allocation, which stays inert until it is wired.

**Compiled, for information only:** the North Star week target, the canon blob SHAs, and the digest of the directive's week goals. They are never a gate; a mismatch is logged as an activity line, so a canon change never unsigns a week.

**Invariants, kept out of the spec:** no send or spend authority (zero spend is enforced in the compiler), one follow-up, no em dashes, privacy.

**Traffic stays out of the spec.** No traffic figure is ever written into a spec file. An experiment may name a traffic reading as its second measure, never its first.

```json
{ "spec": "growth-week/1", "week_of": "2026-11-09",
  "compiled": { "north_star_sha": "<blob>", "week_target": 8,
                "canon": [{"path": "project-documentation/00_NORTH_STAR.md", "sha": "<blob>"}, {"path": "project-documentation/01_CANON.md", "sha": "<blob>"}],
                "week_goals_sha256": "<hex>" },
  "rows": { "network": {"on": true, "max": 6}, "partners": {"on": true, "max": 6}, "reach_out": {"on": true, "max": 6},
            "visibility": {"on": true, "max": 6}, "events": {"on": true, "max": 6} },
  "pitches": { "per_run": 10, "stage_share": 4, "invites_per_run": 2, "invites_per_week": 4,
               "show_shares": {"makeyourmindup": 70, "signal_noise": 30}, "forms_per_row": 2 },
  "fit_floor": 40,
  "assets": [{ "id": "speaker-one-sheet", "version": 1, "blob_sha": "<git blob of the PDF bytes>", "url": "https://mindmake.co/media/<file>.pdf", "in": ["visibility", "events"] }],
  "experiment": { "id": "stage-share-5", "lane": "events", "change": {"field": "pitches.stage_share", "to": 5},
                  "measure": "replies_and_bookings_14d", "decide": "keep if replies plus bookings match or beat the prior fortnight; counts only below 20", "min_days": 14 },
  "last_week": { "good_meetings_total": null, "by_path": {} },
  "questions": [] }
```

The one-sheet's place in podcast and stage pitches is his ruling of 27 October, not a lever: no spec or experiment removes it. A worse fortnight becomes a question in `questions[]`, never a revert.

The default spec is generated from today's exported constants, policy and code keys, so it reproduces today's behaviour exactly.

**How it is proposed and signed, with no new write path or approval interface:**
1. **A session proposes.** Between runs, a session writes next week's spec as a file in this repository, by pull request. It contains nothing private.
2. **The dispatch posts.** The dispatch is the only production writer. It posts the merged spec as a `stage: "plan"`, `wall: "strategy"` proposal with id prefix `gms-`.
   - Its `expires_at` is the end of the spec's London week, and its evidence is blob-SHA links. Both stay fixed, so the digest never changes on its own and never re-asks him.
   - The same proposal carries last week's good-meeting counts to confirm (the Phase 1 stopgap, folded in from Phase 2) and any asset version awaiting approval. That makes one Monday ask.
3. **His Clear is the signature.** "Change it first" makes his amended version the signed one. The engine recomputes `amended_sha256` before using it (N15). An amended spec that fails the schema or loosens a bound is held as `spec_amended_invalid`, and the last valid signed spec stays in force.
4. **The plan route is narrowed.** Only campaign ids (`gmc-`) reach prepare-action (N18, in Phase 1). An oversized spec is held as `spec_too_long`, never thrown (N16).
5. **When it takes effect.** A spec takes effect at the first run whose decisions read, placed before compilation and rows, finds the signed digest.
   - Today the morning run reads decisions before he signs, so a Monday-morning signature takes effect at Tuesday's run, or at once if he starts a manual run.
   - A same-day re-wake applies it only once N01 is fixed (Phase 2).
   - The first signable spec is for the week of 9 November, effective Tuesday 10 November.
   - The spec surfaces only after the four 22 October plans are reconciled (a Phase 0 exit condition), because his list shows one ask at a time, plans oldest first.
6. **Fallback.** With no signed spec, the last signed spec up to 7 days old applies, then today's config, with the hold `spec_unsigned`.
7. **Pitch slots.** On Mondays the spec and the stopgap each take a non-row slot, so the report carries up to two fewer items from the end of the pitch and form list.

## 2. Repository structure (additive; every new src file registered in pipeline/stage-conveyor.json)

```
specs/schema/week.schema.json       the spec schema, frozen and hashed in contracts/manifest.json
specs/weeks/YYYY-MM-DD.json         proposed and merged specs (no people, ids or private links)
specs/examples/week.synthetic.json  synthetic only
crew/index.json                     specialist -> lanes, lint ids, check ids, card, lens
crew/<specialist>/card.md           3 KB or less, generated from the playbooks with a source hash and a drift check
crew/<specialist>/lens.md           1 KB or less, one question for an independent reviewer
src/crew/lints/*.mjs                pure (action, context, spec) -> findings; they import the stage predicates, never restate them
src/crew/checks/*.mjs               pure (Control Center readback) -> measurements
src/crew/compile.mjs                signed spec -> the caps the stages read, inside policy.json's bounds
src/stages/traffic.mjs              the mindmake.co reading from Control Center's web part, and the one builder of tagged links; pure, stores nothing
crew/measurement-specialist/        the Measurement Specialist's card and lens, like every specialist's
invariants/register.json            every past fix and open finding -> its test or an accepted reason, and its phase
library/taxonomy.json               generated from docs/DRIVE.md, with a drift check
tasks/cards/*.md                    task cards of 6 KB or less; returns go to ignored runtime/
scripts/{pack,check-crew,check-bespoke,check-library,dispatch-card,verify-card,mutate}.mjs
tests/regression/*.test.mjs         the missing regression tests
tests/fixtures/live-shapes/*.json   hand-written synthetic versions of each live failure shape, never live text
```

**One owner each:**
- The stage modules keep owning behaviour. A specialist owns its lint, check, card and lens, not the stage's code.
- `good_meetings` lives in `scorecard.mjs`; traffic never enters it.
- The traffic reading and the tag allowlist live in `traffic.mjs` alone. The canon still owns every destination: a tagged link is the canon's own URL plus two fixed keys.
- The asset version in force is the one Control Center approved by SHA. The spec references it; the Drive index only labels it.
- RELEASE.md stays the completion record. `npm run status` extends the existing readiness command and prints the evidence RELEASE.md cites.
- New owner lines go into AGENTS.md and the conveyor in the same change.

## 3. The crew (from this repository's rows, routes and remit)

| Specialist | Stage code it reviews | Lint (blocks before acting) | Measured check (real data, after) | Lens |
|---|---|---|---|---|
| Network Steward | `rows.mjs` network row | tie evidence counted both ways; quiet 90 days or more; no refusal; one ask; a route; card grammar; the canon's link untagged | a reply within 7 days (Control Center's email count rises after `carried_out`); a good meeting on `existing-relationship` | Will they feel remembered, or worked? |
| Multiplier Steward | partners row, connector intro asks, introduction permissions | relationship evidence beyond a LinkedIn connection; one named person with a reason; the fit floor; card grammar | connector reply within 7 days; introductions offered; good meetings on `multiplier-intro` | Does this spend their trust, or give first? |
| Visibility Producer | podcast pitches, own-show guest invites, podcast and show forms, appearance asks, the show-notes note | the show's own booking address; an episode within 120 days; never pitched; never his own show; one ask; his ruled title; the show named; the one-sheet as the pitch's one link only when the PDF reads at its pinned SHA, else the show's link; the show-notes note only after Control Center records the booking on one of Jonny's pitches, once per booking, never to a guest on his own shows | the 1.9.0 sent, replied, booked, recorded and published per pitch, read for the first time (N05); bookings a week against 2; tagged and referral visits in the 14 days after an episode publishes; later, SendLinks opens | Would the booker say yes in ten seconds? |
| Stages Producer | speaking pitches, stage forms (#20, #23), `teach` asks, the event-page note | open and before its deadline; a speaker address or form from the stage's own page; his buyer in the room; one talk title; never press; the event-page note only after the stage confirms a date on Jonny's pitch thread, once | a reply; a stage confirmed only by a reply with a date or a calendar event, never by a form's "confirmed" receipt, against 1 a fortnight; brief and meeting requests within 7 days of the session; tagged and referral visits in the 14 days after it; good meetings on `guest-seat` | Is his buyer actually in this room? |
| Signal Scout | `signals.mjs` | an executive by their own headline; worried in their own words; not an AI person or seller; inside the research window signals.mjs already uses; quoted exactly with the post named; the canon's link untagged | reply within 7 days; good meetings on `public-signal`; opt-outs suppressed the same run | Will they feel heard, or harvested? |
| Trust-Asset Steward (Canva) | `motions.mjs` trust assets and decision aids | the Mindmake kit; fonts and colours inside it; the name exactly "Mindmake"; read-back text equals the approved text; every fact named by blob SHA; one page; Jonny's box as contact and never Krish's personal email; none of what the canon says is never published (price, rate card, availability, unconsented client names, the method's name); no durations, emoji or em dashes | the PDF's blob SHA at its URL equals the approved one; visits tagged `growth-one-sheet`, from bookers who press the PDF's link and from listeners of show notes a host copied from it, never read as PDF reads (SendLinks opens are, C3); replies and bookings on pitches carrying it against the prior fortnight, a Friday reading and never a revert; SendLinks opens per host | Does it prove, or decorate? |
| Measurement Specialist | `scorecard.mjs`, `outcomeScorecard`, qualification review, weekly-review attribution and `traffic.mjs`. It stores nothing: Control Center records each meeting and each day's visits | every meeting carries the path Control Center recorded from the engine's pre-fill and his tap, never rewritten; assists kept separately; a visit is never a meeting, a path count or a result; every traffic line carries its coverage and the consent sentence; null with a reason, never zero, unless Control Center has proved the site receives data; every link is the canon's URL byte for byte, or that URL plus exactly the two allowed keys on an allowed placement; no tag on his notes, on a citation or on another domain; no traffic figure in git, a spec, printed output or logs | good meetings a week by path against the ladder; the qualified subset; paid proofs traced to their path; meetings with no match; mindmake.co sessions, engaged sessions and key events over 7 days against the previous 7; `growth-*` tagged visits by path; referral visits from the domains of shows and stages he was booked on; AI sources | Would this survive "show me the meeting", with every visit figure saying what it cannot see? |
| Librarian | docs/DRIVE.md, Drive 03_Growth, Canva Mindmake Growth | before filing: the path is in the map; the name passes the naming pattern; no duplicate of kind, subject and version; a superseded file moves to the archive in the same step; never trash or share; nothing private (the library is link-editable) | the tree walk finds zero of each: files outside the map, loose files, duplicates, more than one PDF in a Current, engine-made Canva designs outside the folder, copies older than their source's last change, index entries that do not match | Could Krish find the current version in ten seconds? |
| Guard | `guards.mjs`, `check.mjs`, policy | nothing sends, publishes, spends or changes permission without his yes; no automation of posting, messaging or connecting on LinkedIn; no live people in git; no per-run bespoke code; the directive's constraints; no traffic figure in logs | constraint breaches zero; opt-outs honoured; restriction notices zero | Is anything here acting without his yes? |

**Traffic, driven and measured.** Meetings by path decide what ranks first; traffic by path only breaks ties between levers. The levers, by expected traffic:
1. **The show-notes note** (T1, section 9). After one of Jonny's pitches to someone else's show or stage is booked, Jonny asks the host to put the brief link in the show notes or event page: a lasting public link, read just after the audience has heard him.
2. **The one-sheet as a pitch's one link** (C2). Every pitch then sends a booker to mindmake.co.
3. **The canon's brief link** in row notes and signals, unchanged and untagged.
4. **The stage-form website field.** It becomes mindmake.co (Ruling, Krish, 2026-10-27: "mindmake.co for all mindmake venture things"); built in PR #28: mindmake.co, the company's website too, and krishraja.com only where a label asks for his personal or speaker site (playbook 11).

Not this engine's: Make Your Mind Up's own notes (playbook 05, publication boundary) and new pages on the site (the mindmake repository, with his read before merge).

**Tagging, for public placements only.**
- **The tag:** `utm_source=growth-<podcast|guest-seat|one-sheet>&utm_medium=referral`, added to a mindmake.co page URL after `?start=1` with `&`. The medium stays one of Analytics' own words, so Control Center's channel view stays readable.
- **No other key:** never `utm_campaign`, `utm_content`, `utm_term` or `utm_id`.
- **Nothing identifying:** never a person, a show, a proposal or a date.
- **Where tags go:** show notes, event pages and the one-sheet's printed links.
- **Where they never go:** his one-to-one notes, source citations, own-show invites, Jonny's pitch body and any other domain.
- **No frozen-contract change.** `contracts/growth.ts` pins exact URLs only on the snapshot route (`draft.mjs`), which is never tagged; the allowlist lives in `traffic.mjs`.
- **Untagged visits still count.** Referral rows (`<host> / referral`) are matched against the hosts of shows and stages Control Center records as booked, recorded or published.

**Card grammar** is the lint every row specialist shares, and it ends the deny-list chase.
- A line may be built only from typed slots: a name, a title, an organisation, a counted figure with its source, a canon quote, or a record sentence that passes the fact test.
- The fact test extends today's `factOf` and `leadFacts` (src/stages/rows.mjs), with its own tests.
- Control Center is asked for typed `facts[]` instead of prose.
- Property tests prove every live failure shape is held as `card_grammar`, with generated variants of each.
- The deny-lists stay as a second net.

**Shadow first.** Every new hold (card grammar, the directive's constraints, the Librarian) runs in shadow until the Phase 5 switch: it is counted and reported, and nothing it would hold is hidden. The current route keeps working unchanged until the new one has proved itself.

**What the engine does with LinkedIn, stated plainly.** It chooses what Control Center collects from LinkedIn (posts, the people who engaged, their routes) through Control Center's research desk, inside its daily caps. It never posts, messages or connects.

**Proposed rules: lints only once he rules.** The corpus recommends practices this repository has never adopted:
- at most one ask of a multiplier in 30 days, unless they offered;
- a gift before an ask;
- a forwardable blurb of 150 words or fewer;
- identification and an opt-out on a cold email, plus a postal address for US recipients;
- a 30-day limit on the age of a signal comment.

They reach him as questions on the first spec, not as silent new gates.

## 4. Checks mapped to this repository's failure history

| Failure class (ids) | Invariant | Guard today | Added guard |
|---|---|---|---|
| Protocol drift (F13, F21) | accept any 1.x directive; gate each report version, and each new report field, on what Control Center serves | dispatch and rows version tests | unit tests for maximum, minLength and minItems; a test that a new field is sent only when its version is served |
| Replay and recovery (F03, F15, N01) | a restart never re-prepares or re-executes; a later wake gets its own run_id | adapter and dispatch replay tests | live-reuse and `recovery_report_mismatch` tests; a same-day second-wake test with its fix |
| Silent success (F48) | a run that reads no context, or prepares nothing while Control Center serves work, is a held run with a named class, never a quiet success | #22's dispatch test of the named class | `npm run status` reads empty output as not done |
| Retired routes and secrets (F08, F11, F12, F22) | never call retired routes; the workflow binds exact secret names and timeouts | dispatch and strategy tests | a test that parses operate.yml against OPERATIONS.md |
| Card words from free text (F27 to F45) | lines only from whole typed pieces | about 25 rows and pitches tests | card grammar, property tests, `card_grammar` in shadow, then enforced |
| Unknown versus zero (F30, F45) | never a zero that was not measured | dispatch null test | extended to good meetings and every check |
| Ranking by vanity (F23, F25) | fit first, floor 40, competitors out | rows fit tests | the spec can raise the floor, never lower it |
| Duplicates and priority (F06, F14, F16) | one copy per person; replies before new outreach | learning, dispatch and strategy tests | unchanged |
| Stale canon (F20, N12) | canon read live; the pinned copy reviewed | rows canon tests | CI warns 14 days before the pinned review lapses |
| Claims in docs (F09, F10, F18, N08) | status is evidenced, never asserted | none | a local link check in check.mjs; a drift check for NOW head and the protocol header |
| Self-certification (N07) | a claimed kill rate re-runs in CI | none | a committed, zero-dependency mutation runner for card grammar and pitches |
| Bespoke code per run (the 27 Oct pattern) | no run ids, dated values or people in src string literals | none | `check-bespoke.mjs`, scoped to string literals outside comments, with ruling citations allowed |
| Plan routing and digests (N15, N16, N18) | only campaigns reach prepare-action; amended digests are verified; oversize holds | none | stand-in tests for each, in Phase 1 |
| Binary hashing (N17) | assets hashed from raw bytes | none | a unit test with a real PDF |
| Visits as results (traffic ruling) | a visit is never a meeting, a path count, a result or an objective; every reading carries the consent sentence | none | traffic unit tests on the stand-in, and a test that the printed run result holds no traffic figure |
| Tagged links (traffic ruling) | only the allowlist, only on public placements, never on his notes or citations | none | a round-trip test: stripping the two keys gives back the canon's live URL byte for byte |

## 5. Session protocol

**Session kinds.** Each session is fresh and does one job:
- a spec session (Friday) writes next week's spec file and ends;
- a build session (between runs) verifies one task card;
- an asset session makes one Canva revision;
- the daily dispatch stays at zero tokens.

Token and wall-clock budgets are provisional until Phase 0 measures the real median per session; they are then set at one twentieth of it.

**A session pack of 36 KB or less.** `npm run pack` writes runtime/pack.md. It counts every mandatory load, including the ones loaded anyway:
- AGENTS.md (about 12 KB);
- NOW.md (about 16 KB);
- docs/NORTH_STAR.md (about 3 KB);
- the signed spec;
- the cards of up to three specialists in play;
- open lint findings and holds, as counts and codes;
- gate status.

The first three alone come to about 30 KB. GET-GOING's read list adds GET-GOING itself, the handoff, the Control Center brief and the protocol, about 75 KB more. So Phase 4 asks Krish for one change across AGENTS.md, GET-GOING.md and NOW.md (which the docs steward keeps):
- shorten the always-on files;
- turn the standing reads into the cards that distil them.

Until he agrees, the pack cannot meet its size, and the plan says so rather than pretending it does.

**No mid-turn questions.** Questions go into the next spec's `questions[]` and reach him in Monday's one ask; the session ends at that gate.

**Recurring gates: two a week.**
- Monday: one ask, holding the spec, last week's counts and any asset version.
- Friday: the review.

A Codex spend ask comes only when the guard requires it.

**Two clocks.** Phase 0 reads session events (counts only) and gives tokens, engine time and time waiting on Krish per session. These counts are runtime only, never a stored record.

## 6. Codex task-card dispatch

Codex builds code between runs as a development tool; the engine's runtime gains no model provider.

- **A card, 6 KB or less,** holds:
  - the model and effort, pinned (the reference architecture's measured choice, re-verified against Codex's own model list at dispatch, never the default);
  - maximum minutes and calls;
  - the worktree;
  - `write_allow` globs;
  - five read files or fewer;
  - a never list: no git, network, MCP, publishing, new dependencies, or edits outside write_allow;
  - the interface, verbatim;
  - acceptance commands that must exit 0;
  - the JSON return shape.
- **Dispatch** runs from a local Claude Code session on Krish's PC, where the Codex plugin lives: `node <plugin>/scripts/codex-companion.mjs task --background --fresh --write --model <pinned> --effort <pinned> --cwd <worktree> --prompt-file <card>`, then `status --wait` and `result`. Never the codex-rescue subagent.
- **A worktree per card,** from main, on a `codex/<card-id>` branch, never in the second checkout.
- **The allowance guard.** `dispatch-card.mjs` takes a dated usage reading with its source for every dispatch. It refuses when:
  - the reading is unknown, or older than the last dispatched card;
  - usage is above 80%;
  - there is no yes from him for this card, recorded as a decision on his Control Center list, whose id and digest are the named approval.
- **Verification.** Claude re-runs the acceptance commands and the seven repository checks outside the sandbox, and confirms the diff stays inside write_allow. Codex's own report is never evidence.
- **Fallback.** The same card runs through a Claude agent in an isolated worktree and is verified the same way.

## 7. Tool routing (Control Center tool catalog 2026-10-26.1, placements ruled 26 Oct)

| Tool | Use here | Gate |
|---|---|---|
| Canva (main: Mindmake) | the brand kit, brand templates, the one-sheet, later aids, all in the Canva folder Mindmake Growth | drafts at will inside his account; publishing a brand template, sharing, public links, purchases, upgrades or trials need his yes |
| Google Drive | the Growth library, mind/make > 03_Growth, link-editable by his choice | create and move inside 03_Growth only; nothing private |
| SendLinks | a tracked link per recipient to an asset, minted by Control Center when it drafts | the send stays with the send lanes |
| Control Center | records, approvals, drafting into Gmail, form submission on his tap, outcomes, calendar, and the research desk within its caps | the protocol only, except the Friday traffic stopgap's one approved row read until 1.10.0 |
| Gmail | Control Center drafts Jonny's pitches (no press) and the drafts for his rows | the engine never drafts or sends |
| Google Analytics 4 | mindmake.co traffic for the Measurement Specialist, read through Control Center's web part (1.10.0), never directly | read only; consent-gated; counts stay in Control Center |
| Plausible | installed on the site and cookieless, but not read, by his ruling of 2 October | not used |
| Vercel | deploys mindmake.co; Web Analytics is off, so it reads no traffic | not used for measurement |
| Brandfetch (main: Mindmake) | partner logos for a later co-branded asset | approved per lookup |
| Teleprompter (main: Mindmake) | a rehearsal script once a talk is booked | not before a booking |
| HeyGen, ElevenLabs (main: Mindmake) | held: `founder_visibility_open` (docs/briefs/2026-10-22-heygen-outbound.md), and the reference architecture's statement that the face and voice clones stay on backup until he has trained them | not used |
| Higgsfield, Runway | placed with other ventures | not used |
| Apify, LinkedIn | only through Control Center's research desk, as section 3 states | not used directly |
| Codex | code between runs | the allowance guard |
| Instantly, Apollo, Fireflies, Descript | retired | never |

## 8. The phased build (one pull request each; dates are targets)

### Phase 1: wire the number (first, by 31 Oct)

**Before the first Monday post, in the same PR:**
- record the id prefixes of the four pending 22 October plans;
- narrow the approved-plan route to `gmc-` campaigns (N18);
- recompute `amended_sha256` before reading any amended payload (N15);
- hold an oversized plan instead of failing the report (N16).

**The number:**
- `good_meetings` goes in `scorecard.mjs`, beside the existing objectives (the 5/1 registry lock on `qualified_conversations` stays).
- Its week target comes from the directive's `north_star`, else the ladder in docs/NORTH_STAR.md (N11).
- It is one objective, with per-path counts carried as activity lines, because the report allows 20 objectives.
- Paths: existing-relationship, multiplier-intro, partner, guest-seat, podcast, own-show-guest, public-signal, inbound, referral, unknown.

**Stopgap from week one, with no Control Center change needed:**
- Each Monday the dispatch posts "Last week's good meetings" as a `stage: "plan"` proposal with prefix `gmg-`. Its payload has a required `total` and counts by path, all null.
- Krish fills in the counts with "Change it first". An unamended Clear means not counted; an amended null path means zero.
- The engine verifies his amended digest and reports the number with its source named as his typed weekly totals.
- Counts only, no names.
- From Phase 2 the stopgap folds into the spec proposal.
- Whether this reading may stand in for the metric until the per-meeting tap exists is his to say; only he edits docs/NORTH_STAR.md.

**Also:**
- Podcast and stage bookings are read from the 1.9.0 outcomes and reported against 2 a week and 1 a fortnight (N05). `booked_at` is taken as Control Center records it; a stage counts as confirmed only on a reply with a date or a calendar event.
- The directive's `north_star`, `urgency` and `constraints` are read, and constraints are enforced in shadow (N03).
- The `founder_visibility_open` hold is recorded (N10).

**What Control Center owes.** This goes into docs/CONTROL-CENTER-BRIEF.md (GET-GOING Step 5), for its own session after its 1.9.0 work, as protocol 1.10.0, built in this order: first what wires the number (the held meetings, the good prompt and `origin_candidates`, `facts[]`, `asset_ref`, the library listing), then traffic and the show-notes kind:
- each held meeting from his calendar, with `meeting_id, contact_id, held_at, good, good_at, origin_path, origin_ref, assists[], said_yes_because`;
- the one-tap good prompt, pre-filled from the engine's `origin_candidates`. The engine sends these only once Control Center serves 1.10.0, because the report schema refuses unknown fields;
- typed `facts[]` for cards;
- `asset_ref`, minting SendLinks links;
- a listing of 03_Growth and Mindmake Growth (titles and dates only), so the dispatch can run the library check daily. Granting that read access is his decision.
- **traffic (1.10.0):** `features.web`, true for Mindmake only, and a context part `web` for mindmake.co. It holds:
  - its coverage line and flags, always including `consent_gated`;
  - the latest weekly insights: 7 days against the previous 7 for sessions, users, engaged sessions, page views and key events, plus top sources, pages, channels and AI sources;
  - 28 days of the daily totals, each null with a reason when unread;
  - 14 days of rows by source and medium and by landing page, with landing paths filtered as Control Center already filters them.

  Nothing else: no full referrer, query string, country, device, user id or Plausible. The figures go to the engine's own bearer only. Because the push is at 05:10 and the snapshot at 05:30 UTC, each reading is a day behind and says so.
- **the show-notes note (1.10.0):** a `show_notes_ask` email kind in Jonny's box. Control Center drafts it only after it records `booked_at` on one of Jonny's pitches to someone else's show or stage, never on a guest invite to his own shows, once per booking, counted inside the ten Jonny drafts a day, and Jonny sends it.

**Accept, on the stand-in:**
- an approved or amended stopgap never reaches prepare-action;
- an amended payload is used only after its digest verifies;
- synthetic meetings give exact counts by path;
- unserved means null with a reason, never zero;
- a paid proof is traced to its path;
- bookings per show feed the rank;
- the report stays inside its schema with every objective present.

**Accept, live:** the first Monday stopgap he answers gives a non-null number with its source.

**Phase 1b, the traffic reading (its own pull request and GET-GOING step, after Phase 1's).**
- Two activity lines a run, never an objective: the whole site, then the share that came through the engine's tagged and matched referral visits. Each line carries the consent sentence.
- When Control Center does not serve 1.10.0 or `features.web`, one line says the reading is not served yet.
- No figure reaches the printed run result or the Actions log.
- No objective, because Control Center picks the next action by an objective's gap, and visits must not steer the work.
- **Accept, on the stand-in:**
  - exact lines from a synthetic web part;
  - null when the part is unserved or uncovered;
  - the consent sentence on every line;
  - tagged visits summed by path;
  - referral hosts matched to booked shows and stages;
  - the tag round trip;
  - no tag on notes or citations;
  - no figure in the printed output.
- **Stopgap until 1.10.0:** each Friday the review session reads mindmake.co's latest stored insights row through Control Center's bounded row read (one request, named columns), only after Krish approves that read; if he does not, it asks him in the review for the week-on-week change he sees on Growth > Numbers. It files a readout in Drive's Growth measurement folder with the week-on-week change and the share by path only, and writes no count anywhere.

**Whether the weekly count may be written into NOW.md's public state line is his to rule.** AGENTS.md keeps business figures out of git, and Control Center serves Mindmake's figures as private. Until he rules, NOW.md records only availability, urgency and the reading's date, and the count stays in Control Center.

### Phase 0: baseline and register (alongside Phase 1)

- **Session baseline.** Session events are read for the sessions that produced the PRs: 21 of 23 PR bodies link a session, five distinct ones, and one of them produced #10 to #20, #22 and #23. The baseline is measured per session, as tokens, turns, engine time and time waiting on him, with counts only kept in ignored runtime/. A capability is defined as the work between two merges. The Codex PRs (#7, #21) are listed as untraceable.
- **Register.** `invariants/register.json` lists every past fix and open finding, with its commit or PR, its test or accepted reason, and its phase.
- **Handoff.** The four pending route plans are reconciled with their current records before anything replaces them. This is an exit condition before any spec is posted.
- **GET-GOING.** Steps 0 to 5 are closed or re-ticked from evidence.
- **Accept:** every figure in this document is re-derived with its run or PR ids, and every register entry has a guard or a reason.

### Phase 2: the spec, compiled (week of 2 Nov; needs his go under U4)

- **Build:**
  - the schema, `compile.mjs`, the `gms-` proposal, the signed-digest read placed before compilation, the fallback chain and the `spec_amended_invalid` hold;
  - hard-coded caps and unread policy fields move into read config with values unchanged, and policy.json gains explicit bounds (N04);
  - N01 fixed with a new run_id per wake, together with a per-London-day budget of Jonny drafts (show-notes notes, invites and pitches) read from that day's drafts, so later wakes never exceed Control Center's ten drafts a day;
  - `rows_rule` read, and N14 resolved.
- **Accept:**
  - a golden test: every fixture gives a byte-identical report under the default spec, with the word files and canon reader pinned;
  - approve and amend round trips on the stand-in;
  - the length and invalid-amendment holds;
  - the unsigned fallback;
  - a spec can never loosen a bound.
- **What it moves:** one Monday ask in place of scattered ones, so his presses go to meetings.
- **Timing.** Merging it makes every pending row's source revision stale on his phone, so it merges right after a run, not before one.

### Phase 3: the crew as code (week of 9 Nov; needs his go under U4)

- **Build:**
  - nine lints and checks that import the stage predicates;
  - generated cards and lenses;
  - card grammar;
  - `events[]` closes (N02);
  - repeated Nos as weekly-review proposals (N06);
  - the trust-asset format mismatch (N09);
  - the regression tests for F08, F10, F15, F18, F21, F22 and F48;
  - `check-bespoke`, the link check, the drift check and the mutation runner (N07, N08);
  - the Librarian's lint and `check-library.mjs`.
- **Accept:**
  - every register entry passes;
  - cards are 3 KB or less and lenses 1 KB or less;
  - every live failure shape and its variants are held;
  - on a synthetic listing, the library check catches a loose file, a duplicate, a second PDF in a Current and a stale copy;
  - the naming pattern passes every example in docs/DRIVE.md.
- **What it moves:** fewer bad cards on his phone, so more presses become meetings.

### Phase 4: the session protocol and dispatch tooling (week of 16 Nov; needs his go)

- **Build:** `pack.mjs`, the cards that replace standing reads (with his yes to the AGENTS.md, GET-GOING.md and NOW.md change), the task-card template, `dispatch-card.mjs` with the guard, and `verify-card.mjs`.
- **Accept:**
  - the pack builds at 36 KB or less, counting every mandatory load;
  - a new card runs through Codex and is verified outside the sandbox;
  - the guard refuses when the reading is unknown, stale, above 80%, or has no yes.

### Phase 5: prove on real runs, then switch (week of 23 Nov)

**The switch.** The new route runs alongside the old for one London week behind `spec.enabled`. It switches only after:
- one signed spec;
- five consecutive live proof runs with no corrective PR;
- shadow holds reported;
- the number measured.

The old route stays in code for 30 days after.

**The 20x targets,** measured per session against the Phase 0 baseline:

| Measure | Target |
|---|---|
| Claude tokens per accepted capability | one twentieth or less |
| PRs per accepted capability | 1 (was 6 for the card feature, 4 of them corrections) |
| Corrective share of PRs | 1 in 20 or less (was at least 7 in 23) |
| Live runs started to find defects | 0 (was 5) |
| His review rounds per capability | 1 gate |
| Mid-turn questions | 0 |
| Recurring gates | 2 a week |
| Ask-to-accepted wall clock | one twentieth, wherever the baseline is measurable |

Proof runs are not counted as defect-finding runs. The dispatch itself (seconds, no cost) is not a target. A run with no measured outcome counts as not done.

## 9. The visibility track: Canva and traffic (parallel from day one; it moves the visibility route)

**What the live brand source says.** krishanraja/mindmake at commit ddd0049; files named by blob SHA in the Cowork prompt's header:
- **Name** (`project-documentation/00_NORTH_STAR.md`): **Mindmake**, never "Mindmaker", "The Mindmaker", "Mindmaker Live" or "Mindmake AI". The legal entities keep their names only in legal text. The drawn wordmark reads MIND/MAKE; typed text always says Mindmake.
- **Type** (`project-documentation/03_DESIGN_CONTRACT.md`, the founder's ruling of 25 September, matched by `src/styles/mindmake.css` and its type check):
  - Newsreader light for headlines, and Newsreader 400 for anything read.
  - Archivo 700 only for actions, plus small interface text.
  - IBM Plex Mono 400 for labels, numbers and dates, in tracked capitals.
  - Source Serif 4 only for the private brief's brand line.
  - An older line in the North Star still says a grotesque carries structure. The dated contract and the code win.
- **Colour:** mint is the answer, amber is what moved since yesterday, and nothing else is coloured for decoration. The grounds are ink, raise and paper.
- **Krish's name:** he appears only in approved biography, proof framing and verbatim quotes, never in anything written as Mindmake. The one-sheet is approved biography written about him, in Jonny's framing.
- **No /media route today** (`src/App.tsx`): "Media" in the menu links to the publication. The PDF needs a small static-file change in the mindmake repository, with no new page and no menu change.

### C1. The brand kit

Built by the Cowork session in docs/briefs/2026-10-27-canva-brand-kit-cowork.md. The four logos are already in Canva's Uploads, placed there through the connector on 27 October and verified by readback.

Verification:
1. The cloud session recorded the existing kit ids before the session; the one new id is the Mindmake kit.
2. A test design is generated on that kit and filed in Mindmake Growth > Brand kit.
3. Its fonts and colours are read back, and its thumbnail passes an independent visual check.
4. Everything is filed in the Growth index.

Krish approves the kit where he sees it.

### C2. The speaker and guest one-sheet

**State of use:** a booker or organiser triaging pitches, often on a phone, deciding in seconds and forwarding to a producer.

**Content.** Every fact is read live and named by blob SHA:
- his ruled title, Executive Host of Signal & Noise;
- Mindmake in the canon's own words;
- three talk titles he approves;
- his track record and stages from krishraja.com's own record;
- Make Your Mind Up, as the canon names it;
- the approved photo of him already used on the About page, never a generated likeness;
- Jonny's box as the booking contact, read from Control Center at build time and never committed here;
- a "For your show notes" line, with the brief link printed and tagged `growth-one-sheet` and the show's link printed untagged, so every host who uses it sends listeners to mindmake.co. The one-sheet is a booker's reference sheet, and by his ruling of 27 October it prints both links: its one exception to one ask, for this asset alone. C2's pull request raises the trust-asset cap for the one-sheet only.

**Design process:** three blind concept spines on the Mindmake kit, two blinded judges, and one synthesis shown to him cold.

**After his yes:**
1. Lock it as a Canva brand template with autofill fields, so later versions refill from live reads. Publishing that template is his yes.
2. Export the PDF.
3. He approves the exact PDF bytes, including the printed contact, by their blob SHA. A dispatch-posted proposal with its own prefix (`gmv-`) carries that approval, and it never reaches prepare-action.
4. Only then does a session (never the dispatch) open the mindmake repository PR that adds the static file. His merge publishes it. Opening that PR is a once-only gate.
5. This engine reads the PDF's blob SHA from its raw bytes (the N17 fix ships in this PR). By his ruling of 27 October, once the file reads, the one-sheet replaces the show's link as the one link in Jonny's podcast and stage pitches; Make Your Mind Up is still named in the words. Until it reads, pitches keep the show's link. It uses one of the two free source-revision slots and fails soft, like the track-record read. This step depends on Phase 1's narrowed route.

### T1. The show-notes note

After Control Center records `booked_at` on one of Jonny's pitches to someone else's show or stage (the show or stage confirming a date), Jonny sends the host one short note asking for the brief link in the show notes or the event page (Ruling, Krish, 2026-10-27).
- **Words:** built in `pitches.mjs`, in Jonny's voice with Krish in the third person, signed Jonny.
- **The ask:** one ask, the brief link tagged `growth-podcast` or `growth-guest-seat`.
- **Drafting:** Control Center drafts it into Jonny's box as the `show_notes_ask` kind (1.10.0), once per booking, and Jonny presses Send.
- **Count and rank:** each note is taken first from the run's ten, as own-show invites are (playbook 11), so Control Center drafts it the day the booking is recorded; invites and pitches fill what is left.
- **Never:** a guest booked onto his own shows, whose show notes are Make Your Mind Up's own (playbook 05), or a stage booked through a form, which has no thread in Jonny's box. Those rely on the one-sheet's show-notes line.
- **Measure:** referral and tagged visits in the 14 days after the episode publishes or the session runs, reading `growth-one-sheet` beside `growth-podcast` and `growth-guest-seat`.

It needs Control Center's 1.10.0 and is built on the stand-in first.

### C3. SendLinks per recipient

Once Control Center mints them at draft time. They are not read-once, because mail scanners spend views. Opens and downloads are read back as the Visibility and Stages check, and they are the one-sheet's own reading, since a PDF runs no Analytics tag.

### C4. Later kits

A multiplier gift pack, a decision aid and a case-study cut, only after C2 shows a measured effect.

## 10. Gates

**Now:** approved in full on 27 October ("go, do all of this to 100% completion bit by bit"), with this repository's pull requests merged by the session once their checks pass.

**Recurring, two a week:**
- Monday's one ask: the spec and its questions, last week's good-meeting counts, and any asset version by its SHA.
- Friday's review.

A Codex card's yes comes when the guard asks. His daily presses stay as they are.

**Once each:**
- the Cowork kit session (he logs in and opens the folder);
- kit approval;
- one-sheet mock approval;
- the three talk titles;
- the exact PDF bytes before the mindmake PR is opened;
- merging that PR;
- granting Control Center read access to the library listing;
- the pinned canon review before 15 November;
- confirming the Canva reading above;
- whether the stopgap stands in for the metric;
- whether the weekly count may appear in NOW.md;
- the proposed corpus rules;
- the AGENTS.md, GET-GOING.md and NOW.md change in Phase 4;
- his go on Phases 2 to 5 under U4;
- Control Center's 1.10.0 session (first the held meetings, the one-tap good prompt and `origin_candidates`, `facts[]`, `asset_ref` and the library listing, then the web part and the show-notes kind);
- the stage-form website field: ruled mindmake.co on 27 October;
- three changes in the mindmake repository, each needing his yes and his read before merge (its canon's rule for any new page or claim):
  1. the site sending Analytics events for the brief's steps, only after Allow. Marking them as key events is a separate change in the Analytics property, which Krish makes or approves at the time; Control Center's service account stays read-only;
  2. UTM tags kept until a visitor answers the banner, held only in the address or page memory, never written to the device before Allow, dropped on Decline, and passed to Analytics only after Allow;
  3. the brief request recording the tag beside its entry route only when `utm_source` is one of the three `growth-*` values with `utm_medium=referral` (otherwise null), with the site's privacy page and the brief's request contract updated in the same pull request for his read. It is the one path that ties a visit to a meeting, since Analytics sees only visitors who press Allow.

## 11. Assumptions and counterpoints

**Assumptions:**
- **Control Center builds what it owes after its 1.9.0 work.** Until then the Monday stopgap measures the number, so it is never left unmeasured to 30 November.
- **The Canva connector has no brand-kit write.** If one appears, it replaces the Cowork step.
- **Vercel Web Analytics is off for mindmake.co** (checked 27 October), so the one-sheet's reads stay unknown until SendLinks receipts arrive.
- **Control Center serves the web part in 1.10.0.** Until then the Friday stopgap in Phase 1b applies.

**Counterpoints:**
- **A wider number can reward meetings that never buy.** The qualified subset and the paid-proof path stay on every report, and the Friday review compares them.
- **Signals rely on Control Center collecting from LinkedIn at this engine's request.** The corpus treats scraping LinkedIn as a hard limit, and the risk sits with his LinkedIn identity. It is worth his look.
- **Analytics sees only consenting visitors.** Every reading is a floor and a trend, never a total or an audience.
- **Visits to the brief are nearly invisible to Analytics.** `?start=1` opens the brief before the banner shows, so the most valuable visits rarely press Allow. The brief recording its source (the third mindmake gate) is the fix.
- **Plausible sees everything** and stays unread by his ruling of 2 October. If the floor proves too low to rank levers, that ruling is worth his second look.
- **Traffic can reward noise.** That is why it only breaks ties, and meetings by path decide.
- **The one-sheet link costs makeyourmindup.ai some visits** from pitches; the show is still named, and the one-sheet prints its link.
- **Press.** The code treats press as a relationship, never a stage. If PR visibility should include journalists and newsletters as their own lane, that is his ruling to make on the first spec.

## 12. Moving the growth machinery out of Control Center (Ruling, Krish, 2026-10-27)

Krish: "make sure all the old growth machinery from control-center is brought in to your machine. Control center should just be where you read from and where you report to, it does not own the strategy for how to grow mindmake as a business".

- **The split.** This engine owns every Mindmake growth decision: who, rank, scores, standards, the next move, the words and the learning. Control Center keeps collection, records, his one list, the widget, the research desk runner, and the drafting and sending executor.
- **How each piece moves.** One pull request per piece, in two halves. Here, the logic is ported with its tests and reached through the protocol. In Control Center, the Mindmake path is retired in the same change, and other ventures keep what they use. Nothing is retired before this engine's version has run live.
- **The inventory** below comes from a read-only pass over Control Center at 2965e73 on 27 October. "Live" means wired to a cron, a route or a screen. For n8n workflows, "active" is the flag in the exported mirror, so each one is checked live before it is touched. Control Center's own ADR-041 already lists several of these moves, but none of them has happened yet.

**Strategy that moves here, in this order** (what collides with the engine first, then what moves the number):

| # | Piece (in Control Center) | What it decides | State | Engine home |
|---|---|---|---|---|
| M1 | The `in_house` rule text (`IN_HOUSE_RULE`, `inHouseDrivers`) | Tells the engine Control Center already grows Mindmake, so it should propose into Control Center's lanes | live in every directive | The counts stay as context data. The rule text and its framing are retired on Control Center's side, since they contradict this ruling |
| M2 | Nova and Nell n8n lanes (`nova-closed-loop-pr-engine`, `nova-podchaser-visibility-outbound`, `nova-visibility-sweeper`, `nell-guest-scout`, `nell-guest-pitch-draft`) | Rank shows and guests, and write their own pitches, which collide with this engine's pitches in Jonny's box | active | `pitches.mjs`. Their search nodes become research-desk kinds. Their scoring, tiering and pitch writing are retired |
| M3 | Guest standard and show weighting (`_guestStandard.ts`, `shows.ts`, `approaches.ts`, `_approaches.ts`, `discover-guest-scout.ts`, `_judgmentLens.ts`, `_guestPath.ts`, and the `check-visibility-standard` guard) | Who is worth a show, the 70/30 split, the queue order, and the scout's search terms | live | A new `src/stages/guests.mjs`, with the guard moved alongside. Control Center keeps collecting guests and serves them raw |
| M4 | Visibility standard (`_visibilityScore.ts`, `visibilityStandard.ts`, `visibilityScale.ts`, `visibility-targets/score.ts`) | Which stage, podcast or press is worth pitching | live, cron 07:30 | `pitches.mjs` and a new `src/stages/visibility.mjs` |
| M5 | Room scoring (`_eventScore.ts`, `events/score.ts`) | Which event to attend, anchored to the buyer | live, cron 07:00 | `src/stages/rooms.mjs`. `events/discover.ts` stays as collection |
| M6 | The pilot machine: `FACE` and `DOOR` in `_mission.ts`, the pilot seed's `INDUSTRY`, `_pilotDeals` `findTrigger` and `draftApproach`, `pilot-deals/monday.ts`, and `PILOT_PLAN_ASKS` in `surfaceMoves.ts` | Who the buyer is, what is offered, which five people a week, why now, and the words | live | The canon read live (`canon.mjs`), plus the rows and campaigns stages. Krish's purpose lines in `_mission.ts` stay as canon |
| M7 | Focus playbooks for Mindmake (`_focus.ts` `PLAYBOOKS`, `pickApproach`, `roomRank`, `selectRooms`, `selectStages`, `fillFocus`) | Which play, which person and which path, three drafts a day | live, hourly | The rows stage. The family registry and the focus rule stay, as they serve every venture |
| M8 | Stall-check "three moves" prompt (`growth/stall-check.ts`) | Hard-codes Mindmake's order of optimisation | live, cron 07:00 | The weekly review, which learns from his Nos and the bookings |
| M9 | Mindmake's outreach angle (`_venturePositioning.ts`) and the `_peopleDraft` briefs (`forGuest`, `forTarget`, `forRoom`) | The words and asks Control Center hands its model | live | `pitches.mjs` and the canon. The Mindmake entry ("Strategy Day sprint") is out of date |
| M10 | The amplifier taxonomy and `ROWS_RULE`, and the widget's `answeredLike` copy of the engine's suppression rules | Row doctrine and No suppression | live | The engine owns them: it sends its taxonomy and a suppression list, and Control Center keeps schema checks only |
| M11 | Maya and Agatha lanes (`maya-closed-loop-revenue-engine`, the sweepers, `agatha-portfolio-pipeline-triage`) and the ICP lane scorer (`_icpScore.ts`) | A whole prospecting and learning strategy, partly on retired Apollo | mixed: Maya active, the ICP scorer dormant | Retired for Mindmake. Buyer prospecting is the signals and rows stages |
| M12 | The legacy ingest gate's strategy (`_mindmakeGrowth.ts` trigger and buyer-title rules, and `_mindmakeGrowthContract.ts` offer copy) | What counts as a trigger, and the offer words | live route | The engine's own qualify and draft stages. Control Center's record, consent and suppression walls stay |
| M13 | Places, GEO and AEO question choice (`growth_touchpoints` decisions, `geo-probe.ts` Mindmake domains, `growthModel.ts` `nextMoves`) | Where Mindmake's buyers are and which questions to probe | live | The engine's weekly review. The AEO content itself is the AEO-Engine repository's |

**Shared pieces.** Mindmake's use moves here; the rest stays for other ventures:
- the strategist and the daily move: Mindmake's pilot doctrine leaves their prompts;
- the growth council: it already skips engine-owned products; CTRL and Pulse are checked;
- network reach priority (`networkScore.ts`);
- `chooseNextAction`: its rule order is scheduling and stays; the urgency intensity rules are harness doctrine and stay.

**Stays in Control Center:**
- collection and records: `pilot_deals`, `people_drafts`, `guests`, `visibility_targets`, `events`, the snapshot and web insights, and `product_icp`, which Krish edits;
- warm-path indexing and Rule 2's wall;
- the research desk runner;
- the pitch, draft and form executors;
- the widget plumbing and the one list;
- the scorecard tally;
- the protocol itself.

**How a piece moves.** Each `M` is one pull request here and one in Control Center:
1. Here: port the logic with its tests, read its inputs from the context, and report its output in the rows or holds. It runs in shadow beside Control Center's version for one live run, and both outputs are reported.
2. In Control Center: once the engine's version has run live, turn off the Mindmake path, keep collection, and amend the docs and ADRs that name it (ADR-041, -039, -038, -026, -028 and -016; the AGENTS.md house-system rows; `docs/handoff/growth-engines/mindmake.md`, whose "Control Center already grows Mindmake" is superseded; and the `docs/app/growth`, `people`, `everywhere` and `focus` pages).
3. An n8n workflow is turned off only after its live state is read back, and its mirror is updated in the same change.

## Verification of this filing

The seven repository checks pass. The brief and the Cowork prompt contain no live people, ids or tokens. The NORTH_STAR block still parses, with the ladder unchanged. A Drive readback of 03_Growth shows its skeleton, READ ME and index, with no loose files and no sharing change.
