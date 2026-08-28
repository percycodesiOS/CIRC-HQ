import { buildLessonGuide } from "../model/lesson-guide.js";

function card(label, value, options = {}) {
  return {
    label,
    value: Array.isArray(value) ? [...value] : value,
    ...options
  };
}

export function buildCurriculumView(event, state = {}) {
  const guide = buildLessonGuide(event, state);
  return {
    title: guide.title,
    status: guide.status,
    source: guide.source,
    cards: [
      card("Objective", guide.objective),
      card("Say this", guide.opening),
      card("Do this", guide.steps),
      card("Materials", guide.materials),
      card("Safety", guide.safety),
      card("Cleanup", guide.cleanup),
      card("Transition", guide.transition),
      card("Exit", guide.exitPrompt),
      card("Private note", guide.privateNote, { visibility: "teacher-private" })
    ],
    legacyLibrary: {
      title: "Legacy Activity Library",
      count: 57,
      href: "classroom-legacy.html",
      opensSameOrigin: true
    }
  };
}

export function openLegacyActivityLibrary(openImpl = globalThis.open) {
  const href = "classroom-legacy.html";
  if (typeof openImpl === "function") openImpl(href, "_self");
  return href;
}
