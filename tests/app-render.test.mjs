import assert from "node:assert/strict";
import test from "node:test";

import { renderApp } from "../src/app.js";
import { EXPERIENCE_TIMING_PLANS } from "../src/model/experience-timing-plans.js";
import {
  advanceExperienceRunnerClock,
  applyExperienceRunnerAction,
  createExperienceRunner
} from "../src/model/experience-runner.js";

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
  }

  append(...children) {
    this.children.push(...children.filter(Boolean));
  }

  replaceChildren(...children) {
    this.replaceChildrenCount = (this.replaceChildrenCount ?? 0) + 1;
    this.children = children.filter(Boolean);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  click() {
    this.listeners.get("click")?.({ currentTarget: this });
  }

  querySelector(selector) {
    if (selector === "[data-live-clock]" && this.attributes.has("data-live-clock")) return this;
    const runnerTimer = /^\[data-runner-timer="([a-z]+)"\]$/.exec(selector);
    if (runnerTimer && this.getAttribute("data-runner-timer") === runnerTimer[1]) return this;
    for (const child of this.children) {
      const match = child.querySelector?.(selector);
      if (match) return match;
    }
    return null;
  }

  focus() {}

  cloneNode() {
    const clone = new FakeNode(this.tagName);
    clone.className = this.className;
    clone.textContent = this.textContent;
    clone.attributes = new Map(this.attributes);
    clone.dataset = { ...(this.dataset ?? {}) };
    return clone;
  }

  replaceWith() {}
}

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
}

function findAll(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  for (const child of node.children) findAll(child, predicate, found);
  return found;
}

function fakeDocument({ header = null, navButtons = [], status = null } = {}) {
  const listeners = new Map();
  return {
    createElement: (tagName) => new FakeNode(tagName),
    createElementNS: (_namespace, tagName) => new FakeNode(tagName),
    querySelector: (selector) => selector === ".site-header" ? header : null,
    querySelectorAll: (selector) => selector === "[data-route]" ? navButtons : [],
    getElementById: (id) => id === "app-status" ? status : null,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
    dispatchEvent: (event) => listeners.get(event.type)?.(event)
  };
}

function memoryStore(state) {
  return {
    load: () => ({ state, error: null })
  };
}

function stateWithActiveEvent(type) {
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-20T12:00:00.000Z",
    plan: {
      format: "playbook.teacherPlan.v2",
      version: 1,
      calendar: {
        anchorDate: "2026-08-20",
        anchorDay: 1,
        lastDate: "2027-06-04",
        noSchool: [],
        conditionalMakeup: [],
        overrides: {}
      },
      teachers: [{
        id: "teacher-alpha",
        name: "Teacher Alpha",
        days: {
          1: [{
            id: `active-${type}`,
            type,
            label: `PRIVATE_${type.toUpperCase()}_LABEL`,
            start: "09:00",
            end: "09:30",
            classId: "class-alpha",
            lessonGuideId: "guide-alpha",
            countdown: `PRIVATE_${type.toUpperCase()}_COUNTDOWN`,
            currentProcessStep: `PRIVATE_${type.toUpperCase()}_STEP`
          }]
        }
      }],
      specialEvents: [],
      resources: []
    },
    teacherProgress: {},
    checklist: [],
    classes: [{ id: "class-alpha", title: "PRIVATE_CLASS_TITLE" }],
    lessonGuides: [{
      id: "guide-alpha",
      title: "PRIVATE_LESSON_TITLE",
      objective: "PRIVATE_OBJECTIVE",
      directions: ["PRIVATE_STEP"],
      materials: ["PRIVATE_MATERIAL"]
    }],
    specialEvents: [],
    resources: [],
    notes: [],
    preferences: {},
    tombstones: []
  };
}

function runningLastStepRunner() {
  const timestamp = "2026-08-20T13:10:00.000Z";
  let runner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: "teacher:teacher-alpha",
    nowIso: timestamp,
    modeId: "build-new"
  });
  runner = applyExperienceRunnerAction(runner, "start", {
    teacherKey: "teacher:teacher-alpha",
    nowIso: timestamp
  });
  while (runner.timer.currentStepIndex < runner.steps.length - 1) {
    runner = applyExperienceRunnerAction(runner, "next", {
      teacherKey: "teacher:teacher-alpha",
      nowIso: timestamp
    });
  }
  return runner;
}

async function renderBoard(state) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: memoryStore(state),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;
    controller.navigate("board");
    return textOf(root);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

async function renderRoute(state, route) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: memoryStore(state),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;
    controller.navigate(route);
    return root;
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

async function renderRoom(state) {
  return renderRoute(state, "room");
}

function stateWithoutPlan() {
  const state = stateWithActiveEvent("teach");
  state.plan = null;
  state.teacherProgress = {};
  state.experienceRunners = {};
  return state;
}

