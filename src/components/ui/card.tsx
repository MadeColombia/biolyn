import { card, cx, type CardTone } from "./recipes";

/** Rounded panel. tone="brand" for the one highlighted card on a screen. */
export function Card({
  tone,
  padding,
  className,
  ...props
}: {
  tone?: CardTone;
  padding?: "none" | "md" | "lg";
} & React.ComponentProps<"div">) {
  return <div className={cx(card({ tone, padding }), className)} {...props} />;
}
