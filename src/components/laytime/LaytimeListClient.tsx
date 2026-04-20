"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Calc = { id: string; voyage_id: string; status: string; calculation_method: string; created_at: string };
type Voyage = { id: string; voyage_reference: string };
type CP = { id: string; name?: string | null; voyage_id: string };
type Cargo = { id: string; cargo_name: string; voyage_id: string; quantity?: number | null; unit?: string | null };

export default function LaytimeListClient({
  initialCalcs,
  voyages,
  cps,
  cargoes,
}: {
  initialCalcs: Calc[];
  voyages: Voyage[];
  cps: CP[];
  cargoes: Cargo[];
}) {
  const [calcs, setCalcs] = useState<Calc[]>(initialCalcs);
  const [creating, setCreating] = useState(false);
  const [voyageId, setVoyageId] = useState<string>(voyages[0]?.id || "");
  const [method, setMethod] = useState<string>("STANDARD");

  const filteredCps = cps.filter((c) => c.voyage_id === voyageId);
  const filteredCargoes = cargoes.filter((c) => c.voyage_id === voyageId);

  const formatDateTime = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(d);
  };

  const createCalc = async () => {
    if (!voyageId) return alert("Select a voyage");
    setCreating(true);
    try {
      const res = await fetch("/api/laytime-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voyageId,
          cpIds: filteredCps.map((c) => c.id),
          cargoIds: filteredCargoes.map((c) => c.id),
          method,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      setCalcs((prev) => [json.calculation, ...prev]);
    } catch (e: any) {
      alert(e.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
        Test-only laytime workspace (beta). It does not affect existing claim calculations. Use for experiments with the new laytime tables.
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laytime Calculations</h1>
          <p className="text-sm text-slate-600">Create and open laytime calculations for your voyages.</p>
        </div>
        <div className="flex gap-2">
          <Select value={voyageId} onValueChange={setVoyageId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select voyage" />
            </SelectTrigger>
            <SelectContent>
              {voyages.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.voyage_reference}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">Standard</SelectItem>
              <SelectItem value="REVERSIBLE">Reversible</SelectItem>
              <SelectItem value="AVERAGE">Average</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={createCalc} disabled={creating}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow p-4">
        {calcs.length === 0 ? (
          <p className="text-sm text-slate-500">No laytime calculations yet.</p>
        ) : (
          <div className="divide-y">
            {calcs.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{voyages.find((v) => v.id === c.voyage_id)?.voyage_reference || c.voyage_id}</p>
                  <p className="text-xs text-slate-500">
                    {c.calculation_method} · {c.status} · {formatDateTime(c.created_at)}
                  </p>
                </div>
                <Link className="text-sm font-semibold text-[#1f5da8]" href={`/laytime/${c.id}`}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
