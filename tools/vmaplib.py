"""Building blocks for writing Hammer .vmap content with dmx9: map meshes (boxes, prisms, any
closed polygon mesh), entities, props, lights, particles and world text. A MapBuilder also
records what it adds as a plain scene description (boxes, props, lights) for offline previews."""
import math, random
import dmx9
from dmx9 import Element, T_ELEMENT, T_INT, T_FLOAT, T_BOOL, T_STRING, T_COLOR, T_VEC2, T_VEC3, T_VEC4, T_QANGLE, T_UINT64, ARRAY

TEX = 512.0   # texture size assumed for UVs (Hammer re-derives them from the face axes when edited)


def axes_for(n):
    ax = max(range(3), key=lambda i: abs(n[i]))
    if ax == 2: return (1.0, 0.0, 0.0), (0.0, -1.0, 0.0)
    if ax == 0: return (0.0, 1.0 if n[0] < 0 else -1.0, 0.0), (0.0, 0.0, -1.0)
    return (1.0 if n[1] > 0 else -1.0, 0.0, 0.0), (0.0, 0.0, -1.0)


def stream(name, attr, sem, data, t, loc=0, flags=1):
    s = Element("CDmePolygonMeshDataStream", name)
    s.set("standardAttributeName", T_STRING, attr); s.set("semanticName", T_STRING, sem); s.set("semanticIndex", T_INT, 0)
    s.set("vertexBufferLocation", T_INT, loc); s.set("dataStateFlags", T_INT, flags); s.set("subdivisionBinding", T_ELEMENT, None)
    s.set("data", t | ARRAY, data)
    return s


def data_array(size, streams):
    a = Element("CDmePolygonMeshDataArray", "")
    a.set("size", T_INT, size); a.set("streams", T_ELEMENT | ARRAY, streams)
    return a


