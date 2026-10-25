# INSIGHT for Android

A native Android version (Kotlin + Jetpack Compose) of the INSIGHT puzzle game. It is a separate project from the web game in `../project-insight`, which it never modifies; it only reads that project's level data and sounds through `tools/export-assets.mjs`.

## What is ported

| Web file | Android |
|---|---|
| `src/puzzle-rules.js` | `Rules.kt` |
| `src/data/*` (first 200 levels) | `assets/levels.json` (generated) |
| `src/game-state.js`, `src/useGame.js` | `GameModel.kt`, `Store.kt` |
| `src/achievements.mjs` | `Achievements.kt` |
| uisfx "zen" pack (CC0, [uisfx.com](https://uisfx.com), npm `uisfx@0.4.0`) | `res/raw/zen_*.mp3`, `res/raw-v29/zen_*.ogg`, `Feedback.kt` |
| Forest and mountain ambience | `Audio.kt` (MediaPlayer beds) |
| `src/tile-art.js`, `src/styles.css` | `TileArt.kt`, `Theme.kt`, `Ui.kt` |
| Home, levels, options, achievements, online, win pop-up | `Screens.kt` |
| Game board | `GameScreen.kt` |
| `src/useCreator.js`, `src/Creator.jsx` | `CreatorState.kt`, `CreatorScreen.kt` |

Differences from the web version: portrait only; no undo key (so every solve counts as a clean solve); Dev Mode exists only in debug builds. Android now includes accounts, profiles, community puzzle discovery/play, Casual, checked publishing, and XP.

## Online and installable builds

The TypeScript/PostgreSQL service and deployment instructions are in [server/README.md](server/README.md). Register with an email, password and unique username; log in with email and password. No email codes or verification are required. Community features require an account; campaign and local creation work offline. No billing is enabled for the private test.

- **INSIGHT-preview.apk** at the repository root is a signed debug build with a clearly labelled, persistent local Online demonstration. It needs no server or internet. Its package is `com.insightpuzzle.app.preview`, so it can coexist with the real app.
- **INSIGHT-online.apk** at the repository root is a signed debug build configured for the deployed private-test backend. The campaign still works without connectivity; real accounts and community discovery require it. This is an installable test build, not a Play release.

Rebuild the local preview with `./gradlew assembleDebug -PinsightOnlineDemo=true`. Build a backend-connected APK with `./gradlew assembleDebug -PinsightApiUrl=https://YOUR_API`. Release builds reject cleartext service addresses. Preview data, saves, and credentials are kept separate from real service data.

## Android v0.2.11 — Typography and raised buttons

Version 0.2.11 (code 22) replaces Source Sans 3 with bundled JetBrains Mono, adds raised Journey/Worlds and corner buttons with press feedback, animates the Options/Profile icons, and slides Options and Profile in from below. Verification fixed community exits leaving a mismatched board during transitions and kept row labels visible with enlarged text. Saved progress, accounts and creator drafts survive an in-place update. This is an APK-only release. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.11); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.10 — Navigation and reports

Version 0.2.10 (code 21) adds bidirectional swipe navigation and Random history, separate bookmark/following/follower lists, larger board outlines and creator controls, centred puzzle miniatures, and revised result bars. Tile drags now require dropping over a legal destination. About includes feedback and bug-report forms, available without signing in; reports are stored privately on the server with email delivery disabled for now. The matching backend adds migration 010 without deleting existing data. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.10); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.9 — Journey and social features

Version 0.2.9 (code 20) adds likes, bookmarks, follows, daily streaks and online/design/streak achievements. Journey opens directly into play; its heading opens Levels, and Now Playing returns to the game. Targets are larger with plain miniature tiles, boards use a shared shorter outline, and the creator crops empty borders. Random supports an empty-space right swipe; Next follows the originating puzzle list. Profiles include followers, streaks, bookmarks and followed players; connection trouble uses a quiet offline mark. Logout asks for confirmation. The matching backend adds migration 009 without deleting existing data. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.9); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.8 — Sound and haptic feedback

Version 0.2.8 (code 19) uses the uisfx Zen sound pack for interface actions and a 6 ms vibration while Haptics is on. The creator has a processing sound loop that follows Sound, Effects, and app visibility. Forest and mountain ambience remain. Android 8–9 use MP3 cues; Android 10+ use Ogg Opus. Account storage, saved progress, package IDs, signing certificate, and backend contracts are unchanged. This is an APK-only update. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.8); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.7 — Campaign and simplified screens

