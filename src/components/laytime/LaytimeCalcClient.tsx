"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PortCall = { id: string; port_name: string; activity?: string | null; sequence?: number | null };
type Activity = any;
type Deduction = any;
type Cargo = { id: string; cargo_name: string; quantity?: number | null; unit?: string | null };
type CP = { id: string; name?: string | null; demurrage_rate_per_day?: number | null; despatch_rate_per_day?: number | null; laytime_allowed_value?: number | null; laytime_allowed_unit?: string | null };

export default function LaytimeCalcClient({
  calc,
  portCalls,
  cargoes,
  cps,
  activities,
  deductions,
  rows,
}: {
  calc: any;
  portCalls: PortCall[];
  cargoes: Cargo[];
  cps: CP[];
  activities: Activity[];
  deductions: Deduction[];
  rows: any[];
}) {
  const [activityForm, setActivityForm] = useState({ port_call_id: portCalls[0]?.id || "", event_type: "SOF_EVENT", duration_minutes: 60, count_behavior: "FULL" });
  const [dedForm, setDedForm] = useState({ port_call_id: portCalls[0]?.id || "", type: "DEDUCTION", minutes: 60 });
  const [acts, setActs] = useState<Activity[]>(activities || []);
  const [deds, setDeds] = useState<Deduction[]>(deductions || []);
  const [resultRows, setResultRows] = useState(rows || []);
  const [totals, setTotals] = useState(calc ? {
    timeAllowedMinutes: calc.time_allowed_minutes || 0,
    timeUsedMinutes: calc.time_used_minutes || 0,
    timeOnDemurrageMinutes: calc.time_on_demurrage_minutes || 0,
    timeOnDespatchMinutes: calc.time_on_despatch_minutes || 0,
    demurrageAmount: calc.demurrage_amount || 0,
    despatchAmount: calc.despatch_amount || 0,
  } : null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<string>("all_ports");

  const addActivity = async () => {
    if (!activityForm.port_call_id) return alert("Select a port");
    setLoading(true);
    try {
      const res = await fetch(`/api/laytime-calculations/${calc.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port_call_id: activityForm.port_call_id,
          event_type: activityForm.event_type,
          duration_minutes: activityForm.duration_minutes,
          count_behavior: activityForm.count_behavior,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add");
      setActs((prev) => [...prev, json.activity]);
    } catch (e: any) {
      alert(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const addDeduction = async () => {
    if (!dedForm.port_call_id) return alert("Select a port");
    setLoading(true);
    try {
      const res = await fetch(`/api/laytime-calculations/${calc.id}/deductions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port_call_id: dedForm.port_call_id,
          type: dedForm.type,
          flat_duration_minutes: dedForm.minutes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add");
      setDeds((prev) => [...prev, json.item]);
    } catch (e: any) {
      alert(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const recalc = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/laytime-calculations/${calc.id}/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to recalc");
      setResultRows(json.result.cargoPortRows || []);
      setTotals(json.result.totals || null);
    } catch (e: any) {
      alert(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
        Test-only laytime workspace (beta). This UI uses the new laytime tables and engine stub; it does not replace the existing claim calculator.
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow p-5">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Laytime Calculation</h1>
        <p className="text-sm text-slate-600">Voyage {calc.voyage_id} · Method {calc.calculation_method}</p>
        <p className="text-xs text-slate-500">Charter parties: {cps.length || "None"} · Cargoes: {cargoes.length || "None"}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Add Activity</h2>
          <div className="grid grid-cols-2 gap-2">
            <Select value={activityForm.port_call_id} onValueChange={(v) => setActivityForm((p) => ({ ...p, port_call_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Port" />
              </SelectTrigger>
              <SelectContent>
                {portCalls.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.port_name} ({p.activity || ""})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activityForm.count_behavior} onValueChange={(v) => setActivityForm((p) => ({ ...p, count_behavior: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">Full</SelectItem>
                <SelectItem value="HALF">Half</SelectItem>
                <SelectItem value="NONE">None</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={activityForm.duration_minutes}
              onChange={(e) => setActivityForm((p) => ({ ...p, duration_minutes: Number(e.target.value) }))}
              placeholder="Duration (minutes)"
            />
            <Button onClick={addActivity} disabled={loading}>Add</Button>
          </div>
          <div className="space-y-1">
            {acts.length === 0 ? (
              <p className="text-sm text-slate-500">No activities yet.</p>
            ) : acts.map((a: any) => (
              <p key={a.id} className="text-xs text-slate-700">{a.event_type} · {a.duration_minutes} min · {a.count_behavior}</p>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Add Deduction/Addition</h2>
          <div className="grid grid-cols-2 gap-2">
            <Select value={dedForm.port_call_id} onValueChange={(v) => setDedForm((p) => ({ ...p, port_call_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Port" />
              </SelectTrigger>
              <SelectContent>
                {portCalls.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.port_name} ({p.activity || ""})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dedForm.type} onValueChange={(v) => setDedForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DEDUCTION">Deduction</SelectItem>
                <SelectItem value="ADDITION">Addition</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={dedForm.minutes}
              onChange={(e) => setDedForm((p) => ({ ...p, minutes: Number(e.target.value) }))}
              placeholder="Minutes"
            />
            <Button onClick={addDeduction} disabled={loading}>Add</Button>
          </div>
          <div className="space-y-1">
            {deds.length === 0 ? (
              <p className="text-sm text-slate-500">No deductions/additions yet.</p>
            ) : deds.map((d: any) => (
              <p key={d.id} className="text-xs text-slate-700">{d.type} · {d.flat_duration_minutes || 0} min</p>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Results</h2>
          <div className="flex items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_ports">All ports</SelectItem>
                <SelectItem value="load_only">Load only</SelectItem>
                <SelectItem value="discharge_only">Discharge only</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={recalc} disabled={loading}>{loading ? "Recalculating..." : "Recalculate"}</Button>
          </div>
        </div>
        {totals ? (
          <div className="text-sm text-slate-700 space-y-1">
            <p>Allowed: {(totals.timeAllowedMinutes || 0).toFixed(2)} min</p>
            <p>Used: {(totals.timeUsedMinutes || 0).toFixed(2)} min</p>
            <p>Demurrage time: {(totals.timeOnDemurrageMinutes || 0).toFixed(2)} min · Amount {(totals.demurrageAmount || 0).toFixed(2)}</p>
            <p>Despatch time: {(totals.timeOnDespatchMinutes || 0).toFixed(2)} min · Amount {(totals.despatchAmount || 0).toFixed(2)}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No totals yet. Add events and recalc.</p>
        )}
        {calc.calculation_method === "REVERSIBLE" ? (
          <div className="border rounded-lg divide-y">
            {resultRows.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No cargo/port rows yet.</p>
            ) : (
              resultRows.map((r: any) => (
                <div key={`${r.cargoId}-${r.portCallId}`} className="p-3 text-sm text-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="font-semibold">{cargoes.find((c) => c.id === r.cargoId)?.cargo_name || r.cargoId}</p>
                    <p className="text-xs text-slate-500">{portCalls.find((p) => p.id === r.portCallId)?.port_name || r.portCallId}</p>
                  </div>
                  <div className="text-xs text-slate-600 flex flex-wrap gap-3">
                    <span>Allowed {(r.laytimeAllowedMinutes || 0).toFixed(1)}m</span>
                    <span>Used {(r.laytimeUsedMinutes || 0).toFixed(1)}m</span>
                    <span>Ded {(r.deductionsMinutes || 0).toFixed(1)}m</span>
                    <span>Add {(r.additionsMinutes || 0).toFixed(1)}m</span>
                    <span>Dem {(r.timeOnDemurrageMinutes || 0).toFixed(1)}m</span>
                    <span>Desp {(r.timeOnDespatchMinutes || 0).toFixed(1)}m</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Per-port breakdown hidden for non-reversible (totals only).</p>
        )}
      </div>
    </div>
  );
}
