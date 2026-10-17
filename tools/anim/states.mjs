// State clips: guard, crouch, blocks and block reactions, jumps and landings, dashes, hit
// reactions, launches, knockdowns and get-ups, and the paired clip a thrown fighter plays.
// Keyed on each fighter's stance like the moves (see moves.mjs for the conventions).
import { q, v3, clamp, DEG } from "./m3.mjs";
import { IDX } from "./rig.mjs";
import { Clip, clonePose, turn } from "./clip.mjs";
import { STANCES, buildStance, buildCrouch, crouchStance, buildAir, airStance, cheat } from "./stances.mjs";
import { sampleSpecs, applySpec } from "./keys.mjs";

const A = (x, y, z) => v3.norm([x, y, z]);
const pre = (id) => {
  const th = -STANCES[id].cheat * DEG;
  return (v) => [v[0] * Math.cos(th) - v[1] * Math.sin(th), v[0] * Math.sin(th) + v[1] * Math.cos(th), v[2]];
};

// keyed clip on a base stance. Loops: the key at frame n is the same as frame 0 and is dropped.
export function keyedState(id, key, { base = "stance", keys, n, loop = false, rest = null, fist = null }) {
  const S0 = STANCES[id];
  const S = base === "crouch" ? crouchStance(id) : base === "air" ? airStance(id) : S0;
  const B = base === "crouch" ? buildCrouch(id) : base === "air" ? buildAir(id) : buildStance(id);
  const len = n ?? keys[keys.length - 1][0] + 1;
  const specs = sampleSpecs(keys, loop ? len + 1 : len, { fistL: S.fist, fistR: S.fist });
  if (loop) specs.pop();
  let poses = specs.map((sp) => applySpec(B, S, sp));
  if (rest) poses = poses.map((W, f) => restOnFloor(W, typeof rest === "function" ? rest(f) : rest));
  poses = poses.map((W) => cheat(id, W));
  const c = new Clip(`${id}_${key}`, poses, { loop });
  c.fist = fist || ((f) => ({ L: specs[f].fistL ?? S.fist, R: specs[f].fistR ?? S.fist }));
  c.finish();
  c.final = true;
  return c;
}

// lying poses: drop the body so its lowest part (back, hips, head, limbs) rests at `clear`
const BODY = ["pelvis", "spine_1", "spine_3", "neck_0", "head_0", "arm_upper_L", "arm_upper_R", "arm_lower_L", "arm_lower_R", "hand_L", "hand_R",
  "leg_upper_L", "leg_upper_R", "leg_lower_L", "leg_lower_R", "ankle_L", "ankle_R", "ball_L", "ball_R"];
const CLEAR = { pelvis: 4.5, spine_1: 5, spine_3: 5.5, neck_0: 4, head_0: 4.5, arm_upper_L: 3, arm_upper_R: 3, arm_lower_L: 2.2, arm_lower_R: 2.2, hand_L: 1.6, hand_R: 1.6,
  leg_upper_L: 4, leg_upper_R: 4, leg_lower_L: 2.8, leg_lower_R: 2.8, ankle_L: 2.4, ankle_R: 2.4, ball_L: 1.2, ball_R: 1.2 };
export function restOnFloor(W, w = 1) {
  if (!w) return W;
  let low = Infinity;
  for (const n of BODY) low = Math.min(low, W[IDX[n]].p[2] - CLEAR[n]);
  const dz = -low * w;
  return W.map((t) => ({ q: t.q, p: [t.p[0], t.p[1], t.p[2] + dz] }));
}

