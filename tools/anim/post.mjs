// Pose finishing passes and IK on rig poses (arrays of world {q, p}).
//  - twist bones: spread limb twist along the agent's TWIST bones (the bone-merged agent copies
//    them from our rig, so leaving them at bind makes skin wring at shoulders, wrists and neck)
//  - fists: curl the fingers (0 open .. 1 fist), per hand
//  - two-bone IK for arms and legs that keeps the existing bend plane
import { q, v3, clamp } from "./m3.mjs";
import { SK, IDX, BIND, setWorldRot, setWorld } from "./rig.mjs";

const local = (W, i) => q.mul(q.conj(W[SK[i].pi].q), W[i].q);
const bindLocalQ = (i) => SK[i].local.q;

// twist of bone i about its own X axis, relative to its parent (beyond its bind relation)
function twistAbout(W, i) {
  const rel = q.mul(q.conj(bindLocalQ(i)), local(W, i));   // rotation since bind, in bone-local space
  return q.twistAngle(q.norm(rel), [1, 0, 0]);
}
// world rotation of a twist bone that sits under `parent` with its bind local, turned about X
function placeTwist(W, ti, angle) {
  const pi = SK[ti].pi;
  const lq = q.mul(bindLocalQ(ti), q.axisAngle([1, 0, 0], angle));
  W[ti] = { q: q.norm(q.mul(W[pi].q, lq)), p: v3.add(W[pi].p, q.rotate(W[pi].q, SK[ti].local.p)) };
}

export function spreadTwist(W) {
  for (const s of ["L", "R"]) {
    // upper arm: its twist under the clavicle is carried 1/3 and 2/3 of the way by the TWIST bones
    const ua = IDX["arm_upper_" + s];
    const tw = twistAbout(W, ua);
    placeTwist(W, IDX[`arm_upper_${s}_TWIST`], -(2 / 3) * tw);
    placeTwist(W, IDX[`arm_upper_${s}_TWIST1`], -(1 / 3) * tw);
    // forearm: the hand's roll about the forearm is carried 1/3 and 2/3 down the forearm
    const hand = IDX["hand_" + s];
    const roll = twistAbout(W, hand);
    placeTwist(W, IDX[`arm_lower_${s}_TWIST`], (1 / 3) * roll);
    placeTwist(W, IDX[`arm_lower_${s}_TWIST1`], (2 / 3) * roll);
    // thigh
    const ul = IDX["leg_upper_" + s];
    const lt = twistAbout(W, ul);
    placeTwist(W, IDX[`leg_upper_${s}_TWIST`], -(2 / 3) * lt);
    placeTwist(W, IDX[`leg_upper_${s}_TWIST1`], -(1 / 3) * lt);
  }
  // neck: head_0_TWIST (under neck_0) takes half the head's turn relative to the neck
  const hi = IDX.head_0, nt = IDX.head_0_TWIST;
  const rel = q.mul(q.conj(bindLocalQ(hi)), local(W, hi));
  const half = q.slerp([0, 0, 0, 1], rel, 0.5);
  const pi = SK[nt].pi;
  W[nt] = { q: q.norm(q.mul(W[pi].q, q.mul(bindLocalQ(nt), half))), p: v3.add(W[pi].p, q.rotate(W[pi].q, SK[nt].local.p)) };
  return W;
}

// ------------------------------------------------------------------ fingers
const FINGERS = ["index", "middle", "ring", "pinky"];
const CURL = {};
for (const side of ["L", "R"]) {
  const p = (n) => BIND[IDX[n + "_" + side]].p;
  const f = v3.norm(v3.sub(p("finger_middle_1"), p("finger_middle_0")));
  const k = v3.norm(v3.sub(p("finger_pinky_0"), p("finger_index_0")));
  let n = v3.norm(v3.cross(f, k));
  if (v3.dot(n, v3.sub(p("finger_thumb_2"), p("finger_middle_0"))) < 0) n = v3.mul(n, -1);
  const tf = v3.norm(v3.sub(p("finger_thumb_2"), p("finger_thumb_1")));
  CURL[side] = { axis: v3.norm(v3.cross(f, n)), thumbAxis: v3.norm(v3.cross(tf, n)) };
}
// fist: 0 = open relaxed hand, 1 = tight fist. spread: open fingers apart (flat hand)
export function curlFingers(W, side, fist = 1, { thumb = null } = {}) {
  const ax = CURL[side];
  const chain = [];
  for (const f of FINGERS) [0, 1, 2].forEach((j) => chain.push([`finger_${f}_${j}_${side}`, [1.05, 1.45, 1.0][j] * fist + 0.12 * (1 - fist)]));
  const th = thumb === null ? fist : thumb;
  [1, 2].forEach((j) => chain.push([`finger_thumb_${j}_${side}`, [0.5, 0.7][j - 1] * th, true]));
  for (const [name, ang, isThumb] of chain) {
    const i = IDX[name];
    if (i === undefined) continue;
    const bindW = BIND[i].q;
    const la = q.rotate(q.conj(bindW), isThumb ? ax.thumbAxis : ax.axis);
    const lq = q.mul(bindLocalQ(i), q.axisAngle(la, ang));
    const pi = SK[i].pi;
    setWorld(W, i, { q: q.mul(W[pi].q, lq), p: v3.add(W[pi].p, q.rotate(W[pi].q, SK[i].local.p)) });
  }
  return W;
}

