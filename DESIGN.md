---
name: INSIGHT
description: A calm tile-swapping puzzle. A little order. A little wonder.
colors:
  sea-glass: "#A8DFCF"
  kelp: "#2C6963"
  pool-ink: "#102F32"
  shell-white: "#F3F7E7"
  foam: "#EDF5E9"
  tidewater: "#173E3F"
  lichen: "#AAC9C8"
  wet-slate: "#365C58"
  hairline: "#B4E0D22E"
  hairline-light: "#18463E33"
  glass: "#091F27A6"
  glass-light: "#EBF6EAA8"
  deep-pool: "#102A34"
  shallows: "#E2EFE6"
  pool-lit: "#25434A"
  shallows-lit: "#C8DCD4"
  abyss: "#0C252E"
  scrim: "#03131999"
  shell-center: "#1C3C4242"
  shell-edge: "#0418218C"
  shell-light: "#275C58B0"
  shell-light-edge: "#1A4744C2"
  shell-ink-light: "#F3F7E7"
  backdrop-forest-top: "#142B41"
  backdrop-forest-bottom: "#182F35"
  backdrop-forest-glow-a: "#234958"
  backdrop-forest-glow-b: "#1E4843"
  tile-shadow: "#000A173D"
  tile-edge: "#F0FFF073"
  arrival-foam: "#F5FFEA"
  pearl-ink: "#3E4658"
  target-ink: "#24434D"
  tile-coral: "#E09A91"
  tile-coral-deep: "#AE546B"
  tile-coral-flat: "#E69A99"
  tile-lagoon: "#93D2DB"
  tile-lagoon-deep: "#3B88A6"
  tile-lagoon-flat: "#88CEDD"
  tile-sea-lettuce: "#A6D7AD"
  tile-sea-lettuce-deep: "#4B896B"
  tile-sea-lettuce-flat: "#9FD6B5"
  tile-sand: "#F0D38B"
  tile-sand-deep: "#B88A43"
  tile-sand-flat: "#EDCC82"
  tile-anemone: "#C9B8E1"
  tile-anemone-deep: "#8464A9"
  tile-anemone-flat: "#BBA9DC"
  tile-pearl: "#F3F4DF"
  tile-pearl-deep: "#C3CFBC"
  tile-pearl-flat: "#E4ECDF"
typography:
  wordmark:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "29sp"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.3em"
  display:
    fontFamily: "Source Serif 4, serif"
    fontSize: "30sp"
    fontWeight: 400
    lineHeight: 1.2
  headline:
    fontFamily: "Source Serif 4, serif"
    fontSize: "24sp"
    fontWeight: 400
    lineHeight: 1.2
  lede:
    fontFamily: "Source Serif 4, serif"
    fontSize: "16sp"
    fontWeight: 400
    lineHeight: 1.2
  button-hero:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "17sp"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  title:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "16sp"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  button:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "14sp"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "14sp"
    fontWeight: 400
    lineHeight: 1.2
  label:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "12sp"
    fontWeight: 600
    lineHeight: 1.2
  support:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "12sp"
    fontWeight: 400
    lineHeight: 1.2
  eyebrow:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "11sp"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  xs: "3dp"
  sm: "10dp"
  md: "12dp"
  lg: "14dp"
  xl: "16dp"
  shell: "24dp"
  sheet: "28dp"
  tile: "23%"
  full: "50%"
spacing:
  hairline-gap: "2dp"
  xs: "4dp"
  board-gap: "5dp"
  sm: "8dp"
  md: "12dp"
  stack: "14dp"
  gutter: "16dp"
  sheet: "24dp"
