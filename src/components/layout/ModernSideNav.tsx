"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Ship,
  FileText,
  Database,
  Settings,
  Users,
  Building2,
  LogOut,
  ChevronRight,
  Waves,
  Anchor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Voyages", href: "/voyages", icon: Ship },
  { name: "Claims", href: "/claims", icon: FileText },
  { name: "Contracts/CPs", href: "/claims/contracts", icon: FileText },
  { name: "Data Management", href: "/data", icon: Database },
];

const adminNavigation = [
  { name: "User Management", href: "/customer-admin/users", icon: Users },
];

const superAdminNavigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "All Users", href: "/admin/users", icon: Users },
  { name: "Plans", href: "/admin/plans", icon: Settings },
  { name: "Invoices", href: "/admin/invoices", icon: FileText },
  { name: "SOF Mapping", href: "/admin/sof-mapper", icon: FileText },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function ModernSideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (pathname?.startsWith("/auth")) {
    return null;
  }

  const isSuperAdmin = role === "super_admin";
  const isCustomerAdmin = role === "customer_admin";

  const mainNav = isSuperAdmin
    ? navigation.filter((item) => item.name !== "Dashboard")
    : navigation;

  return (
    <div className="group/nav w-full flex-none md:w-16 md:hover:w-64 transition-all duration-200 flex h-full flex-col bg-gradient-to-b from-blue-100 via-cyan-100 to-teal-100 text-blue-900 relative overflow-hidden shadow-xl border-r border-blue-200">
      {/* Background Pattern */}
      <div className="absolute inset-0 wave-pattern opacity-10"></div>
      {/* Animated Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-200/20 rounded-full blur-2xl"></div>

      {/* Logo Section */}
      <div className="relative z-10 flex h-20 items-center justify-between px-6 border-b border-blue-200/60">
        <div className="flex items-center space-x-3">
          <div className="bg-white/80 backdrop-blur rounded-xl p-2.5 shadow-lg border border-blue-200/40">
            <Anchor className="w-6 h-6 text-blue-700" />
          </div>
          <div className="hidden md:group-hover/nav:block">
            <h1 className="text-lg font-bold tracking-tight text-blue-900">Laytime</h1>
            <p className="text-xs text-blue-500 font-medium">Platform</p>
          </div>
        </div>
        <div className="hidden md:group-hover/nav:block">
          <Waves className="w-5 h-5 text-blue-300" />
        </div>
      </div>

      {/* User Info */}
      {session && (
        <div className="relative z-10 px-6 py-4 border-b border-blue-200/60 bg-white/70 backdrop-blur hidden md:group-hover/nav:block">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-200/60 flex items-center justify-center border border-blue-300 shadow-lg">
              <span className="text-sm font-bold text-blue-900">
                {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-blue-900">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-blue-500 truncate">
                {session.user.tenant?.name || "No Tenant"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto px-2 md:px-4 py-4 space-y-1">
        {/* Main Navigation */}
        <div className="mb-2">
          <p className="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 hidden md:group-hover/nav:block">
            Main
          </p>
        </div>
        {mainNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center space-x-3 px-3 md:px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-white text-blue-900 shadow-lg border border-blue-300"
                  : "text-blue-800 hover:bg-blue-100 hover:text-blue-900"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform",
                isActive ? "text-blue-700 scale-110" : "text-blue-500 group-hover:text-blue-700"
              )} />
              <span className="flex-1 hidden md:group-hover/nav:inline">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 animate-pulse text-blue-700" />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-700 rounded-r-full"></div>
              )}
            </Link>
          );
        })}

        {/* Customer Admin Navigation */}
        {(isCustomerAdmin || isSuperAdmin) && (
          <>
            <div className="pt-6 pb-2">
              <p className="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 hidden md:group-hover/nav:block">
                Administration
              </p>
            </div>
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative",
                    isActive
                      ? "bg-white text-blue-900 shadow-lg border border-blue-300"
                      : "text-blue-800 hover:bg-blue-100 hover:text-blue-900"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform",
                    isActive ? "text-blue-700 scale-110" : "text-blue-500 group-hover:text-blue-700"
                  )} />
                  <span className="flex-1 hidden md:group-hover/nav:inline">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 animate-pulse text-blue-700" />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-700 rounded-r-full"></div>
                  )}
                </Link>
              );
            })}
          </>
        )}

        {/* Super Admin Navigation */}
        {isSuperAdmin && (
          <>
            <div className="pt-6 pb-2">
              <p className="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 hidden md:group-hover/nav:block">
                Super Admin
              </p>
            </div>
            {superAdminNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative",
                    isActive
                      ? "bg-white text-blue-900 shadow-lg border border-blue-300"
                      : "text-blue-800 hover:bg-blue-100 hover:text-blue-900"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform",
                    isActive ? "text-blue-700 scale-110" : "text-blue-500 group-hover:text-blue-700"
                  )} />
                  <span className="flex-1 hidden md:group-hover/nav:inline">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 animate-pulse text-blue-700" />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-700 rounded-r-full"></div>
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="relative z-10 p-4 border-t border-blue-200/60 bg-white/70 backdrop-blur hidden md:group-hover/nav:block">
        <Button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          variant="ghost"
          className="w-full justify-start text-blue-800 hover:text-blue-900 hover:bg-blue-100 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span className="font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  );
}
