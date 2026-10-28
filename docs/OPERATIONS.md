# Operate the producer

This repository is the growth-mindmake producer. The trusted-distribution scope
accepted on 22 October includes the shared Control Center context, outcome and
approved-action flow. [RELEASE.md](RELEASE.md) owns completion status;
[CONTROL-CENTER-BRIEF.md](CONTROL-CENTER-BRIEF.md) owns the contract.

## Release the trusted-distribution cycle

1. Verify the Control Center repository, production project/domain, database
   binding and current known-good deployment together. Record the exact rollback
   revision privately. Obtain the named production-release approval.
2. Release Control Center's additive protocol and action journal migration.
   Read back the registry: autonomous mode, ten held intros, original five
   qualified conversations and one paid proof, and the unchanged activation date.
   Verify the new context/outcome feature flags with the engine's managed bearer.
3. Release this producer after the consumer is ready. The existing dispatch
   uses `CONTROL_CENTER_ENGINE_TOKEN`; no local browser session or new schedule
   is required. Its legacy snapshot credential is no longer needed for the
   shared context path.
4. Run one bounded preparation canary with a distinct run kind. Read the exact
   stored report, native references, missing coverage and attempt back. A restart
   reads that day's existing report rather than repeating actions.
5. Review the finished campaign plan in Control Center. Its approval permits
   preparing the exact go-live, which needs its own approval. The first supported
   connector is plain zero-cost email without assets. Other routes stay blocked.
   Test real delivery only on the exact approved recipient and action.
6. Independently read the verified provider receipt and the native lifecycle
   completed by Control Center's existing done-check sweep. A submitted, claimed
   or unknown action never triggers a resend. Reconcile known provider ids with
   the executor's reconciliation operation. Unknown provider ids need a human
   investigation, not another send.

Rollback stops approved execution by restoring handcrafted mode and the known-good
deployment/producer revision. Keep the private action journal and all draft
history. Preserve the original activation date and commercial outcomes.

The weekly review is included in daily reports with a stable London-week identity.
The fortnightly rebalance cadence is explicit; the initial allocation remains
70/30 until enough observed outcomes justify a change. Missing correspondence,
transcripts, recognition outcomes or costs must be shown as unknown, never zero.

## Local verification

Use Node 24 or later from this repository:

```sh
npm ci
npm run contracts
npm run check
npm test
npm run conveyor
npm run demo -- --summary
npm run demo:review
npm run demo:engine
```

`npm test` includes tests/dispatch.test.mjs, which runs the whole dispatch loop against a local stand-in for the protocol (tests/support/engine-protocol-service.mjs): the worked example's digest, schema-valid reports, replay, a 409 conflict, a 401, a lost response, `engine_inactive`, decisions and the CLI's redaction.

The demos use fixed synthetic fixtures and clocks. They prove reproducible full-engine preparation, the older outbound interface and weekly review, not current production state. The test harness owns its synthetic consumer and records no live person or commercial outcome. Keep fixture evidence separate from private operational evidence. The contracts command independently compares all seven source files with the frozen manifest; do not renew a digest to conceal a mismatch.

## Private artifacts and managed access

.env.example documents symbolic variable names. The application does not load a local .env automatically. Never paste credential values into a command, prompt, report or repository. The manual Actions runner uses the existing repository growth secret through its configured runtime interface; a managed binding is not proof that a consumer implements this release's contracts.

Optional private plan output may be written only under ignored runtime/. Ignoring a file does not make it safe to upload, include in a pull request or publish as a CI artifact. Live terminal output and raw reports require the same privacy discipline. CI should print counts and opaque identities only.

## Readiness and execution

Readiness is a read-only capability check. It checks the consumer's advertised features, exact contract digests and activation state. Doctor additionally reads and validates the bounded snapshot, buyer definition and current canon. A dry weekly review separately requires complete, current global review context. None creates a draft, attempt, feedback record, schedule or activation date. A successful authenticated read establishes only the capability actually checked.

| Command | Producer behaviour |
| --- | --- |
| `npm run readiness` | Read capabilities and compare contract digests/features; no writes. Incompatible advertised support returns a non-ready result. |
| `npm run doctor` | Validate the source snapshot and read-only capabilities; no writes. |
| `npm run engine -- --summary` | Read the complete selected job context and prepare a dry cycle across all campaigns and lifecycle work. |
| `npm run engine -- --commit --summary` | After separate consumer rollout and actual activation, journal, persist and independently read back the complete private work batch. |
| `npm run daily` | Prepare a dry plan from the bounded source page; selected-page outcome counts remain provisional. |
| `npm run weekly-review -- --summary` | Read complete global review context and prepare a dry review; no writes. |
| `npm run daily -- --commit` | After separate consumer readiness and canonical activation, journal an attempt and persist a daily batch with independent readback. |
| `npm run weekly-review -- --commit --summary` | Under the same gates, journal an attempt and persist/read back one weekly review. |

