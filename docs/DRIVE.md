# The Growth library: what goes where

Status: Current
Owner: Krish Raja
Set: 2026-10-27 (Ruling, Krish, 2026-10-27: every asset and strategy this engine produces is stored in one Growth folder, and the engine makes sure everything is easy to find and never sprawls)

Read this before touching Drive or Canva. The same map sits at the top of the Drive folder as "Growth library READ ME FIRST", regenerated whenever this file changes. Folders are named here by path, never by id: this repository is public.

## Where

- Google Drive: **mind/make > 03_Growth**, numbered to fit the mind/make folder's own order.
- Canva: the folder **Mindmake Growth**, for every design this engine makes. Exports of approved designs are filed in Drive.

## What lives here, and what never does

Here: the engine's strategies (week specs, weekly reviews, plans, briefs, Cowork prompts), its measurements (the baseline, weekly North Star and visibility readouts), its assets (the brand kit, its source files and specimen, the speaker and guest one-sheet, later kits) and the index of all of them.

Never here:
- approval state of its own: a title, a folder such as Current, or an index entry is a label copied after Control Center records a decision, never authority;
- lists of people, contact details, or research about a named person. Control Center keeps records and approvals; Drive is not a CRM and holds no approval state;
- anything in his own sales-materials folder. The engine never files there and never copies into it;
- the engine's code, schemas and synthetic examples, which live in this repository.

## The map

Every folder name starts with "Growth" or sits inside one that does, so a Drive search never confuses it with another folder of the same name.

```
03_Growth/
  Growth library READ ME FIRST       this file, regenerated when it changes
  Growth index                       every current item: title, kind, version, date, link (and a Canva link for each design), Control Center proposal id where one exists
  Growth strategy/
    Week specs/                      2026-11-09 Week spec Mindmake growth v1
    Weekly reviews/                  2026-11-06 Weekly review Mindmake growth v1
    Plans and briefs/                plans, briefs and Cowork prompts copied from this repository
  Growth assets/
    Brand kit/                       the brand kit spec and its specimen
      Source files/                  logo files copied byte for byte from the live mindmake repository, under their own names
    Speaker and guest one-sheet/
      Current/                       exactly one PDF, the version Control Center last approved by its SHA
      Drafts/                        unapproved revisions, the last three at most
  Growth measurement/                the baseline, weekly North Star and visibility readouts
  Growth archive/                    superseded versions, never deleted
```

A new asset kind gets its own folder under Growth assets with the same Current and Drafts pair, added to this map in the same change.

## Naming

`YYYY-MM-DD <Kind> <subject> vN`, optionally followed by ` (superseded YYYY-MM-DD)`, then the file extension if it has one. Kinds: Week spec, Weekly review, Plan, Brief, Cowork prompt, Baseline, Readout, Brand kit spec, Brand kit specimen, One-sheet. The date is the day it was made, or the London Monday of its week for a week spec. Examples: `2026-10-27 Plan Bulletproof growth engine v1`, `2026-11-09 Week spec Mindmake growth v1`, `2026-11-03 One-sheet Speaker and guest v2 (superseded 2026-11-10).pdf`. Exceptions keep their own names: the READ ME, the Growth index, and files in a Source files folder, which keep the names they have at their source. Never "final", "new" or "copy of" in a title.

## Rules

1. **One home per item.** Strategies, reviews, measurements and exported assets live in Drive. Engine instructions live in this repository, and Drive keeps a copy of each whose first line names the commit it came from. A copy is stale when its source changed after that commit.
2. **One current version.** A new version Control Center records as approved replaces the PDF in Current, and the old one moves to Growth archive in the same step with its superseded date added to its title.
3. **Drafts stay few.** The last three drafts of an asset at most; older ones move to Growth archive.
4. **The index is the finish line.** Every session that files something updates the Growth index before it ends, recording each Canva design's id when the design is made, so engine-made designs can always be told apart. An output the index does not list is not done.
5. **Nothing loose.** Only the READ ME and the Growth index sit at the top of 03_Growth.
6. **Never share, trash or move out.** Sharing, changing permissions, trashing, or moving anything into or out of 03_Growth needs Krish's yes at the time. Nothing is ever deleted.
7. **Canva mirrors it.** Designs the engine makes live only in the Canva folder Mindmake Growth, in its subfolders Brand kit, Speaker and guest one-sheet, and Drafts. The old Mindmaker kit and its designs are left as they are.
8. **No people.** A weekly review or readout filed here carries counts, paths and decisions, never names or contact details. This rule carries extra weight because mind/make, and so 03_Growth, is shared so that anyone with the link can edit it, which Krish chose to keep on 2026-10-27. Nothing private is ever filed here.

## The check

Until Control Center serves a listing of these folders to the daily dispatch, every session that files something walks 03_Growth and Mindmake Growth before it ends and reports these counts, each of which should be zero: files outside this map, loose files, names that fail the pattern, duplicates of one kind, subject and version, more than one PDF in a Current, engine-made Canva designs outside Mindmake Growth, stale repository copies, and index entries that do not match the tree. Phase 3 of the build plan (docs/briefs/2026-10-27-bulletproof-growth-engine.md) turns this into code (`library/taxonomy.json` and `scripts/check-library.mjs`) so it runs as a gate on the real listing, not as a reminder.
