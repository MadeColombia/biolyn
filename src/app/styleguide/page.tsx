import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Field,
  Heading,
  Logo,
  LogoMark,
  PageShell,
  container,
  cx,
} from "@/components/ui";

// Living reference for the design system (docs/design-system.md).
// Visible locally and on Vercel previews, hidden on biolyn.link.
export const metadata: Metadata = {
  title: "Style guide | Biolyn",
  robots: { index: false },
};

const COLORS = [
  ["canvas", "bg-canvas", "Page background"],
  ["surface", "bg-surface", "Cards and inputs"],
  ["raised", "bg-raised", "Secondary buttons, chips"],
  ["edge", "bg-edge", "Borders"],
  ["line", "bg-line", "Dividers"],
  ["ink", "bg-ink", "Main text"],
  ["ink-soft", "bg-ink-soft", "Body copy"],
  ["ink-muted", "bg-ink-muted", "Captions, hints"],
  ["brand", "bg-brand", "Primary actions"],
  ["brand-hover", "bg-brand-hover", "Primary hover"],
  ["danger", "bg-danger", "Errors, delete"],
  ["success", "bg-success", "Saved, done"],
] as const;

export default function StyleGuide() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <PageShell>
      <main className={cx(container(), "flex flex-col gap-16 py-12")}>
        <div className="flex flex-col gap-3">
          <Heading as="h1" size="title">
            Style guide
          </Heading>
          <p className="max-w-xl text-lg text-ink-soft">
            Every Biolyn screen is built from these pieces. Switch your system
            to dark mode to check both palettes.
          </p>
        </div>

        <Section title="Logo">
          <div className="flex flex-wrap items-center gap-6">
            <LogoMark size={96} title="Biolyn" />
            <LogoMark size={64} />
            <LogoMark size={32} />
            <LogoMark size={16} />
            <Logo />
          </div>
          <p className="text-sm text-ink-muted">
            Files for other uses (Instagram, print, slides) are in
            public/brand/.
          </p>
        </Section>

        <Section title="Colors">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {COLORS.map(([name, swatch, use]) => (
              <div key={name} className="flex flex-col gap-2">
                <div
                  className={cx(swatch, "h-16 rounded-2xl border border-edge")}
                />
                <code className="text-sm font-bold">{name}</code>
                <span className="text-sm text-ink-muted">{use}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type">
          <Heading as="p" size="display">
            Display
          </Heading>
          <Heading as="p" size="title">
            Title
          </Heading>
          <Heading as="p" size="section">
            Section
          </Heading>
          <Heading as="p" size="label">
            Label
          </Heading>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
            Body copy in IBM Plex Sans, ink-soft, relaxed line height.
          </p>
          <p className="text-sm text-ink-muted">Caption in ink-muted.</p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <ButtonLink href="/login" size="lg">
              Large link
            </ButtonLink>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex flex-col gap-2">
              <Heading>Plain</Heading>
              <p className="text-ink-soft">The default panel.</p>
            </Card>
            <Card tone="brand" className="flex flex-col gap-2">
              <Heading>Brand</Heading>
              <p>One highlight per screen.</p>
            </Card>
            <Card tone="interactive" padding="md" className="flex flex-col gap-2">
              <Heading>Interactive</Heading>
              <p className="text-ink-soft">For cards that are links.</p>
            </Card>
          </div>
        </Section>

        <Section title="Forms">
          <div className="flex max-w-md flex-col gap-5">
            <Field label="Email" name="email" type="email" placeholder="you@example.com" />
            <Field
              label="Username"
              name="username"
              hint="Letters, numbers and underscores."
            />
            <Field
              label="Link"
              name="url"
              defaultValue="not a link"
              error="Enter a full link, like https://example.com"
            />
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex gap-3">
            <Badge>Last used</Badge>
            <Badge tone="neutral">Scheduled</Badge>
          </div>
        </Section>
      </main>
    </PageShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-line pt-8">
      <Heading>{title}</Heading>
      {children}
    </section>
  );
}
