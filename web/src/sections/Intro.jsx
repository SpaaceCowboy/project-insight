import {useInView} from '../ui.jsx';

export default function Intro() {
  const [ref, inView] = useInView({once: true, threshold: .35});
  return <section id="about">
    <div className="wrap">
      <h2 ref={ref} className={'statement' + (inView ? ' in' : '')}>
        One board. One target. Zero regressive elements.
      </h2>
      <hr className="rule" />
    </div>
  </section>;
}
