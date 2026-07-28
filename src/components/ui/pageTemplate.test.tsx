import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// Imported from PageTemplateBody, not PageTemplate: the latter pulls AppShell,
// which constructs a Supabase client at import time and throws without env vars.
// That split is deliberate — see the header comment in PageTemplateBody.tsx.
import {
  MAX_STATS,
  PageTemplateBody,
  SLOT_ORDER,
} from "@/src/components/ui/PageTemplateBody";

// The point of these tests is the SLOT ORDER, not the markup.
//
// Trading shipped a nine-field entry form above its equity curve and journal —
// the exact defect docs/visual-refresh.md §1.5 diagnosed and fixed for three
// other modules, reintroduced because "data before forms" lived only in prose.
// PageTemplate renders by mapping over SLOT_ORDER, so these assertions are
// against the same array the component renders from: reorder the page and you
// must reorder that array, and this suite goes red.

function markup(props: Partial<Parameters<typeof PageTemplateBody>[0]> = {}) {
  return renderToStaticMarkup(
    <PageTemplateBody
      eyebrow="Money"
      hero={<p>HERO</p>}
      href="/trading"
      title="Trading Journal"
      {...props}
    >
      <p>DATA</p>
    </PageTemplateBody>,
  );
}

const orderOf = (html: string, ...needles: string[]) =>
  needles.map((needle) => html.indexOf(needle));

const isAscending = (positions: number[]) =>
  positions.every((n, i) => n > -1 && (i === 0 || n > positions[i - 1]));

describe("PageTemplate slot order", () => {
  it("renders entry forms after the data, never before", () => {
    const html = markup({ compose: <form>COMPOSE</form> });

    expect(isAscending(orderOf(html, "DATA", "COMPOSE"))).toBe(true);
  });

  it("keeps compose last even when every slot is filled", () => {
    const html = markup({
      compose: <form>COMPOSE</form>,
      stats: [<p key="s">STAT</p>],
    });

    expect(isAscending(orderOf(html, "HERO", "STAT", "DATA", "COMPOSE"))).toBe(
      true,
    );
  });

  it("puts the header and the error banner above every slot", () => {
    const html = markup({ error: "Something went wrong" });

    expect(
      isAscending(
        orderOf(
          html,
          "Trading Journal",
          "Something went wrong",
          "HERO",
          "DATA",
        ),
      ),
    ).toBe(true);
  });

  it("declares data before compose in SLOT_ORDER", () => {
    expect(SLOT_ORDER.indexOf("data")).toBeLessThan(
      SLOT_ORDER.indexOf("compose"),
    );
    expect(SLOT_ORDER.indexOf("hero")).toBeLessThan(SLOT_ORDER.indexOf("data"));
  });
});

describe("PageTemplate slots", () => {
  it("omits absent slots rather than emitting empty wrappers", () => {
    const html = markup({ hero: null });

    expect(html).not.toContain('data-slot="hero"');
    expect(html).not.toContain('data-slot="stats"');
    expect(html).not.toContain('data-slot="compose"');
    expect(html).toContain('data-slot="data"');
  });

  it("renders the error banner assertively only when there is an error", () => {
    expect(markup()).not.toContain('role="alert"');
    expect(markup({ error: "Boom" })).toContain('aria-live="assertive"');
  });

  it("caps secondary stats and says so loudly in development", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const tooMany = Array.from({ length: MAX_STATS + 2 }, (_, i) => (
      <p key={i}>STAT{i}</p>
    ));

    const html = markup({ stats: tooMany });

    expect(html).toContain(`STAT${MAX_STATS - 1}`);
    expect(html).not.toContain(`STAT${MAX_STATS}`);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("max is 4"));
    spy.mockRestore();
  });
});
