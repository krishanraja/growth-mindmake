# Brief: "Inside my AI-native firm", a LinkedIn series built on the work-building video, 18 November 2026

Handed over from a content-engine session on 2026-11-18 at Krish's request: "send the idea to growth-mindmake repo now to
execute", then "be detailed and reference all the work done in this session (new session will have zero access to this
one)". This brief is written so a session here needs nothing from that conversation. It authorises no post, schedule,
send or spend on its own: every one still takes his yes on the exact words, every time.

## The outcome Krish asked for

His words, 18 November 2026: "note for later that we will add this video to one of my linkedin posts (the ultimate
outcome of this is a series of linkedin posts scheduled in Buffer."

So the finish line is a series of posts on his personal LinkedIn, queued in Buffer, one of them carrying the video below.
His personal LinkedIn is this engine's (docs/OWNERS.md; docs/GET-GOING.md 1.4). Two notes on how that meets what is
already written here:

- **Buffer, not only the composer.** 1.4, 1.4b and 1.4c say each post opens "in the composer for his click". For this
  series he named Buffer scheduling as the outcome. Scheduling a post is a publication: prepare every post, show him the
  exact words and the exact slot, and put nothing in Buffer as scheduled until he says yes to that set. A Buffer draft
  or idea is the most this engine creates before his yes.
- **It fits 1.4c, "the named system post".** 1.4c asks for a working system laid out as one diagram, premium, with the
  system as the value. The building video is that diagram for his own firm. Treat this series as the first live run of
  the `linkedin-thinking` lane (1.4) in the 1.4c format, and record what it teaches there.

## What was made in content-engine, and where it is

A 12 second animated 3D cutaway of a building, 1080 by 1350 (4:5, LinkedIn's tall feed format), that draws an AI-native
firm floor by floor, with toy figurines at work on every floor. It builds itself on screen, then day turns to night.

**The files (Krish asked for them to be filed in his Mindmake folder):** Google Drive, `My Drive > Ventures > Active
Ventures > mind/make > 00_Brand-Assets > 03_Social-and-Ads`:

- `2026-11-18 Inside my AI-native firm - floor by floor - video 12s 1080x1350.mp4`
- `2026-11-18 Inside my AI-native firm - floor by floor - day still.png` (2160 by 2700)
- `2026-11-18 Inside my AI-native firm - floor by floor - night still.png` (2160 by 2700)

Their Drive file ids are in content-engine, `lab/universe/PLAN.md`, "Where this is going" (kept out of this public
repository). Search Drive by those titles to find them.

**The source, all on content-engine main** (attach `krishanraja/content-engine` to a session to read or re-render it):

- `lab/universe/PLAN.md`: the brief, every version, Krish's words on each, the figurine contract and where the files are.
- `lab/universe/scene/scene.js` and `scene/index.html`: the scene. `LEVELS` holds every floor, room and worker; `CARDS`
  holds the side panel's words. Change them there, never from this brief.
- `lab/universe/figurines/index.js`: the toy figurines, built by Codex from two content-engine cards
  (`docs/ve/cards/universe/ve-universe-figurines.md` and `-2.md`) and checked by `lab/universe/figurines/check.mjs`,
  which Claude wrote so Codex never graded its own work.
- `lab/universe/render3d.cjs`: renders the video and stills (Playwright and ffmpeg). It needs three.js 0.170.0 at
  `lab/universe/vendor/three.module.js` and the logo files in `lab/universe/logos/`, both ignored by git: install
  three.js from npm and fetch the logos through Brandfetch again (claude, openai, github, vercel, supabase, elevenlabs,
  runway, canva, buffer, gmail).
- Content-engine pull requests, all merged: #855 (version 1), #857 (version 2 plan and the first Codex card), #859 (the
  3D scene and Codex's first figurines), #860 (Codex's second pass), #862 (version 3), #863 (filing and this outcome).

**What it shows (version 3, the one filed).** The headline reads "Inside my AI-native firm / floor by floor" by day and
"And it keeps working / after I log off" by night. Top to bottom:

| Floor | Rooms | Workers (each a figurine with one small action you can see in under a second) |
|---|---|---|
| Roof: the decision deck | none | Vision, Judgement, You, the CEO (a human figure), Taste, Standards |
| 1 Watch + ideas | Reading room, Idea lab | Link reader, Inspiration scout, AI search probe, Divergent thinker, Idea ranker, Trend radar |
| 2 Write | Research desk, Script room | Researcher, Fact checker, Scriptwriter, Voice checker, Clarity coach |
| 3 Make | Edit suite, Design studio | Video editor, Voice + music, Motion designer, Cover designer, Carousels, Builder |
| 4 Share | Posting desk, Community | Scheduler, Poster, Results reader, Replier, Amplifier |
| 5 Sell | Account research, Call room | Account researcher, Call prep, CRM updater, Notetaker, Outbound drafts, Follow-up |
| 6 Build | Workshop, Test lab | Coder, Reviewer, Deployer, Tester, Fixer |
| Basement: the AI brain | Archives, Chief of staff, Analysis | Chief of staff (centre, in front of the glowing brain), Librarian, File archive, Content archive, Inspiration house, Taste + standards, Auditor, Analyst, Trend spotter, Learnings |

