# CIRC HQ | The K-6 Playbook

CIRC HQ is the calm teacher operating system for the CIRC room. It combines the current class, schedule-aware class clock, lesson runner, recovery tools, and shared-project handoff in one browser-local workspace.

- Product: CIRC HQ, The K-6 Playbook
- Repository: `percycodesiOS/CIRC-HQ`
- Intended release URL: `https://percycodesios.github.io/CIRC-HQ/`
- Current content: The current reviewed content is Grades 5-6, Playbook A only.

The K-6 Playbook is the product direction and catalog architecture. This release does not contain complete K-6 content. K-4 and Playbook B are not present.

The URL above is the intended release URL. It is not described as live until a separately authorized push, a matching GitHub Pages build, an HTTP 200 response, and clean-browser acceptance all succeed for the same approved commit.

## First use and the class runner

On a browser with no validated teacher plan, CIRC HQ opens the guided setup at **Get CIRC HQ ready**. Setup connects one private teacher account, loads that teacher's schedule, and joins one shared CIRC room. **Continue with Google** uses the Google popup flow when the release's Firebase Console and authorized-domain gates are complete. **Explore a temporary demo** is memory-only and says clearly that nothing in the demo is saved or synced.

Choose a private teacher-plan JSON file to preview it on this device. Selecting a file does not upload it. The teacher reviews the admitted summary and confirms it before the separate **Upload and verify** action can write cloud data. Setup Help provides safe status, **Sync now**, local-backup export, replacement-plan preview, sign-out, and recovery guidance without identifiers or raw error text.

The live path is deliberate:

1. **Open class runner** creates a Ready runner. Ready clocks are stationary.
2. **Start Class** is the only action that starts the clocks.
3. **Pause** stops an active class, and **Resume** continues an already active or paused class.

Open class runner creates a Ready runner, Ready clocks are stationary, and Start Class is the only action that starts the clocks.

When a teaching event is current, the class clock uses the scheduled event end, so starting late preserves the real time remaining. Without a current teaching event, the reviewed 35-minute plan is used.

The runner keeps the teacher view compact with short **Say**, **Do**, **Students**, **Done when**, **If stuck**, **Finished early**, and **Return to the build** cues. These compact cues keep the next action visible. Longer objective, materials, safety, and teacher context stay under **More context**.

**Question Detour** keeps the real class clock running while holding the current work step and using a separate three-minute discussion clock. The teacher can return to the build, add two minutes, or enter **Safe Landing**. Safe Landing moves to the first cleanup step without changing the physical artifact. The reviewed Core, Improve, Contribute, Explore, and Reset ladder provides consistent early-finish guidance.

Student directions and Board remain projection-safe. They do not receive teacher script, setup controls, private schedule labels, teacher identity, or shared-artifact history.

## Import each private schedule once

Teacher-plan files are local and private. Kenny and Tammy each import their own one-teacher private file into their own browser. Schedules remain outside Git and the Pages artifact. Do not commit, publicly share, or copy them into this repository.

For hosted static use:

1. Open Teacher Setup on the intended hosted site.
2. Choose that teacher's supported private plan file.
3. Review the local validation preview.
4. Confirm the preview, then choose **Upload and verify** only when the private and shared boundaries are correct.
5. Confirm the displayed Cycle Day before relying on the schedule.

The validated plan is stored only in that browser origin. Tammy's calendar reuse is an explicit same-district assumption, so the displayed Cycle Day must be checked after her import.

For local private-seed use, point the local server to private files that remain outside this repository:

```powershell
$env:PLAYBOOK_PRIVATE_PLAN = "<ABSOLUTE_PATH_TO_PRIVATE_PLAN>"
node scripts/dev-server.mjs
```

Then open `http://127.0.0.1:4273/`. The private seed route is local-only, read-only, and sent with no-store responses. A current v2 plan does not require migration options. The hosted site does not expose local private-seed routes.

