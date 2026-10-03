# Repository Guidelines

## Project Structure & Module Organization

`Puzzle.html` contains the game interface. `styles.css` handles themes, lights, and layout; `levels.js` defines 106 puzzles; `game.js` handles gameplay, rendering, and progress. `puzzle-rules.js` shares rules and board validation with `puzzle-solver.js`, the editor, and Node checks. `tile-art.js` shares tile graphics. `Editor.html`, `editor.js`, and `editor.css` provide the one-screen puzzle studio. `sound.js` plays WAV assets from `sounds/`. Preserve level array positions because saved stars use numeric IDs.

## Build, Test, and Development Commands

- `Start-Process .\Puzzle.html` opens the game in the default browser on Windows.
- `python -m http.server 8000` optionally serves the directory if Python is installed; visit `http://localhost:8000/Puzzle.html`.
- `node check-levels.cjs` validates every board and solves all levels to verify optimal par; it refreshes `level-checks.json` and the editor's `level-solutions.js` certificates.
- `node check-browser.cjs` plays all verified solutions and checks interactions, storage, focus, and layouts. It requires Playwright and Chrome; set `PLAYWRIGHT_PATH` and `CHROME_PATH` if necessary.
- `node check-editor.cjs` checks the shared solver, studio editing, import/export, custom playtesting, storage isolation, direct-file validation, and layouts. It uses the same Playwright and Chrome settings.
- `node make-sounds.cjs` regenerates original instrumental WAV assets using Node's standard library; the voice cue remains bundled.

No installation or build is required for gameplay. Reload after editing; keep a consistent URL because browser storage is origin-specific.

## Coding Style & Naming Conventions

Use plain HTML, CSS, and JavaScript with two-space indentation. Use `camelCase` for functions and state (`renderBoard`, `levelState`), uppercase constants (`LEVELS`, `WORLD_META`), and kebab-case CSS classes (`board-shell`). Preserve element IDs and tile codes. Reuse `legalMoves`, `swapCells`, and `startLevel`. No formatter or linter is configured.

## Testing Guidelines

Run level checks after puzzle or rule changes and browser checks after behavior changes. Run editor checks after studio or shared-rule changes. Node assertions validate both game modes, audio, and layouts; no coverage threshold exists. Screenshots are generated. Use `node check-levels.cjs --update` when changing par or allowance floors. Manually assess sound balance and difficulty.

## Commit & Pull Request Guidelines

This workspace has no Git metadata, so existing commit conventions cannot be verified. Use short imperative subjects, such as `Fix target alignment on narrow screens`. Keep changes focused. Pull requests should explain the behavior changed, link an issue when applicable, and list manual checks. Include before-and-after screenshots for visual changes.

## Agent-Specific Instructions

Use the installed `codebase-memory` skill for structural exploration. If this project is not indexed, inspect the source directly and state that limitation. Preserve localStorage compatibility when changing saved progress or preferences.

Keep custom drafts and playtest attempts in their own storage keys. Imported files contain board data; never trust imported par values or solution routes. Validate through the shared solver before enabling playtest. The editor worker has a bounded search and cancellation; reaching the bound means unverified, not unsolvable.

Keep gameplay and menus within one screen, with no tutorial or destination hints. Use color gradients and moving lights for the background. Tile allowances last for the puzzle, follow tiles, charge only the initiator, and restore on undo; retain a verified solvable route.
