// Generated from actual human-v2 exports by assets-source/player-v2/finalize_manifest.py.
// Keep released versioned assets immutable; retain human-v1 for saved appearances.
export const HUMAN_V2_ASSETS = {
  "assetVersion": "human-v2",
  "animationVersion": "football-clips-v2.0.0",
  "manifest": "/assets/player-v2/manifest.json",
  "presentation": "/assets/player-v2/player.glb",
  "phone": "/assets/player-v2/player-mobile.glb",
  "match": "/assets/player-v2/player-match.glb",
  "baseHeightMetres": 1.8,
  "benchSeatHeightMetres": 0.49,
  "joints": 53,
  "crossfadeSeconds": 0.16,
  "skinRoughnessFactor": 1
} as const;
export type HumanV2Clip = "idle" | "warmup" | "nod" | "walk" | "run" | "sprint" | "dribble" | "accelerate" | "stop" | "turn_left" | "turn_right" | "receive" | "pass" | "shoot" | "cross" | "penalty" | "tackle" | "slide" | "header" | "gk_idle" | "gk_catch" | "gk_dive_left" | "gk_dive_right" | "bench" | "celebrate" | "receive_left" | "pass_left" | "shoot_left" | "cross_left" | "penalty_left" | "tackle_left" | "slide_left";
export interface HumanV2Contact {readonly seconds:number; readonly frame:number; readonly bone:string; readonly surface:string; readonly event:string; readonly foot?:"left"|"right"; readonly fraction?:number; readonly localPosition:readonly [number,number,number]; readonly ballCentreOffset:readonly [number,number,number]}
export interface HumanV2ClipDefinition {readonly seconds:number; readonly loop:boolean; readonly nominalMetresPerSecond:number; readonly stanceFraction?:number; readonly stanceTravelMetres?:number; readonly contact?:HumanV2Contact}
export const HUMAN_V2_CLIPS: Readonly<Record<HumanV2Clip,HumanV2ClipDefinition>> = {
  "idle": {
    "seconds": 4.0,
    "loop": true,
    "nominalMetresPerSecond": 0
  },
  "warmup": {
    "seconds": 3.0,
    "loop": true,
    "nominalMetresPerSecond": 0
  },
  "nod": {
    "seconds": 1.8,
    "loop": false,
    "nominalMetresPerSecond": 0
  },
  "walk": {
    "seconds": 1.0666666666666667,
    "loop": true,
    "nominalMetresPerSecond": 0.5819,
    "stanceFraction": 0.58,
    "stanceTravelMetres": 0.36
  },
  "run": {
    "seconds": 0.7333333333333333,
    "loop": true,
    "nominalMetresPerSecond": 3.0909,
    "stanceFraction": 0.3,
    "stanceTravelMetres": 0.68
  },
  "sprint": {
    "seconds": 0.6,
    "loop": true,
    "nominalMetresPerSecond": 5.641,
    "stanceFraction": 0.26,
    "stanceTravelMetres": 0.88
  },
  "dribble": {
    "seconds": 0.7666666666666667,
    "loop": true,
    "nominalMetresPerSecond": 1.8414,
    "contact": {
      "seconds": 0.2,
      "foot": "right",
      "event": "controlledTouch",
      "frame": 6,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.1196,
        0.1344,
        0.3123
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    },
    "stanceFraction": 0.34,
    "stanceTravelMetres": 0.48
  },
  "accelerate": {
    "seconds": 0.7333333333333333,
    "loop": false,
    "nominalMetresPerSecond": 0
  },
  "stop": {
    "seconds": 0.8,
    "loop": false,
    "nominalMetresPerSecond": 0
  },
  "turn_left": {
    "seconds": 0.6,
    "loop": false,
    "nominalMetresPerSecond": 0
  },
  "turn_right": {
    "seconds": 0.6,
    "loop": false,
    "nominalMetresPerSecond": 0
  },
  "receive": {
    "seconds": 0.8,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.38,
      "foot": "right",
      "event": "cushion",
      "seconds": 0.3,
      "frame": 9,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.1504,
        0.1245,
        0.4897
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "pass": {
    "seconds": 1.0,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.5,
      "foot": "right",
      "event": "kick",
      "seconds": 0.5,
      "frame": 15,
      "bone": "foot_r",
      "surface": "instep",
      "localPosition": [
        -0.1143,
        0.0786,
        0.3528
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "shoot": {
    "seconds": 1.1333333333333333,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "foot": "right",
      "event": "kick",
      "seconds": 0.6,
      "frame": 18,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.1296,
        0.0377,
        0.5155
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "cross": {
    "seconds": 1.2,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "foot": "right",
      "event": "kick",
      "seconds": 0.6333333333333333,
      "frame": 19,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.4193,
        0.0486,
        0.5025
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "penalty": {
    "seconds": 1.2666666666666666,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "foot": "right",
      "event": "kick",
      "seconds": 0.6666666666666666,
      "frame": 20,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.1296,
        0.0378,
        0.5151
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "tackle": {
    "seconds": 0.9,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.45,
      "foot": "right",
      "event": "tackleContact",
      "seconds": 0.4,
      "frame": 12,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.1494,
        0.0936,
        0.7115
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "slide": {
    "seconds": 1.4,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.43,
      "foot": "right",
      "event": "tackleContact",
      "seconds": 0.6,
      "frame": 18,
      "bone": "foot_r",
      "surface": "forefoot",
      "localPosition": [
        -0.1594,
        0.0706,
        0.7717
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "header": {
    "seconds": 0.9333333333333333,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.56,
      "bone": "head",
      "event": "headerContact",
      "seconds": 0.5333333333333333,
      "frame": 16,
      "surface": "forehead",
      "localPosition": [
        0.0,
        1.9151,
        0.1813
      ],
      "ballCentreOffset": [
        0,
        0.035,
        0.1
      ]
    }
  },
  "gk_idle": {
    "seconds": 1.8,
    "loop": true,
    "nominalMetresPerSecond": 0
  },
  "gk_catch": {
    "seconds": 1.0666666666666667,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "bone": "hand_r",
      "event": "catch",
      "seconds": 0.5666666666666667,
      "frame": 17,
      "surface": "palm",
      "localPosition": [
        -0.1044,
        1.752,
        0.4428
      ],
      "ballCentreOffset": [
        0,
        0,
        0.095
      ]
    }
  },
  "gk_dive_left": {
    "seconds": 1.3,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.56,
      "bone": "hand_l",
      "event": "saveContact",
      "seconds": 0.7333333333333333,
      "frame": 22,
      "surface": "palm",
      "localPosition": [
        0.8376,
        1.2159,
        0.307
      ],
      "ballCentreOffset": [
        0,
        0,
        0.095
      ]
    }
  },
  "gk_dive_right": {
    "seconds": 1.3,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.56,
      "bone": "hand_r",
      "event": "saveContact",
      "seconds": 0.7333333333333333,
      "frame": 22,
      "surface": "palm",
      "localPosition": [
        -0.8376,
        1.2159,
        0.307
      ],
      "ballCentreOffset": [
        0,
        0,
        0.095
      ]
    }
  },
  "bench": {
    "seconds": 4.0,
    "loop": true,
    "nominalMetresPerSecond": 0
  },
  "celebrate": {
    "seconds": 2.6,
    "loop": false,
    "nominalMetresPerSecond": 0
  },
  "receive_left": {
    "seconds": 0.8,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.38,
      "foot": "left",
      "event": "cushion",
      "seconds": 0.3,
      "frame": 9,
      "bone": "foot_l",
      "surface": "forefoot",
      "localPosition": [
        0.1504,
        0.1245,
        0.4897
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "pass_left": {
    "seconds": 1.0,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.5,
      "foot": "left",
      "event": "kick",
      "seconds": 0.5,
      "frame": 15,
      "bone": "foot_l",
      "surface": "instep",
      "localPosition": [
        0.1143,
        0.0786,
        0.3528
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "shoot_left": {
    "seconds": 1.1333333333333333,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "foot": "left",
      "event": "kick",
      "seconds": 0.6,
      "frame": 18,
      "bone": "foot_l",
      "surface": "forefoot",
      "localPosition": [
        0.1296,
        0.0377,
        0.5155
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "cross_left": {
    "seconds": 1.2,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "foot": "left",
      "event": "kick",
      "seconds": 0.6333333333333333,
      "frame": 19,
      "bone": "foot_l",
      "surface": "forefoot",
      "localPosition": [
        0.4193,
        0.0486,
        0.5025
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "penalty_left": {
    "seconds": 1.2666666666666666,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.53,
      "foot": "left",
      "event": "kick",
      "seconds": 0.6666666666666666,
      "frame": 20,
      "bone": "foot_l",
      "surface": "forefoot",
      "localPosition": [
        0.1296,
        0.0378,
        0.5151
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "tackle_left": {
    "seconds": 0.9,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.45,
      "foot": "left",
      "event": "tackleContact",
      "seconds": 0.4,
      "frame": 12,
      "bone": "foot_l",
      "surface": "forefoot",
      "localPosition": [
        0.1494,
        0.0936,
        0.7115
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  },
  "slide_left": {
    "seconds": 1.4,
    "loop": false,
    "nominalMetresPerSecond": 0,
    "contact": {
      "fraction": 0.43,
      "foot": "left",
      "event": "tackleContact",
      "seconds": 0.6,
      "frame": 18,
      "bone": "foot_l",
      "surface": "forefoot",
      "localPosition": [
        0.1594,
        0.0706,
        0.7717
      ],
      "ballCentreOffset": [
        0,
        0.025,
        0.105
      ]
    }
  }
};
export const HUMAN_V2_HASHES = {
  "player.glb": "0890138840add6f0c767875cd828709590a8872212c84da24fce735ee7651e3f",
  "player-mobile.glb": "8926c021d121743569963dea334bff1f92de76942d64195c0a1bb47821c386f3",
  "player-match.glb": "99221e6b27038ebc553f117faaa375afedddb02bfe24b5d757fa8dd829bd0fcf"
} as const;
