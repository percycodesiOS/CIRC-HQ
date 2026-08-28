# CIRC HQ | The Playbook

CIRC HQ is the teacher operating shell for The Playbook. It keeps Today, Curriculum, Schedule, Room, and Settings together in one calm local view. The preserved classroom application remains available separately for its 57 locked legacy experiences.

## Start CIRC HQ locally

1. Open PowerShell in this folder.
2. Run this command:

```powershell
node scripts/dev-server.mjs
```

3. Open `http://127.0.0.1:4173/` in a browser.

The local server exposes only the files needed by the public shell. It does not expose tests, internal reports, Git files, Firebase or sync code, or private source files.

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

## Privacy and account boundaries

- Board is display only. It has no student accounts, aliases, class codes, rosters, or student write path.
- Board receives only teacher-reviewed class and lesson fields. Teacher identity, private notes, preferences, duty details, and unreviewed schedule content stay out.
- Resource links pass one shared fail-closed schema and URL check before local storage, import, export, sync, Firebase, or Room can retain them.
- Shared teacher sync remains blocked. It needs a separately approved trust and membership design before activation.
- A separate CIRC HQ Firebase project remains uncreated, unconfigured, unconnected, and separately gated. Creating an account, enabling providers, uploading teacher data, deploying rules or hosting, and changing billing each require separate approval.
- CyberGrader is not reused. It has different student data, account, runtime, and security boundaries. Reusing it would mix systems that must remain separate.

## Preserved classroom route

Open `http://127.0.0.1:4173/classroom-legacy.html` for the locked classroom application. Its exact bytes and 57 experiences are protected by a release hash. The new CIRC HQ shell does not add student identity or write features from that route.

## Verify a public handoff

```powershell
npm test
npm run verify
```

The verifier checks the recursive Git candidate set, public entrypoints, locked legacy hash, Firebase placeholders, typography, credential and privacy sentinels, runtime policy, DOM sinks, server allowlist, JavaScript syntax, and the Node test suite. It prints only gate names and counts, never matched content.

## Publication status

GitHub Pages publication is a separate final gate. It requires an explicit publication decision after the public handoff is reviewed. This Task 6 work did not push, publish, deploy, or connect Firebase. This repository has prior history, so this README does not claim that it has never been deployed in the past.
