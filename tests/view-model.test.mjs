import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTodayViewModel,
  getDutyAlert
} from "../src/ui/view-model.js";

const calendar = {
  anchorDate: "2026-08-20",
  anchorDay: 1,
  lastDate: "2027-06-04",
  noSchool: [],
  conditionalMakeup: [],
  overrides: {}
};

function event(id, title, start, end, type = "teach", extra = {}) {
  return { id, title, start, end, type, ...extra };
}

function duty(id, title, start, end, dutyLabel) {
  return event(id, title, start, end, "duty", {
    duty: {
      label: dutyLabel,
      assignment: "Spaces 1-4",
      location: "Spot 4"
    }
  });
}

const dayOne = [
  duty("d1-arrival", "Arrival duty", "08:40", "08:55", "Arrival"),
  event("d1-studio", "Studio group", "09:05", "09:40")
];

const dayTwo = [
  duty("d2-arrival", "Arrival duty", "08:40", "08:55", "Arrival"),
  event("d2-a", "Studio A", "09:05", "09:40"),
  event("d2-prep", "Prep", "09:43", "10:18", "prep"),
  event("d2-b", "Studio B", "10:20", "10:55"),
  event("d2-c", "Studio C", "11:00", "11:35"),
  event("d2-d", "Studio D", "11:38", "12:13"),
  event("d2-lunch", "Lunch", "12:20", "12:50", "lunch"),
  event("d2-e", "Studio E", "12:50", "13:25"),
  event("d2-f", "Studio F", "13:30", "14:05"),
  event("d2-g", "Studio G", "14:10", "14:45"),
  event("d2-check", "Check assignment", "14:50", "15:25", "support"),
  duty(
    "d2-dismissal",
    "Dismissal car pickup duty",
    "15:25",
    "15:40",
    "Dismissal car pickup"
  )
];

function makePlan() {
  return {
    format: "playbook.teacherPlan.v2",
    version: 1,
    calendar: structuredClone(calendar),
    teachers: [
      {
        id: "teacher-a",
        name: "Teacher A",
        days: {
          1: structuredClone(dayOne),
          2: structuredClone(dayTwo),
          3: [],
          4: [],
          5: []
        }
      },
      {
        id: "teacher-b",
        name: "Teacher B",
        days: {
          1: [event("b-d1", "Lab A", "09:05", "09:40")],
          2: [event("b-d2", "Lab B", "09:05", "09:40")],
          3: [],
          4: [],
          5: []
        }
      }
    ],
    specialEvents: [
      {
        id: "special-1",
        type: "special",
        title: "Evening event",
        date: "2026-08-28"
      }
    ],
    resources: []
  };
}

function todayInput(overrides = {}) {
  return {
    plan: makePlan(),
    teacherId: "teacher-a",
    dateKey: "2026-08-28",
    nowMinutes: 8 * 60 + 35,
    now: new Date("2026-08-28T08:35:00-04:00"),
    weather: null,
    syncStatus: "local",
    ...overrides
  };
}

test("uses the injected calendar to show Day 1 and Day 2", () => {
  const day1 = buildTodayViewModel(
    todayInput({
      dateKey: "2026-08-27",
      now: new Date("2026-08-27T08:35:00-04:00")
    })
  );
  const day2 = buildTodayViewModel(todayInput());
  assert.equal(day1.cycle.day, 1);
  assert.equal(day2.cycle.day, 2);
});

test("unwraps state.plan exactly once and never falls back for an unknown teacher", () => {
  const state = { plan: makePlan(), notes: [{ id: "private" }] };
  const ready = buildTodayViewModel(todayInput({ plan: state.plan }));
  const wrapped = buildTodayViewModel(todayInput({ plan: state }));
  const unknown = buildTodayViewModel(
    todayInput({ plan: state.plan, teacherId: "teacher-missing" })
  );

  assert.equal(ready.status, "upcoming");
  assert.equal(wrapped.status, "plan-unsupported");
  assert.equal(unknown.status, "teacher-unavailable");
  assert.equal(unknown.teacher.selected, null);
  assert.equal(unknown.current, null);
});

test("teacher selection changes only the view and never mutates plan or stored state", () => {
  const plan = makePlan();
  const state = { plan, preferences: { teacherId: "teacher-a" } };
  const before = structuredClone(state);

  const first = buildTodayViewModel(todayInput({ plan: state.plan }));
  const second = buildTodayViewModel(
    todayInput({ plan: state.plan, teacherId: "teacher-b" })
  );

  assert.equal(first.teacher.selected.id, "teacher-a");
  assert.equal(second.teacher.selected.id, "teacher-b");
  assert.deepEqual(state, before);
  assert.deepEqual(plan, before.plan);
});

