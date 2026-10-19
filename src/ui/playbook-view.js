// Lesson and playbook views shared by the student page and the teacher side.
// Student views receive curriculum data only. Teacher-only sections are added
// when audience is "teacher" and never read a schedule themselves.
import {
  DESIGN_STAGES,
  FOUR_CS,
  PLAYBOOKS,
  STRANDS,
  STATION_GUIDES,
  SUPPLEMENTAL_LESSONS,
  buildStudentLink,
  getPlaybook,
  lessonTitleForRef,
  listMeetings,
  meetingTitle,
  pathLabel
} from "../model/playbooks.js";
import { runnerStepIconFile } from "./step-icons.js";

export function createBuilder(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new Error("playbook-view-document-required");
  return function h(tag, options = {}, children = []) {
    const node = documentRef.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = String(options.text);
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      if (value !== null && value !== undefined && value !== false) node.setAttribute(name, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) if (child) node.append(child);
    if (typeof options.onClick === "function") node.addEventListener("click", options.onClick);
    return node;
  };
}

// Inline icons keep the student page free of emoji and extra image requests.
const ICON_PATHS = Object.freeze({
  check: "M7.5 12.5l3 3 6-6",
  download: "M12 4v11M7 10l5 5 5-5M5 19h14",
  print: "M7 8V4h10v4M7 16H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 13h10v7H7z",
  search: "M20 20l-3.5-3.5M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0"
});

export function buildIcon(h, name, { circle = false } = {}) {
  const svgNs = "http://www.w3.org/2000/svg";
  const documentRef = h("span").ownerDocument ?? globalThis.document;
  const make = (tag) => (typeof documentRef?.createElementNS === "function" ? documentRef.createElementNS(svgNs, tag) : h(tag));
  const svg = make("svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.4");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (circle) {
    const ring = make("circle");
    ring.setAttribute("cx", "12");
    ring.setAttribute("cy", "12");
    ring.setAttribute("r", "9.5");
    svg.append(ring);
  }
  const path = make("path");
  path.setAttribute("d", ICON_PATHS[name] ?? ICON_PATHS.check);
  svg.append(path);
  return svg;
}

// A season can carry a teacher planning note after its first sentence.
// Students see the season only.
export function studentSeason(season) {
  return String(season ?? "").split(/\.\s/)[0].replace(/\.$/, "");
}

function list(h, items, className = "plain-list", ordered = false) {
  return h(ordered ? "ol" : "ul", { className }, items.filter(Boolean).map(item => h("li", { text: item })));
}

function strandChips(h, lesson) {
  const chips = lesson.strands.map(id => STRANDS.find(strand => strand.id === id)).filter(Boolean).map(strand =>
    h("li", { className: `pb-chip pb-strand-${strand.id}` }, [
      h("img", { attributes: { src: strand.icon, alt: "", width: "22", height: "22" } }),
      h("span", { text: strand.short })
    ]));
  return chips.length ? h("ul", { className: "pb-chips", attributes: { "aria-label": "Learning strands" } }, chips) : null;
}

function stageBar(h, lesson) {
  if (!lesson.stages.length) return null;
  return h("ol", { className: "pb-stages", attributes: { "aria-label": "Design process: " + lesson.stages.map(id => DESIGN_STAGES.find(stage => stage.id === id)?.label).join(", ") } },
    DESIGN_STAGES.map(stage => h("li", {
      className: lesson.stages.includes(stage.id) ? "pb-stage is-on" : "pb-stage",
      text: stage.label,
      attributes: { "aria-hidden": "true" }
    })));
}

// One segment per step, sized by its minutes, so the shape of the lesson is
// visible before anyone reads a word.
function timeBar(h, lesson) {
  return h("div", { className: "pb-timebar", attributes: { "aria-hidden": "true" } }, lesson.steps.map(step => {
    const segment = h("span", { className: `is-${step.kind}` });
    segment.style?.setProperty?.("flex", `${step.minutes} ${step.minutes} 0`);
    segment.setAttribute("data-minutes", String(step.minutes));
    return segment;
  }));
}

