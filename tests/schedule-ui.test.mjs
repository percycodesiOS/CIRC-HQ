import assert from "node:assert/strict";
import test from "node:test";

import { buildScheduleEditor } from "../src/ui/schedule-editor.js";

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
    this.files = [];
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
    if (!this.hasAttribute("disabled")) {
      this.listeners.get("click")?.({ currentTarget: this });
    }
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

function scheduleDraft(overrides = {}) {
  return {
    teacherName: "Teacher Alpha",
    firstSchoolDate: "2026-08-20",
    lastSchoolDate: "2027-06-04",
    anchorCycleDay: 1,
    days: {
      1: [
        {
          id: "morning-duty",
          type: "duty",
          label: "Morning duty, Area 1",
          start: "08:10",
          end: "08:35"
        },
        {
          id: "homeroom-501",
          type: "teach",
          label: "Grade 5, Room 501",
          start: "09:05",
          end: "09:40"
        }
      ],
      2: [],
      3: [],
      4: [],
      5: []
    },
    ...overrides
  };
}

function callbacksDouble() {
  const calls = [];
  const callbackNames = [
    "onTeacherNameChange",
    "onFirstSchoolDateChange",
    "onLastSchoolDateChange",
    "onAnchorCycleDayChange",
    "onSelectCycleDay",
    "onAddEvent",
    "onEventChange",
    "onDuplicateEvent",
    "onRemoveEvent",
    "onCopyTargetChange",
    "onCopyDay",
    "onSave",
    "onCancel",
    "onRestoreBackup"
  ];
  const callbacks = Object.fromEntries(callbackNames.map((name) => [name, (...args) => {
    calls.push([name, ...args]);
  }]));
  return { callbacks, calls };
}

