import type { Locale } from "./locale";
import type { Messages } from "./messages";

// Makes t("...") keys type-checked against en.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
