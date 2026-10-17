// Moves keyed as whole-body postures (posture.mjs specs) at a few frames and interpolated, for
// strikes with no usable capture: the sweep.
import { STANCES, crouchStance, airStance, stanceSpec } from "./stances.mjs";
import { posture, sampleKeys, sampleSpecs, cloneSpec } from "./posture.mjs";
import { Clip } from "./clip.mjs";

function keyed(id, key, core, make) {
  const ch = core.CHARACTERS.find((c) => c.id === id);
  const M = core.MOVES[key];
  const k = ch.stats.frame || 1;
  const n = Math.round(M.total * k) + 1;
  const keys = make(id).map(([f, s]) => [Math.round(f * k), s]);
  const specs = sampleSpecs(keys, n);
  const S = STANCES[id];
  const poses = specs.map((sp) => posture(sp));
  const c = new Clip(`${id}_${key}`, poses);
  c.fist = (f) => ({ L: specs[f].fistL ?? S.fist, R: specs[f].fistR ?? S.fist });
  return c;
}

// Sweep: squat onto the lead leg (knee over the toes), both hands to the floor, and the rear leg
// swings round the camera side, straight and skimming the floor, to well past the front foot;
// the hips turn with it. Knee directions are given at every key so no knee folds the wrong way.
function sweepKeys(id) {
  const C = crouchStance(id);
  const base = { ...stanceSpec(C), fistL: C.fist, fistR: C.fist };
  const L = C.lead.p, R = C.rear.p;
  const key = (pel, yaw, pitch, chest, lead, rear, hl, hr, look, fist) => {
    const s = cloneSpec(base);
    s.pelvis = { p: pel, yaw, pitch, roll: 0 };
    s.chest = chest;
    s.feet.L = lead; s.feet.R = rear;
    s.hands.L = hl; s.hands.R = hr;
    s.look = look; s.fistL = fist; s.fistR = fist;
    return s;
  };
  const floorL = (dx = 0) => ({ p: [L[0] + 9 + dx, L[1] + 7, 3], elbow: [L[0] + 4 + dx, L[1] + 18, 14], palm: [0, 0, -1] });
  const floorR = (dx = 0) => ({ p: [9 + dx, -12, 3], elbow: [2 + dx, -20, 12], palm: [0, 0, -1] });
  const lead = (yaw, heel) => ({ p: [L[0], L[1]], yaw, heel, knee: [L[0] + 30 * Math.cos(yaw * Math.PI / 180), L[1] + 30 * Math.sin(yaw * Math.PI / 180) + 4, 30] });
  return [
    [0, base],
    // drop: hips sink and tip forward, lead hand reaches for the floor, rear heel comes up
    [3, key([3, -1, 20], -20, 18, { yaw: 0, pitch: 30, side: 2 }, lead(15, 14),
      { p: [R[0] + 1, R[1] - 6], z: 6, yaw: -40, rel: 35, knee: [R[0] + 4, R[1] - 14, -20] },
      floorL(-2), { p: [12, -10, 14], elbow: [4, -18, 18], palm: [0, 0.4, -0.9] }, [70, 0, 12], 0.2)],
    // the rear leg comes round the camera side, low and nearly straight
    [5, key([3, -1, 19], 5, 18, { yaw: -6, pitch: 34, side: 3 }, lead(25, 18),
      { p: [12, -32], z: 4.8, yaw: 30, rel: 10, knee: [26, -22, 26] },
      floorL(), floorR(), [70, 0, 10], 0)],
    // contact: leg straight out in front along the floor, foot hooked (toes up), hips turned in
    [8, key([3, -1, 19], 45, 16, { yaw: -22, pitch: 34, side: 4 }, lead(40, 20),
      { p: [40, -4], z: 4.8, yaw: 70, rel: -10, knee: [24, -12, 42] },
      floorL(), floorR(-1), [60, 0, 8], 0)],
    // follow through across the front
    [11, key([3, -1, 19], 60, 10, { yaw: -28, pitch: 36, side: 4 }, lead(50, 20),
      { p: [36, 8], z: 4.8, yaw: 110, rel: -10, knee: [22, 4, 42] },
      floorL(), floorR(-1), [60, 0, 8], 0)],
    // the leg draws back round the side, knee leading
    [15, key([3, -1, 19], 30, 14, { yaw: -12, pitch: 30, side: 3 }, lead(35, 18),
      { p: [12, -26], z: 5.5, yaw: 20, rel: 20, knee: [26, -20, 24] },
      floorL(), floorR(-1), [70, 0, 12], 0.2)],
    // gather: the leg folds back under, knee down, hips turn home, guard comes up
    [19, key([3, -1, 20], 0, 16, { yaw: 0, pitch: 22, side: 2 }, lead(20, 14),
      { p: [R[0] + 8, R[1] - 6], z: 6, yaw: -20, rel: 35, knee: [R[0] + 14, R[1] - 12, 3] },
      { p: [L[0] + 7, L[1] + 4, 18], elbow: [L[0], L[1] + 14, 18], palm: [0, -0.5, -0.8] },
      { p: [8, -10, 22], elbow: [0, -18, 22], palm: [0, 0.5, -0.8] }, [80, 0, 22], 0.5)],
    [26, (() => { const s = cloneSpec(base); s.pelvis.p = [s.pelvis.p[0], s.pelvis.p[1], s.pelvis.p[2] - 1]; return s; })()],
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

// Low lead-leg sweeps (mix-up enders): sit back onto the rear leg (rear knee low, toward the
// camera), the lead knee draws up, then the lead leg drives out straight along the floor, the
// rear hand posting on the floor behind. style: "root" (plain, toes up), "grind" (a stamping
// kick into the shins, sole first), "plie" (toe pointed, arms held out like a dancer).
function lowSweepKeys(id, key, core, style) {
  const C = crouchStance(id);
  const M = core.MOVES[key];
  const hit = M.hits[0];
  const f = hit.from, T = M.total;
  const base = { ...stanceSpec(C), fistL: C.fist, fistR: C.fist };
  const L = C.lead.p, R = C.rear.p;
  const k = (mut) => { const o = cloneSpec(base); mut(o); return o; };
  const reach = style === "grind" ? 33 : 39, fz = style === "grind" ? 9 : 4.8;
  const rel = style === "plie" ? 45 : style === "grind" ? -15 : -8;
  const arms = (o, guard) => {
    if (style === "plie") {
      o.hands.L = { p: [12, 24, 36], elbow: [6, 20, 40], palm: [0, 0, -1] };
      o.hands.R = { p: [-10, -24, 34], elbow: [-6, -20, 40], palm: [0, 0, -1] };
      o.fistL = 0.1; o.fistR = 0.1;
    } else {
      o.hands.L = { p: [12, 7, guard], elbow: [6, 16, guard - 12], palm: [0, -0.7, -0.6] };
      o.hands.R = { p: [-10, -14, 3], elbow: [-8, -20, 14], palm: [0, 0, -1] };
      o.fistR = 0.1;
    }
  };
  const rear = { p: [R[0] + 2, R[1]], yaw: -60, heel: 35, knee: [R[0] + 8, R[1] - 24, 6] };
  return [
    [0, base],
    // chamber: weight sits back, lead knee comes up to the chest
    [Math.round(f * 0.5), k((o) => {
      o.pelvis = { p: [-2, -1, 18], yaw: -30, pitch: 4, roll: 0 }; o.chest = { yaw: 6, pitch: 10, side: 0 };
      o.feet.L = { p: [L[0] - 6, L[1]], z: 11, yaw: 0, rel: 10, knee: [L[0] + 10, L[1] + 6, 44] };
      o.feet.R = rear;
      arms(o, 34); o.look = [80, 0, 30];
    })],
    // contact: the leg straight along the floor, leaning back a little, rear hand posted
    [f, k((o) => {
      o.pelvis = { p: [-4, -1, 17], yaw: -25, pitch: -6, roll: 0 }; o.chest = { yaw: 4, pitch: 16, side: 0 };
      o.feet.L = { p: [reach, L[1] - 2], z: fz, yaw: style === "grind" ? -35 : 0, rel, knee: [reach - 16, L[1] + 2, 40] };
      o.feet.R = rear;
      arms(o, 32); o.look = [90, 0, 16];
    })],
    [hit.to + 1, k((o) => {
      o.pelvis = { p: [-4, -1, 17], yaw: -25, pitch: -6, roll: 0 }; o.chest = { yaw: 4, pitch: 16, side: 0 };
      o.feet.L = { p: [reach + 1, L[1] - 2], z: fz, yaw: style === "grind" ? -35 : 0, rel, knee: [reach - 15, L[1] + 2, 40] };
      o.feet.R = rear;
      arms(o, 32); o.look = [90, 0, 16];
    })],
    // the leg folds back in and the weight comes forward again
    [Math.round(hit.to + (T - hit.to) * 0.45), k((o) => {
      o.pelvis = { p: [0, -1, 19], yaw: -35, pitch: 8, roll: 0 }; o.chest = { yaw: 6, pitch: 14, side: 0 };
      o.feet.L = { p: [L[0] + 2, L[1]], z: 6, yaw: 0, rel: 15, knee: [L[0] + 16, L[1] + 6, 36] };
      o.feet.R = { ...rear, heel: 25 };
      arms(o, 36); o.look = [90, 0, 26];
    })],
    [T, base],
  ];
}

// Fouette (Pirouette): out of the crouch she springs up (the game carries the jump), the lead
// leg whips up straight from waist height to above her head, toe pointed, then folds in as she
// spins a full turn in the air and comes down with the legs under her.
function fouetteKeys(id) {
  const C = crouchStance(id), A = airStance(id);
  const base = { ...stanceSpec(C), fistL: C.fist, fistR: C.fist };
  const air = stanceSpec(A);
  const k = (pel, yaw, pitch, chest, lead, rear, hl, hr, look, fist = 0.15) => {
    const o = cloneSpec(base);
    o.pelvis = { p: pel, yaw, pitch, roll: 0 }; o.chest = chest; o.feet.L = lead; o.feet.R = rear;
    o.hands.L = hl; o.hands.R = hr; o.look = look; o.fistL = fist; o.fistR = fist;
    return o;
  };
  const armsOut = (z) => [{ p: [8, 24, z], elbow: [4, 20, z + 6], palm: [0, 0, -1] }, { p: [-8, -24, z], elbow: [-4, -20, z + 6], palm: [0, 0, -1] }];
  const tuckR = (z) => ({ p: [-3, -5], z, yaw: -20, rel: 40, knee: [12, -8, z + 26] });
  const end = cloneSpec(air);
  end.pelvis.yaw = (air.pelvis.yaw || 0) + 360; end.fistL = 0.3; end.fistR = 0.3;
  return [
    [0, base],
    [3, k([0, -1, C.pelvis[2] - 2], C.hipYaw || -40, 14, { yaw: 0, pitch: 18, side: 0 },
      { p: C.lead.p, yaw: C.lead.yaw || 0, heel: 10 }, { p: C.rear.p, yaw: C.rear.yaw || -50, heel: 30 },
      { p: [14, 10, 26], elbow: [6, 18, 24], palm: [0, -0.6, -0.8] }, { p: [6, -12, 26], elbow: [-2, -18, 26], palm: [0, 0.6, -0.8] }, [80, 0, 30], 0.3)],
    // off the floor, the leg out at waist height
    [5, k([2, -1, 33], -25, -8, { yaw: 6, pitch: -4, side: 0 },
      { p: [24, 3], z: 30, yaw: 0, rel: 40, knee: [30, 6, 54] }, tuckR(14), ...armsOut(54), [80, 0, 48])],
    // whipping up, straight
    [9, k([2, -1, 34], -10, -16, { yaw: 4, pitch: -8, side: 0 },
      { p: [17, 4], z: 54, yaw: 0, rel: 45, knee: [36, 6, 70] }, tuckR(15), ...armsOut(58), [70, 0, 62])],
    // top: the toe above her head
    [13, k([1, -1, 34], 10, -24, { yaw: 0, pitch: -10, side: 0 },
      { p: [9, 4], z: 66, yaw: 0, rel: 45, knee: [30, 6, 80] }, tuckR(16), ...armsOut(60), [60, 0, 70])],
    // fold in and spin a full turn: the tucked body turns as one, so feet, knees and hands are
    // given facing forward and turned with the hips
    // held high to the end of the active frames
    [16, k([1, -1, 34], 25, -22, { yaw: 0, pitch: -10, side: 0 },
      { p: [11, 4], z: 60, yaw: 0, rel: 45, knee: [32, 6, 76] }, tuckR(16), ...armsOut(58), [60, 0, 66])],
    ...[18, 20, 22, 24, 26].map((f) => {
      const t = (f - 18) / 8, yaw = 50 + t * 270;
      const o = k([0, -1, 32], yaw, -4, { yaw: 0, pitch: 2, side: 0 },
        { p: [6, 5], z: 18 - 6 * t, yaw: 10, rel: 35, knee: [26, 8, 44] }, tuckR(13 - 2 * t),
        { p: [12, 8, 53], elbow: [3, 16, 45], palm: [0, -1, 0] }, { p: [8, -9, 52], elbow: [0, -16, 45], palm: [0, 1, 0] }, [90, 0, 56], 0.4);
      return [f, turnSpec(o, yaw - (A.hipYaw || -30))];
    }),
    [28, end],
  ];
}

// a posture spec turned about the vertical axis through the hips (deg): feet, knee poles, hands,
// elbows, palms and the look point go round with the body
function turnSpec(o, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  const cx = o.pelvis.p[0], cy = o.pelvis.p[1];
  const r2 = (v) => [cx + (v[0] - cx) * c - (v[1] - cy) * sn, cy + (v[0] - cx) * sn + (v[1] - cy) * c, ...v.slice(2)];
  const rd = (v) => [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2]];
  for (const side of ["L", "R"]) {
    const f = o.feet[side];
    f.p = r2(f.p).slice(0, 2); f.yaw = (f.yaw || 0) + deg; if (f.knee) f.knee = r2(f.knee);
    const h = o.hands[side];
    h.p = r2(h.p); if (h.elbow) h.elbow = r2(h.elbow); if (h.palm) h.palm = rd(h.palm);
  }
  if (o.look) o.look = r2(o.look);
  return o;
}

export const POSED_MOVES = {
  spinKick: (id, core) => keyed(id, "spinKick", core, spinKickKeys),
  sweep: (id, core) => keyed(id, "sweep", core, sweepKeys),
  // Motley's banana-peel sweep is the same spin-sweep, done slipping (same frame data)
  bananaSweep: (id, core) => keyed(id, "bananaSweep", core, sweepKeys),
  fouette: (id, core) => keyed(id, "fouette", core, fouetteKeys),
  rootSweep: (id, core) => keyed(id, "rootSweep", core, (i) => lowSweepKeys(i, "rootSweep", core, "root")),
  gearGrind: (id, core) => keyed(id, "gearGrind", core, (i) => lowSweepKeys(i, "gearGrind", core, "grind")),
  plieSweep: (id, core) => keyed(id, "plieSweep", core, (i) => lowSweepKeys(i, "plieSweep", core, "plie")),
};
