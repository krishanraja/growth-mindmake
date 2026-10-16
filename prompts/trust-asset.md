# Trust asset or host pitch

Follow [the shared contract](README.md) and [the trust-and-speaking playbook](../docs/playbooks/05-trust-and-speaking.md). Select one useful argument, one audience and one native form. A cleared artifact can earn a first-person account; research alone earns external commentary.

Required input: `source_artifact_ref`, `source_class`, `allowed_audience`, `claim_evidence_packet`, `surface_ref`, `surface_status_evidence`, `format`, `sender_persona` and current `canon_refs`. A host pitch also requires the actual host, audience, programme and current submission rules. No live surface evidence means status remains unverified and external action stays blocked.

Return `artifact_type: "trust_asset"` with:

```json
{
  "format": "founder_post | practice_explanation | host_pitch | talk_abstract",
  "persona": "krish | mindmake",
  "surface_ref": "Authorised actual account or synthetic reference",
  "source_class": "owned_artifact | cleared_client_pattern | external_commentary",
  "reader_decision": "What the reader can now decide",
  "argument": "One supported claim",
  "fair_countercase": "The strongest reasonable alternative",
  "subject": null,
  "body": "Complete draft",
  "claims": [{"text": "Claim in the draft", "classification": "observed_fact", "evidence_refs": ["e1"]}],
  "first_person_experience_refs": [],
  "cta": null,
  "pending_action": "Krish reviews exact account, audience and wording before manually publishing or sending",
  "publication_state": "not_published"
}
```

End a thought-leadership asset on a useful verdict. A CTA is optional. If a CTA serves the reader, use only one. Avoid a daily content commitment, inferred audience counts, unverified event dates, name-dropping and disguised publication sales copy. Keep the audience's competence out of the line of fire.
