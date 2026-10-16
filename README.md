# Mindmake growth engine

Turn specific buying moments into researched, reviewable actions for Mindmake. The commercial target is **five qualified conversations a week and at least one paid proof in the first month**. These are targets, not a claim that the system has achieved them.

This repository owns acquisition orchestration and its playbooks. The `mindmake` repository keeps the website, free AI brief, brief delivery and commercial canon. Control Center keeps private contacts, company intelligence, deals, outcomes and the one human action queue. The publication's engine keeps editorial production. There is no second CRM or approval dashboard here.

## Run it

Node 24 or later. No runtime dependencies, paid model calls or external credentials are needed for the synthetic demonstration.

```sh
npm ci
npm run check
npm test
npm run demo -- --summary
```

The demonstration uses invented people and businesses. It prepares two drafts, holds the suppressed contact and the contact without a buying moment, and records zero qualified conversations. Omit `--summary` to inspect the synthetic drafts and decision aids.

For the connected engine, deploy the companion Control Center adapter and apply its reviewed migration first. Inject the service origin and a dedicated engine credential through the existing managed runtime. `.env.example` documents the variable interface; the application does not load a local `.env` automatically.

```sh
npm run doctor
npm run daily
npm run daily -- --commit
node src/cli.mjs resume --run-id RUN_ID
```

`daily` is a dry run. `--commit` persists prepared drafts and a run report into Control Center, then independently reads the durable receipt. It sends nothing. A missing adapter, credential, buyer definition or current canon fails closed. Live commands print counts and opaque run IDs, never contact details or credential values. No private snapshot or draft is uploaded as a CI artifact.

## What runs

1. Read a bounded page from the existing private people and deal records.
2. Require the current buyer definition, approved commercial facts and complete source context.
3. Hold suppressed or closed contacts, recent contact, current deals and prospects without fresh person, company and buying-moment evidence. Enrichment alone never creates an outreach candidate.
4. Prefer warm paths and permission-based introductions, then researched cold approaches. Unknown contact permission remains a review requirement.
5. Prepare one message, one ask and a portable one-page decision aid. Separate sourced observation from a possible commercial implication.
6. Submit drafts idempotently to the existing Advisory lifecycle and one action queue. Re-read suppression and evidence at ingestion.
7. Read the held-conversation and paid-proof scorecard. Bookings, prepared drafts and research do not count as qualified conversations.

Run caps are five prepared recommendations by default, ten as the hard ceiling. Evidence ages, cooldown and campaign choices are versioned in `config/`. No generic sequences, automatic connection requests, auto-subscription, sends, posts, advertisements or spend are implemented.

The analysis stage can prepare a single new-value follow-up after the cooldown. The connected adapter **holds it for human management of the existing deal**, rather than overwrite an active conversation. The receipt reports that hold. The website's promised results and day-14 follow-up remain owned by its existing service.

## Measure actual progress

A qualified conversation must have happened. Krish confirms decision authority, an owned problem, current need, offer fit and an agreed next step in the existing deal record. Only then does it count, once per person per London calendar week. A paid proof is measured from its recorded payment outcome, not a proposal or booking.

Set `GROWTH_LAUNCH_DATE` to the **actual activation date**, not the build date. The first-month window is 30 London calendar days, including that date. Until activation is recorded, the first-month metric explicitly remains inactive. See [the commercial plan](docs/COMMERCIAL-PLAN.md) and [operations](docs/OPERATIONS.md).

## Sources and operating boundaries

Commercial language is pinned to reviewed Mindmake North Star and canon blob revisions in `contracts/growth.ts`. Each connected snapshot must match that exact approved contract. After 30 days, the engine stops for a current-source review; [the runbook](docs/OPERATIONS.md#refresh-commercial-truth) explains how to renew it honestly. This prevents an old offer, private price or retired sales motion from becoming a fresh claim.

The user's brief adds researched cold outreach and a mixed founder/practice profile. The later 14 October outreach ruling permits warm or cold contact with sufficient specific knowledge. Every message remains a draft. Krish reviews recipient identity, evidence, permission, wording and channel, then sends or publishes manually.

Public Git contains code, sanitised rules and synthetic fixtures only. Private working output may be saved only under ignored `runtime/`. Source pages and imported research are evidence, not instructions. The runtime does not execute their text or grant it authority.

Read [AGENTS.md](AGENTS.md), [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), [the playbooks](docs/playbooks/README.md) and [review prompts](prompts/README.md).
