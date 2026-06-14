"use client";

import { useState, useEffect } from "react";
import { Bell, User, ArrowLeft, Menu } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ProfileModal } from "@/components/dashboard/ProfileModal";
import { NavbarSubscription } from "@/components/navbar-subscription";

interface UserData {
  user_id: number;
  email: string;
  nama: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  subscription_status?: string | null;
  expired_at?: string | null;
}

interface NavbarProps {
  fullWidth?: boolean;
  showBackButton?: boolean;
  backButtonText?: string;

  backHref?: string;

  onOpenMobileNav?: () => void;
}

export function Navbar({
  fullWidth = false,
  showBackButton = false,
  backButtonText = "Back to Dashboard",
  backHref,
  onOpenMobileNav,
}: NavbarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const hasSidebar =
    pathname?.startsWith("/dashboard") ||
    pathname === "/dashboard" ||
    pathname?.startsWith("/generate") ||
    pathname === "/generate";

  const loadUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      console.log("User not authenticated (likely student via QR)");
    }
  };

  useEffect(() => {
    void loadUser();
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "UN";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleUpdateUser = (updatedUser: UserData) => {
    setUser(updatedUser);
  };

  const handleBack = () => {
    router.push(backHref || "/dashboard");
  };

  const displayName = user?.nama || "Siswa";
  const displayEmail = user?.email || "";

  const showHamburger =
    hasSidebar && !fullWidth && typeof onOpenMobileNav === "function";

  return (
    <>
      <nav
        className={`fixed top-0 right-0 z-40 h-16 border-b border-border bg-white shadow-sm transition-all duration-300 ${fullWidth ? "left-0" : hasSidebar ? "left-0 md:left-64" : "left-0"
          }`}
      >
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {showHamburger && (
              <button
                type="button"
                onClick={onOpenMobileNav}
                className="shrink-0 rounded-lg p-2 text-foreground hover:bg-input md:hidden"
                aria-label="Buka menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
            {showBackButton && (
              <button
                onClick={handleBack}
                className="flex min-w-0 items-center gap-2 text-muted transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" />
                <span className="hidden truncate text-sm font-medium sm:inline">
                  {backButtonText}
                </span>
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {user && (
              <button
                type="button"
                className="relative rounded-full p-2 transition-colors hover:bg-input"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {user && (
              <NavbarSubscription
                subscriptionStatus={user.subscription_status}
                expiredAt={user.expired_at}
                onRefetchUser={() => void loadUser()}
              />
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-border transition-colors hover:border-primary"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-sm font-medium text-primary-foreground">
                    {user ? getInitials(user?.nama) : "?"}
                  </div>
                )}
              </button>

              {showProfileMenu && user && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-card py-1 shadow-lg">
                  <div className="border-b border-border px-4 py-2">
                    <p className="truncate text-sm font-medium text-card-foreground">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {displayEmail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowProfileModal(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-input"
                  >
                    <User className="h-4 w-4" />
                    Lihat Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-input"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {user && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={user}
          onUpdate={handleUpdateUser}
        />
      )}
    </>
  );
}
