"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SofExtractEvent, SofExtractResult } from "@/lib/sof-extractor";
const ENABLE_LOCAL_OCR = process.env.NEXT_PUBLIC_ENABLE_LOCAL_OCR === "true";
const ENABLE_LOCAL_RASTER = process.env.NEXT_PUBLIC_ENABLE_TESSERACT_RASTER === "true";
import { buildStatementSnapshot } from "@/lib/laytime-summary";
import { canonicalMappings, mapCanonicalEvent } from "@/lib/sof-mapper";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Sof extractor tab extracted to a standalone client component to avoid parse issues with inline definitions.
import SofExtractorTab from "./SofExtractorTab";

type Claim = {
  id: string;
  tenant_id: string;
  claim_reference: string;
  demurrage_rate?: number | null;
  demurrage_currency?: string | null;
  demurrage_after_hours?: number | null;
  demurrage_rate_after?: number | null;
  despatch_rate_value?: number | null;
  despatch_currency?: string | null;
  despatch_type?: string | null;
  operation_type?: string | null;
  port_name?: string | null;
  laycan_start?: string | null;
  laycan_end?: string | null;
  claim_status?: string | null;
  load_discharge_rate?: number | null;
  load_discharge_rate_unit?: string | null;
  fixed_rate_duration_hours?: number | null;
  reversible?: boolean | null;
  reversible_scope?: string | null;
  reversible_pool_ids?: string[] | null;
  port_call_id?: string | null;
  qc_status?: string | null;
  qc_reviewer_id?: string | null;
  qc_notes?: string | null;
  laytime_start?: string | null;
  laytime_end?: string | null;
  nor_tendered_at?: string | null;
  nor_accepted_at?: string | null;
  loading_start_at?: string | null;
  loading_end_at?: string | null;
  turn_time_method?: string | null;
  clause_profile?: any;
  cp_id?: string | null;
  voyages?: {
    cargo_quantity?: number | null;
    cargo_names?: { name?: string | null } | null;
    charter_parties?: { name?: string | null } | null;
  } | null;
  term_id?: string | null;
  port_calls?: { id: string; port_name?: string | null; activity?: string | null; sequence?: number | null; allowed_hours?: number | null }[] | null;
  contract_label?: string | null;
};

type EventRow = {
  id: string;
  deduction_name: string;
  from_datetime: string;
  to_datetime: string;
  rate_of_calculation: number;
  time_used: number;
  port_call_id?: string | null;
  port_calls?: { port_name?: string | null; activity?: string | null } | null;
};

type Attachment = {
  id: string;
  claim_id: string;
  attachment_type: string;
  filename: string;
  file_url: string;
  file_size?: number;
  created_at?: string;
};

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  data: any;
};

type Comment = {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  users?: { full_name?: string | null } | null;
};

type TimeFormat = "dhms" | "decimal";

type SiblingSummary = {
  claim_id: string;
  claim_reference?: string | null;
  port_call_id: string | null;
  port_name?: string | null;
  activity?: string | null;
  sequence?: number | null;
  allowed: number | null;
  base_hours: number;
  deductions: number;
  used: number;
};

const claimStatusOptions = [
  { value: "created", label: "Created" },
  { value: "in_progress", label: "In Progress" },
  { value: "for_qc", label: "For QC" },
  { value: "qc_in_progress", label: "QC in Progress" },
  { value: "pending_reply", label: "Pending Reply" },
  { value: "missing_information", label: "Missing Information" },
  { value: "pending_counter_check", label: "Pending Counter Check" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
};

function durationHours(from: string, to: string, rate: number) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const hours = (end - start) / (1000 * 60 * 60);
  const multiplier = Number.isFinite(rate) ? rate / 100 : 1;
  return +(hours * multiplier).toFixed(2);
};

