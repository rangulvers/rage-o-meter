#!/usr/bin/env python3
"""Render nearby aircraft as a 1950s-style travel poster for a 758x1024 Kindle Paperwhite.

Input is a readsb/dump1090/tar1090-style aircraft.json (URL or file):
  {"aircraft": [{"hex","flight","t","alt_baro","gs","track","lat","lon"}, ...]}
Adjust parse_aircraft() if your server uses a different shape.
"""
import argparse, json, math, random, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont

W, H = 758, 1024
INK, PAPER, MID, LIGHT = 0, 255, 110, 205


def font(size, kind="serif"):
    paths = {
        "serif": ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
                  "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"],
        "sans": ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    }[kind]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def bearing(lat1, lon1, lat2, lon2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def parse_aircraft(data, lat, lon):
    out = []
    for a in data.get("aircraft", []):
        if "lat" not in a or "lon" not in a:
            continue
        alt = a.get("alt_baro", a.get("alt_geom"))
        if alt == "ground":
            continue
        out.append({
            "call": (a.get("flight") or a.get("r") or a.get("hex", "?")).strip() or "UNKNOWN",
            "type": a.get("t", ""),
            "alt": alt if isinstance(alt, (int, float)) else None,   # feet
            "gs": a.get("gs"),                                       # knots
            "track": a.get("track"),
            "dist": haversine_km(lat, lon, a["lat"], a["lon"]),
            "brg": bearing(lat, lon, a["lat"], a["lon"]),
        })
    return sorted(out, key=lambda x: x["dist"])


def demo_data(lat, lon):
    random.seed(int(time.time() // 60))
    calls = ["DLH4YK", "RYR82QP", "EZY1234", "BAW903", "KLM1771", "UAE45", "AFR1280"]
    types = ["A320", "B738", "A21N", "A359", "E190", "B77W", "A333"]
    ac = []
    for c, t in zip(calls, types):
        d, b = random.uniform(2, 45), random.uniform(0, 360)
        ac.append({"flight": c, "t": t, "alt_baro": random.randint(3, 38) * 1000,
                   "gs": random.randint(180, 520), "track": random.randint(0, 359),
                   "lat": lat + d / 111 * math.cos(math.radians(b)),
                   "lon": lon + d / (111 * math.cos(math.radians(lat))) * math.sin(math.radians(b))})
    return {"aircraft": ac}


def compass(deg):
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int((deg + 22.5) // 45) % 8]


def plane_poly(cx, cy, size, heading):
    # nose-up outline in unit coords, scaled and rotated to heading
    pts = [(0, -1), (.09, -.6), (.12, -.2), (.95, .15), (.95, .3), (.12, .2), (.08, .65),
           (.3, .85), (.3, .95), (0, .88), (-.3, .95), (-.3, .85), (-.08, .65),
           (-.12, .2), (-.95, .3), (-.95, .15), (-.12, -.2), (-.09, -.6)]
    r = math.radians(heading)
    c, s = math.cos(r), math.sin(r)
    return [(cx + size * (x * c - y * s), cy + size * (x * s + y * c)) for x, y in pts]


def center(d, text, y, f, fill=INK, x0=0, x1=W):
    w = d.textlength(text, font=f)
    d.text(((x0 + x1 - w) / 2, y), text, font=f, fill=fill)


def fit(d, text, f_kind, size, maxw):
    while size > 10 and d.textlength(text, font=font(size, f_kind)) > maxw:
        size -= 2
    return font(size, f_kind)


def star(d, cx, cy, r, fill):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.4
        ang = math.radians(-90 + i * 36)
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    d.polygon(pts, fill=fill)


def render(aircraft, home_name, radius_km):
    img = Image.new("L", (W, H), PAPER)

    # sunburst, drawn on its own layer so it stays inside the picture panel
    top, bot = 192, 600
    cx, cy = W // 2, 385
    layer = Image.new("L", (W, bot - top), PAPER)
    ld = ImageDraw.Draw(layer)
    for i in range(0, 360, 12):
        a1, a2 = math.radians(i), math.radians(i + 6)
        ld.polygon([(cx, cy - top), (cx + 900 * math.cos(a1), cy - top + 900 * math.sin(a1)),
                    (cx + 900 * math.cos(a2), cy - top + 900 * math.sin(a2))], fill=LIGHT)
    img.paste(layer.crop((32, 0, W - 32, bot - top)), (32, top))
    d = ImageDraw.Draw(img)
    d.rectangle([14, 14, W - 15, H - 15], outline=INK, width=8)
    d.rectangle([30, 30, W - 31, H - 31], outline=INK, width=2)

    # title banner
    d.rectangle([30, 30, W - 31, 190], fill=INK)
    center(d, "AIR TRAFFIC", 46, font(60), PAPER)
    star(d, 95, 82, 26, PAPER)
    star(d, W - 95, 82, 26, PAPER)
    center(d, f"OVER {home_name.upper()}", 122, font(32), PAPER)
    d.line([60, 172, W - 60, 172], fill=PAPER, width=2)

    if aircraft:
        n = aircraft[0]
        hdg = n["track"] if n["track"] is not None else n["brg"]
        d.polygon(plane_poly(cx + 8, cy + 10, 130, hdg), fill=MID)
        d.polygon(plane_poly(cx, cy, 130, hdg), fill=INK, outline=PAPER)
        d.rectangle([60, 545, W - 61, 592], fill=PAPER, outline=INK, width=3)
        center(d, "NEAREST FLIGHT", 551, font(30, "sans"))

    if not aircraft:
        center(d, "CLEAR SKIES", 350, font(64))
        center(d, f"nothing within {radius_km} km", 435, font(28, "sans"), MID)

    # nearest flight details
    d.line([60, 610, W - 60, 610], fill=INK, width=4)
    if aircraft:
        n = aircraft[0]
        center(d, n["call"], 622, fit(d, n["call"], "serif", 84, W - 140))
        sub = " · ".join(x for x in [n["type"], f'{n["dist"]:.0f} km {compass(n["brg"])}'] if x)
        center(d, sub, 718, font(34, "sans"))
        alt = f'{n["alt"]:,.0f} ft' if n["alt"] is not None else "— ft"
        gs = f'{n["gs"]:.0f} kt' if n["gs"] is not None else "— kt"
        d.text((70, 770), alt, font=font(40), fill=INK)
        w = d.textlength(gs, font=font(40))
        d.text((W - 70 - w, 770), gs, font=font(40), fill=INK)
    d.line([60, 830, W - 60, 830], fill=INK, width=2)

    # others
    center(d, "ALSO IN THE SKY", 838, font(26, "sans"), MID)
    y = 876
    for a in aircraft[1:3]:
        d.text((64, y), a["call"], font=font(28, "sans"), fill=INK)
        alt = f'{a["alt"]/1000:.0f}k ft' if a["alt"] is not None else "—"
        right = f'{alt}   {a["dist"]:.0f} km {compass(a["brg"])}'
        d.text((W - 64 - d.textlength(right, font=font(28, "sans")), y), right, font=font(28, "sans"), fill=INK)
        y += 38

    # footer
    d.rectangle([30, H - 80, W - 31, H - 31], fill=INK)
    center(d, f'{len(aircraft)} AIRCRAFT WITHIN {radius_km} KM  ·  {time.strftime("%H:%M")}',
           H - 68, font(26, "sans"), PAPER)
    return img


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", help="aircraft.json URL")
    p.add_argument("--file", help="aircraft.json file")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--name", default="Home")
    p.add_argument("--radius", type=int, default=50, help="km")
    p.add_argument("--demo", action="store_true")
    p.add_argument("--out", default="poster.png")
    a = p.parse_args()

    if a.demo:
        data = demo_data(a.lat, a.lon)
    elif a.file:
        data = json.load(open(a.file))
    elif a.url:
        data = json.load(urllib.request.urlopen(a.url, timeout=10))
    else:
        sys.exit("need --url, --file or --demo")

    ac = [x for x in parse_aircraft(data, a.lat, a.lon) if x["dist"] <= a.radius]
    render(ac, a.name, a.radius).save(a.out)
    print(f"wrote {a.out} ({len(ac)} aircraft)")


if __name__ == "__main__":
    main()
