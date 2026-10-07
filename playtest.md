# INSIGHT — Player Experience Check

Status: protocol updated for campaign revision 2 after mechanics removal on 2026-10-04. No human sessions have been run.

## People and setup

Recruit five people: three phone users (including one small phone) and two desktop users. Include at least two people who have never played INSIGHT and one desktop participant who uses only the keyboard. Allow 15 minutes per person. Use the same URL throughout so saved attempts remain available.

Start newcomers with default Zen Mode and Tile Limits. Prepare an unfinished level 13 (The Spare Step) and an exhausted level 3 (The Long Pair) for the recovery tasks using legal swaps before the session. Test sound on a phone speaker and headphones across the group. Keep the game on one screen and give no rule explanations or destination hints.

Tell each person: “We are testing the game, not you. Please say what you expect to happen as you play.” Take anonymous notes under P1–P5. Do not claim a task passed if you had to explain the controls.

## Tasks

1. Open the game and solve the first puzzle. Observe the first attempted selection, invalid action, and successful swap. Wait up to two minutes without coaching.
2. Play level 13, make a move, open another puzzle, and return. Ask what they expect to be preserved. Repeat while switching Tile Limits, then reload and continue.
3. Ask them to restart, then get back to the position they had before restarting. Observe whether they discover Undo restart and whether the restored position matches their expectation.
4. Present the exhausted puzzle and ask them to decide how to continue. Observe Undo, Restart, and Choose another puzzle; returning should preserve the exhausted attempt.
5. Play for another five minutes with sound. Ask them to make the audio comfortable using the settings. Observe whether independent ambience/effects and the spoken celebration option are understood.
6. Play levels 5, 9, and 13 with original directional movement. Record what players plan before moving, whether they deliberately displace a correct tile, and whether the puzzle feels satisfying or repetitive.
7. Ask them to describe the target, a correct-placement glow, and the win ripple. Note any assumption that a glowing tile is locked or that its allowance has changed.

## Notes for each person

| Observation | Record |
| --- | --- |
| Device, screen size, input, speaker/headphones | |
| First puzzle: time and help required | |
| Invalid move: expected outcome and actual interpretation | |
| Returning to a puzzle/mode/reload: any lost work | |
| Undo restart: found unaided, restored expected position | |
| Exhausted puzzle: first recovery action, any dead end | |
| Difficulty: solve time, undo/restarts, satisfaction, boredom, abandonment | |
| Target: misread positions or colors | |
| Placement/win animation: clear, distracting, or misleading | |
| Sound after ten minutes: comfortable settings, fatigue | |
| One thing they would change | |

## Game 2 difficulty ratings

This follows van Kreveld, Löffler & Mutser (2015); see `level-design.md`. Run a separate 20-minute session with the same five people, using Dev Mode so every Game 2 level is open. Each person first plays Game 2 levels 1–4 as a tutorial. They then play 12 levels in a shuffled order that differs per person, which avoids learning effects. Take one test level and one twist or boss level from each world, plus levels 12, 33 and 87 as breathers. After each solve, ask: "How hard was that, from 1 to 10?" For each level, record the rating, the solve time, moves against par, undos and restarts, and any abandonment.

Afterwards, run `node scripts/check-levels.cjs --game 2 --audit` and compare its `par`, `ci` and `choices` columns with the mean ratings. Note which signal tracks the ratings best. Mark any level rated more than 2 points away from its neighbours at the same position in the curve. Change those levels' design rules in `scripts/make-game2.cjs`, never by hand; regeneration bumps their revisions. Five people are enough to find outliers, but not enough to fit difficulty weights.

## Acceptance and next decisions

- At least four of five people solve the first puzzle within two minutes without coaching and understand whether an attempted move succeeded.
- No participant loses an unfinished attempt during level switching, mode switching, restart recovery, or reload.
- At least four of five discover Undo restart and an exhaustion recovery action without coaching.
- Later puzzles should elicit deliberate setup or an articulated dependency. Repeated blind swapping, boredom, or abandonment identifies puzzles for revision. Sample levels 26, 51, 76, and 101 with returning players; do not judge the whole campaign from the opening alone.
- Nobody interprets placement feedback as locking a tile or consuming an extra move.
- Everyone can choose a comfortable audio mix and silence speech independently.
- If two or more people struggle to read the target, prototype target enlargement before adding content. If progression repeatedly causes frustration or boredom, review those specific puzzles with observed solving time and retries; retain stable level IDs.

Summarize observations and the three highest-impact changes after all five sessions. Automated browser passes are recorded separately and are not substitutes for these observations.
