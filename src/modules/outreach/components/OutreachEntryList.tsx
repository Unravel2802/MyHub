import type { Company } from "@/src/modules/jobApplications/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

type OutreachEntryListProps = {
  entries: OutreachEntry[];
  companies: Company[];
  pendingIds: ReadonlySet<string>;
  onDelete: (id: string, label: string) => void;
};

const channelLabels: Record<OutreachEntry["channel"], string> = {
  linkedin: "LinkedIn",
  email: "Email",
  alumni_network: "Alumni network",
  professor_referral: "Professor referral",
  other: "Other",
};

export function OutreachEntryList({
  entries,
  companies,
  pendingIds,
  onDelete,
}: OutreachEntryListProps) {
  const companyById = new Map(
    companies.map((company) => [company.id, company]),
  );

  return (
    <section
      aria-labelledby="recent-outreach-heading"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            id="recent-outreach-heading"
          >
            Recent conversations
          </h2>
          <p className="mt-1 text-sm text-muted">
            Keep the outreach cadence visible week to week.
          </p>
        </div>
        <span className="text-xs text-muted">{entries.length} entries</span>
      </div>

      <ul className="mt-4 grid gap-3">
        {entries.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted">
            Start the referral pipeline with one conversation. Log it below.
          </li>
        ) : null}

        {entries.map((entry) => {
          const company = entry.companyId
            ? companyById.get(entry.companyId)
            : null;
          const label = entry.contactName ?? company?.name ?? entry.channel;

          return (
            <li
              className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={entry.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium text-foreground">{label}</p>
                  <span className="text-xs text-muted">
                    {channelLabels[entry.channel]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {entry.date}
                  {company ? ` · ${company.name}` : ""}
                </p>
                {entry.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-body">
                    {entry.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start justify-end">
                <button
                  className="text-xs font-medium text-danger"
                  disabled={pendingIds.has(entry.id)}
                  onClick={() => onDelete(entry.id, label)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
