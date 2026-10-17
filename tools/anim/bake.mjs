// Bakes 3D clips into the 2D joint tracks the game core uses for hit boxes, hurt boxes and the
// browser preview: the fight-plane projection (x forward, y up) in fighter units, front limbs =
// the lead side (left in the unmirrored clips).
import { q, v3 } from "./m3.mjs";
import { IDX } from "./rig.mjs";

export const FU = 0.72;   // model units per fighter unit (SKELETON_UNITS in the core)
export const JOINTS = ["P", "N", "H", "S", "fE", "fW", "fF", "bE", "bW", "bF", "fK", "fA", "fT", "bK", "bA", "bT", "X0", "X1"];

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
    X0: H, X1: H,
  };
  return JOINTS.map((j) => [pts[j][0] / FU, pts[j][2] / FU]);
}

// one clip -> { n, loop, j: [ints, 0.1 FU, n * joints * 2] }
export function bakeClip(clip) {
  const j = [];
  for (const W of clip.poses) for (const [x, y] of jointsOf(W)) j.push(Math.round(x * 10), Math.round(y * 10));
  const out = { n: clip.n, loop: !!clip.loop, j };
  if (clip.root) out.root = clip.root.map((x) => Math.round((x / FU) * 10));
  if (clip.events && Object.keys(clip.events).length) out.ev = clip.events;
  return out;
}
