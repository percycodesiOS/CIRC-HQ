import { admitLocalState } from "../model/access.js";
import {
  TECH_TERRARIUM_ARTIFACT_ID,
  TECH_TERRARIUM_STAGES,
  validateSharedArtifact
} from "../model/shared-artifact.js";
import { findForbiddenField, isCanonicalIso, isPlainRecord } from "../model/schema-admission.js";

const PRIVATE_CONTENT_FIELDS = Object.freeze([
  "checklist",
  "classes",
  "lessonGuides",
  "specialEvents",
  "resources",
  "notes",
  "tombstones"
]);
const PRIVATE_DOMAINS = Object.freeze(["plan", "progress", "preferences", "content"]);
const SHARED_DOMAINS = Object.freeze(["artifacts", "projectProgress"]);
const SHARED_PRIVATE_FIELDS = new Set([
  "plan",
  "teacherprogress",
  "preferences",
  "checklist",
  "classes",
  "lessonguides",
  "specialevents",
  "resources",
  "notes",
  "tombstones",
  "experiencerunners",
  "classroomfacing",
  "schedule",
  "duty",
  "teacher",
  "private",
  "local"
]);
const CLOUD_FORBIDDEN_FIELDS = new Set([
  "auth",
  "authentication",
  "firebase",
  "runner",
  "runners",
  "experiencerunner",
  "experiencerunners",
  "submission",
  "submissions",
  "studentsubmission",
  "studentsubmissions"
]);
const PROJECT_PROGRESS_KEYS = Object.freeze([
  "projectNumber",
  "stageId",
  "contributionIndex",
  "status",
  "updatedAt"
].sort());
const PROJECT_STATUSES = new Set(["active", "parked", "complete"]);

function cloudDomainError() {
  throw new TypeError("cloud-domain-invalid");
}

function isDeepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => isDeepEqual(entry, right[index]));
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return isDeepEqual(leftKeys, rightKeys) && leftKeys.every((key) => isDeepEqual(left[key], right[key]));
}

function hasExactKeys(value, keys) {
  return isPlainRecord(value) && isDeepEqual(Object.keys(value).sort(), [...keys].sort());
}

