"use client";

import { useSession } from "next-auth/react";
import { useTenant } from "@/lib/tenant-context";
import { 
  Ship, 
  FileText, 
  DollarSign, 
  TrendingUp,
  Waves,
  Anchor,
  Navigation,
  BarChart3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { tenantId } = useTenant();
  const [stats, setStats] = useState({
    totalVoyages: 0,
    totalClaims: 0,
    activeClaims: 0,
    totalAmount: 0,
    recentVoyages: [] as any[],
    recentClaims: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    async function loadStats() {
      try {
        const { count: voyagesCount } = await supabase
          .from("voyages")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

        const { count: claimsCount } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

        const { count: activeClaimsCount } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("claim_status", "in_progress");

        const { data: claimsData } = await supabase
          .from("claims")
          .select("amount_in_discussion")
          .eq("tenant_id", tenantId);

        const totalAmount = claimsData?.reduce(
          (sum, claim) => sum + (claim.amount_in_discussion || 0),
          0
        ) || 0;

        const { data: recentVoyages } = await supabase
          .from("voyages")
          .select("voyage_reference, vessel_id, created_at, vessels(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5);

        const { data: recentClaims } = await supabase
          .from("claims")
          .select("claim_reference, claim_status, amount_in_discussion, amount_type, created_at, voyages(voyage_reference)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5);

        setStats({
          totalVoyages: voyagesCount || 0,
          totalClaims: claimsCount || 0,
          activeClaims: activeClaimsCount || 0,
          totalAmount,
          recentVoyages: recentVoyages || [],
          recentClaims: recentClaims || [],
        });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [tenantId]);

  const statCards = [
    {
      title: "Total Voyages",
      value: stats.totalVoyages,
      icon: Ship,
      color: "from-ocean-500 to-ocean-600",
      bgColor: "bg-ocean-50",
      iconColor: "text-ocean-600",
      change: "+12%",
      description: "Active voyages",
    },
    {
      title: "Total Claims",
      value: stats.totalClaims,
      icon: FileText,
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-50",
      iconColor: "text-teal-600",
      change: "+8%",
      description: "All claims",
    },
    {
      title: "Active Claims",
      value: stats.activeClaims,
      icon: Navigation,
      color: "from-amber-500 to-amber-600",
      bgColor: "bg-amber-50",
      iconColor: "text-amber-600",
      change: "+5%",
      description: "In progress",
    },
    {
      title: "Amount in Discussion",
      value: `$${stats.totalAmount.toLocaleString()}`,
      icon: DollarSign,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      change: "+15%",
      description: "Total value",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="text-center">
          <div className="relative">
            <Waves className="w-16 h-16 text-ocean-500 animate-wave mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-ocean-200 border-t-ocean-500 rounded-full animate-spin"></div>
            </div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ocean-600 via-cyan-500 to-teal-400 p-8 text-white shadow-maritime-lg">
        <div className="absolute inset-0 wave-pattern opacity-20"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <Anchor className="w-8 h-8" />
            <h1 className="text-4xl font-bold">Welcome Aboard</h1>
          </div>
          <p className="text-xl text-white/90 mb-2">
            {session?.user?.name || session?.user?.email}
          </p>
          <p className="text-white/80">
            {session?.user?.tenant?.name || "Laytime & Demurrage Management Platform"}
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-48 h-48 bg-teal-300/20 rounded-full blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="group maritime-card p-6 hover:scale-[1.02] transition-transform duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${stat.bgColor} rounded-xl p-3 group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              <div className="flex items-center text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3 mr-1" />
                {stat.change}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/voyages"
          className="maritime-card p-6 group hover:scale-[1.02] transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-ocean-500 to-ocean-600 rounded-xl p-4 text-white">
              <Ship className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-ocean-600 transition-colors">
                Create Voyage
              </h3>
              <p className="text-sm text-gray-500">Add a new voyage</p>
            </div>
          </div>
        </Link>

        <Link
          href="/claims"
          className="maritime-card p-6 group hover:scale-[1.02] transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                Create Claim
              </h3>
              <p className="text-sm text-gray-500">Start a new claim</p>
            </div>
          </div>
        </Link>

        <Link
          href="/data"
          className="maritime-card p-6 group hover:scale-[1.02] transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
                Manage Data
              </h3>
              <p className="text-sm text-gray-500">Update lookup fields</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Voyages */}
        <div className="maritime-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Ship className="w-5 h-5 text-ocean-600" />
              <h2 className="text-lg font-bold text-gray-900">Recent Voyages</h2>
            </div>
            <Link 
              href="/voyages" 
              className="text-sm font-medium text-ocean-600 hover:text-ocean-700 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentVoyages.length === 0 ? (
              <div className="text-center py-12">
                <Ship className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-2">No voyages yet</p>
                <Link
                  href="/voyages"
                  className="text-sm font-medium text-ocean-600 hover:text-ocean-700"
                >
                  Create your first voyage →
                </Link>
              </div>
            ) : (
              stats.recentVoyages.map((voyage: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-ocean-50/50 to-teal-50/50 border border-ocean-100 hover:border-ocean-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-ocean-100 rounded-lg p-2 group-hover:bg-ocean-200 transition-colors">
                      <Ship className="w-5 h-5 text-ocean-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-ocean-600 transition-colors">
                        {voyage.voyage_reference}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {voyage.vessels?.name || "No vessel assigned"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-600">
                      {new Date(voyage.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Claims */}
        <div className="maritime-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-bold text-gray-900">Recent Claims</h2>
            </div>
            <Link 
              href="/claims" 
              className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentClaims.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-2">No claims yet</p>
                <Link
                  href="/claims"
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  Create your first claim →
                </Link>
              </div>
            ) : (
              stats.recentClaims.map((claim: any, index: number) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all group ${
                    claim.amount_type === "demurrage"
                      ? "bg-gradient-to-r from-red-50/50 to-pink-50/50 border-red-100 hover:border-red-200"
                      : "bg-gradient-to-r from-green-50/50 to-emerald-50/50 border-green-100 hover:border-green-200"
                  } hover:shadow-md`}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`rounded-lg p-2 transition-colors ${
                        claim.amount_type === "demurrage"
                          ? "bg-red-100 group-hover:bg-red-200"
                          : "bg-green-100 group-hover:bg-green-200"
                      }`}
                    >
                      <FileText
                        className={`w-5 h-5 ${
                          claim.amount_type === "demurrage"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {claim.claim_reference}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {claim.voyages?.voyage_reference || "No voyage"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        claim.amount_type === "demurrage"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      ${claim.amount_in_discussion?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {claim.claim_status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