Browser origins are isolated. The hosted site, `http://127.0.0.1:4273/`, and `http://localhost:4273/` each keep separate local data. Export a local backup before a major change.

## Shared Tech Terrarium authority

Each authenticated teacher has a UID-scoped private cloud namespace. Shared Tech Terrarium artifacts and room progress are available only to trusted members of the selected room. Room invitation redemption is one-time and transactional. Board and Student remain account-free and have no direct cloud-write path.

Playbook progress, artifact progress, and the current class visit are separate. **Ready**, **Repeat**, and **Park** each require **Confirm** before the artifact is saved. The first choice and Cancel write nothing. Timer expiry, Question Detour, Safe Landing, lesson completion, and project completion never advance the physical artifact automatically.

Ready, Repeat, and Park each require Confirm.

## Privacy, records, and service boundaries

CIRC HQ has no grades, gradebook, student accounts, rosters, or performance records. It also stores no aliases, scores, percentages, or individual student data. Grades 5-6 means grade levels only.

The repository contains the public client configuration for the separate configured Firebase project used by CIRC HQ. That configuration is only public client identification. It is not proof that Google Auth is enabled, Firestore exists in `nam5` production mode, rules are deployed, `percycodesios.github.io` is an authorized domain, Pages is live, or a private plan has been uploaded. Those remain Task 9 evidence gates.

Offline, signed-out, popup-blocked, denied, partial, and conflict states preserve usable local teaching and show safe recovery guidance. Local storage remains the offline cache and recovery layer. The live runner stays on the device that starts the class and displays **This device is running the class**; it never becomes a shared cloud timer.

CIRC HQ includes no grades, rosters, student accounts, student submissions, analytics, advertising, Firebase Hosting cutover, billing change, or CyberGrader reuse. CyberGrader remains a separate product with separate data and security boundaries.

## Known limits

- Cloud setup depends on the remaining Console, authorized-domain, rules, Pages, and live smoke-test gates.
- Kenny and Tammy authenticate separately and each retains a private UID-scoped plan and progress namespace.
- Local teaching remains usable when sign-in, network, rules, or cloud reads and writes fail.
- There is no student performance system.
- Current reviewed content is Grades 5-6, Playbook A only, not complete K-6 content.
- The old Mission Control repository and site remain separate, unchanged, and outside this release.

## Local development

1. Open PowerShell in this repository.
2. Run:

```powershell
node scripts/dev-server.mjs
```

3. Open `http://127.0.0.1:4273/`.

The server binds only to `127.0.0.1` and exposes the exact reviewed public runtime manifest, including the browser Firebase client and its reviewed cloud modules. It does not expose tests, docs, internal files, rules, package metadata, the locked legacy classroom file, or private source files.

The root `_config.yml` separately excludes nonruntime documentation, tests, scripts, Firebase metadata and rules, the locked legacy file, and inactive source modules from the GitHub Pages artifact. `_config.yml` and `.superpowers` are Jekyll-hidden. Publication remains fail-closed if a candidate is private, hidden, unsupported, or outside the reviewed manifest.

## Verify a public candidate

```powershell
npm test
npm run verify
```

The verifier runs 16 fail-closed gates. It checks the recursive Git candidate set, Jekyll publication boundary, runtime imports, entrypoint identity, locked legacy and asset bytes, the sanitized Firebase example and exact public Firebase config lock, typography, credentials, local path disclosures in every tracked text candidate, privacy sentinels, runtime policy, DOM sinks, server allowlist, JavaScript syntax, and the complete Node test suite. It prints gate names and counts without printing matched private content.

## Publication status

Repository creation, remote configuration, push, GitHub Pages activation, Firebase Console provider and rules work, and live-site confirmation are separate external actions. Local verification and a committed public config do not make the intended URL live or prove that cloud setup has succeeded. No private data is uploaded by this repository change.
