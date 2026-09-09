import { admitLocalState, buildBoardProjection } from "./model/access.js";
import { buildAdminPlanDocument } from "./model/admin-plan.js";
import {
  applyEcmsAnnouncementOutline,
  applyPreparedEcmsAnnouncement,
  clearLocalAnnouncementDraft,
  evaluateAnnouncementDraft,
  hasAnnouncementScript,
  loadArchivedAnnouncementDraft,
  loadLocalAnnouncementArchive,
  loadLocalAnnouncementDraft,
  resetAnnouncementDraft,
  resetAnnouncementCrew,
  saveLocalAnnouncementDraft,
  saveDatedAnnouncementDraft,
  setAnnouncementCheck,
  setAnnouncementCrewCheck,
  setAnnouncementTeacherReview,
  updateAnnouncementDetails,
  updateAnnouncementCrewTime,
  updateAnnouncementSection
} from "./model/announcements.js";
import {
  EXPERIENCE_TIMING_PLANS,
  REPLICA_LESSON_CHOICES,
  getExperienceTimingPlan,
  getReplicaLessonChoice
} from "./model/experience-timing-plans.js";
import {
  advanceExperienceRunnerClock,
  applyExperienceRunnerAction,
  createExperienceRunner,
  getActiveRunnerStep,
  validateExperienceRunner
} from "./model/experience-runner.js";
import { PROJECTS, getProjectByNumber } from "./model/project-catalog.js";
import {
  addScheduleEvent,
  compileScheduleDraft,
  copyScheduleDay,
  createBlankScheduleDraft,
  createScheduleDraftFromPlan,
  duplicateScheduleEvent,
  editScheduleEvent,
  removeScheduleEvent
} from "./model/schedule-editor.js";
import { generateEventId } from "./model/schema-admission.js";
import {
  TECH_TERRARIUM_ARTIFACT_ID,
  createTechTerrariumArtifact,
  getCurrentContribution,
  recordArtifactHandoff,
  validateSharedArtifact
} from "./model/shared-artifact.js";
import { ownerKeyForTeacher } from "./model/state.js";
import { createWeatherService } from "./services/weather.js";
import { createCloudRuntimeController } from "./runtime/cloud-runtime.js";
import { createBrowserFirebaseClient, createFirebaseClient } from "./storage/firebase-adapter.js";
import { LocalStore } from "./storage/local-store.js";
import { buildBoardView } from "./ui/board.js";
import {
  buildAnnouncementsLiveView,
  buildAnnouncementsWorkflow
} from "./ui/announcements.js";
import { buildRoomView } from "./ui/room.js";
import { buildScheduleEditor } from "./ui/schedule-editor.js";
import { advanceProjectProgress, buildProjectHomeView } from "./ui/project-home.js";
import {
  applyPlanImport,
  applySettingsRestore,
  exportSettingsBackup,
  previewClosure,
  previewCycleDayOverride,
  previewMakeupDayStatus,
  previewPlanImport,
  previewSettingsRestore,
  previewSpecialEvent
} from "./ui/settings.js";
import { buildSetupHelpView, buildSetupView } from "./ui/setup.js";
import { buildTodayPresentation, buildWelcomePresentation } from "./ui/today-ui.js";
import { buildTodayViewModel } from "./ui/view-model.js";

function localhostName(hostname) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
}

export async function loadPrivateSeedOnLocalhost({
  hostname,
  fetchImpl = globalThis.fetch,
  store
}) {
  if (!localhostName(hostname)) {
    return { status: "not-localhost", state: store?.load?.().state ?? null, nextAction: null };
  }
  let planResponse;
  try {
    planResponse = await fetchImpl("/__private__/plan.json", { cache: "no-store" });
  } catch {
    return { status: "not-found", state: store.load().state, nextAction: null };
  }
  if (!planResponse?.ok) {
    return { status: "not-found", state: store.load().state, nextAction: null };
  }
  const planText = await planResponse.text();
  let source;
  try {
    source = JSON.parse(planText);
  } catch {
    return {
      status: "invalid-plan",
      state: store.load().state,
      nextAction: "Open Settings and choose a valid schedule file."
    };
  }

  let migrationOptions;
  if (source?.format === "playbook.teacherPlan.v1") {
    let optionsResponse;
    try {
      optionsResponse = await fetchImpl("/__private__/migration-options.json", { cache: "no-store" });
    } catch {
      optionsResponse = null;
    }
    if (!optionsResponse?.ok) {
      return {
        status: "migration-options-required",
        state: store.load().state,
        nextAction: "Open Settings and check the private migration options."
      };
    }
    try {
      migrationOptions = JSON.parse(await optionsResponse.text());
    } catch {
      return {
        status: "migration-options-required",
        state: store.load().state,
        nextAction: "Open Settings and check the private migration options."
      };
    }
  }

  const current = store.load().state.plan;
  const preview = previewPlanImport(current, planText, { migrationOptions });
  if (!preview.ok) {
    return {
      status: "preview-failed",
      state: store.load().state,
      nextAction: "Open Settings to review the schedule import problem."
    };
  }
  const applied = applyPlanImport(store, preview.previewToken);
  return applied.ok
    ? { status: "applied", state: applied.state, nextAction: null }
    : {
        status: "apply-failed",
        state: store.load().state,
        nextAction: "Open Settings and preview the schedule again."
      };
}

