import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { Locale } from "./locale";

// Every piece of text the app shows, per language. en.json is the source:
// es.json must have exactly the same keys (tests/i18n/messages.test.ts).
export const MESSAGES = { en, es } satisfies Record<Locale, typeof en>;
export type Messages = typeof en;
