import Link from "next/link";
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
        <nav aria-label="MyHub modules" className="mt-6 grid gap-2 text-sm">
          <Link
            aria-current="page"
            className="rounded-md bg-surface-subtle px-3 py-2 font-medium text-foreground"
            href="/"
          >
            Task Engine
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
            href="/prep"
          >
            Prep Tracker
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
            href="/applications"
          >
            Job CRM
          </Link>
        </nav>
      </div>

      <div className="lg:mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}
