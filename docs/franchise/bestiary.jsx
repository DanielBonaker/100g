import { useState, useEffect, useMemo } from "react";

const D = [
  [0, 1, [[0, 0]], "Keim", true],
  [
    1,
    2,
    [
      [0, 0],
      [0, 1],
    ],
    "Zwilling",
    true,
  ],
  [
    2,
    2,
    [
      [0, 0],
      [1, 0],
    ],
    "Säule",
    true,
  ],
  [
    3,
    2,
    [
      [0, 0],
      [1, 1],
    ],
    "Schrägling",
    false,
  ],
  [
    4,
    3,
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    "Strich",
    true,
  ],
  [
    5,
    3,
    [
      [0, 0],
      [0, 1],
      [1, 0],
    ],
    "Haken",
    false,
  ],
  [
    6,
    3,
    [
      [0, 0],
      [0, 1],
      [1, 2],
    ],
    "Stufe",
    false,
  ],
  [
    7,
    3,
    [
      [0, 0],
      [0, 2],
      [1, 1],
    ],
    "Brücke",
    true,
  ],
  [
    8,
    3,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    "Ecke",
    false,
  ],
  [
    9,
    3,
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    "Turm",
    true,
  ],
  [
    10,
    3,
    [
      [0, 0],
      [1, 0],
      [2, 1],
    ],
    "Treppe",
    false,
  ],
  [
    11,
    3,
    [
      [0, 0],
      [1, 1],
      [1, 2],
    ],
    "Blitz",
    false,
  ],
  [
    12,
    3,
    [
      [0, 0],
      [1, 1],
      [2, 0],
    ],
    "Zickzack",
    false,
  ],
  [
    13,
    3,
    [
      [0, 0],
      [1, 1],
      [2, 1],
    ],
    "Ranke",
    false,
  ],
  [
    14,
    3,
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    "Diagonale",
    false,
  ],
  [
    15,
    3,
    [
      [0, 1],
      [1, 0],
      [1, 2],
    ],
    "Krone",
    true,
  ],
  [
    16,
    4,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ],
    "Pfote",
    false,
  ],
  [
    17,
    4,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ],
    "Kreuz",
    true,
  ],
  [
    18,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    "Block",
    true,
  ],
  [
    19,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
    ],
    "Pranke",
    false,
  ],
  [
    20,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 0],
    ],
    "Klippe",
    false,
  ],
  [
    21,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 1],
    ],
    "Schlange",
    false,
  ],
  [
    22,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    "Welle",
    false,
  ],
  [
    23,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 2],
    ],
    "Fährte",
    false,
  ],
  [
    24,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 2],
      [2, 1],
    ],
    "Wirbel",
    false,
  ],
  [
    25,
    4,
    [
      [0, 0],
      [0, 1],
      [1, 2],
      [2, 2],
    ],
    "Schwanz",
    false,
  ],
  [
    26,
    4,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    "Flügel",
    false,
  ],
  [
    27,
    4,
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
    ],
    "Anker",
    false,
  ],
  [
    28,
    4,
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 1],
    ],
    "Raute",
    true,
  ],
  [
    29,
    4,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    "Sockel",
    false,
  ],
  [
    30,
    4,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
    "Faust",
    false,
  ],
  [
    31,
    4,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    "Spirale",
    false,
  ],
  [
    32,
    4,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 2],
    ],
    "Bumerang",
    false,
  ],
  [
    33,
    4,
    [
      [0, 0],
      [1, 0],
      [1, 2],
      [2, 1],
    ],
    "Spinne",
    false,
  ],
  [
    34,
    4,
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    "Stamm",
    false,
  ],
  [
    35,
    4,
    [
      [0, 0],
      [1, 0],
      [2, 1],
      [2, 2],
    ],
    "Wurzel",
    false,
  ],
  [
    36,
    4,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Spiegel",
    false,
  ],
  [
    37,
    4,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Tropfen",
    false,
  ],
  [
    38,
    4,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    "Pfeil",
    false,
  ],
  [
    39,
    4,
    [
      [0, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Klammer",
    false,
  ],
  [
    40,
    4,
    [
      [0, 0],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Gabel",
    false,
  ],
  [
    41,
    4,
    [
      [0, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Schaufel",
    false,
  ],
  [
    42,
    4,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    "Pilz",
    true,
  ],
  [
    43,
    4,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 2],
    ],
    "Halbmond",
    false,
  ],
  [
    44,
    4,
    [
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
    ],
    "Kralle",
    false,
  ],
  [
    45,
    4,
    [
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 1],
    ],
    "Sanduhr",
    true,
  ],
  [
    46,
    4,
    [
      [0, 1],
      [1, 0],
      [2, 1],
      [2, 2],
    ],
    "Ast",
    false,
  ],
  [
    47,
    4,
    [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Auge",
    true,
  ],
  [
    48,
    5,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    "Schild",
    false,
  ],
  [
    49,
    5,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
    ],
    "Festung",
    true,
  ],
  [
    50,
    5,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 0],
    ],
    "Bastion",
    false,
  ],
  [
    51,
    5,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 1],
    ],
    "Kompass",
    false,
  ],
  [
    52,
    5,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 0],
    ],
    "Fackel",
    false,
  ],
  [
    53,
    5,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
    ],
    "Laterne",
    true,
  ],
  [
    54,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    "Amboss",
    false,
  ],
  [
    55,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
    "Panzer",
    false,
  ],
  [
    56,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 2],
    ],
    "Zinne",
    false,
  ],
  [
    57,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
    ],
    "Greif",
    false,
  ],
  [
    58,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 1],
    ],
    "Krabbe",
    false,
  ],
  [
    59,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 2],
    ],
    "Skorpion",
    false,
  ],
  [
    60,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    "Mauer",
    false,
  ],
  [
    61,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 1],
      [2, 2],
    ],
    "Dolch",
    false,
  ],
  [
    62,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Blatt",
    false,
  ],
  [
    63,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Wolke",
    false,
  ],
  [
    64,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    "Kette",
    false,
  ],
  [
    65,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Dreizack",
    false,
  ],
  [
    66,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Flosse",
    false,
  ],
  [
    67,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Schwinge",
    false,
  ],
  [
    68,
    5,
    [
      [0, 0],
      [0, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Natter",
    false,
  ],
  [
    69,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    "Helm",
    true,
  ],
  [
    70,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
    "Hammer",
    false,
  ],
  [
    71,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    "Kelch",
    false,
  ],
  [
    72,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 2],
    ],
    "Zange",
    false,
  ],
  [
    73,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 1],
    ],
    "Käfig",
    true,
  ],
  [
    74,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Waage",
    false,
  ],
  [
    75,
    5,
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Stern",
    true,
  ],
  [
    76,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Burg",
    false,
  ],
  [
    77,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Altar",
    false,
  ],
  [
    78,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    "Schwert",
    false,
  ],
  [
    79,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Klotz",
    false,
  ],
  [
    80,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Zahn",
    false,
  ],
  [
    81,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Muschel",
    false,
  ],
  [
    82,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Horn",
    false,
  ],
  [
    83,
    5,
    [
      [0, 0],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Nautilus",
    false,
  ],
  [
    84,
    5,
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Turmbau",
    false,
  ],
  [
    85,
    5,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Schloss",
    false,
  ],
  [
    86,
    5,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Sense",
    false,
  ],
  [
    87,
    5,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Drache",
    false,
  ],
  [
    88,
    5,
    [
      [0, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Fundament",
    false,
  ],
  [
    89,
    5,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Fahne",
    false,
  ],
  [
    90,
    5,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Totem",
    true,
  ],
  [
    91,
    5,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Geweih",
    false,
  ],
  [
    92,
    5,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Flöte",
    false,
  ],
  [
    93,
    5,
    [
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Schere",
    false,
  ],
  [
    94,
    5,
    [
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Schmetterling",
    true,
  ],
  [
    95,
    5,
    [
      [0, 1],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Bogen",
    false,
  ],
  [
    96,
    5,
    [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Pfeiler",
    true,
  ],
  [
    97,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    "Monolith",
    true,
  ],
  [
    98,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
    "Bollwerk",
    false,
  ],
  [
    99,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    "Thron",
    false,
  ],
  [
    100,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 2],
    ],
    "Tsunami",
    false,
  ],
  [
    101,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
    ],
    "Golem",
    false,
  ],
  [
    102,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 1],
    ],
    "Tempel",
    true,
  ],
  [
    103,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    "Donner",
    false,
  ],
  [
    104,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 1],
      [2, 2],
    ],
    "Flut",
    false,
  ],
  [
    105,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Diadem",
    false,
  ],
  [
    106,
    6,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Obelisk",
    true,
  ],
  [
    107,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Lawine",
    false,
  ],
  [
    108,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Lotse",
    false,
  ],
  [
    109,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    "Gezeiten",
    false,
  ],
  [
    110,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Koloss",
    true,
  ],
  [
    111,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Hydra",
    false,
  ],
  [
    112,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Chimäre",
    false,
  ],
  [
    113,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Wächter",
    false,
  ],
  [
    114,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Mantis",
    false,
  ],
  [
    115,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Phantom",
    false,
  ],
  [
    116,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Vulkan",
    false,
  ],
  [
    117,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Wiege",
    false,
  ],
  [
    118,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Kraken",
    false,
  ],
  [
    119,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Schlund",
    false,
  ],
  [
    120,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Titan",
    false,
  ],
  [
    121,
    6,
    [
      [0, 0],
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Phönix",
    false,
  ],
  [
    122,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Greifvogel",
    false,
  ],
  [
    123,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Kathedrale",
    true,
  ],
  [
    124,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Zitadelle",
    false,
  ],
  [
    125,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Sphinx",
    false,
  ],
  [
    126,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Leviathan",
    false,
  ],
  [
    127,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Skarabäus",
    false,
  ],
  [
    128,
    6,
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Portal",
    true,
  ],
  [
    129,
    6,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Mammut",
    false,
  ],
  [
    130,
    6,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Zerberus",
    false,
  ],
  [
    131,
    6,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Behemoth",
    false,
  ],
  [
    132,
    6,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Erdkern",
    false,
  ],
  [
    133,
    6,
    [
      [0, 0],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Fossil",
    false,
  ],
  [
    134,
    6,
    [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Ursprung",
    false,
  ],
  [
    135,
    6,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Banshee",
    false,
  ],
  [
    136,
    6,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Wyvern",
    true,
  ],
  [
    137,
    6,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Gorgone",
    false,
  ],
  [
    138,
    6,
    [
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Idol",
    true,
  ],
  [
    139,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    "Sturmkönig",
    false,
  ],
  [
    140,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    "Kronprinz",
    true,
  ],
  [
    141,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    "Wellenbrecher",
    false,
  ],
  [
    142,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    "Donnervogel",
    false,
  ],
  [
    143,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    "Gezeitenfürst",
    false,
  ],
  [
    144,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Drachenlord",
    false,
  ],
  [
    145,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Erzengel",
    true,
  ],
  [
    146,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Urgewalt",
    false,
  ],
  [
    147,
    7,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Weltentor",
    true,
  ],
  [
    148,
    7,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Schildwall",
    false,
  ],
  [
    149,
    7,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Kriegsherr",
    false,
  ],
  [
    150,
    7,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
    "Sturmflut",
    false,
  ],
  [
    151,
    7,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Erdmutter",
    false,
  ],
  [
    152,
    7,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Seelenfresser",
    false,
  ],
  [
    153,
    7,
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Tiefenwurm",
    false,
  ],
  [
    154,
    7,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Titanenschild",
    false,
  ],
  [
    155,
    7,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Runenwächter",
    true,
  ],
  [
    156,
    7,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Abgrund",
    false,
  ],
  [
    157,
    7,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Leere",
    true,
  ],
  [
    158,
    7,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Bergkönig",
    false,
  ],
  [
    159,
    7,
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Weltenseele",
    true,
  ],
  [
    160,
    8,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    "Archon",
    false,
  ],
  [
    161,
    8,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    "Ätherkrone",
    true,
  ],
  [
    162,
    8,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Schicksalstor",
    false,
  ],
  [
    163,
    8,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Ewiges Auge",
    true,
  ],
  [
    164,
    8,
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Urflut",
    false,
  ],
  [
    165,
    8,
    [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Lebensfunke",
    true,
  ],
  [
    166,
    9,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    "Vollkommen",
    true,
  ],
];

const TIERS = {
  1: { label: "Keim", sub: "Ursprung", color: "#888888", bg: "#88888812" },
  2: { label: "Bund", sub: "Verbindung", color: "#66AACC", bg: "#66AACC10" },
  3: { label: "Funke", sub: "Erwachen", color: "#44CC88", bg: "#44CC8810" },
  4: { label: "Gestalt", sub: "Formung", color: "#CCAA44", bg: "#CCAA4410" },
  5: { label: "Wesen", sub: "Bewusstsein", color: "#CC6644", bg: "#CC664410" },
  6: { label: "Titan", sub: "Macht", color: "#CC44AA", bg: "#CC44AA10" },
  7: { label: "Apex", sub: "Herrschaft", color: "#8844FF", bg: "#8844FF10" },
  8: { label: "Archon", sub: "Vollendung", color: "#FFD700", bg: "#FFD70010" },
  9: {
    label: "Absolut",
    sub: "Transzendenz",
    color: "#FFFFFF",
    bg: "#FFFFFF08",
  },
};

function hueFromId(id, size) {
  const base = size * 37 + id * 23;
  return base % 360;
}

function CreatureCard({ data, tick }) {
  const [id, size, cells, name, sym] = data;
  const tier = TIERS[size];
  const hue = hueFromId(id, size);
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));

  const px = size <= 3 ? 14 : size <= 6 ? 12 : 11;
  const gap = 2;
  const gridW = (maxC + 1) * (px + gap);
  const gridH = (maxR + 1) * (px + gap);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${tier.color}18`,
        borderRadius: 10,
        padding: "10px 10px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        transition: "all 0.2s",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${tier.color}12`;
        e.currentTarget.style.borderColor = `${tier.color}40`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.025)";
        e.currentTarget.style.borderColor = `${tier.color}18`;
        e.currentTarget.style.transform = "none";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 6,
          fontSize: 8,
          color: "#444",
          fontFamily: "monospace",
        }}
      >
        #{String(id + 1).padStart(3, "0")}
      </div>

      <div
        style={{
          width: 54,
          height: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: gridW, height: gridH }}>
          {Array.from({ length: maxR + 1 }, (_, r) =>
            Array.from({ length: maxC + 1 }, (_, c) => {
              const filled = cellSet.has(`${r},${c}`);
              if (!filled) return null;
              const cellIdx = r * 3 + c;
              const pulse =
                Math.sin((tick || 0) * 0.06 + cellIdx * 0.7) * 0.5 + 0.5;
              const sat = 65 + pulse * 15;
              const light = 50 + pulse * 12;
              const glowAmt = 4 + pulse * 6;
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: c * (px + gap),
                    top: r * (px + gap),
                    width: px,
                    height: px,
                    borderRadius: size >= 7 ? 3 : 2,
                    background: `hsl(${hue}, ${sat}%, ${light}%)`,
                    boxShadow: `0 0 ${glowAmt}px hsl(${hue}, 80%, 50%)`,
                    transition: "box-shadow 0.3s",
                  }}
                />
              );
            }),
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#ddd",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 100,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>
          {size}px{sym ? " · sym" : ""}
        </div>
      </div>
    </div>
  );
}

