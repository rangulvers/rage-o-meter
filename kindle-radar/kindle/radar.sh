#!/bin/sh
# Runs ON the Kindle (after jailbreak + KUAL). Edit URL, then start from KUAL or over SSH.
URL="http://192.168.1.50:8080/poster.png"
INTERVAL=60
IMG=/tmp/poster.png

# keep the framework from taking over the screen / sleeping
stop lab126_gui 2>/dev/null
lipc-set-prop com.lab126.powerd preventScreenSaver 1

while true; do
  # wifi on (Paperwhite 1/2)
  lipc-set-prop com.lab126.cmd wirelessEnable 1
  if wget -q -T 15 -O "$IMG.new" "$URL" && [ -s "$IMG.new" ]; then
    mv "$IMG.new" "$IMG"
    eips -c            # clear
    eips -g "$IMG"     # draw PNG (needs eips with -g PNG support; else use fbink -g file=...)
  fi
  sleep "$INTERVAL"
done
