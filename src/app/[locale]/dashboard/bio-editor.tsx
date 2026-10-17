"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, cx } from "@/components/ui";
import {
  BIO_MAX_CHARS,
  cleanBio,
  normalizeBioHref,
  parseBio,
  plainBio,
  serializeBio,
  type BioMark,
  type BioNode,
} from "@/lib/rich-bio";

// label is a "bio" message key.
const TOOLS: {
  mark: BioMark;
  command: string;
  label: "bold" | "italic" | "underline" | "strike";
  icon: React.ReactNode;
}[] = [
  { mark: "b", command: "bold", label: "bold", icon: <span className="font-bold">B</span> },
  { mark: "i", command: "italic", label: "italic", icon: <span className="font-serif italic">I</span> },
  { mark: "u", command: "underline", label: "underline", icon: <span className="underline">U</span> },
  { mark: "s", command: "strikeThrough", label: "strike", icon: <span className="line-through">S</span> },
];

const MARK_TAGS: Record<string, BioMark> = {
  B: "b",
  STRONG: "b",
  I: "i",
  EM: "i",
  U: "u",
  S: "s",
  STRIKE: "s",
  DEL: "s",
};

// Turns what the browser put in the editor into a bio tree. Unknown tags
// keep their words and lose their formatting; the server cleans it again.
function readNodes(parent: Node): BioNode[] {
  const out: BioNode[] = [];
  parent.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/ /g, " ");
      if (text) out.push({ type: "text", text });
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    if (child.tagName === "BR") {
      out.push({ type: "br" });
      return;
    }
    let children = readNodes(child);
    if (child.tagName === "DIV" || child.tagName === "P") {
      if (out.length) out.push({ type: "br" });
      out.push(...children);
      return;
    }
    if (child.tagName === "A") {
      out.push({ type: "link", href: child.getAttribute("href") ?? "", children });
      return;
    }
    const marks = new Set<BioMark>();
    if (MARK_TAGS[child.tagName]) marks.add(MARK_TAGS[child.tagName]);
    const style = child.style;
    if (style.fontWeight === "bold" || Number(style.fontWeight) >= 600) marks.add("b");
    if (style.fontStyle === "italic") marks.add("i");
    if (style.textDecoration.includes("underline")) marks.add("u");
    if (style.textDecoration.includes("line-through")) marks.add("s");
    for (const mark of marks) children = [{ type: "mark", mark, children }];
    out.push(...children);
  });
  return out;
}

/**
 * Bio field with a small formatting bar. The formatted bio goes to the
 * form in a hidden input named "bio". Text blocks reuse it with their own
 * name, limit and wording.
 */
