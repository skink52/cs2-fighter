"""A small stand-in for CS2's Panorama, enough for the Puppet Brawl HUD (adapted from Space Racer's
hud_render.py): reads the generated layout xml and css, lays the panels out the way the HUD is written
(fixed sizes, pinned from the top and the left / centre / right) and draws them over a picture of the
arena. It also checks the rules the HUD relies on (every panel has a fixed size, nothing hangs off its
parent, no vertical centring, no bottom or negative margins) and that nothing of ours sits where CS2 draws
its own HUD over a custom one (team counter, kill feed, chat, money / health row), and prints anything
that breaks them.

usage: hud_preview.py <addon_dir> <background.png> <out_prefix> [wide_background.png] [narrow_background.png]
writes <out_prefix>_fight.png, _ko.png, _teams.png, _lobby.png, _intro.png at 1920x1080, _fight_wide.png at
2333x1080 (Zach's screen), _fight_43.png at 1440x1080 and _cs2.png (the fight HUD with CS2's places marked)."""
import os, re, sys, math
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

OUT, BG, PREFIX = sys.argv[1], sys.argv[2], sys.argv[3]
BG_WIDE = sys.argv[4] if len(sys.argv) > 4 else BG
BG_43 = sys.argv[5] if len(sys.argv) > 5 else BG
H = 1080
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'

# ---------------------------------------------------------------- css
def parse_css(text):
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    rules, order = [], 0
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', text):
        sel, body = m.group(1).strip(), m.group(2)
        if sel.startswith('@') or "'" in sel or sel.endswith('%'): continue
        props = {}
        for decl in re.split(r';(?![^(]*\))', body):
            if ':' not in decl: continue
            k, v = decl.split(':', 1)
            props[k.strip()] = v.strip()
        for s in sel.split(','):
            s = s.strip()
            if not s: continue
            parts = [compound(p) for p in s.split()]
            spec = (sum(len(p['ids']) for p in parts), sum(len(p['cls']) for p in parts), sum(1 for p in parts if p['tag']))
            rules.append(dict(sel=s, parts=parts, spec=spec, order=order, props=props))
            order += 1
    return rules

def compound(s):
    tag = re.match(r'^[A-Za-z]\w*', s)
    return dict(tag=tag.group(0) if tag else None, ids=re.findall(r'#([\w-]+)', s), cls=re.findall(r'\.([\w-]+)', s))

def matches(c, node):
    if c['tag'] and c['tag'] != node.tag: return False
    if c['ids'] and node.id not in c['ids']: return False
    return all(k in node.cls for k in c['cls'])

def rule_matches(r, node):
    parts = r['parts']
    if not matches(parts[-1], node): return False
    a = node.parent
    for c in reversed(parts[:-1]):
        while a is not None and not matches(c, a): a = a.parent
        if a is None: return False
        a = a.parent
    return True

# ---------------------------------------------------------------- xml
class Node:
    def __init__(self, el, parent):
        self.tag = el.tag; self.id = el.get('id'); self.base = set((el.get('class') or '').split()); self.cls = set(self.base)
        self.static = el.get('text') if el.get('text') and '{' not in el.get('text') else None
        self.text = self.static; self.parent = parent
        self.kids = [Node(c, self) for c in el if c.tag in ('Panel', 'Label', 'Image', 'Button')]

def load(out):
    lay = os.path.join(out, 'panorama/layout/custom_game/puppet_brawl.xml')
    tree = ET.parse(lay).getroot()
    top = [c for c in tree if c.tag == 'Panel'][0]
    css = open(os.path.join(out, 'panorama/styles/custom_game/puppet_brawl.css')).read()
    return Node(top, None), parse_css(css)

ROOT, RULES = load(OUT)
BYID = {}
def index(n):
    if n.id: BYID[n.id] = n
    for k in n.kids: index(k)
index(ROOT)

def style(node):
    st = {}
    for r in sorted((r for r in RULES if rule_matches(r, node)), key=lambda r: (r['spec'], r['order'])):
        st.update(r['props'])
    return st

def pxv(v, ref):
    if v is None: return None
    v = v.strip()
    if v.endswith('px'): return float(v[:-2])
    if v.endswith('%'): return float(v[:-1]) / 100 * ref
    return None

def border_w(st, side=None):
    v = st.get('border-' + side) if side else None
    if v is None: v = st.get('border')
    if not v: return 0
    return float(v.split()[0][:-2])

