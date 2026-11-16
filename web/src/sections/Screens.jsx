import {Heading, Shot} from '../ui.jsx';

/** Captures of the game (see Shot in ui.jsx). */
export default function Screens() {
  return <section id="screens">
    <div className="wrap">
      <Heading>Quiet screens, big keys.</Heading>
      <div className="phones">
        <Shot name="home" label="Midori's main menu: two large keys, Journey and Worlds" />
        <Shot name="journey-play" loop label="A Journey level: a three by three board, with one tile swapped and swapped back" />
        <Shot name="worlds" label="Worlds: a grid of community puzzles, with Random and Create keys below" />
      </div>
    </div>
  </section>;
}