test("a device without a plan starts on the CIRC HQ welcome route", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: memoryStore(stateWithoutPlan()),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    const rendered = textOf(root);
    assert.match(rendered, /CIRC HQ/);
    assert.match(rendered, /The K-6 Playbook/);
    assert.match(rendered, /Set up this device/);
    assert.match(rendered, /Preview without saving/);
    const makerImages = findAll(root, (node) =>
      node.tagName === "img" && node.getAttribute("src") === "assets/circ-hq-maker.webp"
    );
    assert.equal(makerImages.length, 1);

    const setup = findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Set up this device"
    );
    assert.equal(setup.length, 1);
    setup[0].click();
    assert.match(textOf(root), /Teacher Setup/);
    assert.equal(controller.previewOnly, true);
    const planPicker = findAll(root, (node) =>
      node.tagName === "input" && node.getAttribute("type") === "file"
    );
    assert.equal(planPicker.length, 1);
    assert.equal(planPicker[0].hasAttribute("disabled"), false);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("welcome preview opens Today without saving or creating progress", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithoutPlan();
  const original = structuredClone(state);
  let saveCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        importPlan: () => {
          throw new Error("preview must not import a plan");
        },
        save: () => {
          saveCount += 1;
          throw new Error("preview must remain read-only");
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    const preview = findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Preview without saving"
    );
    assert.equal(preview.length, 1);
    preview[0].click();

    assert.equal(controller.previewOnly, true);
    assert.match(textOf(root), /Today/);
    assert.equal(findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Run today's experience"
    ).length, 0);
    assert.equal(saveCount, 0);
    assert.deepEqual(state, original);
    assert.equal(state.plan, null);
    assert.deepEqual(state.experienceRunners, {});
    assert.deepEqual(state.teacherProgress, {});
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("setup unlocks only plan import until a validated plan is applied", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithoutPlan();
  const original = structuredClone(state);
  const imported = stateWithActiveEvent("teach");
  let saveCount = 0;
  let importCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        importPlan: () => {
          importCount += 1;
          return { ok: true, state: structuredClone(imported) };
        },
        save: (nextState) => {
          saveCount += 1;
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-29T12:00:00.000Z") }
    });
    await controller.ready;

    findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Set up this device"
    )[0].click();
    const setupPicker = findAll(root, (node) =>
      node.tagName === "input" && node.getAttribute("type") === "file"
    )[0];
    assert.equal(setupPicker.hasAttribute("disabled"), false);

    controller.navigate("projects");
    const currentProject = findAll(root, (node) =>
      node.tagName === "button" && /^Open Experience 2:/.test(node.getAttribute("aria-label") ?? "")
    );
    assert.equal(currentProject.length, 1);
    currentProject[0].click();
    const complete = findAll(root, (node) =>
      node.tagName === "button" && textOf(node) === "Complete experience and move to next"
    );
    complete[0]?.click();

    assert.deepEqual({
      completeButtonCount: complete.length,
      saveCount
    }, {
      completeButtonCount: 0,
      saveCount: 0
    });
    assert.equal(controller.previewOnly, true);
    assert.equal(findAll(root, (node) =>
      node.tagName === "button" && /Run (today's )?experience/.test(textOf(node))
    ).length, 0);
    assert.deepEqual(state, original);
    assert.deepEqual(state.teacherProgress, {});
    assert.deepEqual(state.experienceRunners, {});

    controller.navigate("settings");
    const picker = findAll(root, (node) =>
      node.tagName === "input" && node.getAttribute("type") === "file"
    )[0];
    assert.equal(picker.hasAttribute("disabled"), false);
    picker.files = [{ text: async () => JSON.stringify(imported.plan) }];
    await picker.listeners.get("change")?.();
    findAll(root, (node) => node.tagName === "button" && node.textContent === "Apply")[0].click();

    assert.equal(importCount, 1);
    assert.equal(controller.previewOnly, false);
    controller.navigate("projects");
    findAll(root, (node) =>
      node.tagName === "button" && /^Open Experience 2:/.test(node.getAttribute("aria-label") ?? "")
    )[0].click();
    const enabledComplete = findAll(root, (node) =>
      node.tagName === "button" && textOf(node) === "Complete experience and move to next"
    );
    assert.equal(enabledComplete.length, 1);
    enabledComplete[0].click();
    assert.equal(saveCount, 1);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Preview to Teacher Setup remains read-only and cannot Apply an import", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithoutPlan();
  const original = structuredClone(state);
  const imported = stateWithActiveEvent("teach");
  let importCount = 0;
  let saveCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        importPlan: () => {
          importCount += 1;
          return { ok: true, state: structuredClone(imported) };
        },
        save: () => {
          saveCount += 1;
          throw new Error("preview must not save");
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-29T12:00:00.000Z") }
    });
    await controller.ready;

    findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Preview without saving"
    )[0].click();
    controller.navigate("settings");
    const picker = findAll(root, (node) =>
      node.tagName === "input" && node.getAttribute("type") === "file"
    )[0];
    picker.files = [{ text: async () => JSON.stringify(imported.plan) }];
    await picker.listeners.get("change")?.();
    findAll(root, (node) => node.tagName === "button" && node.textContent === "Apply")[0].click();

    assert.equal(controller.previewOnly, true);
    assert.equal(importCount, 0);
    assert.equal(saveCount, 0);
    assert.deepEqual(state, original);
    assert.equal(state.plan, null);
    assert.deepEqual(state.teacherProgress, {});
    assert.deepEqual(state.experienceRunners, {});
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Teacher Setup retains access to the Schedule route", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: memoryStore(stateWithoutPlan()),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;
    controller.navigate("settings");

    assert.match(textOf(root), /Teacher Setup/);
    const schedule = findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Open Schedule"
    );
    assert.equal(schedule.length, 1);
    schedule[0].click();
    assert.match(textOf(root), /Schedule/);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a validated stored plan starts on Today instead of Welcome", async () => {
  const root = await renderRoute(stateWithActiveEvent("teach"), "today");
  assert.match(textOf(root), /Today/);
  assert.doesNotMatch(textOf(root), /Set up this device|Preview without saving/);
});

test("a validated localhost plan import leaves Welcome for Today", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const empty = stateWithoutPlan();
  const imported = stateWithActiveEvent("teach");
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "localhost" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state: empty, error: null }),
        importPlan: () => ({ ok: true, state: structuredClone(imported) })
      },
      hostname: "localhost",
      fetchImpl: async (url) => url === "/__private__/plan.json"
        ? { ok: true, text: async () => JSON.stringify(imported.plan) }
        : { ok: false },
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });

    assert.match(textOf(root), /The K-6 Playbook/);
    await controller.ready;
    assert.match(textOf(root), /Today/);
    assert.doesNotMatch(textOf(root), /Set up this device|Preview without saving/);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("rendered Board never leaks teacher-only active event fields", async () => {
  for (const type of ["duty", "support", "prep", "lunch", "special"]) {
    const rendered = await renderBoard(stateWithActiveEvent(type));

    assert.match(rendered, /Board is ready when a class is active/, type);
    assert.doesNotMatch(rendered, new RegExp(`PRIVATE_${type.toUpperCase()}`), type);
    assert.doesNotMatch(rendered, /PRIVATE_CLASS_TITLE|PRIVATE_LESSON_TITLE|PRIVATE_OBJECTIVE|PRIVATE_STEP|PRIVATE_MATERIAL/, type);
  }
});

