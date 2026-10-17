// Offline preview of the arena built by tools/arena.py: the map's boxes, stock props (meshes read
// from the game's model files, flat colours), the custom pb_* props (their SMDs and textures), all lit
// by the map's own lights with distance fog, seen from the fight camera with two fighters on stage.
//   node tools/arena_preview.mjs <scene.json> <out.png> [--size 960x540] [--exposure 1] [--views 0,1,4]
//        [--cols 2] [--props dir] [--agents dir] [--addon dist/addon]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { extractProp } from "./s2/prop_mesh.mjs";
import { Renderer, loadAgent, agentBones } from "./anim/render.mjs";
import { v3, q, xf } from "./anim/m3.mjs";
import { readSMD } from "./anim/smd.mjs";
import { writeSheet, AGENTS as AGENT_FILES } from "./anim/preview.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const scene = JSON.parse(fs.readFileSync(args[0], "utf8"));
const out = args[1];
const PROPS = opt("props", "/tmp/claude-0/props");
const AGENTS = opt("agents", "/tmp/claude-0/agentmesh");
const ADDON = opt("addon", path.join(here, "..", "dist", "addon"));
const ANIMS = path.join(ADDON, "models", "puppet_brawl", "rig", "anims");
const [W, H] = opt("size", "960x540").split("x").map(Number);
const EXPOSURE = +opt("exposure", 1);
const RAD = Math.PI / 180;

// ------------------------------------------------------------------ stock materials (flat colours)
const MAT = [
  ["toolsskybox", null], ["toolsplayerclip", null],
  ["selfillum", [0.9, 0.75, 0.5], [1.0, 0.72, 0.42]], ["glassblock", [0.7, 1, 0.9], [0.5, 1, 0.8]],
  ["glass_opaque", [0.08, 0.1, 0.13]], ["asphalt", [0.13, 0.13, 0.15]], ["slabs", [0.2, 0.2, 0.22]],
  ["inferno_wood", [0.42, 0.27, 0.15]], ["paint_red", [0.55, 0.1, 0.08]], ["brick_ext", [0.42, 0.22, 0.17]], ["brick_clean", [0.48, 0.3, 0.24]],
  ["stucco", [0.55, 0.52, 0.46]], ["concrete_wall_004", [0.4, 0.4, 0.4]], ["concrete_wall", [0.45, 0.45, 0.45]], ["floor_001_black", [0.05, 0.05, 0.06]],
  ["floor_001_dark", [0.16, 0.16, 0.18]], ["floor_05", [0.32, 0.32, 0.33]], ["corrugated_001_blue", [0.2, 0.3, 0.45]], ["metal_corrugated", [0.4, 0.4, 0.4]],
  ["painted_metal", [0.2, 0.22, 0.24]], ["panel", [0.3, 0.3, 0.32]], ["tile", [0.6, 0.6, 0.62]], ["plaster_01_gold", [0.72, 0.55, 0.24]],
];
function matColor(name) {
  for (const [k, c, e] of MAT) if (name.includes(k)) return c ? { c, e: e || null } : null;
  return { c: [0.8, 0, 0.8], e: null };
}
const PROP_COL = { car: [0.35, 0.08, 0.06], bin: [0.12, 0.25, 0.14], drum: [0.25, 0.15, 0.1], crate: [0.35, 0.3, 0.2], pallet: [0.4, 0.3, 0.2], bag: [0.06, 0.06, 0.07],
  hvac: [0.45, 0.46, 0.46], ac_unit: [0.7, 0.7, 0.68], awning: [0.5, 0.12, 0.1], dish: [0.75, 0.75, 0.75], chimney: [0.3, 0.25, 0.22], lamp: [0.2, 0.2, 0.2],
  fluorescent: [0.9, 0.95, 1], vent: [0.4, 0.42, 0.44], tire: [0.05, 0.05, 0.05], bench: [0.35, 0.25, 0.15], bike: [0.15, 0.2, 0.3] };

