# Operate the producer

The current release finishes growth-mindmake and delivers its consumer handoff. Do not implement, migrate, deploy, activate or write live Control Center from this task. [RELEASE.md](RELEASE.md) owns completion status; [CONTROL-CENTRE-HANDOFF.md](CONTROL-CENTRE-HANDOFF.md) owns downstream work.

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

The manual Actions workflow exposes engine, daily, readiness and weekly-review modes. Its default complete engine mode is dry, and readiness refuses the commit option. It uses the existing managed growth secret, publishes no private artifact and enables no scheduled trigger. Defining this workflow does not establish a configured consumer or active cadence.

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
