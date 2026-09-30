// Playbook A (2026-27) and Playbook B (2027-28): two full-year alternating
// CIRC routes for grades 5 and 6. Meetings are class visits, not dates.
// Pure data and functions. This module never reads storage or a schedule,
// so the student page can use it safely.
import { getExperienceTimingPlan, getReplicaLessonChoice } from "./experience-timing-plans.js";
import { getProjectByNumber } from "./project-catalog.js";

function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// Four strands, Four Cs and the design process come from the CIRC K-6
// Learning Continuum working draft. It is flexible guidance informed by
// PA STEELS, not a required course sequence or a verified standards map.
export const STRANDS = freeze([
  { id: "digital", label: "Digital Literacy", short: "Digital", icon: "assets/playbook/strand-digital.svg", gradeFocus: "Independent workflows, Microsoft 365 and Canva, troubleshooting and careful AI use" },
  { id: "library", label: "Library and Information Literacy", short: "Library", icon: "assets/playbook/strand-library.svg", gradeFocus: "Research, checking whether a source is trustworthy, citing and paraphrasing, checking AI answers" },
  { id: "engineering", label: "Engineering and Design", short: "Engineering", icon: "assets/playbook/strand-engineering.svg", gradeFocus: "Criteria and constraints, blueprint, test and redesign" },
  { id: "cs", label: "Computer Science and Programming", short: "Coding", icon: "assets/playbook/strand-cs.svg", gradeFocus: "Conditions and loops, robotics, computational thinking and 3D design" }
]);
export const FOUR_CS = freeze([
  { id: "critical", label: "Critical thinking" },
  { id: "creativity", label: "Creativity" },
  { id: "collaboration", label: "Collaboration" },
  { id: "communication", label: "Communication" }
]);
export const DESIGN_STAGES = freeze([
  { id: "ask", label: "Ask" },
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "test", label: "Test" },
  { id: "improve", label: "Improve" }
]);

const S = { D: "digital", L: "library", E: "engineering", C: "cs" };
const C4 = { T: "critical", R: "creativity", O: "collaboration", M: "communication" };
function codes(text, map) { return text ? text.split("").map(code => map[code]) : []; }

// meta(strands, fourCs, stages, prep, turnIn, fallback, adapt)
// adapt is [grade 5, grade 6] for shared lessons or { support, stretch } for single-grade lessons.
// extra: { prepRequired, paperPath } for lessons that need teacher preparation
// or have a complete no-device path.
function meta(strands, fourCs, stages, prep, turnIn, fallback, adapt, extra = {}) {
  return {
    strands: codes(strands, S), fourCs: codes(fourCs, C4), stages: stages ? stages.split(" ") : [],
    prep, turnIn, fallback,
    adapt: Array.isArray(adapt) ? { grade5: adapt[0], grade6: adapt[1] } : adapt,
    prepRequired: extra.prepRequired ?? "",
    paperPath: extra.paperPath ?? null
  };
}
const one = (support, stretch) => ({ support, stretch });
const CART = "Laptop cart charged and counted";
const TRAYS = "Six table trays stocked, 30 scissors counted";
const CRATES = "Class crate out, labeled with the class code only";
const KIDWIND_PREP = [
  "Preparation required before the unit: build and pilot one working station from the parts actually on hand. Check free turning, reliable winding and a clear lift path.",
  "Pilot the load: choose a cup load the prototype can raise, and write down the exact load.",
  "Tape the start line, a mark 20 cm above it, the fan distance and the stand-back line.",
  "Time one full team trial and swap. If it does not fit, use the shorter trial counts in the teacher notes."
];
const PRACTICE_DATA = {
  label: "Practice data created for this lesson. These are not student measurements or evidence about a real blade design.",
  unit: "Centimeters lifted in 10 seconds with one unchanged cup and load",
  columns: ["Practice design", "Only stated change", "Trial 1", "Trial 2", "Trial 3"],
  rows: [
    ["A", "Baseline", "5", "10", "5"],
    ["B", "Blade angle only", "10", "15", "10"],
    ["C", "Blade size only, compared with A", "10", "10", "15"]
  ]
};
function paperPath(directions, evidence) {
  return {
    note: "Use these paper steps instead when your teacher chooses the no-fan path.",
    goal: "I can explain how wind can lift a load and use sample results to plan a fair test.",
    directions,
    evidence,
    data: PRACTICE_DATA
  };
}
const KIDWIND_FALLBACK = "No-fan paper path: follow the paper steps and the labeled practice data below. It uses the same measurement but does not claim you built or tested a windmill.";
const KIDWIND_READY = "Build and pilot one working station, choose and record the load, and time one trial before teaching. Nothing here confirms that preparation is done.";

