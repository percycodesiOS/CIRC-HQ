import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNOUNCEMENT_CREW_ROLES,
  ANNOUNCEMENT_LOCAL_STORAGE_KEY,
  ANNOUNCEMENT_ARCHIVE_STORAGE_KEY,
  ANNOUNCEMENT_WORKFLOW,
  GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY,
  admitAnnouncementDraft,
  applyEcmsAnnouncementOutline,
  applyPreparedEcmsAnnouncement,
  PREPARED_ECMS_BROADCASTS,
  clearLocalAnnouncementDraft,
  createAnnouncementDraft,
  evaluateAnnouncementDraft,
  getAnnouncementCrew,
  hasAnnouncementScript,
  loadLocalAnnouncementDraft,
  loadLocalAnnouncementArchive,
  loadArchivedAnnouncementDraft,
  resetAnnouncementDraft,
  resetAnnouncementCrew,
  saveLocalAnnouncementDraft,
  saveDatedAnnouncementDraft,
  setAnnouncementCheck,
  setAnnouncementCrewCheck,
  setAnnouncementTeacherReview,
  updateAnnouncementDetails,
  updateAnnouncementCrewTime,
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
  for (const slot of ["announcer1", "announcer2"]) {
    for (const field of ["homeroomConfirmed", "arrived", "ready"]) draft = setAnnouncementCrewCheck(draft, slot, field, true);
  }
  return draft;
}

test("prepared school scripts load explicitly with current names and Friday approval still required", () => {
  const original = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  const before = structuredClone(original);
  for (const { date, cycleDay } of PREPARED_ECMS_BROADCASTS) {
    assert.throws(() => applyPreparedEcmsAnnouncement(original, date), /Confirm before replacing/);
    let draft = applyPreparedEcmsAnnouncement(original, date, { replaceExisting: true });
    assert.equal(draft.date, date);
    assert.equal(draft.timing.targetMinutes, 3);
    assert.match(draft.script.opening, new RegExp(`cycle day ${cycleDay}`));
    assert.equal(draft.teacherReview.approved, false);
    assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
    assert.equal(Object.values(getAnnouncementCrew(draft).announcers).flatMap(Object.values).every(v => v === false), true);
    const text = Object.values(draft.script).join("\n");
    assert.equal((text.match(/Wait 5 additional seconds/g) ?? []).length, 1);
    assert.match(text, /at least 20 seconds/);
    assert.match(text, /with liberty and justice for all/);
    assert.match(text, /October 31/);
    assert.match(text, /September 17/);
    assert.doesNotMatch(text, /TEACHER ONLY|reserve about 30|spiritwear|birthday/i);
    draft = updateAnnouncementSection(draft, "opening", draft.script.opening.replace("[[ANNOUNCER 1 FIRST NAME]]", "First").replace("[[ANNOUNCER 2 FIRST NAME]]", "Second"));
    for (const phase of ["prepare", "rehearse"]) {
      for (const item of Object.keys(draft.checklist[phase])) draft = setAnnouncementCheck(draft, phase, item, true);
    }
    if (date === "2026-09-11") {
      assert.equal(evaluateAnnouncementDraft(draft).reviewReady, false);
      assert.throws(() => setAnnouncementTeacherReview(draft, true), /teacher approval/i);
      draft = updateAnnouncementSection(draft, "pledgeSchoolItems", draft.script.pledgeSchoolItems.replace("[[TIM AND IVAN APPROVED SEPTEMBER 11 MESSAGE WITH SPEAKER]]", "Announcer 1: Approved message."));
    }
    assert.equal(evaluateAnnouncementDraft(draft).reviewReady, true);
    assert.ok(Object.values(draft.script).every(section => section.length <= 2000));
  }
  assert.deepEqual(original, before);
  assert.throws(() => applyPreparedEcmsAnnouncement(original, "2026-09-12", { replaceExisting: true }), /prepared September/);
});

