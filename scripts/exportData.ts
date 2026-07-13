// One-time (well — run-whenever-you-want) safety net, per myhub_plan.md Part A §A.4:
// "A 'dump everything to JSON/Markdown' script before trusting the app with
// real data." Dumps every module's active (non-deleted_at) rows to JSON, one
// file per table, into a gitignored backups/<timestamp>/ directory.
//
// Usage:
//   npm run backup
//
// Only exports tables that exist at run time — a fresh Supabase project that
// hasn't had every migration applied yet just skips the missing ones rather
// than failing the whole export. No restore path: this is a safety net, not
// a migration tool.
//
// See scripts/seedWeeklySchedule.ts for why the env load and the client
// import both happen via dynamic import() inside main() rather than a
// top-level static import.
process.loadEnvFile(".env.local");

const TABLES = [
  "tasks",
  "prep_entries",
  "behavioral_stories",
  "companies",
  "applications",
  "interviews",
  "outreach_log",
] as const;

async function main() {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { supabase } = await import("../src/lib/supabaseClient");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = `backups/${timestamp}`;
  await mkdir(dir, { recursive: true });

  console.log(`Exporting to ${dir}/...`);

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .is("deleted_at", null);

    if (error) {
      // PGRST205 ("Could not find the table") means this table's migration
      // hasn't been applied yet in this environment — skip it, don't fail
      // the whole export over a table that's simply not there yet.
      if (error.code === "PGRST205") {
        console.log(`  skipped ${table} (table does not exist yet)`);
        continue;
      }
      throw error;
    }

    await writeFile(
      `${dir}/${table}.json`,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
    console.log(`  wrote ${table}.json (${data.length} rows)`);
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
