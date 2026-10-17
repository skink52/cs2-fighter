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
    air: { pelvis: [0, 0, 31], hipYaw: -16, lean: 6, twist: -4, lead: { p: [9, 5], z: 11, yaw: 20, pitch: -25, knee: [40, 10, 44] }, rear: { p: [-6, -5], z: 7, yaw: -10, pitch: -45, knee: [30, -8, 34] },
      hands: { L: [15.0, 5.0, 58.0], R: [8.0, -4.0, 60.0] }, elbows: { L: [6, 16, 42], R: [-2, -16, 44] }, look: [90, 2, 58] },
    crouch: { pelvis: [2.0, 0.5, 19.0], hipYaw: -18, lean: 38, twist: -6, lead: { p: [13.5, 6.0], yaw: 14 }, rear: { p: [-12.0, -6.5], yaw: -38, heel: 22 },
      hands: { L: [19.0, 4.0, 40.5], R: [13.5, -3.0, 42.0] }, elbows: { L: [10, 15, 27], R: [4, -15, 28] }, look: [80, 2, 38] },
  },
  brass: {    // riot heavy: wide, low, square, forearms up like a shield, flat-footed
    base: ["13_17", 36.0], cheat: -20,
    pelvis: [0, 0, 36.2], hipYaw: -14, lean: 6, twist: -4, side: 0,
    lead: { p: [10.5, 7.4], yaw: 18 }, rear: { p: [-11.0, -8.0], yaw: -30, heel: 0 },
    hands: { L: [15.0, 5.0, 58.5], R: [12.0, -5.5, 58.0] }, elbows: { L: [6, 18, 40], R: [4, -18, 40] },
    look: [90, 0, 62], fist: 1,
    idle: { frames: 80, bounce: 0.55, shift: 0.9, sway: 1.2, fists: 0.6, breathe: 1.0 },
    air: { pelvis: [0, 0, 31], hipYaw: -10, lean: 5, twist: -2, lead: { p: [8, 7], z: 10, yaw: 20, pitch: -20, knee: [40, 12, 42] }, rear: { p: [-6, -7], z: 7, yaw: -10, pitch: -40, knee: [30, -10, 32] },
      hands: { L: [14.0, 6.0, 56.0], R: [11.0, -6.0, 55.5] }, elbows: { L: [6, 18, 40], R: [4, -18, 40] }, look: [90, 0, 57] },
    crouch: { pelvis: [1.0, 0, 18.5], hipYaw: -12, lean: 34, twist: -3, lead: { p: [12.5, 8.4], yaw: 18 }, rear: { p: [-11.5, -8.6], yaw: -28, heel: 18 },
      hands: { L: [18.0, 5.5, 39.5], R: [15.0, -5.0, 39.0] }, elbows: { L: [10, 18, 25], R: [8, -18, 25] }, look: [80, 0, 37] },
  },
  pirouette: { // dancer-agent: tall, narrow, on the toes, hands loose and open, poised
    base: ["13_17", 36.0], cheat: -22,
    pelvis: [0.5, 0.2, 39.6], hipYaw: -30, lean: 3, twist: -12, side: 0,
    lead: { p: [9.0, 3.6], yaw: 8 }, rear: { p: [-10.5, -4.2], yaw: -55, heel: 12 },
    hands: { L: [17.5, 4.0, 57.0], R: [7.0, -6.5, 54.0] }, elbows: { L: [8, 16, 42], R: [-4, -16, 40] },
    look: [90, 0, 64], fist: 0.45,
    idle: { frames: 60, bounce: 0.9, shift: 0.5, sway: 3.0, fists: 1.6, breathe: 0.7 },
    air: { pelvis: [0, 0, 32], hipYaw: -20, lean: 2, twist: -8, lead: { p: [10, 4], z: 12, yaw: 15, pitch: -35, knee: [40, 8, 46] }, rear: { p: [-7, -4], z: 7, yaw: -20, pitch: -55, knee: [30, -6, 34] },
      hands: { L: [16.0, 5.0, 56.0], R: [6.0, -7.0, 53.0] }, elbows: { L: [8, 16, 42], R: [-4, -16, 40] }, look: [90, 0, 59] },
    crouch: { pelvis: [1.5, 0.2, 19.5], hipYaw: -26, lean: 36, twist: -10, lead: { p: [12.0, 4.2], yaw: 10 }, rear: { p: [-11.5, -4.8], yaw: -52, heel: 26 },
      hands: { L: [20.0, 4.5, 39.0], R: [11.0, -6.0, 36.5] }, elbows: { L: [11, 16, 27], R: [0, -16, 25] }, look: [80, 0, 38] },
  },
  motley: {   // masked trickster: low, loose, swaying, hands low and wide, head cocked
    base: ["13_17", 36.0], cheat: -20,
    pelvis: [-0.5, 0, 36.6], hipYaw: -20, lean: 12, twist: -6, side: 0,
    lead: { p: [12.0, 6.5], yaw: 20 }, rear: { p: [-12.0, -7.0], yaw: -38, heel: 6 },
    hands: { L: [16.0, 9.0, 52.0], R: [6.0, -10.0, 50.0] }, elbows: { L: [6, 20, 40], R: [-4, -20, 38] },
    look: [90, 0, 60], fist: 0.7, headRoll: 9,
    idle: { frames: 64, bounce: 1.1, shift: 1.2, sway: 4.0, fists: 2.4, breathe: 0.6 },
    air: { pelvis: [0, 0, 30], hipYaw: -14, lean: 9, twist: -4, lead: { p: [9, 6], z: 11, yaw: 25, pitch: -25, knee: [40, 12, 42] }, rear: { p: [-6, -6], z: 7, yaw: -15, pitch: -45, knee: [30, -10, 32] },
      hands: { L: [15.0, 9.0, 51.0], R: [6.0, -10.0, 49.0] }, elbows: { L: [6, 20, 38], R: [-4, -20, 36] }, look: [90, 0, 56] },
    crouch: { pelvis: [1.0, 0, 18.5], hipYaw: -18, lean: 38, twist: -5, lead: { p: [13.5, 7.5], yaw: 22 }, rear: { p: [-12.5, -7.5], yaw: -36, heel: 20 },
      hands: { L: [18.5, 9.0, 35.0], R: [10.0, -9.5, 34.0] }, elbows: { L: [10, 20, 23], R: [0, -20, 22] }, look: [80, 0, 36] },
  },
};

