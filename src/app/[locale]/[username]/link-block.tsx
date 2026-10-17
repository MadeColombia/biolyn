import { CORNER_CLASSES, type CornerStyle } from "@/lib/corners";
import { youtubeThumbnail } from "@/lib/embeds";
import { isIconPreview } from "@/lib/link-form";
import type { PublicLink, PublicSection } from "@/lib/profiles";
import type { THEMES } from "@/lib/themes";
import { LinkCarousel } from "./link-carousel";

type Theme = (typeof THEMES)[keyof typeof THEMES];

// Heights the Spotify and Apple Music players are designed for.
const PLAYER_HEIGHT = {
  spotify: { short: "h-[152px]", tall: "h-[352px]" },
  apple: { short: "h-[175px]", tall: "h-[450px]" },
};

/** One link on the public page: a player, a big card or a button. */
export function LinkBlock({
  link,
  theme,
  corners,
}: {
  link: PublicLink;
  theme: Theme;
  corners: CornerStyle;
}) {
  const shape = CORNER_CLASSES[corners];
  if (link.embed) {
    return (
      // The player draws its own rounded corners. Clipping it to the
      // block shape keeps every block square-cut when the owner picks
      // Square.
      <div
        className={`w-full overflow-hidden ${shape.block} ${theme.embed} ${
          link.embed.kind === "youtube"
            ? "aspect-video"
            : PLAYER_HEIGHT[link.embed.kind][link.embed.tall ? "tall" : "short"]
        }`}
      >
        <iframe
          src={link.embed.src}
          title={link.title}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    );
  }
  if (link.size === "big") {
    return (
      <a
        href={`/api/click/${link.id}`}
        className={`block w-full overflow-hidden p-4 text-center font-semibold transition ${shape.block} ${theme.card}`}
      >
        {link.image_url && (
          <Picture src={link.image_url} theme={theme} corners={corners} />
        )}
        <span
          className={`block px-4 text-lg ${link.image_url ? "py-4" : "py-8"}`}
        >
          {link.title}
        </span>
      </a>
    );
  }
  return (
    <a
      href={`/api/click/${link.id}`}
      className={`block w-full px-4 py-4 text-center font-medium transition ${shape.block} ${theme.button}`}
    >
      {link.title}
    </a>
  );
}

/**
 * A link as a card in a carousel: a wide picture with the title under it.
 * Without a picture it uses the YouTube thumbnail, or the title's first
 * letter on a tinted panel. Players open as links here.
 */
export function LinkCard({
  link,
  theme,
  corners,
}: {
  link: PublicLink;
  theme: Theme;
  corners: CornerStyle;
}) {
  const picture = link.image_url ?? youtubeThumbnail(link.url);
  return (
    <a
      href={`/api/click/${link.id}`}
      className={`flex h-full w-full flex-col overflow-hidden p-2 font-semibold transition ${CORNER_CLASSES[corners].block} ${theme.card}`}
    >
      {picture ? (
        <Picture src={picture} theme={theme} corners={corners} />
      ) : (
        <span
          aria-hidden
          className={`flex aspect-video w-full items-center justify-center text-4xl font-bold ${CORNER_CLASSES[corners].inner} ${theme.avatar}`}
        >
          {link.title.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="line-clamp-2 px-2 pt-3 pb-2 leading-snug">
        {link.title}
      </span>
    </a>
  );
}

// A link's 16:9 picture. A site icon sits small and centered on a tinted
// panel instead of being cropped to fill it.
function Picture({
  src,
  theme,
  corners,
}: {
  src: string;
  theme: Theme;
  corners: CornerStyle;
}) {
  const inner = CORNER_CLASSES[corners].inner;
  if (isIconPreview(src)) {
    return (
      <span
        className={`flex aspect-video w-full items-center justify-center ${inner} ${theme.avatar}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-1/2 w-auto max-w-1/2 object-contain"
        />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`aspect-video w-full object-cover ${inner}`}
    />
  );
}

/** A section: its title, then its links as buttons or a row of cards. */
export function SectionBlock({
  section,
  theme,
  corners,
  fallbackLabel,
}: {
  section: PublicSection;
  theme: Theme;
  corners: CornerStyle;
  /** Names the card row for screen readers when there is no title. */
  fallbackLabel: string;
}) {
  const headingId = `section-${section.id}`;
  return (
    <section
      aria-labelledby={section.title ? headingId : undefined}
      aria-label={section.title ? undefined : fallbackLabel}
      className="flex w-full flex-col gap-3"
    >
      {section.title && (
        <h2 id={headingId} className="text-center text-lg font-bold">
          {section.title}
        </h2>
      )}
      {section.layout === "carousel" ? (
        <LinkCarousel label={section.title ?? fallbackLabel}>
          {section.links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              theme={theme}
              corners={corners}
            />
          ))}
        </LinkCarousel>
      ) : (
        <ul className="flex w-full flex-col gap-3">
          {section.links.map((link) => (
            <li key={link.id}>
              <LinkBlock link={link} theme={theme} corners={corners} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
