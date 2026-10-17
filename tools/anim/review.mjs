// Renders clips for review on the real agent meshes: contact sheets and MP4s from the fight
// camera (or another view), with the hit circle on the striking tip during active frames and
// the old system's target marked, plus the reach numbers.
//   node tools/anim/review.mjs <fighter|all> <key>[,key...] [--view game|side|front|three]
//        [--every 2] [--cols 8] [--size 320x300] [--out sheet.png] [--mp4 clip.mp4] [--hurt]
import path from "node:path";
import url from "node:url";
import { renderFrames, writeSheet, writeMP4, AGENT_DIR, AGENTS, VIEWS } from "./preview.mjs";
import { loadAgent } from "./render.mjs";
import { jointsOf, JOINTS, FU } from "./bake.mjs";
import { buildClip } from "./library.mjs";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const C = await import(path.join(root, "dist", "core_node.mjs"));
const core = { CHARACTERS: C.CHARACTERS, MOVES: C.MOVES };

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const flag = (k) => args.includes("--" + k);
const who = args[0] === "all" ? Object.keys(AGENTS) : args[0].split(",");
const keys = args[1].split(",");
const every = +opt("every", 1);
const size = opt("size", "320x300").split("x").map(Number);
const viewName = opt("view", "game");
const view = { ...VIEWS[viewName] };
if (viewName === "game") { view.eye = [10, -150, 50]; view.at = [10, 0, 37]; view.fov = 40; }

const sheets = [];
for (const id of who) {
  const ch = core.CHARACTERS.find((c) => c.id === id);
  const agent = loadAgent(path.join(AGENT_DIR, AGENTS[id] + ".json"));
  for (const key of keys) {
    const clip = buildClip(id, key, core);
    if (!clip) { console.log("no clip", id, key); continue; }
    const m = ch.moves[key];
    const hits = m ? m.hits : [];
    const k = ch.stats.frame || 1;
    let sel = clip.poses.map((_, i) => i).filter((i) => i % every === 0 || hits.some((h) => i >= h.from && i <= h.to));
    if (opt("pick")) {
      // N frames spread over the clip, always including the first active frame of each hit
      const N = +opt("pick");
      const set = new Set();
      for (let k = 0; k < N; k++) set.add(Math.round((k / Math.max(1, N - 1)) * (clip.n - 1)));
      for (const h of hits) set.add(Math.min(clip.n - 1, h.from));
      sel = [...set].sort((a, b) => a - b);
    }
    // reach report
    const rep = [];
    for (const h of hits) {
      const ti = JOINTS.indexOf(h.tip);
      if (ti < 0) continue;
      const xs = [];
      for (let f = h.from; f <= h.to && f < clip.n; f++) {
        const j = jointsOf(clip.poses[f]);
        let p = j[ti];
        if (h.tip === "fT" || h.tip === "bT") { const a = j[JOINTS.indexOf(h.tip[0] + "A")]; p = [a[0] + (p[0] - a[0]) * 0.75, a[1] + (p[1] - a[1]) * 0.75]; }
        xs.push(`${(p[0] * ch.scale).toFixed(1)},${(p[1] * ch.scale).toFixed(1)}`);
      }
      rep.push(`${h.tip}[${h.from}-${h.to}] ${xs.join(" ")}`);
    }
    console.log(`${id}_${key}: ${clip.n} frames ${clip.loop ? "loop" : ""}  ${rep.join("  |  ")}`);
    const res = renderFrames({
      actors: [{ agent, poses: sel.map((i) => clip.poses[i]) }], view, size, frames: sel.length, labelScale: 1,
      label: (f) => `${id} ${key} ${sel[f]}${hits.some((h) => sel[f] >= h.from && sel[f] <= h.to) ? " HIT" : ""}`,
      extra: (R, f) => {
        const fi = sel[f];
        const j = jointsOf(clip.poses[fi]);
        const P = (n) => { const v = j[JOINTS.indexOf(n)]; return [v[0] * FU, 0, v[1] * FU]; };
        for (const h of hits) {
          if (fi < h.from || fi > h.to || JOINTS.indexOf(h.tip) < 0) continue;
          let p = P(h.tip);
          if (h.tip === "fT" || h.tip === "bT") { const a = P(h.tip[0] + "A"); p = [a[0] + (p[0] - a[0]) * 0.75, 0, a[2] + (p[2] - a[2]) * 0.75]; }
          R.circle3([p[0], 0, p[2]], h.r * FU / ch.scale, [1, 0, 0], [0, 0, 1], [255, 80, 60]);
        }
        if (flag("hurt")) for (const [a, b] of [["P", "N"], ["S", "fE"], ["fE", "fW"], ["S", "bE"], ["bE", "bW"], ["P", "fK"], ["fK", "fA"], ["fA", "fT"], ["P", "bK"], ["bK", "bA"], ["bA", "bT"]]) {
          const pa = P(a), pb = P(b); R.line([pa[0], 0, pa[2]], [pb[0], 0, pb[2]], [90, 220, 255]);
        }
      },
    });
    sheets.push({ id, key, res, sel });
    if (opt("mp4")) writeMP4(renderFrames({ actors: [{ agent, poses: clip.poses }], view, size, frames: clip.n, labelScale: 1, label: (f) => `${id} ${key} ${f}` }), opt("mp4").replace(".mp4", `_${id}_${key}.mp4`), 32);
  }
}
if (opt("out")) {
  const cols = +opt("cols", 8);
  const frames = [];
  for (const s of sheets) { for (const fr of s.res.frames) frames.push(fr); while (frames.length % cols) frames.push(new Uint8Array(size[0] * size[1] * 3)); }
  writeSheet({ W: size[0], H: size[1], frames }, opt("out"), { cols });
  console.log("wrote", opt("out"));
}
