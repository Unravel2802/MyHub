// One-time setup script: seeds engineering_first_roadmap_v2.md §14's sample
// week as recurring Task Engine rules. See docs/handoff/seed-scripts.md.
//
// Usage:
//   npm run seed:schedule           -- creates the 13 recurring rules
//   npm run seed:schedule -- --dry-run   -- prints what would be created
//
// Run once. There is no dedup key for recurrence TEMPLATES the way migration
// 0002's unique index dedups generated INSTANCES — running this twice creates
// duplicate rules.
//
// process.loadEnvFile must run before TaskRepository is imported, because
// src/lib/supabaseClient reads process.env at module-load time (a
// top-level createClient(...) call, not something deferred until first use).
// A static top-level `import` would be hoisted and evaluated before this
// line runs, so the env file load and the repository import are both done
// via dynamic import() to guarantee the ordering.
process.loadEnvFile(".env.local");

async function main() {
  const { WEEKLY_SCHEDULE_SEED } = await import("./seedData/weeklySchedule");
  const TaskRepository = await import("../src/modules/task/TaskRepository");

  const dryRun = process.argv.includes("--dry-run");
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  console.log(
    `Seeding ${WEEKLY_SCHEDULE_SEED.length} weekly recurring task${
      WEEKLY_SCHEDULE_SEED.length === 1 ? "" : "s"
    }${dryRun ? " (dry run — nothing will be created)" : ""}...`,
  );

  for (const entry of WEEKLY_SCHEDULE_SEED) {
    const weekdayLabel = weekdayNames[entry.weekday];

    if (dryRun) {
      console.log(`  [dry-run] ${weekdayLabel}: "${entry.title}"`);
      continue;
    }

    const created = await TaskRepository.createTask({
      title: entry.title,
      description: entry.description,
      recursWeekly: true,
      weekday: entry.weekday,
    });
    console.log(`  created "${created.title}" (${weekdayLabel}, id=${created.id})`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Forces TypeScript to treat this file as a module (isolated scope) rather
// than a global script -- otherwise the top-level main() here collides with
// every other script's top-level main(), since none of these files has a
// static top-level import/export to make that inference automatically.
export {};