// Keep the wording and order identical on the teacher home, lesson plan and
// student page. Teacher actions sit beside the shared directions, not behind
// another guide or a collapsed control. subHeading is the level of the
// section heading above the list, so step titles sit one level below it.
export function buildLessonSteps(lesson, { audience = "student", documentRef, subHeading = "h3" } = {}) {
  const h = createBuilder(documentRef);
  let elapsed = 0;
  const stepHeading = subHeading === "h2" ? "h3" : "h4";
  return h("ol", { className: "pb-steps" }, lesson.steps.map((step, index) => {
    const start = elapsed;
    elapsed += step.minutes;
    return h("li", { className: `pb-step pb-step-${step.kind}` }, [
      h("div", { className: "pb-step-head" }, [
        h("span", { className: "pb-step-number", text: String(index + 1), attributes: { "aria-hidden": "true" } }),
        h("img", { className: "pb-step-icon", attributes: { src: `assets/icons/${runnerStepIconFile({ ...step, label: String(step.label).toUpperCase() })}.svg`, alt: "", width: "34", height: "34" } }),
        h(stepHeading, { text: step.label }),
        h("span", { className: "pb-step-time", text: `${step.minutes} min`, attributes: { title: `Minutes ${start} to ${elapsed}` } })
      ]),
      list(h, step.directions, "pb-step-directions", true),
      audience === "teacher" && step.teacherDirections.length
        ? h("section", { className: "pb-teacher-step" }, [h("h5", { text: "Teacher: say and do" }), list(h, step.teacherDirections, "plain-list", true)])
        : null
    ]);
  }));
}

function callout(h, className, title, body, headingTag = "h3") {
  if (!body || (Array.isArray(body) && !body.length)) return null;
  return h("section", { className: `pb-callout ${className}` }, [
    h(headingTag, { text: title }),
    Array.isArray(body) ? list(h, body) : h("p", { text: body })
  ]);
}

function adaptations(h, lesson, audience, grade, headingTag) {
  const adapt = lesson.adapt;
  if (adapt.grade5 !== undefined) {
    if (audience === "student") return null;
    return h("section", { className: "pb-callout pb-grade" }, [
      h(headingTag, { text: "Grades 5 and 6" }),
      h("dl", { className: "pb-pairs" }, [h("dt", { text: "Grade 5" }), h("dd", { text: adapt.grade5 }), h("dt", { text: "Grade 6" }), h("dd", { text: adapt.grade6 })])
    ]);
  }
  if (audience !== "teacher") return null;
  return h("section", { className: "pb-callout pb-grade" }, [
    h(headingTag, { text: "Support and stretch" }),
    h("dl", { className: "pb-pairs" }, [h("dt", { text: "More support" }), h("dd", { text: adapt.support }), h("dt", { text: "More challenge" }), h("dd", { text: adapt.stretch })])
  ]);
}

// Student view: the grade's own target first, the other grade's in a quieter line.
function gradeTarget(h, lesson, grade, headingTag) {
  const adapt = lesson.adapt;
  if (adapt.grade5 === undefined || (grade !== 5 && grade !== 6)) return null;
  const other = grade === 5 ? 6 : 5;
  return h("section", { className: "pb-grade-target", attributes: { "aria-label": `Grade ${grade} target` } }, [
    h(headingTag, { text: `Grade ${grade} target` }),
    h("p", { text: adapt[`grade${grade}`] }),
    h("p", { className: "pb-grade-other", text: `Grade ${other} does: ${adapt[`grade${other}`]}` })
  ]);
}

function doneWhen(h, lesson, headingTag) {
  return h("section", { className: "pb-done-top", attributes: { "aria-label": "You are done when" } }, [
    buildIcon(h, "check", { circle: true }),
    h("div", {}, [
      h(headingTag, { text: "You are done when" }),
      h("p", { text: lesson.success })
    ])
  ]);
}

function helpCard(h, headingTag) {
  return h("section", { className: "pb-callout pb-help" }, [
    h(headingTag, { text: "Stuck? Try this order" }),
    h("ol", {}, [
      h("li", { text: "Read the step again, out loud if you can." }),
      h("li", { text: "Ask a partner at your table." }),
      h("li", { text: "Raise your hand. Keep working on the next part while you wait." })
    ])
  ]);
}

function studentTools(h, actions) {
  if (!actions.handoutHref && !actions.onPrint) return null;
  return h("div", { className: "student-lesson-tools" }, [
    actions.handoutHref ? h("a", { attributes: { href: actions.handoutHref, target: "_blank", rel: "noopener" } }, [buildIcon(h, "download"), h("span", { text: "Download this lesson (PDF)" })]) : null,
    actions.onPrint ? h("button", { attributes: { type: "button" }, onClick: actions.onPrint }, [buildIcon(h, "print"), h("span", { text: "Print this page" })]) : null
  ]);
}

