#!/usr/bin/env python3
"""Generates the gem SVGs in this folder.

Every gem shares one art direction so the set reads as a family:
  * one light source (upper-left), facets shaded by how much they face it
  * the same outline weight, drawn in each gem's darkest tone
  * the same four-point sparkle in the upper-left
  * a distinct silhouette per gem, so they're tellable apart without color

Run `python3 generate.py` after editing a palette or shape.
"""
import math
from pathlib import Path

OUT = Path(__file__).parent
LIGHT = (-0.55, -0.83)  # direction the light comes from (x right, y down)
STROKE = 3.2

# light, mid, dark, outline
PALETTES = {
    'white': ('#ffffff', '#c6dcec', '#6f93ad', '#3f5868'),   # Diamond
    'blue':  ('#8cbcff', '#2c66d8', '#12307a', '#0a1c4a'),   # Sapphire
    'green': ('#7cf0a6', '#1fa257', '#0b5a2d', '#06361b'),   # Emerald
    'red':   ('#ff8f8f', '#d82a3c', '#7c0e1d', '#480712'),   # Ruby
    'black': ('#8a8a96', '#34343c', '#101014', '#000000'),   # Onyx
    'gold':  ('#fff1a8', '#f2c14e', '#a8740e', '#5e3f04'),   # Gold
}


# ---------- helpers ----------
def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v))) for v in c)


def mix(a, b, t):
    a, b = hex2rgb(a), hex2rgb(b)
    return rgb2hex(tuple(x + (y - x) * t for x, y in zip(a, b)))


def shade(pal, t):
    """t in [0,1]: 0 = darkest facet, 1 = brightest facet."""
    light, mid, dark, _ = pal
    t = max(0.0, min(1.0, t))
    return mix(dark, mid, t / 0.6) if t < 0.6 else mix(mid, light, (t - 0.6) / 0.4)


def facing(nx, ny):
    """How much a facet with outward normal (nx, ny) faces the light, 0..1."""
    l = math.hypot(*LIGHT)
    n = math.hypot(nx, ny) or 1
    return 0.5 + 0.5 * (nx * LIGHT[0] + ny * LIGHT[1]) / (n * l)


def pts(p):
    return ' '.join(f'{x:.2f},{y:.2f}' for x, y in p)


def poly(p, fill, extra=''):
    return f'<polygon points="{pts(p)}" fill="{fill}"{extra}/>'


def sparkle(x, y, r):
    k = r * 0.22
    d = (f'M{x},{y - r} Q{x + k},{y - k} {x + r},{y} Q{x + k},{y + k} {x},{y + r} '
         f'Q{x - k},{y + k} {x - r},{y} Q{x - k},{y - k} {x},{y - r}Z')
    return (f'<path d="{d}" fill="#fff" opacity=".95"/>'
            f'<circle cx="{x}" cy="{y}" r="{r * 0.18:.2f}" fill="#fff"/>')


def svg(body, defs=''):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<defs>{defs}</defs>{body}</svg>\n')


def scaled(shape, cx, cy, s):
    return [(cx + (x - cx) * s, cy + (y - cy) * s) for x, y in shape]


