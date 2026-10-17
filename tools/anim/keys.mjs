// Pose-to-pose keyframing on top of a fighter's stance. Each key is a partial spec; numbers are
// interpolated between keys with monotone cubic curves, then applied with IK each frame.
//
// spec fields (all optional; missing = stance):
//   pelvis: [dx, dy, dz]          pelvis offset from the stance (model units)
//   hipYaw / hipPitch / hipRoll:  degrees, turning the hips (feet stay planted unless moved)
//   lean / twist / side:          degrees spread over the spine (forward / about the spine / sideways)
//   L / R: hand target. {d: [dx,dy,dz]} = offset from the stance guard (moves with the chest),
//          {w: [x,y,z]} = absolute model-space point; elbow: [x,y,z] pole; aim: [x,y,z] fist direction
//   fL / fR: foot. {d: [dx,dy,dz]} offset from the stance foot, {w: [x,y,z]} absolute ankle point;
//          yaw (deg) for the toe, pitch (deg, + toe up)
//   look: [x,y,z] point to look at (default the stance gaze), headPitch: deg extra nod
//   fistL / fistR: 0..1 finger curl
//   spin: degrees about Z for the whole body (spins), rise: whole-body lift (jumps, z offset)
import { q, v3, DEG, clamp } from "./m3.mjs";
import { IDX } from "./rig.mjs";
import { clonePose, Clip, turn } from "./clip.mjs";
import { STANCES, buildStance } from "./stances.mjs";
import { movePelvis, rotatePelvis, bendSpine, twistSpine, lookAt, placeFoot, placeHand, BIND_ANKLE_Z, P } from "./pose.mjs";
import { setWorld } from "./rig.mjs";
import { monotoneSlopes, hermiteMap } from "./clip.mjs";

// flatten a spec into numeric channels: "pelvis.0", "L.d.1", ...
function flatten(spec, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(spec)) {
    const key = prefix ? prefix + "." + k : k;
    if (Array.isArray(v)) v.forEach((x, i) => { out[key + "." + i] = x; });
    else if (v && typeof v === "object") flatten(v, key, out);
    else if (typeof v === "number") out[key] = v;
  }
  return out;
}
function unflatten(flat) {
  const out = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let o = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i], nextIsIdx = /^\d+$/.test(parts[i + 1]);
      if (!(p in o)) o[p] = nextIsIdx ? [] : {};
      o = o[p];
    }
    o[parts[parts.length - 1]] = val;
  }
  return out;
}

// keys: [[frame, spec], ...]. Offsets missing from a key count as 0 there. Absolute targets
// ("w", "elbow", "aim", "look") keep the value of their own keys, and fade in and out through
// a weight channel ("ww") that is 1 at keys that give them and 0 at keys that don't.
export function sampleSpecs(keys, n) {
  const flats = keys.map(([f, s]) => {
    const fl = flatten(s);
    for (const g of ["L", "R", "fL", "fR"]) if (s[g] && s[g].w) fl[g + ".ww"] = 1;
    if (s.look) fl["lookw"] = 1;
    return [f, fl];
  });
  const chans = new Set();
  flats.forEach(([, fl]) => Object.keys(fl).forEach((c) => chans.add(c)));
  const frames = [];
  for (let f = 0; f < n; f++) frames.push({});
  for (const c of chans) {
    const isAbs = /(^|\.)(w|elbow|aim)\.\d+$/.test(c) || /^look\.\d+$/.test(c);
    const pts = [];
    for (const [f, fl] of flats) {
      if (c in fl) pts.push([f, fl[c]]);
      else if (!isAbs) pts.push([f, defaultOf(c)]);
    }
    if (!pts.length) continue;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const m = xs.length > 1 ? monotoneSlopes(xs, ys) : [0];
    for (let f = 0; f < n; f++) frames[f][c] = xs.length === 1 ? ys[0] : hermiteMap(xs, ys, m, clamp(f, xs[0], xs[xs.length - 1]));
  }
  return frames.map(unflatten);
}
function defaultOf(c) { return /fist/.test(c) ? 1 : 0; }

