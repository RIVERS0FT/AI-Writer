import { describe, expect, it } from "vitest";
import { canTransitionGeneration } from "./workflows";

describe("generation workflow", () => {
  it("allows the normal generation path", () => {
    expect(canTransitionGeneration("queued", "building_context")).toBe(true);
    expect(canTransitionGeneration("generating", "saving")).toBe(true);
    expect(canTransitionGeneration("saving", "completed")).toBe(true);
  });

  it("rejects transitions after completion", () => {
    expect(canTransitionGeneration("completed", "queued")).toBe(false);
  });
});
