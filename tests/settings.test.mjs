import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createInitialState } from "../src/model/state.js";
import { validateTeacherPlan } from "../src/model/teacher-plan.js";
import { BACKUP_KEY, LocalStore, STATE_KEY } from "../src/storage/local-store.js";
import {
  applyPlanImport,
  exportSettingsBackup,
  parseSettingsBackup,
  previewClosure,
  previewCycleDayOverride,
  previewMakeupDayStatus,
  previewPlanImport,
  previewSpecialEvent
} from "../src/ui/settings.js";
import { createPrivateSeedRoute } from "../scripts/dev-server.mjs";
import { loadPrivateSeedOnLocalhost } from "../src/app.js";

const NOW = "2026-08-28T12:00:00.000Z";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function plan(label = "Workshop") {
  return {
    format: "playbook.teacherPlan.v2",
    version: 1,
    calendar: {
      anchorDate: "2026-08-20",
      anchorDay: 1,
      lastDate: "2027-06-04",
      noSchool: ["2026-09-07"],
      conditionalMakeup: ["2027-02-12"],
      overrides: {}
    },
    teachers: [{
      id: "teacher-alpha",
      name: "Teacher Alpha",
      days: {
        1: [{
          id: "event-alpha",
          type: "teach",
          label,
          start: "09:00",
          end: "09:30"
        }]
      }
    }],
    specialEvents: [],
    resources: []
  };
}

function v1Source(time = "9:00-9:30") {
  return {
    format: "playbook.teacherPlan.v1",
    preferredDay: 1,
    calendar: {
      anchorDate: "2026-08-20",
      anchorDay: 1,
      lastDate: "2027-06-04",
      noSchool: ["2026-09-07"]
    },
    plan: {
      status: "generic",
      days: [1, 2, 3, 4, 5].map((day) => ({
        day,
        label: `Cycle ${day}`,
        events: [{ time, type: "teach", label: `Generic block ${day}` }]
      }))
    }
  };
}

function migrationOptions() {
  return {
    teacher: { id: "teacher-alpha", name: "Teacher Alpha" },
    dutyRules: [],
    confirmationNeededSlots: []
  };
}

function storeWithPlan(currentPlan = plan()) {
  const storage = memoryStorage();
  const store = new LocalStore(storage, { now: () => NOW });
  const state = createInitialState(NOW);
  state.plan = currentPlan;
  store.save(state);
  return { store, storage };
}

test("invalid JSON is rejected without changing current state or backup", () => {
  const { store, storage } = storeWithPlan();
  const stateBefore = storage.getItem(STATE_KEY);
  const backupBefore = storage.getItem(BACKUP_KEY);

  const preview = previewPlanImport(store.load().state.plan, "{not-json");
  const applied = applyPlanImport(store, preview.previewToken);

  assert.equal(preview.ok, false);
  assert.ok(preview.validation.errors.includes("json-invalid"));
  assert.equal(applied.ok, false);
  assert.equal(storage.getItem(STATE_KEY), stateBefore);
  assert.equal(storage.getItem(BACKUP_KEY), backupBefore);
});

test("valid preview summarizes counts without changing stored state", () => {
  const { store, storage } = storeWithPlan();
  const next = plan("Updated workshop");
  const stateBefore = storage.getItem(STATE_KEY);

  const preview = previewPlanImport(store.load().state.plan, JSON.stringify(next));

  assert.equal(preview.ok, true);
  assert.equal(preview.validation.ok, true);
  assert.equal(preview.candidate.teachers[0].days["1"][0].label, "Updated workshop");
  assert.deepEqual(preview.summary, {
    sourceFormat: "playbook.teacherPlan.v2",
    teacherCount: 1,
    eventCount: 1,
    addedCount: 0,
    removedCount: 0,
    changedCount: 1
  });
  assert.equal(storage.getItem(STATE_KEY), stateBefore);
  assert.equal(storage.getItem(BACKUP_KEY), null);
});

