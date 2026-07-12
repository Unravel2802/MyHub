import { type FormEvent, useState } from "react";
import type { UpsertCompanyInput } from "@/src/modules/jobApplications/CompanyRepository";
import type {
  Application,
  Company,
  CompanyTier,
} from "@/src/modules/jobApplications/types";

type CompanyPanelProps = {
  companies: Company[];
  applications: Application[];
  disabled: boolean;
  pendingIds: ReadonlySet<string>;
  onCreate: (input: UpsertCompanyInput) => Promise<void>;
  onDelete: (id: string, name: string, hasApplications: boolean) => void;
};

export function CompanyPanel({
  companies,
  applications,
  disabled,
  pendingIds,
  onCreate,
  onDelete,
}: CompanyPanelProps) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState<CompanyTier>("match");
  const [notes, setNotes] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({ name: name.trim(), tier, notes: notes.trim() || null });
    setName("");
    setNotes("");
  }

  return (
    <section
      aria-labelledby="companies-heading"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2
        className="text-lg font-semibold text-foreground"
        id="companies-heading"
      >
        Companies
      </h2>
      <form className="mt-4 grid gap-3" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Company name
          <input
            className="h-10 rounded-md border border-input bg-surface px-3 text-sm"
            disabled={disabled}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Tier
          <select
            className="h-10 rounded-md border border-input bg-surface px-3 text-sm"
            disabled={disabled}
            onChange={(event) => setTier(event.target.value as CompanyTier)}
            value={tier}
          >
            <option value="reach">Reach</option>
            <option value="match">Match</option>
            <option value="safety">Safety</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Company notes
          <textarea
            className="min-h-20 rounded-md border border-input bg-surface px-3 py-2 text-sm"
            disabled={disabled}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:bg-disabled"
          disabled={disabled || !name.trim()}
          type="submit"
        >
          Add company
        </button>
      </form>

      <ul className="mt-4 grid gap-2">
        {companies.map((company) => {
          const count = applications.filter(
            (application) => application.companyId === company.id,
          ).length;
          return (
            <li
              className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle p-3"
              key={company.id}
            >
              <div>
                <p className="font-medium text-foreground">{company.name}</p>
                <p className="text-xs capitalize text-muted">
                  {company.tier} · {count} applications
                </p>
              </div>
              <button
                className="text-xs font-medium text-danger"
                disabled={pendingIds.has(company.id)}
                onClick={() => onDelete(company.id, company.name, count > 0)}
                type="button"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
