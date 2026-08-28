const GENERIC_SECTIONS = [
  {
    title: "Morning setup",
    items: [
      "Open the room and identify the first confirmed block.",
      "Set out only the materials needed first.",
      "Check the display and one fallback option.",
      "Leave one clear landing space for incoming work."
    ]
  },
  {
    title: "Cleanup and dismissal",
    items: [
      "Stop building with enough time to sort shared materials.",
      "Reset work surfaces and walking paths.",
      "Confirm the next transition before dismissal."
    ]
  },
  {
    title: "Fast reset",
    items: [
      "Pause the room.",
      "Name one safe next action.",
      "Reduce materials or shorten the next step when needed."
    ]
  },
  {
    title: "Fallbacks",
    items: [
      "Technology: move to the offline version of the same goal.",
      "Shortened time: keep the opening, one build step, cleanup, and exit.",
      "Overstimulated room: lower voice load and reduce simultaneous choices.",
      "Missing materials: substitute a generic safe material or pause the build."
    ]
  },
  {
    title: "Substitute and handoff",
    items: [
      "Share the confirmed schedule and the simplest safe lesson route.",
      "Mark private links and internal references separately.",
      "Leave unresolved items as pending."
    ]
  },
  {
    title: "Pending building references",
    status: "Pending confirmation",
    items: [
      "Printing route and building-aide reminder",
      "WIN, Resource, and Clubs/Flex procedures"
    ]
  },
  {
    title: "Leave work at work",
    items: [
      "Capture one next action.",
      "Reset the first surface for tomorrow.",
      "Close the Playbook when the day is complete."
    ]
  }
];

const ROOM_APP_ORIGIN = "https://circ-hq.invalid";
const ROOM_PUBLIC_APP_PATHS = new Set([
  "/",
  "/index.html",
  "/mission-control.html",
  "/classroom-legacy.html"
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

function admittedHref(value) {
  if (value === undefined) return { safeHref: null, external: false };
  if (typeof value !== "string" || value === "" || value !== value.trim()) return null;
  const inspected = decodedForInspection(value);
  if (
    inspected === null ||
    /[\u0000-\u001f\u007f]/.test(inspected) ||
    inspected.includes("\\") ||
    inspected.startsWith("//")
  ) return null;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(inspected)?.[1]?.toLowerCase() ?? null;
  if (scheme) {
    if (scheme !== "https") return null;
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) return null;
      return { safeHref: parsed.href, external: true };
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(value, `${ROOM_APP_ORIGIN}/`);
    if (parsed.origin !== ROOM_APP_ORIGIN || !ROOM_PUBLIC_APP_PATHS.has(parsed.pathname)) return null;
    return {
      safeHref: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      external: false
    };
  } catch {
    return null;
  }
}

function admitPrivateResource(resource) {
  const hasRequiredFields = resource?.visibility === "teacher-private" &&
    resource.validated === true &&
    ["local", "authorized-cloud"].includes(resource.source) &&
    typeof resource.id === "string" && resource.id.trim() !== "" &&
    typeof resource.title === "string" && resource.title.trim() !== "";
  if (!hasRequiredFields) return null;
  const href = admittedHref(resource.href);
  if (!href) return null;
  return {
    id: resource.id,
    title: resource.title,
    ...(typeof resource.note === "string" ? { note: resource.note } : {}),
    ...(href.safeHref ? { safeHref: href.safeHref, external: href.external } : {})
  };
}

export function buildRoomView(state = {}) {
  const privateResources = (Array.isArray(state.resources) ? state.resources : [])
    .map(admitPrivateResource)
    .filter(Boolean);
  return {
    genericSections: structuredClone(GENERIC_SECTIONS),
    privateResources,
    privateResourceStatus: privateResources.length
      ? `${privateResources.length} private resources available`
      : "No private resources saved yet"
  };
}
