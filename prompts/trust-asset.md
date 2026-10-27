# Trust asset or host pitch

Follow [the shared contract](README.md) and [the trust-and-speaking playbook](../docs/playbooks/05-trust-and-speaking.md). Select one useful argument, one audience and one native form. A cleared artifact can earn a first-person account; research alone earns external commentary.

Required input: `source_artifact_ref`, `source_class`, `allowed_audience`, `claim_evidence_packet`, `surface_ref`, `surface_status_evidence`, `format`, `sender_persona` and current `canon_refs`. A host pitch also requires the actual host, audience, programme and current submission rules. No live surface evidence means status remains unverified and external action stays blocked.

A room usually meets an unaware or problem-aware audience: use a Story or Proclamation lead from [the copy and offer doctrine](../docs/playbooks/10-copy-and-offer-doctrine.md#awareness-lead-type-and-ask-by-path), one argument as the big idea, cleared proof placed next to its claim, and edit passes A to E before `ready_for_review`. Never Offer copy in an editorial or speaking surface.

The format is one of the three a trust motion takes in `contracts/motions.ts` (N09): `founder_post` in Krish's voice, `practice_post` in Mindmake's, or `commentary` on research alone. A host pitch or a talk abstract is not a trust format: it is the speaking motion (`kind: speaking` in the same contract), whose output is a `speaking_pitch`.

Return `artifact_type: "trust_asset"` with:

```json
{
  "format": "founder_post | practice_post | commentary",
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
