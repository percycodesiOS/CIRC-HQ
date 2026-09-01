import assert from "node:assert/strict";
import test from "node:test";

import { buildSetupHelpView, buildSetupView } from "../src/ui/setup.js";

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

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  matches(selector) {
    const normalized = selector.trim();
    if (normalized === "button") return this.tagName === "button";
    if (normalized === "input") return this.tagName === "input";
    if (normalized === "button:not([disabled])") return this.tagName === "button" && !this.hasAttribute("disabled");
    if (normalized === "input:not([disabled])") return this.tagName === "input" && !this.hasAttribute("disabled");
    return false;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((part) => part.trim());
    const matches = [];
    const visit = (node) => {
      if (selectors.some((part) => node.matches(part))) matches.push(node);
      for (const child of node.children) visit(child);
    };
    visit(this);
    return matches;
  }

  click() {
    if (!this.hasAttribute("disabled")) this.listeners.get("click")?.({ currentTarget: this });
  }

  focus() {
    this.focused = true;
  }
}

const documentDouble = {
  defaultView: { innerWidth: 390, innerHeight: 844 },
  createElement: (tagName) => new FakeNode(tagName)
};

function isFocusableControl(node) {
  return (node.matches("button:not([disabled])") || node.matches("input:not([disabled])")) && !node.hasAttribute("aria-hidden");
}

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
}

function findAll(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  for (const child of node.children) findAll(child, predicate, found);
  return found;
}

function serialize(node) {
  const attributes = [...node.attributes.entries()]
    .map(([name, value]) => ` ${name}="${String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`)
    .join("");
  const content = `${String(node.textContent).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}${node.children.map(serialize).join("")}`;
  return `<${node.tagName}${attributes}>${content}</${node.tagName}>`;
}

function model(overrides = {}) {
  return {
    mode: "setup",
    current: "account",
    completed: [],
    account: null,
    plan: {
      status: "missing",
      teacherName: null,
      cycleDayCount: null,
      eventCount: null,
      dateRange: null,
      currentDateResult: null,
      warnings: []
    },
    room: { status: "missing", name: null, role: null },
    sync: { status: "idle", lastVerifiedAt: null },
    localBackup: { status: "ready" },
    currentCycleDay: null,
    notice: null,
    ...overrides
  };
}

function actionsDouble(overrides = {}) {
  const calls = [];
  const actions = Object.fromEntries([
    "continueWithGoogle",
    "useAccount",
    "useDifferentAccount",
    "choosePlanFile",
    "confirmPlanPreview",
    "createRoom",
    "redeemInvite",
    "uploadAndVerify",
    "openToday",
    "previewExperience",
    "openSetupHelp",
    "exploreDemo",
    "exitDemo"
  ].map((name) => [name, (...args) => {
    calls.push([name, ...args]);
    return overrides[name]?.(...args);
  }]));
  return { actions: { ...actions, ...overrides }, calls };
}

function completeModel(overrides = {}) {
  return model({
    current: "complete",
    completed: ["account", "teacher", "plan", "room", "upload", "verify"],
    account: { status: "confirmed", displayName: "Kenny", maskedEmail: "k***@example.com" },
    plan: {
      status: "confirmed",
      teacherName: "Kenny",
      cycleDayCount: 5,
      eventCount: 12,
      dateRange: "August 20, 2026 to June 4, 2027",
      currentDateResult: "Cycle Day 2",
      warnings: []
    },
    room: { status: "ready", name: "CIRC Room", role: "owner" },
    sync: { status: "verified", lastVerifiedAt: "September 1, 2026 at 9:00 AM" },
    localBackup: { status: "preserved" },
    currentCycleDay: "Cycle Day 2",
    ...overrides
  });
}

test("account setup presents one mature current action and a temporary demo", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model(), actions, { document: documentDouble });
  assert.match(textOf(view), /Get CIRC HQ ready/);
  assert.match(textOf(view), /Continue with Google/);
  assert.match(textOf(view), /Explore a temporary demo/);
  assert.match(textOf(view), /Nothing in this demo is saved or synced\./);
  assert.doesNotMatch(textOf(view), /Preview without saving|circ-hq-maker/i);
});

