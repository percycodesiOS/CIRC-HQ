import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";

import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact
} from "../src/model/shared-artifact.js";

const roomSync = await import("../src/storage/room-sync.js").catch(() => ({}));

const NOW_ISO = "2026-09-01T14:00:00.000Z";
const NEXT_ISO = "2026-09-01T14:30:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const OWNER_UID = "owner-user";
const JOINING_UID = "joining-user";
const EVENT_ID = "event-h0123456789abcdef0123456789abcdef";

const TENANT_KEYS = [
  "createdAt", "name", "ownerUid", "revision", "schemaVersion", "tenantId", "updatedAt", "updatedBy"
];
const ROOM_KEYS = [
  "createdAt", "name", "revision", "roomId", "schemaVersion", "tenantId", "updatedAt", "updatedBy"
];
const MEMBERSHIP_KEYS = [
  "createdAt", "invitationRef", "revision", "role", "roomId", "schemaVersion", "tenantId", "uid", "updatedAt", "updatedBy"
];
const TEACHER_ROOT_KEYS = [
  "revision", "roomId", "schemaVersion", "tenantId", "updatedAt", "updatedBy"
];
const INVITE_KEYS = [
  "createdAt", "createdBy", "expiresAt", "revision", "roomId", "schemaVersion", "tenantId", "updatedAt", "updatedBy", "usedAt", "usedBy"
];
const ENVELOPE_KEYS = ["revision", "schemaVersion", "updatedAt", "updatedBy", "value"];
const PROGRESS_KEYS = ["contributionIndex", "projectNumber", "stageId", "status", "updatedAt"];

function requiredExport(name) {
  assert.equal(typeof roomSync[name], "function", `${name} must be exported`);
  return roomSync[name];
}

function exactKeys(value, expected) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function timestampFromMillis(milliseconds) {
  return Object.freeze({
    toDate: () => new Date(milliseconds),
    toMillis: () => milliseconds
  });
}

function timestampMillis(value) {
  assert.equal(typeof value?.toMillis, "function", "expected an injected Firebase timestamp");
  return value.toMillis();
}

function sequentialCrypto(seed = 0) {
  let cursor = seed;
  return {
    getRandomValues(buffer) {
      for (let index = 0; index < buffer.length; index += 1) {
        buffer[index] = cursor % 240;
        cursor += 1;
      }
      return buffer;
    },
    subtle: webcrypto.subtle
  };
}

function rejectionCrypto() {
  const bytes = [255, ...Array.from({ length: 40 }, (_, index) => index)];
  let cursor = 0;
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    getRandomValues(buffer) {
      calls += 1;
      for (let index = 0; index < buffer.length; index += 1) {
        buffer[index] = bytes[cursor] ?? 0;
        cursor += 1;
      }
      return buffer;
    },
    subtle: webcrypto.subtle
  };
}

function createFirebaseBackend(initial = {}) {
  const records = new Map(Object.entries(initial));
  let transactionQueue = Promise.resolve();
  const stats = {
    documentReads: [],
    transactionCalls: 0,
    transactionReads: [],
    transactionWrites: [],
    committedTransactions: 0
  };

  function view(uid, { failReadsWith = null, failTransactionsWith = null } = {}) {
    const serverTimestamp = timestampFromMillis(NOW_MS);
    return {
      currentUser: () => uid === null ? null : { uid, token: "must-not-escape" },
      nowMillis: () => NOW_MS,
      serverTimestamp: () => serverTimestamp,
      timestampFromMillis,
      async getDocument(path) {
        stats.documentReads.push(path);
        if (failReadsWith) throw failReadsWith;
        return records.get(path) ?? null;
      },
      async runTransaction(callback) {
        stats.transactionCalls += 1;
        if (failTransactionsWith) throw failTransactionsWith;
        const attempt = transactionQueue.then(async () => {
          const writes = new Map();
          const transaction = {
            async get(path) {
              stats.transactionReads.push(path);
              return records.get(path) ?? null;
            },
            set(path, value) {
              stats.transactionWrites.push({ path, value });
              writes.set(path, value);
            }
          };
          const result = await callback(transaction);
          for (const [path, value] of writes) records.set(path, value);
          if (writes.size > 0) stats.committedTransactions += 1;
          return result;
        });
        transactionQueue = attempt.catch(() => undefined);
        return attempt;
      }
    };
  }

  return { records, stats, view };
}