const LESSON_META = freeze({
  "year:circ-neuro": meta("DL", "RM", "build improve", ["Finished for this year. Reuse only for a class that missed it."], "Artwork in the class tray, or the Paint file saved where the teacher showed.", "Paper and markers with the same line rules.", ["Four to six lines, large spaces, round every sharp corner.", "Vary line widths and explain one color choice."]),
  "year:circ-canva-template": meta("D", "RMT", "plan build improve", [CART, "Two or three real logos ready to show very small", "Board checklist posted", "Paper and pencils out for the fallback"], "Share with your CIRC teacher's school account. It is turned in when your teacher can open it. Keep public and link sharing unchanged.", "Paper and pencil sketch with the same steps. Move it to Canva next visit.", ["Pick one interest. Change the colors, icon and font.", "Explain why the slogan and icon match. Fix the weakest part at stamp size."]),
  "year:circ-canva-original": meta("D", "RMOT", "plan build test improve", [CART, "Board checklist posted", "Partner feedback starters on the board", "Paper and pencils out for the fallback"], "Share with your CIRC teacher's school account. It is turned in when your teacher can open it. Keep public and link sharing unchanged. Add two sentences about your choices.", "Paper sketch from a blank page with the same checklist.", ["Two or three simple shapes, two or three colors, one font.", "Make each choice on purpose and explain how it shows a strength or value."]),
  "year:circ-cardboard": meta("E", "TO", "build test improve", [TRAYS, "Teacher cut station set. The knife stays with the teacher."], "Three labeled joint samples and one stable shape in the class tray.", "Paper and cardstock tabs and slots work for every step.", ["Build one stable shape using a demonstrated join.", "Compare two join types and explain the tradeoff before choosing."]),
  "year:circ-packaging": meta("E", "TRO", "ask build test improve", [TRAYS, "Model products and reclaimed boxes at each table", "Handling test card posted"], "Your package and one before and after change, shown to the teacher.", "Cardstock package tested by hand with the same handling card.", ["Protect one object. Show one before and after change.", "Compare protection, material use and how easy it is to open."]),
  "year:circ-resin-plan": meta("E", "TM", "ask plan", ["Paper, rulers and example molds or pictures", "No resin out. This is dry planning only."], "Your labeled drawing and size estimate.", "The whole lesson is paper based.", ["Teacher-supported measuring and a labeled drawing.", "Calculate the volume and explain an irregular mold."]),
  "year:tank-notice": meta("E", "TM", "ask", ["Teacher-approved problem pictures out", CRATES], "Your problem sentence in the team folder: someone needs help with ___ when ___.", "Talk it through while the teacher or a partner writes the sentence.", one("Choose from three problem picture cards.", "Name who it affects and how you know it is real.")),
  "year:tank-listen": meta("EL", "MOT", "ask", ["Reusable user cards at each table", "Question starters on the board"], "A problem statement changed by one user's answer, in the team folder.", "Role-play the user with a card.", one("Use two question starters from the board.", "Ask a follow-up question and quote the answer.")),
  "year:tank-options": meta("E", "RT", "plan", ["Criteria cards and rulers out"], "Three sketches, one chosen idea and the reason.", "Describe three ideas aloud while a partner sketches.", one("Sketch two ideas, then one more with a partner.", "Score each idea against two criteria before choosing.")),
  "year:tank-plan": meta("E", "TO", "plan", [TRAYS, CRATES], "A labeled plan with a materials list.", "Plan on paper only.", one("Label three parts.", "Add measurements and stay inside the size limit.")),
  "year:tank-joins": meta("E", "TO", "build test", [TRAYS, "Craft sticks, string, fasteners and bands in trays", "Teacher cut and glue station set"], "An improved practice sample in the class crate.", "Tape and tab joins only.", one("Copy one demonstrated join.", "Test two joins and keep the stronger one.")),
  "year:tank-prototype": meta("E", "RO", "build", [TRAYS, CRATES, "Cell gauge ready: 21 by 14 by 12 cm"], "Version one in your crate cell with its folder.", "A paper model or drawing that shows the main job.", one("Build only the part that does the main job.", "Build to the planned measurements.")),
  "year:tank-test-plan": meta("E", "T", "plan test", ["Prototypes out of crates", "Test objects and timers ready"], "A written test plan: what changes and what stays the same.", "Explain the test aloud to the teacher.", one("Fill in a test plan frame.", "Add a success number you can measure.")),
  "year:tank-testing": meta("E", "TO", "test", ["Test objects and record sheets at each table"], "Three recorded trials in the team folder.", "The teacher runs the test while the team records.", one("Record with tally marks.", "Find the middle result and name one surprise.")),
  "year:tank-revision": meta("E", "TR", "test improve", [TRAYS, "Previous test records in folders"], "Before and after results for one change.", "Draw the change and explain the result you expect.", one("Pick from two suggested changes.", "Predict the result before retesting.")),
  "year:tank-user-test": meta("E", "MOT", "test improve", ["Reusable feedback cards out", "Scrap materials in trays"], "One user difficulty and the change you plan.", "A partner acts as the user with a scenario card.", one("Use the watch-only checklist.", "Write down the user's exact words.")),
  "year:tank-materials": meta("E", "TR", "improve", [TRAYS, "Safe material samples, and a scale if available"], "One part made smaller or reused, noted in the folder.", "Compare materials by touch and weight only.", one("Swap one material.", "Estimate how much material you saved.")),
  "year:tank-brand-package": meta("E", "RM", "build improve", ["Markers, reclaimed boxes and tape out"], "A readable label and a protective package.", "Make the label on paper only.", one("A name and one symbol.", "Explain how the label fits your user.")),
  "year:tank-pitch": meta("E", "MT", "test improve", ["Index cards and test records out"], "Four cue cards and one practice pitch.", "Pitch with folder pages, or hand in a written card.", one("Use a four-line pitch frame.", "Add one number from your testing.")),
  "year:tank-rehearse": meta("E", "MO", "improve", ["Timer on the screen", "Feedback cards out"], "A revised, timed pitch.", "Rehearse with a partner using written cues.", one("Practice once with a partner, then once for the class.", "Cut your pitch to the time limit and keep the evidence.")),
  "year:tank-showcase": meta("E", "MO", "improve", ["Display surfaces cleared", "Labels and first sketches out"], "Your first sketch next to your final model, with evidence. Then decide what goes home.", "Share by pointing to labels or with a written card.", one("Show your model and one piece of evidence.", "Explain how the evidence changed your design.")),
  "year:kidwind-lift": meta("E", "TO", "build test", KIDWIND_PREP, "Your team's centimeters lifted in 10 seconds, on your record sheet and the class chart.", KIDWIND_FALLBACK, one("Use the blade-angle example exactly.", "Predict the centimeters before you test."), { prepRequired: KIDWIND_READY, paperPath: paperPath(["Draw and label the blades, hub, shaft, string and cup.", "Read the practice table.", "Explain what one result means in centimeters."], "A labeled drawing and a correct reading of one result.") }),
  "year:kidwind-variable": meta("E", "TO", "plan test", KIDWIND_PREP, "Set A and Set B results in centimeters, with the one change named. These are first results.", KIDWIND_FALLBACK, one("Choose the change from two cards.", "Explain why everything else must stay the same."), { prepRequired: KIDWIND_READY, paperPath: paperPath(["Compare design A with design B.", "Name the one stated change.", "List what the test must keep the same.", "Read all three trials for each."], "A one-change sentence and a fair-test checklist.") }),
  "year:kidwind-best": meta("E", "TR", "test improve", KIDWIND_PREP, "Your best set's results from two or three 10-second trials, as your teacher directs, in centimeters and compared with your first set.", KIDWIND_FALLBACK, one("Copy one feature from a top result.", "Combine two features from different top results."), { prepRequired: KIDWIND_READY, paperPath: paperPath(["Compare design A with design C.", "Choose a design to test next.", "Use two table numbers to explain your choice.", "Draw the next test."], "A prediction backed by the table. It is not a measured new result.") }),
  "year:kidwind-share": meta("E", "MT", "improve", KIDWIND_PREP, "A 30 to 45 second talk with a centimeter result as proof.", KIDWIND_FALLBACK, one("Use the three picture prompt cards.", "Add a comparison to your first test."), { prepRequired: KIDWIND_READY, paperPath: paperPath(["Plan a 30 to 45 second talk.", "Say the change you propose and the practice evidence.", "Say what a real test must check.", "Call the numbers practice data."], "A talk or written card that calls the numbers practice data.") }),
  "year:studio-retest": meta("E", "TR", "test improve", [CRATES, "Leftover maker bin and small trays out"], "Before and after results and a keep or undo reason.", "Draw the change, act out the test, then decide keep or undo.", one("Pick one of two change cards.", "Predict the result before retesting and explain any surprise.")),
  "year:innovation-share": meta("E", "MO", "improve", [CRATES, "Four label cards per team"], "A four-label exhibit, then a take-home decision.", "Share by pointing to labels or with a written card.", one("Use the sentence starters on the label cards.", "Add a chart or number to the evidence label.")),
  "year:tinker-move": meta("CD", "TR", "build test", [CART, "Tinkercad class code on the board, nicknames only"], "A name plate with letters sitting on the base, shown on screen.", "Draw the name plate to millimeter size on grid paper and cut it from card.", ["Follow each step as written.", "Make the base a different shape."]),
  "year:tinker-holes": meta("CD", "TR", "build test", [CART, "Tinkercad class code on the board"], "A keychain tag with a hole you can see through.", "Draw the tag to size, punch a clean hole and join two card layers.", ["Make the tag and the working hole.", "Add a raised letter grouped with the tag."]),
  "year:tinker-mirror": meta("CD", "TR", "build test", [CART, "Tinkercad class code on the board"], "A model with matching sides.", "Draw one half on folded grid paper, cut, and open it.", ["Build one half, then mirror and align it.", "Add initials that stay readable after mirroring."]),
  "year:tinker-ramp": meta("CD", "RT", "plan build test", [CART, "Size rule card: 80 by 60 by 40 millimeters", "One printed test ramp if a printer is ready"], "A skate park piece that passes the size and flat bottom check.", "Draw the piece on millimeter grid paper at 1:1 and build it in thin cardboard.", ["Pick one piece and meet the size rule.", "Add a grip texture or logo and still meet the size rule."]),
  "year:tinker-export": meta("CD", "TO", "improve", [CART, "Class print folder set up", "File name pattern on the board"], "An STL file in the class print folder, named with your table number.", "Fix the paper drawing and cut the final cardboard piece at 1:1.", ["Fix and export one piece.", "Design a second piece that connects to the first."]),
  "year:tinker-pitch": meta("CDE", "MO", "test improve", ["Printed pieces laid out by table", "Thin cardboard and tape for unprinted pieces", "Park base sheet per table", "Test boards"], "Your pitch, and your piece tested on the table park.", "Build any unprinted piece in cardboard from the same numbers.", ["Pitch in 30 to 45 seconds with a partner: what it is and what was hard.", "Give a 60 second pitch that adds what you would change and why."]),
  "year:reflect-reset": meta("", "MT", "improve", ["Student work trays out", "Reflection half sheets", "Inventory sheet for reusable sets"], "Your reflection sheet. Everything else goes home.", "Draw, point to your work, or tell the teacher one sentence.", ["Draw or write one thing you learned and one thing you would change.", "Write one evidence-backed tip for next year's class."]),
  "year:catch-up": meta("", "TO", "", ["Class record of missed meetings", "Catch-up jobs listed on the board", "Materials from the missed lessons"], "The missing piece of work, shown to the teacher.", "Help a teammate or improve one record sheet.", ["Finish one missing piece with a checklist.", "Finish, then improve one earlier result."]),
  "year:setup-devices": meta("D", "TO", "", ["One charged laptop per student", "Projected teacher screen", "Hallway printer name on the board, only if time allows"], "Show the teacher your blue OneDrive cloud and Teams open.", "Pair with a neighbor and watch. Nobody signs in for anyone else.", ["Follow along step by step with the projected screen.", "Help a neighbor after your blue cloud check."]),
  "year:b-welcome": meta("E", "OM", "build test improve", ["Room map on the board", "Chart paper and markers", "Ten index cards per table"], "Your table's trust and respect ideas on the class chart.", "Add a sticky note instead of speaking.", ["Learn every tray and the door line.", "Explain one CIRC routine to the room."]),
  "year:b-library-launch": meta("L", "MT", "ask", ["Call number cards", "Question slips", "Checkout ready only if it runs today"], "One call number and one question the book could answer.", "Printed call number cards and shelf signs only.", ["Find one book with a partner using shelf signs.", "Find two books on one topic and compare which answers the question better."]),
  "year:b-factcard-research": meta("LD", "TM", "ask plan", ["Fact sheets with three boxes and a source line", "Source check card on the board", "Teacher-listed sites or library books ready"], "Your fact sheet with three facts in your own words and the source.", "Use library books only, same fact sheet.", ["Use one book or one listed site. Copy the title and author.", "Compare two sources and explain which is more trustworthy."], { prepRequired: "Preparation required: choose and check the listed sites or books, and make one strong and one weak example source for the Check a source step. This packet does not supply them." }),
  "year:b-factcard-design": meta("DL", "RM", "build improve", [CART, "Fact sheets from last time", "Paper and markers for the fallback"], "Share with your CIRC teacher's school account. It is turned in when your teacher can open it. Keep public and link sharing unchanged.", "Make the card on paper with the same checklist.", ["Two colors, one font, three facts and the source line.", "Explain one design choice that makes the card easier to read."]),
  "year:b-ai-check": meta("LD", "TM", "ask test improve", ["Printed AI answer cards prepared by the teacher", "Library books or teacher-listed sites", "Highlighters"], "Your checked card with one claim fixed and its source.", "The whole lesson runs on paper with books.", ["Check two claims with a partner.", "Check every claim and explain why the wrong one might sound right."], { prepRequired: "Preparation required: write the AI answer cards with a mix of right and wrong claims, check each claim in a named book or listed site, and keep an answer key. This packet does not supply card text, sources or a key." }),
  "year:b-code-sequence": meta("CD", "TR", "plan build test", [CART, "MakeCode simulator link on the board, if the site is allowed"], "A program that shows your pictures in the order you planned.", "Write the steps on 5 by 5 grid cards and have a partner run them.", ["Two pictures in order.", "Three pictures with a pause, and predict the result before running."]),
  "year:b-code-loops": meta("C", "TR", "build test improve", [CART, "MakeCode simulator link on the board"], "An animation that repeats in a loop.", "Flip-book grid cards run by a partner three times.", ["Three pictures in a forever loop.", "Use a repeat loop with a count and explain how it differs from forever."]),
  "year:b-code-conditions": meta("C", "TO", "build test", [CART, "MakeCode simulator link on the board"], "A program that reacts differently to button A and button B.", "Play if-then card games that follow the same rules.", ["Button A and button B show different pictures.", "Add an if and else condition and test every path."]),
  "catalog:3": meta("EL", "ORM", "ask plan build", ["Clipboards, site maps and tape measures counted", "Outdoor boundaries decided, weather checked"], "Your redesign with the user need and the location marked.", "Use photos or a map of the space indoors.", ["Name one user need and sketch one change.", "Use measurements to show the change fits the space."]),
  "catalog:5": meta("E", "TO", "plan build test improve", ["Two support blocks per team at a fixed gap", "Uniform load pieces counted", "Record sheets out"], "Your record sheet: most load held, one rebuild, same test repeated.", "The teacher runs one class test while teams predict and record.", ["Record the most load held with tally marks. Rebuild one part.", "Record loads in a table. Explain which shape change mattered and why."]),
  "catalog:6": meta("E", "TM", "ask test", ["30 clipboards counted", "Zone map copies", "Boundaries decided and weather checked", "Indoor weather data cards ready"], "Two mapped zones and one activity recommendation.", "Use the indoor weather data cards.", ["Record sun or shade, wind, surface and comfort with symbols.", "Add one measured reading if a tool exists. Defend a choice with two observations."]),
  "catalog:7": meta("E", "RT", "build test improve", ["Seed samples or image cards", "Teacher-run fan and a water tray"], "Your model seed and its trial results.", "Use image cards and drop tests by hand, with no fan or water.", one("Copy one real seed's travel trick.", "Change one feature and compare two trials.")),
  "catalog:8": meta("E", "TO", "plan build test improve", [TRAYS, "Drop zone marked. The teacher does every raised drop.", "Reusable payloads counted"], "Impact evidence and one revision.", "The teacher does low drops from table height, or design on paper.", one("Protect the payload with one idea, then improve it once.", "Explain how your change moved the force away from the payload.")),
  "catalog:9": meta("E", "TR", "build test", ["Copper tape, LEDs and switched battery holders counted", "The teacher checks each circuit before power"], "Your signal shown three times and the path traced.", "Draw the circuit path and trace it with a finger while the teacher demonstrates.", one("Build the circuit from the planning card.", "Add a switch and a clear message.")),
  "catalog:10": meta("E", "ROM", "plan build test improve", [TRAYS, "Contained game tokens counted"], "A playable game with a ten-second reset.", "Make a paper board game with the same rules.", ["One goal and one mechanism.", "Add a scoring rule and a ten-second reset."]),
  "catalog:11": meta("E", "TO", "build test improve", ["Water tubs, towels and foil sheets", "Cargo pieces counted. Laptops away."], "Your best cargo count and how hull shape helped.", "Dry version: fold hulls and predict while the teacher floats one.", ["Count cargo with tally marks.", "Compare two hull shapes and explain stability."]),
  "catalog:12": meta("E", "RT", "ask build test", [TRAYS, "Paper user figures and user cards"], "A mini model tested with a paper user figure.", "Draw and label the design for the user.", one("Pick a user card and build one feature.", "Test with two different users and adjust.")),
  "catalog:13": meta("E", "ROT", "build test improve", ["Dominoes, ramps, cups and balls in trays", "Final task cards out"], "Two complete runs and the handoff you fixed.", "Plan the chain on paper and act it out.", one("Three steps that work once.", "Two complete runs in a row.")),
  "catalog:14": meta("C", "TO", "plan test improve", ["Command cards and grid mats", "Safe classroom objects"], "The first bug and the command change that fixed it.", "This lesson is already device free.", one("Use four command cards.", "Find the shortest program that works.")),
  "catalog:15": meta("C", "T", "plan test improve", ["Grid maze cards, tokens and command cards"], "Your final command count and the command that fixed the first bug.", "This lesson is already device free.", one("Solve the small maze first.", "Find a shorter route and prove it.")),
  "catalog:16": meta("C", "TOM", "plan test", ["Two-color cards and binary mats", "Message slips"], "Your key, coded message and decoded result.", "Use cards only, no flashlights.", one("Send three letters with a partner.", "Add an error check and fix one mistake.")),
  "catalog:18": meta("E", "RT", "build test improve", ["Index cards, strips and fasteners in trays"], "A running animation with one smoothed frame.", "A paper flip book of the same frames.", one("Make four frames with small changes.", "Smooth one frame and explain the change.")),
  "catalog:19": meta("EC", "TO", "build test improve", [TRAYS, "Mixed model cargo in batches"], "Batch accuracy and the fix that stopped the most common error.", "Sort by hand with a written rule first.", one("Sort by one property you can see.", "Report batch accuracy as a fraction.")),
  "catalog:20": meta("C", "TM", "ask test", ["Sealed systems prepared by the teacher", "Input pieces and data tables"], "Your model, one supporting result and one question you still have.", "This lesson is already device free.", one("Try three inputs and record outputs.", "Explain one thing you still cannot tell.")),
  "catalog:21": meta("C", "TO", "plan test", ["Symbol cards, message strips and envelopes"], "The changed message and how the receiver caught it.", "This lesson is already device free.", one("Use one simple check rule.", "Design a check that fixes the error, not just finds it.")),
  "catalog:22": meta("E", "RMOT", "ask plan build test improve", [TRAYS, "Accessibility user cards and feedback cards"], "A 30 second pitch: user goal, barrier, test, result, change.", "Draw the prototype and pitch from the drawing.", one("Pick one barrier from a user card.", "Test with a second user and revise.")),
  "catalog:23": meta("E", "OT", "build test improve", [TRAYS, "Lightweight test objects and role cards"], "One successful move and how it serves the need.", "Draw the mechanism and act out the move.", one("Grip one test object.", "Move the object past a marked line safely.")),
  "catalog:25": meta("E", "RT", "ask build test", ["Clean, inspected reclaimed objects", TRAYS], "Your object's new job, explained before and after.", "Sketch the new use and explain it.", one("Give the object one new job.", "Explain why it is more than decoration.")),
  "catalog:26": meta("E", "TO", "build test improve", ["Water trays, towels and measuring cups", "Tape marks the wet zone. Laptops away."], "A measured flow result and one change that made the flow more even.", "A dry path model with one teacher pour demo.", ["Measure water at each plant site with a cup. Mark more or less.", "Calculate the percent of water recovered and name where it was lost."]),
  "catalog:27": meta("E", "TO", "build test improve", ["Sloped trays, measured water cups and towels", "Wet zone taped. Laptops away."], "Baseline and revised results, and what your change did.", "Watch one teacher demo and predict with drawings.", ["Compare before and after with a measuring cup.", "Explain what the model cannot prove."]),
  "catalog:28": meta("CD", "TR", "plan build test", ["Micro:bits or the MakeCode simulator, if available", "Paper code blocks for the fallback"], "Three input tests and your sensor, threshold and alert.", "Use paper code blocks to plan and run the program by hand.", ["Show an alert when a button or sensor changes.", "Choose a threshold and explain why."]),
  "catalog:29": meta("E", "TO", "plan test improve", ["Plastic mirrors and low-power lights", "Target cards"], "The light path traced to the target and one angle fix.", "Trace paths with a ruler on paper using angle cards.", ["Hit the target with two mirrors.", "Use one less mirror and explain the angles."]),
  "catalog:30": meta("E", "TO", "build test improve", ["Shake platforms, or a table shaken by hand with a fixed count", "Damage rubric out"], "Two damage scores and the change that helped.", "Shake the table by hand with a fixed count.", ["Build, shake, fix one weak spot.", "Compare damage scores and name the structural change."]),
  "catalog:31": meta("EL", "RTM", "ask plan build", ["Habitat photo cards and site maps", "Approval checklist out"], "Your observation, helper, benefit and risk.", "Use photo cards indoors.", ["Pick one habitat need and build one helper.", "Name one risk and the approval needed before any real action."]),
  "catalog:32": meta("EL", "RT", "ask build test", [TRAYS, "Nature reference cards"], "Your grabber and the animal or plant idea it copies.", "Draw the grabber and explain the nature idea.", one("Copy one hook or wrap from a nature card.", "Test two grips and keep the better one.")),
  "catalog:33": meta("E", "TO", "ask test", ["Coded material samples", "Droppers, small loads and data tables"], "Your chosen material with two test results and one tradeoff.", "Compare samples by touch, bend and weight only.", ["Test two properties and choose one material.", "Explain one tradeoff of your choice."]),
  "catalog:34": meta("E", "RT", "ask build test improve", [CRATES, "Repair, remix and invention cards", "Everyday maker bin"], "Your chosen path, a baseline test and a first attempt.", "Plan the fix, remix or invention on paper.", one("Pick a repair card with a clear flaw.", "Invent from a prompt and set your own success test.")),
  "catalog:36": meta("E", "MO", "test improve", ["Showcase exhibits or kept games", "Role cards and visitor prompts"], "Your final reflection with one visitor observation.", "Share with a written card or by pointing to the exhibit.", ["Host with a partner using role cards.", "Host alone and change one thing after feedback."])
});