function element(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function snapshotAttributes(node) {
  if (!node?.attributes) return [];
  return Array.from(node.attributes, (attribute) =>
    Array.isArray(attribute)
      ? [attribute[0], attribute[1]]
      : [attribute.name, attribute.value]
  );
}

function restoreAttributes(node, snapshot) {
  if (!node?.attributes) return;
  for (const attribute of Array.from(node.attributes)) {
    node.removeAttribute(Array.isArray(attribute) ? attribute[0] : attribute.name);
  }
  for (const [name, value] of snapshot) node.setAttribute(name, value);
}

function buildHeading(model, onBoard) {
  const boardButton = element("button", {
    className: "board-button",
    text: "Open Board",
    attributes: { type: "button" }
  });
  boardButton.addEventListener("click", onBoard);
  const cycle = model.cycle.day ? `Day ${model.cycle.day}` : "No cycle day";
  return element("div", { className: "page-heading" }, [
    element("div", {}, [
      element("h1", { text: "Today" }),
      element("p", { className: "date-line", text: model.clock.dateLabel }),
      element("p", { className: "day-clock" }, [
        element("span", { text: cycle }),
        element("span", {
          className: "clock-value",
          text: model.clock.timeLabel,
          attributes: { "data-live-clock": "" }
        })
      ])
    ]),
    boardButton
  ]);
}

function welcomeRoute(actions) {
  const presentation = buildWelcomePresentation();
  const setup = element("button", {
    className: "primary-action welcome-primary",
    text: presentation.setupAction,
    attributes: { type: "button" }
  });
  setup.addEventListener("click", actions.openSchedule);
  const sync = element("button", {
    className: "secondary-action welcome-secondary",
    text: presentation.syncAction,
    attributes: { type: "button" }
  });
  sync.addEventListener("click", actions.openCloudSetup);
  const preview = element("button", {
    className: "welcome-preview-action",
    text: presentation.previewAction,
    attributes: { type: "button" }
  });
  preview.addEventListener("click", actions.openPreview);
  return element("section", {
    className: "welcome-view",
    attributes: { "data-view": "welcome" }
  }, [
    element("img", {
      className: "welcome-maker",
      attributes: {
        src: "assets/circ-hq-maker.webp",
        alt: "An open playbook growing into colorful maker tools, nature, water, circuitry, and a friendly gear",
        width: "1254",
        height: "1254"
      }
    }),
    element("div", { className: "welcome-copy" }, [
      element("p", { className: "eyebrow", text: presentation.eyebrow }),
      element("h1", { text: presentation.title }),
      element("p", { className: "welcome-description", text: presentation.description }),
      element("div", { className: "welcome-actions" }, [setup, sync, preview]),
      element("p", { className: "welcome-privacy", text: "Schedules stay private to the signed-in teacher." })
    ])
  ]);
}

function buildTeacherPicker(model, onSelect) {
  const children = [element("span", { text: "Teacher view" })];
  for (const teacher of model.teacher.options) {
    const button = element("button", {
      text: teacher.name,
      attributes: {
        type: "button",
        "aria-pressed": String(model.teacher.selected?.id === teacher.id)
      }
    });
    button.addEventListener("click", () => onSelect(teacher.id));
    children.push(button);
  }
  return element("div", {
    className: "teacher-picker",
    attributes: { "aria-label": "Teacher view" }
  }, children);
}

function buildPlanNotice(presentation, navigate, detail = "") {
  const button = element("button", {
    className: "primary-action",
    text: presentation.actionLabel,
    attributes: { type: "button" }
  });
  button.addEventListener("click", () => navigate("settings"));
  return element("section", { className: "setup-card" }, [
    element("h2", { text: presentation.title }),
    detail ? element("p", { text: detail }) : null,
    button
  ]);
}

function buildPrivateSeedRecovery(detail, navigate) {
  const button = element("button", {
    className: "secondary-action",
    text: "Open Settings",
    attributes: { type: "button" }
  });
  button.addEventListener("click", () => navigate("settings"));
  return element("section", {
    className: "private-seed-recovery",
    attributes: { role: "status", "aria-live": "polite" }
  }, [
    element("p", { text: detail }),
    button
  ]);
}

const WEATHER_ICON_FILES = Object.freeze({
  sun: "sun",
  "partly-cloudy": "cloud-sun",
  cloud: "cloud",
  rain: "cloud-rain",
  snow: "snowflake",
  storm: "cloud-lightning",
  unavailable: "warning-circle"
});

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

function imageIcon(name, label, className = "action-icon") {
  return element("img", {
    className,
    attributes: {
      src: `assets/icons/${name}.svg`,
      alt: label,
      role: label ? "img" : null,
      "aria-label": label || null
    }
  });
}

function weatherIcon(icon) {
  const file = WEATHER_ICON_FILES[icon?.name] ?? WEATHER_ICON_FILES.unavailable;
  return imageIcon(file, icon?.label ?? "Weather unavailable", `weather-icon weather-icon-${icon?.name ?? "unavailable"}`);
}

function buildNowCard(now) {
  const timing = [];
  if (now.endLabel) timing.push(element("span", { text: `Ends ${now.endLabel}` }));
  if (now.countdown) timing.push(element("strong", { text: now.countdown }));
  return element("section", { className: "now-card" }, [
    element("p", { className: "card-label", text: "NOW" }),
    element("h2", { text: now.title }),
    element("div", { className: "now-timing" }, timing)
  ]);
}

function buildNextCard(next) {
  return element("section", { className: "next-card" }, [
    element("p", { className: "card-label", text: "NEXT" }),
    element("h2", { text: next.title }),
    next.startLabel ? element("p", { className: "card-meta", text: next.startLabel }) : null
  ]);
}

export function buildWeatherCard(weather) {
  const copy = weather.status === "unavailable"
    ? [element("p", { className: "weather-unavailable", text: weather.label })]
    : [
        element("strong", { className: "weather-temp", text: weather.temperature }),
        element("span", { className: "weather-feels", text: `Feels ${weather.feelsLike}` }),
        element("span", { className: "weather-condition", text: weather.condition }),
        weather.caveat
          ? element("span", { className: "weather-caveat", text: weather.caveat })
          : null
      ];
  return element("section", {
    className: `weather-card ${weather.status}`,
    attributes: {
      "aria-label":
        weather.status === "stale"
          ? "Current weather. Updated earlier."
          : "Current weather"
    }
  }, [weatherIcon(weather.icon), element("div", { className: "weather-copy" }, copy)]);
}

function buildDutyCard(duty) {
  if (!duty) return null;
  return element("section", { className: `duty-card ${duty.state}` }, [
    element("p", { className: "card-label", text: duty.state === "active" ? "DUTY NOW" : "DUTY SOON" }),
    element("h2", { text: duty.title }),
    element("p", { className: "card-meta", text: [duty.assignment, duty.location].filter(Boolean).join(" | ") })
  ]);
}

function buildTimeline(timeline, onToggle) {
  const button = element("button", {
    className: "timeline-toggle",
    text: timeline.controlLabel,
    attributes: {
      type: "button",
      "aria-expanded": String(timeline.expanded),
      "aria-controls": "full-day-list"
    }
  });
  button.addEventListener("click", onToggle);
  const children = [button];
  if (timeline.expanded) {
    const list = element("div", { className: "timeline", attributes: { id: "full-day-list" } });
    for (const entry of timeline.rows) {
      list.append(element("article", { className: `timeline-row ${entry.state}` }, [
        element("div", { className: "timeline-time", text: entry.timeLabel }),
        element("div", { className: "timeline-title", text: entry.title }),
        entry.stateCue ? element("span", { className: "timeline-state", text: entry.stateCue }) : null
      ]));
    }
    children.push(list);
  }
  return element("section", { className: "full-day" }, children);
}

function actionButton(label, className, onClick, iconName = null) {
  const children = [element("span", { text: label })];
  if (iconName) children.push(imageIcon(iconName, "", "button-icon"));
  const button = element("button", {
    className,
    attributes: { type: "button" }
  }, children);
  button.addEventListener("click", onClick);
  return button;
}

function downloadAdminPlan(project) {
  const documentText = buildAdminPlanDocument(project);
  const blob = new Blob([documentText], { type: "text/html;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = element("a", {
    attributes: {
      href,
      download: `CIRC-${project.id}-admin-plan.html`
    }
  });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function buildProjectHero(view, actions) {
  const project = view.currentProject;
  const artwork = projectArtwork(project, "project-hero-art")
  return element("section", { className: "project-hero" }, [
    artwork,
    element("div", { className: "project-hero-copy" }, [
      element("p", { className: "project-kicker", text: view.projectLabel }),
      element("h2", { className: "project-title", text: project.title }),
      element("p", { className: "project-strapline", text: project.strapline }),
      view.previewOnly
        ? element("div", { className: "preview-launch" }, [
            element("p", {
              className: "preview-only-note",
              text: "Preview only. Nothing is saved."
            }),
            actionButton("Preview experience", "project-run-button", () => actions.openRunner(project.number), "arrow-right")
          ])
        : element("div", { className: "project-launch-actions" }, [
            actionButton("Preview lesson", "secondary-action", () => actions.openConfiguredPreview(project.number)),
            actionButton(view.actions.run, "project-run-button", () => actions.openRunner(project.number), "arrow-right")
          ])
    ]),
    element("div", { className: "project-quick-actions" }, [
      actionButton(view.actions.teacher, "project-quick-button", () => actions.openTeacher(project.number), "presentation-chart"),
      actionButton(view.actions.student, "project-quick-button", () => actions.openStudent(project.number), "student")
    ])
  ]);
}

function projectArtwork(project, className) {
  return project.number === 2 && !project.replicaLesson
    ? element("img", {
        className,
        attributes: {
          src: "assets/tech-terrarium-hero.webp",
          alt: "A student-built technology terrarium with rocks, plants, tools, and electronic parts",
          width: "1400",
          height: "875"
        }
      })
    : null;
}

function buildIndependencePath(view) {
  const stages = view.independencePath.map((stage, index) => element("li", {
    className: `independence-stage${stage.active ? " active" : ""}${stage.complete ? " complete" : ""}`,
    attributes: { "aria-current": stage.active ? "step" : null }
  }, [
    element("span", { className: "stage-number", text: index + 1 }),
    element("span", { className: "stage-label", text: stage.label })
  ]));
  return element("section", { className: "independence-section" }, [
    element("p", { className: "section-kicker", text: "The independence path" }),
    element("h2", { text: "From watch me to student studio" }),
    element("ol", { className: "independence-path" }, stages)
  ]);
}

function buildProjectTrail(view, actions) {
  const steps = view.trail.map((step) => {
    const button = element("button", {
      className: `project-trail-step ${step.state}`,
      text: step.number,
      attributes: {
        type: "button",
        title: `Experience ${step.number}: ${step.title}`,
        "aria-label": `Experience ${step.number}: ${step.title}, ${step.state}`,
        "aria-current": step.state === "current" ? "step" : null
      }
    });
    button.addEventListener("click", () => actions.openTeacher(step.number));
    return element("li", {}, [button]);
  });
  return element("section", { className: "project-trail-section" }, [
    element("p", { className: "section-kicker", text: "The 36-experience year map" }),
    element("div", { className: "trail-heading" }, [
      element("h2", { text: "Your 36-experience year map" }),
      actionButton("Open Playbooks", "trail-link", () => actions.navigate("projects"))
    ]),
    element("ol", {
      className: "project-trail",
      attributes: { "aria-label": "All 36 experiences" }
    }, steps)
  ]);
}

function buildFastFinish(view) {
  const image = view.currentProject.number === 2
    ? element("img", {
        className: "fast-finish-art",
        attributes: {
          src: "assets/designers-challenge-sketch.webp",
          alt: "A design sketch for improving the technology terrarium",
          width: "480",
          height: "300"
        }
      })
    : null;
  return element("section", { className: "fast-finish-card" }, [
    image,
    element("div", { className: "fast-finish-copy" }, [
      element("p", { className: "section-kicker", text: "Fast finish" }),
      element("h2", { text: view.fastFinish.title }),
      element("p", { text: view.fastFinish.directions })
    ])
  ]);
}

function formatRunnerTime(seconds) {
  const safeSeconds = Number.isInteger(seconds) && seconds >= 0 ? seconds : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function runnerTimerCard(label, seconds, timerKey, className = "") {
  return element("section", { className: `runner-timer-card ${className}`.trim() }, [
    element("p", { className: "runner-timer-label", text: label }),
    element("strong", {
      className: "runner-timer-value",
      text: formatRunnerTime(seconds),
      attributes: { "data-runner-timer": timerKey }
    })
  ]);
}

function runnerStudentDirections(step) {
  const list = element("ol", { className: "runner-student-directions" });
  for (const direction of step.directions) {
    list.append(element("li", { text: direction }));
  }
  return list;
}

function runnerTeacherDirections(step) {
  const directions = step.teacher?.directions;
  if (Array.isArray(directions)) return directions;
  return typeof directions === "string" ? [directions] : [];
}

function runnerCue(label, content, className = "") {
  const body = Array.isArray(content) ? textList(content, "runner-cue-list") : element("p", { text: content });
  return element("section", { className: `runner-cue ${className}`.trim() }, [
    element("h3", { text: label }),
    body
  ]);
}

function runnerCommandBar(step, runner, controls = [], { student = false } = {}) {
  const timer = runner.timer;
  const ariaLabel = student || controls.length === 0
    ? "Live lesson timers"
    : "Live lesson controls and timers";
  return element("section", {
    className: `runner-command-bar${student ? " runner-student-command-bar" : ""}${controls.length ? "" : " no-controls"}`,
    attributes: { "aria-label": ariaLabel }
  }, [
    element("div", { className: "runner-command-step" }, [
      element("span", {
        text: `Step ${timer.currentStepIndex + 1} of ${runner.steps.length}`
      }),
      element("strong", { text: step.label })
    ]),
    element("div", { className: "runner-command-timers" }, [
      runnerTimerCard("Step timer", timer.currentStepRemainingSeconds, "step", "runner-step-timer"),
      runnerTimerCard("Class timer", timer.totalRemainingSeconds, "class")
    ]),
    controls.length
      ? element("div", { className: "runner-controls runner-command-controls" }, controls)
      : null
  ].filter(Boolean));
}

function runnerStepRail(runner) {
  const activeIndex = runner.timer.currentStepIndex;
  const lessonComplete = runner.timer.status === "complete";
  const finishedAtLastStep = lessonComplete && activeIndex === runner.steps.length - 1;
  const items = runner.steps.map((step, index) => {
    const state = finishedAtLastStep || index < activeIndex
      ? "complete"
      : index === activeIndex
        ? lessonComplete ? "ended" : "active"
        : "upcoming";
    const stateLabel = state === "complete"
      ? "Done"
      : state === "active"
        ? "Now"
        : state === "ended"
          ? "Ended here"
          : "Next";
    return element("li", {
      className: `runner-step-rail-item ${state}`,
      attributes: { "aria-current": state === "active" || state === "ended" ? "step" : null }
    }, [
      imageIcon(runnerStepIconFile(step), "", "runner-step-icon"),
      element("span", { className: "runner-step-copy" }, [
        element("strong", { text: `${index + 1}. ${step.label}` }),
        element("span", { text: `${step.minutes} min | ${stateLabel}` })
      ])
    ]);
  });
  return element("section", { className: "runner-step-rail-wrap" }, [
    element("div", { className: "runner-step-rail-heading" }, [
      element("p", { className: "section-kicker", text: "Lesson path" }),
      element("strong", { text: `${activeIndex + 1} of ${runner.steps.length} steps` })
    ]),
    element("ol", {
      className: "runner-step-rail",
      attributes: { "aria-label": "All timed lesson steps" }
    }, items)
  ]);
}

function runnerMoreContext(project) {
  return element("details", { className: "runner-more-context" }, [
    element("summary", { text: "More context" }),
    element("section", {}, [
      element("h3", { text: "Objective" }),
      element("p", { text: project.objective })
    ]),
    element("section", {}, [
      element("h3", { text: "Materials" }),
      textList(project.materials)
    ]),
    element("section", {}, [
      element("h3", { text: "Safety" }),
      element("p", { text: project.safety })
    ]),
    element("section", {}, [
      element("h3", { text: "Teacher context" }),
      textList([...project.teacherSay, ...project.teacherDo])
    ])
  ]);
}

function runnerDetour(detour) {
  return element("section", { className: "runner-detour", attributes: { role: "status" } }, [
    element("div", {}, [
      element("p", { className: "section-kicker", text: "Question Detour" }),
      element("h2", { text: "Discuss the question" }),
      element("p", { text: "Class clock keeps running. Step time is held." })
    ]),
    runnerTimerCard("Discussion timer", detour.remainingSeconds, "detour", "runner-detour-timer")
  ]);
}

function formatScheduleClock(minutes) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function runnerSchedule(current) {
  if (current?.type !== "teach" || !Number.isInteger(current.endMinutes)) return null;
  return {
    endLabel: formatScheduleClock(current.endMinutes),
    cleanupLabel: formatScheduleClock(current.endMinutes - 6)
  };
}

function sharedArtifactCard(context, actions) {
  if (!context) return null;
  const statusLabel = context.status === "complete"
    ? "Artifact complete"
    : context.status === "parked"
      ? "Artifact parked"
      : "Artifact active";
  const children = [
    element("div", { className: "artifact-heading" }, [
      element("div", {}, [
        element("p", { className: "section-kicker", text: "Shared Tech Terrarium" }),
        element("h2", { text: context.stageTitle })
      ]),
      element("span", { className: `artifact-status artifact-status-${context.status}`, text: statusLabel })
    ]),
    element("p", { className: "artifact-contribution-label", text: "Current contribution" }),
    element("p", { className: "artifact-contribution", text: context.contributionTitle }),
    context.classLabel
      ? element("span", { className: "artifact-class-chip", text: context.classLabel })
      : null
  ];

  if (context.controlsEnabled && context.pendingHandoff) {
    children.push(element("section", {
      className: "artifact-confirmation",
      attributes: { role: "status", "aria-live": "polite" }
    }, [
      element("p", { text: `Confirm ${context.pendingHandoff} for this class visit?` }),
      element("div", { className: "artifact-confirmation-actions" }, [
        actionButton("Confirm handoff", "primary-action", actions.confirmArtifactHandoff),
        actionButton("Cancel", "secondary-action", actions.cancelArtifactHandoff)
      ])
    ]));
  } else if (context.controlsEnabled) {
    children.push(element("div", {
      className: "artifact-handoff-controls",
      attributes: { "aria-label": "Shared artifact handoff" }
    }, [
      actionButton("Ready", "artifact-handoff artifact-ready", () => actions.chooseArtifactHandoff("ready")),
      actionButton("Repeat", "artifact-handoff artifact-repeat", () => actions.chooseArtifactHandoff("repeat")),
      actionButton("Park", "artifact-handoff artifact-park", () => actions.chooseArtifactHandoff("park"))
    ]));
  }

  return element("section", { className: "shared-artifact-card" }, children.filter(Boolean));
}

function replicaProjectContext(project, runner) {
  const choice = project.number === 2 ? getReplicaLessonChoice(runner?.modeId) : null;
  if (!choice) return project;
  return {
    ...project,
    replicaLesson: true,
    title: choice.title,
    objective: choice.objective,
    materials: choice.materials,
    safety: choice.safety,
    teacherSay: [],
    teacherDo: choice.teacherContext,
    fastFinish: { title: "Check and hand off", directions: choice.fastFinish }
  };
}

function replicaLessonChooser(actions) {
  const choiceCard = (choice) => element("article", { className: "replica-lesson-choice" }, [
    actionButton(choice.label, "primary-action replica-lesson-button", () => actions.openRunner(2, { modeId: choice.id })),
    element("p", { text: choice.summary })
  ]);
  const currentLesson = (resin) => actions.currentReplicaLesson && (actions.currentReplicaLesson.id === "replica-resin") === resin
    ? element("div", { className: "replica-current-lesson" }, [
      element("p", { text: `Current lesson: ${actions.currentReplicaLesson.title}. Reopen it to continue, or explicitly reset it for a new class.` }),
      actionButton("Start this lesson for a new class", "secondary-action", () => actions.openRunner(2, { modeId: actions.currentReplicaLesson.id, restart: true }))
    ]) : null;
  return element("div", { className: "replica-unit-choices" }, [
    element("section", {
      className: "replica-lessons",
      attributes: { "aria-labelledby": "replica-lessons-heading" }
    }, [
      element("p", { className: "section-kicker", text: "Tech Terrarium lesson choices" }),
      element("h2", { text: "Ehrman Crest replica lessons", attributes: { id: "replica-lessons-heading" } }),
      element("p", { text: "School aerial view at the front; rocks, lizard habitat and technology at the back. Preserve the habitat and check the aerial reference before placing school features." }),
      element("p", { text: "Choose the lesson your crew needs. Each lesson plan totals 35 minutes; during a scheduled class, the class clock uses its remaining time. Opening the same choice keeps its current step; replacing a different lesson requires confirmation." }),
      element("div", { className: "replica-lesson-choices" }, REPLICA_LESSON_CHOICES.filter((choice) => choice.id !== "replica-resin").map(choiceCard)),
      element("p", { text: "Ready to build with cardboard? Choose Day 4. Students assemble with tape and tabs while the teacher manages the hot-glue station. Resin is not required for this school-model lesson." }),
      currentLesson(false),
      actionButton("Original Tech Terrarium", "secondary-action", () => actions.openRunner(2, { modeId: "build-new" })),
      element("details", { className: "replica-operation-notes" }, [
        element("summary", { text: "Daily preparation" }),
        element("p", { text: "Announcement crew arrives by 8:50 a.m.; the 8:55 broadcast targets three minutes including the opening, silence, Pledge and closing. On Day 4, prepare and finalize all announcements for the following week. Select actual broadcast dates yourself; this does not change the school rotation or calendar." })
      ])
    ]),
    element("section", {
      className: "replica-lessons",
      attributes: { "aria-labelledby": "standalone-resin-heading" }
    }, [
      element("p", { className: "section-kicker", text: "Separate CIRC unit" }),
      element("h2", { text: "Standalone resin unit", attributes: { id: "standalone-resin-heading" } }),
      element("p", { text: "All 670 students across five cycle days. Design a small individual game or art piece. Reuse dry stations between classes; keep the adult casting and full-cure schedule separate from the class clock and the Tech Terrarium." }),
      element("div", { className: "replica-lesson-choices" }, REPLICA_LESSON_CHOICES.filter((choice) => choice.id === "replica-resin").map(choiceCard)),
      currentLesson(true)
    ])
  ]);
}

function experienceRunnerRoute(project, runner, actions, artifactContext = null) {
  project = replicaProjectContext(project, runner);
  if (project.replicaLesson) artifactContext = null;
  const timer = runner.timer;
  if (timer.status === "complete") {
    const stoppedStep = runner.steps[timer.currentStepIndex] ?? { label: "Lesson complete" };
    return element("section", {
      className: "experience-runner",
      attributes: { "data-view": "experience-runner" }
    }, [
      runnerCommandBar(stoppedStep, runner),
      element("div", { className: "runner-heading" }, [
        element("p", { className: "project-kicker", text: `Experience ${project.number} of ${PROJECTS.length}` }),
        element("h1", { text: "Lesson complete" }),
        element("p", { text: `${project.title} is complete. Both timers have stopped.` }),
        project.replicaLesson ? actionButton("Start this lesson for a new class", "primary-action", () => actions.openRunner(2, { modeId: runner.modeId, restart: true })) : null,
        actionButton("Back to Today", "primary-action", () => actions.navigate("today"))
      ]),
      sharedArtifactCard(artifactContext, actions),
      runnerStepRail(runner)
    ]);
  }
  const step = getActiveRunnerStep(runner, { teacherKey: actions.teacherKey });
  const paused = timer.status === "paused";
  const ready = timer.status === "ready";
  const expired = timer.status === "step-expired";
  const detourActive = runner.detour?.status === "active";
  const lastStep = timer.currentStepIndex === runner.steps.length - 1;
  const primaryControl = actionButton(
    ready ? "Start class" : paused ? "Resume" : "Pause",
    "runner-control runner-primary-control",
    () => actions.applyRunnerAction(ready ? "start" : paused ? "resume" : "pause")
  );
  const controls = detourActive
      ? [
          actionButton("Add 2 minutes", "runner-control", () => actions.applyRunnerAction("add-detour-time")),
          actionButton("Return to build", "runner-control runner-primary-control", () => actions.applyRunnerAction("return-to-build")),
          actionButton("Safe Landing", "runner-control runner-safe-landing", () => actions.applyRunnerAction("safe-landing"))
        ]
      : ready
        ? [primaryControl]
        : [
            primaryControl,
            actionButton("+1 min", "runner-control", () => actions.applyRunnerAction("add-minute")),
            actionButton("Previous", "runner-control", () => actions.applyRunnerAction("previous")),
            actionButton(lastStep ? "Finish Lesson" : "Next Step", "runner-control runner-next", () => actions.applyRunnerAction(lastStep ? "finish" : "next"))
          ];
  const supportControls = paused || ready || detourActive
    ? []
    : [actionButton("Question Detour", "runner-control runner-detour-control", () => actions.applyRunnerAction("start-detour"))];
  const teacherDirections = runnerTeacherDirections(step);
  const teacherAction = teacherDirections.length > 0
    ? runnerCue("Teacher action", teacherDirections)
    : null;
  const studentDirections = step.directions;
  const artwork = projectArtwork(project, "runner-focus-art");
  return element("section", {
    className: "experience-runner",
    attributes: { "data-view": "experience-runner" }
  }, [
    runnerCommandBar(step, runner, controls),
    element("div", { className: "runner-heading" }, [
      actionButton("Back to Today", "detail-back", () => actions.navigate("today")),
      element("p", { className: "project-kicker", text: `Experience ${project.number} of ${PROJECTS.length}` }),
      element("h1", { text: project.title }),
      actions.previewOnly
        ? element("p", { className: "runner-preview-label", text: "Preview only" })
        : element("p", { className: "runner-device-owner", text: "This device is running the class" }),
      actionButton("Student directions", "primary-action runner-student-action", () => actions.openStudent(project.number), "student"),
      project.replicaLesson ? actionButton("Start this lesson for a new class", "secondary-action", () => actions.openRunner(2, { modeId: runner.modeId, restart: true })) : null
    ]),
    actions.schedule ? element("div", { className: "runner-schedule" }, [
      element("strong", { text: `Class ends at ${actions.schedule.endLabel}` }),
      element("span", { text: `Cleanup begins at ${actions.schedule.cleanupLabel}` })
    ]) : null,
    detourActive ? runnerDetour(runner.detour) : null,
    expired ? element("p", {
      className: "runner-expired",
      text: detourActive
        ? "Step time is up. Return to build or choose Safe Landing."
        : "Step time is up. Choose Next Step when the class is ready.",
      attributes: { role: "alert" }
    }) : null,
    element("div", { className: `runner-focus-layout${artwork ? "" : " no-art"}` }, [
      element("section", { className: "runner-step-card" }, [
        element("p", { className: "section-kicker", text: `Step ${timer.currentStepIndex + 1} of ${runner.steps.length}` }),
        element("h2", { text: step.label }),
        element("div", { className: "runner-now-grid" }, [
          element("section", { className: "runner-cue runner-student-card" }, [
            element("h3", { text: "Students" }),
            runnerStudentDirections(step)
          ]),
          teacherAction,
          element("details", { className: "runner-teacher-help" }, [
            element("summary", { text: "More teacher help" }),
            element("div", { className: "runner-teacher-help-grid" }, [
              runnerCue(
                "Done when",
                `Students have completed ${studentDirections.length === 1 ? "this direction" : `all ${studentDirections.length} directions`} and can show the result.`
              ),
              runnerCue("If stuck", "Pause. Model one example. Restart with one team."),
              runnerCue("Finished early", [project.fastFinish.title, project.fastFinish.directions]),
              runnerCue("Return to the build", "Good question. Let us test it while we keep building.", "runner-return-cue")
            ])
          ])
        ]),
        runnerMoreContext(project)
      ]),
      artwork
    ].filter(Boolean)),
    supportControls.length
      ? element("div", { className: "runner-support-controls" }, supportControls)
      : null,
    runnerStepRail(runner),
    sharedArtifactCard(artifactContext, actions)
  ].filter(Boolean));
}

function studentRunnerRoute(project, runner, actions) {
  project = replicaProjectContext(project, runner);
  const step = getActiveRunnerStep(runner, { teacherKey: actions.teacherKey });
  const timer = runner.timer;
  return element("section", {
    className: "board-view project-student-view runner-student-view",
    attributes: { "data-view": "project-student" }
  }, [
    runnerCommandBar(step, runner, [], { student: true }),
    element("div", { className: "board-heading" }, [
      element("p", { className: "eyebrow", text: "Student directions" }),
      element("h1", { text: project.title }),
      actions.previewOnly
        ? element("p", { className: "runner-preview-label", text: "Preview only" })
        : null,
      element("p", { className: "board-lesson", text: `Step ${timer.currentStepIndex + 1} of ${runner.steps.length}: ${step.label}` }),
      actionButton("Exit student view", "primary-action", () => actions.navigate("today"))
    ]),
    element("section", { className: "board-section runner-student-step" }, [
      element("h2", { text: step.label }),
      runnerStudentDirections(step)
    ]),
    projectArtwork(project, "runner-student-art"),
    runnerStepRail(runner)
  ].filter(Boolean));
}

function buildToday(model, actions, options) {
  const presentation = buildTodayPresentation(model, options);
  const projectView = actions.projectView;
  const children = [buildHeading(model, () => actions.navigate("board"))];
  if (actions.lastCompletion) {
    children.push(element("div", {
      className: "completion-undo",
      attributes: { role: "status", "aria-live": "polite" }
    }, [
      element("p", { text: `${actions.lastCompletion.title} marked complete.` }),
      actionButton("Undo", "completion-undo-action", actions.undoCompletion)
    ]));
  }
  if (presentation.showTeacherSelector) {
    children.push(buildTeacherPicker(model, actions.selectTeacher));
  }
  if (presentation.setup) {
    children.push(buildPlanNotice(
      presentation.setup,
      actions.navigate,
      actions.privateSeedMessage
    ));
  } else {
    const dashboard = presentation.dashboard;
    const companionCards = [
      buildNextCard(dashboard.next),
      buildWeatherCard(dashboard.weather),
      buildDutyCard(dashboard.duty)
    ].filter(Boolean);
    children.push(element("div", { className: "today-overview" }, [
      buildNowCard(dashboard.now),
      element("div", { className: "today-companions" }, companionCards)
    ]));
    if (dashboard.special) {
      children.push(element("div", {
        className: "special-banner",
        text: `${dashboard.special.title}: ${dashboard.special.timeLabel}`
      }));
    }
  }

  children.push(buildProjectHero(projectView, actions));
  if (projectView.currentProject.number === 2) children.push(replicaLessonChooser(actions));
  if (options.artifactContext) {
    children.push(sharedArtifactCard(options.artifactContext, actions));
  }
  children.push(element("details", { className: "today-plan-ahead" }, [
    element("summary", { text: "Plan ahead" }),
    buildIndependencePath(projectView),
    buildProjectTrail(projectView, actions),
    buildFastFinish(projectView)
  ]));

  if (presentation.dashboard) {
    children.push(buildTimeline(presentation.dashboard.timeline, actions.toggleTimeline));
  }
  if (actions.privateSeedMessage) {
    children.push(buildPrivateSeedRecovery(actions.privateSeedMessage, actions.navigate));
  }
  if (presentation.dashboard) {
    children.push(element("details", { className: "today-details" }, [
      element("summary", { text: "Details" }),
      element("p", { text: presentation.dashboard.quietStatus }),
      element("a", {
        className: "attribution-link",
        text: "Weather by Open-Meteo",
        attributes: { href: "https://open-meteo.com/", target: "_blank", rel: "noreferrer" }
      })
    ]));
  }
  return element("section", { attributes: { "data-view": "today" } }, children);
}

function textList(items, className = "plain-list") {
  const list = element("ul", { className });
  for (const item of Array.isArray(items) ? items : []) {
    list.append(element("li", { text: item }));
  }
  return list;
}

function boardRoute(board, navigate) {
  const exit = element("button", {
    className: "primary-action",
    text: "Return to Today",
    attributes: { type: "button" }
  });
  exit.addEventListener("click", () => navigate("today"));
  const lesson = [
    board.objective ? element("section", { className: "board-section" }, [
      element("h2", { text: "Objective" }),
      element("p", { text: board.objective })
    ]) : null,
    board.steps.length ? element("section", { className: "board-section" }, [
      element("h2", { text: "Steps" }),
      textList(board.steps)
    ]) : null,
    board.materials.length ? element("section", { className: "board-section" }, [
      element("h2", { text: "Materials" }),
      textList(board.materials)
    ]) : null,
    board.safety ? element("section", { className: "board-section" }, [
      element("h2", { text: "Safety" }),
      element("p", { text: board.safety })
    ]) : null,
    board.cleanup ? element("section", { className: "board-section" }, [
      element("h2", { text: "Cleanup" }),
      element("p", { text: board.cleanup })
    ]) : null,
    board.exitPrompt ? element("section", { className: "board-section" }, [
      element("h2", { text: "Exit" }),
      element("p", { text: board.exitPrompt })
    ]) : null
  ].filter(Boolean);
  return element("section", { className: "board-view", attributes: { "data-view": "board" } }, [
    element("div", { className: "board-heading" }, [
      element("p", { className: "eyebrow", text: "Board" }),
      element("h1", { text: board.classTitle || "Board is ready when a class is active" }),
      board.lessonTitle ? element("p", { className: "board-lesson", text: board.lessonTitle }) : null,
      board.countdown ? element("strong", { className: "board-countdown", text: board.countdown }) : null,
      board.currentProcessStep ? element("p", { className: "board-process", text: `Current step: ${board.currentProcessStep}` }) : null,
      exit
    ]),
    ...lesson
  ]);
}

function projectsRoute(actions) {
  const cards = PROJECTS.map((project) => {
    const button = element("button", {
      className: "project-library-card",
      attributes: {
        type: "button",
        "aria-label": `Open Experience ${project.number}: ${project.title}`
      }
    }, [
      element("span", { className: "project-library-number", text: String(project.number).padStart(2, "0") }),
      element("span", { className: "project-library-title", text: project.title }),
      element("span", { className: "project-library-phase", text: project.independence })
    ]);
    button.addEventListener("click", () => actions.openTeacher(project.number));
    return button;
  });
  return element("section", { attributes: { "data-view": "projects" } }, [
    element("div", { className: "page-heading projects-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The Playbook" }),
        element("h1", { text: "All 36 Experiences" }),
        element("p", { className: "date-line", text: "Thirty-six separate experiences for grades 5 and 6" })
      ])
    ]),
    element("section", {
      className: "announcements-feature",
      attributes: { "aria-labelledby": "announcements-feature-heading" }
    }, [
      element("div", { className: "announcements-feature-copy" }, [
        element("p", { className: "section-kicker", text: "Featured Grade 6 tool" }),
        element("h2", {
          text: "Grade 6 Morning Announcements",
          attributes: { id: "announcements-feature-heading" }
        }),
        element("p", {
          text: "A clear rite of passage workflow for preparing, rehearsing, reviewing, and delivering the school broadcast."
        }),
        element("p", {
          className: "announcements-feature-note",
          text: "The draft stays on this device. Add approved broadcast wording only, and keep student rosters somewhere private."
        })
      ]),
      actionButton(
        "Open announcement studio",
        "primary-action announcements-feature-action",
        actions.openAnnouncements
      )
    ]),
    replicaLessonChooser(actions),
    element("div", { className: "project-library" }, cards)
  ]);
}

