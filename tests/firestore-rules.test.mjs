import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { readFile } from "node:fs/promises";

import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact,
  recordArtifactHandoff
} from "../src/model/shared-artifact.js";

const PROJECT_ID = "demo-circ-hq-rules";
const RULES_PATH = new URL("../firestore.rules", import.meta.url);
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const enabled = typeof EMULATOR_HOST === "string" && EMULATOR_HOST !== "";

const KENNY = "kenny";
const TAMMY = "tammy";
const UNRELATED = "unrelated";
const TENANT_ID = "tenant-circ-hq";
const BOOTSTRAP_INVITE_HASH = "a".repeat(64);
const ROOM_ID = BOOTSTRAP_INVITE_HASH;
const SECOND_INVITE_HASH = "b".repeat(64);
const THIRD_INVITE_HASH = "c".repeat(64);
const ARTIFACT_ID = TECH_TERRARIUM_ARTIFACT_ID;
const NOW_ISO = "2026-09-01T13:00:00.000Z";
const NEXT_ISO = "2026-09-01T14:00:00.000Z";
const EVENT_ID = `event-h${"1".repeat(32)}`;
const DAY_MS = 24 * 60 * 60 * 1000;

function pathFor(kind, uid = KENNY) {
  const room = `playbookTenants/${TENANT_ID}/rooms/${ROOM_ID}`;
  const paths = {
    tenant: `playbookTenants/${TENANT_ID}`,
    room,
    member: `playbookTenants/${TENANT_ID}/members/${uid}`,
    teacher: `playbookTeachers/${uid}`,
    plan: `playbookTeachers/${uid}/private/plan`,
    progress: `playbookTeachers/${uid}/private/progress`,
    preferences: `playbookTeachers/${uid}/private/preferences`,
    content: `playbookTeachers/${uid}/private/content`,
    artifact: `${room}/artifacts/${ARTIFACT_ID}`,
    projectProgress: `${room}/projectProgress/${ARTIFACT_ID}`,
    bootstrapInvite: `playbookInvites/${BOOTSTRAP_INVITE_HASH}`,
    secondInvite: `playbookInvites/${SECOND_INVITE_HASH}`,
    thirdInvite: `playbookInvites/${THIRD_INVITE_HASH}`
  };
  return paths[kind];
}

