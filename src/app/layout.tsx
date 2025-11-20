import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { ModernSideNav } from "@/components/layout/ModernSideNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Laytime Platform",
  description: "Laytime and Demurrage Calculation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-50`}>
        <Providers>
          <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
            <div className="w-full flex-none md:w-64">
              <ModernSideNav />
            </div>
            <div className="flex-grow md:overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
              <div className="p-6 md:p-8 lg:p-12">
                {children}
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
