import { buildBoardProjection } from "./model/access.js";
import { buildAdminPlanDocument } from "./model/admin-plan.js";
import { EXPERIENCE_TIMING_PLANS } from "./model/experience-timing-plans.js";
import {
  advanceExperienceRunnerClock,
  applyExperienceRunnerAction,
  createExperienceRunner,
  getActiveRunnerStep,
  validateExperienceRunner
} from "./model/experience-runner.js";
import { PROJECTS, getProjectByNumber } from "./model/project-catalog.js";
import { ownerKeyForTeacher } from "./model/state.js";
import { createWeatherService } from "./services/weather.js";
import { LocalStore } from "./storage/local-store.js";
import { buildBoardView } from "./ui/board.js";
import { buildRoomView } from "./ui/room.js";
import { advanceProjectProgress, buildProjectHomeView } from "./ui/project-home.js";
import {
  applyPlanImport,
  exportSettingsBackup,
  previewClosure,
  previewCycleDayOverride,
  previewMakeupDayStatus,
  previewPlanImport,
  previewSpecialEvent
} from "./ui/settings.js";
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
  setup.addEventListener("click", actions.openSetup);
  const preview = element("button", {
    className: "secondary-action welcome-secondary",
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
      element("div", { className: "welcome-actions" }, [setup, preview])
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
        : actionButton(view.actions.run, "project-run-button", () => actions.openRunner(project.number), "arrow-right")
    ]),
    element("div", { className: "project-quick-actions" }, [
      actionButton(view.actions.teacher, "project-quick-button", () => actions.openTeacher(project.number), "presentation-chart"),
      actionButton(view.actions.student, "project-quick-button", () => actions.openStudent(project.number), "student")
    ])
  ]);
}

