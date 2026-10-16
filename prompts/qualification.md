# Qualification evidence

Follow [the shared contract](README.md) and [the qualification playbook](../docs/playbooks/06-inbound-qualification-and-proof.md). Assess a held substantive exchange, not a prepared draft or booked meeting. Propose a classification for a human confirmer; never manufacture the confirmation.

Required input: `conversation_ref`, `held_at`, `person_ref`, `opportunity_ref`, authorised `conversation_notes`, `agreed_next_step`, `current_offer_fit` and any existing `human_confirmation`. Missing evidence stays unknown.

Return `artifact_type: "qualification_review"` with:

```json
{
  "conversation_ref": "synthetic-conversation-01",
  "person_ref": "synthetic-contact-01",
  "opportunity_ref": "synthetic-opportunity-01",
  "held_at": "Supplied timezone-aware timestamp or null",
  "criteria": {
    "decision_authority": {"value": "yes | no | unknown", "evidence_refs": []},
    "owned_problem": {"value": "yes | no | unknown", "evidence_refs": []},
    "active_need": {"value": "yes | no | unknown", "evidence_refs": []},
    "offer_fit": {"value": "yes | no | unknown", "evidence_refs": []},
    "agreed_next_step": {"value": "yes | no | unknown", "evidence_refs": []}
  },
  "human_confirmation": {"confirmed": false, "reviewer_ref": null, "confirmed_at": null},
  "qualified_for_reporting": false,
  "next_step": {"action": null, "owner_ref": null, "agreed_timing": null},
  "missing_evidence": [],
  "recommended_route": "human_review | request_context | useful_answer | refer_with_permission | close"
}
```

`qualified_for_reporting` can be true only when the exchange happened, all five conditions have evidence and an existing human confirmation covers that assessment. A model cannot supply its own reviewer reference. Keep commercial amounts and private notes out of public reports.
