function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const RESOURCE_APP_ORIGIN = "https://circ-hq.invalid";
const RESOURCE_APP_PATHS = new Set([
  "/",
  "/index.html",
  "/mission-control.html"
]);
const RESOURCE_SOURCES = new Set(["local", "authorized-cloud"]);

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

function hasUnsafeRawEncoding(value) {
  return /%(?![0-9a-f]{2})/i.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|20|23|25|2e|2f|3a|3f|5c|7f)/i.test(value);
}

function hasUnsafeRawPath(pathname, rejectInternalSegments) {
  if (!pathname || pathname.includes("%")) return true;
  const segments = pathname.split("/").filter(Boolean);
  return segments.some((segment) =>
    segment === "." ||
    segment === ".." ||
    (rejectInternalSegments && segment.startsWith("."))
  );
}

function splitRelativeHref(value) {
  const query = value.indexOf("?");
  const fragment = value.indexOf("#");
  const boundaries = [query, fragment].filter((index) => index !== -1);
  const pathEnd = boundaries.length ? Math.min(...boundaries) : value.length;
  return {
    rawPath: value.slice(0, pathEnd),
    suffix: value.slice(pathEnd)
  };
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
    hasUnsafeRawEncoding(value)
  ) return null;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(inspected)?.[1]?.toLowerCase() ?? null;
  if (scheme) {
    if (scheme !== "https") return null;
    try {
      const rawAbsolute = /^https:\/\/[^/?#]+([^?#]*)(?:[?#]|$)/i.exec(value);
      if (!rawAbsolute || hasUnsafeRawPath(rawAbsolute[1] || "/", false)) return null;
      const parsed = new URL(value);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) return null;
      return { href: parsed.href, external: true };
    } catch {
      return null;
    }
  }

  try {
    const { rawPath, suffix } = splitRelativeHref(value);
    const admittedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (
      hasUnsafeRawPath(admittedPath, true) ||
      !RESOURCE_APP_PATHS.has(admittedPath)
    ) return null;
    const parsed = new URL(value, `${RESOURCE_APP_ORIGIN}/`);
    if (
      parsed.origin !== RESOURCE_APP_ORIGIN ||
      parsed.pathname !== admittedPath ||
      `${parsed.search}${parsed.hash}` !== suffix
    ) return null;
    return {
      href: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      external: false
    };
  } catch {
    return null;
  }
}

export function admitResource(resource) {
  if (
    !isRecord(resource) ||
    typeof resource.id !== "string" || resource.id.trim() === "" ||
    typeof resource.title !== "string" || resource.title.trim() === "" ||
    (resource.visibility !== undefined && resource.visibility !== "teacher-private") ||
    (resource.validated !== undefined && resource.validated !== true) ||
    (resource.source !== undefined && !RESOURCE_SOURCES.has(resource.source))
  ) return null;

  const admittedHref = admittedResourceHref(resource.href);
  if (!admittedHref) return null;
  return {
    id: resource.id,
    title: resource.title,
    ...(resource.visibility === "teacher-private"
      ? { visibility: "teacher-private" }
      : {}),
    ...(admittedHref.href
      ? { href: admittedHref.href, external: admittedHref.external }
      : {}),
    ...(typeof resource.note === "string" ? { note: resource.note } : {}),
    ...(typeof resource.updatedAt === "string" ? { updatedAt: resource.updatedAt } : {})
  };
}

export function admitResourceState(state, { source = "local" } = {}) {
  const admittedSource = RESOURCE_SOURCES.has(source) ? source : null;
  const value = isRecord(state) ? structuredClone(state) : {};
  const admit = (resources) => admittedSource
    ? (Array.isArray(resources) ? resources : []).map(admitResource).filter(Boolean)
    : [];
  if (Object.hasOwn(value, "resources")) value.resources = admit(value.resources);
  if (isRecord(value.plan) && Object.hasOwn(value.plan, "resources")) {
    value.plan.resources = admit(value.plan.resources);
  }
  return value;
}

function findById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item?.id === id) ?? null;
}

function findPlanEvent(plan, id) {
  for (const teacher of Array.isArray(plan?.teachers) ? plan.teachers : []) {
    for (const events of Object.values(isRecord(teacher?.days) ? teacher.days : {})) {
      const match = findById(events, id);
      if (match) return match;
    }
  }
  return null;
}

function publicStrings(value) {
  return (Array.isArray(value) ? value : []).filter((item) => typeof item === "string");
}

function reviewedForBoard(value) {
  return isRecord(value) &&
    value.visibility === "classroom" &&
    value.reviewedForBoard === true;
}

function generatedCountdown(options, eventId) {
  const live = options?.liveCountdown;
  if (!isRecord(live)) return "";
  const keys = Object.keys(live).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "eventId" ||
    keys[1] !== "minutes" ||
    keys[2] !== "target" ||
    live.eventId !== eventId ||
    !Number.isInteger(live.minutes) ||
    live.minutes < 0 ||
    live.minutes > 1440 ||
    live.target !== "end"
  ) return "";
  return `${live.minutes}m to end`;
}

export function getAccessMode(session = {}) {
  if (!session.configured) return "local";
  if (!session.user?.uid) return "signed-out";
  if (session.requestedShared && session.membership?.trusted !== true) return "shared-blocked";
  if (session.membership?.trusted === true) return "teacher";
  return "private-sync";
}

export function buildBoardProjection(state, eventId, options = {}) {
  const source = isRecord(state) ? state : {};
  const event = findById(source.specialEvents, eventId) ?? findPlanEvent(source.plan, eventId) ?? {};
  if (event.type !== "teach") return {};
  const classroom = findById(source.classes, event.classId);
  const lesson = findById(source.lessonGuides, event.lessonGuideId);
  if (!reviewedForBoard(classroom) || !reviewedForBoard(lesson)) return {};
  return {
    classTitle: typeof classroom.title === "string" ? classroom.title : "",
    countdown: generatedCountdown(options, eventId),
    lessonTitle: typeof lesson.title === "string" ? lesson.title : "",
    materials: publicStrings(lesson.materials),
    directions: publicStrings(lesson.directions),
    ...(typeof lesson.objective === "string" ? { objective: lesson.objective } : {}),
    ...(typeof lesson.safety === "string" ? { safety: lesson.safety } : {}),
    ...(typeof lesson.cleanup === "string" ? { cleanup: lesson.cleanup } : {}),
    ...(typeof lesson.exitPrompt === "string" ? { exitPrompt: lesson.exitPrompt } : {}),
    currentProcessStep: typeof lesson.currentProcessStep === "string" ? lesson.currentProcessStep : ""
  };
}