test("Apply requires the exact active preview token and stores one prior version", () => {
  const { store, storage } = storeWithPlan();
  const originalState = storage.getItem(STATE_KEY);
  const preview = previewPlanImport(store.load().state.plan, JSON.stringify(plan("Applied workshop")));

  const wrong = applyPlanImport(store, { id: preview.previewToken.id });
  assert.equal(wrong.ok, false);
  assert.equal(storage.getItem(STATE_KEY), originalState);

  const applied = applyPlanImport(store, preview.previewToken);
  assert.equal(applied.ok, true);
  assert.equal(applied.state.plan.teachers[0].days["1"][0].label, "Applied workshop");
  assert.equal(storage.getItem(BACKUP_KEY), originalState);

  const reused = applyPlanImport(store, preview.previewToken);
  assert.equal(reused.ok, false);
  assert.equal(storage.getItem(BACKUP_KEY), originalState);
});

test("applying an identical preview is a no-op that preserves the meaningful prior backup", () => {
  const { store, storage } = storeWithPlan();
  const priorBackup = JSON.stringify({ format: "playbook.state.v1", updatedAt: "prior" });
  storage.setItem(BACKUP_KEY, priorBackup);
  const stateBefore = storage.getItem(STATE_KEY);
  const preview = previewPlanImport(store.load().state.plan, JSON.stringify(plan()));

  const applied = applyPlanImport(store, preview.previewToken);

  assert.equal(applied.ok, true);
  assert.equal(applied.unchanged, true);
  assert.equal(storage.getItem(STATE_KEY), stateBefore);
  assert.equal(storage.getItem(BACKUP_KEY), priorBackup);
});

test("export round-trip preserves the validated state envelope", () => {
  const { store } = storeWithPlan();

  const text = exportSettingsBackup(store);
  const parsed = parseSettingsBackup(text);

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, store.exportState());
  assert.equal(validateTeacherPlan(parsed.value.plan).ok, true);
});

test("closure makeup cycle override and special event previews create stable validated entities", () => {
  const current = plan();
  const closureOne = previewClosure(current, "2026-09-08");
  const closureTwo = previewClosure(current, "2026-09-08");
  assert.equal(closureOne.ok, true);
  assert.deepEqual(
    closureOne.candidate.calendar.overrides["2026-09-08"],
    closureTwo.candidate.calendar.overrides["2026-09-08"]
  );
  assert.equal(closureOne.candidate.calendar.overrides["2026-09-08"].kind, "closed");

  const makeup = previewMakeupDayStatus(current, "2027-02-12", "instructional");
  assert.equal(makeup.ok, true);
  assert.equal(makeup.candidate.calendar.overrides["2027-02-12"].kind, "instructional");

  const cycle = previewCycleDayOverride(current, "2026-09-09", 4);
  assert.equal(cycle.ok, true);
  assert.equal(cycle.candidate.calendar.overrides["2026-09-09"].kind, "cycle");
  assert.equal(cycle.candidate.calendar.overrides["2026-09-09"].day, 4);

  const specialOne = previewSpecialEvent(current, {
    date: "2026-09-10",
    label: "Community event"
  });
  const specialTwo = previewSpecialEvent(current, {
    date: "2026-09-10",
    label: "Community event"
  });
  assert.equal(specialOne.ok, true);
  assert.equal(specialOne.candidate.specialEvents[0].id, specialTwo.candidate.specialEvents[0].id);
  assert.equal(specialOne.candidate.specialEvents[0].type, "special");
  assert.equal(validateTeacherPlan(specialOne.candidate).ok, true);
});

test("conditional makeup status can move between pending instructional and closed without source edits", () => {
  const current = plan();
  const instructional = previewMakeupDayStatus(current, "2027-02-12", "instructional");
  const closed = previewMakeupDayStatus(instructional.candidate, "2027-02-12", "closed");
  const pending = previewMakeupDayStatus(closed.candidate, "2027-02-12", "pending");

  assert.equal(instructional.candidate.calendar.overrides["2027-02-12"].kind, "instructional");
  assert.equal(closed.candidate.calendar.overrides["2027-02-12"].kind, "closed");
  assert.equal(Object.hasOwn(pending.candidate.calendar.overrides, "2027-02-12"), false);
  assert.deepEqual(current.calendar.overrides, {});
});

