# Full producer scope

The original request is a growth engine for Mindmake, with runnable software
and operating playbooks. The outbound draft pipeline was a useful foundation;
it did not execute the whole acquisition portfolio. The full-engine entry
point adds the missing research, relationship, inbound, commercial and asset
work without introducing another CRM, provider, scheduler or human interface.

## Build boundary and proof

| Field | Current build record |
| --- | --- |
| Target | The `growth-mindmake` producer repository only |
| Starting revision | `9bedf7c2aa2ed4fa28468c5867d6a1d364adaa7e` on main |
| Observed local runtime | Windows, PowerShell, Node 24 |
| Source of truth | Versioned contracts and supplied, revisioned private consumer context |
| Authority | Local producer implementation and synthetic verification; no consumer changes or external actions |
| Pass signals | Every selected input has one disposition; every campaign can produce its real artifact; shared bounded capacity; strict provenance and action gates; replay-safe persistence with independent readback |
| Rollback boundary | Preserve the prior revision above; a future release owner may restore that producer artifact through the normal review process. This build has no production migration to undo. |
| Readback | Synthetic consumer tests exercise the producer protocol. Production consumer implementation, deployment, activation and human visibility remain separately pending. |

The release record owns final commands, revisions and overall verification
status. This matrix describes executable producer responsibilities and their
limits, rather than claiming the business targets have been achieved.

## Executable coverage

| Work | Input and executable result | Human or downstream boundary |
| --- | --- | --- |
| Warm relationships | A named job, actual permitted relationship context and a decision comparison produce a warm note and aid. | A network tier alone grants no permission. Krish reviews the exact action. |
| Named cold opportunities | An explicit named brief, current person/company/decision evidence, calibrated hypothesis, ordinary alternative and usable comparison produce an individual draft. | Enrichment alone creates no action; contact eligibility and suppression remain gates. |
| Useful follow-up | An existing sent action, cooldown and genuinely new sourced value permit one prepared addition. | Silence alone is insufficient; no sequence or scheduled send exists. |
| Introductions | Separate, dated permission states prepare the appropriate connector request, recipient permission request or agreed introduction. | One opt-in never fills the other. Neither the artifact nor its preparation connects people. |
| Inbound | An actual unhandled request and delivery state produce a scoped response or service-owner review. | The existing brief service keeps delivery; duplicate service messages are held. |
| Conversation qualification | An actual conversation record and five evidenced yes/no/unknown checks produce a qualification review with missing questions. | Only a separately persisted human confirmation can count a held conversation. |
| Proof scoping | An actual private decision packet produces a one-decision scope with inputs, exclusions, client ownership, acceptance criteria and evidenced next step. | No fee, date, acceptance or payment is invented; commercial terms remain private source references. |
| Paid proof delivery | Matching accepted scope and verified payment for the same proof produce a capability-owner handoff. | Refunded, revoked, mismatched or already delivered work is held. Delivery stays in Mindmake. |
| Trust assets | A supported argument, exact current surface, placement rights and a comparison produce a selected founder, practice or commentary draft. | Private material cannot become a public claim; no first-person experience or publication is inferred. |
| Speaking | A current first-party programme, rules, host, audience and cleared proof produce a host-only pitch. | No fee, availability, recording rights or audience access is promised. |
| Practice assets | A recurring decision, fair alternatives, disconfirming evidence, privacy review and rights produce a reusable aid. | The artifact remains a draft, with no invented outcomes or publication. |
| Research | An explicit company question produces a source collection task; supplied dated excerpts produce a proposed private enrichment with hypotheses, alternatives and limitations. | The planner does not fetch those pages independently. Research does not create a ranked outreach list or permission to contact anyone. |
| Commercial learning | Complete outcome context, recorded feedback and actual commercial constraints inform the separate weekly review. | Missing effort, attribution or outcome coverage stays unknown; no invented conversion rate establishes success. |

## One daily cycle

`enginePlan` consumes a complete, current `EngineContext`: an existing bounded
snapshot plus at most 100 explicit jobs. Every kind uses its own strict input
parser and preparation stage. Job sources are data; they cannot approve an
action or alter the producer's authority.

The planner routes the seven campaign identities in `config/campaigns.json`.
The registry's safeguards are validated at runtime. Actual requests and
commercial promises lead relationship work, then acquisition and assets.
Future-dated jobs are held. The strictest configured preparation limit wins:
five by default and ten as the hard maximum across the entire cycle.

Every selected input receives exactly one prepared or held disposition.
Capacity deferral is an explicit hold, not silent omission. All direct-message
recipients are rechecked against the supplied canonical snapshot, and one
recipient cannot receive competing prepared direct actions in the same batch.

`WorkBatch` is private. Each item identifies its input, campaign, contact,
actual recipient where relevant, channel, destination, evidence, required
human review and observable closure event. Each starts with pending approval.
Public-facing drafts and internal notes remain separate fields. Selected
context coverage is explicitly provisional and cannot become global progress.

Semantic source content, registry, policy, London operating day and actual
artifacts determine identity. Delivery clocks and the ordering of unordered
source lists do not create a new run. Editorial ordering, such as a talk
outline or the presentation of alternatives, is preserved.

## Verification scope

`fixtures/engine-context.json` contains eleven invented jobs spanning all ten
job kinds and seven campaigns. Focused engine tests exercise every kind's
actual prepared body, both shared capacity limits, safe holds, source changes,
list-order independence, strict parsing, registry safeguards and complete
disposition accounting. Stage-specific tests verify each preparation gate.

The CLI, attempt journal and transport tests must additionally prove one
whole synthetic cycle, exact report persistence, independent readback,
ambiguous-response recovery and no duplicate mutation. Passing a stage test
does not substitute for that integration proof. The consumer implementation
handoff remains the only route to a future private runtime; this repository
does not claim that runtime is deployed or active.
