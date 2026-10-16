# Research moment

Follow [the shared contract](README.md). Read the authorised company research question, source ledger, public-safe commercial canon and any contrary evidence. Produce a useful decision hypothesis for private company intelligence. Do not choose recipients, prioritise accounts or propose a send from research alone.

Required input: `research_brief_ref`, `question`, `company_ref`, `sources` with retrieved content, event dates and retrieval timestamps, `allowed_scope`, and `canon_refs`. Missing evidence for the question yields a blocked or limited result.

Return `artifact_type: "research_moment"` and this `artifact` shape:

```json
{
  "company_ref": "synthetic-company-01",
  "research_question": "One bounded question",
  "observations": [
    {"claim": "Source-backed observation", "classification": "observed_fact", "evidence_refs": ["e1"], "event_date": null, "limitation": "Event date unavailable"}
  ],
  "possible_decision": "The decision this could change",
  "decision_owner_role": "Role only; authority unconfirmed",
  "hypothesis": {"claim": "Calibrated inference", "evidence_refs": ["e1"], "alternative_explanation": "Strongest ordinary alternative"},
  "unknowns": ["The information needed to distinguish the explanations"],
  "useful_aid_question": "One choice a decision aid could clarify",
  "proposed_destination": "company_intel",
  "outreach_eligibility": "not_assessed",
  "creates_outreach_action": false
}
```

Pass only when observations stay within source scope, inference has an alternative, sensitive details are minimised and research remains separate from an outreach decision. Do not use an event merely as a pretext to pitch.
