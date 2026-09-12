import assert from "node:assert/strict";
import test from "node:test";

import { buildSetupHelpView, buildSetupView } from "../src/ui/setup.js";

const VALID_INVITE_CODE = "ABCDEFGHJ-KMNPQRSTV-WXYZ23456";

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
    sync: { status: "idle", lastVerifiedAt: null, pendingDomains: [], conflictDomains: [] },
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
    "signUpWithEmail",
    "signInWithEmail",
    "requestPasswordReset",
    "useAccount",
    "useDifferentAccount",
    "openSchedule",
    "confirmPlanPreview",
    "createRoom",
    "redeemInvite",
    "uploadAndVerify",
    "openToday",
    "previewExperience",
    "openSetupHelp",
    "exploreDemo",
    "exitDemo",
    "syncNow",
    "exportLocalBackup",
    "replaceTeacherPlan",
    "signOut",
    "useCloudPlan",
    "keepLocalPlan",
    "returnToSetup"
  ].map((name) => [name, (...args) => {
    calls.push([name, ...args]);
    return overrides[name]?.(...args);
  }]));
  return { actions: { ...actions, ...overrides }, calls };
}

function completeModel(overrides = {}) {
  return model({
    current: "ready",
    completed: ["account", "teacher", "schedule", "sync", "verify"],
    account: { status: "confirmed", displayName: "Teacher Alpha", maskedEmail: "t***@example.com" },
    plan: {
      status: "confirmed",
      teacherName: "Teacher Alpha",
      cycleDayCount: 5,
      eventCount: 12,
      dateRange: "August 20, 2026 to June 4, 2027",
      currentDateResult: "Cycle Day 2",
      warnings: []
    },
    room: { status: "ready", name: "CIRC Room", role: "owner" },
    sync: { status: "verified", lastVerifiedAt: "September 1, 2026 at 9:00 AM", pendingDomains: [], conflictDomains: [] },
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
  const view = buildSetupView(model({ current: "schedule", completed: ["account", "teacher"] }), actions, { document: documentDouble });
  const rail = findAll(view, (node) => node.tagName === "ol" && node.hasAttribute("aria-label"))[0];
  assert.ok(rail);
  assert.equal(findAll(rail, (node) => node.hasAttribute("aria-current") && node.getAttribute("aria-current") === "step").length, 1);
  const html = serialize(view);
  assert.ok(html.indexOf("Build your schedule") < html.indexOf("Setup help"));
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
    account: { status: "observed", displayName: "Teacher Alpha", maskedEmail: "t***@example.com" }
  }), actions, { document: documentDouble });
  const buttons = findAll(view, (node) => node.tagName === "button");
  buttons.find((node) => node.textContent === "Use this account").click();
  buttons.find((node) => node.textContent === "Use a different account").click();
  assert.deepEqual(calls.map(([name]) => name), ["useAccount", "useDifferentAccount"]);
  assert.match(textOf(view), /Teacher Alpha/);
  assert.match(textOf(view), /t\*\*\*@example\.com/);
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
  assert.match(textOf(view), /Waiting for your account to finish signing in\./);
  assert.doesNotMatch(textOf(view), /Firebase/);
});

test("missing schedule offers a plain language builder without a file picker", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "schedule",
    completed: ["account", "teacher"],
    account: { status: "confirmed", displayName: "Teacher Alpha", maskedEmail: "t***@example.com" }
  }), actions, { document: documentDouble });

  findAll(view, (node) => node.tagName === "button" && node.textContent === "Build my schedule")[0].click();

  assert.deepEqual(calls, [["openSchedule"]]);
  assert.equal(findAll(view, (node) => node.tagName === "input" && node.getAttribute("type") === "file").length, 0);
  assert.doesNotMatch(textOf(view), /JSON|schema|migration/i);
});

