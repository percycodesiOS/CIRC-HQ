# CIRC HQ Guided Setup and Cloud Sync Design

**Status:** Approved for implementation by Kenny on September 1, 2026

**Release target:** A teacher-usable release for September 2, 2026

**Source repository:** `K:\Projects\CIRC-HQ`

**Current public surface:** GitHub Pages remains the delivery surface for this release. Firebase supplies authentication and data only. A Firebase Hosting or custom-domain move is a later, separately verified cutover.

## 1. Outcome

CIRC HQ becomes a calm teacher operating system that can be opened on more than one device without losing the teacher's plan or progress. Kenny and Tammy sign in separately. Each teacher's schedule and private working state stay private to that teacher. Both teachers can join one trusted room and update explicitly shared physical-project state such as the Tech Terrarium handoff.

The release replaces the current cartoon splash with a mature guided setup built from the approved Tech Terrarium maker-studio design language. The existing Today, Playbooks, Board, Student, and experience-runner strengths remain intact.

## 2. Hard constraints

- CIRC HQ and CyberGrader use separate Firebase projects and namespaces.
- No teacher plan, schedule, duty, note, private resource, credential, access token, invite token, or student data is committed to Git.
- Kenny and Tammy use separate authenticated accounts.
- Private teacher data is UID-scoped and is never readable by another teacher.
- Shared room data is available only to trusted room members.
- Board and Student views have no accounts and no direct cloud-write path.
- Live experience runners remain owned by the device running the class for this release.
- A second device cannot silently take over or overwrite a live timer.
- Local storage remains the offline cache and recovery layer.
- Cloud migration requires a human-readable preview, explicit confirmation, write, read-back verification, and preserved local backup.
- Sync conflicts stop the affected cloud write and surface a recovery choice. They are never silently discarded.
- The current message authorizes push. Release still requires local verification, remote verification, and a live smoke test.
- Mission Control writing constraints continue to apply: no em dash or en dash in product copy.

## 3. Visual direction

### Keep

- White maker-studio surfaces
- Bold black display typography
- SV blue as the primary operational accent
- Electric lime for active and current-step emphasis
- Authentic project photography
- Restrained outlined cards and physical shadows
- Existing local Phosphor icons
- Existing Today, Tech Terrarium, independence-path, Fast Finish, and runner hierarchy

### Remove from the front door

- Smiling gear mascot
- Rainbow storybook hero
- Sparkles and confetti dots
- Decorative art that is larger than the teacher's task
- Full navigation before setup is complete

### First-run composition

The first viewport uses the existing Tech Terrarium photograph as the visual anchor. The primary content is a teacher-facing setup status card, not a marketing hero. Desktop uses a split layout. Phone puts a compact photo band behind or above the setup status without pushing the current task below the fold.

The top-left brand image uses an authentic crop of the existing Tech Terrarium photograph for this release. It does not generate or approximate a new mascot. The lockup remains `CIRC HQ` and `The K-6 Playbook`.

## 4. Guided setup flow

Setup is one resumable route with one current action. Completed steps remain visible as a compact checklist.

### Step 1: Welcome

- Title: `Get CIRC HQ ready`
- Explain that setup connects a private teacher account, loads the schedule, and joins the shared room.
- Primary action: `Continue with Google`
- Secondary action: `Explore a temporary demo`
- Demo copy must say `Nothing in this demo is saved or synced.`

### Step 2: Confirm teacher

- Show the signed-in Google display name and masked email.
- Explain that the signed-in account owns only that teacher's private CIRC data.
- Require explicit `Use this account` confirmation.
- Offer `Use a different account` through normal Firebase sign-out and sign-in.

### Step 3: Teacher plan

- If verified private cloud data exists, show `Plan found in CIRC Cloud` and a human-readable summary before loading it.
- If no cloud plan exists, ask for the private teacher-plan JSON file.
- Preview shows teacher name, five cycle days, event count, calendar start and end, current date result, and validation warnings.
- Copy identifies the file as private teacher information.
- No upload occurs at file selection or preview.

### Step 4: CIRC room

