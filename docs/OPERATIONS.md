# Operate the engine

## Before activation

1. Review the tested companion Control Center change and identify the current production revision and restore artifact. Merging its main branch deploys automatically, so hold that promotion until the additive schema is ready.
2. With migration approval, apply the reviewed additive migration in the intended environment, then verify the journal/RPC, least privilege, private rows and the existing deal lifecycle. The previous app remains compatible with the added columns. Do not delete existing contacts or deals.
3. Promote the reviewed app change after schema readback and inject the dedicated service credential into both sides through their managed secret surfaces. Set the service origin without credentials, a path, query or fragment. Do not paste values into chat or a repository.
4. Run `npm run doctor`, then a dry `npm run daily`. Confirm current canon, buyer definition, bounded source coverage and real evidence. No writes are needed for doctor.
5. With activation authority, run one `npm run daily -- --commit`. Read back its journal receipt and the exact existing deal/action queue. Confirm every draft can be inspected and no external message was sent.
6. Record `GROWTH_LAUNCH_DATE` as the actual activation date. A cadence begins only after this canary succeeds and the scheduler is explicitly activated.

The manual Actions workflow is a deployment-neutral runner. It defaults to dry run, uploads no private artifacts and prints only counts. No scheduled trigger is enabled by this repository. The existing OS scheduler may invoke `npm run daily -- --commit` once its activation is approved; do not add a second orchestration system.

## Daily

Run the dry plan, inspect holds/research needs and then commit the prepared draft batch when in scope. Control Center contains the private draft, why-now evidence and decision aid. Its existing action queue remains the place for human decisions. Before sending, check the exact person, channel, current facts, contact permission and wording. A draft approval is not evidence that a message was sent.

The default source page is bounded. If the receipt reports more contacts, use `npm run daily -- --cursor CURSOR` for the next page. Use the actual opaque cursor from a private snapshot or saved plan; logs intentionally do not print people or cursor values. Each commit consumes the service's daily cap. Do not loop through pages without a declared item budget.

For a private inspectable artifact:

```sh
node src/cli.mjs daily --output runtime/private-plan.json
```

This path is ignored by Git. Do not upload it, include it in a PR or save it in a public CI artifact. The public demo is safe because every record is synthetic.

## Record outcomes

Use the existing Advisory lifecycle to record replies, calls taken, proofs booked and proofs paid. Do not count a verbal intention to pay as paid. After a held call, the existing deal card shows the five qualification criteria. Press **Count this conversation** only when you confirmed all five. The card records your explicit confirmation through its authenticated update route and shows the saved outcome. The server derives `qualified_at` only after a held call; an engine bearer cannot write it.

Count each person once per London week. Review held calls with missing qualification rather than treating them as wins or losses. Use measured response/conversation/paid ratios only after there is a denominator; no assumed conversion rate governs the initial cap.

## Recover without duplicates

The command prints an opaque `run_id` before it attempts ingestion. If it loses the response, run:

```sh
node src/cli.mjs resume --run-id RUN_ID
```

A durable receipt resolves what happened. An absent or unreachable receipt remains unknown. Do not retry blindly or claim delivery. Once the service state is established, a repeat of the same semantic batch is idempotent; changed source facts create a new run and are rechecked against existing deals and daily limits. There are no automatic write retries.

An explicitly held follow-up is not a delivered follow-up. Manage it through the existing conversation and preserve its history; never reset a sent deal merely to make a new draft appear.

## Refresh commercial truth

Re-read the current `mindmake` North Star, commercial canon and permitted proof. Compare exact blob revisions with `APPROVED_CANON` in `contracts/growth.ts`. Resolve changed offers, links and restrictions against the live surface and owner before changing proposed copy. Update the reviewed source references and approval timestamp honestly, vendor the same contract bytes into the adapter, rerun contract parity and behavioral tests, then deploy through normal review. A new timestamp without a source review is not freshness.

The engine holds after 30 days without that review. It never retrieves prices or customer outcomes from an old prompt. Proof, CTRL pilot invitations and publication content remain under their existing owners.

## Stop and rollback

Stop the approved runner at its scheduler; no outbound side effect has to be reversed because it never sends. Restore the prior application revision if an adapter regression appears, then re-read the journal and existing deal state. The additive migration is retained unless its exact reversal has been separately reviewed and approved. Never purge records as routine cleanup. Diagnose missing evidence, stale canon and incomplete snapshots at their owning stage.
