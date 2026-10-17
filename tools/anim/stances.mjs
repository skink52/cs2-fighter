// Fighting stances and idle loops for the four fighters, built on a motion-capture guard and
// shaped with IK. Model space: the fighter faces +X, +Y is their left (away from the fight
// camera), +Z up, origin = ground point between the feet.
import { q, v3, DEG } from "./m3.mjs";
import { IDX } from "./rig.mjs";
import { clonePose, Clip, turn } from "./clip.mjs";
import { movePelvis, rotatePelvis, bendSpine, twistSpine, lookAt, placeFoot, BIND_ANKLE_Z, P } from "./pose.mjs";
import { posture, setHand } from "./posture.mjs";

// Stances are built straight from the bind pose with posture.mjs: the hips open toward the
// camera (negative yaw) so the chest, both arms and both legs read from the side view, the lead
// foot points down the fight line and the rear foot turns out. Fields:
//   pelvis [x, y, z], hipYaw / hipPitch / hipRoll (deg, the pelvis), twist / lean / side (deg, the
//   chest relative to the pelvis), lead / rear feet { p: [x, y], yaw, heel }, hands / elbows /
//   palms { L, R }, look, headRoll, fist (0 relaxed .. 1 fist). crouch and air override fields.
export const STANCES = {
  timber: {   // street boxer: bladed, chin down, high guard, light on the balls of the feet
    cheat: 0,
    pelvis: [0, -1, 35], hipYaw: -50, hipPitch: 6, lean: 12, twist: 16, side: 0,
    lead: { p: [17, 6], yaw: 5 }, rear: { p: [-16, -9], yaw: -60, heel: 14 },
    hands: { L: [23, 3, 55], R: [15, -5, 57] }, elbows: { L: [10, 14, 32], R: [2, -18, 34] },
    palms: { L: [0, -0.6, -0.8], R: [-0.1, 0.9, -0.3] },
    look: [100, 0, 61], fist: 1,
    idle: { frames: 48, bounce: 1.3, shift: 0.7, sway: 2.0, fists: 1.2, breathe: 0.6 },
    air: { pelvis: [0, 0, 31], hipYaw: -40, hipPitch: 0, lean: 8, twist: 10, lead: { p: [10, 5], z: 13, yaw: 15, pitch: -25, knee: [40, 10, 44] }, rear: { p: [-7, -6], z: 9, yaw: -30, pitch: -45, knee: [30, -8, 34] },
      hands: { L: [20, 4, 54], R: [13, -6, 56] }, elbows: { L: [8, 14, 34], R: [1, -18, 36] }, look: [100, 0, 58] },
    crouch: { pelvis: [2, -1, 21], hipYaw: -45, hipPitch: 16, lean: 24, twist: 12, lead: { p: [19, 7], yaw: 8 }, rear: { p: [-15, -10], yaw: -55, heel: 28 },
      hands: { L: [24, 3, 39], R: [17, -6, 41] }, elbows: { L: [13, 12, 26], R: [6, -16, 27] }, look: [100, 0, 38] },
  },
  brass: {    // riot heavy: wide, low, square, forearms up like a shield, flat-footed
    cheat: 0,
    pelvis: [0, -1, 34], hipYaw: -38, hipPitch: 5, lean: 10, twist: 8, side: 0,
    lead: { p: [16, 9], yaw: 15 }, rear: { p: [-15, -11], yaw: -45, heel: 0 },
    hands: { L: [20, 5, 56], R: [18, -7, 53] }, elbows: { L: [14, 16, 36], R: [10, -18, 33] },
    palms: { L: [-0.3, -0.9, 0], R: [-0.3, 0.9, 0] },
    look: [100, 0, 61], fist: 1,
    idle: { frames: 80, bounce: 0.55, shift: 0.9, sway: 1.2, fists: 0.6, breathe: 1.0 },
    air: { pelvis: [0, 0, 31], hipYaw: -30, lean: 6, twist: 4, lead: { p: [9, 8], z: 12, yaw: 20, pitch: -20, knee: [40, 12, 42] }, rear: { p: [-7, -8], z: 9, yaw: -20, pitch: -40, knee: [30, -10, 32] },
      hands: { L: [18, 6, 55], R: [16, -7, 52] }, elbows: { L: [12, 16, 36], R: [9, -18, 33] }, look: [100, 0, 57] },
    crouch: { pelvis: [2, -1, 20.5], hipYaw: -34, hipPitch: 14, lean: 22, twist: 6, lead: { p: [18, 10], yaw: 15 }, rear: { p: [-15, -12], yaw: -40, heel: 20 },
      hands: { L: [22, 5, 40], R: [20, -7, 37] }, elbows: { L: [15, 16, 25], R: [12, -17, 23] }, look: [100, 0, 37] },
  },
  pirouette: { // dancer-agent: tall, narrow, on the toes, hands loose and open, poised
    cheat: 0,
    pelvis: [1, -1, 39], hipYaw: -42, hipPitch: 0, lean: 3, twist: 10, side: 0,
    lead: { p: [14, 4], yaw: 10, heel: 18 }, rear: { p: [-13, -6], yaw: -65, heel: 22 },
    hands: { L: [25, 6, 54], R: [8, -12, 48] }, elbows: { L: [14, 18, 44], R: [-4, -20, 40] },
    palms: { L: [0, -0.3, -0.9], R: [0.2, 0.4, -0.9] },
    look: [100, 0, 64], fist: 0.3,
    idle: { frames: 60, bounce: 0.9, shift: 0.5, sway: 3.0, fists: 1.6, breathe: 0.7 },
    air: { pelvis: [0, 0, 32], hipYaw: -30, lean: 2, twist: 8, lead: { p: [11, 4], z: 14, yaw: 15, pitch: -35, knee: [40, 8, 46] }, rear: { p: [-8, -5], z: 9, yaw: -30, pitch: -55, knee: [30, -6, 34] },
      hands: { L: [22, 7, 54], R: [6, -13, 50] }, elbows: { L: [12, 18, 44], R: [-5, -20, 42] }, look: [100, 0, 59] },
    crouch: { pelvis: [2, -1, 22], hipYaw: -40, hipPitch: 12, lean: 24, twist: 10, lead: { p: [17, 5], yaw: 10 }, rear: { p: [-13, -8], yaw: -60, heel: 30 },
      hands: { L: [26, 6, 39], R: [12, -11, 34] }, elbows: { L: [16, 17, 28], R: [1, -19, 26] }, look: [100, 0, 39] },
  },
  motley: {   // masked trickster: low, loose, swaying, hands low and wide, head cocked
    cheat: 0,
    pelvis: [0, -1, 33], hipYaw: -45, hipPitch: 10, hipRoll: 4, lean: 16, twist: 14, side: -6,
    lead: { p: [17, 8], yaw: 20 }, rear: { p: [-15, -10], yaw: -50, heel: 10 },
    hands: { L: [24, 10, 46], R: [12, -14, 42] }, elbows: { L: [12, 22, 36], R: [0, -24, 36] },
    palms: { L: [0.2, -0.4, -0.9], R: [0.3, 0.3, -0.9] },
    look: [100, 0, 58], fist: 0.55, headRoll: 9,
    idle: { frames: 64, bounce: 1.1, shift: 1.2, sway: 4.0, fists: 2.4, breathe: 0.6 },
    air: { pelvis: [0, 0, 30], hipYaw: -35, lean: 10, twist: 8, lead: { p: [10, 7], z: 12, yaw: 25, pitch: -25, knee: [40, 12, 42] }, rear: { p: [-7, -8], z: 9, yaw: -25, pitch: -45, knee: [30, -10, 32] },
      hands: { L: [21, 10, 47], R: [10, -14, 44] }, elbows: { L: [10, 22, 37], R: [-1, -24, 37] }, look: [100, 0, 55] },
    crouch: { pelvis: [2, -1, 20], hipYaw: -42, hipPitch: 16, hipRoll: 3, lean: 22, twist: 12, side: -4, lead: { p: [19, 9], yaw: 22 }, rear: { p: [-15, -11], yaw: -48, heel: 24 },
      hands: { L: [26, 10, 33], R: [14, -14, 30] }, elbows: { L: [15, 21, 25], R: [3, -23, 24] }, look: [100, 0, 36] },
  },
};

