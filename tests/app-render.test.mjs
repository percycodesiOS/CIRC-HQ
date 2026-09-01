import assert from "node:assert/strict";
import test from "node:test";

import { renderApp } from "../src/app.js";
import { EXPERIENCE_TIMING_PLANS } from "../src/model/experience-timing-plans.js";
import {
  advanceExperienceRunnerClock,
  applyExperienceRunnerAction,
  createExperienceRunner
} from "../src/model/experience-runner.js";
import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact,
  recordArtifactHandoff
} from "../src/model/shared-artifact.js";
import { createFirebaseClient } from "../src/storage/firebase-adapter.js";

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

const ACTIVE_EVENT_IDS = Object.freeze({
  teach: "event-hf0ba7c9dbc3990338af92b9dcfdb32e9",
  prep: "event-ha00b16a95f809d2adb4173f964e956e2",
  duty: "event-h00000000000000000000000000000011",
  support: "event-h00000000000000000000000000000012",
  lunch: "event-h00000000000000000000000000000013",
  special: "event-h00000000000000000000000000000014"
});

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
            id: ACTIVE_EVENT_IDS[type],
            type,
            label: `PRIVATE_${type.toUpperCase()}_LABEL`,
            start: "09:00",
            end: "09:30",
            classId: "class-alpha",
            lessonGuideId: "guide-alpha"
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

function stateWithBackToBackEvents(secondType = "teach", secondStart = "09:15") {
  const state = stateWithActiveEvent("teach");
  const event = state.plan.teachers[0].days[1][0];
  const secondEvent = {
    ...event,
    id: "event-hb216263b8f031416093bc8463e4c839e",
    type: secondType,
    label: "PRIVATE_SECOND_CLASS",
    start: secondStart,
    end: "09:30"
  };
  if (secondType !== "teach") {
    delete secondEvent.classId;
    delete secondEvent.lessonGuideId;
  }
  state.plan.teachers[0].days[1] = [
    {
      ...event,
      id: "event-h6b5a7460fe1292f2d2cc9dfd4a798b8b",
      label: "PRIVATE_FIRST_CLASS",
      start: "09:00",
      end: "09:15"
    },
    secondEvent
  ];
  state.sharedArtifacts = {};
  return state;
}

async function exerciseTeachingEventBoundary({ pauseRunner }) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithBackToBackEvents();
  const saves = [];
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
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
          const saved = structuredClone(nextState);
          saves.push(saved);
          return structuredClone(saved);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
    if (pauseRunner) {
      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class")[0].click();
      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Pause")[0].click();
      assert.match(textOf(root), /Resume/);
    } else {
      assert.match(textOf(root), /Start class/);
    }

    assert.equal(textOf(findAll(root, (node) => /\bartifact-class-chip\b/.test(node.className))[0]), "PRIVATE_FIRST_CLASS");
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Repeat")[0].click();
    const staleConfirm = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0];
    const savesBeforeBoundary = saves.length;
    assert.doesNotMatch(
      textOf(findAll(root, (node) => /\bartifact-confirmation\b/.test(node.className))[0]),
      /PRIVATE_FIRST_CLASS|PRIVATE_SECOND_CLASS/
    );
    assert.deepEqual(saves.at(-1).sharedArtifacts, {});

    currentTime = new Date("2026-08-20T09:16:00-04:00");
    timerCallback();

    assert.equal(textOf(findAll(root, (node) => /\bartifact-class-chip\b/.test(node.className))[0]), "PRIVATE_SECOND_CLASS");
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff").length, 0);
    for (const label of ["Ready", "Repeat", "Park"]) {
      assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 1, label);
    }
    staleConfirm.click();
    assert.equal(saves.length, savesBeforeBoundary);
    assert.deepEqual(saves.at(-1).sharedArtifacts, {});

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Repeat")[0].click();
    const currentConfirm = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0];
    currentConfirm.click();
    currentConfirm.click();

    assert.equal(saves.length, savesBeforeBoundary + 1);
    const artifact = saves.at(-1).sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID];
    assert.equal(artifact.visits.length, 1);
    assert.equal(artifact.visits[0].eventId, "event-hb216263b8f031416093bc8463e4c839e");
    assert.equal(artifact.visits[0].handoff, "repeat");
    assert.doesNotMatch(JSON.stringify(artifact), /PRIVATE_FIRST_CLASS|PRIVATE_SECOND_CLASS/);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

