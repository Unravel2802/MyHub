import { ThemeToggle } from "@/src/components/ThemeToggle";

export function Sidebar() {
  // self-start stops the grid from stretching the rail to the full document
  // height, which is what lets it stick to the viewport when a column is long.
  return (
    <aside className="flex flex-col gap-8 overflow-y-auto border-b border-border bg-surface px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r">
      <div>
        <p className="text-sm font-semibold text-accent-strong">MyHub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
          Task Engine
        </h1>
      </div>

      <div className="lg:mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}