The side panel gives each floor three plain lines and what it hands off, for example "Build: build the tools and apps
behind it all; review and test every change; ship it, and fix what breaks, fast. Hands off: tools that keep working",
and "The AI brain: a proactive chief of staff running it all; librarian, auditor, analyst, trend spotter, archives;
keeps my taste and standards, learns every fix. Hands off: every floor runs on this". The exact words are in `CARDS`.

**The AI brain is the point, shown quietly.** Krish asked that the piece "subtly show how important AI Brain in the
basement is as being the most important foundational piece". In the video the brain lights up first and every floor
lands on top of it; mint lines carry pulses from it up to every floor; at night it glows brightest and lights the
building from below; its card is the only one in mint, "Every floor runs on this".

**Logos.** Claude agents are terracotta with the Claude mark on their legs; tool agents wear their tool's mark on their
head (GitHub, Vercel, Gmail, Buffer, Runway, OpenAI for Codex, ElevenLabs, Canva, Supabase). These are real company
marks, fetched from Brandfetch. Whether to keep all of them in a public post is his call; ask once before the first post.

## How it got here: his corrections, in his words

Each one is a rule for this series too.

1. The reference he sent: a LinkedIn post drawing a six-layer AI-native firm as an animated 3D cutaway building, day to
   night, built around Sequoia's line "The next $1T idea is the AI-native firm". He asked for "a version of this that
   describes my universe".
2. On version 1 (a flat drawing of his whole venture portfolio): "turn all the characters in to tiny figurines that have
   their own personalities and do little actions ... make it the smallest available movement or visual trait that can be
   observed in 1 sec and even on a small screen. Have the building animate in to existence too. Also, scrub all mention
   of my actual ventures and keep this task/outcome focused only ... some with Claude logos on legs, some with other
   company logos on their heads ... involve Codex to produce the anchor visuals".
3. "Put everything in layman's terms as well, its important to not overwhelm people".
4. Then: "it's gotten too simple now in terms of words", and "make the wording 15% more descriptive".
5. On version 2: "i preferred the amount of workers and how they were roughly split out in this one - taste, judgement,
   vision, standards, inspiration, divergent thinker consultant, voice checker. Librarian is just one part of an AI brain
   - it's really the proactive chief of staff that has a librarian, auditor, analyst, trend spotter, inspiration-house,
   file archives as well as content archives and all the above. It's been dumbed down way too much now as has have all
   the floors above it. we need to find something closer to the source post I sent you".

So for the posts: no venture or product names, the work and its outcomes only; plain everyday words that still say
something specific (not dumbed down); a rich, credible picture of the firm; the AI brain as the foundation every time.
Corrections 4 and 5 are in his taste ledger (venture publication, 18 November 2026).

## The series content-engine proposed (his yes on the outline is still open)

Eight posts, one floor each, three a week (Monday, Wednesday, Friday), about two and a half weeks. Each post carries a
short close-up of its own floor from the same building; content-engine can render those as camera moves on the scene it
already has, at no cost (ask it for them; production stays content-engine's).

1. **The whole building.** The filed video: what an AI-native firm looks like inside.
2. **The decision deck.** What he still decides himself: vision, judgement, taste and standards.
3. **Watch + ideas.** How ideas are found before they are obvious.
4. **Write.** Research to script, with a voice checker and a clarity coach.
5. **Make.** Video, motion, covers and carousels, Claude and Codex each doing their part.
6. **Share + sell.** Posting, replies, account research, and follow-ups he presses send on.
7. **Build.** The tools behind all of it.
8. **The AI brain.** The finale: the chief of staff in the basement that every floor runs on.

He has not yet said yes to this outline. Show it to him once, with your recommendation, before drafting all eight.

## What to do here

1. Read docs/GET-GOING.md 1.4 and 1.4c, docs/playbooks/10-copy-and-offer-doctrine.md and docs/RULINGS.md; apply his
   voice rules and the copy doctrine to every word.
2. Put the outline to him once, with any change you recommend for meetings (the North Star here is good meetings, not
   reach). Each post should send a buyer somewhere useful on mindmake.co, with its own tracked link (src/stages/traffic.mjs
   owns the tag builder), and the finale should make the AI brain the thing a leader wants for their own firm.
3. Decide the visual identity with him once: the video is drawn in the publication's palette (ink, mint and cream; Anton,
   Archivo, Fraunces and IBM Plex Mono), while 1.4c asks for Mindmake's own identity (its brand book is in the same
   `00_Brand-Assets` folder). Either he accepts it as made, or content-engine restyles the scene to Mindmake's identity
   and re-renders; the scene's colours and fonts sit at the top of `scene.js` and in `scene/index.html`.
4. Draft the posts privately (never committed: this repository is public), run the voice check and the untraced-claim
   check on each, and get the floor close-ups from content-engine.
5. Show him the exact posts with their slots. On his yes, and only then, queue them in Buffer on his personal LinkedIn
   channel ("Krish Raja", the one LinkedIn profile in his Buffer organization), and read each one back from Buffer.
6. Measure through Control Center: link clicks to mindmake.co and the meetings they lead to, never reach alone.

## What is not done

- His yes on the outline, on the logos and on the visual identity.
- The post words, the floor close-ups and anything in Buffer.
- Nothing has been posted, scheduled or sent.