# ---------------------------------------------------------------- layout
problems = []
def layout(node, x, y, w, h, op, out, W, path=''):
    """node's content box is (x, y, w, h); lays out and collects draw items for its children"""
    flow = node.st.get('flow-children', 'none')
    cx, cxr = x, x + w
    for k in node.kids:
        st = k.st = style(k)
        p = path + '/' + (k.id or '.'.join(sorted(k.base))[:24])
        if st.get('visibility') == 'collapse': problems.append('visibility collapse (use opacity): ' + p)
        bw = border_w(st)
        kw, kh = pxv(st.get('width'), w), pxv(st.get('height'), h)
        if kw is None or kh is None:
            problems.append('no fixed size: ' + p)
            kw = kw or 0; kh = kh or 0
        ml, mt, mr = (pxv(st.get(s), w) or 0 for s in ('margin-left', 'margin-top', 'margin-right'))
        if 'margin-bottom' in st and pxv(st['margin-bottom'], h): problems.append('margin-bottom used: ' + p)
        if st.get('vertical-align') not in (None, 'top'): problems.append('vertical-align %s: %s' % (st.get('vertical-align'), p))
        if min(ml, mt, mr) < 0: problems.append('negative margin: ' + p)
        ow, oh = kw + 2 * bw, kh + 2 * bw
        if flow == 'right':
            kx = cx + ml; ky = y + mt; cx = kx + ow + mr
        elif flow == 'left':
            kx = cxr - mr - ow; ky = y + mt; cxr = kx - ml
        else:
            al = st.get('horizontal-align', 'left')
            kx = x + ml if al == 'left' else x + (w - ow) / 2 + ml - mr if al == 'center' else x + w - ow - mr
            ky = y + mt
            if node.parent is not None and (kx < x - 0.5 or kx + ow > x + w + 0.5 or ky + oh > y + h + 0.5):
                problems.append('outside parent (%dx%d at %d,%d in %dx%d): %s' % (ow, oh, kx - x, ky - y, w, h, p))
        o = op * float(st.get('opacity', '1'))
        out.append((k, kx, ky, ow, oh, bw, o, st))
        layout(k, kx + bw, ky + bw, kw, kh, o, out, W, p)

