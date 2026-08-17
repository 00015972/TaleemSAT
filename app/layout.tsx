import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taleem SAT — The Smarter Way to Conquer the Digital SAT',
  description:
    'A modern SAT preparation platform built by a 1500-scorer for ambitious students. Daily questions, AI-powered analysis, and certificates that mean something.',
};

const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('taleem_theme');
    var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t || preferred);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

const sidebarScript = `
(function(){
  try {
    if (localStorage.getItem('taleem_sb_collapsed') === 'true') {
      document.documentElement.setAttribute('data-sb-collapsed', 'true');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Plain <script> tags, not next/script's <Script strategy="beforeInteractive">:
            these must block paint (set data-theme before first render, no FOUC), and
            next/script's beforeInteractive path re-renders this exact element on the
            client on every Fast Refresh, which trips React 19's "script tag rendered
            on the client" dev warning. A server-rendered inline script has no such
            problem — it's real static HTML the browser executes on initial parse. */}
        <script id="theme-script" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script id="sidebar-script" dangerouslySetInnerHTML={{ __html: sidebarScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
