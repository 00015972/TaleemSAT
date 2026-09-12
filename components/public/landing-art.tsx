export function HeroAnswerSheet() {
  return (
    <div className="landing-hero-art" aria-hidden="true">
      <span className="landing-hero-orbit landing-hero-orbit-one" />
      <span className="landing-hero-orbit landing-hero-orbit-two" />
      <span className="landing-hero-note landing-hero-note-score">
        <small>Score quest</small>
        <strong>1500</strong>
      </span>
      <span className="landing-hero-note landing-hero-note-streak">
        <b>3</b>
        <span>day streak</span>
      </span>

      <div className="landing-answer-sheet">
        <div className="landing-sheet-topline">
          <span>Reading &amp; Writing</span>
          <span>03 / 08</span>
        </div>
        <div className="landing-sheet-progress"><i /></div>
        <div className="landing-sheet-meta">
          <span>Information &amp; Ideas</span>
          <b>Medium</b>
        </div>
        <p className="landing-sheet-passage">
          The most useful practice does more than mark an answer. It shows you the pattern
          behind your progress.
        </p>
        <p className="landing-sheet-question">Which choice best states the main idea?</p>
        <div className="landing-sheet-options">
          {['A', 'B', 'C', 'D'].map((letter, index) => (
            <span key={letter} className={index === 2 ? 'is-selected' : ''}>
              <i>{letter}</i>
              <b>{index === 2 ? 'Focused work becomes visible growth.' : 'A thoughtful alternative answer.'}</b>
            </span>
          ))}
        </div>
        <div className="landing-sheet-result">
          <span>✓</span>
          <div><strong>Correct</strong><small>Keep the pattern. Carry it forward.</small></div>
        </div>
      </div>

      <span className="landing-pencil-line" />
      <span className="landing-spark landing-spark-one">✦</span>
      <span className="landing-spark landing-spark-two">+</span>
    </div>
  );
}

export function BlueprintArt() {
  return (
    <div className="landing-blueprint-art" aria-hidden="true">
      <div className="landing-blueprint-card landing-blueprint-reading">
        <span>R&amp;W</span><strong>Aa</strong><small>4 focus areas</small>
      </div>
      <div className="landing-blueprint-card landing-blueprint-math">
        <span>Math</span><strong>√x</strong><small>4 focus areas</small>
      </div>
      <i className="landing-blueprint-ring" />
      <b className="landing-blueprint-mark">8</b>
    </div>
  );
}

export function AccuracyArt() {
  const bars = [42, 58, 51, 72, 67, 84];
  return (
    <div className="landing-accuracy-art" aria-hidden="true">
      <div className="landing-accuracy-heading">
        <span>Accuracy climb</span><strong>+12%</strong>
      </div>
      <div className="landing-accuracy-bars">
        {bars.map((height, index) => (
          <i key={height} style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }} />
        ))}
      </div>
      <div className="landing-accuracy-axis"><span>Start</span><span>Today</span></div>
    </div>
  );
}

export function MomentumArt() {
  return (
    <div className="landing-momentum-art" aria-hidden="true">
      <div className="landing-momentum-stamp"><strong>+40</strong><span>XP this week</span></div>
      <div className="landing-mission-list">
        <span className="is-done"><i>✓</i><b>1 new question</b></span>
        <span className="is-done"><i>✓</i><b>5 new questions</b></span>
        <span><i>3</i><b>10 new questions</b></span>
      </div>
    </div>
  );
}