- Existing members see their room name and membership status.
- A room owner can create one CIRC room and a one-time invitation.
- A joining teacher enters the invitation code.
- The raw invitation code is never stored. The client hashes it with Web Crypto and uses the hash as the invitation document ID.
- Invitation redemption and membership creation occur in one Firestore transaction.
- A teacher cannot grant themselves membership without a valid, unused invitation.

### Step 5: Confirm cloud upload

The setup page lists the exact boundaries:

Private to the signed-in teacher:

- Teacher plan and schedule
- Teacher project progress
- Preferences
- Checklists, classes, lesson guides, special events, resources, and private notes

Shared with the selected room:

- Shared physical-project artifacts
- Shared room-level project progress
- Artifact visit and handoff history

Not uploaded in this release:

- Active or paused lesson runners
- Live timer ownership
- Browser recovery backup
- Any student account or student submission

Primary action: `Upload and verify`.

### Step 6: Verification

- Write each admitted cloud domain.
- Read each written document back.
- Verify schema version, UID or membership boundary, and revision.
- Keep the local backup until all required reads match.
- Show one of: `CIRC Cloud verified`, `Offline, saved on this device`, or `Sync needs attention`.

### Step 7: Setup complete

Show:

- Teacher name
- Current cycle day
- Private plan status
- CIRC room status
- Last verified sync time
- Local backup status

Actions:

- `Open Today`
- `Preview an experience`
- `Setup help`

## 5. Demo boundary

Demo remains in memory only. It cannot save, import, apply calendar overrides, start or finish a live class, create a room, join a room, authenticate, or write Firebase data.

Every demo page includes a visible `Exit demo and set up CIRC HQ` action. Teacher Setup in demo mode is replaced with a short explanation and that action. No enabled control may silently refuse to act.

## 6. Cloud data model

All cloud documents include:

- `schemaVersion`
- `revision`
- `updatedAt` using a Firestore server timestamp
- `updatedBy` using the authenticated UID

### Private teacher namespace

```text
/playbookTeachers/{uid}
/playbookTeachers/{uid}/private/plan
/playbookTeachers/{uid}/private/progress
/playbookTeachers/{uid}/private/preferences
/playbookTeachers/{uid}/private/content
```

The root document contains non-secret setup metadata, current tenant and room references, and sync status metadata. Rules require `request.auth.uid == uid` for every read and write in this namespace.

The private documents contain:

- `plan`: admitted teacher plan only
- `progress`: `teacherProgress` only
- `preferences`: device-neutral preferences only
- `content`: checklist, classes, lesson guides, special events, resources, notes, and tombstones relevant to those collections

`experienceRunners` and `sharedArtifacts` are prohibited from private cloud documents.

### Trusted room namespace

```text
/playbookTenants/{tenantId}
/playbookTenants/{tenantId}/members/{uid}
/playbookTenants/{tenantId}/rooms/{roomId}
/playbookTenants/{tenantId}/rooms/{roomId}/artifacts/{artifactId}
/playbookTenants/{tenantId}/rooms/{roomId}/projectProgress/{projectId}
/playbookInvites/{inviteHash}
```

Membership documents contain UID, tenant ID, role, created timestamp, and invitation reference. Only the tenant owner can create invitations. A joining teacher can create only their own membership through a valid invitation redemption transaction.

Artifact writes use Firestore transactions. They require the caller's membership, compare the prior revision, apply the deterministic visit identity already enforced by the model, increment the revision by one, and use a server timestamp.

## 7. Authentication

- Firebase Authentication uses Google as the only provider for this release.
- Desktop may use a popup.
- Mobile uses redirect when popup is unavailable.
- The app observes auth state and never assumes a sign-in call completed until Firebase reports the authenticated user.
- Signing out clears in-memory cloud identity and room membership but preserves admitted local recovery data.
- No Google OAuth access token is persisted by CIRC HQ.

## 8. Local-first synchronization

Local storage remains usable without a network connection.

Startup order:

1. Admit and load local state.
2. Render a usable local state immediately when a plan exists.
3. Observe Firebase authentication.
4. If signed in, load private cloud domains and trusted room state.
5. Merge only by domain.
6. Save the admitted merged result locally.
7. Show exact sync status.

