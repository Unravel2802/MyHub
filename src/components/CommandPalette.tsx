"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/src/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  getCommand,
  searchCommands,
  type CommandEntry,
} from "@/src/lib/commandPalette";
import { useCommandPaletteStore } from "@/src/modules/commandPalette/useCommandPaletteStore";

function moduleIdFor(command: CommandEntry): string {
  return command.id.split(".", 1)[0];
}

function moduleLabel(moduleId: string): string {
  return moduleId
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function CommandPalette() {
  const { isOpen, query, recentIds, close, setQuery, pushRecent } =
    useCommandPaletteStore();
  const commands = searchCommands(query);
  const visibleIds = new Set(commands.map((command) => command.id));
  const recentCommands = recentIds
    .map((id) => getCommand(id))
    .filter(
      (command): command is CommandEntry =>
        command !== undefined && visibleIds.has(command.id),
    );
  const recentCommandIds = new Set(recentCommands.map((command) => command.id));
  const groupedCommands = new Map<string, CommandEntry[]>();

  for (const command of commands) {
    if (recentCommandIds.has(command.id)) continue;
    const moduleId = moduleIdFor(command);
    groupedCommands.set(moduleId, [
      ...(groupedCommands.get(moduleId) ?? []),
      command,
    ]);
  }

  function invoke(command: CommandEntry) {
    pushRecent(command.id);
    close();
    command.action();
  }

  function renderCommand(command: CommandEntry) {
    return (
      <CommandItem
        key={command.id}
        onSelect={() => invoke(command)}
        value={`${command.label} ${command.keywords.join(" ")}`}
      >
        <span>{command.label}</span>
        <CommandShortcut>{moduleLabel(moduleIdFor(command))}</CommandShortcut>
      </CommandItem>
    );
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) close();
      }}
      open={isOpen}
    >
      <DialogContent
        aria-label="Command palette"
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Search for a command and press Enter to run it.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Search commands"
            autoFocus
            onValueChange={setQuery}
            placeholder="Search commands..."
            value={query}
          />
          <CommandList>
            <CommandEmpty>No commands found.</CommandEmpty>
            {recentCommands.length > 0 ? (
              <>
                <CommandGroup heading="Recent">
                  {recentCommands.map(renderCommand)}
                </CommandGroup>
                {groupedCommands.size > 0 ? <CommandSeparator /> : null}
              </>
            ) : null}
            {[...groupedCommands.entries()].map(([moduleId, entries]) => (
              <CommandGroup heading={moduleLabel(moduleId)} key={moduleId}>
                {entries.map(renderCommand)}
              </CommandGroup>
            ))}
          </CommandList>
          <p className="border-t border-border px-4 py-2 text-xs text-muted">
            Arrow keys to move · Enter to run · Esc to close
          </p>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