// build one frame of a keyed pose for fighter `id`
export function applySpec(base, S, spec) {
  const W = clonePose(base);
  const chest0 = { q: W[IDX.spine_3].q.slice(), p: W[IDX.spine_3].p.slice() };
  const feetW = { L: W[IDX.ankle_L].p.slice(), R: W[IDX.ankle_R].p.slice() };
  // whole-body moves (spins and lifts) are applied at the end
  if (spec.pelvis) movePelvis(W, spec.pelvis.map((x) => x || 0));
  if (spec.hipYaw) rotatePelvis(W, [0, 0, 1], spec.hipYaw * DEG);
  if (spec.hipPitch) rotatePelvis(W, [0, 1, 0], spec.hipPitch * DEG);
  if (spec.hipRoll) rotatePelvis(W, [1, 0, 0], spec.hipRoll * DEG);
  if (spec.lean) bendSpine(W, [0, 1, 0], spec.lean * DEG);
  if (spec.side) bendSpine(W, [1, 0, 0], spec.side * DEG);
  if (spec.twist) twistSpine(W, spec.twist * DEG);
  // feet
  for (const s of ["L", "R"]) {
    const fs = spec["f" + s];
    const st = s === "L" ? S.lead : S.rear;
    const def = [st.p[0], st.p[1], BIND_ANKLE_Z + (s === "R" && st.heel ? 1.6 : 0)];
    let target = def, yaw = st.yaw, pitch = s === "R" && st.heel ? -st.heel : 0;
    if (fs) {
      if (fs.w) target = v3.lerp(def, fs.w.map((x, i) => (x === undefined || x === null ? def[i] : x)), clamp(fs.ww ?? 1, 0, 1));
      if (fs.d) target = v3.add(target, fs.d.map((x) => x || 0));
      if (fs.yaw !== undefined) yaw = st.yaw + fs.yaw;
      if (fs.pitch !== undefined) pitch += fs.pitch;
    }
    placeFoot(W, s, target, yaw, { pitch });
  }
  // hands: stance guard carried by the chest's motion, plus offsets / absolute targets
  const chest1 = W[IDX.spine_3];
  const dq = q.mul(chest1.q, q.conj(chest0.q));
  for (const s of ["L", "R"]) {
    const hs = spec[s] || {};
    const guard = S.hands[s];
    const carried = v3.add(chest1.p, q.rotate(dq, v3.sub(guard, chest0.p)));
    let target = carried;
    if (hs.w) target = v3.lerp(carried, hs.w, clamp(hs.ww ?? 1, 0, 1));
    if (hs.d) target = v3.add(target, hs.d.map((x) => x || 0));
    const elbow0 = S.elbows[s];
    const elbow = hs.elbow ? hs.elbow : v3.add(chest1.p, q.rotate(dq, v3.sub(elbow0, chest0.p)));
    const aimDef = s === "L" ? v3.norm([1, -0.15, 0.55]) : v3.norm([1, 0.25, 0.75]);
    const aim = hs.aim ? v3.norm(hs.aim) : q.rotate(dq, aimDef);
    placeHand(W, s, target, { elbow, aim });
  }
  const look = spec.look ? v3.lerp(S.look, spec.look, clamp(spec.lookw ?? 1, 0, 1)) : S.look;
  lookAt(W, look, { roll: S.headRoll || 0 });
  if (spec.headPitch) setWorld(W, IDX.head_0, { q: q.mul(q.axisAngle(q.rotate(W[IDX.head_0].q, [0, 1, 0]), spec.headPitch * DEG), W[IDX.head_0].q), p: W[IDX.head_0].p });
  // whole body: spin about the ground point, lift
  let out = W;
  if (spec.spin) out = turn(out, spec.spin);
  if (spec.rise) out = out.map((t) => ({ q: t.q, p: [t.p[0], t.p[1], t.p[2] + spec.rise] }));
  if (spec.tumble) {
    // rotate the whole body about the pelvis around +Y (forward flip) by tumble degrees
    const c = out[IDX.pelvis].p;
    const r = q.axisAngle([0, 1, 0], spec.tumble * DEG);
    out = out.map((t) => ({ q: q.mul(r, t.q), p: v3.add(c, q.rotate(r, v3.sub(t.p, c))) }));
  }
  return out;
}

export function keyedClip(id, name, keys, { n = null, loop = false, base = null } = {}) {
  const S = STANCES[id];
  const B = base || buildStance(id);
  const len = n || keys[keys.length - 1][0] + 1;
  const specs = sampleSpecs(keys, len);
  const poses = specs.map((sp) => applySpec(B, S, sp));
  const c = new Clip(name, poses, { loop });
  c.fist = (f) => ({ L: specs[f].fistL ?? S.fist, R: specs[f].fistR ?? S.fist });
  return c;
}