test("email signup accepts school addresses, confirms passwords and clears secrets before calling the action", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model(), actions, { document: documentDouble });
  assert.match(textOf(view), /Sign up with any email/);
  assert.match(textOf(view), /school or any other email address/);
  const field = (id) => findAll(view, (node) => node.getAttribute("id") === id)[0];
  const email = field("circ-account-email");
  const password = field("circ-account-password");
  const confirmation = field("circ-account-confirmation");
  const form = findAll(view, (node) => node.tagName === "form")[0];
  email.value = "teacher@school.example";
  password.value = "new-password";
  confirmation.value = "different-password";
  form.listeners.get("submit")({ preventDefault() {} });
  assert.equal(calls.length, 0);
  assert.match(textOf(view), /passwords do not match/);
  confirmation.value = password.value;
  form.listeners.get("submit")({ preventDefault() {} });
  assert.deepEqual(calls, [["signUpWithEmail", { email: email.value, password: "new-password" }]]);
  assert.equal(password.value, "");
  assert.equal(confirmation.value, "");
  assert.equal(email.getAttribute("type"), "email");
  assert.equal(email.hasAttribute("pattern"), false);
  assert.equal(password.getAttribute("autocomplete"), "new-password");
});

test("existing email sign-in and password reset remain distinct from account creation", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model(), actions, { document: documentDouble });
  const fields = findAll(view, (node) => node.tagName === "input");
  const [email, password, confirmation] = fields;
  const buttons = findAll(view, (node) => node.tagName === "button");
  buttons.find((node) => node.textContent === "I already have a CIRC HQ account").click();
  assert.match(textOf(view), /Sign in with email/);
  assert.equal(password.getAttribute("autocomplete"), "current-password");
  assert.equal(password.hasAttribute("minlength"), false);
  assert.equal(confirmation.hasAttribute("required"), false);
  assert.equal(confirmation.hasAttribute("disabled"), true);
  email.value = "teacher@district.example";
  password.value = "existing-password";
  findAll(view, (node) => node.tagName === "form")[0].listeners.get("submit")({ preventDefault() {} });
  assert.deepEqual(calls[0], ["signInWithEmail", { email: email.value, password: "existing-password" }]);
  password.value = "do-not-include-in-reset";
  buttons.find((node) => node.textContent === "Forgot password").click();
  assert.deepEqual(calls[1], ["requestPasswordReset", { email: email.value }]);
  assert.equal(password.value, "");
});

test("pending email requests disable all credential controls and preserve the selected sign-in mode", () => {
  const { actions } = actionsDouble();
  const view = buildSetupView(model({ emailAuthMode: "sign-in", account: { status: "pending", displayName: null, maskedEmail: null } }), actions, { document: documentDouble });
  const details = findAll(view, (node) => node.tagName === "details")[0];
  assert.equal(details.hasAttribute("open"), true);
  assert.match(textOf(details), /Sign in with email/);
  for (const node of findAll(details, (node) => node.tagName === "button" || node.tagName === "input")) assert.equal(node.hasAttribute("disabled"), true);
});

test("schedule step summarizes a local preview and keeps it separate from cloud sync", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "schedule",
    completed: ["account", "teacher"],
    account: { status: "confirmed", displayName: "Teacher Alpha", maskedEmail: "t***@example.com" },
    plan: {
      status: "preview",
      teacherName: "Teacher Alpha",
      cycleDayCount: 5,
      eventCount: 12,
      dateRange: "August 20, 2026 to June 4, 2027",
      currentDateResult: "Cycle Day 2",
      warnings: ["One event needs review"]
    }
  }), actions, { document: documentDouble });
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Use this schedule")[0].click();
  assert.deepEqual(calls.map(([name]) => name), ["confirmPlanPreview"]);
  assert.equal(calls.some(([name]) => name === "uploadAndVerify"), false);
  assert.match(textOf(view), /Teacher Alpha|5|12|August 20, 2026/);
  assert.match(textOf(view), /One event needs review/);
  assert.equal(findAll(view, (node) => node.tagName === "input" && node.getAttribute("type") === "file").length, 0);
  assert.doesNotMatch(textOf(view), /JSON|schema|migration/i);
});

