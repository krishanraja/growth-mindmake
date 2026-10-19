# Weekly outcome review

Follow [the shared contract](README.md) and [the scorecard playbook](../docs/playbooks/07-scorecard-and-experiments.md). Use verified runtime counts and underlying private references. Do not recalculate success from anecdotes or add missing events.

Required input: explicit `report_window`, `timezone`, actual `launch_date` in `YYYY-MM-DD` form or null, `coverage`, `qualified_conversations`, `paid_proofs`, `reversals`, `origin_breakdown`, `blocked_actions`, `pending_decisions`, `founder_effort` or unknown, and prior `experiment`. Missing source coverage must appear before interpretation. First-month reporting covers 30 London calendar dates including activation day; never infer a launch timestamp or substitute the build date.

Fill `experiment_proposal` as the doctrine's [test record](../docs/playbooks/10-copy-and-offer-doctrine.md#test-record-mapped-to-the-weekly-experiment): one decision question, one change against a stated control, a success signal and a guardrail. Prefer angle, lead type, proof placement or ask tests; market and offer tests are Krish's. Call low-volume learning directional.

Return `artifact_type: "weekly_review"` with:

```json
{
  "report_window": {"start": "Supplied timestamp", "end_exclusive": "Supplied timestamp", "partial": true},
  "timezone": "Europe/London",
  "launch_date": null,
  "coverage_limitations": [],
  "scorecard": {
    "qualified_conversations": {"actual": 0, "target": 5, "evidence_refs": [], "status": "partial_window"},
    "first_30_day_paid_proofs": {"actual": null, "target": 1, "evidence_refs": [], "status": "pending_activation"}
  },
  "primary_constraint": {"finding": "One supported constraint or unknown", "evidence_refs": [], "classification": "supported_inference"},
  "experiment_proposal": {
    "hypothesis": "Falsifiable claim",
    "one_change": "One reversible change",
    "eligible_scope": "Approved audience or workflow",
    "comparison": "What can fairly be compared",
    "success_signal": "Observable signal",
    "adverse_signal": "Stop condition",
    "review_trigger": "Date or event proposed for operator review",
    "authority_needed": "Any pending external action"
  },
  "next_human_decision": "The one decision that moves the constraint",
  "limitations": ["Low-volume observations do not establish a causal conversion rate"]
}
```

Use the exact supplied counts. A zero denominator yields null for a ratio. A missing launch date makes first-month evaluation pending. A partial week does not establish weekly target attainment. Never recommend weaker qualification, suppressed contact, automatic sends or broader private data collection to hit the target.
