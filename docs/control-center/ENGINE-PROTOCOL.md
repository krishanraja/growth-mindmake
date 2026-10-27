# The growth engine protocol, version 1.11.0

Every growth engine reports into Control Center through this one protocol, and Control Center pushes each engine its next move through it (Control Center ADR-038). It replaces the per-engine receivers the handoffs asked for. The engines are:

| Engine | Slug in the path | `engine_id` | `product_slug` |
|---|---|---|---|
| krishanraja/growth-mindmake | `mindmake` | `growth-mindmake` | `mindmake` |
| krishanraja/growth-heartside | `heartside` | `growth-heartside` | `heartside` |
| krishanraja/growth-makeyourmindup | `makeyourmindup` | `growth-makeyourmindup` | `publication` |
| krishanraja/growth-fulltime | `fulltime` | `growth-fulltime` | `full-time` |
| krishanraja/growth-legibility | `legibility` | `growth-legibility` | `legibility` |
| krishanraja/AEO-Engine | `aeo` | `aeo-engine` | `mindmake` |

The registry is the table `growth_engines`. It holds each engine's aim (its North Star), its objectives with their targets, its cadence, whether it is switched on, and the SHA-256 of its bearer.

## Versions

Control Center only ever adds within 1.x: a new minor version adds fields, never removes or changes one, and every older 1.x report is still taken. So:

- **Accept any 1.x** in what Control Center serves (the directive, capabilities, decisions), and ignore a field you do not know. Never require an exact version back.
- **Send the version you speak.** `capabilities.schema_versions` lists every version Control Center takes; check that yours is in it.
- **Raise yours only for a field you use.** 1.1.0 adds a proposal's `stage` and `parent_proposal_id`; 1.2.0 adds its `subject_ref`; 1.4.0 adds the North Star number and urgency to the directive (below), and nothing to the report. 1.5.0 adds `taste`, Krish's approved voice rules, to the directive (below), and nothing to the report. 1.6.0 adds a proposal's `row`, `rank`, `reach`, `amplifier_kind`, `features`, `serves` and `source_revision`, a version 2 action, 40 proposals a report, `week_goals` and `rows_rule` in the directive, `carried_out` and `reason_code` in a decision, and the research desk (below). 1.7.0 adds a row proposal's `because` and `brief`, which a row then needs, and the context's `mindmake_fit`, `sells_competing_services`, `known_since`, `email_last` and `quiet_ties` (below). 1.8.0 adds a row proposal's `card`, the full card a tap opens, which a row then needs, and the context's `email_inbound`, `email_outbound`, `source_list` and `last_post_at` (below). 1.9.0 lets a visibility or events row's email action name Jonny's box (`mailbox`), which Control Center drafts each day with no press, and adds each stage's podcast facts and booking route and each pitch's outcome to the context (below). 1.10.0 adds `web_analytics` to the directive for an engine whose product has a Google Analytics site with the per-post (`utm_content`) breakdown (Make Your Mind Up) or one its engine reads without it (Mindmake's mindmake.co, with `consent_gated`) (below); the meetings Krish held to Mindmake's context, with his good tap on his list (`features.meetings`); `origin_candidates` to Mindmake's report (below); the show-notes note, a version 2 action's `kind: show_notes_ask` (below); `withdrawn[]`, an engine taking back its own proposals he has not decided (below); and typed `facts[]` on each person row of Mindmake's context (`features.facts`, below). 1.11.0 adds the prior-outreach read, each person's Mindmake record, for growth-legibility only (below), and nothing to the report or the directive.

On 2026-10-19 Control Center began serving 1.1.0. Legibility required exactly 1.0.0 back from capabilities, and Mindmake from the directive, so both stopped on every run (`receiver_contract_mismatch`, `directive_invalid`) and reported nothing for two days. That is why this rule exists.

## The daily loop

Each run, every engine does these five things, in this order:

1. **Pull its directive.** `GET /api/growth/engines/<slug>/directive` returns today's one next action.
2. **Act inside the walls.** Nothing sends, posts, spends, deletes or changes a permission unless Krish has made a decision whose `payload_sha256` matches what the engine is about to do.
3. **Journal the attempt.** `POST /api/growth/engines/<slug>/attempts`, once when the run starts and once when it ends.
4. **Report.** `POST /api/growth/engines/<slug>/reports` sends what it measured, what it did, what it proposes, what closed and what it held.
5. **Read his decisions.** `GET /api/growth/engines/<slug>/decisions?since=<time>` returns his yes and no on what it proposed.

**When the loop starts.**
- Every day around 06:10 in London (the cron is `/api/growth/engines-dispatch` at 05:10 UTC), Control Center writes each active engine's directive.
- Where dispatch is on, it also wakes the engine's repository with one `repository_dispatch` of type `cc-growth-directive`. The payload is `{ directive_id, engine_id }`, nothing else, and the engine pulls the rest with its own bearer.
- An engine that does not run on GitHub Actions just pulls the directive at the start of its own run. The directive is the same either way.
- Control Center may wake an engine again later the same day with the same payload (growth-mindmake, when a row of his widget runs low; at most once an hour). An engine treats it as another run of the same day: it pulls the directive again and reports with a new `run_id`.

## Auth

**The bearer.**
- Each engine has its own bearer: `Authorization: Bearer gen1_<43+ url-safe characters>`.
- Control Center stores only its SHA-256, on `growth_engines.token_sha256`. The token goes into the engine repository's own secrets as `CONTROL_CENTER_ENGINE_TOKEN`.
- `scripts/growth/issue-engine-token.mts` issues one. Running its SQL replaces the old token, which stops working at once.

**What the bearer can and cannot do.**
- A token opens its own engine's routes only. A token for another engine gets the same 401 as no token.
- It cannot open Krish's dashboard routes, and his cookie cannot write to these.
- No CORS headers are sent; these are server callers.
- Requests are rate limited to 60 a minute per token, and every response is `Cache-Control: no-store`.

**Base URL.** `https://controlcenter.krishraja.com`, in the engine's `CONTROL_CENTER_URL`. HTTPS only. Do not follow redirects. Use bounded timeouts. Never retry a write blindly: read it back first.

## Routes

### Scoped context and complete outcomes (1.3.0)

Capabilities add `features.context`, `features.outcomes` and `features.exact_actions`.
Each is false when the engine or deployment lacks the corresponding adapter.
Older reports and clients remain valid. A catalog entry does not prove usable access.

`GET /api/growth/engines/<slug>/context` returns `{ ok, context }` with
engine/product identities, observation time, native records, selected Network
identities, canonical warm paths, proof permissions and per-source coverage.
Each coverage entry carries availability, completeness, row count, source date
and reason. The Network selection is bounded and explicitly partial. Relationship
warmth and consent classification have separate counts and definitions. These
reads contain no raw correspondence, mailbox addresses, profiles or credentials.
Correspondence, transcripts and connectors unverified through the engine bearer
remain visibly unavailable. This is a scoped preparation read, not a new CRM.
`work_context` reuses the existing version-1 selected-job contract and snapshot
builder. Jobs come from native Advisory `growth_context.engine_jobs`, with
their existing source identities; no parallel job table is created. That
context runs the complete producer cycle before fresh campaign preparation,
under the shared capacity. An unavailable context or missing source holds
those jobs explicitly. Native replies without enough request context block
fresh acquisition; engine plan declines are retained until a new review.

