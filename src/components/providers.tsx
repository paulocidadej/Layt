"use client";

import { SessionProvider } from "next-auth/react";
import { TenantProvider } from "@/lib/tenant-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TenantProvider>
        {children}
      </TenantProvider>
    </SessionProvider>
  );
}