function projectArtwork(project, className) {
  return project.number === 2
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
  for (const direction of step.directions.slice(0, 3)) {
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

function experienceRunnerRoute(project, runner, actions) {
  const timer = runner.timer;
  if (timer.status === "complete") {
    return element("section", {
      className: "experience-runner",
      attributes: { "data-view": "experience-runner" }
    }, [
      element("div", { className: "runner-heading" }, [
        element("p", { className: "project-kicker", text: `Experience ${project.number} of ${PROJECTS.length}` }),
        element("h1", { text: "Lesson complete" }),
        element("p", { text: `${project.title} is complete. Both timers have stopped.` }),
        actionButton("Back to Today", "primary-action", () => actions.navigate("today"))
      ]),
      element("div", { className: "runner-timer-bar" }, [
        runnerTimerCard("Class timer", 0, "class"),
        runnerTimerCard("Step timer", 0, "step", "runner-step-timer")
      ])
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
  const controls = actions.previewOnly
    ? []
    : detourActive
      ? [
          actionButton("Add 2 minutes", "runner-control", () => actions.applyRunnerAction("add-detour-time")),
          actionButton("Return to build", "runner-control runner-primary-control", () => actions.applyRunnerAction("return-to-build")),
          actionButton("Safe Landing", "runner-control runner-safe-landing", () => actions.applyRunnerAction("safe-landing"))
        ]
      : ready
      ? [primaryControl]
      : [
          primaryControl,
          actionButton("+1 minute", "runner-control", () => actions.applyRunnerAction("add-minute")),
          actionButton("Previous", "runner-control", () => actions.applyRunnerAction("previous")),
          actionButton(lastStep ? "Finish Lesson" : "Next Step", "runner-control runner-next", () => actions.applyRunnerAction(lastStep ? "finish" : "next")),
          ...(!paused
            ? [actionButton("Question Detour", "runner-control runner-detour-control", () => actions.applyRunnerAction("start-detour"))]
            : [])
        ];
  const teacherDirections = runnerTeacherDirections(step);
  const studentDirections = step.directions.slice(0, 3);
  return element("section", {
    className: "experience-runner",
    attributes: { "data-view": "experience-runner" }
  }, [
    element("div", { className: "runner-heading" }, [
      actionButton("Back to Today", "detail-back", () => actions.navigate("today")),
      element("p", { className: "project-kicker", text: `Experience ${project.number} of ${PROJECTS.length}` }),
      element("h1", { text: project.title }),
      actions.previewOnly
        ? element("p", { className: "runner-preview-label", text: "Preview only" })
        : null,
      actionButton("Student directions", "primary-action runner-student-action", () => actions.openStudent(project.number), "student")
    ]),
    actions.schedule ? element("div", { className: "runner-schedule" }, [
      element("strong", { text: `Class ends at ${actions.schedule.endLabel}` }),
      element("span", { text: `Cleanup begins at ${actions.schedule.cleanupLabel}` })
    ]) : null,
    element("div", { className: "runner-timer-bar" }, [
      runnerTimerCard("Class timer", timer.totalRemainingSeconds, "class"),
      runnerTimerCard("Step timer", timer.currentStepRemainingSeconds, "step", "runner-step-timer")
    ]),
    detourActive ? runnerDetour(runner.detour) : null,
    expired ? element("p", {
      className: "runner-expired",
      text: detourActive
        ? "Step time is up. Return to build or choose Safe Landing."
        : "Step time is up. Choose Next Step when the class is ready.",
      attributes: { role: "alert" }
    }) : null,
    element("section", { className: "runner-step-card" }, [
      element("p", { className: "section-kicker", text: `Step ${timer.currentStepIndex + 1} of ${runner.steps.length}` }),
      element("h2", { text: step.label }),
      element("div", { className: "runner-now-grid" }, [
        runnerCue("Say", teacherDirections[0] ?? "Name the next step."),
        runnerCue("Do", teacherDirections.slice(1)),
        element("section", { className: "runner-cue runner-student-card" }, [
          element("h3", { text: "Students" }),
          runnerStudentDirections(step)
        ]),
        runnerCue(
          "Done when",
          `Students have completed ${studentDirections.length === 1 ? "this direction" : `all ${studentDirections.length} directions`} and can show the result.`
        ),
        runnerCue("If stuck", "Pause. Model one example. Restart with one team."),
        runnerCue("Finished early", [project.fastFinish.title, project.fastFinish.directions]),
        runnerCue("Return to the build", "Good question. Let us test it while we keep building.", "runner-return-cue")
      ]),
      runnerMoreContext(project)
    ]),
    controls.length ? element("div", { className: "runner-controls" }, controls) : null
  ].filter(Boolean));
}

function studentRunnerRoute(project, runner, actions) {
  const step = getActiveRunnerStep(runner, { teacherKey: actions.teacherKey });
  const timer = runner.timer;
  return element("section", {
    className: "board-view project-student-view runner-student-view",
    attributes: { "data-view": "project-student" }
  }, [
    element("div", { className: "board-heading" }, [
      element("p", { className: "eyebrow", text: "Student directions" }),
      element("h1", { text: project.title }),
      actions.previewOnly
        ? element("p", { className: "runner-preview-label", text: "Preview only" })
        : null,
      element("p", { className: "board-lesson", text: `Step ${timer.currentStepIndex + 1} of ${runner.steps.length}: ${step.label}` }),
      actionButton("Exit student view", "primary-action", () => actions.navigate("today"))
    ]),
    projectArtwork(project, "runner-student-art"),
    element("div", { className: "runner-timer-bar runner-student-timers" }, [
      runnerTimerCard("Class timer", timer.totalRemainingSeconds, "class"),
      runnerTimerCard("Step timer", timer.currentStepRemainingSeconds, "step", "runner-step-timer")
    ]),
    element("section", { className: "board-section runner-student-step" }, [
      element("h2", { text: step.label }),
      runnerStudentDirections(step)
    ])
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
  children.push(buildIndependencePath(projectView));
  children.push(buildProjectTrail(projectView, actions));
  children.push(buildFastFinish(projectView));

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

function roomRoute(state) {
  const view = buildRoomView(state);
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
    element("div", { className: "tool-grid" }, sections),
    element("section", { className: "private-resources" }, [
      element("h2", { text: "Private resources" }),
      ...privateResources
    ])
  ]);
}

function scheduleRoute(state, navigate) {
  const plan = state.plan;
  const teacherCount = Array.isArray(plan?.teachers) ? plan.teachers.length : 0;
  const button = element("button", { className: "primary-action", text: "Open schedule settings", attributes: { type: "button" } });
  button.addEventListener("click", () => navigate("settings"));
  return element("section", { attributes: { "data-view": "schedule" } }, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The Playbook" }),
        element("h1", { text: "Schedule" }),
        element("p", { className: "date-line", text: teacherCount ? `${teacherCount} teacher schedule loaded` : "Schedule not loaded yet" })
      ])
    ]),
    element("section", { className: "setup-card" }, [
      element("h2", { text: "Safe schedule changes" }),
      element("p", { text: "Preview imports and calendar changes in Settings before applying them." }),
      button
    ])
  ]);
}

function settingsRoute(context) {
  const readOnly = context.importAllowed !== true;
  const importMessage = element("p", {
    className: "import-message",
    text: readOnly
      ? "Read-only preview. Set up this device before importing or applying changes."
      : context.privateSeedMessage || "Choose a supported teacher-plan JSON file to preview changes.",
    attributes: { role: "status", "aria-live": "polite" }
  });
  const applyButton = element("button", {
    className: "primary-action",
    text: "Apply",
    attributes: { type: "button", disabled: "" }
  });
  const picker = element("input", {
    attributes: {
      type: "file",
      accept: "application/json,.json",
      ...(readOnly ? { disabled: "" } : {})
    }
  });

  picker.addEventListener("change", async () => {
    if (readOnly) return;
    context.previewToken = null;
    applyButton.setAttribute("disabled", "");
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
      importMessage.textContent = `Preview changes: ${preview.summary.teacherCount} teacher view(s), ${preview.summary.eventCount} scheduled event(s), ${preview.summary.addedCount} added, ${preview.summary.removedCount} removed, ${preview.summary.changedCount} changed.`;
    } catch {
      importMessage.textContent = "This file is unsupported or invalid. Existing local data was not changed. Check local migration options for a private v1 file.";
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
    context.replaceState(result.state);
    context.previewToken = null;
    applyButton.setAttribute("disabled", "");
    importMessage.textContent = "Validated plan applied on this browser.";
  });

  const stage = (preview) => {
    context.previewToken = preview.ok ? preview.previewToken : null;
    if (preview.ok) {
      applyButton.removeAttribute("disabled");
      importMessage.textContent = "Preview changes is ready. Select Apply to save it.";
    } else {
      applyButton.setAttribute("disabled", "");
      importMessage.textContent = "That change could not be previewed. Existing local data was not changed.";
    }
  };

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

  return element("section", {}, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The K-6 Playbook" }),
        element("h1", { text: "Teacher Setup" }),
        element("p", { className: "date-line", text: "Local setup and compatibility" })
      ])
    ]),
    element("div", { className: "settings-grid" }, [
      element("section", {}, [
        element("h2", { text: "Import schedule" }),
        importMessage,
        picker,
        applyButton
      ]),
      element("section", {}, [
        element("h2", { text: "Schedule" }),
        element("p", { text: "Review the currently loaded schedule without adding it to primary navigation." }),
        scheduleButton
      ]),
      element("section", {}, [
        element("h2", { text: "Calendar overrides" }),
        element("div", { className: "settings-row" }, [closureDate, closureButton]),
        element("div", { className: "settings-row" }, [makeupDate, makeupStatus, makeupButton]),
        element("div", { className: "settings-row" }, [cycleDate, cycleDay, cycleButton]),
        element("div", { className: "settings-row" }, [specialDate, specialLabel, specialButton])
      ]),
      element("section", {}, [
        element("h2", { text: "Backup" }),
        element("p", { text: "Export a complete local backup before a major change." }),
        exportButton
      ]),
      element("section", {}, [
        element("h2", { text: "Cloud activation status" }),
        element("p", { text: "Cloud setup is not configured. Local mode remains fully usable." })
      ]),
      element("section", {}, [
        element("h2", { text: "Weather resource" }),
        element("p", { text: "Forecast data is provided by Open-Meteo when available." }),
        element("a", {
          className: "attribution-link",
          text: "Open-Meteo attribution",
          attributes: { href: "https://open-meteo.com/", target: "_blank", rel: "noreferrer" }
        })
      ])
    ])
  ]);
}

