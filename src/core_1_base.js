// =====================================================================================
//  PUPPET BRAWL core - part 1: constants, maths, roster, baked animation clips
//  Engine-agnostic. The CS2 script and the browser preview both run this same code.
// =====================================================================================

const PB_VERSION = "2.0.0";
const SIM_HZ = 64;
const DT = 1 / SIM_HZ;

// Game-level input bits. Each front end maps its own keys onto these.
const IN = {
  LEFT: 1 << 0, RIGHT: 1 << 1, UP: 1 << 2, DOWN: 1 << 3,
  PUNCH: 1 << 4, KICK: 1 << 5, BLOCK: 1 << 6, SPECIAL: 1 << 7,
  THROW: 1 << 8, USE: 1 << 9,
};

const DEG = Math.PI / 180;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function wrap180(a) { a %= 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; }
// Skeleton angles are measured from straight DOWN, positive toward the way the
// fighter faces: 0 = down, 90 = forward, 180 = up, -90 = backward.
function dX(a) { return Math.sin(a * DEG); }
function dY(a) { return -Math.cos(a * DEG); }
function angleOf(dx, dy) { return Math.atan2(dx, -dy) / DEG; }
function finite(n) { return typeof n === "number" && Number.isFinite(n); }

function distPointSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 1e-9 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + vx * t - px, cy = ay + vy * t - py;
  return Math.sqrt(cx * cx + cy * cy);
}

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.chance = (p) => rng() < p;
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  return rng;
}

// ------------------------------------------------------------------ colours ----------
const PLAYER_COLORS = [
  { r: 232, g: 62, b: 58 },    // P1 red
  { r: 40, g: 132, b: 232 },   // P2 blue
  { r: 64, g: 178, b: 84 },    // P3 green
  { r: 246, g: 196, b: 40 },   // P4 yellow
];
const PLAYER_COLOR_NAMES = ["RED", "BLUE", "GREEN", "YELLOW"];
// Teams mode recolours the four seats into two families.
const TEAM_COLORS = [
  [{ r: 232, g: 62, b: 58 }, { r: 255, g: 132, b: 52 }],   // left team: red / orange
  [{ r: 40, g: 132, b: 232 }, { r: 40, g: 196, b: 214 }],  // right team: blue / teal
];
const TEAM_NAMES = ["RED TEAM", "BLUE TEAM"];
function shade(c, k) {
  return { r: clamp(Math.round(c.r * k), 0, 255), g: clamp(Math.round(c.g * k), 0, 255), b: clamp(Math.round(c.b * k), 0, 255) };
}
function mix(c1, c2, t) {
  return { r: Math.round(lerp(c1.r, c2.r, t)), g: Math.round(lerp(c1.g, c2.g, t)), b: Math.round(lerp(c1.b, c2.b, t)) };
}

// ------------------------------------------------------------------ the roster -------
// Body sizes are in "fighter units" (FU). A standard puppet stands ~92 FU tall; the
// CS2 script multiplies everything by its WORLD_SCALE.
// specials: [neutral R / motion, toward+R / motion, down+R / motion]
// Body sizes match the CS2 agent skeleton (all agents share it): 1 FU = SKELETON_UNITS world
// units at scale 1, so the hit boxes sit on the visible model. `scale` grows or shrinks the
// whole fighter (model and hit boxes together). `agent` is the CS2 model each fighter wears.
const SKELETON_UNITS = 0.72;
const BASE_DIMS = { thigh: 24.9, shin: 23.5, foot: 9.4, torso: 36.4, neck: 4.3, headR: 6.4, uarm: 16.4, farm: 15.4, fistR: 4.9 };
const CHARACTERS = [
  {
    id: "timber", name: "TIMBER",
    tag: "Street boxer. Balanced, with a heavy right hand.",
    agent: "agents/models/tm_professional/tm_professional_varf.vmdl",
    accent: { r: 255, g: 176, b: 64 },
    scale: 1.0,
    limb: "limb",
    stats: { hp: 104, walkF: 175, walkB: 140, dashV: 430, jumpVy: 650, jumpVx: 205, dmg: 1.05, pushW: 14, frame: 1.0 },
    extras: [],
    specials: ["knotShot", "haymaker", "risingSplinter"],
    combos: { p: "splitter", k: "timberFall", mix: "rootSweep" },
    style: { windup: 1.0, follow: 1.0 },
    victory: "victoryBoxer",
  },
  {
    id: "brass", name: "BRASS",
    tag: "Riot heavy. Slow, armoured, hits like a truck.",
    agent: "agents/models/ctm_swat/ctm_swat_varianth.vmdl",
    accent: { r: 70, g: 210, b: 255 },
    scale: 1.07,
    limb: "block",
    stats: { hp: 109, walkF: 135, walkB: 112, dashV: 360, jumpVy: 600, jumpVx: 170, dmg: 1.07, pushW: 16, frame: 1.12 },
    extras: [{ ox: 0, oy: 1.25, r: 2.4 }],
    specials: ["cogToss", "steamRam", "pistonStomp"],
    combos: { p: "rivetHammer", k: "boilerKick", mix: "gearGrind" },
    style: { windup: 1.5, follow: 1.25 },
    victory: "victorySalute",
  },
  {
    id: "pirouette", name: "PIROUETTE",
    tag: "Field agent with a dancer's kicks. Fast and light.",
    agent: "agents/models/ctm_fbi/ctm_fbi_variantb.vmdl",
    accent: { r: 255, g: 92, b: 205 },
    scale: 1.0,
    limb: "limb",
    stats: { hp: 106, walkF: 205, walkB: 168, dashV: 490, jumpVy: 700, jumpVx: 232, dmg: 1.10, pushW: 13, frame: 0.94 },
    extras: [{ ox: -0.85, oy: 0.55, r: 3.3 }],
    specials: ["spinKick", "glide", "fouette"],
    combos: { p: "pasDeDeux", k: "arabesque", mix: "plieSweep" },
    style: { windup: 0.7, follow: 1.4 },
    victory: "victoryBallet",
  },
  {
    id: "motley", name: "MOTLEY",
    tag: "Masked trickster. Teleports and juggles.",
    agent: "agents/models/tm_leet/tm_leet_variantf.vmdl",
    accent: { r: 150, g: 255, b: 120 },
    scale: 0.95,
    limb: "limb",
    stats: { hp: 92, walkF: 185, walkB: 152, dashV: 455, jumpVy: 665, jumpVx: 216, dmg: 0.95, pushW: 13, frame: 1.0 },
    extras: [{ ox: -0.95, oy: 1.0, r: 2.7 }, { ox: 0.8, oy: 1.1, r: 2.7 }],
    specials: ["juggleBall", "cartwheel", "pratfall"],
    combos: { p: "slapstick", k: "bananaSweep", mix: "jesterDrop" },
    style: { windup: 1.35, follow: 1.6 },
    victory: "victoryBow",
  },
];
// Standard proportions the poses are authored against.
const STD_LEG = 49, STD_ARM = 31;
for (const ch of CHARACTERS) {
  ch.dims = {};
  for (const k in BASE_DIMS) ch.dims[k] = BASE_DIMS[k] * ch.scale;
  const d = ch.dims;
  ch.legF = (d.thigh + d.shin) / STD_LEG;
  ch.armF = (d.uarm + d.farm) / STD_ARM;
  ch.height = (d.thigh + d.shin) * 0.9 + d.torso + d.neck + d.headR * 2;
}