// ------------------------------------------------------------------ textures and the custom props
const texCache = new Map();
function loadPNG(rel, gray = false) {
  const file = path.join(ADDON, rel), key = file + (gray ? ":g" : "");
  if (texCache.has(key)) return texCache.get(key);
  let t = null;
  if (fs.existsSync(file)) {
    const head = fs.readFileSync(file).subarray(0, 32);
    const w = head.readUInt32BE(16), h = head.readUInt32BE(20);
    const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", gray ? "gray" : "rgb24", "-"], { maxBuffer: 1 << 28 });
    t = { w, h, c: gray ? 1 : 3, d: new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length) };
  }
  texCache.set(key, t);
  return t;
}
function loadVmat(rel) {
  const file = path.join(ADDON, rel);
  if (!fs.existsSync(file)) return { tex: null, illum: null, bright: 0, tint: [1, 1, 1] };
  const s = fs.readFileSync(file, "utf8");
  const str = (k) => { const m = s.match(new RegExp(k + '\\s+"([^"]+)"')); return m ? m[1] : null; };
  const vec = (k) => { const m = s.match(new RegExp(k + '\\s+"\\[([^\\]]+)\\]"')); return m ? m[1].trim().split(/\s+/).map(Number) : null; };
  const color = str("TextureColor"), illum = str("TextureSelfIllumMask");
  return {
    tex: color ? loadPNG(color) : null,
    illum: illum && /F_SELF_ILLUM 1/.test(s) ? loadPNG(illum, true) : null,
    bright: +(str("g_flSelfIllumBrightness") || 0),
    tint: (vec("g_vSelfIllumTint") || [1, 1, 1]).slice(0, 3),
  };
}
const pbCache = new Map();
function loadPB(name) {
  if (pbCache.has(name)) return pbCache.get(name);
  const smdFile = path.join(ADDON, "models/puppet_brawl/props", name + ".smd");
  let res = null;
  if (fs.existsSync(smdFile)) {
    const remap = {};
    const vmdlFile = smdFile.replace(/\.smd$/, ".vmdl");
    if (fs.existsSync(vmdlFile)) for (const m of fs.readFileSync(vmdlFile, "utf8").matchAll(/from = "([^"]+)\.vmat"\s*to = "([^"]+)"/g)) remap[m[1]] = m[2];
    const lines = fs.readFileSync(smdFile, "utf8").split(/\r?\n/);
    let i = lines.indexOf("triangles") + 1;
    const groups = new Map();
    while (i < lines.length && lines[i].trim() !== "end" && lines[i].trim() !== "") {
      const mat = lines[i].trim();
      if (!groups.has(mat)) groups.set(mat, { P: [], N: [], UV: [] });
      const g = groups.get(mat);
      for (let k = 1; k <= 3; k++) {
        const v = lines[i + k].trim().split(/\s+/).map(Number);
        // the SMD writer turned positions to (y, -x, z) and flipped v for ModelDoc: undo both
        g.P.push(-v[2], v[1], v[3]); g.N.push(-v[5], v[4], v[6]); g.UV.push(v[7], 1 - v[8]);
      }
      i += 4;
    }
    res = [...groups].map(([mat, g]) => ({
      P: Float32Array.from(g.P), N: Float32Array.from(g.N), UV: Float32Array.from(g.UV),
      I: Uint32Array.from({ length: g.P.length / 3 }, (_, k) => k), mat: loadVmat(remap[mat] || `materials/puppet_brawl/props/${mat}.vmat`),
    }));
  } else console.warn("no custom prop", name, "- run tools/make_props.py");
  pbCache.set(name, res);
  return res;
}

