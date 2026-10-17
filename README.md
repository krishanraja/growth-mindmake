# Mindmake growth engine

An executable growth producer for relationships, introductions, researched named outreach, inbound, qualification, paid proof preparation, trust assets and speaking, with operating playbooks and outcome reporting. The commercial target is **five qualified conversations per London week and at least one paid proof in the first 30 days after actual activation**. These are targets, not results claimed by the software.

This release completes **growth-mindmake only**, then delivers [one Control Center implementation handoff](docs/CONTROL-CENTRE-HANDOFF.md). [The release record](docs/RELEASE.md) separates producer verification from consumer implementation, deployment and activation. No actual Control Center work is part of this task. Earlier companion code is an unmerged proposal.

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

## What the producer owns

`npm run engine` is the complete cycle, dry by default. It executes the campaign registry using explicitly selected, revisioned private jobs. It prepares warm and named cold notes with concrete comparisons; separate introduction opt-in requests; actual inbound responses; five-criterion qualification reviews; bounded proof scopes; paid delivery handoffs; selected founder or practice drafts; host pitches; reusable aids; and research tasks or proposed private enrichments. One shared capacity applies across all work. [Full scope and acceptance](docs/FULL-SCOPE.md) records each executable responsibility and its boundary.

The older `daily` command remains the bounded outbound compatibility interface. Use `engine` for the full portfolio. Research intake does not fetch source pages or discover prospects automatically. A source-owning operator supplies dated excerpts; research never creates outreach authority. Delivery remains in mindmake and editorial release remains with the publication owner.

It validates current commercial facts, private source coverage and public evidence; prepares bounded named recommendations, individual drafts and portable decision aids; and reports holds rather than invent opportunities. Warm routes and researched named cold work are both in scope. Agents prepare and Krish manually acts on exact approved wording and channel.

Outcome reporting remains separate from the bounded prospect page. A qualified conversation must have happened, with human confirmation of authority, owned problem, active need, offer fit and an agreed next step. Count each person once per London week. A paid proof requires a recorded payment outcome. The first-month measure remains inactive until the actual activation date exists.

Five new recommendations per run is the default and ten is the hard maximum. These are preparation limits, never sending quotas or assumed conversion rates. There are no generic sequences, automatic connection requests, auto-subscriptions, sends, posts, advertisements or spend.

## Intended consumer and operating boundary

The versioned contracts describe how a future private consumer supplies global measures and source coverage, receives producer artifacts, exposes run health and persists feedback and weekly review. A successful handoff needs independent readback. Unsupported consumer capabilities remain explicitly pending.

The [operations guide](docs/OPERATIONS.md) covers producer checks and safe recovery. The [consumer handoff](docs/CONTROL-CENTRE-HANDOFF.md) owns downstream API, reporting, one action list, rollout and acceptance requirements. This release enables no recurring schedule and invents no activation date.

Commercial language is pinned to reviewed Mindmake North Star and canon revisions. After 30 days without source review, the producer holds. A timestamp change alone never renews that review. Public Git contains code, sanitised rules and synthetic fixtures. Private output belongs only under ignored runtime/ and never enters CI artifacts.

Read [AGENTS.md](AGENTS.md), [the accepted brief](docs/BRIEF.md), [architecture](docs/ARCHITECTURE.md), [playbooks](docs/playbooks/README.md) and [review prompts](prompts/README.md).