// ------------------------------------------------------------------ the states
export const STATE_ANIMS = {
  // crouching guard, breathing
  crouch: (id) => keyedState(id, "crouch", {
    base: "crouch", loop: true, n: 56,
    keys: [[0, {}], [14, { pelvis: [0, 0, -0.6], lean: 1.2, L: { d: [0.3, 0, -0.4] }, R: { d: [0.2, 0, -0.5] } }], [28, { pelvis: [0.2, 0, -1.0], lean: 1.6 }],
      [42, { pelvis: [0.1, 0, -0.4], lean: 0.6, L: { d: [-0.2, 0, 0.2] } }], [56, {}]],
  }),
  // standing guard: forearms up in front of the face, chin tucked, weight a touch back
  block: (id) => {
    const p = pre(id);
    const g = blockGuard(id, p);
    return keyedState(id, "block", {
      loop: true, n: 48,
      keys: [[0, g], [24, { ...g, pelvis: [g.pelvis[0], 0, g.pelvis[2] - 0.6], lean: g.lean + 1 }], [48, g]],
    });
  },
  cblock: (id) => {
    const p = pre(id);
    const g = cblockGuard(id, p);
    return keyedState(id, "cblock", {
      base: "crouch", loop: true, n: 48,
      keys: [[0, g], [24, { ...g, pelvis: [g.pelvis[0], 0, g.pelvis[2] - 0.5], lean: g.lean + 1 }], [48, g]],
    });
  },
  // a blocked hit: the guard is driven back into the face, the body rocks back and skids,
  // then the guard settles (played over the blockstun)
  blockhit: (id) => {
    const p = pre(id);
    const g = blockGuard(id, p);
    const hit = { ...g, pelvis: [g.pelvis[0] - 3.6, 0, g.pelvis[2] - 1.8], lean: g.lean - 15, twist: (g.twist || 0) + 9, headPitch: 18, shL: 12, shR: 12,
      L: { ...g.L, w: v3.add(g.L.w, p([-5, 0, 0.5])) }, R: { ...g.R, w: v3.add(g.R.w, p([-5, 0, 0.5])) }, fL: { d: [0, 0, 0], pitch: 10 } };
    return keyedState(id, "blockhit", {
      n: 16,
      keys: [[0, hit], [3, { ...hit, lean: g.lean - 7 }], [9, { ...g, pelvis: [g.pelvis[0] - 0.8, 0, g.pelvis[2] - 0.6], lean: g.lean - 2 }], [15, g]],
    });
  },
  cblockhit: (id) => {
    const p = pre(id);
    const g = cblockGuard(id, p);
    const hit = { ...g, pelvis: [g.pelvis[0] - 3.2, 0, g.pelvis[2] - 0.8], lean: g.lean - 13, headPitch: 16, shL: 10, shR: 10,
      L: { ...g.L, w: v3.add(g.L.w, p([-4.5, 0, 0.5])) }, R: { ...g.R, w: v3.add(g.R.w, p([-4.5, 0, 0.5])) } };
    return keyedState(id, "cblockhit", {
      base: "crouch", n: 16,
      keys: [[0, hit], [3, { ...hit, lean: g.lean - 6 }], [9, { ...g, pelvis: [g.pelvis[0] - 0.7, 0, g.pelvis[2] - 0.3] }], [15, g]],
    });
  },
  // jump take-off: sink and load the arms
  squat: (id) => keyedState(id, "squat", {
    n: 5,
    keys: [[0, {}], [2, { pelvis: [0.5, 0, -5], lean: 10, L: { d: [-1, 0, -4] }, R: { d: [-1, 0, -4] } }], [4, { pelvis: [0.8, 0, -6.5], lean: 12, L: { d: [-1.5, 0, -6] }, R: { d: [-1.5, 0, -6] }, fR: { pitch: -10 } }]],
  }),
  // rising: legs tucked up, arms lifting; falling: legs reach down for the floor
  airrise: (id) => keyedState(id, "airrise", {
    base: "air", loop: true, n: 32,
    keys: [[0, { pelvis: [0, 0, 1.5], fL: { d: [1, 0, 3] }, fR: { d: [0, 0, 3] }, L: { d: [0, 0, 2] }, R: { d: [0, 0, 2] } }],
      [16, { pelvis: [0, 0, 2], fL: { d: [1.5, 0, 4] }, fR: { d: [0, 0, 3.5] }, L: { d: [0, 0, 2.5] }, R: { d: [0, 0, 2.5] } }],
      [32, { pelvis: [0, 0, 1.5], fL: { d: [1, 0, 3] }, fR: { d: [0, 0, 3] }, L: { d: [0, 0, 2] }, R: { d: [0, 0, 2] } }]],
  }),
  air: (id) => keyedState(id, "air", {
    base: "air", loop: true, n: 40,
    keys: [[0, { fL: { d: [0, 0, -2] }, fR: { d: [0, 0, -1] } }], [20, { fL: { d: [0.5, 0, -3.5] }, fR: { d: [0, 0, -2.5] }, lean: 2, L: { d: [0.5, 0, -0.5] } }],
      [40, { fL: { d: [0, 0, -2] }, fR: { d: [0, 0, -1] } }]],
  }),
  // landing: absorb with the knees, then rise back to guard
  land: (id) => keyedState(id, "land", {
    n: 8,
    keys: [[0, { pelvis: [0.5, 0, -6], lean: 12, L: { d: [0, 0, -3] }, R: { d: [0, 0, -3] } }], [2, { pelvis: [0.6, 0, -6.5], lean: 13, L: { d: [0, 0, -3.5] }, R: { d: [0, 0, -3.5] } }],
      [7, { pelvis: [0.2, 0, -0.8], lean: 2 }]],
  }),
  // forward dash: a low lunge that skips both feet forward; back dash: a hop back on guard
  dashf: (id) => {
    const S = STANCES[id];
    return keyedState(id, "dashf", {
      n: 15,
      keys: [[0, {}], [2, { pelvis: [2, 0, -3], lean: 14, L: { d: [1, 0, -1] }, R: { d: [1, 0, -1] } }],
        [5, { pelvis: [4, 0, 0.5], lean: 20, fL: { d: [6, 0, 3], pitch: -10 }, fR: { d: [-2, 0, 4.5], pitch: -35 }, L: { d: [2, 0, -2] }, R: { d: [1, 0, -2] }, look: [90, 0, 55] }],
        [9, { pelvis: [3.5, 0, 0], lean: 18, fL: { d: [3, 0, 2] }, fR: { d: [2, 0, 3], pitch: -30 }, L: { d: [2, 0, -2] }, R: { d: [1, 0, -2] } }],
        [12, { pelvis: [1.5, 0, -2.5], lean: 9, fR: { d: [0.5, 0, 0.5] } }], [14, { pelvis: [0.5, 0, -1], lean: 3 }]],
    });
  },
  dashb: (id) => keyedState(id, "dashb", {
    n: 16,
    keys: [[0, {}], [2, { pelvis: [-1, 0, -3], lean: -4, L: { d: [-1, 0, 1] }, R: { d: [-1, 0, 1] } }],
      [5, { pelvis: [-3, 0, 1.5], lean: -10, fL: { d: [-2, 0, 4], pitch: -20 }, fR: { d: [-5, 0, 3], pitch: -10 }, L: { d: [-2, 0, 1.5] }, R: { d: [-2, 0, 1.5] } }],
      [10, { pelvis: [-2.5, 0, 0], lean: -7, fL: { d: [-1, 0, 2] }, fR: { d: [-2, 0, 1] } }],
      [13, { pelvis: [-1, 0, -2.5], lean: 3 }], [15, { pelvis: [-0.3, 0, -0.8], lean: 1 }]],
  }),

  // ---- hit reactions (frame 0 is the impact pose, held through hitstop; the clip plays over
  // the hitstun). High: the head snaps back and the guard flies open. Mid: the body folds over
  // the blow. Crouching: knocked back on the heels.
  hithigh: (id) => {
    const p = pre(id);
    const hit = { pelvis: [-3.5, 0, -1.2], lean: -16, side: 4, twist: 12, headPitch: -26, shL: 8, shR: 8, look: p([90, 10, 85]),
      L: { d: [-2, 4, 4] }, R: { d: [-3, -3, 2] }, fL: { pitch: 14 }, fistL: 0.6, fistR: 0.6 };
    return keyedState(id, "hithigh", {
      n: 22,
      keys: [[0, hit], [3, { ...hit, lean: -19, headPitch: -30, pelvis: [-4, 0, -1.4] }],
        [10, { pelvis: [-1.6, 0, -1.2], lean: -6, twist: 4, headPitch: -8, L: { d: [-1, 1, 1] }, R: { d: [-1, -1, 1] } }],
        [21, {}]],
    });
  },
  hitmid: (id) => {
    const p = pre(id);
    const hit = { pelvis: [-3.5, 0, -3], lean: 26, twist: -6, headPitch: 18, look: p([60, 0, 20]), L: { d: [-6, 2, -10] }, R: { d: [-5, -2, -11] }, fL: { pitch: 6 }, fistL: 0.5, fistR: 0.5 };
    return keyedState(id, "hitmid", {
      n: 22,
      keys: [[0, hit], [3, { ...hit, lean: 30, pelvis: [-4, 0, -3.5] }],
        [10, { pelvis: [-1.5, 0, -2], lean: 12, headPitch: 8, L: { d: [-2, 1, -4] }, R: { d: [-2, -1, -4] } }],
        [21, {}]],
    });
  },
  hitcrouch: (id) => {
    const p = pre(id);
    const hit = { pelvis: [-3, 0, 0.5], lean: -14, headPitch: -18, look: p([90, 6, 70]), L: { d: [-2, 3, 3] }, R: { d: [-3, -3, 2] }, fistL: 0.6, fistR: 0.6 };
    return keyedState(id, "hitcrouch", {
      base: "crouch", n: 22,
      keys: [[0, hit], [3, { ...hit, lean: -17, pelvis: [-3.5, 0, 0.6] }], [10, { pelvis: [-1.2, 0, 0], lean: -5, headPitch: -6 }], [21, {}]],
    });
  },
  // ---- launches and knockdowns. Airborne poses are shaped upright and then tipped over as
  // a whole (tumble), resting their lowest point at the fighter's feet so the game's height
  // carries them. Lying poses tip the hips back and plant feet and hands on the floor.
  launch: (id) => {
    const p = pre(id);
    const shape = { lean: -14, side: 4, twist: 10, headPitch: -24, look: p([40, 0, 120]), L: { w: p([16, 14, 70]), aim: A(0.3, 0.3, 1) }, R: { w: p([10, -16, 64]), aim: A(0.3, -0.3, 1) },
      fL: { w: p([10, 6, 10]), pitch: -40, knee: p([40, 8, 40]) }, fR: { w: p([-6, -6, 6]), pitch: -50, knee: p([30, -8, 30]) }, rise: 0, fistL: 0.3, fistR: 0.3 };
    return keyedState(id, "launch", {
      n: 21, rest: 1,
      keys: [[0, { ...shape, tumble: -8 }], [4, { ...shape, tumble: -22 }], [12, { ...shape, tumble: -46, lean: -10, headPitch: -16 }], [20, { ...shape, tumble: -58, lean: -6, headPitch: -10, L: { w: p([12, 14, 66]) } }]],
    });
  },
  launchhold: (id) => {
    const p = pre(id);
    const shape = { lean: -6, side: 4, twist: 10, headPitch: -10, look: p([40, 0, 120]), L: { w: p([12, 14, 66]), aim: A(0.3, 0.3, 1) }, R: { w: p([10, -16, 64]), aim: A(0.3, -0.3, 1) },
      fL: { w: p([10, 6, 10]), pitch: -40, knee: p([40, 8, 40]) }, fR: { w: p([-6, -6, 6]), pitch: -50, knee: p([30, -8, 30]) }, fistL: 0.3, fistR: 0.3 };
    return keyedState(id, "launchhold", {
      loop: true, n: 32, rest: 1,
      keys: [[0, { ...shape, tumble: -58 }], [16, { ...shape, tumble: -64, L: { w: p([12, 15, 68]) }, R: { w: p([10, -17, 62]) } }], [32, { ...shape, tumble: -58 }]],
    });
  },
  down: (id) => {
    const p = pre(id);
    const lie = lying(p, 0);
    return keyedState(id, "down", {
      loop: true, n: 48, rest: 1,
      keys: [[0, lie], [24, { ...lie, lean: lie.lean + 3, L: { ...lie.L, w: v3.add(lie.L.w, [0, 0, 0.6]) } }], [48, lie]],
    });
  },
  downko: (id) => {
    const p = pre(id);
    const lie = lying(p, 1);
    return keyedState(id, "downko", { loop: true, n: 64, rest: 1, keys: [[0, lie], [32, { ...lie, lean: lie.lean + 1 }], [64, lie]] });
  },
  // get up fast: sit up on the hands, feet under, rise into guard
  getup: (id) => {
    const p = pre(id);
    const lie = lying(p, 0);
    return keyedState(id, "getup", {
      n: 19,
      rest: (f) => (f <= 8 ? 1 : f >= 13 ? 0 : (13 - f) / 5),
      keys: [
        [0, lie],
        [5, { pelvis: [-6, 0, -30], hipPitch: -48, lean: 18, look: p([60, 0, 30]), fL: { w: p([12, 6, 4.3]), pitch: 0, knee: p([20, 10, 30]) }, fR: { w: p([8, -7, 4.3]), pitch: 0, knee: p([16, -10, 30]) },
          L: { w: p([-16, 12, 2]), aim: A(-0.3, 0.2, -1) }, R: { w: p([-16, -12, 2]), aim: A(-0.3, -0.2, -1) }, fistL: 0.2, fistR: 0.2 }],
        [10, { pelvis: [-1, 0, -16], hipPitch: 10, lean: 22, look: p([80, 0, 40]), fL: { w: p([9, 6, 4.3]) }, fR: { w: p([-6, -7, 6]), pitch: -20 }, L: { d: [0, 0, -12] }, R: { d: [0, 0, -12] } }],
        [14, { pelvis: [0, 0, -5], lean: 10, L: { d: [0, 0, -3] }, R: { d: [0, 0, -3] } }],
        [18, {}],
      ],
    });
  },
  // The thrown fighter's half of a throw: played in the thrower's place and frame (+X is the
  // thrower's facing), so it is built per thrower with the thrower's timing. Grabbed, lifted
  // overhead while being swung round, and flung out behind the thrower, leaning back the way
  // the knockdown takes over.
  throwv: (id, core) => {
    const ch = core.CHARACTERS.find((c) => c.id === id);
    const k = ch.stats.frame || 1;
    const p = (v) => v;
    const shape = { lean: -8, headPitch: -10, L: { w: [9, 9, 50], aim: A(1, 0.2, 0.3) }, R: { w: [9, -9, 48], aim: A(1, -0.2, 0.3) }, fistL: 0.5, fistR: 0.5,
      fL: { w: [5, 5, 6], pitch: -45, knee: [30, 6, 30] }, fR: { w: [-3, -5, 4], pitch: -55, knee: [30, -6, 26] } };
    const f = (x) => Math.round(x * k);
    return keyedState(id, "throwv", {
      n: f(34) + 1,
      keys: [
        [0, { ...shape, spin: 180, at: [25, 0, 0] }],
        [f(4), { ...shape, spin: 180, at: [22, 0, 2], tumble: 8 }],
        [f(14), { ...shape, spin: 275, at: [7, 0, 17], tumble: -24, lean: -14, L: { w: [10, 14, 64] }, R: { w: [10, -14, 60] }, fistL: 0.2, fistR: 0.2 }],
        [f(20), { ...shape, spin: 360, at: [-18, 0, 11], tumble: -36, lean: -12, headPitch: -20, L: { w: [14, 14, 66] }, R: { w: [10, -16, 62] }, fistL: 0.2, fistR: 0.2 }],
        [f(34), { ...shape, spin: 360, at: [-22, 0, 8], tumble: -50, lean: -8, headPitch: -16, L: { w: [14, 14, 66] }, R: { w: [10, -16, 62] }, fistL: 0.2, fistR: 0.2 }],
      ],
    });
  },
};

