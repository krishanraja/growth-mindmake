# Control Center brief: growth-mindmake

Written 2026-10-18 by Control Center. This brief **supersedes `docs/CONTROL-CENTRE-HANDOFF.md`** as the contract between this engine and Control Center. Krish ruled that every growth engine reports through one protocol and conforms to it, rather than Control Center building a receiver per engine (ADR-038 in Control Center).

## What Control Center now does for you

- **Pushes you one next action every day.** It is chosen by rule, in this order:
  1. what Krish approved
  2. a repair
  3. your unwalled proposal that closes the widest gap to an objective
  4. otherwise, waiting on him
  5. otherwise, naming the gap
- **Puts what only Krish can do on his one list on Home.** This means every message to send, every spend and every strategy call, and returns his decision to you bound to the exact payload.
- **Shows your health, objectives, today's push and what you did** on Growth > Engines, next to the other five engines.

## Control Center already grows Mindmake: work with it

Krish, 2026-10-18: Control Center's Visibility tab, Network and Advisory are a huge driver of Mindmake's growth. They are not this engine's to rebuild. They are its partners.

| Lane in Control Center | What it already does | What this engine does with it |
|---|---|---|
| **Advisory** (`pilot_deals`, People > Advisory) | Drafts the note to a named person into Gmail. Krish sends it. It then tracks sent, replied, call booked, call taken, pilot booked and pilot paid | Never drafts a second note to someone Advisory holds. Propose who should get a note next, and why now, as a `strategy` proposal. When Advisory's counts move (sent, call booked, paid), use them as your evidence |
| **Network** (warm tiers, warm paths) | Knows who Krish knows, how well, and the warm path to a person, a show or a room | Starts every proposed approach from a warm path or a named room, which is your aim. A stranger with nothing known stays "no path yet" |
| **Visibility** (stages, rooms, podcast pitches) | Finds stages with open calls and rooms in his city, and drafts pitches | Proposes which stage or room serves a paid proof. Never a second pitch to a show Visibility already pitched |

Every directive carries `in_house: { rule, counts }`, this week's Advisory, Network and Visibility counts as Control Center reads them, with no names. Growth > Engines shows the same counts on your card. Read them before you propose. A part that could not be read is `null`, never zero.

## Your registry row

| | |
|---|---|
| Slug in the path | `mindmake` |
| `engine_id` | `growth-mindmake` |
| `product_slug` | `mindmake` |
| Aim | Every paid proof starts from a warm path or a room, never a list, and leaders arrive already asking for the brain because someone they trust told them. By 2026-11-30 |
| Objectives | `qualified_conversations`: target 5 people per week (Europe/London); `paid_proofs`: target 1 in the first 30 days (Europe/London) |
| Cadence | daily |
| State | Switched on 2026-10-18, with dispatch on. Your bearer arrives in this repository's secrets as `CONTROL_CENTER_ENGINE_TOKEN`, with `CONTROL_CENTER_URL` as a variable. Until then, build against `mode: synthetic` |

## The protocol, in short

The full spec is `docs/control-center/ENGINE-PROTOCOL.md`, with the report and directive schemas and a worked example beside it. In short:

**Base URL and auth.**
- Base: `CONTROL_CENTER_URL`, which is `https://controlcenter.krishraja.com`.
- Bearer: `Authorization: Bearer $CONTROL_CENTER_ENGINE_TOKEN`. This is a `gen1_` token issued for this engine alone. Control Center keeps only its SHA-256, and it opens this engine's routes and no others.
- Transport: HTTPS only. Follow no redirects, use bounded timeouts, and read back before retrying any write.

**Every run, in this order:**
1. `POST {base}/api/growth/engines/mindmake/attempts` with `status: started`, before reading any source.
2. `GET {base}/api/growth/engines/mindmake/directive` returns today's `next_action`, your objectives with their targets and latest values, his decisions of the last seven days, and the walls.
3. Do the work, inside the walls. The rule, word for word: "Nothing sends, posts, spends, deletes or changes a permission without a decision from Krish whose payload_sha256 matches what you are about to do."
4. `POST {base}/api/growth/engines/mindmake/reports` with header `Idempotency-Key: {run_id}`. The body is the report envelope:
   - `schema_version: "1.0.0"`, `engine_id`, `product_slug`, `run_id`, `mode`, `observed_at`, `source`, `status`
   - `objectives[]`, `activity[]`, `proposals[]`, `events[]`, `holds[]`
   - `payload_sha256`: the SHA-256 of the canonical JSON without that field, with keys sorted at every depth and no whitespace

   An unknown field is refused, never dropped. Then `GET .../reports/{run_id}` and compare the digest.
