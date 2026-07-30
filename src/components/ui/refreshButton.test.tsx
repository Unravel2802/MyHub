import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RefreshButton } from "./RefreshButton";

const render = (ui: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(ui);

describe("RefreshButton", () => {
  it("renders text variant by default with label 'Refresh'", () => {
    const html = render(<RefreshButton id="test-refresh" />);

    expect(html).toContain('id="test-refresh"');
    expect(html).toContain("Refresh");
    expect(html).toContain("<svg");
  });

  it("renders icon variant with accessible aria-label", () => {
    const html = render(
      <RefreshButton
        variant="icon"
        ariaLabel="Refresh trading journal"
        id="icon-refresh"
      />,
    );

    expect(html).toContain('id="icon-refresh"');
    expect(html).toContain('aria-label="Refresh trading journal"');
    expect(html).not.toContain("<span>Refresh</span>");
  });

  it("handles isRefreshing state by disabling button and adding spin animation", () => {
    const html = render(
      <RefreshButton isRefreshing={true} id="spinning-refresh" />,
    );

    expect(html).toContain("disabled");
    expect(html).toContain("animate-spin");
  });
});
