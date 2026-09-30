// New Playbook A and B lessons. Same shape as the year-route lessons, so the
// existing runner, timers and student directions work without changes.
// Class meetings, not calendar dates. No student records.
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

function lesson({ id, title, objective, materials, safety, teacherContext, fastFinish, steps }) {
  return {
    id, title, label: title, objective, summary: objective,
    materials, safety, teacherContext, fastFinish, gradeBand: "5-6", supplies: materials,
    steps: steps.map(([slug, label, kind, minutes, directions, teacherDirections]) => ({
      id: `p02-${id}-${slug}`, label, kind, minutes, directions, teacherDirections
    }))
  };
}

const DEVICE_CLEANUP = ["save", "Save and shut", "cleanup", 4, [
  "Check that your work saved.",
  "Close the lid with two hands.",
  "Put the laptop back in its slot and plug it in."
], ["Count the cart before the class leaves."]];

const TABLE_CLEANUP = ["cleanup", "Reset together", "cleanup", 3, [
  "Return tools and reusable pieces.",
  "Put unfinished work in the class tray.",
  "Clear your table and floor."
], ["Call tool returns first. Count scissors back before the line forms."]];

// KidWind: one teacher-run station, one fixed load, one measurement for all four
// visits: centimeters the cup rises in 10 seconds, capped at 20 cm. Adapted from
// KidWind's MacGyver Windmills activity. The four 35-minute visits are a CIRC
// adaptation, not an official KidWind plan. Parts depend on what is on hand.
const KIDWIND_CLEANUP = ["cleanup", "Reset the station", "cleanup", 3, [
  "Fan off first.",
  "Rotor sets go flat in your team folder.",
  "Cup and load pieces go back in the station tray."
], ["Unplug the fan. Check that every station part is back."]];

const KIDWIND_SAFETY = "Only the teacher runs the fan and prepares any holes with pointed tools. Stay out of the rotor's spin path. Fan off before anyone touches blades, the cup or the string. Blades are paper or cardstock only. Shaft ends are blunt.";
const KIDWIND_MATERIALS = [
  "One teacher-run test station, built and piloted first from parts on hand",
  "One guarded fan at one fixed setting, with tape marks and a ruler",
  "A smooth, blunt shaft turning in a larger straw or tube, with a cork or foam hub",
  "String on a fixed spool, one small cup and the same load pieces every trial",
  "Cardstock or index cards, reusable blade supports, tape and student scissors",
  "A marked blade-angle example, timer, shallow catch tray, team folders and record sheets",
  "Printed practice data table for the no-fan paper path"
];
const KIDWIND_TEST_RULE = "Test rule: cup starts at the start line with the recorded load. Fan on for 10 seconds. Record centimeters lifted, 0 to 20. Stop early at the 20 cm mark so the cup never winds into the shaft. Fan off before any change or reset. Fan setting, distance, cup, load, shaft and spool never change.";
const KIDWIND_BASIS = "Adapted from KidWind's MacGyver Windmills activity. The four 35-minute visits are a CIRC adaptation, not an official KidWind lesson. No purchase, owned equipment or competition is implied.";

