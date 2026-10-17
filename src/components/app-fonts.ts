// The app's own fonts, loaded once by the root layout
// (app/[locale]/layout.tsx).
import { Geist, Geist_Mono, IBM_Plex_Sans, Unbounded } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Design system fonts (see docs/design-system.md): Unbounded for headings
// (font-display), IBM Plex Sans for text (font-body).
export const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});