components:
  button-menu:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foam}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "10dp"
    height: "48dp"
  button-menu-hero:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foam}"
    typography: "{typography.button-hero}"
    rounded: "{rounded.lg}"
    padding: "10dp"
    height: "64dp"
  button-primary:
    backgroundColor: "{colors.sea-glass}"
    textColor: "{colors.pool-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "10dp"
    height: "48dp"
  button-round:
    backgroundColor: "{colors.deep-pool}"
    textColor: "{colors.foam}"
    rounded: "{rounded.full}"
    size: "48dp"
  tab:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foam}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "48dp"
  tab-selected:
    backgroundColor: "{colors.sea-glass}"
    textColor: "{colors.pool-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "48dp"
  cube:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foam}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "6dp"
  card-world:
    backgroundColor: "{colors.deep-pool}"
    textColor: "{colors.foam}"
    typography: "{typography.title}"
    rounded: "{rounded.xl}"
    padding: "0 18dp 0 22dp"
    height: "64dp"
  card-achievement:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foam}"
    rounded: "{rounded.xl}"
    padding: "14dp"
  card-achievement-earned:
    backgroundColor: "{colors.pool-lit}"
    textColor: "{colors.foam}"
    rounded: "{rounded.xl}"
    padding: "14dp"
  level-cell:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foam}"
    rounded: "{rounded.md}"
    padding: "6dp"
  level-cell-solved:
    backgroundColor: "{colors.pool-lit}"
    textColor: "{colors.foam}"
    rounded: "{rounded.md}"
    padding: "6dp"
  step-chip:
    backgroundColor: "{colors.deep-pool}"
    textColor: "{colors.foam}"
    rounded: "{rounded.xl}"
    height: "56dp"
  step-chip-on:
    backgroundColor: "{colors.sea-glass}"
    textColor: "{colors.pool-ink}"
    rounded: "{rounded.xl}"
    height: "56dp"
  board-shell:
    backgroundColor: "{colors.shell-center}"
    rounded: "{rounded.shell}"
  overlay-sheet:
    backgroundColor: "{colors.deep-pool}"
    textColor: "{colors.foam}"
    rounded: "{rounded.sheet}"
    padding: "24dp"
    width: "420dp"
---

# Design System: INSIGHT

## Overview

**Creative North Star: "The Tide Pool"**

INSIGHT is a pool of still teal water at dusk. The board is the pool's floor. The tiles are polished stones: the only solid, weighted objects in the world. You lift one, it rises toward you with a faint halo, and you set it down somewhere else. Everything around the stones is water and glass: translucent panels, hairline edges, and two slow lights that drift across the background over 42 and 57 seconds. When you move a stone, the water takes on its colour. The last tile you moved tints the ambient light, crossfading over 1.6 seconds.

Density is low and deliberate. A screen holds one idea: a menu column, a list of worlds, a grid of levels, or one board with its target. Serif type marks the moments worth pausing on, such as titles, level names and "Beautifully solved." A quiet sans carries everything you act on. Colour stays muted and sea-washed. The six tile hues are the only saturated objects on screen, and they never compete with the interface for attention, because the interface has almost no colour of its own.

This system rejects casual-game loudness: no candy saturation, bouncing cartoon chrome, coin counters or reward pop-ups that shout. It rejects stock Material: no default purple, filled-tonal buttons or app bars. It rejects pure black, sharp corners and hard black shadows on panels. It also rejects pressure: no timers, no countdowns, no red failure states, no score-shaming. A wrong move gets a soft coral ring, never an alarm.

**Key Characteristics:**
- Dark mode is the default; light mode is a full counterpart, not an afterthought.
- Translucent glass panels over a living gradient backdrop; only tiles cast shadows.
- One accent (sea-glass mint) used for the single primary action, the selected state and earned rewards.
- Each tile's symbol shows how it moves; colour is never the only signal.
- Motion is slow and ambient by default, fast and precise in response to touch, and frozen when the system turns animations off.
- Portrait only, edge-to-edge, inside the safe-drawing insets.

## Colors

A sea-washed teal palette in which the interface is nearly colourless glass and the six tile hues provide the colour.

### Primary
- **Sea-Glass Mint** (`sea-glass`): the one accent in dark mode. Fills the primary button (Resume, Next →), the selected tab, the active creator step, earned-badge marks and progress fills. It also borders the current level cell and earned achievement cards, and colours the wordmark. Text on it is **Pool Ink** (`pool-ink`).
- **Deep Kelp** (`kelp`): the same role in light mode, with **Shell White** (`shell-white`) as the text on it.

