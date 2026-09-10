# CIRC HQ - BUILDLOG

## 2026-09-09 separate resin unit and corrected program scale

- Separated the resin chooser from the Tech Terrarium school-model lessons while preserving saved mode IDs, timers and reset behavior.
- Defined the model layout as the front school aerial view and the rear rocks, lizard habitat and technology. Removed the incorrect requirement to use epoxy in the school model.
- Corrected the resin plan to all 670 students over five cycle days, with reusable class stations and a separate adult casting/cure schedule. The purchasing assumption is one small individual game or art piece per student, subject to actual mold-volume checks.
- Retained private teacher guidance, dry student directions and existing announcement scripts. No school account, device enrollment, student-data upload or purchase is part of this release.

## 2026-09-09 cardboard build and resin design lessons

- Added two manual lesson choices alongside the existing three replica paths: **Day 4: Build the Cardboard School** and **Resin unit: Design and Measure a Feature**. Both have seven steps totaling 35 minutes, cleanup, a concrete output and a next-crew handoff.
- The cardboard lesson begins work with available materials. Students measure, dry-fit and use tape or tabs while the teacher manages knife cuts and the hot-glue station. The complete fallback needs no powered tool. New modules remain removable from the shared base, and site placement waits for a checked reference.
- The resin lesson works before purchases arrive: mold-volume estimates, a clearly labeled paper ratio example, material comparison and a proposed feature. Students stay with dry materials. Product-specific adult setup, application, optional heat-gun use and curing remain separate; a classroom timer never certifies cure.
- Preserved original modes, manual timer transitions, explicit new-class resets, local data, private teacher directions and the already prepared crew check-in changes. No actual student names, emailed announcements, school schedule changes, cloud writes or student-game uploads were added.
- Extended the runner and app projection tests to both new paths. Release review records complete test and publication results separately.

## 2026-09-09 prepared first-week announcement scripts

- Added explicit Load buttons for the prepared September 9, 10 and 11 broadcasts. Complete public school notices and lunch lines are available on the school computer from the app; approved first names remain local placeholders.
- Reused the current local draft schema and existing replacement confirmation. Loading sets the selected prepared date and resets preparation, rehearsal, teacher approval and crew checks without writing storage or changing archived dates. Save local draft remains explicit.
- Friday's missing approved September 11 message blocks approval and Go live. Its teacher-only preparation instruction is rendered only in the editor, never inside the broadcast script.
- Verified replacement cancellation, archive preservation, date-specific menu and notice content, fresh crew checks, full Pledge and pause sequence, and teacher-note exclusion from an approved Friday broadcast. No personal student details, student-game files or private schedule fields are bundled.

## 2026-09-08 dated local announcement library

- **Save local draft** now saves the working draft and a dated copy for the selected valid broadcast date. **Saved broadcast dates** provides an explicit Load action for each local copy, making Day 4 preparation of the following week possible without overwriting the other days.
- Kept the legacy working-draft key and date-editing behavior. Load is read-only and confirms before replacing unsaved changes; Cancel preserves the current draft. Starting a blank draft removes only the working key. Existing saved checks and review are retained on Load, while real script or timing edits still invalidate approval.
- Added one strictly validated, versioned browser-storage archive. Explicit saves re-read existing dates and preserve a valid legacy working date if needed. Malformed archives are left untouched; capacity refusal does not evict old dates; a failed working-key write attempts to restore the prior archive and reports any partial-save limit truthfully.
- Made the current-browser/device boundary visible beside the saved list and in save feedback. No cloud sync, account, private schedule, rotation automation or broadcast-projection changes were added.
- Model, UI and app-render coverage passes 105 of 105 tests, including five dates across reload, read-only Load, dirty-load cancel/accept, unchanged date editing, same-date updates, legacy preservation, blank-current retention, malformed records, storage failure rollback, capacity refusal and unrelated-key preservation. Independent browser and release verification are recorded separately by the release reviewer.

## 2026-09-08 optional Ehrman Crest replica lessons

- Added three explicit Tech Terrarium lesson choices: Sort, Count, Plan; Aerial Layout & Dry Prototype; and September 11 Remember & Serve. Each uses seven steps totaling 35 minutes, separate student/teacher directions, cleanup and an exit handoff. The original catalog, annual modes and other 35 experiences remain intact.
- Reused the existing mode snapshot and timer schemas. The chooser is directly available on Playbooks, Tech Terrarium teacher detail, and Today when Tech Terrarium is current. A different saved runner requires replacement confirmation; same-choice reopening preserves it. A separate confirmed new-class action resets a completed or active lesson to Ready at step 1.
- Kept stationary Ready clocks, explicit Start class, both class and step timers, manual Next, Pause/Resume, and the existing scheduled-class end. A late scheduled launch uses remaining class time; a launch without a current teaching event receives 35:00.
- Gave replica runners their own context and removed the unrelated original terrarium artwork and artifact controls from these runner views. Student views show only the selected title, active student directions, timers and step sequence. No account, cloud, private schedule, source-image or shared-artifact changes were introduced.
- Dry sessions use approved loose parts and preserve teacher-managed attached material. The unverified aerial layout stays open; epoxy remains required for later teacher-managed attachment with the exact product instructions. Friday uses basic age-appropriate history and useful service design, without reenactment or graphic media.
- Added teacher operating notes for 8:50 arrival, 8:55 announcements, the three-minute full-script target, and Day 4 preparation/finalization of the following week. No automatic school rotation or date changes.
- Initial targeted tests failed on the three missing feature boundaries. Focused model, runner and app coverage now passes 123 of 123 checks, including all 21 student step projections, no-account Preview, all three complete-to-new-class resets, running/paused cancellation, same-choice preservation, and a late launch with 25 minutes remaining. Full release verification is recorded by the independent release reviewer.

