import assert from "node:assert/strict";
import test from "node:test";
import { buildStudentStudio, STUDENT_STUDIO_DESKS, STUDENT_STUDIO_LINKS } from "../src/ui/student-studio.js";

test("student production desks show reviewed instructions without accepting private content or media", () => {
  const calls = [];
  for (const desk of STUDENT_STUDIO_DESKS) {
    for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
      const view = buildStudentStudio({
        deskId: desk.id, stepIndex,
        draft: { script: { opening: "PRIVATE_STUDENT_SCRIPT" } },
        crew: { name: "PRIVATE_CREW_NAME" },
        onStep: value => calls.push(["step", value]),
        onDesk: value => calls.push(["desk", value]),
        onExit: () => calls.push(["exit"])
      }, { document: documentDouble });
      assert.match(textOf(view), new RegExp(`Step ${stepIndex + 1} of 3`));
      assert.match(textOf(view), /Bring back:/);
      assert.doesNotMatch(textOf(view), /PRIVATE_STUDENT_SCRIPT|PRIVATE_CREW_NAME|Kenny|does not collect names/);
      assert.match(textOf(view), /The Morning Ehrman Show/);
      assert.match(textOf(view), /STUDENT VIEW/);
      assert.equal(findAll(view, node => ["input", "textarea", "video", "iframe"].includes(node.tagName)).length, 0);
      const next = findByText(view, "button", "Next step");
      if (stepIndex < 2) { next.click(); assert.deepEqual(calls.at(-1), ["step", stepIndex + 1]); }
      else { assert.equal(next, undefined); assert.match(textOf(view), /Bring your work to your teacher for review/); }
      for (const link of findAll(view, node => node.tagName === "a")) {
        assert.ok(Object.values(STUDENT_STUDIO_LINKS).includes(link.getAttribute("href")));
        assert.equal(link.getAttribute("target"), "_blank");
        assert.equal(link.getAttribute("rel"), "noopener noreferrer");
      }
    }
  }
  const weather = buildStudentStudio({ deskId: "weather", stepIndex: 99 }, { document: documentDouble });
  assert.match(textOf(weather), /Step 3 of 3/);
  assert.match(textOf(weather), /Cranberry Township forecast/);
  assert.match(textOf(weather), /Pittsburgh radar map/);
  const video = buildStudentStudio({ deskId: "unrecognized", stepIndex: -1 }, { document: documentDouble });
  assert.match(textOf(video), /Step 1 of 3/);
  assert.match(textOf(video), /One camera. Three shots./);
  assert.match(textOf(video), /15-45-second/);
});

import {
  applyEcmsAnnouncementOutline,
  applyPreparedEcmsAnnouncement,
  createAnnouncementDraft,
  setAnnouncementCheck,
  setAnnouncementCrewCheck,
  setAnnouncementTeacherReview,
  updateAnnouncementSection
} from "../src/model/announcements.js";
import {
  buildAnnouncementsLiveView,
  buildAnnouncementsWorkflow
} from "../src/ui/announcements.js";

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
    this.checked = false;
  }

  append(...children) {
    this.children.push(...children.filter(Boolean));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  click() {
    if (!this.hasAttribute("disabled")) this.listeners.get("click")?.({ currentTarget: this });
  }
}

const documentDouble = {
  createElement: (tagName) => new FakeNode(tagName)
};

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
}

function findAll(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  for (const child of node.children) findAll(child, predicate, found);
  return found;
}

function findByText(root, tagName, text) {
  return findAll(root, (node) => node.tagName === tagName && textOf(node) === text)[0];
}

function callbacksDouble() {
  const calls = [];
  const names = [
    "onDetailChange",
    "onCrewCheckChange",
    "onCrewTimeChange",
    "onCrewReset",
    "onUseEcmsOutline",
    "onUsePreparedEcms",
    "onSectionChange",
    "onChecklistChange",
    "onTeacherReviewChange",
    "onSaveLocalDraft",
    "onLoadSavedDraft",
    "onClearLocalDraft",
    "onGoLive"
  ];
  return {
    calls,
    callbacks: Object.fromEntries(names.map((name) => [name, (...args) => calls.push([name, ...args])]))
  };
}

