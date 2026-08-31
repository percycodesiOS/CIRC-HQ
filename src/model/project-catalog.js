const ENGINEERING_STANDARDS = Object.freeze({
  grade5: Object.freeze([
    "PA STEELS Grades 3-5 | 3.5.3-5.M",
    "PA STEELS Grades 3-5 | 3.5.3-5.P",
    "PA STEELS Grades 3-5 | 3.5.3-5.R",
    "PA STEELS Grades 3-5 | 3.5.3-5.U"
  ]),
  grade6: Object.freeze([
    "PA STEELS Grades 6-8 | 3.5.6-8.W (ETS)",
    "PA STEELS Grades 6-8 | 3.5.6-8.P (ETS)",
    "PA STEELS Grades 6-8 | 3.5.6-8.N (ETS)",
    "PA STEELS Grades 6-8 | 3.5.6-8.M (ETS)"
  ])
});

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getIndependencePath(number) {
  if (!Number.isInteger(number) || number < 1 || number > 36) return null;
  if (number <= 2) return "Watch me";
  if (number <= 8) return "Guided Crew";
  if (number <= 16) return "Shared Crew";
  if (number <= 27) return "Team Run";
  return "Student Studio";
}

function createProject(project) {
  return Object.freeze({
    ...project,
    id: `${String(project.number).padStart(2, "0")}-${slugify(project.title)}`,
    fastFinish: Object.freeze({ ...project.fastFinish }),
    teacherSay: Object.freeze([...project.teacherSay]),
    teacherDo: Object.freeze([...project.teacherDo]),
    studentSteps: Object.freeze([...project.studentSteps]),
    materials: Object.freeze([...project.materials]),
    independence: getIndependencePath(project.number),
    admin: Object.freeze({
      duration: project.duration ?? "35 minutes",
      grades: Object.freeze([5, 6]),
      corePlan: "Same core plan for grades 5 and 6",
      standardsTitle: "Pennsylvania STEELS crosswalk",
      standards: ENGINEERING_STANDARDS
    })
  });
}

