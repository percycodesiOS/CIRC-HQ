import assert from "node:assert/strict";
import test from "node:test";

import { renderApp } from "../src/app.js";
import { CLASS_PROGRESS_STORAGE_KEY, classPlace, guessGrade, loadClassProgress, saveClassPlace } from "../src/model/class-progress.js";
import { DATED_UPDATES_STORAGE_KEY } from "../src/model/dated-updates.js";
import { buildTeacherAgenda, buildTeacherHome, stateMessage } from "../src/ui/teacher-home.js";

class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
  }
  append(...children) { this.children.push(...children.filter(Boolean)); }
  replaceChildren(...children) { this.children = children.filter(Boolean); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { this.listeners.get("click")?.({ currentTarget: this }); }
  change(value) { this.value = value; this.listeners.get("change")?.({ currentTarget: this }); }
  querySelector(selector) {
    for (const child of this.children) { const found = child.querySelector?.(selector); if (found) return found; }
    return null;
  }
  focus() { this.focused = true; }
  cloneNode() { return new Node(this.tagName); }
  replaceWith() {}
}
const documentRef = { createElement: tag => new Node(tag), createElementNS: (_ns, tag) => new Node(tag) };
const textOf = node => [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
const findAll = (node, predicate, found = []) => { if (predicate(node)) found.push(node); node.children.forEach(child => findAll(child, predicate, found)); return found; };

function memoryStorage() {
  const map = new Map();
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map };
}

const TIMELINE = [
  { id: "t1", title: "PRIVATE_CLASS_ONE", type: "teach", startMinutes: 540, endMinutes: 575 },
  { id: "p1", title: "Prep", type: "prep", startMinutes: 600, endMinutes: 640 },
  { id: "d1", title: "Dismissal duty", type: "duty", startMinutes: 925, endMinutes: 940, dutyDetails: { location: "Front loop" } }
];

test("the agenda names before-first, now, transition, done, no-school and empty states", () => {
  const before = buildTeacherAgenda({ status: "upcoming", timeline: TIMELINE, nowMinutes: 500 });
  assert.equal(before.state, "before-first");
  assert.equal(before.next.title, "PRIVATE_CLASS_ONE");
  assert.match(stateMessage(before), /first block starts in 40 minutes/);
  const now = buildTeacherAgenda({ status: "current", timeline: TIMELINE, nowMinutes: 550 });
  assert.equal(now.state, "in-progress");
  assert.equal(now.next.title, "Prep");
  assert.deepEqual(now.later.map(item => item.title), ["Dismissal duty"]);
  assert.equal(now.later[0].place, "Front loop");
  const transition = buildTeacherAgenda({ status: "upcoming", timeline: TIMELINE, nowMinutes: 580 });
  assert.equal(transition.state, "transition");
  assert.match(stateMessage(transition), /Transition time. Next starts in 20 minutes/);
  assert.equal(buildTeacherAgenda({ status: "complete", timeline: TIMELINE, nowMinutes: 960 }).state, "done");
  const noSchool = buildTeacherAgenda({
    status: "no-cycle-day",
    timeline: [],
    nowMinutes: 480,
    dated: { items: [{ id: "x", title: "Training", kind: "meeting", startMinutes: 540, endMinutes: 600, status: "confirmed", conflicts: [], verifiedLabel: "Verified 1 hours ago", stale: false }] }
  });
  assert.equal(noSchool.next.title, "Training", "dated updates still show on a no-school day");
  assert.equal(buildTeacherAgenda({ status: "no-cycle-day", timeline: [], nowMinutes: 480 }).state, "no-school");
  assert.match(stateMessage(buildTeacherAgenda({ status: "no-cycle-day", timeline: [], nowMinutes: 480 })), /No school day on your saved calendar/);
  assert.match(stateMessage(buildTeacherAgenda({ status: "empty", timeline: [], nowMinutes: 480 }), { cycleDay: 3 }), /Nothing is entered for Day 3/);
});