test("rendered Board receives a student-safe teach projection without model fallbacks", async () => {
  const state = stateWithActiveEvent("teach");
  state.classes[0] = {
    id: "class-alpha",
    title: "Classroom-safe studio session",
    visibility: "classroom",
    reviewedForBoard: true
  };
  state.lessonGuides[0] = {
    ...state.lessonGuides[0],
    title: "Classroom-safe lesson",
    objective: "Classroom-safe objective",
    currentProcessStep: "Build",
    visibility: "classroom",
    reviewedForBoard: true
  };
  state.plan.teachers[0].days[1][0].label = "PRIVATE_TEACH_EVENT_LABEL";
  state.plan.teachers[0].days[1][0].countdown = "05:00";
  const rendered = await renderBoard(state);

  assert.match(rendered, /Classroom-safe studio session/);
  assert.match(rendered, /20m to end/);
  assert.match(rendered, /Classroom-safe lesson/);
  assert.match(rendered, /Current step: Build/);
  assert.doesNotMatch(rendered, /PRIVATE_TEACH_EVENT_LABEL|05:00|PRIVATE_TEACH_STEP/);
  assert.doesNotMatch(rendered, /Board is ready when a class is active/);
});

test("rendered Board keeps a linked but unreviewed teach event inactive", async () => {
  const rendered = await renderBoard(stateWithActiveEvent("teach"));

  assert.match(rendered, /Board is ready when a class is active/);
  assert.doesNotMatch(rendered, /PRIVATE_TEACH|PRIVATE_CLASS_TITLE|PRIVATE_LESSON_TITLE|PRIVATE_OBJECTIVE|PRIVATE_STEP|PRIVATE_MATERIAL/);
});

test("rendered Room anchors use only admitted safeHref values", async () => {
  const state = stateWithActiveEvent("teach");
  state.resources = [
    {
      id: "unsafe-script",
      title: "UNSAFE_SCRIPT_RESOURCE",
      visibility: "teacher-private",
      validated: true,
      source: "local",
      href: "javascript:globalThis.genericProbe=1"
    },
    {
      id: "unsafe-http",
      title: "UNSAFE_HTTP_RESOURCE",
      visibility: "teacher-private",
      validated: true,
      source: "authorized-cloud",
      href: "http://example.invalid/generic"
    },
    {
      id: "unsafe-normalized-local",
      title: "UNSAFE_NORMALIZED_RESOURCE",
      visibility: "teacher-private",
      validated: true,
      source: "local",
      href: "/.git/../index.html"
    },
    {
      id: "safe-local",
      title: "Safe local resource",
      visibility: "teacher-private",
      validated: true,
      source: "local",
      href: "/mission-control.html"
    },
    {
      id: "safe-external",
      title: "Safe external resource",
      visibility: "teacher-private",
      validated: true,
      source: "authorized-cloud",
      href: "https://example.invalid/generic"
    }
  ];

  const root = await renderRoom(state);
  const rendered = textOf(root);
  const anchors = findAll(root, (node) => node.tagName === "a");

  assert.doesNotMatch(rendered, /UNSAFE_SCRIPT_RESOURCE|UNSAFE_HTTP_RESOURCE|UNSAFE_NORMALIZED_RESOURCE/);
  assert.equal(anchors.length, 2);
  assert.equal(anchors[0].getAttribute("href"), "/mission-control.html");
  assert.equal(anchors[0].className, "resource-link");
  assert.match(anchors[0].getAttribute("aria-label"), /^Open Safe local resource\b/);
  assert.equal(anchors[0].getAttribute("target"), null);
  assert.equal(anchors[0].getAttribute("rel"), null);
  assert.equal(anchors[1].getAttribute("href"), "https://example.invalid/generic");
  assert.equal(anchors[1].className, "resource-link");
  assert.match(anchors[1].getAttribute("aria-label"), /^Open Safe external resource\b/);
  assert.notEqual(anchors[0].getAttribute("aria-label"), anchors[1].getAttribute("aria-label"));
  assert.equal(anchors[1].getAttribute("target"), "_blank");
  assert.equal(anchors[1].getAttribute("rel"), "noopener noreferrer");
});

test("Today and Settings render only scoped 44px attribution link classes", async () => {
  const state = stateWithActiveEvent("teach");
  for (const [route, label] of [
    ["today", "Weather by Open-Meteo"],
    ["settings", "Open-Meteo attribution"]
  ]) {
    const root = await renderRoute(state, route);
    const matches = findAll(root, (node) => node.tagName === "a" && node.textContent === label);
    assert.equal(matches.length, 1, route);
    assert.equal(matches[0].className, "attribution-link", route);
  }
});

