# Release state

**Full producer v2.0.0 is complete and verified. Control Center implementation remains pending.** This release completes the original growth-repository portfolio, beyond the earlier outbound and reporting subsystem. The user's scope correction limits implementation to growth-mindmake and one downstream handoff.

| Layer | State | Evidence |
| --- | --- | --- |
| Full growth producer 2.0.0 | Complete and verified | 137 of 137 synthetic tests pass, no failures or skips; all seven campaigns and ten work types execute through the real HTTP test boundary |
| Public contracts and handoff | Complete | Seven frozen version-1 wire contracts, exact SHA-256 manifest and one consumer implementation brief |
| Control Center implementation | Pending a separate owner | Must implement the frozen handoff and its acceptance matrix |
| Consumer schema, deployment and activation | Pending | Require migration readback, reviewed promotion, authenticated canary and an actual activation record |
| Commercial outcomes | Not established by this release | Require global human-confirmed conversations and verified proof payments |

The earlier [Control Center PR 469](https://github.com/krishanraja/control-center/pull/469) is an **unmerged proposal**. It is reference material for the downstream owner, not completed consumer implementation or a release dependency to merge from this task.

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
