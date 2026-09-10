// Public student directions only. Do not pass a teacher plan, crew list or script into this view.
export const STUDENT_STUDIO_LINKS = Object.freeze({
  forecast: "https://forecast.weather.gov/MapClick.php?FcstType=text&lat=40.7112&lg=english&lon=-80.1072",
  hourly: "https://forecast.weather.gov/MapClick.php?FcstType=graphical&lat=40.7112&lg=english&lon=-80.1072&unit=0",
  radar: "https://radar.weather.gov/station/KPBZ/standard",
  create: "https://support.apple.com/en-us/102242",
  trim: "https://support.apple.com/en-us/102353",
  export: "https://support.apple.com/en-us/102371"
});

export const STUDENT_STUDIO_DESKS = Object.freeze([
  { id: "video", label: "Short iMovie video", goal: "One camera. Three shots. A finished 15-45-second story.", steps: [
    { label: "Prepare your three shots", directions: [
      "Use Wednesday, September 9 and Thursday, September 10 work to finish one small story. If you already filmed, check your clips and move to Edit.",
      "Choose a story below. On paper, write: Our audience will learn ___. Show the plan to your teacher before recording.",
      "Plan three shots: a wide view of the place or project, a close-up that proves your point, then one clear result or closing line.",
      "Use one camera horizontally and hold it steady. Record a 5-second sound test and listen before making the three clips. Film only people, places and work your teacher has cleared."
    ], output: "A one-sentence story and three labeled shots. No camera ready? Draw the three frames and rehearse the words." },
    { label: "Edit in iMovie", directions: [
      "On iPhone or iPad, open iMovie, start a Movie project, select your three clips and choose Create Movie. On Mac, choose Create New > Movie and add your clips to the timeline.",
      "Put the clips in beginning, evidence, ending order. Select each clip and drag its edges inward to remove waiting, mistakes and camera movement.",
      "Keep the whole video between 15 and 45 seconds. Use a short readable title and clear speech. Simple cuts are enough; skip extra effects and music if they hide the message.",
      "Play it all the way through with sound. A partner should be able to say the main idea. Add a readable text summary of the key fact so the meaning is visible too."
    ], output: "An edited iMovie project ready for your teacher to watch. CIRC HQ supplies the directions; the editing happens in iMovie." },
    { label: "Review with your teacher", directions: [
      "Check: 15-45 seconds, one clear idea, three useful shots, readable words and understandable sound.",
      "Verify the facts and remove unapproved names, faces, private screens or background conversations. Re-record if the sound or framing does not work.",
      "Show your teacher the full video before exporting or using it in the show. He decides whether to revise, hold or use it.",
      "After approval, save a video file to the location your teacher selects. On iPhone/iPad use Done > Share and the video-save options. On Mac use Share > File or Export File. Keep the editable project."
    ], output: "A teacher-reviewed video file plus its editable iMovie project. Do not publish or send it yourself." }
  ] },
  { id: "reporter", label: "Reporter / journalist", goal: "Find one useful school story and support it with checked facts.", steps: [
    { label: "Prepare a story pitch", directions: [
      "Choose a story below, then write one sentence: We want to show ___ because our school should know ___.",
      "Write three questions: What is happening? What evidence can we show? Why does it matter to students?",
      "Ask your teacher to approve the topic, location and anyone you want to interview. Report an event or idea without rumors or private information."
    ], output: "A one-sentence pitch and three interview or research questions." },
    { label: "Gather and write", directions: [
      "Use a checked office notice, your direct observation or a teacher-approved interview. Record where each fact came from on your paper.",
      "Ask a short open question, listen, and check that you heard the answer correctly. Do not invent quotations or a person's name.",
      "Write a 3-5-sentence story: what happened, one useful detail, and why it matters or what students can do next.",
      "For four reporters, divide the work: ask questions, check facts, collect an approved visual, and write the closing. Swap jobs on the next story."
    ], output: "A short script with a source beside each factual claim. Choose the iMovie desk if your story needs a video." },
    { label: "Review and rehearse", directions: [
      "Check dates, names, numbers and quotations against your sources. Read the story aloud and shorten repeated details.",
      "Give a partner the script. Ask: What did you learn? What is still confusing? Make one improvement.",
      "Bring the script and sources to your teacher. Only his approved version belongs in the broadcast."
    ], output: "A checked, rehearsed story ready for teacher review." }
  ] },
  { id: "weather", label: "Weather desk", goal: "Give a short, accurate Cranberry Township weather report.", steps: [
    { label: "Prepare with the forecast", directions: [
      "Open Cranberry Township forecast below. Check the location, Last Update and Forecast Valid dates. Refresh if the date is old.",
      "On paper, note today's expected high, the sky or rain forecast, and the time you checked. Use the forecast for the intended broadcast date.",
      "Compare the current observation with the forecast. The observation may come from a nearby airport; it is not a reading taken at our school."
    ], output: "A dated source note with the high, conditions and one useful detail. No internet? Ask your teacher for a checked forecast or leave weather out." },
    { label: "Make the weather report", directions: [
      "Choose two jobs: forecast checker and presenter. Other crew members can check the map or hold a simple cue card.",
      "Try: The National Weather Service forecast for Cranberry Township says ___. Today's high is about ___ degrees. For recess or dismissal, the forecast says ___.",
      "Use the hourly forecast for the time you mention. On the radar map, check the timestamp and legend before describing nearby rain. Radar shows observations, not a promise of future weather.",
      "Optional story: What changed from this morning? What does a chance of rain mean? Which hour looks warmest? Say what the source supports, and ask your teacher about any alert."
    ], output: "A 15-20-second forecast with a source and time. Use calm language and do not announce school closures or safety decisions." },
    { label: "Review before the show", directions: [
      "Recheck the forecast just before rehearsal. A forecast copied on Wednesday may need updating for Thursday.",
      "Keep forecast and observation wording clear. Have a partner check the date, temperature, location and pronunciation.",
      "Show your teacher the script and source. He approves the weather line and any practical reminder before broadcast."
    ], output: "A current, checked weather line ready for teacher approval." }
  ] }
]);