test("v1 import migrates through the contract before preview and Apply", () => {
  const { store } = storeWithPlan();
  const preview = previewPlanImport(
    store.load().state.plan,
    JSON.stringify(v1Source()),
    { migrationOptions: migrationOptions() }
  );

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.sourceFormat, "playbook.teacherPlan.v1");
  assert.equal(preview.candidate.format, "playbook.teacherPlan.v2");
  assert.equal(preview.summary.eventCount, 5);

  const applied = applyPlanImport(store, preview.previewToken);
  assert.equal(applied.ok, true);
  assert.equal(applied.state.plan.format, "playbook.teacherPlan.v2");
  assert.equal(validateTeacherPlan(applied.state.plan).ok, true);
});

test("failed v1 conversion leaves current state and backup unchanged", () => {
  const { store, storage } = storeWithPlan();
  const stateBefore = storage.getItem(STATE_KEY);
  const backupBefore = storage.getItem(BACKUP_KEY);
  const preview = previewPlanImport(
    store.load().state.plan,
    JSON.stringify(v1Source("4:00-4:01")),
    { migrationOptions: migrationOptions() }
  );

  assert.equal(preview.ok, false);
  assert.equal(preview.candidate, null);
  assert.ok(preview.validation.errors.some((code) => code.startsWith("time-")));
  assert.equal(applyPlanImport(store, preview.previewToken).ok, false);
  assert.equal(storage.getItem(STATE_KEY), stateBefore);
  assert.equal(storage.getItem(BACKUP_KEY), backupBefore);
});

test("private seed routes return no-store content only for their exact configured path", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "circ-hq-route-"));
  context.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, "generic.json");
  await writeFile(file, JSON.stringify({ format: "generic" }));
  const route = createPrivateSeedRoute(file, "/__private__/plan.json");

  const exact = await route("/__private__/plan.json");
  assert.equal(exact.status, 200);
  assert.equal(exact.headers["Cache-Control"], "no-store");
  assert.equal(exact.body, JSON.stringify({ format: "generic" }));

  assert.equal((await route("/__private__/migration-options.json")).status, 404);
  assert.equal((await route("/__private__/../generic.json")).status, 404);
  assert.equal((await route("/__private__/%2e%2e/generic.json")).status, 404);

  const defaultPlanRoute = createPrivateSeedRoute(file);
  assert.equal((await defaultPlanRoute("/__private__/plan.json")).status, 200);
});

test("an absent private seed path returns a no-store 404", async () => {
  const route = createPrivateSeedRoute(undefined, "/__private__/plan.json");
  const result = await route("/__private__/plan.json");

  assert.equal(result.status, 404);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(result.body, "");
});

test("localhost private v1 seed uses migration preview and Apply while missing options keeps Today recoverable", async () => {
  const sourceText = JSON.stringify(v1Source());
  const optionsText = JSON.stringify(migrationOptions());
  const appliedStore = storeWithPlan().store;
  const requests = [];
  const applied = await loadPrivateSeedOnLocalhost({
    hostname: "127.0.0.1",
    store: appliedStore,
    fetchImpl: async (url) => {
      requests.push(url);
      if (url === "/__private__/plan.json") return { ok: true, text: async () => sourceText };
      if (url === "/__private__/migration-options.json") return { ok: true, text: async () => optionsText };
      return { ok: false, status: 404, text: async () => "" };
    }
  });

  assert.deepEqual(requests, [
    "/__private__/plan.json",
    "/__private__/migration-options.json"
  ]);
  assert.equal(applied.status, "applied");
  assert.equal(applied.state.plan.format, "playbook.teacherPlan.v2");
  assert.equal(applied.state.plan.teachers[0].days["1"].length, 1);

  const missing = storeWithPlan();
  const before = missing.storage.getItem(STATE_KEY);
  const failed = await loadPrivateSeedOnLocalhost({
    hostname: "localhost",
    store: missing.store,
    fetchImpl: async (url) => url === "/__private__/plan.json"
      ? { ok: true, text: async () => sourceText }
      : { ok: false, status: 404, text: async () => "" }
  });
  assert.equal(failed.status, "migration-options-required");
  assert.match(failed.nextAction, /Settings|migration options/i);
  assert.equal(missing.storage.getItem(STATE_KEY), before);

  let called = false;
  const skipped = await loadPrivateSeedOnLocalhost({
    hostname: "example.test",
    store: missing.store,
    fetchImpl: async () => {
      called = true;
      throw new Error("must not fetch");
    }
  });
  assert.equal(skipped.status, "not-localhost");
  assert.equal(called, false);
});
