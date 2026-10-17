# Puppet Brawl animation rebuild (v3) - working notes

Request (Zach, 17 Oct 21:55): limbs squished together, hands curled over and shrimpy, legs odd, sweep
barely gets past the body, no fighter info after pressing E. Redo every move: natural, accurate,
hitboxes following. Send review images. Free-licence models allowed if agents don't work.

## Done
- HUD: compile error "root panel with id" (CS2 kept the 14 Oct vxml). make_hud.py now wraps pb_game
  in `<Panel class="PBRoot">`. Fixed xml+css written to the PC (22:16); Zach to rerun:
  resourcecompiler.exe -f -i ...\panorama\layout\custom_game\puppet_brawl.xml
- Diagnosis: the in-game problems are our animation design, not the engine (offline render of the
  old idle shows claw hands with bent wrists, hunched profile stance, sitting sweep).
- tools/anim/hands.mjs: real hand shapes (fist with fitted thumb wrap, tight, relaxed, open, chop,
  claw). Clip.finish() uses them (clip.mjs handShape: number 0..1 = relaxed..fist).
- tools/anim/posture.mjs: pose from spec on the bind pose; setHand keeps the wrist straight and rolls
  the palm to a direction.
- tools/anim/stances.mjs: new open stances for all 4 (hips yawed -38..-50 toward the camera, chest
  back +8..16, wide feet, palms), cheat now 0. Old file: scratchpad stances_v2.mjs.
- keys.mjs applySpec: straight wrists by default (setHand with the stance palm), aim blends on top.
- tools/anim/mocap_move.mjs: CMU cut -> aim along +X -> place (support foot or pelvis) -> retime
  (keys [[gameFrame, takeFrame]], 120 Hz) -> displacement blend in/out of the stance (keep per bone
  group) -> lock support foot -> steerTip -> floorFeet. mocapPoses() is the entry.
- Mocap finds (120 Hz frames): 144_05 R rear-leg in-place kicks (high @804, @2268); 144_09 L rear
  in-place kicks (@1436 mid-high); 135_11 R lead side kicks (@348, @608, @884; L @1312...); 135_07 R
  rear high kick with step (@116); 135_04 rear front kicks with step (@376 R, @584 L); 135_09 lunge
  punches; boxing 13_17/14_01/80_10. Helper scripts in scratchpad/mc (events.mjs, curve.mjs,
  mcview.mjs, mtest.mjs, stance.mjs, fist.mjs).

## Done since (23:20)
- Kicks from mocap for everyone (mocap_specs.mjs SHARED kickMid/longKick/roundhouse; PER timberFall,
  boilerKick, arabesque (05_05 mirrored, hit tip changed to fT in core), cartwheel (88_07, aimBy travel,
  strip)). Sweep re-keyed as postures (posed_moves.mjs). Core: hurt capsule between planted ankles
  (wide stances left a gap the sweep slipped through). Cartwheel dmg 6/6 -> 5/5, r 6.
- Review 1 sent to Zach (stances + Timber normals). v3a delivered 22:32: scripts/puppet_brawl.js and
  models/puppet_brawl/rig/pb_rig_anims_v3a.zip (Zach extracts into rig/, recompiles pb_rig.vmdl).
- Balance (300 s x2, noisy): L1 44/56/51/49, L2 33/32/62/75 before the cartwheel nerf.

- 23:45: Jester Drop from 144_09 (axe kick), Banana Sweep = spin sweep. Review 2 (specials) sent.
  Balance: TIMBER hp 104 dmg 1.05, BRASS hp 109, PIROUETTE dmg 1.10, MOTLEY hp 92, Motley stance raised
  (pelvis 34.5). 600 s x2: L1 51/59/44/47, L2 49/44/47/60 (noise ~5%). Not yet delivered (v3a on PC).

- 22:45 (container clock): Spin Kick keyed as postures (three visible lead-leg kicks). v3b delivered:
  script + models/puppet_brawl/rig/pb_rig_anims_v3b.zip (supersedes v3a zip; Zach told to use v3b).

## Next
1. Wire mocap moves into moves.mjs buildMove (per fighter spec table) for kickMid, longKick,
   roundhouse (+ air kicks from 90_05..07 / 75_16); hand-key a real sweep (deep crouch, rear leg
   straight along the floor reaching far); check jab/straight/uppercut.
2. Specials and states review on the new stance; fix the mechanics test "sweep goes under a block".
3. Review sheets to Zach (game camera), then balance sims (reach changes), tests, delivery as a zip
   of the rig anims + changed files (avoid 9 batches of 50 paths; use fresh stagedPath for resends).
