import { validateTeacherPlan } from "./model/teacher-plan.js";
import { createWeatherService } from "./services/weather.js";
import { LocalStore } from "./storage/local-store.js";
import { buildTodayViewModel } from "./ui/view-model.js";

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

function timeRange(event) {
  return event ? `${event.startLabel} to ${event.endLabel}` : "None remaining today";
}

function priorityCard(className, label, value, meta, liveClock = false) {
  const valueNode = element("strong", {
    className: `value${liveClock ? " clock-value" : ""}`,
    text: value,
    attributes: liveClock ? { "data-live-clock": "" } : {}
  });
  return element("section", { className: `priority-card ${className}` }, [
    element("span", { className: "label", text: label }),
    valueNode,
    element("span", { className: "meta", text: meta })
  ]);
}

function buildHeading(model, onBoard) {
  const boardButton = element("button", {
    className: "board-button",
    text: "Put it on the board",
    attributes: { type: "button" }
  });
  boardButton.addEventListener("click", onBoard);
  return element("div", { className: "page-heading" }, [
    element("div", {}, [
      element("p", { className: "eyebrow", text: "Today" }),
      element("h1", { text: "The Playbook" }),
      element("p", { className: "date-line", text: model.clock.dateLabel })
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

function buildPriority(model) {
  const cycleValue = model.cycle.day ? `Day ${model.cycle.day}` : "No cycle day";
  const currentValue = model.current?.title ?? model.currentLabel;
  const currentMeta = model.current
    ? `${timeRange(model.current)} | ${model.countdown?.label ?? ""}`
    : model.countdown?.label ?? "No countdown";
  const nextValue = model.next?.title ?? "None remaining today";
  const nextMeta = model.next ? model.next.startLabel : "Day complete";
  const activeDuty = model.duties.active;
  const dutyAlert = model.alerts.duty;
  const dutyValue = activeDuty
    ? model.duties.event.title
    : dutyAlert
      ? `${dutyAlert.label} in ${dutyAlert.minutes}m`
      : "No duty now";
  const dutyMeta = activeDuty
    ? `${model.duties.assignment} | ${model.duties.location}`
    : dutyAlert
      ? `${dutyAlert.assignment} | ${dutyAlert.location}`
      : "Duty alert is clear";

  return element("div", { className: "today-priority" }, [
    priorityCard("clock", cycleValue, model.clock.timeLabel, model.cycle.source, true),
    priorityCard("current", "Current", currentValue, currentMeta),
    priorityCard("next", "Next", nextValue, nextMeta),
    priorityCard("duty", activeDuty ? "Duty active" : "Duty", dutyValue, dutyMeta)
  ]);
}

function buildStatusStrip(model) {
  const cards = [
    element("div", {
      className: `status-card${model.weather.status === "unavailable" ? " warning" : ""}`,
      text: model.weather.label
    })
  ];
  if (model.specialEvents.length) {
    const event = model.specialEvents[0];
    cards.push(
      element("div", {
        className: "status-card warning",
        text: `${event.title}: ${event.timeLabel}`
      })
    );
  } else {
    cards.push(element("div", { className: "status-card", text: model.sync.label }));
  }
  return element("div", { className: "status-strip" }, cards);
}

function buildTimeline(model) {
  const list = element("div", { className: "timeline" });
  if (!model.timeline.length) {
    list.append(
      element("div", { className: "empty-schedule" }, [
        element("strong", { text: model.currentLabel }),
        element("p", { text: model.nextAction || "No events are available for this day." })
      ])
    );
  }
  for (const event of model.timeline) {
    list.append(
      element("article", { className: `timeline-row ${event.state}` }, [
        element("div", {
          className: "timeline-time",
          text: `${event.startLabel} to ${event.endLabel}`
        }),
        element("div", {}, [
          element("div", { className: "timeline-title", text: event.title }),
          element("span", { className: "timeline-state", text: event.state })
        ])
      ])
    );
  }
  return element("section", { className: "timeline-column" }, [
    element("h2", { text: "Full timeline" }),
    list
  ]);
}

function buildResetCard() {
  const guidance = element("p", {
    className: "reset-guidance",
    text: "Choose a reset only when you need one."
  });
  const choices = {
    Technology: "Pause the screen, name the offline next step, then continue.",
    Time: "Protect the essential outcome and move the rest to the next block.",
    Behavior: "Stop, restate the expectation, and restart with one clear action.",
    Materials: "Use the closest safe substitute and note what needs restocked."
  };
  const buttons = Object.entries(choices).map(([label, text]) => {
    const button = element("button", {
      text: label,
      attributes: { type: "button" }
    });
    button.addEventListener("click", () => {
      guidance.textContent = text;
    });
    return button;
  });
  return element("section", { className: "card" }, [
    element("p", { className: "eyebrow", text: "One-tap reset" }),
    element("h2", { text: "Reset the block" }),
    element("div", { className: "reset-actions" }, buttons),
    guidance
  ]);
}

function buildOperations(model) {
  const weatherChildren = [
    element("p", { className: "eyebrow", text: "Duty weather" }),
    element("h2", { text: model.weather.label }),
    element("p", { text: model.weather.detail || "Schedule remains available if weather cannot load." })
  ];
  for (const forecast of model.weather.dutyForecasts ?? []) {
    weatherChildren.push(
      element("p", {
        text: `${forecast.timeLabel}: ${forecast.condition}, ${forecast.precipitationProbability} rain, ${forecast.temperature}, wind ${forecast.wind}`
      })
    );
  }
  weatherChildren.push(
    element("a", {
      text: "Weather by Open-Meteo",
      attributes: {
        href: "https://open-meteo.com/",
        target: "_blank",
        rel: "noreferrer"
      }
    })
  );
  const children = [element("section", { className: "card" }, weatherChildren)];
  if (model.specialEvents.length) {
    const special = model.specialEvents[0];
    children.push(
      element("section", { className: "card special-banner" }, [
        element("p", { className: "eyebrow", text: "Special event" }),
        element("h2", { text: special.title }),
        element("p", { text: special.timeLabel })
      ])
    );
  }
  children.push(
    element("section", { className: "card" }, [
      element("p", { className: "eyebrow", text: "Sync status" }),
      element("h2", { text: model.sync.label }),
      element("p", { text: "The Playbook remains usable in local mode." })
    ]),
    buildResetCard()
  );
  return element("aside", {
    className: "operations-column",
    attributes: { "aria-label": "Today details" }
  }, children);
}

function buildPlanNotice(model, navigate) {
  const button = element("button", {
    className: "primary-action",
    text: "Open Settings",
    attributes: { type: "button" }
  });
  button.addEventListener("click", () => navigate("settings"));
  return element("section", { className: "empty-schedule" }, [
    element("h2", {
      text: model.status === "plan-unsupported" ? "Plan format not supported" : "Teacher plan needed"
    }),
    element("p", { text: model.nextAction }),
    button
  ]);
}

function buildToday(model, actions) {
  const children = [buildHeading(model, () => actions.navigate("board"))];
  if (model.teacher.options.length) {
    children.push(buildTeacherPicker(model, actions.selectTeacher));
  }
  if (["plan-required", "plan-unsupported", "teacher-unavailable"].includes(model.status)) {
    children.push(buildPlanNotice(model, actions.navigate));
    return element("section", { attributes: { "data-view": "today" } }, children);
  }

  children.push(
    buildPriority(model),
    buildStatusStrip(model),
    element("div", { className: "today-grid" }, [
      buildTimeline(model),
      buildOperations(model)
    ])
  );
  return element("section", { attributes: { "data-view": "today" } }, children);
}

function emptyRoute(title, message) {
  return element("section", { className: "empty-view" }, [
    element("p", { className: "eyebrow", text: "The Playbook" }),
    element("h1", { text: title }),
    element("p", { text: message })
  ]);
}

function boardRoute(model, navigate) {
  const exit = element("button", {
    className: "primary-action",
    text: "Return to Today",
    attributes: { type: "button" }
  });
  exit.addEventListener("click", () => navigate("today"));
  return element("section", { className: "board-placeholder" }, [
    element("div", { className: "card" }, [
      element("p", { className: "eyebrow", text: "Board" }),
      element("h1", { text: model.current?.title || model.next?.title || "Board is ready for setup" }),
      element("p", {
        text: "The full classroom-facing Board arrives in Task 5. This preview does not expose teacher notes or duty details."
      }),
      exit
    ])
  ]);
}

function countEvents(plan) {
  return plan.teachers.reduce(
    (total, teacher) =>
      total + Object.values(teacher.days).reduce(
        (sum, events) => sum + (Array.isArray(events) ? events.length : 0),
        0
      ),
    0
  );
}

function settingsRoute(context) {
  const importMessage = element("p", {
    className: "import-message",
    text: "Choose a playbook.teacherPlan.v2 JSON file. The older private v1 format is not migrated in this task."
  });
  const applyButton = element("button", {
    className: "primary-action",
    text: "Apply validated plan",
    attributes: { type: "button", disabled: "" }
  });
  const picker = element("input", {
    attributes: { type: "file", accept: "application/json,.json" }
  });

  picker.addEventListener("change", async () => {
    context.stagedPlan = null;
    applyButton.setAttribute("disabled", "");
    const file = picker.files?.[0];
    if (!file) {
      importMessage.textContent = "No file selected. Existing local data was not changed.";
      return;
    }
    try {
      const candidate = JSON.parse(await file.text());
      const validated = validateTeacherPlan(candidate);
      if (!validated.ok) throw new Error("unsupported");
      context.stagedPlan = validated.value;
      applyButton.removeAttribute("disabled");
      importMessage.textContent = `Ready to apply ${validated.value.teachers.length} teacher view(s) and ${countEvents(validated.value)} scheduled event(s).`;
    } catch {
      importMessage.textContent = "This file is unsupported or invalid. A validated v2 plan is required. Existing local data was not changed.";
    }
  });

  applyButton.addEventListener("click", () => {
    if (!context.stagedPlan) return;
    const result = context.store.importPlan(context.stagedPlan);
    if (!result.ok) {
      importMessage.textContent = "The plan could not be applied. Existing local data was not changed.";
      return;
    }
    context.replaceState(result.state);
    context.stagedPlan = null;
    applyButton.setAttribute("disabled", "");
    importMessage.textContent = "Validated plan applied on this browser.";
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
        element("h2", { text: "Schedule import" }),
        importMessage,
        picker,
        applyButton
      ]),
      element("section", {}, [
        element("h2", { text: "Cloud status" }),
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
  let stagedPlan = null;
  let lastBoundaryKey = "";
  let lastRenderedMinute = "";

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
    for (const button of document.querySelectorAll("[data-route]")) {
      const active = button.dataset.route === route;
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function announceBoundary(model) {
    const key = `${model.status}:${model.current?.id ?? "none"}:${model.next?.id ?? "none"}:${model.duties.active}`;
    if (lastBoundaryKey && key !== lastBoundaryKey) {
      const live = document.getElementById("app-status");
      if (live) live.textContent = `Schedule updated. ${model.currentLabel}.`;
    }
    lastBoundaryKey = key;
  }

  function navigate(nextRoute) {
    route = nextRoute;
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
    render();
  }

  function render() {
    const model = todayModel();
    const actions = { navigate, selectTeacher };
    let view;
    if (route === "today") view = buildToday(model, actions);
    else if (route === "board") view = boardRoute(model, navigate);
    else if (route === "curriculum") {
      view = emptyRoute("Curriculum", "Curriculum planning tools arrive in Task 5. Imported teacher data remains unchanged.");
    } else if (route === "schedule") {
      view = emptyRoute("Schedule", "The full schedule editor arrives in Task 5. Use Settings to import a validated plan now.");
    } else if (route === "room") {
      view = emptyRoute("Room", "Room inventory tools arrive in Task 5. No equipment or safety status is assumed here.");
    } else {
      const context = {
        store,
        get stagedPlan() {
          return stagedPlan;
        },
        set stagedPlan(value) {
          stagedPlan = value;
        },
        replaceState
      };
      view = settingsRoute(context);
    }
    root.replaceChildren(view);
    setNavigation();
    announceBoundary(model);
    const currentTime = now();
    lastRenderedMinute = `${localDateKey(currentTime)}:${currentTime.getHours()}:${currentTime.getMinutes()}`;
  }

  const navButtons = [...document.querySelectorAll("[data-route]")];
  for (const button of navButtons) {
    button.addEventListener("click", () => navigate(button.dataset.route));
  }

  render();

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
    destroy() {
      window.clearInterval(timer);
      for (const button of navButtons) button.replaceWith(button.cloneNode(true));
    }
  };
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app-main");
  if (root) renderApp(root);
}