// A complete no-device path with visibly labeled practice data.
function paperPathSection(h, path, headingTag) {
  if (!path) return null;
  const table = h("table", { className: "pb-practice-table" }, [
    h("caption", { text: path.data.label }),
    h("thead", {}, [h("tr", {}, path.data.columns.map(column => h("th", { text: column, attributes: { scope: "col" } })))]),
    h("tbody", {}, path.data.rows.map(row => h("tr", {}, row.map((cell, index) => h(index === 0 ? "th" : "td", { text: cell, attributes: index === 0 ? { scope: "row" } : {} })))))
  ]);
  return h("section", { className: "pb-callout pb-paper-path", attributes: { "aria-labelledby": "pb-paper-title" } }, [
    h(headingTag, { text: "No-fan paper path", attributes: { id: "pb-paper-title" } }),
    h("p", { className: "pb-paper-note", text: path.note }),
    h("p", {}, [h("strong", { text: "Goal: " }), h("span", { text: path.goal })]),
    list(h, path.directions, "pb-step-directions", true),
    h("p", {}, [h("strong", { text: "Keep: " }), h("span", { text: path.evidence })]),
    h("p", { className: "pb-practice-label", text: path.data.label }),
    h("p", { className: "th-quiet", text: `Unit: ${path.data.unit}` }),
    table
  ]);
}

