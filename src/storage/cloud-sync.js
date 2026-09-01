import { assertCloudDomainShape } from "./cloud-domains.js";

const PRIVATE_DOMAINS = Object.freeze(["plan", "progress", "preferences", "content"]);
const DOMAIN_PAYLOAD_KEYS = Object.freeze({
  plan: Object.freeze(["plan"]),
  progress: Object.freeze(["teacherProgress"]),
  preferences: Object.freeze(["preferences"]),
  content: Object.freeze([
    "checklist",
    "classes",
    "lessonGuides",
    "specialEvents",
    "resources",
    "notes",
    "tombstones"
  ])
});
const METADATA_KEYS = Object.freeze(["schemaVersion", "revision", "updatedAt", "updatedBy"]);

function unavailableResult(status) {
  return { status, revision: null, value: null };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function isSafeIdentifier(value) {
  return typeof value === "string" && value.trim() !== "" && !value.includes("/") && !value.includes("\\");
}

function isExpectedRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function privatePath(uid, domain) {
  return `playbookTeachers/${uid}/private/${domain}`;
}

function normalizeTimestamp(value) {
  if (!value || typeof value.toDate !== "function") return null;
  const date = value.toDate();
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function admittedEnvelope(domain, value, uid) {
  const payloadKeys = DOMAIN_PAYLOAD_KEYS[domain];
  if (
    !payloadKeys ||
    !hasExactKeys(value, [...METADATA_KEYS, ...payloadKeys]) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    value.updatedBy !== uid
  ) {
    throw new TypeError("cloud-envelope-invalid");
  }
  const updatedAt = normalizeTimestamp(value.updatedAt);
  if (updatedAt === null) throw new TypeError("cloud-envelope-invalid");
  const payload = Object.fromEntries(payloadKeys.map((key) => [key, value[key]]));
  return {
    payload: assertCloudDomainShape(domain, payload),
    revision: value.revision,
    updatedAt
  };
}

function authenticatedFor(firebase, uid) {
  if (!isSafeIdentifier(uid)) return false;
  try {
    const authenticatedUid = firebase?.currentUser?.()?.uid;
    return isSafeIdentifier(authenticatedUid) && authenticatedUid === uid;
  } catch {
    return false;
  }
}

function requestAllowed(firebase, uid, domain) {
  return authenticatedFor(firebase, uid) && isSafeIdentifier(domain) && PRIVATE_DOMAINS.includes(domain);
}

export function safeCloudFailureStatus(error) {
  const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
  if (
    code.includes("unavailable") ||
    code.includes("network") ||
    code.includes("offline") ||
    code.includes("timeout") ||
    code.includes("deadline-exceeded")
  ) return "offline";
  return "denied";
}

export function createPrivateCloudSync(firebase) {
  async function loadPrivateDomains(uid) {
    if (!authenticatedFor(firebase, uid)) {
      return { status: "denied", domains: null, revisions: null, updatedAt: null };
    }
    const domains = {};
    const revisions = {};
    const updatedAt = {};
    try {
      for (const domain of PRIVATE_DOMAINS) {
        const document = await firebase.getDocument(privatePath(uid, domain));
        if (document === null || document === undefined) {
          domains[domain] = null;
          revisions[domain] = 0;
          updatedAt[domain] = null;
          continue;
        }
        const admitted = admittedEnvelope(domain, document, uid);
        domains[domain] = admitted.payload;
        revisions[domain] = admitted.revision;
        updatedAt[domain] = admitted.updatedAt;
      }
      return { status: "loaded", domains, revisions, updatedAt };
    } catch (error) {
      return { status: safeCloudFailureStatus(error), domains: null, revisions: null, updatedAt: null };
    }
  }

  async function verifyPrivateDomain(uid, domain, expectedRevision) {
    if (!requestAllowed(firebase, uid, domain) || !isExpectedRevision(expectedRevision)) {
      return unavailableResult("denied");
    }
    try {
      const document = await firebase.getDocument(privatePath(uid, domain));
      if (document === null || document === undefined) {
        return { status: "conflict", revision: 0, value: null };
      }
      const admitted = admittedEnvelope(domain, document, uid);
      if (admitted.revision !== expectedRevision) {
        return { status: "conflict", revision: admitted.revision, value: admitted.payload };
      }
      return { status: "verified", revision: admitted.revision, value: admitted.payload };
    } catch (error) {
      return unavailableResult(safeCloudFailureStatus(error));
    }
  }

  async function savePrivateDomain(uid, domain, value, expectedRevision) {
    if (!requestAllowed(firebase, uid, domain) || !isExpectedRevision(expectedRevision)) {
      return unavailableResult("denied");
    }
    let admittedValue;
    try {
      admittedValue = assertCloudDomainShape(domain, value);
    } catch {
      return unavailableResult("denied");
    }
    const path = privatePath(uid, domain);
    try {
      const transactionResult = await firebase.runTransaction(async (transaction) => {
        const document = await transaction.get(path);
        let baseRevision = 0;
        let remoteValue = null;
        if (document !== null && document !== undefined) {
          const remote = admittedEnvelope(domain, document, uid);
          baseRevision = remote.revision;
          remoteValue = remote.payload;
        }
        if (baseRevision !== expectedRevision) {
          return { status: "conflict", revision: baseRevision, value: remoteValue };
        }
        const revision = expectedRevision + 1;
        transaction.set(path, {
          schemaVersion: 1,
          revision,
          updatedAt: firebase.serverTimestamp(),
          updatedBy: uid,
          ...admittedValue
        });
        return { status: "written", revision };
      });
      if (transactionResult?.status === "conflict") return transactionResult;
      if (transactionResult?.status !== "written") return unavailableResult("denied");
      return verifyPrivateDomain(uid, domain, transactionResult.revision);
    } catch (error) {
      return unavailableResult(safeCloudFailureStatus(error));
    }
  }

  return {
    loadPrivateDomains,
    savePrivateDomain,
    verifyPrivateDomain
  };
}