function normalizedFieldName(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasForbiddenCloudField(value, { shared = false } = {}) {
  if (findForbiddenField(value)) return true;
  const seen = new WeakSet();
  const visit = (candidate) => {
    if (candidate === null || typeof candidate !== "object") return false;
    if (seen.has(candidate) || !Array.isArray(candidate) && !isPlainRecord(candidate)) return true;
    seen.add(candidate);
    if (Array.isArray(candidate)) return candidate.some(visit);
    return Object.entries(candidate).some(([key, entry]) => {
      const normalized = normalizedFieldName(key);
      return CLOUD_FORBIDDEN_FIELDS.has(normalized) ||
        shared && SHARED_PRIVATE_FIELDS.has(normalized) ||
        visit(entry);
    });
  };
  return visit(value);
}

function privateAdmissionBase() {
  return {
    format: "playbook.state.v1",
    schemaVersion: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
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

function admittedPrivateDomain(domain, value) {
  const state = privateAdmissionBase();
  if (domain === "plan") state.plan = value.plan;
  if (domain === "progress") state.teacherProgress = value.teacherProgress;
  if (domain === "preferences") state.preferences = value.preferences;
  if (domain === "content") {
    for (const field of PRIVATE_CONTENT_FIELDS) state[field] = value[field];
  }
  const admitted = admitLocalState(state);
  if (domain === "plan") return { plan: admitted.plan };
  if (domain === "progress") return { teacherProgress: admitted.teacherProgress };
  if (domain === "preferences") return { preferences: admitted.preferences };
  return Object.fromEntries(PRIVATE_CONTENT_FIELDS.map((field) => [field, admitted[field]]));
}

function validatePrivateDomain(domain, value) {
  const expectedKeys = {
    plan: ["plan"],
    progress: ["teacherProgress"],
    preferences: ["preferences"],
    content: PRIVATE_CONTENT_FIELDS
  }[domain];
  if (!expectedKeys || !hasExactKeys(value, expectedKeys) || hasForbiddenCloudField(value)) {
    cloudDomainError();
  }
  try {
    if (!isDeepEqual(value, admittedPrivateDomain(domain, value))) cloudDomainError();
  } catch {
    cloudDomainError();
  }
}

function projectProgressForArtifacts(artifacts) {
  return Object.fromEntries(Object.entries(artifacts).map(([artifactId, artifact]) => [artifactId, {
    projectNumber: artifact.projectNumber,
    stageId: artifact.stageId,
    contributionIndex: artifact.contributionIndex,
    status: artifact.status,
    updatedAt: artifact.updatedAt
  }]));
}

function validateArtifacts(value) {
  if (!isPlainRecord(value) || hasForbiddenCloudField(value, { shared: true })) cloudDomainError();
  for (const [artifactId, artifact] of Object.entries(value)) {
    const admitted = validateSharedArtifact(artifact);
    if (artifactId !== admitted?.artifactId || !isDeepEqual(artifact, admitted)) cloudDomainError();
  }
}

function validateProjectProgress(value) {
  if (!isPlainRecord(value) || hasForbiddenCloudField(value, { shared: true })) cloudDomainError();
  for (const [projectId, progress] of Object.entries(value)) {
    const stage = TECH_TERRARIUM_STAGES.find((candidate) => candidate.id === progress?.stageId);
    const finalStage = TECH_TERRARIUM_STAGES.at(-1);
    const isFinalPosition = stage?.id === finalStage.id &&
      progress?.contributionIndex === finalStage.contributions.length - 1;
    if (
      projectId !== TECH_TERRARIUM_ARTIFACT_ID ||
      !hasExactKeys(progress, PROJECT_PROGRESS_KEYS) ||
      progress.projectNumber !== 2 ||
      !stage ||
      !Number.isInteger(progress.contributionIndex) ||
      progress.contributionIndex < 0 ||
      progress.contributionIndex >= stage.contributions.length ||
      !PROJECT_STATUSES.has(progress.status) ||
      progress.status === "complete" && !isFinalPosition ||
      !isCanonicalIso(progress.updatedAt)
    ) cloudDomainError();
  }
}

export function assertCloudDomainShape(domain, value) {
  if (domain === "plan" || domain === "progress" || domain === "preferences" || domain === "content") {
    validatePrivateDomain(domain, value);
  } else if (domain === "artifacts") {
    validateArtifacts(value);
  } else if (domain === "projectProgress") {
    validateProjectProgress(value);
  } else {
    cloudDomainError();
  }
  return structuredClone(value);
}

function assertDomainBundle(domains, expectedDomains) {
  if (!hasExactKeys(domains, expectedDomains)) cloudDomainError();
  for (const domain of expectedDomains) assertCloudDomainShape(domain, domains[domain]);
}

export function partitionPrivateDomains(state) {
  const admitted = admitLocalState(state);
  return {
    plan: { plan: structuredClone(admitted.plan) },
    progress: { teacherProgress: structuredClone(admitted.teacherProgress ?? {}) },
    preferences: { preferences: structuredClone(admitted.preferences ?? {}) },
    content: Object.fromEntries(PRIVATE_CONTENT_FIELDS.map((key) => [key, structuredClone(admitted[key] ?? [])]))
  };
}

export function partitionSharedDomains(state) {
  const admitted = admitLocalState(state);
  const artifacts = structuredClone(admitted.sharedArtifacts ?? {});
  return {
    artifacts,
    projectProgress: projectProgressForArtifacts(artifacts)
  };
}

export function applyPrivateDomains(local, cloud) {
  const admittedLocal = admitLocalState(local);
  assertDomainBundle(cloud, PRIVATE_DOMAINS);
  const next = structuredClone(admittedLocal);
  next.plan = structuredClone(cloud.plan.plan);
  next.teacherProgress = structuredClone(cloud.progress.teacherProgress);
  next.preferences = structuredClone(cloud.preferences.preferences);
  for (const field of PRIVATE_CONTENT_FIELDS) next[field] = structuredClone(cloud.content[field]);
  return admitLocalState(next);
}

export function applySharedDomains(local, cloud) {
  const admittedLocal = admitLocalState(local);
  assertDomainBundle(cloud, SHARED_DOMAINS);
  if (!isDeepEqual(cloud.projectProgress, projectProgressForArtifacts(cloud.artifacts))) {
    cloudDomainError();
  }
  const next = structuredClone(admittedLocal);
  next.sharedArtifacts = structuredClone(cloud.artifacts);
  return admitLocalState(next);
}
