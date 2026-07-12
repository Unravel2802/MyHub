import { ThemeToggle } from "@/src/components/ThemeToggle";

export function Sidebar() {
  return (
    <aside className="flex flex-col gap-8 border-b border-border bg-surface px-6 py-6 lg:border-b-0 lg:border-r">
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
