const EVENT_ID_PATTERN = /^event-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORBIDDEN_KEY_PARTS = Object.freeze([
  "roster",
  "guardian",
  "parent",
  "family",
  "email",
  "phone",
  "address",
  "account",
  "credential",
  "token",
  "profile",
  "gradebook",
  "grade",
  "score",
  "performance",
  "assessment",
  "attendance",
  "alias",
  "person",
  "pupil",
  "learner"
]);

export function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function hasExactKeys(value, allowed, required = allowed) {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  const requiredSet = required instanceof Set ? required : new Set(required);
  return keys.every((key) => allowedSet.has(key)) &&
    [...requiredSet].every((key) => Object.hasOwn(value, key));
}

export function isCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function isLocalDate(value) {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function isEventId(value) {
  return typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 64 &&
    EVENT_ID_PATTERN.test(value);
}

export function isLocalId(value) {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 64 &&
    LOCAL_ID_PATTERN.test(value);
}

export function isBoundedText(value, { max = 2000, allowEmpty = false, trimmed = true } = {}) {
  return typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.length > 0) &&
    (!trimmed || value === value.trim());
}

export function isOwnerKey(value) {
  if (value === "local:default") return true;
  return typeof value === "string" &&
    value.startsWith("teacher:") &&
    value.slice("teacher:".length).trim() !== "";
}

export function ownerKeyForTeacher(teacherId) {
  if (teacherId === null) return "local:default";
  if (typeof teacherId !== "string" || teacherId.trim() === "") {
    throw new TypeError("teacherId must be null or a nonempty string");
  }
  return `teacher:${teacherId}`;
}

function forbiddenFieldName(key) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "maxstudents" || normalized === "studentpiiallowed") return false;
  if (normalized === "uid" || normalized.endsWith("uid")) return true;
  if (normalized === "student" || normalized === "students" || normalized.startsWith("student")) {
    return true;
  }
  return FORBIDDEN_KEY_PARTS.some((part) => normalized.includes(part));
}

export function findForbiddenField(value) {
  const seen = new WeakSet();
  function visit(candidate) {
    if (candidate === null || typeof candidate !== "object") return null;
    if (seen.has(candidate)) return "cyclic-data";
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const found = visit(entry);
        if (found) return found;
      }
      return null;
    }
    if (!isPlainRecord(candidate)) return "non-plain-data";
    for (const [key, entry] of Object.entries(candidate)) {
      if (forbiddenFieldName(key)) return key;
      const found = visit(entry);
      if (found) return found;
    }
    return null;
  }
  return visit(value);
}

const RESOURCE_APP_ORIGIN = "https://circ-hq.invalid";
const RESOURCE_APP_PATHS = new Set(["/", "/index.html", "/mission-control.html"]);
const RESOURCE_INPUT_KEYS = new Set([
  "id", "title", "visibility", "href", "external", "note", "updatedAt", "validated", "source"
]);

function decodedForInspection(value) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  return decoded;
}

function unsafeRawPath(pathname, rejectInternalSegments) {
  if (!pathname || pathname.includes("%")) return true;
  return pathname.split("/").filter(Boolean).some((segment) =>
    segment === "." || segment === ".." || (rejectInternalSegments && segment.startsWith("."))
  );
}

function admittedResourceHref(value) {
  if (value === undefined) return { href: null, external: false };
  if (typeof value !== "string" || value === "" || value !== value.trim()) return null;
  const inspected = decodedForInspection(value);
  if (
    inspected === null ||
    /[\u0000-\u0020\u007f]/.test(inspected) ||
    inspected.includes("\\") ||
    inspected.startsWith("//") ||
    /%(?![0-9a-f]{2})/i.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|20|23|25|2e|2f|3a|3f|5c|7f)/i.test(value)
  ) return null;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(inspected)?.[1]?.toLowerCase() ?? null;
  if (scheme) {
    if (scheme !== "https") return null;
    try {
      const rawAbsolute = /^https:\/\/[^/?#]+([^?#]*)(?:[?#]|$)/i.exec(value);
      if (!rawAbsolute || unsafeRawPath(rawAbsolute[1] || "/", false)) return null;
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
        return null;
      }
      return { href: parsed.href, external: true };
    } catch {
      return null;
    }
  }

  const query = value.indexOf("?");
  const fragment = value.indexOf("#");
  const boundaries = [query, fragment].filter((index) => index !== -1);
  const pathEnd = boundaries.length ? Math.min(...boundaries) : value.length;
  const rawPath = value.slice(0, pathEnd);
  const suffix = value.slice(pathEnd);
  const admittedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  if (unsafeRawPath(admittedPath, true) || !RESOURCE_APP_PATHS.has(admittedPath)) return null;
  try {
    const parsed = new URL(value, `${RESOURCE_APP_ORIGIN}/`);
    if (
      parsed.origin !== RESOURCE_APP_ORIGIN ||
      parsed.pathname !== admittedPath ||
      `${parsed.search}${parsed.hash}` !== suffix
    ) return null;
    return { href: `${parsed.pathname}${parsed.search}${parsed.hash}`, external: false };
  } catch {
    return null;
  }
}

export function admitResource(resource) {
  if (!hasExactKeys(resource, RESOURCE_INPUT_KEYS, ["id", "title"])) return null;
  if (
    !isLocalId(resource.id) ||
    !isBoundedText(resource.title, { max: 300 }) ||
    (resource.visibility !== undefined && resource.visibility !== "teacher-private") ||
    (resource.validated !== undefined && resource.validated !== true) ||
    (resource.source !== undefined && !["local", "authorized-cloud"].includes(resource.source)) ||
    (resource.note !== undefined && !isBoundedText(resource.note, { max: 4000, allowEmpty: true, trimmed: false })) ||
    (resource.updatedAt !== undefined && !isCanonicalIso(resource.updatedAt))
  ) return null;
  const admittedHref = admittedResourceHref(resource.href);
  if (!admittedHref) return null;
  if (resource.external !== undefined && resource.external !== admittedHref.external) return null;
  return {
    id: resource.id,
    title: resource.title,
    ...(resource.visibility === "teacher-private" ? { visibility: "teacher-private" } : {}),
    ...(admittedHref.href ? { href: admittedHref.href, external: admittedHref.external } : {}),
    ...(resource.note !== undefined ? { note: resource.note } : {}),
    ...(resource.updatedAt !== undefined ? { updatedAt: resource.updatedAt } : {})
  };
}
