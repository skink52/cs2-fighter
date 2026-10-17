// Move clips: keyed on top of each fighter's stance, timed to the move's frame data and held
// to the reach of the previous system (ref/old_frames.json) so the hit boxes stay where they
// were. Keys are written at base timing; slower fighters stretch them by their frame
// multiplier. "w" keys are wind-ups and "f" keys follow-throughs, scaled by the fighter's style.
//
// Space: the fighter faces +X, +Y is their left (the lead side, away from the camera), +Z up,
// model units, before the camera cheat. Hit targets are given after the cheat (on the fight
// line) and converted.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { q, v3, clamp, DEG } from "./m3.mjs";
import { IDX } from "./rig.mjs";
import { Clip, clonePose, turn } from "./clip.mjs";
import { STANCES, buildStance, buildCrouch, crouchStance, buildAir, airStance, cheat } from "./stances.mjs";
import { sampleSpecs, applySpec } from "./keys.mjs";
import { ik2, ARM, LEG } from "./post.mjs";
import { movePelvis } from "./pose.mjs";
import { FU } from "./bake.mjs";
import { restOnFloor } from "./states.mjs";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const REF = JSON.parse(fs.readFileSync(path.join(here, "..", "..", "ref", "old_frames.json"), "utf8"));

// ------------------------------------------------------------------ context per fighter
export function moveCtx(id, core) {
  const ch = core.CHARACTERS.find((c) => c.id === id);
  const S = STANCES[id];
  const th = S.cheat * DEG;
  const pre = (v) => [v[0] * Math.cos(-th) - v[1] * Math.sin(-th), v[0] * Math.sin(-th) + v[1] * Math.cos(-th), v[2]];
  const ref = REF.fighters[id];
  const c = {
    id, ch, S, C: crouchStance(id), k: ch.stats.frame || 1, style: ch.style || { windup: 1, follow: 1 },
    pre,
    // old reference tip of a move's hit at a base frame, in model units (unscaled clip space)
    refTip(moveId, tip, frame) {
      const m = ref.moves[moveId];
      if (!m) return null;
      const sf = Math.round(frame * c.k);
      const fr = m.frames.find((x) => x.f === sf) || m.frames[Math.min(m.frames.length - 1, sf)];
      const t = fr && fr.tips[tip];
      return t ? [t[0] * FU / ch.scale, t[1] * FU / ch.scale] : null;
    },
    // hit target on the fight line (post-cheat) -> pre-cheat point for IK, with depth y
    tgt(moveId, hi = 0, { dy = 0, dx = 0, dz = 0, at = null } = {}) {
      const h = core.MOVES[moveId].hits[hi];
      const t = c.refTip(moveId, h.tip, at ?? h.from);
      return pre([t[0] + dx, dy, t[1] + dz]);
    },
    post: (v) => v,
  };
  return c;
}

// scale the offsets of a wind-up / follow-through key by the fighter's style
const ABS = new Set(["w", "aim", "elbow", "look", "up", "fistL", "fistR", "ww"]);
function scaleSpec(sp, amt) {
  if (amt === 1) return sp;
  const out = {};
  for (const [k, v] of Object.entries(sp)) {
    if (ABS.has(k)) out[k] = v;
    else if (typeof v === "number") out[k] = v * amt;
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "number" ? x * amt : x));
    else if (v && typeof v === "object") out[k] = scaleSpec(v, amt);
    else out[k] = v;
  }
  return out;
}

// ------------------------------------------------------------------ tips (bake.mjs maths)
function tipPoint(W, tip) {
  const p = (n) => W[IDX[n]].p;
  if (tip === "fF" || tip === "bF") { const s = tip === "fF" ? "L" : "R"; return v3.lerp(p("hand_" + s), p("finger_middle_0_" + s), 0.8); }
  if (tip === "fT" || tip === "bT") {
    const s = tip === "fT" ? "L" : "R";
    const a = p("ankle_" + s), b = p("ball_" + s);
    const toe = v3.add(b, v3.mul(v3.norm(v3.sub(b, a)), 2.2));
    return v3.lerp(a, toe, 0.75);
  }
  if (tip === "fK") return p("leg_lower_L");
  if (tip === "bK") return p("leg_lower_R");
  if (tip === "S") return v3.lerp(p("arm_upper_L"), p("arm_upper_R"), 0.5);
  if (tip === "H") return p("head_0");
  return null;
}
const LIMB = { fF: ["arm", "L"], bF: ["arm", "R"], fT: ["leg", "L"], bT: ["leg", "R"] };

