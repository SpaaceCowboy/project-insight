# INSIGHT

A tile-swapping puzzle game with 106 levels, sound, Classic and Tile Limits modes, and a drag-and-drop level editor.

## Play

Open `Puzzle.html` in your browser. No installation or build is required.

To serve it locally, run `python -m http.server 8000` and visit [the game](http://localhost:8000/Puzzle.html).

Open **My Puzzles · Editor** from the game menu, or open `Editor.html`. Drag tiles onto empty slots, swap them, or drop them outside the board to remove them. Validate a puzzle before playtesting it. See [the editor guide](editor.md) for import, export, and keyboard controls.

Progress and drafts are saved in your browser. Keep the same browser and URL to retain them; export custom puzzles to back them up.

## Checks

- `node check-levels.cjs` validates and solves every campaign level.
- `node check-browser.cjs` checks gameplay, storage, sound, and layouts.
- `node check-editor.cjs` checks editing, validation, import/export, and custom playtesting.

Browser checks require Playwright and Chrome. Set `PLAYWRIGHT_PATH` and `CHROME_PATH` if they are not found automatically. Gameplay itself has no external dependencies.
