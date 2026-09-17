import { getCycleDay, getDayEvents, parseLocalDate } from "./schedule.js";
import { validateTeacherPlan } from "./teacher-plan.js";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_SCHOOL_DAYS = 5;
const MAX_CALENDAR_SPAN = 21;

const NO_SCHOOL_LABELS = {
  "no-school": "No school for students",
  "manual-closed": "Closed",
  "makeup-status-needed": "Snow make-up day. Check the district notice.",
  "outside-calendar": "Outside the school year"
};

function toUtc(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function toDateKey(utcMilliseconds) {
  const date = new Date(utcMilliseconds);
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function formatTime(minutes) {
  if (!Number.isInteger(minutes)) return "";
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")}`;
}

function dateLabels(utcMilliseconds) {
  const date = new Date(utcMilliseconds);
  const options = { timeZone: "UTC" };
  return {
    weekday: new Intl.DateTimeFormat("en-US", { ...options, weekday: "long" }).format(date),
    shortDate: new Intl.DateTimeFormat("en-US", { ...options, month: "short", day: "numeric" }).format(date)
  };
}

function timeToMinutes(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function specialBlocks(plan, dateKey) {
  return plan.specialEvents
    .filter((event) => event.date === dateKey)
    .map((event) => ({
      id: event.id,
      type: "special",
      title: event.label,
      startMinutes: timeToMinutes(event.start),
      endMinutes: timeToMinutes(event.end)
    }));
}

function displayBlock(block, state) {
  const start = formatTime(block.startMinutes);
  const end = formatTime(block.endMinutes);
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    timeLabel: start && end ? `${start} - ${end}` : start || "Time not entered",
    state
  };
}

function blockState(block, isToday, nowMinutes) {
  if (!isToday || !Number.isInteger(nowMinutes)) return "later";
  if (!Number.isInteger(block.startMinutes) || !Number.isInteger(block.endMinutes)) return "later";
  if (nowMinutes >= block.endMinutes) return "past";
  if (nowMinutes >= block.startMinutes) return "current";
  return "later";
}

function emptyModel(status, nextAction) {
  return { status, nextAction, teacherName: "", rangeLabel: "", days: [] };
}

/**
 * The teacher's next school days: each with its cycle day and time blocks.
 * Weekdays without students inside the span stay visible so an in-service day
 * is never a surprise. Weekends are skipped.
 */
export function buildWeekModel(input = {}) {
  if (!input.plan) {
    return emptyModel("plan-required", "Add your schedule first. Then your week shows up here.");
  }
  const validated = validateTeacherPlan(input.plan);
  if (!validated.ok) {
    return emptyModel("plan-unsupported", "This schedule file is not supported. Check Settings.");
  }
  const plan = validated.value;
  const teacher = plan.teachers.find((entry) => entry.id === input.teacherId) ?? plan.teachers[0];
  const startParts = parseLocalDate(input.dateKey);
  if (!startParts) return emptyModel("invalid-date", "The date could not be read.");

  const wanted = Number.isInteger(input.schoolDays) && input.schoolDays > 0
    ? Math.min(input.schoolDays, 10)
    : DEFAULT_SCHOOL_DAYS;
  const startValue = toUtc(startParts);
  const days = [];
  let schoolDayCount = 0;

  for (let offset = 0; offset < MAX_CALENDAR_SPAN && schoolDayCount < wanted; offset += 1) {
    const value = startValue + offset * DAY_MILLISECONDS;
    const weekdayIndex = new Date(value).getUTCDay();
    if (weekdayIndex === 0 || weekdayIndex === 6) continue;

    const dateKey = toDateKey(value);
    const cycle = getCycleDay(dateKey, plan.calendar);
    const labels = dateLabels(value);
    const isToday = offset === 0;

    if (cycle.day === null) {
      if (cycle.reason === "outside-calendar") break;
      days.push({
        dateKey,
        ...labels,
        isToday,
        cycleDay: null,
        cycleLabel: "No students",
        note: NO_SCHOOL_LABELS[cycle.reason] ?? "No school for students",
        classCount: 0,
        blocks: specialBlocks(plan, dateKey).map((block) => displayBlock(block, "later"))
      });
      continue;
    }

    schoolDayCount += 1;
    const scheduled = getDayEvents(plan, teacher.id, cycle.day).map((event) => ({
      id: event.id,
      type: event.type,
      title: event.label,
      startMinutes: event.startMinutes,
      endMinutes: event.endMinutes
    }));
    const blocks = [...specialBlocks(plan, dateKey), ...scheduled]
      .map((block, order) => ({ block, order }))
      .sort((left, right) =>
        (left.block.startMinutes ?? Number.POSITIVE_INFINITY) -
          (right.block.startMinutes ?? Number.POSITIVE_INFINITY) ||
        left.order - right.order)
      .map(({ block }) => displayBlock(block, blockState(block, isToday, input.nowMinutes)));

    days.push({
      dateKey,
      ...labels,
      isToday,
      cycleDay: cycle.day,
      cycleLabel: `Day ${cycle.day}`,
      note: blocks.length ? "" : "No blocks entered for this cycle day yet.",
      classCount: scheduled.filter((block) => block.type === "teach").length,
      blocks
    });
  }

  if (!days.length) {
    return emptyModel("no-school-days", "No school days are coming up in this calendar.");
  }
  const first = days[0];
  const last = days[days.length - 1];
  return {
    status: "ready",
    nextAction: null,
    teacherName: typeof teacher.name === "string" ? teacher.name : "",
    rangeLabel: first.dateKey === last.dateKey
      ? first.shortDate
      : `${first.shortDate} to ${last.shortDate}`,
    days
  };
}