test("private crew defaults are unchecked and old approved archives remain readable without migration writes", () => {
  const legacy = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  delete legacy.crew;
  assert.equal(Object.hasOwn(legacy, "crew"), false);
  const crew = getAnnouncementCrew(legacy);
  assert.deepEqual(crew.times, { arrival: "08:50", backup: "08:52", finalCheck: "08:54", broadcast: "08:55" });
  assert.equal(Object.values(crew.announcers).flatMap(Object.values).every((value) => value === false), true);
  const archive = { format: "circ.announcements.archive.v1", version: 1, scope: "local-only", drafts: { [legacy.date]: legacy } };
  const text = JSON.stringify(archive);
  const storage = memoryStorage({ [ANNOUNCEMENT_ARCHIVE_STORAGE_KEY]: text });
  assert.deepEqual(loadArchivedAnnouncementDraft(storage, legacy.date), legacy);
  assert.equal(loadLocalAnnouncementArchive(storage).status, "saved");
  assert.equal(storage.values.get(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY), text);
  assert.deepEqual(storage.writes, []);
  assert.equal(evaluateAnnouncementDraft(legacy).canGoLive, false);
  assert.equal(evaluateAnnouncementDraft(legacy).reviewReady, true);
  assert.equal(legacy.teacherReview.approved, true);
});

test("crew confirmations save locally by date without changing script approval or another date", () => {
  let draft = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  const original = structuredClone(draft);
  draft = setAnnouncementCrewCheck(draft, "announcer1", "homeroomConfirmed", true);
  draft = setAnnouncementCrewCheck(draft, "announcer1", "arrived", true);
  draft = setAnnouncementCrewCheck(draft, "announcer2", "lateNotified", true);
  assert.equal(draft.teacherReview.approved, true);
  assert.deepEqual(draft.script, original.script);
  const storage = memoryStorage();
  saveDatedAnnouncementDraft(storage, draft);
  saveDatedAnnouncementDraft(storage, createAnnouncementDraft({ date: "2026-09-04" }));
  assert.deepEqual(loadArchivedAnnouncementDraft(storage, draft.date), draft);
  assert.equal(loadArchivedAnnouncementDraft(storage, "2026-09-04").crew, undefined);
  assert.equal(storage.writes.every(([key]) => [ANNOUNCEMENT_LOCAL_STORAGE_KEY, ANNOUNCEMENT_ARCHIVE_STORAGE_KEY].includes(key)), true);
  assert.deepEqual(original.crew, getAnnouncementCrew(readyForTeacherReview()));
});

test("new date, opening names or manual crew reassignment cannot reuse earlier confirmations", () => {
  let draft = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  draft = setAnnouncementCrewCheck(draft, "announcer1", "homeroomConfirmed", true);
  draft = setAnnouncementCrewCheck(draft, "announcer2", "ready", true);
  draft = updateAnnouncementCrewTime(draft, "backup", "08:53");
  assert.equal(getAnnouncementCrew(updateAnnouncementDetails(draft, { date: draft.date })).announcers.announcer1.homeroomConfirmed, true);
  const newDate = updateAnnouncementDetails(draft, { date: "2026-09-04" });
  const newNames = updateAnnouncementSection(draft, "opening", "Announcer 1: My name is another approved first name.");
  const reassigned = resetAnnouncementCrew(draft);
  for (const reset of [newDate, newNames, reassigned]) {
    assert.equal(Object.values(reset.crew.announcers).flatMap(Object.values).every((value) => value === false), true);
    assert.equal(reset.crew.times.backup, "08:53");
    assert.equal(evaluateAnnouncementDraft(reset).canGoLive, false);
  }
  assert.equal(reassigned.teacherReview.approved, true);
  assert.deepEqual(reassigned.checklist, draft.checklist);
  assert.equal(newDate.teacherReview.approved, false);
  assert.equal(newNames.teacherReview.approved, false);
  assert.equal(getAnnouncementCrew(draft).announcers.announcer1.homeroomConfirmed, true);
});

