import { admitLocalState } from "../model/access.js";
import { getCycleDay } from "../model/schedule.js";
import { summarizeTeacherPlan } from "../model/setup-flow.js";
import { TECH_TERRARIUM_ARTIFACT_ID, validateSharedArtifact } from "../model/shared-artifact.js";
import {
  applyPrivateDomains,
  applySharedDomains,
  assertCloudDomainShape,
  partitionPrivateDomains
} from "../storage/cloud-domains.js";
import { mergeStates } from "../storage/sync-engine.js";
import { isRoomInviteDisplayCode } from "../storage/room-sync.js";
import { applyPlanImport, previewPlanImport } from "../ui/settings.js";

const PRIVATE_DOMAINS = Object.freeze(["plan", "progress", "preferences", "content"]);
const DEVICE_DOMAINS = Object.freeze([...PRIVATE_DOMAINS, "sharedArtifact"]);
const SETUP_STEPS = Object.freeze(["account", "teacher", "schedule", "sync", "verify", "ready"]);
const SAFE_SEGMENT = /^[^/\\\u0000-\u001f\u007f]+$/;

function clone(value) {
  return structuredClone(value);
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => deepEqual(entry, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return deepEqual(leftKeys, rightKeys) && leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function safeSegment(value) {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 200 &&
    SAFE_SEGMENT.test(value) && value !== "." && value !== "..";
}

function safeText(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  return result || fallback;
}

function maskEmail(value) {
  if (typeof value !== "string" || value.length > 254 || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!/^[a-z0-9.-]+$/i.test(domain)) return null;
  const masked = local.length <= 2
    ? "*".repeat(local.length)
    : `${local[0]}${"*".repeat(local.length - 2)}${local.at(-1)}`;
  return `${masked}@${domain}`;
}

function normalizedUser(value) {
  if (!safeSegment(value?.uid)) return null;
  return {
    uid: value.uid,
    displayName: safeText(value.displayName, "Signed-in teacher"),
    maskedEmail: maskEmail(value.email)
  };
}

function orderedDomains(domains) {
  const values = new Set(Array.isArray(domains) ? domains : []);
  return DEVICE_DOMAINS.filter((domain) => values.has(domain));
}

function defaultMetadata() {
  return {
    schemaVersion: 1,
    accountUid: null,
    teacherConfirmed: false,
    planConfirmed: false,
    uploadAuthorized: false,
    pendingDomains: [],
    conflictDomains: [],
    lastVerifiedAt: null,
    lastVerifiedRevisions: {
      plan: 0,
      progress: 0,
      preferences: 0,
      content: 0,
      sharedArtifact: 0
    },
    tenantId: null,
    roomId: null,
    pendingSharedHandoff: null
  };
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safePlanSummary(plan, now) {
  const summary = summarizeTeacherPlan(plan);
  if (!summary.valid) return null;
  const cycle = getCycleDay(localDateKey(now), plan.calendar);
  const currentDateResult = cycle.day === null ? "No cycle day" : `Cycle day ${cycle.day}`;
  return {
    status: "preview",
    teacherName: summary.teacherName,
    cycleDayCount: summary.cycleDayCount,
    eventCount: summary.eventCount,
    dateRange: summary.dateRange,
    currentDateResult,
    warnings: (summary.warnings ?? []).map((warning) => safeText(String(warning), "Plan warning"))
  };
}

function sharedBundle(value, projectProgress) {
  const artifact = validateSharedArtifact(value);
  if (!artifact || !projectProgress || typeof projectProgress !== "object" || Array.isArray(projectProgress)) {
    throw new TypeError("shared-artifact-invalid");
  }
  return {
    artifacts: { [TECH_TERRARIUM_ARTIFACT_ID]: artifact },
    projectProgress: { [TECH_TERRARIUM_ARTIFACT_ID]: clone(projectProgress) }
  };
}

function authFailureCopy(status) {
  return {
    "popup-blocked": "Google sign-in could not open. Allow pop-ups for this site, then choose Continue with Google again.",
    "popup-closed": "Google sign-in was closed. Choose Continue with Google when you are ready.",
    "unauthorized-domain": "Google sign-in is not enabled for this CIRC HQ address. Keep using local mode and ask the site owner to check the authorized domain.",
    offline: "You appear to be offline. Keep teaching from this device and try Google sign-in again when connected.",
    denied: "Google sign-in could not start. Try again or open Setup help."
  }[status] ?? "Google sign-in could not start. Try again or open Setup help.";
}

function inviteFailureCopy(status) {
  return {
    "not-found": "That invitation was not found. Ask the room owner for a new one-time invitation.",
    used: "That invitation was already used. Ask the room owner for a new one-time invitation.",
    expired: "That invitation expired. Ask the room owner for a new one-time invitation.",
    offline: "You appear to be offline. Keep teaching locally and try the invitation again when connected.",
    denied: "CIRC HQ could not join that room. Check the invitation or open Setup help."
  }[status] ?? "CIRC HQ could not join that room. Check the invitation or open Setup help.";
}

export function createCloudRuntimeController({
  store,
  clock = { now: () => new Date() },
  readFileText = (file) => file.text(),
  migrationOptions = null,
  getState,
  acceptPersistedState,
  persistAndAcceptState,
  invalidate = () => {},
  routes = {}
} = {}) {
  if (!store || typeof getState !== "function" || typeof acceptPersistedState !== "function" ||
      typeof persistAndAcceptState !== "function") {
    throw new TypeError("cloud-runtime-injections-invalid");
  }

  let client = null;
  let unsubscribe = null;
  let destroyed = false;
  let generation = 0;
  let connectionId = 0;
  let observedUser = null;
  let accountStatus = "signed-out";
  let current = "account";
  let mode = "setup";
  let notice = null;
  let syncStatus = "idle";
  let planStatus = "missing";
  let planSummary = null;
  let roomPresentation = { status: "missing", name: null, role: null };
  let transientInviteCode = null;
  let roomMembership = null;
  let preview = null;
  let cloudBundle = null;
  let planConflict = null;
  let conflictCandidates = new Map();
  let metadataMemory = defaultMetadata();
  let signOutWaiter = null;
  let suspendedClient = null;
  let previewRequestId = 0;
  let sharedWriteQueue = Promise.resolve();
  const writeQueues = new Map();
  const domainChangeVersions = new Map(PRIVATE_DOMAINS.map((domain) => [domain, 0]));

  function resetAsyncQueues() {
    writeQueues.clear();
    sharedWriteQueue = Promise.resolve();
    previewRequestId += 1;
    for (const domain of PRIVATE_DOMAINS) domainChangeVersions.set(domain, 0);
  }

  function markDomainChanged(domain) {
    const next = (domainChangeVersions.get(domain) ?? 0) + 1;
    domainChangeVersions.set(domain, next);
    return next;
  }

  function readMetadata() {
    if (typeof store.loadDeviceMetadata === "function") {
      try {
        return store.loadDeviceMetadata();
      } catch {
        return clone(metadataMemory);
      }
    }
    return clone(metadataMemory);
  }

  function saveMetadata(value) {
    const normalized = {
      ...clone(value),
      pendingDomains: orderedDomains(value.pendingDomains),
      conflictDomains: orderedDomains(value.conflictDomains)
    };
    if (typeof store.saveDeviceMetadata === "function") {
      metadataMemory = store.saveDeviceMetadata(normalized);
    } else {
      metadataMemory = normalized;
    }
    return clone(metadataMemory);
  }

  function clearIdentityMetadata() {
    if (typeof store.clearCloudIdentityMetadata === "function") {
      metadataMemory = store.clearCloudIdentityMetadata({ preservePending: true });
    } else {
      const prior = readMetadata();
      metadataMemory = defaultMetadata();
      metadataMemory.pendingDomains = prior.pendingDomains.filter((domain) => PRIVATE_DOMAINS.includes(domain));
    }
    return clone(metadataMemory);
  }

  function validCompletion(tokenGeneration, uid) {
    return !destroyed && generation === tokenGeneration && observedUser?.uid === uid;
  }

  function isTrustedRoomMembership(value, uid) {
    return value?.trusted === true && value.uid === uid && safeSegment(value.tenantId) &&
      safeSegment(value.roomId) && ["owner", "teacher"].includes(value.role);
  }

  function trustedRoomContext(metadata, uid) {
    if (!isTrustedRoomMembership(roomMembership, uid)) return null;
    if (metadata.tenantId !== roomMembership.tenantId || metadata.roomId !== roomMembership.roomId) return null;
    return roomMembership;
  }

  function sameIdentityContext(tokenGeneration, uid) {
    return !destroyed && generation === tokenGeneration && (observedUser?.uid ?? null) === uid;
  }

  function render() {
    if (!destroyed) invalidate();
  }

  function setNotice(kind, text) {
    notice = text ? { kind, text } : null;
  }

  function setAttention(text) {
    syncStatus = "attention";
    setNotice("warning", text);
    render();
  }

  function currentPlanSummary(status = planStatus) {
    if (!planSummary) {
      return {
        status: "missing",
        teacherName: null,
        cycleDayCount: null,
        eventCount: null,
        dateRange: null,
        currentDateResult: null,
        warnings: []
      };
    }
    return { ...clone(planSummary), status };
  }

  function completedSteps() {
    const index = SETUP_STEPS.indexOf(current);
    return index > 0 ? SETUP_STEPS.slice(0, index) : [];
  }

  function nowDate() {
    const value = clock.now();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : new Date(0);
  }

  function effectiveSyncStatus(metadata = readMetadata()) {
    if (metadata.conflictDomains.length && syncStatus !== "offline") return "attention";
    if (metadata.pendingDomains.length && syncStatus === "idle") return "pending";
    return syncStatus;
  }

  function getSetupModel() {
    const metadata = readMetadata();
    const account = observedUser ? {
      status: metadata.teacherConfirmed ? "confirmed" : accountStatus,
      displayName: observedUser.displayName,
      maskedEmail: observedUser.maskedEmail
    } : accountStatus === "pending" ? {
      status: "pending",
      displayName: null,
      maskedEmail: null
    } : null;
    return {
      mode,
      current,
      completed: completedSteps(),
      account,
      plan: currentPlanSummary(),
      room: {
        ...clone(roomPresentation),
        ...(transientInviteCode ? { inviteCode: transientInviteCode } : {})
      },
      sync: {
        status: effectiveSyncStatus(metadata),
        lastVerifiedAt: metadata.lastVerifiedAt,
        pendingDomains: clone(metadata.pendingDomains),
        conflictDomains: clone(metadata.conflictDomains)
      },
      localBackup: { status: metadata.lastVerifiedAt ? "preserved" : "ready" },
      currentCycleDay: planSummary?.currentDateResult ?? null,
      notice: notice ? clone(notice) : null
    };
  }

  function getSyncPresentation() {
    const metadata = readMetadata();
    const status = effectiveSyncStatus(metadata);
    return {
      status,
      label: {
        verified: "CIRC Cloud verified",
        pending: "Syncing",
        offline: "Offline, saved locally",
        attention: "Sync needs attention",
        idle: client?.status === "not-configured"
          ? "Cloud setup not configured"
          : client?.status === "cloud-blocked"
            ? "Cloud setup blocked"
            : observedUser
              ? "Saved locally"
              : "Saved on this browser"
      }[status],
      lastVerifiedAt: metadata.lastVerifiedAt,
      pendingDomains: clone(metadata.pendingDomains),
      conflictDomains: clone(metadata.conflictDomains)
    };
  }

  function getRoomPresentation() {
    return {
      ...clone(roomPresentation),
      syncLabel: getSyncPresentation().label,
      lastVerifiedAt: readMetadata().lastVerifiedAt
    };
  }

  function resetInMemoryCloud() {
    cloudBundle = null;
    planConflict = null;
    conflictCandidates = new Map();
    preview = null;
    transientInviteCode = null;
    roomMembership = null;
    roomPresentation = { status: "missing", name: null, role: null };
  }

  function admitRemoteBundle(result) {
    if (result?.status !== "loaded" || !result.domains || !result.revisions) return null;
    if (!deepEqual(Object.keys(result.domains).sort(), [...PRIVATE_DOMAINS].sort()) ||
        !deepEqual(Object.keys(result.revisions).sort(), [...PRIVATE_DOMAINS].sort())) return null;
    const domains = {};
    const revisions = {};
    for (const domain of PRIVATE_DOMAINS) {
      const value = result.domains[domain];
      const revision = result.revisions[domain];
      if (value === null && revision === 0) {
        domains[domain] = null;
        revisions[domain] = 0;
        continue;
      }
      if (!Number.isSafeInteger(revision) || revision < 1) return null;
      try {
        domains[domain] = assertCloudDomainShape(domain, value);
      } catch {
        return null;
      }
      revisions[domain] = revision;
    }
    const present = PRIVATE_DOMAINS.filter((domain) => domains[domain] !== null).length;
    return {
      classification: present === 0 ? "empty" : present === PRIVATE_DOMAINS.length ? "complete" : "partial",
      domains,
      revisions
    };
  }

  function applySharedResult(result, { persist = true } = {}) {
    if ((result?.status !== "loaded" && result?.status !== "verified") ||
        !Number.isSafeInteger(result.revision) || result.revision < 1) return false;
    try {
      const next = applySharedDomains(getState(), sharedBundle(result.value, result.projectProgress));
      if (persist) persistAndAcceptState(next);
      const metadata = readMetadata();
      metadata.lastVerifiedRevisions.sharedArtifact = result.revision;
      metadata.pendingDomains = metadata.pendingDomains.filter((domain) => domain !== "sharedArtifact");
      metadata.conflictDomains = metadata.conflictDomains.filter((domain) => domain !== "sharedArtifact");
      metadata.pendingSharedHandoff = null;
      saveMetadata(metadata);
      return true;
    } catch {
      return false;
    }
  }

  async function loadRoom(tokenGeneration, uid) {
    const result = await client.loadRoomMembership(uid);
    if (!validCompletion(tokenGeneration, uid)) return false;
    if (result?.status === "offline") {
      syncStatus = "offline";
      return false;
    }
    if (result?.status !== "member" || !isTrustedRoomMembership(result.membership, uid)) {
      roomMembership = null;
      roomPresentation = { status: "missing", name: null, role: null };
      return false;
    }
    roomMembership = clone(result.membership);
    roomPresentation = {
      status: result.membership.role === "owner" ? "owner" : "member",
      name: safeText(result.room?.name, "Shared CIRC Room"),
      role: result.membership.role
    };
    const metadata = readMetadata();
    metadata.tenantId = result.membership.tenantId;
    metadata.roomId = result.membership.roomId;
    saveMetadata(metadata);
    const shared = await client.loadSharedArtifact({
      tenantId: result.membership.tenantId,
      roomId: result.membership.roomId
    });
    if (!validCompletion(tokenGeneration, uid)) return false;
    if (!applySharedResult(shared)) {
      if (shared?.status === "offline") syncStatus = "offline";
      else syncStatus = "attention";
      return false;
    }
    roomPresentation.status = "ready";
    return true;
  }

  function mapMergeConflicts(conflicts) {
    const domains = new Set();
    for (const conflict of conflicts) {
      if (conflict.collection === "teacherProgress") domains.add("progress");
      else if (conflict.collection === "preferences") domains.add("preferences");
      else if (["checklist", "classes", "lessonGuides", "specialEvents", "resources", "notes", "tombstones"].includes(conflict.collection)) {
        domains.add("content");
      }
    }
    return orderedDomains([...domains]);
  }

  async function mergeReturningBundle(remote, tokenGeneration, uid) {
    const local = admitLocalState(getState());
    const remoteState = applyPrivateDomains(local, remote.domains);
    const conflicts = [];
    let candidate = remoteState;
    if (!deepEqual(local.plan, remoteState.plan)) {
      planConflict = { local: clone(local.plan), remote: clone(remoteState.plan), revision: remote.revisions.plan };
      conflicts.push("plan");
      candidate = { ...candidate, plan: clone(local.plan) };
    }
    const merged = mergeStates(local, candidate);
    const entityConflictDomains = mapMergeConflicts(merged.conflicts);
    for (const domain of entityConflictDomains) {
      const collections = domain === "progress"
        ? new Set(["teacherProgress"])
        : domain === "preferences"
          ? new Set(["preferences"])
          : new Set(["checklist", "classes", "lessonGuides", "specialEvents", "resources", "notes", "tombstones"]);
      conflictCandidates.set(
        domain,
        clone(merged.conflicts.filter(({ collection }) => collections.has(collection)))
      );
      conflicts.push(domain);
    }
    if (!validCompletion(tokenGeneration, uid)) return;
    persistAndAcceptState(admitLocalState(merged.state));
    const metadata = readMetadata();
    metadata.lastVerifiedRevisions = { ...metadata.lastVerifiedRevisions, ...remote.revisions };
    metadata.conflictDomains = orderedDomains(conflicts);
    saveMetadata(metadata);
    planSummary = safePlanSummary(getState().plan, nowDate());
    planStatus = metadata.planConfirmed ? "confirmed" : "preview";
  }

  async function loadCloudForObservedUser() {
    const uid = observedUser?.uid;
    const activeClient = client;
    if (!uid || !activeClient) return;
    const tokenGeneration = generation;
    syncStatus = "pending";
    render();
    let raw;
    try {
      raw = await activeClient.loadPrivateDomains(uid);
    } catch {
      raw = { status: "denied" };
    }
    if (!validCompletion(tokenGeneration, uid) || activeClient !== client) return;
    if (raw?.status === "offline") {
      syncStatus = "offline";
      setNotice("warning", "You appear to be offline. Keep teaching from this device and sync again when connected.");
      render();
      return;
    }
    if (raw?.status !== "loaded") {
      setAttention("CIRC Cloud could not safely load this account. Keep teaching locally and open Setup help.");
      return;
    }
    const remote = admitRemoteBundle(raw);
    if (!remote || remote.classification === "partial") {
      setAttention("CIRC Cloud data is incomplete and needs attention before anything can be uploaded.");
      return;
    }
    cloudBundle = remote;
    const metadata = readMetadata();
    metadata.lastVerifiedRevisions = { ...metadata.lastVerifiedRevisions, ...remote.revisions };
    saveMetadata(metadata);
    const local = admitLocalState(getState());
    if (remote.classification === "complete") {
      if (!local.plan) {
        const summary = safePlanSummary(remote.domains.plan.plan, nowDate());
        if (!summary) {
          setAttention("The plan found in CIRC Cloud could not be safely previewed.");
          return;
        }
        planSummary = summary;
        planStatus = "cloud-found";
        current = "schedule";
      } else {
        await mergeReturningBundle(remote, tokenGeneration, uid);
      }
    } else if (local.plan) {
      planSummary = safePlanSummary(local.plan, nowDate());
      planStatus = metadata.planConfirmed ? "confirmed" : "preview";
    }
    const roomReady = await loadRoom(tokenGeneration, uid);
    if (!validCompletion(tokenGeneration, uid)) return;
    const fresh = readMetadata();
    if (remote.classification === "empty") {
      if (local.plan && fresh.planConfirmed) current = "sync";
      else current = "schedule";
      if (fresh.pendingDomains.length) {
        if (syncStatus !== "offline") syncStatus = "pending";
      } else {
        syncStatus = "idle";
      }
    } else if (planStatus === "cloud-found") {
      syncStatus = "idle";
    } else if (fresh.conflictDomains.length) {
      syncStatus = "attention";
      setNotice("warning", "CIRC Cloud found changes that need a teacher decision. Local teaching remains available.");
    } else if (fresh.uploadAuthorized && (!roomMembership || roomReady)) {
      syncStatus = "verified";
      current = "ready";
    } else {
      current = fresh.planConfirmed ? "sync" : "schedule";
      if (!new Set(["offline", "attention"]).has(syncStatus)) syncStatus = "idle";
    }
    render();
  }

  async function observeIdentity(rawUser) {
    if (destroyed) return;
    generation += 1;
    resetAsyncQueues();
    const user = normalizedUser(rawUser);
    if (!user) {
      observedUser = null;
      accountStatus = "signed-out";
      syncStatus = "idle";
      resetInMemoryCloud();
      if (signOutWaiter) {
        clearIdentityMetadata();
        current = "account";
        routes.returnToSetup?.();
        const resolve = signOutWaiter;
        signOutWaiter = null;
        resolve({ status: "signed-out" });
      }
      render();
      return;
    }
    observedUser = user;
    accountStatus = "observed";
    resetInMemoryCloud();
    let metadata = readMetadata();
    if (metadata.accountUid !== user.uid) {
      metadata = clearIdentityMetadata();
      metadata.accountUid = user.uid;
      saveMetadata(metadata);
      current = "teacher";
      syncStatus = "idle";
      setNotice("status", "Confirm this teacher account before CIRC HQ reads or syncs its cloud data.");
      render();
      return;
    }
    if (metadata.teacherConfirmed) {
      accountStatus = "confirmed";
      current = metadata.planConfirmed ? "sync" : "schedule";
      await loadCloudForObservedUser();
    } else {
      current = "teacher";
      syncStatus = "idle";
      render();
    }
  }

  function connect(nextClient) {
    if (mode === "demo") {
      disconnect();
      suspendedClient = nextClient ?? null;
      const suspended = () => {};
      suspended.ready = Promise.resolve();
      return suspended;
    }
    disconnect();
    if (destroyed) return () => {};
    client = nextClient ?? null;
    if (!client || typeof client.observeAuth !== "function") {
      syncStatus = client?.status === "cloud-blocked" ? "attention" : "idle";
      render();
      const inactive = () => {};
      inactive.ready = Promise.resolve();
      return inactive;
    }
    const activeConnection = ++connectionId;
    let settleInitial;
    let initialStarted = false;
    const initialReady = new Promise((resolve) => {
      settleInitial = resolve;
    });
    let rawUnsubscribe;
    try {
      rawUnsubscribe = client.observeAuth((user) => {
        if (destroyed || connectionId !== activeConnection) return;
        const isInitial = !initialStarted;
        if (isInitial) initialStarted = true;
        Promise.resolve(observeIdentity(user)).catch(() => {
          if (!destroyed && connectionId === activeConnection) {
            setAttention("CIRC Cloud could not safely finish its first account check. Keep teaching locally.");
          }
        }).finally(() => {
          if (isInitial) settleInitial();
        });
      });
    } catch {
      syncStatus = "attention";
      settleInitial();
      render();
      const failed = () => {};
      failed.ready = initialReady;
      return failed;
    }
    let called = false;
    unsubscribe = () => {
      if (called) return;
      called = true;
      rawUnsubscribe?.();
      settleInitial();
    };
    unsubscribe.ready = initialReady;
    return unsubscribe;
  }

  function disconnect() {
    generation += 1;
    connectionId += 1;
    unsubscribe?.();
    unsubscribe = null;
    client = null;
    suspendedClient = null;
    observedUser = null;
    accountStatus = "signed-out";
    resetInMemoryCloud();
    resetAsyncQueues();
  }

  function destroy() {
    if (destroyed) return;
    unsubscribe?.();
    unsubscribe = null;
    generation += 1;
    connectionId += 1;
    destroyed = true;
    client = null;
    suspendedClient = null;
    observedUser = null;
    resetInMemoryCloud();
    resetAsyncQueues();
    signOutWaiter?.({ status: "cancelled" });
    signOutWaiter = null;
  }

  function continueWithGoogle() {
    if (!client || client.status !== "ready" || typeof client.signInWithGoogle !== "function") {
      setNotice("warning", "Google sign-in is still getting ready. Try again in a moment.");
      render();
      return Promise.resolve({ status: "not-ready" });
    }
    const tokenGeneration = generation;
    const tokenUid = observedUser?.uid ?? null;
    let result;
    try {
      result = client.signInWithGoogle();
    } catch {
      result = Promise.resolve({ status: "denied" });
    }
    if (sameIdentityContext(tokenGeneration, tokenUid)) {
      accountStatus = "pending";
      setNotice("status", "Waiting for Google to confirm the signed-in account.");
      render();
    }
    return Promise.resolve(result).then((outcome) => {
      if (!sameIdentityContext(tokenGeneration, tokenUid)) return outcome;
      if (outcome?.status !== "pending") {
        accountStatus = observedUser ? "observed" : "signed-out";
        setNotice("error", authFailureCopy(outcome?.status));
        render();
      }
      return outcome;
    }, () => {
      if (sameIdentityContext(tokenGeneration, tokenUid)) {
        accountStatus = observedUser ? "observed" : "signed-out";
        setNotice("error", authFailureCopy("denied"));
        render();
      }
      return { status: "denied" };
    });
  }

  async function useAccount() {
    if (!observedUser) return { status: "blocked" };
    const metadata = readMetadata();
    metadata.accountUid = observedUser.uid;
    metadata.teacherConfirmed = true;
    saveMetadata(metadata);
    accountStatus = "confirmed";
    current = "schedule";
    setNotice(null, null);
    render();
    await loadCloudForObservedUser();
    return { status: "confirmed" };
  }

  async function signOut() {
    if (!client || typeof client.signOut !== "function") return { status: "signed-out" };
    if (!signOutWaiter) {
      const observerResult = new Promise((resolve) => {
        signOutWaiter = resolve;
      });
      let result;
      try {
        result = client.signOut();
      } catch {
        signOutWaiter = null;
        setAttention("Sign-out needs attention. Keep using local mode and try again.");
        return { status: "denied" };
      }
      const requested = await Promise.resolve(result).catch(() => ({ status: "denied" }));
      if (requested?.status !== "signed-out") {
        signOutWaiter = null;
        setAttention("Sign-out needs attention. Keep using local mode and try again.");
        return requested;
      }
      return observerResult;
    }
    return new Promise((resolve) => {
      const prior = signOutWaiter;
      signOutWaiter = (value) => {
        prior(value);
        resolve(value);
      };
    });
  }

  async function choosePlanFile(file) {
    if (mode === "demo") return { status: "blocked" };
    const tokenGeneration = generation;
    const tokenUid = observedUser?.uid ?? null;
    const requestId = ++previewRequestId;
    let text;
    try {
      text = await readFileText(file);
    } catch {
      if (!sameIdentityContext(tokenGeneration, tokenUid) || requestId !== previewRequestId || mode === "demo") {
        return { status: "cancelled" };
      }
      setNotice("error", "That teacher plan file could not be read. Choose the JSON file again.");
      render();
      return { status: "invalid" };
    }
    if (!sameIdentityContext(tokenGeneration, tokenUid) || requestId !== previewRequestId || mode === "demo") {
      return { status: "cancelled" };
    }
    const result = previewPlanImport(getState().plan, text, { migrationOptions });
    if (!result.ok) {
      setNotice("error", "That file is not a valid CIRC HQ teacher plan.");
      render();
      return { status: "invalid" };
    }
    const summary = safePlanSummary(result.candidate, nowDate());
    if (!summary) return { status: "invalid" };
    preview = { kind: "file", token: result.previewToken, candidate: clone(result.candidate) };
    planSummary = summary;
    planStatus = "preview";
    setNotice("status", "Plan preview ready. Nothing has been uploaded.");
    render();
    return { status: "preview", summary: clone(planSummary) };
  }

  async function confirmPlanPreview() {
    if (mode === "demo") return { status: "blocked" };
    let nextState;
    if (planStatus === "cloud-found" && cloudBundle?.classification === "complete") {
      try {
        nextState = applyPrivateDomains(getState(), cloudBundle.domains);
        persistAndAcceptState(nextState);
      } catch {
        setAttention("The cloud plan could not be safely applied. Your local data was preserved.");
        return { status: "denied" };
      }
    } else if (preview?.kind === "file") {
      const result = applyPlanImport(store, preview.token);
      preview = null;
      if (!result.ok) {
        setNotice("error", "The plan preview changed before it could be applied. Preview the file again.");
        render();
        return { status: "stale" };
      }
      acceptPersistedState(result.state);
      nextState = result.state;
    } else if (planStatus === "preview" && getState().plan) {
      nextState = admitLocalState(getState());
    } else {
      return { status: "blocked" };
    }
    const metadata = readMetadata();
    metadata.planConfirmed = true;
    saveMetadata(metadata);
    planSummary = safePlanSummary(nextState.plan, nowDate());
    planStatus = "confirmed";
    current = "sync";
    setNotice("status", "Private teacher plan confirmed on this device. It has not been uploaded.");
    render();
    return { status: "confirmed" };
  }

  async function createRoom() {
    const metadata = readMetadata();
    const uid = observedUser?.uid;
    if (!uid || !metadata.teacherConfirmed || !metadata.planConfirmed || !client) return { status: "blocked" };
    const tokenGeneration = generation;
    const result = await client.createTenantRoom({
      tenantName: "CIRC HQ",
      roomName: "Shared CIRC Room",
      nowIso: nowDate().toISOString()
    });
    if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
    if (result?.status !== "created" || !safeSegment(result.tenantId) || !safeSegment(result.roomId) ||
        !isTrustedRoomMembership(result.membership, uid) || result.membership.role !== "owner" ||
        result.membership.tenantId !== result.tenantId || result.membership.roomId !== result.roomId ||
        !isRoomInviteDisplayCode(result.inviteCode) ||
        !Number.isSafeInteger(result.revision) || result.revision < 1) {
      setAttention(result?.status === "offline"
        ? "You appear to be offline. Keep teaching locally and create the room when connected."
        : "Room creation needs attention. Keep the local plan and try again from Setup help.");
      return { status: result?.status === "offline" ? "offline" : "denied" };
    }
    roomMembership = clone(result.membership);
    roomPresentation = { status: "owner", name: "Shared CIRC Room", role: result.membership.role };
    transientInviteCode = result.inviteCode;
    const nextMetadata = readMetadata();
    nextMetadata.tenantId = result.tenantId;
    nextMetadata.roomId = result.roomId;
    nextMetadata.lastVerifiedRevisions.sharedArtifact = result.revision;
    saveMetadata(nextMetadata);
    try {
      const next = applySharedDomains(getState(), sharedBundle(result.artifact, result.projectProgress));
      persistAndAcceptState(next);
    } catch {
      setAttention("The new room was created, but its shared project could not be admitted on this device. Open Setup help.");
      return { status: "denied" };
    }
    current = "sync";
    setNotice("status", "CIRC room created. Share the one-time invitation directly with the other teacher.");
    render();
    return { inviteCode: result.inviteCode };
  }

  async function redeemInvite(inputCode) {
    const uid = observedUser?.uid;
    const metadata = readMetadata();
    if (!uid || !client || metadata.accountUid !== uid ||
        !metadata.teacherConfirmed || !metadata.planConfirmed) {
      return { status: "blocked" };
    }
    const tokenGeneration = generation;
    let code = inputCode;
    inputCode = null;
    let result;
    try {
      const request = client.redeemRoomInvite(code);
      code = null;
      result = await request;
    } finally {
      inputCode = null;
      code = null;
    }
    if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
    if (result?.status !== "joined") {
      setNotice("error", inviteFailureCopy(result?.status));
      roomPresentation.status = "joining";
      render();
      return { status: result?.status ?? "denied" };
    }
    const loaded = await loadRoom(tokenGeneration, uid);
    if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
    if (!loaded) {
      setAttention("The room was joined, but its shared project could not be verified. Open Setup help.");
      return { status: "attention" };
    }
    current = "sync";
    setNotice("status", "CIRC room joined and its shared project verified.");
    render();
    return { status: "joined" };
  }

  function updateDomainResult(metadata, domain, outcome, {
    expectedValue = null,
    expectedRevision,
    operation = "save",
    changeVersion = null
  } = {}) {
    const requiredRevision = operation === "verify"
      ? expectedRevision
      : Number.isSafeInteger(expectedRevision)
        ? expectedRevision + 1
        : null;
    if (outcome?.status === "verified" && Number.isSafeInteger(requiredRevision) &&
        outcome.revision === requiredRevision) {
      let admittedValue;
      try {
        admittedValue = assertCloudDomainShape(domain, outcome.value);
      } catch {
        metadata.conflictDomains = orderedDomains([...metadata.conflictDomains, domain]);
        syncStatus = "attention";
        return false;
      }
      if (expectedValue !== null && !deepEqual(admittedValue, expectedValue)) {
        metadata.conflictDomains = orderedDomains([...metadata.conflictDomains, domain]);
        syncStatus = "attention";
        return false;
      }
      metadata.lastVerifiedRevisions[domain] = outcome.revision;
      if (changeVersion === null || domainChangeVersions.get(domain) === changeVersion) {
        metadata.pendingDomains = metadata.pendingDomains.filter((entry) => entry !== domain);
        metadata.conflictDomains = metadata.conflictDomains.filter((entry) => entry !== domain);
      }
      if (cloudBundle?.domains && cloudBundle?.revisions) {
        cloudBundle.domains[domain] = clone(admittedValue);
        cloudBundle.revisions[domain] = outcome.revision;
      }
      return true;
    }
    if (outcome?.status === "verified") {
      syncStatus = "attention";
      return false;
    }
    if (outcome?.status === "offline") syncStatus = "offline";
    else if (outcome?.status === "conflict") {
      metadata.conflictDomains = orderedDomains([...metadata.conflictDomains, domain]);
      syncStatus = "attention";
    } else syncStatus = "attention";
    return false;
  }

  async function uploadAndVerify() {
    const metadata = readMetadata();
    const uid = observedUser?.uid;
    if (!uid || metadata.accountUid !== uid || !metadata.teacherConfirmed || !metadata.planConfirmed ||
        metadata.conflictDomains.length > 0 || !client) {
      setAttention("Complete the account and plan steps before uploading.");
      return { status: "blocked" };
    }
    try {
      store.backup();
    } catch {
      setAttention("CIRC HQ could not preserve the local backup, so nothing was uploaded.");
      return { status: "blocked" };
    }
    const tokenGeneration = generation;
    const domains = partitionPrivateDomains(getState());
    current = "verify";
    syncStatus = "pending";
    render();
    for (const domain of PRIVATE_DOMAINS) {
      const fresh = readMetadata();
      const expectedRevision = fresh.lastVerifiedRevisions[domain];
      const changeVersion = domainChangeVersions.get(domain) ?? 0;
      fresh.pendingDomains = orderedDomains([...fresh.pendingDomains, domain]);
      saveMetadata(fresh);
      let outcome;
      let operation = "save";
      try {
        if (cloudBundle?.domains?.[domain] && deepEqual(cloudBundle.domains[domain], domains[domain])) {
          operation = "verify";
          outcome = await client.verifyPrivateDomain(uid, domain, expectedRevision);
        } else {
          outcome = await client.savePrivateDomain(uid, domain, domains[domain], expectedRevision);
        }
      } catch {
        outcome = { status: "denied", revision: null, value: null };
      }
      if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
      const latest = readMetadata();
      if (!updateDomainResult(latest, domain, outcome, {
        expectedValue: domains[domain],
        expectedRevision,
        operation,
        changeVersion
      })) {
        saveMetadata(latest);
        setAttention("Cloud verification stopped safely. Completed domains were preserved for a retry.");
        return {
          status: outcome?.status === "offline" || outcome?.status === "conflict"
            ? outcome.status
            : "attention"
        };
      }
      saveMetadata(latest);
    }
    const room = trustedRoomContext(readMetadata(), uid);
    if (room) {
      const roomResult = await client.loadSharedArtifact({
        tenantId: room.tenantId,
        roomId: room.roomId
      });
      if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
      if (!applySharedResult(roomResult)) {
        if (roomResult?.status === "offline") {
          syncStatus = "offline";
          setNotice("warning", "Private data was verified, but the shared project is offline. Retry from Setup help when connected.");
          render();
          return { status: "offline" };
        }
        setAttention("Private data was verified, but the shared project needs attention. Retry from Setup help.");
        return { status: roomResult?.status ?? "denied" };
      }
    }
    const completeMetadata = readMetadata();
    completeMetadata.uploadAuthorized = true;
    saveMetadata(completeMetadata);
    if (completeMetadata.conflictDomains.length > 0) {
      setAttention("Cloud verification found a conflict. Local teaching remains available while it is resolved.");
      return { status: "attention" };
    }
    if (completeMetadata.pendingDomains.some((domain) => PRIVATE_DOMAINS.includes(domain))) {
      const resumed = await syncNow();
      if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
      if (resumed.status !== "verified") {
        current = "verify";
        setNotice("warning", "Newer local changes are still pending. Retry Sync now from Setup help.");
        render();
        return resumed;
      }
    }
    const verifiedMetadata = readMetadata();
    verifiedMetadata.lastVerifiedAt = nowDate().toISOString();
    saveMetadata(verifiedMetadata);
    syncStatus = "verified";
    current = "ready";
    setNotice("status", "CIRC Cloud was written, read back, and verified.");
    render();
    return { status: "verified" };
  }

  function queuePrivateWrite(domain, state, tokenGeneration, uid) {
    const prior = writeQueues.get(domain) ?? Promise.resolve();
    const queued = prior.then(async () => {
      if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
      const metadata = readMetadata();
      if (!metadata.uploadAuthorized || metadata.conflictDomains.includes(domain)) return { status: "pending" };
      const value = partitionPrivateDomains(state)[domain];
      const expectedRevision = metadata.lastVerifiedRevisions[domain];
      const changeVersion = domainChangeVersions.get(domain) ?? 0;
      let outcome;
      try {
        outcome = await client.savePrivateDomain(uid, domain, value, expectedRevision);
      } catch {
        outcome = { status: "denied", revision: null, value: null };
      }
      if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
      const latest = readMetadata();
      const accepted = updateDomainResult(latest, domain, outcome, {
        expectedValue: value,
        expectedRevision,
        operation: "save",
        changeVersion
      });
      if (latest.pendingDomains.length === 0 && latest.conflictDomains.length === 0 && outcome?.status === "verified") {
        latest.lastVerifiedAt = nowDate().toISOString();
        syncStatus = "verified";
      }
      saveMetadata(latest);
      render();
      return accepted
        ? outcome
        : {
            status: outcome?.status === "offline" || outcome?.status === "conflict"
              ? outcome.status
              : "attention"
          };
    });
    writeQueues.set(domain, queued.catch(() => {}));
    return queued;
  }

  async function afterLocalCommit({ domains = [], state } = {}) {
    const admittedDomains = orderedDomains(domains).filter((domain) => PRIVATE_DOMAINS.includes(domain));
    if (!admittedDomains.length || mode === "demo") return { status: "local-only" };
    const admittedState = admitLocalState(state ?? getState());
    const metadata = readMetadata();
    if (admittedDomains.includes("plan")) {
      planSummary = safePlanSummary(admittedState.plan, nowDate());
      planStatus = planSummary
        ? metadata.planConfirmed
          ? "confirmed"
          : "preview"
        : "missing";
      if (!metadata.planConfirmed || !planSummary) current = "schedule";
    }
    for (const domain of admittedDomains) markDomainChanged(domain);
    metadata.pendingDomains = orderedDomains([...metadata.pendingDomains, ...admittedDomains]);
    saveMetadata(metadata);
    syncStatus = client && observedUser ? "pending" : "idle";
    render();
    const uid = observedUser?.uid;
    if (!uid || !client || !metadata.uploadAuthorized || metadata.accountUid !== uid) return { status: "pending" };
    const tokenGeneration = generation;
    const results = [];
    for (const domain of admittedDomains) {
      results.push(await queuePrivateWrite(domain, admittedState, tokenGeneration, uid));
    }
    return { status: results.every((result) => result?.status === "verified") ? "verified" : results.at(-1)?.status ?? "pending" };
  }

  async function performSharedHandoff({ handoff } = {}, tokenGeneration, tokenUid) {
    if (mode === "demo") return { status: "local-only" };
    if (!sameIdentityContext(tokenGeneration, tokenUid)) return { status: "cancelled" };
    const metadata = readMetadata();
    const room = trustedRoomContext(metadata, tokenUid);
    if (!room || !handoff || typeof handoff !== "object") return { status: "blocked" };
    if (metadata.pendingSharedHandoff) {
      const pending = metadata.pendingSharedHandoff;
      const sameOperation = pending.handoff === handoff.handoff && pending.eventId === handoff.eventId &&
        pending.visitDate === handoff.visitDate && pending.nowIso === handoff.nowIso;
      if (!sameOperation) {
        metadata.conflictDomains = orderedDomains([...metadata.conflictDomains, "sharedArtifact"]);
        saveMetadata(metadata);
        syncStatus = "attention";
        render();
      }
      return { status: sameOperation ? "pending" : "conflict" };
    }
    const operation = {
      artifactId: TECH_TERRARIUM_ARTIFACT_ID,
      expectedRevision: metadata.lastVerifiedRevisions.sharedArtifact,
      handoff: handoff.handoff,
      eventId: handoff.eventId,
      visitDate: handoff.visitDate,
      nowIso: handoff.nowIso
    };
    metadata.pendingSharedHandoff = operation;
    metadata.pendingDomains = orderedDomains([...metadata.pendingDomains, "sharedArtifact"]);
    saveMetadata(metadata);
    const uid = observedUser?.uid;
    if (!uid || !client || !metadata.uploadAuthorized) {
      syncStatus = "offline";
      render();
      return { status: "pending" };
    }
    let outcome;
    try {
      outcome = await client.saveSharedArtifact({
        tenantId: room.tenantId,
        roomId: room.roomId,
        expectedRevision: operation.expectedRevision,
        handoff: operation.handoff,
        eventId: operation.eventId,
        visitDate: operation.visitDate,
        nowIso: operation.nowIso
      });
    } catch {
      outcome = { status: "denied", revision: null, value: null, projectProgress: null };
    }
    if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
    if (outcome?.revision === operation.expectedRevision + 1 && applySharedResult(outcome)) {
      const fresh = readMetadata();
      fresh.lastVerifiedAt = nowDate().toISOString();
      saveMetadata(fresh);
      syncStatus = "verified";
    } else if (outcome?.status === "offline") {
      syncStatus = "offline";
    } else {
      const fresh = readMetadata();
      fresh.conflictDomains = orderedDomains([...fresh.conflictDomains, "sharedArtifact"]);
      saveMetadata(fresh);
      syncStatus = "attention";
    }
    render();
    return { status: outcome?.status ?? "denied" };
  }

  function afterSharedHandoff(input = {}) {
    const tokenGeneration = generation;
    const tokenUid = observedUser?.uid ?? null;
    const queued = sharedWriteQueue.then(() => performSharedHandoff(input, tokenGeneration, tokenUid));
    sharedWriteQueue = queued.catch(() => {});
    return queued;
  }

  async function syncPendingShared(uid, tokenGeneration) {
    const metadata = readMetadata();
    const operation = metadata.pendingSharedHandoff;
    if (!operation) return true;
    const room = trustedRoomContext(metadata, uid);
    if (!room) {
      syncStatus = "pending";
      return false;
    }
    const remote = await client.loadSharedArtifact({ tenantId: room.tenantId, roomId: room.roomId });
    if (!validCompletion(tokenGeneration, uid)) return false;
    if (remote?.status !== "loaded") {
      syncStatus = remote?.status === "offline" ? "offline" : "attention";
      return false;
    }
    const identity = `${operation.eventId}|${operation.visitDate}`;
    if (remote.value?.visitIdentities?.includes(identity)) return applySharedResult(remote);
    if (remote.revision !== operation.expectedRevision) {
      const fresh = readMetadata();
      fresh.conflictDomains = orderedDomains([...fresh.conflictDomains, "sharedArtifact"]);
      saveMetadata(fresh);
      syncStatus = "attention";
      return false;
    }
    const result = await client.saveSharedArtifact({
      tenantId: room.tenantId,
      roomId: room.roomId,
      expectedRevision: operation.expectedRevision,
      handoff: operation.handoff,
      eventId: operation.eventId,
      visitDate: operation.visitDate,
      nowIso: operation.nowIso
    });
    if (!validCompletion(tokenGeneration, uid)) return false;
    if (result?.status === "verified" &&
        result.revision === operation.expectedRevision + 1 && applySharedResult(result)) return true;
    if (result?.status === "offline") {
      syncStatus = "offline";
      return false;
    }
    const fresh = readMetadata();
    fresh.conflictDomains = orderedDomains([...fresh.conflictDomains, "sharedArtifact"]);
    saveMetadata(fresh);
    syncStatus = "attention";
    return false;
  }

  async function syncNow() {
    const uid = observedUser?.uid;
    const metadata = readMetadata();
    if (!uid || !client || !metadata.uploadAuthorized || metadata.accountUid !== uid) {
      syncStatus = "offline";
      render();
      return { status: "offline" };
    }
    const tokenGeneration = generation;
    syncStatus = "pending";
    render();
    for (const domain of metadata.pendingDomains.filter((entry) => PRIVATE_DOMAINS.includes(entry) && !metadata.conflictDomains.includes(entry))) {
      await queuePrivateWrite(domain, getState(), tokenGeneration, uid);
    }
    if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
    if (readMetadata().pendingSharedHandoff && !readMetadata().conflictDomains.includes("sharedArtifact")) {
      await sharedWriteQueue;
      if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
      await syncPendingShared(uid, tokenGeneration);
    }
    if (!validCompletion(tokenGeneration, uid)) return { status: "cancelled" };
    const fresh = readMetadata();
    if (fresh.conflictDomains.length) syncStatus = "attention";
    else if (fresh.pendingDomains.length) syncStatus = syncStatus === "offline" ? "offline" : "pending";
    else {
      syncStatus = "verified";
      fresh.lastVerifiedAt = nowDate().toISOString();
      saveMetadata(fresh);
    }
    render();
    return { status: syncStatus };
  }

  function useCloudPlan() {
    if (!planConflict) return { status: "blocked" };
    const next = admitLocalState({ ...getState(), plan: clone(planConflict.remote) });
    persistAndAcceptState(next);
    const metadata = readMetadata();
    metadata.lastVerifiedRevisions.plan = planConflict.revision;
    metadata.conflictDomains = metadata.conflictDomains.filter((domain) => domain !== "plan");
    metadata.pendingDomains = metadata.pendingDomains.filter((domain) => domain !== "plan");
    saveMetadata(metadata);
    planConflict = null;
    planSummary = safePlanSummary(next.plan, nowDate());
    planStatus = "confirmed";
    syncStatus = metadata.conflictDomains.length
      ? "attention"
      : metadata.pendingDomains.length
        ? "pending"
        : "verified";
    render();
    return { status: "resolved" };
  }

  function keepLocalPlan() {
    if (!planConflict) return { status: "blocked" };
    const metadata = readMetadata();
    metadata.lastVerifiedRevisions.plan = planConflict.revision;
    metadata.conflictDomains = metadata.conflictDomains.filter((domain) => domain !== "plan");
    metadata.pendingDomains = orderedDomains([...metadata.pendingDomains, "plan"]);
    saveMetadata(metadata);
    planConflict = null;
    syncStatus = "pending";
    render();
    return { status: "pending" };
  }

  function getSetupActions() {
    return {
      continueWithGoogle,
      useAccount,
      useDifferentAccount: signOut,
      choosePlanFile,
      confirmPlanPreview,
      createRoom,
      redeemInvite,
      uploadAndVerify,
      openSchedule: () => routes.openSchedule?.(),
      openToday: () => routes.openToday?.(),
      previewExperience: () => routes.previewExperience?.(),
      openSetupHelp: () => routes.openSetupHelp?.(),
      exploreDemo: () => {
        const resumeClient = client ?? suspendedClient;
        disconnect();
        suspendedClient = resumeClient;
        mode = "demo";
        routes.enterDemo?.();
        render();
      },
      exitDemo: () => {
        const resumeClient = suspendedClient;
        suspendedClient = null;
        mode = "setup";
        if (resumeClient) connect(resumeClient);
        routes.exitDemo?.();
        render();
      },
      syncNow,
      exportLocalBackup: () => routes.exportLocalBackup?.(),
      replaceTeacherPlan: () => routes.replaceTeacherPlan?.(),
      signOut,
      useCloudPlan,
      keepLocalPlan,
      returnToSetup: () => routes.returnToSetup?.()
    };
  }

  try {
    const initialState = admitLocalState(getState());
    if (initialState.plan) {
      planSummary = safePlanSummary(initialState.plan, nowDate());
      planStatus = readMetadata().planConfirmed ? "confirmed" : "preview";
    }
  } catch {
    planSummary = null;
    planStatus = "missing";
  }

  return {
    connect,
    disconnect,
    destroy,
    getSetupModel,
    getSetupActions,
    getSyncPresentation,
    getRoomPresentation,
    afterLocalCommit,
    afterSharedHandoff,
    syncNow
  };
}