function artifactEnvelope(uid = OWNER_UID, revision = 1, value = null) {
  return {
    schemaVersion: 1,
    revision,
    updatedAt: timestampFromMillis(NOW_MS),
    updatedBy: uid,
    value: value ?? createTechTerrariumArtifact({
      artifactId: TECH_TERRARIUM_ARTIFACT_ID,
      nowIso: NOW_ISO
    })
  };
}

function progressFor(artifact) {
  return {
    projectNumber: artifact.projectNumber,
    stageId: artifact.stageId,
    contributionIndex: artifact.contributionIndex,
    status: artifact.status,
    updatedAt: artifact.updatedAt
  };
}

async function bootstrapRoom({ uid = OWNER_UID, crypto = sequentialCrypto() } = {}) {
  const backend = createFirebaseBackend();
  const firebase = backend.view(uid);
  const client = requiredExport("createRoomSyncClient")({ firebase, crypto });
  const result = await client.createTenantRoom({
    tenantName: "  CIRC HQ  ",
    roomName: "  Shared Makerspace  ",
    nowIso: NOW_ISO
  });
  return { backend, client, firebase, result };
}

test("invites use the exact alphabet, rejection sampling, and a 27-character canonical value", () => {
  const generateRoomInvite = requiredExport("generateRoomInvite");
  const normalizeInviteCode = requiredExport("normalizeInviteCode");
  const crypto = rejectionCrypto();
  const displayCode = generateRoomInvite({ crypto });
  const canonical = normalizeInviteCode(displayCode);

  assert.match(displayCode, /^[ABCDEFGHJKMNPQRSTVWXYZ23456789-]+$/);
  assert.match(canonical, /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{27}$/);
  assert.ok(displayCode.includes("-"), "display code should be grouped");
  assert.ok(crypto.calls >= 2, "a rejected byte must be replaced with fresh entropy");
  assert.throws(() => normalizeInviteCode(`${canonical.slice(0, -1)}I`), /room-invite-invalid/);
  assert.throws(() => normalizeInviteCode(canonical.slice(1)), /room-invite-invalid/);
});

test("invite hashing has one canonical SHA-256 path and returns lowercase hexadecimal", async () => {
  const generateRoomInvite = requiredExport("generateRoomInvite");
  const normalizeInviteCode = requiredExport("normalizeInviteCode");
  const hashInviteCode = requiredExport("hashInviteCode");
  const displayCode = generateRoomInvite({ crypto: sequentialCrypto(31) });
  const canonical = normalizeInviteCode(displayCode);
  const decorated = `  ${canonical.toLowerCase().replace(/(.{9})/g, "$1 ")}  `;

  const actual = await hashInviteCode(decorated, { crypto: webcrypto });
  const expected = createHash("sha256").update(canonical, "utf8").digest("hex");

  assert.equal(actual, expected);
  assert.match(actual, /^[0-9a-f]{64}$/);
});

