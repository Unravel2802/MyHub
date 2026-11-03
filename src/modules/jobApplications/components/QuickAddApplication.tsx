import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";

export function QuickAddApplication({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (companyName: string, roleTitle: string) => Promise<boolean>;
}) {
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || disabled || !companyName.trim() || !roleTitle.trim())
      return;
    setSubmitting(true);
    try {
      if (await onCreate(companyName.trim(), roleTitle.trim())) {
        setCompanyName("");
        setRoleTitle("");
      }
    } finally {
      setSubmitting(false);
    }
  }
  const field =
    "h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground";
  return (
    <form
      aria-label="New application"
      className="grid gap-3 border-b border-border pb-5 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"
      onSubmit={submit}
    >
      <label className="grid gap-1.5 text-xs text-muted">
        Company
        <input
          id="new-application-company"
          autoComplete="off"
          className={field}
          disabled={disabled || submitting}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Company name"
          required
          value={companyName}
        />
      </label>
      <label className="grid gap-1.5 text-xs text-muted">
        Role title
        <input
          className={field}
          disabled={disabled || submitting}
          onChange={(event) => setRoleTitle(event.target.value)}
          placeholder="e.g. Backend Engineer"
          required
          value={roleTitle}
        />
      </label>
      <button
        className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:bg-disabled"
        disabled={
          disabled || submitting || !companyName.trim() || !roleTitle.trim()
        }
        type="submit"
      >
        <Plus aria-hidden size={15} />
        {submitting ? "Adding…" : "Add application"}
      </button>
    </form>
  );
}
