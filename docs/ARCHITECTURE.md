# Architecture

```text
Existing people, company evidence and deals (private Control Center)
    -> authenticated bounded snapshot
    -> reviewed canon + live buyer definition + evidence guards
    -> relevant prospect and route
    -> message + decision aid + measured scorecard
    -> atomic idempotent ingestion
    -> existing Advisory deal and Home action queue
    -> Krish reviews and sends manually
    -> existing outcome record -> next scorecard
```

The engine is stateless between runs. Control Center owns the durable run journal, attempt/idempotency boundary, daily ingestion cap, private evidence, contact suppression and conversation lifecycle. The engine does not keep a local CRM or retry counter. A run's identity covers semantic snapshot content, policy, run day and prepared artifacts; its delivery timestamp is not a new identity.

The bridge uses the existing managed `GROWTH_ENGINE_TOKEN` server credential, accepts only its one versioned contract, and rechecks contact state and evidence before accepting a recommendation. Actions maps that secret into the client's `MINDMAKE_GROWTH_TOKEN` interface. A bearer never qualifies a conversation, changes payment outcomes or sends a message. Human qualification uses the existing authenticated deal API and requires an actual held-conversation timestamp. Existing qualified data is read into the scorecard.

Evidence carries disclosure scope. The runtime never copies private research or credential-bearing source links into outward artifacts. An introduction request names both prospect and actual recipient, binds the connector's name to its canonical person record and reserves that recipient once per batch. The connected adapter holds introduction requests until the existing records can prove the connector relationship; a caller-supplied name never creates that permission.

The companion adapter reserves and ingests each batch atomically. The client does not retry writes. After a lost response, `resume` reads the durable receipt; it does not repeat the side effect. The final receipt must account for every recommendation as created or explicitly held. A green HTTP response without that proof fails.

The original scorecard and research report are stored in the same journal transaction and returned on readback. Observation-only timestamps do not make a retry conflict, while changed facts or measures do. The batch's `snapshot_revision` is the authoritative service source revision; a separate semantic seal contributes to the run identity. The London operating day prevents a Sunday UTC run from colliding with the new Monday week.

## Integration contract

`contracts/growth.ts` is the wire owner. It contains the reviewed public commercial descriptions and exact source blob revisions. Control Center vendors the file without modification. Its contract parity test must compare the exact source bytes or recorded digest. Changes to either side require coordinated validation, not independent shape guessing.

GET returns a raw version-1 snapshot. The optional cursor names the next bounded contact page. `complete` means all reads for that selected page and the complete deal reporting window succeeded; a failed or truncated read cannot become an empty success. POST accepts a draft batch. GET with `run_id` returns its durable receipt. All service calls use HTTPS, reject redirects and omit private response bodies from diagnostics.

## Dependencies and runtime

Node 24 provides the runtime, test runner, fetch and erasable TypeScript contract loading. There are no runtime packages or direct model-provider calls. Existing collection agents supply evidence; versioned prompts support bounded human/agent research and review when context is missing. Missing context is a research hold, never an invented opportunity.

The stage manifest covers runtime modules; scripts are development/CI tooling. The vendored conformance checker and its schema originate in the canonical build skill. It verifies declared ownership and edges; behavioral tests independently verify the domain and transport.