test("a backup starts with fresh homeroom arrival and readiness confirmations and does not disturb the other role", () => {
  let draft = createAnnouncementDraft({ date: "2026-09-03" });
  for (const slot of ["announcer1", "announcer2"]) {
    for (const check of ["homeroomConfirmed", "arrived", "ready", "teacherCovers"]) draft = setAnnouncementCrewCheck(draft, slot, check, true);
  }
  const backup = setAnnouncementCrewCheck(draft, "announcer1", "backupActive", true);
  assert.deepEqual(backup.crew.announcers.announcer2, draft.crew.announcers.announcer2);
  assert.deepEqual(backup.crew.announcers.announcer1, {
    homeroomConfirmed: false, arrived: false, ready: false, lateNotified: false, teacherCovers: false, backupActive: true
  });
  const confirmed = setAnnouncementCrewCheck(backup, "announcer1", "homeroomConfirmed", true);
  assert.equal(setAnnouncementCrewCheck(confirmed, "announcer1", "backupActive", true).crew.announcers.announcer1.homeroomConfirmed, true);
  assert.equal(setAnnouncementCrewCheck(confirmed, "announcer1", "backupActive", false).crew.announcers.announcer1.homeroomConfirmed, false);
});

test("crew controls admit only boolean role checks and valid ordered times without student identities", () => {
  const draft = createAnnouncementDraft({ date: "2026-09-03" });
  assert.throws(() => setAnnouncementCrewCheck(draft, "person", "arrived", true), /valid private crew check/);
  assert.throws(() => setAnnouncementCrewCheck(draft, "announcer1", "name", "PRIVATE_STUDENT"), /valid private crew check/);
  assert.throws(() => setAnnouncementCrewCheck(draft, "announcer1", "arrived", "true"), /valid private crew check/);
  assert.throws(() => updateAnnouncementCrewTime(draft, "backup", "08:56"), /times in that order/);
  assert.throws(() => updateAnnouncementCrewTime(draft, "arrival", "24:00"), /times in that order/);
  assert.throws(() => updateAnnouncementCrewTime(draft, "unknown", "08:51"), /valid crew time/);
  const withCrew = setAnnouncementCrewCheck(draft, "announcer1", "arrived", true);
  withCrew.crew.studentName = "PRIVATE_STUDENT";
  withCrew.crew.announcers.announcer1.name = "PRIVATE_STUDENT";
  assert.equal(JSON.stringify(admitAnnouncementDraft(withCrew)).includes("PRIVATE_STUDENT"), false);
});

test("Go live requires current confirmations for both roles or explicit teacher-arranged coverage", () => {
  const approved = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  assert.equal(evaluateAnnouncementDraft(approved).canGoLive, true);
  let draft = setAnnouncementCrewCheck(approved, "announcer1", "backupActive", true);
  assert.equal(draft.teacherReview.approved, true);
  assert.equal(evaluateAnnouncementDraft(draft).crewReady, false);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
  assert.throws(() => setAnnouncementCheck(draft, "go-live", "broadcastComplete", true), /current crew confirmations/);
  for (const field of ["arrived", "ready"]) draft = setAnnouncementCrewCheck(draft, "announcer1", field, true);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
  draft = setAnnouncementCrewCheck(draft, "announcer1", "homeroomConfirmed", true);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, true);
  draft = setAnnouncementCrewCheck(draft, "announcer2", "arrived", false);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
  draft = setAnnouncementCrewCheck(draft, "announcer2", "teacherCovers", true);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, true);
  draft = setAnnouncementCrewCheck(draft, "announcer2", "teacherCovers", false);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
});

