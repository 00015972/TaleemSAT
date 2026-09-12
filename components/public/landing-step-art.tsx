const sceneProps = {
  'aria-hidden': true,
  className: 'landing-step-scene',
  focusable: false,
  viewBox: '0 0 300 190',
} as const;

export function DirectionStepArt() {
  return (
    <svg {...sceneProps}>
      <path className="step-orbit" d="M68 150c35 26 132 26 187-18" />
      <circle className="step-halo" cx="188" cy="70" r="57" />
      <circle className="step-target-ring" cx="188" cy="70" r="39" />
      <circle className="step-target-ring" cx="188" cy="70" r="23" />
      <circle className="step-target-core" cx="188" cy="70" r="9" />
      <path className="step-arrow" d="m121 116 58-39M169 76l13-1-5 12" />
      <g className="step-score-card">
        <rect x="37" y="36" width="87" height="54" rx="9" />
        <text x="51" y="56">TARGET</text>
        <text className="step-score" x="50" y="78">1500</text>
      </g>
      <g className="step-date-card">
        <rect x="157" y="119" width="104" height="49" rx="9" />
        <path d="M157 137h104M177 112v15M241 112v15" />
        <text x="174" y="155">OCT 05</text>
      </g>
      <circle className="step-spark" cx="264" cy="51" r="5" />
    </svg>
  );
}

export function PracticeStepArt() {
  return (
    <svg {...sceneProps}>
      <path className="step-orbit" d="M45 146c54 27 158 23 213-24" />
      <rect className="step-sheet-back" x="91" y="22" width="142" height="137" rx="12" transform="rotate(7 91 22)" />
      <rect className="step-sheet" x="73" y="24" width="151" height="138" rx="12" />
      <rect className="step-sheet-tab" x="73" y="24" width="151" height="28" rx="12" />
      <path className="step-sheet-rule" d="M91 69h95M91 81h113M91 93h72" />
      <g className="step-options">
        <circle cx="99" cy="116" r="8" /><circle cx="131" cy="116" r="8" />
        <circle className="is-selected" cx="163" cy="116" r="8" /><circle cx="195" cy="116" r="8" />
        <text x="95" y="119">A</text><text x="127" y="119">B</text>
        <text className="is-selected-text" x="159" y="119">C</text><text x="191" y="119">D</text>
      </g>
      <g className="step-category-tab">
        <rect x="30" y="43" width="105" height="35" rx="8" />
        <text x="45" y="57">R&amp;W</text><text className="step-tab-title" x="45" y="70">Information</text>
      </g>
      <circle className="step-check" cx="234" cy="143" r="21" />
      <path className="step-check-mark" d="m224 143 7 7 13-16" />
    </svg>
  );
}

export function ProgressStepArt() {
  return (
    <svg {...sceneProps}>
      <path className="step-orbit" d="M47 153c42 19 153 26 209-22" />
      <rect className="step-dashboard" x="45" y="31" width="188" height="126" rx="13" />
      <path className="step-dashboard-rule" d="M45 60h188M77 31v126" />
      <circle className="step-dashboard-dot" cx="59" cy="46" r="4" />
      <path className="step-chart-grid" d="M94 77h113M94 99h113M94 121h113M113 69v65M141 69v65M169 69v65M197 69v65" />
      <path className="step-chart" d="m96 125 28-20 25 7 27-31 31-15" />
      <circle className="step-chart-point" cx="124" cy="105" r="5" />
      <circle className="step-chart-point" cx="176" cy="81" r="5" />
      <g className="step-missions">
        <circle cx="60" cy="82" r="8" /><path d="m56 82 3 3 5-7" />
        <circle cx="60" cy="107" r="8" /><path d="m56 107 3 3 5-7" />
        <circle cx="60" cy="132" r="8" />
      </g>
      <g className="step-xp-badge">
        <path d="m236 20 34 14-5 39-38 5-15-35z" />
        <text x="227" y="47">+10</text><text className="step-xp" x="235" y="61">XP</text>
      </g>
      <path className="step-spark-line" d="M264 91v18M255 100h18" />
    </svg>
  );
}