test("tentative, conflicting and cancelled dated updates are visible on the teacher home", () => {
  const dated = {
    coverage: "checked",
    stale: true,
    freshness: "Dated updates checked 9 days ago, covering 2026-09-20 to 2026-10-09.",
    items: [
      { id: "u1", title: "Parent meeting", kind: "meeting", place: "Office", startMinutes: 610, endMinutes: 630, status: "tentative", conflicts: ["Prep"], verifiedLabel: "Verified 9 days ago", stale: true },
      { id: "u2", title: "Old training", kind: "meeting", startMinutes: 700, endMinutes: 720, status: "cancelled", conflicts: [], verifiedLabel: "Verified 9 days ago", stale: true }
    ]
  };
  const agenda = buildTeacherAgenda({ status: "current", timeline: TIMELINE, nowMinutes: 550, dated });
  const home = buildTeacherHome({ hasPlan: true, agenda, dated, classCard: null, runner: null }, {}, { documentRef });
  const text = textOf(home);
  assert.match(text, /Parent meeting/);
  assert.match(text, /Not confirmed/);
  assert.match(text, /Overlaps Prep/);
  assert.match(text, /Cancelled: Old training/);
  assert.match(text, /more than a week old/);
  const emptyChecked = buildTeacherHome({ hasPlan: true, agenda: buildTeacherAgenda({ timeline: TIMELINE, nowMinutes: 550 }), dated: { coverage: "checked", items: [], stale: false, freshness: "Dated updates checked just now." }, classCard: null, runner: null }, {}, { documentRef });
  assert.match(textOf(emptyChecked), /That is not proof there is nothing/);
  const none = buildTeacherHome({ hasPlan: true, agenda: buildTeacherAgenda({ timeline: TIMELINE, nowMinutes: 550 }), dated: { coverage: "none", items: [], stale: false, freshness: "" }, classCard: null, runner: null }, {}, { documentRef });
  assert.match(textOf(none), /appointments outside your schedule are not shown/);
});

test("without a schedule the teacher side offers one gentle setup step and still opens both playbooks", () => {
  const calls = [];
  const home = buildTeacherHome({ hasPlan: false }, { openSchedule: () => calls.push("schedule"), openPlaybook: id => calls.push(id) }, { documentRef });
  const text = textOf(home);
  assert.match(text, /Add your schedule once/);
  findAll(home, node => node.tagName === "button" && textOf(node) === "Set up my schedule")[0].click();
  findAll(home, node => node.tagName === "button" && /Playbook B/.test(textOf(node)))[0].click();
  assert.deepEqual(calls, ["schedule", "b"]);
});

test("class places are saved per class on this browser only and bad saves are left alone", () => {
  const storage = memoryStorage();
  assert.equal(guessGrade("5 Room"), 5);
  assert.equal(guessGrade("Grade 6 Blue"), 6);
  assert.equal(guessGrade("Homeroom 15"), null);
  const empty = loadClassProgress(storage, "teacher:alpha");
  assert.deepEqual(classPlace(empty.book, "class-1", "6 Room"), { playbook: "a", meeting: 3, grade: 6, option: null, saved: false });
  saveClassPlace(storage, "teacher:alpha", "class-1", { playbook: "a", meeting: 10, grade: 5 }, { now: new Date("2026-09-29T12:00:00Z") });
  const saved = classPlace(loadClassProgress(storage, "teacher:alpha").book, "class-1");
  assert.equal(saved.meeting, 10);
  assert.equal(saved.saved, true);
  assert.throws(() => saveClassPlace(storage, "teacher:alpha", "class-1", { playbook: "a", meeting: 99, grade: 5 }), /meeting that exists/);
  const key = `${CLASS_PROGRESS_STORAGE_KEY}:${encodeURIComponent("teacher:alpha")}`;
  storage.setItem(key, "{bad");
  assert.throws(() => saveClassPlace(storage, "teacher:alpha", "class-1", { playbook: "a", meeting: 3, grade: 5 }), /could not be read/);
  assert.equal(storage.getItem(key), "{bad");
});

