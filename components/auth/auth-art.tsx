export type AuthArtVariant =
  | 'login'
  | 'signup'
  | 'mail'
  | 'mail-sent'
  | 'reset'
  | 'invalid';

type AuthArtProps = {
  variant: AuthArtVariant;
  signupStep?: 1 | 2;
};

const artCopy: Record<AuthArtVariant, { eyebrow: string; title: string; body: string }> = {
  login: {
    eyebrow: 'Your next session',
    title: 'Small wins become stronger scores.',
    body: 'Return to the skills you are building and make today’s practice count.',
  },
  signup: {
    eyebrow: 'Start with direction',
    title: 'Build a study rhythm that knows your goal.',
    body: 'Your target and test date turn each session into a more useful next step.',
  },
  mail: {
    eyebrow: 'A quick reset',
    title: 'Your way back is one email away.',
    body: 'We will send a secure link so you can return to practice without losing momentum.',
  },
  'mail-sent': {
    eyebrow: 'Message delivered',
    title: 'The next move is in your inbox.',
    body: 'Open the secure link in the email to continue. You are almost back at your desk.',
  },
  reset: {
    eyebrow: 'Secure restart',
    title: 'A fresh password. The same progress.',
    body: 'Choose a strong new password and step right back into your study plan.',
  },
  invalid: {
    eyebrow: 'Link interrupted',
    title: 'This route has reached its time limit.',
    body: 'Request a fresh recovery email and we will get you moving again.',
  },
};

export function AuthArt({ variant, signupStep = 1 }: AuthArtProps) {
  const copy = artCopy[variant];

  return (
    <aside className={`auth-art auth-art-${variant}`} aria-hidden="true">
      <div className="auth-art-grid" />
      <span className="auth-art-ring auth-art-ring-one" />
      <span className="auth-art-ring auth-art-ring-two" />

      <div className="auth-art-copy">
        <p>{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
      </div>

      {variant === 'login' && <LoginScene />}
      {variant === 'signup' && <SignupScene step={signupStep} />}
      {(variant === 'mail' || variant === 'mail-sent') && (
        <MailScene sent={variant === 'mail-sent'} />
      )}
      {variant === 'reset' && <ResetScene />}
      {variant === 'invalid' && <InvalidScene />}
    </aside>
  );
}

function LoginScene() {
  return (
    <div className="auth-scene auth-login-scene">
      <div className="auth-score-note">
        <small>Score quest</small>
        <strong>1500</strong>
        <span>Target in sight</span>
      </div>
      <div className="auth-session-slip">
        <span className="auth-slip-top"><b>Today&apos;s focus</b><i>03 / 08</i></span>
        <span className="auth-slip-rule"><i /></span>
        <small>Information &amp; Ideas</small>
        <div className="auth-answer-bubbles">
          <i>A</i><i>B</i><i className="is-filled">C</i><i>D</i>
        </div>
      </div>
      <span className="auth-art-star auth-art-star-one">✦</span>
      <span className="auth-pencil-stroke" />
    </div>
  );
}

function SignupScene({ step }: { step: 1 | 2 }) {
  return (
    <div className={`auth-scene auth-signup-scene is-step-${step}`}>
      <div className="auth-direction-line"><i /><i /></div>
      <div className="auth-direction-stop auth-direction-stop-one">
        <b>1</b><span>Your login</span><small>Account details</small>
      </div>
      <div className="auth-direction-stop auth-direction-stop-two">
        <b>2</b><span>Your direction</span><small>Goal &amp; date</small>
      </div>
      <div className="auth-target-note">
        <small>Target</small>
        <strong>{step === 1 ? '— — — —' : '1500'}</strong>
      </div>
      <div className="auth-date-note"><small>SAT DAY</small><b>06 · 05</b></div>
      <span className="auth-art-star auth-art-star-two">✦</span>
    </div>
  );
}

function MailScene({ sent }: { sent: boolean }) {
  return (
    <div className={`auth-scene auth-mail-scene ${sent ? 'is-sent' : ''}`}>
      <svg className="auth-mail-path" viewBox="0 0 320 170" focusable="false">
        <path d="M25 135C93 25 201 181 294 47" />
        <circle cx="294" cy="47" r="6" />
      </svg>
      <div className="auth-envelope">
        <span className="auth-envelope-flap" />
        <span className="auth-envelope-letter"><i>RESET LINK</i><b>••••••</b></span>
        <span className="auth-envelope-seal">T</span>
      </div>
      <div className="auth-inbox-mark"><i>{sent ? '✓' : '·'}</i><span>INBOX</span></div>
      <span className="auth-art-star auth-art-star-three">✦</span>
    </div>
  );
}

function ResetScene() {
  return (
    <div className="auth-scene auth-reset-scene">
      <div className="auth-reset-sheet">
        <span>NEW START</span>
        <i /><i /><i />
        <div className="auth-reset-check">✓</div>
      </div>
      <div className="auth-lock">
        <span className="auth-lock-loop" />
        <span className="auth-lock-body"><i /></span>
      </div>
      <span className="auth-security-note">SECURE · PRIVATE</span>
      <span className="auth-art-star auth-art-star-four">✦</span>
    </div>
  );
}

function InvalidScene() {
  return (
    <div className="auth-scene auth-invalid-scene">
      <svg className="auth-broken-path" viewBox="0 0 320 150" focusable="false">
        <path d="M25 105C85 20 139 132 190 68" />
        <path d="M214 60C242 37 267 31 295 28" />
      </svg>
      <span className="auth-path-break">×</span>
      <div className="auth-expired-note"><small>RESET LINK</small><strong>Expired</strong><span>Request a new route</span></div>
      <span className="auth-art-star auth-art-star-five">✦</span>
    </div>
  );
}
