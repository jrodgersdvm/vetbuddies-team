# Care Plan "Print Full Plan" printout — review prompt

Drafted 2026-07-11 from product direction by Dr. Jake Rodgers. Reference
artifact: a 10-page browser print of Mr. Paws' case page (Vet_Buddies1.PDF),
produced by the 🖨️ Print Full Plan button. Use this prompt to review any
full-plan printout against, and as the spec for the revised print format.

## The prompt

> Review this printout of the care plan as three different readers:
> the **owner** filing it at home, the **receiving clinic** matching it
> against their record, and the **next Buddy** picking up the case. For
> each page ask: (1) Is anything on this page an interactive control —
> button, input, dropdown, filter, nav — that is dead ink on paper?
> (2) Does this page assert anything the app cannot claim — e.g. an
> empty-state sentence that reads as a clinical statement? (3) Has this
> content already appeared on an earlier page? (4) Is anything cut off
> by a scroll container or off-screen chart? (5) Would any of this harm
> the case if the paper were handed across the front desk — staff-only
> context, internal notes, wellness ratings? Then ask of the document as
> a whole: could the clinic identify the patient (species, breed, age,
> DOB, weight, owner) and the document (what it is, who prepared it,
> when) from the first ten lines? Flag every failure, then propose the
> shortest format that keeps every load-bearing fact.

## What the review of the Mr. Paws artifact found

Print Full Plan is `window.print()` over the live case page, patched by a
small `@media print` block (styles.css ~1356). Ten pages, of which maybe
three carry information:

1. **UI chrome prints everywhere.** App header (hamburger, bell, theme
   toggle), bottom nav, Escalations button, status/buddy/tier dropdowns
   with chevrons, the profile-completeness meter with its ✏️ Finish
   button, the message composer ("Type a message… press / for
   templates"), Send/Routine/mic buttons, "+ Schedule Appointment",
   "Discontinue" on every active med, ICS/edit/✕ on every appointment,
   the "Invite a co-owner by email…" input, "+ Create Handoff", the
   engagement filter pills — and the 🖨️ Print Full Plan button itself.
2. **Appointments print twice, in full.** Once inline in the care plan
   body (page 4) and again from the hidden Check-ins/Appointments tabs
   (page 9), because the print CSS forces every `.tab-content` visible.
3. **Empty sections print their coaching copy.** "No vitals recorded
   yet…", "No diagnoses recorded yet — log them as they're shared…",
   "No handoffs yet…", "No context captured yet — tap Edit…". On paper
   these read as either clinical claims or instructions to nobody.
4. **Truncated and blank content.** The last engagement entry is cut
   mid-sentence ("pending his scheduled dental procedure" and the page
   ends); the conversation image is clipped by its scroll container;
   page 5 is an almost-blank "Health Record" heading (chart canvas) and
   page 10 is entirely blank.
5. **Staff-only surfaces are on the paper.** Owner Wellness, Owner
   Context, Handoff Notes, DVM Clinical Notes (Admin Only), Internal
   Notes (Staff Only) all print — empty here, but the same print with
   content leaks the moment the page is handed to an owner or clinic.
6. **No document identity.** No printed date, no owner contact, no
   species/DOB line a clinic could match records against, no statement
   of what the document is or who prepared it. Active medications show
   name only — no dose or frequency (Gabapentin liquid, Cerenia
   Tablets), while the visit-prep PDF already prints all three.

## How it should print

Print Full Plan builds a **dedicated print document** from state — the
same injected-node pattern `prepare-for-visit` already uses — instead of
printing the live DOM. Serif on white, forest-green section heads, no
emoji decoration, no controls of any kind.

**Audience rule (decides length and privacy in one stroke):** a printout's
audience is unknowable once it leaves the printer, so the document
contains exactly what a client may see on screen. Staff-only sections
(Owner Context, Owner Wellness, Handoff Notes, DVM Clinical Notes,
Internal Notes) and check-in quotas never print. The conversation thread
never prints — it is chat, not plan.

**Header** — "Vet Buddies · Living Care Plan"; pet name large; one
identity line: species · breed · age (DOB verbatim) · weight; one line:
owner name + email; one line: Buddy (when assigned) · "Supervised by
Dr. Jake Rodgers, DVM"; plan status + tier + printed date right-aligned.
Standing italic caveat: "Owner-reported information from the Vet Buddies
care app — verify against clinic records."

**Sections**, fixed order, each printed **only when it has content** —
omission asserts nothing, placeholders assert too much:

1. **Next appointment** — highlighted box: title, date/time, type.
2. **Pet profile** — the living-plan text as written.
3. **Active care goals** — goal, status, set-by, date.
4. **Diagnoses** — condition, status, diagnosed date/vet, notes.
5. **Medications** — Active as a table (name / dose / frequency /
   started); Past as one compact name-and-dose line each, no table.
6. **Vaccines** — name, given, due, status word (Overdue / Due soon /
   Current).
7. **Vitals** — latest weight and temperature with dates, then up to
   five most recent entries, one line each.
8. **Open questions for the vet** — unresolved only, numbered, urgent
   flagged, context beneath.
9. **Appointments — once.** All upcoming; the five most recent past
   (title · date · type); cancelled omitted; a count line when older
   ones are cut ("…and 3 earlier appointments").
10. **Milestones & wins** — title, detail, date.
11. **Recent activity** — engagement log + timeline merged, newest
    first, capped at ten one-line entries with an "…and N earlier
    entries" count. Never silently truncate.
12. **Genetic insights** — title, content, risk flags,
    recommendations (already client-visible).
13. **People & providers** — co-owners and helpers on one compact list
    (the owner and Buddy already live in the header); external providers
    with role, clinic, phone, email.
14. **Documents on file** — name · type · service date · uploaded by.
    A list of what exists, not links.

**Footer** — "Prepared with Vet Buddies for {pet} · printed {date}".

A plan with nothing in any section prints the header plus one quiet
line ("Nothing recorded on this care plan yet."), not fourteen empty
headings.

## Integration notes

- Reuse the visit-prep injection mechanics (hidden node + print-only
  stylesheet + afterprint cleanup, app.js ~13843) — extract it into a
  shared helper rather than duplicating it.
- The button at app.js ~7003 stops calling `window.print()` and
  dispatches a `print-full-plan` action next to `prepare-for-visit`.
- Data comes from the same sources the screen renders:
  `state.currentCase.pets`, `state.goals` (fallback
  `living_plan.active_care_goals`), `state.diagnoses`,
  `state.petMedications`, `state.petVaccines`, `state.petVitals`,
  `state.openQuestions`, `state.appointments`, `state.timelineEntries` +
  `living_plan.engagement_log`, `living_plan.milestones_and_wins`,
  `state.geneticInsights`, `state.petCoOwners`, `state.careProviders`
  (fallback `living_plan.care_team`), `state.documents`.
- The `@media print` block in styles.css stays as the Ctrl+P fallback
  for the live page; it is no longer the Print Full Plan path.
- `renderHealthSummary` (client health summary print, app.js ~8051) and
  the visit-prep PDF are out of scope.
