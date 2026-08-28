import { buildBoardProjection } from "./model/access.js";
import { createWeatherService } from "./services/weather.js";
import { LocalStore } from "./storage/local-store.js";
import { buildBoardView } from "./ui/board.js";
import { buildCurriculumView } from "./ui/curriculum.js";
import { buildRoomView } from "./ui/room.js";
import {
  applyPlanImport,
  exportSettingsBackup,
  previewClosure,
  previewCycleDayOverride,
  previewMakeupDayStatus,
  previewPlanImport,
  previewSpecialEvent
} from "./ui/settings.js";
import { buildTodayPresentation } from "./ui/today-ui.js";
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

function svgIcon(icon) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", icon.label);
  svg.setAttribute("class", `weather-icon weather-icon-${icon.name}`);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const definition of icon.paths) {
    const child = document.createElementNS("http://www.w3.org/2000/svg", definition.tag);
    for (const [name, value] of Object.entries(definition)) {
      if (name !== "tag") child.setAttribute(name, String(value));
    }
    svg.append(child);
  }
  return svg;
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
  }, [svgIcon(weather.icon), element("div", { className: "weather-copy" }, copy)]);
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

function buildToday(model, actions, options) {
  const presentation = buildTodayPresentation(model, options);
  const children = [buildHeading(model, () => actions.navigate("board"))];
  if (presentation.showTeacherSelector) {
    children.push(buildTeacherPicker(model, actions.selectTeacher));
  }
  if (presentation.setup) {
    children.push(buildPlanNotice(
      presentation.setup,
      actions.navigate,
      actions.privateSeedMessage
    ));
    return element("section", { attributes: { "data-view": "today" } }, children);
  }

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
  children.push(buildTimeline(dashboard.timeline, actions.toggleTimeline));
  if (actions.privateSeedMessage) {
    children.push(buildPrivateSeedRecovery(actions.privateSeedMessage, actions.navigate));
  }
  children.push(element("details", { className: "today-details" }, [
    element("summary", { text: "Details" }),
    element("p", { text: dashboard.quietStatus }),
    element("a", {
      className: "attribution-link",
      text: "Weather by Open-Meteo",
      attributes: { href: "https://open-meteo.com/", target: "_blank", rel: "noreferrer" }
    })
  ]));
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

function curriculumRoute(state, model) {
  const view = buildCurriculumView(model.current ?? model.next ?? {}, state);
  const cards = view.cards.map((card, index) => {
    const content = Array.isArray(card.value)
      ? (card.value.length ? textList(card.value) : element("p", { text: "Nothing added yet" }))
      : element("p", { text: card.value || "Nothing added yet" });
    return element("details", {
      className: `tool-card${card.visibility === "teacher-private" ? " private-card" : ""}`,
      attributes: index === 0 ? { open: "" } : {}
    }, [
      element("summary", { text: card.label }),
      content
    ]);
  });
  return element("section", { attributes: { "data-view": "curriculum" } }, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The Playbook" }),
        element("h1", { text: "Curriculum" }),
        element("p", { className: "date-line", text: `${view.title} | ${view.status}` })
      ])
    ]),
    element("div", { className: "tool-grid" }, cards),
    element("section", { className: "legacy-library" }, [
      element("h2", { text: view.legacyLibrary.title }),
      element("p", { text: `${view.legacyLibrary.count} preserved experiences remain in the classroom runner.` }),
      element("a", {
        className: "button-link",
        text: "Open Legacy Activity Library",
        attributes: { href: view.legacyLibrary.href }
      })
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
  const importMessage = element("p", {
    className: "import-message",
    text: context.privateSeedMessage || "Choose a supported teacher-plan JSON file to preview changes."
  });
  const applyButton = element("button", {
    className: "primary-action",
    text: "Apply",
    attributes: { type: "button", disabled: "" }
  });
  const picker = element("input", {
    attributes: { type: "file", accept: "application/json,.json" }
  });

  picker.addEventListener("change", async () => {
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

  return element("section", {}, [
    element("div", { className: "page-heading" }, [
      element("div", {}, [
        element("p", { className: "eyebrow", text: "The Playbook" }),
        element("h1", { text: "Settings" }),
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
        element("h2", { text: "Classroom compatibility" }),
        element("p", { text: "The preserved classroom application remains available during the transition." }),
        element("a", {
          className: "button-link",
          text: "Open classroom compatibility",
          attributes: { href: "classroom-legacy.html" }
        })
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
  let route = "today";
  let selectedTeacherId =
    services.teacherId ??
    state.preferences?.teacherId ??
    state.plan?.teachers?.[0]?.id ??
    null;
  let weather = { status: "unavailable", label: "Weather unavailable" };
  let previewToken = null;
  let privateSeedMessage = "";
  let timelineExpanded = false;
  let lastBoundaryKey = "";
  let lastRenderedMinute = "";
  const siteHeader = document.querySelector(".site-header");
  const liveStatus = document.getElementById("app-status");
  const navButtons = [...document.querySelectorAll("[data-route]")];
  const siteHeaderSnapshot = snapshotAttributes(siteHeader);
  const liveStatusSnapshot = snapshotAttributes(liveStatus);
  const navSnapshots = navButtons.map((button) => snapshotAttributes(button));

  const now = () => services.clock?.now?.() ?? new Date();

  function todayModel() {
    const currentTime = now();
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
    for (const button of navButtons) {
      const active = button.dataset.route === route;
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
    route = nextRoute;
    if (nextRoute !== "today") timelineExpanded = false;
    render();
    root.focus({ preventScroll: true });
  }

  function selectTeacher(teacherId) {
    selectedTeacherId = teacherId;
    render();
  }

  function replaceState(nextState) {
    state = nextState;
    selectedTeacherId = state.plan?.teachers?.[0]?.id ?? null;
    timelineExpanded = false;
    render();
  }

  function toggleTimeline() {
    timelineExpanded = !timelineExpanded;
    render();
  }

  function render() {
    const model = todayModel();
    const actions = {
      navigate,
      selectTeacher,
      toggleTimeline,
      privateSeedMessage
    };
    let view;
    if (route === "today") view = buildToday(model, actions, { timelineExpanded });
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
    else if (route === "curriculum") view = curriculumRoute(state, model);
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
        replaceState
      };
      view = settingsRoute(context);
    }
    root.replaceChildren(view);
    setBoardShell(route === "board");
    setNavigation();
    announceBoundary(model);
    const currentTime = now();
    lastRenderedMinute = `${localDateKey(currentTime)}:${currentTime.getHours()}:${currentTime.getMinutes()}`;
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
          selectedTeacherId = state.plan?.teachers?.[0]?.id ?? null;
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
    const clockNode = root.querySelector("[data-live-clock]");
    if (clockNode) {
      clockNode.textContent = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      }).format(currentTime);
    }
    const minuteKey = `${localDateKey(currentTime)}:${currentTime.getHours()}:${currentTime.getMinutes()}`;
    if (minuteKey !== lastRenderedMinute) render();
  }, 1000);

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
    ready: privateSeedPromise,
    destroy() {
      window.clearInterval(timer);
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