test("the ECMS outline follows the approved two-announcer order with the full pledge and selected date", () => {
  const original = createAnnouncementDraft({ date: "2026-10-15", targetMinutes: 4 });
  const draft = applyEcmsAnnouncementOutline(original);
  const script = Object.values(draft.script).join("\n");
  const orderedCues = [
    "Good morning, ECMS! Today is Thursday, October 15, 2026.",
    "cycle day [[CYCLE DAY]]", "Announcer 1: My name is [[ANNOUNCER 1 FIRST NAME]]", "Announcer 2: And my name is [[ANNOUNCER 2 FIRST NAME]]",
    "Announcer 2: Please rise for a moment of silence, followed by the Pledge of Allegiance.", "at least 20 seconds",
    "[Wait 5 seconds before Announcer 1 begins.]",
    "Announcer 1: I pledge allegiance to the flag of the United States of America, and to the republic for which it stands, one nation under God, indivisible, with liberty and justice for all.",
    "Announcer 2: Thank you. You may be seated.", "Announcer 1: Here are today's announcements.", "[[HEATHER'S REQUIRED NOTICES]]", "[[EMILY'S REQUIRED NOTICES]]",
    "Announcer 2: For lunch today, we are having", "Announcer 1: A reminder:", "[[OPTIONAL REMINDER OR DELETE THIS LINE]]",
    "Announcer 2: That's all for today's announcements.", "Announcer 1: Have a great day of learning, ECMS!"
  ];
  let position = -1;
  for (const cue of orderedCues) {
    const found = script.indexOf(cue);
    assert.ok(found > position, `Ordered cue: ${cue}`);
    position = found;
  }
  assert.equal(draft.timing.targetMinutes, 4);
  assert.equal(script.split("[Wait 5 seconds before Announcer 1 begins.]").length - 1, 1);
  assert.equal(script.split("[Pause silently for at least 20 seconds.]").length - 1, 1);
  assert.equal(draft.scope, "local-only");
  assert.equal(draft.teacherReview.approved, false);
  assert.equal(hasAnnouncementScript(original), false);
  assert.equal(hasAnnouncementScript(draft), true);
  assert.throws(() => applyEcmsAnnouncementOutline(createAnnouncementDraft()), /Choose the announcement date/);
});

test("an outline cannot overwrite existing wording without explicit choice and never keeps prior approval", () => {
  const original = setAnnouncementTeacherReview(readyForTeacherReview(), true);
  const snapshot = structuredClone(original);
  assert.throws(() => applyEcmsAnnouncementOutline(original), /Confirm before replacing/);
  assert.throws(() => applyEcmsAnnouncementOutline(original, { replaceExisting: "false" }), /Confirm before replacing/);
  assert.deepEqual(original, snapshot);
  const replaced = applyEcmsAnnouncementOutline(original, { replaceExisting: true });
  assert.equal(replaced.teacherReview.approved, false);
  assert.equal(replaced.timing.rehearsalSeconds, null);
  assert.equal(evaluateAnnouncementDraft(replaced).prepareComplete, false);
  assert.equal(evaluateAnnouncementDraft(replaced).rehearseComplete, false);
  assert.deepEqual(original, snapshot);
});

test("outline placeholders block teacher review and live even after all preparation checks are complete", () => {
  let draft = applyEcmsAnnouncementOutline(readyForTeacherReview(), { replaceExisting: true });
  for (const phase of ["prepare", "rehearse"]) {
    for (const item of Object.keys(draft.checklist[phase])) draft = setAnnouncementCheck(draft, phase, item, true);
  }
  assert.equal(evaluateAnnouncementDraft(draft).reviewReady, false);
  assert.equal(evaluateAnnouncementDraft(draft).errors.filter(({ code }) => code === "outline-placeholder-unresolved").length, 4);
  assert.throws(() => setAnnouncementTeacherReview(draft, true), /Finish the script/);
  assert.throws(() => setAnnouncementCheck(draft, "go-live", "broadcastComplete", true), /Teacher approval/);
  for (const [section, text] of Object.entries(draft.script)) {
    draft = updateAnnouncementSection(draft, section, text.replace(/\[\[[^\]]*\]\]/g, "Approved broadcast wording"));
  }
  assert.equal(evaluateAnnouncementDraft(draft).reviewReady, true);
  draft = setAnnouncementTeacherReview(draft, true);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
  for (const slot of ["announcer1", "announcer2"]) {
    for (const field of ["homeroomConfirmed", "arrived", "ready"]) draft = setAnnouncementCrewCheck(draft, slot, field, true);
  }
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, true);
  draft = updateAnnouncementSection(draft, "weather", "[[NEW REMINDER]]");
  assert.equal(draft.teacherReview.approved, false);
  assert.equal(evaluateAnnouncementDraft(draft).canGoLive, false);
});

