import { redirect } from 'next/navigation';

export const metadata = { title: 'Admin — Taleem SAT' };

export default function AdminIndexPage() {
  redirect('/admin/questions');
}
