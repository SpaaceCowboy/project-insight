# Midori for Android

A native Android version (Kotlin + Jetpack Compose) of the INSIGHT puzzle game. It is a separate project from the web level studio in `../project-insight`, which it never modifies; it only reads that project's level data and sounds through `tools/export-assets.mjs`.

## What is ported

| Web file | Android |
|---|---|
| `src/puzzle-rules.js` | `Rules.kt` |
| `src/data/*` | `assets/levels.json` (generated) |
| `src/game-state.js`, `src/useGame.js` | `GameModel.kt`, `Store.kt` |
| `src/achievements.mjs` | `Achievements.kt` |
| uisfx "zen" pack and the "minimal" checkout (CC0, [uisfx.com](https://uisfx.com), npm `uisfx@0.4.0`) | `res/raw/zen_*.mp3`, `res/raw/minimal_checkout.mp3`, `res/raw-v29/*.ogg`, `Feedback.kt`, `tools/build-cues.mjs` |
| LDNOOBW English word list (CC BY 4.0) with reviewed additions | `tools/ldnoobw-en.txt`, `tools/build-username-words.mjs`, `username-words.json` |
| Forest and mountain ambience | `Audio.kt` (MediaPlayer beds) |
| `src/tile-art.js`, `src/styles.css` | `TileArt.kt`, `Theme.kt`, `Ui.kt` |
| Home, levels, options, achievements, online, win pop-up | `Screens.kt` |
| Game board | `GameScreen.kt` |
| `src/CreatorCanvas.jsx`, `src/creator-state.js` | `CreatorState.kt`, `CreatorScreen.kt` |

Differences from the web project: the Android game is portrait only; its campaign is the flat web campaign; Dev Mode exists only in debug builds. Android includes accounts, profiles, community puzzle discovery/play, Casual, checked publishing, and XP.

## Online and installable builds

The TypeScript/PostgreSQL service and deployment instructions are in [server/README.md](server/README.md). Register with an email, password and unique username, or continue with Google. Password accounts can recover access by email once SMTP is configured. Community features require an account; campaign and local creation work offline. No billing is enabled for the private test.

- **INSIGHT-preview.apk** at the repository root is a signed debug build with a clearly labelled, persistent local Online demonstration. It needs no server or internet. Its package is `com.insightpuzzle.app.preview`, so it can coexist with the real app.
- **INSIGHT-online.apk** at the repository root is a signed debug build configured for the deployed private-test backend. The campaign still works without connectivity; real accounts and community discovery require it. This is an installable test build, not a Play release.

Rebuild the local preview with `./gradlew assembleDebug -PinsightOnlineDemo=true`. Build a backend-connected APK with `./gradlew assembleDebug -PinsightApiUrl=https://YOUR_API` and a Web Google OAuth client with `-PinsightGoogleClientId=...`. Release builds reject cleartext service addresses. Preview data, saves, and credentials are kept separate from real service data.

## Website

`web/` holds the Midori marketing site (Vite + React, static output in `web/dist`): a playable board, the six tiles, and Journey (free) versus Worlds (one-time purchase). Run `npm install`, then `npm run dev`, `npm test` or `npm run build` inside `web/`. The Play link, Worlds price and contact address are set in `web/src/config.js`. Checkout is a stub behind `web/src/checkout/provider.js`: production builds say "Checkout opens soon" and take no payment. The privacy and terms pages are placeholders.

## Android v0.2.28 - Hotfix polish

Version 0.2.28 (code 39): swiping stops at the edge of the loaded puzzles instead of showing blank or half-drawn pages; the Worlds "Solved" figure excludes your own puzzles and matches Profile; the navigation handle is hidden again whenever the system restores it (gesture navigation); creator phases 2 and 3 hold a dragged tile inside the outline; haptics are one millisecond longer, about 50% amplitude, with a quiet tick per list row and a triple pulse for restart and clear; "pending submissions" text removed; players can be sorted by most followed; lost connections retry automatically with backoff; shorter rulebook sentences in all five languages. The backend adds `communityCount` on `/v1/progress`, `sort=followed` and `followerCount` on `/v1/creators`, and `DEVELOPER_USER_IDS` exempting listed accounts from the daily puzzle limit; no migration. Published to the existing Firebase tester group with the same package and signing key. [Download the APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.28); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.27 - Shared rate limits and persistent cooldowns

Version 0.2.27 (code 38) adds persistent, scoped server cooldowns and preserves queued progress while waiting to retry. The backend now uses shared Redis counters and layered nginx/IP/account/action protection. Published to the existing Firebase tester group with the same package and signing key. [Download the APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.27). The new device retry test remains unresolved; see [deployment notes](DEPLOYMENT.md) for validation and rollback details.

## Android v0.2.26 - Google sign-in, recovery and guest progress

Version 0.2.26 (code 37) adds **Continue with Google** on the auth screen. A first Google sign-in asks the player to choose a public username; an existing verified email links to its password account. Password accounts gain **Forgot password?**, an eight-digit email code and automatic sign-in after a reset. Journey progress saved while signed out (solved levels, badges and the unfinished attempt) now moves into the first account created on the device. The server adds migration 011 for Google subjects and recovery mail; email delivery stays disabled until SMTP credentials are installed, so the reset entry point is hidden meanwhile. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.26); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.25 - Home counts, a quicker Options and an icon that waits

Version 0.2.25 (code 36) shows the campaign's solved total on Home's Journey key and Designed/Solved on Worlds for signed-in players, and both keys settle in when Home appears. The two trial looks leave Options, its volume rows are shorter, and an alternative launcher icon is now applied when the app leaves the foreground so the running task is never closed. Worlds keeps its search and action keys in place while the keyboard is up, and page swipes clear a search field's focus. Backend, package, signing key and saved data are unchanged. Built and tested on the VPS, including a signed v0.2.24 update that kept its preferences. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.25); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.24 - Options stays open on Android 8-11, and the keyboard keeps the handle

Version 0.2.24 (code 35) replaces v0.2.23, which crashed on Android 8-11 when Options composed its icon row because `Class.getPackageName()` is API 31; the alias name is a literal again and both icon calls are guarded so a refusal cannot take the page down. While the keyboard is up the navigation handle returns, so the keyboard sits above it, and it is hidden again when the keyboard closes. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.24); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.23 - Two looks to try, a second icon and a warmer start