Version 0.2.7 (code 18) has 200 campaign levels, eight milestone achievements, larger Home actions, simplified Options and player details, and result bars below the complete solved board. The backend accepts and safely filters older 206-level progress imports. Accounts, XP, current campaign progress, package IDs, and the original signing certificate are preserved. The approved migration 008 removed four retired badge records. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.7); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.6 — Profiles and refresh

Version 0.2.6 (code 17) puts each player's puzzle cards directly on their profile, updates profile statistics and progress styling, and moves logout to a corner icon. Pull down to refresh Worlds or a profile; a screen-reader Refresh action remains available. Random opens a puzzle directly and returns to Worlds on Back. Inline puzzle loading, profile return navigation, cached-result retry, and logout availability were verified. Existing saves, accounts, package IDs, and signing certificate are retained. No backend update is required. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.6).

## Android v0.2.5 — Creator controls

Version 0.2.5 (code 16) uses one Start → Target → Create button. Back first clears a selection, then steps back through the creator stages. Holding the background clears the build grid or resets the target/check board to its start; screen-reader reset actions are also available. Grid resizing is animated, empty slots have solid outlines, and only the check stage shows the target preview. Saved drafts, publishing proofs, accounts, package IDs, and signing certificate are retained. No backend update is required. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.5).

## Android v0.2.4 — Direct Worlds discovery

Version 0.2.4 (code 15) opens Worlds directly into the four-column community puzzle grid after sign-in. The top capsule switches between puzzles and players and opens sort/search controls; Random and Create remain below the list. Community games return to Worlds with filters retained. Existing saves, accounts, package IDs, signing certificate, and production API address are preserved. No backend update is required. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.4).

## Android v0.2.3 — Gameplay and collections

Version 0.2.3 (code 14) includes Claude's gameplay changes: Options/Profile shortcuts during play, a minimal win popup, hold-to-restart with a rewind animation, directional flicks, session-persistent Rulebook practice, square collection cards with consistent miniature tile sizes and solved-state glows, and enlarged Pearl launcher artwork. Verification restored large-text Rulebook scrolling, made the popup modal and the restart action accessible, retained haptic/reduced-motion preferences, and made the final campaign action return to level selection. Accounts, save keys, signing certificate, and the production API address are unchanged. No backend update is required.

## Android v0.2.2 — Options and Rulebook

Version 0.2.2 (code 13) carries Claude's Options changes onto the recovered v0.2.1 client. Options now has Options, Rulebook, and About tabs. Tile finishes and the Reset progress control are removed; badges and saved progress are retained. Colourblind mode persists across relaunches and changes tiles and targets together, retaining every tile symbol. The Rulebook uses the gameplay board's tap, drag, keyboard, TalkBack, sound, and haptic controls without saving moves or awarding progress. The current flat puzzle API, creator publishing, campaign ordering, launcher, and signing certificate are retained.

## Android v0.2.1 — Problem 15 baseline

The Android v0.2.0 source was unavailable on the other development PC. This checkout reconstructs its native client behavior from the published v0.2.0 APK and restores the matching server source, tests, campaign asset and historical migration 007 from the deployment archive. The resulting client uses the live flat-puzzle API: numbered puzzles per creator, direct construction-proof publishing, creator collections, shared codes, discovery filters, Casual, and an interactive rulebook. No new application dependency was added.

Home has minimal Options and Profile icons above Journey and Worlds. Journey resumes the active account's last unfinished campaign level, otherwise starts the first unlocked unsolved level. After the campaign is complete it opens the v0.2.0 level selector. Campaign selection remains under Menu → Levels; Back returns Home. Worlds opens straight into a four-column grid of community puzzles (toggle to players, sort and search in the capsule, Random and Create below). Your own profile achievement-count row opens Achievements; other players' counts stay read-only. Guests retain achievement access from the in-game menu.

The launcher uses the Original white/Pearl tile and the installed labels are **Insight** and **Insight Preview**. The uppercase in-game wordmark, package IDs, APK filenames, save keys and campaign ordering stay unchanged. This authorized update is version **0.2.1 (code 12)**, following the published v0.2.0 (code 11).

The original signing-key backup is `.build-tools/insight-debug.keystore` (git-ignored); use it to sign replacement APKs. This machine's default debug key differs. DEPLOYMENT.md records deployment and validation; APK-SHA256SUMS records the distributed binaries. Publishing this client requires no backend restart or live database migration. Migration 007 is recovered historical source already present in v0.2.0, not a new production change.

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
./gradlew testDebugUnitTest      # replays all 200 verified solutions through the Kotlin rules
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
