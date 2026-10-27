---
repo: krishanraja/growth-mindmake
product: Mindmake growth engine
as_of: 2026-10-27
head: fd2b8fd
lifecycle: building
production_url: none
state_doc: README.md
history_log: docs/history/LOG.md
truth_files: [docs/NORTH_STAR.md]
authority_order: [docs/NORTH_STAR.md, README.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
---

# Mindmake growth engine: where it is right now

## What it is

Mindmake's growth engine: relationships, introductions, researched named outreach, inbound and speaking, prepared for Krish to send.

## Who it is for and why it matters for Mindmake

The leaders who buy Mindmake's paid proofs. This is the engine that fills Krish's calendar with the right conversations.

## Where it is right now (as of 2026-10-26)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 2, "current": null, "current_as_of": null, "current_source": null, "urgency": 4, "urgency_reason": "not measured yet"} --> **North Star number: U4, far behind.** Qualified leader conversations a week, every one from a warm path or a room: not measured yet, against 2 this week, on the way to 20 by 30 November 2026. A bold swing every day; work that does not move the number waits.

Lifecycle: building. The detail is in `README.md`.

## What changed recently

- 2026-10-27 **Speaking pitches on EVENTS, for Jonny's Gmail (protocol 1.9.0).** Krish: EVENTS was empty, and his EVENTS is events to pitch to. Stages to speak on whose own page gives an address for speakers (Control Center keeps it as the booking contact) now get a pitch in Jonny's voice: one ask, a talk or a panel seat, with one talk title, open and before the deadline, never pitched twice or against a No. Ten a run between podcasts and stages; stages keep up to four (`src/stages/pitches.mjs`).
- 2026-10-27 **Podcast pitches in Jonny's voice, for his Gmail (protocol 1.9.0).** Krish, 2026-10-27: pitch him to as many podcasts as possible from Jonny's Gmail, "Drafted daily, no press", "For visibility Jonny sends"; the goal is one podcast a week. Each run now writes up to ten pitches (`src/stages/pitches.mjs`) to the shows Control Center holds with an address the show publishes for itself, live within 120 days, not pitched before and not ruled out by any No, best first by Nova's verdict, recency, whether his buyer listens and how long the show has run. Each is a visibility row naming Jonny's box, about the show (`target:<id>`), in Jonny's words: Krish in the third person as Executive Host of Signal & Noise, his publication and the brain door from the canon read live, and his track record from krishraja.com's own repository read live (`readRecord`, `krishanraja/krish-raja` `src/content/receipts.ts`, named by blob SHA). Control Center drafts each into Jonny's Gmail with no press; nothing is written until it serves 1.9.0. Also: a title never carries an honorific, a partner's email names who they back, "no emails between you on record" replaces "no email on record" where nothing was counted, and Control Center's `signal_noise` slug marks his own show. Built and tested; a pull request.
- 2026-10-27 **Card words round 2: no titles for names, no verdicts, the show by name.** The second live 1.8.0 run (`mindmake:2026-10-27:manual-21`) greeted "Hi Dr.,", wrote "Dr. has 10,000 to 100,000 followers", kept "Not a fit for mindmake since his business isn't AI-related" as a reason, gave every partner the same generic angles, offered a co-host of Krish's own show a guest spot on it, said "a guest spot on their channel" with no channel named, and tagged every broadcaster with the one topic. Now a first name is never a title, a verdict or a judge's clause never reaches the card, partner angles name their company, an appearance names its show (asked once a month when unnamed) and is never on Signal & Noise or makeyourmindup, and topics are specific or null. Ruling (Krish, 2026-10-27): pitches call him Executive Host of Signal & Noise. Merged (krishanraja/growth-mindmake#15 and #16) and live from run `mindmake:2026-10-27:manual-23`.
- 2026-10-27 **Card words are facts, not notes.** The first live 1.8.0 run (krishanraja/growth-mindmake#13, merged) carried Control Center's judging prose into why (what it could not find; whether someone is a buyer or a vendor), hooks written as prompts for an interviewer ("worth asking him to unpack on the podcast"), an opener that did not read, reach said as the room ("the leaders they back or gather: 10,000 to 100,000 followers on their profile"), VISIBILITY offered to people with no channel because "podcast" and "shows up" appeared in prompts, and sources labelled "Research, 2026-10-27" five times. Now a judge's note or an instruction is dropped and a prompt cut back to the fact before it (`factOf`, `leadFacts`), the opener is the fact quoted whole, each reach is said as what it is (`reachSentence`), a channel counts only where the record says they host, run, write or present it (`OWNS_CHANNEL`), and each research page is named by its title or its site, four at most. Built and tested; a pull request, not merged.
- 2026-10-27 **Every suggestion opens a full card (protocol 1.8.0).** Krish: "I need to be fully in the know as to who they are, why I'm getting in touch with them, what benefit I would have, and what angles to take." Each row carries `card`: who they are, how he knows them (emails each way, never contradicted), why them now, what he gets, one to three angles in the canon's own words, and its sources. A card too thin to say who and why is held (`thin_card`) and a profile question asked; VISIBILITY needs a channel the person owns. Reported as 1.8.0 only once Control Center serves it; until then 1.7.0 without the card. Built and tested; a pull request, not merged.
- 2026-10-27 **Card lines are whole.** The first live 1.7.0 run cut lines mid-phrase ("cited four times by.", "Co-Founder at.", "u.s."). A line is now built only from a whole first sentence, a whole title or the title up to its first separator; anything ending on a joiner, an initial or an internal slug is dropped, and raw lower-case titles are title-cased.
- 2026-10-27 **Every row says who, how he knows them and why them, and ranks by Mindmake fit (protocol 1.7.0).** The card line is at most 80 characters and the title 56, both whole. Ruling (Krish, 2026-10-27): every row suggestion says who the person is, how he knows them and why them, ranked by Control Center's Mindmake fit, never by followers alone; competitors and fit under 40 are left out. NETWORK reads the last email (Control Center never recorded a touch, so the row was empty). Built and tested; waits on Control Center serving 1.7.0.
- 2026-10-26 **The five rows on Krish's home screen are built here (protocol 1.6.0).** Amplifiers ranked by how far a yes travels (investors, connectors, AI-minded capital, mass AI trainers, student and CEO educators, broadcasters), close ties gone quiet, and worried executives who commented on posts about AI and their jobs, each a prepared send he carries out himself. Words come from Mindmake's canon read live each run, never the pinned copy, which had already gone stale (the main ask changed on 24 October). Every No and its reason is kept for good. Reports stay 1.2.0 until Control Center serves 1.6.0. Rulings: AGENTS.md, "The five rows and signals".
- 2026-10-26 **Krish's approved voice rules from the daily directive (protocol 1.5.0 `taste`) are carried into the drafting packets for a model drafting step.** No model drafting step runs yet, so today's template drafts do not use them. The packets leave out the quality gate; none approved or unreadable means none, never invented; no judge, score or rank receives them. Any 1.x directive is still accepted.
- 2026-10-23 **The North Star now has a number, a weekly ladder and an urgency rating.** Ruling (Krish, 2026-10-23): every repository chases one aggressive number on a weekly ladder, and urgency U1 to U5 sets how hard it pushes. The number is in `docs/NORTH_STAR.md`; contract: ai-harness `contract/north-star-metric.md`.

## What is next and what is waiting on Krish

- After Control Center serves 1.9.0 (krishanraja/control-center#575, which also lets Jonny's box serve the events row), run the dispatch once and read back the pitches: each about a show or a stage with its own address, in Jonny's words, none to one already drafted; then Control Center's drafts in Jonny's Gmail and, later, which ones answer.
- Measure the North Star number and record it on the first line under "Where it is right now".
- After Control Center's 1.6.0 is live, read the first live report with rows and spot-check ten reach figures against their sources.
- The pinned `APPROVED_CANON` in `contracts/growth.ts` no longer matches Mindmake's canon and its 30-day review lapses on 15 November; the snapshot path needs Krish's review of the current canon before then.
- North Star check (2026-10-26): holds. Rows aim every suggestion at a conversation through someone who multiplies trust or a buyer who raised the subject in public; the number is still unmeasured.
- North Star check (2026-10-27): holds.
- North Star check (2026-10-27, full card): holds. A suggestion he can understand in full is one he can act on, so more presses become conversations; the number is still unmeasured.
- North Star check (2026-10-27): holds. Fit-first rows spend his presses on people likely to become a qualified leader conversation, not on the biggest following; the number is still unmeasured.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- `README.md`: what this repository is and how it runs.

## Do not trust

Nothing at the moment.
