import { format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { PrepEntry, BehavioralStory } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

vi.mock("@/src/modules/task/TaskRepository", () => ({
  getTasks: vi.fn(),
  regenerateWeeklyInstances: vi.fn(),
}));
vi.mock("@/src/modules/prep/PrepRepository", () => ({
  getEntries: vi.fn(),
  getStories: vi.fn(),
}));
vi.mock("@/src/modules/jobApplications/ApplicationRepository", () => ({
  getApplications: vi.fn(),
}));
vi.mock("@/src/modules/jobApplications/InterviewRepository", () => ({
  getInterviews: vi.fn(),
}));
vi.mock("@/src/modules/outreach/OutreachRepository", () => ({
  getEntries: vi.fn(),
}));

vi.mock("@/src/modules/finance/FinanceRepository", () => ({
  regenerateMonthlyBillInstances: vi.fn(),
  getTransactions: vi.fn(),
  getBills: vi.fn(),
}));

let listeners: ((event: { type: string }) => void)[] = [];
vi.mock("@/src/lib/events", () => ({
  on: vi.fn((listener: (event: { type: string }) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((registered) => registered !== listener);
    };
  }),
}));

import * as TaskRepository from "@/src/modules/task/TaskRepository";
import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as InterviewRepository from "@/src/modules/jobApplications/InterviewRepository";
import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
import * as FinanceRepository from "@/src/modules/finance/FinanceRepository";
import { on } from "@/src/lib/events";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";

const tasksRepo = vi.mocked(TaskRepository);
const prepRepo = vi.mocked(PrepRepository);
const appsRepo = vi.mocked(ApplicationRepository);
const interviewsRepo = vi.mocked(InterviewRepository);
const outreachRepo = vi.mocked(OutreachRepository);
const financeRepo = vi.mocked(FinanceRepository);
const onMock = vi.mocked(on);

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? null,
    status: overrides.status ?? "todo",
    position: overrides.position ?? 0,
    dueDate: overrides.dueDate ?? null,
    parentTaskId: overrides.parentTaskId ?? null,
    recursWeekly: overrides.recursWeekly ?? false,
    weekday: overrides.weekday ?? null,
    recurrenceTemplateId: overrides.recurrenceTemplateId ?? null,
    occurrenceDate: overrides.occurrenceDate ?? null,
    completedAt: overrides.completedAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-01T00:00:00.000Z",
  };
}

function application(
  overrides: Partial<Application> & { id: string },
): Application {
  return {
    id: overrides.id,
    companyId: overrides.companyId ?? "company-1",
    roleTitle: overrides.roleTitle ?? "Role",
    resumeVariant: overrides.resumeVariant ?? "swe_backend",
    stage: overrides.stage ?? "applied",
    appliedDate: overrides.appliedDate ?? "2026-07-01",
    lastUpdateDate: overrides.lastUpdateDate ?? "2026-07-01",
    referralSource: overrides.referralSource ?? null,
    followUpDate: overrides.followUpDate ?? null,
    notes: overrides.notes ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-01T00:00:00.000Z",
  };
}

function interview(overrides: Partial<Interview> & { id: string }): Interview {
  return {
    id: overrides.id,
    applicationId: overrides.applicationId ?? "app-1",
    roundType: overrides.roundType ?? "coding",
    scheduledAt: overrides.scheduledAt ?? "2026-07-08T15:00:00.000Z",
    completed: overrides.completed ?? false,
    outcome: overrides.outcome ?? null,
    postMortemNotes: overrides.postMortemNotes ?? null,
    completedAt: overrides.completedAt ?? null,
    postMortemLoggedAt: overrides.postMortemLoggedAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-08T15:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-08T15:00:00.000Z",
  };
}

function prepEntry(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
  return {
    id: overrides.id,
    entryType: overrides.entryType ?? "algorithm",
    topic: overrides.topic ?? "graphs",
    date: overrides.date ?? "2026-07-13",
    durationMin: overrides.durationMin ?? 45,
    timeToSolveMin: overrides.timeToSolveMin ?? 30,
    outcome: overrides.outcome ?? "solved",
    mockSubtype: overrides.mockSubtype ?? null,
    notes: overrides.notes ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-13T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-13T00:00:00.000Z",
  };
}

function outreachEntry(
  overrides: Partial<OutreachEntry> & { id: string },
): OutreachEntry {
  return {
    id: overrides.id,
    contactName: overrides.contactName ?? null,
    companyId: overrides.companyId ?? null,
    channel: overrides.channel ?? "linkedin",
    date: overrides.date ?? "2026-07-13",
    notes: overrides.notes ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-13T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-13T00:00:00.000Z",
  };
}

