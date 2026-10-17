// Launches, knockdowns and get-ups, keyed as whole-body postures (posture.mjs).
// Airborne clips are rested on their lowest point, so the game's height carries the body: when
// the game's height reaches 0 the back and hips meet the floor, never a lone foot. Lying clips
// rest on the back with the feet and hands on the floor.
import { STANCES, stanceSpec, airStance } from "./stances.mjs";
import { posture, sampleKeys, cloneSpec } from "./posture.mjs";
import { Clip } from "./clip.mjs";
import { IDX } from "./rig.mjs";
import { v3 } from "./m3.mjs";
import { restOnFloor } from "./states.mjs";

// a complete key: every channel present so the curves never hold a stale value
function full(s) {
  const o = cloneSpec(s);
  o.pelvis = { p: o.pelvis.p, yaw: o.pelvis.yaw || 0, pitch: o.pelvis.pitch || 0, roll: o.pelvis.roll || 0, spin: o.pelvis.spin || 0 };
  o.chest = { yaw: 0, pitch: 0, side: 0, ...(o.chest || {}) };
  o.headRoll = o.headRoll || 0;
  for (const side of ["L", "R"]) {
    const f = o.feet[side];
    o.feet[side] = { p: f.p, z: f.z ?? 4.33, yaw: f.yaw || 0, heel: f.heel || 0, pitch: f.pitch ?? -(f.heel || 0), roll: f.roll || 0, rel: f.rel ?? -999, knee: f.knee || null };
    const h = o.hands[side];
    o.hands[side] = { p: h.p, elbow: h.elbow || null, palm: h.palm || null, bend: h.bend || 0 };
  }
  return o;
}
// the stance as a key, with the extra channels filled in
const stanceKey = (id, air = false) => {
  const S = air ? airStance(id) : STANCES[id];
  const s = full(stanceSpec(S));
  s.fistL = S.fist; s.fistR = S.fist;
  // the stance's own knee and elbow directions as explicit poles, so they blend with other keys
  const W = posture(stanceSpec(S));
  for (const side of ["L", "R"]) {
    const pole = (a, b, c) => { const A = W[IDX[a + side]].p, B = W[IDX[b + side]].p, C = W[IDX[c + side]].p;
      const bulge = v3.norm(v3.sub(B, v3.mul(v3.add(A, C), 0.5))); return v3.add(B, v3.mul(bulge, 25)); };
    if (!s.feet[side].knee) s.feet[side].knee = pole("leg_upper_", "leg_lower_", "ankle_");
    if (!s.hands[side].elbow) s.hands[side].elbow = pole("arm_upper_", "arm_lower_", "hand_");
  }
  return s;
};

function keyedPosture(id, key, keys, { loop = false, rest = null } = {}) {
  const S = STANCES[id];
  const n = keys[keys.length - 1][0] + 1;
  const ks = keys.map(([f, s]) => [f, full(s)]);
  // knee poles are optional per key; give every key one so they interpolate
  for (const [, s] of ks) for (const side of ["L", "R"]) {
    const f = s.feet[side];
    if (!f.knee) f.knee = [f.p[0] + 30, f.p[1] + (side === "L" ? 4 : -4), (f.z || 4) + 30];
  }
  let specs = sampleKeys(ks, n);
  if (loop) specs.pop();
  for (const sp of specs) for (const side of ["L", "R"]) if (sp.feet[side].rel < -500) delete sp.feet[side].rel;
  let poses = specs.map((sp) => posture(sp));
  if (rest) poses = poses.map((W, f) => restOnFloor(W, typeof rest === "function" ? rest(f) : rest));
  const c = new Clip(`${id}_${key}`, poses, { loop });
  c.fist = (f) => ({ L: specs[f].fistL ?? S.fist, R: specs[f].fistR ?? S.fist });
  return c;
}

