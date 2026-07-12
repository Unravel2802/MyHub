import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  Application,
  ApplicationStage,
  Company,
} from "@/src/modules/jobApplications/types";

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
};

function Card({
  application,
  company,
  disabled,
  onStageChange,
  onDelete,
}: {
  application: Application;
  company?: Company;
  disabled: boolean;
  onStageChange: PipelineProps["onStageChange"];
  onDelete: PipelineProps["onDelete"];
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: application.id,
    disabled,
  });
  return (
    <article
      aria-label={`Application: ${application.roleTitle} at ${company?.name ?? "Unknown company"}`}
      className="rounded-md border border-border bg-surface p-3 shadow-sm"
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
}: {
  stage: (typeof stages)[number];
  applications: Application[];
  companies: Company[];
  pendingIds: ReadonlySet<string>;
  onStageChange: PipelineProps["onStageChange"];
  onDelete: PipelineProps["onDelete"];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.value });
  return (
    <section
      aria-label={stage.label}
      className={`min-h-48 rounded-lg border border-border bg-surface-subtle p-3 ${isOver ? "border-accent" : ""}`}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
        <span className="text-xs text-muted">{applications.length}</span>
      </div>
      <div className="grid gap-3">
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
        <div className="grid min-w-[1800px] grid-cols-8 gap-3">
          {stages.map((stage) => (
            <Column
              applications={applications.filter(
                (application) => application.stage === stage.value,
              )}
              companies={companies}
              key={stage.value}
              onDelete={onDelete}
              onStageChange={onStageChange}
              pendingIds={pendingIds}
              stage={stage}
            />
          ))}
        </div>
      </DndContext>
    </section>
  );
}