test("schedule editor presents school dates, cycle-day tabs, and visible event rows in teacher language", () => {
  const { callbacks } = callbacksDouble();
  const view = buildScheduleEditor({
    draft: scheduleDraft(),
    selectedCycleDay: 1,
    errors: [],
    callbacks
  }, { document: documentDouble });

  const teacherName = findAll(view, (node) => node.getAttribute("name") === "teacher-name")[0];
  assert.equal(teacherName.value, "Teacher Alpha");
  assert.match(textOf(view), /First school day/);
  assert.match(textOf(view), /Last school day/);
  assert.match(textOf(view), /Cycle day on the first school day/);
  assert.equal(
    findAll(view, (node) => node.getAttribute("name") === "event-label-morning-duty")[0].value,
    "Morning duty, Area 1"
  );
  assert.equal(
    findAll(view, (node) => node.getAttribute("name") === "event-label-homeroom-501")[0].value,
    "Grade 5, Room 501"
  );
  assert.match(textOf(view), /Starts/);
  assert.match(textOf(view), /Ends/);

  const tabList = findAll(view, (node) => node.getAttribute("role") === "tablist")[0];
  const tabs = findAll(tabList, (node) => node.getAttribute("role") === "tab");
  assert.deepEqual(tabs.map((tab) => tab.textContent), ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"]);
  assert.equal(tabs[0].getAttribute("aria-selected"), "true");
  assert.equal(tabs[0].getAttribute("tabindex"), "0");
  assert.equal(tabs[1].getAttribute("tabindex"), "-1");
  const heading = findAll(view, (node) => node.tagName === "h1")[0];
  const panel = findAll(view, (node) => node.getAttribute("role") === "tabpanel")[0];
  assert.equal(heading.getAttribute("id"), "schedule-editor-heading");
  assert.equal(panel.getAttribute("id"), "schedule-day-1-panel");
  assert.equal(panel.getAttribute("aria-labelledby"), tabs[0].getAttribute("id"));

  for (const label of ["Add class", "Add prep", "Add lunch", "Add support", "Add duty"]) {
    assert.ok(findByText(view, "button", label), label);
  }
  assert.match(textOf(view), /Copy to Day 2/);
  assert.match(textOf(view), /Save schedule/);
  assert.match(textOf(view), /Cancel/);
  assert.equal(findAll(view, (node) => node.tagName === "button" && node.textContent === "Duplicate").length, 2);
  assert.equal(findAll(view, (node) => node.tagName === "button" && node.textContent === "Remove").length, 2);
  assert.match(textOf(view), /Copy this day to/);

  const advanced = findAll(view, (node) => node.tagName === "details")[0];
  assert.ok(advanced);
  assert.equal(advanced.hasAttribute("open"), false);
  assert.equal(findByText(advanced, "summary", "Advanced backup").textContent, "Advanced backup");
  assert.match(textOf(advanced), /Restore a CIRC backup/);
  assert.equal(findAll(advanced, (node) => node.tagName === "input" && node.getAttribute("type") === "file").length, 1);

  assert.doesNotMatch(textOf(view), /JSON|schema|migration/i);
});

test("schedule editor wires plain controls and keyboard tabs to the supplied callbacks", () => {
  const { callbacks, calls } = callbacksDouble();
  const view = buildScheduleEditor({
    draft: scheduleDraft(),
    selectedCycleDay: 1,
    copyTargetDay: 2,
    errors: [],
    callbacks
  }, { document: documentDouble });

  const teacherName = findAll(view, (node) => node.getAttribute("name") === "teacher-name")[0];
  teacherName.value = "Teacher Beta";
  teacherName.listeners.get("input")?.({ currentTarget: teacherName });
  const firstDate = findAll(view, (node) => node.getAttribute("name") === "first-school-date")[0];
  firstDate.value = "2026-08-21";
  firstDate.listeners.get("input")?.({ currentTarget: firstDate });
  const lastDate = findAll(view, (node) => node.getAttribute("name") === "last-school-date")[0];
  lastDate.value = "2027-06-05";
  lastDate.listeners.get("input")?.({ currentTarget: lastDate });
  const anchorDay = findAll(view, (node) => node.getAttribute("name") === "anchor-cycle-day")[0];
  anchorDay.value = "2";
  anchorDay.listeners.get("change")?.({ currentTarget: anchorDay });

  const dayTabs = findAll(view, (node) => node.getAttribute("role") === "tab");
  dayTabs[2].click();
  dayTabs[0].listeners.get("keydown")?.({ key: "ArrowRight", preventDefault() {} });
  dayTabs[0].listeners.get("keydown")?.({ key: "ArrowLeft", preventDefault() {} });
  dayTabs[0].listeners.get("keydown")?.({ key: "End", preventDefault() {} });

  for (const label of ["Add class", "Add prep", "Add lunch", "Add support", "Add duty"]) {
    findByText(view, "button", label).click();
  }

  const labelInput = findAll(view, (node) => node.getAttribute("name") === "event-label-morning-duty")[0];
  labelInput.value = "Dismissal duty, Area 1";
  labelInput.listeners.get("input")?.({ currentTarget: labelInput });
  const typeInput = findAll(view, (node) => node.getAttribute("name") === "event-type-morning-duty")[0];
  typeInput.value = "support";
  typeInput.listeners.get("change")?.({ currentTarget: typeInput });
  const startInput = findAll(view, (node) => node.getAttribute("name") === "event-start-morning-duty")[0];
  startInput.value = "14:50";
  startInput.listeners.get("input")?.({ currentTarget: startInput });
  const endInput = findAll(view, (node) => node.getAttribute("name") === "event-end-morning-duty")[0];
  endInput.value = "15:25";
  endInput.listeners.get("input")?.({ currentTarget: endInput });

  findAll(view, (node) => node.getAttribute("name") === "copy-target-day")[0].listeners.get("change")?.({ currentTarget: { value: "4" } });
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Duplicate")[0].click();
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Remove")[0].click();
  findByText(view, "button", "Copy to Day 2").click();
  findByText(view, "button", "Save schedule").click();
  findByText(view, "button", "Cancel").click();

  const restoreInput = findAll(view, (node) => node.getAttribute("type") === "file")[0];
  const backupFile = { name: "circ-backup" };
  restoreInput.files = [backupFile];
  restoreInput.listeners.get("change")?.({ currentTarget: restoreInput });

  assert.deepEqual(calls, [
    ["onTeacherNameChange", "Teacher Beta"],
    ["onFirstSchoolDateChange", "2026-08-21"],
    ["onLastSchoolDateChange", "2027-06-05"],
    ["onAnchorCycleDayChange", 2],
    ["onSelectCycleDay", 3],
    ["onSelectCycleDay", 2],
    ["onSelectCycleDay", 5],
    ["onSelectCycleDay", 5],
    ["onAddEvent", 1, "teach"],
    ["onAddEvent", 1, "prep"],
    ["onAddEvent", 1, "lunch"],
    ["onAddEvent", 1, "support"],
    ["onAddEvent", 1, "duty"],
    ["onEventChange", 1, "morning-duty", "label", "Dismissal duty, Area 1"],
    ["onEventChange", 1, "morning-duty", "type", "support"],
    ["onEventChange", 1, "morning-duty", "start", "14:50"],
    ["onEventChange", 1, "morning-duty", "end", "15:25"],
    ["onCopyTargetChange", 4],
    ["onDuplicateEvent", 1, "morning-duty"],
    ["onRemoveEvent", 1, "morning-duty"],
    ["onCopyDay", 1, 2],
    ["onSave"],
    ["onCancel"],
    ["onRestoreBackup", backupFile]
  ]);
});

test("schedule editor shows actionable errors and sample guidance for an empty day", () => {
  const { callbacks } = callbacksDouble();
  const view = buildScheduleEditor({
    draft: scheduleDraft(),
    selectedCycleDay: 4,
    errors: ["Add an end time after the start time."],
    callbacks
  }, { document: documentDouble });

  const alert = findAll(view, (node) => node.getAttribute("role") === "alert")[0];
  assert.ok(alert);
  assert.match(textOf(alert), /Add an end time after the start time\./);
  assert.match(textOf(view), /Day 4 is empty/);
  assert.match(textOf(view), /Example: add morning duty, each class, prep, lunch, support, and dismissal duty in time order\./);
  assert.doesNotMatch(textOf(view), /JSON|schema|migration/i);
});
