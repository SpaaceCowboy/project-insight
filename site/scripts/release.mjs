// Runs before dev and build. Copies the APK into public/ and writes lib/generated.json:
// the release facts shown in the Download block, and the campaign levels the page draws.
// Fails loudly rather than publish a download page with a wrong version or checksum.
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const repo = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, repo))

const apk = read('INSIGHT-online.apk')
const sha256 = createHash('sha256').update(apk).digest('hex')

// The version comes from downloadlink.md, the file that names this exact APK by its checksum.
// (app/build.gradle.kts can be ahead of the last APK that was actually built.)
const link = read('downloadlink.md').toString()
const version = link.match(/INSIGHT Online (\d+\.\d+\.\d+)/)?.[1]
if (!version || !link.includes(sha256)) {
  throw new Error(`downloadlink.md does not describe INSIGHT-online.apk (sha256 ${sha256}). Update it for the new build first.`)
}

const minSdk = Number(read('app/build.gradle.kts').toString().match(/minSdk = (\d+)/)?.[1])
const android = { 26: '8.0' }[minSdk]
if (!android) throw new Error(`Add the Android version name for minSdk ${minSdk} in site/scripts/release.mjs`)

const levels = JSON.parse(read('app/src/main/assets/levels.json').toString())
const level = (n) => ({ n, name: levels[n - 1].name, start: levels[n - 1].start, target: levels[n - 1].target, par: levels[n - 1].par })

copyFileSync(new URL('INSIGHT-online.apk', repo), new URL('../public/INSIGHT.apk', import.meta.url))
writeFileSync(new URL('../lib/generated.json', import.meta.url), JSON.stringify({
  version, sha256, android, megabytes: (apk.length / 1e6).toFixed(1),
  levelCount: levels.length,
  hero: [1, 6, 10].map(level), // two-colour opener, the tile that never moves, then diagonals
  journey: levels.slice(0, 32).map((l) => l.target), // one page of the app's level screen
}, null, 2) + '\n')
console.log(`release: INSIGHT ${version}, ${levels.length} levels, sha256 ${sha256.slice(0, 12)}…`)
