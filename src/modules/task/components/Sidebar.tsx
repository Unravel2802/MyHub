import { navItems } from "@/src/modules/task/taskBoardConfig";

export function Sidebar() {
  return (
    <aside className="border-b border-zinc-200 bg-white px-6 py-6 lg:border-b-0 lg:border-r">
      <div>
        <p className="text-sm font-semibold text-teal-700">MyHub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">
          Task Engine
        </h1>
      </div>

      <nav className="mt-8 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {navItems.map((item) => (
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
  );
}