// ------------------------------------------------------------------ models -----------
// Part models are authored along +X from the pivot, MODEL_LEN long (the "ball" is a
// sphere of radius MODEL_BALL_R). Thickness ratios match the generated meshes.
const MODEL_LEN = 16;
const MODEL_BALL_R = 8;
const LIMB_RADIUS_K = 2.6 / 16;     // limb capsule radius per unit length
const BLOCK_HALF_K = 4.1 / 16;      // average half-thickness of the tapered block

// Part indices inside a puppet.
const PART = {
  TORSO: 0, HEAD: 1,
  B_UARM: 2, B_FARM: 3, B_FIST: 4,
  F_UARM: 5, F_FARM: 6, F_FIST: 7,
  B_THIGH: 8, B_SHIN: 9, B_FOOT: 10,
  F_THIGH: 11, F_SHIN: 12, F_FOOT: 13,
  EXTRA0: 14, EXTRA1: 15,
};
const PART_COUNT = 16;

// ------------------------------------------------------------------ baked animation --
// Every clip a fighter plays is built offline as 3D animation on the CS2 agent skeleton
// (tools/anim) and baked into 2D joint tracks: the side view of the joints that carry hit
// boxes and hurt boxes, in fighter units from the fighter's ground point, facing right. The
// "f" limbs are the lead side (nearer the opponent), "b" the rear. The build stores the
// tracks in ANIM_DATA; CLIPS holds them decoded.
const JOINTS = ["P", "N", "H", "S", "fE", "fW", "fF", "bE", "bW", "bF", "fK", "fA", "fT", "bK", "bA", "bT"];
const JN = JOINTS.length;
const J = {};
JOINTS.forEach((n, i) => { J[n] = i; });
/** @type {Record<string, {name: string, n: number, loop: boolean, r: number, j: Float32Array, ev: any}>} */
const CLIPS = {};
/** @type {Record<string, Record<string, string>>} */
const CLIP_SETS = {};
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_IDX = {};
for (let i = 0; i < 64; i++) B64_IDX[B64[i]] = i;
// two characters per value: tenths of a fighter unit, offset by 2048
function decodeTrack(str) {
  const n = str.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (B64_IDX[str[2 * i]] * 64 + B64_IDX[str[2 * i + 1]] - 2048) / 10;
  return out;
}
function loadAnimData(data) {
  if (!data) return;
  for (const name in data.clips) {
    const c = data.clips[name];
    CLIPS[name] = { name, n: c.n, loop: !!c.loop, r: c.r || 1, j: decodeTrack(c.j), ev: c.ev || null };
  }
  for (const id in data.sets) CLIP_SETS[id] = data.sets[id];
}
loadAnimData(ANIM_DATA);
// joint positions of clip c at (fractional) frame t into out[JN * 2]
function sampleClip(c, t, out) {
  const n = c.n, s = JN * 2;
  let i0, i1, u;
  if (c.loop) {
    t = ((t % n) + n) % n;
    i0 = Math.floor(t); i1 = (i0 + 1) % n; u = t - i0;
  } else {
    t = clamp(t, 0, n - 1);
    i0 = Math.floor(t); i1 = Math.min(n - 1, i0 + 1); u = t - i0;
  }
  const a = i0 * s, b = i1 * s, j = c.j;
  for (let k = 0; k < s; k++) out[k] = j[a + k] + (j[b + k] - j[a + k]) * u;
  return out;
}

function makeSkeleton() {
  const s = { minY: 0, pts: {}, raw: new Float32Array(JN * 2) };
  for (const j of JOINTS) s.pts[j] = { x: 0, y: 0 };
  return s;
}

function limbRadius(ch, len) {
  return (ch.limb === "block" ? BLOCK_HALF_K : LIMB_RADIUS_K) * len;
}
