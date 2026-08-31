import assert from "node:assert/strict";
import test from "node:test";

import {
  TECH_TERRARIUM_ARTIFACT_ID,
  TECH_TERRARIUM_STAGES,
  createTechTerrariumArtifact,
  getCurrentContribution,
  recordArtifactHandoff,
  validateSharedArtifact
} from "../src/model/shared-artifact.js";

const CREATED_AT = "2026-08-31T13:00:00.000Z";
const NEXT_AT = "2026-08-31T13:35:00.000Z";

const EXPECTED_STAGES = [
  {
    id: "define",
    title: "Define the system",
    contributions: [
      { title: "Inspect and map the system" },
      { title: "Mark living and nonliving zones" },
      { title: "Choose one testable care question" }
    ]
  },
  {
    id: "prepare",
    title: "Prepare materials",
    contributions: [
      { title: "Sort one approved material batch" },
      { title: "Measure one approved layer set" },
      { title: "Stage one reusable component set" }
    ]
  },
  {
    id: "base",
    title: "Build the base",
    contributions: [
      { title: "Test one removable base layout" },
      { title: "Add one measured drainage section" },
      { title: "Check one access and cleanup path" }
    ]
  },
  {
    id: "systems",
    title: "Add living and technology systems",
    contributions: [
      { title: "Plan one removable system feature" },
      { title: "Install one monitored living element" },
      { title: "Route one sensor or water connection" }
    ]
  },
  {
    id: "test",
    title: "Test and communicate",
    contributions: [
      { title: "Run one care and stability check" },
      { title: "Record one system observation" },
      { title: "Prepare one next-class handoff summary" }
    ]
  }
];

function initialArtifact() {
  return createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: CREATED_AT
  });
}

function artifactAt(stageId, contributionIndex, status = "active") {
  return {
    ...initialArtifact(),
    stageId,
    contributionIndex,
    status
  };
}

test("creates the exact Tech Terrarium schema at the first contribution without mutating input", () => {
  const input = {
    artifactId: "tech-terrarium-2026-27",
    nowIso: CREATED_AT
  };
  const before = structuredClone(input);

  const artifact = createTechTerrariumArtifact(input);

  assert.deepEqual(input, before);
  assert.deepEqual(artifact, {
    schemaVersion: 1,
    artifactId: "tech-terrarium-2026-27",
    projectNumber: 2,
    stageId: "define",
    contributionIndex: 0,
    status: "active",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    visits: []
  });
  assert.deepEqual(getCurrentContribution(artifact), {
    stageId: "define",
    stageTitle: "Define the system",
    contributionIndex: 0,
    title: "Inspect and map the system"
  });
});

test("publishes the approved five-stage catalog with exactly three contribution titles each", () => {
  assert.deepEqual(TECH_TERRARIUM_STAGES, EXPECTED_STAGES);
  assert.equal(Object.isFrozen(TECH_TERRARIUM_STAGES), true);
  assert.ok(TECH_TERRARIUM_STAGES.every((stage) =>
    Object.isFrozen(stage) &&
    Object.isFrozen(stage.contributions) &&
    stage.contributions.every(Object.isFrozen)
  ));
});

test("Ready records the worked position and advances exactly one contribution", () => {
  const source = initialArtifact();
  const before = structuredClone(source);

  const result = recordArtifactHandoff(source, {
    handoff: "ready",
    eventId: "event-day3-class1",
    nowIso: NEXT_AT
  });

  assert.deepEqual(source, before);
  assert.equal(result.stageId, "define");
  assert.equal(result.contributionIndex, 1);
  assert.equal(result.status, "active");
  assert.equal(result.updatedAt, NEXT_AT);
  assert.deepEqual(result.visits, [{
    eventId: "event-day3-class1",
    handoff: "ready",
    stageId: "define",
    contributionIndex: 0,
    recordedAt: NEXT_AT
  }]);
});

