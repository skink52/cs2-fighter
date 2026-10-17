"""Rebuilds the look of mg_cs2_fighter.vmap around its game entities: a rain-slick neon back
street at night. The stage, gate and audience stand where they always did; every entity the
script uses (markers, pads, buttons, templates, labels, sounds) is kept as it is.

Removes the old decoration (world meshes, lanterns, neon tubes, signs, lights) and adds:
  - the stage with a lit edge, the torii gate with round pillars, lantern strings
  - a row of four shop-house facades behind the stage (shutters, lit shop windows, signboards,
    windows on every floor, air-con units, drainpipes, cornices, rooftop plant) and side walls
  - street clutter (bins, bags, crates, pallets, drums, a parked car, a burning drum)
  - cables and lanterns over the street, rain, puddle ripples, steam, sparks, embers
  - lighting: warm key on the fighters, magenta and cyan rims from behind, practical glows
  - point_soundevents for every sound the script plays
Also writes a scene description (JSON) for tools/arena_preview.mjs.
Usage: python3 arena.py <in.vmap> <out.vmap> [scene.json]"""
import json, math, sys
import dmx9
from vmaplib import MapBuilder

SRC, OUT = sys.argv[1], sys.argv[2]
SCENE = sys.argv[3] if len(sys.argv) > 3 else None
dm = dmx9.DMX.load(SRC)
B = MapBuilder(dm, seed=20261017)
world = B.world

# ------------------------------------------------------------------ clear the old decoration
KEEP_PROPS = ("pb_padring",)
removed = {"meshes": 0, "props": 0, "lights": 0, "particles": 0}
kept = []
for c in world["children"]:
    if c.type == "CMapMesh":
        removed["meshes"] += 1; continue
    if c.type == "CMapEntity":
        ep = c["entity_properties"]; cls = ep["classname"]
        if cls == "prop_static" and not any(k in (ep.get("model") or "") for k in KEEP_PROPS):
            removed["props"] += 1; continue
        if cls in ("light_omni2", "light_spot", "light_rect", "light_ortho"):
            removed["lights"] += 1; continue
        if cls == "info_particle_system" and (ep.get("targetname") or "").startswith("pb_amb_"):
            removed["particles"] += 1; continue
    kept.append(c)
world["children"][:] = kept
ents = [c for c in world["children"] if c.type == "CMapEntity"]
def named(n): return next((e for e in ents if e["entity_properties"].get("targetname") == n), None)
def of_class(cls): return [e for e in ents if e["entity_properties"]["classname"] == cls]

