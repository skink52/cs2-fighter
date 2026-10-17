// The clip library: every animation each fighter needs, keyed the way the game asks for them
// (state names and move ids). New-pipeline clips are built here; anything not rebuilt yet falls
// back to the previous exporter's clips (read back from their SMDs) so the game stays complete.
import fs from "node:fs";
import path from "node:path";
import { Clip } from "./clip.mjs";
import { readSMD } from "./smd.mjs";
import { STANCES, buildIdle, buildWalk, cheat } from "./stances.mjs";

export const FIGHTERS = ["timber", "brass", "pirouette", "motley"];
export const STATE_KEYS = ["idle", "walkf", "walkb", "crouch", "block", "cblock", "squat", "air", "airrise", "land", "dashf", "dashb",
  "hithigh", "hitmid", "hitcrouch", "launch", "launchhold", "down", "downko", "getup", "thrown", "victory", "lobbyready", "waiting", "cheer", "defeat"];

const OLD_DIR = process.env.PB_OLD_ANIMS || "/home/claude/fighter/dist/addon/models/puppet_brawl/rig/anims";
function oldClip(name, file, loop) {
  const p = path.join(OLD_DIR, file + ".smd");
  if (!fs.existsSync(p)) return null;
  return new Clip(name, readSMD(p), { loop });
}

// builders for the new clips: (fighter id, core) -> Clip (facing +X, before the camera cheat)
const NEW = {
  idle: (id) => buildIdle(id),
  walkf: (id, core) => buildWalk(id, 1, core.walk(id, 1)),
  walkb: (id, core) => buildWalk(id, -1, core.walk(id, -1)),
};
const LOOPS = new Set(["idle", "walkf", "walkb", "crouch", "block", "cblock", "air", "airrise", "launchhold", "down", "downko", "victory", "lobbyready", "waiting", "cheer", "defeat"]);

export function buildLibrary(core) {
  const clips = [];
  const sets = {};
  for (const id of FIGHTERS) {
    const set = (sets[id] = {});
    const ch = core.CHARACTERS.find((c) => c.id === id);
    const moveIds = Object.keys(ch.moves);
    for (const key of [...STATE_KEYS, ...moveIds]) {
      const name = `${id}_${key}`;
      let c = null, fresh = false;
      if (NEW[key]) { c = NEW[key](id, core); fresh = true; }
      else {
        // previous exporter's names: styled normals per fighter, specials by id, victory per fighter
        const tries = key === "victory" ? [`victory_${id}`] : [`${key}_${id}`, key];
        for (const t of tries) { c = oldClip(name, t, LOOPS.has(key)); if (c) break; }
      }
      if (!c) { console.warn("no clip for", name); continue; }
      c.name = name;
      c.loop = LOOPS.has(key) || c.loop;
      if (fresh) { c.finish(); c.poses = c.poses.map((W) => cheat(id, W)); }
      c.fresh = fresh;
      c.key = key;
      clips.push(c);
      set[key] = name;
    }
  }
  return { clips, sets };
}