5. `POST .../attempts` again with the terminal state (`succeeded`, `failed` with a lower_snake `error_code`, or `unknown`) and `finished_at`. A terminal record never changes.
6. `GET {base}/api/growth/engines/mindmake/decisions?since={last run}` returns his yes and no, each with the `payload_sha256` it was made on. Act on a yes only when that digest equals the payload you are about to use. A changed payload is a new ask, and it goes back to him by itself when you report it.

**How proposals and readings are judged.**
- A proposal behind a wall (`spend` with its `amount_usd`, `send` or `post` with its `exact_payload`, or `strategy`) goes on Krish's one list on Home, where Clear approves it, Purge declines it and Bump defers it a day.
- A proposal inside the walls is yours to do. Control Center may pick it as your next push.
- Unknown is `value: null` with a `reason`, never zero. A measured zero is `0`.
- `mode: synthetic` is stored and read back but never touches his numbers or his list. Use it to prove your client before Krish switches you on. A live report is refused (409 `engine_inactive`) until he does.

**The wake-up.** Control Center wakes you once a day around 06:10 London with `repository_dispatch` of type `cc-growth-directive`, whose `client_payload` is `{ directive_id, engine_id }` and nothing else. Add that trigger to your workflow. If you do not run on GitHub Actions, pull the directive at the start of your own run instead; it is the same directive.

## How your old handoff maps

| Your contract | In the protocol |
|---|---|
| `Attempt` (`gma-…`, `started` then one terminal state, `error_code` allowlist) | `POST attempts`, unchanged in meaning. Keep your ids and codes |
| Per-run `DashboardReport` (selected page, provisional) | A report with `status: held` or `ready`. Put the global measures in `objectives` only when they cover every Mindmake outcome record in the window; otherwise send `value: null`, `availability: missing` and the reason. A page count is never the headline |
| `WeeklyReview` and its one `Improvement` | A report from your `weekly-review` command, with the improvement as one proposal. Its `close_condition.event` is your matching persisted event (`promise_fulfilment_recorded`, `proof_decision_recorded`, …) |
| `WorkItem`s (outreach, introduction, trust, speaking drafts) | Proposals. An outward message to someone Advisory does not hold is `wall: send` with `exact_payload` and `channel` (`email` or `linkedin`); one to someone it does hold goes through Advisory instead. A speaking draft for a stage Visibility found is a proposal on that stage. A qualification or proof decision is `wall: strategy`. Research and internal prep are `wall: none` |
| `ReviewContext.feedback` (accepted, bumped, declined, completed) | `GET decisions`, plus the `decisions_since` in each directive. Bump is not returned: a bumped item stays pending and returns to his list the next day |
| `Capabilities` and digests | `GET capabilities`. Keep pinning your seven contract digests on your side |
| Activation date | `capabilities.activation.activated_on`, which Krish sets when he switches you on. Never infer it |

## What you build now

1. A Control Center client for the six calls above, behind your existing dry-run default. Writes happen only with `--commit`.
2. The `cc-growth-directive` trigger on your runner workflow. Without it, pull the directive at the start of each run.
3. A mapping from your Improvement and WorkItem outputs to proposals, with stable `proposal_id`s (for example `gmi-…`) and `payload_sha256` over the exact outward payload.
4. A synthetic run that posts a report with `mode: synthetic` and reads it back. Prove it against the worked example's digest first.
5. Global measures computed on your side, in Europe/London weeks with each local boundary converted on its own. Report them as objectives, or as missing with the reason.

## What you stop

- **Expecting the rest of the 13 routes.** Control Center built the first of them in PR 469 (merged 2026-10-18), and they stay: `GET /api/growth/mindmake` (the snapshot), `POST /api/growth/mindmake` (a draft batch that lands as Advisory notes in `pilot_deals`, for Krish to send) and `GET /api/growth/mindmake?run_id=` (its receipt), all on the shared growth credential. Use that path for any note to a named person: it is Advisory's own door. The `work`, `operations` and `report` routes will not be built. Your attempts, reports, push and his decisions go through this protocol instead.
- **Sending, scheduling or spending yourself.** Unchanged.

## Still owed by Control Center (named, not built)

- Global outcome reads from Control Center's own deals (qualified conversations, paid proofs), so you need not compute them from a page.
- The Gmail draft readback close.

## Acceptance

- A synthetic report is accepted, replays with the same acknowledgement, and reads back with the same digest.
- A second report under the same `run_id` with a different payload is refused with a 409.
- A failed run leaves started plus failed attempts, and Growth > Engines shows it failing beside the last success.
- An outreach proposal reaches Krish's list. His Clear appears in `GET decisions` with the payload digest you sent. Change one word and report again: it is pending again.
