export type SkillArtKind =
  | 'information'
  | 'craft'
  | 'expression'
  | 'conventions'
  | 'algebra'
  | 'advanced'
  | 'data'
  | 'geometry';

type SkillIllustrationProps = {
  kind: SkillArtKind;
};

const svgProps = {
  'aria-hidden': true,
  className: 'landing-skill-svg',
  focusable: false,
  viewBox: '0 0 220 116',
} as const;

export function SkillIllustration({ kind }: SkillIllustrationProps) {
  switch (kind) {
    case 'information':
      return (
        <svg {...svgProps}>
          <rect className="skill-shadow" x="35" y="13" width="128" height="82" rx="8" transform="rotate(-4 35 13)" />
          <rect className="skill-paper" x="47" y="18" width="128" height="82" rx="8" />
          <path className="skill-rule" d="M62 38h61M62 49h94M62 60h76M62 82h51" />
          <path className="skill-highlight" d="M59 68h86" />
          <circle className="skill-pin" cx="165" cy="71" r="16" />
          <path className="skill-ink" d="m158 71 5 5 9-12M145 71h-9" />
          <path className="skill-pencil" d="M49 94 27 105l7-23z" />
        </svg>
      );
    case 'craft':
      return (
        <svg {...svgProps}>
          <rect className="skill-paper" x="29" y="17" width="74" height="31" rx="7" />
          <rect className="skill-soft" x="78" y="43" width="108" height="34" rx="7" />
          <rect className="skill-paper" x="39" y="72" width="91" height="27" rx="7" />
          <path className="skill-rule" d="M43 29h43M43 37h30M93 54h73M93 63h54M53 83h59M53 90h37" />
          <path className="skill-ink skill-flow" d="M107 29h31c18 0 22 12 22 21v20c0 12-8 17-20 17h-5" />
          <path className="skill-accent" d="m140 81-7 6 7 6" />
          <circle className="skill-dot" cx="107" cy="29" r="4" />
        </svg>
      );
    case 'expression':
      return (
        <svg {...svgProps}>
          <rect className="skill-note skill-note-one" x="21" y="25" width="54" height="48" rx="7" />
          <rect className="skill-note skill-note-two" x="84" y="14" width="54" height="48" rx="7" />
          <rect className="skill-note skill-note-three" x="147" y="34" width="54" height="48" rx="7" />
          <path className="skill-rule" d="M32 39h27M32 48h33M32 57h21M95 28h29M95 37h22M95 46h31M158 48h29M158 57h23M158 66h31" />
          <path className="skill-ink skill-flow" d="M68 82c28 17 76 18 110 5" />
          <path className="skill-accent" d="m171 81 9 6-9 7" />
          <circle className="skill-dot" cx="48" cy="82" r="5" />
        </svg>
      );
    case 'conventions':
      return (
        <svg {...svgProps}>
          <rect className="skill-shadow" x="37" y="13" width="136" height="88" rx="9" transform="rotate(3 37 13)" />
          <rect className="skill-paper" x="31" y="15" width="137" height="87" rx="9" />
          <path className="skill-rule" d="M49 34h73M49 47h101M49 60h43M111 60h39M49 82h98" />
          <path className="skill-highlight" d="M47 69h69" />
          <text className="skill-symbol" x="96" y="69">;</text>
          <path className="skill-edit" d="m125 72 8-10 8 10M122 77h22" />
          <circle className="skill-pin" cx="172" cy="32" r="12" />
          <path className="skill-ink" d="m167 32 3 3 7-8" />
        </svg>
      );
    case 'algebra':
      return (
        <svg {...svgProps}>
          <rect className="skill-math-board" x="27" y="14" width="164" height="88" rx="10" />
          <path className="skill-grid" d="M50 24v68M73 24v68M96 24v68M119 24v68M142 24v68M165 24v68M37 36h144M37 54h144M37 72h144M37 90h144" />
          <path className="skill-axis" d="M37 72h144M96 24v68" />
          <path className="skill-math-line" d="M47 87 166 32" />
          <circle className="skill-solution" cx="119" cy="54" r="6" />
          <path className="skill-callout" d="M124 49 146 25" />
          <rect className="skill-label" x="144" y="17" width="38" height="20" rx="5" />
          <text className="skill-label-text" x="151" y="30">x = 3</text>
        </svg>
      );
    case 'advanced':
      return (
        <svg {...svgProps}>
          <rect className="skill-math-board" x="25" y="13" width="168" height="90" rx="10" />
          <path className="skill-grid" d="M49 24v68M73 24v68M97 24v68M121 24v68M145 24v68M169 24v68M36 38h146M36 56h146M36 74h146M36 92h146" />
          <path className="skill-axis" d="M36 74h146M109 23v69" />
          <path className="skill-math-line" d="M55 27c12 42 31 59 54 59s42-17 54-59" />
          <circle className="skill-solution" cx="109" cy="86" r="5" />
          <rect className="skill-label" x="31" y="18" width="53" height="22" rx="5" />
          <text className="skill-label-text" x="39" y="33">y = x²</text>
        </svg>
      );
    case 'data':
      return (
        <svg {...svgProps}>
          <rect className="skill-math-board" x="24" y="17" width="129" height="84" rx="10" />
          <path className="skill-axis" d="M42 32v52h96" />
          <rect className="skill-bar" x="53" y="61" width="14" height="23" rx="3" />
          <rect className="skill-bar skill-bar-two" x="77" y="46" width="14" height="38" rx="3" />
          <rect className="skill-bar skill-bar-three" x="101" y="35" width="14" height="49" rx="3" />
          <path className="skill-math-line" d="m49 58 34-18 25 6 31-22" />
          <circle className="skill-solution" cx="83" cy="40" r="4" />
          <circle className="skill-solution" cx="139" cy="24" r="4" />
          <circle className="skill-pin" cx="168" cy="63" r="27" />
          <path className="skill-pie" d="M168 63V36a27 27 0 0 1 24 39z" />
          <text className="skill-percent" x="156" y="68">72%</text>
        </svg>
      );
    case 'geometry':
      return (
        <svg {...svgProps}>
          <rect className="skill-math-board" x="23" y="14" width="172" height="88" rx="10" />
          <path className="skill-geometry" d="m54 84 55-58 57 58z" />
          <path className="skill-angle" d="M66 84a12 12 0 0 1 4-9M146 84a20 20 0 0 0-6-14" />
          <path className="skill-compass" d="M109 26 91 89M109 26l35 63M91 89h53" />
          <path className="skill-tick" d="m76 55 6 5M137 56l-6 5" />
          <circle className="skill-solution" cx="109" cy="26" r="4" />
          <text className="skill-label-text" x="48" y="96">42°</text>
          <text className="skill-label-text" x="148" y="96">x</text>
          <path className="skill-edit" d="M170 28a24 24 0 0 1 10 27" />
          <path className="skill-accent" d="m176 51 5 6 3-7" />
        </svg>
      );
  }
}
