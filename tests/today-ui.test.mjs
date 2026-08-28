import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTodayPresentation,
  getWeatherIcon
} from "../src/ui/today-ui.js";

function event(id, title, startLabel, endLabel, state = "later") {
  return { id, title, startLabel, endLabel, state };
}

function model(overrides = {}) {
  return {
    status: "current",
    nextAction: null,
    teacher: {
      selected: { id: "teacher-1", name: "Ms. Rivera" },
      options: [{ id: "teacher-1", name: "Ms. Rivera" }]
    },
    cycle: { day: 2, source: "rotation" },
    clock: {
      dateLabel: "Friday, August 28, 2026",
      timeLabel: "9:10:00 AM"
    },
    current: event("current", "Media Lab", "9:05 AM", "9:40 AM", "current"),
    currentLabel: "Media Lab",
    next: event("next", "Planning", "9:43 AM", "10:18 AM", "next"),
    countdown: { minutes: 30, target: "end", label: "30m to end" },
    timeline: [
      event("past", "Arrival", "8:40 AM", "8:55 AM", "past"),
      event("current", "Media Lab", "9:05 AM", "9:40 AM", "current"),
      event("next", "Planning", "9:43 AM", "10:18 AM", "next"),
      event("later-1", "Research", "10:20 AM", "10:55 AM", "later"),
      event("later-2", "Design", "11:00 AM", "11:35 AM", "later")
    ],
    duties: { active: false, event: null, assignment: "", location: "" },
    alerts: { duty: null, confirmation: null },
    specialEvents: [],
    weather: {
      status: "ready",
      label: "72°F, feels 70°F",
      current: {
        weatherCode: 0,
        temperature: "72°F",
        feelsLike: "70°F",
        condition: "Clear"
      }
    },
    sync: { label: "Local only" },
    ...overrides
  };
}

test("no-plan startup is one honest setup state with one next action", () => {
  const presentation = buildTodayPresentation(model({
    status: "plan-required",
    nextAction: "Import a supported teacher plan in Settings.",
    teacher: { selected: null, options: [] }
  }));

  assert.deepEqual(presentation.setup, {
    title: "Schedule not loaded yet",
    actionLabel: "Open Settings"
  });
  assert.equal(presentation.dashboard, null);
  assert.equal(presentation.showTeacherSelector, false);
});

test("one teacher is hidden and multiple real teachers enable the compact selector", () => {
  assert.equal(buildTodayPresentation(model()).showTeacherSelector, false);
  assert.equal(buildTodayPresentation(model({
    teacher: {
      selected: { id: "teacher-1", name: "Ms. Rivera" },
      options: [
        { id: "teacher-1", name: "Ms. Rivera" },
        { id: "teacher-2", name: "Mr. Chen" }
      ]
    }
  })).showTeacherSelector, true);
});

test("NOW dominates, NEXT stays secondary, and duty disappears when irrelevant", () => {
  const presentation = buildTodayPresentation(model());
  assert.deepEqual(presentation.dashboard.now, {
    title: "Media Lab",
    endLabel: "9:40 AM",
    countdown: "30m to end"
  });
  assert.deepEqual(presentation.dashboard.next, {
    title: "Planning",
    startLabel: "9:43 AM"
  });
  assert.equal(presentation.dashboard.duty, null);
  assert.equal(presentation.dashboard.detailsExpanded, false);
});

test("duty appears only when active or inside the warning window", () => {
  const upcoming = buildTodayPresentation(model({
    alerts: {
      confirmation: null,
      duty: {
        label: "Arrival",
        minutes: 5,
        assignment: "Spaces 1-4",
        location: "Spot 4"
      }
    }
  }));
  assert.deepEqual(upcoming.dashboard.duty, {
    state: "upcoming",
    title: "Arrival in 5m",
    assignment: "Spaces 1-4",
    location: "Spot 4"
  });

  const active = buildTodayPresentation(model({
    duties: {
      active: true,
      event: { title: "Arrival duty" },
      assignment: "Spaces 1-4",
      location: "Spot 4"
    }
  }));
  assert.deepEqual(active.dashboard.duty, {
    state: "active",
    title: "Arrival duty",
    assignment: "Spaces 1-4",
    location: "Spot 4"
  });
});

test("full day is collapsed by default and expands with one control without repeated later labels", () => {
  const collapsed = buildTodayPresentation(model());
  assert.equal(collapsed.dashboard.timeline.expanded, false);
  assert.equal(collapsed.dashboard.timeline.controlLabel, "View full day");
  assert.deepEqual(collapsed.dashboard.timeline.rows, []);

  const expanded = buildTodayPresentation(model(), { timelineExpanded: true });
  assert.equal(expanded.dashboard.timeline.controlLabel, "Hide full day");
  assert.equal(expanded.dashboard.timeline.rows.length, 5);
  assert.deepEqual(
    expanded.dashboard.timeline.rows.map((row) => row.stateCue),
    ["", "Now", "Next", "", ""]
  );
  assert.equal(
    expanded.dashboard.timeline.rows.filter((row) => /later/i.test(row.stateCue)).length,
    0
  );
});

test("weather codes map to recognizable local icons with accessible labels", () => {
  const expected = new Map([
    [0, ["sun", "Clear sky"]],
    [2, ["partly-cloudy", "Partly cloudy"]],
    [3, ["cloud", "Cloudy"]],
    [61, ["rain", "Rain"]],
    [71, ["snow", "Snow"]],
    [95, ["storm", "Thunderstorm"]]
  ]);
  for (const [code, [name, label]] of expected) {
    const icon = getWeatherIcon(code);
    assert.equal(icon.name, name);
    assert.equal(icon.label, label);
    assert.ok(icon.paths.length > 0);
  }
});

test("missing weather is short and never blocks the schedule", () => {
  const presentation = buildTodayPresentation(model({
    weather: { status: "unavailable", label: "Weather unavailable" }
  }));
  assert.deepEqual(presentation.dashboard.weather, {
    status: "unavailable",
    label: "Weather unavailable",
    icon: getWeatherIcon(null)
  });
  assert.equal(presentation.dashboard.now.title, "Media Lab");
  assert.equal(presentation.dashboard.next.title, "Planning");
});

test("stale cached weather stays distinct from ready and unavailable weather", () => {
  const stale = buildTodayPresentation(model({
    weather: {
      status: "stale",
      stale: true,
      label: "72°F, feels 70°F (stale)",
      current: {
        weatherCode: 2,
        temperature: "72°F",
        feelsLike: "70°F",
        condition: "Partly cloudy"
      }
    }
  })).dashboard.weather;
  const ready = buildTodayPresentation(model()).dashboard.weather;
  const unavailable = buildTodayPresentation(model({
    weather: { status: "unavailable", label: "Weather unavailable" }
  })).dashboard.weather;

  assert.equal(stale.status, "stale");
  assert.equal(stale.caveat, "Updated earlier");
  assert.equal(ready.status, "ready");
  assert.equal(ready.caveat, undefined);
  assert.equal(unavailable.status, "unavailable");
  assert.notDeepEqual(stale, ready);
  assert.notDeepEqual(stale, unavailable);
});
