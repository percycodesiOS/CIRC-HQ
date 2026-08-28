import { validateTeacherPlan } from "./model/teacher-plan.js";
import { createWeatherService } from "./services/weather.js";
import { LocalStore } from "./storage/local-store.js";
import { buildTodayPresentation } from "./ui/today-ui.js";
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

function buildPlanNotice(presentation, navigate) {
  const button = element("button", {
    className: "primary-action",
    text: presentation.actionLabel,
    attributes: { type: "button" }
  });
  button.addEventListener("click", () => navigate("settings"));
  return element("section", { className: "setup-card" }, [
    element("h2", { text: presentation.title }),
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

function buildWeatherCard(weather) {
  const copy = weather.status === "unavailable"
    ? [element("p", { className: "weather-unavailable", text: weather.label })]
    : [
        element("strong", { className: "weather-temp", text: weather.temperature }),
        element("span", { className: "weather-feels", text: `Feels ${weather.feelsLike}` }),
        element("span", { className: "weather-condition", text: weather.condition })
      ];
  return element("section", {
    className: `weather-card ${weather.status}`,
    attributes: { "aria-label": "Current weather" }
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
    children.push(buildPlanNotice(presentation.setup, actions.navigate));
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
  children.push(element("details", { className: "today-details" }, [
    element("summary", { text: "Details" }),
    element("p", { text: dashboard.quietStatus }),
    element("a", {
      text: "Weather by Open-Meteo",
      attributes: { href: "https://open-meteo.com/", target: "_blank", rel: "noreferrer" }
    })
  ]));
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
  let timelineExpanded = false;
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
    const actions = { navigate, selectTeacher, toggleTimeline };
    let view;
    if (route === "today") view = buildToday(model, actions, { timelineExpanded });
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
