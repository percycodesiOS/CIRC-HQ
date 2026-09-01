import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact,
  recordArtifactHandoff,
  validateSharedArtifact
} from "../model/shared-artifact.js";
import {
  hasExactKeys,
  isCanonicalIso,
  isEventId,
  isLocalDate
} from "../model/schema-admission.js";
import { safeCloudFailureStatus } from "./cloud-sync.js";

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const INVITE_LENGTH = 27;
const INVITE_GROUP_LENGTH = 9;
const INVITE_DISPLAY_PATTERN = new RegExp(
  `^[${INVITE_ALPHABET}]{${INVITE_GROUP_LENGTH}}(?:-[${INVITE_ALPHABET}]{${INVITE_GROUP_LENGTH}}){2}$`
);
const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_HASH_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_SEGMENT_PATTERN = /^[^/\\\u0000-\u001f\u007f]+$/;
const HANDOFFS = new Set(["ready", "repeat", "park"]);

const CREATE_KEYS = ["tenantName", "roomName", "initialArtifact", "nowIso"];
const CREATE_REQUIRED_KEYS = ["tenantName", "roomName", "nowIso"];
const SAVE_KEYS = [
  "tenantId", "roomId", "expectedRevision", "handoff", "eventId", "visitDate", "nowIso"
];
const TENANT_KEYS = [
  "schemaVersion", "revision", "tenantId", "name", "ownerUid", "createdAt", "updatedAt", "updatedBy"
];
const ROOM_KEYS = [
  "schemaVersion", "revision", "tenantId", "roomId", "name", "createdAt", "updatedAt", "updatedBy"
];
const MEMBERSHIP_KEYS = [
  "schemaVersion", "revision", "uid", "tenantId", "roomId", "role", "createdAt", "updatedAt", "updatedBy", "invitationRef"
];
const TEACHER_ROOT_KEYS = [
  "schemaVersion", "revision", "tenantId", "roomId", "updatedAt", "updatedBy"
];
const INVITE_KEYS = [
  "schemaVersion", "revision", "tenantId", "roomId", "createdBy", "createdAt", "expiresAt", "usedBy", "usedAt", "updatedAt", "updatedBy"
];
const ENVELOPE_KEYS = ["schemaVersion", "revision", "updatedAt", "updatedBy", "value"];
const PROGRESS_KEYS = ["projectNumber", "stageId", "contributionIndex", "status", "updatedAt"];

function isSafeSegment(value) {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 256 &&
    value === value.trim() &&
    SAFE_SEGMENT_PATTERN.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("..");
}

function isDisplayName(value) {
  return typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function timestampMillis(value) {
  try {
    if (typeof value?.toMillis === "function") {
      const milliseconds = value.toMillis();
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }
    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
    }
  } catch {
    return null;
  }
  return null;
}

function currentUid(firebase) {
  try {
    const uid = firebase?.currentUser?.()?.uid;
    return isSafeSegment(uid) ? uid : null;
  } catch {
    return null;
  }
}

function firebaseNowMillis(firebase) {
  try {
    const milliseconds = typeof firebase?.nowMillis === "function"
      ? firebase.nowMillis()
      : Date.now();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  } catch {
    return null;
  }
}

