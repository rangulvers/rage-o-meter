#!/usr/bin/env python3
"""Tiny HTTP server: GET /poster.png renders a fresh poster from your aircraft feed.
Usage: python3 serve.py --url http://YOURSERVER/tar1090/data/aircraft.json --lat .. --lon .. --name Town
"""
import argparse, io, json, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
import render

a = argparse.ArgumentParser()
a.add_argument("--url"); a.add_argument("--lat", type=float, required=True)
a.add_argument("--lon", type=float, required=True); a.add_argument("--name", default="Home")
a.add_argument("--radius", type=int, default=50); a.add_argument("--port", type=int, default=8080)
a.add_argument("--demo", action="store_true")
o = a.parse_args()


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] != "/poster.png":
            self.send_error(404); return
        try:
            data = render.demo_data(o.lat, o.lon) if o.demo else json.load(urllib.request.urlopen(o.url, timeout=10))
            ac = [x for x in render.parse_aircraft(data, o.lat, o.lon) if x["dist"] <= o.radius]
            buf = io.BytesIO(); render.render(ac, o.name, o.radius).save(buf, "PNG")
        except Exception as e:
            self.send_error(502, str(e)); return
        self.send_response(200); self.send_header("Content-Type", "image/png"); self.end_headers()
        self.wfile.write(buf.getvalue())


HTTPServer(("", o.port), H).serve_forever()
