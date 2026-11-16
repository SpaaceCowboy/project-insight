import {Heading, Shot} from '../ui.jsx';

/** Captures of the game's Worlds half (see Shot in ui.jsx). */
export default function Worlds() {
  return <section id="worlds">
    <div className="wrap">
      <Heading>Inside Worlds.</Heading>
      <div className="phones four">
        <Shot name="create" loop label="The creator: an empty grid is dragged larger, tiles are placed on it, the board is cleared and the grid is dragged back" />
        <Shot name="profile" label="A designer's profile: level, puzzles created and solved, followers, achievements and their puzzles" />
        <Shot name="players" label="The list of players, each with their level and how many puzzles they have designed and solved" />
        <Shot name="world-play" loop label="A community puzzle: a three by three board with one tile swapped and swapped back, then liked and unliked" />
      </div>
    </div>
  </section>;
}
