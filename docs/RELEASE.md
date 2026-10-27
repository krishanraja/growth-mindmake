# Release state

## Each wake is its own run (N01), 27 October 2026

Merged by the session; not live until Control Center's next wake. The daily and refill wakes run `dispatch --kind dispatch-<run number>`, so a same-day refill reports new rows under its own run id instead of replaying the morning's report; a re-run of the same wake keeps its number and reuses its report (F15 unchanged). OPERATIONS.md states the dispatch job's ten-minute timeout (F22). tests/workflow.test.mjs pins both. The seven repository checks pass.

## The number, wired (plan Phase 1), 27 October 2026

Built and tested; merged by the session per Krish's go of 27 October. Not live until the dispatch's next run reports, and the first count needs his answer.

- **The number.** `good_meetings` leads every report's objectives. From Monday 2 November the dispatch posts one Monday ask, `gmg-<last week>`: a strategy plan holding every path as null. It is counted only from his "Change it first" version after its `amended_sha256` is recomputed. A Clear without numbers, a decline, an unreadable answer or decisions that cannot be read leave it missing with the reason, never 0. The weekly target comes from the ladder read from docs/NORTH_STAR.md, or from Control Center's refresh when it is a number (Mindmake's read "private").
- **Bookings.** `podcasts_booked` (this London week, against 2) and `stages_confirmed` (the last fourteen days, against 1) come from each pitch's `booked_at` in the 1.9.0 context, and are missing when pitch outcomes are not served completely.
- **Safety (N15, N16, N18).** Only `gmc-` campaign plans reach prepare-action. An amended plan or go-live is acted on only after its digest verifies, else `amended_digest_mismatch`. A campaign plan over 8,000 characters is held as `payload_too_long` instead of failing the report.
- **Directive (N03, N10).** The directive's North Star figures and constraints are read as data. The constraints are reported in shadow, holding nothing yet. Every report carries the standing `founder_visibility_open` hold, which never marks a run as held.
- **Control Center's side.** docs/CONTROL-CENTER-BRIEF.md now lists exactly what protocol 1.10.0 owes, in build order.
- **Verified on:** the seven repository checks, with 268 tests (13 new in tests/meetings.test.mjs). Six deliberate mutations of the new guards were each caught by a failing test.
- **Live proof:** none yet.

## Trusted-distribution session closeout, 27 October 2026

Documentation closeout only. The [dated handoff](history/2026-10-27-growth-session-handoff.md) records the completed 22 October release through Control Center PR 523 and growth-mindmake PR 7, its authorised migration/configuration readback, preparation-only canary and replay, and the subsequent private route preparation. It supersedes the outstanding production-release gates in the original 22 October local-build note below. It establishes no verified external action or commercial result.

The 27 October read-only refresh found the earlier plans still pending, their original Advisory identities unresolved and their prepared action windows expired. Reconcile current private lifecycle state before resuming. Later main-branch human-action and mailbox rules take precedence over the older executor context. Current 1.9.0 forms and mailbox work retains its own acceptance gates below; this closeout neither runs nor releases it.

## Forms on his tap (protocol 1.9.0), 27 October 2026

Built, tested and merged (krishanraja/growth-mindmake#20); not live. Ruling (Krish, 2026-10-26): a form is filled for him and his tap submits it; when it cannot be, the most automated next best route. A stage whose own speaker call or guest form Control Center has read (`cfp_url`, `form_fields`) gets a version 2 `form` action (no recipient, no mailbox, the form's page and every answer by the field's own label) on events for a stage to speak on or on visibility for a podcast or a show, about the stage (`target:<id>`), closing on `form_submitted`. Answers come only from the canon and his own site's record read this run, his name, Mindmake, his ruled title, `https://krishraja.com` and the one address `hello@krishraja.com`; never a phone, an address, a payment, a date of birth, a demographic question, a number or a ticked box. A required field the run is not sure of, a required terms box, no email, or labels Control Center's runner would confuse hold it (`form_unanswerable`, `form_terms`, `form_no_email`, `form_labels_overlap`) and the stage falls to its Jonny pitch; a `not_sent` try is answered again or held (`form_blocked`). At most two a row, leading the row; outside the ten pitches; a form-routed stage is not pitched (`speak_form_route`, `pitch_form_route`, `form_sent`). Every action parses with a port of Control Center's own `parseActionV2`. Needs Control Center to serve `form_fields` and `forms` in the context and its Submit press; a context with no form fields writes no form. Not live until a run writes one and Krish presses Submit on it. No live run yet.

## Guest invites onto his shows for Jonny's Gmail (protocol 1.9.0), 27 October 2026

Built and tested locally; a pull request. Guests Control Center holds with a contact, a show (`invite_show`) and an address on record, judged `take` or `stretch`, open, not invited before and not like a No, become 1.9.0 visibility rows naming Jonny's box and the guest (`contact:<id>`), closing on `visibility:invite`, ranked before the podcast pitches. Four a week by the shows' shares (Make Your Mind Up 3, Signal & Noise 1), counted from carried-out invites since Monday in London; at most two a run, inside the ten. Holds are counted as `invite_<reason>`. Stage and podcast reach now carry `audience_size` with its page and time. Needs Control Center to serve its guests (with `invite_state`) and their routes in the context and to file a Jonny-box invite as a guest draft; a context with no guests writes no invite. No live run yet.

## Speaking pitches on EVENTS for Jonny's Gmail (protocol 1.9.0), 27 October 2026

Built and tested locally; a pull request. Stages to speak on (conferences, calls for papers, speaking slots, webinars and panels) whose own page gives an address for speakers, open and before their deadline, become 1.9.0 events rows naming Jonny's box and the stage (`target:<id>`), one ask (a talk or a panel seat) with one talk title, in Jonny's voice from the same live reads as a podcast pitch. Ten a run between podcasts and stages; stages keep up to four. Holds are counted as `speak_<reason>`. Needs Control Center's 1.9.0 with Jonny on events (krishanraja/control-center#575); until it serves 1.9.0 nothing is written. No live run yet.

## Podcast pitches for Jonny's Gmail (protocol 1.9.0), 27 October 2026

Merged (krishanraja/growth-mindmake#17). Up to ten pitches a run to podcasts Control Center holds with an address the show publishes for itself, each a 1.9.0 visibility row naming Jonny's box and the show (`target:<id>`), in Jonny's voice for Krish, from the canon and krishraja.com's own receipts read live; a show already drafted or answered, quiet for 120 days, applied, rejected, buried, his own, or ruled out by a No is held and counted. Reported only where Control Center serves 1.9.0 (`pitch_needs_1_9_0` otherwise), so merging before Control Center deploys changes nothing. Control Center drafts them into Jonny's Gmail; the engine never drafts or sends. Also the round-2 leftovers: no honorific in a title, a partner email names who they back, no false "no email on record", the `signal_noise` slug. Live once Control Center serves 1.9.0 and the next run reports.

## Card words round 2, 27 October 2026

Merged (krishanraja/growth-mindmake#15 and #16) and live from run `mindmake:2026-10-27:manual-23`. After the second live 1.8.0 run (`mindmake:2026-10-27:manual-21`): a first name is never a title, a fit verdict or a judge's clause never reaches the card, partner angles name the company, an appearance names its show and is never on Krish's own shows (`own_show`; an unnamed channel is held and asked about once a month), what he gets names the show, topics are specific or null, and appearance pitches call him Executive Host of Signal & Noise (Ruling, Krish, 2026-10-27).

## Card words are facts, not notes, 27 October 2026

Built and tested locally; a pull request, not merged or deployed. After the first live 1.8.0 run: a judge's note or an instruction never reaches why, a prompt is cut back to the fact before it, the angle opens with the fact quoted whole (the quote gives way when both will not fit), each reach is said as what it is rather than as the room of leaders, VISIBILITY counts a channel only where the record says they own it, and research pages are named by title or site, four at most. No contract change (still 1.8.0). Live once merged and the next run reports.

## The full card (protocol 1.8.0), 27 October 2026

Built and tested locally; a pull request, not merged or deployed. Every row proposal carries `card` (who, known, why, gain, angles, sources) at 1.8.0 only, mirroring Control Center's `parseCard` (krishanraja/control-center#571); a 1.7.0 Control Center gets the line and the brief without the card, and the brief's known line now says the same as the card's. A card that cannot say who and why is held as `thin_card` with a monthly profile question; an appear ask needs a channel the person owns. Schemas copied from control-center `4766118d`. Live only once Control Center serves 1.8.0 and a run reports with it; a card he reads and acts on is the outcome, not this record.

## Whole card lines, 27 October 2026

Built and tested locally; a pull request, not merged or deployed. The first live 1.7.0 run (`mindmake:2026-10-27:manual-18`) showed `because` lines cut mid-phrase. A line is now built only from whole pieces, never cut at a word, and raw lower-case titles are title-cased. Live once merged and the next run reports.

## Rows he can decide on (protocol 1.7.0), 27 October 2026

Built and tested locally; a pull request, not merged or deployed. Rows rank by Control Center's Mindmake fit, leave out competitors and anyone under fit 40, and fill NETWORK from the last email. Every row carries `because` (at most 80 characters, whole) and `brief` at 1.7.0 only, with a title of at most 56; an older Control Center gets the rows without them. Live only once Control Center serves 1.7.0 and a run reports with it; a card he acts on is the outcome, not this record.

## Trusted distribution implementation, 22 October 2026

Built locally across the producer and Control Center shared protocol. Adds
scoped context/outcome reads, campaign selection, a stable weekly review,
the ten-held-intro target and the two-week/one-workflow pilot policy. The
existing commercial activation date is retained. The shared executor has
exact approval, native revision, durable claim and independent receipt gates.
Its native lifecycle completion reuses Control Center's existing done checks.

Local verification includes paginated source coverage, London DST boundaries,
cross-engine isolation, campaign and proof gates, full outcome counting,
provider receipt matching and PostgreSQL claim/recovery/permission checks.
The seven frozen version-1 contracts remain byte-identical.

Production migration, deployment and a daily canary remain release gates.
An approved external action and its real receipt remain an acceptance gate.
No local test establishes a meeting, invitation, paid proof or recognition.

## Copy and offer doctrine, 2026-10-19

Krish supplied *The Copywriting, Offers and Demand Corpus* on 19 October 2026 with the instruction that every growth engine be imbued with it. This entry applies it to the drafting surfaces. It changes no runtime code, contract, policy or output shape.

| Layer | State | Evidence |
| --- | --- | --- |
| Preserved originals | Built | `_corpus/copywriting-offers-demand-corpus.md` (68,132 bytes) and `_corpus/copywriting-offers-demand-corpus-summary.md` (476 bytes), copied byte for byte and listed in `_corpus/manifest.json`; `.gitattributes` stops line-ending conversion in `_corpus/` |
| Doctrine | Built | [docs/playbooks/10-copy-and-offer-doctrine.md](playbooks/10-copy-and-offer-doctrine.md), with its list of where this engine's rules change the corpus |
| Wiring | Built | Shared prompt rule 9, the six drafting and review prompts, playbooks 01, 03 to 07, the playbook index and AGENTS.md |
| Tests and checks | Pass on synthetic data | Integrity check fails when one byte of the preserved copy changes and passes once restored |
| Merged, deployed, activated | Not yet | Branch only. Prompts are optional review contracts; no model integration applies them automatically |
| Commercial outcomes | Not established | A better draft is not a qualified conversation or a paid proof |

The seven frozen contracts and their digests are unchanged.

Verified on 19 October 2026: `npm run contracts`, `npm run check`, `npm test` (152 pass, no failures or skips), `npm run conveyor` (14 stages, 21 edges), `npm run demo -- --summary`, `npm run demo:review` and `npm run demo:engine` all pass. No call was made to live Control Center.

## Control Center protocol adoption, 2026-10-19

Krish authorised every growth engine to adopt the Control Center protocol and run on its daily dispatch (2026-10-19). [CONTROL-CENTER-BRIEF.md](CONTROL-CENTER-BRIEF.md) now supersedes the handoff below as the contract.

| Layer | State | Evidence |
| --- | --- | --- |
| Protocol client and dispatch run | Built | `engineClient` in src/control-center.mjs, src/dispatch.mjs and `node src/cli.mjs dispatch` |
| Tests | Pass on synthetic data | 152 of 152 tests, 15 of them for the dispatch against a local protocol stand-in: worked-example digest, schema-valid report, replay, 409 conflict, 401, lost response, `engine_inactive`, decisions and CLI redaction |
| Runner | Built, not merged | The `dispatch` job in .github/workflows/operate.yml on branch `claude/adopt-cc-protocol`. It runs only from main, so nothing runs until the branch is merged |
| Activation | Recorded by Control Center, not observed here | Control Center switched the engine on with dispatch on 2026-10-18. No live run of this code has been observed from this repository |
| Snapshot source on the runner | Unverified | The dispatch job reads `GROWTH_ENGINE_TOKEN` without the `growth-runtime` environment. If that secret is environment-only, live runs hold with `source_credential_unavailable` until it is a repository secret |
| Full engine cycle, live | Held | Its job-context route was retired by the protocol; live runs report `engine_context_route_retired` |
| Objectives | Missing, with reason | Neither `qualified_conversations` nor `paid_proofs` can be measured until Control Center serves complete Mindmake outcome records |
| Commercial outcomes | Not established | Require recorded human-confirmed conversations and verified payments |

The dispatch never sends, posts, spends, drafts into Gmail or commits an Advisory batch. The seven frozen contracts and their digests are unchanged.

Verified on 19 October 2026: `npm run contracts`, `npm run check`, `npm test` (152 pass, no failures or skips), `npm run conveyor` (14 stages, 21 edges), `npm run demo -- --summary`, `npm run demo:review` and `npm run demo:engine` all pass. No call was made to live Control Center.

## Producer 2.0.0, 2026-10-17

**Full producer v2.0.0 is complete and verified. Control Center implementation remains pending.** This release completes the original growth-repository portfolio, beyond the earlier outbound and reporting subsystem. The user's scope correction limits implementation to growth-mindmake and one downstream handoff.

| Layer | State | Evidence |
| --- | --- | --- |
| Full growth producer 2.0.0 | Complete and verified | 137 of 137 synthetic tests pass, no failures or skips; all seven campaigns and ten work types execute through the real HTTP test boundary |
| Public contracts and handoff | Complete | Seven frozen version-1 wire contracts, exact SHA-256 manifest and one consumer implementation brief |
| Control Center implementation | Pending a separate owner | Must implement the frozen handoff and its acceptance matrix |
| Consumer schema, deployment and activation | Pending | Require migration readback, reviewed promotion, authenticated canary and an actual activation record |
| Commercial outcomes | Not established by this release | Require global human-confirmed conversations and verified proof payments |

The [Control Center PR 469](https://github.com/krishanraja/control-center/pull/469) was an unmerged proposal when this record was written. The Control Center brief of 2026-10-18 says it merged that day; this repository has not verified that independently.

## Frozen release identity

Producer package version is **2.0.0**. The [version-1 manifest](../contracts/manifest.json) freezes growth.ts, reporting.ts, operations.ts, engine.ts, motions.ts, lifecycle.ts and research.ts, each with its exact SHA-256 digest. The [single consumer handoff](CONTROL-CENTRE-HANDOFF.md) mirrors those digests and specifies the import layout. `npm run contracts` independently verifies the source bytes against the manifest in CI. Exact digests and feature support are binding; wire version 1 alone does not imply compatibility with the earlier release.

Use the manifest and the repository's published Git revision as the exact source identity. A package version or a contract hash identifies producer artifacts; it does not establish consumer parity, deployment or activation.

## Verification record

Verified on 17 October 2026:

- `npm run contracts`: pass, all seven frozen source digests match.
- `npm run check`: pass, source syntax, JSON, style and value-redacted secret checks.
- `npm test`: pass, **137 tests**, zero failures and zero skips.
- `npm run conveyor`: pass, **13 stages and 19 edges**.
- `npm run demo -- --summary`: pass, synthetic daily preparation remains dry and explicitly page-scoped/provisional.
- `npm run demo:review`: pass, synthetic global weekly context and recorded feedback produce a bounded dry review.
- `npm run demo:engine`: pass, eleven explicit synthetic jobs across all ten work types; five prepared and six explicitly held under the shared default cap.
- Documentation/workflow checks: pass, local links, exact manifest mirrors, manual dispatch, complete-engine dry default, read-only readiness and no scheduled trigger.

The synthetic HTTP consumer exercises actual producer transport for capabilities, full work context, every commercial motion, artifact persistence, complete report readback, attempts, weekly review and recovery. Each of the eleven jobs is also exercised independently so the shared cap cannot hide an untested later stage. Replays preserve identity; changed facts conflict. Tests cover pre-ingest failure, lost responses, distinct destination records, disclosure, suppression, exact recipient, explicit holds, global-versus-selected scope, feedback and actual activation windows.

Independent review exposed and corrected oversized valid research aborting other work, aliased destination records, a false first-commit replay flag, ungrounded speaking dates, loose artifact closure routing and commercial decisions losing priority to new acquisition. Original reproductions and adjacent checks pass. The full suite also preserves the prior nested global-provenance regression.

## What the full upgrade adds

The executable campaign registry now drives warm notes, researched named outreach, useful follow-up, all introduction permission stages, actual inbound handling, qualification reviews, bounded proof scopes, paid capability handoffs, selected founder or practice drafts, host pitches, reusable aids and research tasks or proposed enrichment. Artifacts include usable content, sources, uncertainty, exact destination, pending approval and matching-event closure. The [full scope matrix](FULL-SCOPE.md) maps these responsibilities to their boundaries.

`engine` is the complete CLI and manual runner mode. One cap applies across the whole cycle. Requests and existing commercial work lead new acquisition and assets. The older `daily` interface remains available. Weekly review adds attributed outcomes, promises, proposal decisions, observed founder effort and a recorded experiment. Unknown values remain unknown. Source acquisition and editorial or delivery execution remain with their existing authorised owners; no new provider, scheduler, CRM or user interface was introduced.

## Scope and remaining gates

No Control Center repository edits, migrations, deployments, live ingestion, schedule activation or production verification form part of this producer-only completion. No activation date was fabricated. The manual workflow enables no recurring schedule. No message, post, subscription or spend was performed.

The per-run dashboard is deliberately selected-page and provisional. The future consumer must derive complete global business outcomes separately, implement the authenticated human dashboard and single action lifecycle, and persist matching-event closure evidence. The producer's synthetic consumer proves its protocol; it does not prove that those production capabilities exist.

The next deliverable is concrete: [CONTROL-CENTRE-HANDOFF.md](CONTROL-CENTRE-HANDOFF.md). It contains the complete work protocol, exact contracts, source and human-action requirements, global London counting, weekly learning, recovery, security, schema-before-promotion order and acceptance matrix. The published repository and manual runner are this producer's deployment artifact. Implementing and activating the private consumer remains separate. Commercial target attainment requires observed outcomes after real activation.