// lying on the back: hips tipped back, legs out with the knees up a little, arms by the sides
function lying(p, ko) {
  return ko
    ? { pelvis: [-8, 0, -33], hipPitch: -90, lean: -4, side: 6, twist: 8, headPitch: -20, look: p([-20, 30, 100]),
      fL: { w: p([20, 9, 3]), pitch: 30, yaw: 30, knee: p([20, 30, 20]) }, fR: { w: p([18, -12, 3]), pitch: 30, yaw: -20, knee: p([20, -30, 20]) },
      L: { w: p([-14, 22, 2]), aim: A(0, 1, -0.2) }, R: { w: p([-6, -20, 2]), aim: A(0.3, -1, -0.2) }, fistL: 0.2, fistR: 0.15 }
    : { pelvis: [-8, 0, -33], hipPitch: -86, lean: 2, twist: 4, headPitch: -6, look: p([30, 0, 60]),
      fL: { w: p([16, 7, 4]), pitch: 10, knee: p([20, 8, 40]) }, fR: { w: p([18, -8, 3.5]), pitch: 20, knee: p([20, -10, 30]) },
      L: { w: p([-10, 15, 2]), aim: A(0.4, 0.6, -0.3) }, R: { w: p([-8, -15, 2]), aim: A(0.4, -0.6, -0.3) }, fistL: 0.4, fistR: 0.4 };
}

// the blocking guard of a fighter: forearms vertical in front of the face (absolute targets)
function blockGuard(id, p) {
  const S = STANCES[id];
  const hz = S.hands.L[2] + 1.5;
  return {
    pelvis: [-1.2, 0, -1.4], lean: 5, twist: 4, headPitch: 12, shL: 6, shR: 6,
    L: { w: p([14.5, 3.0, hz]), aim: A(0.25, -0.2, 1), elbow: p([12, 9, hz - 18]) },
    R: { w: p([13.0, -3.0, hz + 0.5]), aim: A(0.25, 0.2, 1), elbow: p([10, -9, hz - 18]) },
  };
}
function cblockGuard(id, p) {
  const C = STANCES[id].crouch;
  const hz = C.hands.L[2] + 2;
  return {
    pelvis: [-0.8, 0, -0.8], lean: 2, headPitch: 12, shL: 5, shR: 5,
    L: { w: p([17.0, 3.0, hz]), aim: A(0.3, -0.2, 1), elbow: p([15, 9, hz - 16]) },
    R: { w: p([15.5, -3.0, hz + 0.5]), aim: A(0.3, 0.2, 1), elbow: p([13, -9, hz - 16]) },
  };
}