test("room bootstrap atomically writes seven exact-schema documents without storing the raw invite", async () => {
  const { backend, result } = await bootstrapRoom();

  assert.equal(result.status, "created");
  assert.match(result.tenantId, /^[a-z0-9-]+$/);
  assert.match(result.roomId, /^[a-z0-9-]+$/);
  assert.equal(typeof result.inviteCode, "string");
  assert.equal(backend.stats.transactionCalls, 1);
  assert.equal(backend.stats.committedTransactions, 1);
  assert.equal(backend.records.size, 7);

  const tenantPath = `playbookTenants/${result.tenantId}`;
  const roomPath = `${tenantPath}/rooms/${result.roomId}`;
  const memberPath = `${tenantPath}/members/${OWNER_UID}`;
  const teacherPath = `playbookTeachers/${OWNER_UID}`;
  const artifactPath = `${roomPath}/artifacts/${TECH_TERRARIUM_ARTIFACT_ID}`;
  const progressPath = `${roomPath}/projectProgress/${TECH_TERRARIUM_ARTIFACT_ID}`;
  const inviteEntry = [...backend.records].find(([path]) => path.startsWith("playbookInvites/"));
  assert.ok(inviteEntry, "bootstrap must create one hashed invite document");
  const [invitePath, invite] = inviteEntry;
  assert.match(invitePath, /^playbookInvites\/[0-9a-f]{64}$/);
  assert.deepEqual(new Set(backend.records.keys()), new Set([
    tenantPath, roomPath, memberPath, teacherPath, artifactPath, progressPath, invitePath
  ]));

  const tenant = backend.records.get(tenantPath);
  exactKeys(tenant, TENANT_KEYS);
  assert.deepEqual({ ...tenant, createdAt: null, updatedAt: null }, {
    schemaVersion: 1,
    revision: 1,
    tenantId: result.tenantId,
    name: "CIRC HQ",
    ownerUid: OWNER_UID,
    createdAt: null,
    updatedAt: null,
    updatedBy: OWNER_UID
  });
  assert.equal(timestampMillis(tenant.createdAt), NOW_MS);
  assert.equal(timestampMillis(tenant.updatedAt), NOW_MS);

  const room = backend.records.get(roomPath);
  exactKeys(room, ROOM_KEYS);
  assert.deepEqual({ ...room, createdAt: null, updatedAt: null }, {
    schemaVersion: 1,
    revision: 1,
    tenantId: result.tenantId,
    roomId: result.roomId,
    name: "Shared Makerspace",
    createdAt: null,
    updatedAt: null,
    updatedBy: OWNER_UID
  });

  const membership = backend.records.get(memberPath);
  exactKeys(membership, MEMBERSHIP_KEYS);
  assert.deepEqual({ ...membership, createdAt: null, updatedAt: null }, {
    schemaVersion: 1,
    revision: 1,
    uid: OWNER_UID,
    tenantId: result.tenantId,
    roomId: result.roomId,
    role: "owner",
    createdAt: null,
    updatedAt: null,
    updatedBy: OWNER_UID,
    invitationRef: null
  });
  assert.deepEqual(result.membership, {
    uid: OWNER_UID,
    tenantId: result.tenantId,
    roomId: result.roomId,
    role: "owner",
    trusted: true
  });

  const teacherRoot = backend.records.get(teacherPath);
  exactKeys(teacherRoot, TEACHER_ROOT_KEYS);
  assert.deepEqual({ ...teacherRoot, updatedAt: null }, {
    schemaVersion: 1,
    revision: 1,
    tenantId: result.tenantId,
    roomId: result.roomId,
    updatedAt: null,
    updatedBy: OWNER_UID
  });

  exactKeys(invite, INVITE_KEYS);
  assert.equal(invite.schemaVersion, 1);
  assert.equal(invite.revision, 1);
  assert.equal(invite.tenantId, result.tenantId);
  assert.equal(invite.roomId, result.roomId);
  assert.equal(invite.createdBy, OWNER_UID);
  assert.equal(invite.updatedBy, OWNER_UID);
  assert.equal(invite.usedBy, null);
  assert.equal(invite.usedAt, null);
  assert.equal(timestampMillis(invite.createdAt), NOW_MS);
  assert.equal(timestampMillis(invite.updatedAt), NOW_MS);
  assert.equal(timestampMillis(invite.expiresAt), NOW_MS + SEVEN_DAYS_MS);

  const artifact = backend.records.get(artifactPath);
  const progress = backend.records.get(progressPath);
  exactKeys(artifact, ENVELOPE_KEYS);
  exactKeys(progress, ENVELOPE_KEYS);
  exactKeys(progress.value, PROGRESS_KEYS);
  assert.equal(artifact.revision, 1);
  assert.equal(progress.revision, 1);
  assert.deepEqual(progress.value, progressFor(artifact.value));
  assert.equal(JSON.stringify([...backend.records.values()]).includes(result.inviteCode), false);
  assert.equal(JSON.stringify([...backend.records.values()]).includes(roomSync.normalizeInviteCode(result.inviteCode)), false);
});

