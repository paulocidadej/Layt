import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      tenantId: string;
      tenant?: {
        id: string;
        name: string;
        slug: string;
      };
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    tenantId: string;
    tenant?: any;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
    tenant?: any;
  }
}