function approvedDraft() {
  let draft = createAnnouncementDraft({ date: "2026-09-03" });
  draft = updateAnnouncementSection(draft, "opening", "Good morning.");
  draft = updateAnnouncementSection(draft, "closing", "Have a good day.");
  for (const itemId of ["crewAssigned", "scriptReady", "factsChecked"]) {
    draft = setAnnouncementCheck(draft, "prepare", itemId, true);
  }
  for (const itemId of ["fullRead", "timingChecked", "pronunciationsChecked"]) {
    draft = setAnnouncementCheck(draft, "rehearse", itemId, true);
  }
  for (const slot of ["announcer1", "announcer2"]) {
    for (const field of ["homeroomConfirmed", "arrived", "ready"]) draft = setAnnouncementCrewCheck(draft, slot, field, true);
  }
  return setAnnouncementTeacherReview(draft, true);
}

test("private crew controls expose affirmations and manual cutoffs without putting attendance into broadcast", () => {
  const { callbacks, calls } = callbacksDouble();
  let draft = approvedDraft();
  draft = setAnnouncementCrewCheck(draft, "announcer1", "backupActive", true);
  draft = setAnnouncementCrewCheck(draft, "announcer2", "teacherCovers", true);
  const view = buildAnnouncementsWorkflow({ draft, callbacks }, { document: documentDouble });
  const text = textOf(view);
  assert.match(text, /student affirmation, not official school attendance/);
  assert.match(text, /before coming to CIRC/);
  assert.match(text, /8:50 a.m./);
  assert.match(text, /8:52 a.m./);
  assert.match(text, /8:54 a.m./);
  assert.match(text, /8:55 a.m./);
  assert.match(text, /does not send a message/);
  assert.match(text, /Teacher-editable workflow/);
  assert.match(text, /Announcer 1 \(backup\)/);
  assert.match(text, /Teacher-arranged coverage recorded/);
  const check = findAll(view, (node) => node.getAttribute("name") === "crew-announcer1-homeroomConfirmed")[0];
  assert.equal(check.checked, false);
  check.checked = true;
  check.listeners.get("change")({ currentTarget: check });
  const time = findAll(view, (node) => node.getAttribute("name") === "crew-time-backup")[0];
  time.value = "08:53";
  time.listeners.get("input")({ currentTarget: time });
  findByText(view, "button", "Crew assignments changed: reset checks").click();
  assert.deepEqual(calls, [
    ["onCrewCheckChange", "announcer1", "homeroomConfirmed", true],
    ["onCrewTimeChange", "backup", "08:53"],
    ["onCrewReset"]
  ]);
  assert.equal(findByText(view, "button", "Go live").hasAttribute("disabled"), true);
  assert.throws(() => buildAnnouncementsLiveView({ draft }, { document: documentDouble }), /announcement-live-review-required/);
  for (const field of ["homeroomConfirmed", "arrived", "ready"]) draft = setAnnouncementCrewCheck(draft, "announcer1", field, true);
  const live = buildAnnouncementsLiveView({ draft }, { document: documentDouble });
  assert.doesNotMatch(textOf(live), /homeroom|backup|late|crew check|coverage recorded|8:52|8:54|teacher covers/i);
  assert.equal(findAll(live, (node) => node.getAttribute("data-private-crew") === "true").length, 0);
  assert.equal(findAll(live, (node) => node.tagName === "input").length, 0);
});

test("the announcements screen explains the Grade 6 responsibility and stays public-safe by default", () => {
  const draft = createAnnouncementDraft();
  const { callbacks } = callbacksDouble();
  const view = buildAnnouncementsWorkflow({ draft, callbacks }, { document: documentDouble });
  const text = textOf(view);

  assert.match(text, /Grade 6 Morning Announcements/);
  assert.match(text, /rite-of-passage responsibility/i);
  assert.match(text, /Prepare Rehearse Go live Reset/);
  assert.match(text, /Producer/);
  assert.match(text, /Announcers \(2\)/);
  assert.match(text, /Reporters \(4\)/);
  assert.match(text, /Camera operators \(2\)/);
  assert.match(text, /Director: Teacher/);
  assert.match(text, /Assign roles in person or from a private teacher roster/i);
  assert.match(text, /This is a local draft on this device/i);
  assert.doesNotMatch(text, /private-person-sentinel|private-district-sentinel/i);
  assert.equal(findAll(view, (node) => node.getAttribute("name")?.includes("student-name")).length, 0);
});

