import { MAX_SECTION_LINKS } from "./sections";

/**
 * The order of the Content list: top-level ids, and the link ids inside
 * each section. The ⋯ menu's moves and Undo work on this shape, then the
 * dashboard saves it with reorderItems.
 */
export type Tree = { id: string; children: string[] }[];

/** Where an item sits: "top", the id of its section, or null if unknown. */
export function containerOf(tree: Tree, id: string): string | null {
  if (tree.some((e) => e.id === id)) return "top";
  return tree.find((e) => e.children.includes(id))?.id ?? null;
}

/**
 * Moves an item one step up (-1) or down (1) inside its own list. Returns
 * null when it's already at that end.
 */
export function moveBy(tree: Tree, id: string, step: -1 | 1): Tree | null {
  const container = containerOf(tree, id);
  if (container === "top") {
    const at = tree.findIndex((e) => e.id === id);
    const to = at + step;
    if (to < 0 || to >= tree.length) return null;
    const next = [...tree];
    [next[at], next[to]] = [next[to], next[at]];
    return next;
  }
  if (!container) return null;
  return mapSection(tree, container, (children) => {
    const at = children.indexOf(id);
    const to = at + step;
    if (to < 0 || to >= children.length) return null;
    const next = [...children];
    [next[at], next[to]] = [next[to], next[at]];
    return next;
  });
}

/**
 * Moves a link into a section (at its end), or out to the main list
 * (`sectionId` null, placed right under the section it left). Returns null
 * when nothing would change or the section is full. Only for links:
 * sections and photo carousels stay on the main list.
 */
export function moveInto(
  tree: Tree,
  id: string,
  sectionId: string | null,
): Tree | null {
  const from = containerOf(tree, id);
  if (!from || from === (sectionId ?? "top")) return null;
  const without = tree
    .filter((e) => e.id !== id)
    .map((e) =>
      e.id === from
        ? { ...e, children: e.children.filter((c) => c !== id) }
        : e,
    );
  if (sectionId === null) {
    const at = without.findIndex((e) => e.id === from);
    without.splice(at + 1, 0, { id, children: [] });
    return without;
  }
  return mapSection(without, sectionId, (children) =>
    children.length >= MAX_SECTION_LINKS ? null : [...children, id],
  );
}

/**
 * The list as it looks while deletes wait for Undo: the waiting items are
 * gone, and a section deleted with "keep its links" leaves its links where
 * it was.
 */
export function withoutPending(
  tree: Tree,
  pending: { id: string; keepLinks?: boolean }[],
): Tree {
  if (pending.length === 0) return tree;
  const gone = new Map(pending.map((p) => [p.id, p.keepLinks ?? false]));
  return tree.flatMap((e) => {
    const children = e.children.filter((c) => !gone.has(c));
    if (!gone.has(e.id)) return [{ ...e, children }];
    return gone.get(e.id) ? children.map((c) => ({ id: c, children: [] })) : [];
  });
}

function mapSection(
  tree: Tree,
  sectionId: string,
  change: (children: string[]) => string[] | null,
): Tree | null {
  const section = tree.find((e) => e.id === sectionId);
  if (!section) return null;
  const children = change(section.children);
  if (!children) return null;
  return tree.map((e) => (e.id === sectionId ? { ...e, children } : e));
}
