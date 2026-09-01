import { admitResource } from "../model/access.js";

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

function admitPrivateResource(resource) {
  const admitted = admitResource(resource);
  if (!admitted) return null;
  return {
    id: admitted.id,
    title: admitted.title,
    ...(typeof admitted.note === "string" ? { note: admitted.note } : {}),
    ...(admitted.href
      ? { safeHref: admitted.href, external: admitted.external }
      : {})
  };
}

function safeCloudRoom(presentation) {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) return null;
  const status = ["missing", "owner", "member", "ready"].includes(presentation.status)
    ? presentation.status
    : "missing";
  const name = typeof presentation.name === "string" && presentation.name.trim() !== ""
    ? presentation.name.trim().slice(0, 80)
    : null;
  const role = ["owner", "teacher"].includes(presentation.role) ? presentation.role : null;
  const syncLabel = typeof presentation.syncLabel === "string" && presentation.syncLabel.trim() !== ""
    ? presentation.syncLabel.trim().slice(0, 80)
    : null;
  return { status, name, role, syncLabel };
}

export function buildRoomView(state = {}, cloudPresentation = null) {
  const privateResources = (Array.isArray(state.resources) ? state.resources : [])
    .map(admitPrivateResource)
    .filter(Boolean);
  return {
    genericSections: structuredClone(GENERIC_SECTIONS),
    privateResources,
    privateResourceStatus: privateResources.length
      ? `${privateResources.length} private resources available`
      : "No private resources saved yet",
    cloudRoom: safeCloudRoom(cloudPresentation)
  };
}