test("setup rail marks known prior steps and keeps the current action first", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model({ current: "plan", completed: ["account", "teacher"] }), actions, { document: documentDouble });
  const rail = findAll(view, (node) => node.tagName === "ol" && node.hasAttribute("aria-label"))[0];
  assert.ok(rail);
  assert.equal(findAll(rail, (node) => node.hasAttribute("aria-current") && node.getAttribute("aria-current") === "step").length, 1);
  const html = serialize(view);
  assert.ok(html.indexOf("Choose private teacher plan") < html.indexOf("Setup help"));
});

test("390px setup puts the current primary control before the detailed rail and focus query finds it", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model(), actions, { document: documentDouble });
  const focusable = view.querySelectorAll("button, input").filter(isFocusableControl);
  const primary = focusable.find((node) => node.className.includes("setup-primary-action"));
  assert.equal(focusable[0], primary);
  assert.equal(focusable[0].textContent, "Continue with Google");
  const html = serialize(view);
  assert.ok(html.indexOf("Continue with Google") < html.indexOf("CIRC HQ setup progress"));
  assert.equal(documentDouble.defaultView.innerWidth, 390);
  assert.equal(documentDouble.defaultView.innerHeight, 844);
});

test("teacher step displays only the supplied safe account fields and wires both choices", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "teacher",
    completed: ["account"],
    account: { status: "observed", displayName: "Kenny", maskedEmail: "k***@example.com" }
  }), actions, { document: documentDouble });
  const buttons = findAll(view, (node) => node.tagName === "button");
  buttons.find((node) => node.textContent === "Use this account").click();
  buttons.find((node) => node.textContent === "Use a different account").click();
  assert.deepEqual(calls.map(([name]) => name), ["useAccount", "useDifferentAccount"]);
  assert.match(textOf(view), /Kenny/);
  assert.match(textOf(view), /k\*\*\*@example\.com/);
  assert.doesNotMatch(textOf(view), /uid|accessToken/i);
});

test("pending account state does not imply authentication completion", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model({
    current: "account",
    account: { status: "pending", displayName: null, maskedEmail: null }
  }), actions, { document: documentDouble });
  const continueButton = findAll(view, (node) => node.tagName === "button" && node.textContent === "Continue with Google")[0];
  assert.equal(continueButton.hasAttribute("disabled"), true);
  assert.match(textOf(view), /waiting for Google|observed/i);
});

test("plan step keeps local preview separate from cloud upload", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "plan",
    completed: ["account", "teacher"],
    account: { status: "confirmed", displayName: "Kenny", maskedEmail: "k***@example.com" },
    plan: {
      status: "preview",
      teacherName: "Kenny",
      cycleDayCount: 5,
      eventCount: 12,
      dateRange: "August 20, 2026 to June 4, 2027",
      currentDateResult: "Cycle Day 2",
      warnings: ["One event needs review"]
    }
  }), actions, { document: documentDouble });
  const picker = findAll(view, (node) => node.tagName === "input" && node.getAttribute("type") === "file")[0];
  picker.files = [{ name: "private-plan.json" }];
  picker.listeners.get("change")?.({ currentTarget: picker });
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Confirm plan preview")[0].click();
  assert.deepEqual(calls.map(([name]) => name), ["choosePlanFile", "confirmPlanPreview"]);
  assert.equal(calls.some(([name]) => name === "uploadAndVerify"), false);
  assert.match(textOf(view), /does not upload|private teacher information/i);
  assert.match(textOf(view), /One event needs review/);
});

test("cloud-found plan still has an explicit current confirmation action", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "plan",
    completed: ["account", "teacher"],
    account: { status: "confirmed", displayName: "Kenny", maskedEmail: "k***@example.com" },
    plan: {
      status: "cloud-found",
      teacherName: "Kenny",
      cycleDayCount: 5,
      eventCount: 12,
      dateRange: "August 20, 2026 to June 4, 2027",
      currentDateResult: "Cycle Day 2",
      warnings: []
    }
  }), actions, { document: documentDouble });
  assert.match(textOf(view), /Plan found in CIRC Cloud/);
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Use plan found in CIRC Cloud")[0].click();
  assert.deepEqual(calls, [["confirmPlanPreview"]]);
});

test("room invitation input is transient and cleared after redemption", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "room",
    completed: ["account", "teacher", "plan"],
    room: { status: "missing", name: null, role: null }
  }), actions, { document: documentDouble });
  const input = findAll(view, (node) => node.tagName === "input" && node.getAttribute("type") === "text")[0];
  input.value = "RAW-INVITE-CODE";
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Join CIRC room")[0].click();
  assert.deepEqual(calls, [["redeemInvite", "RAW-INVITE-CODE"]]);
  assert.equal(input.value, "");
  assert.doesNotMatch(serialize(view), /RAW-INVITE-CODE/);
});