test("ordinary fields cover date, student-safe script sections, and timing without invented copy", () => {
  const draft = createAnnouncementDraft();
  const { callbacks } = callbacksDouble();
  const view = buildAnnouncementsWorkflow({ draft, callbacks }, { document: documentDouble });

  const expectedFields = [
    ["announcement-date", "input", "date"],
    ["target-minutes", "input", "number"],
    ["rehearsal-seconds", "input", "number"],
    ["script-opening", "textarea", null],
    ["script-pledge-school-items", "textarea", null],
    ["script-birthdays-events", "textarea", null],
    ["script-weather", "textarea", null],
    ["script-closing", "textarea", null]
  ];
  for (const [name, tagName, type] of expectedFields) {
    const field = findAll(view, (node) => node.getAttribute("name") === name)[0];
    assert.ok(field, name);
    assert.equal(field.tagName, tagName, name);
    if (type) assert.equal(field.getAttribute("type"), type, name);
  }
  for (const sectionName of [
    "script-opening",
    "script-pledge-school-items",
    "script-birthdays-events",
    "script-weather",
    "script-closing"
  ]) {
    assert.equal(findAll(view, (node) => node.getAttribute("name") === sectionName)[0].value, "");
  }
  assert.match(textOf(view), /CIRC HQ does not invent pledge wording or school notices/i);
  assert.match(textOf(view), /Use only information approved for the school broadcast/i);
  assert.ok(findByText(view, "span", "Special events"));
  assert.match(textOf(view), /confirmed lunch information and special events approved for the broadcast/);
  assert.doesNotMatch(textOf(view), /birthday/i);
});

test("the screen wires each editable control and local action to supplied callbacks", () => {
  const draft = createAnnouncementDraft();
  const { callbacks, calls } = callbacksDouble();
  const view = buildAnnouncementsWorkflow({ draft, callbacks }, { document: documentDouble });

  const date = findAll(view, (node) => node.getAttribute("name") === "announcement-date")[0];
  date.value = "2026-09-03";
  date.listeners.get("input")?.({ currentTarget: date });
  const target = findAll(view, (node) => node.getAttribute("name") === "target-minutes")[0];
  target.value = "4";
  target.listeners.get("input")?.({ currentTarget: target });
  const rehearsal = findAll(view, (node) => node.getAttribute("name") === "rehearsal-seconds")[0];
  rehearsal.value = "173";
  rehearsal.listeners.get("input")?.({ currentTarget: rehearsal });
  const opening = findAll(view, (node) => node.getAttribute("name") === "script-opening")[0];
  opening.value = "Good morning.";
  opening.listeners.get("input")?.({ currentTarget: opening });
  const crewCheck = findAll(view, (node) => node.getAttribute("name") === "check-prepare-crewAssigned")[0];
  crewCheck.checked = true;
  crewCheck.listeners.get("change")?.({ currentTarget: crewCheck });
  const review = findAll(view, (node) => node.getAttribute("name") === "teacher-review")[0];
  review.checked = true;
  review.listeners.get("change")?.({ currentTarget: review });
  findByText(view, "button", "Save local draft").click();
  findByText(view, "button", "Start a blank draft").click();

  assert.deepEqual(calls, [
    ["onDetailChange", "date", "2026-09-03"],
    ["onDetailChange", "targetMinutes", 4],
    ["onDetailChange", "rehearsalSeconds", 173],
    ["onSectionChange", "opening", "Good morning."],
    ["onChecklistChange", "prepare", "crewAssigned", true],
    ["onSaveLocalDraft"],
    ["onClearLocalDraft"]
  ]);
});

