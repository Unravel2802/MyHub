type Task = {
  title: string;
  context: string;
  dueDate: string;
  subtaskProgress: string;
};

type Column = {
  title: string;
  description: string;
  accent: string;
  tasks: Task[];
};

const columns: Column[] = [
  {
    title: "Inbox",
    description: "New captures waiting for triage",
    accent: "bg-sky-500",
    tasks: [
      {
        title: "Capture weekly planning notes",
        context: "Convert rough notes into tasks",
        dueDate: "Today",
        subtaskProgress: "0/3",
      },
      {
        title: "Review task module spec",
        context: "Check MVP rules before implementation",
        dueDate: "Tomorrow",
        subtaskProgress: "1/2",
      },
    ],
  },
  {
    title: "Todo",
    description: "Ready to start next",
    accent: "bg-amber-500",
    tasks: [
      {
        title: "Draft Kanban card states",
        context: "Empty, active, blocked, complete",
        dueDate: "Jul 12",
        subtaskProgress: "2/5",
      },
      {
        title: "Define empty board copy",
        context: "Short labels for first-run UX",
        dueDate: "Jul 13",
        subtaskProgress: "0/2",
      },
    ],
  },
  {
    title: "In Progress",
    description: "Current focus",
    accent: "bg-teal-600",
    tasks: [
      {
        title: "Build task board shell",
        context: "Frontend-only route layout",
        dueDate: "Today",
        subtaskProgress: "3/4",
      },
    ],
  },
  {
    title: "Done",
    description: "Completed this week",
    accent: "bg-zinc-500",
    tasks: [],
  },
];

const stats = [
  { label: "Open tasks", value: "5" },
  { label: "Due today", value: "2" },
  { label: "Completed", value: "0" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-zinc-200 bg-white px-6 py-6 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-teal-700">MyHub</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">
              Task Engine
            </h1>
          </div>

          <nav className="mt-8 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {["Board", "Inbox", "Calendar", "Archive"].map((item) => (
              <button
                key={item}
                className={`h-10 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                  item === "Board"
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-zinc-200 bg-white px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  Personal productivity
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-normal">
                  Kanban board
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="task-search">
                  Search tasks
                </label>
                <input
                  id="task-search"
                  className="h-10 min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 sm:w-64"
                  placeholder="Search tasks"
                  type="search"
                />
                <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
                  Add task
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-zinc-200 bg-stone-50 px-4 py-3"
                >
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-x-auto p-4 sm:p-6">
            <div className="grid min-w-[960px] gap-4 xl:grid-cols-4">
              {columns.map((column) => (
                <section
                  key={column.title}
                  className="flex min-h-[520px] flex-col rounded-lg border border-zinc-200 bg-white"
                >
                  <div className="border-b border-zinc-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${column.accent}`}
                        />
                        <h3 className="truncate text-sm font-semibold">
                          {column.title}
                        </h3>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        {column.tasks.length}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      {column.description}
                    </p>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {column.tasks.length > 0 ? (
                      column.tasks.map((task) => (
                        <article
                          key={task.title}
                          className="rounded-md border border-zinc-200 bg-stone-50 p-4 shadow-sm transition-colors hover:border-zinc-300"
                        >
                          <h4 className="text-sm font-semibold leading-6">
                            {task.title}
                          </h4>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {task.context}
                          </p>
                          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
                            <span>{task.dueDate}</span>
                            <span>{task.subtaskProgress} subtasks</span>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-stone-50 p-6 text-center">
                        <p className="max-w-36 text-sm leading-6 text-zinc-500">
                          Completed tasks will show up here.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
