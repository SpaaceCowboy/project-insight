# CLAUDE.md

`AGENTS.md` is the primary guide (structure, commands, level-data rules); this file adds only architecture notes it doesn't cover.

- **One bundle, three HTML entries.** `src/main.jsx` renders `GameApp` for `/Puzzle.html` and `EditorApp` for everything else. `vite.config.mjs` uses `base: './'`.
- **Shared logic is plain ESM that Node `require()`s/`import`s.** `puzzle-rules.js`, `puzzle-solver.js` and `src/data/*` must not import browser APIs, JSX or CSS. `src/data.js` re-exports them for the app.
- **The editor worker is built from function source.** `useEditor.validate()` builds the worker from `PuzzleRules.create.toString()` and `PuzzleSolver.create.toString()`; both `create()` functions must stay self-contained.
- **Campaign copies skip the solver.** A draft that matches a level in `CAMPAIGN_LEVELS` is verified against `CAMPAIGN_SOLUTIONS` (index-aligned).
- **Playtest handoff.** The editor writes the validated puzzle to `sessionStorage['insight-editor-preview-v1']` and opens `Puzzle.html?editor=1`; `initializeGame()` re-verifies it with `PuzzleSolver.verify`. A missing/invalid handoff sets `config.error` and `useGame` redirects to `Editor.html`.
- **Add to game.** `scripts/studio-plugin.mjs` (Vite `apply:'serve'`) handles `POST /__studio/add-level`, writes `src/data/levels-3.js` and `level-solutions-3.js` atomically, then runs the Android `tools/export-assets.mjs`. `GET /__studio/levels` lists studio levels and `POST /__studio/remove-last {level}` pops the newest (it must match the current last number, otherwise 409). Those two files are excluded from Vite's watcher so the write doesn't reload the page. The button is rendered only when `import.meta.env.DEV`.
- `node scripts/make-game2.cjs` is the old Game 2 generator; `level-design.md`, `playtest.md`, `pending.md`, `idea.md` are historical design notes.