## 2026-09-08 ECMS announcement outline

- Added **Use ECMS outline** to the existing local announcement studio with the approved two-announcer wording: selected date and cycle day, first-name placeholders, rise and at least 20 seconds of silence, a separate 5-second opening handoff pause before Announcer 1 leads the full US Pledge, sit, required Heather and Emily notices, lunch, optional reminder, and closing. The 5-second cue appears once and leaves the 20-second silence intact.
- Existing wording requires explicit replacement confirmation. Cancel preserves the current draft and saved value. Applying the outline resets preparation, rehearsal and teacher approval; saving remains a separate local action.
- Unresolved, partial and multiline double-bracket markers block teacher review and broadcast view. Changing or clearing the selected date updates the recognizable generated date cue without rewriting the other script sections.
- Kept the existing local-only draft schema, storage key, editable sections and approved-script projection boundary. No actual student names, private notices, schedules or roster files were added.
- Clarified that Go live shows speaker labels and pause cues with the approved script. Mirroring or sharing shows the same visible view; CIRC HQ does not start building broadcast equipment.
- Set the visible editor and broadcast section label to **Special events**, with confirmed lunch information and approved-event help. The existing internal storage field remains compatible with saved drafts.
- Focused model, UI and app-render coverage verifies the exact outline sequence, complete Pledge, date changes, draft preservation, placeholder gates, approval invalidation and absence of implicit schedule/storage writes. Release verification and deployment are recorded separately by the release owner.

## 2026-09-02 active lesson focus runner

- Rebuilt the active teacher runner around one sticky command bar that keeps the current step, dominant step timer, class timer, Pause or Resume, +1 min, Previous, and Next Step visible while the lesson scrolls.
- Added a complete visual lesson path with one meaning-based reviewed Phosphor icon per step, every duration, and Done, Now, Ended here, or Next state. Seven-step, eight-step, and nine-step experiences now use their actual path length, and the path becomes a compact horizontal sequence on tablets and phones. The semantic resolver covers all 42 selectable paths, 340 step instances, and 231 unique step labels without sending any current label to the neutral fallback.
- Student directions now render in full and appear before teacher cues. One honest Teacher action card appears only when guidance exists. The runner does not infer speech, invent a fallback, or render an empty action card. Secondary teacher help and full lesson context stay collapsed until requested.
- The current-step card uses the reviewed real project image and a two-column desktop layout that becomes one clean column on tablets and phones. Directions remain before optional artwork at every responsive width.
- Active teacher and student runners use the focused shell, so the ordinary sticky site header cannot collide with the live timer dock.
- Student view carries the same active step, timer values, full sequence, directions, and safe exit while excluding teacher cues and teacher controls.
- A class clock that ends early now retains the actual stopped step instead of falsely presenting the final lesson step. Student entry resets scroll to the top, and no-control timer bars use an accurate accessible label.
- Strict TDD began with 5 focused failures for the missing command bar, sequence rail, complete directions, student parity, and sticky CSS contract. Review-driven RED tests then covered early class completion, responsive ordering, dynamic path lengths, accessible labels, honest teacher cues, semantic icon precedence, complete curriculum icon coverage, and the narrow-phone schedule. The focused app-render, public-shell, and security matrix finishes at 109 of 109 passing tests.
- Browser acceptance covered 1487 by 1058, 1440 by 900, 768 by 1024, 390 by 844, and 360 by 800. The bar remained eight pixels from the top, both timers froze during Pause, Resume and +1 min worked, Next Step advanced correctly, phone controls remained in one row with 48-pixel targets, phone schedule times did not wrap, student privacy held, and measured horizontal overflow remained zero.
- The approved hybrid reference and implementation were compared at the same exact 1487 by 1058 viewport in `reference-vs-prototype-1487x1058-normalized-final.png`. The final report is in `design-qa.md`, and all visual evidence remains outside the public repository.
- Full `npm test` passes 454 of 456 tests with 2 expected environment-dependent skips and 0 failures. `npm run verify` passes all 16 fail-closed release gates. The optional local Firestore rules emulator remains unavailable because Java is not installed, and no Firebase configuration or rules changed in this user-interface release.

## 2026-09-01 transient room invitation handoff fix