// Meeting helpers. A ref is "year:<lesson id>" or "catalog:<experience number>".
const both = (ref, note) => ({ kind: "lesson", paths: { both: ref }, note });
const split = (g5, g6, note) => ({ kind: "lesson", paths: { g5, g6 }, note });
const flex = (onTrack, note) => ({ kind: "flex", paths: { "catch-up": "year:catch-up", "on-track": onTrack }, note });
const buffer = note => ({ kind: "buffer", paths: { "catch-up": "year:catch-up" }, note });

function unit(title, season, meetings) { return { title, season, meetings }; }

const PLAYBOOK_A_UNITS = [
  unit("Graphics and identity", "Fall", [
    { ...both("year:circ-neuro"), done: true },
    both("year:circ-canva-template", "Graphics visit 1 of 2. Replaces the older digitize plan."),
    both("year:circ-canva-original", "Graphics visit 2 of 2. Replaces the older Paint logo plan.")
  ]),
  unit("Build basics", "Fall", [
    both("year:circ-cardboard"),
    both("year:circ-packaging"),
    both("catalog:5", "Teaches the fair test before the grades split.")
  ]),
  unit("Two paths begin", "Late fall", [
    split("catalog:8", "year:tank-notice"),
    split("catalog:12", "year:tank-listen")
  ]),
  unit("Flex A", "Before Thanksgiving break", [
    flex("year:circ-resin-plan", "Catch up first. Classes that are on track do the dry casting plan.")
  ]),
  unit("KidWind and CIRC Tank", "About December", [
    split("year:kidwind-lift", "year:tank-options"),
    split("year:kidwind-variable", "year:tank-plan"),
    split("year:kidwind-best", "year:tank-joins"),
    split("year:kidwind-share", "year:tank-prototype", "KidWind 4 is a short share that survives a winter break gap.")
  ]),
  unit("Grade 5 innovation, grade 6 Tank", "Winter", [
    split("catalog:14", "year:tank-test-plan"),
    split("catalog:19", "year:tank-testing"),
    split("catalog:23", "year:tank-revision"),
    split("catalog:25", "year:tank-user-test"),
    split("catalog:22", "year:tank-materials"),
    split("catalog:18", "year:tank-brand-package", "First to cut for grade 5 if a class loses more than two meetings.")
  ]),
  unit("Studio, pitch and share", "Late winter", [
    split("catalog:34", "year:tank-pitch"),
    split("year:studio-retest", "year:tank-rehearse"),
    split("year:innovation-share", "year:tank-showcase", "Both grades take work home. Crates are empty after this meeting.")
  ]),
  unit("Water flow", "Early spring", [
    both("catalog:26", "A one-period water lab. Nothing waits in storage over spring break.")
  ]),
  unit("Tinkercad Skate Park", "Spring", [
    both("year:tinker-move", "Check Tinkercad approval and printer time before this unit. The grid paper path keeps the same six goals."),
    both("year:tinker-holes"),
    both("year:tinker-mirror"),
    both("year:tinker-ramp"),
    both("year:tinker-export"),
    both("year:tinker-pitch")
  ]),
  unit("Flex B and close", "End of year", [
    flex("catalog:6", "Catch up first. Classes that are on track map the outdoor zones."),
    both("year:reflect-reset"),
    buffer("Only for classes that get one more visit. No new unit.")
  ])
];

