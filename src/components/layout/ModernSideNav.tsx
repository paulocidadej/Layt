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
  { name: "Data Management", href: "/data", icon: Database },
];

const adminNavigation = [
  { name: "User Management", href: "/customer-admin/users", icon: Users },
];

const superAdminNavigation = [
  { name: "Customers", href: "/admin/customers", icon: Building2 },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function ModernSideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const isSuperAdmin = role === "super_admin";
  const isCustomerAdmin = role === "customer_admin";

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-ocean-700 via-ocean-600 to-teal-600 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 wave-pattern opacity-5"></div>
      
      {/* Animated Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl"></div>

      {/* Logo Section */}
      <div className="relative z-10 flex h-20 items-center justify-between px-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5 shadow-lg border border-white/10">
            <Anchor className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Laytime</h1>
            <p className="text-xs text-white/70 font-medium">Platform</p>
          </div>
        </div>
        <div className="hidden md:block">
          <Waves className="w-5 h-5 text-white/30" />
        </div>
      </div>

      {/* User Info */}
      {session && (
        <div className="relative z-10 px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              <span className="text-sm font-bold">
                {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-white/70 truncate">
                {session.user.tenant?.name || "No Tenant"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {/* Main Navigation */}
        <div className="mb-2">
          <p className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Main
          </p>
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/20"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className="flex-1">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 animate-pulse" />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
              )}
            </Link>
          );
        })}

        {/* Customer Admin Navigation */}
        {(isCustomerAdmin || isSuperAdmin) && (
          <>
            <div className="pt-6 pb-2">
              <p className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
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
                      ? "bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/20"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110"
                  )} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 animate-pulse" />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
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
              <p className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
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
                      ? "bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/20"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110"
                  )} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 animate-pulse" />
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="relative z-10 p-4 border-t border-white/10 bg-white/5 backdrop-blur-sm">
        <Button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          variant="ghost"
          className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span className="font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  );
}
