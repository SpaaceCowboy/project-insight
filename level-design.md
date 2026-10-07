# INSIGHT Level Design

This file covers the sources Game 2's design draws on, the rules each one supports, and an audit of the 100 Game 2 levels against the measurable findings. Run the audit with `node scripts/check-levels.cjs --game 2 --audit`. It is read-only and changes no level data.

## Sources

### Research on puzzle difficulty and progression

| Source | What it shows | How it applies to INSIGHT |
| --- | --- | --- |
| van Kreveld, Löffler & Mutser, [Automated Puzzle Difficulty Estimation](https://ics-websites.science.uu.nl/docs/vakken/mscip/assignments/CIG2015-AutomatedPuzzleDifficultyEstimation.pdf), IEEE CIG 2015 | 57 players rated levels of *Move* (move coloured balls onto their matching goals). **Counterintuitive moves**, meaning moves in the shortest solution that take a ball further from its goal, predicted player-rated difficulty best. Level size had only a small effect. A linear model fitted to player ratings came within about 1 point on a 1–10 scale. | *Move* is the closest published game to INSIGHT. The audit counts counterintuitive moves (`ci`). |
| Pelánek & Jarušek, [What Determines Difficulty of Transport Puzzles?](https://www.ics.muni.cz/en/research/publications/941424), FLAIRS 2011; Jarušek & Pelánek, [Difficulty Rating of Sokoban Puzzle](https://www.ics.muni.cz/en/research/publications/890650), STAIRS 2010 | Across Sokoban, Rush Hour and the swap-based Replacement puzzle, difficulty comes mainly from the **structure of the state space**. Solution length and state-space size do not capture it. | Par alone is not a difficulty measure. The audit counts how many opening moves stay optimal (`choices`). |
| Butler, Smith, Liu & Popović, [A Mixed-Initiative Tool for Designing Level Progressions in Games](https://grail.cs.washington.edu/wp-content/uploads/2015/08/butler2013amt.pdf), UIST 2013 | A campaign is a **progression plan** with four constraints: prerequisites (A first appears before B), corequisites, concepts per level, and how fast new concepts arrive. A concept counts only if it is required by **every** solution. The paper builds on Dan Cook's skill atoms. | The audit records each tile's first appearance (`new`) and whether every solution requires each focus tile (`focus`). |
| Smith, Butler & Popović, *Quantifying over Play: Constraining Undesirable Solutions in Puzzle Design*, FDG 2013 | How to rule out shortcut solutions that skip the intended concept. | This is the basis for the `focus` check. |
| Kartal, Sohre & Guy, [Data-Driven Sokoban Puzzle Generation with Monte Carlo Tree Search](https://ojs.aaai.org/index.php/AIIDE/article/view/12859), AIIDE 2016; Taylor & Parberry, [Procedural Generation of Sokoban Levels](https://ianparberry.com/pubs/GAMEON-NA_METH_03.pdf), 2011 | A generator searches for puzzles, scores them on features that player studies link to difficulty, and is then checked against players. | `make-game2.cjs` uses the same method: reverse-scramble from the target, solve, score. |

### Designers on their own practice

| Source | Takeaway |
| --- | --- |
| Jesse Schell, *The Art of Game Design: A Book of Lenses*, [Lens of the Puzzle](https://schellgames.com/blog/lens-of-the-month-puzzle) | Ten principles: make the goal easily understood; make it easy to get started; give a sense of progress; give a sense of solvability; increase difficulty gradually; let parallel problems give rest; use a pyramid structure; hints extend interest; give the answer; treat perceptual shifts with care. |
| Koichi Hayashida, kishōtenketsu in Super Mario 3D Land/World ([summary](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps)) | Each mechanic is **introduced, developed, twisted, then concluded**. |
| Mark Brown, [What Makes a Good Puzzle?](https://amara.org/v/C3BEg/), Game Maker's Toolkit, 2018; *How Baba Is You Makes Brain-Busting Puzzles* | A good puzzle has **a catch**: an apparent contradiction that a false assumption hides. The "aha" is seeing past it. Designers often work backwards from that insight. |
| Patrick Traynor, [System-Centric Puzzle Design in Patrick's Parabox](https://schedule.gdconf.com/session/system-centric-puzzle-design-in-patricks-parabox/899968), GDC 2024; Matt Rix, [Level Design Case Studies: Trainyard](https://gdcvault.com/play/1015343/Level-Design-Case-Studies-Trainyard); Zach Barth, [SpaceChem Postmortem](https://gdcvault.com/play/1017983/Ahead-of-the-Curve-The) | Practical advice on iterating mechanics, curating levels and playtesting, including a caution about difficulty spikes. |
| Jonathan Blow, [Truth in Game Design](https://www.gamedeveloper.com/design/video-jon-blow-on-the-truth-in-game-design-), GDC Europe 2011; Scott Kim, [MIT CMS.608 puzzle lecture](https://ocw.mit.edu/courses/cms-608-game-design-fall-2010/resources/mitcms_608f10lec18_mp4) | Find puzzles by exploring the rule system. A puzzle "is fun to solve and has a right answer". |

## Rules Game 2 follows

- **Introduce one mover per world, then combine** (kishōtenketsu, Butler prerequisites). The audit confirms the first appearances: R at level 1, B at 3, G at 21, Y at 23, P at 41.
- **Teaching levels are greedy-solvable.** Every teaching and breather level has 0 counterintuitive moves (Schell: easy to get started).
- **Breathers after peaks** (Schell: parallelism lets the player rest; sawtooth pacing).
- **Generated, then verified by the solver** (Taylor & Parberry; Kartal et al.). Every level has a verified optimal route and fits Tile Limits.

## Audit of Game 2 (2026-10-07)

**Columns:**
- `ci`: moves on the optimal route that increase the number of misplaced tiles. This adapts van Kreveld's "distance to goal" for tiles of the same colour.
- `choices`: optimal opening moves out of all legal opening moves.
- `focus`: `all` if the board cannot be solved without that tile's moves, `longer` if a solution exists without it but is longer than par, `no` if it can be skipped at no cost, `?` if the search limit was reached.

**Before and after the scoring change**, where *before* is the first generation and *after* is scoring 2:

| World | Mean `ci` before → after | Levels with `ci` > 0 | Boss `ci` |
| --- | --- | --- | --- |
| 1 Straight Lines | 0.50 → 0.60 | 7 → 9 of 20 | 2 → 2 |
| 2 Slanted Light | 0.55 → 1.00 | 7 → 12 | 0 → 2 |
| 3 Long Jumps | 0.40 → 0.60 | 6 → 9 | 1 → 2 |
| 4 Mosaics | 0.90 → 1.35 | 13 → 16 | 1 → 2 |
| 5 Masterworks | 0.75 → 1.50 | 10 → 16 | 1 → 3 |

**Overall results:**
- **More levels have a catch.** 62 of 100 levels now need at least one counterintuitive move, up from 43, and every boss needs at least 2.
- **The curve now rises in difficulty, not just length.** Mean `ci` climbs from Worlds 3 to 5 instead of staying flat.
- **52 boards changed**, and each changed board went to revision 2. Teaching and breather levels are unchanged and still have no counterintuitive moves.
- **Fewer focus tiles can be skipped.** In the 74 test, twist and boss levels, only 8 of 235 focus-tile checks can be skipped at no cost. The rest are needed by every solution, or skipping them costs extra moves.

## Generator rules (scoring 2, `scripts/make-game2.cjs`)

- **Teaching and breather levels:** take the cleanest route, with `ci = 0`, and every focus tile must be needed.
- **Minimums for harder levels:**

  | Mood | Counterintuitive moves | Made by a focus tile | Optimal opening moves |
  | --- | --- | --- | --- |
  | Test | at least 1 | — | at most 50% |
  | Twist | at least 2 | at least 1 | at most 50% |
  | Boss | at least 3 | at least 1 | at most 50% |

- **Candidate ranking:** more counterintuitive moves first, then more focus tiles needed by every solution, then length.
- **Relaxation:** when a target can't meet its minimums, each relaxation step widens the par band by 1, lowers the `ci` minimum by 1, drops the focus-tile minimum, and allows 10 points more optimal openings. The log shows every relaxed slot.
- **No regression:** a relaxed pick that is worse than the slot's previous board (fewer `ci`, or equal `ci` and shorter) keeps the previous board.
- **Shared measurements:** the generator and the audit both use `scripts/level-metrics.cjs`.

## Open issues

1. **12 test or twist levels still have `ci = 0`, even after relaxing.** They are 10, 14, 19, 25, 38, 45, 46, 47, 52, 53, 61 and 95. Most are small single-mover targets, such as *Around the Stone* (Red only, with a White cross), where no counterintuitive move exists. The fix is to redesign these targets with bigger boards, gaps or a second mover. Scoring can't add a catch the target doesn't allow.
2. **`ci` is measured on the one optimal route the solver returns.** Another optimal route could avoid the catch. Requiring the minimum over all optimal routes would be stricter.
3. **No player data has been collected yet.** Run the Game 2 difficulty-rating session in `playtest.md` before tuning further.

## Limits of this audit

- `ci` uses misplaced-tile count, not distance to the nearest matching goal.
- `?` means the 350k-state search limit was reached, not that the answer is proven.
- Every difficulty claim here comes from the research above, not from INSIGHT players.