function projectDetailHeading(project, label, onBack) {
  return element("div", { className: "project-detail-heading" }, [
    actionButton("Back to Today", "detail-back", onBack),
    element("p", { className: "project-kicker", text: `Experience ${project.number} of ${PROJECTS.length}` }),
    element("p", { className: "section-kicker", text: label }),
    element("h1", { text: project.title }),
    element("p", { className: "project-strapline", text: project.strapline })
  ]);
}

function teacherProjectRoute(project, actions) {
  const download = actionButton(
    "Download admin plan",
    "secondary-action detail-download",
    () => downloadAdminPlan(project),
    "download-simple"
  );
  const student = actionButton(
    "Student directions",
    "primary-action",
    () => actions.openStudent(project.number),
    "student"
  );
  const isCurrentProject = project.number === actions.projectView.currentProject.number;
  const complete = isCurrentProject && !actions.projectView.progressComplete && !actions.previewOnly
    ? actionButton(
        project.number < PROJECTS.length
          ? "Complete experience and move to next"
          : "Mark final experience complete",
        "primary-action progress-action",
        () => actions.completeProject(project.number)
      )
    : null;
  const completedStatus = isCurrentProject && actions.projectView.progressComplete
    ? element("p", {
        className: "progress-complete-note",
        text: "All 36 experiences complete. Demo Day stays available for review."
      })
    : null;
  return element("section", {
    className: "project-detail teacher-project-detail",
    attributes: { "data-view": "project-teacher" }
  }, [
    projectDetailHeading(project, "Teacher script", () => actions.navigate("today")),
    project.number === 2 ? replicaLessonChooser(actions) : null,
    element("div", { className: "project-detail-actions" }, [
      student,
      download,
      complete,
      completedStatus
    ].filter(Boolean)),
    element("div", { className: "project-detail-grid" }, [
      element("section", { className: "project-detail-card wide" }, [
        element("h2", { text: "Goal" }),
        element("p", { text: project.objective })
      ]),
      element("section", { className: "project-detail-card" }, [
        element("h2", { text: "Say this" }),
        textList(project.teacherSay)
      ]),
      element("section", { className: "project-detail-card" }, [
        element("h2", { text: "Teacher moves" }),
        textList(project.teacherDo)
      ]),
      element("section", { className: "project-detail-card wide" }, [
        element("h2", { text: "Student build path" }),
        textList(project.studentSteps)
      ]),
      element("section", { className: "project-detail-card" }, [
        element("h2", { text: "Materials" }),
        textList(project.materials)
      ]),
      element("section", { className: "project-detail-card" }, [
        element("h2", { text: "Safety and cleanup" }),
        element("p", { text: project.safety }),
        element("p", { text: project.cleanup })
      ]),
      element("section", { className: "project-detail-card" }, [
        element("h2", { text: "Exit evidence" }),
        element("p", { text: project.exitEvidence })
      ]),
      element("section", { className: "project-detail-card wide fast-finish-detail" }, [
        element("p", { className: "section-kicker", text: "Fast finish" }),
        element("h2", { text: project.fastFinish.title }),
        element("p", { text: project.fastFinish.directions }),
        element("p", { className: "stretch-line", text: `Stretch: ${project.stretch}` })
      ])
    ])
  ]);
}

