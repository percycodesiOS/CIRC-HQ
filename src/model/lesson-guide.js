const EMPTY_GUIDE = {
  title: "Current rotation guide",
  objective: "Use the current rotation script.",
  opening: "Name the goal and the first safe step.",
  steps: ["Use the current rotation script."],
  materials: [],
  safety: "Use only confirmed materials and demonstrated tools.",
  cleanup: "Return shared materials before transition.",
  transition: "Pause, reset the room, and name the next action.",
  exitPrompt: "What is the next confirmed step?",
  privateNote: ""
};

const TECH_TERRARIUM_GUIDE = {
  title: "Tech Terrarium",
  objective: "Build one safe shared feature and take ownership of the shared installation.",
  opening: "Today we will turn reclaimed materials into one useful shared feature.",
  steps: [
    "Choose one small feature for the shared installation.",
    "Plan how reclaimed or reused parts will fit together.",
    "Build with the safe tools demonstrated today.",
    "Test the feature and make one careful improvement.",
    "Add the finished part to the shared installation."
  ],
  materials: [
    "Reclaimed 3D prints",
    "Cardboard and reused materials",
    "Posca paint markers",
    "Teacher-controlled hot glue"
  ],
  safety: "Use safe tools only as demonstrated. Hot glue is adult-only unless a teacher gives direct control.",
  cleanup: "Use the five-minute cleanup to sort scraps, cap markers, and return tools.",
  transition: "Use a two-minute door decompression before the next class.",
  exitPrompt: "How did your feature improve the shared installation?",
  privateNote: "Add class-specific pacing, vocabulary, and planted questions before teaching."
};

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringList(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((entry) => typeof entry === "string");
}

function findGuide(event, state) {
  const guides = Array.isArray(state?.lessonGuides) ? state.lessonGuides : [];
  const exact = typeof event?.lessonGuideId === "string"
    ? guides.find((guide) => guide?.id === event.lessonGuideId)
    : null;
  if (exact) {
    return {
      guide: exact,
      source: exact.classId ? "class-specific" : "rotation"
    };
  }

  const classSpecific = guides.find((guide) =>
    typeof event?.classId === "string" &&
    guide?.classId === event.classId &&
    (guide.rotationId === undefined || guide.rotationId === event.rotationId)
  );
  if (classSpecific) return { guide: classSpecific, source: "class-specific" };

  const rotation = guides.find((guide) =>
    typeof event?.rotationId === "string" &&
    guide?.rotationId === event.rotationId &&
    !guide.classId
  );
  if (rotation) return { guide: rotation, source: "rotation" };

  if (event?.unitId === "tech-terrarium") {
    return { guide: TECH_TERRARIUM_GUIDE, source: "tech-terrarium-default" };
  }
  return { guide: EMPTY_GUIDE, source: "fallback" };
}

function confirmationGuide() {
  return {
    source: "confirmation-needed",
    title: "Administrative block",
    objective: "Confirm the assignment before treating this block as scheduled instruction.",
    opening: "This assignment still needs confirmation.",
    steps: ["Check the current assignment source.", "Use only confirmed directions."],
    materials: [],
    safety: "Do not invent an assignment or school directive.",
    cleanup: "Reset only the materials actually used.",
    transition: "Confirm the next scheduled block.",
    exitPrompt: "What assignment was confirmed?",
    privateNote: "",
    status: "Confirmation needed"
  };
}

export function buildLessonGuide(event = {}, state = {}) {
  if (event?.confirmation?.status === "needed") return confirmationGuide();

  const selected = findGuide(event, state);
  const guide = selected.guide;
  return {
    source: selected.source,
    title: stringValue(guide.title, EMPTY_GUIDE.title),
    objective: stringValue(guide.objective, EMPTY_GUIDE.objective),
    opening: stringValue(guide.opening, EMPTY_GUIDE.opening),
    steps: stringList(guide.steps, EMPTY_GUIDE.steps),
    materials: stringList(guide.materials, EMPTY_GUIDE.materials),
    safety: stringValue(guide.safety, EMPTY_GUIDE.safety),
    cleanup: stringValue(guide.cleanup, EMPTY_GUIDE.cleanup),
    transition: stringValue(guide.transition, EMPTY_GUIDE.transition),
    exitPrompt: stringValue(guide.exitPrompt, EMPTY_GUIDE.exitPrompt),
    privateNote: stringValue(guide.privateNote ?? guide.teacherNotes, EMPTY_GUIDE.privateNote),
    status: selected.source === "class-specific"
      ? stringValue(guide.status, "Ready")
      : "Needs class-specific detail"
  };
}
