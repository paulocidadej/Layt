"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CreateClaimDialog } from "./CreateClaimDialog";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Search } from "lucide-react";

type Claim = {
  id: string;
  claim_reference: string;
  claim_status: string;
  qc_reviewer_id?: string | null;
  qc_reviewer?: { full_name?: string | null } | null;
  operation_type?: string | null;
  port_name?: string | null;
  laycan_start?: string | null;
  laycan_end?: string | null;
  created_at: string;
  voyages: { voyage_reference: string | null } | null;
  tenant_id?: string;
};

type Voyage = { id: string; voyage_reference: string; tenant_id?: string | null; cargo_quantity?: number | null; cargo_names?: { name: string | null } | null; charter_parties?: { name: string | null } | null };
type Tenant = { id: string; name: string };

export default function ClaimsClient({
  claims,
  voyages,
  search,
  isSuperAdmin,
  tenantIdFilter,
  defaultVoyageId,
  defaultPortCallId,
  openCreate,
}: {
  claims: Claim[];
  voyages: Voyage[];
  search: string;
  isSuperAdmin: boolean;
  tenantIdFilter?: string;
  defaultVoyageId?: string;
  defaultPortCallId?: string;
  openCreate?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(search || "");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantValue, setTenantValue] = useState(tenantIdFilter || "");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reviewerFilter, setReviewerFilter] = useState<string>("");

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/admin/tenants")
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data) => setTenants(data.tenants || []))
        .catch(() => setTenants([]));
    }
  }, [isSuperAdmin]);

  // If super_admin and a default voyage is provided, or only one tenant exists, preselect tenant to enable Create Claim
  useEffect(() => {
    if (!isSuperAdmin) return;
    const params = new URLSearchParams(searchParams || undefined);
    if (!tenantValue && defaultVoyageId) {
      const v = voyages.find((voy) => voy.id === defaultVoyageId && (voy as any).tenant_id);
      if (v && (v as any).tenant_id) {
        setTenantValue((v as any).tenant_id);
        params.set("tenantId", (v as any).tenant_id);
        router.replace(`${pathname}?${params.toString()}`);
        return;
      }
    }
    if (!tenantValue && tenants.length === 1) {
      setTenantValue(tenants[0].id);
      params.set("tenantId", tenants[0].id);
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }
    if (!tenantValue && voyages.length > 0 && (voyages[0] as any).tenant_id) {
      setTenantValue((voyages[0] as any).tenant_id);
      params.set("tenantId", (voyages[0] as any).tenant_id);
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }
  }, [isSuperAdmin, tenantValue, defaultVoyageId, voyages, tenants, router, pathname, searchParams]);

  // Clear openCreate param after initial use to avoid reopening
  useEffect(() => {
    if (openCreate) {
      const params = new URLSearchParams(searchParams || undefined);
      params.delete("openCreate");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [openCreate, router, pathname, searchParams]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    const params = new URLSearchParams(searchParams || undefined);
    params.set("q", e.target.value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleTenantChange = (value: string) => {
    const parsed = value === "all" ? "" : value;
    setTenantValue(parsed);
    const params = new URLSearchParams(searchParams || undefined);
    if (parsed) params.set("tenantId", parsed); else params.delete("tenantId");
    router.push(`${pathname}?${params.toString()}`);
  };

  const reviewers = Array.from(
    new Map(
      claims
        .filter((c) => c.qc_reviewer_id && c.qc_reviewer?.full_name)
        .map((c) => [c.qc_reviewer_id as string, c.qc_reviewer?.full_name || "Reviewer"])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(d);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/70 backdrop-blur rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Claims</h1>
          <p className="text-sm text-slate-600">Track laytime/demurrage claims and jump into calculators.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {isSuperAdmin && (
            <Select value={tenantValue || "all"} onValueChange={handleTenantChange}>
              <SelectTrigger className="w-48 bg-white border-slate-200">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1">
            <Input
              placeholder="Search by claim reference..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-[#1f5da8] bg-white shadow-sm"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40 bg-white border-slate-200">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="for_qc">For QC</SelectItem>
              <SelectItem value="qc_in_progress">QC in Progress</SelectItem>
              <SelectItem value="pending_reply">Pending Reply</SelectItem>
              <SelectItem value="missing_information">Missing Information</SelectItem>
              <SelectItem value="pending_counter_check">Pending Counter Check</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewerFilter || "all"} onValueChange={(v) => setReviewerFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48 bg-white border-slate-200">
              <SelectValue placeholder="All reviewers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviewers</SelectItem>
              {reviewers.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CreateClaimDialog
            voyages={voyages}
            tenantId={tenantValue}
            isSuperAdmin={isSuperAdmin}
            defaultVoyageId={defaultVoyageId}
            defaultPortCallId={defaultPortCallId}
            initialOpen={openCreate}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur">
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Voyage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Operation / Port</TableHead>
              <TableHead>Laycan</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-6">
                  No claims yet. Create your first claim.
                </TableCell>
              </TableRow>
            )}
            {claims
              .filter((c) => (statusFilter ? c.claim_status === statusFilter : true))
              .filter((c) => (reviewerFilter ? c.qc_reviewer_id === reviewerFilter : true))
              .map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="font-semibold text-slate-900">
                  <Link href={`/claims/${claim.id}/calculation`} className="text-[#1f5da8] hover:text-[#0f3c7a]">
                    {claim.claim_reference}
                  </Link>
                </TableCell>
                <TableCell className="text-slate-700">{claim.voyages?.voyage_reference || "—"}</TableCell>
                <TableCell className="text-slate-700">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 border border-slate-200">
                    {claim.claim_status.replace("_", " ")}
                  </span>
                  {claim.qc_reviewer_id && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-50 border border-blue-100 text-blue-700 ml-2">
                      {claim.qc_reviewer?.full_name || "Reviewer"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {claim.operation_type || "—"} {claim.port_name ? ` / ${claim.port_name}` : ""}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {formatDate(claim.laycan_start)}
                  {claim.laycan_end ? ` → ${formatDate(claim.laycan_end)}` : ""}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {formatDate(claim.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/claims/${claim.id}/calculation`} className="text-[#1f5da8] hover:text-[#0f3c7a] font-semibold flex items-center gap-1 justify-end">
                    <CalendarIcon className="w-4 h-4" />
                    Calculator
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                    onClick={async () => {
                      if (!confirm("Delete this claim?")) return;
                      try {
                        const res = await fetch(`/api/claims/${claim.id}`, { method: "DELETE" });
                        if (!res.ok) {
                          const j = await res.json().catch(() => ({}));
                          throw new Error(j.error || "Failed to delete");
                        }
                        router.refresh();
                      } catch (e: any) {
                        alert(e.message || "Delete failed");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