// resolved comes from resolveMeeting(). actions: onChoosePath(pathId), onStart(), studentHref, handoutHref, onPrint
export function buildLessonCard(resolved, { audience = "student", grade = null, actions = {}, documentRef, headingLevel = "h2" } = {}) {
  const h = createBuilder(documentRef);
  const sub = headingLevel === "h1" ? "h2" : "h3";
  const { playbook, meeting, lesson } = resolved;
  const season = audience === "student" ? studentSeason(meeting.season) : meeting.season;
  const kicker = `${playbook.name} | ${meeting.number ? `Meeting ${meeting.number}` : meeting.label}${season ? " | " + season : ""}`;
  const pathNote = resolved.path && resolved.path !== "both" ? pathLabel(resolved.path) : "";
  if (!lesson) {
    return h("article", { className: "pb-lesson pb-lesson-choose", attributes: { "aria-labelledby": "pb-lesson-title" } }, [
      h("p", { className: "eyebrow", text: kicker }),
      h(headingLevel, { text: meetingTitle(meeting), attributes: { id: "pb-lesson-title", tabindex: "-1" } }),
      h("p", { text: meeting.kind === "lesson" ? "Grades 5 and 6 do different lessons at this meeting. Which grade are you in?" : "Choose the lesson your teacher picked." }),
      h("div", { className: "pb-choice-row" }, resolved.choices.map(choice => h("button", {
        className: "primary-action pb-choice",
        text: `${choice.label}: ${choice.title}`,
        attributes: { type: "button" },
        onClick: () => actions.onChoosePath?.(choice.id)
      })))
    ]);
  }
  const student = audience === "student";
  const doneNote = meeting.done ? h("p", { className: "pb-done", text: student ? "Already finished this year." : "Finished this year. Use it only for a class that missed it." }) : null;
  // Ten fallbacks are written for the teacher; a child needs the plain fact.
  const fallbackText = student && /^This lesson is already device free/i.test(lesson.fallback) ? "No computer is needed. The steps work as written." : lesson.fallback;
  const teacherActions = audience === "teacher" ? h("div", { className: "pb-actions" }, [
    actions.onStart ? h("button", { className: "primary-action", text: "Start this lesson", attributes: { type: "button" }, onClick: actions.onStart }) : null,
    actions.studentHref ? h("a", { className: "secondary-action", text: "Open student page", attributes: { href: actions.studentHref, target: "_blank", rel: "noopener" } }) : null,
    actions.handoutHref ? h("a", { className: "secondary-action", text: "Lesson PDF", attributes: { href: actions.handoutHref, target: "_blank", rel: "noopener" } }) : null
  ]) : null;
  const choiceSwitch = resolved.choices.length > 1 && (audience === "teacher" || meeting.kind !== "lesson") ? h("div", { className: "pb-choice-row pb-choice-small", attributes: { role: "group", "aria-label": "Choose the lesson path" } },
    resolved.choices.map(choice => h("button", {
      className: choice.id === resolved.path ? "secondary-action is-selected" : "secondary-action",
      text: `${choice.label}: ${choice.title}`,
      attributes: { type: "button", "aria-pressed": String(choice.id === resolved.path) },
      onClick: () => actions.onChoosePath?.(choice.id)
    }))) : null;
  const studentResources = (lesson.resources ?? []).filter(resource => audience === "teacher" || !resource.teacherOnly);

  return h("article", { className: `pb-lesson pb-audience-${audience}`, attributes: { "aria-labelledby": "pb-lesson-title" } }, [
    h("header", { className: "pb-lesson-head" }, [
      h("p", { className: "eyebrow", text: pathNote ? `${kicker} | ${pathNote}` : kicker }),
      h(headingLevel, { text: lesson.title, attributes: { id: "pb-lesson-title", tabindex: "-1" } }),
      h("p", { className: "pb-goal" }, [h("strong", { text: "Goal: " }), h("span", { text: lesson.goal })]),
      doneNote,
      h("div", { className: "pb-tags" }, [
        strandChips(h, lesson),
        stageBar(h, lesson),
        student ? h("span", { className: "pb-fact", text: `${lesson.minutes} minutes` }) : null,
        student ? h("span", { className: "pb-fact", text: `${lesson.steps.length} steps` }) : null
      ]),
      audience === "teacher" && meeting.note ? h("p", { className: "pb-meeting-note", text: meeting.note }) : null,
      choiceSwitch,
      teacherActions
    ]),
    student ? doneWhen(h, lesson, sub) : null,
    student ? gradeTarget(h, lesson, grade, sub) : null,
    audience === "teacher" && lesson.prepRequired ? h("section", { className: "pb-callout pb-prep-required", attributes: { role: "note" } }, [
      h(sub, { text: "Preparation required" }),
      h("p", { text: lesson.prepRequired })
    ]) : null,
    audience === "teacher" ? h("div", { className: "pb-prep-grid" }, [
      callout(h, "pb-prep", "Before class", lesson.prep, sub),
      callout(h, "pb-materials", "Materials", lesson.materials, sub)
    ]) : callout(h, "pb-materials", "You will use", lesson.materials, sub),
    student ? callout(h, "pb-safety", "Stay safe", lesson.safety, sub) : null,
    audience === "teacher" && lesson.teacherNotes.length ? h("details", { className: "pb-teacher-notes", attributes: { open: true } }, [
      h("summary", { text: "Teacher preparation and examples" }),
      list(h, lesson.teacherNotes)
    ]) : null,
    h("section", { className: "pb-steps-section" }, [
      h(sub, { text: `Steps | ${lesson.minutes} minutes` }),
      audience === "teacher" ? h("p", { text: "Read one numbered step with the class. The student page has these same directions in this same order. Use the Teacher: say and do notes at each step. Check the work before you move on." }) : null,
      timeBar(h, lesson),
      buildLessonSteps(lesson, { audience, documentRef, subHeading: sub })
    ]),
    h("div", { className: "pb-finish-grid" }, [
      callout(h, "pb-turnin", "What to turn in", lesson.turnIn, sub),
      student ? null : callout(h, "pb-success", "You are done when", lesson.success, sub),
      callout(h, "pb-extension", "Next challenge (optional)", lesson.extension, sub),
      callout(h, "pb-fallback", "Another way to do it", fallbackText, sub),
      student ? helpCard(h, sub) : null
    ]),
    paperPathSection(h, lesson.paperPath, sub),
    audience === "teacher" ? h("section", { className: "pb-callout pb-work-check" }, [
      h(sub, { text: "Check each student's work" }),
      list(h, [
        `Ask the student to show or explain this: ${lesson.turnIn}`,
        `Compare the work with this lesson's finish check: ${lesson.success || lesson.turnIn}`,
        "If a part is missing, tell the student one change to make. Let the student fix it. Check that part again.",
        "Give feedback on the work and explanation. Finishing the timer does not mean the work is done.",
        "If your school requires a grade, use its assigned rubric and school gradebook. This page does not set points or save student grades."
      ], "plain-list", true)
    ]) : null,
    adaptations(h, lesson, audience, grade, sub),
    student ? null : callout(h, "pb-safety", "Stay safe", lesson.safety, sub),
    studentResources.length ? h("section", { className: "pb-callout pb-resources" }, [
      h(sub, { text: student ? "Links and examples" : "Lesson resources" }),
      h("ul", { className: "plain-list" }, studentResources.map(resource => h("li", {}, [
        h("a", { text: resource.label, attributes: { href: resource.url, target: "_blank", rel: "noopener noreferrer" } }),
        h("p", { text: resource.description })
      ])))
    ]) : null,
    audience === "teacher" ? callout(h, "pb-cleanup", "Cleanup", lesson.cleanup, sub) : null,
    audience === "teacher" ? h("section", { className: "pb-callout pb-fourcs" }, [
      h(sub, { text: "Four Cs" }),
      h("p", { text: lesson.fourCs.map(id => FOUR_CS.find(item => item.id === id)?.label).filter(Boolean).join(", ") })
    ]) : null,
    student ? studentTools(h, actions) : null
  ]);
}

