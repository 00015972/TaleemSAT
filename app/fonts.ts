import {
  DM_Sans,
  JetBrains_Mono,
  Manrope,
  Poppins,
  Space_Grotesk,
} from 'next/font/google';

/**
 * Fonts are self-hosted by next/font rather than pulled in with the two
 * `@import url(fonts.googleapis.com/...)` lines globals.css used to open with.
 * Those imports were the worst-case loading shape: the browser had to fetch
 * and parse our 455 KB stylesheet before it even learned the font CSS
 * existed, then make a second cross-origin round trip for that CSS, then a
 * third to fonts.gstatic.com for the faces. Measured from Tashkent each of
 * those hops cost 400-550 ms and all of it blocked first paint.
 *
 * next/font emits the @font-face rules into our own CSS at build time and
 * serves the woff2 from /_next/static, so the chain collapses to zero extra
 * round trips. Four of the five families ship as variable fonts — one file
 * each covers every weight globals.css asks for instead of one file per
 * weight.
 */

// next/font parses these calls statically at build time, so every option has
// to be an inline literal — a shared `display` constant is rejected.
export const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

export const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

/**
 * Poppins has no variable cut on Google Fonts, so every weight is its own
 * file. The old import asked for all nine weights in both roman and italic —
 * 36 faces — when the stylesheet only ever sets Poppins at 600 and 700, and
 * only inside the admin import workspace. `preload: false` keeps those two
 * faces off the critical path for students, who never render them.
 */
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-poppins',
});

export const fontVariables = [
  dmSans.variable,
  manrope.variable,
  spaceGrotesk.variable,
  jetbrainsMono.variable,
  poppins.variable,
].join(' ');
