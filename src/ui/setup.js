const SETUP_STEPS = Object.freeze([
  ["account", "Connect account"],
  ["teacher", "Confirm teacher"],
  ["plan", "Load teacher plan"],
  ["room", "Join CIRC room"],
  ["upload", "Confirm cloud upload"],
  ["verify", "Verify CIRC Cloud"],
  ["complete", "Ready for Today"]
]);

const STEP_IDS = new Set(SETUP_STEPS.map(([id]) => id));
const ACTION_NAMES = Object.freeze([
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
  "exitDemo",
  "syncNow",
  "exportLocalBackup",
  "replaceTeacherPlan",
  "signOut",
  "useCloudPlan",
  "keepLocalPlan",
  "returnToSetup"
]);
const ACCOUNT_STATUSES = new Set(["signed-out", "pending", "observed", "confirmed"]);
const PLAN_STATUSES = new Set(["missing", "preview", "cloud-found", "confirmed"]);
const ROOM_STATUSES = new Set(["missing", "owner", "member", "joining", "ready"]);
const ROOM_ROLES = new Set(["owner", "teacher", null]);
const SYNC_STATUSES = new Set(["idle", "pending", "verified", "offline", "attention"]);
const BACKUP_STATUSES = new Set(["ready", "preserved", "unavailable"]);
const SYNC_DOMAINS = Object.freeze(["plan", "progress", "preferences", "content", "sharedArtifact"]);
const SYNC_DOMAIN_LABELS = Object.freeze({
  plan: "Private plan",
  progress: "Teacher progress",
  preferences: "Preferences",
  content: "Private content",
  sharedArtifact: "Shared project"
});

const PRIVATE_BOUNDARY = [
  "Teacher plan and schedule",
  "Teacher project progress",
  "Preferences",
  "Checklists, classes, lesson guides, special events, resources, and private notes"
];
const SHARED_BOUNDARY = [
  "Shared physical-project artifacts",
  "Shared room-level project progress",
  "Artifact visit and handoff history"
];
const NOT_UPLOADED_BOUNDARY = [
  "Active or paused lesson runners",
  "Live timer ownership",
  "Browser recovery backup",
  "Any student account or student submission"
];

function invalidModel() {
  throw new TypeError("setup-model-invalid");
}

function invalidActions() {
  throw new TypeError("setup-actions-invalid");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value) {
  return value === null || typeof value === "string";
}

function nonNegativeIntegerOrNull(value) {
  return value === null || Number.isInteger(value) && value >= 0;
}

function validDomainList(value) {
  if (!Array.isArray(value)) return false;
  let prior = -1;
  for (const domain of value) {
    const index = SYNC_DOMAINS.indexOf(domain);
    if (index < 0 || index <= prior) return false;
    prior = index;
  }
  return true;
}

function validateModel(model) {
  if (!isRecord(model) || !["setup", "demo"].includes(model.mode) || !STEP_IDS.has(model.current)) {
    invalidModel();
  }

  const currentIndex = SETUP_STEPS.findIndex(([id]) => id === model.current);
  if (!Array.isArray(model.completed)) invalidModel();
  const completedIndexes = model.completed.map((step) => {
    if (typeof step !== "string") invalidModel();
    const index = SETUP_STEPS.findIndex(([id]) => id === step);
    if (index < 0 || index >= currentIndex) invalidModel();
    return index;
  });
  if (new Set(completedIndexes).size !== completedIndexes.length ||
      completedIndexes.some((index, position) => position > 0 && index <= completedIndexes[position - 1])) {
    invalidModel();
  }

  if (model.account !== null) {
    if (!isRecord(model.account) || !ACCOUNT_STATUSES.has(model.account.status) ||
        !nullableString(model.account.displayName) || !nullableString(model.account.maskedEmail)) {
      invalidModel();
    }
  }
  if (!isRecord(model.plan) || !PLAN_STATUSES.has(model.plan.status) ||
      !nullableString(model.plan.teacherName) || !nonNegativeIntegerOrNull(model.plan.cycleDayCount) ||
      !nonNegativeIntegerOrNull(model.plan.eventCount) || !nullableString(model.plan.dateRange) ||
      !nullableString(model.plan.currentDateResult) || !Array.isArray(model.plan.warnings) ||
      model.plan.warnings.some((warning) => typeof warning !== "string")) {
    invalidModel();
  }
  if (!isRecord(model.room) || !ROOM_STATUSES.has(model.room.status) ||
      !nullableString(model.room.name) || !ROOM_ROLES.has(model.room.role)) {
    invalidModel();
  }
  if (!isRecord(model.sync) || !SYNC_STATUSES.has(model.sync.status) ||
      !nullableString(model.sync.lastVerifiedAt) ||
      !validDomainList(model.sync.pendingDomains) ||
      !validDomainList(model.sync.conflictDomains)) {
    invalidModel();
  }
  if (!isRecord(model.localBackup) || !BACKUP_STATUSES.has(model.localBackup.status) ||
      typeof model.currentCycleDay !== "string" && model.currentCycleDay !== null) {
    invalidModel();
  }
  if (model.notice !== null && (!isRecord(model.notice) ||
      !["status", "warning", "error"].includes(model.notice.kind) ||
      typeof model.notice.text !== "string" ||
      Object.keys(model.notice).sort().join(",") !== "kind,text")) {
    invalidModel();
  }
  return model;
}

