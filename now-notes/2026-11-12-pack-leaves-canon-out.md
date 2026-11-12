Status: The session pack leaves out the Krish canon block ai-harness renders at the end of AGENTS.md (one line in its place; it loads with AGENTS.md itself), and the rulings test reads AGENTS.md's own sections without it, so the canon block can land while the 36 KB budget and the standing rules word for word both hold.
Changed: scripts/pack.mjs (CANON_BLOCK, withoutCanon, packed), tests/support/rulings.mjs, tests/pack.test.mjs, AGENTS.md ("Every session: the pack"), docs/OWNERS.md. With ai-harness's canon block (pull request #51) the heaviest pack is under 36 KB and all 629 tests pass.
Next: merge pull request #51 (the canon block) once its checks pass on main.
North Star check (2026-11-12): holds.
