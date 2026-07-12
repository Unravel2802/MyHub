import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import type { CreateOutreachEntryInput } from "@/src/modules/outreach/OutreachRepository";
import type { Company } from "@/src/modules/jobApplications/types";
import type { OutreachChannel } from "@/src/modules/outreach/types";

const channels: { value: OutreachChannel; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "alumni_network", label: "Alumni network" },
  { value: "professor_referral", label: "Professor referral" },
  { value: "other", label: "Other" },
];

type OutreachEntryFormProps = {
  companies: Company[];
  disabled: boolean;
  onCreate: (input: CreateOutreachEntryInput) => Promise<void>;
};

export function OutreachEntryForm({
  companies,
  disabled,
  onCreate,
}: OutreachEntryFormProps) {
  const [contactName, setContactName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("linkedin");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({
      contactName: contactName.trim() || null,
      companyId: companyId || null,
      channel,
      date,
      notes: notes.trim() || null,
    });
    setContactName("");
    setCompanyId("");
    setChannel("linkedin");
    setNotes("");
  }

  const field =
    "h-10 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm";

  return (
    <form
      aria-labelledby="log-outreach-heading"
      className="grid gap-3 rounded-lg border border-border bg-surface p-5"
      onSubmit={submit}
    >
      <div>
        <h2
          className="text-lg font-semibold text-foreground"
          id="log-outreach-heading"
        >
          Log an outreach conversation
        </h2>
        <p className="mt-1 text-sm text-muted">
          Capture the contact while the thread is still fresh.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Contact name
          <input
            className={field}
            disabled={disabled}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Alex Kim"
            value={contactName}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-body">
          Date
          <input
            className={field}
            disabled={disabled}
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-body">
          Company
          <select
            className={field}
            disabled={disabled}
            onChange={(event) => setCompanyId(event.target.value)}
            value={companyId}
          >
            <option value="">No company selected</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-body">
          Channel
          <select
            className={field}
            disabled={disabled}
            onChange={(event) =>
              setChannel(event.target.value as OutreachChannel)
            }
            value={channel}
          >
            {channels.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-medium text-body">
        Notes
        <textarea
          className="min-h-24 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-surface-subtle"
          disabled={disabled}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Context, follow-up, and next step"
          value={notes}
        />
      </label>

      <button
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled"
        disabled={disabled}
        type="submit"
      >
        Log conversation
      </button>
    </form>
  );
}
