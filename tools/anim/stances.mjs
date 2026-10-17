// Fighting stances and idle loops for the four fighters, built on a motion-capture guard and
// shaped with IK. Model space: the fighter faces +X, +Y is their left (away from the fight
// camera), +Z up, origin = ground point between the feet.
import { q, v3, DEG } from "./m3.mjs";
import { IDX } from "./rig.mjs";
import { mocapPose, clonePose, Clip, turn } from "./clip.mjs";
import { normalisePoses } from "./gallery.mjs";
import { movePelvis, rotatePelvis, bendSpine, twistSpine, lookAt, placeFoot, placeHand, BIND_ANKLE_Z, P } from "./pose.mjs";

// cheat: the whole body turns this far toward the camera (deg, negative = toward -Y)
export const STANCES = {
  timber: {   // street boxer: bladed, chin down, high guard, light on the balls of the feet
    base: ["13_17", 36.0], cheat: -16,
    pelvis: [0.5, 0.5, 37.6], hipYaw: -24, lean: 9, twist: -8, side: 0,
    lead: { p: [11.5, 5.2], yaw: 12 }, rear: { p: [-12.5, -5.8], yaw: -42, heel: 9 },
    hands: { L: [16.5, 3.5, 61.5], R: [8.5, -3.2, 63.5] }, elbows: { L: [6, 15, 44], R: [-2, -15, 46] },
    look: [90, 2, 63], fist: 1,
    idle: { frames: 48, bounce: 1.35, shift: 0.7, sway: 2.2, fists: 1.2, breathe: 0.6 },
  },
  brass: {    // riot heavy: wide, low, square, forearms up like a shield, flat-footed
    base: ["13_17", 36.0], cheat: -20,
    pelvis: [0, 0, 36.2], hipYaw: -14, lean: 6, twist: -4, side: 0,
    lead: { p: [10.5, 7.4], yaw: 18 }, rear: { p: [-11.0, -8.0], yaw: -30, heel: 0 },
    hands: { L: [15.0, 5.0, 58.5], R: [12.0, -5.5, 58.0] }, elbows: { L: [6, 18, 40], R: [4, -18, 40] },
    look: [90, 0, 62], fist: 1,
    idle: { frames: 80, bounce: 0.55, shift: 0.9, sway: 1.2, fists: 0.6, breathe: 1.0 },
  },
  pirouette: { // dancer-agent: tall, narrow, on the toes, hands loose and open, poised
    base: ["13_17", 36.0], cheat: -22,
    pelvis: [0.5, 0.2, 39.6], hipYaw: -30, lean: 3, twist: -12, side: 0,
    lead: { p: [9.0, 3.6], yaw: 8 }, rear: { p: [-10.5, -4.2], yaw: -55, heel: 12 },
    hands: { L: [17.5, 4.0, 57.0], R: [7.0, -6.5, 54.0] }, elbows: { L: [8, 16, 42], R: [-4, -16, 40] },
    look: [90, 0, 64], fist: 0.45,
    idle: { frames: 60, bounce: 0.9, shift: 0.5, sway: 3.0, fists: 1.6, breathe: 0.7 },
  },
  motley: {   // masked trickster: low, loose, swaying, hands low and wide, head cocked
    base: ["13_17", 36.0], cheat: -20,
    pelvis: [-0.5, 0, 36.6], hipYaw: -20, lean: 12, twist: -6, side: 0,
    lead: { p: [12.0, 6.5], yaw: 20 }, rear: { p: [-12.0, -7.0], yaw: -38, heel: 6 },
    hands: { L: [16.0, 9.0, 52.0], R: [6.0, -10.0, 50.0] }, elbows: { L: [6, 20, 40], R: [-4, -20, 38] },
    look: [90, 0, 60], fist: 0.7, headRoll: 9,
    idle: { frames: 64, bounce: 1.1, shift: 1.2, sway: 4.0, fists: 2.4, breathe: 0.6 },
  },
};

