import { admitLocalState } from "../model/access.js";
import { TECH_TERRARIUM_ARTIFACT_ID } from "../model/shared-artifact.js";
import { isCanonicalIso, isEventId, isLocalDate } from "../model/schema-admission.js";
import { createInitialState, STATE_FORMAT } from "../model/state.js";
import { validateTeacherPlan } from "../model/teacher-plan.js";

export const STATE_KEY = "circHQ.k6.state.v1";
export const BACKUP_KEY = "circHQ.k6.backup.v1";
export const DEVICE_KEY = "circHQ.k6.device.v1";

const DEVICE_DOMAINS = Object.freeze(["plan", "progress", "preferences", "content", "sharedArtifact"]);
const PRIVATE_DEVICE_DOMAINS = new Set(["plan", "progress", "preferences", "content"]);
const DEVICE_KEYS = Object.freeze([
  "schemaVersion",
  "accountUid",
  "teacherConfirmed",
  "planConfirmed",
  "uploadAuthorized",
  "pendingDomains",
  "conflictDomains",
  "lastVerifiedAt",
  "lastVerifiedRevisions",
  "tenantId",
  "roomId",
  "pendingSharedHandoff"
]);
const REVISION_KEYS = Object.freeze([...DEVICE_DOMAINS]);
const HANDOFF_KEYS = Object.freeze([
  "artifactId",
  "expectedRevision",
  "handoff",
  "eventId",
  "visitDate",
  "nowIso"
]);

function clone(value) {
  return structuredClone(value);
}

function admittedState(value) {
  return admitLocalState(value);
}

