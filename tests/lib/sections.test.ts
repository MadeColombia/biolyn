import { describe, expect, it } from "vitest";
import {
  isSectionLayout,
  MAX_SECTION_LINKS,
  nestRows,
  parseSectionForm,
  planReorder,
  sectionIdFrom,
  sectionLayoutFrom,
} from "@/lib/sections";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe("section layouts", () => {
  it.each(["list", "carousel"])("accepts %s", (id) => {
    expect(isSectionLayout(id)).toBe(true);
    expect(sectionLayoutFrom(id)).toBe(id);
  });

  it.each([null, undefined, "", "grid", "toString", 3])(
    "falls back to list for %s",
    (value) => {
      expect(isSectionLayout(value)).toBe(false);
      expect(sectionLayoutFrom(value)).toBe("list");
    },
  );
});

describe("parseSectionForm", () => {
  it("trims the title and keeps the style", () => {
    expect(
      parseSectionForm(form({ title: "  Episodes ", layout: "carousel" })),
    ).toEqual({ values: { title: "Episodes", layout: "carousel" } });
  });

  it("allows a section without a title", () => {
    expect(parseSectionForm(form({ title: "   " }))).toEqual({
      values: { title: null, layout: "list" },
    });
    expect(parseSectionForm(new FormData())).toEqual({
      values: { title: null, layout: "list" },
    });
  });

  it("refuses a long title", () => {
    expect(parseSectionForm(form({ title: "x".repeat(81) }))).toEqual({
      error: "titleTooLong",
    });
  });
});

describe("sectionIdFrom", () => {
  it("reads the chosen section, or null for the main list", () => {
    expect(sectionIdFrom(form({ section_id: " s1 " }))).toBe("s1");
    expect(sectionIdFrom(form({ section_id: "" }))).toBeNull();
    expect(sectionIdFrom(new FormData())).toBeNull();
  });
});

describe("nestRows", () => {
  it("groups links under their section and drops orphans", () => {
    const rows = [
      { id: "a", parent_id: null },
      { id: "s", parent_id: null },
      { id: "b", parent_id: "s" },
      { id: "c", parent_id: "gone" },
      { id: "d" },
      { id: "e", parent_id: "s" },
    ];
    expect(
      nestRows(rows).map((n) => [n.row.id, n.children.map((c) => c.id)]),
    ).toEqual([
      ["a", []],
      ["s", ["b", "e"]],
      ["d", []],
    ]);
  });
});

describe("planReorder", () => {
  const rows = [
    { id: "a", kind: "link" },
    { id: "b", kind: "link" },
    { id: "g", kind: "gallery" },
    { id: "s", kind: "section" },
    { id: "t", kind: "section" },
  ];

  it("places top-level rows and the links inside sections", () => {
    expect(
      planReorder(
        [
          { id: "s", children: ["b", "a"] },
          { id: "g" },
          { id: "t", children: [] },
        ],
        rows,
      ),
    ).toEqual([
      { id: "s", position: 0, parent_id: null },
      { id: "b", position: 0, parent_id: "s" },
      { id: "a", position: 1, parent_id: "s" },
      { id: "g", position: 1, parent_id: null },
      { id: "t", position: 2, parent_id: null },
    ]);
  });

  it.each([
    ["not a list", { id: "a" }],
    ["a row that isn't an object", ["a", "b", "g", "s", "t"]],
    [
      "someone else's row",
      [{ id: "a" }, { id: "b" }, { id: "g" }, { id: "s" }, { id: "x" }],
    ],
    ["a missing row", [{ id: "a" }, { id: "b" }, { id: "g" }, { id: "s" }]],
    [
      "a duplicate",
      [
        { id: "a" },
        { id: "a" },
        { id: "b" },
        { id: "g" },
        { id: "s" },
        { id: "t" },
      ],
    ],
    [
      "a duplicate inside a section",
      [
        { id: "s", children: ["a"] },
        { id: "a" },
        { id: "b" },
        { id: "g" },
        { id: "t" },
      ],
    ],
    [
      "links inside a link",
      [{ id: "a", children: ["b"] }, { id: "g" }, { id: "s" }, { id: "t" }],
    ],
    [
      "a gallery inside a section",
      [{ id: "s", children: ["g"] }, { id: "a" }, { id: "b" }, { id: "t" }],
    ],
    [
      "a section inside a section",
      [{ id: "s", children: ["t"] }, { id: "a" }, { id: "b" }, { id: "g" }],
    ],
    [
      "children that aren't a list",
      [
        { id: "s", children: "a" },
        { id: "a" },
        { id: "b" },
        { id: "g" },
        { id: "t" },
      ],
    ],
  ])("refuses %s", (_label, tree) => {
    expect(planReorder(tree, rows)).toBeNull();
  });

  it("refuses a section over its limit", () => {
    const many = Array.from({ length: MAX_SECTION_LINKS + 1 }, (_, i) => ({
      id: `l${i}`,
      kind: "link",
    }));
    const all = [{ id: "s", kind: "section" }, ...many];
    const ids = many.map((l) => l.id);
    expect(planReorder([{ id: "s", children: ids }], all)).toBeNull();
    expect(
      planReorder([{ id: "s", children: ids.slice(1) }, { id: ids[0] }], all),
    ).toHaveLength(all.length);
  });
});
