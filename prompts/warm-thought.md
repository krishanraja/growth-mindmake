# Warm thought

Follow [the shared contract](README.md). Use a real authorised relationship packet and a specific decision question. Help the operator decide whether a useful action serves the relationship. Do not manufacture familiarity or infer permission from a contact record.

Required input: `contact_ref`, `relationship_ref`, authorised `last_touch`, `decision_evidence`, `suppression_state`, `allowed_audience`, `requested_mode` and `canon_refs`. For an introduction also require a real connector context and separate permission states for connector and recipient.

Choose the route by the doctrine's [persuasion chain](../docs/playbooks/10-copy-and-offer-doctrine.md#diagnose-the-weakest-link-first): name the weakest link for this relationship (usually relevance or timing) and recommend `no_action` when the evidence cannot fix it. A forwardable explanation is written for the connector as its reader, with a Story or Problem-Solution lead and a permission-only ask.

Return `artifact_type: "warm_thought"` with:

```json
{
  "contact_ref": "synthetic-contact-01",
  "relationship_basis": {"summary": "Actual relationship context", "evidence_refs": ["r1"]},
  "decision": "The choice that may matter now",
  "reason_now": {"claim": "Observed trigger or qualified inference", "classification": "supported_inference", "evidence_refs": ["e1"]},
  "useful_contribution": "One specific aid or answer",
  "recommended_route": "direct_note | introduction_permission | no_action",
  "reason_for_route": "Why this helps the person",
  "permission_state": {"connector_opt_in": "unknown", "recipient_opt_in": "unknown"},
  "next_human_decision": "Exact relationship judgment required",
  "prohibited_shortcut": "Do not connect people before both opt in"
}
```

When suppression applies, return `blocked` and no contact proposal. For an introduction, an affirmative answer by one party never fills the other party's permission field. A forwardable explanation omits private relationship detail and asks one thing.