# ---------------------------------------------------------------- drawing
def color(v):
    v = v.strip()
    if v.startswith('#'):
        h_ = v[1:]
        if len(h_) == 6: return tuple(int(h_[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
        if len(h_) == 8: return tuple(int(h_[i:i + 2], 16) for i in (0, 2, 4, 6))
    return None

def gradient(v):
    """gradient( linear, 0% 0%, 0% 100%, from( a ), color-stop( t, b ), to( c ) ) -> (vertical, [(t, rgba)])"""
    m = re.match(r'gradient\(\s*linear,\s*([\d.]+)% ([\d.]+)%,\s*([\d.]+)% ([\d.]+)%,(.*)\)$', v.strip())
    if not m: return None
    vertical = float(m.group(4)) > float(m.group(2))
    stops = []
    for s in re.finditer(r'(from|to|color-stop)\(\s*([^)]*)\)', m.group(5)):
        kind, args = s.group(1), [a.strip() for a in s.group(2).split(',')]
        if kind == 'from': stops.append((0.0, color(args[0])))
        elif kind == 'to': stops.append((1.0, color(args[0])))
        else: stops.append((float(args[0]), color(args[1])))
    return vertical, sorted(stops)

def fill_bg(layer, w, h, st):
    v = st.get('background-color')
    if not v: return
    d = ImageDraw.Draw(layer)
    c = color(v)
    if c:
        if c[3]: d.rectangle([0, 0, w - 1, h - 1], fill=c)
        return
    g = gradient(v)
    if not g: return
    vertical, stops = g
    n = int(h if vertical else w)
    for i in range(max(1, n)):
        t = i / max(1, n - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = (t - t0) / max(1e-6, t1 - t0)
                c = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(4))
                break
        else: c = stops[-1][1]
        if vertical: d.line([(0, i), (w - 1, i)], fill=c)
        else: d.line([(i, 0), (i, h - 1)], fill=c)

def drawn(item):
    k, x, y, w, h, bw, op, st = item
    if op <= 0.01 or w <= 0 or h <= 0: return False
    bg = st.get('background-color')
    return bool((bg and (gradient(bg) or (color(bg) and color(bg)[3]))) or 'border' in st or (k.tag == 'Label' and k.text))

_fonts = {}
def font(sz):
    if sz not in _fonts: _fonts[sz] = ImageFont.truetype(FONT, sz)
    return _fonts[sz]

def wrap(d, text, f, width, spacing):
    lines, cur = [], ''
    for word in text.split(' '):
        t = (cur + ' ' + word) if cur else word
        if d.textlength(t, font=f) + spacing * len(t) <= width or not cur: cur = t
        else: lines.append(cur); cur = word
    lines.append(cur)
    return lines

def draw(items, img):
    for (k, x, y, w, h, bw, op, st) in items:
        if op <= 0.01 or w <= 0 or h <= 0: continue
        layer = Image.new('RGBA', (int(w) + 2, int(h) + 2), (0, 0, 0, 0))
        fill_bg(layer, w, h, st)
        d = ImageDraw.Draw(layer)
        if bw:
            bc = color(st['border'].split()[-1])
            for t in range(int(bw)): d.rectangle([t, t, w - 1 - t, h - 1 - t], outline=bc)
        for side in ('left', 'right', 'top', 'bottom'):
            v = st.get('border-' + side)
            if not v: continue
            sw, sc = float(v.split()[0][:-2]), color(v.split()[-1])
            for t in range(int(sw)):
                if side == 'left': d.line([(t, 0), (t, h - 1)], fill=sc)
                elif side == 'right': d.line([(w - 1 - t, 0), (w - 1 - t, h - 1)], fill=sc)
                elif side == 'top': d.line([(0, t), (w - 1, t)], fill=sc)
                else: d.line([(0, h - 1 - t), (w - 1, h - 1 - t)], fill=sc)
        if k.tag == 'Label' and k.text:
            fs = int(pxv(st.get('font-size', '18px'), 0) or 18)
            f = font(fs)
            col = color(st.get('color', '#ffffff')) or (255, 255, 255, 255)
            txt = k.text.upper() if st.get('text-transform') == 'uppercase' else k.text
            sp = pxv(st.get('letter-spacing', '0px'), 0) or 0
            pad = pxv(st.get('padding-top', '0px'), 0) or 0
            padl = pxv(st.get('padding-left', '0px'), 0) or 0
            lines = wrap(d, txt, f, w - 2 * bw - padl, sp)
            lh = fs * 1.18
            if len(lines) * lh > h - pad + 2: problems.append('text overflows %s (%d lines of %dpx in %dpx): "%s"' % (k.id or sorted(k.base)[0], len(lines), fs, h, txt[:40]))
            sh = re.match(r'([\d.]+)px\s+([\d.]+)px', st.get('text-shadow', ''))
            for li, line in enumerate(lines):
                tw = d.textlength(line, font=f) + sp * (len(line) - 1)
                al = st.get('text-align', 'left')
                tx0 = bw + padl if al == 'left' else (w - tw) / 2 if al == 'center' else w - bw - tw - 2
                ty = bw + pad + li * lh - fs * 0.08
                def put(ox, oy, c):
                    cx_ = tx0 + ox
                    for ch in line:
                        d.text((cx_, ty + oy), ch, font=f, fill=c)
                        cx_ += d.textlength(ch, font=f) + sp
                if sh: put(float(sh.group(1)), float(sh.group(2)), (0, 0, 0, 255))
                put(0, 0, col)
        rot = re.search(r'rotateZ\(\s*(-?[\d.]+)deg', st.get('transform', '')) or re.match(r'(-?[\d.]+)deg', st.get('pre-transform-rotate2d', ''))
        if rot:
            layer = layer.rotate(-float(rot.group(1)), resample=Image.BICUBIC, expand=True)
            x -= (layer.width - w) / 2; y -= (layer.height - h) / 2
        if op < 1:
            a = layer.getchannel('A').point(lambda v: int(v * op)); layer.putalpha(a)
        img.alpha_composite(layer, (int(round(x)), int(round(y))))

# ---------------------------------------------------------------- CS2's own HUD (1080 high; see the Space Racer notes)
def cs2_zones(W, state):
    z = [('CS2 TEAM COUNTER', W / 2 - 360, 0, W / 2 + 360, 66),
         ('CS2 KILL FEED', W - 430, 72, W, 190),
         ('CS2 MONEY / HEALTH', 0, 1000, W, H),
         ('CS2 CHAT', 0, 800 if state in ('lobby', 'join') else 600, 576, 1010)]
    return z

def top_of(k):
    while k.parent is not None and k.parent is not ROOT: k = k.parent
    return k

def zone_check(items, W, state, allow=()):
    rect = {id(it[0]): it[1:5] for it in items}
    for (zn, x0, y0, x1, y1) in cs2_zones(W, state):
        hit = []
        for it in items:
            if not drawn(it): continue
            k, x, y, w, h = it[:5]
            if x < x1 and x + w > x0 and y < y1 and y + h > y0:
                t = top_of(k)
                if t not in hit: hit.append(t)
        for t in hit:
            nm = t.id or '.'.join(sorted(t.base))
            if (zn, nm) in allow: continue
            x, y, w, h = rect.get(id(t), (0, 0, 0, 0))
            problems.append('%s at %d wide: %s (%d,%d %dx%d) is under %s' % (state, W, nm, x, y, w, h, zn))

def zones_picture(img, W, state, name):
    im = img.convert('RGB')
    d = ImageDraw.Draw(im, 'RGBA')
    f = font(22)
    for (zn, x0, y0, x1, y1) in cs2_zones(W, state):
        d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=(255, 255, 255, 46), outline=(255, 255, 255, 220), width=3)
        d.text((x0 + 10, y0 + 6), zn, font=f, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    im.save(name)

# ---------------------------------------------------------------- states
def reset():
    def r(n):
        n.cls = set(n.base); n.text = n.static
        for k in n.kids: r(k)
    r(ROOT)
def cls(id_, *cs, on=True):
    for c in cs:
        (BYID[id_].cls.add if on else BYID[id_].cls.discard)(c)
def txt(id_, t): BYID[id_].text = t

def card(n, name, fighter, hp, col, wins=0, me=False):
    i = 'pb_c%d' % n
    cls(i, 'stShow', 'stCol%d' % col)
    if me: cls(i, 'stMe')
    txt(i + '_name', name); txt(i + '_fighter', fighter)
    for part in ('_fill', '_chip'):
        BYID[i + part].cls = set(c for c in BYID[i + part].cls if not re.match(r'^w\d+$', c)); cls(i + part, 'w%d' % hp)
    cls(i + '_chip', 'w%d' % min(100, hp + 12))
    BYID[i + '_chip'].cls.discard('w%d' % hp)
    if hp <= 25: cls(i, 'stLow')
    for p in range(1, 4):
        if wins >= p: cls('%s_pip%d' % (i, p), 'stWon')

KEYS = 'A/D move  ·  W jump  ·  S crouch  ·  MOUSE1 punch  ·  MOUSE2 kick  ·  SHIFT block  ·  R special  ·  F throw  ·  hold E to leave'

def fight_state(ko=False):
    reset()
    cls('pb_game', 'stMatch', 'stMode_duel'); cls('pb_game', 'stHidden', on=False)
    card(1, 'skink52', 'TIMBER', 64, 0, wins=1, me=True)
    card(2, 'Longnameplayer.', 'PIROUETTE', 8 if ko else 38, 1)     # the longest name the script lets through (14)
    txt('pb_timer', '47'); txt('pb_round', 'ROUND 2'); txt('pb_queue', 'NEXT UP: BOB  ·  STREAK: SKINK52 x2')
    if ko:
        cls('pb_c2', 'stKO'); txt('pb_announce', 'K.O.'); cls('pb_announce', 'stShow', 'stKo')
    else:
        cls('pb_k1', 'stShow', 'stTag', 'stCounter', 'stHits'); txt('pb_k1_tag', 'COUNTER'); txt('pb_k1_hits', '3'); txt('pb_k1_sub', '38 DMG')
        cls('pb_k2', 'stShow', 'stTag', 'stPerfect'); txt('pb_k2_tag', 'PERFECT BLOCK')

def win_state():
    fight_state(ko=True)
    BYID['pb_announce'].cls = set(BYID['pb_announce'].base)
    txt('pb_announce', 'SKINK52 WINS THE MATCH'); cls('pb_announce', 'stShow', 'stWin')

def intro_state():
    fight_state();
    for k in ('pb_k1', 'pb_k2'): BYID[k].cls = set(BYID[k].base)
    txt('pb_announce', 'FIGHT!'); cls('pb_announce', 'stShow', 'stFight')

def teams_state():
    reset()
    cls('pb_game', 'stMatch', 'stMode_teams', 'stStatus'); cls('pb_game', 'stHidden', on=False)
    card(1, 'skink52', 'TIMBER', 72, 0, wins=1, me=True); card(2, 'CPU 3', 'BRASS', 18, 1)
    card(3, 'Cara', 'MOTLEY  ·  BENCH', 41, 4); cls('pb_c3', 'stBench'); card(4, 'CPU 4', 'PIROUETTE  ·  BENCH', 90, 5); cls('pb_c4', 'stBench')
    txt('pb_timer', '8'); cls('pb_timer', 'stLow'); txt('pb_round', 'ROUND 3')
    cls('pb_k1', 'stShow', 'stTag', 'stFinish', 'stHits'); txt('pb_k1_tag', 'TIMBER FALL'); txt('pb_k1_hits', '5'); txt('pb_k1_sub', '61 DMG')
    txt('pb_pill_text', 'SHIFT+R: tag in Cara')

def lobby_state():
    reset()
    cls('pb_game', 'stLobby', 'stPick', 'stMode_duel'); cls('pb_game', 'stHidden', on=False)
    txt('pb_lobby_mode', 'MODE:  WINNER STAYS 1v1')
    rows = ['P1  skink52  ·  TIMBER  ·  READY', 'P2  Bob  ·  PIROUETTE  ·  picking...', 'P3  CPU 3  ·  BRASS  ·  CPU',
            'P4  open  ·  stand on pad 4 and press E']
    for i, r in enumerate(rows):
        txt('pb_lobby_s%d' % (i + 1), r)
    cls('pb_lobby_s1', 'stTaken', 'stReady', 'stMe'); cls('pb_lobby_s2', 'stTaken'); cls('pb_lobby_s3', 'stTaken', 'stReady')
    txt('pb_lobby_count', 'Waiting for everyone to press MOUSE1 (ready)'); txt('pb_lobby_hint', 'skink52 is host:  R change mode  ·  F add / clear CPUs')
    txt('pb_keys', KEYS)
    txt('pb_me', 'YOU: P1 RED  ·  TIMBER  ·  Sparring dummy, big gloves')
    txt('pb_moves', 'R: Knot Shot  ·  FWD+R: Haymaker  ·  DOWN+R: Rising Splinter')
    txt('pb_motions', 'or motions:  D,DF,F+P  ·  F,D,DF+P  ·  D,DB,B+K     COMBOS  P,P: Splitter  ·  P,P,K  ·  P,K: Root Sweep (LOW)  ·  K,K: Timber Fall')
    txt('pb_status', 'Locked in  ·  MOUSE2 to change')

def join_state():
    reset()
    cls('pb_game', 'stLobby'); cls('pb_game', 'stHidden', on=False)
    lobby_state(); BYID['pb_game'].cls.discard('stPick')
    cls('pb_joinhint', 'stShow'); txt('pb_joinhint_text', 'PRESS E TO PLAY  -  PAD 2')

def compose(W, bgpath):
    bg = Image.open(bgpath).convert('RGBA')
    sc = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * sc + 1), int(bg.height * sc + 1)), Image.BILINEAR)
    return bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))

