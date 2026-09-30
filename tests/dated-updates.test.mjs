import assert from "node:assert/strict";
import test from "node:test";

import {
  DATED_UPDATES_STORAGE_KEY,
  clearDatedUpdates,
  datedUpdatesForDate,
  loadDatedUpdates,
  previewDatedUpdatesText,
  saveDatedUpdates,
  upcomingDatedUpdates,
  validateDatedUpdates
} from "../src/model/dated-updates.js";

const NOW = new Date("2026-09-29T15:00:00-04:00");

function sample(overrides = {}) {
  return {
    format: "circHQ.datedUpdates.v1",
    checkedFrom: "2026-09-29",
    checkedThrough: "2026-10-09",
    preparedAt: "2026-09-29T14:30:00-04:00",
    updates: [
      { id: "b", date: "2026-10-01", start: "13:10", end: "13:45", title: "Team meeting", place: "Library", kind: "meeting", status: "confirmed", source: "School calendar, read in the school browser", verifiedAt: "2026-09-29T14:20:00-04:00" },
      { id: "a", date: "2026-09-30", start: "09:00", end: "09:40", title: "Covering a duty", kind: "assignment", status: "tentative", source: "Office note", verifiedAt: "2026-09-29T14:10:00-04:00" }
    ],
    ...overrides
  };
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    map
  };
}

test("a valid dated update file is accepted and sorted by date and time", () => {
  const result = validateDatedUpdates(sample(), { now: NOW });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.value.updates.map(update => update.id), ["a", "b"]);
  assert.equal(result.value.updates[0].kind, "assignment");
  assert.equal(validateDatedUpdates(sample({ updates: [] }), { now: NOW }).ok, true, "an empty checked range is allowed");
});

test("invalid files are rejected whole with readable reasons", () => {
  const cases = [
    [{ format: "other" }, /format must be/],
    [{ extra: true }, /Use exactly these fields/],
    [{ checkedThrough: "2026-09-01" }, /must not be before/],
    [{ checkedThrough: "2027-06-04" }, /at most 120 days/],
    [{ preparedAt: "2026-09-29 14:30" }, /time zone/],
    [{ preparedAt: "2026-10-05T09:00:00-04:00" }, /in the future/]
  ];
  for (const [patch, pattern] of cases) {
    const result = validateDatedUpdates(sample(patch), { now: NOW });
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.match(result.errors.join(" "), pattern);
  }
  const updateCases = [
    [{ attendees: "someone" }, /does not accept: attendees/],
    [{ date: "2026-02-30" }, /YYYY-MM-DD/],
    [{ date: "2026-11-20" }, /outside the checked range/],
    [{ start: "14:00", end: "13:00" }, /end must be after start/],
    [{ start: "1:10" }, /HH:MM/],
    [{ title: "Email someone@school.example" }, /no email address/],
    [{ place: "https://example.com/room" }, /no email address, link/],
    [{ source: "" }, /source must say where/],
    [{ status: "maybe" }, /confirmed, tentative or cancelled/],
    [{ verifiedAt: "2026-09-30T08:00:00-04:00" }, /later than the file was prepared/],
    [{ kind: "party" }, /kind must be/]
  ];
  for (const [patch, pattern] of updateCases) {
    const file = sample();
    file.updates[0] = { ...file.updates[0], ...patch };
    const result = validateDatedUpdates(file, { now: NOW });
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.match(result.errors.join(" "), pattern, JSON.stringify(patch));
  }
  const missing = sample();
  delete missing.updates[0].verifiedAt;
  assert.match(validateDatedUpdates(missing, { now: NOW }).errors.join(" "), /missing: verifiedAt/);
  const duplicate = sample();
  duplicate.updates[1].id = "b";
  assert.match(validateDatedUpdates(duplicate, { now: NOW }).errors.join(" "), /repeats the id/);
  assert.match(previewDatedUpdatesText("{not json", { now: NOW }).errors[0], /not valid JSON/);
  assert.match(previewDatedUpdatesText("", { now: NOW }).errors[0], /Choose or paste/);
});

