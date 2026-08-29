import { MockRunner } from '@/components/mock/mock-runner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mock Test — Taleem SAT' };

export default function MockPage() {
  return <MockRunner />;
}
