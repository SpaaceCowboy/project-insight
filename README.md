# INSIGHT Studio

The web project is a dev space for designing INSIGHT levels. The game itself is the Android app in `../project-insight-android`; levels designed here are appended to its campaign.

```sh
npm install
npm run dev     # http://127.0.0.1:8000/  (the studio)
```

## Workflow

1. Build a puzzle in the studio (drag tiles, Start and Target boards). See [editor.md](editor.md).
2. **Validate**: the solver checks it is solvable and finds the shortest solution (par).
3. **Playtest** it in the game screen (`Puzzle.html?editor=1`), then Back to editor.
4. **Add to game** (dev server only): the server re-solves the puzzle itself, rejects boards already in the game, appends it to `src/data/levels-3.js` / `level-solutions-3.js`, and runs `../project-insight-android/tools/export-assets.mjs` to refresh the Android assets. The new level becomes the next campaign number (207, 208, …; World 11 holds 207–220, World 12 follows).
5. In the Android project run `./gradlew testDebugUnitTest` (replays every verified route) and build the APK.

**Remove level N** (next to Add to game) undoes the newest studio level after a confirmation. Only the newest can go: removing an earlier one would renumber the rest and break saved progress.

Levels are append-only: Android saves progress by level number. To change or reorder existing levels, edit `src/data/*` by hand and re-run `node scripts/check-levels.cjs --update`.

`Export` in the studio still writes puzzle JSON; it is a backup/share format and is not read by the game.

## Checks

- `node scripts/check-levels.cjs [--game 2|3]` validates and solves every level in that data file; `--update` rewrites par and certificates.
- `npm run build`, then `node scripts/check-editor.cjs` (studio, import/export, playtest handoff, production worker) and `node scripts/check-react.cjs` (Strict Mode, remounts, cleanup).

Browser checks need Playwright and Chrome (`PLAYWRIGHT_PATH`, `CHROME_PATH`). Known issue: `check-editor` currently stops at the touch-tap undo step (fails the same way before the studio split).

## Layout

- `src/EditorApp.jsx`, `src/useEditor.js`: the studio. `src/GameApp.jsx`, `src/useGame.js`: playtest only.
- `src/puzzle-rules.js`, `src/puzzle-solver.js`: shared rules and solver (also used by Node scripts and the editor worker).
- `src/data/`: `levels.js` (1–106), `levels-2.js` (107–206), `levels-3.js` (studio, 207+), with `level-solutions*.js` certificates; `campaign.js` joins them.
- `scripts/studio-plugin.mjs`: the dev-only `POST /__studio/add-level` endpoint.
