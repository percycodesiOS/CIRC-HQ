function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

export function buildBoardView(projection = {}) {
  return {
    mode: "account-free",
    classTitle: stringValue(projection.classTitle),
    countdown: stringValue(projection.countdown),
    lessonTitle: stringValue(projection.lessonTitle),
    objective: stringValue(projection.objective),
    steps: stringList(projection.steps ?? projection.directions),
    materials: stringList(projection.materials),
    safety: stringValue(projection.safety),
    cleanup: stringValue(projection.cleanup),
    exitPrompt: stringValue(projection.exitPrompt),
    currentProcessStep: stringValue(projection.currentProcessStep)
  };
}