function planState() {
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-09-29T12:00:00.000Z",
    plan: {
      format: "playbook.teacherPlan.v2",
      version: 1,
      calendar: { anchorDate: "2026-08-20", anchorDay: 1, lastDate: "2027-06-04", noSchool: [], conditionalMakeup: [], overrides: {} },
      teachers: [{
        id: "teacher-alpha",
        name: "Teacher Alpha",
        days: Object.fromEntries([1, 2, 3, 4, 5].map(day => [day, [
          { id: `event-h${"c".repeat(31)}${day}`, type: "teach", label: "PRIVATE_CLASS_ONE", start: "09:00", end: "09:35", classId: "class-one" },
          { id: `event-h${"b".repeat(31)}${day}`, type: "prep", label: "Prep", start: "10:00", end: "10:40" },
          { id: `event-h${"a".repeat(31)}${day}`, type: "teach", label: "PRIVATE_CLASS_TWO", start: "10:45", end: "11:20", classId: "class-two" }
        ]]))
      }],
      specialEvents: [],
      resources: []
    },
    teacherProgress: {},
    checklist: [],
    classes: [],
    lessonGuides: [],
    specialEvents: [],
    resources: [],
    notes: [],
    preferences: {},
    tombstones: []
  };
}

async function renderToday(storage, time = "2026-09-29T09:10:00-04:00") {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new Node("main");
  globalThis.document = { ...documentRef, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.window = { location: { hostname: "example.test" }, setInterval: () => 1, clearInterval: () => {}, fetch: async () => ({ ok: false }) };
  const restore = () => { globalThis.document = previousDocument; globalThis.window = previousWindow; };
  try {
    const controller = renderApp(root, {
      store: { load: () => ({ state: planState(), error: null }), save: value => value },
      loadPrivateSeed: false,
      weatherService: {},
      privateStorage: storage,
      cloudClient: { status: "not-configured" },
      clock: { now: () => new Date(time) }
    });
    await controller.ready.catch(() => {});
    return { root, controller: { destroy() { controller.destroy(); restore(); } } };
  } catch (error) {
    restore();
    throw error;
  }
}

test("Today opens on the simple teacher home with advanced tools collapsed", async () => {
  const storage = memoryStorage();
  const { root, controller } = await renderToday(storage);
  const text = textOf(root);
  assert.match(text, /Now/);
  assert.match(text, /PRIVATE_CLASS_ONE/);
  assert.match(text, /This class/);
  assert.match(text, /Canva logo 1: Start from a template/, "a new class starts at Playbook A meeting 2");
  assert.match(text, /Quick prep/);
  assert.match(text, /Later today/);
  assert.match(text, /Playbook A \(2026-27\)/);
  assert.match(text, /Playbook B \(2027-28\)/);
  const more = findAll(root, node => node.tagName === "details" && /today-more-tools/.test(node.className))[0];
  assert.ok(more, "More tools exists");
  assert.equal(more.getAttribute("open"), null, "More tools starts collapsed");
  const studentLink = findAll(root, node => node.tagName === "a" && textOf(node) === "Student page")[0];
  assert.equal(studentLink.getAttribute("href"), "student.html?playbook=a&meeting=3");
  const meetingSelect = findAll(root, node => node.getAttribute("id") === "th-class-meeting")[0];
  meetingSelect.change("5");
  const saved = JSON.parse(storage.getItem(`${CLASS_PROGRESS_STORAGE_KEY}:${encodeURIComponent("teacher:teacher-alpha")}`));
  assert.equal(saved.classes["class-one"].meeting, 5);
  assert.match(textOf(root), /Make a package that protects/);
  assert.equal(storage.getItem(DATED_UPDATES_STORAGE_KEY), null, "viewing Today never writes dated updates");
  controller.destroy();
});

test("between blocks Today shows a transition and the next class instead of inventing a current event", async () => {
  const { root, controller } = await renderToday(memoryStorage(), "2026-09-29T09:50:00-04:00");
  const text = textOf(root);
  assert.match(text, /Transition time. Next starts in 10 minutes/);
  assert.match(text, /Next class \| This class PRIVATE_CLASS_TWO/);
  controller.destroy();
});

test("a class that just ended stays on the card so it can be marked done", async () => {
  const { root, controller } = await renderToday(memoryStorage(), "2026-09-29T09:40:00-04:00");
  assert.match(textOf(root), /Just finished \| This class PRIVATE_CLASS_ONE/);
  assert.ok(findAll(root, node => node.tagName === "button" && textOf(node) === "Done. Next time: meeting 4")[0]);
  controller.destroy();
  const late = await renderToday(memoryStorage(), "2026-09-29T15:00:00-04:00");
  assert.match(textOf(late.root), /Earlier today \| This class PRIVATE_CLASS_TWO/);
  assert.match(textOf(late.root), /Your scheduled day is done/);
  late.controller.destroy();
});

// Review regressions: a mutable clock, a captured minute tick and a fake focus.
async function mountApp({ time, storage = memoryStorage(), confirm = () => true, noSchool = [] }) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new Node("main");
  const clock = { time: new Date(time) };
  let tick = null;
  const saves = [];
  const confirms = [];
  const fakeDocument = { ...documentRef, activeElement: null, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: () => {}, removeEventListener: () => {}, visibilityState: "visible" };
  globalThis.document = fakeDocument;
  globalThis.window = { location: { hostname: "example.test" }, setInterval: callback => { tick = callback; return 1; }, clearInterval: () => {}, fetch: async () => ({ ok: false }) };
  const state = planState();
  state.plan.calendar.noSchool = noSchool;
  let saved = state;
  const controller = renderApp(root, {
    store: { load: () => ({ state, error: null }), save: value => { saved = structuredClone(value); saves.push(saved); return value; } },
    loadPrivateSeed: false,
    weatherService: {},
    privateStorage: storage,
    cloudClient: { status: "not-configured" },
    confirmReplaceRunner: message => { confirms.push(message); return confirm(message); },
    clock: { now: () => clock.time }
  });
  await controller.ready.catch(() => {});
  return {
    root, controller, confirms, fakeDocument,
    savedRunner: () => saved.experienceRunners?.["teacher:teacher-alpha"] ?? null,
    setTime: value => { clock.time = new Date(value); },
    tick: () => tick?.(),
    destroy: () => { controller.destroy(); globalThis.document = previousDocument; globalThis.window = previousWindow; }
  };
}