const PLAYBOOK_B_UNITS = [
  unit("Welcome and routines", "Fall", [
    both("year:b-welcome"),
    both("year:setup-devices", "Fills the whole period. Run once per class."),
    both("year:b-library-launch")
  ]),
  unit("Research to design", "Fall", [
    both("year:b-factcard-research"),
    both("year:b-factcard-design", "Same sharing rule as the Canva logo visits.")
  ]),
  unit("Materials and water", "Fall", [
    both("catalog:33"),
    both("catalog:11")
  ]),
  unit("Two paths begin", "Late fall", [
    split("catalog:7", "year:tank-notice"),
    split("catalog:9", "year:tank-listen")
  ]),
  unit("Flex A", "Before Thanksgiving break", [
    flex("catalog:30", "Catch up first. Classes that are on track run the shake test.")
  ]),
  unit("KidWind and CIRC Tank", "Late fall. Teacher places the four visits around December after checking next year's calendar", [
    split("year:kidwind-lift", "year:tank-options", "Not a verified 2027-28 placement. If these visits land too early, move complete independent units ahead of this block. Keep the four KidWind visits in order and Tank 1 and 2 before Tank 3."),
    split("year:kidwind-variable", "year:tank-plan"),
    split("year:kidwind-best", "year:tank-joins"),
    split("year:kidwind-share", "year:tank-prototype", "KidWind repeats each year for a new grade 5 group.")
  ]),
  unit("Grade 5 code and systems, grade 6 Tank", "Winter", [
    split("catalog:15", "year:tank-test-plan"),
    split("catalog:16", "year:tank-testing"),
    split("catalog:20", "year:tank-revision"),
    split("catalog:21", "year:tank-user-test"),
    split("catalog:32", "year:tank-materials"),
    split("catalog:13", "year:tank-brand-package", "First to cut for grade 5 if a class loses more than two meetings.")
  ]),
  unit("Studio, pitch and share", "Late winter", [
    split("catalog:34", "year:tank-pitch"),
    split("year:studio-retest", "year:tank-rehearse"),
    split("year:innovation-share", "year:tank-showcase", "Both grades take work home. Crates are empty after this meeting.")
  ]),
  unit("Check the facts", "Late winter", [
    both("year:b-ai-check")
  ]),
  unit("Water and code", "Spring", [
    both("catalog:27"),
    both("year:b-code-sequence", "Check that the MakeCode site is allowed before this unit. The grid card path keeps the same goals."),
    both("year:b-code-loops"),
    both("year:b-code-conditions"),
    both("catalog:28")
  ]),
  unit("Build and explore", "Late spring", [
    both("catalog:10", "Keep finished games flat in the crate if you plan to host them at Demo Day."),
    both("catalog:31"),
    both("catalog:3")
  ]),
  unit("Flex B and close", "End of year", [
    flex("catalog:29", "Catch up first. Classes that are on track run the mirror maze."),
    both("catalog:36", "Host the arcade games or another kept project for classmates."),
    both("year:reflect-reset"),
    buffer("Only for classes that get one more visit. No new unit.")
  ])
];

