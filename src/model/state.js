import { buildBoardProjection } from "./access.js";
import { validateTeacherPlan } from "./teacher-plan.js";
import {
  isOwnerKey,
  ownerKeyForTeacher
} from "./schema-admission.js";

export const STATE_FORMAT = "playbook.state.v1";
export const STATE_SCHEMA_VERSION = 1;
export const LOCAL_OWNER_KEY = "local:default";
export { isOwnerKey, ownerKeyForTeacher };

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function readJson(storage, key) {
  const raw = storage?.getItem?.(key);
  if (raw === null || raw === undefined || raw === "") return { found: false };
  try {
    return { found: true, value: JSON.parse(raw) };
  } catch {
    return { found: true, error: `Could not read ${key}` };
  }
}

function legacyItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (isRecord(entry) && typeof entry.text === "string") return entry.text;
    if (isRecord(entry) && typeof entry.label === "string") return entry.label;
    return null;
  }).filter((entry) => entry !== null);
}

export function stableId(prefix, source) {
  const input = `${prefix}:${String(source)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${String(prefix).replace(/[^a-z0-9]/gi, "").toLowerCase() || "item"}-${(hash >>> 0).toString(36)}`;
}

export function createInitialState(nowIso) {
  return {
    format: STATE_FORMAT,
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: nowIso,
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
}

export function migrateLegacyState(storage, nowIso) {
  const state = createInitialState(nowIso);
  const notes = [];
  const legacyPlan = readJson(storage, "missionControl.teacherPlan.v1");
  if (legacyPlan.found && !legacyPlan.error) {
    const validated = validateTeacherPlan(legacyPlan.value);
    if (validated.ok) {
      state.plan = validated.value;
      notes.push("Imported missionControl.teacherPlan.v1 without removing it");
    } else {
      notes.push("Skipped invalid missionControl.teacherPlan.v1 without removing it");
    }
  }
  if (legacyPlan.error) notes.push(legacyPlan.error);

  const buyList = readJson(storage, "circBuyList");
  if (buyList.found && !buyList.error) {
    state.checklist = legacyItems(buyList.value).map((text, index) => ({
      id: stableId("check", `${index}:${text}`),
      text,
      updatedAt: nowIso
    }));
    if (state.checklist.length) notes.push("Imported circBuyList without removing it");
  }
  if (buyList.error) notes.push(buyList.error);

  const legacyNotes = readJson(storage, "circNotes");
  if (legacyNotes.found && !legacyNotes.error) {
    state.notes = legacyItems(legacyNotes.value).map((text, index) => ({
      id: stableId("note", `${index}:${text}`),
      text,
      visibility: "teacher-private",
      updatedAt: nowIso
    }));
    if (state.notes.length) notes.push("Imported circNotes without removing it");
  }
  if (legacyNotes.error) notes.push(legacyNotes.error);
  return { state, notes };
}

export function createClassroomProjection(state, eventId, options = {}) {
  return buildBoardProjection(state, eventId, options);
}
