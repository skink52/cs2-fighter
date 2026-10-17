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

## 18 Oct 02:55 resume (Zach 22:56: floating knockdowns, auto recovery, accurate falls, air dodge / combo break)
- CAUSE of the glide: `airborne` was `y > 0.01 || vy > 0.01`. A falling body whose y landed in (0, 0.01] stopped
  counting as airborne: no gravity, no landing, stuck in "launch" sliding with vx forever (any fighter).
  Fix (core_3_fighter physics): airborne = y > 0 || vy > 0, a "launch" state always runs air physics, AIR_TIMEOUT
  150 frames forces the body down. Probe: scratchpad/kd/probe.mjs (0 stuck in 6x300 s; was 107 events).
- Falls re-keyed (tools/anim/falls.mjs, posture keys): launch / launchhold laid back with both feet up (lowest point =
  back/hips, never a lone foot), down/downko flat on the back, getup sit-up -> crouch -> stance. Library uses
  FALL_ANIMS before STATE_ANIMS.
- pose.mjs: footOnShin (foot set on the shin), footAngles, limitAnkles (airborne feet held to toes up 25 / pointed 60 /
  turn 25 / roll 25). Clip.finish() runs limitAnkles on every clip. posture(): pelvis.spin, feet.rel.
- BREAK meter (core_3 BREAK const; start 30, +3.5/s, +0.5 per damage). Punch+kick together (3 frames):
  full meter in hitstun/launch = combo break ("burst" state, 34 invuln, Game.onBreak shoves enemies within 95 into
  blockstun, fx "break", callout BREAK); half meter in a jump = air dodge (once per jump, toward/away).
  Air attacks wait 2 frames for the second button. CPU: L.burst/L.dodge. HUD: violet strip at the bottom of each
  health bar (make_hud.py .Brk/.BrkFill, card classes stBrkHalf/stBrkFull), status "BREAK READY", footer
  "MOUSE1+2 break". New clips burst, airdodgef, airdodgeb (196 clips). Tests added in test/mechanics.mjs.
- NEXT: joint fixes from Zach's review attachment (see summary list), sheets, balance, deliver (script, xml, css,
  rig vmdl + anims zip), README controls + BREAK, project doc.

## 18 Oct ~04:05: joint pass + v2.1.0 delivered
- post.mjs ik2 is now a HINGE IK for leg/arm chains (HINGE_LOCAL from bind: legs = hips' left-right axis, arms = bind
  elbow bend): knees/elbows can't bend backwards or sideways. Knee floor limit (KNEE_FLOOR 3.2: knee swings out).
  PB_FREE_IK=1 env switches back to the old free IK for comparisons. armsOutOfBody() in Clip.finish pushes hands /
  elbows / forearms out of head (r 7.2) and torso (r 7) and re-solves. limitAnkles in finish.
- tools/anim/validate.mjs [fighter|all] [keys]: joint checker (knee/elbow hinge, thigh flex/abduction/twist vs hips,
  airborne ankle range, limbs inside head/torso). ~120 low-severity notes remain, mostly deep crouch thigh flexion,
  sweep leg external rotation, dancer high kicks (by design).
- posture.mjs: completeSpec / sampleSpecs (every key has every channel; knee/elbow poles read off the IK's result).
- posed_moves.mjs: sweep (new keys with explicit knee poles), lowSweepKeys for rootSweep/gearGrind/plieSweep (sit back
  on the rear leg, lead leg drives out along the floor), fouetteKeys (rising kick then full spin in the air).
- specials.mjs: risingSplinter fist on a forward diagonal; pistonStomp stands taller. mocap: roundhouse supportDx -11 +
  turn {deg 22, from 8, to 15}; kickMid arm keep 0.7; every mocap move aims the head at [90,0,52].
- Balance (600 s x3): L0 58/68/38/35, L1 54/57/45/43, L2 43/40/51/66 (T/B/P/M). Stats: TIMBER dmg 1.03, BRASS hp 115
  dmg 1.15, PIROUETTE hp 108, MOTLEY hp 90 dmg 0.91. Hard CPU favours Motley (cartwheel/juggle); normal is fine.
- DELIVERED v2.1.0 (all sha1-verified on the PC): scripts/puppet_brawl.js, panorama xml + css, rig/pb_rig.vmdl,
  rig/pb_rig_anims_v3c.zip (Zach extracts into rig/, replaces anims), PUPPET_BRAWL_README.md (build steps, BREAK).
  Review sheets sent: scratchpad/rv/r1_falls_break.png, r2_timber.png, r3_specials.png.
- NEXT: Zach's in-game test of v2.1.0; his notes on the sheets.

## 18 Oct 07:18 polish pass (Zach: "spend another 30 mins on polish"; resume reminder 08:00 trig_01HsCE5jWfjzffQkTbJiJyvx)
- DONE (uncommitted until noted): post.mjs limitHips (airborne thigh flexion <= 148, Jester Drop leg no longer in the
  collarbone), stances.mjs `wrist` bend for PIROUETTE (-14) and MOTLEY (-24/-22) so guard knuckles sit level/up (stanceSpec,
  idle, walk, keys.mjs applySpec).
- DONE: mocap `lean` option (boilerKick leans back 12 over f7-15, kick steered to z 33), rivetHammer fists 6.4 apart,
  fouette spin keyed as a turning tuck (turnSpec) with the leg held high through the active frames (f16), pratfall knee
  poles + relaxed ankles, sweep transition keys (f5 knee forward, new f15). PIROUETTE dmg 1.14.
- Balance 600 s x3 (T/B/P/M): L0 56/70/42/31, L1 55/53/47/45, L2 47/38/55/61. All tests pass.
- v2.1.1 packaged at /mnt/user-data/outputs/pb_v211 (puppet_brawl.js, pb_rig_anims_v3d.zip, README; pb_rig.vmdl
  unchanged from v2.1.0). PC was NOT connected at 07:31, so the files were sent to Zach in chat; if the bridge is up later,
  write puppet_brawl.js -> scripts/, the zip -> models/puppet_brawl/rig/, README -> addon root, then verify by re-staging.