function numberUnits(units) {
  let number = 0;
  return units.map(item => ({
    ...item,
    meetings: item.meetings.map(meeting => ({ ...meeting, number: ++number }))
  }));
}

export const PLAYBOOKS = freeze([
  {
    id: "a",
    name: "Playbook A",
    year: "2026-27",
    status: "This year",
    summary: "This year's route. NeuroArt is finished. Two Canva logo visits come next, then building, grade 5 KidWind in December while grade 6 runs CIRC Tank, water flow, and a six-visit Tinkercad skate park.",
    capacity: "31 meetings plus one buffer. From September 28, 2026 cycle days 1 to 3 have 31 visits left and days 4 and 5 have 30, so the buffer is only for days 1 to 3. Dates can shift. Mark a class by its record, never by the date.",
    balance: "More 3D design and building. Playbook B carries more library and research work.",
    nextMeeting: 2,
    units: numberUnits(PLAYBOOK_A_UNITS)
  },
  {
    id: "b",
    name: "Playbook B",
    year: "2027-28",
    status: "Next year",
    summary: "Next year's route, a full year from the first week. New shared projects practice the same skills: library research, fact cards, checking AI answers, block coding, materials, water and an arcade. Grade 5 KidWind and grade 6 CIRC Tank repeat because each student meets them once.",
    capacity: "35 meetings plus one buffer, planned from this year's calendar of 35 or 36 visits per class. Check the 2027-28 calendar before relying on it. If a class has fewer visits, drop the flex on-track choices first.",
    balance: "More library, research and coding. Playbook A carries more 3D design.",
    nextMeeting: 1,
    units: numberUnits(PLAYBOOK_B_UNITS)
  }
]);

