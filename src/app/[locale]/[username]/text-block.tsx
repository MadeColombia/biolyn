import { RichBio } from "@/components/rich-bio";
import type { PublicDivider, PublicText } from "@/lib/profiles";
import type { THEMES } from "@/lib/themes";

type Theme = (typeof THEMES)[keyof typeof THEMES];

/** A text block: a bold title over a short paragraph, centered like the bio. */
export function TextBlock({ text, theme }: { text: PublicText; theme: Theme }) {
  const headingId = `text-${text.id}`;
  return (
    <section
      aria-labelledby={text.title ? headingId : undefined}
      className="flex flex-col gap-1 px-2 text-center break-words"
    >
      {text.title && (
        <h2 id={headingId} className="text-lg font-bold">
          {text.title}
        </h2>
      )}
      {text.body.length > 0 && (
        <p className={`leading-relaxed ${theme.muted}`}>
          <RichBio nodes={text.body} />
        </p>
      )}
    </section>
  );
}

/** A divider: a thin line in the page's own text color, or empty room. */
export function DividerBlock({ divider }: { divider: PublicDivider }) {
  return divider.style === "line" ? (
    <hr className="my-3 border-current/20" />
  ) : (
    <div aria-hidden className="h-8" />
  );
}
