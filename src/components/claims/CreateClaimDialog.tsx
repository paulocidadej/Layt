"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";

type Voyage = {
  id: string;
  voyage_reference: string;
  tenant_id?: string | null;
  cargo_quantity?: number | null;
  cargo_names?: { name: string | null } | null;
  charter_parties?: { name: string | null } | null;
};
type Tenant = { id: string; name: string };
type Contract = {
  id: string;
  name?: string | null;
  cp_number?: string | null;
  voyage_id?: string | null;
  clause_profile?: any;
};
type VoyageClaim = {
  id: string;
  claim_reference: string;
  port_call_id?: string | null;
  operation_type?: string | null;
  reversible?: boolean | null;
  reversible_scope?: string | null;
  reversible_pool_ids?: string[] | null;
  port_calls?: { id: string; port_name?: string | null; activity?: string | null } | null;
};

interface Props {
  voyages: Voyage[];
  tenantId?: string | null;
  isSuperAdmin: boolean;
  defaultVoyageId?: string;
  defaultPortCallId?: string;
  initialOpen?: boolean;
}

export function CreateClaimDialog({ voyages, tenantId, isSuperAdmin, defaultVoyageId, defaultPortCallId, initialOpen = false }: Props) {
  useSession(); // keep session provider engaged if needed later
  const [open, setOpen] = useState(initialOpen);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenantId || "");

  const [claimRef, setClaimRef] = useState("");
  const [voyageId, setVoyageId] = useState("");
  const [status, setStatus] = useState("created");
  const [operationType, setOperationType] = useState<"load" | "discharge" | "">("");
  const [portName, setPortName] = useState("");
  const [country, setCountry] = useState("");
  const [rateValue, setRateValue] = useState<number | string>("");
  const [rateUnit, setRateUnit] = useState<"per_day" | "per_hour" | "fixed_duration">("per_day");
  const [fixedHours, setFixedHours] = useState<number | string>("");
  const [reversible, setReversible] = useState(false);
  const [demRate, setDemRate] = useState<number | string>("");
  const [demCurrency, setDemCurrency] = useState("USD");
  const [demAfterHours, setDemAfterHours] = useState<number | string>("");
  const [demAfterRate, setDemAfterRate] = useState<number | string>("");
  const [despatchType, setDespatchType] = useState<"amount" | "percent">("amount");
  const [despatchRate, setDespatchRate] = useState<number | string>("");
  const [despatchCurrency, setDespatchCurrency] = useState("USD");
  const [laycanStart, setLaycanStart] = useState("");
  const [laycanEnd, setLaycanEnd] = useState("");
  const [norAt, setNorAt] = useState("");
  const [norAcceptedAt, setNorAcceptedAt] = useState("");
  const [loadStart, setLoadStart] = useState("");
  const [loadEnd, setLoadEnd] = useState("");
  const [laytimeStart, setLaytimeStart] = useState("");
  const [laytimeEnd, setLaytimeEnd] = useState("");
  const [turnTimeMethod, setTurnTimeMethod] = useState("");
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [reversibleScope, setReversibleScope] = useState<"all_ports" | "load_only" | "discharge_only">("all_ports");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ports, setPorts] = useState<{ id: string; name: string }[]>([]);
  const [portText, setPortText] = useState("");
  const [activeField, setActiveField] = useState<string>("");
  const [previewAllowed, setPreviewAllowed] = useState<string>("—");
  const [portCalls, setPortCalls] = useState<{ id: string; port_name: string; activity?: string | null }[]>([]);
  const [portCallId, setPortCallId] = useState<string>("none");
  const [availableClaims, setAvailableClaims] = useState<VoyageClaim[]>([]);
  const [pooledClaimIds, setPooledClaimIds] = useState<string[]>([]);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [showValidationHint, setShowValidationHint] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const resetForm = () => {
    setClaimRef("");
    setVoyageId("");
    setStatus("created");
    setOperationType("");
    setPortName("");
    setCountry("");
    setRateValue("");
    setRateUnit("per_day");
    setFixedHours("");
    setReversible(false);
    setDemRate("");
    setDemCurrency("USD");
    setDemAfterHours("");
    setDemAfterRate("");
    setDespatchType("amount");
    setDespatchRate("");
    setDespatchCurrency("USD");
    setLaycanStart("");
    setLaycanEnd("");
    setNorAt("");
    setNorAcceptedAt("");
    setLoadStart("");
    setLoadEnd("");
    setLaytimeStart("");
    setLaytimeEnd("");
    setTurnTimeMethod("");
    setSelectedContractId("");
    setError(null);
    setPortText("");
    setPorts([]);
    setActiveField("");
    setPreviewAllowed("—");
    setReversibleScope("all_ports");
  };

  useEffect(() => {
    if (isSuperAdmin && open) {
      fetch("/api/admin/tenants")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => setTenants(data.tenants || []))
        .catch(() => setTenants([]));
    }
  }, [isSuperAdmin, open]);

  useEffect(() => {
    if (tenantId) setSelectedTenantId(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (defaultVoyageId) setVoyageId(defaultVoyageId);
  }, [defaultVoyageId]);

  useEffect(() => {
    async function fetchPorts() {
      try {
        const res = await fetch("/api/lookup");
        const json = await res.json();
        if (res.ok && json.data?.ports) {
          setPorts(json.data.ports);
        }
      } catch (e) {
        console.error("Failed to load ports", e);
      }
    }
    if (open) {
      fetchPorts();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const loadContracts = async () => {
      try {
        const query = isSuperAdmin && selectedTenantId ? `?tenantId=${selectedTenantId}` : "";
        const res = await fetch(`/api/contracts${query}`, { signal: controller.signal });
        const json = await res.json();
        if (res.ok) {
          setContracts(json.contracts || []);
        } else {
          setContracts([]);
        }
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          console.error("Failed to load contracts", e);
        }
      }
    };
    loadContracts();
    return () => controller.abort();
  }, [open, isSuperAdmin, selectedTenantId]);

  useEffect(() => {
    async function fetchPortCalls() {
      if (!voyageId) {
        setPortCalls([]);
        setPortCallId("");
        setAvailableClaims([]);
        return;
      }
      try {
        const res = await fetch(`/api/voyages/${voyageId}/port-calls`);
        const json = await res.json();
        if (res.ok) {
          setPortCalls(json.portCalls || []);
          if (defaultPortCallId) {
            setPortCallId(defaultPortCallId);
          }
        }
      } catch (e) {
        console.error("Failed to load port calls", e);
      }
    }
    fetchPortCalls();
  }, [voyageId, defaultPortCallId]);

  useEffect(() => {
    async function fetchClaims() {
      if (!voyageId || !reversible) {
        setAvailableClaims([]);
        setPooledClaimIds([]);
        return;
      }
      try {
        const res = await fetch(`/api/voyages/${voyageId}/claims`);
        const json = await res.json();
        if (res.ok) {
          setAvailableClaims(json.claims || []);
          // Default pool: this form will become a new claim, so we can preselect scoped claims already pooled together
          const scopedIds = (json.claims || [])
            .filter((c: VoyageClaim) => {
              if (!reversibleScope || reversibleScope === "all_ports") return true;
              const act = c.port_calls?.activity || c.operation_type;
              if (reversibleScope === "load_only") return act === "load";
              if (reversibleScope === "discharge_only") return act === "discharge";
              return true;
            })
            .map((c: VoyageClaim) => c.id);
          setPooledClaimIds(scopedIds);
        }
      } catch (e) {
        console.error("Failed to load claims", e);
      }
    }
    fetchClaims();
  }, [voyageId, reversible, reversibleScope]);

  const requestNew = async (name: string) => {
    if (!name) return;
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: "ports", name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit request");
      alert("Request sent to admin for approval.");
    } catch (e: any) {
      alert(e.message || "Request failed");
    }
  };

  const visibleVoyages = isSuperAdmin && selectedTenantId
    ? voyages.filter((v: any) => v.tenant_id === selectedTenantId || !v.tenant_id)
    : voyages;
  const selectedVoyage = visibleVoyages.find((v) => v.id === voyageId);
  const filteredContracts = contracts.filter((c) => {
    if (!voyageId) return true;
    return !c.voyage_id || c.voyage_id === voyageId;
  });
  const selectedContract = contracts.find((c) => c.id === selectedContractId) || null;
  const superAdminDisabled = isSuperAdmin && !selectedTenantId;

  const scopedAvailableClaims = availableClaims.filter((c) => {
    if (!reversible) return false;
    if (!reversibleScope || reversibleScope === "all_ports") return true;
    const act = c.port_calls?.activity || c.operation_type;
    if (reversibleScope === "load_only") return act === "load";
    if (reversibleScope === "discharge_only") return act === "discharge";
    return true;
  });

  useEffect(() => {
    if (!reversible) {
      setPooledClaimIds([]);
      return;
    }
    const validIds = scopedAvailableClaims.map((c) => c.id);
    setPooledClaimIds((prev) => prev.filter((id) => validIds.includes(id)));
  }, [reversible, scopedAvailableClaims.map((c) => c.id).join(",")]);

  useEffect(() => {
    if (!selectedContractId) return;
    const exists = filteredContracts.some((c) => c.id === selectedContractId);
    if (!exists) {
      setSelectedContractId("");
    }
  }, [selectedContractId, filteredContracts.map((c) => c.id).join(",")]);

  const togglePoolClaim = (id: string) => {
    setPooledClaimIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  useEffect(() => {
    const cargoQty = selectedVoyage?.cargo_quantity || 0;
    const rateVal = rateValue ? Number(rateValue) : 0;
    let hours: number | null = null;
    if (rateUnit === "fixed_duration" && fixedHours) {
      hours = Number(fixedHours) || null;
    } else if (rateVal > 0 && cargoQty > 0) {
      if (rateUnit === "per_hour") {
        hours = cargoQty / rateVal;
      } else {
        hours = (cargoQty / rateVal) * 24;
      }
    }
    if (hours === null || Number.isNaN(hours)) {
      setPreviewAllowed("—");
    } else {
      const d = Math.floor(hours / 24);
      const h = Math.floor((hours % 24));
      const m = Math.floor((hours * 60) % 60);
      setPreviewAllowed(`${d}d ${h}h ${m}m`);
    }
  }, [selectedVoyage, rateValue, rateUnit, fixedHours]);

  useEffect(() => {
    if (!portCallId) return;
    const pc = portCalls.find((p) => p.id === portCallId);
    if (pc) {
      if (!portName) setPortName(pc.port_name);
      if (!operationType && (pc.activity === "load" || pc.activity === "discharge")) {
        setOperationType(pc.activity as any);
      }
    }
  }, [portCallId, portCalls, portName, operationType]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSectionError(null);

    if (!voyageId) {
      setError("Voyage is required.");
      setShowValidationHint(true);
      return;
    }
    if (isSuperAdmin && !selectedTenantId) {
      setError("Select a tenant for this claim.");
      setShowValidationHint(true);
      return;
    }
    if (!operationType) {
      setSectionError("Select an operation type.");
      setShowValidationHint(true);
      return;
    }
    if (!portName && portCallId === "none") {
      setSectionError("Provide a port name or choose a port call.");
      setShowValidationHint(true);
      return;
    }
    setShowValidationHint(false);

    setLoading(true);
    try {
      const payload: any = {
        voyage_id: voyageId,
        claim_reference: claimRef || undefined,
        claim_status: status,
        operation_type: operationType || undefined,
        port_name: portName || undefined,
        country: country || undefined,
        load_discharge_rate: rateValue ? Number(rateValue) : null,
        load_discharge_rate_unit: rateUnit,
        fixed_rate_duration_hours: rateUnit === "fixed_duration" && fixedHours ? Number(fixedHours) : null,
        reversible,
        demurrage_rate: demRate ? Number(demRate) : null,
        demurrage_currency: demCurrency,
        demurrage_after_hours: demAfterHours ? Number(demAfterHours) : null,
        demurrage_rate_after: demAfterRate ? Number(demAfterRate) : null,
        despatch_type: despatchType,
        despatch_rate_value: despatchRate ? Number(despatchRate) : null,
        despatch_currency: despatchCurrency,
        laycan_start: laycanStart || null,
        laycan_end: laycanEnd || null,
        nor_tendered_at: norAt || null,
        nor_accepted_at: norAcceptedAt || null,
        loading_start_at: loadStart || null,
        loading_end_at: loadEnd || null,
        laytime_start: laytimeStart || null,
        laytime_end: laytimeEnd || null,
        turn_time_method: turnTimeMethod || null,
        cp_id: selectedContractId || null,
        clause_profile: selectedContract?.clause_profile || {},
        reversible_scope: reversibleScope || "all_ports",
        port_call_id: portCallId === "none" ? null : portCallId,
        reversible_pool_ids: reversible ? pooledClaimIds : [],
      };
      if (isSuperAdmin) {
        payload.tenant_id = selectedTenantId;
      }

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create claim");

      setOpen(false);
      resetForm();
      setSelectedTenantId(tenantId || "");
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          resetForm();
          if (tenantId) setSelectedTenantId(tenantId);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={superAdminDisabled}>Create Claim</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl bg-white max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Create Claim</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4 overflow-y-auto pr-2 text-base leading-relaxed">
            {(error || sectionError) && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error || sectionError}
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Context</p>
                <div className="grid grid-cols-12 gap-4 items-end">
                  {isSuperAdmin && (
                    <div className="col-span-12 md:col-span-6 space-y-1">
                      <Label htmlFor="tenant">Tenant</Label>
                      <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                        <SelectTrigger id="tenant">
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="col-span-12 md:col-span-6 space-y-1">
                    <Label htmlFor="voyage">Voyage</Label>
                    <Select value={voyageId} onValueChange={setVoyageId} disabled={superAdminDisabled}>
                      <SelectTrigger id="voyage">
                        <SelectValue placeholder="Select a voyage" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleVoyages.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.voyage_reference}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showValidationHint && !voyageId && <p className="text-xs text-red-600">Voyage is required.</p>}
                  </div>
                </div>

                {selectedVoyage && (
                  <div className="w-full border rounded-xl p-3 bg-white text-slate-900 space-y-1">
                    <p className="font-semibold">Voyage: <span className="font-normal">{selectedVoyage.voyage_reference}</span></p>
                    <p className="font-semibold">Cargo: <span className="font-normal">{selectedVoyage.cargo_names?.name || "—"} ({selectedVoyage.cargo_quantity || "—"})</span></p>
                    <p className="font-semibold">Charter Party: <span className="font-normal">{selectedVoyage.charter_parties?.name || "—"}</span></p>
                    <p className="text-sm text-slate-600">Allowed time preview: <span className="font-semibold">{previewAllowed}</span></p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Meta</p>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6 space-y-1">
                    <Label htmlFor="claimRef">Claim Reference</Label>
                    <Input
                      id="claimRef"
                      value={claimRef}
                      onChange={(e) => setClaimRef(e.target.value)}
                      placeholder="Optional, auto-generated if empty"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-6 space-y-1">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created">Created</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Operations & Ports</p>
                  <p className="text-xs text-slate-500">Required: operation + port</p>
                </div>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-4 space-y-1">
                    <Label>Operation</Label>
                    <Select value={operationType} onValueChange={(v: any) => setOperationType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Load or Discharge" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="load">Load</SelectItem>
                        <SelectItem value="discharge">Discharge</SelectItem>
                      </SelectContent>
                    </Select>
                    {showValidationHint && !operationType && <p className="text-xs text-red-600">Operation is required.</p>}
                  </div>

                  {portCalls.length > 0 && (
                    <div className="col-span-12 md:col-span-6 space-y-1">
                      <Label>Port Call</Label>
                      <Select value={portCallId} onValueChange={(v) => setPortCallId(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a port call" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {portCalls.map((pc) => (
                            <SelectItem key={pc.id} value={pc.id}>
                              {pc.port_name} · {pc.activity || "other"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="col-span-12 md:col-span-4 space-y-1 relative">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      value={portText}
                      onChange={(e) => {
                        setPortText(e.target.value);
                        setPortName(e.target.value);
                      }}
                      onFocus={() => setActiveField("port")}
                      onBlur={() => setTimeout(() => setActiveField(""), 150)}
                      placeholder="Type or select port"
                    />
                    {activeField === "port" && (
                      <div className="absolute z-30 mt-1 w-full bg-white border rounded shadow-sm text-sm text-gray-700 max-h-40 overflow-auto">
                        {ports
                          .filter((p) => !portText || p.name.toLowerCase().includes(portText.toLowerCase()))
                          .slice(0, 6)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-2 py-1 hover:bg-slate-100"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPortText(p.name);
                                setPortName(p.name);
                              }}
                            >
                              {p.name}
                            </button>
                          ))}
                        <button
                          type="button"
                          className="w-full text-left px-2 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            requestNew(portText || "New port");
                          }}
                        >
                          Request “{portText || "new port"}”
                        </button>
                      </div>
                    )}
                    {showValidationHint && !portName && portCallId === "none" && <p className="text-xs text-red-600">Port is required.</p>}
                  </div>
                  <div className="col-span-12 md:col-span-4 space-y-1">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border rounded-xl p-4 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">Rates & Reversibility</p>
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-12 md:col-span-6 space-y-1">
                <Label>Load/Discharge Rate</Label>
                <div className="flex gap-2">
                  <Input
                      type="number"
                      value={rateValue}
                      onChange={(e) => setRateValue(e.target.value)}
                      placeholder="e.g. 10000"
                    />
                    <Select value={rateUnit} onValueChange={(v: any) => setRateUnit(v)}>
                      <SelectTrigger className="w-40">
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
              {rateUnit === "fixed_duration" && (
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label>Fixed Hours</Label>
                  <Input
                    type="number"
                    value={fixedHours}
                    onChange={(e) => setFixedHours(e.target.value)}
                    placeholder="e.g. 48"
                  />
                </div>
              )}
              <div className="col-span-12 md:col-span-3 space-y-1">
                <Label>Reversible?</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="rev" checked={reversible} onCheckedChange={(c) => setReversible(!!c)} />
                  <Label htmlFor="rev" className="text-sm">Reversible laytime</Label>
                </div>
                {reversible && (
                  <div className="mt-2">
                    <Select value={reversibleScope} onValueChange={(v: any) => setReversibleScope(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_ports">All ports</SelectItem>
                        <SelectItem value="load_only">Load ports only</SelectItem>
                        <SelectItem value="discharge_only">Discharge ports only</SelectItem>
                      </SelectContent>
                    </Select>
                    {scopedAvailableClaims.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-slate-600">Pool with existing claims in this voyage (scope filtered)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                          {scopedAvailableClaims.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 border rounded p-2 bg-white">
                              <Checkbox
                                checked={pooledClaimIds.includes(c.id)}
                                onCheckedChange={() => togglePoolClaim(c.id)}
                              />
                              <span className="flex-1">
                                {c.claim_reference} {c.port_calls?.port_name ? `· ${c.port_calls.port_name}` : ""} {c.port_calls?.activity ? `(${c.port_calls.activity})` : ""}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Demurrage Rate</Label>
                  <div className="flex gap-2">
                    <Select value={demCurrency} onValueChange={(v: any) => setDemCurrency(v)}>
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
                      value={demRate}
                      onChange={(e) => setDemRate(e.target.value)}
                      placeholder="Rate per day"
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Demurrage After</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={demAfterHours}
                      onChange={(e) => setDemAfterHours(e.target.value)}
                      placeholder="Hours before new rate"
                    />
                    <Input
                      type="number"
                      value={demAfterRate}
                      onChange={(e) => setDemAfterRate(e.target.value)}
                      placeholder="New rate"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Despatch</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={despatchType} onValueChange={(v: any) => setDespatchType(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="percent">Percent of Demurrage</SelectItem>
                      </SelectContent>
                    </Select>
                    {despatchType === "amount" && (
                      <Select value={despatchCurrency} onValueChange={(v: any) => setDespatchCurrency(v)}>
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
                      value={despatchRate}
                      onChange={(e) => setDespatchRate(e.target.value)}
                      className="flex-1"
                      placeholder={despatchType === "percent" ? "% of demurrage" : "Rate"}
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Contract / CP</Label>
                  <Select
                    value={selectedContractId || "none"}
                    onValueChange={(v: any) => setSelectedContractId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contract" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No contract</SelectItem>
                      {filteredContracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.cp_number ? `${c.cp_number} · ${c.name || "Contract"}` : c.name || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

              <div className="space-y-4 border rounded-xl p-4 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">Key Dates & Times</p>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6 space-y-1">
                    <Label>Laycan Start</Label>
                  <Input type="datetime-local" value={laycanStart} onChange={(e) => setLaycanStart(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Laycan End</Label>
                  <Input type="datetime-local" value={laycanEnd} onChange={(e) => setLaycanEnd(e.target.value)} />
                </div>

                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>NOR Tendered</Label>
                  <Input type="datetime-local" value={norAt} onChange={(e) => setNorAt(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>NOR Accepted</Label>
                  <Input type="datetime-local" value={norAcceptedAt} onChange={(e) => setNorAcceptedAt(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Loading/Discharge Start</Label>
                  <Input type="datetime-local" value={loadStart} onChange={(e) => setLoadStart(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Loading/Discharge End</Label>
                  <Input type="datetime-local" value={loadEnd} onChange={(e) => setLoadEnd(e.target.value)} />
                </div>

                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Laytime Starts</Label>
                  <Input type="datetime-local" value={laytimeStart} onChange={(e) => setLaytimeStart(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-1">
                  <Label>Laytime Ends</Label>
                  <Input type="datetime-local" value={laytimeEnd} onChange={(e) => setLaytimeEnd(e.target.value)} />
                </div>

                <div className="col-span-12 space-y-1">
                  <Label>Turn Time Method</Label>
                  <Input
                    value={turnTimeMethod}
                    onChange={(e) => setTurnTimeMethod(e.target.value)}
                    placeholder="Free text"
                  />
                </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || superAdminDisabled}>
              {loading ? "Creating..." : "Create Claim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
