// =====================================================================================
//  PUPPET BRAWL core - part 2: the move table (frame data)
//  What each move looks like lives in its baked animation clip (tools/anim); this is the
//  timing, hit boxes, damage and movement.
// =====================================================================================

// ------------------------------------------------------------------ move table -------
// Frame counts are sim frames (64 per second) before the character's frame multiplier.
// base: the stance the move starts from (stance, crouch or air), for the animation builder.
// hits: active windows. tip = which point carries the hitbox (fF fist, bF, fT toe, bT,
//       fK knee, S shoulder, G ground-wave). level: high | mid | low | air.
// vel:  [from, to, vx, vy?] forward velocity applied while in that window.
const MOVES = {
  // ------------------------------------------------ standing normals
  jab: {
    name: "Jab", total: 18, base: "stance", chain: ["jab", "straight", "kickMid"], cancel: true, next: { P: "p", K: "mix" },
    hits: [{ from: 5, to: 7, tip: "fF", r: 5.5, dmg: 4, level: "high", hitstun: 14, blockstun: 9, push: 150, hitstop: 4, snd: "hit" }],
  },
  straight: {
    name: "Straight", total: 25, base: "stance", chain: ["kickMid"], cancel: true,
    hits: [{ from: 7, to: 9, tip: "bF", r: 6.5, dmg: 8, level: "high", hitstun: 18, blockstun: 12, push: 210, hitstop: 6, snd: "heavy" }],
    vel: [[5, 9, 60]],
  },
  uppercut: {
    name: "Uppercut", total: 34, base: "crouch",
    hits: [{ from: 6, to: 11, tip: "bF", r: 7, dmg: 13, level: "mid", hitstun: 30, blockstun: 16, push: 120, hitstop: 8, snd: "heavy", launch: { vx: 140, vy: 780 }, kd: true }],
  },
  kickMid: {
    name: "Snap kick", total: 25, base: "stance", cancel: true, next: { K: "k" },
    hits: [{ from: 7, to: 10, tip: "fT", r: 6, dmg: 7, level: "mid", hitstun: 16, blockstun: 11, push: 190, hitstop: 5, snd: "hit" }],
  },
  longKick: {
    name: "Side kick", total: 30, base: "stance",
    hits: [{ from: 10, to: 13, tip: "fT", r: 6, dmg: 9, level: "mid", hitstun: 17, blockstun: 12, push: 250, hitstop: 6, snd: "heavy" }],
    vel: [[4, 10, 70]],
  },
  roundhouse: {
    name: "Roundhouse", total: 36, base: "stance",
    hits: [{ from: 11, to: 15, tip: "bT", r: 7, dmg: 11, level: "high", hitstun: 22, blockstun: 14, push: 220, hitstop: 8, snd: "heavy", launch: { vx: 260, vy: 380 }, kd: true }],
  },
  // ------------------------------------------------ crouching
  sweep: {
    name: "Sweep", total: 32, base: "crouch",
    hits: [{ from: 8, to: 11, tip: "bT", r: 7, dmg: 7, level: "low", hitstun: 18, blockstun: 12, push: 80, hitstop: 6, snd: "hit", launch: { vx: 60, vy: 260 }, kd: true }],
  },
  // ------------------------------------------------ air
  airPunch: {
    name: "Air punch", total: 18, base: "air", air: true,
    hits: [{ from: 4, to: 12, tip: "fF", r: 6.5, dmg: 7, level: "air", hitstun: 16, blockstun: 10, push: 120, hitstop: 5, snd: "hit" }],
  },
  airKick: {
    name: "Flying kick", total: 21, base: "air", air: true,
    hits: [{ from: 5, to: 15, tip: "fT", r: 7, dmg: 9, level: "air", hitstun: 18, blockstun: 12, push: 160, hitstop: 6, snd: "heavy", airKd: true }],
  },
  // ------------------------------------------------ throws
  throw: {
    name: "Throw", total: 34, base: "stance", throw: true,
    // victim offset (thrower's facing frame): [frame, dx, dy(pelvis above ground), rot]
    victim: [[0, 30, 40, 0], [4, 28, 42, -10], [14, 12, 74, -80], [20, -22, 66, -150]],
    release: 20, dmg: 11, toss: { vx: -320, vy: 300 },
  },
  throwWhiff: {
    name: "Grab", total: 20, base: "stance",
  },

  // ================================================ SPECIALS
  // ---- TIMBER
  knotShot: {
    name: "Knot Shot", total: 30, base: "stance", special: true, motion: ["B", "F"], btn: "P",
    projectile: { at: 12, from: "bF", vx: 430, vy: 0, g: 0, r: 7, dmg: 9, chip: 2, hitstun: 16, blockstun: 14, push: 200, life: 2.5, level: "mid" },
  },
  haymaker: {
    name: "Haymaker", total: 46, base: "stance", special: true, motion: ["F", "F"], btn: "P",
    hits: [{ from: 11, to: 23, tip: "bF", r: 8, dmg: 14, level: "mid", hitstun: 26, blockstun: 18, push: 400, hitstop: 9, snd: "heavy", chip: 3 }],
    vel: [[10, 24, 500]],
  },
  risingSplinter: {
    name: "Rising Splinter", total: 30, base: "crouch", special: true, motion: ["D", "F"], btn: "P",
    hits: [{ from: 3, to: 15, tip: "bF", r: 8, dmg: 12, level: "mid", hitstun: 30, blockstun: 16, push: 100, hitstop: 8, snd: "heavy", launch: { vx: 120, vy: 760 }, kd: true, chip: 3 }],
    invuln: [1, 9], jump: { at: 4, vx: 110, vy: 720 }, landLag: 14,
  },
  // ---- BRASS
  cogToss: {
    name: "Cog Toss", total: 34, base: "stance", special: true, motion: ["B", "F"], btn: "P",
    projectile: { at: 16, from: "bF", vx: 300, vy: 560, g: 1700, r: 8.5, dmg: 11, chip: 3, hitstun: 20, blockstun: 16, push: 200, life: 3, level: "mid", ground: true },
  },
  steamRam: {
    name: "Steam Ram", total: 44, base: "stance", special: true, motion: ["B", "F"], btn: "K",
    hits: [{ from: 13, to: 30, tip: "S", r: 12, dmg: 12, level: "mid", hitstun: 24, blockstun: 16, push: 260, hitstop: 9, snd: "heavy", launch: { vx: 320, vy: 360 }, kd: true, chip: 3 }],
    vel: [[12, 30, 470]], armor: [1, 24],
  },
  pistonStomp: {
    name: "Piston Stomp", total: 40, base: "stance", special: true, motion: ["D", "D"], btn: "K",
    hits: [
      { from: 18, to: 22, tip: "G", gx: 34, gy: 6, r: 34, dmg: 10, level: "low", hitstun: 20, blockstun: 14, push: 140, hitstop: 8, snd: "heavy", launch: { vx: 120, vy: 420 }, kd: true, shake: 1, chip: 2 },
      { from: 18, to: 22, tip: "G", gx: -20, gy: 6, r: 20, dmg: 8, level: "low", hitstun: 20, blockstun: 14, push: 140, hitstop: 8, snd: "heavy", launch: { vx: -120, vy: 380 }, kd: true, chip: 2 },
    ],
  },
  // ---- PIROUETTE
  spinKick: {
    name: "Spin Kick", total: 40, base: "stance", special: true, motion: ["D", "B"], btn: "K",
    hits: [
      { from: 8, to: 11, tip: "fT", r: 7, dmg: 5, level: "mid", hitstun: 16, blockstun: 10, push: 60, hitstop: 4, snd: "hit", chip: 1 },
      { from: 16, to: 19, tip: "fT", r: 7, dmg: 5, level: "mid", hitstun: 16, blockstun: 10, push: 60, hitstop: 4, snd: "hit", chip: 1 },
      { from: 24, to: 28, tip: "fT", r: 7, dmg: 6, level: "mid", hitstun: 20, blockstun: 12, push: 120, hitstop: 7, snd: "heavy", launch: { vx: 220, vy: 380 }, kd: true, chip: 1 },
    ],
    vel: [[6, 30, 250]],
  },
  glide: {
    name: "Glide", total: 36, base: "stance", special: true, motion: ["F", "F"], btn: "K",
    hits: [{ from: 6, to: 20, tip: "fT", r: 7, dmg: 9, level: "low", hitstun: 20, blockstun: 12, push: 120, hitstop: 7, snd: "heavy", launch: { vx: 140, vy: 300 }, kd: true, chip: 2 }],
    vel: [[4, 22, 560]],
  },
  fouette: {
    name: "Fouette", total: 28, base: "crouch", special: true, motion: ["D", "U"], btn: "K",
    hits: [{ from: 5, to: 16, tip: "fT", r: 7.5, dmg: 11, level: "mid", hitstun: 30, blockstun: 14, push: 100, hitstop: 8, snd: "heavy", launch: { vx: 140, vy: 700 }, kd: true, chip: 2 }],
    invuln: [1, 8], jump: { at: 4, vx: 80, vy: 700 }, landLag: 12,
  },
  // ---- MOTLEY
  juggleBall: {
    name: "Juggle Ball", total: 26, base: "stance", special: true, motion: ["B", "F"], btn: "P",
    projectile: { at: 9, from: "bF", vx: 570, vy: 0, g: 0, r: 5.5, dmg: 7, chip: 2, hitstun: 15, blockstun: 12, push: 160, life: 2, level: "mid" },
  },
  pratfall: {
    name: "Pratfall", total: 40, base: "stance", special: true, motion: ["D", "U"], btn: "P",
    scale: [[6, 1], [12, 0.05], [17, 0.05], [22, 1]],
    invuln: [3, 26], teleport: 15,
  },
  cartwheel: {
    name: "Cartwheel", total: 34, base: "stance", special: true, motion: ["F", "F"], btn: "K",
    hits: [
      { from: 9, to: 13, tip: "fF", r: 6, dmg: 5, level: "mid", hitstun: 18, blockstun: 10, push: 50, hitstop: 5, snd: "hit", chip: 1 },
      { from: 17, to: 21, tip: "fT", r: 6, dmg: 5, level: "mid", hitstun: 20, blockstun: 12, push: 120, hitstop: 7, snd: "heavy", launch: { vx: 180, vy: 400 }, kd: true, chip: 1 },
    ],
    vel: [[4, 26, 360]],
  },
  // ================================================ COMBO FINISHERS
  // P after a jab, or K after a snap kick (hit, blocked or whiffed), gives the fighter's own
  // second hit.
  // ---- TIMBER
  splitter: {
    name: "Splitter", total: 27, base: "stance", combo: true, cancel: true, next: { K: "k" },
    hits: [{ from: 7, to: 9, tip: "bF", r: 7, dmg: 9, level: "high", hitstun: 20, blockstun: 13, push: 240, hitstop: 7, snd: "heavy" }],
    vel: [[2, 9, 120]],
  },
  timberFall: {
    name: "Timber Fall", total: 34, base: "stance", combo: true,
    hits: [{ from: 10, to: 13, tip: "bT", r: 7, dmg: 10, level: "high", hitstun: 22, blockstun: 14, push: 230, hitstop: 8, snd: "heavy", launch: { vx: 240, vy: 360 }, kd: true }],
    vel: [[2, 10, 90]],
  },
  // ---- BRASS
  rivetHammer: {
    name: "Rivet Hammer", total: 35, base: "stance", combo: true, next: { K: "k" },
    hits: [{ from: 11, to: 14, tip: "fF", r: 8.5, dmg: 9, level: "over", hitstun: 24, blockstun: 15, push: 200, hitstop: 9, snd: "heavy", shake: 1 }],
    vel: [[4, 12, 120]],
  },
  boilerKick: {
    name: "Boiler Kick", total: 32, base: "stance", combo: true,
    hits: [{ from: 10, to: 13, tip: "fT", r: 7.5, dmg: 10, level: "mid", hitstun: 20, blockstun: 14, push: 420, hitstop: 8, snd: "heavy" }],
    vel: [[3, 10, 100]],
  },
  // ---- PIROUETTE
  pasDeDeux: {
    name: "Pas de Deux", total: 28, base: "stance", combo: true, cancel: true, next: { K: "k" },
    hits: [
      { from: 5, to: 6, tip: "bF", r: 6, dmg: 5, level: "high", hitstun: 16, blockstun: 10, push: 60, hitstop: 4, snd: "hit" },
      { from: 11, to: 13, tip: "fF", r: 6.5, dmg: 7, level: "high", hitstun: 20, blockstun: 12, push: 200, hitstop: 6, snd: "heavy" },
    ],
    vel: [[1, 13, 150]],
  },
  arabesque: {
    name: "Arabesque", total: 34, base: "stance", combo: true,
    hits: [{ from: 9, to: 12, tip: "fT", r: 7.5, dmg: 10, level: "high", hitstun: 26, blockstun: 13, push: 120, hitstop: 8, snd: "heavy", launch: { vx: 120, vy: 620 }, kd: true }],
    vel: [[2, 9, 100]],
  },
  // ---- MOTLEY
  slapstick: {
    name: "Slapstick", total: 30, base: "stance", combo: true, cancel: true, next: { K: "k" },
    hits: [
      { from: 6, to: 7, tip: "bF", r: 7, dmg: 4, level: "high", hitstun: 16, blockstun: 10, push: 40, hitstop: 4, snd: "hit" },
      { from: 12, to: 14, tip: "fF", r: 7, dmg: 6, level: "high", hitstun: 22, blockstun: 12, push: 220, hitstop: 6, snd: "heavy" },
    ],
    vel: [[1, 14, 130]],
  },
  bananaSweep: {
    name: "Banana Sweep", total: 32, base: "crouch", combo: true,
    hits: [{ from: 8, to: 11, tip: "bT", r: 7.5, dmg: 8, level: "low", hitstun: 18, blockstun: 12, push: 80, hitstop: 6, snd: "hit", launch: { vx: 60, vy: 300 }, kd: true }],
    vel: [[2, 9, 110]],
  },
  // ---- mix-up enders: P then K after a jab. Each fighter has a LOW one or an overhead
  rootSweep: {
    name: "Root Sweep", total: 30, base: "crouch", combo: true,
    hits: [{ from: 7, to: 10, tip: "fT", r: 7.5, dmg: 8, level: "low", hitstun: 18, blockstun: 12, push: 90, hitstop: 6, snd: "hit", launch: { vx: 60, vy: 280 }, kd: true }],
    vel: [[1, 8, 120]],
  },
  gearGrind: {
    name: "Gear Grind", total: 34, base: "crouch", combo: true,
    hits: [{ from: 10, to: 13, tip: "fT", r: 8, dmg: 10, level: "low", hitstun: 20, blockstun: 14, push: 160, hitstop: 8, snd: "heavy", shake: 1, launch: { vx: 80, vy: 300 }, kd: true }],
    vel: [[2, 10, 110]],
  },
  plieSweep: {
    name: "Plie Sweep", total: 28, base: "crouch", combo: true,
    hits: [{ from: 7, to: 9, tip: "fT", r: 7.5, dmg: 8, level: "low", hitstun: 18, blockstun: 11, push: 80, hitstop: 6, snd: "hit", launch: { vx: 60, vy: 300 }, kd: true }],
    vel: [[1, 8, 130]],
  },
  jesterDrop: {
    name: "Jester Drop", total: 34, base: "stance", combo: true,
    hits: [{ from: 13, to: 16, tip: "fT", r: 8, dmg: 9, level: "over", hitstun: 22, blockstun: 13, push: 180, hitstop: 8, snd: "heavy" }],
    vel: [[3, 13, 110]],
  },
};
const NORMAL_IDS = ["jab", "straight", "uppercut", "kickMid", "longKick", "roundhouse", "sweep", "airPunch", "airKick", "throw", "throwWhiff"];