test("selecting another date updates the generated ECMS date cue and preserves other edits", () => {
  let draft = applyEcmsAnnouncementOutline(createAnnouncementDraft({ date: "2026-10-15" }));
  draft = updateAnnouncementSection(draft, "closing", "A teacher-edited closing.");
  draft = updateAnnouncementDetails(draft, { date: "2026-10-16" });
  assert.match(draft.script.opening, /Friday, October 16, 2026/);
  assert.doesNotMatch(draft.script.opening, /October 15/);
  assert.equal(draft.script.closing, "A teacher-edited closing.");
  draft = updateAnnouncementDetails(draft, { date: "" });
  assert.match(draft.script.opening, /\[\[ANNOUNCEMENT DATE\]\]/);
  draft = updateAnnouncementDetails(draft, { date: "2027-01-04" });
  assert.match(draft.script.opening, /Monday, January 4, 2027/);
  assert.equal(draft.teacherReview.approved, false);
});

test("partial and multiline outline markers cannot bypass teacher review", () => {
  for (const unresolved of ["[[UNRESOLVED\nNOTICE]]", "[[UNRESOLVED NOTICE]", "[[UNRESOLVED NOTICE", "UNRESOLVED NOTICE]]"]) {
    const draft = updateAnnouncementSection(readyForTeacherReview(), "weather", unresolved);
    assert.equal(evaluateAnnouncementDraft(draft).reviewReady, false, unresolved);
    assert.throws(() => setAnnouncementTeacherReview(draft, true), /Finish the script/, unresolved);
  }
});

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
    /Teacher approval and current crew confirmations/
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


test("five dated broadcasts survive reload, same-date update, and clearing only the working draft", () => {
  const storage = memoryStorage({ unrelated: "keep" });
  const expected = {};
  for (let day = 14; day <= 18; day += 1) {
    let draft = updateAnnouncementDetails(readyForTeacherReview(), { date: `2026-09-${day}` });
    draft = updateAnnouncementSection(draft, "weather", `Approved notice for September ${day}.`);
    draft = setAnnouncementTeacherReview(draft, true);
    expected[draft.date] = draft;
    saveDatedAnnouncementDraft(storage, draft);
  }
  const reloaded = memoryStorage(Object.fromEntries(storage.values));
  assert.equal(loadLocalAnnouncementArchive(reloaded).status, "saved");
  assert.deepEqual(loadLocalAnnouncementArchive(reloaded).archive.drafts, expected);
  const beforeReads = reloaded.writes.length;
  for (const [date, draft] of Object.entries(expected)) {
    assert.deepEqual(loadArchivedAnnouncementDraft(reloaded, date), draft);
  }
  assert.equal(reloaded.writes.length, beforeReads);
  const changed = updateAnnouncementSection(expected["2026-09-16"], "closing", "A revised approved closing.");
  saveDatedAnnouncementDraft(reloaded, changed);
  expected[changed.date] = changed;
  assert.deepEqual(loadLocalAnnouncementArchive(reloaded).archive.drafts, expected);
  assert.equal(loadArchivedAnnouncementDraft(reloaded, changed.date).teacherReview.approved, false);
  clearLocalAnnouncementDraft(reloaded);
  assert.equal(reloaded.getItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY), null);
  assert.deepEqual(loadLocalAnnouncementArchive(reloaded).archive.drafts, expected);
  assert.equal(reloaded.getItem("unrelated"), "keep");
});