test("cloud-found schedule has an explicit saved schedule action", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(model({
    current: "schedule",
    completed: ["account", "teacher"],
    account: { status: "confirmed", displayName: "Teacher Alpha", maskedEmail: "t***@example.com" },
    plan: {
      status: "cloud-found",
      teacherName: "Teacher Alpha",
      cycleDayCount: 5,
      eventCount: 12,
      dateRange: "August 20, 2026 to June 4, 2027",
      currentDateResult: "Cycle Day 2",
      warnings: []
    }
  }), actions, { document: documentDouble });
  findAll(view, (node) => node.tagName === "button" && node.textContent === "Use saved cloud schedule")[0].click();
  assert.deepEqual(calls, [["confirmPlanPreview"]]);
  assert.doesNotMatch(textOf(view), /JSON|schema|migration/i);
});

test("private sync and verification expose only their own current mutation", () => {
  const { actions, calls } = actionsDouble();
  const sync = buildSetupView(model({ current: "sync", completed: ["account", "teacher", "schedule"] }), actions, { document: documentDouble });
  findAll(sync, (node) => node.tagName === "button" && node.textContent === "Turn on private sync")[0].click();
  assert.deepEqual(calls, [["uploadAndVerify"]]);
  assert.match(textOf(sync), /private teacher data/i);
  assert.doesNotMatch(textOf(sync), /shared|room|artifact/i);
  const verify = buildSetupView(model({ current: "verify", completed: ["account", "teacher", "schedule", "sync"], sync: { status: "attention", lastVerifiedAt: null, pendingDomains: ["plan"], conflictDomains: [] } }), actions, { document: documentDouble });
  const status = findAll(verify, (node) => node.getAttribute("role") === "status")[0];
  assert.equal(status.getAttribute("aria-live"), "polite");
  assert.match(textOf(status), /Sync needs attention/);
});

test("ready step shows summary, explains optional room setup, and wires the safe destinations", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupView(completeModel(), actions, { document: documentDouble });
  for (const label of ["Open Today", "Preview an experience", "Setup help"]) {
    findAll(view, (node) => node.tagName === "button" && node.textContent === label)[0].click();
  }
  for (const label of ["Open Today", "Preview an experience", "Setup help"]) {
    assert.equal(findAll(view, (node) => node.tagName === "button" && node.textContent === label).length, 1);
  }
  assert.deepEqual(calls.map(([name]) => name), ["openToday", "previewExperience", "openSetupHelp"]);
  assert.match(textOf(view), /Teacher Alpha|Cycle Day 2|preserved/i);
  assert.match(textOf(view), /Room is optional|Setup help/i);
});

