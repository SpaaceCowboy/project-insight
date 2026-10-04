// Stable campaign positions; changed boards have individual revisions.
const CORE_LEVELS = [
  {
    "name": "The First Turn",
    "start": [
      "BR",
      "RB"
    ],
    "target": [
      "RB",
      "RB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "basics",
    "par": 1,
    "limitedPar": 1,
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
    "name": "Opposite Corners",
    "start": [
      "RR",
      "BB"
    ],
    "target": [
      "BR",
      "BR"
    ],
    "revision": 2,
    "world": 1,
    "tag": "basics",
    "par": 2,
    "limitedPar": 2,
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
    "name": "The Long Pair",
    "start": [
      "BRRB",
      "BBRR"
    ],
    "target": [
      "RBRB",
      "RBRB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "basics",
    "par": 4,
    "limitedPar": 4,
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
    "name": "Vertical Trap",
    "start": [
      "RR",
      "BR",
      "BB"
    ],
    "target": [
      "RB",
      "RB",
      "RB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "basics",
    "par": 4,
    "limitedPar": 4,
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
    "name": "Hold the Light",
    "start": [
      "RBWB",
      "BRWR"
    ],
    "target": [
      "RRBR",
      "BWBW"
    ],
    "revision": 2,
    "world": 1,
    "tag": "gates",
    "par": 4,
    "limitedPar": 4,
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        1
      ],
      [
        0,
        1,
        0,
        1
      ]
    ]
  },
  {
    "name": "Borrowed Passage",
    "start": [
      "RRW",
      "WRB",
      "BRB"
    ],
    "target": [
      "WBR",
      "RRW",
      "BRB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "gates",
    "par": 4,
    "limitedPar": 4,
    "solution_len": 4,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        0,
        1,
        1
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "name": "Leave It Open",
    "start": [
      "R.R",
      "RBB",
      "W.B"
    ],
    "target": [
      "B.R",
      "RBW",
      "R.B"
    ],
    "revision": 2,
    "world": 1,
    "tag": "gates",
    "par": 4,
    "limitedPar": 4,
    "solution_len": 4,
    "allowanceFloor": [
      [
        1,
        0,
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
        0
      ]
    ]
  },
  {
    "name": "First Connection",
    "start": [
      "B..",
      "RRR",
      "BBW"
    ],
    "target": [
      "R..",
      "RWB",
      "RBB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "gates",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        2,
        0,
        0
      ],
      [
        1,
        0,
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
    "name": "Quarter Turn",
    "start": [
      "RYYR",
      "GBGB"
    ],
    "target": [
      "RGYR",
      "BYGB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "rotation",
    "par": 2,
    "limitedPar": 2,
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
        1,
        0,
        0
      ]
    ]
  },
  {
    "name": "A New Direction",
    "start": [
      "YG.",
      "RGB",
      "BR."
    ],
    "target": [
      "RG.",
      "RYB",
      "BG."
    ],
    "revision": 2,
    "world": 1,
    "tag": "rotation",
    "par": 2,
    "limitedPar": 2,
    "solution_len": 2,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        0,
        1,
        0
      ]
    ]
  },
  {
    "name": "Turn Twice",
    "start": [
      "RY..",
      "B...",
      "RBGG"
    ],
    "target": [
      "RY..",
      "B...",
      "GBRG"
    ],
    "revision": 2,
    "world": 1,
    "tag": "rotation",
    "par": 11,
    "limitedPar": 11,
    "solution_len": 11,
    "allowanceFloor": [
      [
        4,
        2,
        0,
        0
      ],
      [
        2,
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
    "name": "Return Angle",
    "start": [
      ".BB",
      "GRR",
      "YG."
    ],
    "target": [
      ".BG",
      "YGB",
      "RR."
    ],
    "revision": 2,
    "world": 1,
    "tag": "rotation",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        2,
        1
      ],
      [
        1,
        1,
        0
      ],
      [
        0,
        1,
        0
      ]
    ]
  },
  {
    "name": "The Spare Step",
    "start": [
      "Y..",
      "RBG",
      "RGB"
    ],
    "target": [
      "G..",
      "BRY",
      "BGR"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
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
        0,
        2
      ]
    ]
  },
  {
    "name": "Shared Ground",
    "start": [
      "YYW",
      "GBG",
      "RRB"
    ],
    "target": [
      "RGG",
      "YBW",
      "RBY"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
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
        1,
        1
      ]
    ]
  },
  {
    "name": "Return Journey",
    "start": [
      "RR.",
      "BGB",
      "GY."
    ],
    "target": [
      "BY.",
      "GBR",
      "GR."
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        0,
        1,
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
    "name": "The Waiting Tile",
    "start": [
      "RGB",
      "GWB",
      "RYY"
    ],
    "target": [
      "RYG",
      "YRB",
      "BGW"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        1
      ],
      [
        2,
        0,
        0
      ],
      [
        2,
        1,
        1
      ]
    ]
  },
  {
    "name": "Crossed Intentions",
    "start": [
      "GR.",
      "BYB",
      "RG."
    ],
    "target": [
      "RB.",
      "GGY",
      "BR."
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        2,
        0
      ],
      [
        0,
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
    "name": "Two Responsibilities",
    "start": [
      "GG..",
      "B...",
      "RYBR"
    ],
    "target": [
      "BG..",
      "G...",
      "YRBR"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        2,
        0,
        0,
        0
      ],
      [
        1,
        2,
        2,
        0
      ]
    ]
  },
  {
    "name": "Narrow Opportunity",
    "start": [
      "YBGB",
      "RRGY"
    ],
    "target": [
      "YGYB",
      "GRRB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        3,
        1,
        0
      ],
      [
        1,
        0,
        0,
        1
      ]
    ]
  },
  {
    "name": "The Long Exchange",
    "start": [
      "BRB",
      "GRG"
    ],
    "target": [
      "BRG",
      "GRB"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 4,
    "limitedPar": 4,
    "solution_len": 4,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        0,
        1,
        1
      ]
    ]
  },
  {
    "name": "Bring It Back",
    "start": [
      "RG..",
      "BGR.",
      ".YYB"
    ],
    "target": [
      "GR..",
      "YRB.",
      ".YBG"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        0,
        0,
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
        3,
        1
      ]
    ]
  },
  {
    "name": "Careful Timing",
    "start": [
      "RGB",
      "RGB"
    ],
    "target": [
      "GBR",
      "BGR"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        2,
        3
      ],
      [
        1,
        0,
        1
      ]
    ]
  },
  {
    "name": "Another Way Through",
    "start": [
      "RRB",
      "YY.",
      "GGB"
    ],
    "target": [
      "BYY",
      "RB.",
      "GRG"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        2,
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
        1
      ]
    ]
  },
  {
    "name": "The Final Charge",
    "start": [
      "BGB",
      "GRR"
    ],
    "target": [
      "GBR",
      "RBG"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        2,
        0,
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
    "name": "A Small Sacrifice",
    "start": [
      "BBR",
      "RGG"
    ],
    "target": [
      "GBR",
      "RBG"
    ],
    "revision": 2,
    "world": 1,
    "tag": "circuits",
    "par": 3,
    "limitedPar": 3,
    "solution_len": 3,
    "allowanceFloor": [
      [
        1,
        0,
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
    "name": "Borrowed Light II",
    "start": [
      "RG.",
      "RYG",
      "BB."
    ],
    "target": [
      "GR.",
      "YBG",
      "BR."
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        2,
        1,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        1,
        1,
        0
      ]
    ]
  },
  {
    "name": "The Handoff II",
    "start": [
      ".YR",
      "RBB",
      "GG."
    ],
    "target": [
      ".RG",
      "GBR",
      "BY."
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        1,
        1
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
    "name": "Across the Fold II",
    "start": [
      "RWG",
      "RYB",
      "GYB"
    ],
    "target": [
      "BGY",
      "WBR",
      "GYR"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        1,
        0,
        2
      ],
      [
        0,
        2,
        3
      ],
      [
        0,
        0,
        1
      ]
    ]
  },
  {
    "name": "A Place to Wait II",
    "start": [
      ".BR",
      "GRB",
      "GY."
    ],
    "target": [
      ".YG",
      "RGB",
      "RB."
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        3,
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
    "name": "Turn and Return II",
    "start": [
      "RGYB",
      "BRYG"
    ],
    "target": [
      "BGBY",
      "RRGY"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 4,
    "limitedPar": 4,
    "solution_len": 4,
    "allowanceFloor": [
      [
        1,
        0,
        1,
        1
      ],
      [
        0,
        0,
        0,
        1
      ]
    ]
  },
  {
    "name": "The Quiet Detour II",
    "start": [
      "R.G",
      "BYG",
      "B.R"
    ],
    "target": [
      "B.R",
      "BYR",
      "G.G"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        0,
        2,
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
    "name": "Hold the Crossing II",
    "start": [
      "GB.",
      "RBY",
      "RG."
    ],
    "target": [
      "BR.",
      "YGB",
      "GR."
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        0,
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
    "name": "Moving Anchor II",
    "start": [
      "BRYG",
      "RGYB"
    ],
    "target": [
      "GBRY",
      "BYRG"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        1,
        0,
        2,
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
    "name": "Second Passage II",
    "start": [
      "GYB",
      "GR.",
      "YRB"
    ],
    "target": [
      "RYB",
      "RG.",
      "GYB"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        3,
        1,
        0
      ],
      [
        0,
        3,
        0
      ]
    ]
  },
  {
    "name": "A Different Angle II",
    "start": [
      "BR..",
      "B...",
      "GRGY"
    ],
    "target": [
      "BG..",
      "B...",
      "RGYR"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 20,
    "limitedPar": 21,
    "solution_len": 20,
    "allowanceFloor": [
      [
        5,
        6,
        0,
        0
      ],
      [
        6,
        0,
        0,
        0
      ],
      [
        1,
        1,
        0,
        2
      ]
    ]
  },
  {
    "name": "Before the Last Turn II",
    "start": [
      "BGY",
      "YWR",
      "GBR"
    ],
    "target": [
      "WRB",
      "YYB",
      "GGR"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        2,
        1,
        2
      ],
      [
        0,
        0,
        1
      ],
      [
        0,
        0,
        0
      ]
    ]
  },
  {
    "name": "Open Circuit II",
    "start": [
      "RGYG",
      "YBRB"
    ],
    "target": [
      "BGGY",
      "YRRB"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        2
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
    "name": "The Spare Step II",
    "start": [
      "B.G",
      "BRR",
      "G.Y"
    ],
    "target": [
      "G.B",
      "YGR",
      "R.B"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
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
        0,
        3
      ]
    ]
  },
  {
    "name": "Shared Ground II",
    "start": [
      "GG..",
      "YBR.",
      ".YRB"
    ],
    "target": [
      "GB..",
      "YRG.",
      ".RYB"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        2,
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
        1,
        0,
        0
      ]
    ]
  },
  {
    "name": "Return Journey II",
    "start": [
      "B..",
      "BGR",
      "RYG"
    ],
    "target": [
      "R..",
      "RBG",
      "YBG"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        2,
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
    "name": "The Waiting Tile II",
    "start": [
      "B.G",
      "YRB",
      "G.R"
    ],
    "target": [
      "B.B",
      "GGR",
      "Y.R"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        1
      ],
      [
        0,
        0,
        3
      ],
      [
        1,
        0,
        0
      ]
    ]
  },
  {
    "name": "Crossed Intentions II",
    "start": [
      "BYG",
      "YB.",
      "GRR"
    ],
    "target": [
      "BRG",
      "GY.",
      "BYR"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 4,
    "limitedPar": 4,
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
        0
      ],
      [
        1,
        2,
        0
      ]
    ]
  },
  {
    "name": "Two Responsibilities II",
    "start": [
      ".YG",
      "BRR",
      "BG."
    ],
    "target": [
      ".GR",
      "YBB",
      "GR."
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        2,
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
    "name": "Narrow Opportunity II",
    "start": [
      "BG..",
      "RGB.",
      ".YRY"
    ],
    "target": [
      "YR..",
      "YGB.",
      ".BRG"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        2,
        0,
        2,
        0
      ],
      [
        0,
        1,
        0,
        2
      ]
    ]
  },
  {
    "name": "The Long Exchange II",
    "start": [
      "GYR",
      "GR.",
      "BYB"
    ],
    "target": [
      "YBR",
      "RG.",
      "GBY"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        2,
        3,
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
    "name": "Bring It Back II",
    "start": [
      "RGR",
      "GY.",
      "BBY"
    ],
    "target": [
      "BRR",
      "BG.",
      "GYY"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        0,
        3,
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
    "name": "Careful Timing II",
    "start": [
      "R..",
      "RGY",
      "GBB"
    ],
    "target": [
      "G..",
      "RYG",
      "RBB"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        1,
        0,
        0
      ],
      [
        1,
        3,
        0
      ]
    ]
  },
  {
    "name": "Another Way Through II",
    "start": [
      "YYW",
      "GBG",
      "BRR"
    ],
    "target": [
      "BRY",
      "GYR",
      "GBW"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        0,
        0,
        1
      ],
      [
        1,
        2,
        1
      ]
    ]
  },
  {
    "name": "The Final Charge II",
    "start": [
      "YBRG",
      "YGRB"
    ],
    "target": [
      "GRRY",
      "BYGB"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        3,
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
    "name": "A Small Sacrifice II",
    "start": [
      "BGG",
      "YB.",
      "YRR"
    ],
    "target": [
      "BRY",
      "GG.",
      "BYR"
    ],
    "revision": 2,
    "world": 2,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
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
        0,
        2,
        0
      ]
    ]
  },
  {
    "name": "Borrowed Light III",
    "start": [
      "RYR",
      "GB.",
      "BYG"
    ],
    "target": [
      "GYB",
      "BR.",
      "GRY"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        2,
        0,
        1
      ],
      [
        0,
        1,
        0
      ],
      [
        0,
        2,
        3
      ]
    ]
  },
  {
    "name": "The Handoff III",
    "start": [
      "BY..",
      "BRY.",
      ".GGR"
    ],
    "target": [
      "YB..",
      "GBY.",
      ".GRR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        3,
        0,
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
        1,
        0
      ]
    ]
  },
  {
    "name": "Across the Fold III",
    "start": [
      "YBRG",
      "YBGR"
    ],
    "target": [
      "YRGB",
      "GRYB"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        2,
        1,
        0
      ],
      [
        1,
        2,
        1,
        0
      ]
    ]
  },
  {
    "name": "A Place to Wait III",
    "start": [
      "GGRY",
      "BYRB"
    ],
    "target": [
      "GRYB",
      "BGYR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        1,
        0,
        0
      ],
      [
        2,
        0,
        0,
        3
      ]
    ]
  },
  {
    "name": "Turn and Return III",
    "start": [
      "RYB",
      "RB.",
      "YGG"
    ],
    "target": [
      "BRY",
      "RB.",
      "GYG"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        2,
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
    "name": "The Quiet Detour III",
    "start": [
      ".GY",
      "GRB",
      "RB."
    ],
    "target": [
      ".RR",
      "BGY",
      "BG."
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        0,
        1,
        2
      ],
      [
        2,
        1,
        0
      ]
    ]
  },
  {
    "name": "Hold the Crossing III",
    "start": [
      "WYB",
      "BRG",
      "YGR"
    ],
    "target": [
      "GGB",
      "RBW",
      "YYR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        3,
        0
      ],
      [
        1,
        2,
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
    "name": "Moving Anchor III",
    "start": [
      "GGY",
      "RYB",
      "BRW"
    ],
    "target": [
      "RRG",
      "YGB",
      "YWB"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        1,
        1,
        0
      ],
      [
        2,
        2,
        0
      ]
    ]
  },
  {
    "name": "Second Passage III",
    "start": [
      "YRG",
      "RY.",
      "GBB"
    ],
    "target": [
      "RGB",
      "GR.",
      "YYB"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        1,
        0,
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
    "name": "A Different Angle III",
    "start": [
      ".BG.",
      "RYRG",
      ".YB."
    ],
    "target": [
      ".YR.",
      "GYGR",
      ".BB."
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        3,
        1,
        0
      ],
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
    "name": "Before the Last Turn III",
    "start": [
      ".RR.",
      "GYBY",
      ".GB."
    ],
    "target": [
      ".RB.",
      "YRYG",
      ".GB."
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        1,
        2,
        0
      ],
      [
        1,
        0,
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
    "name": "Open Circuit III",
    "start": [
      "GRG",
      "BYW",
      "RBY"
    ],
    "target": [
      "RYB",
      "BRG",
      "YGW"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 11,
    "limitedPar": 11,
    "solution_len": 11,
    "allowanceFloor": [
      [
        2,
        1,
        1
      ],
      [
        0,
        2,
        0
      ],
      [
        2,
        2,
        1
      ]
    ]
  },
  {
    "name": "The Spare Step III",
    "start": [
      "RGB",
      "YB.",
      "YRG"
    ],
    "target": [
      "GBY",
      "RG.",
      "BYR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
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
        2,
        0
      ]
    ]
  },
  {
    "name": "Shared Ground III",
    "start": [
      "GBYG",
      "RBRY"
    ],
    "target": [
      "RRGB",
      "YYGB"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        1,
        1,
        2,
        1
      ],
      [
        1,
        1,
        0,
        1
      ]
    ]
  },
  {
    "name": "Return Journey III",
    "start": [
      "B.R",
      "GGY",
      "R.B"
    ],
    "target": [
      "Y.R",
      "GBB",
      "G.R"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        0,
        1,
        1
      ],
      [
        1,
        0,
        2
      ]
    ]
  },
  {
    "name": "The Waiting Tile III",
    "start": [
      "RG..",
      "R...",
      "GYBB"
    ],
    "target": [
      "GR..",
      "B...",
      "BRGY"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
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
        0,
        2,
        3
      ]
    ]
  },
  {
    "name": "Crossed Intentions III",
    "start": [
      "RR..",
      "BGG.",
      ".YBY"
    ],
    "target": [
      "GY..",
      "GBB.",
      ".RYR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        0
      ],
      [
        2,
        0,
        1,
        0
      ],
      [
        0,
        1,
        0,
        4
      ]
    ]
  },
  {
    "name": "Two Responsibilities III",
    "start": [
      "GBRY",
      "YRGB"
    ],
    "target": [
      "RGBB",
      "YRYG"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        2,
        3,
        0,
        0
      ],
      [
        1,
        0,
        0,
        3
      ]
    ]
  },
  {
    "name": "Narrow Opportunity III",
    "start": [
      "RYB",
      "YG.",
      "RGB"
    ],
    "target": [
      "BRG",
      "GY.",
      "YBR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        1,
        3,
        0
      ],
      [
        1,
        0,
        1
      ]
    ]
  },
  {
    "name": "The Long Exchange III",
    "start": [
      "Y.B",
      "GRB",
      "R.G"
    ],
    "target": [
      "B.G",
      "YRR",
      "B.G"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        1,
        0,
        1
      ],
      [
        3,
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
    "name": "Bring It Back III",
    "start": [
      "RR..",
      "Y...",
      "BGBG"
    ],
    "target": [
      "BB..",
      "Y...",
      "GGRR"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 15,
    "limitedPar": 15,
    "solution_len": 15,
    "allowanceFloor": [
      [
        1,
        0,
        0,
        0
      ],
      [
        6,
        0,
        0,
        0
      ],
      [
        3,
        0,
        3,
        2
      ]
    ]
  },
  {
    "name": "Careful Timing III",
    "start": [
      ".BR.",
      "YGRB",
      ".GY."
    ],
    "target": [
      ".BY.",
      "BGYG",
      ".RR."
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        0,
        2,
        0,
        3
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
    "name": "Another Way Through III",
    "start": [
      "YGGY",
      "BRRB"
    ],
    "target": [
      "RBGY",
      "RBYG"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        3,
        0,
        0,
        0
      ],
      [
        3,
        0,
        0,
        1
      ]
    ]
  },
  {
    "name": "The Final Charge III",
    "start": [
      "YY..",
      "BRG.",
      ".RGB"
    ],
    "target": [
      "RG..",
      "RYB.",
      ".YBG"
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        0,
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
        1,
        0,
        1
      ]
    ]
  },
  {
    "name": "A Small Sacrifice III",
    "start": [
      ".GY.",
      "YBRR",
      ".GB."
    ],
    "target": [
      ".GR.",
      "BYRB",
      ".YG."
    ],
    "revision": 2,
    "world": 3,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        0,
        0,
        0
      ],
      [
        1,
        2,
        1,
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
    "name": "Borrowed Light IV",
    "start": [
      "B..",
      "GRY",
      "BRG"
    ],
    "target": [
      "R..",
      "RBG",
      "GYB"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        2,
        2,
        1
      ]
    ]
  },
  {
    "name": "The Handoff IV",
    "start": [
      "RYGY",
      "GBRB"
    ],
    "target": [
      "BYYG",
      "GRRB"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        2,
        1,
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
    "name": "Across the Fold IV",
    "start": [
      "BYY",
      "RG.",
      "RGB"
    ],
    "target": [
      "GBY",
      "RB.",
      "RYG"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        1,
        0
      ],
      [
        2,
        0,
        0
      ],
      [
        0,
        0,
        2
      ]
    ]
  },
  {
    "name": "A Place to Wait IV",
    "start": [
      "RYB",
      "BG.",
      "GYR"
    ],
    "target": [
      "YRG",
      "GR.",
      "BBY"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        4,
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
        0
      ]
    ]
  },
  {
    "name": "Turn and Return IV",
    "start": [
      "YYG",
      "WBR",
      "GRB"
    ],
    "target": [
      "GGR",
      "BYB",
      "RWY"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        2,
        1,
        0
      ],
      [
        0,
        1,
        1
      ],
      [
        1,
        1,
        1
      ]
    ]
  },
  {
    "name": "The Quiet Detour IV",
    "start": [
      "BY..",
      "BGG.",
      ".RYR"
    ],
    "target": [
      "GG..",
      "RBR.",
      ".YBY"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        1,
        2,
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
        2,
        1,
        0
      ]
    ]
  },
  {
    "name": "Hold the Crossing IV",
    "start": [
      "BRRG",
      "GYBY"
    ],
    "target": [
      "RGYR",
      "YGBB"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        1,
        1,
        0,
        1
      ],
      [
        1,
        1,
        1,
        1
      ]
    ]
  },
  {
    "name": "Moving Anchor IV",
    "start": [
      ".YB",
      "RBG",
      "RG."
    ],
    "target": [
      ".RG",
      "BRG",
      "BY."
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        0,
        1,
        1
      ],
      [
        0,
        1,
        2
      ],
      [
        1,
        1,
        0
      ]
    ]
  },
  {
    "name": "Second Passage IV",
    "start": [
      ".BG.",
      "YYRB",
      ".RG."
    ],
    "target": [
      ".YY.",
      "RGGR",
      ".BB."
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0
      ],
      [
        2,
        0,
        2,
        1
      ],
      [
        0,
        0,
        2,
        0
      ]
    ]
  },
  {
    "name": "A Different Angle IV",
    "start": [
      "R.G",
      "GBB",
      "Y.R"
    ],
    "target": [
      "R.B",
      "GRG",
      "B.Y"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        4,
        0,
        1
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
    "name": "Before the Last Turn IV",
    "start": [
      "GRB",
      "BGR"
    ],
    "target": [
      "BBR",
      "GGR"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 3,
    "limitedPar": 3,
    "solution_len": 3,
    "allowanceFloor": [
      [
        1,
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
    "name": "Open Circuit IV",
    "start": [
      "YG..",
      "YRB.",
      ".BRG"
    ],
    "target": [
      "GB..",
      "YBG.",
      ".YRR"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
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
        1,
        1,
        0
      ],
      [
        0,
        1,
        0,
        2
      ]
    ]
  },
  {
    "name": "The Spare Step IV",
    "start": [
      "Y.R",
      "GBG",
      "R.B"
    ],
    "target": [
      "B.R",
      "GBY",
      "G.R"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        3,
        0,
        0
      ],
      [
        0,
        0,
        1
      ],
      [
        0,
        0,
        2
      ]
    ]
  },
  {
    "name": "Shared Ground IV",
    "start": [
      "GBGR",
      "BYYR"
    ],
    "target": [
      "YBGG",
      "YRBR"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        1,
        2,
        0,
        0
      ],
      [
        2,
        0,
        1,
        0
      ]
    ]
  },
  {
    "name": "Return Journey IV",
    "start": [
      ".GR",
      "BBR",
      "GY."
    ],
    "target": [
      ".BG",
      "BRR",
      "YG."
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 5,
    "limitedPar": 5,
    "solution_len": 5,
    "allowanceFloor": [
      [
        0,
        1,
        0
      ],
      [
        0,
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
    "name": "The Waiting Tile IV",
    "start": [
      "RG..",
      "Y...",
      "GRBB"
    ],
    "target": [
      "GR..",
      "B...",
      "RYGB"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        1,
        0,
        0
      ],
      [
        3,
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
    "name": "Crossed Intentions IV",
    "start": [
      "R.R",
      "BGG",
      "B.Y"
    ],
    "target": [
      "G.B",
      "YBR",
      "R.G"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
    "allowanceFloor": [
      [
        2,
        0,
        1
      ],
      [
        1,
        0,
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
    "name": "Two Responsibilities IV",
    "start": [
      ".BB.",
      "GRYR",
      ".YG."
    ],
    "target": [
      ".BY.",
      "RGYR",
      ".GB."
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        0,
        1,
        1,
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
        2,
        0,
        0
      ]
    ]
  },
  {
    "name": "Narrow Opportunity IV",
    "start": [
      "GR..",
      "B...",
      "BGYR"
    ],
    "target": [
      "GB..",
      "Y...",
      "RGBR"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
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
        0,
        0
      ],
      [
        2,
        2,
        3,
        0
      ]
    ]
  },
  {
    "name": "The Long Exchange IV",
    "start": [
      "G..",
      "BGR",
      "YRB"
    ],
    "target": [
      "Y..",
      "GRG",
      "BRB"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 6,
    "limitedPar": 6,
    "solution_len": 6,
    "allowanceFloor": [
      [
        0,
        0,
        0
      ],
      [
        1,
        3,
        0
      ],
      [
        1,
        1,
        0
      ]
    ]
  },
  {
    "name": "Bring It Back IV",
    "start": [
      "BGRB",
      "YRYG"
    ],
    "target": [
      "GRYG",
      "BBRY"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        1,
        2,
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
    "name": "Careful Timing IV",
    "start": [
      "B.Y",
      "RRG",
      "B.G"
    ],
    "target": [
      "B.R",
      "GGR",
      "Y.B"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 12,
    "limitedPar": 12,
    "solution_len": 12,
    "allowanceFloor": [
      [
        0,
        0,
        2
      ],
      [
        1,
        0,
        2
      ],
      [
        5,
        0,
        2
      ]
    ]
  },
  {
    "name": "Another Way Through IV",
    "start": [
      "B..",
      "RGY",
      "RBG"
    ],
    "target": [
      "Y..",
      "GBB",
      "GRR"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 8,
    "limitedPar": 8,
    "solution_len": 8,
    "allowanceFloor": [
      [
        2,
        0,
        0
      ],
      [
        2,
        0,
        3
      ],
      [
        0,
        0,
        1
      ]
    ]
  },
  {
    "name": "The Final Charge IV",
    "start": [
      "BB..",
      "Y...",
      "RGRG"
    ],
    "target": [
      "BY..",
      "B...",
      "RGGR"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 22,
    "limitedPar": 22,
    "solution_len": 22,
    "allowanceFloor": [
      [
        5,
        4,
        0,
        0
      ],
      [
        6,
        0,
        0,
        0
      ],
      [
        4,
        2,
        1,
        0
      ]
    ]
  },
  {
    "name": "A Small Sacrifice IV",
    "start": [
      "YR..",
      "GGR.",
      ".BYB"
    ],
    "target": [
      "GR..",
      "RBY.",
      ".GBY"
    ],
    "revision": 2,
    "world": 4,
    "tag": "circuits",
    "par": 7,
    "limitedPar": 7,
    "solution_len": 7,
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
        3,
        0
      ],
      [
        0,
        1,
        1,
        1
      ]
    ]
  },
  {
    "name": "Twin Responsibilities",
    "start": [
      "YY...",
      "RG...",
      ".BWB.",
      "..GR.",
      "....."
    ],
    "target": [
      "BR...",
      "GY...",
      ".GBY.",
      "..RW.",
      "....."
    ],
    "revision": 2,
    "world": 5,
    "tag": "circuits",
    "par": 12,
    "limitedPar": 12,
    "solution_len": 12,
    "allowanceFloor": [
      [
        1,
        2,
        0,
        0,
        0
      ],
      [
        1,
        2,
        0,
        0,
        0
      ],
      [
        0,
        1,
        0,
        3,
        0
      ],
      [
        0,
        0,
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
      ]
    ]
  },
  {
    "name": "Hourglass Exchange",
    "start": [
      "..P..",
      ".WYY.",
      "BRRGB",
      "..G..",
      "....."
    ],
    "target": [
      "..W..",
      ".BPR.",
      "BYRGG",
      "..Y..",
      "....."
    ],
    "revision": 2,
    "world": 5,
    "tag": "circuits",
    "par": 10,
    "limitedPar": 10,
    "solution_len": 10,
    "allowanceFloor": [
      [
        0,
        0,
        3,
        0,
        0
      ],
      [
        0,
        0,
        1,
        2,
        0
      ],
      [
        0,
        1,
        0,
        0,
        2
      ],
      [
        0,
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
      ]
    ]
  },
  {
    "name": "The Winding Circuit",
    "start": [
      "GY...",
      "R....",
      "WGY..",
      "..B..",
      "..RB."
    ],
    "target": [
      "GR...",
      "W....",
      "BYY..",
      "..G..",
      "..RB."
    ],
    "revision": 2,
    "world": 5,
    "tag": "circuits",
    "par": 12,
    "limitedPar": 12,
    "solution_len": 12,
    "allowanceFloor": [
      [
        2,
        3,
        0,
        0,
        0
      ],
      [
        2,
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
        3,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "name": "Three Holders",
    "start": [
      ".WG..",
      "BRY..",
      "..B..",
      ".RYG.",
      "....."
    ],
    "target": [
      ".GR..",
      "BGW..",
      "..R..",
      ".BYY.",
      "....."
    ],
    "revision": 2,
    "world": 5,
    "tag": "circuits",
    "par": 12,
    "limitedPar": 12,
    "solution_len": 12,
    "allowanceFloor": [
      [
        0,
        0,
        1,
        0,
        0
      ],
      [
        0,
        2,
        3,
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
        2,
        2,
        2,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "name": "Last Crossing",
    "start": [
      "..G..",
      "RBYRW",
      "..Y..",
      "..BG.",
      "....."
    ],
    "target": [
      "..W..",
      "BBRYR",
      "..Y..",
      "..GG.",
      "....."
    ],
    "revision": 2,
    "world": 5,
    "tag": "circuits",
    "par": 17,
    "limitedPar": 17,
    "solution_len": 17,
    "allowanceFloor": [
      [
        0,
        0,
        3,
        0,
        0
      ],
      [
        0,
        4,
        0,
        5,
        0
      ],
      [
        0,
        0,
        1,
        0,
        0
      ],
      [
        0,
        0,
        4,
        0,
        0
      ],
      [
        0,
        0,
        0,
        0,
        0
      ]
    ]
  },
  {
    "name": "Everything Returns",
    "start": [
      ".RG..",
      "YRG..",
      ".WB..",
      "..BY.",
      "....."
    ],
    "target": [
      ".GR..",
      "GBY..",
      ".WR..",
      "..YB.",
      "....."
    ],
    "revision": 2,
    "world": 5,
    "tag": "circuits",
    "par": 9,
    "limitedPar": 9,
    "solution_len": 9,
    "allowanceFloor": [
      [
        0,
        2,
        2,
        0,
        0
      ],
      [
        1,
        2,
        0,
        0,
        0
      ],
      [
        0,
        0,
        1,
        0,
        0
      ],
      [
        0,
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
      ]
    ]
  }
];
if(typeof window!=='undefined')window.CORE_LEVELS=CORE_LEVELS;