test("saved updates round trip, unreadable saves stay untouched, and clear removes only this key", () => {
  const storage = memoryStorage();
  assert.equal(loadDatedUpdates(storage, { now: NOW }).status, "empty");
  saveDatedUpdates(storage, sample(), { now: NOW });
  const loaded = loadDatedUpdates(storage, { now: NOW });
  assert.equal(loaded.status, "saved");
  assert.equal(loaded.book.updates.length, 2);
  assert.equal(loaded.book.importedAt, NOW.toISOString());
  storage.setItem("circHQ.k6.state.v1", "OTHER");
  storage.setItem(DATED_UPDATES_STORAGE_KEY, "{broken");
  assert.equal(loadDatedUpdates(storage, { now: NOW }).status, "invalid");
  assert.equal(storage.getItem(DATED_UPDATES_STORAGE_KEY), "{broken", "an unreadable save is left untouched");
  assert.throws(() => saveDatedUpdates(storage, sample({ format: "x" }), { now: NOW }), /format must be/);
  assert.equal(clearDatedUpdates(storage), true);
  assert.equal(storage.getItem("circHQ.k6.state.v1"), "OTHER");
});

test("a day outside the checked range is not checked, and an empty checked day is never called proof of no events", () => {
  const book = { ...validateDatedUpdates(sample(), { now: NOW }).value, importedAt: NOW.toISOString() };
  const outside = datedUpdatesForDate(book, "2026-10-20", { now: NOW });
  assert.equal(outside.coverage, "not-checked");
  assert.deepEqual(outside.items, []);
  const emptyDay = datedUpdatesForDate(book, "2026-10-02", { now: NOW });
  assert.equal(emptyDay.coverage, "checked");
  assert.deepEqual(emptyDay.items, []);
  assert.equal(datedUpdatesForDate(null, "2026-10-02", { now: NOW }).coverage, "none");
});

test("stale checks, conflicts and cancelled updates are labeled", () => {
  const file = sample();
  file.updates.push({ id: "c", date: "2026-10-01", start: "13:30", end: "14:00", title: "Parent call", status: "confirmed", source: "Office note", verifiedAt: "2026-09-29T14:00:00-04:00" });
  file.updates.push({ id: "d", date: "2026-10-01", start: "13:00", end: "14:00", title: "Old meeting", status: "cancelled", source: "Office note", verifiedAt: "2026-09-29T14:00:00-04:00" });
  const book = { ...validateDatedUpdates(file, { now: NOW }).value, importedAt: NOW.toISOString() };
  const day = datedUpdatesForDate(book, "2026-10-01", {
    now: new Date("2026-10-01T08:00:00-04:00"),
    scheduleEvents: [{ id: "s1", title: "Afternoon class", startMinutes: 13 * 60 + 20, endMinutes: 13 * 60 + 55 }]
  });
  const byId = Object.fromEntries(day.items.map(item => [item.id, item]));
  assert.deepEqual(byId.b.conflicts, ["Afternoon class", "Parent call"]);
  assert.deepEqual(byId.c.conflicts, ["Afternoon class", "Team meeting"]);
  assert.deepEqual(byId.d.conflicts, [], "cancelled updates never create conflicts");
  assert.equal(day.stale, false);
  const later = datedUpdatesForDate(book, "2026-10-09", { now: new Date("2026-10-09T08:00:00-04:00") });
  assert.equal(later.stale, true, "a check more than seven days old is stale");
  assert.match(later.freshness, /days ago/);
});

test("past dated updates expire from the upcoming list", () => {
  const book = { ...validateDatedUpdates(sample(), { now: NOW }).value, importedAt: NOW.toISOString() };
  assert.deepEqual(upcomingDatedUpdates(book, "2026-09-29").map(update => update.id), ["a", "b"]);
  assert.deepEqual(upcomingDatedUpdates(book, "2026-10-01").map(update => update.id), ["b"]);
  assert.deepEqual(upcomingDatedUpdates(book, "2026-10-02"), []);
});