function studentProjectRoute(project, actions, runner) {
  if (runner?.projectNumber === project.number) {
    return studentRunnerRoute(project, runner, actions);
  }
  return element("section", {
    className: "board-view project-student-view",
    attributes: { "data-view": "project-student" }
  }, [
    element("div", { className: "board-heading" }, [
      element("p", { className: "eyebrow", text: "Student directions" }),
      element("h1", { text: project.title }),
      element("p", { className: "board-lesson", text: project.objective }),
      actionButton("Return to Today", "primary-action", () => actions.navigate("today"))
    ]),
    element("section", { className: "board-section" }, [
      element("h2", { text: "Build path" }),
      textList(project.studentSteps)
    ]),
    element("section", { className: "board-section" }, [
      element("h2", { text: "Materials" }),
      textList(project.materials)
    ]),
    element("section", { className: "board-section" }, [
      element("h2", { text: "Safety" }),
      element("p", { text: project.safety })
    ]),
    element("section", { className: "board-section" }, [
      element("h2", { text: "Cleanup" }),
      element("p", { text: project.cleanup })
    ]),
    element("section", { className: "board-section board-exit-card" }, [
      element("h2", { text: "Show your evidence" }),
      element("p", { text: project.exitEvidence })
    ]),
    element("section", { className: "board-section fast-finish-detail" }, [
      element("p", { className: "section-kicker", text: "Fast finish" }),
      element("h2", { text: project.fastFinish.title }),
      element("p", { text: project.fastFinish.directions }),
      element("p", { className: "stretch-line", text: `Stretch: ${project.stretch}` })
    ])
  ]);
}

function roomRoute(state, cloudPresentation = null) {
  const view = buildRoomView(state, cloudPresentation);
  const sections = view.genericSections.map((section) => element("details", {
    className: "tool-card"
  }, [
    element("summary", { text: section.title }),
    section.status ? element("p", { className: "status-note", text: section.status }) : null,
    textList(section.items)
  ]));
  const privateResources = view.privateResources.length
    ? view.privateResources.map((resource, index) => element("article", { className: "resource-row" }, [
        element("h3", { text: resource.title }),
        typeof resource.note === "string" ? element("p", { text: resource.note }) : null,
        typeof resource.safeHref === "string" ? element("a", {
          className: "resource-link",
          text: "Open resource",
          attributes: {
            href: resource.safeHref,
            "aria-label": `Open ${resource.title}, ${resource.external ? "external" : "local"} resource ${index + 1}`,
            ...(resource.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})
          }
        }) : null
      ]))
    : [element("p", { className: "empty-note", text: view.privateResourceStatus })];
  return element("section", { attributes: { "data-view": "room" } }, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The Playbook" }),
        element("h1", { text: "Room" }),
        element("p", { className: "date-line", text: "Generic operating help and your saved private references" })
      ])
    ]),
    view.cloudRoom ? element("section", { className: "cloud-room-summary" }, [
      element("h2", { text: "Shared CIRC room" }),
      element("p", { text: view.cloudRoom.name ?? "No CIRC room selected" }),
      view.cloudRoom.role ? element("p", { text: `Role: ${view.cloudRoom.role}` }) : null,
      view.cloudRoom.syncLabel ? element("p", { text: view.cloudRoom.syncLabel }) : null
    ].filter(Boolean)) : null,
    element("div", { className: "tool-grid" }, sections),
    element("section", { className: "private-resources" }, [
      element("h2", { text: "Private resources" }),
      ...privateResources
    ])
  ]);
}

function scheduleRoute(context) {
  const teacherButtons = context.teachers.length > 1
    ? element("div", {
        className: "schedule-teacher-switcher",
        attributes: { "aria-label": "Choose teacher schedule" }
      }, [
        element("span", { text: "Editing schedule for" }),
        ...context.teachers.map((teacher) => {
          const button = element("button", {
            className: "secondary-action",
            text: teacher.name || "Teacher",
            attributes: {
              type: "button",
              "aria-pressed": String(teacher.id === context.selectedTeacherId)
            }
          });
          button.addEventListener("click", () => context.onSelectTeacher(teacher.id));
          return button;
        })
      ])
    : null;
  const status = context.status
    ? element("p", {
        className: "schedule-editor-status",
        text: context.status,
        attributes: { role: "status", "aria-live": "polite" }
      })
    : null;
  const editor = buildScheduleEditor(context.editor, { document });
  return element("section", {
    className: "schedule-route",
    attributes: { "data-view": "schedule" }
  }, [teacherButtons, status, editor].filter(Boolean));
}

function recoveryRoute(context) {
  let previewToken = null;
  const status = element("p", {
    className: "import-message",
    text: "CIRC HQ is read-only. Choose an external full-state backup, preview it, then explicitly restore it.",
    attributes: { role: "status", "aria-live": "polite" }
  });
  const picker = element("input", {
    attributes: {
      id: "full-state-backup-file",
      type: "file",
      accept: "application/json,.json"
    }
  });
  const pickerLabel = element("label", {
    className: "file-picker-label",
    text: "Choose full-state backup file",
    attributes: { for: "full-state-backup-file" }
  });
  const previewButton = element("button", {
    text: "Preview restore",
    attributes: { type: "button" }
  });
  const restoreButton = element("button", {
    className: "primary-action",
    text: "Restore backup",
    attributes: { type: "button", disabled: "" }
  });

  const resetPreview = () => {
    previewToken = null;
    restoreButton.setAttribute("disabled", "");
  };
  picker.addEventListener("change", resetPreview);
  previewButton.addEventListener("click", async () => {
    resetPreview();
    const file = picker.files?.[0];
    if (!file) {
      status.textContent = "No backup file selected. Damaged local data was not changed.";
      return;
    }
    try {
      const preview = previewSettingsRestore(await file.text());
      if (!preview.ok) throw new Error("invalid backup");
      previewToken = preview.previewToken;
      restoreButton.removeAttribute("disabled");
      const planSummary = preview.summary.hasPlan
        ? `${preview.summary.teacherCount} teacher plan(s)`
        : "no teacher plan";
      status.textContent = `Valid backup preview is ready. It contains ${planSummary}. Select Restore backup to replace the damaged local copies.`;
    } catch {
      status.textContent = "This full-state backup is invalid and cannot be restored. Damaged local data was not changed.";
    }
  });
  restoreButton.addEventListener("click", () => {
    if (!previewToken) return;
    const result = applySettingsRestore(context.store, previewToken);
    resetPreview();
    if (!result.ok) {
      status.textContent = "Restore failed. Damaged local data was not changed. Preview the backup again.";
      return;
    }
    context.completeRestore(result.state);
  });

  return element("section", { attributes: { "data-view": "recovery" } }, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "Local recovery" }),
        element("h1", { text: "Saved state cannot be read" }),
        element("p", {
          className: "date-line",
          text: "The primary and local backup copies are not usable. This is not a clean first setup."
        })
      ])
    ]),
    element("section", { className: "setup-card" }, [
      element("p", {
        className: "recovery-notice",
        text: "Unrecoverable local state is locked. CIRC HQ is read-only and will not save, import, export, run, or change settings until a valid full-state backup is explicitly restored.",
        attributes: { role: "alert" }
      }),
      element("p", {
        text: "If no external full-state backup exists, do not clear site data unless you accept permanent data loss. The damaged raw copies remain untouched."
      }),
      status,
      pickerLabel,
      picker,
      element("div", { className: "settings-row" }, [previewButton, restoreButton])
    ])
  ]);
}