test("Option 2 Today keeps the live day and the complete project launcher together", async () => {
  const state = stateWithActiveEvent("teach");
  const root = await renderRoute(state, "today");
  const rendered = textOf(root);

  assert.match(rendered, /Experience 2 of 36/);
  assert.match(rendered, /Tech Terrarium/);
  assert.match(rendered, /Build it\. Test it\. Leave your mark\./);
  assert.match(rendered, /Run today's experience/);
  assert.match(rendered, /Teacher script/);
  assert.match(rendered, /Student directions/);
  assert.match(rendered, /Designer's Challenge/);
  assert.match(rendered, /36-experience year map/i);
  assert.match(rendered, /Open Playbooks/);
  assert.match(rendered, /PRIVATE_TEACH_LABEL/);
  assert.equal(findAll(root, (node) => /\bproject-trail-step\b/.test(node.className)).length, 36);
});

test("Year Map route exposes all 36 choices without private schedule content", async () => {
  const state = stateWithActiveEvent("teach");
  const root = await renderRoute(state, "projects");
  const rendered = textOf(root);

  assert.match(rendered, /All 36 Experiences/);
  assert.match(rendered, /Meet the CIRC Teacher and the Outdoor Classroom/);
  assert.match(rendered, /Demo Day/);
  assert.equal(findAll(root, (node) => /\bproject-library-card\b/.test(node.className)).length, 36);
  assert.doesNotMatch(rendered, /PRIVATE_TEACH_LABEL|PRIVATE_CLASS_TITLE/);
  assert.equal(findAll(root, (node) => node.tagName === "a" && /classroom-legacy\.html/.test(node.getAttribute("href") ?? "")).length, 0);
});

test("teacher and student project routes separate teacher language from Board-safe directions", async () => {
  const state = stateWithActiveEvent("teach");
  const teacherRoot = await renderRoute(state, "project-teacher");
  const studentRoot = await renderRoute(state, "project-student");
  const teacherText = textOf(teacherRoot);
  const studentText = textOf(studentRoot);

  assert.match(teacherText, /Teacher script/);
  assert.match(teacherText, /Today the class turns ordinary outdoor materials into one shared build/);
  assert.match(teacherText, /Teacher moves/);
  assert.match(teacherText, /Student build path/);
  assert.match(teacherText, /Wash the rocks, rinse away loose soil/);
  assert.match(teacherText, /Exit evidence/);
  assert.match(teacherText, /Name one contribution to the shared terrarium/);
  assert.match(teacherText, /Complete experience and move to next/);
  assert.match(teacherText, /Download admin plan/);
  assert.match(studentText, /Student directions/);
  assert.match(studentText, /Wash the rocks, rinse away loose soil/);
  assert.match(studentText, /Plant-safe decorations/);
  assert.match(studentText, /Name one contribution to the shared terrarium/);
  assert.match(studentText, /Fast finish/);
  assert.match(studentText, /Designer's Challenge/);
  assert.match(studentText, /Stretch/);
  assert.doesNotMatch(studentText, /Teacher script|Teacher moves|Download admin plan|Today the class turns ordinary outdoor materials/);
});

test("Run today's experience opens one live runner and Student directions keeps its timers without teacher content or a trapped exit", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  const state = stateWithActiveEvent("teach");
  const store = {
    load: () => ({ state, error: null }),
    save: (nextState) => structuredClone(nextState)
  };
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: (callback) => {
      timerCallback = callback;
      return 1;
    },
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience");
    assert.equal(run.length, 1);
    run[0].click();
    assert.match(textOf(root), /Class timer/);
    assert.match(textOf(root), /Step timer/);
    assert.match(textOf(root), /Start class/);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause").length, 0);
    assert.doesNotMatch(textOf(root), /\+1 minute|Previous|Next Step/);
    const initialTimerValues = findAll(root, (node) => /\brunner-timer-value\b/.test(node.className))
      .map((node) => textOf(node));
    assert.equal(initialTimerValues.length, 2);

    currentTime = new Date("2026-08-20T09:10:30-04:00");
    timerCallback();
    const readyTimerValues = findAll(root, (node) => /\brunner-timer-value\b/.test(node.className))
      .map((node) => textOf(node));
    assert.deepEqual(readyTimerValues, initialTimerValues);

    const start = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class");
    assert.equal(start.length, 1);
    start[0].click();
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause").length, 1);
    assert.doesNotMatch(textOf(root), /Start class/);
    assert.match(textOf(root), /\+1 minute/);
    assert.match(textOf(root), /Previous/);
    assert.match(textOf(root), /Next Step/);

    currentTime = new Date("2026-08-20T09:11:00-04:00");
    timerCallback();
    const delayedTimerValues = findAll(root, (node) => /\brunner-timer-value\b/.test(node.className))
      .map((node) => textOf(node));
    assert.notDeepEqual(delayedTimerValues, initialTimerValues);
    const student = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Student directions");
    assert.equal(student.length, 1);
    student[0].click();
    const studentText = textOf(root);
    assert.match(studentText, /Class timer/);
    assert.match(studentText, /Step timer/);
    assert.match(studentText, /\d+:\d{2}/);
    assert.doesNotMatch(studentText, /Teacher script|Teacher moves|Download admin plan|Pause|\+1 minute|Previous|Next Step/);

    const exit = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Exit student view");
    assert.equal(exit.length, 1);
    exit[0].click();
    assert.match(textOf(root), /Run today's experience/);
    assert.doesNotMatch(textOf(root), /Student directions Step \d+ of \d+/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("scheduled class launch saves a stationary ready runner and renders compact cues and cleanup times", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.plan.teachers[0].days[1][0].start = "10:00";
  state.plan.teachers[0].days[1][0].end = "10:55";
  let saved = null;
  let saveCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saveCount += 1;
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T10:24:00-04:00") }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    const rendered = textOf(root);
    assert.equal(saveCount, 1);
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].timer.status, "ready");
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].timer.totalRemainingSeconds, 1860);
    assert.match(rendered, /31:00/);
    assert.match(rendered, /Start class/);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause").length, 0);
    assert.match(rendered, /Class ends at 10:55/);
    assert.match(rendered, /Cleanup begins at 10:49/);
    const cueGrid = findAll(root, (node) => /\brunner-now-grid\b/.test(node.className));
    assert.equal(cueGrid.length, 1);
    assert.deepEqual(
      findAll(cueGrid[0], (node) => node.tagName === "h3").map(textOf),
      ["Say", "Do", "Students", "Done when", "If stuck", "Finished early", "Return to the build"]
    );
    assert.match(rendered, /Pause\. Model one example\. Restart with one team\./);
    assert.match(rendered, /Good question\. Let us test it while we keep building\./);
    assert.match(rendered, /Designer's Challenge/);
    const studentDirections = findAll(root, (node) => /\brunner-student-directions\b/.test(node.className));
    assert.equal(studentDirections.length, 1);
    assert.ok(studentDirections[0].children.length <= 3);
    const context = findAll(root, (node) => node.tagName === "details" && /More context/.test(textOf(node)));
    assert.equal(context.length, 1);
    assert.equal(context[0].hasAttribute("open"), false);
    assert.deepEqual(
      findAll(context[0], (node) => node.tagName === "h3").map(textOf),
      ["Objective", "Materials", "Safety", "Teacher context"]
    );

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class")[0].click();
    assert.equal(saveCount, 2);
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].timer.status, "running");
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause").length, 1);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause")[0].click();
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].timer.status, "paused");
    assert.match(textOf(root), /Resume/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("teacher detour controls hold the step, stay out of Student directions, and Safe Landing preserves project state", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  const state = stateWithActiveEvent("teach");
  state.teacherProgress = {
    "teacher:teacher-alpha": {
      currentProjectNumber: 2,
      completedProjectNumbers: [1],
      updatedAt: "2026-08-20T12:00:00.000Z"
    }
  };
  state.sharedArtifacts = {
    "tech-terrarium": { stage: 3, contribution: "prepare-materials" }
  };
  state.futureSharedArtifactState = {
    nextContribution: "build-the-base",
    parked: false
  };
  const progressBefore = structuredClone(state.teacherProgress);
  const artifactsBefore = structuredClone(state.sharedArtifacts);
  const futureArtifactBefore = structuredClone(state.futureSharedArtifactState);
  let saved = null;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: (callback) => {
      timerCallback = callback;
      return 1;
    },
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Question Detour").length, 0);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class")[0].click();
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Question Detour").length, 1);
    assert.doesNotMatch(textOf(root), /Add 2 minutes|Return to build|Safe Landing/);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause")[0].click();
    assert.match(textOf(root), /Resume/);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Question Detour").length, 0);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Resume")[0].click();

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Question Detour")[0].click();
    const detoured = saved.experienceRunners["teacher:teacher-alpha"];
    const heldStepIndex = detoured.timer.currentStepIndex;
    const heldStepSeconds = detoured.timer.currentStepRemainingSeconds;
    const classBefore = detoured.timer.totalRemainingSeconds;
    const currentDirection = detoured.steps[heldStepIndex].directions[0];
    assert.deepEqual(detoured.detour, { status: "active", remainingSeconds: 180 });
    assert.match(textOf(root), /Discussion timer 3:00/);
    assert.match(textOf(root), /Class clock keeps running\. Step time is held\./);
    for (const label of ["Add 2 minutes", "Return to build", "Safe Landing"]) {
      assert.equal(
        findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length,
        1,
        label
      );
    }
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause").length, 0);

    currentTime = new Date("2026-08-20T09:11:00-04:00");
    timerCallback();
    assert.match(textOf(root), /Discussion timer 2:00/);
    assert.match(textOf(root), /Class timer 19:00/);
    assert.match(textOf(root), new RegExp(currentDirection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Student directions")[0].click();
    const studentText = textOf(root);
    assert.match(studentText, /Class timer 19:00/);
    assert.match(studentText, new RegExp(currentDirection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(
      studentText,
      /Question Detour|Discussion timer|Class clock keeps running|Add 2 minutes|Return to build|Safe Landing|Class ends at|Cleanup begins at|More context|Teacher context|Finished early/
    );
    for (const label of ["Question Detour", "Add 2 minutes", "Return to build", "Safe Landing"]) {
      assert.equal(
        findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length,
        0,
        `student:${label}`
      );
    }

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Exit student view")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Add 2 minutes")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Add 2 minutes")[0].click();
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].detour.remainingSeconds, 360);
    assert.match(textOf(root), /Discussion timer 6:00/);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Return to build")[0].click();
    const returned = saved.experienceRunners["teacher:teacher-alpha"];
    assert.equal(Object.hasOwn(returned, "detour"), false);
    assert.equal(returned.timer.currentStepIndex, heldStepIndex);
    assert.equal(returned.timer.currentStepRemainingSeconds, heldStepSeconds);
    assert.equal(returned.timer.totalRemainingSeconds, classBefore - 60);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Question Detour").length, 1);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause").length, 1);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Question Detour")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Safe Landing")[0].click();
    const landed = saved.experienceRunners["teacher:teacher-alpha"];
    const cleanupIndex = landed.steps.findIndex((step) => step.kind === "cleanup");
    assert.ok(cleanupIndex >= 0);
    assert.equal(landed.timer.currentStepIndex, cleanupIndex);
    assert.equal(Object.hasOwn(landed, "detour"), false);
    assert.deepEqual(saved.teacherProgress, progressBefore);
    assert.deepEqual(saved.sharedArtifacts, artifactsBefore);
    assert.deepEqual(saved.futureSharedArtifactState, futureArtifactBefore);
    assert.equal(saved.teacherProgress["teacher:teacher-alpha"].currentProjectNumber, 2);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("opening a stale same-project ready runner rebases it to the current scheduled end and saves once", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.plan.teachers[0].days[1][0].start = "10:00";
  state.plan.teachers[0].days[1][0].end = "10:55";
  state.experienceRunners = {
    "teacher:teacher-alpha": createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
      teacherKey: "teacher:teacher-alpha",
      nowIso: "2026-08-20T13:00:00.000Z",
      modeId: "build-new"
    })
  };
  let saved = null;
  let saveCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saveCount += 1;
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T10:24:00-04:00") }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    assert.equal(saveCount, 1);
    const corrected = saved.experienceRunners["teacher:teacher-alpha"];
    assert.equal(corrected.timer.status, "ready");
    assert.equal(corrected.timer.totalRemainingSeconds, 1860);
    assert.equal(corrected.timer.currentStepIndex, 0);
    assert.equal(corrected.timer.currentStepRemainingSeconds, 180);
    assert.match(textOf(root), /31:00/);
    assert.match(textOf(root), /Class ends at 10:55/);
    assert.match(textOf(root), /Cleanup begins at 10:49/);
    assert.match(textOf(root), /Start class/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("opening same-project running and paused runners preserves their active lifecycle without saving", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    for (const expected of ["Pause", "Resume"]) {
      const root = new FakeNode("main");
      const state = stateWithActiveEvent("teach");
      let runner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
        teacherKey: "teacher:teacher-alpha",
        nowIso: "2026-08-20T14:24:00.000Z",
        modeId: "build-new"
      });
      runner = applyExperienceRunnerAction(runner, "start", {
        teacherKey: "teacher:teacher-alpha",
        nowIso: "2026-08-20T14:24:00.000Z"
      });
      if (expected === "Resume") {
        runner = applyExperienceRunnerAction(runner, "pause", {
          teacherKey: "teacher:teacher-alpha",
          nowIso: "2026-08-20T14:24:00.000Z"
        });
      }
      state.experienceRunners = { "teacher:teacher-alpha": runner };
      let saveCount = 0;
      globalThis.document = fakeDocument();
      globalThis.window = {
        location: { hostname: "example.test" },
        setInterval: () => 1,
        clearInterval: () => {},
        fetch: async () => ({ ok: false })
      };
      const controller = renderApp(root, {
        store: {
          load: () => ({ state, error: null }),
          save: (nextState) => {
            saveCount += 1;
            return structuredClone(nextState);
          }
        },
        loadPrivateSeed: false,
        weatherService: {},
        clock: { now: () => new Date("2026-08-20T10:24:00-04:00") }
      });
      await controller.ready;

      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
      assert.equal(saveCount, 0, expected);
      assert.equal(
        findAll(root, (node) => node.tagName === "button" && textOf(node) === expected).length,
        1,
        expected
      );
      controller.destroy();
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Preview without saving opens an in-memory preview runner that cannot save or complete", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithoutPlan();
  let saveCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saveCount += 1;
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview without saving")[0].click();
    const preview = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview experience");
    assert.equal(preview.length, 1);
    preview[0].click();
    assert.match(textOf(root), /Preview only/);
    assert.match(textOf(root), /Class timer/);
    assert.equal(saveCount, 0);
    assert.equal(state.experienceRunners["local:default"], undefined);
    assert.doesNotMatch(textOf(root), /Complete experience and move to next|Mark final experience complete|Finish Lesson/);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Student directions")[0].click();
    assert.match(textOf(root), /Preview only/);
    assert.equal(saveCount, 0);
    assert.equal(state.experienceRunners["local:default"], undefined);
    for (const label of [
      "Start class",
      "Pause",
      "Resume",
      "+1 minute",
      "Previous",
      "Next Step",
      "Finish Lesson",
      "Question Detour",
      "Add 2 minutes",
      "Return to build",
      "Safe Landing"
    ]) {
      assert.equal(
        findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length,
        0,
        label
      );
    }
    assert.doesNotMatch(textOf(root), /Complete experience and move to next|Mark final experience complete|Lesson complete/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("no-plan Today remains read-only instead of starting a local runner", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-20T12:00:00.000Z",
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
  let saved = null;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;
    controller.navigate("today");

    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience");
    assert.equal(run.length, 0);
    assert.doesNotMatch(textOf(root), /Class timer/);
    assert.equal(saved, null);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a persisted email teacher keeps the Today schedule and launches a namespaced runner", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.plan.teachers[0].id = "teacher@example.com";
  state.plan.teachers[0].days[1][0].label = "Email teacher live schedule";
  let saved = null;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    assert.match(textOf(root), /Email teacher live schedule/);
    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience");
    assert.equal(run.length, 1);
    assert.doesNotThrow(() => run[0].click());
    assert.equal(
      saved.experienceRunners["teacher:teacher@example.com"].teacherKey,
      "teacher:teacher@example.com"
    );
    assert.equal(saved.plan.teachers[0].id, "teacher@example.com");
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a real default teacher cannot adopt the synthetic local runner or progress", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.plan.teachers[0].id = "default";
  state.teacherProgress = {
    "local:default": {
      currentProjectNumber: 19,
      completedProjectNumbers: [1]
    }
  };
  const syntheticTimestamp = "2026-08-20T13:10:00.000Z";
  let syntheticRunner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: "local:default",
    nowIso: syntheticTimestamp,
    modeId: "build-new"
  });
  syntheticRunner = applyExperienceRunnerAction(syntheticRunner, "start", {
    teacherKey: "local:default",
    nowIso: syntheticTimestamp
  });
  state.experienceRunners = { "local:default": syntheticRunner };
  let saved = null;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    assert.match(textOf(root), /Experience 2 of 36/);
    assert.doesNotMatch(textOf(root), /Experience 19 of 36/);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();

    assert.equal(saved.experienceRunners["local:default"].teacherKey, "local:default");
    assert.equal(saved.experienceRunners["teacher:default"].teacherKey, "teacher:default");
    assert.notDeepEqual(
      saved.experienceRunners["teacher:default"],
      saved.experienceRunners["local:default"]
    );
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a malformed saved runner is ignored until Run replaces it without breaking navigation or the interval", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.experienceRunners = { "teacher:teacher-alpha": { teacherKey: "teacher:teacher-alpha" } };
  let saved = null;
  let timerCallback = null;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: (callback) => {
      timerCallback = callback;
      return 1;
    },
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    assert.doesNotThrow(() => controller.navigate("projects"));
    assert.doesNotThrow(() => timerCallback());
    controller.navigate("today");
    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience");
    assert.equal(run.length, 1);
    assert.doesNotThrow(() => run[0].click());
    assert.match(textOf(root), /Class timer/);
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].teacherKey, "teacher:teacher-alpha");
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a saved runner from the future is ignored until Run safely replaces it", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  const futureTimestamp = "2026-08-20T13:20:00.000Z";
  let futureRunner = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: "teacher:teacher-alpha",
    nowIso: futureTimestamp,
    modeId: "build-new"
  });
  futureRunner = applyExperienceRunnerAction(futureRunner, "start", {
    teacherKey: "teacher:teacher-alpha",
    nowIso: futureTimestamp
  });
  state.experienceRunners = { "teacher:teacher-alpha": futureRunner };
  let saved = null;
  let timerCallback = null;
  const currentTime = new Date("2026-08-20T09:10:00-04:00");
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: (callback) => {
      timerCallback = callback;
      return 1;
    },
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    assert.throws(
      () => advanceExperienceRunnerClock(futureRunner, {
        teacherKey: "teacher:teacher-alpha",
        nowIso: currentTime.toISOString()
      }),
      /runner-clock-moved-backward/
    );

    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    assert.doesNotThrow(() => timerCallback());
    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience");
    assert.equal(run.length, 1);
    assert.doesNotThrow(() => run[0].click());
    assert.match(textOf(root), /Class timer/);
    assert.equal(saved.experienceRunners["teacher:teacher-alpha"].lastTickAt, currentTime.toISOString());
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("ordinary runner ticks update timer text without replacing the root or checkpointing every second", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  let saveCount = 0;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: (callback) => {
      timerCallback = callback;
      return 1;
    },
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saveCount += 1;
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class")[0].click();
    const renderedCount = root.replaceChildrenCount;
    const savedAfterStart = saveCount;
    const classTimer = findAll(root, (node) => node.getAttribute?.("data-runner-timer") === "class")[0];
    assert.ok(classTimer, "class timer needs a stable data attribute");
    const initialClassTime = textOf(classTimer);

    currentTime = new Date("2026-08-20T09:10:01-04:00");
    timerCallback();
    assert.equal(root.replaceChildrenCount, renderedCount);
    assert.equal(saveCount, savedAfterStart);
    assert.notEqual(textOf(classTimer), initialClassTime);

    currentTime = new Date("2026-08-20T09:20:00-04:00");
    timerCallback();
    assert.equal(root.replaceChildrenCount, renderedCount + 1);
    assert.equal(findAll(root, (node) => node.getAttribute?.("role") === "alert").length, 1);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Next Step")[0].click();
    assert.equal(saveCount, savedAfterStart + 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("last-step completion needs confirmation and then replaces runner controls with a clear exit", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  const runner = runningLastStepRunner();
  state.experienceRunners = { "teacher:teacher-alpha": runner };
  let saveCount = 0;
  let accepted = false;
  const messages = [];
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => {
          saveCount += 1;
          return structuredClone(nextState);
        }
      },
      confirmFinish: (message) => {
        messages.push(message);
        return accepted;
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    assert.match(textOf(root), new RegExp(`Step ${runner.steps.length} of ${runner.steps.length}`));
    assert.match(textOf(root), /35:00/);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Next Step").length, 0);
    const finish = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Finish Lesson");
    assert.equal(finish.length, 1);

    finish[0].click();
    assert.equal(saveCount, 0);
    assert.match(textOf(root), /Finish Lesson/);
    assert.doesNotMatch(textOf(root), /Lesson complete/);
    assert.match(messages[0], /Both timers will stop at 0:00/);

    accepted = true;
    finish[0].click();
    assert.equal(saveCount, 1);
    assert.match(textOf(root), /Lesson complete/);
    assert.match(textOf(root), /0:00/);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Back to Today").length, 1);
    assert.doesNotMatch(textOf(root), /Pause|\+1 minute|Previous|Finish Lesson/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("destroy removes the runner visibility handler so stale views do not reconcile or render", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const document = fakeDocument();
  const state = stateWithActiveEvent("teach");
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  document.visibilityState = "visible";
  globalThis.document = document;
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: {
        load: () => ({ state, error: null }),
        save: (nextState) => structuredClone(nextState)
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Run today's experience")[0].click();
    const renderedCount = root.replaceChildrenCount;

    controller.destroy();
    currentTime = new Date("2026-08-20T09:20:00-04:00");
    document.dispatchEvent({ type: "visibilitychange" });

    assert.equal(root.replaceChildrenCount, renderedCount);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("completing the current project persists the next project while previews cannot advance", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.teacherProgress = {
    "teacher-alpha": {
      currentProjectNumber: 2,
      completedProjectNumbers: [1]
    }
  };
  let saved = null;
  const store = {
    load: () => ({ state, error: null }),
    save: (nextState) => {
      saved = structuredClone(nextState);
      return structuredClone(nextState);
    }
  };
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };

  try {
    const controller = renderApp(root, {
      store,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-29T12:00:00.000Z") }
    });
    await controller.ready;
    controller.navigate("project-teacher");
    const complete = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Complete experience and move to next");
    assert.equal(complete.length, 1);
    complete[0].click();

    assert.equal(saved.teacherProgress["teacher:teacher-alpha"].currentProjectNumber, 3);
    assert.match(textOf(root), /Experience 3 of 36/);
    const undo = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Undo");
    assert.equal(undo.length, 1);
    assert.match(textOf(root), /Tech Terrarium marked complete/);
    undo[0].click();
    assert.equal(saved.teacherProgress["teacher-alpha"].currentProjectNumber, 2);
    assert.match(textOf(root), /Experience 2 of 36/);
    assert.doesNotMatch(textOf(root), /Tech Terrarium marked complete/);

    controller.navigate("projects");
    const future = findAll(root, (node) => node.getAttribute?.("aria-label") === "Open Experience 20: Black Box Systems");
    assert.equal(future.length, 1);
    future[0].click();
    assert.doesNotMatch(textOf(root), /Complete experience and move to next/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Settings announces import and apply results as a polite status", async () => {
  const root = await renderRoute(stateWithActiveEvent("teach"), "settings");
  const messages = findAll(root, (node) => /\bimport-message\b/.test(node.className));

  assert.equal(messages.length, 1);
  assert.equal(messages[0].getAttribute("role"), "status");
  assert.equal(messages[0].getAttribute("aria-live"), "polite");
});

test("the completed final project stays reviewable without another completion action", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.teacherProgress = {
    "teacher-alpha": {
      currentProjectNumber: 36,
      completedProjectNumbers: Array.from({ length: 36 }, (_, index) => index + 1),
      complete: true
    }
  };
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };

  try {
    const controller = renderApp(root, {
      store: memoryStore(state),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-29T12:00:00.000Z") }
    });
    await controller.ready;
    controller.navigate("project-teacher");

    assert.match(textOf(root), /All 36 experiences complete/);
    assert.doesNotMatch(textOf(root), /Mark final experience complete/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("an actionable private-seed failure keeps Today usable and shows one Settings recovery action", async () => {
  const cases = [
    {
      name: "invalid plan JSON",
      planText: "{not-json",
      options: null,
      importFails: false
    },
    {
      name: "missing migration options",
      planText: JSON.stringify({ format: "playbook.teacherPlan.v1" }),
      options: { ok: false, text: "" },
      importFails: false
    },
    {
      name: "invalid migration options",
      planText: JSON.stringify({ format: "playbook.teacherPlan.v1" }),
      options: { ok: true, text: "{not-json" },
      importFails: false
    },
    {
      name: "failed preview",
      planText: JSON.stringify({ format: "playbook.teacherPlan.v2" }),
      options: null,
      importFails: false
    },
    {
      name: "failed apply",
      planText: null,
      options: null,
      importFails: true
    }
  ];

  for (const failure of cases) {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const root = new FakeNode("main");
    const state = stateWithActiveEvent("teach");
    state.plan.teachers[0].days[1][0].label = "VISIBLE_NOW_EVENT";
    state.plan.teachers[0].days[1].push({
      id: "visible-next",
      type: "teach",
      label: "VISIBLE_NEXT_EVENT",
      start: "10:00",
      end: "10:30"
    });
    const before = structuredClone(state);
    const changedPlan = structuredClone(state.plan);
    changedPlan.teachers[0].days[1][0].label = "CHANGED_IMPORT_EVENT";
    const planText = failure.planText ?? JSON.stringify(changedPlan);
    const store = {
      load: () => ({ state, error: null }),
      importPlan: () => failure.importFails
        ? { ok: false, state: null }
        : { ok: true, state }
    };
    globalThis.document = fakeDocument();
    globalThis.window = {
      location: { hostname: "localhost" },
      setInterval: () => 1,
      clearInterval: () => {},
      fetch: async () => ({ ok: false })
    };
    try {
      const controller = renderApp(root, {
        store,
        hostname: "localhost",
        fetchImpl: async (url) => {
          if (url === "/__private__/plan.json") {
            return { ok: true, text: async () => planText };
          }
          if (url === "/__private__/migration-options.json" && failure.options) {
            return { ok: failure.options.ok, text: async () => failure.options.text };
          }
          return { ok: false, text: async () => "" };
        },
        weatherService: {},
        clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
      });
      const result = await controller.ready;
      const rendered = textOf(root);
      const recovery = findAll(root, (node) => /\bprivate-seed-recovery\b/.test(node.className));
      const settingsActions = findAll(root, (node) =>
        node.tagName === "button" && node.textContent === "Open Settings"
      );

      assert.notEqual(result.nextAction, null, failure.name);
      assert.match(rendered, /VISIBLE_NOW_EVENT/, failure.name);
      assert.match(rendered, /VISIBLE_NEXT_EVENT/, failure.name);
      assert.match(rendered, /Open Settings/, failure.name);
      assert.equal(recovery.length, 1, failure.name);
      assert.equal(recovery[0].getAttribute("role"), "status", failure.name);
      assert.equal(settingsActions.length, 1, failure.name);
      assert.deepEqual(store.load().state, before, failure.name);

      settingsActions[0].click();
      assert.match(textOf(root), /Settings/, failure.name);
    } finally {
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
    }
  }
});

test("Board hides and inerts the real header until Return to Today or destroy restores it exactly", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const header = new FakeNode("header");
  header.className = "site-header";
  header.setAttribute("aria-label", "Primary shell");
  header.setAttribute("data-shell-marker", "unchanged");
  const navButtons = ["today", "curriculum", "schedule", "room", "settings"].map((route) => {
    const button = new FakeNode("button");
    button.dataset = { route };
    button.setAttribute("data-route", route);
    button.textContent = route;
    header.append(button);
    return button;
  });
  navButtons[0].setAttribute("aria-current", "page");
  const originalAttributes = [...header.attributes.entries()];
  const originalNavAttributes = navButtons.map((button) => [...button.attributes.entries()]);
  globalThis.document = fakeDocument({ header, navButtons });
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const state = stateWithActiveEvent("teach");
    const controller = renderApp(root, {
      store: memoryStore(state),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    controller.navigate("board");
    assert.equal(header.hasAttribute("hidden"), true);
    assert.equal(header.hasAttribute("inert"), true);
    assert.equal(header.getAttribute("aria-hidden"), "true");
    assert.equal(header.getAttribute("data-shell-marker"), "unchanged");
    const boardButtons = findAll(root, (node) => node.tagName === "button");
    assert.deepEqual(boardButtons.map((node) => node.textContent), ["Return to Today"]);

    boardButtons[0].click();
    assert.deepEqual([...header.attributes.entries()], originalAttributes);
    assert.deepEqual(navButtons.map((button) => [...button.attributes.entries()]), originalNavAttributes);
    assert.match(textOf(root), /Today/);

    controller.navigate("board");
    assert.equal(header.hasAttribute("inert"), true);
    controller.destroy();
    assert.deepEqual([...header.attributes.entries()], originalAttributes);
    assert.deepEqual(navButtons.map((button) => [...button.attributes.entries()]), originalNavAttributes);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Board keeps the live region isolated across timer boundaries and restores Today safely", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const header = new FakeNode("header");
  header.className = "site-header";
  header.setAttribute("data-shell-marker", "unchanged");
  const status = new FakeNode("div");
  status.className = "visually-hidden";
  status.setAttribute("aria-live", "polite");
  const navButtons = ["today", "curriculum", "schedule", "room", "settings"].map((route) => {
    const button = new FakeNode("button");
    button.dataset = { route };
    button.setAttribute("data-route", route);
    header.append(button);
    return button;
  });
  navButtons[0].setAttribute("aria-current", "page");
  const originalHeaderAttributes = [...header.attributes.entries()];
  const originalStatusAttributes = [...status.attributes.entries()];
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  const state = stateWithActiveEvent("prep");
  state.plan.teachers[0].days[1] = [
    {
      id: "event-a",
      type: "prep",
      label: "GENERIC_INTERNAL_A",
      start: "09:00",
      end: "09:30"
    },
    {
      id: "event-b",
      type: "prep",
      label: "GENERIC_INTERNAL_B",
      start: "09:30",
      end: "10:00"
    },
    {
      id: "event-c",
      type: "prep",
      label: "GENERIC_INTERNAL_C",
      start: "10:00",
      end: "10:30"
    }
  ];
  globalThis.document = fakeDocument({ header, navButtons, status });
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: (callback) => {
      timerCallback = callback;
      return 1;
    },
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: memoryStore(state),
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    controller.navigate("board");
    assert.equal(status.hasAttribute("hidden"), true);
    assert.equal(status.hasAttribute("inert"), true);
    assert.equal(status.getAttribute("aria-hidden"), "true");
    assert.equal(status.textContent, "");

    currentTime = new Date("2026-08-20T09:31:00-04:00");
    timerCallback();
    assert.equal(status.textContent, "");
    assert.equal(status.hasAttribute("inert"), true);
    assert.doesNotMatch(status.textContent, /GENERIC_INTERNAL/);

    controller.navigate("today");
    assert.deepEqual([...header.attributes.entries()], originalHeaderAttributes);
    assert.deepEqual([...status.attributes.entries()], originalStatusAttributes);
    assert.equal(status.textContent, "");

    currentTime = new Date("2026-08-20T10:01:00-04:00");
    timerCallback();
    assert.match(status.textContent, /GENERIC_INTERNAL_C/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
