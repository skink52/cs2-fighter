// Posture: builds a full-body pose from a compact spec, starting from the agent's bind pose.
// Model space: the fighter faces +X, +Y is their left (lead side, away from the camera), +Z up.
//   pelvis: { p: [x, y, z], yaw, pitch, roll }      yaw < 0 opens the hips toward the camera (-Y)
//   chest:  { yaw, pitch, side }                    relative to the pelvis, spread up the spine
//   look:   [x, y, z]                               where the eyes go
//   feet:   { L|R: { p: [x, y], z, yaw, heel, roll, knee } }   knee = pole point (optional)
//   hands:  { L|R: { p: [x, y, z], elbow: [x, y, z], palm: [x, y, z], bend } }
//           palm = the direction the palm faces; the wrist stays straight unless bend (deg)
//   shape:  { L, R } hand shapes for hands.mjs
import { q, v3, DEG } from "./m3.mjs";
import { IDX, BIND, bindPose, setWorld, setWorldRot } from "./rig.mjs";
import { bendSpine, twistSpine, lookAt, placeFoot, BIND_ANKLE_Z } from "./pose.mjs";
import { ik2, ARM } from "./post.mjs";
import { shapeHand } from "./hands.mjs";

// hand-local palm normal and knuckle direction, from the bind hand
const HAND = {};
for (const s of ["L", "R"]) {
  const p = (n) => BIND[IDX[`${n}_${s}`]].p;
  const f = v3.norm(v3.sub(p("finger_middle_0"), p("hand")));
  const k = v3.norm(v3.sub(p("finger_pinky_0"), p("finger_index_0")));
  let n = v3.norm(v3.cross(f, k));
  if (v3.dot(n, v3.sub(p("finger_thumb_2"), p("finger_middle_0"))) < 0) n = v3.mul(n, -1);
  const hq = q.conj(BIND[IDX["hand_" + s]].q);
  HAND[s] = { palm: q.rotate(hq, n), fwd: q.rotate(hq, f) };
}
export const palmDir = (W, s) => q.rotate(W[IDX["hand_" + s]].q, HAND[s].palm);
export const knuckleDir = (W, s) => q.rotate(W[IDX["hand_" + s]].q, HAND[s].fwd);

// Hand to p with the elbow toward `elbow`; the hand keeps a straight wrist (follows the forearm)
// and is rolled about the forearm so the palm faces `palm`; `bend` tips the wrist (deg, + = toward
// the palm).
export function setHand(W, s, p, { elbow = null, palm = null, bend = 0, side = 0 } = {}) {
  const [ua, la, ha] = ARM[s].map((n) => IDX[n]);
  ik2(W, ...ARM[s], p, { pole: elbow, keepEnd: false });
  // straight wrist: the hand's rotation relative to the forearm back to its bind relation
  const bindRel = q.mul(q.conj(BIND[la].q), BIND[ha].q);
  setWorldRot(W, ha, q.mul(W[la].q, bindRel));
  const fax = v3.norm(v3.sub(W[ha].p, W[la].p));
  if (palm) {
    const cur = v3.perp(palmDir(W, s), fax), want = v3.perp(palm, fax);
    if (v3.len(cur) > 1e-4 && v3.len(want) > 1e-4) {
      const a = Math.atan2(v3.dot(v3.cross(v3.norm(cur), v3.norm(want)), fax), v3.dot(v3.norm(cur), v3.norm(want)));
      setWorldRot(W, ha, q.mul(q.axisAngle(fax, a), W[ha].q));
    }
  }
  if (bend || side) {
    const pd = palmDir(W, s), kd = knuckleDir(W, s);
    const bendAx = v3.norm(v3.cross(kd, pd));
    let r = W[ha].q;
    if (bend) r = q.mul(q.axisAngle(bendAx, bend * DEG), r);
    if (side) r = q.mul(q.axisAngle(pd, side * DEG), r);
    setWorldRot(W, ha, r);
  }
}

export function posture(P) {
  const W = bindPose();
  const pi = IDX.pelvis;
  const pel = P.pelvis || {};
  // pelvis place and turn (everything below and above follows)
  setWorld(W, pi, { q: W[pi].q, p: pel.p ? pel.p.slice() : W[pi].p });
  const rp = q.mul(q.axisAngle([0, 0, 1], (pel.yaw || 0) * DEG), q.mul(q.axisAngle([0, 1, 0], (pel.pitch || 0) * DEG), q.axisAngle([1, 0, 0], (pel.roll || 0) * DEG)));
  setWorldRot(W, pi, q.mul(rp, W[pi].q));
  // spine
  const ch = P.chest || {};
  if (ch.pitch) bendSpine(W, q.rotate(rp, [0, 1, 0]), ch.pitch * DEG, ch.pitchW || [0.15, 0.25, 0.3, 0.3]);
  if (ch.side) bendSpine(W, q.rotate(rp, [1, 0, 0]), ch.side * DEG);
  if (ch.yaw) twistSpine(W, ch.yaw * DEG, ch.yawW || [0.2, 0.25, 0.3, 0.25]);
  // legs
  for (const s of ["L", "R"]) {
    const f = P.feet && P.feet[s];
    if (!f) continue;
    const heel = f.heel || 0;
    const a = heel * DEG;
    const z = f.z ?? (a ? 1.29 + 5.4 * Math.sin(a) + 3.04 * Math.cos(a) : BIND_ANKLE_Z);
    placeFoot(W, s, [f.p[0], f.p[1], z], f.yaw || 0, { pitch: f.pitch ?? -heel, roll: f.roll || 0, pole: f.knee || null });
  }
  // arms
  for (const s of ["L", "R"]) {
    const h = P.hands && P.hands[s];
    if (h) setHand(W, s, h.p, h);
  }
  if (P.look) lookAt(W, P.look, { roll: P.headRoll || 0 });
  if (P.shape) for (const s of ["L", "R"]) if (P.shape[s]) shapeHand(W, s, P.shape[s]);
  return W;
}
