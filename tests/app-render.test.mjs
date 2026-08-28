import assert from "node:assert/strict";
import test from "node:test";

import { renderApp } from "../src/app.js";

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

function fakeDocument({ header = null, navButtons = [] } = {}) {
  return {
    createElement: (tagName) => new FakeNode(tagName),
    createElementNS: (_namespace, tagName) => new FakeNode(tagName),
    querySelector: (selector) => selector === ".site-header" ? header : null,
    querySelectorAll: (selector) => selector === "[data-route]" ? navButtons : [],
    getElementById: () => null
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

async function renderRoom(state) {
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
    controller.navigate("room");
    return root;
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

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
      href: "/classroom-legacy.html"
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
  assert.equal(anchors[0].getAttribute("href"), "/classroom-legacy.html");
  assert.equal(anchors[0].getAttribute("target"), null);
  assert.equal(anchors[0].getAttribute("rel"), null);
  assert.equal(anchors[1].getAttribute("href"), "https://example.invalid/generic");
  assert.equal(anchors[1].getAttribute("target"), "_blank");
  assert.equal(anchors[1].getAttribute("rel"), "noopener noreferrer");
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
