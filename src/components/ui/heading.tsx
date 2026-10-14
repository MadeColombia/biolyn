import { cx, heading, type HeadingSize } from "./recipes";

/**
 * Heading in the display font. `as` picks the HTML tag (for screen readers
 * and SEO), `size` picks the look, so an h2 can still look like a title.
 */
export function Heading({
  as: Tag = "h2",
  size,
  className,
  ...props
}: {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  size?: HeadingSize;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  return <Tag className={cx(heading(size), className)} {...props} />;
}
