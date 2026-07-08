# Vet Visit Prep PDF — design prompt

Drafted 2026-07-08 from product direction by Dr. Jake Rodgers. Reference
artifact: a browser print of the classic care-plan page Jake uploaded — it
shows the CONTENT a visit needs (questions with context, structured meds,
the vaccine tracker with due-status, identified conditions, the visit
itself), wrapped in UI chrome no vet should receive. The visit-prep PDF's
job is that content, none of that chrome.

## How it looks today (`generateVetVisitPDF`, app.js ~2911)

An unstyled text dump with real data bugs:

1. **It ignores the live tables.** Questions come from
   `carePlan.living_plan.open_questions` (a legacy text field) instead of
   `state.openQuestions` (the `care_plan_open_questions` table the UI
   writes to) — so an owner with saved questions gets blank write-in
   lines. Medications read a text field instead of `state.petMedications`
   (name/dose/frequency). Diagnoses read text instead of
   `state.diagnoses`.
2. **The vaccine tracker is absent entirely** — the single most
   actionable thing in Jake's artifact (five vaccines, every one due for
   catch-up) never reaches the vet.
3. **The visit being prepped for isn't on the page.** No upcoming
   appointment, no buddy/practice identification, no latest weight.
4. **No design.** Green headings on default Helvetica, raw
   `label: value` lines, a single gray footer sentence. Nothing says
   Vet Buddies; nothing guides the vet's eye.

## How it should look

One branded, print-friendly A4 page (two only when content demands it),
built with jsPDF primitives — no new dependencies, no emoji (core PDF
fonts can't render them).

**Header** — full-width forest-green band (#336026): small "VET BUDDIES"
wordmark, "Vet Visit Prep" in large white bold, generation date right-
aligned. Under the band, the identity block: pet name bold with
species · breed · age · latest weight on one line; below it, owner name
and "Vet Buddy: {name} · Supervised by Dr. Rodgers, Rodgers Veterinary
Care" in small gray.

**This visit** — when an upcoming appointment exists: a light sage
rounded box with the appointment title and full date/time. This anchors
the document to the visit it prepares.

**Sections**, each introduced by a sage uppercase label over a hairline
rule, in this order:

1. **Questions from the owner** — numbered, bold, with the question's
   context in smaller gray beneath; sourced from the open-questions
   table (unresolved only). If none: three ruled write-in lines.
2. **Current medications** — one row per active med: name + dose bold
   left, frequency right, hairline rules between rows. Fallback to the
   care-plan text field only when the table is empty.
3. **Vaccines** — one row per vaccine: name, "Given … · Due …" beneath,
   and a right-aligned status word colored by state: *Overdue* (deep
   brick), *Due soon* (amber, ≤30 days), *Current* (sage). This is the
   tracker from Jake's artifact, made scannable.
4. **Known conditions** — diagnoses from the table (name + diagnosed-on),
   plus allergies from the care plan when present.
5. **Recent activity** — last appointment summary and date; latest
   weight with its recorded date.
6. **Notes during the visit** — four ruled lines.

**Footer on every page** — hairline rule, "Prepared with Vet Buddies for
{pet} · {date}" left, "Page N of M" right.

Empty sections render a single quiet gray line ("None recorded"), never
invented content. Colors: forest #336026, sage #689562, ink #2D2A26,
soft gray #7A7268, rules #C8BFAF — the brand palette, print-safe on
white.

## Integration notes

- Keep the signature and call site (`download-vet-visit-pdf` handler)
  unchanged; the generator reads `state.openQuestions`,
  `state.petMedications`, `state.petVaccines`, `state.diagnoses`,
  `state.appointments`, `state.petVitals` directly — all loaded by the
  time the button is reachable.
- `generateCarePlanPDF` (the full-plan export) is out of scope.
- Verify with the harness: enrich the stub with questions, vaccines in
  all three states, a diagnosis, and a weight vital; generate the PDF
  through the real button path and inspect the rendered pages.