function settingsRoute(context) {
  const readOnly = context.importAllowed !== true;
  const importMessage = element("p", {
    className: "import-message",
    text: readOnly
      ? "Read-only preview. Set up this device before importing or applying changes."
      : context.privateSeedMessage || "Choose a saved CIRC schedule backup to preview it.",
    attributes: { role: "status", "aria-live": "polite" }
  });
  const applyButton = element("button", {
    className: "primary-action",
    text: "Apply",
    attributes: { type: "button", disabled: "" }
  });
  const calendarMessage = element("p", {
    className: "calendar-change-message",
    text: readOnly
      ? "Set up this device before changing the calendar."
      : "Choose a date and an action. Nothing changes until Save calendar change is selected.",
    attributes: { role: "status", "aria-live": "polite" }
  });
  const calendarApplyButton = element("button", {
    className: "primary-action calendar-change-apply",
    text: "Save calendar change",
    attributes: { type: "button", disabled: "" }
  });
  const picker = element("input", {
    attributes: {
      id: "teacher-plan-file",
      type: "file",
      accept: "application/json,.json",
      ...(readOnly ? { disabled: "" } : {})
    }
  });
  const pickerLabel = element("label", {
    className: "file-picker-label",
    text: "Choose CIRC schedule backup",
    attributes: { for: "teacher-plan-file" }
  });

  picker.addEventListener("change", async () => {
    if (readOnly) return;
    context.previewToken = null;
    applyButton.setAttribute("disabled", "");
    calendarApplyButton.setAttribute("disabled", "");
    const file = picker.files?.[0];
    if (!file) {
      importMessage.textContent = "No file selected. Existing local data was not changed.";
      return;
    }
    try {
      const preview = previewPlanImport(context.state.plan, await file.text(), {
        migrationOptions: context.migrationOptions
      });
      if (!preview.ok) throw new Error("unsupported");
      context.previewToken = preview.previewToken;
      applyButton.removeAttribute("disabled");
      calendarApplyButton.setAttribute("disabled", "");
      importMessage.textContent = `Backup preview ready: ${preview.summary.teacherCount} teacher schedule(s) and ${preview.summary.eventCount} time block(s). Nothing has changed yet.`;
    } catch {
      importMessage.textContent = "That backup could not be opened. The current schedule was not changed.";
    }
  });

  applyButton.addEventListener("click", () => {
    if (readOnly) return;
    if (!context.previewToken) return;
    const result = applyPlanImport(context.store, context.previewToken);
    if (!result.ok) {
      importMessage.textContent = "Apply needs the exact current preview. Preview the change again.";
      return;
    }
    context.replaceState(result.state, { domains: ["plan"], alreadyPersisted: true });
    context.previewToken = null;
    applyButton.setAttribute("disabled", "");
    calendarApplyButton.setAttribute("disabled", "");
    importMessage.textContent = "Schedule backup restored on this browser.";
  });

  const stage = (preview) => {
    if (readOnly) return;
    context.previewToken = preview.ok ? preview.previewToken : null;
    applyButton.setAttribute("disabled", "");
    if (preview.ok) {
      calendarApplyButton.removeAttribute("disabled");
      calendarMessage.textContent = "Calendar change ready for review. Select Save calendar change to keep it.";
    } else {
      calendarApplyButton.setAttribute("disabled", "");
      calendarMessage.textContent = "That calendar change could not be prepared. Existing local data was not changed.";
    }
  };

  calendarApplyButton.addEventListener("click", () => {
    if (readOnly) return;
    if (!context.previewToken) return;
    const result = applyPlanImport(context.store, context.previewToken);
    if (!result.ok) {
      calendarMessage.textContent = "Saving needs the current calendar preview. Prepare the change again.";
      return;
    }
    context.replaceState(result.state, { domains: ["plan"], alreadyPersisted: true });
    context.previewToken = null;
    applyButton.setAttribute("disabled", "");
    calendarApplyButton.setAttribute("disabled", "");
    calendarMessage.textContent = "Calendar change saved on this browser.";
  });

  const closureDate = element("input", { attributes: { type: "date", "aria-label": "Closure date" } });
  const closureButton = element("button", { text: "Add closure", attributes: { type: "button" } });
  closureButton.addEventListener("click", () => stage(previewClosure(context.state.plan, closureDate.value)));

  const makeupDate = element("input", { attributes: { type: "date", "aria-label": "Makeup date" } });
  const makeupStatus = element("select", { attributes: { "aria-label": "Makeup-day status" } }, [
    element("option", { text: "Pending", attributes: { value: "pending" } }),
    element("option", { text: "Instructional", attributes: { value: "instructional" } }),
    element("option", { text: "Closed", attributes: { value: "closed" } })
  ]);
  const makeupButton = element("button", { text: "Set makeup-day status", attributes: { type: "button" } });
  makeupButton.addEventListener("click", () => stage(previewMakeupDayStatus(
    context.state.plan,
    makeupDate.value,
    makeupStatus.value
  )));

  const cycleDate = element("input", { attributes: { type: "date", "aria-label": "Cycle override date" } });
  const cycleDay = element("input", { attributes: { type: "number", min: "1", max: "5", inputmode: "numeric", "aria-label": "Cycle day" } });
  const cycleButton = element("button", { text: "Set cycle-day override", attributes: { type: "button" } });
  cycleButton.addEventListener("click", () => stage(previewCycleDayOverride(
    context.state.plan,
    cycleDate.value,
    Number(cycleDay.value)
  )));

  const specialDate = element("input", { attributes: { type: "date", "aria-label": "Special event date" } });
  const specialLabel = element("input", { attributes: { type: "text", "aria-label": "Special event title", placeholder: "Event title" } });
  const specialButton = element("button", { text: "Add special event", attributes: { type: "button" } });
  specialButton.addEventListener("click", () => stage(previewSpecialEvent(context.state.plan, {
    date: specialDate.value,
    label: specialLabel.value
  })));

  const exportButton = element("button", { text: "Export backup", attributes: { type: "button" } });
  exportButton.addEventListener("click", () => {
    const blob = new Blob([exportSettingsBackup(context.store)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = element("a", { attributes: { href, download: "circ-hq-backup.json" } });
    link.click();
    URL.revokeObjectURL(href);
  });

  const scheduleButton = element("button", {
    className: "secondary-action",
    text: "Open Schedule",
    attributes: { type: "button" }
  });
  scheduleButton.addEventListener("click", () => context.navigate("schedule"));

  const syncSetupButton = element("button", {
    className: "secondary-action",
    text: "Open sync setup",
    attributes: { type: "button" }
  });
  syncSetupButton.addEventListener("click", () => context.navigate("setup"));

  const advancedBackup = element("details", { className: "schedule-editor-advanced" }, [
    element("summary", { text: "Advanced backup and restore" }),
    element("div", { className: "advanced-settings-body" }, [
      element("section", {}, [
        element("h3", { text: "Restore a saved schedule" }),
        importMessage,
        pickerLabel,
        picker,
        applyButton
      ]),
      element("section", {}, [
        element("h3", { text: "Save a backup" }),
        element("p", { text: "Download a safety copy before a major change." }),
        exportButton
      ])
    ])
  ]);

  return element("section", {}, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The Playbook" }),
        element("h1", { text: "Settings" }),
        element("p", { className: "date-line", text: "Schedule, private sync, and safe backups" })
      ])
    ]),
    element("div", { className: "settings-grid" }, [
      element("section", {}, [
        element("h2", { text: "Your schedule" }),
        element("p", { text: "Add classes, duties, lunch, and prep with a simple form." }),
        scheduleButton
      ]),
      element("section", {}, [
        element("h2", { text: "Private sync" }),
        element("p", { text: context.syncPresentation.label }),
        element("p", { className: "settings-note", text: "Sign in once on each device so the same teacher plan follows you." }),
        syncSetupButton
      ]),
      element("section", {}, [
        element("h2", { text: "Calendar overrides" }),
        element("p", { text: "Record a closing, makeup day, cycle change, or one-day event." }),
        element("div", { className: "settings-row" }, [closureDate, closureButton]),
        element("div", { className: "settings-row" }, [makeupDate, makeupStatus, makeupButton]),
        element("div", { className: "settings-row" }, [cycleDate, cycleDay, cycleButton]),
        element("div", { className: "settings-row" }, [specialDate, specialLabel, specialButton]),
        element("div", { className: "calendar-change-review" }, [calendarMessage, calendarApplyButton])
      ]),
      element("section", {}, [
        element("h2", { text: "Weather resource" }),
        element("p", { text: "Bus-duty weather uses Open-Meteo when a forecast is available." }),
        element("a", {
          className: "attribution-link",
          text: "Open-Meteo attribution",
          attributes: { href: "https://open-meteo.com/", target: "_blank", rel: "noreferrer" }
        })
      ]),
      advancedBackup
    ])
  ]);
}

