import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatCard } from "@/src/components/ui/StatCard";

// These guard the two rules that have been broken most often in this project:
// "never tint absence" (three components, three fixes) and its successor
// "never headline absence" (docs/ui-upgrade-wave3.md §2.2). Both used to live
// in prose; the tint rule additionally lived in ten copy-pasted ternaries.

const render = (ui: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(ui);

describe("StatCard absence", () => {
  it("does not tint a numeric zero, even when a hue is asked for", () => {
    const html = render(
      <StatCard hue="cyan" label="Closed trades" tone="accent" value={0} />,
    );

    expect(html).not.toContain("hue-cyan");
    expect(html).not.toContain("accent-surface");
    expect(html).toContain("bg-surface-subtle");
  });

  it("does not tint a preformatted zero flagged as absent", () => {
    const html = render(
      <StatCard absent hue="lime" label="Net" tone="success" value="$0.00" />,
    );

    expect(html).not.toContain("hue-lime");
    expect(html).not.toContain("success-surface");
  });

  it("still tints a real measured value", () => {
    const html = render(
      <StatCard hue="cyan" label="Closed trades" tone="accent" value={12} />,
    );

    expect(html).toContain("hue-cyan");
  });

  it("sets a pending em-dash at label weight, not value weight", () => {
    const html = render(<StatCard label="Win rate" value={null} />);

    // The exact text is load-bearing: tests/ui/trading.spec.ts matches it with
    // getByText("—", { exact: true }).
    expect(html).toContain("—");
    expect(html).toContain("text-subtle");
    // The giveaway that an em-dash was being set like a statistic.
    expect(html).not.toContain("text-2xl");
    expect(html).not.toContain("tabular-nums");
  });

  it("keeps the hint, which is what carries the meaning when pending", () => {
    const html = render(
      <StatCard hint="No closed trades yet" label="Win rate" value={null} />,
    );

    expect(html).toContain("No closed trades yet");
  });
});

describe("StatCard hero", () => {
  it("shows the next action instead of headlining an absent value", () => {
    const html = render(
      <StatCard
        label="Streak"
        size="hero"
        value={0}
        whenAbsent="Start today's streak"
      />,
    );

    expect(html).toContain("Start today&#x27;s streak");
    // The bare zero must not be the biggest thing on the page.
    expect(html).not.toContain("text-5xl");
  });

  it("renders prose, not a number, in the fallback", () => {
    const html = render(
      <StatCard
        label="Streak"
        size="hero"
        value={null}
        whenAbsent="Log a session to start"
      />,
    );

    expect(html).not.toContain("tabular-nums");
  });

  it("headlines a real value at hero size", () => {
    const html = render(
      <StatCard label="Streak" size="hero" value={14} whenAbsent="Start" />,
    );

    expect(html).toContain("text-5xl");
    expect(html).not.toContain("Start");
  });

  it("complains in development when a hero headlines absence", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<StatCard label="Streak" size="hero" value={0} />);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Never headline absence"),
    );
    spy.mockRestore();
  });

  it("stays quiet when the hero has a real value", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<StatCard label="Streak" size="hero" value={14} />);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
