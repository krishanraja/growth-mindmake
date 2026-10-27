# Get going

## Current continuation, 27 October 2026

Start with [NOW.md](../NOW.md) and the [dated trusted-distribution session handoff](history/2026-10-27-growth-session-handoff.md), then read today's Control Center directive, context, decisions and latest report. The 19 October checklist below is historical and is not evidence that later merged capabilities are still unimplemented. Current AGENTS.md rulings, the North Star ladder and negotiated protocol capabilities take precedence. Reconcile the earlier pending route plans with current lifecycle records before reusing their drafts; their prepared action windows have expired. Do not re-interview Krish or recreate missing records from this document.

When Krish opens this repository and says "Get going", this is the work. AGENTS.md says how to use it; this file says what to do. Written 2026-10-19 by Control Center, from this engine's first live reports.

## What "Get going" does

1. Read AGENTS.md to the end (it records Krish's rulings), then docs/NORTH_STAR.md. Say in one line which part of the North Star this run moves.
2. Do the first unticked step of **The build** below, completely: to its checks and one pull request. Tick it in that same pull request, with a one-line note of what it changed in the live report. If a step is blocked on something only Krish can do (a secret, a ruling), say exactly what in the pull request and on his list in Control Center, tick nothing, and go on to the next step.
3. Stop after one step, unless it took under an hour and the next step needs nothing from him.
4. When every step is ticked, "Get going" means: read the engine's latest live report and today's directive, find what most limits tomorrow's report (an unknown objective, a held proposal, a weak go-live, a check-in he declined), fix that, and add it here as a ticked step.

Never ask Krish to paste a prompt or repeat a brief: everything needed is in this repository.

## The brief

Read AGENTS.md first and follow it (it records Krish's rulings of 2026-10-19), then docs/NORTH_STAR.md, docs/CONTROL-CENTER-BRIEF.md and docs/control-center/ENGINE-PROTOCOL.md (protocol 1.2.0). Before you start, say which part of the North Star this work moves.

Where things stand (2026-10-19): this engine runs the Control Center loop live. Every day at 05:10 UTC Control Center writes this engine a directive and wakes `.github/workflows/operate.yml` (its `dispatch` job, `node src/cli.mjs dispatch`) with a `cc-growth-directive` repository_dispatch. The first live run on 2026-10-19 succeeded: it journaled its attempt, read the directive, sent a report, read it back by digest and read Krish's decisions. The runs of 2026-10-20 and 2026-10-21 stopped on `directive_invalid`: Control Center had begun serving 1.1.0 and this engine required exactly 1.0.0 back. It now reads any 1.x directive (ENGINE-PROTOCOL.md, "Versions") and sends `schema_version: "1.2.0"`. Each note names its recipient as `subject_ref: "contact:<id>"`, the Control Center contact id it came with, so Krish's list keeps Advisory's, People's or Visibility's copy when they already hold that person, and shows one of this engine's asks at a time (Ruling, Krish, 2026-10-21). Read `stage`, `amended`, `exact_payload`, `amount_usd` and `amended_sha256` from decisions.

The job now is to make the daily report worth Krish's morning. Every run should leave Control Center with:

1. Every objective measured honestly: a real value with its window and timezone, or `value: null` with a specific reason. Never a zero you did not measure.
2. One best recommendation plus a few alternatives as `proposals[]` (at most 10). Each one names its `objective_key`, says why in plain words, links its evidence (https only), says its `kind` (advice, prepared or autonomous), names the event that proves it done in `close_condition`, and has an `expires_at`. Control Center picks tomorrow's next action by rule: first what Krish approved and you have not done, then a repair if the engine is failing, then the unwalled proposal on the objective with the widest gap. So make the move you most want done unwalled where you can, and aim it at the widest gap.
3. Anything behind a wall (`wall`: send, post, spend or strategy) complete enough that his yes is the whole decision: the exact words in `exact_payload`, the channel, `amount_usd` for spend, and the evidence. It lands on his one list in Control Center, where Clear approves exactly that payload, "Change it first" lets him approve his own version, and Purge declines it. Keep a proposal's `proposal_id` stable across runs: if the words change, the new `payload_sha256` sends it back to him, and his earlier yes and any version of his no longer apply.
4. `events[]` for what closed, with evidence, naming the proposal_id and the event in its close_condition.
5. `holds[]` for anything set aside, each with a reason code and one plain sentence.

Acting on his decisions: this engine is handcrafted (AGENTS.md, "Handcrafted"): it never goes live on its own. Read `GET .../decisions` every run. For an approved proposal, do the work that sits inside the walls and prepare the exact artifact for Krish, then stop; he sends, posts or spends himself. When a decision says `amended: true`, recompute `amended_sha256` (SHA-256 of canonical JSON of exactly `{"amount_usd": ..., "exact_payload": ...}`) and prepare his version, never yours.

Rules that do not move:
- This repository is public. Synthetic fixtures only. No live people, drafts, business figures, tokens or production receipts in code, tests, logs, artifacts or pull requests. Public Actions logs carry counts and codes only.
- Never print or commit `CONTROL_CENTER_ENGINE_TOKEN`. This task has no token and needs none: prove every change against the repository's local protocol stand-in (`tests/support/engine-protocol-service.mjs`). The only live writes are the scheduled Actions run and the workspace runs Krish starts.
- Never retry a write blindly. After a timeout or a 409, read back first.
- Plain English, no em dashes.

Finish with the checks below passing and one pull request whose description says, in plain words, what tomorrow's live report will say that today's did not.

### This engine

Today's live report (2026-10-19) was `held`: one proposal ("Refresh the missing public research") and three holds:
- `engine_context_route_retired`: the full engine cycle still asks for a job context from `/api/growth/mindmake/work` and `/operations`. Control Center never built those; the protocol replaced them.
- 44 prospects held because the buyer role does not match the current definition, and 6 held for no current buying moment.
- Both objectives (`qualified_conversations`, target 5; `paid_proofs`, target 1) are missing, because Control Center does not yet serve complete outcome records.

## The build

- [ ] **Step 0.** Correct the status line at the top of docs/CONTROL-CENTER-BRIEF.md: the first live run on 2026-10-19 succeeded, so it is no longer only tested against a local stand-in.
- [ ] **Step 0.5 (added 2026-10-22).** Read docs/briefs/2026-10-22-heygen-outbound.md: HeyGen outbound is held on the open founder-visibility ruling. Record the hold (`founder_visibility_open`) and do not raise a duplicate question; growth-makeyourmindup asks it.
- [ ] **Step 1.** Take the job context from what Control Center does serve: the directive (`next_action`, `objectives`, `decisions_since`, `in_house`) plus the snapshot page. Remove the calls to `/work` and `/operations` so the `engine_context_route_retired` hold goes away and the full cycle runs on dispatch.
- [ ] **Step 2.** Turn the 50 held prospects into one decision for Krish rather than silence: a `wall: strategy` proposal on `qualified_conversations` that says how many were held for each reason and what change to the buyer definition would release them. Do not widen the definition yourself.
- [ ] **Step 3.** Use `in_house` (Advisory, Network, Visibility counts). Propose into those lanes, and never a second note to someone Advisory already holds.
- [ ] **Step 4.** Make the daily recommendation a prepared warm-path or room move: a drafted note to a contact the warm-path evidence supports, as `wall: send` with the exact words and channel.
- [ ] **Step 5.** Write the exact outcome fields you need from Control Center for both objectives into a "What Control Center still owes" section of docs/CONTROL-CENTER-BRIEF.md, so Control Center can build that read. Keep both objectives missing, with their reason, until it exists.

### The bulletproof engine build (added 2026-10-27)

From docs/briefs/2026-10-27-bulletproof-growth-engine.md, approved for filing by Krish on 2026-10-27. Each step is one pull request, built between runs, never during one. Its acceptance tests are in the plan; they are re-run by whoever did not build it. Phase 0 also reconciles Steps 0 to 5 above against evidence, ticking only what the evidence shows is done.

- [ ] **Phase 0.** Baseline and register: real token, time and wait figures from this repo's sessions, Actions runs and PRs, and `invariants/register.json` with every past fix and every open finding.
- [ ] **Phase 1.** Wire the North Star first: the `good_meetings` objective by path, `origin_candidates`, podcast and stage bookings read from 1.9.0 against the visibility target, the directive's constraints enforced, and the exact fields Control Center still owes (Step 5 above).
- [ ] **Phase 2.** The week spec Krish signs on Monday, compiled into the dispatch, with today's config as the fallback, and status computed rather than written.
- [ ] **Phase 3.** The crew as code: a lint, a measured check, a card and a lens for each specialist, including the Librarian; card grammar; every past fix as a test.
- [ ] **Phase 4.** The session pack of 36 KB or less, gate packets, the session ledger, and Codex task cards behind the allowance guard.
- [ ] **Phase 5.** Prove the new route on real runs alongside the old one, then switch; measure the 20x targets against Phase 0.
- [ ] **Canva C1.** The Mindmake brand kit, built by the Cowork session in docs/briefs/2026-10-27-canva-brand-kit-cowork.md, verified by readback, approved by Krish.
- [ ] **Canva C2.** The speaker and guest one-sheet: three blind concepts, one synthesis shown cold, his approval, a brand template with autofill, the PDF at mindmake.co/media, and one line with its link in Jonny's podcast and stage pitches.
- [ ] **Canva C3.** A SendLinks link per recipient, minted by Control Center, with opens read back as the visibility check.

## Checks

`npm run contracts`, `npm run check`, `npm test`, `npm run conveyor`, `npm run demo -- --summary`, `npm run demo:review`, `npm run demo:engine`.
