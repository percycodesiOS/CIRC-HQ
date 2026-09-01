import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { readFile } from "node:fs/promises";

const PROJECT_ID = "demo-circ-hq-rules";
const RULES_PATH = new URL("../firestore.rules", import.meta.url);
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const enabled = typeof EMULATOR_HOST === "string" && EMULATOR_HOST !== "";

async function clearFirestore(environment) {
  await environment.clearFirestore();
}

function teacherRoot(uid, tenantId = "tenant-one", roomId = "room-one") {
  return {
    schemaVersion: 1,
    revision: 1,
    tenantId,
    roomId,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
}

function privatePlan(uid, revision = 1) {
  return {
    schemaVersion: 1,
    revision,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    plan: null
  };
}

test("Firestore emulator rule matrix is intentionally skipped without its local host", { skip: !enabled }, async (context) => {
  const [host, port] = EMULATOR_HOST.split(":");
  const rules = await readFile(RULES_PATH, "utf8");
  const environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(port), rules }
  });
  context.after(async () => clearFirestore(environment));
  context.after(async () => environment.cleanup());

  const kenny = environment.authenticatedContext("kenny").firestore();
  const tammy = environment.authenticatedContext("tammy").firestore();
  const unrelated = environment.authenticatedContext("unrelated").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const kennyRoot = doc(kenny, "playbookTeachers/kenny");
  const tammyRoot = doc(tammy, "playbookTeachers/tammy");
  const kennyPlan = doc(kenny, "playbookTeachers/kenny/private/plan");

  await environment.withSecurityRulesDisabled(async (disabled) => {
    const database = disabled.firestore();
    await setDoc(doc(database, "playbookTeachers/kenny"), teacherRoot("kenny"));
    await setDoc(doc(database, "playbookTeachers/tammy"), teacherRoot("tammy"));
    await setDoc(doc(database, "playbookTeachers/kenny/private/plan"), privatePlan("kenny"));
    await setDoc(doc(database, "playbookTeachers/tammy/private/plan"), privatePlan("tammy"));
  });

  await assertSucceeds(getDoc(kennyRoot));
  await assertSucceeds(getDoc(tammyRoot));
  await assertSucceeds(getDoc(kennyPlan));
  await assertFails(getDoc(doc(kenny, "playbookTeachers/tammy")));
  await assertFails(getDoc(doc(tammy, "playbookTeachers/kenny/private/plan")));
  await assertFails(getDoc(doc(unrelated, "playbookTeachers/kenny")));
  await assertFails(getDoc(doc(anonymous, "playbookTeachers/kenny/private/plan")));

  await assertFails(setDoc(doc(kenny, "playbookTeachers/kenny/private/unknown"), privatePlan("kenny")));
  await assertFails(setDoc(kennyPlan, { ...privatePlan("kenny", 2), experienceRunners: {} }));
  await assertFails(setDoc(kennyPlan, { ...privatePlan("tammy", 2) }));
  await assertFails(setDoc(kennyPlan, { ...privatePlan("kenny", 4) }));
  await assertFails(deleteDoc(kennyPlan));
  assert.ok(true);
});