`GET /api/growth/engines/<slug>/outcomes` returns `{ ok, outcomes }` with
complete paginated native lifecycle records, source coverage, London-week and
original first-30-day windows, and explicit definitions/unavailable measures.
The read is independent of contact selection. Bookings never count as held calls;
qualification remains human-owned. A paid timestamp without independent payment
evidence cannot establish a verified paid proof. Missing coverage is unknown.
Recognition, distribution, efficiency and free-pilot measures remain unknown until
their native sources record complete evidence; never infer them from drafts.

The initial adapter is Mindmake only. Other engines receive feature flags false
and 404 for these reads, with their existing reports and directives unchanged.

### Exact approved actions (1.3.0)

`GET /api/growth/engines/<slug>/prepare-action/<plan_id>` prepares an action
from an approved campaign plan and its current native record. It returns an
existing unexpired child unchanged, or `completed`, before preparing anything
new. Current proof permission and recipient eligibility are checked again.

The action is the proposal's full JSON `exact_payload`: version, channel,
recipient contact id and address, subject, body, assets, cost, not-before,
expiry, source reference and source updated time. Its digest is SHA-256 of
canonical JSON of the action. A go-live names the approved parent plan.
An amendment is approved as the entire finished action and uses the existing
amendment digest. Any native edit, changed address, suppression, closed window
or invalid digest blocks execution. The two-London-day window accommodates
the next daily dispatch, including the clock change.

`POST /api/growth/engines/<slug>/execute/<proposal_id>` is the shared executor,
separate from the proposal-only handler and all drafting surfaces. It accepts
no action supplied in the request: the approved record is authoritative.
Initially only plain zero-cost email with no assets and an Advisory source
reference is supported. Unsupported channels, attachments, spend and direct
Visibility execution are blocked. An institutional first message may use its
linked native Advisory relationship; Visibility still owns the session and gates.

A private service-only `growth_engine_actions` journal claims each proposal once,
inside a transaction that checks both approvals and the current registry. A send
acknowledgement is `submitted`. Only an independent Gmail GET with the matching
recipient, subject, body and SENT label permits `verified`. Lost or ambiguous
sends stay `claimed`/`unknown` and are never resent. Known provider ids can be
reconciled with `POST .../execute/<id>` and `{ reconcile: true }` without
another send. `GET .../execute/<id>` only reads the receipt.
The existing `mail_sent` done check moves the native lifecycle from the verified
receipt, preserving one completion system and its audit and Undo behavior.

Never claim autonomy from configuration or a green run. Acceptance still requires
an exact human-approved external action and a real independently verified receipt.

| Method and path | Request | Response |
|---|---|---|
| `GET /api/growth/engines/<slug>/capabilities` | | `{ schema_version, schema_versions, autonomy, engine_id, product_slug, idempotency: true, activation: { state, activated_on }, features }` |
| `GET /api/growth/engines/<slug>/directive[?date=YYYY-MM-DD]` | | `{ ok, chosen_by: 'rule'\|'krish', directive }` |
| `POST /api/growth/engines/<slug>/reports` | header `Idempotency-Key: <run_id>`, body a report | `{ accepted: true, run_id, payload_sha256, replayed }` |
| `GET /api/growth/engines/<slug>/reports/<run_id>` | | `{ accepted: true, run_id, payload_sha256, mode, accepted_at, report }`, or 404 |
| `POST /api/growth/engines/<slug>/attempts` | an attempt | `{ ok: true, attempt[, replayed] }` |
| `GET /api/growth/engines/<slug>/attempts/<attempt_id>` | | `{ ok: true, attempt }`, or 404 |
| `GET /api/growth/engines/<slug>/decisions[?since=<time>]` | | `{ ok, decisions: [{ proposal_id, decision: 'approved'\|'declined'\|'done', decided_at, payload_sha256, stage, amended[, exact_payload, amount_usd, amended_sha256][, carried_out][, reason_code, reason_text] }] }` |
| `POST /api/growth/engines/<slug>/research` | `{ requests: [...] }` (1.6.0, Mindmake) | `{ ok, research: [{ request_id, kind, subject_ref, query, why, status, evidence, answer, requested_at, answered_at }] }` |
| `GET /api/growth/engines/<slug>/research[/<request_id>]` | | `{ ok, research }`, or 404 |

**Errors.**
- **400:** the report or attempt is malformed. The body names the field.
- **401:** the token is wrong or missing.
- **403:** the report names another engine or product.
- **409:** one of three things:
  - the same run was already reported with a different payload, which is a conflict
  - an attempt already has a different terminal record
  - `engine_inactive`, a live report from an engine Krish has not switched on
- **413:** the report is over 512 KB.
- **429:** rate limited, with `Retry-After`.
- **500 `store_failed`:** the store failed. This is redacted and carries no row or body.

### The five rows: people in front of Krish (1.6.0)

Ruling (Krish, 2026-10-26): growth-mindmake owns everything about growing Mindmake and connecting Krish to the right people: who, how far each one reaches, the words, and what it learns from his answers. Control Center holds the holistic view: the records, the walls, the press, and his home screen. It ranks nothing itself and never writes a Mindmake pitch (Control Center ADR-041).

Every action should make him exponentially more visible, so the engine hunts amplifiers, people whose yes puts him in front of many others (`amplifier_kind`): `investor` (prolific investors), `connector` (well-connected people), `ai_capital` (people anywhere with inordinate money who want to shape AI and steer their investments to it), `ai_trainer`, `student_educator` and `ceo_educator` (those who teach AI, students or CEOs at scale), and `broadcaster` (mass broadcast and social channels on growing with AI).

A proposal for his home screen carries, on top of 1.2.0:

| Field | Meaning |
|---|---|
| `row` | `reach_out`, `network`, `visibility`, `events` or `partners`: where it shows. The ask decides the row (an intro or a portfolio session, getting closer, appearing on their channel, a talk or a session, co-delivering) |
| `rank` | The engine's order within the row, 1 first. Control Center shows this order and never re-ranks it |
| `reach` | `{ value, band, basis, source_url, as_of }`. A `value` is a claim, so it names its `source_url` and `as_of`, and its `band` matches it. Without a source give `value: null` and a band; `unknown` is said, never guessed |
| `amplifier_kind`, `features` | The kind, and `{ sector, topic, seniority }` (lower-case words, seniority `c_suite`, `senior` or `other`), which his reasons for a No filter on |
| `serves` | One of `week_goals`, word for word, or null |
| `source_revision` | 1 to 8 `{ repo, path, sha }`: every file the words were written from, by its git blob SHA on the default branch. Before he acts, Control Center reads each SHA again; a file that moved or went makes the action stale (it shows the next one, and you write it again), and a repository it cannot read acts on nothing. It holds no venture fact itself |

