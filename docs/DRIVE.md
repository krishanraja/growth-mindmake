# The Growth library: what goes where

Status: Current
Owner: Krish Raja
Set: 2026-10-27 (Ruling, Krish, 2026-10-27: every asset and strategy this engine produces is stored in one Growth folder, and the engine makes sure everything is easy to find and never sprawls)

Read this before touching Drive or Canva. The same map sits at the top of the Drive folder as "READ ME FIRST - what goes where", regenerated whenever this file changes. Folders are named here by path, never by id: this repository is public.

## Where

- Google Drive: **mind/make > 03_Growth**. It is numbered to fit the mind/make folder's own order (00_Brand-Assets, 01_Strategy, 02_Canon, 04_Content, 06_Admin).
- Canva: the **Mindmake Growth** folder, for the designs this engine makes. Exports of approved designs are filed in Drive.

## What lives here, and what never does

Here: the engine's strategies (signed week specs, weekly reviews, plans, briefs, Cowork prompts), its measurements (the baseline, weekly North Star and visibility readouts) and its assets (the brand kit spec and specimen, the speaker and guest one-sheet, later kits).

Never here:
- lists of people, contact details or research about a named person. Control Center keeps records; Drive is not a CRM;
- anything in 04_Content > Sales Materials, which is Krish's own drop-zone. The engine never files there and never copies into it;
- the engine's code, schemas and synthetic examples, which live in this repository.

## The map

```
03_Growth/
  READ ME FIRST - what goes where    this file, regenerated when it changes
  00_Index                           every current item: title, kind, version, date, approval state, link
  01_Strategy/
    Week specs/                      2026-11-02 Week spec v1 (signed)
    Weekly reviews/                  2026-11-06 Weekly review
    Plans and briefs/                plans, briefs and Cowork prompts copied from this repository
  02_Assets/
    Brand kit/                       the Mindmake brand kit spec, its specimen, a link to the Canva kit
    Speaker and guest one-sheet/
      Current/                       exactly one approved PDF and a link to its Canva brand template
      Drafts/                        unapproved revisions, the last three at most
  03_Measurement/                    the baseline, weekly North Star and visibility readouts
  _Archive/                          superseded versions, never deleted
```

A new asset kind gets its own folder under 02_Assets with the same Current and Drafts pair, added to this map in the same change.

## Naming

`YYYY-MM-DD <Kind> <subject> vN`, for example `2026-10-27 Plan Bulletproof growth engine v1`. The date is the day it was made, or the London Monday of its week for a week spec. Kinds: Week spec, Weekly review, Plan, Brief, Cowork prompt, Baseline, Readout, Brand kit spec, One-sheet. No other shapes, no "final", "new" or "copy of" in a title.

## Rules

1. **One home per item.** Strategies, reviews, measurements and exported assets live in Drive. Engine instructions live in this repository; Drive keeps a copy of each, whose first line names the commit it came from.
2. **One current version.** An approved new version replaces the file in Current, and the old one moves to _Archive in the same step with "(superseded YYYY-MM-DD)" added to its title.
3. **Drafts stay few.** The last three drafts of an asset at most; older ones move to _Archive.
4. **The index is the finish line.** Every session that files something updates 00_Index before it ends. An output the index does not list is not done.
5. **Nothing loose.** Only the READ ME and 00_Index sit at the top of 03_Growth.
6. **Never share, trash or move out.** Sharing, changing permissions, trashing, or moving anything into or out of 03_Growth needs Krish's yes at the time. Nothing is ever deleted.
7. **Canva mirrors it.** Designs the engine makes live only in the Canva folder Mindmake Growth, in subfolders Brand kit, Speaker and guest one-sheet, and Drafts. The old Mindmaker kit and its designs are left as they are.

## The Friday check

The weekly review walks 03_Growth and Mindmake Growth and reports counts, each of which should be zero: files outside this map, loose files, duplicates of one kind, subject and version, more than one file in a Current, engine-made Canva designs outside Mindmake Growth, repository copies behind main, and index entries that do not match the tree. Phase 3 of the build plan turns this into code (`library/taxonomy.json` and `scripts/check-library.mjs`) so it runs as a gate on the real listing, not as a reminder.
