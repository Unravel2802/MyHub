import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Application,
  Company,
  Interview,
} from "@/src/modules/jobApplications/types";

vi.mock("@/src/modules/jobApplications/CompanyRepository", () => ({
  getCompanies: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
}));
vi.mock("@/src/modules/jobApplications/ApplicationRepository", () => ({
  getApplications: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
}));
vi.mock("@/src/modules/jobApplications/InterviewRepository", () => ({
  getInterviews: vi.fn(),
  getInterviewsForApplication: vi.fn(),
  createInterview: vi.fn(),
  updateInterview: vi.fn(),
  deleteInterview: vi.fn(),
}));
vi.mock("@/src/lib/events", () => ({ emit: vi.fn() }));

import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as InterviewRepository from "@/src/modules/jobApplications/InterviewRepository";
import { emit } from "@/src/lib/events";
import { useApplicationStore } from "@/src/modules/jobApplications/useApplicationStore";

const companiesRepo = vi.mocked(CompanyRepository);
const applicationsRepo = vi.mocked(ApplicationRepository);
const interviewsRepo = vi.mocked(InterviewRepository);
const emitMock = vi.mocked(emit);
const stamp = "2026-07-12T00:00:00.000Z";
function company(overrides: Partial<Company> = {}): Company {
  return {
    id: "company",
    name: "Acme",
    tier: "match",
    notes: null,
    deletedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}
function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "application",
    companyId: "company",
    roleTitle: "Engineer",
    resumeVariant: "swe_backend",
    stage: "researching",
    appliedDate: null,
    lastUpdateDate: "2026-07-12",
    referralSource: null,
    followUpDate: null,
    deletedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}
function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "interview",
    applicationId: "application",
    roundType: "coding",
    scheduledAt: stamp,
    completed: false,
    outcome: null,
    postMortemNotes: null,
    deletedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}
function reset(applications: Application[] = [], interviews: Interview[] = []) {
  useApplicationStore.setState({
    companies: [company()],
    applications,
    interviews,
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  reset();
});

describe("fetch and optimistic rollback", () => {
  it("fetches all three entities", async () => {
    companiesRepo.getCompanies.mockResolvedValue([company()]);
    applicationsRepo.getApplications.mockResolvedValue([application()]);
    interviewsRepo.getInterviews.mockResolvedValue([interview()]);
    await useApplicationStore.getState().fetchAll();
    expect(useApplicationStore.getState()).toMatchObject({
      applications: [application()],
      interviews: [interview()],
      isLoading: false,
    });
  });
  it("rolls back a failed application create", async () => {
    const existing = application();
    reset([existing]);
    applicationsRepo.createApplication.mockRejectedValue(new Error("offline"));
    await useApplicationStore.getState().createApplication({
      companyId: "company",
      roleTitle: "New",
      resumeVariant: "swe_backend",
    });
    expect(useApplicationStore.getState().applications).toEqual([existing]);
    expect(useApplicationStore.getState().error).toBe("offline");
  });
});

describe("application.stage_changed boundary", () => {
  it("emits only when the stage actually changes", async () => {
    const current = application();
    reset([current]);
    applicationsRepo.updateApplication.mockResolvedValue({
      ...current,
      stage: "applied",
    });
    await useApplicationStore
      .getState()
      .updateApplicationStage(current.id, "applied");
    expect(emitMock).toHaveBeenCalledWith({
      type: "application.stage_changed",
      payload: {
        applicationId: current.id,
        fromStage: "researching",
        toStage: "applied",
      },
      timestamp: expect.any(Number),
    });
  });
  it("does not call the repository or emit for the same stage", async () => {
    const current = application({ stage: "applied" });
    reset([current]);
    await useApplicationStore
      .getState()
      .updateApplicationStage(current.id, "applied");
    expect(applicationsRepo.updateApplication).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });
  it("does not emit for a general application edit", async () => {
    const current = application();
    reset([current]);
    applicationsRepo.updateApplication.mockResolvedValue({
      ...current,
      referralSource: "Alex",
    });
    await useApplicationStore
      .getState()
      .updateApplication(current.id, { referralSource: "Alex" });
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe("interview.completed boundary", () => {
  it("emits on false to true completion", async () => {
    const current = interview();
    reset([application()], [current]);
    interviewsRepo.updateInterview.mockResolvedValue({
      ...current,
      completed: true,
    });
    await useApplicationStore.getState().markInterviewCompleted(current.id);
    expect(emitMock).toHaveBeenCalledWith({
      type: "interview.completed",
      payload: {
        interviewId: current.id,
        applicationId: current.applicationId,
      },
      timestamp: expect.any(Number),
    });
  });
  it("does not call the repository or re-emit when already complete", async () => {
    const current = interview({ completed: true });
    reset([application()], [current]);
    await useApplicationStore.getState().markInterviewCompleted(current.id);
    expect(interviewsRepo.updateInterview).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });
  it("does not emit when saving post-mortem notes", async () => {
    const current = interview({ completed: true });
    reset([application()], [current]);
    interviewsRepo.updateInterview.mockResolvedValue({
      ...current,
      postMortemNotes: "Review",
    });
    await useApplicationStore
      .getState()
      .updateInterview(current.id, { postMortemNotes: "Review" });
    expect(emitMock).not.toHaveBeenCalled();
  });
});
