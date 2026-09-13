export function ReadingPortalArt() {
  return (
    <div className="qba-portal-art qba-reading-art" aria-hidden="true">
      <span className="qba-art-orb" />
      <span className="qba-book">
        <i className="qba-book-lines" />
        <span className="qba-book-bubbles">
          <i />
          <i />
          <i className="filled" />
          <i />
        </span>
      </span>
      <b className="qba-art-spark qba-art-spark-one">✦</b>
      <b className="qba-art-spark qba-art-spark-two">Aa</b>
    </div>
  );
}

export function MathPortalArt() {
  return (
    <div className="qba-portal-art qba-math-art" aria-hidden="true">
      <span className="qba-art-orb" />
      <span className="qba-calculator">
        <i className="qba-calc-screen" />
        <span className="qba-calc-keys">
          {Array.from({ length: 9 }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      </span>
      <b className="qba-art-spark qba-art-spark-one">√x</b>
      <b className="qba-art-spark qba-art-spark-two">π</b>
    </div>
  );
}
