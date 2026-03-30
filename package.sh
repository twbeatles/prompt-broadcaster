#!/bin/bash
set -euo pipefail

echo "[AI Prompt Broadcaster] Building dist package..."
npm run build

VERSION=$(node -e "const fs=require('fs');const manifest=JSON.parse(fs.readFileSync('dist/manifest.json','utf8'));process.stdout.write(manifest.version||'');")

if [ -z "$VERSION" ]; then
  echo "dist/manifest.json does not contain a valid version."
  exit 1
fi

ZIP_NAME="prompt-broadcaster-v${VERSION}.zip"
rm -f "$ZIP_NAME"
cd dist
zip -r "../$ZIP_NAME" ./*
cd ..

echo "Version: $VERSION"
echo "Created: $ZIP_NAME"