function randomPathId(prefix, crypto) {
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    throw new TypeError("room-crypto-unavailable");
  }
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const encoded = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${encoded}`;
}

function tenantPath(tenantId) {
  return `playbookTenants/${tenantId}`;
}

function roomPath(tenantId, roomId) {
  return `${tenantPath(tenantId)}/rooms/${roomId}`;
}

function membershipPath(tenantId, uid) {
  return `${tenantPath(tenantId)}/members/${uid}`;
}

function teacherPath(uid) {
  return `playbookTeachers/${uid}`;
}

function invitePath(inviteHash) {
  return `playbookInvites/${inviteHash}`;
}

function artifactPath(tenantId, roomId) {
  return `${roomPath(tenantId, roomId)}/artifacts/${TECH_TERRARIUM_ARTIFACT_ID}`;
}

function progressPath(tenantId, roomId) {
  return `${roomPath(tenantId, roomId)}/projectProgress/${TECH_TERRARIUM_ARTIFACT_ID}`;
}

function admittedTenant(candidate, expectedTenantId = null) {
  if (
    !hasExactKeys(candidate, TENANT_KEYS) ||
    candidate.schemaVersion !== 1 ||
    candidate.revision !== 1 ||
    !isSafeSegment(candidate.tenantId) ||
    (expectedTenantId !== null && candidate.tenantId !== expectedTenantId) ||
    !isDisplayName(candidate.name) ||
    !isSafeSegment(candidate.ownerUid) ||
    candidate.updatedBy !== candidate.ownerUid ||
    timestampMillis(candidate.createdAt) === null ||
    timestampMillis(candidate.updatedAt) === null
  ) return null;
  return candidate;
}

function admittedRoom(candidate, expectedTenantId, expectedRoomId) {
  if (
    !hasExactKeys(candidate, ROOM_KEYS) ||
    candidate.schemaVersion !== 1 ||
    !Number.isSafeInteger(candidate.revision) ||
    candidate.revision < 1 ||
    candidate.tenantId !== expectedTenantId ||
    candidate.roomId !== expectedRoomId ||
    !isSafeSegment(candidate.tenantId) ||
    !isSafeSegment(candidate.roomId) ||
    !isDisplayName(candidate.name) ||
    !isSafeSegment(candidate.updatedBy) ||
    timestampMillis(candidate.createdAt) === null ||
    timestampMillis(candidate.updatedAt) === null
  ) return null;
  return candidate;
}

function admittedTeacherRoot(candidate, expectedUid) {
  if (
    !hasExactKeys(candidate, TEACHER_ROOT_KEYS) ||
    candidate.schemaVersion !== 1 ||
    candidate.revision !== 1 ||
    !isSafeSegment(candidate.tenantId) ||
    !isSafeSegment(candidate.roomId) ||
    candidate.updatedBy !== expectedUid ||
    timestampMillis(candidate.updatedAt) === null
  ) return null;
  return candidate;
}

function admittedMembership(candidate, { uid, tenantId = null, roomId = null }) {
  if (
    !hasExactKeys(candidate, MEMBERSHIP_KEYS) ||
    candidate.schemaVersion !== 1 ||
    candidate.revision !== 1 ||
    candidate.uid !== uid ||
    !isSafeSegment(candidate.uid) ||
    !isSafeSegment(candidate.tenantId) ||
    !isSafeSegment(candidate.roomId) ||
    (tenantId !== null && candidate.tenantId !== tenantId) ||
    (roomId !== null && candidate.roomId !== roomId) ||
    !["owner", "teacher"].includes(candidate.role) ||
    candidate.updatedBy !== uid ||
    timestampMillis(candidate.createdAt) === null ||
    timestampMillis(candidate.updatedAt) === null ||
    !(
      (candidate.role === "owner" && candidate.invitationRef === null) ||
      (candidate.role === "teacher" &&
        typeof candidate.invitationRef === "string" &&
        INVITE_HASH_PATTERN.test(candidate.invitationRef))
    )
  ) return null;
  return candidate;
}

function membershipView(membership) {
  return {
    uid: membership.uid,
    tenantId: membership.tenantId,
    roomId: membership.roomId,
    role: membership.role,
    trusted: true
  };
}

function admittedInvite(candidate) {
  const createdAt = timestampMillis(candidate?.createdAt);
  const expiresAt = timestampMillis(candidate?.expiresAt);
  if (
    !hasExactKeys(candidate, INVITE_KEYS) ||
    candidate.schemaVersion !== 1 ||
    ![1, 2].includes(candidate.revision) ||
    !isSafeSegment(candidate.tenantId) ||
    !isSafeSegment(candidate.roomId) ||
    !isSafeSegment(candidate.createdBy) ||
    !isSafeSegment(candidate.updatedBy) ||
    createdAt === null ||
    expiresAt === null ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > INVITE_LIFETIME_MS ||
    timestampMillis(candidate.updatedAt) === null
  ) return null;
  if (candidate.revision === 1) {
    if (
      candidate.usedBy !== null ||
      candidate.usedAt !== null ||
      candidate.updatedBy !== candidate.createdBy
    ) return null;
  } else if (
    !isSafeSegment(candidate.usedBy) ||
    timestampMillis(candidate.usedAt) === null ||
    candidate.updatedBy !== candidate.usedBy
  ) return null;
  return candidate;
}

function admittedEnvelope(candidate) {
  if (
    !hasExactKeys(candidate, ENVELOPE_KEYS) ||
    candidate.schemaVersion !== 1 ||
    !Number.isSafeInteger(candidate.revision) ||
    candidate.revision < 1 ||
    !isSafeSegment(candidate.updatedBy) ||
    timestampMillis(candidate.updatedAt) === null
  ) return null;
  const value = validateSharedArtifact(candidate.value);
  if (!value) return null;
  return { revision: candidate.revision, value, updatedBy: candidate.updatedBy };
}

function projectProgressFor(artifact) {
  return {
    projectNumber: artifact.projectNumber,
    stageId: artifact.stageId,
    contributionIndex: artifact.contributionIndex,
    status: artifact.status,
    updatedAt: artifact.updatedAt
  };
}

function admittedProgressEnvelope(candidate) {
  if (
    !hasExactKeys(candidate, ENVELOPE_KEYS) ||
    candidate.schemaVersion !== 1 ||
    !Number.isSafeInteger(candidate.revision) ||
    candidate.revision < 1 ||
    !isSafeSegment(candidate.updatedBy) ||
    timestampMillis(candidate.updatedAt) === null ||
    !hasExactKeys(candidate.value, PROGRESS_KEYS) ||
    candidate.value.projectNumber !== 2 ||
    !isSafeSegment(candidate.value.stageId) ||
    !Number.isInteger(candidate.value.contributionIndex) ||
    candidate.value.contributionIndex < 0 ||
    !["active", "parked", "complete"].includes(candidate.value.status) ||
    !isCanonicalIso(candidate.value.updatedAt)
  ) return null;
  return {
    revision: candidate.revision,
    updatedBy: candidate.updatedBy,
    value: { ...candidate.value }
  };
}

function progressMatchesArtifact(progress, artifact) {
  const expected = projectProgressFor(artifact);
  return PROGRESS_KEYS.every((key) => progress[key] === expected[key]);
}

function validCreateInput(input) {
  if (!hasExactKeys(input, CREATE_KEYS, CREATE_REQUIRED_KEYS)) return null;
  const tenantName = typeof input.tenantName === "string" ? input.tenantName.trim() : "";
  const roomName = typeof input.roomName === "string" ? input.roomName.trim() : "";
  if (!isDisplayName(tenantName) || !isDisplayName(roomName) || !isCanonicalIso(input.nowIso)) {
    return null;
  }
  let initialArtifact = null;
  if (input.initialArtifact !== undefined) {
    initialArtifact = validateSharedArtifact(input.initialArtifact);
    if (!initialArtifact) return null;
  }
  return { tenantName, roomName, initialArtifact, nowIso: input.nowIso };
}

function validSaveInput(input) {
  return hasExactKeys(input, SAVE_KEYS) &&
    isSafeSegment(input.tenantId) &&
    isSafeSegment(input.roomId) &&
    Number.isSafeInteger(input.expectedRevision) &&
    input.expectedRevision >= 1 &&
    HANDOFFS.has(input.handoff) &&
    isEventId(input.eventId) &&
    isLocalDate(input.visitDate) &&
    isCanonicalIso(input.nowIso);
}

function memberUnavailable(status) {
  return { status, membership: null, room: null };
}

function artifactUnavailable(status) {
  return { status, revision: null, value: null, projectProgress: null };
}

export function generateRoomInvite({ crypto } = {}) {
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    throw new TypeError("room-invite-crypto-unavailable");
  }
  const rejectionLimit = Math.floor(256 / INVITE_ALPHABET.length) * INVITE_ALPHABET.length;
  let canonical = "";
  while (canonical.length < INVITE_LENGTH) {
    const bytes = new Uint8Array(INVITE_LENGTH - canonical.length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= rejectionLimit) continue;
      canonical += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
      if (canonical.length === INVITE_LENGTH) break;
    }
  }
  return canonical.match(new RegExp(`.{1,${INVITE_GROUP_LENGTH}}`, "g")).join("-");
}

export function isRoomInviteDisplayCode(code) {
  return typeof code === "string" && INVITE_DISPLAY_PATTERN.test(code);
}

export function normalizeInviteCode(code) {
  if (typeof code !== "string") throw new TypeError("room-invite-invalid");
  const canonical = code.trim().replace(/[ -]/g, "").toUpperCase();
  const pattern = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_LENGTH}}$`);
  if (!pattern.test(canonical)) throw new TypeError("room-invite-invalid");
  return canonical;
}

