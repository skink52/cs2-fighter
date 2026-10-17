// Moves keyed as whole-body postures (posture.mjs specs) at a few frames and interpolated, for
// strikes with no usable capture: the sweep.
import { STANCES, crouchStance, stanceSpec } from "./stances.mjs";
import { posture, sampleKeys, cloneSpec } from "./posture.mjs";
import { Clip } from "./clip.mjs";

function keyed(id, key, core, make) {
  const ch = core.CHARACTERS.find((c) => c.id === id);
  const M = core.MOVES[key];
  const k = ch.stats.frame || 1;
  const n = Math.round(M.total * k) + 1;
  const keys = make(id).map(([f, s]) => [Math.round(f * k), s]);
  const specs = sampleKeys(keys, n);
  const S = STANCES[id];
  const poses = specs.map((sp) => posture(sp));
  const c = new Clip(`${id}_${key}`, poses);
  c.fist = (f) => ({ L: specs[f].fistL ?? S.fist, R: specs[f].fistR ?? S.fist });
  return c;
}

// Sweep: drop onto the lead leg, both hands to the floor, and the rear leg swings round the
// camera side, dead straight and skimming the floor, to well past the front foot.
function sweepKeys(id) {
  const C = crouchStance(id);
  const base = { ...stanceSpec(C), fistL: C.fist, fistR: C.fist };
  const k = (mut) => { const s = cloneSpec(base); mut(s); return s; };
  const L = C.lead.p, R = C.rear.p;
  const low = (s, z, yaw, pitch) => { s.pelvis.p = [s.pelvis.p[0], s.pelvis.p[1], z]; s.pelvis.yaw = yaw; s.pelvis.pitch = pitch; };
  return [
    [0, base],
    [3, k((s) => {   // load: sink, hips start to turn, lead hand reaches for the floor
      low(s, 16, -20, 18); s.pelvis.p[0] = 6; s.chest = { yaw: 0, pitch: 30, side: 4 };
      s.feet.L = { p: [L[0], L[1]], yaw: 20, heel: 10 }; s.feet.R = { p: [R[0] + 2, R[1] - 6], z: 6, yaw: -40, pitch: -15 };
      s.hands.L = { p: [L[0] + 8, L[1] + 6, 6], elbow: [L[0], L[1] + 16, 16], palm: [0, 0, -1] };
      s.hands.R = { p: [8, -12, 22], elbow: [0, -18, 20], palm: [0, 0.6, -0.8] };
      s.look = [70, 0, 12]; s.fistL = 0.1;
    })],
    [5, k((s) => {   // the leg comes round the camera side, low
      low(s, 13, 20, 22); s.pelvis.p[0] = 8; s.chest = { yaw: -10, pitch: 36, side: 6 };
      s.feet.L = { p: [L[0], L[1]], yaw: 40, heel: 16 }; s.feet.R = { p: [8, -32], z: 5, yaw: 40, pitch: 0 };
      s.hands.L = { p: [L[0] + 9, L[1] + 7, 3], elbow: [L[0] + 2, L[1] + 16, 14], palm: [0, 0, -1] };
      s.hands.R = { p: [6, -14, 5], elbow: [-2, -20, 14], palm: [0, 0, -1] };
      s.look = [70, 0, 10]; s.fistL = 0; s.fistR = 0;
    })],
    [8, k((s) => {   // contact: leg straight out in front, foot hooked, body flat and low
      low(s, 15, 62, 32); s.pelvis.p[0] = 5; s.pelvis.p[1] = -2; s.chest = { yaw: -30, pitch: 44, side: 8 };
      s.feet.L = { p: [L[0] - 1, L[1]], yaw: 60, heel: 22 }; s.feet.R = { p: [37, -4], z: 4.6, yaw: 90, pitch: 10, roll: -20 };
      s.hands.L = { p: [L[0] + 9, L[1] + 8, 3], elbow: [L[0] + 3, L[1] + 18, 14], palm: [0, 0, -1] };
      s.hands.R = { p: [4, -12, 4], elbow: [-4, -18, 14], palm: [0, 0, -1] };
      s.look = [60, 0, 8]; s.fistL = 0; s.fistR = 0;
    })],
    [11, k((s) => {  // follow through across the front
      low(s, 15, 78, 32); s.pelvis.p[0] = 5; s.pelvis.p[1] = -1; s.chest = { yaw: -34, pitch: 44, side: 8 };
      s.feet.L = { p: [L[0] - 1, L[1]], yaw: 70, heel: 22 }; s.feet.R = { p: [36, 7], z: 4.6, yaw: 110, pitch: 10, roll: -20 };
      s.hands.L = { p: [L[0] + 9, L[1] + 8, 3], elbow: [L[0] + 3, L[1] + 18, 14], palm: [0, 0, -1] };
      s.hands.R = { p: [4, -12, 4], elbow: [-4, -18, 14], palm: [0, 0, -1] };
      s.look = [60, 0, 8]; s.fistL = 0; s.fistR = 0;
    })],
    [19, k((s) => {  // gather: the leg folds back under, hips turn home
      low(s, 15, 10, 20); s.pelvis.p[0] = 5; s.chest = { yaw: 0, pitch: 30, side: 3 };
      s.feet.L = { p: [L[0], L[1]], yaw: 25, heel: 12 }; s.feet.R = { p: [R[0] + 8, R[1] - 8], z: 7, yaw: -10, pitch: -10 };
      s.hands.L = { p: [L[0] + 7, L[1] + 4, 16], elbow: [L[0], L[1] + 14, 18], palm: [0, -0.5, -0.8] };
      s.look = [80, 0, 20]; s.fistL = 0.5; s.fistR = 0.5;
    })],
    [26, k((s) => { s.pelvis.p[2] -= 1; })],
    [32, base],
  ];
}

