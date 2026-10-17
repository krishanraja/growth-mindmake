# Control Center implementation handoff

Implement the **consumer** for the completed growth-mindmake producer. Use the frozen contract manifest in this document and the release evidence in [RELEASE.md](RELEASE.md). This is the one copy-paste brief for the next Control Center task. It grants no production authority by itself.

The current task changes growth-mindmake only. No Control Center implementation, migration, deployment or activation is complete merely because a producer test passes. [PR 469](https://github.com/krishanraja/control-center/pull/469) is an unmerged earlier proposal. Inspect it as historical implementation material, then reconcile it against this frozen contract. Do not merge it unchanged or claim it shipped.

## Intended result

Krish opens Control Center and can see whether Mindmake growth is operating, whether it is producing five qualified conversations per London week and at least one paid proof in its first 30 days, what evidence the report covers, and the one useful action he can take next. The report must distinguish business progress from engine activity.

Extend the existing Growth Numbers and Next patterns. Use the existing Advisory lifecycle for commercial opportunities and Home's single waiting list for human actions. Keep publication growth packs and other engines under their existing owners; present their status alongside Mindmake through the same dashboard rather than copying private commercial records into a media pack. Add no engine UI, navigation system, dashboard, CRM or parallel queue.

## Contract ownership

The producer owns the seven files listed in the manifest below. Copy **all seven files byte for byte into one directory, retaining their filenames**, or consume them through a deterministic versioned package. Keep relative imports intact: growth.ts and operations.ts import reporting.ts; engine.ts imports growth.ts, motions.ts, lifecycle.ts and research.ts; motions.ts imports growth.ts. A proposed consumer directory is api/_mindmakeContracts/. Update earlier single-file vendor imports rather than flattening this package. Compare SHA-256 digests in CI and at read-only readiness. Do not independently retype interfaces or relax parsers on one side. A shape mismatch is consumer-pending or incompatible, never a successful empty response.

The canonical [manifest](../contracts/manifest.json) is version 1 for producer **2.0.0**. `npm run contracts` verifies the exact bytes in CI. Copy the manifest with the seven files for provenance; the file digests below are its readable mirror. Wire version 1 alone does not imply compatibility with the older release: the exact seven digests and required features are binding. These identify producer artifacts, not a completed consumer release. Use this manifest rather than an earlier chat excerpt or unmerged branch.

| Contract | Wire version | SHA-256 |
| --- | --- | --- |
| growth.ts | 1 | `da672a11d66502a50adf3b5de8b93bb406f244163dd4542bd0269e9b2e5ef16b` |
| reporting.ts | 1 | `f04546ea070e0a8df91f2b87e86913075f5d24b25081659e55771b1b93b946f9` |
| operations.ts | 1 | `5f3a1c032a45c262d3ead51f52232aaacdb6908c9954f411f9c31796687be265` |
| engine.ts | 1 | `a37d415fa891b6e44da9da7c79980f89e2db3bbc64cae7917f155bd8e147bb42` |
| motions.ts | 1 | `13844836910e0ab1cfdbf2481e2b07bcdeb3957459be7567277b6ded991a8550` |
| lifecycle.ts | 1 | `0328f8d6829810a42bb09a96dde91b85e5491f008875c386d1218f227ea1c5f6` |
| research.ts | 1 | `07279341c476c4d1941cf21db102237d3f8785e2c1146f5d07144ac80c5b462c` |

## Required protocol routes

The machine client implements the following contract. Implement it in the consumer; this repository contains no deployed handler for these routes.

| Method and route | Request or response |
| --- | --- |
| `GET /api/growth/mindmake` with optional `cursor` | Raw version-1 source snapshot. Bounded prospect page and source revision; never infer global coverage from it. |
| `POST /api/growth/mindmake` | Version-1 draft batch; return an acknowledged receipt accounting for every recommendation and its persisted consumed report. |
| `GET /api/growth/mindmake?run_id=...` | Durable acknowledged run receipt for recovery and independent readback. |
| `GET /api/growth/mindmake/work?context=1` | Raw EngineContext: current bounded snapshot and complete selected explicit jobs. Supplies the full growth portfolio. |
| `POST /api/growth/mindmake/work` | Raw WorkBatch. Atomically persist artifacts, holds, full report and every input disposition; return the work receipt below. |
| `GET /api/growth/mindmake/work?run_id=...` | The durable work receipt and exact persisted WorkBatch for independent readback and safe recovery. |
| `GET /api/growth/mindmake/operations?capabilities=1` | Raw version-1 Capabilities with all seven exact contract digests, required feature flags and canonical activation. |
| `POST /api/growth/mindmake/operations` with `kind: attempt` | Version-1 envelope carrying Attempt; return `{ok:true, attempt:...}` after durable persistence. |
| `GET /api/growth/mindmake/operations?attempt_id=...` | `{ok:true, attempt:...}` for that exact identity. |
| `GET /api/growth/mindmake/operations?review_context=1` | Raw version-1 ReviewContext with complete current global measures, coverage, run health and recorded feedback. |
| `POST /api/growth/mindmake/operations` with `kind: review` | Version-1 envelope carrying WeeklyReview; return `{ok:true, review:...}` after durable persistence. |
| `GET /api/growth/mindmake/operations?review_id=...` | `{ok:true, review:...}` for that exact semantic review identity. |
| `GET /api/growth/mindmake/report` | Required human-authenticated private read model. Consumer implementation combines authoritative global outcomes with the producer artifacts and existing action/feedback lifecycle. |

Attempt writes carry version, identity, command (`engine`, `daily` or `weekly-review`), start/finish times, state, phase, run identity and an allowlisted error code only. Weekly review references the global context seal. Use the parsers for precise required fields. Capabilities must advertise `snapshot`, `report_persistence`, `attempt_journal`, `weekly_review`, `human_reporting`, `human_actions`, `global_outcomes`, `feedback`, `campaign_context`, `work_persistence` and `commercial_learning` only after each is implemented and tested. Never set a feature flag merely to satisfy readiness.

## Complete engine work protocol

`engine` is now the full cycle and the manual runner's default, dry unless explicitly committed. `daily` retains the older bounded outbound protocol for compatibility. Implement the work routes before claiming the whole engine is supported. There is no Vercel web app in this producer: its deployed artifact is the repository and manual GitHub runner. The private consumer remains the existing Control Center deployment.

EngineContext contains `version`, `generated_at`, `source_revision`, `complete`, `snapshot` and up to 100 `jobs`. Outer and snapshot source revisions must match. Each job has `id`, `kind`, `contact_id` or null, `source_id`, `due_at` or null, and strictly typed `details`. The source owner selects actual work from existing records. Do not manufacture jobs from enriched contacts, a recent scrape or a target shortfall. Missing source data is unknown, not a synthetic empty success. Keep selected-context completeness distinct from global outcome coverage.

The ten kinds are `outreach`, `introduction`, `inbound`, `qualification`, `proof_scope`, `delivery`, `trust`, `speaking`, `practice` and `research`. The executable registry maps these to all seven campaigns. Full source and output examples are in the synthetic [engine fixture](../fixtures/engine-context.json), with independent per-kind and HTTP tests. Use the exact parsers for payloads rather than inventing a looser key/value bag.

Source resolution is an ingestion responsibility as well as a producer gate. Derive request, call, opt-in, scope, terms and payment references from the actual same-contact/same-proof canonical records. Translate only permitted minimal evidence into the snapshot. Preserve source IDs, event times, retrieval scope and visibility; do not renew timestamps or replace authoritative records with inferred text. Canonical private terms, signed scope and payment references must remain private and retrievable by their authorised owner.

The response to POST and recovery GET is `{ok:true,batch:WorkBatch,created:[{item_id,record_id}],held:[{item_id,reason}],replayed:boolean}`. Every prepared item appears exactly once in created or held. Created destination record IDs must be distinct. Every source job is already accounted for in batch.items or batch.held, including capacity deferral; persist both. The batch report must match these counts. Independent readback compares the complete semantic batch, not a summary. Delivery-only batch time is excluded from replay; source revision, content seal, dispositions and actual artifacts are retained. Conflicting content under the same run ID is a conflict.

Atomically persist this journal and map items to existing private intelligence, Growth, Advisory, Home action, capability handoff or editorial handoff records. Do not create a second action queue. Preserve human edits and existing decisions. Recheck source revision, current suppression and state at ingestion; hold stale or conflicting work with a reason rather than resetting or overwriting it. One shared preparation cap applies across all jobs: five by default, ten maximum, with the strictest policy/registry limit winning.

Each item separates outward `body` from `internal_notes`. The fully sourced aid for an outreach note is an internal review attachment; it is not automatically appended to the first message. Never copy private notes, proof terms or research into an external action. Public asset rights are placement-specific. Warm recipient permission does not grant public reuse. `ARTIFACT_ROUTES` in engine.ts binds each kind to its exact channel, semantic destination, permitted campaign and matching closure event. Map those semantic destinations through existing route helpers. A missing rendering/action surface is a consumer implementation gap to report to Krish; never silently hide the artifact or mark it completed.

Introduction items represent separate connector permission, recipient permission and an agreed connection. Inbound respects actual service delivery and response state; a pending or failed free brief routes to the existing capability owner, without a duplicate service email. Qualification preparation changes no qualification count. Proof scope requires the actual held, human-qualified deal and private terms. Delivery handoff requires distinct same-proof signed scope and verified payment with no reversal; the delivery owner must retrieve and inspect the full accepted scope before beginning. A handoff receipt proves neither delivery nor client acceptance.

Trust and speaking items are exact inspectable drafts. Programme and deadline dates require matching current first-party evidence, and a host-only pitch confers no audience permission. Research tasks request evidence collection; research enrichments review supplied source excerpts, not independently fetched pages. Store proposed research privately, retaining observed/inferred/unknown distinctions, ordinary alternatives and contradictions. Neither type creates a ranked prospect action or closes its research task merely because a draft exists.

The work receipt, attempt and existing action read models must survive reload, replay and uncertainty. `work-resume --run-id` reads the stored batch without another POST. An unconfirmed write remains unknown until that record is read. Keep private batch bodies out of public workflow logs and artifacts.

The producer's per-run DashboardReport is explicitly `selected_page`, provisional, with `global_outcomes: consumer_required`. Its page outcomes cannot power the headline global business metric. ReviewContext supplies the independent global facts; the human reporting endpoint owns their authoritative projection. The human feedback route may reuse the existing authenticated action API, but must return persisted evidence compatible with ReviewContext rather than invent a parallel workflow.

## Private source of truth

Existing contacts, company intelligence, deals, qualification and payment outcomes remain authoritative. The consumer owns the private run/attempt/review journal, persisted human feedback and existing action lifecycle. The producer is stateless. Keep raw contacts, research, drafts, internal figures and detailed reports behind authenticated least-privilege access. No public route or heartbeat carries a full private report.

A bounded prospect page and a global outcome report answer different questions. The snapshot may contain a bounded contact page and next cursor. Global measures must cover **all relevant Mindmake outcome records in the reporting windows**, including people absent from that contact page. Page size, selected prospects and the first 500 historical deals cannot define the weekly outcome. Query or aggregate the outcome windows independently. An incomplete query produces incomplete coverage, not zero.

## Global measure semantics

The operating timezone is Europe/London. Use timezone-aware event timestamps. The weekly window starts at local Monday 00:00 and ends exclusively at the next local Monday 00:00. Cap observations at the actual as-of time. Convert each local boundary to its own UTC instant so the clock change never becomes a fixed-offset error.

A qualified conversation counts only when the substantive exchange actually occurred and Krish confirmed all five criteria: decision authority, an owned problem, active need, offer fit and an agreed next step. The confirmation and qualification timestamps must be at or after the completed exchange and at or before as-of. Missing, false, malformed, future or pre-call confirmation does not qualify. Booked calls, prepared drafts, enriched contacts and positive replies never count. Deduplicate each person within the week, even across several opportunities or meetings. Report held exchanges awaiting qualification separately.

Reference SQL semantics, to adapt to the authoritative event source rather than execute as a migration:

```sql
with bounds as (
  select
    date_trunc('week', :as_of::timestamptz at time zone 'Europe/London')
      at time zone 'Europe/London' as week_start,
    (date_trunc('week', :as_of::timestamptz at time zone 'Europe/London')
      + interval '7 days') at time zone 'Europe/London' as week_end
)
select count(distinct contact_id)
from authoritative_mindmake_conversation_events e cross join bounds b
where e.held_at >= b.week_start
  and e.held_at < b.week_end
  and e.held_at <= :as_of::timestamptz
  and e.human_confirmed = true
  and e.decision_authority = true
  and e.owned_problem = true
  and e.active_need = true
  and e.offer_fit = true
  and e.next_step_agreed = true
  and e.confirmed_at >= e.held_at
  and e.confirmed_at <= :as_of::timestamptz
  and e.qualified_at >= e.held_at
  and e.qualified_at <= :as_of::timestamptz;
```

The source name above expresses the required event semantics; it proposes no new table. Preserve the actual completed-call and confirmation history when adapting existing deal records. Validate source fields and report malformed or missing evidence as coverage limitations rather than silently coercing them to a qualification.

The first-month window exists only after the actual activation date is recorded as YYYY-MM-DD. It covers 30 London calendar dates, including activation day. Its UTC bounds are local activation midnight and local midnight at activation date plus 30 days, end-exclusive, with observations capped at as-of. Count distinct proof identities with verified payment or paid-deposit evidence. A booking, proposal, verbal yes or unpaid invoice does not count. Handle payment reversals explicitly without deleting history. If payment coverage cannot establish a valid count, say unknown.

No launch date means inactive: the paid-proof count and gap are null, not zero. Never use repository creation, a workflow run, the demo date or today's date as an inferred activation. Weekly target is five; first-month target is one. A partial week remains labelled partial. Do not forecast attainment from preparation volume.

WeeklyReview carries canonical activation and `first_month_status`: inactive, open or closed. A closed first-month result remains a historical measure; do not recommend obtaining a new payment now as though it could repair the elapsed window. The producer suppresses that stale paid-proof next-step recommendation after the window closes.

## Authenticated read model

Implement the private human reporting endpoint and the machine capabilities, source, receipt, attempt and review endpoints in the final route table. The human route uses Control Center's existing authenticated identity and tenant scope. A machine bearer must not open the human dashboard, qualify a conversation, confirm a payment, approve a message or act as Krish. A human session must not bypass machine-contract validation.

The read model combines current global outcomes, latest successful report, last attempt health, source coverage, research holds, qualification pending, persisted feedback, latest weekly review and at most one actionable recommendation. Include source identity, as-of time, timezone, coverage completeness and an explicit stale/failure/inactive state. Do not count a durable draft receipt as a successful business result.

Readiness must be read-only: verify authentication, advertised endpoint capabilities, exact contract digests and canonical activation state. It must create no draft, attempt, feedback, review, schedule or activation record. Doctor and daily source validation separately check current commercial canon and the source snapshot. A dry weekly review separately validates current complete global review context. Missing support remains an explicit consumer-pending state; readiness alone does not prove source or canon freshness.

## Human report and one next action

Numbers shows the current week against five and the first-month measure against one only when active. Explain pending qualification and missing coverage at the metric itself. Show latest attempt, latest success and safe reason separately. A failed newest run cannot inherit a green status from an older success. A successful all-held run is an observed run with explicit holds, not a crash or a pipeline win.

Next surfaces at most one grounded recommendation using the existing selection pattern. It carries an opaque recommendation identity, source/run/review references, reason now, evidence, owner, expected action and a concrete closure condition. Missing evidence means no fabricated recommendation. Link to the existing Advisory detail or source surface, with the same identity and allowed audience. An unavailable source is visibly unavailable.

Improvement destinations are semantic IDs: `growth`, `advisory` or `waiting_list`. They are **not URL fragments or deployable links**. Resolve each through Control Center's current route helpers and the matching canonical action/reference: growth to the existing growth surface, advisory to the actual opportunity/action, waiting_list to Home's one list. Validate the resulting route in the consumer's desktop and phone tests. Never copy an unverified hash URL from an earlier proposal or treat an ID as an href.

Each Improvement close condition requires `matching_persisted_event` with its exact source reference. A falling count, a new contact page, a disappearing recommendation or a fresh run does not prove completion. Preserve the original event and action identity so the consumer can verify what actually closed.

Home uses its existing single waiting list. Any new report/recommendation entry must refer to the same canonical action rather than create another copy. Current qualified-week counts must not sit beside a stale cumulative Calls target as if they were the same measure. Replace obsolete three-week offer or December deadline copy only with the current canonical two capabilities and privately scoped paid proof. Invent no offer, fee, availability or start date.

## Channel-aware action closure

Keep recipient, channel and exact payload bound to the action throughout review and execution. Email and LinkedIn are different closure paths:

- A Gmail draft action closes as **draft created** only after the actual draft can be read back for the correct recipient and approved payload. Creating the draft never marks the message sent, the person contacted or the opportunity qualified.
- A LinkedIn action offers Copy and opens the exact intended profile or thread. Copying, opening LinkedIn, creating a Gmail draft or pressing a generic done button never proves a LinkedIn message was sent. Capture an explicit human confirmation with the action identity, actual channel and timestamp; preserve not-sent and declined outcomes.
- Research, introduction permission and report-review actions close on their own stated evidence. A connector's yes does not fill the recipient's opt-in. Do not connect people before both agree. An introduction or follow-up that the current consumer cannot safely represent stays held in its existing human lifecycle.

An action change invalidates earlier approval when recipient, wording, channel, attachment, destination or timing changes. The engine never sends, publishes, subscribes, spends or schedules external communication.

## Feedback and weekly review

Persist accepted, bumped, declined and completed feedback with recommendation identity, actor, timestamp, source context and closure evidence. Only completed work with the correct verified outcome can be marked verified. A rerun preserves prior human decisions and must not overwrite a human-edited draft.

`ReviewContext.feedback` contains the **latest state once per recommendation ID**. Duplicate IDs are rejected. Preserve event history privately, but do not export every historical transition as a separate current decision. A declined matching recommendation suppresses it for the current London week; a bump suppresses it for that London day; completed and verified work suppresses the same semantic recommendation until its facts change. A decision alone never supplies verified closure.

The weekly-review input covers the global outcome window, run successes/failures/unknowns, research needs, coverage and actual feedback. Its output names one evidenced constraint and at most one bounded next recommendation. Counts use actual records; missing information stays unknown. Persist the review under its stable semantic identity, then read it back independently. Only the observation clock is excluded from a review replay; changed context, feedback, policy, recommendation or first-month status creates a new semantic review. Connect its proposed action to the same Home list rather than generating a second queue. Low-volume ratios are descriptive, not causal forecasts.

A weekly recommendation must retain `global_review` scope, the same source revision as its parent review and the same examined count as that global context. The parser rejects a selected-page recommendation or conflicting nested provenance inside a global review. Do not relabel a page artifact as a global finding merely to make it fit the dashboard.

ReviewContext also requires `commercial`: unique campaign `origins` (qualified conversations and paid proofs, with explicit `unattributed` available), `promises` (due and overdue), `proposals` (awaiting decision and declined), `founder_minutes` (null if unknown), and one `experiment` or null. Attribution cannot exceed global outcomes or silently invent payment-window counts. Attribute using recorded origin, never the newest draft or whichever page is selected. Derive due promises and proposal decisions from actual owners and agreed dates.

An experiment records its ID, hypothesis, metric, baseline, target, review date, status, observed value or null and matching persisted evidence ID or null. An observation needs evidence; a closed experiment cannot have no observation. The diagnosis checks actual channel coverage, effort and experiment state. A target observed is not causal proof and cannot change qualified or paid counts. Unknown effort must not become zero. Persist the complete commercial section and coherent diagnosis with the weekly artifact.

The one weekly action prioritises overdue promises, then existing proof proposal decisions, then held-conversation qualification before fresh acquisition work. The `honour_promises` improvement closes only on a matching `promise_fulfilment_recorded` event. `review_proof_decisions` closes on `proof_decision_recorded`; it does not require or imply payment. Other action kinds retain their exact matching event. The existing persisted feedback suppression applies to these priorities too.

## Failing runs remain visible

Implement the attempt journal before relying on ingestion for health. A write-enabled engine, daily or weekly-review run records its bounded started attempt before source capture and then records a terminal result under the same identity. The producer carries the current phase in memory; it does not promise a journal write at every intermediate phase. Safe terminal states are succeeded, failed or unknown, with the terminal phase and allowlisted error code. Source failure and invalid context before ingestion must therefore leave started plus terminal evidence in the dashboard.

Terminal attempt records are immutable. Accept an exact terminal replay idempotently; reject a conflicting terminal state for the same attempt. If a terminal write may have persisted but its response or readback is uncertain, read that identity before any further mutation. Never replace a stored success or failure with a guessed unknown state merely because confirmation was lost. Keep the producer's uncertainty distinct from the consumer's authoritative terminal record.

Keep summaries free of lead names, raw URLs, drafts, private research, credential values and response bodies. If an attempt cannot be written because the consumer is unreachable, the producer reports that visibility failure and does not invent persistence. Treat a started attempt with no terminal confirmation as unknown/stale after the governed timeout. Reconciliation reads existing state before another mutation. A heartbeat is a safe summary and source link, not a second private report store.

## Security, idempotency and readback

Use HTTPS, no credential-bearing origins, redirects disabled, bounded timeouts, payload/response budgets and redacted errors. Keep provider credentials in approved managed runtime surfaces. Use the existing managed growth credential binding when it has the correct scope; do not create or request a new secret merely because a local shell has no value.

Re-read suppression, recipient identity, current source evidence, disclosure scope, commercial revision, existing lifecycle and applicable preparation caps before ingestion. Recheck suppression at the eventual human action. Do not treat a network tier or known relationship as lawful contact permission.

Atomically persist the semantic run receipt, full private report and accepted/held recommendation accounting. Every recommendation must appear exactly once as created or explicitly held. A green HTTP status or summary count is insufficient. Independent GET readback must match the actual stored report and identities. Protect source revision separately from content seal. Delivery clocks do not change a semantic replay identity; changed decisions or facts do. Concurrent retries create no duplicate draft, action, feedback or review. Never retry an uncertain write blindly.

## Schema before promotion and rollback

The consumer owner first identifies the known-good app artifact and exact restore procedure. Verify access to restore it. Apply and read back the additive schema while the existing app remains compatible, including journal/RPC privileges, private-row protection, uniqueness, transaction rollback and concurrent replay. Only then promote the reviewed application. Never merge into an auto-deploying main branch before schema readiness.

Use a designated synthetic environment to prove the matrix below. After separate rollout approval, configure the managed bindings and run read-only readiness. A compatible inactive consumer can pass compatibility while remaining inactive. When the owner explicitly begins actual activation, record its real London date in canonical activation and mark that state active before the first write-enabled canary; the producer refuses commits without it. Then perform one bounded private canary and inspect its real dashboard/action destination. A failed canary is a recorded failed activation attempt, never a reason to substitute the build date, erase history or claim healthy operation. Stop or deactivate through the approved control if needed, preserving the real evidence. Keep the scheduler off until separately authorised; this producer release enables no schedule.

If app promotion fails, restore the known-good revision and inspect journals before any retry. Retain the additive migration unless its exact reversal receives separate review. Stop new ingestion through the approved runner or runtime control without deleting existing evidence. Do not purge contacts, deal history, attempts, feedback or receipts as cleanup.

## Acceptance matrix

All fixtures are synthetic or designated. Check both desktop and phone through the existing harness. Record exact candidate and deployed revisions separately.

| Fixture or failure | Required observable result |
| --- | --- |
| Two qualified people, three additional held unqualified exchanges and duplicate meetings | Global week shows 2 of 5; pending remains separate; each person counts once |
| Qualified person absent from the prospect page | Included in global count; changing page size does not alter the metric |
| London Monday and the daylight-saving transition | Each boundary belongs to the correct local week; no fixed UTC-offset approximation |
| No activation date | First-month state inactive; count and gap null; no fabricated date |
| Activation window first instant, last included date and exclusive end | Only confirmed payments inside the actual 30-date window count; future payment, booking and unpaid invoice do not |
| First-month window closed with an unmet historical target | Preserve the historical result and closed state; do not surface a live action implying a new payment could count in that past window |
| Incomplete outcome query or missing payment/qualification evidence | Unknown/incomplete metric with coverage reason, never false zero or attainment |
| No prior run, successful empty run, all-held run, stale source, newest failed run and uncertain run | Distinct honest states; last success remains separate from current health |
| Source fetch fails or context validation fails before ingestion | Attempt and stage failure remain visible, or explicit unconfirmed visibility when the consumer is unreachable |
| One recommendation with long evidence, no evidence and a missing linked source | At most one actionable item; all text reachable; missing data remains explicit |
| Accepted, bumped, declined and completed decisions; failed write and reload | Feedback persists with correct identity; failed save never displays as saved; rerun preserves human work |
| Gmail draft and LinkedIn message actions | Correct channel closure; neither Copy nor Gmail creation falsely closes LinkedIn or records a send |
| Introduction with either opt-in missing; suppressed contact after preparation | Human hold or stop; no implied permission and no external action |
| Identical replay, changed payload, lost POST response, readback disagreement and concurrent commits | One durable effect; conflict/unknown surfaced; every created/held item and consumed report verified |
| Weekly review persisted twice and refreshed | Stable semantic review; one canonical action; source coverage, feedback and outcome counts read back |
| Every campaign and all ten explicit work kinds | Actual inspectable artifacts persist and appear through existing surfaces; full work report and every source disposition read back |
| Mixed inbound, proof, relationship, acquisition and asset jobs | One shared cap, priorities respected, capacity holds explicit; one direct action per recipient |
| Separate introduction opt-ins, failed/pending brief service, unconfirmed call and unsigned/unpaid proof | Correct preparation or hold; no inferred permission, duplicate service response, qualification, payment or delivery |
| Unattributed outcomes, unknown founder effort, overdue promise, pending proposal and observed experiment | Unknown remains unknown; existing commitments lead acquisition; one persisted-feedback-aware action; target observation claims no causation |
| Changed first-party event date, private public-asset claim, unearned first-person story and research contradiction | Affected item held or private reconciliation retained; no fabricated public claim or automatic outreach |
| Work receipt aliases two items to one destination record, drops an item or truncates an artifact | Reject as incomplete persistence; readback cannot claim success |
| Maximum valid research or lifecycle payload and another independent inbound request | Oversized artifact is explicitly held; independent valid work still proceeds within the cap |
| Global review carrying a selected-page recommendation, different source revision or different examined count | Contract validation rejects the mismatched nested provenance before persistence or display |
| Wrong auth, cross-tenant access, machine write to human outcome fields and anonymous private report | Denied without private response content or credential leakage |
| Consumer digest mismatch or missing advertised capability | Read-only readiness refuses compatibility; no silent fallback or mutation |
| Expired commercial canon | Doctor/daily source validation holds; a capabilities-only readiness success never proves canon freshness |
| Migration failure, partial app promotion and rollback | Prior app remains recoverable; journals survive; activation remains off |

Done means the consumer implementation and these observations agree with the frozen producer contracts. Return what was implemented, migrated, deployed, activated and verified as separate facts. A producer test, an open PR or a prose checklist cannot substitute for those observations.
