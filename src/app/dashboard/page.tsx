import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Devfetch',
};

export default function DashboardPage() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Your developer knowledge hub</p>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Main</h2>
      </div>
    </div>
  );
}