// Resolve every move for every character once, with frames scaled by the fighter's speed.
function buildMoveSet(ch) {
  const set = {};
  const k = ch.stats.frame || 1;
  const sf = (f) => Math.max(0, Math.round(f * k));
  const ids = NORMAL_IDS.concat(ch.specials, ch.combos ? Object.values(ch.combos) : []);
  for (const id of ids) {
    const m = MOVES[id];
    if (!m) continue;
    const r = { id, def: m, name: m.name, total: Math.max(2, sf(m.total)) };
    r.hits = (m.hits || []).map((h) => Object.assign({}, h, { from: sf(h.from), to: sf(h.to), dmg: h.dmg * ch.stats.dmg }));
    r.vel = (m.vel || []).map(([a, b, vx, vy]) => [sf(a), sf(b), vx, vy]);
    if (m.projectile) r.projectile = Object.assign({}, m.projectile, { at: sf(m.projectile.at), dmg: m.projectile.dmg * ch.stats.dmg });
    if (m.invuln) r.invuln = [sf(m.invuln[0]), sf(m.invuln[1])];
    if (m.armor) r.armor = [sf(m.armor[0]), sf(m.armor[1])];
    if (m.jump) r.jump = Object.assign({}, m.jump, { at: sf(m.jump.at) });
    if (m.teleport !== undefined) r.teleport = sf(m.teleport);
    if (m.release !== undefined) r.release = sf(m.release);
    if (m.victim) r.victim = m.victim.map(([f, dx, dy, rot]) => [sf(f), dx, dy, rot]);
    if (m.scale) r.scale = m.scale.map(([f, v]) => [sf(f), v]);
    r.landLag = m.landLag || 0;
    r.cancel = !!m.cancel;
    r.chain = m.chain || [];
    r.air = !!m.air;
    r.special = !!m.special;
    r.combo = !!m.combo;
    set[id] = r;
  }
  return set;
}
for (const ch of CHARACTERS) ch.moves = buildMoveSet(ch);