export function renderApp(root, services = {}) {
  const store = services.store ?? new LocalStore(window.localStorage);
  const weatherService = services.weatherService ?? createWeatherService();
  const loaded = store.load();
  let state = loaded.state;
  let route = state.plan ? "today" : "welcome";
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
  let previewOnly = !state.plan;
  let setupImportAllowed = false;
  let privateSeedMessage = "";
  let timelineExpanded = false;
  let lastBoundaryKey = "";
  let lastRenderedMinute = "";
  let lastRunnerLayoutKey = "";
  const siteHeader = document.querySelector(".site-header");
  const liveStatus = document.getElementById("app-status");
  const navButtons = [...document.querySelectorAll("[data-route]")];
  const siteHeaderSnapshot = snapshotAttributes(siteHeader);
  const liveStatusSnapshot = snapshotAttributes(liveStatus);
  const navSnapshots = navButtons.map((button) => snapshotAttributes(button));

  const now = () => services.clock?.now?.() ?? new Date();

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
    const runner = state.experienceRunners?.[owner];
    if (!runner) return null;
    if (!validateExperienceRunner(runner, { teacherKey: owner }).ok) return null;
    const currentTime = now().getTime();
    const lastTickTime = new Date(runner.lastTickAt).getTime();
    const updatedTime = new Date(runner.updatedAt).getTime();
    return lastTickTime <= currentTime && updatedTime <= currentTime ? runner : null;
  }

  function setRunnerInMemory(runner) {
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
    if (previewOnly) return selectedRunner();
    setRunnerInMemory(runner);
    state.updatedAt = now().toISOString();
    state = typeof store.save === "function" ? store.save(state) : state;
    return selectedRunner();
  }

  function runnerLayoutKey(runner) {
    if (!runner) return "";
    return `${route}:${runner.projectNumber}:${runner.timer.currentStepIndex}:${runner.timer.status}:${runner.detour?.status ?? "build"}`;
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
    const key = runnerLayoutKey(runner);
    if (
      (route === "experience-runner" || route === "project-student") &&
      key === lastRunnerLayoutKey &&
      updateRunnerTimerText(runner)
    ) return;
    render();
  }

  function reconcileRunner() {
    const runner = selectedRunner();
    if (previewOnly) return { runner, changed: false };
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

  function openRunner(projectNumber) {
    const project = getProjectByNumber(projectNumber);
    if (!project) return;
    const current = selectedRunner();
    if (
      !current ||
      current.projectNumber !== projectNumber ||
      current.timer.status === "complete" ||
      (!previewOnly && current.timer.status === "ready")
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
        ...(projectNumber === 2 ? { modeId: "build-new" } : {})
      });
      if (previewOnly) setRunnerInMemory(created);
      else saveRunner(created);
    }
    selectedProjectNumber = projectNumber;
    navigate("experience-runner");
  }

  function applyRunnerAction(action) {
    if (previewOnly) return;
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
    return buildTodayViewModel({
      plan: state.plan,
      teacherId: selectedTeacherId,
      dateKey: localDateKey(currentTime),
      now: currentTime,
      nowMinutes: currentTime.getHours() * 60 + currentTime.getMinutes(),
      weather,
      syncStatus: services.syncStatus ?? "local"
    });
  }

  function setNavigation() {
    const activeRoute = ["project-teacher", "project-student"].includes(route)
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
    reconcileRunner();
    if (nextRoute === "today" && !state.plan) previewOnly = true;
    route = nextRoute;
    if (nextRoute !== "today") timelineExpanded = false;
    render();
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
    state = typeof store.save === "function" ? store.save(updated) : updated;
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
    state = typeof store.save === "function"
      ? store.save(completion.previousState)
      : structuredClone(completion.previousState);
    selectedTeacherId = completion.teacherId;
    selectedProjectNumber = completion.projectNumber;
    navigate("today");
  }

  function selectTeacher(teacherId) {
    lastCompletion = null;
    selectedTeacherId = teacherId;
    selectedProjectNumber = buildProjectHomeView(
      state,
      { teacherId: selectedTeacherId }
    ).currentProject.number;
    render();
  }

  function replaceState(nextState) {
    lastCompletion = null;
    state = nextState;
    previewOnly = !state.plan;
    if (state.plan) setupImportAllowed = false;
    if (state.plan) route = "today";
    selectedTeacherId = state.plan?.teachers?.[0]?.id ?? null;
    selectedProjectNumber = buildProjectHomeView(
      state,
      { teacherId: selectedTeacherId }
    ).currentProject.number;
    timelineExpanded = false;
    render();
  }

  function toggleTimeline() {
    timelineExpanded = !timelineExpanded;
    render();
  }

  function openPreview() {
    setupImportAllowed = false;
    previewOnly = true;
    navigate("today");
  }

  function openSetup() {
    setupImportAllowed = true;
    navigate("settings");
  }

  function render() {
    const model = todayModel();
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
      openPreview,
      openSetup,
      applyRunnerAction,
      completeProject,
      undoCompletion,
      selectTeacher,
      toggleTimeline,
      privateSeedMessage,
      projectView,
      lastCompletion,
      teacherKey: runnerOwnerKey(),
      schedule: runnerSchedule(model.current),
      previewOnly
    };
    let view;
    if (route === "welcome") view = welcomeRoute(actions);
    else if (route === "today") view = buildToday(model, actions, { timelineExpanded });
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
    else if (route === "project-teacher") {
      view = teacherProjectRoute(
        getProjectByNumber(selectedProjectNumber) ?? projectView.currentProject,
        actions
      );
    }
    else if (route === "experience-runner") {
      const project = getProjectByNumber(selectedProjectNumber) ?? projectView.currentProject;
      view = runner?.projectNumber === project.number
        ? experienceRunnerRoute(project, runner, actions)
        : teacherProjectRoute(project, actions);
    }
    else if (route === "project-student") {
      view = studentProjectRoute(
        getProjectByNumber(selectedProjectNumber) ?? projectView.currentProject,
        actions,
        runner
      );
    }
    else if (route === "schedule") view = scheduleRoute(state, navigate);
    else if (route === "room") view = roomRoute(state);
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
        navigate,
        replaceState
      };
      view = settingsRoute(context);
    }
    root.replaceChildren(view);
    setBoardShell(route === "board" || route === "project-student");
    setNavigation();
    announceBoundary(model);
    const currentTime = now();
    lastRenderedMinute = `${localDateKey(currentTime)}:${currentTime.getHours()}:${currentTime.getMinutes()}`;
    lastRunnerLayoutKey = (route === "experience-runner" || route === "project-student")
      ? runnerLayoutKey(runner)
      : "";
  }

  for (const button of navButtons) {
    button.addEventListener("click", () => navigate(button.dataset.route));
  }

  render();

  const privateSeedPromise = services.loadPrivateSeed === false
    ? Promise.resolve({ status: "disabled", state, nextAction: null })
    : loadPrivateSeedOnLocalhost({
        hostname: services.hostname ?? window.location.hostname,
        fetchImpl: services.fetchImpl ?? window.fetch.bind(window),
        store
      }).then((result) => {
        if (result.status === "applied") {
          state = result.state;
          previewOnly = false;
          setupImportAllowed = false;
          route = "today";
          selectedTeacherId = state.plan?.teachers?.[0]?.id ?? null;
          selectedProjectNumber = buildProjectHomeView(
            state,
            { teacherId: selectedTeacherId }
          ).currentProject.number;
          privateSeedMessage = "";
          render();
        } else if (result.nextAction) {
          privateSeedMessage = result.nextAction;
          render();
        }
        return result;
      });

  const timer = window.setInterval(() => {
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
    ready: privateSeedPromise,
    destroy() {
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
