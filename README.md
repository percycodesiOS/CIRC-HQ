# CIRC HQ | The Playbook

CIRC HQ is the teacher operating shell for The Playbook. It keeps Today, Year Map, Schedule, Room, and Settings together in one calm local view. The former classroom application remains protected as an offline archive and is not part of the public CIRC HQ runtime.

## Option 2 experience year map

- Today combines the live teacher schedule, clock, weather, duty status, and the current classroom experience.
- Year Map contains 36 separate classroom experiences for grades 5 and 6. It is not one year-long project.
- Experience 1 introduces the teacher, CIRC routines, and the outdoor classroom. Experience 2 builds the shared Tech Terrarium from collection and washing through the whole-class layout. Experience 3 redesigns the outdoor classroom.
- The year map deliberately mixes cardboard fabrication, outdoor and environmental investigation, structures, circuits, physical computing, accessibility, systems, student choice, troubleshooting, and showcase work.
- Every experience includes the teacher script, teacher moves, student directions, materials, safety, cleanup, exit evidence, a fast-finish challenge, a stretch option, and a Pennsylvania STEELS crosswalk for the grade 3-5 and grade 6-8 bands.
- Student directions open in a separate Board-safe view. Teacher script, admin fields, private notes, schedule labels, teacher identity, and duty data are excluded.
- Download admin plan creates a printable local HTML lesson plan from the reviewed public experience record.
- The public shell defaults to Experience 2, Tech Terrarium, when no valid local progress record exists.
- Current experience progress is stored locally per teacher. Only the current experience can advance the year map, previews cannot change progress, and finishing Experience 36 leaves Demo Day available for review with the year map complete.

## Use CIRC HQ locally

1. Open PowerShell in this folder.
2. Run this command:

```powershell
node scripts/dev-server.mjs
```

3. Open `http://127.0.0.1:4173/` in a browser.

The local server exposes only the files needed by the public shell. It does not expose tests, internal reports, Git files, Firebase or sync code, legacy classroom archive, or private source files. It binds only to `127.0.0.1`, so it is for this PC, not other devices on the local network.

## Run a live experience

1. On Today, choose **Run today's experience**. The teacher runner opens the current experience with a full 35-minute class timer and a larger timer for the current numbered step.
2. Use **Pause** or **Resume** to stop or restart both clocks. Use **+1 minute** to add one minute to both clocks. **Previous** reloads the prior step, and **Next Step** moves to the next one.
3. When a step reaches `0:00`, it stays visible and waits for the teacher to choose **Next Step**. The class timer keeps counting during that wait.
4. Choose **Student directions** for the projection-safe display. It shows current student directions, any available local image, and both timers without teacher script, controls, schedule, or private data. Use **Exit student view** to return to Today.
5. On the final step, the action becomes **Finish Lesson**. Confirm the prompt only when ready. Confirmation completes the lesson and stops both timers at `0:00`; cancellation leaves the runner unchanged.

The runner reconciles elapsed wall-clock time after a delayed browser interval or a return from backgrounding. Runner state is local to the current browser and teacher context. It does not provide cross-device timer sharing.

## Import a private schedule one time

Keep the real schedule JSON outside this repository. Never copy it into a public GitHub folder or commit it. For a private v1 schedule, keep the matching migration options outside public source too.

In PowerShell, point the local server to those two private files before starting it:

```powershell
$env:PLAYBOOK_PRIVATE_PLAN = "C:\path\outside\this\repository\Playbook Schedule.json"
$env:PLAYBOOK_PRIVATE_OPTIONS = "C:\path\outside\this\repository\migration-options.json"
node scripts/dev-server.mjs
```

Then open `http://127.0.0.1:4173/`. CIRC HQ previews and validates the schedule before saving it in that browser's local storage. The private seed routes work only on the local server, allow only read requests, and use no-store responses. A current v2 plan does not need migration options.

You can also open Settings, choose a supported schedule JSON file, review the preview counts, and select Apply. Export a local backup from Settings before a major change.