// A compact list of every meeting in one playbook. items: an optional list
// from findMeetings() that limits and relabels the meetings shown. grade:
// the student's grade, used to show one title at a split meeting.
export function buildPlaybookBrowser(playbookId, { audience = "student", selected = null, onOpenMeeting, onSwitchPlaybook, documentRef, items = null, grade = null, showTabs = true, emptyMessage = "No lesson matches that. Try fewer words." } = {}) {
  const h = createBuilder(documentRef);
  const playbook = getPlaybook(playbookId) ?? PLAYBOOKS[0];
  const visible = items ? new Map(items.map(item => [item.meeting.number, item])) : null;
  const tabs = showTabs ? h("div", { className: "pb-tabs", attributes: { role: "group", "aria-label": "Choose a playbook" } }, PLAYBOOKS.map(item => h("button", {
    className: item.id === playbook.id ? "pb-tab is-selected" : "pb-tab",
    attributes: { type: "button", "aria-pressed": String(item.id === playbook.id) },
    onClick: () => onSwitchPlaybook?.(item.id)
  }, [h("strong", { text: item.name }), h("span", { text: `${item.year} | ${item.status}` })]))) : null;
  const units = playbook.units.map(item => {
    const meetings = item.meetings.filter(meeting => !visible || visible.has(meeting.number));
    if (!meetings.length) return null;
    return h("section", { className: "pb-unit" }, [
      h(audience === "student" ? "h3" : "h4", { className: "pb-unit-title" }, [h("span", { text: item.title }), h("small", { text: audience === "student" ? studentSeason(item.season) : item.season })]),
      h("ol", { className: "pb-meeting-list", attributes: { start: String(meetings[0].number) } }, meetings.map(meeting => {
        const found = visible?.get(meeting.number) ?? null;
        const split = !meeting.paths.both && meeting.kind === "lesson";
        const singleTitle = found?.title ?? (split && (grade === 5 || grade === 6) ? lessonTitleForRef(meeting.paths[`g${grade}`]) : null);
        const other = found?.otherGrade ?? (split && (grade === 5 || grade === 6) ? `Grade ${grade === 5 ? 6 : 5} does ${lessonTitleForRef(meeting.paths[grade === 5 ? "g6" : "g5"])}.` : "");
        const label = split && !singleTitle
          ? [h("span", { className: "pb-meeting-split" }, [h("span", { text: "Grade 5: " + lessonTitleForRef(meeting.paths.g5) }), h("span", { text: "Grade 6: " + lessonTitleForRef(meeting.paths.g6) })])]
          : [h("span", { text: singleTitle ?? meetingTitle(meeting) }), other ? h("span", { className: "pb-meeting-other", text: other }) : null];
        const isNow = audience === "student" && meeting.number === playbook.nextMeeting && !meeting.done;
        const classes = ["pb-meeting", selected === meeting.number ? "is-selected" : "", meeting.done ? "is-done" : "", isNow ? "is-now" : ""].filter(Boolean).join(" ");
        const ariaLabel = `Meeting ${meeting.number}: ${singleTitle ?? meetingTitle(meeting)}${meeting.done ? ", finished" : isNow ? ", up next" : ""}`;
        return h("li", { className: "pb-meeting-item" }, [
          h("button", {
            className: classes,
            attributes: { type: "button", "aria-current": selected === meeting.number ? "true" : null, "aria-label": ariaLabel },
            onClick: () => onOpenMeeting?.(playbook.id, meeting.number)
          }, [
            h("span", { className: "pb-meeting-number", text: String(meeting.number), attributes: { "aria-hidden": "true" } }),
            h("span", { className: "pb-meeting-text" }, label),
            meeting.done ? h("span", { className: "pb-badge", text: "Done", attributes: { "aria-hidden": "true" } }) : null,
            isNow ? h("span", { className: "pb-badge pb-badge-now", text: "Now", attributes: { "aria-hidden": "true" } }) : null,
            meeting.kind !== "lesson" ? h("span", { className: "pb-badge pb-badge-flex", text: meeting.kind === "flex" ? "Flex" : "Buffer", attributes: { "aria-hidden": "true" } }) : null
          ])
        ]);
      }))
    ]);
  }).filter(Boolean);
  return h("section", { className: "pb-browser", attributes: { "aria-label": `${playbook.name} meetings` } }, [
    tabs,
    showTabs ? h("p", { className: "pb-summary", text: playbook.summary }) : null,
    audience === "teacher" ? h("details", { className: "pb-capacity" }, [
      h("summary", { text: "How this year fits" }),
      h("p", { text: playbook.capacity }),
      h("p", { text: playbook.balance }),
      h("p", { text: "The four strands, the Four Cs and Ask, Plan, Build, Test, Improve come from the CIRC K-6 Learning Continuum working draft. It is flexible guidance informed by PA STEELS, not a required course sequence. No formal standards alignment is claimed." })
    ]) : null,
    ...(units.length ? units : [h("p", { className: "student-finder-empty", text: emptyMessage })])
  ]);
}