function formatHours(hours: number, mode: TimeFormat) {
  if (!Number.isFinite(hours)) return "—";
  if (mode === "decimal") {
    return `${(hours / 24).toFixed(3)} days`;
  }
  const totalSeconds = Math.round(hours * 3600);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function currency(amount?: number | null, code = "USD") {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
}

const toInputValue = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function deriveLaytimeStartFromClause({
  baseValue,
  working,
  norOffset,
  startNextWorkingPeriod,
  holidayWindows,
}: {
  baseValue?: string | null;
  working: string;
  norOffset: number;
  startNextWorkingPeriod: boolean;
  holidayWindows: { start: string; end: string }[];
}) {
  if (!baseValue) return null;
  const base = new Date(baseValue);
  if (Number.isNaN(base.getTime())) return null;
  let start = new Date(base.getTime() + norOffset * 60 * 60 * 1000);
  if (!startNextWorkingPeriod) return start.toISOString();
  const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
  const inHoliday = (d: Date) => {
    if (holidayWindows.length === 0) return false;
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    const dayEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
    return holidayWindows.some((h) => {
      const hs = new Date(h.start).getTime();
      const he = new Date(h.end).getTime();
      if (Number.isNaN(hs) || Number.isNaN(he)) return false;
      return Math.max(dayStart, hs) <= Math.min(dayEnd, he);
    });
  };
  while (working === "SHEX" && (isWeekend(start) || inHoliday(start))) {
    start = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  return start.toISOString();
}

function AddEventForm({
  onAdd,
  onUpdate,
  editing,
  clearEdit,
  loading,
  portCalls,
  claimPortCallId,
  countRules,
}: {
  onAdd: (payload: Omit<EventRow, "id" | "time_used">) => Promise<void>;
  onUpdate: (id: string, payload: Omit<EventRow, "id" | "time_used">) => Promise<void>;
  editing: EventRow | null;
  clearEdit: () => void;
  loading: boolean;
  portCalls: { id: string; port_name: string; activity?: string | null }[];
  claimPortCallId?: string | null;
  countRules?: Record<string, any>;
}) {
  const [deduction, setDeduction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [portCallId, setPortCallId] = useState<string>("none");
  const [ratePercent, setRatePercent] = useState<number>(100);

  const normalizeRuleToPercent = (rule: any) => {
    if (!rule || rule === "FULL") return 100;
    if (rule === "HALF") return 50;
    if (rule === "NONE") return 0;
    if (typeof rule === "number") {
      return Number.isFinite(rule) ? rule : 100;
    }
    if (typeof rule === "object" && rule.percent !== undefined) {
      const p = Number(rule.percent);
      return Number.isFinite(p) ? p : 100;
    }
    return 100;
  };

  useEffect(() => {
    if (editing) {
      setDeduction(editing.deduction_name);
      setFrom(toInputValue(editing.from_datetime));
      setTo(toInputValue(editing.to_datetime));
      setPortCallId(editing.port_call_id || "none");
      setRatePercent(editing.rate_of_calculation ?? 100);
    } else {
      setDeduction("");
      setFrom("");
      setTo("");
      setPortCallId("none");
      setRatePercent(100);
      if (claimPortCallId) setPortCallId(claimPortCallId);
    }
  }, [editing, claimPortCallId]);

  useEffect(() => {
    if (!deduction || editing) return;
    const key = deduction.toLowerCase().trim();
    let rule = countRules?.[key];
    if (!rule && countRules) {
      const matchKey = Object.keys(countRules).find((k) => key.includes(k));
      if (matchKey) rule = countRules[matchKey];
    }
    if (!rule) return;
    setRatePercent((prev) => (prev === 100 ? normalizeRuleToPercent(rule) : prev));
  }, [deduction, countRules, editing]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!deduction || !from || !to) {
      setError("All fields are required.");
      return;
    }
    if (editing) {
      await onUpdate(editing.id, {
        deduction_name: deduction,
        from_datetime: from,
        to_datetime: to,
        rate_of_calculation: ratePercent,
        port_call_id: portCallId === "none" ? null : portCallId,
      });
    } else {
      await onAdd({
        deduction_name: deduction,
        from_datetime: from,
        to_datetime: to,
        rate_of_calculation: ratePercent,
        port_call_id: portCallId === "none" ? null : portCallId,
      });
    }
  };

  return (
    <div className="p-4 border border-blue-100 shadow-sm bg-white rounded-xl">
      <form onSubmit={handleSubmit} className="grid md:grid-cols-6 gap-3 items-end">
        <div className="space-y-1 md:col-span-2">
          <Label>Event</Label>
          <Input
            placeholder="Rain / Hoses connected / Gangway down"
            value={deduction}
            onChange={(e) => setDeduction(e.target.value)}
          />
        </div>
        {!claimPortCallId && (
          <div className="space-y-1">
            <Label>Port Call</Label>
            <Select value={portCallId} onValueChange={(v: any) => setPortCallId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="All / Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All / Unassigned</SelectItem>
                {portCalls.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>
                    {pc.port_name} ({pc.activity || "other"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>From</Label>
          <Input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Count %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={ratePercent}
            onChange={(e) => setRatePercent(Number(e.target.value || 0))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={loading}>
            <Plus className="w-4 h-4 mr-1" />
            {editing ? "Update Event" : "Add Event"}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={clearEdit}>
              Cancel
            </Button>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>
    </div>
  );
};

function Summary({
  events,
  claim,
  timeFormat,
  siblings,
  manualDeductions = [],
  manualAdditions = [],
}: {
  events: EventRow[];
  claim: Claim;
  timeFormat: TimeFormat;
  siblings?: SiblingSummary[];
  manualDeductions?: EventRow[];
  manualAdditions?: EventRow[];
}) {
  const [pooledIds, setPooledIds] = useState<string[]>([]);
  const [savingPool, setSavingPool] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasInitializedPool = useRef(false);
  const lastSavedIds = useRef<string[]>([]);
  const [poolDirty, setPoolDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "breakdown">("summary");

  const idsEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size !== setB.size) return false;
    const values = Array.from(setA);
    for (let i = 0; i < values.length; i += 1) {
      if (!setB.has(values[i])) return false;
    }
    return true;
  };

  const scopeAllows = (activity?: string | null) => {
    if (!claim.reversible_scope || claim.reversible_scope === "all_ports") return true;
    if (claim.reversible_scope === "load_only") return activity === "load";
    if (claim.reversible_scope === "discharge_only") return activity === "discharge";
    return true;
  };

  const isInScope = (ev: EventRow) => {
    if (!claim.reversible) {
      if (claim.port_call_id) {
        return ev.port_call_id === claim.port_call_id || !ev.port_call_id;
      }
      return !ev.port_call_id;
    }
    const act = ev.port_calls?.activity;
    if (!act) return true; // keep untagged events
    if (!claim.reversible_scope || claim.reversible_scope === "all_ports") return true;
    if (claim.reversible_scope === "load_only") return act === "load";
    if (claim.reversible_scope === "discharge_only") return act === "discharge";
    return true;
  };

  const laytimeStart = claim.laytime_start ?? null;
  const laytimeEnd = claim.laytime_end ?? null;
  const allPorts = claim.port_calls || [];
  // Ports in scope for reversible setting (used for totals/allowance)
  const scopedPorts = allPorts.filter((pc) => scopeAllows(pc.activity));
  const portsForTotals = scopedPorts.length > 0 ? scopedPorts : allPorts;

  const scopedEvents = events.filter(isInScope);

  const deductionsByPort: Record<string, number> = {};
  const addHours = (key: string, hours: number) => {
    deductionsByPort[key] = (deductionsByPort[key] || 0) + hours;
  };
  // Auto deductions are disabled for now; only manual deductions/additions affect buckets.
  (manualDeductions || []).filter((ev) => isInScope(ev)).forEach((ev) => addHours(ev.port_call_id || "unassigned", ev.time_used || 0));
  (manualAdditions || []).filter((ev) => isInScope(ev)).forEach((ev) => addHours(ev.port_call_id || "unassigned", -(ev.time_used || 0)));
  Object.keys(deductionsByPort).forEach((k) => {
    if (deductionsByPort[k] < 0) deductionsByPort[k] = 0;
  });
  const totalDeductionsAll = Math.max(Object.values(deductionsByPort).reduce((a, b) => a + (b || 0), 0), 0);
  const scopedManualDeductions = (manualDeductions || []).filter((ev) => isInScope(ev));
  const scopedManualAdditions = (manualAdditions || []).filter((ev) => isInScope(ev));
  const manualDeductionHours = scopedManualDeductions.reduce((acc, ev) => acc + (ev.time_used || 0), 0);
  const manualAdditionHours = scopedManualAdditions.reduce((acc, ev) => acc + (ev.time_used || 0), 0);
  const autoDeductionHours = 0; // disabled

  const baseSpanHours = (() => {
    if (laytimeStart && laytimeEnd) {
      const start = new Date(laytimeStart).getTime();
      const end = new Date(laytimeEnd).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        return (end - start) / 3600000;
      }
    }
    return 0;
  })();

  // Siblings in scope (by activity), regardless of port_call_id presence
  const scopedSiblings = (siblings || []).filter((s) => scopeAllows(s.activity));
  const inScopeIds = scopedSiblings.map((s) => s.claim_id);

  useEffect(() => {
    if (!claim.reversible) {
      setPooledIds([]);
      lastSavedIds.current = [];
      setPoolDirty(false);
      return;
    }
    const persisted = Array.isArray(claim.reversible_pool_ids) ? claim.reversible_pool_ids : [];
    const filtered = persisted.filter((id) => inScopeIds.includes(id));
    const next = Array.from(new Set([claim.id, ...filtered]));
    setPooledIds(next);
    lastSavedIds.current = next;
    setPoolDirty(false);
    hasInitializedPool.current = true;
  }, [claim.id, claim.reversible, claim.reversible_pool_ids, inScopeIds.join(",")]);

  useEffect(() => {
    if (!claim.reversible) return;
    if (!hasInitializedPool.current) return;
    if (!poolDirty) return;
    if (idsEqual(pooledIds, lastSavedIds.current)) return;
    setSavingPool(true);
    setSaveError(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/claims/${claim.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reversible_pool_ids: pooledIds }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = j.error || res.statusText || "Failed to persist pooling";
          console.error("Failed to persist pooling", msg);
          setSaveError(msg);
          setPoolDirty(true);
          return;
        }
        const serverIds = Array.isArray(j?.reversible_pool_ids) ? j.reversible_pool_ids : [];
        if (Array.isArray(j?.invalid_ids) && j.invalid_ids.length > 0) {
          setSaveError("Some claims were skipped because they are not in this voyage.");
        }
        if (serverIds.includes(claim.id) && idsEqual(serverIds, pooledIds)) {
          // Server echoed exactly what we sent
          lastSavedIds.current = serverIds;
          setPoolDirty(false);
        } else if (serverIds.includes(claim.id) && serverIds.length >= pooledIds.length) {
          // Server returned a superset/subset; adopt server but keep saved state
          setPooledIds(serverIds);
          lastSavedIds.current = serverIds;
          setPoolDirty(false);
          if (!idsEqual(serverIds, pooledIds)) {
            setSaveError("Pooling saved with adjustments from server.");
          }
        } else {
          // Unexpected missing ids; keep user selection as saved to avoid flicker, but warn
          setPooledIds(pooledIds);
          lastSavedIds.current = pooledIds;
          setPoolDirty(false);
          setSaveError("Pooling save returned no data. Selection kept locally; please verify.");
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error("Failed to persist pooling", e);
          setSaveError(e?.message || "Failed to persist pooling");
          setPoolDirty(true);
        }
      } finally {
        setSavingPool(false);
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
    };
  }, [pooledIds, claim.id, claim.reversible]);

  const togglePool = (id: string) => {
    if (!claim.reversible) return;
    setPooledIds((prev) => {
      const base = prev.includes(claim.id) ? prev.slice() : [claim.id, ...prev];
      let next = base;
      if (id !== claim.id) {
        next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      }
      next = next.filter((x) => inScopeIds.includes(x));
      if (!next.includes(claim.id) && inScopeIds.includes(claim.id)) next.unshift(claim.id);
      setPoolDirty(true);
      return next;
    });
  };

  const selectedSiblings = claim.reversible
    ? scopedSiblings.filter((s) => pooledIds.includes(s.claim_id))
    : [];
  const selfSummary = scopedSiblings.find((s) => s.claim_id === claim.id);
  const effectiveSiblings =
    claim.reversible && selectedSiblings.length > 0
      ? selectedSiblings
      : claim.reversible && selfSummary
      ? [selfSummary]
      : [];

  const fallbackAllowed = (() => {
    const cargoQty = claim.voyages?.cargo_quantity || 0;
    if (!claim.load_discharge_rate || claim.load_discharge_rate <= 0) return 0;
    if (claim.load_discharge_rate_unit === "per_hour") return cargoQty / (claim.load_discharge_rate || 1);
    if (claim.load_discharge_rate_unit === "fixed_duration") return claim.fixed_rate_duration_hours || 0;
    return (cargoQty / (claim.load_discharge_rate || 1)) * 24;
  })();

  const primaryPort = claim.port_call_id
    ? allPorts.find((p) => p.id === claim.port_call_id)
    : allPorts[0];

  const totalAllowed = claim.reversible
    ? (effectiveSiblings.length > 0
        ? Math.max(effectiveSiblings.reduce((acc, s) => acc + (s.allowed || 0), 0), 0)
        : fallbackAllowed)
    : primaryPort && primaryPort.allowed_hours !== null && primaryPort.allowed_hours !== undefined
    ? Number(primaryPort.allowed_hours)
    : fallbackAllowed;

  const fallbackUsed = (() => {
    if (baseSpanHours > 0) {
      return Math.max(baseSpanHours - totalDeductionsAll, 0);
    }
    return totalDeductionsAll;
  })();

  // Once on demurrage rule: if the laytime span already exceeds allowed, stop pausing time (all remaining counts)
  const onceOnDemurrage = baseSpanHours > 0 && totalAllowed !== null && totalAllowed >= 0 && baseSpanHours > totalAllowed;
  const usedWithRule = onceOnDemurrage ? baseSpanHours : fallbackUsed;

  const totalUsed = claim.reversible
    ? (effectiveSiblings.length > 0
        ? Math.max(effectiveSiblings.reduce((acc, s) => acc + (s.used || 0), 0), 0)
        : usedWithRule)
    : usedWithRule;

  const timeOver = totalAllowed - totalUsed;

  const demRate = claim.demurrage_rate || 0;
  const despatchRate =
    claim.despatch_type === "percent"
      ? demRate * ((claim.despatch_rate_value || 0) / 100)
      : claim.despatch_rate_value || 0;

  const demurrage =
    timeOver !== null && timeOver < 0 ? Math.abs(timeOver) * (demRate / 24) : 0;
  const despatch =
    timeOver !== null && timeOver > 0 ? timeOver * (despatchRate / 24) : 0;

  // Build per-port breakdown (only for reversible claims)
  const breakdown = (() => {
    if (!claim.reversible) return [];

    // Only show ports that belong to pooled claims (or the current claim), to avoid unrelated ports leaking in
    const pooledPortIds = new Set(
      effectiveSiblings
        .map((s) => s.port_call_id)
        .filter((id): id is string => !!id),
    );
    const ordered = scopedPorts
      .filter((pc) => pooledPortIds.size === 0 || pooledPortIds.has(pc.id))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const rows = ordered.map((pc) => {
      const sibling =
        effectiveSiblings.find((s) => s.claim_id === claim.id && s.port_call_id === pc.id) ||
        effectiveSiblings.find((s) => s.port_call_id === pc.id) ||
        effectiveSiblings.find((s) => !s.port_call_id && (!s.activity || s.activity === pc.activity));
      if (!sibling) {
        return {
          id: pc.id,
          label: pc.port_name || "Port",
          activity: pc.activity || "",
          allowed: null,
          base: 0,
          deductions: 0,
          used: 0,
          inScope: true,
          overUnder: null,
          note: "Claim not created yet",
        };
      }
      const overUnder =
        sibling.allowed !== null && sibling.allowed !== undefined
          ? (sibling.allowed || 0) - (sibling.used || 0)
          : null;

      return {
        id: pc.id,
        label: pc.port_name || "Port",
        activity: pc.activity || "",
        allowed: sibling.allowed,
        base: sibling.base_hours,
        deductions: sibling.deductions,
        used: sibling.used,
        inScope: true,
        overUnder,
        note: undefined,
      };
    });

    if (deductionsByPort["unassigned"]) {
      rows.push({
        id: "unassigned",
        label: "Unassigned events",
        activity: "",
        allowed: null,
        base: 0,
        deductions: deductionsByPort["unassigned"],
        used: deductionsByPort["unassigned"],
        inScope: true,
        overUnder: null,
        note: undefined,
      });
    }
    return rows;
  })();

  return (
    <div className="space-y-4">
      {claim.reversible && scopedSiblings.length > 0 && (
        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">Reversible pooling</p>
          <p className="text-xs text-slate-600">
            Select which claims in this voyage to include when pooling allowed/used time. The current claim stays selected.
          </p>
          {savingPool && <p className="text-xs text-amber-700 mt-1">Saving selection…</p>}
          {saveError && <p className="text-xs text-red-700 mt-1">Pool save failed: {saveError}</p>}
          <div className="flex flex-wrap gap-3 mt-2">
            {scopedSiblings.map((s) => (
              <label key={s.claim_id} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={pooledIds.includes(s.claim_id)}
                  onCheckedChange={() => togglePool(s.claim_id)}
                  disabled={s.claim_id === claim.id}
                />
                <span>
                  {s.claim_reference || s.port_name || "Claim"} {s.activity ? `(${s.activity})` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-[#123b7a0d] via-white to-white border border-[#123b7a1f] rounded-xl shadow-sm">
          <p className="text-sm text-[#123b7a] font-semibold">Allowed Time</p>
          <p className="text-3xl font-bold text-[#0b1c3a]">
            {totalAllowed !== null ? formatHours(totalAllowed, timeFormat) : "—"}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-[#0f6d8214] via-white to-white border border-[#0f6d821f] rounded-xl shadow-sm">
          <p className="text-sm text-[#0f6d82] font-semibold">Used (Laytime - Deductions)</p>
          <p className="text-3xl font-bold text-[#0f2d63]">
            {formatHours(totalUsed, timeFormat)}
          </p>
        </div>
        <div className="p-4 bg-gradient-to-br from-[#b45c1d14] via-white to-white border border-[#d8742b33] rounded-xl shadow-sm">
          <p className="text-sm text-[#b45c1d] font-semibold">Over / Under</p>
          <p
            className={`text-3xl font-bold ${
              timeOver !== null
                ? timeOver >= 0
                  ? "text-[#17694c]"
                  : "text-[#c13232]"
                : "text-slate-800"
            }`}
          >
            {timeOver !== null ? formatHours(timeOver, timeFormat) : "—"}
          </p>
          {onceOnDemurrage && (
            <span className="mt-1 inline-flex text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Once on demurrage active
            </span>
          )}
        </div>
        <div className="p-4 bg-gradient-to-br from-[#17694c14] via-white to-white border border-[#1a8c642b] rounded-xl shadow-sm">
          <p className="text-sm text-[#17694c] font-semibold">Result</p>
          <p className="text-lg font-semibold text-[#0b1c3a]">
            {timeOver === null
              ? "—"
              : timeOver > 0
              ? `Despatch ${currency(despatch, claim.despatch_currency || claim.demurrage_currency || "USD")}`
              : timeOver < 0
              ? `Demurrage ${currency(demurrage, claim.demurrage_currency || "USD")}`
              : "No demurrage/despatch"}
          </p>
        </div>
      </div>
      <p className="text-xs text-slate-600">
        {onceOnDemurrage
          ? "Once-on-demurrage active: laytime span already exceeds allowed, so remaining time keeps counting (later deductions are not pausing time)."
          : "Rule: once on demurrage, remaining time continues to count; deductions after overage are not paused in this view."}
      </p>

      {breakdown.length > 0 && (
        <div className="p-4 border border-slate-200 rounded-xl bg-white">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            Per-port breakdown {claim.reversible ? "(scope-aware)" : "(per port call)"}
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {breakdown.map((b) => {
              const over = b.overUnder !== null ? b.overUnder : b.allowed !== null && b.allowed !== undefined ? (b.allowed || 0) - (b.used || 0) : null;
              return (
                <div key={b.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <p className="font-semibold text-slate-900">
                    {b.label} {b.activity ? `(${b.activity})` : ""} {!b.inScope ? "• out of scope" : ""}
                  </p>
                  <p className="text-sm text-slate-600">Allowed: {b.allowed !== null && b.allowed !== undefined ? formatHours(b.allowed, timeFormat) : "—"}</p>
                  <p className="text-sm text-slate-600">Base (laytime span): {formatHours(b.base || 0, timeFormat)}</p>
                  <p className="text-sm text-slate-600">Deductions: {formatHours(b.deductions || 0, timeFormat)}</p>
                  <p className="text-sm text-slate-600">Used: {formatHours(b.used || 0, timeFormat)}</p>
                  <p className={`text-sm font-semibold ${over !== null ? (over >= 0 ? "text-[#17694c]" : "text-[#c13232]") : "text-slate-600"}`}>
                    Over/Under: {over !== null ? formatHours(over, timeFormat) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function StatementView({
  claim,
  events,
  attachments,
  audit,
  timeFormat,
  siblings,
  manualDeductions = [],
  manualAdditions = [],
}: {
  claim: Claim;
  events: EventRow[];
  attachments: Attachment[];
  audit: AuditRow[];
  timeFormat: TimeFormat;
  siblings?: SiblingSummary[];
  manualDeductions?: EventRow[];
  manualAdditions?: EventRow[];
}) {
  const snapshot = buildStatementSnapshot({ claim: claim as any, events, siblings, manualDeductions, manualAdditions });
  const clauseSummary = useMemo(() => {
    const raw = (claim.clause_profile || {}) as any;
    const working = (raw.workingTimeDefinition || "SHINC").toString().toUpperCase();
    const norOffset = Number(raw.norOffsetHours || 0);
    const norStartTrigger = raw.norStartTrigger || "NOR_TENDERED";
    const rounding = raw.roundingRule || "EXACT";
    const rules = raw.defaultCountRules || {};
    const normalizePercent = (value: any) => {
      if (value === "FULL") return 100;
      if (value === "HALF") return 50;
      if (value === "NONE") return 0;
      if (typeof value === "number") return Number.isFinite(value) ? value : 100;
      if (typeof value === "object" && value?.percent !== undefined) {
        const p = Number(value.percent);
        return Number.isFinite(p) ? p : 100;
      }
      return 100;
    };
    const weather = normalizePercent(rules.weather);
    const shiftGear = normalizePercent(rules["gear delay"] ?? rules["shift gear"]);
    const breakdown = normalizePercent(rules["vessel breakdown"] ?? rules.breakdown);
    const shiftChange = normalizePercent(rules["shift change"]);
    const customStoppage = normalizePercent(rules["custom stoppage"]);
    return {
      working,
      norOffset,
      norStartTrigger,
      rounding,
      weather,
      shiftGear,
      breakdown,
      shiftChange,
      customStoppage,
      startNextWorkingPeriod: !!raw.startNextWorkingPeriod,
    };
  }, [claim.clause_profile]);
  const holidayWindows = useMemo(() => {
    const raw = (claim.clause_profile || {}) as any;
    return Array.isArray(raw.holidayWindows) ? raw.holidayWindows : [];
  }, [claim.clause_profile]);
  const deriveLaytimeStart = () => {
    const baseValue =
      clauseSummary.norStartTrigger === "NOR_ACCEPTED"
        ? claim.nor_accepted_at || claim.nor_tendered_at
        : claim.nor_tendered_at;
    return deriveLaytimeStartFromClause({
      baseValue,
      working: clauseSummary.working,
      norOffset: clauseSummary.norOffset,
      startNextWorkingPeriod: clauseSummary.startNextWorkingPeriod,
      holidayWindows,
    });
  };
  const derivedStart = useMemo(
    () => deriveLaytimeStart(),
    [claim.nor_tendered_at, claim.nor_accepted_at, clauseSummary, holidayWindows]
  );
  const displayStart = claim.laytime_start || derivedStart || null;
  const getTs = (val?: string | null) => (val ? new Date(val).getTime() : 0);
  const sortedEvents = [...snapshot.scopedEvents].sort(
    (a, b) => getTs(a.from_datetime) - getTs(b.from_datetime)
  );
  const sofFiles = attachments.filter((a) => a.attachment_type?.toLowerCase() === "sof");
  const norFiles = attachments.filter((a) => a.attachment_type?.toLowerCase() === "nor");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">Statement view</p>
          <h2 className="text-2xl font-semibold text-slate-900">Laytime Statement</h2>
          <p className="text-xs text-slate-600">
            {claim.claim_reference} · {claim.port_name || "Port"} · {claim.operation_type || "operation"}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-slate-700 font-semibold">
              Clause Rules Summary
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              {clauseSummary.working}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              NOR: {clauseSummary.norStartTrigger === "NOR_ACCEPTED" ? "Accepted" : "Tendered"}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              NOR +{clauseSummary.norOffset}h
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              {clauseSummary.rounding}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              Weather: {clauseSummary.weather}%
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              Shift Gear: {clauseSummary.shiftGear}%
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              Breakdown: {clauseSummary.breakdown}%
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              Shift Change: {clauseSummary.shiftChange}%
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              Custom Stoppage: {clauseSummary.customStoppage}%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline">Save Draft</Button>
          <Button size="sm" variant="outline">Mark Final</Button>
          <Button size="sm">Export PDF</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white shadow-sm">
          <p className="text-xs font-semibold text-slate-600">Allowed</p>
          <p className="text-2xl font-bold text-slate-900">{formatHours(snapshot.totalAllowed, timeFormat)}</p>
          <p className="text-[11px] text-slate-500">Basis: port call allowed or rate</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <p className="text-xs font-semibold text-blue-700">Used</p>
          <p className="text-2xl font-bold text-slate-900">{formatHours(snapshot.totalUsed, timeFormat)}</p>
          <p className="text-[11px] text-blue-700">
            Includes once-on-demurrage rule {snapshot.onceOnDemurrage ? "(active)" : "(inactive)"}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <p className="text-xs font-semibold text-amber-700">Over / Under</p>
          <p
            className={`text-2xl font-bold ${
              snapshot.timeOver !== null
                ? snapshot.timeOver >= 0
                  ? "text-emerald-700"
                  : "text-rose-700"
                : "text-slate-900"
            }`}
          >
            {snapshot.timeOver !== null ? formatHours(snapshot.timeOver, timeFormat) : "—"}
          </p>
          <p className="text-[11px] text-amber-700">
            {snapshot.timeOver > 0 ? "Despatch candidate" : snapshot.timeOver < 0 ? "Demurrage candidate" : "Balanced"}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <p className="text-xs font-semibold text-emerald-700">Amounts</p>
          <p className="text-sm text-slate-900">
            Demurrage {currency(snapshot.demurrage, claim.demurrage_currency || "USD")}
          </p>
          <p className="text-sm text-slate-900">
            Despatch {currency(snapshot.despatch, claim.despatch_currency || claim.demurrage_currency || "USD")}
          </p>
          <p className="text-[11px] text-slate-500">Rates: dem {currency(claim.demurrage_rate || 0, claim.demurrage_currency || "USD")} / day</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm space-y-1">
          <p className="text-xs font-semibold text-slate-600">Voyage & port</p>
          <p className="text-sm text-slate-900">{claim.port_name || "Port not set"}</p>
          <p className="text-xs text-slate-600">Activity: {claim.operation_type || claim.port_calls?.[0]?.activity || "—"}</p>
          <p className="text-xs text-slate-600">Reversible: {claim.reversible ? `Yes (${claim.reversible_scope || "all ports"})` : "No"}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm space-y-1">
          <p className="text-xs font-semibold text-slate-600">Contract / CP</p>
          <p className="text-sm text-slate-900">
            {claim.contract_label || (claim.cp_id ? `CP ${claim.cp_id.slice(0, 8)}` : "Not set")}
          </p>
          <p className="text-xs text-slate-600">
            NOR trigger: {clauseSummary.norStartTrigger === "NOR_ACCEPTED" ? "Accepted" : "Tendered"}
          </p>
          <p className="text-xs text-slate-600">Allowed basis: {snapshot.fallbackAllowed > 0 ? "Cargo/rate fallback" : "Port call allowed hours"}</p>
          <p className="text-xs text-slate-600">Laytime span: {formatHours(snapshot.baseSpanHours, timeFormat)}</p>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Laytime start: {displayStart ? formatDate(displayStart) : "—"}</span>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm space-y-1">
          <p className="text-xs font-semibold text-slate-600">Parties & cargo</p>
          <p className="text-sm text-slate-900">
            Cargo: {claim.voyages?.cargo_names?.name || "—"} · Qty {claim.voyages?.cargo_quantity || "—"}
          </p>
          <p className="text-xs text-slate-600">Rates: Despatch {claim.despatch_type === "percent" ? `${claim.despatch_rate_value || 0}% of demurrage` : currency(claim.despatch_rate_value || 0, claim.despatch_currency || claim.demurrage_currency || "USD")}</p>
          <p className="text-xs text-slate-600">QC: {claim.qc_status || "—"}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Events & counting</p>
            <p className="text-xs text-slate-500">Chronological SOF/laytime events with counted minutes.</p>
          </div>
          <p className="text-xs text-slate-500">{sortedEvents.length} entries</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Counted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                    No events yet. Add SOF events in the workspace tab.
                  </TableCell>
                </TableRow>
              ) : (
                sortedEvents.map((ev, idx) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs text-slate-500">{idx + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-800">{ev.deduction_name}</TableCell>
                    <TableCell className="text-sm text-slate-700">
                      {ev.port_calls?.port_name || "—"} {ev.port_calls?.activity ? `(${ev.port_calls.activity})` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{formatDate(ev.from_datetime || "")}</TableCell>
                    <TableCell className="text-sm text-slate-700">{formatDate(ev.to_datetime || "")}</TableCell>
                    <TableCell className="text-sm text-slate-700">{ev.rate_of_calculation}%</TableCell>
                    <TableCell className="text-sm text-slate-900">{formatHours(ev.time_used || 0, timeFormat)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {snapshot.breakdown.length > 0 && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800">Per-port breakdown</p>
            <p className="text-xs text-slate-500">Allowed vs used, over/under, scope aware.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {snapshot.breakdown.map((row) => {
              const over = row.overUnder !== null ? row.overUnder : row.allowed !== null && row.allowed !== undefined ? (row.allowed || 0) - (row.used || 0) : null;
              return (
                <div key={row.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <p className="font-semibold text-slate-900">
                    {row.label} {row.activity ? `(${row.activity})` : ""} {!row.inScope ? "• out of scope" : ""}
                  </p>
                  <p className="text-xs text-slate-600">Allowed: {row.allowed !== null && row.allowed !== undefined ? formatHours(row.allowed, timeFormat) : "—"}</p>
                  <p className="text-xs text-slate-600">Used: {formatHours(row.used || 0, timeFormat)}</p>
                  <p className={`text-xs font-semibold ${over !== null ? (over >= 0 ? "text-emerald-700" : "text-rose-700") : "text-slate-600"}`}>
                    Over/Under: {over !== null ? formatHours(over, timeFormat) : "—"}
                  </p>
                  {row.note && <p className="text-[11px] text-slate-500">{row.note}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
          <p className="text-sm font-semibold text-slate-800">Attachments</p>
          <p className="text-xs text-slate-500">NOR and SOF files will accompany the statement export.</p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">SOF files</p>
            {sofFiles.length === 0 ? (
              <p className="text-xs text-slate-500">No SOF uploads yet.</p>
            ) : (
              <ul className="text-sm text-slate-700 list-disc ml-4 space-y-1">
                {sofFiles.map((f) => (
                  <li key={f.id}>
                    <a className="text-ocean-700" href={(f as any).signed_url || f.file_url} target="_blank" rel="noreferrer">
                      {f.filename}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">NOR files</p>
            {norFiles.length === 0 ? (
              <p className="text-xs text-slate-500">No NOR uploads yet.</p>
            ) : (
              <ul className="text-sm text-slate-700 list-disc ml-4 space-y-1">
                {norFiles.map((f) => (
                  <li key={f.id}>
                    <a className="text-ocean-700" href={(f as any).signed_url || f.file_url} target="_blank" rel="noreferrer">
                      {f.filename}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
          <p className="text-sm font-semibold text-slate-800">Audit highlights</p>
          {audit.length === 0 ? (
            <p className="text-xs text-slate-500">No audit entries yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {audit.slice(0, 6).map((a) => (
                <div key={a.id} className="text-xs text-slate-600 border-b pb-2">
                  <p className="font-semibold text-slate-800">{a.action.toUpperCase()} · {formatDate(a.created_at)}</p>
                  <p className="break-words text-slate-500">{a.data?.deduction_name || ""}</p>
                </div>
              ))}
            </div>
          )}
          {audit.length > 6 && <p className="text-[11px] text-slate-500">+{audit.length - 6} more</p>}
        </div>
      </div>
    </div>
  );
};



function SofExtractorPanel({
  onResult,
  onError,
  claimId,
  onAttachmentAdded,
}: {
  onResult?: (r: SofExtractResult) => void;
  onError?: (msg: string) => void;
  claimId?: string;
  onAttachmentAdded?: (att: any) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SofExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      // Upload to claim attachments first (so SOF file is stored), then extract using the same file.
      if (claimId) {
        const uploadForm = new FormData();
        uploadForm.append("file", file);
        uploadForm.append("attachment_type", "sof");
        const uploadRes = await fetch(`/api/claims/${claimId}/attachments`, {
          method: "POST",
          body: uploadForm,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadJson?.error || "Upload failed");
        }
        if (uploadJson?.attachment && onAttachmentAdded) {
          onAttachmentAdded(uploadJson.attachment);
        }
      }

      const res = await fetch("/api/sof-extract", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      let typed = res.ok ? (json as SofExtractResult) : null;

      if ((!res.ok || !typed?.events?.length) && ENABLE_LOCAL_OCR) {
        const { localOcrFallback } = await import("@/lib/local-ocr-fallback");
        try {
          typed = await localOcrFallback(file, { enableRaster: ENABLE_LOCAL_RASTER });
        } catch (err) {
          console.error("Local OCR fallback failed", err);
        }
      }

      if (!typed) {
        const msg = json?.error || "Extraction failed";
        setError(msg);
        onError?.(msg);
        return;
      }

      setResult(typed);
      onResult?.(typed);
    } catch (err: any) {
      setError(err?.message || "Extraction failed");
      onError?.(err?.message || "Extraction failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" onClick={() => document.getElementById("sof-extract-upload")?.click()} disabled={uploading}>
        {uploading ? "Extracting…" : "Upload & Extract"}
      </Button>
      <input
        id="sof-extract-upload"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFile(f);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
      {result && (
        <div className="text-right text-xs text-slate-600">
          {result.warnings?.length ? `Warnings: ${result.warnings.join("; ")}` : "Extraction complete"}
        </div>
      )}
    </div>
  );
}

export default function CalculationPage({ params }: { params: { claimId: string } }) {
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [claimForm, setClaimForm] = useState<Partial<Claim>>({});
  const [cargoQty, setCargoQty] = useState<number | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [contracts, setContracts] = useState<{ id: string; name?: string | null; cp_number?: string | null; clause_profile?: any }[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [portCalls, setPortCalls] = useState<{ id: string; port_name: string; activity?: string | null }[]>([]);
  const [siblings, setSiblings] = useState<SiblingSummary[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [qcUsers, setQcUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingClaim, setSavingClaim] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("dhms");
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "statement" | "sof">("workspace");
  const [, setSofSummaryStatus] = useState<string | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [deductionEvents, setDeductionEvents] = useState<EventRow[]>([]);
  const [additionEvents, setAdditionEvents] = useState<EventRow[]>([]);
  const [selectionMode, setSelectionMode] = useState<"deduction" | "addition" | null>(null);
  const [selectionConfirmOpen, setSelectionConfirmOpen] = useState(false);
  const [selectionTag, setSelectionTag] = useState("");
  const [selectionComment, setSelectionComment] = useState("");
  const [selectionNotes, setSelectionNotes] = useState<Record<string, { tag?: string; comment?: string }>>({});
  const [selectionPercent, setSelectionPercent] = useState<number>(100);
  const storageKey = useMemo(() => (claim ? `laytime-selections-${claim.id}` : ""), [claim?.id]);
  const MANUAL_PREFIX_DED = "[DED]";
  const MANUAL_PREFIX_ADD = "[ADD]";

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.deductions) setDeductionEvents(parsed.deductions);
      if (parsed?.additions) setAdditionEvents(parsed.additions);
      if (parsed?.notes) setSelectionNotes(parsed.notes);
    } catch {
      // ignore corrupted storage
    }
  }, [storageKey]);

  const persistSelections = (ded: EventRow[] = deductionEvents, add: EventRow[] = additionEvents, notes = selectionNotes) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ deductions: ded, additions: add, notes }));
    } catch {
      // ignore storage failures
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/claims/${params.claimId}/events`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load claim");
        }
        setClaim(json.claim);
        setClaimForm(json.claim);
        setCargoQty(json.claim?.voyages?.cargo_quantity ?? null);
        // Split persisted manual additions/deductions (prefixed) from base events
        const parsedEvents: EventRow[] = json.events || [];
        const manualAdds: EventRow[] = [];
        const manualDeds: EventRow[] = [];
        const notes: Record<string, { tag?: string; comment?: string }> = {};
        const base: EventRow[] = [];
        parsedEvents.forEach((ev: any) => {
          const name: string = ev.deduction_name || "";
          const isAdd = name.startsWith(MANUAL_PREFIX_ADD);
          const isDed = name.startsWith(MANUAL_PREFIX_DED);
          if (isAdd || isDed) {
            const cleaned = name.replace(isAdd ? MANUAL_PREFIX_ADD : MANUAL_PREFIX_DED, "").trim();
            const [tagPart, commentPart] = cleaned.split("|").map((s) => s?.trim()).filter(Boolean);
            const span: EventRow = {
              ...ev,
              deduction_name: tagPart || cleaned || "Manual span",
            };
            if (commentPart) {
              notes[ev.id] = { tag: span.deduction_name, comment: commentPart };
            } else if (tagPart) {
              notes[ev.id] = { tag: tagPart };
            }
            if (isAdd) manualAdds.push(span);
            else manualDeds.push(span);
          } else {
            base.push(ev);
          }
        });
        setSelectionNotes((prev) => ({ ...notes, ...prev }));
        setAdditionEvents(manualAdds);
        setDeductionEvents(manualDeds);
        persistSelections(manualDeds, manualAdds, { ...selectionNotes, ...notes });
        setEvents(base);
        try {
          const contractsRes = await fetch("/api/contracts");
          const contractsJson = await contractsRes.json();
          if (contractsRes.ok) setContracts(contractsJson.contracts || []);
        } catch {
          setContracts([]);
        }
        if (json.audit) setAudit(json.audit);
        if (json.claim?.port_calls) setPortCalls(json.claim.port_calls);
        if (json.sibling_summaries) setSiblings(json.sibling_summaries);
        const aRes = await fetch(`/api/claims/${params.claimId}/attachments`);
        const aJson = await aRes.json();
        if (aRes.ok && aJson.attachments) setAttachments(aJson.attachments);
        setCommentsLoading(true);
        try {
          const cRes = await fetch(`/api/claims/${params.claimId}/comments`);
          const cJson = await cRes.json();
          if (cRes.ok && cJson.comments) {
            setComments(cJson.comments);
          } else if (!cRes.ok) {
            setCommentError(cJson.error || "Failed to load comments");
          }
        } finally {
          setCommentsLoading(false);
        }
        try {
          const uRes = await fetch("/api/customer-admin/users");
          const uJson = await uRes.json();
          if (uRes.ok && uJson.users) {
            setQcUsers(
              uJson.users
                .filter((u: any) => u.is_active !== false)
                .map((u: any) => ({
                  id: u.id,
                  full_name: u.full_name || "User",
                  email: u.email,
                  role: u.role,
                }))
            );
          }
        } catch {
          // ignore optional user load error
        }
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.claimId]);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        if (json?.user?.id) {
          setCurrentUser({ id: json.user.id, role: json.user.role || "" });
        }
      } catch {
        // ignore session load errors; non-authenticated users are blocked earlier
      }
    }
    loadSession();
  }, []);

  const handleAdd = async (payload: Omit<EventRow, "id" | "time_used">) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${params.claimId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add event");
      const ev = json.event as EventRow;
      setEvents((prev) => [
        ...prev,
        { ...ev, time_used: ev.time_used ?? durationHours(ev.from_datetime, ev.to_datetime, ev.rate_of_calculation) },
      ]);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to add event");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, payload: Omit<EventRow, "id" | "time_used">) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${params.claimId}/events`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update event");
      const ev = json.event as EventRow;
      setEvents((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...ev, time_used: ev.time_used ?? durationHours(ev.from_datetime, ev.to_datetime, ev.rate_of_calculation) } : p))
      );
      setEditingEvent(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${params.claimId}/events`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete event");
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setEditingEvent(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to delete event");
    } finally {
      setSaving(false);
    }
  };

  const enhancedEvents = useMemo(() => {
    const scopedEvents = events.map((ev) => {
      const time_used =
        ev.time_used ??
        durationHours(ev.from_datetime, ev.to_datetime, ev.rate_of_calculation);
      const label = ev.deduction_name || (ev as any).event || "";
      const mapped = mapCanonicalEvent(label);
      return {
        ...ev,
        time_used,
        canonical_event: (ev as any).canonical_event || mapped.canonical,
        canonical_confidence: (ev as any).canonical_confidence ?? mapped.confidence ?? null,
      };
    });
    if (!claim?.reversible || !claim.reversible_scope || claim.reversible_scope === "all_ports") {
      return scopedEvents;
    }
    return scopedEvents.filter((ev) => {
      const act = ev.port_calls?.activity;
      if (!act) return true; // keep untagged events
      if (claim.reversible_scope === "load_only") return act === "load";
      if (claim.reversible_scope === "discharge_only") return act === "discharge";
      return true;
    });
  }, [events, claim?.reversible, claim?.reversible_scope]);

  type TimelineRow = EventRow & { displayLabel: string; originalLabel?: string | null; part?: "start" | "end" };
  const timelineEvents: TimelineRow[] = useMemo(() => {
    const expanded: TimelineRow[] = [];
    enhancedEvents.forEach((ev: any) => {
      const hasEnd = ev.to_datetime && ev.to_datetime !== ev.from_datetime;
      const baseLabel = ev.deduction_name || ev.event || "Event";
      if (hasEnd) {
        expanded.push({
          ...ev,
          id: `${ev.id}-start`,
          displayLabel: `${baseLabel} (start)`,
          originalLabel: ev.event || ev.deduction_name,
          part: "start",
          to_datetime: ev.from_datetime,
        });
        expanded.push({
          ...ev,
          id: `${ev.id}-end`,
          displayLabel: `${baseLabel} (end)`,
          originalLabel: ev.event || ev.deduction_name,
          part: "end",
          from_datetime: ev.to_datetime,
        });
      } else {
        expanded.push({
          ...ev,
          displayLabel: baseLabel,
          originalLabel: ev.event || ev.deduction_name,
        });
      }
    });
    return expanded.sort((a, b) => {
      const aTime = a.from_datetime ? new Date(a.from_datetime).getTime() : 0;
      const bTime = b.from_datetime ? new Date(b.from_datetime).getTime() : 0;
      return aTime - bTime;
    });
  }, [enhancedEvents]);

  const canonicalOptions = useMemo(() => {
    const opts = canonicalMappings.map((c) => ({ id: c.canonical, label: c.canonical }));
    return opts;
  }, []);

  const dedStartSet = useMemo(() => new Set(deductionEvents.map((d) => d.from_datetime)), [deductionEvents]);
  const dedEndSet = useMemo(() => new Set(deductionEvents.map((d) => d.to_datetime || d.from_datetime)), [deductionEvents]);
  const addStartSet = useMemo(() => new Set(additionEvents.map((d) => d.from_datetime)), [additionEvents]);
  const addEndSet = useMemo(() => new Set(additionEvents.map((d) => d.to_datetime || d.from_datetime)), [additionEvents]);
  const spanWindows = useMemo(
    () =>
      [
        ...deductionEvents.map((d) => ({ from: new Date(d.from_datetime).getTime(), to: new Date(d.to_datetime || d.from_datetime).getTime(), type: "ded" })),
        ...additionEvents.map((d) => ({ from: new Date(d.from_datetime).getTime(), to: new Date(d.to_datetime || d.from_datetime).getTime(), type: "add" })),
      ].filter((w) => Number.isFinite(w.from) && Number.isFinite(w.to)),
    [deductionEvents, additionEvents]
  );

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectionMode(null);
    setSelectionTag("");
    setSelectionComment("");
    setSelectionConfirmOpen(false);
  };

  const selectedRangeIds = useMemo(() => {
    if (selectionStart === null || selectionEnd === null) return new Set<string>();
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const ids = new Set<string>();
    for (let i = start; i <= end; i++) {
      const ev = timelineEvents[i];
      if (ev?.id) ids.add(ev.id);
    }
    return ids;
  }, [selectionStart, selectionEnd, timelineEvents]);

  const applySelectionTo = (target: "deduction" | "addition", tag?: string, comment?: string) => {
    if (selectionStart === null || selectionEnd === null) return;
    const startIdx = Math.min(selectionStart, selectionEnd);
    const endIdx = Math.max(selectionStart, selectionEnd);
    const startEv = timelineEvents[startIdx];
    const endEv = timelineEvents[endIdx];
    if (!startEv || !endEv) return;
    const spanId = `span-${target}-${startEv.id}-${endEv.id}-${Date.now()}`;
    const spanName = tag || `${startEv.displayLabel} → ${endEv.displayLabel}`;
    const from = startEv.from_datetime;
    const to = endEv.to_datetime || endEv.from_datetime || from;
    const span: EventRow = {
      id: spanId,
      deduction_name: spanName,
      from_datetime: from,
      to_datetime: to,
      rate_of_calculation: selectionPercent ?? startEv.rate_of_calculation ?? 100,
      time_used: durationHours(from, to, selectionPercent ?? startEv.rate_of_calculation ?? 100),
      port_call_id: startEv.port_call_id,
      port_calls: startEv.port_calls,
    };
    const storeSpan = (dbEvent?: EventRow) => {
      const saved = dbEvent ? { ...span, ...dbEvent, deduction_name: spanName } : span;
      if (target === "deduction") {
        setDeductionEvents((prev) => {
          const next = [...prev, saved];
          persistSelections(next, additionEvents, selectionNotes);
          return next;
        });
      } else {
        setAdditionEvents((prev) => {
          const next = [...prev, saved];
          persistSelections(deductionEvents, next, selectionNotes);
          return next;
        });
      }
      if (tag || comment) {
        setSelectionNotes((prev) => {
          const next = { ...prev, [saved.id]: { tag: tag || prev[saved.id]?.tag, comment: comment || prev[saved.id]?.comment || comment } };
          persistSelections(deductionEvents, additionEvents, next);
          return next;
        });
      } else {
        persistSelections();
      }
    };

    // Persist to DB
    const prefix = target === "addition" ? MANUAL_PREFIX_ADD : MANUAL_PREFIX_DED;
    const storedName = `${prefix} ${spanName}${comment ? ` | ${comment}` : ""}`;
    fetch(`/api/claims/${params.claimId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deduction_name: storedName,
        from_datetime: from,
        to_datetime: to,
        rate_of_calculation: selectionPercent ?? startEv.rate_of_calculation ?? 100,
        port_call_id: startEv.port_call_id,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.event?.id) {
          storeSpan(json.event as EventRow);
        } else {
          storeSpan();
        }
      })
      .catch(() => storeSpan());

    clearSelection();
  };

  const handleClaimFieldChange = (field: keyof Claim, value: any) => {
    setClaimForm((prev) => ({ ...prev, [field]: value }));
  };

  const clauseProfile = useMemo(() => {
    const raw = (claimForm.clause_profile ?? claim?.clause_profile ?? {}) as any;
    return {
      workingTimeDefinition: raw.workingTimeDefinition || "SHINC",
      norStartTrigger: raw.norStartTrigger || "NOR_TENDERED",
      norOffsetHours: Number(raw.norOffsetHours || 0),
      startNextWorkingPeriod: !!raw.startNextWorkingPeriod,
      roundingRule: raw.roundingRule || "EXACT",
      defaultCountRules: raw.defaultCountRules || {},
      holidayWindows: raw.holidayWindows || [],
    };
  }, [claimForm.clause_profile, claim?.clause_profile]);

  const countRules = useMemo(() => {
    const rules = clauseProfile.defaultCountRules || {};
    const normalized: Record<string, any> = {};
    Object.keys(rules).forEach((k) => {
      normalized[k.toLowerCase()] = rules[k];
    });
    return normalized;
  }, [clauseProfile.defaultCountRules]);


  const selectedContract = useMemo(() => {
    const cpId = claimForm.cp_id || claim?.cp_id;
    return contracts.find((c) => c.id === cpId) || null;
  }, [contracts, claimForm.cp_id, claim?.cp_id]);

  const handleStartSelection = (mode: "deduction" | "addition", idx: number) => {
    if (selectionStart !== null && selectionMode === mode) {
      if (selectionStart === idx) {
        clearSelection();
        return;
      }
      setSelectionEnd(idx);
      setSelectionConfirmOpen(true);
      return;
    }
    const ev = timelineEvents[idx];
    const defaultTag = (ev as any)?.canonical_event || ev?.deduction_name || "";
    setSelectionMode(mode);
    setSelectionStart(idx);
    setSelectionEnd(idx);
    setSelectionTag(defaultTag);
    setSelectionComment("");
    setSelectionPercent(100);
    setSelectionConfirmOpen(false);
  };

  const applySofSummaryToClaim = async (fields: Record<string, any>) => {
    if (!claim) throw new Error("Claim not loaded");
    const normalizeDate = (val: any) => {
      if (!val) return null;
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return val;
      return d.toISOString();
    };

    const payload: Record<string, any> = {};
    if (fields.port_name) payload.port_name = fields.port_name;
    if (fields.operation_type) payload.operation_type = fields.operation_type;
    if (fields.laycan_start) payload.laycan_start = normalizeDate(fields.laycan_start);
    if (fields.laycan_end) payload.laycan_end = normalizeDate(fields.laycan_end);

    if (Object.keys(payload).length === 0) {
      setSofSummaryStatus("No mappable fields found in SOF header.");
      return "No mappable fields";
    }

    setSofSummaryStatus("Saving SOF header to claim…");
    const res = await fetch(`/api/claims/${claim.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.error || "Failed to apply SOF header";
      setSofSummaryStatus(msg);
      throw new Error(msg);
    }

    setClaim((prev) => (prev ? ({ ...prev, ...payload } as Claim) : prev));
    setClaimForm((prev) => ({ ...prev, ...payload }));
    setSofSummaryStatus("SOF header applied to claim.");
    return "SOF header applied to claim.";
  };

  const uploadAttachment = async (file: File, attachment_type: string) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("attachment_type", attachment_type);
      const res = await fetch(`/api/claims/${params.claimId}/attachments`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setAttachments((prev) => [json.attachment, ...prev]);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (id: string) => {
    if (!confirm("Delete this attachment?")) return;
    try {
      const res = await fetch(`/api/claims/${params.claimId}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Delete failed");
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      alert(e.message || "Delete failed");
    }
  };

  const submitComment = async () => {
    setCommentError(null);
    const text = newComment.trim();
    if (!text) {
      setCommentError("Comment cannot be empty");
      return;
    }
    setPostingComment(true);
    try {
      const res = await fetch(`/api/claims/${params.claimId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add comment");
      if (json.comment) setComments((prev) => [...prev, json.comment]);
      setNewComment("");
    } catch (e: any) {
      setCommentError(e.message || "Failed to add comment");
    } finally {
      setPostingComment(false);
    }
  };

  const saveClaimDetails = async (overrides?: Partial<Claim>) => {
    if (!claim) return;
    setSavingClaim(true);
    setError(null);
    try {
      const payload = {
        ...claimForm,
        ...(overrides || {}),
        qc_reviewer_id: claimForm.qc_reviewer_id ? claimForm.qc_reviewer_id : null,
        claim_status: claimForm.claim_status || claim?.claim_status || null,
        // keep qc_status aligned with the single status field for consistency in API/db
        qc_status: claimForm.claim_status || claim?.claim_status || null,
        cargo_quantity: cargoQty,
      };
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save claim");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to save claim");
    } finally {
      setSavingClaim(false);
    }
  };

  const currentStatus = ((claimForm.claim_status as string | undefined) || claim?.claim_status || "") as string;
  const qcMeta = claimStatusOptions.find((o) => o.value === currentStatus);
  const qcBadgeClass =
    currentStatus === "completed" || currentStatus === "archived"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : currentStatus === "pending_reply" || currentStatus === "missing_information" || currentStatus === "pending_counter_check"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : currentStatus === "for_qc" || currentStatus === "qc_in_progress"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  const qcAssignedId = claim?.qc_reviewer_id || null;
  const canEditQc =
    !qcAssignedId ||
    currentUser?.role === "super_admin" ||
    (currentUser?.id && qcAssignedId === currentUser.id);
  const qcLocked = !!qcAssignedId && !canEditQc;

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600">Loading claim...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600">Claim not found.</p>
      </div>
    );
  }

  const laytimeStart = claimForm.laytime_start ?? claim?.laytime_start ?? null;
  const laytimeEnd = claimForm.laytime_end ?? claim?.laytime_end ?? null;
  const laytimeSpanHours = (() => {
    if (laytimeStart && laytimeEnd) {
      const s = new Date(laytimeStart).getTime();
      const e = new Date(laytimeEnd).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) return (e - s) / 3600000;
    }
    return 0;
  })();
  const missingLaytimeSpan = !laytimeStart || !laytimeEnd || laytimeSpanHours <= 0;
  const contractLabel =
    selectedContract?.cp_number ||
    selectedContract?.name ||
    claim.contract_label ||
    (claim.cp_id ? `CP ${claim.cp_id.slice(0, 8)}` : "");

  const autoCalculateLaytime = async () => {
    const candidateEvents = enhancedEvents.length > 0 ? enhancedEvents : events;
    if (candidateEvents.length === 0) {
      setError("No SOF events available to auto-calculate laytime.");
      return;
    }
    const sorted = [...candidateEvents].sort((a, b) => {
      const aTime = new Date(a.from_datetime || a.to_datetime || "").getTime();
      const bTime = new Date(b.from_datetime || b.to_datetime || "").getTime();
      return aTime - bTime;
    });
    const earliest = sorted[0];
    const latest = [...candidateEvents].sort((a, b) => {
      const aTime = new Date(a.to_datetime || a.from_datetime || "").getTime();
      const bTime = new Date(b.to_datetime || b.from_datetime || "").getTime();
      return bTime - aTime;
    })[0];
    const baseValue =
      clauseProfile.norStartTrigger === "NOR_ACCEPTED"
        ? claimForm.nor_accepted_at || claim.nor_accepted_at || claimForm.nor_tendered_at || claim.nor_tendered_at
        : claimForm.nor_tendered_at || claim.nor_tendered_at;
    const derivedStart = deriveLaytimeStartFromClause({
      baseValue: baseValue || earliest?.from_datetime || earliest?.to_datetime,
      working: clauseProfile.workingTimeDefinition || "SHINC",
      norOffset: Number(clauseProfile.norOffsetHours || 0),
      startNextWorkingPeriod: !!clauseProfile.startNextWorkingPeriod,
        holidayWindows: clauseProfile.holidayWindows || [],
    });
    const derivedEnd = latest?.to_datetime || latest?.from_datetime || null;
    if (!derivedStart || !derivedEnd) {
      setError("Auto-calc could not derive laytime start/end from the available events.");
      return;
    }
    const startMs = new Date(derivedStart).getTime();
    const endMs = new Date(derivedEnd).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError("Auto-calc found invalid laytime start/end; please review event times.");
      return;
    }
    handleClaimFieldChange("laytime_start", derivedStart);
    handleClaimFieldChange("laytime_end", derivedEnd);
    await saveClaimDetails({ laytime_start: derivedStart, laytime_end: derivedEnd });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Claim</p>
            <h1 className="text-3xl font-bold text-gray-900">
              {claim.claim_reference}
            </h1>
            {contractLabel && (
              <p className="text-sm text-slate-700">Contract/CP: {contractLabel}</p>
            )}
          <div className="flex items-center gap-2 mt-1">
            {qcMeta && (
              <span className={`text-xs px-3 py-1 rounded-full border ${qcBadgeClass}`}>
                Status · {qcMeta.label}
              </span>
            )}
          </div>
            <p className="text-xs text-slate-600">
            Reversible: {claim.reversible ? "Yes" : "No"} {claim.reversible_scope ? `(${claim.reversible_scope.replace("_"," ")})` : ""}
            {(() => {
              const pc = claim.port_calls?.find((p) => p.id === claim.port_call_id) || claim.port_calls?.[0];
              return pc?.port_name ? ` · Port Call: ${pc.port_name} (${pc.activity || ""})` : "";
            })()}
          </p>
        </div>
        <div className="flex items-start gap-6 text-sm text-gray-700">
          <div className="text-right">
            <p>Demurrage rate: {currency(claim.demurrage_rate || 0, claim.demurrage_currency || "USD")}</p>
            <p>Despatch rate: {claim.despatch_type === "percent" ? `${claim.despatch_rate_value || 0}% of demurrage` : currency(claim.despatch_rate_value || 0, claim.despatch_currency || claim.demurrage_currency || "USD")}</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
            <Label className="text-slate-700 text-xs">Time Format</Label>
            <Select value={timeFormat} onValueChange={(v: any) => setTimeFormat(v)}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dhms">DD.HH.MM.SS</SelectItem>
                <SelectItem value="decimal">Decimal days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="sof">SOF</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
      {claim.reversible && claim.reversible_scope && claim.reversible_scope !== "all_ports" && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Reversible scope is limited to: {claim.reversible_scope.replace("_", " ")}. Ensure events/ports match this scope when interpreting results.
        </div>
      )}

      {(missingLaytimeSpan || (!claim.reversible && !claim.port_call_id)) && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {!laytimeStart || !laytimeEnd
            ? "Laytime start/end is missing, so totals rely on deductions and any allowed_hours set on the port call."
            : laytimeSpanHours <= 0
            ? "Laytime span could not be derived (start/end are invalid or zero). Totals may be approximate."
            : !claim.reversible && !claim.port_call_id
            ? "No port call selected for this non-reversible claim; only unassigned events are counted."
            : null}
        </div>
      )}
      <div className="p-3 border border-slate-200 rounded-lg bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setQuickEditOpen((v) => !v)}>
            {quickEditOpen ? "Close quick edit" : "Quick edit key timings"}
          </Button>
          <p className="text-xs text-slate-600">
            Adjust laytime start/end, NOR, and ops timings quickly; then save to apply.
          </p>
        </div>
        <Button size="sm" onClick={autoCalculateLaytime} disabled={savingClaim}>
          Auto-calc laytime
        </Button>
      </div>
      {quickEditOpen && (
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 grid md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Laytime start</Label>
            <Input
              type="datetime-local"
              value={toInputValue(laytimeStart)}
              onChange={(e) => handleClaimFieldChange("laytime_start", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Laytime end</Label>
            <Input
              type="datetime-local"
              value={toInputValue(laytimeEnd)}
              onChange={(e) => handleClaimFieldChange("laytime_end", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>NOR tendered</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.nor_tendered_at ?? claim.nor_tendered_at)}
              onChange={(e) => handleClaimFieldChange("nor_tendered_at", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>NOR accepted</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.nor_accepted_at ?? claim.nor_accepted_at)}
              onChange={(e) => handleClaimFieldChange("nor_accepted_at", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Ops start</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.loading_start_at ?? claim.loading_start_at)}
              onChange={(e) => handleClaimFieldChange("loading_start_at", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Ops end</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.loading_end_at ?? claim.loading_end_at)}
              onChange={(e) => handleClaimFieldChange("loading_end_at", e.target.value)}
            />
          </div>
          <div className="space-y-1 flex items-end">
            <Button size="sm" onClick={() => saveClaimDetails()} disabled={savingClaim}>
              {savingClaim ? "Saving…" : "Save timings"}
            </Button>
          </div>
        </div>
      )}

      <Summary
        events={enhancedEvents}
        claim={{ ...claim, ...claimForm } as Claim}
        timeFormat={timeFormat}
        siblings={siblings}
        manualDeductions={deductionEvents}
        manualAdditions={additionEvents}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Claim Details</h2>
          <Button onClick={() => saveClaimDetails()} disabled={savingClaim}>
            {savingClaim ? "Saving..." : "Save Details"}
          </Button>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Operation</Label>
            <Select
              value={(claimForm.operation_type as any) || ""}
              onValueChange={(v: any) => handleClaimFieldChange("operation_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Load or Discharge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="load">Load</SelectItem>
                <SelectItem value="discharge">Discharge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Port</Label>
            <Input
              value={claimForm.port_name || ""}
              onChange={(e) => handleClaimFieldChange("port_name", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Cargo Quantity</Label>
            <Input
              type="number"
              value={cargoQty ?? ""}
              onChange={(e) => setCargoQty(e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g. 51900"
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Contract / CP</Label>
            <Select
              value={(claimForm.cp_id as any) || ""}
              onValueChange={(v: any) => {
                const next = v === "none" ? null : v;
                handleClaimFieldChange("cp_id", next);
                const selected = contracts.find((c) => c.id === next);
                if (selected?.clause_profile) {
                  handleClaimFieldChange("clause_profile", selected.clause_profile);
                }
                if (selected?.cp_number || selected?.name) {
                  handleClaimFieldChange("contract_label", selected.cp_number || selected.name);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contract</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.cp_number || c.name || c.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Laycan Start</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.laycan_start)}
              onChange={(e) => handleClaimFieldChange("laycan_start", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Laycan End</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.laycan_end)}
              onChange={(e) => handleClaimFieldChange("laycan_end", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>NOR Tendered</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.nor_tendered_at)}
              onChange={(e) => handleClaimFieldChange("nor_tendered_at", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>NOR Accepted</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.nor_accepted_at)}
              onChange={(e) => handleClaimFieldChange("nor_accepted_at", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Loading/Discharge Start</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.loading_start_at)}
              onChange={(e) => handleClaimFieldChange("loading_start_at", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Loading/Discharge End</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.loading_end_at)}
              onChange={(e) => handleClaimFieldChange("loading_end_at", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Laytime Starts</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.laytime_start)}
              onChange={(e) => handleClaimFieldChange("laytime_start", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Laytime Ends</Label>
            <Input
              type="datetime-local"
              value={toInputValue(claimForm.laytime_end)}
              onChange={(e) => handleClaimFieldChange("laytime_end", e.target.value)}
            />
          </div>
          <div className="col-span-12 space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-sm font-semibold text-slate-700">Clause rules applied</p>
            <p className="text-xs text-slate-500">
              Clause logic comes from the selected Contract/CP. Update clauses in Contracts/CPs to change counting rules.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Load/Discharge Rate</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={claimForm.load_discharge_rate ?? ""}
                onChange={(e) =>
                  handleClaimFieldChange("load_discharge_rate", e.target.value ? Number(e.target.value) : null)
                }
              />
              <Select
                value={(claimForm.load_discharge_rate_unit as any) || "per_day"}
                onValueChange={(v: any) => handleClaimFieldChange("load_discharge_rate_unit", v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_day">Per Day</SelectItem>
                  <SelectItem value="per_hour">Per Hour</SelectItem>
                  <SelectItem value="fixed_duration">Fixed Duration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {claimForm.load_discharge_rate_unit === "fixed_duration" && (
            <div className="col-span-12 md:col-span-4 space-y-1">
              <Label>Fixed Hours</Label>
              <Input
                type="number"
                value={claimForm.fixed_rate_duration_hours ?? ""}
                onChange={(e) =>
                  handleClaimFieldChange("fixed_rate_duration_hours", e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
          )}
          <div className="col-span-12 md:col-span-4 space-y-1">
            <Label>Reversible?</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rev2"
                checked={!!claimForm.reversible}
                onCheckedChange={(c) => handleClaimFieldChange("reversible", !!c)}
              />
              <Label htmlFor="rev2" className="text-sm">Reversible laytime</Label>
            </div>
            {claimForm.reversible && (
              <div className="mt-2">
                <Select
                  value={(claimForm.reversible_scope as any) || "all_ports"}
                  onValueChange={(v: any) => handleClaimFieldChange("reversible_scope", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_ports">All ports</SelectItem>
                    <SelectItem value="load_only">Load ports only</SelectItem>
                    <SelectItem value="discharge_only">Discharge ports only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="col-span-12 md:col-span-6 space-y-1">
            <Label>Demurrage Rate</Label>
            <div className="flex gap-2">
              <Select
                value={claimForm.demurrage_currency || "USD"}
                onValueChange={(v: any) => handleClaimFieldChange("demurrage_currency", v)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={claimForm.demurrage_rate ?? ""}
                onChange={(e) =>
                  handleClaimFieldChange("demurrage_rate", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="Per day"
              />
            </div>
          </div>
          <div className="col-span-12 md:col-span-6 space-y-1">
            <Label>Demurrage After</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={claimForm.demurrage_after_hours ?? ""}
                onChange={(e) =>
                  handleClaimFieldChange("demurrage_after_hours", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="Hours"
              />
              <Input
                type="number"
                value={claimForm.demurrage_rate_after ?? ""}
                onChange={(e) =>
                  handleClaimFieldChange("demurrage_rate_after", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="New rate"
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-6 space-y-1">
            <Label>Despatch</Label>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={claimForm.despatch_type || "amount"}
                onValueChange={(v: any) => handleClaimFieldChange("despatch_type", v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="percent">Percent of Demurrage</SelectItem>
                </SelectContent>
              </Select>
              {claimForm.despatch_type === "amount" && (
                <Select
                  value={claimForm.despatch_currency || "USD"}
                  onValueChange={(v: any) => handleClaimFieldChange("despatch_currency", v)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Input
                type="number"
                value={claimForm.despatch_rate_value ?? ""}
                onChange={(e) =>
                  handleClaimFieldChange("despatch_rate_value", e.target.value ? Number(e.target.value) : null)
                }
                className="flex-1"
                placeholder={claimForm.despatch_type === "percent" ? "% of demurrage" : "Rate"}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Quality Check</h2>
            <p className="text-xs text-slate-500">
              Track review status, reviewer, and notes. Only the assigned reviewer (or super admin) can change status/notes once assigned.
            </p>
            {qcLocked && (
              <p className="text-[11px] text-amber-700 mt-1">
                Locked because you are not the assigned reviewer. Ask the reviewer or a super admin to update status/notes.
              </p>
            )}
          </div>
          <Button onClick={() => saveClaimDetails()} disabled={savingClaim || (!canEditQc && !!qcAssignedId)}>
            {savingClaim ? "Saving..." : canEditQc || !qcAssignedId ? "Save QC" : "Locked"}
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={(claimForm.claim_status as any) || ""}
              onValueChange={(v: any) => handleClaimFieldChange("claim_status", v)}
              disabled={!canEditQc && !!qcAssignedId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select claim status" />
              </SelectTrigger>
              <SelectContent>
                {claimStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reviewer</Label>
            <Select
              value={(claimForm.qc_reviewer_id as any) || ""}
              onValueChange={(v: any) => handleClaimFieldChange("qc_reviewer_id", v === "none" ? null : v)}
              disabled={!!qcAssignedId && !canEditQc}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign reviewer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {qcUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} · {u.role} · {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label>Notes</Label>
            <Textarea
              value={claimForm.qc_notes || ""}
              onChange={(e) => handleClaimFieldChange("qc_notes", e.target.value)}
              placeholder="Add QC notes or requested changes"
              rows={3}
              disabled={!canEditQc && !!qcAssignedId}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 border border-slate-200 bg-white shadow-sm rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Attachments</p>
              <p className="text-xs text-slate-500">Upload NOR or SOF files for this claim.</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => document.getElementById("nor-upload")?.click()}
              >
                Upload NOR
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => document.getElementById("sof-upload")?.click()}
              >
                Upload SOF
              </Button>
              <input
                id="nor-upload"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAttachment(f, "nor");
                  e.target.value = "";
                }}
              />
              <input
                id="sof-upload"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAttachment(f, "sof");
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div
            className="mt-2 p-3 border-2 border-dashed border-slate-200 rounded-lg text-center text-sm text-slate-500"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) uploadAttachment(f, "other");
            }}
          >
            Drag & drop files here
          </div>
          {attachments.length === 0 ? (
            <p className="text-sm text-slate-500">No attachments yet.</p>
          ) : (
            <div className="divide-y">
              {attachments.map((a) => (
                <div key={a.id} className="py-2 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800">{a.filename}</p>
                    <p className="text-xs text-slate-500 uppercase">{a.attachment_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={(a as any).signed_url || a.file_url} target="_blank" rel="noreferrer" className="text-ocean-700 text-sm">Download</a>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteAttachment(a.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200" />

        <AddEventForm
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          editing={editingEvent}
          clearEdit={() => setEditingEvent(null)}
          loading={saving}
          portCalls={portCalls}
          claimPortCallId={claim.port_call_id}
          countRules={countRules}
        />

        <div className="border-t border-slate-200" />

        <div className="p-4 border border-slate-200 bg-white shadow-sm rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-700">Statement of Facts Timeline</p>
          </div>
          <p className="text-xs text-slate-500">
            Two-click flow: click a left handle to start a deduction or a right handle to start an addition, then click the end row. A dialog will let you pick the mapped event, comment, and whether to count or deduct. Use the 3-dot menu for laytime/load markers, edit, or delete.
          </p>
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 max-h-[360px] overflow-y-auto">
              <p className="text-sm font-semibold text-slate-800 mb-2">Deductions</p>
              {deductionEvents.length === 0 ? (
                <p className="text-xs text-slate-500">No deductions selected.</p>
              ) : (
                <div className="space-y-2">
                  {deductionEvents.map((d) => (
                    <div key={`ded-${d.id}`} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="text-slate-800">{selectionNotes[d.id]?.tag || d.deduction_name}</span>
                        {selectionNotes[d.id]?.comment && (
                          <span className="text-xs text-slate-500">{selectionNotes[d.id]?.comment}</span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          Rate: {d.rate_of_calculation ?? 100}%
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDate(d.from_datetime)}{d.to_datetime ? ` → ${formatDate(d.to_datetime)}` : ""}
                        </span>
                        <span className="text-[11px] text-rose-600">Deducted</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => {
                          // Delete persisted event if exists
                          if (d.id && !d.id.startsWith("span-")) {
                            fetch(`/api/claims/${params.claimId}/events`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: d.id }),
                            }).catch(() => {});
                          }
                          setDeductionEvents((prev) => {
                            const next = prev.filter((p) => p.id !== d.id);
                            const { [d.id]: _, ...restNotes } = selectionNotes;
                            setSelectionNotes(restNotes);
                            persistSelections(next, additionEvents, restNotes);
                            return next;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-1 border border-slate-200 rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">(-)</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timelineEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-6">
                        No events yet. Add your first SOF event.
                      </TableCell>
                    </TableRow>
                  )}
                  {timelineEvents.map((ev, idx) => {
                    const isSelected = selectedRangeIds.has(ev.id);
                    const fromTs = formatDate(ev.from_datetime);
                    const toTs = ev.to_datetime && ev.to_datetime !== ev.from_datetime ? formatDate(ev.to_datetime) : null;
                    const isLayStart =
                      (claimForm.laytime_start || claim?.laytime_start) &&
                      (ev.from_datetime === (claimForm.laytime_start || claim?.laytime_start) ||
                        ev.to_datetime === (claimForm.laytime_start || claim?.laytime_start));
                    const isLayEnd =
                      (claimForm.laytime_end || claim?.laytime_end) &&
                      (ev.from_datetime === (claimForm.laytime_end || claim?.laytime_end) ||
                        ev.to_datetime === (claimForm.laytime_end || claim?.laytime_end));
                    const isNor =
                      (claimForm.nor_tendered_at || claim?.nor_tendered_at) &&
                      (ev.from_datetime === (claimForm.nor_tendered_at || claim?.nor_tendered_at) ||
                        ev.to_datetime === (claimForm.nor_tendered_at || claim?.nor_tendered_at));
                    const opsLabel = (claimForm.operation_type || claim?.operation_type || "").toLowerCase() === "discharge" ? "Discharge" : "Loading";
                    const loadStartVal = claimForm.loading_start_at || claim?.loading_start_at;
                    const loadEndVal = claimForm.loading_end_at || claim?.loading_end_at;
                    const isLoadStart =
                      loadStartVal &&
                      (ev.from_datetime === loadStartVal || ev.to_datetime === loadStartVal);
                    const isLoadEnd =
                      loadEndVal &&
                      (ev.from_datetime === loadEndVal || ev.to_datetime === loadEndVal);
                    const labels: string[] = [];
                    if (isLayStart) labels.push("Laytime Start");
                    if (isLayEnd) labels.push("Laytime End");
                    if (isNor) labels.push("NOR Tendered");
                    if (isLoadStart) labels.push(`${opsLabel} Start`);
                    if (isLoadEnd) labels.push(`${opsLabel} Completed`);
                    const isDedAnchor = dedStartSet.has(ev.from_datetime) || dedEndSet.has(ev.from_datetime);
                    const isAddAnchor = addStartSet.has(ev.from_datetime) || addEndSet.has(ev.from_datetime);
                    if (dedStartSet.has(ev.from_datetime)) labels.push("Deduction Start");
                    if (dedEndSet.has(ev.from_datetime)) labels.push("Deduction End");
                    if (addStartSet.has(ev.from_datetime)) labels.push("Addition Start");
                    if (addEndSet.has(ev.from_datetime)) labels.push("Addition End");
                    const rowTs = new Date(ev.from_datetime).getTime();
                    const inSpan = spanWindows.some((w) => rowTs >= w.from && rowTs <= w.to);
                    return (
                      <TableRow
                        key={ev.id}
                        className={`${isSelected ? "bg-emerald-50" : ""} ${
                          isLayStart || isLayEnd || isNor || isLoadStart || isLoadEnd ? "border-l-4 border-emerald-500" : ""
                        } ${isDedAnchor ? "border-l-4 border-rose-300" : ""} ${
                          isAddAnchor ? "border-l-4 border-sky-300" : ""
                        } ${inSpan ? "bg-gradient-to-r from-slate-50 to-slate-100" : ""}`}
                      >
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={selectionStart === idx && selectionMode === "deduction" ? "secondary" : "outline"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartSelection("deduction", idx);
                            }}
                          >
                            -
                          </Button>
                        </TableCell>
                        <TableCell className="font-semibold">
                          <div className="text-sm text-slate-900">{ev.displayLabel}</div>
                          {ev.originalLabel && <div className="text-xs text-slate-500">Original: {ev.originalLabel}</div>}
                          {labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {labels.map((lab, i) => (
                                <span key={`${ev.id}-lab-${lab}-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {lab}
                                </span>
                              ))}
                            </div>
                          )}
                          {(ev as any).canonical_event && (
                            <div className="text-[11px] text-emerald-700 mt-1">
                              {(ev as any).canonical_event}
                              {typeof (ev as any).canonical_confidence === "number"
                                ? ` (${Math.round((ev as any).canonical_confidence * 100)}%)`
                                : ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-800">
                          {fromTs}
                          {toTs ? <div className="text-xs text-slate-500">→ {toTs}</div> : null}
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                ⋮
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setEditingEvent(ev)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(ev.id)}>
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleClaimFieldChange("laytime_start", ev.from_datetime || ev.to_datetime || null)}>
                                Set Laytime Start
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleClaimFieldChange("laytime_end", ev.to_datetime || ev.from_datetime || null)}>
                                Set Laytime End
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  handleClaimFieldChange("loading_start_at", ev.from_datetime || ev.to_datetime || null);
                                }}
                              >
                                Set Loading/Disch Start
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  handleClaimFieldChange("loading_end_at", ev.to_datetime || ev.from_datetime || ev.from_datetime || null);
                                }}
                              >
                                Set Loading/Disch End
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  handleClaimFieldChange("nor_tendered_at", ev.from_datetime || ev.to_datetime || null);
                                }}
                              >
                                Set NOR Tendered
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-xs text-slate-600">
                <div className="space-x-2">
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                </div>
                <div>{selectedRangeIds.size} selected</div>
              </div>
            </div>
            <Dialog open={selectionConfirmOpen} onOpenChange={(o) => (!o ? clearSelection() : setSelectionConfirmOpen(o))}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Confirm {selectionMode === "deduction" ? "Deduction" : selectionMode === "addition" ? "Addition" : "Range"} (
                    {selectedRangeIds.size} events)
                  </DialogTitle>
                  <DialogDescription>
                    Pick the mapped event label and optional comment, then choose whether to count or deduct this range.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Mapped Event (type to search)</Label>
                    <div>
                      <Input
                        list="canonical-event-options"
                        value={selectionTag}
                        onChange={(e) => setSelectionTag(e.target.value)}
                        placeholder="Start typing..."
                      />
                      <datalist id="canonical-event-options">
                        {canonicalOptions.map((opt) => (
                          <option key={opt.id} value={opt.label} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Rate (%)</Label>
                    <Input
                      type="number"
                      value={selectionPercent}
                      min={0}
                      max={200}
                      onChange={(e) => setSelectionPercent(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Comment (optional)</Label>
                    <Textarea
                      value={selectionComment}
                      onChange={(e) => setSelectionComment(e.target.value)}
                      placeholder="Notes for this range"
                    />
                  </div>
                </div>
                <DialogFooter className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      applySelectionTo("addition", selectionTag, selectionComment);
                    }}
                  >
                    Count (Add)
                  </Button>
                  <Button
                    onClick={() => {
                      applySelectionTo("deduction", selectionTag, selectionComment);
                    }}
                  >
                    Deduct
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 max-h-[360px] overflow-y-auto">
              <p className="text-sm font-semibold text-slate-800 mb-2">Additions</p>
              {additionEvents.length === 0 ? (
                <p className="text-xs text-slate-500">No additions selected.</p>
              ) : (
                <div className="space-y-2">
                  {additionEvents.map((d) => (
                    <div key={`add-${d.id}`} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="text-slate-800">{selectionNotes[d.id]?.tag || d.deduction_name}</span>
                        {selectionNotes[d.id]?.comment && (
                          <span className="text-xs text-slate-500">{selectionNotes[d.id]?.comment}</span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          Rate: {d.rate_of_calculation ?? 100}%
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDate(d.from_datetime)}{d.to_datetime ? ` → ${formatDate(d.to_datetime)}` : ""}
                        </span>
                        <span className="text-[11px] text-emerald-600">Counted</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => {
                          if (d.id && !d.id.startsWith("span-")) {
                            fetch(`/api/claims/${params.claimId}/events`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: d.id }),
                            }).catch(() => {});
                          }
                          setAdditionEvents((prev) => {
                            const next = prev.filter((p) => p.id !== d.id);
                            const { [d.id]: _, ...restNotes } = selectionNotes;
                            setSelectionNotes(restNotes);
                            persistSelections(deductionEvents, next, restNotes);
                            return next;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border border-slate-200 bg-white shadow-sm rounded-xl">
          <p className="text-sm font-semibold text-slate-700 mb-2">Event Audit Trail</p>
          {audit.length === 0 ? (
            <p className="text-sm text-slate-500">No audit entries yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {audit.map((a) => (
                <div key={a.id} className="text-xs text-slate-600 border-b pb-2">
                  <p className="font-semibold text-slate-800">{a.action.toUpperCase()} · {formatDate(a.created_at)}</p>
                  <p className="break-words text-slate-500">{a.data?.deduction_name || ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border border-slate-200 bg-white shadow-sm rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Comments & Messaging</p>
              <p className="text-xs text-slate-500">Coordinate on this claim with reviewers and operators.</p>
            </div>
            <div className="text-xs text-slate-500">{comments.length} comment{comments.length === 1 ? "" : "s"}</div>
          </div>
          {commentError && <p className="text-xs text-red-600">{commentError}</p>}
          {commentsLoading ? (
            <p className="text-sm text-slate-500">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-500">No comments yet. Start the discussion below.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="p-2 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{c.users?.full_name || "User"}</span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm">Add a comment</Label>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              placeholder="Share updates, questions, or QC feedback..."
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Comments are visible to team members on this claim.</p>
              <Button size="sm" onClick={submitComment} disabled={postingComment}>
                {postingComment ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          </div>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="statement">
          <StatementView
            claim={{ ...claim, ...claimForm } as Claim}
            events={enhancedEvents}
            attachments={attachments}
            audit={audit}
            timeFormat={timeFormat}
            siblings={siblings}
            manualDeductions={deductionEvents}
            manualAdditions={additionEvents}
          />
        </TabsContent>

        <TabsContent value="sof">
          <SofExtractorTab
            claim={{ ...claim, ...claimForm } as Claim}
            events={enhancedEvents}
            attachments={attachments}
            onApplySummary={applySofSummaryToClaim}
            onAttachmentAdded={(att) => setAttachments((prev) => [att, ...prev])}
            timeFormat={timeFormat}
            formatDate={formatDate}
            formatHours={formatHours}
            durationHours={durationHours}
            SofExtractorPanel={SofExtractorPanel}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
