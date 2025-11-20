"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface TenantContextType {
  tenantId: string | null;
  tenant: any | null;
  role: string | null;
  isSuperAdmin: boolean;
  isCustomerAdmin: boolean;
  isOperator: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  tenant: null,
  role: null,
  isSuperAdmin: false,
  isCustomerAdmin: false,
  isOperator: false,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const value: TenantContextType = {
    tenantId: session?.user?.tenantId || null,
    tenant: session?.user?.tenant || null,
    role: session?.user?.role || null,
    isSuperAdmin: session?.user?.role === "super_admin",
    isCustomerAdmin: session?.user?.role === "customer_admin",
    isOperator: session?.user?.role === "operator",
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return context;
}

