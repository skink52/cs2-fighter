// Which CMU cut each move uses (keys are [base frame, take frame at 120 Hz]; base frames are the
// move's own frame data, stretched by a fighter's frame multiplier). Per-fighter entries override
// the shared one.
import { STANCES, buildStance, buildCrouch } from "./stances.mjs";
import { Clip } from "./clip.mjs";
import { mocapPoses } from "./mocap_move.mjs";

const SHARED = {
  // lead-leg snap kick: an in-place front kick; the rear foot skips up under the hips and back
  kickMid: { take: "144_09", tip: "fT", support: "R", place: "pelvis", pelvisDx: -5,
    keys: [[0, 1384], [4, 1414], [7, 1436], [10, 1452], [25, 1530]], aim: 1436, keep: { armL: 0.45, armR: 0.45 }, steer: [{ from: 7, to: 10, z: 38, ease: 4 }] },
  // lead-leg side kick (the game slides the fighter forward through it)
  longKick: { take: "135_11", mirror: true, tip: "fT", support: "R", place: "pelvis", pelvisDx: -8,
    keys: [[0, 300], [6, 326], [10, 348], [13, 356], [30, 440]], aim: 348, keep: { armL: 0.2, armR: 0.35 }, steer: [{ from: 9, to: 13, z: 41, x: 38, ease: 5 }] },
  // rear-leg high kick, turning over on the planted lead foot
  roundhouse: { take: "144_05", tip: "bT", support: "L", place: "support", lock: true, supportDx: -7,
    keys: [[0, 736], [6, 774], [11, 804], [15, 816], [36, 896]], aim: 804, keep: { armL: 0.3, armR: 0.3 } },
};
const PER = {
  timber: {
    // Timber Fall: a rear-leg head kick stepped into (the game carries him forward)
    timberFall: { take: "135_07", tip: "bT", support: "L", place: "support", lock: true, supportDx: -4,
      keys: [[0, 60], [6, 96], [10, 116], [13, 124], [34, 204]], aim: 116, keep: { armL: 0.35, armR: 0.35 } },
  },
  brass: {
    // Boiler Kick: a big lead-leg push kick, shield arms kept up
    boilerKick: { take: "144_09", tip: "fT", support: "R", place: "pelvis", pelvisDx: -3,
      keys: [[0, 1376], [6, 1414], [10, 1440], [13, 1452], [32, 1535]], aim: 1440, keep: { armL: 0.65, armR: 0.65 }, steer: [{ from: 10, to: 13, z: 36, ease: 4 }] },
  },
  pirouette: {
    // Arabesque: a dancer's grand battement, the straight leg thrown up past head height
    arabesque: { take: "05_05", mirror: true, tip: "fT", support: "R", place: "support", lock: true, yaw: 0,
      keys: [[0, 262], [5, 300], [9, 322], [12, 335], [34, 415]], aim: 322, keep: {} },
  },
  motley: {
    // Cartwheel: a real cartwheel turned in place (the game carries Motley along)
    cartwheel: { take: "88_07", tip: "fF", support: "R", place: "pelvis", aimBy: "travel", strip: 1, yaw: 0,
      keys: [[0, 6], [4, 24], [26, 118], [34, 156]], aim: 6, inEnd: 4, outStart: 26, keep: {} },
  },
};

export function mocapSpec(id, key) { return (PER[id] && PER[id][key]) || SHARED[key] || null; }

export function buildMocapMove(id, key, core, spec) {
  const ch = core.CHARACTERS.find((c) => c.id === id);
  const M = core.MOVES[key];
  const k = ch.stats.frame || 1;
  const start = M.base === "crouch" ? buildCrouch(id) : buildStance(id);
  const n = Math.round(M.total * k) + 1;
  const { poses } = mocapPoses(spec, { start, end: start, k, n });
  const c = new Clip(`${id}_${key}`, poses);
  const S = STANCES[id];
  c.fist = { L: spec.fist ?? S.fist, R: spec.fist ?? S.fist };
  return c;
}