- Final first-use review found that room creation advanced and rerendered the setup walkthrough before the UI could place the returned one-time invitation code into the old status node. The room existed, but the owner could lose the only raw code needed by the second teacher.
- A focused RED reproduced the boundary in both the cloud runtime and rendered upload step. The runtime now retains the generated code only in memory, exposes it on the next setup step, and clears it with the rest of the in-memory cloud session. It is never written to browser storage, teacher documents, room documents, logs, or the repository.
- The upload step now gives the owner one clear instruction to copy the code before continuing, refreshing, or signing out. The code uses a bounded, wrapping presentation that remains readable on the mobile setup layout.
- Independent review found and blocked two weak acceptance checks before release. The final boundary now admits only an owner result with the exact production invitation grammar, rejects missing, empty, malformed, oversized, and non-owner results before local room state changes, inspects real storage entries instead of vacuous `Map` serialization, and proves clearance through disconnect, sign-out, identity replacement, and destroy.
- Focused cloud-runtime and setup-UI verification passes 48 of 48 tests. Full `npm test` passes 445 of 447 tests with 2 intentional private-environment skips and 0 failures. `npm run verify` passes all 16 release gates, and the Firestore emulator passes all 22 rules tests.
- Local visual acceptance at 1440 by 900 and true CDP-emulated 390 by 844 shows the transient invitation card clearly, with no clipped controls, no horizontal overflow, and no browser exceptions. Live deployment and exact-byte verification remain required after commit and push.

## 2026-09-01 GitHub Pages Firebase config publication hotfix

- The first exact-SHA Pages deployment succeeded, but the live byte gate found `firebase-config.js` missing while the other 53 reviewed public files matched their committed Git blobs and all 15 excluded paths returned 404.
- Root cause was Jekyll 3 path-prefix exclusion behavior: the intended `firebase` directory exclusion also matched the root `firebase-config.js` name. The public verifier did not model that implicit prefix collision.
- `_config.yml` now force-includes only `firebase-config.js` before applying exclusions. The verifier parses both exact include and exclude lists, models Jekyll include precedence, and fails closed if the required root config include is missing or changed.
- A focused RED first proved the publication contract was absent. The corrected focused public-boundary suite passes 52 of 52 tests. This entry records the pre-push hotfix and does not claim that the corrected Pages deployment or Firebase Console activation has completed.

## 2026-09-01 Task 8 reviewed cloud-boundary activation

- Activated the reviewed public runtime boundary from Task 7 base `c2d3853`, including the exact six-field root Firebase web configuration and the actual static import closure. The closure includes `src/model/setup-flow.js` because `src/runtime/cloud-runtime.js` reaches it; all server, verifier, and Jekyll manifests agree on the resulting 54 public runtime paths.
- Added a fail-closed normalized configuration lock and a path-scoped credential-scan exception. The real config matches the approved lock and exact shape without recording or repeating its raw API key; `firebase-config.example.js` remains the unchanged sanitized placeholder and is not public.
- Focused Task 8 tests passed 52/52. Full `npm test` passed 441 of 443 tests with 2 intentional private-environment skips and 0 failures. `npm run verify` passed all 16 public gates, including candidate, Pages, runtime-import, config, credential, local-path, privacy, runtime-policy, server-allowlist, syntax, and Node-test boundaries.
- Release copy now describes a configured but not externally activated Firebase boundary, local-first setup, explicit upload and read-back verification, trusted-room limits, offline recovery, and excluded student, roster, grade, analytics, advertising, Hosting, billing, and private-plan data. No Firebase Console change, rules deployment, browser action, live release, integration, push, or private-data upload occurred.
- The Task 8 commit SHA is recorded in the ignored task report after commit creation; this entry records the verified pre-commit activation boundary and does not claim a live release.

## 2026-08-31 final recovery and event-identity hardening

- Closed the final release blockers with strict TDD. The focused RED run reported 173 tests: 156 passed, 16 failed, and 1 intentional private-package skip. The same focused matrix is GREEN at 173 tests: 172 passed, 0 failed, and 1 skip.
- Invalid primary state with no valid local backup now enters an explicit unrecoverable lock. Load remains read-only, preserves both raw values, and every ordinary save, import, backup, and export path fails closed without a write. The app cannot present this state as fresh setup.
- Recovery now has one visible, accessible two-step path: choose a full-state backup, Preview restore, then explicitly Restore backup. Preview performs complete closed state admission without mutation. Only a confirmed valid restore writes a valid backup and primary copy.
- Teacher-plan events, state special events, artifact visit references, backup restore, and dormant sync admission now require exactly `event-h` plus 32 lowercase hexadecimal characters. New IDs use 128 bits from Web Crypto, and v1 preview and Apply retain one generated candidate rather than deriving an ID from schedule text.
- The outside-Git private builder now uses `randomBytes(16)`. It reuses an existing strict ID only for an unchanged structural event and generates a new random ID for a changed or new event. Two consecutive builds were byte-stable, while a non-persisted changed-event probe rotated only that event ID.
- Both private plans retain one teacher, five cycle days, and exactly 60 or 51 events. Direct validation and Settings preview passed with zero mutation. All 111 prior IDs changed to strict unique opaque IDs. The complete schedule, calendar, and display projection remained identical after excluding IDs and the one expected stripped legacy field.
- The public `local-path-scan` now rejects generic absolute drive paths, project-drive paths, UNC and extended-length paths, file URIs, and HOMEDRIVE or HOMEPATH forms in addition to the earlier home-directory patterns. The current tree and temporary-repository adversarial matrix pass.
- Dormant sync and Firebase state admission now use the same complete closed local-state canonicalizer while Firebase remains inactive. Disabled actions now have visibly muted styling, opaque contrast, and a non-pointer cursor.
- Full `npm test` ran 350 tests: 349 passed, 0 failed, and 1 intentional private-package skip.
- Final `npm run verify` passed all 16 public gates, including the distinct local-path scan, unchanged candidate and Pages boundaries, Firebase placeholders, runtime policy, JavaScript syntax, and all 27 reviewed Node test files.