// ---------------------------------------------------------------- the poses
// thrown back off the feet: hips go first, the chest follows, arms fly forward
function struck(id) {
  const s = stanceKey(id);
  Object.assign(s, {
    pelvis: { p: [-3, -1, s.pelvis.p[2] + 1], yaw: -25, pitch: -16, roll: 0, spin: 0 },
    chest: { yaw: 0, pitch: -16, side: 0 },
    look: [60, 0, 96], fistL: 0.25, fistR: 0.25,
  });
  s.feet.L = { ...s.feet.L, z: 6, heel: 25, pitch: -25 };
  s.hands.L = { p: [16, 14, 62], elbow: [4, 22, 54], palm: [1, 0, 0] };
  s.hands.R = { p: [10, -16, 60], elbow: [0, -24, 52], palm: [1, 0, 0] };
  return s;
}
function airborne(id, t) {
  // t 0 = just off the feet, 1 = laid out in the air
  const L = (a, b) => a + (b - a) * t;
  const s = stanceKey(id);
  Object.assign(s, {
    pelvis: { p: [L(-6, -8), -1, L(32, 24)], yaw: L(-20, -8), pitch: L(-40, -70), roll: 0, spin: L(0, 8) },
    chest: { yaw: 0, pitch: L(-12, -6), side: 0 },
    look: [L(60, 40), 0, L(80, 44)], fistL: 0.2, fistR: 0.2,
  });
  s.feet.L = { p: [L(14, 10), 6], z: L(12, 25), yaw: 0, rel: L(25, 35), knee: [L(20, 14), 8, L(40, 48)] };
  s.feet.R = { p: [L(-2, 3), -7], z: L(8, 18), yaw: 0, rel: L(30, 40), knee: [L(12, 10), -8, L(32, 42)] };
  s.hands.L = { p: [L(20, 15), 16, L(56, 44)], elbow: [L(8, 4), 24, L(54, 50)], palm: [0.5, 0, -1] };
  s.hands.R = { p: [L(16, 11), -18, L(52, 40)], elbow: [L(4, 0), -26, L(50, 46)], palm: [0.5, 0, -1] };
  return s;
}
// on the back: lead knee up with the foot flat, rear leg out, hands by the hips, head on the floor
function lying(id, ko = 0) {
  const s = stanceKey(id);
  if (!ko) {
    Object.assign(s, {
      pelvis: { p: [-6, 0, 8], yaw: 0, pitch: -84, roll: 0, spin: 10 },
      chest: { yaw: 0, pitch: 4, side: 0 },
      look: [-12, -6, 60], fistL: 0.35, fistR: 0.35,
    });
    s.feet.L = { p: [10, 7], z: 4.33, yaw: 10, knee: [4, 9, 34] };
    s.feet.R = { p: [29, -7], z: 4.6, yaw: -8, rel: 20, knee: [22, -9, 30] };
    s.hands.L = { p: [-14, 17, 2], elbow: [-14, 19, 8], palm: [0, 0, -1] };
    s.hands.R = { p: [-12, -17, 2], elbow: [-12, -20, 8], palm: [0, 0, -1] };
  } else {
    Object.assign(s, {
      pelvis: { p: [-6, 0, 8], yaw: 0, pitch: -88, roll: 0, spin: 14 },
      chest: { yaw: 0, pitch: -2, side: 4 },
      look: [-40, -40, 30], headRoll: 0, fistL: 0.1, fistR: 0.1,
    });
    s.feet.L = { p: [28, 11], z: 4.6, yaw: 20, rel: 30, knee: [20, 16, 30] };
    s.feet.R = { p: [26, -12], z: 4.6, yaw: -30, rel: 30, knee: [18, -16, 30] };
    s.hands.L = { p: [-22, 26, 2], elbow: [-14, 24, 6], palm: [0, 0, 1] };
    s.hands.R = { p: [-26, -24, 2], elbow: [-18, -22, 6], palm: [0, 0, 1] };
  }
  return s;
}
const nudge = (s, f) => { const o = cloneSpec(s); f(o); return o; };

// BREAK: curled from the hit, then everything flung out at once (a burst), back to guard
function breakKeys(id) {
  const S = STANCES[id];
  const st = stanceKey(id);
  const curl = nudge(st, (s) => {
    s.pelvis.p = [s.pelvis.p[0] - 2, s.pelvis.p[1], s.pelvis.p[2] - 5]; s.pelvis.pitch = 18; s.chest = { yaw: 0, pitch: 30, side: 0 };
    s.hands.L = { p: [8, 6, 46], elbow: [10, 14, 34], palm: [0, -1, 0] }; s.hands.R = { p: [6, -6, 46], elbow: [8, -14, 34], palm: [0, 1, 0] };
    s.look = [60, 0, 20]; s.fistL = 1; s.fistR = 1;
  });
  const out = nudge(st, (s) => {
    s.pelvis.p = [s.pelvis.p[0], s.pelvis.p[1], s.pelvis.p[2] + 1]; s.pelvis.yaw = -10; s.pelvis.pitch = -8; s.chest = { yaw: 0, pitch: -14, side: 0 };
    s.feet.L = { p: [19, 12], z: 4.33, yaw: 25 }; s.feet.R = { p: [-17, -13], z: 4.33, yaw: -35 };
    s.hands.L = { p: [30, 22, 70], elbow: [16, 22, 64], palm: [0.3, 0.3, 1] }; s.hands.R = { p: [-22, -24, 70], elbow: [-10, -24, 64], palm: [-0.3, -0.3, 1] };
    s.look = [80, 0, 90]; s.fistL = 0; s.fistR = 0;
  });
  return [[0, curl], [3, out], [9, nudge(out, (s) => { s.hands.L.p[2] = 67; s.hands.R.p[2] = 67; })], [16, st]];
}
// air dodge: a tight tuck, diving forward or rolling back, opening into the jump pose
function dodgeKeys(id, dir) {
  const air = stanceKey(id, true);
  const tuck = nudge(air, (s) => {
    const z = s.pelvis.p[2];
    s.pelvis.pitch = dir > 0 ? 40 : -45; s.pelvis.yaw = -20; s.chest = { yaw: 0, pitch: dir > 0 ? 30 : 34, side: 0 };
    s.feet.L = { p: [dir > 0 ? 2 : 12, 6], z: z - 12, rel: 30, knee: [dir > 0 ? 20 : 26, 8, z + 14] };
    s.feet.R = { p: [dir > 0 ? -4 : 8, -6], z: z - 15, rel: 30, knee: [dir > 0 ? 16 : 22, -8, z + 10] };
    s.hands.L = { p: [dir > 0 ? 18 : 12, 8, z + 8], elbow: [dir > 0 ? 6 : 2, 14, z + 4], palm: [0, -1, 0] };
    s.hands.R = { p: [dir > 0 ? 16 : 10, -8, z + 8], elbow: [dir > 0 ? 4 : 0, -14, z + 4], palm: [0, 1, 0] };
    s.look = dir > 0 ? [60, 0, 0] : [40, 0, 80]; s.fistL = 0.6; s.fistR = 0.6;
  });
  return [[0, air], [4, tuck], [10, nudge(tuck, (s) => { s.pelvis.pitch += dir > 0 ? 8 : -8; })], [15, air]];
}

