# The daily credits session

Mindmake's share of the prepaid credits (protocol 1.16.0) is spent by one scheduled Claude session a day, not by the runner. The runner on GitHub holds no generator keys. The session has the connectors: Control Center, Apify and ElevenLabs.

- Ruling (Krish, 2026-10-29): a growth engine may spend up to its placement share each cycle with no per-batch approval (docs/RULINGS.md).
- Ruling (Krish, 2026-10-29): engine credits are spent by one scheduled session per engine, recording each spend through Control Center.

This file is the session's whole brief. Read AGENTS.md first, then this file.

## Each run

1. **Read the share.** Call `get_engine_credits` with `{ engine: 'mindmake' }`.
   - If it answers `held: true`, `credits: null` or an error, stop. Say why in one line. Unknown is never a share of zero, and it spends nothing.
2. **Pace it.** For each pool, today's budget is `remaining_for_you / days_left`. Inside the last three days before `use_by`, the budget is all of `remaining_for_you`. Credits left at the reset are money lost.
3. **Pick the work.** Choose work that moves `good_meetings` (docs/NORTH_STAR.md), best first.
   - **Apify:** booking routes, hosts and organisers for the podcasts and stages the five rows work on. Use existing Store actors before anything new.
     - Results are private research. They go back through Control Center or stay under ignored `runtime/`, and are never committed (this repository is public).
     - Never a bulk scrape of people.
   - **ElevenLabs:** only drafts that wait for Krish's yes, because it is his cloned voice. Examples are a voice-over for the one-sheet, or a short audio intro a pitch could carry. A draft is never published, posted, sent or shared.
4. **Every generation, in order:**
   1. `reserve_credit_spend` with `{ engine: 'mindmake', pool, amount, asset, objective_key: 'good_meetings' }`.
      - `amount` is the expected cost, from the tool's own quote or the block's `unit_costs`.
      - `asset` says what is made, in words, never an address or a name.
      - A refusal (`over_share`, `held`, `no_pool`, `unknown`, `open_reservation`) stops that spend.
   2. Run it.
   3. `settle_credit_spend` with the provider's actual cost and its run or generation ids as the receipt. Pass `0` when it failed or nothing was charged, which voids the reservation.
   - One reservation is open at a time: settle before the next.
5. **Finish** with one line: what was made, from which pools, and what is left until `use_by`.

## The walls

- Never past `remaining_for_you`. Never a top-up, a plan change or new money; Apify beyond its included usage is new money.
- Nothing made is published, posted or sent. A draft for Jonny's box or Krish's goes through the existing rows and Control Center's Draft press, never from this session.
- A reservation guards the share only. The approved execution ruling (2026-10-22) still governs every external action.
- Never report a session spend again in a runner report's `credits_spent`. Control Center already counts the reservation, and it would be taken off the share twice.
- This session changes no tracked file. It commits nothing and opens no pull request.
