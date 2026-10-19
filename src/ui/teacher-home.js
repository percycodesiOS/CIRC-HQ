// Teacher side first screen: next obligation, this class's lesson, the timer,
// later obligations, and plain links. Everything else stays in More tools.
import { PLAYBOOKS, buildStudentLink, getPlaybook, listMeetings, meetingTitle, resolveMeeting } from "../model/playbooks.js";
import { handoutForRef } from "../model/lesson-finder.js";
import { buildCurrentWeekEntry, buildLessonSteps, buildStationGuideLinks, createBuilder } from "./playbook-view.js";

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
      buildCurrentWeekEntry(input.weekLesson, { audience: "teacher", documentRef, onOpenLesson: actions.openSupplementalLesson, onStart: actions.startWeekLesson }),
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

  const classCard = buildClassCard(h, input.classCard, actions, documentRef);

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
    h("header", { className: "th-welcome" }, [
      h("div", {}, [h("p", { className: "eyebrow", text: "CIRC HQ / Teacher workspace" }), h("h2", { text: "Ready for the next class." }), h("p", { text: "1. Prepare the lesson. 2. Teach the steps. 3. Check the work. 4. Save where this class starts next time." })]),
      h("span", { className: "th-day-badge", text: input.cycleDay ? `Cycle Day ${input.cycleDay}` : "Your teaching day" })
    ]),
    h("div", { className: "th-grid" }, [classCard, nextCard, timerCard, laterCard]),
    !input.classCard?.resolved?.supplementalId ? buildCurrentWeekEntry(input.weekLesson, { audience: "teacher", documentRef, onOpenLesson: actions.openSupplementalLesson, onStart: actions.startWeekLesson }) : null,
    input.journal ? buildTeachingRecord(h, input.journal, actions) : null,
    quickLinks(h, actions)
  ]);
}

function buildTeachingRecord(h, journal, actions) {
  const field = (tag, name, label, attributes = {}, options = []) => {
    const control = h(tag, { attributes: { id: `th-journal-${name}`, name, ...attributes } }, options);
    control.value = journal.draft?.[name] ?? "";
    control.addEventListener("input", () => actions.onJournalDraft?.(name, control.value));
    return [h("label", { text: label, attributes: { for: `th-journal-${name}` } }), control];
  };
  const classes = h("select", { attributes: { id: "th-journal-class" } }, journal.classes.map(item => h("option", { text: `${item.label}${item.fromSchedule === false ? " (saved record)" : ""}`, attributes: { value: item.key } })));
  classes.value = journal.selectedClassKey;
  classes.addEventListener("change", () => actions.onJournalClassChange?.(classes.value));
  const importFile = h("input", { attributes: { id: "th-journal-import", type: "file", accept: ".json,application/json" } });
  importFile.addEventListener("change", () => { if (importFile.files?.[0]) actions.onJournalImport?.(importFile.files[0]); });
  const statusNames = { taught: "Taught / completed", continued: "Started / still working", planned: "Planned only" };
  return h("section", { className: "th-card th-journal", attributes: { "aria-labelledby": "th-journal-title" } }, [
    h("div", { className: "th-section-heading" }, [h("div", {}, [h("p", { className: "eyebrow", text: "Keep it for next time" }), h("h2", { text: "Teaching record", attributes: { id: "th-journal-title" } })]),
      h("button", { className: "secondary-action", text: "Download teaching record", attributes: { type: "button" }, onClick: actions.onJournalExport })]),
    h("p", { className: "th-quiet", text: "Choose the class and actual visit date. Select Taught / completed only after checking the work; use Started / still working when the class needs more time, or Planned only before teaching. Write what happened and one next step, then choose Save class note." }),
    h("p", { className: "th-quiet", text: "Private to this browser. Keep individual student grades in your school gradebook, not in this class note. Download a copy to keep it for next year; these notes are separate from the regular app backup." }),
    h("div", { className: "th-journal-layout" }, [
      h("div", { className: "th-journal-form" }, [
        h("label", { text: "Class", attributes: { for: "th-journal-class" } }), classes,
        ...field("input", "date", "Visit date", { type: "date", required: true }),
        ...field("input", "lessonTitle", "Lesson or activity", { type: "text", maxlength: "200", required: true }),
        ...field("select", "status", "What happened?", {}, Object.entries(statusNames).map(([value, text]) => h("option", { text, attributes: { value } }))),
        ...field("textarea", "note", "What did this class do? What worked or changed?", { rows: "4", maxlength: "3000", placeholder: "Include actual progress, materials used, timing changes and any tool turns still owed." }),
        ...field("textarea", "nextVisit", "Next visit: begin with…", { rows: "2", maxlength: "1500", placeholder: "One clear next step and anything to prepare." }),
        h("button", { className: "primary-action", text: "Save class note", attributes: { type: "button", disabled: !journal.canSave }, onClick: actions.onJournalSave }),
        h("p", { className: "th-quiet", text: journal.message || (journal.canSave ? "Saving a note keeps the class at its current lesson. Advance the lesson separately when ready." : "Notes cannot be saved in a preview. Open your saved teacher workspace."), attributes: { role: "status" } })
      ]),
      h("div", { className: "th-journal-history" }, [
        h("h3", { text: "Saved visits for this class" }),
        journal.entries.length ? h("ol", { className: "th-visit-list" }, journal.entries.slice(0, 8).map(entry => h("li", {}, [
          h("p", { className: "th-visit-meta", text: `${entry.date} · ${statusNames[entry.status]}` }),
          h("h4", { text: entry.lessonTitle }),
          h("p", { className: "th-note-text", text: entry.note }),
          entry.nextVisit ? h("p", { className: "th-next-note th-note-text", text: `Next visit: ${entry.nextVisit}` }) : null
        ]))) : h("p", { className: "th-quiet", text: "No visits recorded here yet. A suggested lesson or elapsed date does not count as taught. Earlier conversations and paper records have not been imported." }),
        journal.entries.length > 8 ? h("p", { className: "th-quiet", text: `Showing the latest 8 of ${journal.entries.length} visits. The download includes every saved visit for every class.` }) : null,
        h("details", { className: "th-import-record" }, [h("summary", { text: "Bring back a saved teaching record" }), h("p", { text: "Choose a teaching-record JSON download. Saved visits are merged; the same file does not create duplicates. Nothing is published or added to the student page." }), h("label", { text: "Teaching-record file", attributes: { for: "th-journal-import" } }), importFile])
      ])
    ])
  ]);
}

