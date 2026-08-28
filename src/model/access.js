function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

export function getAccessMode(session = {}) {
  if (!session.configured) return "local";
  if (!session.user?.uid) return "signed-out";
  if (session.requestedShared && session.membership?.trusted !== true) return "shared-blocked";
  if (session.membership?.trusted === true) return "teacher";
  return "private-sync";
}

export function buildBoardProjection(state, eventId) {
  const source = isRecord(state) ? state : {};
  const event = findById(source.specialEvents, eventId) ?? findPlanEvent(source.plan, eventId) ?? {};
  const classroom = findById(source.classes, event.classId) ?? {};
  const lesson = findById(source.lessonGuides, event.lessonGuideId) ?? {};
  return {
    classTitle: typeof classroom.title === "string" ? classroom.title : "",
    countdown: typeof event.countdown === "string" ? event.countdown : "",
    lessonTitle: typeof lesson.title === "string" ? lesson.title : "",
    materials: publicStrings(lesson.materials),
    directions: publicStrings(lesson.directions),
    ...(typeof lesson.objective === "string" ? { objective: lesson.objective } : {}),
    ...(typeof lesson.safety === "string" ? { safety: lesson.safety } : {}),
    ...(typeof lesson.cleanup === "string" ? { cleanup: lesson.cleanup } : {}),
    ...(typeof lesson.exitPrompt === "string" ? { exitPrompt: lesson.exitPrompt } : {}),
    currentProcessStep: typeof event.currentProcessStep === "string" ? event.currentProcessStep : ""
  };
}
