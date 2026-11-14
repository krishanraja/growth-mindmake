Status: closeout notes now fold into NOW.md after every merge: auto-merge.yml starts ci.yml on main by workflow_dispatch, and its fold job runs on that start, because the merge's own push, made with the Actions token, starts no workflow (docs/RELEASE.md, 14 November).
Next: after the next auto-merge, read back that ci.yml's fold job ran on main and now-notes/ is empty.
North Star check (2026-11-14): holds.
