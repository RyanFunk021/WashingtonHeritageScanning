#!/bin/sh
# Publish the page to 4thgenerationstudios.com (Cloudflare Worker, static assets).
# First time on a machine: npx wrangler login
set -e
cd "$(dirname "$0")"
npx -y tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.in.css -o styles.css --minify
rm -rf dist && mkdir dist
cp index.html styles.css dist/
npx -y wrangler@4 deploy