export async function hashInviteCode(code, { crypto } = {}) {
  const canonical = normalizeInviteCode(code);
  if (!crypto?.subtle || typeof crypto.subtle.digest !== "function") {
    throw new TypeError("room-invite-crypto-unavailable");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createRoomSyncClient({ firebase, crypto } = {}) {
  async function createTenantRoom(input) {
    const uid = currentUid(firebase);
    const admittedInput = validCreateInput(input);
    const nowMilliseconds = firebaseNowMillis(firebase);
    if (!uid || !admittedInput || nowMilliseconds === null) return { status: "denied" };

    let tenantId;
    let roomId;
    let rawInvite;
    let inviteHash;
    let artifact;
    try {
      tenantId = randomPathId("tenant", crypto);
      rawInvite = generateRoomInvite({ crypto });
      inviteHash = await hashInviteCode(rawInvite, { crypto });
      roomId = inviteHash;
      if (!isSafeSegment(tenantId) || !isSafeSegment(roomId) || !INVITE_HASH_PATTERN.test(inviteHash)) {
        return { status: "denied" };
      }
      artifact = admittedInput.initialArtifact ?? createTechTerrariumArtifact({
        artifactId: TECH_TERRARIUM_ARTIFACT_ID,
        nowIso: admittedInput.nowIso
      });
    } catch {
      return { status: "denied" };
    }

    const tenantDocumentPath = tenantPath(tenantId);
    const roomDocumentPath = roomPath(tenantId, roomId);
    const ownerMembershipPath = membershipPath(tenantId, uid);
    const ownerTeacherPath = teacherPath(uid);
    const initialArtifactPath = artifactPath(tenantId, roomId);
    const initialProgressPath = progressPath(tenantId, roomId);
    const invitationPath = invitePath(inviteHash);
    try {
      const outcome = await firebase.runTransaction(async (transaction) => {
        for (const path of [
          tenantDocumentPath,
          roomDocumentPath,
          ownerMembershipPath,
          ownerTeacherPath,
          invitationPath
        ]) {
          if (await transaction.get(path) !== null) return { status: "conflict" };
        }
        const createdAt = firebase.serverTimestamp();
        const updatedAt = firebase.serverTimestamp();
        transaction.set(tenantDocumentPath, {
          schemaVersion: 1,
          revision: 1,
          tenantId,
          name: admittedInput.tenantName,
          ownerUid: uid,
          createdAt,
          updatedAt,
          updatedBy: uid
        });
        transaction.set(roomDocumentPath, {
          schemaVersion: 1,
          revision: 1,
          tenantId,
          roomId,
          name: admittedInput.roomName,
          createdAt: firebase.serverTimestamp(),
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid
        });
        transaction.set(ownerMembershipPath, {
          schemaVersion: 1,
          revision: 1,
          uid,
          tenantId,
          roomId,
          role: "owner",
          createdAt: firebase.serverTimestamp(),
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          invitationRef: null
        });
        transaction.set(ownerTeacherPath, {
          schemaVersion: 1,
          revision: 1,
          tenantId,
          roomId,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid
        });
        transaction.set(initialArtifactPath, {
          schemaVersion: 1,
          revision: 1,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          value: artifact
        });
        transaction.set(initialProgressPath, {
          schemaVersion: 1,
          revision: 1,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          value: projectProgressFor(artifact)
        });
        transaction.set(invitationPath, {
          schemaVersion: 1,
          revision: 1,
          tenantId,
          roomId,
          createdBy: uid,
          createdAt: firebase.serverTimestamp(),
          expiresAt: firebase.timestampFromMillis(nowMilliseconds + INVITE_LIFETIME_MS),
          usedBy: null,
          usedAt: null,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid
        });
        return { status: "created" };
      });
      if (outcome?.status !== "created") return { status: "conflict" };
      return {
        status: "created",
        tenantId,
        roomId,
        membership: membershipView({ uid, tenantId, roomId, role: "owner" }),
        inviteCode: rawInvite,
        revision: 1,
        artifact: structuredClone(artifact),
        projectProgress: projectProgressFor(artifact)
      };
    } catch (error) {
      return { status: safeCloudFailureStatus(error) };
    }
  }

  async function loadRoomMembership(uid) {
    const authenticatedUid = currentUid(firebase);
    if (!authenticatedUid || uid !== authenticatedUid || !isSafeSegment(uid)) {
      return memberUnavailable("not-member");
    }
    try {
      const teacherRoot = admittedTeacherRoot(await firebase.getDocument(teacherPath(uid)), uid);
      if (!teacherRoot) return memberUnavailable("not-member");
      const membership = admittedMembership(
        await firebase.getDocument(membershipPath(teacherRoot.tenantId, uid)),
        { uid, tenantId: teacherRoot.tenantId, roomId: teacherRoot.roomId }
      );
      if (!membership) return memberUnavailable("not-member");
      const room = admittedRoom(
        await firebase.getDocument(roomPath(teacherRoot.tenantId, teacherRoot.roomId)),
        teacherRoot.tenantId,
        teacherRoot.roomId
      );
      if (!room) return memberUnavailable("not-member");
      return {
        status: "member",
        membership: membershipView(membership),
        room: { tenantId: room.tenantId, roomId: room.roomId, name: room.name }
      };
    } catch (error) {
      return memberUnavailable(safeCloudFailureStatus(error));
    }
  }

  async function redeemRoomInvite(code) {
    const uid = currentUid(firebase);
    const nowMilliseconds = firebaseNowMillis(firebase);
    if (!uid || nowMilliseconds === null) return { status: "denied", membership: null };
    let canonical;
    let invitationHash;
    try {
      canonical = normalizeInviteCode(code);
      invitationHash = await hashInviteCode(canonical, { crypto });
    } catch {
      return { status: "denied", membership: null };
    }
    if (!INVITE_HASH_PATTERN.test(invitationHash)) return { status: "denied", membership: null };
    const invitationPath = invitePath(invitationHash);
    try {
      const result = await firebase.runTransaction(async (transaction) => {
        const invite = admittedInvite(await transaction.get(invitationPath));
        if (!invite) return { status: "not-found" };
        if (invite.revision === 2) return { status: "used" };
        if (timestampMillis(invite.expiresAt) <= nowMilliseconds) return { status: "expired" };
        const tenant = admittedTenant(
          await transaction.get(tenantPath(invite.tenantId)),
          invite.tenantId
        );
        if (!tenant || tenant.ownerUid !== invite.createdBy) return { status: "denied" };
        const targetRoomPath = roomPath(invite.tenantId, invite.roomId);
        const room = admittedRoom(
          await transaction.get(targetRoomPath),
          invite.tenantId,
          invite.roomId
        );
        if (!room) return { status: "denied" };
        const joiningMembershipPath = membershipPath(invite.tenantId, uid);
        const joiningTeacherPath = teacherPath(uid);
        if (
          await transaction.get(joiningMembershipPath) !== null ||
          await transaction.get(joiningTeacherPath) !== null
        ) return { status: "denied" };

        transaction.set(invitationPath, {
          schemaVersion: invite.schemaVersion,
          revision: 2,
          tenantId: invite.tenantId,
          roomId: invite.roomId,
          createdBy: invite.createdBy,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          usedBy: uid,
          usedAt: firebase.serverTimestamp(),
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid
        });
        transaction.set(joiningMembershipPath, {
          schemaVersion: 1,
          revision: 1,
          uid,
          tenantId: invite.tenantId,
          roomId: invite.roomId,
          role: "teacher",
          createdAt: firebase.serverTimestamp(),
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          invitationRef: invitationHash
        });
        transaction.set(joiningTeacherPath, {
          schemaVersion: 1,
          revision: 1,
          tenantId: invite.tenantId,
          roomId: invite.roomId,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid
        });
        return {
          status: "joined",
          membership: membershipView({
            uid,
            tenantId: invite.tenantId,
            roomId: invite.roomId,
            role: "teacher"
          })
        };
      });
      if (!["joined", "not-found", "used", "expired", "denied"].includes(result?.status)) {
        return { status: "denied", membership: null };
      }
      return result.status === "joined" ? result : { status: result.status, membership: null };
    } catch (error) {
      return { status: safeCloudFailureStatus(error), membership: null };
    }
  }

  async function loadSharedArtifact(input) {
    const uid = currentUid(firebase);
    if (
      !uid ||
      !hasExactKeys(input, ["tenantId", "roomId"]) ||
      !isSafeSegment(input.tenantId) ||
      !isSafeSegment(input.roomId)
    ) return artifactUnavailable("not-member");
    const membershipResult = await loadRoomMembership(uid);
    if (
      membershipResult.status !== "member" ||
      membershipResult.membership.tenantId !== input.tenantId ||
      membershipResult.membership.roomId !== input.roomId
    ) return artifactUnavailable(
      ["offline", "denied"].includes(membershipResult.status)
        ? membershipResult.status
        : "not-member"
    );
    try {
      const artifact = admittedEnvelope(await firebase.getDocument(artifactPath(input.tenantId, input.roomId)));
      const progress = admittedProgressEnvelope(await firebase.getDocument(progressPath(input.tenantId, input.roomId)));
      if (
        !artifact ||
        !progress ||
        artifact.revision !== progress.revision ||
        !progressMatchesArtifact(progress.value, artifact.value)
      ) return artifactUnavailable("denied");
      return {
        status: "loaded",
        revision: artifact.revision,
        value: artifact.value,
        projectProgress: progress.value
      };
    } catch (error) {
      return artifactUnavailable(safeCloudFailureStatus(error));
    }
  }

  async function saveSharedArtifact(input) {
    const uid = currentUid(firebase);
    if (!uid || !validSaveInput(input)) return artifactUnavailable("denied");
    const membershipResult = await loadRoomMembership(uid);
    if (
      membershipResult.status !== "member" ||
      membershipResult.membership.tenantId !== input.tenantId ||
      membershipResult.membership.roomId !== input.roomId
    ) return artifactUnavailable(membershipResult.status === "offline" ? "offline" : "not-member");

    const sharedArtifactPath = artifactPath(input.tenantId, input.roomId);
    const sharedProgressPath = progressPath(input.tenantId, input.roomId);
    try {
      const transactionResult = await firebase.runTransaction(async (transaction) => {
        const teacherRoot = admittedTeacherRoot(
          await transaction.get(teacherPath(uid)),
          uid
        );
        if (
          !teacherRoot ||
          teacherRoot.tenantId !== input.tenantId ||
          teacherRoot.roomId !== input.roomId
        ) return { status: "not-member" };
        const membership = admittedMembership(
          await transaction.get(membershipPath(input.tenantId, uid)),
          { uid, tenantId: input.tenantId, roomId: input.roomId }
        );
        if (!membership) return { status: "not-member" };
        const room = admittedRoom(
          await transaction.get(roomPath(input.tenantId, input.roomId)),
          input.tenantId,
          input.roomId
        );
        if (!room) return { status: "not-member" };
        const current = admittedEnvelope(await transaction.get(sharedArtifactPath));
        if (!current) return { status: "denied" };
        if (current.revision !== input.expectedRevision) {
          return {
            status: "conflict",
            revision: current.revision,
            value: current.value,
            projectProgress: projectProgressFor(current.value)
          };
        }
        let nextValue;
        try {
          nextValue = recordArtifactHandoff(current.value, {
            handoff: input.handoff,
            eventId: input.eventId,
            visitDate: input.visitDate,
            nowIso: input.nowIso
          });
        } catch {
          return { status: "denied" };
        }
        const revision = input.expectedRevision + 1;
        const nextProgress = projectProgressFor(nextValue);
        transaction.set(sharedArtifactPath, {
          schemaVersion: 1,
          revision,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          value: nextValue
        });
        transaction.set(sharedProgressPath, {
          schemaVersion: 1,
          revision,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          value: nextProgress
        });
        return { status: "written", revision };
      });
      if (transactionResult?.status === "conflict") return transactionResult;
      if (transactionResult?.status === "not-member") return artifactUnavailable("not-member");
      if (transactionResult?.status !== "written") return artifactUnavailable("denied");

      const artifact = admittedEnvelope(await firebase.getDocument(sharedArtifactPath));
      const progress = admittedProgressEnvelope(await firebase.getDocument(sharedProgressPath));
      if (
        !artifact ||
        !progress ||
        artifact.revision !== transactionResult.revision ||
        progress.revision !== transactionResult.revision ||
        artifact.updatedBy !== uid ||
        progress.updatedBy !== uid ||
        !progressMatchesArtifact(progress.value, artifact.value)
      ) return artifactUnavailable("denied");
      return {
        status: "verified",
        revision: artifact.revision,
        value: artifact.value,
        projectProgress: progress.value
      };
    } catch (error) {
      return artifactUnavailable(safeCloudFailureStatus(error));
    }
  }

  return {
    createTenantRoom,
    redeemRoomInvite,
    loadRoomMembership,
    loadSharedArtifact,
    saveSharedArtifact
  };
}
