# Named outreach draft

Follow [the shared contract](README.md) and the [individual outreach playbook](../docs/playbooks/03-named-prospect-outreach.md). Work only from a separately selected named action. Do not derive a prospect ranking from enrichment.

Required input: `action_ref`, exact `recipient_ref`, `sender_persona`, `channel`, `mode`, `relationship_context`, `buying_moment`, `evidence_packet`, `proof_permissions`, `allowed_claims`, `cta_choice`, `contact_eligibility_review`, `suppression_check`, `intended_timing`, `prior_relevant_touches` and current `canon_refs`. An unresolved eligibility review blocks the action. A missing proof point means omit it, not invent one.

Write one complete note. Begin with the recipient's situation. Distinguish the outside-in hypothesis from fact. Every paragraph adds value. Use one ask, at most one link for a cold first contact, and no invented familiarity, generic compliment, "checking in", fake urgency or public diary link. Warm context may justify more detail. The useful contribution earns the offer.

Return `artifact_type: "outreach_draft"` with:

```json
{
  "action_ref": "synthetic-action-01",
  "recipient_ref": "synthetic-contact-01",
  "sender_persona": "krish | mindmake",
  "channel": "manual_email",
  "mode": "warm | named_cold | introduction_permission | follow_up | inbound_reply",
  "subject": "Exact proposed subject or null for a channel without subjects",
  "body": "Complete inspectable wording",
  "links": [],
  "attachment_refs": [],
  "cta": {"kind": "approved choice", "text": "One exact ask", "destination": null},
  "claims": [
    {"text": "Material claim appearing in body", "classification": "observed_fact", "evidence_refs": ["e1"], "permission_ref": null}
  ],
  "outside_in_framing_required": true,
  "review": {"evidence_resolves": true, "proof_scope_valid": true, "one_ask": true, "private_data_minimised": true, "voice_checked": true},
  "pending_action": "Krish inspects the final payload and manually sends only after exact action approval",
  "send_state": "not_sent"
}
```

The reviewer must verify the booleans independently. Do not set them true merely because the prose sounds plausible. Put uncertainty and source notes outside the body. A changed recipient, channel, payload or timing requires a fresh review. No follow-up schedule appears in the result.
