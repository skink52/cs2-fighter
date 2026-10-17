// Runs the whole build in order: the core (for the move table the animation builder reads),
// every animation clip and its baked tracks, then the core again with the tracks embedded.
// Usage: node tools/make.mjs [--skip-anim]
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const run = (...args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error("failed:", args.join(" ")); process.exit(r.status || 1); }
};
run("tools/build.mjs");
if (!process.argv.includes("--skip-anim")) {
  run("tools/anim/build.mjs");
  run("tools/build.mjs");
}
