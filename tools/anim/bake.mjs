// Bakes 3D clips into the 2D joint tracks the game core uses for hit boxes, hurt boxes and the
// browser preview: the fight-plane projection (x forward, y up) in fighter units, front limbs =
// the lead side (left in the unmirrored clips).
import { q, v3 } from "./m3.mjs";
import { IDX } from "./rig.mjs";

export const FU = 0.72;   // model units per fighter unit (SKELETON_UNITS in the core)
export const JOINTS = ["P", "N", "H", "S", "fE", "fW", "fF", "bE", "bW", "bF", "fK", "fA", "fT", "bK", "bA", "bT"];

export function jointsOf(W) {
  const p = (n) => W[IDX[n]].p;
  const hip = v3.lerp(p("leg_upper_L"), p("leg_upper_R"), 0.5);
  const head = W[IDX.head_0];
  const H = v3.add(head.p, q.rotate(head.q, [2.6, 0, 0]));          // head_0 X runs up the skull
  const fist = (s) => v3.lerp(p("hand_" + s), p("finger_middle_0_" + s), 0.8);
  const toe = (s) => { const a = p("ankle_" + s), b = p("ball_" + s); return v3.add(b, v3.mul(v3.norm(v3.sub(b, a)), 2.2)); };
  const sh = v3.lerp(p("arm_upper_L"), p("arm_upper_R"), 0.5);
  const pts = {
    P: hip, N: p("neck_0"), H, S: sh,
    fE: p("arm_lower_L"), fW: p("hand_L"), fF: fist("L"),
    bE: p("arm_lower_R"), bW: p("hand_R"), bF: fist("R"),
    fK: p("leg_lower_L"), fA: p("ankle_L"), fT: toe("L"),
    bK: p("leg_lower_R"), bA: p("ankle_R"), bT: toe("R"),
  };
  return JOINTS.map((j) => [pts[j][0] / FU, pts[j][2] / FU]);
}

// Track encoding (decoded by the core): two characters per value, tenths of a fighter unit
// offset by 2048, so -204.8 .. 204.7 FU.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function encodeTrack(values) {
  let s = "";
  for (const v of values) {
    const k = Math.max(0, Math.min(4095, Math.round(v * 10) + 2048));
    s += B64[k >> 6] + B64[k & 63];
  }
  return s;
}
export function decodeTrack(str) {
  const out = [];
  for (let i = 0; i < str.length; i += 2) out.push((B64.indexOf(str[i]) * 64 + B64.indexOf(str[i + 1]) - 2048) / 10);
  return out;
}

// one clip -> { n, loop, r, j: encoded n * joints * 2 values }
export function bakeClip(clip) {
  const vals = [];
  for (const W of clip.poses) for (const [x, y] of jointsOf(W)) vals.push(x, y);
  const out = { n: clip.n, loop: !!clip.loop, j: encodeTrack(vals) };
  if (clip.rate && clip.rate !== 1) out.r = Math.round(clip.rate * 1e4) / 1e4;
  if (clip.events && Object.keys(clip.events).length) out.ev = clip.events;
  return out;
}