# ------------------------------------------------------------------ materials
M = {
    "sky": "materials/tools/toolsskybox.vmat",
    "clip": "materials/tools/toolsplayerclip.vmat",
    "street": "materials/ar_baggage/asphalt_road_wet_blend_01.vmat",
    "slabs": "materials/ar_baggage/concrete_slabs_wet_1.vmat",
    "stage": "materials/de_inferno/wood/inferno_wood_floor_01_varnished.vmat",
    "lacquer": "materials/de_train/hr_train_s2/wood/hrts2_wood_floor_boards_01_paint_red.vmat",
    "brick": "materials/brick/brick_ext_04.vmat",
    "brick2": "materials/brick/01/brick_clean_02.vmat",
    "stucco": "materials/de_train/hr_train_s2/plaster/hrts2_stucco_01.vmat",
    "concrete": "materials/concrete/hr_c/hr_concrete_wall_001.vmat",
    "concrete2": "materials/concrete/hr_c/hr_concrete_wall_004.vmat",
    "tile": "materials/shared_base/tile/wall_tile_ceramic_002.vmat",
    "dark": "materials/concrete/hr_c/hr_concrete_floor_001_dark.vmat",
    "black": "materials/concrete/hr_c/hr_concrete_floor_001_black.vmat",
    "floor": "materials/concrete/hr_c/hr_concrete_floor_05.vmat",
    "shutter": "materials/metal/hr_metal/hr_metal_corrugated_001_blue.vmat",
    "shutter2": "materials/de_overpass/metal/metal_corrugated_1.vmat",
    "trim": "materials/ar_baggage/trim/painted_metal_trim_1.vmat",
    "panel": "materials/metal/hr_metal/hr_metal_panel_001.vmat",
    "lit": "materials/de_cache/glass/ch2_sheet_glass_01_selfillum.vmat",
    "lit2": "materials/de_cache/glass/ch2_sheet_glass_01b_selfillum.vmat",
    "glow": "materials/de_cache/glass/ch2_glassblock_02_selfillum.vmat",
    "glass": "materials/ar_baggage/baggage_glass_opaque_01.vmat",
    "gold": "materials/de_ancient/hr_ancient_wall_plaster_01_gold.vmat",
}
NEON = "models/puppet_brawl/props/pb_neon_%s.vmdl"
SIGN = "models/puppet_brawl/props/pb_sign_%s.vmdl"
LANTERN = "models/puppet_brawl/props/pb_lantern.vmdl"
NOBORI = "models/puppet_brawl/props/pb_nobori_%s.vmdl"
P = {
    "ac": "models/generic/ac_unit_wall_mounted_01/ac_unit_wall_mounted_02.vmdl",
    "hvac": "models/generic/hvac_unit_large_01/hvac_unit_large_01.vmdl",
    "bin": "models/generic/garbage_bin_kit_01/garbagebin01_body.vmdl",
    "binlid": "models/generic/garbage_bin_kit_01/garbagebin01_lid.vmdl",
    "binwheel": "models/generic/garbage_bin_kit_01/garbagebin01_wheel.vmdl",
    "bag": "models/generic/trashbag_kit_01/trashbag_01.vmdl",
    "crate": "models/generic/crate_supply_02/crate_supply_02.vmdl",
    "pallet": "models/de_overpass/construction/wood_pallet/wood_pallet.vmdl",
    "pcrate": "models/de_overpass/junk/plastic_crate/plastic_crate_02.vmdl",
    "drum": "models/props/containers/barrels/steel_drum_barrel_01b.vmdl",
    "car": "models/props/de_inferno/hr_i/car_a/car_a.vmdl",
    "cardet": "models/props/de_inferno/hr_i/car_a/car_a_details.vmdl",
    "carglass": "models/props/de_inferno/hr_i/car_a/car_a_glass.vmdl",
    "dish": "models/props/de_dust/hr_dust/dust_satellite_dish/dust_satellite_dish_wall_01.vmdl",
    "chimney": "models/props/de_inferno/hr_i/chimney/chimney_a.vmdl",
    "lamp": "models/generic/streetlamps_01/streetlamp_lamp_open.vmdl",
    "fluor": "models/generic/fluorescent_lights_01/fluorescent_light_wall_48_a.vmdl",
    "awning": "models/cs_italy/props/awning/awning_cloth_128_01a.vmdl",
    "vent": "models/de_cache_s2/vent_pipe_01/ch2_vent_pipe_01.vmdl",
    "tire": "models/generic/trash/car_tire/car_tire.vmdl",
    "bench": "models/props/de_inferno/hr_i/bench/bench.vmdl",
    "vend_red": "models/puppet_brawl/props/pb_vending_red.vmdl",
    "vend_white": "models/puppet_brawl/props/pb_vending_white.vmdl",
    "vend_blue": "models/puppet_brawl/props/pb_vending_blue.vmdl",
}

box = B.box

# ------------------------------------------------------------------ sky shell and ground
SX0, SX1, SY0, SY1, SZ0, SZ1 = -900, 900, -1260, 860, -48, 900
T = 16
for args in [(SX0 - T, SX1 + T, SY0 - T, SY0, SZ0, SZ1), (SX0 - T, SX1 + T, SY1, SY1 + T, SZ0, SZ1), (SX0 - T, SX0, SY0, SY1, SZ0, SZ1),
             (SX1, SX1 + T, SY0, SY1, SZ0, SZ1), (SX0 - T, SX1 + T, SY0 - T, SY1 + T, SZ1, SZ1 + T), (SX0 - T, SX1 + T, SY0 - T, SY1 + T, SZ0 - T, SZ0)]:
    box(*args, M["sky"])
box(-880, 880, -1240, -430, -16, 0, M["floor"], top=M["slabs"])          # audience side
box(-880, 880, -430, 840, -16, 0, M["floor"], top=M["street"])           # the street

# ------------------------------------------------------------------ the stage
box(-480, 480, -90, 150, 0, 24, M["lacquer"], top=M["stage"])
box(-486, 486, -96, -90, 18, 26, M["black"])                              # front lip
box(-486, 486, 150, 156, 18, 26, M["black"])
for sx in (-486, 480):
    box(sx, sx + 6, -96, 156, 18, 26, M["black"])
B.prop(NEON % "cyan", (0, -97, 22), scales=(972, 2, 2))
B.prop(NEON % "pink", (0, -97, 4), scales=(972, 2, 2))
for sx in (-1, 1):
    B.prop(NEON % ("pink" if sx < 0 else "cyan"), (sx * 487, 30, 22), scales=(2, 252, 2))
