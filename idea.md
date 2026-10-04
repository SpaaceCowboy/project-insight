# Game Ideas — Implementation Report

## Puzzle Studio — 2026-10-02

The menu now opens My Puzzles · Editor. The studio supports 1–5-row/column boards, Start/Target drag/drop placement, visible empty slots, moving/swapping/removing tiles, tile-count feedback, drop undo/redo, resize, copy/swap, legal shuffling, named autosaved drafts, duplicate/delete, campaign templates, and single/collection JSON import/export. Native keyboard and touch controls work within one screen. No framework or dependency was added.

The game, editor, and Node checks share movement rules and tile graphics. A cancellable worker verifies solvability, optimal par, and the initiating tile budgets. Search limits report unverified. Playtest uses the existing game and returns to the same draft; custom attempts are separated by draft/mode and campaign progress remains isolated. See `editor.md` for controls, format, and limits.

Verification passed: all 106 solver routes, 212 campaign browser playthroughs, and the studio checks for drag/drop, placeholders, keyboard/touch, undo/redo, persistence, import/export, custom attempts/modes, cancellation, damaged/blocked storage, direct-file validation, and five viewport sizes. Screenshots are `artifacts/screenshots/editor-desktop.png` and `artifacts/screenshots/editor-mobile.png`. Human playtesting remains pending.

## Player Trust and Feedback — 2026-10-02

Unfinished attempts are saved by puzzle and Tile Limits mode, including the exact allowances and undo route. Older single-attempt saves migrate on first use. Restart can be undone until the next committed move, and restart recovery survives reload. Returning to an exhausted puzzle offers Undo, Restart, or Choose another puzzle. Final-level controls explicitly offer replay and level selection.

Invalid taps keep the initiating tile selected and spend nothing; tapping the board background cancels selection. A dragged tile settles from its release position. Undo, restart, and resize retain useful keyboard focus. Newly correct tiles briefly glow after a swap; winning sends one small ripple through the board before the result appears. These effects respect reduced motion and add no destination hints or permanent tile markers.

Ambience and Effects have independent saved sliders; the old volume initializes both. Spoken celebration has a saved checkbox. Audio starts, volume changes, and muting use short fades. The master Sound button still controls every layer. Compact menus arrange settings in two columns to fit short screens.

The five-person human validation protocol is in `playtest.md`. No human playtest results are claimed.

Verification passed for this batch: all 106 optimal solver routes and 212 browser playthroughs. Regression checks cover legacy-save migration, separate puzzle/mode attempts, undo restart across reload, exhausted-attempt recovery, drag release, invalid selection, placement/win animations, independent audio preferences, keyboard focus, and five viewport sizes.

## Light Sculpture Polish — 2026-10-01

The board now sits in a softly lit circular chamber, with a compact target and controls beside it on desktop and stacked above/below it on phones. Target tiles carry the same direction symbols as the board. The menu uses a floating tile mosaic; solved counts appear in the menu and world picker. Color gradients, moving light, one-screen play, and reduced-motion support remain.

Tap twice, drag, or use the keyboard to swap. Small pointer jitter is treated as a tap; taps can carry passive or exhausted tiles. Zero allowances have a distinct appearance. A solved grid briefly glows before the result opens, and move particles take the tiles' colors. The particle loop sleeps when there is nothing to draw.

Continue keeps the live board. Reload restores an unfinished puzzle, its exact starting allowances, remaining allowances, light color, and undo route. Saved routes are validated by replaying legal moves; malformed saves fall back to an unfinished level. Existing stars and preference keys remain compatible. Sound mute is now saved too.

Each tile color has a native musical pluck from one pentatonic scale; undo plays a descending response. Existing local sounds provide ambience, completion, and a fallback. No runtime dependency was added. See `public/sounds/README.md`.

Verification passed: all 106 solver routes and 212 browser playthroughs (classic and limited). Browser checks also cover mouse taps with jitter, real touch taps, passive tile swaps, exact resume and undo, malformed saved routes, saved mute, musical frequencies/volume, budget exhaustion, focus, and five viewport sizes. Five-row maps retain 44px tiles at 320×568. Before/after desktop and phone screenshots are included, alongside menu, Zen, and dawn previews.

All four ideas are implemented. The visual direction uses Ori and the Blind Forest as a mood reference: deep teal, blue, moss, ivory light, and restrained amber. The background stays color-only, as requested; no background image is used.

## Random Tile Movement Allowances — Done

Each movable tile receives 3–6 moves for the whole puzzle. Only initiating a swap spends a move; the allowance follows the tile when carried. Undo restores it. Restart restores the same starting allowances. The first visit to a puzzle generates its allowances; subsequent visits preserve them.

Random allocations respect a verified solution's minimum requirements, so every starting puzzle remains solvable. Exhausted tiles can still be carried. If no moves remain, Undo, Restart, and choosing another puzzle remain available. Tile Limits can be switched off in the menu; classic and limited modes save stars and attempts separately. Returning to a puzzle restores its original allocation.

## Minimal Cozy Sound Pack — Done

Six local WAV files provide slow, spacious pads, occasional distant chimes, soft selection and movement notes, a low invalid-move note, a completion chime, and an occasional “Lovely.” voice cue. All are original instrumental sounds or synthesized speech; no Ori soundtrack is used.

Recording levels and playback levels have both been raised. The menu has a saved 0–100% volume slider, defaulting to 80%. Sound mutes every layer, and background audio pauses when the page is hidden. Playback starts after interaction. See `public/sounds/README.md`.

## Tile-Reactive Moving Lights — Done

Two soft light fields drift across color gradients. Committing a move shifts the light to the initiating tile's color family, with lighter and darker shades. Undo restores the prior color. Reduced-motion preferences stop the drift and transitions. Moonlit and dawn palettes are selectable.

## More Complicated Maps — Done

Six maps form World 5, bringing the total to 106: Twin Rooms, Hourglass Crossing, Island Chain, Spiral Passage, Branching Paths, and Split Diamond. Sparse 4×4 and 5×5 shapes introduce connected chambers, bottlenecks, branches, and gaps. Original level positions stay unchanged.

## Verification

The solver verifies all 106 optimal routes and replays them with the minimum allowed tile budgets. Browser checks play every route in both modes and check undo, budget exhaustion, storage, audio loading/decoding, volume, keyboard focus, and screen fit. No tutorial or destination hints were added. Human difficulty and subjective sound balance still benefit from playtesting.
