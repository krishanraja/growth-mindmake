# The daily credits session

Mindmake's share of the prepaid credits (protocol 1.16.0) is spent by one scheduled Claude session a day, not by the runner. The runner on GitHub holds no generator keys. The session has the connectors: Control Center, Apify, ElevenLabs and Podchaser. Its scheduled task, "Spend Mindmake's prepaid credit share", has run daily at 11:37 London since 29 October.

- Ruling (Krish, 2026-10-29): a growth engine may spend up to its placement share each cycle with no per-batch approval (docs/RULINGS.md).
- Ruling (Krish, 2026-10-29): engine credits are spent by one scheduled session per engine, recording each spend through Control Center.
- Ruling (Krish, 2026-10-29): Apify is pay as you go: a ceiling to stay under, never a pool to use up, and engines learn which actors are worth their cost.

This file is the session's whole brief. Read AGENTS.md first, then this file. A scheduled session starts with no repository of its own, so it reads both from main with the Control Center connector's `get_engine_brief` (`{ engine: 'mindmake' }`).

## Each run

1. **Read the share.** Call `get_engine_credits` with `{ engine: 'mindmake' }`.
   - If it answers `held: true`, `credits: null` or an error, stop. Say why in one line. Unknown is never a share of zero, and it spends nothing.
2. **Pace it, by the pool's `mode`.**
   - `use_it` (ElevenLabs, `podchaser-connector`, and any pool with no `mode`): today's budget is `remaining_for_you / days_left`. Inside the last three days before `use_by`, the budget is all of `remaining_for_you`. Credits left at the reset are money lost.
   - `ceiling` (Apify): pay as you go. `remaining_for_you` is the most you may spend until `use_by`, never a target, and there is no pace. Nothing is lost by leaving it; every dollar run is a dollar spent.
3. **Pick the work.** Choose work that moves `good_meetings` (docs/NORTH_STAR.md), best first.
   - **Booking routes, first (integration I-02).** Booking addresses for the shows, stages and guests the rows hold have one owner, the research desk: the runner's daily lookups (up to twelve a run, Ruling, Krish, 2026-10-31) file what they find as `found_routes`. This session adds to them through two Control Center connector tools, and only through them:
     - Call `get_route_gaps` first (`{ limit }`). It names the open stages with neither a booking contact nor a form, oldest first, each as `subject_ref` (`target:<id>`), `kind`, `type`, public `name`, `feed_url` and `site_url`, never an address. If it errors or names none, do no route work this run and say so.
     - Work only those subjects, oldest first. Podchaser connector (`podchaser-connector`, requests): a show's listed contacts and its own site. Every call that is not `get_usage` or `get_reference` costs one request; read `get_usage` at the start and the end, and the difference is the cost. The `job` is `show_check`. Its cycle ends on the date its own `get_usage` shows, which can be a day before the pool's `use_by`; go by the earlier.
     - Apify only where Podchaser and the show's own site leave a gap: read `get_apify_learnings` first, prefer an actor whose verdict is `keep`, give a new actor one `trial` run with the smallest `maxItems` that answers the question, never rerun one whose verdict is `drop`. The cheapest run that answers the question; never a broad sweep, never a bulk scrape of people.
     - File each route with `file_found_route` (`{ subject_ref, kind: 'email' | 'form', value, source_url }`), where `source_url` is the public page the route is literally on. Control Center reads that page again and records the route only by the found_routes rules (on the page, a personal-looking address only beside booking words, a form on the show's own site, never over a route on record). A contact Podchaser lists on no public page is not a route: do not file it. The answer is `recorded: true`, or `recorded: false` with a reason code; report counts by code only.
     - Keep nothing else. What you read is private research, never committed (this repository is public), and a contact found is never emailed from here. The next dispatch sees the recorded route in its context and the hold lifts by its own rule.
     - The `podchaser` pool (the API points) is spent by Control Center's own Podchaser key, not by this session. Read its line, but do not reserve from it.
   - **ElevenLabs:** only drafts that wait for Krish's yes, because it is his cloned voice. Examples are a voice-over for the one-sheet, or a short audio intro a pitch could carry. A draft is never published, posted, sent or shared.
4. **Every generation, in order:**
   1. `reserve_credit_spend` with `{ engine: 'mindmake', pool, amount, asset, objective_key: 'good_meetings' }`.
      - `amount` is the expected cost, from the tool's own quote or the block's `unit_costs`.
      - `asset` says what is made, in words, never an address or a name.
      - A refusal (`over_share`, `held`, `no_pool`, `unknown`, `allowance_first`, `write_failed`) stops that spend. `allowance_first` means a pool behind an included allowance is refused until that allowance is used to its gate.
   2. Run it.
   3. `settle_credit_spend` with the provider's actual cost and its run or generation ids as the receipt. Pass `0` when it failed or nothing was charged, which voids the reservation.
      - For every Apify run, also pass `actor` (the actor id), `job` (one short slug reused across runs, such as `podcast_hosts`), `items` (results returned) and `used` (results you kept). Counts only, never names. This is how the next run learns which actors are worth their cost.
   - Several reservations may be open at once, each off the share (Krish, 2026-11-09: "Just remove the rule entirely"); settle each one when its generation ends. One left open for 24 hours is voided.
5. **Finish** with one line: what was made, from which pools, and what is left until `use_by`. For Apify, say what each run cost and how many results it kept. For routes, say how many gaps were read, how many routes were filed, and how many were recorded or refused, by reason code.

## The walls

- Never past `remaining_for_you`. Never a top-up, a plan change or new money; Apify beyond its included usage is new money.
- Nothing made is published, posted or sent. A draft for Jonny's box or Krish's goes through the existing rows and Control Center's Draft press, never from this session.
- A reservation guards the share only. The approved execution ruling (2026-10-22) still governs every external action.
- Never report a session spend again in a runner report's `credits_spent`. Control Center already counts the reservation, and it would be taken off the share twice.
- This session changes no tracked file. It commits nothing and opens no pull request.
- Krish's instruction to this engine (protocol 1.20.0) does not reach this session: Control Center's connector serves no read of it and no way to ack it yet (docs/CONTROL-CENTER-BRIEF.md). The daily dispatch acts on it and acks it; never guess his instruction here.
