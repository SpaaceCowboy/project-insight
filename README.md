# INSIGHT for Android

A native Android version (Kotlin + Jetpack Compose) of the INSIGHT puzzle game. It is a separate project from the web game in `../project-insight`, which it never modifies; it only reads that project's level data and sounds through `tools/export-assets.mjs`.

## What is ported

| Web file | Android |
|---|---|
| `src/puzzle-rules.js` | `Rules.kt` |
| `src/data/*` (206 levels) | `assets/levels.json` (generated) |
| `src/game-state.js`, `src/useGame.js` | `GameModel.kt`, `Store.kt` |
| `src/achievements.mjs` | `Achievements.kt` |
| `src/sound.js` | `Audio.kt` (tile notes pre-rendered to WAV) |
| `src/tile-art.js`, `src/styles.css` | `TileArt.kt`, `Theme.kt`, `Ui.kt` |
| Home, worlds, levels, options, achievements, online, pause, win | `Screens.kt` |
| Game board | `GameScreen.kt` |
| `src/useCreator.js`, `src/Creator.jsx` | `CreatorState.kt`, `CreatorScreen.kt` |

Differences from the web version: portrait only; no undo key (so every solve counts as a clean solve); Dev Mode exists only in debug builds. Android now includes accounts, profiles, community worlds/play, checked publishing, and XP. What's Next and Casual remain planned features.

## Online and installable builds

The TypeScript/PostgreSQL service and deployment instructions are in [server/README.md](server/README.md). Community features require a verified account; campaign and local creation work offline. No billing is enabled for the private test.

- **INSIGHT-preview.apk** at the repository root is a signed debug build with a clearly labelled, persistent local Online demonstration. It needs no server or internet. Its package is `com.insightpuzzle.app.preview`, so it can coexist with the real app.
- **INSIGHT-online.apk** at the repository root is a signed debug build configured for the deployed private-test backend. The campaign still works without connectivity; real accounts and community discovery require it. This is an installable test build, not a Play release.

Rebuild the local preview with `./gradlew assembleDebug -PinsightOnlineDemo=true`. Build a backend-connected APK with `./gradlew assembleDebug -PinsightApiUrl=https://YOUR_API`. Release builds reject cleartext service addresses. Preview data, saves, and credentials are kept separate from real service data.

## Toolchain (this machine)

Installed in user space, no sudo:

- JDK 21: `~/Android/dl/jdk-21.0.12.1+1`
- Android SDK: `~/Android/Sdk` (platform 37.0, build-tools 37.0.0, emulator, `android-36` x86_64 image, AVD `insight`)
- Gradle 9.8.1 via the wrapper; AGP 9.4.1, Kotlin 2.4.21, Compose BOM 2026.09.00

Google's Android servers return 404 from the dev network, so:

- the SDK came from the Tencent mirror (`SDK_TEST_BASE_URL=https://mirrors.cloud.tencent.com/AndroidSDK/ sdkmanager ...`, using cmdline-tools 13114758 because newer ones fetch from dl.google.com);
- Google Maven resolves through the Aliyun mirror in `settings.gradle.kts`. Replace it with `google()` when building somewhere that can reach Google.

```sh
export JAVA_HOME=~/Android/dl/jdk-21.0.12.1+1 ANDROID_HOME=~/Android/Sdk
./gradlew testDebugUnitTest      # replays all 206 verified solutions through the Kotlin rules
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease        # minified, unsigned: sign before installing or uploading
```

Run on the emulator:

```sh
~/Android/Sdk/emulator/emulator -avd insight &          # add -no-window for headless
~/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Adding levels

Design them in the web studio (`../project-insight`, `npm run dev`) and press **Add to game**: it appends to the campaign (next level number, World 11 onward) and runs the export below. Then run the unit tests and rebuild. Levels are append-only because progress is saved by level number.

## When the web levels or sounds change

```sh
node tools/export-assets.mjs        # reads ../project-insight (or pass its path)
./gradlew testDebugUnitTest
```

## Before publishing

- `applicationId` (`com.insightpuzzle.app`) is permanent once on Play; change it first if needed.
- Create an upload keystore (keep it backed up; `*.jks`/`*.keystore` are git-ignored) and add a release `signingConfig`, then build an AAB with `./gradlew bundleRelease`.
- Play: target API 36 is required from 31 Aug 2026 (set); new personal accounts need a 12-tester, 14-day closed test.
