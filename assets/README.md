# Puppet Brawl for CS2: mg_cs2_fighter

Puppet Brawl is a 2.5D street fighter that runs inside CS2 on a cs_script point_script. You only need the addon; no plugins or server mods.

Up to four players fight on a stage in a rain-soaked neon back street, using CS2 agent models. Everyone else in the map can stand on the bleachers and watch the fight happen live, because it takes place on a real stage in the world. 4 fight and the rest watch.

## What's in the addon

| Path | What it is |
|---|---|
| `maps/mg_cs2_fighter.vmap` | The arena: the stage under a torii gate, a street of shop fronts behind it, side-street shops, festival banners, drinks machines, lantern strings, rain, bleachers, 4 control pads, 9 host buttons, all lights and all game entities |
| `scripts/puppet_brawl.js` | The game. Hammer compiles it to `puppet_brawl.vjs` |
| `models/puppet_brawl/rig/` | `pb_rig.vmdl`: an invisible skeleton holding every animation (184 clips, each with a mirrored twin, SMD files in `anims/`) |
| `models/puppet_brawl/props/` | Neon signs, neon tubes, lanterns, festival banners (`pb_nobori_*`), drinks machines (`pb_vending_*`), pad rings |
| `models/puppet_brawl/pb_proj_*.vmdl`, `pb_fx_*.vmdl`, `pb_ball.vmdl` | Projectiles (TIMBER's knot, BRASS's cog, MOTLEY's juggling ball) and effect shapes (shockwave ring, hit star, trail orb) |
| `materials/puppet_brawl/` | Textures and materials for those props |
| `panorama/layout/custom_game/puppet_brawl.xml`, `panorama/styles/custom_game/puppet_brawl.css` | The fight HUD |
| `soundevents/soundevents_addon.vsndevts` | Your file with the `pb.*` sounds added (18 events, all stock CS2 sounds) |

## The fighters

| Fighter | Agent | Style |
|---|---|---|
| TIMBER | Professional (T) | Balanced brawler, orange |
| BRASS | SWAT (CT), 7% bigger | Slow, heavy, armoured charge, cyan |
| PIROUETTE | FBI (CT) | Fast kicks and flips, pink |
| MOTLEY | Elite Crew (T), 5% smaller | Tricky, long reach, green |

Each fighter has a stance of their own (guard, weight, how they walk) and every move is animated on that stance. When two players pick the same fighter, the second copy gets a colour wash.

**How the bodies work:** the invisible rig plays the animation and the agent model is bone-merged on top of it, so one animation set drives all four agents. The same animation, baked flat, is what the game uses for hit boxes, so a punch lands where the fist is.

## How fights feel

- **Hits have weight.** Every hit has an impact tier (light, medium, heavy, big). Bigger tiers freeze both fighters longer (hitstop), shove the camera along the fight line, throw bigger sparks and layer heavier sounds. Big hits punch the camera in, and a K.O. slows the game down for a moment while the camera pulls in on the fall.
- **Counter hits:** hitting someone during the start-up of their own attack is a COUNTER: extra hitstop, a yellow callout and its own sound.
- **Blocks are obvious:** a blocked hit flashes a blue shield ring with an arc on the guard, plays a guard sound (heavier for big hits), slides the defender back and bounces the attacker off. A perfect block (guard just before the hit) flashes white, gives 2 health back and leaves the attacker open.
- **Bodies react:** struck fighters flash, hit reactions differ for high, mid, crouching and launched hits, landings and dashes kick up dust.
- **The camera** follows the fight, rises with jumps and launches so heads stay in the picture, kicks on hits and pulls in on a K.O.

## First build (command line)

The map, the script, the HUD, the rig and these new or changed assets need compiling:
- models: `pb_rig.vmdl`, `props/pb_nobori_ningyo`, `pb_nobori_hissho`, `pb_nobori_oiri`, `pb_nobori_yomatsuri`, `pb_vending_red`, `pb_vending_white`, `pb_vending_blue`, `pb_sign_izakaya`, `pb_sign_yakitori`
- their materials in `materials/puppet_brawl/props/`

A build script that compiles stale addon assets first (like your `compile_maps.ps1` asset pre-pass) picks these up. Then:
1. In CS2 run `map mg_cs2_fighter`. The console should print `[puppet_brawl] v… ready: stage … 4 pads, 4 watch spots, HUD on, 18 sounds`.
2. Walk down to the glowing pads behind the barrier, stand on one and press **E**.
3. For a solo test: `sv_cheats 1` then `pb_cpu_match` to watch two CPUs fight. `pb_stop` (or the STOP CPUs button) ends it. Or press **ADD CPU**, then **START**.

## Controls

| Action | Key |
|---|---|
| Move | **A / D**. Walking away from the opponent also guards |
| Block | Hold away, or **SHIFT** (guard in place). Down+away guards low |
| Hit zones | Every hit is HIGH, MID or LOW from where it lands. A standing guard stops high and mid; a crouching guard stops mid and low. Sweeps are always low; overheads and jump-ins are always high |
| Perfect block | Guard just before a hit lands: no chip damage, instant recovery, 2 health back |
| Jump | **W** or **SPACE** |
| Crouch | **S** or **CTRL** |
| Punch / kick | **MOUSE1** / **MOUSE2** |
| Combos | P,P = jab into the 1-2 finisher. P,P,K = on into the kick finisher. P,K = jab into a mix-up ender (low or overhead). K,K = snap kick into the kick finisher |
| Special | **R**. Toward+R and down+R give different specials. Motions also work, e.g. down, forward, punch |
| Throw | **F** up close. Tap F or punch right after being grabbed to break it |
| Dash / backdash | Double-tap toward or away |
| Tag (tag team) | **SHIFT+R** while you're on stage |
| Leave | Hold **E** |

**In the lobby:** A/D picks a fighter, MOUSE1 readies up, MOUSE2 un-readies. The first player in is the host: R changes the mode and F adds or clears CPU fighters.

**Host buttons** (either side of the pad platform): MODE, ADD CPU, REMOVE CPU, START, STOP CPUs, CPU EASY / NORMAL / HARD and RESET. Each says in chat what it did.

## Combo finishers

| Fighter | P,P (then K for P,P,K) | P,K mix-up | K,K |
|---|---|---|---|
| TIMBER | Splitter (back-hand hook, high) | Root Sweep (LOW, knocks down) | Timber Fall (high roundhouse, knocks down) |
| BRASS | Rivet Hammer (OVERHEAD smash) | Gear Grind (LOW stomp-sweep, knocks down) | Boiler Kick (mid push kick, huge pushback) |
| PIROUETTE | Pas de Deux (quick two-punch, high) | Plie Sweep (LOW, knocks down) | Arabesque (high kick, launches) |
| MOTLEY | Slapstick (double slap, high) | Jester Drop (OVERHEAD axe kick) | Banana Sweep (LOW sweep, knocks down) |

## The HUD

- Health bars across the top with a white damage chip that drains after a beat, segment ticks and a low-health throb. Your own bar has a gold frame and a YOU tag. Name plates sit under the bars with round-win diamonds at the inner ends.
- The clock hangs under CS2's own team counter, with the round number and who's next.
- Combo callouts under each bar: COUNTER (yellow), PERFECT BLOCK (cyan) and finisher names over a big hit count and the combo's damage.
- The announcer (ROUND 1, FIGHT!, K.O., ... WINS) slams in mid-screen.
- Lobby: a steel plate with the seats, the mode and the controls; your fighter's moves sit bottom right.
- Tag team: your partner's slim bar under yours, and your tag status in a strip at the bottom.
- Everything stays clear of the places CS2 draws its own HUD on top of a custom one (team counter, kill feed, chat, money and health).

## Modes

- **Duel**: 1v1, winner stays on. Players waiting their turn stand at the back of the stage.
- **Tag team**: 2v2 with one fighter per team on stage. Pads 1–2 are RED and pads 3–4 are BLUE. **SHIFT+R** tags your partner in (3-second cooldown). A benched partner slowly wins back half of the damage of their stint. The round ends when both fighters on a team are out.
- **FFA** is still in the game but not on the MODE button; add `"ffa"` to `MODES` to bring it back.

## Settings worth knowing

In the `CONFIG` block at the top of `scripts/puppet_brawl.js`:

| Setting | What it does |
|---|---|
| `WORLD_SCALE` (0.72) | Fighter size. 0.72 is normal CS2 agent height |
| `CAMERA_MODE` | `"auto"` follows the fight, `"fixed"` uses an info_target named `pb_camera`, `"off"` stays first person |
| `CAMERA_HEIGHT` (72), `CAMERA_LOOK_HEIGHT` (66), `CAMERA_MIN_DIST` | Where the fight camera sits and aims, in fighter units |
| `WEAPONS` | `"strip"` removes guns while fighting and gives them back afterwards |
| `ARENA_COMMANDS` | Server settings run at start: kicks bots, stops rounds ending, respawns, no starting pistols. `[]` leaves the server alone |
| `BODY_YAW` | Turns every fighter by this many degrees, only needed if the agents face sideways |
| `FX`, `FX_PARTICLES` | Effects for the crowd |

Game rules sit in the same block: `ROUND_TIME`, `ROUNDS_TO_WIN`, `CPU_LEVEL`, `BACK_BLOCKS`, `PERFECT_BLOCK`, `PERFECT_WINDOW`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Fighters invisible | `pb_rig.vmdl` hasn't compiled. Compile it and check its log |
| Agent frozen in a T-pose | The bone-merge failed; send me the console output |
| Fighters snap between moves instead of blending | Tell me: the clips have blend times set in the rig, and I'll check how CS2 is playing them |
| Pink checkerboard props | That model or material didn't compile (most likely one of the new banners, drinks machines or signs) |
| No HUD | `pb_hud` must point to `panorama/layout/custom_game/puppet_brawl.vxml` |
| Some sounds silent | The `pb.*` events are missing from `soundevents_addon.vsndevts`, or a `pb_snd_*` entity is missing |
| Script not running | The point_script `pb_script` must use `scripts/puppet_brawl.vjs`. Check the console for a JavaScript error line |