export function BioEditor({
  defaultValue,
  name = "bio",
  id = "field-bio",
  max = BIO_MAX_CHARS,
  label,
  placeholder,
  toolbarLabel,
  addLabel,
}: {
  defaultValue: string | null;
  name?: string;
  id?: string;
  max?: number;
  label?: string;
  placeholder?: string;
  toolbarLabel?: string;
  /** The button that adds a link, "Add to bio" by default. */
  addLabel?: string;
}) {
  const t = useTranslations("bio");
  const common = useTranslations("common");
  const editor = useRef<HTMLDivElement>(null);
  const [initial] = useState(() =>
    serializeBio(cleanBio(parseBio(defaultValue))),
  );
  const [value, setValue] = useState(initial);
  const [count, setCount] = useState(
    () => plainBio(cleanBio(parseBio(defaultValue))).length,
  );
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const savedRange = useRef<Range | null>(null);

  // The editor's content is owned by the browser after the first render,
  // so it is filled once here instead of through React. `initial` comes
  // from serializeBio, which escapes all text and only writes known tags.
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = initial;
    document.execCommand("styleWithCSS", false, "false");
  }, [initial]);

  // Stops typing at the limit. React's onBeforeInput is not the browser's
  // beforeinput event, so this listens to the real one.
  const countRef = useRef(count);
  useEffect(() => {
    countRef.current = count;
  }, [count]);
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    const onBeforeInput = (event: InputEvent) => {
      if (
        event.inputType?.startsWith("insert") &&
        countRef.current >= max &&
        document.getSelection()?.isCollapsed
      ) {
        event.preventDefault();
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [max]);

  useEffect(() => {
    const update = () => {
      const selection = document.getSelection();
      if (!selection?.anchorNode || !editor.current?.contains(selection.anchorNode)) {
        return;
      }
      const next: Record<string, boolean> = {};
      for (const tool of TOOLS) next[tool.mark] = document.queryCommandState(tool.command);
      next.link = Boolean(linkAt(selection.anchorNode));
      setActive(next);
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function linkAt(node: Node | null) {
    for (let n = node; n && n !== editor.current; n = n.parentNode) {
      if (n instanceof HTMLAnchorElement) return n;
    }
    return null;
  }

  function sync() {
    if (!editor.current) return;
    const nodes = readNodes(editor.current);
    setValue(serializeBio(nodes));
    setCount(plainBio(cleanBio(nodes)).length);
  }

  function format(command: string) {
    editor.current?.focus();
    document.execCommand(command);
    sync();
  }

  function onLinkButton() {
    const selection = document.getSelection();
    const existing = selection?.anchorNode && linkAt(selection.anchorNode);
    if (existing) {
      // Tapping Link inside a link removes it and keeps the words.
      existing.replaceWith(...existing.childNodes);
      sync();
      return;
    }
    savedRange.current =
      selection?.rangeCount && editor.current?.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null;
    setLinkUrl("");
    setLinkError(null);
    setLinkOpen(true);
  }

  function addLink() {
    const href = normalizeBioHref(linkUrl);
    if (!href) {
      setLinkError(t("badLink"));
      return;
    }
    const root = editor.current!;
    const range = savedRange.current ?? document.createRange();
    if (!savedRange.current) {
      range.selectNodeContents(root);
      range.collapse(false);
    }
    const link = document.createElement("a");
    link.href = href;
    if (range.collapsed) {
      // Nothing selected: the address itself becomes the link text.
      link.textContent = linkUrl.trim();
    } else {
      link.append(range.extractContents());
    }
    range.insertNode(link);
    setLinkOpen(false);
    root.focus();
    const selection = document.getSelection();
    selection?.removeAllRanges();
    const after = document.createRange();
    after.setStartAfter(link);
    selection?.addRange(after);
    sync();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      // A line break, not a new paragraph block.
      e.preventDefault();
      if (count < max) document.execCommand("insertLineBreak");
      sync();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // Pasted text arrives without its outside formatting.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
    const room = max - count + (document.getSelection()?.toString().length ?? 0);
    document.execCommand("insertText", false, text.slice(0, Math.max(0, room)));
    sync();
  }

  const over = count > max;
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-bold text-ink">
        {label ?? t("label")}
      </span>
      <div
        // Same look as the input() recipe, lit up while anything inside
        // has focus.
        className={cx(
          "flex w-full flex-col rounded-xl border bg-surface text-base text-ink transition focus-within:ring-2",
          over
            ? "border-danger focus-within:ring-danger/30"
            : "border-edge focus-within:border-brand focus-within:ring-brand/30",
        )}
      >
        <div
          role="toolbar"
          aria-label={toolbarLabel ?? t("toolbar")}
          className="flex flex-wrap gap-1 border-b border-line p-1"
        >
          {TOOLS.map((tool) => (
            <button
              key={tool.mark}
              type="button"
              title={t(tool.label)}
              aria-label={t(tool.label)}
              aria-pressed={Boolean(active[tool.mark])}
              // Keeps the text selected while the button is pressed.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(tool.command)}
              className={cx(
                "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base text-ink-soft transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-brand",
                active[tool.mark] && "bg-raised text-ink",
              )}
            >
              {tool.icon}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={Boolean(active.link)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLinkButton}
            className={cx(
              "flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-sm font-bold text-ink-soft transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-brand",
              active.link && "bg-raised text-ink",
            )}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
            {active.link ? t("removeLink") : t("link")}
          </button>
        </div>
        <div
          ref={editor}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-note`}
          aria-invalid={over || undefined}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder ?? t("placeholder")}
          onInput={sync}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="min-h-24 px-4 py-3 leading-relaxed text-ink outline-none empty:before:text-ink-muted empty:before:content-[attr(data-placeholder)] [&_a]:text-brand [&_a]:underline"
        />
      </div>
      {linkOpen && (
        <div className="flex flex-col gap-2 rounded-xl bg-raised p-3">
          <label htmlFor={`${id}-link`} className="text-sm font-bold text-ink">
            {t("linkAddress")}
            <span aria-hidden className="text-danger">
              {" "}
              *
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${id}-link`}
              autoFocus
              required
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
                if (e.key === "Escape") setLinkOpen(false);
              }}
              placeholder={t("linkPlaceholder")}
              invalid={Boolean(linkError)}
              aria-describedby={linkError ? `${id}-link-note` : undefined}
              className="min-w-0 flex-1"
            />
            <Button type="button" size="sm" onClick={addLink}>
              {addLabel ?? t("addToBio")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
              {common("cancel")}
            </Button>
          </div>
          {linkError ? (
            <p id={`${id}-link-note`} className="text-sm text-danger">
              {linkError}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              {t("selectFirst")}
            </p>
          )}
        </div>
      )}
      <input type="hidden" name={name} value={value} />
      <p
        id={`${id}-note`}
        aria-live="polite"
        className={cx("text-sm", over ? "text-danger" : "text-ink-muted")}
      >
        {t("count", { count, max })}
      </p>
    </div>
  );
}