test("empty invitation submission gives an explicit safe status", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({ current: "room", completed: ["account", "teacher", "plan"] }), actions, { document: documentDouble });
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Join CIRC room")[0].click();
  assert.deepEqual(calls, []);
  assert.match(textOf(view), /Enter the one-time invitation code/);
});

test("upload and verification steps expose only their own current mutation", () => {
  const { actions, calls } = actionsDouble();
  const upload = buildSetupView(model({ current: "upload", completed: ["account", "teacher", "plan", "room"] }), actions, { document: documentDouble });
  findAll(upload, (node) => node.tagName === "button" && node.textContent === "Upload and verify")[0].click();
  assert.deepEqual(calls, [["uploadAndVerify"]]);
  const verify = buildSetupView(model({ current: "verify", completed: ["account", "teacher", "plan", "room", "upload"], sync: { status: "attention", lastVerifiedAt: null } }), actions, { document: documentDouble });
  const status = findAll(verify, (node) => node.getAttribute("role") === "status")[0];
  assert.equal(status.getAttribute("aria-live"), "polite");
  assert.match(textOf(status), /Sync needs attention/);
});

test("complete step shows summary and wires the three safe destinations", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(completeModel(), actions, { document: documentDouble });
  for (const label of ["Open Today", "Preview an experience", "Setup help"]) {
    findAll(view, (node) => node.tagName === "button" && node.textContent === label)[0].click();
  }
  for (const label of ["Open Today", "Preview an experience", "Setup help"]) {
    assert.equal(findAll(view, (node) => node.tagName === "button" && node.textContent === label).length, 1);
  }
  assert.deepEqual(calls.map(([name]) => name), ["openToday", "previewExperience", "openSetupHelp"]);
  assert.match(textOf(view), /Kenny|Cycle Day 2|CIRC Room|preserved/i);
});

test("demo help exposes one enabled exit and no mutation controls", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupHelpView(model({ mode: "demo", current: "account" }), actions, { document: documentDouble });
  assert.match(textOf(view), /Nothing in this demo is saved or synced\./);
  const enabledButtons = findAll(view, (node) => node.tagName === "button" && !node.hasAttribute("disabled"));
  assert.equal(enabledButtons.length, 1);
  assert.equal(enabledButtons[0].textContent, "Exit demo and set up CIRC HQ");
  enabledButtons[0].click();
  assert.deepEqual(calls, [["exitDemo"]]);
  assert.deepEqual(findAll(view, (node) => node.tagName === "button").map((node) => node.textContent), ["Exit demo and set up CIRC HQ"]);
});

test("invalid setup model and missing callbacks fail closed", () => {
  const { actions } = actionsDouble();
  assert.throws(() => buildSetupView(model({ mode: "unknown" }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ current: "plan", completed: ["teacher", "account"] }), actions, { document: documentDouble }), /setup-model-invalid/);
  const missing = { ...actions };
  delete missing.exitDemo;
  assert.throws(() => buildSetupHelpView(model({ mode: "demo" }), missing, { document: documentDouble }), /setup-actions-invalid/);
  assert.throws(() => buildSetupView(model({ notice: { kind: "error", text: { raw: "unsafe" } } }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ notice: { kind: "error", text: "safe", raw: "unsafe" } }), actions, { document: documentDouble }), /setup-model-invalid/);
});

test("error notice is semantic and product copy has no forbidden dashes", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model({ notice: { kind: "error", text: "Cloud verification needs attention." } }), actions, { document: documentDouble });
  const alert = findAll(view, (node) => node.getAttribute("role") === "alert")[0];
  assert.ok(alert);
  assert.doesNotMatch(textOf(view), /[\u2013\u2014]/u);
});

test("setup view uses the authentic Tech Terrarium image and target classes", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model(), actions, { document: documentDouble });
  const image = findAll(view, (node) => node.tagName === "img")[0];
  assert.equal(image.getAttribute("src"), "assets/tech-terrarium-hero.webp");
  assert.ok(image.getAttribute("alt"));
  assert.match(view.className, /setup-view/);
  assert.equal(findAll(view, (node) => node.tagName === "ol" && node.className.includes("setup-rail")).length, 1);
  assert.equal(findAll(view, (node) => node.className.includes("setup-current-action")).length, 1);
});
