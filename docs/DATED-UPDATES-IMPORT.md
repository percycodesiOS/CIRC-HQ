# Dated updates import contract

CIRC HQ is a static site. It cannot read Outlook, email, Teams or any school account, and it never polls them. A person, or a separately authorized process running in the school browser, reads the confirmed calendar and saves one small file. The teacher loads it on **Schedule > Dated updates**. The file stays in that browser only (`circHQ.datedUpdates.local.v1`). It is not synced, not part of backups and never shown on the student side.

## File shape

```json
{
  "format": "circHQ.datedUpdates.v1",
  "checkedFrom": "2026-09-29",
  "checkedThrough": "2026-10-09",
  "preparedAt": "2026-09-29T14:30:00-04:00",
  "updates": [
    {
      "id": "staff-meeting-1001",
      "date": "2026-10-01",
      "start": "15:45",
      "end": "16:30",
      "title": "Staff meeting",
      "place": "Library",
      "kind": "meeting",
      "status": "confirmed",
      "source": "School calendar, read in the school browser",
      "verifiedAt": "2026-09-29T14:20:00-04:00"
    }
  ]
}
```

Use exactly these top-level fields. Each update needs `id`, `date`, `start`, `end`, `title`, `status`, `source` and `verifiedAt`. `place` and `kind` are optional. Any other field rejects the whole file.

## Rules the app enforces

1. `checkedFrom` and `checkedThrough` name the days that were actually checked, at most 120 days. Every update date must fall inside them.
2. A day outside that range shows as "not checked". A checked day with no updates shows "Nothing extra is listed for today. That is not proof there is nothing." The app never reports a confirmed empty day.
3. `start` and `end` are 24-hour `HH:MM`, and `end` is after `start`.
4. `status` is `confirmed`, `tentative` or `cancelled`. Tentative items say "Not confirmed". Cancelled items are listed as cancelled and never create conflicts.
5. `kind`, when present, is `appointment`, `assignment`, `duty`, `meeting` or `event`.
6. `preparedAt` and `verifiedAt` are full date-times with a time zone. Neither can be in the future, and `verifiedAt` cannot be later than `preparedAt`.
7. `title`, `place` and `source` are short labels (120, 120 and 160 characters). No email addresses, links, angle brackets or message text. Copy only what the teacher needs to be in the right place at the right time.
8. `id` is 1 to 40 letters, numbers or hyphens, unique in the file.
9. At most 300 updates per file.
10. Importing replaces the dated updates saved in that browser. It never changes the five-day schedule.

## What the teacher sees

- Updates merge with that day's schedule on the teacher home: next obligation, time, place, and later obligations.
- A check older than 7 days is marked stale ("Check again").
- Overlaps with scheduled blocks or other updates are shown as conflicts to resolve by hand.
- Past dates drop off the home screen (expired). They stay in the saved file until the next import.

## Privacy

Do not include student names, roster details, private notes, email bodies or links. Teacher schedules and dated updates are private to the teacher's own device. Do not commit a real update file to this repository.
