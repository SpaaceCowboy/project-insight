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
- **Generated, then verified by the solver** (Taylor & Parberry; Kartal et al.). Every level has a verified optimal route.

## Audit of Game 2 (2026-10-07)

**Columns** (`node scripts/check-levels.cjs --game 2 --audit`):
- `ci`: moves on the optimal route that increase the number of misplaced tiles. This adapts van Kreveld's "distance to goal" for tiles of the same colour.
- `choices`: optimal opening moves out of all legal opening moves.
- `greedy`: the "no-brainer" test. A player who always makes the move that fixes the most misplaced tiles, breaking ties at random, plays 50 seeded games. This is the share of those games won within 3× par. 1.0 means the level can be solved without thinking.
- `focus`: `all` if the board cannot be solved without that tile's moves, `longer` if a solution exists without it but is longer than par, `no` if it can be skipped at no cost, `?` if the search limit was reached.

### Difficulty pass (scoring 3)

Playtesting reported that many levels felt like no-brainers, and the greedy test confirmed it. The pass applied to Game 2 only; Game 1's boards are unchanged by request.

| Game 2 | Before | After |
| --- | --- | --- |
| No-brainers (greedy ≥ 0.8) | 38 | 11 |
| Greedy ≥ 0.5 | 51 | 14 |
| No counterintuitive move | 38 | 14 |
| Test, twist or boss levels with greedy ≥ 0.5 | 25 | 1 (Open Window, at its 0.5 limit) |

| World | Mean greedy, before → after | No-brainers | Mean `ci` after |
| --- | --- | --- | --- |
| 1 Straight Lines | 0.64 → 0.28 | 11 → 4 | 1.15 |
| 2 Slanted Light | 0.53 → 0.23 | 8 → 3 | 1.25 |
| 3 Long Jumps | 0.69 → 0.21 | 12 → 3 | 1.10 |
| 4 Mosaics | 0.41 → 0.17 | 6 → 1 | 1.65 |
| 5 Masterworks | 0.18 → 0.07 | 1 → 0 | 1.70 |

**What changed:**
- **Fewer easy slots.** 13 teaching and breather slots became test levels. Each world keeps one breather, plus the first teaching level for each new tile.
- **Redesigned targets.** 33 targets that could not meet the limits were redesigned by searching over patterns, an extra row or column, and gap layouts. The common fix is a single White "stone" or a gap near the centre, which forces a detour (Brown's "catch"). Moat gained Red tiles, because a Purple-and-White board cannot need a detour.
- **Unchanged and still greedy-solvable:** the 8 first-introduction teaching levels and the 5 breathers, which is intended (Schell: easy to get started; parallelism lets the player rest).
- **Board changes:** every changed board moved to the next revision.

Game 1 for comparison: 15 levels with greedy ≥ 0.8. Ten of them come after level 10: 17, 20, 25, 43, 55, 56, 65, 74, 82 and 86.

## Generator rules (scoring 3, `scripts/make-game2.cjs`)

- **Teaching and breather levels:** take the cleanest route, with `ci = 0`, and every focus tile must be needed. Their boards are kept across scoring changes.
- **Minimums for harder levels:**

  | Mood | Counterintuitive moves | Made by a focus tile | Optimal opening moves | Greedy win rate |
  | --- | --- | --- | --- | --- |
  | Test | at least 1 | — | at most 50% | at most 0.5 |
  | Twist | at least 2 | at least 1 | at most 50% | at most 0.3 |
  | Boss | at least 3 | at least 1 | at most 50% | at most 0.1 |

- **Relaxation:** when a target can't meet its minimums, each relaxation step widens the par band by 1, lowers the `ci` minimum by 1, drops the focus-tile minimum, and allows 10 points more optimal openings and 0.1 more greedy wins. The log shows every relaxed slot.
- **No regression:** a relaxed pick that scores lower than the slot's previous board on `ci`, then greedy rate, then length keeps the previous board.
- **Check-time guard:** `check-levels --game 2` fails if any test, twist or boss level has a greedy rate above 0.6.
- **Shared measurements:** the generator, the audit and the check all use `scripts/level-metrics.cjs`.

## Open issues

1. **`ci` is measured on the one optimal route the solver returns.** Another optimal route could avoid the catch.
2. **Many fixes reuse one device,** a central White stone or gap. Playtesting should check whether that becomes repetitive.
3. **No player data has been collected yet.** Run the Game 2 difficulty-rating session in `playtest.md`, and compare ratings with `greedy` as well as `par`, `ci` and `choices`.

## Limits of this audit

- `ci` uses misplaced-tile count, not distance to the nearest matching goal.
- The greedy player is one simple strategy. A level it cannot solve may still be easy for a person who spots the catch quickly.
- `?` means the 350k-state search limit was reached, not that the answer is proven.
- Every difficulty claim here comes from the research above, not from INSIGHT players.
