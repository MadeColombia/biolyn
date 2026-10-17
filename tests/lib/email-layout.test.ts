import { describe, expect, it } from "vitest";
import {
  EMAIL_COLORS,
  EMAIL_LOGO_URL,
  escapeHtml,
  renderEmail,
  renderText,
  type EmailContent,
} from "@/lib/email/layout";

const email: EmailContent = {
  lang: "en",
  subject: "Your sign-in link",
  preview: "Tap to sign in",
  heading: "Sign in to biolyn",
  paragraphs: ["First line.", "Second <line>."],
  button: { label: "Sign in", url: "https://biolyn.link/a?b=1&c=2" },
  fallback: "Button not working?",
  note: "Ignore it if it wasn't you.",
  footer: "Sent because you asked.",
};

describe("escapeHtml", () => {
  it("escapes the characters HTML cares about", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("leaves Supabase placeholders alone", () => {
    expect(escapeHtml("{{ .ConfirmationURL }}")).toBe("{{ .ConfirmationURL }}");
  });
});

describe("renderEmail", () => {
  const html = renderEmail(email);

  it("is a full document in the right language", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Your sign-in link</title>");
  });

  it("supports light and dark mode", () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain(EMAIL_COLORS.light.canvas);
    expect(html).toContain("@media (prefers-color-scheme:dark)");
    expect(html).toContain(EMAIL_COLORS.dark.canvas);
  });

  it("shows the hosted logo with alt text", () => {
    expect(html).toContain(`src="${EMAIL_LOGO_URL}"`);
    expect(html).toContain('alt="biolyn"');
  });

  it("escapes the copy and the button link", () => {
    expect(html).toContain("Second &lt;line&gt;.");
    expect(html).toContain('href="https://biolyn.link/a?b=1&amp;c=2"');
    expect(html).toContain(">Sign in</a>");
  });

  it("repeats the link under the button", () => {
    expect(html).toContain("Button not working?");
    expect(html.split("https://biolyn.link/a?b=1&amp;c=2").length).toBe(4);
  });

  it("leaves out the parts it is not given", () => {
    const bare = renderEmail({
      lang: "es",
      subject: "s",
      preview: "p",
      heading: "h",
      paragraphs: [],
      footer: "f",
    });
    expect(bare).toContain('<html lang="es">');
    expect(bare).not.toContain("b-btn\" bgcolor");
    expect(bare).not.toContain("b-rule\" style");
  });

  it("shows detail rows", () => {
    const withRows = renderEmail({ ...email, details: [["Route", "/[x]"]] });
    expect(withRows).toContain(">Route</td>");
    expect(withRows).toContain(">/[x]</td>");
  });
});

describe("renderText", () => {
  it("has the same content without HTML", () => {
    const text = renderText({ ...email, details: [["Route", "/x"]] });
    expect(text).toBe(
      [
        "Sign in to biolyn",
        "",
        "First line.",
        "",
        "Second <line>.",
        "",
        "Route: /x",
        "",
        "Sign in: https://biolyn.link/a?b=1&c=2",
        "",
        "Ignore it if it wasn't you.",
        "",
        "--",
        "Sent because you asked.",
        "https://biolyn.link",
      ].join("\n"),
    );
  });

  it("skips the optional parts", () => {
    const text = renderText({
      lang: "en",
      subject: "s",
      preview: "p",
      heading: "h",
      paragraphs: ["x"],
      footer: "f",
    });
    expect(text).toBe("h\n\nx\n\n--\nf\nhttps://biolyn.link");
  });
});
