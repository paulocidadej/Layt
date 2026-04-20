import { describe, expect, it } from "vitest";
import { buildClauseProfile, calculateLaytime } from "../src/lib/laytime-engine";

describe("laytime engine clause logic", () => {
  it("excludes weekends under SHEX", () => {
    const result = calculateLaytime({
      voyage: {},
      cpList: [],
      cargoes: [{ id: "c1", quantity: 1000 }],
      portCalls: [{ id: "p1", activity: "load" }],
      profile: {},
      activities: [
        {
          port_call_id: "p1",
          event_type: "OPS",
          from_datetime: "2024-01-05T00:00:00Z", // Friday
          to_datetime: "2024-01-08T00:00:00Z", // Monday
        },
      ],
      deductions: [],
      method: "STANDARD",
      clauseProfile: buildClauseProfile({ working_time_definition: "SHEX" }),
    });

    expect(result.cargoPortRows[0].laytimeUsedMinutes).toBe(1440);
  });

  it("includes weekends under SHINC", () => {
    const result = calculateLaytime({
      voyage: {},
      cpList: [],
      cargoes: [{ id: "c1", quantity: 1000 }],
      portCalls: [{ id: "p1", activity: "load" }],
      profile: {},
      activities: [
        {
          port_call_id: "p1",
          event_type: "OPS",
          from_datetime: "2024-01-05T00:00:00Z",
          to_datetime: "2024-01-08T00:00:00Z",
        },
      ],
      deductions: [],
      method: "STANDARD",
      clauseProfile: buildClauseProfile({ working_time_definition: "SHINC" }),
    });

    expect(result.cargoPortRows[0].laytimeUsedMinutes).toBe(4320);
  });

  it("excludes holiday windows", () => {
    const clauseProfile = buildClauseProfile({
      working_time_definition: "SHEX",
      default_count_rules: {
        holidays: [
          { start: "2024-01-05T00:00:00Z", end: "2024-01-06T00:00:00Z", name: "Holiday" },
        ],
      },
    });

    const result = calculateLaytime({
      voyage: {},
      cpList: [],
      cargoes: [{ id: "c1", quantity: 1000 }],
      portCalls: [{ id: "p1", activity: "load" }],
      profile: {},
      activities: [
        {
          port_call_id: "p1",
          event_type: "OPS",
          from_datetime: "2024-01-05T00:00:00Z",
          to_datetime: "2024-01-06T00:00:00Z",
        },
      ],
      deductions: [],
      method: "STANDARD",
      clauseProfile,
    });

    expect(result.cargoPortRows[0].laytimeUsedMinutes).toBe(0);
  });

  it("applies default count rules", () => {
    const clauseProfile = buildClauseProfile({
      working_time_definition: "SHINC",
      default_count_rules: {
        Weather: "HALF",
      },
    });

    const result = calculateLaytime({
      voyage: {},
      cpList: [],
      cargoes: [{ id: "c1", quantity: 1000 }],
      portCalls: [{ id: "p1", activity: "load" }],
      profile: {},
      activities: [
        {
          port_call_id: "p1",
          event_type: "Weather",
          from_datetime: "2024-01-05T00:00:00Z",
          to_datetime: "2024-01-05T02:00:00Z",
        },
      ],
      deductions: [],
      method: "STANDARD",
      clauseProfile,
    });

    expect(result.cargoPortRows[0].laytimeUsedMinutes).toBe(60);
  });

  it("prorates allowed time by cargo quantity", () => {
    const result = calculateLaytime({
      voyage: {},
      cpList: [{ laytime_allowed_value: 100, laytime_allowed_unit: "TONNES_PER_DAY", proration_allowed: true }],
      cargoes: [
        { id: "c1", quantity: 100 },
        { id: "c2", quantity: 300 },
      ],
      portCalls: [{ id: "p1", activity: "load" }],
      profile: {},
      activities: [],
      deductions: [],
      method: "STANDARD",
      prorationPorts: ["p1"],
    });

    const row1 = result.cargoPortRows.find((r) => r.cargoId === "c1");
    const row2 = result.cargoPortRows.find((r) => r.cargoId === "c2");
    expect(Math.round(row1?.laytimeAllowedMinutes || 0)).toBe(1440);
    expect(Math.round(row2?.laytimeAllowedMinutes || 0)).toBe(4320);
  });
});