// where a stance puts each ankle, and the foot's pitch (a raised heel stands on the ball)
export function footHome(S, s) {
  const st = s === "L" ? S.lead : S.rear;
  // a raised heel pivots the foot on its ball, which lifts the ankle
  const a = (st.heel || 0) * DEG;
  return [st.p[0], st.p[1], st.z ?? (a ? 1.29 + 5.4 * Math.sin(a) + 3.04 * Math.cos(a) : BIND_ANKLE_Z)];
}
export function footPitch(S, s) {
  const st = s === "L" ? S.lead : S.rear;
  return st.pitch ?? -(st.heel || 0);
}

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
  placeFoot(W, "L", footHome(S, "L"), S.lead.yaw, { pitch: footPitch(S, "L"), pole: S.lead.knee || null });
  placeFoot(W, "R", footHome(S, "R"), S.rear.yaw, { pitch: footPitch(S, "R"), pole: S.rear.knee || null });
  // hands
  placeHand(W, "L", S.hands.L, { elbow: S.elbows.L, aim: v3.norm([1, -0.15, 0.55]) });
  placeHand(W, "R", S.hands.R, { elbow: S.elbows.R, aim: v3.norm([1, 0.25, 0.75]) });
  lookAt(W, S.look, { roll: S.headRoll || 0 });
  return W;
}

// the crouching guard: the stance with the crouch overrides
export function crouchStance(id) { const S = STANCES[id]; return { ...S, ...S.crouch, fist: S.fist, headRoll: S.headRoll, cheat: S.cheat }; }
export function buildCrouch(id) { return buildStance(id, STANCES[id].crouch); }
export function airStance(id) { const S = STANCES[id]; return { ...S, ...S.air, fist: S.fist, headRoll: S.headRoll, cheat: S.cheat }; }
export function buildAir(id) { return buildStance(id, STANCES[id].air); }

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

