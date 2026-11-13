---
repo: krishanraja/growth-mindmake
product: Mindmake growth engine
as_of: 2026-11-13
head: 5d3d7ff
lifecycle: building
production_url: none
state_doc: README.md
history_log: docs/history/LOG.md
truth_files: [docs/NORTH_STAR.md]
authority_order: [docs/NORTH_STAR.md, README.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
---

# Mindmake growth engine: where it is right now

## What it is

Mindmake's growth engine: relationships, introductions, researched named outreach, inbound and speaking, prepared for Krish to send.

## Who it is for and why it matters for Mindmake

The leaders who buy Mindmake's paid proofs. This is the engine that fills Krish's calendar with the right conversations.

## Where it is right now (as of 2026-11-13)

<!-- north-star-state {"week_of":"2026-11-02","week_target":5,"current":0,"current_as_of":"2026-11-08","current_source":"growth-mindmake's latest live report to Control Center (objective good_meetings: meetings Krish marked good, each traced to its path, in the week it counts), read by Control Center","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (0% now)"} --> **North Star number: U5, stalled.** Good meetings a week, each marked good by Krish after it and traced to where it came from: 0, against 5 in the week of 2 November 2026, on the way to 20 by 30 November 2026. Everything else pauses unless it moves the number.

Lifecycle: building. The detail is in `README.md`.

- Mindmake's AI answers are AEO-Engine's, the one AI-answers specialist (Ruling, Krish, 2026-11-12): each run reads Mindmake's standing from the directive (protocol 1.22.0, ai_answers) and, when none is on file, asks AEO once with the weekly review's planned questions for Mindmake's places and the canon's hosts (src/stages/answers.mjs). The ruling is in docs/RULINGS.md. The protocol copy in docs/control-center/ is Control Center's at 36df34bc (protocol 1.22.0). (2026-11-13)
- The Control Center brief says Control Center serves 1.0.0 to 1.21.0 (this engine speaks up to 1.20.0) and that the directive's good_meetings target is this repository's north-star block's (20 by 30 November), read each morning, never the registry's copy (krishanraja/control-center#718). (2026-11-12)
- The protocol copy is Control Center's at 212379e1 (1.21.0): its voice_check row lists exactly the 16 channels Control Center's voice check accepts, it says the number objective's target is this repository's own north-star block, and the circle lane files a stranger as cold_scraped. 1.21.0 itself adds only growth-makeyourmindup's inspiration instructions; this engine still speaks up to 1.20.0 (ENGINE_STATE_VERSION in src/stages/instruction.mjs). (2026-11-12)
- The session pack leaves out the Krish canon block ai-harness renders at the end of AGENTS.md (one line in its place; it loads with AGENTS.md itself), and the rulings test reads AGENTS.md's own sections without it, so the canon block can land while the 36 KB budget and the standing rules word for word both hold. (2026-11-12)
- Closeout notes now fold into NOW.md by themselves (ci.yml's fold job runs ai-harness's closeout hook on every push to main); the engine acks a state of Krish's instruction only when it changes, and leaves out of its next steps any whose own deadline has passed; the docs say what the engine does as of 12 November. (2026-11-12)
- The daily dispatch runs live: Control Center wakes it at about 05:10 UTC, again the same day when a row of his widget runs low, and a merge to main that changes `src/` runs it at once. Each run reads Krish's instruction first (protocol 1.20.0), builds the five rows, Jonny's pitches and invites and the stage forms from Control Center's context, asks the research desk for lookups and openings, passes every action with words in Krish's name through Control Center's voice check, and reports the number, the bookings and the engine's state (README.md, "The daily Control Center dispatch").
- Nothing here sends, posts or spends. Control Center drafts Jonny's pitches into Jonny's Gmail each day for Jonny to send; every other action waits on Krish's own press, and an approved exact email runs only through Control Center's shared executor.
- The number is read from his one tap after each meeting (protocol 1.10.0). On the 12 November run good meetings, podcasts booked and stages confirmed all read as measured; the count itself is the state line above, which Control Center writes.
- Krish has not given this engine an instruction yet. The code that reads one, ranks the rows that serve it first and acks it (only when its state changes) is built and tested.
- This week's spec (`gms-2026-11-09`) is unsigned on his list, so every run holds `spec_unsigned` and runs on today's settings, raised to the policy's bounds at U5. Nothing has switched to Phase 5's enforcing route.
- In shadow, never evidence: the crew's lints and checks, the stages moved out of Control Center (plan section 12) and the Reader Check.

The 27 October trusted-distribution closeout is in [the dated handoff](docs/history/2026-10-27-growth-session-handoff.md). The 22 October producer and Control Center release and its preparation-only canary are historical evidence, not proof of today's outcomes. Of the five 22 October route plans, four were withdrawn on 27 October because their Advisory records are gone, and one is still a real ask on his list. Later AGENTS.md human-action rules and the forms and mailbox gates remain in force.

## What changed recently
- 2026-11-12 Krish, 2026-11-12: "make sure everything's a cohesive system and that the project documentation is 100% up to date with absolutely nothing old or misleading left in there".
- 2026-11-12 docs/control-center/ENGINE-PROTOCOL.md, refreshed word for word.
- 2026-11-12 scripts/pack.mjs (CANON_BLOCK, withoutCanon, packed), tests/support/rulings.mjs, tests/pack.test.mjs, AGENTS.md ("Every session: the pack"), docs/OWNERS.md. With ai-harness's canon block (pull request #51) the heaviest pack is under 36 KB and all 629 tests pass.
- 2026-11-12 **The docs match the engine, and notes fold by themselves.** Krish, 2026-11-12: "Are the project documentations up to date, 100%, every single word, with what this engine now is and how it works?" README, the Control Center brief, operations, Get going, the release record and the protocol copy (from Control Center main) now say what the code and the live runs do; twelve closeout notes of 5 to 11 November were folded in by hand.
- 2026-11-11 **Krish instructs the engine, and it reports its state (protocol 1.20.0; Ruling, Krish, 2026-11-11).** The dispatch reads `krish_instruction` from the directive, puts his words first in the run's work in memory only (the rows that serve them say so and rank first), acks it by id (received, then started or blocked with why), and reports `priorities`, `obsessions` and `next_steps` from this repository's own files and the run's numbers. His words are never printed, logged or committed (krishanraja/growth-mindmake#78). Built and tested; no live run has carried an instruction yet.
- 2026-11-10 **Codex signs in by itself (Krish, 2026-11-10).** Claude sessions here show Krish a ChatGPT sign-in link and code whenever Codex is signed out (`.claude/hooks/codex-login.sh` at session start, cloud included); his subscription, never an API key.
- 2026-11-10 **The reader check (Ruling, Krish, 2026-11-10).** The crew's tenth specialist: fresh sub-agents read each draft as its recipient or booker, built only from the card, and say whether they would reply within 7 days, the weakest link and whether they felt remembered or worked (`npm run reader`). In shadow, never evidence; a private ledger scores it against real replies, and it earns weight or is retired by a stop rule set before its first run (docs/playbooks/07-scorecard-and-experiments.md). Built and tested; not yet run on a live draft.
- 2026-11-09 **Everything in Krish's name passes the voice check (Krish, 2026-11-09: "Absolutely everything").** Emails (Jonny's box as Jonny in Krish's style), WhatsApp and X messages, a speaker form's written answers and an engagement task's taps go through Control Center's voice check before they are proposed (krishanraja/growth-mindmake#76); a hard fail is held as `voice_refused`, rule names only. Live: the 11 and 12 November runs held some as `voice_refused`.
- 2026-11-07 **One voice check (Rulings, Krish, 2026-11-07).** Every email for Krish's box or Jonny's passes Control Center's voice check (`features.voice_check`) before it is proposed (krishanraja/growth-mindmake#75); a check that cannot be read is counted as `voice_check_unread`, and Control Center checks again before anything lands.

- Older changes are in [docs/history/LOG.md](docs/history/LOG.md), moved there word for word to keep this file short.

## What is next and what is waiting on Krish

- Next (2026-11-13): After AEO-Engine's research run of Sunday 2026-11-22, read Mindmake's tile in Control Center and confirm the request the engine filed is marked served.
- Waiting on Krish: signing this week's spec on his list (`gms-2026-11-09`) by 15 November, when it expires; the Google Analytics settings (key event `brief_submit`, custom dimensions `brief_route` and `brief_step`).
- North Star check (2026-11-13): holds.

### Existing integration gates to retain

- His Submit on one stage form, and the next context's `forms` showing it `submitted` or `confirmed`, or `not_sent` with why. No form has been submitted yet.
- Ten reach figures in a live report spot-checked against their sources.
- The Reader Check on a live report's drafts (`npm run reader -- brief --report <file>`), on a machine that keeps runtime/reader/ledger.json, so `calibrate` can score it once 20 sends are 7 days old.
- The Canva Cowork session finishes C1 and C2, after which this engine attaches `asset_ref` to the one-sheet's link (C3).
- Control Center's own Mindmake pilot drafts still left in his Gmail are binned from an operator session (`scripts/bin-pilot-drafts.mts` in control-center; his yes is given).
- The pinned `APPROVED_CANON` in `contracts/growth.ts` lapses on 15 November by decision: it gates only the snapshot route (`daily`, `plan`), which the live dispatch does not use. That route needs Krish's review of the current canon before it runs again.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- `README.md`: what this repository is and how it runs.
- [Trusted-distribution session handoff](docs/history/2026-10-27-growth-session-handoff.md): the 27 October checkpoint and later-policy precedence.

## Do not trust

The old trusted-distribution action manifests and Advisory links are historical until reconciled in Control Center. Older "not merged" or "not run live" notes do not override verified later merges and live runs. Read current capabilities and decisions before acting. The North Star number is Control Center's measured reading on the state line, never a figure written here by hand.
