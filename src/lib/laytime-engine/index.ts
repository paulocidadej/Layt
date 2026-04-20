// Laytime engine scaffold (pure TS, no IO)
// Deterministic functions to be expanded with full rules (reversible, proration, cargo match, once-on-demurrage).

export type CalculationMethod = "STANDARD" | "REVERSIBLE" | "AVERAGE";
export type WorkingTimeDefinition = "SHEX" | "SHINC" | "WWD" | "CUSTOM";
export type NorStartTrigger = "NOR_TENDERED" | "NOR_ACCEPTED" | "CUSTOM_DATE";
export type RoundingRule = "EXACT" | "ROUND_UP_HOUR" | "ROUND_DOWN_HOUR";
export type CountBehavior = "FULL" | "HALF" | "NONE" | { percent: number };

export type HolidayWindow = {
  start: string;
  end: string;
  name?: string;
};

export type ClauseProfile = {
  workingTimeDefinition?: WorkingTimeDefinition | null;
  norStartTrigger?: NorStartTrigger | null;
  norOffsetHours?: number | null;
  startNextWorkingPeriod?: boolean | null;
  roundingRule?: RoundingRule | null;
  defaultCountRules?: Record<string, CountBehavior> | null;
  holidayWindows?: HolidayWindow[];
};

export function buildClauseProfile(profile?: any, overrides?: Partial<ClauseProfile>): ClauseProfile {
  const defaultRules = (profile?.default_count_rules as Record<string, CountBehavior>) || {};
  const holidayWindows = Array.isArray(defaultRules.holidays)
    ? defaultRules.holidays.map((h: any) => ({
        start: h.start,
        end: h.end,
        name: h.name,
      }))
    : [];

  return {
    workingTimeDefinition: profile?.working_time_definition || "SHINC",
    norStartTrigger: profile?.nor_start_trigger || "NOR_TENDERED",
    norOffsetHours: Number(profile?.nor_offset_hours || 0),
    startNextWorkingPeriod: !!profile?.start_next_working_period,
    roundingRule: profile?.rounding_rule || "EXACT",
    defaultCountRules: defaultRules || {},
    holidayWindows,
    ...(overrides || {}),
  };
}

export interface EngineInput {
  voyage: any;
  cpList: any[]; // expected: charter_parties[]
  cargoes: any[]; // expected: cargoes[]
  portCalls: any[]; // expected: port_calls[]
  profile: any; // laytime_profiles
  activities: any[]; // port_activities[]
  deductions: any[]; // port_deductions_additions[]
  method: CalculationMethod;
  scope?: "all_ports" | "load_only" | "discharge_only";
  reversibleGroups?: string[][];
  prorationPorts?: string[];
  cargoMatchGroups?: string[][];
  clauseProfile?: ClauseProfile;
  holidays?: HolidayWindow[];
}

export interface CargoPortResult {
  cargoId: string;
  portCallId: string;
  laytimeAllowedMinutes: number;
  laytimeUsedMinutes: number;
  deductionsMinutes: number;
  additionsMinutes: number;
  timeOnDemurrageMinutes: number;
  timeOnDespatchMinutes: number;
  reversibleGroupId?: string;
  prorateGroupId?: string;
  cargoMatchGroupId?: string;
}

export interface EngineResult {
  cargoPortRows: CargoPortResult[];
  totals: {
    timeAllowedMinutes: number;
    timeUsedMinutes: number;
    timeOnDemurrageMinutes: number;
    timeOnDespatchMinutes: number;
    demurrageAmount: number;
    despatchAmount: number;
  };
  meta?: {
    laytimeStartDerived?: string | null;
    workingTimeDefinition?: WorkingTimeDefinition | null;
    roundingRule?: RoundingRule | null;
    holidaysApplied?: number;
  };
}

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;

function toUtcDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return (end - start) / 60000;
}

function isNonWorkingDay(date: Date, holidays: HolidayWindow[]) {
  if (isWeekend(date)) return true;
  if (!holidays || holidays.length === 0) return false;
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);
  const dayEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999);
  return holidays.some((h) => {
    const hStart = toUtcDate(h.start);
    const hEnd = toUtcDate(h.end);
    if (!hStart || !hEnd) return false;
    return overlapMinutes(new Date(dayStart), new Date(dayEnd), hStart, hEnd) > 0;
  });
}

