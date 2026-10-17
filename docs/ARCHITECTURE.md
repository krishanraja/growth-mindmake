# Architecture

This repository implements the growth producer and its client protocol. The
Control Center consumer is a separate handoff: the requirements below are not
claims that its database, endpoints or dashboard have been implemented or
activated. Local synthetic service tests prove producer behavior only.

```text
Consumer-provided bounded context
    -> current canon, buyer definition and evidence guards
    -> relevant prospect and route
    -> proposed message and decision aid
    -> page-scoped report and one grounded improvement
    -> authenticated consumer handoff and independent readback

Consumer-provided complete review context and feedback
    -> global weekly review
    -> persisted review and independent readback
```

## Implemented producer

The producer is stateless between runs. It keeps no CRM, approval interface,
durable attempt ledger or outcome database. Semantic source content, policy,
London operating day and prepared artifacts determine a daily run's identity;
delivery timestamps do not create a new identity. A weekly review includes
the complete review context and recorded feedback in its identity.

The client uses one configured server bearer. GitHub Actions maps the existing
`GROWTH_ENGINE_TOKEN` secret into the client interface
`MINDMAKE_GROWTH_TOKEN`. Requests use credential-free HTTPS origins, reject
redirects and omit private response bodies from diagnostics. No method grants
sending, publication, spending, payment or human-qualification authority.

Evidence has public or private scope. Prepared outward artifacts use public,
dated evidence only. The report contains bounded opaque source identities
and counts rather than names, contact addresses or private research facts.
An introduction proposal identifies the prospect and actual recipient
separately; a name alone never establishes identity or permission.

The optional `report.dashboard` describes only the selected contact page.
Its provisional outcome totals must never be presented as global progress.
The producer emits at most one improvement, with accountable ownership and
a required matching persisted completion event. A declining count or an item
disappearing from another page is not completion proof.

Improvement destinations are semantic IDs: `growth`, `advisory` and
`waiting_list`. They are not URLs. The consumer must map them through its
existing route helpers and action surfaces.

## Complete campaign cycle

`src/engine.mjs` routes the executable registry and ten strict job kinds through
the motions, lifecycle and research stages. It preserves one disposition for
each of at most 100 selected inputs, one capacity across all campaigns, source
lineage, exact recipient, pending approval and matching-event closure. It emits
a private WorkBatch with selected-context coverage. It creates no global
commercial result. The `engine` CLI and runtime persist it through the work
transport with the existing attempt journal and independent full readback.

The older orchestrator and `daily` command retain the outbound compatibility
path. They hold existing replied, held and paid opportunities because those
records belong to explicit lifecycle jobs in the complete engine. No separate
state store or duplicate outbound eligibility implementation is introduced.

## Canonical protocol directory

The consumer must vendor these seven files together, unchanged, preserving
their directory layout and relative imports:

- `contracts/growth.ts`: bounded snapshots, reviewed commercial descriptions,
  prepared batches and semantic identities.
- `contracts/reporting.ts`: provisional dashboard reports and grounded
  improvements with strict ownership and closure references.
- `contracts/operations.ts`: capabilities, attempts, complete review context,
  weekly commercial learning and feedback shapes. It imports `./reporting.ts`.
- `contracts/engine.ts`: complete context, strict private work artifacts,
  campaign routing, exact disposition counts and semantic work replay.
- `contracts/motions.ts`: outreach, trust, speaking and reusable aid inputs.
- `contracts/lifecycle.ts`: introductions, inbound, qualification, proof scope
  and paid delivery handoff inputs.
- `contracts/research.ts`: explicit questions and attributed source-ledger inputs.

The readiness handshake compares the exact SHA256 bytes of all seven files
and requires every named capability. Unsupported consumer endpoints report
pending integration; refused authentication remains a failure. Live commits
also require the consumer's canonical activation date.

## Consumer requirements, pending handoff

The consumer must implement the existing lifecycle boundary without a second
contact database, CRM or action queue. It must re-read suppression, relevant
evidence, buyer criteria, cooldowns and permission uncertainty at ingestion,
and either create an existing lifecycle record or explicitly hold each
recommendation. Introduction and follow-up support must be proven or held.

It must atomically reserve a semantic run, enforce the daily cap, ingest its
records and persist the entire consumed report. A receipt must account for
every prepared recommendation as created or held. The client compares the
write receipt with independent readback. It never retries the original
mutation after an ambiguous response; `resume` reads its durable receipt.

The proposed daily protocol uses `/api/growth/mindmake`: bounded snapshot
reads, batch ingestion and run receipt reads. The proposed operations
protocol uses `/api/growth/mindmake/operations` for capabilities, durable
attempts, complete review context and persisted weekly reviews. These paths
are handoff requirements, not deployment assertions.

The consumer must persist start and terminal attempt states, distinguish
failure, ambiguity, staleness and no run, and keep private reports behind its
human-authenticated reporting boundary. Browser-readable fleet heartbeats
must contain only safe aggregates. Reports and recommendations must be
visible through existing Control Center surfaces, with one action list and
durable human feedback.

Authoritative progress must be derived from the complete lifecycle, not a
contact page: five distinct human-qualified conversations per London week,
and one paid proof in the first 30 London calendar days beginning at the
actual activation date. Qualification requires a completed conversation and
the five human-confirmed criteria. Inactive and expired first-month windows
must be stated honestly. Gmail and LinkedIn completion need their own
observable evidence; a missing email cannot become a fabricated mail close.

## Dependencies and verification

Node 24 supplies fetch, the test runner and erasable TypeScript loading.
There are no runtime packages or direct model-provider calls. Collection
agents supply evidence; missing or stale evidence produces a research hold.

The stage manifest declares producer ownership and executable handoffs.
Its conformance checker verifies the declared topology; independent tests
exercise domain rules, strict parsers, authenticated transport, idempotency,
lost-response recovery and final synthetic destination readback. Production
consumer compatibility, human visibility and activation require separate
verification after that handoff is implemented.
