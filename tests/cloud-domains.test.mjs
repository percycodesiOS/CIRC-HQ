import assert from "node:assert/strict";
import test from "node:test";

import { createTechTerrariumArtifact } from "../src/model/shared-artifact.js";
import { createInitialState } from "../src/model/state.js";
import {
  applyPrivateDomains,
  applySharedDomains,
  assertCloudDomainShape,
  partitionPrivateDomains,
  partitionSharedDomains
} from "../src/storage/cloud-domains.js";

const NOW = "2026-09-01T13:00:00.000Z";

function stateFixture() {
  const state = createInitialState(NOW);
  state.teacherProgress = {
    "local:default": {
      currentProjectNumber: 2,
      completedProjectNumbers: [1],
      complete: false,
      updatedAt: NOW
    }
  };
  state.checklist = [{ id: "check-1", text: "Private checklist", updatedAt: NOW }];
  state.notes = [{
    id: "note-1",
    text: "Private notes stay private",
    visibility: "teacher-private",
    updatedAt: NOW
  }];
  state.preferences = { teacherId: "teacher-1" };
  state.sharedArtifacts = {
    "tech-terrarium-2026-27": createTechTerrariumArtifact({
      artifactId: "tech-terrarium-2026-27",
      nowIso: NOW
    })
  };
  return state;
}

test("private cloud data excludes runners and shared artifacts", () => {
  const domains = partitionPrivateDomains(stateFixture());
  const serialized = JSON.stringify(domains);

  assert.doesNotMatch(serialized, /experienceRunners|sharedArtifacts/);
  assert.deepEqual(Object.keys(domains).sort(), ["content", "plan", "preferences", "progress"]);
  assert.deepEqual(Object.keys(domains.content).sort(), [
    "checklist",
    "classes",
    "lessonGuides",
    "notes",
    "resources",
    "specialEvents",
    "tombstones"
  ]);
});

test("shared cloud data contains only admitted room domains", () => {
  const domains = partitionSharedDomains(stateFixture());

  assert.deepEqual(Object.keys(domains).sort(), ["artifacts", "projectProgress"]);
  assert.deepEqual(domains.projectProgress, {
    "tech-terrarium-2026-27": {
      projectNumber: 2,
      stageId: "define",
      contributionIndex: 0,
      status: "active",
      updatedAt: NOW
    }
  });
  assert.doesNotMatch(JSON.stringify(domains), /schedule|duty|notes|resources|preferences/);
  assert.deepEqual(domains.artifacts["tech-terrarium-2026-27"].visitIdentities, []);
});

test("unknown cloud fields fail closed", () => {
  assert.throws(
    () => assertCloudDomainShape("plan", { plan: null, token: "no" }),
    /cloud-domain-invalid/
  );
});

test("project progress rejects identities and positions that admitted artifacts cannot produce", () => {
  const validProgress = partitionSharedDomains(stateFixture()).projectProgress[
    "tech-terrarium-2026-27"
  ];
  const invalidProgress = [
    { "": validProgress },
    { "unknown-project": validProgress },
    { "tech-terrarium-2026-27": { ...validProgress, stageId: "unknown-stage" } },
    { "tech-terrarium-2026-27": { ...validProgress, contributionIndex: 3 } }
  ];

  for (const value of invalidProgress) {
    assert.throws(
      () => assertCloudDomainShape("projectProgress", value),
      /cloud-domain-invalid/
    );
  }
});

test("private-domain apply updates only admitted private fields", () => {
  const local = stateFixture();
  const cloud = partitionPrivateDomains(local);
  cloud.content.notes = [{
    id: "note-2",
    text: "Cloud private note",
    visibility: "teacher-private",
    updatedAt: NOW
  }];

  const applied = applyPrivateDomains(local, cloud);

  assert.deepEqual(applied.notes, cloud.content.notes);
  assert.deepEqual(applied.sharedArtifacts, local.sharedArtifacts);
  assert.deepEqual(applied.experienceRunners, local.experienceRunners);
});

test("shared-domain apply rejects private data and updates only room artifacts", () => {
  const local = stateFixture();
  const cloud = partitionSharedDomains(local);
  const applied = applySharedDomains(local, cloud);

  assert.deepEqual(applied.sharedArtifacts, cloud.artifacts);
  assert.deepEqual(applied.notes, local.notes);
  assert.throws(
    () => applySharedDomains(local, { ...cloud, preferences: { teacherId: "teacher-2" } }),
    /cloud-domain-invalid/
  );
});
