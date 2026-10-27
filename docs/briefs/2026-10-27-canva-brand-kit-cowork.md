# Cowork prompt: build the Mindmake brand kit in Canva

Status: ready to run. Ruling (Krish, 2026-10-27): build a full, new Mindmake brand kit in Canva first, by computer use on his PC, from the brand assets in his Ventures folder; he opens the folder and logs in to Canva. Every value below was read on 27 October 2026 from the live Mindmake repository (krishanraja/mindmake at commit ddd0049), which wins over any other copy: `src/styles/mindmake.css` (blob a7beac7), `project-documentation/03_DESIGN_CONTRACT.md` (blob f82c82c) and `project-documentation/00_NORTH_STAR.md` (blob 10c6e32).

Paste everything below the line into a Cowork session on Krish's PC.

---

You are building a new Brand Kit called **Mindmake** in Krish's Canva account, with computer use, while he watches. Krish has logged in to Canva in the browser and opened his Mindmake brand assets folder. Work only inside Canva and that folder.

**Never:** rename, edit or delete the existing kit called "Mindmaker" or any existing design; share anything or change any permission; publish anything; accept any paid upgrade, trial or purchase prompt (stop and tell Krish instead); type the name "Mindmaker" anywhere. The brand name is **Mindmake**, written exactly like that. If anything below cannot be done as written, stop and tell Krish what you saw, rather than improvising.

## 0. Check the source files

In Google Drive, open **mind/make > 03_Growth > Growth assets > Brand kit > Source files**. If Drive is synced to this PC, it is under the same path in the Drive folder; otherwise open it at drive.google.com. It holds four files copied byte for byte from the live website. Use these, not older copies: an older favicon elsewhere in Drive differs from the live one.

| File | What it is | Bytes | SHA-256 |
|---|---|---|---|
| mindmake-mark.svg | the mark: two squares under two trapezoids, a deep teal to mint gradient | 2,536 | d1517af3047b6e4cd45f9e9613d4f4383b35b11e3408d659793925231360fae7 |
| mindmake-wordmark.svg | the wordmark, drawn as MIND/MAKE, pale to mint | 2,498 | 57fd2cdef929de2035baf5b0405a152878b26f7eba39b17b1d4c03f2470b9737 |
| favicon.svg | the mark on a square canvas | 2,544 | 1b813838a8a80fac0412fbd78ae6676563ac49dc0ace456d9817a49931211303 |
| mindmake-logo-512.png | the mark alone on an ink square, 512 by 512 | 20,589 | 7172f1a79ec2c25b5a30274e7212eb21d423591b37ce72efa2ce8582b94e3568 |

If the folder is synced, confirm each in PowerShell with `Get-FileHash <file> -Algorithm SHA256`. If a hash differs, stop and tell Krish.

## 1. Create the kit

In Canva: Brand, then Brand Kit, then add a new brand kit named **Mindmake**. Leave "Mindmaker" untouched.

## 2. Logos

Upload all four files to the Logos section of the Mindmake kit, named "Mindmake mark", "Mindmake wordmark", "Mindmake favicon" and "Mindmake mark on ink". The wordmark SVG recolours itself on paper on the website; in Canva it shows its default pale-to-mint gradient, which is right for dark grounds.

## 3. Colours

Create these palettes in this order, each colour named exactly as shown. Colour carries meaning at Mindmake: mint is the answer, amber is what moved, and nothing else is coloured for decoration.

**Meaning**
- Mint, the answer: `#7fe3b4`
- Mint ink, text on mint: `#07110c`
- Mint dim, pressed: `#3e8e68`
- Mint wash: `#12291f`
- Amber, what moved: `#e0a44a`
- Amber wash: `#2b2113`

**Grounds**
- Ink: `#0a100d`
- Ink 2, cards: `#111a16`
- Ink 3: `#18241f`
- Raise: `#1e2c26`
- Paper: `#f2f1ea`
- Paper 2: `#fbfaf5`

