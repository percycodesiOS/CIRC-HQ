// Teacher side first screen: next obligation, this class's lesson, the timer,
// later obligations, and plain links. Everything else stays in More tools.
import { PLAYBOOKS, buildStudentLink, getPlaybook, listMeetings, meetingTitle } from "../model/playbooks.js";
import { createBuilder } from "./playbook-view.js";

function clock(minutes) {
  if (!Number.isInteger(minutes)) return "";
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatSeconds(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

// Merge the five-day schedule with dated updates for one day.
export function buildTeacherAgenda({ status = "empty", timeline = [], nowMinutes = 0, dated = null } = {}) {
  const schedule = timeline
    .filter(event => Number.isInteger(event.startMinutes) && Number.isInteger(event.endMinutes))
    .map(event => ({
      id: `schedule:${event.id}`,
      title: event.title,
      type: event.type,
      startMinutes: event.startMinutes,
      endMinutes: event.endMinutes,
      place: event.dutyDetails?.location || "",
      source: "schedule",
      event
    }));
  const updates = (dated?.items ?? []).map(item => ({
    id: `update:${item.id}`,
    title: item.title,
    type: item.kind,
    startMinutes: item.startMinutes,
    endMinutes: item.endMinutes,
    place: item.place ?? "",
    source: "update",
    status: item.status,
    conflicts: item.conflicts,
    verifiedLabel: item.verifiedLabel,
    stale: item.stale
  }));
  const active = [...schedule, ...updates.filter(item => item.status !== "cancelled")]
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes || left.id.localeCompare(right.id));
  const current = active.filter(item => item.startMinutes <= nowMinutes && nowMinutes < item.endMinutes);
  const upcoming = active.filter(item => item.startMinutes > nowMinutes);
  const next = upcoming[0] ?? null;
  let state;
  if (current.length) state = "in-progress";
  else if (next) state = active.some(item => item.endMinutes <= nowMinutes) ? "transition" : "before-first";
  else if (status === "no-cycle-day") state = "no-school";
  else if (active.length) state = "done";
  else state = "empty";
  return {
    state,
    current,
    next,
    later: upcoming.slice(1),
    cancelled: updates.filter(item => item.status === "cancelled"),
    minutesToNext: next ? next.startMinutes - nowMinutes : null
  };
}

export function stateMessage(agenda, { cycleDay = null } = {}) {
  switch (agenda.state) {
    case "in-progress": return `Now: ${agenda.current.map(item => item.title).join(" and ")}`;
    case "transition": return `Transition time. Next starts in ${agenda.minutesToNext} minutes.`;
    case "before-first": return `Your first block starts in ${agenda.minutesToNext} minutes.`;
    case "no-school": return "No school day on your saved calendar today.";
    case "done": return "Your scheduled day is done.";
    default: return cycleDay ? `Nothing is entered for Day ${cycleDay} yet.` : "Nothing is entered for today yet.";
  }
}

function obligationRow(h, item, { emphasis = false } = {}) {
  const flags = [
    item.source === "update" && item.status === "tentative" ? "Not confirmed" : null,
    item.source === "update" && item.stale ? "Check again" : null,
    item.conflicts?.length ? `Overlaps ${item.conflicts.join(", ")}` : null
  ].filter(Boolean);
  return h("li", { className: `th-obligation${emphasis ? " is-next" : ""}${item.conflicts?.length ? " has-conflict" : ""}` }, [
    h("span", { className: "th-time", text: `${clock(item.startMinutes)} to ${clock(item.endMinutes)}` }),
    h("span", { className: "th-title", text: item.title }),
    h("span", { className: "th-place", text: item.place || (item.type === "duty" || item.source === "update" ? "Place not entered" : "") }),
    item.source === "update" ? h("span", { className: "th-source", text: item.verifiedLabel }) : null,
    flags.length ? h("span", { className: "th-flags", text: flags.join(" | ") }) : null
  ]);
}

// input: { agenda, cycleDay, dated, classCard, runner, hasPlan }
// actions: { openSchedule, openScheduleImport, openDatedUpdates, openPlaybook(id), openRunner(), openStudentSide }
export function buildTeacherHome(input, actions = {}, { documentRef } = {}) {
  const h = createBuilder(documentRef);
  const button = (text, className, onClick, attributes = {}) => h("button", { className, text, attributes: { type: "button", ...attributes }, onClick });

  if (!input.hasPlan) {
    return h("section", { className: "th-home th-empty", attributes: { "aria-labelledby": "th-empty-title" } }, [
      h("div", { className: "th-card th-empty-card" }, [
        h("p", { className: "eyebrow", text: "Teacher side" }),
        h("h2", { text: "Add your schedule once", attributes: { id: "th-empty-title" } }),
        h("p", { text: "Enter your five-day schedule one time, or load your private schedule file. It stays on this device unless you choose private sync." }),
        h("div", { className: "th-actions" }, [
          button("Set up my schedule", "primary-action", actions.openSchedule),
          button("Load a private schedule file", "secondary-action", actions.openScheduleImport)
        ]),
        h("p", { className: "th-quiet", text: "You can still open both playbooks and run any lesson right now." })
      ]),
      quickLinks(h, actions)
    ]);
  }

  const { agenda, dated } = input;
  const placeText = item => item.place || (item.type === "teach" ? "Your CIRC room" : item.type === "duty" || item.source === "update" ? "Place not entered" : "");
  const itemDetails = (item, titleTag, titleId) => [
    h(titleTag, { text: item.title, attributes: titleId ? { id: titleId } : {} }),
    h("p", { className: "th-next-time", text: `${clock(item.startMinutes)} to ${clock(item.endMinutes)}` }),
    placeText(item) ? h("p", { className: "th-next-place", text: placeText(item) }) : null,
    item.source === "update" ? h("p", { className: "th-source", text: `${item.status === "tentative" ? "Not confirmed. " : ""}${item.verifiedLabel ?? ""}` }) : null,
    item.conflicts?.length ? h("p", { className: "th-conflict", text: `Overlaps ${item.conflicts.join(", ")}. Decide which one wins.` }) : null
  ];
  // The immediate next obligation stays visible even while a block is running.
  const lookahead = input.lookahead ?? null;
  const upcomingBlock = agenda.next
    ? h("div", { className: "th-upcoming" }, [
        h("p", { className: "eyebrow", text: `Next, in ${agenda.minutesToNext} minutes` }),
        ...itemDetails(agenda.next, "h3", agenda.current.length ? "th-upcoming-title" : null)
      ])
    : lookahead
      ? h("div", { className: "th-upcoming" }, [
          h("p", { className: "eyebrow", text: `Next obligation: ${lookahead.dateLabel}${lookahead.cycleDay ? ` | Day ${lookahead.cycleDay}` : ""}` }),
          ...itemDetails(lookahead.item, "h3")
        ])
      : h("p", { className: "th-quiet", text: input.lookaheadChecked ? "Nothing found in the next three weeks of your saved calendar and dated updates." : "Nothing else scheduled today." });
  const nextCard = h("section", { className: "th-card th-next", attributes: { "aria-labelledby": "th-next-title" } }, [
    h("p", { className: "eyebrow", text: agenda.current.length ? "Now" : "Next up" }),
    ...(agenda.current.length
      ? [...itemDetails(agenda.current[0], "h2", "th-next-title"), upcomingBlock]
      : agenda.next
        ? itemDetails(agenda.next, "h2", "th-next-title").concat(h("p", { className: "th-countdown", text: `Starts in ${agenda.minutesToNext} minutes` }))
        : [h("h2", { text: "Nothing else today", attributes: { id: "th-next-title" } }), upcomingBlock]),
    h("p", { className: "th-status", attributes: { role: "status" }, text: input.planProblem || stateMessage(agenda, { cycleDay: input.cycleDay }) }),
    input.planProblem ? h("button", { className: "secondary-action", text: "Open Settings", attributes: { type: "button" }, onClick: actions.openScheduleImport }) : null,
    input.duty ? h("p", { className: "th-duty", text: `${input.duty.label} in ${input.duty.minutes} minutes: ${input.duty.assignment}, ${input.duty.location}` }) : null
  ]);

  const classCard = buildClassCard(h, input.classCard, actions);

  const runner = input.runner;
  const timerCard = h("section", { className: "th-card th-timer", attributes: { "aria-labelledby": "th-timer-title" } }, [
    h("p", { className: "eyebrow", text: "Timer" }),
    runner
      ? h("div", {}, [
          h("h2", { text: runner.title, attributes: { id: "th-timer-title" } }),
          h("p", { className: "th-step", text: `Step: ${runner.stepLabel}` }),
          h("div", { className: "th-timer-values" }, [
            h("p", {}, [h("span", { text: "Step " }), h("strong", { text: formatSeconds(runner.stepSeconds), attributes: { "data-home-timer": "step" } })]),
            h("p", {}, [h("span", { text: "Class " }), h("strong", { text: formatSeconds(runner.totalSeconds), attributes: { "data-home-timer": "class" } })])
          ]),
          h("p", { className: "th-quiet", text: runner.status === "running" ? "Running. You choose when to move to the next step." : runner.status === "complete" ? "This lesson is finished." : "Ready or paused." }),
          button("Back to the lesson", "secondary-action", actions.openRunner)
        ])
      : h("div", {}, [
          h("h2", { text: "No lesson running", attributes: { id: "th-timer-title" } }),
          h("p", { className: "th-quiet", text: "Start a lesson to run a 35-minute timer, or the time left in the scheduled class, with a step timer beside it." })
        ])
  ]);

  const laterItems = agenda.later;
  const coverageNote = dated.coverage === "checked"
    ? (dated.items.length ? dated.freshness : `${dated.freshness} Nothing extra is listed for today. That is not proof there is nothing.`)
    : dated.coverage === "not-checked"
      ? `${dated.freshness} Today was not in that check.`
      : "Dated updates have not been imported on this browser, so appointments outside your schedule are not shown.";
  const laterCard = h("section", { className: "th-card th-later", attributes: { "aria-labelledby": "th-later-title" } }, [
    h("h2", { text: "Later today", attributes: { id: "th-later-title" } }),
    laterItems.length
      ? h("ol", { className: "th-obligations" }, laterItems.map(item => obligationRow(h, item)))
      : h("p", { className: "th-quiet", text: agenda.next ? "Nothing after the next item." : "Nothing else today." }),
    agenda.cancelled.length ? h("p", { className: "th-quiet", text: `Cancelled: ${agenda.cancelled.map(item => item.title).join(", ")}` }) : null,
    h("p", { className: dated.stale ? "th-source is-stale" : "th-source", text: dated.stale ? `${coverageNote} This check is more than a week old.` : coverageNote }),
    button(dated.coverage === "none" ? "Import dated updates" : "Update dated updates", "button-link", actions.openDatedUpdates)
  ]);

  return h("section", { className: "th-home", attributes: { "aria-label": "Teacher home" } }, [
    h("div", { className: "th-grid" }, [nextCard, classCard, timerCard, laterCard]),
    quickLinks(h, actions)
  ]);
}

function quickLinks(h, actions) {
  const link = (text, onClick) => h("button", { className: "secondary-action th-link", text, attributes: { type: "button" }, onClick });
  return h("nav", { className: "th-links", attributes: { "aria-label": "Teacher shortcuts" } }, [
    link("Schedule", actions.openSchedulePage),
    ...PLAYBOOKS.map(item => link(`${item.name} (${item.year})`, () => actions.openPlaybook?.(item.id))),
    h("a", { className: "secondary-action th-link", text: "Student side", attributes: { href: "student.html", target: "_blank", rel: "noopener" } })
  ]);
}

// classCard: { label, when, place: {playbook, meeting, grade, option}, resolved, canSave, message }
function buildClassCard(h, classCard, actions) {
  if (!classCard) {
    return h("section", { className: "th-card th-class", attributes: { "aria-labelledby": "th-class-title" } }, [
      h("p", { className: "eyebrow", text: "This class" }),
      h("h2", { text: "No class on your schedule right now", attributes: { id: "th-class-title" } }),
      h("p", { className: "th-quiet", text: "Open a playbook to pick any lesson." })
    ]);
  }
  const { place, resolved } = classCard;
  const playbookSelect = h("select", { attributes: { id: "th-class-playbook" } }, PLAYBOOKS.map(item => h("option", { text: `${item.name} (${item.year})`, attributes: { value: item.id } })));
  playbookSelect.value = place.playbook;
  const meetingSelect = h("select", { attributes: { id: "th-class-meeting" } }, listMeetings(place.playbook).map(meeting => h("option", {
    text: `${meeting.number}. ${meetingTitle(meeting)}`,
    attributes: { value: String(meeting.number) }
  })));
  meetingSelect.value = String(place.meeting);
  const gradeSelect = h("select", { attributes: { id: "th-class-grade" } }, [
    h("option", { text: "Grade not set", attributes: { value: "" } }),
    h("option", { text: "Grade 5", attributes: { value: "5" } }),
    h("option", { text: "Grade 6", attributes: { value: "6" } })
  ]);
  gradeSelect.value = place.grade ? String(place.grade) : "";
  const change = patch => actions.onPlaceChange?.({ ...place, ...patch });
  playbookSelect.addEventListener("change", () => change({ playbook: playbookSelect.value, meeting: getPlaybook(playbookSelect.value).nextMeeting, option: null }));
  meetingSelect.addEventListener("change", () => change({ meeting: Number(meetingSelect.value), option: null }));
  gradeSelect.addEventListener("change", () => change({ grade: gradeSelect.value ? Number(gradeSelect.value) : null }));
  const lesson = resolved?.lesson;
  const studentHref = buildStudentLink({ playbook: place.playbook, meeting: place.meeting, grade: place.grade, option: place.option });
  const lastMeeting = listMeetings(place.playbook).length;
  return h("section", { className: "th-card th-class", attributes: { "aria-labelledby": "th-class-title" } }, [
    h("p", { className: "eyebrow", text: `${classCard.when} | This class` }),
    h("h2", { text: classCard.label, attributes: { id: "th-class-title" } }),
    h("div", { className: "th-class-pickers" }, [
      h("label", { text: "Playbook", attributes: { for: "th-class-playbook" } }), playbookSelect,
      h("label", { text: "Meeting", attributes: { for: "th-class-meeting" } }), meetingSelect,
      h("label", { text: "Grade", attributes: { for: "th-class-grade" } }), gradeSelect
    ]),
    lesson
      ? h("div", { className: "th-lesson" }, [
          h("h3", { text: lesson.title }),
          h("p", { text: lesson.goal }),
          h("h4", { text: "Quick prep" }),
          h("ul", { className: "plain-list" }, lesson.prep.map(item => h("li", { text: item }))),
          resolved.meeting.kind !== "lesson" ? h("p", { className: "th-quiet", text: "Flex time: catch up first. Change the lesson in the playbook if this class is on track." }) : null
        ])
      : h("p", { className: "th-quiet", text: "Grades 5 and 6 split at this meeting. Choose the grade to see the lesson." }),
    h("div", { className: "th-actions" }, [
      lesson ? h("button", { className: "primary-action", text: "Start lesson", attributes: { type: "button" }, onClick: actions.onStartClassLesson }) : null,
      h("a", { className: "secondary-action", text: "Student page", attributes: { href: studentHref, target: "_blank", rel: "noopener" } }),
      place.meeting < lastMeeting ? h("button", { className: "secondary-action", text: `Done. Next time: meeting ${place.meeting + 1}`, attributes: { type: "button" }, onClick: () => change({ meeting: place.meeting + 1, option: null }) }) : null
    ]),
    h("p", { className: "th-quiet", text: classCard.message || (place.saved ? "Saved on this browser for this class." : "Suggested starting point. Change it to save this class's place on this browser.") })
  ]);
}
