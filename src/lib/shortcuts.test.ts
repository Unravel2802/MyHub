import { beforeEach, describe, expect, it } from "vitest";
import {
  eventCombo,
  matchShortcut,
  normalizeCombo,
  registerShortcuts,
  unregisterShortcuts,
  type KeyEvent,
} from "@/src/lib/shortcuts";

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return {
    key: k,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  };
}

describe("shortcuts", () => {
  beforeEach(() => {
    unregisterShortcuts("test");
    unregisterShortcuts("other");
  });

  it("normalizes modifier order and casing", () => {
    expect(normalizeCombo("Shift+Mod+K")).toBe("mod+shift+k");
    expect(normalizeCombo("mod+shift+k")).toBe("mod+shift+k");
  });

  it("folds meta and ctrl into a single 'mod'", () => {
    expect(eventCombo(key("k", { metaKey: true }))).toBe("mod+k");
    expect(eventCombo(key("k", { ctrlKey: true }))).toBe("mod+k");
  });

  it("matches a chord and clears the buffer", () => {
    registerShortcuts("test", [{ combo: "mod+k", commandId: "test.palette" }]);
    const result = matchShortcut(key("k", { metaKey: true }), "");
    expect(result).toEqual({ commandId: "test.palette", buffer: "" });
  });

  it("matches a bare-key shortcut like '/'", () => {
    registerShortcuts("test", [{ combo: "/", commandId: "test.quickAdd" }]);
    expect(matchShortcut(key("/"), "").commandId).toBe("test.quickAdd");
  });

  it("buffers a sequence prefix, then fires on completion", () => {
    registerShortcuts("test", [{ combo: "g d", commandId: "test.goDash" }]);

    const first = matchShortcut(key("g"), "");
    expect(first).toEqual({ commandId: null, buffer: "g" });

    const second = matchShortcut(key("d"), first.buffer);
    expect(second).toEqual({ commandId: "test.goDash", buffer: "" });
  });

  it("resets on a non-matching key but retries it as a fresh start", () => {
    registerShortcuts("test", [{ combo: "g d", commandId: "test.goDash" }]);

    // "g g d" should still reach the shortcut: the second "g" resets and
    // restarts the buffer rather than dead-ending.
    let buf = matchShortcut(key("g"), "").buffer;
    buf = matchShortcut(key("g"), buf).buffer;
    expect(buf).toBe("g");
    expect(matchShortcut(key("d"), buf).commandId).toBe("test.goDash");
  });

  it("clears the buffer when a modified key interrupts a sequence", () => {
    registerShortcuts("test", [{ combo: "g d", commandId: "test.goDash" }]);
    const started = matchShortcut(key("g"), "");
    const interrupted = matchShortcut(
      key("a", { metaKey: true }),
      started.buffer,
    );
    expect(interrupted).toEqual({ commandId: null, buffer: "" });
  });

  it("rejects a duplicate combo across modules", () => {
    registerShortcuts("test", [{ combo: "mod+k", commandId: "test.a" }]);
    expect(() =>
      registerShortcuts("other", [{ combo: "mod+k", commandId: "other.b" }]),
    ).toThrow();
  });

  it("unregister removes only that module's shortcuts", () => {
    registerShortcuts("test", [{ combo: "mod+k", commandId: "test.a" }]);
    registerShortcuts("other", [{ combo: "mod+j", commandId: "other.b" }]);

    unregisterShortcuts("test");

    // "test"'s combo is now free to re-register; "other"'s still fires.
    expect(() =>
      registerShortcuts("test", [{ combo: "mod+k", commandId: "test.a" }]),
    ).not.toThrow();
    expect(matchShortcut(key("j", { metaKey: true }), "").commandId).toBe(
      "other.b",
    );
  });
});