// Spin Kick (Pirouette): up on the toes of the rear foot, turning, the lead leg snaps out three
// times, each a little higher, chambering in between; arms open for balance.
function spinKickKeys(id) {
  const S = STANCES[id];
  const base = { ...stanceSpec(S), fistL: S.fist, fistR: S.fist };
  const R = S.rear.p;
  const pose = (pel, yaw, chestPitch, foot, footZ, arms) => { const s = cloneSpec(base);
    s.pelvis.p = pel; s.pelvis.yaw = yaw; s.pelvis.pitch = -4; s.chest = { yaw: 8, pitch: chestPitch, side: 0 };
    s.feet.R = { p: [R[0] + 4, R[1] + 1], yaw: -40, heel: 30 };
    s.feet.L = { p: foot, z: footZ, yaw: 0, pitch: 0, knee: [foot[0] + 20, 6, footZ + 30] };
    s.hands.L = { p: arms ? [14, 20, 56] : [20, 8, 52], elbow: [8, 26, 50], palm: [0, -0.3, -0.9] };
    s.hands.R = { p: arms ? [-6, -22, 56] : [6, -14, 50], elbow: [-4, -26, 48], palm: [0, 0.3, -0.9] };
    s.look = [100, 0, 62]; s.fistL = 0.2; s.fistR = 0.2;
    return s; };
  const chamber = (yaw) => pose([-3, -1, 40], yaw, -2, [10, 4], 24, true);
  const kick = (yaw, z, x) => pose([-5, -1, 40.5], yaw, -6, [x, 3], z, true);
  return [
    [0, base],
    [4, chamber(-30)],
    [8, kick(-20, 36, 37)], [11, kick(-18, 37, 38)],
    [13, chamber(-35)],
    [16, kick(-20, 42, 36)], [19, kick(-18, 43, 37)],
    [21, chamber(-35)],
    [24, kick(-20, 50, 35)], [28, kick(-18, 51, 36)],
    [33, chamber(-30)],
    [40, base],
  ];
}

export const POSED_MOVES = {
  spinKick: (id, core) => keyed(id, "spinKick", core, spinKickKeys),
  sweep: (id, core) => keyed(id, "sweep", core, sweepKeys),
  // Motley's banana-peel sweep is the same spin-sweep, done slipping (same frame data)
  bananaSweep: (id, core) => keyed(id, "bananaSweep", core, sweepKeys),
};
