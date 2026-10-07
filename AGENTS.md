# Repository Guidelines

## Project Structure & Module Organization

`Puzzle.html` and `Editor.html` are Vite entry points. React screens, shared view components, and state hooks live in `src/`. `src/useGame.js` owns gameplay and progress, `src/game-state.js` handles save restoration and puzzle state transitions, and `src/useEditor.js` owns the studio's drafts and interactions. `src/react-ui.jsx` shares React dialogs, feedback, appearance effects, and animation components. `src/styles.css` handles themes, lights, and layout; `src/data/levels.js` defines 106 puzzles. `src/puzzle-rules.js` shares rules and board validation with `src/puzzle-solver.js`, the editor, and Node checks. `src/tile-art.js` shares tile artwork data. `Editor.html`, `src/EditorApp.jsx`, and `src/editor.css` provide the one-screen puzzle studio. `src/sound.js` provides the audio engine for `src/useAudio.js` and plays WAV assets from `public/sounds/`. Preserve level array positions because saved stars use numeric IDs.

## Build, Test, and Development Commands

- `npm install` installs the pinned React and Vite dependencies.
- `npm run dev` serves the game at `http://127.0.0.1:8000/Puzzle.html` and the studio at `/Editor.html`.
- `npm run build` produces `dist/`; run it before browser checks. `npm run preview` previews the production build.
- `node scripts/check-levels.cjs` validates every board and solves all levels to verify optimal par; it refreshes `artifacts/level-checks.json` and the editor's `src/data/level-solutions.js` certificates.
- `node scripts/check-browser.cjs` plays all verified solutions and checks interactions, storage, focus, and layouts. It requires Playwright and Chrome; set `PLAYWRIGHT_PATH` and `CHROME_PATH` if necessary.
- `node scripts/check-editor.cjs` checks the shared solver, studio editing, import/export, custom playtesting, storage isolation, production worker validation, and layouts. It uses the same Playwright and Chrome settings.
- `node scripts/check-react.cjs` checks Strict Mode, repeated mounts, cancellation, audio and worker cleanup, preference races, and draft persistence against an isolated Vite development server.
- `node scripts/make-sounds.cjs` regenerates original instrumental WAV assets using Node's standard library; the voice cue remains bundled.

Use the Vite development server or serve the built `dist/` directory. Keep a consistent URL because browser storage is origin-specific.

## Coding Style & Naming Conventions

Use React JSX, CSS, and JavaScript with two-space indentation. Use `camelCase` for functions and state (`startPuzzle`, `levelState`), uppercase constants (`LEVELS`, `WORLD_META`), and kebab-case CSS classes (`board-shell`). Preserve element IDs and tile codes. Reuse `legalMoves`, `swapCells`, and `startPuzzle`. No formatter or linter is configured.

## Testing Guidelines

Run level checks after puzzle or rule changes and browser checks after behavior changes. Run editor checks after studio or shared-rule changes. Node assertions validate both game modes, audio, and layouts; no coverage threshold exists. Screenshots are generated. Use `node scripts/check-levels.cjs --update` when changing par or allowance floors. Manually assess sound balance and difficulty.

## Commit & Pull Request Guidelines

Use short imperative subjects, such as `Fix target alignment on narrow screens`. Keep changes focused. Pull requests should explain the behavior changed, link an issue when applicable, and list manual checks. Include before-and-after screenshots for visual changes.

## Agent-Specific Instructions

Use the installed `codebase-memory` skill for structural exploration. If this project is not indexed, inspect the source directly and state that limitation. Preserve localStorage compatibility when changing saved progress or preferences.

Keep custom drafts and playtest attempts in their own storage keys. Imported files contain board data; never trust imported par values or solution routes. Validate through the shared solver before enabling playtest. The editor worker has a bounded search and cancellation; reaching the bound means unverified, not unsolvable.

Revision 2 campaign access is saved under `insight-campaign-v2`, shared by Classic and Tile Limits. Its stars use `insight-campaign-r2-classic` / `insight-campaign-r2-limits`, and attempts use `insight-attempts-r2` / `insight-session-r2`. The refreshed campaign starts at level 1 and leaves original storage untouched; do not apply original stars or routes to changed puzzles. Winning the current frontier unlocks one next level; `insight-dev-mode-v1` grants all-level access without advancing that frontier for wins ahead of it. New Game clears current campaign stars and attempts only after its confirmation, and keeps editor storage, sound, theme, and play-mode preferences; it switches Dev Mode off.

Lifetime achievements use `insight-achievements-v1`; cosmetic selection uses `insight-appearance-v1`. New Game and Reset Stars must preserve both. Custom playtests and attempts played in Dev Mode cannot earn achievements. Attempt eligibility and undo history persist with the verified move path; restarting resets those flags, while undoing a restart restores them. Legacy stars credit milestones once, without skill credit or celebrations. Run `node scripts/check-achievements.cjs` after achievement, appearance, or attempt-tracking changes.

Home, pause, and settings are separate panels. Nested dialogs return to their parent and restore focus; entering or restarting a puzzle closes the whole dialog stack. Use `useFeedback` from `src/react-ui.jsx` and `FeedbackUI` for in-game confirmations and notices, rather than browser alert/confirm calls. Confirmations focus Cancel first; cancellation must preserve saved state. Run `node scripts/check-menus.cjs` after menu, notification, or confirmation changes.

Game 2 is a separate 100-level campaign (`src/data/levels-2.js`, five 20-level worlds) started in place from Home with **New Game 2** (development and testing only); **New Game 1** returns to the original campaign. The active campaign is saved under `insight-active-game-v1`, and each New Game clears only its own campaign. `node scripts/make-game2.cjs` regenerates it from designed targets (pattern, colours, gaps, focus tiles, par band, mood); then run `node scripts/check-levels.cjs --game 2 --update`, which writes `src/data/level-solutions-2.js`. Its stars use `insight-game2-classic` / `insight-game2-limits`, access `insight-game2-campaign`, attempts `insight-game2-attempts` / `insight-game2-session`. Game 2 earns no achievements, since those index Game 1 levels. Run `node scripts/check-game2.cjs` after Game 2 or New Game changes. Treat Game 2 positions as stable once shipped.

Keep gameplay and menus within one screen, with no tutorial or destination hints. Use color gradients and moving lights for the background. Tile allowances last for the puzzle, follow tiles, charge only the initiator, and restore on undo; retain a verified solvable route.

Use original color-specific movement directions and the shared `transition` for gameplay and saved-route replay. Tile Limits assigns 3–6 moves per movable tile, respecting a verified optimal route; allowances follow tiles and charge only the initiator. Keep level positions, names, shapes, and targets stable; repair only boards that cannot retain a verified route after a rule change. Recalculate par and route certificates. Increment a puzzle revision when its board changes so incompatible attempts cannot resume.
