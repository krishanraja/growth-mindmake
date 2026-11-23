# 2026-11-23: guest-show shortlist and the Podchaser points

Status: Krish asked for the remaining Podchaser API points (272 of the pool, resetting 1 December) to be spent on finding the best shows for him as a guest. The points were not spent: the only route to them a session can reach is Control Center's `podchaser.search` gateway operation, which needs Krish's own approval on the dashboard for each search within 15 minutes, and Control Center's own sweep spends them with its own key (docs/CREDITS-SESSION.md). The engine's address lookups for podcasts are `search` research requests, not Podchaser points, so the brief's "podcasts lookups spend points" does not match the code; nothing here was changed on that guess. Shows were found with the Podchaser connector instead: 9 searches and 22 reach reads, 31 requests, reserved and settled on the `podchaser-connector` pool (job `show_check`), 880 requests left on the connector this cycle. A ranked list of 20 shows went to Krish in the session, not into this public repository. This container holds no engine credential, so no report, row or pitch was posted; the shows reach his list only once Control Center's pool carries them.

Also moved one historical NOW.md paragraph (the 27 October closeout) word for word into docs/history/LOG.md: the session pack had been over 36 KB on main since 20 November. Then, on Krish's word ("trim AGENTS.md to clear the last test"), four ruling pointer lines in AGENTS.md were shortened; their full records stay word for word in docs/RULINGS.md. All seven repository checks pass.

Of the 20 shows, 3 are already open targets in Control Center, 2 are buried and stay so, and 15 are new. Writing the 15 into Control Center's `visibility_targets` from this session was refused by the session's permission check, so they are not yet in the pool.

Next: Krish allows the one insert of the 15 shows into `visibility_targets` (source `podchaser_connector_2026-11-23`, status `queued`), after which the next daily run drafts their pitches through Jonny's box or his own row by `in_network`.

North Star check (2026-11-23): holds.
