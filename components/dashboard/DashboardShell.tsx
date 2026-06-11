"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Navbar } from "@/components/dashboard/Navbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-[45] bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <Navbar onOpenMobileNav={() => setMobileNavOpen(true)} />
      <main className="min-h-screen transition-all duration-300 pt-16 md:ml-64">
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
