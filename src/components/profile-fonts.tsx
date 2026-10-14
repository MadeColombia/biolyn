import { Caveat, Nunito, Playfair_Display, Space_Mono } from "next/font/google";
import type { FontId } from "@/lib/fonts";

// Browsers only download a font when something on the page uses it, so
// each visitor gets just the owner's pick.
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const nunito = Nunito({ subsets: ["latin"], display: "swap" });
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const caveat = Caveat({ subsets: ["latin"], display: "swap" });

/** Class that sets each font. Clean is the site's own body font. */
export const FONT_CLASS: Record<FontId, string> = {
  clean: "font-body",
  elegant: playfair.className,
  rounded: nunito.className,
  typewriter: spaceMono.className,
  handwritten: caveat.className,
};

/** Extra classes for the public page. Caveat runs small, so it gets more size. */
export const FONT_PAGE_CLASS: Record<FontId, string> = {
  ...FONT_CLASS,
  handwritten: `${caveat.className} text-[1.2em]`,
};