// Puts a strike's tip on its target (x, z on the fight plane) with weight w, leaning the body in
// when the limb can't reach.
function reachTip(W, tip, target, w) {
  const L = LIMB[tip];
  if (!L || w <= 0) return 0;
  const [kind, s] = L;
  const chain = kind === "arm" ? ARM[s] : LEG[s];
  const endI = IDX[chain[2]];
  let lean = 0;
  for (let it = 0; it < 3; it++) {
    const t = tipPoint(W, tip);
    const err = [(target[0] - t[0]) * w, 0, (target[1] - t[2]) * w];
    if (Math.abs(err[0]) + Math.abs(err[2]) < 0.05) break;
    const goal = v3.add(W[endI].p, err);
    const miss = ik2(W, ...chain, goal, { keepEnd: true });
    if (miss < -0.05 && it < 2) {
      // out of reach: bring the body toward the target and try again
      const d = v3.sub(goal, W[IDX[chain[0]]].p);
      const dn = v3.norm([d[0], 0, d[2]]);
      const push = Math.min(6, -miss + 0.2);
      movePelvis(W, [dn[0] * push, 0, kind === "leg" ? 0 : dn[2] * push * 0.3]);
      lean += push;
    }
  }
  return lean;
}

// ------------------------------------------------------------------ builder
export function buildMove(id, moveId, core, def) {
  const c = moveCtx(id, core);
  const M = core.MOVES[moveId];
  const d = def(c);
  const base = d.base || M.base || "stance";
  const S = base === "crouch" ? c.C : base === "air" ? airStance(id) : c.S;
  const B = base === "crouch" ? buildCrouch(id) : base === "air" ? buildAir(id) : buildStance(id);
  const total = Math.max(2, Math.round(M.total * c.k));
  const n = d.n ? Math.round(d.n * c.k) : total + 1;
  const keys = d.keys.map(([f, sp, tag]) => [Math.round(f * c.k), scaleSpec(sp, tag === "w" ? c.style.windup : tag === "f" ? c.style.follow : 1)]);
  const specs = sampleSpecs(keys, n, { fistL: S.fist, fistR: S.fist });
  let poses = specs.map((sp, f) => {
    let W = applySpec(B, S, sp);
    if (d.rest) { const w = d.rest(f / c.k); if (w) W = restOnFloor(W, w); }
    return cheat(id, W);
  });
  // contact: inside each hit window the striking tip is put exactly on its target; the same
  // correction fades over two frames either side so the strike path stays smooth
  const hits = (M.hits || []).map((h) => ({ ...h, from: Math.round(h.from * c.k), to: Math.round(h.to * c.k) }));
  for (const [hi, h] of hits.entries()) {
    if (!LIMB[h.tip] || (d.noReach && d.noReach.includes(hi))) continue;
    const tgt = (f) => {
      const bf = f / c.k;
      return (d.target && d.target(hi, bf)) || c.refTip(moveId, h.tip, clamp(bf, M.hits[hi].from, M.hits[hi].to));
    };
    let first = null, last = null;
    for (let f = h.from; f <= Math.min(n - 1, h.to); f++) {
      const t = tgt(f);
      if (!t) continue;
      const before = tipPoint(poses[f], h.tip);
      reachTip(poses[f], h.tip, t, 1);
      const after = tipPoint(poses[f], h.tip);
      const delta = v3.sub(after, before);
      if (first === null) first = delta;
      last = delta;
    }
    const nudge = (f, delta, w) => {
      if (f < 0 || f >= n || !delta || w <= 0) return;
      const t = tipPoint(poses[f], h.tip);
      reachTip(poses[f], h.tip, [t[0] + delta[0] * w, t[2] + delta[2] * w], 1);
    };
    nudge(h.from - 1, first, 2 / 3); nudge(h.from - 2, first, 1 / 3);
    nudge(h.to + 1, last, 2 / 3); nudge(h.to + 2, last, 1 / 3);
  }
  const clip = new Clip(`${id}_${moveId}`, poses);
  clip.fist = (f) => ({ L: specs[f].fistL ?? S.fist, R: specs[f].fistR ?? S.fist });
  clip.finish();
  clip.final = true;
  return clip;
}

