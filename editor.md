# INSIGHT Puzzle Studio

Open the game menu and choose **My Puzzles · Editor**, or open `Editor.html` directly. No installation, build, or server is required. Keep the same URL/browser to retain drafts.

## Design and play

- **Build:** drag tiles from the palette into outlined empty slots. Drag a placed tile onto another tile to swap them on the edited board. Moving onto an empty slot relocates that cell on both Start and Target so their shapes stay aligned. Throw a placed tile outside the board, drag to × Remove, or press Delete/Backspace on a cell to leave a placeholder on both boards. Empty slots are gaps in gameplay; white tiles remain a separate playable tile type. New boards, expanded rows/columns, and Clear leave empty slots.
- **Undo/Redo:** one drop or removal is one edit. Arrow keys move between cells. For keyboard placement, Enter/Space picks up a palette or board tile; focus a destination and press Enter/Space to drop. R, B, G, Y, W, and P pick up palette tiles. Escape cancels; releasing a new palette tile outside cancels placement. Undo restores tiles thrown outside. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Text inputs keep their normal editing shortcuts. Edit history lasts until switching drafts or reloading.
- **Puzzles:** name and select drafts, create, duplicate, delete, resize from 1–5 rows/columns, clear, copy any campaign puzzle into a new draft, or generate Start through legal shuffling of Target. Cropping and clearing can be undone.
- **Validate:** check tile counts, gaps, solvability, optimal par, and tile allowance requirements. Cancel the check with its button or Escape. Changing the board cancels an in-progress check and removes its old result; renaming preserves it.
- **Playtest:** use the existing game with its sound, controls, undo, restart, animations, and two modes. Back to editor returns to the same draft. Unfinished custom attempts are saved by draft and mode; board changes invalidate incompatible attempts. Campaign stars and attempts remain separate.

Unchanged copies of campaign puzzles reuse their verified optimal routes immediately. New arrangements use a background solver that checks at most 350,000 positions or eight seconds. Hitting either limit reports **not verified** and leaves Playtest disabled. An exhaustive search that finds no route reports **unsolvable**. Tile Limits is enabled only when the verified route needs at most six initiations per tile; otherwise the puzzle can be tested in Classic mode. Solutions are not displayed as gameplay hints.

## Files and storage

Files exports either the active puzzle or all drafts as JSON. Import a file or paste JSON. A collection uses `{"format":"insight-puzzles","version":1,"puzzles":[...]}`; a single `{name,start,target}` object also works. Rows are strings containing R, B, G, Y, W, P, and . for gaps. Imported par/solution fields are ignored, and imported puzzles require validation. Imports are atomic, limited to 256 KB and a library of 100 drafts.

Drafts autosave under `insight-editor-drafts-v1`; custom playtest attempts use `insight-editor-attempts-v1`. If browser storage is unavailable, **Export to keep** appears and editing continues in memory. Export before closing. Unreadable saved data is retained under `insight-editor-drafts-v1-recovery` before replacement; valid drafts in a partially damaged collection remain available.

## Checks

`node check-editor.cjs` verifies the solver, pointer and touch drag/drop, placeholders, keyboard placement, drop undo/redo, draft persistence, import/export, custom attempt/mode isolation, cancellation, damaged/blocked storage, and a worker launched directly from disk. It checks all panels at 320×568, 375×667, 768×600, 1280×720, and 844×390; 5×5 placement keeps 44px cells at 320×568. Desktop and phone previews are `editor-desktop.png` and `editor-mobile.png`. Human usability sessions have not been run.
