# Codex task card

A task card hands one bounded change to Codex between runs, as a development tool. The engine's runtime gains no model provider. The plan is [section 6 of the bulletproof plan](../briefs/2026-10-27-bulletproof-growth-engine.md); this page is the template and the route.

- The schema: [specs/schema/task-card.schema.json](../../specs/schema/task-card.schema.json) (`codex-task/1`).
- A synthetic example: [specs/examples/task-card.synthetic.json](../../specs/examples/task-card.synthetic.json).
- The guard: `scripts/dispatch-card.mjs`. The check outside the sandbox: `scripts/verify-card.mjs`.

## The card

One JSON file of 6 KB (6,144 bytes) or less. A real card lives at `specs/cards/<id>.json` on main, so the session on Krish's PC reads the same bytes his yes was given on. The repository is public: no person, record id, private link, figure or credential ever goes in a card.

| Field | What it holds |
|---|---|
| `card` | `codex-task/1` |
| `id` | Lower case, digits and hyphens. The branch is `codex/<id>`. |
| `title` | One plain line. |
| `model` | `name` and `effort`, pinned, never `default`: chosen by [Choosing the model](#choosing-the-model), with `why`. |
| `limits` | `max_minutes` (at most 120) and `max_calls` (at most 400). |
| `worktree` | `from: main`, `branch: codex/<id>` and `dir: ../growth-mindmake-codex-<id>`: its own worktree from main, never the second checkout. |
| `write_allow` | Up to 12 globs inside the repository (`**` any depth, `*` one segment). Every changed file must match one. |
| `read` | Five files or fewer. |
| `never` | At least `git`, `network`, `mcp`, `publishing`, `new_dependencies` and `edits_outside_write_allow`; `secrets` and `people` may be added. |
| `interface` | The interface, verbatim: signatures, shapes and the behaviour each must have. |
| `acceptance` | Up to 8 commands that must exit 0: `npm test`, `npm run <script>`, `node <file>.mjs` or `node --test <file>.mjs`, with plain arguments and no shell characters. |
| `returns` | The JSON shape Codex returns: `type: object`, `required` and `properties`. What it returns is a note to read, never evidence. |


## Choosing the model

Codex's own model list is the truth: `~/.codex/models_cache.json`, or `codex debug models`. It is newer than any model page the OpenAI docs skill carries, so a model missing from that skill is not missing from Codex. Re-read the list at every dispatch, pin the id and effort the card names, and use a newer model the day it is listed (Ruling, Krish, 2026-11-20).

Prefer, in this order:

1. By the job, the newest model whose own description fits it:

| The job | Prefer | Why (from Codex's own list) |
|---|---|---|
| Heavy, complex coding or professional work | `gpt-6.2-astra` | Its most capable model. |
| Everyday coding and quick turns | `gpt-6.2-sol` | The fast, go-to model. |
| Seeing a page, screenshots, browser legwork | `gpt-6.1-terra` | Excels at visual understanding and computer use. |
| Easy, cheap tasks | `gpt-6-luna` | Fast and affordable. |

2. Within a job, the highest version listed. When a newer version of a role appears (a 6.3 Astra, a 6.2 Terra), it replaces its row.
3. Skip models marked hidden (`gpt-reserve`, `codex-auto-review`) and any described as previous generation or legacy, unless the card's `why` gives a measured reason.

Effort is pinned the same way and read from the model's own `supported_reasoning_levels`; a card never uses a level its model does not list.

## The route

1. **Write the card** in a build session and check it: `node scripts/dispatch-card.mjs --card specs/cards/<id>.json --check`. It prints the card's digest, the SHA-256 of its canonical JSON.
2. **Ask his yes** on his Control Center list, on that digest. A changed card has a new digest and needs a new yes. The question goes into the Monday ask unless the guard needs it sooner; never a mid-turn question.
3. **Read usage** in his local session and write it to a file: `{ "read_at": "<ISO time>", "source": "<where it was read>", "used_percent": <0 to 100> }`.
4. **Run the guard** on his PC: `node scripts/dispatch-card.mjs --card specs/cards/<id>.json --usage <file> --approval <decision-id>:<digest>`. It refuses, by name, an invalid or oversized card (`card_invalid`, `card_too_large`), an unknown reading (`usage_unknown`), a reading not newer than the last dispatched card or over a day old (`usage_stale`), usage above 80% (`usage_above_80`), and a missing, mismatched or reused yes (`no_approval`, `approval_mismatch`, `approval_used`). On a pass it records the dispatch in `runtime/codex/ledger.json` and prints the lines to run, in order:

```
git worktree add -b codex/<id> ../growth-mindmake-codex-<id> main
node scripts/codex_thread.mjs open --cwd ../growth-mindmake-codex-<id> --sandbox workspace-write --model <pinned> --effort <pinned> "Codex card <id>: do exactly what the task card at <absolute card path> says, in this worktree only, then reply with the JSON its returns block describes."
node scripts/codex_thread.mjs read <thread id that open printed>
node scripts/verify-card.mjs --card specs/cards/<id>.json --worktree ../growth-mindmake-codex-<id>
```

   Codex starts only through `scripts/codex_thread.mjs`, a byte-for-byte copy of ai-harness's canonical one (Ruling, Krish, 2026-11-15): `open` makes a permanent thread in his Codex Desktop recents, runs the card as its first turn, prints the thread id and releases the thread, so he can watch it and type in it; `send <thread> "<message>"` adds a turn; `read` prints every turn, his included. Never the Codex plugin's long-running server and never the codex-rescue subagent. Run it from a session on his PC: a cloud container makes no thread he can see. If Codex cannot start, say so in one line and stop; never edit MCP or Claude settings to work around it. This repository never runs Codex itself.

5. **Verify outside the sandbox.** `scripts/verify-card.mjs` checks the card again and the branch, lists every changed file against main (committed, unstaged, untracked and both sides of a move), fails on any outside `write_allow` or on no change at all, then re-runs the card's acceptance commands and the seven repository checks in the worktree. It exits 0 only when every step passes. It takes no report: Codex's own account is never read as evidence.
6. **Deliver** as any change here: one pull request from `codex/<id>`, its checks green, merged by the session just after a morning run.

## Fallback

When Codex is unavailable, or the guard refuses on usage, the same card runs through a Claude agent in an isolated worktree on the same `codex/<id>` branch, held to the same `write_allow`, `never` list and interface, and is verified the same way with `scripts/verify-card.mjs`. No code is needed for it.

## Skeleton

```json
{
  "card": "codex-task/1",
  "id": "<id>",
  "title": "<one plain line>",
  "model": { "name": "<pinned model>", "effort": "<pinned effort>", "why": "<the measured reason>" },
  "limits": { "max_minutes": 20, "max_calls": 60 },
  "worktree": { "from": "main", "branch": "codex/<id>", "dir": "../growth-mindmake-codex-<id>" },
  "write_allow": ["<glob>"],
  "read": ["<file>"],
  "never": ["git", "network", "mcp", "publishing", "new_dependencies", "edits_outside_write_allow"],
  "interface": "<the interface, verbatim>",
  "acceptance": ["npm test"],
  "returns": { "type": "object", "required": ["status", "files_changed", "notes"], "properties": { "status": { "enum": ["done", "blocked"] }, "files_changed": { "type": "array" }, "notes": { "type": "string" } } }
}
```
