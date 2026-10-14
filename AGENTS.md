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

Run level checks after puzzle or rule changes and browser checks after behavior changes. Run editor checks after studio or shared-rule changes. Node assertions validate gameplay, audio, and layouts; no coverage threshold exists. Screenshots are generated. Use `node scripts/check-levels.cjs --update` when changing par or allowance floors. Manually assess sound balance and difficulty.

## Commit & Pull Request Guidelines

Use short imperative subjects, such as `Fix target alignment on narrow screens`. Keep changes focused. Pull requests should explain the behavior changed, link an issue when applicable, and list manual checks. Include before-and-after screenshots for visual changes.

## Agent-Specific Instructions

Use the installed `codebase-memory` skill for structural exploration. If this project is not indexed, inspect the source directly and state that limitation. Preserve localStorage compatibility when changing saved progress or preferences.

Keep custom drafts and playtest attempts in their own storage keys. Imported files contain board data; never trust imported par values or solution routes. Validate through the shared solver before enabling playtest. The editor worker has a bounded search and cancellation; reaching the bound means unverified, not unsolvable.

There are no stars, par display, move counter or Tile Limits. A level is solved or unsolved. Revision 3 campaign progress is saved under `insight-campaign-r3` (`{done:{id:true}}`), access under `insight-campaign-v3`, and attempts under `insight-attempts-r3` / `insight-session-r3`. Revision 3 started fresh and leaves older keys (r2 stars, Tile Limits) untouched; never read them back. Winning the current frontier unlocks one next level; `insight-dev-mode-v1` grants all-level access without advancing that frontier for wins ahead of it. New Game clears that campaign's solved levels and attempts only after its confirmation, and keeps editor storage, sound and theme preferences; it switches Dev Mode off.

Lifetime achievements use `insight-achievements-v1` (format version 2: solved levels with an undo-free flag, earned badges, and `legacy` retired badges); cosmetic selection uses `insight-appearance-v1`. New Game must preserve both. Badges count completions and undo-free completions. Retired star and Tile Limits badges (`perfect-1`, `limits`, …) are kept only so their owners keep Frosted and Brushed Metal. Custom playtests and attempts played in Dev Mode cannot earn achievements. Attempt eligibility and undo history persist with the verified move path; restarting resets those flags, while undoing a restart restores them. When the collection is missing, solved levels credit completion milestones once, without skill credit or celebrations. Run `node scripts/check-achievements.cjs` after achievement, appearance, or attempt-tracking changes.

Home, pause, and settings are separate panels. Nested dialogs return to their parent and restore focus; entering or restarting a puzzle closes the whole dialog stack. Use `useFeedback` from `src/react-ui.jsx` and `FeedbackUI` for in-game confirmations and notices, rather than browser alert/confirm calls. Confirmations focus Cancel first; cancellation must preserve saved state. Run `node scripts/check-menus.cjs` after menu, notification, or confirmation changes.

The campaign is one list: Game 1's 106 levels (`src/data/levels.js`) followed by Game 2's 100 (`src/data/levels-2.js`), joined in `src/data/campaign.js` as `CAMPAIGN_LEVELS`. Worlds are assigned by position, 20 levels each (`world = floor(index/20)+1`, so World 11 holds the last 6); worlds have no themed names, only numbers and a colour in `PuzzleArt.WORLD_COLORS`. Single player on Home opens the world selector (`worldsOverlay`), a world opens its level grid (`levelsOverlay`, Back to worlds), and a fully solved world glows. Saved progress keeps Game 1's keys (`insight-campaign-r3`, `-v3`, `insight-session-r3`, `insight-attempts-r3`), so levels 1-106 keep their numbers; Game 2's old `insight-game2-*` keys are unused. Achievements cover all levels and the World Master badges cover every world. The old Game 2 tooling (`make-game2.cjs`, `check-game2.cjs`, `check-levels --game 2`) still targets the two data files separately and is due for cleanup.

Keep gameplay and menus within one screen, with no tutorial or destination hints. Use color gradients and moving lights for the background.

Use original color-specific movement directions and the shared `transition` for gameplay and saved-route replay. Par stays in level data for design and verification only; players never see it. Keep level positions, names, shapes, and targets stable; repair only boards that cannot retain a verified route after a rule change. Recalculate par and route certificates. Increment a puzzle revision when its board changes so incompatible attempts cannot resume.
