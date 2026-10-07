# INSIGHT

A React tile-swapping puzzle game with 106 levels, sound, and a drag-and-drop level editor.

Tiles use their original color-specific movement directions. There is no move limit and no star rating: a level is solved or not.

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

Campaign play starts at level 1. Solving a level unlocks the next. Revision 3 removed stars and Tile Limits and starts campaign progress fresh; older local records remain untouched, and editor drafts, preferences, lifetime achievements and cosmetics remain available. Solved levels use `insight-campaign-r3`, access `insight-campaign-v3`, and attempts `insight-attempts-r3` and `insight-session-r3`. Saved attempts include a puzzle revision and restore boards by replaying verified moves.

**New Game** asks before clearing solved levels and attempts, then returns to level 1 with Dev Mode off. Custom puzzles, playtests, sound, theme settings, lifetime achievements, and cosmetics remain saved. **Dev Mode** unlocks all 106 levels and persists across reloads; solving a level ahead of the campaign does not advance its unlock progress. Turning it off returns to an unlocked campaign level.

**Achievements** opens a permanent collection of 15 campaign and skill badges, plus background and tile-finish rewards. Badges reward completing levels, worlds and the campaign, and completing levels without undo (First Clean Solve, Steady Hand, Unbroken, Flawless, Clean Sweep, Pristine). Existing lifetime achievements are preserved; players who earned the retired star or Tile Limits badges keep their Frosted and Brushed Metal finishes. Solved levels can silently recover completion milestones when rebuilding a missing collection. Custom playtests and attempts played in Dev Mode earn no achievements; switch Dev Mode off and restart to qualify again. Restart begins a fresh attempt; undoing the restart restores its previous eligibility and undo history. Older resumed attempts need a restart before earning no-undo credit.

New badges appear in a styled top-right announcement for five seconds each. Multiple unlocks play in sequence, with cosmetic reward names. Announcements do not take focus or block controls, wait while the tab is hidden, and respect reduced motion. The victory card keeps its collection summary; existing awards and migration do not replay popups.

Appearance rewards are equipped explicitly and apply to both the game and editor, with light/dark and reduced-motion support. `insight-achievements-v1` stores lifetime results and badges independently of campaign progress; `insight-appearance-v1` stores cosmetic choices. When browser storage is unavailable, rewards and choices work for the current page session.

For deliberate development resets, the Vite server serves `/tools/achievement-progress.html`. Its reset clears only the achievement collection and appearance, prevents old progress being credited again, and keeps a restorable backup. This utility is excluded from the production build.

## Checks

Run `npm run build` before the browser checks; they test the production bundle.

- `node scripts/check-levels.cjs` validates and solves every campaign level.
- `node scripts/check-browser.cjs` checks gameplay, storage, sound, and layouts.
- `node scripts/check-achievements.cjs` checks all achievement thresholds, eligibility, saved results, cosmetics, and panel layouts.
- `node scripts/check-menus.cjs` checks home/pause/settings navigation, confirmations, notifications, focus, and five viewport sizes.
- `node scripts/check-editor.cjs` checks editing, validation, import/export, and custom playtesting.
- `node scripts/check-react.cjs` runs an isolated Vite development fixture to check React Strict Mode, repeated mounts, animation and worker cancellation, audio disposal, preference races, and saved drafts.

Browser checks require Playwright and Chrome. Set `PLAYWRIGHT_PATH` and `CHROME_PATH` if they are not found automatically.

The campaign retains its 106 level positions, names, targets, and shapes. After removing the added mechanics, every Start and Target remains unchanged. Par values (used only for design and verification) and certificates follow the original rules. See `playtest.md` for remaining human validation.

## Production

`npm run build` writes the game, editor, and sound assets to `dist/`. Publish that directory on a static web host, or use `npm run preview` to check it locally. React is bundled; no CDN is needed. Open the built app through a web server, rather than directly from disk.

## Structure

`src/GameApp.jsx` and `src/EditorApp.jsx` define the React screens. `src/useGame.js` and `src/useEditor.js` own their state and interactions, including progress, drafts, drag gestures, and solver validation. `src/views.jsx` contains the shared tiles, boards, palette, target, and level selector. `src/react-ui.jsx` provides shared React dialogs, feedback, appearance effects, and animations; `src/useAudio.js` manages the audio engine's lifecycle. React renders every screen and binds its controls directly. App logic and puzzle data use ES module imports, with no browser-global data loader. The existing save formats are preserved. `src/puzzle-rules.js` and `src/puzzle-solver.js` remain shared logic usable by both the browser and Node checks.

- `src/`: React components, hooks, shared JavaScript logic, and CSS.
- `src/data/`: the 106 campaign puzzles and generated solution certificates.
- `public/sounds/`: bundled WAV assets, copied by Vite during builds.
- `scripts/`: checks and the sound generator.
- `artifacts/level-checks.json`: verified routes and par values.
- `artifacts/screenshots/`: existing previews and screenshots generated by browser checks; ignored by Git.

The root contains the HTML entry points, project configuration, and documentation. Ordinary `.js` files hold non-visual logic and data; React components use `.jsx`.
