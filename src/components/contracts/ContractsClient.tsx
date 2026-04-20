"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Voyage = { id: string; voyage_reference: string; tenant_id?: string | null };
type Contract = {
  id: string;
  name?: string | null;
  cp_number?: string | null;
  clause_profile?: any;
  voyage_id?: string | null;
  created_at?: string;
  tenant_id?: string | null;
};

const defaultClauseProfile = {
  workingTimeDefinition: "SHINC",
  norStartTrigger: "NOR_TENDERED",
  norOffsetHours: 0,
  startNextWorkingPeriod: false,
  roundingRule: "EXACT",
  defaultCountRules: {
    weather: 100,
    "gear delay": 100,
    "vessel breakdown": 100,
    "shore breakdown": 100,
    "shift change": 100,
    "custom stoppage": 100,
  },
  holidayWindows: [],
};

function ContractDialog({
  contract,
  voyages,
  onSaved,
}: {
  contract?: Contract | null;
  voyages: Voyage[];
  onSaved: (c: Contract) => void;
}) {
  const [open, setOpen] = useState(false);
  const [contractName, setContractName] = useState(contract?.name || "");
  const [cpNumber, setCpNumber] = useState(contract?.cp_number || "");
  const [voyageId, setVoyageId] = useState(contract?.voyage_id || "none");
  const [workingTime, setWorkingTime] = useState(
    contract?.clause_profile?.workingTimeDefinition || defaultClauseProfile.workingTimeDefinition
  );
  const [norStartTrigger, setNorStartTrigger] = useState(
    contract?.clause_profile?.norStartTrigger || defaultClauseProfile.norStartTrigger
  );
  const [norOffset, setNorOffset] = useState<number>(
    Number(contract?.clause_profile?.norOffsetHours || 0)
  );
  const [roundingRule, setRoundingRule] = useState(
    contract?.clause_profile?.roundingRule || defaultClauseProfile.roundingRule
  );
  const [startNextWorking, setStartNextWorking] = useState(
    !!contract?.clause_profile?.startNextWorkingPeriod
  );
  const [weatherCount, setWeatherCount] = useState<number>(
    Number(contract?.clause_profile?.defaultCountRules?.weather ?? 100)
  );
  const [gearCount, setGearCount] = useState<number>(
    Number(contract?.clause_profile?.defaultCountRules?.["gear delay"] ?? 100)
  );
  const [vesselBreakdownCount, setVesselBreakdownCount] = useState<number>(
    Number(contract?.clause_profile?.defaultCountRules?.["vessel breakdown"] ?? 100)
  );
  const [shoreBreakdownCount, setShoreBreakdownCount] = useState<number>(
    Number(contract?.clause_profile?.defaultCountRules?.["shore breakdown"] ?? 100)
  );
  const [shiftChangeCount, setShiftChangeCount] = useState<number>(
    Number(contract?.clause_profile?.defaultCountRules?.["shift change"] ?? 100)
  );
  const [customStoppageCount, setCustomStoppageCount] = useState<number>(
    Number(contract?.clause_profile?.defaultCountRules?.["custom stoppage"] ?? 100)
  );
  const [holidayWindows, setHolidayWindows] = useState<{ start: string; end: string; name?: string }[]>(
    Array.isArray(contract?.clause_profile?.holidayWindows) ? contract?.clause_profile?.holidayWindows : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContractName(contract?.name || "");
    setCpNumber(contract?.cp_number || "");
    setVoyageId(contract?.voyage_id || "none");
    setWorkingTime(contract?.clause_profile?.workingTimeDefinition || defaultClauseProfile.workingTimeDefinition);
    setNorStartTrigger(contract?.clause_profile?.norStartTrigger || defaultClauseProfile.norStartTrigger);
    setNorOffset(Number(contract?.clause_profile?.norOffsetHours || 0));
    setRoundingRule(contract?.clause_profile?.roundingRule || defaultClauseProfile.roundingRule);
    setStartNextWorking(!!contract?.clause_profile?.startNextWorkingPeriod);
    setWeatherCount(Number(contract?.clause_profile?.defaultCountRules?.weather ?? 100));
    setGearCount(Number(contract?.clause_profile?.defaultCountRules?.["gear delay"] ?? 100));
    setVesselBreakdownCount(Number(contract?.clause_profile?.defaultCountRules?.["vessel breakdown"] ?? 100));
    setShoreBreakdownCount(Number(contract?.clause_profile?.defaultCountRules?.["shore breakdown"] ?? 100));
    setShiftChangeCount(Number(contract?.clause_profile?.defaultCountRules?.["shift change"] ?? 100));
    setCustomStoppageCount(Number(contract?.clause_profile?.defaultCountRules?.["custom stoppage"] ?? 100));
    setHolidayWindows(Array.isArray(contract?.clause_profile?.holidayWindows) ? contract?.clause_profile?.holidayWindows : []);
    setError(null);
  }, [open, contract]);

  const updateHolidayWindow = (idx: number, field: "start" | "end" | "name", value: string) => {
    setHolidayWindows((prev) =>
      prev.map((win, i) => (i === idx ? { ...win, [field]: value } : win))
    );
  };

  const addHolidayWindow = () => {
    setHolidayWindows((prev) => [...prev, { start: "", end: "", name: "" }]);
  };

  const removeHolidayWindow = (idx: number) => {
    setHolidayWindows((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!contractName.trim()) {
      setError("Contract / CP is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const cleanedHolidayWindows = holidayWindows
      .filter((w) => w.start && w.end)
      .map((w) => ({ start: w.start, end: w.end, name: w.name || "Holiday" }));
    const clause_profile = {
      workingTimeDefinition: workingTime,
      norStartTrigger,
      norOffsetHours: Number(norOffset || 0),
      startNextWorkingPeriod: startNextWorking,
      roundingRule,
      defaultCountRules: {
        weather: weatherCount,
        "gear delay": gearCount,
        "vessel breakdown": vesselBreakdownCount,
        "shore breakdown": shoreBreakdownCount,
        "shift change": shiftChangeCount,
        "custom stoppage": customStoppageCount,
      },
      holidayWindows: cleanedHolidayWindows,
    };

    try {
      const res = await fetch("/api/contracts", {
        method: contract?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contract?.id,
          name: contractName.trim(),
          cp_number: cpNumber.trim() || null,
          voyage_id: voyageId === "none" ? null : voyageId,
          clause_profile,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      onSaved(json.contract);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{contract ? "Edit Contract" : "Add Contract/CP"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{contract ? "Edit Contract/CP" : "Add Contract/CP"}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Contract / CP</Label>
            <Input value={contractName} onChange={(e) => setContractName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CP Number</Label>
            <Input value={cpNumber} onChange={(e) => setCpNumber(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Voyage (optional)</Label>
            <Select value={voyageId} onValueChange={setVoyageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {voyages.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.voyage_reference}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Working Time</Label>
            <Select value={workingTime} onValueChange={setWorkingTime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SHINC">SHINC</SelectItem>
                <SelectItem value="SHEX">SHEX</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>NOR Trigger</Label>
            <Select value={norStartTrigger} onValueChange={setNorStartTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NOR_TENDERED">Tendered</SelectItem>
                <SelectItem value="NOR_ACCEPTED">Accepted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>NOR Offset (hours)</Label>
            <Input type="number" value={norOffset} onChange={(e) => setNorOffset(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-1">
            <Label>Rounding</Label>
            <Select value={roundingRule} onValueChange={setRoundingRule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXACT">Exact</SelectItem>
                <SelectItem value="ROUND_UP_HOUR">Round up</SelectItem>
                <SelectItem value="ROUND_DOWN_HOUR">Round down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Start Next Working Period</Label>
            <div className="flex items-center gap-2">
              <Checkbox checked={startNextWorking} onCheckedChange={(v) => setStartNextWorking(!!v)} />
              <span className="text-sm text-slate-600">Enable</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Holiday Windows</Label>
            <Button type="button" variant="outline" size="sm" onClick={addHolidayWindow}>
              Add window
            </Button>
          </div>
          {holidayWindows.length === 0 && (
            <p className="text-xs text-slate-500">No holiday windows yet.</p>
          )}
          {holidayWindows.map((win, idx) => (
            <div key={`${win.start}-${idx}`} className="grid md:grid-cols-3 gap-2">
              <Input
                type="datetime-local"
                value={win.start}
                onChange={(e) => updateHolidayWindow(idx, "start", e.target.value)}
                placeholder="Start"
              />
              <Input
                type="datetime-local"
                value={win.end}
                onChange={(e) => updateHolidayWindow(idx, "end", e.target.value)}
                placeholder="End"
              />
              <div className="flex gap-2">
                <Input
                  value={win.name || ""}
                  onChange={(e) => updateHolidayWindow(idx, "name", e.target.value)}
                  placeholder="Name (optional)"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => removeHolidayWindow(idx)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Weather Delay (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={weatherCount}
              onChange={(e) => setWeatherCount(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-1">
            <Label>Gear Delay (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={gearCount}
              onChange={(e) => setGearCount(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-1">
            <Label>Vessel Breakdown (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={vesselBreakdownCount}
              onChange={(e) => setVesselBreakdownCount(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-1">
            <Label>Shore Breakdown (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={shoreBreakdownCount}
              onChange={(e) => setShoreBreakdownCount(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-1">
            <Label>Shift Change (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={shiftChangeCount}
              onChange={(e) => setShiftChangeCount(Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-1">
            <Label>Custom Stoppage (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={customStoppageCount}
              onChange={(e) => setCustomStoppageCount(Number(e.target.value || 0))}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Contract"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractsClient({
  contracts,
  voyages,
  isSuperAdmin,
}: {
  contracts: Contract[];
  voyages: Voyage[];
  isSuperAdmin: boolean;
}) {
  const [rows, setRows] = useState<Contract[]>(contracts || []);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter((c) => {
      const target = `${c.name || ""} ${c.cp_number || ""}`.toLowerCase();
      return target.includes(search.toLowerCase());
    });
  }, [rows, search]);

  const voyageLabel = (id?: string | null) => {
    if (!id) return "—";
    const v = voyages.find((x) => x.id === id);
    return v?.voyage_reference || "—";
  };

  const onSaved = (contract: Contract) => {
    setRows((prev) => {
      const existing = prev.find((p) => p.id === contract.id);
      if (!existing) return [contract, ...prev];
      return prev.map((p) => (p.id === contract.id ? contract : p));
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/70 backdrop-blur rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Contracts / CPs</h1>
          <p className="text-sm text-slate-600">Define contract clauses and counting rules.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Input
            placeholder="Search contract / CP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <ContractDialog voyages={voyages} onSaved={onSaved} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-semibold text-slate-700">Contract / CP</th>
              <th className="text-left p-3 font-semibold text-slate-700">CP No.</th>
              <th className="text-left p-3 font-semibold text-slate-700">Voyage</th>
              <th className="text-left p-3 font-semibold text-slate-700">Working Time</th>
              <th className="text-left p-3 font-semibold text-slate-700">NOR Offset</th>
              <th className="text-right p-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">No contracts yet.</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-800 font-semibold">{c.name || "—"}</td>
                  <td className="p-3 text-slate-600">{c.cp_number || "—"}</td>
                  <td className="p-3 text-slate-600">{voyageLabel(c.voyage_id)}</td>
                  <td className="p-3 text-slate-600">{c.clause_profile?.workingTimeDefinition || "SHINC"}</td>
                  <td className="p-3 text-slate-600">{c.clause_profile?.norOffsetHours || 0}h</td>
                  <td className="p-3 text-right">
                    <ContractDialog contract={c} voyages={voyages} onSaved={onSaved} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