function teacherRoot(uid, tenantId = TENANT_ID, roomId = ROOM_ID, revision = 1) {
  return {
    schemaVersion: 1,
    revision,
    tenantId,
    roomId,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
}

function privateDocument(domain, uid, revision = 1) {
  const base = {
    schemaVersion: 1,
    revision,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
  if (domain === "plan") return { ...base, plan: null };
  if (domain === "progress") return { ...base, teacherProgress: {} };
  if (domain === "preferences") return { ...base, preferences: {} };
  if (domain === "content") {
    return {
      ...base,
      checklist: {},
      classes: {},
      lessonGuides: {},
      specialEvents: {},
      resources: {},
      notes: {},
      tombstones: {}
    };
  }
  throw new TypeError("unknown-private-domain");
}

function tenantDocument(uid = KENNY) {
  return {
    schemaVersion: 1,
    revision: 1,
    tenantId: TENANT_ID,
    name: "CIRC HQ",
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
}

function roomDocument(uid = KENNY, roomId = ROOM_ID) {
  return {
    schemaVersion: 1,
    revision: 1,
    tenantId: TENANT_ID,
    roomId,
    name: "Shared Makerspace",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
}

function membershipDocument(uid, role, invitationRef, roomId = ROOM_ID) {
  return {
    schemaVersion: 1,
    revision: 1,
    uid,
    tenantId: TENANT_ID,
    roomId,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    invitationRef
  };
}

function initialArtifact() {
  return createTechTerrariumArtifact({
    artifactId: ARTIFACT_ID,
    nowIso: NOW_ISO
  });
}

function progressFor(value) {
  return {
    projectNumber: value.projectNumber,
    stageId: value.stageId,
    contributionIndex: value.contributionIndex,
    status: value.status,
    updatedAt: value.updatedAt
  };
}

function envelope(uid, value, revision = 1) {
  return {
    schemaVersion: 1,
    revision,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    value
  };
}

function inviteDocument({
  hash = BOOTSTRAP_INVITE_HASH,
  uid = KENNY,
  roomId = ROOM_ID,
  lifetimeMs = 6 * DAY_MS,
  nowMs = Date.now()
} = {}) {
  assert.match(hash, /^[0-9a-f]{64}$/);
  return {
    schemaVersion: 1,
    revision: 1,
    tenantId: TENANT_ID,
    roomId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(nowMs + lifetimeMs),
    usedBy: null,
    usedAt: null,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
}

async function commitOwnerBootstrap(database, overrides = {}, omitted = new Set()) {
  const artifact = overrides.artifactValue ?? initialArtifact();
  const batch = writeBatch(database);
  const documents = [
    ["tenant", overrides.tenant ?? tenantDocument()],
    ["room", overrides.room ?? roomDocument()],
    ["member", overrides.member ?? membershipDocument(KENNY, "owner", null)],
    ["teacher", overrides.teacher ?? teacherRoot(KENNY)],
    ["artifact", overrides.artifact ?? envelope(KENNY, artifact)],
    ["projectProgress", overrides.projectProgress ?? envelope(KENNY, progressFor(artifact))],
    ["bootstrapInvite", overrides.invite ?? inviteDocument()]
  ];
  for (const [kind, value] of documents) {
    if (!omitted.has(kind)) batch.set(doc(database, pathFor(kind)), value);
  }
  return batch.commit();
}

async function redeemInvite(database, {
  uid = TAMMY,
  inviteHash = BOOTSTRAP_INVITE_HASH,
  tenantId = TENANT_ID,
  roomId = ROOM_ID,
  invitationRef = inviteHash,
  memberUid = uid,
  rootUid = uid,
  updateExtra = null,
  omitMembership = false,
  omitRoot = false
} = {}) {
  const batch = writeBatch(database);
  if (!omitMembership) {
    batch.set(
      doc(database, `playbookTenants/${tenantId}/members/${memberUid}`),
      membershipDocument(memberUid, "teacher", invitationRef, roomId)
    );
  }
  if (!omitRoot) {
    batch.set(doc(database, `playbookTeachers/${rootUid}`), teacherRoot(rootUid, tenantId, roomId));
  }
  batch.update(doc(database, `playbookInvites/${inviteHash}`), {
    revision: 2,
    usedBy: uid,
    usedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...(updateExtra ?? {})
  });
  return batch.commit();
}

async function commitArtifactHandoff(database, uid = KENNY, changes = {}) {
  const current = initialArtifact();
  const next = recordArtifactHandoff(current, {
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NEXT_ISO
  });
  const artifactValue = changes.artifactValue ?? next;
  const progressValue = changes.progressValue ?? progressFor(artifactValue);
  const revision = changes.revision ?? 2;
  const batch = writeBatch(database);
  if (!changes.omitArtifact) {
    batch.set(doc(database, pathFor("artifact")), {
      ...envelope(uid, artifactValue, revision),
      ...(changes.artifactEnvelope ?? {})
    });
  }
  if (!changes.omitProgress) {
    batch.set(doc(database, pathFor("projectProgress")), {
      ...envelope(uid, progressValue, revision),
      ...(changes.progressEnvelope ?? {})
    });
  }
  return batch.commit();
}

async function commitArtifactValues(database, uid, artifactValue, revision, changes = {}) {
  const batch = writeBatch(database);
  batch.set(doc(database, pathFor("artifact")), {
    ...envelope(uid, artifactValue, revision),
    ...(changes.artifactEnvelope ?? {})
  });
  batch.set(doc(database, pathFor("projectProgress")), {
    ...envelope(uid, changes.progressValue ?? progressFor(artifactValue), revision),
    ...(changes.progressEnvelope ?? {})
  });
  return batch.commit();
}

async function seedPrivate(environment) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, pathFor("teacher", KENNY)), teacherRoot(KENNY));
    await setDoc(doc(database, pathFor("teacher", TAMMY)), teacherRoot(TAMMY));
    for (const uid of [KENNY, TAMMY]) {
      for (const domain of ["plan", "progress", "preferences", "content"]) {
        await setDoc(doc(database, pathFor(domain, uid)), privateDocument(domain, uid));
      }
    }
  });
}

