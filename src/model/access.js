function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item?.id === id) ?? null;
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
  const event = findById(source.specialEvents, eventId) ?? {};
  const classroom = findById(source.classes, event.classId) ?? {};
  const lesson = findById(source.lessonGuides, event.lessonGuideId) ?? {};
  return {
    classTitle: typeof classroom.title === "string" ? classroom.title : "",
    countdown: typeof event.countdown === "string" ? event.countdown : "",
    lessonTitle: typeof lesson.title === "string" ? lesson.title : "",
    materials: structuredClone(Array.isArray(lesson.materials) ? lesson.materials : []),
    directions: structuredClone(Array.isArray(lesson.directions) ? lesson.directions : []),
    currentProcessStep: typeof event.currentProcessStep === "string" ? event.currentProcessStep : ""
  };
}
