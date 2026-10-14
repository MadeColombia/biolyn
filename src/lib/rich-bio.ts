// Bios can have bold, italic, underlined and crossed out words, links and
// line breaks. They are stored in profiles.bio as a tiny HTML subset:
//
//   <b>bold</b> <i>italic</i> <u>underline</u> <s>crossed out</s>
//   <a href="https://...">link</a> <br>
//
// The parser below only knows those exact tags. Anything else, like
// <script> or <img onerror=...>, is kept as plain text, and the public page
// builds React elements from the parsed tree instead of setting innerHTML,
// so a bio can never run code. Old plain bios read back unchanged.

export const BIO_MAX_CHARS = 160; // What visitors see, tags not counted.
export const BIO_MAX_STORED = 1000; // Database limit, tags included.
const MAX_HREF = 300;
const MAX_BREAKS_IN_A_ROW = 2;

export type BioMark = "b" | "i" | "u" | "s";
export type BioNode =
  | { type: "text"; text: string }
  | { type: "br" }
  | { type: "mark"; mark: BioMark; children: BioNode[] }
  | { type: "link"; href: string; children: BioNode[] };

type Parent = Extract<BioNode, { children: BioNode[] }>;
type Open = { node: Parent | null; children: BioNode[] };

const TAG =
  /<(?:(b|i|u|s)>|\/(b|i|u|s|a)>|br\s*\/?>|a href="([^"<>]*)">)|&(lt|gt|amp|quot);/g;
const ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
};

/** Reads a stored bio into a tree. Never throws. */
export function parseBio(source: string | null | undefined): BioNode[] {
  const root: Open = { node: null, children: [] };
  const stack: Open[] = [root];
  const top = () => stack[stack.length - 1];
  const addText = (text: string) => {
    if (!text) return;
    const siblings = top().children;
    const last = siblings[siblings.length - 1];
    if (last?.type === "text") last.text += text;
    else siblings.push({ type: "text", text });
  };
  const open = (node: Parent) => {
    top().children.push(node);
    stack.push({ node, children: node.children });
  };

  const src = source ?? "";
  let at = 0;
  for (const match of src.matchAll(TAG)) {
    addText(src.slice(at, match.index));
    at = match.index + match[0].length;
    const [whole, opening, closing, href, entity] = match;

    if (entity) addText(ENTITIES[entity]);
    else if (opening) open({ type: "mark", mark: opening as BioMark, children: [] });
    else if (href !== undefined) open({ type: "link", href: decode(href), children: [] });
    else if (closing) {
      // Close the nearest matching tag (and anything left open inside
      // it). A closing tag with nothing to close is dropped.
      const kind = closing === "a" ? "link" : "mark";
      for (let i = stack.length - 1; i > 0; i--) {
        const node = stack[i].node!;
        if (node.type === kind && (kind === "link" || (node as { mark: string }).mark === closing)) {
          stack.length = i;
          break;
        }
      }
    } else if (whole.startsWith("<br")) top().children.push({ type: "br" });
  }
  addText(src.slice(at));
  return root.children;
}

function decode(text: string) {
  return text.replace(/&(lt|gt|amp|quot);/g, (_, e: string) => ENTITIES[e]);
}

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text: string) =>
  escapeText(text).replace(/"/g, "&quot;");

/** Writes a tree back in the stored format. */
export function serializeBio(nodes: BioNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return escapeText(node.text);
        case "br":
          return "<br>";
        case "mark":
          return `<${node.mark}>${serializeBio(node.children)}</${node.mark}>`;
        case "link":
          return `<a href="${escapeAttr(node.href)}">${serializeBio(node.children)}</a>`;
      }
    })
    .join("");
}

/** The words only, for the page description and the character count. */
export function plainBio(nodes: BioNode[], lineBreak = "\n"): string {
  return nodes
    .map((node) =>
      node.type === "text"
        ? node.text
        : node.type === "br"
          ? lineBreak
          : plainBio(node.children, lineBreak),
    )
    .join("");
}

/** Every link in a bio, so the server can check each one. */
export function bioLinks(nodes: BioNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "link"
      ? [node.href, ...bioLinks(node.children)]
      : node.type === "mark"
        ? bioLinks(node.children)
        : [],
  );
}

/**
 * Makes a link address safe to store: http(s) only, https:// added when
 * missing. Returns null for anything else (javascript:, data:, ...).
 */
export function normalizeBioHref(raw: string): string | null {
  let value = raw.trim();
  if (!value || value.length > MAX_HREF) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href.length > MAX_HREF ? null : url.href;
  } catch {
    return null;
  }
}

// Drops empty formatting, links inside links and links with a bad
// address (their words stay), and runs of blank lines.
function clean(nodes: BioNode[], inLink: boolean): BioNode[] {
  const out: BioNode[] = [];
  let breaks = 0;
  for (const node of nodes) {
    if (node.type === "br") {
      if (++breaks <= MAX_BREAKS_IN_A_ROW) out.push(node);
      continue;
    }
    breaks = 0;
    if (node.type === "text") {
      out.push(node);
      continue;
    }
    const children = clean(node.children, inLink || node.type === "link");
    if (!plainBio(children).trim() && !children.some((c) => c.type === "br")) {
      continue;
    }
    if (node.type === "link") {
      const href = inLink ? null : normalizeBioHref(node.href);
      if (href) out.push({ type: "link", href, children });
      else out.push(...children);
    } else {
      out.push({ ...node, children });
    }
  }
  return out;
}

// Removes line breaks at the very start and end.
function trimBreaks(nodes: BioNode[]): BioNode[] {
  let start = 0;
  let end = nodes.length;
  while (start < end && nodes[start].type === "br") start++;
  while (end > start && nodes[end - 1].type === "br") end--;
  return nodes.slice(start, end);
}

/** A parsed bio made safe to show: bad links unwrapped, blank lines tidied. */
export function cleanBio(nodes: BioNode[]): BioNode[] {
  return trimBreaks(clean(nodes, false));
}

/**
 * Cleans a bio sent by the dashboard. Returns what to store, or an error
 * message for the user.
 */
export function sanitizeBio(
  raw: string,
): { bio: string; links: string[] } | { error: string } {
  const nodes = cleanBio(parseBio(raw));
  const visible = plainBio(nodes);
  if (!visible.trim()) return { bio: "", links: [] };
  if (visible.length > BIO_MAX_CHARS) {
    return { error: `Keep your bio under ${BIO_MAX_CHARS} characters.` };
  }
  const bio = serializeBio(nodes);
  if (bio.length > BIO_MAX_STORED) {
    return { error: "Your bio has too much formatting. Remove some of it." };
  }
  return { bio, links: bioLinks(nodes) };
}
