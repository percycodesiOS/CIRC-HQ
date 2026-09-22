// Classroom lesson content. Class meetings, not calendar dates. No student records.
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const CIRC_YEAR_LESSONS = freeze([
  {
    "id": "circ-neuro",
    "title": "Neuro art and book checkout",
    "label": "Neuro art and book checkout",
    "objective": "I can join curved lines, round their corners, and follow our book-checkout routine.",
    "summary": "I can join curved lines, round their corners, and follow our book-checkout routine.",
    "materials": [
      "Watercolor paper",
      "Black drawing markers",
      "Washable color markers",
      "Class artwork trays",
      "Existing library books and checkout system"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Start with four lines and large spaces. Point to one successful rounded corner.",
      "Grade 6 CIRC Tank: Choose varied line widths and explain how one color choice supports the design.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Watercolor paper",
      "Black drawing markers",
      "Washable color markers",
      "Class artwork trays",
      "Existing library books and checkout system"
    ],
    "steps": [
      {
        "id": "p02-circ-neuro-ready",
        "label": "See our plan",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can join curved lines, round their corners, and follow our book-checkout routine."
        ]
      },
      {
        "id": "p02-circ-neuro-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-circ-neuro-demo",
        "label": "Watch the line",
        "kind": "work",
        "minutes": 4,
        "directions": [
          "Watch four curved lines cross.",
          "Turn one sharp corner into a smooth curve.",
          "Notice the large spaces left for color."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-circ-neuro-make",
        "label": "Draw and round",
        "kind": "work",
        "minutes": 13,
        "directions": [
          "Write your name and class on the back.",
          "Draw four to six crossing curves.",
          "Round the sharp corners. Add dry color if time allows."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Use this short, dry-art version with checkout. Save wet blending for another contact using the existing neuro guide."
        ]
      },
      {
        "id": "p02-circ-neuro-check",
        "label": "Choose your book",
        "kind": "work",
        "minutes": 10,
        "directions": [
          "Cap markers and place artwork in the class tray.",
          "When called, follow our library checkout routine.",
          "Return with your book and read quietly."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-circ-neuro-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-circ-neuro-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Point to one corner you rounded and show that your table is ready."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "circ-digitize",
    "title": "Turn artwork into a digital image",
    "label": "Turn artwork into a digital image",
    "objective": "I can capture a clear image, name it clearly, and check that another person can find it.",
    "summary": "I can capture a clear image, name it clearly, and check that another person can find it.",
    "materials": [
      "Existing school-approved camera or scanner",
      "Existing school device and approved storage",
      "Artwork",
      "Paper",
      "Pencils"
    ],
    "safety": "Follow the school's device and storage rules. Do not photograph people, student lists, or private information.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Capture one image. Use a teacher-provided naming pattern and point out one improvement.",
      "Grade 6 CIRC Tank: Compare two captures, select the clearer version, and explain the improvement.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Existing school-approved camera or scanner",
      "Existing school device and approved storage",
      "Artwork",
      "Paper",
      "Pencils"
    ],
    "steps": [
      {
        "id": "p02-circ-digitize-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can capture a clear image, name it clearly, and check that another person can find it."
        ]
      },
      {
        "id": "p02-circ-digitize-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-circ-digitize-demo",
        "label": "Watch and try",
        "kind": "safety",
        "minutes": 5,
        "directions": [
          "Watch a page being placed flat in good light.",
          "Compare a crooked image with a cropped, readable image.",
          "Watch the teacher save one example."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-circ-digitize-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Use the school-approved camera or scanner shown by your teacher.",
          "Capture only your artwork. Keep faces and private information outside the image.",
          "Save using the class code and project label shown on the board."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Hardware model is unknown. Demonstrate the actual device; do not invent its buttons. Paper planning completes the fallback."
        ]
      },
      {
        "id": "p02-circ-digitize-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Find your saved image again.",
          "Check the edges, direction, and readability.",
          "If no device is available, draw a paper preview and write its file label."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-circ-digitize-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-circ-digitize-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show a readable saved image, or a paper preview with a clear file label."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "circ-logo",
    "title": "Design a logo people can read",
    "label": "Design a logo people can read",
    "objective": "I can combine a simple symbol and readable lettering, then improve them after a quick test.",
    "summary": "I can combine a simple symbol and readable lettering, then improve them after a quick test.",
    "materials": [
      "Paper",
      "Pencils",
      "Erasers",
      "Rulers",
      "Shared markers",
      "Existing approved digital image tool if available"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use a provided word or product choice. Combine one symbol with clear lettering.",
      "Grade 6 CIRC Tank: Name the audience. Explain how the symbol, lettering, and contrast suit that audience.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Paper",
      "Pencils",
      "Erasers",
      "Rulers",
      "Shared markers",
      "Existing approved digital image tool if available"
    ],
    "steps": [
      {
        "id": "p02-circ-logo-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can combine a simple symbol and readable lettering, then improve them after a quick test."
        ]
      },
      {
        "id": "p02-circ-logo-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-circ-logo-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare a clear symbol with a crowded symbol.",
          "Look at the same logo large and small.",
          "Notice how light and dark areas help the words stand out."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-circ-logo-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Choose a class project or invented product.",
          "Sketch three small logo ideas.",
          "Choose one. Use a simple symbol and no more than three colors."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Paper is the complete default. Digital cleanup is optional and does not require a new account."
        ]
      },
      {
        "id": "p02-circ-logo-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Show the logo without explaining it.",
          "Ask what the viewer notices and reads first.",
          "Change one unclear detail and test again."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-circ-logo-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-circ-logo-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show your logo and name the change that made it clearer."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "circ-cardboard",
    "title": "Cardboard joins and careful cutting",
    "label": "Cardboard joins and careful cutting",
    "objective": "I can make a stable cardboard connection and test it before adding decoration.",
    "summary": "I can make a stable cardboard connection and test it before adding decoration.",
    "materials": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Teacher-prepared pieces if needed",
      "Optional approved ChompSaw station"
    ],
    "safety": "Scissors are the default. A ChompSaw station opens only after school approval and the exact machine demonstration.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Build one stable shape using a demonstrated connection.",
      "Grade 6 CIRC Tank: Compare two connection types and explain the tradeoff before choosing.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Teacher-prepared pieces if needed",
      "Optional approved ChompSaw station"
    ],
    "steps": [
      {
        "id": "p02-circ-cardboard-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can make a stable cardboard connection and test it before adding decoration."
        ]
      },
      {
        "id": "p02-circ-cardboard-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-circ-cardboard-demo",
        "label": "Watch and try",
        "kind": "safety",
        "minutes": 5,
        "directions": [
          "Watch the teacher cut away from the holding hand.",
          "Compare a tab, slot, and taped join.",
          "Watch the teacher test each join gently."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-circ-cardboard-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Sketch a small shape that stands by itself.",
          "Choose a tab, slot, or taped join.",
          "Cut with approved scissors or use teacher-prepared pieces. Assemble your shape."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "ChompSaw purchase and operating approval are not assumed. Follow its manual and supervision rules if supplied. Teacher handles knife cuts and hot glue."
        ]
      },
      {
        "id": "p02-circ-cardboard-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Place your shape on the table and test its balance.",
          "Change one weak join.",
          "Compare the first and improved versions."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-circ-cardboard-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-circ-cardboard-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show one stable connection and explain why it holds."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "circ-packaging",
    "title": "Make a package that protects",
    "label": "Make a package that protects",
    "objective": "I can protect a model product, test the package, and improve one weak point.",
    "summary": "I can protect a model product, test the package, and improve one weak point.",
    "materials": [
      "Reclaimed small boxes",
      "Clean cardboard",
      "Paper",
      "String",
      "Masking tape",
      "Model products",
      "Rulers",
      "Scissors",
      "Shared scale if available"
    ],
    "safety": "Only use the teacher's handling test. Do not throw packages or test near people or equipment.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Protect one simple object and show one before-and-after change.",
      "Grade 6 CIRC Tank: Compare protection, material use, and the user's opening experience.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Reclaimed small boxes",
      "Clean cardboard",
      "Paper",
      "String",
      "Masking tape",
      "Model products",
      "Rulers",
      "Scissors",
      "Shared scale if available"
    ],
    "steps": [
      {
        "id": "p02-circ-packaging-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can protect a model product, test the package, and improve one weak point."
        ]
      },
      {
        "id": "p02-circ-packaging-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-circ-packaging-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch a model product move inside a loose package.",
          "Notice padding, support, and an opening.",
          "Watch one teacher-approved handling test."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-circ-packaging-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Choose the reusable model product provided.",
          "Sketch a package that opens without damage.",
          "Build using a material limit shown by your teacher."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Reuse catalog lesson 24, Package Rescue. A vacuum former is not needed for this complete lesson."
        ]
      },
      {
        "id": "p02-circ-packaging-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Run the same gentle handling test twice.",
          "Check movement, damage, and ease of opening.",
          "Improve one weak point without adding unnecessary material."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-circ-packaging-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-circ-packaging-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Demonstrate how your package protects and opens, and explain one improvement."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "circ-resin-plan",
    "title": "Plan a small casting without pouring",
    "label": "Plan a small casting without pouring",
    "objective": "I can draw a useful small object, estimate its size, and compare possible materials.",
    "summary": "I can draw a useful small object, estimate its size, and compare possible materials.",
    "materials": [
      "Paper",
      "Pencils",
      "Rulers",
      "Calculators if available",
      "Empty dry mold or dimensioned drawing",
      "Teacher-cleared cured example or picture"
    ],
    "safety": "This lesson stays dry. Students do not mix, pour, heat, demold, or handle uncured resin.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use a rectangular practice drawing and teacher-supported measurements.",
      "Grade 6 CIRC Tank: Calculate the rectangular practice volume and explain why an irregular mold needs a different measurement method.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Paper",
      "Pencils",
      "Rulers",
      "Calculators if available",
      "Empty dry mold or dimensioned drawing",
      "Teacher-cleared cured example or picture"
    ],
    "steps": [
      {
        "id": "p02-circ-resin-plan-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can draw a useful small object, estimate its size, and compare possible materials."
        ]
      },
      {
        "id": "p02-circ-resin-plan-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-circ-resin-plan-demo",
        "label": "Watch and try",
        "kind": "safety",
        "minutes": 5,
        "directions": [
          "Look at a dry mold or its measured drawing.",
          "Identify the inside space that shapes the object.",
          "Compare a cardboard model with a teacher-cleared cured example or picture."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-circ-resin-plan-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Sketch a small token, tag, or game piece.",
          "Measure a rectangular practice cavity or its drawing.",
          "Use length, width, and depth to estimate its volume."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Only a small teacher trial is planned, pending the actual product, school procedure, and Home Depot. No student casting rollout is approved."
        ]
      },
      {
        "id": "p02-circ-resin-plan-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare making your design from cardboard and casting material.",
          "Name one reason for each choice.",
          "Improve the design using the teacher's size limit."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-circ-resin-plan-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-circ-resin-plan-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show a labeled design and explain why your chosen material fits its use."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-notice",
    "title": "Tank 1: Notice a useful problem",
    "label": "Tank 1: Notice a useful problem",
    "objective": "I can notice a real, manageable problem and explain who it affects.",
    "summary": "I can notice a real, manageable problem and explain who it affects.",
    "materials": [
      "Paper",
      "Pencils",
      "Teacher-approved problem pictures"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Choose from three teacher-provided classroom problems and draw the one you understand.",
      "Grade 6 CIRC Tank: Find and describe a specific user problem with one direct observation.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Paper",
      "Pencils",
      "Teacher-approved problem pictures"
    ],
    "steps": [
      {
        "id": "p02-tank-notice-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can notice a real, manageable problem and explain who it affects."
        ]
      },
      {
        "id": "p02-tank-notice-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-notice-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare a broad wish with one specific everyday problem.",
          "Notice who is affected and when it happens."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-notice-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Look at the approved classroom examples.",
          "List or sketch three small problems.",
          "Choose one that can be explored with classroom materials."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Do not identify classmates as problems. Model a practical task or object that could work better."
        ]
      },
      {
        "id": "p02-tank-notice-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Tell a partner who has the problem.",
          "Explain when it happens.",
          "Narrow any idea that needs money, machinery, or changes outside our control."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-notice-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-notice-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Complete: Someone needs help with this problem when this happens."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-listen",
    "title": "Tank 2: Listen before choosing",
    "label": "Tank 2: Listen before choosing",
    "objective": "I can ask a useful question and use the answer to improve my problem statement.",
    "summary": "I can ask a useful question and use the answer to improve my problem statement.",
    "materials": [
      "Paper",
      "Pencils",
      "Reusable user cards"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use teacher-provided questions and one user card or partner response.",
      "Grade 6 CIRC Tank: Ask an open follow-up and separate what was observed from what was assumed.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Paper",
      "Pencils",
      "Reusable user cards"
    ],
    "steps": [
      {
        "id": "p02-tank-listen-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can ask a useful question and use the answer to improve my problem statement."
        ]
      },
      {
        "id": "p02-tank-listen-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-listen-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare a leading question with an open question.",
          "Watch a short respectful interview."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-listen-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Prepare two questions about the task or object.",
          "Ask an approved partner, or use the teacher's user card.",
          "Record the useful answer with a short note or drawing."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Use in-class role-play or approved users. Do not contact outside people or record private information."
        ]
      },
      {
        "id": "p02-tank-listen-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare the answer with your first idea.",
          "Change the problem statement if needed.",
          "Ask whether you are describing a need or jumping to a solution."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-listen-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-listen-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Share one thing you learned from the user and what it changed."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-options",
    "title": "Tank 3: Try three ideas",
    "label": "Tank 3: Try three ideas",
    "objective": "I can sketch different solutions and choose one using a clear reason.",
    "summary": "I can sketch different solutions and choose one using a clear reason.",
    "materials": [
      "Paper",
      "Pencils",
      "Rulers",
      "Reusable criteria cards"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Draw two ideas independently, then create a third with a prompt or partner.",
      "Grade 6 CIRC Tank: Use two chosen criteria to compare all three ideas.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Paper",
      "Pencils",
      "Rulers",
      "Reusable criteria cards"
    ],
    "steps": [
      {
        "id": "p02-tank-options-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can sketch different solutions and choose one using a clear reason."
        ]
      },
      {
        "id": "p02-tank-options-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-options-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "See three different ways to solve one small problem.",
          "Compare usefulness, simplicity, and available materials."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-options-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Sketch three different solutions.",
          "Label the part that does the work.",
          "Circle one idea you can test with classroom materials."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-options-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Show the ideas to a partner.",
          "Name one strength and one concern for the chosen idea.",
          "Revise the sketch before building."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-options-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-options-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show three ideas and explain why one is the best first test."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-plan",
    "title": "Tank 4: Plan the first build",
    "label": "Tank 4: Plan the first build",
    "objective": "I can make a labeled plan and choose a small, testable first version.",
    "summary": "I can make a labeled plan and choose a small, testable first version.",
    "materials": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use a three-box plan: problem, sketch, and first test.",
      "Grade 6 CIRC Tank: Include a material limit, approximate dimensions, and a measurable success criterion.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays"
    ],
    "steps": [
      {
        "id": "p02-tank-plan-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can make a labeled plan and choose a small, testable first version."
        ]
      },
      {
        "id": "p02-tank-plan-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-plan-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch a sketch become a parts list.",
          "Separate essential working parts from decoration."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-plan-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Draw the first version from a useful view.",
          "Label its working parts and approximate sizes.",
          "Choose materials and agree on the first build jobs."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Limit each team to a small tray of materials. No shopping or new equipment is needed for the first prototype."
        ]
      },
      {
        "id": "p02-tank-plan-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Explain how a user will try the model.",
          "Remove any part that does not help the first test.",
          "Show the teacher your plan before collecting supplies."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-plan-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-plan-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show a labeled plan, short materials list, and one thing your model must do."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-joins",
    "title": "Tank 5: Practice the tricky part",
    "label": "Tank 5: Practice the tricky part",
    "objective": "I can practice one connection or moving part before using it in my prototype.",
    "summary": "I can practice one connection or moving part before using it in my prototype.",
    "materials": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Craft sticks",
      "String",
      "Paper fasteners",
      "Rubber bands"
    ],
    "safety": "Keep moving parts at table level. No launching or pinching tests. Use only teacher-approved tools.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Choose from two demonstrated mechanisms and improve one connection.",
      "Grade 6 CIRC Tank: Compare two mechanisms against the same job and select one using test evidence.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Craft sticks",
      "String",
      "Paper fasteners",
      "Rubber bands"
    ],
    "steps": [
      {
        "id": "p02-tank-joins-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can practice one connection or moving part before using it in my prototype."
        ]
      },
      {
        "id": "p02-tank-joins-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-joins-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch a tab, hinge, slider, or string pull.",
          "Identify where friction, looseness, or weakness could occur."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-joins-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Choose the hardest working part in your plan.",
          "Build a small practice sample using scrap.",
          "Try the movement or connection several times."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-joins-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Name the first weak or unreliable point.",
          "Change one feature.",
          "Keep the stronger sample as a reference."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-joins-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-joins-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Demonstrate your practice part and name the improvement."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-prototype",
    "title": "Tank 6: Build version one",
    "label": "Tank 6: Build version one",
    "objective": "I can build a rough model that shows my idea's main job.",
    "summary": "I can build a rough model that shows my idea's main job.",
    "materials": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Craft sticks",
      "String",
      "Paper fasteners"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Build one working feature with teacher support.",
      "Grade 6 CIRC Tank: Build a working feature within the agreed size and material limits.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Craft sticks",
      "String",
      "Paper fasteners"
    ],
    "steps": [
      {
        "id": "p02-tank-prototype-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can build a rough model that shows my idea's main job."
        ]
      },
      {
        "id": "p02-tank-prototype-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-prototype-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch the main working part being built first.",
          "Notice that a rough prototype can answer a useful question."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-prototype-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Build the essential working part from your plan.",
          "Add only the support needed to try it.",
          "Keep a sketch or picture of version one using the approved classroom method."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "A failed first attempt is useful evidence. Do not add decoration before the working part is testable."
        ]
      },
      {
        "id": "p02-tank-prototype-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Ask a partner to identify the model's job.",
          "Try the intended action once.",
          "Mark one feature that needs a test next time."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-prototype-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-prototype-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show version one doing its main job, or identify the exact part that needs repair."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-test-plan",
    "title": "Tank 7: Plan a fair test",
    "label": "Tank 7: Plan a fair test",
    "objective": "I can plan a repeatable test that checks what my design claims.",
    "summary": "I can plan a repeatable test that checks what my design claims.",
    "materials": [
      "Prototype",
      "Paper",
      "Pencils",
      "Ruler or timer if needed",
      "Reusable test objects"
    ],
    "safety": "Only conduct teacher-approved tests at table level. No people, valuables, or live animals are test objects.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use a teacher-provided test pattern and a simple works/not-yet record.",
      "Grade 6 CIRC Tank: Choose a numerical measure and a success threshold before testing.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "Paper",
      "Pencils",
      "Ruler or timer if needed",
      "Reusable test objects"
    ],
    "steps": [
      {
        "id": "p02-tank-test-plan-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can plan a repeatable test that checks what my design claims."
        ]
      },
      {
        "id": "p02-tank-test-plan-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-test-plan-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare two tests that change several things.",
          "Watch a fair test keep the object, starting point, and action consistent."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-test-plan-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Write or draw what the product claims to do.",
          "Choose one thing to count, measure, or observe.",
          "Plan three trials with the same starting conditions."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-test-plan-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Walk through the test without rushing.",
          "Ask a partner what must stay the same.",
          "Get the teacher's approval before the real trials."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-test-plan-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-test-plan-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Explain your test, what stays the same, and what result would count as success."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-testing",
    "title": "Tank 8: Test and record",
    "label": "Tank 8: Test and record",
    "objective": "I can run the same test three times and record what actually happens.",
    "summary": "I can run the same test three times and record what actually happens.",
    "materials": [
      "Prototype",
      "Approved test objects",
      "Paper",
      "Pencils",
      "Ruler or timer if needed"
    ],
    "safety": "Use the approved test only. Stop if a part breaks sharply or the setup becomes unstable.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use pictures, tally marks, or works/not-yet symbols for three trials.",
      "Grade 6 CIRC Tank: Use measured results and explain variation between the trials.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "Approved test objects",
      "Paper",
      "Pencils",
      "Ruler or timer if needed"
    ],
    "steps": [
      {
        "id": "p02-tank-testing-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can run the same test three times and record what actually happens."
        ]
      },
      {
        "id": "p02-tank-testing-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-testing-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch one trial from the same starting position.",
          "See a record include an unsuccessful result honestly."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-testing-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Reset the test to the agreed starting position.",
          "Run three trials and record each result.",
          "Keep the design unchanged until the trials are finished."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-testing-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare all three results.",
          "Point to the most useful pattern or failure.",
          "Choose one problem to fix next."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-testing-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-testing-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show three results and identify one specific design problem."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-revision",
    "title": "Tank 9: Improve one feature",
    "label": "Tank 9: Improve one feature",
    "objective": "I can use test evidence to change one feature and check whether it helps.",
    "summary": "I can use test evidence to change one feature and check whether it helps.",
    "materials": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Prototype",
      "Previous test record",
      "Approved test objects"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Change one feature and use the same simple test record.",
      "Grade 6 CIRC Tank: Compare the measurements and explain a tradeoff or remaining limitation.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Prototype",
      "Previous test record",
      "Approved test objects"
    ],
    "steps": [
      {
        "id": "p02-tank-revision-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can use test evidence to change one feature and check whether it helps."
        ]
      },
      {
        "id": "p02-tank-revision-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-revision-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare a design change with a decorative change.",
          "Trace one failed test to the part causing it."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-revision-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Choose one problem from your test record.",
          "Change the relevant shape, connection, or movement.",
          "Repeat the same three-trial test."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-revision-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare the old and new results.",
          "Keep the improvement or explain why you will undo it.",
          "Record what the evidence suggests next."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-revision-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-revision-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show one change you made after testing. Compare the results before and after."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-user-test",
    "title": "Tank 10: Let someone try",
    "label": "Tank 10: Let someone try",
    "objective": "I can watch a user try my idea and learn without coaching every move.",
    "summary": "I can watch a user try my idea and learn without coaching every move.",
    "materials": [
      "Prototype",
      "Paper",
      "Pencils",
      "Reusable feedback cards",
      "Scrap materials"
    ],
    "safety": "Use the approved classroom test. Do not test strength, comfort, or function on a person's body.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use two teacher-provided questions and one partner tryout.",
      "Grade 6 CIRC Tank: Separate observed behavior from opinions and justify the selected change.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "Paper",
      "Pencils",
      "Reusable feedback cards",
      "Scrap materials"
    ],
    "steps": [
      {
        "id": "p02-tank-user-test-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can watch a user try my idea and learn without coaching every move."
        ]
      },
      {
        "id": "p02-tank-user-test-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-user-test-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch a user receive one short instruction.",
          "Notice how the designer listens without taking over."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-user-test-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Tell an approved partner the product's job.",
          "Let the partner try it using the approved test.",
          "Record one clear action, one confusion, and one useful comment."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-user-test-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Ask what was easiest and hardest.",
          "Choose one change that would help the user.",
          "Try a quick paper or scrap version of that change."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-user-test-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-user-test-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Explain one user difficulty and the change you will make."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-materials",
    "title": "Tank 11: Use materials wisely",
    "label": "Tank 11: Use materials wisely",
    "objective": "I can choose materials that do the job while reducing unnecessary waste.",
    "summary": "I can choose materials that do the job while reducing unnecessary waste.",
    "materials": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Safe material samples",
      "Prototype",
      "Shared scale if available"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Compare two teacher-selected materials using a simple strength and waste check.",
      "Grade 6 CIRC Tank: Explain the tradeoff among performance, quantity, reuse, and finish.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Clean cardboard",
      "Paper",
      "Pencils",
      "Rulers",
      "Student scissors",
      "Masking tape",
      "Reusable trays",
      "Safe material samples",
      "Prototype",
      "Shared scale if available"
    ],
    "steps": [
      {
        "id": "p02-tank-materials-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can choose materials that do the job while reducing unnecessary waste."
        ]
      },
      {
        "id": "p02-tank-materials-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-materials-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare two materials doing the same small job.",
          "Notice what can be reused or made smaller."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-materials-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Sort the design's parts into essential and optional.",
          "Compare two suitable materials for one part.",
          "Improve that part without making the product harder to use."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Use qualitative comparisons if no scale exists. Do not invent purchase costs or environmental claims."
        ]
      },
      {
        "id": "p02-tank-materials-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Check that the main job still works.",
          "Count pieces or compare material size before and after.",
          "Sort useful scraps for another group."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-materials-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-materials-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show a useful material choice and explain what you saved or improved."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-brand-package",
    "title": "Tank 12: Name and package",
    "label": "Tank 12: Name and package",
    "objective": "I can communicate my product's purpose with a clear name, logo, and simple package.",
    "summary": "I can communicate my product's purpose with a clear name, logo, and simple package.",
    "materials": [
      "Prototype",
      "Paper",
      "Shared markers",
      "Reclaimed boxes",
      "Cardboard",
      "Tape",
      "Scissors",
      "Ruler"
    ],
    "safety": "Use the approved gentle handling test. No throwing or heated forming without a separate approved teacher station.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use one name, one symbol, and one short purpose statement.",
      "Grade 6 CIRC Tank: Connect branding and packaging choices to the user and test evidence.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "Paper",
      "Shared markers",
      "Reclaimed boxes",
      "Cardboard",
      "Tape",
      "Scissors",
      "Ruler"
    ],
    "steps": [
      {
        "id": "p02-tank-brand-package-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can communicate my product's purpose with a clear name, logo, and simple package."
        ]
      },
      {
        "id": "p02-tank-brand-package-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-brand-package-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare a readable product label with a crowded one.",
          "Watch a package protect the model and open easily."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-brand-package-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Choose a clear product name and reuse your logo skills.",
          "Make a label that tells the product's job.",
          "Create or improve a simple protective package."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be."
        ]
      },
      {
        "id": "p02-tank-brand-package-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Ask a partner to read the label without help.",
          "Check opening, fit, and the approved handling test.",
          "Revise one confusing or wasteful detail."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-brand-package-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-brand-package-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Show a readable product label and a package that opens and protects."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-pitch",
    "title": "Tank 13: Explain your idea",
    "label": "Tank 13: Explain your idea",
    "objective": "I can explain the problem, my solution, and evidence that helped me improve it.",
    "summary": "I can explain the problem, my solution, and evidence that helped me improve it.",
    "materials": [
      "Prototype",
      "Previous test record",
      "Index cards",
      "Pencils",
      "Product label"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use three picture prompts for a 30-45 second supported explanation.",
      "Grade 6 CIRC Tank: Use a roughly 60-second explanation with evidence, a design tradeoff, and a realistic next step.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "Previous test record",
      "Index cards",
      "Pencils",
      "Product label"
    ],
    "steps": [
      {
        "id": "p02-tank-pitch-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can explain the problem, my solution, and evidence that helped me improve it."
        ]
      },
      {
        "id": "p02-tank-pitch-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-pitch-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Hear a short pitch with a problem, idea, proof, and next step.",
          "Notice a speaker showing the product while explaining it."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-pitch-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Make four short cue cards or picture prompts.",
          "Choose one clear test result as proof.",
          "Prepare a simple demonstration of the product."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "No sales claims or money request is needed. A classroom pitch explains design decisions."
        ]
      },
      {
        "id": "p02-tank-pitch-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Tell the story to one partner.",
          "Ask the partner to repeat the main idea.",
          "Cut details that hide the problem, solution, or proof."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-pitch-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-pitch-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Give a short practice pitch that includes the problem, solution, and one piece of evidence."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-rehearse",
    "title": "Tank 14: Rehearse and refine",
    "label": "Tank 14: Rehearse and refine",
    "objective": "I can practice a clear presentation and improve it after specific feedback.",
    "summary": "I can practice a clear presentation and improve it after specific feedback.",
    "materials": [
      "Prototype",
      "Cue cards",
      "Existing classroom timer",
      "Reusable feedback cards",
      "Display surface"
    ],
    "safety": "Use teacher-approved materials and tools. Keep paths clear. Return tools before moving.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Use picture prompts and share speaking with a partner if needed.",
      "Grade 6 CIRC Tank: Stay near the agreed time and answer a question using evidence rather than guesses.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "Cue cards",
      "Existing classroom timer",
      "Reusable feedback cards",
      "Display surface"
    ],
    "steps": [
      {
        "id": "p02-tank-rehearse-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can practice a clear presentation and improve it after specific feedback."
        ]
      },
      {
        "id": "p02-tank-rehearse-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-rehearse-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch how speakers take turns and show their model on the table.",
          "Compare useful feedback with a vague compliment."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-rehearse-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Choose who will explain or demonstrate each part.",
          "Rehearse once while a partner times the explanation.",
          "Practice one likely question and an honest answer."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "Students may point, demonstrate, or use a partner. Speaking alone is not the only way to participate."
        ]
      },
      {
        "id": "p02-tank-rehearse-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Ask for one strength and one specific improvement.",
          "Change the unclear part.",
          "Rehearse again with a reliable reset."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-rehearse-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-rehearse-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Deliver your revised pitch and show how the product resets for the next visitor."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  },
  {
    "id": "tank-showcase",
    "title": "Tank 15: Share and reflect",
    "label": "Tank 15: Share and reflect",
    "objective": "I can show my design, listen to feedback, and explain how it changed.",
    "summary": "I can show my design, listen to feedback, and explain how it changed.",
    "materials": [
      "Prototype",
      "First sketch",
      "Test evidence",
      "Labels",
      "Existing display surfaces",
      "Paper",
      "Pencils"
    ],
    "safety": "Keep demonstrations at the approved stations. Reset loose parts and walk between displays.",
    "teacherContext": [
      "Grade 5 CIRC Tank Jr: Show the first and final versions and describe one improvement.",
      "Grade 6 CIRC Tank: Explain a supported improvement, remaining limitation, and next test.",
      "Teacher-led classroom work. No new student account, grade, or online assignment is required.",
      "Keep student names off public screens. Use class storage codes for shared work."
    ],
    "fastFinish": "Improve the same work or rehearse your explanation. Ask before taking more materials.",
    "gradeBand": "5-6",
    "supplies": [
      "Prototype",
      "First sketch",
      "Test evidence",
      "Labels",
      "Existing display surfaces",
      "Paper",
      "Pencils"
    ],
    "steps": [
      {
        "id": "p02-tank-showcase-ready",
        "label": "Get ready",
        "kind": "ready",
        "minutes": 2,
        "directions": [
          "Read today's goal.",
          "Look at the example."
        ],
        "teacherDirections": [
          "Say today's goal in plain words: I can show my design, listen to feedback, and explain how it changed."
        ]
      },
      {
        "id": "p02-tank-showcase-connect",
        "label": "Tell your partner",
        "kind": "transition",
        "minutes": 1,
        "directions": [
          "Tell your partner one useful detail."
        ],
        "teacherDirections": [
          "Listen for one useful observation. Connect it to today's demonstration."
        ]
      },
      {
        "id": "p02-tank-showcase-demo",
        "label": "Watch and try",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Watch a visitor approach, hear a short pitch, and ask one question.",
          "Notice how the presenter resets the space."
        ],
        "teacherDirections": [
          "Model the demonstration actions with one example. Show the unfinished stage, not only a polished result."
        ]
      },
      {
        "id": "p02-tank-showcase-make",
        "label": "Make it work",
        "kind": "work",
        "minutes": 17,
        "directions": [
          "Set out the prototype, label, and one piece of test evidence.",
          "Take turns presenting and visiting other teams.",
          "Give one useful observation and one respectful question."
        ],
        "teacherDirections": [
          "Pause each group early. Ask what its next useful action will be.",
          "This is an in-class share unless a separate audience or event has been approved. Do not promise outside visitors."
        ]
      },
      {
        "id": "p02-tank-showcase-check",
        "label": "Check one thing",
        "kind": "work",
        "minutes": 5,
        "directions": [
          "Compare your first sketch with your final version.",
          "Choose the most useful change.",
          "Name one thing you would test next."
        ],
        "teacherDirections": [
          "Ask for the evidence named in this check. Give one specific next step."
        ]
      },
      {
        "id": "p02-tank-showcase-cleanup",
        "label": "Reset together",
        "kind": "cleanup",
        "minutes": 3,
        "directions": [
          "Return tools and reusable pieces.",
          "Label your work with the class storage code.",
          "Clear your table and floor."
        ],
        "teacherDirections": [
          "Call tool returns first. Check table trays and keep unfinished work for the next contact."
        ]
      },
      {
        "id": "p02-tank-showcase-exit",
        "label": "Show your result",
        "kind": "exit",
        "minutes": 2,
        "directions": [
          "Explain how evidence changed your design and identify a sensible next test."
        ],
        "teacherDirections": [
          "Listen or look for the stated result. Accept a spoken explanation or a pointing demonstration."
        ]
      }
    ]
  }
]);
export const CIRC_YEAR_ROUTE = freeze([
  {
    "contact": 1,
    "title": "Neuro art and book checkout",
    "lessonId": "circ-neuro",
    "purpose": "I can join curved lines, round their corners, and follow our book-checkout routine.",
    "projectNumber": 2,
    "modeId": "circ-neuro"
  },
  {
    "contact": 2,
    "title": "Turn artwork into a digital image",
    "lessonId": "circ-digitize",
    "purpose": "I can capture a clear image, name it clearly, and check that another person can find it.",
    "projectNumber": 2,
    "modeId": "circ-digitize"
  },
  {
    "contact": 3,
    "title": "Design a logo people can read",
    "lessonId": "circ-logo",
    "purpose": "I can combine a simple symbol and readable lettering, then improve them after a quick test.",
    "projectNumber": 2,
    "modeId": "circ-logo"
  },
  {
    "contact": 4,
    "title": "Cardboard joins and careful cutting",
    "lessonId": "circ-cardboard",
    "purpose": "I can make a stable cardboard connection and test it before adding decoration.",
    "projectNumber": 2,
    "modeId": "circ-cardboard"
  },
  {
    "contact": 5,
    "title": "Make a package that protects",
    "lessonId": "circ-packaging",
    "purpose": "I can protect a model product, test the package, and improve one weak point.",
    "projectNumber": 2,
    "modeId": "circ-packaging"
  },
  {
    "contact": 6,
    "title": "Plan a small casting without pouring",
    "lessonId": "circ-resin-plan",
    "purpose": "I can draw a useful small object, estimate its size, and compare possible materials.",
    "projectNumber": 2,
    "modeId": "circ-resin-plan"
  },
  {
    "contact": 7,
    "title": "Tank 1: Notice a useful problem",
    "lessonId": "tank-notice",
    "purpose": "I can notice a real, manageable problem and explain who it affects.",
    "projectNumber": 2,
    "modeId": "tank-notice"
  },
  {
    "contact": 8,
    "title": "Tank 2: Listen before choosing",
    "lessonId": "tank-listen",
    "purpose": "I can ask a useful question and use the answer to improve my problem statement.",
    "projectNumber": 2,
    "modeId": "tank-listen"
  },
  {
    "contact": 9,
    "title": "Tank 3: Try three ideas",
    "lessonId": "tank-options",
    "purpose": "I can sketch different solutions and choose one using a clear reason.",
    "projectNumber": 2,
    "modeId": "tank-options"
  },
  {
    "contact": 10,
    "title": "Tank 4: Plan the first build",
    "lessonId": "tank-plan",
    "purpose": "I can make a labeled plan and choose a small, testable first version.",
    "projectNumber": 2,
    "modeId": "tank-plan"
  },
  {
    "contact": 11,
    "title": "Tank 5: Practice the tricky part",
    "lessonId": "tank-joins",
    "purpose": "I can practice one connection or moving part before using it in my prototype.",
    "projectNumber": 2,
    "modeId": "tank-joins"
  },
  {
    "contact": 12,
    "title": "Tank 6: Build version one",
    "lessonId": "tank-prototype",
    "purpose": "I can build a rough model that shows my idea's main job.",
    "projectNumber": 2,
    "modeId": "tank-prototype"
  },
  {
    "contact": 13,
    "title": "Tank 7: Plan a fair test",
    "lessonId": "tank-test-plan",
    "purpose": "I can plan a repeatable test that checks what my design claims.",
    "projectNumber": 2,
    "modeId": "tank-test-plan"
  },
  {
    "contact": 14,
    "title": "Tank 8: Test and record",
    "lessonId": "tank-testing",
    "purpose": "I can run the same test three times and record what actually happens.",
    "projectNumber": 2,
    "modeId": "tank-testing"
  },
  {
    "contact": 15,
    "title": "Tank 9: Improve one feature",
    "lessonId": "tank-revision",
    "purpose": "I can use test evidence to change one feature and check whether it helps.",
    "projectNumber": 2,
    "modeId": "tank-revision"
  },
  {
    "contact": 16,
    "title": "Tank 10: Let someone try",
    "lessonId": "tank-user-test",
    "purpose": "I can watch a user try my idea and learn without coaching every move.",
    "projectNumber": 2,
    "modeId": "tank-user-test"
  },
  {
    "contact": 17,
    "title": "Tank 11: Use materials wisely",
    "lessonId": "tank-materials",
    "purpose": "I can choose materials that do the job while reducing unnecessary waste.",
    "projectNumber": 2,
    "modeId": "tank-materials"
  },
  {
    "contact": 18,
    "title": "Tank 12: Name and package",
    "lessonId": "tank-brand-package",
    "purpose": "I can communicate my product's purpose with a clear name, logo, and simple package.",
    "projectNumber": 2,
    "modeId": "tank-brand-package"
  },
  {
    "contact": 19,
    "title": "Tank 13: Explain your idea",
    "lessonId": "tank-pitch",
    "purpose": "I can explain the problem, my solution, and evidence that helped me improve it.",
    "projectNumber": 2,
    "modeId": "tank-pitch"
  },
  {
    "contact": 20,
    "title": "Tank 14: Rehearse and refine",
    "lessonId": "tank-rehearse",
    "purpose": "I can practice a clear presentation and improve it after specific feedback.",
    "projectNumber": 2,
    "modeId": "tank-rehearse"
  },
  {
    "contact": 21,
    "title": "Tank 15: Share and reflect",
    "lessonId": "tank-showcase",
    "purpose": "I can show my design, listen to feedback, and explain how it changed.",
    "projectNumber": 2,
    "modeId": "tank-showcase"
  },
  {
    "contact": 22,
    "title": "Outdoor Microclimate Map",
    "projectNumber": 6,
    "purpose": "Observe and compare outdoor places. Thermometers are optional."
  },
  {
    "contact": 23,
    "title": "Seed Travelers",
    "projectNumber": 7,
    "purpose": "Test a seed-inspired carrier with shared test stations."
  },
  {
    "contact": 24,
    "title": "Paper Bridge",
    "projectNumber": 5,
    "purpose": "Compare a small structure using the same reusable loads."
  },
  {
    "contact": 25,
    "title": "Moving Picture Machine",
    "projectNumber": 18,
    "purpose": "Make and revise a short paper animation."
  },
  {
    "contact": 26,
    "title": "Hydroponics Flow Lab",
    "projectNumber": 26,
    "purpose": "Test a gravity-fed water model, not a purchased growing installation."
  },
  {
    "contact": 27,
    "title": "Stormwater Rescue",
    "projectNumber": 27,
    "purpose": "Use shared trays to compare runoff before and after one change."
  },
  {
    "contact": 28,
    "title": "Micro:bit Sensor Station",
    "projectNumber": 28,
    "purpose": "Use existing approved devices or the complete paper-code fallback."
  },
  {
    "contact": 29,
    "title": "Cardboard Arcade",
    "projectNumber": 10,
    "purpose": "Combine the year's connection and testing skills in a compact game."
  },
  {
    "contact": 30,
    "title": "Tech Terrarium",
    "projectNumber": 2,
    "purpose": "Make a teacher-approved shared contribution while preserving the existing habitat.",
    "modeId": "refresh-existing"
  },
  {
    "contact": 31,
    "title": "Reflect, reset, and catch up",
    "projectNumber": 36,
    "purpose": "Use Demo Day reflection and reset, or complete a missed core contact."
  }
]);
export function getCircYearLesson(id) { return CIRC_YEAR_LESSONS.find(lesson => lesson.id === id) ?? null; }