export function totalMeetings(playbookId) { return listMeetings(playbookId).length; }

export function buildStationGuideLinks({ audience = "student", documentRef } = {}) {
  const h = createBuilder(documentRef);
  return h("div", { className: "pb-actions" }, STATION_GUIDES.filter(item => audience === "teacher" || !item.teacherOnly).map(item =>
    h("a", { className: "secondary-action", text: item.label, attributes: { href: item.url, target: "_blank", rel: "noopener" } })));
}

export function buildCurrentWeekEntry(resolved, { audience = "student", onOpenLesson, onStart, documentRef } = {}) {
  if (!resolved?.supplementalId) return null;
  const h = createBuilder(documentRef);
  return h("section", { className: "pb-callout pb-current-week", attributes: { "aria-label": "This week's CIRC lesson" } }, [
    h("p", { className: "eyebrow", text: "October 12-16 | This week's CIRC lesson" }),
    h("h2", { text: resolved.lesson.title }),
    h("p", { text: audience === "teacher" ? "Use build stations for this week's visit. Keep each class's annual lesson in place, then resume it at the next school visit. Later lessons move forward by one class visit." : "Start with MYnecraft and your group's project. Go to the ChompSaw demo only when your teacher calls your group." }),
    h("div", { className: "pb-actions" }, [
      onOpenLesson ? h("button", { className: "primary-action", text: "Open this week's lesson", attributes: { type: "button" }, onClick: () => onOpenLesson(resolved.supplementalId) }) : null,
      audience === "teacher" && onStart ? h("button", { className: "secondary-action", text: "Start station lesson", attributes: { type: "button" }, onClick: onStart }) : null,
      h("a", { className: "secondary-action", text: "Station student directions", attributes: { href: buildStudentLink({ lesson: resolved.supplementalId }) } })
    ]),
    buildStationGuideLinks({ audience, documentRef })
  ]);
}

export function buildSupplementalLibrary({ audience = "student", onOpenLesson, documentRef } = {}) {
  const h = createBuilder(documentRef);
  return h("section", { className: "pb-callout pb-retained-library", attributes: { "aria-label": "Retained lesson library" } }, [
    h("h2", { text: "Retained for next year" }),
    h("p", { text: "These complete lessons stay available when a class runs out of visits. Playbook B is already a full route: these are choices for next-year planning, not extra scheduled meetings. Keep end-of-year cleanup in this year's final visit." }),
    h("ul", { className: "plain-list" }, SUPPLEMENTAL_LESSONS.map(item => h("li", {}, [
      audience === "teacher" && onOpenLesson
        ? h("button", { className: "button-link", text: lessonTitleForRef(item.ref), attributes: { type: "button" }, onClick: () => onOpenLesson(item.id) })
        : h("a", { text: lessonTitleForRef(item.ref), attributes: { href: buildStudentLink({ lesson: item.id }) } }),
      h("p", { text: item.note })
    ])))
  ]);
}