Write order:

1. Save admitted local state and preserve the prior valid local backup.
2. Partition the changed domain.
3. If offline or signed out, mark the domain pending without blocking the class.
4. If online, write with the caller's expected base revision.
5. Read back and verify.
6. Mark synced only after verification.

Private plan replacement always requires the existing preview token and explicit Apply action. Cloud sync never turns a file selection into an upload.

## 9. Conflict behavior

- Plan conflicts stop and require a choice between the verified cloud plan and the newly previewed local plan.
- Progress and admitted entity collections merge by stable identity and timestamp using the existing sync semantics.
- Equal-timestamp divergence remains a visible conflict.
- Shared artifact conflicts retry through a transaction and never use blind whole-state overwrite.
- A conflict in one domain does not disable unrelated local teaching functions.

## 10. Live runner boundary

For the September 2 release, `experienceRunners` stay local to the device that starts the class. The runner page displays `This device is running the class`.

Completed project progress can sync after the local completion transaction succeeds. Cross-device live-runner takeover is not included because it requires a device lease, server-time baseline, expiry, and explicit transfer interaction.

## 11. Setup help

Setup Help remains available after onboarding and contains:

- Signed-in teacher account
- Private plan status
- Room membership
- Last verified sync
- Pending or conflict state
- Local backup status
- `Sync now`
- `Export local backup`
- `Replace teacher plan` with preview
- `Leave this device signed in` explanation
- `Sign out`
- Recovery steps for offline, blocked popup, expired invite, denied rules, and conflicting plan

It never displays raw Firebase tokens, invite hashes, credentials, or private plan JSON.

## 12. Firebase security and test personas

Firestore Rules emulator tests are required for:

- Kenny authenticated as his UID
- Tammy authenticated as her UID
- An unrelated authenticated UID
- An unauthenticated request

Tests prove:

- Each teacher can read and write only their own private namespace.
- Kenny cannot read Tammy's private data and Tammy cannot read Kenny's.
- Unrelated and unauthenticated users cannot read teacher or room data.
- Trusted members can read and update admitted room documents.
- Non-members cannot read or write room documents.
- Only the owner can create invitations.
- A valid invitation can create only the joining UID's membership and is consumed once.
- Shared artifact revisions cannot skip or move backward.
- Private documents reject shared artifacts, runners, credentials, and unknown top-level keys.

## 13. Release and rollback

Release sequence:

1. Run focused unit and integration tests.
2. Run Firestore Rules emulator tests.
3. Run the complete Node suite.
4. Run `npm run verify`.
5. Confirm no private plan, local path, token, credential, or invite value is tracked.
6. Commit the verified source.
7. Push only after the explicit `push` authorization already given in the current message.
8. Wait for GitHub Pages deployment.
9. Test first-run, demo exit, local import, authenticated setup, and existing-user startup on desktop and phone.

Rollback preserves the last known good Git commit and Firebase rules release. A web rollback does not delete Firestore data. A rules rollback must remain compatible with already written document schema or explicitly deny writes while allowing the owner to export recovery data.

## 14. Non-goals for this release

- Student accounts
- Student cloud writes
- Cross-device live timer control
- Automatic teacher-plan upload
- School Outlook authentication
- CyberGrader data reuse
- Firebase Hosting or custom-domain cutover
- Billing-plan changes
- Analytics, advertising, or behavioral tracking

## 15. Acceptance criteria

- A new desktop and a 390-pixel phone begin on the guided setup, not the cartoon splash.
- The primary setup action is visible in the first phone viewport.
- Demo is visibly temporary and has a direct setup exit.
- Kenny and Tammy authenticate separately.
- Each teacher sees only their own private plan and progress.
- Both trusted teachers can see one shared Tech Terrarium artifact revision.
- A non-member and signed-out browser receive Firestore permission denial.
- A private plan is not uploaded before preview and explicit confirmation.
- Successful setup ends with a read-back verified cloud revision.
- Offline local teaching remains usable.
- A live runner cannot be changed from another device in this release.
- The focused tests, complete suite, verifier, tracked-file privacy scan, and live smoke tests pass before completion is claimed.