export default function Bestiary() {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(iv);
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const d of D) {
      const size = d[1];
      if (!g[size]) g[size] = [];
      g[size].push(d);
    }
    return g;
  }, []);

  const filtered = useMemo(() => {
    let items = filter === 0 ? D : D.filter((d) => d[1] === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter((d) => d[3].toLowerCase().includes(s));
    }
    return items;
  }, [filter, search]);

  const counts = useMemo(() => {
    const c = {};
    for (const d of D) c[d[1]] = (c[d[1]] || 0) + 1;
    return c;
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080e",
        color: "#ccc",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "20px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#fff",
            }}
          >
            BESTIARY
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "#555",
              letterSpacing: 2,
            }}
          >
            ALLE 167 FORMEN · 3×3 KING-ADJACENCY · NUR SPIEGELUNG
          </p>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
            const t = TIERS[s];
            return (
              <div key={s} style={{ textAlign: "center", lineHeight: 1.2 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.color }}>
                  {counts[s] || 0}
                </div>
                <div style={{ fontSize: 9, color: "#555" }}>{s}px</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 16,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => setFilter(0)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 11,
              background:
                filter === 0
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.02)",
              border:
                filter === 0
                  ? "1px solid rgba(255,255,255,0.2)"
                  : "1px solid rgba(255,255,255,0.05)",
              color: filter === 0 ? "#fff" : "#666",
              cursor: "pointer",
            }}
          >
            Alle ({D.length})
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
            const t = TIERS[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  background:
                    filter === s ? `${t.color}20` : "rgba(255,255,255,0.02)",
                  border:
                    filter === s
                      ? `1px solid ${t.color}40`
                      : "1px solid rgba(255,255,255,0.05)",
                  color: filter === s ? t.color : "#666",
                  cursor: "pointer",
                }}
              >
                {t.label} ({counts[s] || 0})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <input
            type="text"
            placeholder="Name suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ccc",
              outline: "none",
              width: 200,
            }}
          />
        </div>

        {/* Grid */}
        {filter === 0 && !search.trim() ? (
          // Grouped by tier
          Object.entries(grouped).map(([size, items]) => {
            const t = TIERS[size];
            return (
              <div key={size} style={{ marginBottom: 28 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${t.color}15`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: t.color,
                    }}
                  >
                    Stufe {size} — {t.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#555" }}>
                    {t.sub} · {items.length} Formen
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(105px, 1fr))",
                    gap: 6,
                  }}
                >
                  {items.map((d) => (
                    <CreatureCard key={d[0]} data={d} tick={tick} />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Flat filtered
          <div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>
              {filtered.length} Ergebnis{filtered.length !== 1 ? "se" : ""}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))",
                gap: 6,
              }}
            >
              {filtered.map((d) => (
                <CreatureCard key={d[0]} data={d} tick={tick} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 32,
            textAlign: "center",
            fontSize: 11,
            color: "#333",
            lineHeight: 1.8,
          }}
        >
          <div style={{ marginBottom: 8, color: "#555" }}>
            Mathematik: Zusammenhängende Teilmengen im King-Graphen (3×3)
          </div>
          <div>
            Symmetrie: Nur L/R-Spiegelung (Kreatur kann in beide Richtungen
            schauen)
          </div>
          <div>Rotation ≠ gleich (horizontal ≠ vertikal)</div>
          <div style={{ marginTop: 8, color: "#444" }}>
            Rekursion: Ein vollendetes 9er wird zum Pixel der nächsten Ebene
          </div>
        </div>
      </div>
    </div>
  );
}
