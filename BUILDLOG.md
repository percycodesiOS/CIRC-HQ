# Mission Control - BUILDLOG

Single file classroom app for a K-6 CIRC teacher at Ehrman Crest (ECMS).
Repo: percycodesiOS/5_MissionControl_6. Source of truth is mission-control.html.
index.html must stay byte identical to mission-control.html.

## Hard constraints (every step)
- One single HTML file, inline CSS and JS, no new dependencies, no build step, works offline from a saved copy.
- Black background, neon cyan #00E5FF, blue #3E6BFF, violet #C44DFF. Chakra Petch for display headers, Lexend for body.
- Title stays MISSION CONTROL, ECMS, EMBRACE THE CHALLENGE.
- Preserve every existing feature exactly: phase countdown timers (Space pauses and resumes, N skips), 4 letter class join codes, tap your name rosters, the student home screen, Broadcast mode, CIRC Tank, Loadout, Team Check-In, all state in localStorage on one device.
- Never use em dashes or en dashes anywhere, including code comments and UI text.
- One numbered step per session. Never push to GitHub unless Kenny's message contains the literal word push.

## Steps
1. [DONE 2026-07-17] Grade band modes set per class and persisted per class: K-1 Cadet, 2-3 Pilot, 4-6 Commander, with the class picker loading a class's mode, roster, and lesson state instantly. NOTE: step 1's independent mode storage was superseded by step 1B below (grade is now the single source of truth).
1B. [DONE 2026-07-17] Architecture correction: unify step 1's banding with the existing K-6 content system. Class stores GRADE (K-6); flight mode and content tier both derive from grade; active class auto filters the library to its tier; Cadet absorbs the existing K-2 littles display (one system). See Step 1B detail below.
2. [PENDING] Cadet (K-1): operable with zero reading, every control icon plus color with optional audio through the built in SpeechSynthesis API only, touch targets about twice normal size, the CIRC Tank timer rendered as a draining fuel tank instead of digits with a soft chime at phase changes and never a klaxon, Team Check-In becomes tap an emoji or color, typography flipped so Lexend dominates with Chakra Petch on big headers only and no all caps.
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

Not pushed to GitHub. Waiting on the literal word push.

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

Not pushed to GitHub. Waiting on the literal word push.
