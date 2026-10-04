# INSIGHT

A React tile-swapping puzzle game with 106 levels, sound, Classic and Tile Limits modes, and a drag-and-drop level editor.

Tiles use their original color-specific movement directions. Tile Limits assigns 3–6 moves per movable tile, with a verified solution floor. Only the initiating tile pays, its allowance follows it, and undo restores it.

## Play

Install Node.js 22.12+ (or 20.19+), then run:

```sh
npm install
npm run dev
```

Visit [the game](http://127.0.0.1:8000/Puzzle.html). The default home page also opens the game.

Open **My Puzzles · Editor** from the game menu, or visit `/Editor.html`. Drag tiles onto empty slots, swap them, or drop them outside the board to remove them. Validate a puzzle before playtesting it. See [the editor guide](editor.md) for import, export, and keyboard controls.

Progress and drafts are saved in your browser. Keep the same browser and URL to retain them; export custom puzzles to back them up.

The **Home** screen holds Continue, New Game, Levels, Achievements, the Editor, and Settings. **Pause** (or Escape with no tile selected) opens a separate pause menu with Resume, Restart, Levels, Achievements, Settings, and Back to home. Closing a child panel returns to its parent and restores keyboard focus. Settings has **Play**, **Sound**, and **Appearance** tabs; changing puzzle mode resumes that mode's saved attempt while keeping Settings open.

Destructive actions use styled in-game confirmations with Cancel focused first. Escape and the backdrop cancel safely. Notifications show success, warning, and error states in a corner of the game or editor; storage warnings remain available while progress is temporary. Editor validation messages also remain beside its action buttons. Browser alerts and confirmations are not used.

Campaign play starts at level 1. Solving a level unlocks the next, and unlocked levels remain available in both Classic and Tile Limits. Revision 2 starts fresh because its puzzle content changed. Original local records remain untouched; editor drafts, preferences, lifetime achievements, and cosmetics remain available. Refreshed stars use `insight-campaign-r2-classic` and `insight-campaign-r2-limits`; attempts use `insight-attempts-r2` and `insight-session-r2`; shared access uses `insight-campaign-v2`. Saved attempts include a puzzle revision and restore boards and remaining allowances by replaying verified moves.

**New Game** asks before clearing campaign stars and attempts in both modes, then returns to level 1 with Dev Mode off. Custom puzzles, playtests, sound, theme settings, lifetime achievements, and cosmetics remain saved. **Dev Mode** unlocks all 106 levels and persists across reloads; solving a level ahead of the campaign does not advance its unlock progress. Turning it off returns to an unlocked campaign level.

**Achievements** opens a permanent collection of 15 campaign and skill badges, plus background and tile-finish rewards. Distinct levels count once across both modes. Existing lifetime achievements are preserved, but original campaign stars do not credit changed puzzles. Refreshed stars can silently recover completion milestones when rebuilding a missing collection. Custom playtests and attempts played in Dev Mode earn no achievements; switch Dev Mode off and restart to qualify again. Restart begins a fresh attempt; undoing the restart restores its previous eligibility and undo history. Older resumed attempts need a restart before earning no-undo credit.

New badges appear in a styled top-right announcement for five seconds each. Multiple unlocks play in sequence, with cosmetic reward names. Announcements do not take focus or block controls, wait while the tab is hidden, and respect reduced motion. The victory card keeps its collection summary; existing awards and migration do not replay popups.

Appearance rewards are equipped explicitly and apply to both the game and editor, with light/dark and reduced-motion support. `insight-achievements-v1` stores lifetime results and badges independently of campaign stars; `insight-appearance-v1` stores cosmetic choices. When browser storage is unavailable, rewards and choices work for the current page session.

For deliberate development resets, the Vite server serves `/tools/achievement-progress.html`. Its reset clears only the achievement collection and appearance, prevents old stars being credited again, and keeps a restorable backup. This utility is excluded from the production build.

## Checks

Run `npm run build` before the browser checks; they test the production bundle.

- `node check-levels.cjs` validates and solves every campaign level.
- `node check-browser.cjs` checks gameplay, storage, sound, and layouts.
- `node check-achievements.cjs` checks all achievement thresholds, eligibility, saved results, cosmetics, and panel layouts.
- `node check-menus.cjs` checks home/pause/settings navigation, confirmations, notifications, focus, and five viewport sizes.
- `node check-editor.cjs` checks editing, validation, import/export, and custom playtesting.

Browser checks require Playwright and Chrome. Set `PLAYWRIGHT_PATH` and `CHROME_PATH` if they are not found automatically.

The campaign retains its 106 level positions, names, targets, and shapes. After removing the added mechanics, every Start and Target remains unchanged. Levels 35 and 99 use newly verified routes within the six-move allowance cap; level 35 has Classic par 20 and Tile Limits par 21. Par values and certificates follow the original rules. See `playtest.md` for remaining human validation.

## Production

`npm run build` writes the game, editor, and sound assets to `dist/`. Publish that directory on a static web host, or use `npm run preview` to check it locally. React is bundled; no CDN is needed. Open the built app through a web server, rather than directly from disk.

## Structure

`src/GameApp.jsx` and `src/EditorApp.jsx` define the React screens. `src/views.jsx` contains the shared tiles, boards, palette, target, and level selector. The existing controllers publish view snapshots through `src/view-store.js`, retaining the verified rules, drag interactions, and save formats. `puzzle-rules.js` and `puzzle-solver.js` remain usable by both the browser and Node checks.