### Tile Hues (the reason the palette exists)
Each tile has three values: a *light → deep* body gradient (145°, light top-left) and a *flat* variant. The flat variant is used for target previews, the ink stroke a move leaves on the board, the solved glow and the win sparks. The code keys tiles by letter; their accessible names are the plain colour words in brackets.
- **Coral** (`tile-coral` → `tile-coral-deep`, flat `tile-coral-flat`) [R, "Red"]: vertical arrows. Coral also serves as the rejection ring.
- **Lagoon** (`tile-lagoon` → `tile-lagoon-deep`, flat `tile-lagoon-flat`) [B, "Blue"]: horizontal arrows.
- **Sea Lettuce** (`tile-sea-lettuce` → `tile-sea-lettuce-deep`, flat `tile-sea-lettuce-flat`) [G, "Green"]: rising diagonal.
- **Sand** (`tile-sand` → `tile-sand-deep`, flat `tile-sand-flat`) [Y, "Yellow"]: falling diagonal.
- **Anemone** (`tile-anemone` → `tile-anemone-deep`, flat `tile-anemone-flat`) [P, "Purple"]: four arms, each ending in two chevrons: it jumps two cells.
- **Pearl** (`tile-pearl` → `tile-pearl-deep`, flat `tile-pearl-flat`) [W, "White"]: a ring with four ticks; it never moves itself and is only carried by a swap. It is the only tile whose symbol is dark, drawn in **Pearl Ink** (`pearl-ink`). Every other symbol is white.

