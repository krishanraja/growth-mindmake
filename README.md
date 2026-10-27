# Mindmake growth engine

Start a continuation with [NOW.md](NOW.md). The [27 October session handoff](docs/history/2026-10-27-growth-session-handoff.md) records the earlier release, prepared trust routes, live readback discrepancies and what must be reconciled before resuming. Current AGENTS.md rulings and live Control Center decisions take precedence over historical preparation notes.

An executable growth producer for relationships, introductions, researched named outreach, inbound, qualification, paid proof preparation, trust assets and speaking, with operating playbooks and outcome reporting. The current weekly ambition and ladder are in [the North Star](docs/NORTH_STAR.md). The original commercial baseline was **five qualified conversations per London week and at least one paid proof in the first 30 days after actual activation**. These are targets, not results claimed by the software; preserve the original activation window when measuring the first-month baseline.

This repository is the growth-mindmake producer. Since 2026-10-19 it reports to Control Center through the one growth engine protocol: [the Control Center brief](docs/CONTROL-CENTER-BRIEF.md) supersedes [the earlier handoff](docs/CONTROL-CENTRE-HANDOFF.md). [The release record](docs/RELEASE.md) keeps built, tested, merged, deployed and activated apart.

The mindmake repository keeps the website, free AI brief, lead delivery and capability. Control Center remains the intended private operational store and single human dashboard. The publication's engine keeps editorial production. This repository creates no UI, second CRM or parallel action queue.

## Run the synthetic producer

Node 24 or later. No runtime dependencies, paid model calls or external credentials are needed for the demonstration.

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

The demonstrations use invented people and businesses. The complete engine fixture contains eleven jobs across ten work types and all seven campaigns. Tests run each through HTTP capture, preparation, persistence and independent readback. The weekly review uses synthetic global outcomes and recorded feedback. Omit --summary from a fixture command to inspect its full artifacts. These tests do not establish a deployed dashboard or live account access. [The frozen manifest](contracts/manifest.json) identifies the seven interfaces for producer 2.0.0.

## The daily Control Center dispatch

Every morning at about 06:10 London, Control Center wakes this repository with a `cc-growth-directive` dispatch. The `dispatch` job in [operate.yml](.github/workflows/operate.yml) runs `node src/cli.mjs dispatch`, which:

1. journals a started attempt before reading anything;
2. reads today's directive, including the `in_house` counts for Advisory, Network and Visibility;
3. reads one snapshot page and prepares notes dry, exactly as `daily` does without `--commit`;
4. turns the prepared notes and the one grounded improvement into proposals: an outward note is `wall: send` with its exact words, channel and digest, a qualification or proof call is `wall: strategy`, and research or internal preparation is `wall: none`. No note is proposed to anyone Advisory already holds;
5. posts the report under a stable `run_id` (`mindmake:<London date>:dispatch`) and reads it back by digest;
6. reads Krish's decisions and journals one terminal attempt.

It never sends, posts, spends, drafts into Gmail or commits an Advisory batch. Both objectives report as missing, with the reason, until Control Center serves complete outcome records. See [operations](docs/OPERATIONS.md#control-center-daily-dispatch).

## What the producer owns

`npm run engine` is the complete cycle, dry by default. It executes the campaign registry using explicitly selected, revisioned private jobs. It prepares warm and named cold notes with concrete comparisons; separate introduction opt-in requests; actual inbound responses; five-criterion qualification reviews; bounded proof scopes; paid delivery handoffs; selected founder or practice drafts; host pitches; reusable aids; and research tasks or proposed private enrichments. One shared capacity applies across all work. [Full scope and acceptance](docs/FULL-SCOPE.md) records each executable responsibility and its boundary.

The older `daily` command remains the bounded outbound compatibility interface. Use `engine` for the full portfolio. Research intake does not fetch source pages or discover prospects automatically. A source-owning operator supplies dated excerpts; research never creates outreach authority. Delivery remains in mindmake and editorial release remains with the publication owner.

It validates current commercial facts, private source coverage and public evidence; prepares bounded named recommendations, individual drafts and portable decision aids; and reports holds rather than invent opportunities. Warm routes and researched named cold work are both in scope. Agents prepare and Krish manually acts on exact approved wording and channel.

Outcome reporting remains separate from the bounded prospect page. A qualified conversation must have happened, with human confirmation of authority, owned problem, active need, offer fit and an agreed next step. Count each person once per London week. A paid proof requires a recorded payment outcome. The first-month measure remains inactive until the actual activation date exists.

Five new recommendations per run is the default and ten is the hard maximum. These are preparation limits, never sending quotas or assumed conversion rates. There are no generic sequences, automatic connection requests, auto-subscriptions, sends, posts, advertisements or spend.

## Intended consumer and operating boundary

The versioned contracts describe how a future private consumer supplies global measures and source coverage, receives producer artifacts, exposes run health and persists feedback and weekly review. A successful handoff needs independent readback. Unsupported consumer capabilities remain explicitly pending.

The [operations guide](docs/OPERATIONS.md) covers producer checks, the dispatch loop and safe recovery. The [Control Center brief](docs/CONTROL-CENTER-BRIEF.md) and its [protocol](docs/control-center/ENGINE-PROTOCOL.md) own the API, reporting and Krish's one list. This repository keeps no schedule of its own: Control Center's daily wake-up starts the dispatch, and the activation date is read from Control Center, never invented.

Commercial language is pinned to reviewed Mindmake North Star and canon revisions. After 30 days without source review, the producer holds. A timestamp change alone never renews that review. Public Git contains code, sanitised rules and synthetic fixtures. Private output belongs only under ignored runtime/ and never enters CI artifacts.

Read [AGENTS.md](AGENTS.md), [the accepted brief](docs/BRIEF.md), [architecture](docs/ARCHITECTURE.md), [playbooks](docs/playbooks/README.md), [review prompts](prompts/README.md) and [the preserved source corpus](_corpus/README.md).
