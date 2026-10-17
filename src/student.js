// Student side. Curriculum only: this module and everything it imports never
// read browser storage, a teacher schedule, a class list or cloud data. The
// page state lives in the link itself (student.html?playbook=a&meeting=12&grade=5),
// so a bookmark or reload shows the same lesson. This is a separate screen,
// not a login or a security boundary.
import { PLAYBOOKS, buildStudentLink, currentWeekLesson, getPlaybook, listMeetings, parseStudentLink, resolveMeeting, resolveSupplementalLesson } from "./model/playbooks.js";
import { buildCurrentWeekEntry, buildLessonCard, buildPlaybookBrowser, buildSupplementalLibrary, createBuilder } from "./ui/playbook-view.js";

export function renderStudentPage(root, {
  location = globalThis.location,
  history = globalThis.history,
  documentRef = globalThis.document,
  scrollTo = globalThis.scrollTo,
  now = () => new Date()
} = {}) {
  const h = createBuilder(documentRef);
  let browseId = null;

  function current() {
    return parseStudentLink(location?.search ?? "");
  }

  function go(params) {
    const link = buildStudentLink(params, "");
    if (typeof history?.pushState === "function") history.pushState(null, "", link || "?");
    else location.search = link;
    browseId = parseStudentLink(link).playbook ?? browseId;
    render({ focus: true });
  }

  function picker(link) {
    const playbookId = link.playbook ?? PLAYBOOKS[0].id;
    const playbookSelect = h("select", { attributes: { id: "student-playbook" } }, PLAYBOOKS.map(item => h("option", { text: `${item.name} (${item.year})`, attributes: { value: item.id } })));
    playbookSelect.value = playbookId;
    const meetingSelect = h("select", { attributes: { id: "student-meeting" } });
    const fillMeetings = id => {
      meetingSelect.replaceChildren(...listMeetings(id).map(meeting => h("option", { text: `Meeting ${meeting.number}`, attributes: { value: String(meeting.number) } })));
      meetingSelect.value = String(link.playbook === id && link.meeting ? link.meeting : getPlaybook(id).nextMeeting);
    };
    fillMeetings(playbookId);
    playbookSelect.addEventListener("change", () => fillMeetings(playbookSelect.value));
    const gradeButtons = [5, 6].map(grade => h("button", {
      className: "primary-action student-grade-button",
      text: `I am in grade ${grade}`,
      attributes: { type: "button" },
      onClick: () => go({ playbook: playbookSelect.value, meeting: Number(meetingSelect.value), grade })
    }));
    return h("section", { className: "student-welcome", attributes: { "aria-labelledby": "student-welcome-title" } }, [
      h("img", { className: "student-welcome-art", attributes: { src: "assets/tech-terrarium-maker-scene.jpg", alt: "", width: "1942", height: "809" } }),
      h("div", { className: "student-welcome-copy" }, [
        h("p", { className: "eyebrow", text: "CIRC | Grades 5 and 6" }),
        h("h1", { text: "Find today's activity", attributes: { id: "student-welcome-title", tabindex: "-1" } }),
        h("p", { className: "student-lead", text: "Your teacher shares a link or shows the meeting number on the board. Pick it here." }),
        h("div", { className: "student-picker" }, [
          h("label", { text: "Playbook", attributes: { for: "student-playbook" } }), playbookSelect,
          h("label", { text: "Meeting number", attributes: { for: "student-meeting" } }), meetingSelect
        ]),
        h("div", { className: "pb-choice-row" }, gradeButtons)
      ])
    ]);
  }

  function gradeSwitch(link) {
    return h("div", { className: "student-grade-switch", attributes: { role: "group", "aria-label": "Your grade" } }, [
      h("span", { text: "Your grade:" }),
      ...[5, 6].map(grade => h("button", {
        className: link.grade === grade ? "secondary-action is-selected" : "secondary-action",
        text: `Grade ${grade}`,
        attributes: { type: "button", "aria-pressed": String(link.grade === grade) },
        onClick: () => go({ ...link, grade })
      })),
      h("button", {
        className: "button-link",
        text: "Pick a different meeting",
        attributes: { type: "button" },
        onClick: () => go({ playbook: link.playbook, grade: link.grade })
      })
    ]);
  }

  function render({ focus = false } = {}) {
    const link = current();
    if (browseId === null) browseId = link.playbook ?? PLAYBOOKS[0].id;
    let today;
    if (link.lesson || (link.playbook && link.meeting)) {
      const resolved = link.lesson ? resolveSupplementalLesson(link.lesson) : resolveMeeting(link.playbook, link.meeting, { grade: link.grade, option: link.option });
      today = h("div", { className: "student-today" }, [
        resolved.meeting.paths.both || link.grade ? gradeSwitch(link) : null,
        resolved.lesson ? h("section", { className: "pb-callout", attributes: { "aria-label": "How to do today's task" } }, [
          h("h2", { text: "Start here" }),
          h("p", {}, [h("strong", { text: `${resolved.lesson.steps[0].label}: ` }), h("span", { text: resolved.lesson.steps[0].directions[0] })]),
          h("p", { text: "Follow the numbered steps below with your class. Show the work listed under What to turn in before starting an optional challenge." }),
          h("p", { text: "This page gives directions; it does not save or collect your work." })
        ]) : null,
        buildLessonCard(resolved, {
          audience: "student",
          grade: link.grade,
          documentRef,
          headingLevel: "h1",
          actions: {
            onChoosePath: pathId => {
              if (pathId === "g5" || pathId === "g6") go({ ...link, grade: pathId === "g5" ? 5 : 6 });
              else go({ ...link, option: pathId === "on-track" ? "on-track" : null });
            }
          }
        })
      ]);
    } else {
      today = picker(link);
    }
    const browse = h("details", { className: "student-browse", attributes: { id: "browse" } }, [
      h("summary", { text: "Other lessons - open only when your teacher asks" }),
      h("h2", { text: "Browse the playbooks", attributes: { id: "student-browse-title" } }),
      h("p", { text: "Playbook A is this year. Playbook B is next year. Tap a meeting to see its steps." }),
      buildPlaybookBrowser(browseId, {
        audience: "student",
        selected: link.playbook === browseId ? link.meeting : null,
        documentRef,
        onSwitchPlaybook: id => { browseId = id; render(); },
        onOpenMeeting: (playbookId, number) => go({ playbook: playbookId, meeting: number, grade: link.grade })
      }),
      buildSupplementalLibrary({ documentRef })
    ]);
    const week = currentWeekLesson(now());
    const hasSelectedLesson = Boolean(link.lesson || (link.playbook && link.meeting));
    const currentEntry = week && !hasSelectedLesson ? buildCurrentWeekEntry(week, { documentRef, onOpenLesson: lesson => go({ lesson, grade: link.grade }) }) : null;
    root.replaceChildren(...[currentEntry, today, browse].filter(Boolean));
    if (focus) {
      scrollTo?.(0, 0);
      root.querySelector?.("#pb-lesson-title, #student-welcome-title")?.focus?.({ preventScroll: true });
    }
  }

  render();
  return { render };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const root = document.getElementById("student-main");
  if (root) {
    const page = renderStudentPage(root);
    window.addEventListener("popstate", () => page.render({ focus: true }));
  }
}
