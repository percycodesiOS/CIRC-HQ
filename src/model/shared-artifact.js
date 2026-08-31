export const TECH_TERRARIUM_ARTIFACT_ID = "tech-terrarium-2026-27";

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

export const TECH_TERRARIUM_STAGES = deepFreeze([
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
]);

const ARTIFACT_KEYS = Object.freeze([
  "schemaVersion",
  "artifactId",
  "projectNumber",
  "stageId",
  "contributionIndex",
  "status",
  "createdAt",
  "updatedAt",
  "visits"
].sort());
const VISIT_KEYS = Object.freeze([
  "eventId",
  "handoff",
  "stageId",
  "contributionIndex",
  "recordedAt"
].sort());
const CREATE_KEYS = Object.freeze(["artifactId", "nowIso"].sort());
const HANDOFF_KEYS = Object.freeze(["handoff", "eventId", "nowIso"].sort());
const STATUSES = new Set(["active", "parked", "complete"]);
const HANDOFFS = new Set(["ready", "repeat", "park"]);

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expected) {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isEventId(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function stageForId(stageId) {
  return TECH_TERRARIUM_STAGES.find((stage) => stage.id === stageId) ?? null;
}

function validPosition(stageId, contributionIndex) {
  const stage = stageForId(stageId);
  return Boolean(
    stage &&
    Number.isInteger(contributionIndex) &&
    contributionIndex >= 0 &&
    contributionIndex < stage.contributions.length
  );
}

function isFinalPosition(stageId, contributionIndex) {
  const finalStage = TECH_TERRARIUM_STAGES.at(-1);
  return stageId === finalStage.id && contributionIndex === finalStage.contributions.length - 1;
}

function validVisit(visit, createdTimestamp, updatedTimestamp, previousTimestamp) {
  if (!hasExactKeys(visit, VISIT_KEYS)) return null;
  if (!isEventId(visit.eventId) || !HANDOFFS.has(visit.handoff)) return null;
  if (!validPosition(visit.stageId, visit.contributionIndex)) return null;
  if (!isCanonicalIso(visit.recordedAt)) return null;
  const recordedTimestamp = Date.parse(visit.recordedAt);
  if (
    recordedTimestamp < createdTimestamp ||
    recordedTimestamp > updatedTimestamp ||
    recordedTimestamp < previousTimestamp
  ) return null;
  return recordedTimestamp;
}

export function validateSharedArtifact(candidate) {
  if (!hasExactKeys(candidate, ARTIFACT_KEYS)) return null;
  if (
    candidate.schemaVersion !== 1 ||
    candidate.artifactId !== TECH_TERRARIUM_ARTIFACT_ID ||
    candidate.projectNumber !== 2 ||
    !STATUSES.has(candidate.status) ||
    !validPosition(candidate.stageId, candidate.contributionIndex) ||
    !isCanonicalIso(candidate.createdAt) ||
    !isCanonicalIso(candidate.updatedAt) ||
    !Array.isArray(candidate.visits)
  ) return null;

  const createdTimestamp = Date.parse(candidate.createdAt);
  const updatedTimestamp = Date.parse(candidate.updatedAt);
  if (updatedTimestamp < createdTimestamp) return null;
  if (
    candidate.status === "complete" &&
    !isFinalPosition(candidate.stageId, candidate.contributionIndex)
  ) return null;

  let previousTimestamp = createdTimestamp;
  for (const visit of candidate.visits) {
    const recordedTimestamp = validVisit(
      visit,
      createdTimestamp,
      updatedTimestamp,
      previousTimestamp
    );
    if (recordedTimestamp === null) return null;
    previousTimestamp = recordedTimestamp;
  }
  return structuredClone(candidate);
}

export function createTechTerrariumArtifact(options) {
  if (
    !hasExactKeys(options, CREATE_KEYS) ||
    options.artifactId !== TECH_TERRARIUM_ARTIFACT_ID ||
    !isCanonicalIso(options.nowIso)
  ) {
    throw new TypeError("shared-artifact-create-invalid");
  }
  return {
    schemaVersion: 1,
    artifactId: TECH_TERRARIUM_ARTIFACT_ID,
    projectNumber: 2,
    stageId: TECH_TERRARIUM_STAGES[0].id,
    contributionIndex: 0,
    status: "active",
    createdAt: options.nowIso,
    updatedAt: options.nowIso,
    visits: []
  };
}

export function getCurrentContribution(artifact) {
  const admitted = validateSharedArtifact(artifact);
  if (!admitted) return null;
  const stage = stageForId(admitted.stageId);
  const contribution = stage.contributions[admitted.contributionIndex];
  return {
    stageId: stage.id,
    stageTitle: stage.title,
    contributionIndex: admitted.contributionIndex,
    title: contribution.title
  };
}

export function recordArtifactHandoff(artifact, options) {
  const admitted = validateSharedArtifact(artifact);
  if (!admitted) throw new TypeError("shared-artifact-invalid");
  if (admitted.status === "complete") throw new Error("shared-artifact-complete");
  if (
    !hasExactKeys(options, HANDOFF_KEYS) ||
    !HANDOFFS.has(options.handoff) ||
    !isEventId(options.eventId) ||
    !isCanonicalIso(options.nowIso) ||
    Date.parse(options.nowIso) < Date.parse(admitted.updatedAt)
  ) {
    throw new TypeError("shared-artifact-handoff-invalid");
  }

  const workedStageId = admitted.stageId;
  const workedContributionIndex = admitted.contributionIndex;
  admitted.visits.push({
    eventId: options.eventId,
    handoff: options.handoff,
    stageId: workedStageId,
    contributionIndex: workedContributionIndex,
    recordedAt: options.nowIso
  });
  admitted.updatedAt = options.nowIso;

  if (options.handoff === "park") {
    admitted.status = "parked";
  } else if (options.handoff === "repeat") {
    admitted.status = "active";
  } else if (isFinalPosition(workedStageId, workedContributionIndex)) {
    admitted.status = "complete";
  } else {
    admitted.status = "active";
    const stageIndex = TECH_TERRARIUM_STAGES.findIndex((stage) => stage.id === workedStageId);
    const stage = TECH_TERRARIUM_STAGES[stageIndex];
    if (workedContributionIndex + 1 < stage.contributions.length) {
      admitted.contributionIndex += 1;
    } else {
      admitted.stageId = TECH_TERRARIUM_STAGES[stageIndex + 1].id;
      admitted.contributionIndex = 0;
    }
  }

  const result = validateSharedArtifact(admitted);
  if (!result) throw new Error("shared-artifact-transition-invalid");
  return result;
}