// Walk cycles. The game moves the fighter at its walking speed, so in the clip a planted foot
// slides back at that speed while the other swings forward past it (a real walk: each foot
// passes the other once per cycle, and the cycle ends back in the stance). The hips swing with
// the stepping leg, the shoulders hold square, the guard rides along. Walking back keeps the
// forearms up (holding back blocks).
export const WALK = {
  timber: { lift: 3.0, bob: 1.3, lean: 3, hip: 9, sway: 0.7 },
  brass: { lift: 2.2, bob: 1.8, lean: 2, hip: 6, sway: 1.1 },
  pirouette: { lift: 3.6, bob: 0.9, lean: 1.5, hip: 11, sway: 0.5 },
  motley: { lift: 3.4, bob: 1.8, lean: 4, hip: 10, sway: 1.2 },
};
export function buildWalk(id, dir, speedFU, { name = `${id}_walk${dir > 0 ? "f" : "b"}`, fuToModel = 0.72 } = {}) {
  const S = STANCES[id], K = WALK[id];
  const v = speedFU * fuToModel / 64;               // model units per frame
  const gap = S.lead.p[0] - S.rear.p[0];
  const D = 2 * gap;                                // cycle length: each foot moves two stance gaps
  const n = Math.max(16, Math.round(D / v));
  const base = buildStance(id);
  const first = dir > 0 ? "R" : "L";               // the back foot steps through first
  const feet0 = { L: [S.lead.p[0], S.lead.p[1]], R: [S.rear.p[0], S.rear.p[1]] };
  const yaw = { L: S.lead.yaw * 0.5, R: S.rear.yaw * 0.45 };
  const poses = [];
  for (let f = 0; f < n; f++) {
    const u = f / n;
    const W = clonePose(base);
    // pelvis: low at each foot-strike, high as the legs pass; drifts over the planted foot
    const bob = -K.bob * (0.5 + 0.5 * Math.cos(u * Math.PI * 4));
    const plantedL = (first === "R") === (u < 0.5);
    movePelvis(W, [0, (plantedL ? 1 : -1) * K.sway * Math.sin(u * Math.PI * 2) * (first === "R" ? 1 : -1), bob], { keepFeet: false });
    const hipSwing = K.hip * Math.sin(u * Math.PI * 2) * dir * (first === "R" ? 1 : -1);
    rotatePelvis(W, [0, 0, 1], hipSwing * DEG, { keepFeet: false });
    twistSpine(W, -hipSwing * 0.7 * DEG);
    bendSpine(W, [0, 1, 0], dir * K.lean * DEG);
    for (const s of ["L", "R"]) {
      const [a, b] = s === first ? [0.02, 0.48] : [0.52, 0.98];
      const t = clamp01((u - a) / (b - a));
      const sw = u < a ? 0 : u > b ? 1 : smoothstep(t);
      const swinging = u > a && u < b;
      const lift = swinging ? Math.sin(t * Math.PI) * K.lift : 0;
      const x = feet0[s][0] + dir * D * (sw - u);
      const toe = swinging ? 10 * Math.sin(t * Math.PI) * (dir > 0 ? 1 : -0.6) : 0;
      const heelOff = s === "R" && S.rear.heel ? footHome(S, "R")[2] - BIND_ANKLE_Z : 0;
      placeFoot(W, s, [x, feet0[s][1], BIND_ANKLE_Z + lift + heelOff * (swinging ? 0.3 : 0.6)], yaw[s], { pitch: toe + (s === "R" && S.rear.heel ? -S.rear.heel * 0.6 : 0) });
    }
    // the guard rides with the chest; walking back the forearms come up in front of the face
    for (const s of ["L", "R"]) {
      const h = S.hands[s];
      const bobH = bob * 0.6 + 0.4 * Math.sin(u * Math.PI * 4 + (s === "L" ? 0 : 1));
      if (dir > 0) {
        placeHand(W, s, v3.add(h, [0.6 * Math.sin(u * Math.PI * 2 + (s === "L" ? 0 : Math.PI)), 0, bobH]), { elbow: S.elbows[s], aim: s === "L" ? v3.norm([1, -0.15, 0.55]) : v3.norm([1, 0.25, 0.75]) });
      } else {
        const hz = S.hands.L[2] + 1.5;
        const tgt = s === "L" ? [13.5, 4.0, hz] : [12.5, -2.0, hz + 0.5];
        placeHand(W, s, v3.add(tgt, [0, 0, bobH]), { elbow: s === "L" ? [11, 11, hz - 18] : [9, -9, hz - 18], aim: s === "L" ? v3.norm([0.25, -0.2, 1]) : v3.norm([0.25, 0.2, 1]) });
      }
    }
    lookAt(W, S.look, { roll: S.headRoll || 0 });
    poses.push(W);
  }
  const c = new Clip(name, poses, { loop: true });
  c.fist = { L: S.fist, R: S.fist };
  c.speed = speedFU;
  return c;
}
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smoothstep = (t) => t * t * (3 - 2 * t);
