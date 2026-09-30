// Step icons shared by the teacher runner and the student page.
const RUNNER_WORK_ICON_RULES = Object.freeze([
  Object.freeze({ pattern: /\b(?:STORY|TOUR)\b|\bHOST THE DEMO\b/, icon: "chalkboard-teacher" }),
  Object.freeze({ pattern: /\b(?:JOBS|PARTNER|ROLES)\b|\bJOIN AND TEST\b/, icon: "student" }),
  Object.freeze({
    pattern: /\b(?:PLAN|CHOOSE|PREDICT)\b|\b(?:SET THE TEST|READ THE MODE|NAME THE PROBLEM|NAME ONE NEED)\b/,
    icon: "calendar-dots"
  }),
  Object.freeze({ pattern: /\b(?:READ|LEARN|WRITE|DRAW|SKETCH|ENCODE|RECORD|MAP|KEY|MESSAGE|COPY)\b/, icon: "books" }),
  Object.freeze({
    pattern: /\b(?:TEST|CHECK|OBSERVE|MEASURE|COMPARE|SURVEY|TRACE|DETECT|CHALLENGE|READINGS|DISPLAY|CLARIFY|LOOK|FIND|SAMPLE)\b/,
    icon: "presentation-chart"
  }),
  Object.freeze({ pattern: /\b(?:RUN|PLAY|REPEAT)\b|\bPOWER THE SIGNAL\b/, icon: "play-circle" }),
  Object.freeze({ pattern: /\b(?:FLOW|ROUTE|PATH|SEND|LOAD|FLOAT|DROP|CONNECT|JOIN)\b/, icon: "arrow-right" }),
  Object.freeze({
    pattern: /\b(?:BUILD|ASSEMBLE|MAKE|FIX|IMPROVE|ADJUST|CHANGE|REMOVE|REPAIR|RESHAPE|STRENGTHEN|SHAPE|TUNE|ADD|PLACE|SORT|MODEL|REDUCE|FINISH|DEBUG|SMOOTH|CLOSE)\b/,
    icon: "gear-six"
  })
]);

export function runnerStepIconFile(step) {
  const label = step.label.toUpperCase();
  if (step.kind === "safety" || /\bSAFE(?:TY|LY)?\b/.test(label)) return "warning-circle";
  if (step.kind === "ready") return "play-circle";
  if (step.kind === "exit") return "presentation-chart";
  if (step.kind === "transition") return /\b(?:RETURN|INSIDE)\b/.test(label) ? "house" : "arrow-right";
  if (step.kind === "cleanup") return "gear-six";
  const replicaIcons = {
    "REMEMBER SEPTEMBER 11": "chalkboard-teacher",
    "NOTICE CARE AND RECOVERY": "books",
    "DESIGN FOR SOMEONE": "calendar-dots",
    "MATCH MATERIALS": "calendar-dots",
    "TRY A LOOSE LAYOUT": "gear-six"
  };
  return replicaIcons[label] ?? RUNNER_WORK_ICON_RULES.find((rule) => rule.pattern.test(label))?.icon ?? "student";
}
