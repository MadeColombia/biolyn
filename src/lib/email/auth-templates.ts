import { renderEmail, type EmailContent } from "./layout";

// The sign-in emails Supabase sends. Supabase keeps one template per email
// type, so each template holds both languages and picks one with the
// locale saved on the account (user_metadata.locale, set at sign-in by
// /auth/callback). Accounts without one get English.
//
// The files in supabase/templates are built from this file by
// tests/lib/email-templates.test.ts. After changing the copy run
// `npm run email:templates` and paste the new files into Supabase
// (docs/email-templates.md says where).

export const AUTH_EMAIL_TYPES = ["magic_link", "confirmation"] as const;
export type AuthEmailType = (typeof AUTH_EMAIL_TYPES)[number];

type Copy = Omit<EmailContent, "lang" | "button"> & { button: string };

const LINK = "{{ .ConfirmationURL }}";

const COPY: Record<AuthEmailType, Record<"en" | "es", Copy>> = {
  magic_link: {
    en: {
      subject: "Your sign-in link",
      preview: "Tap the button to sign in. No password needed.",
      heading: "Sign in to biolyn",
      paragraphs: [
        "Tap the button below to sign in. Open it on the same phone or computer where you asked for it.",
      ],
      button: "Sign in",
      fallback: "Button not working? Copy this link into your browser:",
      note: "This link works once and only for a short time. If you didn't ask for it, you can ignore this email. Nobody can sign in without it.",
      footer: "You got this email because someone asked to sign in with this address.",
    },
    es: {
      subject: "Tu enlace para entrar",
      preview: "Toca el botón para entrar. No necesitas contraseña.",
      heading: "Entra en biolyn",
      paragraphs: [
        "Toca el botón para entrar. Ábrelo en el mismo móvil u ordenador desde el que lo pediste.",
      ],
      button: "Entrar",
      fallback: "¿El botón no funciona? Copia este enlace en tu navegador:",
      note: "Este enlace funciona una sola vez y caduca pronto. Si no lo pediste tú, puedes ignorar este correo. Nadie puede entrar sin él.",
      footer: "Recibiste este correo porque alguien pidió entrar con esta dirección.",
    },
  },
  confirmation: {
    en: {
      subject: "Confirm your email",
      preview: "One tap and you can start building your page.",
      heading: "Welcome! Confirm your email",
      paragraphs: [
        "Tap the button below to confirm your email and start building your page. Open it on the same phone or computer where you signed up.",
      ],
      button: "Confirm email",
      fallback: "Button not working? Copy this link into your browser:",
      note: "This link works once and only for a short time. If you didn't sign up, you can ignore this email.",
      footer: "You got this email because someone signed up with this address.",
    },
    es: {
      subject: "Confirma tu correo",
      preview: "Un toque y ya puedes empezar a crear tu página.",
      heading: "¡Hola! Confirma tu correo",
      paragraphs: [
        "Toca el botón para confirmar tu correo y empezar a crear tu página. Ábrelo en el mismo móvil u ordenador desde el que te registraste.",
      ],
      button: "Confirmar correo",
      fallback: "¿El botón no funciona? Copia este enlace en tu navegador:",
      note: "Este enlace funciona una sola vez y caduca pronto. Si no te registraste, puedes ignorar este correo.",
      footer: "Recibiste este correo porque alguien se registró con esta dirección.",
    },
  },
};

// printf turns a missing locale into "<nil>" instead of failing the
// comparison, so accounts without one fall through to English.
const IF_SPANISH = '{{ if eq (printf "%v" .Data.locale) "es" }}';

function content(type: AuthEmailType, lang: "en" | "es"): EmailContent {
  const { button, ...copy } = COPY[type][lang];
  return { ...copy, lang, button: { label: button, url: LINK } };
}

/** The subject and body to paste into Supabase for one email type. */
export function supabaseTemplate(type: AuthEmailType): {
  subject: string;
  html: string;
} {
  const { en, es } = COPY[type];
  return {
    subject: `${IF_SPANISH}${es.subject}{{ else }}${en.subject}{{ end }}`,
    html: `${IF_SPANISH}\n${renderEmail(content(type, "es"))}\n{{ else }}\n${renderEmail(content(type, "en"))}\n{{ end }}\n`,
  };
}
