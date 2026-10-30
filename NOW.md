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
- 2026-10-30 **Found routes go out at 1.18.0** (krishanraja/control-center#636; protocol copies refreshed). Sent only where the flag and 1.18.0 are served; Control Center's answer is counted in the printed outcome, never an address. Built and tested; not run live.
- 2026-10-30 **An answered lookup is read, not left waiting.** The research desk answered all 22 lookups of 29 October with results in `evidence` and an empty `answer`, and the run still called them waiting. src/stages/routes.mjs now reads those results by fixed rules (an address on the subject's own site, a role address first, never a third party's, a hosting platform's or a guessed one; a site inferred only from a label that is the subject's whole name; a personal address only on a declared site with booking words in its own sentence; else a stage's own form page), holds each subject as `address_found`, `form_found` or `lookup_found_nothing`, asks a found-nothing lookup again in other words at most once a day, and counts only an unanswered lookup as waiting. A found route reaches Control Center only once it takes `found_routes` (docs/CONTROL-CENTER-BRIEF.md), since a pitch names its recipient by contact id; until then it is held as `found_routes_unrecorded` and no address leaves the engine. Built and tested; not run live.
- 2026-10-29 **Apify is a ceiling.** A cap, not a target (docs/CREDITS-SESSION.md).
- 2026-10-29 **Credits are spent by a daily session (docs/CREDITS-SESSION.md).** The runner reads `credits` where served, says what is left and spends nothing (src/stages/credits.mjs); one scheduled session a day spends Mindmake's share of Apify and ElevenLabs, reserving and settling each spend through Control Center's connector. Built and tested; the session is not yet run live.
- 2026-10-29 **Prepaid credits, protocol 1.16.0 (Ruling, Krish, 2026-10-29).** The copied protocol and schemas now carry Control Center's `credits` block in the directive and the optional `credits_spent[]` in the report; the engine may spend up to its share of ElevenLabs and Apify each cycle with no per-batch approval and report what it made, and nothing made is published, posted or sent without its own approval (docs/CONTROL-CENTER-BRIEF.md, Prepaid credits). The schema checkers now follow the copied schema's `$ref`, `uniqueItems` and map entries.

- 2026-10-29 **The good-meetings count may stay public** (docs/RULINGS.md): Control Center may write it into the state line; tests/rulings.test.mjs accepts only a rewrite in its reader's shape. Nothing measured yet.
- 2026-10-29 **When work stalls the engine pushes, and wins lift the rank.** Every report carries a `Lanes:` line (each lane's output and the pool) that later runs read back from Control Center's recent reports. A lane at 0 for three runs puts one strategy ask a week on his list (`gml-`); a pool that has not grown in three runs asks the research desk for new shows and stages; an open plan (an approved `gmc-` plan or this week's signed spec) gets a `check_in` every other day, and his Purge on one stops the plan itself (no more check-ins, no prepared action, a stopped spec not in force); a lane a cap left at 0 (Jonny's ten a day, a run's share, the report's 40) reads `capped`, never starved; and a pitch answered or booked, or a good meeting from a row he carried out, lifts what is like it (src/stages/momentum.mjs, src/stages/wins.mjs). Built and tested; not yet run live, and the history needs Control Center's `features.recent_reports`.
- 2026-10-29 **Urgency raises volume, and every report leads with the gap (Ruling, Krish, 2026-10-29).** The first activity line is now "Gap: good meetings X of Y this week, U-n, short by Z", unknown where unknown. At U3 and above, on a week with no signed spec in force, the rows go to 8 a row, guest invites to 4 a run and 8 a week and forms to 4 a row, the bounds config/policy.json already held (`intensity` block, src/stages/intensity.mjs); a signed spec keeps the caps he set, nothing rises when his decisions could not be read, his version could not be used, he stopped the spec or the policy is unsafe, a full report drops the lowest-ranked row actions before any pitch, invite or form, and no wall, fit floor or Jonny limit moves. Built and tested; not yet run live.
- 2026-10-29 **A missing address is looked up in the same run.** A podcast or stage held only for `no_booking_address`, and a guest held only for `no_email` or `no_contact`, now files a bounded `search` lookup through Control Center's research desk (at most four a run, a stage, a podcast and a guest taking turns; never re-asked while Control Center's context holds one waiting or answered, otherwise at most once a London day, each attempt under its own id so a resend never breaks the run's research), counted as `lookups_asked` inside `research_asked`. The hold keeps its code until Control Center records the address, and a found one still goes through his yes and the network rule. Built and tested; not run live, and an address only clears a hold once Control Center records what a lookup found on the stage or the guest's route.
- 2026-10-29 **Every row and pitch aims at good meetings.** The five rows, podcast and speaking pitches, guest invites and stage forms name `good_meetings` as their objective (`OBJECTIVE` in src/stages/rows.mjs, `north_star` in config/policy.json, its target and deadline tested against docs/NORTH_STAR.md), so Control Center weighs them by the gap Krish counts; qualified conversations stay a reported subset. The golden digests were re-recorded after mapping the key back reproduced every earlier one. Built and tested; not run live.
- 2026-10-28 **Anyone inside his network is emailed only by him (Ruling, Krish, 2026-10-28).** No guest invite, podcast or stage pitch or show-notes note goes to Jonny's box for someone Control Center's `routes[id].in_network` says is in his network, or cannot say about (`jonny_network_unknown`, counted), except a show's own booking address that no network list names; someone inside it gets the same invite or pitch on his own row, in his own words and signed by him (`network_is_krish` on Jonny's lane), and a show-notes note to such a host is held. Until Control Center serves `features.network_routes`, Jonny invites no guest: built and tested, not run live.
- 2026-10-28 **A visit from a growth placement now reaches the brief request.** krishanraja/mindmake#255 records `utm_source` and `utm_medium` (the `growth-<path>` shape only) on the brief request, and /privacy says so (Ruling, Krish, 2026-10-28); proved live on the canary inbox and cleaned to zero.
- 2026-10-28 **Control Center reads and reports; this engine decides (plan section 12 done).** krishanraja/control-center#596 retired Control Center's last Mindmake decisions (M6, M9, M10, M12, M13) and added per-recipient SendLinks links (C3, Control Center's side). mindmake.co carries GA4 events for the brief's steps and keeps this engine's `growth-*` tags through `/start` until consent (krishanraja/mindmake#254); recording the tag on the brief request waits on his read of one privacy-page line.
- 2026-10-28 **A merge to the engine's source re-runs the dispatch at once.** His widget went empty after the guest-invite change merged at about 02:15: every row proposal names `src/stages/pitches.mjs` among its sources, and Control Center rightly hides words whose source moved. A run at 02:43 rewrote 26 row proposals at the current sources, and `operate.yml` now runs the dispatch on any merge to main that changes `src/`. The pinned `APPROVED_CANON` lapses on 15 November by decision: it gates only the snapshot route, which the live dispatch no longer uses.
- 2026-10-28 **Guest invites lean to volume (Rulings, Krish, 2026-10-28).** A show with no one left to invite gives its room to the other inside the week's total, a tie goes to the stronger guest on the three axes, and a past Signal & Noise guest may be invited onto Make Your Mind Up; Control Center's Monday drafting for Mindmake is being retired and the post-link backfill ran once under a 5 dollar cap. Plan step 2 is superseded: the live route holds no snapshot prospects.
- 2026-10-28 **Control Center serves the places inputs and accepts the suppression list (krishanraja/control-center#593), read back live.** The 01:03 UTC live run sent `suppression` and `taxonomy`, accepted; suppression agreed on 340 of 340 checks and places on 174 of 176 probes. The focus playbooks' shadow now reads the home city Control Center serves, so its rooms are compared too.
- 2026-10-28 **The suppression list and taxonomy go out where Control Center applies them (plan section 12, M10).** The report carries `suppression` and `taxonomy`, both or neither, on a run where Control Center's capabilities say `features.suppression`; until then nothing changes. The 28 October live run read back the M7, M10 and M13 shadow lines: suppression agrees on every check, Control Center's focus plays disagree with the engine on every Mindmake pick, and places wait on context Control Center does not serve yet.
- Older changes are in [docs/history/LOG.md](docs/history/LOG.md), moved there word for word on 2026-10-27 to keep this file short.

## What is next and what is waiting on Krish

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
