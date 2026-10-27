# A bulletproof growth engine for Mindmake, with Canva in it

Status: plan, filed for Krish's go. Nothing in the engine is built by this document.
Written: 2026-10-27, from Krish's brief, the reference architecture (Drive, 27 Oct 2026, the content-engine redesign) and the Mindmake growth corpus (Oct 2026), after a read-only inventory of this repository, its Actions runs and pull requests, Control Center's placements and venture state, the Mindmake canon, Drive and Canva. Every figure below was checked by an independent reviewer trying to refute it; where a figure is this review's own count, it says so.

## Why

The content engine failed on 27 October: one long thread, the engine rebuilt during the job, rules written as prose that never held, and passes certified by the session that did the work. This repository shows the same pattern on a smaller scale. The full-card feature on 27 October took six pull requests (#11 to #16) and five manual live runs in about four hours, four of which found the defects the next pull request fixed. Seven of 22 pull requests are corrections of earlier work (#6, #12, #14, #15, #16 and #22 fully, #17 partly). A live run (manual-24) showed success while it read no context and prepared nothing. And the North Star number is computed nowhere: it is U4, unmeasured.

The outcome wanted: an engine that measures the number at its source, compiles each week from one spec Krish signs, blocks bad output with code before it reaches his phone, gets him onto more podcasts and stages, keeps everything it makes easy to find, and costs a twentieth as much to change.

**What this moves on the North Star.** Measuring it at all (Phase 1, first), and the visibility route to meetings: podcast and stage pitches that carry a real one-sheet, with bookings counted against the target. Nothing here changes the ICP, channels, formats or remit.

## Krish's answers (27 October 2026)

Recorded as rulings in docs/NORTH_STAR.md and AGENTS.md:

1. **The number:** "Anything that gets me good meetings counts towards my number, and we need to trace where it came from so we know what works." A meeting counts when he marks it good with one tap after it, whether with a buyer, a multiplier, a partner or a host. The engine pre-fills where it came from; he confirms. Qualified buyer conversations (the five tests) are reported as a subset.
2. **Rooms:** guest seats only. No hosted rooms this year.
3. **Visibility target:** two podcasts booked a week and one stage or panel confirmed a fortnight, replacing one podcast a week.
4. **Canva:** a full, new Mindmake brand kit first; then the speaker and guest one-sheet. The kit is built by a Cowork computer-use session on his PC from his brand assets folder; he logs in and opens the folder. The old "Mindmaker" kit and decks stay as they are.
5. **The one-sheet:** a PDF at mindmake.co/media, with Jonny's box as the booking contact. SendLinks (standard DEL-002) later carries a tracked link per recipient.
6. **The Growth library:** every asset and strategy the engine produces lives in Drive, mind/make > 03_Growth (docs/DRIVE.md), and the engine keeps it from sprawling.
7. **Signing:** the week spec is signed Monday morning; Friday is the review.
8. **Codex:** the shared allowance has reset.

Recorded interpretation, unless he corrects it: "Canva at will" covers creating, editing, uploading, exporting and brand templates inside his own Canva account. Sharing, making anything public, merging the mindmake.co change, and any send or spend still need his yes at the time.

## 0. Lose nothing: what exists and stays

**Stays exactly as is, and remains the fallback route until the new route has proved itself on real runs:** the daily Control Center wake (05:10 UTC `repository_dispatch`) and `node src/cli.mjs dispatch`; the attempt journal, report readback by digest and decision digests; capability negotiation from 1.2 to 1.9; the five rows with full cards, fit first and the permanent No store (`lessons`, `refusedBy`); the canon and track record read live by blob SHA; Jonny's podcast, stage and guest pitches; forms on his tap (#20); signals; the larger context budget (#22); 255 tests and the three demos; the 27 October session handoff (docs/history/2026-10-27-growth-session-handoff.md) and its continuation point.

**Live jobs.** No `schedule` trigger anywhere. `operate.yml`: `repository_dispatch` (`cc-growth-directive`) and `workflow_dispatch` (modes engine, daily, readiness, weekly-review, dispatch). `ci.yml`: push, pull request, manual.

**Run history (Actions, as of 27 Oct 12:25 UTC).** 25 operate runs; 22 live dispatch runs since 19 October (9 woken by Control Center, 13 manual). Three failed: `attempt_unconfirmed` on 19 Oct, `directive_invalid` on 20 and 21 Oct. Run manual-24 reported success while it read no context (fixed by #22). Median run 15 seconds overall, 17 for dispatch runs, 21 on 27 October; Actions billable time is effectively zero. CI: 62 runs, 61 passed, 1 cancelled.

**Past fixes.** This review counted 48 distinct fixes from commit bodies, PR descriptions and docs (its own count; Phase 0 commits the list with a commit or PR for each so it can be checked). Most are guarded by objective code tests. Four have no test: F08 (secret and variable names in the workflow), F09 (schema verified before promotion), F10 (a link outside the repository; the fault is live again at docs/control-center/ENGINE-PROTOCOL.md lines 3, 157 and 298, and RELEASE.md claims a link check that does not exist), F22 (OPERATIONS.md says five minutes; operate.yml says ten). Four are partly guarded: F15 (the live report-reuse branch and `recovery_report_mismatch`), F18 (the voice-rules overclaim, half covered by tests/voice.test.mjs), F20 (the pinned canon, still stale), F21 (schema bounds, no direct unit test). F48 is new: a run that read no context still showed success.

**Open findings, all confirmed by an independent reviewer (N01 to N18).**

| Id | Finding |
|---|---|
| N01 | A second Control Center wake on the same London day replays the first report, though the protocol gives a later wake a new run_id. |
| N02 | `events[]` is always empty, so closes are never reported. |
| N03 | The directive's `north_star`, `urgency`, `constraints` and `rows_rule` are read nowhere. |
| N04 | Policy fields `voice`, `recognition`, `acquisition`, `pilot`, `venture`, `execution.channels`, `execution.assets` are never read; row, fit and pitch caps and the 70/30 split are hard-coded. |
| N05 | The 1.9.0 pitch outcomes (sent, replied, booked, recorded, published) are read nowhere, so the engine cannot learn which shows answer. |
| N06 | A repeated `pitch_off` No never reaches the weekly review as a doctrine change. |
| N07 | Mutation-kill claims in PRs #12 to #19 cannot be re-run: no harness is committed or run in CI. |
| N08 | Docs drift: NOW.md head lags, docs/history/LOG.md is named but missing, merged PRs are called unmerged, the protocol header says 1.8.0 while documenting 1.9.0. |
| N09 | The trust-asset prompt's formats differ from `contracts/motions.ts`. |
| N10 | The `founder_visibility_open` hold was never recorded. |
| N11 | The registry target is a flat 5 against the ladder 2, 5, 8, 11, 15, 20. |
| N12 | The pinned canon review lapses on 15 November. |
| N13 | The 50 held prospects were never turned into one decision. |
| N14 | `strategicPlan().digest` is computed and never read. |
| N15 | The engine never recomputes `amended_sha256` before acting on an amended decision, as the protocol requires. |
| N16 | A campaign plan over 8,000 characters fails the whole report instead of holding. |
| N17 | `blobSha` hashes decoded text, so it gives the wrong SHA for a binary file such as a PDF. |
| N18 | Every approved `stage: "plan"` decision is routed to prepare-action whatever its id, so any new kind of plan would be treated as a campaign. |

**Pending work from the handoff.** Four route plans prepared on 22 October are still pending, their action windows expired and their original Advisory records unresolved. The handoff's continuation point (reconcile them before any replacement) stays first in line, and Phase 0 carries it.

**The recurring defect.** Free text from Control Center records was used as card copy, so each live run found a new shape and each fix added to a deny-list. The tests pin past examples rather than define a valid line, so the next unseen shape passes.

**In flight.** No open PRs. Merged branches remain (including two `codex/` branches, #7 and #21, whose sessions cannot be traced from GitHub). The second checkout on Krish's PC is checked before any local write and never written to.

## 1. The week spec: the one artefact he signs

One per London week, `growth-week/1`, canonical JSON of 8,000 characters or fewer. It holds no people, ids or private links, so a proposed spec can be reviewed as a file. Its judgement fields are typed; everything else is compiled or is an invariant.

- **Typed judgement fields:** lanes on or off; caps inside the bounds config/policy.json owns (the spec is validated against them and can only tighten); the visibility targets; assets in play; one experiment; questions for Krish.
- **Compiled fields, never typed:** the North Star week target, the canon blob SHAs, the digest of the directive's week goals.
- **Invariants, never in the spec:** no send or spend authority, one follow-up, no em dashes, the fit floor of 40, privacy.

```json
{ "spec": "growth-week/1", "week_of": "2026-11-02",
  "compiled": { "north_star_sha": "<blob>", "week_target": 5, "canon": [{"path": "01_CANON.md", "sha": "<blob>"}], "week_goals_sha256": "<hex>" },
  "targets": { "podcasts_booked_per_week": 2, "stages_confirmed_per_fortnight": 1 },
  "lanes": { "network": {"on": true, "rows": 6}, "partners": {"on": true, "rows": 6}, "reach_out": {"on": true, "rows": 6},
             "pitches": {"per_run": 10, "stage_share": 4, "invites_per_run": 2, "invites_per_week": 4,
                         "show_shares": {"make_your_mind_up": 70, "signal_noise": 30}, "forms_per_row": 2} },
  "allocation": { "multiplier_share": 0.7, "rebalance_days": 14 },
  "assets": [{ "id": "speaker-one-sheet", "version": 1, "blob_sha": "<git blob of the PDF bytes>", "url": "https://mindmake.co/media/<file>.pdf", "in": ["visibility", "events"] }],
  "experiment": { "id": "one-sheet-in-pitches", "lane": "visibility", "change": {"field": "assets.speaker-one-sheet.in", "to": ["visibility", "events"]},
                  "measure": "replies_and_bookings_14d", "decide": "keep if replies plus bookings match or beat the prior fortnight; counts only below 20", "min_days": 14 },
  "questions": [],
  "spend_usd": 0 }
```

Every default comes from today's exported constants, so the default spec reproduces today's behaviour exactly.

**How it is proposed and signed, with no new write path or approval interface:**
1. Between runs, a session proposes next week's spec as a file in this repository by pull request. It contains nothing private.
2. The dispatch, the only production writer, posts the signed-off file on main as a `stage: "plan"`, `wall: "strategy"` proposal with id prefix `gms-`. His list shows plans before sends.
3. His Clear is the signature. For a plan, the digest covers the whole proposal minus its target, so the title, why and evidence are generated deterministically from the spec and do not re-ask him. "Change it first" makes his amended version the signed one; the engine recomputes `amended_sha256` before using it (N15).
4. The approved-plan route at src/dispatch.mjs is narrowed to campaign ids (`gmc-`) so a spec never reaches prepare-action (N18), and an oversized spec is held as `spec_too_long`, never thrown (N16).
5. **Effective day.** Monday's 05:10 run reads decisions before he signs, so a Monday-morning signature takes effect at Tuesday's run, or at once if he starts a manual run. Monday runs under last week's spec.
6. No signed spec: the last signed spec up to 7 days old, then today's config, with the hold `spec_unsigned`.
7. On full Mondays the spec takes one non-row slot, so the report carries one fewer pitch that day.

## 2. Repository structure (additive; every new src file registered in pipeline/stage-conveyor.json)

```
specs/schema/week.schema.json       the spec schema, frozen and hashed in contracts/manifest.json
specs/weeks/YYYY-MM-DD.json         proposed and signed-off specs (no people, ids or private links)
specs/examples/week.synthetic.json  synthetic only
crew/index.json                     specialist -> lanes, lint ids, check ids, card, lens
crew/<specialist>/card.md           3 KB or less, a decision table loaded only when its lane is in play
crew/<specialist>/lens.md           1 KB or less, one question for an independent reviewer
src/crew/lints/*.mjs                pure (action, context, spec) -> findings; they import the stage predicates, never restate them
src/crew/checks/*.mjs               pure (Control Center readback) -> measurements
src/crew/compile.mjs                signed spec -> the caps the stages read, inside policy.json's bounds
src/crew/status.mjs                 readiness and success, computed from evidence, printed by `npm run status`
invariants/register.json            every past fix and open finding -> its test, or an accepted reason
assets/manifest.json                asset ids, versions, blob SHAs, public URLs; no design ids or private links
library/taxonomy.json               the Growth library's folders, naming rule and kinds (docs/DRIVE.md)
tasks/cards/*.md                    task cards of 6 KB or less; returns go to ignored runtime/
scripts/{pack,check-crew,check-bespoke,check-library,dispatch-card,verify-card,mutate}.mjs
tests/regression/*.test.mjs         the missing regression tests
tests/fixtures/live-shapes/*.json   hand-written synthetic versions of each live failure shape, never live text
```

The stage modules keep owning behaviour. A specialist owns its lint, check, card and lens, not the stage's code. RELEASE.md stays the completion record; `npm run status` gives the evidence it cites. New owner lines go into AGENTS.md and the conveyor in the same change.

## 3. The crew (from this repository's rows, routes and remit)

| Specialist | Stage code it reviews | Lint (blocks before acting) | Measured check (real data, after) | Lens |
|---|---|---|---|---|
| Network Steward | `rows.mjs` network row | tie evidence counted both ways; quiet 90 days or more; no refusal; one ask; a route; card grammar | a reply within 7 days (Control Center's email count rises after `carried_out`); a good meeting on `existing-relationship` | Will they feel remembered, or worked? |
| Multiplier Steward | partners row, connector intro asks, introduction permissions | relationship evidence beyond a LinkedIn connection; one named person with a reason; fit 40 or more; card grammar | connector reply within 7 days; introductions offered; good meetings on `multiplier-intro` | Does this spend their trust, or give first? |
| Visibility Producer | podcast pitches, own-show guest invites, podcast and show forms, appearance asks | the show's own booking address; an episode within 120 days; never pitched; never his own show; one ask; his ruled title; the show named; the one-sheet line only when the PDF reads at its pinned SHA | the 1.9.0 sent, replied, booked, recorded and published per pitch, read for the first time (N05); bookings a week against 2; later, SendLinks opens | Would the booker say yes in ten seconds? |
| Stages Producer | speaking pitches, stage forms (#20), `teach` asks | open and before its deadline; a speaker address or form from the stage's own page; his buyer in the room; one talk title; never press | reply, form submitted, seat confirmed against 1 a fortnight; brief and meeting requests within 7 days of the session; good meetings on `guest-seat` | Is his buyer actually in this room? |
| Signal Scout | `signals.mjs` | an executive by their own headline; worried in their own words; not an AI person or seller; comment within 30 days; quoted exactly with the post named | reply within 7 days; good meetings on `public-signal`; opt-outs suppressed the same run | Will they feel heard, or harvested? |
| Trust-Asset Steward (Canva) | `motions.mjs` trust assets and decision aids; `assets/` | the Mindmake kit; fonts and colours inside it; the name exactly "Mindmake", never "Mindmaker"; read-back text equals the approved text; every fact named by blob SHA; one page; Jonny's box as contact and never Krish's personal email; none of what the canon says is never published (price, rate card, availability, unconsented client names, the method's name); no durations, emoji or em dashes | the PDF's blob SHA at its URL equals the approved one; page views; replies and bookings on pitches carrying it against the prior fortnight; SendLinks opens per host | Does it prove, or decorate? |
| Meeting Ledger | `scorecard.mjs`, `outcomeScorecard`, qualification review | every meeting carries a path pre-filled from the engine's own carried-out action, recorded once and never rewritten; assists kept separately | good meetings a week by path against the ladder; the qualified subset; paid proofs traced to their path; meetings with no match | Would this survive "show me the meeting"? |
| Librarian | docs/DRIVE.md, `library/taxonomy.json`, Drive 03_Growth, Canva Mindmake Growth | before filing: the path is in the taxonomy; the name passes the naming pattern; no duplicate of kind, subject and version; a superseded file moves to the archive in the same step; never trash or share; no lists of people | the tree walk: files outside the map, loose files, duplicates, more than one Current, engine-made Canva designs outside the folder, copies older than their source's last change, index entries that do not match: each zero | Could Krish find the current version in ten seconds? |
| Guard | `guards.mjs`, `check.mjs`, policy | nothing sends, publishes, spends or changes permission without his yes; no LinkedIn automation; no live people in git; no per-run bespoke code; the directive's constraints | constraint breaches zero; opt-outs honoured; restriction notices zero | Is anything here acting without his yes? |

**Card grammar** is the lint every row specialist shares, and it ends the deny-list chase. A line may be built only from typed slots (a name, a title, an organisation, a counted figure with its source, a canon quote, or a record sentence that passes `isFact`), and Control Center is asked for typed `facts[]` instead of prose. Property tests prove every live failure shape is held as `card_grammar`, with generated variants of each. The deny-lists stay as a second net.

**Shadow first.** Every new hold (card grammar, the directive's constraints, the Librarian) runs in shadow until the Phase 5 switch: it is counted and reported, and nothing it would hold is hidden. The current route keeps working unchanged until the new one has proved itself.

**Proposed rules, not lints until he rules.** The corpus recommends practices this repository has never adopted: at most one ask of a multiplier in 30 days unless they offered; a gift before an ask; a forwardable blurb of 150 words or fewer; identification and an opt-out on a cold email (a postal address for US recipients). They reach him as questions on the first spec, not as silent new gates.

## 4. Checks mapped to this repository's failure history

| Failure class (ids) | Invariant | Guard today | Added guard |
|---|---|---|---|
| Protocol drift (F13, F21) | accept any 1.x directive; gate each report version on what Control Center serves | dispatch and rows version tests | unit tests for maximum, minLength and minItems |
| Replay and recovery (F03, F15, N01) | a restart never re-prepares or re-executes; a later wake gets its own run_id | adapter and dispatch replay tests | live-reuse and `recovery_report_mismatch` tests; a same-day second-wake test |
| Silent success (F48) | a run that reads no context, or prepares nothing while Control Center serves work, is a held run with a named class, never a quiet success | #22's dispatch test | `npm run status` reads empty output as not done |
| Retired routes and secrets (F08, F11, F12, F22) | never call retired routes; the workflow binds exact secret names and timeouts | dispatch and strategy tests | a test that parses operate.yml against OPERATIONS.md |
| Card words from free text (F27 to F45) | lines only from whole typed pieces | about 25 rows and pitches tests | card grammar, property tests, `card_grammar` held in shadow then enforced |
| Unknown versus zero (F30, F45) | never a zero that was not measured | dispatch null test | extended to good meetings and every check |
| Ranking by vanity (F23, F25) | fit first, floor 40, competitors out | rows fit tests | the spec can only tighten the floor |
| Duplicates and priority (F06, F14, F16) | one copy per person; replies before new outreach | learning, dispatch and strategy tests | unchanged |
| Stale canon (F20, N12) | canon read live; the pinned copy reviewed | rows canon tests | CI warns 14 days before the pinned review lapses |
| Claims in docs (F09, F10, F18, N08) | status is computed, never written | none | a local link check in check.mjs; a drift check for NOW head and the protocol header |
| Self-certification (N07) | a claimed kill rate re-runs in CI | none | a committed zero-dependency mutation runner for card grammar and pitches |
| Bespoke code per run (the 27 Oct pattern) | no run ids, dated literals or people in src | none | `check-bespoke.mjs` in CI |
| Binary hashing and plan routing (N16, N17, N18) | assets hashed from raw bytes; specs routed apart from campaigns; oversize holds | none | unit tests for each |

## 5. Session protocol

- **Session kinds, each fresh and doing one job.** A spec session (Friday) writes next week's spec file and ends. A build session (between runs) verifies one task card. An asset session makes one Canva revision. The daily dispatch stays zero tokens. Token and wall-clock budgets are provisional until Phase 0 measures the real median; they are then set at one twentieth of it.
- **A session pack of 36 KB or less.** `npm run pack` writes runtime/pack.md: AGENTS.md (loaded by CLAUDE.md anyway, so it counts), the North Star state, the signed spec, the cards of up to three specialists in play, open lint findings and holds as counts and codes, and gate status. CI fails the pack above 36,864 bytes and counts every mandatory load. Today AGENTS.md alone requires reading BRIEF, RELEASE and playbook 10 (more than 40 KB together), so Phase 4 asks Krish to replace those standing reads with the cards that distil them; until he agrees, the pack cannot meet its size.
- **No mid-turn questions.** Questions go into the next spec's `questions[]` and reach him on Monday's list; the session ends at that gate. Recurring gates are at most three a week; one-off setup approvals are listed apart.
- **Two clocks.** Phase 0 reads session events (counts only) to give tokens, engine time and time waiting on Krish per session; nothing is stored as a second record.

## 6. Codex task-card dispatch

Codex builds code between runs as a development tool; the engine's runtime gains no model provider.

- **A card, 6 KB or less:** model and effort pinned (the reference architecture's measured choice, re-verified against Codex's own model list at dispatch, never the default), maximum minutes and calls, the worktree, `write_allow` globs, five read files or fewer, a never list (no git, network, MCP, publishing, new dependencies, or edits outside write_allow), the interface verbatim, acceptance commands that must exit 0, and the JSON return shape.
- **Dispatch** from a local Claude Code session on Krish's PC, where the Codex plugin lives: `node <plugin>/scripts/codex-companion.mjs task --background --fresh --write --model <pinned> --effort <pinned> --cwd <worktree> --prompt-file <card>`, then `status --wait` and `result`. Never the codex-rescue subagent.
- **A worktree per card** from main, on a `codex/<card-id>` branch, never in the second checkout.
- **Allowance guard.** Control Center's economics snapshot carries no Codex meter, so `dispatch-card.mjs` takes the allowance as an explicit input with its source (today: Krish, 27 Oct, reset) and refuses above 80% or when unknown, unless a spend approval is named.
- **Verification.** Claude re-runs the acceptance commands and the seven repository checks outside the sandbox and confirms the diff stays inside write_allow. Codex's own report is never evidence.
- **Fallback:** the same card through a Claude agent in an isolated worktree, verified the same way.

## 7. Tool routing (Control Center tool catalog 2026-10-26.1, placements ruled 26 Oct)

| Tool | Use here | Gate |
|---|---|---|
| Canva (main: Mindmake) | the brand kit, brand templates, the one-sheet, later aids, all in the Canva folder Mindmake Growth | at will inside his account; sharing, public links or publishing need his yes |
| Google Drive | the Growth library, mind/make > 03_Growth | create and move inside 03_Growth only |
| SendLinks (DEL-002) | a tracked link per recipient to an asset, minted by Control Center when it drafts | the send stays with the send lanes |
| Control Center | records, approvals, drafting into Gmail, form submission on his tap, outcomes, calendar, the research desk within its caps | the protocol only |
| Gmail | Control Center drafts Jonny's pitches (no press) and the drafts for his rows | the engine never drafts or sends |
| Vercel | page views for the one-sheet, read in the review session | read only |
| Brandfetch (main: Mindmake) | partner logos for a later co-branded asset | approved per lookup |
| Teleprompter (main: Mindmake) | a rehearsal script once a talk is booked | not before a booking |
| HeyGen, ElevenLabs (main: Mindmake) | held: `founder_visibility_open` (docs/briefs/2026-10-22-heygen-outbound.md) and the reference architecture's standing ruling that the face and voice clones stay on backup until he has trained them | not used |
| Higgsfield, Runway | placed with Heartside and Full Time | not used |
| Apify, LinkedIn | only through Control Center's research desk; no LinkedIn automation | not used directly |
| Codex | code between runs | the allowance guard |
| Instantly, Apollo, Fireflies, Descript | retired | never |

## 8. The phased build (one pull request each; dates are targets; each phase lists its acceptance tests)

**Phase 1: wire the number (first, by 31 Oct).**
- The `good_meetings` objective beside the existing ones (the 5/1 registry lock on `qualified_conversations` stays), its week target from the directive's `north_star` when present, broken down by path. Paths: existing-relationship, multiplier-intro, partner, guest-seat, podcast, own-show-guest, public-signal, inbound, referral, unknown.
- **Stopgap from week one, no Control Center change needed:** each Monday the dispatch posts "Last week's good meetings" as a `stage: "plan"` proposal whose payload holds counts by path, all null. Krish fills in the counts with "Change it first"; the engine reads his amended payload and reports the number with that source. Counts only, no names.
- `origin_candidates`: each contact's latest carried-out action per lane, so Control Center can pre-fill the tap.
- Podcast and stage bookings read from the 1.9.0 outcomes and reported against 2 a week and 1 a fortnight (N05). The directive's `constraints` and `urgency` read, enforced in shadow (N03).
- What Control Center owes, written into docs/CONTROL-CENTER-BRIEF.md (GET-GOING Step 5) for its own session after its 1.9.0 work: each held meeting from his calendar with `meeting_id, contact_id, held_at, good, good_at, origin_path, origin_ref, assists[], said_yes_because`; the one-tap good prompt pre-filled; typed `facts[]` for cards; `asset_ref` minting SendLinks links; a listing of 03_Growth and Mindmake Growth (titles and dates only) so the dispatch can run the Librarian's check daily.
- Accept: on the stand-in, synthetic meetings give exact counts by path; the stopgap round trip reads an amended payload; unserved means null with a reason, never zero; a paid proof is traced to its path; bookings per show feed the rank. Live: the first Monday stopgap answered gives a non-null number with its source, and NOW.md's state line carries it.

**Phase 0: baseline and register (alongside Phase 1).**
- Session events read for the 20 PRs whose bodies link a session (tokens, turns, engine time, wait time; counts only, kept in ignored runtime/); the two Codex PRs (#7, #21) listed as untraceable.
- `invariants/register.json`: every past fix and open finding with its commit or PR and its test or accepted reason.
- The handoff's continuation point: the four pending route plans reconciled with their current records before anything replaces them.
- GET-GOING Steps 0 to 5 reconciled against evidence.
- Accept: every figure in this document re-derived with its run or PR ids; every register entry has a guard or a reason.

**Phase 2: the spec, compiled, and status computed (week of 2 Nov).**
- The schema, `compile.mjs`, the `gms-` proposal, the signed-digest read, the fallback chain, the narrowed plan route (N18), the length hold (N16), `amended_sha256` recomputed (N15). Hard-coded caps and unread policy fields move into read config with values unchanged (N04). `npm run status`.
- Accept: a golden test (every fixture gives a byte-identical report under the default spec); approve and amend round trips on the stand-in; the length hold; the unsigned fallback; a spec cannot loosen a policy bound.

**Phase 3: the crew as code (week of 9 Nov).**
- Nine lints and checks importing the stage predicates; cards and lenses; card grammar; `events[]` closes (N02); repeated Nos as weekly-review proposals (N06); the regression tests for F08, F10, F15, F18, F21, F22, F48 and N01; `check-bespoke`, the link check, the drift check, the mutation runner (N07); raw-byte blob SHAs (N17); the Librarian's lint and `check-library.mjs`.
- Accept: every register entry passes; cards are capped at 3 KB and lenses at 1 KB; every live failure shape and its variants are held; on a synthetic listing the library check catches a loose file, a duplicate, a second Current and a stale copy; the naming pattern passes every example in docs/DRIVE.md.

**Phase 4: the session protocol and dispatch tooling (week of 16 Nov).**
- `pack.mjs`, the cards that replace standing reads (with Krish's yes to the AGENTS.md change), the task-card template, `dispatch-card.mjs` with the guard, `verify-card.mjs`.
- Accept: the pack builds at 36 KB or less counting every mandatory load; a new card runs through Codex and is verified outside the sandbox; the guard refuses above 80% and when unknown.

**Phase 5: prove on real runs, then switch (week of 23 Nov).**
- The new route runs alongside the old for one London week behind `spec.enabled`. Switch only after one signed spec, five consecutive live runs with no corrective PR, shadow holds reported, and the number measured. The old route stays in code for 30 days after.
- **The 20x targets, against the Phase 0 baseline:** Claude tokens per accepted capability at one twentieth or less; PRs per accepted capability from 6 (the card feature, 4 of them corrections) to 1; the corrective share from 7 in 22 to 1 in 20 or less; live runs used as tests from 5 to 0; his review rounds per capability to 1 gate; mid-turn questions 0; recurring gates 3 a week or fewer; ask-to-accepted wall clock at one twentieth wherever the baseline is measurable. The dispatch itself (seconds, no cost) is not a target. A run with no measured outcome counts as not done.

## 9. The Canva track (parallel from day one; asset work, not engine code)

**What the live brand source says** (krishanraja/mindmake at its 26 Oct head, read by blob SHA):
- The name is **Mindmake**, never "Mindmaker", "The Mindmaker", "Mindmaker Live" or "Mindmake AI". The legal entities keep their names only in legal text. The drawn wordmark reads MIND/MAKE; typed text always says Mindmake.
- Type, per the founder's ruling of 25 September in the design contract, matched by the live CSS and its type check: Newsreader light for headlines, Newsreader 400 for anything read, Archivo 700 only for actions and small interface text (sentence case), IBM Plex Mono 400 for labels, numbers and dates in tracked capitals. Source Serif 4 only for the private brief's brand line. (An older line in the canon's North Star still says a grotesque carries structure; the contract and code are newer and win.)
- Colour carries meaning: mint is the answer, amber is what moved; nothing else is coloured for decoration. Grounds are ink, raise and paper.
- Krish appears only in approved biography, proof framing and verbatim quotes; his name never appears in anything written as Mindmake. The one-sheet is approved biography written about him, in Jonny's framing, not copy written as "we".
- There is no /media route today: "Media" in the menu links to the publication. The PDF needs a small static-file change in the mindmake repository, with no new page and no menu change.

**C1. The brand kit**, by the Cowork session in docs/briefs/2026-10-27-canva-brand-kit-cowork.md. Verified by readback: the kit named Mindmake is listed; a test design generated on it reads back the right fonts and colours; its thumbnails pass an independent visual check; Krish approves the kit where he sees it.

**C2. The speaker and guest one-sheet.**
- State of use: a booker or organiser triaging pitches, often on a phone, deciding in seconds and forwarding to a producer.
- Content, every fact read live and named by blob SHA: his ruled title, Executive Host of Signal & Noise; Mindmake in the canon's own words; three talk titles he approves; his track record and stages from krishraja.com's own record; Make Your Mind Up as the canon names it; the approved photo of him already used on the About page, never a generated likeness; Jonny's box as the booking contact (read from Control Center at build time and never committed here).
- Three blind concept spines on the Mindmake kit, two blinded judges, one synthesis shown to him cold. After his yes: lock it as a Canva brand template with autofill fields, so later versions refill from live reads; export the PDF; a mindmake repository PR adds it as a static file (his merge publishes it); this engine reads its blob SHA from the raw bytes and adds one line with its link to Jonny's podcast and stage pitches, only when it reads (it uses one of the two free source-revision slots), failing soft like the track-record read.
- The version the pitches link is approved on his Control Center list by its blob SHA, posted by the dispatch, so no approval lives outside the existing flow.

**C3. SendLinks per recipient**, once Control Center mints them at draft time (not read-once, because mail scanners spend views), with opens and downloads read back as the Visibility and Stages check.

**C4. Later kits** (a multiplier gift pack, a decision aid, a case-study cut) only after C2 shows a measured effect.

## 10. Gates

- **Now:** this plan.
- **Recurring, at most three a week:** Monday, sign the week spec and answer its questions, fill in last week's good meetings (the stopgap), approve any asset version by its SHA, and any Codex spend the guard asks for. Friday, the review. His daily presses stay as they are.
- **Once each:** the Cowork kit session (he logs in and opens the folder); kit approval; one-sheet mock approval; the three talk titles; merging the mindmake.co change; the pinned canon review before 15 November; the AGENTS.md change in Phase 4.

## 11. Assumptions and counterpoints

- **Control Center builds what it owes after its 1.9.0 work.** Until then the Monday stopgap measures the number, so it is never left unmeasured to 30 November.
- **The Canva connector has no brand-kit write.** If one appears, it replaces the Cowork step.
- **Vercel analytics may be off for mindmake.co.** Then page views read unknown until SendLinks receipts arrive.
- **Counterpoint: a wider number can reward meetings that never buy.** The qualified subset and the paid-proof path stay on every report, and the Friday review compares them.
- **Counterpoint: signals rely on Control Center collecting LinkedIn comments,** and the corpus treats scraping LinkedIn as a hard limit. This engine never collects, but the risk sits with his LinkedIn identity and is worth his look.
- **Counterpoint: press.** The code treats press as a relationship, never a stage. If PR visibility should include journalists and newsletters as their own lane, that is his ruling to make on the first spec.

## Verification of this filing

The seven repository checks pass; the brief and the Cowork prompt contain no live people, ids or tokens; the NORTH_STAR block still parses with the ladder unchanged; a Drive readback of 03_Growth shows its skeleton, READ ME and index with no loose files and no sharing change.