// the stance pose (no idle motion), facing +X before the camera cheat is applied
export function buildStance(id, mods = {}) {
  const S = { ...STANCES[id], ...mods };
  let W = normalisePoses([mocapPose(S.base[0], S.base[1])], 0, "gaze")[0];
  W = clonePose(W);
  // hips: square to the opponent first, then turned for the stance
  const pel = W[IDX.pelvis];
  movePelvis(W, v3.sub(S.pelvis, pel.p), { keepFeet: false });
  // remove the mocap's own hip yaw/tilt: align the hip line with +Y, then apply ours
  const hipL = v3.sub(P(W, "leg_upper_L"), P(W, "leg_upper_R"));
  const yaw0 = Math.atan2(-hipL[0], hipL[1]);
  rotatePelvis(W, [0, 0, 1], -yaw0 + S.hipYaw * DEG, { keepFeet: false });
  // spine: straighten to vertical-ish, then lean forward and twist
  const sp = v3.norm(v3.sub(P(W, "neck_0"), P(W, "pelvis")));
  const fix = q.between(sp, [0, 0, 1]);
  const ax = v3.len([fix[0], fix[1], fix[2]]) > 1e-6 ? v3.norm([fix[0], fix[1], fix[2]]) : [0, 1, 0];
  bendSpine(W, ax, q.angle(fix), [0.25, 0.25, 0.25, 0.25]);
  twistSpine(W, (-S.hipYaw * 0.55 + S.twist) * DEG);   // chest turns back toward the front
  bendSpine(W, [0, 1, 0], S.lean * DEG);
  // feet
  placeFoot(W, "L", [S.lead.p[0], S.lead.p[1], BIND_ANKLE_Z], S.lead.yaw);
  placeFoot(W, "R", [S.rear.p[0], S.rear.p[1], BIND_ANKLE_Z + (S.rear.heel ? 1.6 : 0)], S.rear.yaw, { pitch: -(S.rear.heel || 0) });
  // hands
  placeHand(W, "L", S.hands.L, { elbow: S.elbows.L, aim: v3.norm([1, -0.15, 0.55]) });
  placeHand(W, "R", S.hands.R, { elbow: S.elbows.R, aim: v3.norm([1, 0.25, 0.75]) });
  lookAt(W, S.look, { roll: S.headRoll || 0 });
  return W;
}

// world pose with the camera cheat applied
export const cheat = (id, W) => turn(W, STANCES[id].cheat);

// Idle loop: the stance with a bounce, weight shift, lagging chest and fists, steady eyes.
export function buildIdle(id, { name = id + "_idle" } = {}) {
  const S = STANCES[id], I = S.idle, n = I.frames;
  const base = buildStance(id);
  const poses = [];
  for (let f = 0; f < n; f++) {
    const w = (f / n) * Math.PI * 2;
    const W = clonePose(base);
    const dz = -I.bounce * (0.5 + 0.5 * Math.sin(w));
    const dx = I.shift * Math.sin(w + 0.5);
    movePelvis(W, [dx, 0, dz]);
    rotatePelvis(W, [0, 0, 1], I.sway * 0.35 * DEG * Math.sin(w + 0.9));
    bendSpine(W, [0, 1, 0], I.sway * DEG * Math.sin(w - 0.7));
    twistSpine(W, I.sway * 0.4 * DEG * Math.sin(w - 1.1));
    // fists ride with the chest, a beat late, in small loops
    const chestDz = dz * 0.8;
    for (const s of ["L", "R"]) {
      const h = S.hands[s];
      const ph = s === "L" ? 0 : 0.9;
      const off = [I.fists * 0.45 * Math.cos(w - 1.2 + ph) + dx * 0.6, 0, chestDz + I.fists * 0.6 * Math.sin(w - 1.2 + ph)];
      placeHand(W, s, v3.add(h, off), { elbow: S.elbows[s], aim: s === "L" ? v3.norm([1, -0.15, 0.55]) : v3.norm([1, 0.25, 0.75]) });
    }
    lookAt(W, v3.add(S.look, [0, 0, dz * 0.5]), { roll: S.headRoll || 0 });
    poses.push(W);
  }
  const c = new Clip(name, poses, { loop: true });
  c.fist = { L: S.fist, R: S.fist };
  return c;
}