// ------------------------------------------------------------------ geometry
const draws = [];   // flat: {P, N, I, c, e}; textured: {P, N, UV, I, mat}
function addQuadGrid(a, b, c, d, n, col, cell = 24) {
  // quad a-b-c-d split into cells so the per-vertex lighting has resolution
  const nu = Math.max(1, Math.ceil(v3.dist(a, b) / cell)), nv = Math.max(1, Math.ceil(v3.dist(a, d) / cell));
  const P = [], N = [], I = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p0 = v3.lerp(a, b, i / nu), p1 = v3.lerp(d, c, i / nu);
    P.push(...v3.lerp(p0, p1, j / nv)); N.push(...n);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * (nu + 1) + i;
    I.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1);
  }
  draws.push({ P: Float32Array.from(P), N: Float32Array.from(N), I: Uint32Array.from(I), c: col.c, e: col.e });
}
function addBox(lo, hi, mats) {
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
  const faces = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], mats.top],
    [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1], mats.bottom],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], mats.front],
    [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [0, 1, 0], mats.back],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], mats.side],
    [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0], mats.side],
  ];
  for (const [a, b, c, d, n, m] of faces) {
    const col = matColor(m);
    if (col) addQuadGrid(a, b, c, d, n, col);
  }
}
for (const b of scene.boxes) addBox(b.min, b.max, b.mats);
for (const m of scene.meshes) {
  for (const [loop, mat] of m.faces) {
    const col = matColor(mat);
    if (!col) continue;
    const pts = loop.map((i) => m.verts[i]);
    const n = v3.norm(v3.cross(v3.sub(pts[1], pts[0]), v3.sub(pts[2], pts[0])));
    if (pts.length === 4) addQuadGrid(pts[0], pts[1], pts[2], pts[3], n, col);
    else {
      const I = [];
      for (let k = 1; k < pts.length - 1; k++) I.push(0, k, k + 1);
      draws.push({ P: Float32Array.from(pts.flat()), N: Float32Array.from(pts.map(() => n).flat()), I: Uint32Array.from(I), c: col.c, e: col.e });
    }
  }
}
function propXf(p) {
  // Hammer angles (pitch, yaw, roll): roll about X, then pitch about Y, then yaw about Z
  const [pitch, yaw, roll] = p.angles;
  return { r: q.mul(q.axisAngle([0, 0, 1], yaw * RAD), q.mul(q.axisAngle([0, 1, 0], pitch * RAD), q.axisAngle([1, 0, 0], roll * RAD))), o: p.origin, s: p.scales || [1, 1, 1] };
}
function placed(P0, N0, x) {
  const n = P0.length / 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = q.rotate(x.r, [P0[i * 3] * x.s[0], P0[i * 3 + 1] * x.s[1], P0[i * 3 + 2] * x.s[2]]);
    const nn = v3.norm(q.rotate(x.r, [N0[i * 3] / x.s[0], N0[i * 3 + 1] / x.s[1], N0[i * 3 + 2] / x.s[2]]));
    P[i * 3] = v[0] + x.o[0]; P[i * 3 + 1] = v[1] + x.o[1]; P[i * 3 + 2] = v[2] + x.o[2];
    N[i * 3] = nn[0]; N[i * 3 + 1] = nn[1]; N[i * 3 + 2] = nn[2];
  }
  return { P, N };
}
function smoothNormals(P, I) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const ia = I[t] * 3, ib = I[t + 1] * 3, ic = I[t + 2] * 3;
    const n = v3.cross(v3.sub([P[ib], P[ib + 1], P[ib + 2]], [P[ia], P[ia + 1], P[ia + 2]]), v3.sub([P[ic], P[ic + 1], P[ic + 2]], [P[ia], P[ia + 1], P[ia + 2]]));
    for (const i of [ia, ib, ic]) { N[i] += n[0]; N[i + 1] += n[1]; N[i + 2] += n[2]; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}
const stockCache = new Map();
async function stockMesh(model) {
  if (stockCache.has(model)) return stockCache.get(model);
  const file = path.join(PROPS, model.split("/").pop() + "_c");
  let m = null;
  if (fs.existsSync(file)) m = (await extractProp(fs.readFileSync(file))).meshes.map((mm) => (mm.flatNormals ? { ...mm, N: smoothNormals(mm.P, mm.I) } : mm));
  else console.warn("no mesh for", model);
  stockCache.set(model, m);
  return m;
}
for (const p of scene.props) {
  const x = propXf(p);
  const name = p.model.split("/").pop().replace(".vmdl", "");
  if (name.startsWith("pb_")) {
    for (const g of loadPB(name) || []) { const t = placed(g.P, g.N, x); draws.push({ P: t.P, N: t.N, UV: g.UV, I: g.I, mat: g.mat }); }
    continue;
  }
  const ms = await stockMesh(p.model);
  if (!ms) continue;
  const key = Object.keys(PROP_COL).find((k) => name.includes(k));
  let c = key ? PROP_COL[key] : [0.5, 0.5, 0.5];
  if (p.color) c = c.map((v, i) => v * p.color[i] / 255);
  for (const mm of ms) { const t = placed(mm.P, mm.N, x); draws.push({ P: t.P, N: t.N, I: mm.I, c, e: name.includes("fluorescent") ? [1, 1, 1] : null }); }
}

