import { stableId, STATE_FORMAT } from "../model/state.js";
import { admitLocalState } from "../model/access.js";
import { generateEventId } from "../model/schema-admission.js";
import { migrateTeacherPlanV1 } from "../model/teacher-plan-v1.js";
import { diffTeacherPlans, validateTeacherPlan } from "../model/teacher-plan.js";

let activePreview = null;
let activeRestorePreview = null;

function clone(value) {
  return structuredClone(value);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function planFromCurrent(current) {
  return current?.format === STATE_FORMAT ? current.plan : current;
}

function countEvents(plan) {
  return (Array.isArray(plan?.teachers) ? plan.teachers : []).reduce(
    (total, teacher) => total + Object.values(isRecord(teacher?.days) ? teacher.days : {}).reduce(
      (dayTotal, events) => dayTotal + (Array.isArray(events) ? events.length : 0),
      0
    ),
    0
  );
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((entry, index) => deepEqual(entry, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return deepEqual(leftKeys, rightKeys) && leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function invalidPreview(errors) {
  activePreview = null;
  return {
    ok: false,
    validation: { ok: false, errors: [...errors] },
    summary: null,
    candidate: null,
    previewToken: null
  };
}

function issuePreview(current, candidate, sourceFormat) {
  const validation = validateTeacherPlan(candidate);
  if (!validation.ok) return invalidPreview(["plan-invalid"]);
  const currentPlan = planFromCurrent(current);
  const diff = diffTeacherPlans(currentPlan, validation.value);
  const summary = {
    sourceFormat,
    teacherCount: validation.value.teachers.length,
    eventCount: countEvents(validation.value),
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    changedCount: diff.changed.length
  };
  const token = Object.freeze({
    id: stableId("preview", JSON.stringify({ current: currentPlan, candidate: validation.value }))
  });
  activePreview = {
    token,
    current: clone(currentPlan),
    candidate: clone(validation.value)
  };
  return {
    ok: true,
    validation: { ok: true, errors: [] },
    summary,
    candidate: clone(validation.value),
    previewToken: token
  };
}

export function previewPlanImport(current, text, options = {}) {
  let source;
  try {
    source = JSON.parse(text);
  } catch {
    return invalidPreview(["json-invalid"]);
  }
  if (source?.format === "playbook.teacherPlan.v1") {
    const migration = migrateTeacherPlanV1(source, options.migrationOptions, {
      eventIdFactory: options.eventIdFactory
    });
    if (!migration.ok) return invalidPreview(migration.errors);
    return issuePreview(current, migration.value, source.format);
  }
  const validation = validateTeacherPlan(source);
  if (!validation.ok) return invalidPreview(["plan-invalid"]);
  return issuePreview(current, validation.value, source.format);
}

export function applyPlanImport(store, previewToken) {
  if (!activePreview || previewToken !== activePreview.token) {
    return { ok: false, error: "preview-token-required", state: null };
  }
  const preview = activePreview;
  const current = store?.load?.().state?.plan ?? null;
  if (!deepEqual(current, preview.current)) {
    activePreview = null;
    return { ok: false, error: "preview-stale", state: null };
  }
  const validation = validateTeacherPlan(preview.candidate);
  if (!validation.ok) {
    activePreview = null;
    return { ok: false, error: "preview-invalid", state: null };
  }
  if (deepEqual(current, validation.value)) {
    activePreview = null;
    return {
      ok: true,
      error: null,
      state: store.load().state,
      unchanged: true
    };
  }
  const result = store.importPlan(validation.value);
  activePreview = null;
  return result.ok
    ? { ok: true, error: null, state: result.state }
    : { ok: false, error: "apply-failed", state: null };
}

export function exportSettingsBackup(store) {
  return JSON.stringify(store.exportState(), null, 2);
}

export function parseSettingsBackup(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["json-invalid"], value: null };
  }
  try {
    return { ok: true, errors: [], value: admitLocalState(value) };
  } catch {
    return { ok: false, errors: ["state-invalid"], value: null };
  }
}

export function previewSettingsRestore(text) {
  activeRestorePreview = null;
  const parsed = parseSettingsBackup(text);
  if (!parsed.ok) {
    return {
      ok: false,
      errors: parsed.errors,
      summary: null,
      candidate: null,
      previewToken: null
    };
  }
  const token = Object.freeze({
    id: stableId("restore-preview", JSON.stringify(parsed.value))
  });
  activeRestorePreview = {
    token,
    candidate: clone(parsed.value)
  };
  return {
    ok: true,
    errors: [],
    summary: {
      hasPlan: parsed.value.plan !== null,
      teacherCount: parsed.value.plan?.teachers?.length ?? 0,
      updatedAt: parsed.value.updatedAt
    },
    candidate: clone(parsed.value),
    previewToken: token
  };
}

export function applySettingsRestore(store, previewToken) {
  if (!activeRestorePreview || previewToken !== activeRestorePreview.token) {
    return { ok: false, error: "restore-preview-token-required", state: null };
  }
  const preview = activeRestorePreview;
  activeRestorePreview = null;
  try {
    const admitted = admitLocalState(preview.candidate);
    const restored = store?.restoreState?.(admitted);
    if (!restored) throw new Error("restore unavailable");
    return { ok: true, error: null, state: admitLocalState(restored) };
  } catch {
    return { ok: false, error: "restore-failed", state: null };
  }
}

function previewOverride(current, date, override) {
  const plan = clone(planFromCurrent(current));
  if (!isRecord(plan?.calendar?.overrides) || typeof date !== "string") {
    return invalidPreview(["calendar-edit-invalid"]);
  }
  plan.calendar.overrides[date] = override;
  return issuePreview(current, plan, "settings-edit");
}

export function previewClosure(current, date) {
  return previewOverride(current, date, {
    id: stableId("override", `closed|${date}`),
    kind: "closed"
  });
}

export function previewMakeupDayStatus(current, date, status) {
  const plan = clone(planFromCurrent(current));
  if (!plan?.calendar?.conditionalMakeup?.includes(date)) {
    return invalidPreview(["makeup-date-invalid"]);
  }
  if (status === "pending") {
    delete plan.calendar.overrides[date];
    return issuePreview(current, plan, "settings-edit");
  }
  if (!["instructional", "closed"].includes(status)) {
    return invalidPreview(["makeup-status-invalid"]);
  }
  plan.calendar.overrides[date] = {
    id: stableId("override", `${status}|${date}`),
    kind: status
  };
  return issuePreview(current, plan, "settings-edit");
}

export function previewCycleDayOverride(current, date, day) {
  return previewOverride(current, date, {
    id: stableId("override", `cycle|${date}|${day}`),
    kind: "cycle",
    day
  });
}

export function previewSpecialEvent(current, input = {}, eventIdFactory = generateEventId) {
  const plan = clone(planFromCurrent(current));
  if (!Array.isArray(plan?.specialEvents) || typeof input.date !== "string" ||
      typeof input.label !== "string" || input.label.trim() === "") {
    return invalidPreview(["special-event-invalid"]);
  }
  let eventId;
  try {
    eventId = eventIdFactory();
  } catch {
    return invalidPreview(["event-id-generation-failed"]);
  }
  const event = {
    id: eventId,
    type: "special",
    label: input.label,
    date: input.date
  };
  if (input.start !== undefined || input.end !== undefined) {
    event.start = input.start;
    event.end = input.end;
  }
  plan.specialEvents.push(event);
  return issuePreview(current, plan, "settings-edit");
}