// ------------------------------------------------------------------ the moves
// Helpers for keys: A(...) aims a fist, guard offsets are relative to the stance guard.
export const A = (x, y, z) => v3.norm([x, y, z]);
export const PALM_DOWN = [0, 0, 1];

export const MOVE_ANIMS = {
  // Lead jab: a small load, the lead hand snaps out along a line with the shoulder rolled up
  // over the chin, the body rocks onto the lead leg, and the hand comes straight back.
  jab: (c) => {
    const J = c.tgt("jab", 0, { dy: 1.5 });
    return {
      keys: [
        [0, {}],
        [2, { L: { d: [-1.2, 0.4, -0.8] }, twist: 4, pelvis: [-0.4, 0, -0.3], shL: 2 }, "w"],
        [5, { L: { w: J, aim: A(1, 0, 0.02), up: PALM_DOWN }, R: { d: [1.5, 0.8, 0.8] }, twist: -16, hipYaw: -5, pelvis: [1.6, 0, -0.7], lean: 3, shL: 10 }],
        [7, { L: { w: v3.add(J, [0.5, 0, 0]), aim: A(1, 0, 0.02), up: PALM_DOWN }, R: { d: [1.5, 0.8, 0.8] }, twist: -16, hipYaw: -5, pelvis: [1.8, 0, -0.7], lean: 3, shL: 10 }],
        [11, { L: { d: [3, 0, 0.4] }, twist: -5, pelvis: [0.8, 0, -0.3], shL: 3 }, "f"],
        [18, {}],
      ],
    };
  },
  // Rear straight: the rear hip coils, then drives; the rear heel turns out, the shoulders
  // rotate through, the lead hand snaps back to the chin.
  straight: (c) => {
    const X = c.tgt("straight", 0, { dy: -0.5 });
    const hold = { R: { w: X, aim: A(1, 0, 0), up: PALM_DOWN }, L: { d: [-4, -0.5, 1.5] }, twist: 30, hipYaw: 26, pelvis: [3, 0, -1.2], lean: 7, shR: 10, fR: { yaw: 34, pitch: -14, d: [1.2, 0.8, 0.6] } };
    return {
      keys: [
        [0, {}],
        [3, { R: { d: [-2, -1, -1] }, L: { d: [-1, 0, 0] }, twist: -9, hipYaw: -7, pelvis: [-0.8, 0, -0.6] }, "w"],
        [7, hold],
        [9, { ...hold, pelvis: [3.4, 0, -1.2], R: { ...hold.R, w: v3.add(X, [0.5, 0, 0]) } }],
        [15, { R: { d: [4, 0, 0.5] }, twist: 10, hipYaw: 8, pelvis: [1.5, 0, -0.4], fR: { yaw: 10, pitch: -5 } }, "f"],
        [25, {}],
      ],
    };
  },
  // Uppercut from the crouch: dip and drop the rear hand, then drive up through the legs and
  // hips, the fist rising past the face to above the head, up on the toes; settle back down.
  uppercut: (c) => {
    const k = 0.72 / c.ch.scale;
    const U1 = c.pre([15 * k, -2, 92 * k]), U2 = c.pre([17 * k, -2, 104 * k]);
    const up = { lean: -30, twist: 30, hipYaw: 22, shR: 14, fR: { yaw: 28, pitch: -26, d: [1, 1, 1.5] }, fL: { pitch: -8 }, look: c.pre([60, 0, 74]) };
    const elbow = c.pre([10, -12, 50]);
    return {
      target: (hi, f) => (f < 8 ? [15 * k + (f - 6) * k, (92 + (f - 6) * 6) * k] : [17 * k, 104 * k]),
      keys: [
        [0, {}],
        [3, { pelvis: [-1, 0, -1.5], R: { d: [-3, -1.5, -7], aim: A(0.6, 0, 0.8) }, twist: -10, lean: 4 }, "w"],
        [6, { ...up, pelvis: [3, 0, 12], R: { w: U1, aim: A(0.25, -0.1, 1), elbow } }],
        [9, { ...up, pelvis: [3.5, 0, 16], lean: -36, R: { w: U2, aim: A(0.15, -0.1, 1), elbow } }],
        [12, { ...up, pelvis: [3.5, 0, 16], lean: -36, R: { w: v3.add(U2, [0, 0, 0.5]), aim: A(0.15, -0.1, 1), elbow } }],
        [21, { pelvis: [1.5, 0, 7], lean: -18, twist: 10, R: { d: [3, 0, 4] }, fR: { pitch: -8 } }, "f"],
        [34, {}],
      ],
    };
  },
  // Lead snap kick to the body: knee chambers up, the foot snaps out with the hips pushing in,
  // and the leg re-chambers before it is put back down.
  kickMid: (c) => {
    const T = c.tgt("kickMid", 0, { dy: 4 });
    const ank = v3.add(T, [-5.8, 0, -1.5]);
    return {
      keys: [
        [0, {}],
        [3, { fL: { w: c.pre([8, 5, 17]), pitch: -40, knee: c.pre([40, 6, 50]) }, pelvis: [-1.2, 0, 0.6], lean: -6, hipYaw: 4, R: { d: [0, 0, 1] }, L: { d: [-2, 0, -1] } }, "w"],
        [7, { fL: { w: ank, pitch: 8, knee: c.pre([40, 6, 50]) }, pelvis: [2.2, 0, 1.4], lean: -13, hipYaw: -10, R: { d: [0.5, 0.5, 1.5] }, L: { d: [-3, 0, -3] } }],
        [10, { fL: { w: v3.add(ank, [0.4, 0, 0]), pitch: 8, knee: c.pre([40, 6, 50]) }, pelvis: [2.4, 0, 1.4], lean: -13, hipYaw: -10, R: { d: [0.5, 0.5, 1.5] }, L: { d: [-3, 0, -3] } }],
        [14, { fL: { w: c.pre([10, 5, 17]), pitch: -35, knee: c.pre([40, 6, 50]) }, pelvis: [0.6, 0, 0.6], lean: -6 }, "f"],
        [19, { fL: { d: [1, 0, 0] }, pelvis: [0.4, 0, -0.6], lean: 2 }],
        [25, {}],
      ],
    };
  },
  // Lead side kick: the hips turn side-on, the knee chambers across, the heel thrusts out at
  // the body and the torso leans away; the support foot pivots.
  longKick: (c) => {
    const T = c.tgt("longKick", 0, { dy: 3 });
    const ank = v3.add(T, [-4.5, 0, -0.5]);
    const thrust = { fL: { w: ank, yaw: -80, pitch: 4 }, fR: { yaw: -55 }, hipYaw: -38, lean: -22, side: 6, twist: 18, pelvis: [2, 0, 2.2], L: { d: [-4, 2, -4] }, R: { d: [-1, 1, 0] } };
    return {
      keys: [
        [0, {}],
        [5, { fL: { w: c.pre([4, 4, 20]), yaw: -70, pitch: -10 }, fR: { yaw: -45 }, hipYaw: -30, lean: -8, twist: 14, pelvis: [-1.5, 0, 1.4], L: { d: [-2, 1, -1] } }, "w"],
        [10, thrust],
        [13, { ...thrust, fL: { ...thrust.fL, w: v3.add(ank, [0.5, 0, 0]) }, pelvis: [2.4, 0, 2.2] }],
        [19, { fL: { w: c.pre([6, 4, 18]), yaw: -60, pitch: -10 }, fR: { yaw: -40 }, hipYaw: -24, lean: -10, twist: 10, pelvis: [0, 0, 1] }, "f"],
        [24, { fL: { d: [1, 0, 0] }, hipYaw: -6, pelvis: [0.5, 0, -0.5] }],
        [30, {}],
      ],
    };
  },
  // Rear roundhouse to the head: pivot on the lead foot, the hips whip round, the rear leg
  // swings up and across, the body leans away and the arms counter-balance.
  roundhouse: (c) => {
    const T = c.tgt("roundhouse", 0, { dy: -2, at: 12 });
    const ank = v3.add(T, [-2.5, 0, -3.5]);
    const kick = { fR: { w: ank, yaw: 60, pitch: 20, knee: c.pre([20, -40, 60]) }, fL: { yaw: 95 }, hipYaw: 95, hipRoll: 20, lean: -24, side: -10, twist: -40, pelvis: [1, 1.5, 3],
      R: { d: [-6, -4, -10] }, L: { d: [-2, 3, 1] }, look: c.pre([90, 0, 58]) };
    return {
      keys: [
        [0, {}],
        [5, { fR: { w: c.pre([-6, -12, 16]), yaw: 20, pitch: -20, knee: c.pre([10, -40, 40]) }, fL: { yaw: 55 }, hipYaw: 40, lean: -6, twist: -16, pelvis: [0, 0.5, 1.5], R: { d: [-2, -2, -4] } }, "w"],
        [11, kick],
        [15, { ...kick, fR: { ...kick.fR, w: v3.add(ank, [0.6, 0, 0]) } }],
        [22, { fR: { w: c.pre([4, -8, 18]), yaw: 30, pitch: -20, knee: c.pre([20, -30, 40]) }, fL: { yaw: 50 }, hipYaw: 50, lean: -10, twist: -18, pelvis: [0.5, 0.5, 1.2] }, "f"],
        [29, { fR: { d: [1, 0, 0] }, fL: { yaw: 12 }, hipYaw: 8, pelvis: [0.3, 0, -0.6] }],
        [36, {}],
      ],
    };
  },
  // Crouching sweep: drop lower, the lead hand touches down, the rear leg swings round low
  // along the floor and the body pivots over the lead leg.
  sweep: (c) => {
    const T = c.tgt("sweep", 0, { dy: -3 });
    const ank = v3.add(T, [-3, 0, 1.5]);
    const sw = { fR: { w: ank, yaw: 70, pitch: 6 }, fL: { yaw: 70, pitch: -10 }, hipYaw: 85, lean: 14, twist: -40, pelvis: [6, 1, -7], L: { w: c.pre([22, 9, 2]), aim: A(0.2, 0, -1) }, R: { d: [-4, -3, -6] }, look: c.pre([80, 0, 10]) };
    return {
      keys: [
        [0, {}],
        [4, { pelvis: [1, 0, -5], hipYaw: 25, lean: 8, fR: { w: c.pre([-14, -10, 4.5]), yaw: 10 }, L: { w: c.pre([20, 9, 3]), aim: A(0.2, 0, -1) } }, "w"],
        [8, sw],
        [11, { ...sw, fR: { ...sw.fR, w: v3.add(ank, [0.5, 0, 0]) } }],
        [18, { pelvis: [3, 0.5, -4], hipYaw: 50, lean: 10, twist: -16, fR: { w: c.pre([4, -12, 4.5]), yaw: 40 }, fL: { yaw: 40 }, L: { w: c.pre([20, 9, 3]) } }, "f"],
        [25, { pelvis: [0.5, 0, -1], hipYaw: 10, fR: { d: [0, 0, 0] } }],
        [32, {}],
      ],
    };
  },

  // Jumping punch: the lead fist drives down and forward, the body leaning over it
  airPunch: (c) => {
    const T = c.tgt("airPunch", 0, { dy: 1 });
    const hit = { L: { w: T, aim: A(0.8, 0, -0.55), up: PALM_DOWN }, R: { d: [1, 0, 1] }, lean: 22, twist: -16, hipYaw: -6, shL: 8, look: c.pre([60, 0, 20]) };
    return {
      base: "air",
      keys: [
        [0, {}],
        [2, { L: { d: [-2, 0, 2] }, lean: 6, twist: 6 }, "w"],
        [4, hit],
        [12, { ...hit, L: { ...hit.L, w: v3.add(T, [0.5, 0, -0.5]) } }],
        [18, { L: { d: [2, 0, -1] }, lean: 8 }, "f"],
      ],
    };
  },
  // Flying kick: the lead leg shoots out down and forward, the rear leg tucks, arms back
  airKick: (c) => {
    const T = c.tgt("airKick", 0, { dy: 3 });
    const ank = v3.add(T, [-5, 0, 1.5]);
    const hit = { fL: { w: ank, yaw: -30, pitch: -10, knee: c.pre([30, 8, 50]) }, fR: { w: c.pre([-4, -6, 18]), pitch: -50 }, lean: -14, hipYaw: -20, twist: 14, L: { d: [-6, 2, -6] }, R: { d: [-4, -2, -4] }, look: c.pre([70, 0, 25]) };
    return {
      base: "air",
      keys: [
        [0, {}],
        [5, hit],
        [15, { ...hit, fL: { ...hit.fL, w: v3.add(ank, [0.5, 0, 0]) } }],
        [21, { fL: { d: [2, 0, 2] }, lean: -4 }, "f"],
      ],
    };
  },
  // Grab and back-throw: both hands catch the collar, the body pulls in, lifts and arches,
  // and the opponent goes over the shoulder; then back to guard.
  throw: (c) => {
    const grab = { L: { w: c.pre([20, 4, 50]), aim: A(1, 0, 0) }, R: { w: c.pre([20, -4, 49]), aim: A(1, 0, 0) }, pelvis: [2.5, 0, -1], lean: 14, fistL: 0.5, fistR: 0.5 };
    return {
      keys: [
        [0, {}],
        [4, { ...grab, fistL: 1, fistR: 1 }],
        [9, { L: { w: c.pre([12, 3, 56]) }, R: { w: c.pre([12, -3, 55]) }, pelvis: [0.5, 0, -3], lean: 4, twist: 6, fistL: 1, fistR: 1 }],
        [14, { L: { w: c.pre([4, 3, 72]) }, R: { w: c.pre([4, -3, 71]) }, pelvis: [-1.5, 0, -1], lean: -16, twist: 16, hipYaw: 10, fistL: 1, fistR: 1, look: c.pre([40, 0, 90]) }],
        [20, { L: { w: c.pre([-10, 4, 68]) }, R: { w: c.pre([-10, -4, 67]) }, pelvis: [-2.5, 0, -2], lean: -30, twist: 24, hipYaw: 14, fistL: 0.3, fistR: 0.3, look: c.pre([-10, 0, 80]) }],
        [26, { pelvis: [-1, 0, -1.5], lean: -8, twist: 8, L: { d: [-2, 0, 2] }, R: { d: [-2, 0, 2] } }, "f"],
        [34, {}],
      ],
    };
  },
  // Missed grab: reach, close on air, stumble a little, recover
  throwWhiff: (c) => {
    const reach = { L: { w: c.pre([21, 4, 50]), aim: A(1, 0, 0) }, R: { w: c.pre([21, -4, 49]), aim: A(1, 0, 0) }, pelvis: [3, 0, -1.5], lean: 16, fistL: 0.3, fistR: 0.3 };
    return {
      keys: [
        [0, {}],
        [4, reach],
        [9, { ...reach, pelvis: [3.5, 0, -2], lean: 18, fistL: 1, fistR: 1 }],
        [14, { pelvis: [1.5, 0, -1], lean: 8, L: { d: [2, 0, -2] }, R: { d: [2, 0, -2] } }, "f"],
        [20, {}],
      ],
    };
  },
};
