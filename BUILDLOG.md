# Mission Control - BUILDLOG

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
