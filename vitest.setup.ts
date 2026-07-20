import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  // Fake only Date. Some store tests use real timers to flush async work.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-15T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});
