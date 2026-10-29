#!/usr/bin/env bash
# Builds and signs dist/TV-Home.wgt: the shell from wgt/ plus a fallback copy of app/.
# Usage: tools/build_wgt.sh [CERTS_DIR]   (default ~/tvwork/certs: author.p12 + tizen-distributor-signer.p12)
set -euo pipefail
cd "$(dirname "$0")/.."
certs="${1:-$HOME/tvwork/certs}"
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT

cp wgt/config.xml wgt/index.html "$build/"
mkdir -p "$build/app"
cp app/index.html app/style.css app/apps.js app/app.js "$build/app/"
python3 -I tools/make_icon.py "$build/icon.png"

mkdir -p dist
python3 -I tools/sign_wgt.py sign "$build" dist/TV-Home.wgt --certs "$certs"
python3 -I tools/sign_wgt.py verify dist/TV-Home.wgt
