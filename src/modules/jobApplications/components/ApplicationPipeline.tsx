import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type {
  Application,
  ApplicationStage,
  Company,
} from "@/src/modules/jobApplications/types";

export const REJECTION_TAKEAWAY_PREFIX = "Rejection takeaway:";

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

type PipelineProps = {
  applications: Application[];
  companies: Company[];
  pendingIds: ReadonlySet<string>;
  onStageChange: (id: string, stage: ApplicationStage) => void;
  onDelete: (id: string, role: string) => void;
  onSaveRejectionTakeaway: (id: string, takeaway: string) => void;
};

function Card({
  application,
  company,
  disabled,
  onStageChange,
  onDelete,
  onSaveRejectionTakeaway,
}: {
  application: Application;
  company?: Company;
  disabled: boolean;
  onStageChange: PipelineProps["onStageChange"];
  onDelete: PipelineProps["onDelete"];
  onSaveRejectionTakeaway: PipelineProps["onSaveRejectionTakeaway"];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [takeaway, setTakeaway] = useState("");
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: application.id,
    disabled,
  });
  return (
    <article
      aria-label={`Application: ${application.roleTitle} at ${company?.name ?? "Unknown company"}`}
      className={`rounded-md border p-3 shadow-sm ${application.stage === "offer" ? "border-success-border bg-success-surface" : "border-border bg-surface"}`}
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <div
        className={disabled ? "cursor-not-allowed" : "cursor-grab"}
        {...attributes}
        {...listeners}
      >
        <p className="font-semibold text-foreground">{application.roleTitle}</p>
        <p className="mt-1 text-sm text-muted">
          {company?.name ?? "Unknown company"}
        </p>
      </div>
      {application.stage === "rejected" &&
      !dismissed &&
      !application.notes?.includes(REJECTION_TAKEAWAY_PREFIX) ? (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface p-3 text-sm">
          <p className="text-danger">
            §11.2: log one specific, actionable takeaway from this rejection.
          </p>
          <textarea
            aria-label="Rejection takeaway"
            className="mt-2 min-h-16 w-full rounded-md border border-input bg-surface px-2 py-1 text-sm text-foreground"
            disabled={disabled}
            onChange={(event) => setTakeaway(event.target.value)}
            value={takeaway}
          />
          <div className="mt-2 flex gap-3">
            <button
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:bg-disabled"
              disabled={disabled || !takeaway.trim()}
              onClick={() => {
                onSaveRejectionTakeaway(application.id, takeaway.trim());
                setTakeaway("");
              }}
              type="button"
            >
              Save takeaway
            </button>
            <button
              className="text-xs text-muted"
              onClick={() => setDismissed(true)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div
        className="mt-3 grid gap-2"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <select
          aria-label="Application stage"
          className="h-8 rounded-md border border-input bg-surface px-2 text-xs"
          disabled={disabled}
          onChange={(event) =>
            onStageChange(
              application.id,
              event.target.value as ApplicationStage,
            )
          }
          value={application.stage}
        >
          {stages.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          Updated {application.lastUpdateDate}
          {application.followUpDate
            ? ` · Follow up ${application.followUpDate}`
            : ""}
        </p>
        <button
          className="text-left text-xs font-medium text-danger"
          disabled={disabled}
          onClick={() => onDelete(application.id, application.roleTitle)}
          type="button"
        >
          Delete application
        </button>
      </div>
    </article>
  );
}

function Column({
  stage,
  applications,
  companies,
  pendingIds,
  onStageChange,
  onDelete,
  onSaveRejectionTakeaway,
}: {
  stage: (typeof stages)[number];
  applications: Application[];
  companies: Company[];
  pendingIds: ReadonlySet<string>;
  onStageChange: PipelineProps["onStageChange"];
  onDelete: PipelineProps["onDelete"];
  onSaveRejectionTakeaway: PipelineProps["onSaveRejectionTakeaway"];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.value });
  return (
    <section
      aria-label={stage.label}
      className={`min-h-32 rounded-lg border border-border bg-surface-subtle p-3 ${isOver ? "border-accent" : ""}`}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
        <span className="text-xs text-muted">{applications.length}</span>
      </div>
      <div className="grid gap-3">
        {applications.length === 0 ? (
          <EmptyState
            compact
            description="Drag an application here when it reaches this stage."
            title="No applications here"
          />
        ) : null}
        {applications.map((application) => (
          <Card
            application={application}
            company={companies.find(
              (company) => company.id === application.companyId,
            )}
            disabled={pendingIds.has(application.id)}
            key={application.id}
            onDelete={onDelete}
            onStageChange={onStageChange}
            onSaveRejectionTakeaway={onSaveRejectionTakeaway}
          />
        ))}
      </div>
    </section>
  );
}

export function ApplicationPipeline({
  applications,
  companies,
  pendingIds,
  onStageChange,
  onDelete,
  onSaveRejectionTakeaway,
}: PipelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  function dragEnd(event: DragEndEvent) {
    const target = event.over?.id as ApplicationStage | undefined;
    if (!target || !stages.some((stage) => stage.value === target)) return;
    const application = applications.find(
      (item) => item.id === event.active.id,
    );
    if (application && application.stage !== target)
      onStageChange(application.id, target);
  }
  return (
    <section aria-labelledby="pipeline-heading">
      <h2
        className="mb-3 text-xl font-semibold text-foreground"
        id="pipeline-heading"
      >
        Application pipeline
      </h2>
      <DndContext onDragEnd={dragEnd} sensors={sensors}>
        <div className="grid w-max min-w-full grid-cols-[repeat(8,minmax(180px,1fr))] gap-3 pb-2">
          {stages.map((stage) => (
            <Column
              applications={applications.filter(
                (application) => application.stage === stage.value,
              )}
              companies={companies}
              key={stage.value}
              onDelete={onDelete}
              onStageChange={onStageChange}
              onSaveRejectionTakeaway={onSaveRejectionTakeaway}
              pendingIds={pendingIds}
              stage={stage}
            />
          ))}
        </div>
      </DndContext>
    </section>
  );
}