test("the ECMS action is explicit and its unresolved editable script cannot enter review or live", () => {
  const actions = callbacksDouble();
  const empty = createAnnouncementDraft({ date: "2026-10-15" });
  const view = buildAnnouncementsWorkflow({ draft: empty, callbacks: actions.callbacks }, { document: documentDouble });
  findByText(view, "button", "Use ECMS outline").click();
  assert.deepEqual(actions.calls, [["onUseEcmsOutline"]]);
  assert.equal(empty.script.opening, "");

  const draft = applyEcmsAnnouncementOutline(empty);
  const outlined = buildAnnouncementsWorkflow({ draft, callbacks: actions.callbacks }, { document: documentDouble });
  assert.match(findAll(outlined, (node) => node.getAttribute("name") === "script-opening")[0].value, /October 15, 2026/);
  assert.match(findAll(outlined, (node) => node.getAttribute("name") === "script-pledge-school-items")[0].value, /HEATHER'S REQUIRED NOTICES/);
  assert.match(textOf(outlined), /Resolve every \[\[placeholder\]\]/);
  assert.match(textOf(outlined), /Go live shows the approved script, including speaker labels and pause cues/);
  assert.match(textOf(outlined), /share or mirror that screen, the audience sees the same view/);
  assert.match(textOf(outlined), /does not start the building's broadcast equipment/);
  assert.equal(findAll(outlined, (node) => node.getAttribute("name") === "teacher-review")[0].hasAttribute("disabled"), true);
  assert.equal(findByText(outlined, "button", "Go live").hasAttribute("disabled"), true);
  assert.throws(() => buildAnnouncementsLiveView({ draft, onExit: () => {} }, { document: documentDouble }), /announcement-live-review-required/);
});

test("prepared date buttons send explicit dates and Friday teacher guidance is absent from broadcast", () => {
  const actions = callbacksDouble();
  let draft = applyPreparedEcmsAnnouncement(createAnnouncementDraft(), "2026-09-11");
  const view = buildAnnouncementsWorkflow({ draft, callbacks: actions.callbacks }, { document: documentDouble });
  findByText(view, "button", "Load Friday, September 11 script").click();
  assert.deepEqual(actions.calls, [["onUsePreparedEcms", "2026-09-11"]]);
  assert.match(textOf(view), /reserve about 30 seconds/);
  assert.throws(() => buildAnnouncementsLiveView({ draft, onExit: () => {} }, { document: documentDouble }), /announcement-live-review-required/);
  for (const [section, value] of Object.entries(draft.script)) {
    draft = updateAnnouncementSection(draft, section, value.replace(/\[\[[^\]]+\]\]/g, "Approved wording"));
  }
  for (const phase of ["prepare", "rehearse"]) for (const item of Object.keys(draft.checklist[phase])) draft = setAnnouncementCheck(draft, phase, item, true);
  for (const slot of ["announcer1", "announcer2"]) draft = setAnnouncementCrewCheck(draft, slot, "teacherCovers", true);
  draft = setAnnouncementTeacherReview(draft, true);
  const live = buildAnnouncementsLiveView({ draft, onExit: () => {} }, { document: documentDouble });
  assert.match(textOf(live), /Approved wording/);
  assert.doesNotMatch(textOf(live), /Teacher preparation|reserve about 30 seconds|Load Friday|homeroom|crew checks|Tim and Ivan/i);
});

test("teacher review and go-live controls remain gated until the workflow says ready", () => {
  const draft = createAnnouncementDraft();
  const blockedCallbacks = callbacksDouble();
  const blocked = buildAnnouncementsWorkflow({ draft, callbacks: blockedCallbacks.callbacks }, { document: documentDouble });
  const blockedReview = findAll(blocked, (node) => node.getAttribute("name") === "teacher-review")[0];
  const blockedGoLive = findByText(blocked, "button", "Go live");

  assert.equal(blockedReview.hasAttribute("disabled"), true);
  assert.equal(blockedGoLive.hasAttribute("disabled"), true);
  blockedReview.checked = true;
  blockedReview.listeners.get("change")?.({ currentTarget: blockedReview });
  blockedGoLive.click();
  assert.deepEqual(blockedCallbacks.calls, []);

  const forged = buildAnnouncementsWorkflow({
    draft,
    assessment: { reviewReady: true, canGoLive: true, errors: [] },
    callbacks: blockedCallbacks.callbacks
  }, { document: documentDouble });
  assert.equal(findAll(forged, (node) => node.getAttribute("name") === "teacher-review")[0].hasAttribute("disabled"), true);
  assert.equal(findByText(forged, "button", "Go live").hasAttribute("disabled"), true);

  const readyCallbacks = callbacksDouble();
  const ready = buildAnnouncementsWorkflow({
    draft: approvedDraft(),
    callbacks: readyCallbacks.callbacks
  }, { document: documentDouble });
  const readyReview = findAll(ready, (node) => node.getAttribute("name") === "teacher-review")[0];
  const readyGoLive = findByText(ready, "button", "Go live");
  assert.equal(readyReview.hasAttribute("disabled"), false);
  assert.equal(readyGoLive.hasAttribute("disabled"), false);
  readyReview.checked = true;
  readyReview.listeners.get("change")?.({ currentTarget: readyReview });
  readyGoLive.click();
  assert.deepEqual(readyCallbacks.calls, [
    ["onTeacherReviewChange", true],
    ["onGoLive"]
  ]);
});

test("validation errors render as an accessible teacher review list", () => {
  const draft = createAnnouncementDraft();
  const { callbacks } = callbacksDouble();
  const view = buildAnnouncementsWorkflow({ draft, callbacks }, { document: documentDouble });
  const alert = findAll(view, (node) => node.getAttribute("role") === "alert")[0];

  assert.ok(alert);
  assert.equal(alert.getAttribute("aria-live"), "polite");
  assert.match(textOf(alert), /Choose the announcement date\./);
  assert.match(textOf(alert), /Write the opening\./);
  assert.match(textOf(alert), /Write the closing\./);
});

test("local save and recovery feedback is announced without changing the draft", () => {
  const draft = createAnnouncementDraft();
  const view = buildAnnouncementsWorkflow({
    draft,
    status: "Saved on this device only.",
    callbacks: callbacksDouble().callbacks
  }, { document: documentDouble });
  const statuses = findAll(view, (node) => node.getAttribute("role") === "status");

  assert.equal(statuses.some((node) => textOf(node) === "Saved on this device only."), true);
  assert.deepEqual(draft, createAnnouncementDraft());
});

test("saved dates expose explicit load actions and keep the browser-only boundary visible", () => {
  const { callbacks, calls } = callbacksDouble();
  const draft = approvedDraft();
  const savedArchive = { status: "saved", archive: { drafts: {
    "2026-09-04": createAnnouncementDraft({ date: "2026-09-04" }),
    "2026-09-03": draft
  } } };
  const view = buildAnnouncementsWorkflow({ draft, savedArchive, callbacks }, { document: documentDouble });
  const loads = findAll(view, (node) => node.getAttribute("aria-label")?.startsWith("Load broadcast "));
  assert.deepEqual(loads.map((node) => node.getAttribute("aria-label")), [
    "Load broadcast 2026-09-03", "Load broadcast 2026-09-04"
  ]);
  assert.match(textOf(view), /2026-09-03 · Teacher approved/);
  assert.match(textOf(view), /2026-09-04 · Needs teacher review/);
  assert.match(textOf(view), /in this browser on this device and do not sync/);
  loads[1].click();
  assert.deepEqual(calls, [["onLoadSavedDraft", "2026-09-04"]]);
  const invalid = buildAnnouncementsWorkflow({ draft, savedArchive: { ...savedArchive, status: "invalid" }, callbacks }, { document: documentDouble });
  assert.match(textOf(invalid), /could not be read and was left untouched/);
  assert.equal(findAll(invalid, (node) => node.getAttribute("aria-label")?.startsWith("Load broadcast ")).length, 0);
  assert.doesNotMatch(textOf(buildAnnouncementsLiveView({ draft }, { document: documentDouble })), /Saved broadcast dates|Load broadcast/);
});

test("the live view rejects an unapproved draft and exposes only the approved broadcast script", () => {
  assert.throws(
    () => buildAnnouncementsLiveView({
      draft: createAnnouncementDraft(),
      onExit: () => {}
    }, { document: documentDouble }),
    /announcement-live-review-required/
  );

  const calls = [];
  let draft = approvedDraft();
  draft = updateAnnouncementSection(draft, "weather", "Sunny and mild today.");
  draft = updateAnnouncementSection(draft, "birthdaysEvents", "For lunch today, use the confirmed menu.");
  draft = setAnnouncementTeacherReview(draft, true);
  const view = buildAnnouncementsLiveView({
    draft,
    onExit: () => calls.push("exit")
  }, { document: documentDouble });
  const text = textOf(view);

  assert.match(text, /Grade 6 Morning Announcements/);
  assert.match(text, /Good morning\./);
  assert.match(text, /Sunny and mild today\./);
  assert.match(text, /Have a good day\./);
  assert.ok(findByText(view, "h2", "Special events"));
  assert.match(text, /For lunch today, use the confirmed menu/);
  assert.doesNotMatch(text, /birthday/i);
  assert.doesNotMatch(text, /teacher review|local draft|crew roles|checklist/i);
  findByText(view, "button", "Exit broadcast view").click();
  assert.deepEqual(calls, ["exit"]);
});