const STORY_IDEAS = Object.freeze([
  ["CIRC build update", "What did a team change on the cardboard school model, and how did it improve the fit or stability?"],
  ["Kindness in action", "Show a teacher-approved example of a helpful action. Explain the action without naming someone who has not agreed."],
  ["One school event", "Use the latest approved office notice to explain what is happening, when it is and who it is for."],
  ["A useful how-to", "Demonstrate a simple classroom routine or a teacher-approved tool setup in three clear steps."],
  ["Outdoor classroom question", "Show an observation about plants, shade or habitat, then explain what you still need to investigate."]
]);

const DESK_BRIEFS = Object.freeze({
  video: {
    name: "Film", summary: "One camera. Three shots.", stages: ["Plan", "Edit", "Review"],
    titles: ["Tell it in three shots.", "Make every second count.", "Ready for the screen?"],
    actions: [
      ["Write your story in one sentence. Get your teacher's go-ahead.", "Plan a wide shot, a useful close-up and a clear ending.", "Film horizontally. Hold steady. Check a 5-second sound test."],
      ["Start a Movie project in iMovie and add your three clips.", "Put them in order. Trim away waiting, mistakes and camera shake.", "Keep 15-45 seconds. Add a readable title and check the sound."],
      ["Watch the whole video. Can a partner explain the main idea?", "Check every fact, face, name and background screen with your teacher.", "After his approval, save the video where he directs. Keep the project."]
    ],
    outputs: ["A one-sentence pitch + three planned shots.", "A 15-45-second iMovie project for your teacher to watch.", "Your video and editable project, reviewed by your teacher."]
  },
  reporter: {
    name: "Reporting", summary: "Find the story. Check the facts.", stages: ["Pitch", "Report", "Review"],
    titles: ["Find a story that matters.", "Go beyond the headline.", "Make the story clear."],
    actions: [
      ["Choose one school story. What should students learn?", "Write three questions: What happened? What proves it? Why care?", "Take your pitch and interview plan to your teacher before you start."],
      ["Ask, listen and check. Write down where each fact came from.", "Build a 3-5-sentence story: main idea, evidence, useful ending.", "Share the jobs: interview, fact check, visual and closing."],
      ["Check dates, names, numbers and quotes against your sources.", "Read it to a partner. Fix one thing they found confusing.", "Bring your teacher the script and sources before it goes in the show."]
    ],
    outputs: ["One story pitch + three questions.", "A short script with checked sources.", "A checked, rehearsed story for your teacher's review."]
  },
  weather: {
    name: "Weather", summary: "A useful forecast for our school.", stages: ["Check", "Write", "Review"],
    titles: ["What's the outlook?", "Make weather useful.", "Check it before the show."],
    actions: [
      ["Open the Cranberry Township forecast. Check its location and update time.", "Write down today's high, conditions and the time you checked.", "Look at the hourly forecast for recess and dismissal."],
      ["Pair up: one forecast checker and one presenter.", "Write 15-20 seconds: source, high, conditions and one useful detail.", "Use radar for rain happening now. Use the forecast for later."],
      ["Refresh the forecast before rehearsal. Check the broadcast date.", "Ask a partner to check the temperature, location and wording.", "Show your teacher the script and source before it goes on air."]
    ],
    outputs: ["A dated forecast note: high + conditions + one useful detail.", "A 15-20-second weather script with its source.", "A current weather line for your teacher to approve."]
  }
});

