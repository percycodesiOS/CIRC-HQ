import {
  getCycleDay,
  getDayEvents,
  getTimelineState
} from "../model/schedule.js";
import { validateTeacherPlan } from "../model/teacher-plan.js";

const DEFAULT_DUTY_LEAD_MINUTES = 15;

function formatTime(minutes) {
  if (!Number.isInteger(minutes)) return "Time not entered";
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function displayTitle(event) {
  if (!event) return "";
  return event.title === "Check assignment"
    ? "Check assignment, confirmation needed"
    : event.title || "Untitled event";
}

function displayEvent(event) {
  if (!event) return null;
  return {
    ...structuredClone(event),
    title: displayTitle(event),
    startLabel: formatTime(event.startMinutes),
    endLabel: formatTime(event.endMinutes),
    timeLabel: `${formatTime(event.startMinutes)} to ${formatTime(event.endMinutes)}`
  };
}

function unavailableWeather() {
  return { status: "unavailable", label: "Weather unavailable" };
}

function syncModel(status) {
  const value = typeof status === "string" ? status : status?.status;
  const labels = {
    local: "Saved on this browser",
    syncing: "Syncing",
    synced: "Synced",
    offline: "Offline, saved locally",
    blocked: "Cloud setup not configured",
    "not-configured": "Cloud setup not configured",
    "cloud-blocked": "Cloud setup blocked"
  };
  const normalized = labels[value] ? value : "local";
  return { status: normalized, label: labels[normalized] };
}

function teacherOptions(plan) {
  return plan.teachers.map((teacher, index) => ({
    id: teacher.id,
    name:
      typeof teacher.name === "string" && teacher.name.trim()
        ? teacher.name
        : `Teacher ${index + 1}`
  }));
}

function baseModel(input, status, nextAction) {
  return {
    status,
    nextAction,
    teacher: { selected: null, options: [] },
    cycle: { day: null, source: "calendar", reason: status },
    clock: buildClock(input),
    current: null,
    currentLabel: "Schedule unavailable",
    next: null,
    countdown: null,
    timeline: [],
    duties: { active: false, event: null, assignment: "", location: "" },
    specialEvents: [],
    weather: input.weather?.label ? structuredClone(input.weather) : unavailableWeather(),
    sync: syncModel(input.syncStatus),
    alerts: { duty: null, confirmation: null }
  };
}

function buildClock(input) {
  const now = input.now instanceof Date && !Number.isNaN(input.now.valueOf())
    ? input.now
    : new Date();
  return {
    dateKey: input.dateKey ?? "",
    dateLabel: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(now),
    timeLabel: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(now)
  };
}

function getNowMinutes(input) {
  if (Number.isInteger(input.nowMinutes)) return input.nowMinutes;
  if (input.now instanceof Date && !Number.isNaN(input.now.valueOf())) {
    return input.now.getHours() * 60 + input.now.getMinutes();
  }
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function getDutyAlert(
  events,
  nowMinutes,
  leadMinutes = DEFAULT_DUTY_LEAD_MINUTES
) {
  if (!Array.isArray(events) || !Number.isFinite(nowMinutes)) return null;
  const upcoming = events
    .filter((event) => event?.type === "duty")
    .filter((event) => Number.isFinite(event.startMinutes))
    .map((event) => ({ event, minutes: event.startMinutes - nowMinutes }))
    .filter(({ minutes }) => minutes > 0 && minutes <= leadMinutes)
    .sort(
      (left, right) =>
        left.minutes - right.minutes ||
        String(left.event.id).localeCompare(String(right.event.id))
    )[0];
  if (!upcoming) return null;

  return {
    eventId: upcoming.event.id,
    title: displayTitle(upcoming.event),
    label: upcoming.event.duty?.label || "Duty",
    minutes: upcoming.minutes,
    assignment: upcoming.event.duty?.assignment || "Assignment not entered",
    location: upcoming.event.duty?.location || "Location not entered"
  };
}

function specialEventsForDate(plan, dateKey) {
  return plan.specialEvents
    .filter((event) => event.date === dateKey)
    .map((event) => {
      const startMinutes = Number.isInteger(event.startMinutes)
        ? event.startMinutes
        : typeof event.start === "string"
          ? Number(event.start.slice(0, 2)) * 60 + Number(event.start.slice(3))
          : null;
      return {
        id: event.id,
        title: event.title || "Special event",
        timeLabel: Number.isInteger(startMinutes)
          ? formatTime(startMinutes)
          : "Time not entered"
      };
    });
}

export function buildTodayViewModel(input = {}) {
  if (!input.plan) {
    return baseModel(
      input,
      "plan-required",
      "Import a supported teacher plan in Settings."
    );
  }

  const validated = validateTeacherPlan(input.plan);
  if (!validated.ok) {
    return baseModel(
      input,
      "plan-unsupported",
      "This file is not supported yet. Import a playbook.teacherPlan.v2 file in Settings."
    );
  }

  const plan = validated.value;
  const options = teacherOptions(plan);
  const selectedTeacher = plan.teachers.find(
    (teacher) => teacher.id === input.teacherId
  );
  if (!selectedTeacher) {
    const model = baseModel(
      input,
      "teacher-unavailable",
      "Choose a teacher included in the imported plan."
    );
    model.teacher.options = options;
    return model;
  }

  const cycle = getCycleDay(input.dateKey, plan.calendar);
  if (cycle.day === null) {
    const model = baseModel(input, "no-cycle-day", "Check the school calendar in Schedule.");
    model.cycle = cycle;
    model.teacher = {
      selected: options.find((teacher) => teacher.id === selectedTeacher.id),
      options
    };
    model.currentLabel = "No cycle day";
    model.specialEvents = specialEventsForDate(plan, input.dateKey);
    return model;
  }

  const nowMinutes = getNowMinutes(input);
  const events = getDayEvents(plan, selectedTeacher.id, cycle.day);
  const timelineState = getTimelineState(events, nowMinutes);
  const current = displayEvent(timelineState.current);
  const next = displayEvent(timelineState.next);
  const hasFinishedEvent = events.some((event) => event.endMinutes <= nowMinutes);
  const currentLabel = current
    ? current.title
    : next
      ? hasFinishedEvent
        ? "Transition / no scheduled block"
        : "Before first scheduled block"
      : events.length
        ? "Day complete"
        : "No events entered";
  const countdown = current
    ? {
        minutes: timelineState.current.endMinutes - nowMinutes,
        target: "end",
        label: `${timelineState.current.endMinutes - nowMinutes}m to end`
      }
    : next
      ? {
          minutes: timelineState.next.startMinutes - nowMinutes,
          target: "start",
          label: `${timelineState.next.startMinutes - nowMinutes}m to start`
        }
      : null;
  const activeDuty = timelineState.current?.type === "duty"
    ? timelineState.current
    : null;
  const dutyAlert = getDutyAlert(
    events,
    nowMinutes,
    input.dutyLeadMinutes ?? DEFAULT_DUTY_LEAD_MINUTES
  );
  const status = events.length ? timelineState.status : "empty";

  return {
    status,
    nextAction: status === "empty" ? "Add events to this cycle day in Schedule." : null,
    teacher: {
      selected: options.find((teacher) => teacher.id === selectedTeacher.id),
      options
    },
    cycle,
    clock: buildClock(input),
    current,
    currentLabel,
    next,
    countdown,
    timeline: events.map((event) => ({
      ...displayEvent(event),
      state:
        event.id === timelineState.current?.id
          ? "current"
          : event.id === timelineState.next?.id
            ? "next"
            : event.endMinutes <= nowMinutes
              ? "past"
              : "later"
    })),
    duties: {
      active: Boolean(activeDuty),
      event: displayEvent(activeDuty),
      assignment: activeDuty?.duty?.assignment || "",
      location: activeDuty?.duty?.location || ""
    },
    specialEvents: specialEventsForDate(plan, input.dateKey),
    weather: input.weather?.label ? structuredClone(input.weather) : unavailableWeather(),
    sync: syncModel(input.syncStatus),
    alerts: {
      duty: dutyAlert,
      confirmation:
        current?.title === "Check assignment, confirmation needed" ||
        next?.title === "Check assignment, confirmation needed"
          ? "Check assignment, confirmation needed"
          : null
    }
  };
}
