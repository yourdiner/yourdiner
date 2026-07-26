import { describe, expect, it } from "vitest";
import {
  isDiningSessionActive,
  isOrderActive,
  isTableOccupiedByDiningSession,
} from "@/lib/dining-lifecycle";

describe("dining-lifecycle helpers", () => {
  it("treats ACTIVE and BILL_REQUESTED as open dining sessions", () => {
    expect(isDiningSessionActive("ACTIVE")).toBe(true);
    expect(isDiningSessionActive("BILL_REQUESTED")).toBe(true);
    expect(isDiningSessionActive("CLOSED")).toBe(false);
    expect(isDiningSessionActive("CANCELLED")).toBe(false);
    expect(isDiningSessionActive(null)).toBe(false);
  });

  it("treats non-terminal orders as active", () => {
    expect(isOrderActive("PENDING")).toBe(true);
    expect(isOrderActive("SERVED")).toBe(true);
    expect(isOrderActive("OUT_FOR_DELIVERY")).toBe(true);
    expect(isOrderActive("COMPLETED")).toBe(false);
    expect(isOrderActive("CANCELLED")).toBe(false);
  });

  it("occupies a table only from an open DiningSession", () => {
    expect(isTableOccupiedByDiningSession({ status: "ACTIVE" })).toBe(true);
    expect(isTableOccupiedByDiningSession({ status: "BILL_REQUESTED" })).toBe(true);
    expect(isTableOccupiedByDiningSession({ status: "CLOSED" })).toBe(false);
    expect(isTableOccupiedByDiningSession(null)).toBe(false);
  });
});
