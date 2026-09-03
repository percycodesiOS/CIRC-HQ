import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNOUNCEMENT_CREW_ROLES,
  ANNOUNCEMENT_LOCAL_STORAGE_KEY,
  ANNOUNCEMENT_WORKFLOW,
  GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY,
  admitAnnouncementDraft,
  clearLocalAnnouncementDraft,
  createAnnouncementDraft,
  evaluateAnnouncementDraft,
  loadLocalAnnouncementDraft,
  resetAnnouncementDraft,
  saveLocalAnnouncementDraft,
  setAnnouncementCheck,
  setAnnouncementTeacherReview,
  updateAnnouncementDetails,
  updateAnnouncementSection
} from "../src/model/announcements.js";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => {
      writes.push([key, value]);
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key)
  };
}

function readyForTeacherReview() {
  let draft = createAnnouncementDraft({ date: "2026-09-03" });
  draft = updateAnnouncementSection(draft, "opening", "Good morning. Welcome to today's announcements.");
  draft = updateAnnouncementSection(draft, "closing", "Have a safe and thoughtful day.");
  for (const itemId of ["crewAssigned", "scriptReady", "factsChecked"]) {
    draft = setAnnouncementCheck(draft, "prepare", itemId, true);
  }
  for (const itemId of ["fullRead", "timingChecked", "pronunciationsChecked"]) {
    draft = setAnnouncementCheck(draft, "rehearse", itemId, true);
  }
  return draft;
}

test("a new local draft is public-safe and contains no invented school or student facts", () => {
  const draft = createAnnouncementDraft();

  assert.equal(draft.format, "circ.announcements.local.v1");
  assert.equal(draft.scope, "local-only");
  assert.equal(draft.date, "");
  assert.deepEqual(draft.script, {
    opening: "",
    pledgeSchoolItems: "",
    birthdaysEvents: "",
    weather: "",
    closing: ""
  });
  assert.equal(Object.hasOwn(draft, "studentNames"), false);
  assert.equal(Object.hasOwn(draft, "schoolName"), false);
  assert.doesNotMatch(JSON.stringify(draft), /private-person-sentinel|private-district-sentinel|student name/i);
  assert.deepEqual(ANNOUNCEMENT_WORKFLOW.map(({ id }) => id), ["prepare", "rehearse", "go-live", "reset"]);
  assert.deepEqual(ANNOUNCEMENT_CREW_ROLES.map(({ id }) => id), [
    "producer", "leadReader", "coReader", "timekeeper", "techLead"
  ]);
  assert.match(GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY, /Grade 6/i);
  assert.match(GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY, /rite-of-passage responsibility/i);
});

test("script and timing edits are immutable and invalidate an earlier teacher approval", () => {
  const ready = readyForTeacherReview();
  const approved = setAnnouncementTeacherReview(ready, true);
  const snapshot = structuredClone(approved);

  const changedScript = updateAnnouncementSection(approved, "weather", "Use the teacher-approved forecast.");
  const changedTiming = updateAnnouncementDetails(approved, { targetMinutes: 4, rehearsalSeconds: 188 });

  assert.equal(changedScript.teacherReview.approved, false);
  assert.equal(changedTiming.teacherReview.approved, false);
  assert.equal(changedTiming.timing.targetMinutes, 4);
  assert.equal(changedTiming.timing.rehearsalSeconds, 188);
  assert.deepEqual(approved, snapshot);
});

test("the workflow reports plain validation and preflight requirements before teacher review", () => {
  const empty = evaluateAnnouncementDraft(createAnnouncementDraft());

  assert.equal(empty.reviewReady, false);
  assert.equal(empty.canGoLive, false);
  assert.deepEqual(empty.errors.map(({ field }) => field), ["date", "script.opening", "script.closing"]);
  assert.deepEqual(empty.incompletePrepare, ["crewAssigned", "scriptReady", "factsChecked"]);
  assert.deepEqual(empty.incompleteRehearse, ["fullRead", "timingChecked", "pronunciationsChecked"]);

  const ready = evaluateAnnouncementDraft(readyForTeacherReview());
  assert.deepEqual(ready.errors, []);
  assert.equal(ready.prepareComplete, true);
  assert.equal(ready.rehearseComplete, true);
  assert.equal(ready.reviewReady, true);
  assert.equal(ready.canGoLive, false);
});

test("teacher approval is the final gate and cannot be granted before the draft is ready", () => {
  assert.throws(
    () => setAnnouncementTeacherReview(createAnnouncementDraft(), true),
    /Finish the script and rehearsal checklist before teacher approval\./
  );

  const ready = readyForTeacherReview();
  const approved = setAnnouncementTeacherReview(ready, true);
  const assessment = evaluateAnnouncementDraft(approved);

  assert.equal(approved.teacherReview.approved, true);
  assert.equal(assessment.reviewReady, true);
  assert.equal(assessment.canGoLive, true);
  assert.equal(setAnnouncementTeacherReview(approved, false).teacherReview.approved, false);
});