export const FALL_ANIMS = {
  burst: (id) => keyedPosture(id, "burst", breakKeys(id)),
  airdodgef: (id) => keyedPosture(id, "airdodgef", dodgeKeys(id, 1)),
  airdodgeb: (id) => keyedPosture(id, "airdodgeb", dodgeKeys(id, -1)),
  launch: (id) => keyedPosture(id, "launch", [
    [0, struck(id)], [6, airborne(id, 0)], [13, airborne(id, 0.65)], [20, airborne(id, 1)],
  ], { rest: 1 }),
  launchhold: (id) => {
    const a = airborne(id, 1);
    const b = nudge(a, (s) => { s.hands.L.p = [13, 18, 48]; s.hands.R.p = [13, -20, 37]; s.feet.L.z = 27; s.feet.R.z = 16; s.pelvis.pitch = -73; });
    return keyedPosture(id, "launchhold", [[0, a], [16, b], [32, a]], { loop: true, rest: 1 });
  },
  down: (id) => {
    const a = lying(id);
    const b = nudge(a, (s) => { s.chest.pitch = 7; s.look = [-10, -6, 62]; s.hands.L.elbow = [-14, 19, 9]; });
    return keyedPosture(id, "down", [[0, a], [24, b], [48, a]], { loop: true, rest: 1 });
  },
  downko: (id) => {
    const a = lying(id, 1);
    const b = nudge(a, (s) => { s.chest.pitch = 0; });
    return keyedPosture(id, "downko", [[0, a], [32, b], [64, a]], { loop: true, rest: 1 });
  },
  // sit up on the hands, feet under, rise into guard
  getup: (id) => {
    const S = STANCES[id];
    const lie = lying(id);
    const sit = nudge(lie, (s) => {
      s.pelvis = { p: [-6, 0, 8], yaw: 0, pitch: -28, roll: 0, spin: 0 }; s.chest = { yaw: 0, pitch: 16, side: 0 };
      s.feet.L = { p: [10, 7], z: 4.33, yaw: 10, knee: [10, 9, 40] }; s.feet.R = { p: [8, -7], z: 4.33, yaw: -5, knee: [8, -9, 40] };
      s.hands.L = { p: [-22, 12, 2], elbow: [-14, 14, 10], palm: [0, 0, -1] }; s.hands.R = { p: [-22, -12, 2], elbow: [-14, -14, 10], palm: [0, 0, -1] };
      s.look = [60, 0, 30]; s.fistL = 0; s.fistR = 0;
    });
    const st = stanceKey(id);
    const rise = nudge(st, (s) => {
      s.pelvis = { ...s.pelvis, p: [-2, -1, 20], pitch: 32, spin: 0 }; s.chest = { ...s.chest, pitch: 18 };
      s.feet.L = { p: [10, 6], z: 4.33, yaw: 10 }; s.feet.R = { p: [-6, -7], yaw: -30, heel: 35 };
      s.hands.L = { p: [16, 10, 26], elbow: [6, 18, 22], palm: [0, -0.6, -0.8] }; s.hands.R = { p: [8, -12, 24], elbow: [0, -18, 24], palm: [0, 0.6, -0.8] };
      s.look = [80, 0, 40]; s.fistL = S.fist * 0.6; s.fistR = S.fist * 0.6;
    });
    const up = nudge(st, (s) => { s.pelvis.p = [s.pelvis.p[0], s.pelvis.p[1], s.pelvis.p[2] - 4]; s.pelvis.pitch += 8; });
    return keyedPosture(id, "getup", [[0, lie], [5, sit], [10, rise], [14, up], [18, st]],
      { rest: (f) => (f <= 5 ? 1 : f >= 9 ? 0 : (9 - f) / 4) });
  },
};