Local storage is isolated by browser origin. `http://127.0.0.1:4173/`, `http://localhost:4173/`, and the hosted site each keep separate local data. Importing a schedule or progressing through the year map in one does not copy it to another.

## Use the hosted static app

The public CIRC HQ entrypoint is [https://percycodesios.github.io/5_MissionControl_6/](https://percycodesios.github.io/5_MissionControl_6/). GitHub Pages builds the `main` branch with Jekyll after an approved release push.

Hosted use is static and browser-local. On each browser or device, open Settings, choose a supported v2 teacher-plan JSON file, review the preview, and select Apply. The file is read in that browser and the validated plan remains in that origin's local storage. Export a local backup before major changes.

The localhost private-seed routes are not available on the hosted site. A v1 plan needs private migration options, so use the local server for that migration before using the hosted v2 workflow.

The root `_config.yml` excludes legacy, test, internal, Firebase, build, design, package, and inactive-code paths from the GitHub Pages artifact while preserving the reviewed public runtime files. Those excluded files remain preserved in Git. This Pages boundary is separate from the local server allowlist.

## Privacy and account boundaries

- Board is display only. It has no student accounts, aliases, class codes, rosters, or student write path.
- Board receives only teacher-reviewed class and lesson fields. Teacher identity, private notes, preferences, duty details, and unreviewed schedule content stay out.
- Resource links pass one shared fail-closed schema and URL check before local storage, import, export, sync, Firebase, or Room can retain them.
- Shared teacher sync and cross-device experience progress are not activated. They still need a separately approved trust, membership, conflict-resolution, and data-ownership decision before any account or teacher data is connected.
- The dormant sync merge now preserves experience progress separately for each teacher, chooses the newer teacher record, and reports equal-time conflicts. This is verification of the inactive code path, not permission to connect it.
- A separate CIRC HQ Firebase project remains uncreated, unconfigured, unconnected, and separately gated. Creating an account, enabling providers, uploading teacher data, deploying rules or Firebase Hosting, and changing billing each require separate approval.
- CyberGrader is not reused. It has different student data, account, runtime, and security boundaries. Reusing it would mix systems that must remain separate.

## Proposed hosted teacher model, not active

- CIRC HQ would use a separate Firebase project and verified email-and-password teacher accounts. A school email can be used as the account address without connecting CIRC HQ to Outlook or Microsoft 365.
- Teacher access would be invite or administrator approved. There would be no student accounts in this release.
- Create class would copy the approved 36-experience template into a private teacher-owned class. Each teacher could edit that copy without changing the master or another teacher's copy.
- Candidate lesson plans would enter a review queue as replacement candidates, alternate experiences, extensions, or resources. They would never overwrite a live class automatically.
- Before activation, local state must be bound to the signed-in teacher, account switching must quarantine the prior teacher's local state, Firestore rules must be deployable, and emulator tests must cover two approved teachers, an unrelated user, and a signed-out user.
- Board and student directions need a teacher-authenticated exit before the hosted app is used on an interactive student-controlled device.

## Preserved classroom archive

The locked legacy classroom file remains in the repository as an offline reference with its exact bytes protected by a release hash. It is not served by the local server or the GitHub Pages artifact, and it is not linked by CIRC HQ because it contains the earlier local roster, student sign-in, record, and export features. Any future reuse requires a separate privacy and teacher-authorization review.

## Verify a public handoff

```powershell
npm test
npm run verify
```

The verifier checks the recursive Git candidate set, Jekyll Pages publication boundary, public entrypoints, locked legacy hash, Firebase placeholders, typography, credential and privacy sentinels, runtime policy, DOM sinks, server allowlist, JavaScript syntax, and the Node test suite. It prints only gate names and counts, never matched content.

## Publication status

GitHub Pages publication is a separate final gate. It requires an explicit publication decision after the public handoff is reviewed. Before release, `npm test` and `npm run verify` must both pass. After the approved push, verify the managed Pages workflow succeeds for the same commit and open the hosted root URL in a clean browser profile before relying on it. Firebase remains inactive and is not part of that Pages release.
