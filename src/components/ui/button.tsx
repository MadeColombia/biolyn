import Link from "next/link";
import { button, cx, type ButtonSize, type ButtonVariant } from "./recipes";

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

/** A <button>. Use ButtonLink when it goes to another page. */
export function Button({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: StyleProps & React.ComponentProps<"button">) {
  return (
    <button
      className={cx(button({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

/** A Next.js <Link> that looks like a Button. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: StyleProps & React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(button({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}
