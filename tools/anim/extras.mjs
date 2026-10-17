// Personality clips: round intros, victory and defeat loops, and the lobby / queue loops
// (ready, waiting, cheering). Keyed per fighter on the stance (conventions in moves.mjs).
import { v3, DEG } from "./m3.mjs";
import { STANCES } from "./stances.mjs";
import { keyedState } from "./states.mjs";

const A = (x, y, z) => v3.norm([x, y, z]);
const pre = (id) => {
  const th = -STANCES[id].cheat * DEG;
  return (v) => [v[0] * Math.cos(th) - v[1] * Math.sin(th), v[0] * Math.sin(th) + v[1] * Math.cos(th), v[2]];
};
// standing tall and loose, hands dropped from the guard
const RELAX = { pelvis: [-0.5, 0, 2.2], lean: -6, twist: 4, L: { d: [-6, 2, -14] }, R: { d: [-3, -2, -15] }, fistL: 0.35, fistR: 0.35 };
const loopKeys = (n, ...mid) => [[0, mid[0][1]], ...mid.slice(1), [n, mid[0][1]]];

const X = {
  timber: {
    // cracks his neck both ways, knocks his gloves together twice, then snaps into guard
    intro: (p) => ({ n: 112, keys: [
      [0, RELAX], [12, { ...RELAX, headRoll: -24 }], [22, { ...RELAX, headRoll: 22 }], [30, { ...RELAX, headRoll: 0 }],
      [42, { pelvis: [0, 0, 1], lean: 2, L: { w: p([15, 2, 52]), aim: A(0.3, -1, 0.2) }, R: { w: p([15, -2, 52]), aim: A(0.3, 1, 0.2) }, fistL: 1, fistR: 1 }],
      [48, { pelvis: [0, 0, 1], lean: 2, L: { w: p([15, 7, 54]), aim: A(0.3, -1, 0.2) }, R: { w: p([15, -7, 54]), aim: A(0.3, 1, 0.2) } }],
      [53, { pelvis: [0, 0, 1], lean: 2, L: { w: p([15, 2, 52]), aim: A(0.3, -1, 0.2) }, R: { w: p([15, -2, 52]), aim: A(0.3, 1, 0.2) } }],
      [59, { pelvis: [0, 0, 1], lean: 2, L: { w: p([15, 7, 54]), aim: A(0.3, -1, 0.2) }, R: { w: p([15, -7, 54]), aim: A(0.3, 1, 0.2) } }],
      [64, { pelvis: [0, 0, 1], lean: 2, L: { w: p([15, 2, 52]), aim: A(0.3, -1, 0.2) }, R: { w: p([15, -2, 52]), aim: A(0.3, 1, 0.2) } }],
      [76, { pelvis: [0.5, 0, -1.5], lean: 4 }], [90, { pelvis: [0, 0, 0.6] }], [111, {}]] }),
    // arms up, bouncing on his toes
    victory: (p) => {
      const up = { pelvis: [0, 0, 3], lean: -8, headPitch: -12, L: { w: p([6, 12, 86]), aim: A(0.1, 0.2, 1) }, R: { w: p([4, -12, 87]), aim: A(0.1, -0.2, 1) }, fR: { pitch: -10 }, fL: { pitch: -8 } };
      return { loop: true, n: 48, keys: [[0, up], [12, { ...up, pelvis: [0, 0, 4.5], L: { ...up.L, w: p([6, 12, 89]) } }], [24, { ...up, pelvis: [0, 0, 2.5] }], [36, { ...up, pelvis: [0, 0, 4.5], R: { ...up.R, w: p([4, -12, 90]) } }], [48, up]] };
    },
    // shadow-boxing: one-two, then a double jab
    lobbyready: (p) => ({ loop: true, n: 64, keys: [[0, {}], [5, { L: { w: p([32, 3, 58]), aim: A(1, 0, 0) }, twist: -10, pelvis: [1, 0, -0.5] }], [10, {}],
      [15, { R: { w: p([34, -1, 57]), aim: A(1, 0, 0) }, twist: 18, hipYaw: 12, pelvis: [1.5, 0, -0.6] }], [22, {}], [36, { L: { w: p([31, 3, 58]), aim: A(1, 0, 0) }, twist: -10 }], [40, {}],
      [44, { L: { w: p([32, 3, 57]), aim: A(1, 0, 0) }, twist: -10 }], [50, {}], [64, {}]] }),
    waiting: (p) => ({ loop: true, n: 96, keys: loopKeys(96, [0, RELAX], [48, { ...RELAX, pelvis: [0.3, 0, 1.6], twist: 7 }]) }),
    cheer: (p) => {
      const c = { ...RELAX, R: { w: p([6, -10, 84]), aim: A(0, 0, 1) }, fistR: 1 };
      return { loop: true, n: 28, keys: [[0, c], [8, { ...c, R: { w: p([6, -10, 70]), aim: A(0.3, 0, 1) } }], [16, c], [28, c]] };
    },
    // bent over, hands on the knees, heaving
    defeat: (p) => {
      const d = { pelvis: [-2.5, 0, -3], lean: 42, headPitch: 14, L: { w: p([12, 6, 24]), aim: A(0.2, 0, -1) }, R: { w: p([2, -7, 24]), aim: A(0.2, 0, -1) }, fistL: 0.2, fistR: 0.2 };
      return { loop: true, n: 72, keys: [[0, d], [20, { ...d, lean: 46, pelvis: [-2.5, 0, -3.6] }], [36, d], [56, { ...d, lean: 45 }], [72, d]] };
    },
  },
  brass: {
    // fist bumps, a shoulder roll, guard
    intro: (p) => ({ n: 112, keys: [
      [0, RELAX], [16, { pelvis: [0, 0, 1], L: { w: p([16, 1, 50]), aim: A(1, 0, 0) }, R: { w: p([17, -1, 50]), aim: A(1, 0, 0) }, fistL: 1, fistR: 1 }],
      [22, { pelvis: [0, 0, 1], L: { w: p([14, 8, 52]), aim: A(1, 0, 0) }, R: { w: p([15, -8, 52]), aim: A(1, 0, 0) } }],
      [28, { pelvis: [0, 0, 0.4], L: { w: p([17, 1, 50]), aim: A(1, 0, 0) }, R: { w: p([18, -1, 50]), aim: A(1, 0, 0) } }],
      [44, { ...RELAX, shL: 14, shR: 14, lean: -2 }], [56, { ...RELAX, shL: -6, shR: -6 }], [66, { ...RELAX, shL: 10, shR: 10 }],
      [82, { pelvis: [0, 0, -1] }], [111, {}]] }),
    // double-biceps flex
    victory: (p) => {
      const f = { pelvis: [0, 0, 2], lean: -6, headPitch: -6, L: { w: p([4, 18, 70]), aim: A(0, -0.3, 1), elbow: p([0, 26, 58]) }, R: { w: p([4, -18, 70]), aim: A(0, 0.3, 1), elbow: p([0, -26, 58]) }, fistL: 1, fistR: 1 };
      return { loop: true, n: 64, keys: [[0, f], [16, { ...f, lean: -8, shL: 6, shR: 6 }], [32, f], [48, { ...f, lean: -4 }], [64, f]] };
    },
    // punches his palm
    lobbyready: (p) => {
      const palm = { L: { w: p([16, 2, 48]), aim: A(0.3, -1, 0) }, fistL: 0.1, R: { w: p([10, -6, 52]) } };
      return { loop: true, n: 48, keys: [[0, palm], [10, { ...palm, R: { w: p([15, 0, 49]), aim: A(1, 0.4, 0) } }], [16, palm], [26, { ...palm, R: { w: p([15, 0, 49]), aim: A(1, 0.4, 0) } }], [34, palm], [48, palm]] };
    },
    // arms folded
    waiting: (p) => {
      const w = { ...RELAX, L: { w: p([9, -5, 46]), aim: A(0, -1, 0) }, R: { w: p([10, 5, 48]), aim: A(0, 1, 0) }, fistL: 0.3, fistR: 0.3 };
      return { loop: true, n: 96, keys: loopKeys(96, [0, w], [48, { ...w, pelvis: [0, 0, 1.6], lean: -5 }]) };
    },
    cheer: (p) => {
      const c = { ...RELAX, L: { w: p([4, 12, 82]), aim: A(0, 0, 1) }, fistL: 1 };
      return { loop: true, n: 30, keys: [[0, c], [9, { ...c, L: { w: p([4, 12, 74]) } }], [18, c], [30, c]] };
    },
    // down on one knee, head bowed
    defeat: (p) => {
      const d = { pelvis: [-1, 0, -17], lean: 18, headPitch: 22, fR: { w: p([-14, -8, 4]), pitch: -30, knee: p([0, -10, 0]) }, fL: { w: p([10, 7, 4.3]) },
        L: { w: p([16, 6, 26]), aim: A(0.2, 0, -1) }, R: { w: p([2, -8, 30]), aim: A(0, 0, -1) }, fistL: 0.3, fistR: 0.3 };
      return { loop: true, n: 80, keys: [[0, d], [40, { ...d, lean: 21, pelvis: [-1, 0, -17.6] }], [80, d]] };
    },
  },
  pirouette: {
    // a twirl on the toes, arms up, settling into guard
    intro: (p) => {
      const t = { pelvis: [0, 0, 4], lean: -6, L: { w: p([2, 8, 82]), aim: A(0, -0.4, 1) }, R: { w: p([2, -8, 82]), aim: A(0, 0.4, 1) }, fL: { pitch: -30, d: [0, -3, 2] }, fR: { pitch: -30, d: [0, 3, 2] }, fistL: 0.1, fistR: 0.1 };
      return { n: 112, keys: [[0, RELAX], [14, { ...t, spin: 0 }], [36, { ...t, spin: 220 }], [50, { ...t, spin: 360 }], [62, { ...t, spin: 360, L: { w: p([20, 18, 60]) }, R: { w: p([-4, -18, 62]) } }],
        [80, { pelvis: [0, 0, -1], spin: 360 }], [111, { spin: 360 }]] };
    },
    // en haut: arms in a ring overhead, up on the toes, breathing
    victory: (p) => {
      const v = { pelvis: [1, 0, 4.5], lean: -8, headPitch: -8, L: { w: p([6, 6, 84]), aim: A(0, -1, 0.3), elbow: p([2, 18, 76]) }, R: { w: p([6, -6, 84]), aim: A(0, 1, 0.3), elbow: p([2, -18, 76]) },
        fL: { pitch: -35, d: [1, -2, 2.5] }, fR: { pitch: -35, d: [2, 3, 2.5] }, fistL: 0.05, fistR: 0.05 };
      return { loop: true, n: 96, keys: [[0, v], [48, { ...v, pelvis: [1, 0, 5.2], lean: -10, twist: 6 }], [96, v]] };
    },
    // side stretches
    lobbyready: (p) => {
      const a = { ...RELAX, side: 16, L: { w: p([0, 2, 86]), aim: A(0, -0.5, 1) }, fistL: 0.05 }, b = { ...RELAX, side: -16, R: { w: p([0, -2, 86]), aim: A(0, 0.5, 1) }, fistR: 0.05 };
      return { loop: true, n: 96, keys: [[0, RELAX], [24, a], [48, RELAX], [72, b], [96, RELAX]] };
    },
    // hand on hip, weight on one leg
    waiting: (p) => {
      const w = { ...RELAX, side: 5, hipRoll: 5, L: { w: p([-1, 13, 40]), aim: A(-0.5, -0.2, -1), elbow: p([-4, 22, 46]) }, fistL: 0.1 };
      return { loop: true, n: 96, keys: loopKeys(96, [0, w], [48, { ...w, side: 6, pelvis: [-0.5, 0, 1.8] }]) };
    },
    cheer: (p) => {
      const c = { ...RELAX, L: { w: p([14, 2, 58]), aim: A(0.3, -1, 0.3) }, R: { w: p([14, -2, 58]), aim: A(0.3, 1, 0.3) }, fistL: 0, fistR: 0 };
      const o = { ...c, L: { ...c.L, w: p([14, 8, 58]) }, R: { ...c.R, w: p([14, -8, 58]) } };
      return { loop: true, n: 20, keys: [[0, c], [5, o], [10, c], [15, o], [20, c]] };
    },
    // arms folded, head turned away
    defeat: (p) => {
      const d = { ...RELAX, look: p([30, -60, 60]), L: { w: p([9, -5, 47]), aim: A(0, -1, 0) }, R: { w: p([10, 5, 49]), aim: A(0, 1, 0) }, headPitch: 10 };
      return { loop: true, n: 96, keys: loopKeys(96, [0, d], [48, { ...d, pelvis: [-0.5, 0, 1.6] }]) };
    },
  },
  motley: {
    // a deep showman's bow with a flourish
    intro: (p) => {
      const bow = { pelvis: [-2, 0, 0], lean: 55, headPitch: 10, L: { w: p([4, 24, 46]), aim: A(0, 1, 0.3) }, R: { w: p([10, -2, 40]), aim: A(0, 1, 0) }, fR: { d: [-4, -2, 0] }, fistL: 0.05, fistR: 0.2 };
      return { n: 112, keys: [[0, RELAX], [16, { ...RELAX, L: { w: p([2, 20, 76]), aim: A(0, 0.3, 1) }, fistL: 0.05 }], [34, bow], [56, bow], [74, { ...RELAX, L: { d: [0, 4, 0] } }], [90, { pelvis: [0, 0, -1] }], [111, {}]] };
    },
    // doubled over laughing, slapping his knee
    victory: (p) => {
      const l = { pelvis: [-1, 0, -1], lean: 30, headPitch: -18, look: p([60, -20, 70]), L: { w: p([10, 8, 32]), aim: A(0.3, 0, -1) }, R: { w: p([6, -4, 42]), aim: A(0.3, 0.5, 0) }, fistL: 0.1, fistR: 0.1 };
      const keys = [];
      for (let f = 0; f <= 48; f += 6) keys.push([f, { ...l, lean: 30 + (f % 12 ? 4 : 0), L: { ...l.L, w: p([10, 8, f % 12 ? 37 : 30]) }, pelvis: [-1, 0, f % 12 ? -0.4 : -1.2] }]);
      return { loop: true, n: 48, keys };
    },
    // hopping from foot to foot
    lobbyready: (p) => ({ loop: true, n: 32, keys: [[0, { pelvis: [0, 0, 0] }], [8, { pelvis: [0.5, 0, 1.5], fL: { d: [0, 0, 3.5], pitch: -20 } }], [16, { pelvis: [0, 0, 0] }], [24, { pelvis: [-0.5, 0, 1.5], fR: { d: [0, 0, 3.5], pitch: -30 } }], [32, { pelvis: [0, 0, 0] }]] }),
    // rocking on his heels, hands behind his back
    waiting: (p) => {
      const w = { ...RELAX, L: { w: p([-10, 6, 38]), aim: A(-0.3, -0.5, -1) }, R: { w: p([-10, -6, 38]), aim: A(-0.3, 0.5, -1) } };
      return { loop: true, n: 64, keys: [[0, w], [16, { ...w, pelvis: [-1, 0, 2.2], lean: -10, fL: { pitch: 14 } }], [32, w], [48, { ...w, pelvis: [1, 0, 2.4], lean: -2, fR: { pitch: -16 } }], [64, w]] };
    },
    cheer: (p) => {
      const c = { ...RELAX, L: { w: p([0, 16, 84]), aim: A(0, 0.4, 1) }, R: { w: p([0, -16, 84]), aim: A(0, -0.4, 1) }, fistL: 0.05, fistR: 0.05 };
      const o = { ...c, L: { ...c.L, w: p([4, 6, 86]) }, R: { ...c.R, w: p([4, -6, 86]) } };
      return { loop: true, n: 24, keys: [[0, c], [6, o], [12, c], [18, o], [24, c]] };
    },
    // a big shrug
    defeat: (p) => {
      const d = { ...RELAX, shL: 16, shR: 16, headRoll: 12, L: { w: p([10, 16, 44]), aim: A(1, 0.4, 0), up: [0, 0, -1] }, R: { w: p([10, -16, 44]), aim: A(1, -0.4, 0), up: [0, 0, -1] }, fistL: 0, fistR: 0 };
      return { loop: true, n: 72, keys: [[0, RELAX], [14, d], [42, d], [60, RELAX], [72, RELAX]] };
    },
  },
};

export const EXTRA_ANIMS = {};
for (const key of ["intro", "victory", "lobbyready", "waiting", "cheer", "defeat"]) {
  EXTRA_ANIMS[key] = (id) => {
    const spec = X[id] && X[id][key];
    if (!spec) return null;
    const d = spec(pre(id));
    return keyedState(id, key, { n: d.loop ? d.n : d.n, loop: !!d.loop, keys: d.keys });
  };
}
