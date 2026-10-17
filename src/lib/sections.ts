// Section rules shared by the dashboard and the public page. A section is
// a row in public.links (kind "section") with a title; the links inside
// it point at it with parent_id. There is only one level: sections hold
// links, never other sections or photo galleries.
export const MAX_SECTION_LINKS = 24; // per section, also checked in the database
export const MAX_SECTIONS = 20; // per page
export const MAX_SECTION_TITLE = 80;

// list: normal buttons under the title. carousel: a row of cards people
// swipe (arrows on computers).
export const SECTION_LAYOUTS = ["list", "carousel"] as const;
export type SectionLayout = (typeof SECTION_LAYOUTS)[number];

export function isSectionLayout(value: unknown): value is SectionLayout {
  return (
    typeof value === "string" &&
    (SECTION_LAYOUTS as readonly string[]).includes(value)
  );
}

export function sectionLayoutFrom(value: unknown): SectionLayout {
  return isSectionLayout(value) ? value : "list";
}

/**
 * Reads the add and edit section forms. The title is optional (a section
 * can be just a group). Errors are keys of "errors" messages.
 */
export function parseSectionForm(
  formData: FormData,
):
  | { error: "titleTooLong" }
  | { values: { title: string | null; layout: SectionLayout } } {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length > MAX_SECTION_TITLE) return { error: "titleTooLong" };
  return {
    values: {
      title: title || null,
      layout: sectionLayoutFrom(formData.get("layout")),
    },
  };
}

/** The section picked in the link form, or null for the top level. */
export function sectionIdFrom(formData: FormData): string | null {
  const id = String(formData.get("section_id") ?? "").trim();
  return id || null;
}

/**
 * Groups rows (already in position order) into top-level rows, each with
 * the rows inside it. Rows whose section is missing (hidden, deleted or
 * filtered out) are dropped, so a hidden section hides its links too.
 */
export function nestRows<T extends { id: string; parent_id?: string | null }>(
  rows: T[],
): { row: T; children: T[] }[] {
  const top = rows
    .filter((r) => !r.parent_id)
    .map((row) => ({ row, children: [] as T[] }));
  const byId = new Map(top.map((n) => [n.row.id, n]));
  for (const r of rows) {
    if (r.parent_id) byId.get(r.parent_id)?.children.push(r);
  }
  return top;
}

/** The order the editor sends after a drag: top-level ids, and for each
 * section the ids of the links inside it. */
export type ItemTree = { id: string; children?: string[] }[];

export type PlacedRow = {
  id: string;
  position: number;
  parent_id: string | null;
};

/**
 * Checks a new order against the user's own rows and returns where each
 * row goes. Returns null, so nothing changes, unless the tree holds
 * exactly the user's rows once each, only sections have links inside,
 * only links go inside, and no section is over its limit.
 */
export function planReorder(
  tree: unknown,
  rows: { id: string; kind: string }[],
): PlacedRow[] | null {
  if (!Array.isArray(tree)) return null;
  const kinds = new Map(rows.map((r) => [r.id, r.kind]));
  const seen = new Set<string>();
  const placed: PlacedRow[] = [];

  const take = (id: unknown): id is string => {
    if (typeof id !== "string" || !kinds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  };

  for (const [position, entry] of tree.entries()) {
    if (typeof entry !== "object" || entry === null) return null;
    const { id, children = [] } = entry as {
      id?: unknown;
      children?: unknown;
    };
    if (!take(id) || !Array.isArray(children)) return null;
    placed.push({ id, position, parent_id: null });
    if (children.length === 0) continue;
    if (kinds.get(id) !== "section") return null;
    if (children.length > MAX_SECTION_LINKS) return null;
    for (const [childPosition, child] of children.entries()) {
      if (!take(child) || kinds.get(child) !== "link") return null;
      placed.push({ id: child, position: childPosition, parent_id: id });
    }
  }

  return seen.size === kinds.size ? placed : null;
}
