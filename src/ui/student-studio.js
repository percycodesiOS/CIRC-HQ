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
      "Choose a story below. On paper, write: Our audience will learn ___. Show the plan to Kenny before recording.",
      "Plan three shots: a wide view of the place or project, a close-up that proves your point, then one clear result or closing line.",
      "Use one camera horizontally and hold it steady. Record a 5-second sound test and listen before making the three clips. Film only people, places and work Kenny has cleared."
    ], output: "A one-sentence story and three labeled shots. No camera ready? Draw the three frames and rehearse the words." },
    { label: "Edit in iMovie", directions: [
      "On iPhone or iPad, open iMovie, start a Movie project, select your three clips and choose Create Movie. On Mac, choose Create New > Movie and add your clips to the timeline.",
      "Put the clips in beginning, evidence, ending order. Select each clip and drag its edges inward to remove waiting, mistakes and camera movement.",
      "Keep the whole video between 15 and 45 seconds. Use a short readable title and clear speech. Simple cuts are enough; skip extra effects and music if they hide the message.",
      "Play it all the way through with sound. A partner should be able to say the main idea. Add a readable text summary of the key fact so the meaning is visible too."
    ], output: "An edited iMovie project ready for Kenny to watch. CIRC HQ supplies the directions; the editing happens in iMovie." },
    { label: "Review with Kenny", directions: [
      "Check: 15-45 seconds, one clear idea, three useful shots, readable words and understandable sound.",
      "Verify the facts and remove unapproved names, faces, private screens or background conversations. Re-record if the sound or framing does not work.",
      "Show Kenny the full video before exporting or using it in the show. He decides whether to revise, hold or use it.",
      "After approval, save a video file to the location Kenny selects. On iPhone/iPad use Done > Share and the video-save options. On Mac use Share > File or Export File. Keep the editable project."
    ], output: "A teacher-reviewed video file plus its editable iMovie project. Do not publish or send it yourself." }
  ] },
  { id: "reporter", label: "Reporter / journalist", goal: "Find one useful school story and support it with checked facts.", steps: [
    { label: "Prepare a story pitch", directions: [
      "Choose a story below, then write one sentence: We want to show ___ because our school should know ___.",
      "Write three questions: What is happening? What evidence can we show? Why does it matter to students?",
      "Ask Kenny to approve the topic, location and anyone you want to interview. Report an event or idea without rumors or private information."
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
      "Bring the script and sources to Kenny. Only his approved version belongs in the broadcast."
    ], output: "A checked, rehearsed story ready for teacher review." }
  ] },
  { id: "weather", label: "Weather desk", goal: "Give a short, accurate Cranberry Township weather report.", steps: [
    { label: "Prepare with the forecast", directions: [
      "Open Cranberry Township forecast below. Check the location, Last Update and Forecast Valid dates. Refresh if the date is old.",
      "On paper, note today's expected high, the sky or rain forecast, and the time you checked. Use the forecast for the intended broadcast date.",
      "Compare the current observation with the forecast. The observation may come from a nearby airport; it is not a reading taken at our school."
    ], output: "A dated source note with the high, conditions and one useful detail. No internet? Ask Kenny for a checked forecast or leave weather out." },
    { label: "Make the weather report", directions: [
      "Choose two jobs: forecast checker and presenter. Other crew members can check the map or hold a simple cue card.",
      "Try: The National Weather Service forecast for Cranberry Township says ___. Today's high is about ___ degrees. For recess or dismissal, the forecast says ___.",
      "Use the hourly forecast for the time you mention. On the radar map, check the timestamp and legend before describing nearby rain. Radar shows observations, not a promise of future weather.",
      "Optional story: What changed from this morning? What does a chance of rain mean? Which hour looks warmest? Say what the source supports, and ask Kenny about any alert."
    ], output: "A 15-20-second forecast with a source and time. Use calm language and do not announce school closures or safety decisions." },
    { label: "Review before the show", directions: [
      "Recheck the forecast just before rehearsal. A forecast copied on Wednesday may need updating for Thursday.",
      "Keep forecast and observation wording clear. Have a partner check the date, temperature, location and pronunciation.",
      "Show Kenny the script and source. He approves the weather line and any practical reminder before broadcast."
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

export function buildStudentStudio({ deskId = "video", stepIndex = 0, onDesk, onStep, onExit } = {}, { document: documentRef = globalThis.document } = {}) {
  if (!documentRef?.createElement) throw new Error("student-studio-document-required");
  const desk = STUDENT_STUDIO_DESKS.find(item => item.id === deskId) ?? STUDENT_STUDIO_DESKS[0];
  const index = Number.isInteger(stepIndex) ? Math.max(0, Math.min(2, stepIndex)) : 0;
  const step = desk.steps[index];
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
  const link = (label, href) => node("a", `${label} (new tab)`, { href, target: "_blank", rel: "noopener noreferrer", class: "secondary-action" });
  return node("section", null, { class: "student-studio", "data-view": "student-studio", "aria-labelledby": "student-studio-heading" }, [
    node("header", null, { class: "student-studio-header" }, [
      node("p", "ECMS Morning Show | Student work area", { class: "eyebrow" }),
      node("h1", "Make one story worth sharing", { id: "student-studio-heading" }),
      node("p", "Choose a desk, complete one step, then check your work with Kenny. Write on paper and edit video in iMovie. This page does not collect names, save assignments or upload media."),
      action("Teacher: exit student work area", onExit)
    ]),
    node("nav", null, { "aria-label": "Choose your production desk", class: "student-studio-desks" }, STUDENT_STUDIO_DESKS.map(item => action(item.label, () => onDesk?.(item.id), { "aria-pressed": item.id === desk.id }))),
    node("section", null, { class: "student-studio-task", "aria-labelledby": "student-studio-task" }, [
      node("p", `${desk.label} | Step ${index + 1} of 3`, { class: "eyebrow" }),
      node("h2", step.label, { id: "student-studio-task" }),
      node("p", desk.goal, { class: "student-studio-goal" }),
      node("ol", null, {}, step.directions.map(text => node("li", text))),
      node("p", `Bring back: ${step.output}`, { class: "student-studio-output" }),
      node("div", null, { class: "student-studio-navigation" }, [
        index > 0 ? action("Previous step", () => onStep?.(index - 1)) : null,
        index < 2 ? action("Next step", () => onStep?.(index + 1), { class: "primary-action" }) : node("p", "Ready for Kenny's review. This page cannot approve or publish your work.", { role: "status" })
      ])
    ]),
    desk.id === "weather" ? node("section", null, { class: "student-studio-resources" }, [
      node("h2", "Cranberry Township weather tools"),
      node("p", "Official National Weather Service links for the school area. Open them when needed; no device location is requested. Check the source date every time."),
      link("Cranberry Township forecast", STUDENT_STUDIO_LINKS.forecast),
      link("Hourly forecast", STUDENT_STUDIO_LINKS.hourly),
      link("Pittsburgh radar map", STUDENT_STUDIO_LINKS.radar)
    ]) : node("details", null, { class: "student-studio-resources" }, [
      node("summary", "Story ideas to get started"),
      ...STORY_IDEAS.map(([title, prompt]) => node("article", null, {}, [node("h3", title), node("p", prompt)]))
    ]),
    desk.id === "video" ? node("details", null, { class: "student-studio-resources" }, [
      node("summary", "Official Apple iMovie help"),
      node("p", "Buttons can vary by iMovie version. Use Apple's instructions for your device."),
      link("Create an iMovie project", STUDENT_STUDIO_LINKS.create),
      link("Trim and arrange clips", STUDENT_STUDIO_LINKS.trim),
      link("Save a finished video", STUDENT_STUDIO_LINKS.export)
    ]) : null
  ]);
}