const buttonByText = (root, text) => findAll(root, node => node.tagName === "button" && textOf(node) === text)[0];

test("during class the immediate next obligation stays visible with its countdown", async () => {
  const app = await mountApp({ time: "2026-09-29T09:10:00-04:00" });
  try {
    const nextCard = findAll(app.root, node => /\bth-next\b/.test(node.className))[0];
    const text = textOf(nextCard);
    assert.match(text, /Now PRIVATE_CLASS_ONE/);
    assert.match(text, /Next, in 50 minutes Prep 10:00 AM to 10:40 AM/);
    const later = textOf(findAll(app.root, node => /\bth-later\b/.test(node.className))[0]);
    assert.match(later, /PRIVATE_CLASS_TWO/, "the obligation after next is in Later today");
  } finally { app.destroy(); }
});

test("after the last block, the next obligation looks ahead through the saved calendar and skips no-school days", async () => {
  const app = await mountApp({ time: "2026-09-29T15:00:00-04:00", noSchool: ["2026-09-30"] });
  try {
    const text = textOf(findAll(app.root, node => /\bth-next\b/.test(node.className))[0]);
    assert.match(text, /Nothing else today/);
    assert.match(text, /Next obligation: Thursday, October 1 \| Day \d PRIVATE_CLASS_ONE 9:00 AM to 9:35 AM/);
  } finally { app.destroy(); }
});

test("Start lesson resumes the same class visit but starts a fresh lesson for the next class", async () => {
  let allow = false;
  const app = await mountApp({ time: "2026-09-29T09:00:00-04:00", confirm: () => allow });
  try {
    buttonByText(app.root, "Start lesson").click();
    const first = app.savedRunner();
    assert.equal(first.modeId, "circ-logo-jingle");
    assert.equal(app.confirms.length, 0, "no existing lesson, so no confirmation");
    app.controller.navigate("today");
    buttonByText(app.root, "Start lesson").click();
    assert.equal(app.confirms.length, 0, "the same class visit resumes without asking");

    // Class one's clock runs out; class two is next at 10:45.
    const runnerButtons = () => findAll(app.root, node => node.tagName === "button");
    app.controller.navigate("experience-runner");
    runnerButtons().find(node => textOf(node) === "Start class")?.click();
    app.setTime("2026-09-29T10:40:00-04:00");
    app.tick();
    app.controller.navigate("today");
    assert.match(textOf(app.root), /Next class \| This class PRIVATE_CLASS_TWO/);
    const before = JSON.stringify(app.savedRunner());
    assert.match(textOf(app.root), /This lesson is finished/, "class one's lesson finished when its class ended");

    buttonByText(app.root, "Start lesson").click();
    assert.equal(app.confirms.length, 1, "starting another class asks first");
    assert.equal(JSON.stringify(app.savedRunner()), before, "cancel keeps the previous class's lesson");

    allow = true;
    app.controller.navigate("today");
    buttonByText(app.root, "Start lesson").click();
    assert.equal(app.confirms.length, 2);
    const fresh = app.savedRunner();
    assert.equal(fresh.timer.status, "ready");
    assert.equal(fresh.timer.currentStepIndex, 0);
    assert.notEqual(fresh.createdAt ?? fresh.updatedAt, first.createdAt ?? first.updatedAt);
    assert.doesNotMatch(textOf(app.root), /Lesson complete/);
  } finally { app.destroy(); }
});