export const PLAYBOOK_LESSONS = freeze([
  lesson({
    id: "kidwind-lift",
    title: "KidWind 1: Make the wind do work",
    objective: "I can build blades that turn wind into work and measure how far they lift a load.",
    materials: KIDWIND_MATERIALS,
    safety: KIDWIND_SAFETY,
    teacherContext: [
      "Grade 5 only, first of four KidWind visits. Grade 6 runs CIRC Tank in the same weeks.",
      "Before the unit, build and pilot one working station. Teams make rotor sets and share that one station.",
      KIDWIND_TEST_RULE,
      KIDWIND_BASIS
    ],
    fastFinish: "Cut a spare set of blades in a new shape and label what you would test next.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Sit with your team.", "Read the goal: I can make the wind do work."], ["Say the goal. Show the station lifting the cup once."]],
      ["connect", "Tell your partner", "transition", 1, ["Tell your partner one place you feel strong wind."], ["Take one or two answers. Link wind to pushing."]],
      ["safety", "Station safety", "safety", 5, ["Watch the cup rise from the start line.", "Stay out of the spin path.", "Only the teacher turns the fan on or off."], ["Show the start line, the 20 cm mark and the stand-back line."]],
      ["build", "Build a rotor set", "work", 14, ["Cut three blades from cardstock.", "Tape each blade to a blade support.", "Set each blade at the same angle as the example."], ["Check that every blade is secure before it goes to the station."]],
      ["test", "Test at the station", "work", 8, ["Your team gets one 10 second trial.", "Watch the cup rise.", "Record the centimeters lifted."], ["Call teams in order. Write each result on the class chart."]],
      KIDWIND_CLEANUP,
      ["exit", "Show your result", "exit", 2, ["Say how many centimeters your blades lifted the cup.", "Name one thing you might change."], ["Accept a spoken answer or pointing at the chart."]]
    ]
  }),
  lesson({
    id: "kidwind-variable",
    title: "KidWind 2: Change one thing",
    objective: "I can change one thing about my blades and keep everything else the same.",
    materials: KIDWIND_MATERIALS,
    safety: KIDWIND_SAFETY,
    teacherContext: [
      "Grade 5 only, second KidWind visit. Teams need their Set A rotor from last time.",
      "One station: each team gets one Set A trial and one Set B trial. These are first results. Visit 3 repeats trials.",
      KIDWIND_TEST_RULE,
      KIDWIND_BASIS
    ],
    fastFinish: "Predict which change would help most next time and write why.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Find your team folder and your Set A rotor.", "Read the goal: change one thing only."], ["Say the goal. Check that every team has Set A."]],
      ["chart", "Read the chart", "transition", 1, ["Look at last time's class chart."], ["Point to the highest and lowest results in centimeters."]],
      ["demo", "Watch a fair test", "work", 4, ["Watch the teacher change only the blade angle.", "Notice what stays the same."], ["Name what stays the same: fan, distance, cup, load, shaft, spool."]],
      ["build", "Build Set B", "work", 12, ["Pick one thing to change: number, size, angle or shape.", "Keep everything else the same as Set A.", "Write the one change on your record sheet."], ["Ask each team to name its one change before it tests."]],
      ["test", "Test A and B", "work", 11, ["Test Set A once.", "Test Set B once.", "Record centimeters lifted for each trial."], ["Run both trials for a team back to back. Fan off for each swap."]],
      KIDWIND_CLEANUP,
      ["exit", "Share", "exit", 2, ["Tell the class which set lifted the cup higher and by how many centimeters."], ["Add each team's change to the class chart. Call them first results."]]
    ]
  }),
  lesson({
    id: "kidwind-best",
    title: "KidWind 3: Build the best set",
    objective: "I can use class evidence to build a better set of blades.",
    materials: KIDWIND_MATERIALS,
    safety: KIDWIND_SAFETY,
    teacherContext: [
      "Grade 5 only, third KidWind visit. The class chart is the evidence for today's design.",
      "Each team runs three trials in a row without changing the rotor. If the pilot shows this does not fit one station, run two and say so.",
      KIDWIND_TEST_RULE,
      KIDWIND_BASIS
    ],
    fastFinish: "Test one blade angle change on your best set and record it separately.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Sit with your team.", "Read the goal: use evidence to build better."], ["Say the goal. Put the class chart on the screen."]],
      ["connect", "Find your records", "transition", 1, ["Find your Set A and Set B results."], ["Hand out folders if needed."]],
      ["chart", "Read the class chart", "work", 5, ["Look for the sets that lifted the cup highest.", "What did those blades have in common?"], ["Circle the top three results. Ask what they share."]],
      ["build", "Build your best set", "work", 12, ["Use the evidence to design one best set.", "Say which chart result supports your choice."], ["Listen for evidence, not favorites."]],
      ["test", "Repeat fair trials", "work", 10, ["Run two or three 10-second trials, as your teacher directs.", "Record every result in centimeters, even the low ones."], ["Keep the fan, distance, cup and load the same for every team."]],
      KIDWIND_CLEANUP,
      ["exit", "Compare", "exit", 2, ["Compare your best set with your first set, in centimeters."], ["Accept a number and a reason."]]
    ]
  }),
  lesson({
    id: "kidwind-share",
    title: "KidWind 4: Tell what the wind taught us",
    objective: "I can explain what we changed, what happened, and the proof.",
    materials: [...KIDWIND_MATERIALS, "Three picture prompt cards: what we changed, what happened, our proof"],
    safety: KIDWIND_SAFETY,
    teacherContext: [
      "Grade 5 only, last KidWind visit. It works after a winter break with a short recap.",
      "Close with: in the innovation studio you will test your own idea the same way.",
      KIDWIND_TEST_RULE,
      KIDWIND_BASIS
    ],
    fastFinish: "Draw a bar chart of your three trials from last time.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Quick recap: what did our blades do?"], ["Recap the chart in one minute for classes back from break."]],
      ["connect", "Find your records", "transition", 1, ["Get your folder and your best set."], ["Hand out the picture prompt cards."]],
      ["test", "Final test", "work", 8, ["Run your best set for one 10 second trial.", "Record the centimeters lifted."], ["Run the station in team order."]],
      ["plan", "Plan your talk", "work", 12, ["Plan a 30 to 45 second talk.", "Say what we changed, what happened, and our proof in centimeters."], ["Check that every team has a centimeter result as proof."]],
      ["share", "Share your talk", "work", 7, ["Give your talk to another team.", "Listen and ask one question."], ["Pair teams. Time each talk."]],
      KIDWIND_CLEANUP,
      ["exit", "Show your result", "exit", 2, ["Say one thing the wind taught you."], ["Accept a spoken answer."]]
    ]
  }),
  lesson({
    id: "studio-retest",
    title: "Innovation Studio 2: Change one thing and retest",
    objective: "I can change one part of my design, run the same test, and decide to keep or undo it.",
    materials: ["Your studio model from last time", "Before and after record sheet", "Leftover maker bin", "Small tray per team", "Test tools from last time"],
    safety: "Use teacher-approved materials only. The teacher manages any knife cuts or hot glue. Keep the test the same as last time.",
    teacherContext: [
      "Grade 5 only, second studio meeting. It continues the Fix, Remix, or Invent Studio from last time.",
      "More support: offer two change ideas on cards and let the team pick one.",
      "More challenge: ask the team to predict the result before retesting and explain any surprise.",
      "No-tech path: teams draw the change and act out the test, then decide keep or undo with reasons."
    ],
    fastFinish: "Write the next change you would try and why.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Get your model and record sheet.", "Read the goal: one change, same test."], ["Hand out models from the class crate."]],
      ["connect", "Find your baseline", "transition", 1, ["Find last time's test result."], ["Check every team has a baseline number or note."]],
      ["read", "Read your baseline", "work", 4, ["Look at last time's test result.", "Pick the one part that held you back."], ["Ask: which part failed first?"]],
      ["change", "Make one change", "work", 12, ["Change one part only.", "Keep the test the same."], ["Open the teacher station for cuts or glue at set times."]],
      ["test", "Retest", "work", 8, ["Run the same test again.", "Record the new result next to the old one."], ["Watch that the test really is the same."]],
      ["decide", "Keep or undo", "work", 3, ["Did the change help?", "Keep it or undo it. Write why."], ["Accept keep or undo. Both are good engineering."]],
      TABLE_CLEANUP,
      ["exit", "Show your result", "exit", 2, ["Show your before and after results to the teacher."], ["Look for two results side by side."]]
    ]
  }),
  lesson({
    id: "innovation-share",
    title: "Innovation Share",
    objective: "I can show my problem, process, evidence and next step to my classmates.",
    materials: ["Studio models", "Team folders with KidWind and challenge records", "Label cards", "Existing display surfaces", "Pencils"],
    safety: "Keep walkways clear during the gallery walk. Touch other models only when invited.",
    teacherContext: [
      "Grade 5 only. Adapted from the CIRC Showcase Builder for one in-class period. No outside visitors are assumed.",
      "More support: provide sentence starters on the four label cards.",
      "More challenge: add one chart or number to the evidence label.",
      "No-tech or quiet path: a student can share by pointing to labels or by a written card instead of talking."
    ],
    fastFinish: "Write a kind, specific comment for one more exhibit.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Get your model and folder.", "Read the goal: show four parts."], ["Show the four label cards."]],
      ["connect", "Find your work", "transition", 1, ["Find one record from KidWind or a challenge."], ["Help teams find records in folders."]],
      ["demo", "Watch an exhibit", "work", 4, ["See the four parts: problem, process, evidence, next step."], ["Model one exhibit quickly with a sample."]],
      ["build", "Build your exhibit", "work", 12, ["Set out your model.", "Add one record as evidence.", "Write four short labels."], ["Check each exhibit has all four labels."]],
      ["tour", "Gallery walk", "work", 10, ["Visit two exhibits.", "Leave one kind, specific comment."], ["Rotate groups on a signal."]],
      ["takehome", "Take home decision", "cleanup", 4, ["Decide: take home, class sample, or recycle.", "Empty your crate cell."], ["Crates should be empty by the end of today."]],
      ["exit", "Reflect", "exit", 2, ["Name one thing you would change next time."], ["Accept a spoken or written answer."]]
    ]
  }),
  lesson({
    id: "tinker-move",
    title: "Tinkercad 1: Move, turn, size",
    objective: "I can place shapes in Tinkercad and control their size, height and turn.",
    materials: ["Cart laptops, charged", "Tinkercad Classroom class code, nicknames only", "Projected teacher demo", "Grid paper and rulers for the no-device path"],
    safety: "Join with the class code and a nickname only. No personal email. Use initials, not full names, on anything shown or printed.",
    teacherContext: [
      "Confirm Tinkercad approval and teacher access before this unit. If access is not approved, run the grid paper version of the same six visits.",
      "Grade 5: follow each step as written. Try the challenge only if finished.",
      "Grade 6: do the challenge: make the base a different shape.",
      "No-device path: draw a name plate to exact millimeter size on grid paper and cut it from card."
    ],
    fastFinish: "Make the base a different shape and keep the letters sitting on it.",
    steps: [
      ["signin", "Sign in", "ready", 4, ["Get your laptop.", "Join the class with the code and your nickname."], ["Write the class code on the board. Nobody signs in for a student."]],
      ["connect", "Tell your partner", "transition", 2, ["Tell your partner something you have seen that was 3D printed."], ["Take one or two answers."]],
      ["demo", "Watch the handles", "work", 4, ["Watch the teacher drag a box.", "See how to size, lift and turn it."], ["Show the white handles, the black lift arrow and the curved turn arrow."]],
      ["make", "Make a name plate", "work", 14, ["Drag a box for the base.", "Add letters with your initials or nickname.", "Size the letters to fit the base."], ["Circulate. Ask students to show you the side view."]],
      ["check", "Check it", "work", 4, ["Look from the side.", "Letters sit on the base, not floating or sunk.", "Show a partner your side view on screen."], ["Fix one floating plate with the class watching."]],
      DEVICE_CLEANUP,
      ["exit", "Tell how", "exit", 3, ["Tell a partner how you kept the letters on the base."], ["Accept a spoken answer. Laptops are already put away."]]
    ]
  }),
  lesson({
    id: "tinker-holes",
    title: "Tinkercad 2: Holes and group",
    objective: "I can use a hole shape and group to make a keychain tag with a working hole.",
    materials: ["Cart laptops, charged", "Tinkercad Classroom class code", "Projected teacher demo", "Card, hole punch and grid paper for the no-device path"],
    safety: "Nicknames or initials only. Laptops stay on the table.",
    teacherContext: [
      "Second of six Tinkercad visits.",
      "Grade 5: make the tag and the working hole.",
      "Grade 6: add a raised letter that is grouped with the tag.",
      "No-device path: draw the tag to size, punch a clean hole, and join two card layers."
    ],
    fastFinish: "Add a raised letter and group it with the tag.",
    steps: [
      ["signin", "Sign in", "ready", 4, ["Get your laptop.", "Open Tinkercad with the class code."], ["Help one table at a time."]],
      ["connect", "Recap", "transition", 1, ["Show a partner how to lift a shape."], ["Listen for the black lift arrow."]],
      ["demo", "Watch a hole", "work", 4, ["Watch a cylinder turn into a hole.", "Watch Group cut it out."], ["Show the preview from below so the hole is clear."]],
      ["make", "Make a tag", "work", 14, ["Make a box for your keychain tag.", "Set a cylinder to Hole and push it through a corner.", "Select both and choose Group."], ["Ask: can you see through it yet?"]],
      ["check", "Check the hole", "work", 5, ["Can you see through the hole?", "If not, push it all the way through.", "Show a partner the hole from underneath."], ["Fix one hole that stops halfway."]],
      DEVICE_CLEANUP,
      ["exit", "Tell how", "exit", 3, ["Tell a partner how you made the hole go all the way through."], ["Accept a spoken answer. Laptops are already put away."]]
    ]
  }),
  lesson({
    id: "tinker-mirror",
    title: "Tinkercad 3: Align and mirror",
    objective: "I can use duplicate, mirror and align to make both sides of a model match.",
    materials: ["Cart laptops, charged", "Tinkercad Classroom class code", "Projected teacher demo", "Folded grid paper for the no-device path"],
    safety: "Nicknames or initials only. Laptops stay on the table.",
    teacherContext: [
      "Third of six Tinkercad visits.",
      "Grade 5: build one half, then mirror and align it.",
      "Grade 6: add initials that stay readable after mirroring.",
      "No-device path: draw one half on folded grid paper, cut, and open to check both sides match."
    ],
    fastFinish: "Add your initials and check that they read the right way.",
    steps: [
      ["signin", "Sign in", "ready", 4, ["Get your laptop.", "Open Tinkercad with the class code."], ["Help one table at a time."]],
      ["connect", "Recap", "transition", 1, ["Tell a partner what Group does."], ["Listen for joining shapes into one."]],
      ["demo", "Watch mirror", "work", 4, ["Watch one half become two with Mirror.", "Watch Align line them up."], ["Show duplicate, mirror, then align, in that order."]],
      ["make", "Build a matching model", "work", 15, ["Build one half of a trophy or rocket.", "Duplicate it, then Mirror it.", "Use Align to line both halves up."], ["Ask students to explain which way they mirrored."]],
      ["check", "Check both sides", "work", 4, ["Do both sides match?", "Fix one side if they do not.", "Show a partner both sides on screen."], ["Check from the front view."]],
      DEVICE_CLEANUP,
      ["exit", "Name the tool", "exit", 3, ["Name the tool that helped your two sides match."], ["Accept a spoken answer. Laptops are already put away."]]
    ]
  }),
  lesson({
    id: "tinker-ramp",
    title: "Tinkercad 4: Design a skate park piece",
    objective: "I can design a skate park piece that fits the size rule and has a flat bottom.",
    materials: ["Cart laptops, charged", "Tinkercad Classroom class code", "One printed test ramp if a printer is ready", "Test boards or finger boards if approved, cardboard boards otherwise", "Rulers and size rule card: 80 by 60 by 40 millimeters"],
    safety: "Nicknames or initials only. Test boards stay on tables.",
    teacherContext: [
      "Fourth of six Tinkercad visits. Print and measure one test ramp before this visit if a printer is available.",
      "Grade 5: pick one piece and meet the size rule.",
      "Grade 6: add a grip texture or logo and still meet the size rule.",
      "No-device path: draw the piece on millimeter grid paper at 1:1 and build it in thin cardboard."
    ],
    fastFinish: "Add a grip texture or a small logo without breaking the size rule.",
    steps: [
      ["signin", "Sign in", "ready", 4, ["Get your laptop.", "Open Tinkercad with the class code."], ["Hold up the test ramp."]],
      ["connect", "Measure a board", "transition", 1, ["Hold a test board. How wide is it?"], ["A finger board is about 26 millimeters wide."]],
      ["demo", "Watch the size rule", "work", 4, ["No piece bigger than 80 by 60 by 40 millimeters.", "Flat bottom, at least 40 millimeters wide."], ["Show where Tinkercad shows the size numbers."]],
      ["make", "Design your piece", "work", 15, ["Choose a kicker ramp, quarter pipe, grind box or rail.", "Start from a wedge or a box.", "Check your size with the numbers."], ["Circulate with the size rule card."]],
      ["check", "Teacher check", "work", 4, ["Show the flat bottom and the size.", "Fix anything flagged."], ["Flag size and flat bottom only. Write a short note."]],
      DEVICE_CLEANUP,
      ["exit", "Show your result", "exit", 3, ["Tell a partner which piece you made and its size."], ["Accept a spoken answer."]]
    ]
  }),
  lesson({
    id: "tinker-export",
    title: "Tinkercad 5: Fix, export, queue",
    objective: "I can fix my design, export it, and put it in the class print folder with a clear name.",
    materials: ["Cart laptops, charged", "Tinkercad Classroom class code", "Class print folder the teacher set up", "File name pattern on the board: table number and piece"],
    safety: "Nicknames or initials only in file names.",
    teacherContext: [
      "Fifth of six Tinkercad visits. Printing happens between this visit and the next.",
      "Print cap: measure one print first, then print in queue order up to what the printer can finish. One piece per team is a simple rule.",
      "Grade 5: fix and export one piece. Grade 6: design a second piece that connects to the first.",
      "No-device path: fix the paper drawing and cut the final cardboard piece at 1:1."
    ],
    fastFinish: "Design a second piece that connects to your first.",
    steps: [
      ["signin", "Sign in", "ready", 4, ["Get your laptop.", "Open your skate park piece."], ["Hand back teacher notes from last time."]],
      ["connect", "Read your note", "transition", 1, ["Read the teacher note about your design."], ["Answer questions about notes quickly."]],
      ["fix", "Fix flagged parts", "work", 12, ["Fix what the note says.", "Check the size and flat bottom again."], ["Check fixes before export."]],
      ["export", "Export", "work", 7, ["Choose Export, then STL.", "Name the file with your table number and piece."], ["Show the export button on the projector."]],
      ["queue", "Queue it", "work", 4, ["Put your file in the class print folder.", "Check that your file name is there.", "Remember your file label and folder."], ["Watch the folder fill. Help anyone missing."]],
      DEVICE_CLEANUP,
      ["exit", "Tell the teacher", "exit", 3, ["Tell the teacher your file label and where you saved it."], ["Check the folder yourself later. Laptops are already put away."]]
    ]
  }),
  lesson({
    id: "tinker-pitch",
    title: "Tinkercad 6: Build day and pitch",
    objective: "I can assemble our table's skate park, test it, and pitch what we made.",
    materials: ["Printed pieces so far, laid out by table", "Thin cardboard and tape for any piece not printed", "Size gauge", "Park base sheet per table", "Test boards"],
    safety: "Pieces stay on the tables. Cardboard cuts use student scissors only.",
    teacherContext: [
      "Last of six Tinkercad visits. Every student tests and pitches, printed or not.",
      "Grade 5: pitch in 30 to 45 seconds with a partner: what it is and what was hard.",
      "Grade 6: give a 60 second pitch that adds what you would change and why.",
      "Build any unprinted piece in thin cardboard at 1:1 from the same millimeter numbers."
    ],
    fastFinish: "Add one connecting piece in cardboard so two pieces flow together.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Find your table's pieces.", "Read the goal: build, test, pitch."], ["Lay out printed pieces by table before class."]],
      ["connect", "Plan the park", "transition", 1, ["Decide where each piece goes."], ["Hand out base sheets."]],
      ["build", "Build the park", "work", 10, ["Place your table's pieces on the base sheet.", "Use cardboard for any piece not printed."], ["Help cardboard builders match the numbers."]],
      ["test", "Test with a board", "work", 6, ["Roll a board over each piece.", "Fix one thing that catches."], ["Watch for pieces that tip."]],
      ["pitch", "Pitch", "work", 8, ["Give your pitch.", "Say what it is, what was hard, and what you would change."], ["Call tables in order and keep time."]],
      ["cleanup", "Take home rule", "cleanup", 5, ["Follow the take home rule for printed pieces.", "Recycle cardboard scraps."], ["Say the take home rule clearly before cleanup."]],
      ["exit", "Show your result", "exit", 3, ["Name one skill you used from all six visits."], ["Accept a spoken answer."]]
    ]
  }),
  lesson({
    id: "reflect-reset",
    title: "Reflect, reset, take home",
    objective: "I can look back at my year of work, name what I learned, and take my work home.",
    materials: ["Student work and records from the year", "Reflection half sheets", "Pencils", "Inventory sheet for reusable sets", "Bags or folders for take home"],
    safety: "Carry models with two hands. Keep walkways clear.",
    teacherContext: [
      "Last meeting of the year. Everything goes home or gets recycled. Reusable sets get counted.",
      "Grade 5: draw or write one thing learned and one thing to change.",
      "Grade 6: write one evidence-backed tip for next year's class.",
      "No-tech or quiet path: students can draw, point to work, or tell the teacher one sentence."
    ],
    fastFinish: "Help count one reusable set on the inventory sheet.",
    steps: [
      ["ready", "Get ready", "ready", 2, ["Find your work from this year.", "Read the goal: look back and take it home."], ["Have work trays out before class."]],
      ["connect", "Tell your partner", "transition", 1, ["Tell a partner your favorite CIRC day."], ["Take one or two answers."]],
      ["layout", "Lay out your year", "work", 8, ["Lay out your records, models and files.", "Find one piece you are proud of."], ["Help students find missing pieces."]],
      ["reflect", "Write your reflection", "work", 10, ["Draw or write one thing you learned.", "Write one thing you would change."], ["Read reflections over shoulders. Ask one follow up."]],
      ["share", "Share one thing", "work", 6, ["Share your proud piece with a partner."], ["Pair students who have not talked yet."]],
      ["cleanup", "Take it home", "cleanup", 6, ["Pack your work to take home.", "Help count the reusable sets."], ["Collect the inventory sheet."]],
      ["exit", "Show your result", "exit", 2, ["Hand in your reflection sheet."], ["Collect sheets at the door."]]
    ]
  }),
  lesson({
    id: "catch-up",
    title: "Catch up and finish",
    objective: "I can find my missing work, finish it, and show it is done.",
    materials: ["Class record of missed meetings", "Materials from the missed lessons", "Team folders and class trays", "Board list of catch-up jobs"],
    safety: "Use only the materials for your catch-up job. The teacher runs any cutting or glue station.",
    teacherContext: [
      "Flex and buffer time. Use the class record to choose, never the date alone.",
      "A class that missed a core meeting does that meeting first. Never start a multi-meeting unit in a flex slot.",
      "Grade 5 and grade 6: same routine. Students pick one job from the board.",
      "No-tech path: students who have nothing missing help a teammate or improve one record sheet."
    ],
    fastFinish: "Help a teammate finish, or improve one label or record.",
    steps: [
      ["ready", "Check your list", "ready", 3, ["Look at the board.", "Find your missing piece of work."], ["Post the catch-up jobs on the board before class."]],
      ["connect", "Tell your partner", "transition", 1, ["Tell a partner what you will finish today."], ["Listen for a clear, small job."]],
      ["choose", "Pick your job", "work", 4, ["Finish, redo a test, or help a teammate.", "Tell the teacher your pick."], ["Write picks on a sticky note per table."]],
      ["make", "Catch up", "work", 16, ["Work on your one job.", "Ask for help early."], ["Visit students with the most missing first."]],
      ["check", "Check it", "work", 4, ["Show your finished piece to a partner or the teacher."], ["Mark the class record, not a public list."]],
      ["cleanup", "Reset together", "cleanup", 5, ["Return tools and materials.", "Put finished work in the right tray.", "Clear your table."], ["Check trays for the next class."]],
      ["exit", "Show your result", "exit", 2, ["Say what you finished today."], ["Accept a spoken answer."]]
    ]
  }),
  lesson({
    id: "b-welcome",
    title: "Welcome to CIRC",
    objective: "I can find my way around CIRC and help set our trust and respect rules.",
    materials: ["Room map on the board", "Chart paper for trust and respect", "Markers", "Ten index cards per table for the quick build"],
    safety: "Walk in the room. Keep bags and chairs out of walkways.",
    teacherContext: [
      "First meeting of the year. Build routines and belonging before content.",
      "Grade 5: new to CIRC. Show every tray and the door line slowly.",
      "Grade 6: returning. Ask them to explain one routine to the room.",
      "No-tech or quiet path: students can add a sticky note instead of speaking."
    ],
    fastFinish: "Improve your tower once more and explain what changed.",
    steps: [
      ["ready", "Find your seat", "ready", 3, ["Find your seat.", "Read the goal on the board."], ["Greet at the door. Point to seats."]],
      ["connect", "Meet a partner", "transition", 2, ["Tell a partner one thing you like to make."], ["Model a short answer first."]],
      ["tour", "How CIRC works", "work", 6, ["Look at our room map.", "Find the trays, tools and the door line."], ["Walk the room map on the screen."]],
      ["rules", "Trust and respect", "work", 8, ["With your table, write what trust looks like here.", "Do the same for respect."], ["Collect ideas onto one class chart."]],
      ["build", "Quick build", "work", 9, ["Build the tallest tower you can with ten cards.", "Test it. Improve it once."], ["Point out one improvement you see."]],
      TABLE_CLEANUP.map((part, index) => index === 3 ? 4 : part),
      ["exit", "Show your result", "exit", 3, ["Say one rule you will keep in CIRC."], ["Accept a spoken or written answer."]]
    ]
  }),
  lesson({
    id: "b-library-launch",
    title: "Library launch: find it and ask a question",
    objective: "I can use call numbers or shelf signs to find a book and write a question it could answer.",
    materials: ["Library shelves and signs", "Existing library catalog on a teacher device", "Call number cards", "Question slips and pencils", "Existing checkout system, if checkout runs today"],
    safety: "Walk between shelves. Put books back where you found them or on the return cart.",
    teacherContext: [
      "Library and information literacy. Checkout is conditional on the real schedule.",
      "Grade 5: find one book with a partner using shelf signs.",
      "Grade 6: find two books on one topic and compare which answers the question better.",
      "No-tech path: use printed call number cards and shelf signs only."
    ],
    fastFinish: "Find a second book that could answer the same question.",
    steps: [
      ["ready", "Get ready", "ready", 3, ["Sit with a partner.", "Read the goal: find it and ask."], ["Show a call number on the screen."]],
      ["connect", "Tell your partner", "transition", 2, ["Tell a partner about a book you liked."], ["Take one or two answers."]],
      ["demo", "How books are found", "work", 5, ["Watch how a call number points to a shelf."], ["Walk to one shelf and find a book live."]],
      ["find", "Find it", "work", 10, ["Pick a topic you are curious about.", "Use shelf signs or the catalog to find one book.", "Write its call number."], ["Help pairs read the signs."]],
      ["ask", "Ask a question", "work", 8, ["Write one question the book could answer.", "Check out the book if checkout runs today."], ["Run checkout only if it fits today's schedule."]],
      ["cleanup", "Reset together", "cleanup", 4, ["Return books you are not keeping.", "Push in chairs."], ["Check the shelves you used."]],
      ["exit", "Show your result", "exit", 3, ["Read your question to a partner."], ["Collect question slips."]]
    ]
  }),
  lesson({
    id: "b-factcard-research",
    title: "Fact card 1: Find and check a source",
    objective: "I can find three facts in a source I checked and write them in my own words.",
    materials: ["Library books or teacher-chosen websites", "Source check card: who made it, when, can I check it", "Fact sheet with three boxes and a source line", "Pencils"],
    safety: "Use only teacher-listed sites. No sign-ups or downloads.",
    teacherContext: [
      "Library and digital literacy. Students choose a topic they are into, then check the source before taking facts.",
      "Grade 5: use one book or one listed site. Copy the title and author.",
      "Grade 6: compare two sources and explain which is more trustworthy.",
      "No-tech path: books only, same fact sheet."
    ],
    fastFinish: "Find a fourth fact and check it in a second source.",
    steps: [
      ["ready", "Get ready", "ready", 3, ["Get your fact sheet.", "Read the goal: three checked facts."], ["Show the source check card."]],
      ["connect", "Tell your partner", "transition", 1, ["Tell a partner your topic."], ["Help anyone stuck pick a topic."]],
      ["check", "Check a source", "work", 5, ["Look at two sources the teacher shows.", "Which one would you trust? Why?"], ["Compare a strong source and a weak one."]],
      ["find", "Find three facts", "work", 14, ["Find three facts in one checked source.", "Write each fact in your own words."], ["Ask students to read a fact aloud without looking."]],
      ["cite", "Write the source", "work", 5, ["Write the title, the author or site, and the date."], ["Check source lines on three sheets."]],
      ["cleanup", "Save your notes", "cleanup", 4, ["Put your fact sheet in the class folder.", "Return books and devices."], ["Collect sheets for next time."]],
      ["exit", "Show your result", "exit", 3, ["Point to one fact you wrote in your own words."], ["Accept pointing or reading aloud."]]
    ]
  }),
  lesson({
    id: "b-factcard-design",
    title: "Fact card 2: Design it and share",
    objective: "I can design a clear fact card with my three facts and source, then share it with my teacher.",
    materials: ["Existing school devices on the cart", "School Canva through resources.svsd.net", "Fact sheets from last time", "Paper and markers for the fallback"],
    safety: "Use school Canva only. No new accounts, purchases or downloads. Share only with the teacher.",
    teacherContext: [
      "Digital literacy. Same rule as the Canva logo visits: it is turned in when you can open it from your school account. A name in Share alone is not enough.",
      "Grade 5: two colors, one font, three facts and the source line.",
      "Grade 6: explain one design choice that makes the card easier to read.",
      "If Canva or sign-in fails: make the card on paper with the same checklist."
    ],
    fastFinish: "Add a small picture or icon that matches one fact.",
    steps: [
      ["signin", "Sign in", "ready", 4, ["Get your device.", "Open resources.svsd.net, then Canva.", "Sign in with your school account."], ["Help one table at a time. Switch sign-in problems to paper."]],
      ["look", "Read a good card", "work", 3, ["Look at a fact card shown small.", "What makes it easy to read?"], ["Listen for big title, few colors, short lines."]],
      ["make", "Design your card", "work", 14, ["Start a blank design or a simple template.", "Add your three facts and your source line.", "Use two colors and one clear font."], ["No purchases. Skip anything marked with a crown."]],
      ["check", "Partner check", "work", 4, ["Trade screens. Can your partner read it from a step back?", "Fix one thing."], ["Ask what they fixed."]],
      ["share", "Share with teacher", "cleanup", 4, ["Choose Share.", "Add your CIRC teacher's school account.", "It is turned in when your teacher can open it."], ["Keep public and link sharing unchanged.", "Check that you can open it from your school account."]],
      ["devices", "Devices back", "cleanup", 3, ["Close Canva.", "Put your device back on the cart and plug it in."], ["Count the cart."]],
      ["exit", "Show your result", "exit", 3, ["Tell a partner which fact is most surprising."], ["Paper cards go in the class tray."]]
    ]
  }),
  lesson({
    id: "b-ai-check",
    title: "Check the AI answer",
    objective: "I can check claims in an AI-style answer against a trusted source and fix what is wrong.",
    materials: ["Printed AI answer cards the teacher prepared", "Library books or teacher-listed sites", "Highlighters or colored pencils", "Pencils"],
    safety: "No student AI accounts. Students read printed answers only.",
    teacherContext: [
      "Library and information literacy, including checking AI answers. Prepare cards ahead with a mix of right and wrong claims.",
      "Grade 5: check two claims with a partner.",
      "Grade 6: check every claim and explain why the wrong one might sound right.",
      "No-tech path: the whole lesson runs on paper with books."
    ],
    fastFinish: "Write one question you would ask an AI tool so the answer is easier to check.",
    steps: [
      ["ready", "Get ready", "ready", 3, ["Get your AI answer card.", "Read the goal: check, then fix."], ["Hand out cards and highlighters."]],
      ["connect", "Tell your partner", "transition", 1, ["Tell a partner a time something online was wrong."], ["Take one answer."]],
      ["demo", "Watch a check", "work", 5, ["AI tools can sound sure and still be wrong.", "Watch the teacher check one claim."], ["Check one claim live in a book or listed site."]],
      ["check", "Check the claims", "work", 13, ["Read your AI answer card.", "Find each claim in a book or checked source.", "Mark it: matches, wrong, or cannot find."], ["Ask: where did you find that?"]],
      ["fix", "Fix the answer", "work", 6, ["Rewrite one wrong claim correctly.", "Add where you found it."], ["Look for a source on every fix."]],
      ["cleanup", "Reset together", "cleanup", 4, ["Return books.", "Put your card in the class folder."], ["Collect cards."]],
      ["exit", "Show your result", "exit", 3, ["Read your fixed claim and its source."], ["Accept reading aloud or pointing."]]
    ]
  }),
  lesson({
    id: "b-code-sequence",
    title: "Code 1: Draw with a sequence",
    objective: "I can put code blocks in order to show pictures in the order I planned.",
    materials: ["Cart laptops, charged", "MakeCode for micro:bit in the browser, simulator only, if approved", "5 by 5 grid cards and pencils for the no-device path"],
    safety: "Use only the MakeCode link the teacher gives. No sign-in is needed for the simulator.",
    teacherContext: [
      "Computer science. The simulator needs no hardware. Confirm the site is allowed on student laptops before this block.",
      "Grade 5: two pictures in order.",
      "Grade 6: three pictures with a pause, and predict the result before running.",
      "No-device path: students write the steps on 5 by 5 grid cards and a partner runs them."
    ],
    fastFinish: "Add a third picture and a pause between each.",
    steps: [
      ["signin", "Open MakeCode", "ready", 4, ["Get your laptop.", "Open the MakeCode link on the board."], ["Show the link big on the screen."]],
      ["connect", "Tell your partner", "transition", 1, ["Tell a partner a set of steps you follow every day."], ["Link steps to order."]],
      ["demo", "Watch the blocks", "work", 4, ["Watch blocks snap together in order.", "Watch the simulator run them."], ["Swap two blocks to show order matters."]],
      ["make", "Draw with code", "work", 14, ["Use show leds to make a picture.", "Add a second picture after it.", "Run it in the simulator."], ["Ask students to say the order out loud."]],
      ["check", "Check the order", "work", 4, ["Does it show in the order you planned?", "Swap two blocks and watch what changes."], ["Point out one good bug fix."]],
      ["save", "Save and shut", "cleanup", 5, ["Name your project with your initials.", "Close the lid with two hands.", "Put the laptop back and plug it in."], ["Count the cart."]],
      ["exit", "Show your result", "exit", 3, ["Tell a partner what your pictures show, in order."], ["Accept a spoken answer."]]
    ]
  }),
  lesson({
    id: "b-code-loops",
    title: "Code 2: Loops make it move",
    objective: "I can use a loop to repeat pictures and make an animation.",
    materials: ["Cart laptops, charged", "MakeCode for micro:bit in the browser, simulator only, if approved", "Grid cards for the no-device path"],
    safety: "Use only the MakeCode link the teacher gives.",
    teacherContext: [
      "Computer science. Loops and debugging.",
      "Grade 5: three pictures in a forever loop.",
      "Grade 6: use a repeat loop with a set count and explain the difference from forever.",
      "No-device path: flip-book grid cards run by a partner, repeated three times."
    ],
    fastFinish: "Change the pause to speed up or slow down the animation.",
    steps: [
      ["signin", "Open MakeCode", "ready", 4, ["Get your laptop.", "Open the MakeCode link."], ["Show the link big on the screen."]],
      ["connect", "Recap", "transition", 1, ["Tell a partner why order matters."], ["Listen for one clear answer."]],
      ["demo", "Watch a loop", "work", 4, ["Watch forever repeat the same steps."], ["Show forever, then repeat 3 times."]],
      ["make", "Make it move", "work", 14, ["Make three pictures that change a little.", "Put them in a forever loop.", "Add a pause between them."], ["Ask: what repeats, and what changes?"]],
      ["debug", "Debug", "work", 4, ["Find one thing that looks wrong.", "Fix it and run again.", "Show your animation to a partner."], ["Celebrate one found bug."]],
      ["save", "Save and shut", "cleanup", 5, ["Name your project with your initials.", "Close the lid with two hands.", "Put the laptop back and plug it in."], ["Count the cart."]],
      ["exit", "Tell what repeats", "exit", 3, ["Tell a partner what repeats in your code."], ["Accept a spoken answer. Laptops are already put away."]]
    ]
  }),
  lesson({
    id: "b-code-conditions",
    title: "Code 3: If this, then that",
    objective: "I can make a program react differently when different buttons are pressed.",
    materials: ["Cart laptops, charged", "MakeCode for micro:bit in the browser, simulator only, if approved", "Paper if-then cards for the no-device path"],
    safety: "Use only the MakeCode link the teacher gives.",
    teacherContext: [
      "Computer science. Events and conditions, then testing a partner's program.",
      "Grade 5: button A and button B show different pictures.",
      "Grade 6: add a condition with if and else, and test every path.",
      "No-device path: partners play if-then card games that follow the same rules."
    ],
    fastFinish: "Add a shake event with its own picture.",
    steps: [
      ["signin", "Open MakeCode", "ready", 4, ["Get your laptop.", "Open the MakeCode link."], ["Show the link big on the screen."]],
      ["connect", "Recap", "transition", 1, ["Tell a partner what a loop does."], ["Listen for repeat."]],
      ["demo", "Watch a button", "work", 4, ["Watch on button A pressed change the picture."], ["Click A and B in the simulator."]],
      ["make", "Make it react", "work", 14, ["Show one picture when A is pressed.", "Show another when B is pressed.", "Test both buttons in the simulator."], ["Ask: what should happen if nobody presses?"]],
      ["test", "Trade and test", "work", 4, ["Test a partner's program.", "Tell them one bug or one win."], ["Model kind, specific feedback."]],
      ["save", "Save and shut", "cleanup", 5, ["Name your project with your initials.", "Close the lid with two hands.", "Put the laptop back and plug it in."], ["Count the cart."]],
      ["exit", "Show your result", "exit", 3, ["Say what happens when A is pressed."], ["Accept a spoken answer."]]
    ]
  })
]);

export function getPlaybookLessonDefinition(id) { return PLAYBOOK_LESSONS.find(item => item.id === id) ?? null; }
