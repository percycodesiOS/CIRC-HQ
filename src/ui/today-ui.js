const ICONS = {
  sun: {
    label: "Clear sky",
    paths: [
      { tag: "circle", cx: 12, cy: 12, r: 4 },
      { tag: "path", d: "M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" }
    ]
  },
  "partly-cloudy": {
    label: "Partly cloudy",
    paths: [
      { tag: "circle", cx: 9, cy: 8, r: 3 },
      { tag: "path", d: "M9 2v1.5M3.7 3.7l1.1 1.1M2 9h1.5M14.3 3.7l-1.1 1.1M18.5 19H7a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.5 1.5A3.3 3.3 0 0 1 18.5 19Z" }
    ]
  },
  cloud: {
    label: "Cloudy",
    paths: [
      { tag: "path", d: "M18.5 19H6a4.5 4.5 0 0 1-.2-9A6 6 0 0 1 17.3 12 3.5 3.5 0 0 1 18.5 19Z" }
    ]
  },
  rain: {
    label: "Rain",
    paths: [
      { tag: "path", d: "M18.5 15H6a4.5 4.5 0 0 1-.2-9A6 6 0 0 1 17.3 8 3.5 3.5 0 0 1 18.5 15ZM8 18l-1 2M13 18l-1 2M18 18l-1 2" }
    ]
  },
  snow: {
    label: "Snow",
    paths: [
      { tag: "path", d: "M18.5 14H6a4.5 4.5 0 0 1-.2-9A6 6 0 0 1 17.3 7 3.5 3.5 0 0 1 18.5 14ZM7 18h.01M12 20h.01M17 18h.01" }
    ]
  },
  storm: {
    label: "Thunderstorm",
    paths: [
      { tag: "path", d: "M18.5 14H6a4.5 4.5 0 0 1-.2-9A6 6 0 0 1 17.3 7 3.5 3.5 0 0 1 18.5 14ZM13 15l-3 4h3l-2 3" }
    ]
  },
  unavailable: {
    label: "Weather unavailable",
    paths: [
      { tag: "circle", cx: 12, cy: 12, r: 9 },
      { tag: "path", d: "M12 7v6M12 17h.01" }
    ]
  }
};

export function buildWelcomePresentation() {
  return {
    eyebrow: "CIRC HQ",
    title: "The K-6 Playbook",
    description: "A calm home base for today's plan, hands-on playbooks, and teacher setup.",
    setupAction: "Set up this device",
    previewAction: "Preview without saving"
  };
}

function weatherKind(code) {
  if (code === 0 || code === 1) return "sun";
  if (code === 2) return "partly-cloudy";
  if ([3, 45, 48].includes(code)) return "cloud";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "unavailable";
}

export function getWeatherIcon(code) {
  const name = weatherKind(code);
  return { name, ...structuredClone(ICONS[name]) };
}

function dutyPresentation(model) {
  if (model.duties.active) {
    return {
      state: "active",
      title: model.duties.event.title,
      assignment: model.duties.assignment,
      location: model.duties.location
    };
  }
  if (model.alerts.duty) {
    return {
      state: "upcoming",
      title: `${model.alerts.duty.label} in ${model.alerts.duty.minutes}m`,
      assignment: model.alerts.duty.assignment,
      location: model.alerts.duty.location
    };
  }
  return null;
}

function weatherPresentation(weather) {
  if (weather?.status === "ready" || weather?.status === "stale") {
    const current = weather.current ?? {};
    return {
      status: weather.status,
      temperature: current.temperature ?? "",
      feelsLike: current.feelsLike ?? "",
      condition: current.condition ?? "Weather",
      ...(weather.status === "stale" ? { caveat: "Updated earlier" } : {}),
      icon: getWeatherIcon(current.weatherCode)
    };
  }
  return {
    status: "unavailable",
    label: "Weather unavailable",
    icon: getWeatherIcon(null)
  };
}

function timelineRows(model) {
  return model.timeline.map((entry) => ({
    id: entry.id,
    timeLabel: `${entry.startLabel} to ${entry.endLabel}`,
    title: entry.title,
    state: entry.state,
    stateCue: entry.state === "current" ? "Now" : entry.state === "next" ? "Next" : ""
  }));
}

export function buildTodayPresentation(model, options = {}) {
  const showTeacherSelector = model.teacher.options.length > 1;
  if (["plan-required", "plan-unsupported", "teacher-unavailable"].includes(model.status)) {
    return {
      setup: {
        title:
          model.status === "plan-required"
            ? "Schedule not loaded yet"
            : model.status === "plan-unsupported"
              ? "Schedule format not supported yet"
              : "Teacher schedule not available",
        actionLabel: "Open Settings"
      },
      dashboard: null,
      showTeacherSelector
    };
  }

  const timelineExpanded = options.timelineExpanded === true;
  const detailsExpanded = options.detailsExpanded === true;
  return {
    setup: null,
    showTeacherSelector,
    dashboard: {
      now: {
        title: model.current?.title ?? model.currentLabel,
        endLabel: model.current?.endLabel ?? "",
        countdown: model.countdown?.label ?? ""
      },
      next: {
        title: model.next?.title ?? "Day complete",
        startLabel: model.next?.startLabel ?? ""
      },
      weather: weatherPresentation(model.weather),
      duty: dutyPresentation(model),
      special: model.specialEvents[0] ?? null,
      quietStatus: model.sync?.label ?? "",
      detailsExpanded,
      timeline: {
        expanded: timelineExpanded,
        controlLabel: timelineExpanded ? "Hide full day" : "View full day",
        rows: timelineExpanded ? timelineRows(model) : []
      }
    }
  };
}
