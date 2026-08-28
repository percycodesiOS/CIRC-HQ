const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const CYCLE_LENGTH = 5;

export function parseLocalDate(value) {
  if (typeof value !== "string") return null;

  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(0);
  utcDate.setUTCHours(0, 0, 0, 0);
  utcDate.setUTCFullYear(year, month - 1, day);

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toUtcMilliseconds(parts) {
  const utcDate = new Date(0);
  utcDate.setUTCHours(0, 0, 0, 0);
  utcDate.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return utcDate.getTime();
}

function toDateKey(utcMilliseconds) {
  const date = new Date(utcMilliseconds);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOverride(dateKey, calendar) {
  const overrides = calendar?.overrides;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return null;
  }
  const override = overrides[dateKey];
  return override && typeof override === "object" ? override : null;
}

function isWithinCalendar(dateParts, calendar) {
  const anchorParts = parseLocalDate(calendar?.anchorDate);
  const lastParts = parseLocalDate(calendar?.lastDate);
  if (!anchorParts || !lastParts) return false;

  const dateValue = toUtcMilliseconds(dateParts);
  return (
    dateValue >= toUtcMilliseconds(anchorParts) &&
    dateValue <= toUtcMilliseconds(lastParts)
  );
}

export function isInstructionalDate(dateKey, calendar) {
  const dateParts = parseLocalDate(dateKey);
  if (!dateParts) return false;

  const override = getOverride(dateKey, calendar);
  if (override?.kind === "closed") return false;
  if (override?.kind === "instructional" || override?.kind === "cycle") {
    return true;
  }

  if (!isWithinCalendar(dateParts, calendar)) return false;

  const weekday = new Date(toUtcMilliseconds(dateParts)).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (calendar.noSchool?.includes(dateKey)) return false;
  if (calendar.conditionalMakeup?.includes(dateKey)) return false;
  return true;
}

function unavailableCycleDay(source, reason) {
  return { day: null, source, reason };
}

export function getCycleDay(dateKey, calendar) {
  const dateParts = parseLocalDate(dateKey);
  if (!dateParts) return unavailableCycleDay("calendar", "invalid-date");

  const override = getOverride(dateKey, calendar);
  if (
    override?.kind === "cycle" &&
    Number.isInteger(override.day) &&
    override.day >= 1 &&
    override.day <= CYCLE_LENGTH
  ) {
    return {
      day: override.day,
      source: "override",
      reason: "manual-cycle"
    };
  }
  if (override?.kind === "closed") {
    return unavailableCycleDay("override", "manual-closed");
  }

  const anchorParts = parseLocalDate(calendar?.anchorDate);
  const lastParts = parseLocalDate(calendar?.lastDate);
  const anchorDay = calendar?.anchorDay;
  if (
    !anchorParts ||
    !lastParts ||
    !Number.isInteger(anchorDay) ||
    anchorDay < 1 ||
    anchorDay > CYCLE_LENGTH
  ) {
    return unavailableCycleDay("calendar", "invalid-calendar");
  }

  const dateValue = toUtcMilliseconds(dateParts);
  const anchorValue = toUtcMilliseconds(anchorParts);
  const lastValue = toUtcMilliseconds(lastParts);
  if (dateValue < anchorValue || dateValue > lastValue) {
    return unavailableCycleDay("calendar", "outside-calendar");
  }

  if (
    calendar.conditionalMakeup?.includes(dateKey) &&
    override?.kind !== "instructional"
  ) {
    return unavailableCycleDay("conditional", "makeup-status-needed");
  }

  if (!isInstructionalDate(dateKey, calendar)) {
    const weekday = new Date(dateValue).getUTCDay();
    const reason =
      weekday === 0 || weekday === 6 ? "weekend" : "no-school";
    return unavailableCycleDay("calculated", reason);
  }

  let instructionalDates = 0;
  for (
    let currentValue = anchorValue;
    currentValue <= dateValue;
    currentValue += DAY_MILLISECONDS
  ) {
    if (isInstructionalDate(toDateKey(currentValue), calendar)) {
      instructionalDates += 1;
    }
  }

  const day =
    ((anchorDay - 1 + instructionalDates - 1) % CYCLE_LENGTH) + 1;
  if (override?.kind === "instructional") {
    return { day, source: "override", reason: "manual-instructional" };
  }
  return { day, source: "calculated", reason: "instructional-day" };
}

function parseTimeMinutes(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 24 * 60) {
    return value;
  }
  if (typeof value !== "string") return null;

  const match = TIME_PATTERN.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) {
    return null;
  }
  return hours * 60 + minutes;
}

function getTeacherEvents(teacher, cycleDay) {
  const dayEvents = teacher?.days?.[String(cycleDay)];
  if (Array.isArray(dayEvents)) return dayEvents;
  return [];
}

export function getDayEvents(plan, teacherId, cycleDay) {
  const teacher = plan?.teachers?.find((entry) => entry.id === teacherId);
  if (!teacher) return [];

  return getTeacherEvents(teacher, cycleDay)
    .map((event, originalOrder) => ({
      event: {
        ...event,
        startMinutes: parseTimeMinutes(event.startMinutes ?? event.start),
        endMinutes: parseTimeMinutes(event.endMinutes ?? event.end)
      },
      originalOrder
    }))
    .sort(
      (left, right) =>
        (left.event.startMinutes ?? Number.POSITIVE_INFINITY) -
          (right.event.startMinutes ?? Number.POSITIVE_INFINITY) ||
        left.originalOrder - right.originalOrder
    )
    .map(({ event }) => event);
}

export function getTimelineState(events, nowMinutes) {
  const orderedEvents = [...(Array.isArray(events) ? events : [])]
    .map((event, originalOrder) => ({ event, originalOrder }))
    .sort(
      (left, right) =>
        left.event.startMinutes - right.event.startMinutes ||
        left.originalOrder - right.originalOrder
    )
    .map(({ event }) => event);

  const current =
    orderedEvents.find(
      (event) =>
        nowMinutes >= event.startMinutes && nowMinutes < event.endMinutes
    ) ?? null;
  const next =
    orderedEvents.find((event) => event.startMinutes > nowMinutes) ?? null;
  const minutesUntilNext = next ? next.startMinutes - nowMinutes : null;
  const status = current
    ? "current"
    : next
      ? "upcoming"
      : orderedEvents.length
        ? "complete"
        : "empty";

  return { current, next, minutesUntilNext, status };
}