## 2026-08-31 release review fix wave

- Closed all six release-review findings in one coordinated change: backup recovery, configured lesson preview, one artifact handoff per scheduled visit, closed plan and local-state admission with shared event IDs, public local-path disclosure prevention, and an accessible Teacher Setup file chooser.
- Strict TDD captured separate RED evidence before production edits. The six focused groups initially reported recovery 0 of 4, configured preview 0 of 1, visit handoff 0 of 2, schema admission 0 of 5, local-path gate 0 of 1, and chooser accessibility 0 of 1. Focused GREEN then ran 184 tests: 183 passed, 0 failed, and 1 intentional private-package skip.
- `LocalStore.load()` now reads the new backup key only after an existing new primary key fails admission, returns an explicit recovered status without writing, preserves both raw values, and keeps recovered state intact through export and later saves. The app renders a visible recovery notice.
- Configured teachers now have separate `Preview lesson` and `Open class runner` actions. Preview uses only an in-memory read-only runner, stays visibly marked, and exits back to live Today without a reload or a save.
- Shared-artifact visits bind one confirmed handoff to one machine event ID and local visit date. Duplicate or detached confirmations remain inert, reload preserves the boundary, and the same recurring event ID is eligible on a later date.
- One shared lowercase event-ID grammar and closed reconstruction now cover teacher plans, local state, resources, runners, progress, and artifacts. Unknown fields are dropped where legacy state compatibility is safe, forbidden individual-record families fail closed, and exact legacy v1 metadata is accepted for migration but not retained.
- Public design provenance no longer contains local user or tool paths. The distinct `local-path-scan` checks every tracked text candidate, including Jekyll-excluded documentation, while binary candidates remain outside text scanning.
- Full `npm test` ran 337 tests: 336 passed, 0 failed, and 1 intentional private-package skip.
- Final committed-tree `npm run verify` passed all 16 gates: candidate boundary 87, Pages boundary 87, runtime import boundary 21, entrypoint identity 2, legacy lock 1, asset lock 3, Firebase placeholders 1, typography 84, credentials 84, local paths 84, privacy sentinel 96605, runtime policy 45, DOM sinks 25, server allowlist 45, JavaScript syntax 54, and Node tests 26.
- Both outside-Git one-teacher packages passed the current direct validator and Settings preview with zero mutation, 5 cycle days, valid shared event IDs, and unchanged hashes. Their event counts remained 60 and 51. No schedule labels were printed or copied into Git.
- No remote, push, publication, Pages, Firebase, account, private-package, old-repository, Drive, Command Center, or private-output change occurred in this fix wave.

## 2026-08-31 Task 7 staged release preparation

- Prepared the release documentation from reviewed Task 4 HEAD `9ded2d1c19ca5419359307844bab0e36bfef621e` on branch `circ-hq-v1`.
- Replaced the stale former-site instructions with the CIRC HQ identity, intended `percycodesiOS/CIRC-HQ` repository and Pages URL, current Grades 5-6 Playbook A scope, first-use and runner lifecycle, private local schedule import, designated room-browser artifact authority, and explicit Firebase-inactive boundary.
- Documentation TDD RED ran 41 focused tests: 36 passed and 5 failed against the stale release documentation. Focused GREEN ran 41 of 41 with zero failures.
- Full local `npm test` ran 320 tests: 319 passed, 0 failed, and 1 intentional private-fixture skip.
- `npm run verify` passed all 15 gates: candidate boundary 86, Pages boundary 86, runtime import boundary 20, entrypoint identity 2, legacy lock 1, asset lock 3, Firebase placeholders 1, typography 83, credentials 83, privacy sentinel 89959, runtime policy 44, DOM sinks 24, server allowlist 44, JavaScript syntax 53, and Node tests 26.
- Task 4's final re-review approved its reviewed HEAD with 0 Critical, 0 Important, and 0 Minor findings. The broad review from the release base through the final release SHA remains a separate later release step and is not claimed here.
- `_config.yml` remained unchanged. Its Jekyll exclusions cover every reviewed nonruntime document, test, script, Firebase file, locked legacy file, and inactive source module. New security fixtures prove private, internal, test-result, private-segment, and unreviewed output candidates fail closed.
- Repository creation, remote configuration, authentication, push, GitHub Pages activation, live-site confirmation, Firebase activation, private-plan changes, and output release notes remain separate actions. None occurred in this preparation step.
- The exact Task 7 commit SHA is recorded after Git creates the commit; a commit cannot truthfully embed its own final SHA.

## 2026-08-30 live runner and Pages hardening checkpoint

