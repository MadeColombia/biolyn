import type { BioNode } from "@/lib/rich-bio";

const MARK_TAG = { b: "strong", i: "em", u: "u", s: "s" } as const;

/**
 * Shows a parsed bio as React elements. Text is always text here, never
 * HTML, so nothing in a bio can run as code.
 */
export function RichBio({ nodes }: { nodes: BioNode[] }) {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "br":
        return <br key={i} />;
      case "mark": {
        const Tag = MARK_TAG[node.mark];
        return (
          <Tag key={i}>
            <RichBio nodes={node.children} />
          </Tag>
        );
      }
      case "link":
        return (
          <a
            key={i}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="underline underline-offset-2 hover:opacity-80"
          >
            <RichBio nodes={node.children} />
          </a>
        );
    }
  });
}
