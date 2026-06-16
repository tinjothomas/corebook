"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signOut, user } = useAuth();
  const pathname = usePathname();

  const navigation = [
    { name: "Accounts", href: "/accounts" },
    { name: "Transactions", href: "/transactions" },
    { name: "Invoices", href: "/invoices" },
    { name: "Customers", href: "/customers" },
    { name: "Settings", href: "/settings" },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-paper text-ink pb-24">
        <div className="max-w-[1200px] mx-auto px-8">
          {/* Masthead */}
          <header className="grid grid-cols-3 items-end pt-12 pb-6 border-b border-ink">
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-mute pb-1">
              № 04 · Vol. MMXXVI
            </div>
            <div className="text-center">
              <h1 className="font-serif text-[72px] leading-[0.95] tracking-[-0.02em] font-normal">
                Ledger <span className="italic text-moss">&</span> Co.
              </h1>
              <div className="italic font-serif text-[18px] text-ink-soft mt-1">
                CoreBook — accounting dashboard
              </div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-mute pb-1 text-right flex items-center justify-end gap-6">
              <span>
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={signOut}
                className="text-ink hover:text-rose transition-colors">
                SIGN OUT
              </button>
            </div>
          </header>

          {/* Sub-nav */}
          <nav className="flex items-center gap-6 py-4 border-b border-line mb-12">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-[11px] uppercase tracking-[0.16em] transition-colors ${
                    isActive
                      ? "text-ink font-medium"
                      : "text-ink-soft hover:text-ink"
                  }`}>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Main content */}
          <main>{children}</main>

          {/* Footer */}
          <footer className="mt-24 pt-6 border-t border-ink text-center">
            <div className="text-ink-mute text-[11px] tracking-[0.3em]">
              · · ·
            </div>
          </footer>
        </div>
      </div>
    </ProtectedRoute>
  );
}
