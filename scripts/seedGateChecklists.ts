// One-time setup script: seeds engineering_first_roadmap_v2.md §6.5's
// month-by-month gate checklists (July 2026 - May 2027) as parent-task +
// subtask trees. See docs/handoff/seed-scripts.md.
//
// Usage:
//   npm run seed:gates              -- creates all 11 months
//   npm run seed:gates -- --dry-run     -- prints what would be created
//
// Run once. Re-running creates duplicate parent tasks (same title, different
// id) — findGateChecklistTask in dashboardSelectors.ts matches the first one
// found, so duplicates would leave the Dashboard silently reading the wrong
// (or an incomplete) checklist rather than erroring.
//
// See scripts/seedWeeklySchedule.ts for why the env load and the repository
// import both happen via dynamic import() inside main() rather than a
// top-level static import.
process.loadEnvFile(".env.local");

async function main() {
  const { GATE_CHECKLIST_SEED } = await import("./seedData/gateChecklists");
  const TaskRepository = await import("../src/modules/task/TaskRepository");
  const { gateChecklistTitleFor } = await import(
    "../src/modules/dashboard/dashboardSelectors"
  );

  const dryRun = process.argv.includes("--dry-run");

  console.log(
    `Seeding ${GATE_CHECKLIST_SEED.length} monthly gate checklists${
      dryRun ? " (dry run — nothing will be created)" : ""
    }...`,
  );

  for (const entry of GATE_CHECKLIST_SEED) {
    // Derived from an actual Date through the same function the Dashboard
    // uses to find gate tasks, rather than hand-formatted — a typo in
    // monthLabel (e.g. "Febuary 2027") would otherwise silently produce a
    // title the Dashboard can never match.
    const [monthName, year] = entry.monthLabel.split(" ");
    const monthDate = new Date(`${monthName} 1, ${year}`);
    const title = gateChecklistTitleFor(monthDate);

    if (title !== `Gate: ${entry.monthLabel}`) {
      throw new Error(
        `seedData/gateChecklists.ts entry "${entry.monthLabel}" doesn't round-trip ` +
          `through gateChecklistTitleFor (got "${title}") — check for a typo before seeding.`,
      );
    }

    if (dryRun) {
      console.log(`  [dry-run] "${title}" — ${entry.subtasks.length} subtasks`);
      continue;
    }

    const parent = await TaskRepository.createTask({ title });
    console.log(`  created "${title}" (id=${parent.id})`);

    // Sequential, not Promise.all: each subtask needs the parent's id, and
    // TaskRepository enforces MAX_TASK_DEPTH by checking the parent's depth
    // at insert time, so there's no benefit to parallelizing within a month
    // (across months would be safe, but isn't worth the added complexity here).
    for (const subtaskTitle of entry.subtasks) {
      await TaskRepository.createTask({
        title: subtaskTitle,
        parentTaskId: parent.id,
      });
    }
    console.log(`    + ${entry.subtasks.length} subtasks`);
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