function activeArtifact({ handoff = null } = {}) {
  const artifact = createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: "2026-08-20T12:00:00.000Z"
  });
  return handoff
    ? recordArtifactHandoff(artifact, {
        handoff,
        eventId: "event-h8f1609b8f944cedc4349a970a8240522",
        visitDate: "2026-08-20",
        nowIso: "2026-08-20T12:05:00.000Z"
      })
    : artifact;
}

function stateWithoutPlan() {
  const state = stateWithActiveEvent("teach");
  state.plan = null;
  state.teacherProgress = {};
  state.experienceRunners = {};
  return state;
}

test("a device without a plan starts on mature guided setup", async () => {
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
    assert.match(rendered, /Get CIRC HQ ready/);
    assert.match(rendered, /Continue with Google/);
    assert.match(rendered, /Explore a temporary demo/);
    assert.doesNotMatch(rendered, /Set up this device|Preview without saving/);
    const makerImages = findAll(root, (node) =>
      node.tagName === "img" && node.getAttribute("src") === "assets/tech-terrarium-hero.webp"
    );
    assert.equal(makerImages.length, 1);
    assert.equal(controller.previewOnly, true);
    assert.equal(findAll(root, (node) => node.tagName === "input").length, 0);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("temporary demo performs no durable or cloud work and has a direct exit", async () => {
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
      node.tagName === "button" && node.textContent === "Explore a temporary demo"
    );
    assert.equal(preview.length, 1);
    preview[0].click();

    assert.equal(controller.previewOnly, true);
    assert.match(textOf(root), /Temporary CIRC HQ demo/);
    const exit = findAll(root, (node) =>
      node.tagName === "button" && node.textContent === "Exit demo and set up CIRC HQ"
    );
    assert.equal(exit.length, 1);
    assert.equal(saveCount, 0);
    assert.deepEqual(state, original);
    assert.equal(state.plan, null);
    assert.deepEqual(state.experienceRunners, {});
    assert.deepEqual(state.teacherProgress, {});
    exit[0].click();
    assert.match(textOf(root), /Get CIRC HQ ready/);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("guided setup exposes no plan or teaching mutation before account confirmation", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithoutPlan();
  const original = structuredClone(state);
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
          throw new Error("plan import must stay unavailable before account confirmation");
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

    assert.match(textOf(root), /Continue with Google/);
    assert.equal(findAll(root, (node) =>
      node.tagName === "input" && node.getAttribute("type") === "file"
    ).length, 0);

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
    assert.equal(picker.hasAttribute("disabled"), true);
    assert.equal(importCount, 0);
    assert.equal(saveCount, 0);
    assert.equal(controller.previewOnly, true);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("temporary demo to Teacher Setup remains read-only and cannot Apply an import", async () => {
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
      node.tagName === "button" && node.textContent === "Explore a temporary demo"
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

test("a valid local plan renders Today before a deferred cloud client resolves", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  let resolveClient;
  const cloudClientPromise = new Promise((resolve) => {
    resolveClient = resolve;
  });
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const controller = renderApp(root, {
      store: memoryStore(stateWithActiveEvent("teach")),
      cloudClientPromise,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    let ready = false;
    controller.ready.then(() => {
      ready = true;
    });

    assert.match(textOf(root), /Today/);
    await Promise.resolve();
    assert.equal(ready, false);

    resolveClient(createFirebaseClient());
    await controller.ready;
    assert.match(textOf(root), /Today/);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a validated localhost plan import leaves guided Setup for Today", async () => {
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

    assert.match(textOf(root), /Get CIRC HQ ready/);
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
  assert.match(rendered, /Open class runner/);
  assert.match(rendered, /Teacher script/);
  assert.match(rendered, /Student directions/);
  assert.match(rendered, /Designer's Challenge/);
  assert.match(rendered, /36-experience year map/i);
  assert.match(rendered, /Open Playbooks/);
  assert.match(rendered, /PRIVATE_TEACH_LABEL/);
  assert.equal(findAll(root, (node) => /\bproject-trail-step\b/.test(node.className)).length, 36);
});

test("Today and the project 2 teacher runner derive a private-safe artifact display and persist only a confirmed handoff", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.sharedArtifacts = {};
  const saves = [];
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    const store = {
      load: () => ({ state: saves.at(-1) ?? state, error: null }),
      save: (nextState) => {
        const saved = structuredClone(nextState);
        saves.push(saved);
        return structuredClone(saved);
      }
    };
    let controller = renderApp(root, {
      store,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    assert.match(textOf(root), /Define the system/);
    assert.match(textOf(root), /Inspect and map the system/);
    const todayChip = findAll(root, (node) => /\bartifact-class-chip\b/.test(node.className));
    assert.equal(todayChip.length, 1);
    assert.equal(textOf(todayChip[0]), "PRIVATE_TEACH_LABEL");
    assert.equal(saves.length, 0);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0].sharedArtifacts, {});
    assert.match(textOf(root), /Define the system/);
    assert.match(textOf(root), /Inspect and map the system/);
    for (const label of ["Ready", "Repeat", "Park"]) {
      assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 1, label);
    }

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Ready")[0].click();
    assert.equal(saves.length, 1);
    assert.match(textOf(root), /Confirm handoff/);
    assert.match(textOf(root), /Cancel/);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Cancel")[0].click();
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0].sharedArtifacts, {});
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff").length, 0);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Ready")[0].click();
    assert.equal(saves.length, 1);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0].click();
    assert.equal(saves.length, 2);
    const artifact = saves[1].sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID];
    assert.equal(artifact.stageId, "define");
    assert.equal(artifact.contributionIndex, 1);
    assert.equal(artifact.visits.length, 1);
    assert.equal(artifact.visits[0].eventId, "event-hf0ba7c9dbc3990338af92b9dcfdb32e9");
    assert.equal(JSON.stringify(artifact).includes("PRIVATE_TEACH_LABEL"), false);
    assert.match(textOf(root), /Mark living and nonliving zones/);

    controller.destroy();
    controller = renderApp(root, {
      store,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;
    assert.match(textOf(root), /Mark living and nonliving zones/);
    assert.equal(saves.length, 2);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a Ready runner clears a first-event confirmation and refreshes the class chip at a teaching boundary", async () => {
  await exerciseTeachingEventBoundary({ pauseRunner: false });
});

test("a paused runner clears a first-event confirmation and refreshes the class chip at a teaching boundary", async () => {
  await exerciseTeachingEventBoundary({ pauseRunner: true });
});

test("a teaching boundary into no current or non-teaching work clears pending handoffs and controls", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    for (const scenario of ["no-current", "non-teach"]) {
      const root = new FakeNode("main");
      const state = stateWithBackToBackEvents(
        scenario === "non-teach" ? "prep" : "teach",
        scenario === "no-current" ? "09:20" : "09:15"
      );
      const saves = [];
      let currentTime = new Date("2026-08-20T09:10:00-04:00");
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
      const controller = renderApp(root, {
        store: {
          load: () => ({ state, error: null }),
          save: (nextState) => {
            const saved = structuredClone(nextState);
            saves.push(saved);
            return structuredClone(saved);
          }
        },
        loadPrivateSeed: false,
        weatherService: {},
        clock: { now: () => currentTime }
      });
      await controller.ready;

      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Repeat")[0].click();
      const staleConfirm = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0];
      const savesBeforeBoundary = saves.length;

      currentTime = new Date("2026-08-20T09:16:00-04:00");
      timerCallback();

      assert.equal(findAll(root, (node) => /\bartifact-class-chip\b/.test(node.className)).length, 0, scenario);
      for (const label of ["Ready", "Repeat", "Park", "Confirm handoff"]) {
        assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 0, `${scenario}:${label}`);
      }
      staleConfirm.click();
      assert.equal(saves.length, savesBeforeBoundary, scenario);
      assert.deepEqual(saves.at(-1).sharedArtifacts, {}, scenario);
      controller.destroy();
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Preview, no plan, no current event, and a current non-teaching event cannot write artifact handoffs", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    for (const scenario of ["preview", "no-current", "non-teach"]) {
      const root = new FakeNode("main");
      const state = scenario === "preview" ? stateWithoutPlan() : stateWithActiveEvent(scenario === "non-teach" ? "prep" : "teach");
      state.sharedArtifacts = {};
      if (scenario === "no-current") {
        state.plan.teachers[0].days[1][0].start = "10:00";
        state.plan.teachers[0].days[1][0].end = "10:30";
      } else if (scenario === "non-teach") {
        delete state.plan.teachers[0].days[1][0].classId;
        delete state.plan.teachers[0].days[1][0].lessonGuideId;
      }
      let saveCount = 0;
      let saved = null;
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
            saved = structuredClone(nextState);
            return structuredClone(nextState);
          }
        },
        loadPrivateSeed: false,
        weatherService: {},
        clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
      });
      await controller.ready;
      if (scenario === "preview") {
        findAll(root, (node) => node.tagName === "button" && textOf(node) === "Explore a temporary demo")[0].click();
        findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview an experience")[0].click();
        findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview experience")[0].click();
      } else {
        findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
      }

      for (const label of ["Ready", "Repeat", "Park", "Confirm handoff"]) {
        assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 0, `${scenario}:${label}`);
      }
      assert.deepEqual(saved?.sharedArtifacts ?? {}, {});
      assert.equal(saveCount, scenario === "preview" ? 0 : 1);
      controller.destroy();
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("overlapping current teaching events retain deterministic first-match handoff ownership", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    for (const ids of [["event-hc6a89201a93603303b8e263b95fbf658", "event-h5493c11d3af0eefee682664d58d85249"], ["event-h5493c11d3af0eefee682664d58d85249", "event-hc6a89201a93603303b8e263b95fbf658"]]) {
      const root = new FakeNode("main");
      const state = stateWithActiveEvent("teach");
      const event = state.plan.teachers[0].days[1][0];
      state.plan.teachers[0].days[1] = ids.map((id) => ({
        ...event,
        id,
        label: `PRIVATE_${id}`
      }));
      state.sharedArtifacts = {};
      let saved = null;
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
            saved = structuredClone(nextState);
            return structuredClone(nextState);
          }
        },
        loadPrivateSeed: false,
        weatherService: {},
        clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
      });
      await controller.ready;
      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Repeat")[0].click();
      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0].click();

      const serialized = JSON.stringify(saved.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID]);
      assert.equal(saved.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits[0].eventId, ids[0]);
      assert.doesNotMatch(serialized, /PRIVATE_event-overlap/);
      controller.destroy();
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a clock rollback cannot crash or write a confirmed artifact handoff", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: {
      ...activeArtifact(),
      updatedAt: "2026-08-20T14:00:00.000Z"
    }
  };
  const artifactBefore = structuredClone(state.sharedArtifacts);
  let saveCount = 0;
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
          saveCount += 1;
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Ready")[0].click();
    const confirm = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0];
    assert.doesNotThrow(() => confirm.click());
    assert.equal(saveCount, 1);
    assert.deepEqual(saved.sharedArtifacts, artifactBefore);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff").length, 0);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("a complete artifact remains final and exposes no handoff controls", async () => {
  const state = stateWithActiveEvent("teach");
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: {
      ...activeArtifact(),
      stageId: "test",
      contributionIndex: 2,
      status: "complete"
    }
  };
  state.experienceRunners = {
    "teacher:teacher-alpha": createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
      teacherKey: "teacher:teacher-alpha",
      nowIso: "2026-08-20T13:00:00.000Z",
      modeId: "build-new"
    })
  };
  const root = await renderRoute(state, "experience-runner");
  const rendered = textOf(root);

  assert.match(rendered, /Test and communicate/);
  assert.match(rendered, /Prepare one next-class handoff summary/);
  assert.match(rendered, /Artifact complete/);
  for (const label of ["Ready", "Repeat", "Park", "Confirm handoff"]) {
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 0, label);
  }
});

