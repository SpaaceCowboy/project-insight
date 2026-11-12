import {LEVEL_COUNT} from '../config.js';
import {Heading} from '../ui.jsx';

const QUESTIONS = [
  ['Is Journey free?', `Yes. All ${LEVEL_COUNT} Journey levels are free to play, offline and without an account. There are no ads and nothing in Journey is sold separately.`],
  ['What do I get with Worlds?', 'Puzzles made by other players, Random play, the tools to make and share your own puzzles, like or bookmark puzzles you like, and follow other creative designers.'],
  ['Is Worlds a subscription?', 'No. It is a single payment. You buy it once and keep it.'],
  ['If I buy on the website, how does the game know?', 'Worlds belongs to your Midori account rather than to one device. You buy it here with your account email, then sign in to the game with that same account.'],
  ['Do I need to be online?', 'Journey plays fully offline. Worlds needs a connection, because its puzzles live on the server.'],
  ['Which devices does Midori run on?', 'Android phones and tablets running Android 8.0 or newer.'],
];

export default function Faq() {
  return <section id="faq">
    <div className="wrap">
      <Heading>Good to know.</Heading>
      <div className="faq">
        {QUESTIONS.map(([question, answer]) => <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>)}
      </div>
    </div>
  </section>;
}