test("bootstrap rejects extra fields, invalid names, unauthenticated callers, and unsafe UIDs before Firebase I/O", async () => {
  const cases = [
    {
      uid: OWNER_UID,
      input: { tenantName: "Tenant", roomName: "Room", nowIso: NOW_ISO, ownerUid: "other-user" }
    },
    {
      uid: OWNER_UID,
      input: { tenantName: "Tenant\u0000", roomName: "Room", nowIso: NOW_ISO }
    },
    {
      uid: OWNER_UID,
      input: { tenantName: "Tenant", roomName: "Room", nowIso: "2026-09-01T14:00:00Z" }
    },
    {
      uid: null,
      input: { tenantName: "Tenant", roomName: "Room", nowIso: NOW_ISO }
    },
    {
      uid: "unsafe/user",
      input: { tenantName: "Tenant", roomName: "Room", nowIso: NOW_ISO }
    }
  ];

  for (const { uid, input } of cases) {
    const backend = createFirebaseBackend();
    const client = requiredExport("createRoomSyncClient")({
      firebase: backend.view(uid),
      crypto: sequentialCrypto()
    });
    const result = await client.createTenantRoom(input);
    assert.equal(result.status, "denied");
    assert.equal(backend.stats.transactionCalls, 0);
    assert.equal(backend.records.size, 0);
  }
});

test("bootstrap sources expiry time internally when Firebase has no clock helper", async () => {
  const backend = createFirebaseBackend();
  const firebase = backend.view(OWNER_UID);
  delete firebase.nowMillis;
  const client = requiredExport("createRoomSyncClient")({
    firebase,
    crypto: sequentialCrypto()
  });
  const before = Date.now();

  const result = await client.createTenantRoom({
    tenantName: "Tenant",
    roomName: "Room",
    nowIso: "2020-01-01T00:00:00.000Z"
  });

  const after = Date.now();
  assert.equal(result.status, "created");
  const invite = [...backend.records.entries()].find(([path]) => path.startsWith("playbookInvites/"))[1];
  assert.ok(timestampMillis(invite.expiresAt) >= before + SEVEN_DAYS_MS);
  assert.ok(timestampMillis(invite.expiresAt) <= after + SEVEN_DAYS_MS);
});

test("membership loading follows the teacher root, exact membership, and exact room without a scan", async () => {
  const { backend, result } = await bootstrapRoom();
  backend.stats.documentReads.length = 0;
  const client = requiredExport("createRoomSyncClient")({
    firebase: backend.view(OWNER_UID),
    crypto: sequentialCrypto()
  });

  const loaded = await client.loadRoomMembership(OWNER_UID);
  const tenantPath = `playbookTenants/${result.tenantId}`;
  assert.deepEqual(backend.stats.documentReads, [
    `playbookTeachers/${OWNER_UID}`,
    `${tenantPath}/members/${OWNER_UID}`,
    `${tenantPath}/rooms/${result.roomId}`
  ]);
  assert.deepEqual(loaded, {
    status: "member",
    membership: {
      uid: OWNER_UID,
      tenantId: result.tenantId,
      roomId: result.roomId,
      role: "owner",
      trusted: true
    },
    room: {
      tenantId: result.tenantId,
      roomId: result.roomId,
      name: "Shared Makerspace"
    }
  });
  assert.equal(Object.hasOwn(loaded.membership, "invitationRef"), false);

  backend.stats.documentReads.length = 0;
  const wrongUid = await client.loadRoomMembership(JOINING_UID);
  assert.equal(wrongUid.status, "not-member");
  assert.equal(backend.stats.documentReads.length, 0);
});