test("uses half-open intervals and countdowns to current end or next start", () => {
  const exactStart = buildTodayViewModel(todayInput({ nowMinutes: 8 * 60 + 40 }));
  const exactEnd = buildTodayViewModel(todayInput({ nowMinutes: 8 * 60 + 55 }));
  const adjacent = buildTodayViewModel(todayInput({ nowMinutes: 12 * 60 + 50 }));

  assert.equal(exactStart.current.title, "Arrival duty");
  assert.deepEqual(exactStart.countdown, {
    minutes: 15,
    target: "end",
    label: "15m to end"
  });
  assert.equal(exactEnd.current, null);
  assert.equal(exactEnd.currentLabel, "Transition / no scheduled block");
  assert.equal(exactEnd.next.title, "Studio A");
  assert.equal(exactEnd.countdown.label, "10m to start");
  assert.equal(adjacent.current.title, "Studio E");
  assert.equal(adjacent.countdown.label, "35m to end");
});

test("separates upcoming duty alerts from active duty at the 15-minute threshold", () => {
  const events = dayTwo.map((entry) => ({
    ...entry,
    startMinutes: Number(entry.start.slice(0, 2)) * 60 + Number(entry.start.slice(3)),
    endMinutes: Number(entry.end.slice(0, 2)) * 60 + Number(entry.end.slice(3))
  }));
  assert.equal(getDutyAlert(events, 8 * 60 + 24, 15), null);

  const alert = getDutyAlert(events, 8 * 60 + 25, 15);
  assert.equal(alert.minutes, 15);
  assert.equal(alert.assignment, "Spaces 1-4");
  assert.equal(alert.location, "Spot 4");

  const active = buildTodayViewModel(todayInput({ nowMinutes: 8 * 60 + 40 }));
  assert.equal(active.duties.active, true);
  assert.equal(active.alerts.duty, null);
});

test("matches the six required morning and dismissal boundary states", () => {
  const fixtures = [
    {
      time: 8 * 60 + 35,
      status: "upcoming",
      current: null,
      next: "Arrival duty",
      countdown: "5m to start",
      dutyActive: false,
      alert: 5
    },
    {
      time: 8 * 60 + 40,
      status: "current",
      current: "Arrival duty",
      next: "Studio A",
      countdown: "15m to end",
      dutyActive: true,
      alert: null
    },
    {
      time: 8 * 60 + 55,
      status: "upcoming",
      current: null,
      next: "Studio A",
      countdown: "10m to start",
      dutyActive: false,
      alert: null
    },
    {
      time: 15 * 60 + 20,
      status: "current",
      current: "Check assignment, confirmation needed",
      next: "Dismissal car pickup duty",
      countdown: "5m to end",
      dutyActive: false,
      alert: 5
    },
    {
      time: 15 * 60 + 25,
      status: "current",
      current: "Dismissal car pickup duty",
      next: null,
      countdown: "15m to end",
      dutyActive: true,
      alert: null
    },
    {
      time: 15 * 60 + 40,
      status: "complete",
      current: null,
      next: null,
      countdown: null,
      dutyActive: false,
      alert: null
    }
  ];

  for (const fixture of fixtures) {
    const model = buildTodayViewModel(todayInput({ nowMinutes: fixture.time }));
    assert.equal(model.status, fixture.status);
    assert.equal(model.current?.title ?? null, fixture.current);
    assert.equal(model.next?.title ?? null, fixture.next);
    assert.equal(model.countdown?.label ?? null, fixture.countdown);
    assert.equal(model.duties.active, fixture.dutyActive);
    assert.equal(model.alerts.duty?.minutes ?? null, fixture.alert);
  }
});

test("confirmation-needed wording and weather failure do not alter schedule data", () => {
  const plan = makePlan();
  const before = structuredClone(plan);
  const model = buildTodayViewModel(
    todayInput({
      plan,
      nowMinutes: 15 * 60 + 20,
      weather: { status: "unavailable", label: "Weather unavailable" }
    })
  );

  assert.equal(model.current.title, "Check assignment, confirmation needed");
  assert.equal(model.weather.label, "Weather unavailable");
  assert.equal(model.next.title, "Dismissal car pickup duty");
  assert.deepEqual(plan, before);
});

test("untimed special events remain explicitly untimed", () => {
  const model = buildTodayViewModel(todayInput());
  assert.equal(model.specialEvents.length, 1);
  assert.equal(model.specialEvents[0].timeLabel, "Time not entered");
});

test("v1-converted label and dutyDetails fields drive Today without inventing title metadata", () => {
  const plan = makePlan();
  const arrival = plan.teachers[0].days["1"].find((entry) => entry.type === "duty");
  arrival.label = "Generic arrival responsibility";
  delete arrival.title;
  arrival.dutyDetails = {
    label: "Arrival",
    assignment: "Zones 1 through 3",
    location: "Point 2"
  };
  delete arrival.duty;

  const model = buildTodayViewModel(todayInput({
    plan,
    dateKey: "2026-08-27",
    now: new Date("2026-08-27T08:40:00-04:00"),
    nowMinutes: 8 * 60 + 40
  }));

  assert.equal(model.current.title, "Generic arrival responsibility");
  assert.equal(model.duties.assignment, "Zones 1 through 3");
  assert.equal(model.duties.location, "Point 2");
});
