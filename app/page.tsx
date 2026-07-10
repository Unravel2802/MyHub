const columns = [
  {
    title: "Inbox",
    count: 3,
    tasks: ["Capture weekly planning notes", "Review task module spec"],
  },
  {
    title: "Todo",
    count: 2,
    tasks: ["Draft Kanban card states", "Define empty board copy"],
  },
  {
    title: "In Progress",
    count: 1,
    tasks: ["Replace starter app shell"],
  },
  {
    title: "Done",
    count: 0,
    tasks: ["Initialize Next.js project"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-zinc-950 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">MyHub</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Task board
            </h1>
          </div>
          <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
            Add task
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          {columns.map((column) => (
            <div
              key={column.title}
              className="flex min-h-80 flex-col rounded-lg border border-zinc-200 bg-white"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {column.title}
                </h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {column.count}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-3">
                {column.tasks.map((task) => (
                  <article
                    key={task}
                    className="rounded-md border border-zinc-200 bg-stone-50 p-3 shadow-sm"
                  >
                    <h3 className="text-sm font-medium text-zinc-950">
                      {task}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-500">No due date</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