test("membership loading fails closed for malformed exact-schema documents", async () => {
  const { backend, result } = await bootstrapRoom();
  const membershipPath = `playbookTenants/${result.tenantId}/members/${OWNER_UID}`;
  const validMembership = backend.records.get(membershipPath);
  backend.records.set(membershipPath, {
    ...validMembership,
    trusted: true
  });
  const client = requiredExport("createRoomSyncClient")({
    firebase: backend.view(OWNER_UID),
    crypto: sequentialCrypto()
  });
  const loaded = await client.loadRoomMembership(OWNER_UID);
  assert.equal(loaded.status, "not-member");
  assert.equal(loaded.membership, null);

  backend.records.set(membershipPath, {
    ...validMembership,
    role: "teacher",
    invitationRef: Symbol("malformed-invite-reference")
  });
  const malformedReference = await client.loadRoomMembership(OWNER_UID);
  assert.equal(malformedReference.status, "not-member");
  assert.equal(malformedReference.membership, null);
});

test("invite redemption atomically advances revision 1 to 2 and creates only the joining membership/root", async () => {
  const { backend, result } = await bootstrapRoom();
  const invitePath = [...backend.records.keys()].find((path) => path.startsWith("playbookInvites/"));
  const beforeInvite = backend.records.get(invitePath);
  const beforePaths = new Set(backend.records.keys());
  backend.stats.transactionWrites.length = 0;
  const client = requiredExport("createRoomSyncClient")({
    firebase: backend.view(JOINING_UID),
    crypto: sequentialCrypto(80)
  });

  const redeemed = await client.redeemRoomInvite(` ${result.inviteCode.toLowerCase()} `);

  assert.equal(redeemed.status, "joined");
  assert.deepEqual(redeemed.membership, {
    uid: JOINING_UID,
    tenantId: result.tenantId,
    roomId: result.roomId,
    role: "teacher",
    trusted: true
  });
  const membershipPath = `playbookTenants/${result.tenantId}/members/${JOINING_UID}`;
  const teacherPath = `playbookTeachers/${JOINING_UID}`;
  const changedPaths = new Set(backend.stats.transactionWrites.map(({ path }) => path));
  assert.deepEqual(changedPaths, new Set([invitePath, membershipPath, teacherPath]));
  assert.deepEqual(new Set([...backend.records.keys()].filter((path) => !beforePaths.has(path))), new Set([
    membershipPath, teacherPath
  ]));

  const invite = backend.records.get(invitePath);
  exactKeys(invite, INVITE_KEYS);
  assert.equal(invite.revision, 2);
  assert.equal(invite.usedBy, JOINING_UID);
  assert.equal(invite.updatedBy, JOINING_UID);
  assert.equal(timestampMillis(invite.usedAt), NOW_MS);
  assert.equal(timestampMillis(invite.updatedAt), NOW_MS);
  for (const key of ["schemaVersion", "tenantId", "roomId", "createdBy", "createdAt", "expiresAt"]) {
    assert.equal(invite[key], beforeInvite[key]);
  }

  const membership = backend.records.get(membershipPath);
  exactKeys(membership, MEMBERSHIP_KEYS);
  assert.equal(membership.uid, JOINING_UID);
  assert.equal(membership.role, "teacher");
  assert.equal(membership.updatedBy, JOINING_UID);
  assert.equal(membership.invitationRef, invitePath.slice("playbookInvites/".length));
  assert.match(membership.invitationRef, /^[0-9a-f]{64}$/);
  exactKeys(backend.records.get(teacherPath), TEACHER_ROOT_KEYS);
  assert.equal(JSON.stringify([...backend.records.values()]).includes(result.inviteCode), false);
});