test("the minute refresh keeps a focused Schedule field and open sections in place", async () => {
  const app = await mountApp({ time: "2026-09-29T10:45:10-04:00" });
  try {
    app.controller.navigate("schedule");
    const field = findAll(app.root, node => node.tagName === "input" || node.tagName === "textarea")[0];
    assert.ok(field, "the Schedule page has an editable field");
    app.fakeDocument.activeElement = field;
    app.setTime("2026-09-29T10:46:05-04:00");
    app.tick();
    assert.ok(findAll(app.root, node => node === field).length === 1, "the focused field instance is not replaced");

    app.fakeDocument.activeElement = null;
    app.controller.navigate("today");
    const planAhead = findAll(app.root, node => node.tagName === "details" && /today-plan-ahead/.test(node.className))[0];
    planAhead.setAttribute("open", "");
    app.setTime("2026-09-29T10:47:05-04:00");
    app.tick();
    const reopened = findAll(app.root, node => node.tagName === "details" && /today-plan-ahead/.test(node.className))[0];
    assert.notEqual(reopened, planAhead, "Today did re-render for the new minute");
    assert.equal(reopened.getAttribute("open"), "", "the expanded section stays open");
  } finally { app.destroy(); }
});

test("choosing a class meeting keeps keyboard focus on the picker", async () => {
  const app = await mountApp({ time: "2026-09-29T09:10:00-04:00" });
  try {
    const picker = findAll(app.root, node => node.getAttribute("id") === "th-class-meeting")[0];
    app.fakeDocument.activeElement = picker;
    picker.change("4");
    const replaced = findAll(app.root, node => node.getAttribute("id") === "th-class-meeting")[0];
    assert.notEqual(replaced, picker);
    assert.equal(replaced.focused, true, "focus returns to the rebuilt picker");
    app.fakeDocument.activeElement = replaced;
    const count = textOf(app.root);
    app.setTime("2026-09-29T09:11:05-04:00");
    app.tick();
    assert.equal(findAll(app.root, node => node === replaced).length, 1, "Today waits while a picker is focused");
    assert.equal(textOf(app.root), count);
  } finally { app.destroy(); }
});

test("a stale focused class card refreshes before it can start the previous class's lesson", async () => {
  const storage = memoryStorage();
  const app = await mountApp({ time: "2026-09-29T09:34:00-04:00", storage });
  try {
    findAll(app.root, node => node.getAttribute("id") === "th-class-meeting")[0].change("4");
    app.fakeDocument.activeElement = findAll(app.root, node => node.getAttribute("id") === "th-class-meeting")[0];
    app.setTime("2026-09-29T10:45:00-04:00");
    app.tick();
    assert.match(textOf(findAll(app.root, node => /\bth-class\b/.test(node.className))[0]), /PRIVATE_CLASS_ONE/);

    buttonByText(app.root, "Start lesson").click();
    assert.equal(app.savedRunner(), null, "the stale action must not create a runner");
    assert.match(textOf(app.root), /Now \| This class PRIVATE_CLASS_TWO/);
    assert.match(textOf(app.root), /scheduled class changed/i);
    const saved = loadClassProgress(storage, "teacher:teacher-alpha");
    assert.equal(classPlace(saved.book, "class-one").meeting, 4, "the prior class's edit is preserved");

    buttonByText(app.root, "Start lesson").click();
    assert.equal(app.savedRunner().modeId, "circ-logo-jingle", "the reviewed current class starts its own lesson");
    assert.equal(app.savedRunner().timer.status, "ready");
    assert.equal(app.confirms.length, 0);
  } finally { app.destroy(); }
});

