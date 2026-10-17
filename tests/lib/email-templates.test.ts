import { describe, expect, it } from "vitest";
import { AUTH_EMAIL_TYPES, supabaseTemplate } from "@/lib/email/auth-templates";

// The files in supabase/templates are what gets pasted into Supabase.
// They are built from src/lib/email/auth-templates.ts; after changing the
// copy or the layout run `npm run email:templates` to rebuild them.
describe.each(AUTH_EMAIL_TYPES)("Supabase %s template", (type) => {
  const { subject, html } = supabaseTemplate(type);

  it("matches the file to paste into Supabase", async () => {
    await expect(html).toMatchFileSnapshot(`../../supabase/templates/${type}.html`);
    await expect(`${subject}\n`).toMatchFileSnapshot(
      `../../supabase/templates/${type}.subject.txt`,
    );
  });

  it("picks Spanish from the account locale, English otherwise", () => {
    for (const text of [subject, html]) {
      expect(text.startsWith('{{ if eq (printf "%v" .Data.locale) "es" }}')).toBe(true);
      expect(text.match(/\{\{ else \}\}/g)).toHaveLength(1);
      expect(text.trimEnd().endsWith("{{ end }}")).toBe(true);
    }
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<html lang="en">');
  });

  it("links the button to the Supabase sign-in link", () => {
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
  });

  it("has no HTML comments (Supabase strips them)", () => {
    expect(html).not.toContain("<!--");
  });
});
