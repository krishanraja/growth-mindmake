# One-page decision aid

Follow [the shared contract](README.md) and [the decision-aid playbook](../docs/playbooks/04-decision-aids.md). Produce content for one portable page, with enough reasoning to help without a purchase. Do not claim to have rendered a PDF or designed artifact.

Required input: `decision_question`, `audience_role`, `source_ledger`, `contrary_evidence`, `permission_scope`, `version` (`private_named` or `reusable_practice`), current `canon_refs` and an optional single `cta_choice`. A source URL alone does not support a claim.

The aid is the engine's reciprocity in the doctrine's sense: useful without any purchase. Apply the Rule of One (one decision, one reader role) and the [proof hierarchy](../docs/playbooks/10-copy-and-offer-doctrine.md#proof-hierarchy-and-proof-cards): research earns logical argument, not client outcomes. Run edit passes A to E before `ready_for_review`.

Return `artifact_type: "decision_aid"` with:

```json
{
  "version": "reusable_practice",
  "title": "The decision, in plain words",
  "intended_reader": "Role and decision, without private buyer psychology",
  "decision": "One choice",
  "what_changed": [{"claim": "Observed condition", "evidence_refs": ["e1"]}],
  "options": [
    {"option": "A plausible route", "makes_sense_when": "Observable condition", "trade_off": "The cost or limitation", "evidence_that_changes_the_choice": "A disconfirming signal"}
  ],
  "small_test": {"action": "Reversible test", "signal": "Observable outcome", "limit": "What it cannot prove"},
  "boundary": "An illustrative outside view, not advice, to test against the real business.",
  "unknowns": [],
  "sources": [{"evidence_ref": "e1", "url": "Supplied verified source URL", "retrieved_at": "Supplied timestamp"}],
  "cta": null,
  "markdown": "Complete one-page content draft",
  "render_status": "not_rendered"
}
```

Include at least two plausible options unless the evidence establishes only one safe route; explain that exception. A reusable version omits identifying combinations, not only names. A source citation is a citation, not a second sales ask. New quantitative outcomes, delivery promises and private figures remain blocked.