def polymesh(verts, faces, origin, scale=0.25):
    """verts: local positions; faces: [(vertex loop CCW seen from outside, material)]"""
    matlist = []
    for _, m in faces:
        if m not in matlist: matlist.append(m)
    he = {}
    ev, eo, en, ef, ed, evd = [], [], [], [], [], []

    def half(a, b):
        if (a, b) in he: return he[(a, b)]
        i = len(ev)
        ev.extend([b, a]); eo.extend([i + 1, i]); en.extend([-1, -1]); ef.extend([-1, -1]); ed.extend([i // 2, i // 2]); evd.extend([i, i + 1])
        he[(a, b)] = i; he[(b, a)] = i + 1
        return i
    face_edges = []
    for f, (loop, m) in enumerate(faces):
        hs = [half(loop[i], loop[(i + 1) % len(loop)]) for i in range(len(loop))]
        for i, h in enumerate(hs):
            en[h] = hs[(i + 1) % len(hs)]; ef[h] = f
        face_edges.append(hs[0])
    assert all(x >= 0 for x in ef), "open mesh"
    vedge = [0] * len(verts)
    for (a, b), h in he.items():
        if ef[h] >= 0: vedge[a] = h
    nh = len(ev)
    tex = [(0.0, 0.0)] * nh; nor = [(0.0, 0.0, 0.0)] * nh; tan = [(0.0, 0.0, 0.0, 0.0)] * nh
    fscale, fu, fv, fmat = [], [], [], []
    for f, (loop, m) in enumerate(faces):
        P = [verts[i] for i in loop]
        n = [0.0, 0.0, 0.0]
        for i in range(len(P)):
            a, b = P[i], P[(i + 1) % len(P)]
            n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0]
        l = math.sqrt(sum(c * c for c in n)) or 1; n = tuple(c / l for c in n)
        U, V = axes_for(n)
        fscale.append((scale, scale)); fu.append(U + (0.0,)); fv.append(V + (0.0,)); fmat.append(matlist.index(m))
        h = face_edges[f]
        while True:
            p = verts[ev[h]]
            pw = (p[0] + origin[0], p[1] + origin[1], p[2] + origin[2])
            tex[h] = (sum(pw[i] * U[i] for i in range(3)) / scale / TEX, sum(pw[i] * V[i] for i in range(3)) / scale / TEX)
            nor[h] = n; tan[h] = U + (-1.0,)
            h = en[h]
            if h == face_edges[f]: break
    md = Element("CDmePolygonMesh", "meshData")
    md.set("vertexEdgeIndices", T_INT | ARRAY, vedge); md.set("vertexDataIndices", T_INT | ARRAY, list(range(len(verts))))
    md.set("edgeVertexIndices", T_INT | ARRAY, ev); md.set("edgeOppositeIndices", T_INT | ARRAY, eo); md.set("edgeNextIndices", T_INT | ARRAY, en)
    md.set("edgeFaceIndices", T_INT | ARRAY, ef); md.set("edgeDataIndices", T_INT | ARRAY, ed); md.set("edgeVertexDataIndices", T_INT | ARRAY, evd)
    md.set("faceEdgeIndices", T_INT | ARRAY, face_edges); md.set("faceDataIndices", T_INT | ARRAY, list(range(len(faces))))
    md.set("materials", T_STRING | ARRAY, matlist)
    md.set("vertexData", T_ELEMENT, data_array(len(verts), [stream("position:0", "position", "position", [tuple(map(float, v)) for v in verts], T_VEC3, flags=3)]))
    md.set("faceVertexData", T_ELEMENT, data_array(nh, [
        stream("texcoord:0", "texcoord", "texcoord", tex, T_VEC2), stream("normal:0", "normal", "normal", nor, T_VEC3),
        stream("tangent:0", "tangent", "tangent", tan, T_VEC4), stream("PerVertexLighting:0", "", "PerVertexLighting", [(1.0, 1.0, 1.0, 0.0)] * nh, T_VEC4, loc=1)]))
    md.set("edgeData", T_ELEMENT, data_array(nh // 2, [stream("flags:0", "flags", "flags", [0] * (nh // 2), T_INT, flags=3)]))
    md.set("faceData", T_ELEMENT, data_array(len(faces), [
        stream("textureScale:0", "textureScale", "textureScale", fscale, T_VEC2, flags=0),
        stream("textureAxisU:0", "textureAxisU", "textureAxisU", fu, T_VEC4, flags=0),
        stream("textureAxisV:0", "textureAxisV", "textureAxisV", fv, T_VEC4, flags=0),
        stream("materialindex:0", "materialindex", "materialindex", fmat, T_INT, flags=8),
        stream("flags:0", "flags", "flags", [0] * len(faces), T_INT, flags=3),
        stream("lightmapScaleBias:0", "lightmapScaleBias", "lightmapScaleBias", [0] * len(faces), T_INT)]))
    sub = Element("CDmePolygonMeshSubdivisionData", "")
    sub.set("subdivisionLevels", T_INT | ARRAY, [0] * nh); sub.set("streams", T_ELEMENT | ARRAY, [])
    md.set("subdivisionData", T_ELEMENT, sub)
    return md


LIGHT_BASE = {"vscripts": "", "targetname": "", "parentname": "", "parentAttachmentName": "", "useLocalOffset": "0", "local__origin": "", "local__angles": "",
              "local__scales": "1 1 1", "clientSideEntity": "1", "brightness_units": "1", "enabled": "1", "directlight": "1", "colormode": "0",
              "colortemperature": "6600", "skirt": "0.1", "bouncelight": "-1", "bouncescale": "1.0", "shape": "0", "size_params": "2.0 24.0 0.15",
              "lightcookie": "", "bakespeculartocubemaps": "0", "bakespeculartocubemaps_scale": "1.0", "minroughness": "0", "shadowmapsize": "-1",
              "shadowpriority": "-1", "pvs_modify_entity": "0", "shadowfade_size_start": ".10", "shadowfade_size_end": ".05", "brightnessscale": "1.0",
              "rendertocubemaps": "1", "showlight": "0", "fade_size_start": ".05", "fade_size_end": ".025", "transmit_always": "0", "light_style": ""}


class MapBuilder:
    def __init__(self, dm, seed=1):
        self.dm = dm
        self.root = dm.root
        self.world = dm.root["world"]
        self.children = self.world["children"]
        ids = [e.get("nodeID", 0) for e in dm.elements if "nodeID" in e]
        self.next = max(ids + [0]) + 1
        self.rng = random.Random(seed)
        self.scene = {"boxes": [], "meshes": [], "props": [], "lights": [], "particles": []}

    def nid(self):
        self.next += 1
        return self.next

    def rid(self):
        return self.rng.getrandbits(63)

    def add(self, *items):
        for it in items: self.children.append(it)

    # -------------------------------------------------------------- entities
    def entity(self, cls, origin, angles=(0, 0, 0), props=None, scales=(1, 1, 1), kids=(), conns=()):
        e = Element("CMapEntity", "")
        e.set("nodeID", T_INT, self.nid()); e.set("referenceID", T_UINT64, self.rid())
        e.set("children", T_ELEMENT | ARRAY, list(kids))
        e.set("variableTargetKeys", T_STRING | ARRAY, []); e.set("variableNames", T_STRING | ARRAY, [])
        plug = Element("DmePlugList", "")
        plug.set("names", T_STRING | ARRAY, []); plug.set("dataTypes", T_INT | ARRAY, []); plug.set("plugTypes", T_INT | ARRAY, []); plug.set("descriptions", T_STRING | ARRAY, [])
        e.set("relayPlugData", T_ELEMENT, plug)
        cl = []
        for (out, target, inp, param, delay) in conns:
            c = Element("DmeConnectionData", "")
            c.set("outputName", T_STRING, out); c.set("targetType", T_INT, 7); c.set("targetName", T_STRING, target)
            c.set("inputName", T_STRING, inp); c.set("overrideParam", T_STRING, param); c.set("delay", T_FLOAT, float(delay)); c.set("timesToFire", T_INT, -1)
            cl.append(c)
        e.set("connectionsData", T_ELEMENT | ARRAY, cl)
        ep = Element("EditGameClassProps", "")
        ep.set("classname", T_STRING, cls)
        for k, v in (props or {}).items(): ep.set(k.replace("__", "."), T_STRING, str(v))
        e.set("entity_properties", T_ELEMENT, ep)
        e.set("hitNormal", T_VEC3, (0.0, 0.0, 1.0)); e.set("isProceduralEntity", T_BOOL, 0)
        e.set("origin", T_VEC3, tuple(float(v) for v in origin)); e.set("angles", T_QANGLE, tuple(float(v) for v in angles))
        e.set("scales", T_VEC3, tuple(float(v) for v in scales))
        e.set("transformLocked", T_BOOL, 0); e.set("force_hidden", T_BOOL, 0); e.set("editorOnly", T_BOOL, 0)
        return e

    def mapmesh(self, md, origin, physics="default", tint=(255, 255, 255, 255)):
        m = Element("CMapMesh", "")
        for k, t, v in [("nodeID", T_INT, self.nid()), ("referenceID", T_UINT64, self.rid()), ("children", T_ELEMENT | ARRAY, []),
                        ("variableTargetKeys", T_STRING | ARRAY, []), ("variableNames", T_STRING | ARRAY, []),
                        ("cubeMapName", T_STRING, ""), ("lightGroup", T_STRING, ""), ("visexclude", T_BOOL, 0), ("disablemerging", T_BOOL, 0),
                        ("renderwithdynamic", T_BOOL, 0), ("disableHeightDisplacement", T_BOOL, 0), ("fademindist", T_FLOAT, -1.0), ("fademaxdist", T_FLOAT, 0.0),
                        ("bakelighting", T_BOOL, 1), ("precomputelightprobes", T_BOOL, 1), ("renderToCubemaps", T_BOOL, 1), ("emissiveLightingEnabled", T_BOOL, 1),
                        ("emissiveLightingBoost", T_FLOAT, 1.0), ("disableShadows", T_INT, 0), ("lightingDummy", T_BOOL, 0), ("smoothingAngle", T_FLOAT, 40.0),
                        ("tintColor", T_COLOR, tint), ("renderAmt", T_INT, 255), ("physicsType", T_STRING, physics), ("physicsGroup", T_STRING, ""),
                        ("physicsInteractsAs", T_STRING, ""), ("physicsInteractsWith", T_STRING, ""), ("physicsInteractsExclude", T_STRING, ""),
                        ("meshData", T_ELEMENT, md), ("physicsSimplificationOverride", T_BOOL, 0), ("physicsSimplificationError", T_FLOAT, 0.0),
                        ("origin", T_VEC3, tuple(map(float, origin))), ("angles", T_QANGLE, (0.0, 0.0, 0.0)), ("scales", T_VEC3, (1.0, 1.0, 1.0)),
                        ("transformLocked", T_BOOL, 0), ("force_hidden", T_BOOL, 0), ("editorOnly", T_BOOL, 0)]:
            m.set(k, t, v)
        return m

    # -------------------------------------------------------------- geometry
    def box(self, x0, x1, y0, y1, z0, z1, mat, side=None, top=None, bottom=None, front=None, back=None, physics="default", add=True):
        """Axis box. mat for all faces unless overridden: top/bottom/side, front = -Y face, back = +Y face."""
        x0, x1 = min(x0, x1), max(x0, x1); y0, y1 = min(y0, y1), max(y0, y1); z0, z1 = min(z0, z1), max(z0, z1)
        o = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        hx, hy, hz = (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2
        V = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz), (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
        s = side or mat
        F = [((4, 5, 6, 7), top or mat), ((0, 3, 2, 1), bottom or mat),
             ((0, 1, 5, 4), front or s), ((2, 3, 7, 6), back or s), ((1, 2, 6, 5), s), ((3, 0, 4, 7), s)]
        mm = self.mapmesh(polymesh(V, F, o), o, physics)
        if not mat.startswith("materials/tools/"):
            self.scene["boxes"].append({"min": [x0, y0, z0], "max": [x1, y1, z1], "mats": {"top": top or mat, "bottom": bottom or mat, "front": front or s, "back": back or s, "side": s}})
        if add: self.add(mm)
        return mm

    def prism(self, cx, cy, z0, z1, r, mat, sides=12, cap=None, rot=0.0, physics="default", add=True):
        """Vertical n-sided prism (round-ish pillar)."""
        o = (cx, cy, (z0 + z1) / 2)
        h = (z1 - z0) / 2
        V = []
        for k in range(sides):
            a = rot + 2 * math.pi * k / sides
            V.append((r * math.cos(a), r * math.sin(a), -h))
        for k in range(sides):
            a = rot + 2 * math.pi * k / sides
            V.append((r * math.cos(a), r * math.sin(a), h))
        F = [(tuple(range(sides, 2 * sides)), cap or mat), (tuple(reversed(range(sides))), cap or mat)]
        for k in range(sides):
            a, b = k, (k + 1) % sides
            F.append(((a, b, sides + b, sides + a), mat))
        mm = self.mapmesh(polymesh(V, F, o), o, physics)
        self.scene["meshes"].append({"verts": [[v[0] + o[0], v[1] + o[1], v[2] + o[2]] for v in V], "faces": [[list(l), m] for l, m in F]})
        if add: self.add(mm)
        return mm

    def annulus(self, cx, cy, z0, z1, r0, r1, mat, sides=48, physics="default"):
        """Flat ring (washer) between radii r0 and r1, e.g. lines painted on a floor."""
        o = (cx, cy, (z0 + z1) / 2)
        h = (z1 - z0) / 2
        V = []
        for (r, z) in ((r0, -h), (r1, -h), (r0, h), (r1, h)):
            for k in range(sides):
                a = 2 * math.pi * k / sides
                V.append((r * math.cos(a), r * math.sin(a), z))
        ib, ob, it, ot = 0, sides, 2 * sides, 3 * sides
        F = []
        for k in range(sides):
            a, b = k, (k + 1) % sides
            F.append(((it + a, ot + a, ot + b, it + b), mat))      # top
            F.append(((ib + a, ib + b, ob + b, ob + a), mat))      # bottom
            F.append(((ob + a, ob + b, ot + b, ot + a), mat))      # outer side
            F.append(((ib + b, ib + a, it + a, it + b), mat))      # inner side
        mm = self.mapmesh(polymesh(V, F, o), o, physics)
        self.scene["meshes"].append({"verts": [[v[0] + o[0], v[1] + o[1], v[2] + o[2]] for v in V], "faces": [[list(l), m] for l, m in F]})
        self.add(mm)
        return mm

    def prop(self, model, origin, angles=(0, 0, 0), scales=(1, 1, 1), solid="0", props=None, color=None, static=True):
        p = {"model": model, "solid": solid, "rendercolor": "255 255 255" if not color else "%d %d %d" % tuple(color), "skin": "default",
             "disableshadows": "0", "emissive": "1", "emissive_lighting_boost": "1.0", "bakelighting": "-1", "rendertocubemaps": "1"}
        p.update(props or {})
        if isinstance(scales, (int, float)): scales = (scales, scales, scales)
        e = self.entity("prop_static" if static else "prop_dynamic", origin, angles, p, scales)
        self.scene["props"].append({"model": model, "origin": list(origin), "angles": list(angles), "scales": list(scales), "color": color})
        self.add(e)
        return e

    def light(self, origin, color, lumens, rng, angles=(90, 0, 0), cone=180, shadows=0, style="", direct=1):
        """direct: 1 static (baked), 2 stationary (lights moving things per pixel and can flicker; at most 4 may overlap)"""
        p = dict(LIGHT_BASE)
        p.update({"color": "%d %d %d 255" % color, "brightness_lumens": str(lumens), "brightness": "%.4f" % (lumens / 2560),
                  "brightness_legacy": "%.3f" % (lumens / 1000), "range": str(rng), "outer_angle": "%.1f" % cone,
                  "inner_angle": "%.1f" % (cone * 0.75 if cone < 180 else 180), "castshadows": str(shadows), "light_style": style,
                  "directlight": str(direct)})
        e = self.entity("light_omni2", origin, angles, p)
        self.scene["lights"].append({"origin": list(origin), "color": list(color), "lumens": lumens, "range": rng, "angles": list(angles), "cone": cone})
        self.add(e)
        return e

    def particle(self, effect, origin, angles=(0, 0, 0), name=""):
        p = {"targetname": name, "effect_name": effect, "start_active": "1", "flag_as_weather": "0", "cpoint1": "", "spawnflags": "0"}
        e = self.entity("info_particle_system", origin, angles, p)
        self.scene["particles"].append({"effect": effect, "origin": list(origin)})
        self.add(e)
        return e

    def text(self, msg, origin, size=30, color=(255, 255, 255), units=0.25, face=(0, 90, 0), name=""):
        p = {"targetname": name, "message": msg, "enabled": "1", "fullbright": "1", "color": "%d %d %d 255" % color, "world_units_per_pixel": str(units),
             "font_size": str(size), "font_name": "Arial Black", "justify_horizontal": "1", "justify_vertical": "1", "reorient_mode": "0",
             "depth_render_offset": "0.125", "rendercolor": "255 255 255", "renderamt": "255", "rendermode": "kRenderNormal", "renderfx": "kRenderFxNone"}
        e = self.entity("point_worldtext", origin, face, p)
        self.add(e)
        return e
