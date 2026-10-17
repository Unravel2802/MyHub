import { expect, it } from "vitest";
import { diagramFit } from "./diagramFit";

it("keeps a diagram that already fits at natural size", () => {
  expect(diagramFit(400, 620)).toEqual({
    scale: 1,
    width: 400,
    overflows: false,
  });
});
it("scales down to fit when the resulting scale is at least 0.75", () => {
  expect(diagramFit(800, 640)).toEqual({
    scale: 0.8,
    width: 640,
    overflows: false,
  });
});
it("clamps at 0.75 and scrolls when fitting would make text too small", () => {
  expect(diagramFit(1000, 600)).toEqual({
    scale: 0.75,
    width: 750,
    overflows: true,
  });
});
it("treats an unmeasured viewport as pending rather than dividing by zero", () => {
  expect(diagramFit(800, 0)).toEqual({
    scale: 1,
    width: 800,
    overflows: false,
  });
});