test("Ready wraps from a stage's final contribution to the next stage", () => {
  const result = recordArtifactHandoff(artifactAt("define", 2), {
    handoff: "ready",
    eventId: "event-next-class",
    nowIso: NEXT_AT
  });

  assert.equal(result.stageId, "prepare");
  assert.equal(result.contributionIndex, 0);
  assert.deepEqual(getCurrentContribution(result), {
    stageId: "prepare",
    stageTitle: "Prepare materials",
    contributionIndex: 0,
    title: "Sort one approved material batch"
  });
  assert.deepEqual(result.visits[0], {
    eventId: "event-next-class",
    handoff: "ready",
    stageId: "define",
    contributionIndex: 2,
    recordedAt: NEXT_AT
  });
});

test("the final Ready records once, retains the final position, and completes terminally", () => {
  const source = artifactAt("test", 2);
  const completed = recordArtifactHandoff(source, {
    handoff: "ready",
    eventId: "event-final-class",
    nowIso: NEXT_AT
  });

  assert.equal(completed.stageId, "test");
  assert.equal(completed.contributionIndex, 2);
  assert.equal(completed.status, "complete");
  assert.equal(completed.visits.length, 1);
  const beforeRejectedHandoff = structuredClone(completed);
  for (const handoff of ["ready", "repeat", "park"]) {
    assert.throws(() => recordArtifactHandoff(completed, {
      handoff,
      eventId: "event-too-late",
      nowIso: "2026-08-31T14:00:00.000Z"
    }), /complete/i);
    assert.deepEqual(completed, beforeRejectedHandoff);
  }
});

test("Repeat and Park retain the worked contribution and record only the private-safe visit schema", () => {
  const source = artifactAt("base", 1);
  const repeated = recordArtifactHandoff(source, {
    handoff: "repeat",
    eventId: "event-repeat-class",
    nowIso: NEXT_AT
  });
  const parked = recordArtifactHandoff(source, {
    handoff: "park",
    eventId: "event-park-class",
    nowIso: NEXT_AT
  });

  assert.equal(repeated.stageId, "base");
  assert.equal(repeated.contributionIndex, 1);
  assert.equal(repeated.status, "active");
  assert.equal(parked.stageId, "base");
  assert.equal(parked.contributionIndex, 1);
  assert.equal(parked.status, "parked");
  assert.deepEqual(Object.keys(parked.visits[0]).sort(), [
    "contributionIndex",
    "eventId",
    "handoff",
    "recordedAt",
    "stageId"
  ]);
  assert.doesNotMatch(JSON.stringify([repeated, parked]), /classLabel|teacher|student|roster|notes/i);
});

test("Ready and Repeat resume a parked artifact while Park stays parked and records the visit", () => {
  const parked = artifactAt("prepare", 1, "parked");
  const ready = recordArtifactHandoff(parked, {
    handoff: "ready",
    eventId: "event-ready-resume",
    nowIso: NEXT_AT
  });
  const repeated = recordArtifactHandoff(parked, {
    handoff: "repeat",
    eventId: "event-repeat-resume",
    nowIso: NEXT_AT
  });
  const parkedAgain = recordArtifactHandoff(parked, {
    handoff: "park",
    eventId: "event-park-again",
    nowIso: NEXT_AT
  });

  assert.deepEqual([ready.status, ready.contributionIndex], ["active", 2]);
  assert.deepEqual([repeated.status, repeated.contributionIndex], ["active", 1]);
  assert.deepEqual([parkedAgain.status, parkedAgain.contributionIndex], ["parked", 1]);
  assert.equal(parkedAgain.visits.length, 1);
});

test("validation returns a detached strict-schema clone", () => {
  const source = recordArtifactHandoff(initialArtifact(), {
    handoff: "repeat",
    eventId: "event-safe-clone",
    nowIso: NEXT_AT
  });
  const admitted = validateSharedArtifact(source);

  assert.deepEqual(admitted, source);
  assert.notEqual(admitted, source);
  assert.notEqual(admitted.visits, source.visits);
  admitted.visits[0].eventId = "changed-after-validation";
  assert.equal(source.visits[0].eventId, "event-safe-clone");

  const contribution = getCurrentContribution(source);
  contribution.title = "changed-after-read";
  assert.equal(getCurrentContribution(source).title, "Inspect and map the system");
});

