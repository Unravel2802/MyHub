import { Fragment, useId, useState } from "react";
import { ExternalLink, Pencil, Table2 } from "lucide-react";
import type { UpdateApplicationInput } from "@/src/modules/jobApplications/ApplicationRepository";
import type {
  Application,
  ApplicationStage,
  Company,
} from "@/src/modules/jobApplications/types";
import { REJECTION_TAKEAWAY_PREFIX } from "@/src/modules/jobApplications/rejectionTakeaway";
import { normalizePostingUrl } from "@/src/modules/jobApplications/postingUrl";

const stages: { value: ApplicationStage; label: string }[] = [
  { value: "researching", label: "Researching" },
  { value: "applied", label: "Applied" },
  { value: "oa", label: "OA" },
  { value: "phone_screen", label: "Phone screen" },
  { value: "onsite", label: "Onsite" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

type Props = {
  applications: Application[];
  companies: Company[];
  pendingIds: ReadonlySet<string>;
  isLoading: boolean;
  onUpdate: (
    id: string,
    updates: Omit<UpdateApplicationInput, "stage">,
  ) => Promise<void>;
  onStageChange: (id: string, stage: ApplicationStage) => void;
  onDelete: (id: string, role: string) => void;
};

function EditableCell({
  value,
  label,
  disabled,
  required,
  type = "text",
  multiline = false,
  onSave,
}: {
  value: string;
  label: string;
  disabled: boolean;
  required?: boolean;
  type?: "text" | "date";
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  async function save() {
    const next = draft.trim();
    if ((required && !next) || next === value) {
      setDraft(value);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }
  const common = {
    "aria-label": label,
    className:
      "h-10 w-full min-w-0 rounded border border-transparent bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-subtle hover:border-border focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60",
    disabled: disabled || saving,
    onBlur: () => void save(),
    placeholder: type === "date" ? undefined : "—",
    required,
    value: draft,
  };
  function keyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      (!multiline || event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(value);
      event.preventDefault();
    }
  }
  return multiline ? (
    <textarea
      {...common}
      rows={1}
      onKeyDown={keyDown}
      onChange={(event) => setDraft(event.target.value)}
    />
  ) : (
    <input
      {...common}
      type={type}
      onKeyDown={keyDown}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

function PostingUrlCell({
  value,
  label,
  disabled,
  onSave,
}: {
  value: string | null;
  label: string;
  disabled: boolean;
  onSave: (value: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const errorId = useId();
  const current = normalizePostingUrl(value ?? "");

  async function save() {
    const result = normalizePostingUrl(draft);
    if (!result.ok) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (result.value !== value) {
      setSaving(true);
      try {
        await onSave(result.value);
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  }

  if (!editing && current.ok && current.value) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <a
          className="flex min-w-0 items-center gap-1 rounded py-2 text-sm text-accent hover:underline"
          href={current.value}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink aria-hidden size={14} className="shrink-0" />
          <span className="truncate">{new URL(current.value).hostname}</span>
        </a>
        <button
          aria-label={`Edit ${label.replace(/^Link/, "link")}`}
          className="shrink-0 rounded p-2 text-muted hover:text-foreground disabled:opacity-60"
          disabled={disabled || saving}
          onClick={() => setEditing(true)}
          type="button"
        >
          <Pencil aria-hidden size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 py-1">
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        autoFocus={editing}
        className="h-10 w-full min-w-0 rounded border border-transparent bg-transparent px-2 text-sm text-foreground placeholder:text-subtle hover:border-border focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
        disabled={disabled || saving}
        onBlur={() => void save()}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value ?? "");
            setInvalid(false);
            setEditing(false);
          }
        }}
        placeholder="Add link…"
        type="text"
        inputMode="url"
        autoComplete="off"
        value={draft}
      />
      {invalid ? (
        <p id={errorId} className="px-2 pb-1 text-xs text-danger" role="alert">
          Enter a web address, e.g. https://…
        </p>
      ) : null}
    </div>
  );
}

export function ApplicationTable({
  applications,
  companies,
  pendingIds,
  isLoading,
  onUpdate,
  onStageChange,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <section
      aria-label="Applications table"
      aria-busy={isLoading}
      className="min-w-0"
    >
      <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-medium text-foreground">
        <Table2 aria-hidden size={16} /> All applications
        <span className="ml-1 text-xs font-normal tabular-nums text-muted">
          {applications.length}
        </span>
        {isLoading ? (
          <span
            className="ml-auto text-xs font-normal text-muted"
            role="status"
          >
            Refreshing…
          </span>
        ) : null}
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <caption className="sr-only">
            Job applications. Edit a cell and tab away to save.
          </caption>
          <thead className="text-xs font-normal text-muted">
            <tr>
              {[
                ["Company", "w-[14%]"],
                ["Role", "w-[18%]"],
                ["Status", "w-[14%]"],
                ["Applied", "w-[16%]"],
                ["Link", "w-[15%]"],
                ["Notes", "w-[16%]"],
                ["", "w-[7%]"],
              ].map(([label, width]) => (
                <th
                  className={`border-b border-border px-2 py-3 font-normal ${width}`}
                  key={label}
                  scope="col"
                >
                  {label || (
                    <span className="sr-only">Application details</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => {
              const company = companies.find(
                (item) => item.id === application.companyId,
              );
              const applicationLabel = `${application.roleTitle} at ${company?.name ?? "Unknown company"}`;
              const disabled =
                isLoading ||
                pendingIds.has(application.id) ||
                application.id.startsWith("optimistic-");
              return (
                <Fragment key={application.id}>
                  <tr
                    aria-label={`Application: ${applicationLabel}`}
                    className="border-b border-border hover:bg-surface-subtle/50"
                  >
                    <th
                      className="px-2 py-2 align-top font-medium text-foreground"
                      scope="row"
                    >
                      <p className="py-2">
                        {company?.name ?? "Unknown company"}
                      </p>
                    </th>
                    <td className="py-1 pr-2">
                      <EditableCell
                        key={application.roleTitle}
                        label={`Role at ${company?.name ?? "Unknown company"}`}
                        value={application.roleTitle}
                        disabled={disabled}
                        required
                        onSave={(roleTitle) =>
                          onUpdate(application.id, { roleTitle })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Application stage for ${applicationLabel}`}
                        className={`max-w-full rounded-md border-0 px-2 py-1.5 text-xs disabled:opacity-60 ${application.stage === "offer" ? "bg-success-surface text-success" : application.stage === "rejected" ? "bg-danger-surface text-danger" : "bg-surface-subtle text-body"}`}
                        disabled={disabled}
                        value={application.stage}
                        onChange={(event) =>
                          onStageChange(
                            application.id,
                            event.target.value as ApplicationStage,
                          )
                        }
                      >
                        {stages.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <EditableCell
                        key={application.appliedDate ?? "empty"}
                        label={`Applied date for ${applicationLabel}`}
                        value={application.appliedDate ?? ""}
                        type="date"
                        disabled={disabled}
                        onSave={(appliedDate) =>
                          onUpdate(application.id, {
                            appliedDate: appliedDate || null,
                          })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <PostingUrlCell
                        key={application.postingUrl ?? "empty"}
                        value={application.postingUrl}
                        label={`Link for ${applicationLabel}`}
                        disabled={disabled}
                        onSave={(postingUrl) =>
                          onUpdate(application.id, { postingUrl })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <EditableCell
                        key={application.notes ?? "empty"}
                        multiline
                        label={`Notes for ${applicationLabel}`}
                        value={application.notes ?? ""}
                        disabled={disabled}
                        onSave={(notes) =>
                          onUpdate(application.id, { notes: notes || null })
                        }
                      />
                    </td>
                    <td className="px-2">
                      <button
                        aria-expanded={expanded === application.id}
                        aria-controls={`application-details-${application.id}`}
                        className="rounded py-2 text-xs text-muted hover:text-foreground"
                        type="button"
                        onClick={() =>
                          setExpanded(
                            expanded === application.id ? null : application.id,
                          )
                        }
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                  {expanded === application.id ? (
                    <tr
                      id={`application-details-${application.id}`}
                      className="border-b border-border bg-surface-subtle/50"
                    >
                      <td colSpan={7} className="p-4">
                        <div className="grid gap-4 text-xs text-muted sm:grid-cols-2">
                          <label className="grid gap-1">
                            Resume
                            <select
                              aria-label={`Resume for ${applicationLabel}`}
                              className="h-9 rounded border border-input bg-surface px-2 text-sm text-foreground"
                              disabled={disabled}
                              value={application.resumeVariant}
                              onChange={(event) =>
                                void onUpdate(application.id, {
                                  resumeVariant: event.target
                                    .value as Application["resumeVariant"],
                                })
                              }
                            >
                              <option value="swe_backend">SWE / Backend</option>
                              <option value="mle_ml_infra">
                                MLE / ML Infra
                              </option>
                            </select>
                          </label>
                          <label className="grid gap-1">
                            Referral source
                            <EditableCell
                              key={application.referralSource ?? "empty"}
                              label={`Referral source for ${applicationLabel}`}
                              value={application.referralSource ?? ""}
                              disabled={disabled}
                              onSave={(referralSource) =>
                                onUpdate(application.id, {
                                  referralSource: referralSource || null,
                                })
                              }
                            />
                          </label>
                          {application.stage === "rejected" &&
                          !application.notes?.includes(
                            REJECTION_TAKEAWAY_PREFIX,
                          ) ? (
                            <RejectionTakeaway
                              disabled={disabled}
                              onSave={(takeaway) =>
                                onUpdate(application.id, {
                                  notes: [
                                    application.notes?.trim(),
                                    `${REJECTION_TAKEAWAY_PREFIX} ${takeaway}`,
                                  ]
                                    .filter(Boolean)
                                    .join("\n"),
                                })
                              }
                            />
                          ) : null}
                          <button
                            className="w-fit py-2 text-danger disabled:opacity-60"
                            disabled={disabled}
                            type="button"
                            onClick={() =>
                              onDelete(application.id, application.roleTitle)
                            }
                          >
                            Delete application
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!applications.length && !isLoading ? (
        <p className="py-8 text-sm text-muted">
          Your job search, one row at a time. Add your first application below.
        </p>
      ) : null}
      <p className="pt-3 text-xs text-muted">
        Click a cell to edit · Tab to save · Escape to reset
      </p>
    </section>
  );
}

function RejectionTakeaway({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="grid gap-2">
      <p>Log one specific, actionable takeaway from this rejection.</p>
      <textarea
        aria-label="Rejection takeaway"
        className="min-h-16 w-full rounded border border-input bg-surface px-2 py-1 text-sm text-foreground"
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        className="rounded bg-primary px-2 py-2 text-primary-foreground disabled:bg-disabled"
        disabled={disabled || !draft.trim()}
        onClick={() => void onSave(draft.trim())}
        type="button"
      >
        Save takeaway
      </button>
      <button
        className="py-2 text-muted"
        onClick={() => setDismissed(true)}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