test("expired invites and invalid invite codes perform zero writes", async () => {
  const { backend, result } = await bootstrapRoom();
  const invitePath = [...backend.records.keys()].find((path) => path.startsWith("playbookInvites/"));
  backend.records.set(invitePath, {
    ...backend.records.get(invitePath),
    expiresAt: timestampFromMillis(NOW_MS - 1)
  });
  const client = requiredExport("createRoomSyncClient")({
    firebase: backend.view(JOINING_UID),
    crypto: sequentialCrypto()
  });
  backend.stats.transactionWrites.length = 0;

  const expired = await client.redeemRoomInvite(result.inviteCode);
  assert.equal(expired.status, "expired");
  assert.equal(backend.stats.transactionWrites.length, 0);
  const transactionsBeforeInvalid = backend.stats.transactionCalls;
  const invalid = await client.redeemRoomInvite("not-an-invite");
  assert.equal(invalid.status, "denied");
  assert.equal(backend.stats.transactionCalls, transactionsBeforeInvalid);
});

test("redemption rejects a malformed target tenant before writing membership state", async () => {
  const { backend, result } = await bootstrapRoom();
  const tenantPath = `playbookTenants/${result.tenantId}`;
  backend.records.set(tenantPath, {
    ...backend.records.get(tenantPath),
    role: "owner"
  });
  backend.stats.transactionWrites.length = 0;
  const client = requiredExport("createRoomSyncClient")({
    firebase: backend.view(JOINING_UID),
    crypto: sequentialCrypto()
  });

  const redemption = await client.redeemRoomInvite(result.inviteCode);

  assert.equal(redemption.status, "denied");
  assert.equal(backend.stats.transactionWrites.length, 0);
  assert.equal(backend.records.has(`playbookTenants/${result.tenantId}/members/${JOINING_UID}`), false);
});

test("concurrent redemption consumes an invite exactly once", async () => {
  const { backend, result } = await bootstrapRoom();
  const first = requiredExport("createRoomSyncClient")({
    firebase: backend.view(JOINING_UID),
    crypto: sequentialCrypto(100)
  });
  const secondUid = "second-joining-user";
  const second = requiredExport("createRoomSyncClient")({
    firebase: backend.view(secondUid),
    crypto: sequentialCrypto(120)
  });

  const attempts = await Promise.all([
    first.redeemRoomInvite(result.inviteCode),
    second.redeemRoomInvite(result.inviteCode)
  ]);

  assert.equal(attempts.filter(({ status }) => status === "joined").length, 1);
  assert.equal(attempts.filter(({ status }) => status === "used").length, 1);
  const membershipPaths = [...backend.records.keys()].filter((path) =>
    path.startsWith(`playbookTenants/${result.tenantId}/members/`) && !path.endsWith(`/${OWNER_UID}`)
  );
  assert.equal(membershipPaths.length, 1);
  const invite = backend.records.get([...backend.records.keys()].find((path) => path.startsWith("playbookInvites/")));
  assert.equal(invite.revision, 2);
});

test("shared-artifact handoff writes matching revisioned artifact/progress envelopes and verifies readback", async () => {
  const { backend, result } = await bootstrapRoom();
  const client = requiredExport("createRoomSyncClient")({
    firebase: backend.view(OWNER_UID),
    crypto: sequentialCrypto()
  });
  backend.stats.transactionWrites.length = 0;
  backend.stats.documentReads.length = 0;

  const saved = await client.saveSharedArtifact({
    tenantId: result.tenantId,
    roomId: result.roomId,
    expectedRevision: 1,
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NEXT_ISO
  });

  assert.equal(saved.status, "verified");
  assert.equal(saved.revision, 2);
  assert.equal(saved.value.visits.length, 1);
  assert.equal(saved.value.visits[0].eventId, EVENT_ID);
  assert.equal(saved.value.contributionIndex, 1);
  const roomPath = `playbookTenants/${result.tenantId}/rooms/${result.roomId}`;
  const artifactPath = `${roomPath}/artifacts/${TECH_TERRARIUM_ARTIFACT_ID}`;
  const progressPath = `${roomPath}/projectProgress/${TECH_TERRARIUM_ARTIFACT_ID}`;
  assert.deepEqual(new Set(backend.stats.transactionWrites.map(({ path }) => path)), new Set([
    artifactPath, progressPath
  ]));
  assert.deepEqual(backend.stats.documentReads.slice(-2), [artifactPath, progressPath]);

  const artifact = backend.records.get(artifactPath);
  const progress = backend.records.get(progressPath);
  exactKeys(artifact, ENVELOPE_KEYS);
  exactKeys(progress, ENVELOPE_KEYS);
  exactKeys(progress.value, PROGRESS_KEYS);
  assert.equal(artifact.revision, 2);
  assert.equal(progress.revision, 2);
  assert.equal(artifact.updatedBy, OWNER_UID);
  assert.equal(progress.updatedBy, OWNER_UID);
  assert.deepEqual(progress.value, progressFor(artifact.value));
});