test("checklist changes validate known phases and items without mutating the draft", () => {
  const draft = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  const changed = setAnnouncementCheck(draft, "go-live", "broadcastComplete", true);

  assert.equal(changed.checklist["go-live"].broadcastComplete, true);
  assert.equal(draft.checklist["go-live"].broadcastComplete, false);
  assert.throws(
    () => setAnnouncementCheck(createAnnouncementDraft(), "go-live", "broadcastComplete", true),
    /Teacher approval is required before going live\./
  );
  assert.throws(() => setAnnouncementCheck(draft, "unknown", "item", true), /Choose a valid announcement checklist item\./);
  assert.throws(() => setAnnouncementCheck(draft, "prepare", "unknown", true), /Choose a valid announcement checklist item\./);
});

test("reset creates a clean local draft and preserves only the requested next date and timing target", () => {
  let draft = readyForTeacherReview();
  draft = setAnnouncementTeacherReview(draft, true);
  const reset = resetAnnouncementDraft(draft, { date: "2026-09-04" });

  assert.equal(reset.scope, "local-only");
  assert.equal(reset.date, "2026-09-04");
  assert.equal(reset.timing.targetMinutes, draft.timing.targetMinutes);
  assert.deepEqual(Object.values(reset.script), ["", "", "", "", ""]);
  assert.equal(reset.teacherReview.approved, false);
  assert.equal(evaluateAnnouncementDraft(reset).canGoLive, false);
});

test("local draft admission strips unknown private fields and returns a detached safe shape", () => {
  const source = {
    ...createAnnouncementDraft({ date: "2026-09-03", targetMinutes: 4 }),
    studentNames: ["PRIVATE_STUDENT"],
    schoolName: "PRIVATE_SCHOOL",
    cloudRoomId: "PRIVATE_ROOM"
  };

  const admitted = admitAnnouncementDraft(source);

  assert.deepEqual(Object.keys(admitted).sort(), [
    "checklist",
    "date",
    "format",
    "scope",
    "script",
    "teacherReview",
    "timing",
    "version"
  ]);
  assert.equal(JSON.stringify(admitted).includes("PRIVATE_"), false);
  admitted.script.opening = "Changed after admission";
  assert.equal(source.script.opening, "");
});

test("local draft admission rejects unsafe format timing and oversized script values", () => {
  assert.throws(
    () => admitAnnouncementDraft({ ...createAnnouncementDraft(), scope: "cloud" }),
    /Only a local CIRC announcement draft can be used here\./
  );
  assert.throws(
    () => admitAnnouncementDraft(createAnnouncementDraft({ targetMinutes: 0 })),
    /target from 1 through 15 minutes/
  );
  assert.throws(
    () => admitAnnouncementDraft(updateAnnouncementSection(
      createAnnouncementDraft(),
      "opening",
      "x".repeat(2001)
    )),
    /2,000 characters or fewer/
  );
});

test("local draft storage uses one isolated key and fails closed without overwriting malformed data", () => {
  const malformed = "{not-json";
  const storage = memoryStorage({ [ANNOUNCEMENT_LOCAL_STORAGE_KEY]: malformed });

  const failedLoad = loadLocalAnnouncementDraft(storage, { date: "2026-09-03" });
  assert.equal(failedLoad.status, "invalid");
  assert.equal(failedLoad.draft.date, "2026-09-03");
  assert.equal(storage.getItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY), malformed);
  assert.deepEqual(storage.writes, []);

  const saved = saveLocalAnnouncementDraft(storage, {
    ...createAnnouncementDraft({ date: "2026-09-03" }),
    studentNames: ["PRIVATE_STUDENT"]
  });
  assert.equal(saved.scope, "local-only");
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0][0], ANNOUNCEMENT_LOCAL_STORAGE_KEY);
  assert.equal(storage.writes[0][1].includes("PRIVATE_STUDENT"), false);

  const loaded = loadLocalAnnouncementDraft(storage);
  assert.equal(loaded.status, "saved");
  assert.deepEqual(loaded.draft, saved);
});

test("local draft loading fails closed when browser storage access is denied", () => {
  const result = loadLocalAnnouncementDraft({
    getItem: () => {
      throw new Error("storage-denied");
    }
  }, { date: "2026-09-03" });

  assert.equal(result.status, "unavailable");
  assert.equal(result.draft.date, "2026-09-03");
  assert.equal(result.draft.scope, "local-only");
});

test("clearing removes only the isolated local draft key and reports denied storage", () => {
  const storage = memoryStorage({
    [ANNOUNCEMENT_LOCAL_STORAGE_KEY]: JSON.stringify(createAnnouncementDraft()) ,
    "unrelated-key": "keep"
  });

  clearLocalAnnouncementDraft(storage);
  assert.equal(storage.getItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY), null);
  assert.equal(storage.getItem("unrelated-key"), "keep");
  assert.throws(
    () => clearLocalAnnouncementDraft({
      removeItem: () => {
        throw new Error("storage-denied");
      }
    }),
    /local announcement draft could not be cleared/i
  );
});
