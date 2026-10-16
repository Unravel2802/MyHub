export interface EstimateInput {
  dau: number;
  postsPerUser: number;
  feedOpensPerUser: number;
  peakMultiplier: number;
  mediaShare: number;
}

export interface EstimateResult {
  peakWritesPerSec: number;
  peakReadsPerSec: number;
  textStoragePerYearBytes: number;
  mediaPerDayBytes: number;
  verdicts: { id: "partition" | "cache" | "cdn" | "egress"; on: boolean }[];
}

export function estimate(input: EstimateInput): EstimateResult {
  const posts = input.dau * input.postsPerUser;
  const peakWritesPerSec = (posts / 86400) * input.peakMultiplier;
  const peakReadsPerSec =
    ((input.dau * input.feedOpensPerUser) / 86400) * input.peakMultiplier;
  const mediaPerDayBytes = posts * input.mediaShare * 2e6;
  return {
    peakWritesPerSec,
    peakReadsPerSec,
    textStoragePerYearBytes: posts * 500 * 365 * 3,
    mediaPerDayBytes,
    verdicts: [
      { id: "partition", on: peakWritesPerSec > 10000 },
      { id: "cache", on: peakReadsPerSec > 50000 },
      { id: "cdn", on: mediaPerDayBytes > 1e12 },
      { id: "egress", on: (mediaPerDayBytes / 1e9) * 30 * 0.08 > 50000 },
    ],
  };
}
