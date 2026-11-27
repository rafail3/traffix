#!/usr/bin/env bash
# Rebuilds every icon from the SVGs in docs/brand. Needs Chrome (renders the SVGs) and ffmpeg
# (resizes). Run from the repo root after changing a logo SVG: bash scripts/make-icons.sh
set -euo pipefail

CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
BRAND=docs/brand
RES=android/app/src/main/res
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# SVG -> 1024px PNG with a transparent background.
render() {
  local name=$1
  local abs; abs=$(cd "$BRAND" && pwd -W 2>/dev/null || pwd)
  printf '<html><body style="margin:0;background:transparent"><img src="file:///%s/%s.svg" style="width:100vw;height:100vh;display:block"></body></html>' \
    "$abs" "$name" > "$TMP/$name.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --allow-file-access-from-files --window-size=1024,1024 --user-data-dir="$TMP/profile" \
    --screenshot="$TMP/$name.png" "file:///$(cd "$TMP" && pwd -W 2>/dev/null || pwd)/$name.html" 2>/dev/null
}
resize() { ffmpeg -loglevel error -y -i "$1" -vf "scale=$3:$3:flags=lanczos" "$2"; }

for n in traffix-logo traffix-mark traffix-adaptive-foreground traffix-legacy-round traffix-legacy-square; do render "$n"; done

# Website: favicon (16/32/48 in one .ico), SVG mark, Apple touch icon.
for s in 16 32 48; do resize "$TMP/traffix-mark.png" "$TMP/fav-$s.png" "$s"; done
ffmpeg -loglevel error -y -i "$TMP/fav-16.png" -i "$TMP/fav-32.png" -i "$TMP/fav-48.png" \
  -map 0 -map 1 -map 2 -c png public/favicon.ico
cp "$BRAND/traffix-mark.svg" public/logo.svg
resize "$TMP/traffix-logo.png" public/apple-icon.png 180

# Android launcher icons, per density.
declare -A LEGACY=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
for d in "${!LEGACY[@]}"; do
  s=${LEGACY[$d]}
  resize "$TMP/traffix-legacy-square.png" "$RES/mipmap-$d/ic_launcher.png" "$s"
  resize "$TMP/traffix-legacy-round.png" "$RES/mipmap-$d/ic_launcher_round.png" "$s"
  resize "$TMP/traffix-adaptive-foreground.png" "$RES/mipmap-$d/ic_launcher_foreground.png" $((s * 9 / 4))
done

# Splash screens: the logo centred on the same near-black, half the short side.
for f in "$RES"/drawable*/splash.png; do
  IFS=, read -r w h < <(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$f" | tr -dc '0-9,') || true
  side=$(( (w < h ? w : h) / 2 ))
  ffmpeg -loglevel error -y -f lavfi -i "color=c=0x08090b:s=${w}x${h}" -i "$TMP/traffix-logo.png" \
    -filter_complex "[1]scale=$side:$side:flags=lanczos[l];[0][l]overlay=(W-w)/2:(H-h)/2" -frames:v 1 "$f"
done

echo "icons rebuilt"
