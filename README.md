# CIRC HQ | The Playbook

CIRC HQ is a calm, teacher-first workspace for running a CIRC day. It keeps the schedule, current class, schedule-aware class clock, step clock, recovery controls, and shared-project handoff in one place.

- Product: CIRC HQ | The Playbook
- Repository: `percycodesiOS/CIRC-HQ`
- Intended release URL: `https://percycodesios.github.io/CIRC-HQ/`
- Current content: one shared 36-experience Grades 5-6 yearly path

The separate Playbook A and Playbook B source documents remain source material. This release does not publish those raw documents or claim that any unreviewed chemical, heat, wiring, or restricted-tool activity is classroom-ready. It also makes no claim that kindergarten through fourth-grade content is complete.

The intended release URL is not called live until an authorized push, matching GitHub Pages deploy verification, an HTTP 200 response, and clean-browser acceptance all succeed for the same approved commit.

## First use

The normal first action is **Set up my schedule**. The ordinary schedule editor is the primary setup surface and does not require a plan file.

1. Enter the teacher name.
2. Enter the first and last school days.
3. Choose the cycle day for the first school day.
4. Open Day 1 through Day 5 and add classes, prep, lunch, support, and duties in the order they happen.
5. Save the schedule.

CIRC HQ puts each day's entries in time order. The schedule can be edited later from **Schedule**. A teacher can copy one cycle day to another and then adjust only what changed.

The welcome screen also offers two optional paths:

- **Sign in to sync** opens private account setup.
- **Preview a lesson** opens a working memory-only lesson. Nothing from Preview is saved or synced, and it has a direct exit.

## Five main destinations

- **Today** shows what is happening now, what comes next, the active duty warning, and the current lesson launcher.
- **Playbooks** opens the 36 reviewed experiences and their teacher plans.
- **Schedule** opens the ordinary five-day schedule editor.
- **Room** opens optional shared-room and classroom-resource tools.
- **Settings** contains private sync, calendar overrides, weather attribution, and advanced backup and restore.

The normal teaching path does not require Settings, a backup file, or Room.

## Ehrman Crest replica lessons

**Playbooks** and the **Tech Terrarium teacher detail** now show **Ehrman Crest replica lessons**. The same chooser appears on Today when Tech Terrarium is the current experience. These are optional lesson choices; the original Tech Terrarium curriculum and annual modes remain available.

- **Today / Day 3: Sort, Count, Plan** uses loose approved parts, sorting, checked counts, a proposed material use and a handoff for the next crew.
- **Next session: Aerial Layout & Dry Prototype** uses a confirmed top-view reference, observed versus proposed features and a removable dry layout. If the aerial reference is unavailable, site placement stays undecided while students check inventory and sketch features. Actual school dimensions and parent-drop-off direction are not supplied by the app.
- **Friday, September 11: Remember & Serve** combines calm Grades 5-6 historical context with a useful school-community service design. It includes optional sharing, a quiet alternative and teacher-selected media, with no graphic footage or attack reenactment.

Choose a lesson, confirm only if replacing a different saved runner, then choose **Start class**. Each plan has seven steps totaling 35 minutes. During a current scheduled class, the class clock uses the actual time remaining until that class ends. Without a current teaching event, it starts at 35:00. Step expiry waits for manual **Next Step**. **Student directions** shares the active timers and student steps while keeping teacher guidance, operating notes and private schedule information out.

Reopening the same choice preserves its step and timers, including a completed lesson. **Start this lesson for a new class** explicitly resets it after confirmation, ready at step 1. This action appears in the chooser and the teacher runner, including the completed view. Cancel preserves the current runner. The original shared-artifact handoff is not changed by these lessons. No-account use retains the existing in-memory Preview behavior; a configured local plan can save its runner without cloud sign-in.

All three lessons stay dry and preserve attached work for teacher handling. Epoxy remains required for the final build, with later teacher-managed product selection, compatibility checks, application and cure instructions. The app does not infer that supplies have arrived or approve permanent attachment. The three lesson labels are manual choices, not automatic school-rotation or calendar assignments.

The announcement preparation note keeps the crew arrival at 8:50 a.m., the broadcast at 8:55, and a three-minute target for the complete script. Day 4 is the point to prepare and finalize the following week's announcements; actual broadcast dates remain teacher-selected.