**Text and rules on ink**
- Text: `#e6ede8`
- Secondary text: `#b0c0b7`
- Muted: `#788c82`
- Line: `#22322b`
- Hairline: `#1a2620`
- Section seam: `#30463d`

**On paper**
- Text on paper: `#131c17`
- Secondary on paper: `#4a554e`
- Muted on paper: `#7c857a`
- Paper rule: `#dedcd0`
- Mint on paper: `#2f6f51`
- Mint wash on paper: `#e4efe8`
- Amber on paper: `#9a5a1c`

**Chrome (masthead and footer)**
- Chrome ink: `#06110d`
- Chrome paper: `#eee2cc`
- Chrome mint: `#9df0c8`
- Footer text: `#aebcb3`

**Logo gradient stops**
- Mark deep: `#22494a`
- Mark light: `#a4e8cd`

## 4. Fonts

The design contract (Krish's ruling of 25 September 2026) sets three faces, each with one job:
- **Newsreader** for headlines (light, about weight 380) and for everything read (weight 400).
- **Archivo** at weight 700 for actions only (buttons and short interface labels), always in sentence case, never for a heading or a sentence.
- **IBM Plex Mono** at weight 400 for labels, numbers and dates, in capitals with wide letter spacing.

Add the three as brand fonts. Pick each from Canva's own font library first; only if one is missing, upload it from the Fonts folder in the brand assets folder (all three are open-licence Google fonts). Do not add Source Serif 4: it is only for the private brief's brand line, not a page face.

Set the kit's text styles:

| Canva style | Font | Weight | Notes |
|---|---|---|---|
| Title | Newsreader | Light (closest to 380) | sentence case, tight tracking |
| Subtitle | Newsreader | Light | sentence case |
| Heading | Newsreader | Light | sentence case |
| Subheading | Newsreader | Regular | sentence case |
| Section header | IBM Plex Mono | Regular | capitals, letter spacing about 140 |
| Body | Newsreader | Regular | sentence case |
| Quote | Newsreader | Regular | sentence case |
| Caption | IBM Plex Mono | Regular | capitals, letter spacing about 100 |

If Canva offers a button or action style, set it to Archivo Bold in sentence case.

## 5. Brand voice

If the kit has a Brand voice field, paste this exactly:

> Mindmake speaks as "we": a helpful expert explaining clearly to someone smart. British English ("judgement", "organisation"). Plain enough for a twelve-year-old: short sentences, any business term explained at once. Sentence case everywhere. No em dashes. Warm with people, sharp with ideas. Never doom, fear as the whole argument, commands, boasting, flattery or cryptic headlines, and never "not X, but Y". Never use "thesis", "GTM", "AI literacy", "AI fluency", "prompt engineering", "leveraging AI", "AI-powered", "future of work", "productivity" or "assistant". Quotes are never edited. No prices, durations or counts. Krish appears only in approved biography, proof framing and verbatim quotes, never in copy written as Mindmake.

## 6. Photos and graphics

Add photos only from the brand assets folder's films and history imagery (warm, low-key, cinematic instrument rooms: brass, walnut, cream paper, ink, one blade of window light). Never stock imagery, and never screens, robots, boardrooms, holograms or people smiling at laptops. If no such images are in the folder, leave Photos empty and say so.

Leave Graphics empty. The six instrument marks exist only as website components for now; a later asset session exports them and adds them.

## 7. Finish

1. Take one screenshot of the finished Mindmake kit page and save it to **03_Growth > Growth assets > Brand kit** as `2026-10-27 Brand kit spec Mindmake kit screenshot v1.png`.
2. Tell Krish:
   - how many logos, colours and fonts the kit holds;
   - any font you had to upload;
   - anything you skipped or could not do;
   - that nothing was shared, published or bought.
3. Then stop.

The cloud session verifies the kit afterwards by reading it back through Canva's connector. It lists the kits, generates one test design on the Mindmake kit, reads back its fonts and colours, and checks its thumbnail. Krish then approves the kit where he sees it.