Write-enabled commands describe future consumer execution. Do not run them against live Control Center as part of this producer-only task. A readiness success does not activate anything. Selected-context and selected-page measures must never be presented as the global commercial scorecard.

Daily and weekly execution remain explicit manual modes. Dry run is the default. A write-enabled mode belongs only to a separately authorised consumer rollout after the handoff is implemented. Unsupported endpoints remain consumer-pending; do not switch credentials, invent a source or silently omit the missing behaviour.

The manual Actions workflow exposes engine, daily, readiness, weekly-review and dispatch modes. Its default complete engine mode is dry, and readiness and dispatch refuse the commit option. It publishes no private artifact and keeps no schedule of its own; it starts on its own only on Control Center's daily `cc-growth-directive` wake-up and on a merge to main that changes `src/`, and both run the dispatch job below.

## Control Center daily dispatch

Control Center writes this engine's directive every day at 05:10 UTC (about 06:10 London) and wakes this repository with a `repository_dispatch` of type `cc-growth-directive` whose payload is `{ directive_id, engine_id }`. The `dispatch` job in .github/workflows/operate.yml runs `node src/cli.mjs dispatch --kind dispatch-<run number>` on main, so every wake reports under its own run id, `mindmake:<London date>:dispatch-<run number>`. Control Center wakes the engine again the same day when a row of his widget runs low, and that later wake is a new run with new rows, never a replay of the morning's report. A re-run of the same wake keeps its run number, so it reads back and reuses the report it already sent. The job has no environment gate, so it never waits for a manual approval. It runs with a ten-minute timeout, `contents: read` permission only and the shared concurrency group. A manual run uses mode `dispatch`, which reports under `mindmake:<London date>:manual-<run number>`. A merge to main that changes `src/` runs the same job at once and reports under `mindmake:<London date>:merge-<run number>`: every row proposal names the source files it was written from, and Control Center hides one whose file has moved, so without this run his widget stays empty until the next wake (it did on 28 October).

| Binding | Where | Use |
| --- | --- | --- |
| `CONTROL_CENTER_URL` | repository variable | The HTTPS origin. Required. |
| `CONTROL_CENTER_ENGINE_TOKEN` | repository secret | This engine's own `gen1_` bearer for `/api/growth/engines/mindmake/`. Required. Never printed. |
| `GROWTH_ENGINE_TOKEN` | repository secret (optional) | The shared growth credential for the bounded snapshot page. If it is only an environment secret, the run cannot see it and holds with `source_credential_unavailable`. |

If either required binding is missing the job says which and exits non-zero before anything is read or written. A wake-up naming another engine is refused the same way.

One run, in order:

1. `POST attempts` with `status: started` and a fresh `gma-` id, before any source is read. If even that is refused, the job fails with the code (for example `unauthorized`) and nothing else happens.
2. `GET directive`, then `GET capabilities` for the activation date. A directive for another engine is `directive_invalid`.
3. Read one snapshot page with the shared growth credential, and prepare notes dry with the same `plan` that `daily` uses. A missing credential, refused read or contract mismatch becomes a hold and a `degraded` report, never a silent skip. The full engine cycle needs a job context Control Center no longer serves, so a live run holds it as `engine_context_route_retired`; a synthetic run can supply one with `--context`.
4. Map outputs to at most ten proposals. A prepared note is `wall: send`, `channel: email`, with `exact_payload` (subject and body) and a `payload_sha256` over the words, channel and recipient. Its `proposal_id` (`gmr-`) stays the same when the words change, so a changed note goes back to Krish. The one grounded improvement is `gmi-`, `wall: strategy` when it is Krish's call and `wall: none` when it is the engine's. A full-cycle work item is `gwp-`: email or LinkedIn words are `send`, publication words are `post`, qualification and proof decisions are `strategy`, research and internal preparation are `none`. Any note to someone with a record in the snapshot's deals, which is Advisory's ledger, is withheld and counted as `advisory_holds_recipient`.
5. Build the report exactly to engine-report.schema.json and check it against that schema before sending. `payload_sha256` is the SHA-256 of canonical JSON without that field; tests prove it reproduces the worked example. `POST reports` with `Idempotency-Key: <run_id>`, then `GET reports/<run_id>` and compare the digest.
6. `GET decisions?since=<seven days ago>`. An approval counts only when its digest equals the payload in this report; the summary prints how many match and how many changed.
7. `POST attempts` with exactly one terminal state and the same id: `succeeded`, `failed` with a lower_snake code, or `unknown`.