export function getPlaybook(id) { return PLAYBOOKS.find(item => item.id === id) ?? null; }
export function listMeetings(playbookId) { return getPlaybook(playbookId)?.units.flatMap(item => item.meetings.map(meeting => ({ ...meeting, unit: item.title, season: item.season }))) ?? []; }
export function getMeeting(playbookId, number) { return listMeetings(playbookId).find(meeting => meeting.number === number) ?? null; }

function sentenceCase(label) {
  if (typeof label !== "string" || label !== label.toUpperCase()) return label;
  const lower = label.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function stepsFrom(plan, sourceSteps) {
  return plan.steps.map((step, index) => ({
    label: sourceSteps?.[index]?.label ?? sentenceCase(step.label),
    kind: step.kind,
    minutes: step.minutes,
    directions: [...step.directions],
    teacherDirections: [...(step.teacherDirections ?? [])]
  }));
}

export function lessonTitleForRef(ref) {
  const [type, id] = String(ref).split(":");
  if (type === "catalog") return getProjectByNumber(Number(id))?.title ?? "";
  return getReplicaLessonChoice(id)?.title ?? "";
}

// One normalized lesson shape for both the student page and the teacher view.
export function getLessonForRef(ref) {
  const [type, id] = String(ref).split(":");
  const info = LESSON_META[ref];
  if (!info) return null;
  let base;
  if (type === "catalog") {
    const number = Number(id);
    const project = getProjectByNumber(number);
    const plan = getExperienceTimingPlan(number);
    if (!project || !plan) return null;
    base = {
      title: project.title,
      goal: project.objective,
      materials: [...project.materials],
      safety: project.safety,
      steps: stepsFrom(plan),
      success: project.exitEvidence,
      cleanup: [project.cleanup],
      extension: `${project.fastFinish.title}: ${project.fastFinish.directions}`,
      teacherNotes: [...project.teacherSay, ...project.teacherDo],
      runner: { projectNumber: number }
    };
  } else if (type === "year") {
    const source = getReplicaLessonChoice(id);
    const plan = getExperienceTimingPlan(2, { modeId: id });
    if (!source || !plan) return null;
    const steps = stepsFrom(plan, Array.isArray(source.steps) ? source.steps : null);
    const exit = steps.filter(step => step.kind === "exit").flatMap(step => step.directions);
    base = {
      title: source.title,
      goal: source.objective,
      materials: [...source.materials],
      safety: source.safety,
      steps,
      success: exit.join(" "),
      cleanup: steps.filter(step => step.kind === "cleanup").flatMap(step => step.directions),
      extension: source.fastFinish,
      teacherNotes: [...source.teacherContext].filter(line => !/^(Grade 5|Grade 6|More support):/.test(line)),
      runner: { projectNumber: 2, modeId: id }
    };
  } else {
    return null;
  }
  return {
    ref,
    ...base,
    minutes: base.steps.reduce((sum, step) => sum + step.minutes, 0),
    strands: [...info.strands],
    fourCs: [...info.fourCs],
    stages: [...info.stages],
    prep: [...info.prep],
    turnIn: info.turnIn,
    fallback: info.fallback,
    adapt: { ...info.adapt },
    prepRequired: info.prepRequired,
    paperPath: info.paperPath
  };
}

const PATH_LABELS = Object.freeze({ both: "Grades 5 and 6", g5: "Grade 5", g6: "Grade 6", "catch-up": "Catch up", "on-track": "On track" });
export function pathLabel(path) { return PATH_LABELS[path] ?? ""; }

// Pick the lesson a class should see for one meeting.
export function resolveMeeting(playbookId, number, { grade = null, option = null } = {}) {
  const playbook = getPlaybook(playbookId);
  const meeting = getMeeting(playbookId, number);
  if (!playbook || !meeting) return null;
  const pathIds = Object.keys(meeting.paths);
  let path = null;
  if (meeting.paths.both) path = "both";
  else if (meeting.kind === "lesson") path = grade === 5 ? "g5" : grade === 6 ? "g6" : null;
  else path = option === "on-track" && meeting.paths["on-track"] ? "on-track" : "catch-up";
  const choices = pathIds.map(id => ({ id, label: pathLabel(id), title: lessonTitleForRef(meeting.paths[id]) }));
  return {
    playbook: { id: playbook.id, name: playbook.name, year: playbook.year, status: playbook.status },
    meeting,
    path,
    choices,
    lesson: path ? getLessonForRef(meeting.paths[path]) : null
  };
}

export function meetingTitle(meeting) {
  if (meeting.paths.both) return lessonTitleForRef(meeting.paths.both);
  if (meeting.kind === "flex") return "Flex: catch up or " + lessonTitleForRef(meeting.paths["on-track"]);
  if (meeting.kind === "buffer") return "Buffer: catch up and finish";
  return `Grade 5: ${lessonTitleForRef(meeting.paths.g5)} | Grade 6: ${lessonTitleForRef(meeting.paths.g6)}`;
}

export function strandCoverage(playbookId, path = "g5") {
  const counts = Object.fromEntries(STRANDS.map(strand => [strand.id, 0]));
  for (const meeting of listMeetings(playbookId)) {
    const ref = meeting.paths.both ?? meeting.paths[path] ?? meeting.paths["on-track"];
    for (const strand of LESSON_META[ref]?.strands ?? []) counts[strand] += 1;
  }
  return counts;
}

// Student links carry curriculum identifiers only. Never a class, teacher, date or time.
const LINK_KEYS = new Set(["playbook", "meeting", "grade", "option"]);
export function parseStudentLink(fragment) {
  const text = String(fragment ?? "").replace(/^[#?]/, "");
  const params = new URLSearchParams(text);
  const playbook = params.get("playbook");
  const meeting = Number(params.get("meeting"));
  const grade = Number(params.get("grade"));
  const option = params.get("option");
  const result = { playbook: null, meeting: null, grade: null, option: null };
  if (!getPlaybook(playbook)) return result;
  result.playbook = playbook;
  if (Number.isInteger(meeting) && getMeeting(playbook, meeting)) result.meeting = meeting;
  if (grade === 5 || grade === 6) result.grade = grade;
  if (option === "on-track") result.option = option;
  return result;
}

export function buildStudentLink({ playbook, meeting = null, grade = null, option = null } = {}, base = "student.html") {
  const parsed = parseStudentLink(new URLSearchParams(Object.entries({ playbook, meeting, grade, option }).filter(([, value]) => value !== null && value !== undefined)).toString());
  if (!parsed.playbook) return base;
  const params = new URLSearchParams();
  for (const key of LINK_KEYS) if (parsed[key] !== null) params.set(key, String(parsed[key]));
  return `${base}?${params.toString()}`;
}

// "Playbook A meeting 10" for a lesson, preferring this year's playbook.
export function playbookPlaceLabel(ref) {
  for (const playbook of PLAYBOOKS) {
    const found = listMeetings(playbook.id).find(meeting => Object.values(meeting.paths).includes(ref));
    if (found) return `${playbook.name} meeting ${found.number}`;
  }
  return "";
}

export function lessonMetaKeys() { return Object.keys(LESSON_META); }
