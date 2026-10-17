// Special moves and combo finishers, one character each. Same conventions as moves.mjs: keys in
// base frames on the stance (or crouch / air), "w" wind-ups and "f" follow-throughs scaled by
// style, hit targets after the camera cheat. Projectiles leave from the rear fist (bF) on the
// release frame, so the throwing hand is out in front then.
import { v3 } from "./m3.mjs";
import { A, PALM_DOWN } from "./moves.mjs";

const FUK = (c) => 0.72 / c.ch.scale;   // fighter units -> model units for this fighter

// keys every frame for a channel that follows a function (spins, wheels)
function track(from, to, step, fn) { const out = []; for (let f = from; f <= to; f += step) out.push([f, fn(f)]); return out; }
const merge = (keys) => {
  // merge keys that share a frame (later specs win field by field)
  const m = new Map();
  for (const [f, sp, tag] of keys) { const prev = m.get(f); m.set(f, prev ? [f, { ...prev[1], ...sp }, prev[2] || tag] : [f, sp, tag]); }
  return [...m.values()].sort((a, b) => a[0] - b[0]);
};

export const SPECIAL_ANIMS = {
  // ================================================================ TIMBER
  // Knot Shot: rear hand cocks back by the ear, then fires the knot out with a straight-arm
  // shove and the hips behind it.
  knotShot: (c) => {
    const rel = c.pre([30, -2, 52]);
    return {
      keys: [
        [0, {}],
        [6, { R: { w: c.pre([-4, -10, 60]), aim: A(1, 0, 0.2) }, L: { d: [2, 1, -1] }, twist: -16, hipYaw: -10, pelvis: [-1.5, 0, -0.8], lean: -4 }, "w"],
        [12, { R: { w: rel, aim: A(1, 0, 0), up: [0, 1, 0] }, L: { d: [-3, 0, 1] }, twist: 26, hipYaw: 22, pelvis: [3, 0, -1.4], lean: 8, fR: { yaw: 30, pitch: -14, d: [1, 1, 0.5] }, fistR: 0.2 }],
        [16, { R: { w: v3.add(rel, [1, 0, 0]), aim: A(1, 0, 0), up: [0, 1, 0] }, L: { d: [-3, 0, 1] }, twist: 26, hipYaw: 22, pelvis: [3.2, 0, -1.4], lean: 8, fR: { yaw: 30, pitch: -14, d: [1, 1, 0.5] }, fistR: 0.2 }],
        [23, { R: { d: [3, 0, 0] }, twist: 8, hipYaw: 6, pelvis: [1, 0, -0.4] }, "f"],
        [30, {}],
      ],
    };
  },
  // Haymaker: a huge wind-up, then a looping rear hand thrown with the whole body as he
  // lunges forward; he stays over the punch as the lunge carries him, then recovers.
  haymaker: (c) => {
    const k = FUK(c);
    const T = c.pre([60 * k, -1, 73 * k]);
    const lunge = { R: { w: T, aim: A(1, 0.2, 0), up: [0, 0, 1] }, L: { d: [-5, -1, 0] }, twist: 34, hipYaw: 28, pelvis: [6, 0, -3.5], lean: 20, shR: 10,
      fL: { d: [6, 0, 0], yaw: 10 }, fR: { d: [-2, 0, 1.5], pitch: -30, yaw: 30 }, look: c.pre([90, 0, 52]) };
    return {
      target: (hi, f) => (f < 12 ? [23 * k + (f - 11) * 25 * k, 68 * k] : f < 13 ? [48 * k, 73 * k] : [60 * k, 73 * k]),
      keys: [
        [0, {}],
        [5, { R: { w: c.pre([-14, -12, 54]), aim: A(-0.2, -0.3, 1), elbow: c.pre([-8, -18, 46]) }, twist: -34, hipYaw: -24, pelvis: [-3, 0, -2], lean: -6, L: { d: [3, 2, 0] } }, "w"],
        [9, { R: { w: c.pre([-16, -13, 56]), aim: A(-0.2, -0.3, 1), elbow: c.pre([-10, -18, 47]) }, twist: -38, hipYaw: -26, pelvis: [-3.5, 0, -2.4], lean: -8, L: { d: [3, 2, 0] } }, "w"],
        [12, { ...lunge, R: { w: c.pre([40 * k, -8, 70 * k]), aim: A(0.6, 0.6, 0), up: [0, 0, 1], elbow: c.pre([10, -20, 52]) }, twist: 20, hipYaw: 14 }],
        [14, lunge],
        [23, { ...lunge, pelvis: [6.5, 0, -3.5] }],
        [32, { R: { d: [6, 0, -2] }, twist: 12, hipYaw: 10, pelvis: [3, 0, -2], lean: 10, fL: { d: [3, 0, 0] } }, "f"],
        [46, {}],
      ],
    };
  },
  // Rising Splinter: from the crouch the rear fist drives up past his face as he leaps,
  // the body stretched tall; he falls with the arm still up, knees tucked.
  risingSplinter: (c) => {
    const k = FUK(c);
    const top = { lean: -34, twist: 26, hipYaw: 18, shR: 16, look: c.pre([50, 0, 90]), L: { d: [0, 0, 6] } };
    return {
      base: "crouch",
      target: (hi, f) => (f < 6 ? [12 * k, (94 + (f - 3) * 4) * k] : [10 * k, 108 * k]),
      keys: [
        [0, {}],
        [2, { pelvis: [-0.5, 0, -1.5], R: { d: [-2, -1, -6] }, twist: -8 }, "w"],
        [4, { ...top, pelvis: [3, 0, 14], R: { w: c.pre([12 * k, -2, 98 * k]), aim: A(0.2, 0, 1), elbow: c.pre([10, -12, 52]) }, fR: { pitch: -30, d: [1, 1, 2] } }],
        [8, { ...top, pelvis: [3, 0, 15], R: { w: c.pre([10 * k, -2, 108 * k]), aim: A(0.1, 0, 1), elbow: c.pre([8, -12, 58]) }, fL: { d: [2, 0, 8], pitch: -30 }, fR: { d: [-1, 0, 4], pitch: -50 } }],
        [16, { ...top, pelvis: [3, 0, 15], R: { w: c.pre([10 * k, -2, 107 * k]), aim: A(0.1, 0, 1), elbow: c.pre([8, -12, 58]) }, fL: { d: [3, 0, 10], pitch: -30 }, fR: { d: [-1, 0, 6], pitch: -50 } }],
        [30, { pelvis: [2, 0, 12], lean: -24, twist: 8, R: { d: [2, 0, 4] }, fL: { d: [2, 0, 6], pitch: -25 }, fR: { d: [0, 0, 4], pitch: -40 } }, "f"],
      ],
    };
  },
  // Splitter: the rear hand after the jab, thrown long with a step
  splitter: (c) => {
    const X = c.tgt("splitter", 0, { dy: -0.5 });
    const hold = { R: { w: X, aim: A(1, 0, 0.05), up: PALM_DOWN }, L: { d: [-4, -0.5, 1.5] }, twist: 32, hipYaw: 28, pelvis: [3.5, 0, -1], lean: 6, shR: 10, fR: { yaw: 36, pitch: -16, d: [1.5, 0.8, 0.6] } };
    return {
      keys: [
        [0, { L: { d: [6, 0, -0.5] }, twist: -8, pelvis: [1, 0, -0.4] }],
        [3, { L: { d: [2, 0, 0] }, twist: -12, hipYaw: -8, pelvis: [-0.5, 0, -0.6], R: { d: [-2, -1, -1] } }, "w"],
        [7, hold],
        [10, { ...hold, pelvis: [3.8, 0, -1] }],
        [16, { R: { d: [4, 0, 0.5] }, twist: 10, hipYaw: 10, pelvis: [1.5, 0, -0.4] }, "f"],
        [27, {}],
      ],
    };
  },
  // Timber Fall: a chopping rear roundhouse that comes down through the head
  timberFall: (c) => {
    const T = c.tgt("timberFall", 0, { dy: -2, at: 11 });
    const ank = v3.add(T, [-2.5, 0, -1]);
    const kick = { fR: { w: ank, yaw: 70, pitch: 10, knee: c.pre([18, -40, 66]) }, fL: { yaw: 100 }, hipYaw: 100, hipRoll: 18, lean: -20, side: -10, twist: -36, pelvis: [1.5, 1.5, 3],
      R: { d: [-6, -4, -10] }, L: { d: [-2, 3, 2] }, look: c.pre([90, 0, 56]) };
    return {
      keys: [
        [0, {}],
        [4, { fR: { w: c.pre([-6, -14, 18]), yaw: 20, pitch: -20, knee: c.pre([10, -40, 50]) }, fL: { yaw: 50 }, hipYaw: 40, lean: -6, twist: -14, pelvis: [0, 0.5, 1.5] }, "w"],
        [10, { ...kick, fR: { ...kick.fR, w: v3.add(ank, [-1, 0, 6]) } }],
        [13, kick],
        [19, { fR: { w: c.pre([6, -6, 14]), yaw: 30, pitch: -20, knee: c.pre([20, -30, 40]) }, fL: { yaw: 50 }, hipYaw: 50, lean: -8, twist: -16, pelvis: [0.5, 0.5, 1] }, "f"],
        [26, { fR: { d: [1, 0, 0] }, fL: { yaw: 12 }, hipYaw: 8, pelvis: [0.3, 0, -0.6] }],
        [34, {}],
      ],
    };
  },
  // Root Sweep: from the crouch the lead leg shoots out along the floor
  rootSweep: (c) => {
    const T = c.tgt("rootSweep", 0, { dy: 6 });
    const ank = v3.add(T, [-5, 0, 0.5]);
    const sw = { fL: { w: ank, yaw: -20, pitch: 15, knee: c.pre([30, 20, 20]) }, fR: { pitch: -30 }, pelvis: [3, 0, -6], lean: 18, hipYaw: -18, twist: 10, R: { w: c.pre([4, -12, 3]), aim: A(0.3, 0, -1) }, L: { d: [-4, 2, -6] } };
    return {
      base: "crouch",
      keys: [
        [0, {}],
        [3, { pelvis: [0, 0, -4], lean: 6, fL: { w: c.pre([8, 6, 7]), pitch: -10 }, R: { w: c.pre([4, -12, 3]), aim: A(0.3, 0, -1) } }, "w"],
        [7, sw],
        [11, { ...sw, fL: { ...sw.fL, w: v3.add(ank, [0.5, 0, 0]) } }],
        [18, { pelvis: [1, 0, -3], lean: 8, fL: { w: c.pre([12, 6, 5]) }, R: { w: c.pre([4, -12, 3]) } }, "f"],
        [30, {}],
      ],
    };
  },

  // ================================================================ BRASS
  // Cog Toss: rears back with the cog low behind, then hurls it overhand up and forward
  cogToss: (c) => ({
    keys: [
      [0, {}],
      [8, { R: { w: c.pre([-14, -10, 36]), aim: A(-1, 0, -0.3) }, L: { d: [4, 2, -2] }, twist: -24, hipYaw: -16, lean: 12, pelvis: [-2, 0, -2] }, "w"],
      [13, { R: { w: c.pre([-2, -10, 66]), aim: A(0.2, 0, 1) }, twist: 4, hipYaw: 2, lean: -6, pelvis: [0, 0, 0] }],
      [16, { R: { w: c.pre([22, -4, 64]), aim: A(1, 0, 0.6) }, L: { d: [-3, 0, 0] }, twist: 26, hipYaw: 20, lean: 6, pelvis: [3, 0, -1], fR: { yaw: 28, pitch: -16, d: [1, 1, 0.5] }, fistR: 0.1 }],
      [20, { R: { w: c.pre([24, -3, 60]), aim: A(1, 0, 0.2) }, twist: 26, hipYaw: 20, lean: 8, pelvis: [3, 0, -1], fR: { yaw: 28, pitch: -16, d: [1, 1, 0.5] }, fistR: 0.1 }],
      [27, { R: { d: [3, 0, -2] }, twist: 8, hipYaw: 6, pelvis: [1, 0, -0.5] }, "f"],
      [34, {}],
    ],
  }),
  // Steam Ram: lowers the lead shoulder, braces, and charges in heavy strides
  steamRam: (c) => {
    const k = FUK(c);
    const ram = { lean: 32, twist: -26, hipYaw: -18, shL: 10, pelvis: [5, 0, -4], look: c.pre([90, 0, 46]), L: { w: c.pre([16, 8, 42]), aim: A(0.6, -0.6, 0.4) }, R: { w: c.pre([12, -2, 44]), aim: A(0.8, 0.3, 0.4) }, headPitch: 10 };
    const stride = (f, a) => [f, { ...ram, fL: { d: [a * 6, 0, a > 0 ? 3 : 0], pitch: a > 0 ? -10 : 0 }, fR: { d: [-a * 6, 0, a < 0 ? 3 : 0], pitch: a < 0 ? -30 : -10 } }];
    return {
      noReach: [0],
      keys: [
        [0, {}],
        [6, { pelvis: [-1, 0, -3], lean: 8, twist: -10, L: { d: [0, 2, 2] }, R: { d: [0, -2, 1] } }, "w"],
        [10, { pelvis: [-1.5, 0, -4], lean: 14, twist: -16, shL: 8, L: { d: [0, 2, 1] }, R: { d: [0, -2, 1] } }, "w"],
        stride(14, 1), stride(19, -1), stride(24, 1), stride(29, -1),
        [34, { pelvis: [2, 0, -2], lean: 14, twist: -8, fL: { d: [3, 0, 0] } }, "f"],
        [44, {}],
      ],
    };
  },
  // Piston Stomp: knee hauled up high, both fists raised, then foot and fists slam down
  pistonStomp: (c) => ({
    keys: [
      [0, {}],
      [8, { fL: { w: c.pre([8, 6, 26]), pitch: -20, knee: c.pre([30, 8, 60]) }, pelvis: [-1, 0, 2.5], lean: -8, L: { w: c.pre([4, 12, 74]), aim: A(0, 0, 1) }, R: { w: c.pre([2, -12, 74]), aim: A(0, 0, 1) }, look: c.pre([90, 0, 50]) }, "w"],
      [15, { fL: { w: c.pre([10, 7, 30]), pitch: -15, knee: c.pre([30, 8, 64]) }, pelvis: [-1, 0, 3.5], lean: -10, L: { w: c.pre([4, 12, 78]), aim: A(0, 0, 1) }, R: { w: c.pre([2, -12, 78]), aim: A(0, 0, 1) } }, "w"],
      [18, { fL: { w: c.pre([12, 7, 4.3]), pitch: 0 }, pelvis: [1, 0, -7], lean: 26, L: { w: c.pre([18, 6, 22]), aim: A(0.3, 0, -1) }, R: { w: c.pre([16, -6, 22]), aim: A(0.3, 0, -1) }, headPitch: 14, look: c.pre([60, 0, 0]) }],
      [24, { fL: { w: c.pre([12, 7, 4.3]) }, pelvis: [1, 0, -7.5], lean: 28, L: { w: c.pre([18, 6, 21]), aim: A(0.3, 0, -1) }, R: { w: c.pre([16, -6, 21]), aim: A(0.3, 0, -1) }, headPitch: 14 }],
      [32, { fL: { d: [1, 0, 0] }, pelvis: [0.5, 0, -3], lean: 12, L: { d: [0, 0, -6] }, R: { d: [0, 0, -6] } }, "f"],
      [40, {}],
    ],
  }),
  // Rivet Hammer: both fists clasped overhead, then a sledgehammer blow down onto the head
  rivetHammer: (c) => {
    const T = c.tgt("rivetHammer", 0, { dy: 0 });
    const hit = { L: { w: v3.add(T, [0, 2, 0]), aim: A(1, 0, -0.5) }, R: { w: v3.add(T, [-1, -2, 1]), aim: A(1, 0, -0.5) }, lean: 30, twist: 4, pelvis: [4, 0, -5], headPitch: 10, look: c.pre([70, 0, 30]) };
    return {
      keys: [
        [0, {}],
        [6, { L: { w: c.pre([-2, 3, 86]), aim: A(-0.3, 0, 1) }, R: { w: c.pre([-3, -3, 86]), aim: A(-0.3, 0, 1) }, lean: -12, pelvis: [-1, 0, 2.5], look: c.pre([90, 0, 70]) }, "w"],
        [9, { L: { w: c.pre([-4, 3, 88]), aim: A(-0.4, 0, 1) }, R: { w: c.pre([-5, -3, 88]), aim: A(-0.4, 0, 1) }, lean: -16, pelvis: [-1.5, 0, 3] }, "w"],
        [11, hit],
        [15, { ...hit, pelvis: [4.2, 0, -5.4] }],
        [22, { L: { d: [2, 0, -4] }, R: { d: [2, 0, -4] }, lean: 14, pelvis: [2, 0, -2.5] }, "f"],
        [35, {}],
      ],
    };
  },
  // Boiler Kick: a heavy lead-leg push kick to the head, body leaning back over it
  boilerKick: (c) => {
    const T = c.tgt("boilerKick", 0, { dy: 4 });
    const ank = v3.add(T, [-4.5, 0, -2]);
    const kick = { fL: { w: ank, pitch: 30, knee: c.pre([30, 8, 70]) }, pelvis: [2, 0, 2], lean: -20, hipYaw: -8, R: { d: [0, 0, 2] }, L: { d: [-4, 0, -4] } };
    return {
      keys: [
        [0, {}],
        [5, { fL: { w: c.pre([10, 6, 30]), pitch: -20, knee: c.pre([30, 8, 70]) }, pelvis: [-1, 0, 1.5], lean: -8 }, "w"],
        [10, kick],
        [14, { ...kick, fL: { ...kick.fL, w: v3.add(ank, [0.6, 0, 0]) } }],
        [20, { fL: { w: c.pre([12, 6, 26]), pitch: -20, knee: c.pre([30, 8, 70]) }, pelvis: [0.5, 0, 1], lean: -8 }, "f"],
        [26, { fL: { d: [1, 0, 0] }, pelvis: [0.3, 0, -1] }],
        [32, {}],
      ],
    };
  },
  // Gear Grind: a low stamping kick into the shins from the crouch
  gearGrind: (c) => {
    const T = c.tgt("gearGrind", 0, { dy: 6 });
    const ank = v3.add(T, [-5, 0, 2]);
    const hit = { fL: { w: ank, yaw: -40, pitch: 5, knee: c.pre([20, 30, 30]) }, pelvis: [3, 0, -2], lean: 14, hipYaw: -20, twist: 12, L: { d: [-2, 2, -2] }, R: { d: [2, 0, 0] } };
    return {
      base: "crouch",
      keys: [
        [0, {}],
        [5, { fL: { w: c.pre([8, 7, 12]), pitch: -20, knee: c.pre([30, 20, 40]) }, pelvis: [-1, 0, 1], lean: 6 }, "w"],
        [10, hit],
        [14, { ...hit, fL: { ...hit.fL, w: v3.add(ank, [0.5, 0, 0]) } }],
        [21, { fL: { w: c.pre([12, 7, 6]) }, pelvis: [1, 0, 0], lean: 6 }, "f"],
        [34, {}],
      ],
    };
  },

  // ================================================================ PIROUETTE
  // Spin Kick: up on the rear toes, the lead leg out straight, spinning three times; the leg
  // passes in front on each hit
  spinKick: (c) => {
    const k = FUK(c);
    const legAt = c.pre([40 * k - 6, 4, 59 * k + 2]);
    const pose = { fR: { w: [0, 0, 6.2], pitch: -35, yaw: -42 }, fL: { w: legAt, pitch: 10, knee: c.pre([30, 10, 70]) }, pelvis: [-0.5, 0, 3.5], lean: -10, side: -6, L: { w: c.pre([4, 22, 60]), aim: A(0, 1, 0) }, R: { w: c.pre([2, -22, 60]), aim: A(0, -1, 0) }, fistL: 0.1, fistR: 0.1 };
    const per = 8.25, f0 = 9.5;
    const spinAt = (f) => (360 * (f - f0)) / per;
    const keys = [
      [0, {}],
      [4, { fR: { w: [0, 0, 6.2], pitch: -30, yaw: -42 }, fL: { w: c.pre([12, 6, 24]), pitch: -10, knee: c.pre([30, 10, 60]) }, pelvis: [-0.5, 0, 2.5], lean: -4, spin: spinAt(4) * 0.5 }, "w"],
      ...track(6, 30, 1, (f) => ({ ...pose, spin: spinAt(f) })),
      [36, { fL: { d: [1, 0, 0] }, spin: 1080, pelvis: [0, 0, -0.5] }, "f"],
      [40, { spin: 1080 }],
    ];
    return { keys, noReach: [0, 1, 2] };
  },
  // Glide: drops into a feet-first slide, lead leg out low, rear leg folded, a hand trailing
  glide: (c) => {
    const T = c.tgt("glide", 0, { dy: 4 });
    const ank = v3.add(T, [-5, 0, 0]);
    const slide = { pelvis: [-2, 0, -26], hipPitch: -40, lean: 24, twist: -8, fL: { w: ank, yaw: -10, pitch: 20, knee: c.pre([20, 10, 30]) }, fR: { w: c.pre([4, -8, 3]), pitch: 0, yaw: 60, knee: c.pre([10, -30, 20]) },
      R: { w: c.pre([-14, -12, 3]), aim: A(-0.3, 0, -1) }, L: { d: [0, 2, -2] }, look: c.pre([90, 0, 30]) };
    return {
      keys: [
        [0, {}],
        [4, { pelvis: [-1, 0, -10], hipPitch: -16, lean: 12, fL: { w: c.pre([18, 6, 8]), pitch: 10 }, R: { w: c.pre([-10, -12, 10]) } }],
        [6, slide],
        [20, { ...slide, fL: { ...slide.fL, w: v3.add(ank, [0.5, 0, 0]) } }],
        [26, { pelvis: [-1, 0, -12], hipPitch: -14, lean: 14, fL: { w: c.pre([16, 6, 4.3]) }, fR: { w: c.pre([0, -7, 4.3]) }, R: { d: [0, 0, -6] } }, "f"],
        [36, {}],
      ],
    };
  },
  // Fouette: springs up out of the crouch, the lead leg whipping up in an arc as she spins
  fouette: (c) => {
    const k = FUK(c);
    const air = { pelvis: [2, 0, 15], lean: -14, L: { w: c.pre([2, 22, 66]), aim: A(0, 1, 0.3) }, R: { w: c.pre([0, -22, 64]), aim: A(0, -1, 0.3) }, fR: { d: [-2, 0, 6], pitch: -50 }, fistL: 0.1, fistR: 0.1 };
    return {
      base: "crouch",
      target: (hi, f) => (f < 9 ? [26 * k, 34 * k] : f < 12 ? [12 * k, 62 * k] : [3 * k, 79 * k]),
      keys: [
        [0, {}],
        [3, { pelvis: [0, 0, -1.5], lean: 6, L: { d: [0, 2, -2] } }, "w"],
        [5, { ...air, fL: { w: c.pre([26 * k - 6, 4, 34 * k + 2]), pitch: 0, knee: c.pre([30, 10, 60]) }, spin: 0 }],
        [10, { ...air, fL: { w: c.pre([12 * k - 4, 4, 62 * k - 4]), pitch: 30, knee: c.pre([20, 10, 80]) }, spin: -90 }],
        [16, { ...air, fL: { w: c.pre([3 * k - 2, 4, 79 * k - 6]), pitch: 50, knee: c.pre([10, 10, 90]) }, spin: -180 }],
        [22, { ...air, fL: { d: [2, 0, 8], pitch: -30 }, spin: -300, lean: -8 }],
        [28, { ...air, fL: { d: [2, 0, 6], pitch: -30 }, spin: -360, lean: -4 }, "f"],
      ],
    };
  },
  // Pas de Deux: two quick hands, rear then lead, gliding forward
  pasDeDeux: (c) => {
    const X1 = c.tgt("pasDeDeux", 0, { dy: -0.5 }), X2 = c.tgt("pasDeDeux", 1, { dy: 1.5 });
    return {
      keys: [
        [0, {}],
        [2, { R: { d: [-1, -1, 0] }, twist: -6 }, "w"],
        [5, { R: { w: X1, aim: A(1, 0, 0), up: PALM_DOWN }, L: { d: [-2, 0, 1] }, twist: 24, hipYaw: 18, pelvis: [2.5, 0, -0.6], lean: 5, fR: { yaw: 25, pitch: -12 } }],
        [7, { R: { w: v3.add(X1, [-2, 0, 0]), aim: A(1, 0, 0) }, twist: 18, hipYaw: 14, pelvis: [2.5, 0, -0.6], lean: 5 }],
        [9, { R: { d: [2, 0, 0] }, L: { d: [-1, 0, 0] }, twist: 0, hipYaw: 0, pelvis: [1.5, 0, -0.4] }],
        [11, { L: { w: X2, aim: A(1, 0, 0), up: PALM_DOWN }, R: { d: [1, 0.5, 0.8] }, twist: -18, hipYaw: -8, pelvis: [3, 0, -0.6], lean: 4, shL: 8 }],
        [14, { L: { w: v3.add(X2, [0.5, 0, 0]), aim: A(1, 0, 0), up: PALM_DOWN }, R: { d: [1, 0.5, 0.8] }, twist: -18, hipYaw: -8, pelvis: [3.2, 0, -0.6], lean: 4, shL: 8 }],
        [20, { L: { d: [3, 0, 0] }, twist: -4, pelvis: [1, 0, -0.2] }, "f"],
        [28, {}],
      ],
    };
  },
  // Arabesque: tips forward on the lead leg as the rear leg swings up behind and over in a
  // scorpion arc, the heel dropping onto the head in front
  arabesque: (c) => {
    const k = FUK(c);
    const T = c.pre([14 * k, -2, 88 * k]);
    const top = { lean: 38, hipPitch: 12, pelvis: [3, 0, 0], fR: { w: v3.add(T, [-2, 0, 4]), pitch: 40, yaw: 0, knee: c.pre([-30, -6, 90]) }, L: { w: c.pre([22, 14, 40]), aim: A(1, 0.3, 0) }, R: { w: c.pre([4, -24, 46]), aim: A(0, -1, 0) }, fL: { pitch: -20 }, look: c.pre([60, 0, 20]), fistL: 0.1, fistR: 0.1 };
    return {
      target: () => [14 * k, 88 * k],
      keys: [
        [0, {}],
        [4, { lean: 18, pelvis: [1, 0, 0.5], fR: { w: c.pre([-26, -6, 30]), pitch: -20, knee: c.pre([-40, -6, 40]) }, L: { d: [4, 2, -4] }, R: { d: [-2, -4, -2] } }, "w"],
        [7, { ...top, fR: { ...top.fR, w: c.pre([-12, -4, 76]), knee: c.pre([-40, -6, 80]) } }],
        [9, top],
        [13, top],
        [20, { lean: 14, pelvis: [1, 0, 0], fR: { w: c.pre([-10, -6, 20]), pitch: -20, knee: c.pre([-20, -6, 40]) } }, "f"],
        [27, { fR: { d: [0, 0, 1] } }],
        [34, {}],
      ],
    };
  },
  // Plie Sweep: a deep plie, then the lead leg extends along the floor in a long arc
  plieSweep: (c) => {
    const T = c.tgt("plieSweep", 0, { dy: 6 });
    const ank = v3.add(T, [-5, 0, 0.5]);
    const sw = { fL: { w: ank, yaw: -10, pitch: 30, knee: c.pre([30, 20, 20]) }, fR: { pitch: -20 }, pelvis: [3, 0, -7], lean: 16, hipYaw: -14, twist: 12,
      L: { w: c.pre([10, 26, 30]), aim: A(0, 1, 0) }, R: { w: c.pre([-4, -24, 34]), aim: A(0, -1, 0) }, fistL: 0.1, fistR: 0.1 };
    return {
      base: "crouch",
      keys: [
        [0, {}],
        [3, { pelvis: [0, 0, -3], lean: 4, L: { w: c.pre([16, 20, 36]) }, R: { w: c.pre([0, -20, 36]) }, fistL: 0.1, fistR: 0.1 }, "w"],
        [7, sw],
        [10, { ...sw, fL: { ...sw.fL, w: v3.add(ank, [0.5, 0, 0]) } }],
        [16, { pelvis: [1, 0, -3], lean: 6, fL: { w: c.pre([12, 5, 5]) } }, "f"],
        [28, {}],
      ],
    };
  },

  // ================================================================ MOTLEY
  // Juggle Ball: a flick of the wrist, the ball snapped out underhand
  juggleBall: (c) => ({
    keys: [
      [0, {}],
      [5, { R: { w: c.pre([-6, -12, 34]), aim: A(-0.5, 0, -1) }, twist: -14, lean: 8, pelvis: [-1, 0, -1.5], fistR: 0.6 }, "w"],
      [9, { R: { w: c.pre([22, -4, 48]), aim: A(1, 0, 0.3), up: [0, 0, -1] }, twist: 20, hipYaw: 14, lean: 10, pelvis: [2.5, 0, -1.5], fR: { yaw: 24, pitch: -12 }, fistR: 0.1 }],
      [13, { R: { w: c.pre([24, -3, 52]), aim: A(1, 0, 0.5), up: [0, 0, -1] }, twist: 20, hipYaw: 14, lean: 10, pelvis: [2.5, 0, -1.5], fR: { yaw: 24, pitch: -12 }, fistR: 0.1 }],
      [19, { R: { d: [3, 0, -2] }, twist: 6, pelvis: [1, 0, -0.5] }, "f"],
      [26, {}],
    ],
  }),
  // Pratfall: slips, lands on his backside (and shrinks away to nothing), pops up behind the
  // opponent arms wide - ta-da - then back on guard
  pratfall: (c) => ({
    keys: [
      [0, {}],
      [3, { fL: { w: c.pre([22, 6, 16]), pitch: 30 }, pelvis: [-2, 0, -2], lean: -20, L: { w: c.pre([4, 22, 70]) }, R: { w: c.pre([-4, -22, 66]) }, look: c.pre([40, 0, 100]), fistL: 0.05, fistR: 0.05 }],
      [8, { pelvis: [-6, 0, -26], hipPitch: -30, lean: 10, fL: { w: c.pre([22, 7, 10]), pitch: 30 }, fR: { w: c.pre([18, -7, 8]), pitch: 30 }, L: { w: c.pre([-10, 16, 4]) }, R: { w: c.pre([-10, -16, 4]) }, fistL: 0.05, fistR: 0.05 }],
      [12, { pelvis: [-6, 0, -26], hipPitch: -30, lean: 10, fL: { w: c.pre([22, 7, 10]), pitch: 30 }, fR: { w: c.pre([18, -7, 8]), pitch: 30 }, L: { w: c.pre([-10, 16, 4]) }, R: { w: c.pre([-10, -16, 4]) } }],
      [17, { pelvis: [0, 0, 2], lean: -10, L: { w: c.pre([8, 24, 76]), aim: A(0.2, 0.4, 1) }, R: { w: c.pre([8, -24, 76]), aim: A(0.2, -0.4, 1) }, fistL: 0, fistR: 0, look: c.pre([90, -30, 70]) }],
      [26, { pelvis: [0, 0, 2.5], lean: -12, L: { w: c.pre([8, 26, 78]), aim: A(0.2, 0.4, 1) }, R: { w: c.pre([8, -26, 78]), aim: A(0.2, -0.4, 1) }, fistL: 0, fistR: 0, look: c.pre([90, -30, 70]) }],
      [34, { pelvis: [0, 0, -1], lean: 4 }, "f"],
      [40, {}],
    ],
  }),
  // Cartwheel: turns to face out and wheels forward over his hands - the hands strike on the
  // way down, the feet come over the top and down onto the opponent
  cartwheel: (c) => {
    const wheel = { spin: -90, L: { w: c.pre([0, 26, 76]), aim: A(0, 0.3, 1) }, R: { w: c.pre([0, -26, 76]), aim: A(0, -0.3, 1) }, fL: { w: c.pre([2, 14, 4.3]), yaw: -90 }, fR: { w: c.pre([-2, -14, 4.3]), yaw: -90 },
      lean: 0, pelvis: [0, 0, 2], fistL: 0.05, fistR: 0.05 };
    const keys = [[0, {}], [4, { ...wheel, tumble: 0, spin: -60 }]];
    // a full turn from frame 6 to 27 (head toward +X first), resting on hands and feet
    for (let f = 6; f <= 27; f += 1) keys.push([f, { ...wheel, tumble: (360 * (f - 6)) / 21 }]);
    keys.push([31, { tumble: 360, spin: -20, pelvis: [0, 0, -2], lean: 6 }, "f"], [34, { tumble: 360 }]);
    return { keys, rest: (f) => (f >= 7 && f <= 26 ? 1 : 0), noReach: [0, 1] };
  },
  // Slapstick: a backhand with the rear hand, then a big forehand slap with the lead hand
  slapstick: (c) => {
    const X1 = c.tgt("slapstick", 0, { dy: 0 }), X2 = c.tgt("slapstick", 1, { dy: 2 });
    return {
      keys: [
        [0, {}],
        [3, { R: { w: c.pre([-2, -14, 62]), aim: A(-0.5, -1, 0.3) }, twist: -16, hipYaw: -8, fistR: 0 }, "w"],
        [6, { R: { w: X1, aim: A(1, 0.6, 0), up: [0, 1, 0] }, twist: 24, hipYaw: 16, pelvis: [2, 0, -0.6], lean: 6, fistR: 0 }],
        [8, { R: { w: v3.add(X1, [-3, 4, 0]), aim: A(0.6, 1, 0) }, twist: 24, hipYaw: 16, pelvis: [2, 0, -0.6], fistR: 0, L: { w: c.pre([-4, 18, 62]), aim: A(-0.5, 1, 0.3) }, fistL: 0 }],
        [12, { L: { w: X2, aim: A(1, -0.6, 0), up: [0, -1, 0] }, R: { d: [0, -2, -4] }, twist: -24, hipYaw: -14, pelvis: [3, 0, -0.8], lean: 8, fistL: 0, fistR: 0.4 }],
        [15, { L: { w: v3.add(X2, [0.5, -1, 0]), aim: A(1, -0.6, 0), up: [0, -1, 0] }, R: { d: [0, -2, -4] }, twist: -24, hipYaw: -14, pelvis: [3, 0, -0.8], lean: 8, fistL: 0 }],
        [21, { L: { d: [2, -2, -2] }, twist: -6, pelvis: [1, 0, -0.3], fistL: 0.3 }, "f"],
        [30, {}],
      ],
    };
  },
  // Banana Sweep: drops onto a hand and spins the rear leg round along the floor
  bananaSweep: (c) => {
    const T = c.tgt("bananaSweep", 0, { dy: -3 });
    const ank = v3.add(T, [-3, 0, 1.5]);
    const sw = { fR: { w: ank, yaw: 70, pitch: 6 }, fL: { yaw: 70, pitch: -10 }, hipYaw: 85, lean: 16, twist: -40, pelvis: [6, 1, -6], L: { w: c.pre([20, 10, 2]), aim: A(0.2, 0, -1) }, R: { d: [-4, -3, -6] }, look: c.pre([80, 0, 10]) };
    return {
      base: "crouch",
      keys: [
        [0, {}],
        [4, { pelvis: [1, 0, -4], hipYaw: 25, lean: 8, fR: { w: c.pre([-14, -10, 4.5]), yaw: 10 }, L: { w: c.pre([20, 10, 2]), aim: A(0.2, 0, -1) } }, "w"],
        [8, sw],
        [11, { ...sw, fR: { ...sw.fR, w: v3.add(ank, [0.5, 0, 0]) } }],
        [18, { pelvis: [3, 0.5, -4], hipYaw: 50, lean: 10, twist: -16, fR: { w: c.pre([4, -12, 4.5]), yaw: 40 }, fL: { yaw: 40 }, L: { w: c.pre([20, 10, 2]) } }, "f"],
        [25, { pelvis: [0.5, 0, -1], hipYaw: 10 }],
        [32, {}],
      ],
    };
  },
  // Jester Drop: a skipping hop, the lead leg rising high, then chopping down on the head
  jesterDrop: (c) => {
    const T = c.tgt("jesterDrop", 0, { dy: 4, at: 13 });
    const ank = v3.add(T, [-3, 0, 2]);
    return {
      keys: [
        [0, {}],
        [5, { pelvis: [-0.5, 0, -4], lean: 8, L: { d: [0, 2, -4] }, R: { d: [0, -2, -4] } }, "w"],
        [9, { rise: 9, fL: { w: c.pre([10, 6, 50]), pitch: 30, knee: c.pre([30, 8, 90]) }, fR: { d: [-2, 0, 4], pitch: -40 }, lean: -14, L: { w: c.pre([4, 24, 66]) }, R: { w: c.pre([-4, -24, 62]) }, fistL: 0.1, fistR: 0.1 }],
        [13, { rise: 5, fL: { w: ank, pitch: 10, knee: c.pre([30, 8, 80]) }, fR: { d: [-2, 0, 3], pitch: -40 }, lean: 6, L: { w: c.pre([4, 22, 56]) }, R: { w: c.pre([-4, -22, 54]) } }],
        [16, { rise: 3, fL: { w: v3.add(ank, [1, 0, -3]), pitch: 0, knee: c.pre([30, 8, 70]) }, fR: { d: [-2, 0, 2], pitch: -40 }, lean: 10 }],
        [22, { fL: { w: c.pre([16, 6, 4.3]) }, pelvis: [1, 0, -4], lean: 12 }, "f"],
        [34, {}],
      ],
    };
  },
};
