import { PROJECTS } from "./project-catalog.js";

const FIRST_PROJECT_NUMBER = 1;
const LAST_PROJECT_NUMBER = 36;
const REQUIRED_TOTAL_MINUTES = 35;
const REQUIRED_KINDS = ["ready", "work", "cleanup", "exit"];
const VALID_KINDS = new Set(["ready", "safety", "transition", "work", "cleanup", "exit"]);
const VALID_SAFETY_TAGS = new Set([
  "outdoor",
  "tool",
  "water",
  "hot-glue",
  "cutting",
  "electrical",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const item of Object.values(value)) {
    deepFreeze(item);
  }

  return Object.freeze(value);
}

const TEACHER_DIRECTION_TARGETS = Object.freeze({
  1: Object.freeze(["rules", "rules", "rules", "rules", "stories", "stories", "tour"]),
  2: Object.freeze(["ready", "ready", "walk-out", "wash", "mode", "build"]),
  6: Object.freeze(["ready", "ready", "safety", "observe", "ready"]),
  7: Object.freeze(["ready", "ready", "safety", "sort", "safety"]),
  9: Object.freeze(["ready", "ready", "safety", "safety", "plan"]),
  12: Object.freeze(["ready", "ready", "ready", "plan", "build"]),
  15: Object.freeze(["ready", "ready", "safety", "map", "ready"]),
  22: Object.freeze(["ready", "ready", "ready", "ideas", "build"]),
  23: Object.freeze(["ready", "ready", "safety", "plan", "build", "ready"]),
  28: Object.freeze(["ready", "ready", "safety", "plan", "ready"]),
  31: Object.freeze(["ready", "ready", "ready", "observe", "plan"]),
  33: Object.freeze(["ready", "ready", "safety", "criteria", "criteria"]),
});

function attachTeacherDirections(projectNumber, steps, catalogProject) {
  const teacherGuidance = [
    ...(catalogProject?.teacherSay || []),
    ...(catalogProject?.teacherDo || []),
  ];
  const explicitTargets = TEACHER_DIRECTION_TARGETS[projectNumber];
  const readySuffix = steps[0]?.id.split("-").slice(1).join("-");
  const teachingSteps = steps.filter((step) => ["safety", "work"].includes(step.kind));
  const defaultTargets = [
    readySuffix,
    readySuffix,
    ...teachingSteps.map((step) => step.id.split("-").slice(1).join("-")),
  ];

  for (const [index, direction] of teacherGuidance.entries()) {
    const targetSuffix = explicitTargets?.[index] || defaultTargets[index] || readySuffix;
    const targetStep = steps.find((step) => step.id.endsWith(`-${targetSuffix}`)) || steps[0];
    targetStep.teacherDirections.push(direction);
  }
}

function buildSteps(projectNumber, stepRows, catalogProject) {
  const prefix = `p${String(projectNumber).padStart(2, "0")}`;
  const hasExplicitTeacherDirections = stepRows.some((row) => Array.isArray(row[5]));
  const steps = stepRows.map(([suffix, label, kind, minutes, directions, teacherDirections]) => ({
    id: `${prefix}-${suffix}`,
    label,
    kind,
    minutes,
    directions: [...directions],
    teacherDirections: [...(teacherDirections || [])],
  }));

  if (!hasExplicitTeacherDirections) {
    attachTeacherDirections(projectNumber, steps, catalogProject);
  }

  return steps;
}

function defineParallelJobs(rows) {
  return rows.map(([id, label, directions]) => ({
    id,
    label,
    maxStudents: 5,
    directions: [...directions],
  }));
}

function defineModeVariant(projectNumber, stepRows, parallelJobs, preservation = {}) {
  return {
    steps: buildSteps(projectNumber, stepRows, PROJECTS[projectNumber - 1]),
    parallelJobs: parallelJobs.map((job) => ({ ...job, directions: [...job.directions] })),
    preservation: { ...preservation },
  };
}

function defineFallback(projectNumber, reason, stepRows) {
  return {
    reason,
    steps: buildSteps(projectNumber, stepRows, PROJECTS[projectNumber - 1]),
  };
}

function definePlan(projectNumber, title, safetyTags, stepRows, extra = {}) {
  const catalogProject = PROJECTS[projectNumber - 1];
  const steps = buildSteps(projectNumber, stepRows, catalogProject);
  const normalizedExtra = { ...extra };
  if (extra.modeVariants) {
    normalizedExtra.modeVariants = Object.fromEntries(
      Object.entries(extra.modeVariants).map(([modeId, variant]) => [
        modeId,
        variant.steps ? variant : { ...variant, steps },
      ]),
    );
  }

  return {
    projectNumber,
    title,
    gradeBand: "5-6",
    totalMinutes: REQUIRED_TOTAL_MINUTES,
    safetyTags: [...safetyTags],
    steps,
    ...normalizedExtra,
  };
}

// Explicit optional lessons for the Ehrman Crest replica. The original annual modes stay intact.
export const REPLICA_LESSON_CHOICES = deepFreeze([
  {
    "id": "replica-sort",
    "title": "Sort, Count, Plan",
    "label": "Day 3: Sort, Count, Plan",
    "objective": "I can sort reusable materials, check an inventory, and use evidence to propose a model feature.",
    "summary": "Sort approved loose parts, check quantities, and leave a clear plan for the next crew.",
    "materials": [
      "Approved loose materials",
      "Labeled trays",
      "Paper, pencils and a checked inventory",
      "Teacher-selected aerial reference when available"
    ],
    "safety": "Use only loose approved parts. Leave attached, sharp or questionable parts for the teacher. Build the aerial school view at the front. Preserve the rocks, lizard habitat and technology at the back. Do not move the animal, disturb its habitat or add water without the teacher. Resin is a separate unit and is not needed for this model lesson.",
    "teacherContext": [
      "Use the teacher-selected aerial image when available; actual school footprint, dimensions and parent-drop-off direction are not invented. Mark fountain or other additions PROPOSED. No working water in these sessions.",
      "Keep the front aerial school model separate from the rear rocks, lizard habitat and technology. Confirm a physical boundary and protect existing habitat functions before building. The separate resin unit does not require changing this habitat or adding epoxy to the school model."
    ],
    "fastFinish": "Check one label or count, then leave one useful question for the next crew."
  },
  {
    "id": "replica-layout",
    "title": "Aerial Layout & Dry Prototype",
    "label": "Next session: Aerial Layout & Dry Prototype",
    "objective": "I can use a top-view reference, distinguish an observed feature from a proposed change, and explain a design constraint.",
    "summary": "Use a confirmed aerial reference to plan the school footprint and try a removable dry layout.",
    "materials": [
      "Approved loose materials",
      "Labeled trays",
      "Paper, pencils and a checked inventory",
      "Teacher-selected aerial reference when available"
    ],
    "safety": "Use only loose approved parts. Leave attached, sharp or questionable parts for the teacher. Build the aerial school view at the front. Preserve the rocks, lizard habitat and technology at the back. Do not move the animal, disturb its habitat or add water without the teacher. Resin is a separate unit and is not needed for this model lesson.",
    "teacherContext": [
      "Use the teacher-selected aerial image when available; actual school footprint, dimensions and parent-drop-off direction are not invented. Mark fountain or other additions PROPOSED. No working water in these sessions.",
      "Keep the front aerial school model separate from the rear rocks, lizard habitat and technology. Confirm a physical boundary and protect existing habitat functions before building. The separate resin unit does not require changing this habitat or adding epoxy to the school model."
    ],
    "fastFinish": "Check one label or count, then leave one useful question for the next crew."
  },
  {
    "id": "replica-cardboard",
    "title": "Build the Cardboard School",
    "label": "Day 5: Build the Cardboard School",
    "objective": "I can turn a checked top-view plan into a stable cardboard module, test its fit, and leave a useful handoff.",
    "summary": "Build the aerial school view at the front with cardboard. Preserve the rocks, lizard habitat and technology at the back, and leave a clear handoff for the next crew.",
    "materials": [
      "Cardboard, pencils, rulers and approved cutting tools",
      "Masking tape or paper tabs for student assembly",
      "Existing hot-glue gun, glue sticks and heat-resistant mat at the teacher station",
      "Confirmed top-view reference and labeled storage trays"
    ],
    "safety": "Students dry-fit with tape or tabs. The teacher handles knife cuts, hot glue and cooled joints under the school's tool procedure. Keep cords and hot tools at the marked station. No heat gun, epoxy or water is needed for this lesson.",
    "teacherContext": [
      "Use the known cardboard and existing glue equipment. Precut thick pieces or make requested cuts at the teacher station. A tape-and-tab build remains a complete lesson if the glue station is unavailable.",
      "Confirm the school outline and parent-drop-off direction from a trusted reference. If unavailable, build freestanding feature modules and leave site placement undecided. Mark new fountains and other modifications PROPOSED.",
      "Use one shared model scale only after a real reference dimension is confirmed. Otherwise label the prototype not to scale. Keep new modules removable from the shared base so future crews can revise them.",
      "Mark the front school-model area and the separate rear rocks, lizard habitat and technology. Keep tools, loose parts and glue out of the habitat. The teacher checks animal access, ventilation and existing equipment. The resin unit is a separate project; this model can progress with cardboard and the existing glue equipment."
    ],
    "fastFinish": "Add one labeled brace or test a doorway fit, then sketch the next module without taking another crew's space."
  },
  {
    "id": "replica-service",
    "title": "Remember & Serve",
    "label": "Friday, September 11: Remember & Serve",
    "objective": "I can explain one way people help their community and design a small model feature that meets a person's need.",
    "summary": "Use calm September 11 history and a useful service design for the school community.",
    "materials": [
      "Approved loose materials",
      "Labeled trays",
      "Paper, pencils and a checked inventory",
      "Optional previewed living Survivor Tree photograph"
    ],
    "safety": "Use only loose approved parts. Leave attached, sharp or questionable parts for the teacher. Build the aerial school view at the front. Preserve the rocks, lizard habitat and technology at the back. Do not move the animal, disturb its habitat or add water without the teacher. Resin is a separate unit and is not needed for this model lesson.",
    "teacherContext": [
      "Use calm basic facts, optional sharing and a quiet alternative. No attack reenactment or graphic media.",
      "Keep the front aerial school model separate from the rear rocks, lizard habitat and technology. Confirm a physical boundary and protect existing habitat functions before building. The separate resin unit does not require changing this habitat or adding epoxy to the school model."
    ],
    "fastFinish": "Check one label or count, then leave one useful question for the next crew."
  },
  {
    "id": "replica-resin",
    "title": "Design and Measure a Resin Feature",
    "label": "Resin unit: Design and Measure a Feature",
    "objective": "I can design a small game or art piece, estimate its mold volume, calculate a labeled mixing ratio, and explain my material choice.",
    "summary": "A separate unit for all 670 students: design a small game or art piece and measure its mold. Students plan with dry materials; the teacher manages later resin work.",
    "materials": [
      "Paper, pencils, rulers and calculators",
      "An empty silicone mold or its dimensioned drawing",
      "A teacher-cleared fully cured example if available",
      "Reusable station trays, blank class/group/piece labels and a teacher handoff sheet",
      "The exact selected resin label, instruction sheet and both component safety data sheets"
    ],
    "safety": "This 35-minute student lesson stays dry. Students do not mix, pour, heat, demold or handle uncured epoxy. The teacher prepares a separate approved resin station and follows the exact product instructions for any later demonstration, application and cure.",
    "teacherContext": [
      "Plan for approximately 670 students rotating through five cycle days, about 134 per day on average. The six groups of up to five are one class setup, not a limit of 30 participants. Use the actual roster size and schedule for each class.",
      "Every student completes a dry design, volume calculation and material explanation. Reuse the same empty molds, rulers and station trays across classes. The purchasing plan allows one small individual piece per student, with final mold capacity and actual class counts checked before ordering. This is separate from the Tech Terrarium school model. A design class and the later casting/cure schedule are different stages; one gallon is not the whole-cohort supply plan.",
      "Use a teacher handoff sheet with cycle day, class code, group code, piece ID, design decision, estimated volume, current stage, storage tray and next action. Student names stay off public screens. At each class change, check the previous row and reset dry supplies before the next crew starts.",
      "Run the design, volume and ratio work before resin arrives. Use a drawing if molds or cured examples are unavailable. Resin is a planned material, not a prerequisite for today's learning.",
      "For later teacher-managed use: confirm the exact product, both safety data sheets, compatible gloves and eye protection, room ventilation, batch and pour limits, protected curing location and disposal procedure. A low-odor or low-VOC claim does not replace those checks.",
      "Separate the hot-glue build table from any resin station. A heat gun is optional adult equipment only when the exact resin instructions and school procedure allow it; it is not a student tool or a required step. No flame is used in this unit.",
      "Keep volume ratios and weight ratios distinct. Use the selected product label for real batches. The paper example assumes a 1:1 ratio by volume and a rectangular 5 cm by 4 cm by 0.5 cm cavity: 10 cubic centimeters is 10 mL total, or 5 mL of each part. This is arithmetic practice, not a batch instruction.",
      "The classroom step timer is not a resin cure timer. Record the actual product, pour time and manufacturer conditions separately; pieces remain at the protected station until the teacher confirms the required cure and safe handling. Do not promise next-period demolding."
    ],
    "fastFinish": "Compare a paper prototype with a fully cured game or art piece, then explain whether the material and curing time meet the design need."
  }
]);

