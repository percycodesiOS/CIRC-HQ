import { admitLocalState } from "../model/access.js";
import { createInitialState, STATE_FORMAT } from "../model/state.js";
import { validateTeacherPlan } from "../model/teacher-plan.js";

export const STATE_KEY = "circHQ.k6.state.v1";
export const BACKUP_KEY = "circHQ.k6.backup.v1";
export const DEVICE_KEY = "circHQ.k6.device.v1";

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

export class LocalStore {
  static primaryKey = STATE_KEY;
  static backupKey = BACKUP_KEY;

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
}
