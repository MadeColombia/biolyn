import "server-only";
import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  isLocale,
  pickLocale,
  type Locale,
} from "./locale";
import { translator } from "./translate";

/**
 * The visitor's language in server actions, where pages' route params
 * are not available. The proxy passes on the language it picked for the
 * page; without it, the same rule the proxy uses decides.
 */
export async function requestLocale(): Promise<Locale> {
  const h = await headers();
  const fromProxy = h.get(LOCALE_HEADER);
  if (isLocale(fromProxy)) return fromProxy;
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  return pickLocale(saved, h.get("accept-language"));
}

/** Text in the visitor's language, for server actions. */
export async function actionTranslator() {
  return translator(await requestLocale());
}