# lacquered bands along the front and back of the floor, edged in gold
for (y0, y1) in [(-90, -64), (124, 150)]:
    box(-480, 480, y0, y1, 24, 24.5, M["lacquer"])
box(-480, 480, -64, -62.5, 24, 24.5, M["gold"]); box(-480, 480, 122.5, 124, 24, 24.5, M["gold"])
# steps up from the street at the back corners
for sx in (-1, 1):
    for k in range(3):
        box(sx * 380 - 40, sx * 380 + 40, 156 + k * 14, 170 + k * 14, 0, 18 - k * 6, M["dark"])

# ------------------------------------------------------------------ torii gate (round pillars)
for sx in (-430, 430):
    B.prism(sx, 160, 24, 330, 10, M["lacquer"], sides=14, cap=M["dark"])
    B.prism(sx, 160, 24, 44, 15, M["dark"], sides=14)
    B.prism(sx, 160, 268, 280, 12, M["black"], sides=14)
box(-510, 510, 146, 174, 332, 348, M["black"], bottom=M["lacquer"])     # kasagi
box(-498, 498, 148, 172, 318, 332, M["lacquer"])                          # shimaki
box(-455, 455, 153, 167, 270, 284, M["lacquer"])                          # nuki
box(-10, 10, 152, 168, 284, 318, M["black"])                              # gakuzuka
box(-60, 60, 150, 156, 290, 314, M["black"])                              # name plaque
# lanterns hanging from the tie beam
for k, x in enumerate(range(-340, 341, 85)):
    B.prop(LANTERN, (x, 160, 262 - 6 * math.cos(k * 0.9) ** 2))

# ------------------------------------------------------------------ facades behind the stage
# The street behind the stage runs between the side walls (x = -600..600). Buildings A and D carry on
# behind the side walls for the skyline; their shop fronts, signs and low windows sit in the part
# seen from the street (span).
LIT_WINDOWS = set()
def window(x, y, z, w, h, lit, frame_mat=M["trim"]):
    """window on a wall facing -Y at y: glass slightly proud of the wall, frame and sill"""
    box(x - w / 2, x + w / 2, y - 1.5, y, z, z + h, M["lit" if lit == 1 else "lit2" if lit == 2 else "glass"])
    box(x - w / 2 - 4, x + w / 2 + 4, y - 3, y, z - 4, z, frame_mat)            # bottom frame
    box(x - w / 2 - 4, x + w / 2 + 4, y - 3, y, z + h, z + h + 4, frame_mat)    # top frame
    box(x - w / 2 - 4, x - w / 2, y - 3, y, z, z + h, frame_mat)
    box(x + w / 2, x + w / 2 + 4, y - 3, y, z, z + h, frame_mat)
    box(x - w / 2 - 6, x + w / 2 + 6, y - 7, y, z - 9, z - 4, M["concrete2"])   # sill
    if lit: LIT_WINDOWS.add((x, y, z + h / 2, lit))

