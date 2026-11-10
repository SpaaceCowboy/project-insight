import type { CSSProperties } from 'react'
import { Board } from '@/components/Board'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Mini, NAME, Tile } from '@/components/Tile'
import release from '@/lib/generated.json'

const RULES: [string, string][] = [
  ['R', 'Moves up or down.'],
  ['B', 'Moves left or right.'],
  ['G', 'Moves along the rising diagonal.'],
  ['Y', 'Moves along the falling diagonal.'],
  ['P', 'Jumps two cells up, down, left or right.'],
  ['W', 'Never moves by itself. Another tile has to swap with it.'],
]

const WORLDS = [
  ['Create', 'Build a start grid and a target, then publish. A puzzle is only published once it has been proven solvable.'],
  ['Play', 'Other players’ puzzles, sorted by newest, most played or most liked. Or press Random and take what comes.'],
  ['Share', 'Every puzzle has a code. Send it to a friend and they open that exact puzzle.'],
  ['Keep', 'A profile with your level, your puzzles, bookmarks, the players you follow, a daily streak and achievements.'],
]

const example = release.hero[2] // drawn as the Create illustration: a real campaign level

function Download({ primary = false }: { primary?: boolean }) {
  return (
    <a href="/INSIGHT.apk" download className={`plush key ${primary ? 'key-primary' : ''}`}>
      Download for Android
    </a>
  )
}

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <span className="text-2xl font-extrabold tracking-tight">INSIGHT</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-col gap-24 pb-24 pt-8 sm:gap-32 sm:pt-14">
        <section className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-6">
            <h1 className="whitespace-nowrap text-[clamp(1.75rem,7.5vw,2.75rem)] leading-tight">A little order.<br />A little wonder.</h1>
            <p className="max-w-[52ch] text-muted">
              INSIGHT is a calm tile-swapping puzzle for Android. Every tile moves only the way its arrows point.
              Swap them until the board matches the target.
            </p>
            <p className="max-w-[52ch] text-muted">
              The board here is the real game: three levels from the Journey, playable now.
            </p>
            <Download />
          </div>
          <Board levels={release.hero} />
        </section>

        <section aria-labelledby="tiles" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 id="tiles" className="text-2xl sm:text-3xl">The rule is on the tile.</h2>
            <p className="max-w-[60ch] text-muted">
              Six tiles, six ways to move. Every move is a swap: a tile trades places with the tile it lands on.
              Nothing is hidden, and nothing needs explaining twice.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ '--cell': '56px' } as CSSProperties}>
            {RULES.map(([type, rule]) => (
              <li key={type} className="plush flex items-center gap-4 p-4">
                <Tile type={type} className="shrink-0" />
                <div>
                  <p className="font-semibold tracking-wide">{NAME[type]}</p>
                  <p className="text-sm text-muted">{rule}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="journey" className="grid items-start gap-10 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col items-start gap-4">
            <p className="eyebrow">Free</p>
            <h2 id="journey" className="text-2xl sm:text-3xl">Journey</h2>
            <p className="max-w-[52ch] text-muted">
              {release.levelCount} levels, free, with no account. Solving a level opens the next one.
              They start with two tiles and one move, and they do not stay that way.
            </p>
            <p className="max-w-[52ch] text-muted">
              Every level has a verified solution, so when one feels impossible, it isn’t.
            </p>
          </div>
          <ol className="grid grid-cols-4 gap-3 sm:grid-cols-8" aria-label={`The first ${release.journey.length} Journey levels`}>
            {release.journey.map((target, i) => (
              <li key={i} className="plush relative grid aspect-square place-items-center" style={{ borderRadius: 12 }}>
                <Mini rows={target} cell={7} label={`Level ${i + 1} target`} />
                <span className="absolute bottom-0.5 end-1.5 text-[11px] text-muted" aria-hidden="true">{i + 1}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="worlds" className="flex flex-col gap-10">
          <div className="flex flex-col items-start gap-4">
            <p className="eyebrow">One-time purchase</p>
            <h2 id="worlds" className="text-2xl sm:text-3xl">Worlds</h2>
            <p className="max-w-[60ch] text-muted">
              Journey is the puzzles we made. Worlds is the puzzles everyone else makes, and the ones you make for them.
              It never runs out.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="plush flex flex-col items-center gap-4 p-6">
              <p className="eyebrow">Start</p>
              <Mini rows={example.start} cell={22} label="An example start grid" />
            </div>
            <div className="plush flex flex-col items-center gap-4 p-6">
              <p className="eyebrow">Target</p>
              <Mini rows={example.target} cell={22} label="The example’s target grid" />
            </div>
            <div className="plush flex flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="eyebrow">Create</p>
              <p className="text-sm text-muted">Three steps from an idea to a puzzle other people are solving.</p>
            </div>
          </div>

          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {WORLDS.map(([term, detail]) => (
              <div key={term}>
                <dt className="font-semibold tracking-wide">{term}</dt>
                <dd className="text-sm text-muted">{detail}</dd>
              </div>
            ))}
          </dl>

          <div className="plush flex flex-col gap-2 p-6">
            <p className="text-lg">Pay once. Yours to keep.</p>
            <p className="max-w-[60ch] text-sm text-muted">
              Worlds will be a single purchase when INSIGHT reaches Google Play: no subscription, and Journey stays free.
              The price is not set yet. During the preview, Worlds is open to everyone with an account.
            </p>
          </div>
        </section>

        <section aria-labelledby="calm" className="flex flex-col gap-4">
          <h2 id="calm" className="text-2xl sm:text-3xl">Take your time.</h2>
          <p className="max-w-[60ch] text-muted">
            No timers. No move limits. No scores and no stars. A level is solved, or it is not solved yet.
            A move that isn’t allowed gets a soft ring and nothing else.
          </p>
          <p className="max-w-[60ch] text-muted">
            Light and dark themes, a colourblind palette, screen-reader support, and five languages:
            English, Español, Français, Italiano and Deutsch.
          </p>
        </section>

        <section id="download" aria-labelledby="get" className="plush flex scroll-mt-6 flex-col items-start gap-5 p-6 sm:p-10" style={{ borderRadius: 24 }}>
          <h2 id="get" className="text-2xl sm:text-3xl">Start the Journey.</h2>
          <Download primary />
          <p className="text-sm text-muted">
            Version {release.version} · {release.megabytes} MB · Android {release.android} or newer
          </p>
          <p className="max-w-[60ch] text-sm text-muted">
            This is a preview build, downloaded directly rather than from a store, so Android will ask you to allow
            installs from your browser. Google Play is coming.
          </p>
          <div className="max-w-full text-sm text-muted">
            <p>SHA-256, to check the file you received:</p>
            <code className="block break-all text-ink">{release.sha256}</code>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-xs text-muted">
        <p>
          Set in JetBrains Mono, under the <a className="underline" href="/jetbrains-mono-OFL.txt">SIL Open Font License</a>.
          Interface sounds in the app are from uisfx, CC0.
        </p>
      </footer>
    </div>
  )
}
