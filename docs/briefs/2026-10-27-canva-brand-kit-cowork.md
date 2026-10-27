# Cowork prompt: build the Mindmake brand kit in Canva

Status: ready to run (version 2, 27 October 2026; it replaces version 1, which did not make the session confirm which kit it was editing).

Ruling (Krish, 2026-10-27): build a full, new Mindmake brand kit in Canva first, by computer use on his PC, from his brand assets folder; he opens the folder and logs in to Canva.

Every value below was read on 27 October 2026 from the live Mindmake repository, krishanraja/mindmake at commit ddd0049, which wins over any other copy:
- `src/styles/mindmake.css` (blob a7beac7)
- `src/styles/mindmake-instruments.css` (blob 11069eb)
- `project-documentation/03_DESIGN_CONTRACT.md` (blob f82c82c)
- `project-documentation/00_NORTH_STAR.md` (blob 10c6e32)
- `project-documentation/01_CANON.md` (blob 0ce3eda)
- `src/assets/mindmake-mark.svg` (blob bb4db3f)
- `src/assets/mindmake-wordmark.svg` (blob 52004b6)
- `public/favicon.svg` (blob 63c032f)
- `public/mindmake-logo-512.png` (blob 9bdd4d2)

The four logo files were uploaded into Canva through its connector the same day. Canva rendered each one correctly, including the wordmark's pale-to-mint gradient.

**Before the session:** the cloud session records the ids of the brand kits Canva already lists. Afterwards, the one new id is the Mindmake kit.

Paste everything below the line into a Cowork session on Krish's PC.

---

You are building a new Brand Kit called **Mindmake** in Krish's Canva account, with computer use, while he watches. He has logged in to Canva and opened his Mindmake brand assets folder.

