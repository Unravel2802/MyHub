import { type FormEvent, useState } from "react";
import type { CreateInterviewInput } from "@/src/modules/jobApplications/InterviewRepository";
import type {
  Application,
  Company,
  Interview,
  InterviewRoundType,
} from "@/src/modules/jobApplications/types";

type InterviewPanelProps = {
  applications: Application[];
  companies: Company[];
  interviews: Interview[];
  disabled: boolean;
  pendingIds: ReadonlySet<string>;
  onCreate: (input: CreateInterviewInput) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onSavePostMortem: (id: string, notes: string) => Promise<void>;
  onDelete: (id: string) => void;
};

function applicationLabel(application: Application, companies: Company[]) {
  return `${application.roleTitle} at ${companies.find((company) => company.id === application.companyId)?.name ?? "Unknown company"}`;
}

export function InterviewPanel({
  applications,
  companies,
  interviews,
  disabled,
  pendingIds,
  onCreate,
  onComplete,
  onSavePostMortem,
  onDelete,
}: InterviewPanelProps) {
  const [applicationId, setApplicationId] = useState("");
  const [roundType, setRoundType] = useState<InterviewRoundType>("coding");
  const [scheduledAt, setScheduledAt] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({
      applicationId,
      roundType,
      scheduledAt: new Date(scheduledAt).toISOString(),
    });
    setScheduledAt("");
  }

  const missingPostMortems = interviews.filter(
    (interview) => interview.completed && !interview.postMortemNotes,
  );

  return (
    <section aria-labelledby="interviews-heading" className="grid gap-4">
      <form
        className="grid gap-3 rounded-lg border border-border bg-surface p-5"
        onSubmit={submit}
      >
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            id="interviews-heading"
          >
            Real interviews
          </h2>
          <p className="mt-1 text-sm text-muted">
            Mocks belong in Prep Tracker; this log is tied to applications.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Application
          <select
            className="h-10 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm"
            disabled={disabled}
            onChange={(event) => setApplicationId(event.target.value)}
            required
            value={applicationId}
          >
            <option value="">Select application</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {applicationLabel(application, companies)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-body">
            Round
            <select
              className="h-10 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm"
              disabled={disabled}
              onChange={(event) =>
                setRoundType(event.target.value as InterviewRoundType)
              }
              value={roundType}
            >
              <option value="coding">Coding</option>
              <option value="system_design">System design</option>
              <option value="ml_system_design">ML system design</option>
              <option value="behavioral">Behavioral</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-body">
            Scheduled time
            <input
              className="h-10 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm"
              disabled={disabled}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
              type="datetime-local"
              value={scheduledAt}
            />
          </label>
        </div>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:bg-disabled"
          disabled={disabled || !applicationId || !scheduledAt}
          type="submit"
        >
          Log interview
        </button>
      </form>

      {missingPostMortems.length > 0 ? (
        <div
          className="rounded-lg border border-danger-border bg-danger-surface p-4"
          role="alert"
        >
          <p className="font-semibold text-danger">
            Post-mortem needed within 24 hours
          </p>
          <p className="mt-1 text-sm text-danger">
            {missingPostMortems.length} completed interview
            {missingPostMortems.length === 1 ? "" : "s"} still need notes.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-3">
        {interviews.map((interview) => {
          const application = applications.find(
            (item) => item.id === interview.applicationId,
          );
          const draft = drafts[interview.id] ?? interview.postMortemNotes ?? "";
          return (
            <li
              className="rounded-lg border border-border bg-surface p-4"
              key={interview.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize text-foreground">
                    {interview.roundType.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {application
                      ? applicationLabel(application, companies)
                      : "Unknown application"}{" "}
                    · {new Date(interview.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <button
                  className="rounded-md border border-input px-3 py-1.5 text-xs text-body disabled:text-subtle"
                  disabled={pendingIds.has(interview.id) || interview.completed}
                  onClick={() => void onComplete(interview.id)}
                  type="button"
                >
                  {interview.completed ? "Completed" : "Mark completed"}
                </button>
              </div>
              {interview.completed ? (
                <div className="mt-3 grid gap-2">
                  <label className="grid gap-1.5 text-sm font-medium text-body">
                    Post-mortem notes
                    <textarea
                      className="min-h-20 rounded-md border border-input bg-surface px-3 py-2 text-sm"
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [interview.id]: event.target.value,
                        })
                      }
                      value={draft}
                    />
                  </label>
                  <button
                    className="justify-self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    disabled={pendingIds.has(interview.id) || !draft.trim()}
                    onClick={() =>
                      void onSavePostMortem(interview.id, draft.trim())
                    }
                    type="button"
                  >
                    Save post-mortem
                  </button>
                </div>
              ) : null}
              <button
                className="mt-3 text-xs font-medium text-danger"
                disabled={pendingIds.has(interview.id)}
                onClick={() => onDelete(interview.id)}
                type="button"
              >
                Delete interview
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
