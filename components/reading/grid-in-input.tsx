'use client';

/**
 * The student-produced-response input for a `grid_in` question — replaces
 * the lettered A–D option list. Purely controlled: each shell (practice/mock)
 * wires it into its own answer-state model, since they have different
 * check/confirm flows (practice checks on demand, Mock records continuously
 * and scores at the end).
 */
export function GridInInput({
  value,
  onChange,
  onEnter,
  disabled,
  state,
  tries,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
  /** 'key' after a correct check, 'missed' after an incorrect one. */
  state?: 'key' | 'missed';
  /** Previously-submitted wrong answers, shown as crossed-out chips. */
  tries?: string[];
  autoFocus?: boolean;
}) {
  return (
    <div className="prx-gridin">
      <div className="prx-gridin-row">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoFocus={autoFocus}
          className={`prx-gridin-input${state ? ` ${state}` : ''}`}
          value={value}
          disabled={disabled}
          placeholder="Enter your answer"
          aria-label="Your answer"
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
      </div>
      <p className="prx-gridin-hint">
        A fraction like 3/2 or a decimal like 1.5 are both accepted.
      </p>
      {tries && tries.length > 0 && (
        <div className="prx-gridin-tries">
          {tries.map((t, i) => (
            <span key={i} className="prx-gridin-try">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
