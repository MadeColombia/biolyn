import { badge, cx, type BadgeTone } from "./recipes";

/** Small pill label, like "Last used" or "Scheduled". */
export function Badge({
  tone,
  className,
  ...props
}: { tone?: BadgeTone } & React.ComponentProps<"span">) {
  return <span className={cx(badge(tone), className)} {...props} />;
}