Objectives: `qualified_conversations` (people, the London week from Monday 00:00 to the next Monday 00:00, each boundary on its own offset) and `paid_proofs` (proofs, 30 London days from the activation date Control Center records). Both are `value: null`, `availability: missing`, with the reason, until Control Center serves complete outcome records for Mindmake. A selected page, a booking count or an `in_house` Advisory count is never reported as either number.

The activity lines carry the directive id and who chose it, the week's `in_house` counts for Advisory, Network and Visibility (a part that could not be read is said to be unknown, never zero), page counts, holds by reason and the decisions read. They never name a person. The job log prints one JSON summary of counts, codes and opaque ids only.

Failures and recovery. A refused report (400, 403, 413, 429, 5xx) wrote nothing and ends `failed`. A 409 is read back, never resent: when the stored digest differs the attempt ends `failed` with `report_conflict` and the day's first report stands. A live report before Krish switches the engine on is `engine_inactive`. A lost response is read back; if nothing matching is stored the attempt ends `unknown` with `readback_unconfirmed`. Rerun with mode `dispatch` from Actions; a manual run takes its own run id.

What a decision means. A yes is Krish's approval of one exact payload. The engine still sends nothing: Krish sends an approved note himself, through Advisory's own door for a person Advisory holds. A changed payload is a new ask and returns to his list when it is reported.

## Outcome records

The consumer must supply global Mindmake outcome coverage independently of a bounded prospect page. A held call without the five human-confirmed conditions remains pending qualification. A booking, prepared draft or friendly reply never qualifies. A proposal or invoice without confirmed payment never becomes a paid proof.

GROWTH_LAUNCH_DATE is an optional legacy date hint in YYYY-MM-DD form. Write-enabled execution uses the consumer's canonical activation state and requires that state to be active with the actual activation date. If the hint is supplied it must match; it cannot activate the engine or override the consumer. The first-month window covers 30 London calendar dates including actual activation day. Leave the hint absent before activation. Repository creation, a demo fixture and a workflow dispatch cannot establish activation.

## Recovery and visibility

A producer failure before draft ingestion must remain visible through its attempt protocol once the consumer implements it. Show the stage, safe reason, coverage limitation, last success and next recovery action. Do not expose private evidence or credentials in heartbeat summaries. An unknown network outcome remains unknown until its authoritative record can be read.

No write retries happen blindly. Use the durable attempt/run/review identity supplied by the actual run to inspect the consumer receipt before another mutation. A synthetic or private artifact proves preparation; a persisted receipt proves the corresponding private write. Neither proves sending, qualification, payment or business success.

Recovery reads use `node src/cli.mjs resume --run-id RUN_ID`, `node src/cli.mjs attempt --attempt-id ATTEMPT_ID` and `node src/cli.mjs review-resume --review-id REVIEW_ID`. Replace each symbolic ID with the opaque identity actually reported by that operation. These commands read existing records and never repeat the original write. Missing or unreachable readback remains unknown.

For a complete engine cycle use `node src/cli.mjs work-resume --run-id RUN_ID`. It verifies the entire stored WorkBatch and distinct destination records without repeating the write. A successful batch can contain prepared and held jobs, including explicit capacity deferrals. No item silently disappears. A research collection task is work to obtain evidence, not a verified enrichment or a prospect action.

Weekly review also reads channel attribution, overdue promises, awaiting proposal decisions, observed founder effort and one recorded experiment. Unknown effort remains null. Overdue promises and existing commercial decisions take priority over new acquisition. A recorded experiment observation can show its target was observed; it never establishes causation or manufactures a conversation or payment.

Feedback and weekly reviews must persist with stable source references and independent readback. A repeated run must preserve the prior human decision. Do not reset an existing deal, overwrite a human draft or mark a skipped item as completed to make a new artifact appear.

## Refresh commercial truth

Read current mindmake North Star, canon and proof permissions. Compare the source revisions with APPROVED_CANON in contracts/growth.ts. Resolve changed offers, links and restrictions before changing copy. Update reviewed content, source references and review timestamp together only after the review; then rerun contract parity and behavioural checks. The producer holds after 30 days without that review.

## Consumer rollout

The downstream owner follows the single handoff: prepare rollback, apply and read back additive schema before app promotion, verify least privilege and contract identity, exercise the acceptance matrix, and only then propose deployment and activation under their own authority. That work remains outside this task. Never purge historical contacts, evidence, feedback or run records as cleanup.
