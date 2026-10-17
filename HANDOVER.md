# Puppet Brawl (mg_cs2_fighter): status and handover, 18 Oct 2026 07:40 Adelaide

Start any new chat about this map here. Fuller history: `claude/puppet_brawl_cs2_polish.md` (this project) and
`NOTES_ANIM_V3.md` on the repo branch.

## Where things are
- **Repo:** github.com/skink52/cs2-fighter.
  - The current branch is **`anim-v3`** (commit 3ea6ca3).
  - `polish` holds v2.0.0. `main` is the 14 Oct delivery.
  - The repo README carries the AI-generated-code disclaimer.
- **Addon on Zach's PC:** `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\content\csgo_addons\mg_cs2_fighter`
- **Current version: v2.1.1.** Every delivered file is on the PC and was checked by sha1 on 18 Oct at 07:40. Delivered files:
  - `scripts/puppet_brawl.js`
  - `models/puppet_brawl/rig/pb_rig_anims_v3d.zip`
  - `PUPPET_BRAWL_README.md`
  - `pb_rig.vmdl` and the panorama xml/css are unchanged since v2.1.0, which delivered them on 18 Oct at 04:10.
- **Not yet built or tested in CS2.** Zach's last in-game test was of v2.0.0, on 17 Oct at about 21:55.

## Zach's next steps (README "Building this version")
1. Close CS2 and Hammer.
2. Extract `pb_rig_anims_v3d.zip` into `models/puppet_brawl/rig/`, replacing the files in `anims/`.
3. Delete the old zips if wanted: v3a, v3b and v3c.
4. Rebuild the rig: run `run_build.bat` with `mg_cs2_fighter` in `C:\source1\cs2port\build_queue.txt`. Or compile `pb_rig.vmdl` directly with `game\bin\win64\resourcecompiler.exe -i ...\rig\pb_rig.vmdl`.
5. Compile the script and the HUD directly with `resourcecompiler.exe -f -i` on:
   - `scripts\puppet_brawl.js`
   - `panorama\layout\custom_game\puppet_brawl.xml`
   - `panorama\styles\custom_game\puppet_brawl.css`

   The asset pre-pass skips all three.
6. Load the map with `map mg_cs2_fighter`. The console must print `v2.1.1`.
7. Run `sv_cheats 1` then `pb_cpu_match` to watch two CPUs fight.

## What v2.1.x contains (since Zach's 17 Oct requests)
- **HUD fix:**
  - CS2 rejected the layout with "root panel with id", so no fighter card showed after pressing E.
  - The layout is now wrapped in a `PBRoot` panel.
- **Animation v3:**
  - New open stances and real hand shapes.
  - CMU motion-capture kicks blended into each stance.
  - Keyed sweep, low sweeps, Fouetté, spin kick, falls and BREAK clips.
  - 196 clips, each with a mirrored twin.
  - Hit and hurt boxes are baked from the same animation.
- **Joints:**
  - Hinge IK for knees and elbows; a knee can't go through the floor.
  - Airborne ankles are held to a natural range.
  - Arms are pushed out of the head and torso.
  - Airborne thighs are limited to 148° flexion.
  - Pirouette and Motley guards get a wrist bend so the knuckles sit level.
  - The joint checker is `node tools/anim/validate.mjs all`. Its remaining notes are mostly low severity: deep crouches and dancer high kicks.
- **Floating knockdown fix:**
  - The cause: `airborne` tested y > 0.01, so a body landing in (0, 0.01] never landed and slid forever.
  - The fix: the test is now y > 0, and the launch state always runs physics.
  - `AIR_TIMEOUT`: anyone in the air for 150 frames is pulled down.
  - Falls land on the back and hips.
- **BREAK meter:**
  - A violet strip at the bottom of each health bar. It starts at 30, gains 3.5 per second and 0.5 per point of damage.
  - MOUSE1+MOUSE2 with a full meter while in hitstun or launched: combo break. A shockwave shoves enemies within 95 units into blockstun, with 34 frames of invulnerability.
  - Half a meter in a jump: air dodge, once per jump.
  - CPUs use it. Covered by tests in `test/mechanics.mjs`.
- **Balance (CPU vs CPU, 600 s × 3 seeds, Timber/Brass/Pirouette/Motley):**

  | CPU level | Timber | Brass | Pirouette | Motley |
  |---|---|---|---|---|
  | Easy | 56 | 70 | 42 | 31 |
  | Normal | 55 | 53 | 47 | 45 |
  | Hard | 47 | 38 | 55 | 61 |

  Stats: TIMBER hp 104 dmg 1.03, BRASS hp 115 dmg 1.15, PIROUETTE hp 108 dmg 1.14, MOTLEY hp 90 dmg 0.91.

## Open items and unknowns
- Everything since v2.0.0 is untested in CS2: animation blending between clips, HUD meter rendering, and the knockdown fix in-engine.
- Hard CPUs favour Motley (cartwheel and juggle ball). Easy CPUs favour Brass.
- Joint-checker notes still open:
  - The Arabesque kicking thigh is flagged as twisted, though it looks fine in renders.
  - The Arabesque support foot strongly dorsiflexed in the front view (Zach's note).
  - Glide and Slapstick hand details (Zach's notes, not re-checked in close-up).
- Orphan old clip SMDs in `rig/anims` (names without a fighter prefix) can be deleted by Zach. Claude can't delete files on the PC.

## Working rules
- **Zach:**
  - Doesn't code: no heavy comments; send only changed files.
  - Hammer stays closed while map files are edited, and the map is backed up first.
  - Builds run from the command line, one at a time.
  - No screen takeover unless Zach says "go".
- **Bridge:**
  - Re-sending a changed file from the same stagedPath can send the old upload. Use a fresh stagedPath, then re-stage and compare sha1.
  - PNGs gain a C2PA chunk on commit, so compare them by pixels.
  - Ship bulk animations as a zip; Zach extracts it.
- **Build:**
  - `node tools/make.mjs`: core, anims, then core again (about 10 s).
  - `python3 tools/make_hud.py dist/addon`.
  - Tests: `node test/mechanics.mjs`, `test/sim_core.mjs`, `test/sim_cs2.mjs`.
  - Balance: `node test/balance.mjs 600 3`.
- **Animation review:**
  - Offline renders on the real agent meshes: `tools/anim/review.mjs`, or the scratch `sheet.mjs` (who, `key:frames`, out, size, cols).
  - Mocap BVHs (CMU, free use) are cached in `/tmp/claude-0/bvh`. That's container-local, so a new session must re-fetch them.
