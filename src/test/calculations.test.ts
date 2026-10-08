import { describe, expect, it } from "vitest";

import { calc } from "@/routes/index";

describe("daily reading calculations", () => {
  it("includes other collection in total and net amounts", () => {
    expect(
      calc({
        prev: 100,
        today: 120,
        price: 250,
        collection: 1000,
        udhaar: 200,
        given: 150,
        otherCollection: 75,
        expense: 125,
      }),
    ).toEqual({
      diff: 20,
      readingAmount: 5000,
      total: 1275,
      net: 1000,
    });
  });
});
