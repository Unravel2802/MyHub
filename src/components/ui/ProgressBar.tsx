type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  // The FILL clamps to 0-100%, but `progress` itself is deliberately uncapped
  // upstream (prepTargets lets it exceed 1 so "180/150" and "150/150" read
  // differently). Clamping here only stops the bar overflowing its track.
  const percent = Math.min(100, Math.max(0, progress * 100));

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(percent)}
      className="h-2 overflow-hidden rounded-full bg-surface-subtle"
      role="progressbar"
    >
      <div
        // motion-reduce disables the sweep for anyone who's asked the OS for
        // less animation — a bar animating on every keystroke is exactly the
        // kind of motion that setting exists to suppress.
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