test("Board and Student views receive no artifact history, current class chip, or handoff controls", async () => {
  const state = stateWithActiveEvent("teach");
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: activeArtifact({ handoff: "repeat" })
  };
  const boardText = await renderBoard(state);
  const studentText = textOf(await renderRoute(state, "project-student"));

  for (const rendered of [boardText, studentText]) {
    assert.doesNotMatch(rendered, /event-artifact-private|Inspect and map the system|Define the system|PRIVATE_TEACH_LABEL/);
    assert.doesNotMatch(rendered, /Ready|Repeat|Park|Confirm handoff/);
  }
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

test("Open class runner opens one live runner and Student directions keeps its timers without teacher content or a trapped exit", async () => {
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

    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner");
    assert.equal(run.length, 1);
    run[0].click();
    assert.match(textOf(root), /This device is running the class/);
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
    assert.match(textOf(root), /Open class runner/);
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

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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
      complete: false,
      updatedAt: "2026-08-20T12:00:00.000Z"
    }
  };
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: activeArtifact({ handoff: "repeat" })
  };
  const progressBefore = structuredClone(state.teacherProgress);
  const artifactsBefore = structuredClone(state.sharedArtifacts);
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

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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
    assert.equal(saved.teacherProgress["teacher:teacher-alpha"].currentProjectNumber, 2);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("an expired-step detour names available recovery controls while ordinary expiry keeps Next Step guidance", async () => {
  const state = stateWithActiveEvent("teach");
  let expired = createExperienceRunner(EXPERIENCE_TIMING_PLANS[1], {
    teacherKey: "teacher:teacher-alpha",
    nowIso: "2026-08-20T13:00:00.000Z",
    modeId: "build-new"
  });
  expired = applyExperienceRunnerAction(expired, "start", {
    teacherKey: "teacher:teacher-alpha",
    nowIso: "2026-08-20T13:00:00.000Z"
  });
  expired = advanceExperienceRunnerClock(expired, {
    teacherKey: "teacher:teacher-alpha",
    nowIso: "2026-08-20T13:03:00.000Z"
  });
  assert.equal(expired.timer.status, "step-expired");

  const ordinaryState = structuredClone(state);
  ordinaryState.experienceRunners = { "teacher:teacher-alpha": expired };
  const ordinaryRoot = await renderRoute(ordinaryState, "experience-runner");
  assert.match(textOf(ordinaryRoot), /Choose Next Step when the class is ready\./);
  assert.equal(
    findAll(ordinaryRoot, (node) => node.tagName === "button" && textOf(node) === "Next Step").length,
    1
  );

  const detoured = applyExperienceRunnerAction(expired, "start-detour", {
    teacherKey: "teacher:teacher-alpha",
    nowIso: "2026-08-20T13:03:00.000Z"
  });
  const detourState = structuredClone(state);
  detourState.experienceRunners = { "teacher:teacher-alpha": detoured };
  const detourRoot = await renderRoute(detourState, "experience-runner");
  const detourText = textOf(detourRoot);
  assert.doesNotMatch(detourText, /Choose Next Step/);
  assert.match(detourText, /Step time is up\. Return to build or choose Safe Landing\./);
  assert.equal(
    findAll(detourRoot, (node) => node.tagName === "button" && textOf(node) === "Next Step").length,
    0
  );
  for (const label of ["Return to build", "Safe Landing"]) {
    assert.equal(
      findAll(detourRoot, (node) => node.tagName === "button" && textOf(node) === label).length,
      1,
      label
    );
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

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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

      findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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

test("temporary demo opens an in-memory preview runner that cannot save or complete", async () => {
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

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Explore a temporary demo")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview an experience")[0].click();
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

    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner");
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
    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner");
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
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();

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
    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner");
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
    const run = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner");
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
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: activeArtifact({ handoff: "repeat" })
  };
  const artifactBefore = structuredClone(state.sharedArtifacts);
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  let saveCount = 0;
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
          saveCount += 1;
          saved = structuredClone(nextState);
          return structuredClone(nextState);
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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
    assert.deepEqual(state.sharedArtifacts, artifactBefore);
    assert.deepEqual(saved.sharedArtifacts, artifactBefore);
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
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: activeArtifact({ handoff: "repeat" })
  };
  const artifactBefore = structuredClone(state.sharedArtifacts);
  const runner = runningLastStepRunner();
  state.experienceRunners = { "teacher:teacher-alpha": runner };
  let saveCount = 0;
  let saved = null;
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
          saved = structuredClone(nextState);
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

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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
    assert.deepEqual(state.sharedArtifacts, artifactBefore);
    assert.deepEqual(saved.sharedArtifacts, artifactBefore);
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
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
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
    "teacher:teacher-alpha": {
      currentProjectNumber: 2,
      completedProjectNumbers: [1],
      complete: false,
      updatedAt: "2026-08-20T12:00:00.000Z"
    }
  };
  state.sharedArtifacts = {
    [TECH_TERRARIUM_ARTIFACT_ID]: activeArtifact({ handoff: "repeat" })
  };
  const artifactBefore = structuredClone(state.sharedArtifacts);
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
    assert.deepEqual(saved.sharedArtifacts, artifactBefore);
    assert.match(textOf(root), /Experience 3 of 36/);
    const undo = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Undo");
    assert.equal(undo.length, 1);
    assert.match(textOf(root), /Tech Terrarium marked complete/);
    undo[0].click();
    assert.equal(saved.teacherProgress["teacher:teacher-alpha"].currentProjectNumber, 2);
    assert.deepEqual(saved.sharedArtifacts, artifactBefore);
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
      id: "event-h4519663a08ae0f14564497c01b32d076",
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
      id: "event-hcbf7f07b5859c901a6d66590bc32250d",
      type: "prep",
      label: "GENERIC_INTERNAL_A",
      start: "09:00",
      end: "09:30"
    },
    {
      id: "event-he52c1fa7a33a3f5b4e4b08b10a6d2108",
      type: "prep",
      label: "GENERIC_INTERNAL_B",
      start: "09:30",
      end: "10:00"
    },
    {
      id: "event-h4a4efd5e55362ed79f63e76aaed4fea2",
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

test("a recovered backup renders a visible truthful recovery notice", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
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
        load: () => ({
          state,
          status: "recovered-backup",
          error: "Recovered saved playbook state from the local backup"
        }),
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

    const notices = findAll(root, (node) =>
      /recovered.*local backup/i.test(textOf(node)) &&
      ["alert", "status"].includes(node.getAttribute("role"))
    );
    assert.equal(notices.length, 1);
    assert.match(textOf(notices[0]), /primary.*could not be read|saved primary/i);
    assert.doesNotMatch(textOf(notices[0]), /first use|new setup|clean start/i);
    assert.equal(saveCount, 0);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("unrecoverable state stays visibly locked until a valid full-state backup is previewed and explicitly restored", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const restoredState = {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-08-31T12:00:00.000Z",
    plan: null,
    teacherProgress: {},
    experienceRunners: {},
    sharedArtifacts: {},
    checklist: [],
    classes: [],
    lessonGuides: [],
    specialEvents: [],
    resources: [],
    notes: [],
    preferences: {},
    tombstones: []
  };
  let locked = true;
  let current = structuredClone(restoredState);
  const calls = { restore: [], ordinary: [], metadata: [] };
  const store = {
    load: () => locked
      ? {
          state: structuredClone(restoredState),
          status: "unrecoverable",
          error: "Saved state could not be read and no valid local backup was available"
        }
      : { state: structuredClone(current), status: "primary", error: null },
    restoreState(candidate) {
      calls.restore.push(structuredClone(candidate));
      current = structuredClone(candidate);
      locked = false;
      return structuredClone(candidate);
    },
    save() {
      calls.ordinary.push("save");
      throw new Error("ordinary save must stay locked");
    },
    importPlan() {
      calls.ordinary.push("importPlan");
      throw new Error("ordinary import must stay locked");
    },
    exportState() {
      calls.ordinary.push("exportState");
      throw new Error("ordinary export must stay locked");
    },
    backup() {
      calls.ordinary.push("backup");
      throw new Error("ordinary backup must stay locked");
    },
    saveDeviceMetadata(metadata) {
      const saved = structuredClone(metadata);
      calls.metadata.push(saved);
      return saved;
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
      clock: { now: () => new Date("2026-08-31T09:10:00-04:00") }
    });
    await controller.ready;

    assert.match(textOf(root), /saved state.*could not be read|unrecoverable/i);
    assert.match(textOf(root), /read-only/i);
    assert.match(textOf(root), /do not clear.*site data.*accept.*loss/i);
    assert.doesNotMatch(textOf(root), /Preview without saving|Set up this device/);
    controller.navigate("today");
    controller.navigate("settings");
    assert.match(textOf(root), /read-only/i);
    assert.deepEqual(calls.ordinary, []);

    const picker = findAll(root, (node) =>
      node.tagName === "input" && node.getAttribute("id") === "full-state-backup-file"
    )[0];
    const label = findAll(root, (node) =>
      node.tagName === "label" &&
      textOf(node) === "Choose full-state backup file" &&
      node.getAttribute("for") === "full-state-backup-file"
    );
    const previewButton = findAll(root, (node) =>
      node.tagName === "button" && textOf(node) === "Preview restore"
    )[0];
    const restoreButton = findAll(root, (node) =>
      node.tagName === "button" && textOf(node) === "Restore backup"
    )[0];
    assert.ok(picker);
    assert.equal(label.length, 1);
    assert.ok(previewButton);
    assert.ok(restoreButton);
    assert.equal(restoreButton.hasAttribute("disabled"), true);

    picker.files = [{
      text: async () => JSON.stringify({ ...restoredState, studentRoster: ["individual record"] })
    }];
    await previewButton.listeners.get("click")?.({ currentTarget: previewButton });
    assert.equal(calls.restore.length, 0);
    assert.equal(restoreButton.hasAttribute("disabled"), true);
    assert.match(textOf(root), /invalid|cannot be restored/i);

    picker.files = [{ text: async () => JSON.stringify(restoredState) }];
    await previewButton.listeners.get("click")?.({ currentTarget: previewButton });
    assert.equal(calls.restore.length, 0);
    assert.equal(restoreButton.hasAttribute("disabled"), false);
    assert.match(textOf(root), /ready.*restore|preview.*valid/i);

    restoreButton.click();
    assert.equal(calls.restore.length, 1);
    assert.deepEqual(calls.restore[0], restoredState);
    assert.deepEqual(calls.ordinary, []);
    assert.deepEqual(calls.metadata.at(-1)?.pendingDomains, [
      "plan",
      "progress",
      "preferences",
      "content"
    ]);
    assert.match(textOf(root), /Get CIRC HQ ready|Continue with Google/);
    assert.doesNotMatch(textOf(root), /unrecoverable|do not clear.*site data/i);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("configured Preview lesson is in memory, exits cleanly, then live runner stays Ready until Start class", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const root = new FakeNode("main");
  const state = stateWithActiveEvent("teach");
  state.teacherProgress = {
    "teacher:teacher-alpha": {
      currentProjectNumber: 2,
      completedProjectNumbers: [1],
      complete: false,
      updatedAt: "2026-08-20T12:00:00.000Z"
    }
  };
  state.sharedArtifacts = {};
  const progressBefore = structuredClone(state.teacherProgress);
  const artifactsBefore = structuredClone(state.sharedArtifacts);
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  const saves = [];
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
        load: () => ({ state, error: null, status: "primary" }),
        importPlan: () => { throw new Error("configured preview must not import"); },
        save: (nextState) => {
          const saved = structuredClone(nextState);
          saves.push(saved);
          return saved;
        }
      },
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;

    const preview = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview lesson");
    const live = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner");
    assert.equal(preview.length, 1);
    assert.equal(live.length, 1);

    preview[0].click();
    assert.equal(controller.previewOnly, true);
    assert.match(textOf(root), /Preview only/);
    assert.equal(saves.length, 0);
    assert.deepEqual(state.teacherProgress, progressBefore);
    assert.deepEqual(state.sharedArtifacts, artifactsBefore);
    assert.equal(state.experienceRunners?.["teacher:teacher-alpha"], undefined);
    for (const label of ["Ready", "Repeat", "Park", "Confirm handoff", "Complete experience and move to next"]) {
      assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 0, label);
    }

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Student directions")[0].click();
    assert.match(textOf(root), /Preview only/);
    assert.doesNotMatch(textOf(root), /Teacher script|Teacher moves|Confirm handoff/);
    assert.equal(saves.length, 0);
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Exit student view")[0].click();

    assert.equal(controller.previewOnly, false);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview lesson").length, 1);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner").length, 1);
    assert.equal(saves.length, 0);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
    assert.equal(controller.previewOnly, false);
    assert.equal(saves.length, 1);
    assert.equal(saves[0].experienceRunners["teacher:teacher-alpha"].timer.status, "ready");
    const initialTimers = findAll(root, (node) => /\brunner-timer-value\b/.test(node.className)).map(textOf);
    currentTime = new Date("2026-08-20T09:10:30-04:00");
    timerCallback();
    assert.deepEqual(findAll(root, (node) => /\brunner-timer-value\b/.test(node.className)).map(textOf), initialTimers);
    assert.equal(saves.length, 1);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class").length, 1);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Start class")[0].click();
    assert.equal(saves.length, 2);
    assert.equal(saves[1].experienceRunners["teacher:teacher-alpha"].timer.status, "running");
    assert.deepEqual(saves[1].teacherProgress, progressBefore);
    assert.deepEqual(saves[1].sharedArtifacts, artifactsBefore);

    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Back to Today")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Preview lesson")[0].click();
    controller.navigate("settings");
    controller.navigate("today");
    assert.equal(controller.previewOnly, false);
    assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner").length, 1);
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("Teacher Setup file chooser has a visible associated name when enabled and in disabled Preview", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = fakeDocument();
  globalThis.window = {
    location: { hostname: "example.test" },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: async () => ({ ok: false })
  };
  try {
    for (const configured of [true, false]) {
      const root = new FakeNode("main");
      const state = configured ? stateWithActiveEvent("teach") : stateWithoutPlan();
      const controller = renderApp(root, {
        store: memoryStore(state),
        loadPrivateSeed: false,
        weatherService: {},
        clock: { now: () => new Date("2026-08-20T09:10:00-04:00") }
      });
      await controller.ready;
      if (!configured) {
        findAll(root, (node) => node.tagName === "button" && textOf(node) === "Explore a temporary demo")[0].click();
      }
      controller.navigate("settings");
      const input = findAll(root, (node) => node.tagName === "input" && node.getAttribute("type") === "file")[0];
      const labels = findAll(root, (node) =>
        node.tagName === "label" &&
        textOf(node) === "Choose teacher plan file" &&
        node.getAttribute("for") === input.getAttribute("id")
      );
      assert.equal(labels.length, 1, configured ? "enabled" : "preview");
      assert.equal(input.getAttribute("id"), "teacher-plan-file");
      assert.equal(input.hasAttribute("disabled"), !configured);
      controller.destroy();
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test("artifact handoff controls are inert after one event visit, across detached clicks and reload, then return next visit date", async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  let currentTime = new Date("2026-08-20T09:10:00-04:00");
  let timerCallback = null;
  let persisted = stateWithActiveEvent("teach");
  persisted.sharedArtifacts = {};
  let saveCount = 0;
  const store = {
    load: () => ({ state: structuredClone(persisted), error: null, status: "primary" }),
    save: (nextState) => {
      saveCount += 1;
      persisted = structuredClone(nextState);
      return structuredClone(persisted);
    }
  };
  const installWindow = () => {
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
  };
  try {
    installWindow();
    let root = new FakeNode("main");
    let controller = renderApp(root, {
      store,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
    const ready = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Ready")[0];
    assert.ok(ready, textOf(root));
    ready.click();
    const confirm = findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0];
    const beforeConfirm = saveCount;
    confirm.click();
    confirm.click();
    ready.click();
    assert.equal(saveCount, beforeConfirm + 1);
    assert.equal(persisted.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits.length, 1);
    assert.equal(persisted.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits[0].visitDate, "2026-08-20");
    for (const label of ["Ready", "Repeat", "Park", "Confirm handoff"]) {
      assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 0, label);
    }
    controller.destroy();

    installWindow();
    root = new FakeNode("main");
    controller = renderApp(root, {
      store,
      loadPrivateSeed: false,
      weatherService: {},
      clock: { now: () => currentTime }
    });
    await controller.ready;
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Open class runner")[0].click();
    for (const label of ["Ready", "Repeat", "Park", "Confirm handoff"]) {
      assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 0, `reload:${label}`);
    }
    const beforeLaterVisit = saveCount;
    currentTime = new Date("2026-08-27T09:10:00-04:00");
    timerCallback();
    for (const label of ["Ready", "Repeat", "Park"]) {
      assert.equal(findAll(root, (node) => node.tagName === "button" && textOf(node) === label).length, 1, `next:${label}`);
    }
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Repeat")[0].click();
    findAll(root, (node) => node.tagName === "button" && textOf(node) === "Confirm handoff")[0].click();
    assert.equal(saveCount, beforeLaterVisit + 1);
    assert.equal(persisted.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits.length, 2);
    assert.deepEqual(
      persisted.sharedArtifacts[TECH_TERRARIUM_ARTIFACT_ID].visits.map((visit) => visit.visitDate),
      ["2026-08-20", "2026-08-27"]
    );
    controller.destroy();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