**Where you may work, and nowhere else:**
1. Canva.
2. His brand assets folder, read only, for fonts and imagery.
3. In Google Drive, the folder named mind/make (the slash is part of one folder's name; on a synced PC it may show differently), then 03_Growth > Growth assets > Brand kit:
   - its Source files folder, read only;
   - the Brand kit folder itself, to save one screenshot.
4. PowerShell, only to run Get-FileHash.

**Never:**
- open, rename, edit, duplicate or delete any existing brand kit, including one called "Mindmaker", or any existing design;
- set any kit as the default;
- change any kit's access, team visibility or brand controls;
- share anything, change any permission, or connect Google Drive or any other app or account to Canva;
- publish anything;
- accept any paid upgrade, trial or purchase (stop and tell Krish instead);
- type the name "Mindmaker" anywhere.

The brand name is **Mindmake**, written exactly like that.

**Stop and tell Krish** only for:
- a kit name other than Mindmake at the top of the kit page;
- a paid prompt;
- a hash that does not match;
- a font that is missing with nothing to upload;
- a file Canva refuses.

Some settings are optional because Canva may have no control for them: logo names, colour names, letter spacing, capitals or sentence case, a Light weight, and a button style. If there is no control for one, skip it, carry on, and list it in your report. Never substitute a different font or weight.

## 1. Create the kit and keep checking it

In Canva: Brand, then Brand Kit, then add a new brand kit named **Mindmake**.

Before each of steps 2 to 6, check that the name at the top of the kit page reads exactly **Mindmake**. If it shows any other name, stop.

## 2. Logos

The four logos are already in Canva's Uploads (added 27 October, unnamed, at the top):

| Logo | Size | What it is |
|---|---|---|
| the mark | 378 by 328 | two squares under two trapezoids, deep teal to mint |
| the wordmark | 648 by 109 | reading MIND/MAKE, pale to mint |
| the favicon | 1000 by 1000 | the mark on a square canvas |
| the mark on ink | 512 by 512 | on a near-black square |

Add each to the Mindmake kit's Logos, named "Mindmake mark", "Mindmake wordmark", "Mindmake favicon" and "Mindmake mark on ink".

Preview the wordmark on Ink `#0a100d`: it must run from pale `#e6ede8` to mint `#7fe3b4`. If it shows black, one flat colour or blank, remove only that logo from the Mindmake kit and report it.

**If the logos are not in Uploads:**
1. Put the four files from the Drive Source files folder on this PC, in a new empty folder (download them if Drive is not synced).
2. For each, run `(Get-FileHash -Path .\mindmake-mark.svg -Algorithm SHA256).Hash.ToLower()`, changing the file name each time.
3. Compare with this table, and stop if any differs. Then upload from that folder.

| File | Bytes | SHA-256 |
|---|---|---|
| mindmake-mark.svg | 2,536 | d1517af3047b6e4cd45f9e9613d4f4383b35b11e3408d659793925231360fae7 |
| mindmake-wordmark.svg | 2,498 | 57fd2cdef929de2035baf5b0405a152878b26f7eba39b17b1d4c03f2470b9737 |
| favicon.svg | 2,544 | 1b813838a8a80fac0412fbd78ae6676563ac49dc0ace456d9817a49931211303 |
| mindmake-logo-512.png | 20,589 | 7172f1a79ec2c25b5a30274e7212eb21d423591b37ce72efa2ce8582b94e3568 |

## 3. Colours

Create these palettes in this order. Each colour's name is the text before its colon, typed exactly.

Mint is the answer and amber is what moved since yesterday; nothing else is coloured for decoration. Mint as text never sits on paper (use "Mint on paper"). Paper is for method bands only.

**Meaning**
- Mint, the answer: `#7fe3b4`
- Mint ink, text on mint: `#07110c`
- Mint dim, pressed: `#3e8e68`
- Mint wash: `#12291f`
- Amber, what moved since yesterday: `#e0a44a`
- Amber wash: `#2b2113`

**Grounds**
- Ink: `#0a100d`
- Ink 2, cards: `#111a16`
- Ink 3: `#18241f`
- Raise: `#1e2c26`
- Paper, method bands only: `#f2f1ea`
- Paper 2: `#fbfaf5`

**Text and rules on ink**
- Text: `#e6ede8`
- Secondary text: `#b0c0b7`
- Muted: `#788c82`
- Line: `#22322b`
- Hairline: `#1a2620`
- Section seam: `#30463d`

**On raise**
- Muted on raise: `#8a9e93`
- Line on raise: `#35473e`
- Hairline on raise: `#2b3a33`

**On paper**
- Text on paper: `#131c17`
- Secondary on paper: `#4a554e`
- Muted on paper: `#7c857a`
- Paper rule: `#dedcd0`
- Mint on paper: `#2f6f51`
- Mint wash on paper: `#e4efe8`
- Amber on paper: `#9a5a1c`

**Chrome (footer and menu)**
- Chrome ink, footer ground: `#06110d`
- Chrome paper, footer and menu text: `#eee2cc`
- Chrome mint: `#9df0c8`
- Footer secondary text: `#aebcb3`

**Logo only**
- Mark deep, logo only: `#22494a`
- Mark light, logo only: `#a4e8cd`

## 4. Fonts

The design contract (Krish's ruling of 25 September 2026) sets three page faces, each with one job:
- **Newsreader** for headlines (light, about weight 380) and for everything read (weight 400).
- **Archivo** for actions (buttons, at weight 700, in sentence case) and small interface text only. Never a heading, a sentence, capitals or wide letter spacing.
- **IBM Plex Mono** at weight 400 for labels, numbers and dates, in capitals with wide letter spacing.

Pick each from Canva's own font library first. Only if one is missing, upload it from the Fonts folder in his brand assets folder, as static files only (Newsreader Light and Regular, Archivo Bold, IBM Plex Mono Regular), never a variable font file. Do not add Source Serif 4: it is only for the private brief's brand line, not a page face.

Set the kit's text styles. Letter spacing is in Canva's own units, thousandths of an em, so 140 means 0.14em.

| Canva style | Font | Weight | Notes |
|---|---|---|---|
| Title | Newsreader | Light | letter spacing -50 |
| Subtitle | Newsreader | Regular | |
| Heading | Newsreader | Light | |
| Subheading | Newsreader | Regular | |
| Section header | IBM Plex Mono | Regular | capitals, letter spacing 140 |
| Body | Newsreader | Regular | |
| Quote | Newsreader | Regular | |
| Caption | IBM Plex Mono | Regular | capitals, letter spacing 100 |

If Canva offers a button style, set it to Archivo Bold.

## 5. Brand voice

If the kit has a Brand voice field, paste this exactly:

> Mindmake speaks as "we": a helpful expert explaining clearly to someone smart. British English ("judgement", "organisation"). Plain enough for a twelve-year-old: short sentences, any business term explained at once. Sentence case for headings, sentences and buttons; short labels, numbers and dates in capitals. No em dashes. Kind about people and sharp about ideas. Never doom, fear as the whole argument, commands, boasting, flattery or cryptic headlines, and never "not X, but Y". Never shame anyone as a beginner, imply we have all the answers, make generic AI claims, use consultant filler or technology theatre, or perform. Never use "thesis" (say idea, view or plan) or "GTM" (say go-to-market, explained the first time: how a business gets its product to customers and gets paid for it). Never frame our work as "AI literacy", "AI fluency", "prompt engineering", "leveraging AI", "AI-powered", "future of work", "productivity" or an "assistant". Quotes are never edited. In anything made with this kit, no prices, durations or counts. Krish appears only in approved biography, proof framing and verbatim quotes, never in copy written as Mindmake. The name is always Mindmake, written exactly so.

## 6. Photos and graphics

Add photos only as still images (.jpg or .png) from the folder's film posters and history pictures:
- never the .mp4 or .webm films;
- never founder photos;
- never company or brand logos.

The world is instrument rooms: brass, walnut, cream paper, ink, glass; one blade of window light with dust in it; machines that record and measure, and a human hand that decides. Never stock imagery, screens, robots, boardrooms, holograms or people smiling at laptops. If there are no such stills, leave Photos empty and say so.

Leave Graphics empty. The six instrument marks exist only as website components for now; a later session adds them.

## 7. Finish

1. Take one screenshot of the top of the Mindmake kit page, or one full-page capture if the browser offers it. Save it to Drive, mind/make > 03_Growth > Growth assets > Brand kit, as `2026-10-27 Brand kit specimen Mindmake kit screenshot v1.png`.
2. Tell Krish:
   - how many logos, colours and fonts the kit holds;
   - any font you uploaded;
   - every optional setting you skipped;
   - anything you could not do;
   - that nothing was shared, published, bought or connected.
3. Then stop.

**After the session:** the cloud session takes the one new kit id as the Mindmake kit. It then:
1. generates one test design on that kit and files it in the Canva folder Mindmake Growth > Brand kit;
2. reads that design's fonts and colours back and checks its thumbnail;
3. adds the screenshot and the test design to the Growth index.

Krish then approves the kit where he sees it.