const PROJECT_BLUEPRINTS = [
  {
    number: 1,
    title: "Meet the CIRC Teacher and the Outdoor Classroom",
    strapline: "Know the teacher. Explore the spaces.",
    objective: "Build classroom trust, learn the CIRC routines, and discover how the indoor studio and outdoor classroom can support making, nature, and teamwork.",
    teacherSay: [
      "Before we build anything, you need to know what kind of room this is and what you can expect from me.",
      "I have two rules: Trust and Respect.",
      "Trust means I can trust you with people, tools, time, and spaces. It also means you can expect me to be clear, fair, and honest with you.",
      "Respect means we protect people, ideas, materials, and the places where we learn."
    ],
    teacherDo: [
      "Open only teacher-approved story cards and explain how each story connects to Trust, Respect, CIRC, or learning outside.",
      "Model the entry, movement, safety, materials, and cleanup routines before leaving the room.",
      "Lead an outdoor classroom tour using notice and wonder prompts, then return for a quick debrief."
    ],
    studentSteps: [
      "Listen for the two rules: Trust and Respect.",
      "Notice what each teacher-approved story shows about the teacher or CIRC.",
      "Tour the indoor studio and outdoor classroom within the stated boundaries.",
      "Record three useful details and one place that could become better for learning.",
      "Sketch one future possibility, practice the reset routine, and leave the exit evidence."
    ],
    materials: ["Teacher introduction objects or images", "Clipboards", "Paper", "Pencils", "Routine signs", "Outdoor classroom map cards"],
    fastFinish: {
      title: "Outdoor Classroom Scout",
      directions: "Create a simple symbol map that helps another student find three useful outdoor learning zones."
    },
    stretch: "Rank one possible outdoor improvement by usefulness, effort, and materials, then explain the tradeoff.",
    safety: "Stay inside the announced indoor and outdoor boundaries, walk with the group, and do not disturb plants, animals, tools, or stored materials.",
    cleanup: "Return clipboards and supplies, clear the floor and tables, and complete the same reset route students will use all year.",
    exitEvidence: "Share one thing learned about the teacher or CIRC, one outdoor observation, and one future possibility."
  },
  {
    number: 2,
    title: "Tech Terrarium",
    strapline: "Build it. Test it. Leave your mark.",
    objective: "Collect, prepare, and assemble the base and shared layout for a whole-class technology terrarium.",
    teacherSay: [
      "Today the class turns ordinary outdoor materials into one shared build.",
      "Every rock needs to be clean, every layer needs a purpose, and every choice needs room for the next team."
    ],
    teacherDo: [
      "Review outdoor collection boundaries and show which rocks and loose natural materials are safe to collect.",
      "Model washing and drying one rock, then demonstrate the base layers and the empty shared layout.",
      "Assign collection, wash, base, and layout jobs so every student contributes without crowding the terrarium.",
      "Pause before final placement for a whole-class check of spacing, stability, plant room, and shared ownership."
    ],
    studentSteps: [
      "Collect only teacher-approved rocks and loose materials from the announced outdoor area.",
      "Wash the rocks, rinse away loose soil, and place them on a towel to dry.",
      "Help prepare the terrarium base and sketch one possible whole-class layout.",
      "Dry fit the shared layout, check space for plants and future technology, then revise it with class approval.",
      "Assemble the approved layout and record one contribution the class should preserve."
    ],
    materials: ["Teacher-approved collected rocks", "Wash tubs", "Water", "Towels", "Terrarium container", "Prepared base materials", "Plant-safe decorations", "Paper", "Pencils", "Team cards", "Materials picture", "Mode cards", "Job-area signs", "Team trays"],
    fastFinish: {
      title: "Designer's Challenge",
      directions: "Sketch one removable cardboard sign, sensor, light, or story feature that could be added later without crowding the terrarium."
    },
    stretch: "Add a labeled input-output diagram for a future electronic feature.",
    safety: "Collect only loose teacher-approved materials. Do not disturb plants, habitats, insects, sharp objects, or unknown materials. Walk while carrying rocks and keep water on the wash station.",
    cleanup: "Return unused outdoor materials where directed, empty wash tubs, dry the floor and tables, fold towels, and leave the terrarium area clear.",
    exitEvidence: "Name one contribution to the shared terrarium and one class decision that made the final layout safer or more useful."
  },
  {
    number: 3,
    title: "Outdoor Classroom Redesign",
    strapline: "See it. Map it. Improve it.",
    objective: "Survey the existing outdoor classroom and design one realistic improvement for learning, accessibility, organization, shade, seating, or habitat.",
    teacherSay: [
      "Good redesign begins with what the space already does well and what gets in the way.",
      "A useful idea names the user, the need, the location, and how it could actually work."
    ],
    teacherDo: [
      "Revisit the outdoor boundaries and model observing a space without disturbing it.",
      "Assign teams one zone to survey and demonstrate a labeled top-view redesign sketch.",
      "Run a short gallery pitch so teams can test whether their need, location, and idea are clear."
    ],
    studentSteps: [
      "Choose one outdoor zone and record what already works and what creates a problem.",
      "Identify the user and need, then take safe approximate measurements of the available space.",
      "Draw and label a realistic redesign and build a small paper or cardboard model of its key feature.",
      "Pitch the idea, collect one question, and revise the plan so another person can understand it."
    ],
    materials: ["Clipboards", "Site maps", "Grid paper", "Pencils", "Rulers", "Tape measures", "Cardboard", "Tape", "Markers"],
    fastFinish: {
      title: "One Better Detail",
      directions: "Add one sign, storage, seating, shade, or habitat detail and make a short materials list for it."
    },
    stretch: "Add weather, maintenance, and accessibility constraints, then revise the design to address the hardest one.",
    safety: "Stay inside outdoor boundaries, use measuring tools only as demonstrated, and do not climb, lift, dig, or disturb plants and animals.",
    cleanup: "Return measuring tools and clipboards, sort model scraps, and leave the surveyed outdoor zone unchanged.",
    exitEvidence: "Show the current-space evidence, identify the user need, and explain how the redesign improves that exact location."
  },
  {
    number: 4,
    title: "Cardboard Connections Lab",
    strapline: "Cut less. Connect smarter.",
    objective: "Practice folds, tabs, slots, flanges, braces, and gussets, then combine them in a small freestanding cardboard build.",
    teacherSay: [
      "Cardboard becomes a building system when the connections have a job.",
      "Today is a skills lab, so strong experiments matter more than a giant finished product."
    ],
    teacherDo: [
      "Demonstrate a fold, tab, slot, flange, brace, and gusset with labeled samples.",
      "Model scoring a fold with a capped marker and cutting only on the table.",
      "Run a quick connection check before teams combine their best methods in one small build."
    ],
    studentSteps: [
      "Make and label at least three different cardboard connection samples.",
      "Test each sample with a gentle pull, push, or bend and choose the strongest two.",
      "Use those two connection methods in a small freestanding structure or useful holder.",
      "Show another team how one connection works without taking the build apart."
    ],
    materials: ["Corrugated cardboard", "Thin cardboard", "Scissors", "Capped markers for scoring", "Masking tape", "Index cards", "Connection sample cards"],
    fastFinish: {
      title: "Tape-Free Joint",
      directions: "Create one connection that can be assembled, taken apart, and rebuilt without tape."
    },
    stretch: "Create a connection card with a labeled diagram, purpose, and one limitation for the class reference set.",
    safety: "Cut only on the table, carry scissors closed, use capped markers for scoring, and keep fingers out of the cutting path.",
    cleanup: "Sort large reusable cardboard pieces, recycle clean scraps, cap markers, and return scissors by count.",
    exitEvidence: "Show two different connection methods and explain which force each one handles best."
  },
  {
    number: 5,
    title: "Paper Bridge",
    strapline: "Make a flat sheet carry a load.",
    objective: "Transform paper into a bridge that spans a gap and carries increasing loads.",
    teacherSay: [
      "The material stays the same, but its shape can completely change its strength.",
      "A fair test changes the load while keeping the span and setup the same."
    ],
    teacherDo: [
      "Compare a flat strip, folded beam, and rolled beam across the same gap.",
      "Model adding load one unit at a time at the center.",
      "Stop tests before falling weights create a hazard."
    ],
    studentSteps: [
      "Choose a beam or deck shape and predict where it may bend.",
      "Build a paper bridge across the fixed span.",
      "Add load one unit at a time and record the maximum supported.",
      "Rebuild one part and repeat the same test."
    ],
    materials: ["Copy paper", "Index cards", "Tape", "Two support blocks", "Uniform load pieces", "Recording sheet"],
    fastFinish: {
      title: "Efficiency Engineer",
      directions: "Remove one piece of material while keeping the bridge able to hold its target load."
    },
    stretch: "Graph load against deflection and identify the point where the bridge begins to fail.",
    safety: "Use only the provided loads and keep hands and feet clear beneath the test span.",
    cleanup: "Stack reusable supports and load pieces, then place paper and tape scraps in the correct bins.",
    exitEvidence: "Report the maximum load and explain how one shape helped carry it."
  },
  {
    number: 6,
    title: "Outdoor Microclimate Map",
    strapline: "Find the hot, cool, calm, and windy spots.",
    objective: "Compare conditions across outdoor classroom zones and recommend where different learning activities should happen.",
    teacherSay: [
      "One outdoor classroom can contain several tiny climates at the same time.",
      "A useful map combines measurement, observation, and a recommendation for a real activity."
    ],
    teacherDo: [
      "Mark the approved outdoor zones and model one sun, shade, wind, surface, and comfort observation.",
      "Assign each team two zones and demonstrate safe thermometer or wind-ribbon use when those tools are available.",
      "Provide indoor data cards if weather or air quality prevents outdoor work."
    ],
    studentSteps: [
      "Visit two assigned zones and record sun or shade, wind, surface condition, and comfort.",
      "Take one temperature or moisture reading when the approved tool is available.",
      "Add both zones to the shared microclimate map using the class key.",
      "Recommend the best zone for one activity and support the choice with two observations."
    ],
    materials: ["Clipboards", "Outdoor zone map", "Pencils", "Thermometers if available", "Wind ribbons", "Observation key", "Indoor weather data cards"],
    fastFinish: {
      title: "Weather Shift",
      directions: "Predict which mapped zone would change most after rain, strong wind, or a very sunny afternoon."
    },
    stretch: "Design a simple one-week observation plan that could test whether the recommendation stays true.",
    safety: "Stay inside the announced boundaries, walk between zones, do not touch unknown plants or animals, and use tools only as demonstrated.",
    cleanup: "Return clipboards and tools by count, remove all wind ribbons, and leave every outdoor zone unchanged.",
    exitEvidence: "Point to two mapped zones and defend one activity recommendation with evidence."
  },
  {
    number: 7,
    title: "Seed Travelers",
    strapline: "Move like a seed.",
    objective: "Investigate seed-dispersal strategies and build a model seed that travels by wind, drop, float, or hitchhiking simulation.",
    teacherSay: [
      "Plants cannot walk, but their seeds use shape, air, water, animals, and gravity to move.",
      "A model is successful when its structure matches the travel strategy being tested."
    ],
    teacherDo: [
      "Show teacher-provided seed samples or image cards without collecting from living plants.",
      "Model matching one seed feature to one travel strategy.",
      "Set wind, drop, float-tray, and fabric hitchhiker test stations with clear boundaries."
    ],
    studentSteps: [
      "Examine seed samples or cards and sort them by likely travel strategy.",
      "Choose wind, drop, float, or hitchhiking and sketch a model seed for that test.",
      "Build the model, run three trials at the matching station, and record the result.",
      "Change one structural feature and repeat the same test."
    ],
    materials: ["Teacher-provided seed samples or image cards", "Paper", "Coffee filters", "Cotton", "Yarn", "Paper clips", "Tape", "Fan", "Water tray", "Fabric test strip"],
    fastFinish: {
      title: "New Habitat",
      directions: "Draw the habitat where the model seed would have the best chance to travel and begin growing."
    },
    stretch: "Compare two dispersal strategies and argue which one works better under a stated environmental condition.",
    safety: "Use only teacher-provided samples, do not taste any material, keep water at the wet station, and release models only into the marked test area.",
    cleanup: "Dry the float station, return samples and image cards, collect model pieces, and sort reusable materials.",
    exitEvidence: "Name the travel strategy, show the trial evidence, and explain how one model feature supported movement."
  },
  {
    number: 8,
    title: "Crash Lander",
    strapline: "Protect the payload.",
    objective: "Design a landing system that reduces impact on a fragile payload during a controlled drop.",
    teacherSay: [
      "The fall may be unavoidable, but the way force reaches the payload can be redesigned.",
      "A fair crash test uses the same payload, height, and release method."
    ],
    teacherDo: [
      "Model crumple zones, padding, and load distribution with a sample capsule.",
      "Set one controlled drop zone and release height.",
      "Inspect each design before approving a test."
    ],
    studentSteps: [
      "Identify where the payload needs support and where the design can deform.",
      "Build a capsule within the material limit.",
      "Predict the likely failure point and run the controlled drop.",
      "Inspect evidence, revise one feature, and retest."
    ],
    materials: ["Small payload containers", "Paper", "Cardboard", "Straws", "Tape", "Cotton", "Reusable test payloads", "Drop-zone team cards"],
    fastFinish: {
      title: "Mass Limit",
      directions: "Reduce the capsule's material while keeping the payload protected in the same drop test."
    },
    stretch: "Compare protection score per gram of capsule mass and optimize for efficiency.",
    safety: "Only the teacher releases from raised heights. Everyone stays behind the drop-zone boundary.",
    cleanup: "Recover all capsule pieces and payloads before the next drop team enters the zone.",
    exitEvidence: "Point to the impact evidence and explain how the revision changed the force path."
  },
  {
    number: 9,
    title: "Paper Circuit Signal",
    strapline: "Close the path. Light the message.",
    objective: "Build a safe paper circuit that uses one LED to communicate a clear signal or message.",
    teacherSay: [
      "A circuit works only when electricity has a complete path from one battery side and back to the other.",
      "The light is not decoration today. It must communicate something to a user."
    ],
    teacherDo: [
      "Demonstrate LED polarity, a copper-tape path, and the switched 2xAA battery holder.",
      "Show the safe response to a warm battery, short circuit, torn tape, or unlit LED.",
      "Approve the paper plan before distributing battery holders."
    ],
    studentSteps: [
      "Choose a signal such as ready, stop, welcome, warning, or success and sketch the circuit path.",
      "Place copper tape with smooth corners and insert the LED with the correct polarity.",
      "Connect the switched battery holder, turn it on, and troubleshoot the first failure point.",
      "Finish the message only after the light works three times."
    ],
    materials: ["Cardstock", "Copper tape", "LEDs", "Switched 2xAA battery holders", "AA batteries", "Clear tape", "Pencils", "Circuit planning cards"],
    fastFinish: {
      title: "Switch Upgrade",
      directions: "Design a paper press switch that turns the signal on only when a user intentionally activates it."
    },
    stretch: "Add a second LED in a teacher-approved layout and predict how the circuit behavior may change.",
    safety: "Never connect the battery leads directly. Switch off and report any warm holder immediately. Keep batteries inside the holder and return every holder by count.",
    cleanup: "Switch off and count battery holders first, sort working LEDs, press loose copper-tape ends flat, and store finished circuits without batteries connected.",
    exitEvidence: "Demonstrate the signal three times and identify the exact path electricity follows."
  },
  {
    number: 10,
    title: "Cardboard Arcade",
    strapline: "Build a game worth replaying.",
    objective: "Build a small tabletop cardboard skill game with one clear goal, a reliable mechanism, and a fast reset.",
    teacherSay: [
      "A fun game is a system: the player understands the goal, the mechanism behaves predictably, and the next player can reset it.",
      "Start with one playable action, not a giant theme."
    ],
    teacherDo: [
      "Show compact examples such as a marble maze, spinner target, ring challenge, ramp, or contained token drop.",
      "Model a start state, player action, scoring rule, and ten-second reset.",
      "Stop teams after the first playable version for a partner test before decoration."
    ],
    studentSteps: [
      "Choose one tabletop game type and write the goal in one sentence.",
      "Build the smallest playable version using cardboard connections from the skills lab.",
      "Ask a partner to play without coaching and record the first confusing or unreliable part.",
      "Revise the game, add a simple score or success signal, and prove it resets quickly."
    ],
    materials: ["Cardboard", "Paper cups", "Craft sticks", "Paper fasteners", "String", "Tape", "Markers", "Marbles or contained game tokens", "Score cards", "Tabletop game cards", "Play trays"],
    fastFinish: {
      title: "Level Two",
      directions: "Add one optional rule that makes the same game more challenging without rebuilding it."
    },
    stretch: "Collect results from five plays and adjust the scoring so the game is challenging but achievable.",
    safety: "Keep every moving token inside the tabletop play area, use no launchers, and stop any mechanism that pinches or sends parts toward people.",
    cleanup: "Return shared tokens and tools by count, label stored games, recycle loose scraps, and leave every game in its reset position.",
    exitEvidence: "Let a partner play, show the ten-second reset, and name the revision that improved the experience."
  },
  {
    number: 11,
    title: "Hull Design",
    strapline: "Float more with less.",
    objective: "Shape a foil hull that stays stable while carrying the greatest tested payload.",
    teacherSay: [
      "The hull must push aside enough water to support itself and its cargo.",
      "Capacity is useful only when the boat stays balanced."
    ],
    teacherDo: [
      "Compare a flat foil sheet with a sealed basin shape.",
      "Model adding identical cargo pieces one at a time.",
      "Set towel stations and a clear wet-material boundary."
    ],
    studentSteps: [
      "Sketch a wide, sealed hull and predict its weak points.",
      "Shape one foil sheet without adding material.",
      "Float the hull and add cargo evenly until failure.",
      "Reshape the hull and repeat the test with the same cargo pieces."
    ],
    materials: ["Aluminum foil sheets", "Water tubs", "Uniform cargo pieces", "Towels", "Recording sheet"],
    fastFinish: {
      title: "Cargo Deck",
      directions: "Create a removable paper loading guide that helps another team balance cargo evenly."
    },
    stretch: "Calculate cargo capacity per square centimeter of starting foil.",
    safety: "Keep water inside tubs, wipe spills immediately, and keep electronics out of the wet zone.",
    cleanup: "Dry cargo pieces and tables, empty tubs only at the assigned sink, and recycle clean foil when possible.",
    exitEvidence: "Record the best cargo count and explain how hull shape affected stability."
  },
  {
    number: 12,
    title: "Cardboard Micro-Furniture",
    strapline: "Design small for a real user.",
    objective: "Build a miniature cardboard model of seating, storage, a work surface, or a quiet-space feature for a specific classroom user.",
    teacherSay: [
      "Furniture is not just a shape. It must fit a person, a task, and a place.",
      "A small model lets designers test arrangement, stability, and access before using full-size materials."
    ],
    teacherDo: [
      "Present user cards for seating, storage, work-surface, and quiet-space needs.",
      "Model measuring the intended location and labeling a miniature top, side, or opening dimension.",
      "Demonstrate a stability and access check using a paper user figure."
    ],
    studentSteps: [
      "Choose one user card and one realistic indoor or outdoor classroom location.",
      "Sketch the furniture feature and label how the user reaches, sits, stores, or works with it.",
      "Build the miniature cardboard model using at least two connection methods.",
      "Test stability and access with the paper user figure, then revise one barrier."
    ],
    materials: ["Cardboard", "Paper user figures", "User cards", "Rulers", "Scissors", "Tape", "Paper fasteners", "Grid paper", "Markers"],
    fastFinish: {
      title: "Second User",
      directions: "Add one small change that makes the feature easier for a second user with a different reach or movement need."
    },
    stretch: "Create a labeled scale statement and check whether every major model dimension follows it consistently.",
    safety: "Cut only on the table, use fasteners as demonstrated, and keep models small enough to test safely at the workspace.",
    cleanup: "Label models selected for review, flatten reusable cardboard, recycle clean scraps, and return tools by count.",
    exitEvidence: "Name the user, location, and barrier, then demonstrate how the revised model improves access or function."
  },
  {
    number: 13,
    title: "Rube Machine",
    strapline: "Make one action trigger the next.",
    objective: "Build a reliable chain reaction in which at least three distinct steps complete one simple task.",
    teacherSay: [
      "Complex systems succeed one dependable connection at a time.",
      "The goal is not extra chaos. The goal is a clear chain that another team can explain."
    ],
    teacherDo: [
      "Model two safe cause-and-effect connections.",
      "Show how to isolate and test one step before joining the whole machine.",
      "Set boundaries for rolling objects and moving parts."
    ],
    studentSteps: [
      "Define the final simple task and sketch at least three steps backward from it.",
      "Build and test each step separately.",
      "Connect the steps and mark the first unreliable handoff.",
      "Revise until the full chain succeeds twice in a row."
    ],
    materials: ["Dominoes", "Cardboard ramps", "Cups", "String", "Craft sticks", "Balls", "Tape", "Final-task cards"],
    fastFinish: {
      title: "One More Link",
      directions: "Add one useful step without reducing the machine's two-run reliability."
    },
    stretch: "Create a failure map that labels energy transfer at every handoff.",
    safety: "Keep moving parts inside the table boundary and use no flame, sharp projectile, or powered launcher.",
    cleanup: "Stop all motion, collect small rolling parts first, and sort components into labeled bins.",
    exitEvidence: "Demonstrate two complete runs and explain the handoff that required the most revision."
  },
  {
    number: 14,
    title: "Human Program",
    strapline: "Write directions a machine could follow.",
    objective: "Create and debug an exact sequence of commands that guides a human robot through a task.",
    teacherSay: [
      "Computers do exactly what the instructions say, not what the programmer hoped they meant.",
      "A bug is useful evidence that a command needs to be more precise."
    ],
    teacherDo: [
      "Model ambiguous and precise commands with a simple desk task.",
      "Introduce the approved move, turn, pick up, and place command set.",
      "Pause any program that would create a collision."
    ],
    studentSteps: [
      "Choose a short task and write one command per line.",
      "Ask a human robot to execute the commands literally.",
      "Mark the first command that produces the wrong result.",
      "Rewrite, rerun, and save the corrected algorithm."
    ],
    materials: ["Command cards", "Grid mats", "Safe classroom objects", "Pencils", "Clipboards", "Short-task cards"],
    fastFinish: {
      title: "Loop Finder",
      directions: "Replace a repeated command sequence with one clear repeat instruction."
    },
    stretch: "Add one condition that changes the program when an obstacle is present.",
    safety: "Human robots move at walking speed and stop immediately at any obstacle or stop command.",
    cleanup: "Reset grid objects to the starting diagram and return command cards in order.",
    exitEvidence: "Show the original bug and the exact command revision that fixed it."
  },
  {
    number: 15,
    title: "Maze Coders",
    strapline: "Plan, run, debug, repeat.",
    objective: "Write an efficient algorithm that moves a token through a grid maze without entering blocked cells.",
    teacherSay: [
      "A good route is accurate first and efficient second.",
      "Debug from the first wrong move instead of rewriting everything blindly."
    ],
    teacherDo: [
      "Model reading row and column coordinates before writing commands.",
      "Run one incorrect path and trace back to the first error.",
      "Provide mazes with a verified solution path."
    ],
    studentSteps: [
      "Mark the start, goal, blocked cells, and possible routes.",
      "Write a complete route using the approved command set.",
      "Trade with a tester who runs the program exactly.",
      "Debug and shorten the route without changing the goal."
    ],
    materials: ["Grid maze cards", "Tokens", "Command cards", "Pencils", "Transparent sleeves"],
    fastFinish: {
      title: "Shortest Safe Route",
      directions: "Find a second valid route and prove which one uses fewer commands."
    },
    stretch: "Write a reusable rule that solves a family of mazes rather than only one map.",
    safety: "Keep all work on the grid surface and keep small tokens away from mouths and floor traffic.",
    cleanup: "Count tokens, erase sleeves, and sort maze cards by level.",
    exitEvidence: "Submit the final command count and circle the command that fixed the first bug."
  },
  {
    number: 16,
    title: "Binary Beacons",
    strapline: "Send more with only two states.",
    objective: "Encode and decode a message using a documented two-state binary system.",
    teacherSay: [
      "Digital systems build complex information from simple states such as on and off.",
      "A code is useful only when sender and receiver share the same key."
    ],
    teacherDo: [
      "Model representing small numbers with place-value beacon cards.",
      "Demonstrate how one missing bit changes a decoded result.",
      "Require teams to exchange a key before transmitting."
    ],
    studentSteps: [
      "Choose two clear states and build a key for letters or numbers.",
      "Encode a short classroom-safe message.",
      "Transmit the states in fixed positions and have another team decode them.",
      "Compare results and correct any ambiguous or missing state."
    ],
    materials: ["Two-color cards", "Paper cups", "Flashlights used at tables", "Binary place-value mats", "Message slips"],
    fastFinish: {
      title: "Error Check",
      directions: "Add one check bit or repeated pattern that helps the receiver notice a transmission error."
    },
    stretch: "Compare the number of possible messages that can be made with four, five, and six binary positions.",
    safety: "Do not shine lights toward faces and use only classroom-safe, nonpersonal messages.",
    cleanup: "Turn off lights, stack state cards by color, and destroy temporary message slips if directed.",
    exitEvidence: "Provide the key, encoded message, decoded result, and one corrected transmission error."
  },
  {
    number: 17,
    title: "Conductivity Detectives",
    strapline: "Test the material. Find the broken path.",
    objective: "Use a protected low-voltage tester to classify conductors and insulators, then diagnose an open circuit.",
    teacherSay: [
      "A conductor can complete an electrical path, while an insulator interrupts it.",
      "Troubleshooting starts by testing one point at a time instead of replacing everything."
    ],
    teacherDo: [
      "Demonstrate the protected low-voltage tester with one known conductor and one known insulator.",
      "Model testing only teacher-provided samples and recording evidence before naming the material type.",
      "Give each team a safe open-circuit card and show how to test one connection at a time."
    ],
    studentSteps: [
      "Check the tester with the known samples and record the expected signals.",
      "Test each coded classroom sample and classify it from the evidence.",
      "Inspect the open circuit, predict one likely break, and test connections in order.",
      "Repair the confirmed break and demonstrate the working circuit without changing other parts."
    ],
    materials: ["Protected low-voltage conductivity testers", "Teacher-provided coded samples", "Known conductor and insulator", "Open-circuit cards", "LEDs", "Battery holders", "Data table"],
    fastFinish: {
      title: "Mystery Path",
      directions: "Create a safe two-connection fault for another team and write the evidence that reveals each break."
    },
    stretch: "Rank borderline materials by tester response and propose a more precise follow-up test without using higher voltage.",
    safety: "Use only teacher-provided low-voltage equipment, never test outlets, liquids, devices, jewelry, or people, and remove any warm battery immediately.",
    cleanup: "Disconnect and count batteries first, return coded samples by label, and reset every fault card to its starting condition.",
    exitEvidence: "Show one conductor, one insulator, and the exact tested connection that repaired the open circuit."
  },
  {
    number: 18,
    title: "Moving Picture Machine",
    strapline: "Turn still images into motion.",
    objective: "Create a sequence device that uses small image changes to produce the illusion of motion.",
    teacherSay: [
      "Motion can emerge when the brain sees a rapid sequence of slightly different images.",
      "Consistent alignment makes each change easier to see."
    ],
    teacherDo: [
      "Model a two-frame flip image and a multi-frame sequence.",
      "Show registration marks that keep frames aligned.",
      "Demonstrate a safe spinning or flipping motion."
    ],
    studentSteps: [
      "Plan one simple movement with a clear start and finish.",
      "Draw frames with small, consistent changes and matching registration.",
      "Assemble the flip, wheel, or strip mechanism.",
      "Test at different speeds and revise any jump in the motion."
    ],
    materials: ["Index cards", "Paper strips", "Cardstock circles", "Pencils", "Markers", "Brass fasteners", "Binder clips"],
    fastFinish: {
      title: "Smooth Loop",
      directions: "Add transition frames so the final image flows naturally back to the first."
    },
    stretch: "Use timing marks to compare how playback speed changes the perceived motion.",
    safety: "Keep spinning devices at table level and handle fasteners only as demonstrated.",
    cleanup: "Cap markers, collect fasteners, and store finished sequences flat.",
    exitEvidence: "Run the animation and identify one frame changed to make the motion smoother."
  },
  {
    number: 19,
    title: "Cargo Sorter",
    strapline: "Move the right item to the right place.",
    objective: "Design a mechanical sorting system that routes model cargo by one measurable property.",
    teacherSay: [
      "A sorter needs a clear input, a decision, and an output for every item.",
      "If cargo gets stuck, that is evidence about the geometry of the system."
    ],
    teacherDo: [
      "Model a ramp gate that separates objects by size.",
      "Demonstrate feeding one item at a time from the same start point.",
      "Set a target for both accuracy and jam-free operation."
    ],
    studentSteps: [
      "Choose size, shape, mass, or magnetic response as the sorting property.",
      "Sketch the input path, decision feature, and output bins.",
      "Build and test a mixed batch one item at a time.",
      "Record errors, revise the decision feature, and rerun the full batch."
    ],
    materials: ["Mixed model cargo", "Cardboard", "Ramps", "Cups", "Craft sticks", "Tape", "Optional magnets"],
    fastFinish: {
      title: "Third Destination",
      directions: "Add a third output without reducing the accuracy of the original two groups."
    },
    stretch: "Calculate sorting accuracy and average items processed before a jam.",
    safety: "Keep magnets away from personal electronics and feed cargo without putting fingers inside a moving path.",
    cleanup: "Recount each cargo type, return magnets separately, and flatten reusable ramp materials.",
    exitEvidence: "Report batch accuracy and show the revision that prevented the most common error."
  },
  {
    number: 20,
    title: "Black Box Systems",
    strapline: "Infer what happens inside.",
    objective: "Use controlled input-output tests to build and defend a model of a hidden system.",
    teacherSay: [
      "Scientists and engineers often cannot see every part, so they use patterns in evidence.",
      "A model is a best explanation that can change when new evidence appears."
    ],
    teacherDo: [
      "Demonstrate changing one input while recording the output.",
      "Model two competing explanations for the same first result.",
      "Keep sealed boxes closed so evidence comes only from allowed tests."
    ],
    studentSteps: [
      "List safe inputs the team can vary without opening the box.",
      "Run controlled tests and record each matching output.",
      "Draw a model that explains all current evidence.",
      "Run one new test that could disprove the model and revise if needed."
    ],
    materials: ["Teacher-prepared sealed systems", "Input pieces", "Measuring tools", "Data table", "Modeling paper"],
    fastFinish: {
      title: "Competing Model",
      directions: "Draw a different internal system that could produce the same evidence, then design a test that separates the two."
    },
    stretch: "Rank each claim as certain, supported, possible, or unsupported and cite the matching test.",
    safety: "Do not pry, shake forcefully, or place any object into an opening not approved for testing.",
    cleanup: "Return each sealed system with its complete input set and submit data separately.",
    exitEvidence: "Present the model, one supporting result, and one remaining uncertainty."
  },
  {
    number: 21,
    title: "Error-Proof Messages",
    strapline: "Make information survive noise.",
    objective: "Create a communication system that lets a receiver detect or correct a changed message.",
    teacherSay: [
      "Real messages can be lost, smudged, or changed on the way.",
      "Redundancy uses extra information so an error does not stay invisible."
    ],
    teacherDo: [
      "Model a short message with and without a simple check rule.",
      "Change one symbol in transit and compare receiver confidence.",
      "Keep challenge messages classroom-safe and anonymous."
    ],
    studentSteps: [
      "Choose a short symbol message and define the normal encoding rule.",
      "Add a repeat, checksum, parity, or pattern check.",
      "Trade with a channel team that changes or hides one part.",
      "Decode, detect the error, and revise the system if detection fails."
    ],
    materials: ["Symbol cards", "Message strips", "Envelopes", "Check-rule cards", "Pencils"],
    fastFinish: {
      title: "Repair Mode",
      directions: "Improve the system so the receiver can correct one missing symbol, not only notice it."
    },
    stretch: "Compare reliability and message length for two different error-checking strategies.",
    safety: "Use no personal, insulting, or secret information in transmitted messages.",
    cleanup: "Return reusable code cards and recycle or destroy temporary message strips as directed.",
    exitEvidence: "Show the altered message and explain exactly how the receiver detected or corrected it."
  },
  {
    number: 22,
    title: "Accessibility Design Sprint",
    strapline: "Remove one barrier on a short clock.",
    objective: "Design and test a small prototype that reduces a specific barrier involving reach, grip, vision, hearing, movement, or attention.",
    teacherSay: [
      "Accessibility design starts with a person's goal and the barrier created by the environment or tool.",
      "The sprint clock keeps the team focused on access, testing, and revision instead of decoration."
    ],
    teacherDo: [
      "Present respectful user cards for one-handed use, limited reach, reduced grip, low vision, or noisy surroundings.",
      "Model turning a user goal and barrier into one measurable access test.",
      "Time-box ask, imagine, plan, create, test, and improve, then model a one-minute feedback interview."
    ],
    studentSteps: [
      "Choose a user card and restate the person's goal without defining the person by the barrier.",
      "Name the environmental or tool barrier, generate three ideas, and select one with a reason.",
      "Build the smallest prototype that can answer one access test question.",
      "Collect feedback, revise one feature, and explain what became easier and what remains difficult."
    ],
    materials: ["Accessibility user cards", "Paper", "Cardboard", "Tape", "Craft materials", "Large-print labels", "Feedback cards", "Timer", "Scissors", "Access-test cards"],
    fastFinish: {
      title: "Second User",
      directions: "Test with a different user and identify one need the first test did not reveal."
    },
    stretch: "Create a decision matrix comparing access, independence, comfort, and material use across three ideas.",
    safety: "Simulate barriers only through the provided user card. Never restrain, blindfold, label, or imitate a disability, and stop any unsafe user test.",
    cleanup: "Label the prototype, return unused materials, and save only the evidence needed for the pitch.",
    exitEvidence: "Deliver a 30-second pitch that names the user goal, barrier, access test, result, and revision."
  },
  {
    number: 23,
    title: "Helping Hand",
    strapline: "Extend reach with thoughtful control.",
    objective: "Build a hand-operated tool that safely grips and moves an object beyond normal reach.",
    teacherSay: [
      "Assistive design begins with what a person wants to do, not with assumptions about the person.",
      "A useful gripper balances reach, control, force, and comfort."
    ],
    teacherDo: [
      "Model respectful need-first language and a simple linkage gripper.",
      "Demonstrate testing with lightweight objects only.",
      "Check every moving joint and handle before use.",
      "Assign the plan, parts, build, test, fix, and record role cards before work starts."
    ],
    studentSteps: [
      "Define the object, distance, and safe success criteria.",
      "Sketch a handle, linkage, and gripping surface.",
      "Build and test with one lightweight object.",
      "Improve control or comfort, then test a small set of objects."
    ],
    materials: ["Cardboard", "Craft sticks", "String", "Rubber bands", "Brass fasteners", "Foam pads", "Lightweight test objects", "Scissors", "Role cards", "Build-lead marker", "Test stand"],
    fastFinish: {
      title: "Gentle Grip",
      directions: "Modify the gripper to move a paper cup without crushing or dropping it."
    },
    stretch: "Compare grip success across objects with different shapes and surfaces.",
    safety: "Grip only approved lightweight objects and keep the device away from faces, bodies, and breakable items.",
    cleanup: "Release tension, collect fasteners, and store test objects in their marked locations.",
    exitEvidence: "Demonstrate one successful move and explain how the design serves the stated need."
  },
  {
    number: 24,
    title: "Package Rescue",
    strapline: "Protect what matters in transit.",
    objective: "Design minimal packaging that protects a model product through a repeatable handling test.",
    teacherSay: [
      "Packaging must protect the product without creating unnecessary waste.",
      "Design for the actual hazards of the journey, not every imaginary problem."
    ],
    teacherDo: [
      "Show compression, drop, and vibration as separate transit hazards.",
      "Model a controlled handling sequence and damage scoring guide.",
      "Set a material or mass limit before teams begin."
    ],
    studentSteps: [
      "Inspect the product and choose the most likely transit hazard.",
      "Sketch protection zones and build within the material limit.",
      "Run the approved handling sequence and score product condition.",
      "Reduce damage or material use, then repeat the same sequence."
    ],
    materials: ["Model products", "Small boxes", "Paper", "Cardboard", "String", "Tape", "Mass scale", "Damage rubric", "Scissors", "Handling-test cards"],
    fastFinish: {
      title: "Unboxing Upgrade",
      directions: "Make the package easier to open and reuse without reducing protection."
    },
    stretch: "Calculate protection score per gram of packaging and improve the ratio.",
    safety: "Use only teacher-approved handling tests and never throw packages toward people or equipment.",
    cleanup: "Recover model products first, then sort reusable packaging from recycling and waste.",
    exitEvidence: "Submit the before-and-after damage score and name the material change that improved it."
  },
  {
    number: 25,
    title: "Upcycle Lab",
    strapline: "Give a discarded object a better job.",
    objective: "Transform a clean discarded item into a useful prototype with a clearly defined user and function.",
    teacherSay: [
      "Upcycling adds usefulness, not just decoration.",
      "Start with the user's need, then use the object's existing strengths."
    ],
    teacherDo: [
      "Inspect and approve all reclaimed materials before distribution.",
      "Model identifying an object's useful shape, strength, or connection.",
      "Demonstrate a reversible prototype connection before permanent work."
    ],
    studentSteps: [
      "Choose an approved item and list two properties worth reusing.",
      "Define a user and one specific new function.",
      "Sketch, build, and test the new function.",
      "Improve usefulness and prepare a before-and-after explanation."
    ],
    materials: ["Clean reclaimed objects", "Cardboard", "Tape", "String", "Fasteners", "Markers", "Safety scissors"],
    fastFinish: {
      title: "Second Life Label",
      directions: "Create a simple label showing the old purpose, new purpose, and materials kept out of waste."
    },
    stretch: "Redesign one connection so the prototype can be disassembled and repaired.",
    safety: "Use only inspected clean items with no sharp edges, residue, glass, batteries, or unknown contents.",
    cleanup: "Return unused reclaimed items by material type and place true waste in the correct container.",
    exitEvidence: "Demonstrate the new function and explain why it is more than decoration."
  },
  {
    number: 26,
    title: "Hydroponics Flow Lab",
    strapline: "Move water where roots need it.",
    objective: "Model a gravity-fed hydroponic path that distributes water evenly without leaking or flooding.",
    teacherSay: [
      "Plants need access to water and air, so more water is not automatically better.",
      "A good flow model makes distribution visible and measurable."
    ],
    teacherDo: [
      "Model a dry layout before adding any water.",
      "Demonstrate a measured pour and leak check at every connection.",
      "Keep all water testing inside the protected wet zone."
    ],
    studentSteps: [
      "Sketch the reservoir, path, plant sites, and collection point.",
      "Build the dry model and inspect every connection.",
      "Add a fixed amount of water and measure distribution or collection.",
      "Change one slope, opening, or seal and repeat the test."
    ],
    materials: ["Clean tubing", "Cups", "Reclaimed channels", "Water trays", "Measuring cups", "Towels", "Plant-site models", "Teacher-controlled tubing cutter", "Wet mats", "Sink bucket"],
    fastFinish: {
      title: "Flow Alarm",
      directions: "Design a visible marker that shows when one plant site receives too much or too little water."
    },
    stretch: "Calculate the percent of starting water recovered and identify where losses occur.",
    safety: "Keep water away from outlets and electronics, wipe spills immediately, and use no pump unless the teacher controls it.",
    cleanup: "Drain models into the assigned container, dry all surfaces, and separate wet materials for drying.",
    exitEvidence: "Show the measured flow result and explain the one change that made distribution more even."
  },
  {
    number: 27,
    title: "Stormwater Rescue",
    strapline: "Slow it. Spread it. Protect the soil.",
    objective: "Model stormwater runoff and erosion, then test one intervention that slows, redirects, absorbs, or filters the flow.",
    teacherSay: [
      "Rain becomes a design problem when water moves too quickly across a surface and carries soil with it.",
      "The goal is not drinkable water. The goal is evidence that one intervention changes runoff or erosion in the model."
    ],
    teacherDo: [
      "Set identical sloped trays and model the baseline rain test with a fixed water volume and pour time.",
      "Show how to measure runoff volume, visible soil movement, or time to collection.",
      "Demonstrate one barrier, absorbent zone, channel, or plant-root model without presenting a single correct answer."
    ],
    studentSteps: [
      "Run the baseline rain test and record runoff volume, time, and visible erosion evidence.",
      "Choose one problem location and build one intervention using the approved materials.",
      "Repeat the exact rain test and compare the before-and-after evidence.",
      "Revise the intervention or recommend where it would belong in the real outdoor classroom."
    ],
    materials: ["Sloped trays", "Model soil or sand", "Measured water cups", "Collection cups", "Gravel", "Sponge", "Craft sticks", "Mesh", "Model plants", "Towels", "Scissors", "Wet mats", "Return tub"],
    fastFinish: {
      title: "Storm Upgrade",
      directions: "Predict how the intervention would perform with twice the water and identify the first likely failure."
    },
    stretch: "Calculate the percent change in runoff volume or collection time and explain the limitation of the model.",
    safety: "Never drink test water, keep wet materials inside trays, wipe spills immediately, and wash hands after handling model soil.",
    cleanup: "Pour water only into the assigned container, return reusable media, dispose of model soil as directed, and dry the full wet zone.",
    exitEvidence: "Compare baseline and revised evidence, then state what the intervention changed and what the model cannot prove."
  },
  {
    number: 28,
    title: "Micro:bit Sensor Station",
    strapline: "Sense a condition. Trigger a useful response.",
    objective: "Program a classroom micro:bit or confirmed equivalent to detect a condition and produce a useful visual, sound, or motion alert.",
    teacherSay: [
      "A sensor turns a condition in the world into data a program can use.",
      "A useful alert has a clear threshold, a clear user, and a response that can be tested."
    ],
    teacherDo: [
      "Confirm the available micro:bit or equivalent hardware and demonstrate one input, threshold rule, and output.",
      "Provide starter code blocks for light, temperature, sound, movement, or a teacher-approved external sensor.",
      "Use device-free sensor data cards and paper code blocks as the fallback if hardware or network access is unavailable."
    ],
    studentSteps: [
      "Choose a user and condition, then write the sensor input, threshold, and intended alert.",
      "Build the program from starter blocks and test it with at least three input values.",
      "Record one false alert, missed alert, or unclear output and revise the threshold or response.",
      "Demonstrate the final station and explain where its data begins and ends."
    ],
    materials: ["Classroom micro:bits or confirmed equivalents", "USB cables", "Computers", "Teacher-approved sensors if available", "Starter code cards", "Sensor data cards", "Paper code blocks", "Test record"],
    fastFinish: {
      title: "Two-Level Alert",
      directions: "Add one warning level before the main threshold so the user can respond earlier."
    },
    stretch: "Log a short series of readings and explain whether the chosen threshold matches the observed variation.",
    safety: "Use only approved classroom hardware and USB power, connect no unknown devices, collect no names or personal sound recordings, and handle sensors by the demonstrated edges.",
    cleanup: "Stop programs, disconnect USB cables by the plug, return every device by number, and leave starter files without student names.",
    exitEvidence: "Demonstrate three input tests and explain the sensor, threshold, output, and one revision."
  },
  {
    number: 29,
    title: "Mirror Maze",
    strapline: "Guide light around a corner.",
    objective: "Arrange reflective surfaces to direct a light path through checkpoints to a target.",
    teacherSay: [
      "Light changes direction when it reflects, and the surface angle controls the new path.",
      "A good setup reaches the target without aiming light toward people."
    ],
    teacherDo: [
      "Model one safe reflection using a low-power classroom light.",
      "Show how to trace the incoming and outgoing path on paper.",
      "Approve the fixed light position before teams begin."
    ],
    studentSteps: [
      "Mark the source, checkpoints, target, and blocked zones.",
      "Predict mirror positions and draw the expected path.",
      "Place mirrors, test from the fixed source, and trace the actual path.",
      "Adjust angles until the path reaches all required checkpoints."
    ],
    materials: ["Plastic mirrors", "Low-power classroom lights", "Target cards", "Grid paper", "Mirror stands", "Pencils"],
    fastFinish: {
      title: "One Less Mirror",
      directions: "Reach the same target with fewer reflective surfaces."
    },
    stretch: "Use measured angles to predict a new mirror placement before testing.",
    safety: "Never shine any light toward eyes, reflective clothing, windows, or outside the marked table zone.",
    cleanup: "Switch off lights, handle mirrors by the edges, and return every mirror to a padded slot.",
    exitEvidence: "Trace the successful light path and explain one mirror-angle revision."
  },
  {
    number: 30,
    title: "Earthquake Platform",
    strapline: "Stay standing when the ground moves.",
    objective: "Build and improve a model structure that remains stable during a repeatable shake-table test.",
    teacherSay: [
      "Earthquake design cannot stop the ground from moving, but it can control how a structure responds.",
      "A fair comparison uses the same platform motion and structure limits."
    ],
    teacherDo: [
      "Model a low center of mass, cross bracing, and flexible connection.",
      "Demonstrate the approved shake sequence and damage rubric.",
      "Inspect structures for loose pieces before testing."
    ],
    studentSteps: [
      "Sketch a structure and identify likely weak joints.",
      "Build to the required height and footprint.",
      "Run the standard shake sequence and record movement or damage.",
      "Improve one stability feature and repeat the exact test."
    ],
    materials: ["Shake platforms", "Craft sticks", "Straws", "Cards", "Tape", "Binder clips", "Damage rubric"],
    fastFinish: {
      title: "Aftershock",
      directions: "Test whether the improved structure survives a second shake without repairs."
    },
    stretch: "Compare stability with and without one selected brace while keeping all other features constant.",
    safety: "Keep fingers outside the moving platform boundary and test only on the teacher signal.",
    cleanup: "Remove loose pieces from the platform, release clips carefully, and return shake tables to neutral.",
    exitEvidence: "Compare the two damage scores and name the structural change supported by evidence."
  },
  {
    number: 31,
    title: "Outdoor Habitat Helper",
    strapline: "Observe first. Help without harm.",
    objective: "Observe a local habitat need and design a safe, realistic helper for biodiversity, water, shelter, observation, or protective communication.",
    teacherSay: [
      "Habitat design begins with what is already living there and what should not be disturbed.",
      "A helper must support a real need without creating a new risk for plants, animals, or people."
    ],
    teacherDo: [
      "Lead a no-touch habitat observation or provide local habitat photo cards when outdoor work is unavailable.",
      "Model separating observed evidence from guesses about an organism's needs.",
      "Present approval constraints for pollinator support, runoff control, shelter models, observation stations, or protective signs."
    ],
    studentSteps: [
      "Record one habitat observation and one need supported by that evidence.",
      "Choose a helper type and identify one benefit, one risk, and one maintenance need.",
      "Build a small model or sign prototype without installing anything outdoors.",
      "Use peer feedback to revise the design and prepare a teacher-approval pitch."
    ],
    materials: ["Clipboards", "Local habitat photo cards", "Site map", "Cardboard", "Paper", "Craft sticks", "String", "Tape", "Rulers", "Approval checklist", "Scissors", "Approval tray"],
    fastFinish: {
      title: "Season Check",
      directions: "Explain how the helper may need to change in winter, spring, summer, or fall."
    },
    stretch: "Create a monitoring plan with one indicator that could show whether an approved real-world helper is beneficial.",
    safety: "Observe without touching wildlife, nests, insects, unknown plants, or droppings. No outdoor installation, food, water, digging, or attachment occurs without teacher approval.",
    cleanup: "Return observation tools, remove every model material from outdoors, and store proposals separately from approved actions.",
    exitEvidence: "Show the observation, helper, benefit, risk, and the approval needed before any real-world action."
  },
  {
    number: 32,
    title: "Biomimicry Grabber",
    strapline: "Borrow a strategy from nature.",
    objective: "Design a gripping mechanism inspired by how a plant or animal holds, hooks, wraps, or adheres.",
    teacherSay: [
      "Biomimicry copies a useful strategy, not only the way an organism looks.",
      "Name the function in nature before turning it into a design feature."
    ],
    teacherDo: [
      "Show image examples of hooks, suction, wrapping, and textured grip.",
      "Model translating one observed function into a simple mechanism.",
      "Approve lightweight test objects and movement ranges."
    ],
    studentSteps: [
      "Choose one organism strategy and describe the useful function.",
      "Sketch how that strategy could become a safe gripper.",
      "Build and test with at least three approved objects.",
      "Revise the feature while keeping the biological connection clear."
    ],
    materials: ["Nature reference cards", "Cardboard", "Craft sticks", "String", "Rubber bands", "Foam", "Lightweight test objects", "Scissors"],
    fastFinish: {
      title: "Habitat Shift",
      directions: "Adapt the gripper for an object with a different surface, shape, or location."
    },
    stretch: "Compare the design's function with the organism's actual constraints and name one important difference.",
    safety: "Use no live organism, body grip test, sharp hook, or adhesive on skin or personal property.",
    cleanup: "Return reference cards, release stretched bands, and sort test objects into their labeled set.",
    exitEvidence: "Demonstrate the grip and connect one design feature to the biological function it models."
  },
  {
    number: 33,
    title: "Mystery Materials",
    strapline: "Choose by properties, not appearance.",
    objective: "Test unknown material samples and select the best candidate for a stated design need.",
    teacherSay: [
      "A material is useful because of its properties in context.",
      "One test rarely proves everything, so choose tests connected to the actual need."
    ],
    teacherDo: [
      "Model labeling samples without naming their identities.",
      "Demonstrate safe flexibility, absorbency, and load tests.",
      "Provide criteria that require more than one property."
    ],
    studentSteps: [
      "Translate the design need into measurable material criteria.",
      "Choose and run at least two approved property tests.",
      "Record evidence for every coded sample.",
      "Select one material and defend the choice against an alternative."
    ],
    materials: ["Coded material samples", "Droppers", "Small loads", "Rulers", "Scratch-free test tools", "Data table"],
    fastFinish: {
      title: "Composite Idea",
      directions: "Combine two sample types on paper and explain how their properties could complement each other."
    },
    stretch: "Create a weighted decision matrix and test how the winner changes when priorities change.",
    safety: "Use only teacher-prepared samples and approved tests. Do not taste, burn, tear open, or identify by smell.",
    cleanup: "Dry samples, return them by code, and clean test tools without revealing identities to other teams.",
    exitEvidence: "Submit the chosen material with two test results and one acknowledged tradeoff."
  },
  {
    number: 34,
    title: "Fix, Remix, or Invent Studio",
    strapline: "Choose the path. Prove the improvement.",
    objective: "Choose to repair a flawed prototype, remix an earlier challenge with a new constraint, or invent a small solution from a prompt, then test it with evidence.",
    teacherSay: [
      "Student Studio means the team chooses a path, but every path still needs a clear test and evidence.",
      "Fix, remix, or invent, then change one meaningful thing at a time so the result can teach us something."
    ],
    teacherDo: [
      "Set three clearly labeled stations with repair cards, remix constraints, and invention prompts.",
      "Model a baseline or first test for each path and require a success criterion before materials are collected.",
      "Use short team conferences instead of continuous whole-class directions."
    ],
    studentSteps: [
      "Choose fix, remix, or invent and record the prompt, constraint, and success test.",
      "Run a baseline or first attempt and identify the most useful evidence.",
      "Make one targeted change and repeat the same test.",
      "Keep, revise, or reject the change, photograph or record the evidence, and reset the station independently."
    ],
    materials: ["Repair cards and safe flawed prototypes", "Remix constraint cards", "Invention prompt cards", "Everyday Maker Bin", "Test tools", "Before-and-after record", "Safety tools as assigned", "Path safety cards"],
    fastFinish: {
      title: "Studio Guide",
      directions: "Write one concise tip that helps the next team start the chosen path without giving away the solution."
    },
    stretch: "Test whether the improvement creates a new tradeoff under a second operating condition.",
    safety: "Follow the safety card for the selected path, inspect before testing, and stop any prototype with an unexpected hazard.",
    cleanup: "Return each station to its start card, sort materials, label work selected for later use, and save evidence with the matching path.",
    exitEvidence: "Name the chosen path, show before-and-after evidence, and defend whether the change should be kept."
  },
  {
    number: 35,
    title: "CIRC Showcase Builder",
    strapline: "Make the learning visible.",
    objective: "Curate a clear, interactive exhibit that communicates a design problem, process, evidence, and improvement.",
    teacherSay: [
      "A showcase is not a pile of projects. It is a guided story about learning.",
      "Visitors should understand the problem and evidence even when the designer is helping someone else."
    ],
    teacherDo: [
      "Model a four-part exhibit with problem, process, evidence, and next step.",
      "Demonstrate safe visitor interaction and a fast reset.",
      "Run a gallery test for readability and traffic flow."
    ],
    studentSteps: [
      "Choose evidence that shows a meaningful design change.",
      "Build a concise display and one safe visitor interaction.",
      "Test the exhibit with a partner who has no background information.",
      "Revise confusing language, placement, or reset steps."
    ],
    materials: ["Selected prototypes", "Display boards", "Labels", "Photos or printed evidence", "Visitor prompt cards", "Reset checklist"],
    fastFinish: {
      title: "Thirty-Second Tour",
      directions: "Write and rehearse a welcome that gives a visitor a useful starting point in 30 seconds."
    },
    stretch: "Design an accessibility improvement for a visitor who cannot use the exhibit in its first form.",
    safety: "Display only stable, approved prototypes and remove any personal information from labels or evidence.",
    cleanup: "Package each exhibit with its reset checklist and store loose evidence in a labeled envelope.",
    exitEvidence: "Use a visitor test to show that the exhibit communicates the problem, evidence, and improvement."
  },
  {
    number: 36,
    title: "Demo Day",
    strapline: "Run the room. Tell the story.",
    objective: "Independently host, demonstrate, reset, and reflect on a polished project experience for an audience.",
    teacherSay: [
      "Today the studio belongs to the teams who built it.",
      "Professional means safe, welcoming, honest about evidence, and ready to reset."
    ],
    teacherDo: [
      "Confirm safety, traffic flow, and team roles before opening.",
      "Observe and record evidence without taking over student explanations.",
      "Lead the final reset and short reflection after the audience leaves."
    ],
    studentSteps: [
      "Inspect the station, assign host, demonstrator, evidence, and reset roles.",
      "Welcome visitors and explain the need before demonstrating the solution.",
      "Answer with evidence, acknowledge limits, and reset after every visitor.",
      "Close the station, restore the room, and complete a final reflection."
    ],
    materials: ["Showcase exhibits", "Role cards", "Safety checklist", "Visitor prompts", "Feedback forms", "Reset supplies"],
    fastFinish: {
      title: "Next-Year Note",
      directions: "Record one specific lesson that would help a future studio team start stronger."
    },
    stretch: "Synthesize visitor feedback into one evidence-backed recommendation for the next iteration.",
    safety: "Operate only approved demonstrations, keep exits and walkways clear, and pause any station that cannot reset safely.",
    cleanup: "Complete the full station checklist, inventory all shared materials, and leave the studio ready for its next use.",
    exitEvidence: "Submit the final reflection with one audience observation, one success, and one next improvement."
  }
];

export const PROJECTS = Object.freeze(PROJECT_BLUEPRINTS.map(createProject));

export function getProjectByNumber(number) {
  if (!Number.isInteger(number)) return null;
  return PROJECTS.find((project) => project.number === number) ?? null;
}