- The live teacher runner now launches from Today and keeps a full class timer plus a larger current-step timer visible. Pause or Resume, +1 minute, Previous, and Next Step are available during ordinary steps.
- A step that reaches `0:00` remains on screen until the teacher moves forward, while the class timer continues. Route changes and delayed browser intervals reconcile elapsed wall-clock time without writing a local checkpoint every second.
- Student directions keep only current student directions, an available local image, and the two timers. Teacher script, runner controls, schedule, and private content stay out. Exit student view returns safely to Today.
- The final step uses Finish Lesson instead of ordinary Next Step. The UI asks for explicit confirmation before the unchanged runner model completes. Cancellation changes nothing. Completion shows Lesson complete, two stopped `0:00` timers, and Back to Today with no inactive runner controls.
- The final ownership contract separates no-plan state under `local:default` from every real teacher under `teacher:` plus the complete original teacher ID. Previously valid schedule IDs remain compatible, raw progress migrates only when ownership is unambiguous, and a future-dated runner is ignored until Run replaces it safely.
- Fresh final-candidate `npm test` verification reported 260 pass, 0 fail, and 1 expected private-environment skip across 261 tests.
- Fresh final-candidate `npm run verify` passed all 15 public-release gates, including the candidate, Pages, runtime-import, entrypoint, legacy, asset, privacy, credential, DOM-sink, local-server, JavaScript, and Node-test boundaries.
- Browser acceptance covered 1440 by 900, 390 by 844, and 360 by 800 with no horizontal overflow or console errors. Teacher controls remained at least 48 pixels high on the phone layouts, and the isolated student view kept only approved classroom content and a safe exit.
- No commit, push, Pages publication, deployment, Firebase configuration, account creation, billing change, or private-data upload occurred in this checkpoint.

## 2026-08-29 Option 2 CIRC HQ experience year map

Option 2 rebuilt the current CIRC HQ Today experience around the selected bright maker-studio direction while keeping the existing live teacher schedule and privacy boundaries.

- Today now combines the live schedule, clock, weather, duty state, Tech Terrarium experience hero, teacher script, isolated student directions, independence path, 36-experience year map, and fast finish.
- Year Map now exposes 36 separate experiences for grades 5 and 6. The revised mix adds cardboard fabrication, outdoor and environmental work, circuits, physical computing, accessibility, student choice, troubleshooting, and showcase experiences.
- Experience 1 is the teacher introduction, CIRC routines, and outdoor classroom tour. Experience 2 is the actual shared Tech Terrarium build. Experience 3 is the outdoor classroom redesign.
- Per-teacher local progress advances only from the current experience. Past and future previews cannot change progress, and Experience 36 settles into one complete reviewable state.
- Download admin plan creates a local printable HTML plan from approved catalog fields only.
- Two optimized local WebP images and the reviewed local Phosphor icon set replace placeholders and remote asset dependencies.
- The public server and verifier use exact path allowlists and exact image hashes. Unreviewed files and changed image bytes fail closed.
- The selected visual source and final implementation were compared together at the same visible browser frame. The final report is in `design-qa.md`.

TDD and browser findings:

- Project-home RED: the module was missing and the old Curriculum navigation label failed the new shell contract.
- Project-home GREEN: the project launcher, five-stage independence path, and complete 36-project trail passed.
- App-render RED: Option 2 project UI and teacher or student routes were missing.
- App-render GREEN: Today, Projects, teacher detail, and isolated student directions passed.
- Progress RED: current-project completion, final completion, and cross-device merge behavior were missing or ambiguous.
- Progress GREEN: current-only advancement, per-teacher persistence, final completion, and per-teacher timestamp or conflict merge behavior passed without activating Firebase.
- Server and verifier RED: new reviewed modules and image assets were rejected until exact allowlist, MIME, binary, and hash-lock contracts existed.
- Server and verifier GREEN: both images, all icons, all new modules, and every fail-closed boundary passed.
- Browser P1 mobile finding: stacked status cards hid the main action below the first phone viewport. The compact glance row fixed it.
- Browser P1 desktop finding: the largest title size extended outside the copy panel. The maximum display size was reduced and passed a measured boundary check.
- Browser P2 mobile finding: `Day complete` could split inside a word. Mobile heading wrapping now preserves whole words.
- Browser P1 mobile title finding: `Terrarium` was clipped at the 390 and 360 pixel widths. The final display size now keeps the full word visible on one line with no horizontal overflow.

Final verified commands and counts on 2026-08-29:

- `npm test`: all runnable tests passed with one expected private-environment skip.
- `npm run verify`: every public-release gate passed, including candidate boundary, entrypoint identity, locked assets, Firebase placeholders, typography, credentials, privacy sentinels, runtime policy, DOM sinks, server allowlist, JavaScript syntax, and Node tests.
- Browser acceptance covered 1440 by 900, 390 by 844, and 360 by 800. The main action was visible in the first phone viewport, horizontal overflow stayed absent, all 36 project choices rendered, teacher and student flows stayed separated, and the console had zero warnings or errors.
- At 1440 by 900, the title right edge measured 691 pixels and the copy panel right edge measured 811 pixels.
- At 390 by 844, the main action top measured 566 pixels. At 360 by 800, it measured 589 pixels. The full `Tech Terrarium` title remained inside the card at both widths.

No push, publication, deployment, Firebase configuration, account creation, billing change, or private-data upload occurred in the Option 2 build.

## 2026-08-28 Task 6 public release verification

Task 6 started from exact clean commit `c96d53a553bd537f0d7954243c3c6769f9d9856d`.

