# Simple student side, teacher side, and Playbooks A and B

September 29, 2026. Implementation plan for the easier CIRC HQ at the existing address. No private schedule, roster, surname or local path appears here.

## Goals

1. A student opens one stable link and sees today's activity: goal, picture-led steps, what to turn in and an optional next challenge. Students can browse both playbooks.
2. A teacher opens the same site and sees the next obligation (time and place), the current class lesson, a timer and quick prep, later obligations, and plain links to the schedule and both playbooks. Advanced tools stay collapsed.
3. Two full-year alternating routes: Playbook A (2026-27, current) and Playbook B (2027-28, next).

## Student side and teacher side

- `student.html` is a separate page with its own module graph (`src/student.js`, `src/ui/playbook-view.js`, `src/model/playbooks.js` and the lesson data it reads). It imports no storage, schedule, cloud or teacher-plan module and never reads `localStorage`. A test walks its import graph to enforce this.
- The deep link carries curriculum identifiers only: `student.html#playbook=a&meeting=12&grade=5`. Reloading or bookmarking it reproduces the same lesson. It never carries a class name, teacher name, date or time.
- `index.html` and `mission-control.html` stay byte-identical. When either is opened with `#student` or `?view=student`, `src/app.js` redirects to `student.html` before the saved teacher state is read.
- The Student and Teacher doors are a screen choice, not a login. Real private data protection remains the existing device storage and optional signed-in cloud sync. Copy says so plainly.

## Teacher home

Order on the first screen: Next up (title, time, place, countdown), This class (lesson, playbook meeting, grade, quick prep, Start lesson, Student link), Timer (the running lesson's clocks when one exists), Later today (schedule plus dated updates, with source freshness and conflicts), then links to Schedule, Playbook A and Playbook B. Weather, Board, week, the Tech Terrarium hero, announcements and the 36-experience library move into a collapsed "More tools" area.

Each class's place in a playbook is stored on this device only (`circHQ.classProgress.local.v1`), keyed by the private class label from the teacher's own schedule. It is never synced, exported to a student link or shown on the student page.

Without a saved schedule the teacher side shows a gentle empty state with one primary action, "Set up my schedule once", and still lets the teacher browse and run any playbook lesson.

## Dated updates (appointments and assignments)

- Local import only: `circHQ.datedUpdates.local.v1`. Contract in `docs/DATED-UPDATES-IMPORT.md`.
- Each update: `date`, `start`, `end`, `title`, optional `place`, `source`, `verifiedAt`, `status`.
- The file declares the date range that was actually checked. Days outside that range say "not checked". A checked day with no listed update is never shown as "confirmed no events".
- Past-dated updates expire from the home screen. Updates verified more than 7 days ago are marked stale. Overlaps with the schedule or with each other are shown as conflicts.
- The static site cannot read Outlook, email or any school account. A separate, authorized process prepares the file; the teacher imports it.

## Curriculum

Sources, in priority order: the current 31-meeting app route and its approved lessons, the 36-experience library with timed plans, the September 25 year blueprint (proposal), the September 29 NeuroArt and Canva decisions, the grade 5 KidWind plan, the Tinkercad Skate Park draft, and the CIRC K-6 Learning Continuum working draft (four strands, Four Cs, Ask, Plan, Build, Test, Improve). The original Playbook A and B documents are cloud-only Google Docs that were not readable from this build; they remain source material and are not published.

Capacity: 178 student days on a five-day cycle gives 35 or 36 visits per class. From September 28, 2026 cycle days 1 to 3 have 31 visits and days 4 and 5 have 30.

- Playbook A: meeting 1 NeuroArt (finished), meetings 2 and 3 Canva logos (template, then blank design), then the blueprint order with FLEX A, a December KidWind block for grade 5 while grade 6 runs CIRC Tank, the grade 5 innovation path, Hydroponics, six Tinkercad visits, FLEX B, reflect and reset, and a buffer used only by classes that get one more visit.
- Playbook B: a full 35-meeting year plus buffer. Shared meetings are new projects that practice the same skills. Grade-only blocks (grade 5 KidWind, grade 6 CIRC Tank) recur because each student meets them once. B carries more library and information literacy; A carries more 3D design. Across both years every student meets all four strands.
- Every meeting shows goal, strands, Four Cs, design stage, materials and setup, timed steps totaling 35 minutes, success check, what to turn in, cleanup, a short extension, an accessible or no-tech path, and grade 5 and grade 6 adaptations.
- Standards: the continuum is informed by PA STEELS. No formal alignment is claimed.
- Existing PDFs stay unchanged and are labeled as the earlier 31-meeting order. No Playbook B PDF exists or is advertised.

## Tests

Mode privacy (student graph, redirect before storage, link contents), A and B completeness and timing, dated-update validation, expiry, staleness, conflicts, no-school and transition states, plus the existing `npm test` and `npm run verify`.