// ------------------------------------------------------------------ two-bone IK
// Moves the end of a chain (e.g. ankle) to `target`. The bend keeps its current plane unless a
// `pole` point is given. Descendants keep their local transforms; `keepEnd` keeps the end bone's
// world rotation (feet stay flat, fists keep their angle).
export function ik2(W, upper, middle, end, target, { pole = null, keepEnd = true, soft = 0.995 } = {}) {
  const A = IDX[upper], B = IDX[middle], C = IDX[end];
  const endRot = W[C].q;
  const a = W[A].p, b = W[B].p, c = W[C].p;
  const l1 = v3.dist(a, b), l2 = v3.dist(b, c);
  let toT = v3.sub(target, a);
  const dist = clamp(v3.len(toT), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * soft);
  // bend plane normal
  let n = v3.cross(v3.sub(b, a), v3.sub(c, b));
  if (pole) {
    const axis = v3.norm(toT);
    const pv = v3.perp(v3.sub(pole, a), axis);
    if (v3.len(pv) > 1e-4) n = v3.cross(axis, v3.norm(pv));   // knee/elbow toward the pole
  }
  if (v3.len(n) < 1e-6) n = v3.cross(v3.sub(b, a), [0, 0, 1]);
  n = v3.norm(n);
  // 1) set the middle angle: angle between upper and lower so |c - a| = dist
  const cosB = clamp((l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2), -1, 1);
  const wantInterior = Math.acos(cosB);   // angle at the middle joint between the two bones
  const u1 = v3.norm(v3.sub(b, a)), u2 = v3.norm(v3.sub(c, b));
  const curInterior = Math.acos(clamp(v3.dot(v3.mul(u1, -1), u2), -1, 1));
  // rotate the lower bone about n (sign chosen so the interior angle grows toward the wanted one)
  const bendNow = v3.dot(v3.cross(u1, u2), n) >= 0 ? 1 : -1;
  const delta = (curInterior - wantInterior) * bendNow;
  if (Math.abs(delta) > 1e-6) setWorldRot(W, B, q.mul(q.axisAngle(n, delta), W[B].q));
  // 2) swing the upper bone so the end lands on the target direction
  const c2 = W[C].p;
  const sw = q.between(v3.sub(c2, a), v3.norm(toT));
  setWorldRot(W, A, q.mul(sw, W[A].q));
  // 3) pole: rotate the whole chain about a->target so the middle joint faces the pole
  if (pole) {
    const axis = v3.norm(toT);
    const mid = v3.perp(v3.sub(W[B].p, a), axis), pv = v3.perp(v3.sub(pole, a), axis);
    if (v3.len(mid) > 1e-4 && v3.len(pv) > 1e-4) {
      const ang = Math.atan2(v3.dot(v3.cross(v3.norm(mid), v3.norm(pv)), axis), v3.dot(v3.norm(mid), v3.norm(pv)));
      setWorldRot(W, A, q.mul(q.axisAngle(axis, ang), W[A].q));
    }
  }
  if (keepEnd) setWorldRot(W, C, endRot);
  return dist - v3.len(toT);   // 0 when reached; negative when stretched out of reach
}

export const LEG = { L: ["leg_upper_L", "leg_lower_L", "ankle_L"], R: ["leg_upper_R", "leg_lower_R", "ankle_R"] };
export const ARM = { L: ["arm_upper_L", "arm_lower_L", "hand_L"], R: ["arm_upper_R", "arm_lower_R", "hand_R"] };