test("archive save reads the latest dates and leaves malformed or mismatched records untouched", () => {
  const storage = memoryStorage();
  saveDatedAnnouncementDraft(storage, readyForTeacherReview());
  const second = updateAnnouncementDetails(readyForTeacherReview(), { date: "2026-09-04" });
  saveDatedAnnouncementDraft(storage, second);
  assert.equal(Object.keys(loadLocalAnnouncementArchive(storage).archive.drafts).length, 2);
  const healthy = JSON.parse(storage.getItem(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY));
  const mismatched = structuredClone(healthy);
  mismatched.drafts["2026-09-03"].date = "2026-09-05";
  const partial = structuredClone(healthy);
  delete partial.drafts["2026-09-03"].script.opening;
  for (const raw of ["{bad", JSON.stringify(mismatched), JSON.stringify(partial)]) {
    const invalid = memoryStorage({ [ANNOUNCEMENT_ARCHIVE_STORAGE_KEY]: raw, [ANNOUNCEMENT_LOCAL_STORAGE_KEY]: "legacy untouched", unrelated: "keep" });
    assert.equal(loadLocalAnnouncementArchive(invalid).status, "invalid");
    assert.throws(() => saveDatedAnnouncementDraft(invalid, second), /left untouched/i);
    assert.throws(() => loadArchivedAnnouncementDraft(invalid, second.date), /left untouched/i);
    assert.equal(invalid.getItem(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY), raw);
    assert.equal(invalid.getItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY), "legacy untouched");
    assert.equal(invalid.writes.length, 0);
  }
  assert.throws(() => saveDatedAnnouncementDraft(storage, createAnnouncementDraft()), /Choose a valid announcement date/);
  assert.throws(() => loadArchivedAnnouncementDraft(storage, "2026-02-30"), /Choose a valid announcement date/);
});

test("archive save failures preserve prior dated copies and the legacy working value", () => {
  const original = memoryStorage();
  saveDatedAnnouncementDraft(original, readyForTeacherReview());
  const before = new Map(original.values);
  const second = updateAnnouncementDetails(readyForTeacherReview(), { date: "2026-09-04" });
  for (const failedKey of [ANNOUNCEMENT_ARCHIVE_STORAGE_KEY, ANNOUNCEMENT_LOCAL_STORAGE_KEY]) {
    const storage = memoryStorage(Object.fromEntries(before));
    const write = storage.setItem;
    storage.setItem = (key, value) => { if (key === failedKey) throw new Error("storage-denied"); write(key, value); };
    assert.throws(() => saveDatedAnnouncementDraft(storage, second), /could not be saved/i);
    assert.deepEqual(storage.values, before);
  }
});

test("legacy loading stays unchanged and the next dated save preserves its earlier date", () => {
  const legacy = readyForTeacherReview();
  const storage = memoryStorage({ [ANNOUNCEMENT_LOCAL_STORAGE_KEY]: JSON.stringify(legacy), unrelated: "keep" });
  assert.deepEqual(loadLocalAnnouncementDraft(storage).draft, legacy);
  assert.equal(loadLocalAnnouncementArchive(storage).status, "empty");
  assert.equal(storage.writes.length, 0);
  const next = updateAnnouncementDetails(legacy, { date: "2026-09-04" });
  saveDatedAnnouncementDraft(storage, next);
  assert.deepEqual(loadLocalAnnouncementArchive(storage).archive.drafts, { [legacy.date]: legacy, [next.date]: next });
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("a full dated library refuses another date without evicting or changing any saved value", () => {
  const archive = { format: "circ.announcements.archive.v1", version: 1, scope: "local-only", drafts: {} };
  for (let day = 0; day < 1000; day += 1) {
    const date = new Date(Date.UTC(2023, 0, 1 + day)).toISOString().slice(0, 10);
    archive.drafts[date] = createAnnouncementDraft({ date });
  }
  const storage = memoryStorage({
    [ANNOUNCEMENT_ARCHIVE_STORAGE_KEY]: JSON.stringify(archive),
    [ANNOUNCEMENT_LOCAL_STORAGE_KEY]: JSON.stringify(archive.drafts["2023-01-01"]), unrelated: "keep"
  });
  const before = new Map(storage.values);
  assert.equal(loadLocalAnnouncementArchive(storage).status, "saved");
  assert.throws(() => saveDatedAnnouncementDraft(storage, createAnnouncementDraft({ date: "2026-09-03" })), /library is full.*No dated copies were removed or overwritten/);
  assert.deepEqual(storage.values, before);
  assert.equal(storage.writes.length, 0);
});