test("artifact conflicts and membership rejection perform zero writes and return only admitted safe data", async () => {
  const { backend, result } = await bootstrapRoom();
  const ownerClient = requiredExport("createRoomSyncClient")({
    firebase: backend.view(OWNER_UID),
    crypto: sequentialCrypto()
  });
  backend.stats.transactionWrites.length = 0;
  const conflict = await ownerClient.saveSharedArtifact({
    tenantId: result.tenantId,
    roomId: result.roomId,
    expectedRevision: 7,
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NEXT_ISO
  });
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.revision, 1);
  assert.equal(conflict.value.artifactId, TECH_TERRARIUM_ARTIFACT_ID);
  assert.equal(backend.stats.transactionWrites.length, 0);
  assert.doesNotMatch(JSON.stringify(conflict), /token|provider|firebase/i);

  const outsider = requiredExport("createRoomSyncClient")({
    firebase: backend.view(JOINING_UID),
    crypto: sequentialCrypto()
  });
  const beforeOutsider = backend.stats.transactionCalls;
  const denied = await outsider.saveSharedArtifact({
    tenantId: result.tenantId,
    roomId: result.roomId,
    expectedRevision: 1,
    handoff: "ready",
    eventId: EVENT_ID,
    visitDate: "2026-09-01",
    nowIso: NEXT_ISO
  });
  assert.equal(denied.status, "not-member");
  assert.equal(backend.stats.transactionCalls, beforeOutsider);
});

test("unsafe identifiers and Firebase errors are normalized without leaking sensitive details", async () => {
  const backend = createFirebaseBackend();
  const invalidUidClient = requiredExport("createRoomSyncClient")({
    firebase: backend.view("../owner"),
    crypto: sequentialCrypto()
  });
  const invalidUid = await invalidUidClient.loadRoomMembership("../owner");
  assert.equal(invalidUid.status, "not-member");
  assert.equal(backend.stats.documentReads.length, 0);

  const secretMessage = "raw-secret-token";
  const offlineClient = requiredExport("createRoomSyncClient")({
    firebase: backend.view(OWNER_UID, {
      failReadsWith: Object.assign(new Error(secretMessage), { code: "unavailable" })
    }),
    crypto: sequentialCrypto()
  });
  const offline = await offlineClient.loadRoomMembership(OWNER_UID);
  assert.deepEqual(offline, { status: "offline", membership: null, room: null });
  assert.equal(JSON.stringify(offline).includes(secretMessage), false);

  const deniedClient = requiredExport("createRoomSyncClient")({
    firebase: backend.view(OWNER_UID, {
      failTransactionsWith: Object.assign(new Error(secretMessage), { code: "permission-denied" })
    }),
    crypto: sequentialCrypto()
  });
  const denied = await deniedClient.createTenantRoom({
    tenantName: "Tenant",
    roomName: "Room",
    nowIso: NOW_ISO
  });
  assert.equal(denied.status, "denied");
  assert.equal(JSON.stringify(denied).includes(secretMessage), false);
});