**Why him, why them (1.7.0).** Krish, 2026-10-27: "I have no idea whether I want to do those things or not. Or why I should do those things." At 1.7.0 a row proposal also carries, and needs:

| Field | Meaning |
|---|---|
| `because` | 1 to 80 characters, the line under the title on his card (two lines of it): who they are and why them, so he can decide from the card alone ("Hosts a 6-year tech podcast. Known since 2021, last email Jun 2024."). With it, a 1.7.0 row's title is at most 56 characters, so both fit beside the presses whole |
| `brief` | 2 to 6 lines of at most 200 characters, what he reads when he taps the card: who they are, how he knows them, why them, what a yes gets him (the goal), the reach and its basis, and the Mindmake fit. Control Center shows it above the exact words a press would carry out |

A 1.6.0 row is still taken without them; its `why` stands in for the case.

**The full card (1.8.0).** Krish, 2026-10-27: "I need to be fully in the know as to who they are, why I'm getting in touch with them, what benefit I would have, and what angles to take." At 1.8.0 a row proposal also carries, and needs, `card`, which a tap on the card opens in parts (the phone shows the 1.7.0 `brief` to an older app, so keep both, saying the same facts):

| Part | Meaning |
|---|---|
| `who` | 1 to 320 characters: who they are and what their organisation does, from the record's `who` or their title and company |
| `known` | 1 to 240: how he knows them, plainly: since when, through what (Gmail, LinkedIn connections, phone contacts), the emails each way and the last one. Never a claim the counts contradict ("You have written to each other" needs mail both ways) |
| `why` | 1 to 3 whole sentences of at most 240: why them, and why now (their hook, their company's moment, a recent public post) |
| `gain` | 1 to 3 whole sentences of at most 240: what he gets if they say yes, tied to the week goal it serves, a number only with its source |
| `angles` | 1 to 3 `{ title, line }`: the angle to take, its title (at most 60) from the venture's own canon, its line (at most 240) tying that theme to this person |
| `sources` | 0 to 6 `{ label, url }`: the public https pages the facts came from. Never a way to reach them: a LinkedIn profile, `mailto:`, `wa.me` or `tel:` link is refused |

A card that cannot say who, why and what he gets is not one he can decide on: hold the suggestion and ask for the research that would fill it, rather than send a thin one. A 1.7.0 row is still taken without a card; the phone shows its brief.

A row proposal is a prepared `send`, `stage: null` (Krish carries it out himself, so it is never a go-live the executor could send), with `subject_ref` set and `channel` equal to its action's. Its `title` is the line he reads on his phone, shown whole, so it is at most 72 characters of plain words. Its `exact_payload` is a **version 2 action**, with no address and no number: Control Center reads those from its own records when he presses.

```json
{ "version": 2, "channel": "email", "recipient_contact_id": "<uuid>", "subject": "One line", "body": "The words", "form": null, "mailbox": null }
```

`channel` is `email` (a subject, up to 7,000 characters), `x_message` or `whatsapp` (up to 1,000, opened for him with the words typed), or `form` (`recipient_contact_id` null, `form: { url, answers: [{ label, value }] }`, 1 to 40 answers). `mailbox` (1.9.0) and `kind` (1.10.0, `show_notes_ask` or absent) are below. The recipient may differ from `subject_ref`: an introduction goes to the mutual and is about the person they introduce. A 1.6.0 report may carry 40 proposals, a ranked queue for each row.

**His answer.** From his home screen widget, or from Clear on his one list (Krish, 2026-10-26: Clear on Home makes the draft too), the press carries it out and records how (`carried_out`: `draft`, a Gmail draft he sends himself; `message`, a message app opened with the words typed; `submit`, a form submitted on his tap). Never send or submit a proposal he carried out; the shared executor refuses it (`carried_out_by_krish`), and Control Center reports the closing event when it sees it. Purge carries `reason_code` (`wrong_person`, `not_now`, `already_in_touch`, `too_small`, `wrong_audience`, `not_my_topic`, `pitch_off`, `other`) and his own words in `reason_text`: offer better, and do not offer that person, or anything like it on that reason, again. The context's `feedback` carries every past answer with the row, subject, `amplifier_kind`, `features` and `reach` it was about, so a reason can be applied to what is like it and what he taught is never forgotten.

**Context, 1.6.0** (Mindmake). On top of 1.3.0, `GET .../context` adds `amplifier_candidates` (up to 300 people on tiers 1 to 4 who read as reaching many, up to 200 close ties first and then 100 from the wider network, each by followers: a title tagged amplifier or multiplier, 5,000 followers or more, or a creator or influencer badge; a wide net, you judge), `routes` (per contact id, `{ email: verified|unchecked|none, x, linkedin, instagram, whatsapp }`, never the address; X only once the person's numeric X id is on file, since X's message link needs it; WhatsApp only for someone close), `companies` (`company_intel` for their domains), `research` (below; anyone a research row names, by `subject_ref` or as a commenter he already has, gets `routes` too) and `voices` (the people he follows for inspiration, as the content engine keeps them in `content_creators`: `{ slug, name, linkedin_url, why, last_post_url, last_post_at }`; who gathers under them is yours to find). Each part has its coverage line; a part that cannot be read says so and is never sent empty.

**Context, 1.7.0.** Every row of `network`, `amplifier_candidates` and the new `quiet_ties` carries `mindmake_fit` (Control Center's own read of how well the person fits Mindmake, 0 to 100, or null when unscored, never another venture's score), `sells_competing_services` (true when they sell what Mindmake sells), `known_since` and `email_last` (the date of the last email between them, the one record of contact Control Center keeps: `last_touch_at` is never written). `quiet_ties` is up to 100 close ties (`1_reciprocated`, `2_core_network`) whose last email is more than 90 days old, best fit first, with their `routes`. Control Center ranks none of it; which are worth his time is yours.

**Context, 1.8.0.** The same rows also carry what the full card is written from: `email_inbound` and `email_outbound` (how many emails each way), `source_list` (where he knows them from, by source name: `gmail_*`, `linkedin_export`, `phone_address_book`, `instagram_export`, `meta_export`; never an address), `last_post_at`, and `intent_summary` on every row (it was on `amplifier_candidates` only). `who`, `why_them` and `hook` were there already.

**Context, 1.10.0: typed facts** (Mindmake, `features.facts: true`). Every row of `network`, `amplifier_candidates` and `quiet_ties` also carries `facts`: at most 8 of `{ kind, text, source_url, observed_at }`, so a card's words are built from facts and never from prose. Nothing is removed from the row. `text` is the record in plain words, at most 200 characters; `source_url` is a public https page it can be checked on, or null when the source is Control Center's own record or a profile; `observed_at` is when the fact was true at its source, ISO, or null when the record does not say (never the time of the read, and a date more than a day ahead is null). The kinds, kept in this order when a person has more than 8 (`FACT_KINDS` in `api/_personFacts.ts`):

| `kind` | From | `source_url` | `observed_at` |
|---|---|---|---|
| `role` | `contact_intelligence.current_title` and `current_company`, only when a profile read is dated (`enriched_at`); an undated title is not a fact | null (the profile) | `enriched_at` |
| `role_change` | the newest `contact_role_history` row (what the record held before a refresh showed something else) with the role now held, or `role_changed_at` alone | null | when Control Center first saw the change, not when the move happened |
| `post` | up to 2 of their own sentences from `posts_sample` (the strongest two), or `intent_evidence` when none qualifies; a post with no public page is left out | the post | the post's date; null for `intent_evidence`, whose post is known but not its date |
| `shared_room` | a community whose member list he holds and is on (`roomsOf` in `src/lib/knownFrom.ts`, `contacts.sources`) | null | when that list was imported |
| `shared_employer` | up to 2 of Krish's employers on their career (`shared_history`), close ones first; says both were there, never that they worked together, and a large one says they may never have met | null | `enriched_at` |
| `email` | `email_inbound` and `email_outbound`, counted from his mailbox, and `email_last`; a zero count is the column's default and is left out | null | `email_last` |
| `known_since` | `known_since` and `known_since_basis`, an upper bound on when they met | null | `known_since` |
| `reach` | `followers` on LinkedIn | null (the profile) | `enriched_at` |
| `badge` | `is_influencer`, `is_creator` | null (the profile) | `enriched_at` |
| `last_post` | `last_post_at`, unless a `post` already says that day | null | `last_post_at` |

Never a fact: `who`, `why_them`, `hook`, `risk`, `intent_summary`, `evidence` or any other sentence a model wrote. Never in a fact: an email address, a phone number or a profile link. A piece of text that carries one is dropped whole, never trimmed into a different sentence, and a profile (LinkedIn `/in/`, an X, Instagram, Facebook, TikTok or Threads account page) is never a `source_url`. `facts` is `[]` when the person was read and nothing qualifies, and null when the facts could not be read. Its coverage line is `{ source: 'facts', available, complete, rows, observed_at, reason }`: `rows` counts the people with at least one fact; `available: false` with `source_unavailable` when nothing could be read; `complete: false` with `role_history_unavailable` when the role history could not be read, so `role_change` is missing, not absent. A stale fact keeps its own date: how old is too old is yours to judge.

**Jonny's pitches (1.9.0).** Krish, 2026-10-27: pitch as many podcasts as possible from Jonny's Gmail, "Drafted daily, no press", "For visibility Jonny sends". A version 2 email action may carry `mailbox`: `null` (his own box, as before), `krish`, or `jonny`, and `jonny` only on the `visibility` row (a podcast) or the `events` row (a stage to speak on). Write a `jonny` pitch in Jonny's voice for Krish ("I work with Krish Raja", Krish in the third person, signed Jonny: Ruling, Krish, 2026-10-20), about a stage Control Center holds (`subject_ref: target:<id>`), to the stage's `booking_contact_id`. Control Center drafts each one into Jonny's Gmail with no press, best rank first, at most 10 a day (`api/_pitchDrafts.ts`), only once Gmail answers as Jonny's own box, and records it as carried out as a draft, so it never reaches Krish's list or a press on his widget, and the executor never sends it. Jonny reads it and presses Send. An earlier report naming a mailbox is refused.

**Context, 1.9.0.** Stages with no product are Krish's own visibility and are now in `visibility` beside Mindmake's. Each podcast carries what the daily walk read from its public feed (`api/_podcastFeeds.ts`): `feed_url`, `episodes`, `latest_episode_at`, and `booking_contact_id` with `booking_source` when the show publishes an address of its own (never the address). `drafts` carries each pitch's `proposal_id`, `visibility_target_id`, `mailbox` and what became of it, as Gmail and his calendar show it: `sent_at`, `replied_at`, `booked_at`, `recorded_at`, `published_at`. A show already pitched is not pitched again; learn from which ones answer. Each stage also carries the speaker call or guest form its own page links to (`cfp_url`) and, read from the form's own page by the daily walk, the fields it asks (`form_fields`: `[{ label, name, type, required, options }]`, `form_fields_at`; an empty list is a form drawn in script, which you leave alone). `visibility` carries each stage's `suggested_talk_title` and `audience_size`, and `guests` each guest's `invite_state` and `scheduled_at`; a guest's contact and a stage's booking contact get `routes`.

**Guest invites (1.9.0).** An invite to a guest for one of his own shows (Signal & Noise or Make Your Mind Up) is a `jonny` email on the `visibility` row about the guest (`subject_ref: contact:<id>`, the guest's own `contact_id`). Control Center drafts it into Jonny's Gmail with the same daily cap, files it as a guest draft (`job: guests`, `show` the guest's show), marks the guest invited, and reads its outcome as for a pitch; booked is the calendar event that names the guest, which sets the guest's `scheduled_at`.

**Forms on his tap (2026-10-27).** A version 2 `form` action (`recipient_contact_id: null`, `form: { url, answers: [{ label, value }] }`) on a stage (`subject_ref: target:<id>`) is now pressable: his **Submit** on the widget, or Clear on Home, fills the form in a browser with your answers, each in the field whose own label it names, and sends it (Ruling, Krish, 2026-10-26: "a form is filled for him and his tap submits it"). Write answers by the labels in `form_fields`, one for every required field. It submits only when every required field is filled and the page asks nothing only he can give: a CAPTCHA, a login, a payment, or a terms box (ticking one is a legal yes in his name). Otherwise nothing is sent and `forms` says why. `forms` carries each try (`proposal_id`, your own proposal id, `url`, `status`: `submitted`, `confirmed` when the page said it arrived, or `not_sent`; `filled`, `missing`, `blockers`, `unused` answers no field asked for, `after_url`, `after_title`, `submitted_at`; never the page's text or its picture). A `not_sent` form is yours to route again: answer what was missing, or fall to the next best route (a Jonny pitch to the stage's booking contact). A form is sent once per proposal; a stage it was sent for is marked applied.

### The show-notes note (1.10.0)

Ruling (Krish, 2026-10-27): "After one of Jonny's pitches to someone else's show or stage is booked, Jonny sends the host one short note asking for the brief link in its show notes or event page." You write the words; Control Center drafts them into Jonny's Gmail and never sends.

- **Served where.** Capabilities say `features.show_notes: true` (Mindmake only); send the kind only then.
- **The action.** A version 2 email action with `mailbox: "jonny"` and `kind: "show_notes_ask"`, on the `visibility` or `events` row, about the stage he was booked on (`subject_ref: target:<id>`), to the host Jonny pitched. Refused with a sentence naming why when the report is older than 1.10.0, the mailbox is not `jonny`, the channel is not `email`, or the subject is not a `target:`. Any other `kind` is refused; leave it out for a plain pitch.
- **When it is drafted.** Only once `drafts` holds one of Jonny's pitches to that stage (`job: booked`, `mailbox: jonny`, with its `proposal_id`) with `booked_at` recorded: someone else's show or stage confirmed a date. Never after a guest invite to his own shows (`job: guests`), and never for a stage booked through a form, which has no thread in Jonny's box. Until then it is held (`show_notes_not_booked`), out of sight.
- **Once a stage.** A stage already asked holds any second note (`show_notes_asked`), and the database refuses one (migration `20261112140000_show_notes_ask.sql`).
- **The walls.** It goes to the host Jonny just wrote to, so for a recorded booking alone the 14-day rule and the pause after his carried-out pitch do not hold it. Every other wall does: do not contact or closed, a No on that host or stage, words from files that moved, and an address on record.
- **Counted inside the ten.** Each note takes one of the 10 Jonny drafts a day, in your rank order with the pitches; rank it first if it should go the day the booking lands. It is recorded as carried out as a draft, so the executor never sends it, and Jonny presses Send.
- **In the context.** `drafts` carries it as `job: show_notes`, with `sent_at` and `replied_at` from its thread. It is never a pitch, a reply to a pitch or a booking: it never carries `booked_at`, `recorded_at` or `published_at`, the widget's count of Jonny's pitches leaves it out, and it never adds to this week's bookings.

### Held meetings and the good tap (1.10.0)

Ruling (Krish, 2026-10-27): "The number counts any good meeting: he marks it good with one tap after it, whether with a buyer, a multiplier, a partner or a host. The engine pre-fills where it came from, and the path is recorded once and never rewritten." Control Center collects the meetings, holds them and asks him; you count them. Capabilities say `features.meetings: true` for Mindmake only; every other engine gets nothing new.

**Collected.** Once a day, inside the daily push and just before it (`api/growth/engines-dispatch.ts`, `collectMeetings` in `api/_meetings.ts`), Control Center reads his connected calendars, read only, for the last 28 days. A meeting he held is a timed event (never all day) that has ended, was not cancelled and he did not decline, with 2 to 25 people, at least one of them a contact Control Center holds by an email on record. Never a stranger, never a meeting with only himself or Jonny. It keeps an opaque `meeting_id` (a hash of the calendar's own id and the start, never the raw id), the contacts and the start, never the title or an address. A meeting already kept is never written again, so his answer is never touched (table `growth_meetings`, migration `20261112130000_growth_meetings.sql`).

**Context.** `GET .../context` carries `meetings`: the last 28 days, oldest first, each `{ meeting_id, contact_id, held_at, good, good_at, origin_path, origin_ref, assists[], said_yes_because }`. `good` and `good_at` are null until he answers; `origin_path`, `origin_ref` and `assists` are null and empty until his tap records them; `said_yes_because` is null (nothing writes it yet). Its coverage line is `{ source: 'meetings', available, complete, rows, observed_at, reason }`. `available` is false when his calendar was not read (`calendar_not_read`: never read, no calendar connected, or every one failed), when the last read is more than 36 hours old (`calendar_read_stale`), when the table cannot be read (`source_unavailable`) or does not exist yet (`meetings_not_set_up`). `complete` is false when one of his calendars did not answer (`calendar_partly_read`) or the read could not keep what it found (`meetings_not_all_kept`). An unavailable list is never a count of none.

**The good tap.** One meeting at a time comes onto his one list (source `meeting`): the oldest he held in the last 14 days and has not answered. It waits until your first report after it was found, so you have had the chance to say where it came from, or a day, whichever is first. Clear says it was good; Purge says it was not. The same tap records where it came from, once: from your latest live report's `origin_candidates`, the first candidate that names a path for the person he met (then the others in the meeting) is `origin_path` and `origin_ref`, and any other path named for them is kept apart in `assists`. With none, it is `unknown`. Once recorded it is never rewritten, by a later report or anything else: the database refuses the change. If your report cannot be read at his tap, nothing is kept and he taps again, so a passing failure never records `unknown` for good. So send a candidate for each person in an unanswered meeting in your context, in the run after it appears.

### The research desk (1.6.0)

Control Center holds the tools; the engine decides what to look up. `POST /api/growth/engines/<slug>/research` with `{ requests: [{ request_id, kind, subject_ref, query, why }] }`, 1 to 10:

- `kind` is `search` (an Exa web search: up to five results, each `{ title, url, snippet, published }`) or `question` (a Perplexity answer with its citations), or one of the three LinkedIn signal kinds below.
- `query` is at most 400 characters and never carries an address or a phone number; `why` says what the answer decides.
- Each `request_id` is answered once: the same id replays its stored answer, and the same id with different words is 409.
- Status is `answered`, `empty`, `failed` or `over_cap`. The caps are per day: 40 searches (about $0.0025 each) and 20 questions (about $0.001 each), from measured unit costs; 6 `posts` (up to $0.02 each), 3 `post_engagers` (up to $0.08 each) and 8 `person_route` (up to $0.01 each), from the Apify actors' published prices, each run also capped in dollars at Apify. Every kind at its cap is about $0.56 a day. Over the cap nothing runs; ask again tomorrow under a new id. `GET .../capabilities` carries `research: { kinds, per_day }`.

**Signals** (Krish, 2026-10-26: people who comment on posts like "AI's next job casualty could be your boss" are worth reaching, "but only if they're the right types of ICP: worried executives, as opposed to AI people"; the voices he follows "are talking to the people I want to talk to"; "the growth engine needs to think about those types of signals and relevant signals from the ICPs I want, and bring them to me for action"). Which signals matter, which posts to read and which commenter is his buyer are yours. Control Center only collects:

- `posts`: `query` is topic words, or the profile link of a voice (`https://www.linkedin.com/in/<id>`). Up to ten posts from the last month, each a result with `engagement: { comments, reactions }`; `title` is the author and their headline.
- `post_engagers`: `query` is one LinkedIn post link. Up to forty commenters, one result each, with `snippet` their comment as written and `person: { handle, name, headline, contact_id }`. `contact_id` is set when he already has them, which makes them warm. The post's author is left out, and so is anyone he marked do not contact or closed.
- `person_route`: `query` is `li:<handle>` from a `post_engagers` result. Someone he already has costs nothing (`subject_ref` names them). Otherwise one profile read with an email search, and the person is filed as a cold, engaged contact (`origin_channel` `growth_signal`), so you can name them as `contact:<id>` and his press can draft to them. The answer says only `an address the search checked`, `only a guessed address, kept off the record` or `no address found`; an address the search did not check never reaches the record (`api/_ingestGate.ts`), and the same person is never searched twice or filed twice. The address never comes back to you.
- `GET .../research[/<request_id>]` reads them back, and the next context carries the last 14 days.

### Prior Mindmake outreach (1.11.0)

Ruling (Krish, 2026-10-27): "We need to make sure that if I've already reached out to this person for MindMake, legibility is positioned as a partner product." Control Center is the one source of whether someone was reached for Mindmake (`api/_priorOutreach.ts`), and growth-legibility copies its answer unchanged into `candidate.contact.prior_mindmake`.

`GET /api/growth/engines/legibility/prior-outreach?contacts=<id>,<id>` takes 1 to 50 distinct Control Center contact ids, lowercase uuids, comma separated. It answers growth-legibility only: any other engine gets 404 `prior_outreach_not_supported`, and `features.prior_outreach` is true for Legibility alone. Anything else in `contacts` (a name, an uppercase id, a repeat, 51 ids, none) is 400 and reads nothing. It sits behind the same bearer and rate limit as every route here.

It returns `{ ok, schema_version, read_at, prior_outreach }`, where `prior_outreach` holds exactly the ids asked for, in their order, each a closed record of five keys:

| state | by | state_at | last_touch_at | record_url |
|---|---|---|---|---|
| unknown | null | null | null | null |
| none | null | null | null | the person's record |
| open, client | null | null or a UTC time | null or a UTC time | the person's record |
| drafted | null | UTC | UTC, at or after state_at | the person's record |
| sent, replied | krish or other | UTC | UTC, at or after state_at | the person's record |
| met | krish | UTC | UTC, at or after state_at | the person's record |

`record_url` is the person's own record in Control Center, `https://controlcenter.krishraja.com/#/people?person=<id>`, which opens the one person sheet. No answer carries a name, an address, a subject, a body, a thread id or a row id.

**What counts.** Mindmake outreach by Krish, and Mindmake notes a colleague sends for him (`by: other`). Visibility never counts (Ruling, Krish, 2026-10-27): podcast pitches, guest invites, press asks, the People drafts for Guests, Speaking and press, and Events, and the pitches a colleague sends for him on the visibility and events rows. Someone touched only by those reads `none`, or `open` while one of those items is still open. The sources, each read for the asked ids only:

- **Advisory** (`pilot_deals`). The stage comes from the stamps, never from the current state: `call_taken_at` is met, `replied_at` or `call_booked_at` replied, `sent_at` sent, `drafted_at` drafted, all by Krish, for the buyer, intro and collaborator ask kinds. A deal that is listed, drafted, replied, call booked or call taken now is open, whatever its kind. A deal booked or paid for a pilot is a client.
- **growth-mindmake's proposals.** One carried out as a draft or a message is drafted, outside the visibility and events rows and Jonny's box. One pending and live that names the person as its recipient or its subject is open. Declined, expired and form submissions do not count.
- **growth-mindmake's executor** (`growth_engine_actions`). Verified is sent by Krish; claimed, submitted or unknown is open.
- **People drafts** (`people_drafts`, by `contact_id`). The advisory job counts (Jonny's box is `other`); the job hunt never does. A draft in a colleague's box not yet sent, within 90 days, or booked and not recorded, is open. A show recorded is never met.

**For Krish to confirm:** whether the `reconnect` ask kind counts as Mindmake outreach. Until he says, it does not (it is open while open).

**The order** is unknown, then client, then open, then the furthest of met, replied, sent and drafted, then none. Krish's own rows decide the stage when he has any; otherwise a colleague's. `last_touch_at` is the latest counted touch.

**Unknown is not none.** Every id is unknown when any source cannot be read, or comes back incomplete; an id is unknown on its own when it has no contact row (missing, or merged away into another) or carries a date Control Center cannot read or one after `read_at`. `none` means every source was read whole and nothing counted was found. Read again at the time you prepare: the record changes as he works.

**On his list.** Whatever route a Legibility send takes to his list, Control Center reads the record there too, and holds it off the list, counted and named, when: no one person is linked to it (`prior_outreach_unlinked`: name them in `subject_ref` as `contact:<id>`, or, at 1.0.0, put their record link in the evidence); the record is unknown (`mindmake_history_unknown`), open (`mindmake_thread_open`) or a client (`mindmake_client`); the last Mindmake touch is under 14 days old (`mindmake_touch_too_recent`); or the words contradict the record: someone reached for Mindmake whose words do not name Mindmake (`mindmake_not_named`), or someone never reached whose words do (`mindmake_named_without_touch`). One it allows shows the record in words on its evidence line.

## The report

The schema is [engine-report.schema.json](engine-report.schema.json). Every field is listed below. A field the protocol does not know is refused, never dropped.

| Field | Meaning |
|---|---|
| `schema_version` | `"1.2.0"`, `"1.1.0"` without its subject, or `"1.0.0"` without the 1.1.0 fields either |
| `engine_id`, `product_slug` | Must equal the registry row for the token |
| `run_id` | Stable id for this run. It is also the `Idempotency-Key` |
| `mode` | `live` or `synthetic`. Synthetic reports are stored and read back, but never touch live progress, the directive, the list or `workflow_runs`. A live report is refused until Krish switches the engine on |
| `observed_at` | When the facts were read |
| `source` | `{ revision, captured_at }`: the commit or snapshot the run used |
| `status` | `ready`, `held` (it ran and held its work, with reasons) or `degraded` (some sources missing). A business hold is not an error |
| `objectives[]` | One reading per objective: `{ key, value, unit, window_start, window_end, timezone, availability: measured\|missing\|stale, reason }`. Unknown is `value: null` with a reason, never zero. A measured zero is `0` |
| `activity[]` | What it did: `{ line, evidence_url }`, in plain words |
| `proposals[]` | At most 10, each shaped as below |
| `events[]` | What closed: `{ event, proposal_id, at, evidence_url }`. An event closes a proposal only when it names that proposal and the event in its `close_condition`, and closes a walled proposal only after Krish approved it |
| `holds[]` | `{ reason, detail }` for anything it held |
| `withdrawn[]` | 1.10.0, optional (capabilities say `features.withdrawn: true`): your own pending proposals you take back, `{ proposal_id, reason }`, at most 40. Each one Krish has not decided becomes `expired` with your reason kept (`done_evidence: { kind: 'withdrawn', reason, run_id }`) and leaves his list; one he decided, or another engine's, is left as it is. A proposal may not be both proposed and withdrawn in one report, and a reason is words, never an address. Use it when the record a proposal rested on is gone, so it could never run |
| `origin_candidates[]` | 1.10.0, Mindmake only (`features.meetings`), optional. Where you read his recent meetings came from: `[{ contact_id, path, origin_ref }]`, at most 40. `path` is one of `existing-relationship`, `multiplier-intro`, `partner`, `guest-seat`, `podcast`, `own-show-guest`, `public-signal`, `inbound`, `referral` or `unknown`; `origin_ref` is a stable id (`contact:<id>`, a proposal id) or a public https page, never an address, or null. A report from another engine carrying it is refused, as is an older version. Below, held meetings |
| `payload_sha256` | SHA-256 of the canonical JSON of the report without this field: keys sorted at every depth, no whitespace, arrays kept in order, no Unicode normalisation. The server recomputes it |

**A proposal.**

| Field | Meaning |
|---|---|
| `proposal_id` | Stable across runs. A changed payload keeps the id and changes `payload_sha256`, and that sends it back to Krish |
| `title`, `why` | Plain words |
| `kind` | `advice` (a sentence), `prepared` (the artifact exists) or `autonomous` (finished inside the walls). An autonomous proposal cannot be behind a wall |
| `wall` | `none`, `spend`, `send`, `post` or `strategy`. Anything behind a wall goes on Krish's one list on Home |
| `amount_usd` | Required for `spend` |
| `channel` | Where it would go |
| `exact_payload` | The exact words. Required for `send` and `post` |
| `objective_key` | Which objective it moves; the directive rule weighs it by that objective's gap |
| `evidence[]` | `{ label, url }`, at most 12, https only |
| `close_condition` | `{ event, reference }`: the event that proves it done |
| `expires_at` | After this it never comes forward |
| `stage` | 1.1.0. `plan`, `go_live` or `check_in` for an autonomous engine's steps, below. A plan is behind a wall; a go-live is a send, post or spend; a check-in is a `strategy` call with its progress in `exact_payload` |
| `parent_proposal_id` | 1.1.0. The plan a go-live carries out, or a check-in reports on. Required on both |
| `subject_ref` | 1.2.0. The person, stage or room it is about, by the id Control Center gave you: `contact:<id>`, `target:<id>` or `event:<id>`. Optional. When Advisory, People, Visibility or Events already holds the same one, his list keeps their copy, not yours (below) |

A proposal may not carry a key that asks Control Center to act (`send_*`, `post_*`, `publish_*`, `schedule_*`, `spend_*`, `pay_*` and so on). An engine proposes; nothing in Control Center sends for it.

## The attempt

| Field | Meaning |
|---|---|
| `attempt_id` | Stable id |
| `command` | For example `daily`, `engine`, `weekly-review` |
| `run_id` | The report it produced, or null |
| `status` | `started`, then exactly one of `succeeded`, `failed` or `unknown` |
| `phase` | Where it was, for example `capture`, `plan`, `report` |
| `error_code` | lower_snake code, required on `failed`. A code, never a message, body, URL or credential |
| `started_at`, `finished_at` | `finished_at` is required on a terminal state and absent on `started` |

The response and the readback carry the attempt exactly as the engine sent it, times included, so an engine can compare by exact equality (the store keeps its record beside the time columns, migration `20261030100000_growth_engine_attempt_record.sql`). A terminal record never changes. An exact replay is accepted, and a different terminal record for the same id is a 409. A `started` attempt with no end after 6 hours reads as unknown. Write the started attempt before you read any source, so a failure before the report still shows.

## The directive

The schema is [engine-directive.schema.json](engine-directive.schema.json).

| Field | Meaning |
|---|---|
| `directive_id` | `<slug>:<date>` |
| `for_date` | His day, in his time zone |
| `aim` | The engine's North Star |
| `objectives[]` | Each objective with its `target` (null when nobody set one), the `latest` value and its `availability` |
| `next_action` | `{ proposal_id, instruction, why, close_condition }`: the one thing to do |
| `decisions_since[]` | His decisions in the last seven days, each as `GET .../decisions` gives it: the `payload_sha256` it was made on, the `stage`, and his version when `amended` |
| `constraints` | `{ walls, autonomy, autonomy_rule, spend_cap_usd: 0, max_actions: 5 }`. `walls` is the rule above, word for word; `autonomy` and `autonomy_rule` say who acts once he approves, below, and end with the one-ask-at-a-time rule |
| `aim_by`, `week_of`, `week_target`, `current`, `urgency`, `urgency_reason` | 1.4.0, optional. The parent product's North Star number from Control Center's daily refresh (Control Center ADR-040): its deadline, this week's rung of its weekly ladder, the latest reading, the urgency U1 to U5 by ai-harness `contract/north-star-metric.md`, and why. Mindmake's figures read `"private"`. Absent when no refresh has read the number |
| `north_star` | 1.4.0, optional. `{ parent, own, intensity }`: the parent product's number and the engine's own (each `{ repo, metric, unit, aim_by, week_of, week_target, current, urgency, urgency_reason, read_on }`, or null), and `intensity { urgency, drafts_multiplier, rule }`, set by the more urgent of the two. U3 doubles draft output, U4 asks for a bold swing every day, U5 for three unconventional recovery plays. The walls, `spend_cap_usd` and `max_actions` never move with it |
| `taste` | 1.5.0, optional. `{ rule, approved_voice_rules[] }`: Krish's approved voice rules (`taste_profile_form`, lane voice: approved or reworded by him only, form only, his words only while the answer they quote stands), each `{ layer, rule, his_words, what_it_means }`. Follow them for how anything you draft is written, never to choose what it is about, and never to judge, score or rank. An empty list means none approved yet: never invent one. Absent means they could not be read today (krishanraja/inspirationhouse `docs/TWO_WAY.md`, step 6) |
| `week_goals` | 1.6.0, optional. His goals for this week in his own words, newest week, at most three. A row's `serves` quotes one exactly. Empty when he has set none; absent when they could not be read |
| `rows_rule` | 1.6.0, Mindmake only, with `week_goals`: how to put people in front of him, word for word (the five rows, above) |
| `web_analytics` | 1.10.0, optional. Only for an engine whose product is the venture of a Google Analytics site with the per-post breakdown (`contentBreakdown` in `src/lib/webProperties.ts`, matched by the site's venture; Make Your Mind Up, site `mymu`) or one its engine reads without it (`engineReads`; Mindmake, site `site`, mindmake.co, since 2026-10-27: Ruling, Krish, 2026-10-27, through Control Center, never directly). For a site without the per-post breakdown there are no `utm_content` rows, `events` is null and no reason is given for it. `consent_gated: true` is present only for a site that counts a visitor once they press Allow (mindmake.co): every count is a floor. `{ property, measurement_id, through, days, events, rows, coverage }`: the last `days` (28) of `web_analytics_daily` through the newest day captured (`through`). `rows` is every breakdown row in the window, oldest day first, each `{ date, dim_type, value, sessions, users, key_events }`, where `dim_type` is `source_medium`, `landing_page` or `utm_content`, and a `utm_content` value is `<utm_content>|<session source>|<event name>` (split it on the first and the last `|`, never on every one, since a source can hold one; `users` on a `utm_content` row is Google's total users for that post, source and event, so never add it across a post's events). `events` is each event name in the per-post rows, `{ name, key_event, count_28d }`: `key_event` is true when its key events add up above zero, and `count_28d` is the sessions it happened in, summed over those rows (sessions, not events). `coverage { complete, reason, dates }` says what is missing, and `dates` lists the days that carry rows of each kind. The per-post part is judged on its own days, never on the source rows that go back further: when the per-post breakdown starts inside the window, or per-post rows are on fewer days than the window, `complete` is false and the reason says how many days `events` and `count_28d` cover. A day without per-post rows had no tagged visits or was not captured, so it is unknown, not zero. A newest day more than 2 days before the directive's day also makes it incomplete. A part that cannot be read is null with its reason, never zero: the table unread or nothing captured makes `through`, `events` and `rows` null; no per-post row in the window makes `events` null. Counts only: no person and no address (a value that reads as an email address is left out). Absent for every other engine |
| `in_house` | Mindmake only. `{ rule, counts }` says what Advisory (`pilot_deals`), Network (warm tiers) and Visibility (stages and rooms) did this week inside Control Center, as counts. A part that could not be read is `null`, never zero. They are records Control Center holds, sent as data: growth-mindmake owns every Mindmake growth decision (Ruling, Krish, 2026-10-27), and never drafts a second note or pitch to someone a record already holds |

**How the next action is chosen, by rule** (Ruling, Krish, 2026-10-18), in order:

1. Something Krish approved that the engine has not yet done, with the approved payload (his version when he amended it). For an autonomous engine, an approved plan says "build it up to go-live, then propose the go-live", and an approved go-live says "go live with exactly what he approved".
2. If the engine is failing, unknown or stale: repair, naming what broke.
3. The unwalled pending proposal that closes the widest gap to an objective. An objective that is not measured yet counts as a wide gap, and a proposal on no objective as a small one. Urgency raises the floor of every gap on an objective (U2 0.1, U3 0.4, U4 0.6, U5 0.8), so behind the number, a proposal that moves it comes first.
4. If everything proposed is behind a wall: keep preparing, and do not act on what waits on Krish. He sees one of your asks at a time, so add no second ask of a kind that already waits on him.
5. If nothing is proposed: propose your best move on the widest gap; at U3 two experiments, at U4 one bold swing, at U5 three unconventional recovery plays, each different in kind.

Krish can pick another unwalled proposal on Growth > Engines as tomorrow's push (`chosen_by: krish`). The rule never replaces his pick.

## Amend: his version before his yes

On his list, an engine's proposal that carries words (`exact_payload`) or, for a spend, an amount can be changed before he approves it ("Change it first", then "Approve my version": one press). Ruling (Krish, 2026-10-19): he approves or amends.

- His yes is still to the proposal he was shown: `payload_sha256` in the decision is the engine's digest.
- The decision also says `amended: true` and carries his version: `exact_payload`, `amount_usd`, and `amended_sha256`, the SHA-256 of the canonical JSON of exactly `{ "amount_usd": ..., "exact_payload": ... }` (both keys, `null` when absent).
- Recompute `amended_sha256` before acting, then act on his version, never your own.
- If you change the proposal's payload after his decision, his yes and his version both lapse, and it comes back to him.

## Autonomy: plan, then go-live

Each engine is `handcrafted` or `autonomous` (`growth_engines.autonomy`, in the directive's `constraints` and in `capabilities`). Ruling (Krish, 2026-10-22): Mindmake now prepares autonomously and executes only a supported, exact approved finished action with independent verification. This supersedes its 19 October handcrafted setting. Krish can switch any engine back to handcrafted.

**Autonomous**, in two steps, each on his list:
1. **The plan.** Propose what you are going to do as `stage: "plan"` behind a wall (usually `strategy`), with the plan in `exact_payload` so he can amend it. Wait for his yes.
2. **The go-live.** Once the plan is approved, build everything up to go-live: the assets, the exact words, the amount. Then propose `stage: "go_live"` with `parent_proposal_id` set to the plan, behind `send`, `post` or `spend`. Nothing goes out yet.
3. **Live.** When he approves the go-live, go live yourself with exactly what he approved, or his amended version, and report the closing event with its evidence. Purge on a go-live means stop.
4. **Check in, often.** While a plan is open (approved and not done), propose `stage: "check_in"` naming it, behind `strategy`, with how it is going against the plan and what comes next in `exact_payload`. His list asks "On track?": Clear keeps it going, his amendment redirects it, Purge stops the plan (the rule then never pushes it again). Each engine's repository sets how often; a go-live never waits on a check-in, and a check-in never replaces the go-live review.

A go-live of creative work (a post, a video, a caption) meets the engine's own quality bar before it is proposed, and says so in its evidence. Krish has a low tolerance for poor creative output: hold work that is not good enough rather than propose it, and treat his amendments and declines as the standard to learn from.

**Handcrafted:** prepare the exact artifact and stop. Krish sends, posts or spends himself.

Either way, the walls rule holds: nothing goes out without a decision whose digest matches what goes out.

## On his list: one ask at a time, one copy of a thing

Ruling (Krish, 2026-10-21), so the engines and the parts of Control Center that already queue things for him never put the same thing in front of him twice:

- **One ask per engine at a time.** Of an engine's walled proposals, his list shows one: a go-live first, then a check-in, then a plan, then a spend, a send, a post and a strategy call, the oldest first within each. The rest wait their turn, each named, and the next comes forward when he answers (or bumps) the one shown. So never add a second ask of a kind that already waits; keep the one waiting current instead.
- **Spends take turns by the ladder** (Ruling, Krish, 2026-10-22). Spends draw on the same prepaid credits, so while one venture's spend (not its plan or check-in) is on his list, a spend from a venture lower on the portfolio ladder is held, named (`waits_on_ladder`), and comes forward when the higher one is answered or bumped. That engine's next ask still comes forward in the meantime.
- **A Legibility invitation waits on the person's Mindmake record** (Ruling, Krish, 2026-10-27). It is held, counted and named, for the reasons in "Prior Mindmake outreach (1.11.0)" above.
- **One copy of a person, stage or room.** Advisory (`pilot_deals`), People, Visibility and Events already draft notes and pitches. A proposal whose `subject_ref` names someone or something they hold is left off his list, and theirs stays. It is not declined: it waits, and it lapses when it expires. Never a second note or pitch to someone a record already holds.
- **Who owns what.** Control Center's People and Visibility own outreach to shows and guests for Make Your Mind Up, so that engine proposes posts and measures, never a pitch, a swap or a partner note. A product with an active engine has that engine as its one strategy voice: the Sunday growth council writes no weekly move for it.

## Health, as Growth > Engines shows it

The states are `inactive`, `never_reported`, `healthy`, `held`, `degraded`, `failing`, `stale` and `unknown`.
- The newest attempt speaks first. A newer failure never inherits an older success, and the last success is shown beside it.
- Stale means no report or attempt past the cadence: 36 hours for daily, 8 days for weekly, 15 days for fortnightly.

## What lands where

| What | Where |
|---|---|
| Each accepted live report | One `workflow_runs` row (`workflow_id` = `engine_id`, `agent_id` from the registry), so fleet health sees it |
| A walled proposal | Home's one list, source `engine`, one per engine at a time and never beside Control Center's own copy of the same subject. Clear approves exactly that payload, Purge declines, Bump keeps it off until his next day (`api/_verbs.ts`, `actOnEngine`) |
| An unwalled proposal | Growth > Engines, where he can pick it as tomorrow's push |
| A row proposal (1.6.0) | His home screen widget, in the engine's rank within its row, and his one list like any walled proposal. On either, the press carries it out (`api/_rowPress.ts`): a Gmail draft in his box, or a message app opened with the words typed, recorded as `carried_out`. His No is recorded with its `reason_code` |
| A meeting he held (1.10.0) | Home's one list, source `meeting`: "How was your meeting with <name>?", one at a time. Clear says it was good, Purge says it was not, Bump keeps it off until his next day (`api/_verbs.ts`, `actOnMeeting`). His answer, and where it came from, reach you in the context's `meetings` |
| Objectives, activity, holds | Growth > Engines |
| Media and copy to review | Growth > Packs, until packs join this protocol |