export function buildStudentStudio({ deskId = "video", stepIndex = 0, onDesk, onStep, onExit } = {}, { document: documentRef = globalThis.document } = {}) {
  if (!documentRef?.createElement) throw new Error("student-studio-document-required");
  const desk = STUDENT_STUDIO_DESKS.find(item => item.id === deskId) ?? STUDENT_STUDIO_DESKS[0];
  const index = Number.isInteger(stepIndex) ? Math.max(0, Math.min(2, stepIndex)) : 0;
  const step = desk.steps[index];
  const brief = DESK_BRIEFS[desk.id];
  const node = (tag, text, attributes = {}, children = []) => {
    const result = documentRef.createElement(tag);
    if (text !== null) result.textContent = text;
    for (const [name, value] of Object.entries(attributes)) result.setAttribute(name, String(value));
    result.append(...children.filter(Boolean));
    return result;
  };
  const action = (label, callback, attributes = {}) => {
    const result = node("button", label, { type: "button", class: "secondary-action", ...attributes });
    result.addEventListener("click", callback ?? (() => {}));
    return result;
  };
  const link = (label, href, className = "studio-tool-link") => node("a", label, { href, target: "_blank", rel: "noopener noreferrer", class: className, "aria-label": `${label} (new tab)` });
  const reference = node("details", null, { class: "student-studio-help" }, [
    node("summary", "Need the full directions?"),
    node("h3", step.label),
    node("p", desk.goal),
    node("ol", null, {}, step.directions.map(text => node("li", text))),
    node("p", step.output)
  ]);
  return node("section", null, { class: "student-studio", "data-view": "student-studio", "aria-labelledby": "student-studio-heading" }, [
    node("div", null, { class: "student-studio-masthead" }, [
      node("img", null, { src: "assets/icons/sv-interlock.png", alt: "Seneca Valley", width: "72", height: "42", class: "studio-sv-mark" }),
      node("p", "CIRC HQ / Student studio"),
      node("span", "STUDENT VIEW", { class: "studio-view-label" }),
      action("Teacher: exit student work area", onExit, { class: "studio-backstage-action" })
    ]),
    node("header", null, { class: "student-studio-header" }, [
      node("div", null, { class: "studio-hero-copy" }, [
        node("p", "OUR SCHOOL. OUR STORIES.", { class: "studio-kicker" }),
        node("h1", "The Morning Ehrman Show", { id: "student-studio-heading" }),
        node("p", "Make one story worth sharing. Choose your desk and get to work.", { class: "studio-hero-deck" })
      ]),
      node("img", null, { src: "assets/morning-show-studio.png", alt: "A video camera, microphone, headphones and blank storyboard cards on a maker studio table", class: "studio-hero-image", width: "1536", height: "1024" })
    ]),
    node("nav", null, { "aria-label": "Choose your production desk", class: "student-studio-desks" }, STUDENT_STUDIO_DESKS.map((item, position) => {
      const choice = action(null, () => onDesk?.(item.id), { class: "studio-desk", "aria-label": item.id === "weather" ? item.label : `${DESK_BRIEFS[item.id].name}: ${item.label}`, "aria-pressed": item.id === desk.id });
      choice.append(node("span", `0${position + 1}`, { class: "studio-desk-number", "aria-hidden": "true" }), node("span", null, {}, [node("strong", DESK_BRIEFS[item.id].name), node("small", DESK_BRIEFS[item.id].summary)]));
      return choice;
    })),
    node("div", null, { class: "student-studio-workspace" }, [
      node("aside", null, { class: `studio-desk-tools studio-tools-${desk.id}`, "aria-label": `${brief.name} tools` }, desk.id === "weather" ? [
        node("p", "NATIONAL WEATHER SERVICE", { class: "studio-kicker" }),
        node("h2", "Cranberry Township, PA"),
        node("p", "Start with the source. Check the update time.", { class: "studio-source-note" }),
        link("Cranberry Township forecast", STUDENT_STUDIO_LINKS.forecast, "studio-tool-link studio-tool-primary"),
        link("Hourly forecast", STUDENT_STUDIO_LINKS.hourly),
        link("Pittsburgh radar map", STUDENT_STUDIO_LINKS.radar),
        node("p", "Official tools open in a new tab.", { class: "studio-small-note" }),
        node("div", null, { class: "studio-prompt-card" }, [node("p", "ASK A BETTER WEATHER QUESTION", { class: "studio-kicker" }), node("h3", "What changes by dismissal?"), node("p", "Compare recess and dismissal in the hourly forecast. Explain one useful difference.")])
      ] : desk.id === "video" ? [
        node("p", "YOUR VIDEO BRIEF", { class: "studio-kicker" }),
        node("p", "15-45", { class: "studio-big-number" }),
        node("p", "SECONDS. ONE CLEAR IDEA.", { class: "studio-kicker" }),
        node("div", null, { class: "studio-shot-list" }, [["01", "Set the scene", "Wide shot"], ["02", "Show the evidence", "Close-up"], ["03", "Land the ending", "Result or final line"]].map(([number, title, detail]) => node("div", null, { class: "studio-shot" }, [node("span", number), node("div", null, {}, [node("strong", title), node("small", detail)])]))),
        node("p", "Edit in iMovie. Start on paper if a camera isn't ready.", { class: "studio-small-note" })
      ] : [
        node("p", "THE REPORTER'S NOTEBOOK", { class: "studio-kicker" }),
        node("h2", "Curiosity first. Evidence always."),
        node("div", null, { class: "studio-pitch" }, [node("p", "We want to show..."), node("p", "Our school should know..."), node("p", "Our source is...")]),
        node("p", "Write your answers on paper. A good story starts with a good question.", { class: "studio-small-note" })
      ]),
      node("section", null, { class: "student-studio-task", "aria-labelledby": "student-studio-task" }, [
        node("nav", null, { class: "studio-step-rail", "aria-label": `${brief.name} steps` }, brief.stages.map((stage, position) => action(`${position + 1} ${stage}`, () => onStep?.(position), { class: "studio-step", "aria-current": position === index ? "step" : "false" }))),
        node("p", `${brief.name} desk | Step ${index + 1} of 3`, { class: "studio-kicker" }),
        node("h2", brief.titles[index], { id: "student-studio-task" }),
        node("ol", null, { class: "studio-action-list" }, brief.actions[index].map(text => node("li", text))),
        node("p", `Bring back: ${brief.outputs[index]}`, { class: "student-studio-output" }),
        node("div", null, { class: "student-studio-navigation" }, [
          index > 0 ? action("Previous step", () => onStep?.(index - 1), { class: "studio-previous" }) : null,
          index < 2 ? action("Next step", () => onStep?.(index + 1), { class: "studio-next" }) : node("p", "Bring your work to your teacher for review.", { role: "status" })
        ]),
        reference
      ])
    ]),
    desk.id !== "weather" ? node("section", null, { class: "studio-story-bank", "aria-labelledby": "studio-story-heading" }, [
      node("p", "LOOK AROUND. THERE'S A STORY HERE.", { class: "studio-kicker" }),
      node("h2", "Take a story and make it yours.", { id: "studio-story-heading" }),
      node("div", null, { class: "studio-story-grid" }, STORY_IDEAS.map(([title, prompt], position) => node("details", null, { class: "studio-story" }, [node("summary", null, {}, [node("span", `0${position + 1}`, { "aria-hidden": "true" }), node("strong", title)]), node("p", prompt)])))
    ]) : null,
    desk.id === "video" ? node("details", null, { class: "student-studio-help studio-apple-help" }, [
      node("summary", "Official Apple iMovie help"), node("p", "Choose the instructions for your device. Links open in a new tab."),
      link("Create an iMovie project", STUDENT_STUDIO_LINKS.create), link("Trim and arrange clips", STUDENT_STUDIO_LINKS.trim), link("Save a finished video", STUDENT_STUDIO_LINKS.export)
    ]) : null,
    node("footer", "Plan on paper. Create with care. Review with your teacher.", { class: "studio-footer" })
  ]);
}