function parseAdmittedState(raw) {
  const state = JSON.parse(raw);
  if (state?.format !== STATE_FORMAT) throw new Error("unexpected format");
  return admittedState(state);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isSafeSegment(value) {
  return typeof value === "string" && value.trim() === value && value !== "" &&
    !value.includes("/") && !value.includes("\\") && value.length <= 200;
}

function defaultDeviceMetadata() {
  return {
    schemaVersion: 1,
    accountUid: null,
    teacherConfirmed: false,
    planConfirmed: false,
    uploadAuthorized: false,
    pendingDomains: [],
    conflictDomains: [],
    lastVerifiedAt: null,
    lastVerifiedRevisions: {
      plan: 0,
      progress: 0,
      preferences: 0,
      content: 0,
      sharedArtifact: 0
    },
    tenantId: null,
    roomId: null,
    pendingSharedHandoff: null
  };
}

function admittedDomainList(value) {
  if (!Array.isArray(value)) throw new TypeError("device-metadata-invalid");
  let priorIndex = -1;
  const seen = new Set();
  for (const domain of value) {
    const index = DEVICE_DOMAINS.indexOf(domain);
    if (index < 0 || index <= priorIndex || seen.has(domain)) throw new TypeError("device-metadata-invalid");
    priorIndex = index;
    seen.add(domain);
  }
  return [...value];
}

function admittedRevisions(value) {
  if (!hasExactKeys(value, REVISION_KEYS)) throw new TypeError("device-metadata-invalid");
  const result = {};
  for (const domain of REVISION_KEYS) {
    const revision = value[domain];
    if (!Number.isSafeInteger(revision) || revision < 0) throw new TypeError("device-metadata-invalid");
    result[domain] = revision;
  }
  return result;
}

function admittedPendingHandoff(value) {
  if (value === null) return null;
  if (
    !hasExactKeys(value, HANDOFF_KEYS) ||
    value.artifactId !== TECH_TERRARIUM_ARTIFACT_ID ||
    !Number.isSafeInteger(value.expectedRevision) ||
    value.expectedRevision < 0 ||
    !["ready", "repeat", "park"].includes(value.handoff) ||
    !isEventId(value.eventId) ||
    !isLocalDate(value.visitDate) ||
    !isCanonicalIso(value.nowIso)
  ) throw new TypeError("device-metadata-invalid");
  return structuredClone(value);
}

function admitDeviceMetadata(value) {
  if (
    !hasExactKeys(value, DEVICE_KEYS) ||
    value.schemaVersion !== 1 ||
    value.accountUid !== null && !isSafeSegment(value.accountUid) ||
    typeof value.teacherConfirmed !== "boolean" ||
    typeof value.planConfirmed !== "boolean" ||
    typeof value.uploadAuthorized !== "boolean" ||
    value.lastVerifiedAt !== null && !isCanonicalIso(value.lastVerifiedAt) ||
    value.tenantId !== null && !isSafeSegment(value.tenantId) ||
    value.roomId !== null && !isSafeSegment(value.roomId) ||
    (value.tenantId === null) !== (value.roomId === null)
  ) throw new TypeError("device-metadata-invalid");
  const pendingSharedHandoff = admittedPendingHandoff(value.pendingSharedHandoff);
  if (pendingSharedHandoff !== null && value.tenantId === null) throw new TypeError("device-metadata-invalid");
  return {
    schemaVersion: 1,
    accountUid: value.accountUid,
    teacherConfirmed: value.teacherConfirmed,
    planConfirmed: value.planConfirmed,
    uploadAuthorized: value.uploadAuthorized,
    pendingDomains: admittedDomainList(value.pendingDomains),
    conflictDomains: admittedDomainList(value.conflictDomains),
    lastVerifiedAt: value.lastVerifiedAt,
    lastVerifiedRevisions: admittedRevisions(value.lastVerifiedRevisions),
    tenantId: value.tenantId,
    roomId: value.roomId,
    pendingSharedHandoff
  };
}

export class LocalStore {
  static primaryKey = STATE_KEY;
  static backupKey = BACKUP_KEY;
  static deviceKey = DEVICE_KEY;

  constructor(storage, clock = { now: () => new Date().toISOString() }) {
    this.storage = storage;
    this.clock = clock;
  }

  load() {
    const raw = this.storage.getItem(STATE_KEY);
    if (raw === null) {
      return { state: createInitialState(this.clock.now()), error: null, status: "empty" };
    }
    try {
      return { state: parseAdmittedState(raw), error: null, status: "primary" };
    } catch {
      const backupRaw = this.storage.getItem(BACKUP_KEY);
      if (backupRaw !== null) {
        try {
          return {
            state: parseAdmittedState(backupRaw),
            error: "Recovered saved playbook state from the local backup because the saved primary copy could not be read",
            status: "recovered-backup"
          };
        } catch {
          // Both raw values remain untouched. Fall through to the closed initial state.
        }
      }
      return {
        state: createInitialState(this.clock.now()),
        error: "Saved playbook state could not be read and no valid local backup was available",
        status: "unrecoverable"
      };
    }
  }

  requireWritableState() {
    const loaded = this.load();
    if (loaded.status === "unrecoverable") {
      throw new Error("state-unrecoverable-restore-required");
    }
    return loaded;
  }

  save(state) {
    this.requireWritableState();
    const admitted = admittedState(state);
    const previous = this.storage.getItem(STATE_KEY);
    if (previous !== null) {
      try {
        this.storage.setItem(BACKUP_KEY, JSON.stringify(parseAdmittedState(previous)));
      } catch {
        // Preserve the last known-good backup when prior state cannot be admitted.
      }
    }
    this.storage.setItem(STATE_KEY, JSON.stringify(admitted));
    return admittedState(admitted);
  }

  backup() {
    const loaded = this.load();
    if (loaded.status === "unrecoverable") {
      throw new Error("state-unrecoverable-restore-required");
    }
    if (loaded.status === "primary") {
      const state = loaded.state;
      this.storage.setItem(BACKUP_KEY, JSON.stringify(state));
      return { state: admittedState(state), error: null, status: "primary" };
    }
    return { state: admittedState(loaded.state), error: loaded.error, status: loaded.status };
  }

  importPlan(plan) {
    const loaded = this.load();
    if (loaded.status === "unrecoverable") {
      return { ok: false, error: "state-unrecoverable", errors: [] };
    }
    const validated = validateTeacherPlan(plan);
    if (!validated.ok) return { ok: false, error: "Invalid teacher plan", errors: validated.errors };
    const { state } = loaded;
    state.plan = validated.value;
    state.updatedAt = this.clock.now();
    this.save(state);
    return { ok: true, state: clone(state) };
  }

  exportState() {
    return clone(this.requireWritableState().state);
  }

  restoreState(state) {
    const admitted = admittedState(state);
    const serialized = JSON.stringify(admitted);
    this.storage.setItem(BACKUP_KEY, serialized);
    this.storage.setItem(STATE_KEY, serialized);
    return admittedState(admitted);
  }

  loadDeviceMetadata() {
    const raw = this.storage.getItem(DEVICE_KEY);
    if (raw === null) return defaultDeviceMetadata();
    try {
      return admitDeviceMetadata(JSON.parse(raw));
    } catch {
      return defaultDeviceMetadata();
    }
  }

  saveDeviceMetadata(metadata) {
    const admitted = admitDeviceMetadata(metadata);
    this.storage.setItem(DEVICE_KEY, JSON.stringify(admitted));
    return admitDeviceMetadata(admitted);
  }

  clearCloudIdentityMetadata({ preservePending = true } = {}) {
    const current = this.loadDeviceMetadata();
    const next = defaultDeviceMetadata();
    if (preservePending) {
      next.pendingDomains = current.pendingDomains.filter((domain) => PRIVATE_DEVICE_DOMAINS.has(domain));
    }
    return this.saveDeviceMetadata(next);
  }
}