function quickLinks(h, actions) {
  const link = (text, onClick) => h("button", { className: "secondary-action th-link", text, attributes: { type: "button" }, onClick });
  return h("nav", { className: "th-links", attributes: { "aria-label": "Teacher shortcuts" } }, [
    link("Schedule", actions.openSchedulePage),
    ...PLAYBOOKS.map(item => link(`${item.name} (${item.year})`, () => actions.openPlaybook?.(item.id))),
    h("a", { className: "secondary-action th-link", text: "Handouts and guides", attributes: { href: "resources.html", target: "_blank", rel: "noopener" } }),
    h("a", { className: "secondary-action th-link", text: "Student side", attributes: { href: "student.html", target: "_blank", rel: "noopener" } })
  ]);
}

// classCard: { label, when, place: {playbook, meeting, grade, option}, resolved, canSave, message }
function buildClassCard(h, classCard, actions, documentRef) {
  if (!classCard) {
    return h("section", { className: "th-card th-class", attributes: { "aria-labelledby": "th-class-title" } }, [
      h("p", { className: "eyebrow", text: "This class" }),
      h("h2", { text: "No class on your schedule right now", attributes: { id: "th-class-title" } }),
      h("p", { className: "th-quiet", text: "Open a playbook to pick any lesson." })
    ]);
  }
  const { place, resolved } = classCard;
  const isStationWeek = resolved?.supplementalId === "circ-station-rotation";
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
  const change = patch => { if (!isStationWeek) actions.onPlaceChange?.({ ...place, ...patch }); };
  playbookSelect.addEventListener("change", () => change({ playbook: playbookSelect.value, meeting: getPlaybook(playbookSelect.value).nextMeeting, option: null }));
  meetingSelect.addEventListener("change", () => change({ meeting: Number(meetingSelect.value), option: null }));
  gradeSelect.addEventListener("change", () => change({ grade: gradeSelect.value ? Number(gradeSelect.value) : null }));
  const lesson = resolved?.lesson;
  const handout = lesson ? handoutForRef(lesson.ref) : null;
  const studentHref = buildStudentLink(isStationWeek ? { lesson: resolved.supplementalId, grade: place.grade } : { playbook: place.playbook, meeting: place.meeting, grade: place.grade, option: place.option });
  const lastMeeting = listMeetings(place.playbook).length;
  const nextNumber = isStationWeek ? place.meeting : place.meeting + 1;
  const nextOption = isStationWeek ? place.option : null;
  const next = resolveMeeting(place.playbook, nextNumber, { grade: place.grade, option: nextOption });
  // The shape of the lesson at a glance. The runner still owns the clocks.
  const pacing = lesson ? h("section", { className: "th-pacing", attributes: { "aria-label": "Pacing" } }, [
    h("p", { className: "th-pacing-title", text: `Pacing: ${lesson.minutes} minutes, you press Next` }),
    h("ol", { className: "th-pacing-steps" }, lesson.steps.map((step, index) => {
      const item = h("li", { className: `is-${step.kind}`, text: `${index + 1}. ${step.label}, ${step.minutes} min` });
      item.style?.setProperty?.("flex", `${step.minutes} ${step.minutes} 0`);
      return item;
    }))
  ]) : null;
  return h("section", { className: "th-card th-class", attributes: { "aria-labelledby": "th-class-title" } }, [
    h("p", { className: "eyebrow", text: `${classCard.when} | This class` }),
    h("h2", { text: classCard.label, attributes: { id: "th-class-title" } }),
    classCard.lastVisit ? h("aside", { className: "th-class-handoff" }, [
      h("p", { className: "eyebrow", text: `Last class note / ${classCard.lastVisit.date} / ${{ taught: "Taught", continued: "Still working", planned: "Planned only" }[classCard.lastVisit.status]}` }),
      h("p", { className: "th-note-text", text: classCard.lastVisit.nextVisit ? `Begin with: ${classCard.lastVisit.nextVisit}` : classCard.lastVisit.note }),
      classCard.lastVisit.nextVisit ? h("details", {}, [h("summary", { text: "Read the previous visit note" }), h("p", { className: "th-note-text", text: classCard.lastVisit.note })]) : null
    ]) : null,
    isStationWeek ? h("p", { className: "pb-callout", text: `October 12-16: build stations. ${getPlaybook(place.playbook).name} meeting ${place.meeting} ${place.saved ? "stays saved" : "is held as the suggested starting point"} for the next school visit. The remaining lessons move forward by one visit; finishing stations does not mark that annual lesson done.` }) : h("div", { className: "th-class-pickers" }, [
      h("label", { text: "Playbook", attributes: { for: "th-class-playbook" } }), playbookSelect,
      h("label", { text: "Meeting", attributes: { for: "th-class-meeting" } }), meetingSelect,
      h("label", { text: "Grade", attributes: { for: "th-class-grade" } }), gradeSelect
    ]),
    lesson
      ? h("div", { className: "th-lesson" }, [
          h("h3", { text: lesson.title }),
          h("p", { text: lesson.goal }),
          h("div", { className: "th-actions" }, [
            h("button", { className: "primary-action", text: "Start lesson", attributes: { type: "button" }, onClick: actions.onStartClassLesson }),
            h("a", { className: "secondary-action", text: "Student page", attributes: { href: studentHref, target: "_blank", rel: "noopener" } }),
            handout ? h("a", { className: "secondary-action", text: "Lesson PDF", attributes: { href: handout.files.pdf, target: "_blank", rel: "noopener" } }) : null
          ]),
          h("p", { className: "th-quiet", text: "Start lesson opens the teaching controls and timer. Open Student page to show or share this exact lesson. Tell students the goal above and read the first step together; you decide when the class moves on." }),
          h("div", { className: "th-lesson-prep" }, [
            h("div", {}, [h("h4", { text: "1. Quick prep / Before students arrive" }), h("ul", { className: "plain-list" }, lesson.prep.map(item => h("li", { text: item }))),
              h("h4", { text: "Materials and setup" }), h("ul", { className: "plain-list" }, (lesson.materials ?? []).map(item => h("li", { text: item }))), lesson.prepRequired ? h("p", { text: lesson.prepRequired }) : null])
          ]),
          h("section", { className: "pb-callout pb-safety" }, [h("h4", { text: "Safety before you start" }), h("p", { text: lesson.safety })]),
          lesson.resources?.length ? h("section", { className: "pb-callout pb-resources" }, [
            h("h4", { text: "Lesson resources" }),
            h("ul", { className: "plain-list" }, lesson.resources.map(resource => h("li", {}, [
              h("a", { text: resource.label, attributes: { href: resource.url, target: "_blank", rel: "noopener noreferrer" } }),
              h("p", { text: resource.description })
            ])))
          ]) : null,
          lesson.teacherNotes?.length ? h("details", { className: "pb-teacher-notes", attributes: { open: true } }, [
            h("summary", { text: "Teacher preparation and examples" }),
            h("ul", { className: "plain-list" }, lesson.teacherNotes.map(item => h("li", { text: item })))
          ]) : null,
          h("section", { className: "th-teaching-directions" }, [
            h("h4", { text: `2. Follow these steps together / ${lesson.minutes} minutes` }),
            h("p", { text: "Read one numbered step with the class. The Student page uses the same words in the same order. The Teacher: say and do notes tell you what to show or check at each step." }),
            pacing,
            buildLessonSteps(lesson, { audience: "teacher", documentRef })
          ]),
          h("section", { className: "pb-callout", attributes: { "aria-label": "Check the student work" } }, [
            h("h4", { text: "3. Check the work before moving on" }),
            h("p", {}, [h("strong", { text: "Ask students to show: " }), h("span", { text: lesson.turnIn })]),
            h("p", {}, [h("strong", { text: "Look for: " }), h("span", { text: lesson.success || lesson.turnIn })]),
            h("ol", { className: "plain-list" }, [
              "Ask each student to show or explain the work listed above.",
              "Compare it with the Look for check. If a part is missing, say one change to make. Let the student fix it. Check that part again.",
              "Give feedback on the work and explanation. The timer does not decide whether the work is finished.",
              "If your school requires a grade, use its assigned rubric and school gradebook. CIRC HQ does not set points or save student grades."
            ].map(item => h("li", { text: item })))
          ]),
          h("p", { className: "th-quiet" }, [h("strong", { text: "4. Save the next step. " }), h("span", { text: "In Teaching record below, choose the correct class and date, record what was completed or still needs work, and write where to begin next visit. Save class note keeps this lesson in place." })]),
          resolved.meeting.kind !== "lesson" ? h("p", { className: "th-quiet", text: "Flex time: catch up first. Change the lesson in the playbook if this class is on track." }) : null
        ])
      : h("p", { className: "th-quiet", text: "Grades 5 and 6 split at this meeting. Choose the grade to see the lesson." }),
    h("div", { className: "th-actions" }, [
      !lesson ? h("a", { className: "secondary-action", text: "Student page", attributes: { href: studentHref, target: "_blank", rel: "noopener" } }) : null,
      !isStationWeek && place.meeting < lastMeeting ? h("button", { className: "secondary-action", text: `Done. Next time: meeting ${place.meeting + 1}`, attributes: { type: "button" }, onClick: () => change({ meeting: place.meeting + 1, option: null }) }) : null
    ]),
    !isStationWeek && place.meeting < lastMeeting ? h("p", { className: "th-quiet", text: "Use Done. Next time only when this class is ready to leave this lesson. It changes the saved lesson; it does not save a teaching note or a student grade." }) : null,
    isStationWeek ? buildStationGuideLinks({ audience: "teacher", documentRef }) : null,
    next ? h("details", { className: "th-following-lesson" }, [h("summary", { text: `Following lesson: ${next.lesson?.title || meetingTitle(next.meeting)}` }),
      h("p", { text: isStationWeek ? "Resume this class's saved annual lesson after the station week. Finish any unfinished work first." : "This is the next planned lesson, not a record of completion." }),
      next.lesson ? h("ul", { className: "plain-list" }, next.lesson.prep.map(item => h("li", { text: item }))) : h("p", { text: "Set the grade to see the correct lesson and preparation." }),
      h("a", { className: "secondary-action", text: "Preview following lesson", attributes: { href: buildStudentLink({ playbook: place.playbook, meeting: nextNumber, grade: place.grade, option: nextOption }), target: "_blank", rel: "noopener" } })]) : null,
    h("p", { className: "th-quiet", text: classCard.message || (isStationWeek ? "Keep a private note of tool turns still owed. The timer does not record individual completion." : place.saved ? "Saved on this browser for this class." : "Suggested starting point. Change it to save this class's place on this browser.") })
  ]);
}
