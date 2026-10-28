# Kindle air-traffic poster

1. `python3 render.py --demo --lat LAT --lon LON --name Town` makes `poster.png` (758x1024).
2. `python3 serve.py --url http://HOST/tar1090/data/aircraft.json --lat .. --lon ..` serves `/poster.png`.
3. After jailbreaking the Kindle, copy `kindle/radar.sh` over (edit `URL`) and run it.

Untested on a real Kindle: `eips -g` PNG support and the lipc property names vary by
firmware, so check yours first (FBInk is the safer renderer: `fbink -g file=/tmp/poster.png`).