// where a stance puts each ankle, and the foot's pitch (a raised heel stands on the ball)
export function footHome(S, s) {
  const st = s === "L" ? S.lead : S.rear;
  const a = (st.heel || 0) * DEG;
  return [st.p[0], st.p[1], st.z ?? (a ? 1.29 + 5.4 * Math.sin(a) + 3.04 * Math.cos(a) : BIND_ANKLE_Z)];
}
export function footPitch(S, s) {
  const st = s === "L" ? S.lead : S.rear;
  return st.pitch ?? -(st.heel || 0);
}

// the posture spec of a stance (with optional overrides)
export function stanceSpec(S) {
  const foot = (st) => ({ p: st.p, z: st.z, yaw: st.yaw || 0, heel: st.heel || 0, pitch: st.pitch, knee: st.knee || null });
  return {
    pelvis: { p: S.pelvis, yaw: S.hipYaw || 0, pitch: S.hipPitch || 0, roll: S.hipRoll || 0 },
    chest: { yaw: S.twist || 0, pitch: S.lean || 0, side: S.side || 0 },
    feet: { L: foot(S.lead), R: foot(S.rear) },
    hands: { L: { p: S.hands.L, elbow: S.elbows.L, palm: (S.palms || {}).L }, R: { p: S.hands.R, elbow: S.elbows.R, palm: (S.palms || {}).R } },
    look: S.look, headRoll: S.headRoll || 0,
  };
}
// the stance pose (no idle motion), facing +X, already open to the camera
export function buildStance(id, mods = {}) {
  const S = { ...STANCES[id], ...mods };
  return posture(stanceSpec(S));
}

// the crouching guard: the stance with the crouch overrides
export function crouchStance(id) { const S = STANCES[id]; return { ...S, ...S.crouch, fist: S.fist, headRoll: S.headRoll, cheat: S.cheat, palms: S.palms }; }
export function buildCrouch(id) { return posture(stanceSpec(crouchStance(id))); }
export function airStance(id) { const S = STANCES[id]; return { ...S, ...S.air, fist: S.fist, headRoll: S.headRoll, cheat: S.cheat, palms: S.palms }; }
export function buildAir(id) { return posture(stanceSpec(airStance(id))); }

// world pose with the camera cheat applied (the stances are built open, so this is 0 now)
export const cheat = (id, W) => (STANCES[id].cheat ? turn(W, STANCES[id].cheat) : W);

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
      setHand(W, s, v3.add(h, off), { elbow: S.elbows[s], palm: S.palms[s] });
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
        setHand(W, s, v3.add(h, [0.6 * Math.sin(u * Math.PI * 2 + (s === "L" ? 0 : Math.PI)), 0, bobH]), { elbow: S.elbows[s], palm: S.palms[s] });
      } else {
        // walking back the guard closes up: both fists come in toward the chin
        const g = S.hands[s];
        const tgt = s === "L" ? [g[0] - 5, g[1] - 1, g[2] + 3] : [g[0] - 1, g[1] + 1, g[2] + 2];
        setHand(W, s, v3.add(tgt, [0, 0, bobH]), { elbow: S.elbows[s], palm: S.palms[s] });
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
