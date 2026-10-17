// Pose editing helpers: place the pelvis, bend and twist the spine, aim the head, plant feet,
// put hands somewhere with the elbows where they should be. All work on world poses in place.
import { q, v3, clamp, DEG } from "./m3.mjs";
import { SK, IDX, BIND, setWorldRot, setWorld } from "./rig.mjs";
import { ik2, LEG, ARM } from "./post.mjs";

export const SPINE = ["spine_0", "spine_1", "spine_2", "spine_3"];
const HEAD_FWD = q.rotate(q.conj(BIND[IDX.head_0].q), [1, 0, 0]);   // head-local forward (face)
const HEAD_UP = q.rotate(q.conj(BIND[IDX.head_0].q), [0, 0, 1]);
const FOOT_FWD = { L: null, R: null };   // ankle-local forward (heel -> toe, flat) and up
const FOOT_UP = { L: null, R: null };
for (const s of ["L", "R"]) {
  const a = BIND[IDX["ankle_" + s]], b = BIND[IDX["ball_" + s]];
  const toe = v3.sub(b.p, a.p);
  FOOT_FWD[s] = q.rotate(q.conj(a.q), v3.norm([toe[0], toe[1], 0]));
  FOOT_UP[s] = q.rotate(q.conj(a.q), [0, 0, 1]);
}
export const BIND_ANKLE_Z = BIND[IDX.ankle_L].p[2];