export function getReplicaLessonChoice(modeId) {
  return REPLICA_LESSON_CHOICES.find((choice) => choice.id === modeId) ?? null;
}

function replicaParallelJobs() {
  return defineParallelJobs([
    ["materials", "Materials Team", ["Handle only the loose parts approved for this step."]],
    ["plan", "Plan Team", ["Draw or label the current plan."]],
    ["check", "Check Team", ["Check one count, label or design reason."]],
    ["reference", "Reference Team", ["Mark what is known and what needs a reference."]],
    ["record", "Record Team", ["Record the result and the next action."]],
    ["share", "Share Team", ["Explain one result and help reset the space."]]
  ]);
}

function replicaModeVariants() {
  return {
    "replica-sort": {
      ...defineModeVariant(2, [
        [
          "replica-ready",
          "MEET THE PROJECT",
          "ready",
          3,
          [
            "Look at the approved loose parts.",
            "Name one kind of material you notice."
          ],
          [
            "Say: We are preparing a model of our school. Today we sort the loose approved parts and find out what we have before we build.",
            "Keep actual quantities and final feature decisions open until checked."
          ]
        ],
        [
          "replica-roles",
          "TAKE A ROLE",
          "safety",
          4,
          [
            "Choose materials lead, sorter, counter or recorder.",
            "Move only loose parts the teacher approved.",
            "Leave attached or questionable parts in place and tell the teacher."
          ],
          [
            "Model one safe part, a sorting category and a count with units.",
            "Remaining disassembly is teacher-managed only; students do not pull or pry glued pieces.",
            "Explain that this dry lesson prepares the required final epoxy stage. Confirm supplies and product directions before attachment."
          ]
        ],
        [
          "replica-sort",
          "SORT THE PARTS",
          "work",
          8,
          [
            "Sort one tray into possible building parts and site parts.",
            "Keep each kind together.",
            "Flag a questionable item for the teacher."
          ],
          [
            "Give each team one tray.",
            "Use existing approved materials only.",
            "Halfway through, rotate handling and recording roles."
          ]
        ],
        [
          "replica-count",
          "COUNT AND CHECK",
          "work",
          4,
          [
            "Record the material, count, unit and condition.",
            "Ask a partner to check one count.",
            "Label any unfinished pile not yet counted."
          ],
          [
            "Ask: Could the next crew check this count?",
            "Distinguish individual pieces, pairs and sets. Do not tally the same pile twice."
          ]
        ],
        [
          "replica-plan",
          "SKETCH ONE USE",
          "work",
          7,
          [
            "Look at the teacher-selected school reference if available.",
            "Sketch one use for an inventoried material.",
            "Mark new features PROPOSED and uncertain features with a question mark."
          ],
          [
            "Identify only confirmed building, arrival and path features.",
            "If the aerial is unavailable, label the site sketch REFERENCE NEEDED and check inventory instead.",
            "Keep any fountain dry and unbuilt today."
          ]
        ],
        [
          "replica-reset",
          "LABEL AND RESET",
          "cleanup",
          5,
          [
            "Return parts to labeled trays.",
            "Keep counted and uncounted piles clear.",
            "Clear the table and walking space."
          ],
          [
            "Do not discard or permanently attach parts.",
            "Check one tray label and protect remaining teacher-managed materials."
          ]
        ],
        [
          "replica-exit",
          "LEAVE THE NEXT STEP",
          "exit",
          4,
          [
            "Complete: We counted ___ units of ___.",
            "Explain: It could represent ___ because ___.",
            "Leave one question and one next action for the next crew."
          ],
          [
            "Accept a short written, spoken or drawn response.",
            "Collect a checked inventory and team handoff; do not require every tray to be finished."
          ]
        ]
      ], replicaParallelJobs(), { preserveExisting: true, requiresTeacherPlan: true, dismantleGluedStructure: false }),
      title: "Sort, Count, Plan",
      safetyTags: []
    },
    "replica-layout": {
      ...defineModeVariant(2, [
        [
          "map-handoff",
          "READ THE HANDOFF",
          "ready",
          4,
          [
            "Read the previous crew's tray labels and next step.",
            "Check one inventory count before using parts."
          ],
          [
            "Say: We check the previous crew's evidence before we add our own ideas.",
            "Continue inventory if needed; do not assume the same students attended yesterday."
          ]
        ],
        [
          "map-reference",
          "READ THE SCHOOL VIEW",
          "work",
          5,
          [
            "Orient the teacher-selected aerial image with a confirmed landmark.",
            "Find the building, parent-drop-off area and a visible path.",
            "Mark anything uncertain with a question mark."
          ],
          [
            "Confirm visible features without inventing traffic direction or dimensions.",
            "If no reference is available, keep site placement undecided and use feature sketches only."
          ]
        ],
        [
          "map-footprint",
          "DRAW THE TOP VIEW",
          "work",
          7,
          [
            "Sketch the broad building and site shapes.",
            "Make a key for observed features and proposed changes.",
            "Mark the fountain or other new ideas PROPOSED."
          ],
          [
            "Keep the actual-school replica and proposed modifications distinguishable.",
            "Label the drawing not to scale unless a reference measurement has been confirmed."
          ]
        ],
        [
          "map-materials",
          "MATCH MATERIALS",
          "work",
          5,
          [
            "Choose one inventoried material for a feature.",
            "Explain why its shape or condition fits the job.",
            "Record an open question before using an uncertain part."
          ],
          [
            "Check proposed material uses.",
            "Reserve final epoxy compatibility and application decisions for the exact product and teacher-approved process."
          ]
        ],
        [
          "map-dryfit",
          "TRY A LOOSE LAYOUT",
          "work",
          5,
          [
            "Place loose paper shapes or approved parts on the plan.",
            "Trace a connected model route from arrival to entrance.",
            "Revise one crowded or unclear spot."
          ],
          [
            "Keep all parts removable and all water features dry.",
            "This is a model design check, not certification of real-school accessibility or traffic safety."
          ]
        ],
        [
          "map-reset",
          "SAVE THE PLAN",
          "cleanup",
          5,
          [
            "Label the plan and store loose pieces separately.",
            "Return the materials and clear your space."
          ],
          [
            "Preserve other teams' work.",
            "Confirm the handoff identifies what was observed, proposed and left undecided."
          ]
        ],
        [
          "map-exit",
          "EXPLAIN YOUR REVISION",
          "exit",
          4,
          [
            "Name one observed feature and one proposed change.",
            "Name one limit and explain what you changed.",
            "Write the next crew's first task."
          ],
          [
            "Collect the labeled plan and one evidence-based explanation.",
            "Do not advance to permanent attachment until the plan and materials are approved."
          ]
        ]
      ], replicaParallelJobs(), { preserveExisting: true, requiresTeacherPlan: true, dismantleGluedStructure: false }),
      title: "Aerial Layout & Dry Prototype",
      safetyTags: []
    },
    "replica-cardboard": {
      ...defineModeVariant(2, [
        ["build-handoff", "READ THE BUILD PLAN", "ready", 3, [
          "Read the previous crew's plan and labels.",
          "Choose one school module your team can finish today."
        ], [
          "Say: Today we start building a cardboard version of Ehrman Crest. One useful, checked module is success.",
          "Choose a wall, entrance, roof section or route marker. Keep proposed modifications labeled and separate."
        ]],
        ["build-tools", "CHECK THE TOOL STATION", "safety", 4, [
          "Use only the cutting and assembly tools your teacher gives you.",
          "Fit the parts together with tape or tabs before asking the teacher to glue them.",
          "Keep hands away from the hot-glue station and let the teacher check cooled pieces."
        ], [
          "Set a marked adult glue-and-cut station on a heat-resistant mat. Manage hot glue, knife cuts, cords and cooling under the school's tool procedure.",
          "Use tape and tabs throughout if the station is unavailable. Existing tools do not remove the need for supervision."
        ]],
        ["build-mark", "MEASURE AND MARK", "work", 5, [
          "Draw your module on cardboard and label its parts.",
          "Mark folds, tabs and the doorway before cutting.",
          "Check one measurement with a partner."
        ], [
          "Use the shared reference and consistent scale if confirmed; otherwise mark not to scale.",
          "If no aerial reference is ready, build a freestanding module and leave its final site location undecided."
        ]],
        ["build-module", "BUILD ONE MODULE", "work", 12, [
          "Cut only as directed, then fold or tape your pieces together.",
          "Check that the parts fit before asking the teacher to glue them.",
          "Add a brace if your module will not stand on its own."
        ], [
          "Manage the glue queue while other teams dry-fit, label, measure and brace. Do not let tool waiting stop all six groups.",
          "Keep modules removable from the shared base. No epoxy pour or working fountain today."
        ]],
        ["build-test", "TEST THE FIT", "work", 4, [
          "Set your module in its agreed place, or beside the plan if the location is undecided.",
          "Check that it stands and leaves the planned route clear.",
          "Improve one weak connection or crowded spot."
        ], [
          "Check a stable stand, a readable label and fit with adjacent modules. This checks the model, not actual building safety.",
          "Record disagreements rather than overwriting another crew's work."
        ]],
        ["build-reset", "LABEL AND STORE", "cleanup", 5, [
          "Label your module with a team code and its next step.",
          "Save useful scraps and return tools as directed.",
          "Leave hot tools and cooling pieces for the teacher."
        ], [
          "Unplug and secure the glue equipment; protect cooling work and clear the station.",
          "Store modules in labeled trays. Keep student names out of public display or shared files."
        ]],
        ["build-exit", "EXPLAIN ONE BUILD CHOICE", "exit", 2, [
          "Complete: Our module represents ___ and we made it stable by ___.",
          "Leave the next crew one specific action."
        ], [
          "Accept a brief written, spoken or drawn handoff. Check the module against the plan, stability and label criteria."
        ]]
      ], replicaParallelJobs(), { preserveExisting: true, requiresTeacherPlan: true, dismantleGluedStructure: false }),
      title: "Build the Cardboard School",
      safetyTags: ["hot-glue", "cutting", "tool"]
    },
    "replica-resin": {
      ...defineModeVariant(2, [
        ["resin-purpose", "CHOOSE A USEFUL FEATURE", "ready", 3, [
          "Read your class, group and piece code on the plan.",
          "Choose a small game piece, art tile or other teacher-approved mold design.",
          "Name its purpose in your game or art project."
        ], [
          "Say: We will decide where resin earns its place, then measure and plan it before any pouring.",
          "This is a separate unit from the school model and lizard habitat. It can run without purchased resin or molds.",
          "Set up for this class within the 670-student, five-cycle-day rotation. Every student does the dry work; reuse station equipment. Check the previous class's sheet and assign class/group/piece codes without public names."
        ]],
        ["resin-boundary", "READ THE MATERIAL RULES", "safety", 4, [
          "Stay with paper, empty molds and teacher-cleared cured examples.",
          "Leave all resin bottles, mixing tools and heating equipment at the teacher station.",
          "Ask before touching an example."
        ], [
          "This student lesson stays dry. Mixing, pouring, heating and cure checks are adult tasks under the exact product instructions and school procedure.",
          "Do not pass around uncured or partly cured pieces. Use a picture if a safe example is unavailable."
        ]],
        ["resin-volume", "MEASURE THE MOLD", "work", 7, [
          "Measure or read the inside dimensions in centimeters.",
          "For a rectangular cavity, multiply length by width by depth.",
          "Record the estimated volume in cubic centimeters and milliliters."
        ], [
          "Use a dimensioned rectangular drawing when the actual mold is curved or irregular; explain that its estimate needs a different method.",
          "One cubic centimeter equals one milliliter. Example: 5 x 4 x 0.5 = 10 mL. Keep this as a design estimate, not a permission to mix."
        ]],
        ["resin-ratio", "CHECK THE RATIO", "work", 6, [
          "Read whether the example ratio uses volume or weight.",
          "For the paper 1:1 volume example, split 10 mL into two equal parts.",
          "Explain why changing the ratio is not a way to change the color or curing time."
        ], [
          "Expected paper answer: 5 mL part A and 5 mL part B. Real product ratios, batch sizes and instructions must be checked separately.",
          "Do not treat equal volume as equal weight. The teacher chooses the actual batch; students do not dispense material."
        ]],
        ["resin-compare", "COMPARE AND PLAN", "work", 7, [
          "Compare cardboard with a teacher-cleared cured resin example or picture.",
          "Choose one reason to use resin and one reason to keep a part cardboard.",
          "Draw the feature and label the mold, estimated volume and a question to check."
        ], [
          "Compare useful properties, repeatability, cost and waiting time. Do not equate glossy appearance with structural strength.",
          "For a later demonstration, prepare a compatible mold and protected station separately. The classroom timer never confirms a chemical cure; use the actual manufacturer's conditions and handling instructions."
        ]],
        ["resin-reset", "SAVE THE DESIGN", "cleanup", 5, [
          "Return rulers and empty molds.",
          "Label the dry plan with your class, group and piece code.",
          "Record its estimated volume, storage tray and next action.",
          "Leave all chemical equipment for the teacher."
        ], [
          "Collect each student's calculation and design explanation. On the class handoff sheet record the piece ID, decision, estimated volume, stage, storage tray and next action. Reset reusable dry stations for the next class.",
          "Keep any real chemical work, waste and curing pieces under adult control. A later casting needs its own product, pour time and cure record, separate from class rotation; the next class does not imply readiness to demold.",
          "Keep each piece labeled through the separate pour, demold and full-cure stages. Return only fully cured pieces after the teacher checks them; this may be in the following class cycle. Do not place resin materials or castings in the animal habitat."
        ]],
        ["resin-exit", "EXPLAIN YOUR CHOICE", "exit", 3, [
          "Complete: Our feature needs about ___ mL because ___.",
          "Explain the paper mixing ratio and why the real label still matters.",
          "Name one check needed before the teacher can make it."
        ], [
          "Assess the unit, calculation, material reason and next check. A completed plan is the output today, not a finished casting."
        ]]
      ], replicaParallelJobs(), { preserveExisting: true, requiresTeacherPlan: true, dismantleGluedStructure: false }),
      title: "Design and Measure a Resin Feature",
      safetyTags: []
    },
    "replica-service": {
      ...defineModeVariant(2, [
        [
          "care-ready",
          "SETTLE AND LISTEN",
          "ready",
          3,
          [
            "Listen quietly or share if you choose.",
            "Think about a way people care for one another."
          ],
          [
            "Say: Today is September 11. We will remember people and consider how communities care for one another. You do not have to share a personal story."
          ]
        ],
        [
          "care-history",
          "REMEMBER SEPTEMBER 11",
          "work",
          4,
          [
            "Listen to the short factual explanation.",
            "Ask a question or choose to listen."
          ],
          [
            "Say: On September 11, 2001, terrorists attacked the United States and many people died. First responders and other people helped during and after the attacks. We remember the people who died and the people whose lives changed.",
            "Give basic age-appropriate facts. No graphic footage, sirens, collapse reenactments or blame toward an entire group."
          ]
        ],
        [
          "care-example",
          "NOTICE CARE AND RECOVERY",
          "work",
          4,
          [
            "Look at the teacher-selected living-tree image if available.",
            "Describe one action that helps something recover."
          ],
          [
            "Use only a previewed current Survivor Tree image from the 9/11 Memorial & Museum.",
            "Explain that people cared for a tree damaged in the attacks and it returned to the Memorial after recovery.",
            "If the image is unavailable, give the brief explanation without opening an unpreviewed video."
          ]
        ],
        [
          "care-design",
          "DESIGN FOR SOMEONE",
          "work",
          13,
          [
            "Choose a school-community user and one need.",
            "Draw or make a removable paper feature that helps.",
            "Label the feature PROPOSED and explain where it could fit."
          ],
          [
            "Offer a welcoming sign, rest area, clear route marker or quiet garden concept.",
            "Keep the school model separate from any attack reenactment or claimed official memorial.",
            "Use dry approved materials only; required final epoxy application is a later teacher-managed stage."
          ]
        ],
        [
          "care-share",
          "EXPLAIN AND IMPROVE",
          "work",
          5,
          [
            "Complete: This helps ___ by ___.",
            "Give a design reason and listen to one partner question.",
            "Revise one label or placement."
          ],
          [
            "Accept quiet written responses.",
            "Look for a specific user need and a reasoned design choice, not a display of a particular emotion."
          ]
        ],
        [
          "care-reset",
          "PROTECT THE IDEAS",
          "cleanup",
          4,
          [
            "Store the concept separately from the shared model.",
            "Leave other teams' work intact.",
            "Return materials."
          ],
          [
            "Collect any thank-you messages for teacher review; sending or public display is a later decision.",
            "Follow school support routines for anyone needing a quieter task."
          ]
        ],
        [
          "care-exit",
          "NAME ONE WAY TO HELP",
          "exit",
          2,
          [
            "Complete: One way I can help our community is ___.",
            "Explain how your proposed feature helps someone."
          ],
          [
            "Accept a drawing with a brief oral explanation.",
            "Save the proposal and one next action for a later build session."
          ]
        ]
      ], replicaParallelJobs(), { preserveExisting: true, requiresTeacherPlan: true, dismantleGluedStructure: false }),
      title: "Remember & Serve",
      safetyTags: []
    }
  };
}

