# Release state

## The focus playbooks, the suppression of his Nos and the places and questions, moved here in shadow (plan section 12, M7, M10 and M13), 27 October 2026

Built and tested; in shadow on every run that is served a context. No report shape, word file or word an existing stage writes changed (every golden digest still matches), and nothing in Control Center is turned off yet. Krish's ruling (27 October): "Control center should just be where you read from and where you report to, it does not own the strategy for how to grow mindmake as a business".

- **M7, src/stages/plays.mjs (the rows stage's playbooks).** Mindmake's fifteen plays from api/_focus.ts `PLAYBOOKS` (the visibility, revenue and network books), each with its engine home: seven on an engine row, five that stay on his one list, `host_room` ruled out (rooms are guest seats only), `press` with no lane yet, and `alumni` unwired in either. `pickApproach`, `selectRooms`, `selectAfter`, `selectStages`, `playsToFill` and `playAllowed` rule for rule, with `roomRank` reused from rooms.mjs. The family registry, the focus rule and the hourly refill stay in Control Center.
- **M10, src/stages/suppression.mjs.** The taxonomy and the row doctrine as one object (`taxonomy`), the suppression list the engine would send (`suppressionList`) and how Control Center would apply it on schema checks alone (`suppressionApplies`); rows.mjs's `lessons` and `refusedBy` remain the rule. Control Center's `answeredLike` and `rowAnswers` are ported only so the shadow can name where they differ.
- **M13, src/stages/places.mjs and src/weekly-review.mjs `weeklyPlaces`.** api/growth/geo-probe.ts's question choice for Mindmake alone, Mindmake's domains read from the canon as whole hosts, and src/lib/growthModel.ts's accounts, places count and missed questions for Mindmake. The touchpoint map, the probe runner and the AEO content stay elsewhere; the weekly review's output is unchanged.
- **Shadow.** `playsShadow`, `suppressionShadow` and `placesShadow` run in the dispatch after the M6, M9 and M12 lines, only when a context is served, each inside try/catch: `Focus playbooks, in shadow:`, `Suppression, in shadow:` and `Places and questions, in shadow:`. Counts and codes only; the golden filter leaves them out, and the switch's readiness line is still reported after them, inside the report's forty lines.
- **Differences from Control Center's copy, each a code, none ported.** M7: a show pitched by Jonny on pitches.mjs's holds (`no_booking_address`, `quiet_show`, `already_pitched` and the rest), press no lane (`press_not_a_lane`), a stage with no form the engine can read (`form_not_read`), a room shown with no verified date (`date_unverified`); Control Center holds its podcast, stage and press plays on a founder ruling that his visibility targets already answer, and drafts a podcast pitch in his own box where Jonny sends. M10: `undated_answer`, `answer_without_row`, `carried_state`, `unknown_kind`, `blank_sector`, `answers_beyond_cap`, `band_missing`, and `reason_named_otherwise` where both hide and name another reason. M13: Control Center's domains, against the canon, have four outside it and miss the publication's own host (`domain_outside_canon`, `canon_domain_missing`; its words are not quoted, a stand-in trips the same findings), a citation matched as a substring (`substring_hit`), a stored answer cut short (`answer_cut`), twelve probes shared with other products (`cap_shared_with_other_products`) and a question naming a retired offer (`question_names_retired_offer`).
- **Parity.** A parity table in each test file (tests/plays.test.mjs, tests/suppression.test.mjs, tests/places.test.mjs), against Control Center's own rules and its tests' cases on synthetic fixtures; the suppression decides what Control Center's answeredLike decides on every one of a 500-case sweep of clean answers, and the list the engine would send decides what its rule decides, reason and all. tests/section12.test.mjs proves on the protocol stand-in that each of the nine section 12 lines appears once, in order, carries counts only and holds nothing.
- **Protocol.** The `suppression` and `taxonomy` report fields, and the context parts for touchpoints, probes, accounts, touches due and his city, are specified in docs/CONTROL-CENTER-BRIEF.md "Still owed", with what Control Center's retirement change turns off. The report schema is unchanged.
- **Mutations.** Nine more, all killed: one approach a contact dropped, a room with no https page shown, the hosted room given a row, a name in the suppression list, the reach floor off by one, a submit counted as carried out, a citation as a substring, a retired offer probed, and every product's touchpoints planned.
- **Verified on:** the seven repository checks, 486 tests (17 new), `npm run mutate` (47 of 47 killed) and `npm run pack`.
- **Live proof:** none. The next step is one live run with the three lines read back beside Control Center's answers; only then does Control Center's retirement change follow.

## The engine's version acts: the stages decide on their own verdicts (plan section 12, M3 to M5), 27 October 2026

Built and tested; not yet run live. Krish's ruling (27 October): "Control center should just be where you read from and where you report to, it does not own the strategy for how to grow mindmake as a business". The three ported standards read back live in shadow on 27 October and agreed with Control Center on every comparable guest and room, and on all but one comparable stage, a date that has since passed. Before Control Center stops writing its verdicts, no stage here may read them, so this change makes every stage act on the engine's own.

- **The helpers, one per kind.** `stageVerdict(t, at)` and `stageStrength(t)` in src/stages/visibility.mjs: a passed date is refused, otherwise the gates run on the three axes Control Center serves under the current score version (`axesOf`, `verdictFromAxes`). `guestVerdictOf(g)` in src/stages/guests.mjs: the guest standard on the guest's three axes (`standingFromAxes`). Axes not served, or judged under another version, read as unjudged, which is exactly how Control Center's unjudged case was treated (a stage ranked as unjudged and never held for it, a guest never invited); Control Center's verdict is never a fallback. Room scoring has no stage that acts on it yet, so `roomVerdict` stays the one reader for when one does.
- **Call sites switched.** src/stages/pitches.mjs: `pitchScore` and `speakScore` (the verdict weight, and the weakest axis now read only under the current score version), `pitchHold`, `speakHold` and `stageForm` (a refused stage is held; a passed date keeps its own named hold on stages and forms), `inviteHold`, the invite ranking, its `because` and `why` lines and `inviteCard`. src/strategy.mjs: the visibility gate on a campaign's host stage. `ccTargetGate`, the port of Control Center's People gate used only by the outreach briefs shadow line, reads Control Center's stored verdict through `ccStageVerdict`, which is for shadow lines only.
- **Words.** "Nova's verdict: X" in the podcast, speaking and form pitches' why lines is now "The visibility standard: take.", "stretch." or "not yet judged.", from the engine's own verdict. No new claim. pitches.mjs is a word file, so its blob SHA in every row's source_revision changes.
- **The shadow lines** are unchanged in code and still compare the engine's answers with Control Center's stored verdicts while Control Center writes them. The guest line's tail counts what the invite stage would now hold, so its synthetic test expects the engine's holds.
- **Golden reports.** Five digests re-recorded, each proved. With the helpers forced back to Control Center's fields as the old code read them, and the old words, every report whose fixture is unchanged reproduces its old digest exactly (forms 1, pitches 1 and 3). Two fixtures needed the guest axes Control Center now serves so their invites still run (pitches 4 and the caps fixture in golden.json); for those, the fixture change alone alters only the report's `source.revision` (the context hash) and a shadow line the digest leaves out, and the forced run gives the same digest as the old code on the new fixture. What the switch changes: pitches 3 and 4, the words only; forms 1 and pitches 1, the words and a "take" read as "not yet judged" where the fixture serves no axes; the caps fixture, the same, and with no stage axes served its podcasts rank by recency, fit and run length alone, so The Example Show 12 and 10 replace 9 and 7.
- **Guards.** tests/section12.test.mjs scans src/ and fails on any read of Control Center's verdict or score fields outside the three files that port a standard (proved able to find one first), and proves that changing only Control Center's stored verdict changes nothing a stage does. Six more mutations, all killed: a stage or a guest falling back to Control Center's verdict, a refused podcast pitched, a refused stage or form pitched, a stage held on Control Center's verdict, and axes read under another score version.
- **Known limits, unchanged by this change.** Control Center serves the axes but not the flags it can refuse on (pay to play, an angle anyone could give, the wrong show for a guest), so a stage or guest it refused only on one of those reads on its axes here. None did in the 27 October readback; the shadow lines count it as `flag_not_served` and `show_fit_not_served`.
- **Verified on:** the seven repository checks, 471 tests (2 new, with new cases in eight files), `npm run mutate` (44 of 44 killed) and `npm run pack`.
- **Live proof:** none. The next step is one live run read back, then Control Center's retirement change on its side.

## The pilot machine, Mindmake's outreach angle and the legacy ingest gate, moved here in shadow (plan section 12, M6, M9 and M12), 27 October 2026

Built and tested; in shadow on every run that is served a context. No report shape, word file or word an existing stage writes changed (every golden digest still matches), and nothing in Control Center is turned off yet. Krish's ruling (27 October): "Control center should just be where you read from and where you report to, it does not own the strategy for how to grow mindmake as a business".

- **The canon, read for more.** src/stages/canon.mjs now reads who buys (01_CANON.md "Who buys" and 00_NORTH_STAR.md "Who this is for": the groups, the gate, the best-fit moments, the poor fits, the Horizon's public sectors and the sales wedge's internal ones) and what is offered (the offer's noun, its one public length and where it may appear, a private price, the retired offers and the revenue door's line), each null when the canon no longer carries it. `canonBuyerTitle` and `offerFindings` judge a title and a line about the offer against them.
- **M6, src/stages/pilots.mjs (new: no existing stage owned the Advisory list's people, the Monday five or the offer words, and rows.mjs is the home screen).** Ported from api/_pilotDeals.ts (`findTrigger`'s cited-or-silent rules, `draftApproach`'s brief), api/pilot-deals/monday.ts (the Monday five), api/pilot-deals/seed.ts (tiers, whyFace, the classifier's fallback, collaborators last) and src/lib/pilotDealsHunter.ts. FACE, DOOR and INDUSTRY are replaced by the canon's buyer, offer and sectors; PILOT_PLAN_ASKS is not ported, the number being docs/NORTH_STAR.md's. The network search, the paid research, both model calls, enrichment and Rule 2's wall stay in Control Center.
- **M9, src/stages/pitches.mjs.** Ported from api/_peopleDraft.ts: the code-set subject (`subjectPart`, `subjectFor`), the three drafting gates and the rules each brief hands its model. The Mindmake entry of api/_venturePositioning.ts is not ported: it is out of date against the canon.
- **M12, src/stages/qualify.mjs and src/stages/draft.mjs.** Ported from api/_mindmakeGrowth.ts: what counts as a buying moment (a published post, inside 30 days, of a stance the canon's moments support) and the buyer-title rules. The pinned offer copy of api/_mindmakeGrowthContract.ts is checked against the canon (`pinnedCanonDrift`, `templateAskCurrent`); the frozen contracts/growth.ts and prepare()'s words are unchanged.
- **Shadow.** `pilotsShadow`, `briefsShadow` and `qualifyShadow` run in the dispatch after the M3 to M5 lines, only when a context is served, each inside try/catch: `Pilot machine, in shadow:` (the canon's buyer beside Control Center's ask kind on each Advisory row, its Monday batch, and whether its drafted notes say only what the canon supports), `Outreach briefs, in shadow:` (Control Center's drafting gates beside the engine's pitch and invite standards, and whether the subjects are the same words) and `Ingest gate, in shadow:` (the canon's buyer beside product_icp's titles over Control Center's own snapshot, its buying moments, and the pinned copy). Counts and codes only; the golden filter leaves them out.
- **Differences from Control Center's copy, each reported, none ported.** DOOR: a duration promise (a length outside the two door pages), price terms (the canon keeps every figure private), and the offer named otherwise than the canon's own noun; its words are not quoted here, since Control Center's repository is private. FACE: its psychology line is the private buyer archetype the canon never lets a message say. INDUSTRY: advertising, broadcast and martech are not in the canon; creative, content, coaching and consulting are, and missing. The Mindmake angle: a retired offer, a duration promise, and the offer named otherwise. findTrigger: funding, leadership change, restructuring and results are not canon moments (an AI move is), and its 60-day window is wider than the 30 days a buying moment keeps. The stance rule: hiring counts in Control Center and in no canon moment. The buyer titles: product_icp's are Krish's own record, not read here, and matched as substrings; the canon's groups are matched as whole words with a short title's long form, so the shadow counts each title the two read differently. The pinned copy: the four fields match the canon today, but prepare()'s "the free AI brief" is no longer the canon's ask ("Start building your AI brain"). The People subjects and the engine's pitch subjects are different words for the same asks.
- **Parity.** Every Control Center test of these rules has an engine test on synthetic fixtures, with a parity table in each file (tests/pilots.test.mjs, tests/briefs.test.mjs, tests/ingest-gate.test.mjs); the subject, hunter card, stored-quote trigger, buying-moment and buyer-title answers were also read by running Control Center's own functions with the network off, outside this repository. tests/section12.test.mjs proves on the protocol stand-in that each line appears once, after the M3 to M5 lines, carries counts only and holds nothing, and that a fault says so in one line and never fails the run.
- **Mutations.** Nine more, all killed: the Monday five taking a hunter card, a stale quote as news, a pilot passing the canon, an unjudged stage drafted, a teaser subject, hiring as a buying moment, the exclusion dropped, a buyer matched on any one word, and the pinned link unchecked.
- **Verified on:** the seven repository checks, 469 tests (23 new), `npm run mutate` (38 of 38 killed) and `npm run pack`.
- **Live proof:** none. The next step is one live run with the three lines read back beside Control Center's answers; only then does Control Center's retirement change follow.

## The guest standard, the visibility standard and room scoring, moved here in shadow (plan section 12, M3 to M5), 27 October 2026

Built and tested; in shadow and not wired. No dispatch code, report shape, word file or existing stage changed, and nothing in Control Center is turned off yet. Krish's ruling (27 October): "Control center should just be where you read from and where you report to, it does not own the strategy for how to grow mindmake as a business".

- **M3, src/stages/guests.mjs.** Control Center's guest standard (api/_guestStandard.ts: senior, seen online, worth hearing, the minimum of the three, thin as unjudged), `standingFor` (a past Signal & Noise guest is never the wrong show for Make Your Mind Up), the 70/30 split and the queue order (src/lib/shows.ts, src/lib/approaches.ts, api/_approaches.ts), how Krish could reach a guest (api/_guestPath.ts), and the scout's ranking and search terms (api/discover-guest-scout.ts, api/_judgmentLens.ts). The two shows, their shares and the invite holds are pitches.mjs's own; Make Your Mind Up's name is the canon's. The judge's prompt, each show's mandate and the lens's named voices stay in Control Center.
- **M4, src/stages/visibility.mjs.** Nova's standard (api/_visibilityScore.ts, api/visibility-targets/score.ts, src/lib/visibilityScale.ts, src/lib/visibilityStandard.ts): the weights, the floors, the three axes and their minimum, the gates in order, the judgment clean-up, the stretch lane capped at two and the legacy scale. The judge's prompt and its offer copy stay in Control Center.
- **M5, src/stages/rooms.mjs.** Room scoring (api/_eventScore.ts, api/events/score.ts): Draw and Demand, the named-attendee bonus, the host kind and the queue; with the rank, the gate a room must pass to be shown and where it is, from events_for() and events_recommendable.
- **Shadow.** `guestsShadow`, `visibilityShadow` and `roomsShadow` each return the engine's verdicts and one counted activity line beside Control Center's stored verdicts; the main session wires them into the dispatch. The context serves each stage's three axes and verdict, so the visibility line compares; it serves each guest's verdict but not its axes, and no room scores at all, so those lines count what is not comparable and why.
- **Parity.** Every Control Center test of these rules has an engine test on synthetic fixtures, with a parity table in each test file naming the few left in Control Center because they test its own surfaces (a show's label, the People card, the mailbox, the judge's input). A differential run against Control Center's own functions, outside this repository, agreed on about 140,000 random cases.
- **The guard.** scripts/check-visibility-standard.mjs, inside `npm run check`, is Control Center's guard of the same name, ported where it applies to the engine.
- **Mutations.** Three more: the visibility standard as a mean, a past guest refused as the wrong show, and a practitioner room unpenalised on Draw.
- **Verified on:** the seven repository checks, 429 tests (49 new), `npm run mutate` and `npm run pack`.
- **Live proof:** none. The next step is one live run with the three lines reported beside Control Center's own verdicts; only then does Control Center's retirement change follow.

## The Phase 5 switch, built behind the spec (plan Phase 5), 27 October 2026

Built and tested; not switched, not live. Nothing in today's reports changes but one activity line.

- **The field.** `growth-week/1` gains an optional `enabled` boolean (add-only: absent in the default spec and every earlier spec; the schema's new SHA-256 is frozen in contracts/manifest.json). No experiment can set it.
- **Readiness, every run.** One line, `Switch readiness: signed spec ...; proof runs ... of 5; shadow reported ...; number measured ....`, from what the run can prove: this week's signed spec (never last week's carried on, today's settings or an unsigned proposal), the crew's two shadow lines, and the good_meetings objective read `measured`. Proof runs are read through `proofReader`; Control Center serves no list of this engine's past reports and run ids end in a workflow run number, so today they read unknown with that reason, and no ledger is kept. A proof run counted from a stored report is live, ready or held, carries both crew lines and a route line naming its engine revision; five in a row at one revision, so no pull request merged between them.
- **The route.** Enabled but not ready: one `Switch route:` line says what is missing, and the crew stays in shadow. Enabled and ready: each crew finding that names a proposal holds it (its lint code as the hold, counted, never an id) and the proposal leaves the report; the lint line says enforcing; his `gms-` and `gmg-` asks are never held. src/crew/switch.mjs.
- **The old route.** OLD_ROUTE_DAYS is 30 and SWITCHED_ON is null until the first enforcing live run reads back; scripts/check-switch.mjs, in `npm run check`, refuses a route that enforces without readiness, a crew line that holds by default, or a dispatch that holds outside `if (way.enforce)`, until 30 days after SWITCHED_ON.
- **The 20x measure.** `npm run measure-20x` reads the Phase 0 baseline's format and a measurement since it, and writes the eight measures, per session, to ignored runtime/; each is measured or unknown with its reason, and it prints only each measure's state.
- **Byte for byte.** The golden test now leaves out the switch's lines as it does the crew's; every recorded report digest still matches.
- **Mutations.** Four more: enforcement from a spec that is not this week's signed one, enforcement before readiness, a dispatch that holds whatever the route decided, and the old route removed early.
- **Verified on:** the seven repository checks, with 396 tests (16 new), `npm run mutate` (25 of 25 killed) and `npm run pack`.
- **Live proof:** none. The switch waits on one signed spec (the week of 9 November at the earliest), five live proof runs (which first need Control Center to serve a read of this engine's past reports), the number measured, and his `enabled: true`.

## The session pack and Codex task cards (plan Phase 4), 27 October 2026

Built and tested; not used yet. No dispatch code, report shape or word file changed. Krish approved every piece of the plan on 27 October ("i approve all the other pieces", and later "keep going autonomously until every single phase is done"), which is his yes to the one change Phase 4 asked across AGENTS.md, docs/GET-GOING.md and NOW.md (plan sections 5 and 10).

- **The pack.** `npm run pack` (scripts/pack.mjs) writes runtime/pack.md from every mandatory load: AGENTS.md, NOW.md and docs/NORTH_STAR.md whole, the week spec in force (a spec passed in, this week's proposed file, else the default spec from src/crew/compile.mjs), the cards of up to three specialists named with `--cards`, open lint findings and holds as counts and codes from `--report` (else unknown, never zero; no detail sentence reaches it), and gate status (the North Star's urgency, the build's open steps, the week spec, the Monday ask and Friday review, the last Codex card). It prints its bytes by part and exits 1 above 36,864 bytes. With the three largest cards this repository's pack is 27,831 bytes (AGENTS.md 7,571, NOW.md 7,929, docs/NORTH_STAR.md 2,689, the week spec 733, the cards 7,640, findings and holds 148, gate status 633, the header 488); with none it is 20,488.
- **Shorter always-on files, no ruling lost.** AGENTS.md went from 20,577 to 7,540 bytes: it keeps the north-star block, "Get going", the release boundary, privacy and action authority, and checks and delivery word for word, and one pointer line per ruling. Every ruling section moved verbatim to docs/RULINGS.md, with a new section recording this Phase 4 yes; the owner list moved line for line to docs/OWNERS.md, with owner lines for the new scripts. NOW.md went from 21,892 to 7,901 bytes: its front matter, state line and headings are unchanged, and its 24 older changes moved verbatim to docs/history/LOG.md. tests/rulings.test.mjs proves each against tests/fixtures/rulings/at-main.json, derived from AGENTS.md and NOW.md at c6f95c5 and re-derived from git wherever that commit is present. No check read AGENTS.md's owner lines, so none needed moving.
- **GET-GOING.** Its read list is now the pack; docs/BRIEF.md, the dated handoff, docs/CONTROL-CENTER-BRIEF.md and the protocol are references opened only when a task needs them. Every step and tick is as it was, and Phase 4 is ticked.
- **The task card.** docs/codex/TASK-CARD.md and specs/schema/task-card.schema.json (`codex-task/1`, 6,144 bytes or less): the pinned model and effort, minutes and calls, its own worktree on `codex/<id>`, write_allow globs, five reads or fewer, the never list, the interface verbatim, acceptance commands with no shell characters, and the return shape. One synthetic example in specs/examples/.
- **The guard.** scripts/dispatch-card.mjs never dispatches anything: it validates a card, then refuses by name an unknown reading, one not newer than the last dispatched card or over a day old, usage above 80%, no yes, a yes on another digest, or a yes already used (his yes is a Control Center decision id with the card's payload digest). On a pass it prints the codex-companion lines for his own session, with the pinned model and effort and a `codex/<id>` worktree, and records the dispatch in runtime/codex/ledger.json.
- **Verification.** scripts/verify-card.mjs checks the card and the branch, fails on any changed file outside write_allow (committed, unstaged, untracked or either side of a move) or on no change, then re-runs the card's acceptance commands and the seven repository checks in the worktree; exit 0 only when all pass. It takes no Codex report.
- **Mutations.** Five more in invariants/mutations.json: a reworded ruling, a widened pack limit, the 80% line, the digest check and the write_allow check.
- **Verified on:** the seven repository checks, with 380 tests (25 new), `npm run mutate` (21 of 21 killed) and `npm run pack`.
- **Live proof:** none. The first real card runs only from a session on Krish's PC, after his yes on its digest.

## Card lines from typed facts, 27 October 2026

Built and tested; not live until krishanraja/control-center#586 deploys and serves `facts[]` (`features.facts`). `factLines` in src/stages/rows.mjs turns at most two facts (a post with its own page, a role change, a shared employer) into whole sentences to Krish, read before the record's prose in the card's why lines; each post is also a card source. A role is the who line and emails are the known line, so neither is repeated; a fact Control Center clipped, a dash, a post with no page or a profile link is never shown. Card grammar passes on a facts-built card, the golden reports are unchanged (no fixture serves facts), and a new mutation proves a post is never shown without its page.

## The crew as code (plan Phase 3), 27 October 2026

Built and tested; not live. Every new hold runs in shadow until the Phase 5 switch, so no proposal on his list changes because of it.

- **The crew.** crew/index.json names the nine specialists of plan section 3. Each owns a pure lint (src/crew/lints/, importing the stage predicates: pitchHold, speakHold, inviteHold, icpOf, refusedBy, lastContact, fitHold, tagged and untagged), a measured check (src/crew/checks/, null with its reason when unmeasured), and a card and lens in crew/<slug>/, generated from the playbooks by scripts/check-crew.mjs with each source's SHA-256. The largest card is 2,830 bytes, the largest lens 557.
- **Card grammar.** `factTest` in src/stages/rows.mjs extends factOf and says why a record sentence is not a fact; src/crew/lints/grammar.mjs reads every 1.8.0 card line against it. Thirteen hand-written synthetic live failure shapes (tests/fixtures/live-shapes/) and 100 or more generated variants are each held as `card_grammar`; the cards the stages build pass. The deny-lists stay as the first net.
- **In shadow.** Each dispatch adds two activity lines, `Crew lints, in shadow:` (findings counted by lint id) and `Crew checks, measured after acting:`; nothing is held, hidden or changed. The golden test leaves out exactly those two lines, so all 35 recorded reports are still checked byte for byte; three meetings reports were re-recorded because they now carry the `good_meetings_counted` event, and with events left out all three match the earlier recordings.
- **Findings.** N02: events[] carries what the engine itself can prove closed (a verified receipt, his counted Monday answer, his signed spec). N06: a row whose words he called off twice in 28 days becomes one `gmd-` doctrine review a week. N09: prompts/trust-asset.md takes the contract's three trust formats. N07: scripts/mutate.mjs re-runs the 15 declared mutations (invariants/mutations.json), 15 of 15 killed, in CI. N08 partly: scripts/check-drift.mjs checks NOW.md's head and files and the protocol header; docs/history/LOG.md now exists.
- **F48.** A live run that read nothing (`nothing_read`), whose advertised context could not be read (`context_unread`, the manual-24 shape), or that read people and stages and neither prepared nor held one (`nothing_prepared`) still sends and reads back its report, then journals a failed attempt with that class. A synthetic run is unchanged.
- **Regression tests.** tests/regression/ holds F08 (operate.yml against OPERATIONS.md and the CLI), F10 (the link check; the copied protocol's three links out of the repository fixed again), F15 (live reuse and recovery_report_mismatch), F18, F21 and F48. The register now has 46 fixes guarded by a test, and 15 of 20 findings closed.
- **The library.** library/taxonomy.json is generated from docs/DRIVE.md with a drift check; scripts/check-library.mjs counts a listing, and on the synthetic one finds exactly one loose file, one duplicate, a second PDF in a Current and one stale copy. Every naming example in docs/DRIVE.md passes. Unknown until Control Center serves the listing.
- **Verified on:** the seven repository checks, with 351 tests (42 new), and `npm run mutate`.
- **Timing.** The change touches two word files (rows.mjs and signals.mjs), so it merges just after a morning run, never before one.
- **Live proof:** none yet.
## First live run at 1.10.0, 27 October 2026

Live run, not a live outcome. Control Center production carried krishanraja/control-center#584; a manual `dispatch` run on main reported at 1.10.0 and was read back: the four 22 October campaign plans resting on Advisory records Control Center no longer holds are expired with `done_evidence.kind = withdrawn`, the plan that still matches its record stays pending, and the report carries the two traffic activity lines with the consent sentence. No traffic figure appears in the Actions log. The meetings part reads unavailable (`calendar_not_read`) until Control Center's first 05:10 calendar read, so the number stays unmeasured, never zero. Closes N20 and Phase 0.

## The show-notes note, and dead plans taken back, 27 October 2026

Built and tested; pairs with krishanraja/control-center#584. Once one of Jonny's pitches to someone else's show or stage is booked (`booked_at` on a `job: booked` Jonny draft), the engine writes one short note in Jonny's voice thanking the host and asking for the brief link in the show notes or event page, the canon's brief URL tagged `growth-podcast` or `growth-guest-seat` (`src/stages/shownotes.mjs`, the one stage that writes a tagged link). It is ranked before any new pitch inside Jonny's ten a day, once per booking, never to a guest on his own shows, with no objective. The dispatch also withdraws pending campaign plans whose Advisory record Control Center no longer holds (`withdrawn`, only with complete Advisory records, never a decided one). Both are sent only where Control Center's capabilities say so, so nothing changes before it deploys. Six deliberate breakages each failed a test.

## The week spec, compiled (plan Phase 2), 27 October 2026

Built and tested; not live. Nothing in a report changes until the week of 9 November, and the first signable spec takes effect at the first run after he signs it.

- **The spec.** `growth-week/1` (specs/schema/week.schema.json, its SHA-256 frozen in contracts/manifest.json and checked by `npm run contracts` with a synthetic example in specs/examples/): every lane on or off with its cap, pitches per run, the stage share, invites a run and a week, the shows' split, forms per row, a fit floor of 40 or higher, the assets in play, one experiment and his questions. Canonical JSON of 8,000 characters or fewer, with no people, ids or private links.
- **Compiled inside the bounds (N04).** `src/crew/compile.mjs` turns a spec into the caps the stages read. `config/policy.json` gains `bounds` for every cap (today's values sit inside them), Jonny's ten drafts a day and the ruled visibility targets in `recognition`. A value outside a bound is refused, never clamped; no field can carry a bound, an amount, a cost or any authority, so zero spend is enforced in the compiler. The stages read the caps with today's values as defaults: rows a lane, the fit floor, pitches per run, the stage share, invites, the 70/30 split and forms per row. `acquisition`, `venture` and every `execution` field are read where they belong; `voice` and `pilot` stay unread, with the reason in invariants/register.json.
- **Signed on Monday.** From the week of 9 November the dispatch posts `gms-<monday>`: a strategy plan with the spec as its exact words, expiring at the end of its London week, its evidence fixed so its digest never changes on its own. While his taps after each meeting are not served it also carries last week's good-meeting counts to confirm, so the `gmg-` ask folds into one Monday ask. His Clear signs the digest posted; "Change it first" signs his version only after `amended_sha256` is recomputed. Only `gmc-` campaigns reach prepare-action.
- **Holds and fallback.** An amended spec that fails the schema or a bound is held `spec_amended_invalid`; an oversized one `spec_too_long`, never thrown. The spec in force is this week's signed one, else last week's (up to 7 days), else today's settings with `spec_unsigned`, which never marks a run as held because the signature is his to give.
- **Jonny's day.** A later wake the same London day writes only what is left of the ten Jonny drafts a day, counted from that day's drafts in Jonny's box.
- **rows_rule and N14.** Control Center's `rows_rule` is read as data only (its SHA-256 and length), since this engine owns the doctrine (N03 closed). `strategicPlan().digest`, which nothing read, is removed (N14 closed).
- **Verified on:** the seven repository checks, with 304 tests (16 new in tests/spec.test.mjs and tests/golden.test.mjs). Every earlier dispatch fixture's report digest was recorded before the change and is checked byte for byte (tests/golden/), with a new fixture that reaches every cap recorded on the code before the spec. Seventeen deliberate breakages of the new rules were each caught by a failing test.
- **Timing.** The change touches two word files (rows.mjs and pitches.mjs), so it merges just after a morning run, never before one, or every pending row on his phone reads stale.
- **Live proof:** none yet.

## The traffic reading (Phase 1b), 27 October 2026

Built and tested. The Measurement Specialist reads mindmake.co from the directive's `web_analytics` block (the Google Analytics store Control Center already serves makeyourmindup at 1.10.0) and reports two activity lines a run: the whole site, 7 days against the 7 before, then what the engine's placements sent (tagged `growth-<path>` visits by path, and referral visits from the shows and stages he was booked on). Each line ends "Counts only visitors who press Allow, so it is a floor and a trend, not a total." Traffic is never an objective, and no figure or measurement id reaches the printed run result. One tag builder (`tagged`) adds exactly `utm_source=growth-<podcast|guest-seat|one-sheet>&utm_medium=referral` to a mindmake.co link and strips back to it; row words, pitches and citations carry no tag. Four deliberate breakages each failed a test. Until Control Center puts mindmake.co in Mindmake's directive, the line says it is not served yet.

## The number from his taps, 27 October 2026

Built and tested; merges with Control Center's side (krishanraja/control-center#582). Once Control Center serves his held meetings (1.10.0, `features.meetings`), good meetings are counted from his one tap after each: a meeting he marked good, in the London week it was held, by the path recorded at his tap. The Monday ask is then no longer posted; it stands in whenever the meetings are not served or not available. A read Control Center says is incomplete is never the number: the count is missing with its reason, and the line calls the floor a floor. Each run also says where each unanswered meeting came from (`origin_candidates`, at most 40, one a person, oldest first), from the engine's own records only: a guest on his show, a show or stage whose booking contact they are, a row he carried out about them, an Advisory pilot, then a warm tie; a person the records say nothing about gets none and is recorded as unknown. Contact ids only. The protocol copies in `docs/control-center/` are brought up to 1.10.0. Four deliberate breakages each failed a test. 281 tests. Not live until Control Center applies its migration and serves the part.

## Control Center registers the number, 27 October 2026

Control Center side, merged and applied live (krishanraja/control-center#580, migration `20261112120000`). Mindmake's registry row now holds `good_meetings` (20 a week by 30 November), `podcasts_booked` (2 a week) and `stages_confirmed` (1 a fortnight) beside its five earlier objectives, read back from production; no other engine changed. Control Center's next action now weighs the gap on the keys this engine already reports, instead of treating them as unknown. Step 1 of protocol 1.10.0; the held meetings and his good tap are next. The Control Center change that retired its "already grows Mindmake" rule (krishanraja/control-center#579) is deployed to production.

## Stage forms give mindmake.co, and a PDF hashes as bytes, 27 October 2026

Built and tested; merged just after a 05:10 UTC run, because pitches.mjs is a word file and a merge stales the rows on his phone. Ruling (Krish, 2026-10-27): "mindmake.co for all mindmake venture things". A stage form's website field is now `https://mindmake.co`, and so is a company website field, which the engine used to leave blank; `https://krishraja.com` is given only where the field's own label asks for his personal or speaker site. `blobSha` hashes raw bytes when given bytes, so the one-sheet PDF can be named by the SHA git gives it (N17, closed). Each change was broken on purpose and failed one test.

## The register of every past fix (plan Phase 0, part), 27 October 2026

Merged by the session. `invariants/register.json` holds 48 fixes (F01 to F48: 40 guarded by a named test, 4 partly, 4 with a reason and a phase) and findings N01 to N19 (7 closed). tests/register.test.mjs checks ids, sources and phases, that every named test exists by its name, and that no unguarded fix is marked done; four deliberate breakages each failed one test. Ids the plan names keep their meaning; the others are numbered in the order their fix landed. Plan section 12 now carries the Control Center migration inventory (M1 to M13). 275 tests.

## Each wake is its own run (N01), 27 October 2026

Merged by the session; not live until Control Center's next wake. The daily and refill wakes run `dispatch --kind dispatch-<run number>`, so a same-day refill reports new rows under its own run id instead of replaying the morning's report; a re-run of the same wake keeps its number and reuses its report (F15 unchanged). OPERATIONS.md states the dispatch job's ten-minute timeout (F22). tests/workflow.test.mjs pins both. The seven repository checks pass.

## The number, wired (plan Phase 1), 27 October 2026

Built and tested; merged by the session per Krish's go of 27 October. Not live until the dispatch's next run reports, and the first count needs his answer.

- **The number.** `good_meetings` leads every report's objectives. From Monday 2 November the dispatch posts one Monday ask, `gmg-<last week>`: a strategy plan holding every path as null. It is counted only from his "Change it first" version after its `amended_sha256` is recomputed. A Clear without numbers, a decline, an unreadable answer or decisions that cannot be read leave it missing with the reason, never 0. The weekly target comes from the ladder read from docs/NORTH_STAR.md, or from Control Center's refresh when it is a number (Mindmake's read "private").
- **Bookings.** `podcasts_booked` (this London week, against 2) and `stages_confirmed` (the last fourteen days, against 1) come from each pitch's `booked_at` in the 1.9.0 context, and are missing when pitch outcomes are not served completely.
- **Safety (N15, N16, N18).** Only `gmc-` campaign plans reach prepare-action. An amended plan or go-live is acted on only after its digest verifies, else `amended_digest_mismatch`. A campaign plan over 8,000 characters is held as `payload_too_long` instead of failing the report.
- **Directive (N03, N10).** The directive's North Star figures and constraints are read as data. The constraints are reported in shadow, holding nothing yet. Every report carries the standing `founder_visibility_open` hold, which never marks a run as held.
- **Control Center's side.** docs/CONTROL-CENTER-BRIEF.md now lists exactly what protocol 1.10.0 owes, in build order.
- **Verified on:** the seven repository checks, with 268 tests (13 new in tests/meetings.test.mjs). Six deliberate mutations of the new guards were each caught by a failing test.
- **Live proof:** none yet.

## Trusted-distribution session closeout, 27 October 2026

Documentation closeout only. The [dated handoff](history/2026-10-27-growth-session-handoff.md) records the completed 22 October release through Control Center PR 523 and growth-mindmake PR 7, its authorised migration/configuration readback, preparation-only canary and replay, and the subsequent private route preparation. It supersedes the outstanding production-release gates in the original 22 October local-build note below. It establishes no verified external action or commercial result.

The 27 October read-only refresh found the earlier plans still pending, their original Advisory identities unresolved and their prepared action windows expired. Reconcile current private lifecycle state before resuming. Later main-branch human-action and mailbox rules take precedence over the older executor context. Current 1.9.0 forms and mailbox work retains its own acceptance gates below; this closeout neither runs nor releases it.

## Forms on his tap (protocol 1.9.0), 27 October 2026

Built, tested and merged (krishanraja/growth-mindmake#20); not live. Ruling (Krish, 2026-10-26): a form is filled for him and his tap submits it; when it cannot be, the most automated next best route. A stage whose own speaker call or guest form Control Center has read (`cfp_url`, `form_fields`) gets a version 2 `form` action (no recipient, no mailbox, the form's page and every answer by the field's own label) on events for a stage to speak on or on visibility for a podcast or a show, about the stage (`target:<id>`), closing on `form_submitted`. Answers come only from the canon and his own site's record read this run, his name, Mindmake, his ruled title, `https://krishraja.com` and the one address `hello@krishraja.com`; never a phone, an address, a payment, a date of birth, a demographic question, a number or a ticked box. A required field the run is not sure of, a required terms box, no email, or labels Control Center's runner would confuse hold it (`form_unanswerable`, `form_terms`, `form_no_email`, `form_labels_overlap`) and the stage falls to its Jonny pitch; a `not_sent` try is answered again or held (`form_blocked`). At most two a row, leading the row; outside the ten pitches; a form-routed stage is not pitched (`speak_form_route`, `pitch_form_route`, `form_sent`). Every action parses with a port of Control Center's own `parseActionV2`. Needs Control Center to serve `form_fields` and `forms` in the context and its Submit press; a context with no form fields writes no form. Not live until a run writes one and Krish presses Submit on it. No live run yet.

## Guest invites onto his shows for Jonny's Gmail (protocol 1.9.0), 27 October 2026

Built and tested locally; a pull request. Guests Control Center holds with a contact, a show (`invite_show`) and an address on record, judged `take` or `stretch`, open, not invited before and not like a No, become 1.9.0 visibility rows naming Jonny's box and the guest (`contact:<id>`), closing on `visibility:invite`, ranked before the podcast pitches. Four a week by the shows' shares (Make Your Mind Up 3, Signal & Noise 1), counted from carried-out invites since Monday in London; at most two a run, inside the ten. Holds are counted as `invite_<reason>`. Stage and podcast reach now carry `audience_size` with its page and time. Needs Control Center to serve its guests (with `invite_state`) and their routes in the context and to file a Jonny-box invite as a guest draft; a context with no guests writes no invite. No live run yet.

## Speaking pitches on EVENTS for Jonny's Gmail (protocol 1.9.0), 27 October 2026

Built and tested locally; a pull request. Stages to speak on (conferences, calls for papers, speaking slots, webinars and panels) whose own page gives an address for speakers, open and before their deadline, become 1.9.0 events rows naming Jonny's box and the stage (`target:<id>`), one ask (a talk or a panel seat) with one talk title, in Jonny's voice from the same live reads as a podcast pitch. Ten a run between podcasts and stages; stages keep up to four. Holds are counted as `speak_<reason>`. Needs Control Center's 1.9.0 with Jonny on events (krishanraja/control-center#575); until it serves 1.9.0 nothing is written. No live run yet.

## Podcast pitches for Jonny's Gmail (protocol 1.9.0), 27 October 2026

Merged (krishanraja/growth-mindmake#17). Up to ten pitches a run to podcasts Control Center holds with an address the show publishes for itself, each a 1.9.0 visibility row naming Jonny's box and the show (`target:<id>`), in Jonny's voice for Krish, from the canon and krishraja.com's own receipts read live; a show already drafted or answered, quiet for 120 days, applied, rejected, buried, his own, or ruled out by a No is held and counted. Reported only where Control Center serves 1.9.0 (`pitch_needs_1_9_0` otherwise), so merging before Control Center deploys changes nothing. Control Center drafts them into Jonny's Gmail; the engine never drafts or sends. Also the round-2 leftovers: no honorific in a title, a partner email names who they back, no false "no email on record", the `signal_noise` slug. Live once Control Center serves 1.9.0 and the next run reports.

## Card words round 2, 27 October 2026

Merged (krishanraja/growth-mindmake#15 and #16) and live from run `mindmake:2026-10-27:manual-23`. After the second live 1.8.0 run (`mindmake:2026-10-27:manual-21`): a first name is never a title, a fit verdict or a judge's clause never reaches the card, partner angles name the company, an appearance names its show and is never on Krish's own shows (`own_show`; an unnamed channel is held and asked about once a month), what he gets names the show, topics are specific or null, and appearance pitches call him Executive Host of Signal & Noise (Ruling, Krish, 2026-10-27).

## Card words are facts, not notes, 27 October 2026

Built and tested locally; a pull request, not merged or deployed. After the first live 1.8.0 run: a judge's note or an instruction never reaches why, a prompt is cut back to the fact before it, the angle opens with the fact quoted whole (the quote gives way when both will not fit), each reach is said as what it is rather than as the room of leaders, VISIBILITY counts a channel only where the record says they own it, and research pages are named by title or site, four at most. No contract change (still 1.8.0). Live once merged and the next run reports.

## The full card (protocol 1.8.0), 27 October 2026

Built and tested locally; a pull request, not merged or deployed. Every row proposal carries `card` (who, known, why, gain, angles, sources) at 1.8.0 only, mirroring Control Center's `parseCard` (krishanraja/control-center#571); a 1.7.0 Control Center gets the line and the brief without the card, and the brief's known line now says the same as the card's. A card that cannot say who and why is held as `thin_card` with a monthly profile question; an appear ask needs a channel the person owns. Schemas copied from control-center `4766118d`. Live only once Control Center serves 1.8.0 and a run reports with it; a card he reads and acts on is the outcome, not this record.

## Whole card lines, 27 October 2026

Built and tested locally; a pull request, not merged or deployed. The first live 1.7.0 run (`mindmake:2026-10-27:manual-18`) showed `because` lines cut mid-phrase. A line is now built only from whole pieces, never cut at a word, and raw lower-case titles are title-cased. Live once merged and the next run reports.

## Rows he can decide on (protocol 1.7.0), 27 October 2026

Built and tested locally; a pull request, not merged or deployed. Rows rank by Control Center's Mindmake fit, leave out competitors and anyone under fit 40, and fill NETWORK from the last email. Every row carries `because` (at most 80 characters, whole) and `brief` at 1.7.0 only, with a title of at most 56; an older Control Center gets the rows without them. Live only once Control Center serves 1.7.0 and a run reports with it; a card he acts on is the outcome, not this record.

## Trusted distribution implementation, 22 October 2026

Built locally across the producer and Control Center shared protocol. Adds
scoped context/outcome reads, campaign selection, a stable weekly review,
the ten-held-intro target and the two-week/one-workflow pilot policy. The
existing commercial activation date is retained. The shared executor has
exact approval, native revision, durable claim and independent receipt gates.
Its native lifecycle completion reuses Control Center's existing done checks.

Local verification includes paginated source coverage, London DST boundaries,
cross-engine isolation, campaign and proof gates, full outcome counting,
provider receipt matching and PostgreSQL claim/recovery/permission checks.
The seven frozen version-1 contracts remain byte-identical.

Production migration, deployment and a daily canary remain release gates.
An approved external action and its real receipt remain an acceptance gate.
No local test establishes a meeting, invitation, paid proof or recognition.

## Copy and offer doctrine, 2026-10-19

Krish supplied *The Copywriting, Offers and Demand Corpus* on 19 October 2026 with the instruction that every growth engine be imbued with it. This entry applies it to the drafting surfaces. It changes no runtime code, contract, policy or output shape.

| Layer | State | Evidence |
| --- | --- | --- |
| Preserved originals | Built | `_corpus/copywriting-offers-demand-corpus.md` (68,132 bytes) and `_corpus/copywriting-offers-demand-corpus-summary.md` (476 bytes), copied byte for byte and listed in `_corpus/manifest.json`; `.gitattributes` stops line-ending conversion in `_corpus/` |
| Doctrine | Built | [docs/playbooks/10-copy-and-offer-doctrine.md](playbooks/10-copy-and-offer-doctrine.md), with its list of where this engine's rules change the corpus |
| Wiring | Built | Shared prompt rule 9, the six drafting and review prompts, playbooks 01, 03 to 07, the playbook index and AGENTS.md |
| Tests and checks | Pass on synthetic data | Integrity check fails when one byte of the preserved copy changes and passes once restored |
| Merged, deployed, activated | Not yet | Branch only. Prompts are optional review contracts; no model integration applies them automatically |
| Commercial outcomes | Not established | A better draft is not a qualified conversation or a paid proof |

The seven frozen contracts and their digests are unchanged.

Verified on 19 October 2026: `npm run contracts`, `npm run check`, `npm test` (152 pass, no failures or skips), `npm run conveyor` (14 stages, 21 edges), `npm run demo -- --summary`, `npm run demo:review` and `npm run demo:engine` all pass. No call was made to live Control Center.

## Control Center protocol adoption, 2026-10-19

Krish authorised every growth engine to adopt the Control Center protocol and run on its daily dispatch (2026-10-19). [CONTROL-CENTER-BRIEF.md](CONTROL-CENTER-BRIEF.md) now supersedes the handoff below as the contract.

| Layer | State | Evidence |
| --- | --- | --- |
| Protocol client and dispatch run | Built | `engineClient` in src/control-center.mjs, src/dispatch.mjs and `node src/cli.mjs dispatch` |
| Tests | Pass on synthetic data | 152 of 152 tests, 15 of them for the dispatch against a local protocol stand-in: worked-example digest, schema-valid report, replay, 409 conflict, 401, lost response, `engine_inactive`, decisions and CLI redaction |
| Runner | Built, not merged | The `dispatch` job in .github/workflows/operate.yml on branch `claude/adopt-cc-protocol`. It runs only from main, so nothing runs until the branch is merged |
| Activation | Recorded by Control Center, not observed here | Control Center switched the engine on with dispatch on 2026-10-18. No live run of this code has been observed from this repository |
| Snapshot source on the runner | Unverified | The dispatch job reads `GROWTH_ENGINE_TOKEN` without the `growth-runtime` environment. If that secret is environment-only, live runs hold with `source_credential_unavailable` until it is a repository secret |
| Full engine cycle, live | Held | Its job-context route was retired by the protocol; live runs report `engine_context_route_retired` |
| Objectives | Missing, with reason | Neither `qualified_conversations` nor `paid_proofs` can be measured until Control Center serves complete Mindmake outcome records |
| Commercial outcomes | Not established | Require recorded human-confirmed conversations and verified payments |

The dispatch never sends, posts, spends, drafts into Gmail or commits an Advisory batch. The seven frozen contracts and their digests are unchanged.

Verified on 19 October 2026: `npm run contracts`, `npm run check`, `npm test` (152 pass, no failures or skips), `npm run conveyor` (14 stages, 21 edges), `npm run demo -- --summary`, `npm run demo:review` and `npm run demo:engine` all pass. No call was made to live Control Center.

## Producer 2.0.0, 2026-10-17

**Full producer v2.0.0 is complete and verified. Control Center implementation remains pending.** This release completes the original growth-repository portfolio, beyond the earlier outbound and reporting subsystem. The user's scope correction limits implementation to growth-mindmake and one downstream handoff.

| Layer | State | Evidence |
| --- | --- | --- |
| Full growth producer 2.0.0 | Complete and verified | 137 of 137 synthetic tests pass, no failures or skips; all seven campaigns and ten work types execute through the real HTTP test boundary |
| Public contracts and handoff | Complete | Seven frozen version-1 wire contracts, exact SHA-256 manifest and one consumer implementation brief |
| Control Center implementation | Pending a separate owner | Must implement the frozen handoff and its acceptance matrix |
| Consumer schema, deployment and activation | Pending | Require migration readback, reviewed promotion, authenticated canary and an actual activation record |
| Commercial outcomes | Not established by this release | Require global human-confirmed conversations and verified proof payments |

The [Control Center PR 469](https://github.com/krishanraja/control-center/pull/469) was an unmerged proposal when this record was written. The Control Center brief of 2026-10-18 says it merged that day; this repository has not verified that independently.

## Frozen release identity

Producer package version is **2.0.0**. The [version-1 manifest](../contracts/manifest.json) freezes growth.ts, reporting.ts, operations.ts, engine.ts, motions.ts, lifecycle.ts and research.ts, each with its exact SHA-256 digest. The [single consumer handoff](CONTROL-CENTRE-HANDOFF.md) mirrors those digests and specifies the import layout. `npm run contracts` independently verifies the source bytes against the manifest in CI. Exact digests and feature support are binding; wire version 1 alone does not imply compatibility with the earlier release.

Use the manifest and the repository's published Git revision as the exact source identity. A package version or a contract hash identifies producer artifacts; it does not establish consumer parity, deployment or activation.

## Verification record

Verified on 17 October 2026:

- `npm run contracts`: pass, all seven frozen source digests match.
- `npm run check`: pass, source syntax, JSON, style and value-redacted secret checks.
- `npm test`: pass, **137 tests**, zero failures and zero skips.
- `npm run conveyor`: pass, **13 stages and 19 edges**.
- `npm run demo -- --summary`: pass, synthetic daily preparation remains dry and explicitly page-scoped/provisional.
- `npm run demo:review`: pass, synthetic global weekly context and recorded feedback produce a bounded dry review.
- `npm run demo:engine`: pass, eleven explicit synthetic jobs across all ten work types; five prepared and six explicitly held under the shared default cap.
- Documentation/workflow checks: pass, local links, exact manifest mirrors, manual dispatch, complete-engine dry default, read-only readiness and no scheduled trigger.

The synthetic HTTP consumer exercises actual producer transport for capabilities, full work context, every commercial motion, artifact persistence, complete report readback, attempts, weekly review and recovery. Each of the eleven jobs is also exercised independently so the shared cap cannot hide an untested later stage. Replays preserve identity; changed facts conflict. Tests cover pre-ingest failure, lost responses, distinct destination records, disclosure, suppression, exact recipient, explicit holds, global-versus-selected scope, feedback and actual activation windows.

Independent review exposed and corrected oversized valid research aborting other work, aliased destination records, a false first-commit replay flag, ungrounded speaking dates, loose artifact closure routing and commercial decisions losing priority to new acquisition. Original reproductions and adjacent checks pass. The full suite also preserves the prior nested global-provenance regression.

## What the full upgrade adds

The executable campaign registry now drives warm notes, researched named outreach, useful follow-up, all introduction permission stages, actual inbound handling, qualification reviews, bounded proof scopes, paid capability handoffs, selected founder or practice drafts, host pitches, reusable aids and research tasks or proposed enrichment. Artifacts include usable content, sources, uncertainty, exact destination, pending approval and matching-event closure. The [full scope matrix](FULL-SCOPE.md) maps these responsibilities to their boundaries.

`engine` is the complete CLI and manual runner mode. One cap applies across the whole cycle. Requests and existing commercial work lead new acquisition and assets. The older `daily` interface remains available. Weekly review adds attributed outcomes, promises, proposal decisions, observed founder effort and a recorded experiment. Unknown values remain unknown. Source acquisition and editorial or delivery execution remain with their existing authorised owners; no new provider, scheduler, CRM or user interface was introduced.

## Scope and remaining gates

No Control Center repository edits, migrations, deployments, live ingestion, schedule activation or production verification form part of this producer-only completion. No activation date was fabricated. The manual workflow enables no recurring schedule. No message, post, subscription or spend was performed.

The per-run dashboard is deliberately selected-page and provisional. The future consumer must derive complete global business outcomes separately, implement the authenticated human dashboard and single action lifecycle, and persist matching-event closure evidence. The producer's synthetic consumer proves its protocol; it does not prove that those production capabilities exist.

The next deliverable is concrete: [CONTROL-CENTRE-HANDOFF.md](CONTROL-CENTRE-HANDOFF.md). It contains the complete work protocol, exact contracts, source and human-action requirements, global London counting, weekly learning, recovery, security, schema-before-promotion order and acceptance matrix. The published repository and manual runner are this producer's deployment artifact. Implementing and activating the private consumer remains separate. Commercial target attainment requires observed outcomes after real activation.