- TDD first exposed two residual privacy defects: the broad classroom projection retained private state, and resource records had no single fail-closed admission boundary.
- The classroom projection now delegates to the reviewed Board projection. It can return only reviewed class and lesson fields plus a generated countdown.
- One shared resource schema and URL admission function now protects teacher-plan validation and import, local load and save, backup and export, sync merge, Firebase load and write patches, and Room presentation.
- The public verifier scans the recursive `git ls-files -co --exclude-standard` candidate set, accepts only the two intended Task 6 development files while untracked, suppresses matched content and child output, and reports one gate name and count per line.
- README now explains local teacher use, one-time private import, private GitHub boundaries, Firebase and CyberGrader separation, blocked shared sync, account-free Board behavior, the locked classroom route, and the separate publication gate.

TDD counts:

- Focused residual RED: 2 tests, 0 pass, 2 fail, 0 skip.
- Focused residual GREEN: 2 tests, 2 pass, 0 fail, 0 skip.
- Admission integration RED: 8 tests, 3 pass, 5 fail, 0 skip.
- Admission integration GREEN: 8 tests, 8 pass, 0 fail, 0 skip.
- Wider verifier RED: 14 tests, 12 pass, 2 fail, 0 skip.
- Wider verifier GREEN: 14 tests, 14 pass, 0 fail, 0 skip.
- Final SEC matrix RED: 19 tests, 18 pass, 1 fail, 0 skip.
- Final SEC matrix GREEN: 19 tests, 19 pass, 0 fail, 0 skip.

Verified commands and counts on 2026-08-28:

- `npm test`: 142 tests, 141 pass, 0 fail, 1 expected private-environment skip.
- `npm run verify`: 12 of 12 gates passed. Counts were candidate 48, entrypoints 2, legacy 1, Firebase placeholder 1, typography 48, credentials 48, privacy tokens 33374, public runtime 20, DOM sinks 17, server allowlist 19, JavaScript syntax 39, and test files 19.
- Direct private acceptance with `PLAYBOOK_PRIVATE_PLAN` and `PLAYBOOK_PRIVATE_OPTIONS` set, then `node --test tests/teacher-plan-v1.test.mjs`: 10 tests, 10 pass, 0 fail, 0 skip. Input 60, output 60, cycle days 5, duties 10, confirmations 4, error codes 0, and source SHA256 `BD7D359590414E2FA6F1891403B71BC5772F8FE452EBD35566B55D00D6E871BD`.
- Browser acceptance: 10 sanitized cases across 1440x900, 390x844, and 360x800. Board isolation and restore, restart recovery, Room admission, Easy first viewport, live boundary clock advancement, no horizontal overflow, 44px controls, and zero console errors all passed using generic synthetic data.
- Locked classroom SHA256 remained `5DF75CEA0693920856A95949F6EFBBE54961EAA77117637EA433D786AF5205E3`.

No push, publication, deployment, Firebase configuration, account creation, billing change, or private-data upload occurred in Task 6. GitHub Pages publication remains a separate approval and release gate.

## Historical classroom build log

The entries below preserve the earlier single-file classroom application's history. They do not replace the current CIRC HQ Task 6 specification or release gates.

Single file classroom app for a K-6 CIRC teacher at Ehrman Crest (ECMS).
Repo: percycodesiOS/5_MissionControl_6. Source of truth is mission-control.html.
index.html must stay byte identical to mission-control.html.

## Hard constraints (every step)
- One single HTML file, inline CSS and JS, no new dependencies, no build step, works offline from a saved copy.
- Black background, neon cyan #00E5FF, blue #3E6BFF, violet #C44DFF. Chakra Petch for display headers, Lexend for body.
- Title stays MISSION CONTROL, ECMS, EMBRACE THE CHALLENGE.
- Preserve every existing feature exactly: phase countdown timers (Space pauses and resumes, N skips), 4 letter class join codes, tap your name rosters, the student home screen, Broadcast mode, the optional team showcase, Loadout, Team Check-In, all state in localStorage on one device.
- Never use em dashes or en dashes anywhere, including code comments and UI text.
- One numbered step per session. Never push to GitHub unless Kenny's message contains the literal word push.

