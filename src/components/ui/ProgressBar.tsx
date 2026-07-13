type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
      <div
        className="h-full rounded-full bg-accent transition-[width]"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
      />
    </div>
  );
}