def faceted(shape, pal, cx, cy, rings, star=True, smooth_outline=None):
    """Face-up cut: concentric rings of facets around a table.

    shape  -- convex outline polygon (clockwise)
    rings  -- scale factors from outside in, e.g. [1, .55] (last one is the table)
    star   -- split each facet on a diagonal for a brilliant-cut sparkle
    """
    out = []
    n = len(shape)
    layers = [scaled(shape, cx, cy, s) for s in rings]
    for r in range(len(layers) - 1):
        outer, inner = layers[r], layers[r + 1]
        depth = r / max(1, len(layers) - 1)
        for i in range(n):
            j = (i + 1) % n
            a, b, c, d = outer[i], outer[j], inner[j], inner[i]
            mx, my = (a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy
            t = facing(mx, my) * 0.9 + 0.05 + depth * 0.08
            if star:
                out.append(poly([a, b, c], shade(pal, t + 0.07)))
                out.append(poly([a, c, d], shade(pal, t - 0.07)))
            else:
                out.append(poly([a, b, c, d], shade(pal, t)))
    table = layers[-1]
    out.append(poly(table, 'url(#table)'))
    # facet edges
    edges = []
    for layer in layers[1:]:
        edges.append(f'<polygon points="{pts(layer)}"/>')
    for i in range(n):
        edges.append(f'<polyline points="{pts([l[i] for l in layers])}"/>')
    out.append(f'<g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".9" '
               f'stroke-linejoin="round">{"".join(edges)}</g>')
    outline = smooth_outline or f'<polygon points="{pts(shape)}"/>'
    body = (f'<g clip-path="url(#clip)">{"".join(out)}</g>'
            f'<g fill="none" stroke="{pal[3]}" stroke-width="{STROKE}" '
            f'stroke-linejoin="round">{outline}</g>')
    clip = f'<clipPath id="clip">{outline}</clipPath>'
    table_grad = (f'<linearGradient id="table" x1="0" y1="0" x2="1" y2="1">'
                  f'<stop offset="0" stop-color="{shade(pal, .95)}"/>'
                  f'<stop offset=".55" stop-color="{shade(pal, .62)}"/>'
                  f'<stop offset="1" stop-color="{shade(pal, .4)}"/></linearGradient>')
    return body, clip + table_grad


def regular(n, cx, cy, rx, ry, rot=0.0):
    return [(cx + rx * math.cos(rot + 2 * math.pi * k / n),
             cy + ry * math.sin(rot + 2 * math.pi * k / n)) for k in range(n)]


# ---------- the gems ----------
def diamond(pal):
    """Classic brilliant in profile: crown on top, pavilion to a point."""
    top_y, gird_y, culet = 20, 40, (50, 91)
    tops = [30, 43.33, 56.67, 70]
    girds = [7, 21.33, 35.67, 50, 64.33, 78.67, 93]
    T = [(x, top_y) for x in tops]
    G = [(x, gird_y) for x in girds]
    f = []
    # crown: zig-zag of triangles between table edge and girdle
    crown = [
        [G[0], T[0], G[1]], [G[1], T[0], G[2]], [T[0], T[1], G[2]], [G[2], T[1], G[3]],
        [T[1], T[2], G[3]], [G[3], T[2], G[4]], [T[2], T[3], G[4]], [G[4], T[3], G[5]],
        [G[5], T[3], G[6]],
    ]
    for tri in crown:
        x = sum(p[0] for p in tri) / 3
        up = tri.count(G[0]) == 0 and sum(1 for p in tri if p[1] == top_y) == 2
        t = 1.0 - (x - 7) / 86 * 0.6 + (0.12 if up else -0.06)
        f.append(poly(tri, shade(pal, t)))
    # pavilion: fan to the culet
    for i in range(len(G) - 1):
        x = (G[i][0] + G[i + 1][0]) / 2
        t = 0.85 - (x - 7) / 86 * 0.85 + (0.12 if i % 2 == 0 else -0.06)
        f.append(poly([G[i], G[i + 1], culet], shade(pal, t)))
    lines = (f'<polyline points="{pts([G[0], G[6]])}"/>'
             + ''.join(f'<polyline points="{pts([g, culet])}"/>' for g in G[1:-1])
             + ''.join(f'<polygon points="{pts(t)}"/>' for t in crown[2:8:2]))
    outline = poly([T[0], T[3], G[6], culet, G[0]], 'none')
    body = (''.join(f)
            + f'<g fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".9" '
              f'stroke-linejoin="round">{lines}</g>'
            + f'<g fill="none" stroke="{pal[3]}" stroke-width="{STROKE}" '
              f'stroke-linejoin="round">{outline}</g>'
            + sparkle(26, 24, 9))
    return svg(body)


def sapphire(pal):
    """Oval brilliant, face up."""
    cx, cy, rx, ry = 50, 52, 33, 41
    shape = regular(10, cx, cy, rx * 1.03, ry * 1.03, -math.pi / 2)
    outline = f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/>'
    body, defs = faceted(shape, pal, cx, cy, [1.3, 0.52], smooth_outline=outline)
    return svg(body + sparkle(30, 24, 9), defs)


def emerald(pal):
    """Emerald step cut: clipped rectangle with stepped rings, no star facets."""
    cx, cy, w, h, c = 50, 52, 76, 58, 15
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2
    shape = [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c),
             (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]
    body, defs = faceted(shape, pal, cx, cy, [1, 0.8, 0.62, 0.46], star=False)
    return svg(body + sparkle(22, 26, 9), defs)


def ruby(pal):
    """Hexagonal brilliant, face up."""
    cx, cy = 50, 52
    shape = regular(6, cx, cy, 43, 41, -math.pi / 2)
    body, defs = faceted(shape, pal, cx, cy, [1, 0.5])
    return svg(body + sparkle(26, 24, 9), defs)


def onyx(pal):
    """Polished banded cabochon, the one gem without facets."""
    light, mid, dark, line = pal
    cx, cy, r = 50, 52, 40
    defs = (f'<radialGradient id="dome" cx=".38" cy=".32" r=".75">'
            f'<stop offset="0" stop-color="{light}"/><stop offset=".35" stop-color="{mid}"/>'
            f'<stop offset="1" stop-color="{dark}"/></radialGradient>'
            f'<radialGradient id="shine" cx=".5" cy=".5" r=".5">'
            f'<stop offset="0" stop-color="#fff" stop-opacity=".9"/>'
            f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
            f'<clipPath id="clip"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>')
    bands = ''.join(
        f'<ellipse cx="{cx + 8}" cy="{cy + 34}" rx="{rr}" ry="{rr * 0.62:.1f}" '
        f'fill="none" stroke="#fff" stroke-opacity="{op}" stroke-width="2.2"/>'
        for rr, op in ((34, .12), (48, .08)))
    body = (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#dome)"/>'
            f'<g clip-path="url(#clip)">{bands}</g>'
            f'<ellipse cx="38" cy="36" rx="17" ry="10" transform="rotate(-35 38 36)" '
            f'fill="url(#shine)"/>'
            f'<path d="M{cx - 30},{cy + 18} A{r - 6},{r - 6} 0 0 0 {cx + 26},{cy + 24}" '
            f'fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2.5" '
            f'stroke-linecap="round"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{line}" '
            f'stroke-width="{STROKE}"/>'
            + sparkle(28, 26, 9))
    return svg(body, defs)


def gold(pal):
    """A hand-struck Spanish gold doubloon (the wild token): lumpy cob edge,
    beaded border and an embossed Jerusalem cross."""
    light, mid, dark, line = pal
    cx, cy, r = 50, 49, 39
    # irregular "cob" edge, deterministic so the coin never changes between runs
    wobble = [0, .05, .02, -.03, .04, .06, .01, -.04, -.02, .03, .05, -.01,
              -.05, .02, .04, -.02, .03, .06, .0, -.03, .02, .05, -.01, .03]
    edge = [(cx + r * (1 + w * .45) * math.cos(2 * math.pi * k / len(wobble)),
             cy + r * (1 + w * .45) * 0.97 * math.sin(2 * math.pi * k / len(wobble)))
            for k, w in enumerate(wobble)]

    def smooth(points):
        """Closed Catmull-Rom curve through the points, as an SVG path."""
        n = len(points)
        d = f'M{points[0][0]:.2f},{points[0][1]:.2f}'
        for i in range(n):
            p0, p1, p2, p3 = (points[(i + k) % n] for k in (-1, 0, 1, 2))
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += f' C{c1[0]:.2f},{c1[1]:.2f} {c2[0]:.2f},{c2[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}'
        return d + 'Z'

    face = smooth(edge)
    rim_in = smooth(scaled(edge, cx, cy, 0.8))
    thickness = 4
    defs = (f'<radialGradient id="face" cx=".36" cy=".3" r=".8">'
            f'<stop offset="0" stop-color="{shade(pal, 1)}"/>'
            f'<stop offset=".45" stop-color="{shade(pal, .7)}"/>'
            f'<stop offset="1" stop-color="{shade(pal, .38)}"/></radialGradient>'
            f'<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{shade(pal, 1)}"/>'
            f'<stop offset=".5" stop-color="{shade(pal, .6)}"/>'
            f'<stop offset="1" stop-color="{shade(pal, .2)}"/></linearGradient>'
            f'<linearGradient id="field" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{shade(pal, .42)}"/>'
            f'<stop offset="1" stop-color="{shade(pal, .62)}"/></linearGradient>'
            f'<linearGradient id="raised" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{shade(pal, 1)}"/>'
            f'<stop offset="1" stop-color="{shade(pal, .78)}"/></linearGradient>')

    def cross_paths(ox, oy):
        """Jerusalem cross: a cross potent with a small cross in each quarter."""
        a, b, t = 16, 4.2, 3.4  # arm length, arm half-width, crossbar half-length
        x, y = cx + ox, cy + oy
        big = (f'M{x - b},{y - a} h{2 * b} v{a - b} h{a - b} v{2 * b} h{-(a - b)} '
               f'v{a - b} h{-2 * b} v{-(a - b)} h{-(a - b)} v{-2 * b} h{a - b}Z')
        bars = ''.join(f'<rect x="{x + dx - w / 2}" y="{y + dy - h / 2}" width="{w}" height="{h}"/>'
                       for dx, dy, w, h in ((0, -a, 2 * t + 2 * b, 3), (0, a, 2 * t + 2 * b, 3),
                                            (-a, 0, 3, 2 * t + 2 * b), (a, 0, 3, 2 * t + 2 * b)))
        small = ''.join(f'<rect x="{x + sx * 9 - 1.1}" y="{y + sy * 9 - 3.6}" width="2.2" height="7.2"/>'
                        f'<rect x="{x + sx * 9 - 3.6}" y="{y + sy * 9 - 1.1}" width="7.2" height="2.2"/>'
                        for sx in (-1, 1) for sy in (-1, 1))
        return f'<path d="{big}"/>{bars}{small}'

    beads = ''.join(
        f'<circle cx="{cx + 25.5 * math.cos(2 * math.pi * k / 22):.2f}" '
        f'cy="{cy + 25 * math.sin(2 * math.pi * k / 22):.2f}" r="1.5"/>' for k in range(22))
    body = (
        # coin edge (thickness), then the face on top
        f'<path d="{face}" transform="translate(0 {thickness})" fill="{shade(pal, .15)}" '
        f'stroke="{line}" stroke-width="{STROKE}" stroke-linejoin="round"/>'
        f'<path d="{face}" fill="url(#rim)"/>'
        f'<path d="{rim_in}" fill="url(#field)" stroke="{shade(pal, .25)}" stroke-width="1.6"/>'
        f'<path d="{rim_in}" fill="none" stroke="{shade(pal, 1)}" stroke-opacity=".7" '
        f'stroke-width="1" transform="translate(.8 .8)"/>'
        f'<g fill="{shade(pal, .2)}">{beads}</g>'
        # embossed cross: dark offset shadow, then raised light face
        f'<g fill="{shade(pal, .1)}">{cross_paths(1.3, 1.5)}</g>'
        f'<g fill="url(#raised)">{cross_paths(0, 0)}</g>'
        f'<path d="{face}" fill="none" stroke="{line}" stroke-width="{STROKE}" stroke-linejoin="round"/>'
        + sparkle(25, 22, 9))
    return svg(body, defs)


def jolly_roger(_pal=None):
    """Skull and crossbones emblem for card backs, in bone tones."""
    bone, bone_mid, bone_dark, line = '#fbf3dc', '#e3d3a6', '#a8936a', '#2a1d10'
    defs = (f'<radialGradient id="bone" cx=".35" cy=".3" r=".9">'
            f'<stop offset="0" stop-color="{bone}"/><stop offset=".6" stop-color="{bone_mid}"/>'
            f'<stop offset="1" stop-color="{bone_dark}"/></radialGradient>')

    def bone_shape(angle):
        knobs = ''.join(f'<circle cx="{x}" cy="{y}" r="6"/>'
                        for x, y in ((8, 46), (8, 56), (92, 46), (92, 56)))
        return (f'<g transform="rotate({angle} 50 51)">'
                f'<rect x="8" y="47" width="84" height="8" rx="3"/>{knobs}</g>')

    bones = bone_shape(32) + bone_shape(-32)
    skull = ('M50,14 C70,14 80,27 80,42 C80,51 76,57 70,60 L70,68 C70,71 67,73 64,73 '
             'L36,73 C33,73 30,71 30,68 L30,60 C24,57 20,51 20,42 C20,27 30,14 50,14Z')
    body = (
        f'<g fill="url(#bone)" stroke="{line}" stroke-width="{STROKE}">{bones}</g>'
        f'<g transform="translate(50 44) scale(.82) translate(-50 -44)">'
        f'<path d="{skull}" fill="url(#bone)" stroke="{line}" stroke-width="{STROKE}" '
        f'stroke-linejoin="round"/>'
        f'<g fill="{line}">'
        f'<ellipse cx="39" cy="44" rx="7.5" ry="8.5"/><ellipse cx="61" cy="44" rx="7.5" ry="8.5"/>'
        f'<path d="M50,52 L54,60 L46,60Z"/></g>'
        f'<g stroke="{line}" stroke-width="2" stroke-linecap="round">'
        + ''.join(f'<line x1="{x}" y1="64" x2="{x}" y2="72"/>' for x in (40, 46.7, 53.3, 60))
        + '</g>'
        f'<path d="M30,30 C33,22 40,18 47,18" fill="none" stroke="#fff" stroke-opacity=".7" '
        f'stroke-width="2.5" stroke-linecap="round"/></g>')
    return svg(body, defs)


GEMS = {
    'white': diamond, 'blue': sapphire, 'green': emerald,
    'red': ruby, 'black': onyx, 'gold': gold,
}

if __name__ == '__main__':
    for color, fn in GEMS.items():
        (OUT / f'{color}.svg').write_text(fn(PALETTES[color]))
        print('wrote', color + '.svg')
    (OUT / 'jolly-roger.svg').write_text(jolly_roger())
    print('wrote jolly-roger.svg')
