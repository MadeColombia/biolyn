import { cx, input } from "./recipes";

/** Text input in the design system style. */
export function Input({
  invalid,
  className,
  ...props
}: { invalid?: boolean } & React.ComponentProps<"input">) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(input({ invalid }), className)}
      {...props}
    />
  );
}

/**
 * Label + input + optional hint or error, wired together for screen
 * readers. A `required` field gets a * after its label. Extra props go to the input. The id comes from `id`, else
 * `name`, else the label, so keep them unique on a screen.
 */
export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string | null;
} & React.ComponentProps<"input">) {
  const inputId = id ?? `field-${props.name ?? label.toLowerCase().replace(/\W+/g, "-")}`;
  const noteId = `${inputId}-note`;
  const note = error || hint;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-bold text-ink">
        {label}
        {/* Screen readers already announce the input as required. */}
        {props.required && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      <Input
        id={inputId}
        invalid={Boolean(error)}
        aria-describedby={note ? noteId : undefined}
        {...props}
      />
      {note && (
        <p
          id={noteId}
          className={cx("text-sm", error ? "text-danger" : "text-ink-muted")}
        >
          {note}
        </p>
      )}
    </div>
  );
}