Version 0.2.23 (code 34) adds two looks to try in Options → About: "New colours" paints every tile one exact colour with only its side shaded, and "Smooth 3D" tapers the side of every plate and tile to nothing at its ends. Options also switches between the app icon and an alternative with its colours swapped, through a second launcher alias that never disables the activity. The splash holds 1300–3000ms, waits for the local preload and composes the first screens underneath it; a leaving screen lets go of the keyboard, Home no longer shrinks for it, the board lifts on every game entry until its sheet has settled, and a rebuilt profile starts from the copy in memory. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.23); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.22 - Glued slurs refused, a quieter chrome

Version 0.2.22 (code 33) refuses usernames that are nothing but banned words glued together ("killjew", "dickass") with the strongest rule among the pieces, while names with letters left over such as "Assassin" still pass; the app and the server share the rule and its case list. The gesture handle now stays hidden on every screen from the first frame and is hidden again whenever the window regains focus, dialogs and sheets hide it in their own window, and every screen still reserves its room. A puzzle opened from outside a game settles 2dp over 220ms once its sheet arrives, and the splash no longer waits for the first community pages. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.22); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.21 - One username line, a settling board and a steady safe area

Version 0.2.21 (code 32) shows every username refusal on one line under the username box and clears it as soon as the name is edited, and keeps Login / Create account muted until the boxes they need are filled. A puzzle opened from outside a game lifts its board into place, the gesture handle hides only after the screen settles while the navigation bar's room stays reserved, and empty collections no longer show a placeholder line. Backend, package, signing key and saved data are unchanged. Built and tested on the VPS, including a signed v0.2.20 update that kept its preferences. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.21); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.20 - Studio levels and the target tip

Version 0.2.20 (code 31) follows the web campaign exactly: six studio levels extend Journey from 200 to 206, the completion achievement becomes "All 206 Journey Puzzles", and badges already earned are kept. The first-play tips gained a target step, the game and creator hide the system gesture handle while playing, and creator notes, tip plates, the Next key's border, locked cards and pressed big keys were refined. Built and tested on the VPS, including a signed v0.2.19 update preserving preferences. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.20); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.19 - Tips, lists and streaming audio

Version 0.2.19 (code 30) refines the first-play tips with theme-aware borders, plate-backed text and shrink-to-fit lines; makes Players one continuous list that loads ahead; lets Journey pages fit the screen instead of shrinking cards; keeps discovery cards steady mid-swipe; and replaces forest/mountain ambience with a looping zen track. The shared username filter gained a larger word list and `6` → `g` substitution. Backend, package, signing key and saved data are unchanged. Built and tested on the VPS, including a signed v0.2.18 update preserving progress. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.19); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.18 — Midori, tips and achievements

Version 0.2.18 (code 29) renames the app to Midori while retaining its package, signing key and saved data. It adds tap-through gameplay/creator tips, single-touch transition handling, deeper raised controls, more achievements and list-based puzzle-code search. Fixed level badges to agree between progress and profile responses. Built and tested on the VPS, including a signed update preserving saved progress. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.18); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.17 — Languages, guide and publishing limits

Version 0.2.17 (code 28) adds English, Spanish, French, Italian and German UI text, saved language selection, a first-play guide, a startup splash and updated audio. New usernames follow shared validation rules; puzzle creation is capped at 10 per UTC day, and Bookmarked fetches 28 items per page. Built and tested on the VPS, including a signed update preserving saved progress. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.17); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.16 — Creator memory and interface refinements

