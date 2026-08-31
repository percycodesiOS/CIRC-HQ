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
    if (raw === null) return { state: createInitialState(this.clock.now()), error: null };
    try {
      return { state: parseAdmittedState(raw), error: null };
    } catch {
      return { state: createInitialState(this.clock.now()), error: "Saved playbook state could not be read" };
    }
  }

  save(state) {
    const previous = this.storage.getItem(STATE_KEY);
    if (previous !== null) {
      try {
        this.storage.setItem(BACKUP_KEY, JSON.stringify(parseAdmittedState(previous)));
      } catch {
        // Preserve the last known-good backup when prior state cannot be admitted.
      }
    }
    const admitted = admittedState(state);
    this.storage.setItem(STATE_KEY, JSON.stringify(admitted));
    return admittedState(admitted);
  }

  backup() {
    const prior = this.storage.getItem(STATE_KEY);
    if (prior === null) return { state: createInitialState(this.clock.now()), error: null };
    try {
      const state = parseAdmittedState(prior);
      this.storage.setItem(BACKUP_KEY, JSON.stringify(state));
      return { state, error: null };
    } catch {
      return {
        state: createInitialState(this.clock.now()),
        error: "Saved playbook state could not be read"
      };
    }
  }

  importPlan(plan) {
    const validated = validateTeacherPlan(plan);
    if (!validated.ok) return { ok: false, error: "Invalid teacher plan", errors: validated.errors };
    const { state } = this.load();
    state.plan = validated.value;
    state.updatedAt = this.clock.now();
    this.save(state);
    return { ok: true, state: clone(state) };
  }

  exportState() {
    return clone(this.load().state);
  }
}
