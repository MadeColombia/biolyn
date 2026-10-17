import { createTranslator } from "next-intl";
import type { Locale } from "./locale";
import { MESSAGES } from "./messages";

/** Text in one language, outside React (actions, images, wallet passes). */
export function translator(locale: Locale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}
