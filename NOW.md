---
repo: krishanraja/growth-mindmake
product: Mindmake growth engine
as_of: 2026-11-15
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

## Where it is right now (as of 2026-11-15)

<!-- north-star-state {"week_of":"2026-11-02","week_target":5,"current":0,"current_as_of":"2026-11-08","current_source":"growth-mindmake's latest live report to Control Center (objective good_meetings: meetings Krish marked good, each traced to its path, in the week it counts), read by Control Center","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (0% now)"} --> **North Star number: U5, stalled.** Good meetings a week, each marked good by Krish after it and traced to where it came from: 0, against 5 in the week of 2 November 2026, on the way to 20 by 30 November 2026. Everything else pauses unless it moves the number.

Lifecycle: building. The detail is in `README.md`.

- Krish's part of the cold compliance gate (GET-GOING 1.2, not ticked) is recorded in config/compliance.json: the footer words, the privacy section and the legitimate-interests assessment by digest, the reviewer waived by him, and his word that nobody in the old Instantly and Apollo lists had opted out (Rulings, Krish, 2026-11-15). The gate now also reads Control Center's footer back from its capabilities each live run, and lets a cold note through only where Control Center serves exactly the approved footer with the one-click link and the STOP reply; a United Kingdom sole trader or partnership, or one the record cannot tell, is held. What is still open is Control Center's: serving cold email with the footer (cold_footer_not_served until its change is merged, its migration applied and its variables set) and records.brief_takers. Nothing is left for Krish to import: opt_outs_not_imported is closed on his word. (2026-11-15)
- Call prep (GET-GOING 1.7) is built and runs in shadow: `src/stages/callprep.mjs` makes, for every meeting in `upcoming_meetings` that starts tomorrow, London time, the person, the company, the mirror, the prior touches and the Pipeline record, each fact said, inferred or missing, up to five discovery questions, and for a first call the test-kit interview (the cost, what they do today, what a yes would need, each drawn from the buyer's own record); the dispatch counts it in one line and nothing reaches Krish, because Control Center takes no call prep yet. The morning drafts' QA (`src/stages/morning.mjs`) holds an email for his own box with a claim on neither the person's nor the company's record (`morning_claim_untraced`), and only counts one over 80 words in an activity line (`morning_over_80_words`, `MORNING_LENGTH_HOLDS` false) until Krish has read a week of counts (Ruling, Krish, 2026-11-15). Call prep reaches him on the meeting in Pipeline (Ruling, Krish, 2026-11-15). 19 new mutations, all killed (100 of 100). (2026-11-15)
- a Codex card now starts only through scripts/codex_thread.mjs (open, send, read), a byte-for-byte copy of ai-harness's canonical tool, so the thread shows in Krish's Codex Desktop; scripts/dispatch-card.mjs prints the open and read lines in place of the plugin's background task, with the allowance guard, his yes on the digest and verify-card unchanged (docs/RULINGS.md, docs/codex/TASK-CARD.md). (2026-11-15)
- the branch sweep takes an approved list (branch@sha) on a hand run and deletes each named branch only at that exact commit, skipping and logging anything else; the weekly run is unchanged. Copied from ai-harness's canonical script and workflow. (2026-11-15)
- A weekly branch sweep (`.github/workflows/branch-sweep.yml`, Sunday 03:17 UTC, and by hand) deletes every remote branch whose work is already on main and lists each branch it keeps with why: unmerged work, an open pull request, protected (Ruling, Krish, 2026-11-15). The script is `.github/scripts/branch_sweep.py`, copied unchanged from ai-harness, which holds the canonical copy. (2026-11-15)
- The daily dispatch runs live: Control Center wakes it at about 05:10 UTC, again the same day when a row of his widget runs low, and a merge to main that changes `src/` runs it at once. Each run reads Krish's instruction first (protocol 1.20.0), builds the five rows, Jonny's pitches and invites and the stage forms from Control Center's context, asks the research desk for lookups and openings, passes every action with words in Krish's name through Control Center's voice check, and reports the number, the bookings and the engine's state (README.md, "The daily Control Center dispatch").
- Nothing here sends, posts or spends. Control Center drafts Jonny's pitches into Jonny's Gmail each day for Jonny to send; every other action waits on Krish's own press, and an approved exact email runs only through Control Center's shared executor.
- The number is read from his one tap after each meeting (protocol 1.10.0). On the 12 November run good meetings, podcasts booked and stages confirmed all read as measured; the count itself is the state line above, which Control Center writes.
- Krish has not given this engine an instruction yet. The code that reads one, ranks the rows that serve it first and acks it (only when its state changes) is built and tested.
- This week's spec (`gms-2026-11-09`) is unsigned on his list, so every run holds `spec_unsigned` and runs on today's settings, raised to the policy's bounds at U5. Nothing has switched to Phase 5's enforcing route.
- In shadow, never evidence: the crew's lints and checks, the stages moved out of Control Center (plan section 12) and the Reader Check.

The 27 October trusted-distribution closeout is in [the dated handoff](docs/history/2026-10-27-growth-session-handoff.md). The 22 October producer and Control Center release and its preparation-only canary are historical evidence, not proof of today's outcomes. Of the five 22 October route plans, four were withdrawn on 27 October because their Advisory records are gone, and one is still a real ask on his list. Later AGENTS.md human-action rules and the forms and mailbox gates remain in force.

## What changed recently

- Older changes are in [docs/history/LOG.md](docs/history/LOG.md), moved there word for word to keep this file short.

## What is next and what is waiting on Krish

- Next (2026-11-15): Control Center's opt-out and footer change ships (its migration applied on Krish's yes and its variables set), and the next live report's gate line reads open.
- Waiting on Krish: signing this week's spec on his list (`gms-2026-11-09`) by 15 November, when it expires; the Google Analytics settings (key event `brief_submit`, custom dimensions `brief_route` and `brief_step`).
- North Star check (2026-11-15): holds.

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
