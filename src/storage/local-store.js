import { admitResourceState } from "../model/access.js";
import { createInitialState, migrateLegacyState, STATE_FORMAT } from "../model/state.js";
import { validateTeacherPlan } from "../model/teacher-plan.js";

export const STATE_KEY = "circHQ.playbook.state.v1";
export const BACKUP_KEY = "circHQ.playbook.state.v1.backup";
export const DEVICE_KEY = "circHQ.playbook.device.v1";

function clone(value) {
  return structuredClone(value);
}

function admittedState(value) {
  return admitResourceState(value, { source: "local" });
}

export class LocalStore {
  constructor(storage, clock = { now: () => new Date().toISOString() }) {
    this.storage = storage;
    this.clock = clock;
  }

  load() {
    const raw = this.storage.getItem(STATE_KEY);
    if (raw === null) return { state: migrateLegacyState(this.storage, this.clock.now()).state, error: null };
    try {
      const state = JSON.parse(raw);
      if (state?.format !== STATE_FORMAT) throw new Error("unexpected format");
      return { state: admittedState(state), error: null };
    } catch {
      return { state: createInitialState(this.clock.now()), error: "Saved playbook state could not be read" };
    }
  }

  save(state) {
    const previous = this.storage.getItem(STATE_KEY);
    if (previous !== null) {
      try {
        this.storage.setItem(BACKUP_KEY, JSON.stringify(admittedState(JSON.parse(previous))));
      } catch {
        this.storage.setItem(BACKUP_KEY, previous);
      }
    }
    const admitted = admittedState(state);
    this.storage.setItem(STATE_KEY, JSON.stringify(admitted));
    return admittedState(admitted);
  }

  backup() {
    const prior = this.storage.getItem(STATE_KEY);
    if (prior === null) return { state: createInitialState(this.clock.now()), error: null };
    this.storage.setItem(BACKUP_KEY, prior);
    try {
      const state = admittedState(JSON.parse(prior));
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
