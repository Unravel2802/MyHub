import { type FormEvent, useState } from "react";
import type { CreateApplicationInput } from "@/src/modules/jobApplications/ApplicationRepository";
import type {
  ApplicationStage,
  Company,
  ResumeVariant,
} from "@/src/modules/jobApplications/types";

type ApplicationFormProps = {
  companies: Company[];
  disabled: boolean;
  onCreate: (input: CreateApplicationInput) => Promise<void>;
};

export function ApplicationForm({
  companies,
  disabled,
  onCreate,
}: ApplicationFormProps) {
  const [companyId, setCompanyId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [resumeVariant, setResumeVariant] =
    useState<ResumeVariant>("swe_backend");
  const [stage, setStage] = useState<ApplicationStage>("researching");
  const [appliedDate, setAppliedDate] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({
      companyId,
      roleTitle: roleTitle.trim(),
      resumeVariant,
      stage,
      appliedDate: appliedDate || null,
      referralSource: referralSource.trim() || null,
      followUpDate: followUpDate || null,
    });
    setRoleTitle("");
    setReferralSource("");
    setFollowUpDate("");
  }

  const field =
    "h-10 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm";
  return (
    <form
      aria-labelledby="new-application-heading"
      className="grid gap-3 rounded-lg border border-border bg-surface p-5"
      onSubmit={submit}
    >
      <div>
        <h2
          className="text-lg font-semibold text-foreground"
          id="new-application-heading"
        >
          New application
        </h2>
        <p className="mt-1 text-sm text-muted">
          Track the funnel from research to decision.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-body">
        Company
        <select
          className={field}
          disabled={disabled || companies.length === 0}
          onChange={(event) => setCompanyId(event.target.value)}
          required
          value={companyId}
        >
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-body">
        Role title
        <input
          className={field}
          disabled={disabled}
          onChange={(event) => setRoleTitle(event.target.value)}
          required
          value={roleTitle}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Resume
          <select
            className={field}
            disabled={disabled}
            onChange={(event) =>
              setResumeVariant(event.target.value as ResumeVariant)
            }
            value={resumeVariant}
          >
            <option value="swe_backend">SWE / Backend</option>
            <option value="mle_ml_infra">MLE / ML Infra</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Initial stage
          <select
            className={field}
            disabled={disabled}
            onChange={(event) =>
              setStage(event.target.value as ApplicationStage)
            }
            value={stage}
          >
            <option value="researching">Researching</option>
            <option value="applied">Applied</option>
            <option value="oa">OA</option>
            <option value="phone_screen">Phone screen</option>
            <option value="onsite">Onsite</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Applied date
          <input
            className={field}
            disabled={disabled}
            onChange={(event) => setAppliedDate(event.target.value)}
            type="date"
            value={appliedDate}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Follow-up date
          <input
            className={field}
            disabled={disabled}
            onChange={(event) => setFollowUpDate(event.target.value)}
            type="date"
            value={followUpDate}
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-body">
        Referral source
        <input
          className={field}
          disabled={disabled}
          onChange={(event) => setReferralSource(event.target.value)}
          value={referralSource}
        />
      </label>
      <button
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:bg-disabled"
        disabled={disabled || !companyId || !roleTitle.trim()}
        type="submit"
      >
        Add application
      </button>
    </form>
  );
}
