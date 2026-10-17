// The clip library: every animation each fighter needs, keyed the way the game asks for them
// (state names and move ids). New-pipeline clips are built here; anything not rebuilt yet falls
// back to the previous exporter's clips (read back from their SMDs) so the game stays complete.
import fs from "node:fs";
import { FALL_ANIMS } from "./falls.mjs";
import path from "node:path";
import { Clip } from "./clip.mjs";
import { readSMD } from "./smd.mjs";
import { STANCES, buildIdle, buildWalk, cheat } from "./stances.mjs";
import { MOVE_ANIMS as NORMAL_ANIMS, buildMove } from "./moves.mjs";
import { SPECIAL_ANIMS } from "./specials.mjs";
const MOVE_ANIMS = { ...NORMAL_ANIMS, ...SPECIAL_ANIMS };
import { STATE_ANIMS } from "./states.mjs";
import { EXTRA_ANIMS } from "./extras.mjs";
import { mocapSpec, buildMocapMove } from "./mocap_specs.mjs";
import { POSED_MOVES } from "./posed_moves.mjs";

export const FIGHTERS = ["timber", "brass", "pirouette", "motley"];
export const STATE_KEYS = ["idle", "intro", "walkf", "walkb", "crouch", "block", "cblock", "blockhit", "cblockhit", "squat", "air", "airrise", "land", "dashf", "dashb",
  "hithigh", "hitmid", "hitcrouch", "launch", "launchhold", "burst", "airdodgef", "airdodgeb", "down", "downko", "getup", "throwv", "victory", "lobbyready", "waiting", "cheer", "defeat"];

const OLD_DIR = process.env.PB_OLD_ANIMS || "/home/claude/fighter/dist/addon/models/puppet_brawl/rig/anims";
function oldClip(name, file, loop) {
  const p = path.join(OLD_DIR, file + ".smd");
  if (!fs.existsSync(p)) return null;
  return new Clip(name, readSMD(p), { loop });
}

// builders for the new state clips: (fighter id, core) -> Clip (facing +X, before the camera cheat)
const NEW = {
  idle: (id) => buildIdle(id),
  walkf: (id, core) => buildWalk(id, 1, core.walk(id, 1)),
  walkb: (id, core) => buildWalk(id, -1, core.walk(id, -1)),
};
const LOOPS = new Set(["idle", "walkf", "walkb", "crouch", "block", "cblock", "air", "airrise", "launchhold", "down", "downko", "victory", "lobbyready", "waiting", "cheer", "defeat"]);
// keys with no clip of their own in the previous exporter, and what stands in for them
const OLD_ALIAS = { intro: "idle", blockhit: "block", cblockhit: "cblock", throwv: "thrown" };

// one clip for one fighter, or null
export function buildClip(id, key, core) {
  if (!core.walk) core = { ...core, walk: (fid, dir) => { const ch = core.CHARACTERS.find((c) => c.id === fid); return dir > 0 ? ch.stats.walkF : ch.stats.walkB; } };
  const ch = core.CHARACTERS.find((c) => c.id === id);
  const name = `${id}_${key}`;
  let c = null, fresh = false;
  const mspec = ch.moves[key] ? mocapSpec(id, key) : null;
  if (mspec) { c = buildMocapMove(id, key, core, mspec); fresh = true; }
  else if (ch.moves[key] && POSED_MOVES[key]) { c = POSED_MOVES[key](id, core); fresh = true; }
  else if (FALL_ANIMS[key]) { c = FALL_ANIMS[key](id, core); fresh = true; }
  else if (NEW[key]) { c = NEW[key](id, core); fresh = true; }
  else if (STATE_ANIMS[key]) { c = STATE_ANIMS[key](id, core); fresh = true; }
  else if (EXTRA_ANIMS[key] && (c = EXTRA_ANIMS[key](id, core))) fresh = true;
  else if (MOVE_ANIMS[key] && ch.moves[key]) { c = buildMove(id, key, core, MOVE_ANIMS[key]); fresh = true; }
  else {
    // previous exporter's names: styled normals per fighter, specials by id, victory per fighter
    const k = OLD_ALIAS[key] || key;
    const tries = k === "victory" ? [`victory_${id}`] : [`${k}_${id}`, k];
    for (const t of tries) { c = oldClip(name, t, LOOPS.has(key)); if (c) break; }
    // the old clips ran at base timing (played at 1/frame-multiplier speed)
    if (c && ch.moves[key]) c.rate = 1 / (ch.stats.frame || 1);
  }
  if (!c) return null;
  c.name = name;
  c.loop = LOOPS.has(key) || c.loop;
  if (fresh && !c.final) { c.finish(); c.poses = c.poses.map((W) => cheat(id, W)); }
  c.fresh = fresh;
  c.key = key;
  return c;
}

export function buildLibrary(core) {
  const clips = [];
  const sets = {};
  for (const id of FIGHTERS) {
    const set = (sets[id] = {});
    const ch = core.CHARACTERS.find((c) => c.id === id);
    for (const key of [...STATE_KEYS, ...Object.keys(ch.moves)]) {
      const c = buildClip(id, key, core);
      if (!c) { console.warn("no clip for", `${id}_${key}`); continue; }
      clips.push(c);
      set[key] = c.name;
    }
  }
  return { clips, sets };
}
