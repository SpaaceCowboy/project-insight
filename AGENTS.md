# Repository Guidelines

## Project Structure & Module Organization

`Puzzle.html` and `Editor.html` are Vite entry points. React screens and shared view components live in `src/`; `game.js` and `editor.js` retain the rule and interaction controllers. `styles.css` handles themes, lights, and layout; `levels.js` defines 106 puzzles; `game.js` handles gameplay, rendering, and progress. `puzzle-rules.js` shares rules and board validation with `puzzle-solver.js`, the editor, and Node checks. `tile-art.js` shares tile graphics. `Editor.html`, `editor.js`, and `editor.css` provide the one-screen puzzle studio. `sound.js` plays WAV assets from `sounds/`. Preserve level array positions because saved stars use numeric IDs.

## Build, Test, and Development Commands

- `npm install` installs the pinned React and Vite dependencies.
- `npm run dev` serves the game at `http://127.0.0.1:8000/Puzzle.html` and the studio at `/Editor.html`.
- `npm run build` produces `dist/`; run it before browser checks. `npm run preview` previews the production build.
- `node check-levels.cjs` validates every board and solves all levels to verify optimal par; it refreshes `level-checks.json` and the editor's `level-solutions.js` certificates.
- `node check-browser.cjs` plays all verified solutions and checks interactions, storage, focus, and layouts. It requires Playwright and Chrome; set `PLAYWRIGHT_PATH` and `CHROME_PATH` if necessary.
- `node check-editor.cjs` checks the shared solver, studio editing, import/export, custom playtesting, storage isolation, production worker validation, and layouts. It uses the same Playwright and Chrome settings.
- `node make-sounds.cjs` regenerates original instrumental WAV assets using Node's standard library; the voice cue remains bundled.

Use the Vite development server or serve the built `dist/` directory. Keep a consistent URL because browser storage is origin-specific.

## Coding Style & Naming Conventions

Use React JSX, CSS, and JavaScript with two-space indentation. Use `camelCase` for functions and state (`renderBoard`, `levelState`), uppercase constants (`LEVELS`, `WORLD_META`), and kebab-case CSS classes (`board-shell`). Preserve element IDs and tile codes. Reuse `legalMoves`, `swapCells`, and `startLevel`. No formatter or linter is configured.

## Testing Guidelines

Run level checks after puzzle or rule changes and browser checks after behavior changes. Run editor checks after studio or shared-rule changes. Node assertions validate both game modes, audio, and layouts; no coverage threshold exists. Screenshots are generated. Use `node check-levels.cjs --update` when changing par or allowance floors. Manually assess sound balance and difficulty.

## Commit & Pull Request Guidelines

Use short imperative subjects, such as `Fix target alignment on narrow screens`. Keep changes focused. Pull requests should explain the behavior changed, link an issue when applicable, and list manual checks. Include before-and-after screenshots for visual changes.

## Agent-Specific Instructions

Use the installed `codebase-memory` skill for structural exploration. If this project is not indexed, inspect the source directly and state that limitation. Preserve localStorage compatibility when changing saved progress or preferences.

Keep custom drafts and playtest attempts in their own storage keys. Imported files contain board data; never trust imported par values or solution routes. Validate through the shared solver before enabling playtest. The editor worker has a bounded search and cancellation; reaching the bound means unverified, not unsolvable.

Revision 2 campaign access is saved under `insight-campaign-v2`, shared by Classic and Tile Limits. Its stars use `insight-campaign-r2-classic` / `insight-campaign-r2-limits`, and attempts use `insight-attempts-r2` / `insight-session-r2`. The refreshed campaign starts at level 1 and leaves original storage untouched; do not apply original stars or routes to changed puzzles. Winning the current frontier unlocks one next level; `insight-dev-mode-v1` grants all-level access without advancing that frontier for wins ahead of it. New Game clears current campaign stars and attempts only after its confirmation, and keeps editor storage, sound, theme, and play-mode preferences; it switches Dev Mode off.

Lifetime achievements use `insight-achievements-v1`; cosmetic selection uses `insight-appearance-v1`. New Game and Reset Stars must preserve both. Custom playtests and attempts played in Dev Mode cannot earn achievements. Attempt eligibility and undo history persist with the verified move path; restarting resets those flags, while undoing a restart restores them. Legacy stars credit milestones once, without skill credit or celebrations. Run `node check-achievements.cjs` after achievement, appearance, or attempt-tracking changes.

Home, pause, and settings are separate panels. Nested dialogs return to their parent and restore focus; entering or restarting a puzzle closes the whole dialog stack. Use `src/feedback.js` and `FeedbackUI` for in-game confirmations and notices, rather than browser alert/confirm calls. Confirmations focus Cancel first; cancellation must preserve saved state. Run `node check-menus.cjs` after menu, notification, or confirmation changes.

Keep gameplay and menus within one screen, with no tutorial or destination hints. Use color gradients and moving lights for the background. Tile allowances last for the puzzle, follow tiles, charge only the initiator, and restore on undo; retain a verified solvable route.

Use original color-specific movement directions and the shared `transition` for gameplay and saved-route replay. Tile Limits assigns 3–6 moves per movable tile, respecting a verified optimal route; allowances follow tiles and charge only the initiator. Keep level positions, names, shapes, and targets stable; repair only boards that cannot retain a verified route after a rule change. Recalculate par and route certificates. Increment a puzzle revision when its board changes so incompatible attempts cannot resume.
