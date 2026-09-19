/* Native links use full cached documents offline; artwork is preoptimized WebP. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import {
  ArrowRight,
  Leaf,
  Timer,
  Clock3,
  BookOpen,
  Sprout,
  Download,
} from "lucide-react";
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Leaf />
          </span>
          pacana
        </a>
        <div className="nav-actions">
          <a
            className="nav-download"
            href="https://github.com/razaele0003/pacana/releases"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} /> Windows App
          </a>
          <a className="primary" href="/app">
            Open Pacana <ArrowRight size={17} />
          </a>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <img
            src="/art/forest.webp"
            alt="A capybara enjoying a book in a peaceful woodland nook"
          />
          <div className="landing-copy">
            <span className="eyebrow">
              <Leaf size={14} /> YOUR LITTLE FOCUS NOOK
            </span>
            <h1>
              A calmer pace.
              <br />A clearer day.
            </h1>
            <p>
              Focus on what you’re doing.
              <br />
              Remember where your time went.
            </p>
            <div className="landing-actions">
              <a href="/app" className="primary">
                Make room for focus <ArrowRight size={19} />
              </a>
              <a
                href="https://github.com/razaele0003/pacana/releases"
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
              >
                <Download size={18} /> Download for Windows
              </a>
            </div>
            <span className="landing-note">
              Free to focus. Yours to keep. Available on Web and Windows PC.
            </span>
          </div>
        </section>
        <section className="landing-intro">
          <span className="eyebrow">COZY FOCUS & TIME JOURNAL</span>
          <h2>
            A little intention.
            <br />A lovely place to start.
          </h2>
          <p>
            Settle into your own rhythm, with a quiet companion
            <br />
            and a little space to notice your day.
          </p>
        </section>
        <section className="landing-features">
          {[
            {
              Icon: Timer,
              title: "Focus, your way",
              copy: "Choose your own study and rest intervals. One thing at a time, at a pace that feels right.",
            },
            {
              Icon: Clock3,
              title: "Find your rhythm",
              copy: "Check in on the clock, or start an interval right now. Two ways to stay gently aware.",
            },
            {
              Icon: BookOpen,
              title: "Keep the little moments",
              copy: "A simple journal of what you did, honest progress, and small wins worth noticing.",
            },
          ].map(({ Icon, title, copy }) => (
            <article className="card" key={title}>
              <span className="soft-icon">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </section>
        <section className="landing-bottom">
          <Sprout size={36} />
          <h2>Your next little step starts here.</h2>
          <p>
            Your journal stays on this device. Back it up whenever you like.
          </p>
          <div className="landing-actions bottom">
            <a href="/app" className="primary">
              Open Pacana <ArrowRight size={18} />
            </a>
            <a
              href="https://github.com/razaele0003/pacana/releases"
              target="_blank"
              rel="noreferrer"
              className="secondary-button"
            >
              <Download size={18} /> Download for Windows
            </a>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span className="brand">
          pacana <Leaf size={20} />
        </span>
        <span>A calmer pace. A clearer day.</span>
        <span>Made for your own little rhythm.</span>
      </footer>
    </div>
  );
}