function behavioralStory(
  overrides: Partial<BehavioralStory> & { id: string },
): BehavioralStory {
  return {
    id: overrides.id,
    title: overrides.title ?? "Story",
    theme: overrides.theme ?? null,
    conciseVersion: overrides.conciseVersion ?? null,
    extendedVersion: overrides.extendedVersion ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-13T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-13T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  useDashboardStore.setState({
    scheduleBlocks: [],
    followUps: [],
    postMortemReminders: [],
    prepScorecard: null,
    weakestTopics: [],
    checkpointProgress: null,
    behavioralStoryProgress: null,
    weeklyCadence: null,
    isLoading: false,
    error: null,
  });
  prepRepo.getStories.mockResolvedValue([]);
  outreachRepo.getEntries.mockResolvedValue([]);
  tasksRepo.regenerateWeeklyInstances.mockResolvedValue([]);
  financeRepo.regenerateMonthlyBillInstances.mockResolvedValue([]);
  financeRepo.getTransactions.mockResolvedValue([]);
  financeRepo.getBills.mockResolvedValue([]);
});

describe("useDashboardStore", () => {
  it("fetches and aggregates all five module sources", async () => {
    // Fixtures that must land in the CURRENT week/day use a live `today`, not a
    // fixed string, or these assertions only pass the week the test was written
    // (thisWeeksScheduleBlocks + weeklyCadence compare against the real now).
    // format(), not toISOString(): the latter converts through UTC and can land
    // on the wrong calendar day outside UTC+0 (the bug dashboardSelectors hit).
    const today = format(new Date(), "yyyy-MM-dd");
    tasksRepo.getTasks.mockResolvedValue([
      task({
        id: "recurring",
        recurrenceTemplateId: "template",
        occurrenceDate: today,
      }),
      task({ id: "gate", title: "Gate: July 2026" }),
      task({ id: "gate-child", parentTaskId: "gate" }),
    ]);
    prepRepo.getEntries.mockResolvedValue([prepEntry({ id: "prep" })]);
    prepRepo.getStories.mockResolvedValue([behavioralStory({ id: "story" })]);
    interviewsRepo.getInterviews.mockResolvedValue([
      interview({ id: "interview", completed: true }),
    ]);
    appsRepo.getApplications.mockResolvedValue([
      application({
        id: "app",
        lastUpdateDate: "2026-07-01",
        createdAt: `${today}T00:00:00.000Z`,
      }),
    ]);
    outreachRepo.getEntries.mockResolvedValue([
      outreachEntry({ id: "outreach", date: today }),
    ]);

    await useDashboardStore.getState().fetchAll();

    expect(useDashboardStore.getState()).toMatchObject({
      scheduleBlocks: [expect.objectContaining({ id: "recurring" })],
      followUps: [expect.objectContaining({ id: "app" })],
      postMortemReminders: [
        expect.objectContaining({
          interview: expect.objectContaining({ id: "interview" }),
        }),
      ],
      prepScorecard: expect.objectContaining({ attempted: 1 }),
      weakestTopics: [expect.objectContaining({ topic: "graphs" })],
      checkpointProgress: expect.objectContaining({
        algorithm: expect.objectContaining({ actual: 1 }),
      }),
      behavioralStoryProgress: { actual: 1, target: 8 },
      weeklyCadence: expect.objectContaining({
        applications: expect.objectContaining({ count: 1 }),
        outreach: expect.objectContaining({ count: 1 }),
      }),
      isLoading: false,
      error: null,
    });
  });

  it("subscribes to update events and refetches on relevant ones", async () => {
    tasksRepo.getTasks.mockResolvedValue([]);
    prepRepo.getEntries.mockResolvedValue([]);
    appsRepo.getApplications.mockResolvedValue([]);
    interviewsRepo.getInterviews.mockResolvedValue([]);
    outreachRepo.getEntries.mockResolvedValue([]);

    const unsubscribe = useDashboardStore.getState().subscribeToUpdates();
    expect(onMock).toHaveBeenCalledTimes(4);

    await useDashboardStore.getState().fetchAll();
    const previousCalls = tasksRepo.getTasks.mock.calls.length;

    listeners.forEach((listener) => listener({ type: "task.completed" }));
    // Drain the whole microtask queue — fetchAll awaits the recurrence
    // regenerations before it reads, so a single-tick flush isn't enough.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tasksRepo.getTasks.mock.calls.length).toBeGreaterThan(previousCalls);
    unsubscribe();
  });
});
