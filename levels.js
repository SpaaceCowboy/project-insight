// Stable array positions preserve saved progress.
const CORE_LEVELS = [
  {
    "world": 1,
    "name": "The First Turn",
    "desc": "Learn the two primitive directions. One red wants vertical lanes; blue wants horizontal lanes.",
    "target": [
      "RB",
      "RB"
    ],
    "start": [
      "BR",
      "RB"
    ],
    "par": 1,
    "tag": "basics",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        1,
        0
      ],
      [
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Opposite Corners",
    "desc": "A single wrong corner can force a second swap. Watch which tile is actually allowed to move.",
    "target": [
      "BR",
      "BR"
    ],
    "start": [
      "RR",
      "BB"
    ],
    "par": 2,
    "tag": "basics",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        1
      ],
      [
        0,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "Two by Three",
    "desc": "More room, same rules. The extra column creates a real choice of route.",
    "target": [
      "RBR",
      "BRB"
    ],
    "start": [
      "RBB",
      "BRR"
    ],
    "par": 1,
    "tag": "basics",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "False Shortcut",
    "desc": "The visually closest tile is not always the tile that can legally move.",
    "target": [
      "RBR",
      "BRB"
    ],
    "start": [
      "RRB",
      "BBR"
    ],
    "par": 2,
    "tag": "basics",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        0,
        1
      ],
      [
        0,
        1,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Cross Current",
    "desc": "Swap the lower Blue horizontally to complete the alternating columns.",
    "target": [
      "RBR",
      "RBR"
    ],
    "start": [
      "RBR",
      "BRR"
    ],
    "par": 1,
    "tag": "basics",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "The Long Pair",
    "desc": "Identical colors are interchangeable. Plan which tile initiates each swap to create the target lanes.",
    "target": [
      "RBRB",
      "RBRB"
    ],
    "start": [
      "BRRB",
      "BBRR"
    ],
    "par": 4,
    "tag": "basics",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        0
      ],
      [
        1,
        2,
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Vertical Trap",
    "desc": "A red at the edge may need to move away from its final place first.",
    "target": [
      "RB",
      "RB",
      "RB"
    ],
    "start": [
      "RR",
      "BR",
      "BB"
    ],
    "par": 4,
    "tag": "basics",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        1,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Horizontal Trap",
    "desc": "One horizontal Blue swap restores the repeated target rows.",
    "target": [
      "BR",
      "BR",
      "BR"
    ],
    "start": [
      "BR",
      "RB",
      "BR"
    ],
    "par": 1,
    "tag": "basics",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0
      ],
      [
        0,
        1
      ],
      [
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Green Enters",
    "desc": "Green may only use the rising diagonal. The board now has three directions.",
    "target": [
      "RBG",
      "RBG",
      "RBG"
    ],
    "start": [
      "BRG",
      "GRG",
      "RBB"
    ],
    "par": 6,
    "tag": "green",
    "intro": "Green ↗↙ joins the board.",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        0,
        2,
        0
      ],
      [
        0,
        2,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "Diagonal Door",
    "desc": "A diagonal swap opens a horizontal move that did not exist one second earlier.",
    "target": [
      "GBR",
      "GBR",
      "GBR"
    ],
    "start": [
      "GGR",
      "RGR",
      "BBB"
    ],
    "par": 5,
    "tag": "green",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        1,
        1,
        1
      ],
      [
        0,
        0,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "Three-Way Weave",
    "desc": "Think in pairs: the move you make now changes who your next legal neighbors can be.",
    "target": [
      "GBRG",
      "BRGB"
    ],
    "start": [
      "RGBR",
      "GBBG"
    ],
    "par": 6,
    "tag": "green",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        0,
        1,
        2
      ],
      [
        0,
        1,
        1,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Green Between",
    "desc": "Place green at the center without trapping the reds around it.",
    "target": [
      "RBG",
      "RBG",
      "RBG"
    ],
    "start": [
      "RGB",
      "BGG",
      "RRB"
    ],
    "par": 4,
    "tag": "green",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        0,
        1
      ],
      [
        1,
        0,
        0
      ],
      [
        0,
        1,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "Mirror Without Symmetry",
    "desc": "The target looks mirrored. The correct route does not need to be.",
    "target": [
      "RBG",
      "RBG",
      "RBG"
    ],
    "start": [
      "BRB",
      "RGB",
      "GRG"
    ],
    "par": 5,
    "tag": "green",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        0,
        0,
        1
      ],
      [
        2,
        1,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Yellow Arrives",
    "desc": "Yellow uses the opposite diagonal. Read the arrow, not the color.",
    "target": [
      "RBG",
      "YRB",
      "GYR"
    ],
    "start": [
      "YRB",
      "YBG",
      "RGR"
    ],
    "par": 6,
    "tag": "yellow",
    "intro": "Yellow ↖↘ joins the board.",
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        1,
        1
      ],
      [
        1,
        1,
        0
      ],
      [
        2,
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Four Directions",
    "desc": "Four directional tiles now share one tiny geometry.",
    "target": [
      "BGY",
      "RBG",
      "YRB"
    ],
    "start": [
      "YRG",
      "YRB",
      "BGB"
    ],
    "par": 7,
    "tag": "yellow",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        0,
        1
      ],
      [
        1,
        1,
        1
      ],
      [
        1,
        1,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "The Diagonal Gate",
    "desc": "Only one of the two diagonal colors can unlock the center at the right time.",
    "target": [
      "RGYB",
      "RGYB"
    ],
    "start": [
      "RBYG",
      "BYGR"
    ],
    "par": 8,
    "tag": "yellow",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        2,
        1,
        2
      ],
      [
        3,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Interference",
    "desc": "Every color is both a destination and a moving obstacle.",
    "target": [
      "GRY",
      "BGR",
      "YBG"
    ],
    "start": [
      "GYR",
      "GBY",
      "BGR"
    ],
    "par": 6,
    "tag": "yellow",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        1,
        1
      ],
      [
        0,
        1,
        0
      ],
      [
        1,
        1,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "Corner Pressure",
    "desc": "The corner pieces are deliberately difficult to reach directly.",
    "target": [
      "GBR",
      "YGB",
      "RYG"
    ],
    "start": [
      "GGB",
      "RBY",
      "GRY"
    ],
    "par": 7,
    "tag": "yellow",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        1
      ],
      [
        1,
        1,
        0
      ],
      [
        1,
        2,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "The Exact Pattern",
    "desc": "No partial credit: every tile has one exact final place.",
    "target": [
      "YGBR",
      "YGBR"
    ],
    "start": [
      "YBRB",
      "RGGY"
    ],
    "par": 8,
    "tag": "yellow",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        2,
        0,
        1
      ],
      [
        0,
        0,
        2,
        3
      ]
    ]
  },
  {
    "world": 1,
    "name": "White Space",
    "desc": "White cannot move on its own. It becomes a passenger in someone else’s move.",
    "target": [
      "RBW",
      "GYR",
      "BWG"
    ],
    "start": [
      "WGW",
      "BRR",
      "BYG"
    ],
    "par": 5,
    "tag": "white",
    "intro": "White is passive.",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        0,
        2,
        0
      ],
      [
        0,
        2,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Quiet Passenger",
    "desc": "Treat white as an object you can relocate, never as a move you can initiate.",
    "target": [
      "BRG",
      "YWB",
      "RGY"
    ],
    "start": [
      "YGW",
      "RBY",
      "RBG"
    ],
    "par": 8,
    "tag": "white",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        2,
        1,
        0
      ],
      [
        1,
        2,
        1
      ],
      [
        0,
        0,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "White Corridor",
    "desc": "The passive tile creates a tempting move that belongs to a different color.",
    "target": [
      "BRWB",
      "RWBR"
    ],
    "start": [
      "BRRB",
      "RBWW"
    ],
    "par": 4,
    "tag": "white",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        2
      ],
      [
        0,
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Room to Breathe",
    "desc": "A second white changes the problem from routing to planning.",
    "target": [
      "RBG",
      "YWR",
      "BGY"
    ],
    "start": [
      "RBG",
      "BRG",
      "YYW"
    ],
    "par": 5,
    "tag": "white",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        1,
        1,
        1
      ],
      [
        1,
        1,
        0
      ]
    ]
  },
  {
    "world": 1,
    "name": "Last Lesson",
    "desc": "Mix everything learned so far on a compact board.",
    "target": [
      "BWR",
      "GYB",
      "WRG"
    ],
    "start": [
      "WRB",
      "BGR",
      "GWY"
    ],
    "par": 7,
    "tag": "white",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        2,
        0
      ],
      [
        1,
        1,
        1
      ],
      [
        1,
        0,
        1
      ]
    ]
  },
  {
    "world": 1,
    "name": "Foundations",
    "desc": "The first world ends with a deceptively small board and a surprisingly long route.",
    "target": [
      "BRWG",
      "YBRW"
    ],
    "start": [
      "RRBB",
      "YWGW"
    ],
    "par": 5,
    "tag": "white",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        1,
        2,
        1
      ],
      [
        0,
        0,
        1,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Bent Line",
    "desc": "A three-cell corner means direction matters more than distance.",
    "target": [
      "R..",
      "BG.",
      "..."
    ],
    "start": [
      "G..",
      "RB.",
      "..."
    ],
    "par": 2,
    "tag": "shapes",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        1,
        1,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "The Hook",
    "desc": "A hooked corridor turns one legal swap into a positional commitment.",
    "target": [
      "R.GY",
      "B.RG",
      "YB..",
      "...."
    ],
    "start": [
      "B.RG",
      "R.YG",
      "YB..",
      "...."
    ],
    "par": 3,
    "tag": "shapes",
    "intro": "",
    "solution_len": 3,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        1
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "T Junction",
    "desc": "At the fork, only one branch can be used by the right color.",
    "target": [
      "BGR",
      ".B.",
      ".G."
    ],
    "start": [
      "GRG",
      ".B.",
      ".B."
    ],
    "par": 7,
    "tag": "shapes",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        4,
        1
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        2,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Tight T",
    "desc": "The second branch is a decoy. Solve the junction before the colors pile up.",
    "target": [
      "GYBR",
      ".GY.",
      ".BR.",
      "...."
    ],
    "start": [
      "BGRG",
      ".YY.",
      ".RB.",
      "...."
    ],
    "par": 7,
    "tag": "shapes",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        4,
        0,
        1,
        1
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Broken Stair",
    "desc": "The diagonal tiles finally have a shape built around them.",
    "target": [
      ".GR",
      "BY.",
      "..."
    ],
    "start": [
      ".GY",
      "RB.",
      "..."
    ],
    "par": 6,
    "tag": "shapes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        2,
        0
      ],
      [
        2,
        2,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Zigzag Logic",
    "desc": "Alternating lanes force you to think two swaps ahead.",
    "target": [
      "RG.",
      ".BY",
      "..."
    ],
    "start": [
      "YG.",
      ".BR",
      "..."
    ],
    "par": 3,
    "tag": "shapes",
    "intro": "",
    "solution_len": 3,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        0,
        2,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Open U",
    "desc": "The missing center cannot be used. Work around it with legal swaps.",
    "target": [
      "B.R",
      "GYW",
      "..."
    ],
    "start": [
      "R.W",
      "BGY",
      "..."
    ],
    "par": 6,
    "tag": "shapes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        3,
        0,
        2
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "The C Turn",
    "desc": "A closed side creates a long way around.",
    "target": [
      "GBRW",
      "Y...",
      "GBRW",
      "...."
    ],
    "start": [
      "GGWB",
      "R...",
      "RYBW",
      "...."
    ],
    "par": 6,
    "tag": "shapes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        2
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        1,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Five Around",
    "desc": "The central tile has four potential neighbors but only some movements are legal.",
    "target": [
      ".R.",
      "BGY",
      ".W.",
      "..."
    ],
    "start": [
      ".Y.",
      "RGB",
      ".W.",
      "..."
    ],
    "par": 4,
    "tag": "shapes",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        0,
        1,
        2
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Stairwell",
    "desc": "A staircase of cells makes every move visibly meaningful.",
    "target": [
      "RB..",
      ".YG.",
      "..WR",
      "...."
    ],
    "start": [
      "RB..",
      ".WG.",
      "..YR",
      "...."
    ],
    "par": 1,
    "tag": "shapes",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Diamond Path",
    "desc": "The diamond is compact, but getting one corner color into another is awkward.",
    "target": [
      ".RY.",
      "GBRY",
      ".GB.",
      "...."
    ],
    "start": [
      ".RR.",
      "GYBG",
      ".BY.",
      "...."
    ],
    "par": 4,
    "tag": "shapes",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        1,
        1
      ],
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Hourglass",
    "desc": "The narrow waist creates a forced exchange point.",
    "target": [
      "YRGB",
      ".WY.",
      "RGBW",
      "...."
    ],
    "start": [
      "BWRG",
      ".RW.",
      "GBYY",
      "...."
    ],
    "par": 8,
    "tag": "shapes",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        3,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        1,
        2,
        1
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Snake",
    "desc": "The route bends twice before reaching the target.",
    "target": [
      "GY..",
      ".WR.",
      "BG..",
      "...."
    ],
    "start": [
      "WG..",
      ".GB.",
      "YR..",
      "...."
    ],
    "par": 10,
    "tag": "shapes",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        2,
        2,
        0
      ],
      [
        3,
        2,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "The Ring",
    "desc": "Missing cells leave narrow connections around the edge.",
    "target": [
      ".BR.",
      "Y..G",
      "W..B",
      ".RY."
    ],
    "start": [
      ".RB.",
      "Y..G",
      "W..B",
      ".RY."
    ],
    "par": 1,
    "tag": "holes",
    "intro": "Missing cells cannot hold tiles.",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Corner Window",
    "desc": "A missing corner means the target can only be approached from one side.",
    "target": [
      "YBR.",
      "W..G",
      "YBR.",
      "...."
    ],
    "start": [
      "YRY.",
      "R..B",
      "BWG.",
      "...."
    ],
    "par": 10,
    "tag": "holes",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        0,
        0,
        3,
        0
      ],
      [
        0,
        0,
        0,
        1
      ],
      [
        5,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Bridge",
    "desc": "The middle pair is the only bridge between the two sides.",
    "target": [
      "Y..G",
      "W..B",
      "R..Y",
      "GWBR"
    ],
    "start": [
      "R..G",
      "Y..R",
      "W..B",
      "GBWY"
    ],
    "par": 5,
    "tag": "shapes",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        2,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        2
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Archway",
    "desc": "White can be carried through the arch, but never moved by itself.",
    "target": [
      ".WB.",
      "RGYW",
      "B..R",
      "...."
    ],
    "start": [
      ".YG.",
      "RWBW",
      "B..R",
      "...."
    ],
    "par": 3,
    "tag": "white",
    "intro": "",
    "solution_len": 3,
    "allowanceFloor": [
      [
        0,
        1,
        1,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Pinwheel",
    "desc": "The central turn rewards planning the order of operations.",
    "target": [
      "RYB.",
      "WGRY",
      ".BW.",
      "...."
    ],
    "start": [
      "YBG.",
      "BRRY",
      ".WW.",
      "...."
    ],
    "par": 6,
    "tag": "shapes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        1,
        0
      ],
      [
        1,
        2,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Crosscurrent",
    "desc": "Two diagonal systems intersect while the board itself is asymmetric.",
    "target": [
      ".B.",
      "RWY",
      ".G.",
      ".B."
    ],
    "start": [
      ".Y.",
      "RGB",
      ".W.",
      ".B."
    ],
    "par": 4,
    "tag": "shapes",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        0,
        1,
        2
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Maze Entrance",
    "desc": "Missing cells change which diagonal destinations exist.",
    "target": [
      "BR..",
      "..G.",
      "YWB.",
      "...."
    ],
    "start": [
      "RB..",
      "..B.",
      "YGW.",
      "...."
    ],
    "par": 3,
    "tag": "holes",
    "intro": "",
    "solution_len": 3,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Maze Middle",
    "desc": "The same principle, with a second bottleneck.",
    "target": [
      "YBR.",
      "W.GY",
      "BR..",
      ".WG."
    ],
    "start": [
      "RRB.",
      "G.YW",
      "GY..",
      ".WB."
    ],
    "par": 13,
    "tag": "holes",
    "intro": "",
    "solution_len": 13,
    "allowanceFloor": [
      [
        2,
        2,
        1,
        0
      ],
      [
        1,
        0,
        1,
        0
      ],
      [
        0,
        3,
        0,
        0
      ],
      [
        0,
        0,
        3,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Hook and Gap",
    "desc": "The missing cells make an apparent shortcut impossible.",
    "target": [
      "GY..",
      "W...",
      "RB..",
      "...."
    ],
    "start": [
      "GY..",
      "R...",
      "BW..",
      "...."
    ],
    "par": 2,
    "tag": "holes",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Arrowhead",
    "desc": "Everything points inward, but the answer is to create space first.",
    "target": [
      ".BR.",
      "GYWB",
      ".RG.",
      "...."
    ],
    "start": [
      ".GG.",
      "RBYW",
      ".BR.",
      "...."
    ],
    "par": 8,
    "tag": "shapes",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        1,
        1,
        0
      ],
      [
        0,
        2,
        2,
        0
      ],
      [
        0,
        1,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Shattered Bridge",
    "desc": "Missing cells make the target feel further away than it is.",
    "target": [
      "BRWG",
      ".YB.",
      "RWGY",
      "...."
    ],
    "start": [
      "BYYG",
      ".RR.",
      "WGBW",
      "...."
    ],
    "par": 11,
    "tag": "holes",
    "intro": "",
    "solution_len": 11,
    "allowanceFloor": [
      [
        0,
        2,
        2,
        0
      ],
      [
        0,
        2,
        0,
        0
      ],
      [
        0,
        4,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 2,
    "name": "Geometry Lesson",
    "desc": "World 2 finale: a full board where every lane can interfere with every other lane.",
    "target": [
      "RBYW",
      "GRBY",
      "WGRB",
      "YWGR"
    ],
    "start": [
      "BYWR",
      "RBRW",
      "YWGG",
      "BYRG"
    ],
    "par": 19,
    "tag": "white",
    "intro": "",
    "solution_len": 19,
    "allowanceFloor": [
      [
        1,
        1,
        0,
        3
      ],
      [
        1,
        1,
        1,
        0
      ],
      [
        1,
        0,
        2,
        3
      ],
      [
        2,
        0,
        2,
        1
      ]
    ]
  },
  {
    "world": 3,
    "name": "First Detour",
    "desc": "Begin the routing challenges with one vertical swap beside a gap.",
    "target": [
      "RB..",
      "..R.",
      "BRB.",
      "...."
    ],
    "start": [
      "RB..",
      "..B.",
      "BRR.",
      "...."
    ],
    "par": 1,
    "tag": "holes",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Two Chambers",
    "desc": "Missing cells divide the board into connected pockets.",
    "target": [
      "RGB.",
      "R.GB",
      "RG..",
      ".BR."
    ],
    "start": [
      "BRG.",
      "R.BG",
      "BG..",
      ".RR."
    ],
    "par": 7,
    "tag": "holes",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        2,
        2,
        0,
        0
      ],
      [
        0,
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "No Through Road",
    "desc": "A tempting route ends at a gap; plan around it before moving.",
    "target": [
      "YG..",
      "R...",
      "BY..",
      "...."
    ],
    "start": [
      "BR..",
      "Y...",
      "YG..",
      "...."
    ],
    "par": 6,
    "tag": "holes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        3,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Window in the Gap",
    "desc": "Missing cells restrict which colors can reach each side.",
    "target": [
      "GY..",
      "..B.",
      "RGY.",
      "...."
    ],
    "start": [
      "GY..",
      "..Y.",
      "BRG.",
      "...."
    ],
    "par": 5,
    "tag": "holes",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        3,
        0,
        2,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Missing Corner",
    "desc": "The missing corner changes the routes around the board.",
    "target": [
      "RYG.",
      "B..R",
      "YGB.",
      "...."
    ],
    "start": [
      "RBG.",
      "Y..R",
      "YBG.",
      "...."
    ],
    "par": 4,
    "tag": "holes",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        2,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Offset Gate",
    "desc": "One diagonal tile can cross the gate only at one orientation.",
    "target": [
      "GBW.",
      "Y.RG",
      "BW..",
      ".YR."
    ],
    "start": [
      "GBR.",
      "W.WG",
      "RY..",
      ".YB."
    ],
    "par": 5,
    "tag": "holes",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        3,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Split Stair",
    "desc": "The stair shape now has a dead-looking but solvable end.",
    "target": [
      "GW..",
      ".RY.",
      "..BG",
      "...."
    ],
    "start": [
      "GW..",
      ".GY.",
      "..RB",
      "...."
    ],
    "par": 6,
    "tag": "holes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        2,
        0
      ],
      [
        0,
        0,
        1,
        3
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Twin Gaps",
    "desc": "Two gaps create two separate routing problems.",
    "target": [
      ".RY.",
      "G..W",
      "B..R",
      ".YG."
    ],
    "start": [
      ".GR.",
      "G..Y",
      "Y..W",
      ".BR."
    ],
    "par": 9,
    "tag": "holes",
    "intro": "",
    "solution_len": 9,
    "allowanceFloor": [
      [
        0,
        1,
        1,
        0
      ],
      [
        0,
        0,
        0,
        1
      ],
      [
        3,
        0,
        0,
        0
      ],
      [
        0,
        2,
        1,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Hollow Heart",
    "desc": "A missing center changes who can swap with whom.",
    "target": [
      ".G.",
      "YWR",
      ".B.",
      ".G."
    ],
    "start": [
      ".R.",
      "GGB",
      ".Y.",
      ".W."
    ],
    "par": 12,
    "tag": "holes",
    "intro": "",
    "solution_len": 12,
    "allowanceFloor": [
      [
        0,
        6,
        0
      ],
      [
        1,
        1,
        1
      ],
      [
        0,
        3,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Broken Loop",
    "desc": "A gap breaks the direct route; use a vertical swap on the outside.",
    "target": [
      ".YG.",
      "R..B",
      "W..Y",
      ".GR."
    ],
    "start": [
      ".YG.",
      "W..B",
      "R..Y",
      ".GR."
    ],
    "par": 1,
    "tag": "holes",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Gate and Ghost",
    "desc": "White is trapped on the wrong side until another tile carries it across.",
    "target": [
      "RBGY",
      "W...",
      "RBGY",
      "...."
    ],
    "start": [
      "BGWY",
      "R...",
      "RBGY",
      "...."
    ],
    "par": 5,
    "tag": "white",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        3,
        1,
        0,
        0
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Four Pockets",
    "desc": "Missing cells create a compact routing maze.",
    "target": [
      "GYW.",
      "B.RG",
      "YW..",
      ".BR."
    ],
    "start": [
      "WYR.",
      "B.GG",
      "WR..",
      ".BY."
    ],
    "par": 14,
    "tag": "holes",
    "intro": "",
    "solution_len": 14,
    "allowanceFloor": [
      [
        0,
        2,
        1,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        5,
        0,
        0
      ],
      [
        0,
        2,
        3,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "The Narrow Hourglass",
    "desc": "Only a few legal transitions exist around the waist.",
    "target": [
      "YBGR",
      ".WY.",
      "BGRW",
      "...."
    ],
    "start": [
      "BGRG",
      ".YY.",
      "WBWR",
      "...."
    ],
    "par": 9,
    "tag": "holes",
    "intro": "",
    "solution_len": 9,
    "allowanceFloor": [
      [
        1,
        1,
        2,
        1
      ],
      [
        0,
        1,
        2,
        0
      ],
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Corner Cut",
    "desc": "The obvious diagonal destination is missing.",
    "target": [
      ".RY.",
      "BWGR",
      ".YB.",
      "...."
    ],
    "start": [
      ".BW.",
      "GYYR",
      ".RB.",
      "...."
    ],
    "par": 7,
    "tag": "holes",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        3,
        0,
        0
      ],
      [
        1,
        0,
        1,
        0
      ],
      [
        0,
        2,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Waiting Room",
    "desc": "One color has to wait while another clears a lane.",
    "target": [
      "GYWR",
      ".BG.",
      ".YW.",
      "...."
    ],
    "start": [
      "GYGR",
      ".BW.",
      ".WY.",
      "...."
    ],
    "par": 8,
    "tag": "holes",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        0,
        3,
        0
      ],
      [
        0,
        4,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Crossed Gates",
    "desc": "Missing cells interrupt opposite diagonals; plan the swap order.",
    "target": [
      "YRGB",
      "..WY",
      "RG..",
      ".BWY"
    ],
    "start": [
      "YRYR",
      "..GW",
      "GW..",
      ".BYB"
    ],
    "par": 13,
    "tag": "holes",
    "intro": "",
    "solution_len": 13,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        2,
        0,
        0,
        0
      ],
      [
        0,
        5,
        2,
        2
      ]
    ]
  },
  {
    "world": 3,
    "name": "The Detour",
    "desc": "The route looks longer than the board because two swaps must be spent creating access.",
    "target": [
      "RY..",
      ".GW.",
      "BR..",
      "...."
    ],
    "start": [
      "RW..",
      ".GY.",
      "RB..",
      "...."
    ],
    "par": 2,
    "tag": "holes",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Silent Room",
    "desc": "White is passive, while missing cells cannot be occupied.",
    "target": [
      "R.G",
      "YWB",
      "..."
    ],
    "start": [
      "B.R",
      "WGY",
      "..."
    ],
    "par": 8,
    "tag": "white",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        1,
        0,
        3
      ],
      [
        0,
        1,
        3
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "The Lock",
    "desc": "A short horizontal swap solves the top row above a narrow stem.",
    "target": [
      "GYB",
      ".R.",
      ".W."
    ],
    "start": [
      "GBY",
      ".R.",
      ".W."
    ],
    "par": 1,
    "tag": "holes",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Three Gaps",
    "desc": "Several gaps make the order of operations critical.",
    "target": [
      "RGY.",
      "W.BR",
      "GY..",
      ".WB."
    ],
    "start": [
      "WYG.",
      "G.YR",
      "WB..",
      ".BR."
    ],
    "par": 15,
    "tag": "holes",
    "intro": "",
    "solution_len": 15,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        4,
        0,
        2,
        0
      ],
      [
        0,
        2,
        0,
        0
      ],
      [
        0,
        1,
        5,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "False Center",
    "desc": "The visual center is not the logical center.",
    "target": [
      ".R.",
      "GWY",
      ".B.",
      "..."
    ],
    "start": [
      ".R.",
      "BGY",
      ".W.",
      "..."
    ],
    "par": 6,
    "tag": "holes",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        4,
        0
      ],
      [
        1,
        1,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "The Empty Door",
    "desc": "A missing cell cannot hold a tile. Route White around the gap.",
    "target": [
      ".GR.",
      "YBWG",
      "R..Y",
      "...."
    ],
    "start": [
      ".RR.",
      "WGYY",
      "G..B",
      "...."
    ],
    "par": 10,
    "tag": "holes",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        0,
        1,
        2,
        0
      ],
      [
        0,
        2,
        1,
        2
      ],
      [
        2,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Outer Loop",
    "desc": "The outside edge is the only reliable highway.",
    "target": [
      "R..Y",
      "G..W",
      "B..R",
      "YGWB"
    ],
    "start": [
      "G..Y",
      "B..R",
      "R..G",
      "YWBW"
    ],
    "par": 7,
    "tag": "holes",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        1
      ],
      [
        2,
        0,
        0,
        1
      ],
      [
        0,
        0,
        3,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Last Detour",
    "desc": "A full 4×4 board tests planning without any missing cells.",
    "target": [
      "RBYW",
      "GRBY",
      "WGRB",
      "YWGR"
    ],
    "start": [
      "GRBB",
      "WGWR",
      "RYYY",
      "GRWB"
    ],
    "par": 15,
    "tag": "holes",
    "intro": "",
    "solution_len": 15,
    "allowanceFloor": [
      [
        0,
        2,
        1,
        2
      ],
      [
        0,
        0,
        0,
        2
      ],
      [
        2,
        2,
        1,
        0
      ],
      [
        1,
        2,
        0,
        0
      ]
    ]
  },
  {
    "world": 3,
    "name": "Routing Finale",
    "desc": "Finish the routing challenges by carrying tiles around the missing center.",
    "target": [
      ".BR.",
      "Y..G",
      "W..R",
      ".BR."
    ],
    "start": [
      ".BR.",
      "Y..R",
      "W..B",
      ".RG."
    ],
    "par": 3,
    "tag": "holes",
    "intro": "",
    "solution_len": 3,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        1
      ],
      [
        0,
        0,
        0,
        1
      ],
      [
        0,
        0,
        1,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "First Jump",
    "desc": "Purple moves two cells in a straight line. It can jump over the middle.",
    "target": [
      "PRBW",
      "PRBW"
    ],
    "start": [
      "RWWB",
      "PPRB"
    ],
    "par": 8,
    "tag": "purple",
    "intro": "Purple ↕↔ jumps exactly two cells.",
    "solution_len": 8,
    "allowanceFloor": [
      [
        2,
        0,
        0,
        1
      ],
      [
        0,
        2,
        0,
        3
      ]
    ]
  },
  {
    "world": 4,
    "name": "Leapfrog",
    "desc": "A two-cell jump opens destinations ordinary tiles cannot reach.",
    "target": [
      "BRP",
      "BRP",
      "BRP"
    ],
    "start": [
      "PBR",
      "RPR",
      "BBP"
    ],
    "par": 7,
    "tag": "purple",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        1,
        1,
        0
      ],
      [
        2,
        1,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Long Sight",
    "desc": "Purple is powerful only when the destination exists.",
    "target": [
      "GWYP",
      "GWYP"
    ],
    "start": [
      "PWGG",
      "YWPY"
    ],
    "par": 8,
    "tag": "purple",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        2
      ],
      [
        2,
        0,
        2,
        1
      ]
    ]
  },
  {
    "world": 4,
    "name": "Cross Jump",
    "desc": "A horizontal leap and a vertical lane compete for the same cell.",
    "target": [
      "RBP",
      "YRB",
      "PYR"
    ],
    "start": [
      "BPR",
      "RPB",
      "YRY"
    ],
    "par": 6,
    "tag": "purple",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        1,
        1,
        0
      ],
      [
        0,
        1,
        1
      ]
    ]
  },
  {
    "world": 4,
    "name": "Purple in the Corner",
    "desc": "The jumper begins stranded and must be released indirectly.",
    "target": [
      "BGYR",
      ".PB.",
      ".GY.",
      "...."
    ],
    "start": [
      "YGPB",
      ".GB.",
      ".RY.",
      "...."
    ],
    "par": 7,
    "tag": "purple",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        0,
        3,
        1
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Over the Gap",
    "desc": "Purple jumps exactly two cells; its destination must exist.",
    "target": [
      "YGBP",
      "YGBP"
    ],
    "start": [
      "PGYB",
      "YPBG"
    ],
    "par": 3,
    "tag": "purple",
    "intro": "",
    "solution_len": 3,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        1
      ],
      [
        0,
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Jump and Carry",
    "desc": "White becomes the passenger in a Purple exchange.",
    "target": [
      "PWB",
      "RGP",
      "WBR"
    ],
    "start": [
      "BRW",
      "RPB",
      "GWP"
    ],
    "par": 7,
    "tag": "purple",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        2,
        0
      ],
      [
        0,
        0,
        2
      ],
      [
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Diagonal Launch",
    "desc": "The diagonal colors create the only way to put Purple where it belongs.",
    "target": [
      ".GR.",
      "YBPG",
      ".RY.",
      "...."
    ],
    "start": [
      ".YY.",
      "PGBG",
      ".RR.",
      "...."
    ],
    "par": 5,
    "tag": "purple",
    "intro": "",
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        1,
        0,
        1,
        0
      ],
      [
        0,
        0,
        2,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Gap Jump",
    "desc": "Purple may leap over a missing cell, but must land on a tile.",
    "target": [
      "RYG.",
      "W.PB",
      "RY..",
      ".GW."
    ],
    "start": [
      "BRP.",
      "R.GW",
      "GW..",
      ".YY."
    ],
    "par": 12,
    "tag": "purple",
    "intro": "",
    "solution_len": 12,
    "allowanceFloor": [
      [
        4,
        0,
        2,
        0
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        4,
        1,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Four-way Knot",
    "desc": "All five movable tile types compete in one compact space.",
    "target": [
      ".W.",
      "PRG",
      ".Y.",
      "..."
    ],
    "start": [
      ".W.",
      "RPY",
      ".G.",
      "..."
    ],
    "par": 4,
    "tag": "purple",
    "intro": "",
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        1,
        0,
        2
      ],
      [
        0,
        1,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "The Long Hall",
    "desc": "A 4-cell corridor makes horizontal Blue moves and Purple jumps collide.",
    "target": [
      "BWRP"
    ],
    "start": [
      "WPRB"
    ],
    "par": 2,
    "tag": "purple",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        1
      ]
    ]
  },
  {
    "world": 4,
    "name": "Chopped Hall",
    "desc": "Two missing cells remove the easy route.",
    "target": [
      "GWYB",
      "R...",
      "PGWY",
      "...."
    ],
    "start": [
      "BWYG",
      "R...",
      "WGPY",
      "...."
    ],
    "par": 6,
    "tag": "purple",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        5,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Twin Jumps",
    "desc": "Two Purple tiles can exchange strategic roles without moving themselves identically.",
    "target": [
      "PPRB",
      "GWYP"
    ],
    "start": [
      "RGWY",
      "PBPP"
    ],
    "par": 8,
    "tag": "purple",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        2,
        1,
        0,
        1
      ],
      [
        0,
        1,
        3,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "The Offset Tower",
    "desc": "A short vertical swap carries White into position without using Purple.",
    "target": [
      "Y.RP",
      "B.WG",
      "YR..",
      "...."
    ],
    "start": [
      "Y.WP",
      "B.RG",
      "YR..",
      "...."
    ],
    "par": 1,
    "tag": "purple",
    "intro": "",
    "solution_len": 1,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Broken Mirror",
    "desc": "The shape looks symmetric, but the swap sequence need not be.",
    "target": [
      ".RY.",
      "G..B",
      "P..W",
      ".RY."
    ],
    "start": [
      ".YR.",
      "G..P",
      "B..W",
      ".YR."
    ],
    "par": 21,
    "tag": "purple",
    "intro": "",
    "solution_len": 21,
    "allowanceFloor": [
      [
        0,
        4,
        2,
        0
      ],
      [
        6,
        0,
        0,
        0
      ],
      [
        5,
        0,
        0,
        0
      ],
      [
        0,
        2,
        2,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Five-point Turn",
    "desc": "The central point has multiple colors but very few legal transitions.",
    "target": [
      ".B.",
      "RPY",
      ".G.",
      ".W."
    ],
    "start": [
      ".W.",
      "PYG",
      ".R.",
      ".B."
    ],
    "par": 10,
    "tag": "purple",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        3,
        2,
        1
      ],
      [
        0,
        4,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Maze Runner",
    "desc": "Purple can bypass one bottleneck; the other colors cannot.",
    "target": [
      "GPB.",
      "R.WY",
      "GP..",
      ".BR."
    ],
    "start": [
      "RPG.",
      "P.GY",
      "BW..",
      ".RB."
    ],
    "par": 7,
    "tag": "purple",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        1,
        0,
        0
      ],
      [
        1,
        0,
        1,
        0
      ],
      [
        2,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "The Missing Step",
    "desc": "A staircase with a hole demands a jump at exactly the right moment.",
    "target": [
      "YG..",
      ".BW.",
      "..PR",
      "...."
    ],
    "start": [
      "WR..",
      ".YB.",
      "..GP",
      "...."
    ],
    "par": 10,
    "tag": "purple",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        0,
        2,
        0,
        0
      ],
      [
        0,
        5,
        3,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Quiet Gate",
    "desc": "White must be positioned before Purple can make the final jump.",
    "target": [
      "W..P",
      "R..G",
      "Y..B",
      "WPRG"
    ],
    "start": [
      "Y..P",
      "W..G",
      "R..B",
      "RWPG"
    ],
    "par": 7,
    "tag": "purple",
    "intro": "",
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        0,
        0,
        0
      ],
      [
        0,
        0,
        4,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Four Gaps",
    "desc": "Missing cells make each Purple jump a deliberate choice.",
    "target": [
      "BRY.",
      "G.WP",
      "BR..",
      ".YG."
    ],
    "start": [
      "GRW.",
      "P.GB",
      "YB..",
      ".RY."
    ],
    "par": 13,
    "tag": "purple",
    "intro": "",
    "solution_len": 13,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        1,
        0,
        1,
        4
      ],
      [
        3,
        1,
        0,
        0
      ],
      [
        0,
        1,
        1,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "The False Finish",
    "desc": "A near-perfect arrangement has one subtle impossible move left.",
    "target": [
      "PRW.",
      "BGYP",
      ".RW.",
      "...."
    ],
    "start": [
      "RWR.",
      "PGPY",
      ".WB.",
      "...."
    ],
    "par": 10,
    "tag": "purple",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        2,
        0,
        1,
        0
      ],
      [
        0,
        2,
        1,
        0
      ],
      [
        0,
        0,
        4,
        0
      ],
      [
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Convergence",
    "desc": "Every tile family is now active in the same geometric language, across a full board.",
    "target": [
      "PBYR",
      "GWPB",
      "YRGW",
      "PBYR"
    ],
    "start": [
      "WPRG",
      "YPRY",
      "BPBY",
      "BGRW"
    ],
    "par": 15,
    "tag": "purple",
    "intro": "",
    "solution_len": 15,
    "allowanceFloor": [
      [
        0,
        2,
        2,
        1
      ],
      [
        2,
        1,
        0,
        1
      ],
      [
        1,
        1,
        1,
        2
      ],
      [
        1,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "Almost There",
    "desc": "The board is small, but the exact route is not.",
    "target": [
      "R.P",
      "YGB",
      "..."
    ],
    "start": [
      "Y.G",
      "RPB",
      "..."
    ],
    "par": 2,
    "tag": "purple",
    "intro": "",
    "solution_len": 2,
    "allowanceFloor": [
      [
        0,
        0,
        1
      ],
      [
        1,
        0,
        0
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 4,
    "name": "The Last Maze",
    "desc": "Plan the swap order to arrange the colors across a zigzag board.",
    "target": [
      "PRY.",
      ".WGB",
      "PRY.",
      ".WGB"
    ],
    "start": [
      "PWG.",
      ".RRY",
      "WBP.",
      ".GBY"
    ],
    "par": 9,
    "tag": "purple",
    "intro": "",
    "solution_len": 9,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        1,
        0,
        1
      ],
      [
        0,
        1,
        1,
        0
      ],
      [
        0,
        2,
        1,
        1
      ]
    ]
  },
  {
    "world": 4,
    "name": "INSIGHT",
    "desc": "Finale: combine all six tile types on a full 4×4 board.",
    "target": [
      "PBRY",
      "GWPB",
      "RYGW",
      "PBRY"
    ],
    "start": [
      "BYBG",
      "YYWG",
      "WRRP",
      "BPPR"
    ],
    "par": 15,
    "tag": "purple",
    "intro": "",
    "solution_len": 15,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        1
      ],
      [
        1,
        2,
        0,
        2
      ],
      [
        0,
        1,
        1,
        2
      ],
      [
        1,
        0,
        1,
        2
      ]
    ]
  },
  {
    "world": 5,
    "name": "Twin Rooms",
    "desc": "A branching map combining diagonal routes and Purple jumps.",
    "target": [
      "RGB..",
      "YWP..",
      "..R..",
      "..BGY",
      "..WPR"
    ],
    "start": [
      "PYB..",
      "GWR..",
      "..B..",
      "..WGY",
      "..RPR"
    ],
    "par": 6,
    "tag": "maps",
    "intro": "",
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        0,
        0,
        0
      ],
      [
        1,
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        2,
        0,
        0
      ]
    ]
  },
  {
    "world": 5,
    "name": "Hourglass Crossing",
    "desc": "A branching map combining diagonal routes and Purple jumps.",
    "target": [
      "RBGY",
      ".PW.",
      ".RG.",
      "YPBR"
    ],
    "start": [
      "BPRY",
      ".RY.",
      ".BW.",
      "GPGR"
    ],
    "par": 11,
    "tag": "maps",
    "intro": "",
    "solution_len": 11,
    "allowanceFloor": [
      [
        1,
        0,
        3,
        0
      ],
      [
        0,
        1,
        1,
        0
      ],
      [
        0,
        2,
        0,
        0
      ],
      [
        2,
        1,
        0,
        0
      ]
    ]
  },
  {
    "world": 5,
    "name": "Island Chain",
    "desc": "A branching map combining diagonal routes and Purple jumps.",
    "target": [
      "RB.PG",
      "..W..",
      "YG.PR",
      "..B.."
    ],
    "start": [
      "PP.BG",
      "..B..",
      "YW.RR",
      "..G.."
    ],
    "par": 10,
    "tag": "maps",
    "intro": "",
    "solution_len": 10,
    "allowanceFloor": [
      [
        2,
        3,
        0,
        2,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        3,
        0,
        0
      ]
    ]
  },
  {
    "world": 5,
    "name": "Spiral Passage",
    "desc": "A branching map combining diagonal routes and Purple jumps.",
    "target": [
      "RBGYP",
      "....R",
      "YWP..",
      "R....",
      "BGP.."
    ],
    "start": [
      "PBRPY",
      "....R",
      "YWG..",
      "G....",
      "PRB.."
    ],
    "par": 9,
    "tag": "maps",
    "intro": "",
    "solution_len": 9,
    "allowanceFloor": [
      [
        2,
        0,
        0,
        0,
        1
      ],
      [
        0,
        0,
        0,
        0,
        2
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        1,
        1,
        2,
        0,
        0
      ]
    ]
  },
  {
    "world": 5,
    "name": "Branching Paths",
    "desc": "A branching map combining diagonal routes and Purple jumps.",
    "target": [
      "..R..",
      "BGYPW",
      "..B..",
      "..G..",
      "RYP.."
    ],
    "start": [
      "..Y..",
      "BGPYW",
      "..R..",
      "..B..",
      "PGR.."
    ],
    "par": 8,
    "tag": "maps",
    "intro": "",
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        0,
        2,
        0,
        0
      ],
      [
        0,
        0,
        2,
        0,
        0
      ],
      [
        0,
        0,
        2,
        0,
        0
      ],
      [
        1,
        1,
        0,
        0,
        0
      ]
    ]
  },
  {
    "world": 5,
    "name": "Split Diamond",
    "desc": "A branching map combining diagonal routes and Purple jumps.",
    "target": [
      ".R.B.",
      "GY.PW",
      "..R..",
      "BP.YG",
      ".W.P."
    ],
    "start": [
      ".P.R.",
      "BP.GW",
      "..P..",
      "YB.RG",
      ".W.Y."
    ],
    "par": 12,
    "tag": "maps",
    "intro": "",
    "solution_len": 12,
    "allowanceFloor": [
      [
        0,
        3,
        0,
        2,
        0
      ],
      [
        0,
        1,
        0,
        1,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ],
      [
        0,
        1,
        0,
        2,
        0
      ],
      [
        0,
        0,
        0,
        2,
        0
      ]
    ]
  }
];