def run(W, bgpath, name=None, state='fight', zones=True):
    ROOT.st = style(ROOT)
    root_w, root_h = pxv(ROOT.st.get('width'), W), pxv(ROOT.st.get('height'), H)
    items = [(ROOT, 0, 0, root_w, root_h, 0, float(ROOT.st.get('opacity', '1')), ROOT.st)]
    if 'stHidden' in ROOT.cls: items[0] = items[0][:6] + (0.0,) + items[0][7:]
    layout(ROOT, 0, 0, root_w, root_h, items[0][6], items, W)
    if zones: zone_check(items, W, state)
    if name:
        img = compose(W, bgpath).copy()
        draw(items, img)
        img.convert('RGB').save(name)
        return img

shots = {}
fight_state(); shots['fight'] = run(1920, BG, PREFIX + '_fight.png')
zones_picture(shots['fight'], 1920, 'fight', PREFIX + '_cs2.png')
fight_state(); run(2333, BG_WIDE, PREFIX + '_fight_wide.png')
fight_state(); run(1440, BG_43, PREFIX + '_fight_43.png', zones=False)       # 4:3: CS2's team counter takes half the top
fight_state(ko=True); run(1920, BG, PREFIX + '_ko.png', 'ko')
intro_state(); run(1920, BG, PREFIX + '_intro.png', 'intro')
win_state(); run(1920, BG, PREFIX + '_win.png', 'win')
win_state(); run(1440, BG_43, PREFIX + '_win_43.png', 'win', zones=False)
teams_state(); run(1920, BG, PREFIX + '_teams.png', 'teams')
lobby_state(); run(1920, BG, PREFIX + '_lobby.png', 'lobby')
join_state(); run(1920, BG, PREFIX + '_join.png', 'join')
for W in (2333,):
    for f, st in ((fight_state, 'fight'), (teams_state, 'teams'), (lobby_state, 'lobby'), (join_state, 'join')):
        f(); run(W, BG_WIDE, None, st)
seen = []
for p in problems:
    if p not in seen: seen.append(p); print('LAYOUT:', p)
print('hud preview ->', PREFIX + '_*.png', '(%d layout notes)' % len(seen))
sys.exit(1 if seen else 0)