// move the whole body (pelvis and below) by d, keeping feet unless keepFeet=false
export function movePelvis(W, d, { keepFeet = true } = {}) {
  const feet = keepFeet ? ["L", "R"].map((s) => ({ s, p: W[IDX["ankle_" + s]].p.slice(), q: W[IDX["ankle_" + s]].q.slice() })) : [];
  const pi = IDX.pelvis;
  setWorld(W, pi, { q: W[pi].q, p: v3.add(W[pi].p, d) });
  for (const f of feet) { ik2(W, ...LEG[f.s], f.p); setWorldRot(W, IDX["ankle_" + f.s], f.q); }
}
// rotate the pelvis (and everything above/below) about an axis through the pelvis, feet kept
export function rotatePelvis(W, axis, ang, { keepFeet = true, keepChest = false } = {}) {
  const feet = keepFeet ? ["L", "R"].map((s) => ({ s, p: W[IDX["ankle_" + s]].p.slice(), q: W[IDX["ankle_" + s]].q.slice() })) : [];
  const chest = keepChest ? W[IDX.spine_0].q.slice() : null;
  const pi = IDX.pelvis;
  setWorldRot(W, pi, q.mul(q.axisAngle(axis, ang), W[pi].q));
  if (chest) setWorldRot(W, IDX.spine_0, chest);
  for (const f of feet) { ik2(W, ...LEG[f.s], f.p); setWorldRot(W, IDX["ankle_" + f.s], f.q); }
}
// spread a rotation over the spine bones (weights sum to 1), e.g. lean forward / twist
export function bendSpine(W, axis, ang, weights = [0.2, 0.25, 0.3, 0.25]) {
  SPINE.forEach((n, k) => { const i = IDX[n]; setWorldRot(W, i, q.mul(q.axisAngle(axis, ang * weights[k]), W[i].q)); });
}
// twist about the spine's own axis (pelvis -> neck)
export function twistSpine(W, ang, weights) {
  const axis = v3.norm(v3.sub(W[IDX.neck_0].p, W[IDX.spine_0].p));
  bendSpine(W, axis, ang, weights);
}
// aim the face at a point, splitting the turn between neck and head
export function lookAt(W, target, { neckShare = 0.4, roll = 0 } = {}) {
  for (const [bone, share] of [["neck_0", neckShare], ["head_0", 1]]) {
    const i = IDX[bone], h = IDX.head_0;
    const face = q.rotate(W[h].q, HEAD_FWD);
    const want = v3.norm(v3.sub(target, W[h].p));
    const full = q.between(face, want);
    const part = q.slerp([0, 0, 0, 1], full, share);
    setWorldRot(W, i, q.mul(part, W[i].q));
  }
  // keep the head upright-ish: remove roll around the face axis
  const h = IDX.head_0;
  const face = q.rotate(W[h].q, HEAD_FWD), up = q.rotate(W[h].q, HEAD_UP);
  const wantUp = v3.norm(v3.perp([0, 0, 1], face));
  const ang = Math.atan2(v3.dot(v3.cross(up, wantUp), face), v3.dot(up, wantUp)) + roll * DEG;
  setWorldRot(W, h, q.mul(q.axisAngle(face, ang * 0.85), W[h].q));
}
// plant a foot: ankle at p (z = ankle height), toe pointing along yaw (deg, 0 = +X), flat
// (pitch/roll in degrees tilt it: pitch>0 = toe up, roll for the outside edge)
export function placeFoot(W, s, p, yawDeg, { pitch = 0, roll = 0, pole = null } = {}) {
  const ai = IDX["ankle_" + s];
  ik2(W, ...LEG[s], p, { pole: pole || kneePole(W, s, yawDeg), keepEnd: false });
  const fwd = [Math.cos(yawDeg * DEG), Math.sin(yawDeg * DEG), 0];
  let rot = footRot(s, fwd);
  if (pitch) rot = q.mul(q.axisAngle(v3.cross([0, 0, 1], fwd), -pitch * DEG), rot);
  if (roll) rot = q.mul(q.axisAngle(fwd, roll * DEG), rot);
  setWorldRot(W, ai, rot);
}
// world rotation of an ankle whose foot points along fwd (horizontal) and stands flat
export function footRot(s, fwd) {
  const f = v3.norm(fwd), u = [0, 0, 1];
  // ankle-local basis (FOOT_FWD, FOOT_UP) -> world (f, u)
  const A = basisQ(FOOT_FWD[s], FOOT_UP[s]), B = basisQ(f, u);
  return q.norm(q.mul(B, q.conj(A)));
}
function basisQ(f, u) {
  const x = v3.norm(f), y = v3.norm(v3.cross(u, x)), z = v3.cross(x, y);
  return q.fromBasis(x, y, z);
}
// knees point roughly over the toes
function kneePole(W, s, yawDeg) {
  const hip = W[IDX["leg_upper_" + s]].p;
  return v3.add(hip, [Math.cos(yawDeg * DEG) * 40, Math.sin(yawDeg * DEG) * 40, -18]);
}
// hand to a point with the elbow pulled toward `elbow` (a point), wrist aimed by `aim` (dir)
export function placeHand(W, s, p, { elbow = null, aim = null, upHint = null } = {}) {
  ik2(W, ...ARM[s], p, { pole: elbow, keepEnd: false });
  if (aim) {
    const hi = IDX["hand_" + s];
    const cur = q.rotate(W[hi].q, [1, 0, 0]);
    setWorldRot(W, hi, q.mul(q.between(cur, aim), W[hi].q));
    if (upHint) {
      // roll the hand about its axis so its local -Z (back of the hand) faces upHint
      const ax = v3.norm(aim);
      const back = q.rotate(W[hi].q, [0, 0, s === "L" ? -1 : 1]);
      const pb = v3.perp(back, ax), pu = v3.perp(upHint, ax);
      if (v3.len(pb) > 1e-4 && v3.len(pu) > 1e-4) {
        const ang = Math.atan2(v3.dot(v3.cross(v3.norm(pb), v3.norm(pu)), ax), v3.dot(v3.norm(pb), v3.norm(pu)));
        setWorldRot(W, hi, q.mul(q.axisAngle(ax, ang), W[hi].q));
      }
    }
  }
}
export const P = (W, n) => W[IDX[n]].p;