// Walk cycles: stance footwork. The game moves the fighter at `speed` (model units/s), so in the
// clip the planted feet slide back at that speed and the stepping foot swings forward.
// dir = 1: lead foot steps first (advance); dir = -1: rear foot steps back first (retreat).
export const WALK = {
  timber: { step: 22, lift: 1.6, bob: 0.9, lean: 3 },
  brass: { step: 21, lift: 0.9, bob: 1.3, lean: 2 },
  pirouette: { step: 25, lift: 2.2, bob: 0.6, lean: 1.5 },
  motley: { step: 23, lift: 2.0, bob: 1.4, lean: 4 },
};
export function buildWalk(id, dir, speedFU, { name = `${id}_walk${dir > 0 ? "f" : "b"}`, fuToModel = 0.72 } = {}) {
  const S = STANCES[id], K = WALK[id];
  const v = speedFU * fuToModel / 64;               // model units per frame
  const n = Math.max(12, Math.round(K.step / v));   // one step of each foot per cycle
  const base = buildStance(id);
  const D = v * n;                                  // distance per cycle (model units)
  const first = dir > 0 ? "L" : "R";               // the foot that leads the step
  const feet0 = { L: [S.lead.p[0], S.lead.p[1]], R: [S.rear.p[0], S.rear.p[1]] };
  const yaw = { L: S.lead.yaw, R: S.rear.yaw };
  const poses = [];
  for (let f = 0; f < n; f++) {
    const u = f / n;
    const W = clonePose(base);
    // pelvis: dips as weight lands, leans into the walk
    const bob = -K.bob * (0.5 - 0.5 * Math.cos(u * Math.PI * 4));
    movePelvis(W, [dir * 0.6 * Math.sin(u * Math.PI * 2), 0, bob], { keepFeet: false });
    bendSpine(W, [0, 1, 0], dir * K.lean * DEG);
    for (const s of ["L", "R"]) {
      // swing windows: first foot 0.02..0.42, second 0.52..0.92
      const [a, b] = s === first ? [0.02, 0.42] : [0.52, 0.92];
      const sw = u < a ? 0 : u > b ? 1 : smoothstep((u - a) / (b - a));
      const lift = u > a && u < b ? Math.sin(((u - a) / (b - a)) * Math.PI) * K.lift : 0;
      // feet stay planted in the world: in clip space they drift back by D*u; the swing returns them
      const x = feet0[s][0] + dir * D * (sw - u) + (s === first ? 0 : 0);
      const toeUp = u > a && u < b ? 6 * Math.sin(((u - a) / (b - a)) * Math.PI) : 0;
      placeFoot(W, s, [x, feet0[s][1], BIND_ANKLE_Z + lift + (s === "R" && S.rear.heel ? 1.6 : 0)], yaw[s], { pitch: s === "R" && S.rear.heel ? -S.rear.heel : toeUp * 0.5 });
    }
    // guard rides along, a touch tighter walking back
    const tight = dir < 0 ? 0.8 : 1;
    for (const s of ["L", "R"]) {
      const h = S.hands[s];
      const off = [dir * 0.8 * Math.sin(u * Math.PI * 2 + (s === "L" ? 0 : Math.PI)), 0, bob * 0.7];
      placeHand(W, s, v3.add([h[0] * tight + (1 - tight) * 6, h[1], h[2] + (dir < 0 ? 1.5 : 0)], off), { elbow: S.elbows[s], aim: s === "L" ? v3.norm([1, -0.15, 0.55]) : v3.norm([1, 0.25, 0.75]) });
    }
    lookAt(W, S.look, { roll: S.headRoll || 0 });
    poses.push(W);
  }
  const c = new Clip(name, poses, { loop: true });
  c.fist = { L: S.fist, R: S.fist };
  c.speed = speedFU;
  return c;
}
const smoothstep = (t) => t * t * (3 - 2 * t);
