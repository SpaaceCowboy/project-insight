# INSIGHT website

One static page. `npm run dev` to work on it, `npm test` to check the hero levels, `npm run build` to write `out/`.

`scripts/release.mjs` runs before dev and build: it copies `../INSIGHT-online.apk` to `public/INSIGHT.apk` and writes `lib/generated.json` (version, checksum, levels). It refuses to run if `../downloadlink.md` does not list that APK's SHA-256.