Friday's factual and care-based framing draws on the 9/11 Memorial & Museum's [Local Heroes](https://911memorial.org/learn/students-and-teachers/lesson-plans/lesson-plans/local-heroes), [Survivor Tree](https://www.911memorial.org/visit/memorial/survivor-tree), and [Talking to Children About Terrorism](https://www.911memorial.org/learn/youth-and-families/talking-children-about-terrorism) guidance. The replica and service-design activities are this project's Grades 5-6 adaptation. No external image or video is loaded automatically.

## Morning announcements

Open **Playbooks > Open announcement studio**, choose the broadcast date, then choose **Use ECMS outline**. An existing script is replaced only after confirmation; Cancel preserves its wording. The outline is editable and starts with preparation, rehearsal and teacher approval unchecked.

The two-announcer order is greeting/date/cycle day, first-name introductions, rise and at least 20 seconds of silence, a separate 5-second handoff pause before Announcer 1 leads the full Pledge of Allegiance, sit, required notices from Heather and Emily, lunch, an optional reminder, and closing. The 5-second cue appears once at that opening handoff and does not shorten the moment of silence. Replace the marked placeholders with broadcast-approved wording, confirm any absence of required notices with the office, and remove an unused optional reminder. Unresolved or partly edited double-bracket markers block teacher review and Go live. Changing the selected date updates the generated ECMS date cue; custom wording remains editable and must be fact-checked.

**Save local draft** saves only on the current device. The outline contains no actual student names or private notices. Go live displays the approved script, including speaker labels and pause cues, along with the date, section headings and an exit control. Teacher preparation and private schedule information stay out. A shared or mirrored screen shows that same view; CIRC HQ does not start the building's broadcast equipment.

The **Special events** section holds the confirmed lunch line and any approved special events in both the editor and broadcast view. Existing saved drafts remain compatible.

## Private sync and Room are optional

CIRC HQ remains usable locally without an account. Private sync is optional. It begins only after explicit Google sign-in, and an explicit cloud write is required before private schedule data is uploaded.

Each authenticated teacher has a UID-scoped private cloud namespace. Teachers sign in separately, and each teacher retains a separate private schedule and progress record. A failed or blocked sign-in does not erase the usable local schedule.

Room is optional. Shared room artifacts and room progress are available only to trusted members of the selected room. Joining or creating a room is not required to build a schedule, open Today, browse Playbooks, or run a class.

Board and Student remain account-free. They receive no direct cloud-write path and no private teacher identity, schedule metadata, setup controls, or shared-artifact history.

## Run a class

The runner lifecycle is deliberate:

1. **Open class runner** creates a Ready runner.
2. Ready clocks are stationary.
3. **Start class** is the only action that starts the clocks.
4. **Pause** stops an active runner.
5. **Resume** continues the same runner.
6. **Previous**, **+1 min**, and **Next Step** change only the active lesson state requested by the teacher.

Open class runner creates a Ready runner. Ready clocks are stationary. Start class is the only action that starts the clocks.

When a teaching event is current, the class clock uses the scheduled event end. Starting late therefore preserves the real time remaining. Without a current teaching event, the reviewed 35-minute lesson duration is used.

The command bar keeps the current step timer dominant and the total class timer visible. A step reaching zero does not advance automatically. The teacher chooses the next action.

The teacher view uses compact cues to keep current directions short and visible. Student directions remain separate from teacher action and teacher help. Longer objectives, materials, safety notes, and additional context stay under **More context**. The reviewed lesson structure also provides consistent early-finish guidance.

**Question Detour** holds the current work step while the real class clock continues. The teacher can return to the build, add discussion time, or choose **Safe Landing**. Safe Landing moves to the first cleanup step without changing the physical artifact.

## Current Playbook content

The live catalog contains one shared sequence of 36 reviewed Grades 5-6 experiences. The same experience can support fifth and sixth grade while the teacher adjusts delivery, pacing, and examples for the students in the room.

Each reviewed experience includes a 35-minute path with explicit student directions, teacher actions, timing, cleanup, and an exit check. Outdoor, water, cutting, electrical, and optional tool activities retain their specific safety steps.

The current catalog does not publish the separate raw Playbook A and Playbook B source documents. It also does not claim complete kindergarten through fourth-grade content.

## Shared Tech Terrarium authority

Playbook progress, physical-artifact progress, and the current class visit are separate records.

**Ready**, **Repeat**, and **Park** each require **Confirm** before a shared-artifact change is saved. Choosing an option without Confirm writes nothing. Cancel writes nothing. Timer expiry, Question Detour, Safe Landing, lesson completion, and project completion never advance the physical artifact automatically.

Ready, Repeat, and Park each require Confirm.

## Privacy and data boundaries

CIRC HQ has no grades, gradebook, student accounts, rosters, or performance records. It also has no student submissions, analytics, or advertising. Grades 5-6 identifies grade levels only.

Private schedules remain outside Git and the GitHub Pages artifact. The repository contains public client configuration for the separate configured Firebase project used by CIRC HQ. It is not an administrator credential. Configuration in Git is not proof that Google Auth is enabled, Firestore rules are deployed, the intended domain is authorized, private sync has succeeded, or the intended Pages release has been verified.

Offline, signed-out, popup-blocked, denied, partial, and conflict states preserve usable local teaching and safe recovery guidance. The live runner stays on the device that starts the class. It never becomes a shared cloud timer.

CyberGrader remains a separate product with separate data and security boundaries.

The old Mission Control repository and site remain separate, unchanged, and outside this release.

## Advanced backup and restore

Backup and restore remain available under the collapsed **Advanced backup** or **Advanced backup and restore** section. They are recovery tools, not normal setup.

A teacher can export a local safety copy before a major change. Restoring a CIRC backup requires a deliberate file choice and confirmation. Ordinary schedule creation and editing never require a file.

Browser origins remain separate. The intended hosted site, `http://127.0.0.1:4273/`, and `http://localhost:4273/` each keep their own local browser data.

## Local development

1. Open PowerShell in this repository.
2. Run:

```powershell
node scripts/dev-server.mjs
```

3. Open `http://127.0.0.1:4273/`.

The development server binds only to `127.0.0.1` and exposes the reviewed public runtime allowlist. It does not intentionally expose tests, internal documentation, Firebase rules, package metadata, the locked legacy classroom snapshot, or private schedule files.

## Verify a public candidate

```powershell
npm test
npm run verify
```

Verification checks the public candidate boundary, runtime imports, entrypoint identity, locked legacy and asset bytes, Firebase configuration locks, typography, credentials, local path disclosures, privacy sentinels, DOM sinks, server allowlist, JavaScript syntax, and the complete Node test suite.

## Publication status

Repository work, commit creation, push, GitHub Pages deployment, Firebase Console changes, private cloud writes, and live-site confirmation are separate actions. Local tests or a committed candidate do not make the intended URL live. This documentation change performs no deployment and uploads no private teacher data.