test("Start class rebases a pre-opened Ready lesson to the actual scheduled end", async () => {
  const app = await mountApp({ time: "2026-09-29T10:40:00-04:00" });
  try {
    buttonByText(app.root, "Start lesson").click();
    const ready = structuredClone(app.savedRunner());
    assert.equal(ready.timer.totalRemainingSeconds, 35 * 60);
    app.setTime("2026-09-29T10:50:30-04:00");
    app.tick();
    buttonByText(app.root, "Start class").click();
    const running = app.savedRunner();
    assert.equal(running.timer.totalRemainingSeconds, 29 * 60 + 30);
    assert.equal(running.timer.status, "running");
    assert.equal(running.timer.currentStepIndex, ready.timer.currentStepIndex);
    assert.equal(running.timer.currentStepRemainingSeconds, ready.timer.currentStepRemainingSeconds);
    assert.equal(running.modeId, ready.modeId);
    assert.deepEqual(running.steps, ready.steps);

    app.setTime("2026-09-29T10:51:30-04:00");
    buttonByText(app.root, "Pause").click();
    const pausedSeconds = app.savedRunner().timer.totalRemainingSeconds;
    app.setTime("2026-09-29T10:52:30-04:00");
    buttonByText(app.root, "Resume").click();
    assert.equal(app.savedRunner().timer.totalRemainingSeconds, pausedSeconds, "Resume preserves the existing paused-clock behavior");
  } finally { app.destroy(); }
});

test("Start class cannot start a Ready lesson after its intended class visit has changed or ended", async () => {
  for (const time of ["2026-09-29T09:40:00-04:00", "2026-09-29T10:45:00-04:00"]) {
    const app = await mountApp({ time: "2026-09-29T09:10:00-04:00" });
    try {
      buttonByText(app.root, "Start lesson").click();
      const ready = structuredClone(app.savedRunner());
      app.setTime(time);
      buttonByText(app.root, "Start class").click();
      assert.deepEqual(app.savedRunner(), ready, "reviewing a changed visit writes no runner changes");
      assert.match(textOf(app.root), /scheduled class changed/i);
      assert.ok(findAll(app.root, node => node.getAttribute("aria-label") === "Teacher home").length);
    } finally { app.destroy(); }
  }
});

test("a temporary preview cannot clear the saved Ready lesson's class visit", async () => {
  const app = await mountApp({ time: "2026-09-29T09:10:00-04:00" });
  try {
    buttonByText(app.root, "Start lesson").click();
    const ready = structuredClone(app.savedRunner());
    app.controller.navigate("today");
    buttonByText(app.root, "Preview lesson").click();
    app.setTime("2026-09-29T10:45:00-04:00");
    buttonByText(app.root, "Start class").click();
    assert.match(textOf(app.root), /Preview only/);
    assert.match(textOf(app.root), /Pause/);
    assert.deepEqual(app.savedRunner(), ready, "preview actions preserve the saved lesson");
    buttonByText(app.root, "Back to Today").click();
    buttonByText(app.root, "Back to the lesson").click();
    buttonByText(app.root, "Start class").click();
    assert.deepEqual(app.savedRunner(), ready, "the earlier saved class cannot start in the later visit");
    assert.match(textOf(app.root), /scheduled class changed/i);
  } finally { app.destroy(); }
});

test("a replacement confirmation after a class ends or changes preserves the saved lesson", async () => {
  for (const time of ["2026-09-29T09:40:00-04:00", "2026-09-29T10:45:00-04:00"]) {
    const app = await mountApp({
      time: "2026-09-29T09:34:00-04:00",
      confirm: () => { app.setTime(time); return true; }
    });
    try {
      buttonByText(app.root, "Start lesson").click();
      const ready = structuredClone(app.savedRunner());
      app.controller.navigate("today");
      findAll(app.root, node => node.getAttribute("id") === "th-class-meeting")[0].change("4");
      buttonByText(app.root, "Start lesson").click();
      assert.equal(app.confirms.length, 1);
      assert.deepEqual(app.savedRunner(), ready, "a stale confirmation must not replace the prior runner");
      assert.match(textOf(app.root), /scheduled class changed/i);
      assert.ok(findAll(app.root, node => node.getAttribute("aria-label") === "Teacher home").length);
    } finally { app.destroy(); }
  }
});