async function seedRoom(environment, { tammyMember = true, unusedInviteHash = null } = {}) {
  const artifact = initialArtifact();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, pathFor("tenant")), tenantDocument());
    await setDoc(doc(database, pathFor("room")), roomDocument());
    await setDoc(doc(database, pathFor("member", KENNY)), membershipDocument(KENNY, "owner", null));
    await setDoc(doc(database, pathFor("teacher", KENNY)), teacherRoot(KENNY));
    await setDoc(doc(database, pathFor("artifact")), envelope(KENNY, artifact));
    await setDoc(doc(database, pathFor("projectProgress")), envelope(KENNY, progressFor(artifact)));
    await setDoc(doc(database, pathFor("bootstrapInvite")), inviteDocument());
    if (tammyMember) {
      await setDoc(
        doc(database, pathFor("member", TAMMY)),
        membershipDocument(TAMMY, "teacher", BOOTSTRAP_INVITE_HASH)
      );
      await setDoc(doc(database, pathFor("teacher", TAMMY)), teacherRoot(TAMMY));
    }
    if (unusedInviteHash) {
      await setDoc(
        doc(database, `playbookInvites/${unusedInviteHash}`),
        inviteDocument({ hash: unusedInviteHash })
      );
    }
  });
}

test("Firestore emulator rule matrix is intentionally skipped without its local host", { skip: !enabled }, async (suite) => {
  const [host, port] = EMULATOR_HOST.split(":");
  const rules = await readFile(RULES_PATH, "utf8");
  const environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(port), rules }
  });
  suite.after(async () => environment.cleanup());

  const kenny = environment.authenticatedContext(KENNY).firestore();
  const tammy = environment.authenticatedContext(TAMMY).firestore();
  const unrelated = environment.authenticatedContext(UNRELATED).firestore();
  const anonymous = environment.unauthenticatedContext().firestore();

  async function matrix(name, body) {
    await suite.test(name, async () => {
      await environment.clearFirestore();
      await body();
    });
  }

  await matrix("four personas enforce private teacher read isolation", async () => {
    await seedPrivate(environment);
    await assertSucceeds(getDoc(doc(kenny, pathFor("teacher", KENNY))));
    await assertSucceeds(getDoc(doc(tammy, pathFor("plan", TAMMY))));
    await assertFails(getDoc(doc(kenny, pathFor("plan", TAMMY))));
    await assertFails(getDoc(doc(tammy, pathFor("teacher", KENNY))));
    await assertFails(getDoc(doc(unrelated, pathFor("plan", KENNY))));
    await assertFails(getDoc(doc(anonymous, pathFor("teacher", TAMMY))));
  });

  await matrix("Kenny and Tammy can create and advance only their admitted private domains", async () => {
    await assertSucceeds(setDoc(doc(kenny, pathFor("plan", KENNY)), privateDocument("plan", KENNY)));
    await assertSucceeds(setDoc(doc(tammy, pathFor("preferences", TAMMY)), privateDocument("preferences", TAMMY)));
    await assertSucceeds(setDoc(doc(kenny, pathFor("content", KENNY)), privateDocument("content", KENNY)));
    await assertSucceeds(updateDoc(doc(kenny, pathFor("plan", KENNY)), privateDocument("plan", KENNY, 2)));
    await assertFails(setDoc(doc(kenny, pathFor("plan", TAMMY)), privateDocument("plan", KENNY)));
  });

  await matrix("private writes reject unknown domains, extra or sensitive keys, and wrong identity", async () => {
    await assertFails(setDoc(doc(kenny, "playbookTeachers/kenny/private/unknown"), privateDocument("plan", KENNY)));
    for (const forbidden of ["experienceRunners", "sharedArtifacts", "credential", "auth", "studentSubmissions"]) {
      await assertFails(setDoc(doc(kenny, pathFor("plan", KENNY)), {
        ...privateDocument("plan", KENNY),
        [forbidden]: {}
      }));
    }
    await assertFails(setDoc(doc(kenny, pathFor("plan", KENNY)), privateDocument("plan", TAMMY)));
    await assertFails(setDoc(doc(unrelated, pathFor("plan", KENNY)), privateDocument("plan", UNRELATED)));
  });

  await matrix("private writes reject client timestamps, invalid revisions, unknown keys, and deletes", async () => {
    await setDoc(doc(kenny, pathFor("progress", KENNY)), privateDocument("progress", KENNY));
    await assertFails(setDoc(doc(kenny, pathFor("preferences", KENNY)), {
      ...privateDocument("preferences", KENNY),
      updatedAt: Timestamp.fromMillis(1)
    }));
    await assertFails(updateDoc(doc(kenny, pathFor("progress", KENNY)), privateDocument("progress", KENNY, 1)));
    await assertFails(updateDoc(doc(kenny, pathFor("progress", KENNY)), privateDocument("progress", KENNY, 3)));
    await assertFails(updateDoc(doc(kenny, pathFor("progress", KENNY)), {
      ...privateDocument("progress", KENNY, 2),
      extra: true
    }));
    await assertFails(deleteDoc(doc(kenny, pathFor("progress", KENNY))));
  });

  await matrix("owner bootstrap succeeds only as one compatible seven-document batch", async () => {
    await assertSucceeds(commitOwnerBootstrap(kenny));
    for (const kind of ["tenant", "room", "member", "teacher", "artifact", "projectProgress", "bootstrapInvite"]) {
      await assertSucceeds(getDoc(doc(kenny, pathFor(kind))));
    }
  });

  await matrix("partial owner bootstraps and orphan tenant, room, or membership creates fail", async () => {
    for (const kind of ["tenant", "room", "member", "teacher", "artifact", "projectProgress", "bootstrapInvite"]) {
      await environment.clearFirestore();
      await assertFails(commitOwnerBootstrap(kenny, {}, new Set([kind])));
    }
    await assertFails(setDoc(doc(kenny, pathFor("tenant")), tenantDocument()));
    await assertFails(setDoc(doc(kenny, pathFor("room")), roomDocument()));
    await assertFails(setDoc(doc(kenny, pathFor("member", KENNY)), membershipDocument(KENNY, "owner", null)));

    await environment.clearFirestore();
    await seedRoom(environment, { tammyMember: false });
    await assertFails(setDoc(
      doc(unrelated, pathFor("member", UNRELATED)),
      membershipDocument(UNRELATED, "owner", null)
    ));
  });

  await matrix("bootstrap rejects mismatched relationships and malformed initial artifact state", async () => {
    await assertFails(commitOwnerBootstrap(kenny, { teacher: teacherRoot(KENNY, TENANT_ID, THIRD_INVITE_HASH) }));
    const malformed = { ...initialArtifact(), status: "complete" };
    await assertFails(commitOwnerBootstrap(kenny, { artifactValue: malformed }));
    await assertFails(commitOwnerBootstrap(kenny, { invite: inviteDocument({ roomId: THIRD_INVITE_HASH }) }));
  });

  await matrix("room, artifact, and progress reads require exact room membership", async () => {
    await seedRoom(environment);
    for (const kind of ["tenant", "room", "artifact", "projectProgress"]) {
      await assertSucceeds(getDoc(doc(kenny, pathFor(kind))));
      await assertSucceeds(getDoc(doc(tammy, pathFor(kind))));
      await assertFails(getDoc(doc(unrelated, pathFor(kind))));
      await assertFails(getDoc(doc(anonymous, pathFor(kind))));
    }
    await assertSucceeds(getDoc(doc(kenny, pathFor("member", TAMMY))));
    await assertFails(getDoc(doc(tammy, pathFor("member", KENNY))));
  });

  await matrix("only an owner can create a bounded unused invitation for an existing room", async () => {
    await seedRoom(environment);
    await assertSucceeds(setDoc(doc(kenny, pathFor("secondInvite")), inviteDocument({ hash: SECOND_INVITE_HASH })));
    await assertFails(setDoc(doc(tammy, pathFor("thirdInvite")), inviteDocument({ hash: THIRD_INVITE_HASH, uid: TAMMY })));
    await assertFails(setDoc(doc(unrelated, pathFor("thirdInvite")), inviteDocument({ hash: THIRD_INVITE_HASH, uid: UNRELATED })));
  });

  await matrix("invitation creation rejects invalid paths, expired or overlong lifetimes, targets, and keys", async () => {
    await seedRoom(environment);
    await assertFails(setDoc(doc(kenny, "playbookInvites/raw-code"), inviteDocument({ hash: SECOND_INVITE_HASH })));
    await assertFails(setDoc(doc(kenny, pathFor("secondInvite")), inviteDocument({ hash: SECOND_INVITE_HASH, lifetimeMs: -DAY_MS })));
    await assertFails(setDoc(doc(kenny, pathFor("secondInvite")), inviteDocument({ hash: SECOND_INVITE_HASH, lifetimeMs: 8 * DAY_MS })));
    await assertFails(setDoc(doc(kenny, pathFor("secondInvite")), inviteDocument({ hash: SECOND_INVITE_HASH, roomId: THIRD_INVITE_HASH })));
    await assertFails(setDoc(doc(kenny, pathFor("secondInvite")), {
      ...inviteDocument({ hash: SECOND_INVITE_HASH }),
      rawCode: "DO-NOT-STORE"
    }));
  });

  await matrix("valid invitation redemption is bound to Tammy and the exact tenant and room", async () => {
    await seedRoom(environment, { tammyMember: false });
    await assertSucceeds(redeemInvite(tammy));
    await assertSucceeds(getDoc(doc(tammy, pathFor("member", TAMMY))));
    await assertSucceeds(getDoc(doc(tammy, pathFor("teacher", TAMMY))));
    const invite = await assertSucceeds(getDoc(doc(tammy, pathFor("bootstrapInvite"))));
    assert.equal(invite.data().revision, 2);
    assert.equal(invite.data().usedBy, TAMMY);
  });

  await matrix("redemption rejects missing companion writes, other UIDs, target changes, and extra update keys", async () => {
    for (const attempt of [
      { omitMembership: true },
      { omitRoot: true },
      { memberUid: UNRELATED },
      { rootUid: UNRELATED },
      { roomId: THIRD_INVITE_HASH },
      { invitationRef: SECOND_INVITE_HASH },
      { updateExtra: { debug: true } }
    ]) {
      await environment.clearFirestore();
      await seedRoom(environment, { tammyMember: false });
      await assertFails(redeemInvite(tammy, attempt));
    }
  });

  await matrix("an invitation is consumed once and cannot create a second membership", async () => {
    await seedRoom(environment, { tammyMember: false });
    await assertSucceeds(redeemInvite(tammy));
    await assertFails(redeemInvite(unrelated, { uid: UNRELATED }));
  });

  await matrix("a trusted member can commit one paired next-revision artifact handoff", async () => {
    await seedRoom(environment);
    await assertSucceeds(commitArtifactHandoff(tammy, TAMMY));
    const artifact = await assertSucceeds(getDoc(doc(tammy, pathFor("artifact"))));
    const progress = await assertSucceeds(getDoc(doc(tammy, pathFor("projectProgress"))));
    assert.equal(artifact.data().revision, 2);
    assert.deepEqual(progress.data().value, progressFor(artifact.data().value));
    assert.equal(artifact.data().value.createdAt, NOW_ISO);
    assert.equal(artifact.data().value.updatedAt, NEXT_ISO);

    const second = recordArtifactHandoff(artifact.data().value, {
      handoff: "repeat",
      eventId: `event-h${"2".repeat(32)}`,
      visitDate: "2026-09-02",
      nowIso: "2026-09-02T14:00:00.000Z"
    });
    await assertSucceeds(commitArtifactValues(tammy, TAMMY, second, 3));
    const advanced = await assertSucceeds(getDoc(doc(tammy, pathFor("artifact"))));
    assert.equal(advanced.data().revision, 3);
    assert.equal(advanced.data().value.visits.length, 2);
  });

  await matrix("paired artifact writes reject same, lower, skipped, one-sided, wrong identity, or client metadata", async () => {
    for (const changes of [
      { revision: 1 },
      { revision: 0 },
      { revision: 3 },
      { omitProgress: true },
      { omitArtifact: true },
      { artifactEnvelope: { updatedBy: UNRELATED } },
      { progressEnvelope: { updatedAt: Timestamp.fromMillis(1) } }
    ]) {
      await environment.clearFirestore();
      await seedRoom(environment);
      await assertFails(commitArtifactHandoff(tammy, TAMMY, changes));
    }
  });

  await matrix("artifact writes reject unknown fields, malformed visits, invalid completion, projection drift, and history deletion", async () => {
    const validNext = recordArtifactHandoff(initialArtifact(), {
      handoff: "ready",
      eventId: EVENT_ID,
      visitDate: "2026-09-01",
      nowIso: NEXT_ISO
    });
    const invalidCases = [
      { artifactValue: { ...validNext, extra: true } },
      { artifactValue: { ...validNext, visits: [{ ...validNext.visits[0], eventId: "bad" }] } },
      { artifactValue: { ...validNext, visits: [{ ...validNext.visits[0], extra: true }] } },
      { artifactValue: { ...validNext, status: "complete" } },
      { progressValue: { ...progressFor(validNext), contributionIndex: 2 } },
      { progressValue: { ...progressFor(validNext), extra: true } },
      { artifactEnvelope: { extra: true } },
      { progressEnvelope: { extra: true } },
      { artifactValue: { ...validNext, createdAt: "not-an-iso-date" } }
    ];
    for (const changes of invalidCases) {
      await environment.clearFirestore();
      await seedRoom(environment);
      await assertFails(commitArtifactHandoff(tammy, TAMMY, changes));
    }

    await environment.clearFirestore();
    await seedRoom(environment);
    await assertSucceeds(commitArtifactHandoff(tammy, TAMMY));
    const second = recordArtifactHandoff(validNext, {
      handoff: "repeat",
      eventId: `event-h${"2".repeat(32)}`,
      visitDate: "2026-09-02",
      nowIso: "2026-09-02T14:00:00.000Z"
    });
    await assertFails(commitArtifactHandoff(tammy, TAMMY, {
      revision: 3,
      artifactValue: { ...second, visits: [second.visits[1]] },
      progressValue: progressFor(second)
    }));
  });

  await matrix("artifact history rejects a reused event and visit-date identity even when the visit map differs", async () => {
    await seedRoom(environment);
    const first = recordArtifactHandoff(initialArtifact(), {
      handoff: "ready",
      eventId: EVENT_ID,
      visitDate: "2026-09-01",
      nowIso: NEXT_ISO
    });
    await assertSucceeds(commitArtifactValues(tammy, TAMMY, first, 2));
    const later = "2026-09-01T15:00:00.000Z";
    const duplicateIdentity = {
      ...first,
      updatedAt: later,
      visits: [...first.visits, {
        eventId: EVENT_ID,
        visitDate: "2026-09-01",
        handoff: "repeat",
        stageId: first.stageId,
        contributionIndex: first.contributionIndex,
        recordedAt: later
      }],
      visitIdentities: [...first.visitIdentities, `${EVENT_ID}|2026-09-01`]
    };
    await assertFails(commitArtifactValues(tammy, TAMMY, duplicateIdentity, 3));
  });

  await matrix("artifact rules reject impossible local dates and impossible ISO timestamps", async () => {
    const invalidCases = [
      { visitDate: "2026-02-31", nowIso: "2026-09-01T14:00:00.000Z" },
      { visitDate: "2026-02-29", nowIso: "2026-09-01T14:00:00.000Z" },
      { visitDate: "2026-09-01", nowIso: "2026-02-31T14:00:00.000Z" }
    ];
    for (const { visitDate, nowIso } of invalidCases) {
      await environment.clearFirestore();
      await seedRoom(environment);
      const value = recordArtifactHandoff(initialArtifact(), {
        handoff: "ready",
        eventId: EVENT_ID,
        visitDate: "2026-09-01",
        nowIso: NEXT_ISO
      });
      value.updatedAt = nowIso;
      value.visits[0] = { ...value.visits[0], visitDate, recordedAt: nowIso };
      value.visitIdentities[0] = `${EVENT_ID}|${visitDate}`;
      await assertFails(commitArtifactValues(tammy, TAMMY, value, 2));
    }
  });

  await matrix("artifact rules accept leap day and supported-range calendar boundaries", async () => {
    for (const { createdAt, visitDate, updatedAt } of [
      {
        createdAt: "2020-01-01T00:00:00.000Z",
        visitDate: "2028-02-29",
        updatedAt: "2028-02-29T23:59:59.999Z"
      },
      {
        createdAt: "2099-12-31T00:00:00.000Z",
        visitDate: "2099-12-31",
        updatedAt: "2099-12-31T23:59:59.999Z"
      }
    ]) {
      await environment.clearFirestore();
      const base = createTechTerrariumArtifact({ artifactId: ARTIFACT_ID, nowIso: createdAt });
      await assertSucceeds(commitOwnerBootstrap(kenny, { artifactValue: base }));
      const next = recordArtifactHandoff(base, {
        handoff: "repeat",
        eventId: EVENT_ID,
        visitDate,
        nowIso: updatedAt
      });
      await assertSucceeds(commitArtifactValues(kenny, KENNY, next, 2));
    }
  });

  await matrix("unknown artifact IDs and malformed initial values are denied", async () => {
    await seedRoom(environment);
    await assertFails(setDoc(doc(kenny, `playbookTenants/${TENANT_ID}/rooms/${ROOM_ID}/artifacts/other-project`), envelope(KENNY, initialArtifact())));
    await assertFails(setDoc(doc(kenny, `playbookTenants/${TENANT_ID}/rooms/${ROOM_ID}/projectProgress/other-project`), envelope(KENNY, progressFor(initialArtifact()))));
  });

  await matrix("deletes fail for every protected document class", async () => {
    await seedPrivate(environment);
    await seedRoom(environment);
    for (const kind of ["plan", "teacher", "tenant", "member", "room", "artifact", "projectProgress", "bootstrapInvite"]) {
      await assertFails(deleteDoc(doc(kenny, pathFor(kind, KENNY))));
    }
  });
});