const PLAN_DEFINITIONS = [
  definePlan(
    1,
    "Meet the CIRC Teacher and the Outdoor Classroom",
    ["outdoor"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place your paper on the clipboard.",
        "Write your first name only.",
      ]],
      ["rules", "TWO RULES", "safety", 4, [
        "Write Trust at the top.",
        "Write Respect beside it.",
        "Listen for the outdoor boundary.",
      ]],
      ["stories", "STORY CARDS", "work", 5, [
        "Listen to each private approved story card.",
        "Record one idea from each approved story card.",
      ]],
      ["walk-out", "WALK OUT", "transition", 3, [
        "Line up at walking space.",
        "Walk with your assigned group.",
      ]],
      ["tour", "TOUR THE SPACE", "work", 7, [
        "Visit each marked outdoor zone.",
        "Record three useful details.",
        "Leave plants untouched.",
      ]],
      ["return", "RETURN INSIDE", "transition", 3, [
        "Walk back with your group.",
        "Place the clipboard at your seat.",
      ]],
      ["future", "SKETCH A FUTURE", "work", 4, [
        "Choose one outdoor learning spot.",
        "Sketch one possible improvement.",
      ]],
      ["cleanup", "RESET THE ROOM", "cleanup", 3, [
        "Return the clipboard.",
        "Place scrap paper in the tray.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Circle Trust or Respect.",
        "Write one action that shows your choice.",
      ]],
    ],
    {
      teacherStoryBoundary: {
        privateApprovedCardsOnly: true,
        hardcodedPersonalDetails: false,
      },
    },
  ),
  definePlan(
    2,
    "Tech Terrarium",
    ["outdoor", "water"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Find your team color.",
        "Put on the matching team card.",
        "Look at the materials picture.",
      ]],
      ["mode", "READ THE MODE", "work", 3, [
        "The teacher picked BUILD NEW.",
        "Read only the mode card for your job.",
        "Go to your team spot.",
      ]],
      ["walk-out", "WALK OUT", "transition", 2, [
        "Walk with your collection team.",
        "Stay inside the marked area.",
      ]],
      ["collect", "COLLECT SAFELY", "work", 4, [
        "Pick up only approved loose rocks.",
        "Leave every habitat untouched.",
      ]],
      ["return", "RETURN INSIDE", "transition", 2, [
        "Carry the tray with two hands.",
        "Walk back with your team.",
      ]],
      ["wash", "WASH STATION", "safety", 4, [
        "Keep water inside the wash tub.",
        "Place each wet rock on a towel.",
        "Wipe each spill at once.",
      ]],
      ["build", "BUILD THE MODE", "work", 10, [
        "Do only the job on your team card.",
        "Put finished parts in the team tray.",
        "Wait for the teacher check.",
        "Add approved parts to the shared build.",
      ]],
      ["cleanup", "RESET MATERIALS", "cleanup", 4, [
        "Return unused base materials.",
        "Hang wet towels at the station.",
        "Leave the shared build in place.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name the mode your team used.",
        "Record one part the class should preserve.",
      ]],
    ],
    {
      annualModes: {
        supported: ["build-new", "refresh-existing", "alternate-shared-build"],
        refreshExisting: {
          dismantleGluedStructure: false,
        },
      },
      modeVariants: {
        "build-new": {
          parallelJobs: defineParallelJobs([
            ["collect", "Rock Team", ["Collect only loose approved rocks."]],
            ["wash", "Wash Team", ["Wash rocks inside the tub."]],
            ["dry", "Dry Team", ["Dry each rock on a towel."]],
            ["base", "Base Team", ["Place the approved base layers."]],
            ["layout", "Layout Team", ["Set loose parts in the planned spots."]],
            ["record", "Record Team", ["Draw the class plan and record changes."]],
          ]),
          preservation: {
            preserveExisting: false,
            dismantleGluedStructure: false,
          },
        },
        "refresh-existing": defineModeVariant(
          2,
          [
            ["refresh-ready", "GET READY", "ready", 3, [
              "Look at the saved terrarium.",
              "Touch nothing yet.",
            ], ["Say: Today we keep the old build and add one safe part."]],
            ["refresh-jobs", "CHOOSE JOBS", "work", 3, [
              "Read one refresh job card.",
              "Go to your team spot.",
            ], ["Give each student one refresh job card."]],
            ["refresh-safety", "KEEP IT SAFE", "safety", 4, [
              "Keep all glued parts together.",
              "Do not pull or pry.",
              "Move only loose parts the teacher marked.",
            ], ["Point to glued parts. Say: These stay together."]],
            ["refresh-look", "LOOK AND RECORD", "work", 5, [
              "Find one part that should stay.",
              "Find one spot that can work better.",
              "Draw what you see.",
            ], ["Show how to look without moving fixed parts."]],
            ["refresh-plan", "PLAN ONE ADD ON", "work", 5, [
              "Draw one part that can come back off.",
              "Keep space for plants and future tools.",
            ], ["Check that each idea can be removed later."]],
            ["refresh-build", "BUILD OFF TO THE SIDE", "work", 8, [
              "Build the new part away from the terrarium.",
              "Use only the tools on your card.",
              "Wait for the teacher check.",
            ], ["Approve each part before it touches the terrarium."]],
            ["refresh-test", "TEST THE NEW PART", "work", 3, [
              "Test the new part away from the terrarium.",
              "Fix one loose or crowded spot.",
            ], ["Lead the class check away from the terrarium."]],
            ["refresh-cleanup", "RESET MATERIALS", "cleanup", 2, [
              "Return every tool.",
              "Store the new part by itself.",
            ], ["Check that the old build still looks the same."]],
            ["refresh-exit", "EXIT CHECK", "exit", 2, [
              "Name one part that stayed.",
              "Name the new part your team made.",
            ], ["Ask what changed and what must stay next year."]],
          ],
          defineParallelJobs([
            ["inspect", "Look Team", ["Look for parts that must stay."]],
            ["clean", "Care Team", ["Clean only loose approved parts."]],
            ["plan", "Plan Team", ["Draw one part that can come back off."]],
            ["build", "Build Team", ["Build the approved part away from the terrarium."]],
            ["test", "Test Team", ["Test the part at the side table."]],
            ["record", "Record Team", ["Write what changed and what stayed."]],
          ]),
          {
            preserveExisting: true,
            requiresExistingArtifact: true,
            dismantleGluedStructure: false,
          },
        ),
        "alternate-shared-build": defineModeVariant(
          2,
          [
            ["alternate-ready", "GET READY", "ready", 3, [
              "Look at the teacher plan.",
              "Find your team color.",
            ], ["Name the one shared build for today."]],
            ["alternate-jobs", "CHOOSE JOBS", "work", 3, [
              "Read one job card.",
              "Go to your team spot.",
            ], ["Give each student one job card."]],
            ["alternate-safety", "CHECK SAFETY", "safety", 4, [
              "Use only the tools on your card.",
              "Stop if a part feels sharp, hot, or unsafe.",
              "Tell the teacher at once.",
            ], ["Show the stop rule for the teacher plan."]],
            ["alternate-plan", "PLAN YOUR PART", "work", 5, [
              "Draw your team part.",
              "Mark where it joins the shared build.",
              "Wait for the teacher check.",
            ], ["Approve each team part before building starts."]],
            ["alternate-build", "BUILD YOUR PART", "work", 10, [
              "Build only your team part.",
              "Put the finished part in the team tray.",
              "Wait before joining parts.",
            ], ["Keep teams working in their own spots."]],
            ["alternate-test", "JOIN AND TEST", "work", 5, [
              "Join parts only when the teacher says go.",
              "Run one safe class test.",
              "Fix one weak join.",
            ], ["Lead one safe test of the shared build."]],
            ["alternate-cleanup", "RESET MATERIALS", "cleanup", 3, [
              "Return every tool.",
              "Sort scraps into the marked bins.",
              "Store the shared build.",
            ], ["Count tools and choose the storage spot."]],
            ["alternate-exit", "EXIT CHECK", "exit", 2, [
              "Name your team job.",
              "Name one test result.",
            ], ["Ask each team for one result."]],
          ],
          defineParallelJobs([
            ["plan", "Plan Team", ["Draw the shared build and label team parts."]],
            ["materials", "Materials Team", ["Sort approved parts into team trays."]],
            ["build-a", "Build Team A", ["Build the first approved part."]],
            ["build-b", "Build Team B", ["Build the second approved part."]],
            ["test", "Test Team", ["Run the teacher-approved test."]],
            ["record", "Record Team", ["Write each team result."]],
          ]),
          {
            preserveExisting: false,
            requiresTeacherPlan: true,
            dismantleGluedStructure: false,
          },
        ),
        ...replicaModeVariants(),
      },
    },
  ),
  definePlan(
    3,
    "Outdoor Classroom Redesign",
    ["outdoor", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Clip the site map to your board.",
        "Choose one outdoor zone.",
      ]],
      ["walk-out", "WALK OUT", "transition", 2, [
        "Walk with your design team.",
        "Stop at the assigned zone.",
      ]],
      ["safety", "MEASURE SAFELY", "safety", 3, [
        "Keep the tape measure below your waist.",
        "Leave plants untouched.",
        "Stay on the approved surface.",
      ]],
      ["survey", "SURVEY THE ZONE", "work", 8, [
        "Record one feature that works.",
        "Record one learning problem.",
        "Measure the open space.",
      ]],
      ["design", "DRAW THE REDESIGN", "work", 8, [
        "Name the user.",
        "Draw the improvement on grid paper.",
        "Label the main measurements.",
      ]],
      ["model", "MODEL ONE PART", "work", 4, [
        "Build one key feature from paper.",
        "Check its size against the drawing.",
      ]],
      ["cleanup", "PACK THE KIT", "cleanup", 3, [
        "Return each measuring tool.",
        "Place the model in the class tray.",
      ]],
      ["return", "RETURN INSIDE", "transition", 2, [
        "Walk back with your design team.",
      ]],
      ["exit", "EXIT CHECK", "exit", 2, [
        "Write one reason the redesign helps.",
      ]],
    ],
  ),
  definePlan(
    4,
    "Cardboard Connections Lab",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose three connection cards.",
        "Place cardboard on the table.",
      ]],
      ["safety", "SCISSOR SAFETY", "safety", 3, [
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
      ]],
      ["samples", "MAKE CONNECTIONS", "work", 6, [
        "Make one paper tab.",
        "Make one paper slot.",
        "Make one folded support.",
      ]],
      ["build", "BUILD A HOLDER", "work", 10, [
        "Choose your strongest two connections.",
        "Build a small holder that stands by itself.",
        "Use each chosen connection once.",
      ]],
      ["test", "TEST THE BUILD", "work", 5, [
        "Push the holder gently.",
        "Pull one connection gently.",
        "Fix the first weak connection.",
      ]],
      ["cleanup", "SORT THE SCRAPS", "cleanup", 5, [
        "Return usable cardboard pieces.",
        "Recycle tiny scraps.",
        "Close the scissors.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Point to your strongest connection.",
        "Name the push, pull, or bend it handled.",
      ]],
    ],
  ),
  definePlan(
    5,
    "Paper Bridge",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the support blocks on the marks.",
        "Count the load pieces.",
      ]],
      ["safety", "TEST SAFELY", "safety", 3, [
        "Keep hands below the table edge.",
        "Place only approved loads on the bridge.",
      ]],
      ["plan", "PLAN THE SPAN", "work", 5, [
        "Choose a beam shape.",
        "Predict where the paper may bend.",
        "Sketch the bridge.",
      ]],
      ["build", "BUILD THE BRIDGE", "work", 11, [
        "Fold the paper into your chosen shape.",
        "Tape only the planned joints.",
        "Place the bridge across the fixed span.",
      ]],
      ["test", "LOAD THE BRIDGE", "work", 7, [
        "Add one load piece.",
        "Record the supported total.",
        "Repeat until the bridge fails.",
        "Change one weak part.",
      ]],
      ["cleanup", "RESET THE TEST", "cleanup", 3, [
        "Return every load piece.",
        "Recycle damaged paper.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write the highest supported load.",
        "Name your useful change.",
      ]],
    ],
  ),
  definePlan(
    6,
    "Outdoor Microclimate Map",
    ["outdoor", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Clip the zone map to your board.",
        "Check your assigned zones.",
      ]],
      ["walk-out", "WALK OUT", "transition", 2, [
        "Walk with your weather team.",
      ]],
      ["safety", "USE TOOLS SAFELY", "safety", 3, [
        "Carry the thermometer by its case.",
        "Leave unknown plants untouched.",
        "Stay inside each marked zone.",
      ]],
      ["observe", "OBSERVE TWO ZONES", "work", 8, [
        "Mark sun or shade.",
        "Mark the surface condition.",
        "Watch the wind ribbon.",
      ]],
      ["measure", "TAKE READINGS", "work", 6, [
        "Take one approved reading in each zone.",
        "Write each number on the map.",
      ]],
      ["map", "BUILD THE MAP", "work", 5, [
        "Add both zones to the class key.",
        "Choose the best zone for one activity.",
      ]],
      ["cleanup", "PACK THE TOOLS", "cleanup", 3, [
        "Return each tool to its case.",
        "Clip all maps together.",
      ]],
      ["return", "RETURN INSIDE", "transition", 2, [
        "Walk back with your weather team.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write two observations that support your zone choice.",
      ]],
    ],
    {
      fallbacks: {
        "indoor-weather": defineFallback(
          6,
          "Use when weather or air quality keeps the class inside.",
          [
            ["indoor-ready", "GET READY", "ready", 3, [
              "Place the indoor map on your table.",
              "Pick up two weather data cards.",
            ], ["Say why the class is staying inside today."]],
            ["indoor-safety", "KEEP CARDS SAFE", "safety", 4, [
              "Keep every card on the table.",
              "Use no outdoor tool.",
              "Walk only when the teacher says go.",
            ], ["Show where cards and pencils stay."]],
            ["indoor-key", "LEARN THE MAP KEY", "work", 5, [
              "Find the sun mark.",
              "Find the shade mark.",
              "Find the wind mark.",
            ], ["Model one card with the class map key."]],
            ["indoor-compare", "COMPARE TWO ZONES", "work", 7, [
              "Read the first weather data card.",
              "Mark its sun, wind, and ground clues.",
              "Do the same with the second card.",
            ], ["Read one sample card aloud."]],
            ["indoor-map", "BUILD THE MAP", "work", 7, [
              "Add both zones to the indoor map.",
              "Copy each number carefully.",
              "Check the map with a partner.",
            ], ["Check one team before all teams continue."]],
            ["indoor-choose", "CHOOSE A ZONE", "work", 4, [
              "Pick the best zone for one activity.",
              "Circle two clues that support your choice.",
            ], ["Ask teams to use two clues, not a guess."]],
            ["indoor-cleanup", "RESET THE TABLE", "cleanup", 2, [
              "Stack the weather data cards.",
              "Return the map and pencil.",
            ], ["Count the card sets."]],
            ["indoor-exit", "EXIT CHECK", "exit", 3, [
              "Name the zone you picked.",
              "Read your two clues.",
            ], ["Listen for a choice and two matching clues."]],
          ],
        ),
      },
    },
  ),
  definePlan(
    7,
    "Seed Travelers",
    ["water"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one seed sample card.",
        "Place the test sheet on your table.",
      ]],
      ["safety", "TEST SAFELY", "safety", 3, [
        "Keep water inside the tray.",
        "Wipe each spill with a towel.",
        "Keep every sample away from your mouth.",
      ]],
      ["sort", "SORT THE SEEDS", "work", 4, [
        "Study the seed shape.",
        "Choose wind, drop, float, or hitchhiking.",
        "Record your reason.",
      ]],
      ["build", "BUILD A MODEL", "work", 9, [
        "Sketch one model seed.",
        "Choose materials that match the travel method.",
        "Build the model.",
      ]],
      ["test", "RUN THREE TRIALS", "work", 7, [
        "Use the matching test station.",
        "Run one trial at a time.",
        "Record each result.",
      ]],
      ["revise", "CHANGE ONE PART", "work", 4, [
        "Change one shape or material.",
        "Repeat the same test.",
      ]],
      ["cleanup", "RESET THE STATION", "cleanup", 2, [
        "Dry the wet station.",
        "Return every model piece.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Circle the better result.",
        "Name the useful feature.",
      ]],
    ],
  ),
  definePlan(
    8,
    "Crash Lander",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Count your allowed materials.",
        "Place the payload beside the container.",
        "Pick up one drop-zone team card.",
      ]],
      ["safety", "DROP ZONE SAFETY", "safety", 3, [
        "Stay behind the drop-zone line.",
        "Let the teacher release the lander.",
        "Do the waiting job on your team card.",
        "Move only when the teacher calls your team.",
      ]],
      ["plan", "PLAN THE LANDER", "work", 5, [
        "Mark where the payload needs support.",
        "Sketch one part that can bend safely.",
      ]],
      ["build", "BUILD THE CAPSULE", "work", 11, [
        "Place the payload inside the container.",
        "Add only allowed materials.",
        "Check that no part can fall off.",
      ]],
      ["test", "TEST AND REVISE", "work", 7, [
        "Predict the first failure point.",
        "Watch the controlled drop.",
        "Inspect the payload.",
        "Change one feature.",
      ]],
      ["cleanup", "RESET THE DROP", "cleanup", 3, [
        "Return the reusable payload.",
        "Collect every loose part.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Draw the impact evidence.",
        "Label your useful change.",
      ]],
    ],
  ),
  definePlan(
    9,
    "Paper Circuit Signal",
    ["electrical"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the circuit card on your table.",
        "Keep the power switch off.",
      ]],
      ["safety", "POWER SAFETY", "safety", 4, [
        "Use only the switched battery holder.",
        "Keep each battery inside the holder.",
        "Switch off any warm holder.",
        "Report the warm holder to the teacher.",
      ]],
      ["plan", "PLAN THE SIGNAL", "work", 5, [
        "Choose one clear signal word.",
        "Draw one complete circuit path.",
        "Mark which way the long light leg faces.",
      ]],
      ["approval", "TEACHER CHECK", "safety", 2, [
        "Hold up your paper plan.",
        "Wait until the teacher says yes.",
        "Do not take a battery box yet.",
      ]],
      ["build", "BUILD THE CIRCUIT", "work", 7, [
        "Press copper tape along the path.",
        "Make each corner smooth.",
        "Place the LED in the marked direction.",
      ]],
      ["test", "POWER THE SIGNAL", "work", 5, [
        "Connect the holder leads to the marked points.",
        "Turn on the switch.",
        "Check the first place where the path breaks.",
      ]],
      ["message", "FINISH THE MESSAGE", "work", 4, [
        "Test the light three times.",
        "Add the signal word after success.",
      ]],
      ["cleanup", "POWER DOWN", "cleanup", 2, [
        "Turn off the switch.",
        "Return the holder by count.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Point to the complete circuit path.",
        "Name one repair you made.",
      ]],
    ],
  ),
  definePlan(
    10,
    "Cardboard Arcade",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one tabletop game card.",
        "Place tokens inside the play tray.",
      ]],
      ["safety", "GAME SAFETY", "safety", 3, [
        "Keep tokens inside the table boundary.",
        "Stop any part that pinches.",
        "Use no launcher.",
      ]],
      ["plan", "PLAN THE GAME", "work", 4, [
        "Write the game goal in one sentence.",
        "Sketch the token path.",
      ]],
      ["build", "BUILD THE GAME", "work", 9, [
        "Build the smallest playable version.",
        "Add one reliable cardboard connection.",
        "Make a clear start point.",
      ]],
      ["play", "PLAY TEST", "work", 7, [
        "Ask a partner to play without help.",
        "Watch the first confusing moment.",
        "Record one unreliable part.",
      ]],
      ["improve", "IMPROVE THE RESET", "work", 4, [
        "Change the confusing part.",
        "Reset the game twice.",
      ]],
      ["cleanup", "RESET THE ARCADE", "cleanup", 2, [
        "Count every token.",
        "Place the game on the storage shelf.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "State the goal.",
        "Show how the game resets.",
      ]],
    ],
  ),
  definePlan(
    11,
    "Hull Design",
    ["water"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place one foil sheet beside the tub.",
        "Count the cargo pieces.",
      ]],
      ["safety", "WATER SAFETY", "safety", 3, [
        "Keep water inside the tub.",
        "Wipe each spill with a towel.",
        "Keep electronics outside the wet zone.",
      ]],
      ["plan", "PLAN THE HULL", "work", 4, [
        "Sketch a wide sealed hull.",
        "Mark one likely weak point.",
      ]],
      ["shape", "SHAPE THE FOIL", "work", 8, [
        "Fold the edges above the water line.",
        "Press the bottom flat.",
        "Use no extra foil.",
      ]],
      ["float", "FLOAT AND LOAD", "work", 8, [
        "Place the hull on the water.",
        "Add one cargo piece at a time.",
        "Record the last safe total.",
      ]],
      ["improve", "RESHAPE THE HULL", "work", 5, [
        "Change one hull feature.",
        "Repeat the load test.",
      ]],
      ["cleanup", "DRY THE STATION", "cleanup", 2, [
        "Remove every cargo piece.",
        "Dry the table.",
      ]],
      ["exit", "EXIT CHECK", "exit", 2, [
        "Write the better cargo total.",
      ]],
    ],
  ),
  definePlan(
    12,
    "Cardboard Micro-Furniture",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one user card.",
        "Choose one classroom location.",
      ]],
      ["safety", "CUT SAFELY", "safety", 3, [
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
      ]],
      ["plan", "PLAN FOR THE USER", "work", 4, [
        "Draw the furniture feature.",
        "Label how the user reaches it.",
        "Mark the model size.",
      ]],
      ["build", "BUILD THE MODEL", "work", 9, [
        "Cut the planned cardboard shapes.",
        "Use two connection methods.",
        "Keep the model table sized.",
      ]],
      ["test", "TEST THE USER PATH", "work", 6, [
        "Move the paper user toward the model.",
        "Check the reach point.",
        "Check the model stability.",
      ]],
      ["improve", "REMOVE A PROBLEM", "work", 4, [
        "Change one blocked or weak feature.",
        "Repeat the user path.",
      ]],
      ["cleanup", "SORT THE MATERIALS", "cleanup", 3, [
        "Close the scissors.",
        "Return usable cardboard.",
        "Store the model flat.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Point to the user feature.",
        "Explain the problem you changed.",
      ]],
    ],
  ),
  definePlan(
    13,
    "Rube Machine",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one final task card.",
        "Place moving parts inside the table boundary.",
      ]],
      ["safety", "MOTION SAFETY", "safety", 3, [
        "Use only rolling tabletop parts.",
        "Keep hands outside a moving path.",
        "Stop any part that leaves the table.",
      ]],
      ["plan", "PLAN BACKWARD", "work", 5, [
        "Draw the final task first.",
        "Add three earlier steps.",
        "Mark where each part starts the next part.",
      ]],
      ["parts", "TEST EACH STEP", "work", 8, [
        "Build one step.",
        "Test that step one time.",
        "Fix the first part that does not work.",
      ]],
      ["connect", "CONNECT THE CHAIN", "work", 8, [
        "Join the tested steps.",
        "Try one full run.",
        "Fix the first place where motion stops.",
        "Try one more full run if time remains.",
      ]],
      ["cleanup", "RESET THE PARTS", "cleanup", 5, [
        "Stop every moving part.",
        "Sort parts into labeled bins.",
        "Remove tape scraps.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Circle the hardest move from one part to the next.",
        "Write the fix that worked.",
      ]],
    ],
  ),
  definePlan(
    14,
    "Human Program",
    [],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one short task card.",
        "Place the grid mat on the floor.",
      ]],
      ["safety", "ROBOT SAFETY", "safety", 3, [
        "Move only at walking speed.",
        "Stop at every obstacle.",
        "Stop when anyone says stop.",
      ]],
      ["write", "WRITE COMMANDS", "work", 5, [
        "Write one command per line.",
        "Use only approved command words.",
      ]],
      ["run", "RUN THE PROGRAM", "work", 7, [
        "Give the commands to the human robot.",
        "Watch each command run exactly.",
        "Mark the first wrong result.",
      ]],
      ["debug", "DEBUG ONE LINE", "work", 6, [
        "Rewrite the first wrong command.",
        "Run the complete program again.",
      ]],
      ["switch", "SWITCH ROLES", "work", 5, [
        "Choose a new human robot.",
        "Run the corrected program once.",
      ]],
      ["cleanup", "RESET THE GRID", "cleanup", 3, [
        "Stack the command cards.",
        "Roll the grid mat.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Copy the corrected command.",
        "Name the result it changed.",
      ]],
    ],
  ),
  definePlan(
    15,
    "Maze Coders",
    [],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place one maze card in the sleeve.",
        "Put the token on start.",
      ]],
      ["safety", "TOKEN SAFETY", "safety", 3, [
        "Keep the token on the grid.",
        "Pick up any dropped token at once.",
      ]],
      ["map", "MAP THE ROUTE", "work", 5, [
        "Mark the goal.",
        "Mark each blocked cell.",
        "Trace one possible route.",
      ]],
      ["code", "WRITE THE CODE", "work", 7, [
        "Write one command per box.",
        "Finish the full route before testing.",
      ]],
      ["test", "PARTNER TEST", "work", 6, [
        "Trade code with a partner.",
        "Run each command exactly.",
        "Mark the first error.",
      ]],
      ["debug", "DEBUG THE ROUTE", "work", 5, [
        "Change the first wrong command.",
        "Remove one extra command if possible.",
        "Run the route again.",
      ]],
      ["cleanup", "RESET THE MAZE", "cleanup", 3, [
        "Return the token.",
        "Erase the sleeve.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write the number of final commands.",
        "Circle the command you changed.",
      ]],
    ],
  ),
  definePlan(
    16,
    "Binary Beacons",
    ["electrical"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose two state cards.",
        "Place the beacon at table level.",
      ]],
      ["safety", "LIGHT SAFETY", "safety", 3, [
        "Keep every light pointed at the table.",
        "Turn off any light aimed near a face.",
        "Use only classroom-safe messages.",
      ]],
      ["key", "BUILD THE KEY", "work", 5, [
        "Assign a value to each state.",
        "Write the value in each number spot.",
        "Test one sample number.",
      ]],
      ["encode", "ENCODE A MESSAGE", "work", 7, [
        "Choose a short classroom message.",
        "Convert each symbol with the key.",
        "Place the states in order.",
      ]],
      ["send", "SEND THE STATES", "work", 6, [
        "Show one fixed position at a time.",
        "Pause between symbols.",
        "Let the partner record silently.",
      ]],
      ["check", "CHECK THE MESSAGE", "work", 5, [
        "Compare the partner answer with the original message.",
        "Correct one unclear state.",
      ]],
      ["cleanup", "POWER DOWN", "cleanup", 3, [
        "Turn off every light.",
        "Stack the state cards.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write one rule that prevented confusion.",
      ]],
    ],
  ),
  definePlan(
    17,
    "Conductivity Detectives",
    ["electrical"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the protected tester on the mat.",
        "Keep its power off.",
      ]],
      ["safety", "TESTER SAFETY", "safety", 4, [
        "Use only the teacher-approved battery tester.",
        "Test no outlet, liquid, device, jewelry, or person.",
        "Turn off a warm battery holder.",
        "Report warmth to the teacher.",
      ]],
      ["check", "CHECK THE TESTER", "work", 4, [
        "Test the known metal sample.",
        "Test the known plastic sample.",
        "Record both signals.",
      ]],
      ["samples", "TEST THE SAMPLES", "work", 7, [
        "Touch the tester tips to one coded sample.",
        "Record the signal.",
        "Classify the sample.",
        "Repeat for each code.",
      ]],
      ["trace", "TRACE THE BREAK", "work", 6, [
        "Study the broken-path card.",
        "Predict one broken connection.",
        "Test connections in order.",
      ]],
      ["repair", "REPAIR ONE BREAK", "work", 5, [
        "Repair only the confirmed break.",
        "Demonstrate the completed circuit.",
      ]],
      ["cleanup", "POWER DOWN", "cleanup", 3, [
        "Turn off the tester.",
        "Return every coded sample.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name the evidence that found the break.",
      ]],
    ],
  ),
  definePlan(
    18,
    "Moving Picture Machine",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose flip, wheel, or strip motion.",
        "Place the frame paper in order.",
      ]],
      ["safety", "FASTENER SAFETY", "safety", 3, [
        "Keep the device at table level.",
        "Use fasteners only through marked holes.",
        "Ask the teacher about a sharp fastener.",
      ]],
      ["plan", "PLAN THE MOTION", "work", 4, [
        "Draw a clear start pose.",
        "Draw a clear finish pose.",
        "Mark the matching dot.",
      ]],
      ["frames", "DRAW THE FRAMES", "work", 9, [
        "Change one small part per frame.",
        "Keep each drawing on the registration mark.",
        "Number the frames.",
      ]],
      ["assemble", "ASSEMBLE THE MOTION", "work", 7, [
        "Stack or attach the frames in order.",
        "Secure the approved fastener.",
        "Move the device slowly.",
      ]],
      ["revise", "SMOOTH THE MOTION", "work", 4, [
        "Find the largest visual jump.",
        "Revise one frame.",
        "Test at two speeds.",
      ]],
      ["cleanup", "SORT THE PIECES", "cleanup", 2, [
        "Return unused fasteners.",
        "Clip your frames together.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Show the finished motion once.",
        "Name the frame you changed.",
      ]],
    ],
  ),
  definePlan(
    19,
    "Cargo Sorter",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place mixed cargo in the starting cup.",
        "Choose two ending bins.",
      ]],
      ["safety", "SORTER SAFETY", "safety", 3, [
        "Keep fingers outside every moving path.",
        "Keep magnets away from electronics.",
        "Feed one cargo item at a time.",
      ]],
      ["plan", "PLAN THE SORT", "work", 4, [
        "Choose one sorting rule.",
        "Draw the travel path.",
        "Label both ending bins.",
      ]],
      ["build", "BUILD THE SORTER", "work", 9, [
        "Build the starting ramp.",
        "Add one part that sends pieces to a bin.",
        "Place the bins under the exits.",
      ]],
      ["test", "RUN THE BATCH", "work", 7, [
        "Feed one mixed item.",
        "Record its ending bin.",
        "Repeat for all test pieces.",
      ]],
      ["improve", "FIX THE ERRORS", "work", 4, [
        "Change the sorting part.",
        "Test all pieces again.",
      ]],
      ["cleanup", "RESET THE CARGO", "cleanup", 2, [
        "Count every cargo item.",
        "Return magnets to the marked box.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write the final error count.",
        "Name the sorting rule.",
      ]],
    ],
  ),
  definePlan(
    20,
    "Black Box Systems",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the sealed system on its mat.",
        "Open the data table.",
      ]],
      ["safety", "BLACK BOX SAFETY", "safety", 3, [
        "Keep the box sealed.",
        "Use only the approved test holes.",
        "Move the box gently.",
      ]],
      ["inputs", "CHOOSE TEST ACTIONS", "work", 4, [
        "List three safe test actions.",
        "Change only one test action at a time.",
      ]],
      ["test", "RUN CONTROLLED TESTS", "work", 8, [
        "Try the first test action.",
        "Measure the result.",
        "Record the matching action and result.",
        "Repeat each action once.",
      ]],
      ["model", "DRAW THE SYSTEM", "work", 7, [
        "Draw one possible inside system.",
        "Connect each test action to a result.",
        "Label the hidden parts.",
      ]],
      ["challenge", "CHALLENGE THE MODEL", "work", 5, [
        "Choose one test that could show the drawing is wrong.",
        "Run that test.",
        "Revise the drawing if needed.",
      ]],
      ["cleanup", "RESET THE BOX", "cleanup", 2, [
        "Remove every test piece.",
        "Return the sealed system.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write one claim about the hidden system.",
        "Cite one test result.",
      ]],
    ],
  ),
  definePlan(
    21,
    "Error-Proof Messages",
    [],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one symbol key.",
        "Place the channel envelope between teams.",
      ]],
      ["safety", "MESSAGE SAFETY", "safety", 3, [
        "Use no personal information.",
        "Use no secret information.",
        "Use respectful classroom words.",
      ]],
      ["encode", "ENCODE THE MESSAGE", "work", 5, [
        "Choose a short safe message.",
        "Convert it with the symbol key.",
        "Check every symbol once.",
      ]],
      ["protect", "ADD AN ERROR CHECK", "work", 7, [
        "Choose repeat, number-sum check, even-or-odd check, or pattern.",
        "Add the check to the message.",
        "Write the checking rule.",
      ]],
      ["channel", "SEND THROUGH NOISE", "work", 6, [
        "Give the message to the change team.",
        "Let the channel change one part.",
        "Receive the changed message.",
      ]],
      ["decode", "DETECT THE ERROR", "work", 5, [
        "Apply the checking rule.",
        "Mark the possible error.",
        "Decode the message.",
      ]],
      ["cleanup", "RESET THE CHANNEL", "cleanup", 3, [
        "Return every symbol card.",
        "Recycle used message strips.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name the error check.",
        "State whether it found the change.",
      ]],
    ],
  ),
  definePlan(
    22,
    "Accessibility Design Sprint",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one provided user card.",
        "Read the user goal aloud.",
      ]],
      ["safety", "DESIGN SAFELY", "safety", 4, [
        "Use only the facts on the user card.",
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
      ]],
      ["ideas", "NAME THE PROBLEM", "work", 5, [
        "Name the tool or space problem.",
        "Sketch three possible changes.",
        "Circle one idea.",
      ]],
      ["build", "BUILD ONE FEATURE", "work", 8, [
        "Cut only the planned shapes.",
        "Build the smallest useful feature.",
        "Add a large clear label.",
      ]],
      ["test", "RUN THE CARD TEST", "work", 6, [
        "Use the provided test card.",
        "Observe one access task.",
        "Record where the task stops.",
      ]],
      ["revise", "FIX THE PROBLEM", "work", 4, [
        "Change one blocked feature.",
        "Repeat the same card test.",
      ]],
      ["cleanup", "RESET THE SPRINT", "cleanup", 2, [
        "Close the scissors.",
        "Store the prototype with its card.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write what became easier.",
        "Write what remains difficult.",
      ]],
    ],
  ),
  definePlan(
    23,
    "Helping Hand",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Read one role card.",
        "Join the one shared educational prototype team.",
      ]],
      ["safety", "BUILD SAFELY", "safety", 4, [
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
        "Keep the prototype away from bodies.",
      ]],
      ["plan", "PLAN THE GRIP", "work", 5, [
        "Choose one lightweight test object.",
        "Sketch the handle.",
        "Sketch the moving connection.",
        "Mark the soft part that holds the object.",
      ]],
      ["build", "BUILD ONE SHARED PART", "work", 8, [
        "Do only the work on your role card.",
        "Put your finished work in the team tray.",
        "Show it to the build lead.",
      ]],
      ["test", "TEST ON THE STAND", "work", 6, [
        "The test team places the build on the test stand.",
        "The test team moves one approved object.",
        "The record team writes the result with no student name.",
      ]],
      ["improve", "IMPROVE CONTROL", "work", 4, [
        "The fix team changes one moving or soft part.",
        "The test team repeats the stand test.",
      ]],
      ["cleanup", "RESET THE BUILD", "cleanup", 2, [
        "Close the scissors.",
        "Store the shared prototype as one item.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name your role contribution.",
        "Cite one stand test result.",
      ]],
    ],
    {
      assistiveBoundary: {
        sharedPrototypeLimit: 1,
        educationalPrototypeOnly: true,
        studentPiiAllowed: false,
        medicalClaimsAllowed: false,
      },
      parallelRoles: defineParallelJobs([
        ["plan", "Plan Team", ["Draw the handle and moving parts."]],
        ["parts", "Parts Team", ["Sort approved parts into team trays."]],
        ["build", "Build Team", ["Build only the approved shared part."]],
        ["test", "Test Team", ["Use only the test stand and approved objects."]],
        ["fix", "Fix Team", ["Change one part after the test."]],
        ["record", "Record Team", ["Write results with no student names."]],
      ]),
    },
  ),
  definePlan(
    24,
    "Package Rescue",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one model product.",
        "Read the handling test card.",
      ]],
      ["safety", "PACKAGE SAFETY", "safety", 3, [
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
        "Throw no package.",
      ]],
      ["plan", "PLAN PROTECTION", "work", 4, [
        "Choose the travel problem most likely to happen.",
        "Mark spots that need padding.",
      ]],
      ["build", "BUILD THE PACKAGE", "work", 9, [
        "Cut only planned packaging pieces.",
        "Place protection at each marked zone.",
        "Stay inside the material limit.",
      ]],
      ["test", "RUN THE SEQUENCE", "work", 7, [
        "Run only the approved handling steps.",
        "Inspect the model product.",
        "Use the damage score card.",
      ]],
      ["improve", "REDUCE THE DAMAGE", "work", 4, [
        "Change one padded spot.",
        "Repeat the same handling sequence.",
      ]],
      ["cleanup", "RESET THE PACKAGE", "cleanup", 2, [
        "Close the scissors.",
        "Return the model product.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write the final damage score.",
        "Name the strongest protection feature.",
      ]],
    ],
  ),
  definePlan(
    25,
    "Upcycle Lab",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one inspected reclaimed object.",
        "Place it on the project mat.",
      ]],
      ["safety", "MATERIAL SAFETY", "safety", 3, [
        "Use only the approved clean object.",
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
      ]],
      ["purpose", "CHOOSE A NEW USE", "work", 5, [
        "List two useful object properties.",
        "Name one user.",
        "Write one new function.",
      ]],
      ["build", "BUILD THE NEW USE", "work", 8, [
        "Sketch the planned change.",
        "Cut only approved added material.",
        "Build the new function.",
      ]],
      ["test", "TEST THE FUNCTION", "work", 6, [
        "Run one clear use test.",
        "Record the result.",
        "Find one weak feature.",
      ]],
      ["improve", "IMPROVE THE USE", "work", 5, [
        "Change the weak feature.",
        "Repeat the use test.",
        "Prepare a before-and-after explanation.",
      ]],
      ["cleanup", "RESET THE LAB", "cleanup", 2, [
        "Close the scissors.",
        "Sort every unused material.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name the reused property.",
        "State the new function.",
      ]],
    ],
  ),
  definePlan(
    26,
    "Hydroponics Flow Lab",
    ["water", "cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the dry tray on the wet mat.",
        "Measure the test water.",
      ]],
      ["safety", "WET TOOL SAFETY", "safety", 4, [
        "Keep water inside the tray.",
        "Wipe each spill with a towel.",
        "Do not cut tubing yourself.",
        "Keep electronics away from the wet zone.",
      ]],
      ["plan", "PLAN THE FLOW", "work", 3, [
        "Draw the water cup.",
        "Draw the water path.",
        "Mark each plant spot and the end cup.",
      ]],
      ["build", "BUILD THE DRY MODEL", "work", 7, [
        "Mark the cut line on the tube.",
        "Give the tube to the teacher.",
        "Wait for the cut, then connect the tube path.",
        "Check every connection while dry.",
      ]],
      ["test", "RUN THE WATER", "work", 6, [
        "Pour the measured water into the water cup.",
        "Watch each plant spot.",
        "Measure the collected water.",
      ]],
      ["revise", "CHANGE THE FLOW", "work", 6, [
        "Change one slope, hole, or loose connection.",
        "Repeat with the same water amount.",
        "Record the new collected amount.",
      ]],
      ["cleanup", "DRY THE LAB", "cleanup", 4, [
        "Drain the tray into the sink bucket.",
        "Place wet parts on the drying tray.",
        "Dry the table and floor.",
      ]],
      ["exit", "EXIT CHECK", "exit", 2, [
        "Write the collected amount.",
        "Name the flow change.",
      ]],
    ],
  ),
  definePlan(
    27,
    "Stormwater Rescue",
    ["water", "cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the sloped tray on the wet mat.",
        "Measure the rain water.",
      ]],
      ["safety", "STORMWATER SAFETY", "safety", 4, [
        "Keep wet material inside the tray.",
        "Wipe each spill with a towel.",
        "Cut mesh only on the table.",
        "Keep fingers outside the cutting path.",
        "Taste no test material.",
      ]],
      ["baseline", "RUN THE FIRST TEST", "work", 5, [
        "Pour the measured rain from the marked height.",
        "Measure the water that leaves the tray.",
        "Mark where soil moved.",
      ]],
      ["build", "BUILD A RESCUE", "work", 6, [
        "Choose one problem location.",
        "Cut only the planned mesh piece.",
        "Build one helper that slows or moves the water.",
      ]],
      ["retest", "REPEAT THE RAIN", "work", 6, [
        "Pour the same water amount.",
        "Measure the water that leaves the tray.",
        "Mark where soil moved this time.",
      ]],
      ["revise", "IMPROVE THE RESCUE", "work", 3, [
        "Change one part of the helper.",
        "Predict the next result.",
      ]],
      ["cleanup", "CLEAN THE TRAY", "cleanup", 5, [
        "One table at a time, carry wet soil to the return tub.",
        "Place wet tools on the drying mat.",
        "Dry the tray and table.",
        "Wash hands when the teacher calls your table.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Compare both water amounts.",
        "Name the helpful feature.",
      ]],
    ],
  ),
  definePlan(
    28,
    "Micro:bit Sensor Station",
    ["electrical"],
    [
      ["ready", "GET READY", "ready", 5, [
        "Place the micro:bit beside the computer.",
        "Open the teacher starter file.",
        "Connect only the approved cable.",
        "Wait until the computer shows the board.",
      ]],
      ["safety", "DEVICE SAFETY", "safety", 4, [
        "Use only approved USB power.",
        "Connect no unknown device.",
        "Handle the board by its edges.",
        "Disconnect power when the teacher says stop.",
      ]],
      ["plan", "PLAN THE SENSOR", "work", 5, [
        "Choose one classroom condition.",
        "Write what the board will measure.",
        "Choose the number that turns the alert on.",
        "Choose a clear alert.",
      ]],
      ["program", "BUILD THE PROGRAM", "work", 6, [
        "Place the measure block first.",
        "Add the number check.",
        "Add the alert block.",
        "Transfer the program to the approved device.",
      ]],
      ["test", "TEST THREE VALUES", "work", 6, [
        "Test one number below the turn-on number.",
        "Test the turn-on number.",
        "Test one number above it.",
        "Record each alert.",
      ]],
      ["revise", "TUNE THE ALERT", "work", 3, [
        "Change the turn-on number or alert.",
        "Repeat the three tests.",
      ]],
      ["cleanup", "DISCONNECT SAFELY", "cleanup", 3, [
        "Stop the program.",
        "Unplug the USB cable by its connector.",
        "Return the board and cable to the tray.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "State the final turn-on number.",
        "Name one limit of the data.",
      ]],
    ],
    {
      fallbacks: {
        "paper-data-cards": defineFallback(
          28,
          "Use when a computer, cable, or micro:bit is not ready.",
          [
            ["paper-ready", "GET READY", "ready", 3, [
              "Place the paper code blocks on the mat.",
              "Pick up three sensor data cards.",
            ], ["Say: We can learn the same idea without a device."]],
            ["paper-safety", "KEEP PIECES SAFE", "safety", 4, [
              "Keep every paper block on the mat.",
              "Use no cable or device.",
              "Pick up dropped cards at once.",
            ], ["Show the paper input, check, and alert blocks."]],
            ["paper-plan", "PLAN THE ALERT", "work", 5, [
              "Pick one classroom condition.",
              "Pick the number that turns the alert on.",
              "Draw the alert.",
            ], ["Explain: The turn-on number is called the threshold."]],
            ["paper-build", "BUILD PAPER CODE", "work", 8, [
              "Place the measure block first.",
              "Place the number check next.",
              "Place the alert block last.",
              "Read the paper code aloud.",
            ], ["Check the block order with each team."]],
            ["paper-test", "TEST THREE CARDS", "work", 6, [
              "Read the first sensor data card.",
              "Run it through the paper code.",
              "Record the alert.",
              "Repeat for two more cards.",
            ], ["Model one data card before teams test."]],
            ["paper-revise", "FIX THE ALERT", "work", 4, [
              "Change the turn-on number or alert.",
              "Test the three cards again.",
            ], ["Ask whether the alert turns on too soon or too late."]],
            ["paper-cleanup", "RESET THE CARDS", "cleanup", 2, [
              "Sort the paper code blocks.",
              "Stack the sensor data cards.",
            ], ["Count both card sets."]],
            ["paper-exit", "EXIT CHECK", "exit", 3, [
              "Write the final turn-on number.",
              "Name one card that made the alert turn on.",
            ], ["Listen for one number and one matching test card."]],
          ],
        ),
      },
    },
  ),
  definePlan(
    29,
    "Mirror Maze",
    ["electrical"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the light at the fixed source mark.",
        "Keep the power off.",
      ]],
      ["safety", "LIGHT SAFETY", "safety", 4, [
        "Keep the light inside the table zone.",
        "Point no light toward a face.",
        "Point no reflection toward a window.",
        "Turn off the light before moving it.",
      ]],
      ["plan", "PREDICT THE PATH", "work", 4, [
        "Mark the source.",
        "Mark each checkpoint.",
        "Draw the expected light path.",
      ]],
      ["place", "PLACE THE MIRRORS", "work", 8, [
        "Set one plastic mirror in its stand.",
        "Match its angle to the drawing.",
        "Repeat for each mirror.",
      ]],
      ["test", "TRACE THE LIGHT", "work", 7, [
        "Turn on the fixed light.",
        "Trace the actual path on the grid.",
        "Mark the first missed checkpoint.",
      ]],
      ["adjust", "ADJUST THE ANGLES", "work", 4, [
        "Turn off the light.",
        "Adjust one mirror.",
        "Retest the full path.",
      ]],
      ["cleanup", "POWER DOWN", "cleanup", 2, [
        "Turn off the light.",
        "Return mirrors to the padded tray.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Draw the final path.",
        "Circle the changed mirror.",
      ]],
    ],
  ),
  definePlan(
    30,
    "Earthquake Platform",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place the platform on its boundary mat.",
        "Check the height rule.",
      ]],
      ["safety", "PLATFORM SAFETY", "safety", 3, [
        "Keep fingers outside the moving platform.",
        "Test only on the teacher signal.",
        "Stop any falling part.",
      ]],
      ["plan", "PLAN FOR SHAKING", "work", 4, [
        "Sketch the structure.",
        "Mark two likely weak joints.",
        "Check the required footprint.",
      ]],
      ["build", "BUILD THE STRUCTURE", "work", 9, [
        "Build the base inside the footprint.",
        "Reach the required height.",
        "Check every connection.",
      ]],
      ["test", "RUN THE SHAKE", "work", 7, [
        "Move hands behind the boundary.",
        "Run the standard shake sequence.",
        "Record movement or damage.",
      ]],
      ["improve", "STRENGTHEN ONE PART", "work", 4, [
        "Improve one weak connection.",
        "Repeat the same shake sequence.",
      ]],
      ["cleanup", "RESET THE PLATFORM", "cleanup", 2, [
        "Remove loose pieces from the platform.",
        "Sort reusable parts.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Compare both damage scores.",
        "Name the stronger feature.",
      ]],
    ],
  ),
  definePlan(
    31,
    "Outdoor Habitat Helper",
    ["outdoor", "cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Clip the site map to your board.",
        "Choose one observation zone.",
      ]],
      ["walk-out", "WALK OUT", "transition", 2, [
        "Walk with your habitat team.",
      ]],
      ["safety", "HABITAT SAFETY", "safety", 4, [
        "Observe wildlife without touching it.",
        "Leave nests, plants, droppings, or insects alone.",
        "Cut model parts only on the table.",
        "Keep fingers outside the cutting path.",
        "Install nothing outdoors.",
      ]],
      ["observe", "RECORD THE NEED", "work", 6, [
        "Record one habitat observation.",
        "Name one need supported by that evidence.",
        "Mark the location on the map.",
      ]],
      ["return", "RETURN INSIDE", "transition", 2, [
        "Walk back with your habitat team.",
        "Place the map at your seat.",
      ]],
      ["plan", "PLAN A HELPER", "work", 5, [
        "Choose one helper type.",
        "List one benefit.",
        "List one risk.",
        "List one maintenance need.",
      ]],
      ["build", "BUILD A SMALL MODEL", "work", 6, [
        "Cut only approved model pieces.",
        "Build the helper at table scale.",
        "Add one clear safety label.",
      ]],
      ["cleanup", "PACK THE MODEL", "cleanup", 3, [
        "Close the scissors.",
        "Place the model in the approval tray.",
      ]],
      ["exit", "EXIT CHECK", "exit", 4, [
        "Point to the evidence on your map.",
        "Explain why teacher approval is still needed.",
      ]],
    ],
    {
      fallbacks: {
        "indoor-weather": defineFallback(
          31,
          "Use when weather or air quality keeps the class inside.",
          [
            ["photo-ready", "GET READY", "ready", 3, [
              "Place the site map on your table.",
              "Pick up two habitat photo cards.",
            ], ["Say why the class is staying inside today."]],
            ["photo-safety", "LOOK WITH CARE", "safety", 4, [
              "Keep cards and tools on the table.",
              "Use only the photos as evidence.",
              "Make no claim about an animal you cannot see.",
            ], ["Model the difference between a clue and a guess."]],
            ["photo-observe", "FIND ONE CLUE", "work", 6, [
              "Look closely at both habitat photo cards.",
              "Write one thing you can see.",
              "Mark its place on the map.",
            ], ["Point out one visible clue without guessing."]],
            ["photo-need", "NAME ONE NEED", "work", 5, [
              "Use the clue to name one possible need.",
              "Write the word possible before the need.",
            ], ["Remind students that a photo cannot prove every need."]],
            ["photo-plan", "PLAN A HELPER", "work", 6, [
              "Draw one small helper.",
              "Write one good result.",
              "Write one possible problem.",
            ], ["Check that every plan helps without touching wildlife."]],
            ["photo-build", "BUILD A PAPER MODEL", "work", 5, [
              "Fold paper to make the helper.",
              "Use tape only where the plan shows.",
              "Add a clear safety label.",
            ], ["Approve paper models before tape is used."]],
            ["photo-cleanup", "RESET THE TABLE", "cleanup", 3, [
              "Stack the habitat photo cards.",
              "Return paper, tape, map, and pencil.",
              "Place the model in the approval tray.",
            ], ["Count the photo cards and maps."]],
            ["photo-exit", "EXIT CHECK", "exit", 3, [
              "Point to the clue in the photo.",
              "Name the teacher check needed before real use.",
            ], ["Listen for one clue and one approval need."]],
          ],
        ),
      },
    },
  ),
  definePlan(
    32,
    "Biomimicry Grabber",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one nature reference card.",
        "Place lightweight objects on the test mat.",
      ]],
      ["safety", "GRABBER SAFETY", "safety", 3, [
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
        "Test no body or live organism.",
      ]],
      ["plan", "COPY A STRATEGY", "work", 5, [
        "Name the nature trick.",
        "Name its useful function.",
        "Sketch a safe gripper.",
      ]],
      ["build", "BUILD THE GRABBER", "work", 8, [
        "Cut only planned cardboard shapes.",
        "Build the moving connection.",
        "Add a soft place that can hold an object.",
      ]],
      ["test", "TEST THREE OBJECTS", "work", 7, [
        "Grip the first approved object.",
        "Record the result.",
        "Repeat for two more objects.",
      ]],
      ["revise", "IMPROVE THE GRIP", "work", 4, [
        "Change one nature-inspired part.",
        "Repeat one failed object test.",
      ]],
      ["cleanup", "RESET THE GRABBER", "cleanup", 2, [
        "Close the scissors.",
        "Return every test object.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name the copied strategy.",
        "Cite one test result.",
      ]],
    ],
  ),
  definePlan(
    33,
    "Mystery Materials",
    ["water", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Place coded samples on the test mat.",
        "Open the data table.",
      ]],
      ["safety", "SAMPLE SAFETY", "safety", 3, [
        "Use only approved tests.",
        "Keep dropper water inside the tray.",
        "Wipe each spill with a towel.",
        "Taste or smell no sample.",
      ]],
      ["criteria", "CHOOSE SUCCESS RULES", "work", 5, [
        "Read the design need.",
        "Choose two things you can measure.",
        "Write the success levels.",
      ]],
      ["test-one", "RUN TEST ONE", "work", 7, [
        "Test one coded sample at a time.",
        "Measure the result.",
        "Record every code.",
      ]],
      ["test-two", "RUN TEST TWO", "work", 7, [
        "Use the second approved property test.",
        "Measure each sample again.",
        "Record every result.",
      ]],
      ["choose", "CHOOSE A MATERIAL", "work", 5, [
        "Compare all results with the success rules.",
        "Choose one coded sample.",
        "Reject one alternative with evidence.",
      ]],
      ["cleanup", "RESET THE SAMPLES", "cleanup", 2, [
        "Return every coded sample.",
        "Dry the test tray.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Write the chosen code.",
        "Cite two measured results.",
      ]],
    ],
  ),
  definePlan(
    34,
    "Fix, Remix, or Invent Studio",
    ["cutting", "tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose fix, remix, or invent.",
        "Read the matching safety card.",
      ]],
      ["safety", "STUDIO SAFETY", "safety", 4, [
        "Inspect every material before use.",
        "Cut only on the table.",
        "Keep fingers outside the cutting path.",
        "Carry scissors closed.",
        "Stop any unexpected hazard.",
      ]],
      ["goal", "SET THE TEST", "work", 4, [
        "Write the prompt.",
        "Write the rule you must follow.",
        "Define one success test.",
      ]],
      ["baseline", "RUN THE FIRST TEST", "work", 8, [
        "Build or inspect the first version.",
        "Run the success test.",
        "Record the most useful evidence.",
      ]],
      ["change", "MAKE ONE CHANGE", "work", 6, [
        "Choose one change because of the test result.",
        "Cut only the planned material.",
        "Complete the change.",
      ]],
      ["retest", "RETEST THE CHANGE", "work", 5, [
        "Repeat the same success test.",
        "Keep, revise, or reject the change.",
        "Record your reason.",
      ]],
      ["cleanup", "RESET THE STUDIO", "cleanup", 2, [
        "Close the scissors.",
        "Sort all reusable parts.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Compare the two test results.",
        "Name your next change.",
      ]],
    ],
  ),
  definePlan(
    35,
    "CIRC Showcase Builder",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Choose one approved prototype.",
        "Place its evidence beside it.",
      ]],
      ["safety", "DISPLAY SAFETY", "safety", 3, [
        "Display only a stable prototype.",
        "Remove every student name from evidence.",
        "Keep the visitor path clear.",
      ]],
      ["evidence", "CHOOSE THE EVIDENCE", "work", 5, [
        "Choose one meaningful design change.",
        "Choose one matching test result.",
        "Write a short caption.",
      ]],
      ["display", "BUILD THE DISPLAY", "work", 8, [
        "Place the need first.",
        "Place the prototype second.",
        "Place the evidence last.",
        "Add one visitor question.",
      ]],
      ["test", "TEST WITH A PARTNER", "work", 6, [
        "Ask a new partner to use the display.",
        "Give no extra explanation.",
        "Record the first confusing point.",
      ]],
      ["revise", "CLARIFY THE DISPLAY", "work", 5, [
        "Change one confusing label or position.",
        "Practice the safe reset.",
      ]],
      ["cleanup", "STORE THE EXHIBIT", "cleanup", 2, [
        "Return unused display tools.",
        "Place the exhibit in its marked space.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "State the design change.",
        "Cite the matching evidence.",
      ]],
    ],
  ),
  definePlan(
    36,
    "Demo Day",
    ["tool"],
    [
      ["ready", "GET READY", "ready", 3, [
        "Report to your assigned station.",
        "Read your role card.",
      ]],
      ["safety", "STATION SAFETY", "safety", 3, [
        "Operate only approved demonstrations.",
        "Keep every walkway clear.",
        "Pause any station that cannot reset safely.",
      ]],
      ["check", "CHECK THE STATION", "work", 4, [
        "Inspect the prototype.",
        "Check the visitor boundary.",
        "Practice the emergency pause.",
      ]],
      ["host", "HOST THE DEMO", "work", 9, [
        "Welcome the visitor.",
        "State the design need.",
        "Demonstrate the approved action.",
        "Show the evidence.",
      ]],
      ["rotate", "ROTATE THE ROLES", "work", 7, [
        "Reset after each visitor.",
        "Move to the next role card.",
        "Answer questions with evidence.",
        "Name a limit when needed.",
      ]],
      ["close", "CLOSE THE STATION", "work", 4, [
        "Thank the final visitor.",
        "Complete the last safe reset.",
      ]],
      ["cleanup", "RESTORE THE ROOM", "cleanup", 2, [
        "Return all role cards.",
        "Place every exhibit in storage position.",
      ]],
      ["exit", "EXIT CHECK", "exit", 3, [
        "Name one strong visitor moment.",
        "Write one improvement for next time.",
      ]],
    ],
  ),
];

