# Release state

## Rows he can decide on (protocol 1.7.0), 27 October 2026

Built and tested locally; a pull request, not merged or deployed. Rows rank by Control Center's Mindmake fit, leave out competitors and anyone under fit 40, and fill NETWORK from the last email. Every row carries `because` and `brief` at 1.7.0 only; an older Control Center gets the rows without them. Live only once Control Center serves 1.7.0 and a run reports with it; a card he acts on is the outcome, not this record.

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
