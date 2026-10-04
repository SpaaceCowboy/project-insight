# Game Improvement Checklist

## Gameplay rollback — 2026-10-04

- [x] Remove switches, gates, rotation cells, fixed authored budgets, and their editor tools. Restore original directional rules and 3–6 Tile Limits.
- [x] Preserve all 106 positions, names, targets, and shapes, without changing any Start or Target. Levels 35 and 99 use newly verified routes within the allowance cap.
- [x] Refresh optimal par and route certificates; preserve campaign progress, preferences, achievements, and custom storage.
- [ ] Human assessment of difficulty and campaign pacing remains outstanding.

## Latest improvements — Completed on 2026-10-03

- [x] Replace browser alerts and confirmations with consistent in-game dialogs and notices. New Game, resetting stars, deleting a draft, cropping, and clearing use styled confirmations. Success, warning, and error notices appear in the game and editor; temporary-storage warnings persist. Cancellation, focus trapping, and safe focus return are verified.
- [x] Separate home, pause, and settings into a proper menu system. Home holds campaign choices, Pause holds current-puzzle actions, and Settings has Play, Sound, and Appearance tabs. Nested panels return to their parent; continuing, changing levels, and restarting enter gameplay. All five viewport sizes fit one screen.
- [x] Move the game and editor to React with Vite, preserving shared rules, the 106 level positions, saved preferences, and custom-puzzle isolation.
- [x] Add shared campaign progression, New Game, and Developer Mode. A successful frontier solve unlocks the next level; Developer Mode opens all levels while excluding new achievement credit.
- [x] Add 15 permanent achievements, background themes, tile finishes, a collection panel, and queued corner announcements. New Game preserves lifetime rewards.

No unchecked implementation items remain. Human difficulty and sound-balance assessment are ongoing playtesting work.

Implementation and verification completed on 2026-10-01. Later user instructions take precedence: gameplay fits one screen, and tutorials, help dialogs, explanations, and legal-destination hints are removed.

## Correctness — Completed

- [x] Cancel pending move and win timers when restarting, switching levels, or undoing. Guard delayed callbacks against stale board state; completion dialogs cannot interrupt a newly opened menu.
- [x] Initialize preference keys before reading saved mode/theme values. Verify both preferences survive reload.
- [x] Normalize level 26 to three-column rows in both its starting board and target.
- [x] Cancel pointer gestures without committing moves on pointer cancellation or lost pointer capture.
- [x] Validate all 100 levels: rectangular dimensions, supported tile codes, matching tile counts, fixed gap positions, legal solutions, and optimal par values. Every par equals the shortest solution length.
- [x] Handle unavailable browser storage without interrupting gameplay; validate loaded star records.

## Content & Gameplay — Completed or Superseded

Tutorial descriptions, introductory explanations, and the explanation of passenger swaps were implemented, then removed at the user's explicit request for no tutorial or player help.

- [x] Correct misleading black-wall references and descriptions that promised absent mechanics. Only six tile types and missing cells remain in the rules.
- [x] Rename world three to **Routing Challenges**. World two emphasizes shaped space; world three presents routing practice. They intentionally share core rules; no new wall mechanic was introduced.
- [x] Assess progression using independently solved routes and complete automated browser playthroughs, rather than trusting stored solution lengths. See the assessment below.
- [x] Add undo, including after completing a puzzle. Undo restores the board and move count while preserving earned best stars.

## Accessibility & Layout — Completed

- [x] Support keyboard selection and movement using native tile buttons: Tab/arrows for focus, Enter/Space for selection and destination, Escape to cancel. R restarts, U undoes, L opens levels.
- [x] Label tiles with type and position, and provide an accessible target arrangement and move announcements. Movement-rule explanations were removed with the tutorial at the user's request.
- [x] Add dialog semantics, focus trapping, inactive background controls, and focus return on close. World tabs support arrow-key navigation.
- [x] Allow browser zoom. Respect reduced-motion preferences for swaps and decorative animations.
- [x] Fit the target, board, controls, and level picker without scrolling. Show 25 levels per world with four tabs. Verify 320×568, 375×667, 1280×720, and 844×390 viewports.
- [x] Remove tutorial/help UI and legal-destination markers. Retain selection and drag feedback.

## Maintainability — Completed

- [x] Separate `Puzzle.html`, `styles.css`, `levels.js`, and `game.js`. Format level data, CSS, and complex control/rendering functions for review.
- [x] Remove unused extra mechanics, icons, metadata, and styles: portals, magnets, switches, dominoes, and other unused tile families.
- [x] Keep the original plain JavaScript controllers and shared rules. The later user-requested React/Vite migration supersedes the original no-framework requirement.
- [x] Leave runnable Node checks and update `AGENTS.md` to match the structure and test commands.

## Verification & Progression Assessment

`node check-levels.cjs` exhaustively solves the current puzzles and replays each solution against the game's actual rules. `level-checks.json` stores the shortest routes. `node check-browser.cjs` plays all 100 routes through keyboard controls and checks drag/cancel, undo, timer races, saved progress, preferences, blocked storage, focus management, and screen fit. The browser check uses an existing Playwright installation and Chrome; no dependency was added to the game.

| World | Shortest route range | Average moves |
| --- | --- | --- |
| Foundations | 1–8 | 4.72 |
| Shaped Space | 1–19 | 6.08 |
| Routing Challenges | 1–15 | 7.16 |
| Convergence | 1–21 | 8.12 |

Average route length increases by world, but individual levels are not a smooth difficulty ramp: level 50 takes 19 moves, level 51 takes one, level 90 takes 21, and level 98 takes two. Short levels can serve as breaks. Existing level positions were preserved so saved progress remains valid. Route length and automated playthroughs establish correctness, not perceived human difficulty; player testing is still needed before claiming the difficulty is balanced.

## Preserved

The asymmetric swapping rule, six core tile types, directional icons, animation, audio, particles, Zen mode, star scoring, and existing storage keys are retained. Legal destination markers were removed at the user's request for no player help. Unrestricted level access is now available through Developer Mode; ordinary campaign play advances level by level.

## Ideas — Completed

The original improvement report above covered 100 levels. The later idea work adds persistent random tile allowances, a louder cozy sound pack with saved volume control, color-only moving lights, and six complex maps in a fifth world. There are now 106 levels. The browser check covers all 106 in both classic and limited modes, including the new audio and budget behavior. See `idea.md` for the implementation report. Gameplay still has no tutorial or destination hints and fits one screen.