Version 0.2.16 (code 27) keeps hidden creator tiles when resizing, restores them in saved drafts, animates creator phases and icons, adds anchored puzzle code menus and seven-row bookmarks, and routes effects through media volume. Client and server limit newly entered usernames to 20 characters while preserving existing names. Built and tested on the VPS, including a signed update preserving saved progress. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.16); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.15 — Board platforms and responsive controls

Version 0.2.15 (code 26) adds raised board platforms, bounded tile dragging, animated result-bar restarts, faster press feedback and a matching uppercase Home layout. Discovery loads immediately on entry and refresh, and the service and preview now return 24 items per page. Built and tested on the VPS. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.15); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.14 — Draggable sheets and raised controls

Version 0.2.14 (code 25) adds draggable screen sheets, raised controls and cards, profile layout refinements, 32-level Journey pages, updated sound assets and 10ms touch feedback. The signed update preserves progress and creator drafts. This is an APK-only release, built and tested on the VPS. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.14); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.13 — Paged collections and layout polish

Version 0.2.13 (code 24) adds sideways pages for Journey, Worlds, profiles, bookmarks and players, with community pages fetched ahead. It refines page transitions, search dismissal, button faces, volume controls and touch feedback. Creator targets fit the available strip, and the Rulebook keeps its square practice board usable at enlarged text sizes. This is an APK-only release. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.13); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.12 — Navigation and gesture refinements

Version 0.2.12 (code 23) adds a centred Back chevron, Journey level swipes, creator backward swipes, separate Worlds sort controls and pull-down search. Journey reopens the last played level; restart holds stay inside the board outline. Profiles have side-by-side collection buttons and two-tap logout, volumes use 0–10 stops, and JetBrains Mono is now the only font. The signed update preserves saved progress and creator drafts. This is an APK-only release. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.12); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.11 — Typography and raised buttons

Version 0.2.11 (code 22) replaces Source Sans 3 with bundled JetBrains Mono, adds raised Journey/Worlds and corner buttons with press feedback, animates the Options/Profile icons, and slides Options and Profile in from below. Verification fixed community exits leaving a mismatched board during transitions and kept row labels visible with enlarged text. Saved progress, accounts and creator drafts survive an in-place update. This is an APK-only release. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.11); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.10 — Navigation and reports

Version 0.2.10 (code 21) adds bidirectional swipe navigation and Random history, separate bookmark/following/follower lists, larger board outlines and creator controls, centred puzzle miniatures, and revised result bars. Tile drags now require dropping over a legal destination. About includes feedback and bug-report forms, available without signing in; reports are stored privately on the server with email delivery disabled for now. The matching backend adds migration 010 without deleting existing data. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.10); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.9 — Journey and social features

Version 0.2.9 (code 20) adds likes, bookmarks, follows, daily streaks and online/design/streak achievements. Journey opens directly into play; its heading opens Levels, and Now Playing returns to the game. Targets are larger with plain miniature tiles, boards use a shared shorter outline, and the creator crops empty borders. Random supports an empty-space right swipe; Next follows the originating puzzle list. Profiles include followers, streaks, bookmarks and followed players; connection trouble uses a quiet offline mark. Logout asks for confirmation. The matching backend adds migration 009 without deleting existing data. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.9); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.18 — Midori, tips and achievements

Version 0.2.18 (code 29) renames the app to Midori while retaining its package, signing key and saved data. It adds tap-through gameplay/creator tips, single-touch transition handling, deeper raised controls, more achievements and list-based puzzle-code search. Fixed level badges to agree between progress and profile responses. Built and tested on the VPS, including a signed update preserving saved progress. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.18); see [deployment notes](DEPLOYMENT.md).

## Android v0.2.17 — Problem 31 hotfixes (source only; not yet built)

Adds the first-play guide, a splash screen, five languages, stricter usernames with a profanity / hate / violence filter (LDNOOBW word list, CC BY 4.0), a daily limit of ten puzzles, the Okabe-Ito colour-blind palette and two new sound cues. See [deployment notes](DEPLOYMENT.md).

## Android v0.2.8 — Sound and haptic feedback

Version 0.2.8 (code 19) uses the uisfx Zen sound pack for interface actions and a 10 ms vibration while Haptics is on. The creator has a processing sound loop that follows Sound, Effects, and app visibility. Forest and mountain ambience remain. Android 8–9 use MP3 cues; Android 10+ use Ogg Opus. Account storage, saved progress, package IDs, signing certificate, and backend contracts are unchanged. This is an APK-only update. [Download the published APK](https://13.140.89.146/INSIGHT-online.apk?v=0.2.8); see [deployment notes](DEPLOYMENT.md).

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
./gradlew testDebugUnitTest      # replays every verified campaign solution through the Kotlin rules
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
