import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default function GenerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