World cards cycle through an extended set of 11 stripe pairs. The first five reuse the tile hues, followed by teal (#8FD9C9 → #2F8A80), apricot (#F0B48C → #B8663F), periwinkle (#A4B4EC → #4A5AA8), moss (#C5D98F → #7A9440), orchid (#E8A3CF → #A8508A) and pearl.

### Neutral
- **Foam** (`foam`) / **Tidewater** (`tidewater`): primary text and icon stroke, dark / light.
- **Lichen** (`lichen`) / **Wet Slate** (`wet-slate`): secondary text, subtitles, counts, eyebrows, unchecked controls.
- **Hairline** (`hairline`) / (`hairline-light`): every 1dp panel border, the inactive slider track, the empty progress bar and the board's concentric rings.
- **Glass** (`glass`) / (`glass-light`): translucent fill for menu buttons, tabs, cubes, level cells and achievement cards. The backdrop must show through it.
- **Deep Pool** (`deep-pool`) / **Shallows** (`shallows`): the one opaque surface, used for round buttons, world cards, creator steps and the overlay sheet.
- **Pool Lit** (`pool-lit`) / **Shallows Lit** (`shallows-lit`): Deep Pool mixed 14% toward the accent, for solved level cells and earned achievement cards.
- **Abyss** (`abyss`): the window background before Compose draws, and the launcher icon ground.
- **Scrim** (`scrim`): the 60% dim layer under overlays.

### Backdrops
The backdrop is a 165° three-stop base with two radial glows (top-left at 65% and bottom-right at 60% of the long edge). **Forest** is the default (`backdrop-forest-*`). Mist and Aurora are earned cosmetics:

| Backdrop | Glows (dark) | Base (dark) | Glows (light) | Base (light) |
|---|---|---|---|---|
| Forest | #234958, #1E4843 | #142B41, #0C252E, #182F35 | #E7EEE2, #BFD9D5 | #C5D6DF, #D9E9DC, #BBD2C5 |
| Mist | #254F6D, #165954 | #122C48, #102B38, #173D42 | #DFEDF6, #ACDCD5 | #B9D8EA, #D8EAF0, #B8DAD5 |
| Aurora | #2F3E76, #543669 | #152C4A, #202A48, #352A48 | #D6E5FF, #D8C4ED | #C6D8EE, #E0E5F2, #D1C8E4 |

### Named Rules
**The Stones Carry the Colour Rule.** Saturated colour belongs to tiles and only tiles. Interface chrome is glass, hairline and one mint accent. If a new screen needs a second accent, it doesn't.

**The One Mint Rule.** On any screen, Sea-Glass Mint fills at most one action: the thing you'd most likely press next. Selected tabs and earned states may use it too, but two primary buttons side by side is a bug.

**The Two Modes Rule.** Every colour is defined in pairs (dark / light) in `Palette`. Never hard-code a colour in a screen that only works in one mode. The current exceptions are the scrim, the cosmetic previews and the tile art, which are mode-independent by design.

## Typography

**Display / Headline Font:** Source Serif 4 (fallback: system serif)
**Body / Label Font:** Source Sans 3 (fallback: system sans-serif)

**Character:** A literary serif for the moments the player pauses on, and a humanist sans for everything they touch. The serif is always regular weight (400); it never shouts in bold. The sans does the work at 600.

Both fonts are bundled as static TTFs in `res/font/` (Sans 400/600/700, Serif 400 only), with their OFL licences in `assets/licenses/`. `Label` is the single entry point: its `serif` flag picks the family. Add a weight file before using a weight that isn't bundled, or Android will synthesize it. The web game uses Inter / Georgia, which is a separate decision.

### Hierarchy
- **Wordmark** (600, 29sp, 0.3em tracking, Sea-Glass Mint): "INSIGHT" on the home screen only.
- **Display** (serif 400, 30sp): the win title, "Beautifully solved."
- **Headline** (serif 400, 24sp): page titles, the level name on the board, the overlay title, the creator title.
- **Lede** (serif 400, 16sp, Lichen): the home tagline.
- **Button Hero** (600, 17sp, 0.05em): the 64dp home and online menu buttons.
- **Title** (600, 16sp, 0.04em): world-card names. Achievement names are 15sp in the same style.
- **Button** (600, 14sp, 0.05em): standard menu buttons.
- **Body** (400, 14sp): checkbox labels and plain statements.
- **Label** (600, 12sp): tab labels, counts, status ("Complete"). It drops to 11sp, the floor, for level numbers and names, cube labels and progress counts. Nothing is set below 11sp.
- **Support** (400, 12sp, Lichen): subtitles, hints and explanatory notes under controls.
- **Eyebrow** (700, 11sp, 0.16em, UPPERCASE, Lichen): context above a title, such as "WORLD 2 · LEVEL 014", "TARGET", "GRID SOLVED" and "EARNED".

Line height is 1.2× everywhere because `Label` sets it. That is tight but acceptable for the one- and two-line strings the app uses. Raise it to 1.4× before adding paragraph text.

### Named Rules
**The Two Voices Rule.** Serif marks a moment and sans marks an action. A button is never serif, and a page title is never sans.

**The Quiet Serif Rule.** Serif text is always weight 400. Emphasis comes from size and space, never weight.

## Layout

Portrait only (`screenOrientation="portrait"`), edge-to-edge, with transparent system bars whose icon colour follows dark/light mode. Every screen pads by `WindowInsets.safeDrawing`, then applies a 16dp gutter. Content is a single centred column capped to a width that suits its job:

| Surface | Max width |
|---|---|
| Home | 360dp (and max 760dp tall) |
| Online, overlay sheet | 420dp |
| Worlds | 460dp |
| Options | 520dp |
| Creator | 560dp |
| Default `Page` (Levels, Achievements) | 640dp |

**Page anatomy.** A 48dp round Back button, 14dp gap, then the serif title over a 12sp Lichen subtitle, then 16dp to content.

**Home.** Wordmark, then the tagline (8dp below), then the tilted 3×3 hero (20dp below). A primary **Continue** button ("Level 042 · name") leads the column once the player has any progress; below it sit Single player, Online and Options (64dp, 14dp apart). Three square cubes run along the bottom with 10dp gaps. On phones shorter than about 640dp the hero shrinks to 96dp and the buttons to 56dp so nothing touches. Features that are not built (Log In, What's Next, Online → Play, the creator's Make) are dimmed and say "Soon" or "Coming soon"; they are never drawn as live controls.

**Game board.** The corner round buttons (Menu top-left, Restart top-right) float at 12dp / 10dp. Content starts 60dp down to clear them: eyebrow, serif level name, a "TARGET" eyebrow, the target card, then the board shell filling the remaining height. The target card scales with the grid (30dp cells for a 2×2, down to 20dp for 5×5) on the same deep pool as the board. When a level is solved the result strip grows in under the board and the board shrinks to make room, so the solved arrangement stays visible. On windows 600dp wide or more the play area stays centred at 720dp max and cells grow to 120dp; below that the cap is 88dp. Board cells are `min(cap, fit)` with 32dp of internal padding and a 5dp gap. The *occupied* area is centred, not the full grid, so holes along one side never push the puzzle off centre.

**Level grid.** Five columns with 7dp gaps on both axes. Every cell is 1:2 (width:height) in every world, so a six-level world never stretches; the grid scrolls when large text needs the room. Cell captions stop growing at 1.15× font scale and end in an ellipsis, since the full name is in the game and in TalkBack.

**Spacing rhythm.** 4 / 8 / 12 / 14 / 16 / 24dp, with 14dp as the signature vertical stack gap. Lists use 10–12dp between cards.

## Elevation & Depth

Tiles are the only solid objects. Every other surface is flat and translucent, and gets its sense of depth from the glowing backdrop behind it plus a 1dp hairline border. No panel, card or button casts a shadow.

### Shadow Vocabulary
- **Tile contact shadow** (`tile-shadow`: the tile's own rounded rect, offset down by 6% of the cell, no blur): sets each stone on the pool floor. It is tinted deep navy, never black.
- **Selection halo** (Foam at 35% in both modes, inflated 8% with 30% corners, plus a 5px Foam ring): the lifted stone. It pairs with a 5dp rise and 3.5% scale.
- **Solved glow** (the tile's flat hue at 50% as the halo): every tile during the solved bloom.
- **World glow** (the world's light stripe colour at 25–45%, pulsing over 3.2s, inflating 8–16dp): completed world cards only.
- **Board rings** (three concentric hairline circles at 39% of the shell width, +35dp, +70dp, fading 40% → 18% → 10%): the faint ripple on the board floor.

### Named Rules
**The Only Stones Cast Shadows Rule.** If it isn't a tile, it doesn't get a shadow. Lift panels with glass and hairline, never with elevation.

**The Lift Means Selected Rule.** A tile rises only when it is selected (5dp) or dragged (4.5% scale, following the finger). Resting tiles never animate their height.

## Shapes

The form language is pebble-smooth: nothing is sharp-cornered.

- **Tiles** have corners at 23% of the cell size: a soft square, close to a squircle. Every tile also has a 1.5px `tile-edge` rim and a top-left white sheen. The two cosmetic finishes change the sheen: *frosted* is brighter and milkier, and *metal* adds banded highlights and a brushed line texture.
- **Panels** step up in radius with size: 10dp (cosmetic swatches), 12dp (level cells, badge marks), 14dp (buttons, tabs, cubes), 16dp (world cards, achievement rows, creator steps), 24dp (board shell), 28dp (overlay sheet).
- **Circles** are reserved for the 48dp round buttons and the creator's resize handle.
- **Icons** are hand-drawn line art on a 24-unit grid: 1.7–2-unit strokes, round caps and joins, one colour (Foam / Tidewater). There is no icon font or library.
- **Tile symbols** are line art on a 48-unit grid: 4.2-unit strokes (3.4 for Anemone, 3.6 for Pearl), drawn at 44% of the tile on the board and 80% in target minis. Anemone's two chevrons per arm are drawn at 3.1 units. White strokes on the pastel bodies sit on a dark halo stroke (`#0E2A3A` at about 52%, 2.4 units wider, 0.5 units lower) so the rule stays legible; Pearl and the target minis, which use dark ink, get no halo.

### Named Rules
**The Symbol Is the Rule Rule.** A tile's symbol shows how that tile moves. Never decorate a tile with a mark that doesn't encode movement, and never ship a tile that is distinguished by colour alone.

## Components

### Buttons
Smooth pebbles: generously rounded, quiet translucent fill, hairline edge.
- **Shape:** gently rounded (14dp), full-width in their column, minimum 48dp tall (64dp on Home and Online).
- **Menu (default):** Glass fill, Hairline border, Foam text in the Button style, centred.
- **Primary:** Sea-Glass Mint fill and border, Pool Ink text. Limit one per screen.
- **Disabled:** the whole button at 40% opacity, with the disabled semantic and no click handler. Never a grey fill.
- **Pressed:** the default Compose ripple, clipped to the shape.
- **Round (Back, Menu, Restart):** a 48dp Deep Pool circle with a Hairline border and a 20dp line icon in Foam.

### Tabs
- **Style:** an equal-width segmented row with 8dp gaps. Each segment is a 48dp-tall 14dp-radius pebble with Glass fill and Hairline border.
- **Selected:** Sea-Glass Mint fill and Pool Ink label. No underline or indicator bar.

### Cards / Containers
- **World card:** 64dp tall, 16dp radius, Deep Pool washed 24% toward the world's light stripe colour on the left. A 6dp vertical gradient stripe sits inside the leading edge. Completed worlds get a full-colour border and the pulsing world glow. Locked worlds are at 50% opacity.
- **Achievement row:** 16dp radius, 14dp padding. Contents: a 44dp badge mark (12dp radius, Mint when earned, Hairline when locked), an eyebrow, the name, the requirement in Support, a 6dp progress bar, and "Unlocks …" in Mint. Earned rows use Pool Lit with a Mint border. All badges are one scrolling list. Marks are drawn line art (world badges show their number), never Unicode glyphs.
- **Level cell:** 12dp radius with 6dp padding. Contents: the zero-padded number ("014"), a target mini in the middle, the name (two lines max) and the status. Solved cells use Pool Lit. The current level gets a 2dp Mint border. Locked cells are at 40% opacity.
- **Cube (home footer):** a square 14dp-radius Glass pebble with a 26dp line icon over an 11sp label.

### Inputs / Controls
On/off settings are **switch rows**: a 56dp Glass pebble with the label on the left and a recoloured Material `Switch` on the right (Mint track and Pool Ink thumb when on; a Lichen outline when off). The whole row toggles, and it reads as a switch to TalkBack. A button that says "ON" is not used for state. Volume is a recoloured `Slider` with a round 24dp Mint thumb, a Mint active track, a muted inactive track and no end-stop dot.

### Overlay Sheet (pause)
A Scrim covers the screen, and tapping it dismisses the overlay (the scrim is hidden from TalkBack; Back closes it). On top sits a Deep Pool sheet (28dp radius, 24dp padding, max 420dp wide, Hairline border) that announces its title, holding a centred stack: serif title, a Support line ("World 10 · Level 181 · Cloister"), then pebble buttons with 8dp gaps.

### Result Strip (solved)
A 24dp-radius Deep Pool card docked under the board, with no scrim. It holds the "GRID SOLVED" eyebrow, the serif line "Beautifully solved.", an inset Glass card for any earned badges (with a 48dp "View collection →" button) and a Replay / Next pair (on the final level: Replay / Choose level). The solved board above it stays lit.

### Restart Undo
Restart throws away the attempt, so a pebble ("Restarted · Undo", 48dp tall) appears beside the Restart button for six seconds and restores the exact position. It is not offered after a solve (that is a deliberate replay).

### The Board (signature component)
A 24dp-radius shell filled with a radial gradient (`shell-center` → `shell-edge` in dark mode; `shell-light` → `shell-light-edge` in light mode, where the board is a deeper pool so the pale tiles keep their edges), with a Hairline border and the three concentric rings. Inside it, tiles live on a 5dp-gap grid.
- **Tap a tile:** it lifts (5dp, 3.5% scale, selection halo), ticks and plays its pitched note. Tap a legal cell to swap. Tapping another stone that can move itself switches the selection; a stone with no move (Pearl, or one boxed in) does not lift and gets the rejection ring.
- **Drag a tile:** past an 8dp slop the tile follows the finger at 4.5% scale. The hovered legal cell brightens with a 10% white wash.
- **Move:** both tiles slide over 185ms. A soft ink bloom of the moved tile's flat hue spreads between the two cells over 1200ms; up to three can overlap. The backdrop's ambient light retints to that hue.
- **Arrival:** a tile landing in its target position flashes an Arrival Foam ring for 420ms.
- **Rejection:** an illegal move draws a Coral ring (`#FFB4A8`, 240ms), plays the deny sound and gives a short reject buzz. There is no shake, no red and no message.
- **Hover while dragging:** the cell under the finger gets a 10% white wash whether or not the move is legal, so the highlight is never a hint.
- **Solved bloom:** each tile swells 3.5% in turn, staggered 16ms per (row + column) diagonal over about 900ms, and takes on its solved glow. 24 coloured sparks then arc from the board centre over 1.4s.
- **Accessibility:** one node per tile, focusable by D-pad and keyboard (Enter or Space acts), for example "Purple, row 2, column 1, can move down two cells or right two cells, target: Red". Each node reports selected, and a polite live region announces swaps, refusals and the solve. Menu and Restart are read first.
- **Haptics:** a tick on selection, a soft click on landing, a reject buzz on refusal and a confirm when the grid is solved. They follow the system touch-feedback setting.

### Target Mini
Flat-hue rounded squares (25% corners) with Target Ink symbols at 80%. Symbols are dropped below 9px cells, and holes stay empty. It is used on the target card above the board (20–30dp cells), in level cells (up to 18dp, fitted to the cell) and in the creator (16dp).

### Home Hero
A 125dp 3×3 of tiles rotated −9°, with the outer columns floating ±4dp out of phase over 7s. It uses the player's equipped tile finish, so a new finish appears on the home screen.

## Do's and Don'ts

### Do:
- **Do** wrap every screen in `Backdrop` and let it show through Glass surfaces; that translucency is the depth system.
- **Do** keep Sea-Glass Mint to one primary action per screen plus selected and earned states (The One Mint Rule).
- **Do** give every tile both its hue and its movement symbol, and give every board element a TalkBack node with the same tap behaviour.
- **Do** read `LocalReduceMotion` in every infinite or decorative animation and freeze it at its midpoint. Skip the win burst entirely when it is set.
- **Do** time responses by role: touch feedback 185–420ms, celebration 0.9–1.4s, ambient drift 7–57s.
- **Do** pad by `WindowInsets.safeDrawing` and match system-bar icon colour to the active mode.
- **Do** define every new colour as a dark/light pair in `Palette`.
- **Do** make touch targets at least 48dp. Round buttons, tabs, switch rows, menu buttons and the undo pebble all meet this.
- **Do** mark unbuilt features as "Soon" / "Coming soon", dimmed and announced as such.
- **Do** keep every piece of text at 11sp or larger.

### Don't:
- **Don't** use casual-game loudness: no candy saturation, bouncy cartoon UI, coin counters or flashing reward pop-ups.
- **Don't** ship stock Material: no default M3 colour scheme, filled-tonal buttons, FABs or top app bars. Any Material component must be recoloured from `Palette`, as the Slider and Checkbox are.
- **Don't** use pure black (#000000) anywhere, sharp-cornered panels, or black drop shadows on any surface.
- **Don't** put a shadow on anything that isn't a tile (The Only Stones Cast Shadows Rule).
- **Don't** add pressure: no timers, countdowns, move limits shown as threats, red error states or score-shaming. A wrong move is a 240ms Coral ring and nothing more.
- **Don't** use bold or semibold serif. Serif is weight 400 only (The Quiet Serif Rule).
- **Don't** introduce a second accent colour for interface chrome; colour belongs to the stones.
