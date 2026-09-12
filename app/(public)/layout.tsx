import { PublicFooter, PublicHeader } from '@/components/public/public-shell';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