// fighters at the duel start marks (110 fighter units = 79 world units out), first frame of their
// idle; the one facing left turns round and plays the mirrored clip, as in the game
for (const [k, id] of ["timber", "motley"].entries()) {
  const f = path.join(AGENTS, AGENT_FILES[id] + ".json"), clip = path.join(ANIMS, `${id}_idle${k ? "_m" : ""}.smd`);
  if (!fs.existsSync(f) || !fs.existsSync(clip)) { console.warn("no fighter", id); continue; }
  const agent = loadAgent(f), pose = readSMD(clip)[0];
  const actor = { q: q.axisAngle([0, 0, 1], (k ? 180 : 0) * RAD), p: [k ? 79 : -79, 0, 24] };
  const bones = agentBones(agent, pose, { q: actor.q, p: [0, 0, 0] });
  const mats = bones.map((wb, i) => { const t = xf.mul(wb, agent.invBind[i]); return [q.toMat(t.q), t.p]; });
  for (const part of agent.parts) {
    const nv = part.P.length / 3, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const vx = part.P[i * 3], vy = part.P[i * 3 + 1], vz = part.P[i * 3 + 2], nx = part.N[i * 3], ny = part.N[i * 3 + 1], nz = part.N[i * 3 + 2];
      let ox = 0, oy = 0, oz = 0, mx = 0, my = 0, mz = 0;
      for (let j = 0; j < 4; j++) {
        const wgt = part.W[i * 4 + j];
        if (wgt <= 0) continue;
        const [m, t] = mats[part.J[i * 4 + j]];
        ox += wgt * (m[0] * vx + m[1] * vy + m[2] * vz + t[0]); oy += wgt * (m[3] * vx + m[4] * vy + m[5] * vz + t[1]); oz += wgt * (m[6] * vx + m[7] * vy + m[8] * vz + t[2]);
        mx += wgt * (m[0] * nx + m[1] * ny + m[2] * nz); my += wgt * (m[3] * nx + m[4] * ny + m[5] * nz); mz += wgt * (m[6] * nx + m[7] * ny + m[8] * nz);
      }
      P[i * 3] = actor.p[0] + ox; P[i * 3 + 1] = actor.p[1] + oy; P[i * 3 + 2] = actor.p[2] + oz;
      const l = Math.hypot(mx, my, mz) || 1;
      N[i * 3] = mx / l; N[i * 3 + 1] = my / l; N[i * 3 + 2] = mz / l;
    }
    draws.push({ P, N, I: part.I, c: part.color.map((v) => v * 1.4), e: null, actor: true });
  }
}
console.log("draw lists", draws.length, "triangles", draws.reduce((a, d) => a + d.I.length / 3, 0));

// ------------------------------------------------------------------ lighting
const lights = scene.lights.map((l) => {
  const [pitch, yaw] = l.angles;
  const dir = [Math.cos(pitch * RAD) * Math.cos(yaw * RAD), Math.cos(pitch * RAD) * Math.sin(yaw * RAD), -Math.sin(pitch * RAD)];
  const spot = l.cone < 180;
  return { p: l.origin, c: l.color.map((v) => v / 255), k: l.lumens / 1800, r: l.range, dir, cos: spot ? Math.cos(l.cone * RAD) : -2, cosIn: spot ? Math.cos(l.cone * 0.75 * RAD) : -2 };
});
const AMB = [0.035, 0.04, 0.07];
const MOON = v3.norm([0.35, -0.5, 0.78]);
function light(P, N, i, out) {
  const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
  let r = AMB[0], g = AMB[1], b = AMB[2];
  const md = 0.18 * Math.max(0, nx * MOON[0] + ny * MOON[1] + nz * MOON[2]);
  r += md * 0.45; g += md * 0.5; b += md * 0.85;
  for (const L of lights) {
    const dx = L.p[0] - px, dy = L.p[1] - py, dz = L.p[2] - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > L.r * L.r) continue;
    const d = Math.sqrt(d2) || 1;
    const ndl = (nx * dx + ny * dy + nz * dz) / d;
    if (ndl <= 0) continue;
    let spot = 1;
    if (L.cos > -1) {
      const c = -(L.dir[0] * dx + L.dir[1] * dy + L.dir[2] * dz) / d;
      if (c < L.cos) continue;
      spot = Math.min(1, (c - L.cos) / Math.max(1e-3, L.cosIn - L.cos));
    }
    const win = Math.pow(Math.max(0, 1 - (d / L.r) ** 4), 2);
    const att = (L.k * 8000) / (d2 + 2000) * win * spot * ndl;
    r += L.c[0] * att; g += L.c[1] * att; b += L.c[2] * att;
  }
  out[0] = r * EXPOSURE; out[1] = g * EXPOSURE; out[2] = b * EXPOSURE;
}