## Steps
1. [DONE 2026-07-17] Grade band modes set per class and persisted per class: K-1 Cadet, 2-3 Pilot, 4-6 Commander, with the class picker loading a class's mode, roster, and lesson state instantly. NOTE: step 1's independent mode storage was superseded by step 1B below (grade is now the single source of truth).
1B. [DONE 2026-07-17] Architecture correction: unify step 1's banding with the existing K-6 content system. Class stores GRADE (K-6); flight mode and content tier both derive from grade; active class auto filters the library to its tier; Cadet absorbs the existing K-2 littles display (one system). See Step 1B detail below.
1C. [DONE 2026-07-25] Teacher calm-start pass: add one unmistakable Run Today's Mission panel that selects the active class's saved lesson or the first matching starter lesson, previews the complete 35-minute phase flow, opens the existing loadout and runner unchanged, and includes a four-step first-day routine. Responsive and keyboard-accessible, with no new storage or dependencies.
1D. [DONE 2026-07-30] Teacher Today operating flow: add an editable five-day rotation above the lesson launcher, one calm next action at a time, morning-announcement and shutdown prompts, resets after teaching blocks, and fast fallbacks for technology, time, behavior, and missing materials. The supplied schedule is clearly labeled as a provisional historical template until Kenny receives the official K-6 schedule. Plan and daily progress stay on this device in localStorage.
1E. [DONE 2026-07-30] Safe curriculum and Grow Lab release: class mission completion advances to the next built-in lesson, three recurring grade-band hydroponics missions add observation, care, data, and systems work, unsafe height and launcher directions are corrected, competition language favors evidence and improvement, CIRC Tank is labeled as an optional showcase, and the late-class fallback is a true 25-minute rescue.
2. [PENDING] Cadet (K-1): operable with zero reading, every control icon plus color with optional audio through the built in SpeechSynthesis API only, touch targets about twice normal size, the optional showcase timer rendered as a draining fuel tank instead of digits with a soft chime at phase changes and never a klaxon, Team Check-In becomes tap an emoji or color, typography flipped so Lexend dominates with Chakra Petch on big headers only and no all caps.
3. [PENDING] Pilot (2-3): short words plus icons, density between Cadet and Commander.
4. [PENDING] Commander (4-6): keeps the current v0.2 look unchanged.
5. [PENDING] Per band run counters, each mission runs about 13 sections per cycle.
6. [PENDING] Results panel: at capture, a class records one class best number and one photo reference per mission, stored per class, shown on a simple Records Board screen, localStorage only, no Firebase in this pass.

## Step 1 detail (for resume)
Added to mission-control.html and mirrored to index.html:
- New localStorage key missionControl.activeClass.v1 holds the active class id.
- Per class fields added: mode ('cadet' | 'pilot' | 'commander', default 'commander') and lessonState ({missionId, run} or null). Migrated on load by normalizeClasses().
- MODES map and MODE_ORDER. Helpers: saveActive, activeClass, currentMode, setActiveClass, setClassMode, recordLessonState, lessonSummary, normalizeClasses.
- addClass now stamps mode:'commander', lessonState:null on new classes.
- renderClassDetail: new FLIGHT MODE picker (three buttons, reuses the existing band-filter and band-btn styles) that sets and persists the class mode.
- renderHome: new ACTIVE CLASS picker row plus an active class card showing name, mode badge, roster count, and lesson resume. Reuses existing band-filter, season, acct-bar, id-edit styles. No new CSS.
- startRunner now calls recordLessonState(missionId, R.run) so the active class remembers its last launched mission and run.
- currentMode() is the hook that steps 2, 3, 4 will read to switch the UI treatment. Step 1 does not yet change the Cadet or Pilot visuals.

Verified in a real browser served on localhost: 21 of 21 assertions pass, no app console errors, zero em or en dashes, index.html byte identical to mission-control.html.

Historical status when this step closed: not pushed to GitHub. Publication still required Kenny's literal word `push`.

## Step 1E detail (safe curriculum and Grow Lab)
- Completing a built-in lesson now records its id in `completedMissionIds`, clears the active lesson, and suggests the next incomplete lesson by arc. After all available lessons are complete, the sequence starts again instead of returning null.
- Existing classes migrate in place with an empty completion list. New classes start with one.
- Mission storage is `missionControl.missions.v5`, with fallback through v4, v3, and v2. Custom mission ids remain preserved when the safer built-in library loads.
- Grow Lab adds one recurring 35-minute mission for K-2, grades 3-4, and grades 5-6. All three use observation, measurement, evidence, handoff, and cleanup. Only an adult handles nutrients, pH changes, electrical equipment, pump work, sanitation approval, and harvest approval.
- Drop activities no longer direct children to climb chairs or stools. Higher drops are teacher-only, landing zones have safety lines, and reusable passengers replace eggs.
- Launcher activities require soft ammo, teacher signals, below-shoulder launches, and a clear call before retrieval.
- Paper-column loading is teacher-controlled and stops at the first unsafe lean or buckle. Newspaper shelters are tested with a backpack or box, never a child inside.
- The binary activity is described honestly as a simplified classroom encoding model.
- Upcycle Lab now centers repair, usefulness, accessibility, and waste reduction instead of pretend sales.
- Photo directions are conditional on school policy. CIRC Tank is an optional showcase until the school confirms it.
- The late-class rescue now totals 25 minutes: 3 launch, 14 build, 3 share, 5 reset.

## Step 1D detail (teacher operating flow)
- The home screen now begins with a five-day Teacher Today panel before the lesson launcher.
- Each rotation day expands into arrival, announcements, scheduled blocks, a reset after every teaching block, and a leave-work-at-work shutdown action.
- The next action is the only prominent instruction. Mark Done and Back move through the day without changing lesson, roster, timer, or student data.
- Teaching actions open the existing suggested mission. Morning-announcement actions open the existing broadcast mission.
- Edit Schedule accepts simple `TIME | TYPE | LABEL` lines for each day. Allowed types are TEACH, PREP, LUNCH, SUPPORT, and DUTY.
- The default 4, 4, 1, 0, 4 teaching-block pattern is a historical middle-school reference, not an official K-6 schedule. The UI says so and lets Kenny switch the status to official only after replacing it.
- New localStorage keys are `missionControl.teacherPlan.v1` and `missionControl.teacherToday.v1`. Existing keys and migrations are unchanged.
- Fast fallbacks cover technology failure, a late class, an overstimulated room, and missing materials.