function validateActions(actions) {
  if (!isRecord(actions) || ACTION_NAMES.some((name) => typeof actions[name] !== "function")) {
    invalidActions();
  }
}

function resolveDocument(options) {
  const documentRef = options?.document ?? globalThis.document;
  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new TypeError("setup-document-unavailable");
  }
  return documentRef;
}

function element(documentRef, tagName, options = {}, children = []) {
  const node = documentRef.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

function button(documentRef, label, className, listener, attributes = {}) {
  const node = element(documentRef, "button", {
    className,
    text: label,
    attributes: { type: "button", ...attributes }
  });
  if (!node.hasAttribute("disabled")) node.addEventListener("click", () => listener());
  return node;
}

function list(documentRef, items, className = "setup-boundary-list") {
  return element(documentRef, "ul", { className }, items.map((item) =>
    element(documentRef, "li", { text: item })
  ));
}

function statusRegion(documentRef, text, className = "setup-status") {
  return element(documentRef, "p", {
    className,
    text,
    attributes: { role: "status", "aria-live": "polite" }
  });
}

function noticeNode(documentRef, notice) {
  if (!notice) return null;
  return element(documentRef, "p", {
    className: `setup-notice setup-notice-${notice.kind}`,
    text: notice.text,
    attributes: notice.kind === "error"
      ? { role: "alert" }
      : { role: "status", "aria-live": "polite" }
  });
}

function setupRail(documentRef, model) {
  const currentIndex = SETUP_STEPS.findIndex(([id]) => id === model.current);
  return element(documentRef, "ol", {
    className: "setup-rail",
    attributes: { "aria-label": "CIRC HQ setup progress" }
  }, SETUP_STEPS.map(([id, label], index) => {
    const complete = model.completed.includes(id);
    const current = id === model.current;
    return element(documentRef, "li", {
      className: `setup-rail-item${complete ? " complete" : ""}${current ? " current" : ""}${index > currentIndex ? " pending" : ""}`,
      attributes: {
        "data-step": id,
        "aria-current": current ? "step" : null
      }
    }, [
      element(documentRef, "span", { className: "setup-step-number", text: index + 1 }),
      element(documentRef, "span", { className: "setup-step-label", text: label }),
      complete ? element(documentRef, "span", { className: "setup-step-state", text: "Complete" }) : null
    ]);
  }));
}

function setupVisual(documentRef) {
  return element(documentRef, "div", { className: "setup-visual" }, [
    element(documentRef, "img", {
      className: "setup-visual-image",
      attributes: {
        src: "assets/tech-terrarium-hero.webp",
        alt: "A student-built technology terrarium with rocks, plants, tools, and electronic parts",
        width: "1400",
        height: "875"
      }
    }),
    element(documentRef, "p", { className: "setup-visual-caption", text: "A clear start for the work ahead." })
  ]);
}

function summaryRow(documentRef, label, value) {
  return element(documentRef, "div", { className: "setup-summary-row" }, [
    element(documentRef, "dt", { text: label }),
    element(documentRef, "dd", { text: value ?? "Not available" })
  ]);
}

function planSummary(documentRef, plan) {
  return element(documentRef, "dl", { className: "setup-plan-summary" }, [
    summaryRow(documentRef, "Teacher", plan.teacherName),
    summaryRow(documentRef, "Cycle days", plan.cycleDayCount === null ? null : String(plan.cycleDayCount)),
    summaryRow(documentRef, "Scheduled events", plan.eventCount === null ? null : String(plan.eventCount)),
    summaryRow(documentRef, "Calendar", plan.dateRange),
    summaryRow(documentRef, "Current date", plan.currentDateResult)
  ]);
}

function planStatusLabel(status) {
  return {
    missing: "Private plan not loaded",
    preview: "Private plan preview ready",
    "cloud-found": "Plan found in CIRC Cloud",
    confirmed: "Private plan confirmed"
  }[status];
}

function roomStatusLabel(room) {
  if (room.name) return `${room.name}${room.role ? `, ${room.role}` : ""}`;
  return {
    missing: "No CIRC room selected",
    owner: "CIRC room owner",
    member: "CIRC room member",
    joining: "Joining CIRC room",
    ready: "CIRC room ready"
  }[room.status];
}

function syncStatusLabel(status) {
  return {
    verified: "CIRC Cloud verified",
    offline: "Offline, saved on this device",
    idle: "Sync needs attention",
    pending: "Sync needs attention",
    attention: "Sync needs attention"
  }[status];
}

function backupStatusLabel(status) {
  return {
    ready: "Local backup ready",
    preserved: "Local backup preserved",
    unavailable: "Local backup unavailable"
  }[status];
}

function appendInviteResult(statusNode, result) {
  const code = typeof result === "string"
    ? result
    : result && typeof result.inviteCode === "string"
      ? result.inviteCode
      : result && typeof result.code === "string"
        ? result.code
        : null;
  if (!code || !code.trim()) {
    statusNode.textContent = "Room invitation is ready to review.";
    return;
  }
  statusNode.textContent = `One-time invitation code: ${code}`;
}

function runRoomCreation(documentRef, actions, statusNode) {
  try {
    const result = actions.createRoom();
    if (result && typeof result.then === "function") {
      result.then((resolved) => appendInviteResult(statusNode, resolved)).catch(() => {
        statusNode.textContent = "Room creation needs attention.";
      });
    } else {
      appendInviteResult(statusNode, result);
    }
  } catch {
    statusNode.textContent = "Room creation needs attention.";
  }
}

function accountStep(documentRef, model, actions) {
  const children = [
    element(documentRef, "h1", { text: "Get CIRC HQ ready" }),
    element(documentRef, "p", {
      text: "Setup connects one private teacher account, loads that teacher's schedule, and joins one shared CIRC room."
    })
  ];
  if (model.account?.status === "pending") {
    children.push(statusRegion(documentRef, "Waiting for Google to confirm the signed-in account."));
  }
  const pending = model.account?.status === "pending";
  children.push(button(documentRef, "Continue with Google", "primary-action setup-primary-action", actions.continueWithGoogle, pending ? { disabled: "" } : {}));
  children.push(element(documentRef, "p", {
    className: "setup-disabled-explanation",
    text: pending ? "The account will remain pending until Firebase reports the signed-in teacher." : ""
  }));
  children.push(button(documentRef, "Explore a temporary demo", "secondary-action", actions.exploreDemo));
  children.push(element(documentRef, "p", { className: "setup-demo-boundary", text: "Nothing in this demo is saved or synced." }));
  return children;
}

function teacherStep(documentRef, model, actions) {
  const account = model.account;
  const children = [
    element(documentRef, "h1", { text: "Confirm your teacher account" }),
    element(documentRef, "p", { text: "This signed-in account owns only that teacher's private CIRC data." }),
    element(documentRef, "dl", { className: "setup-account-summary" }, [
      summaryRow(documentRef, "Google account", account?.displayName),
      summaryRow(documentRef, "Email", account?.maskedEmail)
    ]),
    button(documentRef, "Use this account", "primary-action setup-primary-action", actions.useAccount,
      account?.status === "observed" ? {} : { disabled: "" }),
    button(documentRef, "Use a different account", "secondary-action", actions.useDifferentAccount)
  ];
  if (account?.status !== "observed") {
    children.push(element(documentRef, "p", {
      className: "setup-disabled-explanation",
      text: "Confirm the account only after Firebase reports it as observed."
    }));
  }
  return children;
}

function planStep(documentRef, model, actions) {
  const children = [element(documentRef, "h1", { text: "Choose private teacher plan" })];
  if (model.plan.status === "cloud-found") {
    children.push(element(documentRef, "p", { className: "setup-current-status", text: "Plan found in CIRC Cloud" }));
    children.push(planSummary(documentRef, model.plan));
  } else {
    children.push(element(documentRef, "p", {
      text: "Choose a private teacher-plan JSON file to preview it on this device. Selecting a file does not upload it."
    }));
    const input = element(documentRef, "input", {
      attributes: { id: "setup-plan-file", type: "file", accept: "application/json,.json" }
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      actions.choosePlanFile(file);
      previewStatus.textContent = "Private teacher plan preview selected. It has not been uploaded.";
    });
    children.push(element(documentRef, "label", { className: "setup-file-label", text: "Choose private teacher plan file", attributes: { for: "setup-plan-file" } }));
    children.push(input);
  }
  if (model.plan.status === "preview" || model.plan.status === "confirmed") {
    children.push(planSummary(documentRef, model.plan));
    if (model.plan.warnings.length) children.push(list(documentRef, model.plan.warnings, "setup-warning-list"));
  }
  if (model.plan.status === "preview") {
    children.push(button(documentRef, "Confirm plan preview", "primary-action setup-primary-action", actions.confirmPlanPreview));
  }
  if (model.plan.status === "cloud-found") {
    children.push(button(documentRef, "Use plan found in CIRC Cloud", "primary-action setup-primary-action", actions.confirmPlanPreview));
  }
  const previewStatus = statusRegion(documentRef, planStatusLabel(model.plan.status), "setup-plan-status");
  children.push(previewStatus);
  return children;
}

function roomStep(documentRef, model, actions) {
  const children = [
    element(documentRef, "h1", { text: "Set up the CIRC room" }),
    element(documentRef, "p", { text: "A room is shared only with trusted CIRC members. One-time invitation codes are not stored." })
  ];
  if (["member", "owner", "ready", "joining"].includes(model.room.status) || model.room.name) {
    children.push(statusRegion(documentRef, roomStatusLabel(model.room), "setup-room-status"));
  }
  const roomStatus = statusRegion(documentRef, "No invitation created yet.", "setup-room-action-status");
  if (model.room.status === "missing" || model.room.role === "owner") {
    children.push(button(documentRef, "Create CIRC room", "primary-action setup-primary-action", () => runRoomCreation(documentRef, actions, roomStatus)));
  }
  if (model.room.status === "missing" || model.room.status === "joining") {
    const input = element(documentRef, "input", {
      attributes: { id: "setup-invite-code", type: "text", autocomplete: "off", "aria-label": "One-time invitation code" }
    });
    const join = button(documentRef, "Join CIRC room", "secondary-action", () => {
      const code = input.value;
      input.value = "";
      if (code) actions.redeemInvite(code);
      else roomStatus.textContent = "Enter the one-time invitation code before joining.";
    });
    children.push(element(documentRef, "label", { className: "setup-file-label", text: "Enter the one-time invitation code", attributes: { for: "setup-invite-code" } }));
    children.push(input, join);
  }
  children.push(roomStatus);
  return children;
}

function boundaryCard(documentRef, title, items, className) {
  return element(documentRef, "section", { className: `setup-boundary-card ${className}` }, [
    element(documentRef, "h2", { text: title }),
    list(documentRef, items)
  ]);
}

function uploadStep(documentRef, actions) {
  return [
    element(documentRef, "h1", { text: "Confirm cloud upload" }),
    element(documentRef, "p", { text: "Review exactly what will remain private, what will be shared with the selected room, and what stays on this device." }),
    element(documentRef, "div", { className: "setup-boundaries" }, [
      boundaryCard(documentRef, "Private to the signed-in teacher", PRIVATE_BOUNDARY, "setup-boundary-private"),
      boundaryCard(documentRef, "Shared with the selected room", SHARED_BOUNDARY, "setup-boundary-shared"),
      boundaryCard(documentRef, "Not uploaded in this release", NOT_UPLOADED_BOUNDARY, "setup-boundary-excluded")
    ]),
    button(documentRef, "Upload and verify", "primary-action setup-primary-action", actions.uploadAndVerify)
  ];
}

function verifyStep(documentRef, model) {
  return [
    element(documentRef, "h1", { text: "Verify CIRC Cloud" }),
    element(documentRef, "p", { text: "Each admitted cloud domain is written, read back, and checked before setup is complete." }),
    element(documentRef, "p", {
      className: "setup-sync-status",
      text: syncStatusLabel(model.sync.status),
      attributes: { role: "status", "aria-live": "polite" }
    })
  ];
}

function completeStep(documentRef, model, actions) {
  return [
    element(documentRef, "h1", { text: "CIRC HQ is ready" }),
    element(documentRef, "dl", { className: "setup-complete-summary" }, [
      summaryRow(documentRef, "Teacher", model.plan.teacherName ?? model.account?.displayName),
      summaryRow(documentRef, "Current cycle day", model.currentCycleDay),
      summaryRow(documentRef, "Private plan", planStatusLabel(model.plan.status)),
      summaryRow(documentRef, "CIRC room", roomStatusLabel(model.room)),
      summaryRow(documentRef, "Last verified sync", model.sync.lastVerifiedAt),
      summaryRow(documentRef, "Local backup", backupStatusLabel(model.localBackup.status))
    ]),
    element(documentRef, "div", { className: "setup-complete-actions" }, [
      button(documentRef, "Open Today", "primary-action setup-primary-action", actions.openToday),
      button(documentRef, "Preview an experience", "secondary-action", actions.previewExperience)
    ])
  ];
}

function demoStep(documentRef, actions) {
  return [
    element(documentRef, "h1", { text: "Temporary CIRC HQ demo" }),
    element(documentRef, "p", { text: "This demo lets you look around without connecting an account or changing classroom data." }),
    element(documentRef, "p", { className: "setup-demo-boundary", text: "Nothing in this demo is saved or synced." }),
    element(documentRef, "p", { className: "setup-disabled-explanation", text: "Sign-in, private-file selection, room actions, cloud upload, and live-class actions are unavailable in demo mode." }),
    button(documentRef, "Preview an experience", "secondary-action", actions.previewExperience),
    button(documentRef, "Exit demo and set up CIRC HQ", "primary-action setup-primary-action", actions.exitDemo)
  ];
}

function setupHelp(documentRef, model, actions) {
  const pending = model.sync.pendingDomains.map((domain) => `${SYNC_DOMAIN_LABELS[domain]} pending`);
  const conflicts = model.sync.conflictDomains.map((domain) => `${SYNC_DOMAIN_LABELS[domain]} conflict`);
  const planConflict = model.sync.conflictDomains.includes("plan");
  const children = [
    element(documentRef, "h1", { text: "Setup help" }),
    element(documentRef, "p", { text: "CIRC HQ keeps the teacher plan private, shares only selected room artifacts, and preserves a local recovery path." }),
    element(documentRef, "dl", { className: "setup-help-summary" }, [
      summaryRow(documentRef, "Signed-in teacher", model.account?.displayName),
      summaryRow(documentRef, "Private plan", planStatusLabel(model.plan.status)),
      summaryRow(documentRef, "CIRC room", roomStatusLabel(model.room)),
      summaryRow(documentRef, "Last verified sync", model.sync.lastVerifiedAt),
      summaryRow(documentRef, "Local backup", backupStatusLabel(model.localBackup.status))
    ]),
    pending.length ? element(documentRef, "section", { className: "setup-help-pending" }, [
      element(documentRef, "h2", { text: "Pending sync" }),
      list(documentRef, pending, "setup-pending-list")
    ]) : null,
    conflicts.length ? element(documentRef, "section", { className: "setup-help-conflicts" }, [
      element(documentRef, "h2", { text: "Needs a decision" }),
      list(documentRef, conflicts, "setup-conflict-list")
    ]) : null,
    element(documentRef, "div", { className: "setup-help-actions" }, [
      button(documentRef, "Sync now", "primary-action setup-primary-action", actions.syncNow),
      button(documentRef, "Export local backup", "secondary-action", actions.exportLocalBackup),
      button(documentRef, "Replace teacher plan", "secondary-action", actions.replaceTeacherPlan),
      button(documentRef, "Use cloud plan", "secondary-action", actions.useCloudPlan, planConflict ? {} : { disabled: "" }),
      button(documentRef, "Keep local plan", "secondary-action", actions.keepLocalPlan, planConflict ? {} : { disabled: "" }),
      button(documentRef, "Sign out", "secondary-action", actions.signOut),
      button(documentRef, "Return to setup", "secondary-action", actions.returnToSetup)
    ]),
    element(documentRef, "h2", { text: "Leave this device signed in" }),
    element(documentRef, "p", { text: "Leave this trusted classroom device signed in for quicker private sync. Sign out before another teacher uses the browser." }),
    element(documentRef, "h2", { text: "If setup is interrupted" }),
    element(documentRef, "p", { text: "Keep teaching locally while offline, preserve the local backup, and return to the current setup step when the account or network is ready." }),
    element(documentRef, "p", { text: "If Google sign-in is blocked, allow pop-ups for this site and try again from the Continue with Google button." }),
    element(documentRef, "p", { text: "If an invitation expired or was already used, ask the room owner for a new one-time invitation." }),
    element(documentRef, "p", { text: "If access is denied or a plan conflicts, keep the local backup and use the recovery choice shown here before syncing again." })
  ];
  return children.filter(Boolean);
}

function buildFrame(documentRef, model, content, { help = false } = {}) {
  const current = element(documentRef, "section", {
    className: help ? "setup-help-panel" : "setup-current-action",
    attributes: { "aria-labelledby": help ? "setup-help-title" : "setup-current-title" }
  }, content);
  const heading = content.find?.((child) => child.tagName === "h1");
  if (heading) heading.setAttribute("id", help ? "setup-help-title" : "setup-current-title");
  const children = [
    setupVisual(documentRef),
    element(documentRef, "div", { className: "setup-content" }, [
      current,
      setupRail(documentRef, model),
      noticeNode(documentRef, model.notice)
    ])
  ];
  return element(documentRef, "section", {
    className: `setup-view${help ? " setup-help-view" : ""}`,
    attributes: { "data-view": help ? "setup-help" : "setup", "data-mode": model.mode }
  }, children);
}

export function buildSetupView(model, actions, options = {}) {
  validateModel(model);
  validateActions(actions);
  const documentRef = resolveDocument(options);
  if (model.mode === "demo") return buildFrame(documentRef, model, demoStep(documentRef, actions));

  let content;
  if (model.current === "account") content = accountStep(documentRef, model, actions);
  else if (model.current === "teacher") content = teacherStep(documentRef, model, actions);
  else if (model.current === "plan") content = planStep(documentRef, model, actions);
  else if (model.current === "room") content = roomStep(documentRef, model, actions);
  else if (model.current === "upload") content = uploadStep(documentRef, actions);
  else if (model.current === "verify") content = verifyStep(documentRef, model);
  else content = completeStep(documentRef, model, actions);
  content.push(button(documentRef, "Setup help", "setup-help-action secondary-action", actions.openSetupHelp));
  return buildFrame(documentRef, model, content);
}

export function buildSetupHelpView(model, actions, options = {}) {
  validateModel(model);
  validateActions(actions);
  const documentRef = resolveDocument(options);
  if (model.mode === "demo") {
    return buildFrame(documentRef, model, [
      element(documentRef, "h1", { text: "Setup help" }),
      element(documentRef, "p", { text: "Demo mode is temporary and does not connect an account, store a file, change a room, or write cloud data." }),
      element(documentRef, "p", { className: "setup-demo-boundary", text: "Nothing in this demo is saved or synced." }),
      button(documentRef, "Exit demo and set up CIRC HQ", "primary-action setup-primary-action", actions.exitDemo)
    ], { help: true });
  }
  return buildFrame(documentRef, model, setupHelp(documentRef, model, actions), { help: true });
}
