import { describe, expect, it } from "vitest";
import {
  containerOf,
  moveBy,
  moveInto,
  withoutPending,
  type Tree,
} from "@/lib/item-tree";
import { MAX_SECTION_LINKS } from "@/lib/sections";

const tree: Tree = [
  { id: "a", children: [] },
  { id: "s", children: ["b", "c"] },
  { id: "g", children: [] },
  { id: "t", children: [] },
];

describe("containerOf", () => {
  it("finds the main list, a section, or nothing", () => {
    expect(containerOf(tree, "a")).toBe("top");
    expect(containerOf(tree, "c")).toBe("s");
    expect(containerOf(tree, "x")).toBeNull();
  });
});

describe("moveBy", () => {
  it("swaps with the neighbour on the main list", () => {
    expect(moveBy(tree, "g", -1)?.map((e) => e.id)).toEqual([
      "a",
      "g",
      "s",
      "t",
    ]);
    expect(moveBy(tree, "a", 1)?.map((e) => e.id)).toEqual([
      "s",
      "a",
      "g",
      "t",
    ]);
  });

  it("swaps inside a section", () => {
    expect(moveBy(tree, "c", -1)?.[1].children).toEqual(["c", "b"]);
    expect(moveBy(tree, "b", 1)?.[1].children).toEqual(["c", "b"]);
  });

  it("stops at either end and for unknown ids", () => {
    expect(moveBy(tree, "a", -1)).toBeNull();
    expect(moveBy(tree, "t", 1)).toBeNull();
    expect(moveBy(tree, "b", -1)).toBeNull();
    expect(moveBy(tree, "c", 1)).toBeNull();
    expect(moveBy(tree, "x", 1)).toBeNull();
  });

  it("leaves the original alone", () => {
    moveBy(tree, "g", -1);
    moveBy(tree, "c", -1);
    expect(tree.map((e) => e.id)).toEqual(["a", "s", "g", "t"]);
    expect(tree[1].children).toEqual(["b", "c"]);
  });
});

describe("moveInto", () => {
  it("puts a link at the end of a section", () => {
    expect(moveInto(tree, "a", "s")).toEqual([
      { id: "s", children: ["b", "c", "a"] },
      { id: "g", children: [] },
      { id: "t", children: [] },
    ]);
    expect(moveInto(tree, "b", "t")).toEqual([
      { id: "a", children: [] },
      { id: "s", children: ["c"] },
      { id: "g", children: [] },
      { id: "t", children: ["b"] },
    ]);
  });

  it("takes a link out, right under its old section", () => {
    expect(moveInto(tree, "b", null)).toEqual([
      { id: "a", children: [] },
      { id: "s", children: ["c"] },
      { id: "b", children: [] },
      { id: "g", children: [] },
      { id: "t", children: [] },
    ]);
  });

  it("refuses moves that change nothing or don't fit", () => {
    expect(moveInto(tree, "a", null)).toBeNull();
    expect(moveInto(tree, "b", "s")).toBeNull();
    expect(moveInto(tree, "x", "s")).toBeNull();
    expect(moveInto(tree, "a", "nope")).toBeNull();
    const full: Tree = [
      { id: "a", children: [] },
      {
        id: "s",
        children: Array.from({ length: MAX_SECTION_LINKS }, (_, i) => `o${i}`),
      },
    ];
    expect(moveInto(full, "a", "s")).toBeNull();
  });
});

describe("withoutPending", () => {
  it("returns the same list when nothing waits", () => {
    expect(withoutPending(tree, [])).toBe(tree);
  });

  it("hides waiting rows and links", () => {
    expect(withoutPending(tree, [{ id: "g" }, { id: "b" }])).toEqual([
      { id: "a", children: [] },
      { id: "s", children: ["c"] },
      { id: "t", children: [] },
    ]);
  });

  it("drops a section with its links, or leaves the links in its place", () => {
    expect(withoutPending(tree, [{ id: "s" }]).map((e) => e.id)).toEqual([
      "a",
      "g",
      "t",
    ]);
    expect(withoutPending(tree, [{ id: "s", keepLinks: true }])).toEqual([
      { id: "a", children: [] },
      { id: "b", children: [] },
      { id: "c", children: [] },
      { id: "g", children: [] },
      { id: "t", children: [] },
    ]);
  });
});