export function renderApp(root, services = {}) {
  const store = services.store ?? new LocalStore(window.localStorage);
  const weatherService = services.weatherService ?? createWeatherService();
  const loaded = store.load();
  let state = loaded.state;
  let recoveryStatus = loaded.status;
  let route = recoveryStatus === "unrecoverable" ? "recovery" : state.plan ? "today" : "welcome";
  let selectedTeacherId =
    services.teacherId ??
    state.preferences?.teacherId ??
    state.plan?.teachers?.[0]?.id ??
    null;
  let selectedProjectNumber = buildProjectHomeView(
    state,
    { teacherId: selectedTeacherId }
  ).currentProject.number;
  let lastCompletion = null;
  let weather = { status: "unavailable", label: "Weather unavailable" };
  let previewToken = null;
  let previewOnly = recoveryStatus === "unrecoverable" || !state.plan;
  let configuredPreview = false;
  let previewRunner = null;
  let setupImportAllowed = false;
  let privateSeedMessage = "";
  let scheduleDraft = null;
  let scheduleTeacherId = null;
  let scheduleSelectedCycleDay = 1;
  let scheduleCopyTargetDay = 2;
  let scheduleErrors = [];
  let scheduleStatus = "";
  let scheduleReturnRoute = null;
  let timelineExpanded = false;
  let pendingArtifactHandoff = null;
  let lastBoundaryKey = "";
  let lastRenderedMinute = "";
  let lastRunnerLayoutKey = "";
  let appDestroyed = false;
  const siteHeader = document.querySelector(".site-header");
  const liveStatus = document.getElementById("app-status");
  const navButtons = [...document.querySelectorAll("[data-route]")];
  const siteHeaderSnapshot = snapshotAttributes(siteHeader);
  const liveStatusSnapshot = snapshotAttributes(liveStatus);
  const navSnapshots = navButtons.map((button) => snapshotAttributes(button));

  const now = () => services.clock?.now?.() ?? new Date();
  const announcementStorage = services.announcementStorage ?? globalThis.window?.localStorage ?? null;
  const loadedAnnouncement = loadLocalAnnouncementDraft(announcementStorage, {
    date: localDateKey(now())
  });
  let announcementDraft = loadedAnnouncement.draft;
  let announcementSavedSnapshot = JSON.stringify(announcementDraft);
  let announcementArchive = loadLocalAnnouncementArchive(announcementStorage);
  let announcementStatus = loadedAnnouncement.status === "invalid"
    ? "The saved announcement draft could not be read. A fresh local draft is open, and the unreadable saved value was left untouched."
    : "";

  function adoptPersistedState(nextState) {
    state = admitLocalState(nextState);
    previewOnly = !state.plan;
    configuredPreview = false;
    previewRunner = null;
    selectedTeacherId = state.plan?.teachers?.find(({ id }) => id === selectedTeacherId)?.id ??
      state.plan?.teachers?.[0]?.id ?? null;
    selectedProjectNumber = buildProjectHomeView(
      state,
      { teacherId: selectedTeacherId }
    ).currentProject.number;
    return state;
  }

  function persistAndAdoptState(nextState) {
    const admitted = admitLocalState(nextState);
    const persisted = typeof store.save === "function" ? store.save(admitted) : admitted;
    return adoptPersistedState(persisted);
  }

  function downloadLocalBackup() {
    let text;
    try {
      text = exportSettingsBackup(store);
    } catch {
      return;
    }
    if (typeof services.downloadText === "function") {
      services.downloadText("circ-hq-backup.json", text, "application/json");
      return;
    }
    const blob = new Blob([text], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = element("a", { attributes: { href, download: "circ-hq-backup.json" } });
    link.click();
    URL.revokeObjectURL(href);
  }

  const runtime = createCloudRuntimeController({
    store,
    clock: { now },
    readFileText: services.readFileText ?? ((file) => file.text()),
    migrationOptions: services.migrationOptions ?? null,
    getState: () => state,
    acceptPersistedState: adoptPersistedState,
    persistAndAcceptState: persistAndAdoptState,
    invalidate: () => {
      if (!appDestroyed) render();
    },
    routes: {
      openToday: () => navigate("today"),
      previewExperience: () => {
        if (state.plan) openConfiguredPreview(selectedProjectNumber);
        else openPreview();
      },
      openSetupHelp: () => {
        route = "setup-help";
        render();
      },
      openSchedule: () => {
        scheduleReturnRoute = "setup";
        navigate("schedule");
      },
      enterDemo: () => {
        previewOnly = true;
        configuredPreview = false;
        previewRunner = null;
        route = "setup";
      },
      exitDemo: () => {
        previewOnly = !state.plan;
        route = state.plan ? "today" : "welcome";
      },
      returnToSetup: () => {
        route = "setup";
        render();
      },
      replaceTeacherPlan: () => {
        setupImportAllowed = true;
        navigate("settings");
      },
      exportLocalBackup: downloadLocalBackup
    }
  });

  function commitLocal(nextState, { domains = [], sharedHandoff = null } = {}) {
    const persisted = persistAndAdoptState(nextState);
    void runtime.afterLocalCommit({ domains, state: persisted });
    if (sharedHandoff) {
      void runtime.afterSharedHandoff({ state: persisted, handoff: sharedHandoff });
    }
    return persisted;
  }

  function confirmFinish() {
    const message = "Finish this lesson? Both timers will stop at 0:00.";
    if (typeof services.confirmFinish === "function") {
      return Boolean(services.confirmFinish(message));
    }
    return typeof window.confirm === "function" ? window.confirm(message) : false;
  }

  function runnerOwnerKey() {
    return ownerKeyForTeacher(selectedTeacherId);
  }

  function selectedRunner() {
    const owner = runnerOwnerKey();
    const runner = previewOnly ? previewRunner : state.experienceRunners?.[owner];
    if (!runner) return null;
    if (!validateExperienceRunner(runner, { teacherKey: owner }).ok) return null;
    const currentTime = now().getTime();
    const lastTickTime = new Date(runner.lastTickAt).getTime();
    const updatedTime = new Date(runner.updatedAt).getTime();
    return lastTickTime <= currentTime && updatedTime <= currentTime ? runner : null;
  }

  function setRunnerInMemory(runner) {
    if (previewOnly) {
      previewRunner = structuredClone(runner);
      return selectedRunner();
    }
    const nextState = structuredClone(state);
    const runners = nextState.experienceRunners &&
      typeof nextState.experienceRunners === "object" &&
      !Array.isArray(nextState.experienceRunners)
      ? nextState.experienceRunners
      : {};
    nextState.experienceRunners = {
      ...runners,
      [runnerOwnerKey()]: runner
    };
    state = nextState;
    return selectedRunner();
  }

  function saveRunner(runner) {
    if (previewOnly) return setRunnerInMemory(runner);
    setRunnerInMemory(runner);
    state.updatedAt = now().toISOString();
    state = commitLocal(state, { domains: [] });
    return selectedRunner();
  }

  function runnerLayoutKey(runner, model = todayModel()) {
    if (!runner) return "";
    return [
      route,
      selectedTeacherId ?? "no-teacher",
      runnerOwnerKey(),
      runner.projectNumber,
      runner.timer.currentStepIndex,
      runner.timer.status,
      runner.detour?.status ?? "build",
      model.current?.id ?? "no-current-event",
      model.current?.type ?? "no-current-type",
      model.clock?.dateKey ?? "no-visit-date",
      previewOnly ? "preview" : "live",
      state.plan ? "plan" : "no-plan"
    ].join(":");
  }

  function updateRunnerTimerText(runner) {
    const classTimer = root.querySelector('[data-runner-timer="class"]');
    const stepTimer = root.querySelector('[data-runner-timer="step"]');
    if (!classTimer || !stepTimer) return false;
    classTimer.textContent = formatRunnerTime(runner.timer.totalRemainingSeconds);
    stepTimer.textContent = formatRunnerTime(runner.timer.currentStepRemainingSeconds);
    const detourTimer = root.querySelector('[data-runner-timer="detour"]');
    if (detourTimer && runner.detour?.status === "active") {
      detourTimer.textContent = formatRunnerTime(runner.detour.remainingSeconds);
    }
    return true;
  }

  function refreshRunnerView(runner) {
    if (!runner) {
      render();
      return;
    }
    const model = todayModel();
    if (reconcilePendingArtifactHandoff(model)) {
      render();
      return;
    }
    const key = runnerLayoutKey(runner, model);
    if (
      (route === "experience-runner" || route === "project-student") &&
      key === lastRunnerLayoutKey &&
      updateRunnerTimerText(runner)
    ) return;
    render();
  }

  function reconcileRunner() {
    const runner = selectedRunner();
    if (!runner || (runner.timer.status !== "running" && runner.timer.status !== "step-expired")) {
      return { runner, changed: false };
    }
    const next = advanceExperienceRunnerClock(runner, {
      teacherKey: runnerOwnerKey(),
      nowIso: now().toISOString()
    });
    if (next.lastTickAt === runner.lastTickAt && next.timer.totalRemainingSeconds === runner.timer.totalRemainingSeconds) {
      return { runner, changed: false };
    }
    return { runner: setRunnerInMemory(next), changed: true };
  }

  function openRunner(projectNumber, { modeId, restart = false } = {}) {
    const project = getProjectByNumber(projectNumber);
    if (!project) return;
    const current = selectedRunner();
    const explicitSelection = modeId !== undefined;
    if (explicitSelection && (projectNumber !== 2 || !getExperienceTimingPlan(2, { modeId }))) return;
    const sameSelection = current?.projectNumber === projectNumber && current?.modeId === modeId;
    if (explicitSelection && current && (!sameSelection || restart === true)) {
      const title = getExperienceTimingPlan(2, { modeId }).title;
      const message = restart === true && sameSelection
        ? `Start "${title}" for a new class? This resets the current step and both timers. A current scheduled class still uses its remaining time. Cancel keeps the existing lesson.`
        : `Replace the saved lesson "${current.title}" with "${title}"? Its current step and timers will be replaced. Cancel keeps the existing lesson.`;
      const confirmed = typeof services.confirmReplaceRunner === "function"
        ? services.confirmReplaceRunner(message) === true
        : typeof window.confirm === "function" && window.confirm(message) === true;
      if (!confirmed) return;
    }
    if (
      (explicitSelection && (!sameSelection || restart === true)) ||
      (!explicitSelection && (!current ||
      current.projectNumber !== projectNumber ||
      current.timer.status === "complete" ||
      (!previewOnly && current.timer.status === "ready")))
    ) {
      const plan = EXPERIENCE_TIMING_PLANS[projectNumber - 1];
      const currentTime = now();
      const activeEvent = todayModel(currentTime).current;
      let classDurationSeconds;
      if (activeEvent?.type === "teach" && Number.isInteger(activeEvent.endMinutes)) {
        const scheduledEnd = new Date(currentTime);
        scheduledEnd.setHours(
          Math.floor(activeEvent.endMinutes / 60),
          activeEvent.endMinutes % 60,
          0,
          0
        );
        classDurationSeconds = Math.ceil(
          (scheduledEnd.getTime() - currentTime.getTime()) / 1000
        );
      }
      const created = createExperienceRunner(plan, {
        teacherKey: runnerOwnerKey(),
        nowIso: currentTime.toISOString(),
        ...(classDurationSeconds !== undefined ? { classDurationSeconds } : {}),
        ...(projectNumber === 2 ? {
          modeId: modeId ?? (current?.projectNumber === 2 ? current.modeId : "build-new")
        } : {})
      });
      if (previewOnly) setRunnerInMemory(created);
      else saveRunner(created);
    }
    selectedProjectNumber = projectNumber;
    navigate("experience-runner");
  }

  function applyRunnerAction(action) {
    const { runner } = reconcileRunner();
    if (!runner) return;
    if (action === "finish") {
      if (!confirmFinish()) return;
      action = "next";
    }
    const next = saveRunner(applyExperienceRunnerAction(runner, action, {
      teacherKey: runnerOwnerKey(),
      nowIso: now().toISOString()
    }));
    refreshRunnerView(next);
  }

  function todayModel(currentTime = now()) {
    const syncPresentation = runtime.getSyncPresentation();
    const model = buildTodayViewModel({
      plan: state.plan,
      teacherId: selectedTeacherId,
      dateKey: localDateKey(currentTime),
      now: currentTime,
      nowMinutes: currentTime.getHours() * 60 + currentTime.getMinutes(),
      weather,
      syncStatus: services.syncStatus ?? syncPresentation.status
    });
    if (services.syncStatus === undefined) model.sync = syncPresentation;
    return model;
  }

  function currentTeachingEvent(model = todayModel()) {
    const current = model.current;
    return current?.type === "teach" &&
      typeof current.id === "string" &&
      current.id !== "" &&
      current.id === current.id.trim()
      ? current
      : null;
  }

  function artifactForTeacherDisplay(nowIso) {
    const stored = validateSharedArtifact(
      state.sharedArtifacts?.[TECH_TERRARIUM_ARTIFACT_ID]
    );
    return stored ?? createTechTerrariumArtifact({
      artifactId: TECH_TERRARIUM_ARTIFACT_ID,
      nowIso
    });
  }

  function teacherArtifactContext(model, projectNumber, allowControls = false) {
    if (projectNumber !== 2) return null;
    const artifact = artifactForTeacherDisplay(now().toISOString());
    const contribution = getCurrentContribution(artifact);
    if (!contribution) return null;
    const event = currentTeachingEvent(model);
    const eligibility = artifactHandoffEligibility(model, artifact);
    const controlsEnabled = allowControls && Boolean(eligibility);
    return {
      stageTitle: contribution.stageTitle,
      contributionTitle: contribution.title,
      status: artifact.status,
      classLabel: typeof event?.title === "string" && event.title.trim() !== ""
        ? event.title
        : "",
      controlsEnabled,
      pendingHandoff: controlsEnabled && pendingArtifactHandoffMatches(eligibility)
        ? pendingArtifactHandoff.handoff
        : null
    };
  }

  function artifactHandoffEligibility(model, artifact = artifactForTeacherDisplay(now().toISOString())) {
    const event = currentTeachingEvent(model);
    const runner = selectedRunner();
    const visitDate = localDateKey(now());
    if (
      !state.plan ||
      previewOnly ||
      route !== "experience-runner" ||
      selectedProjectNumber !== 2 ||
      runner?.projectNumber !== 2 ||
      !event ||
      artifact.status === "complete"
    ) return null;
    if (artifact.visits.some((visit) =>
      visit.eventId === event.id && visit.visitDate === visitDate
    )) return null;
    return {
      eventId: event.id,
      visitDate,
      teacherId: selectedTeacherId,
      runnerOwner: runnerOwnerKey(),
      projectNumber: 2
    };
  }

  function pendingArtifactHandoffMatches(eligibility) {
    if (!pendingArtifactHandoff || !eligibility) return false;
    return Object.keys(pendingArtifactHandoff).length === 6 &&
      ["ready", "repeat", "park"].includes(pendingArtifactHandoff.handoff) &&
      pendingArtifactHandoff.eventId === eligibility.eventId &&
      pendingArtifactHandoff.visitDate === eligibility.visitDate &&
      pendingArtifactHandoff.teacherId === eligibility.teacherId &&
      pendingArtifactHandoff.runnerOwner === eligibility.runnerOwner &&
      pendingArtifactHandoff.projectNumber === eligibility.projectNumber;
  }

  function reconcilePendingArtifactHandoff(model = todayModel()) {
    if (!pendingArtifactHandoff) return false;
    if (pendingArtifactHandoffMatches(artifactHandoffEligibility(model))) return false;
    pendingArtifactHandoff = null;
    return true;
  }

  function chooseArtifactHandoff(handoff) {
    if (!["ready", "repeat", "park"].includes(handoff)) return;
    const model = todayModel();
    const eligibility = artifactHandoffEligibility(model);
    if (!eligibility) return;
    pendingArtifactHandoff = Object.freeze({
      handoff,
      eventId: eligibility.eventId,
      visitDate: eligibility.visitDate,
      teacherId: eligibility.teacherId,
      runnerOwner: eligibility.runnerOwner,
      projectNumber: eligibility.projectNumber
    });
    render();
  }

  function cancelArtifactHandoff() {
    if (!pendingArtifactHandoff) return;
    pendingArtifactHandoff = null;
    render();
  }

  function confirmArtifactHandoff() {
    if (!pendingArtifactHandoff || typeof store.save !== "function") return;
    const currentTime = now();
    const model = todayModel(currentTime);
    const eligibility = artifactHandoffEligibility(model);
    if (!pendingArtifactHandoffMatches(eligibility)) {
      pendingArtifactHandoff = null;
      render();
      return;
    }
    const confirmedHandoff = pendingArtifactHandoff;
    const nowIso = currentTime.toISOString();
    const artifact = artifactForTeacherDisplay(nowIso);
    if (
      artifact.status === "complete" ||
      Date.parse(artifact.updatedAt) > currentTime.getTime()
    ) {
      pendingArtifactHandoff = null;
      render();
      return;
    }
    const transitioned = recordArtifactHandoff(artifact, {
      handoff: confirmedHandoff.handoff,
      eventId: confirmedHandoff.eventId,
      visitDate: confirmedHandoff.visitDate,
      nowIso
    });
    const nextState = structuredClone(state);
    nextState.sharedArtifacts = {
      [TECH_TERRARIUM_ARTIFACT_ID]: transitioned
    };
    nextState.updatedAt = nowIso;
    state = commitLocal(nextState, {
      domains: [],
      sharedHandoff: {
        handoff: confirmedHandoff.handoff,
        eventId: confirmedHandoff.eventId,
        visitDate: confirmedHandoff.visitDate,
        nowIso
      }
    });
    pendingArtifactHandoff = null;
    render();
  }

  function setNavigation() {
    const activeRoute = ["project-teacher", "project-student", "announcements", "announcements-live"].includes(route)
      ? "projects"
      : route;
    for (const button of navButtons) {
      const active = button.dataset.route === activeRoute;
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function setBoardShell(active) {
    if (active) {
      for (const node of [siteHeader, liveStatus].filter(Boolean)) {
        node.setAttribute("hidden", "");
        node.setAttribute("inert", "");
        node.setAttribute("aria-hidden", "true");
      }
      if (liveStatus) liveStatus.textContent = "";
      return;
    }
    restoreAttributes(siteHeader, siteHeaderSnapshot);
    restoreAttributes(liveStatus, liveStatusSnapshot);
    if (liveStatus) liveStatus.textContent = "";
  }

  function announceBoundary(model) {
    const key = `${model.status}:${model.current?.id ?? "none"}:${model.next?.id ?? "none"}:${model.duties.active}`;
    if (route === "today" && lastBoundaryKey && key !== lastBoundaryKey) {
      if (liveStatus) liveStatus.textContent = `Schedule updated. ${model.currentLabel}.`;
    }
    lastBoundaryKey = key;
  }

  function navigate(nextRoute) {
    if (recoveryStatus === "unrecoverable") {
      route = "recovery";
      render();
      root.focus({ preventScroll: true });
      return;
    }
    reconcileRunner();
    pendingArtifactHandoff = null;
    if (
      configuredPreview &&
      nextRoute !== "experience-runner" &&
      nextRoute !== "project-student"
    ) {
      configuredPreview = false;
      previewOnly = false;
      previewRunner = null;
    }
    if (nextRoute === "today" && !state.plan) previewOnly = true;
    route = nextRoute;
    if (nextRoute !== "today") timelineExpanded = false;
    render();
    globalThis.window?.scrollTo?.(0, 0);
    root.focus({ preventScroll: true });
  }

  function openTeacher(projectNumber) {
    if (!getProjectByNumber(projectNumber)) return;
    selectedProjectNumber = projectNumber;
    navigate("project-teacher");
  }

  function openStudent(projectNumber) {
    if (!getProjectByNumber(projectNumber)) return;
    reconcileRunner();
    selectedProjectNumber = projectNumber;
    navigate("project-student");
  }

  function completeProject(projectNumber) {
    if (previewOnly) return;
    if (!getProjectByNumber(projectNumber)) return;
    const timestamp = now().toISOString();
    const previousState = structuredClone(state);
    const updated = advanceProjectProgress(state, selectedTeacherId, projectNumber, timestamp);
    state = commitLocal(updated, { domains: ["progress"] });
    lastCompletion = {
      previousState,
      teacherId: selectedTeacherId,
      projectNumber,
      title: getProjectByNumber(projectNumber).title
    };
    selectedProjectNumber = buildProjectHomeView(
      state,
      { teacherId: selectedTeacherId }
    ).currentProject.number;
    navigate("today");
  }

  function undoCompletion() {
    if (previewOnly) return;
    if (!lastCompletion) return;
    const completion = lastCompletion;
    lastCompletion = null;
    state = commitLocal(completion.previousState, { domains: ["progress"] });
    selectedTeacherId = completion.teacherId;
    selectedProjectNumber = completion.projectNumber;
    navigate("today");
  }

  function selectTeacher(teacherId) {
    if (recoveryStatus === "unrecoverable") return;
    lastCompletion = null;
    pendingArtifactHandoff = null;
    selectedTeacherId = teacherId;
    selectedProjectNumber = buildProjectHomeView(
      state,
      { teacherId: selectedTeacherId }
    ).currentProject.number;
    render();
  }

  function replaceState(nextState, { domains = [], alreadyPersisted = true } = {}) {
    lastCompletion = null;
    pendingArtifactHandoff = null;
    if (alreadyPersisted) adoptPersistedState(nextState);
    else persistAndAdoptState(nextState);
    if (state.plan) setupImportAllowed = false;
    if (state.plan) route = "today";
    if (domains.length) void runtime.afterLocalCommit({ domains, state });
    timelineExpanded = false;
    render();
  }

  function updateAnnouncementDraft(update, { rerender = true } = {}) {
    try {
      const wasApproved = announcementDraft.teacherReview?.approved === true;
      const priorCrew = JSON.stringify(announcementDraft.crew);
      announcementDraft = update(announcementDraft);
      announcementStatus = "Changes are local to this device. Choose Save local draft when ready.";
      if (rerender || wasApproved || priorCrew !== JSON.stringify(announcementDraft.crew)) render();
    } catch (error) {
      announcementStatus = error instanceof Error ? error.message : "The announcement draft could not be updated.";
      render();
    }
  }

  function saveAnnouncementDraft() {
    try {
      announcementDraft = saveDatedAnnouncementDraft(announcementStorage, announcementDraft);
      announcementSavedSnapshot = JSON.stringify(announcementDraft);
      announcementStatus = `Saved a dated copy for ${announcementDraft.date} in this browser on this device only. Other saved dates are unchanged.`;
    } catch (error) {
      announcementStatus = error instanceof Error ? error.message : "The local announcement draft could not be saved.";
    }
    announcementArchive = loadLocalAnnouncementArchive(announcementStorage);
    render();
  }

  function loadAnnouncementDraft(date) {
    try {
      const saved = loadArchivedAnnouncementDraft(announcementStorage, date);
      const currentSnapshot = JSON.stringify(announcementDraft);
      if (JSON.stringify(saved) !== currentSnapshot && currentSnapshot !== announcementSavedSnapshot) {
        const message = `Discard unsaved changes in the current draft and load the saved broadcast for ${date}? Cancel keeps your current draft.`;
        const confirmed = typeof services.confirmLoadAnnouncement === "function"
          ? services.confirmLoadAnnouncement(message) === true
          : typeof window.confirm === "function" && window.confirm(message) === true;
        if (!confirmed) return;
      }
      announcementDraft = saved;
      announcementSavedSnapshot = JSON.stringify(saved);
      announcementStatus = `Loaded the saved copy for ${date}. Save local draft keeps any edits and makes this the draft that opens after reload.`;
    } catch (error) {
      announcementStatus = error instanceof Error ? error.message : "The saved broadcast could not be loaded.";
    }
    announcementArchive = loadLocalAnnouncementArchive(announcementStorage);
    render();
  }

  function clearAnnouncementDraft() {
    const message = "Start a blank announcement draft? The current working draft will be removed from this device. Your dated saved scripts will stay.";
    const confirmed = typeof services.confirmClearAnnouncement === "function"
      ? Boolean(services.confirmClearAnnouncement(message))
      : typeof globalThis.window?.confirm === "function"
        ? globalThis.window.confirm(message)
        : false;
    if (!confirmed) return;
    try {
      clearLocalAnnouncementDraft(announcementStorage);
      announcementDraft = resetAnnouncementDraft(announcementDraft, { date: localDateKey(now()) });
      announcementSavedSnapshot = JSON.stringify(announcementDraft);
      announcementStatus = "Blank local draft ready. Your dated saved scripts are unchanged.";
    } catch (error) {
      announcementStatus = error instanceof Error
        ? error.message
        : "The local announcement draft could not be cleared on this device.";
    }
    render();
  }

  function useEcmsAnnouncementOutline() {
    const hasScript = hasAnnouncementScript(announcementDraft);
    if (hasScript) {
      const message = "Replace the current script with the ECMS outline? The current wording will be replaced and preparation, rehearsal, and teacher approval will reset. Cancel keeps your draft.";
      const confirmed = typeof services.confirmReplaceAnnouncement === "function"
        ? services.confirmReplaceAnnouncement(message) === true
        : typeof globalThis.window?.confirm === "function" && globalThis.window.confirm(message) === true;
      if (!confirmed) return;
    }
    updateAnnouncementDraft((draft) => applyEcmsAnnouncementOutline(draft, { replaceExisting: hasScript }));
  }

  function openAnnouncementBroadcast() {
    if (!evaluateAnnouncementDraft(announcementDraft).canGoLive) {
      announcementStatus = "Finish preparation and rehearsal, record teacher approval, and confirm both crew roles or teacher-arranged coverage before going live.";
      render();
      return;
    }
    announcementDraft = setAnnouncementCheck(
      announcementDraft,
      "go-live",
      "broadcastComplete",
      true
    );
    try {
      announcementDraft = saveLocalAnnouncementDraft(announcementStorage, announcementDraft);
      announcementSavedSnapshot = JSON.stringify(announcementDraft);
      announcementStatus = "Broadcast marked complete in this local draft.";
    } catch {
      announcementStatus = "Broadcast view is ready. Local storage is unavailable, so this update was not saved.";
    }
    navigate("announcements-live");
  }

  function usePreparedEcmsAnnouncement(date) {
    const hasScript = hasAnnouncementScript(announcementDraft);
    if (hasScript) {
      const message = `Load the prepared ${date} script? This replaces the current working wording and resets preparation, rehearsal, approval and crew checks. Your saved dates stay unchanged until you explicitly save. Cancel keeps this draft.`;
      const confirmed = typeof services.confirmReplaceAnnouncement === "function"
        ? services.confirmReplaceAnnouncement(message) === true
        : typeof globalThis.window?.confirm === "function" && globalThis.window.confirm(message) === true;
      if (!confirmed) return;
    }
    updateAnnouncementDraft((draft) => applyPreparedEcmsAnnouncement(draft, date, { replaceExisting: hasScript }));
  }

  function announcementWorkflow() {
    return buildAnnouncementsWorkflow({
      draft: announcementDraft,
      savedArchive: announcementArchive,
      status: announcementStatus,
      callbacks: {
        onCrewCheckChange: (slot, field, checked) => updateAnnouncementDraft(
          (draft) => setAnnouncementCrewCheck(draft, slot, field, checked)
        ),
        onCrewTimeChange: (field, value) => updateAnnouncementDraft(
          (draft) => updateAnnouncementCrewTime(draft, field, value)
        ),
        onCrewReset: () => updateAnnouncementDraft((draft) => resetAnnouncementCrew(draft)),
        onDetailChange: (field, value) => updateAnnouncementDraft(
          (draft) => updateAnnouncementDetails(draft, { [field]: value }),
          { rerender: field === "date" }
        ),
        onSectionChange: (section, value) => updateAnnouncementDraft(
          (draft) => updateAnnouncementSection(draft, section, value),
          { rerender: false }
        ),
        onChecklistChange: (phaseId, itemId, complete) => updateAnnouncementDraft(
          (draft) => setAnnouncementCheck(draft, phaseId, itemId, complete)
        ),
        onTeacherReviewChange: (approved) => updateAnnouncementDraft(
          (draft) => setAnnouncementTeacherReview(draft, approved)
        ),
        onSaveLocalDraft: saveAnnouncementDraft,
        onLoadSavedDraft: loadAnnouncementDraft,
        onUseEcmsOutline: useEcmsAnnouncementOutline,
        onUsePreparedEcms: usePreparedEcmsAnnouncement,
        onClearLocalDraft: clearAnnouncementDraft,
        onGoLive: openAnnouncementBroadcast
      }
    }, { document });
  }

  function newPrivateTeacherId() {
    const supplied = services.generateTeacherId?.();
    if (typeof supplied === "string" && supplied.trim()) return supplied;
    return generateEventId().replace(/^event-/, "teacher-");
  }

  function resetScheduleEditor() {
    scheduleDraft = null;
    scheduleTeacherId = null;
    scheduleSelectedCycleDay = 1;
    scheduleCopyTargetDay = 2;
    scheduleErrors = [];
    scheduleStatus = "";
    scheduleReturnRoute = null;
  }

  function ensureScheduleEditor() {
    if (scheduleDraft) return;
    if (state.plan) {
      scheduleDraft = createScheduleDraftFromPlan(state.plan);
      scheduleTeacherId = scheduleDraft.teachers.find(({ id }) => id === selectedTeacherId)?.id ??
        scheduleDraft.teachers[0].id;
    } else {
      scheduleTeacherId = newPrivateTeacherId();
      scheduleDraft = createBlankScheduleDraft({
        teacherId: scheduleTeacherId,
        teacherName: "",
        calendar: {
          anchorDate: "",
          anchorDay: 1,
          lastDate: "",
          noSchool: [],
          conditionalMakeup: [],
          overrides: {}
        }
      });
    }
  }

  function scheduleTeacher() {
    ensureScheduleEditor();
    return scheduleDraft.teachers.find(({ id }) => id === scheduleTeacherId) ?? scheduleDraft.teachers[0];
  }

  function scheduleUiDraft() {
    const teacher = scheduleTeacher();
    return {
      teacherName: teacher.name ?? "",
      firstSchoolDate: scheduleDraft.calendar.anchorDate,
      lastSchoolDate: scheduleDraft.calendar.lastDate,
      anchorCycleDay: scheduleDraft.calendar.anchorDay,
      days: teacher.days
    };
  }

  function noteScheduleEdit(message = "Unsaved changes") {
    scheduleErrors = [];
    scheduleStatus = message;
  }

  function updateScheduleTeacherName(value) {
    const next = structuredClone(scheduleDraft);
    const teacher = next.teachers.find(({ id }) => id === scheduleTeacherId);
    if (!teacher) return;
    teacher.name = value;
    scheduleDraft = next;
    noteScheduleEdit();
  }

  function updateScheduleCalendar(field, value) {
    const next = structuredClone(scheduleDraft);
    next.calendar[field] = value;
    scheduleDraft = next;
    noteScheduleEdit();
  }

  function addScheduleItem(day, type) {
    const labels = {
      teach: "Class",
      prep: "Prep",
      lunch: "Lunch",
      support: "Support",
      duty: "Duty"
    };
    scheduleDraft = addScheduleEvent(scheduleDraft, {
      teacherId: scheduleTeacherId,
      cycleDay: day,
      event: { type, label: labels[type] ?? "Schedule item", start: "", end: "" }
    });
    noteScheduleEdit("New schedule item added. Add its time and name.");
    render();
  }

  function updateScheduleItem(day, eventId, field, value) {
    scheduleDraft = editScheduleEvent(scheduleDraft, {
      teacherId: scheduleTeacherId,
      cycleDay: day,
      eventId,
      changes: { [field]: value }
    });
    noteScheduleEdit();
  }

  function duplicateScheduleItem(day, eventId) {
    scheduleDraft = duplicateScheduleEvent(scheduleDraft, {
      teacherId: scheduleTeacherId,
      cycleDay: day,
      eventId
    });
    noteScheduleEdit("Copy added. Change its name or time before saving.");
    render();
  }

  function removeScheduleItem(day, eventId) {
    scheduleDraft = removeScheduleEvent(scheduleDraft, {
      teacherId: scheduleTeacherId,
      cycleDay: day,
      eventId
    });
    noteScheduleEdit("Schedule item removed. Save changes when the day looks right.");
    render();
  }

  function copyScheduleToDay(sourceDay, targetDay) {
    const teacher = scheduleTeacher();
    const targetHasItems = (teacher.days[String(targetDay)] ?? []).length > 0;
    if (targetHasItems) {
      const prompt = `Replace every item on Day ${targetDay} with a copy of Day ${sourceDay}?`;
      const accepted = typeof services.confirmScheduleCopy === "function"
        ? services.confirmScheduleCopy(prompt)
        : typeof window.confirm === "function" && window.confirm(prompt);
      if (!accepted) return;
    }
    scheduleDraft = copyScheduleDay(scheduleDraft, {
      teacherId: scheduleTeacherId,
      sourceDay,
      targetDay
    });
    scheduleSelectedCycleDay = targetDay;
    scheduleCopyTargetDay = targetDay === 5 ? 1 : targetDay + 1;
    noteScheduleEdit(`Day ${sourceDay} copied to Day ${targetDay}.`);
    render();
  }

  function selectScheduleTeacher(teacherId) {
    if (!scheduleDraft?.teachers?.some((teacher) => teacher.id === teacherId)) return;
    scheduleTeacherId = teacherId;
    scheduleSelectedCycleDay = 1;
    scheduleCopyTargetDay = 2;
    scheduleErrors = [];
    scheduleStatus = "";
    render();
  }

  function saveScheduleEditor() {
    const result = compileScheduleDraft(scheduleDraft);
    if (!result.ok) {
      scheduleErrors = result.errors.map(({ message }) => message);
      scheduleStatus = "Nothing was saved. Fix the highlighted schedule details.";
      render();
      return;
    }
    const nextState = structuredClone(state);
    nextState.plan = result.value;
    nextState.preferences = { ...nextState.preferences, teacherId: scheduleTeacherId };
    nextState.updatedAt = now().toISOString();
    selectedTeacherId = scheduleTeacherId;
    const returnRoute = scheduleReturnRoute;
    resetScheduleEditor();
    replaceState(nextState, { domains: ["plan", "preferences"], alreadyPersisted: false });
    if (returnRoute === "setup") {
      route = "setup";
      render();
    }
  }

  async function stageScheduleBackup(file) {
    try {
      const text = await (services.readFileText ? services.readFileText(file) : file.text());
      const parsed = JSON.parse(text);
      const candidate = parsed?.format === "playbook.teacherPlan.v2" ? parsed : parsed?.plan;
      scheduleDraft = createScheduleDraftFromPlan(candidate);
      scheduleTeacherId = scheduleDraft.teachers[0].id;
      scheduleSelectedCycleDay = 1;
      scheduleCopyTargetDay = 2;
      scheduleErrors = [];
      scheduleStatus = "Backup opened for review. Nothing changes until Save schedule is selected.";
    } catch {
      scheduleErrors = ["That CIRC backup could not be opened. The current schedule was not changed."];
      scheduleStatus = "";
    }
    render();
  }

  function scheduleEditorContext() {
    ensureScheduleEditor();
    return {
      teachers: scheduleDraft.teachers,
      selectedTeacherId: scheduleTeacherId,
      onSelectTeacher: selectScheduleTeacher,
      status: scheduleStatus,
      editor: {
        draft: scheduleUiDraft(),
        selectedCycleDay: scheduleSelectedCycleDay,
        copyTargetDay: scheduleCopyTargetDay,
        errors: scheduleErrors,
        callbacks: {
          onTeacherNameChange: updateScheduleTeacherName,
          onFirstSchoolDateChange: (value) => updateScheduleCalendar("anchorDate", value),
          onLastSchoolDateChange: (value) => updateScheduleCalendar("lastDate", value),
          onAnchorCycleDayChange: (value) => updateScheduleCalendar("anchorDay", value),
          onSelectCycleDay: (day) => {
            scheduleSelectedCycleDay = day;
            scheduleCopyTargetDay = day === 5 ? 1 : day + 1;
            render();
          },
          onAddEvent: addScheduleItem,
          onEventChange: updateScheduleItem,
          onDuplicateEvent: duplicateScheduleItem,
          onRemoveEvent: removeScheduleItem,
          onCopyTargetChange: (day) => {
            scheduleCopyTargetDay = day;
          },
          onCopyDay: copyScheduleToDay,
          onSave: saveScheduleEditor,
          onCancel: () => {
            const hasPlan = Boolean(state.plan);
            resetScheduleEditor();
            navigate(hasPlan ? "today" : "welcome");
          },
          onRestoreBackup: stageScheduleBackup
        }
      }
    };
  }

  function completeRecoveryRestore(nextState) {
    recoveryStatus = "primary";
    route = nextState.plan ? "today" : "welcome";
    navButtons.forEach((button, index) => restoreAttributes(button, navSnapshots[index]));
    replaceState(nextState, {
      domains: ["plan", "progress", "preferences", "content"],
      alreadyPersisted: true
    });
    if (resolvedCloudClient) runtime.connect(resolvedCloudClient);
  }

  function toggleTimeline() {
    timelineExpanded = !timelineExpanded;
    render();
  }

  function openPreview() {
    setupImportAllowed = false;
    configuredPreview = false;
    previewRunner = null;
    previewOnly = true;
    navigate("today");
  }

  function openConfiguredPreview(projectNumber) {
    if (!state.plan || !getProjectByNumber(projectNumber)) return;
    setupImportAllowed = false;
    configuredPreview = true;
    previewOnly = true;
    previewRunner = null;
    openRunner(projectNumber);
  }

  function openSetup() {
    setupImportAllowed = true;
    navigate("settings");
  }

  function openSchedule() {
    scheduleReturnRoute = null;
    navigate("schedule");
  }

  function openCloudSetup() {
    navigate("setup");
  }

  function render() {
    if (recoveryStatus === "unrecoverable") {
      root.replaceChildren(recoveryRoute({
        store,
        completeRestore: completeRecoveryRestore
      }));
      setBoardShell(false);
      for (const button of navButtons) {
        button.setAttribute("disabled", "");
        button.setAttribute("aria-disabled", "true");
        button.removeAttribute("aria-current");
      }
      lastRenderedMinute = "";
      lastRunnerLayoutKey = "";
      return;
    }
    const model = todayModel();
    reconcilePendingArtifactHandoff(model);
    const projectView = buildProjectHomeView(state, {
      teacherId: selectedTeacherId,
      previewOnly
    });
    const runner = selectedRunner();
    const actions = {
      navigate,
      openTeacher,
      openStudent,
      openRunner,
      openConfiguredPreview,
      openPreview,
      openSetup,
      openSchedule,
      openAnnouncements: () => navigate("announcements"),
      openCloudSetup,
      applyRunnerAction,
      chooseArtifactHandoff,
      confirmArtifactHandoff,
      cancelArtifactHandoff,
      completeProject,
      undoCompletion,
      selectTeacher,
      toggleTimeline,
      privateSeedMessage,
      projectView,
      lastCompletion,
      teacherKey: runnerOwnerKey(),
      schedule: runnerSchedule(model.current),
      previewOnly,
      currentReplicaLesson: getReplicaLessonChoice(runner?.modeId)
    };
    let view;
    if (route === "welcome") view = welcomeRoute(actions);
    else if (route === "setup") {
      view = buildSetupView(runtime.getSetupModel(), runtime.getSetupActions(), { document });
    }
    else if (route === "setup-help") {
      view = buildSetupHelpView(runtime.getSetupModel(), runtime.getSetupActions(), { document });
    }
    else if (route === "today") view = buildToday(model, actions, {
      timelineExpanded,
      artifactContext: teacherArtifactContext(model, projectView.currentProject.number)
    });
    else if (route === "board") {
      const liveCountdown = model.current?.id && model.countdown
        ? {
            eventId: model.current.id,
            minutes: model.countdown.minutes,
            target: model.countdown.target
          }
        : null;
      const board = buildBoardView(buildBoardProjection(state, model.current?.id, { liveCountdown }));
      view = boardRoute(board, navigate);
    }
    else if (route === "projects") view = projectsRoute(actions);
    else if (route === "announcements") view = announcementWorkflow();
    else if (route === "announcements-live") {
      if (evaluateAnnouncementDraft(announcementDraft).canGoLive) {
        view = buildAnnouncementsLiveView({
          draft: announcementDraft,
          onExit: () => navigate("announcements")
        }, { document });
      } else {
        route = "announcements";
        announcementStatus = "Teacher review is required before the broadcast view can open.";
        view = announcementWorkflow();
      }
    }
    else if (route === "project-teacher") {
      view = teacherProjectRoute(
        getProjectByNumber(selectedProjectNumber) ?? projectView.currentProject,
        actions
      );
    }
    else if (route === "experience-runner") {
      const project = getProjectByNumber(selectedProjectNumber) ?? projectView.currentProject;
      view = runner?.projectNumber === project.number
        ? experienceRunnerRoute(
            project,
            runner,
            actions,
            teacherArtifactContext(model, project.number, true)
          )
        : teacherProjectRoute(project, actions);
    }
    else if (route === "project-student") {
      view = studentProjectRoute(
        getProjectByNumber(selectedProjectNumber) ?? projectView.currentProject,
        {
          navigate: actions.navigate,
          teacherKey: actions.teacherKey,
          previewOnly: actions.previewOnly
        },
        runner
      );
    }
    else if (route === "schedule") view = scheduleRoute(scheduleEditorContext());
    else if (route === "room") view = roomRoute(state, runtime.getRoomPresentation());
    else {
      const context = {
        store,
        get state() {
          return state;
        },
        get previewToken() {
          return previewToken;
        },
        set previewToken(value) {
          previewToken = value;
        },
        migrationOptions: services.migrationOptions,
        privateSeedMessage,
        get importAllowed() {
          return Boolean(state.plan) || setupImportAllowed;
        },
        syncPresentation: runtime.getSyncPresentation(),
        openSetupHelp: runtime.getSetupActions().openSetupHelp,
        navigate,
        replaceState
      };
      view = settingsRoute(context);
    }
    if (runtime.getSetupModel().mode === "demo" && route !== "setup" && route !== "setup-help") {
      const exitDemo = element("button", {
        className: "primary-action demo-exit-action",
        text: "Exit demo and set up CIRC HQ",
        attributes: { type: "button" }
      });
      exitDemo.addEventListener("click", runtime.getSetupActions().exitDemo);
      view = element("div", { className: "demo-route-frame", attributes: { "data-mode": "demo" } }, [
        element("section", { className: "demo-route-notice" }, [
          element("p", { text: "Temporary demo. Nothing here is saved or synced." }),
          exitDemo
        ]),
        view
      ]);
    }
    const recoveryNotice = recoveryStatus === "recovered-backup"
      ? element("p", {
          className: "recovery-notice",
          text: "Recovered saved playbook state from the local backup because the saved primary copy could not be read. Export a backup before continuing.",
          attributes: { role: "alert" }
        })
      : null;
    root.replaceChildren(...[recoveryNotice, view].filter(Boolean));
    setBoardShell(
      route === "board" ||
      route === "project-student" ||
      route === "experience-runner" ||
      route === "announcements-live"
    );
    setNavigation();
    announceBoundary(model);
    const currentTime = now();
    lastRenderedMinute = `${localDateKey(currentTime)}:${currentTime.getHours()}:${currentTime.getMinutes()}`;
    lastRunnerLayoutKey = (route === "experience-runner" || route === "project-student")
      ? runnerLayoutKey(runner, model)
      : "";
  }

  for (const button of navButtons) {
    button.addEventListener("click", () => navigate(button.dataset.route));
  }

  render();

  const cloudClientPreload = services.cloudClient
    ? Promise.resolve(services.cloudClient)
    : services.cloudClientPromise
      ? Promise.resolve(services.cloudClientPromise).catch(() => createFirebaseClient({ config: {} }))
      : import("../firebase-config.js")
          .then((module) => createBrowserFirebaseClient(module.firebaseConfig))
          .catch(() => createFirebaseClient());
  let resolvedCloudClient = null;

  const privateSeedPromise = services.loadPrivateSeed === false
    ? Promise.resolve({ status: "disabled", state, nextAction: null })
    : loadPrivateSeedOnLocalhost({
        hostname: services.hostname ?? window.location.hostname,
        fetchImpl: services.fetchImpl ?? window.fetch.bind(window),
        store
      }).then((result) => {
        if (result.status === "applied") {
          adoptPersistedState(result.state);
          setupImportAllowed = false;
          route = "today";
          privateSeedMessage = "";
          render();
        } else if (result.nextAction) {
          privateSeedMessage = result.nextAction;
          render();
        }
        return result;
      });

  const readyPromise = Promise.all([privateSeedPromise, cloudClientPreload])
    .then(async ([seedResult, cloudClient]) => {
      resolvedCloudClient = cloudClient;
      if (!appDestroyed && recoveryStatus !== "unrecoverable") {
        const connection = runtime.connect(cloudClient);
        await (connection?.ready ?? Promise.resolve());
      }
      return seedResult;
    });

  const timer = window.setInterval(() => {
    if (recoveryStatus === "unrecoverable") return;
    const currentTime = now();
    const { runner } = reconcileRunner();
    const clockNode = root.querySelector("[data-live-clock]");
    if (clockNode) {
      clockNode.textContent = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      }).format(currentTime);
    }
    const minuteKey = `${localDateKey(currentTime)}:${currentTime.getHours()}:${currentTime.getMinutes()}`;
    if (route === "experience-runner" || route === "project-student") {
      refreshRunnerView(runner);
    } else if (minuteKey !== lastRenderedMinute) render();
  }, 1000);

  const handleVisibilityChange = () => {
    if (recoveryStatus === "unrecoverable") return;
    if (document.visibilityState !== "hidden") {
      const { runner } = reconcileRunner();
      if (route === "experience-runner" || route === "project-student") refreshRunnerView(runner);
    }
  };
  document.addEventListener?.("visibilitychange", handleVisibilityChange);

  if (weatherService?.load) {
    Promise.resolve(weatherService.load())
      .then((summary) => {
        weather = summary;
        if (route === "today") render();
      })
      .catch(() => {
        weather = { status: "unavailable", label: "Weather unavailable" };
        if (route === "today") render();
      });
  }

  return {
    navigate,
    selectTeacher,
    get previewOnly() {
      return previewOnly;
    },
    ready: readyPromise,
    destroy() {
      appDestroyed = true;
      runtime.destroy();
      window.clearInterval(timer);
      document.removeEventListener?.("visibilitychange", handleVisibilityChange);
      restoreAttributes(siteHeader, siteHeaderSnapshot);
      restoreAttributes(liveStatus, liveStatusSnapshot);
      if (liveStatus) liveStatus.textContent = "";
      navButtons.forEach((button, index) => restoreAttributes(button, navSnapshots[index]));
      for (const button of navButtons) button.replaceWith(button.cloneNode(true));
    }
  };
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app-main");
  if (root) renderApp(root);
}
