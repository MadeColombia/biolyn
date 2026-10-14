import { describe, expect, it } from "vitest";
import * as ui from "@/components/ui";

describe("@/components/ui", () => {
  it("exports the components and recipes screens use", () => {
    for (const name of [
      "Badge",
      "Button",
      "ButtonLink",
      "Card",
      "Field",
      "Heading",
      "Input",
      "Logo",
      "LogoMark",
      "LogoMotion",
      "PageShell",
      "button",
      "card",
      "container",
      "cx",
      "heading",
      "input",
      "badge",
    ]) {
      expect(ui).toHaveProperty(name);
    }
  });
});