// ------------------------------------------------------------------ rasterising
const tone = (v) => (v / (1 + v)) * 255;
function project(R, P) {
  const c = R.cam, nv = P.length / 3, sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const dx = P[i * 3] - c.eye[0], dy = P[i * 3 + 1] - c.eye[1], dz = P[i * 3 + 2] - c.eye[2];
    const z = dx * c.f[0] + dy * c.f[1] + dz * c.f[2];
    sz[i] = z;
    if (z < 1) { sx[i] = NaN; continue; }
    sx[i] = R.w / 2 + (dx * c.r[0] + dy * c.r[1] + dz * c.r[2]) * c.k / z;
    sy[i] = R.h / 2 - (dx * c.u[0] + dy * c.u[1] + dz * c.u[2]) * c.k / z;
  }
  return { sx, sy, sz };
}
// shade(o, a, b, c, p0, p1, p2): writes the pixel; p* are perspective-correct weights
function raster(R, P, I, shade) {
  const { w, h } = R, { sx, sy, sz } = project(R, P), zb = R.z;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], cc = I[t + 2];
    const ax = sx[a], bx = sx[b], cx = sx[cc];
    if (Number.isNaN(ax) || Number.isNaN(bx) || Number.isNaN(cx)) continue;
    const ay = sy[a], by = sy[b], cy = sy[cc];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x0 > x1 || y0 > y1) continue;
    const ia = 1 / area, za = 1 / sz[a], zbv = 1 / sz[b], zc = 1 / sz[cc];
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * ia;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * ia;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const q0 = w0 * za, q1 = w1 * zbv, q2 = w2 * zc, s = q0 + q1 + q2;
        const depth = 1 / s, o = y * w + x;
        if (depth >= zb[o]) continue;
        zb[o] = depth;
        shade(o, a, b, cc, q0 / s, q1 / s, q2 / s);
      }
    }
  }
}
function sample(t, u, v, out) {
  // bilinear, clamped
  const fx = Math.min(Math.max(u, 0), 1) * (t.w - 1), fy = Math.min(Math.max(v, 0), 1) * (t.h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(t.w - 1, x0 + 1), y1 = Math.min(t.h - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
  for (let k = 0; k < t.c; k++) {
    const p00 = t.d[(y0 * t.w + x0) * t.c + k], p10 = t.d[(y0 * t.w + x1) * t.c + k], p01 = t.d[(y1 * t.w + x0) * t.c + k], p11 = t.d[(y1 * t.w + x1) * t.c + k];
    out[k] = ((p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay) / 255;
  }
}

function render(view) {
  const R = new Renderer(W, H);
  R.clear([8, 8, 14], [14, 12, 20]);
  R.camera(view.eye, view.at, view.fov);
  const fog = { start: 120, end: 2600, max: 0.55, c: [24, 18, 34] };
  const eye = R.cam.eye, rgb = R.rgb, tmp = [0, 0, 0], tc = [0, 0, 0], ti = [0];
  for (const d of draws) {
    const n = d.P.length / 3, L = new Float32Array(n * 3), F = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      light(d.P, d.N, i, tmp);
      L[i * 3] = tmp[0]; L[i * 3 + 1] = tmp[1]; L[i * 3 + 2] = tmp[2];
      const dist = Math.hypot(d.P[i * 3] - eye[0], d.P[i * 3 + 1] - eye[1], d.P[i * 3 + 2] - eye[2]);
      F[i] = Math.min(1, Math.max(0, (dist - fog.start) / (fog.end - fog.start))) * fog.max;
    }
    if (d.mat) {
      const m = d.mat, UV = d.UV, eb = m.illum ? m.bright * 0.9 : 0;
      raster(R, d.P, d.I, (o, a, b, c, p0, p1, p2) => {
        const u = p0 * UV[a * 2] + p1 * UV[b * 2] + p2 * UV[c * 2], v = p0 * UV[a * 2 + 1] + p1 * UV[b * 2 + 1] + p2 * UV[c * 2 + 1];
        if (m.tex) sample(m.tex, u, v, tc); else { tc[0] = tc[1] = tc[2] = 0.5; }
        let e = 0;
        if (eb) { sample(m.illum, u, v, ti); e = ti[0] * eb; }
        const t = p0 * F[a] + p1 * F[b] + p2 * F[c], oo = o * 3;
        for (let k = 0; k < 3; k++) {
          const l = p0 * L[a * 3 + k] + p1 * L[b * 3 + k] + p2 * L[c * 3 + k];
          rgb[oo + k] = tone(tc[k] * (l + e * m.tint[k])) * (1 - t) + fog.c[k] * t;
        }
      });
    } else {
      const C = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
        const v = d.c[k] * L[i * 3 + k] + (d.e ? d.e[k] * 0.9 : 0);
        C[i * 3 + k] = tone(v) * (1 - F[i]) + fog.c[k] * F[i];
      }
      raster(R, d.P, d.I, (o, a, b, c, p0, p1, p2) => {
        const oo = o * 3;
        rgb[oo] = p0 * C[a * 3] + p1 * C[b * 3] + p2 * C[c * 3];
        rgb[oo + 1] = p0 * C[a * 3 + 1] + p1 * C[b * 3 + 1] + p2 * C[c * 3 + 1];
        rgb[oo + 2] = p0 * C[a * 3 + 2] + p1 * C[b * 3 + 2] + p2 * C[c * 3 + 2];
      });
    }
  }
  if (!args.includes("--nolabel")) R.text(6, 6, view.label, [240, 230, 200], 2);
  return R.rgb;
}

// The fight camera (cs2_adapter cameraTransform): 78 fighter units up, aiming at 56, pulled back so the
// fighters' spread fits a 106 degree (16:9) view; 0.72 world units per fighter unit, stage top at z 24.
const FU = 0.72, VFOV = 2 * Math.atan(Math.tan(53.13 * RAD) * 9 / 16) / RAD;
const CAM_H = +opt("cam-height", 78), CAM_LOOK = +opt("cam-look", 56);
const fight = (cx, distFU, label) => ({ label, eye: [cx, -distFU * FU, 24 + CAM_H * FU], at: [cx, 0, 24 + CAM_LOOK * FU], fov: VFOV });
const VIEWS = [
  fight(0, 154, "FIGHT CAMERA - ROUND START"),
  fight(0, 136, "FIGHT CAMERA - CLOSE"),
  fight(288, 160, "FIGHT CAMERA - PANNED RIGHT"),
  fight(-288, 160, "FIGHT CAMERA - PANNED LEFT"),
  { label: "FROM THE PADS", eye: [0, -720, 144], at: [0, 0, 70], fov: VFOV },
  { label: "OVERVIEW", eye: [-760, -760, 640], at: [0, 140, 60], fov: 60 },
];
const pick = opt("views", null);
let views = pick ? pick.split(",").map((i) => VIEWS[+i]) : VIEWS;
// extra cameras: --look "x,y,z>x,y,z[@fov];..." (eye > target)
if (opt("look", null)) views = opt("look").split(";").map((v, i) => {
  const [e, rest] = v.split(">"), [a, f] = rest.split("@");
  return { label: "VIEW " + (i + 1), eye: e.split(",").map(Number), at: a.split(",").map(Number), fov: f ? +f : 50 };
});
const frames = views.map(render);
writeSheet({ W, H, frames }, out, { cols: +opt("cols", Math.min(2, views.length)) });
console.log("wrote", out);