test("validation fails closed for artifact schema, type, range, timestamp, and extra-field defects", () => {
  const valid = initialArtifact();
  const invalid = [
    null,
    [],
    { ...valid, schemaVersion: 2 },
    { ...valid, artifactId: "tech-terrarium" },
    { ...valid, projectNumber: "2" },
    { ...valid, projectNumber: 3 },
    { ...valid, status: "paused" },
    { ...valid, stageId: "unknown" },
    { ...valid, contributionIndex: 3 },
    { ...valid, contributionIndex: 0.5 },
    { ...valid, createdAt: "2026-08-31T13:00:00Z" },
    { ...valid, updatedAt: "not-a-date" },
    { ...valid, updatedAt: "2026-08-31T12:59:59.000Z" },
    { ...valid, visits: {} },
    { ...valid, teacherId: "private-teacher" }
  ];

  for (const candidate of invalid) {
    assert.equal(validateSharedArtifact(candidate), null, JSON.stringify(candidate));
  }
});

test("validation fails closed for malformed visit fields, chronology, and extra data", () => {
  const valid = recordArtifactHandoff(initialArtifact(), {
    handoff: "repeat",
    eventId: "event-valid",
    nowIso: NEXT_AT
  });
  const visit = valid.visits[0];
  const withVisit = (replacement) => ({ ...valid, visits: [{ ...visit, ...replacement }] });
  const invalid = [
    withVisit({ eventId: "" }),
    withVisit({ eventId: " event-with-padding " }),
    withVisit({ eventId: 7 }),
    withVisit({ handoff: "next" }),
    withVisit({ stageId: "unknown" }),
    withVisit({ contributionIndex: -1 }),
    withVisit({ contributionIndex: 3 }),
    withVisit({ recordedAt: "2026-08-31T13:35:00Z" }),
    withVisit({ recordedAt: "2026-08-31T12:59:59.000Z" }),
    withVisit({ recordedAt: "2026-08-31T13:35:01.000Z" }),
    { ...valid, visits: [{ ...visit, classLabel: "Private class" }] }
  ];

  for (const candidate of invalid) {
    assert.equal(validateSharedArtifact(candidate), null, JSON.stringify(candidate));
  }
});

test("validation rejects complete state away from the final contribution and reversed visit order", () => {
  assert.equal(validateSharedArtifact(artifactAt("define", 0, "complete")), null);

  const first = recordArtifactHandoff(initialArtifact(), {
    handoff: "repeat",
    eventId: "event-first",
    nowIso: "2026-08-31T13:10:00.000Z"
  });
  const second = recordArtifactHandoff(first, {
    handoff: "repeat",
    eventId: "event-second",
    nowIso: "2026-08-31T13:20:00.000Z"
  });
  const reversed = { ...second, visits: [...second.visits].reverse() };
  assert.equal(validateSharedArtifact(reversed), null);
});

test("creation and handoffs reject noncanonical inputs and never mutate their sources", () => {
  const source = initialArtifact();
  const before = structuredClone(source);

  for (const options of [
    { handoff: "next", eventId: "event-valid", nowIso: NEXT_AT },
    { handoff: "ready", eventId: "", nowIso: NEXT_AT },
    { handoff: "ready", eventId: " event-valid ", nowIso: NEXT_AT },
    { handoff: "ready", eventId: "event-valid", nowIso: "2026-08-31T13:35:00Z" },
    { handoff: "ready", eventId: "event-valid", nowIso: "2026-08-31T12:59:59.000Z" },
    { handoff: "ready", eventId: "event-valid", nowIso: NEXT_AT, classLabel: "Private class" }
  ]) {
    assert.throws(() => recordArtifactHandoff(source, options));
    assert.deepEqual(source, before);
  }

  assert.throws(() => createTechTerrariumArtifact({
    artifactId: "wrong-id",
    nowIso: CREATED_AT
  }));
  assert.throws(() => createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: "2026-08-31T13:00:00Z"
  }));
  assert.throws(() => createTechTerrariumArtifact({
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    nowIso: CREATED_AT,
    teacherId: "private-teacher"
  }));
});