SIDE_H = 420
def facade(x0, x1, yf, depth, h, wall, span=None, shop="shutter", floors=4, win_w=54, win_h=70, ground=150, sign=None, lit_seed=0,
           ac=(), dish=None, roof=(), pipes=(), awning=False, cornice=M["concrete2"]):
    vx0, vx1 = span or (x0, x1)
    # ground floor set back 18 under the upper floors, piers at the ends of the street front
    box(x0, x1, yf + 18, yf + depth, 0, ground, wall)
    box(x0, x1, yf, yf + depth, ground, h, wall)
    for px in (vx0, vx1 - 22):
        box(px, px + 22, yf, yf + 18, 0, ground, wall)
    sx0, sx1 = vx0 + 34, vx1 - 34
    if shop == "shutter":
        box(sx0, sx1, yf + 16, yf + 18, 0, ground - 16, M["shutter"])
        box(sx0, sx1, yf + 12, yf + 18, ground - 18, ground - 6, M["dark"])    # shutter box
    elif shop == "window":
        mid = (sx0 + sx1) / 2
        box(sx0, mid - 30, yf + 16, yf + 18, 22, ground - 22, M["lit2"])
        box(mid + 30, sx1, yf + 16, yf + 18, 22, ground - 22, M["lit2"])
        box(sx0, sx1, yf + 14, yf + 18, 0, 22, M["dark"])
        box(mid - 30, mid + 30, yf + 16, yf + 18, 0, ground - 22, M["panel"])   # door
        box(sx0, sx1, yf + 14, yf + 18, ground - 22, ground - 6, M["dark"])
        LIT_WINDOWS.add(((sx0 + sx1) / 2, yf + 16, 70, 3))
    elif shop == "half":
        box(sx0, sx1, yf + 16, yf + 18, 58, ground - 16, M["shutter2"])        # half-open shutter, light inside
        box(sx0, sx1, yf + 16.5, yf + 18, 0, 58, M["lit"])
        box(sx0, sx1, yf + 12, yf + 18, ground - 18, ground - 6, M["dark"])
        LIT_WINDOWS.add(((sx0 + sx1) / 2, yf + 16, 30, 3))
    # signboard band over the shop
    box(vx0 + 10, vx1 - 10, yf - 6, yf, ground, ground + 34, M["black"])
    if sign: B.prop(SIGN % sign, ((vx0 + vx1) / 2, yf - 8, ground + 17))
    if awning:
        n = max(1, int((sx1 - sx0) // 128))
        for k in range(n):
            ax = sx0 + (sx1 - sx0) * (k + 0.5) / n
            B.prop(P["awning"], (ax - 64, yf - 2, ground - 4), (0, -90, 0))   # the cloth runs +X from its origin
    # upper floors: windows on the street front, and across the whole width above the side walls
    for f in range(floors):
        z = ground + 52 + f * 104
        if z + win_h > h - 24: break
        a, b = (x0, x1) if z > SIDE_H else (vx0, vx1)
        cols = max(1, int((b - a - 40) // 112))
        for k in range(cols):
            x = a + (b - a) * (k + 0.5) / cols
            r = (lit_seed * 7 + f * 3 + k * 5) % 9
            window(x, yf, z, win_w, win_h, 1 if r in (1, 4) else 2 if r == 6 else 0)
    # cornice and parapet
    box(x0 - 4, x1 + 4, yf - 10, yf + 6, h - 14, h, cornice)
    box(x0, x1, yf, yf + depth, h, h + 10, M["dark"])
    for (ax, az) in ac:
        B.prop(P["ac"], (ax, yf, az), (0, -90, 0))
    if dish: B.prop(P["dish"], (dish[0], yf, dish[1]), (0, 0, 0))     # its wall plate is the model's y = 0 plane
    for (rx, ry, kind) in roof:
        B.prop(P[kind], (rx, yf + ry, h + 10), (0, 90 if kind == "hvac" else 0, 0))
    for px in pipes:
        box(px - 3, px + 3, yf - 8, yf - 2, 0, h - 14, M["trim"])
    return (x0, x1, yf, h)

YB = 330
YA, YBB, YC, YD = YB, YB + 40, YB, YB + 20
facade(-900, -330, YA, 240, 520, M["brick"], span=(-600, -330), shop="half", sign="ramen", lit_seed=1,
       ac=[(-560, 300), (-400, 404)], pipes=[-338], roof=[(-700, 80, "hvac")], awning=True)
facade(-330, -50, YBB, 220, 430, M["stucco"], shop="window", sign="kakutou", lit_seed=2, ac=[(-290, 290), (-75, 395)], dish=(-80, 330),
       roof=[(-180, 40, "chimney")])
facade(-50, 330, YC, 260, 620, M["concrete"], shop="shutter", sign="eigyou", lit_seed=3, ac=[(20, 404), (300, 404), (160, 508)], pipes=[322],
       roof=[(140, 90, "hvac")])
facade(330, 900, YD, 240, 480, M["brick2"], span=(330, 600), shop="half", sign="yoichi", lit_seed=4, ac=[(380, 302), (560, 406)], awning=True,
       roof=[(560, 60, "chimney"), (760, 40, "chimney")])
# the rooftop marquee over the tall centre building, and more signs on the fronts
B.prop(SIGN % "marquee", (140, YC - 10, 560))
B.prop(SIGN % "ryu", (-450, YA - 4, 300))
B.prop(SIGN % "sake", (-366, YA - 4, 190))

# ------------------------------------------------------------------ side walls (facing the stage)
def side_wall(xs, y0, y1, h, wall, signs=()):
    if xs < 0: box(-900, xs, y0, y1, 0, h, wall)
    else: box(xs, 900, y0, y1, 0, h, wall)
    d = -1 if xs < 0 else 1    # the wall's inner face looks toward the centre: -X for the right wall
    for f in range(3):
        z = 190 + f * 104
        if z + 70 > h - 24: break
        for k in range(int((y1 - y0 - 80) // 140)):
            y = y0 + 70 + k * 140 + 35
            r = (f * 5 + k * 3 + (1 if xs > 0 else 0)) % 7
            lit = 1 if r == 2 else 2 if r == 5 else 0
            mat = M["lit" if lit == 1 else "lit2" if lit == 2 else "glass"]
            gx0, gx1 = (xs - 1.5, xs) if d > 0 else (xs, xs + 1.5)
            box(gx0, gx1, y - 27, y + 27, z, z + 70, mat)
            fx0, fx1 = (xs - 3, xs) if d > 0 else (xs, xs + 3)
            box(fx0, fx1, y - 31, y + 31, z - 4, z, M["trim"]); box(fx0, fx1, y - 31, y + 31, z + 70, z + 74, M["trim"])
            box(fx0, fx1, y - 31, y - 27, z, z + 70, M["trim"]); box(fx0, fx1, y + 27, y + 31, z, z + 70, M["trim"])
            if lit: LIT_WINDOWS.add((xs - d * 2, y, z + 35, lit))
    # ground-floor shutters and a signboard
    s0, s1 = (y0 + 40, y0 + 260)
    sh0, sh1 = (xs - 2, xs) if d > 0 else (xs, xs + 2)
    bd0, bd1 = (xs - 6, xs) if d > 0 else (xs, xs + 6)
    box(sh0, sh1, s0, s1, 0, 130, M["shutter"])
    box(bd0, bd1, s0 - 10, s1 + 10, 140, 172, M["black"])
    for (sy, name, z) in signs:
        B.prop(SIGN % name, (xs - d * 8, sy, z), (0, -90 if d > 0 else 90, 0))
    box(xs - 8 if d > 0 else xs, xs if d > 0 else xs + 8, y0, y1, h - 14, h, M["concrete2"])
def side_shop(xs, y0, y1, sign=None, shutter=False):
    """a small shop on a side wall's inner face (lit window and door, signboard, a big red lantern)"""
    d = -1 if xs < 0 else 1
    out = lambda a, b: (xs - d * b, xs - d * a) if d > 0 else (xs - d * a, xs - d * b)   # x range from a to b units into the street
    box(*out(0, 1.5), y0, y1, 20, 118, M["shutter" if shutter else "lit2"])
    box(*out(0, 4), y0 - 6, y1 + 6, 0, 20, M["dark"]); box(*out(0, 4), y0 - 6, y1 + 6, 118, 126, M["dark"])
    box(*out(0, 4), y0 - 6, y0, 20, 118, M["dark"]); box(*out(0, 4), y1, y1 + 6, 20, 118, M["dark"])
    if not shutter:
        mid = (y0 + y1) / 2
        box(*out(0, 2.5), mid - 3, mid + 3, 20, 118, M["dark"])                 # window mullion
        LIT_WINDOWS.add((xs - d * 2, mid, 70, 3))
    box(*out(0, 6), y0 - 10, y1 + 10, 134, 166, M["black"])                       # signboard
    if sign: B.prop(SIGN % sign, (xs - d * 8, (y0 + y1) / 2, 150 - 0.5 * SIGN_H.get(sign, 34)), (0, -90 if d > 0 else 90, 0))
    B.prop(LANTERN, (xs - d * 18, y0 - 18, 168), scales=(1.8, 1.8, 1.8))
    box(*out(0, 18), y0 - 20, y0 - 16, 168, 171, M["black"])                     # lantern bracket
SIGN_H = {"eigyou": 34, "ryu": 70, "izakaya": 30, "yakitori": 30}
side_wall(-600, -430, YB, SIDE_H, M["brick2"], signs=[(-250, "sake", 156), (60, "ryu", 300)])
side_wall(600, -430, YB, SIDE_H - 20, M["brick"], signs=[(-250, "eigyou", 156), (40, "ningyou", 280)])
side_shop(-600, 200, 300, sign="izakaya")
side_shop(600, 190, 290, sign="yakitori")
for (x, y, yaw) in [(-560, 120, 80), (-566, 160, -10), (560, 120, 100)]:
    B.prop(P["pcrate"], (x, y, 0), (0, yaw, 0)); B.prop(P["pcrate"], (x + 2, y + 1, 12.4), (0, yaw + 12, 0))

# ------------------------------------------------------------------ street behind the stage
def place(model, x, y, z=0.0, yaw=0.0, parts=()):
    """a prop plus attached parts given as (model, offset) in the prop's own frame"""
    B.prop(model, (x, y, z), (0, yaw, 0))
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    for (m, (ox, oy, oz)) in parts:
        B.prop(m, (x + ox * c - oy * s, y + ox * s + oy * c, z + oz), (0, yaw, 0))
BIN_PARTS = [(P["binlid"], (-24, 0, 61))] + [(P["binwheel"], (wx, wy, 8.6)) for wx in (14.6, -16.5) for wy in (28.3, -28.3)]
# left: the ramen shop's bins, bags and a burning drum
place(P["bin"], -556, YA - 27, yaw=-90, parts=BIN_PARTS)
place(P["bin"], -478, YA - 27, yaw=-94, parts=BIN_PARTS)
for (bx, by, yaw) in [(-520, 268, 30), (-430, 284, -40), (-584, 262, 70), (-500, 246, 10), (-452, 258, 120)]:
    B.prop(P["bag"], (bx, by, 0), (0, yaw, 0))
B.prop(P["drum"], (-392, 262, 0), (0, 0, 0))                     # the burning drum
B.prop(P["drum"], (-358, 292, 0), (0, 40, 0))
B.prop(P["pallet"], (-576, 214, 0), (0, 12, 0)); B.prop(P["pallet"], (-574, 216, 7), (0, 4, 0))
B.prop(P["pcrate"], (-302, 348, 0), (0, -15, 0)); B.prop(P["pcrate"], (-298, 350, 12.4), (0, 10, 0)); B.prop(P["pcrate"], (-282, 344, 0), (0, 5, 0))
B.prop(P["tire"], (-250, 352, 5.1), (90, 0, 0)); B.prop(P["tire"], (-252, 351, 15.3), (90, 30, 0))
B.prop(P["vent"], (-120, YBB, 0), (0, 0, 0))
# centre: drinks machines in front of the closed shop, a bench
place(P["vend_red"], 6, YC - 15)
place(P["vend_white"], 47, YC - 15)
B.prop(P["bench"], (236, YC - 34, 12), (0, 0, 0))
# right: a parked car, crates
B.prop(P["car"], (452, 270, 30), (0, 180, 0)); B.prop(P["cardet"], (452, 270, 30), (0, 180, 0)); B.prop(P["carglass"], (452, 270, 30), (0, 180, 0))
B.prop(P["crate"], (556, YD - 32, 0), (0, -6, 0))
B.prop(P["pcrate"], (580, 254, 0), (0, 25, 0)); B.prop(P["pcrate"], (566, 236, 0), (0, -10, 0))
# lamps and strip lights on the fronts
for (lx, ly, lz) in [(-420, YA, 250), (362, YD, 256)]:
    B.prop(P["lamp"], (lx, ly, lz), (0, -90, 0))
B.prop(P["fluor"], (-100, YBB - 1, 214), (0, -90, 0))
B.prop(P["fluor"], (262, YC - 1, 214), (0, -90, 0))
# festival banners either side of the stage
for (x, kind) in [(-484, "yomatsuri"), (-424, "oiri"), (-364, "ningyo"), (344, "ningyo"), (404, "hissho"), (464, "yomatsuri")]:
    B.prop(NOBORI % kind, (x, 206, 0), (0, 0, 0))

# ------------------------------------------------------------------ cables and lanterns across the street
def wire(x0, y0, z0, x1, y1, z1, sag=14, segs=8):
    pts = []
    for k in range(segs + 1):
        t = k / segs
        pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t - sag * 4 * t * (1 - t)))
    for a, b in zip(pts, pts[1:]):
        cx, cy, cz = [(a[i] + b[i]) / 2 for i in range(3)]
        lx, ly = abs(b[0] - a[0]) / 2 + 0.6, abs(b[1] - a[1]) / 2 + 0.6
        box(cx - lx, cx + lx, cy - ly, cy + ly, cz - 0.6, cz + 0.6, M["black"])
    return pts
for (y0, y1, z0, z1, x) in [(YB, -430, 380, 300, -300), (YB + 40, -430, 360, 330, 120), (YB, -430, 420, 340, 420)]:
    wire(x, y0, z0, x + 40, y1, z1, sag=20, segs=10)
# the lantern string the fight camera sees across the top of the picture
lantern_pts = wire(-596, 236, 268, 596, 236, 268, sag=30, segs=14)
for p in lantern_pts[1:-1]:
    B.prop(LANTERN, (p[0], p[1], p[2] - 6))
lantern_pts = wire(-590, -260, 330, 590, -260, 330, sag=30, segs=12)
for p in lantern_pts[1:-1]:
    B.prop(LANTERN, (p[0], p[1], p[2] - 10))

# ------------------------------------------------------------------ audience side (as before)
box(-880, 880, -440, -430, 0, 30, M["dark"])                               # barrier wall
B.prop(NEON % "pink", (0, -445, 30), scales=(1680, 2, 2))
box(-880, 880, -432, -428, 30, 600, M["clip"])                              # keeps players out of the camera's air
ROW = 52
for k in range(4):
    box(-520, 520, -440 - ROW * (k + 1), -440 - ROW * k, 0, 16 * (k + 1), M["floor"], top=M["dark"])
    B.prop(NEON % ("cyan" if k % 2 else "purple"), (0, -441 - ROW * k, 16 * (k + 1) - 1), scales=(1040, 2, 2))
PLAT_Z = 80
box(-520, 520, -800, -648, 0, PLAT_Z, M["floor"], top=M["dark"])          # pad platform
B.prop(NEON % "pink", (0, -649, PLAT_Z - 1), scales=(1040, 2, 2))
box(-880, 880, -1240, -1160, 0, 380, M["brick"])                            # back street facade
box(-700, 700, -1160, -1156, 0, 110, M["shutter"])
for x in range(-600, 601, 150):
    box(x - 28, x + 28, -1160, -1157, 190, 260, M["lit2"] if (x // 150) % 2 else M["glass"])
for k, (sx, name) in enumerate([(-420, "kakutou"), (0, "ramen"), (420, "yoichi")]):
    B.prop(SIGN % name, (sx, -1154, 150), (0, 180, 0))
# side lanes behind the bleachers
box(-880, -560, -1160, -430, 0, 330, M["brick2"]); box(560, 880, -1160, -430, 0, 330, M["brick"])
lantern_pts = wire(-560, -900, 290, 560, -900, 290, sag=24, segs=12)
for p in lantern_pts[1:-1]:
    B.prop(LANTERN, (p[0], p[1], p[2] - 10))
# button posts under the host buttons (the buttons themselves are kept)
for e in of_class("func_button"):
    x, y, z = e["origin"]
    box(x - 3, x + 3, y - 3, y + 3, PLAT_Z, z - 12, M["dark"])

# ------------------------------------------------------------------ lights
# key: warm, from above the camera, plus two stage spots; rims: magenta and cyan from behind the fighters
B.light((0, -520, 360), (255, 228, 200), 15000, 1500, (34, 90, 0), 44, 1)
B.light((-210, -330, 300), (255, 236, 214), 14000, 1100, (36, 58, 0), 40, 1)
B.light((210, -330, 300), (236, 240, 255), 14000, 1100, (36, 122, 0), 40, 1)
B.light((-260, -360, 240), (255, 200, 170), 3000, 900, (22, 65, 0), 50, 0)
B.light((260, -360, 240), (200, 220, 255), 3000, 900, (22, 115, 0), 50, 0)
B.light((-300, 190, 270), (255, 50, 170), 12000, 900, (36, -45, 0), 50, 1)
B.light((300, 190, 270), (40, 200, 255), 12000, 900, (36, -135, 0), 50, 1)
# practical glows: lit windows and shops, signs, lanterns, the burning drum, lamps, the drinks machines
for (x, y, z, lit) in sorted(LIT_WINDOWS):
    col = (255, 196, 120) if lit in (1, 3) else (150, 200, 255)
    if abs(x) > 610 or z > 520: continue
    if lit == 3: B.light((x, y - 60 if y > 0 else y, z + 20) if abs(x) < 590 else (x - 60 if x > 0 else x + 60, y, z + 20), (255, 170, 90), 1500, 380)
    elif (int(x) + int(z)) % 3 == 0: B.light((x, y - 18 if y > 0 else y, z), col, 600, 220)
for (o, c) in [((-465, YA - 40, 240), (255, 200, 60)), ((-190, YBB - 40, 230), (255, 60, 120)), ((140, YC - 36, 184), (90, 255, 140)),
               ((465, YD - 40, 222), (180, 90, 255)), ((140, YC - 40, 600), (255, 60, 170)), ((-450, YA - 20, 335), (255, 80, 40)),
               ((-366, YA - 20, 220), (255, 140, 60))]:
    B.light(o, c, 1300, 420)
B.light((-392, 262, 60), (255, 130, 50), 3200, 520, style="candle_2")          # burning drum, flickering
for (x, y, z) in [(-420, YA - 44, 236), (362, YD - 44, 242)]:
    B.light((x, y, z), (170, 205, 255), 2400, 520, (90, 0, 0), 80, 0)    # street lamps, pointing down
B.light((26, YC - 50, 50), (200, 225, 255), 1300, 260)                    # drinks machines
B.light((-100, YBB - 8, 210), (225, 240, 255), 900, 260)                  # strip lights
B.light((262, YC - 8, 210), (225, 240, 255), 900, 260, style="fluorescent_flicker")
for (x, y) in [(-340, 160), (0, 160), (340, 160)]:
    B.light((x, y - 10, 250), (255, 110, 70), 900, 300)                   # torii lanterns
for x in (-300, 0, 300):
    B.light((x, 236, 226), (255, 120, 70), 700, 260)                      # lantern string over the street
for x in (-480, -160, 160, 480):
    B.light((x, -260, 300), (255, 120, 80), 1000, 380)
    B.light((x, -900, 270), (255, 120, 80), 1300, 480)
B.light((0, -720, 230), (150, 110, 255), 3000, 900)
le = of_class("light_environment")[0]
le["entity_properties"]["color"] = "110 130 220"; le["entity_properties"]["brightness"] = "0.14"
le["angles"] = (50.0, 125.0, 0.0)

# ------------------------------------------------------------------ atmosphere
for (eff, o) in [("particles/rain_fx/rain_outer.vpcf", (0, 520, 700)), ("particles/rain_fx/rain_edge_sparse.vpcf", (0, 250, 520)),
                 ("particles/rain_fx/rain_puddle_ripples_small.vpcf", (-200, 240, 1)), ("particles/rain_fx/rain_puddle_ripples_small.vpcf", (260, 250, 1)),
                 ("particles/rain_fx/rain_puddle_ripples_small.vpcf", (0, -520, 1)), ("particles/maps/de_bank/bank_steam.vpcf", (-84, YBB - 6, 50)),
                 ("particles/burning_fx/barrel_burning_engine_fire.vpcf", (-392, 262, 44)), ("particles/burning_fx/barrel_embers.vpcf", (-392, 262, 50)),
                 ("particles/ambient_fx/ambient_sparks.vpcf", (322, YC - 10, 300)), ("particles/rain_fx/rain_lamp_circle_drip.vpcf", (-420, YA - 44, 236))]:
    B.particle(eff, o, name="pb_amb_%d" % len(B.scene["particles"]))
for f in of_class("env_cubemap_fog"):
    p = f["entity_properties"]
    for k, v in [("cubemapfogstartdistance", "120"), ("cubemapfogenddistance", "2600"), ("cubemapfogmaxopacity", "0.55"), ("cubemapfogfalloffexponent", "1.2")]:
        if k in p: p[k] = v
        else: p.set(k, dmx9.T_STRING, v)
for pv in of_class("env_combined_light_probe_volume"):
    pv["origin"] = (0.0, -200.0, 300.0)
    pv["entity_properties"]["box_mins"] = "-880 -1040 -340"; pv["entity_properties"]["box_maxs"] = "880 1040 600"
for mb, o in zip(of_class("cs_minimap_boundary"), [(-900, 860, 900), (900, -1260, -48)]): mb["origin"] = tuple(map(float, o))

# ------------------------------------------------------------------ sounds the script plays
SOUNDS = ["hitl", "hit", "heavy", "crush", "counter", "block", "blockh", "whiff", "whiffh", "kd", "land", "dash", "special", "ko", "bell", "tick", "select", "win"]
have = {e["entity_properties"].get("targetname") for e in of_class("point_soundevent")}
for i, sid in enumerate(SOUNDS):
    if "pb_snd_" + sid in have: continue
    B.add(B.entity("point_soundevent", (-340 + 40 * i, 40, 70), props={"targetname": "pb_snd_" + sid, "soundName": "pb." + sid, "sourceEntityName": "",
        "startOnSpawn": "0", "toLocalPlayer": "0", "stopOnNew": "0", "saveAndRestore": "0", "sourceEntityAttachment": "", "entityIndexSelection": "0"}))

cam = dm.root["defaultcamera"]
cam["position"] = (0.0, -620.0, 200.0); cam["lookat"] = (0.0, 120.0, 120.0)
dm.save(OUT)
print("removed", removed, "-> added", len(B.scene["boxes"]), "boxes,", len(B.scene["props"]), "props,", len(B.scene["lights"]), "lights,", len(B.scene["particles"]), "particles")
if SCENE:
    json.dump(B.scene, open(SCENE, "w"))
    print("scene", SCENE)