function issue(code, path, detail) {
  return { code, path, detail };
}

function containsForbiddenDash(value) {
  return typeof value === "string" && /[\u2013\u2014]/.test(value);
}

export function validateExperienceTimingPlan(plan) {
  const errors = [];

  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return {
      ok: false,
      errors: [issue("plan-not-object", "plan", "Plan must be an object.")],
    };
  }

  const number = plan.projectNumber;
  if (!Number.isInteger(number)) {
    errors.push(issue("project-number-not-integer", "projectNumber", number));
  } else if (number < FIRST_PROJECT_NUMBER || number > LAST_PROJECT_NUMBER) {
    errors.push(issue("project-number-out-of-range", "projectNumber", number));
  }

  if (typeof plan.title !== "string" || plan.title.trim().length === 0) {
    errors.push(issue("title-required", "title", plan.title));
  } else if (containsForbiddenDash(plan.title)) {
    errors.push(issue("forbidden-dash", "title", plan.title));
  }

  if (plan.gradeBand !== "5-6") {
    errors.push(issue("grade-band-must-be-5-6", "gradeBand", plan.gradeBand));
  }

  if (plan.totalMinutes !== REQUIRED_TOTAL_MINUTES) {
    errors.push(issue("declared-total-must-be-35", "totalMinutes", plan.totalMinutes));
  }

  if (!Array.isArray(plan.safetyTags)) {
    errors.push(issue("safety-tags-not-array", "safetyTags", plan.safetyTags));
  } else {
    for (const [index, tag] of plan.safetyTags.entries()) {
      if (!VALID_SAFETY_TAGS.has(tag)) {
        errors.push(issue("unknown-safety-tag", `safetyTags.${index}`, tag));
      }
    }
  }

  if (!Array.isArray(plan.steps)) {
    errors.push(issue("steps-not-array", "steps", plan.steps));
    return { ok: false, errors };
  }

  if (plan.steps.length < 7 || plan.steps.length > 9) {
    errors.push(issue("step-count-must-be-7-to-9", "steps", plan.steps.length));
  }

  const ids = new Set();
  const expectedPrefix = Number.isInteger(number)
    ? `p${String(number).padStart(2, "0")}-`
    : null;
  let minuteTotal = 0;

  for (const [index, step] of plan.steps.entries()) {
    const path = `steps.${index}`;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      errors.push(issue("step-not-object", path, step));
      continue;
    }

    if (typeof step.id !== "string" || !/^p\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(step.id)) {
      errors.push(issue("step-id-invalid", `${path}.id`, step.id));
    } else {
      if (ids.has(step.id)) {
        errors.push(issue("duplicate-step-id", `${path}.id`, step.id));
      }
      ids.add(step.id);
      if (expectedPrefix && !step.id.startsWith(expectedPrefix)) {
        errors.push(issue("step-id-project-mismatch", `${path}.id`, step.id));
      }
    }

    if (
      typeof step.label !== "string" ||
      !/^[A-Z0-9 ]+$/.test(step.label) ||
      step.label.length > 24
    ) {
      errors.push(issue("step-label-invalid", `${path}.label`, step.label));
    }

    if (!VALID_KINDS.has(step.kind)) {
      errors.push(issue("step-kind-invalid", `${path}.kind`, step.kind));
    }

    if (!Number.isInteger(step.minutes) || step.minutes < 1) {
      errors.push(issue("step-minutes-invalid", `${path}.minutes`, step.minutes));
    } else {
      minuteTotal += step.minutes;
    }

    if (!Array.isArray(step.directions) || step.directions.length < 1 || step.directions.length > 5) {
      errors.push(issue("directions-count-must-be-1-to-5", `${path}.directions`, step.directions));
    } else {
      for (const [directionIndex, direction] of step.directions.entries()) {
        const directionPath = `${path}.directions.${directionIndex}`;
        if (typeof direction !== "string" || direction.length === 0 || direction !== direction.trim()) {
          errors.push(issue("direction-invalid", directionPath, direction));
        } else {
          if (direction.split(/\s+/).length > 18 || /[;\n\r]/.test(direction)) {
            errors.push(issue("direction-not-simple", directionPath, direction));
          }
          if (containsForbiddenDash(direction)) {
            errors.push(issue("forbidden-dash", directionPath, direction));
          }
        }
      }
    }

    if (!Array.isArray(step.teacherDirections)) {
      errors.push(issue("teacher-directions-not-array", `${path}.teacherDirections`, step.teacherDirections));
    } else if (step.teacherDirections.length > 4) {
      errors.push(issue("teacher-directions-count-must-be-0-to-4", `${path}.teacherDirections`, step.teacherDirections));
    } else {
      for (const [directionIndex, direction] of step.teacherDirections.entries()) {
        const directionPath = `${path}.teacherDirections.${directionIndex}`;
        if (typeof direction !== "string" || direction.length === 0 || direction !== direction.trim()) {
          errors.push(issue("teacher-direction-invalid", directionPath, direction));
        } else if (containsForbiddenDash(direction)) {
          errors.push(issue("forbidden-dash", directionPath, direction));
        }
      }
    }
  }

  if (minuteTotal !== REQUIRED_TOTAL_MINUTES) {
    errors.push(issue("step-minutes-must-total-35", "steps", minuteTotal));
  }

  const kinds = new Set(plan.steps.map((step) => step?.kind));
  for (const requiredKind of REQUIRED_KINDS) {
    if (!kinds.has(requiredKind)) {
      errors.push(issue("required-step-kind-missing", "steps", requiredKind));
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateExperienceTimingPlans(plans) {
  const errors = [];

  if (!Array.isArray(plans)) {
    return {
      ok: false,
      errors: [issue("plans-not-array", "plans", plans)],
    };
  }

  if (plans.length !== LAST_PROJECT_NUMBER) {
    errors.push(issue("plan-count-must-be-36", "plans", plans.length));
  }

  const counts = new Map();
  for (const [index, plan] of plans.entries()) {
    const result = validateExperienceTimingPlan(plan);
    for (const error of result.errors) {
      errors.push({ ...error, path: `plans.${index}.${error.path}` });
    }

    const number = plan?.projectNumber;
    if (Number.isInteger(number)) {
      counts.set(number, (counts.get(number) || 0) + 1);
    }
  }

  for (const [number, count] of counts.entries()) {
    if (number < FIRST_PROJECT_NUMBER || number > LAST_PROJECT_NUMBER) {
      if (!errors.some((error) => error.code === "project-number-out-of-range" && error.detail === number)) {
        errors.push(issue("project-number-out-of-range", "plans", number));
      }
    } else if (count > 1) {
      errors.push(issue("duplicate-project-number", "plans", number));
    }
  }

  for (let number = FIRST_PROJECT_NUMBER; number <= LAST_PROJECT_NUMBER; number += 1) {
    if (!counts.has(number)) {
      errors.push(issue("missing-project-number", "plans", number));
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidExperienceTimingPlans(plans) {
  const result = validateExperienceTimingPlans(plans);
  if (!result.ok) {
    const codes = [...new Set(result.errors.map((error) => error.code))];
    throw new TypeError(`Invalid experience timing plans: ${codes.join(", ")}`);
  }
  return plans;
}

assertValidExperienceTimingPlans(PLAN_DEFINITIONS);

export const EXPERIENCE_TIMING_PLANS = deepFreeze(PLAN_DEFINITIONS);

const PLAN_BY_PROJECT_NUMBER = new Map(
  EXPERIENCE_TIMING_PLANS.map((plan) => [plan.projectNumber, plan]),
);

export function getExperienceTimingPlan(projectNumber, selection) {
  if (
    !Number.isInteger(projectNumber) ||
    projectNumber < FIRST_PROJECT_NUMBER ||
    projectNumber > LAST_PROJECT_NUMBER
  ) {
    return null;
  }

  const plan = PLAN_BY_PROJECT_NUMBER.get(projectNumber) || null;
  if (!plan || selection === undefined) {
    return plan;
  }

  if (selection?.fallbackId) {
    const fallbackId = selection.fallbackId;
    const fallback = plan.fallbacks?.[fallbackId];
    if (!fallback) {
      return null;
    }

    const { fallbacks, ...sharedPlan } = plan;
    return deepFreeze({
      ...sharedPlan,
      activeFallbackId: fallbackId,
      fallbackReason: fallback.reason,
      steps: fallback.steps,
    });
  }

  if (projectNumber !== 2) {
    return plan;
  }

  const modeId = selection?.modeId;
  const modeVariant = plan.modeVariants?.[modeId];
  if (!modeVariant) {
    return null;
  }

  const { modeVariants, ...sharedPlan } = plan;
  return deepFreeze({
    ...sharedPlan,
    activeModeId: modeId,
    title: modeVariant.title ?? sharedPlan.title,
    safetyTags: modeVariant.safetyTags ?? sharedPlan.safetyTags,
    steps: modeVariant.steps,
    parallelJobs: modeVariant.parallelJobs,
    preservation: modeVariant.preservation,
  });
}
