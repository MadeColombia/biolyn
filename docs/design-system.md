# Biolyn design system

Every Biolyn screen (homepage, login, dashboard, report, 404) is built from the same tokens and components, taken from the homepage. The goal is "professional but fun": warm off-white, one terracotta accent, bold rounded headings, flat surfaces. No 3D, no phone mockups, no decorative shapes.

Live reference: run `npm run dev` and open http://localhost:3000/styleguide (also works on Vercel preview deployments, hidden on biolyn.link).

Public profile pages (`/[username]`) are the exception: they use the owner's theme from `src/lib/themes.ts`, not this system.

## The rules

1. **Use tokens, never raw colors.** Write `bg-surface text-ink`, not `bg-[#fffbf5]` or `bg-white text-neutral-900`. Tokens switch to dark mode on their own, so never add `dark:` classes on a design system screen.
2. **Use the components first.** Import from `@/components/ui`. If a component almost fits, add a variant to it instead of writing new classes in a screen.
3. **One brand moment per area.** Terracotta (`brand`) is for the main action and one highlight. Everything else is ink on canvas or surface.
4. **Headings use `Heading`, text uses `font-body`.** `PageShell` sets the body font and colors for you.

## Tokens

Defined in `src/app/globals.css`. Each one becomes Tailwind utilities (`bg-`, `text-`, `border-`, `ring-`, ...).

| Token         | Light     | Dark      | Use for                                   |
| ------------- | --------- | --------- | ----------------------------------------- |
| `canvas`      | `#f5efe6` | `#15110f` | Page background                           |
| `surface`     | `#fffbf5` | `#211a17` | Cards, inputs                             |
| `raised`      | `#eadfd2` | `#2a211d` | Secondary buttons, chips, empty states    |
| `edge`        | `#e3d5c5` | `#3a2e28` | Borders around cards and inputs           |
| `line`        | `#e3d5c5` | `#2e2420` | Dividers between sections and list rows   |
| `ink`         | `#2a1e18` | `#f6eee8` | Main text                                 |
| `ink-soft`    | `#5e4b40` | `#cdbfb5` | Body copy under a heading                 |
| `ink-muted`   | `#74604f` | `#a39185` | Captions, hints, placeholders             |
| `brand`       | `#b9532d` | `#d2693f` | Primary buttons, highlights, focus rings  |
| `brand-hover` | `#a9472a` | `#e07a5f` | Hover on primary buttons                  |
| `on-brand`    | `#ffffff` | `#15110f` | Text on a `brand` background              |
| `danger`      | `#b42318` | `#f97066` | Errors, delete buttons                    |
| `success`     | `#2f7a4b` | `#6cc596` | Saved / done messages                     |

`danger` and `success` are new (the homepage had no errors to show). Their values are a first pick; adjust them in `globals.css` if they clash once real screens use them.

### Type

- `font-display` (Unbounded 700/800): headings only, always through `Heading`.
- `font-body` (IBM Plex Sans 400/600/700): everything else.

| `Heading size` | Classes                                       | Use for                      |
| -------------- | --------------------------------------------- | ---------------------------- |
| `display`      | `text-5xl sm:text-7xl leading-[1.05]` 800     | Hero headline, once per page |
| `title`        | `text-4xl` 800                                | Page titles, big sections    |
| `section`      | `text-2xl` 700 (default)                      | Card and small section titles |
| `label`        | `text-lg` 700                                 | Step numbers, stat numbers   |

`as` picks the HTML tag and `size` picks the look, so `<Heading as="h1" size="title">` is a normal page title.

Body text: `text-lg leading-relaxed text-ink-soft` for intros, plain `leading-relaxed text-ink-soft` inside cards, `text-sm text-ink-muted` for captions.

### Shape and spacing

- Radius: `rounded-xl` small controls and inputs, `rounded-2xl` large buttons, `rounded-3xl` cards, `rounded-full` badges.
- Page width: `container()` gives `max-w-6xl` (marketing), `container("medium")` gives `max-w-3xl` (dashboard), `container("narrow")` gives `max-w-md` (login and short forms). All have `px-6`.
- Card padding: `p-8` (default) or `p-6` (`padding="md"`, for dense screens like the dashboard).
- Gaps: `gap-4` between cards, `gap-6` to `gap-7` between blocks in a section, `py-16` to `py-20` between page sections.
- Touch targets: buttons and inputs are at least 44px tall (`min-h-11`).

## Components

All in `src/components/ui/`, exported from `@/components/ui`.

| Component              | What it is                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| `PageShell`            | Canvas background, body font, header (logo + Log in/Dashboard) and footer. Wrap every non-profile screen in it. `header={null}` hides the right side of the header. |
| `Heading`              | Display-font heading. Props: `as`, `size`.                                 |
| `Button`               | `<button>`. Props: `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`, `md`, `lg`), `fullWidth`. |
| `ButtonLink`           | Same look on a Next.js `<Link>`.                                           |
| `Card`                 | Panel. Props: `tone` (`plain`, `brand`, `interactive`), `padding` (`none`, `md`, `lg`). |
| `Field`                | Label + input + hint or error, linked for screen readers.                  |
| `Input`                | Just the input, when you need your own label layout.                       |
| `Badge`                | Small pill. `tone`: `brand` or `neutral`.                                  |
| `Logo`                 | The biolyn.link wordmark.                                                  |

When you need the look on an element the components don't cover (a `<span>` inside a link, an `<a>` to another site), use the class recipes from the same import: `button()`, `card()`, `heading()`, `input()`, `badge()`, `container()`, plus `cx()` to join classes. Recipes live in `src/components/ui/recipes.ts` and are unit tested.

Watch out: passing a class that fights a recipe's own class (for example `p-2` on top of `card()`'s `p-8`) does not reliably win in Tailwind. Use the recipe's option instead (`card({ padding: "none" })`) or add a new option.

## Example: a new screen

```tsx
import { Button, Card, Field, Heading, PageShell, container, cx } from "@/components/ui";

export default function SettingsPage() {
  return (
    <PageShell>
      <main className={cx(container("medium"), "flex flex-col gap-6 py-12")}>
        <Heading as="h1" size="title">Settings</Heading>
        <Card padding="md" className="flex flex-col gap-4">
          <Field label="Display name" name="display_name" />
          <Button>Save</Button>
        </Card>
      </main>
    </PageShell>
  );
}
```

## Changing the system

- New color: add it to both `:root` blocks and to `@theme inline` in `globals.css`, then to the table above and to `COLORS` in `src/app/styleguide/page.tsx`.
- New variant: add it to the recipe's map in `recipes.ts`, add a test in `tests/components/ui-recipes.test.ts`, show it on `/styleguide`.
- Check both light and dark mode (switch your OS appearance) and a 375px wide window before opening a PR.
