---
repo: krishanraja/growth-mindmake
product: Mindmake growth engine
as_of: 2026-10-28
head: 5d2877d
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

## Where it is right now (as of 2026-10-28)

<!-- north-star-state {"week_of":"2026-10-26","week_target":2,"current":0,"current_as_of":"2026-10-30","current_source":"growth-mindmake's latest live report to Control Center (objective good_meetings: meetings Krish marked good, each traced to its path, in the week it counts), read by Control Center","urgency":4,"urgency_reason":"at 0% of this week's target"} --> **North Star number: U4, far behind.** Good meetings a week, each marked good by Krish after it and traced to where it came from: 0, against 2 this week, on the way to 20 by 30 November 2026. A bold swing every day; work that does not move the number waits.

Lifecycle: building. The detail is in `README.md`.

This session's trusted-distribution closeout is in [the dated handoff](docs/history/2026-10-27-growth-session-handoff.md). The 22 October producer/Control Center release and preparation-only canary were completed; they are historical evidence, not proof of today's outcomes. A read-only check on 27 October found the earlier route plans still pending, their original Advisory records unresolved, and their prepared action windows expired. Reconcile current private lifecycle state before reusing them. Later AGENTS.md human-action rules and the newer forms/mailbox gates below remain in force. The proposed reusable decision demo has not been built or accepted as the next task.

## What changed recently
- 2026-11-10 **The reader check (Ruling, Krish, 2026-11-10).** The crew's tenth specialist: fresh sub-agents read each draft as its recipient or booker, built only from the card, and say whether they would reply within 7 days, the weakest link and whether they felt remembered or worked (`npm run reader`). In shadow, never evidence; a private ledger scores it against real replies, and it earns weight or is retired by a stop rule set before its first run (docs/playbooks/07-scorecard-and-experiments.md). Built and tested; not run on a live draft (now-notes/2026-11-10-reader-check.md).
- 2026-11-06 **Openings by the desk, lookups for row people (Ruling, Krish, 2026-11-06).** Each catch-up and invite opens on a sentence the research desk writes from one fact, read by fixed rules; a failing one holds the email. Row people with no address are looked up and found routes sent to record. Built and tested.
- 2026-11-06 **Partner offers fit the partner; catch-ups name the shared past.** The live run after #62 passed the bar's measures, and reading its emails found offers about a portfolio sent to people with none. Founders only for someone who backs them, a fund only when it is one, otherwise their own leaders; a catch-up uses the card's ask line and a place you both worked (now-notes/2026-11-06-emails-from-card-facts.md). Built and tested.
- 2026-11-06 **Emails from card facts, checked by sentence.** Each email is about one fact on its card; no decision, episode or idea repeats in a run; companies as the card writes them; two emails may share one sentence at most (now-notes/2026-11-06-emails-from-card-facts.md). Built and tested.
- 2026-11-06 **Specific words, fresh rows, one event one card.** Krish: the drafts were generic and the events weak. Emails come from each card's facts; a run holds two emails alike once names are out (`row_same_words`); a `Shown:` line rotates unseen rows first; one event is one row; forms need a talk, abstract or bio; titles name their subject; clashing employers hold a card (now-notes/2026-11-06-specific-fresh-rows.md). Built and tested; not run live.

- Older changes are in [docs/history/LOG.md](docs/history/LOG.md), moved there word for word on 2026-10-27 to keep this file short.

## What is next and what is waiting on Krish

- **Reader check (2026-11-10):** run it on the next live report's drafts (`npm run reader -- brief --report <file>`), on a machine that keeps runtime/reader/ledger.json, so `calibrate` can score it once 20 sends are 7 days old.
- Krish approved the whole plan on 27 October and asked the session to merge its own pull requests; the brand kit is built. Build order: kit check, Phase 0, Phase 1, Control Center 1.10.0, Phase 1b, then Phases 2 to 5 and the visibility track. Control Center owes protocol 1.10.0 (first the held meetings, the one-tap good prompt and `origin_candidates` that wire the number, then the web part and the show-notes kind), and three approved mindmake-repository changes follow: Analytics events for the brief (marking them as key events is his own change in the Analytics property), tags kept until a visitor answers the banner, and the brief recording its `growth-*` source with the site's privacy page updated. Merging that site change publishes it, so it waits for his yes at the time.
- North Star check (2026-10-28): holds. Control Center now only reads and reports for Mindmake, guest invites lean to volume, and a visit from a growth placement now reaches the brief request (krishanraja/mindmake#255), so the number can be tied to its path; the number itself is still unmeasured, so it stays U4.
- **Next:** read the 05:10 report for the first calendar read of his meetings and measure the number; Krish signs the week spec on Monday 9 November so Phase 5's proof runs can start; the Canva Cowork session finishes C1 and C2, after which this engine attaches `asset_ref` to the one-sheet's link (C3). Waiting on Krish: the bin of the 8 Gmail pilot drafts from an operator session (`scripts/bin-pilot-drafts.mts` in control-center), and the Google Analytics settings (key event `brief_submit`, custom dimensions `brief_route` and `brief_step`).

### Existing integration gates to retain

- After Control Center serves `form_fields` and `forms` in the context with its Submit press (its stage forms change, not yet on its main), run the dispatch once and read back the forms: each on a stage that asked, every answer under a label its own form shows, none to a stage already pitched; then Krish presses Submit on one and the next context's `forms` shows it `submitted` or `confirmed`, or `not_sent` with why. Not live until then.
- After Control Center serves 1.9.0 (krishanraja/control-center#575, which also lets Jonny's box serve the events row), run the dispatch once and read back the pitches: each about a show or a stage with its own address, in Jonny's words, none to one already drafted; then Control Center's drafts in Jonny's Gmail and, later, which ones answer.
- Measure the North Star number and record it on the first line under "Where it is right now".
- After Control Center's 1.6.0 is live, read the first live report with rows and spot-check ten reach figures against their sources.
- The pinned `APPROVED_CANON` in `contracts/growth.ts` no longer matches Mindmake's canon and its 30-day review lapses on 15 November; the snapshot path needs Krish's review of the current canon before then.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- [Trusted-distribution session handoff](docs/history/2026-10-27-growth-session-handoff.md): this session's checkpoint, later-policy precedence and the precise resume boundary.
- `README.md`: what this repository is and how it runs.

## Do not trust

The old trusted-distribution action manifests and Advisory links are historical until reconciled in Control Center. Older "not merged" notes do not override verified later merges. Read current capabilities and decisions before acting; the North Star remains unmeasured rather than zero.