Verified locally in Chrome: all five rotation buttons render, Day 3 reports one teaching block, Mark Done advances the action, schedule edits save and survive reload, Restore Historical Template returns to provisional status, the existing Today Mission panel remains, and the 390-pixel mobile view has no horizontal overflow. JavaScript syntax check clean, no app console or page errors, `git diff --check` clean, zero em or en dashes, and index.html byte identical to mission-control.html.

Historical status when this step closed: not pushed to GitHub. Publication still required Kenny's literal word `push`.

## Step 1B detail (architecture correction, for resume)
Grade is now the single source of truth. Nothing stores mode independently.
- GRADES = ['K','1','2','3','4','5','6']. gradeToMode(g): K,1 to cadet; 2,3 to pilot; 4,5,6 to commander. gradeToTier(g): K,1,2 to K-2; 3,4 to 3-4; 5,6 to 5-6.
- Class stores c.grade. Helpers classMode(c) and classTier(c) derive from grade (with legacy fallback to c.mode if a grade is not set yet). currentMode() = classMode(activeClass()).
- Class picker is now a GRADE picker (K through 6) in renderClassDetail. New classes start grade:null so the picker prompts. setClassGrade(id,g) sets grade, drops any legacy mode, and if that class is active it sets homeBand to the tier.
- setActiveClass(id) auto sets homeBand to the class tier so the mission library filters to that tier. The existing GRADE BAND buttons (ALL GRADES) are the view all override. Library filtering rides the existing bandMatch/homeBand system.
- Cadet absorbs the K-2 littles display: littlesOn() returns true when currentMode() is cadet OR the running mission band is K-2. The runner uses one .littles class through littlesOn() (was hardcoded to R.m.band==='K-2' in two places). A flight-<mode> class (flight-cadet/flight-pilot/flight-commander) is added to the runner as the styling hook for steps 2, 3, 4.
- Storage bumped to missionControl.missions.v4 with fallback to v3 then v2, custom missions preserved via the existing merge pattern. Class state migrates in place via normalizeClasses (grade wins; legacy mode kept only until a grade is set).

Migration behavior: a step 1 class that had a mode but no grade keeps working (mode used as fallback) and the picker plus the home card prompt to set a grade. Setting the grade drops the mode field.

Grep report requested in 1B:
- Per phase gold challenge callouts: EXIST. Each phase with a `challenge` field renders `.challenge-link` (cl-tag + cl-dot + cl-text), colored gold via the --flare variable, tagged with the season theme. Present across many K-2, 3-4, and 5-6 missions.
- EMBRACE THE CHALLENGE header pill: EXISTS. `.pill.theme-pill` in the runner HUD (hudHTML), gold via --flare, shows identity.seasonTheme. The theme also appears as the gold `.hot` word on the home season block. Note: `.hud .theme-pill` is hidden by a small-screen media query.

Verified in a real browser served on localhost: 30 of 30 assertions pass (grade to mode and tier derivation, grade-2 and grade-3 both Pilot, grade-2 library shows only K-2, grade-3 library shows only 3-4, view all override, cadet drives littles, legacy migration, grade drops mode). Zero em or en dashes. node syntax check clean. index.html byte identical to mission-control.html.

Historical status when this step closed: not pushed to GitHub. Publication still required Kenny's literal word `push`.
## 2026-09-09 Day 5 readiness and private crew sign-up

Kenny explicitly authorized the intended CIRC HQ release push. The live CIRC-HQ repository was verified from its Git remote and the September 9 release evidence; the older Mission Control checkout was left untouched.

- Thursday, September 10 is Day 5. A dated Welcome and Today shortcut opens the reviewed cardboard build. The existing mode ID, seven-step plan, manual timers, new-class reset and student projection remain intact. Tape and tabs work without the teacher glue station; freestanding modules work without a checked aerial reference.
- Replaced the empty browser icon with an original local CIRC circuit/C mark and added the same mark beside the header identity. Both HTML entrypoints remain byte-identical.
- Added a teacher-supervised crew sign-up screen reached from the top of the announcement studio. It records date, class, first name and primary/backup for 2 announcers, 4 reporters, 2 camera operators and up to 2 optional producers. Kenny remains director. Occupied slots and duplicate class/name assignments on the same date fail without replacing existing data.
- The versioned crew store is local and separate per teacher context. It re-reads and validates storage before writing and verifies its saved value. Corrupt and unavailable storage fail closed with a private paper fallback. No sign-up fields enter teacher plans, script archives, cloud sync, Board or student directions. A temporary demo cannot write private sign-ups. There is no remote student enrollment or cross-device claim.
- Meaningful tests cover storage corruption, quotas, invalid dates and role capacity, duplicate/occupied places, teacher/date isolation, save/reload/remove, plan exclusion and Board exclusion. Browser acceptance exercised the actual Ready/Start/student view flow and saved/reloaded a synthetic camera backup on a separate localhost origin.
- Full suite before final documentation: 538 tests, 536 passed, 2 expected environment skips, 0 failed. All 16 public release gates passed. Final release validation and deployment evidence are recorded in the current task's readiness report.
