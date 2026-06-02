import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-sm"
              style={{ background: 'var(--gold)', color: 'var(--bg)' }}
            >
              T
            </div>
            <span
              className="font-serif text-xl font-semibold"
              style={{ color: 'var(--green)' }}
            >
              Taleem SAT
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
