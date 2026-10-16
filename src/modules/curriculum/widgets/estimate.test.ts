import { expect, it } from "vitest";
import { estimate } from "./estimate";

it("computes the chapter's own numbers and all four verdicts", () => {
  const result = estimate({
    dau: 1e8,
    postsPerUser: 2,
    feedOpensPerUser: 20,
    peakMultiplier: 5,
    mediaShare: 0.1,
  });
  expect(result.peakWritesPerSec).toBeCloseTo(11574.074, 2);
  expect(result.peakReadsPerSec).toBeCloseTo(115740.741, 2);
  expect(result.textStoragePerYearBytes).toBe(109.5e12);
  expect(result.mediaPerDayBytes).toBe(40e12);
  expect(result.verdicts).toEqual(
    ["partition", "cache", "cdn", "egress"].map((id) => ({ id, on: true })),
  );
});

it("turns all verdicts off for a small workload", () => {
  const result = estimate({
    dau: 1e6,
    postsPerUser: 1,
    feedOpensPerUser: 1,
    peakMultiplier: 1,
    mediaShare: 0.01,
  });
  expect(result.verdicts.every((verdict) => !verdict.on)).toBe(true);
});

it("uses strict thresholds", () => {
  const result = estimate({
    dau: 86400,
    postsPerUser: 10000,
    feedOpensPerUser: 50000,
    peakMultiplier: 1,
    mediaShare: 0,
  });
  expect(result.verdicts.slice(0, 2).every((verdict) => !verdict.on)).toBe(
    true,
  );
});