test("room controls appear only in optional setup help", () => {
  const { actions } = actionsDouble();
  for (const current of ["account", "teacher", "schedule", "sync", "verify", "ready"]) {
    const completed = ["account", "teacher", "schedule", "sync", "verify"].slice(0, Math.max(0, ["account", "teacher", "schedule", "sync", "verify", "ready"].indexOf(current)));
    const view = buildSetupView(model({ current, completed }), actions, { document: documentDouble });
    assert.equal(findAll(view, (node) => node.tagName === "button" && ["Create CIRC room", "Join CIRC room"].includes(node.textContent)).length, 0);
  }

  const help = buildSetupHelpView(completeModel({ room: { status: "missing", name: null, role: null } }), actions, { document: documentDouble });
  assert.match(textOf(help), /optional room/i);
  assert.ok(findAll(help, (node) => node.tagName === "button" && node.textContent === "Create CIRC room")[0]);
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

test("setup help exposes safe recovery controls and domain labels without identifiers", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupHelpView(completeModel({
    sync: {
      status: "attention",
      lastVerifiedAt: "September 1, 2026 at 9:00 AM",
      pendingDomains: ["content", "sharedArtifact"],
      conflictDomains: ["plan"]
    }
  }), actions, { document: documentDouble });
  const labels = [
    "Sync now",
    "Export local backup",
    "Replace teacher plan",
    "Use cloud plan",
    "Keep local plan",
    "Sign out",
    "Return to setup"
  ];
  for (const label of labels) {
    const control = findAll(view, (node) => node.tagName === "button" && node.textContent === label)[0];
    assert.ok(control, label);
    control.click();
  }
  assert.deepEqual(calls.map(([name]) => name), [
    "syncNow",
    "exportLocalBackup",
    "replaceTeacherPlan",
    "useCloudPlan",
    "keepLocalPlan",
    "signOut",
    "returnToSetup"
  ]);
  assert.match(textOf(view), /Private content|Shared project|Plan conflict/);
  assert.doesNotMatch(textOf(view), /teacher-uid|tenant-safe|room-safe|revision|invite hash/i);
});

test("plan conflict controls stay disabled when no plan conflict exists", () => {
  const { actions, calls } = actionsDouble();
  const view = buildSetupHelpView(completeModel(), actions, { document: documentDouble });
  for (const label of ["Use cloud plan", "Keep local plan"]) {
    const control = findAll(view, (node) => node.tagName === "button" && node.textContent === label)[0];
    assert.equal(control.hasAttribute("disabled"), true);
    control.click();
  }
  assert.deepEqual(calls, []);
});

test("invalid setup model and missing callbacks fail closed", () => {
  const { actions } = actionsDouble();
  assert.throws(() => buildSetupView(model({ mode: "unknown" }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ current: "schedule", completed: ["teacher", "account"] }), actions, { document: documentDouble }), /setup-model-invalid/);
  const missing = { ...actions };
  delete missing.openSchedule;
  assert.throws(() => buildSetupHelpView(model({ mode: "demo" }), missing, { document: documentDouble }), /setup-actions-invalid/);
  assert.throws(() => buildSetupView(model({ notice: { kind: "error", text: { raw: "unsafe" } } }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ notice: { kind: "error", text: "safe", raw: "unsafe" } }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ sync: { status: "pending", lastVerifiedAt: null, pendingDomains: ["plan", "plan"], conflictDomains: [] } }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ sync: { status: "pending", lastVerifiedAt: null, pendingDomains: ["uid"], conflictDomains: [] } }), actions, { document: documentDouble }), /setup-model-invalid/);
  assert.throws(() => buildSetupView(model({ room: { status: "missing", name: null, role: null, inviteCode: { raw: "unsafe" } } }), actions, { document: documentDouble }), /setup-model-invalid/);
  for (const inviteCode of [null, "", " ", "ABCDEFGHI-JKLMNOPQR-STUVWXYI2", "ABCDEFGHJ-KMNPQRSTV", VALID_INVITE_CODE.repeat(20)]) {
    assert.throws(() => buildSetupView(model({ room: { status: "owner", name: "Shared CIRC Room", role: "owner", inviteCode } }), actions, { document: documentDouble }), /setup-model-invalid/);
  }
  assert.throws(() => buildSetupView(model({ room: { status: "ready", name: "Shared CIRC Room", role: "teacher", inviteCode: VALID_INVITE_CODE } }), actions, { document: documentDouble }), /setup-model-invalid/);
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
  const help = buildSetupHelpView(model(), actions, { document: documentDouble });
  const walkthrough = findAll(help, node => node.tagName === "a" && node.textContent === "Complete first-use walkthrough")[0];
  assert.equal(walkthrough?.getAttribute("href"), "walkthrough.html");
  assert.equal(walkthrough?.getAttribute("target"), "_blank");
  assert.equal(walkthrough?.getAttribute("rel"), "noopener");
});
