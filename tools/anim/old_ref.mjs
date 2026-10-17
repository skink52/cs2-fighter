// Records what the previous (2D pose) system did, frame by frame, so the new 3D clips can be
// held to the same reach and timing: hit tips, hurt capsules and body top for every move and
// state of every fighter, relative to the fighter's ground point, facing right.
// Usage: node tools/anim/old_ref.mjs <core_node.mjs of the old system> <out.json>
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const corePath = path.resolve(process.argv[2]);
const outPath = process.argv[3];
const C = await import(url.pathToFileURL(corePath).href);
const { Game, CHARACTERS, IN } = C;

const r1 = (v) => Math.round(v * 10) / 10;
function snap(f) {
  const tips = {};
  for (const [k, t] of Object.entries(f.tips)) tips[k] = [r1((t.x - f.x) * f.facing), r1(t.y - f.y)];
  const hurt = f.hurt.map((c) => [r1((c[0] - f.x) * f.facing), r1(c[1] - f.y), r1((c[2] - f.x) * f.facing), r1(c[3] - f.y), r1(c[4])]);
  return { x: r1(f.x), y: r1(f.y), tips, hurt, top: r1(f.top - f.y), state: f.state };
}

function setup(ci) {
  const g = new Game({ seed: 7, halfWidth: 2000, cfg: { mode: "duel" } });
  g.seatHuman(0, "a", "A"); g.seatHuman(1, "b", "B");
  g.fighters[0].setCharacter(ci); g.fighters[1].setCharacter(0);
  g.forceStart();
  for (let i = 0; i < 64 * 20 && g.phase !== "fight"; i++) g.step();
  g.step(); g.step();
  const f = g.fighters[0], o = g.fighters[1];
  f.x = 0; f.y = 0; f.vx = 0; f.vy = 0; f.facing = 1; f.state = "idle"; f.move = null;
  o.x = 1500; o.y = 0; o.state = "idle"; o.move = null;
  return { g, f };
}

const out = { note: "old 2D system, FU, x forward from the fighter's ground point, y up", fighters: {} };
for (let ci = 0; ci < CHARACTERS.length; ci++) {
  const ch = CHARACTERS[ci];
  const rec = (out.fighters[ch.id] = { moves: {}, states: {} });
  for (const id of Object.keys(ch.moves)) {
    const { g, f } = setup(ci);
    const m = ch.moves[id];
    if (m.air) { f.y = 120; f.vy = 0; f.state = "air"; }
    f.startMove(id);
    const frames = [];
    for (let t = 0; t <= m.total + 2 && f.move === m; t++) {
      if (m.air) { f.y = 120; f.vy = 0; }
      f.step();
      if (m.air) { f.y = 120; f.vy = 0; }
      f.animate();
      frames.push(Object.assign({ f: f.mf }, snap(f)));
      g.frame++;
    }
    rec.moves[id] = { total: m.total, hits: m.hits.map((h) => ({ from: h.from, to: h.to, tip: h.tip, r: h.r, level: h.level })), frames };
  }
  // states: hold the input for a while and take the settled pose
  const holds = { idle: 0, crouch: IN.DOWN, block: IN.BLOCK, cblock: IN.BLOCK | IN.DOWN, walkf: IN.RIGHT, walkb: IN.LEFT };
  for (const [name, mask] of Object.entries(holds)) {
    const { g, f } = setup(ci);
    const samples = [];
    for (let i = 0; i < 90; i++) { f.setInput(mask, 0); g.step(); f.x = 0; if (i >= 30 && i % 6 === 0) samples.push(snap(f)); }
    rec.states[name] = samples;
  }
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.log("wrote", outPath, (fs.statSync(outPath).size / 1e3).toFixed(0) + " KB");