function shiftToNextWorkingStart(start: Date, holidays: HolidayWindow[]) {
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
  if (start.getTime() > cursor.getTime()) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  while (isNonWorkingDay(cursor, holidays)) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return cursor;
}

function computeWorkingMinutes(
  from: string,
  to: string,
  workingTimeDefinition: WorkingTimeDefinition,
  holidays: HolidayWindow[]
) {
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  if (!start || !end || end <= start) return 0;
  if (workingTimeDefinition === "SHINC") {
    return (end.getTime() - start.getTime()) / 60000;
  }

  let total = 0;
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0));

  while (cursor <= endDay) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const segmentStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
    const segmentEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));
    if (segmentEnd > segmentStart && !isNonWorkingDay(dayStart, holidays)) {
      let minutes = (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
      for (const h of holidays || []) {
        const hStart = toUtcDate(h.start);
        const hEnd = toUtcDate(h.end);
        if (!hStart || !hEnd) continue;
        minutes -= overlapMinutes(segmentStart, segmentEnd, hStart, hEnd);
      }
      total += Math.max(minutes, 0);
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return total;
}

function convertAllowed(cp: any, cargo: any): number {
  const val = Number(cp?.laytime_allowed_value || 0);
  if (!Number.isFinite(val) || val <= 0) return 0;
  const unit = cp?.laytime_allowed_unit;
  if (unit === "HOURS") return val * 60;
  if (unit === "DAYS") return val * MINUTES_PER_DAY;
  if (unit === "TONNES_PER_DAY") {
    const qty = Number(cargo?.quantity || 0);
    if (qty <= 0) return 0;
    const days = qty / val;
    return days * MINUTES_PER_DAY;
  }
  return 0;
}

function applyCountBehavior(durationMinutes: number, behavior: CountBehavior | null | undefined): number {
  if (!Number.isFinite(durationMinutes)) return 0;
  if (!behavior || typeof behavior === "string") {
    if (behavior === "NONE") return 0;
    if (behavior === "HALF") return durationMinutes * 0.5;
    return durationMinutes;
  }
  if (typeof behavior === "object" && behavior.percent !== undefined) {
    const p = Number(behavior.percent);
    if (Number.isFinite(p)) return durationMinutes * (p / 100);
  }
  return durationMinutes;
}

function allowedForPort(port: any, cp: any, cargo: any): number {
  // If port has allowed_hours (current app behavior), use it (hours -> minutes)
  if (port && port.allowed_hours !== null && port.allowed_hours !== undefined) {
    const hours = Number(port.allowed_hours || 0);
    return Number.isFinite(hours) ? hours * 60 : 0;
  }
  return convertAllowed(cp, cargo);
}

function allowedForPortTotal(port: any, cp: any, totalCargoQty: number): number {
  if (port && port.allowed_hours !== null && port.allowed_hours !== undefined) {
    const hours = Number(port.allowed_hours || 0);
    return Number.isFinite(hours) ? hours * 60 : 0;
  }
  const val = Number(cp?.laytime_allowed_value || 0);
  if (!Number.isFinite(val) || val <= 0) return 0;
  const unit = cp?.laytime_allowed_unit;
  if (unit === "HOURS") return val * 60;
  if (unit === "DAYS") return val * MINUTES_PER_DAY;
  if (unit === "TONNES_PER_DAY") {
    if (!Number.isFinite(totalCargoQty) || totalCargoQty <= 0) return 0;
    const days = totalCargoQty / val;
    return days * MINUTES_PER_DAY;
  }
  return 0;
}

function resolveCountBehavior(
  eventType: string | null | undefined,
  activityBehavior: any,
  defaultRules: Record<string, CountBehavior> | null | undefined
): CountBehavior {
  if (activityBehavior) return activityBehavior as CountBehavior;
  if (eventType && defaultRules && defaultRules[eventType]) return defaultRules[eventType];
  if (defaultRules && defaultRules.default) return defaultRules.default as CountBehavior;
  return "FULL";
}

export function deriveLaytimeStart(activities: any[], profile: ClauseProfile, holidays: HolidayWindow[]) {
  const trigger = profile.norStartTrigger || "NOR_TENDERED";
  const offsetHours = Number(profile.norOffsetHours || 0);
  const triggerEvent =
    trigger === "NOR_ACCEPTED"
      ? activities.find((a: any) => a.event_type === "NOR_ACCEPTED")
      : activities.find((a: any) => a.event_type === "NOR_TENDERED" || a.event_type === "NOR");
  if (!triggerEvent?.from_datetime) return null;
  const base = toUtcDate(triggerEvent.from_datetime);
  if (!base) return null;
  const start = new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
  if (profile.startNextWorkingPeriod) {
    return shiftToNextWorkingStart(start, holidays).toISOString();
  }
  return start.toISOString();
}

export function calculateLaytime(input: EngineInput): EngineResult {
  const cp = input.cpList?.[0] || null; // basic: single CP
  const defaultRules = (input.clauseProfile?.defaultCountRules || {}) as Record<string, CountBehavior>;
  const workingTimeDefinition = (input.clauseProfile?.workingTimeDefinition ||
    input.profile?.working_time_definition ||
    "SHINC") as WorkingTimeDefinition;
  const holidays = [
    ...(input.clauseProfile?.holidayWindows || []),
    ...(input.holidays || []),
  ];
  const scope = input.scope || "all_ports";
  const filteredPortCalls = (input.portCalls || []).filter((pc: any) => {
    if (scope === "load_only") return pc.activity === "load";
    if (scope === "discharge_only") return pc.activity === "discharge";
    return true;
  });
  const rows: CargoPortResult[] = [];

  input.cargoes.forEach((cargo: any) => {
    filteredPortCalls.forEach((pc: any) => {
      const allowed = allowedForPort(pc, cp, cargo);
      const portActs = (input.activities || []).filter((a: any) => a.port_call_id === pc.id);
      const portDeds = (input.deductions || []).filter((d: any) => d.port_call_id === pc.id);

      const usedRaw = portActs.reduce((sum: number, act: any) => {
        let dur = Number(act.duration_minutes || 0);
        if (act.from_datetime && act.to_datetime) {
          dur = computeWorkingMinutes(
            act.from_datetime,
            act.to_datetime,
            workingTimeDefinition,
            holidays
          );
        }
        const behavior = resolveCountBehavior(act.event_type, act.count_behavior, defaultRules);
        const adj = applyCountBehavior(dur, behavior);
        return sum + adj;
      }, 0);

      const deductions = portDeds
        .filter((d: any) => d.type === "DEDUCTION" && (!d.applies_to_cargo_ids?.length || d.applies_to_cargo_ids.includes(cargo.id)))
        .reduce((sum: number, d: any) => {
          if (d.flat_duration_minutes) return sum + Number(d.flat_duration_minutes || 0);
          if (d.from_datetime && d.to_datetime) {
            const start = new Date(d.from_datetime).getTime();
            const end = new Date(d.to_datetime).getTime();
            if (end > start) return sum + (end - start) / 60000;
          }
          return sum;
        }, 0);

      const additions = portDeds
        .filter((d: any) => d.type === "ADDITION" && (!d.applies_to_cargo_ids?.length || d.applies_to_cargo_ids.includes(cargo.id)))
        .reduce((sum: number, d: any) => {
          if (d.flat_duration_minutes) return sum + Number(d.flat_duration_minutes || 0);
          if (d.from_datetime && d.to_datetime) {
            const start = new Date(d.from_datetime).getTime();
            const end = new Date(d.to_datetime).getTime();
            if (end > start) return sum + (end - start) / 60000;
          }
          return sum;
        }, 0);

      const used = Math.max(usedRaw - deductions + additions, 0);
      rows.push({
        cargoId: cargo.id,
        portCallId: pc.id,
        laytimeAllowedMinutes: allowed,
        laytimeUsedMinutes: used,
        deductionsMinutes: deductions,
        additionsMinutes: additions,
        timeOnDemurrageMinutes: 0, // set after grouping
        timeOnDespatchMinutes: 0,
      });
    });
  });

  if (Array.isArray(input.prorationPorts) && input.prorationPorts.length > 0 && cp?.proration_allowed) {
    const qtyByCargo = new Map(
      (input.cargoes || []).map((c: any) => [c.id, Number(c.quantity || 0)])
    );
    const portMap = new Map((input.portCalls || []).map((p: any) => [p.id, p]));
    input.prorationPorts.forEach((portCallId) => {
      const portRows = rows.filter((r) => r.portCallId === portCallId);
      const totalQty = portRows.reduce((sum, r) => sum + (qtyByCargo.get(r.cargoId) || 0), 0);
      const port = portMap.get(portCallId);
      const totalAllowed = allowedForPortTotal(port, cp, totalQty);
      if (totalAllowed <= 0 || totalQty <= 0) return;
      portRows.forEach((r) => {
        const qty = qtyByCargo.get(r.cargoId) || 0;
        const share = qty / totalQty;
        r.laytimeAllowedMinutes = totalAllowed * share;
        r.prorateGroupId = `prorate-${portCallId}`;
      });
    });
  }

  if (Array.isArray(input.cargoMatchGroups) && input.cargoMatchGroups.length > 0) {
    input.cargoMatchGroups.forEach((group, idx) => {
      rows.forEach((r) => {
        if (group.includes(r.cargoId)) {
          r.cargoMatchGroupId = `cargo-${idx}`;
        }
      });
    });
  }

  // Grouping for reversible (optional)
  const groupIds = input.method === "REVERSIBLE"
    ? (input.reversibleGroups && input.reversibleGroups.length > 0
        ? input.reversibleGroups
        : [input.portCalls.map((p: any) => p.id)])
    : input.portCalls.map((p: any) => [p.id]);

  let totalDem = 0;
  let totalDesp = 0;

  groupIds.forEach((group, idx) => {
    const groupRows = rows.filter((r) => group.includes(r.portCallId));
    const groupAllowed = groupRows.reduce((s, r) => s + (r.laytimeAllowedMinutes || 0), 0);
    const groupUsed = groupRows.reduce((s, r) => s + (r.laytimeUsedMinutes || 0), 0);
    const over = groupUsed - groupAllowed;

    if (over > 0 && groupUsed > 0) {
      groupRows.forEach((r) => {
        const share = r.laytimeUsedMinutes / groupUsed;
        const dem = over * share;
        r.timeOnDemurrageMinutes = dem;
        r.reversibleGroupId = input.method === "REVERSIBLE" ? `rev-${idx}` : undefined;
        totalDem += dem;
      });
    } else if (over < 0 && groupAllowed > 0) {
      const under = Math.abs(over);
      groupRows.forEach((r) => {
        const share = r.laytimeAllowedMinutes / groupAllowed;
        const desp = under * share;
        r.timeOnDespatchMinutes = desp;
        r.reversibleGroupId = input.method === "REVERSIBLE" ? `rev-${idx}` : undefined;
        totalDesp += desp;
      });
    }
  });

  let usedMinutesTotal = rows.reduce((sum, r) => sum + (r.laytimeUsedMinutes || 0), 0);
  const roundingRule = (input.clauseProfile?.roundingRule ||
    input.profile?.rounding_rule ||
    "EXACT") as RoundingRule;
  if (roundingRule === "ROUND_UP_HOUR") {
    usedMinutesTotal = Math.ceil(usedMinutesTotal / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  } else if (roundingRule === "ROUND_DOWN_HOUR") {
    usedMinutesTotal = Math.floor(usedMinutesTotal / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.timeAllowedMinutes += r.laytimeAllowedMinutes;
      acc.timeUsedMinutes += r.laytimeUsedMinutes;
      acc.timeOnDemurrageMinutes += r.timeOnDemurrageMinutes;
      acc.timeOnDespatchMinutes += r.timeOnDespatchMinutes;
      return acc;
    },
    {
      timeAllowedMinutes: 0,
      timeUsedMinutes: 0,
      timeOnDemurrageMinutes: 0,
      timeOnDespatchMinutes: 0,
      demurrageAmount: 0,
      despatchAmount: 0,
    }
  );

  if (cp) {
    totals.demurrageAmount = (totals.timeOnDemurrageMinutes / MINUTES_PER_DAY) * Number(cp.demurrage_rate_per_day || 0);
    totals.despatchAmount = (totals.timeOnDespatchMinutes / MINUTES_PER_DAY) * Number(cp.despatch_rate_per_day || 0);
  }

  totals.timeUsedMinutes = usedMinutesTotal;

  return {
    cargoPortRows: rows,
    totals,
    meta: {
      laytimeStartDerived: deriveLaytimeStart(input.activities || [], input.clauseProfile || {}, holidays),
      workingTimeDefinition,
      roundingRule,
      holidaysApplied: holidays.length,
    },
  };
}
